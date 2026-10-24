import React, { useMemo, useState } from 'react';
import { Plus, Info, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { usePmsStore, computeStageConfigUsage } from '../../../stores/pmsStore';
import { StageListTable } from './components/StageListTable';
import { AddEditStageModal } from './components/AddEditStageModal';
import { PmsToast } from '../components/PmsToast';

/**
 * StageConfigPage (/pms/stages) — the dynamic stage configurator.
 *
 * This list is the single definition of the execution pipeline: creating a
 * project instantiates its stages from the active templates here, in this
 * order, so nothing about the workflow is hardcoded.
 */
export default function StageConfigPage() {
  const stageConfigs = usePmsStore((s) => s.stageConfigs);
  const projects = usePmsStore((s) => s.projects);
  const reorderStageConfig = usePmsStore((s) => s.reorderStageConfig);
  const toggleStageConfigActive = usePmsStore((s) => s.toggleStageConfigActive);
  const deleteStageConfig = usePmsStore((s) => s.deleteStageConfig);

  const [editing, setEditing] = useState(null); // null = closed, {} = add, stage = edit
  const [pendingDelete, setPendingDelete] = useState(null);

  const ordered = useMemo(
    () => [...stageConfigs].sort((a, b) => a.sequence - b.sequence),
    [stageConfigs]
  );
  const activeCount = ordered.filter((c) => c.isActive).length;

  const totalDuration = useMemo(() => {
    const hours = ordered
      .filter((c) => c.isActive)
      .reduce(
        (sum, c) => sum + (c.durationUnit === 'Hours' ? Number(c.defaultDuration) : Number(c.defaultDuration) * 24),
        0
      );
    return Math.round((hours / 24) * 10) / 10;
  }, [ordered]);

  const deleteUsage = useMemo(
    () => (pendingDelete ? computeStageConfigUsage(projects, pendingDelete.id) : null),
    [pendingDelete, projects]
  );

  const addButton = (
    <Button icon={Plus} onClick={() => setEditing({})}>
      Add New Stage
    </Button>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dynamic Stage Management"
        subtitle="Define the standard execution pipeline. Reordering changes the workflow of future projects."
        actions={addButton}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#dce5f4] bg-[#f6f9ff] px-4 py-3">
        <Info size={14} className="text-blue-500 shrink-0" />
        <p className="text-[11px] text-slate-600 flex-1 min-w-[200px] sm:min-w-[260px]">
          New projects instantiate <strong>{activeCount} active</strong>{' '}
          {activeCount === 1 ? 'stage' : 'stages'} from this list, in this order — a nominal{' '}
          <strong>{totalDuration} days</strong> end to end. Editing a template never rewrites
          projects that are already running.
        </p>
        <span className="text-[11px] text-slate-400">
          {ordered.length} configured · {ordered.length - activeCount} inactive
        </span>
      </div>

      <StageListTable
        stages={ordered}
        onMove={(id, dir) => reorderStageConfig(id, dir)}
        onEdit={(stage) => setEditing(stage)}
        onToggleActive={(id) => toggleStageConfigActive(id)}
        onDelete={(stage) => setPendingDelete(stage)}
        emptyAction={addButton}
      />

      <AddEditStageModal
        isOpen={editing !== null}
        stage={editing && editing.id ? editing : null}
        onClose={() => setEditing(null)}
      />

      {/* Delete confirmation — shows what the template is currently driving. */}
      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete stage template?"
        subtitle={pendingDelete?.name}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={() => {
                deleteStageConfig(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete Stage
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            Projects already running keep their copy of this stage — instances store their own
            name, department and duration. Removing the template only stops{' '}
            <strong>future</strong> projects from getting it.
          </p>

          {deleteUsage && deleteUsage.stageCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800">
                In use by <strong>{deleteUsage.projectCount}</strong>{' '}
                {deleteUsage.projectCount === 1 ? 'project' : 'projects'} (
                {deleteUsage.stageCount} stage {deleteUsage.stageCount === 1 ? 'instance' : 'instances'}
                {deleteUsage.activeStageCount > 0
                  ? `, ${deleteUsage.activeStageCount} currently in flight`
                  : ''}
                ).
              </p>
            </div>
          )}

          <p className="text-[11px] text-slate-500">
            Prefer switching it to <strong>Inactive</strong> if you might reinstate it later —
            that keeps the definition without adding it to new projects.
          </p>
        </div>
      </Modal>
      <PmsToast />
    </div>
  );
}
