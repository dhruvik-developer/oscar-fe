import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, FileText } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import TablePagination from '../../components/ui/TablePagination';
import { api } from '../../services/api';
import { numIN, toDDMMYYYY } from './jobWorkOrdersStore';

const statusPill = (s) =>
  s === 'Completed'
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
    : s === 'Overdue'
      ? 'bg-red-50 text-red-600 border-red-200'
      : 'bg-rose-50 text-rose-500 border-rose-200';

export default function PendingRegisterPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fJwo, setFJwo] = useState('All');
  const [fVendor, setFVendor] = useState('All');
  const [fProcess, setFProcess] = useState('All');
  const [fFabric, setFFabric] = useState('All');
  const [fStatus, setFStatus] = useState('All');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.get('/jobwork/orders/pending-register/')
      .then((res) => {
        if (!live) return;
        const list = Array.isArray(res) ? res : res?.results || [];
        setRows(list);
        setError(null);
      })
      .catch((err) => {
        if (!live) return;
        setError(err.message || 'Failed to load pending register');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => { live = false; };
  }, []);

  const jwoNos = useMemo(() => ['All', ...new Set(rows.map((r) => r.jwoNo).filter(Boolean))], [rows]);
  const vendors = useMemo(() => ['All', ...new Set(rows.map((r) => r.vendor).filter(Boolean))], [rows]);
  const processes = useMemo(() => ['All', ...new Set(rows.map((r) => r.process).filter(Boolean))], [rows]);
  const fabrics = useMemo(() => ['All', ...new Set(rows.map((r) => r.fabricItem).filter(Boolean))], [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (fJwo !== 'All' && r.jwoNo !== fJwo) return false;
    if (fVendor !== 'All' && r.vendor !== fVendor) return false;
    if (fProcess !== 'All' && r.process !== fProcess) return false;
    if (fFabric !== 'All' && r.fabricItem !== fFabric) return false;
    if (fStatus !== 'All' && r.status !== fStatus) return false;
    const exp = String(r.expectedReturnDate || '').slice(0, 10);
    if (fFrom && (!exp || exp < fFrom)) return false;
    if (fTo && (!exp || exp > fTo)) return false;
    return true;
  }), [rows, fJwo, fVendor, fProcess, fFabric, fStatus, fFrom, fTo]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [fJwo, fVendor, fProcess, fFabric, fStatus, fFrom, fTo]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const selectCls = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-700 outline-none';
  const labelCls = 'text-[11px] font-semibold text-slate-400';

  const openJWO = (r) => navigate(`/job-work/orders/${r.jwoId}`);

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      <PageHeader
        title="Pending Register"
        subtitle="Track quantities pending with external processors."
      />

      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.06)] overflow-hidden">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 md:grid-cols-4 xl:grid-cols-7">
          <label className="block">
            <span className={labelCls}>JWO No.</span>
            <select value={fJwo} onChange={(e) => setFJwo(e.target.value)} className={selectCls}>
              {jwoNos.map((v) => <option key={v} value={v}>{v === 'All' ? 'All JWO' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Vendor / Processor</span>
            <select value={fVendor} onChange={(e) => setFVendor(e.target.value)} className={selectCls}>
              {vendors.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Vendors' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Process</span>
            <select value={fProcess} onChange={(e) => setFProcess(e.target.value)} className={selectCls}>
              {processes.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Processes' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Fabric Item</span>
            <select value={fFabric} onChange={(e) => setFFabric(e.target.value)} className={selectCls}>
              {fabrics.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Fabric' : v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Status</span>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selectCls}>
              {['All', 'Pending', 'Overdue', 'Completed'].map((v) => (
                <option key={v} value={v}>{v === 'All' ? 'All Status' : v}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Expected Return From</span>
            <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none" />
          </label>
          <label className="block">
            <span className={labelCls}>Expected Return To</span>
            <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none" />
          </label>
        </div>

        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full min-w-[1440px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500">
                <th className="px-3 py-2.5 w-10 text-center">#</th>
                {['JWO No.', 'Vendor / Processor', 'Process', 'Fabric Item', 'Fabric Quality', 'Shade / Colour', 'Outward Qty (M)', 'Inward Qty (M)', 'Pending Qty (M)', 'Expected Return Date', 'Days Pending', 'Status'].map((h, i) => (
                  <th key={h} className={`px-3 py-2.5 whitespace-nowrap ${(i >= 6 && i <= 8) || i === 10 ? 'text-right' : ''} ${i === 11 ? 'text-center' : ''}`}>{h}</th>
                ))}
                <th className="px-3 py-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r, idx) => (
                <tr key={r.jwoId} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 text-center text-slate-400">{(page - 1) * pageSize + idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => openJWO(r)} className="font-mono font-bold text-blue-600 hover:underline">{r.jwoNo}</button>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{r.vendor || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.process || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.fabricItem || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.fabricQuality || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.shade || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">{numIN(r.totalOutward)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">{numIN(r.totalInward)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{numIN(r.pendingQty)}</td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.expectedReturnDate ? toDDMMYYYY(r.expectedReturnDate) : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">{r.daysPending}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${statusPill(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => openJWO(r)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer" title="View Job Work Order">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => openJWO(r)} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer" title="Open challans / receipts">
                        <FileText size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-slate-500">
                    Loading pending register...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center">
                    <p className="text-[13px] font-extrabold text-[#17294e]">No pending records found</p>
                    <p className="mt-1 text-[11.5px] text-slate-400">
                      {rows.length === 0
                        ? 'Rows appear here automatically once material is sent out on a Job Work Order.'
                        : 'Try clearing the filters above.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Standard Table Pagination Footer */}
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>
    </div>
  );
}
