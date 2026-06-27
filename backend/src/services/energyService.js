const { RELAY_IDS, DEFAULT_POWER_WATTS, currentTotalSeconds, formatDuration, relayEnergyKwh, secondsBetween } = require('../utils/energy');

function ensureEnergyFields(device) {
  device.powerWatts = device.powerWatts || {};
  device.usage = device.usage || {};
  RELAY_IDS.forEach((relay) => {
    if (device.powerWatts[relay] == null) device.powerWatts[relay] = DEFAULT_POWER_WATTS[relay];
    if (!device.usage[relay]) device.usage[relay] = { totalOnSeconds: 0, currentOnSince: '', sessions: [] };
    if (!Array.isArray(device.usage[relay].sessions)) device.usage[relay].sessions = [];
  });
}

function trackRelayTransitions(device, previousActual, nextActual, nowIso) {
  ensureEnergyFields(device);
  const events = [];
  RELAY_IDS.forEach((relay) => {
    const wasOn = Boolean(previousActual?.[relay]);
    const isOn = Boolean(nextActual?.[relay]);
    const usage = device.usage[relay];

    if (!wasOn && isOn && !usage.currentOnSince) {
      usage.currentOnSince = nowIso;
      events.push(`${relay.toUpperCase()} ligada`);
    }

    if (wasOn && !isOn && usage.currentOnSince) {
      const seconds = secondsBetween(usage.currentOnSince, nowIso);
      const energyKwh = (Number(device.powerWatts[relay] || 0) * seconds) / 3600000;
      usage.totalOnSeconds = Number(usage.totalOnSeconds || 0) + seconds;
      usage.sessions.unshift({ start: usage.currentOnSince, end: nowIso, seconds, energyKwh });
      usage.sessions = usage.sessions.slice(0, 20);
      events.push(`${relay.toUpperCase()} esteve ligada por ${formatDuration(seconds)} (${energyKwh.toFixed(4)} kWh)`);
      usage.currentOnSince = '';
    }
  });
  return events;
}

function buildEnergySummary(device, nowIso = new Date().toISOString()) {
  ensureEnergyFields(device);
  const relays = RELAY_IDS.map((relay) => {
    const usage = device.usage[relay];
    const seconds = currentTotalSeconds(usage, nowIso);
    return {
      relay,
      powerWatts: Number(device.powerWatts[relay] || 0),
      totalOnSeconds: seconds,
      currentOnSince: usage.currentOnSince || '',
      currentOnDurationSeconds: usage.currentOnSince ? secondsBetween(usage.currentOnSince, nowIso) : 0,
      durationLabel: formatDuration(seconds),
      energyKwh: Number(relayEnergyKwh(device.powerWatts[relay], usage, nowIso).toFixed(6)),
      sessions: (usage.sessions || []).slice(0, 10).map((session) => ({
        start: session.start,
        end: session.end,
        seconds: session.seconds,
        durationLabel: formatDuration(session.seconds),
        energyKwh: Number(Number(session.energyKwh || 0).toFixed(6))
      }))
    };
  });
  return {
    rssi: device.rssi,
    lastSeen: device.lastSeen,
    powerWatts: device.powerWatts,
    relays,
    totalEnergyKwh: Number(relays.reduce((sum, item) => sum + item.energyKwh, 0).toFixed(6))
  };
}

module.exports = { ensureEnergyFields, trackRelayTransitions, buildEnergySummary };
