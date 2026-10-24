/**
 * auditTrail — `GET /audit/`, the record of who changed what.
 *
 * The HRMS dashboard's activity strip and the ERP audit screens read this. It
 * is the server's log, so an action taken by a colleague appears here too —
 * which is the whole point of an audit trail, and was exactly what the previous
 * per-browser list could not do.
 */
import { api } from './api';
import { isBackendEnabled, rowsOf } from './resourceSync';

export async function pullAuditTrail(query = {}) {
  if (!isBackendEnabled()) return null;
  try {
    const body = await api.get('/audit/', { query: { limit: 50, ...query } });
    return rowsOf(body);
  } catch (err) {
    console.warn('[Audit] trail unavailable:', err?.message || err);
    return null;
  }
}

export default pullAuditTrail;
