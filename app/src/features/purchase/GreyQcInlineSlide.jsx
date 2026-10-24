import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  X,
  FileCheck,
  Check,
  Ban,
  Layers,
  Sparkles,
  QrCode,
  Info,
} from 'lucide-react';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';

function numIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function GreyQcInlineSlide({ po, onClose, onQcSaved, onNextStep, onPrevStep }) {
  const { showToast, refreshCollections } = useERP() || {};

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [allLots, setAllLots] = useState([]);
  const [grnList, setGrnList] = useState([]);
  const [selectedGrnId, setSelectedGrnId] = useState('');
  const [takas, setTakas] = useState([]);
  const [inspectorName, setInspectorName] = useState('Quality Manager');
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const poId = po?.id;
  const poNumber = po?.poNumber || po?.code || po?.orderNumber || 'PO';

  const loadData = async () => {
    if (!poId) return;
    try {
      setLoading(true);
      setErrorMsg('');

      const [grnRes, lotRes] = await Promise.allSettled([
        api.get('/purchase/receipts/', {
          params: { purchaseOrderId: poId, limit: 50 },
        }),
        api.get('/inventory/lot-register/', {
          params: { po: poId, limit: 200 },
        }),
      ]);

      let loadedGrns = [];
      if (grnRes.status === 'fulfilled' && grnRes.value) {
        const raw = Array.isArray(grnRes.value) ? grnRes.value : (grnRes.value.results || grnRes.value.rows || grnRes.value.data || []);
        loadedGrns = raw.filter(
          (g) => String(g.purchase_order || g.purchaseOrderId || g.purchaseOrder || g.poId || '') === String(poId) ||
                 (poNumber && (g.poNumber === poNumber || g.po_number === poNumber))
        );
      }
      setGrnList(loadedGrns);

      let lots = [];
      if (lotRes.status === 'fulfilled' && lotRes.value) {
        const rawLots = Array.isArray(lotRes.value) ? lotRes.value : (lotRes.value.records || lotRes.value.rows || lotRes.value.data || lotRes.value.results || []);
        lots = rawLots;
      }
      setAllLots(lots);

      if (loadedGrns.length > 0) {
        setSelectedGrnId((prev) => (prev && loadedGrns.some((g) => String(g.id) === String(prev)) ? prev : String(loadedGrns[0].id)));
      }
    } catch (err) {
      console.warn('Failed to load QC data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [poId]);

  const currentGrn = useMemo(() => {
    if (!grnList.length) return null;
    return grnList.find((g) => String(g.id) === String(selectedGrnId)) || grnList[0];
  }, [grnList, selectedGrnId]);

  const grnReceivedMeters = useMemo(() => {
    if (!currentGrn) return 0;
    if (currentGrn.lines && currentGrn.lines.length > 0) {
      return currentGrn.lines.reduce((s, l) => s + Number(l.received_qty || l.receivedQty || 0), 0);
    }
    return Number(currentGrn.total_received_qty || currentGrn.receivedQty || 0);
  }, [currentGrn]);

  useEffect(() => {
    if (!currentGrn) {
      setTakas([]);
      return;
    }

    const grnIdStr = String(currentGrn.id);
    const grnNum = (currentGrn.grn_number || currentGrn.grnNumber || '').toLowerCase();

    const seenIds = new Set();
    const grnTakas = allLots.filter((lt) => {
      const docId = String(lt.sourceDocumentId || lt.source_document_id || lt.grnId || lt.grn_id || '');
      const docNo = String(lt.grnNo || lt.grnNumber || lt.source_document_number || '').toLowerCase();
      const matches = (docId && docId === grnIdStr) || (docNo && docNo === grnNum);
      if (!matches) return false;

      const tKey = String(lt.id || lt.takaId || lt.barcode);
      if (seenIds.has(tKey)) return false;
      seenIds.add(tKey);
      return true;
    });

    setTakas(
      grnTakas.map((t) => ({
        ...t,
        disposition: t.qcStatus === 'Passed' ? 'Passed' : t.qcStatus === 'Rejected' ? 'Rejected' : (t.disposition || 'Passed'),
      }))
    );
  }, [currentGrn, allLots]);

  const takaTotalMeters = useMemo(() => {
    return takas.reduce((s, t) => s + Number(t.receivedQty || t.received_quantity || t.availableQty || 0), 0);
  }, [takas]);

  const duplicateRollNumbers = useMemo(() => {
    const counts = {};
    const duplicates = [];
    takas.forEach((t, idx) => {
      const rollNum = String(t.takaRoll || t.taka_number || idx + 1).trim();
      counts[rollNum] = (counts[rollNum] || 0) + 1;
      if (counts[rollNum] === 2) {
        duplicates.push(rollNum);
      }
    });
    return duplicates;
  }, [takas]);

  const quantityDiscrepancy = useMemo(() => {
    if (!currentGrn) return 0;
    return Math.round((grnReceivedMeters - takaTotalMeters) * 10000) / 10000;
  }, [grnReceivedMeters, takaTotalMeters]);

  const isQuantityMismatch = Math.abs(quantityDiscrepancy) > 0.01;
  const isDuplicateDetected = duplicateRollNumbers.length > 0;
  const isGrnAlreadyCompleted = currentGrn && currentGrn.qc_status && currentGrn.qc_status !== 'Pending';

  const stats = useMemo(() => {
    const totalTakas = takas.length;
    const passedTakas = takas.filter((t) => t.disposition === 'Passed');
    const rejectedTakas = takas.filter((t) => t.disposition === 'Rejected');
    const passedMeters = passedTakas.reduce((s, t) => s + Number(t.receivedQty || t.received_quantity || 0), 0);
    const rejectedMeters = rejectedTakas.reduce((s, t) => s + Number(t.receivedQty || t.received_quantity || 0), 0);
    const isAllQcDone = totalTakas > 0 && takas.every((t) => t.qcStatus === 'Passed' || t.qcStatus === 'Rejected');

    return {
      totalTakas,
      totalMeters: takaTotalMeters,
      passedCount: passedTakas.length,
      passedMeters,
      rejectedCount: rejectedTakas.length,
      rejectedMeters,
      isAllQcDone,
    };
  }, [takas, takaTotalMeters]);

  const handleSetAllDisposition = (verdict) => {
    setTakas((prev) =>
      prev.map((t) => ({
        ...t,
        disposition: verdict,
      }))
    );
  };

  const handleUpdateDisposition = (takaId, verdict) => {
    setTakas((prev) =>
      prev.map((t) => (t.id === takaId ? { ...t, disposition: verdict } : t))
    );
  };

  const handleCompleteQc = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentGrn) {
      setErrorMsg('No valid GRN selected for QC inspection.');
      return;
    }

    if (isGrnAlreadyCompleted) {
      setErrorMsg(`QC inspection for ${currentGrn.grn_number} is already completed with status "${currentGrn.qc_status}". Re-submission is blocked.`);
      return;
    }

    if (takas.length === 0) {
      setErrorMsg('No takas found for the selected GRN. Please create takas in Stage 4 first.');
      return;
    }

    if (isQuantityMismatch) {
      setErrorMsg(
        `Quantity discrepancy detected: GRN received quantity is ${numIN(grnReceivedMeters)} m, but allocated takas total ${numIN(takaTotalMeters)} m (Discrepancy: ${numIN(Math.abs(quantityDiscrepancy))} m). Final QC submission is blocked until corrected.`
      );
      return;
    }

    if (isDuplicateDetected) {
      setErrorMsg(`Duplicate taka roll numbers detected: ${duplicateRollNumbers.join(', ')}. Final QC submission is blocked.`);
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        receiptId: currentGrn.id,
        goodQty: stats.passedMeters,
        secondQty: 0,
        reprocessQty: 0,
        rejectQty: stats.rejectedMeters,
        holdQty: 0,
        remarks: remarks || `QC inspection completed by ${inspectorName} for ${currentGrn.grn_number}. Passed: ${stats.passedCount} rolls (${numIN(stats.passedMeters)} m), Rejected: ${stats.rejectedCount} rolls (${numIN(stats.rejectedMeters)} m).`,
        takas: takas.map((t) => ({
          id: t.id,
          takaId: t.takaId || t.id,
          barcode: t.barcode,
          takaRoll: t.takaRoll || t.taka_number,
          receivedQty: Number(t.receivedQty || t.received_quantity || 0),
          disposition: t.disposition,
        })),
      };

      const res = await api.post('/inventory/qc/complete/', payload);

      setSuccessMsg(
        `QC inspection completed successfully! ${stats.passedCount} rolls (${numIN(stats.passedMeters)} m) posted to warehouse stock. ${stats.rejectedCount} rolls (${numIN(stats.rejectedMeters)} m) quarantined.`
      );
      if (showToast) {
        showToast(`QC completed for ${currentGrn.grn_number}: ${stats.passedCount} accepted, ${stats.rejectedCount} rejected.`, 'success');
      }
      if (refreshCollections) {
        refreshCollections(['purchaseOrders', 'inventory']);
      }
      if (onQcSaved) {
        onQcSaved();
      }

      await loadData();
    } catch (err) {
      console.error('Failed to submit QC:', err);
      const data = err.response?.data;
      const msg =
        data?.detail ||
        (data?.field_errors && Object.values(data.field_errors).flat().join(' ')) ||
        err.message ||
        'Failed to complete QC inspection.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-indigo-400/80 bg-gradient-to-b from-indigo-50/60 via-white to-white p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                Stage 5 Slide
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                Grey Fabric Quality Control (QC Inspection)
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Inspect unique takas for the selected GRN, assign Grade A or Reject, and post approved stock to warehouse.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-2xs cursor-pointer"
            title="Refresh takas"
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

      {grnList.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl">
          <span className="text-[11px] font-extrabold text-indigo-900 flex items-center gap-1.5">
            <Layers size={13} className="text-indigo-600" /> Select GRN to Inspect:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {grnList.map((g) => {
              const isSelected = String(g.id) === String(selectedGrnId);
              const gStatus = g.qc_status || g.qcStatus || 'Pending';
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGrnId(String(g.id))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-indigo-200 text-slate-700 hover:bg-indigo-100/50'
                  }`}
                >
                  <span>{g.grn_number || g.grnNumber}</span>
                  <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-semibold ${
                    gStatus === 'Approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : gStatus === 'Rejected'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {gStatus}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">GRN Received</span>
          <p className="text-sm font-extrabold font-mono text-slate-800 mt-0.5">{numIN(grnReceivedMeters)} m</p>
          <span className="text-[10px] text-slate-500">{currentGrn?.grn_number || 'GRN'}</span>
        </div>
        <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Allocated Takas</span>
          <p className="text-sm font-extrabold font-mono text-indigo-700 mt-0.5">{numIN(takaTotalMeters)} m</p>
          <span className="text-[10px] text-slate-500">{stats.totalTakas} unique rolls</span>
        </div>
        <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl shadow-2xs">
          <span className="text-[9.5px] font-bold text-emerald-700 uppercase tracking-wider block">QC-Accepted</span>
          <p className="text-sm font-extrabold font-mono text-emerald-800 mt-0.5">{numIN(stats.passedMeters)} m</p>
          <span className="text-[10px] text-emerald-600 font-semibold">{stats.passedCount} rolls passed</span>
        </div>
        <div className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-xl shadow-2xs">
          <span className="text-[9.5px] font-bold text-rose-700 uppercase tracking-wider block">QC-Rejected</span>
          <p className="text-sm font-extrabold font-mono text-rose-800 mt-0.5">{numIN(stats.rejectedMeters)} m</p>
          <span className="text-[10px] text-rose-600 font-semibold">{stats.rejectedCount} rolls rejected</span>
        </div>
        <div className="p-2.5 bg-teal-50/70 border border-teal-200 rounded-xl shadow-2xs">
          <span className="text-[9.5px] font-bold text-teal-700 uppercase tracking-wider block">Posted to Stock</span>
          <p className="text-sm font-extrabold font-mono text-teal-800 mt-0.5">{numIN(stats.passedMeters)} m</p>
          <span className="text-[10px] text-teal-600 font-semibold">Accepted only</span>
        </div>
        <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl shadow-2xs">
          <span className="text-[9.5px] font-bold text-purple-700 uppercase tracking-wider block">GRN QC State</span>
          <p className="text-xs font-black text-purple-900 mt-1 flex items-center gap-1">
            {isGrnAlreadyCompleted ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 size={12} /> {currentGrn.qc_status}
              </span>
            ) : (
              <span className="text-amber-700 flex items-center gap-1">
                <AlertTriangle size={12} /> Pending
              </span>
            )}
          </p>
          <span className="text-[9.5px] text-purple-600 truncate block">WH Destination</span>
        </div>
      </div>

      {isQuantityMismatch && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs flex items-start gap-2 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block">Reconciliation Discrepancy Detected:</span>
            <span>
              GRN received quantity is <strong>{numIN(grnReceivedMeters)} m</strong>, but allocated takas total <strong>{numIN(takaTotalMeters)} m</strong> (difference: <strong>{numIN(Math.abs(quantityDiscrepancy))} m</strong>).
              Final QC submission is blocked until taka allocations reconcile exactly with the received GRN quantity.
            </span>
          </div>
        </div>
      )}

      {isDuplicateDetected && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs flex items-start gap-2 shadow-2xs">
          <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block">Duplicate Taka Roll Numbers Detected:</span>
            <span>
              Duplicate rolls: <strong>{duplicateRollNumbers.join(', ')}</strong>. Every roll within a lot must have a unique identifier. Final QC submission is blocked.
            </span>
          </div>
        </div>
      )}

      {isGrnAlreadyCompleted && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-start gap-2 shadow-2xs">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block">QC Inspection Already Completed:</span>
            <span>
              {currentGrn.grn_number} was already inspected with verdict <strong>{currentGrn.qc_status}</strong>. Takas have already been posted to inventory and duplicate QC submissions are prevented.
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleCompleteQc} className="space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Inspector</label>
              <input
                type="text"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800 text-xs w-36"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Inspection Date</label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Inspection Notes</label>
              <input
                type="text"
                placeholder="4-Point inspection passed, zero major defects"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-slate-800 text-xs w-64"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
              <Sparkles size={12} className="text-indigo-600" /> Quick Grade:
            </span>
            <button
              type="button"
              disabled={isGrnAlreadyCompleted}
              onClick={() => handleSetAllDisposition('Passed')}
              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 border border-emerald-300 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Check size={12} /> Pass All (Grade A)
            </button>
            <button
              type="button"
              disabled={isGrnAlreadyCompleted}
              onClick={() => handleSetAllDisposition('Rejected')}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-800 border border-rose-300 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Ban size={12} /> Reject All
            </button>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 uppercase text-[10px] sticky top-0 z-10">
              <tr>
                <th className="py-2 px-3">Barcode / Taka ID</th>
                <th className="py-2 px-3">Lot #</th>
                <th className="py-2 px-3">Roll #</th>
                <th className="py-2 px-3">Length (m)</th>
                <th className="py-2 px-3">Current Location</th>
                <th className="py-2 px-3 text-center">QC Disposition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {takas.map((t, idx) => {
                const isPassed = t.disposition === 'Passed';
                const isRejected = t.disposition === 'Rejected';
                return (
                  <tr key={t.id || idx} className="hover:bg-slate-50/70 font-mono text-[11px]">
                    <td className="py-1.5 px-3 font-bold text-indigo-700 flex items-center gap-1">
                      <QrCode size={12} className="text-indigo-500" />
                      {t.takaId || t.barcode || t.id}
                    </td>
                    <td className="py-1.5 px-3 font-semibold text-slate-800">{t.lotNo || t.lot_number || '-'}</td>
                    <td className="py-1.5 px-3 font-bold">#{t.takaRoll || t.taka_number || idx + 1}</td>
                    <td className="py-1.5 px-3 font-extrabold text-blue-700">{numIN(t.receivedQty || t.received_quantity || t.availableQty)} m</td>
                    <td className="py-1.5 px-3 text-slate-500 font-sans text-[10.5px]">
                      {t.qcStatus === 'Passed' ? 'WH-MAIN (Godown)' : t.qcStatus === 'Rejected' ? 'SYS-REJECT' : (t.location || 'SYS-QC-HOLD')}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
                        <button
                          type="button"
                          disabled={isGrnAlreadyCompleted}
                          onClick={() => handleUpdateDisposition(t.id, 'Passed')}
                          className={`px-2.5 py-0.5 text-[10.5px] font-bold rounded-md transition-colors cursor-pointer ${
                            isPassed
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-emerald-700'
                          }`}
                        >
                          Pass (Grade A)
                        </button>
                        <button
                          type="button"
                          disabled={isGrnAlreadyCompleted}
                          onClick={() => handleUpdateDisposition(t.id, 'Rejected')}
                          className={`px-2.5 py-0.5 text-[10.5px] font-bold rounded-md transition-colors cursor-pointer ${
                            isRejected
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-rose-700'
                          }`}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {takas.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 font-sans">
                    No lot/taka rolls created for this GRN yet. Please create takas in Stage 4 first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="pt-3 border-t border-indigo-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-indigo-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:px-5 rounded-b-2xl">
          <div className="flex items-center gap-2">
            {onPrevStep && (
              <button
                type="button"
                onClick={() => onPrevStep('lot_taka_creation')}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <ArrowLeft size={13} />
                <span>Previous: Lot / Taka Creation</span>
              </button>
            )}
            <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
              Stage 5 of 8 • Grey Fabric QC Inspection
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-100 font-semibold text-xs cursor-pointer shadow-2xs"
              >
                Close Slide
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || takas.length === 0 || isQuantityMismatch || isDuplicateDetected || isGrnAlreadyCompleted}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              {submitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Moving Stock...
                </>
              ) : (
                <>
                  <FileCheck size={14} /> Submit QC & Post to Stock
                </>
              )}
            </button>
            {onNextStep && (
              <button
                type="button"
                onClick={() => onNextStep('grey_stock_updated')}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <span>Next: Grey Stock Updated</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

export default GreyQcInlineSlide;
