#include <SoftwareSerial.h>
#include <EEPROM.h>

SoftwareSerial sim800(2, 3); // D2 = RX Arduino, D3 = TX Arduino via divisor de tensão

#define RELAY1_PIN 8
#define RELAY2_PIN 9
#define RELAY3_PIN 10
#define RELAY_ON LOW
#define RELAY_OFF HIGH

const char* APN = "internet";
const char* SERVER = "https://YOUR-RENDER-APP.onrender.com";
const char* DEVICE_ID = "CASA01";
const char* DEVICE_KEY = "CHAVE_SEGURA_123";

unsigned long lastSync = 0;
const unsigned long syncInterval = 12000;
int lastSeq = 0;

bool r1 = false;
bool r2 = false;
bool r3 = false;
int lastRssiDbm = -113;

const int EEPROM_MAGIC_ADDR = 0;
const int EEPROM_STATE_ADDR = 1;
const byte EEPROM_MAGIC_VALUE = 0x42;

String readResponse(unsigned long timeout = 8000) {
  String data = "";
  unsigned long start = millis();
  while (millis() - start < timeout) {
    while (sim800.available()) data += (char)sim800.read();
  }
  return data;
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

void sendAT(const String& cmd, unsigned long timeout = 2000) {
  while (sim800.available()) sim800.read();
  sim800.println(cmd);
  delay(timeout);
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

byte relayStateToByte(bool a, bool b, bool c) {
  return (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0);
}

void writeRelayStateToEeprom() {
  byte state = relayStateToByte(r1, r2, r3);
  EEPROM.update(EEPROM_MAGIC_ADDR, EEPROM_MAGIC_VALUE);
  EEPROM.update(EEPROM_STATE_ADDR, state);
}

bool loadRelayStateFromEeprom() {
  if (EEPROM.read(EEPROM_MAGIC_ADDR) != EEPROM_MAGIC_VALUE) return false;

  byte state = EEPROM.read(EEPROM_STATE_ADDR);
  r1 = state & 1;
  r2 = state & 2;
  r3 = state & 4;
  return true;
}

void applyRelayState(bool a, bool b, bool c, bool saveToEeprom = true) {
  bool changed = (r1 != a) || (r2 != b) || (r3 != c);

  r1 = a;
  r2 = b;
  r3 = c;
  digitalWrite(RELAY1_PIN, r1 ? RELAY_ON : RELAY_OFF);
  digitalWrite(RELAY2_PIN, r2 ? RELAY_ON : RELAY_OFF);
  digitalWrite(RELAY3_PIN, r3 ? RELAY_ON : RELAY_OFF);

  if (saveToEeprom && changed) {
    writeRelayStateToEeprom();
  }
}

bool gsmInit() {
  sim800.begin(9600);
  delay(3000);

  sendAT("AT", 1000);
  if (!waitFor("OK", 2000)) return false;

  sendAT("ATE0", 1000);
  waitFor("OK", 2000);
  sendAT("AT+CPIN?", 1000);
  waitFor("OK", 3000);
  sendAT("AT+CREG?", 1000);
  waitFor("OK", 3000);
  sendAT("AT+SAPBR=3,1,\"CONTYPE\",\"GPRS\"", 1000);
  waitFor("OK", 3000);
  sendAT(String("AT+SAPBR=3,1,\"APN\",\"") + APN + "\"", 1000);
  waitFor("OK", 3000);
  sendAT("AT+SAPBR=1,1", 3000);
  waitFor("OK", 8000);
  sendAT("AT+SAPBR=2,1", 1500);
  return waitFor("OK", 3000);
}

String httpGET(const String& url) {
  while (sim800.available()) sim800.read();

  sendAT("AT+HTTPTERM", 1000);
  sendAT("AT+HTTPINIT", 1000);
  if (!waitFor("OK", 3000)) return "";

  sendAT("AT+HTTPPARA=\"CID\",1", 1000);
  waitFor("OK", 3000);
  sendAT("AT+HTTPSSL=1", 1000);
  waitFor("OK", 3000);
  sendAT(String("AT+HTTPPARA=\"URL\",\"") + url + "\"", 1000);
  waitFor("OK", 3000);

  sim800.println("AT+HTTPACTION=0");
  if (!waitFor("+HTTPACTION:", 15000)) {
    sendAT("AT+HTTPTERM", 1000);
    return "";
  }

  sim800.println("AT+HTTPREAD");
  delay(1000);
  String body = readResponse(7000);
  sendAT("AT+HTTPTERM", 1000);
  return body;
}

String buildPullUrl() {
  return String(SERVER) + "/api/device/" + DEVICE_ID + "/pull?key=" + DEVICE_KEY + "&seq=" + String(lastSeq);
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

String buildPushUrl() {
  return String(SERVER) + "/api/device/" + DEVICE_ID + "/push?key=" + DEVICE_KEY +
         "&r1=" + String(r1 ? 1 : 0) +
         "&r2=" + String(r2 ? 1 : 0) +
         "&r3=" + String(r3 ? 1 : 0) +
         "&rssi=" + String(readRssiDbm());
}

void reportStatus() {
  Serial.println("PUSH RESP:");
  Serial.println(httpGET(buildPushUrl()));
}

void syncFromServer() {
  String resp = httpGET(buildPullUrl());
  Serial.println("PULL RESP:");
  Serial.println(resp);

  if (resp.indexOf("DENIED") != -1 || resp.length() == 0 || resp.indexOf("NONE") != -1) return;

  String seqS = extractValue(resp, "SEQ=");
  if (seqS.length() > 0) lastSeq = seqS.toInt();

  applyRelayState(
    asBool(extractValue(resp, "R1=")),
    asBool(extractValue(resp, "R2=")),
    asBool(extractValue(resp, "R3="))
  );
  delay(300);
  reportStatus();
}

void setup() {
  Serial.begin(9600);
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  pinMode(RELAY3_PIN, OUTPUT);
  if (loadRelayStateFromEeprom()) {
    applyRelayState(r1, r2, r3, false);
    Serial.println("Estado restaurado da EEPROM");
  } else {
    applyRelayState(false, false, false, false);
    writeRelayStateToEeprom();
    Serial.println("Sem estado gravado na EEPROM; reles desligados");
  }

  Serial.println("Iniciando...");
  Serial.println(gsmInit() ? "GSM OK" : "GSM FALHOU");
  reportStatus();
}

void loop() {
  if (millis() - lastSync >= syncInterval) {
    lastSync = millis();
    syncFromServer();
  }
}
