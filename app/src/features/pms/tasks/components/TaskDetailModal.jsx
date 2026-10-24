import React, { useEffect, useState } from 'react';
import { Save, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { usePmsStore } from '../../../../stores/pmsStore';

/**
 * TaskDetailModal — edit one task's status, progress and notes.
 *
 * Progress and status are written through the store's updateTask, which keeps
 * the two consistent (100% means Completed, and reopening drops below 100).
 */

const fieldClass =
  'w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1.5';
const STATUSES = ['Not Started', 'In Progress', 'Blocked', 'Completed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

function stamp(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TaskDetailModal({ isOpen, onClose, task }) {
  const updateTask = usePmsStore((s) => s.updateTask);
  const [status, setStatus] = useState('Not Started');
  const [priority, setPriority] = useState('Medium');
  const [pct, setPct] = useState(0);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!isOpen || !task) return;
    setStatus(task.status);
    setPriority(task.priority);
    setPct(task.completionPct ?? 0);
    setDescription(task.description ?? '');
  }, [isOpen, task]);

  if (!task) return null;

  function handleSubmit(e) {
    e.preventDefault();
    // Progress last so the store's 100%-means-Completed rule has the final say.
    updateTask(task.projectId, task.stageId, task.id, { status, priority, description: description.trim() });
    updateTask(task.projectId, task.stageId, task.id, { completionPct: pct });
    onClose?.();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task.taskName}
      subtitle={`${task.projectId} — ${task.stageName}`}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="pms-task-detail" icon={Save}>Save Task</Button>
        </>
      }
    >
      <form id="pms-task-detail" onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-[#dce5f4] bg-[#f6f9ff] p-3">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['Project', task.projectCustomer ?? task.projectId], ['Stage', task.stageName],
              ['Department', task.department], ['Due', stamp(task.dueDate)]].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[10px] text-slate-500">{k}</dt>
                <dd className="text-[11px] font-semibold text-slate-800 truncate" title={String(v)}>{v}</dd>
              </div>
            ))}
          </dl>
          <Link to={`/pms/projects/${task.projectId}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline mt-2.5">
            Open project <ExternalLink size={10} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="task-status">Status</label>
            <select id="task-status" className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="task-priority">Priority</label>
            <select id="task-priority" className={fieldClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="task-pct">Completion — {pct}%</label>
          <input id="task-pct" type="range" min={0} max={100} step={5} value={pct}
            onChange={(e) => setPct(Number(e.target.value))} className="w-full accent-blue-600" />
        </div>

        <div>
          <label className={labelClass} htmlFor="task-desc">Notes</label>
          <textarea id="task-desc" rows={3} className={fieldClass} value={description}
            onChange={(e) => setDescription(e.target.value)} placeholder="Sub-steps, blockers, context…" />
        </div>
      </form>
    </Modal>
  );
}

export default TaskDetailModal;
