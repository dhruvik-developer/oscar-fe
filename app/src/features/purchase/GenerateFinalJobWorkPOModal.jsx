import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, FileText, Users, BarChart3, PackageCheck, Boxes, Plus, Trash2,
  UploadCloud, Calculator, CheckCircle2, XCircle, AlertTriangle, Package,
  Info, Eye, ExternalLink, Download, FileSpreadsheet, Loader2, Maximize2, Minimize2,
} from 'lucide-react';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';
import MasterSourceLink from '../../components/common/MasterSourceLink';

const fmtM = (n) => (n === null || n === undefined || n === '' ? '—' : `${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })} M`);
const fmtINR = (n) => (n === null || n === undefined || n === '' ? '₹ 0.00' : `₹ ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const fmtDateDisplay = (d) => {
  if (!d) return '—';
  const parts = String(d).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
};

export default function GenerateFinalJobWorkPOModal({
  isOpen,
  onClose,
  initialInstructionId = null,
  onSuccess,
}) {
  const { vendors = [], showToast } = useERP();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [instructions, setInstructions] = useState([]);
  const [selectedPiId, setSelectedPiId] = useState(initialInstructionId || '');
  const [employees, setEmployees] = useState([]);

  // Resizable & Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [modalWidth, setModalWidth] = useState(null);
  const [modalHeight, setModalHeight] = useState(null);
  const resizeRef = useRef(null);

  const startResizing = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const currentEl = resizeRef.current;
    const rect = currentEl ? currentEl.getBoundingClientRect() : null;
    const startWidth = rect ? rect.width : 1152;
    const startHeight = rect ? rect.height : 700;

    const onMouseMove = (moveEvent) => {
      const deltaX = (moveEvent.clientX - startX) * 2;
      const deltaY = moveEvent.clientY - startY;
      const newWidth = Math.min(Math.max(startWidth + deltaX, 760), window.innerWidth - 20);
      const newHeight = Math.min(Math.max(startHeight + deltaY, 450), window.innerHeight - 20);
      setModalWidth(newWidth);
      setModalHeight(newHeight);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Form Fields
  const [finalPoNo, setFinalPoNo] = useState('');
  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [projectCode, setProjectCode] = useState('');
  const [processType, setProcessType] = useState('Processing');
  const [greyLotNo, setGreyLotNo] = useState('');

  const [vendorId, setVendorId] = useState('');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [fabric, setFabric] = useState('');
  const [uom, setUom] = useState('Meter');
  const [agreedJobRate, setAgreedJobRate] = useState(28.5);
  const [gstPct, setGstPct] = useState(5);

  // Production Summary
  const [orderQty, setOrderQty] = useState(500);
  const [totalProduced, setTotalProduced] = useState(0);
  const [rejectedQty, setRejectedQty] = useState(0);
  const [acceptedQty, setAcceptedQty] = useState(0);
  const [shortageQty, setShortageQty] = useState(0);
  const [dailyEntries, setDailyEntries] = useState([]);

  // Items table
  const [items, setItems] = useState([]);

  // Remarks & Attachments
  const [remarks, setRemarks] = useState('Final PO generated for verified accepted quantity.');
  const [attachments, setAttachments] = useState([
    { name: 'Production_Summary.pdf', size: '1.2 MB' },
    { name: 'QC_Report.pdf', size: '850 KB' },
    { name: 'Rate_Approval.pdf', size: '600 KB' },
  ]);

  // Amount Summary
  const [otherCharges, setOtherCharges] = useState(0);
  const [sendToApproval, setSendToApproval] = useState(true);

  // Load Instructions and Employees on open
  useEffect(() => {
    if (!isOpen) return;

    // Load next PO number
    api.get('/purchase/orders/next-jwpo-number/')
      .then((res) => {
        if (res?.nextPoNumber) setFinalPoNo(res.nextPoNumber);
      })
      .catch(() => {
        const year = new Date().getFullYear();
        setFinalPoNo(`JWPO-${year}-0001`);
      });

    // Load instructions list
    api.get('/production/instructions/', { query: { page_size: 200 } })
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.results || res?.data || [];
        setInstructions(list);
        if (!selectedPiId && list.length > 0) {
          const target = initialInstructionId ? String(initialInstructionId) : String(list[0].id);
          setSelectedPiId(target);
        }
      })
      .catch((err) => console.error('Failed to load instructions:', err));

    // Load active employees
    api.get('/hrms/employees/', { query: { page_size: 100 } })
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.results || res?.data || [];
        setEmployees(list);
      })
      .catch(() => {});
  }, [isOpen, initialInstructionId]);

  // When selected PI changes, load full completion details
  useEffect(() => {
    if (!selectedPiId) return;

    setLoading(true);
    api.get(`/production/instructions/${selectedPiId}/completion/`)
      .then((data) => {
        if (!data) return;

        setProcessType(data.processType || 'Processing');
        setGreyLotNo(data.greyLotNo || 'LOT-2026-00001');
        setProjectCode(data.orderReference || 'PRJ-2026-002');
        setFabric(data.fabric || 'Chiffon Grey Fabric');
        setUom(data.rateUom || 'Meter');

        const rate = Number(data.jobRate) || 28.5;
        setAgreedJobRate(rate);

        const oQty = Number(data.orderQty) || 0;
        const prod = Number(data.totalProduced) || 0;
        const rej = Number(data.rejectedQty) || 0;
        const acc = Number(data.acceptedQty) || (prod - rej > 0 ? prod - rej : prod);
        const diff = Number(data.shortageQty) || (oQty - acc);

        setOrderQty(oQty);
        setTotalProduced(prod);
        setRejectedQty(rej);
        setAcceptedQty(acc);
        setShortageQty(diff);

        // Daily verified rows
        const rows = data.dailySummary || [];
        setDailyEntries(rows);

        // Select vendor if matched
        if (data.agencyId) {
          setVendorId(String(data.agencyId));
        } else if (data.agency && vendors.length > 0) {
          const match = vendors.find((v) => v.name?.toLowerCase() === data.agency.toLowerCase());
          if (match) setVendorId(String(match.id));
          else if (vendors[0]) setVendorId(String(vendors[0].id));
        } else if (vendors[0]) {
          setVendorId(String(vendors[0].id));
        }

        if (data.assignedEmployeeId) {
          setAssignedEmployeeId(String(data.assignedEmployeeId));
        }

        // Initialize PO Item Details
        const billable = acc > 0 ? acc : (prod > 0 ? prod : 800);
        const basicAmt = billable * rate;
        const gstAmt = (basicAmt * gstPct) / 100;
        const totalAmt = basicAmt + gstAmt;

        const descLines = ['Processing Job Work', data.fabric || 'Chiffon Grey Fabric'];
        if (data.greyLotNo) descLines.push(data.greyLotNo);

        setItems([
          {
            id: 'item-1',
            description: descLines.join('\n'),
            uom: data.rateUom || 'Meter',
            billableQty: billable,
            rate: rate,
            basicAmount: basicAmt,
            gstPct: gstPct,
            gstAmount: gstAmt,
            totalAmount: totalAmt,
          },
        ]);
      })
      .catch((err) => {
        console.error('Failed to load PI completion:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedPiId, vendors]);

  // Recalculate item amounts when billableQty, rate, or gstPct changes
  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      const bQty = Number(field === 'billableQty' ? value : item.billableQty) || 0;
      const r = Number(field === 'rate' ? value : item.rate) || 0;
      const g = Number(field === 'gstPct' ? value : item.gstPct) || 0;

      const basic = bQty * r;
      const gstVal = (basic * g) / 100;
      item.basicAmount = basic;
      item.gstAmount = gstVal;
      item.totalAmount = basic + gstVal;

      updated[index] = item;
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: `Processing Job Work\n${fabric || 'Grey Fabric'}`,
        uom: uom || 'Meter',
        billableQty: 100,
        rate: agreedJobRate || 28.5,
        basicAmount: 100 * (agreedJobRate || 28.5),
        gstPct: gstPct,
        gstAmount: (100 * (agreedJobRate || 28.5) * gstPct) / 100,
        totalAmount: (100 * (agreedJobRate || 28.5)) * (1 + gstPct / 100),
      },
    ]);
  };

  const handleDeleteItem = (index) => {
    if (items.length <= 1) {
      if (showToast) showToast('At least one item is required in the PO.', 'warning');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newItems = files.map((f) => ({
      name: f.name,
      size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
    }));
    setAttachments((prev) => [...prev, ...newItems]);
  };

  const handleDeleteAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Aggregated totals
  const totalBillableQty = useMemo(() => items.reduce((sum, it) => sum + (Number(it.billableQty) || 0), 0), [items]);
  const totalBasicAmount = useMemo(() => items.reduce((sum, it) => sum + (Number(it.basicAmount) || 0), 0), [items]);
  const totalGstAmount = useMemo(() => items.reduce((sum, it) => sum + (Number(it.gstAmount) || 0), 0), [items]);
  const finalTotalAmount = useMemo(() => totalBasicAmount + totalGstAmount + (Number(otherCharges) || 0), [totalBasicAmount, totalGstAmount, otherCharges]);

  // Verified Details totals
  const verifiedProducedSum = useMemo(() => dailyEntries.reduce((s, e) => s + (Number(e.produced) || 0), 0), [dailyEntries]);
  const verifiedRejectedSum = useMemo(() => dailyEntries.reduce((s, e) => s + (Number(e.rejected) || 0), 0), [dailyEntries]);
  const verifiedAcceptedSum = useMemo(() => dailyEntries.reduce((s, e) => s + (Number(e.accepted) || (Number(e.produced) - (Number(e.rejected) || 0))), 0), [dailyEntries]);

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendorId) {
      if (showToast) showToast('Please select an Agency / Vendor.', 'error');
      return;
    }
    if (!items.length) {
      if (showToast) showToast('Please add at least one item.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        instructionId: selectedPiId || undefined,
        finalPoNo: finalPoNo.trim(),
        poDate: poDate,
        vendorId: vendorId,
        assignedEmployeeId: assignedEmployeeId || undefined,
        fabric: fabric,
        uom: uom,
        agreedJobRate: agreedJobRate,
        gstPct: gstPct,
        items: items.map((it) => ({
          description: it.description,
          uom: it.uom,
          billableQty: it.billableQty,
          rate: it.rate,
          basicAmount: it.basicAmount,
          gstPct: it.gstPct,
          gstAmount: it.gstAmount,
          totalAmount: it.totalAmount,
        })),
        remarks: remarks,
        otherCharges: Number(otherCharges) || 0,
        sendToApproval: sendToApproval,
      };

      let res;
      if (selectedPiId) {
        res = await api.post(`/production/instructions/${selectedPiId}/generate-po/`, payload);
      } else {
        res = await api.post('/purchase/orders/generate-final-job-work/', payload);
      }

      if (showToast) {
        showToast(
          res?.finalPoNumber || finalPoNo
            ? `Final Job Work PO ${res?.finalPoNumber || finalPoNo} created successfully!`
            : 'Final Job Work PO created successfully!',
          'success'
        );
      }
      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      console.error('Failed to generate final PO:', err);
      const msg = err?.response?.data?.detail || err?.message || 'Failed to generate Final Job Work PO.';
      if (showToast) showToast(msg, 'error');
      else alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 overflow-y-auto backdrop-blur-xs transition-all duration-150 ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
      <div
        ref={resizeRef}
        style={
          isFullscreen
            ? { width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none' }
            : {
                width: modalWidth ? `${modalWidth}px` : undefined,
                height: modalHeight ? `${modalHeight}px` : undefined,
              }
        }
        className={`relative flex flex-col bg-white shadow-2xl border border-slate-200 overflow-hidden transition-all duration-150 ${
          isFullscreen
            ? 'w-full h-full rounded-none'
            : `${modalWidth ? '' : 'w-full max-w-6xl'} ${modalHeight ? '' : 'max-h-[94vh]'} rounded-2xl my-auto`
        } animate-in fade-in zoom-in-95 duration-150`}
      >
        
        {/* Header */}
        <div
          onDoubleClick={() => setIsFullscreen((prev) => !prev)}
          className="flex items-center justify-between border-b border-slate-100 px-6 py-3.5 bg-white sticky top-0 z-10 select-none cursor-default"
          title="Double-click header to toggle maximize"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-[17px] font-extrabold text-[#17294e] tracking-tight">Generate Final Job Work PO</h2>
              <p className="text-[12px] font-medium text-slate-400">
                Create final Job Work Purchase Order based on completed production and verified quantity.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Maximize Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Close"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          
          {loading && (
            <div className="flex items-center justify-center py-6 gap-2 text-[13px] font-semibold text-blue-600 bg-blue-50/60 rounded-xl border border-blue-100">
              <Loader2 size={18} className="animate-spin" /> Loading production and verification details...
            </div>
          )}

          {/* Top 3 Columns: 1. Reference, 2. Vendor/Fabric, 3. Production Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* PO & Production Reference */}
            <div className="lg:col-span-4 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.04)] space-y-3.5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <FileText size={16} className="text-blue-600" />
                <h3 className="text-[13px] font-bold text-[#17294e]">PO & Production Reference</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Final PO No.</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={finalPoNo}
                      onChange={(e) => setFinalPoNo(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-[12px] font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white pr-12"
                    />
                    <span className="absolute right-1.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                      Auto
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">PO Date <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Production Instruction No.</label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedPiId}
                    onChange={(e) => setSelectedPiId(e.target.value)}
                    className="flex-1 min-w-0 truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 outline-none focus:border-blue-500"
                  >
                    {instructions.map((pi) => (
                      <option key={pi.id} value={pi.id}>
                        {pi.instructionNumber || pi.instruction_number} - {pi.agencyName || pi.agency_name || 'Vendor'} ({pi.status})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedPiId) window.open(`/pms/production-completion?pi=${selectedPiId}`, '_blank');
                    }}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-[11px] font-bold text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    View PI
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Project</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={projectCode || '—'}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-600 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => window.open('/pms/projects', '_blank')}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-[11px] font-bold text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Process Type</label>
                  <input
                    type="text"
                    value={processType}
                    onChange={(e) => setProcessType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Grey Lot No.</label>
                  <input
                    type="text"
                    value={greyLotNo}
                    onChange={(e) => setGreyLotNo(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Vendor & Fabric Details */}
            <div className="lg:col-span-4 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.04)] space-y-3.5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Users size={16} className="text-blue-600" />
                <h3 className="text-[13px] font-bold text-[#17294e]">Vendor & Fabric Details</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600">Agency / Vendor <span className="text-rose-500">*</span></label>
                    <MasterSourceLink source="vendors" />
                  </div>
                  <select
                    required
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="">Select Vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.code ? `(${v.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600">Assigned Employee</label>
                    <MasterSourceLink source="employees" />
                  </div>
                  <select
                    value={assignedEmployeeId}
                    onChange={(e) => setAssignedEmployeeId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="">Select Employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.employee_code ? `(${emp.employee_code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Fabric / Quality</label>
                  <input
                    type="text"
                    value={fabric}
                    onChange={(e) => setFabric(e.target.value)}
                    placeholder="e.g. Chiffon Grey Fabric"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">UOM</label>
                  <select
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="Meter">Meter</option>
                    <option value="Kg">Kg</option>
                    <option value="Yard">Yard</option>
                    <option value="Pcs">Pcs</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Agreed Job Rate (₹/m) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={agreedJobRate}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setAgreedJobRate(val);
                      if (items.length > 0) handleItemChange(0, 'rate', val);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">GST % <span className="text-rose-500">*</span></label>
                  <select
                    value={gstPct}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setGstPct(val);
                      if (items.length > 0) handleItemChange(0, 'gstPct', val);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-bold text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Production Summary (Auto from Daily Production) */}
            <div className="lg:col-span-4 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.04)] space-y-3.5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <BarChart3 size={16} className="text-blue-600" />
                <h3 className="text-[13px] font-bold text-[#17294e]">Production Summary (Auto from Daily Production)</h3>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Order Quantity */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-2.5 flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white shrink-0">
                    <Package size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500">Order Quantity</p>
                    <p className="text-[13px] font-extrabold text-[#17294e]">{fmtM(orderQty)}</p>
                  </div>
                </div>

                {/* Total Produced */}
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5 flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-white shrink-0">
                    <Boxes size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500">Total Produced</p>
                    <p className="text-[13px] font-extrabold text-emerald-700">{fmtM(totalProduced)}</p>
                  </div>
                </div>

                {/* Rejected Quantity */}
                <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-2.5 flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-rose-600 text-white shrink-0">
                    <XCircle size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500">Rejected Quantity</p>
                    <p className="text-[13px] font-extrabold text-rose-600">{fmtM(rejectedQty)}</p>
                  </div>
                </div>

                {/* Accepted Quantity */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-2.5 flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-white shrink-0">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500">Accepted Quantity</p>
                    <p className="text-[13px] font-extrabold text-blue-700">{fmtM(acceptedQty)}</p>
                  </div>
                </div>

                {/* Shortage / Difference */}
                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5 flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500 text-white shrink-0">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-500">Shortage / Difference</p>
                    <p className={`text-[13px] font-extrabold ${shortageQty < 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                      {fmtM(shortageQty)}
                    </p>
                  </div>
                </div>

                {/* Billable Quantity (For PO) */}
                <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-2.5 flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-purple-600 text-white shrink-0">
                    <PackageCheck size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-purple-700">
                      Billable Quantity (For PO) <Info size={11} className="text-purple-400" />
                    </p>
                    <p className="text-[13px] font-extrabold text-purple-800">{fmtM(totalBillableQty)}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Verified Production Details Table */}
          <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.04)] overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 bg-white">
              <PackageCheck size={16} className="text-blue-600" />
              <h3 className="text-[13px] font-bold text-[#17294e]">Verified Production Details</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-[12px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500">
                    <th className="px-4 py-2 font-bold whitespace-nowrap">Sr. No.</th>
                    <th className="px-4 py-2 font-bold whitespace-nowrap">Date</th>
                    <th className="px-4 py-2 font-bold whitespace-nowrap">Produced Qty (M)</th>
                    <th className="px-4 py-2 font-bold whitespace-nowrap">Rejected Qty (M)</th>
                    <th className="px-4 py-2 font-bold whitespace-nowrap">Accepted Qty (M)</th>
                    <th className="px-4 py-2 font-bold whitespace-nowrap">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyEntries.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-50 text-slate-700 hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-400 font-semibold">{idx + 1}</td>
                      <td className="px-4 py-2">{fmtDateDisplay(row.date)}</td>
                      <td className="px-4 py-2 font-semibold">{Number(row.produced || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 text-rose-600 font-semibold">{Number(row.rejected || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 text-blue-600 font-semibold">
                        {(Number(row.accepted) || (Number(row.produced) - (Number(row.rejected) || 0))).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{row.remarks || '—'}</td>
                    </tr>
                  ))}
                  {dailyEntries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-slate-400">
                        No individual daily production entries recorded yet.
                      </td>
                    </tr>
                  )}
                  {/* Total row */}
                  <tr className="bg-slate-50/80 font-extrabold text-[#17294e]">
                    <td className="px-4 py-2.5 text-center">Total</td>
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5 text-center">{verifiedProducedSum.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-center text-rose-600">{verifiedRejectedSum.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-center text-blue-700">{verifiedAcceptedSum.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-center text-slate-400">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Final PO Item Details */}
          <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.04)] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-white">
              <div className="flex items-center gap-2">
                <Boxes size={16} className="text-blue-600" />
                <h3 className="text-[13px] font-bold text-[#17294e]">Final PO Item Details</h3>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <Plus size={13} /> Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500">
                    <th className="px-3 py-2 font-bold whitespace-nowrap">Sr. No.</th>
                    <th className="px-3 py-2 font-bold min-w-[280px]">Description</th>
                    <th className="px-3 py-2 font-bold whitespace-nowrap">UOM</th>
                    <th className="px-3 py-2 font-bold whitespace-nowrap">Billable Qty (M)</th>
                    <th className="px-3 py-2 font-bold whitespace-nowrap">Rate (₹/M)</th>
                    <th className="px-3 py-2 font-bold whitespace-nowrap text-right">Basic Amount (₹)</th>
                    <th className="px-3 py-2 font-bold whitespace-nowrap">GST %</th>
                    <th className="px-3 py-2 font-bold whitespace-nowrap text-right">GST Amount (₹)</th>
                    <th className="px-3 py-2 font-bold whitespace-nowrap text-right">Total Amount (₹)</th>
                    <th className="px-2 py-2 text-center" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr key={row.id || idx} className="border-b border-slate-50 text-slate-700">
                      <td className="px-3 py-2.5 text-center text-slate-400 font-semibold">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <textarea
                          rows={3}
                          value={row.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full rounded border border-slate-200 p-1.5 text-[11.5px] text-slate-700 outline-none focus:border-blue-500 resize-none font-medium"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={row.uom}
                          onChange={(e) => handleItemChange(idx, 'uom', e.target.value)}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11.5px] outline-none"
                        >
                          <option value="Meter">Meter</option>
                          <option value="Kg">Kg</option>
                          <option value="Yard">Yard</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          step="any"
                          value={row.billableQty}
                          onChange={(e) => handleItemChange(idx, 'billableQty', e.target.value)}
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-[12px] font-bold text-slate-800 outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          step="0.01"
                          value={row.rate}
                          onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                          className="w-20 rounded border border-slate-200 px-2 py-1 text-[12px] font-bold text-slate-800 outline-none focus:border-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                        {fmtINR(row.basicAmount).replace('₹ ', '')}
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={row.gstPct}
                          onChange={(e) => handleItemChange(idx, 'gstPct', e.target.value)}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11.5px] font-semibold outline-none"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-700">
                        {fmtINR(row.gstAmount).replace('₹ ', '')}
                      </td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-blue-700">
                        {fmtINR(row.totalAmount).replace('₹ ', '')}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(idx)}
                          className="text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Grid: Remarks & Attachments, Amount Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Remarks & Attachments */}
            <div className="lg:col-span-8 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.04)] space-y-3.5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <FileText size={16} className="text-blue-600" />
                <h3 className="text-[13px] font-bold text-[#17294e]">Remarks & Attachments</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Remarks</label>
                  <textarea
                    rows={4}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter any additional terms, inspection notes or instructions..."
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-[12px] text-slate-700 outline-none focus:border-blue-500 resize-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Attachments (Optional)</label>
                  <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-3 hover:bg-blue-50/60 cursor-pointer transition-colors">
                    <UploadCloud size={24} className="text-blue-500 mb-1" />
                    <p className="text-[11.5px] font-bold text-blue-700">Drag & drop files here or <span className="underline">Browse Files</span></p>
                    <p className="text-[10px] text-slate-400">PDF, DOC, PNG up to 10MB</p>
                    <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                  </label>

                  {/* Attachment items */}
                  <div className="mt-2.5 space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[11px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="grid h-6 w-6 place-items-center rounded bg-rose-50 text-rose-600 border border-rose-200 text-[9px] font-extrabold shrink-0">
                            PDF
                          </span>
                          <span className="truncate font-semibold text-slate-700">{file.name}</span>
                          <span className="text-slate-400 shrink-0 text-[10px]">{file.size}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <button type="button" className="text-slate-400 hover:text-blue-600" title="Download">
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(idx)}
                            className="text-slate-400 hover:text-rose-600"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Amount Summary */}
            <div className="lg:col-span-4 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.04)] space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
                  <Calculator size={16} className="text-blue-600" />
                  <h3 className="text-[13px] font-bold text-[#17294e]">Amount Summary</h3>
                </div>

                <div className="space-y-2 text-[12px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Billable Quantity</span>
                    <span className="font-bold text-[#17294e]">{fmtM(totalBillableQty)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Basic Amount</span>
                    <span className="font-bold text-[#17294e]">{fmtINR(totalBasicAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST Amount ({gstPct}%)</span>
                    <span className="font-bold text-[#17294e]">{fmtINR(totalGstAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                    <span>Other Charges</span>
                    <input
                      type="number"
                      step="0.01"
                      value={otherCharges}
                      onChange={(e) => setOtherCharges(e.target.value)}
                      className="w-24 rounded border border-slate-200 px-2 py-0.5 text-[12px] text-right font-semibold outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Highlighted Total Box */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 flex items-center justify-between mt-3">
                <span className="text-[12.5px] font-extrabold text-emerald-900">Total PO Amount</span>
                <span className="text-[16px] font-extrabold text-emerald-700">{fmtINR(finalTotalAmount)}</span>
              </div>
            </div>

          </div>

          {/* Footer Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[12px] font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={sendToApproval}
                  onChange={(e) => setSendToApproval(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                Send to Approval
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[12.5px] font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Generating Final PO...
                  </>
                ) : (
                  <>
                    <FileText size={16} /> Generate Final PO
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

        {/* Corner Resize Grip */}
        {!isFullscreen && (
          <div
            onMouseDown={startResizing}
            className="absolute bottom-1 right-1 w-5 h-5 cursor-se-resize flex items-center justify-center text-slate-400 hover:text-blue-600 select-none z-20 group"
            title="Drag to resize dialog"
          >
            <div className="flex flex-col items-end gap-0.5 p-0.5 pointer-events-none">
              <div className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-blue-500" />
              </div>
              <div className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-blue-500" />
                <span className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-blue-500" />
              </div>
              <div className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-blue-500" />
                <span className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-blue-500" />
                <span className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-blue-500" />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
