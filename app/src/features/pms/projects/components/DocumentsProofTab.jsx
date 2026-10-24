import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Image,
  IndianRupee,
  Layers,
  Link2,
  Package,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Tag,
  Truck,
  Upload,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Modal } from '../../../../components/ui/Modal';
import { EmptyStatePms } from '../../components/EmptyStatePms';
import { ProofViewer } from '../../components/ProofViewer';
import { ClientApprovalModal } from '../../components/ClientApprovalModal';
import { ShareProofModal } from '../../approval/ShareProofModal';
import { UploadProofModal } from './UploadProofModal';
import { usePmsStore, getProofWorkflowState } from '../../../../stores/pmsStore';
import {
  fetchInventoryDocumentsData,
  sendProjectDocumentToClient,
  generateProjectDocumentLink,
  recordClientDocumentDecision,
  errorMessage,
} from '../../../../services/jobWorkSync';

const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const APPROVAL_TONES = {
  Approved: { bg: '#d1fae5', fg: '#065f46', icon: Check },
  Pending: { bg: '#fef3c7', fg: '#92400e', icon: Clock },
  'Need Improvement': { bg: '#ffedd5', fg: '#9a3412', icon: RefreshCw },
  'Changes Requested': { bg: '#ffedd5', fg: '#9a3412', icon: RefreshCw },
  Rejected: { bg: '#fee2e2', fg: '#b91c1c', icon: XCircle },
};

const STEP_COPY = {
  'awaiting-upload': { label: 'Awaiting first proof', tone: '#64748b' },
  'pm-review': { label: 'With the PM for review', tone: '#3730a3' },
  'with-client': { label: 'Sent to client — awaiting decision', tone: '#92400e' },
  approved: { label: 'Approved — handoff unlocked', tone: '#065f46' },
  'needs-revision': { label: 'Revision requested — upload a new version', tone: '#9a3412' },
};

function stamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function DocumentsProofTab({ project }) {
  const requestApproval = usePmsStore((s) => s.requestApproval);
  const showToast = usePmsStore((s) => s.showToast);

  const proofStages = useMemo(
    () => [...(project.stages ?? [])].sort((a, b) => a.sequence - b.sequence),
    [project]
  );
  const stagesWithProofs = proofStages.filter((s) => (s.documents ?? []).length > 0);

  // Stage selection state: null represents "ALL" stages or active stage
  const [stageId, setStageId] = useState(null);
  const [versionId, setVersionId] = useState(null);

  // Sub-view navigation state: 'proofs' | 'register' | 'transactions' | 'inventory'
  const [activeSubTab, setActiveSubTab] = useState('proofs');

  // Modals
  const [uploadOpen, setUploadOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [viewDocModalOpen, setViewDocModalOpen] = useState(false);
  const [selectedDocForModal, setSelectedDocForModal] = useState(null);

  const [annotations, setAnnotations] = useState({});
  const [loading, setLoading] = useState(false);
  const [backendData, setBackendData] = useState(null);

  // Search & filter states
  const [docSearch, setDocSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');
  const [txSearch, setTxSearch] = useState('');
  const [txStageFilter, setTxStageFilter] = useState('ALL');
  const [takaSearch, setTakaSearch] = useState('');
  const [qcStatusFilter, setQcStatusFilter] = useState('ALL');

  // Load real backend data
  const loadBackendData = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    try {
      const res = await fetchInventoryDocumentsData(project.id);
      setBackendData(res);
    } catch (err) {
      console.warn('[DocumentsProofTab] Backend fetch fallback to store:', err);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    loadBackendData();
  }, [loadBackendData]);

  const activeStage =
    proofStages.find((s) => s.id === stageId) ??
    stagesWithProofs.find((s) => s.status === 'Need Improvement' || s.status === 'Under Review') ??
    stagesWithProofs[0] ??
    proofStages.find((s) => s.status !== 'Completed') ??
    proofStages[0] ??
    null;

  const workflow = useMemo(
    () => (activeStage ? getProofWorkflowState(activeStage) : null),
    [activeStage]
  );

  const versions = useMemo(
    () => [...(activeStage?.documents ?? [])].sort((a, b) => b.version - a.version),
    [activeStage]
  );
  const selected = versions.find((v) => v.id === versionId) ?? versions[0] ?? null;

  // Follow the newest version when a fresh one is uploaded
  useEffect(() => {
    if (versions.length > 0 && !versions.some((v) => v.id === versionId)) {
      setVersionId(versions[0].id);
    }
  }, [versions, versionId]);

  // Extract documents from backend or project stages
  const allBackendDocs = useMemo(() => {
    if (backendData?.documents?.length > 0) return backendData.documents;
    // Fallback extract from project stages
    const result = [];
    (project.stages ?? []).forEach((stg) => {
      (stg.documents ?? []).forEach((d) => {
        result.push({
          id: d.id,
          fileName: d.fileName || d.file_name || 'Document',
          fileSize: d.fileSize || d.file_size || 0,
          previewUrl: d.previewUrl || d.preview_url || d.fileData || null,
          version: d.version || 1,
          docType: d.docType || d.doc_type || (d.is_proof ? 'Design Proof' : 'Document'),
          stageId: stg.id,
          stageName: stg.name,
          stageSeq: stg.sequence,
          uploadedBy: d.uploadedBy || { name: 'Admin' },
          uploadedAt: d.uploadedAt || d.uploaded_at || new Date().toISOString(),
          comments: d.comments || '',
          revisionReason: d.revisionReason || d.revision_reason || '',
          approvalStatus: d.approvalStatus || d.approval_status || 'Pending',
          isCurrent: d.is_current !== false,
          isProof: d.is_proof || false,
          sharingStatus: d.sharingStatus || 'Not Sent',
          shares: d.shares || [],
        });
      });
    });
    return result;
  }, [backendData, project]);

  // Filtered documents by stage, search, type
  const filteredDocuments = useMemo(() => {
    return allBackendDocs.filter((d) => {
      if (stageId && stageId !== 'ALL' && d.stageId !== stageId) return false;
      if (docTypeFilter !== 'ALL' && d.docType !== docTypeFilter) return false;
      if (docSearch.trim()) {
        const q = docSearch.toLowerCase();
        const fn = (d.fileName || '').toLowerCase();
        const cm = (d.comments || '').toLowerCase();
        const sn = (d.stageName || '').toLowerCase();
        return fn.includes(q) || cm.includes(q) || sn.includes(q);
      }
      return true;
    });
  }, [allBackendDocs, stageId, docTypeFilter, docSearch]);

  // Linked ERP Transactions
  const linkedTransactions = useMemo(() => {
    return backendData?.linkedTransactions || [];
  }, [backendData]);

  const filteredTransactions = useMemo(() => {
    return linkedTransactions.filter((tx) => {
      if (txStageFilter !== 'ALL' && !tx.stageName.includes(txStageFilter)) return false;
      if (txSearch.trim()) {
        const q = txSearch.toLowerCase();
        const num = (tx.number || '').toLowerCase();
        const type = (tx.docType || '').toLowerCase();
        const party = (tx.party || '').toLowerCase();
        return num.includes(q) || type.includes(q) || party.includes(q);
      }
      return true;
    });
  }, [linkedTransactions, txStageFilter, txSearch]);

  // Inventory & Stock Traceability Data
  const inventorySummary = useMemo(() => {
    return (
      backendData?.inventory?.summary || {
        targetRequirementMeters: Number(project.requirement_meters || project.quantity || 3000),
        greyAllocatedMeters: Number(project.grey_allocated_meters || 0),
        wipAtProcessorsMeters: Number(project.dyeing_sent_meters || 0),
        fgReceivedMeters: Number(project.customer_project_received_meters || 0),
        qcPassedMeters: Number(project.customer_project_received_meters || 0),
        dispatchedMeters: 0,
        customerAllocatedMeters: Number(project.customer_project_received_meters || 0),
        ownAllocatedMeters: Number(project.own_project_received_meters || 0),
        availableUnallocatedMeters: Number(project.customer_project_received_meters || 0),
        uom: 'Meters',
      }
    );
  }, [backendData, project]);

  const traceableLots = useMemo(() => {
    return backendData?.inventory?.traceableLots || [];
  }, [backendData]);

  const filteredTraceableLots = useMemo(() => {
    return traceableLots.filter((lot) => {
      if (qcStatusFilter !== 'ALL' && lot.qcStatus !== qcStatusFilter) return false;
      if (takaSearch.trim()) {
        const q = takaSearch.toLowerCase();
        const ln = (lot.lotNumber || '').toLowerCase();
        const tn = (lot.takaNumber || '').toLowerCase();
        const fi = (lot.fabricItem || '').toLowerCase();
        const po = (lot.sourcePO || '').toLowerCase();
        return ln.includes(q) || tn.includes(q) || fi.includes(q) || po.includes(q);
      }
      return true;
    });
  }, [traceableLots, qcStatusFilter, takaSearch]);

  // Send to client action
  const handleSendToClient = async () => {
    if (!selected) return;
    try {
      await sendProjectDocumentToClient(project.id, {
        document_id: selected.id,
        approver_name: project.customerName || 'Client',
      });
      requestApproval(project.id, activeStage.id, selected.id, {
        approverName: project.customerName,
        actor: project.projectManager,
      });
      showToast?.(`v${selected.version}.0 sent to ${project.customerName || 'client'} for approval.`);
      await loadBackendData();
    } catch (err) {
      console.warn('handleSendToClient fallback:', err);
      requestApproval(project.id, activeStage.id, selected.id, {
        approverName: project.customerName,
        actor: project.projectManager,
      });
      showToast?.(`Sent to client for approval.`);
    }
  };

  // View document in modal
  const handleOpenDocModal = (doc) => {
    setSelectedDocForModal(doc);
    setViewDocModalOpen(true);
  };

  // Download document
  const handleDownloadDoc = (doc) => {
    const url = doc.previewUrl || doc.fileData;
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      showToast?.('Direct download link unavailable. Opening viewer.', 'info');
      handleOpenDocModal(doc);
    }
  };

  if (proofStages.length === 0) {
    return (
      <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
        <EmptyStatePms variant="documents" />
      </div>
    );
  }

  const step = workflow ? STEP_COPY[workflow.step] : null;
  const isClosed = project.status === 'Completed';

  return (
    <div className="space-y-4">
      {/* 1. STAGE SELECTOR + WORKFLOW STATE (Exact preserved layout) */}
      <section className="rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Layers size={14} className="text-slate-400 shrink-0" />
            <label className="text-[11px] font-semibold text-slate-600" htmlFor="proof-stage">
              Stage
            </label>
            <select
              id="proof-stage"
              className="text-xs rounded-lg border border-[#dce5f4] bg-white px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100"
              value={stageId ?? 'ALL'}
              onChange={(e) => {
                const val = e.target.value;
                setStageId(val === 'ALL' ? null : val);
                setVersionId(null);
              }}
            >
              <option value="ALL">All Stages (All Project Documents & Traceability)</option>
              {proofStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sequence}. {s.name}
                  {(s.documents ?? []).length > 0 ? ` (${s.documents.length})` : ''}
                </option>
              ))}
            </select>
          </div>

          {step && (
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5"
              style={{ background: `${step.tone}1a`, color: step.tone }}
              data-test="proof-step"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: step.tone }} />
              {step.label}
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              icon={Upload}
              onClick={() => setUploadOpen(true)}
              disabled={isClosed}
            >
              Upload New Version
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={Send}
              disabled={isClosed || !workflow?.canSendToClient || !selected}
              title={
                workflow?.canSendToClient
                  ? 'Circulate this version to the client'
                  : 'Available once a version is uploaded and not yet circulated'
              }
              onClick={handleSendToClient}
            >
              Send to Client
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={Link2}
              disabled={isClosed || !selected}
              title={
                selected
                  ? 'Generate a shareable client approval link for this version'
                  : 'Upload a version first'
              }
              onClick={() => setShareOpen(true)}
            >
              Generate Link
            </Button>
            <Button
              size="sm"
              icon={ShieldCheck}
              disabled={isClosed || !workflow?.canDecide}
              title={
                workflow?.canDecide
                  ? 'Open the client approval simulator'
                  : 'Available once the proof has been sent to the client'
              }
              onClick={() => setApprovalOpen(true)}
            >
              Client Approval Portal
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={RefreshCw}
              onClick={loadBackendData}
              disabled={loading}
              title="Refresh inventory and documents"
            />
          </div>
        </div>

        {workflow?.needsRevision && (
          <p className="flex items-start gap-1.5 text-[11px] text-orange-800 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-3">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>
              <strong>Revision requested:</strong> {workflow.latest?.revisionReason} — upload
              v{(workflow.latest?.version ?? 0) + 1}.0 to continue.
            </span>
          </p>
        )}
      </section>

      {/* 2. COMMERCIAL & INVENTORY KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Project Target</span>
            <Package size={14} className="text-blue-600" />
          </div>
          <div className="text-base font-bold font-mono text-slate-900">
            {n(inventorySummary.targetRequirementMeters)} <span className="text-[10px] text-slate-400 font-sans">M</span>
          </div>
          <div className="text-[10px] text-slate-500 truncate" title={project.product_name}>
            {project.product_name || 'Finished Fabric'}
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Grey Allocated</span>
            <Boxes size={14} className="text-indigo-600" />
          </div>
          <div className="text-base font-bold font-mono text-indigo-700">
            {n(inventorySummary.greyAllocatedMeters)} <span className="text-[10px] text-slate-400 font-sans">M</span>
          </div>
          <div className="text-[10px] text-indigo-600 font-medium">Stage 1 Grey Check</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">WIP at Mill</span>
            <Clock size={14} className="text-amber-600" />
          </div>
          <div className="text-base font-bold font-mono text-amber-700">
            {n(inventorySummary.wipAtProcessorsMeters)} <span className="text-[10px] text-slate-400 font-sans">M</span>
          </div>
          <div className="text-[10px] text-slate-500">
            {n(inventorySummary.fgReceivedMeters)} M received back
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">QC Passed (FG)</span>
            <ShieldCheck size={14} className="text-emerald-600" />
          </div>
          <div className="text-base font-bold font-mono text-emerald-700">
            {n(inventorySummary.qcPassedMeters)} <span className="text-[10px] text-slate-400 font-sans">M</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-medium">Ready for Dispatch</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Dispatched Qty</span>
            <Truck size={14} className="text-blue-600" />
          </div>
          <div className="text-base font-bold font-mono text-blue-700">
            {n(inventorySummary.dispatchedMeters)} <span className="text-[10px] text-slate-400 font-sans">M</span>
          </div>
          <div className="text-[10px] text-slate-500">Stage 16 Challans</div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Project Files</span>
            <FileText size={14} className="text-purple-600" />
          </div>
          <div className="text-base font-bold font-mono text-purple-700">
            {allBackendDocs.length} <span className="text-[10px] text-slate-400 font-sans">Docs</span>
          </div>
          <div className="text-[10px] text-purple-600 font-medium">
            {linkedTransactions.length} linked ERP vouchers
          </div>
        </div>
      </div>

      {/* 3. SUB-VIEW SEGMENTED CONTROL */}
      <div className="flex border-b border-[#dce5f4] gap-2 overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveSubTab('proofs')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'proofs'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Image size={14} />
          <span>Design Proofs & Visual Inspection</span>
          {versions.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-700 font-mono">
              v{versions[0]?.version}.0
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('register')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'register'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText size={14} />
          <span>Stage Documents & Proof Register</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
            {filteredDocuments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('transactions')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'transactions'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Boxes size={14} />
          <span>ERP Transaction Lineage & Vouchers</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-700 font-mono">
            {linkedTransactions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('inventory')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'inventory'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={14} />
          <span>Inventory & Stock Traceability</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-mono">
            {traceableLots.length}
          </span>
        </button>
      </div>

      {/* 4. SUB-TAB 1: DESIGN PROOFS & VIEWER (Original preserved layout) */}
      {activeSubTab === 'proofs' && (
        <>
          {versions.length === 0 ? (
            <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
              <EmptyStatePms
                variant="documents"
                title="No proofs on this stage yet"
                description="Upload the first version to start the client approval chain."
                action={
                  <Button icon={Upload} onClick={() => setUploadOpen(true)} disabled={isClosed}>
                    Upload New Version
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-4">
              {/* Version history rail */}
              <aside className="rounded-xl border border-[#dce5f4] bg-white p-3 shadow-2xs h-fit">
                <header className="flex items-center justify-between mb-2.5">
                  <h3 className="text-[11px] font-bold text-slate-700">Version History</h3>
                  <span className="text-[10px] text-slate-400">{versions.length}</span>
                </header>

                <ol className="space-y-1.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {versions.map((v) => {
                    const tone = APPROVAL_TONES[v.approvalStatus] ?? APPROVAL_TONES.Pending;
                    const Icon = tone.icon;
                    const isActive = v.id === selected?.id;
                    const isLatest = v.version === versions[0].version;

                    return (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setVersionId(v.id)}
                          aria-current={isActive}
                          className="w-full text-left rounded-lg border px-2.5 py-2 transition-colors"
                          style={
                            isActive
                              ? { borderColor: '#1f6bff', background: '#f6f9ff' }
                              : { borderColor: '#e8eef8', background: '#fff' }
                          }
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-800">v{v.version}.0</span>
                            {isLatest && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{stamp(v.uploadedAt)}</p>
                          <span
                            className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1"
                            style={{ background: tone.bg, color: tone.fg }}
                          >
                            <Icon size={9} strokeWidth={2.5} />
                            {v.approvalStatus}
                          </span>
                          {v.revisionReason && (
                            <p className="text-[10px] text-orange-700 mt-1 line-clamp-2" title={v.revisionReason}>
                              “{v.revisionReason}”
                            </p>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </aside>

              {/* Preview + comments */}
              <div className="space-y-3">
                <ProofViewer
                  document={selected}
                  projectName={project.productDetails?.productName}
                  annotations={annotations[selected?.id] ?? []}
                  onAddAnnotation={({ page, text }) =>
                    setAnnotations((prev) => ({
                      ...prev,
                      [selected.id]: [
                        ...(prev[selected.id] ?? []),
                        { id: `${Date.now()}`, page, text, author: project.projectManager?.name },
                      ],
                    }))
                  }
                />

                <div className="rounded-xl border border-[#dce5f4] bg-white p-3 shadow-2xs">
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      ['Uploaded by', selected?.uploadedBy?.name ?? 'Admin'],
                      ['Uploaded at', stamp(selected?.uploadedAt)],
                      ['Size', selected?.fileSize ? formatBytes(selected.fileSize) : '—'],
                      ['Status', selected?.approvalStatus ?? '—'],
                    ].map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-[10px] text-slate-400">{k}</dt>
                        <dd className="text-[11px] font-semibold text-slate-700 truncate" title={String(v)}>
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 5. SUB-TAB 2: STAGE DOCUMENTS & PROOFS REGISTER */}
      {activeSubTab === 'register' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by file name, stage, or remarks..."
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-100 focus:outline-none"
                />
              </div>

              <select
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value)}
                className="py-1.5 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Document Types</option>
                <option value="Design Proof">Design Proof</option>
                <option value="Fabric Photograph">Fabric Photograph</option>
                <option value="Shade Sample">Shade Sample</option>
                <option value="QC Inspection Report">QC Inspection Report</option>
                <option value="Processing Specification">Processing Specification</option>
                <option value="Delivery Challan">Delivery Challan</option>
                <option value="LR Transport Copy">LR Transport Copy</option>
                <option value="Inward Receipt">Inward Receipt</option>
                <option value="Vendor Bill">Vendor Bill</option>
                <option value="Sales / Tax Invoice">Sales / Tax Invoice</option>
              </select>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={Upload}
              onClick={() => setUploadOpen(true)}
              className="text-xs"
            >
              Upload Document
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Doc ID</th>
                    <th className="py-2.5 px-3">Document Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3 text-center">Version</th>
                    <th className="py-2.5 px-3">Uploaded By</th>
                    <th className="py-2.5 px-3">Upload Date</th>
                    <th className="py-2.5 px-3 text-center">Client Share</th>
                    <th className="py-2.5 px-3 text-center">Approval Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDocuments.length > 0 ? (
                    filteredDocuments.map((doc) => {
                      const tone = APPROVAL_TONES[doc.approvalStatus] ?? APPROVAL_TONES.Pending;
                      return (
                        <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {doc.id.slice(0, 8)}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <FileText size={14} className="text-blue-500 shrink-0" />
                              <span className="truncate max-w-xs" title={doc.fileName}>{doc.fileName}</span>
                            </div>
                            {doc.comments && (
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs" title={doc.comments}>
                                {doc.comments}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {doc.docType || 'Document'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-slate-700 font-medium">{doc.stageName}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              doc.isCurrent ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              v{doc.version}.0
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {doc.uploadedBy?.name || 'Admin'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {stamp(doc.uploadedAt)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                              doc.sharingStatus.includes('Active')
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : doc.sharingStatus.includes('Sent')
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-50 text-slate-500 border border-slate-200'
                            }`}>
                              {doc.sharingStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1"
                              style={{ background: tone.bg, color: tone.fg }}
                            >
                              {doc.approvalStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                            <Button
                              size="xs"
                              variant="ghost"
                              icon={Eye}
                              onClick={() => handleOpenDocModal(doc)}
                              title="View Document"
                            />
                            <Button
                              size="xs"
                              variant="ghost"
                              icon={Download}
                              onClick={() => handleDownloadDoc(doc)}
                              title="Download File"
                            />
                            <Button
                              size="xs"
                              variant="ghost"
                              icon={Upload}
                              onClick={() => setUploadOpen(true)}
                              title="Upload New Version"
                            />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No documents found matching criteria. Click "Upload Document" to register records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. SUB-TAB 3: ERP TRANSACTION DOCUMENTS & VOUCHERS */}
      {activeSubTab === 'transactions' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transaction voucher, stage, or party..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-100 focus:outline-none"
              />
            </div>

            <select
              value={txStageFilter}
              onChange={(e) => setTxStageFilter(e.target.value)}
              className="py-1.5 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Stages</option>
              <option value="Stage 2">Stage 2 — Supplier PO</option>
              <option value="Stage 3">Stage 3 — GRN Inward</option>
              <option value="Stage 5">Stage 5 — Grey QC</option>
              <option value="Stage 7">Stage 7 — Bill Matching</option>
              <option value="Stage 11">Stage 11 — Processing Plan</option>
              <option value="Stage 12">Stage 12 — Job Work Outward</option>
              <option value="Stage 14">Stage 14 — Job Work Inward</option>
              <option value="Stage 15">Stage 15 — FG QC & Allocation</option>
              <option value="Stage 16">Stage 16 — Customer Dispatch</option>
              <option value="Stage 17">Stage 17 — Invoice & Payment</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Voucher / Ref #</th>
                    <th className="py-2.5 px-3">Document Type</th>
                    <th className="py-2.5 px-3">Lifecycle Stage</th>
                    <th className="py-2.5 px-3">Party / Consignee</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Quantity / Value</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-purple-700">
                          {tx.number}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {tx.docType}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {tx.stageName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {tx.party}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {tx.docDate}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          {tx.docType.includes('Bill') || tx.docType.includes('Invoice')
                            ? `₹ ${n(tx.quantity)}`
                            : `${n(tx.quantity)} M`}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No transactions recorded yet for this project across PMS pipeline stages.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. SUB-TAB 4: INVENTORY & STOCK TRACEABILITY (Clearly Separated Section) */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
            <Layers size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Inventory Traceability Engine:</span> Trace finished and grey rolls through physical taka allocations, job work outward and inward receipts, 4-point QC disposition, and customer vs own project allocations.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search lot #, taka #, quality, or PO..."
                  value={takaSearch}
                  onChange={(e) => setTakaSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                />
              </div>

              <select
                value={qcStatusFilter}
                onChange={(e) => setQcStatusFilter(e.target.value)}
                className="py-1.5 px-3 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none"
              >
                <option value="ALL">All QC Dispositions</option>
                <option value="Passed">QC Passed</option>
                <option value="Pending">Pending Inspection</option>
                <option value="Hold">QC Hold</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Lot / Taka #</th>
                    <th className="py-2.5 px-3">Fabric Quality & Item</th>
                    <th className="py-2.5 px-3">Design / Shade</th>
                    <th className="py-2.5 px-3">Source PO / GRN</th>
                    <th className="py-2.5 px-3 text-right">Physical Qty</th>
                    <th className="py-2.5 px-3 text-right">Customer Alloc</th>
                    <th className="py-2.5 px-3">Plan / JWO Ref</th>
                    <th className="py-2.5 px-3">Outward / Inward Ref</th>
                    <th className="py-2.5 px-3 text-center">QC Status</th>
                    <th className="py-2.5 px-3">Current Location</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTraceableLots.length > 0 ? (
                    filteredTraceableLots.map((lot) => (
                      <tr key={lot.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                          {lot.lotNumber}
                          <span className="text-slate-400 font-sans ml-1">/ Roll #{lot.takaNumber}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{lot.fabricItem}</div>
                          <div className="text-[10px] text-slate-500">{lot.quality}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-slate-700">{lot.design}</span>
                          <span className="text-slate-400 font-sans ml-1">({lot.shade})</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {lot.sourcePO || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {n(lot.physicalQty)} {lot.uom}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {n(lot.customerProjectAllocated)} {lot.uom}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <div className="text-blue-700">{lot.processingPlanRef}</div>
                          <div className="text-slate-400">{lot.jwoRef}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <div className="text-slate-700">{lot.outwardChallanRef}</div>
                          <div className="text-emerald-700">{lot.inwardReceiptRef}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            lot.qcStatus === 'Passed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : lot.qcStatus === 'QC Hold' || lot.qcStatus === 'Hold'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {lot.qcStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">
                          {lot.location}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {lot.stockStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        No traceable inventory rolls recorded yet for this project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: VIEW DOCUMENT PREVIEW & DETAILS */}
      {viewDocModalOpen && selectedDocForModal && (
        <Modal
          isOpen={viewDocModalOpen}
          onClose={() => setViewDocModalOpen(false)}
          title={`Document: ${selectedDocForModal.fileName}`}
          subtitle={`${selectedDocForModal.docType || 'Document'} — Stage: ${selectedDocForModal.stageName || '—'}`}
          className="max-w-3xl"
        >
          <div className="space-y-4 text-xs">
            {selectedDocForModal.previewUrl ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center min-h-[300px] max-h-[500px]">
                {selectedDocForModal.fileType?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(selectedDocForModal.fileName) ? (
                  <img
                    src={selectedDocForModal.previewUrl}
                    alt={selectedDocForModal.fileName}
                    className="max-h-[450px] object-contain mx-auto"
                  />
                ) : (
                  <iframe
                    src={selectedDocForModal.previewUrl}
                    title={selectedDocForModal.fileName}
                    className="w-full h-[450px]"
                  />
                )}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400">
                <FileText size={36} className="mx-auto mb-2 text-slate-300" />
                <p>Preview not directly embedded. You can download this file below.</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block">Version</span>
                <span className="font-bold text-slate-800">v{selectedDocForModal.version}.0</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Uploaded By</span>
                <span className="font-bold text-slate-800">{selectedDocForModal.uploadedBy?.name || 'Admin'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Upload Date</span>
                <span className="font-semibold text-slate-700">{stamp(selectedDocForModal.uploadedAt)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Client Approval Status</span>
                <span className="font-bold text-emerald-700">{selectedDocForModal.approvalStatus}</span>
              </div>
            </div>

            {selectedDocForModal.comments && (
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-bold uppercase mb-0.5">Specifications & Notes</span>
                <p className="text-slate-700">{selectedDocForModal.comments}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setViewDocModalOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={() => handleDownloadDoc(selectedDocForModal)}
              >
                Download File
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 9. MODALS: Upload, Approval, Share (Existing preserved modals) */}
      <UploadProofModal
        isOpen={uploadOpen}
        project={project}
        stage={activeStage}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setVersionId(null);
          loadBackendData();
        }}
      />

      <ClientApprovalModal
        isOpen={approvalOpen}
        project={project}
        stage={activeStage}
        document={selected}
        onClose={() => setApprovalOpen(false)}
        onDecided={() => loadBackendData()}
      />

      <ShareProofModal
        isOpen={shareOpen}
        project={project}
        stage={activeStage}
        document={selected}
        canCirculate={workflow?.canSendToClient}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}

export default DocumentsProofTab;
