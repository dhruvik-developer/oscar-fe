import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError } from '../../accounts/accountingShared';
import { ColourChip } from '../../purchase/DyeingColourField';
import PurchaseTraceCard from './batch360/PurchaseTraceCard';
import { CostTab, DocumentsTab, HistoryTab, SalesTab } from './batch360/RecordTabs';
import { Card, Stat } from './batch360/shared';

const QUANTITIES = [
  ['received', 'Received'], ['available', 'Available'], ['reserved', 'Reserved'], ['qcHold', 'QC hold'],
  ['rework', 'Rework'], ['rejected', 'Rejected'], ['withJobWorker', 'At mill / job worker'], ['sold', 'Sold (net)'],
];

/**
 * What a batch QR opens: its whole life on one read-only page, from the PO to
 * the sale. It holds costing, so it needs a login, and cost shows only with
 * ledger access. All changes happen on the working screens, never here.
 */
export default function BatchAtoZPage() {
  const { code } = useParams();
  const [batch, setBatch] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    inventoryService.getBatch(code)
      .then((res) => { if (live) setBatch(res); })
      .catch((err) => { if (live) setError(describeApiError(err) || 'This batch could not be loaded.'); });
    return () => { live = false; };
  }, [code]);

  if (error) return <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>;
  if (!batch) return <div className="p-6 text-center text-xs text-slate-400">Loading…</div>;

  const q = batch.quantities || {};
  const uom = q.uom || 'm';
  const readOnly = { ...batch, permissions: {} };
  const facts = [
    ['Fabric', batch.item], ['Quality', batch.fabricQuality], ['Design', batch.design], ['HSN', batch.hsnCode],
    ['Vendor', batch.supplierName], ['PO', batch.poNumber], ['Source', batch.sourceDocumentNumber], ['Created', batch.createdOn],
    ['Made from', (batch.parentBatches || []).join(', ')], ['Used in', (batch.childBatches || []).join(', ')],
  ].filter(([, value]) => value);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <Card title={batch.batchCode} subtitle={`${batch.fabricTypeLabel || ''} · ${batch.status || ''}`} actions={<ColourChip name={batch.dyeingColourName} hex={batch.dyeingColourHex} />}>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
              <dd className="font-semibold text-slate-800 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <PurchaseTraceCard trace={batch.purchaseTrace} />
      <Card title="Quantity & stock">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {QUANTITIES.map(([key, label]) => <Stat key={key} label={label} value={q[key]} uom={uom} />)}
        </div>
      </Card>
      <HistoryTab batch={readOnly} />
      <SalesTab batch={readOnly} />
      <CostTab batch={readOnly} readOnly />
      <DocumentsTab batch={readOnly} />
    </div>
  );
}
