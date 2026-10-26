import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

/** The sort indicator used on every sortable column header. */
export function SortIcon({ active = false, dir = '', size = 13 }) {
  if (!active || !dir) return <ChevronsUpDown size={size} className="shrink-0 text-muted/50" aria-hidden="true" />;
  return dir === 'asc'
    ? <ChevronUp size={size} className="shrink-0 text-primary" aria-hidden="true" />
    : <ChevronDown size={size} className="shrink-0 text-primary" aria-hidden="true" />;
}

/**
 * SortableTh — a `<th>` whose label toggles sorting from `useTableSort`.
 * Keeps the caller's own `<th>` classes, so the header looks as before plus
 * the indicator.
 *
 *   <SortableTh sort={sort} sortKey="createdAt" className="px-3 py-2">Date</SortableTh>
 */
export function SortableTh({ sort, sortKey, children, className = '', align = 'left', style, ...rest }) {
  const active = sort?.sortKey === sortKey && Boolean(sort?.sortDir);
  const dir = active ? sort.sortDir : '';
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th
      className={className}
      style={style}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      {...rest}
    >
      <button
        type="button"
        onClick={() => sort?.requestSort(sortKey)}
        className={`group inline-flex w-full items-center gap-1 ${justify} text-inherit cursor-pointer select-none hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm`}
        style={{ font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}
        title="Sort"
      >
        <span>{children}</span>
        <SortIcon active={active} dir={dir} />
      </button>
    </th>
  );
}

export default SortableTh;
