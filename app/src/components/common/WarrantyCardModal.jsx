import React, { useEffect } from 'react';
import { X, Printer, ShieldCheck, FileCheck, Award, Send, Check } from 'lucide-react';
import { SignatureSlot, useDocumentSignatures } from './SignatureSlot';
import { formatDisplayDate, getWarrantyStatusStyle, formatWarrantyPeriod } from '../../utils/warrantyUtils';
import { useERP } from '../../context/ERPContext';

export const WarrantyCardModal = ({ isOpen, onClose, warrantyCard, onSend = null }) => {
    const docSigs = useDocumentSignatures('WarrantyCard', warrantyCard?.id, `Warranty Card ${warrantyCard?.cardNumber || ''}`);
    // [PHASE-2E.1] company identity flows from companyProfile (was hardcoded Horizon US strings)
    const { companyProfile } = useERP();
    const companyName = companyProfile?.name || 'Horizon Enterprise Logistics';
    const companyShort = (companyName || 'H').trim().charAt(0).toUpperCase() || 'H';
    const gstin = companyProfile?.gstin || '';
    const pan = companyProfile?.pan || '';
    const companyAddress = companyProfile?.address || '742 Industrial Technology Way, Bldg 4 • San Jose, CA 95134 • USA';
    const phone = companyProfile?.phone || '+1 (800) 555-0199';
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen || !warrantyCard) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleSendAction = () => {
        if (onSend) {
            onSend(warrantyCard);
        }
    };

    const statusStyle = getWarrantyStatusStyle(warrantyCard.coverageStatus || 'Active');
    const isCancelled = warrantyCard.documentStatus === 'Cancelled' || warrantyCard.coverageStatus === 'Cancelled';
    const isDraft = warrantyCard.documentStatus === 'Draft';
    const isIssued = !isDraft && !isCancelled;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:backdrop-blur-none animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none max-h-[94vh]">
                
                {/* Top Control Bar (Screen Only) */}
                <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-2 lg:gap-0 no-print shrink-0">
                    <div className="flex items-center gap-3 min-w-0 lg:min-w-auto">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center">
                            <Award className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 tracking-tight block">
                                    Customer Warranty Certificate Preview
                                </span>
                                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                    {warrantyCard.cardNumber}
                                </span>
                                {isIssued && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Issued & Locked
                                    </span>
                                )}
                            </div>
                            <span className="text-[11px] text-slate-500">
                                Document Status: <strong className="text-slate-800 font-semibold">{warrantyCard.documentStatus || 'Issued'}</strong> • Coverage: <strong className="text-emerald-700">{warrantyCard.coverageStatus || 'Active'}</strong>
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Close Preview"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Real Printable Certificate Sheet (A4 Proportion) */}
                <div className="p-8 sm:p-10 text-slate-800 bg-white font-sans text-xs space-y-6 overflow-y-auto flex-1 printable-document">
                    
                    {/* Header / Letterhead */}
                    <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl font-mono shadow-sm">
                                    {companyShort}
                                </div>
                                <div>
                                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight uppercase">
                                        {companyName}
                                    </h1>
                                    <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                                        Industrial Systems & Equipment Quality Division
                                    </p>
                                </div>
                            </div>
                            {/* [PHASE-2E.1] company GSTIN now from companyProfile (was US-8849201-CORP) */}
                            <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                                <p>{companyAddress}</p>
                                <p>Corporate Registry: {gstin || '—'}{pan ? ` • PAN: ${pan}` : ''} • Support: support@sweven.in | {phone}</p>
                            </div>
                        </div>

                        <div className="text-right space-y-1.5">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded-lg font-mono text-xs font-bold uppercase tracking-wider">
                                <ShieldCheck size={14} className="text-emerald-400" />
                                Official Warranty Certificate
                            </div>
                            <p className="font-mono text-xs font-bold text-slate-900 pt-0.5">
                                {warrantyCard.cardNumber}
                            </p>
                            <p className="text-[11px] text-slate-500">
                                Issued: {formatDisplayDate(warrantyCard.generatedAt || warrantyCard.createdAt)}
                            </p>
                            <div>
                                {isCancelled ? (
                                    <span className="inline-block font-mono text-[10px] font-bold px-2.5 py-0.5 bg-rose-50 text-rose-800 rounded-md border border-rose-200">
                                        VOID / CANCELLED
                                    </span>
                                ) : (
                                    <span className={`inline-block font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${statusStyle.bg}`}>
                                        {statusStyle.label}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Customer & Transaction Reference Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90">
                        <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                Issued To / Equipment Consignee
                            </span>
                            <p className="font-bold text-sm text-slate-900">{warrantyCard.customerName}</p>
                            {warrantyCard.customerCode && (
                                <span className="font-mono text-[10px] text-slate-500 block">
                                    Customer Code: {warrantyCard.customerCode}
                                </span>
                            )}
                            <div className="text-[11px] text-slate-600 leading-tight pt-1">
                                {warrantyCard.shippingAddress ? (
                                    <>
                                        <p>{warrantyCard.shippingAddress.line1}</p>
                                        <p>{warrantyCard.shippingAddress.city}, {warrantyCard.shippingAddress.state} {warrantyCard.shippingAddress.pincode}</p>
                                    </>
                                ) : (
                                    <p>Site Receiving Location • Dock 14B</p>
                                )}
                                {warrantyCard.email && <p className="text-slate-500 pt-0.5">Email: {warrantyCard.email}</p>}
                                {warrantyCard.phone && <p className="text-slate-500">Phone: {warrantyCard.phone}</p>}
                                {warrantyCard.gstin && <p className="font-mono text-[10px] text-slate-500">GSTIN / Tax ID: {warrantyCard.gstin}</p>}
                            </div>
                        </div>

                        <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-4">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                                Document & Fulfillment Chain
                            </span>
                            <div className="space-y-1.5 text-[11px] pt-1">
                                <div className="flex items-center justify-between py-0.5 border-b border-slate-200/80">
                                    <span className="text-slate-500">Delivery Challan:</span>
                                    <strong className="font-mono text-slate-900">{warrantyCard.challanNumber || '—'}</strong>
                                </div>
                                <div className="flex items-center justify-between py-0.5 border-b border-slate-200/80">
                                    <span className="text-slate-500">Dispatch / Delivery Date:</span>
                                    <strong className="font-mono text-slate-900">{formatDisplayDate(warrantyCard.deliveryDate || warrantyCard.startDate)}</strong>
                                </div>
                                <div className="flex items-center justify-between py-0.5 border-b border-slate-200/80">
                                    <span className="text-slate-500">Linked Sales Invoice:</span>
                                    <strong className="font-mono text-slate-900">{warrantyCard.invoiceNumber || 'Not linked yet'}</strong>
                                </div>
                                <div className="flex items-center justify-between py-0.5">
                                    <span className="text-slate-500">Linked Sales Order:</span>
                                    <strong className="font-mono text-slate-900">{warrantyCard.salesOrderNumber || 'SO-DIRECT'}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Primary Machine / Equipment & Coverage Terms */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileCheck size={15} className="text-emerald-400" />
                                <h3 className="font-bold text-xs uppercase tracking-wider">
                                    Covered Equipment & Warranty Scope
                                </h3>
                            </div>
                            <span className="text-[10px] font-mono text-slate-300">
                                Start Event: {warrantyCard.warrantyStartEvent || 'Delivery'}
                            </span>
                        </div>

                        <div className="p-4 space-y-4 bg-white">
                            {(warrantyCard.items || []).map((item, idx) => (
                                <div key={item.id || idx} className="space-y-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-900">{item.name || item.description}</h4>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                                                <span>SKU: {item.sku || item.itemSku || 'GEN-SKU'}</span>
                                                {item.modelNumber && <span>• Model: {item.modelNumber}</span>}
                                                <span>• Qty: {item.quantity || 1} Unit(s)</span>
                                            </div>
                                        </div>

                                        <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4">
                                            <div className="text-xs font-bold text-emerald-700">
                                                Coverage: {formatWarrantyPeriod(item.warrantyPeriod || warrantyCard.warrantyPeriod, item.warrantyUnit || warrantyCard.warrantyUnit)}
                                            </div>
                                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                                Valid: {formatDisplayDate(item.startDate || warrantyCard.startDate)} — {formatDisplayDate(item.expiryDate || warrantyCard.expiryDate)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Exact Dispatched Serial Numbers */}
                                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                            Registered Serial Number(s):
                                        </span>
                                        {(item.serialNumbers && item.serialNumbers.length > 0) ? (
                                            item.serialNumbers.map((s) => (
                                                <span key={s} className="px-2 py-0.5 bg-blue-50 text-blue-900 font-mono font-bold text-xs rounded-md border border-blue-200">
                                                    {s}
                                                </span>
                                            ))
                                        ) : item.serialNumber ? (
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-900 font-mono font-bold text-xs rounded-md border border-blue-200">
                                                {item.serialNumber}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 font-mono text-[11px]">Standard Tracked Asset</span>
                                        )}
                                    </div>

                                    {/* Component Level Breakdown if available */}
                                    {item.components && item.components.length > 0 && (
                                        <div className="space-y-1.5 pt-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                                    Component Warranty Matrix ({item.components.length} Sub-Assemblies)
                                                </span>
                                                <span className="text-[10px] text-slate-400">Independent Sub-Component Coverage</span>
                                            </div>
                                            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                                                <thead className="bg-slate-50 font-semibold text-slate-500 text-[10px] uppercase border-b border-slate-200">
                                                    <tr>
                                                        <th className="py-2 px-3">Component Description</th>
                                                        <th className="py-2 px-3">Part SKU</th>
                                                        <th className="py-2 px-3">Serial / ID</th>
                                                        <th className="py-2 px-3 text-center">Warranty</th>
                                                        <th className="py-2 px-3 text-right">Coverage Expiry</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 bg-white">
                                                    {item.components.map((comp, cIdx) => (
                                                        <tr key={comp.id || cIdx} className="hover:bg-slate-50/50">
                                                            <td className="py-2 px-3 font-medium text-slate-800">{comp.name}</td>
                                                            <td className="py-2 px-3 font-mono text-[10px] text-slate-500">{comp.sku || 'PART-SKU'}</td>
                                                            <td className="py-2 px-3 font-mono text-[10px] text-slate-700">
                                                                {comp.serialNumber || (comp.isSerialized ? 'Pending Inscription' : 'Non-Serialized')}
                                                            </td>
                                                            <td className="py-2 px-3 text-center font-bold text-emerald-700 text-[11px]">
                                                                {formatWarrantyPeriod(comp.warrantyPeriod, comp.warrantyUnit)}
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-mono text-[10px] text-slate-600">
                                                                {formatDisplayDate(comp.expiryDate || item.expiryDate || warrantyCard.expiryDate)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Warranty Terms & Conditions */}
                    <div className="space-y-1.5 pt-1">
                        <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            Standard Terms & Conditions of Equipment Warranty
                        </h4>
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-600 leading-relaxed whitespace-pre-line font-sans">
                            {warrantyCard.termsAndConditions || 'Standard enterprise warranty terms apply.'}
                        </div>
                    </div>

                    {/* Signatures & Quality Assurance Verification */}
                    <div className="grid grid-cols-2 gap-6 pt-3 border-t border-slate-200">
                        <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-slate-50/50">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Quality Assurance / Authorized Signatory
                            </span>
                            <div className="border-b border-slate-300 pb-1">
                                <SignatureSlot doc={docSigs} signatory="authorized" label="Quality Assurance / Authorized Signatory" modalType="authorized" className="h-10"
                                    defaultName={warrantyCard.authorizedBy || ''} defaultDesignation="Quality Assurance — Authorized Signatory"
                                    placeholder={<span className="font-mono text-xs text-slate-800 font-bold">{warrantyCard.authorizedBy || 'Horizon Quality Assurance Dept.'}</span>} />
                            </div>
                            <p className="text-[10px] text-slate-400">
                                Equipment inspected, serialized, and authorized under warranty standards.
                            </p>
                        </div>

                        <div className="border border-emerald-200 rounded-xl p-3.5 space-y-3 bg-emerald-50/20">
                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                                Customer Verification & Acknowledgment
                            </span>
                            <div className="border-b border-emerald-300 pb-1">
                                <SignatureSlot doc={docSigs} signatory="customer" label="Customer Verification & Acknowledgment" modalType="receiver" className="h-10"
                                    defaultName={warrantyCard.customerName || ''} defaultDesignation="Authorized Receiver"
                                    placeholder={<span className="font-mono text-xs text-emerald-900">{warrantyCard.customerName} (Authorized Receiver)</span>} />
                            </div>
                            <p className="text-[10px] text-slate-400">
                                Received in intact condition with complete component registry.
                            </p>
                        </div>
                    </div>

                </div>

                {/* Footer Controls (Screen Only) */}
                <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-white flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 no-print shrink-0">
                    <div className="text-xs text-slate-500">
                        Certificate ID: <span className="font-mono font-bold text-slate-800">{warrantyCard.id}</span> • Linked DC: <span className="font-mono text-slate-800">{warrantyCard.challanNumber}</span>
                    </div>
                    <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                        {onSend && !isCancelled && (
                            <button
                                onClick={handleSendAction}
                                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                                <Send size={13} /> Send Card & Waybill
                            </button>
                        )}
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                            <Printer size={13} /> Print / PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
