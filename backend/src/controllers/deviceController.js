const Device = require('../models/Device');
const { serializeDevice, syncedState } = require('../services/deviceSyncService');
const { buildPullResponse } = require('../services/gsmService');
const { addLog } = require('../services/loggerService');
const { relayPayload } = require('../utils/validation');
const { ok, fail } = require('../utils/response');
const { nowIso } = require('../models/Log');
const { RELAYS } = require('../utils/constants');
const { buildEnergySummary, updateRelayRuntime } = require('../services/energyService');

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

  const nextActual = relayPayload(req.query);
  const now = new Date();
  const runtimeEvents = updateRelayRuntime(device, nextActual, now);
  runtimeEvents.forEach((event) => {
    addLog(
      device,
      event.type === 'ON' ? 'CARGA_LIGADA' : 'CARGA_DESLIGADA',
      event.type === 'ON' ? `${event.relay.toUpperCase()} começou a contar tempo ligado.` : `${event.relay.toUpperCase()} ficou ligada por ${event.seconds} segundos.`
    );
  });
  device.actual = nextActual;
  device.lastSeen = now.toISOString();

  if (req.query.rssi !== undefined && req.query.rssi !== '') {
    device.rssi = Number(req.query.rssi);
    device.rssiUpdatedAt = device.lastSeen;
  }

  addLog(
    device,
    'PUSH',
    `Atual -> R1=${device.actual.r1 ? 1 : 0}, R2=${device.actual.r2 ? 1 : 0}, R3=${device.actual.r3 ? 1 : 0}${device.rssi === null || Number.isNaN(device.rssi) ? '' : `, RSSI=${device.rssi} dBm`}`
  );
  await device.save();

  return res.type('text/plain').send('ACK');
}

async function metrics(req, res) {
  const device = await findDeviceOrFail(req, res);
  if (!device) return null;
  return ok(res, buildEnergySummary(device));
}

async function updateMetrics(req, res) {
  const device = await findDeviceOrFail(req, res);
  if (!device) return null;

  const nextMeta = device.relayMeta || {};
  RELAYS.forEach((relay) => {
    const input = req.body?.[relay] || {};
    nextMeta[relay] = {
      label: String(input.label || nextMeta[relay]?.label || relay).slice(0, 40),
      powerWatts: Math.max(0, Number(input.powerWatts ?? nextMeta[relay]?.powerWatts ?? 0))
    };
  });
  device.relayMeta = nextMeta;
  addLog(device, 'ENERGIA', 'Dados de potência/nomes das cargas atualizados.');
  await device.save();
  return ok(res, buildEnergySummary(device));
}

module.exports = { state, setDesired, pull, push, metrics, updateMetrics };
