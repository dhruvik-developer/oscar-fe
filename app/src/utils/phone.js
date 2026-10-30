/**
 * 10-digit Phone / Mobile Number Validation & Formatting Utilities
 * Strictly enforces 10 numeric digits (0-9) and prevents entering more than 10 digits.
 */

/** Strips non-digits and truncates to at most 10 digits */
export function clean10Digits(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 10);
}

/** Check if value has exactly 10 numeric digits */
export function is10Digits(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 10;
}

/** The 10-digit national number, or null when `value` is not a valid 10-digit number. */
export function nationalMobile(value) {
  let digits = String(value ?? '').replace(/[\s\-().+]/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  return /^\d{10}$/.test(digits) ? digits : null;
}

/** Error text for a phone field, or '' when it is empty or valid. */
export function phoneError(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '+91') return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length !== 10) return 'Must be exactly 10 numbers.';
  return '';
}

/** Format as clean 10 digits */
export function formatPhone(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  return digits;
}
