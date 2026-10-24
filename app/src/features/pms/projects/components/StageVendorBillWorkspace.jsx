import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  FileText,
  Boxes,
  Truck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Plus,
  Building2,
  DollarSign,
  Calendar,
  FileSpreadsheet,
  Check,
  X,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../services/api';
import { getProjectPurchaseOrders } from '../../../../services/pmsSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { useERP } from '../../../../context/ERPContext';
import TablePagination from '../../../../components/ui/TablePagination';

function numIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function StageVendorBillWorkspace({
  project,
  stage,
  onSyncPipeline,
  onSelectStage,
}) {
  const navigate = useNavigate();
  const showToast = usePmsStore((s) => s.showToast);
  const toast = useMemo(
    () => ({
      success: (msg) => showToast?.(msg, 'success'),
      error: (msg) => showToast?.(msg, 'error'),
      info: (msg) => showToast?.(msg, 'info'),
    }),
    [showToast]
  );

  const {
    formatCurrency,
    formatDateDDMMYYYY,
    convertPurchaseOrderToBill,
    refreshCollections,
  } = useERP() || {};

  const projectId = project?.id;
  const stageSeq = stage?.sequence || 8;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [grnList, setGrnList] = useState([]);
  const [bills, setBills] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [vendorBillNumber, setVendorBillNumber] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [remarks, setRemarks] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Pagination for bills table
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setErrorMsg('');

      // 1. Fetch linked purchase orders for this project
      const poRes = await getProjectPurchaseOrders(projectId).catch(() => []);
      const poList = Array.isArray(poRes) ? poRes : (poRes?.data || poRes?.results || []);
      setPurchaseOrders(poList);

      const activePoItem = poList[0] || null;
      const poId = activePoItem?.id;
      const poNumber = activePoItem?.poNumber || activePoItem?.orderNumber;

      // 2. Fetch Bills and GRNs
      const [billsRes, grnRes] = await Promise.all([
        api.get('/purchase/bills/', { params: { limit: 50 } }).catch(() => []),
        api.get('/purchase/receipts/', { params: { limit: 50 } }).catch(() => []),
      ]);

      const rawBills = Array.isArray(billsRes) ? billsRes : (billsRes?.results || billsRes?.rows || billsRes?.data || []);
      const matchedBills = rawBills.filter((b) => {
        const bPoId = String(b.purchase_order || b.purchaseOrderId || b.poId || '');
        const bPoNum = b.poNumber || b.po_number || b.purchaseOrderNumber;
        const bNotes = (b.notes || b.remarks || '').toLowerCase();
        const pCode = (project?.code || '').toLowerCase();
        return (
          (poId && bPoId === String(poId)) ||
          (poNumber && bPoNum === poNumber) ||
          (pCode && bNotes.includes(pCode))
        );
      });
      setBills(matchedBills);

      const rawGrns = Array.isArray(grnRes) ? grnRes : (grnRes?.results || grnRes?.rows || grnRes?.data || []);
      const matchedGrns = rawGrns.filter((g) => {
        const gPoId = String(g.purchase_order || g.purchaseOrderId || g.poId || '');
        const gPoNum = g.poNumber || g.po_number || g.purchaseOrderNumber;
        const gRemarks = (g.remarks || g.notes || '').toLowerCase();
        const pCode = (project?.code || '').toLowerCase();
        return (
          (poId && gPoId === String(poId)) ||
          (poNumber && gPoNum === poNumber) ||
          (pCode && gRemarks.includes(pCode))
        );
      });
      setGrnList(matchedGrns);
    } catch (err) {
      console.warn('Failed to load vendor bill stage data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (onSyncPipeline) await onSyncPipeline();
    setRefreshing(false);
    toast.info('Vendor Bill stage refreshed.');
  };

  const activePo = purchaseOrders[0] || null;
  const poId = activePo?.id;
  const poNumber = activePo?.poNumber || activePo?.orderNumber || 'PO-Grey';

  // Total received meters across all matched GRNs
  const totalReceivedMeters = useMemo(() => {
    if (grnList.length > 0) {
      return grnList.reduce((sum, g) => {
        const direct = Number(g.totalQuantity || g.receivedQuantity || 0);
        if (direct > 0) return sum + direct;
        if (Array.isArray(g.lines)) {
          return sum + g.lines.reduce((lSum, l) => lSum + Number(l.received_qty || l.receivedQty || 0), 0);
        }
        return sum;
      }, 0);
    }
    return Number(activePo?.receivedQuantity || activePo?.receivedQty || (activePo?.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0) || 0);
  }, [grnList, activePo]);

  // Default lines for bill form
  const defaultLines = useMemo(() => {
    const rawItems = activePo?.items || activePo?.lineItems || [];
    if (!rawItems.length) {
      return [{
        itemId: '',
        itemName: activePo?.fabric || activePo?.material || 'Grey Fabric',
        orderedQty: totalReceivedMeters || activePo?.qty || 100,
        billingQty: totalReceivedMeters || activePo?.qty || 100,
        rate: Number(activePo?.rate || 120),
        amount: (totalReceivedMeters || activePo?.qty || 100) * Number(activePo?.rate || 120),
      }];
    }
    return rawItems.map((it) => {
      const lineQty = totalReceivedMeters > 0 ? totalReceivedMeters : Number(it.qty || 0);
      const lineRate = Number(it.rate || it.unitPrice || 0);
      return {
        id: it.id,
        itemId: it.itemId || it.id,
        itemName: it.name || it.itemName || it.fabric || 'Grey Fabric',
        orderedQty: Number(it.qty || 0),
        billingQty: lineQty,
        rate: lineRate,
        amount: lineQty * lineRate,
      };
    });
  }, [activePo, totalReceivedMeters]);

  const [formLines, setFormLines] = useState(defaultLines);

  useEffect(() => {
    if (defaultLines.length > 0) {
      setFormLines(defaultLines);
    }
  }, [defaultLines]);

  const handleLineQtyChange = (idx, newQty) => {
    const qty = Number(newQty) || 0;
    setFormLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, billingQty: qty, amount: qty * l.rate } : l))
    );
  };

  const handleLineRateChange = (idx, newRate) => {
    const rate = Number(newRate) || 0;
    setFormLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, rate, amount: l.billingQty * rate } : l))
    );
  };

  const formTotalAmount = useMemo(() => {
    return formLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  }, [formLines]);

  const handleCreateBill = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const generatedBillNo = vendorBillNumber || `INV-${poNumber}-${Date.now().toString().slice(-4)}`;
      const payload = {
        vendorId: activePo?.vendorId || activePo?.partyId || activePo?.supplierId,
        purchaseOrderId: poId,
        vendorBillNumber: generatedBillNo,
        date: billDate,
        dueDate: dueDate,
        notes: remarks || `Vendor Bill recorded against PO ${poNumber} for project ${project?.code || ''}`,
        items: formLines.map((l) => ({
          itemId: l.itemId,
          qty: Number(l.billingQty),
          rate: Number(l.rate),
          amount: Number(l.amount),
        })),
      };

      let createdBill = null;
      try {
        createdBill = await api.post('/purchase/bills/', payload);
      } catch (postErr) {
        if (convertPurchaseOrderToBill && poId) {
          createdBill = await convertPurchaseOrderToBill(poId);
        } else {
          throw postErr;
        }
      }

      const billNo = createdBill?.billNumber || createdBill?.bill_number || generatedBillNo;
      setSuccessMsg(`✓ Vendor Bill ${billNo} successfully recorded and linked to PO ${poNumber}!`);
      toast.success(`Vendor Bill ${billNo} recorded successfully.`);

      if (refreshCollections) {
        refreshCollections(['purchaseBills', 'purchaseOrders', 'vendorBills']);
      }

      setIsFormOpen(false);
      setVendorBillNumber('');
      await loadData();
      if (onSyncPipeline) {
        await onSyncPipeline();
      }
    } catch (err) {
      console.error('Failed to create vendor bill:', err);
      setErrorMsg(err?.message || 'Failed to record vendor bill.');
      toast.error(err?.message || 'Failed to record vendor bill.');
    } finally {
      setSubmitting(false);
    }
  };

  const hasRecordedBills = bills.length > 0;
  const pagedBills = useMemo(() => {
    const start = (page - 1) * pageSize;
    return bills.slice(start, start + pageSize);
  }, [bills, page, pageSize]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ── Stage Workspace Operational Panel ── */}
      <div className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-purple-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Supplier Tax Invoices & Commercial Bill Register
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Plus size={13} />
            {isFormOpen ? 'Close Entry Form' : 'Record Vendor Bill'}
          </button>
        </div>

        {/* ── 4 KPI Metric Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Linked Purchase PO</span>
            <span className="font-mono font-bold text-slate-900 truncate block">
              {poNumber}
            </span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 truncate block">
              Vendor: {activePo?.vendorName || activePo?.supplier || activePo?.partyName || 'Supplier'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Verified GRN Intake</span>
            <span className="font-mono font-bold text-blue-700">
              {numIN(totalReceivedMeters)} M
            </span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
              {grnList.length} Inward Receipt(s)
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Recorded Invoices</span>
            <span className="font-mono font-bold text-purple-700">
              {bills.length} Bill(s)
            </span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
              Total: ₹ {numIN(bills.reduce((s, b) => s + Number(b.total || b.amount || 0), 0))}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Stage Weight</span>
            <span className="font-mono font-bold text-slate-700">
              {stage?.weight || stage?.percentage || 3.34}% of Lifecycle
            </span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
              Handoff to 3-Way Matching
            </span>
          </div>
        </div>
      </div>

      {/* ── Inline Bill Entry Form (When opened) ── */}
      {isFormOpen && (
        <div className="rounded-2xl border-2 border-purple-400 bg-white p-5 shadow-md space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-purple-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Receipt size={16} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                New Supplier Invoice / Vendor Bill Entry
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X size={16} />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateBill} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Supplier Invoice Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={vendorBillNumber}
                  onChange={(e) => setVendorBillNumber(e.target.value)}
                  placeholder={`e.g. INV-${poNumber}-001`}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Invoice Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Payment Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
                />
              </div>
            </div>

            {/* Line items table */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Billed Items & Verified GRN Meterage
              </label>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Item / Fabric</th>
                      <th className="py-2.5 px-3 text-right">Ordered Qty</th>
                      <th className="py-2.5 px-3 text-right">Billed Qty (M)</th>
                      <th className="py-2.5 px-3 text-right">Rate (₹/M)</th>
                      <th className="py-2.5 px-3 text-right">Taxable Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formLines.map((line, idx) => (
                      <tr key={line.id || idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {line.itemName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {numIN(line.orderedQty)} M
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={line.billingQty}
                            onChange={(e) => handleLineQtyChange(idx, e.target.value)}
                            className="w-24 text-right border border-slate-300 rounded px-2 py-1 font-mono font-bold text-blue-700"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={line.rate}
                            onChange={(e) => handleLineRateChange(idx, e.target.value)}
                            className="w-20 text-right border border-slate-300 rounded px-2 py-1 font-mono text-slate-800"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ₹ {numIN(line.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/80 border-t border-slate-200 font-bold">
                      <td colSpan={4} className="py-2.5 px-3 text-right text-slate-700">
                        Total Invoice Value:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-purple-700 text-sm">
                        ₹ {numIN(formTotalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Remarks / Supplier Notes
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Mention payment terms, physical invoice filing reference, or tax note..."
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Recording Bill...' : 'Confirm & Save Vendor Bill'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Registered Vendor Bills Table ── */}
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-purple-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Registered Vendor Bills for PO {poNumber}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Strictly matched against physical GRNs and PO line pricing
          </span>
        </div>

        {bills.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/60 space-y-2">
            <Receipt size={32} className="mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-700">No Vendor Bill Recorded Yet</p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Grey fabric stock has been updated. Click "Record Vendor Bill" above to enter the invoice details received from {activePo?.vendorName || 'the supplier'}.
            </p>
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus size={13} /> Record Vendor Bill Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Bill / Invoice #</th>
                  <th className="py-2.5 px-3">Bill Date</th>
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3 text-right">Billed Quantity</th>
                  <th className="py-2.5 px-3 text-right">Invoice Amount</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedBills.map((b, idx) => {
                  const billNo = b.vendorBillNumber || b.billNumber || b.bill_number || `BILL-${idx + 1}`;
                  const bDate = b.date || b.billDate || '—';
                  const bSupplier = b.vendorName || b.supplierName || activePo?.vendorName || 'Supplier';
                  const bQty = b.totalQuantity || b.total_quantity || (b.items || []).reduce((s, it) => s + Number(it.qty || 0), 0) || totalReceivedMeters;
                  const bAmt = Number(b.total || b.amount || b.grandTotal || 0);
                  const bStatus = b.status || (b.match_status === 'Matched' ? 'Matched' : 'Pending Match');

                  return (
                    <tr key={b.id || idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-purple-700">
                        {billNo}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">
                        {bDate}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {bSupplier}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                        {numIN(bQty)} M
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ₹ {numIN(bAmt)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        {b.dueDate || '30 Days Net'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            bStatus === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : bStatus === 'Matched'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {bStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => navigate('/purchase/bills')}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-800 cursor-pointer"
                        >
                          <span>View in Bills</span>
                          <ExternalLink size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={bills.length}
              onPageChange={setPage}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      
    </div>
  );
}

export default StageVendorBillWorkspace;
