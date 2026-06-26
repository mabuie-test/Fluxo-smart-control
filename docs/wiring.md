# Ligações

- Arduino Nano D2 ← SIM800L TX.
- Arduino Nano D3 → SIM800L RX com divisor 20k + 10k ou level shifter.
- Arduino Nano D8/D9/D10 → IN1/IN2/IN3 do módulo relé.
- Fonte 5V estável → Nano e módulo relé.
- Buck 4.0V/2A → SIM800L.
- Todos os GND em comum.

Na carga AC: fase da rede no COM do relé, NO para a fase da lâmpada e neutro direto para a lâmpada.
