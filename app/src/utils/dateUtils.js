// ── Evenmore ERP Universal Date Formatter ──────────────────────────────
export function formatDateDDMMYYYY(input) {
  if (!input) return '';
  
  if (input === 'Today' || input === 'today') {
    return getCurrentDateFormatted();
  }

  // Relative expressions like 'In 10 days', '30 Days from now', '2 months ago'
  if (/^(In\s+)?\d+\s*(day|month|week|year)s?\s*(from now|ago)?$/i.test(input)) {
    const iso = toISODate(input);
    return iso ? toDisplayDate(iso) : String(input);
  }

  // If already in DD-MM-YYYY format (e.g. 10-09-2026)
  if (/^\d{2}-\d{2}-\d{4}$/.test(input)) {
    return input;
  }

  // If in YYYY-MM-DD format (e.g. 2026-09-10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-');
    return `${d}-${m}-${y}`;
  }

  // If string contains natural format like "Sep 10, 2026", "Oct 18, 2026"
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return String(input);
}

export function getCurrentDateFormatted() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// ── ISO (YYYY-MM-DD) date helpers for sorting, aging & overdue logic ────

/** Convert today to ISO YYYY-MM-DD (for <input type="date"> values). */
export function getCurrentISODate() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

/** Return ISO date offset by `days` from `isoInput` (default today). */
export function addDaysISO(isoInput, days) {
  const base = toISODate(isoInput) || getCurrentISODate();
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Normalize any known date representation into ISO YYYY-MM-DD.
 * Handles: 'Today', ISO, DD-MM-YYYY, 'DD months ago', 'N Days from now',
 * natural strings like 'Sep 10, 2026' and Date objects.
 * Returns '' when unparseable.
 */
export function toISODate(input) {
  if (!input) return '';
  if (input instanceof Date && !isNaN(input.getTime())) {
    const day = String(input.getDate()).padStart(2, '0');
    const month = String(input.getMonth() + 1).padStart(2, '0');
    return `${input.getFullYear()}-${month}-${day}`;
  }
  const str = String(input).trim();
  if (!str) return '';
  if (str === 'Today' || str === 'today' || str === 'Today\'s date') return getCurrentISODate();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // DD-MM-YYYY (and DD/MM/YYYY)
  const ddmmyyyy = str.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m}-${d}`;
  }

  // Relative expressions: 'In 10 days', '30 Days from now', 'In 30 days', '10 days ago', '2 months ago'
  const rel = str.match(/^(?:In\s+)?(\d+)\s*(day|month|week|year)s?\s*(?:from now)?$/i) ||
              str.match(/^(\d+)\s*(day|month|week|year)s?\s*ago$/i);
  if (rel) {
    const [, num, unit, suffix] = rel;
    const n = parseInt(num, 10);
    const now = new Date();
    if (suffix === 'ago') now.setDate(now.getDate() - n);
    else if (unit.toLowerCase() === 'month') now.setMonth(now.getMonth() + n);
    else if (unit.toLowerCase() === 'year') now.setFullYear(now.getFullYear() + n);
    else if (unit.toLowerCase() === 'week') now.setDate(now.getDate() + (n * 7));
    else now.setDate(now.getDate() + n);
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  // Natural format: 'Sep 10, 2026', 'Oct 24, 2026'
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    return `${parsed.getFullYear()}-${month}-${day}`;
  }
  return '';
}

/** Convert an ISO (or any) date into DD-MM-YYYY for display. */
export function toDisplayDate(input) {
  const iso = toISODate(input);
  if (!iso) return String(input || '');
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

/** Whole days between two dates (b - a). Uses ISO strings; safe for aging buckets. */
export function daysBetween(a, b) {
  const aIso = toISODate(a);
  const bIso = toISODate(b);
  if (!aIso || !bIso) return null;
  const msA = new Date(`${aIso}T00:00:00`).getTime();
  const msB = new Date(`${bIso}T00:00:00`).getTime();
  return Math.round((msB - msA) / 86400000);
}
