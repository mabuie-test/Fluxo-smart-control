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

Estes endpoints usam `DEVICE_KEY` e retornam texto simples para facilitar o parsing no Arduino.

- `GET /api/device/:deviceId/pull?key=<DEVICE_KEY>&seq=<seq>` retorna `NONE`, `DENIED` ou corpo `OK\nSEQ=...\nR1=...`.
- `GET /api/device/:deviceId/push?key=<DEVICE_KEY>&r1=1&r2=0&r3=1` retorna `ACK` quando o estado real é gravado.

### Integração e debug GPRS/HTTP(S) no firmware

No ficheiro `arduino/firmware/casa_3_reles_gsm.ino`, ajuste antes de gravar no Arduino:

1. `APN`, `APN_USER` e `APN_PASS` com os dados da operadora do SIM. Muitas operadoras usam utilizador/senha vazios.
2. `SERVER` com o domínio público do backend, por exemplo `https://fluxo-smart-control.onrender.com`, sem barra final. O firmware ativa `AT+HTTPSSL=1` apenas quando o endereço começa por `https://`; para diagnóstico com endpoint controlado em HTTP, usa `AT+HTTPSSL=0`.
3. `DEVICE_ID` e `DEVICE_KEY` iguais às variáveis configuradas no backend/deploy.
4. Abra o Serial Monitor a `9600` baud para ver as linhas `[GSM]`, que mostram cada comando AT enviado e a resposta do SIM800L.

Fluxo esperado no Serial Monitor:

1. `AT` responde `OK`.
2. `AT+CPIN?` deve indicar SIM pronto.
3. `AT+CREG?` ou `AT+CGREG?` deve retornar estado `,1` (rede local) ou `,5` (roaming). O firmware aguarda até 90 segundos por esse registo.
4. `AT+SAPBR=1,1` abre o bearer GPRS e `AT+SAPBR=2,1` deve mostrar um IP diferente de `0.0.0.0`.
5. `AT+HTTPINIT`, `AT+HTTPPARA="CID",1` e `AT+HTTPSSL=1` ou `AT+HTTPSSL=0` são executados antes de cada pedido, conforme o protocolo configurado em `SERVER`.
6. O primeiro `PUSH RESP` deve retornar `ACK`; depois o ciclo `PULL RESP` deve retornar `NONE` ou `OK\nSEQ=...` quando houver comando pendente.

Se o registo de rede funcionar mas o GPRS não abrir, confirme APN, saldo/plano de dados, antena e alimentação do SIM800L com pico de 2A. Se o GPRS abrir mas `PUSH RESP`/`PULL RESP` vier vazio, confirme se o módulo/firmware da sua placa aceita o TLS usado pelo domínio HTTPS; para isolar problema de TLS, teste temporariamente um endpoint HTTP controlado. O firmware já volta a tentar inicializar o GSM no loop quando a preparação HTTP(S) falha, evitando ficar permanentemente offline após uma falha de arranque.
