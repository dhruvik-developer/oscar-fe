import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import AssignTaskModal from './AssignTaskModal';
import PageHeader from '../../../../components/ui/PageHeader';
import { formatDeadline, formatAuditDate, STATUSES } from './taskAllocationStore';
import { useCrmStore } from '../../../../stores/crmStore';
import { useAppStore } from '../../../../stores/appStore';
import { describeError } from '../../../../services/crmSync';
import MasterSourceLink from '../../../../components/common/MasterSourceLink';

const LEAD_TASK_STATUSES = ['Open', 'In Progress', 'Waiting', 'Completed'];

export default function TaskAllocationDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const allocations = useCrmStore((s) => s.taskAllocations);
  const leadTasks = useCrmStore((s) => s.tasks);
  const employees = useCrmStore((s) => s.teamMembers);
  const loading = useCrmStore((s) => s.status.loading);
  const updateRecord = useCrmStore((s) => s.updateRecord);
  const refresh = useCrmStore((s) => s.refresh);
  const currentUser = useAppStore((s) => s.currentUser);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);

  const requestedKind = searchParams.get('kind');
  const allocationMatch = allocations.find((t) => String(t.id) === String(id));
  const leadMatch = leadTasks.find((t) => String(t.id) === String(id));
  const task = requestedKind === 'lead' ? (leadMatch || allocationMatch) : (allocationMatch || leadMatch);
  const isLeadTask = Boolean(task && (requestedKind === 'lead' || (leadMatch && task?.id === leadMatch.id && !allocationMatch)));
  const statusOptions = isLeadTask ? LEAD_TASK_STATUSES : STATUSES;
  const actorName = currentUser?.name || currentUser?.fullName || currentUser?.email || 'Team Member';
  const assigneeName = task ? (task.assignee || task.owner || task.assigneeName || 'Unassigned') : '';
  const assignedByName = task ? (task.assignedBy || task.source || '') : '';
  const departmentName = task ? (task.department || '') : '';
  const deadlineValue = task ? (task.deadline || task.dueDate || task.due || '') : '';
  const leadName = task ? (task.leadName || task.lead || '') : '';

  useEffect(() => {
    if (task) {
      setStatusDraft(task.status);
      setReassignTo(task.assigneeId || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, isLeadTask]);

  if (!task) {
    return (
      <section className="w-full max-w-5xl mx-auto py-8 text-center">
        <p className="text-sm font-bold text-slate-800">{loading ? 'Loading task...' : 'Task not found'}</p>
        <button type="button" onClick={() => navigate('/crm/tasks/allocation')} className="mt-3 px-4 py-2 bg-[#1d4a79] text-white text-xs font-semibold rounded-lg">Back to Task Allocation</button>
      </section>
    );
  }

  async function saveChanges(updates, auditText) {
    if (isLeadTask) {
      const saved = await updateRecord('tasks', task.id, updates);
      refresh('tasks');
      return saved;
    }
    const changes = auditText
      ? { ...updates, audit: [{ text: auditText, at: new Date().toISOString() }, ...(task.audit || [])] }
      : updates;
    const saved = await updateRecord('taskAllocations', task.id, changes);
    refresh('taskAllocations');
    return saved;
  }

  async function handleSaveStatus() {
    if (!statusDraft || saving || task._pending) return;
    setError('');
    setSaving(true);
    try {
      if (isLeadTask) {
        await saveChanges({ status: statusDraft });
      } else {
        await saveChanges(
          { status: statusDraft },
          statusNote.trim() ? `${actorName} changed status to ${statusDraft} — ${statusNote.trim()}` : null,
        );
      }
      setStatusNote('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleReassign() {
    if (!reassignTo || String(reassignTo) === String(task.assigneeId || '') || saving || task._pending) return;
    const assignee = employees.find((e) => String(e.id) === String(reassignTo));
    if (!assignee) return;
    setError('');
    setSaving(true);
    try {
      if (isLeadTask) {
        await updateRecord('tasks', task.id, { assigneeId: assignee.id });
        refresh('tasks');
      } else {
        await saveChanges(
          { assigneeId: assignee.id, assignee: assignee.name, department: assignee.department || task.department || '' },
          `${actorName} reassigned this to ${assignee.name}${reassignReason.trim() ? ` — ${reassignReason.trim()}` : ''}`,
        );
      }
      setReassignReason('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(data) {
    await saveChanges(data);
    setIsEditOpen(false);
  }

  return (
    <section className="w-full space-y-4">
      <PageHeader
        title={task.title}
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'CRM' },
          { label: 'Task Allocation', path: '/crm/tasks/allocation' },
          { label: task.title },
        ]}
        actions={
          <>
            {!isLeadTask && (
              <button
                type="button"
                disabled={saving || task._pending}
                onClick={() => setIsEditOpen(true)}
                className="btn-primary"
              >
                <Pencil size={16} /> Edit
              </button>
            )}
            <button type="button" onClick={() => navigate('/crm/tasks/allocation')} className="text-[13px] font-medium text-slate-700 hover:text-slate-900">
              Back
            </button>
          </>
        }
      />

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-6">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-slate-900">{task.title}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isLeadTask ? 'bg-violet-50 text-violet-600 border-violet-200' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{isLeadTask ? 'Lead Task' : 'Allocation'}</span>
            </div>
            <p className="text-[13px] text-slate-400 mt-1">{task.description || 'No description.'}</p>
            {task.fileName && <p className="text-xs text-slate-500 mt-2">File: {task.fileName}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5 mt-6">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Assignee</p>
                <p className="text-[13px] text-slate-700 mt-1">{assigneeName || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Assigned By</p>
                <p className="text-[13px] text-slate-700 mt-1">{assignedByName || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Department</p>
                <p className="text-[13px] text-slate-700 mt-1">{departmentName || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Priority</p>
                <p className="text-[13px] text-slate-700 mt-1">{task.priority || 'Medium'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Deadline</p>
                <p className="text-[13px] text-slate-700 mt-1">{deadlineValue ? formatDeadline(deadlineValue) : 'No deadline'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</p>
                <p className="text-[13px] text-slate-700 mt-1">{task.status}</p>
              </div>
              {isLeadTask && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Lead</p>
                  <p className="text-[13px] text-slate-700 mt-1">{leadName || 'Not linked'}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-6">
            <h3 className="text-[13px] font-bold text-slate-900 mb-3">Update Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-700 focus:outline-none focus:border-blue-400">
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {!isLeadTask && <input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Note (optional)" className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400" />}
              <button type="button" onClick={handleSaveStatus} disabled={saving || task._pending} className="px-5 py-2.5 bg-[#1d4a79] hover:bg-[#163a61] text-white text-[13px] font-semibold rounded-lg transition disabled:opacity-50">Save</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-slate-900">Reassign</h3>
              <MasterSourceLink source="users" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-700 focus:outline-none focus:border-blue-400">
                <option value="">Select employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              {!isLeadTask && <input value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} placeholder="Reason (optional)" className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400" />}
              <button type="button" onClick={handleReassign} disabled={saving || task._pending} className="px-5 py-2.5 bg-white hover:bg-slate-50 text-[#1d4a79] text-[13px] font-medium rounded-lg border border-[#1d4a79] transition disabled:opacity-50">Reassign</button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200/70 shadow-sm p-6">
            <h3 className="text-[13px] font-bold text-slate-900 mb-4">Audit Log</h3>
            <div className="relative pl-4 border-l border-slate-200 space-y-5">
              {(task.audit || []).map((a, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-500 border-2 border-white shadow" />
                  <p className="text-[13px] text-slate-700">{a.text}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatAuditDate(a.at)}</p>
                </div>
              ))}
              {(!task.audit || task.audit.length === 0) && <p className="text-xs text-slate-400">No activity yet.</p>}
            </div>
          </div>
        </div>
      </div>

      {isEditOpen && !isLeadTask && <AssignTaskModal isOpen initial={task} onClose={() => setIsEditOpen(false)} onSubmit={handleEditSubmit} />}
    </section>
  );
}
