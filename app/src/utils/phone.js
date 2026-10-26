/**
 * Indian mobile numbers: 10 digits starting 6–9, optionally written with a
 * +91 / 91 / 0 prefix and spaces, dashes or brackets. Mirrors the server's
 * check in apps/core/phone.py so both sides accept and store the same thing.
 */

/** The 10-digit national number, or null when `value` is not a valid mobile. */
export function nationalMobile(value) {
  let digits = String(value ?? '').replace(/[\s\-().]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** Error text for a phone field, or '' when it is empty or valid. */
export function phoneError(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '+91') return '';
  if (/[^\d\s\-().+]/.test(raw)) return 'Phone number can only contain digits.';
  return nationalMobile(raw) ? '' : 'Enter a valid 10-digit mobile number (e.g. +91 98765 43210).';
}

/** `+91 98765 43210` for a valid number, '' for an empty one, else unchanged. */
export function formatPhone(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '+91') return '';
  const national = nationalMobile(raw);
  return national ? `+91 ${national.slice(0, 5)} ${national.slice(5)}` : raw;
}
