const Device = require('../models/Device');
const { ok, fail } = require('../utils/response');

async function logs(req, res) {
  const device = await Device.findOne({ deviceId: req.params.deviceId });
  if (!device) return fail(res, 404, 'Dispositivo não encontrado');
  return ok(res, device.logs.slice(0, 20));
}

module.exports = { logs };
