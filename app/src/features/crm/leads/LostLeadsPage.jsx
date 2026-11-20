import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, X, UserX, CalendarX2, Tag, Megaphone, SlidersHorizontal, ArrowRight,
  RotateCcw, CheckCircle2, AlertCircle, CheckSquare, Square,
} from 'lucide-react';
import { useCrmStore } from '../../../stores/crmStore';
import PageHeader from '../../../components/ui/PageHeader';
import TablePagination from '../../../components/ui/TablePagination';
import EmptyState from '../../../components/ui/EmptyState';
import CrmKpiCard from '../common/CrmKpiCard';
import { isLostLead } from '../../../services/leadStatus';
import { toISODate } from '../../../utils/dateUtils';
import RestoreLeadModal from './RestoreLeadModal';

const EMPTY_FILTERS = { query: '', owner: '', source: '', reason: '', from: '', to: '' };

const SORTS = {
  newest: { label: 'Newest first', compare: (a, b) => (b.createdISO || '').localeCompare(a.createdISO || '') },
  oldest: { label: 'Oldest first', compare: (a, b) => (a.createdISO || '').localeCompare(b.createdISO || '') },
  name: { label: 'Name A–Z', compare: (a, b) => (a.name || '').localeCompare(b.name || '') },
  valueHigh: { label: 'Highest value', compare: (a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0) },
};

const fieldClass =
  'h-9 w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3 text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition';
const labelClass = 'block text-[10.5px] font-bold uppercase tracking-wide text-slate-400 mb-1';

// Stable soft colours for avatars, picked from the name.
const AVATAR_TONES = [
  'bg-blue-50 text-blue-700', 'bg-emerald-50 text-emerald-700', 'bg-amber-50 text-amber-700',
  'bg-violet-50 text-violet-700', 'bg-rose-50 text-rose-700', 'bg-sky-50 text-sky-700',
];

function Avatar({ name, size = 'w-8 h-8 text-[11px]' }) {
  const text = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const tone = AVATAR_TONES[[...(name || '')].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span className={`${size} ${tone} rounded-full grid place-items-center font-bold shrink-0`}>{text || '?'}</span>
  );
}

/** Sorted distinct non-empty values of `key`, for a filter dropdown. */
const optionsOf = (rows, key) =>
  [...new Set(rows.map((row) => (row[key] || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

/** The most frequent non-empty value of `key`, with its count. */
function topOf(rows, key) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = (row[key] || '').trim();
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  let best = null;
  counts.forEach((count, value) => {
    if (!best || count > best.count) best = { value, count };
  });
  return best;
}

export default function LostLeadsPage() {
  const leads = useCrmStore((s) => s.leads);
  const deals = useCrmStore((s) => s.deals);
  const stages = useCrmStore((s) => s.stages);
  const lostReasons = useCrmStore((s) => s.lostReasons);

  // Modal and toast state
  const [restoreModalLead, setRestoreModalLead] = useState(null);
  const [isBulkRestoreOpen, setIsBulkRestoreOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isRestoring, setIsRestoring] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  // Auto-dismiss toast after 5s
  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(() => setToast({ show: false, message: '', isError: false }), 5000);
    return () => clearTimeout(timer);
  }, [toast.show]);

  // Ensure latest data is hydrated
  useEffect(() => {
    useCrmStore.getState().hydrate?.().catch(() => {});
  }, []);

  // Lost leads with the derived fields the page filters and sorts on.
  // Combines lost leads and deals marked Lost so that any lost deal/lead is guaranteed visible.
  const lostLeads = useMemo(() => {
    const reasonName = new Map((lostReasons || []).map((r) => [String(r.id), r.name || r.label]));

    // Identify all lost deals (stage === 'Lost' or tag === 'Lost')
    const lostDeals = (deals || []).filter((d) =>
      d && (d.stage === 'Lost' || d.tag === 'Lost' || /lost|declined/i.test(String(d.stage || '')))
    );
    const lostDealByLeadId = new Map();
    const lostDealByClientName = new Map();
    lostDeals.forEach((d) => {
      if (d.leadId) lostDealByLeadId.set(String(d.leadId), d);
      const nameKey = (d.title || d.name || d.client || '').trim().toLowerCase();
      if (nameKey) lostDealByClientName.set(nameKey, d);
    });

    const leadIdsSeen = new Set();
    const result = [];

    // 1. Leads matching isLost or associated with a lost deal
    (leads || []).forEach((lead) => {
      if (!lead) return;
      // If the lead is linked to an active deal that is Won or Draft, it is NOT lost!
      const linkedNonLostDeal = (deals || []).find(
        (d) => d && (d.stage !== 'Lost' && d.tag !== 'Lost') &&
          ((d.leadId && String(d.leadId) === String(lead.id)) ||
           ((d.title || d.name || '').trim().toLowerCase() === (lead.name || '').trim().toLowerCase()))
      );
      if (linkedNonLostDeal) return;

      const linkedLostDeal = lostDealByLeadId.get(String(lead.id)) ||
        lostDealByClientName.get((lead.name || '').trim().toLowerCase());
      const isLost = isLostLead(lead) || Boolean(linkedLostDeal);

      if (isLost) {
        leadIdsSeen.add(String(lead.id));
        const leadReason = lead.lostReason || linkedLostDeal?.lostReason || linkedLostDeal?.reason;
        const reasonLabel = reasonName.get(String(leadReason)) ||
          (typeof leadReason === 'string' && !/^[0-9a-f-]{36}$/i.test(leadReason) ? leadReason : '') ||
          'Lost';

        result.push({
          ...lead,
          amount: Number(lead.amount) || Number(linkedLostDeal?.price) || Number(linkedLostDeal?.value) || 0,
          createdISO: toISODate(lead.createdOn) || (linkedLostDeal?.createdAt ? toISODate(linkedLostDeal.createdAt) : ''),
          reasonLabel,
          status: 'Lost',
          isLost: true,
          dealId: linkedLostDeal?.id,
          dealTitle: linkedLostDeal?.title || linkedLostDeal?.name,
        });
      }
    });

    // 2. Orphan lost deals that have no corresponding lead record in leads
    lostDeals.forEach((deal) => {
      if (deal.leadId && leadIdsSeen.has(String(deal.leadId))) return;
      const nameKey = (deal.title || deal.name || deal.client || '').trim().toLowerCase();
      if (nameKey && (leads || []).some((l) => (l.name || '').trim().toLowerCase() === nameKey && leadIdsSeen.has(String(l.id)))) {
        return;
      }

      const dealReason = deal.lostReason || deal.reason;
      const reasonLabel = reasonName.get(String(dealReason)) ||
        (typeof dealReason === 'string' && !/^[0-9a-f-]{36}$/i.test(dealReason) ? dealReason : '') ||
        'Lost';

      result.push({
        id: deal.leadId || deal.id,
        name: deal.title || deal.name || deal.client || 'Untitled Deal',
        company: deal.client || deal.company || '—',
        phone: deal.phone || '',
        email: deal.email || '',
        leadNumber: deal.dealNumber || deal.deal_number || deal.leadNumber || '',
        owner: deal.assignedUser || deal.owner || '',
        source: deal.source || '',
        amount: Number(deal.price) || Number(deal.value) || 0,
        createdOn: deal.createdAt ? (toISODate(deal.createdAt) || deal.createdAt) : '—',
        createdISO: deal.createdAt ? toISODate(deal.createdAt) : '',
        reasonLabel,
        status: 'Lost',
        isLost: true,
        dealId: deal.id,
        dealTitle: deal.title || deal.name,
      });
    });

    return result;
  }, [leads, deals, lostReasons]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const owners = useMemo(() => optionsOf(lostLeads, 'owner'), [lostLeads]);
  const sources = useMemo(() => optionsOf(lostLeads, 'source'), [lostLeads]);
  const reasons = useMemo(() => optionsOf(lostLeads, 'reasonLabel'), [lostLeads]);

  const kpis = useMemo(() => {
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const topReason = topOf(lostLeads, 'reasonLabel');
    const topSource = topOf(lostLeads, 'source');
    const totalLostValue = lostLeads.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    return {
      total: lostLeads.length,
      thisMonth: lostLeads.filter((lead) => (lead.createdISO || '').startsWith(monthPrefix)).length,
      topReason,
      topSource,
      totalLostValue,
    };
  }, [lostLeads]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const rows = lostLeads.filter((lead) => {
      if (q) {
        const haystack = [lead.name, lead.company, lead.email, lead.phone, lead.leadNumber]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.owner && (lead.owner || '').trim() !== filters.owner) return false;
      if (filters.source && (lead.source || '').trim() !== filters.source) return false;
      if (filters.reason && lead.reasonLabel !== filters.reason) return false;
      if (filters.from || filters.to) {
        if (!lead.createdISO) return false;
        if (filters.from && lead.createdISO < filters.from) return false;
        if (filters.to && lead.createdISO > filters.to) return false;
      }
      return true;
    });
    return [...rows].sort(SORTS[sort]?.compare || SORTS.newest.compare);
  }, [lostLeads, filters, sort]);

  // Any filter, sort or page-size change starts again from the first page.
  useEffect(() => { setPage(1); }, [filters, sort, pageSize]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeCount = Object.keys(EMPTY_FILTERS).filter((key) => filters[key] !== EMPTY_FILTERS[key]).length;
  const setFilter = (key) => (e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }));

  // Selection handlers
  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageRows.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageRows.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Restore action handler
  const handleConfirmRestore = async ({ stageId, dealStage, targetLeads }) => {
    setIsRestoring(true);
    try {
      const isMultiple = targetLeads.length > 1;
      const idsToRestore = targetLeads.map((l) => l.id);

      // Separate regular leads and orphan deals
      const regularLeads = targetLeads.filter((l) => (leads || []).some((lead) => String(lead.id) === String(l.id)));
      const orphanDeals = targetLeads.filter((l) => !(leads || []).some((lead) => String(lead.id) === String(l.id)));

      if (regularLeads.length > 0) {
        if (regularLeads.length === 1) {
          await useCrmStore.getState().reopenLead(regularLeads[0].id, { stageId, dealStage });
        } else {
          await useCrmStore.getState().bulkReopenLeads(regularLeads.map((l) => l.id), { stageId, dealStage });
        }
      }

      // If any orphan deals were selected, restore deal stage
      for (const d of orphanDeals) {
        const targetDealId = d.dealId || d.id;
        await useCrmStore.getState().updateRecord('deals', targetDealId, { stage: dealStage || 'Draft', tag: '' });
      }

      await Promise.all([
        useCrmStore.getState().refresh('leads'),
        useCrmStore.getState().refresh('deals'),
      ]);

      setToast({
        show: true,
        isError: false,
        message: isMultiple
          ? `${targetLeads.length} leads restored back to active pipeline!`
          : `Lead "${targetLeads[0]?.name}" restored back to active pipeline!`,
      });

      setSelectedIds(new Set());
      setRestoreModalLead(null);
      setIsBulkRestoreOpen(false);
    } catch (err) {
      console.error('[CRM] Restore error:', err);
      setToast({
        show: true,
        isError: true,
        message: `Restore failed: ${err?.message || 'Server error occurred'}`,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const selectedLeadsList = useMemo(() => {
    return lostLeads.filter((l) => selectedIds.has(l.id));
  }, [lostLeads, selectedIds]);

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200 text-xs">
          {toast.isError ? (
            <AlertCircle size={17} className="text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />
          )}
          <span className="font-medium">{toast.message}</span>
          {!toast.isError && (
            <Link
              to="/crm/leads"
              className="ml-2 font-bold text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
            >
              <span>View Leads</span>
              <ArrowRight size={12} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setToast({ show: false, message: '', isError: false })}
            className="ml-2 text-slate-400 hover:text-white cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Restore Lead Modal */}
      <RestoreLeadModal
        lead={restoreModalLead}
        leads={isBulkRestoreOpen ? selectedLeadsList : []}
        stages={stages}
        isOpen={Boolean(restoreModalLead) || isBulkRestoreOpen}
        isLoading={isRestoring}
        onClose={() => {
          setRestoreModalLead(null);
          setIsBulkRestoreOpen(false);
        }}
        onConfirm={handleConfirmRestore}
      />

      <PageHeader
        title="Lost Leads"
        subtitle="Leads and deals marked as Lost / Closed. You can restore any lead back to the active pipeline at any time."
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <CrmKpiCard label="Total Lost" value={kpis.total} icon={UserX} tone="rose">
          {kpis.totalLostValue > 0 && (
            <span className="text-[11px] font-semibold text-rose-500">₹ {kpis.totalLostValue.toLocaleString('en-IN')}</span>
          )}
        </CrmKpiCard>
        <CrmKpiCard label="Lost This Month" value={kpis.thisMonth} icon={CalendarX2} tone="amber" />
        <CrmKpiCard label="Top Lost Reason" value={kpis.topReason?.value || '—'} icon={Tag} tone="purple">
          {kpis.topReason && (
            <span className="text-[11px] font-semibold text-slate-400">{kpis.topReason.count} record{kpis.topReason.count === 1 ? '' : 's'}</span>
          )}
        </CrmKpiCard>
        <CrmKpiCard label="Top Source" value={kpis.topSource?.value || '—'} icon={Megaphone} tone="sky">
          {kpis.topSource && (
            <span className="text-[11px] font-semibold text-slate-400">{kpis.topSource.count} record{kpis.topSource.count === 1 ? '' : 's'}</span>
          )}
        </CrmKpiCard>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <SlidersHorizontal size={14} className="text-slate-400" />
              Filters
              {activeCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">{activeCount} active</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">
                <span className="font-bold text-slate-700">{filtered.length}</span> of {lostLeads.length} lost record{lostLeads.length === 1 ? '' : 's'}
              </span>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                >
                  <X size={12} /> Clear all
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={filters.query}
              onChange={setFilter('query')}
              placeholder="Search by name, company, email, phone or lead number…"
              aria-label="Search lost leads"
              className={`${fieldClass} h-10 pl-9 text-[13px]`}
            />
          </div>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <div>
              <label className={labelClass} htmlFor="lost-owner">Owner</label>
              <select id="lost-owner" value={filters.owner} onChange={setFilter('owner')} aria-label="Owner" className={fieldClass}>
                <option value="">All owners</option>
                {owners.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="lost-source">Source</label>
              <select id="lost-source" value={filters.source} onChange={setFilter('source')} aria-label="Source" className={fieldClass}>
                <option value="">All sources</option>
                {sources.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="lost-reason">Lost reason</label>
              <select id="lost-reason" value={filters.reason} onChange={setFilter('reason')} aria-label="Lost reason" className={fieldClass}>
                <option value="">All reasons</option>
                {reasons.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="lost-from">Created from</label>
              <input id="lost-from" type="date" value={filters.from} max={filters.to || undefined} onChange={setFilter('from')} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="lost-to">Created to</label>
              <input id="lost-to" type="date" value={filters.to} min={filters.from || undefined} onChange={setFilter('to')} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="lost-sort">Sort by</label>
              <select id="lost-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className={fieldClass}>
                {Object.entries(SORTS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-emerald-900 font-semibold">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span>{selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-emerald-100/50 cursor-pointer text-xs"
              >
                Deselect all
              </button>
              <button
                type="button"
                onClick={() => setIsBulkRestoreOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs cursor-pointer transition-colors"
              >
                <RotateCcw size={12} />
                <span>Restore Selected ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {lostLeads.length === 0 ? (
          <EmptyState
            icon={UserX}
            title="No lost leads"
            description="Leads and deals you mark as Lost in the Leads list or Deals pipeline appear here, so you can review and restore them at any time."
            action={(
              <Link
                to="/crm/leads"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-150 group cursor-pointer"
                style={{ color: '#ffffff', textDecoration: 'none' }}
              >
                <span style={{ color: '#ffffff' }} className="font-semibold text-white">Go to Leads</span>
                <ArrowRight size={15} className="text-white transition-transform duration-150 group-hover:translate-x-1" style={{ color: '#ffffff' }} />
              </Link>
            )}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching lost leads"
            description="Nothing matches these filters. Try a different search or clear the filters."
            action={(
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-xs font-semibold text-slate-700 shadow-xs hover:border-slate-300 transition-colors cursor-pointer"
              >
                Clear filters
              </button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 text-left text-[10.5px] uppercase tracking-wide">
                  <th className="px-3 py-3 font-bold w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all leads on page"
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-3 font-bold w-10">#</th>
                  <th className="px-4 py-3 font-bold">Lead</th>
                  <th className="px-4 py-3 font-bold">Company</th>
                  <th className="px-4 py-3 font-bold">Lost reason</th>
                  <th className="px-4 py-3 font-bold">Owner</th>
                  <th className="px-4 py-3 font-bold">Source</th>
                  <th className="px-4 py-3 font-bold text-right">Value</th>
                  <th className="px-4 py-3 font-bold whitespace-nowrap">Created on</th>
                  <th className="px-4 py-3 font-bold text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((lead, index) => {
                  const isChecked = selectedIds.has(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-blue-50/30 transition-colors ${isChecked ? 'bg-emerald-50/30' : ''}`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(lead.id)}
                          aria-label={`Select ${lead.name}`}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-3 text-slate-400 font-medium">{(page - 1) * pageSize + index + 1}</td>
                      <td className="px-4 py-3">
                        <Link to={`/crm/leads/${encodeURIComponent(lead.id)}`} className="flex items-center gap-2.5 group">
                          <Avatar name={lead.name} />
                          <span className="min-w-0">
                            <span className="block font-semibold text-slate-800 group-hover:text-blue-600 truncate">{lead.name || 'Untitled Lead'}</span>
                            <span className="block text-[11px] text-slate-400 truncate">{lead.leadNumber || lead.dealTitle || lead.email || lead.phone || '—'}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lead.company || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-100 whitespace-nowrap">
                          {lead.reasonLabel || lead.status || 'Lost'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {lead.owner ? (
                          <span className="flex items-center gap-2 text-slate-700">
                            <Avatar name={lead.owner} size="w-6 h-6 text-[9.5px]" />
                            <span className="truncate">{lead.owner}</span>
                          </span>
                        ) : <span className="text-slate-400">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        {lead.source ? (
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 whitespace-nowrap">{lead.source}</span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 text-right whitespace-nowrap">
                        {lead.amount ? `₹ ${Number(lead.amount).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{lead.createdOn || '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setRestoreModalLead(lead)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 border border-emerald-200/80 font-semibold text-xs shadow-2xs transition-all cursor-pointer group"
                          title="Restore this lead back to active leads"
                        >
                          <RotateCcw size={12} className="transition-transform group-hover:-rotate-45" />
                          <span>Restore</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-100">
          <TablePagination
            total={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      </section>
    </div>
  );
}
