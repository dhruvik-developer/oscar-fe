/**
 * syncCollection — write a whole CRM collection back after a screen edited it.
 *
 * Several CRM configuration screens (master tasks, stage tasks, the pipelines)
 * hold their list in local component state and save the array wholesale — they
 * were written against a `localStorage` blob. Rather than rewrite each of their
 * handlers, they hand the list here and this works out what changed: rows the
 * server has not seen are created, rows that differ are patched, and rows that
 * disappeared are deleted.
 */
import { useCrmStore } from '../stores/crmStore';
import { isServerId } from './resourceSync';

function warn(key) {
  return (err) => console.warn(`[CRM] ${key} not saved:`, err?.message || err);
}

export function syncCollection(key, next = [], previous = []) {
  const store = useCrmStore.getState();
  const before = new Map(previous.map((row) => [String(row?.id), row]));
  const after = new Set(next.map((row) => String(row?.id)));
  const report = warn(key);

  const withoutTransient = (row) => {
    if (!row || typeof row !== 'object') return row;
    const { _pending, ...rest } = row;
    return rest;
  };

  next.forEach((row) => {
    if (!row) return;
    // An optimistic echo (a row the store already sent, awaiting its server
    // id) must never be created again — that is how whole-list write-backs
    // minted identical duplicate rows on every create.
    if (row._pending) return;
    const existing = before.get(String(row.id));
    if (!existing) {
      store.createRecord(key, row).catch(report);
    } else if (isServerId(row.id) && JSON.stringify(withoutTransient(existing)) !== JSON.stringify(withoutTransient(row))) {
      store.updateRecord(key, row.id, row).catch(report);
    }
  });

  previous.forEach((row) => {
    if (row && !after.has(String(row.id))) {
      if (isServerId(row.id)) {
        store.deleteRecord(key, row.id).catch(report);
      } else {
        // Local-only row (e.g. `mt-<timestamp>`) has no server record, so
        // there is nothing to DELETE — drop it from the store directly.
        // Without this the row silently survives every delete attempt.
        try {
          const current = useCrmStore.getState()[key] || [];
          useCrmStore.setState({
            [key]: current.filter((r) => String(r?.id) !== String(row.id)),
          });
        } catch (err) {
          report(err);
        }
      }
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('crm:data-updated'));
  }
}

export default syncCollection;
