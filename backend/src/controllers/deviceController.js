const Device = require('../models/Device');
const { serializeDevice, syncedState } = require('../services/deviceSyncService');
const { buildPullResponse } = require('../services/gsmService');
const { addLog } = require('../services/loggerService');
const { relayPayload } = require('../utils/validation');
const { ok, fail } = require('../utils/response');
const { nowIso } = require('../models/Log');

async function findDeviceOrFail(req, res) {
  const device = await Device.findOne({ deviceId: req.params.deviceId });
  if (!device) fail(res, 404, 'Dispositivo não encontrado');
  return device;
}

async function state(req, res) {
  const device = await findDeviceOrFail(req, res);
  if (!device) return null;
  return ok(res, serializeDevice(device));
}

async function setDesired(req, res) {
  const device = await findDeviceOrFail(req, res);
  if (!device) return null;

  device.desired = relayPayload({ ...req.query, ...req.body });
  device.seq += 1;
  addLog(
    device,
    'SET',
    `Desejado -> R1=${device.desired.r1 ? 1 : 0}, R2=${device.desired.r2 ? 1 : 0}, R3=${device.desired.r3 ? 1 : 0}`
  );
  await device.save();

  return ok(res, serializeDevice(device));
}

async function pull(req, res) {
  const device = await Device.findOne({ deviceId: req.params.deviceId, key: req.query.key });
  if (!device) return res.status(403).type('text/plain').send('DENIED');

  const changed = Number(req.query.seq || 0) < device.seq || !syncedState(device);
  return res.type('text/plain').send(changed ? buildPullResponse(device) : 'NONE');
}

async function push(req, res) {
  const device = await Device.findOne({ deviceId: req.params.deviceId, key: req.query.key });
  if (!device) return res.status(403).type('text/plain').send('DENIED');

  device.actual = relayPayload(req.query);
  device.lastSeen = nowIso();
  addLog(
    device,
    'PUSH',
    `Atual -> R1=${device.actual.r1 ? 1 : 0}, R2=${device.actual.r2 ? 1 : 0}, R3=${device.actual.r3 ? 1 : 0}`
  );
  await device.save();

  return res.type('text/plain').send('ACK');
}

module.exports = { state, setDesired, pull, push };
