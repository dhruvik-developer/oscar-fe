import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Download,
  Printer,
  Edit2,
  Trash2,
  RefreshCw,
  ExternalLink,
  Landmark,
  Layers,
  Building2,
  TrendingUp,
  Receipt,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { api } from '../../services/api';
import { exportToCSV } from '../../services/exportUtils';
import { PageHeader } from '../../components/common/PageHeader';
import ExpenseCategoriesPage from './ExpenseCategoriesPage';
import AccountingLogPage from './AccountingLogPage';
import { TabBar, formatINR, describeApiError } from './accountingShared';

const COA_TABS = [
  { id: 'accounts', label: 'Chart of Accounts' },
  { id: 'expense-categories', label: 'Expense Categories' },
  { id: 'accounting-log', label: 'Accounting Log' },
];

const ACCOUNT_TYPES = [
  { value: 'Asset', label: 'Assets', subtitle: 'Receivables, Bank, Cash, Inventory', color: 'blue' },
  { value: 'Liability', label: 'Liabilities', subtitle: 'Payables, Loans, Taxes Payable', color: 'amber' },
  { value: 'Equity', label: 'Equity', subtitle: 'Owner Capital, Retained Earnings', color: 'purple' },
  { value: 'Income', label: 'Income', subtitle: 'Sales, Operational Revenues', color: 'emerald' },
  { value: 'Expense', label: 'Expenses', subtitle: 'COGS, Salaries, Operating Costs', color: 'rose' },
];

const TYPE_CONFIG = {
  Asset: {
    label: 'Assets',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Landmark,
    accent: 'border-l-blue-500',
    kpiTone: 'text-blue-700',
    kpiBg: 'bg-blue-50/70 border-blue-200',
    defaultDrCr: 'Dr',
  },
  Liability: {
    label: 'Liabilities',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Layers,
    accent: 'border-l-amber-500',
    kpiTone: 'text-amber-700',
    kpiBg: 'bg-amber-50/70 border-amber-200',
    defaultDrCr: 'Cr',
  },
  Equity: {
    label: 'Equity',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Building2,
    accent: 'border-l-purple-500',
    kpiTone: 'text-purple-700',
    kpiBg: 'bg-purple-50/70 border-purple-200',
    defaultDrCr: 'Cr',
  },
  Income: {
    label: 'Income',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: TrendingUp,
    accent: 'border-l-emerald-500',
    kpiTone: 'text-emerald-700',
    kpiBg: 'bg-emerald-50/70 border-emerald-200',
    defaultDrCr: 'Cr',
  },
  Expense: {
    label: 'Expenses',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: Receipt,
    accent: 'border-l-rose-500',
    kpiTone: 'text-rose-700',
    kpiBg: 'bg-rose-50/70 border-rose-200',
    defaultDrCr: 'Dr',
  },
};

export default function ChartOfAccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentTab = searchParams.get('tab') || 'accounts';
  const setTab = (t) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', t);
      return next;
    });
  };

  // State
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('ALL'); // 'ALL' | 'Asset' | 'Liability' | etc.
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'table'
  const [showInactive, setShowInactive] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [modalForm, setModalForm] = useState({
    code: '',
    name: '',
    type: 'Expense',
    subtype: '',
    parent: '',
    openingBalance: '',
    isActive: true,
  });
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/accounts/chart-of-accounts/', { query: { page_size: 500 } });
      const list = Array.isArray(res) ? res : res?.results || res?.data || [];
      setAccounts(list);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentTab === 'accounts') {
      fetchAccounts();
    }
  }, [currentTab, fetchAccounts]);

  // Seed default system accounts
  const handleSeedDefaults = async () => {
    setSeeding(true);
    setSeedSuccess('');
    setError('');
    try {
      const res = await api.post('/accounts/chart-of-accounts/seed-defaults/', {});
      setSeedSuccess(res?.message || 'Standard Chart of Accounts successfully initialized!');
      await fetchAccounts();
      setTimeout(() => setSeedSuccess(''), 6000);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSeeding(false);
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingAccount(null);
    setModalForm({
      code: '',
      name: '',
      type: selectedType !== 'ALL' ? selectedType : 'Expense',
      subtype: '',
      parent: '',
      openingBalance: '',
      isActive: true,
    });
    setModalError('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (acc) => {
    setEditingAccount(acc);
    setModalForm({
      code: acc.code || '',
      name: acc.name || '',
      type: acc.type || 'Expense',
      subtype: acc.subtype || '',
      parent: acc.parent || '',
      openingBalance: acc.openingBalance !== null && acc.openingBalance !== undefined ? String(acc.openingBalance) : '',
      isActive: acc.isActive !== false,
    });
    setModalError('');
    setIsModalOpen(true);
  };

  // Save Account
  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (!modalForm.name.trim()) {
      setModalError('Account Name is required.');
      return;
    }
    setModalSaving(true);
    setModalError('');
    try {
      const payload = {
        name: modalForm.name.trim(),
        type: modalForm.type,
        subtype: modalForm.subtype.trim() || null,
        parent: modalForm.parent || null,
        opening_balance: modalForm.openingBalance ? parseFloat(modalForm.openingBalance) : 0,
        is_active: modalForm.isActive,
      };
      if (modalForm.code.trim()) {
        payload.code = modalForm.code.trim();
      }

      if (editingAccount) {
        await api.patch(`/accounts/chart-of-accounts/${editingAccount.id}/`, payload);
      } else {
        await api.post('/accounts/chart-of-accounts/', payload);
      }
      setIsModalOpen(false);
      fetchAccounts();
    } catch (err) {
      setModalError(describeApiError(err));
    } finally {
      setModalSaving(false);
    }
  };

  // Delete Account
  const handleDelete = async (acc) => {
    if (acc.isSystem) {
      alert('System accounts cannot be deleted because core automatic postings depend on them.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${acc.name}" (${acc.code})?`)) return;
    try {
      await api.delete(`/accounts/chart-of-accounts/${acc.id}/`);
      fetchAccounts();
    } catch (err) {
      alert(describeApiError(err));
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!accounts.length) return;
    const headers = ['Account Code', 'Account Name', 'Type', 'Sub-type', 'Is System', 'Balance (INR)', 'Status'];
    const rows = accounts.map((a) => [
      a.code,
      a.name,
      a.type,
      a.subtype || '',
      a.isSystem ? 'Yes' : 'No',
      Number(a.balance) || 0,
      a.isActive !== false ? 'Active' : 'Inactive',
    ]);
    exportToCSV(`Chart_of_Accounts_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (!showInactive && a.isActive === false) return false;
      if (selectedType !== 'ALL' && a.type !== selectedType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          a.code?.toLowerCase().includes(q) ||
          a.name?.toLowerCase().includes(q) ||
          a.subtype?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [accounts, showInactive, selectedType, search]);

  // Aggregate Metrics per Type
  const metrics = useMemo(() => {
    const counts = { Asset: 0, Liability: 0, Equity: 0, Income: 0, Expense: 0 };
    const balances = { Asset: 0, Liability: 0, Equity: 0, Income: 0, Expense: 0 };
    accounts.forEach((a) => {
      const t = a.type;
      if (counts[t] !== undefined) {
        counts[t]++;
        balances[t] += Number(a.balance) || 0;
      }
    });
    return { counts, balances };
  }, [accounts]);

  // Group accounts by financial type
  const groupedByType = useMemo(() => {
    const groups = { Asset: [], Liability: [], Equity: [], Income: [], Expense: [] };
    filteredAccounts.forEach((a) => {
      if (groups[a.type]) {
        groups[a.type].push(a);
      }
    });
    return groups;
  }, [filteredAccounts]);

  // Parent map for looking up parent account code
  const parentMap = useMemo(() => {
    const map = {};
    accounts.forEach((a) => {
      map[a.id] = a;
    });
    return map;
  }, [accounts]);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Chart of Accounts"
          subtitle="Ledger account hierarchy, operating expense categories, and system accounting logs."
          breadcrumb={[{ label: 'Accounts', to: '/accounts/cash-bank' }, { label: 'Chart of Accounts' }]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Download size={14} className="text-slate-500" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Printer size={14} className="text-slate-500" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition"
              >
                <Plus size={15} />
                <span>Add Ledger Account</span>
              </button>
            </div>
          }
        />
      </div>

      <div className="no-print">
        <TabBar tabs={COA_TABS} active={currentTab} onChange={setTab} />
      </div>

      {currentTab === 'accounts' && (
        <div className="space-y-6">
          {/* 1. SEED NOTIFICATION BANNER (Shown when standard accounts are few) */}
          {accounts.length > 0 && accounts.length < 20 && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs no-print">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-amber-950">
                    Standard Chart of Accounts Incomplete ({accounts.length} of 34 loaded)
                  </h4>
                  <p className="text-xs text-amber-800/90 mt-0.5">
                    Your chart of accounts currently has only {accounts.length} accounts. Click below to initialize the standard 34 double-entry ledger accounts (Sundry Debtors, Creditors, GST Input/Output, Sales, Purchases, Inventory, etc.).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-2 transition"
              >
                {seeding ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Initialize 34 Standard Accounts</span>
              </button>
            </div>
          )}

          {seedSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{seedSuccess}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={fetchAccounts} className="font-bold underline text-rose-700 hover:text-rose-900 cursor-pointer">
                Retry
              </button>
            </div>
          )}

          {/* 2. FINANCIAL OVERVIEW SUMMARY STAT CARDS (Informative KPI Stats - Not clickable filters) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 no-print">
            {ACCOUNT_TYPES.map(({ value, label }) => {
              const cfg = TYPE_CONFIG[value];
              const Icon = cfg.icon;
              const count = metrics.counts[value] || 0;
              const bal = metrics.balances[value] || 0;

              return (
                <div
                  key={value}
                  className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {label}
                    </span>
                    <div className={`p-1.5 rounded-xl ${cfg.kpiBg}`}>
                      <Icon size={14} className={cfg.kpiTone} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-mono font-extrabold text-lg text-slate-900 tracking-tight">
                      {formatINR(Math.abs(bal))}{' '}
                      <span className="text-[10px] font-bold text-slate-400">
                        {bal > 0 ? 'Dr' : bal < 0 ? 'Cr' : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                      <span>{count} {count === 1 ? 'account' : 'accounts'}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.badge}`}>
                        {cfg.defaultDrCr}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3. CONTROLS & FILTER PILL BAR (The Single Dedicated Filter matching other account sections) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3.5 no-print">
            {/* Top row: Filter Pills + View Mode */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Pill Filter Bar */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedType('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedType === 'ALL'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Accounts ({accounts.length})
                </button>
                {ACCOUNT_TYPES.map(({ value, label }) => {
                  const count = metrics.counts[value] || 0;
                  const active = selectedType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSelectedType(active ? 'ALL' : value)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          active ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('grouped')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    viewMode === 'grouped'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Grouped View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Flat List
                </button>
              </div>
            </div>

            {/* Bottom row: Search Bar & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by code (e.g. 1100), name, or subtype..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Show Inactive Accounts</span>
                </label>

                <button
                  type="button"
                  onClick={fetchAccounts}
                  disabled={loading}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer disabled:opacity-50"
                  title="Refresh Accounts"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* 4. MAIN ACCOUNTS DISPLAY */}
          {loading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-medium">Loading Chart of Accounts...</p>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <BookOpen size={32} className="text-slate-300 mx-auto" />
              <h3 className="font-bold text-sm text-slate-800">No Ledger Accounts Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {search
                  ? `No accounts matched your search for "${search}".`
                  : 'No accounts in this category yet. Click "+ Add Ledger Account" above or initialize the 34 standard accounts.'}
              </p>
            </div>
          ) : viewMode === 'grouped' && selectedType === 'ALL' ? (
            /* GROUPED FINANCIAL VIEW (By Pillar) */
            <div className="space-y-5">
              {ACCOUNT_TYPES.map(({ value }) => {
                const groupRows = groupedByType[value] || [];
                if (groupRows.length === 0) return null;
                const cfg = TYPE_CONFIG[value];
                const Icon = cfg.icon;
                const groupTotal = groupRows.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);

                return (
                  <div key={value} className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                    {/* Group Header */}
                    <div className={`px-5 py-3.5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between border-l-4 ${cfg.accent}`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg ${cfg.kpiBg}`}>
                          <Icon size={14} className={cfg.kpiTone} />
                        </div>
                        <div>
                          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                            {cfg.label} ({groupRows.length})
                          </h3>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 mr-2">Category Balance:</span>
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {formatINR(Math.abs(groupTotal))}{' '}
                          <span className="text-[10px] text-slate-500">{groupTotal > 0 ? 'Dr' : groupTotal < 0 ? 'Cr' : ''}</span>
                        </span>
                      </div>
                    </div>

                    {/* Group Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/40 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                          <tr>
                            <th className="py-2.5 px-4 w-28">Code</th>
                            <th className="py-2.5 px-4">Account Name</th>
                            <th className="py-2.5 px-4 w-36">Sub-type</th>
                            <th className="py-2.5 px-4 w-44">Parent Account</th>
                            <th className="py-2.5 px-4 text-right w-40">Current Balance</th>
                            <th className="py-2.5 px-4 text-center w-28">Status</th>
                            <th className="py-2.5 px-4 text-right w-28 no-print">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {groupRows.map((r) => (
                            <AccountRow
                              key={r.id}
                              row={r}
                              parent={parentMap[r.parent]}
                              onEdit={() => handleOpenEdit(r)}
                              onDelete={() => handleDelete(r)}
                              onViewLedger={() => navigate(`/accounts/general-ledger?tab=ledger&accountId=${r.id}`)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* FLAT TABLE VIEW */
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-28">Code</th>
                      <th className="py-3 px-4">Account Name</th>
                      <th className="py-3 px-4 w-32">Type</th>
                      <th className="py-3 px-4 w-32">Sub-type</th>
                      <th className="py-3 px-4 w-40">Parent</th>
                      <th className="py-3 px-4 text-right w-40">Current Balance</th>
                      <th className="py-3 px-4 text-center w-28">Status</th>
                      <th className="py-3 px-4 text-right w-28 no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAccounts.map((r) => (
                      <AccountRow
                        key={r.id}
                        row={r}
                        showType
                        parent={parentMap[r.parent]}
                        onEdit={() => handleOpenEdit(r)}
                        onDelete={() => handleDelete(r)}
                        onViewLedger={() => navigate(`/accounts/general-ledger?tab=ledger&accountId=${r.id}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {currentTab === 'expense-categories' && <ExpenseCategoriesPage embedded />}
      {currentTab === 'accounting-log' && <AccountingLogPage embedded />}

      {/* 5. ADD / EDIT ACCOUNT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {editingAccount ? 'Edit Ledger Account' : 'New Ledger Account'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {editingAccount ? `Code: ${editingAccount.code}` : 'Define a new financial head in chart of accounts'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-5 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Code */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Account Code <span className="text-slate-400 font-normal">(Leave blank to auto-assign)</span>
                </label>
                <input
                  type="text"
                  disabled={Boolean(editingAccount?.isSystem)}
                  value={modalForm.code}
                  onChange={(e) => setModalForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. 5101"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Account Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={modalForm.name}
                  onChange={(e) => setModalForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Factory Electricity Charges"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Type</label>
                  <select
                    disabled={Boolean(editingAccount?.isSystem)}
                    value={modalForm.type}
                    onChange={(e) => setModalForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800 disabled:bg-slate-100"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.value}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sub-Type</label>
                  <input
                    type="text"
                    value={modalForm.subtype}
                    onChange={(e) => setModalForm((f) => ({ ...f, subtype: e.target.value }))}
                    placeholder="e.g. Bank, Tax, Freight"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
              </div>

              {/* Parent */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Parent Account (Optional)</label>
                <select
                  value={modalForm.parent}
                  onChange={(e) => setModalForm((f) => ({ ...f, parent: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-800"
                >
                  <option value="">— Primary Top-Level Account —</option>
                  {accounts
                    .filter((a) => a.id !== editingAccount?.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name} ({a.type})</option>
                    ))}
                </select>
              </div>

              {/* Opening Balance */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={modalForm.openingBalance}
                  onChange={(e) => setModalForm((f) => ({ ...f, openingBalance: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>

              {/* Status */}
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalForm.isActive}
                  onChange={(e) => setModalForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="font-semibold text-slate-700">Account is Active</span>
              </label>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {modalSaving ? 'Saving…' : editingAccount ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for individual account row
function AccountRow({ row, parent, showType = false, onEdit, onDelete, onViewLedger }) {
  const cfg = TYPE_CONFIG[row.type] || TYPE_CONFIG.Expense;
  const balance = Number(row.balance) || 0;

  return (
    <tr className="hover:bg-slate-50/80 transition-colors group">
      {/* Code */}
      <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200/80">
          {row.code}
        </span>
      </td>

      {/* Name */}
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 group-hover:text-blue-600 transition">
            {row.name}
          </span>
          {row.isSystem && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80">
              System
            </span>
          )}
        </div>
      </td>

      {/* Type (only in flat mode) */}
      {showType && (
        <td className="py-2.5 px-4">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${cfg.badge}`}>
            {row.type}
          </span>
        </td>
      )}

      {/* Subtype */}
      <td className="py-2.5 px-4 text-slate-500 font-medium">
        {row.subtype ? (
          <span className="px-2 py-0.5 bg-slate-100/70 text-slate-600 rounded text-[11px]">
            {row.subtype}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* Parent */}
      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
        {parent ? (
          <span className="font-mono text-slate-700">{parent.code} - {parent.name}</span>
        ) : (
          <span className="text-slate-400 italic">Primary</span>
        )}
      </td>

      {/* Current Balance */}
      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
        {balance === 0 ? (
          <span className="text-slate-300 font-normal">₹0.00</span>
        ) : (
          <span>
            {formatINR(Math.abs(balance))}{' '}
            <span className={`text-[10px] font-extrabold ${balance > 0 ? 'text-blue-700' : 'text-emerald-700'}`}>
              {balance > 0 ? 'Dr' : 'Cr'}
            </span>
          </span>
        )}
      </td>

      {/* Status */}
      <td className="py-2.5 px-4 text-center">
        {row.isActive !== false ? (
          <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
            Active
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-full border border-slate-200">
            Inactive
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="py-2.5 px-4 text-right no-print">
        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition">
          <button
            type="button"
            onClick={onViewLedger}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="View Account Ledger"
          >
            <BookOpen size={14} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            title="Edit Account"
          >
            <Edit2 size={13} />
          </button>
          {!row.isSystem && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Delete Account"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
