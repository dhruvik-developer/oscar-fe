import InfoBanner from '../../components/ui/InfoBanner';
import PageHeader from '../../components/ui/PageHeader';
import AdministrationGuideButton from './AdministrationGuideButton';
import KpiCard from '../../components/ui/KpiCard';
import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminSync, describeError, pullCustomerClients } from '../../services/adminSync';
import { useERP } from '../../context/ERPContext';
import {
  Users,
  UserCheck,
  Handshake,
  Folder,
  Star,
  Search,
  Plus,
  Download,
  LayoutGrid,
  List,
  MoreVertical,
  X,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  MapPin,
  Mail,
  Phone,
  Building2,
  Tag,
  Lock,
  Unlock,
  KeyRound,
  Briefcase,
  Calendar,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Upload,
  Camera,
  Check,
  FileSpreadsheet,
  StickyNote,
  Clock,
  Sparkles,
  Ban,
  Shield,
  Layers,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

const STATUS_TONES = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  Lead: 'bg-blue-50 text-blue-700 border-blue-200',
};

const CLIENTS_PER_PAGE = 12;

/** Lower-cased text, safe on a field the server left unset. */
function text(value) {
  return String(value ?? '').toLowerCase();
}

/**
 * The party row as one line of text. Billing address is a JSON blob, so a
 * customer with only a state on file still shows something sensible.
 */
function locationOf(party) {
  const address = party?.billingAddress || {};
  const parts = [address.city, address.state].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return party?.placeOfSupply || '';
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getInitialsColor(name = '') {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-800',
    'bg-rose-100 text-rose-700',
    'bg-emerald-100 text-emerald-700',
    'bg-sky-100 text-sky-700',
    'bg-indigo-100 text-indigo-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
    'bg-orange-100 text-orange-700',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
}

function inr(value) {
  return `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
}

function ClientAvatar({ client, size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-xl',
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;
  const initials = getInitials(client?.name);
  const initialsColor = getInitialsColor(client?.name || '');

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 shadow-2xs ${initialsColor} ${currentSizeClass} ${className}`}
    >
      {initials}
    </div>
  );
}

/** `From lead` / `Manual` — which side of the CRM this account came from. */
function sourceOf(client) {
  return Number(client?.leadCount) > 0 ? 'Lead Converted' : 'Manual Entry';
}

function sourceTone(client) {
  return Number(client?.leadCount) > 0
    ? 'bg-violet-50 text-violet-700 border-violet-200'
    : 'bg-slate-50 text-slate-600 border-slate-200';
}

export function ClientsPage() {
  const { refreshFromBackend, companyProfile: company } = useERP();
  const [clients, setClients] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadClients = async () => {
      try {
        const rows = await pullCustomerClients();
        if (!cancelled) {
          setClients(rows);
          setLoadError('');
        }
      } catch (error) {
        if (!cancelled) setLoadError(describeError(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadClients();
    window.addEventListener('focus', loadClients);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadClients);
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);

  const [toastMessage, setToastMessage] = useState(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [viewingClient, setViewingClient] = useState(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.export-menu-container')) {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const allLocations = useMemo(() => {
    const set = new Set(clients.map(locationOf).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [clients]);

  const stats = useMemo(() => {
    return {
      total: clients.length,
      active: clients.filter((client) => client.status === 'Active').length,
      withDeals: clients.filter((client) => client.deals > 0).length,
      withProjects: clients.filter((client) => client.projects > 0).length,
      dualPartners: clients.filter((client) => client.type === 'Both').length,
    };
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        text(c.name).includes(q) ||
        text(c.code).includes(q) ||
        text(c.email).includes(q) ||
        text(c.phone).includes(q) ||
        text(c.code).includes(q) ||
        text(c.gstin).includes(q) ||
        text(c.contactPerson).includes(q) ||
        text(locationOf(c)).includes(q);

      const matchesSource =
        selectedSource === 'All' || sourceOf(c) === selectedSource;

      const matchesStatus =
        selectedStatus === 'All' ||
        (c.status && String(c.status ?? '').toLowerCase() === selectedStatus.toLowerCase());

      const matchesLocation =
        selectedLocation === 'All' || locationOf(c) === selectedLocation;

      return matchesSearch && matchesSource && matchesStatus && matchesLocation;
    });
  }, [clients, searchQuery, selectedSource, selectedStatus, selectedLocation]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / CLIENTS_PER_PAGE));
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * CLIENTS_PER_PAGE;
    return filteredClients.slice(start, start + CLIENTS_PER_PAGE);
  }, [filteredClients, currentPage]);

  const handleExportData = (format = 'csv') => {
    setIsExportOpen(false);
    const rows = filteredClients.map((c) => [
      `"${c.name || ''}"`,
      `"${c.code || ''}"`,
      `"${sourceOf(c)}"`,
      `"${c.email || ''}"`,
      `"${c.phone || ''}"`,
      `"${locationOf(c)}"`,
      `"${c.gstin || ''}"`,
      `"${c.status || 'Active'}"`,
      String(Math.round(Number(c.balance) || 0)),
      String(Math.round(Number(c.creditLimit) || 0)),
    ]);
    if (format === 'csv') {
      const headers = ['Name', 'Code', 'Source', 'Email', 'Phone', 'Location', 'GSTIN', 'Status', 'Balance', 'Credit Limit'];
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csvContent));
      link.setAttribute('download', `clients_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const link = document.createElement('a');
      link.setAttribute('href', `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(filteredClients, null, 2))}`);
      link.setAttribute('download', `clients_export_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    showNotification(`Exported ${filteredClients.length} clients as ${format.toUpperCase()}.`);
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:top-6 sm:right-6 z-50 bg-[#0f172a] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Clients"
        subtitle="Every customer account for your company — the ones entered by hand and the ones created when a lead was converted."
        actions={
          <>
            <AdministrationGuideButton entity="client" />
            <div className="relative export-menu-container">
              <button
                onClick={() => setIsExportOpen(!isExportOpen)}
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs md:text-sm px-4 py-2.5 rounded-xl shadow-2xs transition-colors"
              >
                <Download size={16} />
                <span>Export</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {isExportOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => handleExportData('csv')}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600" />
                    <span>Export as CSV</span>
                  </button>
                  <button
                    onClick={() => handleExportData('json')}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <FileText size={15} className="text-blue-600" />
                    <span>Export as JSON</span>
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      {/* The tenant's own row is the company, not a customer -- it stays as a
          one-line identity strip rather than a card competing with the list. */}
      {company && (
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-2xs flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <span className="inline-flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Building2 size={15} className="text-[#1f6bff]" />
            {company.name}
          </span>
          <span className="text-slate-500">Plan: <span className="font-semibold text-slate-700">{company.plan || 'Standard'}</span></span>
          <span className="text-slate-500">Currency: <span className="font-semibold text-slate-700">{company.currency || 'INR'}</span></span>
          <span className="text-slate-500">Financial year starts: <span className="font-semibold text-slate-700">{company.fyStartMonth || company.fy_start_month || 'April'}</span></span>
          <span className="text-slate-500">Timezone: <span className="font-semibold text-slate-700">{company.timezone || 'Asia/Kolkata'}</span></span>
        </div>
      )}

      <InfoBanner
        storageKey="adminClientsInfoBannerV1"
        title="Why use Client Management?"
        text="Keep client contact details and business information in one place. Review related deals and projects, update client records and use filters to find the customers you need."
      />

      {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Unable to load clients: {loadError}</div>}
      {loading && <p role="status" className="text-sm text-slate-500">Loading clients...</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Clients" value={stats.total} icon={Users} tone="blue" />
        <KpiCard label="Active Clients" value={stats.active} icon={UserCheck} tone="emerald" />
        <KpiCard label="Clients with Deals" value={stats.withDeals} icon={Handshake} tone="sky" />
        <KpiCard label="Clients with Projects" value={stats.withProjects} icon={Folder} tone="amber" />
        <KpiCard label="Dual Partners" value={stats.dualPartners} icon={Building2} tone="orange" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients by name, code, email, phone..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedSource}
            onChange={(e) => {
              setSelectedSource(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Clients</option>
            <option value="Customer">Customers</option>
            <option value="Dual Partner">Dual Partners</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="On Hold">On Hold</option>
            <option value="Inactive">Inactive</option>
            <option value="On Hold">On Hold</option>
          </select>

          <select
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Locations</option>
            {allLocations
              .filter((loc) => loc !== 'All')
              .map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-1 self-end md:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl border transition-all ${
              viewMode === 'grid'
                ? 'bg-[#1f6bff] border-[#1f6bff] text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Grid View"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-xl border transition-all ${
              viewMode === 'list'
                ? 'bg-[#1f6bff] border-[#1f6bff] text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="List View"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {loadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span>Could not load clients — {loadError}</span>
        </div>
      )}

      {!loadError && filteredClients.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-[#1f6bff] flex items-center justify-center mx-auto mb-4">
            <Users size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {loading ? 'Loading clients…' : 'No clients match your filter'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {clients.length === 0
              ? 'Customers you add in the Customers module, and leads you convert, will appear here.'
              : 'Try adjusting your search keywords or resetting the dropdown filters.'}
          </p>
          {clients.length > 0 && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSource('All');
                setSelectedStatus('All');
                setSelectedLocation('All');
              }}
              className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedClients.map((client) => (
            <div
              key={client.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col justify-between hover:border-blue-300 hover:shadow-xs transition-all"
            >
              <div>
                <div className="flex items-start gap-3">
                  <ClientAvatar client={client} size="md" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate leading-tight">{client.name}</h3>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{client.code || '—'}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                      <Mail size={11} className="flex-shrink-0" />
                      <span className="truncate">{client.email || '—'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5 flex items-center gap-1">
                      <Phone size={11} className="flex-shrink-0 text-slate-400" />
                      <span>{client.phone || '—'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                      <MapPin size={11} className="flex-shrink-0 text-slate-400" />
                      <span>{locationOf(client) || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${sourceTone(client)}`}>
                    {sourceOf(client)}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${STATUS_TONES[client.status] || STATUS_TONES.Active} border-transparent`}>
                    {client.status || 'Active'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 py-3 mt-3 border-y border-slate-100 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">Receivable</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">{inr(client.balance)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">Credit Limit</div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">{inr(client.creditLimit)}</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 mt-1">
                <button
                  onClick={() => setViewingClient(client)}
                  className="w-full py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 border border-slate-200 transition-colors"
                >
                  <Eye size={13} />
                  <span>View</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] lg:min-w-0 text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Receivable</th>
                  <th className="py-3 px-4 text-right">Credit Limit</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <ClientAvatar client={client} size="sm" />
                        <div>
                          <div className="font-bold text-slate-900">{client.name}</div>
                          <div className="text-[11px] text-slate-400">{client.code || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800">{client.contactPerson || '—'}</div>
                      <div className="text-[11px] text-slate-400">{client.phone || '—'}</div>
                      <div className="text-[11px] text-slate-400">{client.email || ''}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{locationOf(client) || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${sourceTone(client)}`}>
                        {sourceOf(client)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">{inr(client.balance)}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">{inr(client.creditLimit)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_TONES[client.status] || STATUS_TONES.Active}`}>
                        {client.status || 'Active'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setViewingClient(client)}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200"
                        title="View"
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
        <span>
          Showing {filteredClients.length === 0 ? 0 : (currentPage - 1) * CLIENTS_PER_PAGE + 1} to{' '}
          {Math.min(currentPage * CLIENTS_PER_PAGE, filteredClients.length)} of {filteredClients.length} clients
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
            <button
              key={pg}
              onClick={() => setCurrentPage(pg)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold ${
                currentPage === pg
                  ? 'bg-[#1f6bff] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {pg}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>


      {viewingClient && (
        <ClientDetailDrawer
          client={viewingClient}
          onClose={() => setViewingClient(null)}
        />
      )}
    </div>
  );
}

function ClientDetailDrawer({ client, onClose }) {
  if (!client) return null;

  const address = client.billingAddress || {};
  const hasAddress = Object.values(address).some(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Users size={15} className="text-[#1f6bff]" />
              <span className="font-semibold text-slate-800">Client Profile</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
            <div className="flex items-center gap-4">
              <ClientAvatar client={client} size="lg" />
              <div>
                <h3 className="text-base font-bold text-slate-900">{client.name}</h3>
                <p className="text-xs text-slate-500">{client.code || '—'}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${sourceTone(client)}`}>
                    {sourceOf(client)}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_TONES[client.status] || STATUS_TONES.Active}`}>
                    {client.status || 'Active'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <div>
                <div className="text-[11px] text-slate-400">Receivable</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{inr(client.balance)}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Credit Limit</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{inr(client.creditLimit)}</div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Contact Information
              </h4>
              <div className="space-y-2 text-xs">
                {client.contactPerson && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                    <Users size={15} className="text-blue-600 flex-shrink-0" />
                    <span className="text-slate-700 font-medium">Contact: {client.contactPerson}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <Mail size={15} className="text-blue-600 flex-shrink-0" />
                  <span className="text-slate-700 font-medium break-all">{client.email || '—'}</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <Phone size={15} className="text-emerald-600 flex-shrink-0" />
                  <span className="text-slate-700 font-medium">{client.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <MapPin size={15} className="text-rose-600 flex-shrink-0" />
                  <span className="text-slate-700 font-medium">{locationOf(client) || '—'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Tax &amp; Compliance
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <Shield size={15} className="text-indigo-600 flex-shrink-0" />
                  <span className="text-slate-700 font-medium">GSTIN: {client.gstin || '—'}</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <Building2 size={15} className="text-sky-600 flex-shrink-0" />
                  <span className="text-slate-700 font-medium">Treatment: {client.gstTreatment || 'Unregistered Business'}</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                  <TrendingUp size={15} className="text-emerald-600 flex-shrink-0" />
                  <span className="text-slate-700 font-medium">Place of supply: {client.placeOfSupply || '—'}</span>
                </div>
              </div>
            </div>

            {hasAddress && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Billing Address
                </h4>
                <p className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {[address.line1, address.line2, address.city, address.state, address.pincode, address.country]
                    .filter(Boolean)
                    .join('\n')}
                </p>
              </div>
            )}

            {(client.contacts || []).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Contacts
                </h4>
                <div className="space-y-1.5">
                  {(client.contacts || []).map((contact) => (
                    <div key={contact.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <div className="font-bold text-slate-800">
                        {contact.name}
                        {contact.isPrimary && (
                          <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {[contact.role, contact.phone, contact.email].filter(Boolean).join(' • ') || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
          <Link
            to="/crm/customers"
            className="flex-1 py-2 bg-[#1f6bff] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
          >
            <ArrowRight size={14} />
            <span>Manage in Customers</span>
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClientsPage;