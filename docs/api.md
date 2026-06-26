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
