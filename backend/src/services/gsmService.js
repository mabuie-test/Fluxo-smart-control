function buildPullResponse(device) {
  return ['OK', `SEQ=${device.seq}`, `R1=${device.desired.r1 ? 1 : 0}`, `R2=${device.desired.r2 ? 1 : 0}`, `R3=${device.desired.r3 ? 1 : 0}`].join('\n');
}
module.exports = { buildPullResponse };
