/**
 * crmStore — every CRM screen's single source of truth, filled from the API.
 *
 * Before this existed each page imported a seed array and kept its own copy in
 * `useState`, so two screens could disagree and nothing ever reached the
 * server. Now `hydrate()` runs once per session and every mutation is a request
 * whose answer replaces the optimistic row (the server owns ids, lead numbers
 * and stage transitions — api.md §9).
 *
 * Writes are optimistic so the table does not flicker, and a rejection rolls
 * the row back rather than leaving a record that only exists in this tab.
 */
import { create } from 'zustand';
import { lazyStore } from '../services/lazyModules';
import { formatDateDDMMYYYY } from '../utils/dateUtils';
import {
  crmSync,
  CRM_PULL_ORDER,
  pullTeamRoster,
  pullLeadStats,
  convertLead as convertLeadRequest,
  setLeadPinned,
  completeTask as completeTaskRequest,
  bulkDeleteLeads,
  describeError,
  isBackendEnabled,
  isServerId,
} from '../services/crmSync';

const EMPTY = {
  leads: [],
  deals: [],
  tasks: [],
  stages: [],
  dealStages: [],
  sources: [],
  industries: [],
  lostReasons: [],
  masterTasks: [],
  stageTasks: [],
  taskAllocations: [],
  userAllocations: [],
  forms: [],
  projects: [],
  contracts: [],
};

/** Local placeholder id for an optimistic row, replaced by the server's. */
function tempId(prefix) {
  return `${prefix}-local-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}

/** Group a collection into `{label, count}` rows for the filter panel. */
function countBy(rows, pick) {
  const counts = new Map();
  rows.forEach((row) => {
    const label = pick(row);
    if (!label) return;
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

const useCrmStoreBase = create((set, get) => ({
  ...EMPTY,

  roster: {},
  teamMembers: [],
  leadStats: null,

  status: { loading: false, loaded: false, error: null, lastSyncAt: null },

  /**
   * Load everything the CRM shell reads. Collections whose request failed keep
   * whatever is already in the store instead of blanking the screen.
   */
  hydrate: async ({ force = false } = {}) => {
    if (!isBackendEnabled()) {
      set({ ...EMPTY, status: { loading: false, loaded: false, error: null, lastSyncAt: null } });
      return null;
    }
    if (get().status.loading) return null;
    if (get().status.loaded && !force) return null;

    set((s) => ({ status: { ...s.status, loading: true, error: null } }));
    try {
      const [collections, roster, stats] = await Promise.all([
        crmSync.pullMany(CRM_PULL_ORDER),
        pullTeamRoster(),
        pullLeadStats(),
      ]);
      set({
        ...collections,
        roster: roster?.roster || {},
        teamMembers: roster?.members || [],
        leadStats: stats || null,
        status: {
          loading: false,
          loaded: true,
          error: null,
          lastSyncAt: new Date().toISOString(),
        },
      });
      return collections;
    } catch (err) {
      set((s) => ({ status: { ...s.status, loading: false, error: describeError(err) } }));
      return null;
    }
  },

  /** Re-read one collection — after a convert, an import, a bulk action. */
  refresh: async (key) => {
    const rows = await crmSync.pull(key);
    if (rows) set({ [key]: rows });
    return rows;
  },

  /**
   * Generic create/update/delete. Every entity in `CRM_RESOURCES` gets the same
   * three verbs, so the pages below call `createRecord('leads', …)` rather than
   * each growing its own copy of this dance.
   */
  createRecord: async (key, record) => {
    const optimistic = { ...record, id: record.id || tempId(key), _pending: true };
    set((s) => ({ [key]: [optimistic, ...(s[key] || [])] }));
    try {
      const saved = await crmSync.create(key, record);
      if (!saved) {
        if (!isBackendEnabled()) {
          // Frontend-design mode: no server to confirm — the optimistic row
          // IS the record. Keep it (marked local) instead of dropping it.
          const local = { ...optimistic, _pending: false, _local: true };
          set((s) => ({
            [key]: (s[key] || []).map((r) => (r.id === optimistic.id ? local : r)),
          }));
          return local;
        }
        set((s) => ({ [key]: (s[key] || []).filter((r) => r.id !== optimistic.id) }));
        return null;
      }
      set((s) => ({
        [key]: (s[key] || []).map((r) => (r.id === optimistic.id ? saved : r)),
      }));
      return saved;
    } catch (err) {
      set((s) => ({ [key]: (s[key] || []).filter((r) => r.id !== optimistic.id) }));
      throw err;
    }
  },

  updateRecord: async (key, id, updates) => {
    const previous = (get()[key] || []).find((r) => r.id === id);
    set((s) => ({
      [key]: (s[key] || []).map((r) => (r.id === id ? { ...r, ...updates, _pending: true } : r)),
    }));
    try {
      const saved = await crmSync.update(key, id, updates);
      set((s) => ({
        [key]: (s[key] || []).map((r) => {
          if (r.id !== id) return r;
          return saved ? { ...r, ...saved, ...updates, _pending: false } : { ...r, ...updates, _pending: false };
        }),
      }));
      return saved;
    } catch (err) {
      if (previous) {
        set((s) => ({ [key]: (s[key] || []).map((r) => (r.id === id ? previous : r)) }));
      }
      throw err;
    }
  },

  deleteRecord: async (key, id) => {
    const previous = get()[key] || [];
    set({ [key]: previous.filter((r) => r.id !== id) });
    try {
      await crmSync.remove(key, id);
      return true;
    } catch (err) {
      set({ [key]: previous });
      throw err;
    }
  },

  // ── leads ─────────────────────────────────────────────────────────────────

  createLead: (lead) => get().createRecord('leads', lead),

  /**
   * Frontend-design mode: create the lead locally when there is no pipeline
   * stage to save it under (no stages configured / server unreachable).
   * The row mirrors the synced shape so the list, KPIs and detail page work
   * unchanged. Local rows vanish on refresh — the server never saw them.
   */
  createLeadLocal: (lead) => {
    const source = lead || {};
    const now = new Date();
    // Local-only row — mirror the server's L-001 sequence so the table
    // looks the same before the first sync. Next free number in-session.
    const existing = new Set(
      (get().leads || []).map((l) => String(l.leadNumber || l.lead_number || '')),
    );
    let seq = (get().leads || []).length + 1;
    let candidate = '';
    for (; ; seq += 1) {
      candidate = `L-${String(seq).padStart(3, '0')}`;
      if (!existing.has(candidate)) break;
    }
    const row = {
      id: tempId('lead'),
      leadNumber: candidate,
      name: source.name || 'Untitled Lead',
      company: source.company || '',
      phone: source.phone || '',
      email: source.email || '',
      jobTitle: source.jobTitle || '',
      industry: source.industry || '',
      city: source.city || '',
      state: source.state || '',
      country: source.country || 'India',
      owner: source.owner || '',
      ownerId: source.ownerId || undefined,
      source: source.source || '',
      sourceId: source.sourceId || undefined,
      stageId: source.stageId || '',
      status: 'New',
      createdOn: now.toISOString().slice(0, 10),
      amount: 0,
      photo: source.photo || source.customValues?.photo || '',
      customValues: source.customValues || undefined,
      _local: true,
    };
    set((s) => ({ leads: [row, ...(s.leads || [])] }));
    return row;
  },

  updateLead: (id, updates) => {
    // Local rows have no server record — update the store directly.
    if (!isServerId(id)) {
      set((s) => ({
        leads: (s.leads || []).map((l) => (l.id === id ? { ...l, ...updates } : l)),
      }));
      return Promise.resolve({ id, ...updates });
    }
    return get().updateRecord('leads', id, updates);
  },

  deleteLead: (id) => {
    if (!isServerId(id)) {
      set((s) => ({ leads: (s.leads || []).filter((l) => l.id !== id) }));
      return Promise.resolve(true);
    }
    return get().deleteRecord('leads', id);
  },

  deleteLeads: async (ids) => {
    const serverIds = (ids || []).filter((id) => isServerId(id));
    const previous = get().leads;
    set({ leads: previous.filter((l) => !ids.includes(l.id)) });
    if (serverIds.length === 0) return true;
    try {
      await bulkDeleteLeads(serverIds);
      return true;
    } catch (err) {
      set({ leads: previous });
      throw err;
    }
  },

  toggleLeadPin: async (id) => {
    const lead = get().leads.find((l) => l.id === id);
    if (!lead) return null;
    const pinned = !lead.isPinned;
    set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, isPinned: pinned } : l)) }));
    // Local rows have no server record — the store flip above is the save.
    if (!isServerId(id)) return pinned;
    try {
      await setLeadPinned(id, pinned);
      return pinned;
    } catch (err) {
      set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, isPinned: !pinned } : l)) }));
      throw err;
    }
  },

  /** The server creates the party and/or deal, so both collections re-read. */
  convertLead: async (id, payload) => {
    const result = await convertLeadRequest(id, payload);
    await Promise.all([get().refresh('leads'), get().refresh('deals')]);
    return result;
  },

  // ── tasks ─────────────────────────────────────────────────────────────────

  createTask: (task) => get().createRecord('tasks', task),
  updateTask: (id, updates) => get().updateRecord('tasks', id, updates),
  deleteTask: (id) => get().deleteRecord('tasks', id),

  /**
   * Frontend-design mode: local task row mirroring the synced shape
   * (taskFromApi), e.g. for follow-ups on a local lead the server never saw.
   */
  createTaskLocal: (task) => {
    const source = task || {};
    const dueDisplay = source.dueDate ? formatDateDDMMYYYY(source.dueDate) : '';
    const row = {
      id: tempId('task'),
      title: source.title || 'Untitled Task',
      description: source.description || '',
      leadId: source.leadId || '',
      lead: source.lead || '',
      owner: source.owner || 'Unassigned',
      assigneeId: source.assigneeId || undefined,
      dueDate: dueDisplay || source.dueDate || '',
      due: dueDisplay || source.due || '',
      priority: source.priority || 'Medium',
      status: source.status || 'Open',
      source: 'Manual',
      _local: true,
    };
    set((s) => ({ tasks: [row, ...(s.tasks || [])] }));
    return row;
  },

  completeTask: async (id, payload = {}) => {
    const saved = await completeTaskRequest(id, payload);
    if (saved?.id) {
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? saved : t)) }));
    } else {
      await get().refresh('tasks');
    }
    return saved;
  },

  // ── deals ─────────────────────────────────────────────────────────────────

  createDeal: (deal) => get().createRecord('deals', deal),
  updateDeal: (id, updates) => get().updateRecord('deals', id, updates),
  deleteDeal: (id) => get().deleteRecord('deals', id),

  /**
   * Frontend-design mode: local deal row mirroring the synced shape
   * (dealFromApi + the list columns), e.g. converting a local lead.
   */
  createDealLocal: (deal) => {
    const source = deal || {};
    const today = formatDateDDMMYYYY(new Date().toISOString().slice(0, 10));
    const title = source.title || source.name || 'Untitled Deal';
    const row = {
      id: tempId('deal'),
      name: title,
      title,
      client: source.client || '',
      phone: source.phone || '',
      price: Number(source.price ?? source.value ?? 0) || 0,
      value: Number(source.value ?? source.price ?? 0) || 0,
      stage: source.stage || 'Draft',
      leadId: source.leadId || '',
      expectedCloseDate: source.expectedCloseDate || '',
      date: source.date || today,
      assignedUser: source.assignedUser || '',
      ownerId: source.ownerId || undefined,
      product: source.product || '',
      source: source.source || '',
      _local: true,
    };
    set((s) => ({ deals: [row, ...(s.deals || [])] }));
    return row;
  },

  /** Reset on sign-out so the next user never sees the previous one's rows. */
  clear: () => set({
    ...EMPTY,
    roster: {},
    teamMembers: [],
    leadStats: null,
    status: { loading: false, loaded: false, error: null, lastSyncAt: null },
  }),
}));

// ── derived views the pages used to import as fixed arrays ──────────────────
//
// These are plain functions over a snapshot, called inside `useMemo`. As store
// selectors they would allocate a new array on every render and React would
// never see the state settle.

/** Tabs above the lead list: every active stage, with its live count. */
export function leadTabsFrom(leads = [], stages = []) {
  const active = stages.filter((stage) => stage.isActive !== false);
  return [
    { key: 'All Leads', label: 'All Leads', count: leads.length },
    ...active.map((stage) => ({
      key: stage.name,
      label: stage.name,
      count: leads.filter((l) => l.stageId === stage.id || l.status === stage.name).length,
    })),
  ];
}

export function statusFacetsFrom(leads = []) {
  return countBy(leads, (l) => l.status);
}

export function sourceFacetsFrom(leads = [], sources = []) {
  const byId = new Map(sources.map((s) => [s.id, s.name]));
  return countBy(leads, (l) => l.source || byId.get(l.sourceId));
}

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const useCrmStore = lazyStore(useCrmStoreBase, "crm");
export default useCrmStore;
