import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  Calendar,
  X,
  Plus,
  ChevronRight,
  Eye,
  Percent,
  Layers,
  Award,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { salesService, crmService } from '../../../services/domainServices';
import PageInfoButton from '../../../components/ui/PageInfoButton';
import TablePagination from '../../../components/ui/TablePagination';
import MasterSourceLink from '../../../components/common/MasterSourceLink';
import KpiCard from '../../../components/ui/KpiCard';

export default function BrokerCommissionPage() {
  // Navigation tabs: 'leads' (default) | 'register' | 'statement' | 'analytics'
  const [activeTab, setActiveTab] = useState('leads');

  // Search & common filters
  const [search, setSearch] = useState('');
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Data states
  const [brokersList, setBrokersList] = useState([]);
  const [brokerLeads, setBrokerLeads] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [statementData, setStatementData] = useState([]);
  const [statementMeta, setStatementMeta] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Pagination states
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsPageSize, setLeadsPageSize] = useState(10);
  const [registerPage, setRegisterPage] = useState(1);
  const [registerPageSize, setRegisterPageSize] = useState(10);
  const [statementPage, setStatementPage] = useState(1);
  const [statementPageSize, setStatementPageSize] = useState(10);

  // Modals
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false);
  const [showCreateBrokerModal, setShowCreateBrokerModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedComm, setSelectedComm] = useState(null);
  const [viewLeadDetail, setViewLeadDetail] = useState(null);

  // Pay modal fields
  const [payAmount, setPayAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [bankAccount, setBankAccount] = useState('HDFC Bank - 50200012345678');
  const [paymentReference, setPaymentReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Create Lead Form fields
  const [leadFormData, setLeadFormData] = useState({
    customerName: '',
    contactPerson: '',
    phone: '',
    email: '',
    fabricQuality: '',
    expectedMeters: '',
    expectedTakas: '',
    expectedRate: '',
    brokerId: '',
    commissionBasis: 'percent',
    commissionRate: '',
    commissionNotes: '',
    followUpDate: '',
  });
  const [leadCreating, setLeadCreating] = useState(false);

  // Create Broker Form fields
  const [brokerFormData, setBrokerFormData] = useState({
    name: '',
    code: '',
    contact_person: '',
    phone: '',
    email: '',
    commission_type: 'percent',
    default_value: '',
  });
  const [brokerCreating, setBrokerCreating] = useState(false);

  // Helper to extract rows from direct arrays or DRF paginated envelopes
  const extractRows = (res) => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.results)) return res.results;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.results)) return res.data.results;
    return [];
  };

  // 1. Fetch Master Brokers
  const fetchBrokers = useCallback(async () => {
    try {
      const res = await salesService.getBrokersList();
      setBrokersList(extractRows(res));
    } catch (err) {
      console.error('Failed to load brokers:', err);
    }
  }, []);

  // 2. Fetch Broker Leads
  const fetchBrokerLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await salesService.getBrokerLeads({
        brokerId: selectedBrokerId || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setBrokerLeads(extractRows(res));
    } catch (err) {
      console.error('Failed to load broker leads:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBrokerId, statusFilter, search]);

  // 3. Fetch Commission Register
  const fetchCommissions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await salesService.getBrokerCommissions({
        brokerId: selectedBrokerId || undefined,
        status: statusFilter || undefined,
      });
      setCommissions(extractRows(res));
    } catch (err) {
      console.error('Failed to load broker commissions:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBrokerId, statusFilter]);

  // 4. Fetch Statement
  const fetchStatement = useCallback(async () => {
    if (!selectedBrokerId) {
      setStatementData([]);
      setStatementMeta(null);
      return;
    }
    try {
      setLoading(true);
      const res = await salesService.getBrokerStatement({ brokerId: selectedBrokerId });
      const data = res?.data || res || {};
      setStatementMeta(data);
      const rows = data?.commissions || [];
      setStatementData(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('Failed to load broker statement:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedBrokerId]);

  // 5. Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await salesService.getBrokerAnalytics();
      setAnalyticsData(res?.data || res || null);
    } catch (err) {
      console.error('Failed to load broker analytics:', err);
    }
  }, []);

  useEffect(() => {
    fetchBrokers();
    fetchAnalytics();
  }, [fetchBrokers, fetchAnalytics]);

  useEffect(() => {
    if (activeTab === 'leads') {
      fetchBrokerLeads();
    } else if (activeTab === 'register') {
      fetchCommissions();
    } else if (activeTab === 'statement') {
      fetchStatement();
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, fetchBrokerLeads, fetchCommissions, fetchStatement, fetchAnalytics]);

  // Reset pagination on search or filters
  useEffect(() => {
    setLeadsPage(1);
    setRegisterPage(1);
    setStatementPage(1);
  }, [search, selectedBrokerId, statusFilter]);

  // Auto-fill commission terms when broker is selected in Create Lead modal
  const handleBrokerSelect = (brokerId) => {
    const brk = brokersList.find((b) => String(b.id) === String(brokerId));
    if (brk) {
      setLeadFormData((prev) => ({
        ...prev,
        brokerId,
        commissionBasis: brk.commission_type || 'percent',
        commissionRate: brk.default_value ? String(brk.default_value) : '',
        commissionNotes: `Broker terms from ${brk.name} (${brk.commission_type} @ ${brk.default_value || 0})`,
      }));
    } else {
      setLeadFormData((prev) => ({ ...prev, brokerId }));
    }
  };

  // Create Lead with Broker Submit
  const handleCreateLeadSubmit = async (e) => {
    e.preventDefault();
    if (!leadFormData.customerName.trim() || !leadFormData.brokerId) {
      alert('Please enter customer/company name and select a broker.');
      return;
    }
    try {
      setLeadCreating(true);
      const brk = brokersList.find((b) => String(b.id) === String(leadFormData.brokerId));
      const expMeters = parseFloat(leadFormData.expectedMeters) || 0;
      const expRate = parseFloat(leadFormData.expectedRate) || 0;
      const estAmount = expMeters > 0 && expRate > 0 ? (expMeters * expRate).toFixed(2) : '0';

      const payload = {
        name: leadFormData.contactPerson || leadFormData.customerName,
        company: leadFormData.customerName,
        phone: leadFormData.phone || undefined,
        email: leadFormData.email || undefined,
        amount: estAmount,
        custom_values: {
          broker_id: brk ? String(brk.id) : leadFormData.brokerId,
          broker_code: brk?.code || 'BRK',
          broker_name: brk?.name || 'Assigned Broker',
          fabric_quality: leadFormData.fabricQuality || 'Textile Grey',
          expected_meters: expMeters,
          expected_takas: parseFloat(leadFormData.expectedTakas) || 0,
          expected_rate: expRate,
          commission_basis: leadFormData.commissionBasis,
          commission_rate: parseFloat(leadFormData.commissionRate) || 0,
          commission_notes: leadFormData.commissionNotes,
          follow_up_date: leadFormData.followUpDate || undefined,
        },
      };

      await crmService.createLead(payload);
      setShowCreateLeadModal(false);
      setLeadFormData({
        customerName: '',
        contactPerson: '',
        phone: '',
        email: '',
        fabricQuality: '',
        expectedMeters: '',
        expectedTakas: '',
        expectedRate: '',
        brokerId: '',
        commissionBasis: 'percent',
        commissionRate: '',
        commissionNotes: '',
        followUpDate: '',
      });
      fetchBrokerLeads();
      fetchAnalytics();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to create broker lead.');
    } finally {
      setLeadCreating(false);
    }
  };

  // Create Broker Master Submit
  const handleCreateBrokerSubmit = async (e) => {
    e.preventDefault();
    if (!brokerFormData.name.trim()) {
      alert('Broker name is required.');
      return;
    }
    try {
      setBrokerCreating(true);
      await salesService.createBroker({
        name: brokerFormData.name,
        code: brokerFormData.code || undefined,
        contact_person: brokerFormData.contact_person,
        phone: brokerFormData.phone,
        email: brokerFormData.email,
        commission_type: brokerFormData.commission_type,
        default_value: brokerFormData.default_value ? parseFloat(brokerFormData.default_value) : 0,
        is_active: true,
      });
      setShowCreateBrokerModal(false);
      setBrokerFormData({
        name: '',
        code: '',
        contact_person: '',
        phone: '',
        email: '',
        commission_type: 'percent',
        default_value: '',
      });
      fetchBrokers();
      fetchAnalytics();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to create broker.');
    } finally {
      setBrokerCreating(false);
    }
  };

  // Commission Lifecycle Actions
  const handleApprove = async (id) => {
    try {
      await salesService.approveBrokerCommission(id);
      fetchCommissions();
      fetchAnalytics();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Approval failed.');
    }
  };

  const handleMakePayable = async (id) => {
    try {
      await salesService.makeBrokerPayable(id);
      fetchCommissions();
      fetchAnalytics();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Status change failed.');
    }
  };

  const openPayModal = (comm) => {
    setSelectedComm(comm);
    const outstanding = Math.max(0, (Number(comm.commission_amount) || 0) - (Number(comm.paid_amount) || 0));
    setPayAmount(String(outstanding.toFixed(2)));
    setPaymentReference('');
    setRemarks('');
    setShowPayModal(true);
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!selectedComm) return;
    const amountNum = parseFloat(payAmount);
    const outstanding = Math.max(0, (Number(selectedComm.commission_amount) || 0) - (Number(selectedComm.paid_amount) || 0));
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid payout amount greater than zero.');
      return;
    }
    if (amountNum > outstanding) {
      alert(`Payout amount (₹${amountNum.toLocaleString()}) cannot exceed outstanding balance (₹${outstanding.toLocaleString()}).`);
      return;
    }

    try {
      setPaySubmitting(true);
      await salesService.payBrokerCommission(selectedComm.id, {
        amount: payAmount,
        paymentMethod,
        bankAccount,
        paymentReference,
        remarks,
      });
      setShowPayModal(false);
      setSelectedComm(null);
      fetchCommissions();
      fetchStatement();
      fetchAnalytics();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Payment recording failed.');
    } finally {
      setPaySubmitting(false);
    }
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase();
    return brokerLeads.filter((l) => {
      const matchText =
        (l.leadNumber || '').toLowerCase().includes(q) ||
        (l.customerName || '').toLowerCase().includes(q) ||
        (l.brokerName || '').toLowerCase().includes(q) ||
        (l.fabricQuality || '').toLowerCase().includes(q);
      const matchBroker = selectedBrokerId ? String(l.brokerId) === String(selectedBrokerId) : true;
      const matchStatus = statusFilter ? String(l.stage).toLowerCase() === statusFilter.toLowerCase() : true;
      return matchText && matchBroker && matchStatus;
    });
  }, [brokerLeads, search, selectedBrokerId, statusFilter]);

  const pagedLeads = useMemo(() => {
    const start = (leadsPage - 1) * leadsPageSize;
    return filteredLeads.slice(start, start + leadsPageSize);
  }, [filteredLeads, leadsPage, leadsPageSize]);

  // Filtered Commissions
  const filteredCommissions = useMemo(() => {
    const q = search.toLowerCase();
    return commissions.filter((c) => {
      const matchText =
        (c.broker_name || c.brokerName || c.broker?.name || '').toLowerCase().includes(q) ||
        (c.invoice_number || c.invoiceNumber || '').toLowerCase().includes(q) ||
        (c.party_name || c.partyName || '').toLowerCase().includes(q) ||
        (c.commission_number || '').toLowerCase().includes(q);
      const matchBroker = selectedBrokerId ? String(c.broker) === String(selectedBrokerId) || String(c.broker_id) === String(selectedBrokerId) : true;
      const matchStatus = statusFilter ? String(c.status).toLowerCase() === statusFilter.toLowerCase() : true;
      return matchText && matchBroker && matchStatus;
    });
  }, [commissions, search, selectedBrokerId, statusFilter]);

  const pagedCommissions = useMemo(() => {
    const start = (registerPage - 1) * registerPageSize;
    return filteredCommissions.slice(start, start + registerPageSize);
  }, [filteredCommissions, registerPage, registerPageSize]);

  // Filtered Statement
  const pagedStatement = useMemo(() => {
    const start = (statementPage - 1) * statementPageSize;
    return statementData.slice(start, start + statementPageSize);
  }, [statementData, statementPage, statementPageSize]);

  // Compute live summary stats
  const summaryStats = useMemo(() => {
    const totalLeads = brokerLeads.length;
    const activeLeads = brokerLeads.filter((l) => !l.isLost && l.stage?.toLowerCase() !== 'won').length;
    let accrued = 0;
    let payable = 0;
    let paid = 0;

    commissions.forEach((c) => {
      const amt = Number(c.commission_amount) || 0;
      const pAmt = Number(c.paid_amount) || 0;
      accrued += amt;
      paid += pAmt;
      if (c.status === 'Payable' || c.status === 'Partially Paid') {
        payable += Math.max(0, amt - pAmt);
      }
    });

    const pendingBalance = Math.max(0, accrued - paid);
    return {
      totalLeads,
      activeLeads,
      accrued,
      payable,
      paid,
      pendingBalance,
    };
  }, [brokerLeads, commissions]);

  // Commission Basis label helper
  const renderBasisBadge = (basis, rate) => {
    const b = (basis || '').toLowerCase();
    if (b === 'per_meter' || b === 'meter') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span>₹{rate || '0'}/meter</span>
        </span>
      );
    }
    if (b === 'per_taka' || b === 'taka') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <span>₹{rate || '0'}/taka</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <Percent size={11} />
        <span>{rate || '0'}%</span>
      </span>
    );
  };

  // Status Badge helper
  const renderStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'paid') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Paid</span>;
    }
    if (s === 'partially paid') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Partially Paid</span>;
    }
    if (s === 'payable') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Payable</span>;
    }
    if (s === 'approved') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">Approved</span>;
    }
    if (s === 'lost deal (no commission)' || s.includes('lost')) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Lost (₹0)</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Accrued</span>;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-7 h-7 text-indigo-600" />
              Broker Lead & Commission Hub
            </h1>
            <PageInfoButton title="Broker Lead & Commission Management" />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Complete lifecycle from Broker Master → Lead Register → Document Pipeline Attribution → Commission Accrual & Payout.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateBrokerModal(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <Building2 size={14} className="text-slate-500" />
            + Add Broker Master
          </button>
          <button
            onClick={() => setShowCreateLeadModal(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg shadow hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
          >
            <Plus size={15} />
            + Create Lead with Broker
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <KpiCard
          label="Broker Leads"
          value={summaryStats.totalLeads}
          sub={`${summaryStats.activeLeads} in pipeline`}
          icon={Users}
          tone="indigo"
        />
        <KpiCard
          label="Accrued Brokerage"
          value={`₹${summaryStats.accrued.toLocaleString()}`}
          sub="From linked invoices"
          icon={DollarSign}
          tone="blue"
        />
        <KpiCard
          label="Approved / Payable"
          value={`₹${summaryStats.payable.toLocaleString()}`}
          sub="Ready for payout voucher"
          icon={CheckCircle2}
          tone="sky"
        />
        <KpiCard
          label="Total Paid Out"
          value={`₹${summaryStats.paid.toLocaleString()}`}
          sub="Disbursed to brokers"
          icon={TrendingUp}
          tone="emerald"
        />
        <KpiCard
          label="Outstanding Balance"
          value={`₹${summaryStats.pendingBalance.toLocaleString()}`}
          sub="Net liability"
          icon={Clock}
          tone="amber"
        />
        <KpiCard
          label="Conversion Rate"
          value={analyticsData?.conversionRate !== undefined ? `${analyticsData.conversionRate}%` : '25.0%'}
          sub="Deals won vs leads"
          icon={Percent}
          tone="purple"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('leads')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'leads'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers size={16} />
          Automatic Lead Register
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-600">
            {filteredLeads.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'register'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText size={16} />
          Commission Register (Invoice Accruals)
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
            {commissions.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('statement')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'statement'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign size={16} />
          Broker Balances & Statement
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'analytics'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp size={16} />
          Broker Performance & Analytics
        </button>
      </div>

      {/* Global Filter Bar (for Leads, Register, and Statement) */}
      {activeTab !== 'analytics' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'leads' ? 'Search by lead #, party, broker, fabric...' : 'Search commissions...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Broker Dropdown Filter */}
            <select
              value={selectedBrokerId}
              onChange={(e) => setSelectedBrokerId(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
            >
              <option value="">All Brokers</option>
              {brokersList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            {activeTab === 'leads' ? (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
              >
                <option value="">All Pipeline Stages</option>
                <option value="New Lead">New Lead</option>
                <option value="Details Collected">Details Collected</option>
                <option value="Quotation Shared">Quotation Shared</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Won">Won / Converted</option>
                <option value="Lost">Lost</option>
              </select>
            ) : (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
              >
                <option value="">All Commission Statuses</option>
                <option value="Accrued">Accrued</option>
                <option value="Approved">Approved</option>
                <option value="Payable">Payable</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
              </select>
            )}

            {(search || selectedBrokerId || statusFilter) && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedBrokerId('');
                  setStatusFilter('');
                }}
                className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50"
                title="Clear Filters"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: AUTOMATIC LEAD REGISTER */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'leads' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Lead # & Date</th>
                  <th className="py-3 px-4">Broker</th>
                  <th className="py-3 px-4">Customer / Party</th>
                  <th className="py-3 px-4">Fabric & Volume</th>
                  <th className="py-3 px-4 text-right">Estimated Value</th>
                  <th className="py-3 px-4 text-center">Agreed Terms</th>
                  <th className="py-3 px-4 text-center">Pipeline Stage</th>
                  <th className="py-3 px-4 text-center">Commission Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                      Loading broker leads...
                    </td>
                  </tr>
                ) : pagedLeads.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-400">
                      <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      No broker leads found matching criteria.
                      <div className="mt-3">
                        <button
                          onClick={() => setShowCreateLeadModal(true)}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
                        >
                          + Create First Broker Lead
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedLeads.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{l.leadNumber}</div>
                        <div className="text-xs text-slate-400">{l.leadDate || 'Today'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{l.brokerName}</div>
                        <div className="text-xs text-indigo-600 font-medium">{l.brokerCode}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{l.customerName}</div>
                        <div className="text-xs text-slate-400">{l.contactPerson} {l.phone ? `• ${l.phone}` : ''}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">{l.fabricQuality}</div>
                        <div className="text-xs text-slate-500">
                          {l.expectedMeters > 0 ? `${Number(l.expectedMeters).toLocaleString()} m` : ''}
                          {l.expectedMeters > 0 && l.expectedTakas > 0 ? ' • ' : ''}
                          {l.expectedTakas > 0 ? `${Number(l.expectedTakas).toLocaleString()} takas` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        ₹{Number(l.expectedSaleValue || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {renderBasisBadge(l.commissionBasis, l.commissionRate)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          l.stage?.toLowerCase() === 'won'
                            ? 'bg-emerald-100 text-emerald-800'
                            : l.isLost
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {l.stage}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {renderStatusBadge(l.commissionStatus)}
                        {Number(l.earnedCommission) > 0 && (
                          <div className="text-[11px] font-bold text-emerald-600 mt-0.5">
                            Earned: ₹{Number(l.earnedCommission).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setViewLeadDetail(l)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors inline-flex items-center gap-1"
                        >
                          <Eye size={13} />
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={leadsPage}
            pageSize={leadsPageSize}
            totalItems={filteredLeads.length}
            onPageChange={setLeadsPage}
            onPageSizeChange={(sz) => { setLeadsPageSize(sz); setLeadsPage(1); }}
          />
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: COMMISSION REGISTER */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'register' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Commission # & Date</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Broker Name</th>
                  <th className="py-3 px-4">Customer Party</th>
                  <th className="py-3 px-4 text-center">Basis & Rate</th>
                  <th className="py-3 px-4 text-right">Invoiced Amt</th>
                  <th className="py-3 px-4 text-right">Accrued Comm.</th>
                  <th className="py-3 px-4 text-right">Paid Amt</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="11" className="text-center py-12 text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                      Loading commissions...
                    </td>
                  </tr>
                ) : pagedCommissions.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center py-12 text-slate-400">
                      <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      No commissions recorded. Commissions accrue automatically when sales invoices with brokers are approved.
                    </td>
                  </tr>
                ) : (
                  pagedCommissions.map((c) => {
                    const totalComm = Number(c.commission_amount) || 0;
                    const paidAmt = Number(c.paid_amount) || 0;
                    const balance = Math.max(0, totalComm - paidAmt);

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{c.commission_number || `COMM-${c.id?.slice(0, 8)}`}</div>
                          <div className="text-xs text-slate-400">{c.invoice_date || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-indigo-600">
                          {c.invoice_number || c.invoiceNumber || 'Direct'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{c.broker_name || c.brokerName || c.broker?.name}</div>
                          <div className="text-xs text-slate-400">{c.brokerCode || ''}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-800">{c.party_name || c.partyName || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          {renderBasisBadge(c.commission_type || c.commission_basis, c.rate)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">
                          ₹{Number(c.invoice_amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">
                          ₹{totalComm.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-700 font-medium">
                          ₹{paidAmt.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-700">
                          ₹{balance.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {renderStatusBadge(c.status)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {c.status === 'Accrued' && (
                              <button
                                onClick={() => handleApprove(c.id)}
                                className="px-2 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors"
                              >
                                Approve
                              </button>
                            )}
                            {c.status === 'Approved' && (
                              <button
                                onClick={() => handleMakePayable(c.id)}
                                className="px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                              >
                                Make Payable
                              </button>
                            )}
                            {(c.status === 'Payable' || c.status === 'Partially Paid') && (
                              <button
                                onClick={() => openPayModal(c)}
                                className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-sm transition-colors"
                              >
                                Pay Voucher
                              </button>
                            )}
                            {c.status === 'Paid' && (
                              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                <CheckCircle2 size={13} /> Complete
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={registerPage}
            pageSize={registerPageSize}
            totalItems={filteredCommissions.length}
            onPageChange={setRegisterPage}
            onPageSizeChange={(sz) => { setRegisterPageSize(sz); setRegisterPage(1); }}
          />
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: BROKER BALANCES & STATEMENT */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'statement' && (
        <div className="space-y-4">
          {!selectedBrokerId ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">Select a Broker to View Ledger Statement</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Choose a broker from the dropdown above to inspect their deal accruals, payout history, and running balance.
              </p>
              <div className="mt-4 flex justify-center gap-2 flex-wrap">
                {brokersList.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBrokerId(b.id)}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 transition-colors"
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {statementMeta && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs text-slate-400 font-semibold uppercase">Total Accrued</div>
                    <div className="text-2xl font-bold text-slate-800 mt-1">₹{Number(statementMeta.totalAccrued || 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs text-slate-400 font-semibold uppercase">Total Paid</div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">₹{Number(statementMeta.totalPaid || 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs text-slate-400 font-semibold uppercase">Pending Liability</div>
                    <div className="text-2xl font-bold text-amber-700 mt-1">₹{Number(statementMeta.pendingBalance || 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs text-slate-400 font-semibold uppercase">Deals / Invoices</div>
                    <div className="text-2xl font-bold text-indigo-700 mt-1">{statementData.length}</div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <FileText size={16} className="text-indigo-600" />
                    Ledger Statement Drill-Down
                  </h3>
                  <button
                    onClick={() => setSelectedBrokerId('')}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Change Broker
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="p-3">Doc # & Date</th>
                        <th className="p-3">Party Name</th>
                        <th className="p-3">Commission Basis</th>
                        <th className="p-3 text-right">Invoiced Amount</th>
                        <th className="p-3 text-right">Accrued (₹)</th>
                        <th className="p-3 text-right">Paid (₹)</th>
                        <th className="p-3 text-right">Balance (₹)</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedStatement.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="p-8 text-center text-slate-400">
                            No ledger entries found for this broker.
                          </td>
                        </tr>
                      ) : (
                        pagedStatement.map((row) => {
                          const amt = Number(row.commission_amount) || 0;
                          const pAmt = Number(row.paid_amount) || 0;
                          const bal = Math.max(0, amt - pAmt);

                          return (
                            <tr key={row.id} className="hover:bg-slate-50/75">
                              <td className="p-3 font-semibold text-slate-800">
                                {row.commission_number || row.invoice_number || 'Direct'}
                                <div className="text-xs text-slate-400 font-normal">{row.invoice_date || '-'}</div>
                              </td>
                              <td className="p-3 text-slate-700">{row.party_name || row.partyName || '-'}</td>
                              <td className="p-3">{renderBasisBadge(row.commission_type || row.commission_basis, row.rate)}</td>
                              <td className="p-3 text-right text-slate-600">₹{Number(row.invoice_amount || 0).toLocaleString()}</td>
                              <td className="p-3 text-right font-semibold text-slate-900">₹{amt.toLocaleString()}</td>
                              <td className="p-3 text-right font-medium text-emerald-700">₹{pAmt.toLocaleString()}</td>
                              <td className="p-3 text-right font-bold text-amber-700">₹{bal.toLocaleString()}</td>
                              <td className="p-3 text-center">{renderStatusBadge(row.status)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={statementPage}
                  pageSize={statementPageSize}
                  totalItems={statementData.length}
                  onPageChange={setStatementPage}
                  onPageSizeChange={(sz) => { setStatementPageSize(sz); setStatementPage(1); }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 4: BROKER PERFORMANCE & ANALYTICS */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase">Active Brokers</span>
                <Building2 className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-slate-800 mt-2">{analyticsData?.totalBrokers || brokersList.length}</div>
              <div className="text-xs text-slate-500 mt-1">Registered agencies</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase">Invoiced Revenue via Brokers</span>
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-2">
                ₹{Number(analyticsData?.totalInvoicedBroker || 0).toLocaleString()}
              </div>
              <div className="text-xs text-emerald-600 mt-1">Net invoiced sales</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase">Pipeline Conversion</span>
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-purple-700 mt-2">{analyticsData?.conversionRate || 0}%</div>
              <div className="text-xs text-purple-600 mt-1">Lead to sale conversion</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase">Pending Brokerage</span>
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-amber-700 mt-2">
                ₹{Number(analyticsData?.pendingPayable || 0).toLocaleString()}
              </div>
              <div className="text-xs text-amber-600 mt-1">Unpaid approved brokerage</div>
            </div>
          </div>

          {/* Broker Performance Comparison Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Award size={18} className="text-amber-500" />
                Broker Partner Performance Matrix
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Broker Partner</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-center">Default Terms</th>
                    <th className="py-3 px-4 text-center">Total Leads</th>
                    <th className="py-3 px-4 text-center">Conversion</th>
                    <th className="py-3 px-4 text-right">Invoiced Revenue</th>
                    <th className="py-3 px-4 text-right">Accrued (₹)</th>
                    <th className="py-3 px-4 text-right">Paid (₹)</th>
                    <th className="py-3 px-4 text-right">Pending (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(analyticsData?.brokerStats || []).length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-8 text-slate-400">
                        No broker performance statistics available yet.
                      </td>
                    </tr>
                  ) : (
                    analyticsData.brokerStats.map((b) => (
                      <tr key={b.brokerId} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{b.brokerName}</div>
                          <div className="text-xs text-indigo-600 font-medium">{b.brokerCode}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-xs">
                          {b.phone}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {renderBasisBadge(b.commissionType, b.defaultValue)}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-slate-800">
                          {b.totalLeads}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-purple-700">{b.conversionRate}%</span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-800">
                          ₹{Number(b.invoicedValue || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">
                          ₹{Number(b.accruedCommission || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-700">
                          ₹{Number(b.paidCommission || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-700">
                          ₹{Number(b.pendingBalance || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: CREATE LEAD WITH BROKER */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showCreateLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus size={20} className="text-indigo-600" />
                Create Sales Lead with Broker Attribution
              </h2>
              <button
                onClick={() => setShowCreateLeadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLeadSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer / Company Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Radhika Fabrics Pvt Ltd"
                    value={leadFormData.customerName}
                    onChange={(e) => setLeadFormData({ ...leadFormData, customerName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Bhai"
                    value={leadFormData.contactPerson}
                    onChange={(e) => setLeadFormData({ ...leadFormData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone / Mobile Number
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98251 00000"
                    value={leadFormData.phone}
                    onChange={(e) => setLeadFormData({ ...leadFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="procurement@company.com"
                    value={leadFormData.email}
                    onChange={(e) => setLeadFormData({ ...leadFormData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Broker Attribution Section */}
              <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 space-y-3">
                <div className="text-xs font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-indigo-600" />
                  Broker Attribution & Agreed Commission Terms
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Select Broker <span className="text-rose-500">*</span>
                      </label>
                      <MasterSourceLink source="brokers" />
                    </div>
                    <select
                      required
                      value={leadFormData.brokerId}
                      onChange={(e) => handleBrokerSelect(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">-- Choose Broker --</option>
                      {brokersList.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Commission Basis (Agreed)
                    </label>
                    <select
                      value={leadFormData.commissionBasis}
                      onChange={(e) => setLeadFormData({ ...leadFormData, commissionBasis: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="percent">Percentage of Net Invoice (%)</option>
                      <option value="per_meter">Fixed per Meter (₹/m)</option>
                      <option value="per_taka">Fixed per Taka (₹/taka)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Agreed Rate
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 2.0 or 2.50"
                      value={leadFormData.commissionRate}
                      onChange={(e) => setLeadFormData({ ...leadFormData, commissionRate: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Commission Notes & Exceptional Agreement
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Standard 2% approved by sales director for 30-day payment term"
                    value={leadFormData.commissionNotes}
                    onChange={(e) => setLeadFormData({ ...leadFormData, commissionNotes: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Requirement & Volume */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fabric Quality / Requirement
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 60 Lea Pure Linen Grey"
                    value={leadFormData.fabricQuality}
                    onChange={(e) => setLeadFormData({ ...leadFormData, fabricQuality: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expected Meters
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 15000"
                    value={leadFormData.expectedMeters}
                    onChange={(e) => setLeadFormData({ ...leadFormData, expectedMeters: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expected Takas
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 120"
                    value={leadFormData.expectedTakas}
                    onChange={(e) => setLeadFormData({ ...leadFormData, expectedTakas: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expected Rate (₹ per meter)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 85.00"
                    value={leadFormData.expectedRate}
                    onChange={(e) => setLeadFormData({ ...leadFormData, expectedRate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={leadFormData.followUpDate}
                    onChange={(e) => setLeadFormData({ ...leadFormData, followUpDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateLeadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leadCreating}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow disabled:opacity-50"
                >
                  {leadCreating ? 'Saving...' : 'Save Lead to Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: ADD BROKER MASTER */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showCreateBrokerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 size={20} className="text-indigo-600" />
                Register New Broker Partner
              </h2>
              <button
                onClick={() => setShowCreateBrokerModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBrokerSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Broker Agency Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Textile Brokers"
                  value={brokerFormData.name}
                  onChange={(e) => setBrokerFormData({ ...brokerFormData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Broker Code
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-generated if empty"
                    value={brokerFormData.code}
                    onChange={(e) => setBrokerFormData({ ...brokerFormData, code: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Shah"
                    value={brokerFormData.contact_person}
                    onChange={(e) => setBrokerFormData({ ...brokerFormData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98251 00001"
                    value={brokerFormData.phone}
                    onChange={(e) => setBrokerFormData({ ...brokerFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="broker@agency.com"
                    value={brokerFormData.email}
                    onChange={(e) => setBrokerFormData({ ...brokerFormData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Commission Basis
                  </label>
                  <select
                    value={brokerFormData.commission_type}
                    onChange={(e) => setBrokerFormData({ ...brokerFormData, commission_type: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="per_meter">Per Meter (₹/m)</option>
                    <option value="per_taka">Per Taka (₹/taka)</option>
                    <option value="fixed">Fixed Lump Sum</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Rate / Value
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 2.0"
                    value={brokerFormData.default_value}
                    onChange={(e) => setBrokerFormData({ ...brokerFormData, default_value: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateBrokerModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={brokerCreating}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow disabled:opacity-50"
                >
                  {brokerCreating ? 'Saving...' : 'Save Broker Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 3: PAY VOUCHER MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showPayModal && selectedComm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <DollarSign size={20} className="text-emerald-600" />
                Issue Brokerage Payout Voucher
              </h2>
              <button
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePaySubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Commission Voucher:</span>
                  <span className="font-semibold text-slate-800">{selectedComm.commission_number || selectedComm.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Broker:</span>
                  <span className="font-semibold text-slate-800">{selectedComm.broker_name || selectedComm.brokerName || selectedComm.broker?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Accrued:</span>
                  <span className="font-semibold text-slate-800">₹{Number(selectedComm.commission_amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Already Paid:</span>
                  <span className="font-semibold text-emerald-700">₹{Number(selectedComm.paid_amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-bold text-amber-700">
                  <span>Net Outstanding Balance:</span>
                  <span>₹{(Number(selectedComm.commission_amount) - Number(selectedComm.paid_amount || 0)).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-slate-800"
                />
                <div className="text-[11px] text-slate-400 mt-1">Supports full or partial payment up to balance.</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash in Hand</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bank / Cash Account
                  </label>
                  <select
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs"
                  >
                    <option value="HDFC Bank - 50200012345678">HDFC Bank (Operating A/c)</option>
                    <option value="State Bank of India - 3001298492">SBI Current A/c</option>
                    <option value="ICICI Bank - 001205012345">ICICI Cash Credit</option>
                    <option value="Cash in Hand">Petty Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Reference / UTR Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR-2026-HDFC-998822"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Narration / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Brokerage payout approved by Accounts"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow disabled:opacity-50"
                >
                  {paySubmitting ? 'Posting...' : 'Record Payment & Post to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 4: VIEW LEAD PIPELINE DETAILS */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewLeadDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900">{viewLeadDetail.leadNumber} — {viewLeadDetail.customerName}</h2>
                <div className="text-xs text-slate-500 mt-0.5">Broker: {viewLeadDetail.brokerName} ({viewLeadDetail.brokerCode})</div>
              </div>
              <button
                onClick={() => setViewLeadDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400">Fabric Quality:</span>
                  <div className="font-semibold text-slate-800 text-sm mt-0.5">{viewLeadDetail.fabricQuality}</div>
                </div>
                <div>
                  <span className="text-slate-400">Volume:</span>
                  <div className="font-semibold text-slate-800 text-sm mt-0.5">
                    {viewLeadDetail.expectedMeters} m ({viewLeadDetail.expectedTakas} takas)
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Agreed Commission:</span>
                  <div className="mt-1">{renderBasisBadge(viewLeadDetail.commissionBasis, viewLeadDetail.commissionRate)}</div>
                </div>
                <div>
                  <span className="text-slate-400">Pipeline Stage:</span>
                  <div className="font-bold text-indigo-700 text-sm mt-0.5">{viewLeadDetail.stage}</div>
                </div>
              </div>

              {viewLeadDetail.commissionNotes && (
                <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100">
                  <span className="text-indigo-900 font-bold block mb-1">Commission Agreement Terms:</span>
                  <p className="text-indigo-800">{viewLeadDetail.commissionNotes}</p>
                </div>
              )}

              {/* Linked Pipeline Documents */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 uppercase text-[11px] tracking-wide block">Linked Pipeline Records</span>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  <div className="p-2.5 flex items-center justify-between">
                    <span className="text-slate-600">Quotations Raised:</span>
                    <span className="font-semibold text-slate-800">
                      {viewLeadDetail.quotations?.length > 0 ? (
                        viewLeadDetail.quotations.map(q => q.number).join(', ')
                      ) : (
                        <span className="text-slate-400 italic">None yet</span>
                      )}
                    </span>
                  </div>
                  <div className="p-2.5 flex items-center justify-between">
                    <span className="text-slate-600">Sales Orders:</span>
                    <span className="font-semibold text-slate-800">
                      {viewLeadDetail.orders?.length > 0 ? (
                        viewLeadDetail.orders.map(o => o.number).join(', ')
                      ) : (
                        <span className="text-slate-400 italic">None yet</span>
                      )}
                    </span>
                  </div>
                  <div className="p-2.5 flex items-center justify-between">
                    <span className="text-slate-600">Sales Invoices:</span>
                    <span className="font-semibold text-slate-800">
                      {viewLeadDetail.invoices?.length > 0 ? (
                        viewLeadDetail.invoices.map(i => i.number).join(', ')
                      ) : (
                        <span className="text-slate-400 italic">None yet</span>
                      )}
                    </span>
                  </div>
                  <div className="p-2.5 flex items-center justify-between bg-slate-50 font-bold">
                    <span className="text-slate-700">Commission Earned / Accrued:</span>
                    <span className={Number(viewLeadDetail.earnedCommission) > 0 ? "text-emerald-700" : "text-slate-500"}>
                      ₹{Number(viewLeadDetail.earnedCommission || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewLeadDetail(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
