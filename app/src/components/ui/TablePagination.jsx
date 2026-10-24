import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * TablePagination — Standard ERP / OSCAR Theme Responsive Table Pagination Bar.
 * 
 * Props:
 * - total / totalItems: total number of records
 * - page: current active page (1-based)
 * - pageSize: items per page (default: 10)
 * - onPageChange: (newPage) => void
 * - onPageSizeChange: (newPageSize) => void (optional)
 * - pageSizeOptions: array of page sizes (default: [10, 25, 50, 100])
 * - showPageSizeSelector: boolean (default: true)
 */
export function TablePagination({
  total = 0,
  totalItems,
  page = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelector = true,
  className = '',
}) {
  const actualTotal = totalItems !== undefined ? totalItems : (total || 0);
  const totalPages = Math.max(1, Math.ceil(actualTotal / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = actualTotal > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(safePage * pageSize, actualTotal);

  // Generate compact page range around current page
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= safePage - 1 && i <= safePage + 1)
    ) {
      pageNumbers.push(i);
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80 bg-white text-xs text-slate-600 select-none ${className}`}
    >
      {/* Left: Record Range Summary & Optional Page Size Dropdown */}
      <div className="flex items-center gap-3">
        <span className="font-medium text-slate-500">
          {actualTotal > 0 ? (
            <>
              Showing <strong className="text-slate-800 font-semibold">{startIndex}</strong> to{' '}
              <strong className="text-slate-800 font-semibold">{endIndex}</strong> of{' '}
              <strong className="text-slate-800 font-semibold">{actualTotal.toLocaleString('en-IN')}</strong> entries
            </>
          ) : (
            <>Showing <strong className="text-slate-800 font-semibold">0</strong> entries</>
          )}
        </span>

        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Per page:</label>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                onPageSizeChange(newSize);
                onPageChange?.(1);
              }}
              className="px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-700 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Numeric Page Buttons & Navigation Arrows */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1 || actualTotal === 0}
          onClick={() => onPageChange?.(safePage - 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer shadow-2xs"
          aria-label="Previous page"
        >
          <ChevronLeft size={13} />
          <span>Prev</span>
        </button>

        {pageNumbers.map((p, idx, arr) => (
          <React.Fragment key={p}>
            {idx > 0 && arr[idx - 1] !== p - 1 && (
              <span className="px-1.5 text-slate-400 font-bold select-none">…</span>
            )}
            <button
              type="button"
              disabled={actualTotal === 0}
              onClick={() => onPageChange?.(p)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                actualTotal === 0
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                  : p === safePage
                  ? 'bg-blue-600 text-white shadow-xs border border-blue-600'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
              }`}
            >
              {p}
            </button>
          </React.Fragment>
        ))}

        <button
          type="button"
          disabled={safePage >= totalPages || actualTotal === 0}
          onClick={() => onPageChange?.(safePage + 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer shadow-2xs"
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

export default TablePagination;
