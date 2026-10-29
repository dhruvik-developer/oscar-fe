import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError } from '../../accounts/accountingShared';
import { printBatchTags } from './printBatchTag';
import OverviewTab from './batch360/OverviewTab';
import QcTab from './batch360/QcTab';
import ProductionTab from './batch360/ProductionTab';
import YarnTab from './batch360/YarnTab';
import DyeingTab from './batch360/DyeingTab';
import { CostTab, DocumentsTab, HistoryTab, SalesTab, StockTab } from './batch360/RecordTabs';

const STATUS_STYLE = {
  'In Stock': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'QC Hold': 'bg-amber-50 text-amber-700 border-amber-200',
  'At Job Worker': 'bg-violet-50 text-violet-700 border-violet-200',
  Blocked: 'bg-rose-50 text-rose-700 border-rose-200',
};

/**
 * Tabs of the Batch 360 screen; `count` shows how much each one holds.
 * `hidden` tabs are left out of the tab bar but still open from the
 * Overview actions (sell, send for dyeing ...); they show in the bar only
 * while open.
 */
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'stock', label: 'Quantity & Stock', hidden: true, count: (b) => (b.takas || []).filter((t) => Number(t.availableQuantity) > 0).length },
  { key: 'qc', label: 'QC', count: (b) => (b.qc?.results || []).length },
  { key: 'production', label: 'Daily Production', hidden: true, count: (b) => (b.productionRuns || []).length },
  { key: 'yarn', label: 'Yarn', hidden: true, count: (b) => (b.yarn?.issues || []).length + (b.yarn?.manual || []).length },
  { key: 'dyeing', label: 'Dyeing & Job Work', hidden: true, count: (b) => (b.jobWork || []).length },
  { key: 'sales', label: 'Sales', hidden: true, count: (b) => (b.sales || []).length },
  { key: 'cost', label: 'Cost & Profit', hidden: true },
  { key: 'documents', label: 'Documents', count: (b) => (b.documents || []).length },
  { key: 'history', label: 'History', count: (b) => (b.timeline || []).length },
];

/**
 * Batch 360° — what a batch QR tag or a click in the Batch Registry opens.
 * One tab per area; each tab shows what happened and lets a user with the
 * right permission do the next step by hand (QC, daily production, yarn,
 * dyeing, sale, rework, vendor return). Cost and profit come from the server
 * only for users who may see the ledger.
 */
export default function BatchTraceabilityPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Opened from the QC screen with ?returnRejected=1: straight to the vendor return.
  const autoReturn = searchParams.get('returnRejected') === '1';
  const tab = TABS.some((t) => t.key === searchParams.get('tab')) ? searchParams.get('tab') : (autoReturn ? 'qc' : 'overview');
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const goTo = (key) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    next.delete('returnRejected');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    inventoryService.getBatch(code)
      .then((res) => { if (alive) setBatch(res); })
      .catch((err) => { if (alive) { setBatch(null); setError(describeApiError(err) || 'The batch could not be loaded.'); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [code]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setBatch(await inventoryService.getBatch(batch.batchCode));
    } catch (err) {
      setError(describeApiError(err) || 'The batch could not be reloaded.');
    } finally {
      setRefreshing(false);
    }
  };

  const back = (
    <button type="button" onClick={() => navigate('/inventory/batches')} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer">
      <ArrowLeft size={14} /> Batch Registry
    </button>
  );

  if (loading) return <div className="p-10 text-center text-sm text-slate-400">Loading batch {code}…</div>;
  if (!batch) {
    return (
      <div className="space-y-4">
        <PageHeader title="Batch 360°" actions={back} />
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">{error || 'Batch not found.'}</div>
      </div>
    );
  }

  const props = { batch, onBatch: setBatch, goTo };
  return (
    <div className="space-y-4">
      <PageHeader
        title={batch.batchCode}
        subtitle={`${batch.item || 'Fabric'} · ${batch.fabricTypeLabel || 'Grey fabric'} · ${batch.origin} · created ${batch.createdOn}`}
        titleExtra={(
          <>
            <span className={`ml-2 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${STATUS_STYLE[batch.status] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>{batch.status}</span>
            <span className={`ml-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${batch.fabricType === 'DYED' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-stone-50 text-stone-700 border-stone-200'}`}>{batch.fabricType === 'DYED' ? 'Dyed' : 'Grey'}</span>
          </>
        )}
        actions={(
          <div className="flex flex-wrap gap-2">
            {back}
            <button type="button" onClick={refresh} disabled={refreshing} aria-label="Reload batch" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
            <button type="button" onClick={() => printBatchTags([batch]).catch((err) => setError(err.message))} className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
              <Printer size={14} /> Print Tag
            </button>
          </div>
        )}
      />
      {error && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}
      {(batch.hsnMissingFor || []).length > 0 && (
        <div role="alert" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          HSN is missing for {batch.hsnMissingFor.join(', ')}. Add it in the item master (Inventory → Inventory) —
          the batch, POs and invoices take HSN from there.
        </div>
      )}

      <nav className="bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto" aria-label="Batch sections">
        <div role="tablist" className="flex gap-1 min-w-max">
          {TABS.filter((t) => !t.hidden || t.key === tab).map((t) => {
            const n = t.count ? t.count(batch) : null;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => goTo(t.key)}
                className={`h-9 px-3 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t.label}
                {n > 0 && <span className={`px-1.5 rounded-full text-[10px] ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{n}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      <div role="tabpanel">
        {tab === 'overview' && <OverviewTab {...props} />}
        {tab === 'stock' && <StockTab {...props} />}
        {tab === 'qc' && <QcTab {...props} autoReturn={autoReturn} />}
        {tab === 'production' && <ProductionTab {...props} />}
        {tab === 'yarn' && <YarnTab {...props} />}
        {tab === 'dyeing' && <DyeingTab {...props} />}
        {tab === 'sales' && <SalesTab {...props} />}
        {tab === 'cost' && <CostTab {...props} />}
        {tab === 'documents' && <DocumentsTab {...props} />}
        {tab === 'history' && <HistoryTab {...props} />}
      </div>
    </div>
  );
}
