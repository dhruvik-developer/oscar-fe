import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

/**
 * The standardized sort indicator used on every sortable column header.
 * Universal size: 14px, consistent spacing, vertical alignment and theme colors.
 */
export function SortIcon({ active = false, dir = '', size = 14 }) {
  if (!active || !dir) {
    return <ChevronsUpDown size={size} className="table-sort-icon shrink-0 text-text-secondary/60 group-hover:text-text-secondary transition-colors" aria-hidden="true" />;
  }
  return dir === 'asc'
    ? <ChevronUp size={size} className="table-sort-icon shrink-0 text-primary transition-transform" aria-hidden="true" />
    : <ChevronDown size={size} className="table-sort-icon shrink-0 text-primary transition-transform" aria-hidden="true" />;
}

/**
 * SortableTh — standardized `<th>` header cell whose label toggles sorting from `useTableSort`.
 * Standard height: 44px, padding: 12px, font: 12px / 600 weight, centered vertical alignment.
 */
export function SortableTh({ sort, sortKey, children, className = '', align = 'left', style, ...rest }) {
  const active = sort?.sortKey === sortKey && Boolean(sort?.sortDir);
  const dir = active ? sort.sortDir : '';
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <th
      className={`table-header-cell th-std ${alignClass} ${className}`}
      style={style}
      align={align}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      {...rest}
    >
      <button
        type="button"
        onClick={() => sort?.requestSort(sortKey)}
        className={`group inline-flex w-full h-full min-h-[44px] items-center gap-1.5 ${justify} text-inherit cursor-pointer select-none hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm`}
        style={{ font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}
        title="Sort"
      >
        <span className="leading-tight">{children}</span>
        <SortIcon active={active} dir={dir} size={14} />
      </button>
    </th>
  );
}

export default SortableTh;
