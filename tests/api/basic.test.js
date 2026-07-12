const test = require('node:test');
const assert = require('node:assert/strict');
const { toBool, relayPayload, isEmail, isStrongEnoughPassword } = require('../../backend/src/utils/validation');
const { buildPullResponse } = require('../../backend/src/services/gsmService');
const { onlineFromLastSeen, syncedState } = require('../../backend/src/utils/state');

test('toBool converts relay query values', () => {
  assert.equal(toBool('1'), true);
  assert.equal(toBool('on'), true);
  assert.equal(toBool('TRUE'), true);
  assert.equal(toBool('0'), false);
});

test('relayPayload normalizes three relays', () => {
  assert.deepEqual(relayPayload({ r1: '1', r2: '0', r3: 'yes' }), { r1: true, r2: false, r3: true });
});

test('auth validators reject malformed credentials', () => {
  assert.equal(isEmail('user@example.com'), true);
  assert.equal(isEmail('bad-email'), false);
  assert.equal(isStrongEnoughPassword('12345678'), true);
  assert.equal(isStrongEnoughPassword('123'), false);
});

test('buildPullResponse returns SIM800 friendly body', () => {
  const body = buildPullResponse({ seq: 2, desired: { r1: true, r2: false, r3: true } });
  assert.match(body, /SEQ=2/);
  assert.match(body, /R1=1/);
  assert.match(body, /R2=0/);
  assert.match(body, /R3=1/);
});

test('device sync helpers detect online and synced states', () => {
  assert.equal(onlineFromLastSeen(new Date().toISOString()), true);
  assert.equal(onlineFromLastSeen(''), false);
  assert.equal(syncedState({ desired: { r1: true, r2: false, r3: true }, actual: { r1: true, r2: false, r3: true } }), true);
  assert.equal(syncedState({ desired: { r1: true, r2: false, r3: true }, actual: { r1: false, r2: false, r3: true } }), false);
});

const { kwhFromRuntime, updateRelayRuntime, buildEnergySummary } = require('../../backend/src/services/energyService');

test('energy helpers calculate kWh from runtime and power', () => {
  assert.equal(kwhFromRuntime(3600, 1000), 1);
  assert.equal(kwhFromRuntime(1800, 100), 0.05);
});

test('runtime tracking logs on and off transitions', () => {
  const started = new Date('2026-01-01T00:00:00.000Z');
  const stopped = new Date('2026-01-01T00:10:00.000Z');
  const device = {
    actual: { r1: false, r2: false, r3: false },
    onSince: { r1: '', r2: '', r3: '' },
    runtimeSeconds: { r1: 0, r2: 0, r3: 0 }
  };

  assert.deepEqual(updateRelayRuntime(device, { r1: true, r2: false, r3: false }, started), [{ relay: 'r1', type: 'ON', seconds: 0 }]);
  device.actual.r1 = true;
  assert.deepEqual(updateRelayRuntime(device, { r1: false, r2: false, r3: false }, stopped), [{ relay: 'r1', type: 'OFF', seconds: 600 }]);
  assert.equal(device.runtimeSeconds.r1, 600);
});

test('energy summary includes active elapsed time and total kWh', () => {
  const device = {
    actual: { r1: true, r2: false, r3: false },
    onSince: { r1: '2026-01-01T00:00:00.000Z', r2: '', r3: '' },
    runtimeSeconds: { r1: 0, r2: 0, r3: 0 },
    relayMeta: { r1: { label: 'Bomba', powerWatts: 1000 } },
    rssi: -71,
    rssiUpdatedAt: '2026-01-01T00:00:00.000Z'
  };
  const summary = buildEnergySummary(device, new Date('2026-01-01T01:00:00.000Z'));
  assert.equal(summary.relays[0].runtimeSeconds, 3600);
  assert.equal(summary.relays[0].kwh, 1);
  assert.equal(summary.totalKwh, 1);
  assert.equal(summary.rssi, -71);
});
