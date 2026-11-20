import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import KpiCard from '../../components/ui/KpiCard';
import PartyWizardModal from '../../components/common/PartyWizardModal';
import { PageHeader } from '../../components/common/PageHeader';
import { EntityHeroCard } from '../../components/common/EntityHeroCard';
import { getInitial, safeString } from '../../utils/stringUtils';
import {
  Users,
  UserCheck,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  CreditCard,
  Plus,
  Eye,
  Edit2,
  TrendingUp,
  TrendingDown,
  X,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  Truck,
  IndianRupee,
  Receipt
} from 'lucide-react';

const partiesGuide = {
  title: 'Commercial Parties & Directory',
  subtitle: 'Unified party directory for Customers, Vendors, and Dual Trading Partners',
  purpose: 'The Parties Master serves as the single source of truth for all external trade entities with full Indian statutory compliance (GSTIN, PAN, TDS/TCS sections, accounting group, credit terms, and multi-contact profiles).',
  workflow: ['Basic Identity', 'GST & Statutory', 'TDS/TCS Settings', 'Accounting Group', 'Bank & Credit Terms', 'Addresses & POCs'],
  keyTerms: [
    { term: 'Dual Role (Both)', definition: 'A business partner that functions simultaneously as a supplier of goods/services and as a billing client.' },
    { term: 'Place of Supply', definition: 'State code used to determine CGST+SGST vs. IGST on tax invoices.' },
    { term: 'TDS/TCS Section', definition: 'Applicable IT withholding tax section (e.g. 194C, 194J, 206C) automatically factored on billings.' },
  ],
  tips: [
    'Use the 6-Step Registration Wizard to quickly onboarding compliant trade partners with PAN/GST validation.',
    'Selecting "Both" allows using the same commercial party across both Sales Orders and Purchase Invoices seamlessly.',
  ],
};

export const getPartyBalanceMeta = (party) => {
  if (!party) {
    return {
      label: 'Settled',
      tone: 'text-text-secondary',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-border',
      isAdvance: false,
    };
  }
  const isVendor = party.type === 'Vendor' || party.type === 'Transporter' || party.type === 'Processor';
  const bal = Number(party.balance) || 0;
  const balType = party.openingBalanceType || party.opening_balance_type || (isVendor ? 'Payable' : 'Advance');

  if (isVendor) {
    if (balType === 'Advance' || bal < 0) {
      return {
        label: 'Advance',
        isAdvance: true,
        tone: bal !== 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-text-secondary',
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      };
    }
    return {
      label: 'Payable',
      isAdvance: false,
      tone: bal > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-text-secondary',
      badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    };
  }

  // Customer: default for customer opening balance is Advance (deposit) unless explicitly marked Receivable
  if (balType === 'Receivable') {
    return {
      label: 'Receivable',
      isAdvance: false,
      tone: bal > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-text-secondary',
      badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    };
  }
  return {
    label: 'Advance',
    isAdvance: true,
    tone: bal > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-text-secondary',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  };
};

export default function PartiesPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const typeParam = searchParams.get('type') || searchParams.get('tab');
  const isCustomerContext = location.pathname.includes('/crm/customers') || typeParam?.toLowerCase() === 'customer';
  const isVendorContext = location.pathname.includes('/purchase/vendors') || typeParam?.toLowerCase() === 'vendor';

  const { parties = [], addParty, updateParty, addPaymentIn, addPaymentOut, bankAccounts = [], formatCurrency, showToast } = useERP();
  const [selectedType, setSelectedType] = useState(() => {
    if (typeParam && ['customer', 'vendor', 'both'].includes(typeParam.toLowerCase())) {
      return typeParam.charAt(0).toUpperCase() + typeParam.slice(1).toLowerCase();
    }
    if (isCustomerContext) return 'Customer';
    if (isVendorContext) return 'Vendor';
    return 'All';
  });
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [viewingParty, setViewingParty] = useState(null);
  const [advanceModalParty, setAdvanceModalParty] = useState(null);
  const [addAdvanceAmt, setAddAdvanceAmt] = useState('');
  const [advanceMode, setAdvanceMode] = useState('Bank Wire Direct');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');
  const [advanceUpdating, setAdvanceUpdating] = useState(false);
  const [advanceError, setAdvanceError] = useState('');

  const handleOpenAdvanceModal = (party) => {
    setAdvanceModalParty(party);
    setAddAdvanceAmt('');
    setAdvanceMode('Bank Wire Direct');
    setSelectedBankId(bankAccounts?.[0]?.id || '');
    setAdvanceNote('');
    setAdvanceError('');
  };

  const handleAddAdvance = async (e) => {
    e.preventDefault();
    if (!advanceModalParty) return;
    const addAmt = Number(addAdvanceAmt);
    if (isNaN(addAmt) || addAmt <= 0) {
      setAdvanceError('Please enter a valid advance amount greater than 0.');
      return;
    }
    setAdvanceUpdating(true);
    setAdvanceError('');
    try {
      const party = advanceModalParty;
      const isVendor = party.type === 'Vendor' || party.type === 'Processor' || party.type === 'Transporter';
      const chosenBank = bankAccounts?.find((b) => b.id === selectedBankId) || bankAccounts?.[0];
      const bankAccId = advanceMode === 'Cash' ? undefined : (chosenBank?.id || selectedBankId || undefined);
      const today = new Date().toISOString().split('T')[0];

      // 1. Post to Accounts & General Ledger via PaymentIn / PaymentOut
      if (isVendor) {
        if (typeof addPaymentOut === 'function') {
          await addPaymentOut({
            vendorId: party.id,
            vendor: party.name,
            amount: addAmt,
            date: today,
            mode: advanceMode,
            bankAccountId: bankAccId,
            reference: advanceNote || `ADV-${Date.now().toString().slice(-6)}`,
            notes: advanceNote ? `Vendor Advance: ${advanceNote}` : 'Vendor Advance',
          });
        }
      } else {
        if (typeof addPaymentIn === 'function') {
          await addPaymentIn({
            customerId: party.id,
            customer: party.name,
            amount: addAmt,
            date: today,
            mode: advanceMode,
            bankAccountId: bankAccId,
            reference: advanceNote || `ADV-${Date.now().toString().slice(-6)}`,
            notes: advanceNote ? `Customer Advance: ${advanceNote}` : 'Customer Advance',
          });
        }
      }

      // 2. Compute new balance:
      // For Vendor: disbursement reduces payable or increases advance (credit - debit)
      // For Customer: receipt reduces receivable or increases advance (debit - credit)
      const currentBal = Number(party.balance) || 0;
      let nextBal;
      let nextBalType;
      if (isVendor) {
        nextBal = currentBal - addAmt;
        nextBalType = nextBal < -0.005 ? 'Advance' : (nextBal > 0.005 ? 'Payable' : 'Settled');
      } else {
        const isReceivable = party.openingBalanceType === 'Receivable';
        if (isReceivable) {
          nextBal = currentBal - addAmt;
          nextBalType = nextBal < -0.005 ? 'Advance' : (nextBal > 0.005 ? 'Receivable' : 'Settled');
        } else {
          nextBal = currentBal + addAmt;
          nextBalType = 'Advance';
        }
      }

      // 3. Update party current balance and classification - strictly preserving party.type & vendorType
      await updateParty(party.id, {
        type: party.type,
        vendorType: party.vendorType || undefined,
        balance: nextBal,
        openingBalanceType: party.openingBalanceType || nextBalType,
        lastAdvanceAmount: addAmt,
        lastAdvanceDate: new Date().toISOString(),
        lastAdvanceNote: advanceNote || undefined,
        lastAdvanceMode: advanceMode,
      });

      if (typeof showToast === 'function') {
        showToast(`Recorded ${formatCurrency(addAmt)} advance for ${party.name} and posted to Accounts.`);
      }
      setAdvanceModalParty(null);
      setAddAdvanceAmt('');
      setAdvanceNote('');
    } catch (err) {
      setAdvanceError(err?.message || 'Failed to record advance.');
    } finally {
      setAdvanceUpdating(false);
    }
  };

  useEffect(() => {
    if (typeParam && ['customer', 'vendor', 'both'].includes(typeParam.toLowerCase())) {
      setSelectedType(typeParam.charAt(0).toUpperCase() + typeParam.slice(1).toLowerCase());
    } else if (isCustomerContext) {
      setSelectedType('Customer');
    } else if (isVendorContext) {
      setSelectedType('Vendor');
    }
  }, [location.pathname, location.search, isCustomerContext, isVendorContext, typeParam]);

  // Filter parties by type
  const filteredParties = useMemo(() => {
    if (selectedType === 'All') return parties;
    return parties.filter((p) => p.type === selectedType || p.type === 'Both');
  }, [parties, selectedType]);

  // Counts for tabs & KPIs
  const stats = useMemo(() => {
    const total = parties.length;
    const customers = parties.filter((p) => p.type === 'Customer' || p.type === 'Both').length;
    const vendors = parties.filter((p) => p.type === 'Vendor' || p.type === 'Both' || p.type === 'Processor' || p.type === 'Transporter').length;
    const both = parties.filter((p) => p.type === 'Both').length;
    const totalReceivable = parties
      .filter((p) => (p.type === 'Customer' || p.type === 'Both') && (p.openingBalanceType === 'Receivable' || Number(p.balance) > 0))
      .reduce((sum, p) => sum + (Number(p.balance) > 0 ? Number(p.balance) : 0), 0);
    const totalAdvances = parties
      .filter((p) => (p.type === 'Customer' || p.type === 'Both'))
      .reduce((sum, p) => {
        const bal = Number(p.balance) || 0;
        const meta = getPartyBalanceMeta(p);
        if (meta.isAdvance || (bal < 0 && p.openingBalanceType === 'Receivable')) {
          return sum + Math.abs(bal);
        }
        return sum;
      }, 0);
    const totalPayable = parties
      .filter((p) => (p.type === 'Vendor' || p.type === 'Both' || p.type === 'Processor' || p.type === 'Transporter'))
      .reduce((sum, p) => {
        const bal = Number(p.balance) || 0;
        return sum + (bal > 0 ? bal : 0);
      }, 0);
    const totalVendorAdvances = parties
      .filter((p) => (p.type === 'Vendor' || p.type === 'Both' || p.type === 'Processor' || p.type === 'Transporter'))
      .reduce((sum, p) => {
        const bal = Number(p.balance) || 0;
        const meta = getPartyBalanceMeta(p);
        if (meta.isAdvance || bal < 0) {
          return sum + Math.abs(bal);
        }
        return sum;
      }, 0);
    return { total, customers, vendors, both, totalReceivable, totalAdvances, totalPayable, totalVendorAdvances };
  }, [parties]);

  const handleAddNew = () => {
    setEditingParty(null);
    setIsWizardOpen(true);
  };

  const handleEdit = (party) => {
    setEditingParty(party);
    setIsWizardOpen(true);
  };

  const handleView = (party) => {
    setViewingParty(party);
  };

  const columns = [
    {
      header: 'Party Code & Name',
      key: 'name',
      width: '26%',
      render: (party) => {
        const partyName = safeString(party?.name || party?.companyName || party?.company, 'Unnamed Party');
        const initial = getInitial(partyName, 'P');
        const partyCode = safeString(party?.code, '—');
        const gstin = safeString(party?.gstin, '');
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {initial}
            </div>
            <div>
              <div className="font-bold text-text text-xs flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleView(party)}
                  className="hover:text-primary hover:underline text-left font-bold cursor-pointer"
                >
                  {partyName}
                </button>
                {party?.type === 'Both' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-bold border border-purple-200 dark:border-purple-800">
                    Dual
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                <span className="font-mono font-medium">{partyCode}</span>
                {party?.type === 'Transporter' && party?.vehicleNumber && (
                  <>
                    <span>•</span>
                    <span className="font-mono uppercase inline-flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      {party.vehicleNumber}
                    </span>
                  </>
                )}
                {gstin && (
                  <>
                    <span>•</span>
                    <span className="font-mono uppercase">{gstin}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Type',
      key: 'type',
      align: 'center',
      width: '10%',
      render: (party) => {
        const type = party.type;
        const colorClasses =
          type === 'Customer'
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800'
            : type === 'Vendor'
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
            : type === 'Transporter'
            ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800'
            : 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';

        return (
          <div className="inline-flex flex-col items-center gap-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colorClasses}`}>
              {type}
            </span>
            {type === 'Vendor' && party.vendorType && (
              <span className="text-[10px] text-muted font-medium">{party.vendorType}</span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Primary Contact',
      key: 'phone',
      width: '18%',
      render: (party) => (
        <div className="text-xs space-y-0.5">
          <div className="font-medium text-text flex items-center gap-1.5">
            <Phone className="w-3 h-3 text-primary" />
            {party.phone || '—'}
          </div>
          {party.email && (
            <div className="text-muted text-[11px] flex items-center gap-1.5">
              <Mail className="w-3 h-3 text-muted" />
              {party.email}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'GST Treatment',
      key: 'gstTreatment',
      width: '14%',
      render: (party) => (
        <span className="text-[11px] text-text-secondary bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-border">
          {party.gstTreatment || 'Unregistered Business'}
        </span>
      ),
    },
    {
      header: 'Balance',
      key: 'balance',
      align: 'right',
      width: '14%',
      render: (party) => {
        const bal = Number(party.balance) || 0;
        const opBal = Number(party.openingBalance ?? party.opening_balance ?? 0);
        const meta = getPartyBalanceMeta(party);
        const hasBalance = bal !== 0;
        return (
          <div className="text-right">
            <div className={`font-semibold font-mono text-xs ${hasBalance ? meta.tone : 'text-text-secondary'}`}>
              {formatCurrency(meta.isAdvance ? Math.abs(bal) : bal)}
            </div>
            <div className="text-[10px] text-muted flex items-center justify-end gap-1 mt-0.5">
              <span className={`inline-block px-1.5 py-0.2 rounded text-[9.5px] font-semibold border ${meta.badgeClass}`}>
                {meta.label}
              </span>
            </div>
            {opBal !== 0 && (
              <span className="block text-[9.5px] text-slate-400 dark:text-muted mt-0.5">
                Opening: {formatCurrency(Math.abs(opBal))}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Status',
      key: 'status',
      align: 'center',
      width: '10%',
      render: (party) => (
        <StatusBadge status={party.status === 'Active' ? 'Active' : 'Inactive'} />
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'right',
      width: '10%',
      render: (party) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => handleView(party)}
            title="View 360° Profile"
            className="w-7 h-7 rounded-lg bg-card hover:bg-soft text-muted hover:text-primary border border-border flex items-center justify-center transition cursor-pointer shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleEdit(party)}
            title="Edit Registration"
            className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 flex items-center justify-center transition cursor-pointer shadow-2xs"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleOpenAdvanceModal(party)}
            title="Add Advance"
            className="w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center transition cursor-pointer shadow-2xs"
          >
            <IndianRupee className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={
          isCustomerContext
            ? 'Customer Directory (CRM)'
            : isVendorContext
            ? 'Vendor Directory (Purchase & Procurement)'
            : 'Commercial Parties Directory'
        }
        subtitle={
          isCustomerContext
            ? 'Manage customer profiles, credit terms, and billing information with GST & PAN compliance.'
            : isVendorContext
            ? 'Manage supplier profiles, purchase terms, payment conditions, and vendor accounts.'
            : 'Unified master records for Customers, Vendors, and Dual Trading Partners with full statutory compliance.'
        }
        guide={partiesGuide}
        actions={
          <Button onClick={handleAddNew} icon={Plus}>
            {isCustomerContext ? 'Add Customer' : isVendorContext ? 'Add Vendor' : 'Add New Party'}
          </Button>
        }
      />

      {/* Universal KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <KpiCard
          index={0}
          icon={Users}
          label="Total Active Parties"
          value={stats.total}
          sub="All registered entities"
          onClick={() => setSelectedType('All')}
        />
        <KpiCard
          index={1}
          icon={UserCheck}
          label="Customers Registered"
          value={stats.customers}
          sub={`${stats.customers} active buyers`}
          onClick={() => setSelectedType('Customer')}
        />
        <KpiCard
          index={2}
          icon={Building2}
          label="Vendor Accounts"
          value={stats.vendors}
          sub={`${stats.vendors} active suppliers`}
          onClick={() => setSelectedType('Vendor')}
        />
        {selectedType === 'Vendor' ? (
          <>
            <KpiCard
              index={4}
              icon={TrendingDown}
              label="Total Payables"
              value={formatCurrency(stats.totalPayable, { noDecimals: true })}
              sub="Outstanding vendor dues"
            />
            <KpiCard
              index={5}
              icon={CreditCard}
              label="Vendor Advances"
              value={formatCurrency(stats.totalVendorAdvances, { noDecimals: true })}
              sub="Prepaid supplier advances"
            />
          </>
        ) : (
          <>
            <KpiCard
              index={4}
              icon={TrendingUp}
              label="Total Receivables"
              value={formatCurrency(stats.totalReceivable, { noDecimals: true })}
              sub="Outstanding customer dues"
            />
            <KpiCard
              index={5}
              icon={CreditCard}
              label="Customer Advances"
              value={formatCurrency(stats.totalAdvances, { noDecimals: true })}
              sub="Prepaid customer credit"
            />
          </>
        )}
      </div>

      {/* Horizontal Underline Tabs */}
      <div className="border-b border-slate-200 flex flex-nowrap items-center gap-6 overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
        {[
          { id: 'All', label: 'All Parties', count: stats.total },
          { id: 'Customer', label: 'Customers', count: stats.customers },
          { id: 'Vendor', label: 'Vendors', count: stats.vendors },
          { id: 'Both', label: 'Dual Partners', count: stats.both },
        ].map((tab) => {
          const isActive = selectedType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={`shrink-0 lg:shrink pb-3 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer relative ${
                isActive
                  ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Parties Table */}
      <DataTable
        title="Commercial Parties & Compliance Directory"
        columns={columns}
        data={filteredParties}
        keyExtractor={(p) => p.id}
        searchPlaceholder="Filter by name, code, GSTIN, or phone..."
        searchFilter={(p, rawTerm) => {
          const term = String(rawTerm ?? '').trim().toLowerCase();
          if (!term) return true;
          return (
            String(p.name ?? '').toLowerCase().includes(term) ||
            String(p.code ?? '').toLowerCase().includes(term) ||
            (p.gstin && String(p.gstin ?? '').toLowerCase().includes(term)) ||
            (p.phone && p.phone.includes(term))
          );
        }}
      />

      {/* 6-Step Party Wizard Modal */}
      <PartyWizardModal
        isOpen={isWizardOpen}
        onClose={() => {
          setIsWizardOpen(false);
          setEditingParty(null);
        }}
        existingParty={editingParty}
        onSave={(data) => {
          if (editingParty) {
            updateParty(editingParty.id, data);
          } else {
            addParty(data);
          }
        }}
      />

      {/* View Party Details Modal */}
      {viewingParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header using EntityHeroCard styling */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2 lg:gap-0 bg-slate-50/50">
              <div className="flex items-center gap-3.5 min-w-0 lg:min-w-auto">
                <div className="w-12 h-12 shrink-0 lg:shrink rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-blue-500/20">
                  {getInitial(viewingParty?.name || viewingParty?.companyName || viewingParty?.company, 'P')}
                </div>
                <div className="min-w-0 lg:min-w-auto">
                  <h3 className="font-extrabold text-slate-800 text-base flex flex-wrap lg:flex-nowrap items-center gap-2">
                    {safeString(viewingParty?.name || viewingParty?.companyName || viewingParty?.company, 'Unnamed Party')}
                    <StatusBadge status={viewingParty.type === 'Both' ? 'Both' : viewingParty.type} />
                  </h3>
                  <p className="text-xs font-mono text-slate-400">{safeString(viewingParty.code, '—')}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingParty(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
              {/* Statutory & Tax */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" /> GST & Statutory
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">GST Treatment</span>
                    <span className="font-semibold text-slate-800">{viewingParty.gstTreatment || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">GSTIN</span>
                    <span className="font-mono font-bold text-slate-800 uppercase">{viewingParty.gstin || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">PAN</span>
                    <span className="font-mono font-bold text-slate-800 uppercase">{viewingParty.pan || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Place of Supply</span>
                    <span className="font-semibold text-slate-800">{viewingParty.placeOfSupply || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">TDS / TCS</span>
                    <span className="font-semibold text-slate-800">
                      {viewingParty.tdsApplicable
                        ? `TDS (${viewingParty.tdsSection || '194C'} - ${viewingParty.tdsRate || 2}%)`
                        : viewingParty.tcsApplicable
                        ? `TCS (${viewingParty.tcsSection || '206C'} - ${viewingParty.tcsRate || 1}%)`
                        : 'Exempt'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ledger Group</span>
                    <span className="font-semibold text-slate-800">{viewingParty.ledgerAccount || '—'}</span>
                  </div>
                  {viewingParty.vendorType && (
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Vendor Type</span>
                      <span className="font-semibold text-slate-800">{viewingParty.vendorType}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Transport Details — transporters only */}
              {viewingParty.type === 'Transporter' && (
                <div className="bg-cyan-50/60 p-4 rounded-xl border border-cyan-200/80 space-y-2.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-cyan-600" /> Transport Details
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Mobile Number</span>
                      <span className="font-semibold text-slate-800">{viewingParty.phone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Vehicle No</span>
                      <span className="font-mono font-bold text-slate-800 uppercase">{viewingParty.vehicleNumber || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Vehicle Type</span>
                      <span className="font-semibold text-slate-800">{viewingParty.vehicleType || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Capacity</span>
                      <span className="font-semibold text-slate-800">
                        {viewingParty.vehicleCapacity
                          ? `${viewingParty.vehicleCapacity} ${viewingParty.vehicleCapacityUnit || 'Tons'}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial & Bank */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Payment Terms & Banking
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payment Terms</span>
                    <span className="font-semibold text-slate-800">{viewingParty.paymentTerms || 'Net 30'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Credit Limit</span>
                    <span className="font-semibold text-slate-800">
                      ₹{(viewingParty.creditLimit || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Opening Balance</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-slate-800">
                        {formatCurrency(Number(viewingParty.openingBalance ?? viewingParty.opening_balance ?? 0))}
                      </span>
                      <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-semibold border ${getPartyBalanceMeta(viewingParty).badgeClass}`}>
                        {getPartyBalanceMeta(viewingParty).label}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Current Balance</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`font-mono font-bold ${getPartyBalanceMeta(viewingParty).tone}`}>
                        {formatCurrency(viewingParty.balance || 0)}
                      </span>
                      <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-semibold border ${getPartyBalanceMeta(viewingParty).badgeClass}`}>
                        {getPartyBalanceMeta(viewingParty).label}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Bank Name</span>
                    <span className="font-semibold text-slate-800">{viewingParty.bankName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Account Number</span>
                    <span className="font-mono font-semibold text-slate-800">{viewingParty.bankAccountNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">IFSC Code</span>
                    <span className="font-mono font-semibold text-slate-800">{viewingParty.ifscCode || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Billing Address</span>
                  {viewingParty.billingAddress ? (
                    <div className="text-slate-700 text-xs leading-relaxed">
                      <p>{viewingParty.billingAddress.line1}</p>
                      {viewingParty.billingAddress.line2 && <p>{viewingParty.billingAddress.line2}</p>}
                      <p>
                        {viewingParty.billingAddress.city}, {viewingParty.billingAddress.state} -{' '}
                        {viewingParty.billingAddress.pincode}
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">No billing address saved</span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Shipping Address</span>
                  {viewingParty.shippingAddress ? (
                    <div className="text-slate-700 text-xs leading-relaxed">
                      <p>{viewingParty.shippingAddress.line1}</p>
                      {viewingParty.shippingAddress.line2 && <p>{viewingParty.shippingAddress.line2}</p>}
                      <p>
                        {viewingParty.shippingAddress.city}, {viewingParty.shippingAddress.state} -{' '}
                        {viewingParty.shippingAddress.pincode}
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Same as billing address</span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 bg-slate-50/50">
              <button
                type="button"
                onClick={() => {
                  const partyToEdit = viewingParty;
                  setViewingParty(null);
                  handleEdit(partyToEdit);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition cursor-pointer shadow-xs"
              >
                Edit Party Details
              </button>
              <button
                type="button"
                onClick={() => setViewingParty(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Advance / Balance Modal */}
      {advanceModalParty && (() => {
        const isVendor = advanceModalParty.type === 'Vendor' || advanceModalParty.type === 'Processor' || advanceModalParty.type === 'Transporter';
        const currentBal = Number(advanceModalParty.balance) || 0;
        const currentMeta = getPartyBalanceMeta(advanceModalParty);
        const parsedAdd = addAdvanceAmt === '' ? 0 : Number(addAdvanceAmt);
        const addVal = isNaN(parsedAdd) ? 0 : parsedAdd;

        let projectedBal = 0;
        let projectedLabel = 'Settled';

        if (isVendor) {
          projectedBal = currentBal - addVal;
          if (projectedBal < -0.005) {
            projectedLabel = 'Advance';
          } else if (projectedBal > 0.005) {
            projectedLabel = 'Payable';
          } else {
            projectedLabel = 'Settled';
          }
        } else {
          const isReceivable = advanceModalParty.openingBalanceType === 'Receivable';
          if (isReceivable) {
            projectedBal = currentBal - addVal;
            if (projectedBal < -0.005) {
              projectedLabel = 'Advance';
            } else if (projectedBal > 0.005) {
              projectedLabel = 'Receivable';
            } else {
              projectedLabel = 'Settled';
            }
          } else {
            projectedBal = currentBal + addVal;
            projectedLabel = 'Advance';
          }
        }

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => setAdvanceModalParty(null)}
          >
            <div
              className="bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-800 dark:text-text rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-border flex items-center justify-between bg-slate-50/70 dark:bg-soft">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <IndianRupee size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 dark:text-text text-base">
                      {isVendor ? 'Add Vendor Advance / Payment' : 'Add Customer Advance'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-muted truncate max-w-[240px]">
                      {advanceModalParty.name} ({advanceModalParty.code})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAdvanceModalParty(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-text p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-soft transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddAdvance} className="p-5 space-y-4 text-xs">
                {advanceError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 text-xs font-semibold">
                    {advanceError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-slate-50 dark:bg-soft p-3 rounded-xl border border-slate-200/80 dark:border-border">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Current Balance</span>
                    <span className={`font-mono font-bold text-sm block ${currentMeta.tone}`}>
                      {formatCurrency(currentMeta.isAdvance ? Math.abs(currentBal) : currentBal)}
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-semibold">
                      {currentMeta.label}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-soft p-3 rounded-xl border border-slate-200/80 dark:border-border">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Opening Balance</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-text text-sm block">
                      {formatCurrency(Math.abs(Number(advanceModalParty.openingBalance ?? advanceModalParty.opening_balance ?? 0)))}
                    </span>
                    <span className="text-[9.5px] text-slate-400">
                      {advanceModalParty.openingBalanceType || (isVendor ? 'Payable' : 'Advance')}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 dark:text-text text-xs mb-1.5">
                    {isVendor ? 'Advance Amount to Pay (₹)' : 'Advance Amount to Add (₹)'} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IndianRupee size={15} />
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={addAdvanceAmt}
                      onChange={(e) => setAddAdvanceAmt(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                      required
                      className="w-full pl-8 pr-3 py-2.5 bg-white dark:bg-soft border border-slate-300 dark:border-border rounded-xl text-base font-mono font-bold text-slate-900 dark:text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isVendor
                      ? 'Enter advance payment to vendor. This posts a Payment Out voucher directly to Accounts and Bank.'
                      : "Enter advance amount received to add directly to this party's deposit balance."}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-muted text-[11px] mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={advanceMode}
                      onChange={(e) => setAdvanceMode(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-soft border border-slate-300 dark:border-border rounded-xl text-xs font-semibold text-slate-900 dark:text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="Bank Wire Direct">Bank Wire Direct (NEFT/RTGS)</option>
                      <option value="UPI / QR">UPI / QR Transfer</option>
                      <option value="Cash">Cash Deposit</option>
                      <option value="Cheque / DD">Cheque / Demand Draft</option>
                    </select>
                  </div>
                  {advanceMode !== 'Cash' && (
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-muted text-[11px] mb-1">
                        {isVendor ? 'Paid From Bank Account' : 'Deposit Into Bank Account'}
                      </label>
                      <select
                        value={selectedBankId || bankAccounts?.[0]?.id || ''}
                        onChange={(e) => setSelectedBankId(e.target.value)}
                        className="w-full p-2 bg-white dark:bg-soft border border-slate-300 dark:border-border rounded-xl text-xs font-semibold text-slate-900 dark:text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      >
                        {bankAccounts && bankAccounts.length > 0 ? (
                          bankAccounts.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.bankName || b.name || b.bank_name || 'Bank Account'} {b.accountNumber ? `(…${String(b.accountNumber).slice(-4)})` : ''}
                            </option>
                          ))
                        ) : (
                          <option value="">Primary Operating Account</option>
                        )}
                      </select>
                    </div>
                  )}
                  <div className={advanceMode === 'Cash' || !bankAccounts?.length ? 'sm:col-span-2' : 'sm:col-span-2'}>
                    <label className="block font-semibold text-slate-600 dark:text-muted text-[11px] mb-1">
                      Reference / Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={advanceNote}
                      onChange={(e) => setAdvanceNote(e.target.value)}
                      placeholder={isVendor ? 'e.g. Advance for yarn batch, UTR #...' : 'e.g. Advance deposit for fabric order, UTR #...'}
                      className="w-full p-2 bg-white dark:bg-soft border border-slate-300 dark:border-border rounded-xl text-xs text-slate-900 dark:text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                </div>

                {/* Accounts Integration Notice */}
                <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/30 flex items-center gap-2 text-[10.5px] text-blue-800 dark:text-blue-300">
                  <Receipt size={14} className="shrink-0 text-blue-600" />
                  <span>
                    Connected to <strong>Accounts</strong>: Automatically posts a {isVendor ? 'disbursement voucher (Payment Out)' : 'receipt voucher (Payment In)'} to Day Book, Cash & Bank, and General Ledger.
                  </span>
                </div>

                {/* Live Projected Calculation */}
                <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300 block">
                      Projected New Balance
                    </span>
                    <span className="text-[9.5px] text-slate-500">
                      {isVendor ? (
                        <>
                          Current ({formatCurrency(Math.abs(currentBal))} {currentMeta.label}) - Advance Paid ({formatCurrency(addVal)})
                        </>
                      ) : (
                        <>
                          Current ({formatCurrency(Math.abs(currentBal))}) + Advance Received ({formatCurrency(addVal)})
                        </>
                      )}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400 text-sm block">
                      {formatCurrency(Math.abs(projectedBal))}
                    </span>
                    <span className="text-[9.5px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                      {projectedLabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-border">
                  <button
                    type="button"
                    onClick={() => setAdvanceModalParty(null)}
                    className="px-4 py-2 border border-slate-300 dark:border-border hover:bg-slate-100 dark:hover:bg-soft text-slate-700 dark:text-text rounded-xl font-semibold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={advanceUpdating}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-md shadow-emerald-600/20 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 size={15} />
                    <span>{advanceUpdating ? 'Recording...' : (isVendor ? 'Record Advance Payment' : 'Add Advance')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
