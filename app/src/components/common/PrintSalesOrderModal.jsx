import React, { useEffect } from 'react';
import { X, Printer, CheckCircle2, ShoppingCart, Truck } from 'lucide-react';
import { SignatureSlot, useDocumentSignatures } from './SignatureSlot';
import { useERP } from '../../context/ERPContext';
import { fmtAddress } from './printDocUtils';

export const PrintSalesOrderModal = ({ isOpen, onClose, order }) => {
  const docSigs = useDocumentSignatures('SalesOrder', order?.id, `Sales Order ${order?.orderNumber || order?.number || ""}`);
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

    if (!isOpen || !order) return null;

    const handlePrint = () => {
        window.print();
    };

    const items = order.items || [];
    const totalAmount = order.amount || order.total || items.reduce((sum, it) => sum + (it.amount || (it.qty || 1) * (it.rate || 0)), 0);
    const subtotal = items.reduce((sum, it) => {
        const rate = it.rate || 0;
        const qty = it.qty || 1;
        const disc = it.discount || 0;
        return sum + (rate * qty * (1 - disc / 100));
    }, 0) || totalAmount;

    const taxAmount = items.reduce((sum, it) => {
        const rate = it.rate || 0;
        const qty = it.qty || 1;
        const disc = it.discount || 0;
        const tax = it.tax || 0;
        const lineNet = rate * qty * (1 - disc / 100);
        return sum + (lineNet * (tax / 100));
    }, 0);

    const grandTotal = subtotal + taxAmount;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:backdrop-blur-none">
            <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none">
                {/* Top Control Bar (Screen Only) */}
                <div className="bg-[#1F2E4A] text-white px-4 sm:px-6 py-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 no-print shrink-0">
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-blue-300" />
                        <span className="font-bold text-sm tracking-tight">
                            Official Sales Order Confirmation — {order.orderNumber}
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

                {/* Printable Sales Order Document Sheet (A4 Proportion) */}
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
                                <p>GSTIN: {gstin || '—'}{pan ? ` • PAN: ${pan}` : ''}</p>
                                <p>Order Desk: orders@sweven.in | Support: {phone}</p>
                            </div>
                        </div>

                        {/* Order Meta Block */}
                        <div className="text-right space-y-1">
                            <span className="inline-block px-3 py-1 bg-slate-900 text-white font-bold font-mono text-xs uppercase tracking-wider rounded">
                                SALES ORDER CONFIRMATION
                            </span>
                            <div className="pt-2 font-mono">
                                <p className="text-lg font-black text-slate-900">{order.orderNumber}</p>
                                <p className="text-xs text-slate-600">
                                    Order Date: <strong className="text-slate-900">{order.date || new Date().toLocaleDateString('en-GB')}</strong>
                                </p>
                                <p className="text-xs text-slate-600">
                                    Stage / Status: <strong className="text-slate-900">{order.stage || order.status || 'Confirmed'}</strong>
                                </p>
                                <p className="text-xs text-blue-700 font-semibold">
                                    Ref Quote: {order.quoteRef || 'Direct Commercial Order'}
                                </p>
                            </div>

                            {/* Status Badge */}
                            <div className="pt-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-600 px-3 py-0.5 rounded uppercase tracking-wider">
                                    <CheckCircle2 size={12} /> CONFIRMED & COMMITTED
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Two-Column Parties Info */}
                    <div className="grid grid-cols-2 gap-6 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                        {/* Seller */}
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                FULFILLMENT & SELLER
                            </span>
                            <p className="text-sm font-bold text-slate-900">Evenmore Enterprise Logistics LLC</p>
                            <p className="text-slate-600 text-[11px]">Primary Dispatch Hub: Dock 14B Central</p>
                            <p className="text-slate-500 text-[11px]">Order Stage: {order.stage || 'In Production / Staging'}</p>
                        </div>

                        {/* Buyer */}
                        <div className="space-y-1 border-l border-slate-200 pl-6">
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                                ORDERED BY (CLIENT ACCOUNT)
                            </span>
                            <p className="text-sm font-bold text-slate-900">{order.customer || 'Client Account'}</p>
                            {(order.shippingAddress || order.billingAddress) && <p className="text-slate-500 text-[11px]">{fmtAddress(order.shippingAddress) || fmtAddress(order.billingAddress)}</p>}
                            {order.paymentTerms && <p className="text-slate-500 text-[11px]">Payment Terms: {order.paymentTerms}</p>}
                            {order.transporter && <p className="text-slate-500 text-[11px]">Transporter: {order.transporter}</p>}
                        </div>
                    </div>

                    {/* Itemized Commercial Table */}
                    <div className="space-y-2">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-y-2 border-slate-800 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                                    <th className="py-2.5 px-3">Committed Item & Description</th>
                                    <th className="py-2.5 px-3 text-center">Qty Ordered</th>
                                    <th className="py-2.5 px-3 text-right">Unit Rate</th>
                                    <th className="py-2.5 px-3 text-center">Disc %</th>
                                    <th className="py-2.5 px-3 text-center">GST %</th>
                                    <th className="py-2.5 px-3 text-right">Line Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {items.length === 0 ? (
                                    <tr>
                                        <td className="py-2.5 px-3 text-center font-mono">1</td>
                                        <td className="py-2.5 px-3">
                                            <p className="font-bold text-slate-900">Commercial Equipment Package</p>
                                        </td>
                                        <td className="py-2.5 px-3 text-center font-mono">1</td>
                                        <td className="py-2.5 px-3 text-right font-mono">${(totalAmount || 0).toFixed(2)}</td>
                                        <td className="py-2.5 px-3 text-center text-slate-500">0%</td>
                                        <td className="py-2.5 px-3 text-center text-slate-500">18%</td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                            ${(totalAmount || 0).toFixed(2)}
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((it, idx) => {
                                        const qty = it.qty || 1;
                                        const rate = it.rate || 0;
                                        const disc = it.discount || 0;
                                        const tax = it.tax || 0;
                                        const lineTotal = it.amount || (qty * rate * (1 - disc / 100) * (1 + tax / 100));
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                                                <td className="py-2.5 px-3">
                                                    <p className="font-bold text-slate-900">{it.name || it.description || it.itemSku || 'Commercial Item'}</p>
                                                    {it.itemSku && (
                                                        <p className="text-[10px] text-slate-500 font-mono">SKU: {it.itemSku}</p>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800">{qty}</td>
                                                <td className="py-2.5 px-3 text-right font-mono">${rate.toFixed(2)}</td>
                                                <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{disc}%</td>
                                                <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{tax}%</td>
                                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                                    ${lineTotal.toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Subtotals & Delivery Terms */}
                    <div className="flex items-start justify-between pt-3 border-t-2 border-slate-800">
                        {/* Fulfillment Instructions */}
                        <div className="max-w-xs space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <span className="font-bold text-[10px] uppercase text-slate-600 tracking-wider flex items-center gap-1">
                                <Truck size={12} /> Fulfillment & Dispatch Notes
                            </span>
                            <p className="text-[10px] text-slate-600">1. Goods reserved and staged for delivery challan generation.</p>
                            <p className="text-[10px] text-slate-600">2. Official tax invoice will follow with the delivery consignment.</p>
                            <p className="text-[10px] text-slate-600">3. Warranty card registered upon dispatch clearance.</p>
                        </div>

                        {/* Totals */}
                        <div className="w-72 space-y-1.5 font-mono text-xs text-right">
                            <div className="flex justify-between text-slate-600">
                                <span>Order Net Subtotal:</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                                <span>Estimated GST / Tax:</span>
                                <span>${taxAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t-2 border-slate-900 bg-slate-50 p-1.5 rounded">
                                <span>Grand Order Commitment:</span>
                                <span className="text-blue-900">${grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Authorization & Signatures */}
                    <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 text-center text-xs">
                        <div className="space-y-8">
                            <div className="border-b border-slate-400 pb-1">
                              <SignatureSlot doc={docSigs} signatory="customer" label="Client Authorization" modalType="receiver" defaultName={order?.customer || ""} defaultDesignation="Authorized Purchasing Manager"
                                placeholder={<span className="font-mono text-slate-400 text-[10px] italic">Client Authorization</span>} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-900">Authorized Purchasing Manager</p>
                                <p className="text-[10px] text-slate-500">{order.customer}</p>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="border-b border-slate-400 pb-1">
                              <SignatureSlot doc={docSigs} signatory="authorized" label="Operations Approval" modalType="authorized" defaultDesignation="Director of Supply Chain & Operations"
                                placeholder={<span className="font-mono text-slate-400 text-[10px] italic">Evenmore Operations Approval</span>} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-900">Director of Supply Chain & Operations</p>
                                <p className="text-[10px] text-slate-500">Evenmore Enterprise Logistics LLC</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Notice */}
                    <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-100">
                        Official Order Commitment Record. For order inquiries or expediting, contact orders@evenmore-erp.com.
                    </div>
                </div>
                </div>

                {/* Modal Footer (Screen Only) */}
                <div className="bg-slate-100 p-4 border-t border-slate-200 flex flex-wrap lg:flex-nowrap justify-between items-center gap-2 lg:gap-0 no-print shrink-0">
                    <span className="text-xs text-slate-500">
                        Press <strong>Ctrl+P</strong> or click <strong>Print</strong> to generate an official order confirmation PDF.
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
                            Print Official Order
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
