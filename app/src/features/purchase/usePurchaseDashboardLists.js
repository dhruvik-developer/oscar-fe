import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { RESOURCES, isBackendEnabled } from '../../services/backendSync';

/** Every dashboard card renders at most this many rows. */
export const DASHBOARD_ROW_LIMIT = 5;

/**
 * Stored statuses that are still open, so the delivery card may show them.
 * The server filters on the stored value, so the pre-refresh spellings the
 * frontend's status map still translates (`Pending`, `Issued`,
 * `Partially Billed`) have to be asked for alongside their modern names.
 */
const OPEN_DELIVERY_STATUSES = [
  'Draft',
  'Pending Approval',
  'Pending',
  'Approved',
  'Issued',
  'In Production',
  'Partially Received',
  'Partially Billed',
];

const OPEN_RECEIPT_STATUSES = [
  'Approved',
  'Issued',
  'In Production',
  'Partially Received',
  'Partially Billed',
];

const EMPTY = { recent: null, deliveries: null, pendingReceipts: null };

/**
 * One card's five rows. `limit` is the server's page size, so the response
 * carries only what the card shows; the three queries differ in ordering and
 * status filter, never in the page size.
 */
async function fetchCardRows(params) {
  const body = await api.get('/purchase/orders/', {
    params: { limit: DASHBOARD_ROW_LIMIT, ...params },
  });
  const rows = Array.isArray(body) ? body : (body?.results || []);
  const fromApi = RESOURCES.purchaseOrders.fromApi;
  return rows.map(fromApi);
}

/**
 * The Purchase Overview Dashboard's four cards, five rows each.
 *
 * The cards read their own server page instead of the whole purchase-order
 * collection, so opening the dashboard never pulls every order just to render
 * five of them. `null` means "this query failed" and `undefined` means "not
 * asked / still in flight" -- the caller falls back to the complete collection
 * it already holds in both cases, so a backend outage degrades to the old
 * behaviour rather than an empty card.
 *
 * Identical requests share one in-flight promise (`api.get`), so React
 * StrictMode's second effect pass does not issue a duplicate read.
 */
export function usePurchaseDashboardLists() {
  const [cards, setCards] = useState(EMPTY);

  useEffect(() => {
    if (!isBackendEnabled()) return undefined;
    let cancelled = false;

    Promise.all([
      // Latest five by PO date.
      fetchCardRows({ ordering: '-doc_date,-created_at' }).catch(() => null),
      // Nearest expected deliveries first -- overdue (past dates) lead.
      fetchCardRows({ ordering: 'expected_date', status: OPEN_DELIVERY_STATUSES }).catch(() => null),
      // Orders still waiting for goods, also nearest expected date first.
      fetchCardRows({ ordering: 'expected_date', status: OPEN_RECEIPT_STATUSES }).catch(() => null),
    ]).then(([recent, deliveries, pendingReceipts]) => {
      if (!cancelled) setCards({ recent, deliveries, pendingReceipts });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return cards;
}
