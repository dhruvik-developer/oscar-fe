import AppPagination from './AppPagination';

/**
 * Pagination — kept as a name for existing imports; renders the shared
 * AppPagination. Props: total, page, pageSize, onChange, plus the optional
 * pageSizeOptions / onPageSizeChange. `showTotalRecords` is accepted for old
 * callers; the shared bar always shows the record range.
 */
export function Pagination({ onChange, showTotalRecords, ...rest }) {
  return <AppPagination onPageChange={onChange} {...rest} />;
}

export default Pagination;
