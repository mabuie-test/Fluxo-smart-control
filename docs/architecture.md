# Arquitetura

O painel web grava o estado desejado no backend. O Arduino Nano com SIM800L faz `pull` periódico via GPRS, aplica os relés e envia `push` com o estado real. O painel mostra `PENDENTE` quando `desired` e `actual` são diferentes.
