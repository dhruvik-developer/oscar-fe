import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  X,
  Pencil,
  Copy,
  Trash2,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Phone,
  Monitor,
  Clock,
  Gift,
  Users,
  FileText,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

import MasterTasksGuideModal from './MasterTasksGuideModal';
import InfoBanner from '../common/InfoBanner';
import PageHeader from '../../../components/ui/PageHeader';
import { useCrmStore } from '../../../stores/crmStore';
import { isBackendEnabled, describeError } from '../../../services/crmSync';

// ── Backend-first mode ──────────────────────────────────────────────
// Master tasks live in Postgres (/crm/master-tasks/). Nothing is kept in
// the browser: without a session the list is empty and saves are refused.


const ROLES = ['Sales Support Executive', 'BDE', 'Area Sales Manager'];
const DEPARTMENTS = ['Sales', 'Support', 'Marketing'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['Active', 'Inactive'];
const ICONS = ['follow-up', 'demo', 'pending', 'meeting', 'formal', 'quotation'];
const PER_PAGE_OPTIONS = [5, 10, 20, 50];

const ICON_STYLE = {
  'follow-up': 'bg-emerald-50 text-emerald-600',
  demo: 'bg-violet-50 text-violet-600',
  pending: 'bg-orange-50 text-orange-500',
  meeting: 'bg-rose-50 text-rose-500',
  formal: 'bg-blue-50 text-blue-600',
  quotation: 'bg-amber-50 text-amber-600',
};

/** Lower-cased text, safe on a field the server left unset. */
function text(value) {
  return String(value ?? '').toLowerCase();
}

function iconFor(key) {
  if (key === 'follow-up') return Phone;
  if (key === 'demo') return Monitor;
  if (key === 'pending') return Clock;
  if (key === 'meeting') return Gift;
  if (key === 'formal') return Users;
  if (key === 'quotation') return FileText;
  return Phone;
}



const EMPTY_FORM = {
  name: '',
  icon: 'follow-up',
  stages: [],
  role: 'BDE',
  department: 'Sales',
  priority: 'Medium',
  dueIn: 0,
  status: 'Active',
};

const NOT_SIGNED_IN = 'You are not signed in to the server — nothing was saved.';

export default function MasterTasksPage() {
  const navigate = useNavigate();
  // Backend is the source of truth.
  const storeTasks = useCrmStore((s) => s.masterTasks);
  const storeStages = useCrmStore((s) => s.stages);
  const hydrate = useCrmStore((s) => s.hydrate);
  const createRecord = useCrmStore((s) => s.createRecord);
  const updateRecord = useCrmStore((s) => s.updateRecord);
  const deleteRecord = useCrmStore((s) => s.deleteRecord);
  const backendOn = isBackendEnabled();
  const tasks = backendOn && Array.isArray(storeTasks) ? storeTasks : [];
  /** Resolve the form's stage names to server stage ids so the links persist. */
  const withStageIds = (row) => {
    const byName = new Map((storeStages || []).map((s) => [String(s?.name || '').toLowerCase(), s?.id]));
    const stageIds = (row.stages || [])
      .map((name) => byName.get(String(name || '').toLowerCase()))
      .filter(Boolean);
    return { ...row, stageIds };
  };
  const reportFailure = (err) => window.alert(describeError(err) || NOT_SIGNED_IN);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortKey, setSortKey] = useState('order');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pull from GET /crm/master-tasks/ when logged in; offline keeps seed/cache.
  useEffect(() => {
    hydrate().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, deptFilter, statusFilter, perPage]);

  function resetFilters() {
    setSearch('');
    setRoleFilter('All');
    setDeptFilter('All');
    setStatusFilter('All');
    setPage(1);
  }

  function toggleSort(key) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = tasks.filter((t) => {
      if (roleFilter !== 'All' && t.role !== roleFilter) return false;
      if (deptFilter !== 'All' && t.department !== deptFilter) return false;
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        text(t.name).includes(q) ||
        text(t.role).includes(q) ||
        text(t.department).includes(q)
      );
    });
    const sorted = [...out].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = String(a.name ?? '').localeCompare(String(b.name ?? ''));
      else cmp = (a.order || 0) - (b.order || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [tasks, search, roleFilter, deptFilter, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, filtered.length);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(task) {
    setEditingId(task.id);
    setForm({
      name: task.name,
      icon: task.icon || 'follow-up',
      stages: [...(task.stages || [])],
      role: task.role,
      department: task.department,
      priority: task.priority,
      dueIn: task.dueIn,
      status: task.status,
    });
    setFormError('');
    setModalOpen(true);
    setMenuId(null);
  }

  function submitForm(e) {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      setFormError('Task name is required.');
      return;
    }
    const clean = {
      ...form,
      name: form.name.trim(),
      title: form.name.trim(),
      dueIn: Number(form.dueIn) || 0,
    };
    setFormError('');
    setSaving(true);
    const done = () => {
      setSaving(false);
      setModalOpen(false);
      setEditingId(null);
    };
    const failed = (err) => {
      setSaving(false);
      setFormError(describeError(err) || 'Could not save the task. Please try again.');
    };
    if (editingId) {
      if (backendOn) {
        updateRecord('masterTasks', editingId, withStageIds(clean)).then(done).catch(failed);
      } else {
        failed(new Error(NOT_SIGNED_IN));
      }
    } else {
      const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
      const row = { id: `mt-${Date.now()}`, order: maxOrder + 1, ...clean };
      if (backendOn) {
        createRecord('masterTasks', withStageIds(row)).then((saved) => {
          if (!saved) {
            failed(new Error('No response'));
            return;
          }
          done();
        }).catch(failed);
      } else {
        failed(new Error(NOT_SIGNED_IN));
      }
    }
  }

  function duplicateTask(id) {
    const src = tasks.find((t) => t.id === id);
    if (!src) return;
    setMenuId(null);
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
    const copy = {
      ...src,
      id: `mt-${Date.now()}`,
      order: maxOrder + 1,
      name: `${src.name} Copy`,
      title: `${src.name} Copy`,
      stages: [...(src.stages || [])],
    };
    delete copy._synced;
    delete copy._pending;
    delete copy._local;
    if (backendOn) {
      createRecord('masterTasks', withStageIds(copy)).catch(reportFailure);
    } else {
      reportFailure(new Error(NOT_SIGNED_IN));
    }
  }

  function toggleStatus(id) {
    const row = tasks.find((t) => t.id === id);
    const next = row?.status === 'Active' ? 'Inactive' : 'Active';
    if (backendOn) {
      updateRecord('masterTasks', id, { status: next }).catch(reportFailure);
    } else {
      reportFailure(new Error(NOT_SIGNED_IN));
    }
    setMenuId(null);
  }

  function confirmDelete() {
    if (!deleteId) return;
    if (backendOn) {
      deleteRecord('masterTasks', deleteId).catch(reportFailure);
    } else {
      reportFailure(new Error(NOT_SIGNED_IN));
    }
    setDeleteId(null);
    setMenuId(null);
  }

  function priorityPill(priority) {
    if (priority === 'High') return 'bg-rose-50 text-rose-600 border-rose-100';
    if (priority === 'Low') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    return 'bg-amber-50 text-amber-600 border-amber-100';
  }

  return (
    <section className="w-full space-y-4">
      <PageHeader
        title="Manage Master Lead Tasks"
        subtitle="Create and manage reusable tasks that can be assigned to different lead stages."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="btn-outline"
              aria-label="How to create lead tasks master"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1d6bff] text-[12px] font-bold text-white">?</span>
              <span>How to create lead tasks master?</span>
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="btn-primary"
            >
              <Plus size={16} /> Create Master Task
            </button>
          </div>
        }
      />

      <InfoBanner
        storageKey="leadMasterTasksBannerV2"
        title="Why use Master Lead Tasks?"
        text="Create reusable tasks such as follow-ups, demos and quotations once, then link them to the relevant lead stages. Set the responsible role, department, priority and due days so your team follows a consistent process for every lead."
      />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 p-3.5 border-b border-slate-100">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task name, role or department..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer">
              <option value="All">All Roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer">
              <option value="All">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer">
              <option value="All">All Status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 w-14">
                  <button type="button" onClick={() => toggleSort('order')} className="inline-flex items-center gap-1 hover:text-slate-700">
                    # {sortKey === 'order' ? (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null}
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button type="button" onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-slate-700">
                    Task Name {sortKey === 'name' ? (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null}
                  </button>
                </th>
                <th className="px-3 py-3">Assigned Role</th>
                <th className="px-3 py-3">Department</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">Due In (Days)</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((t, idx) => {
                const Icon = iconFor(t.icon);
                return (
                  <tr key={t.id} className="transition hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_0_#2f6fed]">
                    <td className="px-4 py-3 text-slate-500">{(safePage - 1) * perPage + idx + 1}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 font-bold text-slate-800 whitespace-nowrap">
                        <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${ICON_STYLE[t.icon] || ICON_STYLE['follow-up']}`}>
                          <Icon size={14} />
                        </span>
                        {t.name}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 font-medium whitespace-nowrap">{t.role}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{t.department}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${priorityPill(t.priority)}`}>
                        {t.priority === 'Low' ? <ArrowDown size={11} /> : <ArrowUp size={11} />} {t.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 text-center">{t.dueIn}</td>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => toggleStatus(t.id)} title="Toggle status" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900">
                        <span className={`w-2 h-2 rounded-full ${t.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} /> {t.status}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 relative">
                        <button type="button" onClick={() => openEdit(t)} title="Edit" className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition">
                          <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => duplicateTask(t.id)} title="Duplicate" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                          <Copy size={15} />
                        </button>
                        <button type="button" onClick={() => setDeleteId(t.id)} title="Delete" className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                          <Trash2 size={15} />
                        </button>
                        <button type="button" onClick={() => setMenuId(menuId === t.id ? null : t.id)} title="More" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                          <MoreVertical size={15} />
                        </button>
                        {menuId === t.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                            <button type="button" onClick={() => toggleStatus(t.id)} className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                              Mark {t.status === 'Active' ? 'Inactive' : 'Active'}
                            </button>
                            <button type="button" onClick={() => duplicateTask(t.id)} className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                              Duplicate task
                            </button>
                            <button type="button" onClick={() => navigate('/crm/leads/stage-tasks')} className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                              Open Stage Tasks
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={8}className="px-4 py-10 text-center">
                    <p className="text-sm font-semibold text-slate-700">No tasks found</p>
                    <p className="text-xs text-slate-500 mt-1">Try a different search or reset filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 border-t border-slate-100 text-xs text-slate-500 pr-20 sm:pr-24">
          <span>Showing {from} to {to} of {filtered.length} tasks</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer" aria-label="Previous page">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`min-w-7 h-7 px-2 rounded-lg border text-xs font-bold transition cursor-pointer ${p === safePage ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {p}
              </button>
            ))}
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer" aria-label="Next page">
              <ChevronRight size={14} />
            </button>
            <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 cursor-pointer">
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <form onSubmit={submitForm} onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{editingId ? 'Edit Master Task' : 'Create Master Task'}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3.5 max-h-[72vh] overflow-y-auto text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Task Name <span className="text-rose-500">*</span></label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Follow-up, Demo, Quotation" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800">
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800">
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800">
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due In (Days)</label>
                  <input type="number" min="0" value={form.dueIn} onChange={(e) => setForm({ ...form, dueIn: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800">
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Icon</label>
                <div className="grid grid-cols-6 gap-2">
                  {ICONS.map((key) => {
                    const Icon = iconFor(key);
                    const active = form.icon === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm({ ...form, icon: key })}
                        className={`h-10 rounded-lg border grid place-items-center transition ${active ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>
              {formError && <p className="text-[11px] font-semibold text-rose-600">{formError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50/70 border-t border-slate-100">
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50">
                {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Task')}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4" role="presentation" onMouseDown={() => setDeleteId(null)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900">Delete this task?</h2>
            <p className="text-xs text-slate-500 mt-1">This action cannot be undone. The master task will be removed permanently.</p>
            <div className="flex items-center justify-end gap-2.5 mt-4">
              <button type="button" onClick={() => setDeleteId(null)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition">
                Cancel
              </button>
              <button type="button" onClick={confirmDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <MasterTasksGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </section>
  );
}
