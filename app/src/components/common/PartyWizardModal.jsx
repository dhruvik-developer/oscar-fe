import React, { useState, useEffect } from 'react';
import {
    X,
    ChevronRight,
    ChevronLeft,
    CheckCircle2,
    User,
    Building2,
    Receipt,
    Percent,
    BookOpen,
    CreditCard,
    MapPin,
    Plus,
    Trash2,
    ShieldCheck,
    Hash,
    Phone,
    Mail,
    Check,
    Sparkles,
    AlertCircle,
    Truck
} from 'lucide-react';

const STEPS = [
    { id: 1, label: 'Basic Info', sublabel: 'Identity & Type', icon: User },
    { id: 2, label: 'GST & Tax', sublabel: 'GSTIN & PAN', icon: Receipt },
    { id: 3, label: 'TDS / TCS', sublabel: 'Withholding Rules', icon: Percent },
    { id: 4, label: 'Ledger', sublabel: 'Chart of Accounts', icon: BookOpen },
    { id: 5, label: 'Payment & Bank', sublabel: 'Credit & Banking', icon: CreditCard },
    { id: 6, label: 'Addresses & POC', sublabel: 'Locations & Contacts', icon: MapPin },
];

const PARTY_TYPES = [
    {
        id: 'Customer',
        label: 'Customer',
        subtext: 'Client / Buyer for Sales Orders & Invoices',
        icon: User,
        activeClass: 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20',
        activeIconClass: 'bg-blue-600 text-white',
    },
    {
        id: 'Vendor',
        label: 'Vendor',
        subtext: 'Supplier / Provider for Purchase Orders & Bills',
        icon: Building2,
        activeClass: 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20',
        activeIconClass: 'bg-amber-600 text-white',
    },
    {
        id: 'Both',
        label: 'Dual Partner',
        subtext: 'Both Supplier & Buyer across ERP workflows',
        icon: Sparkles,
        activeClass: 'bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400 ring-2 ring-purple-500/20',
        activeIconClass: 'bg-purple-600 text-white',
    },
];

/** Supplier classification — shown only when the role is Vendor. */
const VENDOR_TYPE_OPTIONS = [
    'Manufacturing',
    'Dyeing - Other Process',
];

/** Fleet classification — shown only when the role is Transporter. */
const VEHICLE_TYPE_OPTIONS = [
    'Truck',
    'Mini Truck / LCV',
    'Trailer',
    'Container',
    'Tanker',
    'Tempo',
    'Other',
];

const CAPACITY_UNIT_OPTIONS = ['Tons', 'Kg', 'Litres', 'Taka'];

const getInitialFormData = (party) => {
    if (!party) {
        return {
            code: '',
            type: 'Customer',
            vendorType: '',
            vehicleNumber: '',
            vehicleType: '',
            vehicleCapacity: '',
            vehicleCapacityUnit: 'Tons',
            name: '',
            phone: '',
            email: '',
            status: 'Active',
            gstTreatment: 'Registered Business',
            gstin: '',
            pan: '',
            placeOfSupply: 'Maharashtra (27)',
            gstNotes: '',
            tdsApplicable: false,
            tdsSection: '194C',
            tdsRate: 2,
            tcsApplicable: false,
            tcsSection: '206C',
            tcsRate: 0.1,
            ledgerAccount: '1210 - Accounts Receivable',
            creditLimit: 50000,
            paymentTerms: 'Net 30',
            bankName: '',
            bankAccountNumber: '',
            ifscCode: '',
            accountHolderName: '',
            openingBalance: 0,
            balance: 0,
            billingAddress: {
                line1: '',
                line2: '',
                city: '',
                state: 'Maharashtra',
                pincode: '',
            },
            shippingAddress: {
                line1: '',
                line2: '',
                city: '',
                state: 'Maharashtra',
                pincode: '',
            },
            contacts: [
                { id: 'cnt-1', name: '', role: 'Primary POC', phone: '', email: '' },
            ],
        };
    }

    const partyName = party.name || party.companyName || party.company || '';
    const derivedPan = party.pan || (party.gstin && party.gstin.length >= 12 ? party.gstin.substring(2, 12) : '');

    return {
        id: party.id,
        code: party.code || '',
        type: party.type || 'Customer',
        vendorType: party.vendorType || party.vendor_type || '',
        vehicleNumber: party.vehicleNumber || party.vehicle_number || '',
        vehicleType: party.vehicleType || party.vehicle_type || '',
        vehicleCapacity: party.vehicleCapacity ?? party.vehicle_capacity ?? '',
        vehicleCapacityUnit: party.vehicleCapacityUnit || party.vehicle_capacity_unit || 'Tons',
        name: partyName,
        phone: party.phone || '',
        email: party.email || '',
        status: party.status || 'Active',
        gstTreatment: party.gstTreatment || 'Registered Business',
        gstin: party.gstin || '',
        pan: derivedPan,
        placeOfSupply: party.placeOfSupply || 'Maharashtra (27)',
        gstNotes: party.gstNotes || '',
        tdsApplicable: party.tdsApplicable ?? false,
        tdsSection: party.tdsSection || '194C',
        tdsRate: party.tdsRate ?? 2,
        tcsApplicable: party.tcsApplicable ?? false,
        tcsSection: party.tcsSection || '206C',
        tcsRate: party.tcsRate ?? 0.1,
        ledgerAccount: party.ledgerAccount || (party.type === 'Vendor' ? '2010 - Accounts Payable' : '1210 - Accounts Receivable'),
        creditLimit: party.creditLimit ?? 50000,
        paymentTerms: party.paymentTerms || 'Net 30',
        bankName: party.bankName || '',
        bankAccountNumber: party.bankAccountNumber || '',
        ifscCode: party.ifscCode || '',
        accountHolderName: party.accountHolderName || partyName,
        openingBalance: party.openingBalance ?? 0,
        balance: party.balance ?? 0,
        billingAddress: party.billingAddress ? {
            line1: party.billingAddress.line1 || '',
            line2: party.billingAddress.line2 || '',
            city: party.billingAddress.city || '',
            state: party.billingAddress.state || 'Maharashtra',
            pincode: party.billingAddress.pincode || '',
        } : {
            line1: '',
            line2: '',
            city: '',
            state: 'Maharashtra',
            pincode: '',
        },
        shippingAddress: party.shippingAddress ? {
            line1: party.shippingAddress.line1 || '',
            line2: party.shippingAddress.line2 || '',
            city: party.shippingAddress.city || '',
            state: party.shippingAddress.state || 'Maharashtra',
            pincode: party.shippingAddress.pincode || '',
        } : {
            line1: '',
            line2: '',
            city: '',
            state: 'Maharashtra',
            pincode: '',
        },
        contacts: Array.isArray(party.contacts) && party.contacts.length > 0 ? party.contacts : [
            { id: 'cnt-1', name: '', role: 'Primary POC', phone: '', email: '' },
        ],
    };
};

export const PartyWizardModal = ({ isOpen, onClose, onSave, existingParty = null }) => {
    const [step, setStep] = useState(1);
    const [sameAsBilling, setSameAsBilling] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [formData, setFormData] = useState(() => getInitialFormData(existingParty));

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setErrorMsg('');
            setFormData(getInitialFormData(existingParty));
            if (existingParty?.shippingAddress && existingParty?.billingAddress) {
                const isIdentical =
                    existingParty.shippingAddress.line1 === existingParty.billingAddress.line1 &&
                    existingParty.shippingAddress.city === existingParty.billingAddress.city &&
                    existingParty.shippingAddress.pincode === existingParty.billingAddress.pincode;
                setSameAsBilling(isIdentical);
            } else {
                setSameAsBilling(true);
            }
        }
    }, [isOpen, existingParty]);

    if (!isOpen) return null;

    const updateField = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrorMsg('');
    };

    const handleTypeChange = (newType) => {
        setFormData((prev) => ({
            ...prev,
            type: newType,
            // Vendor Type classifies pure suppliers only — it has no meaning
            // on a Customer, Dual Partner or Transporter.
            vendorType: newType === 'Vendor' ? prev.vendorType : '',
            // Fleet details belong to transporters alone.
            vehicleNumber: newType === 'Transporter' ? prev.vehicleNumber : '',
            vehicleType: newType === 'Transporter' ? prev.vehicleType : '',
            vehicleCapacity: newType === 'Transporter' ? prev.vehicleCapacity : '',
            vehicleCapacityUnit: newType === 'Transporter' ? prev.vehicleCapacityUnit : 'Tons',
            // Suppliers and transporters are paid by us; customers pay us.
            ledgerAccount:
                (newType === 'Vendor' || newType === 'Transporter') && prev.ledgerAccount === '1210 - Accounts Receivable'
                    ? '2010 - Accounts Payable'
                    : (newType === 'Customer' || newType === 'Both') && prev.ledgerAccount === '2010 - Accounts Payable'
                        ? '1210 - Accounts Receivable'
                        : prev.ledgerAccount,
        }));
        setErrorMsg('');
    };

    const handleGstinChange = (val) => {
        const uppercaseVal = val.toUpperCase();
        const updates = { gstin: uppercaseVal };
        if (uppercaseVal.length >= 12 && (!formData.pan || formData.pan === formData.gstin?.substring(2, 12))) {
            updates.pan = uppercaseVal.substring(2, 12);
        }
        setFormData((prev) => ({ ...prev, ...updates }));
        setErrorMsg('');
    };

    const updateBillingAddress = (field, value) => {
        setFormData((prev) => {
            const updatedBilling = { ...prev.billingAddress, [field]: value };
            return {
                ...prev,
                billingAddress: updatedBilling,
                shippingAddress: sameAsBilling ? { ...updatedBilling } : prev.shippingAddress,
            };
        });
        setErrorMsg('');
    };

    const updateShippingAddress = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            shippingAddress: { ...prev.shippingAddress, [field]: value },
        }));
    };

    const handleAddContact = () => {
        setFormData((prev) => ({
            ...prev,
            contacts: [
                ...prev.contacts,
                { id: `cnt-${Date.now()}`, name: '', role: 'Accounts POC', phone: '', email: '' },
            ],
        }));
    };

    const handleRemoveContact = (id) => {
        if (formData.contacts.length <= 1) return;
        setFormData((prev) => ({
            ...prev,
            contacts: prev.contacts.filter((c) => c.id !== id),
        }));
    };

    const handleUpdateContact = (id, field, value) => {
        setFormData((prev) => ({
            ...prev,
            contacts: prev.contacts.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
        }));
    };

    const validateStep = (currentStep) => {
        if (currentStep === 1) {
            if (!formData.name.trim()) {
                setErrorMsg(formData.type === 'Transporter'
                    ? 'Transporter Name is required to proceed.'
                    : 'Legal Company / Entity Name is required to proceed.');
                return false;
            }
            if (formData.type === 'Transporter') {
                if (!String(formData.phone || '').trim()) {
                    setErrorMsg('Mobile Number is required for a Transporter.');
                    return false;
                }
                if (!String(formData.vehicleNumber || '').trim()) {
                    setErrorMsg('Vehicle No is required for a Transporter.');
                    return false;
                }
                if (!formData.vehicleType) {
                    setErrorMsg('Please select the Vehicle Type for a Transporter.');
                    return false;
                }
                if (formData.vehicleCapacity === '' || Number(formData.vehicleCapacity) <= 0) {
                    setErrorMsg('Vehicle Capacity is required for a Transporter (greater than zero).');
                    return false;
                }
            }
        }
        if (currentStep === 2) {
            if (formData.gstTreatment === 'Registered Business') {
                if (!formData.gstin || formData.gstin.trim().length < 5) {
                    setErrorMsg('A valid 15-character GSTIN is required for Registered Business entities.');
                    return false;
                }
            }
        }
        return true;
    };

    const handleNext = () => {
        if (validateStep(step)) {
            setStep((prev) => Math.min(6, prev + 1));
        }
    };

    const handleBack = () => {
        setErrorMsg('');
        setStep((prev) => Math.max(1, prev - 1));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validateStep(step)) return;

        const payload = {
            ...formData,
            // The columns are nullable; a stale classification on the wrong
            // role is worse than none at all.
            vendorType: formData.type === 'Vendor' ? formData.vendorType : '',
            vehicleNumber: formData.type === 'Transporter' ? formData.vehicleNumber : '',
            vehicleType: formData.type === 'Transporter' ? formData.vehicleType : '',
            vehicleCapacity: formData.type === 'Transporter' ? formData.vehicleCapacity : '',
            vehicleCapacityUnit: formData.type === 'Transporter' ? formData.vehicleCapacityUnit : '',
            shippingAddress: sameAsBilling ? { ...formData.billingAddress } : formData.shippingAddress,
        };
        onSave(payload);
        onClose();
    };

    const progressPercentage = Math.round((step / 6) * 100);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border text-text rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top Header: Soft Shiny Neutral Shade in Light Mode, Adaptive Card in Dark Mode */}
                <div className="bg-gradient-to-r from-slate-50 via-[#f0f5fc] to-slate-100/90 dark:from-card dark:via-card dark:to-card border-b border-slate-200/80 dark:border-border text-slate-800 dark:text-text p-5 sm:p-6 flex flex-col gap-3.5 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-white dark:bg-primary/10 border border-slate-200/80 dark:border-primary/20 text-blue-600 dark:text-primary flex items-center justify-center font-bold shrink-0 shadow-xs">
                                <Building2 size={22} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono tracking-wider uppercase text-blue-700 dark:text-primary font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-primary/10 border border-blue-200/60 dark:border-primary/20">
                                        Commercial Registry
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-muted font-medium">
                                        Step {step} of 6
                                    </span>
                                </div>
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-text tracking-tight mt-0.5">
                                    {existingParty ? `Edit Commercial Party: ${existingParty.name}` : 'Register New Commercial Party'}
                                </h2>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 border border-transparent hover:border-slate-200 transition cursor-pointer dark:text-muted dark:hover:text-text dark:hover:bg-soft dark:hover:border-border"
                            title="Close modal"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Progress Bar (Soft Shiny Gradient in Light Mode, Primary in Dark Mode) */}
                    <div className="w-full bg-slate-200/80 dark:bg-border/60 h-1.5 rounded-full overflow-hidden shadow-inner">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 dark:bg-primary rounded-full transition-all duration-300 shadow-xs"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>

                {/* Theme-Adaptive Stepper Navigation */}
                <div className="bg-card border-b border-border px-4 py-2.5 overflow-x-auto scrollbar-none">
                    <div className="flex items-center justify-between gap-1.5 min-w-[560px]">
                        {STEPS.map((s) => {
                            const Icon = s.icon;
                            const isActive = step === s.id;
                            const isCompleted = step > s.id;
                            return (
                                <button
                                    type="button"
                                    key={s.id}
                                    onClick={() => isCompleted && setStep(s.id)}
                                    disabled={!isCompleted && !isActive}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                        isActive
                                            ? 'bg-primary/10 text-primary border border-primary/30 ring-1 ring-primary/20 font-bold'
                                            : isCompleted
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/15'
                                            : 'text-muted hover:text-text cursor-not-allowed opacity-50'
                                    }`}
                                >
                                    <div
                                        className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                            isActive
                                                ? 'bg-primary text-white shadow-xs'
                                                : isCompleted
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-soft text-muted'
                                        }`}
                                    >
                                        {isCompleted ? <Check size={11} strokeWidth={3} /> : s.id}
                                    </div>
                                    <div className="text-left">
                                        <div className="leading-tight">{s.label}</div>
                                        <div className={`text-[9px] font-normal ${isActive ? 'text-primary' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'}`}>
                                            {s.sublabel}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                    <div className="mx-4 sm:mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-150">
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* Scrollable Step Content */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs text-text">
                    {/* STEP 1: Basic Info */}
                    {step === 1 && (
                        <div className="space-y-5 animate-in fade-in duration-150">
                            <div>
                                <label className="block font-bold text-text text-xs mb-2">
                                    Entity Role & Classification <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {PARTY_TYPES.map((pt) => {
                                        const Icon = pt.icon;
                                        const isSelected = formData.type === pt.id;
                                        return (
                                            <div
                                                key={pt.id}
                                                onClick={() => handleTypeChange(pt.id)}
                                                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                                    isSelected
                                                        ? pt.activeClass
                                                        : 'bg-card border-border hover:border-primary/40 hover:bg-soft/40'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className={`p-2 rounded-lg ${isSelected ? pt.activeIconClass : 'bg-soft text-muted'}`}>
                                                        <Icon size={16} />
                                                    </div>
                                                    {isSelected && (
                                                        <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shadow-xs">
                                                            <Check size={11} strokeWidth={3} />
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-text text-xs">{pt.label}</div>
                                                    <div className="text-[10px] text-muted mt-0.5 leading-snug">{pt.subtext}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Vendor Type — only meaningful for pure suppliers */}
                            {formData.type === 'Vendor' && (
                                <div className="animate-in fade-in duration-150">
                                    <label className="block font-bold text-text mb-1.5">
                                        Vendor Type
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                                            <Building2 size={14} />
                                        </div>
                                        <select
                                            value={formData.vendorType}
                                            onChange={(e) => updateField('vendorType', e.target.value)}
                                            className="w-full pl-9 pr-3 py-2.5 bg-soft border border-border rounded-xl text-xs font-semibold text-text focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                        >
                                            <option value="">Select vendor type…</option>
                                            {VENDOR_TYPE_OPTIONS.map((vt) => (
                                                <option key={vt} value={vt}>{vt}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <p className="text-[10px] text-muted mt-1.5">
                                        Classifies the supplier for purchase &amp; job-work reports.
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-bold text-text mb-1.5">
                                        Partner Master Code
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                                            <Hash size={14} />
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.code}
                                            onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                                            className="w-full pl-9 pr-3 py-2.5 bg-soft border border-border rounded-xl font-mono text-xs uppercase font-bold text-text focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                            placeholder="Auto-assigned on save"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-bold text-text mb-1.5">
                                        Lifecycle Status
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => updateField('status', e.target.value)}
                                        className="w-full p-2.5 bg-soft border border-border rounded-xl text-xs font-semibold text-text focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                    >
                                        <option value="Active">🟢 Active (Operational)</option>
                                        <option value="On Hold">🟡 On Hold (Temporary Lock)</option>
                                        <option value="Inactive">⚪ Inactive (Dormant)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-text mb-1.5">
                                    {formData.type === 'Transporter' ? 'Transporter Name' : 'Legal Company / Trade Entity Name'} <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                                        <Building2 size={16} />
                                    </div>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => updateField('name', e.target.value)}
                                        className="w-full pl-10 pr-3 py-2.5 bg-soft border border-border rounded-xl text-xs font-medium text-text focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                        placeholder={formData.type === 'Transporter' ? 'e.g. Sharma Roadlines / Ramesh Transport Co.' : 'e.g. Acme Corporation Pvt Ltd / Reliance Heavy Engineering'}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-bold text-text mb-1.5">
                                        {formData.type === 'Transporter' ? 'Mobile Number' : 'Corporate Phone'}
                                        {formData.type === 'Transporter' && <span className="text-rose-500"> *</span>}
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                                            <Phone size={14} />
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={(e) => updateField('phone', e.target.value)}
                                            className="w-full pl-9 pr-3 py-2.5 bg-soft border border-border rounded-xl text-xs font-medium text-text focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                            placeholder={formData.type === 'Transporter' ? '+91 98765 43210' : '+1 (555) 000-0000'}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-bold text-text mb-1.5">
                                        Official Billing / Accounts Email
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                                            <Mail size={14} />
                                        </div>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => updateField('email', e.target.value)}
                                            className="w-full pl-9 pr-3 py-2.5 bg-soft border border-border rounded-xl text-xs font-medium text-text focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                            placeholder="billing@partner.com"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Transport Details — required for Transporters */}
                            {formData.type === 'Transporter' && (
                                <div className="p-4 rounded-xl border border-cyan-200/70 dark:border-cyan-500/20 bg-cyan-50/40 dark:bg-cyan-500/5 space-y-4 animate-in fade-in duration-150">
                                    <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
                                        <Truck size={15} />
                                        <span className="font-bold text-xs uppercase tracking-wide">Transport Details</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block font-bold text-text mb-1.5">
                                                Vehicle No <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.vehicleNumber}
                                                onChange={(e) => updateField('vehicleNumber', e.target.value.toUpperCase())}
                                                className="w-full px-3 py-2.5 bg-card border border-border rounded-xl font-mono text-xs uppercase font-bold text-text focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                                placeholder="MH-12-AB-1234"
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-bold text-text mb-1.5">
                                                Vehicle Type <span className="text-rose-500">*</span>
                                            </label>
                                            <select
                                                value={formData.vehicleType}
                                                onChange={(e) => updateField('vehicleType', e.target.value)}
                                                className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-semibold text-text focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                            >
                                                <option value="">Select vehicle type…</option>
                                                {VEHICLE_TYPE_OPTIONS.map((vt) => (
                                                    <option key={vt} value={vt}>{vt}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block font-bold text-text mb-1.5">
                                            Capacity <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={formData.vehicleCapacity}
                                                onChange={(e) => updateField('vehicleCapacity', e.target.value)}
                                                className="flex-1 px-3 py-2.5 bg-card border border-border rounded-xl text-xs font-semibold text-text focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                                placeholder="e.g. 10"
                                            />
                                            <select
                                                value={formData.vehicleCapacityUnit}
                                                onChange={(e) => updateField('vehicleCapacityUnit', e.target.value)}
                                                className="w-28 p-2.5 bg-card border border-border rounded-xl text-xs font-semibold text-text focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                            >
                                                {CAPACITY_UNIT_OPTIONS.map((unit) => (
                                                    <option key={unit} value={unit}>{unit}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <p className="text-[10px] text-muted mt-1.5">
                                            Maximum load the vehicle can carry — used on dispatch documents.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: GST & Tax */}
                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-bold text-text mb-1.5">
                                        GST Registration Treatment <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={formData.gstTreatment}
                                        onChange={(e) => updateField('gstTreatment', e.target.value)}
                                        className="w-full p-2.5 bg-soft border border-border rounded-xl text-xs font-semibold text-text focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                    >
                                        <option value="Registered Business">Registered Business (Regular / Composition)</option>
                                        <option value="Unregistered Business">Unregistered Business</option>
                                        <option value="Consumer">Consumer (B2C Retail)</option>
                                        <option value="Overseas">Overseas / Export Entity</option>
                                        <option value="SEZ">Special Economic Zone (SEZ Unit)</option>
                                        <option value="Deemed Export">Deemed Export</option>
                                    </select>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block font-bold text-text">
                                            GSTIN Number {formData.gstTreatment === 'Registered Business' && <span className="text-rose-500">*</span>}
                                        </label>
                                        {formData.gstin && (
                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                Valid Structure
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                                            <Receipt size={14} />
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.gstin}
                                            onChange={(e) => handleGstinChange(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2.5 bg-soft border border-border rounded-xl text-xs font-mono uppercase font-bold text-text focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none disabled:opacity-50"
                                            placeholder="27AABCA1234F1Z5"
                                            maxLength={15}
                                            disabled={formData.gstTreatment !== 'Registered Business' && formData.gstTreatment !== 'SEZ'}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-bold text-text mb-1.5">
                                        Place of Supply (Tax Jurisdiction)
                                    </label>
                                    <select
                                        value={formData.placeOfSupply}
                                        onChange={(e) => updateField('placeOfSupply', e.target.value)}
                                        className="w-full p-2.5 bg-soft border border-border rounded-xl text-xs font-medium text-text focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                    >
                                        <option value="Maharashtra (27)">Maharashtra (27) - Intra-State CGST+SGST</option>
                                        <option value="Karnataka (29)">Karnataka (29) - Inter-State IGST</option>
                                        <option value="Delhi (07)">Delhi (07) - Inter-State IGST</option>
                                        <option value="Tamil Nadu (33)">Tamil Nadu (33) - Inter-State IGST</option>
                                        <option value="Gujarat (24)">Gujarat (24) - Inter-State IGST</option>
                                        <option value="Telangana (36)">Telangana (36) - Inter-State IGST</option>
                                        <option value="Other / International (99)">Other / International (99) - Export</option>
                                    </select>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block font-bold text-text">
                                            PAN (Permanent Account Number)
                                        </label>
                                        <span className="text-[10px] text-muted">10-Digit Entity PAN</span>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                                            <ShieldCheck size={14} />
                                        </div>
                                        <input
                                            type="text"
                                            value={formData.pan}
                                            onChange={(e) => updateField('pan', e.target.value.toUpperCase())}
                                            className="w-full pl-9 pr-3 py-2.5 bg-soft border border-border rounded-xl text-xs font-mono uppercase font-bold text-text focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none"
                                            placeholder="AABCA1234F"
                                            maxLength={10}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-text mb-1.5">
                                    GST / Statutory Invoicing Remarks & Notes
                                </label>
                                <textarea
                                    rows={3}
                                    value={formData.gstNotes}
                                    onChange={(e) => updateField('gstNotes', e.target.value)}
                                    className="w-full p-3 bg-soft border border-border rounded-xl text-xs text-text focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition outline-none resize-none"
                                    placeholder="LUT registration reference, HSN exemptions, zero-rated export declarations, or reverse charge applicability..."
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 3: TDS / TCS */}
                    {step === 3 && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            {/* TDS Card */}
                            <div className={`p-4.5 rounded-2xl border transition-all ${formData.tdsApplicable ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20' : 'bg-soft/40 border-border'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${formData.tdsApplicable ? 'bg-primary text-white' : 'bg-soft text-muted border border-border'}`}>
                                            <Percent size={18} />
                                        </div>
                                        <div>
                                            <span className="font-bold text-text text-xs block">TDS Withholding Tax Applicable</span>
                                            <p className="text-muted text-[11px]">Automatically deduct tax on vendor procurement disbursements</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.tdsApplicable}
                                            onChange={(e) => updateField('tdsApplicable', e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>

                                {formData.tdsApplicable && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3.5 mt-3.5 border-t border-border animate-in fade-in duration-150">
                                        <div>
                                            <label className="block font-bold text-text mb-1">TDS Section Code</label>
                                            <select
                                                value={formData.tdsSection}
                                                onChange={(e) => updateField('tdsSection', e.target.value)}
                                                className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-semibold text-text focus:ring-2 focus:ring-primary/20"
                                            >
                                                <option value="194C">194C - Contractor & Transport (1% / 2%)</option>
                                                <option value="194J">194J - Professional & Technical Services (10%)</option>
                                                <option value="194Q">194Q - Purchase of Commercial Goods (0.1%)</option>
                                                <option value="194H">194H - Brokerage & Commission (5%)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block font-bold text-text mb-1">TDS Deduction Rate (%)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={formData.tdsRate}
                                                    onChange={(e) => updateField('tdsRate', parseFloat(e.target.value) || 0)}
                                                    className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-mono font-bold text-text"
                                                />
                                                <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted font-bold">%</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* TCS Card */}
                            <div className={`p-4.5 rounded-2xl border transition-all ${formData.tcsApplicable ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20' : 'bg-soft/40 border-border'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${formData.tcsApplicable ? 'bg-primary text-white' : 'bg-soft text-muted border border-border'}`}>
                                            <Receipt size={18} />
                                        </div>
                                        <div>
                                            <span className="font-bold text-text text-xs block">TCS Collection Applicable</span>
                                            <p className="text-muted text-[11px]">Collect Tax at Source on outward commercial sales over thresholds</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.tcsApplicable}
                                            onChange={(e) => updateField('tcsApplicable', e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>

                                {formData.tcsApplicable && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3.5 mt-3.5 border-t border-border animate-in fade-in duration-150">
                                        <div>
                                            <label className="block font-bold text-text mb-1">TCS Section Code</label>
                                            <select
                                                value={formData.tcsSection}
                                                onChange={(e) => updateField('tcsSection', e.target.value)}
                                                className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-semibold text-text"
                                            >
                                                <option value="206C">206C - Collection on Sale of Goods (0.1%)</option>
                                                <option value="206C(1H)">206C(1H) - High Turnover Sales (0.1%)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block font-bold text-text mb-1">TCS Rate (%)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.tcsRate}
                                                    onChange={(e) => updateField('tcsRate', parseFloat(e.target.value) || 0)}
                                                    className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-mono font-bold text-text"
                                                />
                                                <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted font-bold">%</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Ledger */}
                    {step === 4 && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="p-4 bg-soft/50 border border-border rounded-2xl space-y-3">
                                <label className="block font-bold text-text text-xs">
                                    Primary Chart of Accounts Mapping <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={formData.ledgerAccount}
                                    onChange={(e) => updateField('ledgerAccount', e.target.value)}
                                    className="w-full p-3 bg-card border border-border rounded-xl text-xs font-semibold text-text focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="1210 - Accounts Receivable">1210 - Accounts Receivable (Current Asset • Sundry Debtors)</option>
                                    <option value="2010 - Accounts Payable">2010 - Accounts Payable (Current Liability • Sundry Creditors)</option>
                                    <option value="1220 - Advance Payments to Suppliers">1220 - Advance Payments to Suppliers (Asset Deposit)</option>
                                    <option value="2020 - Client Advances & Deposits">2020 - Client Advances & Deposits (Liability Holding)</option>
                                </select>
                            </div>

                            <div className="p-4 bg-primary/5 border border-primary/20 text-text rounded-2xl flex items-start gap-3">
                                <div className="p-2 rounded-xl bg-primary text-white shrink-0 shadow-xs">
                                    <BookOpen size={16} />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-bold text-xs text-primary">Real-Time Ledger Synchronization</p>
                                    <p className="text-[11px] text-muted leading-relaxed">
                                        All sales orders, invoices, purchase bills, debit/credit notes, and cash receipts posted for this commercial party will automatically reflect in real-time under this selected balance sheet ledger.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: Payment & Bank */}
                    {step === 5 && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-bold text-text mb-1.5">Approved Credit Limit</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted font-bold">
                                            ₹
                                        </div>
                                        <input
                                            type="number"
                                            value={formData.creditLimit}
                                            onChange={(e) => updateField('creditLimit', parseFloat(e.target.value) || 0)}
                                            className="w-full pl-8 pr-3 py-2.5 bg-soft border border-border rounded-xl text-xs font-mono font-bold text-text focus:bg-card focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-bold text-text mb-1.5">Standard Payment Terms</label>
                                    <select
                                        value={formData.paymentTerms}
                                        onChange={(e) => updateField('paymentTerms', e.target.value)}
                                        className="w-full p-2.5 bg-soft border border-border rounded-xl text-xs font-semibold text-text focus:bg-card focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="Immediate">Immediate / Advance Payment</option>
                                        <option value="Net 15">Net 15 Days</option>
                                        <option value="Net 30">Net 30 Days (Standard)</option>
                                        <option value="Net 45">Net 45 Days</option>
                                        <option value="Net 60">Net 60 Days</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 bg-soft/50 border border-border rounded-2xl space-y-3">
                                <span className="font-bold text-text text-xs uppercase tracking-wider block">
                                    Banking & Disbursement Details
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-semibold text-muted text-[11px] mb-1">Bank Name</label>
                                        <input
                                            type="text"
                                            value={formData.bankName}
                                            onChange={(e) => updateField('bankName', e.target.value)}
                                            className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-medium text-text"
                                            placeholder="e.g. HDFC Bank Ltd"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-muted text-[11px] mb-1">Bank Account Number</label>
                                        <input
                                            type="text"
                                            value={formData.bankAccountNumber}
                                            onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                                            className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-mono font-bold text-text"
                                            placeholder="992810029311"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-semibold text-muted text-[11px] mb-1">IFSC / Swift Routing Code</label>
                                        <input
                                            type="text"
                                            value={formData.ifscCode}
                                            onChange={(e) => updateField('ifscCode', e.target.value.toUpperCase())}
                                            className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-mono uppercase font-bold text-text"
                                            placeholder="HDFC0001245"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-muted text-[11px] mb-1">Opening Balance</label>
                                        <input
                                            type="number"
                                            value={formData.openingBalance}
                                            onChange={(e) => updateField('openingBalance', parseFloat(e.target.value) || 0)}
                                            className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-mono font-bold text-text"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 6: Addresses & Contacts */}
                    {step === 6 && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            {/* Billing Address Card */}
                            <div className="bg-soft/50 border border-border p-4 rounded-2xl space-y-3">
                                <div className="flex items-center gap-2">
                                    <MapPin size={15} className="text-primary" />
                                    <span className="font-bold text-text text-xs uppercase tracking-wider">
                                        Billing Headquarters Address
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="col-span-full">
                                        <input
                                            type="text"
                                            value={formData.billingAddress.line1}
                                            onChange={(e) => updateBillingAddress('line1', e.target.value)}
                                            className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-medium text-text"
                                            placeholder="Address Line 1 (Street, Building, Unit / Floor)"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="text"
                                            value={formData.billingAddress.city}
                                            onChange={(e) => updateBillingAddress('city', e.target.value)}
                                            className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-medium text-text"
                                            placeholder="City (e.g. Mumbai)"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="text"
                                            value={formData.billingAddress.pincode}
                                            onChange={(e) => updateBillingAddress('pincode', e.target.value)}
                                            className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-mono font-bold text-text"
                                            placeholder="Pincode / Postal Code"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Shipping Address Card */}
                            <div className="bg-soft/50 border border-border p-4 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Building2 size={15} className="text-primary" />
                                        <span className="font-bold text-text text-xs uppercase tracking-wider">
                                            Shipping / Delivery Address
                                        </span>
                                    </div>
                                    <label className="flex items-center gap-2 font-bold text-text cursor-pointer bg-card px-3 py-1.5 rounded-xl border border-border shadow-2xs hover:bg-soft">
                                        <input
                                            type="checkbox"
                                            checked={sameAsBilling}
                                            onChange={(e) => {
                                                setSameAsBilling(e.target.checked);
                                                if (e.target.checked) {
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        shippingAddress: { ...prev.billingAddress },
                                                    }));
                                                }
                                            }}
                                            className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                                        />
                                        <span>Same as Billing</span>
                                    </label>
                                </div>

                                {!sameAsBilling && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border animate-in fade-in duration-150">
                                        <div className="col-span-full">
                                            <input
                                                type="text"
                                                value={formData.shippingAddress.line1}
                                                onChange={(e) => updateShippingAddress('line1', e.target.value)}
                                                className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-medium text-text"
                                                placeholder="Shipping Address Line 1"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                value={formData.shippingAddress.city}
                                                onChange={(e) => updateShippingAddress('city', e.target.value)}
                                                className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-medium text-text"
                                                placeholder="City"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                value={formData.shippingAddress.pincode}
                                                onChange={(e) => updateShippingAddress('pincode', e.target.value)}
                                                className="w-full p-2.5 bg-card border border-border rounded-xl text-xs font-mono font-bold text-text"
                                                placeholder="Pincode"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Contacts Cards */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-text text-xs">Persons of Contact (POC Directory)</span>
                                    <button
                                        type="button"
                                        onClick={handleAddContact}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl font-bold text-xs border border-primary/20 transition cursor-pointer"
                                    >
                                        <Plus size={14} /> Add Contact Person
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    {formData.contacts.map((contact, idx) => (
                                        <div key={contact.id} className="p-3.5 bg-card border border-border rounded-2xl space-y-2.5 shadow-2xs hover:border-primary/40 transition">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center">
                                                        {idx + 1}
                                                    </div>
                                                    <span className="font-bold text-text text-xs">
                                                        {contact.name || `Contact Person #${idx + 1}`}
                                                    </span>
                                                </div>
                                                {formData.contacts.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveContact(contact.id)}
                                                        className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                                                        title="Remove contact"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                                <input
                                                    type="text"
                                                    value={contact.name}
                                                    onChange={(e) => handleUpdateContact(contact.id, 'name', e.target.value)}
                                                    className="p-2 bg-soft border border-border rounded-xl text-xs font-medium text-text focus:bg-card focus:border-primary"
                                                    placeholder="Full Name"
                                                />
                                                <input
                                                    type="text"
                                                    value={contact.role}
                                                    onChange={(e) => handleUpdateContact(contact.id, 'role', e.target.value)}
                                                    className="p-2 bg-soft border border-border rounded-xl text-xs font-medium text-text focus:bg-card focus:border-primary"
                                                    placeholder="Designation / Role"
                                                />
                                                <input
                                                    type="text"
                                                    value={contact.phone}
                                                    onChange={(e) => handleUpdateContact(contact.id, 'phone', e.target.value)}
                                                    className="p-2 bg-soft border border-border rounded-xl text-xs font-medium text-text focus:bg-card focus:border-primary"
                                                    placeholder="Direct Phone"
                                                />
                                                <input
                                                    type="email"
                                                    value={contact.email}
                                                    onChange={(e) => handleUpdateContact(contact.id, 'email', e.target.value)}
                                                    className="p-2 bg-soft border border-border rounded-xl text-xs font-medium text-text focus:bg-card focus:border-primary"
                                                    placeholder="Email Address"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                <div className="bg-soft/50 border-t border-border px-4 sm:px-6 py-4 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
                    <div>
                        {step > 1 ? (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="flex items-center gap-1.5 px-4 py-2 bg-card border border-border hover:bg-soft text-text rounded-xl font-bold text-xs transition cursor-pointer shadow-2xs"
                            >
                                <ChevronLeft size={16} /> Back
                            </button>
                        ) : (
                            <div className="text-[11px] text-muted font-medium hidden sm:block">
                                Step 1 of 6 • Commercial Profile Setup
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-border hover:bg-soft text-text rounded-xl font-bold text-xs transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        {step < 6 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-md shadow-primary/20"
                            >
                                <span>Continue to Step {step + 1}</span>
                                <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-md shadow-emerald-600/20"
                            >
                                <CheckCircle2 size={16} />
                                <span>{existingParty ? 'Save & Update Party' : 'Complete Registration'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PartyWizardModal;
