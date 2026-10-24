import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  FileText,
  Boxes,
  ArrowRight,
  ArrowLeft,
  X,
  Sliders,
  Check,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { getProjectPurchaseOrders } from '../../../../services/pmsSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { useNavigate } from 'react-router-dom';

export function Stage5GreyQCWorkspace({
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

  const projectId = project?.id;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [qcForm, setQcForm] = useState({
    verdict: 'Approved',
    measuredGsm: 180,
    measuredWidth: 58,
    inspectedColour: 'Natural Grey',
    goodQty: '',
    rejectedQty: '0',
    reprocessQty: '0',
    notes: 'Fabric tested on 4-point system. Warp & weft tensile strength within standard.',
  });

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [poRes, recRes] = await Promise.allSettled([
        getProjectPurchaseOrders(projectId),
        api.get('/purchase/receipts/'),
      ]);

      let poList = [];
      if (poRes.status === 'fulfilled' && poRes.value) {
        poList = Array.isArray(poRes.value) ? poRes.value : (poRes.value.data || poRes.value.results || []);
        setPurchaseOrders(poList);
      }

      if (recRes.status === 'fulfilled' && recRes.value) {
        const raw = Array.isArray(recRes.value) ? recRes.value : (recRes.value.data || recRes.value.results || []);
        const poIds = new Set(poList.map((p) => String(p.id)));
        const poNumbers = new Set(poList.map((p) => p.poNumber));
        const matched = raw.filter((r) => {
          const poId = String(r.purchaseOrderId || r.purchase_order || '');
          const poNum = r.purchaseOrderNumber || r.poNumber;
          return poIds.has(poId) || poNumbers.has(poNum);
        });
        setReceipts(matched.length > 0 ? matched : raw.filter((r) => poIds.has(String(r.purchase_order))));
      }
    } catch (err) {
      console.warn('Error loading QC workspace data:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }
  }, [projectId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (onSyncPipeline) await onSyncPipeline();
    setRefreshing(false);
    toast.info('QC records refreshed.');
  };

  const activePo = purchaseOrders[0] || null;
  const activeGrn = receipts[0] || null;

  const grnTotalQty = useMemo(() => {
    if (!activeGrn) return 0;
    const lines = activeGrn.lines || [];
    const lineSum = lines.reduce((s, l) => s + (Number(l.receivedQty || l.received_qty) || 0), 0);
    return lineSum > 0 ? lineSum : (Number(activeGrn.receivedQty) || 0);
  }, [activeGrn]);

  const currentStatus = activeGrn?.qcStatus || activeGrn?.qc_status || 'Pending';

  const handleRecordQc = async (e) => {
    e.preventDefault();
    if (!activeGrn) {
      toast.error('No GRN found to inspect.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/purchase/receipts/${activeGrn.id}/qc/`, {
        status: qcForm.verdict,
        note: `GSM: ${qcForm.measuredGsm}, Width: ${qcForm.measuredWidth}", Shade: ${qcForm.inspectedColour}. ${qcForm.notes}`,
      });

      toast.success(`QC Verdict recorded: ${qcForm.verdict}. Approved fabric released to warehouse stock.`);
      setIsModalOpen(false);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error('Failed to record QC: ' + (err?.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-blue-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Grey Fabric Quality Inspection & Specification Verdict
          </h3>
        </div>
        <button
          type="button"
          onClick={() => {
            setQcForm({ ...qcForm, goodQty: String(grnTotalQty) });
            setIsModalOpen(true);
          }}
          disabled={!activeGrn}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
        >
          <ShieldCheck size={14} /> Record QC Verdict
        </button>
      </div>

      <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block">Inspected Document</span>
          <span className="font-mono font-bold text-blue-700">{activeGrn?.grnNumber || activeGrn?.grn_number || 'GRN Required'}</span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block">Total Quantity</span>
          <span className="font-mono font-black text-slate-900">{grnTotalQty.toLocaleString('en-IN')} M</span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block">Current QC Status</span>
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-extrabold border ${
            currentStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {currentStatus}
          </span>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-slate-400 block">Warehouse Stock Release</span>
          <span className="font-bold text-slate-800">
            {currentStatus === 'Approved' ? '✓ Released to Usable Stock' : '⏳ Held on SYS-QC-HOLD'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Inspection Parameters</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Target Fabric Quality</span>
              <strong className="text-slate-800">{(activePo?.items || [])[0]?.name || 'Cotton Grey 60s'}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Measured GSM</span>
              <strong className="font-mono text-slate-800">180 GSM (Spec: 175-185)</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Measured Width</span>
              <strong className="font-mono text-slate-800">58 Inches (Spec: 58-60")</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Fabric Colour & Weave</span>
              <strong className="text-slate-800">Natural Grey / Plain Weave</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Inspection Method</span>
              <strong className="text-slate-800">4-Point Defect Standard</strong>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Stock Disposition Quantities</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Accepted (Good Usable Mtrs)</span>
              <strong className="font-mono text-emerald-700 font-bold">
                {currentStatus === 'Approved' ? `${grnTotalQty.toLocaleString('en-IN')} M` : '0 M'}
              </strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Pending Inspection (Held)</span>
              <strong className="font-mono text-amber-700 font-bold">
                {currentStatus === 'Approved' ? '0 M' : `${grnTotalQty.toLocaleString('en-IN')} M`}
              </strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Second Quality Stock</span>
              <strong className="font-mono text-slate-600">0 M</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Rejected / Return Stock</span>
              <strong className="font-mono text-rose-600">0 M</strong>
            </div>
          </div>
        </div>
      </div>

      

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl text-xs flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Record Grey Fabric QC Inspection</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRecordQc} className="space-y-3 mt-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  QC Verdict <span className="text-rose-500">*</span>
                </label>
                <select
                  value={qcForm.verdict}
                  onChange={(e) => setQcForm({ ...qcForm, verdict: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-bold"
                >
                  <option value="Approved">Approved (100% Passed to Stock)</option>
                  <option value="Partially Approved">Partially Approved</option>
                  <option value="Rework">Rework / Reprocess</option>
                  <option value="Rejected">Rejected</option>
                  <option value="On Hold">On Hold (Pending Lab Test)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Measured GSM</label>
                  <input
                    type="number"
                    value={qcForm.measuredGsm}
                    onChange={(e) => setQcForm({ ...qcForm, measuredGsm: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Measured Width (Inches)</label>
                  <input
                    type="number"
                    value={qcForm.measuredWidth}
                    onChange={(e) => setQcForm({ ...qcForm, measuredWidth: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Shade / Colour Quality</label>
                <input
                  type="text"
                  value={qcForm.inspectedColour}
                  onChange={(e) => setQcForm({ ...qcForm, inspectedColour: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Inspection Notes & Test Summary</label>
                <textarea
                  rows={2}
                  value={qcForm.notes}
                  onChange={(e) => setQcForm({ ...qcForm, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-xs disabled:opacity-60"
                >
                  {submitting ? 'Recording...' : 'Submit QC Verdict'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default Stage5GreyQCWorkspace;
