/**
 * Unit-of-measure helpers — the frontend twin of `apps/masters/uom.py`.
 *
 * Items and document lines store the unit as text ("Mtr", "Meter"), so these
 * helpers resolve that text against the UOM master and apply the same
 * conversion rules the backend enforces:
 *   - same unit → quantity preserved
 *   - Length / Weight / Area / Volume convert within their own type
 *   - Roll, Piece and Other never convert (a taka has no fixed length)
 *   - different types never convert (metres are never turned into kg)
 */

const CONVERTIBLE_TYPES = new Set(['Length', 'Weight', 'Area', 'Volume']);

// Common spellings of the same unit — must match ALIASES in apps/masters/uom.py.
const ALIASES = {
  m: 'meter', mtr: 'meter', mtrs: 'meter', meter: 'meter', meters: 'meter', metre: 'meter', metres: 'meter',
  cm: 'centimeter', centimeter: 'centimeter', centimetre: 'centimeter',
  yd: 'yard', yds: 'yard', yard: 'yard', yards: 'yard',
  kg: 'kilogram', kgs: 'kilogram', kilogram: 'kilogram', kilograms: 'kilogram',
  g: 'gram', gm: 'gram', gms: 'gram', gram: 'gram', grams: 'gram',
  pc: 'piece', pcs: 'piece', piece: 'piece', pieces: 'piece',
  nos: 'number', no: 'number', number: 'number',
  roll: 'roll', rolls: 'roll',
  taka: 'taka', takas: 'taka',
};

export const unitKey = (text) => {
  const cleaned = String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIASES[cleaned] || cleaned;
};

/** "Mtr" and "Meter" name the same unit. */
export const sameUnitText = (a, b) => Boolean(a) && Boolean(b) && unitKey(a) === unitKey(b);

/** The UOM-master row a piece of unit text refers to, or null. */
export function resolveUnit(units, text) {
  if (!text || !Array.isArray(units)) return null;
  const key = unitKey(text);
  return units.find((u) => unitKey(u.code) === key || unitKey(u.label || u.name) === key) || null;
}

export function compatibleUnits(a, b) {
  if (!a || !b) return false;
  if (a.id === b.id) return true;
  return a.uomType === b.uomType && CONVERTIBLE_TYPES.has(a.uomType);
}

/**
 * The units a line for an item stocked in `stockUom` may use: the stock unit
 * itself plus active units it converts to. With no master match, only the
 * item's own unit is offered.
 */
export function unitsCompatibleWith(units, stockUom) {
  const active = (units || []).filter((u) => u.isActive !== false);
  const stock = resolveUnit(units, stockUom);
  if (!stock) return active.filter((u) => sameUnitText(u.code, stockUom));
  return active.filter((u) => compatibleUnits(u, stock));
}

/** Stock units per one `lineUom` for an item stocked in `stockUom` (null = not convertible). */
export function factorToStock(units, lineUom, stockUom) {
  if (!lineUom || !stockUom || sameUnitText(lineUom, stockUom)) return 1;
  const a = resolveUnit(units, lineUom);
  const b = resolveUnit(units, stockUom);
  if (a && b && a.id === b.id) return 1;
  if (!compatibleUnits(a, b)) return null;
  return Number(a.conversionFactor || 1) / Number(b.conversionFactor || 1);
}

/** Decimal places configured for a unit (defaults to 2). */
export function unitDecimals(units, text) {
  const unit = resolveUnit(units, text);
  const places = Number(unit?.decimalPlaces);
  return Number.isInteger(places) && places >= 0 ? places : 2;
}

/**
 * Quantity and unit together: `formatQty(1250.5, 'Mtr')` → "1,250.50 Mtr".
 * Pass `units` to use the unit's configured decimal places.
 */
export function formatQty(qty, uom, { units, decimals } = {}) {
  if (qty === null || qty === undefined || qty === '') return '—';
  const n = Number(qty);
  if (!Number.isFinite(n)) return '—';
  const places = decimals ?? (units ? unitDecimals(units, uom) : 2);
  const text = n.toLocaleString('en-IN', { minimumFractionDigits: places, maximumFractionDigits: places });
  return uom ? `${text} ${uom}` : text;
}

/**
 * Sum `rows` per unit — quantities in different units are never added
 * together. Returns `[{ uom, qty }]`, one entry per real unit.
 */
export function sumByUnit(rows, { qty = (r) => r.qty, uom = (r) => r.uom, units } = {}) {
  const totals = new Map();
  for (const row of rows || []) {
    const text = uom(row) || '';
    const unit = resolveUnit(units, text);
    const key = unit ? `id:${unit.id}` : `t:${unitKey(text)}`;
    const label = unit ? unit.code : text;
    const entry = totals.get(key) || { uom: label, qty: 0 };
    entry.qty += Number(qty(row)) || 0;
    totals.set(key, entry);
  }
  return [...totals.values()];
}

/** "12.00 Mtr + 3.500 Kg" — a readable total across units. */
export function formatUnitTotals(totals, opts) {
  if (!totals?.length) return '—';
  return totals.map((t) => formatQty(t.qty, t.uom, opts)).join(' + ');
}
