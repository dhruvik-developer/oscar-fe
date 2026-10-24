import React, { useEffect } from 'react';
import { X, Printer, Phone, Mail, MapPin } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
export const Customer360Drawer = ({ customer, onClose }) => {
    const { salesOrders, invoices, paymentIns, deliveryChallans, formatCurrency, formatDateDDMMYYYY } = useERP();

    // UX only: Esc closes, background scroll locks while open. No data changes.
    useEffect(() => {
        if (!customer) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [customer, onClose]);

    if (!customer)
        return null;
    const customerOrders = salesOrders.filter((o) => o.customerId === customer.id || o.customer === customer.name);
    const customerInvoices = invoices.filter((i) => i.customerId === customer.id || i.customer === customer.name);
    const customerPayments = paymentIns.filter((p) => p.customer === customer.name);
    const totalLifetimeSpent = customerInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const creditLimit = customer.creditLimit || 50000;
    const balance = customer.balance || 0;
    const creditUsedPct = Math.min(100, Math.round((balance / creditLimit) * 100));
    return (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-in fade-in duration-150" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${customer.name || 'Customer'} 360 view`}>
      <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 flex flex-col text-xs overflow-hidden printable-document" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3 lg:gap-0">
          <div>
            <span className="font-mono text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {customer.code || 'CUST'}
            </span>
            <h3 className="font-bold text-lg text-[#1F2E4A] mt-1">{customer.name || 'Unnamed Customer'}</h3>
            <div className="flex flex-wrap gap-3 text-slate-500 text-[11px] mt-1.5">
              <span className="flex items-center gap-1"><Mail size={11}/> {customer.email || '—'}</span>
              <span className="flex items-center gap-1"><Phone size={11}/> {customer.phone || '—'}</span>
              <span className="flex items-center gap-1"><MapPin size={11}/> {customer.city || customer.billingAddress?.city || 'Mumbai'}, {customer.state || customer.billingAddress?.state || 'MH'}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X size={18}/>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {/* Financial Exposure & Credit Meter */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">Financial Standing & Exposure</span>
              <button onClick={() => window.print()} className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer border border-blue-200">
                <Printer size={11}/> Print Statement
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Outstanding Due</span>
                <p className="font-mono font-bold text-sm text-slate-900 mt-0.5">
                  {formatCurrency(balance)}
                </p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Credit Limit</span>
                <p className="font-mono font-semibold text-sm text-slate-700 mt-0.5">
                  {formatCurrency(creditLimit, { noDecimals: true })}
                </p>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-[10px] text-emerald-700 font-semibold uppercase block">Lifetime Billed</span>
                <p className="font-mono font-bold text-sm text-emerald-800 mt-0.5">
                  {formatCurrency(totalLifetimeSpent)}
                </p>
              </div>
            </div>

            {/* Credit Gauge */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                <span>Credit Utilization ({creditUsedPct}%)</span>
                <span>{formatCurrency(creditLimit - balance, { noDecimals: true })} available</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${creditUsedPct > 85 ? 'bg-rose-500' : creditUsedPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${creditUsedPct}%` }}/>
              </div>
            </div>
          </div>

          {/* Invoices History */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 text-xs flex items-center justify-between">
              <span>Customer Invoices ({customerInvoices.length})</span>
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
              {customerInvoices.length === 0 ? (<p className="p-4 text-center text-slate-400">No invoices recorded for this account.</p>) : (customerInvoices.map((inv) => (<div key={inv.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</span>
                      <p className="text-[10px] text-slate-400">{formatDateDDMMYYYY(inv.date)} • Due: {formatDateDDMMYYYY(inv.dueDate)}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(inv.total)}</span>
                      <span className={`block text-[10px] font-semibold ${inv.status === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>)))}
            </div>
          </div>

          {/* Sales Orders History */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 text-xs">Recent Sales Orders ({customerOrders.length})</h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
              {customerOrders.length === 0 ? (<p className="p-4 text-center text-slate-400">No sales orders found.</p>) : (customerOrders.map((so) => (<div key={so.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <span className="font-mono font-bold text-blue-700">{so.orderNumber}</span>
                      <p className="text-[10px] text-slate-400">{formatDateDDMMYYYY(so.date)} • {so.items?.length || 0} line items</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(so.amount)}</span>
                      <span className="block text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full mt-0.5">
                        {so.stage}
                      </span>
                    </div>
                  </div>)))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-slate-500 font-medium">Customer Status: <strong className="text-emerald-700">Active Account</strong></span>
          <button onClick={onClose} className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-semibold cursor-pointer shadow-xs">
            Close Drawer
          </button>
        </div>
      </div>
    </div>);
};
