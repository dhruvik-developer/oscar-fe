import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, Plus, Search, Eye, Pencil, Trash2, Check,
  CheckCircle2, Clock, FolderOpen, Trophy,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import KpiCard from '../../../components/ui/KpiCard';
import PageHeader from '../../../components/ui/PageHeader';
import { loadDeals } from '../../../services/dealService';
import {
  loadProjects,
  refreshProjectsCache,
  projectDefaults,
  createProjectFromDeal,
  createStandaloneProject,
  updateProject,
  deleteProject,
} from '../../../services/dealProjectService';

const STATUSES = ['All', 'Active', 'On Hold', 'Completed', 'Cancelled'];
const EMPTY_FORM = {
  sourceDealId: '', name: '', customer: '', owner: '',
  team: '', projectType: '', startDate: '', expectedEndDate: '',
  description: '', status: 'Active',
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusTone(status) {
  if (/^active$/i.test(status)) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (/^completed$/i.test(status)) return 'bg-blue-50 text-blue-700 border border-blue-200';
  if (/hold/i.test(status)) return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (/cancel/i.test(status)) return 'bg-rose-50 text-rose-700 border border-rose-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

function ProjectForm({ form, setForm, wonDeals, dealLocked }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
      <label className="space-y-1.5 font-semibold text-slate-600 sm:col-span-2">
        Source Won Deal (optional)
        <select
          className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 bg-white"
          value={form.sourceDealId}
          disabled={dealLocked}
          onChange={(e) => {
            const dealId = e.target.value;
            if (!dealId) { setForm({ ...form, sourceDealId: '' }); return; }
            const deal = wonDeals.find((d) => String(d.id) === dealId);
            if (!deal) { setForm({ ...form, sourceDealId: dealId }); return; }
            const defaults = projectDefaults(deal);
            setForm({
              ...form, sourceDealId: dealId, name: defaults.name,
              customer: defaults.customer, owner: defaults.owner,
              team: defaults.team, projectType: defaults.projectType,
              description: defaults.description,
            });
          }}
        >
          <option value="">Manual project (no deal)</option>
          {wonDeals.map((d) => (
            <option key={d.id} value={d.id}>{d.name} • {d.client} • {d.id}</option>
          ))}
        </select>
      </label>
      <label className="space-y-1.5 font-semibold text-slate-600">
        Project Name *
        <input required className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Laser Installation — Apex Tools" />
      </label>
      <label className="space-y-1.5 font-semibold text-slate-600">
        Customer *
        <input required className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400"
          value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Customer name" />
      </label>
      <label className="space-y-1.5 font-semibold text-slate-600">
        Project Manager *
        <input required className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400"
          value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Owner name" />
      </label>
      <label className="space-y-1.5 font-semibold text-slate-600">
        Team
        <input className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400"
          value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} placeholder="Optional" />
      </label>
      <label className="space-y-1.5 font-semibold text-slate-600">
        Project Type
        <input className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400"
          value={form.projectType} onChange={(e) => setForm({ ...form, projectType: e.target.value })} placeholder="Optional" />
      </label>
      <label className="space-y-1.5 font-semibold text-slate-600">
        Status
        <select className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 bg-white"
          value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          {STATUSES.filter((s) => s !== 'All').map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="space-y-1.5 font-semibold text-slate-600">
        Start Date *
        <input type="date" required className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400"
          value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
      </label>
      <label className="space-y-1.5 font-semibold text-slate-600">
        Expected End Date
        <input type="date" className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400"
          value={form.expectedEndDate} onChange={(e) => setForm({ ...form, expectedEndDate: e.target.value })} />
      </label>
      <label className="block space-y-1.5 font-semibold text-slate-600 sm:col-span-2">
        Description
        <textarea className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" rows={3}
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Scope, deliverables, notes…" />
      </label>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [deals, setDeals] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  function refresh() {
    try {
      setProjects(loadProjects());
      try { setDeals(loadDeals()); } catch { setDeals([]); }
      setError('');
    } catch (failure) { setError(failure.message); }
  }

  useEffect(() => {
    refreshProjectsCache().then(() => refresh()).catch(() => refresh());
    window.addEventListener('storage', refresh);
    window.addEventListener('crm:data-updated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('crm:data-updated', refresh);
    };
  }, []);

  const linkedDealIds = useMemo(() => new Set(projects.map((p) => String(p.sourceDealId)).filter(Boolean)), [projects]);

  const wonDeals = useMemo(() => {
    const linkedProjectDealIds = new Set([
      ...linkedDealIds,
      ...deals.filter((d) => d.projectId != null).map((d) => String(d.id)),
    ]);
    return deals.filter((d) => d.stage === 'Won' && !linkedProjectDealIds.has(String(d.id)));
  }, [deals, linkedDealIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== 'All' && (p.status || 'Active') !== statusFilter) return false;
      if (!q) return true;
      return [p.projectNumber, p.name, p.customer, p.customerId, p.owner, p.ownerId, p.team, p.projectType, p.sourceDealId]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [projects, search, statusFilter]);

  const stats = useMemo(() => ({
    total: projects.length,
    active: projects.filter((p) => /^active$/i.test(p.status || 'Active')).length,
    completed: projects.filter((p) => /^completed$/i.test(p.status || '')).length,
    ready: wonDeals.length,
  }), [projects, wonDeals]);

  function openCreate(prefillDealId = '') {
    setFormError('');
    if (prefillDealId) {
      const deal = deals.find((d) => String(d.id) === String(prefillDealId));
      const defaults = deal ? projectDefaults(deal) : EMPTY_FORM;
      setForm({ ...EMPTY_FORM, ...defaults, sourceDealId: prefillDealId });
    } else {
      setForm(EMPTY_FORM);
    }
    setCreateOpen(true);
  }

  async function submitCreate(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError('');
    try {
      let project;
      if (form.sourceDealId) {
        const result = await createProjectFromDeal(form.sourceDealId, form);
        project = result.project;
      } else {
        project = await createStandaloneProject(form);
      }
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setCreated(project);
      refresh();
    } catch (failure) { setFormError(failure.message); }
    finally { setBusy(false); }
  }

  function openEdit(project) {
    setFormError('');
    setForm({
      sourceDealId: project.sourceDealId || '',
      name: project.name || '', customer: project.customer || project.customerId || project.partyId || '',
      owner: project.owner || project.ownerId || '', team: project.team || project.teamId || '',
      projectType: project.projectType || '', startDate: project.startDate || '',
      expectedEndDate: project.expectedEndDate || '', description: project.description || '',
      status: project.status || 'Active',
    });
    setEditing(project);
  }

  async function submitEdit(event) {
    event.preventDefault();
    if (busy || !editing) return;
    setBusy(true);
    setFormError('');
    try {
      const { sourceDealId: _ignored, ...patch } = form;
      const updated = await updateProject(editing.id, patch);
      setEditing(null);
      setNotice(`Project ${updated.projectNumber} updated successfully.`);
      refresh();
    } catch (failure) { setFormError(failure.message); }
    finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      const removed = await deleteProject(deleting.id);
      setDeleting(null);
      setNotice(`Project ${removed.projectNumber} deleted.`);
      refresh();
    } catch (failure) { setError(failure.message); }
  }

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Projects"
        subtitle="Every created project appears here — create from a Won deal or manually."
        actions={<button type="button" className="btn-primary btn-sm" onClick={() => openCreate()}><Plus size={14} /> New Project</button>}
      />

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{notice}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-4">
        <KpiCard label="Total Projects" value={stats.total} icon={FolderOpen} tone="blue" />
        <KpiCard label="Active" value={stats.active} icon={Clock} tone="emerald" />
        <KpiCard label="Completed" value={stats.completed} icon={CheckCircle2} tone="purple" />
        <KpiCard label="Won Deals Ready" value={stats.ready} icon={Trophy} tone="amber" />
      </div>

      {wonDeals.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm font-bold"><Trophy size={16} className="text-amber-600" /> Won deals waiting for a project ({wonDeals.length})</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {wonDeals.slice(0, 8).map((d) => (
              <button key={d.id} type="button" onClick={() => openCreate(d.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                <Plus size={12} /> {d.name} • {d.client}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by project no, name, customer, manager…"
              className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-400" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {STATUSES.map((s) => (
              <button key={s} type="button" onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">No projects yet</p>
            <p className="mt-1 text-xs text-slate-500">Create your first project — it will show up here instantly.</p>
            <button type="button" className="btn-primary btn-sm mt-4" onClick={() => openCreate()}><Plus size={14} /> Create Project</button>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[860px] text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500">
                  <th className="px-4 py-3 font-semibold">Project</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Manager / Team</th>
                  <th className="px-4 py-3 font-semibold">Dates</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Source Deal</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-bold text-blue-600">{p.projectNumber}</p>
                      <p className="mt-0.5 font-semibold text-slate-800 break-words max-w-[240px]">{p.name}</p>
                      {p.projectType && <p className="text-slate-400">{p.projectType}</p>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{p.customer || p.customerId || p.partyId || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="font-semibold text-slate-700">{p.owner || p.ownerId || '—'}</p>
                      <p>{p.team || p.teamId || 'No team'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(p.startDate)} → {formatDate(p.expectedEndDate)}</td>
                    <td className="px-4 py-3"><span className={`inline-block rounded-full px-2 py-1 font-semibold ${statusTone(p.status)}`}>{p.status || 'Active'}</span></td>
                    <td className="px-4 py-3 text-slate-600">{p.sourceDealId || 'Manual'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Link className="p-2 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50" title="View"
                          to={`/crm/projects/${encodeURIComponent(p.id)}`}><Eye size={14} /></Link>
                        <button type="button" className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Edit"
                          onClick={() => openEdit(p)}><Pencil size={14} /></button>
                        <button type="button" className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50" title="Delete"
                          onClick={() => setDeleting(p)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={createOpen} onClose={() => !busy && setCreateOpen(false)} title="New Project" subtitle="Pick a Won deal or create manually — it shows in the list instantly" size="lg">
        <form onSubmit={submitCreate} className="space-y-4">
          <ProjectForm form={form} setForm={setForm} wonDeals={wonDeals} dealLocked={false} />
          {formError && <p role="alert" className="text-xs text-rose-600">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary btn-sm" disabled={busy}>{busy ? 'Creating…' : 'Create Project'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(editing)} onClose={() => !busy && setEditing(null)} title={`Edit ${editing?.projectNumber || 'Project'}`} subtitle="Update details — changes reflect everywhere" size="lg">
        {editing && (
          <form onSubmit={submitEdit} className="space-y-4">
            <ProjectForm form={form} setForm={setForm} wonDeals={wonDeals} dealLocked />
            {formError && <p role="alert" className="text-xs text-rose-600">{formError}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete Project"
        footer={<><button type="button" className="btn-outline btn-sm" onClick={() => setDeleting(null)}>Cancel</button>
          <button type="button" className="btn-sm rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700" onClick={confirmDelete}>Delete</button></>}>
        {deleting && <p className="text-xs leading-6 text-slate-600">Delete <strong>{deleting.projectNumber}</strong> — {deleting.name}? The linked deal will be unlinked. This cannot be undone.</p>}
      </Modal>

      <Modal isOpen={Boolean(created)} onClose={() => setCreated(null)}
        footer={created && (
          <div className="flex justify-center gap-2 w-full">
            <Link className="btn-primary btn-sm" to={`/crm/projects/${encodeURIComponent(created.id)}`}>View Project</Link>
            {created.sourceDealId ? (
              <Link className="btn-outline btn-sm" to={`/crm/deals?deal=${encodeURIComponent(created.sourceDealId)}`}>Back to Deal</Link>
            ) : (
              <button type="button" className="btn-outline btn-sm" onClick={() => setCreated(null)}>Back to Projects</button>
            )}
          </div>
        )}>
        {created && (
          <div className="text-center px-2 py-2">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <Check size={28} strokeWidth={3} />
            </span>
            <h3 className="mt-3 text-base font-bold text-emerald-700">Project Created Successfully!</h3>
            <p className="mt-1.5 text-xs leading-6 text-slate-500">
              Project {created.projectNumber} has been created
              {created.sourceDealId ? <> and linked to Deal {created.sourceDealId}</> : null}.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
