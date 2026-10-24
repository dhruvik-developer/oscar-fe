import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText, Plus, Search, Filter, Printer, CheckCircle2,
  Clock, DollarSign, Package, AlertTriangle, Eye, RefreshCw, ShoppingCart,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import TablePagination from '../../components/ui/TablePagination';
import { useERP } from '../../context/ERPContext';
import { api } from '../../services/api';
import GenerateFinalJobWorkPOModal from './GenerateFinalJobWorkPOModal';
import { PrintPurchaseOrderModal } from '../../components/common/PrintPurchaseOrderModal';

// KPI tiles use the shared, theme-aware KpiCard.
const KPI_TONE_BY_COLOR = { '#2563eb': 'blue', '#d97706': 'amber', '#059669': 'emerald', '#7c3aed': 'purple' };

function Kpi({ icon, value, label, trend, iconColor }) {
  return <KpiCard icon={icon} value={value} label={label} trend={trend || undefined} tone={KPI_TONE_BY_COLOR[iconColor] || 'blue'} />;
}

const STATUS_PILL = {
  Draft: 'bg-amber-50 text-amber-700 border-amber-200',
  'Pending Approval': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Approved: 'bg-blue-50 text-blue-700 border-blue-200',
  'In Production': 'bg-violet-50 text-violet-700 border-violet-200',
  Received: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Billed: 'bg-sky-50 text-sky-700 border-sky-200',
  Cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

const fmtINR = (n) => (n === null || n === undefined || n === '' ? '₹ 0.00' : `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export default function FinalJobWorkPOsPage() {
  const navigate = useNavigate();
  const { vendors = [], showToast, formatCurrency } = useERP();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [printPoTarget, setPrintPoTarget] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadJobWorkOrders = () => {
    setLoading(true);
    api.get('/purchase/orders/final-job-work-list/')
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.results || res?.data || [];
        setOrders(list);
      })
      .catch((err) => {
        console.error('Failed to load Final Job Work POs:', err);
        // Fallback to general purchase orders filtering
        api.get('/purchase/orders/', { query: { page_size: 100 } })
          .then((pRes) => {
            const allPos = Array.isArray(pRes) ? pRes : pRes?.results || [];
            const jwPos = allPos.filter(
              (p) => (p.po_number || '').startsWith('JWPO') ||
                     (p.reference_number || '').startsWith('PROD-') ||
                     (p.notes || '').toLowerCase().includes('job work')
            );
            setOrders(jwPos);
          })
          .catch(() => {});
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadJobWorkOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        !search ||
        (o.po_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.party_name || o.party?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.reference_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.notes || '').toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === 'All' || o.status === statusFilter;
      const matchVendor = vendorFilter === 'All' || String(o.party_id || o.party?.id) === String(vendorFilter);

      return matchSearch && matchStatus && matchVendor;
    });
  }, [orders, search, statusFilter, vendorFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, vendorFilter]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  // KPI Computations
  const totalCount = orders.length;
  const pendingCount = orders.filter((o) => o.status === 'Pending Approval').length;
  const approvedCount = orders.filter((o) => o.status === 'Approved' || o.status === 'In Production').length;
  const totalValue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      {/* Page Header */}
      <PageHeader
        title="Final Job Work POs"
        subtitle="Manage and generate final job work purchase orders based on verified production quantities."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadJobWorkOrders}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-blue-700 transition-colors shadow-xs"
            >
              <Plus size={15} /> Generate Final Job Work PO
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={ShoppingCart}
          value={totalCount}
          label="Total Job Work POs"
          iconBg="#eff6ff"
          iconColor="#2563eb"
          wave="#93c5fd"
          arrowBg="#eff6ff"
          arrowColor="#2563eb"
        />
        <Kpi
          icon={Clock}
          value={pendingCount}
          label="Pending Approval"
          iconBg="#fffbeb"
          iconColor="#d97706"
          wave="#fde68a"
          arrowBg="#fffbeb"
          arrowColor="#d97706"
        />
        <Kpi
          icon={CheckCircle2}
          value={approvedCount}
          label="Approved / Active"
          iconBg="#ecfdf5"
          iconColor="#059669"
          wave="#a7f3d0"
          arrowBg="#ecfdf5"
          arrowColor="#059669"
        />
        <Kpi
          icon={DollarSign}
          value={fmtINR(totalValue)}
          label="Total Order Value"
          iconBg="#f5f3ff"
          iconColor="#7c3aed"
          wave="#ddd6fe"
          arrowBg="#f5f3ff"
          arrowColor="#7c3aed"
        />
      </div>

      {/* Main Table Card */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.06)] overflow-hidden">
        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3 bg-white">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative min-w-[240px] max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by PO #, Vendor, Reference, Notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-[12px] text-slate-700 outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="In Production">In Production</option>
              <option value="Received">Received</option>
              <option value="Billed">Billed</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 outline-none focus:border-blue-500 max-w-[200px]"
            >
              <option value="All">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 bg-[#f8fafc] text-slate-500">
                <th className="px-4 py-3 font-bold whitespace-nowrap">PO Number</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">PO Date</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">Agency / Vendor</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap">PI Reference</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap text-right">Billable Qty</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap text-right">Total Amount (₹)</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap text-center">Status</th>
                <th className="px-4 py-3 font-bold whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    Loading Final Job Work POs...
                  </td>
                </tr>
              )}
              {!loading && paginatedOrders.map((po) => {
                const vendorName = po.party_name || po.party?.name || '—';
                const totalQty = (po.line_items || []).reduce((s, l) => s + (Number(l.qty) || 0), 0);
                const pillClass = STATUS_PILL[po.status] || 'bg-slate-50 text-slate-600 border-slate-200';

                return (
                  <tr key={po.id} className="border-b border-slate-50 hover:bg-blue-50/20 text-slate-700 transition-colors">
                    <td className="px-4 py-3 font-extrabold text-blue-700 whitespace-nowrap">
                      {po.po_number || `PO-${po.id}`}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {po.doc_date || '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#17294e]">
                      {vendorName}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">
                      {po.reference_number || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                      {totalQty > 0 ? `${totalQty.toLocaleString('en-IN')} M` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-[#17294e] whitespace-nowrap">
                      {fmtINR(po.total)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${pillClass}`}>
                        {po.status || 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      <button
                        onClick={() => setPrintPoTarget(po)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                        title="Print / View"
                      >
                        <Printer size={12} /> Print
                      </button>
                      <button
                        onClick={() => navigate('/purchase/orders')}
                        className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-100"
                        title="Open in PO Workspace"
                      >
                        <Eye size={12} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <p className="font-bold text-[13px] text-slate-600 mb-1">No Final Job Work POs found</p>
                    <p className="text-[11.5px] text-slate-400 mb-3">Click "Generate Final Job Work PO" to generate a purchase order from completed production.</p>
                    <button
                      onClick={() => setShowGenerateModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-[12px] font-bold text-white hover:bg-blue-700"
                    >
                      <Plus size={14} /> Generate Final Job Work PO
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={filteredOrders.length}
            onPageChange={setPage}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          />
        </div>
      </div>

      {/* Generate Final Job Work PO Slide / Modal */}
      <GenerateFinalJobWorkPOModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onSuccess={() => {
          loadJobWorkOrders();
          if (showToast) showToast('Job Work PO generated and added to list!', 'success');
        }}
      />

      {/* Print PO Modal */}
      {printPoTarget && (
        <PrintPurchaseOrderModal
          order={printPoTarget}
          onClose={() => setPrintPoTarget(null)}
        />
      )}
    </div>
  );
}
