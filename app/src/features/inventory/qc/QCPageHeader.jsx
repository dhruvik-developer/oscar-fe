import React from 'react';
import { PageHeader } from '../../../components/ui/PageHeader';

/**
 * Standardized Quality Control (QC) Page Header.
 *
 * Implements the exact Batch Registry / OSCAR standard header structure:
 *  1. Breadcrumb navigation: Dashboard › Inventory › Quality Control › [Current Page]
 *  2. Large, bold page title (text-[19px] sm:text-[21px] font-extrabold text-slate-900)
 *  3. Information button (PageInfoButton) beside the title
 *  4. Descriptive subtitle below the title (text-[13px] text-slate-500)
 *  5. Matching typography, spacing, alignment, and action container
 *
 * @param {string} title - Page title
 * @param {string} [subtitle] - Descriptive subtitle
 * @param {Array} [breadcrumb] - Custom breadcrumb trail override
 * @param {string} [subpage] - Subpage label for breadcrumbs (defaults to title)
 * @param {object|string} [guide] - Guide info modal content or guide key
 * @param {React.ReactNode} [actions] - Action buttons aligned to the right
 * @param {React.ReactNode} [titleExtra] - Badges, pills, or status indicators beside title
 */
export function QCPageHeader({
  title,
  subtitle,
  breadcrumb,
  subpage,
  isDashboard = false,
  guide,
  actions,
  titleExtra,
}) {
  const defaultBreadcrumbs = (isDashboard || subpage === null)
    ? [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Inventory', path: '/inventory/stock-position' },
        { label: 'Quality Control', isCurrent: true },
      ]
    : [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Inventory', path: '/inventory/stock-position' },
        { label: 'Quality Control', path: '/inventory/qc' },
        { label: subpage || title, isCurrent: true },
      ];

  return (
    <PageHeader
      title={title}
      subtitle={subtitle}
      breadcrumb={breadcrumb || defaultBreadcrumbs}
      guide={guide}
      actions={actions}
      titleExtra={titleExtra}
    />
  );
}

export default QCPageHeader;
