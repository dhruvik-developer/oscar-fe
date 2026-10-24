import React, { useState, useMemo, useEffect } from 'react';
import {
    X,
    ShieldCheck,
    Truck,
    Receipt,
    User,
    Package,
    Layers,
    FileText,
    CheckCircle2,
    AlertTriangle,
    Plus,
    Trash2,
    Calendar,
    Clock,
    Sparkles,
    Check
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import {
    DEFAULT_WARRANTY_TERMS,
    calculateWarrantyExpiry,
    calculateWarrantyCoverageStatus,
    formatDateToISO,
    formatDisplayDate,
    formatWarrantyPeriod,
    getWarrantyStatusStyle
} from '../../utils/warrantyUtils';

export const CreateWarrantyCardModal = ({
    isOpen,
    onClose,
    challan,
    existingCard = null,
    onSuccess,
}) => {
    const {
        customers,
        parties,
        invoices,
        items: masterItems,
        itemParts,
        warranties,
        addWarrantyCard,
        updateWarrantyCard,
        showToast,
    } = useERP();

    // Dismiss on Escape
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    // Resolve Customer
    const matchedCustomer = useMemo(() => {
        if (!challan) return null;
        return (
            customers.find((c) => c.id === challan.customerId || c.name?.toLowerCase() === challan.customer?.toLowerCase()) ||
            parties.find((p) => p.id === challan.customerId || p.name?.toLowerCase() === challan.customer?.toLowerCase()) ||
            {
                name: challan.customer || 'Customer',
                code: 'CUST-AUTO',
                email: 'customer@client.com',
                phone: '+1 (555) 000-0000',
            }
        );
    }, [challan, customers, parties]);

    // Resolve Linked Invoice
    const matchedInvoice = useMemo(() => {
        if (!challan) return null;
        if (challan.invoiceId) {
            return invoices.find((i) => i.id === challan.invoiceId);
        }
        return invoices.find(
            (i) =>
                (challan.salesOrderId && (i.salesOrderId === challan.salesOrderId || i.linkedSo === challan.salesOrderNumber)) ||
                (challan.salesOrderNumber && i.linkedSo === challan.salesOrderNumber) ||
                (i.deliveryChallanId && i.deliveryChallanId === challan.id)
        );
    }, [challan, invoices]);

    // Initial Items & Components resolution from Delivery Challan
    const initialItems = useMemo(() => {
        if (!challan || !challan.items) return [];
        return challan.items.map((line, idx) => {
            const mi = masterItems.find(
                (m) =>
                    m.id === line.itemId ||
                    (line.itemSku && m.sku?.toLowerCase() === String(line.itemSku ?? '').toLowerCase()) ||
                    (line.sku && m.sku?.toLowerCase() === String(line.sku ?? '').toLowerCase())
            );

            const defaultPeriod = mi?.warrantyPeriod ?? 3;
            const defaultUnit = mi?.warrantyUnit || 'Years';
            const defaultStartEvent = mi?.warrantyStartEvent || 'Delivery';

            // Find BOM parts for this item if it's a machine
            const bomParts = itemParts.filter((ip) => ip.parentItemId === (mi?.id || line.itemId));
            const components = bomParts.map((bp, bIdx) => {
                const partItem = masterItems.find((m) => m.id === bp.partItemId);
                return {
                    id: `comp-${Date.now()}-${idx}-${bIdx}`,
                    partItemId: bp.partItemId,
                    name: partItem?.name || `Component ${bIdx + 1}`,
                    sku: partItem?.sku || `PART-${bIdx + 1}`,
                    serialNumber: partItem?.serialNumbers?.[bIdx] || `SN-COMP-${String(bIdx + 1).padStart(3, '0')}`,
                    isSerialized: partItem?.trackingMode === 'Serial',
                    warrantyPeriod: partItem?.warrantyPeriod ?? 2,
                    warrantyUnit: partItem?.warrantyUnit || 'Years',
                };
            });

            const serials = line.selectedSerials || line.serialNumbers || (line.serialNumber ? [line.serialNumber] : (mi?.serialNumbers?.slice(0, line.qty || 1) || []));

            return {
                id: line.id || `wi-${Date.now()}-${idx}`,
                itemId: mi?.id || line.itemId,
                sku: mi?.sku || line.itemSku || line.sku || 'SKU-EQUIP',
                name: mi?.name || line.name || line.description || 'Industrial Equipment',
                description: line.description || mi?.description || '',
                quantity: Number(line.qty || line.dispatchedQty) || 1,
                serialNumbers: serials,
                warrantyApplicable: mi?.warrantyApplicable !== undefined ? mi.warrantyApplicable : true,
                warrantyPeriod: defaultPeriod,
                warrantyUnit: defaultUnit,
                warrantyStartEvent: defaultStartEvent,
                components,
            };
        });
    }, [challan, masterItems, itemParts]);

    // Form State
    const [warrantyPeriod, setWarrantyPeriod] = useState(existingCard?.warrantyPeriod ?? (initialItems[0]?.warrantyPeriod || 3));
    const [warrantyUnit, setWarrantyUnit] = useState(existingCard?.warrantyUnit ?? (initialItems[0]?.warrantyUnit || 'Years'));
    const [warrantyStartEvent, setWarrantyStartEvent] = useState(existingCard?.warrantyStartEvent ?? 'Delivery');
    const [customStartDate, setCustomStartDate] = useState(() => {
        if (existingCard?.startDate) return formatDateToISO(existingCard.startDate);
        if (challan?.dispatchDate) return formatDateToISO(challan.dispatchDate);
        if (challan?.date) return formatDateToISO(challan.date);
        return formatDateToISO(new Date());
    });
    const [itemsList, setItemsList] = useState(existingCard?.items ?? initialItems);
    const [termsAndConditions, setTermsAndConditions] = useState(existingCard?.termsAndConditions || DEFAULT_WARRANTY_TERMS);
    const [authorizedBy, setAuthorizedBy] = useState(existingCard?.authorizedBy || 'Horizon Quality Assurance Dept.');
    const [isOverride, setIsOverride] = useState(Boolean(existingCard?.isOverride));
    const [activeTab, setActiveTab] = useState('coverage'); // 'coverage' | 'components' | 'terms'

    // Synchronize initial items when challan / existingCard changes
    useEffect(() => {
        if (existingCard) {
            setWarrantyPeriod(existingCard.warrantyPeriod || 3);
            setWarrantyUnit(existingCard.warrantyUnit || 'Years');
            setWarrantyStartEvent(existingCard.warrantyStartEvent || 'Delivery');
            setCustomStartDate(formatDateToISO(existingCard.startDate || new Date()));
            setItemsList(existingCard.items || []);
            setTermsAndConditions(existingCard.termsAndConditions || DEFAULT_WARRANTY_TERMS);
            setAuthorizedBy(existingCard.authorizedBy || 'Horizon Quality Assurance Dept.');
            setIsOverride(Boolean(existingCard.isOverride));
        } else if (challan) {
            setItemsList(initialItems);
            const defaultP = initialItems[0]?.warrantyPeriod || 3;
            setWarrantyPeriod(defaultP);
            setWarrantyUnit(initialItems[0]?.warrantyUnit || 'Years');
            setWarrantyStartEvent(initialItems[0]?.warrantyStartEvent || 'Delivery');
            setCustomStartDate(formatDateToISO(challan.dispatchDate || challan.date || new Date()));
        }
    }, [existingCard, challan, initialItems]);

    // Computed Start Date based on Start Event
    const computedStartDate = useMemo(() => {
        if (warrantyStartEvent === 'Invoice' && matchedInvoice?.date) {
            return formatDateToISO(matchedInvoice.date);
        }
        if (warrantyStartEvent === 'Delivery' && (challan?.dispatchDate || challan?.date)) {
            return formatDateToISO(challan.dispatchDate || challan.date);
        }
        return customStartDate || formatDateToISO(new Date());
    }, [warrantyStartEvent, matchedInvoice, challan, customStartDate]);

    // Computed Expiry Date
    const computedExpiryDate = useMemo(() => {
        return calculateWarrantyExpiry(computedStartDate, warrantyPeriod, warrantyUnit);
    }, [computedStartDate, warrantyPeriod, warrantyUnit]);

    // Computed Coverage Status
    const computedCoverageStatus = useMemo(() => {
        return calculateWarrantyCoverageStatus(computedStartDate, computedExpiryDate, 'Generated');
    }, [computedStartDate, computedExpiryDate]);

    const coverageStatusBadgeStyle = getWarrantyStatusStyle(computedCoverageStatus);

    if (!isOpen || !challan) return null;

    // Handlers for Component Warranty editing
    const handleUpdateComponent = (itemIndex, compIndex, field, value) => {
        const updated = [...itemsList];
        const item = { ...updated[itemIndex] };
        const comps = [...(item.components || [])];
        comps[compIndex] = { ...comps[compIndex], [field]: value };
        item.components = comps;
        updated[itemIndex] = item;
        setItemsList(updated);
        setIsOverride(true);
    };

    const handleAddComponent = (itemIndex) => {
        const updated = [...itemsList];
        const item = { ...updated[itemIndex] };
        const comps = [...(item.components || [])];
        comps.push({
            id: `comp-custom-${Date.now()}`,
            name: 'New Modular Component',
            sku: 'PART-CUSTOM',
            serialNumber: `SN-COMP-${String(comps.length + 1).padStart(3, '0')}`,
            isSerialized: true,
            warrantyPeriod: 2,
            warrantyUnit: 'Years',
        });
        item.components = comps;
        updated[itemIndex] = item;
        setItemsList(updated);
        setIsOverride(true);
    };

    const handleRemoveComponent = (itemIndex, compIndex) => {
        const updated = [...itemsList];
        const item = { ...updated[itemIndex] };
        item.components = (item.components || []).filter((_, i) => i !== compIndex);
        updated[itemIndex] = item;
        setItemsList(updated);
        setIsOverride(true);
    };

    const handleSave = (documentStatus = 'Issued') => {
        const enrichedItems = itemsList.map((it) => {
            const itemStart = computedStartDate;
            const itemPeriod = it.warrantyPeriod || warrantyPeriod;
            const itemUnit = it.warrantyUnit || warrantyUnit;
            const itemExpiry = calculateWarrantyExpiry(itemStart, itemPeriod, itemUnit);

            const enrichedComps = (it.components || []).map((c) => ({
                ...c,
                startDate: itemStart,
                expiryDate: calculateWarrantyExpiry(itemStart, c.warrantyPeriod || itemPeriod, c.warrantyUnit || itemUnit),
            }));

            return {
                ...it,
                startDate: itemStart,
                expiryDate: itemExpiry,
                components: enrichedComps,
            };
        });

        const cardPayload = {
            id: existingCard?.id || `wc-${Date.now()}`,
            cardNumber: existingCard?.cardNumber || `WC-2026-${String(warranties.length + 100).padStart(5, '0')}`,
            customerId: challan.customerId || matchedCustomer?.id,
            customerName: challan.customer || matchedCustomer?.name || '',
            customerCode: matchedCustomer?.code || 'CUST-001',
            contactPerson: matchedCustomer?.contactPerson || '',
            email: matchedCustomer?.email || 'customer@client.com',
            phone: matchedCustomer?.phone || '',
            billingAddress: matchedCustomer?.billingAddress || challan.shippingAddress || { line1: 'Corporate HQ Receiving Bay', city: 'San Jose', state: 'CA', pincode: '95134' },
            shippingAddress: challan.shippingAddress || matchedCustomer?.shippingAddress || { line1: 'Dock Receiving Facility', city: 'San Jose', state: 'CA', pincode: '95134' },
            gstin: matchedCustomer?.gstin || challan.gstin || '',
            deliveryChallanId: challan.id,
            challanNumber: challan.challanNumber,
            deliveryDate: challan.dispatchDate || challan.date,
            deliveryLocation: challan.locationName || challan.locationId || 'Main Warehouse',
            invoiceId: matchedInvoice?.id || challan.invoiceId || undefined,
            invoiceNumber: matchedInvoice?.invoiceNumber || (challan.invoiceId ? 'INV-LINKED' : 'Not linked yet'),
            invoiceDate: matchedInvoice?.date || undefined,
            salesOrderId: challan.salesOrderId,
            salesOrderNumber: challan.salesOrderNumber || challan.linkedSo,
            warrantyPeriod: Number(warrantyPeriod) || 1,
            warrantyUnit,
            warrantyStartEvent,
            startDate: computedStartDate,
            expiryDate: computedExpiryDate,
            documentStatus,
            coverageStatus: calculateWarrantyCoverageStatus(computedStartDate, computedExpiryDate, documentStatus),
            items: enrichedItems,
            termsAndConditions,
            authorizedBy,
            isOverride,
        };

        if (existingCard) {
            updateWarrantyCard(existingCard.id, cardPayload);
        } else {
            addWarrantyCard(cardPayload);
        }

        if (onSuccess) {
            onSuccess(cardPayload);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Clean Enterprise Modal Header */}
                <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2 lg:gap-0 shrink-0 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-base text-slate-900">
                                    {existingCard ? `Edit Warranty Card (${existingCard.cardNumber})` : 'Create & Attach Customer Warranty Card'}
                                </h3>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Official Certificate
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                Linked Delivery Challan: <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">{challan.challanNumber}</span>
                                <span>•</span>
                                Consignee: <strong className="text-slate-800">{challan.customer}</strong>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Close Modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Refined Context Strip */}
                <div className="bg-slate-50/70 px-4 sm:px-6 py-3.5 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                    <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-start gap-3 shadow-2xs">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                            <User size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer / Consignee</span>
                            <strong className="text-xs text-slate-900 block truncate">{challan.customer}</strong>
                            <span className="text-[11px] text-slate-500 block truncate">{matchedCustomer?.email || 'customer@client.com'}</span>
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-start gap-3 shadow-2xs">
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                            <Truck size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivery Challan</span>
                            <strong className="font-mono text-xs text-slate-900 block truncate">{challan.challanNumber}</strong>
                            <span className="text-[11px] text-slate-500 block truncate">Dispatch: {formatDisplayDate(challan.dispatchDate || challan.date)}</span>
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-start gap-3 shadow-2xs">
                        <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0">
                            <Receipt size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Commercial Invoice</span>
                            <strong className="font-mono text-xs text-slate-900 block truncate">{matchedInvoice?.invoiceNumber || 'Not Linked Yet'}</strong>
                            <span className="text-[11px] text-slate-500 block truncate">
                                {matchedInvoice?.date ? `Date: ${formatDisplayDate(matchedInvoice.date)}` : 'Awaiting Invoicing'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Sleek Segmented Tab Navigation */}
                <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 pb-2 border-b border-slate-200 bg-white shrink-0 overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
                    <button
                        type="button"
                        onClick={() => setActiveTab('coverage')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shrink-0 lg:shrink transition-all cursor-pointer ${
                            activeTab === 'coverage'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                        }`}
                    >
                        <ShieldCheck size={15} className={activeTab === 'coverage' ? 'text-emerald-600' : 'text-slate-400'} />
                        <span>1. Policy & Coverage Period</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('components')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shrink-0 lg:shrink transition-all cursor-pointer ${
                            activeTab === 'components'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                        }`}
                    >
                        <Layers size={15} className={activeTab === 'components' ? 'text-emerald-600' : 'text-slate-400'} />
                        <span>2. Equipment & Components ({itemsList.length} {itemsList.length === 1 ? 'Item' : 'Items'})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('terms')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shrink-0 lg:shrink transition-all cursor-pointer ${
                            activeTab === 'terms'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                        }`}
                    >
                        <FileText size={15} className={activeTab === 'terms' ? 'text-emerald-600' : 'text-slate-400'} />
                        <span>3. Terms & Authorization</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs bg-slate-50/40">
                    
                    {/* TAB 1: WARRANTY POLICY & DATES */}
                    {activeTab === 'coverage' && (
                        <div className="space-y-5">
                            
                            {/* Policy Configuration Card — hidden per request
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                                            <Sparkles size={16} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-900">Primary Equipment Warranty Duration</h4>
                                            <p className="text-[11px] text-slate-500">Configure standard coverage lifecycle for the primary unit</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-mono text-slate-400">
                                        Standard Policy
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                                            Warranty Period *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="1"
                                                value={warrantyPeriod}
                                                onChange={(e) => {
                                                    setWarrantyPeriod(Math.max(1, Number(e.target.value) || 1));
                                                    setIsOverride(true);
                                                }}
                                                className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white font-mono font-bold text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none shadow-2xs transition-all"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                                            Warranty Unit *
                                        </label>
                                        <select
                                            value={warrantyUnit}
                                            onChange={(e) => {
                                                setWarrantyUnit(e.target.value);
                                                setIsOverride(true);
                                            }}
                                            className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none shadow-2xs transition-all cursor-pointer"
                                        >
                                            <option value="Years">Years</option>
                                            <option value="Months">Months</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                                            Warranty Start Event *
                                        </label>
                                        <select
                                            value={warrantyStartEvent}
                                            onChange={(e) => {
                                                setWarrantyStartEvent(e.target.value);
                                                setIsOverride(true);
                                            }}
                                            className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none shadow-2xs transition-all cursor-pointer"
                                        >
                                            <option value="Delivery">Delivery (Dispatch Date — Default)</option>
                                            <option value="Invoice">Invoice (Commercial Invoice Date)</option>
                                            <option value="Manual Date">Manual Date (Custom Start)</option>
                                        </select>
                                    </div>
                                </div>

                                {warrantyStartEvent === 'Manual Date' && (
                                    <div className="pt-3 border-t border-slate-100 max-w-sm">
                                        <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                                            Custom Start Date *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                value={customStartDate}
                                                onChange={(e) => {
                                                    setCustomStartDate(e.target.value);
                                                    setIsOverride(true);
                                                }}
                                                className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-slate-800 text-xs font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none shadow-2xs"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            */}

                            {/* Executive Coverage Calculation Tiles */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                                    <div className="flex items-center justify-between text-slate-400 mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Calculated Start Date</span>
                                        <Calendar size={15} className="text-slate-400" />
                                    </div>
                                    <p className="text-base font-bold font-mono text-slate-900">
                                        {formatDisplayDate(computedStartDate)}
                                    </p>
                                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                        <span>Trigger Event</span>
                                        <span className="font-semibold text-slate-700">{warrantyStartEvent}</span>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                                    <div className="flex items-center justify-between text-slate-400 mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Auto-Calculated Expiry</span>
                                        <Clock size={15} className="text-slate-400" />
                                    </div>
                                    <p className="text-base font-bold font-mono text-slate-900">
                                        {formatDisplayDate(computedExpiryDate)}
                                    </p>
                                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                        <span>Duration</span>
                                        <span className="font-semibold text-slate-700">{formatWarrantyPeriod(warrantyPeriod, warrantyUnit)}</span>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
                                    <div className="flex items-center justify-between text-slate-400 mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Live Coverage Status</span>
                                        <ShieldCheck size={15} className="text-emerald-500" />
                                    </div>
                                    <div>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs font-bold border ${coverageStatusBadgeStyle.bg}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                            {computedCoverageStatus}
                                        </span>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                        <span>Calculation Engine</span>
                                        <span className="text-emerald-600 font-semibold">Real-time Verified</span>
                                    </div>
                                </div>

                            </div>

                            {isOverride && (
                                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-2.5 text-amber-900 text-xs shadow-2xs">
                                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                                    <span>
                                        <strong>Document-Specific Override:</strong> Changes made here apply exclusively to this customer warranty certificate without modifying Product Master catalog defaults.
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: MACHINE & COMPONENTS REGISTRY */}
                    {activeTab === 'components' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-slate-900 text-sm">Dispatched Items & Component Matrix</h4>
                                    <p className="text-[11px] text-slate-500">
                                        Equipment units dispatched under challan {challan.challanNumber} with independent sub-assembly warranties
                                    </p>
                                </div>
                            </div>

                            {itemsList.map((item, itemIdx) => (
                                <div key={item.id || itemIdx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                                                    <Package size={15} />
                                                </div>
                                                <h5 className="font-bold text-slate-900 text-sm">{item.name}</h5>
                                                <span className="font-mono text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                    {item.sku}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
                                                <span>Qty: <strong className="text-slate-800">{item.quantity}</strong></span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <span>Serial(s):</span>
                                                    {item.serialNumbers?.length > 0 ? (
                                                        item.serialNumbers.map((s) => (
                                                            <span key={s} className="px-1.5 py-0.5 font-mono text-[10px] font-bold bg-blue-50 text-blue-700 rounded border border-blue-200">
                                                                {s}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="italic text-slate-400">Non-serialized</span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200/80">
                                            <span className="text-xs text-slate-600 font-semibold pl-1.5">Warranty:</span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.warrantyPeriod || warrantyPeriod}
                                                onChange={(e) => {
                                                    const updated = [...itemsList];
                                                    updated[itemIdx] = { ...updated[itemIdx], warrantyPeriod: Number(e.target.value) || 1 };
                                                    setItemsList(updated);
                                                    setIsOverride(true);
                                                }}
                                                className="w-14 h-7 text-center border border-slate-200 rounded-lg bg-white font-mono text-xs font-bold text-slate-900"
                                            />
                                            <span className="text-xs text-slate-600 font-semibold pr-2">{item.warrantyUnit || warrantyUnit}</span>
                                        </div>
                                    </div>

                                    {/* Components Table */}
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <Layers size={13} className="text-slate-400" />
                                                Sub-Assemblies & Component Warranties ({item.components?.length || 0})
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleAddComponent(itemIdx)}
                                                className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors"
                                            >
                                                <Plus size={12} /> Add Component
                                            </button>
                                        </div>

                                        {(item.components && item.components.length > 0) ? (
                                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                <table className="w-full min-w-[640px] lg:min-w-0 text-left text-xs">
                                                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                                                        <tr>
                                                            <th className="py-2 px-3">Component Description</th>
                                                            <th className="py-2 px-3 w-32">Part SKU</th>
                                                            <th className="py-2 px-3 w-36">Serial / ID</th>
                                                            <th className="py-2 px-3 w-24 text-center">Period</th>
                                                            <th className="py-2 px-3 w-24 text-center">Unit</th>
                                                            <th className="py-2 px-2 w-8 text-center"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {item.components.map((comp, compIdx) => (
                                                            <tr key={comp.id || compIdx} className="hover:bg-slate-50/70 transition-colors">
                                                                <td className="p-2">
                                                                    <input
                                                                        type="text"
                                                                        value={comp.name}
                                                                        onChange={(e) => handleUpdateComponent(itemIdx, compIdx, 'name', e.target.value)}
                                                                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 bg-white focus:ring-1 focus:ring-emerald-500"
                                                                        placeholder="Component name..."
                                                                    />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input
                                                                        type="text"
                                                                        value={comp.sku}
                                                                        onChange={(e) => handleUpdateComponent(itemIdx, compIdx, 'sku', e.target.value)}
                                                                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-600 bg-white"
                                                                        placeholder="SKU"
                                                                    />
                                                                </td>
                                                                <td className="p-2">
                                                                    <input
                                                                        type="text"
                                                                        value={comp.serialNumber || ''}
                                                                        onChange={(e) => handleUpdateComponent(itemIdx, compIdx, 'serialNumber', e.target.value)}
                                                                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-900 font-semibold bg-white"
                                                                        placeholder="SN-XXX"
                                                                    />
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={comp.warrantyPeriod || 1}
                                                                        onChange={(e) => handleUpdateComponent(itemIdx, compIdx, 'warrantyPeriod', Number(e.target.value) || 1)}
                                                                        className="w-14 px-1 py-1.5 text-center border border-slate-200 rounded-lg text-xs font-mono font-bold text-emerald-800 bg-white"
                                                                    />
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <select
                                                                        value={comp.warrantyUnit || 'Years'}
                                                                        onChange={(e) => handleUpdateComponent(itemIdx, compIdx, 'warrantyUnit', e.target.value)}
                                                                        className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white cursor-pointer"
                                                                    >
                                                                        <option value="Years">Years</option>
                                                                        <option value="Months">Months</option>
                                                                    </select>
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveComponent(itemIdx, compIdx)}
                                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                                        title="Remove component"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400 italic bg-white p-3.5 rounded-xl border border-slate-200 text-center">
                                                No sub-components added. Click &quot;Add Component&quot; to assign custom warranties to modular sub-assemblies.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* TAB 3: TERMS & AUTHORIZATION */}
                    {activeTab === 'terms' && (
                        <div className="space-y-4">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-800 block mb-1">
                                        Warranty Certificate Terms & Conditions
                                    </label>
                                    <p className="text-[11px] text-slate-500 mb-2">
                                        Standard legal warranty policy presented on the customer-facing warranty certificate
                                    </p>
                                </div>
                                <textarea
                                    rows={8}
                                    value={termsAndConditions}
                                    onChange={(e) => {
                                        setTermsAndConditions(e.target.value);
                                        setIsOverride(true);
                                    }}
                                    className="w-full p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 text-xs font-sans focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none leading-relaxed transition-all shadow-2xs"
                                    placeholder="Enter company warranty terms and conditions..."
                                />
                                <span className="text-[10px] text-slate-400 block">
                                    Pre-populated from company defaults. Edits here apply only to this specific warranty card.
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-800 block">
                                        Authorized Signatory / Approver
                                    </label>
                                    <input
                                        type="text"
                                        value={authorizedBy}
                                        onChange={(e) => setAuthorizedBy(e.target.value)}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-white text-slate-800 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none shadow-2xs"
                                        placeholder="e.g. Horizon Quality Assurance Dept."
                                    />
                                    <span className="text-[10px] text-slate-400 block">Appears in the signature verification box</span>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-800 block">
                                        Customer Contact Email for Dispatch
                                    </label>
                                    <input
                                        type="email"
                                        value={matchedCustomer?.email || 'customer@client.com'}
                                        disabled
                                        className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-100/80 text-slate-600 text-xs font-mono"
                                    />
                                    <span className="text-[10px] text-slate-400 block">From Customer Directory Master</span>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="px-4 sm:px-6 py-4 border-t border-slate-200 bg-white flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 shrink-0">
                    <div>
                        <button
                            type="button"
                            onClick={() => handleSave('Draft')}
                            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
                        >
                            Save as Draft
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSave('Issued')}
                            className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <ShieldCheck size={16} />
                            Issue & Attach Warranty Card
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
