function onlineFromLastSeen(lastSeen) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 30000;
}

function syncedState(device) {
  return ['r1', 'r2', 'r3'].every((relay) => device.desired[relay] === device.actual[relay]);
}

module.exports = { onlineFromLastSeen, syncedState };
