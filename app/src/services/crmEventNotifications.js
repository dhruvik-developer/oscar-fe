import { useAppStore } from '../stores/appStore';
import { api } from './api';
import { isBackendEnabled, rowsOf } from './resourceSync';
import { loadDeals } from './dealService';

export const CRM_EVENT_TYPES = {
  LEAD_CREATED: 'LEAD_CREATED',
  TASK_CREATED: 'TASK_CREATED',
  QUOTATION_SENT: 'QUOTATION_SENT',
  QUOTATION_VIEWED: 'QUOTATION_VIEWED',
  CONTRACT_SIGNED: 'CONTRACT_SIGNED',
};

export const NOTIFICATION_CHANNELS = {
  in_app: 'ACTIVE',
  email: 'NOT_CONFIGURED',
  whatsapp: 'NOT_CONFIGURED',
  slack: 'NOT_CONFIGURED',
  telegram: 'NOT_CONFIGURED',
  sms: 'NOT_CONFIGURED',
  webhook: 'NOT_CONFIGURED',
};

export const NOTIFICATION_EVENT = 'crm:notifications-updated';

const SYNC_EVENT = 'crm:data-updated';

/**
 * The notification feed is the server's (`GET /notifications/`): it is raised
 * from the change itself, so every recipient sees it and it survives a reload.
 * This module keeps the last read in memory for the bell menu to render
 * synchronously, and refreshes it whenever something changes.
 */
let feed = [];

function readStore() {
  return feed;
}

/** `GET /notifications/` — the current feed for the signed-in user. */
export async function refreshNotifications() {
  if (!isBackendEnabled()) {
    feed = [];
    signalUpdate();
    return feed;
  }
  try {
    const body = await api.get('/notifications/', { query: { limit: 100 } });
    feed = rowsOf(body);
  } catch (err) {
    console.warn('[CRM] notifications unavailable:', err?.message || err);
  }
  signalUpdate();
  return feed;
}

function signalUpdate() {
  try {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(NOTIFICATION_EVENT));
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    return;
  }
}

function matchEmployeeId(name) {
  const label = String(name || '').trim();
  if (!label || /^unassigned$/i.test(label)) return null;
  try {
    const employees = useAppStore.getState()?.employees;
    if (Array.isArray(employees)) {
      const found = employees.find((entry) => String(entry?.name || '').trim().toLowerCase() === label.toLowerCase());
      if (found) return { id: found.id ?? found.name, name: found.name };
    }
  } catch {
    return null;
  }
  return null;
}

function resolveRecipient(name, fallback) {
  const label = String(name || '').trim() || String(fallback || '').trim();
  if (!label || /^unassigned$/i.test(label)) return null;
  const matched = matchEmployeeId(label);
  if (matched) return matched;
  return { id: label, name: label };
}

function resolveDealOwnerName(dealId) {
  if (dealId === undefined || dealId === null || dealId === '') return '';
  try {
    const deals = loadDeals();
    const deal = (deals || []).find((entry) => String(entry?.id) === String(dealId));
    return String(deal?.assignedUser || deal?.owner || '').trim();
  } catch {
    return '';
  }
}

function resolveRecipients(type, payload = {}) {
  switch (type) {
    case CRM_EVENT_TYPES.LEAD_CREATED:
      return [resolveRecipient(payload.ownerName)];
    case CRM_EVENT_TYPES.TASK_CREATED:
      return [resolveRecipient(payload.ownerName)];
    case CRM_EVENT_TYPES.QUOTATION_SENT: {
      const label = String(payload.customerId || payload.customerName || '').trim();
      if (!label) return [];
      return [{ id: payload.customerId || label, name: payload.customerName || label }];
    }
    case CRM_EVENT_TYPES.QUOTATION_VIEWED: {
      const owner = resolveDealOwnerName(payload.dealId) || String(payload.customerName || '').trim();
      return [resolveRecipient(owner)];
    }
    case CRM_EVENT_TYPES.CONTRACT_SIGNED:
      return [resolveRecipient(payload.ownerName)];
    default:
      return [];
  }
}

function defaultPath(type, entityId, payload = {}) {
  if (payload.path) return payload.path;
  switch (type) {
    case CRM_EVENT_TYPES.LEAD_CREATED:
      return `/crm/leads/${encodeURIComponent(entityId)}`;
    case CRM_EVENT_TYPES.TASK_CREATED:
      return '/crm/tasks';
    case CRM_EVENT_TYPES.QUOTATION_SENT:
    case CRM_EVENT_TYPES.QUOTATION_VIEWED:
      return '/crm/quotations';
    case CRM_EVENT_TYPES.CONTRACT_SIGNED:
      return `/crm/contracts/${encodeURIComponent(entityId)}`;
    default:
      return '/crm';
  }
}

function buildContent(type, payload = {}) {
  switch (type) {
    case CRM_EVENT_TYPES.LEAD_CREATED:
      return {
        title: 'New Lead Created',
        message: `New lead ${payload.leadRef || payload.leadName || 'record'} has been created and assigned to ${payload.ownerName || 'the sales team'}.`,
      };
    case CRM_EVENT_TYPES.TASK_CREATED:
      return {
        title: 'New Task Assigned',
        message: `You have been assigned a new task: ${payload.title || 'Untitled task'}.`,
      };
    case CRM_EVENT_TYPES.QUOTATION_SENT:
      return {
        title: 'Quotation Shared',
        message: `Quotation ${payload.quoteRef || 'record'} has been shared with ${payload.customerName || 'the customer'}.`,
      };
    case CRM_EVENT_TYPES.QUOTATION_VIEWED:
      return {
        title: 'Quotation Viewed',
        message: `${payload.customerName || 'The customer'} viewed quotation ${payload.quoteRef || 'record'}.`,
      };
    case CRM_EVENT_TYPES.CONTRACT_SIGNED:
      return {
        title: 'Contract Activated',
        message: `Contract ${payload.contractRef || 'record'} is now active.`,
      };
    default:
      return { title: 'CRM Update', message: 'A CRM record has been updated.' };
  }
}

const inAppProvider = {
  channel: 'in_app',
  deliver(record) {
    // The server raises and stores the notification; this only puts it in front
    // of the viewer straight away, before the next refresh confirms it.
    feed = [record, ...readStore()];
    return { delivered: true, channel: 'in_app', status: 'DELIVERED' };
  },
};

function notConfiguredProvider(channel) {
  return {
    channel,
    deliver() {
      return { delivered: false, channel, status: 'NOT_CONFIGURED' };
    },
  };
}

export const notificationProviders = {
  in_app: inAppProvider,
  email: notConfiguredProvider('email'),
  whatsapp: notConfiguredProvider('whatsapp'),
  slack: notConfiguredProvider('slack'),
  telegram: notConfiguredProvider('telegram'),
  sms: notConfiguredProvider('sms'),
  webhook: notConfiguredProvider('webhook'),
};

export function dispatchNotification(record, channels = ['in_app']) {
  const results = {};
  for (const channel of channels) {
    const provider = notificationProviders[channel];
    if (!provider) {
      results[channel] = { delivered: false, channel, status: 'UNKNOWN_CHANNEL' };
      continue;
    }
    try {
      results[channel] = provider.deliver(record);
    } catch {
      results[channel] = { delivered: false, channel, status: 'FAILED' };
    }
  }
  return results;
}

/**
 * The server raises the notification when the underlying record changes, so
 * there is nothing to create here. Callers still announce the event, and that
 * is taken as a cue to re-read the feed.
 */
export function emitCrmEvent({ type, entityId } = {}) {
  if (!type || !Object.values(CRM_EVENT_TYPES).includes(type)) return false;
  if (entityId === undefined || entityId === null || entityId === '') return false;
  refreshNotifications();
  return true;
}

export function loadEventNotifications() {
  return readStore().sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0));
}

export function markEventNotificationRead(id) {
  feed = feed.map((entry) => (entry.id === id && entry.status !== 'read'
    ? { ...entry, status: 'read', readAt: new Date().toISOString() }
    : entry));
  signalUpdate();
  // Read state belongs to the user, not the tab.
  if (isBackendEnabled()) {
    api.post(`/notifications/${id}/read/`, {}).catch((err) => {
      console.warn('[CRM] notification not marked read:', err?.message || err);
    });
  }
  return true;
}

/** `POST /notifications/read-all/` — clears the bell in one go. */
export function markAllNotificationsRead() {
  feed = feed.map((entry) => ({ ...entry, status: 'read', readAt: entry.readAt || new Date().toISOString() }));
  signalUpdate();
  if (isBackendEnabled()) {
    api.post('/notifications/read-all/', {})
      .then(refreshNotifications)
      .catch((err) => console.warn('[CRM] notifications not cleared:', err?.message || err));
  }
  return true;
}
