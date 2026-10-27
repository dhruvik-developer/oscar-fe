import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import AppPagination from '../../../components/ui/AppPagination';
import { useERP } from '../../../context/ERPContext';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatINR, formatNumberIN } from '../../accounts/accountingShared';

const inputCls = 'w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-blue-500';
const STATUS_STYLE = {
  Draft: 'bg-slate-100 text-slate-600',
  'In Progress': 'bg-blue-50 text-blue-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-rose-50 text-rose-700',
};
const EXPENSE_TYPES = ['Production labour', 'Machine / production expense', 'Other direct'];

/** In-house production: yarn issued in, fabric rolls out as one batch. */
export default function ProductionRunsPage() {
  const { items = [], locations = [], parties = [] } = useERP() || {};
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState({ results: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(null);
  const [open, setOpen] = useState(null); // selected run

  const fabrics = items.filter((i) => ['LOT', 'TAKA'].includes(String(i.trackingType || '').toUpperCase()) || i.itemKind === 'Fabric');
  const godowns = locations.filter((l) => !String(l.code || '').startsWith('SYS-'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getProductionRuns({ page, page_size: pageSize });
      setData({ results: res?.results || [], count: res?.count || 0 });
      setError('');
    } catch (err) {
      setError(describeApiError(err) || 'Production runs could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    try {
      const run = await inventoryService.createProductionRun(creating);
      setCreating(null);
      setOpen(run);
      load();
    } catch (err) {
      setError(describeApiError(err) || 'The run could not be created.');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Production Runs"
        subtitle="Make grey fabric in-house: issue yarn, record the rolls produced, QC them and book the cost to the batch. Agency production stays under PMS → Production Instructions."
        actions={(
          <button type="button" onClick={() => setCreating({ outputItemId: '', plannedQty: '', customerId: '', machine: '' })} className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
            <Plus size={14} /> New Run
          </button>
        )}
      />
      {error && <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>}

      {creating && (
        <form onSubmit={create} className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <label className="block lg:col-span-2"><span className="block font-semibold mb-1">Fabric to produce *</span>
            <select required value={creating.outputItemId} onChange={(e) => setCreating({ ...creating, outputItemId: e.target.value })} className={inputCls}>
              <option value="">Select fabric</option>
              {fabrics.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="block font-semibold mb-1">Planned qty (m) *</span>
            <input required type="number" min="0.01" step="any" value={creating.plannedQty} onChange={(e) => setCreating({ ...creating, plannedQty: e.target.value })} className={inputCls} />
          </label>
          <label className="block"><span className="block font-semibold mb-1">For customer (optional)</span>
            <select value={creating.customerId} onChange={(e) => setCreating({ ...creating, customerId: e.target.value })} className={inputCls}>
              <option value="">OSCAR stock</option>
              {parties.filter((p) => /customer/i.test(p.type || '')).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="block font-semibold mb-1">Machine / loom</span>
            <input value={creating.machine} onChange={(e) => setCreating({ ...creating, machine: e.target.value })} className={inputCls} />
          </label>
          <div className="sm:col-span-2 lg:col-span-5 flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(null)} className="h-9 px-3 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
            <button type="submit" className="h-9 px-4 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer">Create run</button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Run</th>
                <th className="px-3 py-2.5 text-left">Fabric</th>
                <th className="px-3 py-2.5 text-left">For</th>
                <th className="px-3 py-2.5 text-right">Planned</th>
                <th className="px-3 py-2.5 text-right">Produced</th>
                <th className="px-3 py-2.5 text-right">Awaiting QC</th>
                <th className="px-3 py-2.5 text-left">Batch</th>
                <th className="px-3 py-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">Loading…</td></tr>}
              {!loading && data.results.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">No production runs yet.</td></tr>}
              {!loading && data.results.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5"><button type="button" onClick={() => setOpen(r)} className="font-mono font-bold text-blue-700 hover:underline cursor-pointer">{r.runNumber}</button><div className="text-[10px] text-slate-400">{r.runDate}</div></td>
                  <td className="px-3 py-2.5 font-semibold">{r.outputItem}</td>
                  <td className="px-3 py-2.5">{r.customerName || 'OSCAR'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumberIN(r.plannedQty)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumberIN(r.producedQty)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumberIN(r.waitingQcQty)}</td>
                  <td className="px-3 py-2.5">{r.batchCode ? <Link to={`/inventory/batches/${encodeURIComponent(r.batchCode)}`} className="font-mono text-blue-700 hover:underline">{r.batchCode}</Link> : '—'}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLE[r.status] || ''}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AppPagination total={data.count} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} loading={loading} />
      </div>

      {open && (
        <RunDrawer
          run={open}
          items={items}
          godowns={godowns}
          onClose={() => setOpen(null)}
          onChange={(run) => { setOpen(run); load(); }}
        />
      )}
    </div>
  );
}

function RunDrawer({ run, items, godowns, onClose, onChange }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState({ itemId: '', locationId: '', quantity: '', customerSupplied: false });
  const [rolls, setRolls] = useState('');
  const [expense, setExpense] = useState({ costType: EXPENSE_TYPES[0], amount: '', remarks: '' });
  const [qc, setQc] = useState({ goodQty: '', secondQualityQty: '', reprocessQty: '', rejectedQty: '', holdQty: '', locationId: '' });
  const [wastage, setWastage] = useState({ wastageQty: '', wastageUom: 'Kg' });
  const open = run.status === 'Draft' || run.status === 'In Progress';
  const materials = items.filter((i) => String(i.id) !== String(run.outputItemId));

  const act = async (name, payload, reset) => {
    setBusy(true);
    setError('');
    try {
      const next = await inventoryService.productionRunAction(run.id, name, payload);
      reset?.();
      onChange(next);
    } catch (err) {
      setError(describeApiError(err) || 'That step could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  const section = 'border-t border-slate-100 pt-3 mt-3';
  const btn = 'h-9 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={`Production run ${run.runNumber}`} className="w-full max-w-xl h-full bg-white overflow-y-auto p-5 text-xs">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold">{run.runNumber} <span className="text-xs font-semibold text-slate-500">· {run.status}</span></h3>
            <p className="text-slate-500">{run.outputItem} · planned {formatNumberIN(run.plannedQty)} {run.uom}{run.customerName ? ` · for ${run.customerName}` : ''}</p>
            {run.batchCode && <Link to={`/inventory/batches/${encodeURIComponent(run.batchCode)}`} className="font-mono text-blue-700 hover:underline">Batch {run.batchCode}</Link>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
        </div>
        {error && <div role="alert" className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}

        <div className={section}>
          <h4 className="font-bold mb-2">1. Issue yarn / raw material</h4>
          {run.issues.map((i) => (
            <div key={i.id} className="flex justify-between text-slate-600"><span>{i.item} · {formatNumberIN(i.quantity)} from {i.location}{i.customerSupplied ? ' (customer-supplied)' : ''}</span><span className="font-mono">{formatINR(i.amount)}</span></div>
          ))}
          {open && (
            <form onSubmit={(e) => { e.preventDefault(); act('issue', issue, () => setIssue({ itemId: '', locationId: '', quantity: '', customerSupplied: false })); }} className="grid grid-cols-2 gap-2 mt-2">
              <select required value={issue.itemId} onChange={(e) => setIssue({ ...issue, itemId: e.target.value })} className={inputCls} aria-label="Material"><option value="">Material</option>{materials.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
              <select required value={issue.locationId} onChange={(e) => setIssue({ ...issue, locationId: e.target.value })} className={inputCls} aria-label="From location"><option value="">From godown</option>{godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              <input required type="number" min="0.0001" step="any" placeholder="Quantity" value={issue.quantity} onChange={(e) => setIssue({ ...issue, quantity: e.target.value })} className={inputCls} />
              <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={issue.customerSupplied} onChange={(e) => setIssue({ ...issue, customerSupplied: e.target.checked })} /> Customer-supplied</label>
              <button type="submit" disabled={busy} className={`${btn} col-span-2`}>Issue</button>
            </form>
          )}
        </div>

        <div className={section}>
          <h4 className="font-bold mb-2">2. Record rolls produced</h4>
          {run.rolls.map((r) => <div key={r.id} className="flex justify-between text-slate-600"><span className="font-mono">{r.takaId}</span><span>{formatNumberIN(r.meters)} m · {r.status}</span></div>)}
          {open && (
            <form onSubmit={(e) => { e.preventDefault(); act('output', { rolls: rolls.split(/[\s,]+/).filter(Boolean).map((m) => ({ meters: m })) }, () => setRolls('')); }} className="flex gap-2 mt-2">
              <input required value={rolls} onChange={(e) => setRolls(e.target.value)} placeholder="Metres per roll, e.g. 102, 98.5, 110" className={inputCls} aria-label="Metres per roll" />
              <button type="submit" disabled={busy} className={btn}>Add rolls</button>
            </form>
          )}
        </div>

        <div className={section}>
          <h4 className="font-bold mb-2">3. QC ({formatNumberIN(run.waitingQcQty)} m waiting)</h4>
          {Number(run.waitingQcQty) > 0 && (
            <form onSubmit={(e) => { e.preventDefault(); act('qc', qc); }} className="grid grid-cols-3 gap-2">
              {[['goodQty', 'Good'], ['secondQualityQty', 'Second'], ['reprocessQty', 'Rework'], ['rejectedQty', 'Reject'], ['holdQty', 'Hold']].map(([k, label]) => (
                <label key={k} className="block"><span className="block text-slate-500">{label}</span>
                  <input type="number" min="0" step="any" value={qc[k]} onChange={(e) => setQc({ ...qc, [k]: e.target.value })} className={inputCls} /></label>
              ))}
              <label className="block"><span className="block text-slate-500">Good goes to</span>
                <select required value={qc.locationId} onChange={(e) => setQc({ ...qc, locationId: e.target.value })} className={inputCls}><option value="">Godown</option>{godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
              <button type="submit" disabled={busy} className={`${btn} col-span-3`}>Approve QC</button>
            </form>
          )}
        </div>

        <div className={section}>
          <h4 className="font-bold mb-2">4. Production expenses</h4>
          {run.expenses.map((x) => <div key={x.id} className="flex justify-between text-slate-600"><span>{x.costType}{x.remarks ? ` — ${x.remarks}` : ''}</span><span className="font-mono">{formatINR(x.amount)}</span></div>)}
          {!run.costsPosted && (
            <form onSubmit={(e) => { e.preventDefault(); act('expense', expense, () => setExpense({ ...expense, amount: '', remarks: '' })); }} className="grid grid-cols-3 gap-2 mt-2">
              <select value={expense.costType} onChange={(e) => setExpense({ ...expense, costType: e.target.value })} className={inputCls} aria-label="Expense type">{EXPENSE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              <input required type="number" min="0.01" step="any" placeholder="Amount ₹" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} className={inputCls} />
              <input placeholder="Remarks" value={expense.remarks} onChange={(e) => setExpense({ ...expense, remarks: e.target.value })} className={inputCls} />
              <button type="submit" disabled={busy} className={`${btn} col-span-3`}>Add expense</button>
            </form>
          )}
        </div>

        {open && (
          <div className={section}>
            <h4 className="font-bold mb-2">5. Complete</h4>
            <p className="text-slate-500 mb-2">Completing books the issued material and expenses as the batch&apos;s cost (once).</p>
            <form onSubmit={(e) => { e.preventDefault(); act('complete', wastage); }} className="grid grid-cols-3 gap-2">
              <input type="number" min="0" step="any" placeholder="Wastage" value={wastage.wastageQty} onChange={(e) => setWastage({ ...wastage, wastageQty: e.target.value })} className={inputCls} aria-label="Wastage quantity" />
              <input value={wastage.wastageUom} onChange={(e) => setWastage({ ...wastage, wastageUom: e.target.value })} className={inputCls} aria-label="Wastage unit" />
              <button type="submit" disabled={busy || !run.rolls.length} className={btn}>Complete run</button>
            </form>
          </div>
        )}
      </aside>
    </div>
  );
}
