import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Truck,
  Cog,
  ArrowDownToLine,
  ShieldCheck,
  Boxes,
  IndianRupee,
  CheckCircle2,
  RefreshCw,
  Plus,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  X,
  FileText,
  Calendar,
  Building,
  Clock,
  AlertCircle,
  Package,
  Layers,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../services/api';
import { usePmsStore } from '../../../../stores/pmsStore';
import { useERP } from '../../../../context/ERPContext';
import {
  fetchPlans,
  fetchJWOs,
  createJWORow,
  fetchPendingRegister,
  fetchVendorReconciliation,
  errorMessage,
} from '../../../../services/jobWorkSync';
import { ProcessPlanStageWorkspace } from './ProcessPlanStageWorkspace';
import { Stage12JobWorkOutwardWorkspace } from './Stage12JobWorkOutwardWorkspace';
import { Stage13ProcessingWorkspace } from './Stage13ProcessingWorkspace';
import { Stage14JobWorkInwardWorkspace } from './Stage14JobWorkInwardWorkspace';
import { Stage15QualityStockWorkspace } from './Stage15QualityStockWorkspace';
import { Stage16CustomerDispatchWorkspace } from './Stage16CustomerDispatchWorkspace';
import { Stage17InvoicePaymentWorkspace } from './Stage17InvoicePaymentWorkspace';
import { Stage18ProjectClosureWorkspace } from './Stage18ProjectClosureWorkspace';

export function StageDownstreamWorkspace({
  project,
  stage,
  onSyncPipeline,
  onSelectStage,
  totalStages = 18,
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

  const erp = useERP();
  const projectId = project?.id;
  const stageName = (stage?.name || '').trim();
  const stageSeq = stage?.sequence || 10;

  const isPlanStage = stageName.startsWith('Processing Plan');
  const isOutwardStage = stageName.includes('Outward');
  const isProcessingStage = stageName === 'Processing' || stageName === 'Processing (Dyeing)';
  const isInwardStage = stageName.includes('Inward');
  const isQCStage = stageName.includes('Quality') || stageName.includes('QC');
  const isDispatchStage = stageName.includes('Dispatch');
  const isInvoiceStage = stageName.includes('Invoice') || stageName.includes('Payment');
  const isClosureStage = stageName.includes('Closure');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pendingRegister, setPendingRegister] = useState([]);
  const [vendorReconciliation, setVendorReconciliation] = useState([]);
  const [qcInspections, setQcInspections] = useState([]);
  const [deliveryChallans, setDeliveryChallans] = useState([]);
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [agencies, setAgencies] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active JWO selector for multi-JWO projects
  const [selectedJwoId, setSelectedJwoId] = useState('');

  // Form states
  const [outwardForm, setOutwardForm] = useState({
    date: new Date().toISOString().split('T')[0],
    quantity: '',
    challanNo: '',
    vehicleNo: '',
    lrNo: '',
    transporter: '',
    driver: '',
    remarks: '',
    selectedTakas: [],
  });

  const [inwardForm, setInwardForm] = useState({
    date: new Date().toISOString().split('T')[0],
    quantity: '',
    accepted: '',
    rejected: '0',
    challanNo: '',
    rollCount: '',
    remarks: '',
  });

  const [qcForm, setQcForm] = useState({
    date: new Date().toISOString().split('T')[0],
    inspectionNumber: `QC-${Date.now().toString().slice(-6)}`,
    totalInspectedQty: '',
    passedQty: '',
    secondQualityQty: '0',
    reprocessQty: '0',
    rejectedQty: '0',
    qualityGrade: 'Grade A',
    defectsFound: '',
    notes: '',
  });

  const [dispatchForm, setDispatchForm] = useState({
    date: new Date().toISOString().split('T')[0],
    challanNumber: `DC-CUST-${Date.now().toString().slice(-6)}`,
    transporter: '',
    vehicleNo: '',
    lrNo: '',
    dispatchedQty: '',
    notes: '',
  });

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [
        plansRes,
        jwoRes,
        prRes,
        vrRes,
        qcRes,
        salesRes,
        dcRes,
        agenciesRes,
      ] = await Promise.allSettled([
        fetchPlans().catch(() => []),
        fetchJWOs().catch(() => []),
        fetchPendingRegister(projectId).catch(() => []),
        fetchVendorReconciliation(projectId).catch(() => []),
        api.get('/inventory/qc-inspections/', { query: { page_size: 100 } }).catch(() => ({ results: [] })),
        api.get('/sales/invoices/', {
          query: project?.salesOrderId ? { sales_order: project.salesOrderId } : { page_size: 50 },
        }).catch(() => ({ data: [] })),
        api.get('/sales/delivery-challans/', {
          query: project?.salesOrderId ? { sales_order: project.salesOrderId } : { page_size: 50 },
        }).catch(() => ({ results: [] })),
        api.get('/masters/agencies/', { query: { page_size: 200 } }),
      ]);

      if (plansRes.status === 'fulfilled' && plansRes.value) {
        setPlans(Array.isArray(plansRes.value) ? plansRes.value : []);
      }
      if (jwoRes.status === 'fulfilled' && jwoRes.value) {
        setOrders(Array.isArray(jwoRes.value) ? jwoRes.value : []);
      }
      if (prRes.status === 'fulfilled' && prRes.value) {
        setPendingRegister(Array.isArray(prRes.value) ? prRes.value : []);
      }
      if (vrRes.status === 'fulfilled' && vrRes.value) {
        setVendorReconciliation(Array.isArray(vrRes.value) ? vrRes.value : []);
      }
      if (qcRes.status === 'fulfilled' && qcRes.value) {
        const qList = qcRes.value?.results || qcRes.value?.data || [];
        setQcInspections(Array.isArray(qList) ? qList : []);
      }
      if (salesRes.status === 'fulfilled' && salesRes.value) {
        const invList = salesRes.value?.data || salesRes.value?.results || [];
        setSalesInvoices(Array.isArray(invList) ? invList : []);
      }
      if (dcRes.status === 'fulfilled' && dcRes.value) {
        const dList = dcRes.value?.results || dcRes.value?.data || [];
        setDeliveryChallans(Array.isArray(dList) ? dList : []);
      }
      if (agenciesRes.status === 'fulfilled' && agenciesRes.value) {
        const list = Array.isArray(agenciesRes.value)
          ? agenciesRes.value
          : agenciesRes.value?.results || [];
        setAgencies(list);
      }
      if (agenciesRes.status === 'fulfilled' && agenciesRes.value) {
        const list = Array.isArray(agenciesRes.value)
          ? agenciesRes.value
          : agenciesRes.value?.results || [];
        setAgencies(list);
      }
    } catch (err) {
      console.warn('Error loading downstream workspace data:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }
  }, [projectId, stageName]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (onSyncPipeline) await onSyncPipeline();
    setRefreshing(false);
    toast.info(`${stageName} data refreshed.`);
  };

  const projectOrders = useMemo(() => {
    return orders.filter(
      (o) => o.projectId === projectId || (o.remarks || '').includes(project?.code || '')
    );
  }, [orders, projectId, project?.code]);

  const activeJwo = useMemo(() => {
    if (selectedJwoId) {
      return projectOrders.find((o) => o.id === selectedJwoId) || projectOrders[0];
    }
    return projectOrders[0] || null;
  }, [projectOrders, selectedJwoId]);

  const projectPlans = useMemo(() => {
    return plans.filter(
      (p) => p.projectId === projectId || (p.remarks || '').includes(project?.code || '')
    );
  }, [plans, projectId, project?.code]);

  const realOutwards = useMemo(() => {
    const list = [];
    projectOrders.forEach((o) => {
      (o.outwards || []).forEach((out) => {
        list.push({
          ...out,
          jwoId: o.id,
          jwoNo: o.jwoNo,
          vendor: o.vendor || o.vendorName,
          process: o.process,
          plannedQty: o.plannedQty,
        });
      });
    });
    return list;
  }, [projectOrders]);

  const realInwards = useMemo(() => {
    const list = [];
    projectOrders.forEach((o) => {
      (o.inwards || []).forEach((inw) => {
        list.push({
          ...inw,
          jwoId: o.id,
          jwoNo: o.jwoNo,
          vendor: o.vendor || o.vendorName,
          process: o.process,
          plannedQty: o.plannedQty,
        });
      });
    });
    return list;
  }, [projectOrders]);

  const realLosses = useMemo(() => {
    const list = [];
    projectOrders.forEach((o) => {
      (o.lossEntries || []).forEach((loss) => {
        list.push({
          ...loss,
          jwoId: o.id,
          jwoNo: o.jwoNo,
          vendor: o.vendor || o.vendorName,
        });
      });
    });
    return list;
  }, [projectOrders]);

  const projectQCInspections = useMemo(() => {
    const inwardIds = new Set(realInwards.map((i) => String(i.id)));
    const inwardNos = new Set(realInwards.map((i) => i.no).filter(Boolean));
    return qcInspections.filter((q) => {
      if (q.source_document_type === 'JWO_INWARD') {
        if (q.source_document_id && inwardIds.has(String(q.source_document_id))) return true;
        if (q.source_document_number && inwardNos.has(q.source_document_number)) return true;
      }
      if ((q.notes || '').includes(project?.code || '')) return true;
      return false;
    });
  }, [qcInspections, realInwards, project?.code]);

  const projectReq = Number(project?.requirementMeters || project?.quantity || 2850);
  const allocatedGrey = Number(project?.allocatedMeters || project?.pipelineSummary?.allocated_meters || projectReq);
  const realOutwardSum = realOutwards.reduce((acc, out) => acc + (Number(out.qty) || 0), 0);
  const realInwardSum = realInwards.reduce((acc, inw) => acc + (Number(inw.qty) || 0), 0);
  const realAcceptedSum = realInwards.reduce((acc, inw) => acc + (Number(inw.accepted ?? inw.qty) || 0), 0);
  const realApprovedLossSum = realLosses
    .filter((l) => l.status === 'Approved')
    .reduce((acc, l) => acc + (Number(l.qty) || 0), 0);
  const pendingAtMill = Math.max(0, realOutwardSum - realInwardSum - realApprovedLossSum);

  const getStageIcon = () => {
    if (isPlanStage) return <ClipboardList size={20} className="text-blue-600" />;
    if (isOutwardStage) return <Truck size={20} className="text-amber-600" />;
    if (isProcessingStage) return <Cog size={20} className="text-indigo-600" />;
    if (isInwardStage) return <ArrowDownToLine size={20} className="text-teal-600" />;
    if (isQCStage) return <ShieldCheck size={20} className="text-emerald-600" />;
    if (isDispatchStage) return <Boxes size={20} className="text-orange-600" />;
    if (isInvoiceStage) return <IndianRupee size={20} className="text-purple-600" />;
    return <CheckCircle2 size={20} className="text-emerald-600" />;
  };

  // Pre-fill modals when opening
  const handleOpenModal = () => {
    if (isOutwardStage) {
      const target = activeJwo || projectOrders[0];
      const remainingPlanned = target
        ? Math.max(0, (Number(target.plannedQty) || projectReq) - realOutwardSum)
        : projectReq;
      const linkedPlan = projectPlans.find((p) => String(p.id) === String(target?.processPlanId)) || projectPlans[0];
      const availableTakas = linkedPlan?.selectedTakas || [];
      setOutwardForm({
        date: new Date().toISOString().split('T')[0],
        quantity: remainingPlanned || projectReq,
        challanNo: `DC-OUT-${Date.now().toString().slice(-5)}`,
        vehicleNo: 'GJ-05-BX-4921',
        lrNo: `LR-${Date.now().toString().slice(-5)}`,
        transporter: target?.vendor || agencies[0]?.name || 'Standard Transport',
        driver: '',
        remarks: `Dispatched outward for project ${project?.code || ''}`,
        selectedTakas: availableTakas,
      });
    } else if (isInwardStage) {
      setInwardForm({
        date: new Date().toISOString().split('T')[0],
        quantity: pendingAtMill || 500,
        accepted: pendingAtMill || 500,
        rejected: '0',
        challanNo: `DC-IN-${Date.now().toString().slice(-5)}`,
        rollCount: '10',
        remarks: `Received finished dyed fabric for project ${project?.code || ''}`,
      });
    } else if (isQCStage) {
      setQcForm({
        date: new Date().toISOString().split('T')[0],
        inspectionNumber: `QC-INSP-${Date.now().toString().slice(-5)}`,
        totalInspectedQty: realInwardSum || projectReq,
        passedQty: realInwardSum || projectReq,
        secondQualityQty: '0',
        reprocessQty: '0',
        rejectedQty: '0',
        qualityGrade: 'Grade A',
        defectsFound: 'None. Shade and finish within 4-point standard tolerance.',
        notes: `QC inspection for project ${project?.code || ''}`,
      });
    } else if (isDispatchStage) {
      setDispatchForm({
        date: new Date().toISOString().split('T')[0],
        challanNumber: `DC-CUST-${Date.now().toString().slice(-5)}`,
        transporter: 'V-Trans Logistics',
        vehicleNo: 'GJ-05-AX-9912',
        lrNo: `LR-${Date.now().toString().slice(-5)}`,
        dispatchedQty: realAcceptedSum || projectReq,
        notes: `Customer dispatch for sales order ${project?.salesOrderNumber || project?.code || ''}`,
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveOutward = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const targetOrder = activeJwo || projectOrders[0];
      if (!targetOrder) {
        throw new Error('Please create a Job Work Order in Stage 11 before dispatching outward.');
      }
      const qty = Number(outwardForm.quantity) || 0;
      if (qty <= 0) {
        throw new Error('Dispatch quantity must be greater than zero.');
      }

      const takasPayload = (outwardForm.selectedTakas || []).map((t) => ({
        lot_taka: t.lot_taka_id || t.id,
        meters: Number(t.quantity || t.meters || t.available_quantity || 0),
        weight_kg: t.roll_weight || t.weight_kg || null,
      }));

      await createJWORow(targetOrder.id, 'outwards', {
        date: outwardForm.date,
        qty: qty,
        challan_no: outwardForm.challanNo,
        lrNo: outwardForm.lrNo,
        transporter: outwardForm.transporter,
        vehicleNo: outwardForm.vehicleNo,
        driver: outwardForm.driver,
        status: 'Sent',
        remarks: outwardForm.remarks,
        ...(takasPayload.length > 0 ? { takas: takasPayload } : {}),
      });

      toast.success(
        `Job Work Outward Challan recorded for JWO ${targetOrder.jwoNo}. Moved to External WIP.`
      );
      setIsModalOpen(false);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save outward challan.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveInward = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const targetOrder = activeJwo || projectOrders[0];
      if (!targetOrder) {
        throw new Error('No active Job Work Order found for this inward receipt.');
      }
      const qty = Number(inwardForm.quantity) || 0;
      const accepted = Number(inwardForm.accepted ?? inwardForm.quantity) || 0;
      const rejected = Number(inwardForm.rejected || 0);

      if (qty <= 0) {
        throw new Error('Received quantity must be greater than zero.');
      }
      if (accepted + rejected > qty) {
        throw new Error('Accepted + Rejected quantity cannot exceed total received quantity.');
      }

      await createJWORow(targetOrder.id, 'inwards', {
        date: inwardForm.date,
        qty: qty,
        accepted: accepted,
        rejected: rejected,
        challanNo: inwardForm.challanNo,
        status: 'Received',
        remarks: inwardForm.remarks,
      });

      toast.success(
        `Job Work Inward receipt recorded (${qty.toLocaleString('en-IN')} M). Material received into QC Hold stock.`
      );
      setIsModalOpen(false);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to record inward receipt.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveQC = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const inspected = Number(qcForm.totalInspectedQty) || 0;
      const passed = Number(qcForm.passedQty) || 0;
      const secondQuality = Number(qcForm.secondQualityQty) || 0;
      const reprocess = Number(qcForm.reprocessQty) || 0;
      const rejected = Number(qcForm.rejectedQty) || 0;

      const latestInward = realInwards[0];

      await api.post('/inventory/qc-inspections/', {
        inspection_number: qcForm.inspectionNumber,
        source_document_type: 'JWO_INWARD',
        source_document_id: latestInward ? latestInward.id : null,
        source_document_number: latestInward ? latestInward.no : null,
        inspection_date: qcForm.date,
        total_received_qty: inspected,
        total_inspected_qty: inspected,
        passed_qty: passed,
        second_quality_qty: secondQuality,
        reprocess_qty: reprocess,
        rejected_qty: rejected,
        quality_grade: qcForm.qualityGrade,
        defects_found: qcForm.defectsFound,
        status: passed > 0 ? 'Approved' : 'Rejected',
        notes: `${qcForm.notes} | Project: ${project?.code || ''}`,
      });

      toast.success(
        `QC Inspection ${qcForm.inspectionNumber} approved (${passed.toLocaleString('en-IN')} M Grade A passed).`
      );
      setIsModalOpen(false);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save QC inspection.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDispatch = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const qty = Number(dispatchForm.dispatchedQty) || 0;
      await api.post('/sales/delivery-challans/', {
        challan_number: dispatchForm.challanNumber,
        sales_order_id: project?.salesOrderId || null,
        challan_date: dispatchForm.date,
        transporter: dispatchForm.transporter,
        vehicle_no: dispatchForm.vehicleNo,
        lr_number: dispatchForm.lrNo,
        status: 'Dispatched',
        notes: dispatchForm.notes,
        total_quantity: qty,
      });

      toast.success(
        `Customer Delivery Challan ${dispatchForm.challanNumber} generated (${qty.toLocaleString('en-IN')} M dispatched).`
      );
      setIsModalOpen(false);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save delivery challan.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseProject = async () => {
    if (!window.confirm(`Are you sure you want to mark project ${project?.code} as Completed & Closed?`)) {
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/pms/projects/${projectId}/close/`, {
        remarks: 'All 18 PMS stages completed, reconciliation balanced, and payment settled.',
      });
      toast.success(`Project ${project?.code} successfully completed and archived.`);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to close project.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 4 Connected Metric KPI Cards */}
      <div className="rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Downstream Processing & Quality Reconciliation Metrics
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            Ref: {project?.code || '—'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Project Target</span>
            <span className="font-mono font-bold text-slate-900">{projectReq.toLocaleString('en-IN')} M</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">
              {isPlanStage || isOutwardStage ? 'Grey Allocated' : 'Dispatched to Processor'}
            </span>
            <span className="font-mono font-bold text-blue-700">
              {(isPlanStage || isOutwardStage ? allocatedGrey : realOutwardSum).toLocaleString('en-IN')} M
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">
              {isInwardStage || isQCStage ? 'Received at Dock' : 'Current Stage Progress'}
            </span>
            <span className="font-mono font-bold text-emerald-700">
              {isInwardStage || isQCStage
                ? `${realInwardSum.toLocaleString('en-IN')} M`
                : stage?.status === 'Completed'
                ? '100% Complete'
                : `${stage?.completionPct || 0}% Executed`}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">
              {isProcessingStage || isInwardStage ? 'Outstanding at Vendor' : 'Stage Weight'}
            </span>
            <span className="font-mono font-bold text-slate-700">
              {isProcessingStage || isInwardStage
                ? `${pendingAtMill.toLocaleString('en-IN')} M`
                : `${stage?.weight || 10}% of Lifecycle`}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Stage 11: Processing Plan & Vendor Assignment */}
        {isPlanStage && (
          <ProcessPlanStageWorkspace
            project={project}
            stage={stage}
            onUpdated={() => onSyncPipeline && onSyncPipeline()}
            onSelectStage={onSelectStage}
          />
        )}

        {/* Stage 12: Job Work Outward (Send to Vendor) */}
        {isOutwardStage && (
          <Stage12JobWorkOutwardWorkspace
            project={project}
            stage={stage}
            onUpdated={() => onSyncPipeline && onSyncPipeline()}
            onSelectStage={onSelectStage}
          />
        )}

        {/* Stage 13: Processing (Live Vendor WIP Progress) */}
        {isProcessingStage && (
          <Stage13ProcessingWorkspace
            project={project}
            stage={stage}
            onUpdated={() => onSyncPipeline && onSyncPipeline()}
            onSelectStage={onSelectStage}
            totalStages={totalStages}
          />
        )}

        {/* Stage 14: Job Work Inward (Receive from Vendor) */}
        {isInwardStage && (
          <Stage14JobWorkInwardWorkspace
            project={project}
            stage={stage}
            onUpdated={() => onSyncPipeline && onSyncPipeline()}
            onSelectStage={onSelectStage}
            totalStages={totalStages}
          />
        )}

        {/* Stage 15: Quality Check & Stock Allocation */}
        {isQCStage && (
          <Stage15QualityStockWorkspace
            project={project}
            stage={stage}
            onUpdated={() => onSyncPipeline && onSyncPipeline()}
            onSelectStage={onSelectStage}
            totalStages={totalStages}
          />
        )}

        {/* Stage 16: Customer Dispatch */}
        {isDispatchStage && (
          <Stage16CustomerDispatchWorkspace
            project={project}
            stage={stage}
            onUpdated={() => onSyncPipeline && onSyncPipeline()}
            onSelectStage={onSelectStage}
            totalStages={totalStages}
          />
        )}

        {/* Stage 17: Invoice & Payment Collection */}
        {isInvoiceStage && (
          <Stage17InvoicePaymentWorkspace
            project={project}
            stage={stage}
            onUpdated={() => onSyncPipeline && onSyncPipeline()}
            onSelectStage={onSelectStage}
            totalStages={totalStages}
          />
        )}

        {/* Stage 18: Project Closure */}
        {isClosureStage && (
          <Stage18ProjectClosureWorkspace
            project={project}
            stage={stage}
            onSyncPipeline={onSyncPipeline}
            onSelectStage={onSelectStage}
            totalStages={totalStages}
          />
        )}
      </div>

      {/* Transaction Entry Modals */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  {getStageIcon()}
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Record {stageName} Transaction
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {/* Outward Modal Form */}
            {isOutwardStage && (
              <form onSubmit={handleSaveOutward} className="p-5 space-y-4 text-xs">
                {projectOrders.length > 1 && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Select Job Work Order</label>
                    <select
                      value={selectedJwoId || activeJwo?.id || ''}
                      onChange={(e) => setSelectedJwoId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    >
                      {projectOrders.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          {ord.jwoNo} ({ord.vendor} — {ord.process} — {ord.plannedQty} M)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dispatch Quantity (M)</label>
                    <input
                      type="number"
                      required
                      value={outwardForm.quantity}
                      onChange={(e) => setOutwardForm({ ...outwardForm, quantity: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dispatch Date</label>
                    <input
                      type="date"
                      required
                      value={outwardForm.date}
                      onChange={(e) => setOutwardForm({ ...outwardForm, date: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Outward Challan No</label>
                    <input
                      type="text"
                      required
                      value={outwardForm.challanNo}
                      onChange={(e) => setOutwardForm({ ...outwardForm, challanNo: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Vehicle No</label>
                    <input
                      type="text"
                      value={outwardForm.vehicleNo}
                      onChange={(e) => setOutwardForm({ ...outwardForm, vehicleNo: e.target.value })}
                      placeholder="e.g. GJ-05-BX-4921"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Transporter</label>
                    <input
                      type="text"
                      value={outwardForm.transporter}
                      onChange={(e) => setOutwardForm({ ...outwardForm, transporter: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">LR / Bilty No</label>
                    <input
                      type="text"
                      value={outwardForm.lrNo}
                      onChange={(e) => setOutwardForm({ ...outwardForm, lrNo: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Remarks & Gate Pass Notes</label>
                  <textarea
                    rows={2}
                    value={outwardForm.remarks}
                    onChange={(e) => setOutwardForm({ ...outwardForm, remarks: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? 'Dispatching...' : 'Confirm Outward Dispatch'}
                  </button>
                </div>
              </form>
            )}

            {/* Inward Modal Form */}
            {isInwardStage && (
              <form onSubmit={handleSaveInward} className="p-5 space-y-4 text-xs">
                {projectOrders.length > 1 && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Select Job Work Order</label>
                    <select
                      value={selectedJwoId || activeJwo?.id || ''}
                      onChange={(e) => setSelectedJwoId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    >
                      {projectOrders.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          {ord.jwoNo} ({ord.vendor} — {ord.process})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Received Quantity (M)</label>
                    <input
                      type="number"
                      required
                      value={inwardForm.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInwardForm({
                          ...inwardForm,
                          quantity: val,
                          accepted: val,
                        });
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Receipt Date</label>
                    <input
                      type="date"
                      required
                      value={inwardForm.date}
                      onChange={(e) => setInwardForm({ ...inwardForm, date: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Accepted Metres</label>
                    <input
                      type="number"
                      required
                      value={inwardForm.accepted}
                      onChange={(e) => setInwardForm({ ...inwardForm, accepted: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-emerald-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Rejected Metres</label>
                    <input
                      type="number"
                      value={inwardForm.rejected}
                      onChange={(e) => setInwardForm({ ...inwardForm, rejected: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-red-600 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Vendor Challan No</label>
                    <input
                      type="text"
                      required
                      value={inwardForm.challanNo}
                      onChange={(e) => setInwardForm({ ...inwardForm, challanNo: e.target.value })}
                      placeholder="e.g. DC-IN-4902"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Rolls Count</label>
                    <input
                      type="number"
                      value={inwardForm.rollCount}
                      onChange={(e) => setInwardForm({ ...inwardForm, rollCount: e.target.value })}
                      placeholder="10"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inward Notes & Observations</label>
                  <textarea
                    rows={2}
                    value={inwardForm.remarks}
                    onChange={(e) => setInwardForm({ ...inwardForm, remarks: e.target.value })}
                    placeholder="Shrinkage, shade tone, dock inspection notes..."
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? 'Recording Inward...' : 'Confirm Inward Receipt'}
                  </button>
                </div>
              </form>
            )}

            {/* QC Modal Form */}
            {isQCStage && (
              <form onSubmit={handleSaveQC} className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Inspection Number</label>
                    <input
                      type="text"
                      required
                      value={qcForm.inspectionNumber}
                      onChange={(e) => setQcForm({ ...qcForm, inspectionNumber: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Inspection Date</label>
                    <input
                      type="date"
                      required
                      value={qcForm.date}
                      onChange={(e) => setQcForm({ ...qcForm, date: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Total Inspected Qty (M)</label>
                    <input
                      type="number"
                      required
                      value={qcForm.totalInspectedQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQcForm({ ...qcForm, totalInspectedQty: val, passedQty: val });
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Passed Grade A (M)</label>
                    <input
                      type="number"
                      required
                      value={qcForm.passedQty}
                      onChange={(e) => setQcForm({ ...qcForm, passedQty: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-emerald-700 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">2nd Quality (M)</label>
                    <input
                      type="number"
                      value={qcForm.secondQualityQty}
                      onChange={(e) => setQcForm({ ...qcForm, secondQualityQty: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Reprocess (M)</label>
                    <input
                      type="number"
                      value={qcForm.reprocessQty}
                      onChange={(e) => setQcForm({ ...qcForm, reprocessQty: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Rejected (M)</label>
                    <input
                      type="number"
                      value={qcForm.rejectedQty}
                      onChange={(e) => setQcForm({ ...qcForm, rejectedQty: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-red-600 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quality Grade</label>
                  <select
                    value={qcForm.qualityGrade}
                    onChange={(e) => setQcForm({ ...qcForm, qualityGrade: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  >
                    <option value="Grade A">Grade A (Passed Export Quality)</option>
                    <option value="Grade B">Grade B (Standard Commercial)</option>
                    <option value="Second Quality">Second Quality (Discounted)</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Defects & 4-Point Report</label>
                  <textarea
                    rows={2}
                    value={qcForm.defectsFound}
                    onChange={(e) => setQcForm({ ...qcForm, defectsFound: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? 'Approving QC...' : 'Approve QC & Allocate Stock'}
                  </button>
                </div>
              </form>
            )}

            {/* Dispatch Modal Form */}
            {isDispatchStage && (
              <form onSubmit={handleSaveDispatch} className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Delivery Challan No</label>
                    <input
                      type="text"
                      required
                      value={dispatchForm.challanNumber}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, challanNumber: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dispatch Date</label>
                    <input
                      type="date"
                      required
                      value={dispatchForm.date}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, date: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dispatched Quantity (M)</label>
                    <input
                      type="number"
                      required
                      value={dispatchForm.dispatchedQty}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchedQty: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Transporter</label>
                    <input
                      type="text"
                      value={dispatchForm.transporter}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, transporter: e.target.value })}
                      placeholder="e.g. V-Trans Logistics"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Vehicle No</label>
                    <input
                      type="text"
                      value={dispatchForm.vehicleNo}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNo: e.target.value })}
                      placeholder="e.g. GJ-05-BX-4921"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">LR / Bilty No</label>
                    <input
                      type="text"
                      value={dispatchForm.lrNo}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, lrNo: e.target.value })}
                      placeholder="e.g. LR-9402"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer Dispatch Remarks</label>
                  <textarea
                    rows={2}
                    value={dispatchForm.notes}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? 'Generating Challan...' : 'Confirm Customer Dispatch'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default StageDownstreamWorkspace;
