const Device = require('../models/Device');
const { deviceId, deviceKey, appName } = require('../config/env');
const { addLog } = require('./loggerService');
const { onlineFromLastSeen, syncedState } = require('../utils/state');
const { ensureEnergyFields, buildEnergySummary } = require('./energyService');

async function ensureDevice() {
  let device = await Device.findOne({ deviceId });
  if (!device) {
    device = new Device({
      deviceId,
      key: deviceKey,
      name: appName,
      desired: { r1: false, r2: false, r3: false },
      actual: { r1: false, r2: false, r3: false },
      seq: 0
    });
    ensureEnergyFields(device);
    addLog(device, 'INIT', 'Dispositivo criado automaticamente.');
    await device.save();
    console.log(`[DEVICE] Dispositivo "${deviceId}" criado. Confirma que o firmware usa DEVICE_ID/DEVICE_KEY iguais.`);
  } else if (device.key !== deviceKey) {
    // Causa clássica de "o firmware não chega a lado nenhum": o backend foi
    // reconfigurado (novo DEVICE_KEY no .env) mas o registo antigo na base
    // de dados ficou com a chave anterior, e o firmware continua a usar uma
    // das duas. Isto avisa alto no arranque em vez de falhar em silêncio.
    console.warn('!'.repeat(70));
    console.warn(`[AVISO] DEVICE_KEY no ambiente é diferente da chave gravada para "${deviceId}".`);
    console.warn('        O firmware vai receber DENIED até isto ser corrigido.');
    console.warn('        Ou atualiza a variável DEVICE_KEY, ou apaga o dispositivo na base de dados.');
    console.warn('!'.repeat(70));
  }
  return device;
}

function serializeDevice(device) {
  ensureEnergyFields(device);
  return {
    deviceId: device.deviceId,
    name: device.name,
    seq: device.seq,
    desired: device.desired,
    actual: device.actual,
    synced: syncedState(device),
    online: onlineFromLastSeen(device.lastSeen),
    lastSeen: device.lastSeen,
    rssi: device.rssi,
    energy: buildEnergySummary(device),
    logs: device.logs.slice(0, 20)
  };
}

module.exports = { ensureDevice, onlineFromLastSeen, syncedState, serializeDevice };
