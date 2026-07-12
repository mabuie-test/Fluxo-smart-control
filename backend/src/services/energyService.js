const { RELAYS } = require('../utils/constants');

const DEFAULT_RELAY_META = {
  r1: { label: 'Sala', powerWatts: 60 },
  r2: { label: 'Quarto', powerWatts: 60 },
  r3: { label: 'Cozinha', powerWatts: 60 }
};

function relayMetaFromDevice(device) {
  const meta = device.relayMeta || {};
  return RELAYS.reduce((acc, relay) => {
    acc[relay] = {
      label: meta[relay]?.label || DEFAULT_RELAY_META[relay].label,
      powerWatts: Number(meta[relay]?.powerWatts ?? DEFAULT_RELAY_META[relay].powerWatts)
    };
    return acc;
  }, {});
}

function runtimeSeconds(device, relay, at = new Date()) {
  const base = Number(device.runtimeSeconds?.[relay] || 0);
  const since = device.onSince?.[relay];
  if (!device.actual?.[relay] || !since) return base;
  const elapsed = Math.max(0, Math.floor((at.getTime() - new Date(since).getTime()) / 1000));
  return base + elapsed;
}

function kwhFromRuntime(seconds, watts) {
  return (Number(seconds || 0) * Number(watts || 0)) / 3600000;
}

function buildEnergySummary(device, at = new Date()) {
  const meta = relayMetaFromDevice(device);
  const relays = RELAYS.map((relay) => {
    const seconds = runtimeSeconds(device, relay, at);
    const powerWatts = meta[relay].powerWatts;
    return {
      relay,
      label: meta[relay].label,
      powerWatts,
      runtimeSeconds: seconds,
      kwh: kwhFromRuntime(seconds, powerWatts),
      currentlyOn: Boolean(device.actual?.[relay]),
      onSince: device.onSince?.[relay] || ''
    };
  });

  return {
    rssi: device.rssi ?? null,
    rssiUpdatedAt: device.rssiUpdatedAt || '',
    relays,
    totalKwh: relays.reduce((sum, item) => sum + item.kwh, 0)
  };
}

function updateRelayRuntime(device, nextActual, at = new Date()) {
  const events = [];
  RELAYS.forEach((relay) => {
    const wasOn = Boolean(device.actual?.[relay]);
    const willBeOn = Boolean(nextActual[relay]);
    const since = device.onSince?.[relay];

    if (!wasOn && willBeOn) {
      device.onSince[relay] = at.toISOString();
      events.push({ relay, type: 'ON', seconds: 0 });
    } else if (wasOn && !willBeOn && since) {
      const elapsed = Math.max(0, Math.floor((at.getTime() - new Date(since).getTime()) / 1000));
      device.runtimeSeconds[relay] = Number(device.runtimeSeconds?.[relay] || 0) + elapsed;
      device.onSince[relay] = '';
      events.push({ relay, type: 'OFF', seconds: elapsed });
    }
  });
  return events;
}

module.exports = { DEFAULT_RELAY_META, relayMetaFromDevice, runtimeSeconds, kwhFromRuntime, buildEnergySummary, updateRelayRuntime };
