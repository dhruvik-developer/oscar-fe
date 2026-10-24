import React, { useMemo, useState } from 'react';
import { CheckCircle2, Copy, Download, FileText, Link2, Mail, MessageCircle, Send, X } from 'lucide-react';
import { api, getAuthToken } from '../../services/api';
import { isBackendEnabled, isServerId } from '../../services/resourceSync';
import { sharingRequest } from '../../services/quotationSharing';

function absoluteShareUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  return url;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function inr(value) {
  return `₹${(Math.round(Number(value) || 0)).toLocaleString('en-IN')}`;
}

const inputCls = 'w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500';

export default function SendQuotationModal({
  quotation, shareUrl = '', customerEmail = '', customerPhone = '',
  onClose, onSent,
}) {
  const [channel, setChannel] = useState('email');
  const [emails, setEmails] = useState(customerEmail ? [customerEmail] : []);
  const [emailInput, setEmailInput] = useState('');
  const [phone, setPhone] = useState(customerPhone || '');
  const [subject, setSubject] = useState(`Quotation ${quotation?.quoteNumber || quotation?.quotationNumber || ''} from ${quotation?.customer || 'us'}`);
  const [message, setMessage] = useState(
    `Dear ${quotation?.customer || 'Customer'},\n\nPlease find attached our quotation (${quotation?.quoteNumber || quotation?.quotationNumber || ''}) for your reference. You can view the quotation online using the secure link below.\n\nIf you have any questions, please let us know.`,
  );
  const [includeLink, setIncludeLink] = useState(true);
  const [requestApproval, setRequestApproval] = useState(false);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [sentOk, setSentOk] = useState('');
  const [sentDone, setSentDone] = useState(false);

  const items = useMemo(() => (Array.isArray(quotation?.items) ? quotation.items : []), [quotation]);
  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + num(it.qty ?? it.quantity) * num(it.rate ?? it.price), 0);
    const gst = quotation?.taxAmount != null
      ? num(quotation.taxAmount)
      : Math.max(0, num(quotation?.amount) - subtotal);
    const rateSet = new Set(items.map((it) => it.tax ?? it.taxRate ?? it.gstPct).filter((x) => x != null));
    const rates = Array.from(rateSet);
    const effectivePct = rates.length === 1
      ? `${rates[0]}%`
      : rates.length > 1
        ? `${rates.join('%, ')}%`
        : (subtotal > 0 ? `${((gst / subtotal) * 100).toFixed(0)}%` : '5%');
    return { subtotal, gst, grand: num(quotation?.amount) || subtotal + gst, effectivePct };
  }, [items, quotation]);

  function addEmail(value) {
    const v = String(value || '').trim().replace(/[,;]$/, '');
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError(`"${v}" is not a valid email address.`);
      return;
    }
    if (!emails.includes(v)) setEmails((prev) => [...prev, v]);
    setEmailInput('');
    setError('');
  }

  function decisionUrl(linkUrl, decision) {
    if (!linkUrl) return '';
    const sep = linkUrl.includes('?') ? '&' : '?';
    return `${linkUrl}${sep}decision=${decision}`;
  }

  function fullMessage(linkUrl) {
    let body = message.trim();
    if (requestApproval) {
      body += '\n\nPlease open the secure link below to accept or reject this quotation online — your response reaches us immediately.';
    }
    if (includeLink && linkUrl) {
      body += `\n\nView quotation: ${linkUrl}`;
      // Plain-text fallback for the Accept / Reject buttons in the HTML email.
      body += `\nAccept: ${decisionUrl(linkUrl, 'accept')}`;
      body += `\nReject: ${decisionUrl(linkUrl, 'reject')}`;
    } else if (requestApproval && linkUrl) {
      body += `\n\nView quotation: ${linkUrl}`;
      body += `\nAccept: ${decisionUrl(linkUrl, 'accept')}`;
      body += `\nReject: ${decisionUrl(linkUrl, 'reject')}`;
    }
    return body;
  }

  // The approval buttons live on the secure link page, so a link must exist
  // before the email goes out. Mint one when the quotation has none yet.
  async function ensureLink() {
    if (shareUrl) return shareUrl;
    const result = await sharingRequest(quotation.id, { expiryDays: 30 });
    const url = absoluteShareUrl(result?.url || '');
    if (!url) throw new Error('Could not generate the secure quotation link.');
    return url;
  }

  async function handleSendEmail() {
    setError('');
    setSentOk('');
    if (emails.length === 0) {
      setError('Add at least one recipient email address.');
      return;
    }
    if (!isBackendEnabled()) {
      setError('You are not signed in. Sign in and try again.');
      return;
    }
    if (!quotation?.id) {
      setError('Save this quotation first, then send it.');
      return;
    }
    if (!isServerId(quotation.id)) {
      setError('Save this quotation to the server first, then send it. This copy only exists in this browser.');
      return;
    }
    setSending(true);
    try {
      // A quotation PDF is attached server-side on every email send. The
      // secure link page carries the accept/reject buttons, so make sure a
      // link exists before sending when the email promises one.
      let linkUrl = shareUrl;
      if ((includeLink || requestApproval) && !linkUrl) {
        try {
          linkUrl = await ensureLink();
        } catch (linkErr) {
          setError(linkErr?.message || 'Could not generate the secure quotation link.');
          return;
        }
      }
      const result = await api.post(`/sales/quotations/${quotation.id}/send/`, {
        channel: 'email',
        recipients: emails,
        subject: subject.trim(),
        message: fullMessage(linkUrl),
      });
      if (result && result.sent === false) {
        setError(result.note || 'The email was recorded but not delivered.');
        return;
      }
      setSentOk(`Email sent to ${emails.join(', ')}.`);
      setSentDone(true);
    } catch (err) {
      setError(describeSendError(err));
    } finally {
      setSending(false);
    }
  }

  function describeSendError(err) {
    const payload = err?.payload;
    const backendMessage = payload?.message || payload?.detail || payload?.error;
    if (backendMessage && !/^request failed with status/i.test(backendMessage)) {
      const code = payload?.code ? ` (${payload.code})` : '';
      return `${backendMessage}${code}`;
    }
    const fieldErrors = payload?.field_errors;
    if (fieldErrors && typeof fieldErrors === 'object') {
      const [field, messages] = Object.entries(fieldErrors)[0] || [];
      if (field) return `${field}: ${[].concat(messages)[0]}`;
    }
    if (err?.status === 500) {
      return 'The server hit an unexpected error (500). Check the backend console traceback and the Network → Response body for this request, then retry.';
    }
    return err?.message || 'The email could not be sent.';
  }

  async function handleWhatsApp() {
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) {
      setError('Enter the customer mobile number first.');
      return;
    }
    if (!isServerId(quotation?.id)) {
      setError('Save this quotation to the server first, then share it. This copy only exists in this browser.');
      return;
    }
    setError('');
    setSentOk('');
    let linkUrl = shareUrl;
    if ((includeLink || requestApproval) && !linkUrl) {
      try {
        linkUrl = await ensureLink();
      } catch (linkErr) {
        setError(linkErr?.message || 'Could not generate the secure quotation link.');
        return;
      }
    }
    // WhatsApp cannot receive a file through a link — fetch the PDF now so
    // it is waiting in Downloads, ready to attach to the chat that opens.
    let pdfReady = false;
    try {
      pdfReady = await downloadPdf();
    } catch {
      pdfReady = false;
    }
    const text = encodeURIComponent(`${subject}\n\n${fullMessage(linkUrl)}`);
    window.open(`https://wa.me/${digits}?text=${text}`, '_blank', 'noopener');
    setSentOk(
      pdfReady
        ? 'WhatsApp opened and PDF downloaded — attach the PDF file to the chat before sending.'
        : 'WhatsApp opened. The PDF could not be downloaded — use the Download PDF button, then attach it manually.',
    );
    setSentDone(true);
  }

  // The same PDF the email attaches, for the WhatsApp flow: `wa.me` links
  // can only prefill text, so the sender downloads the file here and
  // attaches it to the chat manually.
  async function downloadPdf() {
    if (!isBackendEnabled() || !isServerId(quotation?.id)) return false;
    const base = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');
    const token = getAuthToken();
    const response = await fetch(`${base}/sales/quotations/${quotation.id}/pdf/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return false;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${quotation?.quoteNumber || quotation?.quotationNumber || 'quotation'}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  }

  async function handleDownloadPdf() {
    setError('');
    setSentOk('');
    if (!isBackendEnabled()) {
      setError('You are not signed in. Sign in and try again.');
      return;
    }
    if (!isServerId(quotation?.id)) {
      setError('Save this quotation to the server first, then download it.');
      return;
    }
    setDownloading(true);
    try {
      const ok = await downloadPdf();
      if (!ok) throw new Error('PDF download failed.');
      setSentOk('PDF downloaded — attach it to your WhatsApp chat.');
    } catch (err) {
      setError(err?.message || 'The PDF could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) {
      setError('Generate the customer link first (Copy Link on the quotation page).');
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSentOk('Link copied.');
    } catch {
      setError('Clipboard blocked — select the link and copy it manually.');
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Send size={14} /></span>
              Send Quotation to Customer
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Share this quotation with your customer via Email or WhatsApp.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Close"><X size={18} /></button>
        </div>

        {sentDone ? (
          <div className="flex-1 overflow-y-auto px-5 py-10">
            <div className="mx-auto max-w-sm text-center">
              <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={30} />
              </span>
              <h3 className="mt-3 text-base font-extrabold text-slate-900">Sent to Customer Successfully</h3>
              <p role="status" className="mt-1.5 text-xs font-semibold text-slate-700">{sentOk}</p>
              {channel === 'email' ? (
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  Quotation {quotation?.quoteNumber || quotation?.quotationNumber || ''} went out with its PDF
                  ({quotation?.quoteNumber || quotation?.quotationNumber || 'quotation'}.pdf) attached
                  {(includeLink || requestApproval) ? ' and the secure approve / reject link inside' : ''}.
                </p>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  Remember to attach the downloaded PDF file to the WhatsApp chat before you press send there.
                </p>
              )}
              <button
                type="button"
                onClick={() => onSent?.(channel)}
                className="mt-5 inline-flex items-center gap-1.5 px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
        <>
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 text-[11px] text-blue-800 bg-blue-50/60">
          <Link2 size={13} className="shrink-0" />
          <span>A secure quotation link will be shared with your customer. They can view the quotation and approve or reject it directly.</span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => { setChannel('email'); setError(''); }}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border ${channel === 'email' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <Mail size={14} /> Email
            </button>
            <button
              type="button"
              onClick={() => { setChannel('whatsapp'); setError(''); }}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border ${channel === 'whatsapp' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <MessageCircle size={14} /> WhatsApp
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {channel === 'email' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">To (Email Address) *</label>
                    <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-300 px-2 py-1.5 min-h-[38px]">
                      {emails.map((m) => (
                        <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                          {m}
                          <button type="button" onClick={() => setEmails((prev) => prev.filter((x) => x !== m))} className="hover:text-blue-900" aria-label={`Remove ${m}`}>×</button>
                        </span>
                      ))}
                      <input
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onBlur={() => addEmail(emailInput)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(emailInput); } }}
                        placeholder={emails.length === 0 ? 'name@company.com' : 'Add more email addresses…'}
                        className="flex-1 min-w-[140px] outline-none text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Subject *</label>
                    <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Message *</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} className={`${inputCls} leading-relaxed`} />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p className="font-bold text-slate-800">Additional Options</p>
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={includeLink} onChange={(e) => setIncludeLink(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                      Include secure quotation link in the email
                    </label>
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={requestApproval} onChange={(e) => setRequestApproval(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                      Request customer to approve online
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">WhatsApp Number *</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 919876543210" className={inputCls} />
                    <p className="text-[11px] text-slate-400 mt-1">Opens WhatsApp with the quotation message prefilled.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-bold text-slate-800">Quotation PDF</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">WhatsApp links carry text only — download the PDF here, then attach it to the chat yourself.</p>
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={downloading}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg disabled:opacity-50"
                    >
                      <Download size={13} /> {downloading ? 'Preparing…' : 'Download PDF'}
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Message</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} className={`${inputCls} leading-relaxed`} />
                  </div>
                </>
              )}
              {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
              {sentOk && <p role="status" className="text-xs font-semibold text-emerald-600">{sentOk}</p>}
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><FileText size={13} className="text-blue-600" /> Quotation Preview</p>
                <span className="text-[11px] font-semibold text-blue-700">View PDF</span>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">Oscar</p>
                    <p className="text-[10px] tracking-widest text-slate-400 font-bold">TEXTILE ERP</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-extrabold text-slate-900">QUOTATION</p>
                    <p className="text-[11px] font-mono text-slate-600">{quotation?.quoteNumber || quotation?.quotationNumber}</p>
                  </div>
                </div>
                <div className="flex items-start justify-between mt-2 text-[11px]">
                  <div>
                    <p className="font-bold text-slate-800">{quotation?.customer}</p>
                    <p className="text-slate-500">Date: {quotation?.date || '—'}</p>
                  </div>
                  <p className="text-slate-500">Valid Until: {quotation?.validUntil || '—'}</p>
                </div>
                <table className="w-full text-left text-[11px] mt-2">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-100">
                      <th className="py-1 pr-1 w-6">#</th>
                      <th className="py-1 pr-1">Fabric / Item</th>
                      <th className="py-1 pr-1 text-right">Qty</th>
                      <th className="py-1 pr-1 text-right">Rate</th>
                      <th className="py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((it, i) => (
                      <tr key={it.id || i}>
                        <td className="py-1 pr-1 text-slate-400">{i + 1}</td>
                        <td className="py-1 pr-1 font-semibold text-slate-800">{it.itemName || it.name || it.description}</td>
                        <td className="py-1 pr-1 text-right font-mono">{num(it.qty ?? it.quantity).toLocaleString('en-IN')}</td>
                        <td className="py-1 pr-1 text-right font-mono">₹{num(it.rate ?? it.price).toLocaleString('en-IN')}</td>
                        <td className="py-1 text-right font-mono font-bold">{inr(num(it.qty ?? it.quantity) * num(it.rate ?? it.price))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <dl className="text-[11px] mt-2 space-y-0.5">
                  <div className="flex justify-between text-slate-600"><dt>Subtotal</dt><dd className="font-mono">{inr(totals.subtotal)}</dd></div>
                  <div className="flex justify-between text-slate-600"><dt>GST ({totals.effectivePct})</dt><dd className="font-mono">{inr(totals.gst)}</dd></div>
                  <div className="flex justify-between font-bold text-slate-900"><dt>Grand Total</dt><dd className="font-mono">{inr(totals.grand)}</dd></div>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
          <button type="button" onClick={handleCopyLink} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-blue-700 text-xs font-bold rounded-lg">
            <Copy size={13} /> Copy Link
          </button>
          <span className="hidden sm:block flex-1 min-w-0 truncate font-mono text-[11px] text-slate-400">{shareUrl}</span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200">Cancel</button>
            {channel === 'email' ? (
              <button type="button" onClick={handleSendEmail} disabled={sending} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50">
                <Send size={13} /> {sending ? 'Sending…' : 'Send to Customer'}
              </button>
            ) : (
              <button type="button" onClick={handleWhatsApp} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">
                <Send size={13} /> Open WhatsApp
              </button>
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
