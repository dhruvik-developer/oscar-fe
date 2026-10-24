import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toTitleCase, safeString } from '../../utils/stringUtils';
import { PageInfoButton } from './PageInfoButton';

/**
 * GLOBAL page header — the single approved header for every OSCAR ERP
 * module (reference: Sales Quotations).
 *
 * Layout (identical everywhere):
 *   [Breadcrumb]  Dashboard › Module › Current Page   (12px)
 *   [Title]       Current Page Name  ⓘ  [actions]      (20px extrabold)
 *   [Subtitle]    One-line page description            (13px)
 *
 * Only breadcrumb text, title, subtitle and the optional info icon /
 * actions change per page. Sizes, spacing and positions never change.
 *
 * Props: title, subtitle, breadcrumb (custom items override the
 * auto path-derived trail), guide (info-button content), actions
 * (right-aligned buttons), titleExtra (e.g. a status pill after title).
 */

/** Friendly labels for URL segments the title-caser gets wrong. */
const SEGMENT_LABELS = {
  'job-work': 'Job Work / Processing',
  crm: 'CRM',
  pms: 'PMS',
  hrms: 'HRMS',
};

const segmentLabel = (part) => SEGMENT_LABELS[part] || toTitleCase(part, part);

/** Sections whose URLs sit outside the module they are filed under in the
 *  sidebar -- Job Work keeps its /job-work URLs but lives inside PMS. */
const PARENT_SECTION = {
  'job-work': { label: 'PMS', path: '/pms' },
};

export function PageHeader({ title, subtitle, breadcrumb, guide, actions, titleExtra }) {
  const location = useLocation();

  const pathname = safeString(location?.pathname, '/');
  const pathParts = pathname.split('/').filter(Boolean);
  const defaultBreadcrumbs = [
    { label: 'Dashboard', path: '/dashboard' },
    ...(PARENT_SECTION[pathParts[0]] ? [PARENT_SECTION[pathParts[0]]] : []),
    ...pathParts.map((part, index) => ({
      label: segmentLabel(part),
      path: `/${pathParts.slice(0, index + 1).join('/')}`,
      isCurrent: index === pathParts.length - 1,
    })),
  ];

  const activeBreadcrumb = breadcrumb || defaultBreadcrumbs;

  return (
    <div className="flex flex-col gap-2 pb-2">
      {/* Breadcrumb */}
      {activeBreadcrumb && activeBreadcrumb.length > 0 && (
        <nav className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[12px] font-medium text-slate-500 scrollbar-none">
          {activeBreadcrumb.map((bc, idx) => {
            const isLast = idx === activeBreadcrumb.length - 1;
            const label = safeString(bc?.label || bc?.name, 'Section');
            const targetPath = bc?.path || bc?.to || null;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="shrink-0 text-slate-300">›</span>}
                {isLast || !targetPath ? (
                  <span className={isLast ? 'font-semibold text-slate-900' : ''}>{label}</span>
                ) : (
                  <Link
                    to={targetPath}
                    className="transition-colors hover:text-slate-700"
                  >
                    {label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Title row */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-[19px] sm:text-[21px] font-extrabold tracking-tight text-slate-900 truncate">{title}</h1>
        {titleExtra}
        <PageInfoButton guide={guide} title={title} />
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2 w-full sm:w-auto">{actions}</div>}
      </div>

      {/* Subtitle */}
      {subtitle && <p className="mt-0.5 max-w-3xl text-[13px] text-slate-500">{subtitle}</p>}
    </div>
  );
}

export default PageHeader;
