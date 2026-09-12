# Fluxo Smart Control

Sistema v1 de automação residencial para 3 saídas de relé com firmware Arduino Nano + SIM800L, backend Node.js/MongoDB e painel web com autenticação.

## Módulos

- `backend/`: API Express, autenticação JWT, criação de conta, recuperação de senha, MongoDB e painel web.
- `arduino/firmware/`: firmware GSM/GPRS para consultar comandos e confirmar estado real.
- `docs/`: arquitetura, API e ligações elétricas.
- `deploy/`: configuração Render e notas para MongoDB Atlas.
- `tests/`: testes unitários dos utilitários e serviços puros.

## Execução local

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Configure `MONGODB_URI`, `JWT_SECRET`, `DEVICE_ID` e `DEVICE_KEY` antes do deploy.

## Testes e validações

```bash
cd backend
npm test
npm run check
```

## Fluxo de estado

1. O utilizador altera o estado desejado no painel.
2. O backend grava `desired`, incrementa `seq` e mostra o card como `PENDENTE` enquanto `desired` for diferente de `actual`.
3. O Arduino chama `/api/device/:id/sync` periodicamente: nesse único pedido reporta o estado real dos relés e recebe o estado desejado atual (ver `docs/api.md`).
4. O painel passa para `LIGADA` ou `DESLIGADA` quando `desired` e `actual` ficam sincronizados.

## Resolução de problemas de integração (firmware ↔ backend)

Se o SIM800L parece "ligado" mas nenhum evento chega ao backend (ou vice-versa), verificar por esta ordem:

1. **`SERVER` no firmware** — tem de ser a URL real do backend implantado, sem barra final. O firmware avisa alto no Serial Monitor se ainda estiver com o valor de exemplo.
2. **`DEVICE_ID`/`DEVICE_KEY` iguais** entre o firmware (`arduino/firmware/casa_3_reles_gsm.ino`) e o backend (variáveis de ambiente). Uma diferença faz o backend responder sempre `DENIED` — e o backend agora regista um aviso no arranque quando deteta essa incoerência.
3. **`GET /api/device/:id/ping`** — testar isto primeiro (não precisa de `key`); confirma se o backend está mesmo alcançável a partir da rede do SIM800L antes de testar autenticação.
4. **Etapas no Serial Monitor** — o firmware v2 imprime `[ETAPA] REDE`, `[ETAPA] GPRS` e `[ETAPA] HTTP(S)` para se ver exatamente onde a ligação está a falhar (ver detalhe em `docs/api.md`).
5. **TLS/SNI** — se a rede e o GPRS ficam bons mas o HTTPS falha, é normalmente incompatibilidade do stack TLS do SIM800L com o SNI exigido por plataformas como o Render. O firmware já relaxa a validação de certificado (`AT+SSLOPT=0,0`); persistindo o problema, ver a nota sobre atualização de firmware do módulo em `docs/api.md`.
6. **Alimentação** — picos de corrente do SIM800L durante a transmissão podem causar quebras/reinícios (LED de rede a piscar sem parar). Ver `docs/wiring.md`.

## Segurança

- Rotas do painel exigem `Authorization: Bearer <token>`.
- Endpoints do firmware usam `DEVICE_KEY` para autenticação do dispositivo.
- Em produção, `JWT_SECRET` deve ser definido e o token de recuperação não é devolvido pela API.
