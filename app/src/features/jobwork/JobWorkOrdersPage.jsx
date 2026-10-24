import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Pencil, ArrowDownToLine, Hourglass, IndianRupee, User, Users, X, Check } from 'lucide-react';
import { jwoKpis, inr, numIN, toDDMMYYYY, purgeLegacyJobWorkCache } from './jobWorkOrdersStore';
import { fetchJWOs, createJWO, lookupJWORate, errorMessage } from '../../services/jobWorkSync';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';
import PageHeader from '../../components/ui/PageHeader';
import TablePagination from '../../components/ui/TablePagination';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import KpiCard from '../../components/ui/KpiCard';

const statusPill = (s) =>
  s === 'Completed'
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
    : s === 'In-Process'
      ? 'bg-rose-50 text-rose-500 border-rose-200'
      : 'bg-amber-50 text-amber-600 border-amber-200';

const DEFAULT_PROCESS_OPTIONS = [
  'Dyeing', 'Printing', 'Bleaching', 'Finishing',
  'Washing', 'Compacting', 'Embroidery', 'Coating/Heat Set',
];

export default function JobWorkOrdersPage() {
  const navigate = useNavigate();
  const { vendors = [], items = [] } = useERP();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Masters from backend
  const [processorsList, setProcessorsList] = useState([]);
  const [processesList, setProcessesList] = useState([]);
  const [qualitiesList, setQualitiesList] = useState([]);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalVendor, setModalVendor] = useState('');
  const [modalProcess, setModalProcess] = useState('Dyeing');
  const [modalFabric, setModalFabric] = useState('');
  const [modalQuality, setModalQuality] = useState('');
  const [modalShade, setModalShade] = useState('');
  const [modalLotNo, setModalLotNo] = useState('');
  const [modalQty, setModalQty] = useState('');
  const [modalRate, setModalRate] = useState('');
  const [rateDefaulted, setRateDefaulted] = useState(false);
  const [modalDate, setModalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [modalExpected, setModalExpected] = useState('');
  const [modalRemarks, setModalRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // Server is the source of truth: GET /jobwork/orders/.
  useEffect(() => {
    let live = true;
    purgeLegacyJobWorkCache();
    fetchJWOs()
      .then((rows) => { if (live) setOrders(rows); })
      .catch((err) => { if (live) setLoadError(errorMessage(err, 'Could not load job work orders.')); })
      .finally(() => { if (live) setLoading(false); });

    api.get('/masters/parties/processors/')
      .then((res) => { if (live) setProcessorsList(Array.isArray(res) ? res : (res?.results || [])); })
      .catch(() => {});

    api.get('/masters/processes/')
      .then((res) => { if (live) setProcessesList(Array.isArray(res) ? res : (res?.results || [])); })
      .catch(() => {});

    api.get('/inventory/fabric-qualities/')
      .then((res) => { if (live) setQualitiesList(Array.isArray(res) ? res : (res?.results || [])); })
      .catch(() => {});

    return () => { live = false; };
  }, []);

  // Auto-lookup contracted rate from JobWorkRateMaster (Phase 2.1, 2.5)
  useEffect(() => {
    if (!modalVendor || !modalProcess || !modalQuality) {
      setRateDefaulted(false);
      return;
    }
    const proc = processorsList.find((p) => p.name === modalVendor);
    const prc = processesList.find((p) => p.name === modalProcess);
    const qlt = qualitiesList.find((q) => q.name.toLowerCase() === modalQuality.toLowerCase());

    if (proc?.id && prc?.id && qlt?.id) {
      lookupJWORate({ processorId: proc.id, processId: prc.id, fabricQualityId: qlt.id })
        .then((res) => {
          if (res?.rate !== undefined && res?.rate !== null) {
            setModalRate(String(res.rate));
            setRateDefaulted(true);
          }
        })
        .catch(() => setRateDefaulted(false));
    }
  }, [modalVendor, modalProcess, modalQuality, processorsList, processesList, qualitiesList]);

  const totals = useMemo(() => {
    const t = { ordered: 0, outward: 0, inward: 0, pending: 0, amount: 0 };
    orders.forEach((o) => {
      const k = jwoKpis(o);
      t.ordered += k.totalOrdered;
      t.outward += k.totalOutward;
      t.inward += k.totalInward;
      t.pending += k.pending;
      t.amount += k.totalAmount;
    });
    return t;
  }, [orders]);

  const rows = useMemo(
    () =>
      orders.filter((o) => {
        if (status !== 'All' && o.status !== status) return false;
        if (!q) return true;
        const s = `${o.jwoNo} ${o.vendor} ${o.process}`.toLowerCase();
        return s.includes(q.toLowerCase());
      }),
    [orders, q, status],
  );

  useEffect(() => {
    setPage(1);
  }, [q, status]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const openCreateModal = () => {
    setModalVendor('');
    setModalProcess(processesList[0]?.name || 'Dyeing');
    setModalFabric('');
    setModalQuality('');
    setModalShade('');
    setModalLotNo('');
    setModalQty('');
    setModalRate('');
    setRateDefaulted(false);
    setModalDate(new Date().toISOString().slice(0, 10));
    setModalExpected('');
    setModalRemarks('');
    setCreateError('');
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!modalVendor) { setCreateError('Please select a vendor / processor.'); return; }
    if (!modalFabric) { setCreateError('Please select a fabric item.'); return; }
    const plannedQty = Number(modalQty);
    const rate = Number(modalRate);
    if (!(plannedQty > 0)) { setCreateError('Please enter a valid planned quantity.'); return; }
    if (!(rate >= 0)) { setCreateError('Please enter a valid rate.'); return; }

    const procObj = processorsList.find((p) => p.name === modalVendor);
    const prcObj = processesList.find((p) => p.name === modalProcess);

    setIsSubmitting(true);
    try {
      // The server allocates the JWO number and derives planned qty / amount
      // from the material row.
      const saved = await createJWO({
        process: modalProcess,
        processMasterId: prcObj?.id,
        vendor: modalVendor,
        vendorId: procObj?.id,
        orderDate: modalDate,
        rate,
        expectedCompletion: modalExpected,
        remarks: modalRemarks,
        materials: [
          {
            fabricItem: modalFabric,
            fabricQuality: modalQuality,
            shade: modalShade,
            lotNo: modalLotNo,
            qty: plannedQty,
            rate,
          },
        ],
      });
      setOrders((prev) => [saved, ...prev]);
      setShowCreateModal(false);
      navigate(`/job-work/orders/${saved.id}`);
    } catch (err) {
      setCreateError(errorMessage(err, 'Could not create the job work order.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const kpiCards = [
    { icon: User, label: 'Total Ordered', value: `${numIN(totals.ordered)} M`, tone: 'blue' },
    { icon: Users, label: 'Total Outward', value: `${numIN(totals.outward)} M`, tone: 'purple' },
    { icon: ArrowDownToLine, label: 'Total Inward', value: `${numIN(totals.inward)} M`, tone: 'emerald' },
    { icon: Hourglass, label: 'Pending Quantity', value: `${numIN(totals.pending)} M`, tone: 'amber' },
    { icon: IndianRupee, label: 'Total Amount', value: inr(totals.amount), tone: 'rose' },
  ];

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      <PageHeader
        title="Job Work Orders"
        subtitle="Manage job work orders assigned to external processors."
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'PMS', path: '/pms' },
          { label: 'Job Work / Processing' },
          { label: 'Job Work Orders' },
        ]}
        actions={
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
          >
            <Plus size={14} /> Create Job Work Order
          </button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpiCards.map((c) => (
          <KpiCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            tone={c.tone}
          />
        ))}
      </div>

      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search JWO / vendor / process…"
            className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-blue-400"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-700 outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="In-Process">In-Process</option>
            <option value="Completed">Completed</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-bold">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">JWO No</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Process</th>
                <th className="px-3 py-2.5">Vendor</th>
                <th className="px-3 py-2.5 text-right">Ordered (M)</th>
                <th className="px-3 py-2.5 text-right">Inward (M)</th>
                <th className="px-3 py-2.5 text-right">Pending (M)</th>
                <th className="px-3 py-2.5 text-right">Rate</th>
                <th className="px-3 py-2.5 text-right">Total Amount</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {pagedRows.map((o, idx) => {
                const k = jwoKpis(o);
                return (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-3 py-2.5 text-slate-400 font-semibold">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="px-3 py-2.5 font-bold text-[#17294e]">
                      <button
                        onClick={() => navigate(`/job-work/orders/${o.id}`)}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {o.jwoNo}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{toDDMMYYYY(o.orderDate)}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-700">{o.process}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{o.vendor}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium">{numIN(k.totalOrdered)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium text-emerald-600">{numIN(k.totalInward)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-600">{numIN(k.pending)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-500">₹{Number(o.rate || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-[#17294e]">{inr(k.totalAmount)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusPill(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => navigate(`/job-work/orders/${o.id}`)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="View">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => navigate(`/job-work/orders/${o.id}`)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="Edit">
                          <Pencil size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length > 0 && (
                <tr className="bg-slate-50/80 font-bold">
                  <td className="px-3 py-2.5"></td>
                  <td className="px-3 py-2.5 text-slate-700">Total</td>
                  <td colSpan={3} className="px-3 py-2.5"></td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-900">{numIN(totals.ordered)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-900">{numIN(totals.inward)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-900">{numIN(totals.pending)}</td>
                  <td className="px-3 py-2.5"></td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-900">{numIN(totals.amount)}</td>
                  <td colSpan={2} className="px-3 py-2.5"></td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-[12px] text-slate-400">Loading job work orders…</td>
                </tr>
              )}
              {!loading && loadError && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-[12px] font-semibold text-rose-600">{loadError}</td>
                </tr>
              )}
              {!loading && !loadError && rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center">
                    <p className="text-[13px] font-extrabold text-[#17294e]">No records found</p>
                    <p className="mt-1 text-[11.5px] text-slate-400">Create a job work order to get started.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={rows.length}
            onPageChange={setPage}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          />
        </div>
      </div>

      {/* Create JWO Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">Create Job Work Order</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">Vendor / Processor *</label>
                    <MasterSourceLink source="processors" />
                  </div>
                  <select
                    required
                    value={modalVendor}
                    onChange={(e) => setModalVendor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium"
                  >
                    <option value="">Select Processor</option>
                    {(processorsList.length > 0 ? processorsList : vendors).map((v) => (
                      <option key={v.id} value={v.name}>{v.code ? `[${v.code}] ` : ''}{v.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">Process Type *</label>
                    <MasterSourceLink source="processes" />
                  </div>
                  <select
                    required
                    value={modalProcess}
                    onChange={(e) => setModalProcess(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium"
                  >
                    {(processesList.length > 0 ? processesList : DEFAULT_PROCESS_OPTIONS.map(name => ({ id: name, name }))).map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">Fabric Item *</label>
                    <MasterSourceLink source="items" />
                  </div>
                  <select
                    required
                    value={modalFabric}
                    onChange={(e) => {
                      const sel = items.find((it) => it.name === e.target.value);
                      setModalFabric(e.target.value);
                      if (sel?.fabricQuality) setModalQuality(sel.fabricQuality);
                      if (sel?.fabricColor) setModalShade(sel.fabricColor);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  >
                    <option value="">Select Fabric Item</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.name}>{it.sku ? `${it.sku} — ` : ''}{it.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Fabric Quality</label>
                  <input
                    type="text"
                    value={modalQuality}
                    onChange={(e) => setModalQuality(e.target.value)}
                    placeholder="e.g. Cotton 60s, GSM 120"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Shade / Color</label>
                  <input
                    type="text"
                    value={modalShade}
                    onChange={(e) => setModalShade(e.target.value)}
                    placeholder="e.g. Navy Blue"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Grey Lot No.</label>
                  <input
                    type="text"
                    value={modalLotNo}
                    onChange={(e) => setModalLotNo(e.target.value)}
                    placeholder="e.g. LOT-001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Planned Quantity (m) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    placeholder="e.g. 1000"
                    value={modalQty}
                    onChange={(e) => setModalQty(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                    <span>Rate (₹ / m) *</span>
                    {rateDefaulted && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        ✓ Rate Master
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="e.g. 8.50"
                    value={modalRate}
                    onChange={(e) => {
                      setModalRate(e.target.value);
                      setRateDefaulted(false);
                    }}
                    className={`w-full px-3 py-2 border rounded-lg bg-white text-slate-800 font-bold ${rateDefaulted ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-300'}`}
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Order Date</label>
                  <input
                    type="date"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Expected Completion</label>
                  <input
                    type="date"
                    value={modalExpected}
                    onChange={(e) => setModalExpected(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Remarks / Special Instructions</label>
                  <input
                    type="text"
                    value={modalRemarks}
                    onChange={(e) => setModalRemarks(e.target.value)}
                    placeholder="e.g. Ensure even shade across all takas"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>
              </div>

              {createError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600">{createError}</div>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">
                  Total Value: <strong>₹{((Number(modalQty) || 0) * (Number(modalRate) || 0)).toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Order'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
