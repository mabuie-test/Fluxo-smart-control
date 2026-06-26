const mongoose = require('mongoose');
const RelayStateSchema = new mongoose.Schema({
  r1: { type: Boolean, default: false },
  r2: { type: Boolean, default: false },
  r3: { type: Boolean, default: false }
}, { _id: false });
module.exports = { RelayStateSchema };
