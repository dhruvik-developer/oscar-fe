import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, UserPlus, AlertTriangle, CheckCircle2, Truck, Receipt, ShoppingCart, Boxes, Printer, Link2 } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { StageStatusBadge } from '../../components/StageStatusBadge';
import { formatCurrency } from '../../../../utils/currencyUtils';
import PageInfoButton from '../../../../components/ui/PageInfoButton';

/**
 * ProjectHeader — the hero banner for the project workspace.
 *
 * Carries the order context, a radial completion gauge fed by the store's
 * derived overallCompletionPct, and the four quick actions from the spec.
 */

const PRIORITY_TONES = {
  Urgent: { bg: '#ffe4e6', fg: '#9f1239' },
  High: { bg: '#ffedd5', fg: '#9a3412' },
  Medium: { bg: '#e0f2fe', fg: '#0369a1' },
  Low: { bg: '#f1f5f9', fg: '#475569' },
};

function CompletionGauge({ value = 0, status }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const size = 96;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  const color =
    status === 'Delayed' ? '#f43f5e' :
    status === 'At Risk' ? '#ef9b06' :
    status === 'Completed' ? '#1bb878' : '#1f6bff';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${pct} percent complete`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e8eef8" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-slate-800 leading-none">{pct}%</span>
        <span className="text-[9px] font-semibold text-slate-400 mt-0.5">COMPLETE</span>
      </div>
    </div>
  );
}

export function ProjectHeader({
  project,
  meta,
  onAssignStage,
  onLogDelay,
  onCompleteProject,
  onPrintProject,
  onProductionLink,
}) {
  const priority = PRIORITY_TONES[project.priority] ?? PRIORITY_TONES.Low;
  const isClosed = project.status === 'Completed';

  const customerTotal = Number(project.customerProjectTotalMeters ?? project.requirementMeters ?? project.quantity ?? 0);
  const customerReceived = Number(project.customerProjectReceivedMeters ?? 0);
  const customerPct = customerTotal > 0 ? Math.min(100, Math.round((customerReceived / customerTotal) * 100)) : 0;
  const customerStatus = project.customerProjectStatus || (customerReceived >= customerTotal && customerTotal > 0 ? 'Fabric Received' : 'Pending');

  const ownTotal = Number(project.ownProjectTotalMeters ?? project.ownMeters ?? project.pipelineSummary?.own_meters ?? 0);
  const ownReceived = Number(project.ownProjectReceivedMeters ?? 0);
  const ownPct = ownTotal > 0 ? Math.min(100, Math.round((ownReceived / ownTotal) * 100)) : 0;
  const ownStatus = project.ownProjectStatus || (ownReceived >= ownTotal && ownTotal > 0 ? 'In Stock' : 'Pending');

  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-3">
        <Link to="/pms" className="text-blue-600 hover:underline">PMS</Link>
        <ChevronRight size={12} className="text-slate-300" />
        <Link to="/pms/projects" className="text-blue-600 hover:underline">Projects</Link>
        <ChevronRight size={12} className="text-slate-300" />
        <span className="text-slate-600 font-semibold">{project.code || project.id}</span>
      </nav>

      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        <CompletionGauge value={project.overallCompletionPct} status={project.status} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{project.code || project.id}</h2>
            <PageInfoButton title="Project Details" />
            <StageStatusBadge status={project.status} />
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: priority.bg, color: priority.fg }}
            >
              {project.priority}
            </span>
            {meta?.isOverdue && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#ffe4e6', color: '#9f1239' }}
              >
                <AlertTriangle size={10} strokeWidth={2.5} />+{meta.projectDelayLabel} overdue
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-slate-700 truncate">
            {project.productDetails?.productName}
          </p>

          <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2">
            {[
              ['Customer', project.customerName],
              ['CRM Order', project.crmOrderId ? (
                <Link to="/sales/orders" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-mono">
                  <ShoppingCart size={10} /> {project.crmOrderId}
                </Link>
              ) : '—'],
              ['Order Value', formatCurrency(project.productDetails?.orderValue ?? 0)],
              ['Current Stage', meta?.sequenceLabel ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[10px] text-slate-400 font-medium">{k}</dt>
                <dd className="text-[11px] font-semibold text-slate-700 truncate max-w-[220px]" title={typeof v === 'string' ? v : undefined}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Customer Project & Own Project Summary Cards */}
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          {/* Card 1: Customer Project */}
          <div className="w-full sm:w-52 rounded-xl bg-amber-50/50 border border-amber-100 p-3 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Boxes size={14} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 leading-tight">Customer Project</h4>
                <p className="text-[10px] text-slate-400 leading-tight">Fabric for Customer Order</p>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-xs font-black text-slate-800 mb-1">
                <span>{customerReceived.toLocaleString('en-IN')} m / {customerTotal.toLocaleString('en-IN')} m</span>
                <span className="text-[11px] font-bold text-emerald-600">{customerPct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-amber-200/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${customerPct}%` }}
                />
              </div>
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={10} /> {customerStatus}
              </span>
            </div>
          </div>

          {/* Card 2: Own Project */}
          <div className="w-full sm:w-52 rounded-xl bg-blue-50/50 border border-blue-100 p-3 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Boxes size={14} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 leading-tight">Own Project</h4>
                <p className="text-[10px] text-slate-400 leading-tight">Extra Fabric for Inventory</p>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-xs font-black text-slate-800 mb-1">
                <span>{ownReceived.toLocaleString('en-IN')} m / {ownTotal.toLocaleString('en-IN')} m</span>
                <span className="text-[11px] font-bold text-blue-600">{ownPct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-blue-200/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${ownPct}%` }}
                />
              </div>
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                <AlertTriangle size={10} className="rotate-180" /> {ownStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap lg:flex-col gap-2 shrink-0">
          <Button size="sm" variant="secondary" icon={Printer} onClick={onPrintProject} title="Print or save project report as PDF">
            Print Project Report
          </Button>
          {onProductionLink && (
            <Button
              size="sm"
              variant="secondary"
              icon={Link2}
              onClick={onProductionLink}
              title="Shareable link to the Daily Production Entry form for this project"
            >
              Production Entry Link
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={UserPlus} onClick={onAssignStage} disabled={isClosed}>
            Assign Active Stage
          </Button>
          <Button size="sm" variant="secondary" icon={AlertTriangle} onClick={onLogDelay} disabled={isClosed}>
            Log Delay
          </Button>
          <Button size="sm" icon={CheckCircle2} onClick={onCompleteProject} disabled={isClosed}>
            {isClosed ? 'Completed' : 'Complete Project'}
          </Button>

          {isClosed && (
            <>
              <Link
                to="/sales/delivery"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                title="Generate Delivery Challan for dispatching completed project"
              >
                <Truck size={13} /> Issue Challan
              </Link>
              <Link
                to="/sales/invoices"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-xs transition-colors"
                title="Create Commercial Sales Invoice"
              >
                <Receipt size={13} /> Create Invoice
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default ProjectHeader;
