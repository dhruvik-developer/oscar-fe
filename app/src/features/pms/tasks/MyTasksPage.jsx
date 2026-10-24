import React, { useMemo, useState } from 'react';
import { CalendarClock, Loader, CalendarDays, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { EmptyStatePms } from '../components/EmptyStatePms';
import { usePmsStore, groupMyTasks } from '../../../stores/pmsStore';
import { TaskFilterBar } from './components/TaskFilterBar';
import { TaskCardItem } from './components/TaskCardItem';
import { TaskDetailModal } from './components/TaskDetailModal';
import { PmsToast } from '../components/PmsToast';

/**
 * MyTasksPage (/pms/my-tasks) — the individual contributor workbench.
 *
 * Every task assigned to the current user across every project, bucketed by
 * urgency. Edits write straight to the store, so a slider moved here lifts the
 * parent stage and the project gauge in the same tick.
 */

const GROUPS = [
  { key: 'dueToday', label: 'Due Today', icon: CalendarClock, tone: '#9a3412' },
  { key: 'inProgress', label: 'In Progress', icon: Loader, tone: '#3730a3' },
  { key: 'upcoming', label: 'Upcoming', icon: CalendarDays, tone: '#0369a1' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, tone: '#065f46' },
];

const EMPTY = { search: '', projectId: 'all', stageName: 'all', priority: 'all', status: 'all' };

export default function MyTasksPage() {
  const projects = usePmsStore((s) => s.projects);
  const currentUserId = usePmsStore((s) => s.currentUserId);
  const employees = usePmsStore((s) => s.employees);
  const updateTask = usePmsStore((s) => s.updateTask);

  const [filters, setFilters] = useState(EMPTY);
  const [openTask, setOpenTask] = useState(null);

  const currentUser = employees.find((e) => e.id === currentUserId) ?? null;

  // Flatten this user's tasks with the project/stage context each card needs.
  const myTasks = useMemo(
    () =>
      projects.flatMap((p) =>
        (p.stages ?? []).flatMap((stage) =>
          (stage.tasks ?? [])
            .filter((t) => t.assignedUser?.id === currentUserId)
            .map((t) => ({
              ...t,
              stageId: stage.id,
              stageName: stage.name,
              department: t.department ?? stage.department,
              projectId: p.id,
              projectCustomer: p.customerName,
            }))
        )
      ),
    [projects, currentUserId]
  );

  const options = useMemo(() => {
    const byProject = new Map();
    const stageNames = new Set();
    for (const t of myTasks) {
      byProject.set(t.projectId, t.projectCustomer ?? t.projectId);
      if (t.stageName) stageNames.add(t.stageName);
    }
    return {
      projects: [...byProject.entries()].map(([id, label]) => ({ id, label })),
      stageNames: [...stageNames].sort((a, b) => a.localeCompare(b)),
    };
  }, [myTasks]);

  const visible = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return myTasks.filter((t) => {
      if (q && ![t.taskName, t.projectId, t.stageName, t.projectCustomer]
        .filter(Boolean).join(' ').toLowerCase().includes(q)) return false;
      if (filters.projectId !== 'all' && t.projectId !== filters.projectId) return false;
      if (filters.stageName !== 'all' && t.stageName !== filters.stageName) return false;
      if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
      if (filters.status !== 'all' && t.status !== filters.status) return false;
      return true;
    });
  }, [myTasks, filters]);

  const groups = useMemo(() => groupMyTasks(visible), [visible]);

  function handleProgress(task, pct) {
    updateTask(task.projectId, task.stageId, task.id, { completionPct: pct });
  }
  function handleCycle(task, nextStatus) {
    updateTask(task.projectId, task.stageId, task.id, { status: nextStatus });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Tasks"
        subtitle={
          currentUser
            ? `Everything assigned to ${currentUser?.name} across all active projects.`
            : 'Your tasks across all active projects.'
        }
      />

      <TaskFilterBar
        filters={filters}
        options={options}
        onChange={setFilters}
        onReset={() => setFilters(EMPTY)}
        resultCount={visible.length}
        totalCount={myTasks.length}
      />

      {myTasks.length === 0 ? (
        <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
          <EmptyStatePms variant="tasks" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {GROUPS.map((group) => {
            const items = groups[group.key] ?? [];
            const Icon = group.icon;

            return (
              <section key={group.key} data-test={`group-${group.key}`}>
                <header className="flex items-center gap-2 mb-2.5">
                  <Icon size={14} style={{ color: group.tone }} />
                  <h3 className="text-sm font-bold text-slate-800">{group.label}</h3>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${group.tone}1a`, color: group.tone }}
                  >
                    {items.length}
                  </span>
                </header>

                {items.length === 0 ? (
                  <p className="text-[11px] text-slate-400 rounded-xl border border-dashed border-[#dce5f4] px-4 py-6 text-center">
                    Nothing here.
                  </p>
                ) : (
                  <ul className="space-y-2.5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {items.map((task) => (
                      <TaskCardItem
                        key={task.id}
                        task={task}
                        onProgress={handleProgress}
                        onCycleStatus={handleCycle}
                        onOpen={setOpenTask}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <TaskDetailModal
        isOpen={openTask !== null}
        task={openTask}
        onClose={() => setOpenTask(null)}
      />
      <PmsToast />
    </div>
  );
}
