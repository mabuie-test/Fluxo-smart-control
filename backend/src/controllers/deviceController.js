const Device = require('../models/Device');
const { serializeDevice, syncedState } = require('../services/deviceSyncService');
const { buildSyncResponse } = require('../services/gsmService');
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

// Ponto único de contacto com o firmware: o dispositivo reporta o estado
// real (se enviar r1/r2/r3) e recebe, na mesma resposta, o estado desejado
// atual. Isto reduz a duas metades de round-trip (antes eram pull + push
// separados) o número de pedidos HTTP feitos pelo SIM800L, que é o elo mais
// lento e instável da cadeia.
async function sync(req, res) {
  const params = { ...req.query, ...req.body };
  const device = await Device.findOne({ deviceId: req.params.deviceId, key: params.key });
  if (!device) {
    console.warn(
      `[DEVICE] Pedido de sync recusado — deviceId="${req.params.deviceId}" key="${params.key || ''}" não corresponde a nenhum dispositivo registado. Confirma DEVICE_ID/DEVICE_KEY no firmware.`
    );
    return res.status(403).type('text/plain').send('DENIED');
  }

  const reportedState = params.r1 !== undefined || params.r2 !== undefined || params.r3 !== undefined;
  if (reportedState) {
    const previousActual = device.actual?.toObject ? device.actual.toObject() : { ...device.actual };
    const nextActual = relayPayload(params);
    const seenAt = nowIso();
    const transitionEvents = trackRelayTransitions(device, previousActual, nextActual, seenAt);

    device.actual = nextActual;
    device.lastSeen = seenAt;
    if (params.rssi !== undefined) {
      const rssi = Number(params.rssi);
      if (Number.isFinite(rssi)) device.rssi = rssi;
    }
    addLog(
      device,
      'SYNC',
      `Atual -> R1=${device.actual.r1 ? 1 : 0}, R2=${device.actual.r2 ? 1 : 0}, R3=${device.actual.r3 ? 1 : 0}${device.rssi == null ? '' : `, RSSI=${device.rssi} dBm`}`
    );
    transitionEvents.forEach((detail) => addLog(device, 'USAGE', detail));
  } else {
    addLog(device, 'SYNC', 'Dispositivo consultou o servidor sem reportar estado real.');
  }

  const seqFromDevice = Number(params.seq || 0);
  const changed = seqFromDevice < device.seq || !syncedState(device);
  await device.save();

  return res.type('text/plain').send(buildSyncResponse(device, changed));
}

// Endpoint sem autenticação, só para confirmar que o backend está acessível
// a partir do SIM800L antes de testar o fluxo completo com chave/deviceId.
async function ping(req, res) {
  return res.type('text/plain').send('PONG');
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

module.exports = { state, setDesired, sync, ping, energy, updateEnergy };
