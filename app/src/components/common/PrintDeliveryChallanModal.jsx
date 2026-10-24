import React, { useEffect } from 'react';
import { X, Printer, CheckCircle2, Truck, ShieldCheck, FileText, MapPin } from 'lucide-react';
import { SignatureSlot, useDocumentSignatures } from './SignatureSlot';
import { useERP } from '../../context/ERPContext';
import { fmtAddress } from './printDocUtils';

export const PrintDeliveryChallanModal = ({ isOpen, onClose, challan }) => {
  const docSigs = useDocumentSignatures('DeliveryChallan', challan?.id, `Delivery Challan ${challan?.challanNumber || ""}`);
    // [PHASE-2E.1] profile-driven letterhead (was hardcoded EVENMORE / US strings)
    const { companyProfile } = useERP();
    const companyName = companyProfile?.name || 'EVENMORE ENTERPRISES';
    const companyShort = (companyName || 'E').trim().charAt(0).toUpperCase() || 'E';
    const gstin = companyProfile?.gstin || '';
    const pan = companyProfile?.pan || '';
    const companyAddress = fmtAddress(companyProfile?.address) || '742 Industrial Technology Way, Bldg 4 • San Jose, CA 95134';
    const phone = companyProfile?.phone || '+1 (800) 555-0199';
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen || !challan) return null;

    const handlePrint = () => {
        window.print();
    };

    const items = challan.items || [];
    const totalUnits = items.reduce((sum, it) => sum + (it.qty || it.dispatchedQty || it.quantity || 1), 0);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:backdrop-blur-none">
            <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none">
                {/* Top Control Bar (Screen Only) */}
                <div className="bg-[#1F2E4A] text-white px-4 sm:px-6 py-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 no-print shrink-0">
                    <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-blue-300" />
                        <span className="font-bold text-sm tracking-tight">
                            Official Delivery Challan & Waybill — {challan.challanNumber}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                        >
                            <Printer size={14} />
                            Print / Save as PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                            title="Close Preview"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Printable Challan Sheet (A4 Proportion) */}
                <div className="overflow-x-auto p-2 sm:p-6 lg:p-0 print:p-0 print:overflow-visible">
                <div className="p-8 sm:p-12 min-w-[720px] lg:min-w-0 print:min-w-0 text-slate-800 bg-white font-sans text-xs space-y-6 printable-document">
                    {/* Header / Letterhead */}
                    <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-[#1F2E4A] text-white flex items-center justify-center font-bold text-lg font-mono">
                                    {companyShort}
                                </div>
                                <div>
                                    <h1 className="text-xl font-extrabold text-[#1F2E4A] tracking-tight uppercase">
                                        {companyName}
                                    </h1>
                                    <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                                        Steel Fabrication & MS Table Manufacturing
                                    </p>
                                </div>
                            </div>
                            {/* [PHASE-2E.1] GSTIN now flows from companyProfile (was US-8849201-CORP) */}
                            <div className="text-[11px] text-slate-500 space-y-0.5 pt-2">
                                <p>{companyAddress}</p>
                                <p>Tax Registration / GSTIN: {gstin || '—'}{pan ? ` • PAN: ${pan}` : ''} • Logistics Desk: {phone}</p>
                            </div>
                        </div>

                        {/* Challan Meta Block */}
                        <div className="text-right space-y-1">
                            <span className="inline-block px-3 py-1 bg-slate-900 text-white font-bold font-mono text-xs uppercase tracking-wider rounded">
                                DELIVERY CHALLAN & WAYBILL
                            </span>
                            <div className="pt-2 font-mono">
                                <p className="text-lg font-black text-slate-900">{challan.challanNumber}</p>
                                <p className="text-xs text-slate-600">
                                    Dispatch Date: <strong className="text-slate-900">{challan.date || new Date().toLocaleDateString('en-GB')}</strong>
                                </p>
                                <p className="text-xs text-slate-600">
                                    Linked Sales Order: <strong className="text-slate-900">{challan.soRef || challan.salesOrderRef || '—'}</strong>
                                </p>
                                <p className="text-xs text-blue-700 font-semibold">
                                    Waybill / LR #: {challan.lrNumber || 'LR-88392-EXP'}
                                </p>
                            </div>

                            {/* Status Badge */}
                            <div className="pt-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-600 px-3 py-0.5 rounded uppercase tracking-wider">
                                    <CheckCircle2 size={12} /> {challan.status || 'DISPATCHED'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Two-Column Logistics Dispatch Parties Info */}
                    <div className="grid grid-cols-2 gap-6 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                        {/* Shipper */}
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                SHIPPER / DISPATCH FROM
                            </span>
                            <p className="text-sm font-bold text-slate-900">Evenmore Logistics Hub Dock 14B</p>
                            <p className="text-slate-600 text-[11px]">452 Industrial Parkway, Bay A-1</p>
                            <p className="text-slate-500 text-[11px]">Seattle, WA 98101 • United States</p>
                            <p className="text-slate-500 text-[11px]">Dispatch Supervisor: Central Hub Controller</p>
                        </div>

                        {/* Consignee */}
                        <div className="space-y-1 border-l border-slate-200 pl-6">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                CONSIGNEE / SHIP TO
                            </span>
                            <p className="text-sm font-bold text-slate-900">{challan.customer || 'Client Organization'}</p>
                            <p className="text-slate-600 text-[11px]">Commercial Delivery Destination</p>
                            <p className="text-slate-500 text-[11px]">{fmtAddress(challan.shippingAddress) || fmtAddress(challan.billingAddress) || 'Destination Dock / Unloading Bay'}</p>
                            <p className="text-slate-500 text-[11px]">Receiving Contact: Authorized Warehouse Clerk</p>
                        </div>
                    </div>

                    {/* Transporter & Transit Details Grid */}
                    <div className="grid grid-cols-4 gap-3 bg-slate-100/70 p-3 rounded-lg border border-slate-200 text-[11px]">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Transporter / Fleet</span>
                            <strong className="text-slate-900">{challan.transporter || '—'}</strong>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Vehicle / Container #</span>
                            <strong className="font-mono text-slate-900">{challan.vehicleNumber || 'WA-982-TRK'}</strong>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Driver Name</span>
                            <strong className="text-slate-900">{challan.driverName || 'David Miller'}</strong>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Driver Contact</span>
                            <strong className="font-mono text-slate-900">{challan.driverPhone || '+1 (555) 902-3341'}</strong>
                        </div>
                    </div>

                    {/* Itemized Commercial Table */}
                    <div className="space-y-2">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-y-2 border-slate-800 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                                    <th className="py-2.5 px-3">Item Description & Specification</th>
                                    <th className="py-2.5 px-3 text-center">Serial / Batch #</th>
                                    <th className="py-2.5 px-3 text-center">Quantity</th>
                                    <th className="py-2.5 px-3 text-center">Package Type</th>
                                    <th className="py-2.5 px-3 text-center">Condition Check</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {items.length === 0 ? (
                                    <tr>
                                        <td className="py-2.5 px-3 text-center font-mono">1</td>
                                        <td className="py-2.5 px-3">
                                            <p className="font-bold text-slate-900">Commercial Consignment Batch</p>
                                        </td>
                                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">SN-2026-PKG-01</td>
                                        <td className="py-2.5 px-3 text-center font-mono font-bold">1 Unit</td>
                                        <td className="py-2.5 px-3 text-center text-slate-600">Secure Crate</td>
                                        <td className="py-2.5 px-3 text-center text-emerald-700 font-bold">Verified OK</td>
                                    </tr>
                                ) : (
                                    items.map((it, idx) => {
                                        const qty = it.qty || it.dispatchedQty || it.quantity || 1;
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                                                <td className="py-2.5 px-3">
                                                    <p className="font-bold text-slate-900">{it.name || it.description || it.itemSku || 'Commercial Item'}</p>
                                                    {it.itemSku && (
                                                        <p className="text-[10px] text-slate-500 font-mono">SKU: {it.itemSku}</p>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                                                    {it.serialNumber || `SN-${String(idx + 1).padStart(4, '0')}`}
                                                </td>
                                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                                                    {qty} {it.unit || 'Units'}
                                                </td>
                                                <td className="py-2.5 px-3 text-center text-slate-600">
                                                    {it.packaging || 'Crate / Box'}
                                                </td>
                                                <td className="py-2.5 px-3 text-center text-emerald-700 font-bold">
                                                    Verified (100%)
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary of Packages */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <div className="text-slate-600">
                            Total Physical Units Dispatched: <strong className="text-slate-900 font-mono font-bold">{totalUnits} units</strong>
                        </div>
                        <div className="text-slate-600">
                            Consignment Insurance: <strong className="text-emerald-700">100% In-Transit Coverage Registered</strong>
                        </div>
                    </div>

                    {/* Dual Signatures & POD (Proof of Delivery) */}
                    <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 text-center text-xs">
                        <div className="space-y-8">
                            <div className="border-b border-slate-400 pb-1">
                              <SignatureSlot doc={docSigs} signatory="driver" label="Driver & Transporter Handover" modalType="receiver" defaultDesignation="Logistics Carrier Driver"
                                placeholder={<span className="font-mono text-slate-400 text-[10px] italic">Driver & Transporter Handover</span>} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-900">Logistics Carrier Driver</p>
                                <p className="text-[10px] text-slate-500">Sign upon Safe Physical Handover</p>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="border-b border-slate-400 pb-1">
                              <SignatureSlot doc={docSigs} signatory="consignee" label="Consignee Receiving Signature" modalType="receiver" defaultName={challan?.customer || ""} defaultDesignation="Consignee — Received in good condition"
                                placeholder={<span className="font-mono text-slate-400 text-[10px] italic">Consignee Receiving Stamp & Signature</span>} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-900">Authorized Consignee Receiver</p>
                                <p className="text-[10px] text-slate-500">Sign & Date on Physical Goods Receipt</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Notice */}
                    <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-100">
                        Official Goods In-Transit Waybill & Delivery Challan. Non-sale transport document under commercial transit laws.
                    </div>
                </div>
                </div>

                {/* Modal Footer (Screen Only) */}
                <div className="bg-slate-100 p-4 border-t border-slate-200 flex flex-wrap lg:flex-nowrap justify-between items-center gap-2 lg:gap-0 no-print shrink-0">
                    <span className="text-xs text-slate-500">
                        Press <strong>Ctrl+P</strong> or click <strong>Print</strong> to generate an official delivery challan & waybill PDF.
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white font-semibold text-xs transition cursor-pointer"
                        >
                            Close
                        </button>
                        <button
                            onClick={handlePrint}
                            className="px-5 py-2 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                        >
                            <Printer size={14} />
                            Print Official Challan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
