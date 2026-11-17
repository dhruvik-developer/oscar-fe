import React from 'react';
import SortableTh, { SortIcon } from './SortableTh';

export { SortableTh, SortIcon };

/**
 * Standard table <thead> wrapper adhering to OSCAR ERP Global Table Header Standard.
 * Standard dimensions: 44px height, 12px horizontal padding, 12px typography, 600 weight.
 */
export function TableHead({ children, className = '', ...props }) {
  return (
    <thead className={`table-head-std ${className}`} {...props}>
      {children}
    </thead>
  );
}

/**
 * Standard table <tr> wrapper inside <thead>.
 */
export function TableHeaderRow({ children, className = '', ...props }) {
  return (
    <tr className={`table-head-row-std ${className}`} {...props}>
      {children}
    </tr>
  );
}

/**
 * Standard non-sortable <th> cell.
 */
export function Th({ children, align = 'left', className = '', ...props }) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`th-std ${alignCls} ${className}`} align={align} {...props}>
      <span className="leading-tight">{children}</span>
    </th>
  );
}

export default TableHead;
