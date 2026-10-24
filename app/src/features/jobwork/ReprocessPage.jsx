import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { numIN, toDDMMYYYY, purgeLegacyJobWorkCache } from './jobWorkOrdersStore';
import { fetchJWOs, createJWORow, updateJWORow, deleteJWORow, errorMessage } from '../../services/jobWorkSync';
import PageHeader from '../../components/ui/PageHeader';
import TablePagination from '../../components/ui/TablePagination';
import KpiCard from '../../components/ui/KpiCard';

/**
 * Reprocess — material received from a vendor and sent back for
 * reprocessing or correction.
 *
 * Each record lives nested under its Job Work Order (``reprocesses``,
 * same pattern as outwards/inwards) and links to its Original Inward
 * receipt by number. The Received Qty shown is resolved LIVE from that
 * inward receipt — never stored — so editing the receipt updates every
 * linked reprocess row automatically. Reprocess Qty is validated against
 * the receipt's remaining quantity (received − already reprocessed).
 */

const REPROCESS_STATUSES = ['Pending', 'Sent to Vendor', 'In Process', 'Received', 'Completed', 'Cancelled'];

const REASON_SUGGESTIONS = [
  'Shade mismatch',
  'Print defect',
  'Colour variation',
  'Finishing issue',
  'Shade uneven',
  'Print alignment',
  'Colour shade',
  'Surface defect',
  'Stain marks',
  'GSM variation',
  'Width variation',
  'Shrinkage issue',
];

const statusPill = (s) =>
  s === 'Completed' || s === 'Received'
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
    : s === 'In Process'
      ? 'bg-blue-50 text-blue-600 border-blue-200'
      : s === 'Cancelled'
        ? 'bg-rose-50 text-rose-500 border-rose-200'
        : s === 'Sent to Vendor'
          ? 'bg-orange-50 text-orange-600 border-orange-200'
          : 'bg-amber-50 text-amber-600 border-amber-200';

/** Flatten every JWO's reprocesses into cross-JWO rows (same records as JWO detail). */
function flattenReprocesses(orders) {
  const rows = [];
  (orders || []).forEach((o) => {
    const mat = (o.materials || [])[0] || {};
    const inwardByNo = new Map((o.inwards || []).map((w) => [String(w.no), w]));
    (o.reprocesses || []).forEach((r) => {
      const inward = inwardByNo.get(String(r.inwardNo)) || {};
      rows.push({
        ...r,
        jwoId: o.id,
        jwoNo: o.jwoNo,
        vendor: o.vendor,
        process: o.process,
        fabricItem: mat.fabricItem || '',
        fabricQuality: mat.fabricQuality || '',
        shade: mat.shade || '',
        receivedQty: Number(inward.qty) || 0,
      });
    });
  });
  return rows;
}

/** Remaining quantity of an inward receipt available for reprocessing. */
export function inwardRemaining(order, inwardNo, excludeId = null) {
  const inward = (order?.inwards || []).find((w) => String(w.no) === String(inwardNo));
  const received = Number(inward?.qty) || 0;
  const used = (order?.reprocesses || [])
    .filter((r) => String(r.inwardNo) === String(inwardNo) && String(r.id) !== String(excludeId))
    .reduce((s, r) => s + (Number(r.qty) || 0), 0);
  return Math.max(0, received - used);
}

export default function ReprocessPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Draft filters (edited in the controls) + applied filters (used by the table).
  const [draft, setDraft] = useState({ rpNo: 'All', jwoNo: 'All', vendor: 'All', process: 'All', fabric: 'All', status: 'All', from: '', to: '' });
  const [applied, setApplied] = useState(draft);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    jwoId: '',
    inwardNo: '',
    date: new Date().toISOString().slice(0, 10),
    qty: '',
    reason: '',
    expectedReturn: '',
    status: 'Pending',
    remarks: '',
  });

  const reload = async () => setOrders(await fetchJWOs());

  useEffect(() => {
    let live = true;
    purgeLegacyJobWorkCache();
    fetchJWOs()
      .then((rows) => { if (live) setOrders(rows); })
      .catch((err) => { if (live) setLoadError(errorMessage(err, 'Could not load reprocess records.')); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const rows = useMemo(() => flattenReprocesses(orders), [orders]);

  const rpNos = useMemo(() => ['All', ...new Set(rows.map((r) => r.no).filter(Boolean))], [rows]);
  const jwoNos = useMemo(() => ['All', ...new Set(rows.map((r) => r.jwoNo).filter(Boolean))], [rows]);
  const vendors = useMemo(() => ['All', ...new Set(rows.map((r) => r.vendor).filter(Boolean))], [rows]);
  const processes = useMemo(() => ['All', ...new Set(rows.map((r) => r.process).filter(Boolean))], [rows]);
  const fabrics = useMemo(() => ['All', ...new Set(rows.map((r) => r.fabricItem).filter(Boolean))], [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (applied.rpNo !== 'All' && r.no !== applied.rpNo) return false;
    if (applied.jwoNo !== 'All' && r.jwoNo !== applied.jwoNo) return false;
    if (applied.vendor !== 'All' && r.vendor !== applied.vendor) return false;
    if (applied.process !== 'All' && r.process !== applied.process) return false;
    if (applied.fabric !== 'All' && r.fabricItem !== applied.fabric) return false;
    if (applied.status !== 'All' && r.status !== applied.status) return false;
    if (applied.from && (r.date || '') < applied.from) return false;
    if (applied.to && (r.date || '') > applied.to) return false;
    return true;
  }), [rows, applied]);

  useEffect(() => {
    setPage(1);
  }, [applied]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const totals = useMemo(() => {
    const t = { count: 0, qty: 0, received: 0, inProcess: 0, pending: 0, completed: 0 };
    filtered.forEach((r) => {
      const q = Number(r.qty) || 0;
      t.count += 1;
      t.qty += q;
      if (r.status === 'Received') t.received += q;
      else if (r.status === 'In Process') t.inProcess += q;
      else if (r.status === 'Completed') t.completed += q;
      else if (r.status === 'Pending' || r.status === 'Sent to Vendor') t.pending += q;
    });
    return t;
  }, [filtered]);

  const summaryCards = [
    { icon: FileText, label: 'Total Reprocess', value: `${totals.count}`, suffix: '', tone: 'purple' },
    { icon: Truck, label: 'Total Reprocess Quantity', value: numIN(totals.qty), suffix: 'M', tone: 'blue' },
    { icon: CheckCircle2, label: 'Received from Reprocess', value: numIN(totals.received), suffix: 'M', tone: 'emerald' },
    { icon: Clock, label: 'In Process Quantity', value: numIN(totals.inProcess), suffix: 'M', tone: 'amber' },
    { icon: XCircle, label: 'Pending Quantity', value: numIN(totals.pending), suffix: 'M', tone: 'rose' },
    { icon: CheckCircle2, label: 'Completed Quantity', value: numIN(totals.completed), suffix: 'M', tone: 'teal' },
  ];

  const resetFilters = () => {
    const cleared = { rpNo: 'All', jwoNo: 'All', vendor: 'All', process: 'All', fabric: 'All', status: 'All', from: '', to: '' };
    setDraft(cleared);
    setApplied(cleared);
  };

  // ── form helpers ──
  const selectedJWO = useMemo(
    () => orders.find((o) => String(o.id) === String(form.jwoId)),
    [orders, form.jwoId],
  );
  const selectedMat = (selectedJWO?.materials || [])[0] || {};
  const selectedInward = useMemo(
    () => (selectedJWO?.inwards || []).find((w) => String(w.no) === String(form.inwardNo)),
    [selectedJWO, form.inwardNo],
  );
  const remaining = selectedJWO && form.inwardNo
    ? inwardRemaining(selectedJWO, form.inwardNo, editing?.id)
    : 0;

  const openCreate = () => {
    setEditing(null);
    setForm({
      jwoId: '',
      inwardNo: '',
      date: new Date().toISOString().slice(0, 10),
      qty: '',
      reason: '',
      expectedReturn: '',
      status: 'Pending',
      remarks: '',
    });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      jwoId: r.jwoId,
      inwardNo: r.inwardNo || '',
      date: r.date || new Date().toISOString().slice(0, 10),
      qty: String(r.qty ?? ''),
      reason: r.reason || '',
      expectedReturn: r.expectedReturn || '',
      status: r.status || 'Pending',
      remarks: r.remarks || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.jwoId) { setFormError('Select a Job Work Order first.'); return; }
    if (!form.inwardNo) { setFormError('Select the Original Inward receipt first.'); return; }
    const qty = Number(form.qty);
    if (!(qty > 0)) { setFormError('Reprocess quantity must be greater than 0.'); return; }
    const parent = orders.find((o) => String(o.id) === String(form.jwoId));
    if (!parent) { setFormError('Selected JWO no longer exists.'); return; }
    const allow = inwardRemaining(parent, form.inwardNo, editing?.id);
    if (qty > allow) {
      setFormError(`Only ${allow.toLocaleString('en-IN')} M remains available on ${form.inwardNo} (received ${numIN(Number(selectedInward?.qty) || 0)} M).`);
      return;
    }
    if (!form.reason.trim()) { setFormError('Enter the reason for reprocessing.'); return; }
    // The server allocates the reprocess number.
    const entry = {
      inwardNo: form.inwardNo,
      date: form.date,
      qty,
      reason: form.reason.trim(),
      expectedReturn: form.expectedReturn || '',
      status: form.status,
      remarks: form.remarks || '',
    };
    setSaving(true);
    try {
      if (editing && String(editing.jwoId) === String(parent.id)) {
        await updateJWORow(parent.id, 'reprocesses', editing.id, entry);
      } else {
        if (editing) await deleteJWORow(editing.jwoId, 'reprocesses', editing.id);
        await createJWORow(parent.id, 'reprocesses', entry);
      }
      await reload();
      setShowForm(false);
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the reprocess record.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete reprocess ${r.no}?`)) return;
    try {
      await deleteJWORow(r.jwoId, 'reprocesses', r.id);
      await reload();
    } catch (err) {
      window.alert(errorMessage(err, 'Could not delete the reprocess record.'));
    }
  };

  const openJWO = (r) => navigate(`/job-work/orders/${r.jwoId}`);

  const selectCls = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-700 outline-none';
  const labelCls = 'text-[11px] font-semibold text-slate-400';
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      <PageHeader
        title="Reprocess"
        subtitle="Manage material sent back for reprocessing or correction."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
          >
            <Plus size={14} /> New Reprocess
          </button>
        }
      />

      {/* Summary cards — all derived from the rows below */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {summaryCards.map((c) => (
          <KpiCard
            key={c.label}
            label={c.label}
            value={c.value}
            unit={c.suffix}
            icon={c.icon}
            tone={c.tone}
          />
        ))}
      </div>

      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 md:grid-cols-4 xl:grid-cols-6">
          <label className="block">
            <span className={labelCls}>Reprocess No.</span>
            <select value={draft.rpNo} onChange={set('rpNo')} className={selectCls}>
              {rpNos.map((v) => <option key={v} value={v}>{v === 'All' ? 'All' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>JWO No.</span>
            <select value={draft.jwoNo} onChange={set('jwoNo')} className={selectCls}>
              {jwoNos.map((v) => <option key={v} value={v}>{v === 'All' ? 'All JWO' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Vendor / Processor</span>
            <select value={draft.vendor} onChange={set('vendor')} className={selectCls}>
              {vendors.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Vendors' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Process</span>
            <select value={draft.process} onChange={set('process')} className={selectCls}>
              {processes.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Processes' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Fabric Item</span>
            <select value={draft.fabric} onChange={set('fabric')} className={selectCls}>
              {fabrics.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Fabric' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Status</span>
            <select value={draft.status} onChange={set('status')} className={selectCls}>
              {['All', ...REPROCESS_STATUSES].map((v) => (
                <option key={v} value={v}>{v === 'All' ? 'All Status' : v}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-4 pb-3">
          <label className="block w-40">
            <span className={labelCls}>From Date</span>
            <input type="date" value={draft.from} onChange={set('from')} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none" />
          </label>
          <label className="block w-40">
            <span className={labelCls}>To Date</span>
            <input type="date" value={draft.to} onChange={set('to')} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none" />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setApplied(draft)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-5 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
            >
              <Search size={14} /> Search
            </button>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12px] font-bold text-slate-500 hover:bg-slate-50"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full min-w-[1720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500">
                <th className="px-3 py-2.5 w-10 text-center">#</th>
                {['Reprocess No.', 'JWO No.', 'Original Inward No.', 'Vendor / Processor', 'Process', 'Fabric Item', 'Fabric Quality', 'Shade / Colour', 'Received Qty (M)', 'Reprocess Qty (M)', 'Reason', 'Reprocess Date', 'Expected Return', 'Status'].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 whitespace-nowrap ${(i === 8 || i === 9) ? 'text-right' : ''} ${i === 13 ? 'text-center' : ''}`}>{h}</th>
                ))}
                <th className="px-3 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, idx) => (
                <tr key={`${r.jwoId}-${r.id}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 text-center text-slate-400">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-3 py-2.5 font-mono font-bold text-blue-600">{r.no}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => openJWO(r)} className="font-mono font-bold text-blue-600 hover:underline">{r.jwoNo}</button>
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-slate-600">{r.inwardNo || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.vendor}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.process}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.fabricItem || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.fabricQuality || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.shade || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">{numIN(r.receivedQty)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{numIN(r.qty)}</td>
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{r.reason || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{toDDMMYYYY(r.date)}</td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.expectedReturn ? toDDMMYYYY(r.expectedReturn) : '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${statusPill(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => openJWO(r)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="View Job Work Order">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => openEdit(r)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Edit reprocess">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => openJWO(r)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Supporting documents">
                        <FileText size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr><td colSpan={16} className="px-4 py-10 text-center text-[12px] text-slate-400">Loading…</td></tr>
              )}
              {!loading && loadError && (
                <tr><td colSpan={16} className="px-4 py-10 text-center text-[12px] font-semibold text-rose-600">{loadError}</td></tr>
              )}
              {!loading && !loadError && filtered.length === 0 && (
                <tr>
                  <td colSpan={16} className="px-4 py-10 text-center">
                    <p className="text-[13px] font-extrabold text-[#17294e]">No reprocess records found</p>
                    <p className="mt-1 text-[11.5px] text-slate-400">
                      {rows.length === 0
                        ? 'Click "+ New Reprocess" to send received material back for correction.'
                        : 'Try Search with different filters, or Reset.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-2 sm:p-4 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-[15px] font-extrabold text-[#17294e]">{editing ? `Edit Reprocess ${editing.no}` : 'New Reprocess'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 py-4 max-h-[75vh] overflow-y-auto">
              <div className="sm:col-span-2 rounded-lg bg-[#f6f9ff] border border-slate-100 px-3 py-2.5">
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Job Work Order (JWO) <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={form.jwoId}
                  onChange={(e) => setForm((f) => ({ ...f, jwoId: e.target.value, inwardNo: '' }))}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-[13px]"
                >
                  <option value="">Select JWO</option>
                  {orders.filter((o) => (o.inwards || []).length > 0).map((o) => (
                    <option key={o.id} value={o.id}>{o.jwoNo} — {o.vendor} — {o.process}</option>
                  ))}
                </select>
                {selectedJWO && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11.5px]">
                    <div><p className="text-slate-400 font-semibold">Vendor</p><p className="font-bold text-slate-700">{selectedJWO.vendor}</p></div>
                    <div><p className="text-slate-400 font-semibold">Process</p><p className="font-bold text-slate-700">{selectedJWO.process}</p></div>
                    <div><p className="text-slate-400 font-semibold">Fabric</p><p className="font-bold text-slate-700">{selectedMat.fabricItem || '—'}</p></div>
                    <div><p className="text-slate-400 font-semibold">Shade</p><p className="font-bold text-slate-700">{selectedMat.shade || '—'}</p></div>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Original Inward No. <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={form.inwardNo}
                  onChange={(e) => setForm((f) => ({ ...f, inwardNo: e.target.value }))}
                  disabled={!selectedJWO}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-[13px] disabled:bg-slate-50"
                >
                  <option value="">{selectedJWO ? 'Select inward receipt' : 'Select a JWO first'}</option>
                  {(selectedJWO?.inwards || []).map((w) => (
                    <option key={w.id} value={w.no}>{w.no} — {numIN(w.qty)} M ({toDDMMYYYY(w.date)})</option>
                  ))}
                </select>
                {selectedInward && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px]">
                    <div><p className="text-slate-400 font-semibold">Received Qty</p><p className="font-bold font-mono text-slate-700">{numIN(selectedInward.qty)} M</p></div>
                    <div><p className="text-slate-400 font-semibold">Already Reprocessed</p><p className="font-bold font-mono text-slate-700">{numIN(Math.max(0, Number(selectedInward.qty || 0) - remaining))} M</p></div>
                    <div><p className="text-slate-400 font-semibold">Available</p><p className="font-bold font-mono text-blue-700">{numIN(remaining)} M</p></div>
                  </div>
                )}
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Reprocess Date <span className="text-rose-500">*</span></label>
                <input type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-[13px]" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Reprocess Qty (M) <span className="text-rose-500">*</span></label>
                <input type="text" inputMode="decimal" required value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} placeholder="0.00" className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-right text-[13px]" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Reason <span className="text-rose-500">*</span></label>
                <input
                  required
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Shade mismatch"
                  maxLength={120}
                  list="reprocess-reasons"
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-[13px]"
                />
                <datalist id="reprocess-reasons">
                  {REASON_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
                </datalist>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Expected Return</label>
                <input type="date" value={form.expectedReturn} onChange={(e) => setForm((f) => ({ ...f, expectedReturn: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-[13px]" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Status</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-[13px]">
                  {REPROCESS_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Remarks</label>
                <textarea rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Remarks…" maxLength={500} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-[13px]" />
              </div>
              {formError && (
                <div className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600">{formError}</div>
              )}
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-bold text-[12px]">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white rounded-lg font-bold text-[12px]">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Reprocess'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
