import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Droplets, Factory, Warehouse } from 'lucide-react';
import { formatINR, formatNumberIN } from '../../../accounts/accountingShared';
import { Card } from './shared';

const Row = ({ label, children }) => (
  <div>
    <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="font-semibold text-slate-800">{children ?? '—'}</dd>
  </div>
);

/**
 * The order behind a factory fabric batch: PO, factory, yarn and -- for a
 * dyed batch -- the grey fabric's factory -> mill journey. That journey is a
 * trace only: the grey fabric never was an OSCAR stock batch.
 */
export default function PurchaseTraceCard({ trace }) {
  if (!trace) return null;
  const flowB = trace.fabricFlow === 'FACTORY_TO_MILL';
  const r = trace.receipt || {};
  return (
    <Card
      title="Order traceability"
      subtitle={`${trace.fabricFlowLabel} · PO ${trace.poNumber}`}
      actions={<Link to={`/purchase/orders?po=${encodeURIComponent(trace.purchaseOrderId)}`} className="h-8 px-3 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center">Open PO</Link>}
    >
      <ol className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px] font-semibold text-slate-600" aria-label="Fabric journey">
        <li className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 px-2 py-1"><Factory size={12} /> {trace.factoryName || 'Factory'}</li>
        {flowB && (
          <>
            <ArrowRight size={12} className="text-slate-300" aria-hidden="true" />
            <li className="inline-flex items-center gap-1 rounded-md bg-violet-50 border border-violet-200 px-2 py-1 text-violet-800"><Droplets size={12} /> {trace.dyeingMillName || trace.millProcesses?.[0]?.millName || 'Dyeing mill'}</li>
          </>
        )}
        <ArrowRight size={12} className="text-slate-300" aria-hidden="true" />
        <li className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-emerald-800"><Warehouse size={12} /> OSCAR · {r.grnNumber}</li>
      </ol>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Row label="Receipt date">{r.receiptDate}</Row>
        <Row label="Received">{formatNumberIN(r.receivedQty)}</Row>
        <Row label="Accepted (QC)">{r.acceptedQty != null ? formatNumberIN(r.acceptedQty) : null}</Row>
        <Row label="QC status">{r.qcStatus}</Row>
        {trace.allocatedTotal != null && <Row label="Allocated landed cost">{formatINR(trace.allocatedTotal)}</Row>}
        {trace.landedRate != null && <Row label="Landed rate / unit">{formatINR(trace.landedRate)}</Row>}
        <Row label="Landed cost status">{{ PROVISIONAL: 'Provisional', COMPLETE: 'Complete', NOT_STARTED: 'Not started' }[trace.landedCostStatus] || trace.landedCostStatus}</Row>
        <Row label="Challan">{r.challanNo}</Row>
      </dl>

      {trace.allocatedCosts?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {trace.allocatedCosts.map((c) => (
            <span key={c.label} className="rounded-md bg-slate-50 border border-slate-200 px-2 py-1">{c.label}: <strong className="tabular-nums">{formatINR(c.amount)}</strong></span>
          ))}
        </div>
      )}

      {trace.yarnLines?.length > 0 && (
        <div className="mt-3">
          <h4 className="text-[11px] font-bold text-slate-700 mb-1">Yarn (planned on the PO)</h4>
          <ul className="space-y-0.5 text-slate-600">
            {trace.yarnLines.map((y) => (
              <li key={y.id}>{y.item || y.yarnQuality} — {formatNumberIN(y.requiredQty)} {y.uom}{y.yarnLot ? ` · lot ${y.yarnLot}` : ''}{y.supplierName ? ` · ${y.supplierName}` : ''}</li>
            ))}
          </ul>
        </div>
      )}

      {flowB && (
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <h4 className="text-[11px] font-bold text-slate-700 mb-1">Factory → mill dispatches <span className="font-normal text-slate-400">(trace only, not OSCAR stock)</span></h4>
            {(trace.factoryToMill || []).length === 0 ? <p className="text-slate-400">None recorded.</p> : (
              <ul className="space-y-0.5 text-slate-600">
                {trace.factoryToMill.map((d) => (
                  <li key={d.id}><span className="font-mono">{d.deliveryNumber}</span> · {d.dispatchDate} · {formatNumberIN(d.dispatchedQty)} to {d.millName}{d.challanNo ? ` · challan ${d.challanNo}` : ''}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-slate-700 mb-1">Mill receipt &amp; processing</h4>
            {(trace.millProcesses || []).length === 0 ? <p className="text-slate-400">None recorded.</p> : (
              <ul className="space-y-0.5 text-slate-600">
                {trace.millProcesses.map((m) => (
                  <li key={m.id}>{m.millReceiptDate} · received {formatNumberIN(m.qtyReceived)} · {[m.processType, m.shade].filter(Boolean).join(' ')} {formatNumberIN(m.processedQty)} · sent {formatNumberIN(m.millDispatchedQty)}{m.millDispatchDate ? ` on ${m.millDispatchDate}` : ''}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
