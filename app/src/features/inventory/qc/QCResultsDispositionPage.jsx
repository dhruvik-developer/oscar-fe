import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { useNavigate, Link, useSearchParams } from 'react-router-dom';

import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  XCircle,
  Save,
  Check,
  Search,
  Plus,
  Trash2,
  Camera,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  RotateCcw,
  PackageCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  FileText,
  Sliders,
  Tag,
  Boxes,
  Truck,
  Award,
} from 'lucide-react';

import { inventoryService } from '../../../services/domainServices';

import { api } from '../../../services/api';

import { useERP } from '../../../context/ERPContext';

import QCPageHeader from './QCPageHeader';

export default function QCResultsDispositionPage() {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const urlReceiptId = searchParams.get('receiptId') || searchParams.get('id');

  const { vendors = [], items = [], locations = [] } = useERP();

  // Loading & Inspections Data
  const [loading, setLoading] = useState(true);

  const [inspectionsList, setInspectionsList] = useState([]);

  const [selectedInspectionId, setSelectedInspectionId] = useState('');

  // Active Inspection Details
  const [qcNo, setQcNo] = useState('');

  const [status, setStatus] = useState('Pending');

  const [sourceType, setSourceType] = useState('Purchase (GRN)');

  const [grnNo, setGrnNo] = useState('');

  const [supplier, setSupplier] = useState('');

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [itemCode, setItemCode] = useState('');

  const [itemName, setItemName] = useState('');

  const [quality, setQuality] = useState('');

  const [shade, setShade] = useState('');

  const [lotNo, setLotNo] = useState('');

  const [takaRoll, setTakaRoll] = useState('1');

  const [inspectedQty, setInspectedQty] = useState('0');

  const [receivedQty, setReceivedQty] = useState('0');

  // Measurements Table Rows (Roll / Taka Level)
  const [measurements, setMeasurements] = useState([]);

  // Disposition Quantities
  const [goodQty, setGoodQty] = useState('0');

  const [holdQty, setHoldQty] = useState('0');

  const [reprocessQty, setReprocessQty] = useState('0');

  const [rejectedQty, setRejectedQty] = useState('0');

  const [remarks, setRemarks] = useState('');

  // Reprocess JWO linking
  const [jwoId, setJwoId] = useState('');

  const [jwoOptions, setJwoOptions] = useState([]);

  // UI state
  const [savingDraft, setSavingDraft] = useState(false);

  const [approving, setApproving] = useState(false);

  const [creatingSample, setCreatingSample] = useState(false);

  const [toastMsg, setToastMsg] = useState(null);

  const [toastType, setToastType] = useState('success'); // 'success' | 'error' | 'info'
  const [showImageModal, setShowImageModal] = useState(false);

  const [successModal, setSuccessModal] = useState(null);

  // Fetch JWO options for reprocess linking
  useEffect(() => {
    let active = true;

    api
      .get('/jobwork/orders/', { query: { limit: 200 } })
      .then((res) => {
        if (active) setJwoOptions(Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : []);

      })
      .catch(() => {
        if (active) setJwoOptions([]);

      });

    return () => {
      active = false;

    };

  }, []);

  // Fetch Inspections from backend
  const fetchInspections = useCallback(async (preferredId = null) => {
    setLoading(true);

    try {
      const [resDisp, resPiece] = await Promise.allSettled([
        inventoryService.getQCDispositionList(),
        inventoryService.getQCInspections({ status: 'Draft' }),
      ]);

      const dispList =
        (resDisp.status === 'fulfilled' && (resDisp.value?.data ? resDisp.value.data.inspections : resDisp.value?.inspections)) ||
        [];

      const pieceRaw =
        (resPiece.status === 'fulfilled' && (Array.isArray(resPiece.value) ? resPiece.value : resPiece.value?.results || [])) ||
        [];

      const pieceList = pieceRaw.map((p) => ({
        id: p.id,
        qcNo: p.inspectionNumber,
        grnNo: p.sourceDocumentNumber || p.inspectionNumber,
        date: p.inspectionDate || '',
        status: p.status === 'Approved' ? 'Completed' : p.status || 'Pending',
        sourceType: 'Piece Inspection (ASTM D5430)',
        supplier: p.inspectorName || 'Internal Inspection',
        itemCode: p.lines?.[0]?.lotNo || 'Piece Lot',
        itemName: `Piece QC Inspection ${p.inspectionNumber}`,
        quality: p.quality || '',
        shade: p.shade || '',
        lotNo: p.lines?.[0]?.lotNo || '',
        takaRoll: p.lines?.length || 1,
        inspectedQty: p.total_inspected_qty || 0,
        receivedQty: p.total_inspected_qty || 0,
        goodQty: p.passed_qty || 0,
        holdQty: p.hold_qty || 0,
        reprocessQty: p.reprocess_qty || 0,
        rejectedQty: p.rejected_qty || 0,
        remarks: p.notes || '',
        isPieceInspection: true,
        measurements: (p.lines || []).map((l, i) => ({
          srNo: i + 1,
          takaNo: l.takaNo || `TK-${i + 1}`,
          actualQty: l.actualMeter || 0,
          width: l.width || 44,
          weight: l.rollWeight || 25,
          grade: l.grade || 'A',
          remarks: l.remarks || '',
          good: l.disposition === 'Pass' ? l.actualMeter : 0,
          hold: l.disposition === 'Hold' ? l.actualMeter : 0,
          reprocess: l.disposition === 'Reprocess' ? l.actualMeter : 0,
          rejected: l.disposition === 'Reject' || l.disposition === 'Second Quality' ? l.actualMeter : 0,
        })),
      }));

      const list = [...dispList, ...pieceList];

      setInspectionsList(list);

      const targetId = preferredId || urlReceiptId;
      const firstPending = list.find((it) => ['Pending', 'Draft', 'On Hold', 'In Progress'].includes(it.status));
      const target = targetId
        ? list.find((it) => it.id === targetId || String(it.id) === String(targetId) || it.grnNo === targetId || it.qcNo === targetId)
        : (firstPending || (list.length > 0 ? list[0] : null));

      if (target) {
        loadInspectionIntoForm(target);

      } else {
        resetForm();

      }

    } catch (err) {
      console.warn('Backend inspections call failed:', err);

      setInspectionsList([]);

      resetForm();

    } finally {
      setLoading(false);

    }

  }, [urlReceiptId]);

  useEffect(() => {
    fetchInspections();

  }, [fetchInspections]);

  // Toast Auto-hide
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);

      return () => clearTimeout(timer);

    }

  }, [toastMsg]);

  const showToast = (msg, type = 'success') => {
    setToastMsg(msg);

    setToastType(type);

  };

  const loadInspectionIntoForm = (insp) => {
    if (!insp) return;

    setSelectedInspectionId(insp.id || '');

    setQcNo(insp.qcNo || `QC-${insp.grnNo?.slice(-4) || '001'}`);

    setStatus(insp.status || 'Pending');

    setSourceType(insp.sourceType || 'Purchase (GRN)');

    setGrnNo(insp.grnNo || '');

    setSupplier(insp.supplier || 'Vendor / Processor');

    setDate(insp.date || new Date().toISOString().split('T')[0]);

    setItemCode(insp.itemCode || 'FAB-ITEM');

    setItemName(insp.itemName || 'Fabric Quality');

    setQuality(insp.quality || '');

    setShade(insp.shade || '');

    setLotNo(insp.lotNo || '-');

    setTakaRoll(String(insp.takaRoll || 1));

    const isCompleted = ['Completed', 'Approved', 'Partially Approved', 'Rejected', 'Rework'].includes(insp.status);

    const totalQty = isCompleted
      ? Number(insp.receivedQty || insp.inspectedQty || 0)
      : Number(insp.inspectedQty ?? insp.receivedQty ?? 0);

    setInspectedQty(String(totalQty));

    setReceivedQty(String(insp.receivedQty || totalQty));

    // Load disposition numbers
    if (isCompleted && insp.previousDisposition) {
      let g = Number(insp.previousDisposition.goodQty ?? 0);

      let h = Number(insp.previousDisposition.holdQty ?? 0);

      let rp = Number(insp.previousDisposition.reprocessQty ?? 0);

      let rj = Number(insp.previousDisposition.rejectedQty ?? 0);

      if (totalQty > 0 && (g + h + rp + rj) > totalQty) {
        g = Math.max(0, Number((totalQty - (h + rp + rj)).toFixed(2)));

      }

      setGoodQty(String(g));

      setHoldQty(String(h));

      setReprocessQty(String(rp));

      setRejectedQty(String(rj));

    } else if (insp.goodQty || insp.holdQty || insp.reprocessQty || insp.rejectedQty) {
      setGoodQty(String(insp.goodQty || 0));

      setHoldQty(String(insp.holdQty || 0));

      setReprocessQty(String(insp.reprocessQty || 0));

      setRejectedQty(String(insp.rejectedQty || 0));

    } else {
      // Default initial state: start with 100% Good, then auto-deduct when Hold/Reprocess/Reject is entered
      setGoodQty(String(totalQty));

      setHoldQty('0');

      setReprocessQty('0');

      setRejectedQty('0');

    }

    setRemarks(insp.remarks || '');

    // Measurements / Rolls
    if (Array.isArray(insp.measurements) && insp.measurements.length > 0) {
      setMeasurements(insp.measurements);

    } else if (insp.lines && insp.lines.length > 0) {
      setMeasurements(
        insp.lines.map((l, i) => ({
          srNo: i + 1,
          takaNo: l.lotNo || `TK-${i + 1}`,
          actualQty: Number(l.receivedQty) || 0,
          width: 44,
          weight: 25,
          grade: 'A',
          remarks: l.itemName || '',
        }))
      );

    } else {
      setMeasurements([]);

    }

  };

  const resetForm = () => {
    setSelectedInspectionId('');

    setQcNo('');

    setStatus('Pending');

    setGrnNo('');

    setSupplier('');

    setItemCode('');

    setItemName('');

    setQuality('');

    setShade('');

    setLotNo('');

    setTakaRoll('1');

    setInspectedQty('0');

    setReceivedQty('0');

    setGoodQty('0');

    setHoldQty('0');

    setReprocessQty('0');

    setRejectedQty('0');

    setRemarks('');

    setMeasurements([]);

  };

  // Reconciled calculation
  const numInspected = Number(inspectedQty) || 0;

  const numGood = Number(goodQty) || 0;

  const numHold = Number(holdQty) || 0;

  const numReprocess = Number(reprocessQty) || 0;

  const numRejected = Number(rejectedQty) || 0;

  const sumDisposition = numGood + numHold + numReprocess + numRejected;

  const diff = Number((numInspected - sumDisposition).toFixed(2));

  const isReconciled = numInspected > 0 && Math.abs(diff) < 0.001;

  // Once an inspection is Completed / Approved, stock is already moved and disposition cannot be edited
  const isLocked = !['Pending', 'Draft', 'On Hold', 'In Progress'].includes(status);

  // Percentage calculations
  const pctGood = numInspected > 0 ? ((numGood / numInspected) * 100).toFixed(1) : '0.0';

  const pctHold = numInspected > 0 ? ((numHold / numInspected) * 100).toFixed(1) : '0.0';

  const pctReprocess = numInspected > 0 ? ((numReprocess / numInspected) * 100).toFixed(1) : '0.0';

  const pctRejected = numInspected > 0 ? ((numRejected / numInspected) * 100).toFixed(1) : '0.0';

  // Auto-deduct from Good Qty when Hold, Reprocess, or Rejected is entered
  const handleHoldChange = (val) => {
    setHoldQty(val);

    if (numInspected > 0) {
      const h = Number(val) || 0;

      const rep = Number(reprocessQty) || 0;

      const rej = Number(rejectedQty) || 0;

      const rem = Math.max(0, Number((numInspected - h - rep - rej).toFixed(2)));

      setGoodQty(String(rem));

    }

  };

  const handleReprocessChange = (val) => {
    setReprocessQty(val);

    if (numInspected > 0) {
      const h = Number(holdQty) || 0;

      const rep = Number(val) || 0;

      const rej = Number(rejectedQty) || 0;

      const rem = Math.max(0, Number((numInspected - h - rep - rej).toFixed(2)));

      setGoodQty(String(rem));

    }

  };

  const handleRejectedChange = (val) => {
    setRejectedQty(val);

    if (numInspected > 0) {
      const h = Number(holdQty) || 0;

      const rep = Number(reprocessQty) || 0;

      const rej = Number(val) || 0;

      const rem = Math.max(0, Number((numInspected - h - rep - rej).toFixed(2)));

      setGoodQty(String(rem));

    }

  };

  // Quick Action Handlers
  const handleQuickFillAllGood = () => {
    if (isLocked) return;

    setGoodQty(String(numInspected));

    setHoldQty('0');

    setReprocessQty('0');

    setRejectedQty('0');

  };

  const handleQuickFillAllHold = () => {
    if (isLocked) return;

    setGoodQty('0');

    setHoldQty(String(numInspected));

    setReprocessQty('0');

    setRejectedQty('0');

  };

  const handleQuickFillAllReject = () => {
    if (isLocked) return;

    setGoodQty('0');

    setHoldQty('0');

    setReprocessQty('0');

    setRejectedQty(String(numInspected));

  };

  const handleQuickFillReset = () => {
    if (isLocked) return;

    setGoodQty('0');

    setHoldQty('0');

    setReprocessQty('0');

    setRejectedQty('0');

  };

  const handleAllocateRemainderToGood = () => {
    if (isLocked || diff <= 0) return;

    setGoodQty(String(Number((numGood + diff).toFixed(2))));

  };

  // Measurement rows actions
  const handleAddMeasurementRow = () => {
    const nextIdx = measurements.length + 1;

    const estPerTaka =
      measurements.length > 0
        ? measurements[0].actualQty
        : Number((numInspected / (Number(takaRoll) || 1)).toFixed(2));

    setMeasurements((prev) => [
      ...prev,
      {
        srNo: nextIdx,
        takaNo: `TK-${String(nextIdx).padStart(3, '0')}`,
        actualQty: Number(estPerTaka) || 0,
        width: 44,
        weight: 25,
        grade: 'A',
        remarks: '',
      },
    ]);

  };

  const handleUpdateMeasurementRow = (idx, field, val) => {
    setMeasurements((prev) => {
      const next = [...prev];

      next[idx] = { ...next[idx], [field]: val };

      return next;

    });

  };

  const handleDeleteMeasurementRow = (idx) => {
    setMeasurements((prev) => prev.filter((_, i) => i !== idx));

  };

  const handleSyncFromMeasurements = () => {
    const totalRollMeters = measurements.reduce((acc, m) => acc + (Number(m.actualQty) || 0), 0);

    if (totalRollMeters > 0) {
      setInspectedQty(String(Number(totalRollMeters.toFixed(2))));

      setTakaRoll(String(measurements.length));

      showToast(`Updated Inspected Qty to ${totalRollMeters.toFixed(2)} m from ${measurements.length} rolls.`);

    }

  };

  // Next / Prev Navigation
  const currentIndex = inspectionsList.findIndex((it) => it.id === selectedInspectionId);

  const handlePrevInspection = () => {
    if (currentIndex > 0) {
      loadInspectionIntoForm(inspectionsList[currentIndex - 1]);

    }

  };

  const handleNextInspection = () => {
    if (currentIndex >= 0 && currentIndex < inspectionsList.length - 1) {
      loadInspectionIntoForm(inspectionsList[currentIndex + 1]);

    }

  };

  // Save as Draft
  const handleSaveDraft = async () => {
    if (!selectedInspectionId) {
      showToast('Please select an inspection record first.', 'error');

      return;

    }

    setSavingDraft(true);

    try {
      const res = await inventoryService.saveQCDisposition({
        receiptId: selectedInspectionId,
        qcNo,
        sourceType,
        isDraft: true,
        goodQty: numGood,
        holdQty: numHold,
        reprocessQty: numReprocess,
        rejectedQty: numRejected,
        remarks,
        measurements,
      });

      setStatus(res?.status || status);

      showToast(res?.message || res?.data?.message || 'QC inspection saved as draft.');

      await fetchInspections(selectedInspectionId);

    } catch (err) {
      showToast('Could not save draft: ' + (err.response?.data?.detail || err.message), 'error');

    } finally {
      setSavingDraft(false);

    }

  };

  // Approve & Update Stock
  const handleApproveAndUpdateStock = async () => {
    if (!selectedInspectionId) {
      showToast('Please select an inspection record first.', 'error');

      return;

    }

    if (!isReconciled) {
      showToast(
        `Quantity mismatch: Inspected Qty (${numInspected} m) must equal Good (${numGood}) + Hold (${numHold}) + Reprocess (${numReprocess}) + Rejected (${numRejected}) = ${sumDisposition} m.`,
        'error'
      );

      return;

    }

    setApproving(true);

    try {
      const activeObj = inspectionsList.find((it) => it.id === selectedInspectionId);

      let res;

      if (activeObj?.isPieceInspection) {
        res = await inventoryService.approveQCInspection(selectedInspectionId);

      } else {
        res = await inventoryService.saveQCDisposition({
          receiptId: selectedInspectionId,
          qcNo,
          sourceType,
          isDraft: false,
          goodQty: numGood,
          holdQty: numHold,
          reprocessQty: numReprocess,
          rejectedQty: numRejected,
          remarks,
          measurements,
          jwoId: numReprocess > 0 ? jwoId || undefined : undefined,
        });

      }

      const finalStatus = res?.status || 'Completed';

      setStatus(finalStatus);

      showToast(res?.message || res?.data?.message || 'QC disposition approved! Stock Ledger and positions updated.');

      setSuccessModal({
        qcNo: qcNo || grnNo,
        grnNo: grnNo || qcNo,
        supplier,
        itemName,
        totalQty: numInspected,
        goodQty: numGood,
        holdQty: numHold,
        reprocessQty: numReprocess,
        rejectedQty: numRejected,
        status: finalStatus,
        stockPosted: res?.stockPosted ?? true,
        message: res?.message || 'QC disposition recorded successfully. Stock movements are active.',
      });

      await fetchInspections(selectedInspectionId);

    } catch (err) {
      showToast('Could not approve QC disposition: ' + (err.response?.data?.detail || err.message), 'error');

    } finally {
      setApproving(false);

    }

  };

  // Create Quick Test GRN (for immediate testing when database has no receipts)
  const handleCreateSampleGRN = async () => {
    setCreatingSample(true);

    try {
      const vendorParty = vendors[0] || { id: null, name: 'Sample Supplier' };

      const sampleItem = items[0] || { id: null, name: 'Cotton 60s Cambric', sku: 'COT-60S' };

      const warehouseLoc = locations[0] || { id: null, name: 'Central Godown' };

      const samplePayload = {
        supplierChallanNo: `CH-${Math.floor(1000 + Math.random() * 9000)}`,
        supplierChallanDate: new Date().toISOString().split('T')[0],
        receiptDate: new Date().toISOString().split('T')[0],
        party: vendorParty.id,
        location: warehouseLoc.id,
        lines: [
          {
            item: sampleItem.id,
            receivedQty: 300,
            stockQty: 300,
            uom: 'Mtr',
            batchNumber: `LOT-DEMO-${Math.floor(100 + Math.random() * 900)}`,
          },
        ],
      };

      await api.post('/purchase/receipts/', samplePayload);

      showToast('New test Goods Receipt created! Loading into QC...', 'success');

      await fetchInspections();

    } catch (err) {
      // If direct POST fails due to permissions, re-fetch
      await fetchInspections();

      showToast('Refresh complete. Please check the inspection dropdown.', 'info');

    } finally {
      setCreatingSample(false);

    }

  };

  // Filter summary counts
  const totalCount = inspectionsList.length;

  const pendingCount = inspectionsList.filter((it) => it.status === 'Pending' || it.status === 'Draft').length;

  const completedCount = inspectionsList.filter((it) => it.status === 'Completed' || it.status === 'Approved').length;

  return (

    <div className="space-y-5">
      {/* Toast Alert */}

      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2 text-sm font-medium border animate-in fade-in slide-in-from-top-2 ${
            toastType === 'error'
              ? 'bg-rose-600 text-white border-rose-700'
              : toastType === 'info'
              ? 'bg-sky-600 text-white border-sky-700'
              : 'bg-emerald-600 text-white border-emerald-700'
          }`}

        >
          {toastType === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          )}

          <span>{toastMsg}</span>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Standard QC Page Header Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}

      <QCPageHeader
        title="QC Results & Disposition"
        subtitle="Record commercial dispositioning: Good (Godown), Hold (Review), Reprocess (Dyeing Rework), or Reject (Debit Note)."
      />
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Top Bar: Status Summary & Live Navigation Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Status Counts */}

        <div className="flex items-center space-x-2 text-xs">
          <span className="font-semibold text-slate-700 mr-1">Inward Receipts:</span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Total: {totalCount}

          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Pending QC: {pendingCount}

          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Completed: {completedCount}

          </span>
        </div>
        {/* Right: Quick Links & Refresh */}

        <div className="flex items-center space-x-2">
          <Link
            to="/purchase/receipts"
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition inline-flex items-center gap-1.5"
          >
            <Truck className="w-3.5 h-3.5 text-slate-500" />
            <span>Goods Receipts</span>
          </Link>
          <Link
            to="/inventory/qc/pending"
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition inline-flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Pending Register</span>
          </Link>
          <button
            type="button"
            onClick={() => fetchInspections(selectedInspectionId)}

            disabled={loading}

            title="Refresh records from backend"
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ EMPTY STATE (When no receipts await disposition) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}

      {inspectionsList.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4 max-w-2xl mx-auto my-6">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 flex items-center justify-center mx-auto shadow-2xs">
            <PackageCheck className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No Receipts Awaiting QC Disposition</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Every inward goods receipt (GRN) or dyeing inward roll has already been dispositioned, or no incoming
              receipts have been recorded yet.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleCreateSampleGRN}

              disabled={creatingSample}

              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{creatingSample ? 'Creating Sample GRN...' : 'Generate Test GRN for QC'}</span>
            </button>
            <Link
              to="/purchase/receipts"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Goods Receipt (GRN)</span>
            </Link>
            <Link
              to="/inventory/qc/pending"
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <Clock className="w-4 h-4" />
              <span>View Pending Inspections</span>
            </Link>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ MAIN INSPECTION & DISPOSITION INTERFACE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}

      {inspectionsList.length > 0 && (
        <div className="space-y-5">
          {/* Top Selector Card */}

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="w-full md:w-auto flex-1 flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-700 shrink-0">Select Inspection / GRN:</label>
              <select
                value={selectedInspectionId}

                onChange={(e) => {
                  const sel = inspectionsList.find((it) => it.id === e.target.value);

                  if (sel) loadInspectionIntoForm(sel);

                }}

                className="w-full max-w-xl px-3 py-1.5 border border-blue-300 rounded-lg bg-blue-50/40 text-slate-900 font-semibold text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                {inspectionsList.map((insp) => (
                  <option key={insp.id} value={insp.id}>
                    {insp.qcNo}  |  {insp.supplier}  |  {insp.itemName} ({insp.inspectedQty || insp.receivedQty} m) [{insp.status}]
                  </option>
                ))}

              </select>
            </div>
            {/* Previous / Next Switcher */}

            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-[11px] font-semibold text-slate-500">
                {currentIndex + 1} of {inspectionsList.length}

              </span>
              <button
                type="button"
                onClick={handlePrevInspection}

                disabled={currentIndex <= 0}

                className="p-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Previous Inspection"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextInspection}

                disabled={currentIndex >= inspectionsList.length - 1}

                className="p-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Next Inspection"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* All Pending Done Helper Banner */}
          {pendingCount === 0 && (
            <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-blue-900">
                    All Inward Receipts Have Been Inspected (0 Pending)
                  </h4>
                  <p className="text-[11.5px] text-blue-700/90 mt-0.5">
                    Currently showing completed record <strong>{grnNo || qcNo}</strong>. To perform a new inspection, create a new GRN or generate a test GRN below.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCreateSampleGRN}
                  disabled={creatingSample}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{creatingSample ? 'Creating GRN...' : '+ Generate New Pending GRN'}</span>
                </button>
                <Link
                  to="/purchase/receipts"
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition"
                >
                  <Truck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Create Real GRN</span>
                </Link>
              </div>
            </div>
          )}

          {/* MAIN CARD CONTAINER */}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-6">
            {/* Approved / Completed Top Alert & Quick Actions */}

            {isLocked && (
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-emerald-900">
                        QC Disposition Approved & Active ({status})
                      </h4>
                      <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                        Stock Moved
                      </span>
                    </div>
                    <p className="text-[11.5px] text-emerald-800/90 mt-0.5">
                      {goodQty} m routed to <strong>Usable Godown</strong>
                      {Number(rejectedQty) > 0 && <>, <strong className="text-rose-700">{rejectedQty} m to Reject (Debit Note)</strong></>}

                      {Number(reprocessQty) > 0 && <>, <strong className="text-purple-700">{reprocessQty} m to Reprocess</strong></>}

                      {Number(holdQty) > 0 && <>, <strong className="text-amber-700">{holdQty} m on QC Hold</strong></>}.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Link
                    to="/inventory/stock-position"
                    className="px-3 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition"
                  >
                    <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                    <span>View Stock Position</span>
                  </Link>
                  {Number(rejectedQty) > 0 && (
                    <Link
                      to="/purchase/returns"
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Create / View Debit Note</span>
                    </Link>
                  )}

                  <Link
                    to="/purchase/receipts"
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition"
                  >
                    <Truck className="w-3.5 h-3.5 text-slate-500" />
                    <span>Goods Receipts</span>
                  </Link>
                </div>
              </div>
            )}

            {/* Top Details Grid */}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Swatch / Image Preview (3 cols) */}

              <div className="lg:col-span-3 space-y-3">
                <div
                  onClick={() => setShowImageModal(true)}

                  className="bg-slate-50 hover:bg-slate-100/80 rounded-xl overflow-hidden border border-slate-200 aspect-4/3 relative flex flex-col items-center justify-center p-4 text-center cursor-pointer transition group"
                >
                  <Camera className="w-9 h-9 text-slate-300 group-hover:text-blue-500 group-hover:scale-105 transition mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Inspection Attachments</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Physical swatch or defect images</p>
                  <span className="mt-2 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                    View Gallery
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 text-center">
                  Source: <span className="font-semibold text-slate-700">{sourceType}</span>
                </div>
              </div>
              {/* Right Column: Loaded Inspection Details (9 cols) */}

              <div className="lg:col-span-9 space-y-4">
                {/* Top Row: QC No, Status, Source, Date */}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                      QC / GRN No.
                    </span>
                    <span className="text-sm font-extrabold text-slate-800 font-mono">{qcNo || grnNo || '-'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                      QC Status
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border mt-0.5 ${
                        status === 'Completed' || status === 'Approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : status === 'On Hold'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : status === 'In Progress'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : 'bg-orange-50 text-orange-700 border-orange-200'
                      }`}

                    >
                      {status}

                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                      Inspection Date
                    </span>
                    <span className="text-xs font-bold text-slate-800">{date}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                      Lot / Batch No.
                    </span>
                    <span className="text-xs font-bold font-mono text-purple-700">{lotNo || '-'}</span>
                  </div>
                </div>
                {/* Second Row: Supplier & Fabric Information */}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 sm:col-span-1">
                    <span className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                      Supplier / Vendor
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-bold text-slate-800 truncate">{supplier || '-'}</span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 sm:col-span-2">
                    <span className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                      Fabric Item & Quality
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-blue-700">
                        {itemCode || 'FAB'}

                      </span>
                      <span className="font-bold text-slate-800 truncate">{itemName || 'Cotton Quality'}</span>
                      {quality && <span className="text-[11px] text-slate-500">({quality})</span>}

                    </div>
                  </div>
                </div>
                {/* Third Row: Total Quantities & Roll Count */}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-200">
                    <span className="block text-[10.5px] font-semibold text-blue-600 uppercase tracking-wider">
                      Inspected Qty (m) *
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={inspectedQty}

                      onChange={(e) => setInspectedQty(e.target.value)}

                      disabled={isLocked}

                      className="text-base font-extrabold text-blue-900 bg-transparent w-full focus:outline-hidden disabled:opacity-80"
                    />
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                      Taka / Roll Count
                    </span>
                    <span className="text-sm font-bold text-slate-800">{takaRoll} rolls</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                      Received Total
                    </span>
                    <span className="text-sm font-bold text-slate-800">{receivedQty} m</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="block text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                      Lock Status
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        isLocked ? 'text-slate-500' : 'text-emerald-700'
                      }`}

                    >
                      {isLocked ? 'Approved (Immutable)' : 'Open for Editing'}

                    </span>
                  </div>
                </div>
              </div>
            </div>
            {/* Ã¢â€â‚¬Ã¢â€â‚¬ SECTION: DISPOSITIONING CARDS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}

            <div className="pt-2 border-t border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <span>Quality Disposition Breakdown</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Allocate the {numInspected} m into destination stock categories.
                  </p>
                </div>
                {/* Quick Presets Toolbar */}

                {!isLocked && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-400 mr-1">Quick Fill:</span>
                    <button
                      type="button"
                      onClick={handleQuickFillAllGood}

                      className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md transition"
                    >
                      100% Pass
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickFillAllHold}

                      className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-md transition"
                    >
                      Hold All
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickFillAllReject}

                      className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md transition"
                    >
                      Reject All
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickFillReset}

                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-md transition"
                    >
                      Reset (0)
                    </button>
                  </div>
                )}

              </div>
              {/* 4 Cards Grid */}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Good Qty */}

                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1.5 transition hover:shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-emerald-700 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Good Qty (Accepted)</span>
                    </div>
                    <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                      {pctGood}%
                    </span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={goodQty}

                      onChange={(e) => setGoodQty(e.target.value)}

                      disabled={isLocked}

                      className="w-full text-lg font-black text-emerald-900 bg-white border border-emerald-300 rounded-lg px-2 py-1 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:opacity-75"
                    />
                    <span className="text-xs font-bold text-emerald-700">m</span>
                  </div>
                  <p className="text-[10.5px] text-emerald-700/80">Moved to usable Godown / ready for sale</p>
                </div>
                {/* 2. Hold Qty */}

                <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1.5 transition hover:shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-amber-700 font-bold text-xs">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Hold Qty (Review)</span>
                    </div>
                    <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                      {pctHold}%
                    </span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={holdQty}

                      onChange={(e) => handleHoldChange(e.target.value)}

                      disabled={isLocked}

                      className="w-full text-lg font-black text-amber-900 bg-white border border-amber-300 rounded-lg px-2 py-1 shadow-2xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden disabled:opacity-75"
                    />
                    <span className="text-xs font-bold text-amber-700">m</span>
                  </div>
                  <p className="text-[10.5px] text-amber-700/80">Stays at QC Hold pending decision</p>
                </div>
                {/* 3. Reprocess Qty */}

                <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl space-y-1.5 transition hover:shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-purple-700 font-bold text-xs">
                      <RotateCcw className="w-4 h-4 text-purple-600" />
                      <span>Reprocess Qty (Rework)</span>
                    </div>
                    <span className="text-[11px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                      {pctReprocess}%
                    </span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={reprocessQty}

                      onChange={(e) => handleReprocessChange(e.target.value)}

                      disabled={isLocked}

                      className="w-full text-lg font-black text-purple-900 bg-white border border-purple-300 rounded-lg px-2 py-1 shadow-2xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden disabled:opacity-75"
                    />
                    <span className="text-xs font-bold text-purple-700">m</span>
                  </div>
                  <p className="text-[10.5px] text-purple-700/80">Moved to Reprocess Stock for re-dyeing</p>
                  {numReprocess > 0 && (
                    <select
                      value={jwoId}

                      onChange={(e) => setJwoId(e.target.value)}

                      disabled={isLocked}

                      className="w-full text-xs bg-white border border-purple-300 rounded-lg px-2 py-1 text-purple-800 font-medium mt-1"
                    >
                      <option value="">Select Reprocess JWO...</option>
                      {jwoOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.jwo_no || o.jwoNo || o.id}

                        </option>
                      ))}

                    </select>
                  )}

                </div>
                {/* 4. Rejected Qty */}

                <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl space-y-1.5 transition hover:shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-rose-700 font-bold text-xs">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Rejected Qty (Debit)</span>
                    </div>
                    <span className="text-[11px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                      {pctRejected}%
                    </span>
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={rejectedQty}

                      onChange={(e) => handleRejectedChange(e.target.value)}

                      disabled={isLocked}

                      className="w-full text-lg font-black text-rose-900 bg-white border border-rose-300 rounded-lg px-2 py-1 shadow-2xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden disabled:opacity-75"
                    />
                    <span className="text-xs font-bold text-rose-700">m</span>
                  </div>
                  <p className="text-[10.5px] text-rose-700/80">Returned to vendor / Debit note issued</p>
                </div>
              </div>
              {/* Multi-segment Visual Progress Bar */}

              <div className="space-y-1.5 pt-1">
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex shadow-inner">
                  <div style={{ width: `${pctGood}%` }} className="bg-emerald-500 transition-all duration-300" />
                  <div style={{ width: `${pctHold}%` }} className="bg-amber-400 transition-all duration-300" />
                  <div style={{ width: `${pctReprocess}%` }} className="bg-purple-500 transition-all duration-300" />
                  <div style={{ width: `${pctRejected}%` }} className="bg-rose-500 transition-all duration-300" />
                </div>
              </div>
              {/* Total Reconciliation Banner */}

              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs transition ${
                  isReconciled
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50/80 border-amber-300 text-amber-900'
                }`}

              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-800">Total Inspected:</span>
                  <span className="font-mono font-extrabold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                    {numInspected} m
                  </span>
                  <span className="text-slate-400">=</span>
                  <span className="font-mono text-emerald-700 font-bold">{numGood} Good</span>
                  <span>+</span>
                  <span className="font-mono text-amber-700 font-bold">{numHold} Hold</span>
                  <span>+</span>
                  <span className="font-mono text-purple-700 font-bold">{numReprocess} Reprocess</span>
                  <span>+</span>
                  <span className="font-mono text-rose-700 font-bold">{numRejected} Rejected</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isReconciled ? (
                    <div className="inline-flex items-center space-x-1.5 bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-xs">
                      <Check className="w-4 h-4" />
                      <span>Reconciled (100%)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center space-x-1.5 bg-amber-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Difference: {diff > 0 ? `+${diff}` : diff} m</span>
                      </span>
                      {diff > 0 && !isLocked && (
                        <button
                          type="button"
                          onClick={handleAllocateRemainderToGood}

                          className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] font-bold transition shadow-2xs"
                        >
                          + Allocate Diff to Good
                        </button>
                      )}

                    </div>
                  )}

                </div>
              </div>
            </div>
            {/* Ã¢â€â‚¬Ã¢â€â‚¬ SECTION: MEASUREMENT DETAILS (ROLL / TAKA LEVEL) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-blue-600" />
                    <span>Roll / Taka Level Measurements</span>
                  </h4>
                  <p className="text-xs text-slate-500">Record roll-by-roll length, width, weight, and ASTM grade.</p>
                </div>
                {!isLocked && (
                  <div className="flex items-center gap-2">
                    {measurements.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSyncFromMeasurements}

                        className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                      >
                        Sync Inspected Qty
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleAddMeasurementRow}

                      className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg inline-flex items-center gap-1 shadow-2xs transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Roll</span>
                    </button>
                  </div>
                )}

              </div>
              {measurements.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 space-y-2">
                  <p>No roll-level measurements entered yet.</p>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={handleAddMeasurementRow}

                      className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs transition"
                    >
                      + Add Roll #1
                    </button>
                  )}

                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">#</th>
                        <th className="py-2.5 px-3">Roll / Taka No.</th>
                        <th className="py-2.5 px-3">Actual Qty (m)</th>
                        <th className="py-2.5 px-3">Width (inch)</th>
                        <th className="py-2.5 px-3">Weight (kg)</th>
                        <th className="py-2.5 px-3">Grade</th>
                        <th className="py-2.5 px-3">Remarks</th>
                        {!isLocked && <th className="py-2.5 px-3 w-12 text-center">Action</th>}

                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {measurements.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.takaNo || ''}

                              onChange={(e) => handleUpdateMeasurementRow(idx, 'takaNo', e.target.value)}

                              disabled={isLocked}

                              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white font-mono text-slate-800 w-32 focus:outline-hidden"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.01"
                              value={row.actualQty || 0}

                              onChange={(e) => handleUpdateMeasurementRow(idx, 'actualQty', Number(e.target.value))}

                              disabled={isLocked}

                              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white font-bold text-slate-900 w-24 focus:outline-hidden"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              value={row.width || 44}

                              onChange={(e) => handleUpdateMeasurementRow(idx, 'width', Number(e.target.value))}

                              disabled={isLocked}

                              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-800 w-20 focus:outline-hidden"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.1"
                              value={row.weight || 25}

                              onChange={(e) => handleUpdateMeasurementRow(idx, 'weight', Number(e.target.value))}

                              disabled={isLocked}

                              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-800 w-20 focus:outline-hidden"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={row.grade || 'A'}

                              onChange={(e) => handleUpdateMeasurementRow(idx, 'grade', e.target.value)}

                              disabled={isLocked}

                              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-800 font-bold focus:outline-hidden"
                            >
                              <option value="A">Grade A (Pass)</option>
                              <option value="B">Grade B (Second)</option>
                              <option value="C">Grade C (Rework)</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.remarks || ''}

                              onChange={(e) => handleUpdateMeasurementRow(idx, 'remarks', e.target.value)}

                              disabled={isLocked}

                              placeholder="Defect observations..."
                              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-800 w-full focus:outline-hidden"
                            />
                          </td>
                          {!isLocked && (
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteMeasurementRow(idx)}

                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition"
                                title="Delete row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}

                        </tr>
                      ))}

                    </tbody>
                  </table>
                </div>
              )}

            </div>
            {/* Ã¢â€â‚¬Ã¢â€â‚¬ SECTION: REMARKS & FINDINGS Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-slate-700 font-bold text-xs">Inspector Observations & Quality Remarks</label>
              <textarea
                rows="2"
                value={remarks}

                onChange={(e) => setRemarks(e.target.value)}

                disabled={isLocked}

                placeholder="Enter quality remarks, shade variation notes, selvage defects, or inspection findings..."
                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              />
            </div>
            {/* Ã¢â€â‚¬Ã¢â€â‚¬ SECTION: ACTION FOOTER Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}

            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {isLocked ? (
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Inspection already approved. Stock ledger movements are active.
                  </span>
                ) : (
                  <span>
                    Approving will post real movements to Godown, Reprocess Warehouse, or Scrap, and finalize this GRN.
                  </span>
                )}

              </div>
              <div className="flex items-center space-x-3 shrink-0">
                <button
                  type="button"
                  disabled={isLocked || savingDraft || approving}

                  onClick={handleSaveDraft}

                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-2xs transition disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-slate-500" />
                  <span>{savingDraft ? 'Saving Draft...' : 'Save as Draft'}</span>
                </button>
                <button
                  type="button"
                  disabled={isLocked || approving || savingDraft || !isReconciled}

                  onClick={handleApproveAndUpdateStock}

                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-xs transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{approving ? 'Posting Stock Updates...' : 'Approve & Update Stock'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal when user clicks Approve & Update Stock */}

      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Award className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">QC Disposition Approved & Stock Updated!</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Inspection for <strong className="text-slate-800">{successModal.grnNo}</strong> ({successModal.supplier}) has been recorded with verdict <span className="font-bold text-emerald-700">{successModal.status}</span>.
              </p>
            </div>
            {/* Breakdown Cards */}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Good Qty</span>
                <span className="text-lg font-extrabold text-emerald-800 font-mono">{successModal.goodQty} m</span>
                <span className="text-[9.5px] text-emerald-700 block mt-0.5">Godown Stock</span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[10px] font-bold text-amber-600 uppercase block">Hold Qty</span>
                <span className="text-lg font-extrabold text-amber-800 font-mono">{successModal.holdQty} m</span>
                <span className="text-[9.5px] text-amber-700 block mt-0.5">At QC Hold</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                <span className="text-[10px] font-bold text-purple-600 uppercase block">Reprocess Qty</span>
                <span className="text-lg font-extrabold text-purple-800 font-mono">{successModal.reprocessQty} m</span>
                <span className="text-[9.5px] text-purple-700 block mt-0.5">Dyeing Rework</span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[10px] font-bold text-rose-600 uppercase block">Rejected Qty</span>
                <span className="text-lg font-extrabold text-rose-800 font-mono">{successModal.rejectedQty} m</span>
                <span className="text-[9.5px] text-rose-700 block mt-0.5">Debit Note</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>System Actions Executed:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-slate-500 space-y-0.5 pl-1">
                <li>Stock moved out of QC Hold into designated physical warehouse positions.</li>
                <li>Goods Receipt ({successModal.grnNo}) and Purchase Bill marked as {successModal.status}.</li>
                {Number(successModal.rejectedQty) > 0 && (
                  <li className="text-rose-600 font-medium">{successModal.rejectedQty} m rejected goods eligible for Supplier Debit Note / Purchase Return.</li>
                )}

              </ul>
            </div>
            {/* Direct Navigation Links */}

            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {Number(successModal.rejectedQty) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessModal(null);

                      navigate('/purchase/returns');

                    }}

                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Raise Debit Note / Return ({successModal.rejectedQty} m)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSuccessModal(null);

                    navigate('/inventory/stock-position');

                  }}

                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Boxes className="w-4 h-4" />
                  <span>View Godown Stock</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessModal(null);

                    navigate('/purchase/receipts');

                  }}

                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>Goods Receipts</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessModal(null);

                    const nextPending = inspectionsList.find(it => it.id !== selectedInspectionId && ['Pending', 'Draft', 'On Hold'].includes(it.status));

                    if (nextPending) {
                      loadInspectionIntoForm(nextPending);

                    }

                  }}

                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <span>Next Inspection</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setSuccessModal(null)}

                  className="text-[11px] text-slate-400 hover:text-slate-600 font-medium underline cursor-pointer"
                >
                  Close & stay on this inspection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}

      {showImageModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800">Inspection Attachments</h3>
              <button
                type="button"
                onClick={() => setShowImageModal(false)}

                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                &times;

              </button>
            </div>
            <div className="rounded-xl overflow-hidden border p-8 bg-slate-50 flex flex-col items-center justify-center text-center">
              <Camera className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">No defect photos attached for {qcNo || 'current lot'}.</p>
              <p className="text-[11px] text-slate-400 mt-1">Photos can be captured via mobile QC or Goods Receipt.</p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowImageModal(false)}

                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

}
