import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useERP } from '../../context/ERPContext';
import { isBackendEnabled } from '../../services/backendSync';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/common/PageHeader';
import TablePagination from '../../components/ui/TablePagination';
import { RefreshCw, Check, X, AlertTriangle, Users, FileText, IndianRupee } from 'lucide-react';

const billMatchingGuide = {
  title: 'Bill Matching',
  subtitle: 'Match vendor bills against POs and GRNs, then approve them for payment.',
  purpose: 'Bill Matching runs a 3-way check (PO vs GRN vs vendor bill) on every manually entered supplier invoice. Matched bills can be approved, which releases the linked Purchase Bill toward Payment Out.',
  keyTerms: [
    { term: '3-Way Matching', definition: 'PO quantity/rate compared with GRN received quantity and billed quantity/rate.' },
    { term: 'Approval', definition: 'A mismatched bill must be approved before it can be sent for matching.' },
    { term: 'Purchase Bill', definition: 'The official bill auto-created once a vendor bill passes matching.' },
  ],
  tips: [
    'Recheck matching after correcting quantities or rates on the vendor bill.',
    'Approve mismatched bills with remarks so the variance is recorded in history.',
  ],
  workflow: ['Vendor Bill', 'PO vs GRN vs Bill Matching', 'Approval', 'Purchase Bill', 'Payment Out'],
};

function Tick({ ok }) {
  return ok
    ? <span className="text-emerald-600 font-bold">✓</span>
    : <span className="text-rose-600 font-bold">✗</span>;
}

function num(v) {
  return Number(v) || 0;
}

/** Plain 2-decimal number (table cells show 12.00 / 1,200.00 without ₹). */
function fmt2(v) {
  return (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Meter qty as shown in the design: "100 M". */
function fmtQty(v) {
  const q = Number(v) || 0;
  return `${Number.isInteger(q) ? q : q.toFixed(2)} M`;
}

/** Signed qty difference: "-1 M" / "+2 M". */
function fmtQtyDiff(d) {
  const q = Number(d) || 0;
  const body = Number.isInteger(q) ? Math.abs(q) : Math.abs(q).toFixed(2);
  return `${q > 0 ? '+' : q < 0 ? '-' : ''}${body} M`;
}

/** Signed money difference: "+₹483.00" / "-₹10.00". */
function fmtMoneyDiff(d) {
  const m = Number(d) || 0;
  return `${m > 0 ? '+' : ''}₹${fmt2(m)}`;
}

export const BillMatchingPage = () => {
  const navigate = useNavigate();
  const {
    vendorBills = [],
    purchaseOrders = [],
    purchaseBills = [],
    getVendorBillMatching,
    recheckVendorBillMatching,
    getVendorBillApprovalHistory,
    approveVendorBill,
    rejectVendorBill,
    sendVendorBillForMatching,
    formatCurrency,
    formatDateDDMMYYYY,
  } = useERP();

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Pending Matching');
  const [selectedId, setSelectedId] = useState(null);
  const [matching, setMatching] = useState(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingFailed, setMatchingFailed] = useState(false);
  const [history, setHistory] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [remarksError, setRemarksError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  // Login session (JWT) lasts 60 minutes. When it lapses the page keeps
  // showing cached data but every write is blocked — surface that explicitly
  // instead of a bare toast after each click.
  const [authed, setAuthed] = useState(() => isBackendEnabled());
  useEffect(() => {
    const sync = () => setAuthed(isBackendEnabled());
    window.addEventListener('evenmore:unauthorized', sync);
    window.addEventListener('evenmore:authorized', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('evenmore:unauthorized', sync);
      window.removeEventListener('evenmore:authorized', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const matchStatusOf = (b) => b?.matchStatus || b?.matchResult?.overallStatus
    || (b?.purchaseBillId ? 'Matched' : 'Pending Matching');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (vendorBills || []).filter((b) => {
      if (statusFilter && statusFilter !== 'All') {
        const ms = matchStatusOf(b);
        const st = b.status || '';
        if (statusFilter === 'Pending Matching' && ms !== 'Pending Matching' && ms !== 'Pending') return false;
        if (statusFilter === 'Mismatch' && (ms !== 'Mismatch' && b?.matchResult?.overallStatus !== 'Mismatch')) return false;
        if (statusFilter === 'Matched' && (ms !== 'Matched' && ms !== 'Match' && !b.purchaseBillId)) return false;
        if (statusFilter === 'Approved' && st !== 'Approved') return false;
      }
      if (!term) return true;
      const hay = [b.vendorBillNumber, b.billNumber, b.vendor, b.vendorName, b.poNumber]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [vendorBills, search, statusFilter]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const pagedFiltered = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      const pending = filtered.find((b) => matchStatusOf(b) === 'Pending Matching' || matchStatusOf(b) === 'Pending');
      setSelectedId((pending || filtered[0]).id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length]);

  // Deep-link ?bill=<id> (Send for Matching redirects here): pre-select that
  // bill once it exists in state (vendorBills may arrive after navigation).
  useEffect(() => {
    const wanted = searchParams.get('bill');
    if (wanted && (vendorBills || []).some((b) => String(b.id) === String(wanted)) && wanted !== selectedId) {
      setSelectedId(wanted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, vendorBills]);

  const selected = useMemo(
    () => (vendorBills || []).find((b) => b.id === selectedId) || null,
    [vendorBills, selectedId],
  );

  const loadMatching = async (id) => {
    if (!id || !getVendorBillMatching) return;
    // Use the cached result first (stored by recheck / failed-send stash) so
    // the table renders instantly; then refresh live from the server.
    const cached = (vendorBills || []).find((b) => String(b.id) === String(id))?.matchResult;
    if (cached?.lines) setMatching(cached);
    setMatchingLoading(true);
    setMatchingFailed(false);
    try {
      const data = await getVendorBillMatching(id);
      if (data) {
        setMatching(data);
      } else if (!cached?.lines) {
        setMatching(null);
        setMatchingFailed(true);
      }
    } catch {
      if (!cached?.lines) {
        setMatching(null);
        setMatchingFailed(true);
      }
    } finally {
      setMatchingLoading(false);
    }
  };

  useEffect(() => {
    setMatching(null);
    setMatchingFailed(false);
    setHistory([]);
    if (selectedId) {
      loadMatching(selectedId);
      if (getVendorBillApprovalHistory) {
        getVendorBillApprovalHistory(selectedId).then((h) => {
          if (Array.isArray(h)) setHistory(h);
        }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleRecheck = async () => {
    if (!selected || !recheckVendorBillMatching) return;
    setMatchingLoading(true);
    try {
      const data = await recheckVendorBillMatching(selected.id);
      if (data) setMatching(data);
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selected || !approveVendorBill) return;
    // Releasing a payable against a variance needs a recorded reason.
    if (isMismatch && !remarks.trim()) {
      setRemarksError('Enter remarks explaining the variance before approving a mismatched bill.');
      return;
    }
    setRemarksError('');
    setActionBusy(true);
    try {
      const approved = await approveVendorBill(selected.id, remarks);
      if (!approved) return;
      setRemarks('');
      const h = getVendorBillApprovalHistory ? await getVendorBillApprovalHistory(selected.id).catch(() => []) : [];
      if (Array.isArray(h)) setHistory(h);
      // Approve → auto send-for-matching → land on the created Purchase Bill
      // entry where it can be paid. Stays here if sending fails.
      if (sendVendorBillForMatching) {
        const sent = await sendVendorBillForMatching(selected.id);
        const pbId = sent?.purchaseBillId;
        if (pbId) navigate(`/purchase/bills?bill=${pbId}`);
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !rejectVendorBill) return;
    setActionBusy(true);
    try {
      await rejectVendorBill(selected.id, remarks);
      setRemarks('');
      const h = getVendorBillApprovalHistory ? await getVendorBillApprovalHistory(selected.id).catch(() => []) : [];
      if (Array.isArray(h)) setHistory(h);
    } finally {
      setActionBusy(false);
    }
  };

  const lines = matching?.lines || [];
  const summary = matching?.summary || {};
  const overallStatus = matching?.overallStatus || selected?.matchResult?.overallStatus || null;
  const isMismatch = overallStatus === 'Mismatch';
  const isMatch = overallStatus === 'Match';

  const poNumber = matching?.poNumber || selected?.poNumber
    || purchaseOrders.find((p) => p.id === selected?.purchaseOrderId)?.poNumber || '—';
  const grnBill = selected?.grnId ? purchaseBills.find((p) => p.id === selected.grnId) : null;
  const grnNumber = matching?.grnNumber || grnBill?.billNumber || selected?.grnId || '—';

  // Mismatch cards: summary keys differ between backend revisions
  // (qtyDiff vs qtyDifference), so resolve with fallbacks to first-line values.
  const firstLine = lines[0] || {};
  const mPOQty = summary.poQty ?? firstLine.poQty ?? 0;
  const mBillQty = summary.billQty ?? firstLine.billQty ?? 0;
  const mQtyDiff = summary.qtyDifference ?? summary.qtyDiff ?? (num(mBillQty) - num(mPOQty));
  const mPORate = summary.poRate ?? firstLine.poRate ?? 0;
  const mBillRate = summary.billRate ?? firstLine.billRate ?? 0;
  const mRateDiff = summary.rateDifference ?? summary.rateDiff ?? (num(mBillRate) - num(mPORate));
  const mPOAmount = summary.poAmount ?? firstLine.poAmount ?? 0;
  const mBillAmount = summary.billAmount ?? firstLine.billAmount ?? 0;
  const mAmountDiff = summary.amountDifference ?? summary.amountDiff ?? (num(mBillAmount) - num(mPOAmount));

  const mergedHistory = useMemo(() => {
    const local = selected?.approvalHistory || [];
    const combined = [...local, ...history];
    const seen = new Set();
    return combined.filter((h) => {
      const key = `${h?.at}|${h?.by}|${h?.action}|${h?.remarks}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [selected, history]);

  const isPending = (selected?.status || 'Pending') === 'Pending';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bill Matching"
        subtitle="Match vendor bills against POs and GRNs, then approve them for payment."
        guide={billMatchingGuide}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* Left: bill selector */}
        <div className="bg-white border border-[#CED4DA] rounded-lg overflow-hidden flex flex-col max-h-[1200px]">
          <div className="px-4 py-3 border-b border-slate-100 space-y-2">
            <input
              type="text"
              value={search}
              onChange={(ev) => setSearch(ev.target.value)}
              placeholder="Search bills..."
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
            />
            <select value={statusFilter} onChange={(ev) => setStatusFilter(ev.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 bg-white">
              <option value="All">All</option>
              <option value="Pending Matching">Pending Matching</option>
              <option value="Mismatch">Mismatch</option>
              <option value="Matched">Matched</option>
              <option value="Approved">Approved</option>
            </select>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">No vendor bills found.</div>
            ) : pagedFiltered.map((b) => (
              <button
                key={b.id}
                onClick={() => { setSelectedId(b.id); setSearchParams({ bill: b.id }); }}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer ${b.id === selectedId ? 'bg-blue-50/60 border-l-2 border-l-blue-600' : 'border-l-2 border-l-transparent'}`}
              >
                <p className="font-mono font-bold text-xs text-slate-800">{b.vendorBillNumber || b.billNumber}</p>
                <p className="text-[11px] text-slate-500 truncate">{b.vendor || b.vendorName}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono font-bold text-xs text-slate-900">{formatCurrency(Number(b.total ?? b.amount) || 0)}</span>
                  <StatusBadge status={b.status} />
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-slate-100">
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            />
          </div>
        </div>

        {/* Main */}
        <div className="space-y-4 min-w-0">
          {!authed && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-xs text-amber-900 font-semibold flex items-center justify-between gap-3 flex-wrap">
              <span>Session expired — showing saved data. Log in again to approve, reject or recheck. Nothing is lost.</span>
              <a href="/login" className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold whitespace-nowrap">
                Log in again
              </a>
            </div>
          )}
          {!selected ? (
            <div className="bg-white border border-[#CED4DA] rounded-lg p-10 text-center text-slate-500 text-sm">
              No vendor bills yet — create one in Vendor Bills first.
            </div>
          ) : (
            <>
              {/* Step 4: matching table — PO vs GRN vs Vendor Bill */}
              <div className="bg-white border border-[#CED4DA] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-bold text-[15px] text-[#1F2E4A]">
                      {matching?.isAgencyMatch ? 'Agency Bill Match (Original PO + Final JW PO + Invoice)' : 'PO vs GRN vs Vendor Bill Matching'}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {matching?.isAgencyMatch
                        ? `Agency reconciliation against Final JW PO (${matching?.finalPoNumber || 'Final PO'}) and Original PO (${matching?.originalPoNumber || 'PO'}).`
                        : 'System compares vendor bill with PO and GRN.'}
                    </p>
                  </div>
                  <Button icon={RefreshCw} onClick={handleRecheck} disabled={matchingLoading || !authed}>
                    Recheck Matching
                  </Button>
                </div>
                {matchingLoading ? (
                  <div className="p-8 text-center text-slate-500 text-xs">Loading matching result...</div>
                ) : matching ? (
                  <>
                    {matching?.isAgencyMatch && matching?.productionVariance && (
                      <div className="bg-blue-50/70 border-b border-blue-100 px-5 py-2.5 flex items-center justify-between text-xs text-blue-900 gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                          <span>
                            <strong>Production Yield Audit:</strong> Original PO instructed <span className="font-mono font-bold">{matching.productionVariance.originalInstructedQty} M</span>, verified production yielded <span className="font-mono font-bold">{matching.productionVariance.finalVerifiedQty} M</span>
                            {matching.productionVariance.shortageQty > 0.05 && (
                              <span className="ml-1 text-slate-600">({matching.productionVariance.shortageQty.toFixed(2)} M legitimate shortage audited under Final JW PO)</span>
                            )}.
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded">
                          Agency Job Work
                        </span>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 font-semibold text-slate-500 tracking-wide border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-2 text-center w-8">#</th>
                            <th className="py-2.5 px-2">Fabric</th>
                            <th className="py-2.5 px-2 text-right">{matching?.isAgencyMatch ? 'Final JW Qty' : 'PO Qty (M)'}</th>
                            <th className="py-2.5 px-2 text-right">{matching?.isAgencyMatch ? 'Orig PO Qty' : 'GRN Qty (M)'}</th>
                            <th className="py-2.5 px-2 text-right">Bill Qty (M)</th>
                            <th className="py-2.5 px-2 text-right">{matching?.isAgencyMatch ? 'Final Rate (₹/M)' : 'PO Rate (₹/M)'}</th>
                            <th className="py-2.5 px-2 text-right">Bill Rate (₹/M)</th>
                            <th className="py-2.5 px-2 text-right">{matching?.isAgencyMatch ? 'Final Amount (₹)' : 'PO Amount (₹)'}</th>
                            <th className="py-2.5 px-2 text-right">Bill Amount (₹)</th>
                            <th className="py-2.5 px-2 text-center">Qty Match</th>
                            <th className="py-2.5 px-2 text-center">Rate Match</th>
                            <th className="py-2.5 px-2 text-center">Amount Match</th>
                            <th className="py-2.5 px-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lines.length === 0 ? (
                            <tr><td colSpan={14} className="p-6 text-center text-slate-400">No matching lines returned.</td></tr>
                          ) : lines.map((l, idx) => (
                            <tr key={l.lineNo ?? idx} className="hover:bg-slate-50/70">
                              <td className="p-2 font-mono text-slate-400 text-center">{l.lineNo ?? idx + 1}</td>
                              <td className="p-2">
                                <p className="font-semibold text-slate-700">{l.fabric || l.itemName || '—'}</p>
                                {l.sku && <span className="text-[10px] text-slate-400 font-mono">{l.sku}</span>}
                              </td>
                              <td className="p-2 text-right font-mono">{l.poQty ?? '—'}</td>
                              <td className="p-2 text-right font-mono">{l.grnQty ?? '—'}</td>
                              <td className="p-2 text-right font-mono">{l.billQty ?? '—'}</td>
                              <td className="p-2 text-right font-mono">{fmt2(l.poRate)}</td>
                              <td className="p-2 text-right font-mono">{fmt2(l.billRate)}</td>
                              <td className="p-2 text-right font-mono">{fmt2(l.poAmount)}</td>
                              <td className="p-2 text-right font-mono font-bold">{fmt2(l.billAmount)}</td>
                              <td className="p-2 text-center"><Tick ok={Boolean(l.qtyMatch)} /></td>
                              <td className="p-2 text-center"><Tick ok={Boolean(l.rateMatch)} /></td>
                              <td className="p-2 text-center"><Tick ok={Boolean(l.amountMatch)} /></td>
                              <td className="p-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${l.status === 'Match' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {l.status || '—'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {isMismatch ? (
                      <div className="border-t border-rose-100 bg-rose-50/50 px-5 py-4">
                        <p className="flex items-center gap-1.5 font-bold text-[13px] text-rose-700 mb-3">
                          <AlertTriangle size={14} /> Mismatch Details
                        </p>
                        {Array.isArray(matching?.reasons) && matching.reasons.length > 0 && (
                          <ul className="mb-3 list-disc space-y-0.5 pl-5 text-[11.5px] text-rose-800">
                            {matching.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                          </ul>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-white border border-rose-100 rounded-xl p-4 text-xs flex gap-3">
                            <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                              <Users size={15} />
                            </span>
                            <div className="space-y-1">
                              <p className="font-bold text-rose-700">Quantity Mismatch</p>
                              <p className="text-slate-600">PO Qty: <span className="font-mono font-bold text-slate-900">{fmtQty(mPOQty)}</span></p>
                              {summary.grnQty !== undefined && (
                                <p className="text-slate-600">GRN Qty: <span className="font-mono font-bold text-slate-900">{fmtQty(summary.grnQty)}</span></p>
                              )}
                              <p className="text-slate-600">Bill Qty: <span className="font-mono font-bold text-slate-900">{fmtQty(mBillQty)}</span></p>
                              <p className="text-slate-600">Difference{summary.grnQty !== undefined ? ' (Bill − GRN)' : ''}: <span className="font-mono font-bold text-rose-700">{fmtQtyDiff(mQtyDiff)}</span></p>
                            </div>
                          </div>
                          <div className="bg-white border border-rose-100 rounded-xl p-4 text-xs flex gap-3">
                            <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                              <IndianRupee size={15} />
                            </span>
                            <div className="space-y-1">
                              <p className="font-bold text-rose-700">Rate Mismatch</p>
                              <p className="text-slate-600">PO Rate: <span className="font-mono font-bold text-slate-900">₹{fmt2(mPORate)} / M</span></p>
                              <p className="text-slate-600">Bill Rate: <span className="font-mono font-bold text-slate-900">₹{fmt2(mBillRate)} / M</span></p>
                              <p className="text-slate-600">Difference: <span className="font-mono font-bold text-rose-700">{fmtMoneyDiff(mRateDiff)} / M</span></p>
                            </div>
                          </div>
                          <div className="bg-white border border-rose-100 rounded-xl p-4 text-xs flex gap-3">
                            <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                              <FileText size={15} />
                            </span>
                            <div className="space-y-1">
                              <p className="font-bold text-rose-700">Amount Mismatch</p>
                              <p className="text-slate-600">PO Amount: <span className="font-mono font-bold text-slate-900">₹{fmt2(mPOAmount)}</span></p>
                              <p className="text-slate-600">Bill Amount: <span className="font-mono font-bold text-slate-900">₹{fmt2(mBillAmount)}</span></p>
                              <p className="text-slate-600">Difference: <span className="font-mono font-bold text-rose-700">{fmtMoneyDiff(mAmountDiff)}</span></p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : isMatch ? (
                      <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-3 text-xs font-semibold text-emerald-800">
                        All quantities, rates and amounts match.
                      </div>
                    ) : null}
                  </>
                ) : matchingFailed ? (
                  <div className="p-8 text-center text-amber-700 bg-amber-50 text-xs font-semibold">
                    Matching needs backend connection — the server could not be reached, so no numbers are shown.
                  </div>
                ) : null}
              </div>

              {/* Step 5: approval workflow */}
              <div className="bg-white border border-[#CED4DA] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h3 className="font-bold text-[15px] text-[#1F2E4A]">Approval Workflow</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">If there is a mismatch, it goes for approval.</p>
                </div>
                <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                  {/* Bill summary */}
                  <div className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <p className="font-mono font-bold text-[13px] text-slate-900">{selected.vendorBillNumber || selected.billNumber}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isMismatch ? 'bg-rose-100 text-rose-700' : isMatch ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {overallStatus || matchStatusOf(selected)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <p className="flex justify-between gap-2"><span className="text-slate-400">Vendor</span><span className="font-semibold text-slate-800 text-right">{selected.vendor || selected.vendorName}</span></p>
                      <p className="flex justify-between gap-2"><span className="text-slate-400">{matching?.isAgencyMatch ? 'Orig PO No.' : 'PO No.'}</span><span className="font-mono text-slate-800">{matching?.originalPoNumber || poNumber}</span></p>
                      <p className="flex justify-between gap-2"><span className="text-slate-400">{matching?.isAgencyMatch ? 'Final JW PO' : 'GRN No.'}</span><span className="font-mono text-slate-800">{matching?.finalPoNumber || grnNumber}</span></p>
                      <p className="flex justify-between gap-2"><span className="text-slate-400">Bill Date</span><span className="font-mono text-slate-800">{formatDateDDMMYYYY(selected.billDate || selected.date)}</span></p>
                      <p className="flex justify-between gap-2"><span className="text-slate-400">Total Amount</span><span className="font-mono font-bold text-slate-900">{formatCurrency(Number(selected.total ?? selected.amount) || 0)}</span></p>
                      <p className="flex justify-between gap-2"><span className="text-slate-400">Remarks</span><span className="text-slate-700 text-right">{selected.remarks || selected.approvalRemarks || '—'}</span></p>
                    </div>
                  </div>

                  {/* Approval action */}
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-slate-400 font-semibold mb-2">Approval Action</p>
                    <textarea value={remarks} onChange={(ev) => setRemarks(ev.target.value)} rows={4} placeholder={isMismatch ? 'Approval remarks (required for a mismatched bill)' : 'Approval remarks (optional)'} className={`w-full border rounded-lg p-2 bg-white text-slate-800 placeholder:text-slate-400 ${remarksError ? 'border-rose-400' : 'border-slate-300'}`} />
                    {remarksError && <p className="text-[11px] font-semibold text-rose-600">{remarksError}</p>}
                    <div className="flex gap-2 mt-3">
                      <button onClick={handleApprove} disabled={!isPending || actionBusy || !authed} title={!authed ? 'Session expired — log in again' : undefined} className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                        <Check size={14} /> Approve Bill
                      </button>
                      <button onClick={handleReject} disabled={!isPending || actionBusy || !authed} title={!authed ? 'Session expired — log in again' : undefined} className="flex-1 px-3 py-2 bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-40 rounded-lg font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                        <X size={14} /> Reject Bill
                      </button>
                    </div>
                  </div>

                  {/* Approval history */}
                  <div className="border border-slate-200 rounded-xl p-4">
                    <p className="text-slate-400 font-semibold mb-3">Approval History</p>
                    {mergedHistory.length === 0 ? (
                      <p className="text-slate-400">No approvals yet.</p>
                    ) : (
                      <div className="relative pl-5 space-y-4 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200">
                        {mergedHistory.map((h, idx) => {
                          const action = String(h.action || '');
                          const dot = /reject/i.test(action)
                            ? 'bg-rose-500'
                            : /approv/i.test(action)
                              ? 'bg-emerald-500'
                              : /sent|submit|match/i.test(action)
                                ? 'bg-amber-500'
                                : 'bg-blue-500';
                          return (
                            <div key={idx} className="relative">
                              <span className={`absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full ${dot} ring-4 ring-white`} />
                              <p className="text-slate-500 font-mono text-[10px]">{h.at || ''}</p>
                              <p className="font-semibold text-slate-800">{action || '—'}</p>
                              {(h.by) && <p className="text-slate-500">by {h.by}</p>}
                              {h.remarks && <p className="text-slate-600 mt-0.5">{h.remarks}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillMatchingPage;
