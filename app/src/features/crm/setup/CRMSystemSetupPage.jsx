import CrmKpiCard from '../common/CrmKpiCard';
import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Users,
  Plus,
  Search,
  Pencil,
  Copy,
  Trash2,
  GripVertical,
  X,
  AlertCircle,
  User,
  FileText,
  FileCheck,
  Clock,
  CheckCircle2,
  MessageSquare,
  Trophy,
  XCircle,
  ShieldCheck,
  GitBranch
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { useCrmStore } from '../../../stores/crmStore';
import { isServerId, describeError } from '../../../services/resourceSync';

/**
 * Write a reordered / edited pipeline back. Rows the server has not seen are
 * created and changed rows are patched, so a drag or a rename is saved without
 * the screen having to know about HTTP.
 *
 * Deletion is deliberately NOT inferred here. This used to treat "a row in
 * the store that is missing from the local list" as a delete, which meant any
 * transient disagreement between the two lists -- an HMR reload, a re-login,
 * a pull that failed -- was executed as a mass DELETE against the pipeline.
 * Deleting is now explicit: `confirmDelete` awaits `deleteRecord` and reports
 * the result.
 */
function syncStages(key, next, previous, onError) {
  const store = useCrmStore.getState();
  const before = new Map(previous.map((row) => [String(row.id), row]));

  // A rejected write used to end at `console.warn`, so a stage silently failed
  // to save with no trace on screen. Report it instead.
  const report = (err) => {
    warn(err);
    if (onError) onError(err);
  };

  next.forEach((row, index) => {
    const withOrder = { ...row, order: index + 1 };
    const existing = before.get(String(row.id));
    if (!existing) {
      // A row the server already knows cannot be "new". Without this guard a
      // transient list mismatch re-POSTs it and mints a duplicate stage.
      if (isServerId(row.id)) return;
      store.createRecord(key, withOrder).catch(report);
    } else if (isServerId(row.id) && JSON.stringify({ ...existing, order: index + 1 }) !== JSON.stringify(withOrder)) {
      store.updateRecord(key, row.id, withOrder).catch(report);
    }
  });
}

function warn(err) {
  console.warn('[CRM] stage not saved:', err?.message || err);
}

function LeadStageIcon({ icon, bg, fg }) {
  const size = 14;
  const style = { background: bg, color: fg };
  if (icon === 'file') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><FileText size={size} /></span>;
  if (icon === 'filecheck') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><FileCheck size={size} /></span>;
  if (icon === 'clock') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><Clock size={size} /></span>;
  if (icon === 'check') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><CheckCircle2 size={size} /></span>;
  if (icon === 'chat') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><MessageSquare size={size} /></span>;
  if (icon === 'trophy') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><Trophy size={size} /></span>;
  if (icon === 'lost') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><XCircle size={size} /></span>;
  if (icon === 'future') return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><Clock size={size} /></span>;
  return <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={style}><User size={size} /></span>;
}

function StatusPill({ status, onToggle }) {
  const active = status === 'Active';
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Click to toggle status"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
        active
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/70'
          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200/70'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {status}
    </button>
  );
}

export default function CRMSystemSetupPage() {
  // Lead stages are server configuration (`/crm/stages/`) used by stage-task automation.
  const storeLeadStages = useCrmStore((s) => s.stages);
  const [leadStages, setLeadStages] = useState([]);

  useEffect(() => { setLeadStages(storeLeadStages); }, [storeLeadStages]);
  const [leadQuery, setLeadQuery] = useState('');
  const [leadFilter, setLeadFilter] = useState('All');
  const [leadModal, setLeadModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [actionError, setActionError] = useState('');
  const [dragLead, setDragLead] = useState(null);

  const leadSyncedRef = useRef('');

  // Declared before the sync effects below that call it.
  const reportActionError = (err) =>
    setActionError(describeError(err) || 'Could not save the stage change. Please try again.');

  /**
   * Hold the write-back closed until the store has actually loaded. Before
   * that the two lists can legitimately disagree (a failed pull leaves the
   * previous rows in place), and syncing a half-filled list against a full one
   * is how a transient state turned into real writes.
   */
  const syncStatus = useCrmStore((s) => s.status);
  const stagesHydrated = Boolean(syncStatus?.loaded) && !syncStatus?.loading;

  useEffect(() => {
    if (!stagesHydrated) return;
    if (leadStages.length === 0) return;
    const key = JSON.stringify(leadStages);
    if (key === leadSyncedRef.current) return;
    leadSyncedRef.current = key;
    syncStages('stages', leadStages, storeLeadStages, reportActionError);
  }, [leadStages, storeLeadStages, stagesHydrated]);

  const leadActive = useMemo(() => leadStages.filter((s) => s.status === 'Active').length, [leadStages]);
  const leadInactive = leadStages.length - leadActive;

  const visibleLeads = useMemo(() => {
    return leadStages.filter((s) => {
      if (leadFilter !== 'All' && s.status !== leadFilter) return false;
      if (leadQuery && !String(s.name ?? '').toLowerCase().includes(leadQuery.toLowerCase())) return false;
      return true;
    });
  }, [leadStages, leadQuery, leadFilter]);

  function openAddLead() {
    setLeadModal({ id: null, name: '', status: 'Active' });
  }

  function openEditLead(stage) {
    setLeadModal({ id: stage.id, name: stage.name, status: stage.status });
  }

  function saveLeadModal() {
    const name = leadModal.name.trim();
    if (!name) return;
    if (leadModal.id) {
      setLeadStages((prev) => prev.map((s) => (s.id === leadModal.id ? { ...s, name, status: leadModal.status } : s)));
    } else {
      const item = { id: `ld-${Date.now()}`, name, status: leadModal.status, count: 0, icon: 'user', bg: '#e8f1ff', fg: '#2563eb' };
      setLeadStages((prev) => [...prev, item]);
    }
    setLeadModal(null);
  }

  function duplicateLead(id) {
    const found = leadStages.find((s) => s.id === id);
    if (!found) return;
    setLeadStages((prev) => [...prev, { ...found, id: `ld-${Date.now()}`, name: `${found.name} Copy`, count: 0 }]);
  }

  /**
   * Delete now calls the server directly and awaits it. It used to only drop
   * the row from local state and leave the DELETE to the sync effect above,
   * where every failure was swallowed by `warn()` -- so a rejected request
   * (server down, expired token, no permission) made the row quietly reappear
   * with nothing on screen to explain why. Awaiting the call lets the error
   * surface and the row be restored deliberately rather than by side effect.
   */
  async function confirmDelete() {
    const modal = deleteModal;
    if (!modal) return;

    setDeleteModal(null);
    setLeadStages((prev) => prev.filter((s) => s.id !== modal.id));

    // A local id was never persisted, so there is nothing to ask the server.
    if (!isServerId(modal.id)) return;

    setActionError('');
    try {
      await useCrmStore.getState().deleteRecord('stages', modal.id);
    } catch (err) {
      // deleteRecord already put the row back in the store; mirror it into the
      // local list so the table matches even if the store effect has not run.
      setLeadStages((prev) => (prev.some((s) => s.id === modal.id) ? prev : [...prev, modal.row]));
      setActionError(describeError(err) || 'Could not delete the stage. Please try again.');
    }
  }

  function toggleLeadStatus(id) {
    setLeadStages((prev) => prev.map((s) => (s.id === id ? { ...s, status: s.status === 'Active' ? 'Inactive' : 'Active' } : s)));
  }

  function dropLead(targetIndex) {
    if (dragLead === null) return;
    setLeadStages((prev) => {
      const order = visibleLeads.map((s) => s.id);
      const fromId = order[dragLead];
      const toId = order[targetIndex];
      if (!fromId || !toId || fromId === toId) return prev;
      const fromIdx = prev.findIndex((s) => s.id === fromId);
      const toIdx = prev.findIndex((s) => s.id === toId);
      const next = [...prev];
      const moved = next.splice(fromIdx, 1)[0];
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragLead(null);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="CRM System Setup"
        subtitle="Manage Lead Stages for your business process."
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'CRM', path: '/crm/leads' },
          { label: 'CRM System Setup' }
        ]}
      />

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-white border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle size={15} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-rose-900">Stage change not saved</p>
            <p className="text-xs text-rose-700 mt-0.5 leading-relaxed break-words">{actionError}</p>
          </div>
          <button type="button" onClick={() => setActionError('')} className="text-rose-400 hover:text-rose-600 p-1" aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div id="lead-panel" className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100">
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Users size={20} />
              </span>
              <div className="min-w-0">
                <h3 className="font-bold text-[16px] text-slate-800 leading-tight">Lead Stages</h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">Manage stages for your lead follow-up process.</p>
              </div>
            </div>
            <button type="button" onClick={openAddLead} className="btn-primary shrink-0 cursor-pointer">
              <Plus size={15} /> Add Lead Stage
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 bg-slate-50/40">
            <CrmKpiCard label="Total Stages" value={leadStages.length} icon={Users} tone="blue" />
            <CrmKpiCard label="Active" value={leadActive} icon={ShieldCheck} tone="emerald" />
            <CrmKpiCard label="Inactive" value={leadInactive} icon={GitBranch} tone="rose" />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 px-4 pt-3 pb-1">
            <div className="relative flex-1 w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={leadQuery}
                onChange={(e) => setLeadQuery(e.target.value)}
                placeholder="Search lead stages..."
                className="w-full h-9 border border-slate-200 rounded-lg pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white text-slate-800"
              />
            </div>
            <select
              value={leadFilter}
              onChange={(e) => setLeadFilter(e.target.value)}
              className="h-9 border border-slate-200 rounded-lg px-3 text-xs font-semibold text-slate-700 outline-none bg-white cursor-pointer hover:border-slate-300 w-full sm:w-auto"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50/75 border-y border-slate-200">
                  <th className="py-3 pl-4 pr-1 font-semibold w-12 text-center" title="Drag handle"></th>
                  <th className="py-3 px-3 font-semibold w-14 text-center">#</th>
                  <th className="py-3 px-4 font-semibold">Stage Name</th>
                  <th className="py-3 px-4 font-semibold w-36">Status</th>
                  <th className="py-3 px-4 font-semibold w-32 text-center">Leads</th>
                  <th className="py-3 px-6 font-semibold w-40 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleLeads.map((s, idx) => (
                  <tr
                    key={s.id}
                    draggable
                    onDragStart={() => setDragLead(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropLead(idx)}
                    className="hover:bg-blue-50/30 transition-colors group"
                  >
                    <td className="pl-4 pr-1 py-3 text-slate-300 group-hover:text-slate-400 cursor-grab active:cursor-grabbing text-center" title="Drag to reorder">
                      <div className="flex items-center justify-center">
                        <GripVertical size={16} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-500 font-semibold text-center">
                      {leadStages.findIndex((x) => x.id === s.id) + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 font-semibold text-slate-800">
                        <LeadStageIcon icon={s.icon} bg={s.bg} fg={s.fg} />
                        <span className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors">
                          {s.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={s.status} onToggle={() => toggleLeadStatus(s.id)} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100/90 text-slate-700 border border-slate-200">
                        <Users size={12} className="text-slate-400" />
                        {s.count ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditLead(s)}
                          className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-blue-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                          title="Edit Stage"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateLead(s.id)}
                          className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800 border border-slate-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                          title="Duplicate Stage"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModal({ id: s.id, name: s.name, row: s })}
                          className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                          title="Delete Stage"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleLeads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle size={24} className="text-slate-300" />
                        <span className="text-xs font-medium text-slate-500">No lead stages found matching your search.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing <strong className="text-slate-700 font-semibold">{visibleLeads.length}</strong> of <strong className="text-slate-700 font-semibold">{leadStages.length}</strong> stages
            </span>
            <span className="text-[11px] text-slate-400">
              Drag rows using <GripVertical size={12} className="inline -mt-0.5" /> to reorder pipeline sequence
            </span>
          </div>
        </div>

      </div>

      {leadModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-2 sm:p-4" onClick={() => setLeadModal(null)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">{leadModal.id ? 'Edit Lead Stage' : 'Add Lead Stage'}</h2>
              <button type="button" onClick={() => setLeadModal(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={16} /></button>
            </div>
            <div className="space-y-3 mt-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Stage Name *</label>
                <input value={leadModal.name} onChange={(e) => setLeadModal({ ...leadModal, name: e.target.value })} placeholder="e.g. New Lead" className="mt-1 w-full h-10 border border-slate-200 rounded-lg px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Status</label>
                <select value={leadModal.status} onChange={(e) => setLeadModal({ ...leadModal, status: e.target.value })} className="mt-1 w-full h-10 border border-slate-200 rounded-lg px-3 text-sm outline-none bg-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setLeadModal(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={saveLeadModal} className="h-9 px-4 rounded-lg bg-[#1f6bff] text-white text-xs font-semibold hover:bg-blue-700">Save Stage</button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-2 sm:p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-sm p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 border border-red-100 flex items-center justify-center"><Trash2 size={17} /></div>
            <h2 className="text-sm font-bold text-slate-800 mt-3">Delete Lead Stage?</h2>
            <p className="text-xs text-slate-500 mt-1">Are you sure you want to delete <strong className="text-slate-700">{deleteModal.name}</strong>? This action is permanent.</p>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setDeleteModal(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={confirmDelete} className="h-9 px-4 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

