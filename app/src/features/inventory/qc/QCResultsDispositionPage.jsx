import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Edit2,
  Camera,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  PauseCircle,
  RotateCcw,
} from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { api } from '../../../services/api';
import { useERP } from '../../../context/ERPContext';
import PageInfoButton from '../../../components/ui/PageInfoButton';

export default function QCResultsDispositionPage() {
  const { vendors = [], items = [] } = useERP();

  const [loading, setLoading] = useState(true);
  const [inspectionsList, setInspectionsList] = useState([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState('');

  // Active Inspection Form State
  const [qcNo, setQcNo] = useState('');
  const [status, setStatus] = useState('Pending');
  const [sourceType, setSourceType] = useState('Purchase (GRN)');
  const [grnNo, setGrnNo] = useState('');
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [lotNo, setLotNo] = useState('');
  const [takaRoll, setTakaRoll] = useState('1');
  const [inspectedQty, setInspectedQty] = useState('0');

  // Measurements Table Rows
  const [measurements, setMeasurements] = useState([]);

  // Disposition Quantities
  const [goodQty, setGoodQty] = useState('0');
  const [holdQty, setHoldQty] = useState('0');
  const [reprocessQty, setReprocessQty] = useState('0');
  const [rejectedQty, setRejectedQty] = useState('0');
  const [remarks, setRemarks] = useState('');
  // Reprocess quantity is sent on a real job work order (required by the server).
  const [jwoId, setJwoId] = useState('');
  const [jwoOptions, setJwoOptions] = useState([]);
  useEffect(() => {
    let active = true;
    api.get('/jobwork/orders/', { query: { limit: 200 } })
      .then((res) => { if (active) setJwoOptions(Array.isArray(res?.results) ? res.results : (Array.isArray(res) ? res : [])); })
      .catch(() => { if (active) setJwoOptions([]); });
    return () => { active = false; };
  }, []);

  // UI state
  const [savingDraft, setSavingDraft] = useState(false);
  const [approving, setApproving] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Fetch Inspections from backend
  const fetchInspections = useCallback(async (preferredId = null) => {
    setLoading(true);
    try {
      const [resDisp, resPiece] = await Promise.allSettled([
        inventoryService.getQCDispositionList(),
        inventoryService.getQCInspections({ status: 'Draft' }),
      ]);
      const dispList = (resDisp.status === 'fulfilled' && (resDisp.value?.data ? resDisp.value.data.inspections : resDisp.value?.inspections)) || [];
      const pieceRaw = (resPiece.status === 'fulfilled' && (Array.isArray(resPiece.value) ? resPiece.value : (resPiece.value?.results || []))) || [];
      const pieceList = pieceRaw.map((p) => ({
        id: p.id,
        qcNo: p.inspectionNumber,
        grnNo: p.sourceDocumentNumber || p.inspectionNumber,
        date: p.inspectionDate || '',
        status: p.status === 'Approved' ? 'Completed' : (p.status || 'Pending'),
        sourceType: 'Piece Inspection (ASTM D5430)',
        supplier: p.inspectorName || 'Internal Inspection',
        itemCode: p.lines?.[0]?.lotNo || 'Piece Lot',
        itemName: `Piece QC Inspection ${p.inspectionNumber}`,
        lotNo: p.lines?.[0]?.lotNo || '',
        takaRoll: p.lines?.length || 1,
        inspectedQty: p.total_inspected_qty || 0,
        goodQty: p.passed_qty || 0,
        holdQty: p.hold_qty || 0,
        reprocessQty: p.reprocess_qty || 0,
        rejectedQty: p.rejected_qty || 0,
        remarks: p.notes || '',
        isPieceInspection: true,
        measurements: (p.lines || []).map((l, i) => ({
          srNo: i + 1,
          takaNo: l.takaNo || i + 1,
          actualQty: l.actualMeter || 0,
          width: l.width || 44,
          weight: l.rollWeight || 25,
          grade: l.grade,
          pointsPer100M: l.pointsPer100SqMeter,
          penaltyPoints: l.penaltyPoints,
          remarks: l.remarks || '',
          good: l.disposition === 'Pass' ? l.actualMeter : 0,
          hold: l.disposition === 'Hold' ? l.actualMeter : 0,
          reprocess: l.disposition === 'Reprocess' ? l.actualMeter : 0,
          rejected: l.disposition === 'Reject' || l.disposition === 'Second Quality' ? l.actualMeter : 0,
          defects: l.defects || [],
        })),
      }));

      const list = [...dispList, ...pieceList];
      setInspectionsList(list);

      const target = preferredId ? list.find((it) => it.id === preferredId) : (list.length > 0 ? list[0] : null);
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
  }, []);

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

  const loadInspectionIntoForm = (insp) => {
    setSelectedInspectionId(insp.id || '');
    setQcNo(insp.qcNo || `QC-${insp.grnNo?.slice(-3) || '001'}`);
    setStatus(insp.status || 'Pending');
    setSourceType(insp.sourceType || 'Purchase (GRN)');
    setGrnNo(insp.grnNo || '');
    setSupplier(insp.supplier || '');
    setDate(insp.date || new Date().toISOString().split('T')[0]);
    setItemCode(insp.itemCode || '');
    setItemName(insp.itemName || '');
    setLotNo(insp.lotNo || '');
    setTakaRoll(String(insp.takaRoll || 1));
    const insQ = String(insp.inspectedQty ?? insp.receivedQty ?? 0);
    setInspectedQty(insQ);

    // Load or calculate disposition quantities
    if (insp.goodQty || insp.holdQty || insp.reprocessQty || insp.rejectedQty) {
      setGoodQty(String(insp.goodQty || 0));
      setHoldQty(String(insp.holdQty || 0));
      setReprocessQty(String(insp.reprocessQty || 0));
      setRejectedQty(String(insp.rejectedQty || 0));
    } else {
      // Nothing is assumed: the inspector enters the split.
      setGoodQty('0');
      setHoldQty('0');
      setReprocessQty('0');
      setRejectedQty('0');
    }

    setRemarks(insp.remarks || '');
    setMeasurements(insp.measurements || []);
  };

  const resetForm = () => {
    setSelectedInspectionId('');
    setQcNo('');
    setStatus('Pending');
    setGrnNo('');
    setSupplier('');
    setItemCode('');
    setItemName('');
    setLotNo('');
    setTakaRoll('1');
    setInspectedQty('0');
    setGoodQty('0');
    setHoldQty('0');
    setReprocessQty('0');
    setRejectedQty('0');
    setRemarks('');
    setMeasurements([]);
  };

  // Reconciled math
  const numInspected = Number(inspectedQty) || 0;
  const numGood = Number(goodQty) || 0;
  const numHold = Number(holdQty) || 0;
  const numReprocess = Number(reprocessQty) || 0;
  const numRejected = Number(rejectedQty) || 0;
  const sumDisposition = numGood + numHold + numReprocess + numRejected;
  const isReconciled = numInspected > 0 && Math.abs(sumDisposition - numInspected) < 0.001;
  // The backend only accepts a disposition while QC is still open; once it is
  // approved the stock has already moved and the split can no longer change.
  const isLocked = !['Pending', 'Draft', 'On Hold', 'In Progress'].includes(status);

  // Percentage calculations
  const pctGood = numInspected > 0 ? ((numGood / numInspected) * 100).toFixed(1) : '0.0';
  const pctHold = numInspected > 0 ? ((numHold / numInspected) * 100).toFixed(1) : '0.0';
  const pctReprocess = numInspected > 0 ? ((numReprocess / numInspected) * 100).toFixed(1) : '0.0';
  const pctRejected = numInspected > 0 ? ((numRejected / numInspected) * 100).toFixed(1) : '0.0';

  // Measurement rows actions
  const handleAddMeasurementRow = () => {
    const nextIdx = measurements.length + 1;
    const perTaka = measurements.length > 0 ? measurements[0].actualQty : (numInspected / (Number(takaRoll) || 1)).toFixed(2);
    setMeasurements((prev) => [
      ...prev,
      {
        srNo: nextIdx,
        takaNo: nextIdx,
        actualQty: Number(perTaka) || 0,
        width: 0,
        weight: 0,
        remarks: '-',
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

  // Save as Draft
  const handleSaveDraft = async () => {
    if (!selectedInspectionId) {
      alert('Please select an inspection record first.');
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
      setToastMsg(res?.data?.message || 'QC inspection saved as draft.');
      await fetchInspections(selectedInspectionId);
    } catch (err) {
      alert('Could not save draft: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingDraft(false);
    }
  };

  // Approve & Update Stock
  const handleApproveAndUpdateStock = async () => {
    if (!selectedInspectionId) {
      alert('Please select an inspection record first.');
      return;
    }
    if (!isReconciled) {
      alert(
        `Quantity mismatch: Inspected Qty (${numInspected} m) must equal Good (${numGood}) + Hold (${numHold}) + Reprocess (${numReprocess}) + Rejected (${numRejected}) = ${sumDisposition} m.`
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
      setStatus(res?.status || 'Completed');
      setToastMsg(res?.data?.message || 'QC disposition approved! Stock Ledger and Stock Position updated.');
      await fetchInspections(selectedInspectionId);
    } catch (err) {
      alert('Could not approve QC disposition: ' + (err.response?.data?.detail || err.message));
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center space-x-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              4
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">QC Results & Disposition</h1>
                <PageInfoButton title="QC Results & Disposition" />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Record final result and update stock to Good / Hold / Reprocess / Reject.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
          <span>QC (Quality Check)</span>
          <span>&gt;</span>
          <span className="text-blue-600 font-semibold">QC Results & Disposition</span>
        </div>
      </div>

      {/* MAIN CARD: FORM CONTAINER */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-6">
        {/* Top Section: Left Fabric Gallery + Right Inspection Inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Inspection Media (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200 aspect-4/3 relative flex flex-col items-center justify-center p-4 text-center">
              <Camera className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">Inspection Attachments</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Physical swatch or defect images</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 text-center">
              No defect photos attached for {qcNo || 'current lot'}.
            </div>
          </div>

          {/* Right Inputs Grid (9 cols) */}
          <div className="lg:col-span-9 space-y-4">
            {/* Top row: QC No selector & Status Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Inspection</label>
                <select
                  value={selectedInspectionId}
                  onChange={(e) => {
                    const sel = inspectionsList.find((it) => it.id === e.target.value);
                    if (sel) loadInspectionIntoForm(sel);
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium"
                >
                  {inspectionsList.length === 0 ? (
                    <option value="">No receipts in database</option>
                  ) : (
                    inspectionsList.map((insp) => (
                      <option key={insp.id} value={insp.id}>
                        {insp.qcNo} — {insp.supplier} ({insp.grnNo})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">QC No.</label>
                <input
                  type="text"
                  value={qcNo}
                  onChange={(e) => setQcNo(e.target.value)}
                  placeholder="QC-001"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-800 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status</label>
                <div className="pt-1">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold border ${
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
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Source Type</label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="Purchase (GRN)">Purchase (GRN)</option>
                  <option value="Job Work Inward">Job Work Inward</option>
                </select>
              </div>
            </div>

            {/* Second row: GRN, Supplier, Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">GRN No.</label>
                <input
                  type="text"
                  value={grnNo}
                  onChange={(e) => setGrnNo(e.target.value)}
                  placeholder="GRN-001"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-medium mb-1">Supplier / Vendor</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Supplier Name"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-medium"
                />
              </div>
            </div>

            {/* Third row: Date, Item Code, Item Name */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Inspection Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Item Code</label>
                <div className="relative">
                  <input
                    type="text"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder="COT-60S-001"
                    className="w-full pl-2.5 pr-7 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-mono"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-medium mb-1">Item Name</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Cotton 60s - Floral - Navy"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-medium"
                />
              </div>
            </div>

            {/* Fourth row: Lot No, Taka Roll, Inspected Qty */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Lot No.</label>
                <input
                  type="text"
                  value={lotNo}
                  onChange={(e) => setLotNo(e.target.value)}
                  placeholder="LT-001"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Taka/Roll Count</label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="1"
                    value={takaRoll}
                    onChange={(e) => setTakaRoll(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-800"
                  />
                  <span className="text-slate-400 text-xs">rolls</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Inspected Qty (m) *</label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inspectedQty}
                    onChange={(e) => setInspectedQty(e.target.value)}
                    disabled={isLocked}
                    className="w-full px-2.5 py-1.5 border border-blue-300 rounded-lg bg-blue-50/50 text-blue-900 font-bold"
                  />
                  <span className="text-slate-500 text-xs font-semibold">m</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Section: Left Measurement Details (Optional) + Right QC Result Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-200">
          {/* Measurement Details (Optional) — 6 cols */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Measurement Details (Optional)</h2>
              <button
                type="button"
                onClick={handleAddMeasurementRow}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Sr. No.</th>
                    <th className="p-2.5">Taka/Roll No.</th>
                    <th className="p-2.5">Actual Qty (m)</th>
                    <th className="p-2.5">Width (cm)</th>
                    <th className="p-2.5">Weight (kg)</th>
                    <th className="p-2.5">ASTM Grade</th>
                    <th className="p-2.5">Remarks</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {measurements.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-4 text-center text-slate-400">
                        No roll measurements entered yet. Click <strong>+ Add Row</strong> to record taka-level data.
                      </td>
                    </tr>
                  ) : (
                    measurements.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-slate-500">{m.srNo || idx + 1}</td>
                        <td className="p-2.5 font-medium">{m.takaNo || idx + 1}</td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            value={m.actualQty}
                            onChange={(e) => handleUpdateMeasurementRow(idx, 'actualQty', Number(e.target.value))}
                            className="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-xs"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            value={m.width ?? ''}
                            onChange={(e) => handleUpdateMeasurementRow(idx, 'width', Number(e.target.value))}
                            className="w-14 px-1.5 py-0.5 border border-slate-200 rounded text-xs"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="number"
                            value={m.weight || 25}
                            onChange={(e) => handleUpdateMeasurementRow(idx, 'weight', Number(e.target.value))}
                            className="w-14 px-1.5 py-0.5 border border-slate-200 rounded text-xs"
                          />
                        </td>
                        <td className="p-2.5">
                          {m.grade ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.grade === 'A' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              m.grade === 'B' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              m.grade === 'C' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              Grade {m.grade} {m.pointsPer100M ? `(${m.pointsPer100M} pts)` : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={m.remarks || '-'}
                            onChange={(e) => handleUpdateMeasurementRow(idx, 'remarks', e.target.value)}
                            className="w-24 px-1.5 py-0.5 border border-slate-200 rounded text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteMeasurementRow(idx)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right QC Result Section (4 Cards + Reconciliation Bar + Remarks) — 6 cols */}
          <div className="lg:col-span-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-900">QC Result & Disposition</h2>

            {isLocked && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  This QC is already <strong>{status}</strong> and its stock has been posted. To send fabric to
                  reprocess now, use <strong>QC → Reinspection / Reprocess</strong>, or pick an inspection that is still pending.
                </span>
              </div>
            )}

            {/* 4 Disposition Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Good Qty */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                <div className="flex items-center space-x-1.5 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-bold text-xs">Good Qty</span>
                </div>
                <div className="flex items-baseline space-x-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={goodQty}
                    onChange={(e) => setGoodQty(e.target.value)}
                    disabled={isLocked}
                    className="w-full text-base font-extrabold text-emerald-800 bg-white border border-emerald-300 rounded px-1.5 py-0.5"
                  />
                  <span className="text-xs font-semibold text-emerald-700">m</span>
                </div>
                <div className="text-[11px] font-semibold text-emerald-600">{pctGood}%</div>
              </div>

              {/* Hold Qty */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                <div className="flex items-center space-x-1.5 text-amber-700">
                  <PauseCircle className="w-4 h-4" />
                  <span className="font-bold text-xs">Hold Qty</span>
                </div>
                <div className="flex items-baseline space-x-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={holdQty}
                    onChange={(e) => setHoldQty(e.target.value)}
                    disabled={isLocked}
                    className="w-full text-base font-extrabold text-amber-800 bg-white border border-amber-300 rounded px-1.5 py-0.5"
                  />
                  <span className="text-xs font-semibold text-amber-700">m</span>
                </div>
                <div className="text-[11px] font-semibold text-amber-600">{pctHold}%</div>
              </div>

              {/* Reprocess Qty */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1">
                <div className="flex items-center space-x-1.5 text-purple-700">
                  <RotateCcw className="w-4 h-4" />
                  <span className="font-bold text-xs">Reprocess Qty</span>
                </div>
                <div className="flex items-baseline space-x-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={reprocessQty}
                    onChange={(e) => setReprocessQty(e.target.value)}
                    disabled={isLocked}
                    className="w-full text-base font-extrabold text-purple-800 bg-white border border-purple-300 rounded px-1.5 py-0.5"
                  />
                  <span className="text-xs font-semibold text-purple-700">m</span>
                </div>
                <div className="text-[11px] font-semibold text-purple-600">{pctReprocess}%</div>
                {numReprocess > 0 && (
                  <select
                    value={jwoId}
                    onChange={(e) => setJwoId(e.target.value)}
                    disabled={isLocked}
                    className="w-full text-xs bg-white border border-purple-300 rounded px-1.5 py-1 text-purple-800"
                  >
                    <option value="">Job work order *</option>
                    {jwoOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.jwo_no || o.jwoNo || o.id}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Rejected Qty */}
              <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl space-y-1">
                <div className="flex items-center space-x-1.5 text-red-700">
                  <XCircle className="w-4 h-4" />
                  <span className="font-bold text-xs">Rejected Qty</span>
                </div>
                <div className="flex items-baseline space-x-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rejectedQty}
                    onChange={(e) => setRejectedQty(e.target.value)}
                    disabled={isLocked}
                    className="w-full text-base font-extrabold text-red-800 bg-white border border-red-300 rounded px-1.5 py-0.5"
                  />
                  <span className="text-xs font-semibold text-red-700">m</span>
                </div>
                <div className="text-[11px] font-semibold text-red-600">{pctRejected}%</div>
              </div>
            </div>

            {/* Total Inspected Quantity Reconciliation Bar */}
            <div
              className={`p-3 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs transition ${
                isReconciled
                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50/70 border-amber-300 text-amber-800'
              }`}
            >
              <div className="font-medium">
                <span className="font-bold">Total Inspected Qty: </span>
                <span className="font-mono">{numInspected} m</span>
                <span className="text-slate-400 mx-1">=</span>
                <span className="font-mono text-emerald-700">{numGood}</span> +{' '}
                <span className="font-mono text-amber-700">{numHold}</span> +{' '}
                <span className="font-mono text-purple-700">{numReprocess}</span> +{' '}
                <span className="font-mono text-red-700">{numRejected}</span>
              </div>

              {isReconciled ? (
                <div className="inline-flex items-center space-x-1 bg-emerald-600 text-white px-2.5 py-1 rounded-md text-[11px] font-bold shadow-2xs">
                  <Check className="w-3.5 h-3.5" />
                  <span>Quantity Reconciled</span>
                </div>
              ) : (
                <div className="inline-flex items-center space-x-1 bg-amber-600 text-white px-2.5 py-1 rounded-md text-[11px] font-bold shadow-2xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Diff: {(numInspected - sumDisposition).toFixed(2)} m</span>
                </div>
              )}
            </div>

            {/* Remarks Textarea */}
            <div>
              <label className="block text-slate-700 font-semibold text-xs mb-1">Remarks</label>
              <textarea
                rows="2"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter quality remarks, shade variation, or inspection findings..."
                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Action Buttons: Save as Draft vs Approve & Update Stock */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={isLocked || savingDraft || approving}
                onClick={handleSaveDraft}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-2xs transition disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-slate-500" />
                <span>{savingDraft ? 'Saving Draft...' : 'Save as Draft'}</span>
              </button>

              <button
                type="button"
                disabled={isLocked || approving || savingDraft || !isReconciled}
                onClick={handleApproveAndUpdateStock}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-xs transition"
              >
                <Check className="w-4 h-4" />
                <span>{approving ? 'Posting Stock Updates...' : 'Approve & Update Stock'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-4 space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800">Fabric Inspection Image</h3>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>
            <div className="rounded-lg overflow-hidden border p-8 bg-slate-50 flex flex-col items-center justify-center text-center">
              <Camera className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-700">No inspection image uploaded for this lot.</p>
              <p className="text-[11px] text-slate-400 mt-1">Images can be attached via Goods Receipt or QC Inspection.</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowImageModal(false)}
                className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
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
