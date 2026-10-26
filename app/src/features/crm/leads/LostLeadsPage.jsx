import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, X, UserX, CalendarX2, Tag, Megaphone, SlidersHorizontal, ArrowRight,
} from 'lucide-react';
import { useCrmStore } from '../../../stores/crmStore';
import PageHeader from '../../../components/ui/PageHeader';
import TablePagination from '../../../components/ui/TablePagination';
import EmptyState from '../../../components/ui/EmptyState';
import CrmKpiCard from '../common/CrmKpiCard';
import { isLostLead } from '../../../services/leadStatus';
import { toISODate } from '../../../utils/dateUtils';

const EMPTY_FILTERS = { query: '', owner: '', source: '', reason: '', from: '', to: '' };

const SORTS = {
  newest: { label: 'Newest first', compare: (a, b) => (b.createdISO || '').localeCompare(a.createdISO || '') },
  oldest: { label: 'Oldest first', compare: (a, b) => (a.createdISO || '').localeCompare(b.createdISO || '') },
  name: { label: 'Name A–Z', compare: (a, b) => (a.name || '').localeCompare(b.name || '') },
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
  const lostReasons = useCrmStore((s) => s.lostReasons);

  // Lost leads with the derived fields the page filters and sorts on.
  const lostLeads = useMemo(() => {
    const reasonName = new Map((lostReasons || []).map((r) => [String(r.id), r.name || r.label]));
    return leads.filter(isLostLead).map((lead) => ({
      ...lead,
      createdISO: toISODate(lead.createdOn),
      // `lostReason` is a lookup id from the server, or already a label.
      reasonLabel: reasonName.get(String(lead.lostReason)) || (typeof lead.lostReason === 'string' && !/^[0-9a-f-]{36}$/i.test(lead.lostReason) ? lead.lostReason : ''),
    }));
  }, [leads, lostReasons]);

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
    return {
      total: lostLeads.length,
      thisMonth: lostLeads.filter((lead) => (lead.createdISO || '').startsWith(monthPrefix)).length,
      topReason,
      topSource,
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
    return [...rows].sort(SORTS[sort].compare);
  }, [lostLeads, filters, sort]);

  // Any filter, sort or page-size change starts again from the first page.
  useEffect(() => { setPage(1); }, [filters, sort, pageSize]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activeCount = Object.keys(EMPTY_FILTERS).filter((key) => filters[key] !== EMPTY_FILTERS[key]).length;
  const setFilter = (key) => (e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lost Leads"
        subtitle="Leads marked as Lost / Closed. These records also remain in the main Leads list."
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <CrmKpiCard label="Total Lost" value={kpis.total} icon={UserX} tone="rose" />
        <CrmKpiCard label="Lost This Month" value={kpis.thisMonth} icon={CalendarX2} tone="amber" />
        <CrmKpiCard label="Top Lost Reason" value={kpis.topReason?.value || '—'} icon={Tag} tone="purple">
          {kpis.topReason && (
            <span className="text-[11px] font-semibold text-slate-400">{kpis.topReason.count} lead{kpis.topReason.count === 1 ? '' : 's'}</span>
          )}
        </CrmKpiCard>
        <CrmKpiCard label="Top Source" value={kpis.topSource?.value || '—'} icon={Megaphone} tone="sky">
          {kpis.topSource && (
            <span className="text-[11px] font-semibold text-slate-400">{kpis.topSource.count} lead{kpis.topSource.count === 1 ? '' : 's'}</span>
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
                <span className="font-bold text-slate-700">{filtered.length}</span> of {lostLeads.length} lost lead{lostLeads.length === 1 ? '' : 's'}
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

        {/* Table */}
        {lostLeads.length === 0 ? (
          <EmptyState
            icon={UserX}
            title="No lost leads"
            description="Leads you mark as Lost in the Leads list appear here, so you can review why deals slipped away."
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
                  <th className="px-4 py-3 font-bold w-12">#</th>
                  <th className="px-4 py-3 font-bold">Lead</th>
                  <th className="px-4 py-3 font-bold">Company</th>
                  <th className="px-4 py-3 font-bold">Lost reason</th>
                  <th className="px-4 py-3 font-bold">Owner</th>
                  <th className="px-4 py-3 font-bold">Source</th>
                  <th className="px-4 py-3 font-bold whitespace-nowrap">Created on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((lead, index) => (
                  <tr key={lead.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-medium">{(page - 1) * pageSize + index + 1}</td>
                    <td className="px-4 py-3">
                      <Link to={`/crm/leads/${encodeURIComponent(lead.id)}`} className="flex items-center gap-2.5 group">
                        <Avatar name={lead.name} />
                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-800 group-hover:text-blue-600 truncate">{lead.name || 'Untitled Lead'}</span>
                          <span className="block text-[11px] text-slate-400 truncate">{lead.leadNumber || lead.email || lead.phone || '—'}</span>
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
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{lead.createdOn || '—'}</td>
                  </tr>
                ))}
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
