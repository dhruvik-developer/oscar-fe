import DealDetailView from './DealDetailView';
import CrmKpiCard from '../common/CrmKpiCard';
import Modal from '../../../components/ui/Modal';
import PageHeader from '../../../components/ui/PageHeader';
import MasterSourceLink from '../../../components/common/MasterSourceLink';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  ChevronLeft,
  ChevronRight,
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

const FALLBACK_STAGES = ['Draft', 'Won', 'Lost'];

const LOST_STAGE_PATTERN = /lost|closed|declined/i;

const STAGE_STYLES = {
  Draft: {
    title: 'Draft',
    icon: FileText,
    iconColor: 'bg-blue-50 text-blue-600 border border-blue-200',
    topBar: 'bg-blue-500',
    headerBadge: 'bg-blue-50 text-blue-700 border border-blue-200',
    countBadge: 'bg-blue-50 text-blue-700 border border-blue-200 font-bold',
    accentColor: 'text-blue-600',
    dropBorder: 'ring-2 ring-blue-500/50 border-blue-400 bg-blue-50/20',
  },
  Won: {
    title: 'Won',
    icon: CheckCircle2,
    iconColor: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    topBar: 'bg-emerald-500',
    headerBadge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    countBadge: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold',
    accentColor: 'text-emerald-600',
    dropBorder: 'ring-2 ring-emerald-500/50 border-emerald-400 bg-emerald-50/20',
  },
  Lost: {
    title: 'Lost',
    icon: XCircle,
    iconColor: 'bg-rose-50 text-rose-600 border border-rose-200',
    topBar: 'bg-rose-500',
    headerBadge: 'bg-rose-50 text-rose-700 border border-rose-200',
    countBadge: 'bg-rose-50 text-rose-700 border border-rose-200 font-bold',
    accentColor: 'text-rose-600',
    dropBorder: 'ring-2 ring-rose-500/50 border-rose-400 bg-rose-50/20',
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

function getProductLabel(product) {
  if (typeof product === 'string') return product.trim();
  if (!product || typeof product !== 'object') return '';
  return String(
    product.productName || product.fabricQuality || product.name ||
    product.product || product.itemName || product.fabric || '',
  ).trim();
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

function getEffectiveDealStage(deal) {
  if (!deal) return 'Draft';
  const stage = String(deal.stage || '').trim();
  if (stage === 'Won' || deal.tag === 'Won') return 'Won';
  if (stage === 'Lost' || deal.tag === 'Lost' || LOST_STAGE_PATTERN.test(stage)) return 'Lost';
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
  const [listPageSize, setListPageSize] = useState(5);
  const [columnPages, setColumnPages] = useState({});
  const [columnPageSizes, setColumnPageSizes] = useState({});
  const [draggedDealId, setDraggedDealId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [savingDealId, setSavingDealId] = useState(null);
  const isDraggingRef = useRef(false);

  const [expandedColumns, setExpandedColumns] = useState({});
  const [dealMenu, setDealMenu] = useState(null); // { deal, top, left }
  const DEAL_MENU_WIDTH = 180;

  const handleToggleDealMenu = (e, deal) => {
    e.stopPropagation();
    if (dealMenu?.deal?.id === deal.id) {
      setDealMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 185;
    const openUp = rect.bottom + menuHeight > window.innerHeight;
    setDealMenu({
      deal,
      top: openUp ? Math.max(8, rect.top - menuHeight) : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.right - DEAL_MENU_WIDTH, window.innerWidth - DEAL_MENU_WIDTH - 8)),
    });
  };

  const closeDealMenu = () => setDealMenu(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [dealToDelete, setDealToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const [formState, setFormState] = useState(EMPTY_DEAL_FORM);
  const [formError, setFormError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!dealMenu) return;
    const handleOutside = (e) => {
      if (!e.target.closest?.('.deal-floating-menu') && !e.target.closest?.('.deal-menu-trigger-btn')) {
        closeDealMenu();
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') closeDealMenu();
    };
    const handleScroll = (e) => {
      if (e.target?.closest?.('.deal-floating-menu')) return;
      closeDealMenu();
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [dealMenu]);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Assignable users from the CRM team roster, plus any name already on a deal
  // so the filter can still find deals assigned to someone no longer listed.
  const crmSources = useCrmStore((s) => s.sources);
  const { items = [], fabrics = [] } = useERP() || {};

  const getDealSource = (deal) => {
    if (deal?.source) return deal.source;
    const linkedLead = (allLeads || []).find(
      (l) => (deal?.leadId && String(l.id) === String(deal.leadId)) ||
             (deal?.name && String(l.name).trim().toLowerCase() === String(deal.name).trim().toLowerCase())
    );
    return linkedLead?.source || linkedLead?.customValues?.fields?.['lead-source'] || linkedLead?.customValues?.source || '';
  };

  const getDealProduct = (deal) => {
    const savedProduct = getProductLabel(deal?.product) ||
      getProductLabel(Array.isArray(deal?.products) ? deal.products[0] : '');
    if (savedProduct) return savedProduct;
    const linkedLead = (allLeads || []).find(
      (l) => (deal?.leadId && String(l.id) === String(deal.leadId)) ||
             (deal?.name && String(l.name).trim().toLowerCase() === String(deal.name).trim().toLowerCase())
    );
    const prods = linkedLead?.products || linkedLead?.customValues?.products || linkedLead?.customValues?.fields?.products;
    if (Array.isArray(prods) && prods.length > 0) return getProductLabel(prods[0]);
    return getProductLabel(prods);
  };

  const getDealUser = (deal) => {
    if (deal?.assignedUser) return deal.assignedUser;
    if (deal?.ownerName) return deal.ownerName;
    const linkedLead = (allLeads || []).find(
      (l) => (deal?.leadId && String(l.id) === String(deal.leadId)) ||
             (deal?.name && String(l.name).trim().toLowerCase() === String(deal.name).trim().toLowerCase())
    );
    return linkedLead?.ownerName || linkedLead?.owner || '';
  };

  // Merge any fresh or unsynced leads into deals so newly created leads
  // immediately show up as full draggable cards in the Draft column.
  const combinedDeals = useMemo(() => {
    const existingLeadIds = new Set(
      (deals || []).map((d) => String(d.leadId)).filter(Boolean)
    );
    const existingDealNames = new Set(
      (deals || []).map((d) => (d.name || d.title || '').trim().toLowerCase()).filter(Boolean)
    );

    const synthesized = [];
    (allLeads || []).forEach((lead) => {
      if (!lead || !lead.id) return;
      const sId = String(lead.id);
      const sName = (lead.name || '').trim().toLowerCase();
      if (existingLeadIds.has(sId) || (sName && existingDealNames.has(sName))) return;

      const isLost = lead.isLost || lead.status === 'Lost' || (lead.stage && (lead.stage.is_lost ?? lead.stage.isLost));
      const isWon = lead.isConverted || Boolean(lead.convertedAt) || (lead.stage && (lead.stage.is_won ?? lead.stage.isWon));
      const st = isLost ? 'Lost' : (isWon ? 'Won' : 'Draft');
      const prods = lead.products || lead.customValues?.products || lead.customValues?.fields?.products;
      const prod = Array.isArray(prods) && prods.length > 0 ? getProductLabel(prods[0]) : getProductLabel(prods);

      synthesized.push({
        id: `lead-deal-${lead.id}`,
        realLeadId: lead.id,
        leadId: lead.id,
        isFromLead: true,
        name: lead.name || 'Untitled Lead',
        title: lead.name || 'Untitled Lead',
        client: lead.company || lead.name || '—',
        phone: lead.phone || '',
        price: Number(lead.amount) || 0,
        value: Number(lead.amount) || 0,
        stage: st,
        tag: st === 'Won' ? 'Won' : (st === 'Lost' ? 'Lost' : ''),
        product: prod,
        assignedUser: lead.ownerName || lead.owner || '',
        date: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
      });
    });

    return [...deals, ...synthesized];
  }, [deals, allLeads]);

  const pipelineStages = useMemo(() => [
    { key: 'Draft', order: 1, isWon: false, isLost: false },
    { key: 'Won', order: 2, isWon: true, isLost: false },
    { key: 'Lost', order: 3, isWon: false, isLost: true },
  ], []);

  const STAGES = useMemo(() => ['Draft', 'Won', 'Lost'], []);

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
    (combinedDeals || []).forEach((d) => {
      const prod = getDealProduct(d);
      if (prod) list.add(prod);
      if (Array.isArray(d.products)) d.products.forEach((p) => {
        const name = getProductLabel(p);
        if (name) list.add(name);
      });
    });
    (allLeads || []).forEach((l) => {
      const prods = l.products || l.customValues?.products || l.customValues?.fields?.products;
      if (Array.isArray(prods)) prods.forEach((p) => {
        const name = getProductLabel(p);
        if (name) list.add(name);
      });
      else {
        const name = getProductLabel(prods);
        if (name) list.add(name);
      }
    });
    if (list.size === 0) {
      (TEXTILE_FABRIC_OPTIONS || []).forEach((p) => list.add(p));
    }
    return ['All Products', ...Array.from(list).sort((a, b) => a.localeCompare(b))];
  }, [items, fabrics, combinedDeals, allLeads]);

  const sourceOptions = useMemo(() => {
    const list = new Set();
    (Array.isArray(crmSources) ? crmSources : []).forEach((s) => {
      const name = typeof s === 'string' ? s : s?.name;
      if (name) list.add(String(name).trim());
    });
    (combinedDeals || []).forEach((d) => {
      const s = getDealSource(d);
      if (s) list.add(String(s).trim());
    });
    (allLeads || []).forEach((l) => {
      const s = l.source || l.customValues?.fields?.['lead-source'] || l.customValues?.source;
      if (s) list.add(String(s).trim());
    });
    return ['All Sources', ...Array.from(list).sort((a, b) => a.localeCompare(b))];
  }, [crmSources, combinedDeals, allLeads]);

  const usersList = useMemo(() => {
    const names = new Set();
    (Array.isArray(teamMembers) ? teamMembers : []).forEach((m) => m?.name && names.add(m.name));
    (combinedDeals || []).forEach((d) => {
      const u = getDealUser(d);
      if (u) names.add(u);
    });
    return ['All Users', ...[...names].sort((a, b) => a.localeCompare(b))];
  }, [teamMembers, combinedDeals, allLeads]);

  const filteredDeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return combinedDeals.filter((d) => {
      const dealStage = d.stage || 'Draft';
      const dealProduct = getDealProduct(d);
      const dealSource = getDealSource(d);
      const dealUser = getDealUser(d);

      if (selectedProduct !== 'All Products' && dealProduct !== selectedProduct) return false;
      if (selectedStage !== 'All Stages' && dealStage !== selectedStage) return false;
      if (selectedSource !== 'All Sources' && dealSource !== selectedSource) return false;
      if (selectedUser !== 'All Users' && dealUser !== selectedUser) return false;
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
      if (q && !`${d.name} ${d.client} ${d.phone} ${dealProduct} ${dealSource} ${dealUser}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [combinedDeals, searchQuery, selectedProduct, selectedStage, selectedSource, selectedUser, dateRange]);

  const stats = useMemo(() => {
    const totalDeals = combinedDeals.length;
    const totalValueNum = combinedDeals.reduce((sum, d) => sum + (Number(d.price ?? d.value) || 0), 0);
    const wonDeals = combinedDeals.filter((d) => d.stage === 'Won').length;
    const avgDealSizeNum = totalDeals > 0 ? totalValueNum / totalDeals : 0;
    const conversionRateNum = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;
    const fmt = (n) => '₹ ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

    return {
      totalDeals,
      totalValue: fmt(totalValueNum),
      wonDeals,
      avgDealSize: fmt(avgDealSizeNum),
      conversionRate: conversionRateNum.toFixed(1) + '%',
    };
  }, [combinedDeals]);

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
          <td>${escapeHtml(deal.product || getDealProduct(deal) || '—')}</td>
          <td>${escapeHtml(deal.source || getDealSource(deal) || '—')}</td>
          <td>${escapeHtml(deal.assignedUser || getDealUser(deal) || '—')}</td>
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
              size: A4 landscape;
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
      product: getDealProduct(deal),
      stage: deal.stage || 'Draft',
      source: deal.source || 'Website',
      assignedUser: deal.assignedUser || currentUser?.name || '',
      date: deal.date ?? '',
      tag: deal.tag || '',
    });
    setFormError('');
    closeDealMenu();
    setIsCreateModalOpen(true);
  };

  const handleOpenDealDetail = (deal) => {
    setIsCreateModalOpen(false);
    setEditingDeal(null);
    closeDealMenu();
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

  const handleMoveStage = async (dealId, targetStage, previousStage, extraData) => {
    const prevDeal = combinedDeals.find((d) => String(d.id) === String(dealId));
    const oldStage = previousStage || prevDeal?.stage || 'Draft';
    if (oldStage === targetStage) return;

    // 1. Optimistic update in deals
    setDeals((prev) => {
      const exists = prev.some((d) => String(d.id) === String(dealId));
      if (exists) {
        return prev.map((d) =>
          String(d.id) === String(dealId)
            ? {
                ...d,
                stage: targetStage,
                tag: targetStage === 'Won' ? 'Won' : targetStage === 'Lost' ? 'Lost' : '',
              }
            : d
        );
      } else if (prevDeal) {
        return [
          {
            ...prevDeal,
            stage: targetStage,
            tag: targetStage === 'Won' ? 'Won' : targetStage === 'Lost' ? 'Lost' : '',
          },
          ...prev,
        ];
      }
      return prev;
    });

    closeDealMenu();
    setSavingDealId(dealId);

    try {
      if (prevDeal?.isFromLead || String(dealId).startsWith('lead-deal-')) {
        const leadId = prevDeal?.realLeadId || extraData?.realLeadId;
        const res = await api.get(`/crm/deals/?leadId=${leadId}`);
        const existing = res?.data?.results || res?.data || [];
        if (existing.length > 0) {
          const actualDeal = existing[0];
          await api.patch(`/crm/deals/${actualDeal.id}/`, { stage: targetStage });
        } else {
          await api.post('/crm/deals/', {
            leadId,
            title: prevDeal?.name || 'Deal',
            stage: targetStage,
            value: prevDeal?.price || 0,
          });
        }
      } else {
        await api.patch(`/crm/deals/${dealId}/`, { stage: targetStage });
        await useCrmStore.getState().updateRecord('deals', dealId, { stage: targetStage });
      }

      if (prevDeal?.leadId || prevDeal?.realLeadId) {
        const leadId = prevDeal.leadId || prevDeal.realLeadId;
        if (targetStage === 'Lost') {
          useCrmStore.getState().updateRecord('leads', leadId, { status: 'Lost', isLost: true, isConverted: false }).catch(() => {});
        } else if (targetStage === 'Won') {
          useCrmStore.getState().updateRecord('leads', leadId, { status: 'Won', isLost: false, isConverted: true, lostReason: null }).catch(() => {});
        } else if (targetStage === 'Draft') {
          useCrmStore.getState().updateRecord('leads', leadId, { status: 'Draft', isLost: false, isConverted: false, lostReason: null }).catch(() => {});
        }
      }

      await Promise.all([
        useCrmStore.getState().refresh('deals').catch(() => {}),
        useCrmStore.getState().refresh('leads').catch(() => {}),
      ]);

      showNotification(`Deal moved to ${targetStage}`);
    } catch (err) {
      console.error('[CRM Deals] Server stage update error:', err);
      // Rollback
      setDeals((prev) =>
        prev.map((d) =>
          String(d.id) === String(dealId)
            ? { ...d, stage: oldStage, tag: oldStage === 'Won' ? 'Won' : oldStage === 'Lost' ? 'Lost' : '' }
            : d
        )
      );
      showNotification(`Failed to move deal to ${targetStage}: ${err?.message || 'Server error'}`);
    } finally {
      setSavingDealId(null);
    }
  };

  const handleDragStart = (e, deal) => {
    isDraggingRef.current = true;
    setDraggedDealId(deal.id);
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        dealId: deal.id,
        sourceStage: deal.stage || 'Draft',
        realLeadId: deal.realLeadId || deal.leadId,
        isFromLead: Boolean(deal.isFromLead),
      })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedDealId(null);
    setDragOverStage(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  const handleDragOver = (e, st) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== st) setDragOverStage(st);
  };

  const handleDragEnter = (e, st) => {
    e.preventDefault();
    setDragOverStage(st);
  };

  const handleDragLeave = (e, st) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dragOverStage === st) setDragOverStage(null);
    }
  };

  const handleDrop = (e, st) => {
    e.preventDefault();
    setDragOverStage(null);
    let data = null;
    try {
      data = JSON.parse(e.dataTransfer.getData('application/json'));
    } catch {
      data = { dealId: draggedDealId };
    }
    const dealId = data?.dealId || draggedDealId;
    const sourceStage = data?.sourceStage;
    if (dealId && st !== sourceStage) {
      handleMoveStage(dealId, st, sourceStage, data);
    }
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  // [Quotation & Proforma Invoice modules are commented out] — kept for when the module returns; no button calls it now.
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

    closeDealMenu();
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
      // The order links the lead itself (no quotation), so the lead's agreed
      // broker / salesperson terms reach its invoices.
      leadId: deal.leadId ? String(deal.leadId) : undefined,
      amount: dealAmount,
      stage: deal.stage === 'Won' ? 'Confirmed' : 'Draft',
      status: deal.stage === 'Won' ? 'Confirmed' : 'Draft',
      items,
      notes: `Created from CRM Deal: ${deal.name}`,
    });

    closeDealMenu();
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

      {linkedDealId ? <DealDetailView key={linkedDealId} deal={deals.find((item) => String(item.id) === linkedDealId)} onEdit={handleOpenEditModal} onNotify={showNotification} onDelete={setDealToDelete} onMoveStage={handleMoveStage} onUpdate={(patch) => {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start pb-4 pt-1">
          {pipelineStages.map((column) => {
            const st = column.key;
            const items = filteredDeals.filter((d) => (d.stage || 'Draft') === st);
            const stageStyle = getStageStyle(st);
            const StageIcon = stageStyle.icon;
            const totalStageAmount = items.reduce((sum, d) => sum + (Number(d.price ?? d.value) || 0), 0);
            
            // Per-stage column pagination starting at 5 (Draft, Won, Lost)
            const rawPageSize = columnPageSizes[st] ?? 5;
            const pageSize = rawPageSize === 'all' ? Math.max(1, items.length) : Number(rawPageSize);
            const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
            const currentPage = Math.min(Math.max(1, columnPages[st] || 1), totalPages);

            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = Math.min(startIndex + pageSize, items.length);
            const visibleItems = rawPageSize === 'all' ? items : items.slice(startIndex, endIndex);

            const startRecord = items.length === 0 ? 0 : startIndex + 1;
            const endRecord = endIndex;
            const recordCount = items.length;
            const isDragOver = dragOverStage === st;

            return (
              <div
                key={st}
                onDragOver={(e) => handleDragOver(e, st)}
                onDragEnter={(e) => handleDragEnter(e, st)}
                onDragLeave={(e) => handleDragLeave(e, st)}
                onDrop={(e) => handleDrop(e, st)}
                className={`border rounded-2xl p-3.5 flex flex-col space-y-3 transition-all duration-200 shadow-2xs relative ${
                  isDragOver ? stageStyle.dropBorder : ''
                }`}
                style={{
                  backgroundColor: isDragOver ? undefined : 'var(--soft, #edf2f8)',
                  borderColor: isDragOver ? undefined : 'var(--border, #dce5f4)',
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
                        {formatStageSummary(totalStageAmount, items.length)}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[11px] ${stageStyle.countBadge}`}>
                    {recordCount}
                  </span>
                </div>

                {/* Drag Drop indicator placeholder when hovering column */}
                {isDragOver && draggedDealId && (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl py-3 px-4 bg-white/70 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-2 animate-pulse">
                    <span className={`w-2 h-2 rounded-full ${stageStyle.topBar}`} />
                    <span>Drop deal here into {st}</span>
                  </div>
                )}

                {/* Deal Cards Container */}
                <div className="space-y-3 min-h-[120px]">
                  {recordCount === 0 && !isDragOver ? (
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
                      const isDraggingThis = draggedDealId === deal.id;
                      const isSavingThis = savingDealId === deal.id;
                      const dealUser = getDealUser(deal);
                      const dealProd = getDealProduct(deal);

                      return (
                        <div
                          key={deal.id}
                          tabIndex={0}
                          role="button"
                          draggable={!isSavingThis}
                          onDragStart={(e) => handleDragStart(e, deal)}
                          onDragEnd={handleDragEnd}
                          aria-label={`View deal ${deal.name}`}
                          onClick={(event) => {
                            if (isDraggingRef.current) return;
                            if (!event.target.closest('a, button, .deal-action-menu-container, .deal-menu-trigger-btn')) {
                              handleOpenDealDetail(deal);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.target === event.currentTarget && event.key === 'Enter') handleOpenDealDetail(deal);
                          }}
                          className={`bg-white border rounded-xl p-3.5 shadow-2xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing relative group space-y-2.5 ${
                            isDraggingThis
                              ? 'opacity-40 scale-[0.98] ring-2 ring-blue-400 border-dashed border-blue-400 shadow-none'
                              : 'border-slate-200 hover:border-blue-400'
                          }`}
                        >
                          {isSavingThis && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-2xs rounded-xl flex items-center justify-center z-20 text-xs font-bold text-slate-700 gap-2">
                              <RotateCcw size={14} className="animate-spin text-blue-600" />
                              <span>Saving...</span>
                            </div>
                          )}

                          {/* Deal Header */}
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900 leading-snug truncate flex-1" title={deal.name}>
                              <Link
                                to={`?deal=${encodeURIComponent(deal.id)}`}
                                onClick={(e) => {
                                  if (isDraggingRef.current) e.preventDefault();
                                }}
                                className="hover:text-blue-600 hover:underline"
                              >
                                {deal.name}
                              </Link>
                            </h4>

                            <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => handleToggleDealMenu(e, deal)}
                                className={`deal-menu-trigger-btn w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                                  dealMenu?.deal?.id === deal.id
                                    ? "bg-slate-200 text-slate-800"
                                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                <MoreVertical size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Deal Value & Status Tag */}
                          <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-slate-900 tracking-tight">
                              {formatPriceINR(deal.price ?? deal.value)}
                            </span>

                            {deal.tag && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  deal.tag === 'Won'
                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                    : 'bg-rose-50 text-rose-600 border-rose-200'
                                }`}
                              >
                                {deal.tag}
                              </span>
                            )}
                          </div>

                          {/* Product Pill */}
                          {dealProd && (
                            <div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md truncate max-w-full">
                                <Tag size={10} className="text-slate-400 flex-shrink-0" />
                                <span className="truncate">{dealProd}</span>
                              </span>
                            </div>
                          )}

                          {/* Divider & Metadata Footer */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] flex-shrink-0 ${
                                  deal.avatarColor || getAvatarColorFromName(deal.client) || 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {deal.initials || getInitialsFromName(deal.client) || 'CL'}
                              </div>
                              <span className="truncate font-medium text-slate-600 text-[11px]">{deal.client || '—'}</span>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {dealUser && (
                                <div className="flex items-center gap-1 text-[11px] text-slate-500 max-w-[90px] truncate" title={`Owner: ${dealUser}`}>
                                  <UserRound size={11} className="text-slate-400 flex-shrink-0" />
                                  <span className="truncate">{dealUser}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Calendar size={11} className="text-slate-400" />
                                <span>{deal.date || '—'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Column Pagination Controls (Draft, Won, Lost - Starts at 5) */}
                {recordCount > 0 && (
                  <div className="pt-2.5 mt-auto border-t border-slate-200/80 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>
                        Showing <strong className="text-slate-700 font-semibold">{startRecord}–{endRecord}</strong> of <strong className="text-slate-700 font-semibold">{recordCount}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">Per page:</span>
                        <select
                          value={rawPageSize}
                          onChange={(e) => {
                            const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                            setColumnPageSizes(prev => ({ ...prev, [st]: val }));
                            setColumnPages(prev => ({ ...prev, [st]: 1 }));
                          }}
                          className="text-[11px] font-semibold bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value="all">All</option>
                        </select>
                      </div>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-1 pt-1">
                        <button
                          type="button"
                          disabled={currentPage <= 1}
                          onClick={() => setColumnPages(prev => ({ ...prev, [st]: Math.max(1, currentPage - 1) }))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                          title="Previous page"
                        >
                          <ChevronLeft size={13} />
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setColumnPages(prev => ({ ...prev, [st]: pageNum }))}
                            className={`w-7 h-7 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-2xs ${
                              pageNum === currentPage
                                ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        ))}

                        <button
                          type="button"
                          disabled={currentPage >= totalPages}
                          onClick={() => setColumnPages(prev => ({ ...prev, [st]: Math.min(totalPages, currentPage + 1) }))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                          title="Next page"
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
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
                {filteredDeals.slice((listPage - 1) * listPageSize, listPage * listPageSize).map((deal) => (
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
                    <td className="py-3.5 px-4 text-slate-600">{deal.product || getDealProduct(deal)}</td>
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
                        {/* [Quotation & Proforma Invoice modules are commented out]
                        <button
                          type="button"
                          onClick={() => handleCreateErpQuotation(deal)}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 cursor-pointer"
                          title="Create Quotation in ERP"
                          aria-label={`Create quotation for ${deal.name}`}
                        >
                          <FileText size={13} />
                        </button>
                        */}
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
              pageSizeOptions={[5, 10, 20, 50]}
              bordered={false}
            />
          </div>
        </div>
      )}

      </>}


            {dealMenu && createPortal(
        <div
          className="deal-floating-menu fixed bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] py-1.5 w-48 text-xs font-semibold text-slate-700 animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: dealMenu.top,
            left: dealMenu.left,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              handleOpenDealDetail(dealMenu.deal);
              closeDealMenu();
            }}
            className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
          >
            <Edit2 size={13} className="text-blue-600" />
            <span>View Deal</span>
          </button>

          <div className="px-3.5 py-1 text-[10px] uppercase font-bold text-slate-400 border-t border-slate-100 mt-1">
            ERP Conversion
          </div>
          {/* [Quotation & Proforma Invoice modules are commented out]
          <button
            type="button"
            onClick={() => {
              handleCreateErpQuotation(dealMenu.deal);
              closeDealMenu();
            }}
            className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
          >
            <FileText size={12} className="text-blue-600" />
            <span>Create Quotation</span>
          </button>
          */}
          <button
            type="button"
            onClick={() => {
              handleCreateErpSalesOrder(dealMenu.deal);
              closeDealMenu();
            }}
            className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
          >
            <ShoppingCart size={12} className="text-emerald-600" />
            <span>Create Sales Order</span>
          </button>

          <div className="my-1 border-t border-slate-100" />

          {dealMenu.deal?.stage !== 'Draft' && (
            <button
              type="button"
              onClick={() => {
                handleMoveStage(dealMenu.deal.id, 'Draft');
              }}
              className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
            >
              <FileText size={13} className="text-blue-500" />
              <span>Move to Draft</span>
            </button>
          )}

          {dealMenu.deal?.stage !== 'Won' && (
            <button
              type="button"
              onClick={() => {
                handleMoveStage(dealMenu.deal.id, 'Won');
              }}
              className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
            >
              <Trophy size={13} className="text-emerald-500" />
              <span>Won Deal</span>
            </button>
          )}

          {dealMenu.deal?.stage !== 'Lost' && (
            <button
              type="button"
              onClick={() => {
                handleMoveStage(dealMenu.deal.id, 'Lost');
              }}
              className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
            >
              <XCircle size={13} className="text-rose-500" />
              <span>Lost Deal</span>
            </button>
          )}


        </div>,
        document.body
      )}

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
                    <option value="">Select product</option>
                    {[...new Set([...productOptions.filter((p) => p !== 'All Products'), formState.product].filter(Boolean))].map((p) => (
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
