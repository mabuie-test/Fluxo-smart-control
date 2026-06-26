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
  logs: { type: [LogSchema], default: [] }
}, { timestamps: true });
module.exports = mongoose.model('Device', DeviceSchema);
