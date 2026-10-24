import React from 'react';
import { Building2, Package, User, CalendarDays } from 'lucide-react';
import { formatCurrency } from '../../../../utils/currencyUtils';
import { useERP } from '../../../../context/ERPContext';

/**
 * ProjectInfoTab — order context for the project.
 *
 * Customer contact details are looked up from the ERP customer master by
 * crmCustomerId, so this view shows the same record the rest of the ERP does
 * rather than a PMS-local copy that could drift.
 */

function Card({ title, icon: Icon, children }) {
  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
      <header className="flex items-center gap-2 mb-4">
        <Icon size={14} className="text-slate-400" />
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </header>
      {children}
    </section>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <dt className="text-[11px] text-slate-500 shrink-0">{label}</dt>
      <dd
        className={`text-[11px] font-semibold text-slate-800 text-right min-w-0 break-words ${mono ? 'font-mono' : ''}`}
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}

function stamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function ProjectInfoTab({ project, meta }) {
  // The party behind the project, from the customers the server returned.
  const { customers = [] } = useERP() || {};
  const customer = customers.find((c) => c.id === project.crmCustomerId) ?? null;
  const details = project.productDetails ?? {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card title="Customer" icon={Building2}>
        <dl>
          <Row label="Name" value={project.customerName} />
          <Row label="ERP Customer ID" value={project.crmCustomerId} mono />
          <Row label="Contact Person" value={customer?.contactPerson} />
          <Row label="Email" value={customer?.email} />
          <Row label="Phone" value={customer?.phone} />
          <Row
            label="Credit Limit"
            value={customer ? formatCurrency(customer.creditLimit) : '—'}
          />
        </dl>
        {!customer && (
          <p className="text-[11px] text-slate-400 mt-3">
            No matching ERP customer record for this project.
          </p>
        )}
      </Card>

      <Card title="Order & Product" icon={Package}>
        <dl>
          <Row label="CRM Order" value={project.crmOrderId} mono />
          <Row label="Product" value={details.productName} />
          <Row label="Quantity" value={details.quantity} />
          <Row label="Order Value" value={formatCurrency(details.orderValue ?? 0)} />
        </dl>
        <div className="mt-3">
          <p className="text-[11px] text-slate-500 mb-1">Specifications</p>
          <p className="text-[11px] text-slate-700 bg-[#f6f9ff] border border-[#dce5f4] rounded-lg px-3 py-2">
            {details.specifications || <em className="text-slate-400">No specifications recorded.</em>}
          </p>
        </div>
      </Card>

      <Card title="Ownership" icon={User}>
        <div className="flex items-center gap-3 pb-3 mb-1 border-b border-slate-100">
          {project.projectManager?.avatar ? (
            <img
              src={project.projectManager.avatar}
              alt=""
              className="w-10 h-10 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <span className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-500 flex items-center justify-center">
              {project.projectManager?.name?.slice(0, 1) ?? '?'}
            </span>
          )}
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800">{project.projectManager?.name}</div>
            <div className="text-[11px] text-slate-500 truncate">{project.projectManager?.email}</div>
          </div>
        </div>
        <dl>
          <Row label="Current Department" value={meta?.department} />
          <Row label="Current Stage" value={meta?.sequenceLabel} />
          <Row label="Priority" value={project.priority} />
          <Row label="Status" value={project.status} />
        </dl>
      </Card>

      <Card title="Schedule" icon={CalendarDays}>
        <dl>
          <Row label="Start Date" value={stamp(project.startDate)} />
          <Row label="Expected Completion" value={stamp(project.expectedCompletionDate)} />
          <Row label="Actual Completion" value={stamp(project.actualCompletionDate)} />
          <Row
            label="Schedule Status"
            value={
              project.status === 'Completed'
                ? 'Delivered'
                : meta?.isOverdue
                  ? `Overdue by ${meta.projectDelayLabel}`
                  : meta?.remainingLabel
            }
          />
          <Row label="Overall Completion" value={`${project.overallCompletionPct ?? 0}%`} />
          <Row label="Stages" value={`${meta?.stageCount ?? 0} configured`} />
        </dl>
      </Card>
    </div>
  );
}

export default ProjectInfoTab;
