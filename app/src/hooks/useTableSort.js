import { useCallback, useMemo, useState } from 'react';

/**
 * useTableSort — client-side column sorting for any table.
 *
 *   const sort = useTableSort(filteredRows, {
 *     accessors: { amount: (r) => Number(r.total) },  // optional per column
 *   });
 *   // sort before paginating:
 *   const pageRows = sort.rows.slice(start, end);
 *   <SortableTh sort={sort} sortKey="name">Name</SortableTh>
 *
 * Clicking a column cycles ascending → descending → original order. Without
 * an accessor a column reads `row[sortKey]` (dot paths like `party.name` work).
 * Numbers, numeric strings ("1,250.00", "₹ 3,400") and ISO / "15 Sep 2025"
 * dates compare by value; everything else compares as text, case-insensitive
 * with natural number order ("PO-9" before "PO-10"). Empty values sort last.
 */

const DATE_LIKE = /^\d{4}-\d{2}-\d{2}|^\d{1,2}[\s/-][A-Za-z]{3,9}[\s/-]\d{2,4}$/;

/** A comparable form of a cell value: number, timestamp or lower-cased text. */
function normalise(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  const text = String(value).trim();
  if (!text) return null;
  const numeric = text.replace(/[₹$,%\s]/g, '');
  if (/^-?\d+(\.\d+)?$/.test(numeric)) return Number(numeric);
  if (DATE_LIKE.test(text)) {
    const time = Date.parse(text);
    if (!Number.isNaN(time)) return time;
  }
  return text.toLowerCase();
}

/** Ascending comparison of two raw cell values; empty values always last. */
export function compareValues(a, b) {
  const x = normalise(a);
  const y = normalise(b);
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
}

function readPath(row, path) {
  if (row == null) return undefined;
  if (!String(path).includes('.')) return row[path];
  return String(path).split('.').reduce((obj, part) => (obj == null ? undefined : obj[part]), row);
}

/** Sort `rows` by `key` in `dir`, keeping the original order for ties. */
export function sortRows(rows, key, dir, accessor) {
  const list = Array.isArray(rows) ? rows : [];
  if (!key || !dir) return list;
  const read = accessor || ((row) => readPath(row, key));
  const sign = dir === 'desc' ? -1 : 1;
  return list
    .map((row, index) => ({ row, index, value: read(row) }))
    .sort((a, b) => {
      const empty = (v) => normalise(v) === null;
      // Empty cells stay at the bottom in both directions.
      if (empty(a.value) !== empty(b.value)) return empty(a.value) ? 1 : -1;
      return sign * compareValues(a.value, b.value) || a.index - b.index;
    })
    .map((entry) => entry.row);
}

export function useTableSort(rows, { initialKey = '', initialDir = 'asc', accessors = {} } = {}) {
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState(initialKey ? initialDir : '');

  const requestSort = useCallback((key) => {
    if (key !== sortKey) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey('');
      setSortDir('');
    }
  }, [sortKey, sortDir]);

  const accessor = sortKey ? accessors[sortKey] : undefined;
  const sorted = useMemo(
    () => sortRows(rows, sortKey, sortDir, accessor),
    // `accessors` is usually an inline object; the active accessor is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, sortKey, sortDir],
  );

  return { rows: sorted, sortKey, sortDir, requestSort };
}

export default useTableSort;
