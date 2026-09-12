# API

Todas as respostas JSON seguem o formato `{ "ok": boolean, "data"?: object, "message"?: string }`.

## Autenticação

- `POST /api/auth/register` cria conta com `name`, `email` e `password`.
- `POST /api/auth/login` devolve JWT com `email` e `password` válidos.
- `GET /api/auth/me` valida o JWT atual.
- `POST /api/auth/forgot-password` gera token de recuperação. Em produção o token não é exposto na resposta.
- `POST /api/auth/reset-password` altera a senha com `token` e `password`.

A senha deve ter pelo menos 8 caracteres.

## Painel protegido

Enviar `Authorization: Bearer <token>`.

- `GET /api/device/:deviceId/state` obtém estado desejado, estado real, sincronização, online e logs.
- `GET|POST /api/device/:deviceId/set?r1=1&r2=0&r3=1` altera o estado desejado e incrementa `seq`.
- `GET /api/logs/:deviceId/logs` obtém os logs recentes.

## Firmware SIM800L

Estes endpoints usam `DEVICE_KEY` e retornam texto simples para facilitar o parsing no Arduino. **Não** exigem `Authorization`.

### `GET|POST /api/device/:deviceId/ping`

Não exige `key`. Responde sempre `PONG`. Serve só para confirmar que o backend está alcançável a partir do SIM800L (rede/TLS) antes de testar o resto do fluxo — é o primeiro teste a fazer quando a integração não funciona.

### `GET|POST /api/device/:deviceId/sync?key=<DEVICE_KEY>&seq=<seq>&r1=<0|1>&r2=<0|1>&r3=<0|1>&rssi=<dBm>`

Endpoint único que substitui os antigos `pull` + `push` da v1. Numa só chamada:

1. Se `r1`/`r2`/`r3` vierem no pedido, o backend regista-os como estado **real** do dispositivo (equivalente ao antigo `push`).
2. O backend responde sempre com o estado **desejado** atual (equivalente ao antigo `pull`).

Isto reduz para metade o número de pedidos HTTP que o SIM800L precisa de fazer por ciclo — importante porque cada `AT+HTTPACTION` é lento e é o elo mais frágil da cadeia.

Respostas possíveis (`text/plain`):

```
DENIED
```
`deviceId`/`key` não correspondem a nenhum dispositivo registado. Ver secção de resolução de problemas abaixo.

```
OK
SEQ=5
R1=1
R2=0
R3=1
```
Há uma mudança de estado a aplicar (ou o `seq` enviado está desatualizado).

```
NONE
SEQ=5
R1=1
R2=0
R3=1
```
Nenhuma mudança pendente — mas o firmware deve aplicar `R1/R2/R3` na mesma (é idempotente) para se auto-corrigir caso uma sincronização anterior se tenha perdido.

## Integração e debug GPRS/HTTP(S) no firmware

No ficheiro `arduino/firmware/casa_3_reles_gsm.ino`, ajuste antes de gravar no Arduino:

1. `APN`, `APN_USER` e `APN_PASS` com os dados da operadora do SIM.
2. `SERVER` com o domínio público do backend (ex: `https://fluxo-smart-control.onrender.com`), **sem barra final**. O firmware avisa alto no Serial se este valor ainda for o exemplo `YOUR-RENDER-APP`.
3. `DEVICE_ID` e `DEVICE_KEY` **iguais** às variáveis configuradas no backend. Se forem diferentes, todas as respostas serão `DENIED` e o backend regista um aviso no arranque a dizer que a chave não coincide.

Abra o Serial Monitor a `9600` baud. O firmware imprime a etapa em que está (`[ETAPA] ...`) e cada comando AT (`[GSM] ...`), para localizar exatamente onde falha:

1. `REDE` — registo GSM/GPRS (`AT+CREG?`/`AT+CGREG?`). Se ficar preso aqui: confirmar SIM ativo, saldo/plano de dados e antena.
2. `GPRS` — abertura do bearer (`AT+SAPBR`). Se abrir a rede mas não o GPRS: confirmar APN e alimentação (o SIM800L pode precisar de picos de até 2A; quebras de tensão durante a transmissão são uma causa comum de instabilidade — considerar um capacitor de pelo menos 1000 µF perto da alimentação do módulo, sem alterar a pinagem).
3. `HTTP(S)` — pedido em si. Um código de erro de transporte (`AT+HTTPACTION` sem resposta, ou código `6xx`) com GPRS ativo é tipicamente **falha de TLS/SNI**: muitos módulos SIM800L não suportam bem o TLS moderno com SNI que serviços como o Render exigem. O firmware já define `AT+SSLOPT=0,0` para relaxar a validação de certificado, o que resolve parte dos casos; se persistir, testar `AT+CGMR` (versão de firmware do módulo, impressa no arranque) e procurar uma atualização, ou isolar o problema apontando temporariamente `SERVER` para um endpoint HTTP simples (sem TLS).

O firmware já recupera sozinho: reinicia o GPRS ao fim de algumas falhas seguidas, reinicia o módulo GSM por completo ao fim de mais falhas, e como último recurso reinicia o próprio Arduino — para não ficar preso indefinidamente num estado com defeito.
