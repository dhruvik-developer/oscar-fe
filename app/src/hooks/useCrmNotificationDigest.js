import { useEffect, useMemo, useState } from 'react';
import { useERP } from '../context/ERPContext';
import { useIdleReady } from './useIdleReady';
import { loadEventNotifications, NOTIFICATION_EVENT } from '../services/crmEventNotifications';

const CRM_EVENT = 'crm:data-updated';
const LEADS_STORAGE_KEY = 'evenmore-crm-leads-v1';
const LEAD_DETAIL_STORAGE_KEY = 'evenmore-crm-lead-details-v1';
const TASK_ALLOCATION_STORAGE_KEY = 'crm-task-allocation-v1';
const CRM_TASKS_STORAGE_KEY = 'evenmore-crm-tasks-v1';

const EVENT_ENTITY_LABELS = {
  lead: 'Lead',
  task: 'Task',
  'lead-task': 'Task',
  quotation: 'Quotation',
  contract: 'Contract',
};

// These legacy keys used to hold CRM business rows in browser storage. Nothing
// writes them any more and business data is never read from the browser, so
// they resolve to empty; server-backed CRM events still feed the digest.
function readStoredValue(_key, fallback) {
  return fallback;
}

function loadCrmSnapshot() {
  return {
    leadRows: readStoredValue(LEADS_STORAGE_KEY, []),
    leadDetails: readStoredValue(LEAD_DETAIL_STORAGE_KEY, {}),
    allocationTasks: readStoredValue(TASK_ALLOCATION_STORAGE_KEY, []),
    eventItems: loadEventNotifications(),
  };
}

function formatEventTime(value, now) {
  const parsed = parseCrmDate(value);
  if (!parsed) return 'Recent';
  const diffMs = now.getTime() - parsed.getTime();
  if (diffMs < 0) return 'Recent';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function buildEventNotifications({ eventItems, now }) {
  return (eventItems || [])
    .filter((entry) => entry && entry.title)
    .map((entry) => ({
      id: `crm-event-${entry.id}`,
      eventId: entry.id,
      title: entry.title,
      subtitle: EVENT_ENTITY_LABELS[entry.entityType] || 'CRM',
      desc: entry.message || entry.title,
      time: formatEventTime(entry.createdAt, now),
      tone: 'info',
      unread: entry.status !== 'read',
      path: entry.path || '/crm',
      bucket: 'crm-event',
    }));
}

function parseCrmDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = String(value).trim();
  if (!text) return null;

  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,\s*|\s+)(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const meridiem = String(match[6] || '').toUpperCase();

  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  const parsed = new Date(year, month - 1, day, hour, minute);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sameDay(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function formatWhen(date, now) {
  const diffMs = date.getTime() - now.getTime();
  const absMinutes = Math.round(Math.abs(diffMs) / 60000);

  if (absMinutes < 60) {
    return diffMs < 0 ? `${absMinutes}m overdue` : `${absMinutes}m left`;
  }

  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) {
    return diffMs < 0 ? `${absHours}h overdue` : `${absHours}h left`;
  }

  const absDays = Math.round(absHours / 24);
  if (sameDay(date, now)) return 'Today';
  return diffMs < 0 ? `${absDays}d overdue` : `${absDays}d left`;
}

function toneForDue(date, now) {
  if (date.getTime() < now.getTime()) return 'overdue';
  if (sameDay(date, now)) return 'today';
  return 'upcoming';
}

function buildLeadTaskReminders({ leadRows, leadDetails, now }) {
  const reminders = [];
  const leadMap = new Map((leadRows || []).map((lead) => [String(lead.id), lead]));

  Object.entries(leadDetails || {}).forEach(([leadId, detail]) => {
    const lead = leadMap.get(String(leadId));
    const leadName = lead?.name || lead?.company || `Lead #${leadId}`;

    (detail?.tasks || []).forEach((task) => {
      if (!task || task.status === 'Completed') return;
      const dueDate = parseCrmDate(task.dueAt);
      if (!dueDate) return;
      const tone = toneForDue(dueDate, now);

      reminders.push({
        id: `lead-task-${leadId}-${task.id}`,
        title: task.title || 'Lead task',
        subtitle: leadName,
        desc: `${task.stage || 'Lead stage'}${task.assignee ? ` • ${task.assignee}` : ''}`,
        time: formatWhen(dueDate, now),
        dueDate,
        tone,
        unread: tone !== 'upcoming',
        path: `/crm/leads/${leadId}`,
        bucket: 'lead-task',
      });
    });
  });

  return reminders;
}

function buildAllocationReminders({ allocationTasks, now }) {
  return (allocationTasks || [])
    .filter((task) => task && task.status !== 'Completed' && task.deadline)
    .map((task) => {
      const dueDate = parseCrmDate(task.deadline);
      if (!dueDate) return null;
      const tone = toneForDue(dueDate, now);

      return {
        id: `allocation-${task.id}`,
        title: task.title || 'Allocated task',
        subtitle: task.assignee || 'Unassigned',
        desc: `${task.department || 'CRM'} • ${task.priority || 'Medium'} priority`,
        time: formatWhen(dueDate, now),
        dueDate,
        tone,
        unread: tone !== 'upcoming',
        path: `/crm/tasks/allocation/${task.id}`,
        bucket: 'allocation-task',
      };
    })
    .filter(Boolean);
}

function buildWorkflowNotifications({ leadRows, quotations, deliveryChallans }) {
  const notifications = [];
  const unmappedLeads = (leadRows || []).filter((lead) => !String(lead.owner || '').trim());

  if (unmappedLeads.length > 0) {
    notifications.push({
      id: 'lead-owner-gaps',
      title: `${unmappedLeads.length} lead${unmappedLeads.length > 1 ? 's' : ''} need owner assignment`,
      desc: 'Assign lead owners so follow-up reminders can route to the right team member.',
      time: 'Needs action',
      tone: 'warning',
      unread: true,
      path: '/crm/leads',
      bucket: 'lead-owner',
    });
  }

  const draftQuotes = (quotations || []).filter((quote) => ['Draft', 'Sent'].includes(String(quote.status || '')));
  if (draftQuotes.length > 0) {
    notifications.push({
      id: 'quotation-follow-up',
      title: `${draftQuotes.length} quotation${draftQuotes.length > 1 ? 's' : ''} waiting for follow-up`,
      desc: `${draftQuotes[0]?.quoteNumber || draftQuotes[0]?.customer || 'Latest quotation'} still needs CRM action.`,
      time: 'Follow-up',
      tone: 'info',
      unread: draftQuotes.length > 2,
      path: '/crm/quotations',
      bucket: 'quotation',
    });
  }

  const inTransitChallans = (deliveryChallans || []).filter((challan) => String(challan.status || '').toLowerCase().includes('transit'));
  if (inTransitChallans.length > 0) {
    notifications.push({
      id: 'challan-progress',
      title: `${inTransitChallans.length} delivery challan${inTransitChallans.length > 1 ? 's' : ''} in transit`,
      desc: 'Use CRM follow-ups to keep customers informed on active deliveries.',
      time: 'Logistics',
      tone: 'success',
      unread: false,
      path: '/sales/delivery',
      bucket: 'challan',
    });
  }

  const quietLeads = (leadRows || []).filter((lead) => {
    const status = String(lead.status || '').toLowerCase();
    if (['lost', 'lost lead', 'won', 'customer'].includes(status)) return false;
    const created = parseCrmDate(lead.createdOn);
    if (!created) return false;
    const ageMs = Date.now() - created.getTime();
    return ageMs > 5 * 24 * 60 * 60 * 1000 && Number(lead.openTasksCount || 0) === 0;
  });

  if (quietLeads.length > 0) {
    notifications.push({
      id: 'quiet-leads',
      title: `${quietLeads.length} lead${quietLeads.length > 1 ? 's' : ''} have no open follow-up`,
      desc: `${quietLeads[0]?.name || quietLeads[0]?.company || 'A lead'} has gone quiet without an active CRM task.`,
      time: 'Reminder',
      tone: 'warning',
      unread: true,
      path: '/crm/leads',
      bucket: 'lead-follow-up',
    });
  }

  // Unassigned automation tasks — warn admin to assign an employee
  const crmTasks = readStoredValue(CRM_TASKS_STORAGE_KEY, []);
  const unassignedAutoTasks = (crmTasks || []).filter(
    (t) =>
      t &&
      t.source === 'Created by Lead Stage Automation' &&
      (t.owner === 'Unassigned' || !t.owner) &&
      t.status !== 'Completed'
  );
  if (unassignedAutoTasks.length > 0) {
    notifications.push({
      id: 'unassigned-auto-tasks',
      title: `${unassignedAutoTasks.length} automated task${unassignedAutoTasks.length > 1 ? 's' : ''} need employee assignment`,
      desc: `"${unassignedAutoTasks[0]?.title || 'Task'}" for ${unassignedAutoTasks[0]?.lead || 'a lead'} is unassigned.`,
      time: 'Action needed',
      tone: 'warning',
      unread: true,
      path: '/crm/tasks',
      bucket: 'auto-task-unassigned',
    });
  }

  return notifications;
}

function sortItems(items, now) {
  return [...items].sort((left, right) => {
    const toneWeight = { overdue: 0, today: 1, upcoming: 2, warning: 3, info: 4, success: 5 };
    const leftWeight = toneWeight[left.tone] ?? 9;
    const rightWeight = toneWeight[right.tone] ?? 9;
    if (leftWeight !== rightWeight) return leftWeight - rightWeight;

    const leftDate = left.dueDate?.getTime?.() ?? now.getTime();
    const rightDate = right.dueDate?.getTime?.() ?? now.getTime();
    return leftDate - rightDate;
  });
}

function buildCrmNotificationDigest({ leadRows, leadDetails, allocationTasks, quotations, deliveryChallans, eventItems, now }) {
  const reminders = sortItems([
    ...buildLeadTaskReminders({ leadRows, leadDetails, now }),
    ...buildAllocationReminders({ allocationTasks, now }),
  ], now);
  const notifications = [
    ...buildEventNotifications({ eventItems, now }),
    ...buildWorkflowNotifications({ leadRows, quotations, deliveryChallans }),
  ];
  const urgentReminders = reminders.filter((item) => item.tone === 'overdue' || item.tone === 'today');
  const todayReminders = reminders.filter((item) => item.tone === 'today');
  const overdueReminders = reminders.filter((item) => item.tone === 'overdue');
  const unreadCount = reminders.filter((item) => item.unread).length + notifications.filter((item) => item.unread).length;

  return {
    reminders,
    notifications,
    spotlight: reminders.slice(0, 3),
    counts: {
      unread: unreadCount,
      urgent: urgentReminders.length,
      overdue: overdueReminders.length,
      today: todayReminders.length,
      total: reminders.length + notifications.length,
    },
  };
}

export function useCrmNotificationDigest() {
  // The digest hangs off the topbar on every screen, and reading a collection
  // is what pulls it — so these two wait for an idle moment rather than
  // competing with the page the user opened.
  const erp = useERP() || {};
  const digestReady = useIdleReady();
  const { quotations, deliveryChallans } = digestReady ? erp : {};
  const [snapshot, setSnapshot] = useState(() => loadCrmSnapshot());

  useEffect(() => {
    const sync = () => setSnapshot(loadCrmSnapshot());
    sync();

    window.addEventListener(CRM_EVENT, sync);
    window.addEventListener(NOTIFICATION_EVENT, sync);
    window.addEventListener('focus', sync);
    const timer = window.setInterval(sync, 15000);

    return () => {
      window.removeEventListener(CRM_EVENT, sync);
      window.removeEventListener(NOTIFICATION_EVENT, sync);
      window.removeEventListener('focus', sync);
      window.clearInterval(timer);
    };
  }, []);

  return useMemo(
    () => buildCrmNotificationDigest({
      leadRows: snapshot.leadRows,
      leadDetails: snapshot.leadDetails,
      allocationTasks: snapshot.allocationTasks,
      quotations,
      deliveryChallans,
      eventItems: snapshot.eventItems,
      now: new Date(),
    }),
    [deliveryChallans, quotations, snapshot]
  );
}
