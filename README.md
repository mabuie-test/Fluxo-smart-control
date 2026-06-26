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
3. O Arduino consulta `/pull`, aplica os relés e envia `/push` com o estado real.
4. O painel passa para `LIGADA` ou `DESLIGADA` quando `desired` e `actual` ficam sincronizados.

## Segurança

- Rotas do painel exigem `Authorization: Bearer <token>`.
- Endpoints do firmware usam `DEVICE_KEY` para autenticação do dispositivo.
- Em produção, `JWT_SECRET` deve ser definido e o token de recuperação não é devolvido pela API.
