// Respostas em texto simples, otimizadas para serem fáceis de parsear no
// Arduino (uma etiqueta por linha, sem JSON).

function buildSyncResponse(device, changed) {
  return [
    changed ? 'OK' : 'NONE',
    `SEQ=${device.seq}`,
    `R1=${device.desired.r1 ? 1 : 0}`,
    `R2=${device.desired.r2 ? 1 : 0}`,
    `R3=${device.desired.r3 ? 1 : 0}`
  ].join('\n');
}

module.exports = { buildSyncResponse };
