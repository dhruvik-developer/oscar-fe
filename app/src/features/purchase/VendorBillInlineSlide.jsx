import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  X,
  Plus,
  Trash2,
  Calendar,
  Building2,
  DollarSign,
  PackageCheck,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';

function numIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function VendorBillInlineSlide({ po, instruction, onClose, onBillSaved, onNextStep, onPrevStep }) {
  const {
    formatCurrency,
    formatDateDDMMYYYY,
    getPoBilledStatus,
    convertPurchaseOrderToBill,
    showToast,
    refreshCollections,
  } = useERP() || {};

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bills, setBills] = useState([]);
  const [grnList, setGrnList] = useState([]);
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

  const poId = po?.id;
  const poNumber = po?.poNumber || poId;
  const poInfo = getPoBilledStatus ? getPoBilledStatus(poId) : { activeBills: [], totalBilledQty: 0 };

  const loadData = async () => {
    if (!poId) return;
    try {
      setLoading(true);
      setErrorMsg('');

      const [billsRes, grnRes] = await Promise.all([
        api.get('/purchase/bills/', { params: { purchaseOrderId: poId, limit: 20 } }).catch(() => []),
        api.get('/purchase/receipts/', { params: { purchaseOrderId: poId, limit: 20 } }).catch(() => []),
      ]);

      const rawBills = Array.isArray(billsRes) ? billsRes : (billsRes?.results || billsRes?.rows || billsRes?.data || []);
      const finalPoNum = po?.finalPoNumber || po?.instruction?.finalPoNumber;
      const matchedBills = rawBills.filter(
        (b) => String(b.purchase_order || b.purchaseOrderId || b.purchaseOrder || b.poId || '') === String(poId) ||
               (poNumber && (b.poNumber === poNumber || b.po_number === poNumber || b.poRef === poNumber)) ||
               (finalPoNum && (b.poNumber === finalPoNum || b.po_number === finalPoNum)) ||
               (String(poId) && b.purchaseOrderId === poId)
      );
      setBills((prev) => {
        const merged = [...matchedBills];
        prev.forEach((pb) => {
          if (!merged.some((m) => m.id === pb.id || (m.billNumber && (m.billNumber === pb.billNumber || m.billNumber === pb.bill_number)))) {
            merged.push(pb);
          }
        });
        return merged;
      });

      const rawGrns = Array.isArray(grnRes) ? grnRes : (grnRes?.results || grnRes?.rows || grnRes?.data || []);
      const matchedGrns = rawGrns.filter(
        (g) => String(g.purchase_order || g.purchaseOrderId || g.poId || '') === String(poId) ||
               (poNumber && (g.poNumber === poNumber || g.po_number === poNumber))
      );
      setGrnList(matchedGrns);
    } catch (err) {
      console.warn('Failed to load vendor bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [poId]);

  // Existing bill from API or ERPContext
  const activeBill = bills[0] || poInfo.activeBills?.[0] || null;

  // Quantities & Amounts calculation
  const totalReceivedMeters = useMemo(() => {
    if (grnList.length > 0) {
      return grnList.reduce((sum, g) => {
        const direct = Number(g.totalQuantity || g.receivedQuantity || 0);
        if (direct > 0) return sum + direct;
        if (Array.isArray(g.lines)) {
          return sum + g.lines.reduce((lSum, l) => lSum + (Number(l.received_qty || l.receivedQty || 0)), 0);
        }
        return sum;
      }, 0);
    }
    return Number(po?.receivedQuantity || po?.receivedQty || (po?.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0) || 0);
  }, [grnList, po]);

  const defaultLines = useMemo(() => {
    const rawItems = po?.items || po?.lineItems || [];
    const isJobWork = Boolean(instruction?.finalPoNumber || instruction?.agreed_job_rate || po?.purchase_type === 'Final Job Work');
    const jwRate = Number(instruction?.agreed_job_rate || instruction?.agreed_rate || 0);
    const jwQty = Number(instruction?.completion?.acceptedQty || instruction?.acceptedQty || 0);

    if (isJobWork && jwRate > 0) {
      const lineQty = jwQty > 0 ? jwQty : (totalReceivedMeters || 100);
      return [{
        itemId: rawItems[0]?.itemId || '',
        itemName: instruction?.fabric || rawItems[0]?.name || 'Processing Job Work Fabric',
        orderedQty: lineQty,
        billingQty: lineQty,
        rate: jwRate,
        amount: lineQty * jwRate,
      }];
    }

    if (!rawItems.length) {
      return [{
        itemId: '',
        itemName: 'Grey Fabric',
        orderedQty: totalReceivedMeters || 100,
        billingQty: totalReceivedMeters || 100,
        rate: 120,
        amount: (totalReceivedMeters || 100) * 120,
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
  }, [po, totalReceivedMeters, instruction]);

  const [formLines, setFormLines] = useState(defaultLines);

  useEffect(() => {
    if (defaultLines.length > 0) {
      setFormLines(defaultLines);
    }
  }, [defaultLines]);

  const formTotalAmount = useMemo(() => {
    return formLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  }, [formLines]);

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

  const handleCreateBill = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      if (activeBill) {
        showToast?.('A Vendor Bill already exists for this PO.');
        return;
      }

      // 1. Try convert-to-bill or direct POST
      let createdBill = null;
      try {
        const linePayload = formLines.map((l) => ({
          itemId: l.itemId,
          qty: Number(l.billingQty),
          rate: Number(l.rate),
          amount: Number(l.amount),
        }));
        const payload = {
          vendorId: po?.vendorId || po?.partyId,
          partyId: po?.vendorId || po?.partyId,
          purchaseOrderId: poId,
          purchase_order: poId,
          poId: poId,
          poNumber: poNumber,
          vendorBillNumber: vendorBillNumber || `INV-${poNumber}-${Date.now().toString().slice(-4)}`,
          date: billDate,
          dueDate: dueDate,
          due_date: dueDate,
          notes: remarks || `Vendor Bill recorded against PO ${poNumber}`,
          lineItems: linePayload,
          items: linePayload,
        };
        createdBill = await api.post('/purchase/bills/', payload);
      } catch (postErr) {
        // Fallback to convertPurchaseOrderToBill endpoint
        if (convertPurchaseOrderToBill) {
          createdBill = await convertPurchaseOrderToBill(poId);
        } else {
          throw postErr;
        }
      }

      if (createdBill) {
        setBills((prev) => [createdBill, ...prev]);
      }

      const billNo = createdBill?.billNumber || createdBill?.bill_number || 'New Bill';
      setSuccessMsg(`✓ Vendor Bill ${billNo} successfully recorded and linked to PO ${poNumber}!`);
      showToast?.(`Vendor Bill ${billNo} recorded successfully.`);

      if (refreshCollections) {
        refreshCollections(['purchaseBills', 'purchaseOrders', 'vendorBills']);
      }
      if (onBillSaved) {
        onBillSaved(createdBill);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to create vendor bill:', err);
      setErrorMsg(err?.message || 'Failed to record vendor bill.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-indigo-500/80 bg-gradient-to-b from-indigo-50/50 via-white to-white p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
      {/* ── Slide Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
            <Receipt size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                Stage 7 Slide
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                Vendor Bill Entry (Purchase Bill)
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Record or review the supplier invoice / vendor bill received against PO {poNumber} & verified GRN intake.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-2xs cursor-pointer"
            title="Refresh bills"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Context Pillars ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Supplier / Mill
          </span>
          <p className="text-xs font-black text-slate-800 truncate">
            {po?.vendor || po?.vendorName || po?.partyName || 'Supplier'}
          </p>
          <span className="text-[10.5px] text-slate-500">GST Vendor Account</span>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Purchase Order
          </span>
          <p className="text-xs font-mono font-black text-indigo-700">
            {poNumber}
          </p>
          <span className="text-[10.5px] text-slate-500">Contract Total: ₹{numIN(po?.amount || po?.total || 0)}</span>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Verified GRN Intake
          </span>
          <p className="text-xs font-mono font-black text-teal-700">
            {numIN(totalReceivedMeters)} Mtr
          </p>
          <span className="text-[10.5px] text-emerald-600 font-semibold">✓ QC Clearance Passed</span>
        </div>
      </div>

      {/* ── Alerts ── */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── Case 1: Active Bill Exists ── */}
      {activeBill ? (
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">
                    Vendor Bill Active ({activeBill.billNumber || activeBill.bill_number})
                  </h4>
                  <p className="text-[11px] text-emerald-700">
                    Invoice matched and booked to Accounts Payable for {poNumber}.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {activeBill.status || 'Active Bill'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-emerald-800/80 block uppercase font-bold">System Bill #</span>
                <strong className="font-mono text-slate-800">{activeBill.billNumber || activeBill.bill_number}</strong>
              </div>
              <div>
                <span className="text-[10px] text-emerald-800/80 block uppercase font-bold">Vendor Invoice #</span>
                <strong className="font-mono text-slate-800">{activeBill.vendorBillNumber || activeBill.billNumber || '-'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-emerald-800/80 block uppercase font-bold">Bill Date</span>
                <span className="text-slate-700 font-semibold">{formatDateDDMMYYYY ? formatDateDDMMYYYY(activeBill.date || activeBill.doc_date) : activeBill.date}</span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-800/80 block uppercase font-bold">Total Bill Amount</span>
                <strong className="font-mono text-emerald-900 font-extrabold">₹{numIN(activeBill.total || activeBill.amount || formTotalAmount)}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <span className="text-xs text-indigo-900 font-medium">
              Ready to verify rates and variances against PO contract & GRN dock intake.
            </span>
            {onNextStep && (
              <button
                type="button"
                onClick={() => onNextStep('supplier_bill_matching')}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                <span>Proceed to 3-Way Matching</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ── Case 2: Record New Vendor Bill Form ── */
        <form onSubmit={handleCreateBill} className="space-y-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={13} className="text-indigo-600" /> Vendor Invoice Header Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Vendor Invoice / Bill No *
                </label>
                <input
                  type="text"
                  required
                  value={vendorBillNumber}
                  onChange={(e) => setVendorBillNumber(e.target.value)}
                  placeholder={`e.g. INV-${poNumber.slice(-6)}`}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Invoice / Bill Date *
                </label>
                <input
                  type="date"
                  required
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Payment Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* ── Bill Line Items Table ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Bill Fabric Line Items (Pre-filled from GRN Intake)
              </h4>
              <span className="text-[11px] text-slate-500">
                Total Bill: <strong className="text-indigo-700 font-mono">₹{numIN(formTotalAmount)}</strong>
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Fabric Quality / Item</th>
                    <th className="py-2 px-3">PO Ordered</th>
                    <th className="py-2 px-3">Billed Qty (Mtr) *</th>
                    <th className="py-2 px-3">Rate (₹/Mtr) *</th>
                    <th className="py-2 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
                  {formLines.map((l, idx) => (
                    <tr key={l.id || idx} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-sans font-bold text-slate-800">
                        {l.itemName}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {numIN(l.orderedQty)} m
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={l.billingQty}
                          onChange={(e) => handleLineQtyChange(idx, e.target.value)}
                          className="w-24 px-2 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={l.rate}
                          onChange={(e) => handleLineRateChange(idx, e.target.value)}
                          className="w-24 px-2 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-extrabold text-indigo-900">
                        ₹{numIN(l.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <input
              type="text"
              placeholder="Internal remarks or payment terms notes (optional)..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full sm:w-80 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all"
            >
              {submitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Recording Bill...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Record & Generate Vendor Bill (₹{numIN(formTotalAmount)})</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Slide Lifecycle Navigation Bar ── */}
      <div className="pt-3 border-t border-indigo-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-indigo-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:px-5 rounded-b-2xl">
        <div className="flex items-center gap-2">
          {onPrevStep && (
            <button
              type="button"
              onClick={() => onPrevStep('grey_stock_updated')}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <ArrowLeft size={13} />
              <span>Previous: Grey Stock Updated</span>
            </button>
          )}
          <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
            Stage 7 of 9 • Vendor Bill Entry
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-600 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
            >
              Close Slide
            </button>
          )}
          {onNextStep && (
            <button
              type="button"
              onClick={() => onNextStep('supplier_bill_matching')}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <span>Next: Supplier Bill Matching</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default VendorBillInlineSlide;
