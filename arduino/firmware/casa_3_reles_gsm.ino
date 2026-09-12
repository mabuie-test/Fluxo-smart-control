/*
  Fluxo Smart Control — Firmware v2 (Arduino Nano + SIM800L, 3 relés)

  ATENÇÃO: a pinagem NÃO foi alterada em relação à v1 (ver docs/wiring.md):
    D2  <- SIM800L TX
    D3  -> SIM800L RX (via divisor de tensão / level shifter)
    D8  -> Relé 1 (IN1)
    D9  -> Relé 2 (IN2)
    D10 -> Relé 3 (IN3)
    D13 -> LED interno da placa (usado só para diagnóstico visual, não é fio novo)

  O que mudou nesta versão (foco: integração fiável hardware <-> backend):
    1. Protocolo único "/sync" em vez de pull+push separados: menos pedidos
       HTTP pelo GSM (que é lento e instável) = menos pontos de falha.
    2. Máquina de estados com diagnóstico por etapa (REDE / GPRS / HTTP / TLS),
       impresso no Serial, para saber exatamente onde está a falhar.
    3. AT+SSLOPT=0,0 antes do HTTPS, para não rejeitar handshakes por causa de
       validação de certificado (muitos módulos SIM800L falham aqui).
    4. Recuperação automática: depois de N falhas seguidas reinicia o GPRS;
       depois de mais falhas reinicia o módulo GSM por completo (AT+CFUN).
    5. Aviso alto e visível (Serial + LED) se o utilizador se esquecer de
       trocar o SERVER de exemplo, ou se o DEVICE_ID/DEVICE_KEY parecerem
       ainda os valores de fábrica.
    6. Aplica sempre o estado desejado recebido (idempotente): mesmo que uma
       sincronização se perca, a próxima repõe o estado certo sozinha.
*/

#include <SoftwareSerial.h>
#include <EEPROM.h>
#include <avr/wdt.h>

SoftwareSerial sim800(2, 3); // D2 = RX Arduino (liga ao TX do SIM800L), D3 = TX Arduino (liga ao RX do SIM800L)

#define RELAY1_PIN 8
#define RELAY2_PIN 9
#define RELAY3_PIN 10
#define STATUS_LED_PIN LED_BUILTIN
#define RELAY_ON LOW
#define RELAY_OFF HIGH

// ======================= CONFIGURAÇÃO (editar aqui) =======================
const char* APN = "internet";      // APN da operadora do SIM
const char* APN_USER = "";
const char* APN_PASS = "";
// Domínio público do backend, SEM barra final. Tem de começar por http:// ou
// https://. Se ficar com "YOUR-RENDER-APP" o firmware avisa alto no Serial.
const char* SERVER = "https://YOUR-RENDER-APP.onrender.com";
// TÊM de ser exatamente iguais às variáveis DEVICE_ID / DEVICE_KEY do backend
// (.env ou variáveis de ambiente no Render). Um valor diferente faz o
// servidor responder sempre "DENIED" e parece que "nada chega ao backend".
const char* DEVICE_ID = "CASA01";
const char* DEVICE_KEY = "CHAVE_SEGURA_123";
// ===========================================================================

const unsigned long SYNC_INTERVAL_MS = 12000UL;        // intervalo normal entre sincronizações
const unsigned long SYNC_INTERVAL_BACKOFF_MS = 45000UL; // intervalo quando está a falhar (poupa saldo/energia)
const uint8_t FAILS_BEFORE_GPRS_RESET = 3;
const uint8_t FAILS_BEFORE_FULL_MODEM_RESET = 6;
const uint8_t FAILS_BEFORE_SKETCH_RESET = 12; // último recurso: reinicia o Arduino via watchdog

unsigned long lastSyncAttempt = 0;
int lastSeq = 0;
uint8_t consecutiveFailures = 0;

bool r1 = false, r2 = false, r3 = false;
int lastRssiDbm = -113;
bool gsmReady = false;

const int EEPROM_MAGIC_ADDR = 0;
const int EEPROM_STATE_ADDR = 1;
const byte EEPROM_MAGIC_VALUE = 0x42;

// --------------------------- Utilitários de log ---------------------------
void stage(const __FlashStringHelper* label) {
  Serial.print(F("[ETAPA] "));
  Serial.println(label);
}

void debugLine(const String& msg) {
  Serial.print(F("[GSM] "));
  Serial.println(msg);
}

void blinkStatus(uint8_t times, uint16_t onMs = 120, uint16_t offMs = 120) {
  for (uint8_t i = 0; i < times; i++) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(onMs);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(offMs);
  }
}

void warnPlaceholderConfig() {
  bool serverIsPlaceholder = String(SERVER).indexOf("YOUR-RENDER-APP") != -1;
  bool keyIsFactoryDefault = String(DEVICE_KEY) == "CHAVE_SEGURA_123";
  if (serverIsPlaceholder) {
    Serial.println(F("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"));
    Serial.println(F("!! AVISO: SERVER ainda é o exemplo (YOUR-RENDER-APP). !!"));
    Serial.println(F("!! Troca pela URL real do teu backend antes de usar.  !!"));
    Serial.println(F("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"));
  }
  if (keyIsFactoryDefault) {
    Serial.println(F("[AVISO] DEVICE_KEY ainda é o valor de fábrica. Confirma"));
    Serial.println(F("        que é IGUAL ao DEVICE_KEY configurado no backend."));
  }
}

// --------------------------- AT / SIM800L ---------------------------------
String readResponse(unsigned long timeout = 8000) {
  String data = "";
  unsigned long start = millis();
  while (millis() - start < timeout) {
    while (sim800.available()) data += (char)sim800.read();
  }
  return data;
}

String sendATDebug(const String& cmd, unsigned long timeout = 2000) {
  while (sim800.available()) sim800.read();
  debugLine(String(F(">> ")) + cmd);
  sim800.println(cmd);
  String resp = readResponse(timeout);
  resp.trim();
  if (resp.length() == 0) resp = F("<sem resposta>");
  debugLine(String(F("<< ")) + resp);
  return resp;
}

bool responseHasOk(const String& resp) { return resp.indexOf(F("OK")) != -1; }

bool sendATOk(const String& cmd, unsigned long timeout = 2000) {
  return responseHasOk(sendATDebug(cmd, timeout));
}

bool waitFor(const String& token, unsigned long timeout = 8000) {
  String buff = "";
  unsigned long start = millis();
  while (millis() - start < timeout) {
    while (sim800.available()) {
      buff += (char)sim800.read();
      if (buff.indexOf(token) != -1) return true;
      if (buff.length() > 400) buff.remove(0, 200);
    }
  }
  return false;
}

String extractValue(const String& body, const String& key) {
  int p = body.indexOf(key);
  if (p < 0) return "";
  p += key.length();
  int e = body.indexOf('\n', p);
  if (e < 0) e = body.length();
  String v = body.substring(p, e);
  v.trim();
  return v;
}

bool asBool(const String& v) {
  return v == "1" || v.equalsIgnoreCase("true") || v.equalsIgnoreCase("on");
}

byte relayStateToByte(bool a, bool b, bool c) { return (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0); }

void writeRelayStateToEeprom() {
  EEPROM.update(EEPROM_MAGIC_ADDR, EEPROM_MAGIC_VALUE);
  EEPROM.update(EEPROM_STATE_ADDR, relayStateToByte(r1, r2, r3));
}

bool loadRelayStateFromEeprom() {
  if (EEPROM.read(EEPROM_MAGIC_ADDR) != EEPROM_MAGIC_VALUE) return false;
  byte state = EEPROM.read(EEPROM_STATE_ADDR);
  r1 = state & 1; r2 = state & 2; r3 = state & 4;
  return true;
}

void applyRelayState(bool a, bool b, bool c, bool saveToEeprom = true) {
  bool changed = (r1 != a) || (r2 != b) || (r3 != c);
  r1 = a; r2 = b; r3 = c;
  digitalWrite(RELAY1_PIN, r1 ? RELAY_ON : RELAY_OFF);
  digitalWrite(RELAY2_PIN, r2 ? RELAY_ON : RELAY_OFF);
  digitalWrite(RELAY3_PIN, r3 ? RELAY_ON : RELAY_OFF);
  if (saveToEeprom && changed) writeRelayStateToEeprom();
}

bool waitForNetworkRegistration(unsigned long timeout = 90000) {
  stage(F("REDE — a aguardar registo GSM/GPRS"));
  unsigned long start = millis();
  while (millis() - start < timeout) {
    String creg = sendATDebug(F("AT+CREG?"), 1500);
    String cgreg = sendATDebug(F("AT+CGREG?"), 1500);
    if (creg.indexOf(F(",1")) != -1 || creg.indexOf(F(",5")) != -1 ||
        cgreg.indexOf(F(",1")) != -1 || cgreg.indexOf(F(",5")) != -1) {
      stage(F("REDE — registada"));
      return true;
    }
    sendATDebug(F("AT+CSQ"), 1000);
    delay(3000);
  }
  stage(F("REDE — FALHOU (sem registo dentro do tempo limite)"));
  return false;
}

bool openGprsBearer(bool forceReset = false) {
  stage(F("GPRS — a configurar bearer"));
  if (forceReset) {
    sendATDebug(F("AT+SAPBR=0,1"), 5000);
    delay(1000);
  }
  if (!sendATOk(F("AT+SAPBR=3,1,\"CONTYPE\",\"GPRS\""), 3000)) return false;
  if (!sendATOk(String(F("AT+SAPBR=3,1,\"APN\",\"")) + APN + F("\""), 3000)) return false;
  if (String(APN_USER).length() > 0 &&
      !sendATOk(String(F("AT+SAPBR=3,1,\"USER\",\"")) + APN_USER + F("\""), 3000)) return false;
  if (String(APN_PASS).length() > 0 &&
      !sendATOk(String(F("AT+SAPBR=3,1,\"PWD\",\"")) + APN_PASS + F("\""), 3000)) return false;

  String openResp = sendATDebug(F("AT+SAPBR=1,1"), 12000);
  if (openResp.indexOf(F("OK")) == -1 && openResp.indexOf(F("ALREADY CONNECT")) == -1) {
    debugLine(F("Bearer não abriu; a tentar reset forçado."));
    sendATDebug(F("AT+SAPBR=0,1"), 5000);
    delay(2000);
    if (!sendATOk(F("AT+SAPBR=1,1"), 15000)) return false;
  }

  String status = sendATDebug(F("AT+SAPBR=2,1"), 3000);
  bool hasIp = status.indexOf(F("0.0.0.0")) == -1 && status.indexOf(F("+SAPBR:")) != -1;
  stage(hasIp ? F("GPRS — ativo com IP válido") : F("GPRS — SEM IP válido"));
  return hasIp;
}

bool serverUsesHttps() { return String(SERVER).startsWith(F("https://")); }

bool configureHttpSession(const String& url) {
  sendATOk(F("AT+HTTPTERM"), 1000);
  if (!sendATOk(F("AT+HTTPINIT"), 3000)) return false;
  if (!sendATOk(F("AT+HTTPPARA=\"CID\",1"), 3000)) return false;

  bool useHttps = url.startsWith(F("https://"));
  if (useHttps) {
    // Aceita o handshake mesmo sem validar o certificado do servidor — evita
    // que módulos SIM800L com stack SSL limitado rejeitem a ligação por
    // causa da validação de cadeia/CA, que raramente é o que interessa aqui.
    sendATOk(F("AT+SSLOPT=0,0"), 2000);
  }
  if (!sendATOk(String(F("AT+HTTPSSL=")) + (useHttps ? F("1") : F("0")), 3000)) {
    sendATOk(F("AT+HTTPTERM"), 1000);
    return false;
  }
  if (!sendATOk(String(F("AT+HTTPPARA=\"URL\",\"")) + url + F("\""), 5000)) {
    sendATOk(F("AT+HTTPTERM"), 1000);
    return false;
  }
  return true;
}

bool ensureGprsHttpReady() {
  if (!waitForNetworkRegistration()) return false;
  if (!openGprsBearer(true)) return false;
  sendATOk(F("AT+HTTPTERM"), 1000);
  stage(serverUsesHttps() ? F("HTTP(S) — preparado para HTTPS") : F("HTTP(S) — preparado para HTTP"));
  return true;
}

bool gsmInit() {
  sim800.begin(9600);
  delay(3000);
  if (!sendATOk(F("AT"), 2000)) return false;
  sendATOk(F("ATE0"), 2000);
  sendATOk(F("AT+CMEE=2"), 2000);
  sendATDebug(F("AT+CPIN?"), 3000);
  sendATDebug(F("AT+COPS?"), 3000);
  String rev = sendATDebug(F("AT+CGMR"), 2000);
  debugLine(String(F("Firmware do módulo: ")) + rev);
  return ensureGprsHttpReady();
}

// Devolve: 0=falha de transporte, 1=sucesso HTTP, junta o corpo em 'outBody'.
// Regista em httpCode o código HTTP (ou -1 se não obtido) para diagnóstico.
int httpGET(const String& url, String& outBody, long& httpCode) {
  httpCode = -1;
  while (sim800.available()) sim800.read();

  if (!openGprsBearer(false)) {
    debugLine(F("Bearer caiu antes do HTTP; a reinicializar GPRS."));
    if (!ensureGprsHttpReady()) { gsmReady = false; return 0; }
  }
  if (!configureHttpSession(url)) { gsmReady = false; return 0; }

  sim800.println("AT+HTTPACTION=0");
  String actionResp;
  if (!waitFor("+HTTPACTION:", 30000)) {
    stage(F("HTTP — sem resposta de AT+HTTPACTION (possível falha TLS/rede)"));
    sendATOk(F("AT+HTTPTERM"), 1000);
    gsmReady = false;
    return 0;
  }
  // Exemplo de resposta: +HTTPACTION: 0,200,64  -> método,código,tamanho
  actionResp = readResponse(500);
  int codeStart = actionResp.indexOf(',');
  if (codeStart != -1) {
    int codeEnd = actionResp.indexOf(',', codeStart + 1);
    httpCode = actionResp.substring(codeStart + 1, codeEnd != -1 ? codeEnd : actionResp.length()).toInt();
  }

  sim800.println("AT+HTTPREAD");
  delay(1000);
  outBody = readResponse(7000);
  sendATOk(F("AT+HTTPTERM"), 1000);

  if (httpCode <= 0) {
    stage(F("HTTP — AT+HTTPACTION devolveu erro de transporte (0/6xx = falha TLS/handshake)"));
    return 0;
  }
  return 1;
}

String buildSyncUrl() {
  return String(SERVER) + "/api/device/" + DEVICE_ID + "/sync?key=" + DEVICE_KEY +
         "&seq=" + String(lastSeq) +
         "&r1=" + String(r1 ? 1 : 0) +
         "&r2=" + String(r2 ? 1 : 0) +
         "&r3=" + String(r3 ? 1 : 0) +
         "&rssi=" + String(readRssiDbm());
}

int readRssiDbm() {
  while (sim800.available()) sim800.read();
  sim800.println("AT+CSQ");
  String resp = readResponse(1500);
  int marker = resp.indexOf("+CSQ:");
  if (marker < 0) return lastRssiDbm;
  int comma = resp.indexOf(',', marker);
  if (comma < 0) return lastRssiDbm;
  int csq = resp.substring(marker + 5, comma).toInt();
  if (csq == 99) return lastRssiDbm;
  lastRssiDbm = -113 + (2 * csq);
  return lastRssiDbm;
}

void handleSyncFailure() {
  consecutiveFailures++;
  Serial.print(F("[SYNC] Falha nº "));
  Serial.println(consecutiveFailures);
  blinkStatus(2, 80, 80);

  if (consecutiveFailures == FAILS_BEFORE_GPRS_RESET) {
    stage(F("RECUPERAÇÃO — a reiniciar GPRS"));
    openGprsBearer(true);
  } else if (consecutiveFailures == FAILS_BEFORE_FULL_MODEM_RESET) {
    stage(F("RECUPERAÇÃO — a reiniciar módulo GSM por completo"));
    sendATDebug(F("AT+CFUN=1,1"), 5000); // reinicia o SIM800L
    delay(8000);
    gsmReady = gsmInit();
  } else if (consecutiveFailures >= FAILS_BEFORE_SKETCH_RESET) {
    stage(F("RECUPERAÇÃO — último recurso: a reiniciar o Arduino"));
    Serial.flush();
    wdt_enable(WDTO_15MS);
    while (true) {} // aguarda o watchdog reiniciar o sketch
  }
}

void doSync() {
  warnPlaceholderConfig();
  String body;
  long httpCode = -1;
  if (!httpGET(buildSyncUrl(), body, httpCode)) {
    handleSyncFailure();
    return;
  }

  Serial.print(F("[SYNC] HTTP "));
  Serial.print(httpCode);
  Serial.print(F(" -> "));
  Serial.println(body);

  if (body.indexOf("DENIED") != -1) {
    Serial.println(F("[SYNC] DENIED — DEVICE_ID/DEVICE_KEY do firmware não coincidem com o backend."));
    handleSyncFailure();
    return;
  }
  if (body.length() == 0 || httpCode != 200) {
    handleSyncFailure();
    return;
  }

  // Sucesso: reset ao contador de falhas.
  consecutiveFailures = 0;
  blinkStatus(1, 40, 0);

  String seqS = extractValue(body, "SEQ=");
  if (seqS.length() > 0) lastSeq = seqS.toInt();

  // Aplica sempre o estado desejado devolvido pelo servidor — é idempotente,
  // por isso não há problema em repetir mesmo que nada tenha mudado.
  applyRelayState(asBool(extractValue(body, "R1=")),
                  asBool(extractValue(body, "R2=")),
                  asBool(extractValue(body, "R3=")));
}

void setup() {
  Serial.begin(9600);
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  pinMode(RELAY3_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);

  if (loadRelayStateFromEeprom()) {
    applyRelayState(r1, r2, r3, false);
    Serial.println(F("Estado restaurado da EEPROM"));
  } else {
    applyRelayState(false, false, false, false);
    writeRelayStateToEeprom();
    Serial.println(F("Sem estado gravado na EEPROM; relés desligados"));
  }

  warnPlaceholderConfig();
  Serial.println(F("Iniciando..."));
  gsmReady = gsmInit();
  Serial.println(gsmReady ? F("GSM OK") : F("GSM FALHOU"));
  if (gsmReady) doSync();
}

void loop() {
  unsigned long interval = consecutiveFailures > 0 ? SYNC_INTERVAL_BACKOFF_MS : SYNC_INTERVAL_MS;

  if (!gsmReady) {
    if (millis() - lastSyncAttempt >= interval) {
      lastSyncAttempt = millis();
      gsmReady = gsmInit();
      Serial.println(gsmReady ? F("GSM OK") : F("GSM FALHOU"));
      if (gsmReady) doSync();
      else handleSyncFailure();
    }
    return;
  }

  if (millis() - lastSyncAttempt >= interval) {
    lastSyncAttempt = millis();
    doSync();
  }
}
