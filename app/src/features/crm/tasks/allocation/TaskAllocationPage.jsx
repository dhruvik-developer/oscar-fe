import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, RotateCcw, Eye, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, CalendarClock, ListFilter, AlertTriangle, ClipboardList, Clock, Activity, CheckCircle2 } from 'lucide-react';
import AssignTaskModal from './AssignTaskModal';
import InfoBanner from '../../common/InfoBanner';
import PageHeader from '../../../../components/ui/PageHeader';
import KpiCard from '../../../../components/ui/KpiCard';
import { formatDeadline, STATUSES } from './taskAllocationStore';
import { useCrmStore } from '../../../../stores/crmStore';
import { describeError } from '../../../../services/crmSync';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function priorityStyle(priority) {
  if (priority === 'High') return 'bg-rose-50 text-rose-600 border-rose-200';
  if (priority === 'Low') return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  return 'bg-amber-50 text-amber-600 border-amber-200';
}

function priorityDot(priority) {
  if (priority === 'High') return 'bg-rose-500';
  if (priority === 'Low') return 'bg-emerald-500';
  return 'bg-amber-500';
}

function statusStyle(status) {
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  if (status === 'In Progress') return 'bg-sky-50 text-sky-600 border-sky-200';
  return 'bg-slate-100 text-slate-500 border-slate-200';
}

function statusDot(status) {
  if (status === 'Completed') return 'bg-emerald-500';
  if (status === 'In Progress') return 'bg-sky-500';
  return 'bg-slate-400';
}

const selectCls = 'w-full h-11 px-3.5 bg-slate-50/60 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition cursor-pointer';

export default function TaskAllocationPage() {
  const navigate = useNavigate();
  const allocations = useCrmStore((s) => s.taskAllocations);
  const leadTasks = useCrmStore((s) => s.tasks);
  const employees = useCrmStore((s) => s.teamMembers);
  const loading = useCrmStore((s) => s.status.loading);
  const createRecord = useCrmStore((s) => s.createRecord);
  const deleteRecord = useCrmStore((s) => s.deleteRecord);
  const refresh = useCrmStore((s) => s.refresh);
  const departments = useMemo(() => [...new Set(employees.map((e) => e.department).filter(Boolean))], [employees]);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Any');
  const [assigneeFilter, setAssigneeFilter] = useState('Anyone');
  const [deptFilter, setDeptFilter] = useState('Any');
  const [draftStatus, setDraftStatus] = useState('Any');
  const [draftAssignee, setDraftAssignee] = useState('Anyone');
  const [draftDept, setDraftDept] = useState('Any');
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const tasks = useMemo(() => {
    const mappedAllocations = (allocations || []).map((t) => ({
      ...t,
      kind: 'allocation',
      typeLabel: 'Allocation',
      deadline: t.deadline || '',
    }));
    const mappedLeadTasks = (leadTasks || []).map((t) => ({
      ...t,
      kind: 'lead',
      typeLabel: 'Lead Task',
      assignee: t.assignee || t.owner || t.assigneeName || 'Unassigned',
      assignedBy: t.assignedBy || t.source || '',
      department: t.department || '',
      deadline: t.deadline || t.dueDate || t.due || '',
      leadName: t.leadName || t.lead || '',
    }));
    return [...mappedAllocations, ...mappedLeadTasks];
  }, [allocations, leadTasks]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, assigneeFilter, deptFilter, search, perPage]);

  const assigneeOptions = useMemo(() => [...new Set([...employees.map((e) => e.name), ...tasks.map((t) => t.assignee)])], [employees, tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = tasks.filter((t) => {
      if (statusFilter !== 'Any' && t.status !== statusFilter) return false;
      if (assigneeFilter !== 'Anyone' && t.assignee !== assigneeFilter) return false;
      if (deptFilter !== 'Any' && (t.department || '') !== deptFilter) return false;
      if (q && !`${t.title} ${t.assignee} ${t.assignedBy} ${t.department} ${t.leadName || ''} ${t.typeLabel || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (!sortKey) return out;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...out].sort((a, b) => {
      const av = String(a[sortKey] ?? '').toLowerCase();
      const bv = String(b[sortKey] ?? '').toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [tasks, statusFilter, assigneeFilter, deptFilter, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  const startRow = filtered.length === 0 ? 0 : (safePage - 1) * perPage + 1;
  const endRow = (safePage - 1) * perPage + pageItems.length;

  function toggleSort(key) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  }

  function sortIcon(key) {
    if (sortKey !== key) return <ChevronsUpDown size={13} className="text-slate-300" />;
    return sortDir === 'asc' ? <ChevronUp size={13} className="text-blue-600" /> : <ChevronDown size={13} className="text-blue-600" />;
  }

  function applyFilters() {
    setStatusFilter(draftStatus);
    setAssigneeFilter(draftAssignee);
    setDeptFilter(draftDept);
  }

  function resetFilters() {
    setDraftStatus('Any');
    setDraftAssignee('Anyone');
    setDraftDept('Any');
    setStatusFilter('Any');
    setAssigneeFilter('Anyone');
    setDeptFilter('Any');
    setSearch('');
  }

  async function handleCreate(data) {
    const saved = await createRecord('taskAllocations', { ...data, status: 'Pending' });
    if (!saved) throw new Error('Task could not be saved. Please try again.');
    resetFilters();
    setPage(1);
    setIsModalOpen(false);
    refresh('taskAllocations');
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setError('');
    setDeleting(true);
    try {
      const key = deleteTarget.kind === 'lead' ? 'tasks' : 'taskAllocations';
      await deleteRecord(key, deleteTarget.id);
      setDeleteTarget(null);
      refresh(key);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setDeleting(false);
    }
  }

  function openDetail(row) {
    const id = typeof row === 'object' ? row.id : row;
    const kind = typeof row === 'object' ? row.kind : null;
    if (kind === 'lead') navigate(`/crm/tasks/allocation/${id}?kind=lead`);
    else navigate(`/crm/tasks/allocation/${id}`);
  }

  const hasActiveFilters = statusFilter !== 'Any' || assigneeFilter !== 'Anyone' || deptFilter !== 'Any' || search.trim() !== '';
  const activeFilterCount = (statusFilter !== 'Any' ? 1 : 0) + (assigneeFilter !== 'Anyone' ? 1 : 0) + (deptFilter !== 'Any' ? 1 : 0);

  return (
    <section className="w-full space-y-4">
      <PageHeader
        title="Task Allocation"
        subtitle="Assign tasks to team members, set priorities and deadlines, and track progress in one place."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="btn-primary"
            >
              <Plus size={16} strokeWidth={2.5} />
              Assign Task
            </button>
          </div>
        }
      />

      <InfoBanner
        storageKey="taskAllocationInfoBannerV1"
        title="Why use Task Allocation?"
        text="Assign tasks to team members, set priorities and deadlines, and track progress in one place. Filter by assignee, department or status to review workloads, then open a task to view its details and activity."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-4">
        <KpiCard label="Total Tasks" value={tasks.length} icon={ClipboardList} tone="blue" />
        <KpiCard label="Pending" value={tasks.filter((task) => task.status === 'Pending' || task.status === 'Open' || task.status === 'Waiting').length} icon={Clock} tone="amber" />
        <KpiCard label="In Progress" value={tasks.filter((task) => task.status === 'In Progress').length} icon={Activity} tone="purple" />
        <KpiCard label="Completed" value={tasks.filter((task) => task.status === 'Completed').length} icon={CheckCircle2} tone="emerald" />
      </div>

      {showFilters && (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-4 sm:p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3.5 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Status</label>
            <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)} className={selectCls}>
              <option value="Any">All statuses</option>
              {[...new Set([...STATUSES, 'Open', 'Waiting'])].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Assignee</label>
            <select value={draftAssignee} onChange={(e) => setDraftAssignee(e.target.value)} className={selectCls}>
              <option value="Anyone">All members</option>
              {assigneeOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Department</label>
            <select value={draftDept} onChange={(e) => setDraftDept(e.target.value)} className={selectCls}>
              <option value="Any">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={applyFilters} className="h-11 px-5 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-[13px] font-semibold rounded-xl shadow-sm transition">
              <Search size={15} strokeWidth={2.5} />
              Apply Filters
            </button>
            <button type="button" onClick={resetFilters} title="Reset filters" className="h-11 w-11 grid place-items-center bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-xl transition">
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Assigned Tasks</h2>
            <p className="mt-1 text-xs text-slate-500">Review ownership, priorities and progress across your team.</p>
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
              <RotateCcw size={14} /> Clear filters
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`h-10 px-4 inline-flex items-center gap-2 text-[13px] font-semibold rounded-xl border transition active:scale-[0.98] ${showFilters || hasActiveFilters ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/25' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-white'}`}
            >
              <ListFilter size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className={`min-w-5 h-5 px-1 grid place-items-center rounded-full text-[11px] font-bold ${showFilters ? 'bg-white/25 text-white' : 'bg-blue-600 text-white'}`}>{activeFilterCount}</span>
              )}
              <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            <div className="flex items-center gap-2 text-[13px] text-slate-500 font-medium ml-1">
            <span className="font-semibold text-slate-700">Show</span>
            <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer">
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>entries</span>
            </div>
          </div>
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tasks or team members"
              placeholder="Search tasks, people..."
              className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-[13px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">
                  <button type="button" onClick={() => toggleSort('title')} className="inline-flex items-center gap-1.5 hover:text-slate-800 transition">Task {sortIcon('title')}</button>
                </th>
                <th className="px-4 py-3.5">
                  <button type="button" onClick={() => toggleSort('assignee')} className="inline-flex items-center gap-1.5 hover:text-slate-800 transition">Assignee {sortIcon('assignee')}</button>
                </th>
                <th className="px-4 py-3.5">
                  <button type="button" onClick={() => toggleSort('assignedBy')} className="inline-flex items-center gap-1.5 hover:text-slate-800 transition">Assigned By {sortIcon('assignedBy')}</button>
                </th>
                <th className="px-4 py-3.5">
                  <button type="button" onClick={() => toggleSort('priority')} className="inline-flex items-center gap-1.5 hover:text-slate-800 transition">Priority {sortIcon('priority')}</button>
                </th>
                <th className="px-4 py-3.5">
                  <button type="button" onClick={() => toggleSort('deadline')} className="inline-flex items-center gap-1.5 hover:text-slate-800 transition">Deadline {sortIcon('deadline')}</button>
                </th>
                <th className="px-4 py-3.5">
                  <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1.5 hover:text-slate-800 transition">Status {sortIcon('status')}</button>
                </th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((t) => {
                const overdue = (t.status === 'Pending' || t.status === 'Open' || t.status === 'Waiting') && t.deadline;
                return (
                  <tr key={`${t.kind}-${t.id}`} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-5 py-4">
                      <button type="button" disabled={t._pending} onClick={() => openDetail(t)} className="flex items-start gap-3 text-left w-full disabled:opacity-50">
                        <span className="w-9 h-9 shrink-0 grid place-items-center rounded-xl bg-blue-50 border border-blue-100 text-[12px] font-bold text-blue-600">
                          {initials(t.title)}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="block font-bold text-slate-800 group-hover:text-blue-700 text-[13px] leading-snug truncate transition">{t.title}</span>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${t.kind === 'lead' ? 'bg-violet-50 text-violet-600 border-violet-200' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{t.typeLabel}</span>
                          </span>
                          <span className="block text-xs text-slate-400 mt-1 font-medium">{t.kind === 'lead' ? (t.leadName || t.department || 'Lead Task') : (t.department || 'Allocation')}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 shrink-0 grid place-items-center rounded-full bg-blue-50 border border-blue-100 text-[10px] font-extrabold text-blue-700">{initials(t.assignee)}</span>
                        <span className="text-slate-600 font-medium truncate">{t.assignee}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-500 font-medium">{t.assignedBy}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${priorityStyle(t.priority)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${priorityDot(t.priority)}`} />
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {t.deadline ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${overdue ? 'text-rose-600' : 'text-slate-500'}`}>
                          <CalendarClock size={14} className={overdue ? 'text-rose-400' : 'text-slate-300'} />
                          {formatDeadline(t.deadline)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 italic font-medium">No deadline</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusStyle(t.status)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot(t.status)}`} />
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" disabled={t._pending} onClick={() => openDetail(t)} title="View details" className="w-8 h-8 grid place-items-center bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 border border-slate-200 rounded-lg transition disabled:opacity-50">
                          <Eye size={15} />
                        </button>
                        <button type="button" disabled={t._pending} onClick={() => { setError(''); setDeleteTarget(t); }} title="Delete task" className="w-8 h-8 grid place-items-center bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 border border-slate-200 rounded-lg transition disabled:opacity-50">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <div className="mx-auto w-11 h-11 grid place-items-center rounded-2xl bg-slate-50 border border-slate-100 text-slate-300 mb-3">
                      <Search size={18} />
                    </div>
                    <p className="text-[13px] font-semibold text-slate-600">{loading ? 'Loading tasks...' : 'No tasks found'}</p>
                    {!loading && <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search.</p>}
                    {hasActiveFilters && (
                      <button type="button" onClick={resetFilters} className="mt-3 text-xs font-semibold text-blue-600 hover:underline">Clear all filters</button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
          <span className="font-medium">Showing <b className="text-slate-700">{startRow}–{endRow}</b> of <b className="text-slate-700">{filtered.length}</b> tasks</span>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="h-8 px-3.5 rounded-lg border border-slate-200 bg-white font-semibold disabled:opacity-40 hover:border-slate-300 hover:bg-white transition">Prev</button>
            <span className="h-8 min-w-14 px-2 grid place-items-center rounded-lg bg-blue-600 text-white font-bold text-[11px]">{safePage} / {totalPages}</span>
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="h-8 px-3.5 rounded-lg border border-slate-200 bg-white font-semibold disabled:opacity-40 hover:border-slate-300 hover:bg-white transition">Next</button>
          </div>
        </div>
      </div>

      {isModalOpen && <AssignTaskModal isOpen onClose={() => setIsModalOpen(false)} onSubmit={handleCreate} />}

      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center z-[70] p-2 sm:p-4" onClick={() => setDeleteTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 p-4 sm:p-6">
            <div className="w-10 h-10 grid place-items-center rounded-xl bg-rose-50 border border-rose-100 text-rose-500 mb-3">
              <AlertTriangle size={18} />
            </div>
            <h2 className="text-[15px] font-extrabold text-slate-900">Delete this task?</h2>
            {error && <p role="alert" className="text-xs text-rose-600 mt-2">{error}</p>}
            <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">This action cannot be undone. The task will be permanently removed.</p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button type="button" onClick={() => setDeleteTarget(null)} className="h-9 px-4 bg-white hover:bg-slate-50 text-slate-600 text-[13px] font-semibold rounded-xl border border-slate-200 transition">Cancel</button>
              <button type="button" disabled={deleting} onClick={confirmDelete} className="h-9 px-4 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-[13px] font-semibold rounded-xl shadow-sm shadow-rose-600/25 transition">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
