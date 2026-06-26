const { nowIso } = require('../models/Log');
function addLog(device, action, detail) {
  device.logs.unshift({ ts: nowIso(), action, detail });
  device.logs = device.logs.slice(0, 30);
}
module.exports = { addLog };
