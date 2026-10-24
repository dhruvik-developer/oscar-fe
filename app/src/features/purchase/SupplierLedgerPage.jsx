import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Filter,
  Search,
  RefreshCw,
  Printer,
  Calendar,
  Building2,
  Phone,
  Mail,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Download,
} from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/ui/PageHeader';
import TablePagination from '../../components/ui/TablePagination';
import { StatCard } from '../../components/ui/StatCard';
import { numIN } from '../../utils/formatters';

export default function SupplierLedgerPage() {
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [ledger, setLedger] = useState({
    openingBalance: 0,
    closingBalance: 0,
    entries: [],
    vendor: null,
  });

  // Load vendors
  useEffect(() => {
    api.get('/purchase/vendors/').then((res) => {
      const rows = Array.isArray(res) ? res : (res?.results || []);
      setVendors(rows);
      if (rows.length > 0) {
        setSelectedVendorId((prev) => prev || rows[0].id);
      }
    }).catch(() => {});
  }, []);

  const fetchLedger = useCallback(async () => {
    if (!selectedVendorId) return;
    setLoading(true);
    try {
      const query = { vendorId: selectedVendorId };
      if (dateFrom) query.dateFrom = dateFrom;
      if (dateTo) query.dateTo = dateTo;

      const res = await api.get('/purchase/receipts/supplier-ledger/', { query });
      setLedger(res || { openingBalance: 0, closingBalance: 0, entries: [], vendor: null });
    } catch (err) {
      console.error('Failed to load supplier ledger:', err);
      setLedger({ openingBalance: 0, closingBalance: 0, entries: [], vendor: null });
    } finally {
      setLoading(false);
    }
  }, [selectedVendorId, dateFrom, dateTo]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const totals = useMemo(() => {
    let debits = 0;
    let credits = 0;
    (ledger.entries || []).forEach((e) => {
      debits += Number(e.debit || 0);
      credits += Number(e.credit || 0);
    });
    return { debits, credits };
  }, [ledger.entries]);

  useEffect(() => {
    setPage(1);
  }, [selectedVendorId, dateFrom, dateTo]);

  const pagedEntries = useMemo(() => {
    const list = ledger.entries || [];
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [ledger.entries, page, pageSize]);

  const vendor = ledger.vendor || vendors.find((v) => v.id === selectedVendorId) || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Ledger"
        subtitle="Chronological statement of account: bills, payments, returns, and running balance"
        breadcrumb={[
          { label: 'Purchase', path: '/purchase/orders' },
          { label: 'Supplier Ledger' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <Printer size={13} /> Print Statement
            </button>
            <button
              onClick={fetchLedger}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        }
      />

      {/* Filter and Selection Card */}
      <div className="bg-white p-4 rounded-xl border border-[#dce5f4] shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-72">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Select Supplier *</label>
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 font-semibold focus:border-blue-500 focus:outline-none"
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.code || 'Vendor'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white"
            />
          </div>
        </div>

        {vendor.id && (
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-wrap gap-4 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block">GSTIN</span>
              <span className="font-mono font-medium text-slate-800">{vendor.gstin || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Phone</span>
              <span className="font-medium text-slate-800">{vendor.phone || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">Current Balance</span>
              <span className={`font-mono font-bold ${(vendor.currentBalance || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                ₹{numIN(Math.abs(vendor.currentBalance || 0))} {(vendor.currentBalance || 0) >= 0 ? 'Cr (Payable)' : 'Dr (Advance)'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* KPI Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Opening Balance"
          value={`₹${numIN(Math.abs(ledger.openingBalance || 0))}`}
          icon={BookOpen}
          tone="slate"
        />
        <StatCard
          label="Total Debits (Payments/Returns)"
          value={`₹${numIN(totals.debits)}`}
          icon={ArrowDownLeft}
          tone="emerald"
        />
        <StatCard
          label="Total Credits (Purchases)"
          value={`₹${numIN(totals.credits)}`}
          icon={ArrowUpRight}
          tone="rose"
        />
        <StatCard
          label="Closing Balance"
          value={`₹${numIN(Math.abs(ledger.closingBalance || 0))}`}
          icon={CreditCard}
          tone={(ledger.closingBalance || 0) > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Statement Table */}
      <div className="bg-white rounded-xl border border-[#dce5f4] shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
            Statement of Account — {vendor.name || 'Supplier'}
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {ledger.entries?.length || 0} Transactions
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw size={16} className="animate-spin text-blue-500" />
            Loading statement entries...
          </div>
        ) : !selectedVendorId ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Please select a supplier above to view ledger statement.
          </div>
        ) : (ledger.entries || []).length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No transactions found for this supplier within the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Voucher Type</th>
                  <th className="px-4 py-3">Document #</th>
                  <th className="px-4 py-3">Narration / Particulars</th>
                  <th className="px-4 py-3 text-right">Debit (₹)</th>
                  <th className="px-4 py-3 text-right">Credit (₹)</th>
                  <th className="px-4 py-3 text-right">Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {/* Opening Balance Row */}
                <tr className="bg-slate-50/50 font-semibold text-slate-700">
                  <td className="px-4 py-2.5 font-sans">{dateFrom || '—'}</td>
                  <td className="px-4 py-2.5 font-sans uppercase text-slate-500">Opening Balance</td>
                  <td className="px-4 py-2.5">—</td>
                  <td className="px-4 py-2.5 font-sans font-normal text-slate-500">Balance b/f</td>
                  <td className="px-4 py-2.5 text-right">—</td>
                  <td className="px-4 py-2.5 text-right">—</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                    ₹{numIN(Math.abs(ledger.openingBalance || 0))} {(ledger.openingBalance || 0) >= 0 ? 'Cr' : 'Dr'}
                  </td>
                </tr>

                {/* Transaction Rows */}
                {pagedEntries.map((e, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-700 font-sans">{e.date}</td>
                    <td className="px-4 py-2.5 font-sans">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                        e.documentType === 'PurchaseBill' ? 'bg-blue-50 text-blue-700' :
                        e.documentType === 'PaymentOut' ? 'bg-emerald-50 text-emerald-700' :
                        e.documentType === 'PurchaseReturn' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {e.documentType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-blue-600">{e.documentNumber || '—'}</td>
                    <td className="px-4 py-2.5 font-sans text-slate-600 max-w-xs truncate">{e.description || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700 font-semibold">
                      {Number(e.debit) > 0 ? `₹${numIN(e.debit)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-rose-600 font-semibold">
                      {Number(e.credit) > 0 ? `₹${numIN(e.credit)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                      ₹{numIN(Math.abs(e.balance || 0))} {e.balanceType || ((e.balance || 0) >= 0 ? 'Cr' : 'Dr')}
                    </td>
                  </tr>
                ))}

                {/* Closing Balance Row */}
                <tr className="bg-slate-100/70 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="px-4 py-3 font-sans">{dateTo || 'Today'}</td>
                  <td className="px-4 py-3 font-sans uppercase">Closing Balance</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3 font-sans font-normal text-slate-600">Balance c/f</td>
                  <td className="px-4 py-3 text-right text-emerald-700">₹{numIN(totals.debits)}</td>
                  <td className="px-4 py-3 text-right text-rose-600">₹{numIN(totals.credits)}</td>
                  <td className="px-4 py-3 text-right text-base text-blue-700 font-bold">
                    ₹{numIN(Math.abs(ledger.closingBalance || 0))} {ledger.balanceType || ((ledger.closingBalance || 0) >= 0 ? 'Cr' : 'Dr')}
                  </td>
                </tr>
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={(ledger.entries || []).length}
              onPageChange={setPage}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
