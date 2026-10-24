import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { numIN, toDDMMYYYY, purgeLegacyJobWorkCache } from './jobWorkOrdersStore';
import { fetchJWOs, fetchPlans, createJWORow, deleteJWORow, errorMessage } from '../../services/jobWorkSync';
import PageHeader from '../../components/ui/PageHeader';
import TablePagination from '../../components/ui/TablePagination';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

const statusPill = (s) =>
  s === 'Received' || s === 'Fully Received' || s === 'Completed'
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
    : s === 'Partially Received'
      ? 'bg-amber-50 text-amber-600 border-amber-200'
      : s === 'Draft'
        ? 'bg-slate-100 text-slate-500 border-slate-200'
        : s === 'Cancelled'
          ? 'bg-slate-100 text-slate-500 border-slate-200'
          : 'bg-rose-50 text-rose-500 border-rose-200';

const INWARD_STATUSES = ['Pending', 'Partially Received', 'Received', 'Draft', 'Cancelled'];

/** Flatten every JWO's inwards into cross-JWO rows (same records as JWO detail). */
function flattenInwards(orders, plans) {
  const planById = new Map((plans || []).map((p) => [String(p.id), p]));
  const rows = [];
  (orders || []).forEach((o) => {
    const mat = (o.materials || [])[0] || {};
    const plan = o.processPlanId ? planById.get(String(o.processPlanId)) : null;
    (o.inwards || []).forEach((w) => {
      rows.push({
        ...w,
        jwoId: o.id,
        jwoNo: o.jwoNo,
        vendor: o.vendor,
        process: o.process,
        plannedQty: Number(o.plannedQty) || 0,
        fabricItem: mat.fabricItem || '',
        fabricQuality: mat.fabricQuality || '',
        shade: mat.shade || '',
        lotNo: mat.lotNo || '',
        takaRoll: plan?.takaRollNo || plan?.takaRoll || '',
      });
    });
  });
  // Pending per row = JWO planned − cumulative received up to and including this row.
  const byJwo = new Map();
  rows.forEach((r) => {
    if (!byJwo.has(String(r.jwoId))) byJwo.set(String(r.jwoId), []);
    byJwo.get(String(r.jwoId)).push(r);
  });
  byJwo.forEach((list) => {
    list
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
      .reduce((cum, r) => {
        const next = cum + (Number(r.qty) || 0);
        r.pendingQty = Math.max(0, Number(r.plannedQty || 0) - next);
        return next;
      }, 0);
  });
  return rows;
}

export default function JobWorkInwardPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [inwardNo, setInwardNo] = useState('All');
  const [jwoNo, setJwoNo] = useState('All');
  const [vendor, setVendor] = useState('All');
  const [process, setProcess] = useState('All');
  const [status, setStatus] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [menuId, setMenuId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, row: null, loading: false });
  const [form, setForm] = useState({
    jwoId: '',
    date: new Date().toISOString().slice(0, 10),
    qty: '',
    accepted: '',
    rejected: '0',
    challanNo: '',
    status: 'Received',
  });

  const reload = async () => {
    const [jwoRows, planRows] = await Promise.all([fetchJWOs(), fetchPlans()]);
    setOrders(jwoRows);
    setPlans(planRows);
  };

  useEffect(() => {
    let live = true;
    purgeLegacyJobWorkCache();
    Promise.all([fetchJWOs(), fetchPlans()])
      .then(([jwoRows, planRows]) => {
        if (!live) return;
        setOrders(jwoRows);
        setPlans(planRows);
      })
      .catch((err) => { if (live) setLoadError(errorMessage(err, 'Could not load inward receipts.')); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const rows = useMemo(() => flattenInwards(orders, plans), [orders, plans]);

  const inwardNos = useMemo(() => ['All', ...new Set(rows.map((r) => r.no).filter(Boolean))], [rows]);
  const jwoNos = useMemo(() => ['All', ...new Set(rows.map((r) => r.jwoNo).filter(Boolean))], [rows]);
  const vendors = useMemo(() => ['All', ...new Set(rows.map((r) => r.vendor).filter(Boolean))], [rows]);
  const processes = useMemo(() => ['All', ...new Set(rows.map((r) => r.process).filter(Boolean))], [rows]);
  const statuses = useMemo(() => ['All', ...new Set(rows.map((r) => r.status).filter(Boolean))], [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (inwardNo !== 'All' && r.no !== inwardNo) return false;
    if (jwoNo !== 'All' && r.jwoNo !== jwoNo) return false;
    if (vendor !== 'All' && r.vendor !== vendor) return false;
    if (process !== 'All' && r.process !== process) return false;
    if (status !== 'All' && r.status !== status) return false;
    if (fromDate && (r.date || '') < fromDate) return false;
    if (toDate && (r.date || '') > toDate) return false;
    return true;
  }), [rows, inwardNo, jwoNo, vendor, process, status, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
  }, [inwardNo, jwoNo, vendor, process, status, fromDate, toDate]);

  const pagedFiltered = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const selectedJWO = useMemo(
    () => orders.find((o) => String(o.id) === String(form.jwoId)),
    [orders, form.jwoId],
  );
  const selectedMat = (selectedJWO?.materials || [])[0] || {};
  const selectedIn = (selectedJWO?.inwards || []).reduce((s, o) => s + (Number(o.qty) || 0), 0);
  const selectedOut = (selectedJWO?.outwards || []).reduce((s, o) => s + (Number(o.qty) || 0), 0);

  const openCreate = () => {
    setForm({
      jwoId: '',
      date: new Date().toISOString().slice(0, 10),
      qty: '',
      accepted: '',
      rejected: '0',
      challanNo: (selectedJWO?.outwards || [])[0]?.no || '',
      status: 'Received',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.jwoId) { setFormError('Select a Job Work Order first.'); return; }
    const qty = Number(form.qty);
    if (!(qty > 0)) { setFormError('Received quantity must be greater than 0.'); return; }
    const parent = orders.find((o) => String(o.id) === String(form.jwoId));
    if (!parent) { setFormError('Selected JWO no longer exists.'); return; }
    const rejected = Math.max(0, Number(form.rejected) || 0);
    const accepted = form.accepted !== '' ? Number(form.accepted) : Math.max(0, qty - rejected);
    // The server allocates the receipt number and checks qty against what is still at the vendor.
    const entry = {
      date: form.date,
      qty,
      accepted,
      rejected,
      challanNo: form.challanNo,
      status: form.status,
    };
    setSaving(true);
    try {
      await createJWORow(parent.id, 'inwards', entry);
      await reload();
      setShowForm(false);
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save the inward receipt.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (r) => {
    setMenuId(null);
    setDeleteConfirm({ isOpen: true, row: r, loading: false });
  };

  const handleConfirmDelete = async () => {
    const r = deleteConfirm.row;
    if (!r) return;
    setDeleteConfirm((prev) => ({ ...prev, loading: true }));
    try {
      await deleteJWORow(r.jwoId, 'inwards', r.id);
      setDeleteConfirm({ isOpen: false, row: null, loading: false });
      await reload();
    } catch (err) {
      setDeleteConfirm((prev) => ({ ...prev, loading: false }));
      window.alert(errorMessage(err, 'Could not delete the inward receipt.'));
    }
  };

  const selectCls = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-700 outline-none';
  const labelCls = 'text-[11px] font-semibold text-slate-400';

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      <PageHeader
        title="Job Work Inward"
        subtitle="Track processed material received back from vendors."
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'PMS', path: '/pms' },
          { label: 'Job Work / Processing' },
          { label: 'Job Work Inward' },
        ]}
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
          >
            <Plus size={14} /> Create Inward Receipt
          </button>
        }
      />

      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 md:grid-cols-4 xl:grid-cols-7">
          <label className="block">
            <span className={labelCls}>Inward No.</span>
            <select value={inwardNo} onChange={(e) => setInwardNo(e.target.value)} className={selectCls}>
              {inwardNos.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Inward No.' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>JWO No.</span>
            <select value={jwoNo} onChange={(e) => setJwoNo(e.target.value)} className={selectCls}>
              {jwoNos.map((v) => <option key={v} value={v}>{v === 'All' ? 'All JWO' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Vendor / Processor</span>
            <select value={vendor} onChange={(e) => setVendor(e.target.value)} className={selectCls}>
              {vendors.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Vendors' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Process</span>
            <select value={process} onChange={(e) => setProcess(e.target.value)} className={selectCls}>
              {processes.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Processes' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
              {statuses.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Status' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>From Date</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none" />
          </label>
          <label className="block">
            <span className={labelCls}>To Date</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none" />
          </label>
        </div>

        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full min-w-[1500px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500">
                <th className="px-3 py-2.5 w-10 text-center">#</th>
                {['Inward No.', 'JWO No.', 'Date', 'Vendor / Processor', 'Process', 'Fabric Item', 'Fabric Quality', 'Shade / Colour', 'Lot No.', 'Taka / Roll', 'Received Qty (M)', 'Accepted Qty (M)', 'Rejected Qty (M)', 'Pending Qty (M)', 'Status'].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 whitespace-nowrap ${i >= 10 && i <= 13 ? 'text-right' : ''} ${i === 14 ? 'text-center' : ''}`}>{h}</th>
                ))}
                <th className="px-3 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedFiltered.map((r, idx) => (
                <tr key={`${r.jwoId}-${r.id}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 text-center text-slate-400">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-3 py-2.5 font-mono font-bold text-blue-600">{r.no}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => navigate(`/job-work/orders/${r.jwoId}`)} className="font-mono font-bold text-blue-600 hover:underline">{r.jwoNo}</button>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{toDDMMYYYY(r.date)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.vendor}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.process}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.fabricItem || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.fabricQuality || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.shade || '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-600">{r.lotNo || '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-600">{r.takaRoll || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">{numIN(r.qty)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">{numIN(r.accepted)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">{numIN(r.rejected)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-600">{numIN(r.pendingQty)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${statusPill(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => navigate(`/job-work/orders/${r.jwoId}`)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="View">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => navigate(`/job-work/orders/${r.jwoId}`)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <div className="relative">
                        <button onClick={() => setMenuId(menuId === r.id ? null : r.id)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="More">
                          <MoreHorizontal size={14} />
                        </button>
                        {menuId === r.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                            <div className="absolute right-0 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                              <button onClick={() => { setMenuId(null); navigate(`/job-work/orders/${r.jwoId}`); }} className="block w-full px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50">Open JWO</button>
                              <button onClick={() => handleDelete(r)} className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-rose-600 hover:bg-rose-50">Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr><td colSpan={17} className="px-4 py-10 text-center text-[12px] text-slate-400">Loading…</td></tr>
              )}
              {!loading && loadError && (
                <tr><td colSpan={17} className="px-4 py-10 text-center text-[12px] font-semibold text-rose-600">{loadError}</td></tr>
              )}
              {!loading && !loadError && filtered.length === 0 && (
                <tr>
                  <td colSpan={17} className="px-4 py-10 text-center">
                    <p className="text-[13px] font-extrabold text-[#17294e]">No inward receipts found</p>
                    <p className="mt-1 text-[11.5px] text-slate-400">Click "+ Create Inward Receipt" to add one — it appears here automatically.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          />
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-2 sm:p-4 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-[15px] font-extrabold text-[#17294e]">Create Inward Receipt</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 py-4 max-h-[75vh] overflow-y-auto">
              <div className="sm:col-span-2 rounded-lg bg-[#f6f9ff] border border-slate-100 px-3 py-2.5">
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Job Work Order (JWO) <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={form.jwoId}
                  onChange={(e) => setForm((f) => ({ ...f, jwoId: e.target.value, challanNo: (orders.find((o) => String(o.id) === e.target.value)?.outwards || [])[0]?.no || '' }))}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-[13px]"
                >
                  <option value="">Select JWO</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>{o.jwoNo} — {o.vendor} — {o.process} (Qty: {numIN(o.plannedQty)} M)</option>
                  ))}
                </select>
                {selectedJWO && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11.5px]">
                    <div><p className="text-slate-400 font-semibold">Process</p><p className="font-bold text-slate-700">{selectedJWO.process}</p></div>
                    <div><p className="text-slate-400 font-semibold">Vendor</p><p className="font-bold text-slate-700">{selectedJWO.vendor}</p></div>
                    <div><p className="text-slate-400 font-semibold">Fabric</p><p className="font-bold text-slate-700">{selectedMat.fabricItem || '—'}</p></div>
                    <div><p className="text-slate-400 font-semibold">Lot No.</p><p className="font-bold font-mono text-slate-700">{selectedMat.lotNo || '—'}</p></div>
                    <div><p className="text-slate-400 font-semibold">Outward so far</p><p className="font-bold font-mono text-slate-700">{numIN(selectedOut)} M</p></div>
                    <div><p className="text-slate-400 font-semibold">Received so far</p><p className="font-bold font-mono text-slate-700">{numIN(selectedIn)} M</p></div>
                  </div>
                )}
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Receipt Date <span className="text-rose-500">*</span></label>
                <input type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-[13px]" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Received Qty (M) <span className="text-rose-500">*</span></label>
                <input type="text" inputMode="decimal" required value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} placeholder="0.00" className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-right text-[13px]" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Accepted Qty (M)</label>
                <input type="text" inputMode="decimal" value={form.accepted} onChange={(e) => setForm((f) => ({ ...f, accepted: e.target.value }))} placeholder="Auto = received − rejected" className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-right text-[13px]" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Rejected Qty (M)</label>
                <input type="text" inputMode="decimal" value={form.rejected} onChange={(e) => setForm((f) => ({ ...f, rejected: e.target.value }))} placeholder="0" className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-right text-[13px]" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Outward Ref (Challan No.)</label>
                <input value={form.challanNo} onChange={(e) => setForm((f) => ({ ...f, challanNo: e.target.value }))} placeholder="e.g. OUT-2026-001" maxLength={60} className="w-full border border-slate-300 rounded-lg p-2 bg-white font-mono text-slate-800 text-[13px]" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[12px]">Status</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-[13px]">
                  {INWARD_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              {formError && (
                <div className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600">{formError}</div>
              )}
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-bold text-[12px]">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white rounded-lg font-bold text-[12px]">{saving ? 'Saving…' : 'Create Receipt'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Centered Modern Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => !deleteConfirm.loading && setDeleteConfirm({ isOpen: false, row: null, loading: false })}
        onConfirm={handleConfirmDelete}
        title="Delete Inward Receipt"
        message="Are you sure you want to delete this inward receipt? This action will remove the receipt record from the Job Work Order."
        itemName={deleteConfirm.row ? `Inward Receipt: ${deleteConfirm.row.no}` : null}
        confirmText="Delete Inward"
        cancelText="Cancel"
        variant="danger"
        loading={deleteConfirm.loading}
      />
    </div>
  );
}
