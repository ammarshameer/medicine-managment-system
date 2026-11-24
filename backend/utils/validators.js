const { isMobilePhone } = require('validator');

// E.164: leading +, country code 1-9, total 8-15 digits. This covers
// +92300000002 (Pakistan), +14155552671 (USA) and +971501234567 (UAE).
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * E.164-aware phone validator.
 * Valid international numbers are accepted regardless of which locale
 * validator.js happens to support; previously accepted national formats keep
 * working through the 'any' locale fallback.
 */
function isValidPhone(value) {
  if (typeof value !== 'string') return false;
  const phone = value.trim();
  if (!phone) return false;
  if (E164_REGEX.test(phone)) return true;
  return isMobilePhone(phone, 'any', { strictMode: false });
}

module.exports = { E164_REGEX, isValidPhone };
