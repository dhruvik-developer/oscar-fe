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
  Info,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';

function numIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function GreyQcInlineSlide({ po, initialReceiptId, onClose, onQcSaved, onNextStep, onPrevStep }) {
  const { showToast, refreshCollections } = useERP() || {};

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [grnList, setGrnList] = useState([]);
  const [selectedGrnId, setSelectedGrnId] = useState('');
  const [batches, setBatches] = useState([]);
  const [inspectorName, setInspectorName] = useState('Quality Manager');
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active Inspect Batch Modal state
  const [activeInspectBatch, setActiveInspectBatch] = useState(null);
  const [inspectValues, setInspectValues] = useState({ good: 0, reprocess: 0, reject: 0, sample: 0 });
  const [inspectValidationError, setInspectValidationError] = useState('');

  const poId = po?.id;
  const poNumber = po?.poNumber || po?.code || po?.orderNumber || 'PO';

  const loadData = async () => {
    const targetReceiptId = initialReceiptId || po?.initialReceiptId;
    if (!poId && !targetReceiptId) return;
    try {
      setLoading(true);
      setErrorMsg('');

      let loadedGrns = [];
      if (poId) {
        const grnRes = await api.get('/purchase/receipts/', {
          params: { purchaseOrderId: poId, limit: 50 },
        });

        if (grnRes) {
          const raw = Array.isArray(grnRes) ? grnRes : (grnRes.results || grnRes.rows || grnRes.data || []);
          loadedGrns = raw.filter(
            (g) => String(g.purchase_order || g.purchaseOrderId || g.purchaseOrder || g.poId || '') === String(poId) ||
                   (poNumber && (g.poNumber === poNumber || g.po_number === poNumber)) ||
                   (targetReceiptId && (String(g.id) === String(targetReceiptId) || String(g.receiptNumber || g.grn_number || '').toLowerCase() === String(targetReceiptId).toLowerCase()))
          );
        }
      }

      // If a specific targetReceiptId was requested and is not yet in loadedGrns, fetch it directly
      if (targetReceiptId && !loadedGrns.some((g) => String(g.id) === String(targetReceiptId) || String(g.receiptNumber || g.grn_number || '').toLowerCase() === String(targetReceiptId).toLowerCase())) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(targetReceiptId));
        try {
          if (isUuid) {
            const directRes = await api.get(`/purchase/receipts/${targetReceiptId}/`);
            const single = directRes?.data || directRes;
            if (single && single.id) {
              loadedGrns = [single, ...loadedGrns];
            }
          } else {
            const searchRes = await api.get('/purchase/receipts/', { params: { search: targetReceiptId, limit: 10 } });
            const list = Array.isArray(searchRes) ? searchRes : (searchRes.results || searchRes.rows || searchRes.data || []);
            const match = list.find((g) => String(g.id) === String(targetReceiptId) || String(g.receiptNumber || g.grn_number || '').toLowerCase() === String(targetReceiptId).toLowerCase());
            if (match) loadedGrns = [match, ...loadedGrns];
          }
        } catch {
          try {
            const searchRes = await api.get('/purchase/receipts/', { params: { search: targetReceiptId, limit: 10 } });
            const list = Array.isArray(searchRes) ? searchRes : (searchRes.results || searchRes.rows || searchRes.data || []);
            const match = list.find((g) => String(g.id) === String(targetReceiptId) || String(g.receiptNumber || g.grn_number || '').toLowerCase() === String(targetReceiptId).toLowerCase());
            if (match) loadedGrns = [match, ...loadedGrns];
          } catch {
            // fallback
          }
        }
      }

      setGrnList(loadedGrns);

      if (loadedGrns.length > 0) {
        setSelectedGrnId((prev) => {
          if (targetReceiptId) {
            const match = loadedGrns.find(
              (g) => String(g.id) === String(targetReceiptId) ||
                     String(g.receiptNumber || g.grn_number || g.grnNumber || '').toLowerCase() === String(targetReceiptId).toLowerCase()
            );
            if (match) return String(match.id);
          }
          return (prev && loadedGrns.some((g) => String(g.id) === String(prev)) ? prev : String(loadedGrns[0].id));
        });
      }
    } catch (err) {
      console.warn('Failed to load QC data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [poId, initialReceiptId]);

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

  const currentGrnQcStatus = currentGrn?.qc_status || currentGrn?.qcStatus || 'Pending';
  const currentGrnMeta = useMemo(() => {
    try {
      const raw = currentGrn?.qc_note || currentGrn?.qcNote;
      return typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
    } catch {
      return {};
    }
  }, [currentGrn]);

  const reprocessPendingMtr = useMemo(() => {
    const rp = Number(currentGrnMeta.reprocessQty || currentGrnMeta.cumulative?.reprocess || 0);
    return rp > 0 ? rp : (po?.isReprocess || po?.reprocessQty ? Number(po.reprocessQty || 10) : 0);
  }, [currentGrnMeta, po]);

  const effectiveGrnStatus = useMemo(() => {
    if (['Approved', 'Passed'].includes(currentGrnQcStatus)) return 'Passed';
    if (currentGrnQcStatus === 'Rejected') return 'Rejected';
    if (currentGrnQcStatus === 'Partially Approved') {
      return reprocessPendingMtr > 0 ? 'In Reprocess' : 'Passed';
    }
    return currentGrnQcStatus || 'Pending';
  }, [currentGrnQcStatus, reprocessPendingMtr]);

  const isReprocessMode = Boolean(
    po?.isReprocess ||
    (currentGrnQcStatus === 'Partially Approved' && reprocessPendingMtr > 0) ||
    ['Reprocess', 'Rework'].includes(currentGrnQcStatus)
  );

  // Transform current GRN lines into pure Batch-Wise QC items
  useEffect(() => {
    if (!currentGrn) {
      setBatches([]);
      return;
    }

    const isGrnCompleted = !isReprocessMode && effectiveGrnStatus && effectiveGrnStatus !== 'Pending';
    const lines = currentGrn.lines || [];

    const recordedGoodTotal = Number(currentGrnMeta.goodQty ?? currentGrnMeta.cumulative?.good ?? (['Approved', 'Passed'].includes(effectiveGrnStatus) ? grnReceivedMeters : 0));
    const recordedRejectTotal = Number(currentGrnMeta.rejectedQty ?? currentGrnMeta.rejectQty ?? currentGrnMeta.cumulative?.reject ?? (effectiveGrnStatus === 'Rejected' ? grnReceivedMeters : 0));
    const recordedReprocessTotal = Number(currentGrnMeta.reprocessQty ?? currentGrnMeta.cumulative?.reprocess ?? 0);
    const recordedSampleTotal = Number(currentGrnMeta.secondQualityQty ?? currentGrnMeta.secondQty ?? currentGrnMeta.cumulative?.second ?? 0);

    const batchRows = lines.map((line, idx) => {
      const fullQty = Number(line.received_qty || line.receivedQty || 0);
      const inspectQty = isReprocessMode ? (reprocessPendingMtr > 0 ? reprocessPendingMtr : fullQty) : fullQty;
      const isApproved = !isReprocessMode && ['Approved', 'Passed'].includes(effectiveGrnStatus);
      const isRejected = !isReprocessMode && effectiveGrnStatus === 'Rejected';
      const batchCode = line.batchCode || po?.batchCode || (line.batch_number ? `BAT-${line.batch_number}` : `BAT-${currentGrn.grn_number || 'GRN'}-${idx + 1}`);
      const lotNumber = line.batch_number || line.lot_number || `LOT-${idx + 1}`;
      const location = isReprocessMode
        ? 'SYS-REPROCESS (Reprocess Stock)'
        : line.currentLocation || (isApproved ? 'WH-MAIN (Godown)' : isRejected ? 'SYS-REJECT' : 'SYS-QC-HOLD');
      const status = isReprocessMode
        ? 'Reprocess Pending'
        : (isApproved ? 'Passed' : isRejected ? 'Rejected' : (line.qcStatus === 'Partially Approved' ? (reprocessPendingMtr > 0 ? 'Reprocess' : 'Passed') : line.qcStatus || effectiveGrnStatus || 'Pending'));

      const lineFraction = grnReceivedMeters > 0 ? (fullQty / grnReceivedMeters) : 1;
      const actualGood = isGrnCompleted
        ? (lines.length === 1 ? recordedGoodTotal : Math.round(recordedGoodTotal * lineFraction * 100) / 100)
        : (isReprocessMode ? inspectQty : fullQty);
      const actualReject = isGrnCompleted
        ? (lines.length === 1 ? recordedRejectTotal : Math.round(recordedRejectTotal * lineFraction * 100) / 100)
        : 0;
      const actualReprocess = isGrnCompleted
        ? (lines.length === 1 ? recordedReprocessTotal : Math.round(recordedReprocessTotal * lineFraction * 100) / 100)
        : 0;
      const actualSample = isGrnCompleted
        ? (lines.length === 1 ? recordedSampleTotal : Math.round(recordedSampleTotal * lineFraction * 100) / 100)
        : 0;

      return {
        id: line.id || `line-${idx}`,
        lineId: line.id,
        batchCode,
        lotNumber,
        itemName: line.itemName || line.item || 'Grey Fabric',
        quantity: inspectQty,
        currentLocation: location,
        qcStatus: status,
        disposition: isReprocessMode ? 'Passed' : (isApproved ? 'Passed' : isRejected ? 'Rejected' : 'Passed'),
        inspection: {
          good: actualGood,
          reprocess: actualReprocess,
          reject: actualReject,
          sample: actualSample,
          isInspected: isReprocessMode || isGrnCompleted,
        },
      };
    });

    setBatches(batchRows);
  }, [currentGrn, isReprocessMode, reprocessPendingMtr, currentGrnQcStatus, effectiveGrnStatus, currentGrnMeta, grnReceivedMeters, po]);

  const batchTotalMeters = useMemo(() => {
    return batches.reduce((s, b) => s + Number(b.quantity || 0), 0);
  }, [batches]);

  const inspectEligibleQty = useMemo(() => {
    if (!activeInspectBatch) return 0;
    return Number(activeInspectBatch.quantity || 0);
  }, [activeInspectBatch]);

  const inspectTotalAllocated = useMemo(() => {
    const g = parseFloat(inspectValues.good) || 0;
    const rp = parseFloat(inspectValues.reprocess) || 0;
    const rj = parseFloat(inspectValues.reject) || 0;
    const sm = parseFloat(inspectValues.sample) || 0;
    return Math.round((g + rp + rj + sm) * 10000) / 10000;
  }, [inspectValues]);

  const inspectUnallocated = useMemo(() => {
    return Math.max(0, Math.round((inspectEligibleQty - inspectTotalAllocated) * 10000) / 10000);
  }, [inspectEligibleQty, inspectTotalAllocated]);

  const handleInspectInputChange = (category, rawVal) => {
    setInspectValidationError('');

    if (category === 'good') {
      setInspectValues((prev) => ({
        ...prev,
        good: rawVal,
      }));
      return;
    }

    setInspectValues((prev) => {
      const rp = category === 'reprocess' ? (parseFloat(rawVal) || 0) : (parseFloat(prev.reprocess) || 0);
      const rj = category === 'reject' ? (parseFloat(rawVal) || 0) : (parseFloat(prev.reject) || 0);
      const sm = category === 'sample' ? (parseFloat(rawVal) || 0) : (parseFloat(prev.sample) || 0);

      const otherSum = rp + rj + sm;
      const autoGood = Math.max(0, Math.round((inspectEligibleQty - otherSum) * 100) / 100);

      return {
        ...prev,
        [category]: rawVal,
        good: autoGood,
      };
    });
  };

  const handleOpenInspectModal = (batch) => {
    setActiveInspectBatch(batch);
    if (batch.inspection?.isInspected) {
      setInspectValues({
        good: batch.inspection.good ?? 0,
        reprocess: batch.inspection.reprocess ?? 0,
        reject: batch.inspection.reject ?? 0,
        sample: batch.inspection.sample ?? 0,
      });
    } else {
      const isRej = batch.disposition === 'Rejected';
      setInspectValues({
        good: isRej ? 0 : batch.quantity,
        reprocess: 0,
        reject: isRej ? batch.quantity : 0,
        sample: 0,
      });
    }
    setInspectValidationError('');
  };

  const handleSaveInspectAllocation = () => {
    if (!activeInspectBatch) return;
    const g = parseFloat(inspectValues.good) || 0;
    const rp = parseFloat(inspectValues.reprocess) || 0;
    const rj = parseFloat(inspectValues.reject) || 0;
    const sm = parseFloat(inspectValues.sample) || 0;

    if (g < 0 || rp < 0 || rj < 0 || sm < 0) {
      setInspectValidationError('Quantities cannot be negative.');
      return;
    }

    const total = Math.round((g + rp + rj + sm) * 10000) / 10000;
    if (total > inspectEligibleQty + 0.001) {
      setInspectValidationError(
        `Total allocated (${numIN(total)} m) exceeds batch quantity (${numIN(inspectEligibleQty)} m).`
      );
      return;
    }

    setBatches((prev) =>
      prev.map((b) => {
        if (b.id === activeInspectBatch.id) {
          const len = Number(b.quantity || 0);
          let disp = 'Passed';
          let st = 'Passed';
          if (rj === len) {
            disp = 'Rejected';
            st = 'Rejected';
          } else if (g === len) {
            disp = 'Passed';
            st = 'Passed';
          } else if (rp === len) {
            disp = 'Reprocess';
            st = 'Reprocess';
          } else {
            disp = 'Partially Passed';
            st = 'Partially Passed';
          }

          return {
            ...b,
            disposition: disp,
            qcStatus: st,
            inspection: {
              good: g,
              reprocess: rp,
              reject: rj,
              sample: sm,
              isInspected: true,
            },
          };
        }
        return b;
      })
    );

    setActiveInspectBatch(null);
  };

  const isGrnAlreadyCompleted = !isReprocessMode && Boolean(currentGrn && currentGrnQcStatus && currentGrnQcStatus !== 'Pending');

  const stats = useMemo(() => {
    const totalBatches = batches.length;
    let passedMeters = 0;
    let rejectedMeters = 0;
    let reprocessMeters = 0;
    let sampleMeters = 0;

    batches.forEach((b) => {
      const len = Number(b.quantity || 0);
      if (b.inspection?.isInspected) {
        passedMeters += Number(b.inspection.good || 0);
        reprocessMeters += Number(b.inspection.reprocess || 0);
        rejectedMeters += Number(b.inspection.reject || 0);
        sampleMeters += Number(b.inspection.sample || 0);
      } else if (b.disposition === 'Rejected') {
        rejectedMeters += len;
      } else {
        passedMeters += len;
      }
    });

    return {
      totalBatches,
      totalMeters: batchTotalMeters,
      goodMeters: Math.round(passedMeters * 10000) / 10000,
      rejectedMeters: Math.round(rejectedMeters * 10000) / 10000,
      reprocessMeters: Math.round(reprocessMeters * 10000) / 10000,
      sampleMeters: Math.round(sampleMeters * 10000) / 10000,
    };
  }, [batches, batchTotalMeters]);

  const handleSetAllDisposition = (verdict) => {
    setBatches((prev) =>
      prev.map((b) => {
        const len = Number(b.quantity || 0);
        const isRej = verdict === 'Rejected';
        return {
          ...b,
          disposition: verdict,
          qcStatus: verdict,
          inspection: {
            good: isRej ? 0 : len,
            reprocess: 0,
            reject: isRej ? len : 0,
            sample: 0,
            isInspected: true,
          },
        };
      })
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

    if (batches.length === 0) {
      setErrorMsg('No batches found for the selected GRN.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        receiptId: currentGrn.id,
        isReprocess: isReprocessMode,
        goodQty: stats.goodMeters,
        secondQty: stats.sampleMeters,
        sampleQty: stats.sampleMeters,
        reprocessQty: stats.reprocessMeters,
        rejectQty: stats.rejectedMeters,
        holdQty: 0,
        remarks:
          remarks ||
          (isReprocessMode
            ? `Reprocess QC inspection completed by ${inspectorName} for ${currentGrn.grn_number}. Accepted: ${numIN(stats.goodMeters)} m, Reject: ${numIN(stats.rejectedMeters)} m.`
            : `Batch QC inspection completed by ${inspectorName} for ${currentGrn.grn_number}. Accepted: ${numIN(stats.goodMeters)} m, Reprocess: ${numIN(stats.reprocessMeters)} m, Reject: ${numIN(stats.rejectedMeters)} m.`),
        lines: batches.map((b) => {
          const len = Number(b.quantity || 0);
          const insp = b.inspection?.isInspected ? b.inspection : null;
          return {
            lineId: b.lineId,
            goodQty: insp ? Number(insp.good || 0) : (b.disposition === 'Rejected' ? 0 : len),
            reprocessQty: insp ? Number(insp.reprocess || 0) : 0,
            rejectQty: insp ? Number(insp.reject || 0) : (b.disposition === 'Rejected' ? len : 0),
            secondQty: insp ? Number(insp.sample || 0) : 0,
            sampleQty: insp ? Number(insp.sample || 0) : 0,
            holdQty: 0,
          };
        }),
      };

      const res = await api.post('/inventory/qc/complete/', payload);

      setSuccessMsg(
        `Batch QC completed successfully! Accepted: ${numIN(stats.goodMeters)} m posted to warehouse stock. Reprocess: ${numIN(stats.reprocessMeters)} m, Quarantined/Reject: ${numIN(stats.rejectedMeters)} m.`
      );

      if (typeof showToast === 'function') {
        showToast(`QC completed for ${currentGrn.grn_number}!`, 'success');
      }

      if (typeof refreshCollections === 'function') {
        refreshCollections(['purchaseOrders', 'inventoryStock', 'batches']);
      }

      onQcSaved?.(res);
      await loadData();
    } catch (err) {
      console.error('Failed to submit QC:', err);
      const msg = err?.data?.message || err?.message || 'Failed to complete QC inspection.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-xs font-sans text-slate-800">
      {/* ── Slide Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-200/80 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl shadow-2xs">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-indigo-100/70 text-indigo-800 rounded-md">
                Stage 4 • Inward Quality Control
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                {isReprocessMode ? 'Reprocess Quality Control (QC Inspection)' : 'Batch Quality Control (QC Inspection)'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Inspect fabric batches for the selected GRN, assign Accepted, Reprocess or Reject quantities, and post approved stock to warehouse.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-2xs cursor-pointer"
            title="Refresh batches"
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

      {/* ── Multiple GRN Picker (if PO has multiple receipts) ── */}
      {grnList.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl">
          <span className="text-[11px] font-extrabold text-indigo-900 flex items-center gap-1.5">
            <Layers size={13} className="text-indigo-600" /> Select GRN to Inspect:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {grnList.map((g) => {
              const isSelected = String(g.id) === String(selectedGrnId);
              const gStatus = g.qc_status || g.qcStatus || 'Pending';
              let gMeta = {};
              try {
                gMeta = typeof g.qc_note === 'string' ? JSON.parse(g.qc_note || '{}') : (g.qc_note || {});
              } catch {}
              const gRp = Number(gMeta.reprocessQty || gMeta.cumulative?.reprocess || 0);
              const effectiveGStatus = (gStatus === 'Approved' || gStatus === 'Passed') ? 'Passed' : (gStatus === 'Partially Approved' && gRp <= 0 ? 'Passed' : gStatus === 'Partially Approved' ? 'Reprocess' : gStatus);
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
                    effectiveGStatus === 'Approved' || effectiveGStatus === 'Passed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : effectiveGStatus === 'Rejected'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {effectiveGStatus}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Metric KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Received Quantity</span>
          <p className="text-sm font-extrabold font-mono text-slate-800 mt-0.5">{numIN(grnReceivedMeters)} m</p>
          <span className="text-[10px] text-slate-500">{currentGrn?.grn_number || 'GRN'}</span>
        </div>
        <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl shadow-2xs">
          <span className="text-[9.5px] font-bold text-emerald-700 uppercase tracking-wider block">QC Accepted</span>
          <p className="text-sm font-extrabold font-mono text-emerald-800 mt-0.5">{numIN(stats.goodMeters)} m</p>
          <span className="text-[10px] text-emerald-600 font-semibold">Available for Stock</span>
        </div>
        <div className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-xl shadow-2xs">
          <span className="text-[9.5px] font-bold text-rose-700 uppercase tracking-wider block">QC Rejected</span>
          <p className="text-sm font-extrabold font-mono text-rose-800 mt-0.5">{numIN(stats.rejectedMeters)} m</p>
          <span className="text-[10px] text-rose-600 font-semibold">Quarantined / Defect</span>
        </div>
        <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl shadow-2xs">
          <span className="text-[9.5px] font-bold text-amber-700 uppercase tracking-wider block">Reprocess Qty</span>
          <p className="text-sm font-extrabold font-mono text-amber-800 mt-0.5">{numIN(stats.reprocessMeters)} m</p>
          <span className="text-[10px] text-amber-600 font-semibold">Rework Eligible</span>
        </div>
        <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl shadow-2xs">
          <span className="text-[9.5px] font-bold text-purple-700 uppercase tracking-wider block">GRN QC Status</span>
          <p className="text-xs font-black text-purple-900 mt-1 flex items-center gap-1">
            {isGrnAlreadyCompleted ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 size={12} /> {effectiveGrnStatus}
              </span>
            ) : (
              <span className="text-amber-700 flex items-center gap-1">
                <AlertTriangle size={12} /> Pending
              </span>
            )}
          </p>
          <span className="text-[9.5px] text-purple-600 truncate block">
            {isGrnAlreadyCompleted ? 'Inspection Completed' : 'Ready for Inspection'}
          </span>
        </div>
      </div>

      {isReprocessMode ? (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2 shadow-2xs">
          <RefreshCw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-spin" style={{ animationDuration: '6s' }} />
          <div>
            <span className="font-extrabold block text-amber-950">Reprocess Quality Inspection:</span>
            <span>
              Inspecting <strong>{numIN(reprocessPendingMtr || stats.totalMeters)} m</strong> of fabric held in <strong>SYS-REPROCESS (Reprocess Stock)</strong>.
              {currentGrnMeta.goodQty ? ` (${numIN(currentGrnMeta.goodQty)} m previously approved and released to godown). ` : ' '}
              Passed quantity will be moved directly to warehouse godown stock.
            </span>
          </div>
        </div>
      ) : isGrnAlreadyCompleted ? (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-start gap-2 shadow-2xs">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold block">QC Inspection Already Completed:</span>
            <span>
              {currentGrn.grn_number} has already been inspected with verdict <strong>{effectiveGrnStatus === 'Approved' ? 'QC Passed' : effectiveGrnStatus === 'Passed' ? 'QC Passed' : effectiveGrnStatus}</strong>. Material has been posted to inventory stock.
            </span>
          </div>
        </div>
      ) : null}

      {/* ── Main QC Inspection Form & Table ── */}
      <form onSubmit={handleCompleteQc} className="space-y-4">
        {/* Quick Toolbar */}
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
                placeholder="Fabric inspection notes / defect observations"
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

        {/* ── Strict Batch-Wise QC Table ── */}
        {/* Format required: Batch Number | Lot Number | Quantity | Current Location | QC Status | Action */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 uppercase text-[10px] sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">Batch Number</th>
                <th className="py-2.5 px-3">Lot Number</th>
                <th className="py-2.5 px-3 text-right">Quantity (m)</th>
                <th className="py-2.5 px-3">Current Location</th>
                <th className="py-2.5 px-3 text-center">QC Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {batches.map((b) => {
                const isInspected = Boolean(b.inspection?.isInspected);
                const hasRejected = Number(b.inspection?.reject || 0) > 0;
                const hasReprocess = Number(b.inspection?.reprocess || 0) > 0;
                const hasGood = Number(b.inspection?.good || 0) > 0;

                return (
                  <tr key={b.id} className="hover:bg-slate-50/70 font-mono text-[11px]">
                    <td className="py-2 px-3 font-bold text-blue-700">
                      {b.batchCode}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800">
                      {b.lotNumber}
                    </td>
                    <td className="py-2 px-3 text-right font-extrabold text-slate-900">
                      {numIN(b.quantity)} m
                    </td>
                    <td className="py-2 px-3 text-slate-600 font-sans text-[10.5px]">
                      {b.currentLocation}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        b.qcStatus === 'Passed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : b.qcStatus === 'Rejected'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : b.qcStatus === 'Reprocess'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : b.qcStatus === 'Partially Passed'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {b.qcStatus}
                      </span>
                      {isInspected && (hasRejected || hasReprocess) && (
                        <div className="text-[9.5px] font-sans text-slate-500 mt-0.5">
                          {hasGood && <span className="text-emerald-700 font-bold">{numIN(b.inspection.good)}m Good </span>}
                          {hasRejected && <span className="text-rose-700 font-bold">{numIN(b.inspection.reject)}m Rej </span>}
                          {hasReprocess && <span className="text-amber-700 font-bold">{numIN(b.inspection.reprocess)}m Reprocess</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        disabled={isGrnAlreadyCompleted}
                        onClick={() => handleOpenInspectModal(b)}
                        className="px-3 py-1 text-[11px] font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isInspected ? 'Edit Inspection' : 'Inspect'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {batches.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    No fabric batches found for this goods receipt.
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

        {/* ── Slide Footer Actions ── */}
        <div className="pt-3 border-t border-indigo-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-indigo-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:px-5 rounded-b-2xl">
          <div className="flex items-center gap-2">
            {onPrevStep && (
              <button
                type="button"
                onClick={() => onPrevStep('grn_inward')}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <ArrowLeft size={13} />
                <span>Previous: GRN / Inward</span>
              </button>
            )}
            <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
              Batch-Wise QC Inspection
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
              disabled={submitting || batches.length === 0 || isGrnAlreadyCompleted}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors ${
                isReprocessMode
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {submitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Moving Stock...
                </>
              ) : (
                <>
                  <FileCheck size={14} /> {isReprocessMode ? 'Submit Reprocess QC & Release to Stock' : 'Submit QC & Post to Stock'}
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

      {/* ── Direct Batch Inspect Modal ── */}
      {activeInspectBatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
          onClick={() => setActiveInspectBatch(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Inspect Batch: {activeInspectBatch.batchCode}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Lot: <span className="font-semibold text-slate-700">{activeInspectBatch.lotNumber}</span> • Total Quantity:{' '}
                  <span className="font-bold font-mono text-blue-700">{numIN(inspectEligibleQty)} m</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveInspectBatch(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* 4 Category Allocation Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Accepted (Good / Grade A) */}
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between">
                <label className="block text-[11px] font-bold text-emerald-800 mb-1.5">
                  Accepted (Good)
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={inspectEligibleQty}
                    value={inspectValues.good}
                    onChange={(e) => handleInspectInputChange('good', e.target.value)}
                    className="w-full pl-2 pr-6 py-1.5 bg-white border border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg text-xs font-mono font-bold text-emerald-950"
                    placeholder="0.00"
                  />
                  <span className="absolute right-2 text-[11px] font-bold text-emerald-700 pointer-events-none">m</span>
                </div>
              </div>

              {/* Reprocess */}
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between">
                <label className="block text-[11px] font-bold text-amber-800 mb-1.5">
                  Reprocess
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={inspectEligibleQty}
                    value={inspectValues.reprocess}
                    onChange={(e) => handleInspectInputChange('reprocess', e.target.value)}
                    className="w-full pl-2 pr-6 py-1.5 bg-white border border-amber-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg text-xs font-mono font-bold text-amber-950"
                    placeholder="0.00"
                  />
                  <span className="absolute right-2 text-[11px] font-bold text-amber-700 pointer-events-none">m</span>
                </div>
              </div>

              {/* Rejected */}
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/40 flex flex-col justify-between">
                <label className="block text-[11px] font-bold text-rose-800 mb-1.5">
                  Rejected
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={inspectEligibleQty}
                    value={inspectValues.reject}
                    onChange={(e) => handleInspectInputChange('reject', e.target.value)}
                    className="w-full pl-2 pr-6 py-1.5 bg-white border border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-lg text-xs font-mono font-bold text-rose-950"
                    placeholder="0.00"
                  />
                  <span className="absolute right-2 text-[11px] font-bold text-rose-700 pointer-events-none">m</span>
                </div>
              </div>

              {/* Sample / Second Quality */}
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-col justify-between">
                <label className="block text-[11px] font-bold text-blue-800 mb-1.5">
                  Sample
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={inspectEligibleQty}
                    value={inspectValues.sample}
                    onChange={(e) => handleInspectInputChange('sample', e.target.value)}
                    className="w-full pl-2 pr-6 py-1.5 bg-white border border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-xs font-mono font-bold text-blue-950"
                    placeholder="0.00"
                  />
                  <span className="absolute right-2 text-[11px] font-bold text-blue-700 pointer-events-none">m</span>
                </div>
              </div>
            </div>

            {/* Allocation Feedback */}
            <div className="mt-3 text-[11px] flex items-center justify-between">
              <span
                className={
                  inspectTotalAllocated > inspectEligibleQty + 0.001
                    ? 'text-rose-600 font-bold'
                    : 'text-slate-500'
                }
              >
                Allocated: <strong className="font-mono">{numIN(inspectTotalAllocated)} m</strong> /{' '}
                {numIN(inspectEligibleQty)} m
                {inspectUnallocated > 0.001 && ` (${numIN(inspectUnallocated)} m unallocated)`}
              </span>
              {inspectValidationError && (
                <span className="text-rose-600 font-bold">{inspectValidationError}</span>
              )}
            </div>

            {/* Quick Actions & Modal Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setInspectValues({ good: inspectEligibleQty, reprocess: 0, reject: 0, sample: 0 });
                    setInspectValidationError('');
                  }}
                  className="px-2 py-1 text-[10px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                >
                  Accept All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInspectValues({ good: 0, reprocess: 0, reject: inspectEligibleQty, sample: 0 });
                    setInspectValidationError('');
                  }}
                  className="px-2 py-1 text-[10px] font-bold rounded bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                >
                  Reject All
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveInspectBatch(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveInspectAllocation}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GreyQcInlineSlide;
