# Ligações

- Arduino Nano D2 ← SIM800L TX.
- Arduino Nano D3 → SIM800L RX com divisor 20k + 10k ou level shifter.
- Arduino Nano D8/D9/D10 → IN1/IN2/IN3 do módulo relé.
- Fonte 5V estável → Nano e módulo relé.
- Buck 4.0V/2A → SIM800L.
- Todos os GND em comum.

Na carga AC: fase da rede no COM do relé, NO para a fase da lâmpada e neutro direto para a lâmpada.

## Nota sobre estabilidade (sem alterar a pinagem acima)

O SIM800L pode puxar picos de corrente até ~2A durante a transmissão. Se a alimentação não aguentar esse pico, o módulo reinicia ou perde o registo de rede (visível como o LED de rede a piscar rapidamente sem parar). Isto não é um problema de pinagem, mas de componentes de suporte — considerar:

- Um capacitor eletrolítico de pelo menos 1000 µF (idealmente com um cerâmico de 100 nF em paralelo) o mais próximo possível dos pinos VCC/GND do SIM800L.
- Confirmar que o buck 4.0V/2A referido acima consegue mesmo entregar 2A em pico, não só em regime contínuo.
