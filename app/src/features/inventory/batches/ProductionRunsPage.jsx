import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ClipboardCheck, Plus, X } from 'lucide-react';
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

const RUN_QC_FIELDS = [
  ['goodQty', 'Good', 'Goes to the godown below'],
  ['secondQualityQty', 'Second quality', ''],
  ['reprocessQty', 'Rework', ''],
  ['rejectedQty', 'Reject', ''],
  ['holdQty', 'Keep on hold', 'Decide later'],
];
const WASTAGE_UOMS = ['Kg', 'Meter', 'Cone'];

const sum = (rows, key) => rows.reduce((t, r) => t + (Number(r[key]) || 0), 0);
const parseRolls = (text) => text.split(/[\s,]+/).filter(Boolean);

function Field({ label, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="block font-semibold text-slate-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block mt-0.5 text-[10px] text-slate-400">{hint}</span>}
    </label>
  );
}

/** One numbered step of the run; turns green once it has entries. */
function Step({ n, title, subtitle, done, children }) {
  return (
    <section className={`rounded-xl border p-4 ${done ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-3 mb-3">
        <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${done ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
          {done ? <Check size={13} /> : n}
        </span>
        <div>
          <h4 className="text-[13px] font-bold text-slate-800">{title}</h4>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** Entries already saved for a step, with an optional total row. */
function Rows({ head, rows, total, empty }) {
  if (!rows.length) return <p className="text-[11px] text-slate-400 italic">{empty}</p>;
  const align = (j) => (head[j][1] === 'r' ? 'text-right tabular-nums' : 'text-left');
  return (
    <table className="w-full text-[11px]">
      <thead className="text-slate-400 uppercase text-[10px]">
        <tr>{head.map(([h], j) => <th key={h} className={`pb-1 font-semibold ${align(j)}`}>{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((cells, i) => (
          <tr key={i}>{cells.map((c, j) => <td key={j} className={`py-1.5 ${align(j)}`}>{c}</td>)}</tr>
        ))}
      </tbody>
      {total && (
        <tfoot>
          <tr className="border-t border-slate-200 font-bold">{total.map((c, j) => <td key={j} className={`pt-1.5 ${align(j)}`}>{c}</td>)}</tr>
        </tfoot>
      )}
    </table>
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
  const issues = run.issues || [];
  const runRolls = run.rolls || [];
  const expenses = run.expenses || [];

  const materialCost = sum(issues, 'amount');
  const expenseCost = sum(expenses, 'amount');
  const planned = Number(run.plannedQty) || 0;
  const produced = Number(run.producedQty) || sum(runRolls, 'meters');
  const waiting = Number(run.waitingQcQty) || 0;
  const progress = planned > 0 ? Math.min(100, (produced / planned) * 100) : 0;
  const rollPreview = parseRolls(rolls);
  const rollPreviewTotal = rollPreview.reduce((t, m) => t + (Number(m) || 0), 0);
  const qcTotal = RUN_QC_FIELDS.reduce((t, [k]) => t + (Number(qc[k]) || 0), 0);
  const completeBlocker = !runRolls.length ? 'Record at least one roll first.' : '';

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
  const btn = 'h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center gap-1.5';
  const uom = run.uom || 'm';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label={`Production run ${run.runNumber}`} className="w-full max-w-2xl h-full bg-slate-50 flex flex-col text-xs">
        <header className="bg-white border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-mono">{run.runNumber}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLE[run.status] || ''}`}>{run.status}</span>
              </div>
              <p className="text-slate-700 font-semibold truncate">{run.outputItem}</p>
              <p className="text-slate-400 text-[11px]">
                {run.customerName ? `For ${run.customerName}` : 'OSCAR stock'}
                {run.machine ? ` · ${run.machine}` : ''}
                {run.batchCode && <> · <Link to={`/inventory/batches/${encodeURIComponent(run.batchCode)}`} className="font-mono text-blue-700 hover:underline">{run.batchCode}</Link></>}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {[
              ['Planned', `${formatNumberIN(planned)} ${uom}`, ''],
              ['Produced', `${formatNumberIN(produced)} ${uom}`, ''],
              ['Awaiting QC', `${formatNumberIN(waiting)} ${uom}`, waiting > 0 ? 'text-amber-700' : ''],
              ['Cost so far', formatINR(materialCost + expenseCost), ''],
            ].map(([k, v, cls]) => (
              <div key={k} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <dt className="text-[10px] uppercase text-slate-400 font-semibold">{k}</dt>
                <dd className={`text-sm font-bold tabular-nums ${cls || 'text-slate-800'}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Produced against planned">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">{Math.round(progress)}% of the planned quantity produced</p>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}

          <Step n={1} title="Issue yarn / raw material" subtitle="Takes the material out of stock at its cost." done={issues.length > 0}>
            <Rows
              head={[['Material'], ['From'], ['Qty', 'r'], ['Value', 'r']]}
              rows={issues.map((i) => [<>{i.item}{i.customerSupplied && <span className="ml-1 text-[10px] text-slate-400">(customer)</span>}</>, i.location, formatNumberIN(i.quantity), formatINR(i.amount)])}
              total={issues.length > 1 ? ['Total', '', '', formatINR(materialCost)] : null}
              empty="No material issued yet."
            />
            {open && (
              <form onSubmit={(e) => { e.preventDefault(); act('issue', issue, () => setIssue({ itemId: '', locationId: '', quantity: '', customerSupplied: false })); }} className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-3 border-t border-slate-100">
                <Field label="Material *" className="col-span-2 sm:col-span-3">
                  <select required value={issue.itemId} onChange={(e) => setIssue({ ...issue, itemId: e.target.value })} className={inputCls}><option value="">Select yarn / material</option>{materials.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
                </Field>
                <Field label="From godown *" className="sm:col-span-2">
                  <select required value={issue.locationId} onChange={(e) => setIssue({ ...issue, locationId: e.target.value })} className={inputCls}><option value="">Select</option>{godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                </Field>
                <Field label="Quantity *">
                  <input required type="number" min="0.0001" step="any" value={issue.quantity} onChange={(e) => setIssue({ ...issue, quantity: e.target.value })} className={inputCls} />
                </Field>
                <label className="col-span-2 sm:col-span-4 inline-flex items-center gap-1.5 text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={issue.customerSupplied} onChange={(e) => setIssue({ ...issue, customerSupplied: e.target.checked })} /> Customer-supplied (no cost to OSCAR)
                </label>
                <button type="submit" disabled={busy} className={`${btn} col-span-2`}><Plus size={13} /> Issue</button>
              </form>
            )}
          </Step>

          <Step n={2} title="Record rolls produced" subtitle="Each roll gets its own taka ID and waits for QC." done={runRolls.length > 0}>
            <Rows
              head={[['Taka'], ['Status'], ['Metres', 'r']]}
              rows={runRolls.map((r) => [<span className="font-mono">{r.takaId}</span>, r.status, formatNumberIN(r.meters)])}
              total={runRolls.length > 1 ? [`${runRolls.length} rolls`, '', formatNumberIN(sum(runRolls, 'meters'))] : null}
              empty="No rolls recorded yet."
            />
            {open && (
              <form onSubmit={(e) => { e.preventDefault(); act('output', { rolls: rollPreview.map((m) => ({ meters: m })) }, () => setRolls('')); }} className="pt-3 border-t border-slate-100">
                <Field label="Metres of each roll *" hint={rollPreview.length ? `${rollPreview.length} roll${rollPreview.length > 1 ? 's' : ''} · ${formatNumberIN(rollPreviewTotal)} m` : 'Separate rolls with a comma or space.'}>
                  <div className="flex gap-2">
                    <input required value={rolls} onChange={(e) => setRolls(e.target.value)} placeholder="e.g. 102, 98.5, 110" className={inputCls} />
                    <button type="submit" disabled={busy || !rollPreview.length} className={`${btn} shrink-0`}><Plus size={13} /> Add rolls</button>
                  </div>
                </Field>
              </form>
            )}
          </Step>

          <Step n={3} title="Quality check" subtitle={waiting > 0 ? `${formatNumberIN(waiting)} ${uom} waiting for QC.` : 'Rolls show up here after you record them.'} done={runRolls.length > 0 && waiting === 0}>
            {waiting > 0 ? (
              <form onSubmit={(e) => { e.preventDefault(); act('qc', qc); }} className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {RUN_QC_FIELDS.map(([k, label, hint]) => (
                    <Field key={k} label={label} hint={hint}>
                      <input type="number" min="0" step="any" value={qc[k]} onChange={(e) => setQc({ ...qc, [k]: e.target.value })} className={inputCls} />
                    </Field>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                  <Field label="Good fabric goes to *">
                    <select required value={qc.locationId} onChange={(e) => setQc({ ...qc, locationId: e.target.value })} className={inputCls}><option value="">Select godown</option>{godowns.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
                  </Field>
                  <button type="submit" disabled={busy || qcTotal <= 0} className={btn}><ClipboardCheck size={13} /> Approve QC</button>
                </div>
                <p className={`text-[11px] ${qcTotal > waiting ? 'text-rose-600' : 'text-slate-500'}`}>
                  Entered {formatNumberIN(qcTotal)} of {formatNumberIN(waiting)} {uom}{qcTotal > waiting ? ' — more than is waiting.' : ''}
                </p>
              </form>
            ) : (
              <p className="text-[11px] text-slate-400 italic">{runRolls.length ? 'All rolls are checked.' : 'Nothing to check yet.'}</p>
            )}
          </Step>

          <Step n={4} title="Production expenses" subtitle="Labour, machine and other direct costs of this run." done={expenses.length > 0}>
            <Rows
              head={[['Type'], ['Remarks'], ['Amount', 'r']]}
              rows={expenses.map((x) => [x.costType, x.remarks || '—', formatINR(x.amount)])}
              total={expenses.length > 1 ? ['Total', '', formatINR(expenseCost)] : null}
              empty="No expenses added yet."
            />
            {!run.costsPosted && (
              <form onSubmit={(e) => { e.preventDefault(); act('expense', expense, () => setExpense({ ...expense, amount: '', remarks: '' })); }} className="grid grid-cols-2 sm:grid-cols-[1.3fr_1fr_1.3fr_auto] gap-2 items-end pt-3 border-t border-slate-100">
                <Field label="Type">
                  <select value={expense.costType} onChange={(e) => setExpense({ ...expense, costType: e.target.value })} className={inputCls}>{EXPENSE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                </Field>
                <Field label="Amount (₹) *">
                  <input required type="number" min="0.01" step="any" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Remarks" className="col-span-2 sm:col-span-1">
                  <input value={expense.remarks} onChange={(e) => setExpense({ ...expense, remarks: e.target.value })} className={inputCls} />
                </Field>
                <button type="submit" disabled={busy} className={`${btn} col-span-2 sm:col-span-1`}><Plus size={13} /> Add</button>
              </form>
            )}
          </Step>

          {open && (
            <Step n={5} title="Complete the run" subtitle="Books the material issued and the expenses as the batch's cost — once.">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 grid grid-cols-3 gap-2 text-[11px]">
                <div><span className="block text-slate-400">Material</span><span className="font-bold tabular-nums">{formatINR(materialCost)}</span></div>
                <div><span className="block text-slate-400">Expenses</span><span className="font-bold tabular-nums">{formatINR(expenseCost)}</span></div>
                <div><span className="block text-slate-400">Batch cost</span><span className="font-bold tabular-nums text-slate-900">{formatINR(materialCost + expenseCost)}</span></div>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); act('complete', wastage); }} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <Field label="Yarn wasted">
                  <input type="number" min="0" step="any" value={wastage.wastageQty} onChange={(e) => setWastage({ ...wastage, wastageQty: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Unit">
                  <select value={wastage.wastageUom} onChange={(e) => setWastage({ ...wastage, wastageUom: e.target.value })} className={inputCls}>{WASTAGE_UOMS.map((u) => <option key={u}>{u}</option>)}</select>
                </Field>
                <button type="submit" disabled={busy || !!completeBlocker} className="col-span-2 sm:col-span-1 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center gap-1.5">
                  <Check size={13} /> Complete run
                </button>
              </form>
              {completeBlocker && <p className="text-[11px] text-amber-700">{completeBlocker}</p>}
            </Step>
          )}
        </div>
      </aside>
    </div>
  );
}
