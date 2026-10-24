import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  RotateCcw, ShieldAlert, ArrowUpRight, Plus, CheckCircle2,
  AlertCircle, Package, Receipt, FileText, ChevronDown, ChevronUp,
  Search, Filter, ShieldCheck, Truck, Factory, Clock, RefreshCw,
  Boxes, Layers, X, Eye, Check, AlertTriangle, UserCheck
} from 'lucide-react';
import { formatCurrency } from '../../../../utils/currencyUtils';
import {
  fetchCustomerReturnsWorkspace,
  createCustomerReturnRequest,
  receiveCustomerReturnPhysical,
  submitCustomerReturnQC,
  routeCustomerReturnStock,
  issueCustomerReturnCreditNote,
} from '../../../../services/jobWorkSync';

const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const CONDITION_COLORS = {
  Good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Hold: 'bg-amber-50 text-amber-800 border-amber-200',
  Reprocess: 'bg-violet-50 text-violet-700 border-violet-200',
  'Second Quality': 'bg-orange-50 text-orange-700 border-orange-200',
  Reject: 'bg-rose-50 text-rose-700 border-rose-200',
};

function ConditionBadge({ condition }) {
  const cls = CONDITION_COLORS[condition] || 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
      {condition || 'Hold'}
    </span>
  );
}

function StatusBadge({ status, stage }) {
  if (status === 'Posted' || stage === 'ROUTED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 size={10} /> Routed / Closed
      </span>
    );
  }
  if (stage === 'QC_INSPECTED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
        <ShieldCheck size={10} /> QC Inspected
      </span>
    );
  }
  if (stage === 'RECEIVED_QC_PENDING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
        <Clock size={10} /> In QC Hold
      </span>
    );
  }
  if (status === 'Cancelled') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertCircle size={10} /> Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
      ● Pending Receipt
    </span>
  );
}

function StatCard({ label, value, sub, tone = 'slate', icon: Icon }) {
  const tones = {
    slate: 'text-slate-800 bg-slate-50 border-slate-100',
    blue: 'text-blue-600 bg-blue-50/60 border-blue-100',
    emerald: 'text-emerald-700 bg-emerald-50/60 border-emerald-100',
    amber: 'text-amber-700 bg-amber-50/60 border-amber-100',
    purple: 'text-purple-700 bg-purple-50/60 border-purple-100',
    rose: 'text-rose-700 bg-rose-50/60 border-rose-100',
  };
  return (
    <div className={`p-3 rounded-xl border ${tones[tone] || tones.slate} bg-white shadow-2xs`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">{label}</span>
        {Icon && (
          <div className="w-5 h-5 rounded-md bg-white/80 flex items-center justify-center text-slate-500 shadow-2xs">
            <Icon size={11} />
          </div>
        )}
      </div>
      <div className={`text-base font-black mt-1 ${tones[tone]?.split(' ')[0]}`}>{value ?? '—'}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export function CustomerReturnTab({ project }) {
  const projectId = project?.id;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReasonFilter, setSelectedReasonFilter] = useState('ALL');
  const [selectedStageFilter, setSelectedStageFilter] = useState('ALL');

  // Expanded row for detailed breakdown
  const [expandedId, setExpandedId] = useState(null);

  // Modals state
  const [modalMode, setModalMode] = useState(null); // 'create' | 'receive' | 'qc' | 'route' | 'view'
  const [activeReturn, setActiveReturn] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states for modals
  const [createForm, setCreateForm] = useState({
    invoiceId: '',
    returnReason: 'Fabric Damaged / Defective',
    customerRemarks: '',
    docDate: new Date().toISOString().split('T')[0],
    lines: [],
  });

  const [receiveForm, setReceiveForm] = useState({
    receiptDate: new Date().toISOString().split('T')[0],
    warehouseId: '',
    receivingEmployee: '',
    conditionOnArrival: 'Packaging Intact — Held for QC',
    lines: [],
  });

  const [qcForm, setQcForm] = useState({
    inspectionDate: new Date().toISOString().split('T')[0],
    inspectionMethod: 'ASTM 4-Point Inspection (D5430)',
    inspectorName: '',
    shift: 'General Shift',
    notes: '',
    lines: [],
  });

  const [routeForm, setRouteForm] = useState({
    destination: 'Customer Usable Stock',
    remarks: '',
    issueCreditNote: false,
    creditDate: new Date().toISOString().split('T')[0],
    approvalNotes: '',
  });

  // Load workspace data
  const loadWorkspace = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCustomerReturnsWorkspace(projectId);
      const payload = res?.data || res;
      setData(payload);
    } catch (err) {
      console.warn('Failed to load customer returns workspace:', err);
      setError(err?.message || 'Could not load customer return records.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Fallback summary stats
  const summary = data?.summary || {
    totalReturnRequests: project.customerReturns?.length || 0,
    pendingReturnReceipts: 0,
    qcPendingQty: 0,
    qcAcceptedQty: 0,
    reprocessingQty: 0,
    qcHoldQty: 0,
    rejectedQty: 0,
    creditNotesIssued: (project.customerReturns || []).reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0),
    creditNotesCount: (project.customerReturns || []).filter((r) => r.creditNoteNumber || r.status === 'Posted').length,
    uom: 'Meters',
  };

  const returnsList = data?.returns || project.customerReturns || [];
  const availableInvoices = data?.availableInvoices || [];
  const returnReasons = data?.returnReasons || [
    'Colour / Shade Not Approved',
    'Fabric Damaged / Defective',
    'Customer No Longer Requires Fabric',
    'Dimensional Shrinkage / Width Mismatch',
    'Late Delivery / Order Cancelled',
  ];
  const defectMaster = data?.defectMaster || [];
  const locations = data?.locations || [];

  // Filter returns
  const filteredReturns = useMemo(() => {
    return returnsList.filter((r) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        (r.returnNumber && r.returnNumber.toLowerCase().includes(term)) ||
        (r.customerName && r.customerName.toLowerCase().includes(term)) ||
        (r.salesInvoiceNumber && r.salesInvoiceNumber.toLowerCase().includes(term)) ||
        (r.deliveryChallanNumber && r.deliveryChallanNumber.toLowerCase().includes(term)) ||
        (r.reason && r.reason.toLowerCase().includes(term));

      const matchesReason =
        selectedReasonFilter === 'ALL' || r.reason === selectedReasonFilter;

      const matchesStage =
        selectedStageFilter === 'ALL' ||
        (selectedStageFilter === 'REQUESTED' && r.returnStage === 'REQUESTED') ||
        (selectedStageFilter === 'QC_PENDING' && r.returnStage === 'RECEIVED_QC_PENDING') ||
        (selectedStageFilter === 'QC_INSPECTED' && r.returnStage === 'QC_INSPECTED') ||
        (selectedStageFilter === 'ROUTED' && (r.returnStage === 'ROUTED' || r.status === 'Posted'));

      return matchesSearch && matchesReason && matchesStage;
    });
  }, [returnsList, searchTerm, selectedReasonFilter, selectedStageFilter]);

  // Handlers to open modals
  const handleOpenCreateModal = () => {
    const firstInv = availableInvoices[0];
    const initialLines = firstInv
      ? firstInv.lines.map((l) => ({
          invoiceLineId: l.id,
          itemName: l.itemName,
          sku: l.sku,
          uom: l.uom,
          invoicedQty: l.invoicedQty,
          returnableQty: l.returnableQty,
          requestedQty: l.returnableQty > 0 ? l.returnableQty : 0,
        }))
      : [];

    setCreateForm({
      invoiceId: firstInv?.id || '',
      returnReason: 'Fabric Damaged / Defective',
      customerRemarks: '',
      docDate: new Date().toISOString().split('T')[0],
      lines: initialLines,
    });
    setModalMode('create');
  };

  const handleInvoiceChangeInCreate = (invId) => {
    const inv = availableInvoices.find((i) => i.id === invId);
    const newLines = inv
      ? inv.lines.map((l) => ({
          invoiceLineId: l.id,
          itemName: l.itemName,
          sku: l.sku,
          uom: l.uom,
          invoicedQty: l.invoicedQty,
          returnableQty: l.returnableQty,
          requestedQty: l.returnableQty > 0 ? l.returnableQty : 0,
        }))
      : [];
    setCreateForm((prev) => ({
      ...prev,
      invoiceId: invId,
      lines: newLines,
    }));
  };

  const handleOpenReceiveModal = (ret) => {
    setActiveReturn(ret);
    const recLines = (ret.lines || []).map((l) => ({
      lineId: l.id,
      itemName: l.itemName,
      returnedQty: l.returnedQty,
      actualMeter: l.returnedQty,
    }));
    setReceiveForm({
      receiptDate: new Date().toISOString().split('T')[0],
      warehouseId: locations[0]?.id || '',
      receivingEmployee: '',
      conditionOnArrival: 'Packaging Intact — Quarantined for QC',
      lines: recLines,
    });
    setModalMode('receive');
  };

  const handleOpenQcModal = (ret) => {
    setActiveReturn(ret);
    const qcLines = (ret.lines || []).map((l, idx) => ({
      lineId: l.id,
      takaNumber: l.lotTaka || `Roll-${idx + 1}`,
      lotNumber: l.lotNo || 'LOT-RET',
      actualMeter: l.returnedQty,
      disposition: 'Pass',
      grade: 'A',
      defects: [],
      remarks: '',
    }));
    setQcForm({
      inspectionDate: new Date().toISOString().split('T')[0],
      inspectionMethod: 'ASTM 4-Point Inspection (D5430)',
      inspectorName: '',
      shift: 'General Shift',
      notes: '',
      lines: qcLines,
    });
    setModalMode('qc');
  };

  const handleOpenRouteModal = (ret) => {
    setActiveReturn(ret);
    setRouteForm({
      destination: 'Customer Usable Stock',
      remarks: '',
      issueCreditNote: false,
      creditDate: new Date().toISOString().split('T')[0],
      approvalNotes: '',
    });
    setModalMode('route');
  };

  const handleOpenViewModal = (ret) => {
    setActiveReturn(ret);
    setModalMode('view');
  };

  // Submit actions
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        invoiceId: createForm.invoiceId,
        returnReason: createForm.returnReason,
        customerRemarks: createForm.customerRemarks,
        docDate: createForm.docDate,
        lines: createForm.lines
          .filter((l) => Number(l.requestedQty) > 0)
          .map((l) => ({
            invoiceLineId: l.invoiceLineId,
            requestedQty: Number(l.requestedQty),
          })),
      };
      await createCustomerReturnRequest(projectId, payload);
      setSuccessMsg('Return request created successfully.');
      setModalMode(null);
      await loadWorkspace();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create return request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceiveSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        returnId: activeReturn.id,
        receiptDate: receiveForm.receiptDate,
        warehouseId: receiveForm.warehouseId,
        receivingEmployee: receiveForm.receivingEmployee,
        conditionOnArrival: receiveForm.conditionOnArrival,
        lines: receiveForm.lines.map((l) => ({
          lineId: l.lineId,
          receivedQty: Number(l.actualMeter),
        })),
      };
      await receiveCustomerReturnPhysical(projectId, payload);
      setSuccessMsg('Physical return received and quarantined in QC Hold.');
      setModalMode(null);
      await loadWorkspace();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to record physical receipt.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQcSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        returnId: activeReturn.id,
        inspectionDate: qcForm.inspectionDate,
        inspectionMethod: qcForm.inspectionMethod,
        inspectorName: qcForm.inspectorName,
        shift: qcForm.shift,
        notes: qcForm.notes,
        lines: qcForm.lines.map((l) => ({
          lineId: l.lineId,
          takaNumber: l.takaNumber,
          lotNumber: l.lotNumber,
          actualMeter: Number(l.actualMeter),
          disposition: l.disposition,
          grade: l.grade,
          remarks: l.remarks,
          defects: l.defects || [],
        })),
      };
      await submitCustomerReturnQC(projectId, payload);
      setSuccessMsg('QC inspection recorded successfully.');
      setModalMode(null);
      await loadWorkspace();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to record QC inspection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRouteSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await routeCustomerReturnStock(projectId, {
        returnId: activeReturn.id,
        destination: routeForm.destination,
        remarks: routeForm.remarks,
      });

      if (routeForm.issueCreditNote) {
        await issueCustomerReturnCreditNote(projectId, {
          returnId: activeReturn.id,
          creditDate: routeForm.creditDate,
          approvalNotes: routeForm.approvalNotes,
        });
      }

      setSuccessMsg('Stock routed and credit note processed successfully.');
      setModalMode(null);
      await loadWorkspace();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to route stock or issue credit note.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <RotateCcw className="text-rose-600" size={18} />
            <span>Customer Returns, QC & Stock Routing</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            5-phase traceable workflow: Return Request → Physical Inward → Piece QC → Stock Disposition → Credit Notes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadWorkspace}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-2xs cursor-pointer transition-colors"
          >
            <Plus size={13} />
            <span>Create Return Request</span>
          </button>

          <Link
            to="/sales/returns"
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-2xs"
            title="Open main sales return register"
          >
            <span>Sales Returns Register</span>
            <ArrowUpRight size={12} className="text-slate-400" />
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700 font-bold">×</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-700 font-bold">×</button>
        </div>
      )}

      {/* 2. Top Summary KPI Cards (8 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard
          label="1. Total Requests"
          value={summary.totalReturnRequests}
          sub="Return authorizations"
          tone="slate"
          icon={RotateCcw}
        />
        <StatCard
          label="2. Pending Inward"
          value={`${n(summary.pendingReturnReceipts)} m`}
          sub="Awaiting warehouse receipt"
          tone="blue"
          icon={Truck}
        />
        <StatCard
          label="3. QC Pending"
          value={`${n(summary.qcPendingQty)} m`}
          sub="Quarantined in QC Hold"
          tone="amber"
          icon={Clock}
        />
        <StatCard
          label="4. QC Accepted"
          value={`${n(summary.qcAcceptedQty)} m`}
          sub="Usable stock passed"
          tone="emerald"
          icon={ShieldCheck}
        />
        <StatCard
          label="5. Reprocessing"
          value={`${n(summary.reprocessingQty)} m`}
          sub="Rework & mill re-dyeing"
          tone="purple"
          icon={Factory}
        />
        <StatCard
          label="6. QC Hold"
          value={`${n(summary.qcHoldQty)} m`}
          sub="Under evaluation"
          tone="amber"
          icon={AlertTriangle}
        />
        <StatCard
          label="7. Rejected"
          value={`${n(summary.rejectedQty)} m`}
          sub="Damaged scrap stock"
          tone="rose"
          icon={AlertCircle}
        />
        <StatCard
          label="8. Credit Notes"
          value={formatCurrency(summary.creditNotesIssued)}
          sub={`${summary.creditNotesCount} posted credit note${summary.creditNotesCount !== 1 ? 's' : ''}`}
          tone="emerald"
          icon={Receipt}
        />
      </div>

      {/* Strict Accounting & Physical Separation Banner */}
      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-900">
        <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Strict ERP Inventory & Accounting Traceability Rules</span>
          <span className="block text-blue-800 text-[11px] mt-0.5">
            1. Return requests do NOT increase physical inventory until warehouse inward receipt is confirmed.
            2. Inward fabric is quarantined in <strong>SYS-QC-HOLD</strong> and completely excluded from saleable stock.
            3. Stock can only route to usable inventory after QC approval. Credit notes are decoupled from physical receipt.
          </span>
        </div>
      </div>

      {/* 3. Search and Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white border border-[#dce5f4] rounded-xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search return #, customer, invoice, challan..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-rose-400 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <Filter size={12} />
            <span>Reason:</span>
          </div>
          <select
            value={selectedReasonFilter}
            onChange={(e) => setSelectedReasonFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 outline-none"
          >
            <option value="ALL">All Return Reasons</option>
            {returnReasons.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={selectedStageFilter}
            onChange={(e) => setSelectedStageFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 outline-none"
          >
            <option value="ALL">All Stages</option>
            <option value="REQUESTED">Pending Inward</option>
            <option value="QC_PENDING">In QC Hold</option>
            <option value="QC_INSPECTED">QC Inspected</option>
            <option value="ROUTED">Routed / Closed</option>
          </select>
        </div>
      </div>

      {/* 4. Customer Return Register Table */}
      {filteredReturns.length === 0 ? (
        <div className="rounded-xl border border-[#dce5f4] bg-white p-10 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <RotateCcw size={22} />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Customer Returns Recorded</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            {searchTerm || selectedReasonFilter !== 'ALL' || selectedStageFilter !== 'ALL'
              ? 'No returns match the selected filter criteria.'
              : 'There are no customer returns or credit notes logged against this project. All dispatched fabric remains accepted.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-2xs cursor-pointer"
          >
            <Plus size={13} />
            <span>Record New Customer Return</span>
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">Return # / Date</th>
                  <th className="py-2.5 px-3">Customer & Order</th>
                  <th className="py-2.5 px-3">Invoice & DC</th>
                  <th className="py-2.5 px-3 text-right">Delivered</th>
                  <th className="py-2.5 px-3 text-right">Requested</th>
                  <th className="py-2.5 px-3 text-right">Received</th>
                  <th className="py-2.5 px-3">Return Reason</th>
                  <th className="py-2.5 px-3">QC Status</th>
                  <th className="py-2.5 px-3">Destination</th>
                  <th className="py-2.5 px-3">Credit Note</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((ret) => {
                  const isExpanded = expandedId === ret.id;
                  const lines = ret.lines || [];
                  const isRequested = ret.returnStage === 'REQUESTED' || !ret.returnStage;
                  const isQcPending = ret.returnStage === 'RECEIVED_QC_PENDING';
                  const isQcInspected = ret.returnStage === 'QC_INSPECTED';
                  const isRouted = ret.returnStage === 'ROUTED' || ret.status === 'Posted';

                  return (
                    <React.Fragment key={ret.id}>
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <RotateCcw size={13} className="text-rose-600 shrink-0" />
                            <span className="font-mono font-bold text-rose-700">{ret.returnNumber}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 pl-5">
                            {ret.docDate ? new Date(ret.docDate).toLocaleDateString('en-GB') : '—'}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block truncate max-w-[150px]">{ret.customerName}</span>
                          <span className="text-[10.5px] font-mono text-blue-600 block">{ret.salesOrderNumber}</span>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-700">
                            <Receipt size={10} className="text-slate-400" />
                            <span>{ret.salesInvoiceNumber}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                            <Truck size={10} className="text-slate-400" />
                            <span>{ret.deliveryChallanNumber}</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                          {n(ret.deliveredQty)} m
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-700 whitespace-nowrap">
                          {n(ret.requestedQty)} m
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {n(ret.receivedQty)} m
                        </td>

                        <td className="py-2.5 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 truncate max-w-[150px]" title={ret.reason}>
                            {ret.reason}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <StatusBadge status={ret.status} stage={ret.returnStage} />
                        </td>

                        <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                          <span className="text-[11px] font-semibold block">{ret.stockDestination || 'Pending Receipt'}</span>
                          <span className="text-[10px] text-slate-400">{ret.locationName}</span>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {ret.creditNoteNumber ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {ret.creditNoteNumber}
                              </span>
                              <div className="text-[10px] font-mono font-bold text-emerald-800">
                                {formatCurrency(ret.creditNoteAmount)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10.5px] text-slate-400 font-semibold">Not Issued</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Phase 2: Inward Receipt */}
                            {isRequested && (
                              <button
                                onClick={() => handleOpenReceiveModal(ret)}
                                className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10.5px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1"
                                title="Record physical arrival at warehouse into SYS-QC-HOLD"
                              >
                                <Truck size={10} /> Receive
                              </button>
                            )}

                            {/* Phase 3: QC Inspection */}
                            {isQcPending && (
                              <button
                                onClick={() => handleOpenQcModal(ret)}
                                className="px-2 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 text-[10.5px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1"
                                title="Conduct piece-by-piece QC inspection"
                              >
                                <ShieldCheck size={10} /> Inspect QC
                              </button>
                            )}

                            {/* Phase 4: Stock Disposition */}
                            {isQcInspected && (
                              <button
                                onClick={() => handleOpenRouteModal(ret)}
                                className="px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-[10.5px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1"
                                title="Route to usable inventory, reprocessing, or scrap"
                              >
                                <Layers size={10} /> Route Stock
                              </button>
                            )}

                            {/* Phase 5: Post Credit Note */}
                            {isRouted && !ret.creditNoteNumber && (
                              <button
                                onClick={() => handleOpenRouteModal(ret)}
                                className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-[10.5px] font-bold cursor-pointer transition-colors inline-flex items-center gap-1"
                                title="Post financial credit note to ledger"
                              >
                                <Receipt size={10} /> Issue Credit
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenViewModal(ret)}
                              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="View end-to-end return details"
                            >
                              <Eye size={13} />
                            </button>

                            <button
                              onClick={() => setExpandedId(isExpanded ? null : ret.id)}
                              className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                              title="Toggle line items"
                            >
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-table */}
                      {isExpanded && lines.length > 0 && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={11} className="p-3.5 border-t border-slate-100">
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-between">
                                <span>Returned Line Items & Taka Traceability</span>
                                <span className="text-slate-400 font-normal">Condition decides system stock routing</span>
                              </div>
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 bg-white">
                                    <th className="py-2 px-3">#</th>
                                    <th className="py-2 px-3">Fabric Item</th>
                                    <th className="py-2 px-3">Taka / Lot</th>
                                    <th className="py-2 px-3 text-right">Quantity</th>
                                    <th className="py-2 px-3">Condition</th>
                                    <th className="py-2 px-3 text-right">Rate</th>
                                    <th className="py-2 px-3 text-right">Line Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {lines.map((ln, idx) => (
                                    <tr key={ln.id || idx} className="hover:bg-slate-50/50">
                                      <td className="py-2 px-3 text-slate-500">{ln.lineNo || idx + 1}</td>
                                      <td className="py-2 px-3 font-semibold text-slate-800">{ln.itemName}</td>
                                      <td className="py-2 px-3 font-mono text-slate-700">
                                        {ln.lotTaka ? `Taka: ${ln.lotTaka}` : '—'}
                                        {ln.lotNo ? ` (${ln.lotNo})` : ''}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                        {n(ln.returnedQty)} {ln.uom || 'm'}
                                      </td>
                                      <td className="py-2 px-3">
                                        <ConditionBadge condition={ln.condition} />
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono text-slate-600">
                                        {formatCurrency(ln.rate)}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                        {formatCurrency(ln.lineTotal)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: CREATE RETURN REQUEST (Phase 1)                       */}
      {/* ============================================================== */}
      {modalMode === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-5 text-xs max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <RotateCcw className="text-rose-600" size={18} />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">1. Customer Return Request Authorization</h3>
                  <p className="text-[11px] text-slate-500">Initiate return against posted sales invoice. No inventory is added until physical receipt.</p>
                </div>
              </div>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Sales Invoice *</label>
                  <select
                    value={createForm.invoiceId}
                    onChange={(e) => handleInvoiceChangeInCreate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
                    required
                  >
                    <option value="">Select Invoice...</option>
                    {availableInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} (DC: {inv.challanNumber}) — {formatCurrency(inv.total)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Return Reason *</label>
                  <select
                    value={createForm.returnReason}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, returnReason: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
                    required
                  >
                    {returnReasons.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Request Date *</label>
                  <input
                    type="date"
                    value={createForm.docDate}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, docDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Remarks / Defect Description</label>
                <textarea
                  rows={2}
                  value={createForm.customerRemarks}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, customerRemarks: e.target.value }))}
                  placeholder="Describe reported shade mismatch, holes, tears, or reason for return..."
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                />
              </div>

              {/* Invoice Lines Table */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Select Quantities to Return</label>
                {createForm.lines.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    Select an invoice to load invoiced fabric lines.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10.5px] uppercase font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Fabric Item</th>
                          <th className="py-2 px-3 text-right">Invoiced Qty</th>
                          <th className="py-2 px-3 text-right">Returnable Bal</th>
                          <th className="py-2 px-3 text-center w-36">Requested Return Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {createForm.lines.map((l, idx) => (
                          <tr key={l.invoiceLineId} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-semibold text-slate-800">{l.itemName}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">{n(l.invoicedQty)} {l.uom}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">{n(l.returnableQty)} {l.uom}</td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max={l.returnableQty}
                                step="any"
                                value={l.requestedQty}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCreateForm((prev) => {
                                    const nextLines = [...prev.lines];
                                    nextLines[idx] = { ...nextLines[idx], requestedQty: val };
                                    return { ...prev, lines: nextLines };
                                  });
                                }}
                                className="w-28 p-1 border border-slate-300 rounded text-center font-bold font-mono focus:border-rose-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  {submitting ? 'Submitting...' : 'Authorize Return Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: RECEIVE PHYSICAL RETURN (Phase 2)                     */}
      {/* ============================================================== */}
      {modalMode === 'receive' && activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 text-xs max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Truck className="text-blue-600" size={18} />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">2. Physical Return Receipt & Quarantine Inward</h3>
                  <p className="text-[11px] text-slate-500">Record physical arrival at godown. Fabric enters SYS-QC-HOLD and is blocked from sale.</p>
                </div>
              </div>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleReceiveSubmit} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Mandatory Quarantine:</strong> Inward movements will deposit stock directly into <strong>SYS-QC-HOLD</strong>. This fabric cannot be sold or issued until QC approval.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Receipt Date *</label>
                  <input
                    type="date"
                    value={receiveForm.receiptDate}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, receiptDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Receiving Warehouse Location *</label>
                  <select
                    value={receiveForm.warehouseId}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, warehouseId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Receiving Employee / Store Incharge *</label>
                  <input
                    type="text"
                    value={receiveForm.receivingEmployee}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, receivingEmployee: e.target.value }))}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Condition on Arrival *</label>
                  <input
                    type="text"
                    value={receiveForm.conditionOnArrival}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, conditionOnArrival: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    required
                  />
                </div>
              </div>

              {/* Lines measurement */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-700 block">Confirm Actual Received Meters</label>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10.5px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Fabric Item</th>
                        <th className="py-2 px-3 text-right">Requested Qty</th>
                        <th className="py-2 px-3 text-center w-36">Actual Received Meters</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {receiveForm.lines.map((l, idx) => (
                        <tr key={l.lineId} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-semibold text-slate-800">{l.itemName}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">{n(l.returnedQty)} m</td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={l.actualMeter}
                              onChange={(e) => {
                                const val = e.target.value;
                                setReceiveForm((prev) => {
                                  const nL = [...prev.lines];
                                  nL[idx] = { ...nL[idx], actualMeter: val };
                                  return { ...prev, lines: nL };
                                });
                              }}
                              className="w-28 p-1 border border-slate-300 rounded text-center font-bold font-mono focus:border-blue-500"
                              required
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  {submitting ? 'Processing...' : 'Confirm Inward to QC Hold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: QC INSPECTION & DEFECT GRADING (Phase 3)              */}
      {/* ============================================================== */}
      {modalMode === 'qc' && activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-5 text-xs max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-amber-600" size={18} />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">3. Mandatory Piece-by-Piece QC Inspection</h3>
                  <p className="text-[11px] text-slate-500">Grade fabric quality, record defects against DefectMaster, and assign disposition.</p>
                </div>
              </div>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleQcSubmit} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inspection Date *</label>
                  <input
                    type="date"
                    value={qcForm.inspectionDate}
                    onChange={(e) => setQcForm((prev) => ({ ...prev, inspectionDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inspection Method *</label>
                  <input
                    type="text"
                    value={qcForm.inspectionMethod}
                    onChange={(e) => setQcForm((prev) => ({ ...prev, inspectionMethod: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">QC Inspector *</label>
                  <input
                    type="text"
                    value={qcForm.inspectorName}
                    onChange={(e) => setQcForm((prev) => ({ ...prev, inspectorName: e.target.value }))}
                    placeholder="e.g. Quality Analyst"
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Shift</label>
                  <input
                    type="text"
                    value={qcForm.shift}
                    onChange={(e) => setQcForm((prev) => ({ ...prev, shift: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>
              </div>

              {/* Piece Inspection Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 block">Roll / Taka Inspection & Defect Breakdown</label>
                  <span className="text-[11px] text-slate-500">Assign grade and disposition per piece</span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10.5px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Taka / Roll #</th>
                        <th className="py-2 px-3">Lot #</th>
                        <th className="py-2 px-3 text-right w-28">Actual Meters</th>
                        <th className="py-2 px-3 w-28">Grade</th>
                        <th className="py-2 px-3 w-36">Disposition</th>
                        <th className="py-2 px-3">Defects Logged</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {qcForm.lines.map((l, idx) => (
                        <tr key={l.lineId || idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">
                            <input
                              type="text"
                              value={l.takaNumber}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQcForm((prev) => {
                                  const nL = [...prev.lines];
                                  nL[idx] = { ...nL[idx], takaNumber: val };
                                  return { ...prev, lines: nL };
                                });
                              }}
                              className="w-24 p-1 border border-slate-300 rounded font-mono text-xs"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={l.lotNumber}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQcForm((prev) => {
                                  const nL = [...prev.lines];
                                  nL[idx] = { ...nL[idx], lotNumber: val };
                                  return { ...prev, lines: nL };
                                });
                              }}
                              className="w-24 p-1 border border-slate-300 rounded font-mono text-xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={l.actualMeter}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQcForm((prev) => {
                                  const nL = [...prev.lines];
                                  nL[idx] = { ...nL[idx], actualMeter: val };
                                  return { ...prev, lines: nL };
                                });
                              }}
                              className="w-24 p-1 border border-slate-300 rounded text-right font-bold font-mono focus:border-amber-500"
                              required
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={l.grade}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQcForm((prev) => {
                                  const nL = [...prev.lines];
                                  nL[idx] = { ...nL[idx], grade: val };
                                  return { ...prev, lines: nL };
                                });
                              }}
                              className="w-full p-1 border border-slate-300 rounded bg-white text-xs"
                            >
                              <option value="A">Grade A</option>
                              <option value="B">Grade B</option>
                              <option value="C">Grade C</option>
                              <option value="Second">Second Quality</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={l.disposition}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQcForm((prev) => {
                                  const nL = [...prev.lines];
                                  nL[idx] = { ...nL[idx], disposition: val };
                                  return { ...prev, lines: nL };
                                });
                              }}
                              className="w-full p-1 border border-slate-300 rounded bg-white text-xs font-semibold"
                            >
                              <option value="Pass">Pass (Usable)</option>
                              <option value="Reprocess">Reprocess</option>
                              <option value="Hold">QC Hold</option>
                              <option value="Second Quality">Second Quality</option>
                              <option value="Reject">Reject (Scrap)</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <select
                              onChange={(e) => {
                                const defId = e.target.value;
                                if (!defId) return;
                                const defObj = defectMaster.find((d) => d.id === defId);
                                if (!defObj) return;
                                setQcForm((prev) => {
                                  const nL = [...prev.lines];
                                  const currentDefects = nL[idx].defects || [];
                                  nL[idx] = {
                                    ...nL[idx],
                                    defects: [...currentDefects, { defectId: defId, name: defObj.name, count: 1 }],
                                  };
                                  return { ...prev, lines: nL };
                                });
                              }}
                              className="w-full p-1 border border-slate-200 rounded text-[11px] text-slate-600 bg-slate-50"
                            >
                              <option value="">+ Add Defect...</option>
                              {defectMaster.map((d) => (
                                <option key={d.id} value={d.id}>{d.name} ({d.category})</option>
                              ))}
                            </select>

                            {l.defects && l.defects.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {l.defects.map((df, dIdx) => (
                                  <span key={dIdx} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
                                    <span>{df.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQcForm((prev) => {
                                          const nL = [...prev.lines];
                                          nL[idx].defects = nL[idx].defects.filter((_, i) => i !== dIdx);
                                          return { ...prev, lines: nL };
                                        });
                                      }}
                                      className="text-rose-500 hover:text-rose-800 font-bold ml-0.5"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Inspection Observations & Notes</label>
                <textarea
                  rows={2}
                  value={qcForm.notes}
                  onChange={(e) => setQcForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notes on shade variation severity, tear location, or reprocess instructions..."
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  {submitting ? 'Submitting QC...' : 'Record QC Inspection Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: ROUTE STOCK & ISSUE CREDIT NOTE (Phases 4 & 5)        */}
      {/* ============================================================== */}
      {modalMode === 'route' && activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 text-xs max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Layers className="text-purple-600" size={18} />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">4 & 5. Authorized Stock Disposition & Credit Note</h3>
                  <p className="text-[11px] text-slate-500">Route inspected fabric from SYS-QC-HOLD and optionally post financial credit note.</p>
                </div>
              </div>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleRouteSubmit} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              {/* Destination Radio Cards */}
              <div>
                <label className="block font-semibold text-slate-800 mb-2">Select Target Stock Destination *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      id: 'Customer Usable Stock',
                      title: 'Customer Usable Stock',
                      desc: 'Keep allocated for customer redispatch under Customer Project',
                      icon: Package,
                    },
                    {
                      id: 'Own Project Buffer',
                      title: 'Own Project Buffer (Surplus)',
                      desc: 'Authorized transfer to Own Project stock buffer for future sales',
                      icon: Boxes,
                    },
                    {
                      id: 'Reprocess JWO',
                      title: 'Reprocess JWO (Rework)',
                      desc: 'Send outward to processor mill for re-dyeing or repair',
                      icon: Factory,
                    },
                    {
                      id: 'Reject / Scrap',
                      title: 'Reject / Scrap (Disposal)',
                      desc: 'Move to SYS-REJECT scrap inventory — not saleable',
                      icon: AlertCircle,
                    },
                  ].map((dst) => {
                    const isSelected = routeForm.destination === dst.id;
                    const Icon = dst.icon;
                    return (
                      <div
                        key={dst.id}
                        onClick={() => setRouteForm((prev) => ({ ...prev, destination: dst.id }))}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-purple-600 bg-purple-50/50 shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          <Icon size={14} className={isSelected ? 'text-purple-600' : 'text-slate-400'} />
                          <span>{dst.title}</span>
                        </div>
                        <p className="text-[10.5px] text-slate-500 mt-1 leading-normal">{dst.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Stock Routing Remarks</label>
                <input
                  type="text"
                  value={routeForm.remarks}
                  onChange={(e) => setRouteForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="e.g. Approved transfer to Own Project buffer as customer cancelled"
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                />
              </div>

              {/* Decoupled Credit Note Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="text-emerald-600" size={15} />
                    <span className="font-bold text-slate-900 text-xs">Post Credit Note to Customer Ledger</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={routeForm.issueCreditNote}
                      onChange={(e) => setRouteForm((prev) => ({ ...prev, issueCreditNote: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {routeForm.issueCreditNote && (
                  <div className="pt-2 border-t border-slate-200/80 space-y-2.5 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium text-slate-600 text-[11px] mb-1">Credit Date</label>
                        <input
                          type="date"
                          value={routeForm.creditDate}
                          onChange={(e) => setRouteForm((prev) => ({ ...prev, creditDate: e.target.value }))}
                          className="w-full border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 text-[11px] mb-1">Credit Value</label>
                        <div className="font-mono font-bold text-emerald-700 text-sm mt-1">
                          {formatCurrency(activeReturn.creditNoteAmount || activeReturn.totalAmount || 0)}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 text-[11px] mb-1">Credit Approval Notes</label>
                      <input
                        type="text"
                        value={routeForm.approvalNotes}
                        onChange={(e) => setRouteForm((prev) => ({ ...prev, approvalNotes: e.target.value }))}
                        placeholder="e.g. Authorized by Accounts Manager on defect verification"
                        className="w-full border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  {submitting ? 'Routing...' : 'Confirm Stock Disposition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: VIEW FULL TRACEABILITY TIMELINE                       */}
      {/* ============================================================== */}
      {modalMode === 'view' && activeReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-5 text-xs max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Eye className="text-blue-600" size={18} />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">End-to-End Customer Return Traceability</h3>
                  <p className="text-[11px] text-slate-500 font-mono">Return #{activeReturn.returnNumber} | Invoice: {activeReturn.salesInvoiceNumber}</p>
                </div>
              </div>
              <button onClick={() => setModalMode(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              {/* Metadata summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Customer</span>
                  <p className="font-bold text-slate-800 text-xs mt-0.5">{activeReturn.customerName}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Sales Order</span>
                  <p className="font-mono font-bold text-blue-600 text-xs mt-0.5">{activeReturn.salesOrderNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Delivery Challan</span>
                  <p className="font-mono text-slate-700 text-xs mt-0.5">{activeReturn.deliveryChallanNumber}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Return Reason</span>
                  <p className="font-semibold text-rose-700 text-xs mt-0.5">{activeReturn.reason}</p>
                </div>
              </div>

              {/* Lifecycle Progress Cards */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">5-Phase Return Lifecycle Audit Trail</h4>

                {/* Step 1 */}
                <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-[11px]">
                    1
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Return Request Authorization</span>
                      <span className="text-[11px] font-mono text-slate-500">{activeReturn.docDate}</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Customer requested return of {n(activeReturn.requestedQty)} m fabric. Zero stock ledger impact.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                  activeReturn.receivedQty > 0 ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50 opacity-60'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[11px] ${
                    activeReturn.receivedQty > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    2
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Physical Inward to SYS-QC-HOLD</span>
                      {activeReturn.receivedQty > 0 && <span className="text-[11px] text-blue-700 font-semibold">Quarantined</span>}
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {activeReturn.receivedQty > 0
                        ? `Received ${n(activeReturn.receivedQty)} m at ${activeReturn.locationName}. Quarantined in SYS-QC-HOLD (blocked from sale).`
                        : 'Awaiting physical delivery from carrier at warehouse.'}
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                  activeReturn.qcInspection ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50 opacity-60'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[11px] ${
                    activeReturn.qcInspection ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-500'
                  }`}>
                    3
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Piece-by-Piece QC Inspection</span>
                      {activeReturn.qcInspection && (
                        <span className="font-mono text-[11px] text-amber-800 font-bold">
                          {activeReturn.qcInspection.inspectionNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {activeReturn.qcInspection
                        ? `Passed: ${n(activeReturn.qcInspection.passedQty)} m | Reprocess: ${n(activeReturn.qcInspection.reprocessQty)} m | Reject: ${n(activeReturn.qcInspection.rejectedQty)} m | Hold: ${n(activeReturn.qcInspection.holdQty)} m`
                        : 'Pending piece-by-piece inspection and defect scoring.'}
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                  activeReturn.returnStage === 'ROUTED' || activeReturn.status === 'Posted'
                    ? 'border-slate-200 bg-white'
                    : 'border-dashed border-slate-200 bg-slate-50 opacity-60'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[11px] ${
                    activeReturn.returnStage === 'ROUTED' || activeReturn.status === 'Posted'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    4
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Stock Disposition Routing</span>
                      <span className="text-[11px] font-semibold text-purple-700">{activeReturn.stockDestination}</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Destination assigned: {activeReturn.stockDestination || 'Awaiting authorized routing'}.
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className={`p-3 rounded-xl border flex items-start gap-3 ${
                  activeReturn.creditNoteNumber ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50 opacity-60'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-bold text-[11px] ${
                    activeReturn.creditNoteNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    5
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Financial Credit Note & Ledger Adjustment</span>
                      {activeReturn.creditNoteNumber && (
                        <span className="font-mono text-[11px] font-bold text-emerald-700">
                          {activeReturn.creditNoteNumber} ({formatCurrency(activeReturn.creditNoteAmount)})
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {activeReturn.creditNoteNumber
                        ? 'Posted to customer account receivable. Pro-rata commission and incentives reversed.'
                        : 'Credit note pending authorization.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold shadow-2xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerReturnTab;
