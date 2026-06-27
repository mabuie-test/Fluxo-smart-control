const Device = require('../models/Device');
const { serializeDevice, syncedState } = require('../services/deviceSyncService');
const { buildPullResponse } = require('../services/gsmService');
const { addLog } = require('../services/loggerService');
const { relayPayload } = require('../utils/validation');
const { normalizePowerWatts } = require('../utils/energy');
const { trackRelayTransitions, buildEnergySummary } = require('../services/energyService');
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

  const previousActual = device.actual?.toObject ? device.actual.toObject() : { ...device.actual };
  const nextActual = relayPayload(req.query);
  const seenAt = nowIso();
  const transitionEvents = trackRelayTransitions(device, previousActual, nextActual, seenAt);

  device.actual = nextActual;
  device.lastSeen = seenAt;
  if (req.query.rssi !== undefined) {
    const rssi = Number(req.query.rssi);
    if (Number.isFinite(rssi)) device.rssi = rssi;
  }
  addLog(
    device,
    'PUSH',
    `Atual -> R1=${device.actual.r1 ? 1 : 0}, R2=${device.actual.r2 ? 1 : 0}, R3=${device.actual.r3 ? 1 : 0}${device.rssi == null ? '' : `, RSSI=${device.rssi} dBm`}`
  );
  transitionEvents.forEach((detail) => addLog(device, 'USAGE', detail));
  await device.save();

  return res.type('text/plain').send('ACK');
}

async function energy(req, res) {
  const device = await findDeviceOrFail(req, res);
  if (!device) return null;
  return ok(res, buildEnergySummary(device));
}

async function updateEnergy(req, res) {
  const device = await findDeviceOrFail(req, res);
  if (!device) return null;
  device.powerWatts = normalizePowerWatts({ ...device.powerWatts?.toObject?.(), ...device.powerWatts, ...req.body });
  addLog(device, 'POWER', `Potências atualizadas -> R1=${device.powerWatts.r1}W, R2=${device.powerWatts.r2}W, R3=${device.powerWatts.r3}W`);
  await device.save();
  return ok(res, buildEnergySummary(device));
}

module.exports = { state, setDesired, pull, push, energy, updateEnergy };
