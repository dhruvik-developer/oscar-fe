import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlarmClock,
  AlertTriangle,
  Archive,
  ArrowUpRight,
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  CheckCircle2,
  CircleDot,
  Eraser,
  ListChecks,
  FolderKanban,
  Package,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  MoreHorizontal,
  UserRound,
  Users,
  Wallet,
  Factory,
  X,
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useCrmNotificationDigest } from '../../hooks/useCrmNotificationDigest';
import { useIdleReady } from '../../hooks/useIdleReady';
import {
  clearReadNotifications,
  dismissNotification,
  getNotificationFeedState,
  markAllNotificationsRead,
  markEventNotificationRead,
  markEventNotificationUnread,
  NOTIFICATION_EVENT,
  refreshNotifications,
  snoozeNotification,
} from '../../services/crmEventNotifications';
import { api } from '../../services/api';
import { alertService } from '../../services/domainServices';
import {
  buildNotificationRows,
  FILTERS,
  formatRowTime,
  groupRows,
  matchesFilter,
  matchesSearch,
  MODULE_LABELS,
  openTaskOf,
  taskLabel,
} from '../../services/notificationCenter';

/** Snooze choices: minutes from now, or a computed time. */
const SNOOZE_OPTIONS = [
  { label: '1 hour', when: () => ({ minutes: 60 }) },
  { label: '3 hours', when: () => ({ minutes: 180 }) },
  {
    label: 'Tomorrow 9:00',
    when: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return { until: d.toISOString() };
    },
  },
  {
    label: 'Next week',
    when: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return { until: d.toISOString() };
    },
  },
];

const DESKTOP_KEY = 'oscar.notifications.desktop';

function readDesktopPref() {
  try {
    return window.localStorage.getItem(DESKTOP_KEY) === 'on';
  } catch {
    return false;
  }
}

/**
 * Browser notifications for new unread items while the tab is in the
 * background or the bell is closed. Opt-in per browser; needs the browser's
 * permission. Only rows that arrive after the page loaded are announced.
 */
function useDesktopAlerts(rows, enabled, onOpen) {
  const seen = useRef(null);
  useEffect(() => {
    const keys = new Set(rows.map((r) => r.key));
    if (seen.current === null) {
      seen.current = keys;
      return;
    }
    const fresh = rows.filter((r) => r.unread && !seen.current.has(r.key) && (r.eventId || r.incidentId));
    seen.current = keys;
    if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    fresh.slice(0, 3).forEach((row) => {
      try {
        const note = new Notification(row.title, { body: row.desc || MODULE_LABELS[row.module] || '', tag: row.key });
        note.onclick = () => {
          window.focus();
          onOpen(row);
          note.close();
        };
      } catch {
        // Some browsers only allow notifications from a service worker.
      }
    });
  }, [rows, enabled, onOpen]);
}

const MODULE_ICONS = {
  inventory: Package,
  qc: ShieldCheck,
  crm: Users,
  production: Factory,
  projects: FolderKanban,
  sales: ShoppingCart,
  accounts: Wallet,
  hr: UserRound,
  system: Bell,
};

const ROW_SELECTOR = '[data-notif-main]';

/**
 * Operational alerts read straight from ERP collections. Same rules the bell
 * has always used; each row is live state, so it clears when the data does.
 */
function useErpAlerts() {
  const erp = useERP();
  const ready = useIdleReady();
  const items = ready ? erp?.items : undefined;
  const deliveryChallans = ready ? erp?.deliveryChallans : undefined;
  const zoneRequests = ready ? erp?.zoneRequests : undefined;
  const invoices = ready ? erp?.invoices : undefined;

  return useMemo(() => {
    const list = [];
    const lowStock = (items || []).filter((i) => (i.availableQty ?? i.stock ?? 0) <= (i.reorderLevel || 5));
    if (lowStock.length > 0) {
      list.push({
        id: 'low-stock-alert',
        module: 'inventory',
        severity: 'warning',
        title: `Low stock on ${lowStock.length} SKU${lowStock.length > 1 ? 's' : ''}`,
        desc: lowStock.length > 1
          ? `${lowStock[0]?.name || 'Item'} and ${lowStock.length - 1} more are below safety stock.`
          : `${lowStock[0]?.name || 'Item'} is below safety stock.`,
        unread: true,
        path: '/inventory/items',
      });
    }
    const pendingZone = (zoneRequests || []).filter((z) => (z.status || '').toLowerCase() === 'pending');
    if (pendingZone.length > 0) {
      list.push({
        id: 'zone-request-alert',
        module: 'inventory',
        severity: 'normal',
        title: `${pendingZone.length} zone request${pendingZone.length > 1 ? 's' : ''} pending`,
        desc: 'Technician part requests awaiting warehouse dispatch approval.',
        unread: true,
        path: '/inventory/zone-requests',
      });
    }
    const inTransit = (deliveryChallans || []).filter((dc) => (dc.status || '').toLowerCase().includes('transit'));
    if (inTransit.length > 0) {
      list.push({
        id: 'transit-challan-alert',
        module: 'sales',
        severity: 'normal',
        title: `${inTransit.length} deliver${inTransit.length > 1 ? 'ies' : 'y'} in transit`,
        desc: 'Shipments currently out for customer delivery.',
        unread: false,
        path: '/sales/delivery',
      });
    }
    const overdue = (invoices || []).filter((inv) => (inv.status || '').toLowerCase() === 'overdue');
    if (overdue.length > 0) {
      list.push({
        id: 'overdue-inv-alert',
        module: 'accounts',
        severity: 'critical',
        title: `${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''}`,
        desc: 'Customer receivables overdue for payment collection.',
        unread: true,
        path: '/sales/invoices',
      });
    }
    return list;
  }, [items, zoneRequests, deliveryChallans, invoices]);
}

/** Active alert incidents and their badge, refreshed every 30s and on navigation. */
function useActiveIncidents() {
  const { pathname } = useLocation();
  const [state, setState] = useState({ list: [], badge: 0, status: 'loading' });

  const load = useCallback(async () => {
    const [badgeRes, listRes] = await Promise.allSettled([
      alertService.getIncidentBadge(),
      alertService.getIncidents({ status: 'Active' }),
    ]);
    // `api.get` resolves with the response body itself.
    setState((prev) => {
      const next = { ...prev };
      if (badgeRes.status === 'fulfilled') {
        const c = badgeRes.value?.activeCount ?? badgeRes.value?.count ?? 0;
        next.badge = Number(c) || 0;
      }
      if (listRes.status === 'fulfilled') {
        const body = listRes.value;
        const list = Array.isArray(body) ? body : body?.results || [];
        next.list = Array.isArray(list) ? list : [];
        next.status = 'ready';
      } else {
        next.status = 'error';
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = () => { if (!cancelled) load(); };
    tick();
    const timer = setInterval(tick, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pathname, load]);

  const acknowledge = useCallback(async (id) => {
    let removed;
    setState((prev) => {
      removed = prev.list.find((a) => a.id === id);
      return { ...prev, list: prev.list.filter((a) => a.id !== id), badge: Math.max(0, prev.badge - 1) };
    });
    try {
      await alertService.acknowledgeIncident(id);
      return true;
    } catch {
      if (removed) setState((prev) => ({ ...prev, list: [removed, ...prev.list], badge: prev.badge + 1 }));
      return false;
    } finally {
      load();
    }
  }, [load]);

  return { ...state, reload: load, acknowledge };
}

function useFeedState() {
  const [feed, setFeed] = useState(getNotificationFeedState);
  useEffect(() => {
    const sync = () => setFeed(getNotificationFeedState());
    window.addEventListener(NOTIFICATION_EVENT, sync);
    return () => window.removeEventListener(NOTIFICATION_EVENT, sync);
  }, []);
  return feed;
}

function IconButton({ label, onClick, children, disabled, active, className = '', ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-text hover:bg-soft disabled:opacity-40 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer ${active ? 'bg-soft text-text' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

const TASK_TONE = {
  overdue: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
  today: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  normal: 'bg-soft text-[var(--text-secondary)] border-border',
};

/** Avatar tint per module, so the source reads at a glance. */
const MODULE_TINT = {
  inventory: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  qc: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  crm: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  production: 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300',
  projects: 'bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300',
  sales: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  accounts: 'bg-lime-50 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300',
  hr: 'bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300',
  system: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
};
const SEVERITY_TINT = {
  critical: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
  warning: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
};
const ACCENT = { critical: 'bg-rose-500', warning: 'bg-amber-400' };

function Pill({ className = '', children }) {
  return <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-md border text-[10.5px] font-semibold leading-none ${className}`}>{children}</span>;
}

function QuickAction({ onClick, disabled, tone = 'default', children, ...rest }) {
  const tones = {
    default: 'text-[var(--text-secondary)] hover:text-text hover:bg-soft',
    primary: 'text-primary hover:bg-primary/10',
    danger: 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10',
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11.5px] font-semibold transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${tones[tone]}`}
      {...rest}>
      {children}
    </button>
  );
}

function NotificationRow({ row, now, onOpen, onToggleRead, onAcknowledge, onDismiss, onSnooze, onCompleteTask, busy }) {
  const alertIcon = row.kind === 'alert' && row.severity !== 'normal';
  const Icon = alertIcon ? AlertTriangle : (MODULE_ICONS[row.module] || Bell);
  const tint = alertIcon ? SEVERITY_TINT[row.severity] : (MODULE_TINT[row.module] || MODULE_TINT.system);
  const time = formatRowTime(row, now);
  const moduleLabel = MODULE_LABELS[row.module] || 'System';
  const canToggle = Boolean(row.eventId);
  const task = taskLabel(row, now);
  const openTask = openTaskOf(row);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const accent = ACCENT[row.severity] || (row.unread ? 'bg-primary' : '');
  const hasQuick = openTask || row.incidentId || canToggle || row.path;

  return (
    <li className={`notif-row group relative mx-2 my-1 rounded-xl border transition-colors ${row.unread ? 'bg-primary/[0.035] border-primary/15' : 'bg-card border-transparent hover:border-border'}`}>
      {accent && <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full ${accent}`} aria-hidden="true" />}
      <button
        type="button"
        data-notif-main
        onClick={() => onOpen(row)}
        className="w-full flex items-start gap-3 pl-3.5 pr-3 pt-3 pb-1.5 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 cursor-pointer"
        aria-label={`${row.unread ? 'Unread. ' : ''}${row.severity === 'critical' ? 'Critical. ' : ''}${row.title}. ${moduleLabel}${time ? `, ${time}` : ''}${row.path ? '. Opens record.' : ''}`}
      >
        <span className={`relative h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full ${tint}`}>
          <Icon size={16} strokeWidth={2} />
          {row.unread && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className={`min-w-0 flex-1 line-clamp-2 text-[13px] leading-[18px] ${row.unread ? 'font-semibold text-text' : 'font-medium text-[var(--text-secondary)]'}`}>
              {row.title}
            </span>
            <span className={`notif-row-time shrink-0 pt-px text-[11px] tabular-nums ${row.live ? 'text-primary font-semibold' : 'text-muted'}`}>
              {row.live ? (<span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />Live</span>) : time}
            </span>
          </span>
          {row.desc && <span className="mt-0.5 block line-clamp-2 text-[12px] leading-[17px] text-muted">{row.desc}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-1">
            <Pill className="border-border bg-card text-[var(--text-secondary)]">{moduleLabel}</Pill>
            {row.severity === 'critical' && <Pill className="border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30">Critical</Pill>}
            {row.severity === 'warning' && row.kind === 'alert' && <Pill className="border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30">Warning</Pill>}
            {task ? <Pill className={TASK_TONE[task.tone]}>{task.text}</Pill> : row.kind === 'task' && <Pill className={TASK_TONE.normal}>Task</Pill>}
            {row.actorName && <span className="text-[11px] text-muted truncate">by {row.actorName}</span>}
            {time && !row.live && <span className="notif-row-meta-time text-[11px] text-muted">{time}</span>}
          </span>
        </span>
      </button>

      {hasQuick && (
        <div className="flex flex-wrap items-center gap-0.5 pl-[58px] pr-3 pb-2">
          {openTask && (
            <QuickAction tone="primary" disabled={busy} onClick={() => onCompleteTask(row)}>
              <CheckCircle2 size={13} /> {busy ? 'Saving…' : 'Mark done'}
            </QuickAction>
          )}
          {row.incidentId && (
            <QuickAction tone="primary" onClick={() => onAcknowledge(row)}>
              <BellOff size={13} /> Acknowledge
            </QuickAction>
          )}
          {canToggle && (
            <span className="relative">
              <QuickAction aria-haspopup="menu" aria-expanded={snoozeOpen} onClick={() => setSnoozeOpen(!snoozeOpen)}>
                <AlarmClock size={13} /> Snooze
              </QuickAction>
              {snoozeOpen && (
                <div role="menu" className="absolute left-0 top-full mt-1 z-20 w-40 rounded-lg border border-border bg-card p-1 shadow-[var(--shadow-popover)]">
                  <p className="px-2 pt-1 pb-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">Remind me</p>
                  {SNOOZE_OPTIONS.map((opt) => (
                    <button key={opt.label} type="button" role="menuitem"
                      onClick={() => { setSnoozeOpen(false); onSnooze(row, opt.when()); }}
                      className="w-full text-left rounded-md px-2 py-1.5 text-[12px] text-text hover:bg-soft cursor-pointer">
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </span>
          )}
          {row.path && (
            <QuickAction onClick={() => onOpen(row)}>
              Open <ArrowUpRight size={13} />
            </QuickAction>
          )}
        </div>
      )}

      {canToggle && (
        <div className="notif-row-actions absolute right-2 top-2 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-sm">
          <IconButton label={row.unread ? 'Mark as read' : 'Mark as unread'} onClick={() => onToggleRead(row)}>
            {row.unread ? <Check size={14} /> : <CircleDot size={14} />}
          </IconButton>
          {!row.incidentId && (
            <IconButton label="Dismiss" onClick={() => onDismiss(row)}>
              <Archive size={14} />
            </IconButton>
          )}
        </div>
      )}
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="py-1" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex gap-3 mx-2 my-1 p-3 rounded-xl animate-pulse">
          <span className="h-9 w-9 rounded-full bg-soft" />
          <span className="flex-1 space-y-2 pt-0.5">
            <span className="block h-3 w-2/3 rounded bg-soft" />
            <span className="block h-2.5 w-11/12 rounded bg-soft" />
            <span className="block h-4 w-1/3 rounded bg-soft" />
          </span>
        </li>
      ))}
    </ul>
  );
}

const EMPTY_COPY = {
  all: ['You’re all caught up', 'New alerts, tasks and updates will appear here.'],
  unread: ['No unread notifications', 'Everything here has been read.'],
  alerts: ['No active alerts', 'Stock, QC, production and finance alerts will appear here.'],
  tasks: ['No pending tasks', 'Tasks and approvals assigned to you will appear here.'],
};

export default function NotificationCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [desktop, setDesktop] = useState(readDesktopPref);

  const rootRef = useRef(null);
  const bellRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const menuRef = useRef(null);

  const digest = useCrmNotificationDigest();
  const erpAlerts = useErpAlerts();
  const incidents = useActiveIncidents();
  const feed = useFeedState();

  const rows = useMemo(() => buildNotificationRows({
    events: digest.notifications.filter((n) => n.bucket === 'crm-event'),
    incidents: incidents.list,
    erpAlerts,
    reminders: digest.reminders,
    workflow: digest.notifications.filter((n) => n.bucket !== 'crm-event'),
  }), [digest, incidents.list, erpAlerts]);

  // Active incidents beyond the first page still count, as the old badge did.
  const hiddenIncidents = Math.max(0, incidents.badge - incidents.list.length);
  const unreadCount = rows.filter((r) => r.unread).length + hiddenIncidents;
  const serverUnread = rows.some((r) => r.eventId && r.unread);

  const counts = useMemo(() => ({
    all: rows.length,
    unread: rows.filter((r) => r.unread).length,
    alerts: rows.filter((r) => r.kind === 'alert').length,
    tasks: rows.filter((r) => r.kind === 'task').length,
  }), [rows]);

  const now = new Date();
  const inTab = rows.filter((r) => matchesFilter(r, filter) && matchesSearch(r, query));
  // Module chips: only the modules this tab actually has, with their counts.
  const moduleCounts = inTab.reduce((acc, r) => ({ ...acc, [r.module]: (acc[r.module] || 0) + 1 }), {});
  const modulesHere = Object.keys(moduleCounts).sort((a, b) => moduleCounts[b] - moduleCounts[a]);
  const activeModule = moduleFilter && moduleCounts[moduleFilter] ? moduleFilter : '';
  const visible = activeModule ? inTab.filter((r) => r.module === activeModule) : inTab;
  const groups = groupRows(visible, now);
  const hasRead = rows.some((r) => r.eventId && !r.unread);
  const criticalCount = rows.filter((r) => r.severity === 'critical' && r.kind === 'alert').length;
  const overdueTasks = rows.filter((r) => taskLabel(r, now)?.tone === 'overdue' || (r.kind === 'task' && r.severity === 'critical')).length;
  const summary = [
    unreadCount > 0 && `${unreadCount} unread`,
    criticalCount > 0 && `${criticalCount} critical`,
    overdueTasks > 0 && `${overdueTasks} overdue task${overdueTasks > 1 ? 's' : ''}`,
    counts.tasks > 0 && `${counts.tasks} task${counts.tasks > 1 ? 's' : ''}`,
  ].filter(Boolean);

  const loading = rows.length === 0 && (feed.status === 'idle' || feed.status === 'loading' || incidents.status === 'loading');
  const loadError = feed.status === 'error' || incidents.status === 'error';

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setMenuOpen(false);
    if (returnFocus) bellRef.current?.focus();
  }, []);

  // Fresh read whenever the panel opens.
  useEffect(() => {
    if (!open) return;
    refreshNotifications();
    incidents.reload();
    setActionError('');
    requestAnimationFrame(() => panelRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    function onPointer(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setMenuOpen(false);
      } else if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, []);

  const openRow = (row) => {
    if (row.eventId && row.unread) markEventNotificationRead(row.eventId);
    if (row.path) {
      close(false);
      navigate(row.path);
    }
  };

  const toggleRead = (row) => {
    if (!row.eventId) return;
    if (row.unread) markEventNotificationRead(row.eventId);
    else markEventNotificationUnread(row.eventId);
  };

  const acknowledge = async (row) => {
    setActionError('');
    const ok = await incidents.acknowledge(row.incidentId);
    if (ok && row.eventId && row.unread) markEventNotificationRead(row.eventId);
    if (!ok) setActionError('That alert could not be acknowledged. Please try again.');
  };

  const dismiss = async (row) => {
    setActionError('');
    const ok = await dismissNotification(row.eventId);
    if (ok) setActionNote('Dismissed. Find it under Archived in All notifications.');
    else setActionError('That notification could not be dismissed.');
  };

  const snooze = async (row, when) => {
    setActionError('');
    const ok = await snoozeNotification(row.eventId, when);
    if (ok) setActionNote('Snoozed. It will come back as unread.');
    else setActionError('That notification could not be snoozed.');
  };

  const completeTask = async (row) => {
    setActionError('');
    setBusyKey(row.key);
    try {
      await api.patch(`/crm/tasks/${row.entityId}/`, { status: 'Completed' });
      if (row.eventId && row.unread) markEventNotificationRead(row.eventId);
      refreshNotifications();
      setActionNote(`Task “${row.title.replace(/^New task:\s*/i, '')}” marked done.`);
    } catch (err) {
      setActionError(err?.message || 'The task could not be marked done.');
    } finally {
      setBusyKey('');
    }
  };

  const clearRead = async () => {
    setMenuOpen(false);
    const ok = await clearReadNotifications();
    if (!ok) setActionError('Read notifications could not be cleared.');
  };

  const toggleDesktop = async () => {
    setMenuOpen(false);
    setActionError('');
    if (desktop) {
      setDesktop(false);
      try { window.localStorage.setItem(DESKTOP_KEY, 'off'); } catch { /* per-browser preference only */ }
      return;
    }
    if (typeof Notification === 'undefined') {
      setActionError('This browser does not support desktop notifications.');
      return;
    }
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') {
      setActionError('Desktop notifications are blocked for this site in the browser settings.');
      return;
    }
    setDesktop(true);
    try { window.localStorage.setItem(DESKTOP_KEY, 'on'); } catch { /* per-browser preference only */ }
    setActionNote('Desktop notifications are on for this browser.');
  };

  const openFromDesktop = useCallback((row) => {
    if (row.eventId && row.unread) markEventNotificationRead(row.eventId);
    if (row.path) navigate(row.path);
  }, [navigate]);
  useDesktopAlerts(rows, desktop, openFromDesktop);

  useEffect(() => {
    if (!actionNote) return undefined;
    const timer = setTimeout(() => setActionNote(''), 4000);
    return () => clearTimeout(timer);
  }, [actionNote]);

  const retry = () => {
    refreshNotifications();
    incidents.reload();
  };

  const go = (path) => {
    close(false);
    navigate(path);
  };

  const onPanelKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (menuOpen) { setMenuOpen(false); return; }
      if (searchOpen && query) { setQuery(''); return; }
      close();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
    if (event.target.closest('[role="tablist"]') || event.target.closest('[role="menu"]')) return;
    const items = Array.from(panelRef.current?.querySelectorAll(ROW_SELECTOR) || []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement);
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'ArrowDown') next = index < 0 ? 0 : Math.min(items.length - 1, index + 1);
    else next = index <= 0 ? 0 : index - 1;
    event.preventDefault();
    items[next].focus();
  };

  const onTabKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = FILTERS.findIndex((f) => f.id === filter);
    const next = FILTERS[(index + (event.key === 'ArrowRight' ? 1 : FILTERS.length - 1)) % FILTERS.length];
    setFilter(next.id);
    panelRef.current?.querySelector(`[data-filter="${next.id}"]`)?.focus();
  };

  const [emptyTitle, emptyBody] = query.trim()
    ? ['No matches', `Nothing matches “${query.trim()}”${filter !== 'all' ? ' in this view' : ''}.`]
    : EMPTY_COPY[filter];

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={bellRef}
        type="button"
        onClick={() => (open ? close(false) : setOpen(true))}
        className="w-9 h-9 rounded-full border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-400/60 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center transition-all duration-200 cursor-pointer relative shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_3px_10px_rgba(37,99,235,0.12)] hover:-translate-y-px active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-full text-[9.5px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-[0_2px_5px_rgba(239,68,68,0.4)] animate-pulse tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          tabIndex={-1}
          onKeyDown={onPanelKeyDown}
          className="notif-panel top-dropdown-menu sm:w-[440px] p-0 flex flex-col overflow-hidden rounded-2xl focus:outline-none animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-3 bg-gradient-to-b from-primary/[0.07] to-transparent border-b border-border">
            <div className="flex items-start gap-3">
              <span className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                <Bell size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold text-text leading-5">Notifications</h2>
                <p className="mt-0.5 text-[12px] text-muted truncate">
                  {summary.length ? summary.join(' · ') : 'You’re all caught up'}
                </p>
              </div>
              <div className="flex items-center gap-0.5">
                <IconButton
                  label={searchOpen ? 'Close search' : 'Search notifications'}
                  active={searchOpen}
                  aria-expanded={searchOpen}
                  onClick={() => {
                    if (searchOpen) setQuery('');
                    setSearchOpen(!searchOpen);
                  }}
                >
                  <Search size={15} />
                </IconButton>
                <IconButton label="Mark all as read" onClick={markAllNotificationsRead} disabled={!serverUnread}>
                  <CheckCheck size={15} />
                </IconButton>
                <IconButton label="Alert settings" onClick={() => go('/administration/alerts?tab=settings')}>
                  <Settings2 size={15} />
                </IconButton>
                <div className="relative" ref={menuRef}>
                  <IconButton
                    label="More options"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    active={menuOpen}
                    onClick={() => setMenuOpen(!menuOpen)}
                  >
                    <MoreHorizontal size={15} />
                  </IconButton>
                  {menuOpen && (
                    <div role="menu" className="absolute right-0 top-full mt-1 z-10 w-56 rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-popover)]">
                      {[
                        { label: 'Refresh', icon: RefreshCw, run: () => { retry(); setMenuOpen(false); } },
                        { label: 'All notifications', icon: ListChecks, run: () => go('/notifications') },
                        ...(hasRead ? [{ label: 'Clear read notifications', icon: Eraser, run: clearRead }] : []),
                        { label: desktop ? 'Turn off desktop alerts' : 'Turn on desktop alerts', icon: BellRing, run: toggleDesktop },
                        { divider: true },
                        { label: 'Open Alert Center', icon: AlertTriangle, run: () => go('/administration/alerts') },
                        { label: 'Open CRM tasks', icon: Users, run: () => go('/crm/tasks') },
                        { label: 'Open my project tasks', icon: FolderKanban, run: () => go('/pms/my-tasks') },
                      ].map((item, i) => (item.divider ? <div key={`d${i}`} className="my-1 h-px bg-border" /> : (
                        <button
                          key={item.label}
                          type="button"
                          role="menuitem"
                          onClick={item.run}
                          className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-text hover:bg-soft focus-visible:bg-soft focus-visible:outline-none cursor-pointer"
                        >
                          <item.icon size={14} className="text-muted" />
                          {item.label}
                        </button>
                      )))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {searchOpen && (
              <label className="mt-3 flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <Search size={14} className="text-muted shrink-0" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, text, person or module"
                  aria-label="Search notifications"
                  className="w-full bg-transparent text-[12.5px] text-text placeholder:text-muted focus:outline-none"
                />
                {query && (
                  <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="Clear search" className="text-muted hover:text-text cursor-pointer">
                    <X size={14} />
                  </button>
                )}
              </label>
            )}

            {/* Filters: segmented */}
            <div role="tablist" aria-label="Filter notifications" onKeyDown={onTabKeyDown} className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-soft p-1">
              {FILTERS.map((f) => {
                const selected = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    data-filter={f.id}
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setFilter(f.id)}
                    className={`inline-flex items-center justify-center gap-1.5 h-7 rounded-lg text-[12px] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${selected ? 'bg-card text-text font-semibold shadow-sm' : 'text-muted hover:text-text font-medium'}`}
                  >
                    {f.label}
                    {counts[f.id] > 0 && (
                      <span className={`min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${selected ? 'bg-primary text-white' : 'bg-card text-muted'}`}>{counts[f.id]}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {criticalCount > 0 && filter !== 'alerts' && (
            <button type="button" onClick={() => { setFilter('alerts'); setModuleFilter(''); }}
              className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-left text-[12px] text-rose-800 hover:bg-rose-100 cursor-pointer dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-200">
              <span className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-full bg-rose-600 text-white"><AlertTriangle size={14} /></span>
              <span className="flex-1"><b>{criticalCount} critical alert{criticalCount > 1 ? 's' : ''}</b> need{criticalCount > 1 ? '' : 's'} attention</span>
              <span className="font-semibold">View →</span>
            </button>
          )}

          {modulesHere.length > 1 && (
            <div role="group" aria-label="Filter by module" className="flex items-center gap-1.5 px-3 pt-3 pb-1 overflow-x-auto">
              {['', ...modulesHere].map((m) => {
                const selected = activeModule === m;
                const ChipIcon = m ? (MODULE_ICONS[m] || Bell) : ListChecks;
                return (
                  <button key={m || 'all'} type="button" aria-pressed={selected} onClick={() => setModuleFilter(m)}
                    className={`shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11.5px] font-medium cursor-pointer transition-colors ${selected ? 'border-primary bg-primary text-white shadow-sm' : 'border-border bg-card text-[var(--text-secondary)] hover:text-text hover:bg-soft'}`}>
                    <ChipIcon size={12} />
                    {m ? MODULE_LABELS[m] || m : 'All'}
                    {m && <span className={`tabular-nums ${selected ? 'text-white/80' : 'text-muted'}`}>{moduleCounts[m]}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {actionNote && !actionError && (
            <div role="status" className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200">
              <CheckCircle2 size={14} className="shrink-0" />
              <span className="flex-1">{actionNote}</span>
            </div>
          )}

          {(loadError || actionError) && (
            <div role="alert" className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200">
              <AlertTriangle size={13} className="shrink-0" />
              <span className="flex-1">{actionError || 'Some notifications couldn’t be loaded.'}</span>
              {!actionError && (
                <button type="button" onClick={retry} className="font-semibold text-primary hover:underline cursor-pointer">Retry</button>
              )}
            </div>
          )}

          {/* List */}
          <div className="notif-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain pb-2">
            {loading ? (
              <SkeletonRows />
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center text-center px-6 py-12">
                <span className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 inline-flex items-center justify-center text-primary mb-3">
                  {query.trim() ? <Search size={22} /> : <CheckCheck size={22} />}
                </span>
                <p className="text-[14px] font-semibold text-text">{emptyTitle}</p>
                <p className="mt-1 text-[12px] text-muted max-w-[260px]">{emptyBody}</p>
              </div>
            ) : (
              groups.map((group) => (
                <section key={group.id} aria-label={group.label}>
                  <h3 className="sticky top-0 z-[1] flex items-center gap-2 px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted bg-card/95 backdrop-blur-sm">
                    {group.label}
                    <span className="h-4 min-w-4 px-1 inline-flex items-center justify-center rounded-full bg-soft text-[10px] tabular-nums normal-case tracking-normal">{group.items.length}</span>
                    <span className="flex-1 h-px bg-border" aria-hidden="true" />
                  </h3>
                  <ul>
                    {group.items.map((row) => (
                      <NotificationRow
                        key={row.key}
                        row={row}
                        now={now}
                        onOpen={openRow}
                        onToggleRead={toggleRead}
                        onAcknowledge={acknowledge}
                        onDismiss={dismiss}
                        onSnooze={snooze}
                        onCompleteTask={completeTask}
                        busy={busyKey === row.key}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-soft/50 text-[11.5px] text-muted">
            <span className="truncate">Live alerts clear once the issue is resolved.</span>
            <span className="shrink-0 flex items-center gap-1.5">
              <button type="button" onClick={() => go('/notifications')} className="h-7 px-2.5 rounded-lg border border-border bg-card font-semibold text-text hover:bg-soft cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                View all
              </button>
              <button type="button" onClick={() => go('/administration/alerts')} className="h-7 px-2.5 rounded-lg bg-primary font-semibold text-white hover:opacity-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                Alert Center
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
