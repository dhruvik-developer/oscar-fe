import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { partiesService, receivablesService } from '../../../services/domainServices';
import {
  PAYMENT_MODES, addDays, date, daysBetween, errorText, money, newIdempotencyKey, num, today,
} from './receivablesFormat';

const field = 'w-full h-9 rounded-lg border border-border bg-card px-2.5 text-[13px] text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
const label = 'block text-[12px] font-semibold text-[var(--text-secondary)] mb-1';
const primaryBtn = 'h-9 px-4 rounded-lg bg-primary text-white text-[13px] font-semibold hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
const ghostBtn = 'h-9 px-3 rounded-lg border border-border text-[13px] font-medium text-text hover:bg-soft cursor-pointer';

function rows(body) {
  return Array.isArray(body) ? body : body?.results || [];
}

function ErrorLine({ message }) {
  if (!message) return null;
  return <p role="alert" className="text-[12.5px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{message}</p>;
}

// ── Record a customer receipt, allocated across open invoices ──────────────
export function RecordPaymentModal({ isOpen, onClose, onSaved, presetCustomerId, presetInvoiceId }) {
  const [customers, setCustomers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [customerId, setCustomerId] = useState(presetCustomerId || '');
  const [openInvoices, setOpenInvoices] = useState([]);
  const [form, setForm] = useState({ date: today(), amount: '', mode: 'Bank Transfer', bankAccountId: '', transactionReference: '', referenceNumber: '', notes: '' });
  const [alloc, setAlloc] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [idemKey, setIdemKey] = useState(newIdempotencyKey);

  useEffect(() => {
    if (!isOpen) return;
    setCustomerId(presetCustomerId || '');
    setForm({ date: today(), amount: '', mode: 'Bank Transfer', bankAccountId: '', transactionReference: '', referenceNumber: '', notes: '' });
    setAlloc({});
    setError('');
    setIdemKey(newIdempotencyKey());
    partiesService.getCustomers({ page_size: 200 }).then((b) => setCustomers(rows(b))).catch(() => setCustomers([]));
    receivablesService.getBankAccounts().then((b) => {
      const list = rows(b).filter((a) => a.isActive !== false);
      setBanks(list);
      const preferred = list.find((a) => a.isDefault) || list[0];
      if (preferred) setForm((f) => ({ ...f, bankAccountId: f.bankAccountId || preferred.id }));
    }).catch(() => setBanks([]));
  }, [isOpen, presetCustomerId]);

  useEffect(() => {
    if (!isOpen || !customerId) { setOpenInvoices([]); return; }
    receivablesService.getReceivables({ customerId, page_size: 200 })
      .then((b) => {
        const list = rows(b).filter((r) => num(r.outstandingAmount) > 0);
        setOpenInvoices(list);
        if (presetInvoiceId) {
          const inv = list.find((r) => r.id === presetInvoiceId);
          if (inv) {
            setAlloc({ [inv.id]: String(num(inv.outstandingAmount)) });
            setForm((f) => ({ ...f, amount: f.amount || String(num(inv.outstandingAmount)) }));
          }
        }
      })
      .catch((err) => setError(errorText(err, 'Could not load open invoices.')));
  }, [isOpen, customerId, presetInvoiceId]);

  const allocated = Object.values(alloc).reduce((s, v) => s + num(v), 0);
  const amount = num(form.amount);
  const unallocated = Math.round((amount - allocated) * 100) / 100;
  const overInvoice = openInvoices.find((inv) => num(alloc[inv.id]) > num(inv.outstandingAmount) + 0.005);

  const autoAllocate = () => {
    let left = amount;
    const next = {};
    // Oldest due date first.
    [...openInvoices].sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || ''))).forEach((inv) => {
      if (left <= 0) return;
      const take = Math.min(left, num(inv.outstandingAmount));
      if (take > 0) next[inv.id] = String(Math.round(take * 100) / 100);
      left -= take;
    });
    setAlloc(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!customerId) return setError('Choose the customer.');
    if (amount <= 0) return setError('Enter the amount received.');
    if (form.mode !== 'Cash' && !form.bankAccountId) return setError('Choose the bank account the money was received into.');
    if (overInvoice) return setError(`Allocation to ${overInvoice.invoiceNumber} is more than its outstanding balance.`);
    if (unallocated < -0.005) return setError('Allocations add up to more than the amount received.');
    setSaving(true);
    try {
      const saved = await receivablesService.recordPayment({
        customerId,
        date: form.date,
        amount,
        mode: form.mode,
        bankAccountId: form.mode === 'Cash' ? undefined : form.bankAccountId,
        transactionReference: form.transactionReference || undefined,
        referenceNumber: form.referenceNumber || undefined,
        notes: form.notes || undefined,
        allocations: Object.entries(alloc)
          .filter(([, v]) => num(v) > 0)
          .map(([invoiceId, v]) => ({ invoiceId, amount: num(v) })),
      }, idemKey);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(errorText(err, 'The receipt could not be recorded.'));
    } finally {
      setSaving(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Record customer payment"
      subtitle="The receipt is posted to the bank/cash account and the customer ledger when you save."
      footer={(
        <div className="flex items-center justify-between gap-3 w-full">
          <span className="text-[12px] text-muted">
            Allocated {money(allocated)}{unallocated > 0.005 ? ` · ${money(unallocated)} kept as customer advance` : ''}
          </span>
          <div className="flex gap-2">
            <button type="button" className={ghostBtn} onClick={onClose}>Cancel</button>
            <button type="submit" form="record-payment-form" className={primaryBtn} disabled={saving}>{saving ? 'Saving…' : 'Save receipt'}</button>
          </div>
        </div>
      )}
    >
      <form id="record-payment-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="rp-customer">Customer *</label>
            <select id="rp-customer" className={field} value={customerId} onChange={(e) => { setCustomerId(e.target.value); setAlloc({}); }}>
              <option value="">Choose a customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="rp-date">Payment date *</label>
            <input id="rp-date" type="date" className={field} value={form.date} onChange={set('date')} required />
          </div>
          <div>
            <label className={label} htmlFor="rp-amount">Amount received (₹) *</label>
            <input id="rp-amount" type="number" min="0.01" step="0.01" className={`${field} font-mono`} value={form.amount} onChange={set('amount')} required />
          </div>
          <div>
            <label className={label} htmlFor="rp-mode">Payment mode *</label>
            <select id="rp-mode" className={field} value={form.mode} onChange={set('mode')}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="rp-bank">Bank / cash account {form.mode !== 'Cash' ? '*' : ''}</label>
            <select id="rp-bank" className={field} value={form.bankAccountId} onChange={set('bankAccountId')} disabled={form.mode === 'Cash'}>
              <option value="">{form.mode === 'Cash' ? 'Cash in hand' : 'Choose an account…'}</option>
              {banks.map((b) => <option key={b.id} value={b.id}>{b.name}{b.accountNumber ? ` · ${b.accountNumber}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="rp-txn">Transaction reference (UTR / cheque no.)</label>
            <input id="rp-txn" className={`${field} font-mono`} value={form.transactionReference} onChange={set('transactionReference')} />
          </div>
          <div>
            <label className={label} htmlFor="rp-ref">Reference number</label>
            <input id="rp-ref" className={field} value={form.referenceNumber} onChange={set('referenceNumber')} />
          </div>
          <div>
            <label className={label} htmlFor="rp-notes">Notes</label>
            <input id="rp-notes" className={field} value={form.notes} onChange={set('notes')} />
          </div>
        </div>

        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-soft/60">
            <span className="text-[12.5px] font-semibold text-text">Invoice allocation</span>
            <button type="button" onClick={autoAllocate} disabled={!amount || openInvoices.length === 0} className="text-[12px] font-semibold text-primary hover:underline disabled:opacity-40 cursor-pointer">
              Allocate oldest first
            </button>
          </div>
          {!customerId ? (
            <p className="px-3 py-4 text-[12.5px] text-muted">Choose a customer to see their open invoices.</p>
          ) : openInvoices.length === 0 ? (
            <p className="px-3 py-4 text-[12.5px] text-muted">No open invoices. The whole amount will be kept as an advance.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="text-muted text-left">
                  <tr><th className="px-3 py-1.5 font-medium">Invoice</th><th className="px-3 py-1.5 font-medium">Due</th><th className="px-3 py-1.5 font-medium text-right">Outstanding</th><th className="px-3 py-1.5 font-medium text-right w-40">Allocate</th></tr>
                </thead>
                <tbody>
                  {openInvoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="px-3 py-1.5 font-mono">{inv.invoiceNumber}</td>
                      <td className={`px-3 py-1.5 ${inv.paymentStatus === 'Overdue' ? 'text-rose-600 font-medium' : ''}`}>{date(inv.dueDate)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{money(inv.outstandingAmount)}</td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number" min="0" step="0.01" aria-label={`Allocate to ${inv.invoiceNumber}`}
                          className={`${field} h-8 text-right font-mono ${num(alloc[inv.id]) > num(inv.outstandingAmount) + 0.005 ? 'border-rose-400' : ''}`}
                          value={alloc[inv.id] || ''}
                          onChange={(e) => setAlloc((a) => ({ ...a, [inv.id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <ErrorLine message={error} />
      </form>
    </Modal>
  );
}

// ── Payment terms / due date for one invoice ───────────────────────────────
export function PaymentTermsModal({ isOpen, onClose, invoice, onSaved, canEdit }) {
  const [options, setOptions] = useState([]);
  const [choice, setChoice] = useState('30 Days');
  const [customDays, setCustomDays] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !invoice) return;
    setError('');
    setReason('');
    receivablesService.getPaymentTermOptions().then((b) => {
      const opts = b?.options || [];
      setOptions(opts);
      const preset = opts.find((o) => o.label === invoice.paymentTerms);
      if (preset) { setChoice(preset.label); setCustomDays(''); }
      else { setChoice('Custom'); setCustomDays(String(invoice.creditDays ?? '')); }
    }).catch(() => setOptions([]));
    setDueDate(invoice.dueDate || '');
    receivablesService.getTermsHistory(invoice.id).then((b) => setHistory(b?.results || [])).catch(() => setHistory([]));
  }, [isOpen, invoice]);

  const days = choice === 'Custom' ? customDays : options.find((o) => o.label === choice)?.days;
  const computedDue = invoice && days !== '' && days != null ? addDays(invoice.invoiceDate, days) : '';
  useEffect(() => { if (computedDue) setDueDate(computedDue); }, [computedDue]);
  const overridden = dueDate && computedDue && dueDate !== computedDue;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (days === '' || days == null || Number(days) < 0) return setError('Enter the number of credit days.');
    if (!reason.trim()) return setError('Give a reason for this change.');
    setSaving(true);
    try {
      await receivablesService.changePaymentTerms(invoice.id, {
        paymentTerms: choice, creditDays: Number(days), dueDate: dueDate || undefined, reason: reason.trim(),
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(errorText(err, 'The terms could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  if (!invoice) return null;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={`Payment terms · ${invoice.invoiceNumber}`}
      subtitle={`${invoice.customerName} · invoice date ${date(invoice.invoiceDate)} · ${money(invoice.invoiceAmount)}`}
      footer={canEdit ? (
        <div className="flex justify-end gap-2 w-full">
          <button type="button" className={ghostBtn} onClick={onClose}>Cancel</button>
          <button type="submit" form="terms-form" className={primaryBtn} disabled={saving}>{saving ? 'Saving…' : 'Save terms'}</button>
        </div>
      ) : null}
    >
      <form id="terms-form" onSubmit={submit} className="space-y-4">
        {!canEdit && <p className="text-[12.5px] text-muted">You can view the terms. Changing them needs the “Change invoice payment terms” permission.</p>}
        <fieldset disabled={!canEdit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={label} htmlFor="pt-choice">Payment terms</label>
            <select id="pt-choice" className={field} value={choice} onChange={(e) => setChoice(e.target.value)}>
              {options.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="pt-days">Credit days</label>
            <input id="pt-days" type="number" min="0" className={field} value={choice === 'Custom' ? customDays : (days ?? '')} onChange={(e) => setCustomDays(e.target.value)} readOnly={choice !== 'Custom'} />
          </div>
          <div>
            <label className={label} htmlFor="pt-due">Due date</label>
            <input id="pt-due" type="date" min={invoice.invoiceDate} className={field} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="sm:col-span-3">
            <label className={label} htmlFor="pt-reason">Reason for the change *</label>
            <input id="pt-reason" className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Agreed 45 days with the buyer on 12 Oct" />
            {overridden && <p className="mt-1 text-[12px] text-amber-700">Due date differs from invoice date + credit days ({date(computedDue)}); it will be recorded as a manual override.</p>}
          </div>
        </fieldset>
        <ErrorLine message={error} />
        <div>
          <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">Change history</h4>
          {history.length === 0 ? (
            <p className="text-[12.5px] text-muted">No changes recorded.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border text-[12.5px]">
              {history.map((h) => (
                <li key={h.at} className="px-3 py-2">
                  <div className="flex justify-between gap-2"><span className="font-medium text-text">{h.actorName}</span><span className="text-muted">{new Date(h.at).toLocaleString()}</span></div>
                  <div className="text-muted">
                    {h.before?.paymentTerms || '—'} → {h.after?.paymentTerms} · due {date(h.before?.dueDate)} → {date(h.after?.dueDate)}{h.after?.dueDateOverridden ? ' (manual)' : ''}
                  </div>
                  <div className="text-text">{h.reason}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>
    </Modal>
  );
}

// ── New early-payment discount request ─────────────────────────────────────
export function DiscountRequestModal({ isOpen, onClose, invoice, onSaved }) {
  const [payments, setPayments] = useState([]);
  const [paymentId, setPaymentId] = useState('');
  const [form, setForm] = useState({ requestedAmount: '', customerRequestDate: today(), reason: '', notes: '', submit: true });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !invoice) return;
    setError('');
    setForm({ requestedAmount: '', customerRequestDate: today(), reason: '', notes: '', submit: true });
    receivablesService.getPayments({ customerId: invoice.customerId, page_size: 200, status: 'Active' }).then((b) => {
      const list = rows(b)
        .map((p) => ({ ...p, onInvoice: (p.allocations || []).filter((a) => a.documentId === invoice.id).reduce((s, a) => s + num(a.amount), 0) }))
        .filter((p) => p.onInvoice > 0);
      setPayments(list);
      setPaymentId(list[0]?.id || '');
    }).catch((err) => setError(errorText(err, 'Could not load receipts.')));
  }, [isOpen, invoice]);

  const payment = useMemo(() => payments.find((p) => p.id === paymentId), [payments, paymentId]);
  const early = payment && invoice?.dueDate ? daysBetween(payment.date, invoice.dueDate) : null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!payment) return setError('Choose the receipt the customer paid with.');
    if (num(form.requestedAmount) <= 0) return setError('Enter the discount the customer asked for.');
    if (!form.reason.trim()) return setError("Give the customer's reason.");
    setSaving(true);
    try {
      await receivablesService.createDiscountRequest({
        invoiceId: invoice.id, paymentId, requestedAmount: num(form.requestedAmount),
        customerRequestDate: form.customerRequestDate || undefined, reason: form.reason.trim(),
        notes: form.notes || undefined, submit: form.submit,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(errorText(err, 'The request could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  if (!invoice) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Early payment discount request"
      subtitle={`${invoice.invoiceNumber} · ${invoice.customerName}`}
      footer={(
        <div className="flex justify-end gap-2 w-full">
          <button type="button" className={ghostBtn} onClick={onClose}>Cancel</button>
          <button type="submit" form="discount-form" className={primaryBtn} disabled={saving || payments.length === 0}>
            {saving ? 'Saving…' : form.submit ? 'Submit for approval' : 'Save draft'}
          </button>
        </div>
      )}
    >
      <form id="discount-form" onSubmit={submit} className="space-y-4">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12.5px] rounded-lg border border-border bg-soft/50 p-3">
          <div><dt className="text-muted">Invoice date</dt><dd className="font-medium text-text">{date(invoice.invoiceDate)}</dd></div>
          <div><dt className="text-muted">Payment terms</dt><dd className="font-medium text-text">{invoice.paymentTerms || '—'}</dd></div>
          <div><dt className="text-muted">Due date</dt><dd className="font-medium text-text">{date(invoice.dueDate)}</dd></div>
          <div><dt className="text-muted">Invoice amount</dt><dd className="font-medium text-text font-mono">{money(invoice.invoiceAmount)}</dd></div>
        </dl>
        {payments.length === 0 ? (
          <p className="text-[12.5px] text-muted">No receipt is allocated to this invoice yet. Record and allocate the payment first.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={label} htmlFor="dr-payment">Receipt *</label>
              <select id="dr-payment" className={field} value={paymentId} onChange={(e) => setPaymentId(e.target.value)}>
                {payments.map((p) => <option key={p.id} value={p.id}>{p.paymentNumber} · {date(p.date)} · {money(p.onInvoice)} on this invoice</option>)}
              </select>
              {payment && (
                <p className={`mt-1 text-[12px] ${early > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {early > 0 ? `Paid ${early} day${early === 1 ? '' : 's'} before the due date.` : 'This receipt was not paid before the due date. The approver will see that.'}
                  {' '}Eligible amount {money(payment.onInvoice)}.
                </p>
              )}
            </div>
            <div>
              <label className={label} htmlFor="dr-amount">Discount requested (₹) *</label>
              <input id="dr-amount" type="number" min="0.01" step="0.01" className={`${field} font-mono`} value={form.requestedAmount} onChange={set('requestedAmount')} />
            </div>
            <div>
              <label className={label} htmlFor="dr-date">Customer's request date</label>
              <input id="dr-date" type="date" className={field} value={form.customerRequestDate} onChange={set('customerRequestDate')} />
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="dr-reason">Reason *</label>
              <input id="dr-reason" className={field} value={form.reason} onChange={set('reason')} placeholder="What the customer asked for and why" />
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="dr-notes">Supporting notes</label>
              <textarea id="dr-notes" rows={2} className={`${field} h-auto py-2`} value={form.notes} onChange={set('notes')} />
            </div>
            <label className="sm:col-span-2 inline-flex items-center gap-2 text-[12.5px] text-text">
              <input type="checkbox" checked={form.submit} onChange={set('submit')} />
              Submit for approval now (otherwise saved as a draft)
            </label>
          </div>
        )}
        <p className="text-[12px] text-muted">No discount is applied until an authorised approver approves it.</p>
        <ErrorLine message={error} />
      </form>
    </Modal>
  );
}
