/**
 * The notification bell's model: every source it shows, turned into one row shape.
 *
 * Sources (all live; nothing here invents a notification or a count):
 * - the server feed (`GET /notifications/`, via the CRM digest's event rows)
 * - active alert incidents (`GET /alerts/incidents/?status=Active`)
 * - operational alerts derived from ERP collections (low stock, overdue invoices, ...)
 * - CRM task reminders and workflow nudges from the CRM digest
 *
 * Row shape:
 *   { key, source, kind, module, severity, title, desc, at, live, unread, path,
 *     eventId?, incidentId? }
 * `kind` is 'alert' | 'task' | 'update'; `severity` is 'critical' | 'warning' | 'normal'.
 * Only rows with an `eventId` have a read state the server keeps.
 */

export const MODULE_LABELS = {
  inventory: 'Inventory',
  qc: 'QC',
  crm: 'CRM',
  production: 'Production',
  projects: 'Projects',
  sales: 'Sales',
  accounts: 'Accounts',
  hr: 'HR',
  system: 'System',
};

// Alert engine keys (oscar-be/apps/core/alert_services.py) -> module.
const ALERT_MODULE = {
  production_update_missing: 'production',
  job_delayed: 'production',
  agency_pending_aging: 'production',
  loss_tolerance_exceeded: 'production',
  qc_rejection_high: 'qc',
  negative_stock: 'inventory',
  slow_moving_stock: 'inventory',
  combined_grey_stock_low: 'inventory',
  credit_limit_exceeded: 'accounts',
  vendor_bill_mismatch: 'accounts',
  below_cost_sale: 'sales',
  large_discount: 'sales',
  sample_overdue: 'sales',
};

const TASK_TYPES = new Set([
  'crm.task_assigned',
  'pms.task_assigned',
  'pms.stage_assigned',
  'pms.approval_requested',
  'hrms.asset_requested',
]);
const ALERT_TYPES = new Set(['system_alert', 'pms.delay_logged']);

/**
 * Where a server notification opens. Only routes the app actually serves:
 * notifications carry no project id, so PMS rows open the list screens, and
 * quotation rows have nowhere to go while that module is switched off.
 */
export function routeForNotification(entry) {
  if (!entry) return null;
  if (entry.path) return entry.path;
  if (entry.payload?.path) return entry.payload.path;
  const type = entry.type || '';
  switch (entry.entityType) {
    case 'CrmTask':
      return '/crm/tasks';
    case 'LeaveRequest':
      return '/employee/portal';
    case 'AssetRequest':
      return type === 'hrms.asset_requested' ? '/hrms/asset-requests' : '/employee/portal';
    case 'PmsStage':
      return type === 'pms.delay_logged' ? '/pms/delays' : '/pms/my-tasks';
    case 'PmsTask':
      return '/pms/my-tasks';
    case 'PmsApproval':
    case 'PmsDocument':
      return '/pms/projects';
    default:
      break;
  }
  if (type === 'system_alert') return '/administration/alerts';
  return null;
}

function moduleForServerRow(row) {
  const type = row.type || '';
  switch (row.category) {
    case 'crm':
      return 'crm';
    case 'hrms':
      return 'hr';
    case 'pms':
      return 'projects';
    case 'erp':
      return type.startsWith('sales.') ? 'sales' : 'system';
    default:
      return 'system';
  }
}

function kindForType(type) {
  if (ALERT_TYPES.has(type)) return 'alert';
  if (TASK_TYPES.has(type)) return 'task';
  return 'update';
}

function severityFromIncident(severity) {
  if (severity === 'Critical') return 'critical';
  if (severity === 'Warning') return 'warning';
  return 'normal';
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The bell's own wording of the incident title, minus the "[Critical] " the fan-out adds. */
function stripSeverityPrefix(title) {
  return String(title || '').replace(/^\[(Critical|Warning|Info)\]\s*/i, '');
}

export function buildNotificationRows({ events = [], incidents = [], erpAlerts = [], reminders = [], workflow = [] }) {
  const rows = [];

  // Each incident also fans out a `system_alert` notification; show it once,
  // as the incident, carrying that notification's read state.
  const alertEvents = new Map();
  events.forEach((event) => {
    if (event.type === 'system_alert' && event.entityId) alertEvents.set(String(event.entityId), event);
  });
  const shownIncidentIds = new Set();

  incidents.forEach((incident) => {
    const linked = alertEvents.get(String(incident.id));
    shownIncidentIds.add(String(incident.id));
    rows.push({
      key: `incident-${incident.id}`,
      source: 'incident',
      kind: 'alert',
      module: ALERT_MODULE[incident.alert_key] || 'system',
      severity: severityFromIncident(incident.severity),
      title: incident.title,
      desc: [incident.entity_number, incident.message].filter(Boolean).join(' · '),
      at: toDate(incident.created_at),
      live: false,
      unread: linked ? linked.unread : true,
      path: '/administration/alerts',
      eventId: linked?.eventId,
      incidentId: incident.id,
    });
  });

  events.forEach((event) => {
    if (event.type === 'system_alert' && shownIncidentIds.has(String(event.entityId))) return;
    const kind = kindForType(event.type);
    rows.push({
      key: event.id,
      source: 'server',
      kind,
      module: moduleForServerRow(event),
      severity: event.type === 'system_alert' && /^\[Critical\]/i.test(event.title) ? 'critical'
        : kind === 'alert' ? 'warning' : 'normal',
      title: stripSeverityPrefix(event.title),
      desc: event.desc,
      at: event.createdAt || null,
      live: false,
      unread: event.unread,
      path: event.path,
      eventId: event.eventId,
      entityType: event.entityType,
      entityId: event.entityId,
      meta: event.meta || null,
      actorName: event.actorName || '',
    });
  });

  erpAlerts.forEach((alert) => {
    rows.push({
      key: alert.id,
      source: 'erp',
      kind: 'alert',
      module: alert.module,
      severity: alert.severity || 'warning',
      title: alert.title,
      desc: alert.desc,
      at: null,
      live: true,
      unread: alert.unread,
      path: alert.path,
    });
  });

  reminders.forEach((reminder) => {
    rows.push({
      key: reminder.id,
      source: 'reminder',
      kind: 'task',
      module: 'crm',
      severity: reminder.tone === 'overdue' ? 'critical' : reminder.tone === 'today' ? 'warning' : 'normal',
      title: reminder.title,
      desc: [reminder.subtitle, reminder.desc].filter(Boolean).join(' · '),
      at: reminder.dueDate || null,
      dueLabel: reminder.time,
      live: false,
      unread: reminder.unread,
      path: reminder.path,
    });
  });

  workflow.forEach((item) => {
    rows.push({
      key: item.id,
      source: 'workflow',
      kind: item.tone === 'warning' ? 'task' : 'update',
      module: item.bucket === 'challan' ? 'sales' : 'crm',
      severity: item.tone === 'warning' ? 'warning' : 'normal',
      title: item.title,
      desc: item.desc,
      at: null,
      live: true,
      unread: item.unread,
      path: item.path,
    });
  });

  return rows;
}

// ── Grouping & time ────────────────────────────────────────────

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 'today' | 'upcoming' | 'yesterday' | 'earlier'. Live rows are current state, so today. */
export function dayBucket(row, now = new Date()) {
  if (row.live || !row.at) return 'today';
  const today = startOfDay(now).getTime();
  const day = startOfDay(row.at).getTime();
  if (day > today) return 'upcoming';
  if (day === today) return 'today';
  if (day === today - DAY_MS) return 'yesterday';
  return 'earlier';
}

const GROUP_ORDER = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['earlier', 'Earlier'],
  ['upcoming', 'Upcoming'],
];
const SEVERITY_RANK = { critical: 0, warning: 1, normal: 2 };

/** Rows grouped by day; within a day live/critical rows first, then newest first. */
export function groupRows(rows, now = new Date()) {
  const buckets = new Map(GROUP_ORDER.map(([id]) => [id, []]));
  rows.forEach((row) => buckets.get(dayBucket(row, now)).push(row));
  return GROUP_ORDER
    .map(([id, label]) => {
      const items = buckets.get(id).sort((a, b) => {
        const severity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (severity) return severity;
        if (a.live !== b.live) return a.live ? -1 : 1;
        const at = (b.at?.getTime() || 0) - (a.at?.getTime() || 0);
        return id === 'upcoming' ? -at : at;
      });
      return { id, label, items };
    })
    .filter((group) => group.items.length > 0);
}

export function formatRowTime(row, now = new Date()) {
  if (row.live) return 'Live';
  if (row.dueLabel) return row.dueLabel;
  if (!row.at) return '';
  const diff = now.getTime() - row.at.getTime();
  const minutes = Math.floor(diff / 60000);
  if (diff >= 0 && minutes < 1) return 'Just now';
  if (diff >= 0 && minutes < 60) return `${minutes}m`;
  const bucket = dayBucket(row, now);
  const clock = row.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (bucket === 'today') return clock;
  if (bucket === 'yesterday') return clock;
  return row.at.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'tasks', label: 'Tasks' },
];

/** A CRM task the row points at that is still open: the bell can complete it. */
export function openTaskOf(row) {
  if (row?.entityType !== 'CrmTask' || !row.entityId || !row.meta) return null;
  return row.meta.taskStatus && row.meta.taskStatus !== 'Completed' ? row.meta : null;
}

/** "Due 2 Nov" / "Overdue · 2 Nov" / "Completed" for task rows. */
export function taskLabel(row, now = new Date()) {
  const meta = row?.entityType === 'CrmTask' ? row.meta : null;
  if (!meta) return null;
  if (meta.taskStatus === 'Completed') return { text: 'Completed', tone: 'done' };
  if (!meta.dueDate) return { text: meta.taskStatus || 'Open', tone: 'normal' };
  const due = new Date(`${meta.dueDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const label = due.toLocaleDateString([], { day: 'numeric', month: 'short' }) + (meta.dueTime ? ` ${meta.dueTime}` : '');
  if (due < today) return { text: `Overdue · ${label}`, tone: 'overdue' };
  if (due.getTime() === today.getTime()) return { text: `Due today${meta.dueTime ? ` ${meta.dueTime}` : ''}`, tone: 'today' };
  return { text: `Due ${label}`, tone: 'normal' };
}

export function matchesFilter(row, filter) {
  if (filter === 'unread') return row.unread;
  if (filter === 'alerts') return row.kind === 'alert';
  if (filter === 'tasks') return row.kind === 'task';
  return true;
}

export function matchesSearch(row, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.title, row.desc, MODULE_LABELS[row.module], row.actorName, row.meta?.leadName]
    .some((text) => String(text || '').toLowerCase().includes(needle));
}
