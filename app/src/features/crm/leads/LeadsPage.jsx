import CrmKpiCard from '../common/CrmKpiCard';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../components/ui/PageHeader';
import LeadsTabs from './LeadsTabs';
import FilterPanel from './FilterPanel';
import LeadsTable from './LeadsTable';
import LeadCardGridView from './LeadCardGridView';
import LeadGridView from './LeadGridView';
import LeadMapView from './LeadMapView';
import Pagination from '../../../components/ui/Pagination';
import NotesDrawer from './NotesDrawer';
import CreateLeadModal, { getActiveLeadFormSections, leadFormValuesToPayload } from './CreateLeadModal';
import EditLeadModal from './EditLeadModal';
import { buildLeadColumns, leadColumnValue, matchKnownLeadField } from './leadColumns';
import MarkAsLostModal from './MarkAsLostModal';
import LeadGuideModal from './LeadGuideModal';
import { LeadImportModal } from './LeadImportModal';
import {
  CreateLeadTaskModal,
  IssueSampleModal,
  ConvertDealModal,
  ConvertPartyModal,
} from './LeadRowActionModals';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../stores/appStore';
import { Users, UserPlus, Clock, TrendingUp, Plus, Upload, AlertTriangle, X } from 'lucide-react';
import { fetchLiveLeadFormId, isLeadFormSwitchedOn } from '../../../services/crmForms';
import { useCrmStore } from '../../../stores/crmStore';
import { useLeadDetailStore } from '../../../stores/leadDetailStore';
import { bulkMarkLeadsLost as bulkMarkLeadsLostRequest, describeError, isServerId, markLeadLost as markLeadLostRequest } from '../../../services/crmSync';
import { partiesService } from '../../../services/domainServices';
import { exportToCSV } from '../../../services/exportUtils';
import { runLeadStageAutomation } from '../../../services/leadStageAutomation';
import { emitCrmEvent, CRM_EVENT_TYPES } from '../../../services/crmEventNotifications';

const DEFAULT_FILTERS = { statuses: [], sources: [], systemDefined: [], search: '' };
const DEFAULT_SORT = { field: '', direction: 'ascending' };

const SORT_OPTIONS = [
  { value: 'leadNumber', label: 'Lead No.' },
  { value: 'name', label: 'Lead Name' },
  { value: 'company', label: 'Company' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'source', label: 'Lead Source' },
  { value: 'owner', label: 'Lead Owner' },
  { value: 'status', label: 'Lead Status' },
  { value: 'createdOn', label: 'Created On' },
];

const LEAD_EXPORT_FIELDS = [
  ['Lead No.', 'leadNumber'],
  ['Lead Name', 'name'],
  ['Company', 'company'],
  ['Email', 'email'],
  ['Phone', 'phone'],
  ['Lead Source', 'source'],
  ['Title', 'jobTitle'],
  ['Industry', 'industry'],
  ['Lead Owner', 'owner'],
  ['Status', 'status'],
  ['Created On', 'createdOn'],
];

function escapeExportHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function exportLeadRows(rows) {
  return rows.map((lead) => LEAD_EXPORT_FIELDS.map(([, key]) => lead[key] ?? ''));
}

function downloadLeadsAsExcel(rows) {
  const headers = LEAD_EXPORT_FIELDS.map(([label]) => label);
  const tableRows = rows.map((lead) => `<tr>${LEAD_EXPORT_FIELDS.map(([, key]) => `<td>${escapeExportHtml(lead[key])}</td>`).join('')}</tr>`).join('');
  const table = `<table><thead><tr>${headers.map((header) => `<th>${escapeExportHtml(header)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>`;
  const blob = new Blob([table], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leads_details.xls';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printLeadsAsPdf(rows) {
  const printWindow = window.open('', '_blank', 'width=1200,height=800');
  if (!printWindow) return;
  const headers = LEAD_EXPORT_FIELDS.map(([label]) => `<th>${escapeExportHtml(label)}</th>`).join('');
  const tableRows = rows.map((lead) => `<tr>${LEAD_EXPORT_FIELDS.map(([, key]) => `<td>${escapeExportHtml(lead[key])}</td>`).join('')}</tr>`).join('');
  printWindow.document.write(`<!doctype html><html><head><title>Lead Details</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:24px}h1{font-size:22px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#e2e8f0}</style></head><body><h1>Lead Details</h1><table><thead><tr>${headers}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

const leadsGuide = {
  title: 'CRM Leads',
  subtitle: 'Capture, qualify, and convert prospective customer opportunities.',
  purpose: 'A lead is a prospective customer or business opportunity that can be qualified, assigned, followed up, and converted into a customer or sales opportunity.',
  workflow: ['Lead Captured', 'Assigned to Owner', 'Qualification', 'Follow-up', 'Converted'],
  keyTerms: [
    { term: 'Lead', definition: 'A person or company that may become a customer.' },
    { term: 'Lead Source', definition: 'The channel that generated the lead, such as a referral, campaign, or website.' },
    { term: 'Lead Owner', definition: 'The team member responsible for follow-up and progress.' },
    { term: 'Qualification', definition: 'The process of confirming need, fit, timing, and purchase intent.' },
    { term: 'Follow-up', definition: 'A planned visit, email, note, or task used to move the lead forward.' },
    { term: 'Conversion', definition: 'Turning a qualified lead into a customer or active sales opportunity.' },
  ],
};

function getSortValue(lead, field, columnsByKey) {
  const column = columnsByKey?.get(field);
  if (column) {
    const raw = leadColumnValue(lead, column);
    if (column.rowKey === 'createdOn' || column.kind === 'taskDate') {
      const time = new Date(raw).getTime();
      if (!Number.isNaN(time) && raw) return time;
    }
    return String(raw ?? '').toLowerCase();
  }
  if (field === 'createdOn') {
    const time = new Date(lead.createdOn).getTime();
    if (!Number.isNaN(time) && lead.createdOn) return time;
  }
  if (field === 'leadNumber') return String(lead.leadNumber ?? lead.lead_number ?? '').toLowerCase();
  return String(lead[field] ?? '').toLowerCase();
}

// Sample cell per form field for the downloadable CSV template.
function sampleImportValue(field) {
  const known = matchKnownLeadField(field);
  if (known) {
    if (known.kind === 'name') return 'Rahul Sharma';
    if (known.kind === 'products') return 'Cotton, Denim';
    if (known.kind === 'users') return '';
    if (known.kind === 'taskDate' || known.kind === 'taskTime') return '';
    if (known.kind === 'row') {
      switch (known.rowKey) {
        case 'company': return 'Sharma Textiles';
        case 'email': return 'rahul@sharmatextiles.com';
        case 'phone': return '9876543210';
        case 'source': return 'Broker';
        case 'jobTitle': return 'Purchase Manager';
        case 'industry': return 'Textiles';
        case 'owner': return 'Sales Team';
        case 'createdOn': return '2026-09-30';
        default: return '';
      }
    }
  }
  switch (field?.type) {
    case 'Email': return 'lead@example.com';
    case 'Phone': return '9876543210';
    case 'Number':
    case 'Currency': return '1000';
    case 'Date': return '2026-09-30';
    default: return '';
  }
}

// CSV header candidates for one form field: its label + id plus legacy
// aliases, so older templates (`Name`, `Mobile`, `Company Name`, …) import.
function importKeysFor(field) {
  const keys = [
    String(field?.label || '').trim().toLowerCase(),
    String(field?.id || '').trim().toLowerCase(),
  ];
  const known = matchKnownLeadField(field);
  if (!known) return keys;
  const extra = [];
  if (known.kind === 'name') extra.push('lead name', 'name', 'lead');
  else if (known.kind === 'row') {
    if (known.rowKey === 'company') extra.push('company', 'company name');
    else if (known.rowKey === 'email') extra.push('email', 'email address', 'e-mail');
    else if (known.rowKey === 'phone') extra.push('phone', 'phone number', 'mobile');
    else if (known.rowKey === 'source') extra.push('lead source', 'source');
    else if (known.rowKey === 'jobTitle') extra.push('title', 'job title', 'designation');
    else if (known.rowKey === 'industry') extra.push('industry');
    else if (known.rowKey === 'owner') extra.push('lead owner', 'owner', 'owner name');
    else if (known.rowKey === 'createdOn') extra.push('created on', 'create on');
  }
  else if (known.kind === 'products') extra.push('products', 'product', 'fabric', 'febric');
  else if (known.kind === 'users') extra.push('lead users', 'lead user');
  else if (known.kind === 'taskDate') extra.push('task date');
  else if (known.kind === 'taskTime') extra.push('task time');
  return [...keys, ...extra];
}

export default function LeadsPage() {
  const navigate = useNavigate();
  const leadRows = useCrmStore((s) => s.leads);
  const taskRows = useCrmStore((s) => s.tasks);
  const dealRows = useCrmStore((s) => s.deals);
  const crmLoading = useCrmStore((s) => s.status.loading);
  const crmError = useCrmStore((s) => s.status.error);
  const createLeadRecord = useCrmStore((s) => s.createLead);
  const createLeadLocal = useCrmStore((s) => s.createLeadLocal);
  const createTaskRecord = useCrmStore((s) => s.createTask);
  const createTaskLocal = useCrmStore((s) => s.createTaskLocal);
  const createDealRecord = useCrmStore((s) => s.createDeal);
  const createDealLocal = useCrmStore((s) => s.createDealLocal);
  const updateLeadRecord = useCrmStore((s) => s.updateLead);
  const refreshLeads = useCrmStore((s) => s.refresh);
  const toggleLeadPin = useCrmStore((s) => s.toggleLeadPin);
  const showToast = useAppStore((s) => s.showToast);
  const currentUser = useAppStore((s) => s.currentUser);
  const actorName = currentUser?.name || currentUser?.fullName || '—';
  // Rebuild table columns whenever the form layout changes.
  // Lead No. (L-001) is a system column — always first, never from the builder.
  const leadFormVersion = useCrmStore((s) => s.forms);
  const leadColumns = useMemo(
    () => [
      { key: 'leadNumber', label: 'Lead No.', kind: 'leadNumber', editable: false },
      ...buildLeadColumns(getActiveLeadFormSections()),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leadFormVersion],
  );
  const sourceOptions = useCrmStore((s) => s.sources);
  // Assignees come from `/crm/team-roster/` — the backend is the source of
  // truth, so no sample directory is substituted here.
  const teamOptions = useCrmStore((s) => s.teamMembers);
  const firstStageId = useCrmStore((s) => (
    [...s.stages]
      .filter((stage) => stage.isActive !== false)
      .sort((a, b) => (Number(a.order ?? a.sequence) || 0) - (Number(b.order ?? b.sequence) || 0))[0]?.id
  ));
  const [activeTab, setActiveTab] = useState('All Leads');
  const [selected, setSelected] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isCreateLeadOpen = isModalOpen;
  // Create-while-saving guard + inline backend error for the create modal.
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showNoFormAlert, setShowNoFormAlert] = useState(false);
  const [showLeadTour, setShowLeadTour] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  // Row quick action from the ⋮ menu: { type, lead } or null.
  const [quickAction, setQuickAction] = useState(null);

  function tempRowId(prefix) {
    return `${prefix}-local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // Write one row to a lead sub-collection (products / files).
  // Server-first; on failure the row is still kept in the local cache so
  // nothing the user entered is lost.
  async function saveLeadSection(leadId, section, row) {
    const key = String(leadId || '');
    try {
      const saved = await useLeadDetailStore.getState().add(leadId, section, row);
      return saved || row;
    } catch (err) {
      console.warn(`[CRM] ${section} kept locally:`, err?.message || err);
      useLeadDetailStore.setState((s) => {
        const current = s.byLead[key] || {};
        return {
          byLead: { ...s.byLead, [key]: { ...current, [section]: [...(current[section] || []), row] } },
        };
      });
      return row;
    }
  }
  const [leadView, setLeadView] = useState('list');
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [appliedSort, setAppliedSort] = useState(DEFAULT_SORT);
  const [draftSort, setDraftSort] = useState(DEFAULT_SORT);
  const [noteTarget, setNoteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [lostTarget, setLostTarget] = useState(null);
  const [bulkLostTargets, setBulkLostTargets] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pendingTaskCount = useMemo(
    () => taskRows.filter((t) => t.status !== 'Completed').length,
    [taskRows],
  );
  const pipelineDealCount = useMemo(
    () => dealRows.filter((d) => d.stage !== 'Declined').length,
    [dealRows],
  );
  const revenueExpected = useMemo(
    () => dealRows.reduce((sum, d) => sum + (Number(d.price) || 0), 0),
    [dealRows],
  );
  const selectedLeads = useMemo(
    () => leadRows.filter((lead) => selected.includes(lead.id)),
    [leadRows, selected],
  );
  const selectedLead = selectedLeads[0] ?? null;

  const columnsByKey = useMemo(() => new Map(leadColumns.map((column) => [column.key, column])), [leadColumns]);

  const rows = useMemo(() => {
    const filtered = leadRows.filter((l) => {
      if (activeTab !== 'All Leads' && l.status !== activeTab) return false;
      if (appliedFilters.statuses.length > 0 && !appliedFilters.statuses.includes(l.status)) return false;
      if (appliedFilters.sources.length > 0 && !appliedFilters.sources.includes(l.source)) return false;
      if (appliedFilters.search) {
        const h = `${l.leadNumber || l.lead_number || ''} ${l.name} ${l.company} ${l.email} ${l.phone}`.toLowerCase();
        if (!h.includes(String(appliedFilters.search ?? '').toLowerCase())) return false;
      }
      return true;
    });

    if (!appliedSort.field) return filtered;
    const dir = appliedSort.direction === 'descending' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, appliedSort.field, columnsByKey);
      const bv = getSortValue(b, appliedSort.field, columnsByKey);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [activeTab, appliedFilters, appliedSort, leadRows, columnsByKey]);

  function handleColumnSort(field) {
    if (!field) return;
    setAppliedSort((current) => {
      if (current.field !== field) {
        const next = { field, direction: 'ascending' };
        setDraftSort(next);
        return next;
      }
      const next = { field, direction: current.direction === 'descending' ? 'ascending' : 'descending' };
      setDraftSort(next);
      return next;
    });
  }

  useEffect(() => {
    // Other CRM views listen for this to re-read what the server now holds.
    window.dispatchEvent(new Event('crm:data-updated'));
  }, [leadRows]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, appliedFilters, appliedSort, leadRows, pageSize]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  function handlePageSizeChange(nextSize) {
    setPageSize(nextSize);
    setPage(1);
  }

  async function updateLead(id, updates, { throwOnError = false } = {}) {
    const oldLead = leadRows.find((l) => l.id === id);
    // Custom builder fields live in customValues — merge so a single edit
    // never wipes the other extras. The server replaces the whole dict, so
    // it must receive the merged copy.
    let patch = updates;
    if (updates && updates.customValues && !updates.__customKey) {
      // Full-form edit (EditLeadModal) — deep-merge customValues against the
      // store row so concurrent extras are never wiped. The server replaces
      // the whole dict, so it must receive the merged copy.
      const prev = oldLead?.customValues || {};
      const next = updates.customValues || {};
      patch = {
        ...updates,
        customValues: {
          ...prev,
          ...next,
          fields: { ...(prev.fields || {}), ...(next.fields || {}) },
        },
      };
    }
    if (updates && updates.__customKey) {
      const prev = oldLead?.customValues || {};
      if (String(updates.__customKey).startsWith('fields.')) {
        const fieldId = String(updates.__customKey).slice('fields.'.length);
        patch = {
          customValues: {
            ...prev,
            fields: { ...(prev.fields || {}), [fieldId]: updates.__customValue },
          },
        };
      } else {
        patch = { customValues: { ...prev, [updates.__customKey]: updates.__customValue } };
      }
    }
    try {
      const saved = await updateLeadRecord(id, patch);
      const updatedLead = { ...(oldLead || {}), ...patch, ...(saved || {}) };
      // The server reports what the stage automation generated alongside the
      // updated lead (`{ lead, createdTasks }`) — surface it so the move is
      // visible instead of silently adding tasks.
      const createdTasks = saved?.createdTasks;
      if (Array.isArray(createdTasks) && createdTasks.length > 0) {
        showToast?.(
          `Moved to ${updatedLead.status || 'new stage'} — ${createdTasks.length} follow-up task${createdTasks.length > 1 ? 's' : ''} created.`,
        );
      }
      if (oldLead && patch?.status && patch.status !== oldLead.status) {
        try {
          runLeadStageAutomation(updatedLead, patch.status, { previousStage: oldLead.status });
        } catch (e) {
          console.error('[CRM Automation] Error in updateLead automation:', e);
        }
      }
      return saved;
    } catch (err) {
      const message = `Lead not saved — ${describeError(err)}`;
      if (throwOnError) throw new Error(message, { cause: err });
      showToast?.(message);
      return null;
    }
  }

  const toggleOne = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const toggleAll = () => {
    const ids = rows.map((r) => r.id);
    const allIn = ids.length > 0 && ids.every((id) => selected.includes(id));
    setSelected(allIn ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  };

  function clearSelected() {
    setSelected([]);
  }

  // The stage a lead moves to on "Close Lead" — a Lost/Closed stage when
  // the workspace has one, otherwise null (local leads just get flagged).
  const closedStage = useCrmStore((s) => {
    const active = [...s.stages].filter((stage) => stage.isActive !== false);
    return (
      active.find((stage) => /lost|closed/i.test(String(stage.name || ''))) || null
    );
  });

  function toggleCloseLead(lead) {
    const target = lead ?? selectedLead;
    if (!target) return;
    const isClosed = /closed|lost/i.test(String(target.status || ''));
    if (isClosed) {
      // Reopen — back to the first pipeline stage (or New for local leads).
      if (!firstStageId) {
        updateLead(target.id, { status: 'New' });
        return;
      }
      const reopenName =
        useCrmStore.getState().stages.find((s) => s.id === firstStageId)?.name || 'New';
      updateLead(target.id, { stageId: firstStageId, status: reopenName });
      return;
    }
    if (!closedStage) {
      if (!firstStageId) {
        // Frontend-design mode: no stages at all — flag it locally.
        updateLead(target.id, { status: 'Closed' });
        return;
      }
      showToast?.('No Closed/Lost stage found — add one in CRM System Setup');
      return;
    }
    updateLead(target.id, { stageId: closedStage.id, status: closedStage.name });
  }

  function openQuickAction(type, lead) {
    const target = lead ?? selectedLead;
    if (!target) return;
    setQuickAction({ type, lead: target });
  }

  function closeQuickAction() {
    setQuickAction(null);
  }

  // 1. Create Task — sample visit follow-up. The backend requires a lead or
  // deal parent, which this lead always provides.
  async function saveQuickTask({ title, dueDate, assigneeId, priority }) {
    const lead = quickAction?.lead;
    if (!lead) return;
    const assigneeName =
      (teamOptions || []).find((m) => String(m.id) === String(assigneeId))?.name || '';
    try {
      if (isServerId(lead.id)) {
        await createTaskRecord({
          title,
          dueDate: dueDate || undefined,
          assigneeId: assigneeId || undefined,
          leadId: lead.id,
          status: 'Open',
          priority,
        });
      } else {
        createTaskLocal({
          title,
          dueDate: dueDate || '',
          assigneeId: assigneeId || undefined,
          leadId: lead.id,
          lead: lead.name || '',
          owner: assigneeName || 'Unassigned',
          status: 'Open',
          priority,
        });
      }
      showToast?.(`Task created for ${lead.name || 'lead'}`);
    } catch (err) {
      showToast?.(`Task not created — ${describeError(err)}`);
      return;
    }
    closeQuickAction();
  }

  // 2. Issue Sample — taka + meters to LeadProduct, photo to Lead files.
  async function saveQuickSample({ design, takaNo, meters, notes, photo }) {
    const lead = quickAction?.lead;
    if (!lead) return;
    const detailLine = [
      takaNo ? `Taka ${takaNo}` : '',
      meters ? `${meters} m cut` : '',
      notes,
    ]
      .filter(Boolean)
      .join(' · ');
    try {
      await saveLeadSection(lead.id, 'products', {
        id: tempRowId('sample'),
        product_name: design,
        qty: Number(meters) || 1,
        notes: detailLine,
      });
      if (photo) {
        const now = new Date();
        await saveLeadSection(lead.id, 'files', {
          id: tempRowId('file'),
          label: `Sample photo — ${design}`,
          preview: photo,
          downloadUrl: photo,
          sentOn: now.toLocaleDateString('en-GB'),
          sentBy: actorName,
        });
      }
      showToast?.(`Sample issued for ${lead.name || 'lead'}`);
    } catch (err) {
      showToast?.(`Sample not saved — ${describeError(err)}`);
      return;
    }
    closeQuickAction();
  }

  // 3. Convert to Deal — rate offer for the design + colour, linked via
  // Deal.lead. A quotation can be attached to the deal later.
  async function saveQuickDeal({ title, rate, expectedCloseDate, designColour }) {
    const lead = quickAction?.lead;
    if (!lead) return;
    const dealNotes = designColour ? `Design + colour: ${designColour}` : '';
    try {
      if (isServerId(lead.id)) {
        await createDealRecord({
          title,
          leadId: lead.id,
          value: rate,
          stage: 'Draft',
          expectedCloseDate: expectedCloseDate || undefined,
          notes: dealNotes || undefined,
        });
      } else {
        createDealLocal({
          title,
          client: lead.company || lead.name || '',
          phone: lead.phone || '',
          value: rate,
          price: rate,
          stage: 'Draft',
          leadId: lead.id,
          expectedCloseDate: expectedCloseDate || '',
          product: designColour,
        });
      }
      showToast?.(`Deal created for ${lead.name || 'lead'}`);
    } catch (err) {
      showToast?.(`Deal not created — ${describeError(err)}`);
      return;
    }
    closeQuickAction();
  }


  // 4. Convert to Party — regular buyer becomes a Customer party for Sales
  // Orders, linked on Lead.party.
  async function saveQuickParty({ name, phone, email }) {
    const lead = quickAction?.lead;
    if (!lead) return;
    try {
      const party = await partiesService.createParty({
        name,
        type: 'Customer',
        phone: phone || undefined,
        email: email || undefined,
      });
      const partyId = party?.id;
      if (partyId) {
        await updateLead(lead.id, { party: partyId });
      }
      showToast?.(`Party ${party?.code || name} created — feeds Sales Orders`);
    } catch (err) {
      showToast?.(`Party not created — ${describeError(err)}`);
      return;
    }
    closeQuickAction();
  }

  function openNotes(lead) {
    setNoteTarget(lead ?? selectedLead);
  }

  function closeNotes() {
    setNoteTarget(null);
  }

  function openLeadDetails(lead) {
    const target = lead ?? selectedLead;
    if (!target) return;
    navigate(`/crm/leads/${target.id}`);
  }

  function openEditLead(lead) {
    const target = lead ?? selectedLead;
    if (!target) return;
    setEditTarget(target);
  }

  async function saveEditedLead(id, updates) {
    // Throws with the backend's message on failure — the modal stays open
    // and renders it inline instead of closing on a failed save.
    await updateLead(id, updates, { throwOnError: true });
    setEditTarget(null);
    showToast?.('Lead information updated.');
  }

  function goToLeads() {
    navigate('/crm/leads');
  }

  function openTaskForm(lead) {
    const target = lead ?? selectedLead;
    if (target && !selected.includes(target.id)) {
      setSelected([target.id]);
    }
    navigate('/crm/tasks');
  }

  function openFilterPanel() {
    setDraftFilters(appliedFilters);
    setIsFilterOpen(true);
  }

  function closeFilterPanel() {
    setDraftFilters(appliedFilters);
    setIsFilterOpen(false);
  }

  function openSortPanel() {
    setDraftSort(appliedSort);
    setIsSortOpen(true);
  }

  function closeSortPanel() {
    setDraftSort(appliedSort);
    setIsSortOpen(false);
  }

  function updateDraftFilter(key, value) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function updateDraftSort(key, value) {
    setDraftSort((current) => ({ ...current, [key]: value }));
  }

  function clearDraftFilters() {
    setDraftFilters(DEFAULT_FILTERS);
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
    setIsFilterOpen(false);
  }

  function applySort() {
    setAppliedSort(draftSort.field ? draftSort : DEFAULT_SORT);
    setIsSortOpen(false);
  }

  function clearSort() {
    setAppliedSort(DEFAULT_SORT);
    setDraftSort(DEFAULT_SORT);
    setIsSortOpen(false);
  }

  function exportLeads(format) {
    const headers = LEAD_EXPORT_FIELDS.map(([label]) => label);
    if (format === 'CSV') exportToCSV('leads_details', headers, exportLeadRows(rows));
    if (format === 'Excel') downloadLeadsAsExcel(rows);
    if (format === 'PDF') printLeadsAsPdf(rows);
    setIsPrintOpen(false);
  }

  // Asks the server at click time: an admin may have switched every lead form
  // off since this page loaded. Offline, the loaded forms decide.
  async function leadFormIsOn() {
    try {
      return Boolean(await fetchLiveLeadFormId());
    } catch {
      return isLeadFormSwitchedOn();
    }
  }

  async function openCreateLeadModal() {
    // Every form is switched off in Manage Lead Create Forms: ask the user to
    // turn one on instead of opening an arbitrary form.
    if (!(await leadFormIsOn())) {
      setShowNoFormAlert(true);
      return;
    }
    setCreateError('');
    setIsModalOpen(true);
  }

  function formatDisplayDate(value) {
    if (!value) return new Date().toLocaleDateString('en-GB');
    const parts = String(value).split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return String(value);
  }

  async function saveLead(formData) {
    const data = formData ?? {};
    // The server owns the id, the lead number and the stage defaults, so the
    // payload carries only what the user actually typed.
    const payload = {
      // A lead has to enter the pipeline somewhere; the first configured
      // stage is where the automation expects it to start.
      stageId: data.stageId || firstStageId,
      name: data.leadName || 'Untitled Lead',
      company: data.company || '',
      phone: data.phone || '',
      email: data.email || '',
      owner: data.owner || '',
      ownerId: data.ownerId || undefined,
      source: data.source || '',
      sourceId: data.sourceId || undefined,
      industryId: data.industryId || undefined,
      industry: data.industry || '',
      jobTitle: data.titleValue || '',
      createdOn: data.createdOn || undefined,
      country: data.country || 'India',
      // Avatar: shown immediately (optimistic row / local lead) and kept
      // inside customValues so it survives the server round-trip.
      photo: data.photoPreview || '',
      // Extra capture (products, lead users, task schedule) has no
      // dedicated columns — the server keeps it in `custom_values` so it
      // survives refresh and renders on the lead detail page.
      // `fields` carries every other dynamic builder value (keyed by field
      // id) so the leads table can show + edit custom form fields.
      customValues: {
        products: data.products || [],
        leadUsers: data.leadUsers || [],
        taskDate: data.taskDate || '',
        taskTime: data.taskTime || '',
        photo: data.photoPreview || '',
        fields: data.fieldValues || {},
      },
    };
    let createdLead = null;
    if (!payload.stageId) {
      // Frontend-design mode: no pipeline stage exists to save under
      // (stages not configured / unreachable), so keep the lead local
      // instead of failing the save. It behaves like a real row until
      // refresh — the server never saw it.
      createdLead = createLeadLocal(payload);
    } else {
      createdLead = await createLeadRecord(payload);
    }

    if (createdLead) {
      try {
        runLeadStageAutomation(createdLead, 'New Lead');
      } catch (err) {
        console.error('[CRM Automation] Error generating stage tasks for new lead:', err);
      }
      emitCrmEvent({
        type: CRM_EVENT_TYPES.LEAD_CREATED,
        entityType: 'lead',
        entityId: createdLead.id,
        payload: {
          leadRef: createdLead.leadNumber,
          leadName: createdLead.name,
          ownerName: createdLead.owner,
          path: `/crm/leads/${createdLead.id}`,
        },
      });
    }
    return createdLead;
  }

  async function handleCreateLead(formData) {
    // Duplicate-submission guard: the modal disables its button while this
    // is in flight, and a second submit here is a no-op.
    if (isCreating) return;
    setIsCreating(true);
    setCreateError('');
    let created = null;
    try {
      created = await saveLead(formData);
    } catch (err) {
      const message = `Lead not created — ${describeError(err)}`;
      setCreateError(message);
      showToast?.(message);
      setIsCreating(false);
      return;
    }
    setIsCreating(false);

    setIsModalOpen(false);
    setShowLeadTour(false);
    setCreateError('');
    if (created) showToast?.(`Lead ${created.leadNumber || created.name || ''} created.`.trim());
    setActiveTab('All Leads');
    setAppliedFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedSort(DEFAULT_SORT);
    setDraftSort(DEFAULT_SORT);
    setLeadView('list');
    setPage(1);
  }

  // Import template + row mapping follow the active Lead Create Form, so the
  // CSV columns always match what Create/Edit render (custom fields included).
  const importTemplate = useMemo(
    () => {
      const sections = getActiveLeadFormSections();
      const fields = sections
        .flatMap((s) => s.fields || [])
        .filter((f) => f.type !== 'Lead Image');
      return {
        fields,
        headers: fields.map((f) => f.label || 'Field'),
        sampleRow: fields.map((f) => sampleImportValue(f)),
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leadFormVersion],
  );

  // Bulk import from the Import CSV modal — CSV headers match form field
  // labels case-insensitively, with legacy aliases (`Name`, `Mobile`, …)
  // so older templates keep working.
  async function handleImportLeads(rows) {
    const { fields } = importTemplate;
    const sections = getActiveLeadFormSections();
    let created = 0;
    let failed = 0;
    for (const row of rows || []) {
      const lowered = {};
      Object.entries(row || {}).forEach(([key, value]) => {
        lowered[String(key).trim().toLowerCase()] = value;
      });
      const values = {};
      for (const field of fields) {
        const hitKey = importKeysFor(field).find((k) => {
          const v = lowered[k];
          return v !== undefined && v !== null && String(v).trim() !== '';
        });
        if (!hitKey) continue;
        const raw = String(lowered[hitKey]).trim();
        const isMulti =
          field.type === 'Multi Select' ||
          field.id === 'lead-users' ||
          /lead\s*users?/i.test(String(field.label || ''));
        values[field.id] = isMulti
          ? raw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
          : raw;
      }
      try {
        await saveLead(
          leadFormValuesToPayload(values, sections, {
            sources: sourceOptions,
            userOptions: teamOptions,
          }),
        );
        created += 1;
      } catch (err) {
        failed += 1;
        console.error('[CRM Import] Lead row failed:', err);
      }
    }
    setActiveTab('All Leads');
    setAppliedFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
    setPage(1);
    showToast?.(
      failed > 0
        ? `Imported ${created} leads (${failed} rows failed)`
        : `Imported ${created} leads`,
    );
  }

  function openLeadFormBuilder() {
    navigate('/crm/leads/form-builder');
  }

  async function openLeadCreateForm() {
    if (!(await leadFormIsOn())) {
      setShowNoFormAlert(true);
      return;
    }
    navigate('/crm/leads/create-form');
  }

  function requestMarkLostLead(lead) {
    setLostTarget(lead);
    setBulkLostTargets([]);
  }

  function requestMarkLostAll(visibleLeads) {
    if (!visibleLeads || visibleLeads.length === 0) return;
    setLostTarget(null);
    setBulkLostTargets(visibleLeads);
  }

  function closeMarkLost() {
    setLostTarget(null);
    setBulkLostTargets([]);
    setSelected([]);
  }

  async function applyMarkLostResult(result, fallbackLabel) {
    const updated = result?.lead;
    if (updated?.id) {
      try {
        await updateLeadRecord(updated.id, { stageId: updated.stageId || updated.stage_id, status: updated.status });
      } catch {
        // Refresh below will reconcile the row.
      }
    }
    await Promise.all([refreshLeads('leads'), refreshLeads('deals'), refreshLeads('stages')]);
    const dealsMoved = result?.dealsMoved ?? 0;
    showToast?.(
      dealsMoved > 0
        ? `${fallbackLabel} marked as lost. ${dealsMoved} deal${dealsMoved > 1 ? 's' : ''} moved to Lost.`
        : `${fallbackLabel} marked as lost.`,
    );
  }

  async function markLeadLost(id, payload = {}) {
    try {
      if (isServerId(id)) {
        const result = await markLeadLostRequest(id, payload);
        if (result) {
          await applyMarkLostResult(result, 'Lead');
        } else {
          toggleCloseLead(leadRows.find((lead) => lead.id === id));
          showToast?.('Lead marked as lost.');
        }
      } else {
        toggleCloseLead(leadRows.find((lead) => lead.id === id));
        showToast?.('Lead marked as lost.');
      }
    } catch (err) {
      showToast?.(`Lead not marked as lost — ${describeError(err)}`);
      return;
    }
    setSelected((current) => current.filter((selectedId) => selectedId !== id));
    closeMarkLost();
  }

  async function markAllLeadsLost(leadsToMark, payload = {}) {
    const ids = leadsToMark.map((lead) => lead.id);
    try {
      const serverIds = ids.filter((leadId) => isServerId(leadId));
      if (serverIds.length > 0) {
        const result = await bulkMarkLeadsLostRequest(serverIds, payload);
        if (result) {
          await Promise.all([refreshLeads('leads'), refreshLeads('deals'), refreshLeads('stages')]);
          showToast?.(`${serverIds.length} lead${serverIds.length > 1 ? 's' : ''} marked as lost. ${result.dealsMoved || 0} deal${(result.dealsMoved || 0) === 1 ? '' : 's'} moved to Lost.`);
        }
      }
      const localIds = ids.filter((leadId) => !isServerId(leadId));
      for (const localId of localIds) {
        toggleCloseLead(leadRows.find((lead) => lead.id === localId));
      }
      if (serverIds.length === 0) showToast?.('Leads marked as lost.');
    } catch (err) {
      showToast?.(`Leads not marked as lost — ${describeError(err)}`);
      return;
    }
    setSelected((current) => current.filter((selectedId) => !ids.includes(selectedId)));
    closeMarkLost();
  }

  async function pinLead(lead) {
    if (!lead || lead.isPinned) return;
    try {
      await toggleLeadPin(lead.id);
    } catch (err) {
      showToast?.(`Pin not saved — ${describeError(err)}`);
      return;
    }
    setSelected((current) => current.filter((id) => id !== lead.id));
    closeMarkLost();
  }

  const pinnedLeadIds = useMemo(
    () => leadRows.filter((lead) => lead.isPinned).map((lead) => lead.id),
    [leadRows],
  );

  async function togglePinLead(lead) {
    if (!lead) return;
    try {
      await toggleLeadPin(lead.id);
    } catch (err) {
      showToast?.(`Pin not saved — ${describeError(err)}`);
    }
  }

  const recordActionLead = selectedLeads.length === 1 ? selectedLeads[0] : null;

  function requestMarkLostSelection(target) {
    if (Array.isArray(target)) {
      requestMarkLostAll(target);
      return;
    }

    const targetLead = leadRows.find((lead) => lead.id === target) ?? recordActionLead;
    if (targetLead) {
      requestMarkLostLead(targetLead);
    }
  }

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Manage and track all your CRM leads."
        guide={leadsGuide}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              aria-label="How to create a lead"
              className="group inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 pl-1.5 pr-3.5 text-[13px] font-semibold text-blue-700 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-blue-400 hover:shadow-md hover:shadow-blue-500/15"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-[13px] font-bold text-white shadow-sm transition-transform duration-200 group-hover:scale-105 group-hover:rotate-6">?</span>
              How to create a lead?
            </button>
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="btn-outline"
            >
              <Upload size={16} />
              Import CSV
            </button>
            <button
              type="button"
              onClick={openCreateLeadModal}
              className="btn-primary"
            >
              <Plus size={16} />
              Create Lead
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 my-4">
        <CrmKpiCard label="Total Leads" value={leadRows.length} icon={Users} tone="blue" />
        <CrmKpiCard label="New Leads" value={leadRows.filter((l) => l.status === 'New').length} icon={UserPlus} tone="emerald" />
        <CrmKpiCard label="Pending Tasks" value={pendingTaskCount} icon={Clock} tone="amber" />
        <CrmKpiCard label="Deals in Pipeline" value={pipelineDealCount} icon={TrendingUp} tone="purple" />
        <CrmKpiCard label="Total Revenue Expected" value={'Rs ' + revenueExpected.toLocaleString('en-IN', { maximumFractionDigits: 0 })} symbol="₹" tone="rose" />
      </div>

      <LeadsTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        isFilterOpen={isFilterOpen}
        onToggleFilter={() => (isFilterOpen ? closeFilterPanel() : openFilterPanel())}
        isSortOpen={isSortOpen}
        sortDraft={draftSort}
        sortApplied={appliedSort}
        sortOptions={SORT_OPTIONS}
        onToggleSort={() => (isSortOpen ? closeSortPanel() : openSortPanel())}
        onSortDraftChange={updateDraftSort}
        onApplySort={applySort}
        onCancelSort={closeSortPanel}
        onClearSort={clearSort}
        leadView={leadView}
        onLeadViewChange={setLeadView}
        recordActionLead={recordActionLead}
        recordActionLeads={selectedLeads}
        onCloseRecordAction={clearSelected}
        onDeleteRecord={requestMarkLostSelection}
        onPrint={() => setIsPrintOpen(true)}
      />

      {isPrintOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4" onClick={() => setIsPrintOpen(false)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-sm p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Print Leads</h2>
                <p className="text-xs text-slate-500 mt-1">Choose a format for {rows.length} lead records</p>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-700 text-lg" onClick={() => setIsPrintOpen(false)} aria-label="Close print options">×</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['CSV', 'Excel', 'PDF'].map((format) => (
                <button key={format} type="button" className="border border-slate-200 rounded-lg px-3 py-3 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50" onClick={() => exportLeads(format)}>
                  {format}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`content-grid${isFilterOpen && leadView !== 'map' ? '' : ' content-grid-wide'}`}>
        {isFilterOpen && leadView !== 'map' && (
          <FilterPanel
            statusFilters={draftFilters.statuses}
            sourceFilters={draftFilters.sources}
            systemDefinedFilters={draftFilters.systemDefined}
            searchFilter={draftFilters.search}
            onStatusChange={(v) => updateDraftFilter('statuses', v)}
            onSourceChange={(v) => updateDraftFilter('sources', v)}
            onSystemDefinedChange={(v) => updateDraftFilter('systemDefined', v)}
            onSearchChange={(v) => updateDraftFilter('search', v)}
            onApply={applyFilters}
            onClear={clearDraftFilters}
            onClose={closeFilterPanel}
          />
        )}
        <div className="table-col">
          {crmLoading && leadRows.length === 0 && (
            <div className="card p-8 text-center text-xs text-slate-500" role="status">
              Loading leads from the server…
            </div>
          )}
          {crmError && leadRows.length === 0 && !crmLoading && (
            <div className="card p-8 text-center space-y-2" role="alert">
              <p className="text-sm font-bold text-slate-900">Could not load leads</p>
              <p className="text-xs text-slate-500">{crmError}</p>
            </div>
          )}
          {leadView === 'list' ? (
            <>
              <LeadsTable
                rows={pagedRows}
                selected={selected}
                pinnedLeadIds={pinnedLeadIds}
                onTogglePin={togglePinLead}
                onToggleOne={toggleOne}
                onRequestMarkLost={requestMarkLostLead}
                onRequestMarkLostAll={requestMarkLostAll}
                onToggleAll={toggleAll}
                onAddNote={openNotes}
                onOpenLead={openLeadDetails}
                onUpdateLead={updateLead}
                onEditLead={openEditLead}
                columns={leadColumns}
                sortField={appliedSort.field}
                sortDirection={appliedSort.direction}
                onSort={handleColumnSort}
                onToggleCloseLead={toggleCloseLead}
                onCreateTask={(lead) => openQuickAction('task', lead)}
                onIssueSample={(lead) => openQuickAction('sample', lead)}
                onConvertDeal={(lead) => openQuickAction('deal', lead)}
                onConvertParty={(lead) => openQuickAction('party', lead)}
                onMarkLost={markLeadLost}
              />
              <div className="table-card pager-wrap" style={{ marginTop: 10 }}>
                <Pagination
                  total={rows.length}
                  page={page}
                  pageSize={pageSize}
                  onChange={setPage}
                  showTotalRecords
                  pageSizeOptions={[10, 20, 50]}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            </>
          ) : leadView === 'grid' ? (
            <>
              <LeadsTable
                rows={pagedRows}
                selected={selected}
                pinnedLeadIds={pinnedLeadIds}
                onTogglePin={togglePinLead}
                onToggleOne={toggleOne}
                onRequestMarkLost={requestMarkLostLead}
                onRequestMarkLostAll={requestMarkLostAll}
                onToggleAll={toggleAll}
                onAddNote={openNotes}
                onOpenLead={openLeadDetails}
                onUpdateLead={updateLead}
                onEditLead={openEditLead}
                columns={leadColumns}
                sortField={appliedSort.field}
                sortDirection={appliedSort.direction}
                onSort={handleColumnSort}
                onToggleCloseLead={toggleCloseLead}
                onCreateTask={(lead) => openQuickAction('task', lead)}
                onIssueSample={(lead) => openQuickAction('sample', lead)}
                onConvertDeal={(lead) => openQuickAction('deal', lead)}
                onConvertParty={(lead) => openQuickAction('party', lead)}
                variant="grid"
                onMarkLost={markLeadLost}
              />
              <div className="table-card pager-wrap" style={{ marginTop: 10 }}>
                <Pagination
                  total={rows.length}
                  page={page}
                  pageSize={pageSize}
                  onChange={setPage}
                  showTotalRecords
                  pageSizeOptions={[10, 20, 50]}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            </>
          ) : leadView === 'tile' ? (
            <LeadCardGridView
              rows={pagedRows}
              selected={selected}
              pinnedLeadIds={pinnedLeadIds}
              onTogglePin={togglePinLead}
              onToggleOne={toggleOne}
              onRequestMarkLost={requestMarkLostLead}
              onAddNote={openNotes}
              onOpenLead={openLeadDetails}
              onMarkLost={markLeadLost}
            />
          ) : (
            <LeadMapView
              rows={rows}
              selected={selected}
              onToggleOne={toggleOne}
              onAddNote={openNotes}
              onOpenListView={() => setLeadView('list')}
              onOpenLead={openLeadDetails}
            />
          )}
        </div>
      </div>

      <NotesDrawer lead={noteTarget} isOpen={Boolean(noteTarget)} onClose={closeNotes} onCreateTask={openTaskForm} />
      <EditLeadModal
        lead={editTarget}
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        onSave={saveEditedLead}
      />
      {(lostTarget || bulkLostTargets.length > 0) && (
        <MarkAsLostModal
          lead={lostTarget}
          leads={bulkLostTargets}
          onClose={closeMarkLost}
          onConfirm={markLeadLost}
          onConfirmAll={markAllLeadsLost}
        />
      )}
      <CreateLeadModal
        isOpen={isCreateLeadOpen}
        showTour={showLeadTour}
        submitting={isCreating}
        serverError={createError}
        onClose={() => { if (!isCreating) { setIsModalOpen(false); setShowLeadTour(false); } }}
        onCreate={handleCreateLead}
        onEditLayout={() => { setIsModalOpen(false); setShowLeadTour(false); navigate('/crm/leads/form-builder'); }}
      />
      {showNoFormAlert && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowNoFormAlert(false)}>
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="no-lead-form-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl text-center"
          >
            <button
              type="button"
              onClick={() => setShowNoFormAlert(false)}
              className="absolute right-3 top-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle size={24} />
            </div>
            <h3 id="no-lead-form-title" className="text-base font-bold text-slate-900">Turn on a Lead Create Form first</h3>
            <p className="mt-1.5 text-sm text-slate-500">
              All lead create forms are switched off. Switch one on in Manage Lead Create Forms, then create the lead.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowNoFormAlert(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowNoFormAlert(false); navigate('/crm/leads/forms'); }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Go to Lead Create Forms
              </button>
            </div>
          </section>
        </div>
      )}
      <LeadGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <CreateLeadTaskModal
        isOpen={quickAction?.type === 'task'}
        lead={quickAction?.lead}
        members={teamOptions}
        onClose={closeQuickAction}
        onSave={saveQuickTask}
      />
      <IssueSampleModal
        isOpen={quickAction?.type === 'sample'}
        lead={quickAction?.lead}
        onClose={closeQuickAction}
        onSave={saveQuickSample}
      />
      <ConvertDealModal
        isOpen={quickAction?.type === 'deal'}
        lead={quickAction?.lead}
        onClose={closeQuickAction}
        onSave={saveQuickDeal}
      />
      <ConvertPartyModal
        isOpen={quickAction?.type === 'party'}
        lead={quickAction?.lead}
        onClose={closeQuickAction}
        onSave={saveQuickParty}
      />
      <LeadImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        templateHeaders={importTemplate.headers}
        sampleRow={importTemplate.sampleRow}
        onImport={handleImportLeads}
      />
    </>
  );
}
