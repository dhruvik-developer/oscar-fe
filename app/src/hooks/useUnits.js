import { useEffect, useState } from 'react';

import { fabricMasterSync, isBackendEnabled } from '../services/fabricMasterSync';

// One shared copy of the UOM master for every screen that picks a unit.
// Read from /inventory/units/; without a session there are no units.

let cache = null;
let inflight = null;
const listeners = new Set();

async function load() {
  if (!isBackendEnabled()) return [];
  const rows = await fabricMasterSync.pull('units');
  return rows || [];
}

/** Re-read the master (call after a unit is added or edited). */
export function refreshUnits() {
  inflight = load()
    .then((rows) => {
      cache = rows;
      listeners.forEach((fn) => fn(rows));
      return rows;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

/**
 * `{ units, activeUnits, loading }` — `units` includes inactive rows so old
 * documents still resolve their unit; pickers should offer `activeUnits`.
 */
export default function useUnits() {
  const [units, setUnits] = useState(cache || []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    const onChange = (rows) => { setUnits(rows); setLoading(false); };
    listeners.add(onChange);
    if (cache === null) (inflight || refreshUnits()).catch(() => setLoading(false));
    return () => listeners.delete(onChange);
  }, []);

  return { units, activeUnits: units.filter((u) => u.isActive !== false), loading };
}
