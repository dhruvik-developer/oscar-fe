import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { PageHeader } from '../../components/common/PageHeader';
import AppPagination from '../../components/ui/AppPagination';
import { api } from '../../services/api';
import { inventoryService } from '../../services/domainServices';
import { describeApiError, formatNumberIN } from '../accounts/accountingShared';
import { Modal, ModalButtons } from './warehouses/WarehousesPage';

const transfersGuide = {
  title: 'Inter-Warehouse Stock Transfers',
  subtitle: 'Move stock between warehouses, taka by taka, without changing the company total.',
  purpose: 'Requesting reserves the takas at the source. Dispatch moves them into Goods In Transit; receipt moves them into the destination. Partial dispatch and partial receipt are allowed; whatever never arrives is returned to the source or written off when the transfer is completed.',
  keyTerms: [
    { term: 'Reserved', definition: 'Held for this transfer at the source; it cannot be sold or sent elsewhere.' },
    { term: 'In transit', definition: 'Dispatched from the source, not yet received. Counted in neither warehouse.' },
    { term: 'Discrepancy', definition: 'Dispatched but not received; settled on completion by returning it to the source or writing it off.' },
  ],
  tips: ['The batch, QR and ownership of every taka stay the same through the transfer.'],
  workflow: ['Draft', 'Requested (reserved)', 'Approved', 'In Transit', 'Received', 'Completed'],
};

const STATUSES = ['', 'Draft', 'Requested', 'Approved', 'In Transit', 'Partially Received', 'Received', 'Completed', 'Cancelled'];
const n = (v) => formatNumberIN(v || 0);
const emptyLine = () => ({ key: `${Date.now()}-${Math.random()}`, itemId: '', qty: '', takas: {} });

export const TransfersPage = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    inventoryService.getWarehouses().then((r) => setWarehouses(r?.results || [])).catch(() => setWarehouses([]));
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await inventoryService.getTransfers({ status: status || undefined, search: search || undefined, page, page_size: pageSize });
      setRows(res?.results || res?.data || (Array.isArray(res) ? res : []));
      setCount(res?.count ?? res?.meta?.total ?? (res?.results || []).length);
    } catch (err) {
      setError(describeApiError(err) || 'Transfers could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [status, search, page, pageSize]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4 text-xs">
      <PageHeader title="Stock Transfers" subtitle="Inter-warehouse transfers: reserve, approve, dispatch, receive and complete." guide={transfersGuide}
        actions={<button type="button" onClick={() => setCreating(true)} className="h-9 px-3 rounded-lg bg-blue-600 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"><Plus size={14} /> New transfer</button>} />
      <div className="flex flex-wrap gap-2 items-center">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 px-2 rounded-lg border border-slate-200 bg-white" aria-label="Status">
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search transfer # / notes / sales order" className="h-9 px-2.5 rounded-lg border border-slate-200 w-64" aria-label="Search" />
      </div>
      {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px]">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr><th className="text-left p-2">Transfer #</th><th className="text-left p-2">From</th><th className="text-left p-2">To</th><th className="text-left p-2">Date</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Dispatched</th><th className="text-right p-2">Received</th><th className="text-left p-2">For</th><th className="text-left p-2">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={9} className="p-6 text-center text-slate-400">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-400">No transfers.</td></tr>}
            {!loading && rows.map((t) => {
              const sum = (k) => (t.lines || []).reduce((s, l) => s + Number(l[k] || 0), 0);
              return (
                <tr key={t.id} onClick={() => setOpenId(t.id)} className="hover:bg-slate-50 cursor-pointer">
                  <td className="p-2 font-mono font-bold text-blue-700">{t.transfer_number}</td>
                  <td className="p-2">{t.sourceLocation}</td>
                  <td className="p-2 font-semibold">{t.destLocation}</td>
                  <td className="p-2">{t.date}</td>
                  <td className="p-2 text-right tabular-nums">{n(sum('qty'))}</td>
                  <td className="p-2 text-right tabular-nums">{n(sum('dispatchedQty'))}</td>
                  <td className="p-2 text-right tabular-nums">{n(sum('receivedQty'))}</td>
                  <td className="p-2">{t.reference_number || '—'}</td>
                  <td className="p-2"><StatusBadge status={t.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AppPagination total={count} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[10, 25, 50, 100]} loading={loading} />
      {creating && <CreateTransfer warehouses={warehouses} onClose={() => setCreating(false)} onDone={(t) => { setCreating(false); load(); setOpenId(t.id); }} />}
      {openId && <TransferDetail id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
};

function CreateTransfer({ warehouses, onClose, onDone }) {
  const { items = [] } = useERP() || {};
  const [source, setSource] = useState('');
  const [dest, setDest] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [takas, setTakas] = useState([]);
  const [loadingTakas, setLoadingTakas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!source) { setTakas([]); return undefined; }
    let alive = true;
    setLoadingTakas(true);
    api.get('/inventory/lot-register/', { query: { location_id: source, available_only: 'true', page_size: 500 } })
      .then((res) => alive && setTakas(Array.isArray(res?.records) ? res.records : []))
      .catch(() => alive && setTakas([]))
      .finally(() => alive && setLoadingTakas(false));
    return () => { alive = false; };
  }, [source]);
  const byItem = useMemo(() => {
    const map = {};
    takas.filter((t) => ['Available', 'Active'].includes(t.status || 'Available')).forEach((t) => { (map[t.itemId] ||= []).push(t); });
    return map;
  }, [takas]);
  const update = (key, patch) => setLines((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const lineQty = (l) => {
    const picked = Object.values(l.takas);
    return picked.length ? picked.reduce((s, q) => s + (Number(q) || 0), 0) : Number(l.qty) || 0;
  };

  const submit = async (asDraft) => {
    setError('');
    if (!source || !dest || source === dest) { setError('Choose two different warehouses.'); return; }
    const payload = lines.filter((l) => l.itemId).map((l) => ({
      itemId: l.itemId, qty: lineQty(l),
      takas: Object.entries(l.takas).map(([lotTakaId, qty]) => ({ lotTakaId, qty: Number(qty) || 0 })),
    }));
    if (!payload.length || payload.some((l) => l.qty <= 0)) { setError('Add at least one item with a quantity (or select its takas).'); return; }
    setSaving(true);
    try {
      const t = await inventoryService.createTransfer({
        sourceLocationId: source, destLocationId: dest, date: new Date().toISOString().slice(0, 10),
        notes: notes || undefined, items: payload, asDraft,
      });
      onDone(t);
    } catch (err) {
      setError(describeApiError(err) || 'The transfer could not be saved.');
      setSaving(false);
    }
  };

  const whSelect = (value, onChange, exclude, label) => (
    <select required value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white" aria-label={label}>
      <option value="">Select warehouse</option>
      {warehouses.filter((w) => w.id !== exclude).map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
    </select>
  );

  return (
    <Modal title="New stock transfer" onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block"><span className="block font-semibold mb-1">From warehouse *</span>{whSelect(source, (v) => { setSource(v); setLines([emptyLine()]); }, null, 'From warehouse')}</label>
          <label className="block"><span className="block font-semibold mb-1">To warehouse *</span>{whSelect(dest, setDest, source, 'To warehouse')}</label>
          <label className="block"><span className="block font-semibold mb-1">Notes</span><input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-slate-200" /></label>
        </div>
        {!source && <p className="text-slate-500">Choose the source warehouse to see its free takas.</p>}
        {lines.map((line) => {
          const list = byItem[line.itemId] || [];
          const picked = Object.keys(line.takas).length > 0;
          return (
            <div key={line.key} className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_32px] gap-2 items-end">
                <label className="block"><span className="block text-slate-600 mb-1">Item *</span>
                  <select value={line.itemId} onChange={(e) => update(line.key, { itemId: e.target.value, takas: {}, qty: '' })} className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white">
                    <option value="">Select item</option>
                    {items.filter((i) => i.itemKind !== 'Service').map((i) => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
                  </select></label>
                <label className="block"><span className="block text-slate-600 mb-1">Quantity</span>
                  <input type="number" min="0" step="any" value={picked ? lineQty(line) : line.qty} disabled={picked} onChange={(e) => update(line.key, { qty: e.target.value })} className="w-full h-9 px-2 rounded-lg border border-slate-200 disabled:bg-slate-50 tabular-nums" /></label>
                <button type="button" onClick={() => setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== line.key) : p))} className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer" aria-label="Remove line"><Trash2 size={14} /></button>
              </div>
              {line.itemId && (loadingTakas ? <p className="text-slate-500">Loading takas…</p> : list.length === 0 ? (
                <p className="text-slate-500">No free takas of this item at the source; an untracked item moves by quantity.</p>
              ) : (
                <table className="w-full text-[11px]">
                  <thead className="text-slate-400"><tr><th className="text-left p-1">Move</th><th className="text-left p-1">Taka</th><th className="text-left p-1">Batch</th><th className="text-right p-1">Free</th><th className="text-right p-1">Qty to move</th></tr></thead>
                  <tbody>
                    {list.map((t) => {
                      const sel = line.takas[t.id] !== undefined;
                      return (
                        <tr key={t.id} className="border-t border-slate-100">
                          <td className="p-1"><input type="checkbox" checked={sel} aria-label={`Move ${t.takaId}`} onChange={() => {
                            const next = { ...line.takas };
                            if (sel) delete next[t.id]; else next[t.id] = String(t.availableQty);
                            update(line.key, { takas: next });
                          }} /></td>
                          <td className="p-1 font-mono">{t.takaId || '—'}</td>
                          <td className="p-1 font-mono">{t.batchCode || t.lotNo}</td>
                          <td className="p-1 text-right tabular-nums">{n(t.availableQty)} {t.uom || ''}</td>
                          <td className="p-1 text-right"><input type="number" min="0" max={t.availableQty} step="any" disabled={!sel} value={sel ? line.takas[t.id] : ''} aria-label={`Quantity of ${t.takaId}`} onChange={(e) => update(line.key, { takas: { ...line.takas, [t.id]: e.target.value } })} className="w-24 h-7 px-1 rounded border border-slate-200 text-right disabled:bg-slate-50" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ))}
            </div>
          );
        })}
        <button type="button" onClick={() => setLines((p) => [...p, emptyLine()])} className="font-semibold text-blue-700 inline-flex items-center gap-1 cursor-pointer"><Plus size={12} /> Add item</button>
        {error && <div role="alert" className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 px-3 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
          <button type="button" onClick={() => submit(true)} disabled={saving} className="h-9 px-3 rounded-lg border border-slate-300 font-semibold cursor-pointer disabled:opacity-60">Save as draft</button>
          <button type="submit" disabled={saving} className="h-9 px-4 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 cursor-pointer">{saving ? 'Saving…' : 'Request transfer (reserve stock)'}</button>
        </div>
      </form>
    </Modal>
  );
}

function TransferDetail({ id, onClose, onChanged }) {
  const [t, setT] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(null); // dispatch | receive | complete
  const [qtys, setQtys] = useState({});
  const [settle, setSettle] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => inventoryService.getTransfer(id).then(setT).catch((err) => setError(describeApiError(err) || 'Could not load the transfer.')), [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (action, data = {}) => {
    setBusy(true);
    setError('');
    try {
      const next = action === 'delete' ? null : await inventoryService.transferAction(id, action, data);
      if (action === 'delete') { await inventoryService.deleteTransfer(id); onChanged(); onClose(); return; }
      setT(next);
      setMode(null);
      onChanged();
    } catch (err) {
      setError(describeApiError(err) || 'That could not be done.');
    } finally {
      setBusy(false);
    }
  };
  const startMode = (m) => {
    const init = {};
    (t.lines || []).forEach((l) => { init[l.id] = String(m === 'dispatch' ? l.pendingDispatchQty : l.inTransitQty); });
    setQtys(init);
    setSettle({});
    setMode(m);
  };
  const submitMode = (e) => {
    e.preventDefault();
    if (mode === 'complete') {
      run('complete', { settlements: Object.entries(settle).map(([lineId, s]) => ({ lineId, ...s })) });
      return;
    }
    const lines = Object.entries(qtys).filter(([, q]) => Number(q) > 0).map(([lineId, qty]) => ({ lineId, qty }));
    if (!lines.length) { setError('Enter a quantity on at least one line.'); return; }
    run(mode === 'dispatch' ? 'dispatch' : 'receive', { lines });
  };

  if (!t) return <Modal title="Transfer" onClose={onClose}>{error ? <div role="alert" className="text-rose-700">{error}</div> : <p className="text-slate-400">Loading…</p>}</Modal>;
  const lines = t.lines || [];
  const waiting = lines.filter((l) => Number(l.inTransitQty) > 0);
  const canDispatch = ['Approved', 'In Transit', 'Partially Received'].includes(t.status) && lines.some((l) => Number(l.pendingDispatchQty) > 0);
  const canReceive = ['In Transit', 'Partially Received'].includes(t.status) && waiting.length > 0;
  const canComplete = ['Received', 'Partially Received'].includes(t.status);
  const canCancel = ['Draft', 'Requested', 'Approved', 'In Transit'].includes(t.status) && !lines.some((l) => Number(l.receivedQty) > 0);
  const btn = 'h-9 px-3 rounded-lg font-semibold cursor-pointer disabled:opacity-60';

  return (
    <Modal title={`Transfer ${t.transfer_number}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={t.status} />
          <span className="font-semibold">{t.sourceLocation} → {t.destLocation}</span>
          <span className="text-slate-500">{t.date}{t.reference_number ? ` · for ${t.reference_number}` : ''}</span>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          {[['Requested by', t.requestedBy], ['Approved by', t.approvedBy], ['Shipped by', t.shipped_by], ['Received by', t.receivedBy]].map(([k, v]) => (
            <div key={k}><dt className="text-[10px] uppercase text-slate-400">{k}</dt><dd className="font-semibold">{v || '—'}</dd></div>
          ))}
        </dl>
        {t.notes && <p className="text-slate-600">{t.notes}</p>}
        <form onSubmit={submitMode}>
          <table className="w-full">
            <thead className="text-[10px] uppercase text-slate-400">
              <tr><th className="text-left py-1">Item</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Dispatched</th><th className="text-right py-1">In transit</th><th className="text-right py-1">Received</th><th className="text-left py-1 pl-3">Takas / discrepancy</th>{mode && <th className="text-right py-1">{mode === 'complete' ? 'Settle' : mode === 'dispatch' ? 'Dispatch now' : 'Receive now'}</th>}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="py-2 font-semibold">{l.name}<div className="text-[10px] text-slate-400 font-mono">{l.sku}</div></td>
                  <td className="py-2 text-right tabular-nums">{n(l.qty)} {l.uom}</td>
                  <td className="py-2 text-right tabular-nums">{n(l.dispatchedQty)}</td>
                  <td className="py-2 text-right tabular-nums">{n(l.inTransitQty)}</td>
                  <td className="py-2 text-right tabular-nums">{n(l.receivedQty)}</td>
                  <td className="py-2 pl-3 text-[11px] text-slate-600">
                    {(l.takas || []).map((r) => <div key={r.lotTakaId} className="font-mono">{r.takaId || r.lotTakaId.slice(0, 8)} {r.batchCode ? `· ${r.batchCode}` : ''} · {n(r.qty)}{Number(r.dispatched) ? ` (sent ${n(r.dispatched)})` : ''}</div>)}
                    {Number(l.discrepancyQty) > 0 && <div className="text-amber-700 font-semibold">{n(l.discrepancyQty)} {l.discrepancyAction === 'WRITTEN_OFF' ? 'written off' : 'returned to source'}: {l.discrepancyReason}</div>}
                  </td>
                  {mode && mode !== 'complete' && (
                    <td className="py-2 text-right">
                      <input type="number" min="0" step="any" max={mode === 'dispatch' ? l.pendingDispatchQty : l.inTransitQty} aria-label={`Quantity for ${l.name}`}
                        value={qtys[l.id] ?? ''} onChange={(e) => setQtys({ ...qtys, [l.id]: e.target.value })} className="w-24 h-8 px-2 rounded-md border border-slate-200 text-right" />
                    </td>
                  )}
                  {mode === 'complete' && (
                    <td className="py-2 text-right">
                      {Number(l.inTransitQty) > 0 ? (
                        <div className="space-y-1">
                          <select required value={settle[l.id]?.action || ''} onChange={(e) => setSettle({ ...settle, [l.id]: { ...settle[l.id], action: e.target.value } })} className="h-8 px-1 rounded-md border border-slate-200" aria-label={`Settle ${l.name}`}>
                            <option value="">{n(l.inTransitQty)} not received…</option>
                            <option value="RETURN">Return to source</option>
                            <option value="WRITE_OFF">Write off (transit loss)</option>
                          </select>
                          <input required placeholder="Reason" value={settle[l.id]?.reason || ''} onChange={(e) => setSettle({ ...settle, [l.id]: { ...settle[l.id], reason: e.target.value } })} className="block w-44 h-8 px-2 rounded-md border border-slate-200" aria-label={`Reason for ${l.name}`} />
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {mode === 'complete' && <p className="mt-2 text-slate-500">Undispatched quantity is released back to free stock at the source.</p>}
          {error && <div role="alert" className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
          {mode && <ModalButtons saving={busy} onClose={() => setMode(null)} label={mode === 'dispatch' ? 'Dispatch' : mode === 'receive' ? 'Record receipt' : 'Complete transfer'} />}
        </form>
        {!mode && (
          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200">
            {t.status === 'Draft' && <button type="button" disabled={busy} onClick={() => run('delete')} className={`${btn} border border-rose-200 text-rose-700`}>Delete draft</button>}
            {canCancel && t.status !== 'Draft' && <button type="button" disabled={busy} onClick={() => run('cancel', { reason: 'Cancelled by user' })} className={`${btn} border border-rose-200 text-rose-700`}>Cancel transfer</button>}
            {t.status === 'Draft' && <button type="button" disabled={busy} onClick={() => run('request')} className={`${btn} bg-blue-600 text-white`}>Request (reserve stock)</button>}
            {t.status === 'Requested' && <button type="button" disabled={busy} onClick={() => run('approve')} className={`${btn} bg-blue-600 text-white`}>Approve</button>}
            {canDispatch && <button type="button" disabled={busy} onClick={() => startMode('dispatch')} className={`${btn} bg-blue-600 text-white`}>Dispatch…</button>}
            {canReceive && <button type="button" disabled={busy} onClick={() => startMode('receive')} className={`${btn} bg-emerald-600 text-white`}>Receive…</button>}
            {canComplete && <button type="button" disabled={busy} onClick={() => (waiting.length ? startMode('complete') : run('complete'))} className={`${btn} border border-slate-300`}>Complete</button>}
          </div>
        )}
      </div>
    </Modal>
  );
}
