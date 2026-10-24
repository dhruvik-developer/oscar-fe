import React, { useState, useMemo } from 'react';
import { Percent, Plus, RefreshCw } from 'lucide-react';
import { EmptyStatePms } from '../../components/EmptyStatePms';
import {
  ConditionalStockBanner,
  StageStepper,
  buildStaticPipelineStages,
} from './StageOverview';
import { isProjectCreator } from '../../../../stores/pmsStore';
import { useAppStore } from '../../../../stores/appStore';
import { ConfigureStagePercentagesModal } from './ConfigureStagePercentagesModal';
import { AddDynamicStageModal } from './AddDynamicStageModal';
import { StageWorkspaceHeader } from './StageWorkspaceHeader';
import { StageWorkspaceFooter } from './StageWorkspaceFooter';
import { Stage1GreyStockWorkspace } from './Stage1GreyStockWorkspace';
import { Stage2PurchasePOWorkspace } from './Stage2PurchasePOWorkspace';
import { Stage2SupplierDeliveryWorkspace } from './Stage2SupplierDeliveryWorkspace';
import { Stage3GRNInwardWorkspace } from './Stage3GRNInwardWorkspace';
import { Stage4LotTakaWorkspace } from './Stage4LotTakaWorkspace';
import { Stage5GreyQCWorkspace } from './Stage5GreyQCWorkspace';
import { Stage6GreyStockUpdatedWorkspace } from './Stage6GreyStockUpdatedWorkspace';
import { StageVendorBillWorkspace } from './StageVendorBillWorkspace';
import { Stage7SupplierBillMatchingWorkspace } from './Stage7SupplierBillMatchingWorkspace';
import { Stage8SupplierPaymentWorkspace } from './Stage8SupplierPaymentWorkspace';
import { StageDownstreamWorkspace } from './StageDownstreamWorkspace';
import { StageVendorProductionWorkspace } from './StageVendorProductionWorkspace';

export function StageTimelineTab({
  project,
  stageConfigs = [],
  onStart,
  onManageTasks,
  onSubmit,
  onHandoff,
  onDeleteStage,
  onSyncPipeline,
}) {
  const [isPercentagesOpen, setPercentagesOpen] = useState(false);
  const [isAddStageOpen, setAddStageOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedStageSeq, setSelectedStageSeq] = useState(1);
  const [deliveryContext, setDeliveryContext] = useState(null);

  const handleSelectStage = (seq, context = null) => {
    setSelectedStageSeq(seq);
    if (context) {
      setDeliveryContext(context);
    }
  };

  const currentUser = useAppStore((s) => s.currentUser);
  const isCreator = isProjectCreator(project, currentUser);

  const ordered = useMemo(() => buildStaticPipelineStages(project), [project]);

  const totalWeight = ordered.reduce(
    (acc, s) => acc + (Number(s.percentage ?? s.weightPct ?? s.weight) || 0),
    0
  );

  const currentStage = ordered.find((s) => s.sequence === selectedStageSeq) || ordered[0];
  const stageName = (currentStage?.name || '').trim();
  const stageBranch = currentStage?.branch;

  return (
    <div className="space-y-4">
      <ConditionalStockBanner pipelineSummary={project.pipelineSummary} />

      {ordered.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Project Stage Pipeline
              </h3>
              <span className="text-[11px] text-slate-400">
                ({ordered.filter((s) => s.status === 'Completed').length} of{' '}
                {ordered.filter((s) => s.status !== 'Not Required').length} active stages completed · {Math.round(totalWeight * 100) / 100}% total weight)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onSyncPipeline && (
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      await onSyncPipeline();
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
                  title="Synchronize stage pipeline with latest ERP inventory and order data"
                >
                  <RefreshCw size={13} className={isSyncing ? 'animate-spin text-blue-600' : ''} />
                  {isSyncing ? 'Syncing...' : 'Sync Pipeline'}
                </button>
              )}

              {isCreator && project.status !== 'Completed' && (
                <>
                  <button
                    type="button"
                    onClick={() => setAddStageOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-2xs cursor-pointer"
                    title="Add a custom dynamic stage"
                  >
                    <Plus size={13} /> Add Dynamic Stage
                  </button>

                  {ordered.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPercentagesOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-2xs cursor-pointer"
                      title="Configure stage percentage weights"
                    >
                      <Percent size={13} /> Stage Weights
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <StageStepper
            stages={ordered}
            currentStageId={project.currentStageId}
            pipelineSummary={project.pipelineSummary}
            selectedStageSequence={selectedStageSeq}
            onSelectStage={(seq) => handleSelectStage(seq)}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
          <EmptyStatePms
            variant="stages"
            title="No stages configured"
            description="No stages have been configured for this project."
          />
        </div>
      )}

      {/* ── UNIFIED STAGE WORKSPACE HEADER ── */}
      {ordered.length > 0 && currentStage && (
        <StageWorkspaceHeader
          stage={currentStage}
          project={project}
          currentSeq={selectedStageSeq}
          totalStages={ordered.length}
          prevStage={ordered.find((s) => s.sequence === selectedStageSeq - 1)}
          nextStage={ordered.find((s) => s.sequence === selectedStageSeq + 1)}
          onSelectStage={handleSelectStage}
          onRefresh={onSyncPipeline}
          refreshing={isSyncing}
        />
      )}

      {/* Stage 1: Grey Stock Check & Allocation */}
      {(selectedStageSeq === 1 || stageName === 'Grey Stock Check & Allocation') && (
        <Stage1GreyStockWorkspace
          project={project}
          stage={ordered.find((s) => s.sequence === 1)}
          onSyncPipeline={onSyncPipeline}
          onHandoff={(targetSeq) => setSelectedStageSeq(targetSeq || 2)}
          onSelectStage={handleSelectStage}
        />
      )}

      {/* Grey Purchase Branch: Stage 2 - Create Grey Purchase PO */}
      {stageBranch === 'branch_purchase' && stageName === 'Create Grey Purchase PO' && (
        <Stage2PurchasePOWorkspace
          project={project}
          stage={currentStage}
          onSyncPipeline={onSyncPipeline}
          onSelectStage={(seq) => setSelectedStageSeq(seq)}
        />
      )}

      {/* Grey Purchase Branch: Stage 3 - Supplier Delivery */}
      {stageBranch === 'branch_purchase' && stageName === 'Supplier Delivery' && (
        <Stage2SupplierDeliveryWorkspace
          project={project}
          stage={currentStage}
          onSyncPipeline={onSyncPipeline}
          onSelectStage={handleSelectStage}
        />
      )}

      {/* Grey Purchase Branch: Stage 4 - GRN / Inward */}
      {stageBranch === 'branch_purchase' && stageName === 'GRN / Inward' && (
        <Stage3GRNInwardWorkspace
          project={project}
          stage={currentStage}
          onSyncPipeline={onSyncPipeline}
          onSelectStage={handleSelectStage}
          deliveryContext={deliveryContext}
        />
      )}

      {/* Grey Purchase Branch: Stage 5 - Lot & Taka Creation */}
      {stageBranch === 'branch_purchase' && stageName === 'Lot & Taka Creation' && (
        <Stage4LotTakaWorkspace
          project={project}
          stage={currentStage}
          onSyncPipeline={onSyncPipeline}
          onSelectStage={(seq) => setSelectedStageSeq(seq)}
        />
      )}

      {/* Grey Purchase Branch: Stage 6 - Grey QC */}
      {stageBranch === 'branch_purchase' && stageName === 'Grey QC' && (
        <Stage5GreyQCWorkspace
          project={project}
          stage={currentStage}
          onSyncPipeline={onSyncPipeline}
          onSelectStage={(seq) => setSelectedStageSeq(seq)}
        />
      )}

      {/* Grey Purchase Branch: Stage 7 - Grey Stock Updated */}
      {stageBranch === 'branch_purchase' && stageName === 'Grey Stock Updated' && (
        <Stage6GreyStockUpdatedWorkspace
          project={project}
          stage={currentStage}
          onSyncPipeline={onSyncPipeline}
          onSelectStage={(seq) => setSelectedStageSeq(seq)}
        />
      )}

      {/* Grey Purchase Branch: Stage 8 - Vendor Bill */}
      {stageBranch === 'branch_purchase' && (stageName === 'Vendor Bill' || stageName === 'Vendor Bill Entry') && (
        <StageVendorBillWorkspace
          project={project}
          stage={currentStage}
          onSyncPipeline={onSyncPipeline}
          onSelectStage={(seq) => setSelectedStageSeq(seq)}
        />
      )}

      {/* Grey Purchase Branch: Stage 9 - Supplier Bill Matching */}
      {stageBranch === 'branch_purchase' && stageName === 'Supplier Bill Matching' && (
        <Stage7SupplierBillMatchingWorkspace
          project={project}
          stage={currentStage}
          onSyncPipeline={onSyncPipeline}
          onSelectStage={(seq) => setSelectedStageSeq(seq)}
        />
      )}

      {/* Grey Purchase Branch: Stage 9 - Payment */}
      {stageBranch === 'branch_purchase' && stageName === 'Payment' && (
        <Stage8SupplierPaymentWorkspace
          project={project}
          stage={currentStage}
          onSyncPipeline={onSyncPipeline}
          onSelectStage={(seq) => setSelectedStageSeq(seq)}
        />
      )}

      {/* Vendor A Production Branch Stages */}
      {stageBranch === 'branch_production' && (
        <StageVendorProductionWorkspace
          stage={currentStage}
          project={project}
          onSyncPipeline={onSyncPipeline}
          onSelectStage={(seq) => setSelectedStageSeq(seq)}
          totalStages={ordered.length}
        />
      )}

      {/* Downstream Common Stages (Stages 10 - 17) */}
      {stageBranch === 'common' && selectedStageSeq !== 1 && stageName !== 'Grey Stock Check & Allocation' && (
        <StageDownstreamWorkspace
          stage={currentStage}
          project={project}
          onSyncPipeline={onSyncPipeline}
          onSelectStage={(seq) => setSelectedStageSeq(seq)}
          totalStages={ordered.length}
        />
      )}

      {/* ── UNIFIED STAGE WORKSPACE FOOTER ── */}
      {ordered.length > 0 && currentStage && (
        <StageWorkspaceFooter
          stage={currentStage}
          currentSeq={selectedStageSeq}
          totalStages={ordered.length}
          prevStage={ordered.find((s) => s.sequence === selectedStageSeq - 1)}
          nextStage={ordered.find((s) => s.sequence === selectedStageSeq + 1)}
          onSelectStage={handleSelectStage}
        />
      )}

      <ConfigureStagePercentagesModal
        isOpen={isPercentagesOpen}
        project={project}
        onClose={() => setPercentagesOpen(false)}
      />

      <AddDynamicStageModal
        isOpen={isAddStageOpen}
        project={project}
        onClose={() => setAddStageOpen(false)}
      />
    </div>
  );
}

export default StageTimelineTab;
