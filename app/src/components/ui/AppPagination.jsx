import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * AppPagination — the one pagination bar used under every table and list.
 *
 * It only renders; the caller owns the page state and the data fetching, so
 * client-side slices and server-side `?page=` requests both plug in the same
 * way. Pages are always 1-based here — a caller whose API is 0-based converts
 * at its own boundary.
 *
 * Props:
 * - total / totalItems: total number of records (server `count` or rows.length)
 * - page: current page (1-based)
 * - pageSize: records per page
 * - onPageChange(page)  (alias: onChange)
 * - onPageSizeChange(size): optional; shows the "Rows" selector. The page is
 *   reset to 1 afterwards.
 * - pageSizeOptions: sizes offered in the selector
 * - showPageSizeSelector: set false to hide the selector even with a handler
 * - loading: disables the controls while a page is being fetched
 * - bordered: top border + padding for sitting at the foot of a table card
 * - className
 */

const SIBLINGS = 1;
// first + last + current + 2 siblings + 2 ellipses
const MAX_SLOTS = 5 + SIBLINGS * 2;

/** Page numbers to show, with `'…'` where a run is collapsed. */
export function pageItems(page, totalPages) {
  if (totalPages <= MAX_SLOTS) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const left = Math.max(page - SIBLINGS, 2);
  const right = Math.min(page + SIBLINGS, totalPages - 1);
  const showLeftGap = left > 3;
  const showRightGap = right < totalPages - 2;
  const span = 3 + SIBLINGS * 2;

  if (!showLeftGap && showRightGap) {
    return [...Array.from({ length: span }, (_, i) => i + 1), '…', totalPages];
  }
  if (showLeftGap && !showRightGap) {
    return [1, '…', ...Array.from({ length: span }, (_, i) => totalPages - span + 1 + i)];
  }
  const middle = Array.from({ length: right - left + 1 }, (_, i) => left + i);
  return [1, '…', ...middle, '…', totalPages];
}

const NAV_BTN =
  'inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md border border-border bg-card text-muted ' +
  'hover:bg-soft hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-card disabled:hover:text-muted transition-colors cursor-pointer';

const PAGE_BTN =
  'inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md border text-xs font-semibold tabular-nums ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors cursor-pointer ' +
  'disabled:cursor-not-allowed';

export function AppPagination({
  total = 0,
  totalItems,
  page = 1,
  pageSize = 10,
  onPageChange,
  onChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelector = true,
  loading = false,
  bordered = true,
  className = '',
}) {
  const count = Math.max(0, Number(totalItems ?? total) || 0);
  const size = Math.max(1, Number(pageSize) || 1);
  const totalPages = Math.max(1, Math.ceil(count / size));
  const current = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = count > 0 ? (current - 1) * size + 1 : 0;
  const end = Math.min(current * size, count);
  const go = onPageChange || onChange;
  const disabled = loading || count === 0;

  // A filter that shrinks the result set can leave the caller on a page that
  // no longer exists; move it to the last real page once the count is known.
  useEffect(() => {
    if (!loading && count > 0 && Number(page) > totalPages) go?.(totalPages);
  }, [loading, count, page, totalPages, go]);

  const goTo = (p) => {
    const next = Math.min(Math.max(1, p), totalPages);
    if (next !== current) go?.(next);
  };

  const sizes = pageSizeOptions?.length
    ? [...new Set([...pageSizeOptions, size])].sort((a, b) => a - b)
    : [];
  const showSizes = Boolean(showPageSizeSelector && onPageSizeChange && sizes.length > 0);
  const showEdges = totalPages > MAX_SLOTS;
  const fmt = (n) => n.toLocaleString('en-IN');

  return (
    <nav
      aria-label="Pagination"
      aria-busy={loading || undefined}
      className={`flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-3 text-xs text-muted select-none min-w-0 ${
        bordered ? 'px-4 py-3 border-t border-border bg-card' : ''
      } ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0">
        <span aria-live="polite">
          {loading ? (
            'Loading…'
          ) : count > 0 ? (
            <>
              Showing <span className="font-semibold text-text">{fmt(start)}–{fmt(end)}</span> of{' '}
              <span className="font-semibold text-text">{fmt(count)}</span>
            </>
          ) : (
            'No records'
          )}
        </span>

        {showSizes && (
          <label className="inline-flex items-center gap-1.5">
            <span>Rows per page</span>
            <select
              value={size}
              disabled={loading}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                go?.(1);
              }}
              className="h-8 pl-2 pr-6 rounded-md border border-border bg-card text-text text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer disabled:opacity-40"
            >
              {sizes.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1 self-end sm:self-auto">
        {showEdges && (
          <button type="button" className={NAV_BTN} disabled={disabled || current <= 1} onClick={() => goTo(1)} aria-label="First page">
            <ChevronsLeft size={14} />
          </button>
        )}
        <button type="button" className={NAV_BTN} disabled={disabled || current <= 1} onClick={() => goTo(current - 1)} aria-label="Previous page">
          <ChevronLeft size={14} />
        </button>

        <span className="sm:hidden px-2 tabular-nums">
          Page <span className="font-semibold text-text">{current}</span> of {totalPages}
        </span>
        <div className="hidden sm:flex items-center gap-1">
          {pageItems(current, totalPages).map((p, idx) =>
            p === '…' ? (
              <span key={`gap-${idx}`} className="inline-flex items-center justify-center h-8 w-6 text-muted" aria-hidden="true">…</span>
            ) : (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => goTo(p)}
                aria-label={`Page ${p}`}
                aria-current={p === current ? 'page' : undefined}
                className={`${PAGE_BTN} ${
                  p === current
                    ? 'bg-primary border-primary text-white'
                    : 'bg-card border-border text-text hover:bg-soft disabled:opacity-40'
                }`}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <button type="button" className={NAV_BTN} disabled={disabled || current >= totalPages} onClick={() => goTo(current + 1)} aria-label="Next page">
          <ChevronRight size={14} />
        </button>
        {showEdges && (
          <button type="button" className={NAV_BTN} disabled={disabled || current >= totalPages} onClick={() => goTo(totalPages)} aria-label="Last page">
            <ChevronsRight size={14} />
          </button>
        )}
      </div>
    </nav>
  );
}

export default AppPagination;
