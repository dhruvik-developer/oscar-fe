export const MIN_PASSWORD_LENGTH = 8;

/** Mirrors the server's Django password validators, so most mistakes show before submit. */
export function passwordProblems(value) {
  const problems = [];
  if (value.length < MIN_PASSWORD_LENGTH) problems.push(`At least ${MIN_PASSWORD_LENGTH} characters`);
  if (value && /^\d+$/.test(value)) problems.push('Not only numbers');
  return problems;
}

/** True when the key event says Caps Lock is on (false when the browser cannot tell). */
export function capsLockOn(event) {
  return Boolean(event?.getModifierState?.('CapsLock'));
}
