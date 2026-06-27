const RELAY_IDS = ['r1', 'r2', 'r3'];
const DEFAULT_POWER_WATTS = { r1: 60, r2: 60, r3: 60 };

function emptyUsage() {
  return { r1: { totalOnSeconds: 0, currentOnSince: '', sessions: [] }, r2: { totalOnSeconds: 0, currentOnSince: '', sessions: [] }, r3: { totalOnSeconds: 0, currentOnSince: '', sessions: [] } };
}

function normalizePowerWatts(input = {}) {
  return RELAY_IDS.reduce((acc, relay) => {
    const value = Number(input[relay]);
    acc[relay] = Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : DEFAULT_POWER_WATTS[relay];
    return acc;
  }, {});
}

function secondsBetween(startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 1000);
}

function formatDuration(totalSeconds = 0) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function currentTotalSeconds(usage = {}, nowIso = new Date().toISOString()) {
  const base = Number(usage.totalOnSeconds || 0);
  return base + (usage.currentOnSince ? secondsBetween(usage.currentOnSince, nowIso) : 0);
}

function relayEnergyKwh(powerWatts = 0, usage = {}, nowIso = new Date().toISOString()) {
  return (Number(powerWatts || 0) * currentTotalSeconds(usage, nowIso)) / 3600000;
}

module.exports = { RELAY_IDS, DEFAULT_POWER_WATTS, emptyUsage, normalizePowerWatts, secondsBetween, formatDuration, currentTotalSeconds, relayEnergyKwh };
