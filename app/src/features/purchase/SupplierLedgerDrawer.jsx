import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Printer,
  RefreshCw,
  Calendar,
  Building2,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Receipt,
  FileText,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import api from '../../services/api';
import { numIN, toDDMMYYYY } from '../../utils/formatters';
import TablePagination from '../../components/ui/TablePagination';
import PrintSupplierStatementModal from './PrintSupplierStatementModal';

export function SupplierLedgerDrawer({
  isOpen,
  onClose,
  supplier,
  onRefreshSupplierList,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ledgerData, setLedgerData] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Pagination for the Statement of Account table inside the drawer
  const [statementPage, setStatementPage] = useState(1);
  const [statementPageSize, setStatementPageSize] = useState(15);

  // Collapsible section states (Statement expanded by default, others collapsible)
  const [collapsedSections, setCollapsedSections] = useState({
    statement: false,
    pendingBills: false,
    payments: true,
    notes: true,
  });

  const toggleSection = (sectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Close drawer on Escape key and prevent background body scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Fetch supplier or customer ledger data
  const fetchLedger = useCallback(async () => {
    if (!supplier?.id) return;
    setLoading(true);
    setError(null);
    try {
      const query = { vendorId: supplier.id };
      if (dateFrom) query.dateFrom = dateFrom;
      if (dateTo) query.dateTo = dateTo;

      const res = await api.get('/purchase/receipts/supplier-ledger/', { query });
      setLedgerData(res || null);
    } catch (err) {
      console.error('Failed to load ledger:', err);
      setError(err?.message || 'Failed to load ledger details for this account.');
    } finally {
      setLoading(false);
    }
  }, [supplier?.id, dateFrom, dateTo]);

  useEffect(() => {
    if (isOpen && supplier?.id) {
      setStatementPage(1);
      fetchLedger();
    }
  }, [isOpen, supplier?.id, fetchLedger]);

  const handleClearDates = () => {
    setDateFrom('');
    setDateTo('');
  };

  const isCustomer = supplier?.type === 'Customer';
  const partyLabel = isCustomer ? 'Customer' : 'Supplier';

  // Derived financial summary
  const summary = ledgerData?.summary || {};
  const entries = useMemo(() => ledgerData?.entries || [], [ledgerData?.entries]);
  const pendingBills = useMemo(() => ledgerData?.pendingBills || [], [ledgerData?.pendingBills]);
  const payments = useMemo(() => ledgerData?.payments || [], [ledgerData?.payments]);
  const notes = useMemo(() => ledgerData?.notes || [], [ledgerData?.notes]);

  const openingBalance = Number(summary.openingBalance ?? ledgerData?.openingBalance ?? supplier?.opening_balance ?? 0);
  const totalDebits = Number(summary.totalDebits ?? 0);
  const totalCredits = Number(summary.totalCredits ?? 0);
  const closingBalance = Number(summary.closingBalance ?? ledgerData?.closingBalance ?? supplier?.balance ?? 0);
  
  const defaultBalType = isCustomer
    ? (closingBalance >= 0 ? 'Dr' : 'Cr')
    : (closingBalance >= 0 ? 'Cr' : 'Dr');
  const balanceType = summary.balanceType || ledgerData?.balanceType || defaultBalType;

  // Paged entries for the Statement of Account table
  const pagedStatementEntries = useMemo(() => {
    const start = (statementPage - 1) * statementPageSize;
    return entries.slice(start, start + statementPageSize);
  }, [entries, statementPage, statementPageSize]);

  if (!isOpen || !supplier) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-in fade-in duration-150"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`${partyLabel} Ledger - ${supplier.name}`}
      >
        <div
          className="bg-white w-full lg:w-[62vw] max-w-5xl h-full shadow-2xl rounded-l-2xl border-l border-slate-200 flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-4 shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {supplier.code || (isCustomer ? 'CUST' : 'VEND')}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {partyLabel} Ledger Drawer
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {supplier.name}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 text-xs">
                {supplier.gstin && (
                  <span className="flex items-center gap-1 font-mono">
                    <span className="text-slate-400 font-sans">GSTIN:</span> {supplier.gstin}
                  </span>
                )}
                {supplier.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={11} className="text-slate-400" /> {supplier.phone}
                  </span>
                )}
                {supplier.email && (
                  <span className="flex items-center gap-1">
                    <Mail size={11} className="text-slate-400" /> {supplier.email}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Current Live Balance Tag */}
              <div className="hidden sm:flex flex-col items-end bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Live Balance
                </span>
                <span className="font-mono font-extrabold text-sm text-slate-900">
                  ₹{numIN(Math.abs(closingBalance))}{' '}
                  <span
                    className={`text-xs font-bold ${
                      isCustomer
                        ? balanceType === 'Dr'
                          ? 'text-blue-700'
                          : 'text-emerald-700'
                        : balanceType === 'Cr'
                        ? 'text-emerald-700'
                        : 'text-blue-700'
                    }`}
                  >
                    {balanceType}{' '}
                    {isCustomer
                      ? balanceType === 'Dr'
                        ? '(Receivable)'
                        : '(Advance)'
                      : balanceType === 'Cr'
                      ? '(Payable)'
                      : '(Advance)'}
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                title="Close Drawer (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Action / Date Filter Strip */}
          <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            {/* Left: Date Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                <Calendar size={13} className="text-slate-400" />
                <span>Period:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  title="From Date"
                />
                <span className="text-slate-400 text-xs font-medium">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  title="To Date"
                />
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={handleClearDates}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold px-1.5 py-1 rounded cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchLedger}
                disabled={loading}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Refresh Ledger"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                disabled={loading || !ledgerData}
                className="px-3.5 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-xs"
                title={`Print Official ${partyLabel} Statement`}
              >
                <Printer size={13} />
                <span>Print Statement</span>
              </button>
            </div>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
            {/* Loading Indicator */}
            {loading && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5 text-blue-800 text-xs">
                <RefreshCw size={14} className="animate-spin text-blue-600" />
                <span>Calculating live ledger balances and fetching transaction details from database...</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800 text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchLedger}
                  className="font-bold underline text-rose-700 hover:text-rose-900 cursor-pointer ml-3"
                >
                  Retry
                </button>
              </div>
            )}

            {/* 4 Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* 1. Opening Balance */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Opening Balance
                </span>
                <p className="font-mono text-lg font-extrabold text-slate-900 tracking-tight">
                  ₹{numIN(Math.abs(openingBalance))}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">
                  {isCustomer
                    ? openingBalance >= 0
                      ? 'Dr (Receivable b/f)'
                      : 'Cr (Advance b/f)'
                    : openingBalance >= 0
                    ? 'Cr (Payable b/f)'
                    : 'Dr (Advance b/f)'}
                </span>
              </div>

              {/* 2. Total Debits */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total Debits
                  </span>
                  <span className="p-1 rounded-md bg-rose-50 text-rose-600">
                    <ArrowDownLeft size={13} />
                  </span>
                </div>
                <p className="font-mono text-lg font-extrabold text-rose-600 tracking-tight">
                  ₹{numIN(totalDebits)}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">
                  {isCustomer ? 'Invoices billed & debits' : 'Payments made & returns'}
                </span>
              </div>

              {/* 3. Total Credits */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total Credits
                  </span>
                  <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                    <ArrowUpRight size={13} />
                  </span>
                </div>
                <p className="font-mono text-lg font-extrabold text-emerald-600 tracking-tight">
                  ₹{numIN(totalCredits)}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">
                  {isCustomer ? 'Receipts & credits received' : 'Purchases & incoming bills'}
                </span>
              </div>

              {/* 4. Closing Balance */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Closing Balance
                  </span>
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                      isCustomer
                        ? balanceType === 'Dr'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                        : balanceType === 'Cr'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {balanceType}
                  </span>
                </div>
                <p className="font-mono text-lg font-extrabold text-slate-900 tracking-tight">
                  ₹{numIN(Math.abs(closingBalance))}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">
                  {isCustomer
                    ? balanceType === 'Dr'
                      ? 'Total outstanding receivable'
                      : 'Advance customer credit'
                    : balanceType === 'Cr'
                    ? 'Commercial amount payable'
                    : 'Advance standing balance'}
                </span>
              </div>
            </div>

            {/* ── SECTION 1: Statement of Account (Collapsible) ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('statement')}
                className="w-full px-5 py-3.5 bg-slate-50/70 hover:bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-left transition cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5">
                  <FileText size={16} className="text-blue-600" />
                  <span className="font-bold text-sm text-slate-900">Statement of Account</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                    {entries.length} {entries.length === 1 ? 'transaction' : 'transactions'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 hover:text-slate-600">
                  <span className="text-[11px] font-semibold">
                    {collapsedSections.statement ? 'Expand' : 'Collapse'}
                  </span>
                  {collapsedSections.statement ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
              </button>

              {!collapsedSections.statement && (
                <div className="flex flex-col">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-3">Voucher Type</th>
                          <th className="py-2.5 px-3">Document #</th>
                          <th className="py-2.5 px-3">Narration / Particulars</th>
                          <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                          <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                          <th className="py-2.5 px-4 text-right">Running Balance (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {/* Opening Balance Row */}
                        <tr className="bg-slate-50/40 text-slate-500 font-semibold text-[11px]">
                          <td className="py-2.5 px-4 font-mono text-[11px]">—</td>
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                              OPENING
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">—</td>
                          <td className="py-2.5 px-3 italic">Balance Brought Forward</td>
                          <td className="py-2.5 px-3 text-right font-mono">—</td>
                          <td className="py-2.5 px-3 text-right font-mono">—</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">
                            ₹{numIN(Math.abs(openingBalance))}{' '}
                            {isCustomer
                              ? openingBalance >= 0
                                ? 'Dr'
                                : 'Cr'
                              : openingBalance >= 0
                              ? 'Cr'
                              : 'Dr'}
                          </td>
                        </tr>

                        {entries.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-slate-400 italic text-xs">
                              No ledger entries found for this {partyLabel.toLowerCase()} within the selected date range.
                            </td>
                          </tr>
                        ) : (
                          pagedStatementEntries.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                {toDDMMYYYY(row.date)}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    row.documentType?.includes('Payment') || row.documentType?.includes('Receipt')
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : row.documentType?.includes('Invoice') || row.documentType?.includes('Bill')
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                  }`}
                                >
                                  {row.documentType || 'Journal'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                                {row.documentNumber || '—'}
                              </td>
                              <td
                                className="py-2.5 px-3 text-slate-600 max-w-[260px] truncate"
                                title={row.description}
                              >
                                {row.description || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                                {Number(row.debit) > 0 ? `₹${numIN(row.debit)}` : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                                {Number(row.credit) > 0 ? `₹${numIN(row.credit)}` : '—'}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                                ₹{numIN(Math.abs(Number(row.balance || 0)))}{' '}
                                <span className="text-[10px] text-slate-500 font-semibold">
                                  {row.balanceType || (isCustomer ? 'Dr' : 'Cr')}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {entries.length > statementPageSize && (
                    <TablePagination
                      total={entries.length}
                      page={statementPage}
                      pageSize={statementPageSize}
                      onPageChange={setStatementPage}
                      onPageSizeChange={setStatementPageSize}
                      pageSizeOptions={[10, 15, 25, 50]}
                      className="border-t border-slate-200"
                    />
                  )}
                </div>
              )}
            </div>

            {/* ── SECTION 2: Invoices / Bills (Collapsible) ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('pendingBills')}
                className="w-full px-5 py-3.5 bg-slate-50/70 hover:bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-left transition cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5">
                  <Receipt size={16} className="text-amber-600" />
                  <span className="font-bold text-sm text-slate-900">
                    {isCustomer ? 'Sales Invoices (Billed & Open)' : 'Pending & Billed Invoices'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
                    {pendingBills.length} {pendingBills.length === 1 ? 'doc' : 'docs'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 hover:text-slate-600">
                  <span className="text-[11px] font-semibold">
                    {collapsedSections.pendingBills ? 'Expand' : 'Collapse'}
                  </span>
                  {collapsedSections.pendingBills ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
              </button>

              {!collapsedSections.pendingBills && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        <th className="py-2.5 px-4">{isCustomer ? 'Invoice #' : 'Bill Number'}</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3 text-right">Paid Amount (₹)</th>
                        <th className="py-2.5 px-3 text-right">Balance Due (₹)</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {pendingBills.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 italic text-xs">
                            No invoices recorded for this {partyLabel.toLowerCase()}.
                          </td>
                        </tr>
                      ) : (
                        pendingBills.map((bill) => (
                          <tr key={bill.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                              {bill.billNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {toDDMMYYYY(bill.billDate)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                              ₹{numIN(bill.billAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                              ₹{numIN(bill.paidAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                              <span className={bill.balanceDue > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-400'}>
                                ₹{numIN(bill.balanceDue)}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  bill.status === 'Paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : bill.status === 'Partial'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {bill.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── SECTION 3: Payments (Collapsible) ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('payments')}
                className="w-full px-5 py-3.5 bg-slate-50/70 hover:bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-left transition cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard size={16} className="text-emerald-600" />
                  <span className="font-bold text-sm text-slate-900">
                    {isCustomer ? 'Customer Receipts (Payments In)' : 'Payments Out'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                    {payments.length} {payments.length === 1 ? 'record' : 'records'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 hover:text-slate-600">
                  <span className="text-[11px] font-semibold">
                    {collapsedSections.payments ? 'Expand' : 'Collapse'}
                  </span>
                  {collapsedSections.payments ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
              </button>

              {!collapsedSections.payments && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        <th className="py-2.5 px-4">{isCustomer ? 'Receipt #' : 'Payment #'}</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3">Reference / UTR</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 italic text-xs">
                            No payment/receipt records found for this {partyLabel.toLowerCase()}.
                          </td>
                        </tr>
                      ) : (
                        payments.map((pm) => (
                          <tr key={pm.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                              {pm.paymentNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {toDDMMYYYY(pm.paymentDate)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                              {pm.paymentMode || 'Bank Transfer'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                              ₹{numIN(pm.paymentAmount)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {pm.reference || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  pm.status === 'Active'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {pm.status || 'Active'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── SECTION 4: Debit / Credit Notes (Collapsible) ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('notes')}
                className="w-full px-5 py-3.5 bg-slate-50/70 hover:bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-left transition cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard size={16} className="text-purple-600" />
                  <span className="font-bold text-sm text-slate-900">Debit & Credit Notes</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800">
                    {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 hover:text-slate-600">
                  <span className="text-[11px] font-semibold">
                    {collapsedSections.notes ? 'Expand' : 'Collapse'}
                  </span>
                  {collapsedSections.notes ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
              </button>

              {!collapsedSections.notes && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        <th className="py-2.5 px-4">Note Number</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Note Type</th>
                        <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {notes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 italic text-xs">
                            No debit or credit notes recorded for this {partyLabel.toLowerCase()}.
                          </td>
                        </tr>
                      ) : (
                        notes.map((note) => (
                          <tr key={note.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                              {note.noteNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {toDDMMYYYY(note.date)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  note.noteType?.toLowerCase().includes('debit')
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {note.noteType}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                              ₹{numIN(note.amount)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate" title={note.reason}>
                              {note.reason || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-center whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {note.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print Statement Modal */}
      <PrintSupplierStatementModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        supplier={supplier}
        ledger={ledgerData}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </>
  );
}

export default SupplierLedgerDrawer;
