import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Info, GitBranch, History, ShieldCheck, Boxes, Package, Layers, Receipt, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { EmptyStatePms } from '../components/EmptyStatePms';
import { usePmsStore, getProjectRowMeta } from '../../../stores/pmsStore';
import { ProjectHeader } from './components/ProjectHeader';
import { ProjectInfoTab } from './components/ProjectInfoTab';
import { StageTimelineTab } from './components/StageTimelineTab';
import { ApprovalsTab } from './components/ApprovalsTab';
import { ActivityAuditTab } from './components/ActivityAuditTab';
import { DocumentsProofTab } from './components/DocumentsProofTab';
import {
  CustomerProjectTab,
  OwnProjectTab,
  PaymentDispatchTab,
} from './components/CustomerAndPaymentTabs';
import { CustomerReturnTab } from './components/CustomerReturnTab';
import { AssignStageModal } from './components/AssignStageModal';
import { StageHandoffModal } from '../components/StageHandoffModal';
import { CompleteProjectModal } from './components/CompleteProjectModal';
import { PrintProjectModal } from './components/PrintProjectModal';
import { ProductionLinkModal } from './components/ProductionLinkModal';
import { PmsToast } from '../components/PmsToast';

/**
 * ProjectDetailPage (/pms/projects/:id) — the project workspace.
 *
 * 9 tabs matching Oscar ERP reference specification:
 * Overview, Stage Timeline, Approvals, Inventory & Documents,
 * Customer Project, Own Project, Payment & Dispatch, Customer Return, Activity.
 */

const TABS = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'timeline', label: 'Stage Timeline', icon: GitBranch },
  { id: 'approvals', label: 'Approvals', icon: ShieldCheck },
  { id: 'inventory', label: 'Inventory & Documents', icon: Boxes },
  { id: 'customer_project', label: 'Customer Project', icon: Package },
  { id: 'own_project', label: 'Own Project', icon: Layers },
  { id: 'payment', label: 'Payment & Dispatch', icon: Receipt },
  { id: 'customer_return', label: 'Customer Return', icon: RotateCcw },
  { id: 'activity', label: 'Activity', icon: History },
];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const projects = usePmsStore((s) => s.projects);
  const stageConfigs = usePmsStore((s) => s.stageConfigs);
  const startStage = usePmsStore((s) => s.startStage);
  const setStageStatus = usePmsStore((s) => s.setStageStatus);
  const refreshProject = usePmsStore((s) => s.refreshProject);
  const removeProjectStage = usePmsStore((s) => s.removeProjectStage);
  const syncPipelineStages = usePmsStore((s) => s.syncPipelineStages);

  const [tab, setTab] = useState('timeline');
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [assignStageId, setAssignStageId] = useState(null); // null = closed
  const [handoffStageId, setHandoffStageId] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showProductionLink, setShowProductionLink] = useState(false);

  const project = useMemo(() => projects.find((p) => p.id === id || p.code === id) ?? null, [projects, id]);
  const meta = useMemo(() => (project ? getProjectRowMeta(project) : null), [project]);

  // Always refresh latest stages and pipeline routing from server on load
  React.useEffect(() => {
    const targetId = project?.id || id;
    if (targetId) {
      refreshProject(targetId);
    }
  }, [id, project?.id, refreshProject]);

  const counts = useMemo(() => {
    if (!project) return {};
    const stages = project.stages ?? [];
    const totalApprovals = stages.reduce(
      (acc, s) => acc + (s.approvals?.length ?? 0),
      0
    );
    const totalDocs = stages.reduce(
      (acc, s) => acc + (s.documents?.length ?? 0),
      0
    );
    return {
      activity: project.activityLog?.length ?? 0,
      timeline: stages.length,
      approvals: totalApprovals,
      inventory: totalDocs,
      customer_return: (project.customerReturns ?? []).length,
    };
  }, [project]);

  if (!project) {
    return (
      <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
        <EmptyStatePms
          variant="projects"
          title="Project not found"
          description={`No project matches "${id}". It may have been deleted.`}
          action={<Button onClick={() => navigate('/pms/projects')}>Back to all projects</Button>}
        />
      </div>
    );
  }

  const currentStage = meta?.currentStage ?? null;

  function handleSubmitStage(stage) {
    setStageStatus(project.id, stage.id, 'Submitted', project.projectManager);
  }

  return (
    <div className="space-y-5">
      <ProjectHeader
        project={project}
        meta={meta}
        onAssignStage={() => setAssignStageId(currentStage?.id ?? '')}
        onLogDelay={() => navigate(`/pms/delays?project=${project.id}`)}
        onCompleteProject={() => setConfirmComplete(true)}
        onPrintProject={() => setShowPrintModal(true)}
        onProductionLink={() => setShowProductionLink(true)}
      />

      {/* Tabs */}
      <div className="border-b border-[#dce5f4] overflow-x-auto">
        <nav className="flex gap-1 min-w-max" role="tablist" aria-label="Project sections">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const count = counts[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap"
                style={
                  active
                    ? { borderColor: '#1f6bff', color: '#1f6bff' }
                    : { borderColor: 'transparent', color: '#64748b' }
                }
              >
                <Icon size={13} />
                {t.label}
                {count > 0 && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={
                      active
                        ? { background: '#dbeafe', color: '#1d4ed8' }
                        : { background: '#f1f5f9', color: '#94a3b8' }
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Panels */}
      <div role="tabpanel">
        {tab === 'overview' && <ProjectInfoTab project={project} meta={meta} />}

        {tab === 'timeline' && (
          <StageTimelineTab
            project={project}
            stageConfigs={stageConfigs}
            onStart={(stage) => startStage(project.id, stage.id, project.projectManager)}
            onHandoff={(stage) => setHandoffStageId(stage.id)}
            onDeleteStage={(stage) => removeProjectStage(project.id, stage.id)}
            onSyncPipeline={() => syncPipelineStages(project.id)}
          />
        )}

        {tab === 'approvals' && <ApprovalsTab project={project} />}

        {tab === 'inventory' && <DocumentsProofTab project={project} />}

        {tab === 'customer_project' && <CustomerProjectTab project={project} />}

        {tab === 'own_project' && <OwnProjectTab project={project} />}

        {tab === 'payment' && <PaymentDispatchTab project={project} />}

        {tab === 'customer_return' && <CustomerReturnTab project={project} />}

        {tab === 'activity' && <ActivityAuditTab project={project} />}
      </div>

      <AssignStageModal
        isOpen={assignStageId !== null}
        initialStageId={assignStageId || null}
        project={project}
        onClose={() => setAssignStageId(null)}
      />

      <StageHandoffModal
        isOpen={handoffStageId !== null}
        stageId={handoffStageId}
        project={project}
        onClose={() => setHandoffStageId(null)}
      />

      <CompleteProjectModal
        isOpen={confirmComplete}
        project={project}
        onClose={() => setConfirmComplete(false)}
      />

      <PrintProjectModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        project={project}
      />

      <ProductionLinkModal
        isOpen={showProductionLink}
        onClose={() => setShowProductionLink(false)}
        project={project}
      />

      <PmsToast />
    </div>
  );
}
