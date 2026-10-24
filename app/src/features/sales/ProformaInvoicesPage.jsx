import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import {
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  Receipt,
  Eye,
  Printer,
  X,
  Copy,
  Edit2,
  ArrowRight,
  Maximize2,
  Minimize2,
  DollarSign,
  Clock,
  Send,
  AlertCircle,
  FileCheck2,
  ShieldAlert,
  Building2,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  Ban,
  Download,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LineItemEditor } from '../../components/common/LineItemEditor';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import { PageHeader } from '../../components/common/PageHeader';
import { PrintProformaInvoiceModal } from '../../components/common/PrintProformaInvoiceModal';

const proformaGuide = {
  title: 'Proforma Invoices',
  subtitle: 'Preliminary commercial offers, proposed payment schedules, and pre-billing agreements.',
  purpose: 'A Proforma Invoice is an official preliminary commercial commitment sent to prospects or clients before actual order dispatch and final tax billing. It outlines expected deliverables, price schedules, and proposed payment milestones without posting to the General Ledger or prematurely starting equipment warranties.',
  keyTerms: [
    { term: 'Proforma Invoice (PI)', definition: 'A preliminary commercial offer used for import clearance, advance deposits, or fund approvals before final tax invoicing.' },
    { term: 'Proposed Payment Schedule', definition: 'Commercial milestone distribution (e.g. 50% advance, 50% on dispatch) defining terms without recording received revenue.' },
    { term: 'Non-Tax Entity', definition: 'Does NOT post Accounts Receivable debt or GL revenue until converted into a Final Sales Invoice.' },
    { term: 'Warranty Pending', definition: 'Product and machine warranties remain inactive and pending until final invoicing, delivery, or commissioning.' },
  ],
  tips: [
    'Use "Create Final Invoice" to convert an approved Proforma Invoice into a formal Tax Invoice in 1 click.',
    'You can modify, add, or remove line items during the Final Invoice review step.',
    'Click "Print / PDF" on any Proforma to generate an official commercial voucher with your company bank details.',
  ],
  workflow: ['Quotation / Sales Order', 'Proforma Invoice Issued', 'Advance Payment Cleared', 'Warehouse Dispatch', 'Final Sales Tax Invoice'],
};

const PAYMENT_PRESETS = {
  '50_50': {
    label: '50% Advance • 50% Before Dispatch',
    schedules: [
      { milestone: 'Advance Booking Deposit', pct: 50, due: 'Upon Commercial Acceptance' },
      { milestone: 'Pre-Dispatch Balance', pct: 50, due: 'Before Warehouse Dispatch' },
    ],
  },
  '30_40_30': {
    label: '30% Advance • 40% Before Dispatch • 30% After Installation',
    schedules: [
      { milestone: 'Mobilization Advance', pct: 30, due: 'Upon Agreement Signing' },
      { milestone: 'Factory Dispatch Gate-Pass', pct: 40, due: 'Prior to Transit' },
      { milestone: 'Site Handover & Sign-off', pct: 30, due: 'Within 7 Days of Setup' },
    ],
  },
  '100_ADVANCE': {
    label: '100% Advance Prior to Build / Fulfillment',
    schedules: [
      { milestone: 'Full Advance Payment', pct: 100, due: 'Before Production Start' },
    ],
  },
  'NET_30': {
    label: 'Net 30 Days from Delivery',
    schedules: [
      { milestone: 'Net 30 Invoicing', pct: 100, due: '30 Days Net from Delivery' },
    ],
  },
  'CUSTOM': {
    label: 'Custom Milestone Schedule',
    schedules: [
      { milestone: 'Stage 1 Advance', pct: 40, due: 'Initial Booking' },
      { milestone: 'Stage 2 Delivery', pct: 60, due: 'Upon Delivery' },
    ],
  },
};

export const ProformaInvoicesPage = () => {
  const navigate = useNavigate();
  const {
    proformaInvoices = [],
    addProformaInvoice,
    updateProformaInvoice,
    updateProformaInvoiceStatus,
    convertProformaToInvoice,
    deleteProformaInvoice,
    customers = [],
    salesOrders = [],
    invoices = [],
    formatCurrency,
    formatDateDDMMYYYY,
    getCurrentDateFormatted,
    companyProfile,
  } = useERP();

  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingPi, setEditingPi] = useState(null);
  const [selectedPi, setSelectedPi] = useState(null);
  const [deleteTargetPi, setDeleteTargetPi] = useState(null);
  const [printPiTarget, setPrintPiTarget] = useState(null);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [proformaNumber, setProformaNumber] = useState('');
  const [proformaDate, setProformaDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('30 Days');
  const [linkedSoId, setLinkedSoId] = useState('None');
  const [contactPerson, setContactPerson] = useState('');
  const [billingAddress, setBillingAddress] = useState({ line1: '', city: '', state: '', pincode: '' });
  const [shippingAddress, setShippingAddress] = useState({ line1: '', city: '', state: '', pincode: '' });
  const [paymentPresetKey, setPaymentPresetKey] = useState('50_50');
  const [paymentSchedule, setPaymentSchedule] = useState(PAYMENT_PRESETS['50_50'].schedules);
  const [otherCharges, setOtherCharges] = useState(0);
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState(
    '1. This Proforma Invoice is a preliminary commercial offer and not a final tax invoice.\n2. Prices and discounts are valid for 30 calendar days.\n3. Equipment warranty becomes active only upon Final Tax Invoicing and clinical commissioning.'
  );
  const [lineItems, setLineItems] = useState([]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  // Recalculate totals
  const subtotal = lineItems.reduce((acc, it) => acc + (Number(it.rate || 0) * Number(it.qty || 1)), 0);
  const discountTotal = lineItems.reduce((acc, it) => {
    const itemSub = Number(it.rate || 0) * Number(it.qty || 1);
    const discPct = Number(it.discount || 0);
    return acc + (itemSub * (discPct / 100));
  }, 0);
  const taxableAmount = Math.max(0, subtotal - discountTotal);
  
  // Tax logic: Check if customer is intra-state (Maharashtra 27) or inter-state
  const isInterState = selectedCustomer?.placeOfSupply && !selectedCustomer.placeOfSupply.includes('27') && !selectedCustomer.placeOfSupply.includes('Maharashtra');
  const computedTotalTax = lineItems.reduce((acc, it) => {
    const lTax = it.tax !== undefined && it.tax !== null ? Number(it.tax) : 5;
    const lSub = (Number(it.rate) || 0) * (Number(it.qty) || 1) * (1 - (Number(it.discount) || 0) / 100);
    return acc + (lSub * (lTax / 100));
  }, 0);
  const totalTaxAmount = Math.round(computedTotalTax * 100) / 100;
  const cgst = !isInterState ? Math.round((totalTaxAmount / 2) * 100) / 100 : 0;
  const sgst = !isInterState ? Math.round((totalTaxAmount - cgst) * 100) / 100 : 0;
  const igst = isInterState ? totalTaxAmount : 0;
  const grandTotal = Math.round((taxableAmount + totalTaxAmount + Number(otherCharges || 0)) * 100) / 100;

  // Sync Customer info on customer select
  const handleCustomerChange = (custId) => {
    setSelectedCustomerId(custId);
    const cust = customers.find((c) => c.id === custId);
    if (cust) {
      setContactPerson(cust.contactPerson || '');
      if (cust.billingAddress) setBillingAddress(cust.billingAddress);
      if (cust.shippingAddress) setShippingAddress(cust.shippingAddress);
    }
  };

  // Sync Linked Sales Order on SO select
  const handleSoSelect = (soId) => {
    setLinkedSoId(soId);
    if (soId !== 'None') {
      const order = salesOrders.find((o) => o.id === soId || o.orderNumber === soId);
      if (order) {
        if (order.customerId) handleCustomerChange(order.customerId);
        if (order.items && order.items.length > 0) {
          setLineItems(
            order.items.map((it) => ({
              ...it,
              id: `li-pi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              unit: it.unit || 'Unit',
              rate: it.rate || 0,
              discount: it.discount || 0,
              tax: it.tax ?? it.taxRate ?? 5,
              taxAmount: Math.round((it.rate || 0) * (it.qty || 1) * (1 - (it.discount || 0) / 100) * ((Number(it.tax ?? it.taxRate ?? 5)) / 100) * 100) / 100,
              amount: Math.round((it.rate || 0) * (it.qty || 1) * (1 - (it.discount || 0) / 100) * (1 + (Number(it.tax ?? it.taxRate ?? 5)) / 100) * 100) / 100,
              warrantyStatus: 'Pending Final Invoicing / Commissioning',
            }))
          );
        }
      }
    }
  };

  const handleOpenCreateModal = () => {
    const cust = customers[0];
    setSelectedCustomerId(cust?.id || '');
    setProformaNumber(''); // allocated by the server on save
    setProformaDate(new Date().toISOString().split('T')[0]);
    setValidUntil('30 Days');
    setLinkedSoId('None');
    setContactPerson(cust?.contactPerson || '');
    setBillingAddress(cust?.billingAddress || { line1: 'Corporate Headquarters', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' });
    setShippingAddress(cust?.shippingAddress || { line1: 'Corporate Headquarters', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' });
    setPaymentPresetKey('50_50');
    setPaymentSchedule(PAYMENT_PRESETS['50_50'].schedules);
    setOtherCharges(0);
    setNotes('Preliminary commercial offer for procurement review.');
    setTermsAndConditions(
      '1. This Proforma Invoice is a preliminary commercial offer and not a final tax invoice.\n2. Prices and discounts are valid for 30 calendar days.\n3. Equipment warranty becomes active only upon Final Tax Invoicing and clinical commissioning.'
    );
    setLineItems([]);
    setEditingPi(null);
    setIsFullscreen(false);
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (pi) => {
    setSelectedCustomerId(pi.customerId || customers[0]?.id || '');
    setProformaNumber(pi.proformaNumber);
    setProformaDate(pi.date || new Date().toISOString().split('T')[0]);
    setValidUntil(pi.validUntil || '30 Days');
    setLinkedSoId(pi.salesOrderId || pi.linkedSo || 'None');
    setContactPerson(pi.customerContact || '');
    setBillingAddress(pi.billingAddress || { line1: '', city: '', state: '', pincode: '' });
    setShippingAddress(pi.shippingAddress || { line1: '', city: '', state: '', pincode: '' });
    setPaymentPresetKey('CUSTOM');
    setPaymentSchedule(pi.paymentSchedule || PAYMENT_PRESETS['50_50'].schedules);
    setOtherCharges(pi.otherCharges || 0);
    setNotes(pi.notes || '');
    setTermsAndConditions(pi.termsAndConditions || '');
    setLineItems(pi.items || []);
    setEditingPi(pi);
    setIsFullscreen(false);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setEditingPi(null);
    setLineItems([]);
    setIsFullscreen(false);
  };

  const handlePresetChange = (presetKey) => {
    setPaymentPresetKey(presetKey);
    if (PAYMENT_PRESETS[presetKey]) {
      setPaymentSchedule(PAYMENT_PRESETS[presetKey].schedules);
    }
  };

  const handleUpdateScheduleMilestone = (idx, field, val) => {
    setPaymentSchedule((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const handleAddScheduleMilestone = () => {
    setPaymentSchedule((prev) => [
      ...prev,
      { milestone: `Milestone ${prev.length + 1}`, pct: 10, due: 'Upon Notification' },
    ]);
  };

  const handleRemoveScheduleMilestone = (idx) => {
    setPaymentSchedule((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = (status = 'Draft') => {
    const cust = customers.find((c) => c.id === selectedCustomerId) || customers[0];
    const so = salesOrders.find((o) => o.id === linkedSoId || o.orderNumber === linkedSoId);

    // Compute milestone amounts
    const computedSchedule = paymentSchedule.map((s) => ({
      ...s,
      amount: Math.round(grandTotal * (Number(s.pct || 0) / 100) * 100) / 100,
    }));

    const payload = {
      id: editingPi ? editingPi.id : undefined,
      proformaNumber: proformaNumber || undefined,
      customerId: cust?.id,
      customer: cust?.name,
      customerContact: contactPerson || cust?.contactPerson || '',
      billingAddress,
      shippingAddress,
      salesOrderId: so?.id || (linkedSoId !== 'None' ? linkedSoId : null),
      linkedSo: so?.orderNumber || (linkedSoId !== 'None' ? linkedSoId : null),
      date: proformaDate,
      validUntil,
      status: editingPi ? (status || editingPi.status) : status,
      paymentTerms: PAYMENT_PRESETS[paymentPresetKey]?.label || 'Custom Milestone Schedule',
      paymentSchedule: computedSchedule,
      items: lineItems.length > 0 ? lineItems : [
        {
          id: `li-pi-${Date.now()}`,
          description: 'Standard Order Merchandise Package',
          qty: 1,
          unit: 'Unit',
          rate: 5000,
          discount: 0,
          tax: 18,
          taxAmount: 900,
          amount: 5900,
          warrantyStatus: 'Pending Final Invoicing / Commissioning',
        },
      ],
      subtotal: subtotal > 0 ? subtotal : 5000,
      discountTotal,
      taxableAmount: taxableAmount > 0 ? taxableAmount : 5000,
      cgst,
      sgst,
      igst,
      otherCharges: Number(otherCharges || 0),
      roundOff: 0,
      total: grandTotal > 0 ? grandTotal : 5900,
      grandTotal: grandTotal > 0 ? grandTotal : 5900,
      notes,
      termsAndConditions,
    };

    if (editingPi) {
      updateProformaInvoice(editingPi.id, payload);
    } else {
      addProformaInvoice(payload);
    }

    handleCloseCreateModal();
  };

  const handleClonePi = (pi) => {
    setSelectedCustomerId(pi.customerId || customers[0]?.id || '');
    setProformaNumber(''); // allocated by the server on save
    setProformaDate(new Date().toISOString().split('T')[0]);
    setValidUntil(pi.validUntil || '30 Days');
    setLinkedSoId(pi.salesOrderId || pi.linkedSo || 'None');
    setContactPerson(pi.customerContact || '');
    setBillingAddress(pi.billingAddress || { line1: '', city: '', state: '', pincode: '' });
    setShippingAddress(pi.shippingAddress || { line1: '', city: '', state: '', pincode: '' });
    setPaymentPresetKey('CUSTOM');
    setPaymentSchedule(pi.paymentSchedule || PAYMENT_PRESETS['50_50'].schedules);
    setOtherCharges(pi.otherCharges || 0);
    setNotes(`Cloned from ${pi.proformaNumber}. ${pi.notes || ''}`);
    setTermsAndConditions(pi.termsAndConditions || '');
    setLineItems((pi.items || []).map((it) => ({
      ...it,
      id: `li-pi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    })));
    setEditingPi(null);
    setIsFullscreen(false);
    setShowCreateModal(true);
  };

  const handleDirectConvertToInvoice = (pi) => {
    const createdInvoice = convertProformaToInvoice(pi.id);
    if (createdInvoice) {
      navigate('/sales/invoices');
    }
  };

  const filteredInvoices = proformaInvoices.filter((pi) => {
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Converted') return pi.status === 'Converted';
    return pi.status === statusFilter;
  });

  // KPI Calculations
  const totalPiCount = proformaInvoices.length;
  const activePipelineValue = proformaInvoices
    .filter((pi) => pi.status !== 'Converted' && pi.status !== 'Cancelled' && pi.status !== 'Rejected')
    .reduce((sum, pi) => sum + (pi.grandTotal || pi.total || 0), 0);
  const convertedCount = proformaInvoices.filter((pi) => pi.status === 'Converted').length;
  const sentCount = proformaInvoices.filter((pi) => pi.status === 'Sent' || pi.status === 'Accepted').length;

  const columns = [
    {
      key: 'proformaNumber',
      header: 'Proforma #',
      width: '12%',
      render: (pi) => (
        <button
          onClick={() => setSelectedPi(pi)}
          className="font-mono font-bold text-primary hover:underline flex items-center gap-1.5 text-left cursor-pointer whitespace-nowrap"
        >
          <FileSpreadsheet size={13} className="text-muted shrink-0" />
          <span>{pi.proformaNumber}</span>
        </button>
      ),
    },
    {
      key: 'customer',
      header: 'Customer Account',
      width: '16%',
      render: (pi) => (
        <div className="min-w-0">
          <span className="font-bold text-text block truncate">{pi.customer}</span>
          {pi.customerContact && <span className="text-[11px] text-muted block truncate">{pi.customerContact}</span>}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'PI Date',
      width: '9%',
      render: (pi) => <span className="text-muted font-mono text-[11px] whitespace-nowrap">{formatDateDDMMYYYY(pi.date)}</span>,
    },
    {
      key: 'validUntil',
      header: 'Valid Until',
      width: '9%',
      render: (pi) => <span className="text-muted font-mono text-[11px] whitespace-nowrap">{formatDateDDMMYYYY(pi.validUntil)}</span>,
    },
    {
      key: 'paymentTerms',
      header: 'Proposed Payment Terms',
      width: '20%',
      render: (pi) => {
        let termsText = 'Standard Terms';
        if (typeof pi.paymentTerms === 'string' && pi.paymentTerms.trim()) {
          termsText = pi.paymentTerms;
        } else if (Array.isArray(pi.paymentTerms)) {
          termsText = pi.paymentTerms.map((t) => {
            if (typeof t === 'string') return t;
            if (t && typeof t === 'object') return t.name || t.milestone || `${t.percentage ?? t.pct ?? ''}%`;
            return '';
          }).filter(Boolean).join(' • ') || 'Custom Milestone Schedule';
        } else if (pi.paymentTerms && typeof pi.paymentTerms === 'object') {
          termsText = pi.paymentTerms.name || pi.paymentTerms.milestone || 'Custom Terms';
        } else if (Array.isArray(pi.paymentSchedule) && pi.paymentSchedule.length > 0) {
          termsText = pi.paymentSchedule.map((s) => `${s.pct ?? s.percentage ?? 0}% ${s.milestone || ''}`).join(' • ');
        }
        return (
          <span className="text-[11px] font-medium text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 block truncate max-w-[210px]" title={termsText}>
            {termsText}
          </span>
        );
      },
    },
    {
      key: 'amount',
      header: 'Grand Total',
      align: 'right',
      width: '10%',
      render: (pi) => (
        <span className="font-mono font-bold text-text whitespace-nowrap">
          {formatCurrency(pi.grandTotal ?? pi.total ?? 0)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '12%',
      render: (pi) => {
        if (pi.status === 'Converted') {
          return (
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap">
                <CheckCircle2 size={11} /> Converted
              </span>
              {pi.convertedInvoiceNumber && (
                <button
                  onClick={() => navigate('/sales/invoices')}
                  className="text-[10px] font-mono font-semibold text-primary hover:underline mt-0.5 cursor-pointer"
                >
                  {pi.convertedInvoiceNumber}
                </button>
              )}
            </div>
          );
        }
        return <StatusBadge status={pi.status || 'Draft'} />;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '12%',
      render: (pi) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <button
            onClick={() => setSelectedPi(pi)}
            className="p-1.5 text-muted hover:text-primary hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            title="View Details"
          >
            <Eye size={13} />
          </button>
          <button
            onClick={() => setPrintPiTarget(pi)}
            className="p-1.5 text-muted hover:text-primary hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            title="Print Official Proforma Invoice Voucher"
          >
            <Printer size={13} />
          </button>
          <button
            onClick={() => handleClonePi(pi)}
            className="p-1.5 text-muted hover:text-primary hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            title="Clone / Duplicate Proforma"
          >
            <Copy size={13} />
          </button>
          {pi.status === 'Draft' && (
            <button
              onClick={() => setDeleteTargetPi(pi)}
              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
              title="Delete Draft Proforma"
            >
              <Trash2 size={13} />
            </button>
          )}
          {pi.status !== 'Converted' && pi.status !== 'Cancelled' ? (
            <button
              onClick={() => handleDirectConvertToInvoice(pi)}
              className="px-2.5 py-1 bg-primary text-white rounded-md text-xs font-semibold hover:bg-primary-hover cursor-pointer inline-flex items-center gap-1 shadow-xs transition-colors whitespace-nowrap"
              title="Create Final Tax Invoice"
            >
              <Receipt size={12} /> Convert
            </button>
          ) : pi.status === 'Converted' ? (
            <button
              onClick={() => navigate('/sales/invoices')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <CheckCircle2 size={12} /> View
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proforma Invoices"
        subtitle="Preliminary commercial offers, milestone payment schedules, and pre-billing agreements before final tax invoicing."
        guide={proformaGuide}
        actions={
          <Button icon={Plus} onClick={handleOpenCreateModal}>
            Create Proforma Invoice
          </Button>
        }
      />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Proformas Issued" value={totalPiCount} icon={FileSpreadsheet} />
        <StatCard
          label="Active Proforma Pipeline"
          value={formatCurrency(activePipelineValue)}
          icon={DollarSign}
          trend={{ positive: true, text: `${sentCount} active in negotiation` }}
          highlight={activePipelineValue > 0}
        />
        <StatCard
          label="Converted to Final Invoices"
          value={`${convertedCount} Converted`}
          icon={CheckCircle2}
          trend={{ positive: true, text: 'Direct Tax Invoice Conversion' }}
        />
        <StatCard
          label="Commercial Payment Guard"
          value="Non-Tax / Pre-GL"
          icon={Clock}
          subtext="No AR/GL liability generated"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-nowrap items-center gap-2 border-b border-[#CED4DA] pb-2 text-xs overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
        {['All', 'Draft', 'Sent', 'Accepted', 'Converted', 'Cancelled'].map((stg) => (
          <button
            key={stg}
            onClick={() => setStatusFilter(stg)}
            className={`shrink-0 lg:shrink px-3 py-1.5 rounded-t font-semibold transition-colors cursor-pointer ${
              statusFilter === stg
                ? 'bg-white border-t-2 border-[#1F2E4A] text-[#1F2E4A] shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {stg === 'Converted' ? 'Converted to Final Invoice' : stg}
          </button>
        ))}
      </div>

      {/* Main Register Table */}
      <DataTable
        title="Proforma Invoice Register"
        data={filteredInvoices}
        columns={columns}
        keyExtractor={(pi) => pi.id}
        searchPlaceholder="Search proforma #, customer, or payment terms..."
        searchFilter={(pi, term) => {
          let termsStr = '';
          if (typeof pi.paymentTerms === 'string') {
            termsStr = pi.paymentTerms;
          } else if (Array.isArray(pi.paymentTerms)) {
            termsStr = pi.paymentTerms.map((t) => (typeof t === 'string' ? t : (t.name || t.milestone || ''))).join(' ');
          }
          return (
            (pi.proformaNumber || '').toLowerCase().includes(term) ||
            (pi.customer || '').toLowerCase().includes(term) ||
            termsStr.toLowerCase().includes(term) ||
            (pi.status || '').toLowerCase().includes(term)
          );
        }}
      />

      {/* Create / Edit Proforma Modal (with Fullscreen option) */}
      {showCreateModal && (
        <div className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center transition-all duration-200 ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
          <div
            className={`bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
              isFullscreen ? 'w-full h-full rounded-none p-4 sm:p-8' : 'max-w-5xl w-full rounded-2xl p-4 sm:p-6 max-h-[92vh]'
            } text-xs`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 lg:gap-0 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3 min-w-0 lg:min-w-auto">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1F2E4A]">
                    {editingPi ? `Edit Proforma Invoice (${editingPi.proformaNumber})` : 'Create Proforma Invoice'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Preliminary commercial document • Non-accounting offer • Equipment warranty remains pending
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Maximize Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={(e) => { e.preventDefault(); handleSave('Sent'); }} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              {/* Header Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Customer Account */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 block">Customer Account *</label>
                    <MasterSourceLink source="customers" />
                  </div>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-medium"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) - Balance: ₹{c.balance.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  {selectedCustomer && (
                    <div className="mt-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>{selectedCustomer.name}</span>
                        <span className="text-blue-700 font-mono text-[10px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          Credit Limit: {Number(selectedCustomer.creditLimit) > 0 ? `₹${Number(selectedCustomer.creditLimit).toLocaleString('en-IN')}` : 'Not set'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600 text-[10px]">
                        <span>POC: <strong>{contactPerson || selectedCustomer.contactPerson || 'Account Lead'}</strong></span>
                        <span>Email: {selectedCustomer.email}</span>
                        <span>Place of Supply: {selectedCustomer.placeOfSupply || 'Maharashtra (27)'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Document Information */}
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Proforma Invoice #</label>
                    <input
                      type="text"
                      readOnly
                      value={proformaNumber}
                      placeholder="Assigned on save"
                      title="Numbers come from the PI series on the server"
                      className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-mono font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Date</label>
                      <input
                        type="date"
                        required
                        value={proformaDate}
                        onChange={(e) => setProformaDate(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Valid Until</label>
                      <input
                        type="text"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        placeholder="e.g. 30 Days"
                        className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Linked Sales Order / Reference */}
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Source Sales Order (Optional)</label>
                    <select
                      value={linkedSoId}
                      onChange={(e) => handleSoSelect(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-medium"
                    >
                      <option value="None">-- Direct Proforma (No Linked SO) --</option>
                      {salesOrders.map((so) => (
                        <option key={so.id} value={so.id}>
                          {so.orderNumber} - {so.customer} ({formatCurrency(so.amount ?? so.total ?? 0)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Customer Contact Person</label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      placeholder="e.g. Sarah Connor (Procurement Lead)"
                      className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div>
                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 mb-2">
                  <label className="font-semibold text-slate-800 block text-xs">
                    Product Line Items & Machine Components
                  </label>
                  <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1 font-semibold">
                    <ShieldAlert size={12} /> Warranty Activation: Pending Final Invoice
                  </span>
                </div>
                <LineItemEditor items={lineItems} onChange={setLineItems} type="sales" />
              </div>

              {/* Proposed Payment Information & Totals Split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                {/* Proposed Payment Terms & Milestones */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <Clock size={14} className="text-blue-600" /> Proposed Payment Terms & Schedule
                      </h4>
                      <p className="text-[10px] text-slate-500">Commercial payment milestones • Does not post received revenue</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddScheduleMilestone}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> Add Milestone
                    </button>
                  </div>

                  {/* Preset Selector */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Payment Schedule Preset</label>
                    <select
                      value={paymentPresetKey}
                      onChange={(e) => handlePresetChange(e.target.value)}
                      className="w-full p-1.5 text-xs border border-slate-300 rounded bg-white font-medium"
                    >
                      {Object.entries(PAYMENT_PRESETS).map(([key, obj]) => (
                        <option key={key} value={key}>
                          {obj.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Milestone Rows */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {paymentSchedule.map((s, idx) => (
                      <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 text-xs">
                        <input
                          type="text"
                          value={s.milestone}
                          onChange={(e) => handleUpdateScheduleMilestone(idx, 'milestone', e.target.value)}
                          placeholder="Milestone description"
                          className="flex-1 basis-full sm:basis-0 p-1 text-xs border border-slate-200 rounded"
                        />
                        <div className="flex items-center gap-1 w-20 shrink-0">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={s.pct}
                            onChange={(e) => handleUpdateScheduleMilestone(idx, 'pct', Number(e.target.value))}
                            className="w-12 p-1 text-xs border border-slate-200 rounded text-right font-mono"
                          />
                          <span className="text-[11px] text-slate-500">%</span>
                        </div>
                        <span className="font-mono font-bold text-slate-700 w-24 text-right text-xs shrink-0">
                          {formatCurrency(grandTotal * (Number(s.pct || 0) / 100))}
                        </span>
                        <input
                          type="text"
                          value={s.due || ''}
                          onChange={(e) => handleUpdateScheduleMilestone(idx, 'due', e.target.value)}
                          placeholder="Trigger/Due"
                          className="w-28 p-1 text-xs border border-slate-200 rounded text-[11px]"
                        />
                        {paymentSchedule.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveScheduleMilestone(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-900 text-[10px] flex items-start gap-2">
                    <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      Payment schedule information defined in a Proforma Invoice is for commercial alignment only. It does not record actual accounts receivable or revenue receipts.
                    </span>
                  </div>
                </div>

                {/* Financial Totals Breakdown Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 pb-1 border-b border-slate-200">
                    <DollarSign size={14} className="text-emerald-600" /> Commercial Price & Tax Summary
                  </h4>

                  <div className="flex justify-between py-0.5 text-slate-600">
                    <span>Subtotal (Gross):</span>
                    <span className="font-mono font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
                  </div>

                  {discountTotal > 0 && (
                    <div className="flex justify-between py-0.5 text-emerald-700">
                      <span>Discount Total:</span>
                      <span className="font-mono font-semibold">- {formatCurrency(discountTotal)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-0.5 font-semibold text-slate-700">
                    <span>Taxable Value:</span>
                    <span className="font-mono">{formatCurrency(taxableAmount)}</span>
                  </div>

                  {!isInterState ? (
                    <>
                      <div className="flex justify-between py-0.5 text-slate-500 text-[11px]">
                        <span>CGST (9% Intra-state):</span>
                        <span className="font-mono">{formatCurrency(cgst)}</span>
                      </div>
                      <div className="flex justify-between py-0.5 text-slate-500 text-[11px]">
                        <span>SGST (9% Intra-state):</span>
                        <span className="font-mono">{formatCurrency(sgst)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between py-0.5 text-slate-500 text-[11px]">
                      <span>IGST (18% Inter-state):</span>
                      <span className="font-mono">{formatCurrency(igst)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-1 border-t border-slate-200">
                    <span className="text-slate-600">Other Charges (Freight/Handling):</span>
                    <div className="w-28">
                      <input
                        type="number"
                        value={otherCharges}
                        onChange={(e) => setOtherCharges(Number(e.target.value))}
                        className="w-full p-1 text-right border border-slate-300 rounded font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-slate-300 font-bold text-sm text-[#1F2E4A]">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base text-blue-700">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Notes & Commercial Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Commercial Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Quotation valid for hospital Phase 2 wing. Delivery scheduled within 3 weeks of advance deposit."
                    className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Commercial Terms & Conditions</label>
                  <textarea
                    rows={3}
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 text-xs"
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <Button variant="outline" type="button" onClick={handleCloseCreateModal}>
                  Cancel
                </Button>
                <button
                  type="button"
                  onClick={() => handleSave('Draft')}
                  className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-semibold text-xs transition cursor-pointer"
                >
                  Save as Draft
                </button>
                <Button type="submit">
                  {editingPi ? 'Update Proforma Invoice' : 'Save & Mark Sent'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 360 Detail & Printable Voucher Modal */}
      {selectedPi && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-4 sm:p-6 text-xs max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header Toolbar */}
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 lg:gap-0 pb-3 border-b border-slate-200 bg-slate-50 -m-4 mb-4 p-4 sm:-m-6 sm:mb-4 sm:p-6">
              <div className="flex items-center gap-3 min-w-0 lg:min-w-auto">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-800">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                    <h3 className="font-bold text-lg text-[#1F2E4A]">{selectedPi.proformaNumber}</h3>
                    <StatusBadge status={selectedPi.status} />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Customer: <strong>{selectedPi.customer}</strong> • Date: {formatDateDDMMYYYY(selectedPi.date)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintPiTarget(selectedPi)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer size={13} /> Print / PDF
                </button>
                {selectedPi.status === 'Draft' && (
                  <button
                    type="button"
                    onClick={() => {
                      const pi = selectedPi;
                      setSelectedPi(null);
                      setDeleteTargetPi(pi);
                    }}
                    className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Trash2 size={13} /> Delete Draft
                  </button>
                )}
                {selectedPi.status !== 'Converted' && selectedPi.status !== 'Cancelled' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const piToEdit = selectedPi;
                        setSelectedPi(null);
                        handleOpenEditModal(piToEdit);
                      }}
                      className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDirectConvertToInvoice(selectedPi);
                        setSelectedPi(null);
                      }}
                      className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Receipt size={13} /> Create Final Invoice
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedPi(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg hover:bg-slate-200 ml-1"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Voucher Content */}
            <div className="overflow-y-auto space-y-5 pr-1 flex-1 text-xs">
              {/* Commercial Watermark Banner */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 text-blue-900 text-xs">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-blue-600 shrink-0" />
                  <span>
                    <strong>PRELIMINARY COMMERCIAL PROFORMA INVOICE:</strong> Not an official tax invoice. Equipment warranty remains pending until Final Invoice issuance.
                  </span>
                </div>
                <span className="font-mono text-[10px] font-bold uppercase bg-blue-200/60 px-2 py-0.5 rounded">
                  Non-Accounting Document
                </span>
              </div>

              {/* Company & Client Header Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl border border-slate-200 bg-white">
                <div>
                  {/* [PHASE-2E.1] company identity from companyProfile (was hardcoded Evenmore strings) */}
                  <h4 className="font-extrabold text-sm text-[#1F2E4A] mb-1">{companyProfile?.name || 'EVENMORE ERP MEDICAL & SYSTEMS'}</h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {companyProfile?.address || 'Corporate Towers, Sector 62, Electronic City<br />Bengaluru, Karnataka - 560100, India'}<br />
                    <strong>GSTIN:</strong> {companyProfile?.gstin || '29AABCU9912E1Z8'} • <strong>PAN:</strong> {companyProfile?.pan || 'AABCU9912E'}<br />
                    <strong>Email:</strong> billing@sweven.in • <strong>Phone:</strong> {companyProfile?.phone || '+91 80 4920 1100'}
                  </p>
                </div>

                <div className="sm:text-right">
                  <h4 className="font-bold text-xs uppercase text-slate-400 mb-1">PROFORMA INVOICE RECIPIENT</h4>
                  <p className="font-bold text-sm text-slate-800">{selectedPi.customer}</p>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {selectedPi.billingAddress?.line1 || 'Main Facility Center'}<br />
                    {selectedPi.billingAddress?.city || 'Mumbai'}, {selectedPi.billingAddress?.state || 'Maharashtra'} - {selectedPi.billingAddress?.pincode || '400001'}<br />
                    <strong>Contact:</strong> {selectedPi.customerContact || 'Primary Lead'}
                  </p>
                </div>
              </div>

              {/* Meta Parameters Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block font-semibold uppercase">Proforma #</span>
                  <span className="font-mono font-bold text-slate-800">{selectedPi.proformaNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-semibold uppercase">Proforma Date</span>
                  <span className="font-mono text-slate-800">{formatDateDDMMYYYY(selectedPi.date)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-semibold uppercase">Valid Until</span>
                  <span className="font-mono text-slate-800">{formatDateDDMMYYYY(selectedPi.validUntil)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-semibold uppercase">Sales Order Ref</span>
                  <span className="font-mono text-slate-800">{selectedPi.linkedSo || 'Direct PI'}</span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full min-w-[640px] lg:min-w-0 text-xs text-left">
                  <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 text-[11px]">
                    <tr>
                      <th className="p-2.5 w-8 text-center">#</th>
                      <th className="p-2.5">Product & Machine Deliverables</th>
                      <th className="p-2.5 text-center w-16">Qty</th>
                      <th className="p-2.5 text-right w-24">Unit Rate</th>
                      <th className="p-2.5 text-center w-16">GST</th>
                      <th className="p-2.5 text-right w-24">Tax Amount</th>
                      <th className="p-2.5 text-right w-28">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedPi.items || []).map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-2.5">
                          <span className="font-bold text-slate-800 block">{it.name || it.description}</span>
                          <span className="font-mono text-[10px] text-slate-400 mr-2">SKU: {it.sku || it.itemSku || 'GEN-SKU'}</span>
                          {it.serialNumber && (
                            <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 mr-2">
                              SN: {it.serialNumber}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            Warranty: Pending Final Invoicing
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-mono font-semibold">{it.qty} {it.unit || 'Unit'}</td>
                        <td className="p-2.5 text-right font-mono">{formatCurrency(it.rate || 0)}</td>
                        <td className="p-2.5 text-center font-mono">{it.tax ?? 5}%</td>
                        <td className="p-2.5 text-right font-mono">{formatCurrency(it.taxAmount || ((Number(it.rate) || 0) * (Number(it.qty) || 1) * ((Number(it.tax ?? 5)) / 100)))}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                          {formatCurrency(it.amount || ((Number(it.rate) || 0) * (Number(it.qty) || 1) * (1 + (Number(it.tax ?? 5)) / 100)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Proposed Schedule & Financials Split */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {/* Proposed Payment Milestones */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Clock size={13} className="text-blue-600" /> Proposed Milestone Schedule
                  </h4>
                  <div className="space-y-1.5">
                    {(selectedPi.paymentSchedule || []).map((s, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 text-[11px]">
                        <div>
                          <span className="font-semibold text-slate-800 block">{s.milestone}</span>
                          <span className="text-[10px] text-slate-500">Trigger: {s.due || 'Standard'}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold font-mono text-blue-700 block">
                            {formatCurrency(s.amount || (selectedPi.grandTotal * (Number(s.pct || 0) / 100)))}
                          </span>
                          <span className="text-[10px] text-slate-400">({s.pct}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Wire Transfer Banking Info */}
                  <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-[10px] text-blue-900 space-y-0.5">
                    <p className="font-bold uppercase tracking-wider text-blue-800">Bank Wire Details for Deposit:</p>
                    <p><strong>Bank:</strong> HDFC Bank Ltd • <strong>A/C:</strong> 992810029311 • <strong>IFSC:</strong> HDFC0001245</p>
                    <p><strong>Beneficiary:</strong> Evenmore Medical Systems Private Limited</p>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold">{formatCurrency(selectedPi.subtotal || 0)}</span>
                  </div>
                  {selectedPi.discountTotal > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount:</span>
                      <span className="font-mono font-semibold">- {formatCurrency(selectedPi.discountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>Taxable Amount:</span>
                    <span className="font-mono">{formatCurrency(selectedPi.taxableAmount || selectedPi.subtotal || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>CGST + SGST (18% / IGST):</span>
                    <span className="font-mono">{formatCurrency((selectedPi.cgst || 0) + (selectedPi.sgst || 0) + (selectedPi.igst || 0))}</span>
                  </div>
                  {selectedPi.otherCharges !== 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Other Charges (Freight):</span>
                      <span className="font-mono">{formatCurrency(selectedPi.otherCharges || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-300 font-extrabold text-sm text-[#1F2E4A]">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base text-blue-700">
                      {formatCurrency(selectedPi.grandTotal || selectedPi.total || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes & Commercial Terms */}
              {selectedPi.notes && (
                <div className="p-3 rounded-xl border border-slate-200 bg-white text-[11px]">
                  <span className="font-bold text-slate-700 block mb-0.5">Commercial Notes:</span>
                  <p className="text-slate-600">{selectedPi.notes}</p>
                </div>
              )}

              {selectedPi.termsAndConditions && (
                <div className="p-3 rounded-xl border border-slate-200 bg-white text-[11px]">
                  <span className="font-bold text-slate-700 block mb-0.5">Terms & Conditions:</span>
                  <p className="text-slate-600 whitespace-pre-line">{selectedPi.termsAndConditions}</p>
                </div>
              )}
            </div>

            {/* Modal Bottom Footer */}
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-3 border-t border-slate-200 mt-4">
              <span className="text-[11px] text-slate-400">
                Commercial document • Created via Evenmore ERP Unified Platform
              </span>
              <Button variant="outline" onClick={() => setSelectedPi(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Draft Confirmation Modal */}
      {deleteTargetPi && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-6 text-xs flex flex-col space-y-4 max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-rose-50 text-rose-600 shrink-0 border border-rose-100">
                <Trash2 size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-800">Delete Draft Proforma</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Are you sure you want to permanently delete draft proforma{' '}
                  <strong className="text-slate-800 font-mono">{deleteTargetPi.proformaNumber}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-slate-600 text-xs">
              <div className="flex justify-between items-center">
                <span>Customer Account:</span>
                <span className="font-semibold text-slate-800">{deleteTargetPi.customer}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>PI Date:</span>
                <span className="font-mono text-slate-700">{formatDateDDMMYYYY(deleteTargetPi.date)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="font-medium text-slate-700">Grand Total:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(deleteTargetPi.grandTotal ?? deleteTargetPi.total ?? 0)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              This action will remove the draft proforma invoice from your register. This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                type="button"
                onClick={() => setDeleteTargetPi(null)}
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => {
                  deleteProformaInvoice(deleteTargetPi.id);
                  setDeleteTargetPi(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 size={13} /> Delete Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Executive Proforma Invoice Print Voucher */}
      <PrintProformaInvoiceModal
        isOpen={Boolean(printPiTarget)}
        onClose={() => setPrintPiTarget(null)}
        proforma={printPiTarget}
      />
    </div>
  );
};
