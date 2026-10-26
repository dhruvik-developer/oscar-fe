import DealDetailView from './DealDetailView';
import CrmKpiCard from '../common/CrmKpiCard';
import Modal from '../../../components/ui/Modal';
import PageHeader from '../../../components/ui/PageHeader';
import MasterSourceLink from '../../../components/common/MasterSourceLink';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  RotateCcw,
  Handshake,
  Trophy,
  Clock,
  TrendingUp,
  LayoutGrid,
  List as ListIcon,
  MoreVertical,
  X,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Send,
  FileText,
  Edit2,
  Trash2,
  Phone,
  Tag,
  Globe,
  Package,
  Flag,
  UserRound,
  ChevronDown,
  Inbox,
  AlertTriangle,
  MoveRight,
  SlidersHorizontal,
  Printer,
  Info,
  ShoppingCart,
} from 'lucide-react';

import { loadDeals, buildDeal, EMPTY_DEAL_FORM, getInitialsFromName, getAvatarColorFromName } from '../../../services/dealService';
import { useCrmStore } from '../../../stores/crmStore';
import { useERP } from '../../../context/ERPContext';
import AppPagination from '../../../components/ui/AppPagination';
import { TEXTILE_FABRIC_OPTIONS } from '../../../data/crm/leadFormSchema';
import { useAppStore } from '../../../stores/appStore';
import { api } from '../../../services/api';

// Fallback columns, used only until /crm/deal-stages/ answers. Once the
// catalogue loads, the board is driven by DealStage rows in `sequence` order,
// so stages such as Revised and Declined are no longer invisible.
const FALLBACK_STAGES = ['Draft', 'Sent', 'Open', 'Won', 'Lost'];

// Deal.stage is a TextField enum, but a lead's lost state comes from a Stage FK,
// so the name has to be checked as a fallback when `is_lost` is not set.
const LOST_STAGE_PATTERN = /lost|closed|declined/i;

// Tailwind cannot see classes built at runtime, so the responsive grid widths
// are enumerated here and picked by index.
const GRID_CLASSES = [
  'lg:grid-cols-1', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4',
  'lg:grid-cols-5', 'lg:grid-cols-6', 'lg:grid-cols-7', 'lg:grid-cols-8',
];
// User list is loaded dynamically from /admin/users/

const STAGE_STYLES = {
  Draft: {
    title: 'Draft',
    icon: FileText,
    iconColor: 'bg-blue-50 text-blue-600 border border-blue-200',
    topBar: 'bg-blue-500',
    headerBadge: 'bg-blue-50 text-blue-700 border border-blue-200',
    countBadge: 'bg-blue-50 text-blue-700 border border-blue-200 font-bold',
    accentColor: 'text-blue-600',
  },
  Sent: {
    title: 'Sent',
    icon: Send,
    iconColor: 'bg-purple-50 text-purple-600 border border-purple-200',
    topBar: 'bg-purple-500',
    headerBadge: 'bg-purple-50 text-purple-700 border border-purple-200',
    countBadge: 'bg-purple-50 text-purple-700 border border-purple-200 font-bold',
    accentColor: 'text-purple-600',
  },
  Open: {
    title: 'Open',
    icon: Clock,
    iconColor: 'bg-amber-50 text-amber-600 border border-amber-200',
    topBar: 'bg-amber-500',
    headerBadge: 'bg-amber-50 text-amber-700 border border-amber-200',
    countBadge: 'bg-amber-50 text-amber-700 border border-amber-200 font-bold',
    accentColor: 'text-amber-600',
  },
  Won: {
    title: 'Won',
    icon: CheckCircle2,
    iconColor: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    topBar: 'bg-emerald-500',
    headerBadge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    countBadge: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold',
    accentColor: 'text-emerald-600',
  },
  Lost: {
    title: 'Lost',
    icon: XCircle,
    iconColor: 'bg-rose-50 text-rose-600 border border-rose-200',
    topBar: 'bg-rose-500',
    headerBadge: 'bg-rose-50 text-rose-700 border border-rose-200',
    countBadge: 'bg-rose-50 text-rose-700 border border-rose-200 font-bold',
    accentColor: 'text-rose-600',
  },
};

function formatPriceINR(value) {
  const n = Number(value) || 0;
  return `₹ ${n.toLocaleString('en-IN')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatStageSummary(totalAmount, count) {
  const n = Number(totalAmount) || 0;
  let formatted = '';
  if (n >= 10000000) {
    formatted = `₹ ${(n / 10000000).toFixed(2)} Cr`;
  } else if (n >= 100000) {
    formatted = `₹ ${(n / 100000).toFixed(1)} Lakh`;
  } else {
    formatted = `₹ ${n.toLocaleString('en-IN')}`;
  }
  return `${count} deals • ${formatted}`;
}

/** A column summary that also accounts for lost leads sharing the column. */
function formatColumnSummary(totalAmount, dealCount, leadCount) {
  const base = formatStageSummary(totalAmount, dealCount);
  return leadCount > 0 ? `${base} • ${leadCount} lead${leadCount === 1 ? '' : 's'}` : base;
}

// Stages beyond the hardcoded five (Revised, Declined, or anything a tenant
// configures) fall back to a neutral palette rather than to Draft's blue, so a
// custom stage is not mistaken for one of the built-in ones.
const NEUTRAL_STAGE_STYLE = {
  icon: Flag,
  iconColor: 'bg-slate-50 text-slate-600 border border-slate-200',
  topBar: 'bg-slate-400',
  headerBadge: 'bg-slate-50 text-slate-700 border border-slate-200',
  countBadge: 'bg-slate-50 text-slate-700 border border-slate-200 font-bold',
  accentColor: 'text-slate-600',
};

function getStageStyle(name) {
  return STAGE_STYLES[name] || { ...NEUTRAL_STAGE_STYLE, title: name };
}

function getEffectiveDealStage(deal, quotations, allLeads) {
  if (!deal) return 'Draft';
  if (deal.stage === 'Lost' || deal.tag === 'Lost') return 'Lost';

  // Check direct link to quotations
  const linkedQuotes = (quotations || []).filter((qt) => {
    if (deal.id && (String(qt.dealId) === String(deal.id) || String(qt.crmDeal) === String(deal.id) || String(qt.dealReference) === String(deal.id))) return true;
    if (deal.leadId && String(qt.leadId) === String(deal.leadId)) return true;
    if (deal.name && qt.dealName && qt.dealName.toLowerCase() === deal.name.toLowerCase()) return true;
    return false;
  });

  if (linkedQuotes.length > 0) {
    const hasWon = linkedQuotes.some((qt) => ['Accepted', 'Approved', 'Converted', 'Confirmed', 'Invoiced'].includes(qt.status));
    if (hasWon) return 'Won';
    const hasRejected = linkedQuotes.some((qt) => qt.status === 'Rejected');
    if (hasRejected) return 'Open';
    const hasSent = linkedQuotes.some((qt) => ['Sent', 'Viewed'].includes(qt.status));
    if (hasSent) return 'Sent';
    return 'Draft';
  }

  // If deal has a lead, check lead's status/quotations
  if (deal.leadId) {
    const lead = (allLeads || []).find((l) => String(l.id) === String(deal.leadId));
    if (lead) {
      if (lead.isConverted || Boolean(lead.convertedAt)) return 'Won';
      const leadQuotes = (quotations || []).filter((qt) => String(qt.leadId) === String(lead.id) || (qt.leadName && qt.leadName === lead.name));
      if (leadQuotes.length > 0) {
        const hasWon = leadQuotes.some((qt) => ['Accepted', 'Approved', 'Converted', 'Confirmed', 'Invoiced'].includes(qt.status));
        if (hasWon) return 'Won';
        const hasRejected = leadQuotes.some((qt) => qt.status === 'Rejected');
        if (hasRejected) return 'Open';
        const hasSent = leadQuotes.some((qt) => ['Sent', 'Viewed'].includes(qt.status));
        if (hasSent) return 'Sent';
        return 'Draft';
      }
    }
  }

  if (deal.stage === 'Won') return 'Won';
  return 'Draft';
}

export default function DealsPage() {
  const { addQuotation, addSalesOrder, customers, quotations } = useERP() || {};
  const navigate = useNavigate();
  const storeDeals = useCrmStore((s) => s.deals);
  const dealStages = useCrmStore((s) => s.dealStages);
  const leadStages = useCrmStore((s) => s.stages);
  const allLeads = useCrmStore((s) => s.leads);
  const teamMembers = useCrmStore((s) => s.teamMembers);
  const currentUser = useAppStore((s) => s.currentUser);
  const [deals, setDeals] = useState([]);

  useEffect(() => { setDeals(storeDeals); }, [storeDeals]);

  // NOTE: no blanket write-back here. Every mutation below writes through the
  // CRM store explicitly (createRecord / updateRecord / deleteRecord), so the
  // server is hit exactly once per user action. A whole-list write-back on
  // every render used to re-POST the row whose server id had just replaced
  // its local id, minting an identical duplicate deal on each create.

  const [searchParams, setSearchParams] = useSearchParams();
  const linkedDealId = searchParams.get('deal');

  useEffect(() => {
    const sync = () => {
      try { setDeals(loadDeals()); }
      catch (error) { console.error('[CRM Deals] Refresh failed:', error); }
    };
    window.addEventListener('crm:data-updated', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('crm:data-updated', sync); window.removeEventListener('storage', sync); };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('All Products');
  const [selectedStage, setSelectedStage] = useState('All Stages');
  const [selectedSource, setSelectedSource] = useState('All Sources');
  const [selectedUser, setSelectedUser] = useState('All Users');
  const [dateRange, setDateRange] = useState('All Time');
  const [viewMode, setViewMode] = useState('kanban');
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);

  const [expandedColumns, setExpandedColumns] = useState({});
  const [openMenuDealId, setOpenMenuDealId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [dealToDelete, setDealToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const [formState, setFormState] = useState(EMPTY_DEAL_FORM);
  const [formError, setFormError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.deal-action-menu-container')) {
        setOpenMenuDealId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Assignable users from the CRM team roster, plus any name already on a deal
  // so the filter can still find deals assigned to someone no longer listed.
  const crmSources = useCrmStore((s) => s.sources);
  const { items = [], fabrics = [] } = useERP() || {};

  const productOptions = useMemo(() => {
    const list = new Set();
    (items || []).forEach((i) => {
      const name = i.name || i.itemName || i.item_name || i.fabricQuality;
      if (name) list.add(String(name).trim());
    });
    (fabrics || []).forEach((f) => {
      const name = f.name || f.fabric || f.quality;
      if (name) list.add(String(name).trim());
    });
    (deals || []).forEach((d) => {
      if (d.product) list.add(String(d.product).trim());
      if (Array.isArray(d.products)) d.products.forEach((p) => p && list.add(String(p).trim()));
    });
    if (list.size === 0) {
      (TEXTILE_FABRIC_OPTIONS || []).forEach((p) => list.add(p));
    }
    return ['All Products', ...Array.from(list).sort((a, b) => a.localeCompare(b))];
  }, [items, fabrics, deals]);

  const sourceOptions = useMemo(() => {
    const list = new Set();
    (Array.isArray(crmSources) ? crmSources : []).forEach((s) => {
      const name = typeof s === 'string' ? s : s?.name;
      if (name) list.add(String(name).trim());
    });
    (deals || []).forEach((d) => {
      if (d.source) list.add(String(d.source).trim());
    });
    (allLeads || []).forEach((l) => {
      if (l.source) list.add(String(l.source).trim());
    });
    return ['All Sources', ...Array.from(list).sort((a, b) => a.localeCompare(b))];
  }, [crmSources, deals, allLeads]);

  // Assignable users from the CRM team roster, plus any name already on a deal
  // so the filter can still find deals assigned to someone no longer listed.
  const usersList = useMemo(() => {
    const names = new Set();
    (Array.isArray(teamMembers) ? teamMembers : []).forEach((m) => m?.name && names.add(m.name));
    deals.forEach((d) => d.assignedUser && names.add(d.assignedUser));
    return ['All Users', ...[...names].sort((a, b) => a.localeCompare(b))];
  }, [teamMembers, deals]);

  const filteredDeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return deals.filter((d) => {
      if (selectedProduct !== 'All Products' && d.product !== selectedProduct) return false;
      if (selectedStage !== 'All Stages' && d.stage !== selectedStage) return false;
      if (selectedSource !== 'All Sources' && d.source !== selectedSource) return false;
      if (selectedUser !== 'All Users' && d.assignedUser !== selectedUser) return false;
      if (dateRange !== 'All Time') {
        const dealDateStr = d.createdAt || d.date;
        if (dealDateStr) {
          const dealDate = new Date(dealDateStr);
          if (!isNaN(dealDate.getTime())) {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (dateRange === 'Today' && dealDate < startOfDay) return false;
            if (dateRange === 'Last 7 Days' && dealDate < new Date(startOfDay.getTime() - 7 * 86400000)) return false;
            if (dateRange === 'This Month' && dealDate < new Date(now.getFullYear(), now.getMonth(), 1)) return false;
            if (dateRange === 'Last 30 Days' && dealDate < new Date(startOfDay.getTime() - 30 * 86400000)) return false;
            if (dateRange === 'This Quarter') {
              const qMonth = Math.floor(now.getMonth() / 3) * 3;
              if (dealDate < new Date(now.getFullYear(), qMonth, 1)) return false;
            }
            if (dateRange === 'This Year' && dealDate < new Date(now.getFullYear(), 0, 1)) return false;
          }
        }
      }
      if (q && !`${d.name} ${d.client} ${d.phone} ${d.product}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [deals, searchQuery, selectedProduct, selectedStage, selectedSource, selectedUser, dateRange]);

  /**
   * Board columns come from the DealStage catalogue, not a hardcoded array, so
   * stages such as Revised and Declined get a column instead of silently
   * dropping their deals. Inactive stages are hidden unless a deal still sits
   * in one. `Deal.stage` values with no catalogue row are appended rather than
   * hidden -- a partially configured board must never lose records.
   */
  const pipelineStages = useMemo(() => {
    const configured = (dealStages || [])
      .filter((s) => s && s.name && (s.is_active ?? s.isActive) !== false)
      .map((s) => ({
        key: s.name,
        order: s.order ?? s.sequence ?? 0,
        isWon: Boolean(s.is_won ?? s.isWon),
        isLost: Boolean(s.is_lost ?? s.isLost),
      }))
      .sort((a, b) => a.order - b.order);

    const seen = new Set();
    const columns = configured.filter((s) => {
      if (seen.has(s.key)) return false;
      seen.add(s.key);
      return true;
    });

    if (columns.length === 0) {
      return FALLBACK_STAGES.map((name, index) => ({
        key: name,
        order: index,
        isWon: name === 'Won',
        isLost: name === 'Lost',
      }));
    }

    const orphans = [...new Set(deals.map((d) => d.stage).filter((s) => s && !seen.has(s)))];
    return [
      ...columns,
      ...orphans.map((name) => ({
        key: name,
        order: columns.length + orphans.indexOf(name),
        isWon: name === 'Won',
        isLost: LOST_STAGE_PATTERN.test(name),
      })),
    ];
  }, [dealStages, deals]);

  const STAGES = useMemo(() => pipelineStages.map((s) => s.key), [pipelineStages]);

  const lostStageNames = useMemo(
    () => pipelineStages.filter((s) => s.isLost).map((s) => s.key),
    [pipelineStages],
  );

  const gridClass = GRID_CLASSES[Math.min(pipelineStages.length, GRID_CLASSES.length) - 1];

  /**
   * Leads sitting in a stage flagged `is_lost` on the lead catalogue. The
   * backend models lost state as a Stage FK, so the flag is authoritative and
   * the name regex is only a fallback for stages created without one.
   */
  /**
   * Leads classified into pipeline stages according to status and quotation lifecycle:
   * - Lost: leads marked lost
   * - Won: leads with approved/accepted quotation or converted
   * - Open: leads whose quotation was rejected (in negotiation/re-quote)
   * - Sent: leads whose quotation has been sent
   * - Draft: new leads entering the pipeline
   */
  const leadsByStage = useMemo(() => {
    const lostStageIds = new Set(
      (leadStages || []).filter((s) => s && (s.is_lost ?? s.isLost)).map((s) => s.id),
    );
    const leadsWithDeals = new Set(
      (deals || []).map((d) => d.leadId).filter(Boolean).map(String),
    );
    const q = searchQuery.trim().toLowerCase();

    const result = {
      Draft: [],
      Sent: [],
      Open: [],
      Won: [],
      Lost: [],
    };

    (allLeads || []).forEach((lead) => {
      if (!lead) return;
      if (leadsWithDeals.has(String(lead.id))) return;

      if (q && !`${lead.name} ${lead.company} ${lead.phone} ${lead.email}`.toLowerCase().includes(q)) {
        return;
      }

      const isLost = (lead.stageId && lostStageIds.has(lead.stageId)) || LOST_STAGE_PATTERN.test(String(lead.status || ''));
      if (isLost) {
        result.Lost.push(lead);
        return;
      }

      const linkedQuotes = (quotations || []).filter(
        (qt) => String(qt.leadId) === String(lead.id) || (qt.leadName && qt.leadName === lead.name),
      );

      const hasWonQuote = linkedQuotes.some((qt) =>
        ['Accepted', 'Approved', 'Converted', 'Confirmed', 'Invoiced'].includes(qt.status),
      ) || lead.isConverted || Boolean(lead.convertedAt);

      if (hasWonQuote) {
        result.Won.push(lead);
        return;
      }

      const hasRejectedQuote = linkedQuotes.some((qt) => qt.status === 'Rejected');
      if (hasRejectedQuote) {
        result.Open.push(lead);
        return;
      }

      const hasSentQuote = linkedQuotes.some((qt) => ['Sent', 'Viewed'].includes(qt.status));
      if (hasSentQuote) {
        result.Sent.push(lead);
        return;
      }

      // Default: newly arrived leads automatically enter Draft
      result.Draft.push(lead);
    });

    return result;
  }, [allLeads, deals, leadStages, quotations, searchQuery]);

  const visibleLostLeads = useMemo(() => leadsByStage.Lost || [], [leadsByStage]);

  const stats = useMemo(() => {
    const totalDeals = deals.length;
    const totalValueNum = deals.reduce((sum, d) => sum + (Number(d.price) || 0), 0);
    const wonDeals = deals.filter((d) => d.stage === 'Won').length;
    const avgDealSizeNum = totalDeals > 0 ? totalValueNum / totalDeals : 0;
    const conversionRateNum = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;
    const fmt = (n) => 'Rs ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    return {
      totalDeals,
      totalValue: fmt(totalValueNum),
      wonDeals,
      avgDealSize: fmt(avgDealSizeNum),
      conversionRate: conversionRateNum.toFixed(1) + '%',
    };
  }, [deals]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedProduct('All Products');
    setSelectedStage('All Stages');
    setSelectedSource('All Sources');
    setSelectedUser('All Users');
    setDateRange('All Time');
    showNotification('Filters reset.');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedProduct !== 'All Products') count += 1;
    if (selectedStage !== 'All Stages') count += 1;
    if (selectedSource !== 'All Sources') count += 1;
    if (selectedUser !== 'All Users') count += 1;
    if (dateRange !== 'All Time') count += 1;
    return count;
  }, [dateRange, selectedProduct, selectedSource, selectedStage, selectedUser]);

  const handleOpenCreateModal = (stageName = 'Draft') => {
    setEditingDeal(null);
    setFormState({
      ...EMPTY_DEAL_FORM,
      assignedUser: currentUser?.name || '',
      stage: stageName,
      phone: '+91 ',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    });
    setFormError('');
    setIsCreateModalOpen(true);
  };

  const handlePrintDeals = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      showNotification('Please allow popups to print deals.');
      return;
    }

    const today = new Date().toLocaleDateString('en-GB');
    const summaryValue = filteredDeals.reduce((sum, deal) => sum + (Number(deal.price) || 0), 0);

    const activeFilters = [
      selectedProduct !== 'All Products' ? `Product: ${selectedProduct}` : '',
      selectedStage !== 'All Stages' ? `Stage: ${selectedStage}` : '',
      selectedSource !== 'All Sources' ? `Source: ${selectedSource}` : '',
      selectedUser !== 'All Users' ? `Assigned User: ${selectedUser}` : '',
      dateRange !== 'All Time' ? `Date Range: ${dateRange}` : '',
      searchQuery.trim() ? `Search: ${searchQuery.trim()}` : '',
    ].filter(Boolean);

    const rows = filteredDeals.length > 0
      ? filteredDeals.map((deal, index) => `
        <tr>
          <td class="text-center">${index + 1}</td>
          <td class="font-bold">${escapeHtml(deal.name || 'Untitled Deal')}</td>
          <td>${escapeHtml(deal.client || '—')}</td>
          <td>${escapeHtml(deal.phone || '—')}</td>
          <td class="text-center">
            <span class="stage-pill stage-${escapeHtml(deal.stage || 'Draft')}">
              ${escapeHtml(deal.stage || 'Draft')}
            </span>
          </td>
          <td>${escapeHtml(deal.product || '—')}</td>
          <td>${escapeHtml(deal.source || '—')}</td>
          <td>${escapeHtml(deal.assignedUser || '—')}</td>
          <td>${escapeHtml(deal.date || '—')}</td>
          <td class="text-right font-bold">${escapeHtml(formatPriceINR(deal.price))}</td>
        </tr>
      `).join('')
      : `
        <tr>
          <td colspan="10" class="empty-cell">
            No deals recorded matching the selected criteria.
          </td>
        </tr>
      `;

    const reportHtml = `
      <!doctype html>
      <html>
        <head>
          <title>Deals Report - OSCAR ERP</title>
          <style>
            @page {
              size: landscape;
              margin: 12mm 15mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 24px;
              background: #ffffff;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding-bottom: 14px;
              border-bottom: 2px solid #0284c7;
              margin-bottom: 14px;
            }
            .brand-title {
              font-size: 22px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 4px;
              letter-spacing: -0.02em;
            }
            .brand-subtitle {
              font-size: 13px;
              color: #64748b;
              margin: 0;
            }
            .meta-box {
              text-align: right;
              font-size: 12px;
              color: #475569;
              line-height: 1.6;
            }
            .meta-box strong {
              color: #0f172a;
            }
            .filter-bar {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 8px 14px;
              font-size: 11.5px;
              color: #475569;
              margin-bottom: 16px;
            }
            .filter-bar strong {
              color: #1e293b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11.5px;
              margin-top: 8px;
            }
            th {
              background: #f1f5f9;
              color: #334155;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              font-size: 10.5px;
              border: 1px solid #cbd5e1;
              padding: 9px 8px;
              text-align: left;
            }
            td {
              border: 1px solid #e2e8f0;
              padding: 8px;
              vertical-align: middle;
              color: #1e293b;
            }
            tr:nth-child(even) td {
              background: #fafafa;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .stage-pill {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 9999px;
              font-size: 10.5px;
              font-weight: 700;
              text-transform: capitalize;
            }
            .stage-Draft { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
            .stage-Sent { background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; }
            .stage-Open { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
            .stage-Won { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
            .stage-Lost { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }
            .empty-cell {
              text-align: center;
              padding: 32px 16px;
              color: #64748b;
              font-style: italic;
              font-size: 13px;
              background: #ffffff !important;
            }
            tfoot td {
              background: #f8fafc;
              border-top: 2px solid #94a3b8;
              font-weight: 700;
              padding: 10px 8px;
              font-size: 12px;
            }
            .footer {
              margin-top: 24px;
              padding-top: 10px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              color: #94a3b8;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="brand-title">Deals Report</h1>
              <p class="brand-subtitle">OSCAR ERP &bull; CRM Deals & Pipeline Tracking</p>
            </div>
            <div class="meta-box">
              <div>Printed on: <strong>${escapeHtml(today)}</strong></div>
              <div>Total Deals: <strong>${filteredDeals.length}</strong> | Total Value: <strong>${escapeHtml(formatPriceINR(summaryValue))}</strong></div>
            </div>
          </div>

          ${activeFilters.length > 0 ? `
            <div class="filter-bar">
              <strong>Active Filters:</strong> ${escapeHtml(activeFilters.join(' • '))}
            </div>
          ` : ''}

          <table>
            <thead>
              <tr>
                <th style="width: 40px;" class="text-center">#</th>
                <th>Deal Name</th>
                <th>Client</th>
                <th>Phone</th>
                <th style="width: 80px;" class="text-center">Stage</th>
                <th>Product</th>
                <th>Source</th>
                <th>Assigned User</th>
                <th style="width: 90px;">Date</th>
                <th style="width: 120px;" class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="font-bold">Total (${filteredDeals.length} Deals)</td>
                <td colspan="5"></td>
                <td class="text-right font-bold">${escapeHtml(formatPriceINR(summaryValue))}</td>
              </tr>
            </tfoot>
          </table>

          <div class="footer">
            <span>Generated via OSCAR ERP - CRM Module</span>
            <span>Confidential - For Internal Use Only</span>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 300);
    showNotification('Print report opened.');
  };

  const handleOpenEditModal = (deal) => {
    if (!linkedDealId) {
      handleOpenDealDetail(deal);
      return;
    }
    setEditingDeal(deal);
    setFormState({
      name: deal.name,
      price: deal.price,
      client: deal.client,
      phone: deal.phone ? (deal.phone.startsWith('+91') ? deal.phone : `+91 ${deal.phone}`) : '+91 ',
      product: deal.product || '',
      stage: deal.stage || 'Draft',
      source: deal.source || 'Website',
      assignedUser: deal.assignedUser || currentUser?.name || '',
      date: deal.date ?? '',
      tag: deal.tag || '',
    });
    setFormError('');
    setOpenMenuDealId(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenDealDetail = (deal) => {
    setIsCreateModalOpen(false);
    setEditingDeal(null);
    setOpenMenuDealId(null);
    setSearchParams({ deal: String(deal.id) });
  };

  const handleSaveDeal = (e) => {
    e.preventDefault();
    if (!formState.name.trim()) {
      setFormError('Deal name is required.');
      return;
    }
    if (!formState.client.trim()) {
      setFormError('Client name is required.');
      return;
    }
    if (!formState.phone.trim()) {
      setFormError('Phone number is required.');
      return;
    }

    const priceNum = Number(formState.price) || 0;
    const initials = getInitialsFromName(formState.client);
    const avatarColor = getAvatarColorFromName(formState.client);

    if (editingDeal) {
      const updatedFields = {
        name: formState.name.trim(),
        title: formState.name.trim(),
        price: priceNum,
        value: priceNum,
        client: formState.client.trim(),
        initials,
        avatarColor,
        phone: formState.phone.trim(),
        product: formState.product,
        stage: formState.stage,
        source: formState.source,
        assignedUser: formState.assignedUser,
        date: formState.date || editingDeal.date,
        tag: formState.tag || editingDeal.tag,
      };
      setDeals((prev) =>
        prev.map((d) =>
          d.id === editingDeal.id
            ? { ...d, ...updatedFields }
            : d
        )
      );
      useCrmStore.getState().updateRecord('deals', editingDeal.id, updatedFields).catch(console.warn);
      showNotification(`Deal "${formState.name.trim()}" updated successfully!`);
    } else {
      const newDeal = buildDeal(formState);
      setDeals((prev) => [newDeal, ...prev]);
      useCrmStore.getState().createRecord('deals', newDeal).catch((err) => {
        console.warn('[CRM Deals] Server save error:', err);
      });
      showNotification(`New deal "${newDeal.name}" added!`);
    }

    setIsCreateModalOpen(false);
    setEditingDeal(null);
  };

  const handleDeleteDeal = () => {
    if (!dealToDelete) return;
    const targetId = dealToDelete.id;
    setDeals((prev) => prev.filter((d) => d.id !== targetId));
    useCrmStore.getState().deleteRecord('deals', targetId).catch((err) => {
      console.warn('[CRM Deals] Server delete error:', err);
    });
    showNotification(`Deal "${dealToDelete.name}" deleted.`);
    setDealToDelete(null);
  };

  const handleMoveStage = (dealId, targetStage) => {
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? {
              ...d,
              stage: targetStage,
              tag: targetStage === 'Won' ? 'Won' : targetStage === 'Lost' ? 'Lost' : d.tag === 'Won' || d.tag === 'Lost' ? '' : d.tag,
            }
          : d
      )
    );
    setOpenMenuDealId(null);
    useCrmStore.getState().updateRecord('deals', dealId, { stage: targetStage }).catch((err) => {
      console.warn('[CRM Deals] Server stage update error:', err);
    });
    showNotification(`Deal moved to ${targetStage}`);
  };

  const handleCreateErpQuotation = (deal) => {
    const matchedCustomer = (customers || []).find((c) => 
      c.name?.toLowerCase() === deal.client?.toLowerCase() ||
      c.company?.toLowerCase() === deal.client?.toLowerCase()
    ) || (customers || [])[0];

    const dealAmount = Number(deal.price) || 0;
    const items = [
      {
        id: `item-${Date.now()}-1`,
        name: deal.product || deal.name || 'Custom Product / Service',
        description: `Generated from CRM Deal: ${deal.name}`,
        qty: 1,
        rate: dealAmount,
        amount: dealAmount,
      }
    ];

    const quote = addQuotation?.({
      customerId: matchedCustomer?.id,
      customer: deal.client || matchedCustomer?.name || '',
      dealId: String(deal.id || ''),
      dealName: deal.name || '',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      validUntil: '30 Days',
      amount: dealAmount,
      status: 'Draft',
      items,
      notes: `Created from CRM Deal: ${deal.name} (${deal.stage || 'Draft'})`,
    });

    setOpenMenuDealId(null);
    showNotification(`Quotation ${quote?.quoteNumber || ''} created in ERP!`);
    if (quote?.id) {
      navigate('/sales/quotations');
    }
  };

  const handleCreateErpSalesOrder = (deal) => {
    const matchedCustomer = (customers || []).find((c) => 
      c.name?.toLowerCase() === deal.client?.toLowerCase() ||
      c.company?.toLowerCase() === deal.client?.toLowerCase()
    ) || (customers || [])[0];

    const dealAmount = Number(deal.price) || 0;
    const items = [
      {
        id: `item-${Date.now()}-1`,
        name: deal.product || deal.name || 'Custom Product / Service',
        description: `Generated from CRM Deal: ${deal.name}`,
        qty: 1,
        orderedQty: 1,
        rate: dealAmount,
        amount: dealAmount,
      }
    ];

    const order = addSalesOrder?.({
      customerId: matchedCustomer?.id,
      customer: deal.client || matchedCustomer?.name || '',
      dealId: String(deal.id || ''),
      dealName: deal.name || '',
      amount: dealAmount,
      stage: deal.stage === 'Won' ? 'Confirmed' : 'Draft',
      status: deal.stage === 'Won' ? 'Confirmed' : 'Draft',
      items,
      notes: `Created from CRM Deal: ${deal.name}`,
    });

    setOpenMenuDealId(null);
    showNotification(`Sales Order ${order?.orderNumber || ''} created in ERP!`);
    if (order?.id) {
      navigate('/sales/orders');
    }
  };

  const toggleExpandColumn = (st) => {
    setExpandedColumns((prev) => ({
      ...prev,
      [st]: !prev[st],
    }));
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#0f172a] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {linkedDealId ? <DealDetailView key={linkedDealId} deal={deals.find((item) => String(item.id) === linkedDealId)} onEdit={handleOpenEditModal} onNotify={showNotification} onDelete={setDealToDelete} onUpdate={(patch) => {
        // Header fields reach `/crm/deals/` through an explicit update —
        // nested arrays have their own endpoints (wired in the view).
        const updated = loadDeals().map((item) => String(item.id) === linkedDealId ? { ...item, ...patch } : item);
        setDeals(updated);
        useCrmStore.getState().updateRecord('deals', linkedDealId, patch).catch((err) => {
          console.warn('[CRM Deals] Server update error:', err?.message || err);
        });
        window.dispatchEvent(new Event('crm:data-updated'));
      }} onDuplicate={(deal) => {
        const copy = buildDeal({ name: `${deal.name} (copy)`, client: deal.client, phone: deal.phone ? (deal.phone.startsWith('+91') ? deal.phone : `+91 ${deal.phone}`) : '+91 ', price: deal.price, product: deal.product, products: deal.products, source: deal.source, assignedUser: deal.assignedUser, team: deal.team, description: deal.description, stage: 'Draft', createdAt: new Date().toISOString() }, `dl-${crypto.randomUUID()}`);
        const updated = [copy, ...loadDeals()];
        setDeals(updated);
        useCrmStore.getState().createRecord('deals', copy).catch((err) => {
          console.warn('[CRM Deals] Server save error:', err?.message || err);
        });
        setSearchParams({ deal: copy.id });
        showNotification('Deal duplicated as a new draft.');
      }} /> : <>
      {/* Top Header Card */}
      <PageHeader
        title="Manage Deals"
        subtitle="Track pipeline stages, deal values, conversion rates, and client opportunities."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePrintDeals}
              className="btn-outline"
            >
              <Printer size={16} />
              <span>Print</span>
            </button>

            <button
              onClick={() => handleOpenCreateModal()}
              className="btn-primary"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Add Deal</span>
            </button>
          </div>
        }
      />



      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 my-4">
        <CrmKpiCard label="Total Deals" value={stats.totalDeals} icon={Handshake} tone="blue" />
        <CrmKpiCard label="Total Value" value={stats.totalValue} symbol="₹" tone="emerald" />
        <CrmKpiCard label="Won Deals" value={stats.wonDeals} icon={Trophy} tone="amber" />
        <CrmKpiCard label="Average Deal Size" value={stats.avgDealSize} icon={Clock} tone="purple" />
        <CrmKpiCard label="Conversion Rate" value={stats.conversionRate} icon={TrendingUp} tone="rose" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'border-blue-200 bg-blue-50 text-[#1f6bff]'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#1f6bff]">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <div className="text-[11px] font-medium text-slate-500">
                {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset Filters"
              className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <RotateCcw size={15} />
            </button>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid size={14} />
                <span>Kanban</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListIcon size={14} />
                <span>List</span>
              </button>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Product</label>
              <div className="relative">
                <Package size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {productOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Stage</label>
              <div className="relative">
                <Flag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All Stages">All Stages</option>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Source</label>
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {sourceOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Assigned User</label>
              <div className="relative">
                <UserRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {usersList.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date Range</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All Time">All Time</option>
                  <option value="Today">Today</option>
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="This Month">This Month</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="This Quarter">This Quarter</option>
                  <option value="This Year">This Year</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by deal name, client, phone, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Kanban Pipeline / List View */}
      {viewMode === 'kanban' ? (
        <div className={`flex snap-x snap-mandatory lg:grid ${gridClass} lg:snap-none gap-4 items-start overflow-x-auto pb-4 pt-1`}>
          {pipelineStages.map((column) => {
            const st = column.key;
            const items = filteredDeals.filter((d) => getEffectiveDealStage(d, quotations, allLeads) === st);
            const leadItems = column.isLost
              ? (leadsByStage.Lost || [])
              : (leadsByStage[st] || []);
            const stageStyle = getStageStyle(st);
            const StageIcon = stageStyle.icon;
            const totalStageAmount = items.reduce((sum, d) => sum + (Number(d.price) || 0), 0);
            const isExpanded = Boolean(expandedColumns[st]);
            const visibleItems = isExpanded ? items : items.slice(0, 3);
            const visibleLeadItems = isExpanded ? leadItems : leadItems.slice(0, 3);
            const remainingCount = items.length - 3;
            const recordCount = items.length + leadItems.length;

            return (
              <div
                key={st}
                className="min-w-[280px] max-w-[320px] shrink-0 lg:shrink snap-start lg:min-w-auto lg:max-w-none border rounded-2xl p-3.5 flex flex-col space-y-3 transition-all duration-200 shadow-2xs relative"
                style={{
                  backgroundColor: 'var(--soft, #edf2f8)',
                  borderColor: 'var(--border, #dce5f4)',
                }}
              >
                {/* Column Top Accent Strip */}
                <div className={`h-1 w-full rounded-full ${stageStyle.topBar}`} />

                {/* Column Header */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${stageStyle.iconColor}`}>
                      <StageIcon size={14} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">{stageStyle.title}</h3>
                      <p className="text-[11px] text-slate-500 font-medium truncate">
                        {formatColumnSummary(totalStageAmount, items.length, leadItems.length)}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[11px] ${stageStyle.countBadge}`}>
                    {recordCount}
                  </span>
                </div>


                {/* Deal Cards Container */}
                <div className="space-y-3 min-h-[120px]">
                  {recordCount === 0 ? (
                    <div
                      className="border border-dashed rounded-xl p-6 text-center"
                      style={{
                        backgroundColor: 'var(--card, #ffffff)',
                        borderColor: 'var(--border, #dce5f4)',
                      }}
                    >
                      <Inbox size={22} className="text-slate-300 mx-auto mb-1" />
                      <p className="text-xs font-medium text-slate-400">No deals in {st}</p>
                    </div>
                  ) : (
                    visibleItems.map((deal) => {
                      const isMenuOpen = openMenuDealId === deal.id;
                      return (
                        <div
                          key={deal.id}
                          tabIndex={0}
                          role="link"
                          aria-label={`View deal ${deal.name}`}
                          onClick={(event) => {
                            if (!event.target.closest('a, button, .deal-action-menu-container')) handleOpenDealDetail(deal);
                          }}
                          onKeyDown={(event) => {
                            if (event.target === event.currentTarget && event.key === 'Enter') handleOpenDealDetail(deal);
                          }}
                          className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer relative group space-y-2.5"
                        >
                          {/* Deal Header */}
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900 leading-snug truncate flex-1" title={deal.name}>
                              <Link to={`?deal=${encodeURIComponent(deal.id)}`} className="hover:text-blue-600 hover:underline">{deal.name}</Link>
                            </h4>

                            <div className="relative deal-action-menu-container flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuDealId((prev) => (prev === deal.id ? null : deal.id));
                                }}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                                  isMenuOpen
                                    ? 'bg-slate-200 text-slate-800'
                                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <MoreVertical size={14} />
                              </button>

                              {isMenuOpen && (
                                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDealDetail(deal)}
                                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                                  >
                                    <Edit2 size={13} className="text-blue-600" />
                                    <span>View Deal</span>
                                  </button>



                                  <div className="px-3.5 py-1 text-[10px] uppercase font-bold text-slate-400 border-t border-slate-100 mt-1">
                                    ERP Conversion
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCreateErpQuotation(deal)}
                                    className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <FileText size={12} className="text-blue-600" />
                                    <span>Create Quotation</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCreateErpSalesOrder(deal)}
                                    className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <ShoppingCart size={12} className="text-emerald-600" />
                                    <span>Create Sales Order</span>
                                  </button>

                                  <div className="my-1 border-t border-slate-100" />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDealToDelete(deal);
                                      setOpenMenuDealId(null);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer"
                                  >
                                    <Trash2 size={13} className="text-rose-500" />
                                    <span>Delete Deal</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Deal Value & Status Tag */}
                          <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-slate-900 tracking-tight">
                              {formatPriceINR(deal.price)}
                            </span>

                            {deal.tag && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  deal.tag === 'Won'
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                    : deal.tag === 'Lost'
                                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                                    : 'bg-rose-50 text-rose-600 border-rose-200'
                                }`}
                              >
                                {deal.tag}
                              </span>
                            )}
                          </div>

                          {/* Product Pill */}
                          {deal.product && (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md truncate max-w-full">
                                <Tag size={10} className="text-slate-400 flex-shrink-0" />
                                <span className="truncate">{deal.product}</span>
                              </span>
                            </div>
                          )}

                          {/* Divider & Metadata Footer */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] flex-shrink-0 ${
                                  deal.avatarColor || 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {deal.initials || 'CL'}
                              </div>
                              <span className="truncate font-medium text-slate-600 text-[11px]">{deal.client}</span>
                            </div>

                            <div className="flex items-center gap-1 text-[11px] text-slate-400 flex-shrink-0">
                              <Calendar size={11} className="text-slate-400" />
                              <span>{deal.date}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Leads in this stage -- read-only cards with Lead badge */}
                  {visibleLeadItems.map((lead) => {
                    const leadTone = {
                      Draft: {
                        card: 'bg-blue-50/40 border-dashed border-blue-200 hover:border-blue-400',
                        link: 'hover:text-blue-700',
                        badge: 'bg-white text-blue-700 border-blue-200',
                        metaBorder: 'border-blue-100',
                      },
                      Sent: {
                        card: 'bg-purple-50/40 border-dashed border-purple-200 hover:border-purple-400',
                        link: 'hover:text-purple-700',
                        badge: 'bg-white text-purple-700 border-purple-200',
                        metaBorder: 'border-purple-100',
                      },
                      Open: {
                        card: 'bg-amber-50/40 border-dashed border-amber-200 hover:border-amber-400',
                        link: 'hover:text-amber-700',
                        badge: 'bg-white text-amber-700 border-amber-200',
                        metaBorder: 'border-amber-100',
                      },
                      Won: {
                        card: 'bg-emerald-50/40 border-dashed border-emerald-200 hover:border-emerald-400',
                        link: 'hover:text-emerald-700',
                        badge: 'bg-white text-emerald-700 border-emerald-200',
                        metaBorder: 'border-emerald-100',
                      },
                      Lost: {
                        card: 'bg-rose-50/40 border-dashed border-rose-200 hover:border-rose-400',
                        link: 'hover:text-rose-700',
                        badge: 'bg-white text-rose-600 border-rose-200',
                        metaBorder: 'border-rose-100',
                      },
                    }[st] || {
                      card: 'bg-slate-50/50 border-dashed border-slate-200 hover:border-slate-400',
                      link: 'hover:text-slate-800',
                      badge: 'bg-white text-slate-700 border-slate-200',
                      metaBorder: 'border-slate-100',
                    };

                    return (
                      <div
                        key={`lead-${lead.id}`}
                        className={`${leadTone.card} rounded-xl p-3.5 space-y-2.5 transition-colors`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-slate-900 leading-snug truncate flex-1" title={lead.name}>
                            <Link to={`/crm/leads/${encodeURIComponent(lead.id)}`} className={`${leadTone.link} hover:underline`}>
                              {lead.name}
                            </Link>
                          </h4>
                          <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${leadTone.badge}`}>
                            Lead
                          </span>
                        </div>

                        {lead.company && (
                          <div>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-white border ${leadTone.metaBorder} px-2 py-0.5 rounded-md truncate max-w-full`}>
                              <Building2 size={10} className="text-slate-400 flex-shrink-0" />
                              <span className="truncate">{lead.company}</span>
                            </span>
                          </div>
                        )}

                        <div className={`flex items-center justify-between gap-2 pt-2 border-t ${leadTone.metaBorder} text-xs text-slate-500`}>
                          <span className="truncate">
                            {lead.phone || lead.email || 'No contact'}
                          </span>
                          {lead.lostReason && column.isLost && (
                            <span className="text-[11px] text-rose-500 flex-shrink-0 truncate max-w-[45%]">
                              {lead.lostReason}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Show More/Less Button */}
                {remainingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleExpandColumn(st)}
                    className="w-full py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50/50 rounded-xl transition-colors text-center cursor-pointer"
                  >
                    {isExpanded ? 'Show less' : `+ ${remainingCount} more deals`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] lg:min-w-0 text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Deal Name</th>
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">Stage</th>
                  <th className="py-3.5 px-4 text-right">Value (₹)</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDeals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900"><Link to={`?deal=${encodeURIComponent(deal.id)}`} className="hover:text-blue-600 hover:underline">{deal.name}</Link></td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${
                            deal.avatarColor || 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {deal.initials || 'CL'}
                        </div>
                        <span className="font-medium text-slate-700">{deal.client}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{deal.product}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          getStageStyle(deal.stage).headerBadge
                        }`}
                      >
                        {deal.stage}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatPriceINR(deal.price)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{deal.date}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCreateErpQuotation(deal)}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 cursor-pointer"
                          title="Create Quotation in ERP"
                          aria-label={`Create quotation for ${deal.name}`}
                        >
                          <FileText size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCreateErpSalesOrder(deal)}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 cursor-pointer"
                          title="Create Sales Order in ERP"
                          aria-label={`Create sales order for ${deal.name}`}
                        >
                          <ShoppingCart size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenDealDetail(deal)}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 cursor-pointer"
                          title="View Deal"
                          aria-label={`View deal ${deal.name}`}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDealToDelete(deal)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Leads represented in the pipeline */}
                {Object.entries(leadsByStage).flatMap(([st, stageLeads]) => {
                  if (selectedStage !== 'All Stages' && selectedStage !== st) return [];
                  const tone = {
                    Draft: { row: 'bg-blue-50/30 hover:bg-blue-50/60', badge: 'bg-white text-blue-700 border-blue-200', btn: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
                    Sent: { row: 'bg-purple-50/30 hover:bg-purple-50/60', badge: 'bg-white text-purple-700 border-purple-200', btn: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
                    Open: { row: 'bg-amber-50/30 hover:bg-amber-50/60', badge: 'bg-white text-amber-700 border-amber-200', btn: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
                    Won: { row: 'bg-emerald-50/30 hover:bg-emerald-50/60', badge: 'bg-white text-emerald-700 border-emerald-200', btn: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
                    Lost: { row: 'bg-rose-50/30 hover:bg-rose-50/60', badge: 'bg-white text-rose-600 border-rose-200', btn: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
                  }[st] || { row: 'bg-slate-50/30 hover:bg-slate-50/60', badge: 'bg-white text-slate-700 border-slate-200', btn: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' };

                  return stageLeads.map((lead) => (
                    <tr key={`lead-${st}-${lead.id}`} className={`${tone.row} transition-colors`}>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <Link to={`/crm/leads/${encodeURIComponent(lead.id)}`} className="hover:underline">
                          {lead.name}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${
                              lead.avatarColor || 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {(lead.name || '?').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-700">{lead.company || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">—</td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${tone.badge}`}>
                          {st} · Lead
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400">—</td>
                      <td className="py-3.5 px-4 text-slate-500">{lead.phone || lead.email || '—'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/crm/leads/${encodeURIComponent(lead.id)}`}
                          className={`inline-flex p-1.5 ${tone.btn} rounded-lg border`}
                          title="View Lead"
                          aria-label={`View lead ${lead.name}`}
                        >
                          <Edit2 size={13} />
                        </Link>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100">
            <AppPagination
              total={filteredDeals.length}
              page={listPage}
              pageSize={listPageSize}
              onPageChange={setListPage}
              onPageSizeChange={setListPageSize}
              pageSizeOptions={[10, 20, 50]}
              bordered={false}
            />
          </div>
        </div>
      )}

      </>}


      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-100 my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingDeal ? 'Edit Deal' : 'Create New Deal'}
                {editingDeal?.leadId != null && <Link className="ml-3 text-xs text-blue-600 hover:underline" to={`/crm/leads/${editingDeal.leadId}`}>Source Lead: {editingDeal.leadNumber || editingDeal.leadId} - View Lead</Link>}
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>


            {formError && (
              <div className="m-5 mb-0 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle size={14} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDeal} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Deal Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cotton Grey Fabric Order"
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Client Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Industries"
                    value={formState.client}
                    onChange={(e) => setFormState({ ...formState, client: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 98765 43210"
                    value={formState.phone}
                    onChange={(e) => {
                      let v = e.target.value;
                      if (!v || v === '+' || v.trim() === '') {
                        setFormState({ ...formState, phone: '+91 ' });
                        return;
                      }
                      if (!v.startsWith('+91')) {
                        const cleaned = v.replace(/^\+?91\s*/, '');
                        setFormState({ ...formState, phone: `+91 ${cleaned}` });
                        return;
                      }
                      setFormState({ ...formState, phone: v });
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 500000"
                    value={formState.price}
                    onChange={(e) => setFormState({ ...formState, price: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Product</label>
                  <select
                    value={formState.product}
                    onChange={(e) => setFormState({ ...formState, product: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                  >
                    {productOptions.filter((p) => p !== 'All Products').map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Stage</label>
                  <select
                    value={formState.stage}
                    onChange={(e) => setFormState({ ...formState, stage: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Source</label>
                    <MasterSourceLink source="leadSources" />
                  </div>
                  <select
                    value={formState.source}
                    onChange={(e) => setFormState({ ...formState, source: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                  >
                    <option value="">Select Source</option>
                    {formState.source && !sourceOptions.includes(formState.source) && (
                      <option value={formState.source}>{formState.source}</option>
                    )}
                    {sourceOptions.filter((s) => s !== 'All Sources').map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Assigned User</label>
                    <MasterSourceLink source="users" />
                  </div>
                  <select
                    value={formState.assignedUser}
                    onChange={(e) => setFormState({ ...formState, assignedUser: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                  >
                    {usersList.filter((u) => u !== 'All Users').map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1f6bff] hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition-all"
                >
                  {editingDeal ? 'Save Changes' : 'Create Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {dealToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 max-h-[95vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Deal?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong>{dealToDelete.name}</strong>? This action will remove this deal from the sales pipeline.
            </p>

            <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setDealToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDeal}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-xs"
              >
                Yes, Delete Deal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
