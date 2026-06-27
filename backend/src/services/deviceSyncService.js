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
