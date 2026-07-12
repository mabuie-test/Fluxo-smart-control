const mongoose = require('mongoose');
const { RelayStateSchema } = require('./Relay');
const { LogSchema } = require('./Log');
const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, unique: true, index: true, required: true },
  key: { type: String, required: true },
  name: { type: String, default: 'Casa' },
  seq: { type: Number, default: 0 },
  desired: { type: RelayStateSchema, default: () => ({}) },
  actual: { type: RelayStateSchema, default: () => ({}) },
  lastSeen: { type: String, default: '' },
  rssi: { type: Number, default: null },
  rssiUpdatedAt: { type: String, default: '' },
  onSince: { type: new mongoose.Schema({ r1: { type: String, default: '' }, r2: { type: String, default: '' }, r3: { type: String, default: '' } }, { _id: false }), default: () => ({}) },
  runtimeSeconds: { type: new mongoose.Schema({ r1: { type: Number, default: 0 }, r2: { type: Number, default: 0 }, r3: { type: Number, default: 0 } }, { _id: false }), default: () => ({}) },
  relayMeta: { type: new mongoose.Schema({
    r1: { label: { type: String, default: 'Sala' }, powerWatts: { type: Number, default: 60 } },
    r2: { label: { type: String, default: 'Quarto' }, powerWatts: { type: Number, default: 60 } },
    r3: { label: { type: String, default: 'Cozinha' }, powerWatts: { type: Number, default: 60 } }
  }, { _id: false }), default: () => ({}) },
  logs: { type: [LogSchema], default: [] }
}, { timestamps: true });
module.exports = mongoose.model('Device', DeviceSchema);
