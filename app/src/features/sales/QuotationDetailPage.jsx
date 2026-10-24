import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Building2, CalendarDays, CheckCircle2, Clock3, Copy,
  Download, Eye, FileText, IndianRupee, Link2, Printer, RefreshCw, Send, X,
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { sharingRequest } from '../../services/quotationSharing';
import { toISODate } from '../../utils/dateUtils';
import { PrintQuotationModal } from '../../components/common/PrintQuotationModal';
import SendQuotationModal from './SendQuotationModal';
import { api } from '../../services/api';
import { isBackendEnabled, isServerId } from '../../services/resourceSync';

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function inr(value) {
  return `₹${(Math.round(Number(value) || 0)).toLocaleString('en-IN')}`;
}

function daysLeftText(validUntil) {
  const iso = toISODate(validUntil);
  if (!iso) return String(validUntil || '—');
  const diff = Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  if (diff < 0) return `Expired ${Math.abs(diff)} days ago`;
  if (diff === 0) return 'Expires today';
  return `${diff} Days Left`;
}

function shareAbsoluteUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

const statusTone = (status) => ({
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
  Sent: 'bg-blue-50 text-blue-700 border-blue-200',
  Viewed: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  Expired: 'bg-rose-50 text-rose-700 border-rose-200',
}[status] || 'bg-slate-100 text-slate-600 border-slate-200');

const cardCls = 'bg-white rounded-2xl border border-slate-200 p-4 sm:p-5';

export default function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    quotations = [], customers = [], approveQuotation, updateQuotationStatus,
    recordQuotationActivity, syncQuotationShare, convertQuotationToSalesOrder,
    backendStatus, refreshFromBackend,
  } = useERP() || {};
  const [sendOpen, setSendOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState('');
  const [responding, setResponding] = useState(false);

  const quote = useMemo(
    () => (quotations || []).find((q) => String(q.id) === String(id)),
    [quotations, id],
  );
  const customer = useMemo(
    () => (customers || []).find((c) => c.id === quote?.customerId)
      || (customers || []).find((c) => c.name === quote?.customer)
      || null,
    [customers, quote],
  );

  const share = quote?.share || null;
  const shareActive = Boolean(share?.url) && (!share?.expiresAt || Date.parse(share.expiresAt) > Date.now());
  const absoluteShareUrl = shareAbsoluteUrl(share?.url || '');

  const items = useMemo(() => (Array.isArray(quote?.items) ? quote.items : []), [quote]);
  const totals = useMemo(() => {
    const qty = items.reduce((s, it) => s + num(it.qty ?? it.quantity), 0);
    const subtotal = items.reduce((s, it) => s + num(it.qty ?? it.quantity) * num(it.rate ?? it.price), 0);
    const gst = quote?.taxAmount != null
      ? num(quote.taxAmount)
      : Math.max(0, num(quote?.amount) - subtotal);
    const rateSet = new Set(items.map((it) => it.tax ?? it.taxRate ?? it.gstPct).filter((x) => x != null));
    const rates = Array.from(rateSet);
    const effectivePct = rates.length === 1
      ? `${rates[0]}%`
      : rates.length > 1
        ? `${rates.join('%, ')}%`
        : (subtotal > 0 ? `${((gst / subtotal) * 100).toFixed(0)}%` : '5%');
    return { count: items.length, qty, subtotal, gst, effectivePct };
  }, [items]);

  const activity = Array.isArray(quote?.activity) ? quote.activity : [];
  const sentEvent = activity.find((e) => e.type === 'Quotation Sent');
  const viewedEvent = activity.find((e) => e.type === 'Quotation Viewed');
  const decisionEvent = activity.find((e) => ['Quotation Accepted', 'Quotation Rejected'].includes(e.type));
  const milestones = [
    { label: 'Quotation Created', detail: quote?.date ? `${quote.date} • ${quote?.salesPerson || 'Sales'}` : '', done: true },
    { label: 'Link Sent to Customer', detail: sentEvent ? `${new Date(sentEvent.timestamp).toLocaleString()} • Email / WhatsApp` : 'Not yet', done: Boolean(sentEvent) || ['Sent', 'Viewed', 'Accepted', 'Converted', 'Rejected'].includes(quote?.status) },
    { label: 'Viewed by Customer', detail: viewedEvent ? new Date(viewedEvent.timestamp).toLocaleString() : 'Not yet', done: Boolean(viewedEvent) || ['Viewed', 'Accepted', 'Converted', 'Rejected'].includes(quote?.status) },
    { label: 'Approved / Rejected', detail: decisionEvent ? new Date(decisionEvent.timestamp).toLocaleString() : 'Not yet', done: Boolean(decisionEvent) || ['Accepted', 'Converted', 'Rejected'].includes(quote?.status) },
  ];

  async function ensureShare(expiryDays = 30) {
    if (!quote || !isServerIdLike(quote.id)) throw new Error('Save this quotation to the server first.');
    const result = await sharingRequest(quote.id, { expiryDays });
    syncQuotationShare?.(quote.id, result);
    return result;
  }

  async function handleCopyLink() {
    setShareError('');
    setShareBusy(true);
    try {
      let current = shareActive ? share : null;
      if (!current) current = await ensureShare(30);
      await navigator.clipboard.writeText(shareAbsoluteUrl(current.url));
      recordQuotationActivity?.(quote.id, 'Share link copied');
    } catch (err) {
      setShareError(err?.message || 'Could not copy the link.');
    } finally {
      setShareBusy(false);
    }
  }

  async function handleRegenerate() {
    setShareError('');
    setShareBusy(true);
    try {
      await ensureShare(30);
    } catch (err) {
      setShareError(err?.message || 'Could not regenerate the link.');
    } finally {
      setShareBusy(false);
    }
  }

  async function handleRespond(approved) {
    if (!quote || responding) return;
    setResponding(true);
    try {
      if (approved) {
        await approveQuotation(quote.id);
      } else {
        if (isBackendEnabled() && isServerId(quote.id)) {
          try {
            await api.post(`/sales/quotations/${quote.id}/reject/`);
          } catch (err) {
            console.warn('[QuotationDetail] reject API call failed:', err);
          }
        }
        updateQuotationStatus?.(quote.id, 'Rejected');
      }
      recordQuotationActivity?.(quote.id, approved ? 'Quotation Accepted' : 'Quotation Rejected');
    } finally {
      setResponding(false);
    }
  }

  function handleConvert() {
    const order = convertQuotationToSalesOrder?.(quote.id);
    if (order) navigate('/sales/orders');
  }

  if (!quote) {
    // Empty collection = still pulling from the server (or the pull failed) —
    // never leave this as a dead "Loading…" without a way out.
    const loading = (quotations || []).length === 0 && backendStatus?.loading;
    const failed = (quotations || []).length === 0 && !backendStatus?.loading;
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate('/sales/quotations')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50">
          <ArrowLeft size={14} /> Back to Quotations
        </button>
        <div className="card p-8 text-center text-xs text-slate-500 space-y-3">
          <p>
            {loading
              ? 'Loading quotation…'
              : failed
                ? 'Could not load quotations from the server. Check that the backend is running, then retry.'
                : 'This quotation no longer exists. It may have been deleted.'}
          </p>
          {failed && (
            <button
              type="button"
              onClick={() => refreshFromBackend?.()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg"
            >
              <RefreshCw size={13} /> Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-medium text-slate-400">
        <Link to="/sales/quotations" className="hover:text-blue-600">Sales</Link>
        <span className="mx-1">›</span>
        <Link to="/sales/quotations" className="hover:text-blue-600">Quotations</Link>
        <span className="mx-1">›</span>{' '}
        <span className="text-slate-600 font-semibold">{quote.quoteNumber}</span>
      </p>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-2 flex-wrap">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><FileText size={16} /></span>
            Quotation Details
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusTone(quote.status)}`}>
              <Send size={11} /> {quote.status}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">{quote.quoteNumber} • {quote.customer}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSendOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg">
            <Send size={13} /> Send to Customer
          </button>
          <button type="button" onClick={handleCopyLink} disabled={shareBusy} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-50">
            <Copy size={13} /> Copy Link
          </button>
          <button type="button" onClick={() => setPrintOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg">
            <Download size={13} /> Download PDF
          </button>
          <button type="button" onClick={() => setPrintOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg">
            <Printer size={13} /> Print
          </button>
          <button type="button" onClick={() => navigate('/sales/quotations')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg">
            <X size={13} /> Close
          </button>
        </div>
      </div>
      {shareError && <p role="alert" className="text-xs font-semibold text-rose-600">{shareError}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={cardCls}>
              <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"><Building2 size={13} /> Customer</p>
              <p className="text-xs font-bold text-slate-900 mt-1">{quote.customer}</p>
              <p className="text-[11px] text-slate-500">{customer?.city || ''}{customer?.state ? `, ${customer.state}` : ''}{customer?.country ? `, ${customer.country}` : ''}</p>
            </div>

            <div className={cardCls}>
              <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"><CalendarDays size={13} /> Quotation Date</p>
              <p className="text-xs font-bold text-slate-900 mt-1">{quote.date || '—'}</p>
              <p className="text-[11px] text-slate-500">Valid Until: {quote.validUntil || '—'} <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">{daysLeftText(quote.validUntil)}</span></p>
            </div>
            <div className={cardCls}>
              <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"><IndianRupee size={13} /> Total Value</p>
              <p className="text-sm font-extrabold text-slate-900 mt-1">{inr(quote.amount || 0)}</p>
              <p className="text-[11px] text-slate-500">{totals.count} Items • {totals.qty.toLocaleString('en-IN')} M</p>
            </div>
            <div className={cardCls}>
              <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5"><FileText size={13} /> Status</p>
              <p className="text-xs font-bold text-slate-900 mt-1">{quote.status === 'Sent' ? 'Sent to Customer' : quote.status}</p>
              <p className="text-[11px] text-slate-500">{quote.status === 'Sent' ? 'Awaiting Response' : quote.status === 'Draft' ? 'Not sent yet' : ''}</p>
            </div>
          </div>

          <div className={cardCls}>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Link2 size={14} className="text-blue-600" /> Customer Quotation Link</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Share this secure link with your customer to view the quotation.</p>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <input readOnly value={absoluteShareUrl || 'No link generated yet.'} className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono" />
              <button type="button" onClick={handleCopyLink} disabled={shareBusy} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50">
                <Copy size={13} /> Copy Link
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px]">
              <span className={shareActive ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                {shareActive ? `● Link Active${share?.expiresAt ? ` • Expires on ${new Date(share.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}` : '○ No active link'}
              </span>
              <button type="button" onClick={handleRegenerate} disabled={shareBusy} className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline disabled:opacity-50">
                <RefreshCw size={12} /> Regenerate Link
              </button>
            </div>
          </div>

          <div className={`rounded-2xl border p-4 sm:p-5 ${quote.status === 'Accepted' || quote.status === 'Converted' ? 'border-emerald-200 bg-emerald-50/60' : quote.status === 'Rejected' ? 'border-rose-200 bg-rose-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${quote.status === 'Accepted' || quote.status === 'Converted' ? 'bg-emerald-100 text-emerald-700' : quote.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>◉</span> Customer Response</h3>
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${quote.status === 'Accepted' || quote.status === 'Converted' ? 'text-emerald-700' : quote.status === 'Rejected' ? 'text-rose-700' : 'text-amber-700'}`}><Clock3 size={12} /> {quote.status === 'Accepted' || quote.status === 'Converted' ? 'Accepted' : quote.status === 'Rejected' ? 'Rejected' : 'Awaiting Response'}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{quote.status === 'Accepted' || quote.status === 'Converted' ? 'Customer has accepted this quotation.' : quote.status === 'Rejected' ? 'Customer has rejected this quotation.' : 'Waiting for customer to respond to this quotation.'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <button type="button" onClick={() => handleRespond(true)} disabled={responding || ['Accepted', 'Converted'].includes(quote.status)} className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white p-3 text-left hover:bg-emerald-50/50 disabled:opacity-50">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0"><CheckCircle2 size={16} /></span>
                <span><span className="block text-xs font-bold text-slate-900">Approved</span><span className="block text-[11px] text-slate-500">Customer accepts the quotation</span></span>
              </button>
              <button type="button" onClick={() => handleRespond(false)} disabled={responding || ['Rejected'].includes(quote.status)} className="flex items-center gap-3 rounded-xl border border-rose-200 bg-white p-3 text-left hover:bg-rose-50/50 disabled:opacity-50">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white shrink-0"><X size={16} /></span>
                <span><span className="block text-xs font-bold text-slate-900">Rejected</span><span className="block text-[11px] text-slate-500">Customer declines the quotation</span></span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-[11px]">
              <div className="flex items-center gap-2 text-slate-600"><Eye size={13} className="text-slate-400" /><span><strong className="block text-xs text-slate-800">{viewedEvent ? 'Viewed' : 'Not Viewed Yet'}</strong>{viewedEvent ? new Date(viewedEvent.timestamp).toLocaleString() : 'Customer has not opened the quotation.'}</span></div>
              <div className="flex items-center gap-2 text-slate-600"><Clock3 size={13} className="text-slate-400" /><span><strong className="block text-xs text-slate-800">Last Activity</strong>{activity.length > 0 ? new Date(activity[activity.length - 1].timestamp).toLocaleString() : 'No activity yet'}</span></div>
            </div>
          </div>

          <div className={cardCls}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><FileText size={14} className="text-blue-600" /> Quotation Summary</h3>
              <button type="button" onClick={() => setPrintOpen(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-blue-700 text-xs font-semibold rounded-lg">
                <Eye size={13} /> View Full Quotation
              </button>
            </div>
            <dl className="text-xs space-y-1.5 mt-3">
              {quote.leadName && (
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Lead Name</dt><dd className="font-semibold text-slate-900 text-right">{quote.leadName}</dd></div>
              )}
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Customer</dt><dd className="font-semibold text-slate-900 text-right">{quote.customer}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Contact Person</dt><dd className="font-semibold text-slate-900 text-right">{quote.contactPerson || '—'}{customer?.phone ? ` • +91 ${customer.phone}` : ''}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Total Items</dt><dd className="font-semibold text-slate-900">{totals.count} Items</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Total Quantity</dt><dd className="font-semibold text-slate-900">{totals.qty.toLocaleString('en-IN')} M</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Subtotal</dt><dd className="font-mono font-semibold">{inr(totals.subtotal)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">GST ({totals.effectivePct})</dt><dd className="font-mono font-semibold">{inr(totals.gst)}</dd></div>
              <div className="flex justify-between items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                <dt className="font-bold text-slate-900">Grand Total</dt>
                <dd className="font-mono font-extrabold text-emerald-700 text-sm">{inr(quote.amount || 0)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="space-y-4">
          <div className={cardCls}>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3"><Clock3 size={14} className="text-blue-600" /> Quotation Activity</h3>
            <ol className="space-y-0">
              {milestones.map((m, i) => (
                <li key={m.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${m.done ? (i === 0 ? 'bg-emerald-500' : 'bg-blue-600') : 'bg-slate-200'} text-white`}>
                      {m.done ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
                    </span>
                    {i < milestones.length - 1 && <span className={`w-0.5 flex-1 min-h-[18px] ${m.done ? 'bg-blue-200' : 'bg-slate-100'}`} />}
                  </div>
                  <div className="pb-4">
                    <p className="text-xs font-bold text-slate-900">{m.label}</p>
                    <p className="text-[11px] text-slate-500">{m.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            {activity.length > 0 && (
              <details className="text-[11px] text-slate-500">
                <summary className="cursor-pointer font-semibold">All activity ({activity.length})</summary>
                {activity.map((e) => (
                  <p key={e.id} className="py-1 border-t border-slate-100">{e.type} <span className="text-slate-400">• {e.timestamp ? new Date(e.timestamp).toLocaleString() : ''}</span></p>
                ))}
              </details>
            )}
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">≫ Next Steps</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">Once the customer approves this quotation, it will be automatically converted to a customer and you can create a Sales Order.</p>
            <button type="button" onClick={handleConvert} disabled={['Converted', 'Rejected', 'Cancelled'].includes(quote.status)} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50" title={['Rejected', 'Cancelled'].includes(quote.status) ? "Rejected quotation cannot be converted" : ""}>
              <RefreshCw size={13} /> {['Rejected', 'Cancelled'].includes(quote.status) ? "Cannot Convert (Rejected)" : "Convert to Sales Order"}
            </button>
          </div>

          <div className={cardCls}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><span className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-50 text-blue-600"><FileText size={13} /></span> Quoted Items ({totals.count})</h3>
              <button type="button" onClick={() => setPrintOpen(true)} className="text-[11px] font-semibold text-blue-700 hover:underline">View All Items</button>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[11px] font-bold text-slate-500 border-b border-slate-100">
                  <th className="py-1.5 pr-2 w-7">#</th>
                  <th className="py-1.5 pr-2">Fabric / Item</th>
                  <th className="py-1.5 pr-2">Quality</th>
                  <th className="py-1.5 pr-2">Colour</th>
                  <th className="py-1.5 pr-2 text-right">Qty</th>
                  <th className="py-1.5 text-right">UOM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="py-2 pr-2 text-slate-400">{idx + 1}</td>
                    <td className="py-2 pr-2 font-semibold text-slate-800">{it.itemName || it.name || it.description || '—'}</td>
                    <td className="py-2 pr-2 text-slate-600">{it.quality || '—'}</td>
                    <td className="py-2 pr-2 text-slate-600">{it.colour || it.color || '—'}</td>
                    <td className="py-2 pr-2 text-right font-mono">{num(it.qty ?? it.quantity).toLocaleString('en-IN')}</td>
                    <td className="py-2 text-right text-slate-600">{it.uom || it.unit || '—'}</td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-slate-400">No items on this quotation.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {sendOpen && (
        <SendQuotationModal
          quotation={quote}
          shareUrl={absoluteShareUrl}
          customerEmail={customer?.email || ''}
          customerPhone={customer?.phone || ''}
          onClose={() => setSendOpen(false)}
          onSent={(channel) => {
            setSendOpen(false);
            recordQuotationActivity?.(quote.id, 'Quotation Sent');
            if (quote.status === 'Draft') updateQuotationStatus?.(quote.id, 'Sent');
          }}
        />
      )}
      <PrintQuotationModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        quotation={quote}
        onPrint={() => recordQuotationActivity?.(quote.id, 'PDF print requested')}
      />
    </div>
  );
}

function isServerIdLike(id) {
  return typeof id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
