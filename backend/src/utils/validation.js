function toBool(value) {
  return ['1', 'true', 'on', 'yes'].includes(String(value).trim().toLowerCase());
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function requireFields(body, fields) {
  return fields.filter((field) => !hasValue(body[field]));
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isStrongEnoughPassword(value) {
  return String(value || '').length >= 8;
}

function relayPayload(source = {}) {
  return {
    r1: toBool(source.r1),
    r2: toBool(source.r2),
    r3: toBool(source.r3)
  };
}

module.exports = {
  toBool,
  hasValue,
  requireFields,
  isEmail,
  isStrongEnoughPassword,
  relayPayload
};
