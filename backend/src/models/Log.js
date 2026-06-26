function nowIso() { return new Date().toISOString(); }
const LogSchema = {
  ts: { type: String, default: nowIso },
  action: { type: String, default: '' },
  detail: { type: String, default: '' }
};
module.exports = { LogSchema, nowIso };
