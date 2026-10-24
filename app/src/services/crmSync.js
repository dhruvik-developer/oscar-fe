/**
 * crmSync — the CRM half of the API contract (api.md §9).
 *
 * The CRM endpoints already answer in the shape the screens read: a lead comes
 * back with `company`, `owner`, `amount` and the `…Count` badges already on it.
 * So most readers here only translate the two things that genuinely differ:
 *
 *   dates   — the API speaks `YYYY-MM-DD`, the tables render `DD/MM/YYYY`
 *   labels  — a lead carries `sourceId`/`stageId`; the filters show names
 *
 * Everything else passes through untouched, which is why these mappers are
 * short: the contract was written against these components.
 */
import { createSync, compact, asText, isServerId, describeError, isBackendEnabled } from './resourceSync';
import { normalizeSection, toApiSection, WRITABLE_LEAD_SECTIONS } from './leadDetailMap';
import { api } from './api';
import { formatDateDDMMYYYY, toISODate } from '../utils/dateUtils';
import { isLostLead } from './leadStatus';

export { isServerId, describeError, isBackendEnabled, normalizeSection, toApiSection, WRITABLE_LEAD_SECTIONS };

/** `DD/MM/YYYY`, `Today`, a Date or an ISO string → `YYYY-MM-DD` for the API. */
function isoOut(value) {
  if (!value) return undefined;
  return toISODate(value) || undefined;
}

/** `YYYY-MM-DD` → the `DD/MM/YYYY` the tables render. */
function displayIn(value) {
  return value ? formatDateDDMMYYYY(value) : value;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Two-letter monogram for the avatar chips, from the API's `name`. */
export function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/** Stable per-lead avatar tint when the server has not stored one. */
const AVATAR_PALETTE = [
  '#2F6FED', '#7C3AED', '#059669', '#EA580C', '#DB2777',
  '#0891B2', '#4F46E5', '#65A30D', '#9333EA', '#0D9488',
];

export function avatarColorFor(seed) {
  const key = String(seed || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// ── leads ───────────────────────────────────────────────────────────────────

function leadFromApi(row) {
  const isLost = isLostLead(row);
  const customValues = (row.customValues && typeof row.customValues === 'object')
    ? row.customValues
    : (row.custom_values && typeof row.custom_values === 'object' ? row.custom_values : undefined);
  const isConverted = Boolean(
    customValues?.isConverted ||
    row.isConverted ||
    row.status === 'Converted' ||
    row.party ||
    row.partyId ||
    row.converted_deal ||
    row.convertedDealId
  );
  return {
    ...asText(row, [
      'name', 'company', 'phone', 'email', 'owner', 'city', 'state',
      'country', 'jobTitle', 'industry', 'source',
    ]),
    id: row.id,
    leadNumber: row.leadNumber || row.lead_number || '',
    stageId: row.stageId || row.stage_id || '',
    status: isLost ? (row.status || row.stageName || 'Lost') : (isConverted ? 'Converted' : (row.status || row.stageName || '')),
    isLost,
    isConverted,
    sourceId: row.sourceId || row.source_id || undefined,
    ownerId: row.ownerId || row.owner_id || undefined,
    party: row.party || row.partyId || undefined,
    partyId: row.partyId || row.party || undefined,
    lostReason: row.lostReason || row.lost_reason || undefined,
    isPinned: row.isPinned ?? row.is_pinned ?? false,
    createdOn: displayIn(row.createdOn || row.created_on),
    customValues,
    photo: row.photo || customValues?.photo || undefined,
    avatarColor: row.avatarColor || row.avatar_color || avatarColorFor(row.id || row.name),
    amount: num(row.amount),
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    _synced: true,
  };
}

function serverIdOrUndefined(value) {
  return isServerId(value) ? value : undefined;
}

function leadToApi(lead) {
  // Keys must match the backend LeadSerializer's writable fields.
  // Read-only display fields (`status`, `source`/`owner` names, `leadNumber`,
  // `createdOn`) are intentionally omitted — sending them is silently ignored
  // server-side and confuses debugging. Relation names also matter: the API
  // field is `party`, not `partyId`, and `industry` is free text (no
  // `industryId` column exists).
  const party = serverIdOrUndefined(lead.party || lead.partyId);
  return compact({
    name: lead.name,
    company: lead.company || undefined,
    phone: lead.phone || undefined,
    email: lead.email || undefined,
    stageId: serverIdOrUndefined(lead.stageId) || undefined,
    ownerId: serverIdOrUndefined(lead.ownerId) || undefined,
    sourceId: serverIdOrUndefined(lead.sourceId) || undefined,
    party: party || undefined,
    lostReason: serverIdOrUndefined(lead.lostReason || lead.lostReasonId) || undefined,
    industry: lead.industry || undefined,
    jobTitle: lead.jobTitle || undefined,
    city: lead.city || undefined,
    state: lead.state || undefined,
    country: lead.country || undefined,
    amount: lead.amount !== undefined && lead.amount !== '' ? num(lead.amount) : undefined,
    latitude: lead.latitude ?? undefined,
    longitude: lead.longitude ?? undefined,
    avatarColor: lead.avatarColor || undefined,
    isPinned: lead.isPinned ?? undefined,
    customValues: lead.customValues || undefined,
  });
}

// ── deals ───────────────────────────────────────────────────────────────────

function dealFromApi(row) {
  return {
    ...asText(row, ['title', 'name', 'client', 'phone', 'status', 'source', 'assignedUser', 'notes', 'stage']),
    id: row.id,
    name: row.title || row.name,
    title: row.title || row.name,
    client: row.customerName || row.client || '',
    customerId: row.customerId || undefined,
    stage: row.stage || 'Draft',
    price: num(row.value ?? row.amount),
    value: num(row.value ?? row.amount),
    expectedCloseDate: displayIn(row.expectedCloseDate || row.expected_close_date),
    date: displayIn(row.expectedCloseDate || row.expected_close_date || row.created_at),
    _synced: true,
  };
}

function dealToApi(deal) {
  return compact({
    title: deal.title || deal.name,
    leadId: deal.leadId || undefined,
    customerId: deal.customerId || deal.partyId || undefined,
    stage: deal.stage || undefined,
    ownerId: deal.ownerId || undefined,
    value: deal.value !== undefined ? num(deal.value) : (deal.price !== undefined ? num(deal.price) : undefined),
    currency: deal.currency || undefined,
    probability: deal.probability !== undefined ? num(deal.probability) : undefined,
    expectedCloseDate: isoOut(deal.expectedCloseDate || deal.date),
    status: deal.status || undefined,
    lostReasonId: deal.lostReasonId || undefined,
    notes: deal.notes || undefined,
  });
}

// ── tasks ───────────────────────────────────────────────────────────────────

function taskFromApi(row) {
  return {
    ...asText(row, [
      'title', 'description', 'assigneeName', 'assigneeRole',
      'department', 'priority', 'status', 'source', 'dueTime', 'icon',
    ]),
    id: row.id,
    leadId: row.leadId || row.lead_id || undefined,
    dealId: row.dealId || row.deal_id || undefined,
    assigneeId: row.assigneeId || row.assignee_id || undefined,
    assigneeName: row.assigneeName || '',
    leadName: row.leadName || '',
    dueDate: displayIn(row.dueDate),
    dueTime: row.dueTime || row.due_time || '',
    startedAt: row.startedAt || row.started_at || undefined,
    endedAt: row.endedAt || row.ended_at || undefined,
    durationSeconds: row.durationSeconds ?? row.duration_seconds ?? 0,
    icon: row.icon || 'call',
    lead: row.leadName || '',
    owner: row.assigneeName || 'Unassigned',
    due: displayIn(row.dueDate),
    completionOutcome: row.outcome || '',
    completedBy: typeof row.completedBy === 'object'
      ? (row.completedBy?.name || '')
      : (row.completedBy || ''),
    followUpTaskId: row.followUpTask?.id || row.followUpTask || null,
    followUpTask: undefined,
    _synced: true,
  };
}

function taskToApi(task) {
  return compact({
    title: task.title || task.name,
    description: task.description || undefined,
    leadId: task.leadId || undefined,
    dealId: task.dealId || undefined,
    assigneeId: task.assigneeId || undefined,
    assigneeRole: task.assigneeRole || task.role || undefined,
    department: task.department || undefined,
    dueDate: isoOut(task.dueDate),
    dueTime: task.dueTime || task.taskTime || undefined,
    startedAt: task.startedAt || undefined,
    endedAt: task.endedAt || undefined,
    durationSeconds: task.durationSeconds ?? undefined,
    icon: task.icon || undefined,
    priority: task.priority || undefined,
    status: task.status || undefined,
    outcome: task.outcome || undefined,
    nextAction: task.nextAction || undefined,
  });
}

/** A named record with nothing but a label — sources, industries, reasons. */
const lookup = (path) => ({
  path,
  toApi: (row) => compact({
    name: row.name || row.label,
    isActive: row.isActive ?? undefined,
    color: row.color || undefined,
  }),
  fromApi: (row) => ({ ...row, label: row.name, _synced: true }),
});

export const CRM_RESOURCES = {
  leads: { path: '/crm/leads/', toApi: leadToApi, fromApi: leadFromApi },
  deals: { path: '/crm/deals/', toApi: dealToApi, fromApi: dealFromApi },
  tasks: { path: '/crm/tasks/', toApi: taskToApi, fromApi: taskFromApi },

  stages: {
    path: '/crm/stages/',
    toApi: (s) => compact({
      name: s.name,
      order: s.order ?? s.sequence,
      color: s.color || undefined,
      icon: s.icon || undefined,
      bg: s.bg || undefined,
      fg: s.fg || undefined,
      isWon: s.isWon ?? undefined,
      isLost: s.isLost ?? undefined,
      isActive: s.isActive ?? undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },

  dealStages: {
    path: '/crm/deal-stages/',
    toApi: (s) => compact({
      name: s.name,
      order: s.order ?? s.sequence,
      color: s.color || undefined,
      isWon: s.isWon ?? undefined,
      isLost: s.isLost ?? undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },

  sources: lookup('/crm/sources/'),
  industries: lookup('/crm/industries/'),
  lostReasons: lookup('/crm/lost-reasons/'),

  masterTasks: {
    path: '/crm/master-tasks/',
    // The API speaks `title`/`sort_order`/`duration_days`/`is_active` plus a
    // stage PK list; the screens speak `name`/`order`/`dueIn`/`status` plus
    // stage names. Both directions are translated here — sending `name`
    // without `title` used to 400 (title is required) and the optimistic row
    // was rolled back, so created tasks "vanished".
    toApi: (t) => {
      const ids = Array.isArray(t.stageIds) && t.stageIds.length > 0
        ? t.stageIds
        : (Array.isArray(t.stages) ? t.stages.filter((s) => isServerId(String(s))) : []);
      return compact({
        title: t.title || t.name,
        description: t.description || undefined,
        role: t.role || t.assigneeRole || undefined,
        department: t.department || undefined,
        priority: t.priority || undefined,
        order: t.order ?? t.sortOrder ?? undefined,
        dueIn: t.dueIn ?? t.offsetDays ?? undefined,
        stages: ids.length > 0 ? ids : undefined,
        isActive: t.isActive ?? (t.status != null ? t.status === 'Active' : undefined),
        icon: t.icon || undefined,
      });
    },
    fromApi: (row) => {
      const base = asText(row, ['description', 'role', 'department', 'priority']);
      const name = row.title || row.name || '';
      const stageNames = Array.isArray(row.stageNames) && row.stageNames.length > 0
        ? row.stageNames
        : (Array.isArray(row.stages) ? row.stages.filter((s) => !isServerId(String(s))) : []);
      const stageIds = Array.isArray(row.stages)
        ? row.stages.filter((s) => isServerId(String(s)))
        : (Array.isArray(row.stageIds) ? row.stageIds : []);
      const isActive = row.is_active ?? row.isActive ?? true;
      return {
        ...base,
        name,
        title: name,
        order: row.order ?? row.sort_order ?? row.sortOrder ?? 0,
        dueIn: row.dueIn ?? row.duration_days ?? 0,
        stages: stageNames,
        stageNames,
        stageIds,
        status: row.status ?? (isActive ? 'Active' : 'Inactive'),
        isActive,
        is_active: isActive,
        icon: row.icon || 'follow-up',
        _synced: true,
      };
    },
  },

  stageTasks: {
    path: '/crm/stage-tasks/',
    toApi: (t) => compact({
      stageId: t.stageId,
      name: t.name || t.title,
      description: t.description || undefined,
      role: t.role || t.assigneeRole || undefined,
      department: t.department || undefined,
      order: t.order ?? t.sortOrder ?? undefined,
      dueIn: t.dueIn ?? t.offsetDays ?? undefined,
      priority: t.priority || undefined,
      required: t.required ?? undefined,
      autoCreate: t.autoCreate ?? undefined,
      // Null is meaningful (cleared back to "create once") — only undefined
      // means "leave the server value alone".
      repeats: t.repeats === undefined ? undefined : t.repeats,
      isActive: t.isActive ?? undefined,
    }),
    fromApi: (row) => ({
      ...asText(row, ['name', 'description', 'role', 'department', 'priority', 'stageName']),
      title: row.title || row.name || '',
      _synced: true,
    }),
  },

  taskAllocations: {
    path: '/crm/task-allocations/',
    toApi: (a) => compact({
      title: a.title,
      description: a.description,
      assigneeId: a.assigneeId,
      department: a.department,
      priority: a.priority,
      deadline: a.deadline,
      status: a.status,
      fileName: a.fileName,
    }),
    fromApi: (row) => ({ ...asText(row, ['assignee', 'assignedBy', 'department']), _synced: true }),
  },

  userAllocations: {
    path: '/crm/user-allocations/',
    toApi: (a) => compact({
      userId: a.userId || a.assigneeId,
      role: a.role || undefined,
      department: a.department || undefined,
      stageId: a.stageId || undefined,
      isActive: a.isActive ?? undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },

  forms: {
    path: '/crm/forms/',
    // The builder edits `sections`/`fields` in the browser; the server keeps
    // the whole layout tree in the `schema` jsonb column (db.md §9.5), so
    // both directions translate here — sending the raw row would drop the
    // layout and wipe the form on round-trip. Display-only keys the table
    // reads (`description`, `status`, `iconName`, `lastUpdated`) have no
    // backend column either, so they ride inside `schema` too — otherwise a
    // refresh resets them to fallbacks like "No description provided".
    toApi: (f) => {
      const schemaSections = Array.isArray(f.sections)
        ? f.sections
        : (f.schema && Array.isArray(f.schema.sections) ? f.schema.sections : []);
      const schemaFields = Array.isArray(f.fields)
        ? f.fields
        : (f.schema && Array.isArray(f.schema.fields) ? f.schema.fields : []);
      const str = (value) => {
        const text = String(value ?? '').trim();
        return text || undefined;
      };
      return compact({
        name: f.name || f.title,
        slug: f.slug || undefined,
        kind: f.kind || 'lead',
        schema: {
          sections: schemaSections,
          fields: schemaFields,
          description: str(f.description ?? f.schema?.description) || '',
          status: str(f.status ?? f.schema?.status) || '',
          iconName: str(f.iconName ?? f.schema?.iconName) || '',
          lastUpdated: str(f.lastUpdated ?? f.schema?.lastUpdated) || '',
        },
        isPublished: f.isPublished ?? undefined,
      });
    },
    fromApi: (row) => {
      const schema = row.schema && typeof row.schema === 'object' ? row.schema : {};
      const sections = Array.isArray(row.sections)
        ? row.sections
        : (Array.isArray(schema.sections) ? schema.sections : []);
      const fields = Array.isArray(row.fields)
        ? row.fields
        : (Array.isArray(schema.fields)
          ? schema.fields
          : sections.flatMap((s) => (s.fields || []).map((f) => f.label)));
      const name = row.name || row.title || '';
      return {
        ...row,
        name,
        title: name,
        sections,
        fields,
        description: row.description || schema.description || '',
        status: row.status || schema.status || (row.isPublished ? 'ACTIVE' : 'INACTIVE'),
        iconName: row.iconName || schema.iconName || 'call',
        lastUpdated: row.lastUpdated || schema.lastUpdated || '',
        _synced: true,
      };
    },
  },

  projects: {
    path: '/crm/projects/',
    toApi: (p) => compact({
      name: p.name || p.title,
      code: p.code || p.projectNumber || undefined,
      dealId: p.dealId || p.sourceDealId || undefined,
      partyId: p.partyId || p.customerId || undefined,
      ownerId: p.ownerId || undefined,
      status: p.status || undefined,
      startDate: isoOut(p.startDate),
      endDate: isoOut(p.endDate || p.expectedEndDate),
      value: p.value !== undefined ? num(p.value) : undefined,
      progress: p.progress ?? undefined,
      description: p.description || p.notes || undefined,
      customerText: p.customerText || p.customer_text || undefined,
      ownerText: p.ownerText || p.owner_text || undefined,
      team: p.team || p.teamId || undefined,
      projectType: p.projectType || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      startDate: displayIn(row.startDate),
      endDate: displayIn(row.endDate),
      _synced: true,
    }),
  },

  contracts: {
    path: '/crm/contracts/',
    toApi: (c) => compact({
      title: c.title || c.name || [c.contractType, c.customer].filter(Boolean).join(' — ') || undefined,
      customerId: c.customerId || c.partyId || undefined,
      dealId: c.dealId || undefined,
      templateKey: c.templateKey || c.template || undefined,
      contractType: c.contractType || c.contract_type || undefined,
      status: c.status || undefined,
      value: c.value !== undefined ? num(c.value) : (c.amount !== undefined ? num(c.amount) : undefined),
      startDate: isoOut(c.startDate),
      endDate: isoOut(c.endDate),
      body: c.body || c.terms || undefined,
      description: c.description || undefined,
      expiringSoonDays: c.expiringSoonDays ?? undefined,
    }),
    fromApi: (row) => ({
      ...row,
      startDate: displayIn(row.startDate),
      endDate: displayIn(row.endDate),
      _synced: true,
    }),
  },
};

export const crmSync = createSync(CRM_RESOURCES, { label: 'crmSync' });

/** Everything the CRM shell needs on sign-in, in dependency order. */
export const CRM_PULL_ORDER = [
  'stages', 'dealStages', 'sources', 'industries', 'lostReasons',
  'leads', 'deals', 'tasks', 'masterTasks', 'stageTasks',
  'taskAllocations', 'userAllocations', 'forms', 'projects', 'contracts',
];

// ── endpoints that are not plain collections ────────────────────────────────

/** `GET /crm/team-roster/` — who can be assigned, grouped by role. */
export async function pullTeamRoster() {
  if (!isBackendEnabled()) return null;
  try {
    const body = await api.get('/crm/team-roster/');
    const roster = body?.roster || body || {};
    const members = [];
    const seen = new Set();
    Object.entries(roster).forEach(([role, people]) => {
      (people || []).forEach((person) => {
        if (!person) return;
        const key = String(person.id || person.name || '');
        if (!seen.has(key)) {
          seen.add(key);
          members.push({ ...person, role, roles: [role] });
        } else {
          const existing = members.find((m) => String(m.id || m.name || '') === key);
          if (existing) {
            existing.roles = existing.roles || [existing.role];
            if (!existing.roles.includes(role)) existing.roles.push(role);
          }
        }
      });
    });
    return { roster, members };
  } catch (err) {
    console.warn('[crmSync] pull team roster failed:', err?.message || err);
    return null;
  }
}

/** `GET /crm/dashboard/` — the tiles, computed server-side. */
export async function pullDashboard(query = {}) {
  if (!isBackendEnabled()) return null;
  try {
    return await api.get('/crm/dashboard/', { query });
  } catch (err) {
    console.warn('[crmSync] pull dashboard failed:', err?.message || err);
    return null;
  }
}

/** `GET /crm/leads/stats/` — the tab counts above the list. */
export async function pullLeadStats(query = {}) {
  if (!isBackendEnabled()) return null;
  try {
    return await api.get('/crm/leads/stats/', { query });
  } catch (err) {
    console.warn('[crmSync] pull lead stats failed:', err?.message || err);
    return null;
  }
}

/** `GET /crm/reports/{key}/` — one report, already aggregated. */
export async function pullReport(reportKey, query = {}) {
  if (!isBackendEnabled()) return null;
  try {
    return await api.get(`/crm/reports/${reportKey}/`, { query });
  } catch (err) {
    console.warn(`[crmSync] pull report ${reportKey} failed:`, err?.message || err);
    return null;
  }
}

/** The lead detail drawer's sub-collections (`/crm/leads/{id}/notes/`, …). */
export async function pullLeadDetail(leadId, section) {
  if (!isBackendEnabled() || !isServerId(leadId)) return null;
  try {
    const body = await api.get(`/crm/leads/${leadId}/${section}/`);
    const rows = Array.isArray(body) ? body : (body?.results || body || []);
    return normalizeSection(section, Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.warn(`[crmSync] pull lead ${section} failed:`, err?.message || err);
    return null;
  }
}

export async function pushLeadDetail(leadId, section, payload) {
  if (!isBackendEnabled() || !isServerId(leadId)) return null;
  if (!WRITABLE_LEAD_SECTIONS.has(section)) return null;
  const body = toApiSection(section, payload);
  // Rows with no server representation (file previews without a file record,
  // timeline/activity mirrors) stay local-only instead of 400ing.
  if (!body) return null;
  const saved = await api.post(`/crm/leads/${leadId}/${section}/`, body);
  const normalized = normalizeSection(section, [saved]);
  return normalized[0] || saved;
}

/** Edit one row in a lead's sub-collection (fabric requirements). */
export async function patchLeadSection(leadId, section, rowId, payload) {
  if (!isBackendEnabled() || !isServerId(leadId) || !isServerId(rowId)) return null;
  if (!WRITABLE_LEAD_SECTIONS.has(section)) return null;
  const body = toApiSection(section, payload);
  if (!body) return null;
  const saved = await api.patch(`/crm/leads/${leadId}/${section}/${rowId}/`, body);
  const normalized = normalizeSection(section, [saved]);
  return normalized[0] || saved;
}

/** Remove one row from a lead's sub-collection (lead users, …). */
export async function deleteLeadSection(leadId, section, rowId) {
  if (!isBackendEnabled() || !isServerId(leadId)) return null;
  // Local-only rows were never posted — there is nothing to DELETE.
  if (!isServerId(rowId)) return true;
  if (!WRITABLE_LEAD_SECTIONS.has(section)) return null;
  await api.delete(`/crm/leads/${leadId}/${section}/${rowId}/`);
  return true;
}

/** Edit or remove one row in a lead's sub-collection. */
export async function updateLeadNote(leadId, noteId, payload) {
  if (!isBackendEnabled() || !isServerId(leadId) || !isServerId(noteId)) return null;
  return api.patch(`/crm/leads/${leadId}/notes/${noteId}/`, payload);
}

export async function deleteLeadNote(leadId, noteId) {
  if (!isBackendEnabled() || !isServerId(leadId) || !isServerId(noteId)) return null;
  await api.delete(`/crm/leads/${leadId}/notes/${noteId}/`);
  return true;
}

/** `POST /crm/leads/{id}/convert/` — the lead becomes a party and/or a deal. */
export async function convertLead(leadId, payload = {}) {
  return crmSync.act('leads', leadId, 'convert', payload, { raw: true });
}

export async function setLeadPinned(leadId, pinned) {
  return crmSync.act('leads', leadId, pinned ? 'pin' : 'unpin', {}, { raw: true });
}

export async function completeTask(taskId, payload = {}) {
  return crmSync.act('tasks', taskId, 'complete', payload);
}

export async function reorderStages(orderedIds) {
  if (!isBackendEnabled()) return null;
  // The backend reads `order` (api.md §9.3); `ids` would 400.
  return api.post('/crm/stages/reorder/', { order: orderedIds });
}

export async function bulkDeleteLeads(ids) {
  if (!isBackendEnabled()) return null;
  return api.post('/crm/leads/bulk-delete/', { ids });
}

export async function markLeadLost(leadId, payload = {}) {
  if (!isBackendEnabled()) return null;
  return crmSync.act('leads', leadId, 'mark-lost', payload, { raw: true });
}

export async function bulkMarkLeadsLost(ids, payload = {}) {
  if (!isBackendEnabled()) return null;
  return api.post('/crm/leads/bulk-mark-lost/', { ids, ...payload });
}

export default crmSync;
