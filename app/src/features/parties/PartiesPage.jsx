import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { MetricChip } from '../../components/ui/StatCard';
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
  Truck
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

export default function PartiesPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const typeParam = searchParams.get('type') || searchParams.get('tab');
  const isCustomerContext = location.pathname.includes('/crm/customers') || typeParam?.toLowerCase() === 'customer';
  const isVendorContext = location.pathname.includes('/purchase/vendors') || typeParam?.toLowerCase() === 'vendor';

  const { parties = [], addParty, updateParty, formatCurrency } = useERP();
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
    const vendors = parties.filter((p) => p.type === 'Vendor' || p.type === 'Both').length;
    const both = parties.filter((p) => p.type === 'Both').length;
    const totalReceivable = parties
      .filter((p) => p.type === 'Customer' || p.type === 'Both')
      .reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);
    const totalPayable = parties
      .filter((p) => p.type === 'Vendor' || p.type === 'Both')
      .reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);
    return { total, customers, vendors, both, totalReceivable, totalPayable };
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
        const bal = party.balance || 0;
        const isPositive = bal > 0;
        return (
          <div className="text-right">
            <div className={`font-semibold font-mono text-xs ${isPositive ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-text-secondary'}`}>
              {formatCurrency(bal)}
            </div>
            <div className="text-[10px] text-muted">
              {party.type === 'Vendor' ? 'Payable' : 'Receivable'}
            </div>
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
      width: '8%',
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

      {/* Modern Colorful Metric Badges Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricChip
          icon={Users}
          label="Total Active Parties"
          value={stats.total}
          colorScheme="blue"
        />
        <MetricChip
          icon={UserCheck}
          label="Customers Registered"
          value={stats.customers}
          colorScheme="emerald"
        />
        <MetricChip
          icon={TrendingDown}
          label="Vendor Accounts"
          value={stats.vendors}
          colorScheme="amber"
        />
        <MetricChip
          icon={TrendingUp}
          label="Total Receivables"
          value={formatCurrency(stats.totalReceivable, { noDecimals: true })}
          colorScheme="rose"
        />
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
        searchFilter={(p, term) =>
          String(p.name ?? '').toLowerCase().includes(term) ||
          String(p.code ?? '').toLowerCase().includes(term) ||
          (p.gstin && String(p.gstin ?? '').toLowerCase().includes(term)) ||
          (p.phone && p.phone.includes(term))
        }
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
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Current Balance</span>
                    <span className="font-mono font-bold text-amber-700">
                      ₹{(viewingParty.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
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
    </div>
  );
}
