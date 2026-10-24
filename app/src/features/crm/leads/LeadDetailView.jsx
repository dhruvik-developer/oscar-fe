import { findDealForLead } from '../../../services/dealService';
import CrmKpiCard from '../common/CrmKpiCard';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useERP } from '../../../context/ERPContext';
import { formatCurrency } from '../../../utils/currencyUtils';
import {
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  FileStack,
  Info,
  ListChecks,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  CheckCircle,
  CheckCircle2,
  ClipboardCheck,
  ChevronUp,
  Play,
  Folder,
  Calendar,
  ArrowUp,
  ArrowDown,
  Eye,
  Send,
  UserCheck,
  Building2,
  Paperclip,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Clock,
  Check,
  CheckSquare,
  Square,
  FileText,
  Truck,
  Printer,
  Download,
  Upload,
  Globe,
  Tag,
  Megaphone,
  User,
  ChevronDown,
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  X,
  Users,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../../services/api';
import LeadFormBuilder from './LeadFormBuilder';
import { createFieldFromType } from '../../../data/crm/leadFormSchema';
import { exportToCSV } from '../../../services/exportUtils';
import { useCrmStore } from '../../../stores/crmStore';
import { withSampleTeam } from '../common/sampleTeam';
import { useLeadDetailStore, EMPTY_DETAIL } from '../../../stores/leadDetailStore';
import { isServerId, isBackendEnabled } from '../../../services/resourceSync';
import { crmService } from '../../../services/domainServices';
import { formatDateDDMMYYYY } from '../../../utils/dateUtils';
import { WRITABLE_LEAD_SECTIONS, normalizeSection } from '../../../services/leadDetailMap';
import { loadForms, saveForms, TASK_FORM } from '../../../services/crmForms';
import { LineItemEditor } from '../../../components/common/LineItemEditor';
import useUnits from '../../../hooks/useUnits';
import { loadCrmTasks, saveCrmTasks, runLeadStageAutomation, TASK_SOURCE_AUTOMATION } from '../../../services/leadStageAutomation';
import { emitCrmEvent, CRM_EVENT_TYPES } from '../../../services/crmEventNotifications';
import { useAppStore } from '../../../stores/appStore';
import { completeTaskWithOutcome, NEXT_ACTION_LABELS, getLeadStageOrder } from '../../../services/taskCompletionService';
import CompleteTaskModal from '../tasks/CompleteTaskModal';
import QuotationComposerPage from '../../sales/QuotationComposerPage';
import PageInfoButton from '../../../components/ui/PageInfoButton';
import MasterSourceLink from '../../../components/common/MasterSourceLink';

const DETAIL_TABS = [
  'General',
  'Users & Requirements',
  'Sources & Emails',
  'Files',
  'Tasks',
  'Quotations',
  'Delivery Challans',
  'Activity',
];

const DETAIL_TAB_ICONS = {
  General: Info,
  'Users & Requirements': UserCheck,
  'Sources & Emails': Globe,
  Files: FileStack,
  Tasks: ListChecks,
  Quotations: FileText,
  'Delivery Challans': Truck,
  Activity: Sparkles,
};

/**
 * The drawer used to keep a lead and its sections in two localStorage blobs.
 * Both now go to the API: the lead row through the CRM store, each section
 * through its own sub-collection endpoint.
 */
function updateStoredLead(leadId, updates) {
  if (!leadId || !updates || Object.keys(updates).length === 0) return false;
  useCrmStore.getState().updateLead(leadId, updates).catch((err) => {
    console.warn('[CRM] lead not saved:', err?.message || err);
  });
  return true;
}

/**
 * Persist rows a tab just produced. Each key is a sub-collection, and only the
 * rows the server has not seen are posted — the rest are already its own.
 *
 * Sections without a write endpoint (`timeline`, `tasks`, `activities`) are
 * skipped: there is no `POST /crm/leads/{id}/timeline/` to receive them.
 * Rows with no server representation (file previews without a file record)
 * are left local by the mapping layer instead of 400ing.
 *
 * Each local row is posted at most once per page lifetime. Without this, every
 * re-run of a tab's persist effect (StrictMode double-effect, parent
 * re-render, tab remount) re-posts all unsynced rows, so one click becomes
 * many server rows.
 */
const sentDetailRowIds = new Set();
function updateStoredLeadDetail(leadId, updates) {
  if (!leadId || !updates || Object.keys(updates).length === 0) return false;
  const { add } = useLeadDetailStore.getState();
  Object.entries(updates).forEach(([section, rows]) => {
    if (!Array.isArray(rows)) return;
    if (!WRITABLE_LEAD_SECTIONS.has(section)) return;
    rows
      .filter((row) => row && !row._synced && !isServerId(row.id) && row.id && !sentDetailRowIds.has(row.id))
      .forEach((row) => {
        sentDetailRowIds.add(row.id);
        add(leadId, section, row).catch((err) => {
          console.warn(`[CRM] ${section} not saved:`, err?.message || err);
        });
      });
  });
  return true;
}

function limitItems(items, count) {
  if (!Array.isArray(items)) return [];
  const normalizedCount = Number(count);
  if (!Number.isFinite(normalizedCount)) return items;
  if (normalizedCount <= 0) return [];
  return items.slice(0, normalizedCount);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function formatAmount(value) {
  const activeCurrency = localStorage.getItem('evenmore_currency') || 'USD ($)';
  return formatCurrency(value || 0, activeCurrency, { noDecimals: true });
}

function getInitials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function statusClass(value) {
  return String(value || '').toLowerCase() === 'active' ? 'green' : 'amber';
}


// ── helpers the drawer's tabs share ─────────────────────────────────────────

/** Lead source icons are stored by name and resolved to a component to render. */
const SOURCE_ICONS = {
  website: Globe,
  email: Mail,
  phone: Phone,
  referral: Users,
  campaign: Megaphone,
  exhibition: Building2,
  default: Globe,
};

export function sourceIconName(icon) {
  if (typeof icon === 'string') return icon;
  const match = Object.entries(SOURCE_ICONS).find(([, component]) => component === icon);
  return match ? match[0] : 'default';
}

export function resolveSourceIcon(icon) {
  if (icon && typeof icon !== 'string') return icon;
  return SOURCE_ICONS[String(icon || 'default').toLowerCase()] || SOURCE_ICONS.default;
}

export const LEAD_TASK_PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];
export const LEAD_TASK_STATUS_OPTIONS = ['Open', 'In Progress', 'Waiting', 'Completed'];

/** The task form definitions, from `/crm/forms/`. */
function getLeadTaskForms() {
  return loadForms(TASK_FORM);
}

function saveLeadTaskForms(forms) {
  saveForms(forms, TASK_FORM);
}

function createLeadTaskForm(name, sections = []) {
  return {
    id: `task-form-${Date.now()}`,
    title: String(name || 'Untitled form').trim(),
    description: '',
    sections,
    fields: sections.flatMap((section) => (section.fields || []).map((field) => field.label)),
    status: 'ACTIVE',
    lastUpdated: new Date().toLocaleDateString('en-GB'),
  };
}

function getTaskFormFields(formId) {
  const form = getLeadTaskForms().find((f) => String(f.id) === String(formId));
  if (!form) return [];
  if (Array.isArray(form.sections) && form.sections.length > 0) {
    return form.sections.flatMap((section) => section.fields || []);
  }
  return (form.fields || []).map((label, index) => ({ id: `f-${index}`, label, type: 'text' }));
}

/** `DD/MM/YYYY, hh:mm` — what the task rows render — and back again. */
function parseLeadTaskDueAt(value) {
  if (!value) return null;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return new Date(direct);
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '0', min = '0'] = match;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
}

/** Drawer date/time inputs (`YYYY-MM-DD` / `HH:MM`) from a Date. */
function toTaskDateInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTaskTimeInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Empty drawer task draft for the create/edit modal. */
function emptyLeadTaskDraft(assignee = '') {
  return {
    defaultTask: 'custom',
    title: '',
    stage: 'New Lead',
    priority: 'Medium',
    status: 'Due',
    assignee,
    assigneeId: '',
    description: '',
    department: 'Sales',
    icon: 'call',
    proposalId: '',
    deliveryChallanId: '',
    taskFormId: '',
    customValues: {},
    taskDate: '',
    taskTime: '09:00',
  };
}

function resolveAssigneeSelection(value, options) {
  const raw = String(value || '').trim();
  if (!raw) return { id: '', name: '' };
  if (isServerId(raw)) {
    const match = (options || []).find((o) => String(o.id) === raw);
    return { id: raw, name: match ? match.name : raw };
  }
  const lowered = raw.toLowerCase();
  const match = (options || []).find((o) => String(o.name || '').trim().toLowerCase() === lowered || String(o.email || '').trim().toLowerCase() === lowered);
  if (match && isServerId(match.id)) return { id: match.id, name: match.name };
  return { id: '', name: raw };
}

/** `YYYY-MM-DD` + `HH:MM` inputs → `DD/MM/YYYY, HH:MM` drawer display. */
function formatLeadTaskDueAt(taskDate, taskTime) {
  if (!taskDate) return '';
  const match = String(taskDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const date = parseLeadTaskDueAt(taskDate);
    if (!date) return String(taskDate || '');
    return date.toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }
  const [, yyyy, mm, dd] = match;
  const time = String(taskTime || '').match(/^(\d{2}):(\d{2})/);
  return time ? `${dd}/${mm}/${yyyy}, ${time[1]}:${time[2]}` : `${dd}/${mm}/${yyyy}`;
}

/** Drawer statuses ('Due'/'Completed') <-> API statuses (api.md §9.3). */
function drawerTaskStatusToServer(status) {
  if (status === 'Completed') return 'Completed';
  if (status === 'In Progress') return 'In Progress';
  return 'Open';
}

/**
 * A `/crm/tasks/` row as a drawer task row. Fields the API has no column
 * for (proposal links, form answers) stay empty — the drawer keeps those
 * locally while the server owns the scheduled work itself.
 */
function serverTaskToDrawerRow(task) {
  const dueDisplay = task.dueDate ? formatDateDDMMYYYY(task.dueDate) : '';
  const dueTime = task.dueTime || '09:00';
  const status = task.status === 'Completed' ? 'Completed' : (task.status === 'In Progress' ? 'In Progress' : 'Due');
  return {
    id: `srv-${task.id}`,
    serverTaskId: task.id,
    defaultTask: 'custom',
    title: task.title || '',
    stage: 'New Lead',
    status,
    priority: task.priority || 'Medium',
    dueAt: dueDisplay ? `${dueDisplay}, ${dueTime}` : '',
    taskDate: task.dueDate || '',
    taskTime: dueTime,
    startedAt: task.startedAt || null,
    endedAt: task.endedAt || null,
    durationSeconds: task.durationSeconds || 0,
    icon: task.icon || 'call',
    department: task.department || 'Sales',
    process: status === 'Completed' ? 'Done' : (status === 'In Progress' ? 'In Progress' : 'Not Started'),
    assignee: task.assigneeName || '',
    assigneeId: task.assigneeId || undefined,
    assigneeName: task.assigneeName || '',
    description: task.description || '',
    proposalId: '',
    deliveryChallanId: '',
    taskFormId: '',
    customValues: {},
  };
}

async function mirrorDrawerTaskToBackend({ leadId, row, taskDate, assigneeName, assigneeId }) {
  if (!isBackendEnabled() || !isServerId(leadId)) return null;
  const store = useCrmStore.getState();
  let resolvedId = isServerId(assigneeId) ? assigneeId : undefined;
  if (!resolvedId && assigneeName) {
    const target = String(assigneeName).trim().toLowerCase();
    const member = (store.teamMembers || []).find((m) => String(m.name || '').trim().toLowerCase() === target || String(m.email || '').trim().toLowerCase() === target);
    if (member && isServerId(member.id)) resolvedId = member.id;
  }
  const payload = {
    title: row.title,
    description: row.description || undefined,
    leadId,
    assigneeId: resolvedId,
    dueDate: taskDate || undefined,
    dueTime: row.taskTime || undefined,
    startedAt: row.startedAt || undefined,
    endedAt: row.endedAt || undefined,
    durationSeconds: row.durationSeconds || undefined,
    icon: row.icon || undefined,
    department: row.department || undefined,
    priority: ['Low', 'Medium', 'High', 'Urgent'].includes(row.priority) ? row.priority : 'Medium',
    status: drawerTaskStatusToServer(row.status),
  };
  try {
    return await store.createTask(payload);
  } catch (err) {
    console.warn('[CRM] drawer task not saved:', err?.message || err);
    return null;
  }
}

/**
 * One lead's sections, as the server returned them. Anything the server has no
 * rows for stays empty — the drawer shows an empty state instead of invented
 * contacts, files or a fabricated timeline.
 */
function leadDetailState(detail) {
  const stored = detail || EMPTY_DETAIL;
  return {
    users: stored.users || [],
    products: stored.products || [],
    sources: stored.sources || [],
    emails: stored.emails || [],
    timeline: stored.timeline || [],
    files: stored.files || [],
    notes: stored.notes || [],
    threads: stored.threads || [],
    tasks: stored.tasks || [],
    activities: stored.activities || [],
  };
}

/** Subscribe to one lead's sections and trigger the load on first use. */
function useLeadDetailState(lead) {
  const leadId = lead?.id;
  const detail = useLeadDetailStore((s) => s.byLead[String(leadId || '')]);
  const load = useLeadDetailStore((s) => s.load);
  useEffect(() => {
    if (leadId) load(leadId);
  }, [leadId, load]);
  return useMemo(() => leadDetailState(detail), [detail]);
}

function fieldRows(lead) {
  return [
    ['Company', lead.company || '—'],
    ['Title', lead.jobTitle || '—'],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Amount', formatAmount(lead.amount)],
  ];
}

function addressRows(lead) {
  return [
    ['City', lead.city],
    ['State', lead.state],
    ['Country', lead.country],
  ];
}

function leadExportRows(lead) {
  return [
    ['Lead Name', lead.name],
    ['Company', lead.company],
    ['Title', lead.jobTitle],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Lead Source', lead.source],
    ['Lead Owner', lead.owner],
    ['Status', lead.status],
    ['Created On', lead.createdOn],
    ['City', lead.city],
    ['State', lead.state],
    ['Country', lead.country],
    ['Amount', formatAmount(lead.amount)],
  ];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function downloadLeadAsExcel(lead) {
  const rows = leadExportRows(lead);
  const table = rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  const workbook = `<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${table}</tbody></table>`;
  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(lead.name || 'lead').replace(/\s+/g, '_')}_details.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printLeadAsPdf(lead) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;
  const rows = leadExportRows(lead).map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('');
  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(lead.name)} - Lead Details</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:40px}h1{margin:0 0 8px;font-size:24px}p{color:#64748b;margin:0 0 24px}table{border-collapse:collapse;width:100%;max-width:700px}th,td{border:1px solid #dbe2ea;padding:10px;text-align:left;font-size:14px}th{background:#f1f5f9;width:35%}</style></head><body><h1>${escapeHtml(lead.name)}</h1><p>Lead Details</p><table>${rows}</table></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

function metricCards(counts) {
  return [
    { label: 'Products', value: counts.products },
    { label: 'Sources', value: counts.sources },
    { label: 'Files', value: counts.files },
  ];
}

// ── 1. Sources & Emails Tab (Screenshot Focus) ────────────────
function SourcesAndEmailsTab({ lead, onCountsChange, onActivity }) {
  const initialState = useLeadDetailState(lead);
  const currentUser = useAppStore((s) => s.currentUser);
  const actorName = currentUser?.name || currentUser?.fullName || lead?.owner || '—';
  const [sources, setSources] = useState(() => initialState.sources);
  const [emails, setEmails] = useState(() => initialState.emails);
  const [timeline, setTimeline] = useState(() => initialState.timeline);
  const storeSources = useLeadDetailStore((s) => s.byLead[String(lead?.id || '')]?.sources);
  const storeEmails = useLeadDetailStore((s) => s.byLead[String(lead?.id || '')]?.emails);

  // Server is the source of truth once loaded. `initialState` is a snapshot
  // at mount; without this the DATE / CREATED BY columns stay empty after
  // the async load resolves.
  React.useEffect(() => {
    if (Array.isArray(storeSources)) setSources(storeSources);
  }, [storeSources]);
  React.useEffect(() => {
    if (Array.isArray(storeEmails)) setEmails(storeEmails);
  }, [storeEmails]);

  const { showToast } = useERP() || {};
  const [showAddSource, setShowAddSource] = useState(false);
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [newSource, setNewSource] = useState({ source: 'Website', details: '' });
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [editSource, setEditSource] = useState({ source: 'Website', details: '' });
  const [savingSource, setSavingSource] = useState(false);
  const [newEmail, setNewEmail] = useState({ subject: '', message: '' });
  const [recipients, setRecipients] = useState([lead.email].filter(Boolean));
  const [mailTo, setMailTo] = useState(lead.email || '');
  const [mailError, setMailError] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [bodyError, setBodyError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [viewEmail, setViewEmail] = useState(null);
  const editorRef = React.useRef(null);
  const [editorEmpty, setEditorEmpty] = useState(true);

  React.useEffect(() => {
    onCountsChange?.({ sources: sources.length });
  }, [sources.length, onCountsChange]);

  function toggleRecipient(email) {
    setRecipients((current) => (current.includes(email) ? current.filter((r) => r !== email) : [...current, email]));
  }

  function addSource(event) {
    handleAddSource(event);
  }

  function sendEmail(event) {
    handleSendEmail(event);
  }

  function syncEditor() {
    const el = editorRef.current;
    if (!el) return;
    const text = el.innerText || '';
    setNewEmail((prev) => ({ ...prev, message: text }));
    setEditorEmpty(text.trim() === '');
    if (text.trim()) setBodyError('');
  }

  function formatDoc(command, value = null) {
    try {
      if (editorRef.current) editorRef.current.focus();
      document.execCommand(command, false, value);
    } catch {
      return;
    }
    syncEditor();
  }

  function runLink() {
    const url = window.prompt('Enter link URL', 'https://');
    if (url) formatDoc('createLink', url);
  }

  function openEmailModal() {
    setMailTo(lead.email || '');
    setMailError('');
    setSubjectError('');
    setBodyError('');
    setEmailError('');
    setNewEmail({ subject: '', message: '' });
    setEditorEmpty(true);
    if (editorRef.current) editorRef.current.innerHTML = '';
    setShowSendEmail(true);
  }

  function closeEmailModal() {
    if (sendingEmail) return;
    setShowSendEmail(false);
    setMailError('');
    setSubjectError('');
    setBodyError('');
    setEmailError('');
  }

  const handleAddSource = (e) => {
    e.preventDefault();
    if (!newSource.details) return;
    const iconName = newSource.source === 'Referral' ? 'user' : newSource.source === 'Advertisement' ? 'megaphone' : 'globe';
    const nowText = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const optimistic = {
      id: `local-${Date.now()}`,
      source: newSource.source,
      name: newSource.source,
      sourceType: String(newSource.source ?? '').toLowerCase(),
      details: newSource.details,
      campaign: newSource.details,
      date: nowText,
      createdBy: actorName,
      color: '#1f6bff',
      icon: iconName,
    };
    // Optimistic row first so the table feels instant; replaced by the
    // normalized server row (with `name`, `attributedAt`/`createdAt`,
    // `createdByName`) once the POST resolves.
    setSources((current) => [optimistic, ...current]);
    setNewSource({ source: 'Website', details: '' });
    setShowAddSource(false);
    onActivity?.(`Source "${optimistic.source}" added`, '#10b981');
    useLeadDetailStore.getState().add(lead?.id, 'sources', optimistic).then((saved) => {
      if (saved?.id) setSources((current) => current.map((s) => (s.id === optimistic.id ? saved : s)));
    }).catch((err) => {
      console.warn('[CRM] source not saved:', err?.message || err);
    });
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (sendingEmail) return;

    let hasError = false;
    setMailError('');
    setSubjectError('');
    setBodyError('');
    setEmailError('');

    const targetMail = (mailTo || '').trim();
    const toOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetMail);
    if (!targetMail) {
      setMailError('Recipient email address is required.');
      hasError = true;
    } else if (!toOk) {
      setMailError('Enter a valid email address (e.g. name@example.com).');
      hasError = true;
    }

    const targetSubject = (newEmail.subject || '').trim();
    if (!targetSubject) {
      setSubjectError('Subject is required.');
      hasError = true;
    }

    const editorHtml = editorRef.current ? editorRef.current.innerHTML : '';
    const editorText = (editorRef.current?.innerText || newEmail.message || '').trim();
    if (!editorText) {
      setBodyError('Description / email body is required.');
      hasError = true;
    }

    if (hasError) return;

    setSendingEmail(true);

    try {
      const payload = {
        to_addresses: [targetMail],
        toAddresses: [targetMail],
        subject: targetSubject,
        body: editorHtml || editorText,
        message: editorHtml || editorText,
      };

      // Call existing Django API: POST /api/crm/leads/{lead.id}/emails/
      const saved = await api.post(`/crm/leads/${lead?.id}/emails/`, payload);
      const normalized = normalizeSection('emails', [saved])[0] || saved;

      const now = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const addedTimeline = {
        id: normalized.id || Date.now(),
        type: 'sent',
        title: targetSubject,
        preview: editorText || 'Direct email communication with client representative.',
        date: normalized.date || now,
        author: actorName,
        dotColor: '#10b981',
      };

      setEmails((current) => [normalized, ...current.filter((item) => item.id !== normalized.id)]);
      setTimeline((current) => [addedTimeline, ...current]);

      // Refresh store sections in background
      useLeadDetailStore.getState().refreshSection(lead?.id, 'emails').catch(() => {});
      useLeadDetailStore.getState().refreshSection(lead?.id, 'timeline').catch(() => {});

      showToast?.(`Email "${targetSubject}" sent successfully.`);
      onActivity?.(`Email "${targetSubject}" sent to ${targetMail}`, '#10b981');

      // Clear form and close modal
      setNewEmail({ subject: '', message: '' });
      setEditorEmpty(true);
      if (editorRef.current) editorRef.current.innerHTML = '';
      setShowSendEmail(false);
    } catch (err) {
      console.error('[CRM Email Send Error]:', err);
      const serverDetail = err?.response?.data?.detail
        || err?.response?.data?.message
        || err?.response?.data?.to_addresses?.[0]
        || err?.response?.data?.subject?.[0]
        || err?.response?.data?.body?.[0]
        || err?.message
        || 'Failed to deliver email through SMTP provider. Please check network and provider settings.';
      setEmailError(serverDetail);
      // Keep modal open, preserve entered data!
    } finally {
      setSendingEmail(false);
    }
  };

  const deleteSource = (id) => {
    const target = sources.find((s) => s.id === id);
    setSources((current) => current.filter((source) => source.id !== id));
    onActivity?.(`Source "${target?.source ?? 'entry'}" removed`, '#f59e0b');
    // Server delete is best-effort; local-only rows have nothing to DELETE.
    useLeadDetailStore.getState().removeSection(lead?.id, 'sources', id).catch((err) => {
      console.warn('[CRM] source not deleted:', err?.message || err);
    });
  };

  function openEditSource(row) {
    if (!row) return;
    setEditingSourceId(row.id);
    setEditSource({
      source: row.source || row.name || 'Website',
      details: row.details || row.campaign || row.medium || '',
    });
  }

  function closeEditSource() {
    setEditingSourceId(null);
  }

  async function saveEditSource(e) {
    e?.preventDefault();
    if (!editingSourceId || savingSource) return;
    const details = String(editSource.details || '').trim();
    if (!details) return;
    const channel = String(editSource.source || 'Website');
    const current = sources.find((s) => String(s.id) === String(editingSourceId));
    const next = {
      ...(current || {}),
      source: channel,
      name: channel,
      details,
      campaign: details,
    };
    // Optimistic update so the table reflects the edit instantly.
    setSources((rows) => rows.map((s) => (String(s.id) === String(editingSourceId) ? next : s)));
    setSavingSource(true);
    try {
      const saved = await useLeadDetailStore.getState().updateSection(lead?.id, 'sources', editingSourceId, next);
      if (saved?.id) {
        setSources((rows) => rows.map((s) => (String(s.id) === String(editingSourceId) ? saved : s)));
      }
      onActivity?.(`Source "${channel}" updated`, '#10b981');
      closeEditSource();
    } catch (err) {
      console.warn('[CRM] source not updated:', err?.message || err);
      onActivity?.('Source could not be saved to the server', '#f59e0b');
    } finally {
      setSavingSource(false);
    }
  }
  const deleteEmail = (id) => {
    const target = emails.find((e) => e.id === id);
    setEmails((current) => current.filter((email) => email.id !== id));
    onActivity?.(`Email "${target?.subject ?? 'entry'}" deleted`, '#f59e0b');
    useLeadDetailStore.getState().removeSection(lead?.id, 'emails', id).catch((err) => {
      console.warn('[CRM] email not deleted:', err?.message || err);
    });
  };

  // Graph compatibility alias: old codebase exposed SourcesEmailsTab; current UI uses SourcesAndEmailsTab.
  // Both names resolve to the same implementation so graph queries keep working.

  // Graph compatibility alias: old codebase exposed SourcesEmailsTab; current UI uses SourcesAndEmailsTab.
  // Both names resolve to the same implementation so graph queries keep working.

  return (
    <div className="space-y-4">
      {/* 2-Column Grid for Lead Sources & Emails */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Lead Sources */}
        <div className="card">
          <div className="card-header flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
            <h3 className="font-bold text-sm">Lead Sources ({sources.length})</h3>
            <button
              type="button"
              onClick={() => setShowAddSource(!showAddSource)}
              className="btn-primary btn-sm flex items-center gap-1.5"
            >
              <Plus size={13} strokeWidth={2.4} /> Add Source
            </button>
          </div>

          {showAddSource && (
            <form onSubmit={handleAddSource} className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Source Channel</label>
                  <select
                    value={newSource.source}
                    onChange={(e) => setNewSource({ ...newSource, source: e.target.value })}
                    className="form-select text-xs"
                  >
                    <option value="Website">Website Form</option>
                    <option value="Referral">Client Referral</option>
                    <option value="Advertisement">Social Ads</option>
                                        <option value="Trade Fair">Trade Expo</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Specific Details / Notes</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inbound enquiry from landing page"
                    value={newSource.details}
                    onChange={(e) => setNewSource({ ...newSource, details: e.target.value })}
                    className="form-input text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddSource(false)} className="btn-ghost btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn-primary btn-sm">
                  Save Source
                </button>
              </div>
            </form>
          )}

          <div className="table-scroll">
            <table className="data-table text-xs min-w-[640px] lg:min-w-0">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Source</th>
                  <th>Details</th>
                  <th>Date</th>
                  <th>Created By</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s, idx) => {
                  const Icon = resolveSourceIcon(s.icon);
                  const sourceLabel = s.source || s.name || '—';
                  const detailsLabel = s.details || s.campaign || s.medium || '—';
                  const dateLabel = s.date || '—';
                  const byLabel = s.createdBy || '—';
                  const byInitials = getInitials(s.createdBy) || '—';
                  return (
                    <tr key={s.id}>
                      <td className="text-slate-500 font-mono">{idx + 1}</td>
                      <td>
                        <div className="inline-flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0"
                            style={{ background: s.color || '#1f6bff' }}
                          >
                            <Icon size={12} />
                          </div>
                          <span className="font-semibold">{sourceLabel}</span>
                        </div>
                      </td>
                      <td className="font-semibold">{detailsLabel}</td>
                      <td className="text-slate-500 font-mono text-xs whitespace-nowrap">{dateLabel}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: '#2F6FED' }}>{byInitials}</span>
                          <span className="text-xs font-medium">{byLabel}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditSource(s)}
                            className="p-1 rounded text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSource(s.id)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editingSourceId && (
            <form onSubmit={saveEditSource} className="p-4 bg-blue-50/50 border-t border-blue-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Source Channel</label>
                  <select
                    value={editSource.source}
                    onChange={(e) => setEditSource({ ...editSource, source: e.target.value })}
                    className="form-select text-xs"
                  >
                    <option value="Website">Website Form</option>
                    <option value="Referral">Client Referral</option>
                    <option value="Advertisement">Social Ads</option>
                                        <option value="Trade Fair">Trade Expo</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Specific Details / Notes</label>
                  <input
                    type="text"
                    required
                    value={editSource.details}
                    onChange={(e) => setEditSource({ ...editSource, details: e.target.value })}
                    className="form-input text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeEditSource} className="btn-ghost btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={savingSource} className="btn-primary btn-sm">
                  {savingSource ? 'Saving…' : 'Update Source'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: Emails */}
        <div className="card">
          <div className="card-header flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
            <h3 className="font-bold text-sm">Emails ({emails.length})</h3>
            <button
              type="button"
              onClick={openEmailModal}
              className="btn-primary btn-sm flex items-center gap-1.5"
            >
              <Plus size={13} strokeWidth={2.4} /> Send Email
            </button>
          </div>

          {showSendEmail && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/50" onClick={closeEmailModal}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                  <h2 className="text-[15px] font-bold text-slate-800">Create Email</h2>
                  <button type="button" disabled={sendingEmail} onClick={closeEmailModal} className="text-slate-400 hover:text-slate-600 disabled:opacity-50 p-1" aria-label="Close">
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleSendEmail}>
                  <div className="px-5 py-4 space-y-4">
                    {emailError && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                        <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500" />
                        <span className="leading-relaxed font-medium">{emailError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[13px] font-semibold text-slate-600">Mail To<span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          disabled={sendingEmail}
                          value={mailTo}
                          onChange={(e) => { setMailTo(e.target.value); setMailError(''); setEmailError(''); }}
                          placeholder="Enter email"
                          className="mt-1.5 h-11 w-full border border-slate-300 rounded-lg px-3.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                        {mailError && <p className="text-[11px] text-rose-500 mt-1 font-medium">{mailError}</p>}
                      </div>
                      <div>
                        <label className="text-[13px] font-semibold text-slate-600">Subject<span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          disabled={sendingEmail}
                          value={newEmail.subject}
                          onChange={(e) => { setNewEmail({ ...newEmail, subject: e.target.value }); setSubjectError(''); setEmailError(''); }}
                          placeholder="Enter subject"
                          className="mt-1.5 h-11 w-full border border-slate-300 rounded-lg px-3.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                        {subjectError && <p className="text-[11px] text-rose-500 mt-1 font-medium">{subjectError}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="text-[13px] font-semibold text-slate-600">Description<span className="text-rose-500">*</span></label>
                      <div className="mt-1.5 border border-slate-300 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-white flex-wrap">
                          <button type="button" disabled={sendingEmail} title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('bold')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700 disabled:opacity-50"><Bold size={15} /></button>
                          <button type="button" disabled={sendingEmail} title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('italic')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700 disabled:opacity-50"><Italic size={15} /></button>
                          <button type="button" disabled={sendingEmail} title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('underline')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700 disabled:opacity-50"><Underline size={15} /></button>
                          <button type="button" disabled={sendingEmail} title="Strikethrough" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('strikeThrough')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700 disabled:opacity-50"><Strikethrough size={15} /></button>
                          <button type="button" disabled={sendingEmail} title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('insertUnorderedList')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700 disabled:opacity-50"><List size={15} /></button>
                          <button type="button" disabled={sendingEmail} title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('insertOrderedList')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700 disabled:opacity-50"><ListOrdered size={15} /></button>
                          <button type="button" disabled={sendingEmail} title="Align left" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('justifyLeft')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700 disabled:opacity-50"><AlignLeft size={15} /></button>
                          <button type="button" disabled={sendingEmail} title="Align center" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('justifyCenter')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700 disabled:opacity-50"><AlignCenter size={15} /></button>
                          <button type="button" disabled={sendingEmail} title="Align right" onMouseDown={(e) => e.preventDefault()} onClick={() => formatDoc('justifyRight')} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700 disabled:opacity-50"><AlignRight size={15} /></button>
                          <button type="button" disabled={sendingEmail} title="Insert link" onMouseDown={(e) => e.preventDefault()} onClick={runLink} className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-700 disabled:opacity-50"><Link2 size={15} /></button>
                        </div>
                        <div className="relative">
                          {editorEmpty && <span className="absolute left-3.5 top-3 text-sm text-slate-400 pointer-events-none">Write Here...</span>}
                          <div ref={editorRef} contentEditable={!sendingEmail} suppressContentEditableWarning onInput={syncEditor} className="min-h-[170px] max-h-[260px] overflow-y-auto px-3.5 py-3 text-sm text-slate-800 outline-none" />
                        </div>
                      </div>
                      {bodyError && <p className="text-[11px] text-rose-500 mt-1 font-medium">{bodyError}</p>}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                    <button type="button" disabled={sendingEmail} onClick={closeEmailModal} className="h-10 px-6 rounded-lg bg-slate-500 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-semibold transition cursor-pointer">Cancel</button>
                    <button type="submit" disabled={sendingEmail} className="h-10 px-6 rounded-lg bg-[#1f6bff] hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2 transition cursor-pointer">
                      {sendingEmail ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <span>Create</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="table-scroll">
            <table className="data-table text-xs min-w-[640px] lg:min-w-0">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Subject</th>
                  <th>Date & Time</th>
                  <th>Sent/Received By</th>
                  <th>Status</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e, idx) => {
                  const personLabel = e.person
                    || (Array.isArray(e.to_addresses || e.toAddresses) && (e.to_addresses || e.toAddresses).join(', '))
                    || '—';
                  return (
                  <tr key={e.id}>
                    <td className="text-slate-500 font-mono">{idx + 1}</td>
                    <td>
                      <div className="inline-flex items-center gap-2">
                        <Mail size={13} className="text-blue-500 shrink-0" />
                        <span className="font-bold">{e.subject || '—'}</span>
                      </div>
                    </td>
                    <td className="text-slate-500 font-mono text-xs whitespace-nowrap">{e.date || '—'}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: '#2F6FED' }}>{getInitials(e.person) || '—'}</span>
                        <span className="text-xs font-medium">{personLabel}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          e.status === 'Sent'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {e.status || 'Draft'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewEmail(e)}
                          className="p-1 rounded text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          title="View Message"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEmail(e.id)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {viewEmail && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/50" onClick={() => setViewEmail(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                  <h2 className="text-[15px] font-bold text-slate-800">{viewEmail.subject || 'Email'}</h2>
                  <button type="button" onClick={() => setViewEmail(null)} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Close">
                    <X size={18} />
                  </button>
                </div>
                <div className="px-5 py-4 space-y-3 text-[13px]">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-500">
                    <span><strong className="text-slate-700">To:</strong> {((viewEmail.to_addresses || viewEmail.toAddresses || []).join(', ')) || '—'}</span>
                    <span><strong className="text-slate-700">Date:</strong> {viewEmail.date || '—'}</span>
                    <span><strong className="text-slate-700">Status:</strong> {viewEmail.status || 'Draft'}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {viewEmail.body || viewEmail.message || 'No message body.'}
                  </div>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                  <button type="button" onClick={() => setViewEmail(null)} className="h-10 px-6 rounded-lg bg-slate-500 hover:bg-slate-600 text-white text-sm font-semibold">Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Card: Email Activity Timeline */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Email Activity Timeline</h3>
        {(() => {
          const emailEntries = timeline.filter((item) => item.type === 'email' || item.type === 'sent');
          if (emailEntries.length === 0) {
            return (
              <p className="text-xs py-4 text-center" style={{ color: 'var(--muted)' }}>No email activity recorded.</p>
            );
          }
          return (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {emailEntries.map((item) => (
                <div key={item.id} className="relative flex items-start justify-between gap-4">
                  <span
                    className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center"
                    style={{ background: item.dotColor }}
                  />
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.type === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {item.type === 'sent' ? 'Sent' : 'Email'}
                      </span>
                      <strong className="text-xs font-bold" style={{ color: 'var(--text)' }}>{item.title}</strong>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{item.preview}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <time className="text-[11px] font-mono block" style={{ color: 'var(--muted)' }}>{item.date}</time>
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>by {item.author}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Files Tab ───────────────────────────────────────────────
function FilesTab({ lead, onCountsChange, onActivity }) {
  const leadId = lead?.id;
  const storeFiles = useLeadDetailStore((s) => s.byLead[String(leadId || '')]?.files);
  const initialState = useLeadDetailState(lead);
  const currentUser = useAppStore((s) => s.currentUser);
  const actorName = currentUser?.name || currentUser?.fullName || lead?.owner || '—';
  const [files, setFiles] = useState(() => initialState.files || []);
  const [fileSearch, setFileSearch] = useState('');
  const [fileType, setFileType] = useState('All');
  const [viewFile, setViewFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Server is the source of truth. Sync only when the store actually has a
  // list (after load/add/remove). `undefined` means "not loaded yet" — don't
  // wipe local optimistic rows in that case.
  React.useEffect(() => {
    if (Array.isArray(storeFiles)) setFiles(storeFiles);
  }, [storeFiles]);

  // First server snapshot (useLeadDetailState loads async after mount).
  React.useEffect(() => {
    if (storeFiles === undefined && Array.isArray(initialState.files) && initialState.files.length > 0) {
      setFiles(initialState.files);
    }
  }, [storeFiles, initialState.files]);

  React.useEffect(() => {
    onCountsChange?.({ files: files.length });
  }, [files.length, onCountsChange]);

  const visibleFiles = useMemo(() => files.filter((f) => {
    if (fileType !== 'All' && f.type !== fileType) return false;
    if (fileSearch && !String(f.name ?? '').toLowerCase().includes(fileSearch.toLowerCase())) return false;
    return true;
  }), [files, fileSearch, fileType]);

  async function handleUploadFiles(event) {
    const input = event.target;
    const selected = Array.from(input?.files || []);
    // Reset immediately so choosing the same file twice still fires onChange.
    // Reading it first avoids the double-fire that created twin rows.
    input.value = '';
    if (selected.length === 0 || uploading) return;
    if (!isServerId(leadId)) {
      onActivity?.('Save the lead first — files need a server lead', '#f59e0b');
      return;
    }
    setUploading(true);
    try {
      const { uploadFileToBackend } = await import('../../../services/fileUploadService');
      const store = useLeadDetailStore.getState();
      for (const file of selected) {
        const tempId = `file-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const preview = file.type.startsWith('image/') ? await readFileAsDataUrl(file).catch(() => '') : '';
        // Optimistic row so the UI feels instant; replaced by the server row below.
        const optimistic = {
          id: tempId,
          type: file.type.startsWith('image/') ? 'image' : 'document',
          name: file.name,
          size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
          sentOn: new Date().toLocaleDateString('en-GB'),
          sentBy: actorName,
          preview,
          downloadUrl: preview,
          description: 'Uploading…',
          _synced: false,
        };
        setFiles((current) => [optimistic, ...current]);
        try {
          const fileId = await uploadFileToBackend(file, file.name, 'crm_lead');
          const saved = await store.add(leadId, 'files', { fileId, label: file.name });
          // Swap the optimistic row for the normalized server row.
          setFiles((current) => current.map((f) => (f.id === tempId ? (saved || { ...optimistic, description: 'Uploaded from Files tab.' }) : f)));
        } catch (err) {
          console.warn('[CRM] file not saved:', err?.message || err);
          setFiles((current) => current.filter((f) => f.id !== tempId));
          const reason = err?.payload?.field_errors?.scope?.[0] || err?.message || 'upload failed';
          onActivity?.(`File "${file.name}" could not be uploaded — ${reason}`, '#f59e0b');
        }
      }
      onActivity?.(`${selected.length} file${selected.length > 1 ? 's' : ''} uploaded`, '#8b5cf6');
    } finally {
      setUploading(false);
    }
  }

  function handleViewFile(file) {
    setViewFile(file);
  }

  function handleDownloadFile(file) {
    const url = file.downloadUrl || file.preview || file.url;
    if (!url) return;
    // Signed backend URLs (http) open directly; data-URL previews download.
    if (/^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function handleRemoveFile(id) {
    const target = files.find((f) => f.id === id);
    // Optimistic removal, then the server delete. Without the server call
    // the row comes back on refresh (GET /crm/leads/{id}/files/).
    setFiles((current) => current.filter((f) => f.id !== id));
    try {
      if (isServerId(leadId) && isServerId(id)) {
        await useLeadDetailStore.getState().removeSection(leadId, 'files', id);
      }
      // Local-only / optimistic rows were never posted — nothing to DELETE.
      onActivity?.(`File "${target?.name ?? 'entry'}" removed`, '#f59e0b');
    } catch (err) {
      console.warn('[CRM] file not deleted:', err?.message || err);
      setFiles((current) => (target ? [target, ...current] : current));
      onActivity?.('File could not be deleted on the server', '#f59e0b');
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-bold text-sm">Files ({files.length})</h3>
        <div className="flex items-center gap-2">
          <input type="text" placeholder="Search files..." value={fileSearch} onChange={(e) => setFileSearch(e.target.value)} className="form-input text-xs" style={{ width: 160 }} />
          <select value={fileType} onChange={(e) => setFileType(e.target.value)} className="form-select text-xs">
            <option value="All">All</option>
            <option value="image">Images</option>
            <option value="document">Documents</option>
          </select>
          <label className={`btn-primary btn-sm flex items-center gap-1 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload'}
            <input type="file" multiple hidden onChange={handleUploadFiles} disabled={uploading} />
          </label>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table text-xs min-w-[640px] lg:min-w-0">
          <thead><tr><th>Name</th><th>Size</th><th>Sent On</th><th>Sent By</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
          <tbody>
            {visibleFiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-6">
                  {uploading ? 'Uploading…' : 'No files yet. Click Upload to attach one.'}
                </td>
              </tr>
            ) : visibleFiles.map((f) => (
              <tr key={f.id}>
                <td className="font-semibold">{f.name}</td>
                <td className="text-slate-500">{f.size}</td>
                <td className="text-slate-400">{f.sentOn}</td>
                <td>{f.sentBy}</td>
                <td>
                  <div className="flex items-center justify-center gap-1">
                    <button type="button" onClick={() => handleViewFile(f)} className="p-1 rounded text-blue-600 hover:bg-blue-50" title="View"><Eye size={13} /></button>
                    <button type="button" onClick={() => handleDownloadFile(f)} className="p-1 rounded text-emerald-600 hover:bg-emerald-50" title="Download"><Download size={13} /></button>
                    <button type="button" onClick={() => handleRemoveFile(f.id)} className="p-1 rounded text-rose-500 hover:bg-rose-50" title="Remove"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {viewFile && (
        <div className="modal-overlay" role="presentation" onClick={() => setViewFile(null)}>
          <div className="card p-4" style={{ maxWidth: 560, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h4 className="font-bold text-sm">{viewFile.name}</h4>
            <p className="text-xs text-slate-500">{viewFile.description}</p>
            {viewFile.preview && <img src={viewFile.preview} alt={viewFile.name} style={{ width: '100%', borderRadius: 8, marginTop: 8 }} />}
            <div className="flex justify-end gap-2" style={{ marginTop: 12 }}>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setViewFile(null)}>Close</button>
              <button type="button" className="btn-primary btn-sm" onClick={() => handleDownloadFile(viewFile)}>Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeadTasksTab({ lead, onCountsChange, onActivity }) {
  const { quotations, deliveryChallans } = useERP() || {};
  const navigate = useNavigate();
  const initialState = useLeadDetailState(lead);
  const [tasks, setTasks] = useState(() => initialState.tasks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const storeForms = useCrmStore((s) => s.forms);
  const [taskForms, setTaskForms] = useState(() => getLeadTaskForms());
  const [showFormEditor, setShowFormEditor] = useState(false);
  const [taskFormName, setTaskFormName] = useState('');
  const [builderSections, setBuilderSections] = useState([]);
  const [builderSelectedFieldId, setBuilderSelectedFieldId] = useState(null);
  const [builderSaveSuccess, setBuilderSaveSuccess] = useState(false);
  const [taskFormDraftError, setTaskFormDraftError] = useState('');
  const teamMembers = useCrmStore((s) => s.teamMembers);
  const assigneeOptions = useMemo(() => {
    const byName = new Map();
    (teamMembers || []).forEach((member) => {
      const name = String(member?.name || '').trim();
      if (!name) return;
      byName.set(name.toLowerCase(), { id: member.id, name, email: member.email || '' });
    });
    if (lead?.owner && !byName.has(String(lead.owner).trim().toLowerCase())) {
      byName.set(String(lead.owner).trim().toLowerCase(), { id: '', name: String(lead.owner).trim(), email: '' });
    }
    (initialState.users || []).forEach((user) => {
      const name = String(user?.name || '').trim();
      if (name && !byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), { id: user.userId || '', name, email: user.email || '' });
    });
    tasks.forEach((task) => {
      const name = String(task?.assignee || task?.assigneeName || '').trim();
      if (name && !byName.has(name.toLowerCase())) {
        const key = String(task.assigneeId || '').trim();
        byName.set(name.toLowerCase(), { id: isServerId(key) ? key : '', name, email: '' });
      }
    });
    return [...byName.values()];
  }, [teamMembers, initialState.users, lead?.owner, tasks]);
  const defaultAssignee = assigneeOptions.length > 0 ? (assigneeOptions[0].id && isServerId(assigneeOptions[0].id) ? assigneeOptions[0].id : assigneeOptions[0].name) : '';
  const [form, setForm] = useState(() => emptyLeadTaskDraft(defaultAssignee));
  const storeMasterTasks = useCrmStore((s) => s.masterTasks);
  const masterTaskOptions = useMemo(
    () => (Array.isArray(storeMasterTasks) ? storeMasterTasks : [])
      .filter((task) => String(task?.status || 'Active') === 'Active')
      .map((task) => ({ id: task.id, name: task.name || task.title || '', title: task.title || task.name || '', priority: task.priority || '', role: task.role || '', order: task.order || 0 }))
      .filter((t) => t.id && t.name)
      .sort((a, b) => (a.order - b.order) || String(a.name).localeCompare(String(b.name))),
    [storeMasterTasks],
  );
  React.useEffect(() => {
    setTaskForms(getLeadTaskForms());
  }, [storeForms]);
  React.useEffect(() => {
    useCrmStore.getState().hydrate?.().then(() => {
      setTaskForms(getLeadTaskForms());
    }).catch(() => {});
  }, [isModalOpen]);
  const linkedQuotations = useMemo(
    () => (quotations || []).filter((quotation) => quotationMatchesLead(quotation, lead)),
    [lead, quotations]
  );
  const linkedChallans = useMemo(() => {
    const customerName = String(lead?.company || lead?.name || '').trim().toLowerCase();
    const leadName = String(lead?.name || '').trim().toLowerCase();

    return (deliveryChallans || []).filter((challan) => {
      const customer = String(challan.customer || '').trim().toLowerCase();
      if (!customerName) return true;
      return customer.includes(customerName) || (leadName && customer.includes(leadName));
    });
  }, [deliveryChallans, lead]);
  const [formError, setFormError] = useState('');
  const [completeId, setCompleteId] = useState(null);
  const [formFillId, setFormFillId] = useState(null);
  const [formFillValues, setFormFillValues] = useState({});
  const [formFillError, setFormFillError] = useState('');
  const currentUser = useAppStore((s) => s.currentUser);
  const [drawerServerLoaded, setDrawerServerLoaded] = useState(false);
  const selectedTaskForm = useMemo(() => taskForms.find((f) => String(f.id) === String(form.taskFormId)) || null, [taskForms, form.taskFormId]);
  // Read fields off the selected form object itself: getTaskFormFields()
  // takes an id, so passing the object re-looks-up "[object Object]" and
  // always returns [] ("No fields defined in this form yet").
  const selectedTaskFormFields = useMemo(() => {
    if (!selectedTaskForm) return [];
    const sections = Array.isArray(selectedTaskForm.sections) && selectedTaskForm.sections.length > 0
      ? selectedTaskForm.sections
      : (Array.isArray(selectedTaskForm.schema?.sections) ? selectedTaskForm.schema.sections : []);
    if (sections.length > 0) return sections.flatMap((s) => s.fields || []);
    return (selectedTaskForm.fields || []).map((label, index) => (
      typeof label === 'string' ? { id: `f-${index}`, label, type: 'text' } : label
    ));
  }, [selectedTaskForm]);
  const formFillTask = useMemo(() => tasks.find((t) => String(t.id) === String(formFillId)) || null, [tasks, formFillId]);
  const formFillDefinition = useMemo(() => {
    if (!formFillTask?.taskFormId) return null;
    return taskForms.find((f) => String(f.id) === String(formFillTask.taskFormId)) || null;
  }, [taskForms, formFillTask]);
  const formFillFields = useMemo(() => {
    if (!formFillDefinition) return [];
    const sections = Array.isArray(formFillDefinition.sections) && formFillDefinition.sections.length > 0
      ? formFillDefinition.sections
      : (Array.isArray(formFillDefinition.schema?.sections) ? formFillDefinition.schema.sections : []);
    if (sections.length > 0) return sections.flatMap((s) => s.fields || []);
    return (formFillDefinition.fields || []).map((label, index) => (
      typeof label === 'string' ? { id: `f-${index}`, label, type: 'text' } : label
    ));
  }, [formFillDefinition]);

  React.useEffect(() => {
    updateStoredLeadDetail(lead?.id, { tasks });
    onCountsChange?.({ openTasks: tasks.filter((t) => t.status !== 'Completed').length });
  }, [lead?.id, tasks, onCountsChange]);

  // Backend-first for the scheduled work itself: rows already saved under
  // `/crm/tasks/` for this lead load here (matched by `serverTaskId`), so a
  // refresh keeps every persisted task. Local-only extras stay in-session.
  React.useEffect(() => {
    if (drawerServerLoaded || !isBackendEnabled() || !isServerId(lead?.id)) return;
    setDrawerServerLoaded(true);
    crmService.getTasks({ leadId: lead.id }).then((body) => {
      const rows = Array.isArray(body) ? body : (body?.results || []);
      if (rows.length === 0) return;
      setTasks((prev) => {
        const known = new Set(prev.map((t) => t.serverTaskId).filter(Boolean));
        const incoming = rows
          .filter((r) => r?.id && !known.has(String(r.id)))
          .map((r) => serverTaskToDrawerRow(r));
        return incoming.length > 0 ? [...incoming, ...prev] : prev;
      });
    }).catch(() => {});
  }, [drawerServerLoaded, lead?.id]);

  React.useEffect(() => {
    function refreshTaskForms() {
      setTaskForms(getLeadTaskForms());
    }
    refreshTaskForms();
    window.addEventListener('focus', refreshTaskForms);
    window.addEventListener('storage', refreshTaskForms);
    return () => {
      window.removeEventListener('focus', refreshTaskForms);
      window.removeEventListener('storage', refreshTaskForms);
    };
  }, [isModalOpen]);

  const [now, setNow] = useState(Date.now());
  const [dueTasksExpanded, setDueTasksExpanded] = useState(true);
  const [completedTasksExpanded, setCompletedTasksExpanded] = useState(true);

  React.useEffect(() => {
    const hasRunning = tasks.some((t) => t.status === 'In Progress');
    if (!hasRunning) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tasks]);

  const dueTasks = useMemo(() => tasks.filter((t) => t.status !== 'Completed'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.status === 'Completed'), [tasks]);

  function formatTaskDateTime(dateOrIso) {
    if (!dateOrIso) return '-';
    const str = String(dateOrIso).trim();
    if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(str)) {
      return str.replace(/\//g, '-');
    }
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${day}-${month}-${year}, ${hours}:${mins}`;
      }
    } catch {
      // fallback
    }
    return str;
  }

  function formatDurationHHMMSS(totalSeconds) {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    return [hours, minutes, seconds].map((v) => String(v).padStart(2, '0')).join(':');
  }

  function getTaskDurationSeconds(task) {
    const base = Number(task?.durationSeconds) || 0;
    if (task?.status === 'Completed') {
      return base;
    }
    if (task?.status === 'In Progress' && task?.startedAt) {
      const elapsed = Math.max(0, Math.floor((now - new Date(task.startedAt).getTime()) / 1000));
      return base + elapsed;
    }
    return base;
  }

  function handleStartTask(task) {
    const startedAt = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: 'In Progress',
              process: 'In Progress',
              startedAt,
            }
          : t
      )
    );
    if (task.serverTaskId && isBackendEnabled()) {
      useCrmStore.getState().updateTask(task.serverTaskId, {
        status: 'In Progress',
        startedAt,
      }).catch((err) => console.warn('[CRM] drawer task start not saved:', err?.message || err));
    }
    onActivity?.(`Task "${task.title}" started`, '#2563eb');
  }

  function handleStopTask(task) {
    const endedAt = new Date().toISOString();
    const currentRun = task.startedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(task.startedAt).getTime()) / 1000))
      : 0;
    const totalDuration = (Number(task.durationSeconds) || 0) + currentRun;

    const stoppedTask = {
      ...task,
      status: 'Due',
      process: 'Paused',
      startedAt: null,
      endedAt,
      durationSeconds: totalDuration,
    };

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? stoppedTask : t))
    );

    if (task.serverTaskId && isBackendEnabled()) {
      useCrmStore.getState().updateTask(task.serverTaskId, {
        status: 'Open',
        durationSeconds: totalDuration,
        endedAt,
      }).catch((err) => console.warn('[CRM] drawer task stop not saved:', err?.message || err));
    }

    onActivity?.(`Task "${task.title}" stopped`, '#f59e0b');
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyLeadTaskDraft(defaultAssignee));
    setFormError('');
    setTaskForms(getLeadTaskForms());
    setShowFormEditor(false);
    setTaskFormName('');
    setBuilderSections([]);
    setBuilderSelectedFieldId(null);
    setTaskFormDraftError('');
    setIsModalOpen(true);
  }

  function openEdit(task) {
    const due = parseLeadTaskDueAt(task.dueAt);
    const currentSelection = task.assigneeId && isServerId(task.assigneeId) ? task.assigneeId : (task.assignee || defaultAssignee);
    setEditingId(task.id);
    setForm({
      defaultTask: task.defaultTask || 'custom',
      title: task.title || '',
      stage: task.stage || 'New Lead',
      priority: task.priority || 'Medium',
      status: task.status === 'Completed' ? 'Completed' : 'Due',
      assignee: currentSelection,
      assigneeId: task.assigneeId || '',
      department: task.department || 'Sales',
      icon: task.icon || 'call',
      description: task.description || '',
      proposalId: task.proposalId || '',
      deliveryChallanId: task.deliveryChallanId || '',
      taskFormId: task.taskFormId || '',
      customValues: task.customValues || {},
      taskDate: toTaskDateInput(due),
      taskTime: toTaskTimeInput(due) || '09:00',
    });
    setFormError('');
    setTaskForms(getLeadTaskForms());
    setShowFormEditor(false);
    setTaskFormDraftError('');
    setIsModalOpen(true);
  }

  function updateTaskForm(key, value) {
    setForm((current) => {
      if (key === 'assignee') {
        const resolved = resolveAssigneeSelection(value, assigneeOptions);
        return { ...current, assignee: value, assigneeId: resolved.id, assigneeName: resolved.name };
      }
      if (key === 'defaultTask' && value && value !== 'custom') {
        const preset = (storeMasterTasks || []).find((t) => String(t.id) === String(value));
        if (preset) {
          const presetName = preset.name || preset.title || '';
          return { ...current, defaultTask: value, title: presetName, priority: preset.priority || current.priority };
        }
      }
      if (key === 'taskFormId') {
        return { ...current, taskFormId: value, customValues: {} };
      }
      return { ...current, [key]: value };
    });
  }

  function updateCustomValue(fieldId, value) {
    setForm((current) => ({ ...current, customValues: { ...(current.customValues || {}), [fieldId]: value } }));
  }

  function openFormBuilderEditor() {
    setTaskForms(getLeadTaskForms());
    setTaskFormName('');
    setBuilderSections([{ id: `task-section-${Date.now()}`, title: 'New Section 2', fields: [] }]);
    setBuilderSelectedFieldId(null);
    setBuilderSaveSuccess(false);
    setTaskFormDraftError('');
    setShowFormEditor(true);
  }

  function updateBuilderField(fieldId, updates) {
    setBuilderSections((cur) => cur.map((s) => ({ ...s, fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)) })));
  }

  function addBuilderField(sectionId, type, index) {
    const targetId = sectionId || builderSections[0]?.id;
    const nextField = createFieldFromType(type, Date.now());
    setBuilderSections((cur) => cur.map((s) => {
      if (s.id !== targetId) return s;
      const arr = [...s.fields];
      arr.splice(typeof index === 'number' ? index : arr.length, 0, nextField);
      return { ...s, fields: arr };
    }));
    setBuilderSelectedFieldId(nextField.id);
  }

  function removeBuilderField(fieldId) {
    setBuilderSections((cur) => cur.map((s) => ({ ...s, fields: s.fields.filter((f) => f.id !== fieldId) })));
  }

  function moveBuilderField(fieldId, targetSectionId, targetIndex) {
    setBuilderSections((cur) => {
      let moving = null;
      const stripped = cur.map((s) => ({ ...s, fields: s.fields.filter((f) => { if (f.id === fieldId) { moving = f; return false; } return true; }) }));
      if (!moving) return cur;
      return stripped.map((s) => {
        if (s.id !== targetSectionId) return s;
        const arr = [...s.fields];
        arr.splice(typeof targetIndex === 'number' ? targetIndex : arr.length, 0, moving);
        return { ...s, fields: arr };
      });
    });
    setBuilderSelectedFieldId(fieldId);
  }

  function addBuilderSection() {
    const id = `task-section-${Date.now()}`;
    setBuilderSections((cur) => [...cur, { id, title: `New Section ${cur.length + 1}`, fields: [] }]);
  }

  function removeBuilderSection(sectionId) {
    setBuilderSections((cur) => (cur.length <= 1 ? cur : cur.filter((s) => s.id !== sectionId)));
  }

  function saveTaskFormDraft() {
    const name = String(taskFormName || '').trim();
    if (!name) {
      setTaskFormDraftError('Form name is required.');
      return;
    }
    const allFields = builderSections.flatMap((s) => s.fields || []);
    if (allFields.length === 0) {
      setTaskFormDraftError('Add at least one field from the left panel.');
      return;
    }
    const newForm = { id: `task-form-${Date.now()}`, title: name, description: 'No description provided', fields: allFields.map((f) => f.label), sections: builderSections, lastUpdated: new Date().toLocaleDateString('en-GB'), status: 'ACTIVE', iconName: 'call' };
    const next = [...getLeadTaskForms(), newForm];
    saveLeadTaskForms(next);
    setTaskForms(next);
    setForm((current) => ({ ...current, taskFormId: newForm.id, customValues: {} }));
    setShowFormEditor(false);
    setTaskFormName('');
    setBuilderSections([]);
    setBuilderSelectedFieldId(null);
    setTaskFormDraftError('');
    setBuilderSaveSuccess(true);
    setTimeout(() => setBuilderSaveSuccess(false), 1200);
    onActivity?.(`Task form "${name}" created`, '#1d6bff');
  }

  function openSelectedFormBuilder() {
    if (!selectedTaskForm) return;
    try { localStorage.setItem('activeTaskFormId', selectedTaskForm.id); } catch { }
    navigate(`/crm/leads/task-form/builder?formId=${selectedTaskForm.id}`);
  }

  function submitTask(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError('Task name is required.');
      return;
    }
    if (!form.taskDate) {
      setFormError('Task date is required.');
      return;
    }
    if (!form.taskTime) {
      setFormError('Task time is required.');
      return;
    }
    if (!form.assignee) {
      setFormError('Please select an assignee.');
      return;
    }
    const resolvedAssignee = resolveAssigneeSelection(form.assignee, assigneeOptions);
    const assigneeName = resolvedAssignee.name || String(form.assignee || '').trim();
    const assigneeId = resolvedAssignee.id || (isServerId(form.assigneeId) ? form.assigneeId : '');
    const nextTask = {
      defaultTask: form.defaultTask,
      title: form.title.trim(),
      stage: form.stage,
      status: form.status,
      priority: form.priority,
      dueAt: formatLeadTaskDueAt(form.taskDate, form.taskTime),
      taskDate: form.taskDate,
      taskTime: form.taskTime,
      department: form.department || 'Sales',
      icon: form.icon || 'call',
      process: form.status === 'Completed' ? 'Done' : (form.status === 'In Progress' ? 'In Progress' : 'Not Started'),
      assignee: assigneeName,
      assigneeId,
      assigneeName,
      description: form.description.trim(),
      proposalId: form.proposalId,
      deliveryChallanId: form.deliveryChallanId,
      taskFormId: form.taskFormId,
      taskFormName: selectedTaskForm?.title || '',
      customValues: form.customValues || {},
    };
    if (editingId) {
      setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...nextTask } : t)));
      const current = tasks.find((t) => t.id === editingId);
      if (current?.serverTaskId && isBackendEnabled()) {
        useCrmStore.getState().updateTask(current.serverTaskId, {
          title: nextTask.title,
          description: nextTask.description || undefined,
          assigneeId: assigneeId || undefined,
          dueDate: form.taskDate || undefined,
          dueTime: form.taskTime || undefined,
          icon: nextTask.icon || undefined,
          priority: ['Low', 'Medium', 'High', 'Urgent'].includes(nextTask.priority) ? nextTask.priority : 'Medium',
          status: drawerTaskStatusToServer(nextTask.status),
        }).catch((err) => console.warn('[CRM] drawer task not updated:', err?.message || err));
      }
      onActivity?.(`Task "${form.title.trim()}" updated`, '#1d6bff');
    } else {
      const manualTask = { id: `lt-${Date.now()}`, ...nextTask };
      setTasks((prev) => [
        manualTask,
        ...prev,
      ]);
      mirrorDrawerTaskToBackend({
        leadId: lead?.id, row: manualTask, taskDate: form.taskDate, assigneeName, assigneeId,
      }).then((saved) => {
        if (saved?.id) {
          setTasks((prev) => prev.map((t) => (t.id === manualTask.id ? { ...t, serverTaskId: saved.id, assigneeId: saved.assigneeId || assigneeId, assigneeName: saved.assigneeName || assigneeName } : t)));
        }
      });
      onActivity?.(`Task "${form.title.trim()}" added`, '#16a34a');
      emitCrmEvent({
        type: CRM_EVENT_TYPES.TASK_CREATED,
        entityType: 'lead-task',
        entityId: manualTask.id,
        payload: {
          title: manualTask.title,
          ownerName: manualTask.assignee,
          leadName: lead?.name,
          leadId: lead?.id,
          path: `/crm/leads/${lead?.id}`,
        },
      });
    }
    setIsModalOpen(false);
  }

  function getLinkedFormFields(task) {
    if (!task?.taskFormId) return [];
    const definition = taskForms.find((f) => String(f.id) === String(task.taskFormId)) || null;
    if (!definition) return [];
    const sections = Array.isArray(definition.sections) && definition.sections.length > 0
      ? definition.sections
      : (Array.isArray(definition.schema?.sections) ? definition.schema.sections : []);
    if (sections.length > 0) return sections.flatMap((s) => s.fields || []);
    return (definition.fields || []).map((label, index) => (
      typeof label === 'string' ? { id: `f-${index}`, label, type: 'text' } : label
    ));
  }

  function openTaskFormFill(task) {
    setFormFillId(task.id);
    setFormFillValues({ ...(task.customValues || {}) });
    setFormFillError('');
  }

  function requestTaskCompletion(task) {
    if (!task || task.status === 'Completed') return;
    if (task.status === 'In Progress' && task.startedAt) {
      const nowMs = Date.now();
      const currentRun = Math.max(0, Math.floor((nowMs - new Date(task.startedAt).getTime()) / 1000));
      const totalDuration = (Number(task.durationSeconds) || 0) + currentRun;
      const endedAt = new Date(nowMs).toISOString();
      task = {
        ...task,
        durationSeconds: totalDuration,
        endedAt,
      };
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? task : t))
      );
    }
    const fields = getLinkedFormFields(task);
    if (task.taskFormId && fields.length > 0) {
      openTaskFormFill(task);
      return;
    }
    setCompleteId(task.id);
  }

  function updateFormFillValue(fieldId, value) {
    setFormFillValues((current) => ({ ...current, [fieldId]: value }));
  }

  function cancelFormFill() {
    setFormFillId(null);
    setFormFillValues({});
    setFormFillError('');
  }

  function submitFormFill(e) {
    if (e) e.preventDefault();
    const target = tasks.find((t) => String(t.id) === String(formFillId)) || formFillTask;
    if (!target) {
      cancelFormFill();
      return;
    }
    for (const field of formFillFields) {
      if (field.required && !String(formFillValues?.[field.id] ?? '').trim()) {
        setFormFillError(`"${field.label}" is required.`);
        return;
      }
    }
    setTasks((prev) => prev.map((t) => (String(t.id) === String(target.id) ? { ...t, customValues: { ...(formFillValues || {}) } } : t)));
    const filledId = target.id;
    setFormFillId(null);
    setFormFillValues({});
    setFormFillError('');
    setCompleteId(filledId);
  }

  function toggleStatus(task) {
    if (task.status === 'Due') {
      requestTaskCompletion(task);
      return;
    }
    // Reopen a completed task: clear completion metadata
    const reopened = tasks.find((t) => t.id === task.id);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: 'Due',
              process: 'Not Started',
              completionOutcome: undefined,
              nextAction: undefined,
              completedAt: undefined,
              completedBy: undefined,
            }
          : t
      )
    );
    if (reopened?.serverTaskId && isBackendEnabled()) {
      useCrmStore.getState().updateTask(reopened.serverTaskId, { status: 'Open' })
        .catch((err) => console.warn('[CRM] drawer task reopen not saved:', err?.message || err));
    }
    if (reopened?.crmTaskId) {
      try {
        const crmTasks = loadCrmTasks();
        const nextCrmTasks = crmTasks.map((t) =>
          String(t.id) === String(reopened.crmTaskId)
            ? {
                ...t,
                status: 'Open',
                completionOutcome: undefined,
                nextAction: undefined,
                completedAt: undefined,
                completedBy: undefined,
              }
            : t
        );
        saveCrmTasks(nextCrmTasks);
      } catch (err) {
        console.error('[CRM Completion] Error reopening task in Task List:', err);
      }
    }
  }

  async function submitCompleteTask(outcome, nextAction, note, nextFollowUpAt, targetStageId) {
    const detailTask = tasks.find((t) => t.id === completeId);
    if (!detailTask) {
      return { ok: false, message: 'Task could not be found.' };
    }
    const actor = currentUser?.name || defaultAssignee || lead?.owner || 'CRM User';
    const serverTaskId = detailTask.serverTaskId || detailTask.crmTaskId || null;
    let crmTask = null;
    try {
      const storeTasks = useCrmStore.getState().tasks || [];
      const localCrmTasks = loadCrmTasks();
      const combined = [...storeTasks, ...localCrmTasks];
      if (serverTaskId) {
        crmTask = combined.find((t) => String(t.id) === String(serverTaskId)) || null;
      }
      if (!crmTask && detailTask.title && lead?.id) {
        crmTask = storeTasks.find((t) => String(t.leadId) === String(lead.id) && String(t.title) === String(detailTask.title) && String(t.status) !== 'Completed') || null;
      }
    } catch (err) {
      console.error('[CRM Completion] Error loading Task List store:', err);
    }
    if (crmTask?.id) {
      const result = await completeTaskWithOutcome({
        task: crmTask,
        lead,
        outcome,
        nextAction,
        note,
        nextFollowUpAt,
        targetStageId,
        completedBy: actor,
        leadDetailTask: detailTask,
      });
      if (result?.ok !== false) {
        if (Array.isArray(result.leadDetailTasks)) {
          setTasks(result.leadDetailTasks);
        } else {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === detailTask.id
                ? {
                    ...t,
                    status: 'Completed',
                    process: 'Done',
                    completionOutcome: outcome,
                    nextAction,
                    completedAt: new Date().toISOString(),
                    completedBy: actor,
                  }
                : t
            )
          );
        }
        if (result?.stageChanged && isBackendEnabled() && isServerId(lead?.id)) {
          crmService.getTasks({ leadId: lead.id }).then((body) => {
            const rows = Array.isArray(body) ? body : (body?.results || []);
            if (!Array.isArray(rows) || rows.length === 0) return;
            setTasks((prev) => {
              const known = new Set(prev.map((t) => t.serverTaskId).filter(Boolean).map((v) => String(v)));
              const incoming = rows
                .filter((r) => r?.id && !known.has(String(r.id)))
                .map((r) => serverTaskToDrawerRow(r));
              return incoming.length > 0 ? [...incoming, ...prev] : prev;
            });
          }).catch(() => {});
        }
      }
      return result;
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === detailTask.id
          ? {
              ...t,
              status: 'Completed',
              process: 'Done',
              completionOutcome: outcome,
              nextAction,
              completedAt: new Date().toISOString(),
              completedBy: actor,
            }
          : t
      )
    );
    if (detailTask.serverTaskId && isBackendEnabled()) {
      useCrmStore.getState().updateTask(detailTask.serverTaskId, { status: 'Completed' })
        .catch((err) => console.warn('[CRM] drawer task completion not saved:', err?.message || err));
    }
    return { ok: true, message: 'Task completed successfully.', warnings: [] };
  }

  function handleCompleteSuccess(result) {
    setCompleteId(null);
    const leadId = result?.leadId || result?.lead?.id || lead?.id || null;
    if (result?.stageChanged && leadId) {
      navigate(`/crm/leads/${encodeURIComponent(leadId)}?tab=tasks`);
    }
  }

  function confirmDelete() {
    if (!deleteId) return;
    const target = tasks.find((t) => t.id === deleteId);
    setTasks((prev) => prev.filter((t) => t.id !== deleteId));
    if (target?.serverTaskId && isBackendEnabled()) {
      useCrmStore.getState().deleteTask(target.serverTaskId)
        .catch((err) => console.warn('[CRM] drawer task not deleted:', err?.message || err));
    }
    onActivity?.(`Task "${target?.title ?? 'entry'}" removed`, '#f59e0b');
    setDeleteId(null);
  }

  function priorityCls(priority) {
    if (priority === 'High') return 'bg-rose-50 text-rose-600 border border-rose-100';
    if (priority === 'Low') return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    return 'bg-orange-50 text-orange-500 border border-orange-100';
  }

  function renderCard(task) {
    const isCompleted = task.status === 'Completed';
    const isInProgress = task.status === 'In Progress';
    const isDue = !isCompleted && !isInProgress;

    return (
      <div
        key={task.id}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 transition hover:shadow-sm"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Column: Icon + Task details */}
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/80 flex items-center justify-center shrink-0 mt-0.5">
              <Phone size={20} />
            </div>

            <div className="min-w-0 flex-1">
              {/* Title & Due badge */}
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 leading-tight">
                  {task.title}
                </h4>
                {isDue && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-none">
                    Due
                  </span>
                )}
              </div>

              {/* Company & Stage */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-600 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={13} className="text-slate-400" />
                  <span>{lead?.company || lead?.name || 'Company'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Folder size={13} className="text-slate-400" />
                  <span>{task.stage || lead?.stage?.name || lead?.stage || 'New Lead'}</span>
                </span>
              </div>

              {/* Priority, DateTime, Assignee, Department */}
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 mt-2.5 text-xs">
                {/* Priority pill */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                  task.priority === 'High' || task.priority === 'Urgent'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : task.priority === 'Low'
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-orange-50/70 text-orange-600 border border-orange-200'
                }`}>
                  {task.priority === 'Low' ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                  {task.priority || 'Medium'}
                </span>

                {/* Calendar / Date */}
                <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                  <Calendar size={13} className="text-slate-400" />
                  <span>{task.dueAt || formatTaskDateTime(task.dueDate)}</span>
                </span>

                {/* Assignee */}
                <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                  <User size={13} className="text-slate-400" />
                  <span>{task.assignee || 'Unassigned'}</span>
                </span>

                {/* Department */}
                <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                  <Tag size={13} className="text-slate-400" />
                  <span>{task.department || 'Sales'}</span>
                </span>
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-xs text-slate-600 mt-2 font-normal leading-relaxed">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          {/* Right Action Area */}
          <div className="flex items-center justify-end gap-3 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Start / In Progress / Completed Widget */}
            {isDue && (
              <button
                type="button"
                onClick={() => handleStartTask(task)}
                className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-blue-200 bg-white hover:bg-blue-50/50 hover:border-blue-300 text-blue-600 transition shadow-2xs cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center group-hover:scale-105 transition">
                  <Play size={13} className="fill-white ml-0.5" />
                </div>
                <span className="text-xs font-bold text-blue-600">
                  {task.durationSeconds > 0 ? 'Resume Task' : 'Start Task'}
                </span>
                {task.durationSeconds > 0 && (
                  <span className="text-[11px] font-semibold text-slate-500">
                    ({formatDurationHHMMSS(task.durationSeconds)})
                  </span>
                )}
              </button>
            )}

            {isInProgress && (
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleStopTask(task)}
                  title="Stop Task"
                  className="w-9 h-9 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition cursor-pointer shrink-0"
                >
                  <Square size={13} className="fill-white" />
                </button>
                <div>
                  <span className="text-[10px] font-medium text-slate-500 block leading-tight">Task in Progress</span>
                  <span className="text-base font-bold text-slate-900 tracking-tight leading-tight block">
                    {formatDurationHHMMSS(getTaskDurationSeconds(task))}
                  </span>
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 text-[11px] text-slate-600 min-w-[210px] space-y-1">
                <div className="inline-flex items-center gap-1.5 text-emerald-600 font-bold mb-1">
                  <CheckCircle2 size={13} className="stroke-[2.5]" /> Completed
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-600">
                  <span className="text-slate-400">Start Time</span>
                  <span className="font-medium text-slate-800">{formatTaskDateTime(task.startedAt || task.dueAt)}</span>
                  <span className="text-slate-400">End Time</span>
                  <span className="font-medium text-slate-800">{formatTaskDateTime(task.endedAt || task.completedAt)}</span>
                  <span className="text-slate-400">Total Duration</span>
                  <span className="font-medium text-slate-800">{formatDurationHHMMSS(task.durationSeconds || getTaskDurationSeconds(task))}</span>
                </div>
              </div>
            )}

            {/* 3 action buttons: Complete, Edit, Delete */}
            <div className="flex items-center gap-2">
              {/* Complete button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => requestTaskCompletion(task)}
                  title={isCompleted ? 'Already Completed' : 'Complete Task'}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition shadow-2xs ${
                    isCompleted
                      ? 'bg-emerald-500 text-white opacity-90 cursor-default'
                      : 'bg-rose-500 hover:bg-rose-600 text-white cursor-pointer'
                  }`}
                >
                  <ClipboardCheck size={16} />
                </button>
                <span className={`text-[10px] font-semibold mt-1 ${isCompleted ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isCompleted ? 'Done' : 'Complete'}
                </span>
              </div>

              {/* Edit button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => openEdit(task)}
                  title="Edit Task"
                  className="w-9 h-9 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition shadow-2xs cursor-pointer"
                >
                  <Pencil size={15} />
                </button>
                <span className="text-[10px] text-blue-600 font-semibold mt-1">Edit</span>
              </div>

              {/* Delete button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setDeleteId(task.id)}
                  title="Delete Task"
                  className="w-9 h-9 rounded-xl bg-rose-500 hover:bg-rose-700 text-white flex items-center justify-center transition shadow-2xs cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
                <span className="text-[10px] text-rose-600 font-semibold mt-1">Delete</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attached progress strip for In Progress tasks */}
        {isInProgress && (
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Play size={10} className="fill-emerald-600 ml-0.5" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block leading-tight">Start Time</span>
                <span className="font-semibold text-slate-800">{formatTaskDateTime(task.startedAt)}</span>
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <Square size={9} className="fill-rose-600" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block leading-tight">End Time</span>
                <span className="font-semibold text-slate-800">-</span>
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Clock size={11} className="text-blue-600" />
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block leading-tight">Total Duration</span>
                <span className="font-semibold text-blue-600">
                  {formatDurationHHMMSS(getTaskDurationSeconds(task))} (In Progress)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <ClipboardList className="w-5 h-5 text-slate-800" />
          <h3 className="text-base font-bold text-slate-900">Tasks</h3>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
        >
          <Plus size={15} /> Add Task
        </button>
      </div>

      {/* Due Tasks Section */}
      <div
        className="flex items-center justify-between px-6 py-3.5 bg-rose-50/70 border-b border-rose-100/70 cursor-pointer select-none"
        onClick={() => setDueTasksExpanded(!dueTasksExpanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center">
            <Clock size={14} className="stroke-[2.5]" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Due Tasks</h4>
          <span className="min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-slate-400 text-white text-[11px] font-bold">
            {dueTasks.length}
          </span>
        </div>
        <button type="button" className="text-slate-500 hover:text-slate-700">
          {dueTasksExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      {dueTasksExpanded && (
        <div className="p-4 sm:p-5 space-y-3.5 bg-slate-50/40">
          {dueTasks.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400 font-medium">No due tasks. Click + Add Task to create one.</p>
          ) : (
            dueTasks.map((t) => renderCard(t))
          )}
        </div>
      )}

      {/* Completed Tasks Section */}
      <div
        className="flex items-center justify-between px-6 py-3.5 bg-slate-50/90 border-y border-slate-100 cursor-pointer select-none"
        onClick={() => setCompletedTasksExpanded(!completedTasksExpanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center">
            <CheckCircle2 size={14} className="stroke-[2.5]" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">Completed Tasks</h4>
          <span className="min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-slate-400 text-white text-[11px] font-bold">
            {doneTasks.length}
          </span>
        </div>
        <button type="button" className="text-slate-500 hover:text-slate-700">
          {completedTasksExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      {completedTasksExpanded && (
        <div className="p-4 sm:p-5 space-y-3.5 bg-slate-50/40">
          {doneTasks.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400 font-medium">No completed tasks yet.</p>
          ) : (
            doneTasks.map((t) => renderCard(t))
          )}
        </div>
      )}

      {isModalOpen && editingId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/50" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Edit Task">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-[15px] font-bold text-slate-900">Edit Task</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitTask} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Name <span className="text-rose-500">*</span></label>
                <input autoFocus value={form.title} onChange={(e) => updateTaskForm('title', e.target.value)} placeholder="Enter Name" className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Date <span className="text-rose-500">*</span></label>
                  <input type="date" value={form.taskDate} onChange={(e) => updateTaskForm('taskDate', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Time <span className="text-rose-500">*</span></label>
                  <input type="time" value={form.taskTime} onChange={(e) => updateTaskForm('taskTime', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[13px] font-semibold text-slate-800">Assign To</label>
                  <MasterSourceLink source="users" />
                </div>
                <select value={form.assignee} onChange={(e) => updateTaskForm('assignee', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                  <option value="">Select Staff</option>
                  {assigneeOptions.map((option) => (<option key={option.id || option.name} value={option.id && isServerId(option.id) ? option.id : option.name}>{option.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Description</label>
                <textarea rows={4} value={form.description} onChange={(e) => updateTaskForm('description', e.target.value)} placeholder="Enter task related description or notes" className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 resize-y focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Priority <span className="text-rose-500">*</span></label>
                  <select value={form.priority} onChange={(e) => updateTaskForm('priority', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                    {LEAD_TASK_PRIORITY_OPTIONS.map((priority) => (<option key={priority} value={priority}>{priority}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Status <span className="text-rose-500">*</span></label>
                  <select value={form.status} onChange={(e) => updateTaskForm('status', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                    {['Due', 'Completed'].map((status) => (<option key={status} value={status}>{status}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Proposal</label>
                  <select value={form.proposalId} onChange={(e) => updateTaskForm('proposalId', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                    <option value="">Select Proposal</option>
                    {linkedQuotations.map((quotation) => (<option key={quotation.id} value={quotation.id}>{quotation.quoteNumber || quotation.quotationNumber || quotation.customer || 'Proposal'}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Delivery Challan</label>
                  <select value={form.deliveryChallanId} onChange={(e) => updateTaskForm('deliveryChallanId', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                    <option value="">Select Delivery Challan</option>
                    {linkedChallans.map((challan) => (<option key={challan.id} value={challan.id}>{challan.challanNumber || challan.linkedSo || challan.customer || 'Delivery Challan'}</option>))}
                  </select>
                </div>
              </div>
              {formError && <p className="text-xs font-semibold text-rose-600">{formError}</p>}
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button type="button" onClick={() => setIsModalOpen(false)} className="h-10 px-5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[13px] font-semibold border border-slate-200 transition">Cancel</button>
                <button type="submit" className="h-10 px-6 rounded-lg bg-[#1d4a79] hover:bg-[#163a61] text-white text-[13px] font-semibold transition">Update Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && !editingId && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-2 sm:p-4 bg-slate-950/50 overflow-y-auto" onClick={() => setIsModalOpen(false)}>
          <div className="bg-[#f1f5f9] rounded-xl shadow-2xl w-full max-w-5xl my-6 overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={editingId ? 'Edit lead task' : 'Create lead task'}>
            <div className="bg-white px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-[15px] font-bold text-slate-900">{editingId ? 'Edit Lead Task' : 'Create Lead Task'}</h2>
              <p className="text-[11px] text-slate-500 mt-1">Dashboard <span className="mx-1">&gt;</span> Lead Task <span className="mx-1">&gt;</span> {editingId ? 'Edit Lead Task' : 'Create Lead Task'}</p>
            </div>

            <form onSubmit={submitTask} className="px-6 py-5">
              <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[13px] font-semibold text-slate-800">Default Task</label>
                    <MasterSourceLink source="leadTasks" />
                  </div>
                  <select value={form.defaultTask} onChange={(e) => updateTaskForm('defaultTask', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                    <option value="custom">Create custom task</option>
                    {masterTaskOptions.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Name <span className="text-rose-500">*</span></label>
                  <input autoFocus value={form.title} onChange={(e) => updateTaskForm('title', e.target.value)} placeholder="Enter Name" className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Date <span className="text-rose-500">*</span></label>
                    <input type="date" value={form.taskDate} onChange={(e) => updateTaskForm('taskDate', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Time <span className="text-rose-500">*</span></label>
                    <input type="time" value={form.taskTime} onChange={(e) => updateTaskForm('taskTime', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Description</label>
                  <textarea rows={4} value={form.description} onChange={(e) => updateTaskForm('description', e.target.value)} placeholder="Enter task related description or notes" className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 resize-y focus:outline-none focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Priority <span className="text-rose-500">*</span></label>
                    <select value={form.priority} onChange={(e) => updateTaskForm('priority', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                      {LEAD_TASK_PRIORITY_OPTIONS.map((priority) => (<option key={priority} value={priority}>{priority}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Status</label>
                    <select value={form.status} onChange={(e) => updateTaskForm('status', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                      {['Due', 'Completed'].map((status) => (<option key={status} value={status}>{status}</option>))}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[13px] font-semibold text-slate-800">Assign To</label>
                    <MasterSourceLink source="users" />
                  </div>
                  <select value={form.assignee} onChange={(e) => updateTaskForm('assignee', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                    <option value="">Select Staff</option>
                    {assigneeOptions.map((option) => (<option key={option.id || option.name} value={option.id && isServerId(option.id) ? option.id : option.name}>{option.name}</option>))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Proposal</label>
                    <select value={form.proposalId} onChange={(e) => updateTaskForm('proposalId', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                      <option value="">Select Proposal</option>
                      {linkedQuotations.map((quotation) => (<option key={quotation.id} value={quotation.id}>{quotation.quoteNumber || quotation.quotationNumber || quotation.customer || 'Proposal'}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-800 mb-1.5">Delivery Challan</label>
                    <select value={form.deliveryChallanId} onChange={(e) => updateTaskForm('deliveryChallanId', e.target.value)} className="w-full h-11 px-4 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                      <option value="">Select Delivery Challan</option>
                      {linkedChallans.map((challan) => (<option key={challan.id} value={challan.id}>{challan.challanNumber || challan.linkedSo || challan.customer || 'Delivery Challan'}</option>))}
                    </select>
                  </div>
                </div>
                {formError && <p className="text-xs font-semibold text-rose-600">{formError}</p>}
              </div>
              <div className="flex items-center justify-end gap-2.5 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="h-10 px-5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[13px] font-semibold border border-slate-200 transition">Cancel</button>
                <button type="submit" className="h-10 px-6 rounded-lg bg-[#1d4a79] hover:bg-[#163a61] text-white text-[13px] font-semibold transition">{editingId ? 'Update' : 'Create'}</button>
              </div>
              <p className="text-[11px] text-slate-400 mt-4">© 2026 IMT Endoscopy</p>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/50" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-slate-900">Delete this task?</h2>
            <p className="text-xs text-slate-500 mt-1">This action cannot be undone.</p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button type="button" onClick={() => setDeleteId(null)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">Cancel</button>
              <button type="button" onClick={confirmDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {formFillId && formFillTask && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/50 p-2 sm:p-4" onClick={cancelFormFill}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Complete Task Form">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">{formFillDefinition?.title || formFillTask.taskFormName || 'Task Form'}</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">{formFillTask.title} · Step 1 of 2</p>
              </div>
              <button type="button" onClick={cancelFormFill} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitFormFill} className="px-5 py-4 space-y-3">
              {formFillDefinition?.description && (
                <p className="text-[12px] text-slate-500">{formFillDefinition.description}</p>
              )}
              {formFillFields.length === 0 && (
                <p className="text-[12px] text-slate-400">No fields defined in this form yet.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formFillFields.map((field) => (
                  <label key={field.id} className={String(field.type).toLowerCase() === 'multi line' ? 'block sm:col-span-2' : 'block'}>
                    <span className="block text-[12px] font-semibold text-slate-700 mb-1">{field.label} {field.required && <span className="text-rose-500">*</span>}</span>
                    {String(field.type).toLowerCase() === 'multi line' ? (
                      <textarea rows={3} value={formFillValues?.[field.id] || ''} onChange={(e) => updateFormFillValue(field.id, e.target.value)} placeholder={field.placeholder || `Enter ${String(field.label).toLowerCase()}`} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                    ) : String(field.type).toLowerCase() === 'dropdown' || String(field.type).toLowerCase() === 'multi select' ? (
                      <select value={formFillValues?.[field.id] || ''} onChange={(e) => updateFormFillValue(field.id, e.target.value)} className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500">
                        <option value="">{field.placeholder || 'Select option'}</option>
                        {String(field.options || field.placeholder || '').split(',').map((o) => o.trim()).filter(Boolean).map((o) => (<option key={o} value={o}>{o}</option>))}
                      </select>
                    ) : (
                      <input type={String(field.type).toLowerCase() === 'number' ? 'number' : String(field.type).toLowerCase() === 'date' ? 'date' : String(field.type).toLowerCase() === 'email' ? 'email' : String(field.type).toLowerCase() === 'phone' ? 'tel' : 'text'} value={formFillValues?.[field.id] || ''} onChange={(e) => updateFormFillValue(field.id, e.target.value)} placeholder={field.placeholder || `Enter ${String(field.label).toLowerCase()}`} className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500" />
                    )}
                  </label>
                ))}
              </div>
              {formFillError && <p className="text-xs font-semibold text-rose-600">{formFillError}</p>}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button type="button" onClick={cancelFormFill} className="h-10 px-5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[13px] font-semibold border border-slate-200 transition">Cancel</button>
                <button type="submit" className="h-10 px-6 rounded-lg bg-[#1d4a79] hover:bg-[#163a61] text-white text-[13px] font-semibold transition">Save and Continue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {completeId && (
        <CompleteTaskModal
          open={Boolean(completeId)}
          task={tasks.find((t) => t.id === completeId) || null}
          lead={lead}
          blockingTasks={tasks.filter((t) => t.id !== completeId && t.status === 'Due').map((t) => t.title).filter(Boolean)}
          onCancel={() => setCompleteId(null)}
          onComplete={submitCompleteTask}
          onSuccess={handleCompleteSuccess}
        />
      )}
    </div>
  );
}

function quotationMatchesLead(q, lead) {
  if (!q || !lead) return false;
  if (q.leadId && String(q.leadId) === String(lead.id)) return true;
  // Sales composer stores a typed "Deal / Lead Reference" (e.g. LEAD-0008)
  // instead of the lead id when created directly in Sales — match it against
  // the lead number so those quotations link back to this lead.
  const leadNumbers = [lead.leadNumber, lead.lead_number, lead.id]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean);
  const refs = [q.dealReference, q.dealId]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean);
  if (leadNumbers.some((n) => refs.includes(n))) return true;
  const company = String(lead.company || '').trim().toLowerCase();
  const customer = String(q.customer || '').trim().toLowerCase();
  if (company && customer && (customer === company || customer.includes(company) || company.includes(customer))) return true;
  const leadName = String(lead.name || '').trim().toLowerCase();
  const qLead = String(q.leadName || '').trim().toLowerCase();
  if (leadName && qLead && qLead === leadName) return true;
  return false;
}

function QuotationsTab({ lead, onActivity }) {
  const { quotations, customers, updateQuotationStatus, approveQuotation } = useERP() || {};
  const linked = useMemo(() => (quotations || []).filter((q) => quotationMatchesLead(q, lead)), [quotations, lead]);
  const storedProducts = useLeadDetailState(lead).products;
  const [approvingId, setApprovingId] = useState(null);
  // Inline view state: list | create | edit — the form renders inside this
  // tab's content area, never as a modal or a route change.
  const [view, setView] = useState({ name: 'list' });

  const isApprovedStatus = (status) => ['Accepted', 'Approved', 'Converted', 'Confirmed', 'Invoiced'].includes(status);
  const canApprove = (q) => !isApprovedStatus(q.status) && !['Rejected', 'Cancelled', 'Expired'].includes(q.status);

  const [rejectingId, setRejectingId] = useState(null);

  async function approveQuotationRow(q) {
    if (!q || approvingId) return;
    setApprovingId(q.id);
    try {
      if (isBackendEnabled() && isServerId(q.id) && approveQuotation) {
        const envelope = await approveQuotation(q.id);
        onActivity?.(`Quotation ${q.quoteNumber || ''} approved — lead converted to customer ${envelope?.customer?.name || ''}`.trim(), '#10b981');
      } else {
        updateQuotationStatus?.(q.id, 'Accepted');
        onActivity?.(`Quotation ${q.quoteNumber || ''} approved`, '#10b981');
      }
    } catch {
      // approveQuotation already toasted the reason; keep the row untouched.
    } finally {
      setApprovingId(null);
    }
  }

  async function rejectQuotationRow(q) {
    if (!q || rejectingId) return;
    setRejectingId(q.id);
    try {
      if (isBackendEnabled() && isServerId(q.id)) {
        try {
          await api.post(`/sales/quotations/${q.id}/reject/`);
        } catch (err) {
          console.warn('[LeadDetailView] reject quotation failed:', err);
        }
      }
      updateQuotationStatus?.(q.id, 'Rejected');
      onActivity?.(`Quotation ${q.quoteNumber || ''} rejected — moved to Open for negotiation`, '#f59e0b');
    } finally {
      setRejectingId(null);
    }
  }

  // Prefill for the inline form: customer/lead identity plus the lead's
  // fabric requirements as line items (master specs resolve in the form).
  function leadPrefill() {
    const match = (customers || []).find((customer) => customer.name === (lead?.company || lead?.name)) || (customers || [])[0];
    return {
      fromLead: true,
      leadId: String(lead?.id || ''),
      leadName: lead?.name || '',
      company: lead?.company || lead?.name || '',
      customerId: match?.id || '',
      dealReference: lead?.leadNumber || lead?.lead_number || '',
      items: (storedProducts || []).map((product) => ({
        name: product.name,
        qty: 1,
        rate: Number(String(product.price || '').replace(/[^0-9.]/g, '')) || 0,
      })),
    };
  }

  // Only Draft server rows accept PATCH (api.md §1.9); local-only rows are
  // always editable. Anything else opens in Sales (read-only view).
  const canEditQuote = (q) => Boolean(q) && (!isServerId(q.id) || q.status === 'Draft');

  const activeEdit = view.name === 'edit'
    ? linked.find((q) => String(q.id) === String(view.id)) || null
    : null;

  function handleFormDone(saved, wasEdit) {
    const number = saved?.quoteNumber || saved?.quotationNumber || activeEdit?.quoteNumber || '';
    onActivity?.(
      wasEdit
        ? `Quotation ${number} updated`
        : `Quotation ${number || 'created'} generated for ${lead?.name || 'lead'}`,
      '#3b82f6',
    );
    setView({ name: 'list' });
  }

  if (view.name === 'create' || (view.name === 'edit' && activeEdit)) {
    const isEdit = view.name === 'edit';
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="card-header flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-sm">{isEdit ? `Edit ${activeEdit.quoteNumber}` : 'New Quotation'}</h3>
            <span className="text-[11px] text-slate-500">
              for {lead?.company || lead?.name || 'lead'}{isEdit ? ` • ${activeEdit.status}` : ''}
            </span>
          </div>
        </div>
        <QuotationComposerPage
          key={isEdit ? `edit-${activeEdit.id}` : 'create'}
          embedded={{
            prefill: isEdit ? null : leadPrefill(),
            editQuote: isEdit ? activeEdit : null,
            onDone: (saved) => handleFormDone(saved, isEdit),
            onCancel: () => setView({ name: 'list' }),
          }}
        />
      </div>
    );
  }

  function sendQuotation(q) {
    window.location.assign(`/sales/quotations?quotationId=${encodeURIComponent(q.id)}&send=1`);
  }

  function quotationTone(status) {
    if (status === 'Sent') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (status === 'Confirmed' || status === 'Accepted' || status === 'Converted') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  }

  return (
    <div className="card">
      <div className="card-header flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
        <h3 className="font-bold text-sm">Quotations ({linked.length})</h3>
        <div className="flex items-center gap-2">
          <Link to="/sales/quotations" className="btn-sm inline-flex items-center gap-1.5 rounded-lg border border-[#dce5f4] bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition" title="Open all quotations in Sales">
            View in Sales <ArrowRight size={13} />
          </Link>
          <button type="button" onClick={() => setView({ name: 'create' })} className="btn-primary btn-sm flex items-center gap-1.5" title="Create quotation inline">
            <Plus size={13} strokeWidth={2.4} /> New Quotation
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table text-xs min-w-[640px] lg:min-w-0">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Quotation No.</th>
              <th>Lead Name</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Valid Until</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ width: 110, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {linked.map((q, idx) => (
              <tr key={q.id}>
                <td className="text-slate-500 font-mono">{idx + 1}</td>
                <td>
                  {canEditQuote(q) ? (
                    <button type="button" onClick={() => setView({ name: 'edit', id: q.id })} className="font-mono font-bold text-blue-600 hover:underline" title="Edit quotation">
                      {q.quoteNumber}
                    </button>
                  ) : (
                    <Link to={`/sales/quotations/${q.id}`} className="font-mono font-bold text-blue-600 hover:underline" title="Open in Sales Quotations">
                      {q.quoteNumber}
                    </Link>
                  )}
                </td>
                <td className="text-slate-600">{q.leadName || lead?.name || '—'}</td>
                <td className="font-semibold">{q.customer}</td>
                <td className="text-slate-500 text-xs whitespace-nowrap">{q.date}</td>
                <td className="text-slate-500 text-xs">{q.validUntil}</td>
                <td style={{ textAlign: 'right' }} className="font-bold font-mono">
                  ${(q.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${quotationTone(q.status)}`}>
                    {q.status}
                  </span>
                </td>
                <td>
                  <div className="flex items-center justify-center gap-1">
                    {canEditQuote(q) ? (
                      <button type="button" onClick={() => setView({ name: 'edit', id: q.id })} className="p-1 rounded text-blue-600 hover:bg-blue-50 transition cursor-pointer inline-flex" title="Edit quotation">
                        <Eye size={13} />
                      </button>
                    ) : (
                      <Link to={`/sales/quotations/${q.id}`} className="p-1 rounded text-blue-600 hover:bg-blue-50 transition cursor-pointer inline-flex" title="Open quotation in Sales">
                        <Eye size={13} />
                      </Link>
                    )}
                    {canEditQuote(q) && (
                      <button type="button" onClick={() => setView({ name: 'edit', id: q.id })} className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer inline-flex" title="Edit quotation">
                        <Pencil size={13} />
                      </button>
                    )}
                    {canApprove(q) && (
                      <>
                        <button
                          type="button"
                          onClick={() => approveQuotationRow(q)}
                          disabled={approvingId === q.id || rejectingId === q.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition cursor-pointer disabled:opacity-60"
                          title="Approve quotation — converts this lead to a customer automatically and marks deal Won"
                        >
                          <Check size={11} /> {approvingId === q.id ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectQuotationRow(q)}
                          disabled={approvingId === q.id || rejectingId === q.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold hover:bg-rose-100 transition cursor-pointer disabled:opacity-60"
                          title="Reject quotation — moves quotation to Rejected and deal to Open"
                        >
                          <X size={11} /> {rejectingId === q.id ? 'Rejecting…' : 'Reject'}
                        </button>
                      </>
                    )}
                    {isApprovedStatus(q.status) && (lead?.party || lead?.partyId || lead?.company) && (
                      <button
                        type="button"
                        onClick={() => window.location.assign('/crm/customers')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition cursor-pointer"
                        title="Open the converted customer record"
                      >
                        View Customer
                      </button>
                    )}
                    {q.status !== 'Sent' && !isApprovedStatus(q.status) && (
                      <button type="button" onClick={() => sendQuotation(q)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition cursor-pointer" title="Send quotation to lead">
                        <Send size={11} /> Send
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {linked.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-row">No quotations for {lead?.name || 'this lead'} yet. <Link to="/sales/quotations" className="font-bold text-blue-600 hover:underline">Open Sales Quotations</Link> to create one.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeliveryChallansTab({ lead, onCountsChange, onActivity }) {
  const { deliveryChallans, salesOrders, addDeliveryChallan } = useERP() || {};
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedSoId, setSelectedSoId] = useState('');
  const [transporter, setTransporter] = useState('FedEx Freight Direct');
  const [vehicleNo, setVehicleNo] = useState('TRK-9041-WA');
  const [driverContact, setDriverContact] = useState('+1 (555) 349-2810');
  const [totalPackages, setTotalPackages] = useState(4);
  const [dispatchNote, setDispatchNote] = useState('Fragile electronic components. Handle with pallet forklift.');
  const [lineItems, setLineItems] = useState([]);

  const linked = useMemo(() => {
    const allChallans = deliveryChallans || [];
    const customerName = String(lead?.company || lead?.name || '').trim().toLowerCase();
    const leadName = String(lead?.name || '').trim().toLowerCase();

    return allChallans.filter((challan) => {
      const customerMatch = challan.customer && (
        String(challan.customer).trim().toLowerCase().includes(customerName) ||
        (leadName && String(challan.customer).trim().toLowerCase().includes(leadName)) ||
        (customerName && String(challan.customer).trim().toLowerCase().includes(customerName))
      );
      const orderMatch = (salesOrders || []).some((order) => {
        const orderMatchesLead = order.customer && (
          String(order.customer).trim().toLowerCase().includes(customerName) ||
          (leadName && String(order.customer).trim().toLowerCase().includes(leadName))
        );
        return orderMatchesLead && (
          order.id === challan.salesOrderId ||
          order.orderNumber === challan.salesOrderNumber ||
          order.orderNumber === challan.linkedSo
        );
      });
      return customerMatch || orderMatch || !customerName;
    });
  }, [deliveryChallans, lead, salesOrders]);

  useEffect(() => {
    onCountsChange?.({ challans: linked.length });
  }, [linked.length, onCountsChange]);

  function openIssueModal() {
    const relatedOrders = (salesOrders || []).filter((order) => {
      const customerName = String(lead?.company || lead?.name || '').trim().toLowerCase();
      const customerValue = String(order.customer || '').trim().toLowerCase();
      return !customerName || customerValue.includes(customerName) || customerName.includes(customerValue);
    });

    const order = relatedOrders[0] || (salesOrders || [])[0];
    setSelectedSoId(order?.id || '');
    setLineItems(order?.items ? order.items.map((item) => ({ ...item })) : []);
    setShowIssueModal(true);
  }

  function handleCreate(event) {
    event.preventDefault();
    const order = (salesOrders || []).find((entry) => entry.id === selectedSoId) || (salesOrders || [])[0];
    if (!order) return;

    const created = addDeliveryChallan?.({
      salesOrderId: order.id,
      salesOrderNumber: order.orderNumber,
      linkedSo: order.orderNumber,
      customerId: order.customerId,
      customer: order.customer || lead?.company || lead?.name,
      date: new Date().toISOString().split('T')[0],
      dispatchDate: new Date().toISOString().split('T')[0],
      transporter,
      vehicleNo,
      status: 'In Transit',
      items: lineItems.length > 0 ? lineItems : (order.items || []),
    });

    setShowIssueModal(false);
    onCountsChange?.({ challans: (linked.length || 0) + 1 });
    onActivity?.(`Delivery challan ${created?.challanNumber || 'issued'} created for ${lead?.name || order.customer}`, '#f97316');
  }

  return (
    <div className="card">
      <div className="card-header flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
        <h3 className="font-bold text-sm">Delivery Challans ({linked.length})</h3>
        <button type="button" onClick={openIssueModal} className="btn-primary btn-sm flex items-center gap-1.5">
          <Plus size={13} strokeWidth={2.4} /> New Challan
        </button>
      </div>
      <div className="table-scroll">
        <table className="data-table text-xs min-w-[640px] lg:min-w-0">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Challan No.</th>
              <th>Linked SO</th>
              <th>Customer</th>
              <th>Dispatch Date</th>
              <th>Carrier</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {linked.map((challan, idx) => (
              <tr key={challan.id}>
                <td className="text-slate-500 font-mono">{idx + 1}</td>
                <td className="font-mono font-bold text-blue-600">{challan.challanNumber}</td>
                <td className="font-mono text-slate-600">{challan.salesOrderNumber || challan.linkedSo}</td>
                <td className="font-semibold">{challan.customer}</td>
                <td className="text-slate-500 text-xs whitespace-nowrap">{challan.dispatchDate || challan.date}</td>
                <td className="text-slate-600">{challan.transporter}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${challan.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : challan.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    {challan.status}
                  </span>
                </td>
              </tr>
            ))}
            {linked.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">No delivery challans for {lead?.name || 'this lead'} yet. Click New Challan to create one.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-2 sm:p-4" onClick={() => setShowIssueModal(false)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-3xl p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Issue Delivery Challan</h4>
                <p className="text-xs text-slate-500 mt-1">Create a dispatch manifest for {lead?.name || 'this lead'}.</p>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setShowIssueModal(false)} aria-label="Close delivery challan dialog">×</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label text-xs">Source Sales Order *</label>
                  <select
                    value={selectedSoId}
                    onChange={(event) => {
                      const nextOrder = (salesOrders || []).find((order) => order.id === event.target.value);
                      setSelectedSoId(event.target.value);
                      setLineItems(nextOrder?.items ? nextOrder.items.map((item) => ({ ...item })) : []);
                    }}
                    className="form-select text-xs"
                  >
                    {(salesOrders || []).map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.orderNumber} - {order.customer}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Carrier / Transporter</label>
                  <input type="text" value={transporter} onChange={(event) => setTransporter(event.target.value)} className="form-input text-xs" />
                </div>
                <div>
                  <label className="form-label text-xs">Vehicle / Truck Plate #</label>
                  <input type="text" value={vehicleNo} onChange={(event) => setVehicleNo(event.target.value)} className="form-input text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Driver Contact / Phone</label>
                  <input type="text" value={driverContact} onChange={(event) => setDriverContact(event.target.value)} className="form-input text-xs" />
                </div>
                <div>
                  <label className="form-label text-xs">Total Packages / Cartons</label>
                  <input type="number" min="1" value={totalPackages} onChange={(event) => setTotalPackages(Number(event.target.value))} className="form-input text-xs" />
                </div>
              </div>

              <div>
                <label className="form-label text-xs">Handling / Gate Pass Instructions</label>
                <input type="text" value={dispatchNote} onChange={(event) => setDispatchNote(event.target.value)} className="form-input text-xs" />
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                      <th className="px-2 py-2 font-bold">SKU</th>
                      <th className="px-2 py-2 font-bold">Description</th>
                      <th className="px-2 py-2 font-bold text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lineItems || []).map((item, index) => (
                      <tr key={`${item.id || item.itemId || index}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-2 py-2 font-mono text-slate-600">{item.sku || item.itemSku || 'GEN-SKU'}</td>
                        <td className="px-2 py-2 text-slate-700">{item.name || item.description}</td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            min="1"
                            value={item.qty || 1}
                            onChange={(event) => {
                              const next = [...lineItems];
                              next[index] = { ...next[index], qty: Number(event.target.value) || 1 };
                              setLineItems(next);
                            }}
                            className="w-20 ml-auto rounded border border-slate-200 bg-white px-2 py-1 text-right text-slate-700 focus:outline-none focus:border-blue-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowIssueModal(false)} className="btn-ghost btn-sm">Cancel</button>
                <button type="submit" className="btn-primary btn-sm">Create Challan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityTab({ lead, items }) {
  const entries = items ?? [];
  const { quotations } = useERP() || {};
  const linkedQuotations = (quotations || []).filter((q) => quotationMatchesLead(q, lead));
  const systemEntries = [
    ...linkedQuotations.map((q) => ({ id: `sys-q-${q.id}`, title: `Quotation ${q.quoteNumber} • ${q.status}`, time: q.date || '', color: '#10b981' })),
  ];
  systemEntries.push(...linkedQuotations.flatMap(q => (q.activity || []).map(event => ({ id: event.id, title: `${q.quoteNumber} ? ${event.type}`, time: event.timestamp, color: '#10b981' }))));
  const total = entries.length + systemEntries.length;
  return (
    <div className="card p-5 space-y-4">
      <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Activity Log ({total})</h3>
      {total === 0 && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>No activity recorded for this lead yet.</p>
      )}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
        {entries.map((item) => (
          <div key={item.id} className="relative flex items-start justify-between gap-4">
            <span
              className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center"
              style={{ background: item.color || '#3b82f6' }}
            />
            <div className="space-y-1">
              <strong className="text-xs font-bold block" style={{ color: 'var(--text)' }}>{item.title}</strong>
              {item.outcome && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Outcome: {item.outcome}
                  </span>
                  {item.nextAction && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Next: {item.nextAction}
                    </span>
                  )}
                  {item.employee && <span className="text-[10px] font-medium text-slate-500">by {item.employee}</span>}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <time className="text-[11px] font-mono block" style={{ color: 'var(--muted)' }}>{item.time}</time>
            </div>
          </div>
        ))}
        {systemEntries.map((item) => (
          <div key={item.id} className="relative flex items-start justify-between gap-4">
            <span
              className="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center"
              style={{ background: item.color || '#3b82f6' }}
            />
            <div className="space-y-1">
              <strong className="text-xs font-bold block" style={{ color: 'var(--text)' }}>{item.title}</strong>
            </div>
            <div className="text-right shrink-0">
              <time className="text-[11px] font-mono block" style={{ color: 'var(--muted)' }}>{item.time}</time>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 2. General Tab ────────────────────────────────────────────
function GeneralTab({ lead }) {
  const nameParts = String(lead.name || '').split(' ').filter(Boolean);
  const infoRows = [
    ['Company', lead.company || '—'],
    ['First Name', nameParts[0] || '—'],
    ['Last Name', nameParts.slice(1).join(' ') || '—'],
    ['Title', lead.jobTitle || '—'],
    ['Email', lead.email || '—'],
    ['Phone', lead.phone ? `+91 ${lead.phone}` : '—'],
    ['Mobile', lead.phone ? `+91 ${lead.phone}` : '—'],
    ['Lead Source', lead.source || '—'],
    ['Lead Status', lead.status || '—'],
    ['Industry', lead.industry || '—'],
    ['Annual Revenue', formatAmount(lead.amount)],
    ['Website', '—'],
  ];

  const addressRows = [
    ['Address', '—'],
    ['City', lead.city || '—'],
    ['State', lead.state || '—'],
    ['Country', lead.country || '—'],
    ['Zip Code', '—'],
  ];

  // Extra capture from the create form — products, lead users and the
  // optional task schedule. Only rows with values are shown.
  const extraRows = (() => {
    const extras = lead.customValues || {};
    const rows = [];
    if (Array.isArray(extras.products) && extras.products.length > 0) {
      rows.push(['Products', extras.products.join(', ')]);
    }
    if (Array.isArray(extras.leadUsers) && extras.leadUsers.length > 0) {
      rows.push(['Lead Users', extras.leadUsers.join(', ')]);
    }
    if (extras.taskDate) rows.push(['Task Date', extras.taskDate]);
    if (extras.taskTime) rows.push(['Task Time', extras.taskTime]);
    return rows;
  })();

  const activities = [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-5">Lead Information</h3>
        <div className="space-y-3.5 text-xs">
          {infoRows.map(([label, val]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-slate-400 font-normal shrink-0">{label}</span>
              <span className="text-slate-900 font-semibold text-right truncate min-w-0 lg:min-w-auto">{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-5">
        <h3 className="font-bold text-sm text-slate-900">Address Information</h3>
        <div className="space-y-3.5 text-xs">
          {addressRows.map(([label, val]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-slate-400 font-normal shrink-0">{label}</span>
              <span className="text-slate-900 font-semibold text-right truncate min-w-0 lg:min-w-auto">{val}</span>
            </div>
          ))}
        </div>

        <div className="h-44 rounded-2xl bg-gradient-to-b from-slate-50 via-slate-50 to-emerald-50/40 border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-white shadow-md border border-slate-100 flex items-center justify-center text-rose-500 mb-2">
              <MapPin size={16} />
            </div>
            <div className="w-10 h-10 rounded-full bg-rose-500/15 -mt-6 mb-3" />
            <button
              type="button"
              className="px-3.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md border border-slate-200 shadow-xs transition cursor-pointer"
            >
              View on Map
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-sm text-slate-900">Recent Activity</h3>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
          >
            <Plus size={13} /> Add
          </button>
        </div>

        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-[11px] text-slate-400">No activity yet.</p>
          ) : (
            activities.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <span
                className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 leading-snug">{item.title}</p>
                <span className="text-[11px] text-slate-400 mt-0.5 block">{item.time}</span>
              </div>
            </div>
            ))
          )}
        </div>
      </div>
      {extraRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-5">Additional Details</h3>
          <div className="space-y-3.5 text-xs">
            {extraRows.map(([label, val]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="text-slate-400 font-normal shrink-0">{label}</span>
                <span className="text-slate-900 font-semibold text-right truncate min-w-0 lg:min-w-auto">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 3. Users | Requirements Tab ──────────────────────────────────
// Used only until the UOM master has loaded (or when it is empty offline).
const REQUIREMENT_UOM_OPTIONS = ['Meter', 'Kg', 'Taka', 'Roll'];
const REQUIREMENT_STATUS_OPTIONS = ['Active', 'Draft'];

const EMPTY_REQUIREMENT_DRAFT = {
  fabricQuality: '',
  fabricCode: '',
  fabricType: '',
  design: '',
  colour: '',
  width: '',
  gsm: '',
  qty: '1',
  uom: 'Meter',
  expectedRate: '',
  remarks: '',
  status: 'Active',
};

function tempRequirementId() {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}

function formatExpectedRate(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `Rs. ${num.toLocaleString('en-IN')}`;
}

function formatFabricDim(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '—';
  return `${value}${suffix}`;
}

/**
 * Fabric requirement form fields, shared by the add and edit requirement
 * dialogs. Same input styling as the rest of the drawer; the draft object
 * uses UI keys (`fabricQuality`, `colour`, `expectedRate`, ...) and the
 * mapping layer translates them to the API payload.
 */
function RequirementFormFields({ draft, onChange, autoFocus = false }) {
  const { activeUnits } = useUnits();
  const uomOptions = activeUnits.length ? activeUnits.map((u) => u.code) : REQUIREMENT_UOM_OPTIONS;
  if (draft.uom && !uomOptions.includes(draft.uom)) uomOptions.unshift(draft.uom);
  const set = (key) => (event) => onChange({ ...draft, [key]: event.target.value });
  const inputCls = 'mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-normal text-slate-700 focus:outline-none focus:border-blue-500';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
        Fabric Quality / Item Name *
        <input
          type="text"
          value={draft.fabricQuality}
          onChange={set('fabricQuality')}
          placeholder="e.g. Cotton Voile"
          className={inputCls}
          autoFocus={autoFocus}
        />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Fabric Code / SKU
        <input
          type="text"
          value={draft.fabricCode}
          onChange={set('fabricCode')}
          placeholder="e.g. CTV-60-120"
          className={inputCls}
        />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Fabric Type
        <input
          type="text"
          value={draft.fabricType}
          onChange={set('fabricType')}
          placeholder="e.g. Cotton"
          className={inputCls}
        />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Design
        <input
          type="text"
          value={draft.design}
          onChange={set('design')}
          placeholder="e.g. Floral"
          className={inputCls}
        />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Colour / Shade
        <input
          type="text"
          value={draft.colour}
          onChange={set('colour')}
          placeholder="e.g. Red"
          className={inputCls}
        />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Width (inches)
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft.width}
          onChange={set('width')}
          placeholder="e.g. 58"
          className={inputCls}
        />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        GSM
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft.gsm}
          onChange={set('gsm')}
          placeholder="e.g. 120"
          className={inputCls}
        />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Required Quantity *
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft.qty}
          onChange={set('qty')}
          placeholder="e.g. 150"
          className={inputCls}
        />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        <span className="flex items-center justify-between">
          UOM
          <MasterSourceLink source="uom" />
        </span>
        <select value={draft.uom} onChange={set('uom')} className={`${inputCls} bg-white`}>
          {uomOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Expected Rate
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft.expectedRate}
          onChange={set('expectedRate')}
          placeholder="Indicative rate (not final price)"
          className={inputCls}
        />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Status
        <select value={draft.status} onChange={set('status')} className={`${inputCls} bg-white`}>
          {REQUIREMENT_STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
        Remarks
        <input
          type="text"
          value={draft.remarks}
          onChange={set('remarks')}
          placeholder="Any additional notes"
          className={inputCls}
        />
      </label>
    </div>
  );
}

function UsersProductsTab({ lead, onCountsChange, onActivity }) {
  const initialState = useLeadDetailState(lead);
  const [users, setUsers] = useState(() => (Array.isArray(initialState.users) ? initialState.users : []));
  // Requirements are the store's `products` section (LeadProduct rows) read
  // live, so saves through the API appear without a remount and survive a
  // page refresh. The section key stays `products` — only labels changed.
  const storedRequirements = useLeadDetailStore((s) => s.byLead[String(lead?.id || '')]?.products);
  const requirements = useMemo(() => {
    if (Array.isArray(storedRequirements)) return storedRequirements;
    return Array.isArray(initialState.products) ? initialState.products : [];
  }, [storedRequirements, initialState.products]);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [isAddRequirementOpen, setIsAddRequirementOpen] = useState(false);
  const [requirementDraft, setRequirementDraft] = useState({ ...EMPTY_REQUIREMENT_DRAFT });
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('All Users');
  const [requirementSearch, setRequirementSearch] = useState('');
  const [requirementFilter, setRequirementFilter] = useState('All Requirements');

  const filteredUsers = useMemo(() => (Array.isArray(users) ? users : []).filter((u) => {
    if (!u) return false;
    if (userFilter !== 'All Users' && u.status !== userFilter) return false;
    if (userSearch && !`${u.name || ''} ${u.email || ''} ${u.role || ''}`.toLowerCase().includes(userSearch.toLowerCase())) return false;
    return true;
  }), [users, userSearch, userFilter]);

  const filteredRequirements = useMemo(() => (Array.isArray(requirements) ? requirements : []).filter((p) => {
    if (!p) return false;
    if (requirementFilter !== 'All Requirements' && p.status !== requirementFilter) return false;
    if (requirementSearch && !`${p.productName || p.name || ''} ${p.fabricCode || p.sku || ''} ${p.fabricType || ''} ${p.fabricDesign || ''} ${p.fabricColor || ''}`.toLowerCase().includes(requirementSearch.toLowerCase())) return false;
    return true;
  }), [requirements, requirementSearch, requirementFilter]);

  const availableEmployees = useMemo(
    () => withSampleTeam(useCrmStore.getState().teamMembers).filter((member) => !(Array.isArray(users) ? users : []).some((user) => user && user.name === member.name)),
    [users],
  );

  React.useEffect(() => {
    // Users and requirements persist through explicit add/remove calls
    // below (server ids come back from the POST); nothing auto-posts here.
    onCountsChange?.({ users: users.length, products: requirements.length });
  }, [lead?.id, users, users.length, requirements.length, onCountsChange]);

  async function addUser() {
    const employee = withSampleTeam(useCrmStore.getState().teamMembers).find((item) => item.id === selectedEmployeeId);
    if (!employee) return;
    // The POST needs the backend user id — the row id stays temporary until
    // the server answers with the assignment id.
    const tempId = `lu-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    const row = {
      id: tempId,
      userId: employee.id,
      initials: getInitials(employee.name),
      name: employee.name,
      email: employee.email,
      role: employee.role || employee.designation || '',
      status: 'Active',
      bg: '#3b82f6',
    };
    setUsers((current) => [...current, row]);
    setSelectedEmployeeId('');
    setIsAddUserOpen(false);
    onActivity?.(`${employee.name} assigned to lead`, '#10b981');
    try {
      const saved = await useLeadDetailStore.getState().add(lead?.id, 'users', row);
      if (saved?.id && saved.id !== tempId) {
        setUsers((current) => current.map((u) => (
          u.id === tempId
            ? { ...saved, id: saved.id, initials: row.initials, bg: row.bg, status: 'Active' }
            : u
        )));
      }
    } catch (err) {
      console.warn('[CRM] user not saved:', err?.message || err);
      onActivity?.(`${employee.name} could not be saved to the server`, '#f59e0b');
    }
  }

  async function deleteUser(id) {
    const target = users.find((u) => u.id === id);
    setUsers((current) => current.filter((u) => u.id !== id));
    onActivity?.(`User "${target?.name ?? 'entry'}" removed`, '#f59e0b');
    try {
      await useLeadDetailStore.getState().removeSection(lead?.id, 'users', id);
    } catch (err) {
      console.warn('[CRM] user not removed:', err?.message || err);
    }
  }

  /** Fabric requirement payload in the mapping layer's UI shape. */
  function requirementRowFromDraft(draft, id) {
    const quality = String(draft.fabricQuality || '').trim();
    const qty = Number(draft.qty);
    return {
      id: id || tempRequirementId(),
      productName: quality,
      fabricCode: String(draft.fabricCode || '').trim(),
      fabricType: String(draft.fabricType || '').trim(),
      fabricDesign: String(draft.design || '').trim(),
      fabricColor: String(draft.colour || '').trim(),
      fabricWidth: draft.width === '' ? '' : draft.width,
      fabricGsm: draft.gsm === '' ? '' : draft.gsm,
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      uom: draft.uom || 'Meter',
      expectedRate: draft.expectedRate === '' ? null : Number(draft.expectedRate),
      status: draft.status || 'Active',
      notes: String(draft.remarks || ''),
    };
  }

  function requirementDraftFromRow(row) {
    return {
      fabricQuality: row.productName || row.name || '',
      fabricCode: row.fabricCode || '',
      fabricType: row.fabricType || '',
      design: row.fabricDesign || '',
      colour: row.fabricColor || '',
      width: row.fabricWidth ?? '',
      gsm: row.fabricGsm ?? '',
      qty: row.qty ?? 1,
      uom: row.uom || 'Meter',
      expectedRate: row.expectedRate ?? '',
      remarks: row.notes || row.remarks || '',
      status: row.status || 'Active',
    };
  }

  function isRequirementDraftValid(draft) {
    return String(draft.fabricQuality || '').trim() !== '' && Number(draft.qty) > 0;
  }

  async function addRequirement() {
    if (!isRequirementDraftValid(requirementDraft)) return;
    const quality = String(requirementDraft.fabricQuality).trim();
    try {
      await useLeadDetailStore.getState().add(
        lead?.id, 'products', requirementRowFromDraft(requirementDraft),
      );
      setRequirementDraft({ ...EMPTY_REQUIREMENT_DRAFT });
      setIsAddRequirementOpen(false);
      onActivity?.(`Fabric requirement "${quality}" added`, '#ec4899');
    } catch (err) {
      console.warn('[CRM] requirement not saved:', err?.message || err);
      onActivity?.(`Fabric requirement "${quality}" could not be saved`, '#f59e0b');
    }
  }

  function openEditRequirement(row) {
    setEditingRequirement({ id: row.id, ...requirementDraftFromRow(row) });
  }

  async function saveEditRequirement() {
    if (!editingRequirement) return;
    if (!isRequirementDraftValid(editingRequirement)) return;
    const quality = String(editingRequirement.fabricQuality).trim();
    try {
      await useLeadDetailStore.getState().updateSection(
        lead?.id, 'products', editingRequirement.id, requirementRowFromDraft(editingRequirement, editingRequirement.id),
      );
      setEditingRequirement(null);
      onActivity?.(`Fabric requirement "${quality}" updated`, '#3b82f6');
    } catch (err) {
      console.warn('[CRM] requirement not updated:', err?.message || err);
      onActivity?.(`Fabric requirement "${quality}" could not be updated`, '#f59e0b');
    }
  }

  async function deleteRequirement(id) {
    const target = requirements.find((p) => String(p?.id) === String(id));
    try {
      await useLeadDetailStore.getState().removeSection(lead?.id, 'products', id);
      onActivity?.(`Fabric requirement "${target?.productName || target?.name || 'entry'}" removed`, '#f59e0b');
    } catch (err) {
      console.warn('[CRM] requirement not deleted:', err?.message || err);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* Users Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-slate-900">Users ({filteredUsers.length})</h3>
          <button
            type="button"
            onClick={() => {
              setSelectedEmployeeId(availableEmployees[0]?.id || '');
              setIsAddUserOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus size={14} /> Add User
          </button>
        </div>

        {isAddUserOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4" onClick={() => setIsAddUserOpen(false)}>
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Add Employee</h4>
                  <p className="text-xs text-slate-500 mt-1">Select an employee to assign to this lead.</p>
                </div>
                <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setIsAddUserOpen(false)} aria-label="Close add employee dialog">×</button>
              </div>
              <label className="block text-xs font-semibold text-slate-700">
                <span className="flex items-center justify-between">
                  Employee
                  <MasterSourceLink source="users" />
                </span>
                <select
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
                >
                  {availableEmployees.length === 0 ? (
                    <option value="">All employees are already added</option>
                  ) : (
                    availableEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} · {employee.designation} · {employee.department}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <div className="flex justify-end gap-2 mt-5">
                <button type="button" className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setIsAddUserOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50" onClick={addUser} disabled={!selectedEmployeeId}>
                  Add User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 text-slate-800 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <div className="relative">
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All Users">All Users</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] lg:min-w-0 text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-700">
                <th className="py-2.5 px-2 w-7 font-bold">#</th>
                <th className="py-2.5 px-2 font-bold">User Name</th>
                <th className="py-2.5 px-2 font-bold">Email</th>
                <th className="py-2.5 px-2 font-bold">Role</th>
                <th className="py-2.5 px-2 text-center font-bold">Status</th>
                <th className="py-2.5 px-2 text-center font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u, idx) => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-2 text-slate-400 font-normal">{idx + 1}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: u.bg || '#3b82f6' }}
                      >
                        {u.initials}
                      </div>
                      <span className="font-semibold text-slate-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-slate-500">{u.email}</td>
                  <td className="py-3 px-2 text-slate-600">{u.role}</td>
                  <td className="py-3 px-2 text-center">
                    <span
                      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                        u.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                          : 'bg-amber-50 text-amber-600 border border-amber-200/60'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => deleteUser(u.id)}
                        className="w-7 h-7 rounded-lg border border-rose-200 text-rose-400 bg-white flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 transition cursor-pointer shadow-2xs"
                        title="Delete User"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-3.5 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
          Showing 1 to {filteredUsers.length} of {filteredUsers.length} entries
        </div>
      </div>

      {/* Requirements Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-slate-900">Requirements ({filteredRequirements.length})</h3>
          <button
            type="button"
            onClick={() => setIsAddRequirementOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus size={14} /> Add Fabric Requirement
          </button>
        </div>

        {isAddRequirementOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4" onClick={() => setIsAddRequirementOpen(false)}>
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-xl p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Add Fabric Requirement</h4>
                  <p className="text-xs text-slate-500 mt-1">Enter the fabric requirement details for this lead. The expected rate is indicative, not a confirmed price.</p>
                </div>
                <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setIsAddRequirementOpen(false)} aria-label="Close add fabric requirement dialog">×</button>
              </div>
              <RequirementFormFields
                draft={requirementDraft}
                autoFocus
                onChange={setRequirementDraft}
              />
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setIsAddRequirementOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                  onClick={addRequirement}
                  disabled={!isRequirementDraftValid(requirementDraft)}
                >
                  Add Requirement
                </button>
              </div>
            </div>
          </div>
        )}

        {editingRequirement && (
          <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4" onClick={() => setEditingRequirement(null)}>
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-xl p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Edit Fabric Requirement</h4>
                  <p className="text-xs text-slate-500 mt-1">Update the fabric requirement details for this lead.</p>
                </div>
                <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setEditingRequirement(null)} aria-label="Close edit fabric requirement dialog">×</button>
              </div>
              <RequirementFormFields
                draft={editingRequirement}
                onChange={setEditingRequirement}
              />
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setEditingRequirement(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                  onClick={saveEditRequirement}
                  disabled={!isRequirementDraftValid(editingRequirement)}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search requirements..."
              value={requirementSearch}
              onChange={(e) => setRequirementSearch(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg placeholder:text-slate-400 text-slate-800 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <div className="relative">
            <select
              value={requirementFilter}
              onChange={(e) => setRequirementFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All Requirements">All Requirements</option>
              <option value="Active">Active</option>
              <option value="Draft">Draft</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] lg:min-w-0 text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-700">
                <th className="py-2.5 px-2 w-7 font-bold">#</th>
                <th className="py-2.5 px-2 font-bold">Fabric Quality</th>
                <th className="py-2.5 px-2 font-bold">Fabric Code</th>
                <th className="py-2.5 px-2 font-bold">Fabric Type</th>
                <th className="py-2.5 px-2 font-bold">Colour/Shade</th>
                <th className="py-2.5 px-2 font-bold">Width</th>
                <th className="py-2.5 px-2 font-bold">GSM</th>
                <th className="py-2.5 px-2 font-bold">Quantity</th>
                <th className="py-2.5 px-2 font-bold">UOM</th>
                <th className="py-2.5 px-2 font-bold">Expected Rate</th>
                <th className="py-2.5 px-2 text-center font-bold">Status</th>
                <th className="py-2.5 px-2 text-center font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequirements.map((p, idx) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-2 text-slate-400 font-normal">{idx + 1}</td>
                  <td className="py-3 px-2">
                    <span className="font-semibold text-slate-900">{p.productName || p.name || '—'}</span>
                    {(p.fabricDesign) && (
                      <span className="block text-[11px] text-slate-400 font-normal">{p.fabricDesign}</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-slate-500 font-mono text-[11px]">{p.fabricCode || p.sku || '—'}</td>
                  <td className="py-3 px-2 text-slate-600">{p.fabricType || '—'}</td>
                  <td className="py-3 px-2 text-slate-600">{p.fabricColor || '—'}</td>
                  <td className="py-3 px-2 text-slate-600">{formatFabricDim(p.fabricWidth, '"')}</td>
                  <td className="py-3 px-2 text-slate-600">{formatFabricDim(p.fabricGsm)}</td>
                  <td className="py-3 px-2 text-slate-700">{p.qty ?? '—'}</td>
                  <td className="py-3 px-2 text-slate-600">{p.uom || '—'}</td>
                  <td className="py-3 px-2 text-slate-600 font-medium">{formatExpectedRate(p.expectedRate ?? p.expected_rate)}</td>
                  <td className="py-3 px-2 text-center">
                    <span
                      className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                        p.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                          : 'bg-amber-50 text-amber-600 border border-amber-200/60'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditRequirement(p)}
                        className="w-7 h-7 rounded-lg border border-blue-200 text-blue-500 bg-white flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 transition cursor-pointer shadow-2xs"
                        title="Edit Requirement"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRequirement(p.id)}
                        className="w-7 h-7 rounded-lg border border-rose-200 text-rose-400 bg-white flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 transition cursor-pointer shadow-2xs"
                        title="Delete Requirement"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-3.5 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
          Showing 1 to {filteredRequirements.length} of {filteredRequirements.length} entries
        </div>
      </div>
    </div>
  );
}

export default function LeadDetailView({ lead, onBackToLeads }) {
  const navigate = useNavigate();
  const [viewLead, setViewLead] = useState(lead);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  // Subscribed so the edit form's Lead Status list (getLeadStageOrder) re-renders
  // after stages are edited from its "+ Add / Manage" popup.
  useCrmStore((s) => s.stages);
  const storedDetailState = useLeadDetailState(lead);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = DETAIL_TABS.find(
    (tab) => tab.toLowerCase() === searchParams.get('tab')?.toLowerCase()
  ) || 'Users & Requirements';

  function setActiveTab(tab) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('tab', tab.toLowerCase());
      return next;
    }, { replace: true });
  }
  const { addCustomer, showToast, customers, refreshFromBackend } = useERP() || {};
  const isLeadConverted = Boolean(
    lead?.isConverted ||
    lead?.customValues?.isConverted ||
    viewLead?.isConverted ||
    viewLead?.customValues?.isConverted ||
    lead?.status === 'Converted' ||
    viewLead?.status === 'Converted' ||
    lead?.party ||
    lead?.partyId ||
    viewLead?.party ||
    viewLead?.partyId ||
    customers?.some((c) => (
      (lead?.company && c.name?.toLowerCase() === lead?.company?.toLowerCase()) ||
      (lead?.name && c.name?.toLowerCase() === lead?.name?.toLowerCase()) ||
      (lead?.email && c.email && c.email?.toLowerCase() === lead?.email?.toLowerCase())
    ))
  );
  const [isConverted, setIsConverted] = useState(() => isLeadConverted);
  const [isConverting, setIsConverting] = useState(false);
  const convertLockRef = useRef(false);
  const [isLost, setIsLost] = useState(/lost|closed/i.test(String(lead?.status || '')));
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    setViewLead(lead);
    setIsConverted((prev) => prev || isLeadConverted);
    setIsLost(/lost|closed/i.test(String(lead?.status || '')));
  }, [lead, isLeadConverted]);
  const [detailCounts, setDetailCounts] = useState(() => ({
    users: storedDetailState.users.length,
    products: storedDetailState.products.length,
    sources: storedDetailState.sources.length,
    files: storedDetailState.files.length,
    openTasks: (storedDetailState.tasks || []).filter((t) => t.status !== 'Completed').length || lead?.openTasksCount || 0,
    challans: lead?.deliveryChallansCount ?? 0,
  }));
  const [activities, setActivities] = useState(() => storedDetailState.activities || []);
  const [convertedDeal, setConvertedDeal] = useState(() => findDealForLead(lead?.id));

  const logActivity = React.useCallback((title, color) => {
    if (!title) return;
    const entry = { id: `act-${Date.now()}`, title, time: 'Just now', color: color || '#3b82f6' };
    // The server records the activity from the change itself; this shows it
    // immediately, and the next read of the timeline confirms it.
    setActivities((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
  }, [viewLead?.id, lead?.id]);

  const updateDetailCounts = React.useCallback((counts) => {
    if (!counts) return;
    setDetailCounts((current) => {
      let changed = false;
      for (const [k, v] of Object.entries(counts)) {
        if (current[k] !== v) {
          changed = true;
          break;
        }
      }
      return changed ? { ...current, ...counts } : current;
    });
  }, []);

  // Sync converted deal, activities, and task counts when lead or detail state updates
  React.useEffect(() => {
    const targetId = lead?.id || viewLead?.id;
    if (!targetId) return;
    setConvertedDeal(findDealForLead(targetId));

    const incoming = storedDetailState.activities || [];
    setActivities((current) => {
      if (JSON.stringify(incoming) === JSON.stringify(current)) return current;
      const seen = new Map(current.map((a) => [a.id, a]));
      incoming.forEach((a) => seen.set(a.id, a));
      return Array.from(seen.values());
    });

    const openTasks = (storedDetailState.tasks || []).filter((t) => t.status !== 'Completed').length;
    setDetailCounts((current) => (current.openTasks === openTasks ? current : { ...current, openTasks }));
  }, [lead?.id, viewLead?.id, storedDetailState]);

  function openEditLead() {
    const source = viewLead ?? lead;
    if (!source) return;
    setEditForm({
      name: source.name ?? '',
      company: source.company ?? '',
      email: source.email ?? '',
      phone: source.phone ?? '',
      source: source.source ?? '',
      status: isConverted ? 'Converted' : (source.status ?? ''),
      owner: source.owner ?? '',
      jobTitle: source.jobTitle ?? '',
      industry: source.industry ?? '',
      city: source.city ?? '',
      state: source.state ?? '',
      country: source.country ?? '',
      zipCode: source.zipCode ?? '',
      amount: source.amount ?? '',
      leadNumber: source.leadNumber ?? '',
      createdOn: source.createdOn ?? '',
    });
    setIsEditOpen(true);
  }

  function updateEditField(field, value) {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function saveEditedLead() {
    if (!editForm) return;
    const targetId = viewLead?.id ?? lead?.id;
    if (!targetId) return;
    const trimmedName = String(editForm.name ?? '').trim();
    if (!trimmedName) {
      showToast?.('Lead name is required.');
      return;
    }
    const updates = {
      name: trimmedName,
      company: String(editForm.company ?? '').trim(),
      email: String(editForm.email ?? '').trim(),
      phone: String(editForm.phone ?? '').trim(),
      source: String(editForm.source ?? '').trim(),
      status: String(editForm.status ?? '').trim() || viewLead?.status,
      owner: String(editForm.owner ?? '').trim(),
      jobTitle: String(editForm.jobTitle ?? '').trim(),
      industry: String(editForm.industry ?? '').trim(),
      city: String(editForm.city ?? '').trim(),
      state: String(editForm.state ?? '').trim(),
      country: String(editForm.country ?? '').trim(),
      zipCode: String(editForm.zipCode ?? '').trim(),
      amount: editForm.amount === '' ? 0 : Number(editForm.amount) || 0,
      leadNumber: String(editForm.leadNumber ?? '').trim(),
      createdOn: String(editForm.createdOn ?? '').trim(),
    };
    const prevStatus = viewLead?.status ?? lead?.status;
    updateStoredLead(targetId, updates);
    setViewLead((current) => ({ ...(current ?? lead), ...updates }));
    if (updates.status && updates.status !== prevStatus) {
      try {
        runLeadStageAutomation({ ...(viewLead ?? lead), ...updates }, updates.status, { previousStage: prevStatus });
      } catch (e) {
        console.error('[CRM Automation] Error in stage change automation:', e);
      }
    }
    if (updates.status === 'Converted') {
      setIsConverted(true);
    } else if (isConverted && updates.status !== 'Converted') {
      setIsConverted(false);
    }
    setIsEditOpen(false);
    setEditForm(null);
    logActivity(`Lead information updated`, '#10b981');
    showToast?.(`Lead "${updates.name}" updated.`);
  }

  function exportLead(format) {
    const effectiveLead = viewLead ?? lead;
    const filename = `${String(effectiveLead.name || 'lead').replace(/\s+/g, '_')}_details`;
    if (format === 'CSV') {
      exportToCSV(filename, ['Field', 'Value'], leadExportRows(effectiveLead));
    }
    if (format === 'Excel') {
      downloadLeadAsExcel(effectiveLead);
    }
    if (format === 'PDF') {
      printLeadAsPdf(effectiveLead);
    }
    setIsExportOpen(false);
  }

  if (!viewLead && !lead) return null;
  const activeLeadData = viewLead ?? lead;

  const metrics = [
    { label: 'Requirements', value: detailCounts.products, icon: ShoppingBag, color: '#ec4899', bg: '#fdf2f8' },
    { label: 'Source', value: detailCounts.sources, icon: Globe, color: '#10b981', bg: '#f0fdf4' },
    { label: 'Files', value: detailCounts.files, icon: FileStack, color: '#8b5cf6', bg: '#f5f3ff' },
    { label: 'Open Tasks', value: detailCounts.openTasks, icon: ListChecks, color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Delivery Challans', value: detailCounts.challans, icon: Truck, color: '#f97316', bg: '#fff7ed' },
  ];

  const handleConvert = async () => {
    // The ref is the real re-entrancy guard: two clicks inside one render
    // pass both read `isConverted`/`isConverting` as false, but the second
    // finds the ref taken. This is what stopped one click becoming many
    // CUST- rows.
    if (convertLockRef.current) return;
    if (isConverted || isLeadConverted) {
      showToast?.('Lead is already converted to an active Customer.');
      return;
    }
    if (isLost) {
      showToast?.('Lead is marked as Lost — reopen it before converting.');
      return;
    }
    const targetId = viewLead?.id ?? lead?.id;
    if (!targetId) return;

    convertLockRef.current = true;
    setIsConverting(true);
    try {
      if (isServerId(targetId) && isBackendEnabled()) {
        // The server owns conversion (api.md §9.1): it links or creates the
        // party and opens the deal in one transaction, and a replayed click
        // gets a 409 — never a duplicate customer.
        await useCrmStore.getState().convertLead(targetId, { createCustomer: true });
      } else {
        // Frontend-design mode (no server session): convert locally, deduped
        // by name/email so a re-click cannot pile up customer rows either.
        const customerName = activeLeadData.company || activeLeadData.name;
        const customerEmail = activeLeadData.email;
        const alreadyExists = customers?.some((c) => (
          (customerName && c.name?.toLowerCase() === customerName.toLowerCase()) ||
          (customerEmail && c.email && c.email.toLowerCase() === customerEmail.toLowerCase())
        ));
        if (!alreadyExists) {
          addCustomer?.({
            name: customerName,
            contactPerson: activeLeadData.name,
            email: customerEmail,
            phone: `+91 ${activeLeadData.phone}`,
            balance: 0,
            status: 'Active',
          });
        }
      }
    } catch (err) {
      if (err?.status === 409) {
        // Already converted on the server — adopt that state, create nothing.
        setIsConverted(true);
        useCrmStore.getState().refresh('leads').catch(() => {});
        showToast?.('This lead was already converted — no duplicate customer was created.');
      } else {
        console.error('[CRM] convert failed:', err);
        showToast?.(`Could not convert lead — ${err?.message || 'server error'}`);
      }
      return;
    } finally {
      convertLockRef.current = false;
      setIsConverting(false);
    }

    const prevStatus = viewLead?.status ?? lead?.status ?? '';
    const crmState = useCrmStore.getState();
    const wonStage = [...(crmState.stages || [])].find(
      (stage) => stage.isActive !== false && (stage.isWon || stage.is_won || /won|convert/i.test(String(stage.name || ''))),
    );
    const convertedStatus = wonStage?.name || 'Converted';
    const nextCustomValues = {
      ...((viewLead ?? lead)?.customValues || {}),
      isConverted: true,
      convertedAt: new Date().toISOString(),
    };
    const updates = {
      status: convertedStatus,
      isConverted: true,
      customValues: nextCustomValues,
      ...(wonStage?.id ? { stageId: wonStage.id } : {}),
    };
    updateStoredLead(targetId, updates);
    setViewLead((current) => ({ ...(current ?? lead), ...updates }));
    setIsConverted(true);
    try {
      runLeadStageAutomation({ ...(viewLead ?? lead), ...updates }, convertedStatus, { previousStage: prevStatus });
    } catch (e) {
      console.error('[CRM Automation] Error in convert automation:', e);
    }
    // The party the server linked or created belongs on the Parties and
    // Customers screens too — re-read the ERP collections that show it.
    refreshFromBackend?.();
    logActivity('Lead converted to Customer', '#10b981');
    showToast?.(`Lead "${activeLeadData.name}" converted to Customer.`);
  };

  const handleLost = () => {
    if (isLost) {
      showToast?.('Lead is already marked as Lost.');
      return;
    }
    if (isConverted) {
      showToast?.('Lead is already converted — cannot mark it as Lost.');
      return;
    }
    const targetId = viewLead?.id ?? lead?.id;
    const prevStatus = viewLead?.status ?? lead?.status ?? '';
    // Find the workspace's Lost stage when one exists, so the Lost lead
    // lands in the right pipeline column everywhere.
    const crmState = useCrmStore.getState();
    const lostStage = [...(crmState.stages || [])].find(
      (stage) => stage.isActive !== false && /lost|closed/i.test(String(stage.name || '')),
    );
    const lostStatus = lostStage?.name || 'Lost';
    updateStoredLead(targetId, {
      status: lostStatus,
      ...(lostStage?.id ? { stageId: lostStage.id } : {}),
    });
    setViewLead((current) => ({ ...(current ?? lead), status: lostStatus }));
    setIsLost(true);
    try {
      runLeadStageAutomation({ ...(viewLead ?? lead), status: lostStatus }, lostStatus, { previousStage: prevStatus });
    } catch (e) {
      console.error('[CRM Automation] Error in lost-stage automation:', e);
    }
    logActivity('Lead marked as Lost', '#ef4444');
    showToast?.(`Lead "${activeLeadData.name}" marked as Lost.`);
  };

  const displayName = activeLeadData.name?.replace(/\s*\(Sample\)/i, '') || 'Untitled Lead';

  return (
    <div className="space-y-4">
      <div className="card p-3 text-xs text-slate-600">
        {convertedDeal ? <>Converted to Deal: {convertedDeal.id} <Link className="ml-2 text-blue-600 hover:underline" to={`/crm/deals?deal=${encodeURIComponent(convertedDeal.id)}`}>View Deal</Link></> : (isConverted ? <span className="inline-flex items-center gap-2"><span className="text-emerald-600 font-semibold">Converted to Customer</span><button type="button" onClick={() => navigate('/crm/customers')} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition cursor-pointer">View Customer <ArrowRight size={11} /></button></span> : (isLost ? <span className="text-rose-600 font-semibold">Lost — not converted / no deal</span> : 'Not converted / No Deal'))}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 min-w-0 lg:min-w-auto text-xs font-medium text-slate-500">
          <Link to="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
          <span className="text-slate-300">&gt;</span>
          <Link to="/crm/leads" className="text-blue-600 hover:underline">Leads</Link>
          <span className="text-slate-300">&gt;</span>
          <span className="text-slate-900 font-semibold">{displayName}</span>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
          <button
            type="button"
            onClick={onBackToLeads}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
          >
            <ArrowLeft size={13} className="text-slate-500" /> Back
          </button>
          <button
            type="button"
            onClick={openEditLead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
          >
            <Pencil size={13} className="text-slate-500" /> Edit
          </button>
          <button
            type="button"
            onClick={handleConvert}
            disabled={isConverted || isLost || isConverting}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition ${
              isConverted
                ? 'bg-emerald-600 text-white cursor-not-allowed opacity-90'
                : isConverting
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 cursor-pointer'
            }`}
          >
            <CheckCircle size={13} /> {isConverting ? 'Converting…' : isConverted ? 'Converted' : 'Convert'}
          </button>
          <button
            type="button"
            onClick={handleLost}
            disabled={isConverted || isLost || isConverting}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition ${
              isLost
                ? 'bg-rose-600 text-white cursor-not-allowed'
                : isConverted
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 cursor-pointer'
            }`}
          >
            <XCircle size={13} /> {isLost ? 'Lost' : 'Mark Lost'}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
            onClick={() => setIsExportOpen(true)}
          >
            <Printer size={13} className="text-slate-500" /> Print
          </button>
        </div>
      </div>

      {isExportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4" onClick={() => setIsExportOpen(false)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-sm p-4 sm:p-5 max-h-[95vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Print Lead Details</h2>
                <p className="text-xs text-slate-500 mt-1">Choose a format for {displayName}</p>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setIsExportOpen(false)} aria-label="Close print options">×</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['CSV', 'Excel', 'PDF'].map((format) => (
                <button key={format} type="button" className="border border-slate-200 rounded-lg px-3 py-3 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50" onClick={() => exportLead(format)}>
                  {format}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0 lg:min-w-auto">
            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 shadow-xs border border-slate-100 ring-2 ring-slate-50">
              {activeLeadData.photo ? (
                <img
                  src={activeLeadData.photo}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  className="w-full h-full grid place-items-center text-xl font-bold text-white"
                  style={{ backgroundColor: activeLeadData.avatarColor || '#2F6FED' }}
                >
                  {getInitials(displayName)}
                </span>
              )}
            </div>
            <div className="space-y-1 min-w-0 lg:min-w-auto">
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">
                <h1 className="text-[20px] font-extrabold tracking-tight text-slate-900 break-words">{displayName}</h1>
                <PageInfoButton title="Lead Details" />
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${isConverted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (isLost ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200')}`}>
                  {isConverted ? 'Converted' : (isLost ? (activeLeadData.status || 'Lost') : (activeLeadData.status || '—'))}
                </span>
              </div>
              <p className="text-[13px] text-slate-500 font-medium">{activeLeadData.company || '—'}</p>
              <div className="flex flex-wrap items-center gap-4 text-[13px] text-slate-500 pt-0.5">
                <span className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> {activeLeadData.phone ? `+91 ${activeLeadData.phone}` : '—'}</span>
                <span className="flex items-center gap-1.5 min-w-0 lg:min-w-auto break-all"><Mail size={13} className="text-slate-400 shrink-0 lg:shrink" /> {activeLeadData.email || '—'}</span>
                <span className="flex items-center gap-1.5"><MapPin size={13} className="text-slate-400" /> {[activeLeadData.city, activeLeadData.state, activeLeadData.country].filter(Boolean).join(', ') || '—'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-8">
            <div>
              <span className="text-[11px] text-slate-400 block font-normal mb-1">Lead Number</span>
              <strong className="text-xs font-bold text-slate-900 font-mono">{activeLeadData.leadNumber || '—'}</strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-normal mb-1">Source</span>
              <strong className="text-xs font-bold text-slate-900">{activeLeadData.source || '—'}</strong>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-normal mb-1">Created On</span>
              <strong className="text-xs font-bold text-slate-900">{activeLeadData.createdOn || '—'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5 my-4">
        {metrics.map((m, index) => (
          <CrmKpiCard key={m.label} label={m.label} value={m.value} icon={m.icon} tone={['rose', 'emerald', 'purple', 'amber', 'blue', 'teal', 'orange'][index]} />
        ))}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 shadow-xs scrollbar-none">
        {DETAIL_TABS.map((tab) => {
          const isActive = activeTab === tab;
          const TabIcon = DETAIL_TAB_ICONS[tab];
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`inline-flex shrink-0 lg:shrink items-center gap-1.5 px-3.5 py-2 whitespace-nowrap rounded-lg text-xs font-semibold transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-xs'
              }`}
            >
              <TabIcon size={14} strokeWidth={isActive ? 2.3 : 2} />
              {tab}
            </button>
          );
        })}
      </div>

      {/* Tab Content Display */}
      {activeTab === 'Sources & Emails' && <SourcesAndEmailsTab lead={activeLeadData} onCountsChange={updateDetailCounts} onActivity={logActivity} />}
      {activeTab === 'General' && <GeneralTab lead={activeLeadData} />}
      {activeTab === 'Users & Requirements' && <UsersProductsTab lead={activeLeadData} onCountsChange={updateDetailCounts} onActivity={logActivity} />}
      {activeTab === 'Files' && <FilesTab lead={activeLeadData} onCountsChange={updateDetailCounts} onActivity={logActivity} />}
      {activeTab === 'Tasks' && <LeadTasksTab lead={activeLeadData} onCountsChange={updateDetailCounts} onActivity={logActivity} />}
      {activeTab === 'Quotations' && <QuotationsTab lead={activeLeadData} onActivity={logActivity} />}
      {activeTab === 'Delivery Challans' && <DeliveryChallansTab lead={activeLeadData} onCountsChange={updateDetailCounts} onActivity={logActivity} />}
      {activeTab === 'Activity' && <ActivityTab lead={activeLeadData} items={activities} />}
      {!['Sources & Emails', 'General', 'Users & Requirements', 'Files', 'Tasks', 'Quotations', 'Delivery Challans', 'Activity'].includes(activeTab) && (
        <div className="card p-8 text-center space-y-2">
          <Info size={28} className="text-blue-500 mx-auto" />
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{activeTab} Details</h4>
          <p className="text-xs text-slate-400">
            Real-time synchronization for {activeTab.toLowerCase()} associated with {activeLeadData.name}.
          </p>
        </div>
      )}

      {isEditOpen && editForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4" onClick={() => { setIsEditOpen(false); setEditForm(null); }}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Edit lead information">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Edit Lead Information</h2>
                <p className="text-xs text-slate-500 mt-0.5">Update the lead details below</p>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-700 text-xl leading-none" onClick={() => { setIsEditOpen(false); setEditForm(null); }} aria-label="Close edit lead dialog">×</button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Lead Name *
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.name} onChange={(e) => updateEditField('name', e.target.value)} placeholder="Enter lead name" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Company
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.company} onChange={(e) => updateEditField('company', e.target.value)} placeholder="Enter company name" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Email
                <input type="email" className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.email} onChange={(e) => updateEditField('email', e.target.value)} placeholder="Enter email address" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Phone
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.phone} onChange={(e) => updateEditField('phone', e.target.value)} placeholder="Enter phone number" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Lead Source
                <select className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400 bg-white" value={editForm.source} onChange={(e) => updateEditField('source', e.target.value)}>
                  <option value="">Select source</option>
                  {Array.from(new Set(['Broker', 'Sales Person', editForm.source].filter(Boolean))).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                <span className="flex items-center justify-between gap-2">
                  Lead Status
                  <MasterSourceLink source="leadStages" />
                </span>
                <select className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400 bg-white" value={editForm.status} onChange={(e) => updateEditField('status', e.target.value)}>
                  {Array.from(new Set([editForm.status, ...getLeadStageOrder()].filter(Boolean))).map((stage) => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Lead Owner
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.owner} onChange={(e) => updateEditField('owner', e.target.value)} placeholder="Select User" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Title
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.jobTitle} onChange={(e) => updateEditField('jobTitle', e.target.value)} placeholder="Enter title" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Industry
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.industry} onChange={(e) => updateEditField('industry', e.target.value)} placeholder="Enter industry" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Lead Number
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.leadNumber} onChange={(e) => updateEditField('leadNumber', e.target.value)} placeholder="L-001" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                City
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.city} onChange={(e) => updateEditField('city', e.target.value)} placeholder="Enter city" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                State
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.state} onChange={(e) => updateEditField('state', e.target.value)} placeholder="Enter state" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Country
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.country} onChange={(e) => updateEditField('country', e.target.value)} placeholder="Enter country" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Zip Code
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.zipCode} onChange={(e) => updateEditField('zipCode', e.target.value)} placeholder="Enter zip code" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Annual Revenue / Amount
                <input type="number" className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.amount} onChange={(e) => updateEditField('amount', e.target.value)} placeholder="Enter amount" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 sm:col-span-2">
                Created On
                <input className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal text-slate-900 outline-none focus:border-blue-400" value={editForm.createdOn} onChange={(e) => updateEditField('createdOn', e.target.value)} placeholder="27/08/2026" />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-xl">
              <button type="button" className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200" onClick={() => { setIsEditOpen(false); setEditForm(null); }}>
                Cancel
              </button>
              <button type="button" className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700" onClick={saveEditedLead}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


