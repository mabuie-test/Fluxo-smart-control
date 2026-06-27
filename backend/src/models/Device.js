const mongoose = require('mongoose');
const { RelayStateSchema } = require('./Relay');
const { LogSchema } = require('./Log');
const { DEFAULT_POWER_WATTS } = require('../utils/energy');

const PowerWattsSchema = new mongoose.Schema({
  r1: { type: Number, default: DEFAULT_POWER_WATTS.r1, min: 0 },
  r2: { type: Number, default: DEFAULT_POWER_WATTS.r2, min: 0 },
  r3: { type: Number, default: DEFAULT_POWER_WATTS.r3, min: 0 }
}, { _id: false });

const UsageSessionSchema = new mongoose.Schema({
  start: { type: String, default: '' },
  end: { type: String, default: '' },
  seconds: { type: Number, default: 0 },
  energyKwh: { type: Number, default: 0 }
}, { _id: false });

const RelayUsageSchema = new mongoose.Schema({
  totalOnSeconds: { type: Number, default: 0 },
  currentOnSince: { type: String, default: '' },
  sessions: { type: [UsageSessionSchema], default: [] }
}, { _id: false });

const UsageByRelaySchema = new mongoose.Schema({
  r1: { type: RelayUsageSchema, default: () => ({}) },
  r2: { type: RelayUsageSchema, default: () => ({}) },
  r3: { type: RelayUsageSchema, default: () => ({}) }
}, { _id: false });

const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, unique: true, index: true, required: true },
  key: { type: String, required: true },
  name: { type: String, default: 'Casa' },
  seq: { type: Number, default: 0 },
  desired: { type: RelayStateSchema, default: () => ({}) },
  actual: { type: RelayStateSchema, default: () => ({}) },
  powerWatts: { type: PowerWattsSchema, default: () => ({}) },
  usage: { type: UsageByRelaySchema, default: () => ({}) },
  rssi: { type: Number, default: null },
  lastSeen: { type: String, default: '' },
  logs: { type: [LogSchema], default: [] }
}, { timestamps: true });
module.exports = mongoose.model('Device', DeviceSchema);
