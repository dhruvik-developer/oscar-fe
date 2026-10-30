import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader';

/** QC type filter values. The backend filters on the record's real source:
 *  grey = goods receipts (and the reprocess raised from them); dyeing = job
 *  work inwards (fabric back from a dyeing / processing vendor, OSCAR- or
 *  customer-owned) and their reprocess; all = both, each record once. */
export const QC_STAGES = [
  { id: 'all', label: 'All', help: 'Grey fabric and dyeing QC together.' },
  { id: 'grey', label: 'Grey Fabric', help: 'Grey fabric inward: purchase / manual GRNs and their rework.' },
  { id: 'dyeing', label: 'Dyeing', help: 'Fabric back from a dyeing vendor — OSCAR or customer fabric — and its re-dyeing.' },
];
const STORE_KEY = 'oscar.qc.stage';

/** The QC type in the URL: 'grey' | 'dyeing' | 'all' (default). */
export function qcStageFromSearch(search) {
  const stage = new URLSearchParams(search || '').get('stage');
  return stage === 'grey' || stage === 'dyeing' ? stage : 'all';
}

function saveStage(stage) {
  try { window.sessionStorage.setItem(STORE_KEY, stage); } catch { /* per-tab convenience only */ }
}

/** [ All ] [ Grey Fabric ] [ Dyeing ] — changes the URL, so every QC request reloads with it. */
export function QcStageFilter() {
  const [params, setParams] = useSearchParams();
  const stage = qcStageFromSearch(`?${params.toString()}`);
  const choose = (id) => {
    const next = new URLSearchParams(params);
    if (id === 'all') next.delete('stage'); else next.set('stage', id);
    saveStage(id);
    setParams(next);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="QC type" className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
        {QC_STAGES.map((s) => {
          const selected = stage === s.id;
          return (
            <button key={s.id} type="button" role="radio" aria-checked={selected} onClick={() => choose(s.id)} title={s.help}
              className={`h-8 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${selected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-white'}`}>
              {s.label}
            </button>
          );
        })}
      </div>
      <span className="text-[11px] text-slate-500">{QC_STAGES.find((s) => s.id === stage).help}</span>
    </div>
  );
}

/** One header for every QC page (Batch Registry style) with the QC type filter under the title. */
export function QcPageHeader({ title, subtitle }) {
  return (
    <div className="min-w-0 space-y-2">
      <PageHeader title={title} subtitle={subtitle} />
      <QcStageFilter />
    </div>
  );
}

/**
 * Wraps each QC page. The QC type lives in the URL (`?stage=`) and the
 * service adds it to every QC request; a sidebar link without it reopens the
 * type last picked in this tab. Keyed on the type so a change reloads the
 * page's data, KPIs and pagination.
 */
export default function QcStageGate({ inner: Component, ...rest }) {
  const [params, setParams] = useSearchParams();
  const urlStage = params.get('stage');
  useEffect(() => {
    if (urlStage) {
      saveStage(qcStageFromSearch(`?stage=${urlStage}`));
      return;
    }
    let saved = null;
    try { saved = window.sessionStorage.getItem(STORE_KEY); } catch { saved = null; }
    if (saved === 'grey' || saved === 'dyeing') {
      const next = new URLSearchParams(params);
      next.set('stage', saved);
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStage]);
  const stage = qcStageFromSearch(`?${params.toString()}`);
  return <Component key={stage} {...rest} />;
}
