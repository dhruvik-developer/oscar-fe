import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  ClipboardList,
  Truck,
  PackageCheck,
  ShieldCheck,
  Receipt,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Warehouse,
} from 'lucide-react';
import { api } from '../../services/api';

export function PoMovementHistoryModal({
  po,
  formatDateDDMMYYYY,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [grns, setGrns] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  useEffect(() => {
    if (!po?.id) return;
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      api.get('/purchase/receipts/', { params: { purchaseOrderId: po.id } }),
      api.get('/purchase/deliveries/', { params: { purchaseOrderId: po.id } }),
    ]).then(([grnRes, delRes]) => {
      if (cancelled) return;
      if (grnRes.status === 'fulfilled') {
        const rows = Array.isArray(grnRes.value) ? grnRes.value : (grnRes.value?.results || grnRes.value?.data || []);
        setGrns(rows);
      }
      if (delRes.status === 'fulfilled') {
        const rows = Array.isArray(delRes.value) ? delRes.value : (delRes.value?.results || delRes.value?.data || []);
        setDeliveries(rows);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [po?.id]);

  if (!po) return null;

  const lines = po.items || po.lineItems || [];
  const orderedQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const receivedQty = lines.reduce((s, l) => s + (Number(l.receivedQty) || 0), 0);
  const uom = lines[0]?.uom || 'Mtr';

  const hasDispatches = deliveries.length > 0;
  const hasReceipts = grns.length > 0 || receivedQty > 0;
  const isApproved = !['Draft', 'Pending Approval'].includes(po.status);
  const isFullyReceived = po.status === 'Fully Received' || (orderedQty > 0 && receivedQty >= orderedQty);

  const steps = [
    {
      id: 'po',
      title: '1. Purchase Order Issued',
      desc: `Contract issued to ${po.vendor} for ${orderedQty.toLocaleString('en-IN')} ${uom}.`,
      date: formatDateDDMMYYYY(po.date),
      icon: ClipboardList,
      status: 'complete',
      badge: po.status,
    },
    {
      id: 'dispatch',
      title: '2. Supplier Shipment & Dispatch',
      desc: hasDispatches
        ? `${deliveries.length} shipment(s) logged. Latest challan: ${deliveries[0]?.supplierChallanNo || 'Challan logged'}.`
        : isApproved
        ? 'Awaiting vendor shipment or delivery advice.'
        : 'Pending PO approval.',
      date: deliveries[0]?.dispatchDate ? formatDateDDMMYYYY(deliveries[0].dispatchDate) : null,
      icon: Truck,
      status: hasDispatches ? 'complete' : isApproved ? 'in_progress' : 'pending',
      badge: hasDispatches ? `${deliveries.length} Dispatched` : isApproved ? 'Pending Dispatch' : 'Waiting',
    },
    {
      id: 'grn',
      title: '3. Warehouse Intake & Goods Receipt (GRN)',
      desc: hasReceipts
        ? `Goods received into warehouse dock. Received: ${receivedQty.toLocaleString('en-IN')} ${uom} across ${Math.max(1, grns.length)} GRN(s).`
        : 'Goods not yet intaked at the dock.',
      date: grns[0]?.receiptDate ? formatDateDDMMYYYY(grns[0].receiptDate) : null,
      icon: PackageCheck,
      status: isFullyReceived ? 'complete' : hasReceipts ? 'in_progress' : 'pending',
      badge: isFullyReceived ? 'Fully Received' : hasReceipts ? 'Partially Received' : 'Pending Intake',
    },
    {
      id: 'qc',
      title: '4. Quality Inspection & Taka Segregation',
      desc: hasReceipts
        ? 'Rolls / Takas assigned to inspection batches with grade allocation.'
        : 'Inspection starts after initial dock receipt.',
      date: null,
      icon: ShieldCheck,
      status: hasReceipts ? 'in_progress' : 'pending',
      badge: hasReceipts ? 'QC Flow Active' : 'Pending',
    },
    {
      id: 'billing',
      title: '5. Vendor Bill Matching & Accounts Payable',
      desc: po.billedQty || po.bills?.length
        ? 'Vendor invoice matched and inventory value committed to stock ledger.'
        : 'Pending invoice intake and 3-way reconciliation.',
      date: null,
      icon: Receipt,
      status: po.status === 'Billed' ? 'complete' : 'pending',
      badge: po.status === 'Billed' ? 'Billed' : 'Pending Bill',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-2xl w-full p-4 sm:p-6 max-h-[92vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold">
              <Clock size={15} />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1F2E4A]">Movement History &amp; Audit Trail</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {po.poNumber} • {po.vendor} • {orderedQty.toLocaleString('en-IN')} {uom}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Timeline Body */}
        <div className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {steps.map((st) => {
              const Icon = st.icon;
              const isDone = st.status === 'complete';
              const isInProg = st.status === 'in_progress';
              return (
                <div key={st.id} className="relative group">
                  <div
                    className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors border-2 bg-white ${
                      isDone
                        ? 'border-emerald-600 text-emerald-600 ring-2 ring-emerald-100'
                        : isInProg
                        ? 'border-blue-600 text-blue-600 ring-2 ring-blue-100'
                        : 'border-slate-300 text-slate-400'
                    }`}
                  >
                    {isDone ? <CheckCircle2 size={11} className="fill-emerald-100" /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                  </div>

                  <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={isDone ? 'text-emerald-700' : isInProg ? 'text-blue-700' : 'text-slate-400'} />
                        <h4 className="font-bold text-slate-900 text-xs">{st.title}</h4>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isDone
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isInProg
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {st.badge}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-600 mt-1">{st.desc}</p>
                    {st.date && (
                      <p className="text-[10px] font-mono text-slate-400 mt-1.5">
                        Recorded: {st.date}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-200 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
