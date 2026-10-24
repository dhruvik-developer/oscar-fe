// Shared helpers for the job-work challan and lorry receipt print templates.
// Values only ever come from saved records -- a missing value prints as '—'.

export const dash = (v) => (v === null || v === undefined || v === '' ? '—' : v);

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}-${m}-${y}` : String(iso);
};

export const fmtNum = (v, digits = 2) =>
  v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: digits });

export const fmtMoney = (v) => (v === null || v === undefined || v === '' ? '—' : `₹${fmtNum(v)}`);

/** Address may be a string or a {line1, line2, city, state, pincode} object. */
export const fmtAddress = (addr) => {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.line1 || addr.street, addr.line2, addr.city, addr.state, addr.pincode || addr.pin, addr.country]
    .filter(Boolean)
    .join(', ');
};

/** Party / processor lookup from the ERP vendor list by id or name. */
export const findParty = (vendors, { id, name } = {}) =>
  (vendors || []).find((v) => (id && String(v.id) === String(id)) || (name && v.name === name)) || null;

export const partyAddress = (party) =>
  fmtAddress(party?.billingAddress || party?.billing_address || party?.address || party?.shippingAddress);
