import CrmKpiCard from '../common/CrmKpiCard';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, User, Search, CheckCircle2, X, AlertTriangle, ArrowUpDown, Clock, Users, UserPlus, TrendingUp } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import DataTable from '../../../components/ui/DataTable';
import StatusBadge from '../../../components/ui/StatusBadge';
import StatCard from '../../../components/ui/StatCard';
import {
  TASK_SOURCE_AUTOMATION,
} from '../../../services/leadStageAutomation';
import { completeTaskWithOutcome, resolveLeadForTask, NEXT_ACTION_LABELS } from '../../../services/taskCompletionService';
import CompleteTaskModal from './CompleteTaskModal';
import MasterSourceLink from '../../../components/common/MasterSourceLink';
import { useAppStore } from '../../../stores/appStore';
import { useCrmStore } from '../../../stores/crmStore';
import { describeError } from '../../../services/crmSync';

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];
const STATUS_OPTIONS = ['Open', 'In Progress', 'Waiting', 'Completed'];

export default function TasksPage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const tasks = useCrmStore((s) => s.tasks);
  const leads = useCrmStore((s) => s.leads);
  const deals = useCrmStore((s) => s.deals);
  const teamMembers = useCrmStore((s) => s.teamMembers);
  const updateTask = useCrmStore((s) => s.updateTask);
  const [activeStatus, setActiveStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('dueDate');
  const [sortDirection, setSortDirection] = useState('asc');
  const [mineOnly, setMineOnly] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    assigneeId: '',
    dueDate: '',
    priority: 'Medium',
    status: 'Open',
  });

  const assigneeOptions = useMemo(() => {
    const rows = Array.isArray(teamMembers) ? teamMembers : [];
    return rows
      .filter((m) => m?.name)
      .map((m) => ({ id: m.id, name: m.name, email: m.email || '' }));
  }, [teamMembers]);

  const isAssignedToCurrentUser = useCallback((task) => {
    if (!currentUser) return false;
    const userId = String(currentUser.id || '');
    const userName = String(currentUser.name || '').trim().toLowerCase();
    const userEmail = String(currentUser.email || '').trim().toLowerCase();
    if (userId && String(task.assigneeId || '') === userId) return true;
    const owner = String(task.owner || task.assigneeName || '').trim().toLowerCase();
    if (userName && owner === userName) return true;
    if (userEmail && owner === userEmail) return true;
    return false;
  }, [currentUser]);

  const myTaskCount = useMemo(() => tasks.filter(isAssignedToCurrentUser).length, [tasks, isAssignedToCurrentUser]);

  // Complete Task Modal state
  const [completeTarget, setCompleteTarget] = useState(null);
  const [successToast, setSuccessToast] = useState('');
  const lastCompletionRef = useRef(null);


  const stats = [
    { label: 'Total Tasks', value: tasks.length.toString(), icon: 'file', tone: 'blue' },
    { label: 'Pending', value: tasks.filter((t) => t.status !== 'Completed').length.toString(), icon: 'clock', tone: 'amber' },
    { label: 'Urgent/High', value: tasks.filter((t) => t.priority === 'High' || t.priority === 'Urgent').length.toString(), icon: 'filter', tone: 'pink' },
    { label: 'Completed', value: tasks.filter((t) => t.status === 'Completed').length.toString(), icon: 'chart', tone: 'green' },
  ];

  function toggleComplete(task) {
    if (task.status === 'Completed') {
      // Re-opening is an ordinary edit; completing goes through the modal so
      // the server can apply the outcome and next action.
      updateTask(task.id, {
        status: 'Open',
        outcome: null,
        nextAction: null,
        completionNote: null,
      }).catch((err) => console.warn('[CRM] task not reopened:', describeError(err)));
      return;
    }
    const lead = resolveLeadForTask(task);
    setCompleteTarget({ task, lead });
  }

  async function handleComplete(outcome, nextAction, note, nextFollowUpAt, targetStageId) {
    if (!completeTarget?.task) return { ok: false, message: 'No task selected.' };
    const result = await completeTaskWithOutcome({
      task: completeTarget.task,
      outcome,
      nextAction,
      note,
      nextFollowUpAt,
      targetStageId,
    });
    if (result.ok !== false) {
      lastCompletionRef.current = result;
      setSuccessToast(result.message || 'Task completed successfully.');
      window.setTimeout(() => setSuccessToast(''), 3500);
    }
    return result;
  }

  function handleCompleteSuccess(result) {
    const completion = result || lastCompletionRef.current;
    const leadId = completion?.leadId || completeTarget?.task?.leadId || completeTarget?.lead?.id || null;
    setCompleteTarget(null);
    lastCompletionRef.current = null;
    if (completion?.stageChanged && leadId) {
      navigate(`/crm/leads/${encodeURIComponent(leadId)}?tab=tasks`);
    }
  }

  function openEditModal(task) {
    setEditingTask(task);
    setEditForm({
      title: task.title || '',
      assigneeId: task.assigneeId || '',
      dueDate: task.dueDate || '',
      priority: task.priority || 'Medium',
      status: task.status || 'Open',
    });
  }

  function closeEditModal() {
    setEditingTask(null);
  }

  function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingTask) return;
    updateTask(editingTask.id, {
      title: editForm.title.trim() || editingTask.title,
      assigneeId: editForm.assigneeId || null,
      dueDate: editForm.dueDate || editingTask.dueDate,
      priority: editForm.priority,
      status: editForm.status,
    }).catch((err) => console.warn('[CRM] task not saved:', describeError(err)));
    closeEditModal();
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  const taskRows = useMemo(() => {
    const leadsById = new Map(leads.map((lead) => [String(lead.id), lead]));
    return tasks.map((task) => {
      const lead = task.leadId ? leadsById.get(String(task.leadId)) : null;
      return {
        ...task,
        displayLeadId: lead?.leadNumber || lead?.lead_number || task.leadId || '',
      };
    });
  }, [tasks, leads]);

  const filteredTasks = useMemo(() => {
    const filtered = taskRows.filter((t) => {
      const matchesStatus = activeStatus === 'All' || t.status === activeStatus;
      if (mineOnly && !isAssignedToCurrentUser(t)) return false;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        String(t.displayLeadId).toLowerCase().includes(q) ||
        (t.title && String(t.title ?? '').toLowerCase().includes(q)) ||
        (t.lead && String(t.lead ?? '').toLowerCase().includes(q)) ||
        (t.owner && String(t.owner ?? '').toLowerCase().includes(q)) ||
        (t.source && String(t.source ?? '').toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'dueDate') {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return (da - db) * dir;
      }
      if (sortField === 'priority') {
        const weight = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
        return ((weight[a.priority] || 0) - (weight[b.priority] || 0)) * dir;
      }
      const valA = String(a[sortField] || '').toLowerCase();
      const valB = String(b[sortField] || '').toLowerCase();
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
  }, [taskRows, activeStatus, search, sortField, sortDirection, mineOnly, isAssignedToCurrentUser]);

  const columns = [
    {
      key: 'displayLeadId',
      label: (
        <span
          onClick={() => handleSort('displayLeadId')}
          className="inline-flex items-center gap-1 cursor-pointer hover:text-blue-600"
        >
          Lead ID <ArrowUpDown size={12} />
        </span>
      ),
      render: (val, row) => row.leadId ? (
        <Link
          to={`/crm/leads/${encodeURIComponent(row.leadId)}?tab=tasks`}
          aria-label={`Open tasks for lead ${val}`}
          className="whitespace-nowrap font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          {val}
        </Link>
      ) : (
        <span className="whitespace-nowrap font-mono text-xs font-semibold text-slate-700">
          {val || '—'}
        </span>
      ),
    },
    {
      key: 'title',
      label: (
        <span
          onClick={() => handleSort('title')}
          className="inline-flex items-center gap-1 cursor-pointer hover:text-blue-600"
        >
          Task Title <ArrowUpDown size={12} />
        </span>
      ),
      render: (val, row) => {
        const isAuto = row.source === TASK_SOURCE_AUTOMATION || row.source === 'Created by Lead Stage Automation';
        const isUnassigned = row.owner === 'Unassigned' || !row.owner;

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <strong style={{ color: '#0f172a', fontSize: '13px' }}>{val}</strong>
              {isAuto && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Created by Lead Stage Automation
                </span>
              )}
              {isUnassigned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle size={11} /> Unassigned
                </span>
              )}
            </div>
            {row.lead && (
              <span style={{ fontSize: 12, color: '#64748b', display: 'block' }}>
                Related Lead: <span className="font-medium text-slate-700">{row.lead}</span>
              </span>
            )}
            {row.completionOutcome && (
              <span style={{ fontSize: 11, color: '#059669', display: 'block' }}>
                Outcome: <strong>{row.completionOutcome}</strong>
                {row.nextAction && <> · Next: <strong>{NEXT_ACTION_LABELS[row.nextAction] || row.nextAction}</strong></>}
                {row.completedBy && <> · By <strong>{row.completedBy}</strong></>}
              </span>
            )}
            {row.warning && (
              <span style={{ fontSize: 11, color: '#b45309', display: 'block' }}>
                ⚠️ {row.warning}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'owner',
      label: (
        <span
          onClick={() => handleSort('owner')}
          className="inline-flex items-center gap-1 cursor-pointer hover:text-blue-600"
        >
          Assigned To <ArrowUpDown size={12} />
        </span>
      ),
      render: (val) => {
        const isUnassigned = val === 'Unassigned' || !val;
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: isUnassigned ? '#d97706' : '#334155',
              fontWeight: isUnassigned ? 600 : 400,
            }}
          >
            <User size={14} color={isUnassigned ? '#d97706' : '#64748b'} />
            {val || 'Unassigned'}
          </span>
        );
      },
    },
    {
      key: 'dueDate',
      label: (
        <span
          onClick={() => handleSort('dueDate')}
          className="inline-flex items-center gap-1 cursor-pointer hover:text-blue-600"
        >
          Due Date <ArrowUpDown size={12} />
        </span>
      ),
      render: (val) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
          <Calendar size={13} /> {val || 'Today'}
        </span>
      ),
    },
    {
      key: 'priority',
      label: (
        <span
          onClick={() => handleSort('priority')}
          className="inline-flex items-center gap-1 cursor-pointer hover:text-blue-600"
        >
          Priority <ArrowUpDown size={12} />
        </span>
      ),
      render: (val) => {
        const color =
          val === 'Urgent'
            ? 'badge-red'
            : val === 'High'
            ? 'badge-orange'
            : val === 'Medium'
            ? 'badge-blue'
            : 'badge-gray';
        return <span className={`badge ${color}`}>{val}</span>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'actions',
      label: 'Action',
      render: (_val, row) => {
        const isDone = row.status === 'Completed';
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleComplete(row);
            }}
            disabled={isDone}
            title={isDone ? 'Task is completed' : 'Click to complete task'}
            style={{
              border: isDone ? '1px solid #16a34a' : '1px solid #dc2626',
              color: isDone ? '#15803d' : '#dc2626',
              background: isDone ? '#f0fdf4' : '#fef2f2',
              borderRadius: 8,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 800,
              cursor: isDone ? 'default' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isDone ? 'Done' : 'Complete'}
          </button>
        );
      },
    },
  ];

  return (
    <div className="feature-page">
      <PageHeader
        title="CRM Tasks"
        subtitle="Track follow-ups, scheduled visits, demos, and sales milestones."
        breadcrumb={[{ label: 'CRM', to: '/crm/leads' }, { label: 'Tasks' }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 my-4">
        <CrmKpiCard label="Total Active Leads" value={leads.length} icon={Users} tone="blue" />
        <CrmKpiCard label="New Leads" value={leads.filter((l) => l.status === 'New').length} icon={UserPlus} tone="emerald" />
        <CrmKpiCard label="Pending Tasks" value={tasks.filter((t) => t.status !== 'Completed').length} icon={Clock} tone="amber" />
        <CrmKpiCard label="Deals in Pipeline" value={deals.filter((d) => d.stage !== 'Declined').length} icon={TrendingUp} tone="purple" />
        <CrmKpiCard label="Total Revenue Expected" value={'Rs ' + deals.reduce((sum, d) => sum + (Number(d.price) || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} symbol="₹" tone="rose" />
      </div>

      <div
        className="card"
        style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['All', 'Open', 'In Progress', 'Waiting', 'Completed'].map((status) => (
              <button
                key={status}
                type="button"
                className={`tab-btn ${activeStatus === status ? 'active' : ''}`}
                onClick={() => setActiveStatus(status)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: activeStatus === status ? '#1f6bff' : '#e2e8f0',
                  background: activeStatus === status ? '#f0f6ff' : '#ffffff',
                  color: activeStatus === status ? '#1f6bff' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {status}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMineOnly((v) => !v)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid',
                borderColor: mineOnly ? '#1f6bff' : '#e2e8f0',
                background: mineOnly ? '#1f6bff' : '#ffffff',
                color: mineOnly ? '#ffffff' : '#64748b',
                cursor: 'pointer',
              }}
            >
              Assigned to me ({myTaskCount})
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 260 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search tasks, lead IDs, leads, assignee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                }}
              />
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredTasks}
          rowKey="id"
          emptyMessage="No tasks found matching your filters."
        />
      </div>

      {/* Edit / Reassign Task Modal */}
      {editingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit / Reassign Task</h3>
                <span className="text-[11px] text-slate-400">{editingTask.id}</span>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Task Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Assigned Employee</label>
                  <MasterSourceLink source="users" />
                </div>
                <select
                  value={editForm.assigneeId}
                  onChange={(e) => setEditForm({ ...editForm, assigneeId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Unassigned</option>
                  {assigneeOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {!editForm.assigneeId && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    Task will remain unassigned until an eligible employee is chosen.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs bg-white focus:outline-none focus:border-blue-500"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs bg-white focus:outline-none focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Source:{' '}
                  <strong className="text-slate-700">
                    {editingTask.source || TASK_SOURCE_AUTOMATION}
                  </strong>
                </span>
                {editingTask.stage && (
                  <span>
                    Stage: <strong className="text-slate-700">{editingTask.stage}</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Task Modal */}
      <CompleteTaskModal
        open={Boolean(completeTarget)}
        task={completeTarget?.task || null}
        lead={completeTarget?.lead || null}
        onCancel={() => setCompleteTarget(null)}
        onComplete={handleComplete}
        onSuccess={handleCompleteSuccess}
      />

      {/* Success Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-[13px] font-semibold animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 size={16} />
          {successToast}
        </div>
      )}
    </div>
  );
}
