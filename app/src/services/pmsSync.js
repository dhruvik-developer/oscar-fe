/**
 * pmsSync — the PMS half of the API contract (api.md §10).
 *
 * PMS is the module where the server, not the browser, has to be the authority:
 * a stage handoff checks the prerequisites, advancing a stage recomputes the
 * project's completion, and a delay has to be visible to the people watching
 * the delay dashboard. So each verb below is the endpoint that owns that rule,
 * and the store applies the project the server returns rather than its own
 * guess at the result.
 *
 * `GET /pms/projects/` returns the list without stages; the detail endpoint
 * returns them nested, so `pullProjects` hydrates each project once and the
 * screens keep reading `project.stages` exactly as before.
 */
import { createSync, compact, mapWithLimit, isBackendEnabled, isServerId, describeError } from './resourceSync';
import { api } from './api';
import { uploadFileToBackend } from './fileUploadService';

export { isBackendEnabled, isServerId, describeError };

/** The two duration units a stage can be planned in (api.md §10.3). */
export const PMS_DURATION_UNITS = ['Hours', 'Days'];

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const PMS_RESOURCES = {
  projects: {
    path: '/pms/projects/',
    toApi: (p) => compact({
      crmOrderId: p.crmOrderId || undefined,
      crmCustomerId: p.crmCustomerId || p.customerId || undefined,
      customerName: p.customerName || undefined,
      productDetails: p.productDetails || undefined,
      projectManagerId: p.projectManagerId || p.projectManager?.id || undefined,
      priority: p.priority || undefined,
      status: p.status || undefined,
      startDate: p.startDate || undefined,
      expectedCompletionDate: p.expectedCompletionDate || undefined,
      paymentStatus: p.paymentStatus || undefined,
      requirementMeters: p.requirementMeters !== undefined ? num(p.requirementMeters) : undefined,
      dyeingSentMeters: p.dyeingSentMeters !== undefined ? num(p.dyeingSentMeters) : undefined,
      customerProjectReceivedMeters: p.customerProjectReceivedMeters !== undefined ? num(p.customerProjectReceivedMeters) : undefined,
      customerProjectTotalMeters: p.customerProjectTotalMeters !== undefined ? num(p.customerProjectTotalMeters) : undefined,
      customerProjectStatus: p.customerProjectStatus || undefined,
      ownProjectReceivedMeters: p.ownProjectReceivedMeters !== undefined ? num(p.ownProjectReceivedMeters) : undefined,
      ownProjectTotalMeters: p.ownProjectTotalMeters !== undefined ? num(p.ownProjectTotalMeters) : undefined,
      ownProjectStatus: p.ownProjectStatus || undefined,
      projectTypes: p.projectTypes || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      overallCompletionPct: num(row.overallCompletionPct),
      requirementMeters: num(row.requirementMeters ?? row.productDetails?.quantity ?? 0),
      dyeingSentMeters: num(row.dyeingSentMeters ?? 0),
      customerProjectReceivedMeters: num(row.customerProjectReceivedMeters ?? 0),
      customerProjectTotalMeters: num(row.customerProjectTotalMeters ?? row.requirementMeters ?? row.productDetails?.quantity ?? 0),
      customerProjectStatus: row.customerProjectStatus || (row.status === 'Completed' ? 'Fabric Received' : 'Pending'),
      ownProjectReceivedMeters: num(row.ownProjectReceivedMeters ?? 0),
      ownProjectTotalMeters: num(row.ownProjectTotalMeters ?? 0),
      ownProjectStatus: row.ownProjectStatus || 'Pending',
      paymentStatus: row.paymentStatus || 'Pending',
      projectTypes: Array.isArray(row.projectTypes) && row.projectTypes.length > 0 ? row.projectTypes : ['Customer Project', 'Own Project'],
      stages: (row.stages || []).map((s) => ({
        ...s,
        percentage: num(s.percentage ?? s.weightPct ?? s.weight ?? 0),
        weightPct: num(s.percentage ?? s.weightPct ?? s.weight ?? 0),
      })),
      activityLog: row.activityLog || [],
      _synced: true,
    }),
  },

  stageConfigs: {
    path: '/pms/stage-configs/',
    toApi: (c) => compact({
      name: c.name,
      description: c.description || undefined,
      sequence: c.sequence ?? undefined,
      departmentId: c.departmentId || undefined,
      department: c.department || undefined,
      defaultDuration: c.defaultDuration !== undefined ? num(c.defaultDuration) : undefined,
      durationUnit: c.durationUnit || undefined,
      assignedRole: c.assignedRole || undefined,
      requiredApproval: c.requiredApproval ?? undefined,
      requiredDocument: c.requiredDocument ?? undefined,
      isActive: c.isActive ?? undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },

  departments: {
    path: '/pms/departments/',
    toApi: (d) => compact({
      name: d.name,
      color: d.color || undefined,
      capacity: d.capacity !== undefined ? num(d.capacity) : undefined,
      isActive: d.isActive ?? undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },
};

export const pmsSync = createSync(PMS_RESOURCES, { label: 'pmsSync' });

/**
 * The project list, each project hydrated with its stages.
 *
 * The screens read `project.stages[]` everywhere, and the list endpoint omits
 * them, so this fans out to the detail endpoint. Projects whose detail read
 * fails keep the list row with an empty `stages`, rather than disappearing.
 */
export async function pullProjects() {
  const rows = await pmsSync.pull('projects');
  if (!rows) return null;
  const detailed = await mapWithLimit(
    rows,
    async (row) => (await pmsSync.pullOne('projects', row.id)) || row,
  );
  return detailed;
}

/** Re-read one project after the server changed it. */
export async function pullProject(projectId) {
  return pmsSync.pullOne('projects', projectId);
}

/** `GET /pms/settings/` — thresholds, notification flags, delay categories. */
export async function pullSettings() {
  if (!isBackendEnabled()) return null;
  try {
    return await api.get('/pms/settings/');
  } catch (err) {
    console.warn('[pmsSync] pull settings failed:', err?.message || err);
    return null;
  }
}

export async function pushSettings(settings) {
  if (!isBackendEnabled()) return null;
  return api.put('/pms/settings/', settings);
}

/** The people a stage can be assigned to. PMS reads the same roster as CRM. */
export async function pullEmployees() {
  if (!isBackendEnabled()) return null;
  try {
    const body = await api.get('/crm/team-roster/');
    const roster = body?.roster || body || {};
    const members = [];
    Object.entries(roster).forEach(([role, people]) => {
      (people || []).forEach((person) => members.push({
        ...person,
        role,
        department: person.department || '',
      }));
    });
    return members;
  } catch (err) {
    console.warn('[pmsSync] pull employees failed:', err?.message || err);
    return null;
  }
}

// ── project-level verbs ─────────────────────────────────────────────────────

const projectPath = (projectId) => `/pms/projects/${projectId}/`;
const stagePath = (projectId, stageId) => `${projectPath(projectId)}stages/${stageId}/`;

/** `POST /pms/projects/from-order/` — a sales order becomes a project. */
export async function createProjectFromOrder(payload) {
  if (!isBackendEnabled()) return null;
  return api.post('/pms/projects/from-order/', payload);
}

export async function applyStageTemplate(projectId, payload = {}) {
  if (!isBackendEnabled()) return null;
  return api.post(`${projectPath(projectId)}apply-stage-template/`, payload);
}

export async function completeProject(projectId, payload = {}) {
  if (!isBackendEnabled()) return null;
  return api.post(`${projectPath(projectId)}complete/`, payload);
}

export async function updateStagePercentages(projectId, payload = {}) {
  if (!isBackendEnabled()) return null;
  return api.post(`${projectPath(projectId)}stage-percentages/`, payload);
}

export async function getGreyStockAllocation(projectId) {
  if (!isBackendEnabled() || !projectId) return null;
  try {
    return await api.get(`${projectPath(projectId)}grey-stock-allocation/`);
  } catch (err) {
    console.warn('[pmsSync] get grey stock allocation failed:', err?.message || err);
    return null;
  }
}

export async function saveGreyStockAllocation(projectId, payload = {}) {
  if (!isBackendEnabled() || !projectId) return null;
  return api.post(`${projectPath(projectId)}grey-stock-allocation/`, payload);
}

export async function getProjectPurchaseOrders(projectId) {
  if (!isBackendEnabled() || !projectId) return null;
  try {
    return await api.get(`${projectPath(projectId)}purchase-orders/`);
  } catch (err) {
    console.warn('[pmsSync] get purchase orders failed:', err?.message || err);
    return null;
  }
}

export async function createProjectPurchaseOrder(projectId, payload = {}) {
  if (!isBackendEnabled() || !projectId) return null;
  return api.post(`${projectPath(projectId)}purchase-orders/`, payload);
}

// ── stage verbs ─────────────────────────────────────────────────────────────

export async function addStage(projectId, payload) {
  if (!isBackendEnabled()) return null;
  return api.post(`${projectPath(projectId)}stages/`, payload);
}

export async function patchStage(projectId, stageId, payload) {
  if (!isBackendEnabled()) return null;
  return api.patch(stagePath(projectId, stageId), payload);
}

export async function deleteStage(projectId, stageId) {
  if (!isBackendEnabled()) return null;
  return api.delete(stagePath(projectId, stageId));
}

export async function assignStage(projectId, stageId, payload) {
  if (!isBackendEnabled()) return null;
  return api.post(`${stagePath(projectId, stageId)}assign/`, payload);
}

export async function startStage(projectId, stageId, payload = {}) {
  if (!isBackendEnabled()) return null;
  return api.post(`${stagePath(projectId, stageId)}start/`, payload);
}

export async function setStageProgress(projectId, stageId, payload) {
  if (!isBackendEnabled()) return null;
  return api.post(`${stagePath(projectId, stageId)}progress/`, payload);
}

export async function setStageStatus(projectId, stageId, payload) {
  if (!isBackendEnabled()) return null;
  return api.post(`${stagePath(projectId, stageId)}status/`, payload);
}

export async function completeStage(projectId, stageId, payload = {}) {
  if (!isBackendEnabled()) return null;
  return api.post(`${stagePath(projectId, stageId)}complete/`, payload);
}

/** The server checks the prerequisites before it lets a stage hand off. */
export async function handoffCheck(projectId, stageId) {
  if (!isBackendEnabled()) return null;
  try {
    return await api.get(`${stagePath(projectId, stageId)}handoff-check/`);
  } catch (err) {
    console.warn('[pmsSync] handoff check failed:', err?.message || err);
    return null;
  }
}

export async function handoffStage(projectId, stageId, payload = {}) {
  if (!isBackendEnabled()) return null;
  return api.post(`${stagePath(projectId, stageId)}handoff/`, payload);
}

// ── delays ──────────────────────────────────────────────────────────────────

export async function logDelay(projectId, stageId, payload) {
  if (!isBackendEnabled()) return null;
  return api.post(`${stagePath(projectId, stageId)}delay/`, payload);
}

export async function updateRecoveryPlan(projectId, stageId, payload) {
  if (!isBackendEnabled()) return null;
  return api.patch(`${stagePath(projectId, stageId)}delay/`, payload);
}

export async function resolveDelay(projectId, stageId, payload = {}) {
  if (!isBackendEnabled()) return null;
  return api.post(`${stagePath(projectId, stageId)}delay/resolve/`, payload);
}

// ── tasks and documents ─────────────────────────────────────────────────────

export async function addTask(projectId, stageId, payload) {
  if (!isBackendEnabled()) return null;
  return api.post(`${stagePath(projectId, stageId)}tasks/`, payload);
}

export async function patchTask(projectId, stageId, taskId, payload) {
  if (!isBackendEnabled()) return null;
  return api.patch(`${stagePath(projectId, stageId)}tasks/${taskId}/`, payload);
}

export async function deleteTask(projectId, stageId, taskId) {
  if (!isBackendEnabled()) return null;
  await api.delete(`${stagePath(projectId, stageId)}tasks/${taskId}/`);
  return true;
}

export async function addDocument(projectId, stageId, payload) {
  if (!isBackendEnabled()) return null;
  let fileId = payload?.fileId;
  if (!fileId) {
    const fallbackBlob = new Blob(
      [`%PDF-1.4\n% Proof: ${payload?.fileName || 'design'}\n`],
      { type: 'application/pdf' }
    );
    fileId = await uploadFileToBackend(
      fallbackBlob,
      payload?.fileName || 'design.pdf',
      'pms_document'
    );
  }

  const backendPayload = {
    fileId,
    docKey: payload?.docKey || payload?.fileName || 'design.pdf',
    comments: payload?.comments || '',
    is_proof: payload?.is_proof ?? true,
  };

  return api.post(`${stagePath(projectId, stageId)}documents/`, backendPayload);
}

export async function requestApproval(projectId, stageId, docId, payload = {}) {
  if (!isBackendEnabled()) return null;
  return api.post(`${stagePath(projectId, stageId)}documents/${docId}/request-approval/`, payload);
}

export async function decideDocument(projectId, stageId, docId, payload) {
  if (!isBackendEnabled()) return null;
  return api.post(`${stagePath(projectId, stageId)}documents/${docId}/decide/`, payload);
}

/** `POST /pms/projects/{id}/documents/{docId}/share/` — the client proof link. */
export async function shareDocument(projectId, docId, payload = {}) {
  if (!isBackendEnabled()) return null;
  return api.post(`${projectPath(projectId)}documents/${docId}/share/`, payload);
}

/** The same call, named for the store that issues links. */
export async function createDocumentShare(projectId, docId, payload = {}) {
  const body = await shareDocument(projectId, docId, payload);
  if (!body || typeof body !== 'object') return null;
  // The server returns `{ token, url, expiresAt, share }` — the token lives
  // top-level only (it is hashed at rest, so the nested share never carries
  // it). Merge it in or the link builds as `/pms/approve/undefined`.
  const share = body.share && typeof body.share === 'object' ? body.share : body;
  return {
    ...share,
    token: share.token ?? body.token ?? null,
    url: share.url ?? body.url ?? null,
  };
}

/** `GET /pms/documents/{docId}/shares/` — every link issued for a document. */
export async function pullDocumentShares(docId) {
  if (!isBackendEnabled() || !docId) return null;
  try {
    const body = await api.get(`/pms/documents/${docId}/shares/`);
    return Array.isArray(body) ? body : (body?.results || body?.shares || []);
  } catch (err) {
    console.warn('[pmsSync] pull document shares failed:', err?.message || err);
    return null;
  }
}

/** `POST /pms/shares/{token}/revoke/` — the link stops working for the recipient. */
export async function revokeDocumentShare(token, reason) {
  if (!isBackendEnabled() || !token) return null;
  return api.post(`/pms/shares/${token}/revoke/`, { reason });
}

/** `GET /public/pms/approve/{token}/` — public proof payload, no account needed. */
export async function fetchPublicShare(token) {
  if (!token) return null;
  return api.get(`/public/pms/approve/${token}/`);
}

/** `POST /public/pms/approve/{token}/decide/` — client decision, no account needed. */
export async function decidePublicShare(token, payload = {}) {
  if (!token) return null;
  return api.post(`/public/pms/approve/${token}/decide/`, payload);
}

// ── daily production entry link ─────────────────────────────────────────────

/** Absolute URL of a production entry link, for copying and sharing. */
export const productionLinkUrl = (token) => `${window.location.origin}/production-entry/${token}`;

/** `GET /pms/projects/{id}/production-link/` — the project's active link, or `null`. */
export async function fetchProductionLink(projectId) {
  const res = await api.get(`/pms/projects/${encodeURIComponent(projectId)}/production-link/`);
  return res?.link || null;
}

/** `POST …/production-link/` — issue the link; `regenerate` replaces the current token. */
export async function issueProductionLink(projectId, { regenerate = false } = {}) {
  const res = await api.post(
    `/pms/projects/${encodeURIComponent(projectId)}/production-link/`,
    { regenerate },
  );
  return res?.link || null;
}

/** `DELETE …/production-link/` — anyone holding the old link loses access. */
export async function revokeProductionLink(projectId) {
  await api.delete(`/pms/projects/${encodeURIComponent(projectId)}/production-link/`);
  return null;
}

/** `GET /public/production/{token}/` — instructions, employees and recent entries; no account needed. */
export async function fetchPublicProduction(token) {
  return api.get(`/public/production/${token}/`);
}

/** `POST /public/production/{token}/entries/` — record a daily entry; no account needed. */
export async function submitPublicProduction(token, payload) {
  return api.post(`/public/production/${token}/entries/`, payload);
}

// ── read-only views the server aggregates ───────────────────────────────────

async function readAggregate(path, query, label) {
  if (!isBackendEnabled()) return null;
  try {
    return await api.get(path, query ? { query } : undefined);
  } catch (err) {
    console.warn(`[pmsSync] ${label} failed:`, err?.message || err);
    return null;
  }
}

export const pullDashboard = (query) => readAggregate('/pms/dashboard/', query, 'dashboard');
export const pullDashboardOverview = (query) => readAggregate('/pms/dashboard/overview/', query, 'dashboard overview');
export const pullNavBadges = () => readAggregate('/pms/nav-badges/', null, 'nav badges');
export const pullMyProjects = (query) => readAggregate('/pms/my-projects/', query, 'my projects');
export const pullMyTasks = (query) => readAggregate('/pms/my-tasks/', query, 'my tasks');
export const pullDelays = (query) => readAggregate('/pms/delays/', query, 'delays');
export const pullDelayWatchlist = () => readAggregate('/pms/delays/watchlist/', null, 'delay watchlist');
export const pullTimeline = (query) => readAggregate('/pms/timeline/', query, 'timeline');
export const pullActivity = (query) => readAggregate('/pms/activity/', query, 'activity');
export const pullPmsReport = (key, query) => readAggregate(`/pms/reports/${key}/`, query, `report ${key}`);

export default pmsSync;
