import { loadDeals, DEALS_STORAGE_KEY } from './dealService.js';
import { crmStorage } from './crmStorage.js';
import { crmSync, isBackendEnabled, isServerId } from './crmSync.js';
import { crmService } from './domainServices.js';
import { toISODate } from '../utils/dateUtils.js';

export const PROJECTS_STORAGE_KEY = 'evenmore-crm-projects-v1';
const DETAILS_KEY = 'evenmore-crm-lead-details-v1';
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * Backend-first persistence. The pages keep calling the functions below with
 * the same shapes, but every row that can live in Postgres does:
 *
 *   - `loadProjects()` merges the server cache (UUID rows) with the
 *     localStorage fallback (offline rows), matched by `backendId`.
 *   - creates/updates/deletes write through `/crm/projects/` (or the deal
 *     hand-off action) first and annotate the local row with `backendId`.
 *   - rows that cannot be represented server-side (no session, no linkable
 *     party/owner) keep the legacy local-only path instead of 400ing.
 */

/** Server rows fetched by the last `refreshProjectsCache()` (service shape). */
let serverProjectCache = [];

function apiProjectToServiceRow(server) {
  return {
    id: server.id,
    backendId: server.id,
    projectNumber: server.code || `P-${String(server.id).slice(0, 8).toUpperCase()}`,
    name: server.name || '',
    customer: server.customerName || server.customerText || server.customer_text || '',
    customerId: server.customerId || undefined,
    owner: server.ownerText || server.owner_text || '',
    ownerId: server.ownerId || server.owner || undefined,
    team: server.team || '',
    projectType: server.projectType || server.project_type || '',
    startDate: toISODate(server.startDate) || '',
    expectedEndDate: toISODate(server.endDate) || '',
    description: server.description || '',
    status: server.status || 'Active',
    sourceDealId: server.dealId || server.deal || null,
    value: server.value ?? undefined,
    progress: server.progress ?? 0,
    createdAt: server.createdAt || server.created_at || new Date().toISOString(),
    _synced: true,
  };
}

/** Pull `/crm/projects/` into the merge cache. Pages call this on mount. */
export async function refreshProjectsCache() {
  if (!isBackendEnabled()) return [];
  try {
    const rows = await crmSync.pull('projects');
    serverProjectCache = (rows || []).map(apiProjectToServiceRow);
    return serverProjectCache;
  } catch {
    return [];
  }
}

function serviceRowToApiPayload(project) {
  return {
    name: project.name,
    code: project.projectNumber?.startsWith('P-') ? undefined : project.projectNumber,
    dealId: isServerId(project.sourceDealId) ? project.sourceDealId : undefined,
    partyId: isServerId(project.customerId || project.partyId) ? (project.customerId || project.partyId) : undefined,
    ownerId: isServerId(project.ownerId) ? project.ownerId : undefined,
    status: project.status || undefined,
    startDate: project.startDate || undefined,
    endDate: project.expectedEndDate || undefined,
    description: project.description || undefined,
    customerText: project.customer || undefined,
    ownerText: project.owner || undefined,
    team: project.team || undefined,
    projectType: project.projectType || undefined,
  };
}

export function loadProjects(storage = crmStorage) {
  const local = readLocalProjects(storage);
  if (serverProjectCache.length === 0) return local;
  const byBackend = new Map(serverProjectCache.map((p) => [String(p.id), p]));
  const merged = local.map((p) => {
    if (p.backendId && byBackend.has(String(p.backendId))) {
      const server = byBackend.get(String(p.backendId));
      return { ...server, backendId: p.backendId };
    }
    return p;
  });
  const known = new Set([
    ...local.map((p) => String(p.backendId || p.id)),
    ...merged.map((p) => String(p.backendId || p.id)),
  ]);
  serverProjectCache.forEach((p) => {
    if (!known.has(String(p.id))) merged.push(p);
  });
  return merged;
}

function readLocalProjects(storage = crmStorage) {
  const value = JSON.parse(storage.getItem(PROJECTS_STORAGE_KEY) || '[]');
  if (!Array.isArray(value)) throw new Error('Saved project data is invalid.');
  let sequence = Math.max(0, ...value.map((project) => Number(/^P-(\d+)$/.exec(project.projectNumber || '')?.[1]) || 0));
  let changed = false;
  const numbered = [...value].reverse().map((project) => {
    if (project.projectNumber) return project;
    changed = true;
    return { ...project, projectNumber: `P-${String(++sequence).padStart(6, '0')}` };
  }).reverse();
  if (changed) storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(numbered));
  return numbered;
}

export function findDealProject(deal, storage = crmStorage) {
  const projects = loadProjects(storage);
  const byDeal = projects.find((project) => sameId(project.sourceDealId, deal?.id));
  if (deal?.projectId != null) {
    const linked = projects.find((project) => sameId(project.id, deal.projectId));
    if (!linked || !sameId(linked.sourceDealId, deal.id) || (byDeal && !sameId(byDeal.id, linked.id))) {
      throw new Error('The linked project reference is invalid.');
    }
    return linked;
  }
  return byDeal || null;
}

function notifyUpdated() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('crm:data-updated'));
}

function isValidCalendarDate(value) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!parts) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function assertValidDates(startDate, expectedEndDate) {
  for (const date of [startDate, expectedEndDate]) {
    if (date && !isValidCalendarDate(date)) throw new Error('Enter valid project dates.');
  }
  if (startDate && expectedEndDate && startDate > expectedEndDate) throw new Error('Expected end date must be on or after start date.');
}

function nextProjectNumber(projects) {
  const next = Math.max(0, ...projects.map((item) => Number(/^P-(\d+)$/.exec(item.projectNumber || '')?.[1]) || 0)) + 1;
  return `P-${String(next).padStart(6, '0')}`;
}

export function projectDefaults(deal) {
  return {
    name: deal.name || '', customer: deal.client || deal.company || '',
    owner: deal.assignedUser || deal.owner || '', team: deal.team || '',
    projectType: deal.projectType || '', startDate: '', expectedEndDate: '',
    description: deal.description || deal.notes || `Created from Deal ${deal.id}`,
  };
}

export async function createProjectFromDeal(dealId, input = {}, { storage = crmStorage, actor = 'CRM User' } = {}) {
  if (dealId == null || dealId === '') throw new Error('Deal ID is required.');
  const deals = loadDeals(storage);
  const deal = deals.find((item) => sameId(item.id, dealId));
  if (!deal) throw new Error('Deal was not found.');
  const existing = findDealProject(deal, storage);
  if (existing && sameId(deal.projectId, existing.id)) return { project: existing, created: false };
  if (deal.stage !== 'Won') throw new Error('Only a Won deal can create a project.');
  const defaults = projectDefaults(deal);
  if (!defaults.customer && !deal.customerId && !deal.partyId) throw new Error('Customer is missing. Update the deal first.');
  if (!defaults.owner && !deal.ownerId) throw new Error('Owner is missing. Update the deal first.');
  const name = String(input.name ?? defaults.name).trim();
  if (!name) throw new Error('Project name is required.');
  const startDate = input.startDate || '';
  if (!existing && !startDate) throw new Error('Start date is required.');
  const expectedEndDate = input.expectedEndDate || '';
  assertValidDates(startDate, expectedEndDate);
  const references = {};
  for (const field of ['customerId', 'partyId', 'ownerId', 'teamId', 'productId', 'products', 'product', 'quantity', 'price', 'source', 'sourceId', 'contactPerson', 'email', 'phone', 'company', 'files', 'attachments']) {
    if (deal[field] !== undefined) references[field] = deal[field];
  }
  for (const field of ['customerId', 'partyId', 'ownerId', 'teamId']) {
    if (references[field] != null && !['string', 'number'].includes(typeof references[field])) throw new Error(`Invalid ${field}.`);
  }
  const projects = loadProjects(storage);
  const nextNumber = Math.max(0, ...projects.map((item) => Number(/^P-(\d+)$/.exec(item.projectNumber || '')?.[1]) || 0)) + 1;
  const timestamp = new Date().toISOString();
  const project = existing || {
    ...references, ...defaults, id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectNumber: `P-${String(nextNumber).padStart(6, '0')}`,
    sourceDealId: deal.id, name, startDate, expectedEndDate,
    projectType: String(input.projectType ?? defaults.projectType).trim(),
    description: String(input.description ?? defaults.description), status: 'Active', createdAt: timestamp,
  };
  const activity = {
    id: `deal-project-${project.id}`, title: `Project ${project.projectNumber} created from Deal ${deal.id}`,
    time: timestamp, timestamp, actor, color: '#10b981', type: 'project-created', dealId: deal.id, projectId: project.id,
  };
  const append = (entries = []) => {
    if (!Array.isArray(entries)) throw new Error('Saved activity data is invalid.');
    return entries.some((item) => item.id === activity.id) ? entries : [activity, ...entries];
  };
  const updatedDeal = { ...deal, projectId: project.id, activities: append(deal.activities) };
  const writes = [];
  if (!existing) writes.push([PROJECTS_STORAGE_KEY, JSON.stringify([project, ...projects])]);
  if (deal.leadId != null) {
    const details = JSON.parse(storage.getItem(DETAILS_KEY) || '{}');
    if (!details || typeof details !== 'object' || Array.isArray(details)) throw new Error('Saved lead details are invalid.');
    const detail = details[String(deal.leadId)] || {};
    writes.push([DETAILS_KEY, JSON.stringify({ ...details, [String(deal.leadId)]: { ...detail, activities: append(detail.activities) } })]);
  }
  writes.push([DEALS_STORAGE_KEY, JSON.stringify(deals.map((item) => sameId(item.id, deal.id) ? updatedDeal : item))]);
  const previous = writes.map(([key]) => [key, storage.getItem(key)]);
  let written = 0;
  try {
    for (const [key, value] of writes) { storage.setItem(key, value); written += 1; }
  } catch (error) {
    for (const [key, value] of previous.slice(0, written).reverse()) {
      try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); }
      catch (rollbackError) { console.error('[CRM Project] Rollback failed:', key, rollbackError); }
    }
    throw error;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('crm:data-updated'));
  // Backend-first: the server links party/deal/owner/value itself and owns
  // the project row. The local row keeps its display number and carries the
  // server id for later updates. A 409 means another device already created
  // it — refresh and return the linked row instead of duplicating.
  if (!existing && isBackendEnabled() && isServerId(deal.id)) {
    try {
      const saved = await crmService.createDealProject(deal.id, { name });
      if (saved?.id) {
        project.backendId = saved.id;
        const rows = readLocalProjects(storage).map((item) =>
          sameId(item.id, project.id) ? { ...item, backendId: saved.id } : item,
        );
        storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(rows));
        await refreshProjectsCache().catch(() => {});
      }
    } catch (err) {
      if (err?.status === 409) {
        await refreshProjectsCache().catch(() => {});
        const linked = findDealProject(deal, storage);
        if (linked) return { project: linked, created: false };
      }
      console.warn('[CRM Project] backend hand-off failed, kept locally:', err?.message || err);
    }
  }
  return { project, created: !existing };
}

export async function createStandaloneProject(input = {}, { storage = crmStorage } = {}) {
  const name = String(input.name ?? '').trim();
  if (!name) throw new Error('Project name is required.');
  const customer = String(input.customer ?? input.client ?? '').trim();
  if (!customer) throw new Error('Customer is required.');
  const owner = String(input.owner ?? '').trim();
  if (!owner) throw new Error('Project manager is required.');
  const startDate = input.startDate || '';
  if (!startDate) throw new Error('Start date is required.');
  const expectedEndDate = input.expectedEndDate || '';
  assertValidDates(startDate, expectedEndDate);
  const projects = loadProjects(storage);
  const timestamp = new Date().toISOString();
  const project = {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectNumber: nextProjectNumber(projects),
    name,
    customer,
    owner,
    team: String(input.team ?? '').trim(),
    projectType: String(input.projectType ?? '').trim(),
    startDate,
    expectedEndDate,
    description: String(input.description ?? ''),
    status: input.status || 'Active',
    sourceDealId: input.sourceDealId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify([project, ...projects]));
  // Backend-first: same row, server-owned. Free-text names ride along in
  // customer_text/owner_text; linked ids resolve to party/user rows.
  if (isBackendEnabled()) {
    try {
      const saved = await crmSync.create('projects', serviceRowToApiPayload(project));
      if (saved?.id) {
        project.backendId = saved.id;
        const rows = readLocalProjects(storage).map((item) =>
          sameId(item.id, project.id) ? { ...item, backendId: saved.id } : item,
        );
        storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(rows));
      }
    } catch (err) {
      console.warn('[CRM Project] backend save failed, kept locally:', err?.message || err);
    }
  }
  notifyUpdated();
  return project;
}

export async function updateProject(projectId, patch = {}, { storage = crmStorage } = {}) {
  const projects = loadProjects(storage);
  const index = projects.findIndex((item) => sameId(item.id, projectId));
  if (index === -1) throw new Error('Project was not found.');
  const current = projects[index];
  const updated = { ...current };
  for (const field of ['name', 'customer', 'owner', 'team', 'projectType', 'description', 'status']) {
    if (patch[field] !== undefined) updated[field] = typeof patch[field] === 'string' ? patch[field].trim() : patch[field];
  }
  if (patch.startDate !== undefined) updated.startDate = patch.startDate || '';
  if (patch.expectedEndDate !== undefined) updated.expectedEndDate = patch.expectedEndDate || '';
  if (!updated.name) throw new Error('Project name is required.');
  if (!updated.customer && !updated.customerId && !updated.partyId) throw new Error('Customer is required.');
  if (!updated.owner && !updated.ownerId) throw new Error('Project manager is required.');
  if (!updated.startDate) throw new Error('Start date is required.');
  assertValidDates(updated.startDate, updated.expectedEndDate);
  updated.updatedAt = new Date().toISOString();
  if (current.backendId && isBackendEnabled() && isServerId(current.backendId)) {
    try {
      const saved = await crmSync.update('projects', current.backendId, serviceRowToApiPayload(updated));
      if (saved) Object.assign(updated, apiProjectToServiceRow({ ...saved, id: current.backendId }), { id: current.id, backendId: current.backendId, projectNumber: current.projectNumber });
    } catch (err) {
      console.warn('[CRM Project] backend update failed, kept locally:', err?.message || err);
    }
  }
  const next = projects.map((item, i) => (i === index ? updated : item));
  storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
  notifyUpdated();
  return updated;
}

export async function deleteProject(projectId, { storage = crmStorage } = {}) {
  const projects = loadProjects(storage);
  const project = projects.find((item) => sameId(item.id, projectId));
  if (!project) throw new Error('Project was not found.');
  if (project.backendId && isBackendEnabled() && isServerId(project.backendId)) {
    try {
      await crmSync.remove('projects', project.backendId);
    } catch (err) {
      console.warn('[CRM Project] backend delete failed:', err?.message || err);
    }
  }
  storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects.filter((item) => !sameId(item.id, projectId))));
  // Unlink from deal if linked
  try {
    const deals = loadDeals(storage);
    let changed = false;
    const nextDeals = deals.map((deal) => {
      if (sameId(deal.projectId, projectId) || sameId(deal.id, project?.sourceDealId)) {
        if (deal.projectId == null) return deal;
        changed = true;
        return { ...deal, projectId: null };
      }
      return deal;
    });
    if (changed) storage.setItem(DEALS_STORAGE_KEY, JSON.stringify(nextDeals));
  } catch { /* deals unlink is best-effort */ }
  notifyUpdated();
  return project;
}
