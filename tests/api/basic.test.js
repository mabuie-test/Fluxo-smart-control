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
