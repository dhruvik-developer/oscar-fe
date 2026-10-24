import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Eye, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import {
  toDDMMYYYY,
  numIN,
  statusPill,
  ProcessPlanForm,
  PROCESS_OPTIONS,
  useJobWorkLookups,
} from './ProcessPlanListPage';
import { jwoKpis, purgeLegacyJobWorkCache } from './jobWorkOrdersStore';
import {
  fetchPlan,
  fetchJWOs,
  createPlan,
  updatePlan,
  approvePlan,
  completePlan,
  createPlanCharge,
  updatePlanCharge,
  deletePlanCharge,
  createJWO,
  updateJWOHeader,
  createJWORow,
  errorMessage,
} from '../../services/jobWorkSync';
import PageHeader from '../../components/ui/PageHeader';
import MasterSourceLink from '../../components/common/MasterSourceLink';

const TABS = ['Plan Details', 'Job Work Orders', 'Material Requirement', 'Timeline', 'Charges', 'Documents', 'Remarks'];

function InfoRow({ label, value, accent }) {
  return (
    <p className="flex gap-2 text-[12.5px] leading-6">
      <span className="w-[118px] shrink-0 font-medium text-slate-500">{label}</span>
      <span className="text-slate-400">:</span>
      <span className={`font-semibold ${accent || 'text-[#17294e]'}`}>{value}</span>
    </p>
  );
}

export default function ProcessPlanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { vendors: vendorOptions, processes: masterProcesses } = useJobWorkLookups();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('Plan Details');
  const [showEdit, setShowEdit] = useState(false);
  const [jwos, setJwos] = useState([]);
  const [showCreateJWO, setShowCreateJWO] = useState(false);
  const [createForm, setCreateForm] = useState({
    orderDate: '',
    vendor: '',
    process: '',
    plannedQty: '',
    rate: '',
    expectedCompletion: '',
  });
  const [viewingJWO, setViewingJWO] = useState(null);
  const [editingJWO, setEditingJWO] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [addingJWO, setAddingJWO] = useState(null);
  const [addForm, setAddForm] = useState({ type: 'outward', qty: '', date: new Date().toISOString().slice(0, 10) });
  const [viewingMaterial, setViewingMaterial] = useState(null);
  // Plan charges — server rows only (per-row endpoints).
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [editingChargeId, setEditingChargeId] = useState(null);
  const [viewingCharge, setViewingCharge] = useState(null);
  const [chargeForm, setChargeForm] = useState({ type: '', description: '', rate: '', qty: '' });
  const [viewingStage, setViewingStage] = useState(null);
  const [modalError, setModalError] = useState('');
  const [busy, setBusy] = useState(false);

  const reloadPlan = async () => setPo(await fetchPlan(id));
  const reloadJwos = async () => setJwos(await fetchJWOs());

  // Server is the source of truth.
  useEffect(() => {
    let live = true;
    purgeLegacyJobWorkCache();
    setLoading(true);
    Promise.all([fetchPlan(id), fetchJWOs()])
      .then(([plan, orders]) => {
        if (!live) return;
        setPo(plan);
        setJwos(orders);
      })
      .catch((err) => { if (live) setLoadError(errorMessage(err, 'Could not load the process plan.')); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id]);

  /** Run a server call; on failure keep the modal open and show the error. */
  const run = async (fn, fallback) => {
    setModalError('');
    setBusy(true);
    try {
      await fn();
      return true;
    } catch (err) {
      setModalError(errorMessage(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading || !po) {
    return (
      <div className="min-h-[calc(100vh-62px)] bg-[#f4f7fb] p-3 md:p-4">
        <div className="mt-3 rounded-xl border border-[#e2eaf5] bg-white p-10 text-center">
          {loading ? (
            <p className="text-[13px] text-slate-400">Loading process plan…</p>
          ) : (
            <>
              <p className="text-[14px] font-extrabold text-[#17294e]">No records found</p>
              <p className="mt-1 text-[12px] text-slate-400">{loadError || 'This process plan no longer exists.'}</p>
            </>
          )}
          <button
            onClick={() => navigate('/job-work/process-plan')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] px-4 py-2 text-[12px] font-bold text-[#2563eb] hover:bg-slate-50"
          >
            <ArrowLeft size={14} /> Back to Process Plan
          </button>
        </div>
      </div>
    );
  }

  const plannedM = Number(po.plannedQty ?? po.expectedQty) || 0;

  // ── Plan charges ──
  const planCharges = po.charges || [];
  const openAddCharge = () => {
    setEditingChargeId(null);
    setModalError('');
    setChargeForm({ type: '', description: '', rate: '', qty: plannedM ? String(plannedM) : '' });
    setShowChargeModal(true);
  };
  const openEditCharge = (c) => {
    setEditingChargeId(c.id);
    setModalError('');
    setChargeForm({
      type: c.type || '',
      description: c.description || '',
      rate: String(c.rate ?? ''),
      qty: String(c.qty ?? ''),
    });
    setShowChargeModal(true);
  };
  const handleSaveCharge = async (e) => {
    e?.preventDefault?.();
    const rate = Number(chargeForm.rate) || 0;
    const qty = Number(chargeForm.qty) || 0;
    if (!chargeForm.type.trim()) { setModalError('Charge type is required.'); return; }
    if (!(qty > 0)) { setModalError('Quantity must be greater than 0.'); return; }
    const row = { type: chargeForm.type.trim(), description: chargeForm.description.trim(), rate, qty };
    const ok = await run(async () => {
      if (editingChargeId) await updatePlanCharge(po.id, editingChargeId, row);
      else await createPlanCharge(po.id, row);
      await reloadPlan();
    }, 'Could not save the charge.');
    if (ok) {
      setShowChargeModal(false);
      setEditingChargeId(null);
    }
  };
  const handleDeleteCharge = async (cid) => {
    if (!window.confirm('Delete this charge?')) return;
    try {
      await deletePlanCharge(po.id, cid);
      await reloadPlan();
    } catch (err) {
      window.alert(errorMessage(err, 'Could not delete the charge.'));
    }
  };

  const handleDuplicate = async () => {
    try {
      const copy = await createPlan({
        ...po,
        status: 'Active',
        date: new Date().toISOString().slice(0, 10),
        charges: planCharges.map(({ type, description, rate, qty }) => ({ type, description, rate, qty })),
      });
      navigate(`/job-work/process-plan/${copy.id}`);
    } catch (err) {
      window.alert(errorMessage(err, 'Could not duplicate the process plan.'));
    }
  };

  // Throws on failure — ProcessPlanForm shows the error and stays open.
  const handleSave = async (values) => {
    const saved = await updatePlan(po.id, { ...po, ...values });
    setPo(saved);
    setShowEdit(false);
  };

  // Approval points (approve_jobwork on the server).
  const handleApprove = async () => {
    try { setPo(await approvePlan(po.id)); } catch (err) { window.alert(errorMessage(err, 'Could not approve the plan.')); }
  };
  const handleComplete = async () => {
    if (!window.confirm(`Mark ${po.planNo} as Completed?`)) return;
    try { setPo(await completePlan(po.id)); } catch (err) { window.alert(errorMessage(err, 'Could not complete the plan.')); }
  };

  const lossPct = Number(po.expectedLoss) || 0;
  const returnM = Number(po.expectedReturnQty) || Math.round(plannedM * (1 - lossPct / 100) * 100) / 100;
  const startDate = po.startDate || '';
  const completionDate = po.expectedCompletionDate || po.targetDate || '';
  const createdOn = po.created_at
    ? `${toDDMMYYYY(String(po.created_at).slice(0, 10))} ${new Date(po.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}`
    : '—';

  const contactPerson = po.contactPerson || '—';
  const phone = po.phone || '—';
  const email = po.email || '—';
  const address = po.address || '—';

  // Only orders actually linked to this plan.
  const relatedJwos = (jwos || []).filter((o) => o.processPlanId && String(o.processPlanId) === String(po.id));
  const linkedQty = relatedJwos.reduce((s, o) => s + (jwoKpis(o).totalOrdered || 0), 0);
  const linkedReceived = relatedJwos.reduce((s, o) => s + (jwoKpis(o).totalInward || 0), 0);
  const linkedPending = relatedJwos.reduce((s, o) => s + (jwoKpis(o).pending || 0), 0);
  const linkedAmt = relatedJwos.reduce((s, o) => s + (jwoKpis(o).totalAmount || 0), 0);

  // ── Timeline: derived from the plan + linked JWO records only ──
  const firstJWO = relatedJwos[0] || null;
  const firstOutward = (relatedJwos.flatMap((o) => o.outwards || []))[0] || null;
  const firstInward = (relatedJwos.flatMap((o) => o.inwards || []))[0] || null;
  const inwardPlanned = (firstJWO && firstJWO.expectedCompletion) || completionDate || '';
  const timelineStages = [
    { stage: 'Process Plan Created', planned: po.date || '', actual: (po.created_at ? String(po.created_at).slice(0, 10) : ''), status: 'Completed', remarks: '' },
    { stage: 'Job Work Order', planned: '', actual: (firstJWO && firstJWO.orderDate) || '', status: firstJWO ? 'Completed' : 'Pending', remarks: firstJWO ? `${firstJWO.jwoNo} created` : '' },
    { stage: 'Outward Challan', planned: (firstJWO && firstJWO.orderDate) || '', actual: (firstOutward && firstOutward.date) || '', status: firstOutward ? 'Completed' : 'Pending', remarks: firstOutward ? firstOutward.no : '' },
    { stage: 'Processing', planned: (firstOutward && firstOutward.date) || '', actual: '', status: firstOutward && !firstInward ? 'In Progress' : firstInward ? 'Completed' : 'Pending', remarks: '' },
    { stage: 'Inward Receipt', planned: inwardPlanned, actual: (firstInward && firstInward.date) || '', status: firstInward ? 'Completed' : 'Pending', remarks: firstInward ? firstInward.no : '' },
    { stage: 'Completion', planned: completionDate, actual: '', status: po.status === 'Completed' ? 'Completed' : 'Pending', remarks: '' },
  ];
  const timelinePill = (s) =>
    s === 'Completed'
      ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
      : s === 'In Progress'
        ? 'bg-blue-100 text-blue-600 border-blue-200'
        : 'bg-orange-100 text-orange-500 border-orange-200';

  // ── Material Requirement: the plan's material vs. what linked JWOs allocated ──
  const allocatedM = linkedQty;
  const materialRows = po.fabricItem || plannedM ? [{
    fabricItem: po.fabricItem || '',
    fabricQuality: po.fabricQuality || '',
    shade: po.shade || '',
    greyLotNo: po.greyLotNo || '',
    takaRollNo: po.takaRollNo || '',
    requiredQty: plannedM,
    allocatedQty: allocatedM,
    pendingQty: Math.max(0, plannedM - allocatedM),
  }] : [];

  const jwoStatusPill = (s) =>
    s === 'Completed' || s === 'Closed'
      ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
      : s === 'In-Process'
        ? 'bg-orange-50 text-orange-500 border-orange-200'
        : 'bg-amber-50 text-amber-600 border-amber-200';

  const handleCreateJWO = () => {
    setModalError('');
    setCreateForm({
      orderDate: new Date().toISOString().slice(0, 10),
      vendor: po.vendor || '',
      process: po.process || '',
      plannedQty: '',
      rate: '',
      expectedCompletion: po.expectedCompletionDate || '',
    });
    setShowCreateJWO(true);
  };

  const handleSaveCreateJWO = async (e) => {
    e?.preventDefault?.();
    setModalError('');
    if (!createForm.orderDate) { setModalError('Please enter the order date.'); return; }
    if (!createForm.vendor) { setModalError('Please select a vendor.'); return; }
    if (!createForm.process) { setModalError('Please select a process.'); return; }
    const qty = Number(createForm.plannedQty) || 0;
    const rate = Number(createForm.rate) || 0;
    if (!(qty > 0)) { setModalError('Quantity must be greater than 0.'); return; }
    if (rate < 0) { setModalError('Rate cannot be negative.'); return; }
    // The server allocates the JWO number and derives qty / amount from the material row.
    const ok = await run(async () => {
      await createJWO({
        processPlanId: po.id,
        process: createForm.process,
        vendor: createForm.vendor,
        orderDate: createForm.orderDate,
        rate,
        expectedCompletion: createForm.expectedCompletion || '',
        materials: [{
          fabricItem: po.fabricItem || '',
          fabricQuality: po.fabricQuality || '',
          shade: po.shade || '',
          lotNo: po.greyLotNo || '',
          qty,
          rate,
        }],
      });
      await reloadJwos();
    }, 'Could not create the job work order.');
    if (ok) {
      setShowCreateJWO(false);
      setTab('Job Work Orders');
    }
  };

  const openEditJWO = (o) => {
    setModalError('');
    setEditingJWO(o);
    setEditForm({
      orderDate: o.orderDate || '',
      vendor: o.vendor || '',
      process: o.process || '',
      rate: String(o.rate ?? ''),
      expectedCompletion: o.expectedCompletion || '',
      status: o.status || 'In-Process',
    });
  };

  // Header only — quantities change through the order's material / inward rows.
  const handleSaveEditJWO = async (e) => {
    e?.preventDefault?.();
    if (!editingJWO) return;
    const ok = await run(async () => {
      await updateJWOHeader(editingJWO.id, {
        orderDate: editForm.orderDate,
        vendor: editForm.vendor,
        process: editForm.process,
        rate: Number(editForm.rate) || 0,
        expectedCompletion: editForm.expectedCompletion,
        status: editForm.status,
      });
      await reloadJwos();
    }, 'Could not update the job work order.');
    if (ok) {
      setEditingJWO(null);
      setEditForm(null);
    }
  };

  const openAddTxn = (o) => {
    setModalError('');
    setAddingJWO(o);
    setAddForm({ type: 'outward', qty: '', date: new Date().toISOString().slice(0, 10) });
  };

  const handleSaveAddTxn = async (e) => {
    e?.preventDefault?.();
    if (!addingJWO) return;
    const qty = Number(addForm.qty) || 0;
    if (!(qty > 0)) { setModalError('Quantity must be greater than 0.'); return; }
    // Server allocates the challan / receipt number and validates quantities.
    const ok = await run(async () => {
      if (addForm.type === 'outward') {
        await createJWORow(addingJWO.id, 'outwards', { date: addForm.date, qty });
      } else {
        await createJWORow(addingJWO.id, 'inwards', { date: addForm.date, qty, rejected: 0 });
      }
      await reloadJwos();
    }, 'Could not add the transaction.');
    if (ok) setAddingJWO(null);
  };

  const vendorChoices = [...new Set([
    ...vendorOptions.map((v) => v.name),
    createForm.vendor, editForm?.vendor,
  ].filter(Boolean))];

  const modalErrorBox = modalError ? (
    <div className="col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600">{modalError}</div>
  ) : null;

  const summary = [
    ['Process', po.process || '—'],
    ['Vendor', po.vendor || '—'],
    ['Plan Date', toDDMMYYYY(po.date)],
    ['Planned Qty (M)', numIN(plannedM)],
    ['Expected Loss (%)', lossPct.toFixed(2)],
    ['Expected Return (M)', numIN(returnM)],
    ['Start Date', startDate ? toDDMMYYYY(startDate) : '—'],
    ['Completion Date', completionDate ? toDDMMYYYY(completionDate) : '—'],
  ];

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#f4f7fb] p-3 md:p-5 space-y-3.5">
      {/* Top Header */}
      <PageHeader
        title={`Process Plan Details - ${po.planNo}`}
        titleExtra={
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusPill(po.status)}`}>
            {po.status || '—'}
          </span>
        }
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'PMS', path: '/pms' },
          { label: 'Job Work / Processing' },
          { label: 'Process Plan', path: '/job-work/process-plan' },
          { label: po.planNo },
        ]}
        actions={
          <>
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8] transition-colors"
            >
              <Pencil size={13} /> Edit
            </button>
            {po.status === 'Draft' && (
              <button
                onClick={handleApprove}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-emerald-700 transition-colors"
              >
                Approve
              </button>
            )}
            {po.status === 'Active' && (
              <button
                onClick={handleComplete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-[12px] font-bold text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                Mark Completed
              </button>
            )}
            <button
              onClick={handleDuplicate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3.5 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Copy size={13} /> Duplicate
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3.5 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Printer size={13} /> Print
            </button>
          </>
        }
      />

      {/* Section 1 — Summary strip (separate card) */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
          {summary.map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] font-medium text-slate-400">{k}</p>
              <p className="mt-0.5 text-[13px] font-bold text-[#17294e]">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2 — Tabs + body (separate card) */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        {/* Tab Strip */}
        <div className="flex gap-5 overflow-x-auto border-b border-slate-100">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap pb-2 text-[12.5px] font-bold transition-colors ${
                tab === t ? 'border-b-2 border-[#2563eb] text-[#2563eb]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="mt-4">
          {tab === 'Plan Details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Basic Information */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <p className="text-[13.5px] font-extrabold text-[#17294e]">Basic Information</p>
                  <div className="mt-2">
                    <InfoRow label="Process Plan No." value={po.planNo} />
                    <InfoRow label="Plan Date" value={toDDMMYYYY(po.date)} />
                    <InfoRow label="Process" value={po.process || '—'} />
                    <InfoRow label="Process Category" value={po.processCategory || '—'} accent="text-amber-500" />
                    <InfoRow label="Status" value={po.status || '—'} accent="text-emerald-500" />
                    <InfoRow label="Assigned To" value={po.assignedEmployee || '—'} />
                    <InfoRow label="Approver" value={po.approver || '—'} />
                    <InfoRow label="Created On" value={createdOn} />
                  </div>
                </div>

                {/* Material Details */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <p className="text-[13.5px] font-extrabold text-[#2563eb]">Material Details</p>
                  <div className="mt-2">
                    <InfoRow label="Fabric Item" value={po.fabricItem || '—'} />
                    <InfoRow label="Fabric Quality" value={po.fabricQuality || '—'} />
                    <InfoRow label="Shade / Colour" value={po.shade || '—'} />
                    <InfoRow label="Grey Lot No." value={po.greyLotNo || '—'} />
                    <InfoRow label="Taka / Roll No." value={po.takaRollNo || '—'} />
                    <InfoRow label="Weight (KG)" value={po.weight ? numIN(po.weight) : '—'} />
                    <InfoRow label="No. of Rolls" value={po.noOfRolls || '—'} />
                  </div>
                </div>

                {/* Vendor Details */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <p className="text-[13.5px] font-extrabold text-[#2563eb]">Vendor Details</p>
                  <div className="mt-2">
                    <InfoRow label="Vendor" value={po.vendor || '—'} />
                    <InfoRow label="Contact Person" value={contactPerson} />
                    <InfoRow label="Phone" value={phone} />
                    <InfoRow label="Email" value={email} />
                    <InfoRow label="Address" value={address} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Quantity & Planning */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 lg:col-span-2">
                  <p className="text-[13.5px] font-extrabold text-[#2563eb]">Quantity &amp; Planning</p>
                  <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
                    {[
                      ['Planned Quantity (M)', numIN(plannedM)],
                      ['Expected Loss (%)', lossPct.toFixed(2)],
                      ['Expected Return (M)', numIN(returnM)],
                      ['Start Date', startDate ? toDDMMYYYY(startDate) : '—'],
                      ['Completion Date', completionDate ? toDDMMYYYY(completionDate) : '—'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[11px] font-medium text-slate-400">{k}</p>
                        <p className="mt-0.5 text-[14px] font-extrabold text-[#17294e]">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Remarks */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                  <p className="text-[13.5px] font-extrabold text-[#2563eb]">Remarks</p>
                  <p className="mt-2 text-[12.5px] font-medium leading-6 text-slate-600">
                    {po.remarks || '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'Job Work Orders' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Linked Job Work Orders</h3>
                <button
                  onClick={handleCreateJWO}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
                >
                  <Plus size={14} /> Create Job Work Order
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full min-w-[1180px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
                      <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                      <th className="px-3.5 py-2.5">JWO No.</th>
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Vendor</th>
                      <th className="px-3.5 py-2.5">Process</th>
                      <th className="px-3.5 py-2.5 text-right">Quantity (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Received (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Pending (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Rate (₹/M)</th>
                      <th className="px-3.5 py-2.5 text-right">Amount (₹)</th>
                      <th className="px-3.5 py-2.5">Exp. Completion</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                      <th className="px-3.5 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedJwos.length === 0 && (
                      <tr>
                        <td colSpan={13} className="px-3.5 py-8 text-center text-[12px] text-slate-400">
                          No job work orders linked to {po.planNo} yet.
                        </td>
                      </tr>
                    )}
                    {relatedJwos.map((o, i) => {
                      const k = jwoKpis(o);
                      return (
                      <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3.5 py-3 text-center text-slate-500">{i + 1}</td>
                        <td className="px-3.5 py-3">
                          <button onClick={() => navigate(`/job-work/orders/${o.id}`)} className="font-mono font-bold text-blue-600 hover:underline">
                            {o.jwoNo}
                          </button>
                        </td>
                        <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">{toDDMMYYYY(o.orderDate)}</td>
                        <td className="px-3.5 py-3 text-slate-600">{o.vendor}</td>
                        <td className="px-3.5 py-3 text-slate-600">{o.process}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{numIN(k.totalOrdered)}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{numIN(k.totalInward)}</td>
                        <td className="px-3.5 py-3 text-right font-mono font-bold text-amber-600">{numIN(k.pending)}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{Number(o.rate || 0).toFixed(2)}</td>
                        <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800">{numIN(k.totalAmount)}</td>
                        <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">{o.expectedCompletion ? toDDMMYYYY(o.expectedCompletion) : '—'}</td>
                        <td className="px-3.5 py-3 text-center">
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${jwoStatusPill(o.status)}`}>
                            {o.status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setViewingJWO(o)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="View">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => openEditJWO(o)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => openAddTxn(o)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="Add">
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {relatedJwos.length > 0 && (
                      <tr className="bg-slate-50/70 font-extrabold text-[#17294e]">
                        <td className="px-3.5 py-2.5 text-center" colSpan={5}>Total</td>
                        <td className="px-3.5 py-2.5 text-right font-mono">{numIN(linkedQty)}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono">{numIN(linkedReceived)}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono">{numIN(linkedPending)}</td>
                        <td className="px-3.5 py-2.5" />
                        <td className="px-3.5 py-2.5 text-right font-mono">{numIN(linkedAmt)}</td>
                        <td className="px-3.5 py-2.5" />
                        <td colSpan={2} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'Remarks' && (
            <div className="rounded-xl border border-slate-200/80 bg-white p-4">
              <p className="text-[13.5px] font-extrabold text-[#2563eb]">Remarks</p>
              <p className="mt-2 text-[12.5px] font-medium leading-6 text-slate-600">
                {po.remarks || '—'}
              </p>
            </div>
          )}

          {tab === 'Material Requirement' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Material Requirement</h3>
<span className="text-[11.5px] text-slate-400">Allocated = quantity on linked job work orders</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full min-w-[1080px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
                      <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                      <th className="px-3.5 py-2.5">Fabric Item</th>
                      <th className="px-3.5 py-2.5">Fabric Quality</th>
                      <th className="px-3.5 py-2.5">Shade / Colour</th>
                      <th className="px-3.5 py-2.5">Grey Lot No.</th>
                      <th className="px-3.5 py-2.5">Taka / Roll</th>
                      <th className="px-3.5 py-2.5 text-right">Required Qty (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Allocated Qty (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Pending Qty (M)</th>
                      <th className="px-3.5 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialRows.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-3.5 py-8 text-center text-[12px] text-slate-400">
                          No material on this plan yet.
                        </td>
                      </tr>
                    )}
                    {materialRows.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3.5 py-3 text-center text-slate-500">{i + 1}</td>
                        <td className="px-3.5 py-3 text-slate-700">{r.fabricItem || '—'}</td>
                        <td className="px-3.5 py-3 text-slate-700">{r.fabricQuality || '—'}</td>
                        <td className="px-3.5 py-3 text-slate-700">{r.shade || '—'}</td>
                        <td className="px-3.5 py-3 font-mono text-slate-700">{r.greyLotNo || '—'}</td>
                        <td className="px-3.5 py-3 font-mono text-slate-700">{r.takaRollNo || '—'}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{numIN(r.requiredQty)}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{numIN(r.allocatedQty)}</td>
                        <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800">{numIN(r.pendingQty)}</td>
                        <td className="px-3.5 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setViewingMaterial(r)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="View">
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'Timeline' && (
            <div className="space-y-3">
              <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Timeline</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full min-w-[900px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
                      <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                      <th className="px-3.5 py-2.5">Stage</th>
                      <th className="px-3.5 py-2.5">Planned Date</th>
                      <th className="px-3.5 py-2.5">Actual Date</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                      <th className="px-3.5 py-2.5">Remarks</th>
                      <th className="px-3.5 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineStages.map((s, i) => (
                      <tr key={s.stage} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3.5 py-3 text-center text-slate-500">{i + 1}</td>
                        <td className="px-3.5 py-3 text-slate-700">{s.stage}</td>
                        <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">{s.planned ? toDDMMYYYY(s.planned) : '–'}</td>
                        <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">{s.actual ? toDDMMYYYY(s.actual) : '-'}</td>
                        <td className="px-3.5 py-3 text-center">
                          <span className={`inline-block min-w-[92px] rounded-lg border px-3 py-1 text-[11px] font-bold ${timelinePill(s.status)}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-slate-600">{s.remarks || '-'}</td>
                        <td className="px-3.5 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setViewingStage({ ...s, idx: i })} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="View">
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'Charges' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Processing Charges</h3>
                <button
                  onClick={openAddCharge}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
                >
                  <Plus size={14} /> Add Charge
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                <table className="w-full min-w-[860px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
                      <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                      <th className="px-3.5 py-2.5">Charge Type</th>
                      <th className="px-3.5 py-2.5">Description</th>
                      <th className="px-3.5 py-2.5 text-right">Rate (₹/M)</th>
                      <th className="px-3.5 py-2.5 text-right">Quantity (M)</th>
                      <th className="px-3.5 py-2.5 text-right">Amount (₹)</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                      <th className="px-3.5 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planCharges.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3.5 py-8 text-center text-[12px] text-slate-400">
                          No charges added yet. Click "+ Add Charge" above.
                        </td>
                      </tr>
                    )}
                    {planCharges.map((c, i) => (
                      <tr key={c.id || i} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-3.5 py-3 text-center text-slate-500">{i + 1}</td>
                        <td className="px-3.5 py-3 font-semibold text-slate-800">{c.type}</td>
                        <td className="px-3.5 py-3 text-slate-600">{c.description || '—'}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{Number(c.rate || 0).toFixed(2)}</td>
                        <td className="px-3.5 py-3 text-right font-mono text-slate-700">{numIN(c.qty)}</td>
                        <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-800">{numIN(c.amount)}</td>
                        <td className="px-3.5 py-3 text-center">
                          <span className="inline-block rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-600">
                            {c.status || 'Active'}
                          </span>
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setViewingCharge(c)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="View">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => openEditCharge(c)} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeleteCharge(c.id)} className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab !== 'Plan Details' && tab !== 'Job Work Orders' && tab !== 'Material Requirement' && tab !== 'Timeline' && tab !== 'Charges' && tab !== 'Remarks' && (
            <div className="rounded-lg bg-slate-50 px-4 py-12 text-center">
              <p className="text-[13px] font-extrabold text-[#17294e]">No records found</p>
              <p className="mt-1 text-[11.5px] text-slate-400">There is no {tab} data for {po.planNo} yet.</p>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <ProcessPlanForm
          title={`Edit Process Plan — ${po.planNo}`}
          initial={po}
          isEdit={true}
          isModal={true}
          onSave={handleSave}
          onClose={() => setShowEdit(false)}
        />
      )}

      {showChargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">
                {editingChargeId ? 'Edit Charge' : 'Add Charge'} — {po.planNo}
              </h3>
              <button
                onClick={() => setShowChargeModal(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveCharge} className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <div className="col-span-2">
                <label className="mb-1 block font-semibold text-slate-600">Charge Type *</label>
                <input
                  required
                  value={chargeForm.type}
                  onChange={(e) => setChargeForm({ ...chargeForm, type: e.target.value })}
                  placeholder="e.g. Dyeing Charge"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block font-semibold text-slate-600">Description</label>
                <input
                  value={chargeForm.description}
                  onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                  placeholder="e.g. Dyeing Processing"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Rate (₹/M) *</label>
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  value={chargeForm.rate}
                  onChange={(e) => setChargeForm({ ...chargeForm, rate: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right font-mono outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Quantity (M) *</label>
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  value={chargeForm.qty}
                  onChange={(e) => setChargeForm({ ...chargeForm, qty: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right font-mono outline-none focus:border-blue-400"
                />
              </div>
              <div className="col-span-2 rounded-lg bg-slate-50 px-3 py-2.5 text-right text-[13px] font-extrabold text-[#17294e]">
                Amount: ₹ {numIN((Number(chargeForm.qty) || 0) * (Number(chargeForm.rate) || 0))}
              </div>
              {modalErrorBox}
              <div className="col-span-2 flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowChargeModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563eb] px-5 py-2 font-bold text-white hover:bg-[#1d4ed8]"
                >
                  {editingChargeId ? 'Update Charge' : 'Add Charge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs" onClick={() => setViewingCharge(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">{viewingCharge.type}</h3>
              <button
                onClick={() => setViewingCharge(null)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 space-y-1.5 text-[12.5px]">
              <InfoRow label="Description" value={viewingCharge.description || '—'} />
              <InfoRow label="Rate (₹/M)" value={Number(viewingCharge.rate || 0).toFixed(2)} />
              <InfoRow label="Quantity (M)" value={numIN(viewingCharge.qty)} />
              <InfoRow label="Amount (₹)" value={numIN(viewingCharge.amount)} />
              <InfoRow label="Status" value={viewingCharge.status || 'Active'} accent="text-emerald-600" />
            </div>
          </div>
        </div>
      )}

      {showCreateJWO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Create Job Work Order — {po.planNo}</h3>
              <button
                onClick={() => setShowCreateJWO(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveCreateJWO} className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <label className="mb-1 block font-semibold text-slate-600">JWO No.</label>
                <input readOnly value="" placeholder="Auto-generated on save" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono outline-none" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Date</label>
                <input
                  type="date"
                  required
                  value={createForm.orderDate}
                  onChange={(e) => setCreateForm({ ...createForm, orderDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block font-semibold text-slate-600">Vendor</label>
                  <MasterSourceLink source="vendors" />
                </div>
                <select
                  required
                  value={createForm.vendor}
                  onChange={(e) => setCreateForm({ ...createForm, vendor: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                >
                  <option value="">Select vendor</option>
                  {vendorChoices.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block font-semibold text-slate-600">Process</label>
                  <MasterSourceLink source="processes" />
                </div>
                <select
                  required
                  value={createForm.process}
                  onChange={(e) => setCreateForm({ ...createForm, process: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                >
                  <option value="">Select process</option>
                  {[...new Set([...(masterProcesses?.map((p) => p.name) || []), ...(PROCESS_OPTIONS || []), po.process].filter(Boolean))].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Quantity (M)</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={createForm.plannedQty}
                  onChange={(e) => setCreateForm({ ...createForm, plannedQty: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Rate (₹/M)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={createForm.rate}
                  onChange={(e) => setCreateForm({ ...createForm, rate: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Amount (₹)</label>
                <input
                  readOnly
                  placeholder="Auto"
                  value={createForm.plannedQty && createForm.rate ? numIN((Number(createForm.plannedQty) || 0) * (Number(createForm.rate) || 0)) : ''}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Expected Completion</label>
                <input
                  type="date"
                  value={createForm.expectedCompletion}
                  onChange={(e) => setCreateForm({ ...createForm, expectedCompletion: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              {modalErrorBox}
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateJWO(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingJWO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Job Work Order — {viewingJWO.jwoNo}</h3>
              <button onClick={() => setViewingJWO(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              {[['JWO No.', viewingJWO.jwoNo], ['Date', toDDMMYYYY(viewingJWO.orderDate)], ['Vendor', viewingJWO.vendor], ['Process', viewingJWO.process], ['Quantity (M)', numIN(jwoKpis(viewingJWO).totalOrdered)], ['Received (M)', numIN(jwoKpis(viewingJWO).totalInward)], ['Pending (M)', numIN(jwoKpis(viewingJWO).pending)], ['Rate (₹/M)', Number(viewingJWO.rate || 0).toFixed(2)], ['Amount (₹)', numIN(jwoKpis(viewingJWO).totalAmount)], ['Exp. Completion', viewingJWO.expectedCompletion ? toDDMMYYYY(viewingJWO.expectedCompletion) : '—'], ['Status', viewingJWO.status]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-slate-400">{k}</p>
                  <p className="mt-0.5 text-[13px] font-bold text-[#17294e]">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setViewingJWO(null); navigate(`/job-work/orders/${viewingJWO.id}`); }} className="rounded-lg bg-[#2563eb] px-4 py-1.5 text-[12px] font-bold text-white hover:bg-[#1d4ed8]">
                Open Full Details
              </button>
            </div>
          </div>
        </div>
      )}

      {editingJWO && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Edit Job Work Order — {editingJWO.jwoNo}</h3>
              <button onClick={() => { setEditingJWO(null); setEditForm(null); }} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEditJWO} className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <label className="mb-1 block font-semibold text-slate-600">JWO No.</label>
                <input readOnly value={editingJWO.jwoNo} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono outline-none" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Date</label>
                <input type="date" required value={editForm.orderDate} onChange={(e) => setEditForm({ ...editForm, orderDate: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block font-semibold text-slate-600">Vendor</label>
                  <MasterSourceLink source="vendors" />
                </div>
                <select value={editForm.vendor} onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400">
                  {vendorChoices.map((v) => (<option key={v} value={v}>{v}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Process</label>
                <select value={editForm.process} onChange={(e) => setEditForm({ ...editForm, process: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400">
                  {[...new Set([...(PROCESS_OPTIONS || []), editForm.process].filter(Boolean))].map((p) => (<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Quantity (M)</label>
                <input readOnly value={numIN(jwoKpis(editingJWO).totalOrdered)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono outline-none" title="Edit material rows on the order to change quantity" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Received (M)</label>
                <input readOnly value={numIN(jwoKpis(editingJWO).totalInward)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono outline-none" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Rate (₹/M)</label>
                <input type="number" required min="0" step="0.01" value={editForm.rate} onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400">
                  {['Draft', 'In-Process', 'Completed', 'Closed'].map((s) => (<option key={s}>{s}</option>))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block font-semibold text-slate-600">Expected Completion</label>
                <input type="date" value={editForm.expectedCompletion} onChange={(e) => setEditForm({ ...editForm, expectedCompletion: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
              </div>
              {modalErrorBox}
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setEditingJWO(null); setEditForm(null); }} className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-50">
                  {busy ? 'Saving…' : 'Update Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addingJWO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Add Transaction — {addingJWO.jwoNo}</h3>
              <button onClick={() => setAddingJWO(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveAddTxn} className="mt-4 space-y-3 text-[12px]">
              <div>
                <label className="mb-1 block font-semibold text-slate-600">Type</label>
                <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400">
                  <option value="outward">Outward Challan (dispatched)</option>
                  <option value="inward">Inward Receipt (received)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-600">Date</label>
                  <input type="date" required value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-600">Quantity (M)</label>
                  <input type="number" required min="0.01" step="0.01" value={addForm.qty} onChange={(e) => setAddForm({ ...addForm, qty: e.target.value })} placeholder="e.g. 500" className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400" />
                </div>
              </div>
              {modalError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600">{modalError}</div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAddingJWO(null)} className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]">
                  Add {addForm.type === 'outward' ? 'Outward' : 'Inward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Material — {viewingMaterial.fabricItem}</h3>
              <button onClick={() => setViewingMaterial(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              {[['Fabric Item', viewingMaterial.fabricItem], ['Fabric Quality', viewingMaterial.fabricQuality], ['Shade / Colour', viewingMaterial.shade], ['Grey Lot No.', viewingMaterial.greyLotNo], ['Taka / Roll', viewingMaterial.takaRollNo], ['Required Qty (M)', numIN(viewingMaterial.requiredQty)], ['Available Qty (M)', numIN(viewingMaterial.availableQty)], ['Allocated Qty (M)', numIN(viewingMaterial.allocatedQty)], ['Pending Qty (M)', numIN(Math.max(0, (Number(viewingMaterial.requiredQty) || 0) - (Number(viewingMaterial.allocatedQty) || 0)))]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-slate-400">{k}</p>
                  <p className="mt-0.5 text-[13px] font-bold text-[#17294e]">{v || '—'}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setViewingMaterial(null)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">{viewingStage.stage}</h3>
              <button onClick={() => setViewingStage(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              {[['Stage', viewingStage.stage], ['Status', viewingStage.status], ['Planned Date', viewingStage.planned ? toDDMMYYYY(viewingStage.planned) : '–'], ['Actual Date', viewingStage.actual ? toDDMMYYYY(viewingStage.actual) : '-'], ['Remarks', viewingStage.remarks || '-']].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-slate-400">{k}</p>
                  <p className="mt-0.5 text-[13px] font-bold text-[#17294e]">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setViewingStage(null)} className="rounded-lg border border-slate-200 px-4 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
