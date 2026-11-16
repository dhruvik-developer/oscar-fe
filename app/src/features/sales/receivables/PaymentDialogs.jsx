import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { partiesService, receivablesService } from '../../../services/domainServices';
import {
  PAYMENT_MODES, DISCOUNT_TYPES, addDays, date, daysBetween, errorText, money, newIdempotencyKey, num, today, useCan,
} from './receivablesFormat';
import { Percent, Check, AlertCircle, Trash2, Plus, Sparkles, ChevronDown } from 'lucide-react';

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

// ── Record a customer receipt, allocated across open invoices with integrated discounts ──
export function RecordPaymentModal({ isOpen, onClose, onSaved, presetCustomerId, presetInvoiceId }) {
  const can = useCan();
  const canGrantDiscount = can('approve_payment_discount');

  const [customers, setCustomers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [customerId, setCustomerId] = useState(presetCustomerId || '');
  const [openInvoices, setOpenInvoices] = useState([]);
  const [form, setForm] = useState({
    date: today(),
    amount: '',
    mode: 'Bank Transfer',
    bankAccountId: '',
    transactionReference: '',
    referenceNumber: '',
    notes: '',
  });
  const [alloc, setAlloc] = useState({});
  const [discounts, setDiscounts] = useState({}); // { [invoiceId]: { enabled: boolean, amount: string, type: string, reason: string } }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [idemKey, setIdemKey] = useState(newIdempotencyKey);

  useEffect(() => {
    if (!isOpen) return;
    setCustomerId(presetCustomerId || '');
    setForm({
      date: today(),
      amount: '',
      mode: 'Bank Transfer',
      bankAccountId: '',
      transactionReference: '',
      referenceNumber: '',
      notes: '',
    });
    setAlloc({});
    setDiscounts({});
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

  const totalDiscount = Object.entries(discounts).reduce((s, [, d]) => {
    return s + (d?.enabled ? num(d.amount) : 0);
  }, 0);

  const totalSettled = Math.round((allocated + totalDiscount) * 100) / 100;

  const totalCustomerOutstanding = openInvoices.reduce((s, inv) => s + num(inv.outstandingAmount), 0);
  const remainingCustomerOutstanding = Math.max(0, Math.round((totalCustomerOutstanding - totalSettled) * 100) / 100);

  const autoAllocate = () => {
    let left = amount;
    const next = {};
    [...openInvoices]
      .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
      .forEach((inv) => {
        if (left <= 0) return;
        const disc = discounts[inv.id]?.enabled ? num(discounts[inv.id]?.amount) : 0;
        const needed = Math.max(0, num(inv.outstandingAmount) - disc);
        const take = Math.min(left, needed);
        if (take > 0) next[inv.id] = String(Math.round(take * 100) / 100);
        left -= take;
      });
    setAlloc(next);
  };

  const toggleDiscount = (invId) => {
    setDiscounts((prev) => {
      const cur = prev[invId];
      if (cur?.enabled) {
        const next = { ...prev };
        delete next[invId];
        return next;
      }
      const inv = openInvoices.find((i) => i.id === invId);
      const isEarly = inv?.dueDate && daysBetween(form.date, inv.dueDate) > 0;
      const defaultType = isEarly ? 'Early Payment Discount' : 'Settlement Discount';
      return {
        ...prev,
        [invId]: {
          enabled: true,
          amount: '',
          type: defaultType,
          reason: isEarly ? `Paid before due date (${date(inv.dueDate)})` : 'Agreed settlement discount',
        },
      };
    });
  };

  const updateDiscount = (invId, fieldKey, val) => {
    setDiscounts((prev) => ({
      ...prev,
      [invId]: {
        ...prev[invId],
        [fieldKey]: val,
      },
    }));
  };

  const handleSettleRow = (inv) => {
    const disc = discounts[inv.id]?.enabled ? num(discounts[inv.id]?.amount) : 0;
    const needed = Math.max(0, Math.round((num(inv.outstandingAmount) - disc) * 100) / 100);
    setAlloc((prev) => ({ ...prev, [inv.id]: String(needed) }));
    const currentAllocOther = Object.entries(alloc)
      .filter(([id]) => id !== inv.id)
      .reduce((s, [, v]) => s + num(v), 0);
    const newTotal = currentAllocOther + needed;
    if (num(form.amount) < newTotal) {
      setForm((f) => ({ ...f, amount: String(newTotal) }));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!customerId) return setError('Choose the customer.');
    if (amount <= 0 && totalDiscount <= 0) return setError('Enter the amount received or grant an approved discount.');
    if (amount > 0 && form.mode !== 'Cash' && !form.bankAccountId) {
      return setError('Choose the bank account the money was received into.');
    }

    // Check individual invoice over-allocation
    for (const inv of openInvoices) {
      const c = num(alloc[inv.id]);
      const d = discounts[inv.id]?.enabled ? num(discounts[inv.id]?.amount) : 0;
      if (c + d > num(inv.outstandingAmount) + 0.005) {
        return setError(
          `Combined payment (${money(c)}) and discount (${money(d)}) for ${inv.invoiceNumber} exceeds its outstanding balance of ${money(inv.outstandingAmount)}.`
        );
      }
    }

    // Check cash allocations vs amount received
    if (unallocated < -0.005) {
      return setError('Cash allocations add up to more than the amount received.');
    }

    // Check discount fields & permissions
    const activeDiscounts = Object.entries(discounts).filter(([, d]) => d?.enabled && num(d?.amount) > 0);
    if (activeDiscounts.length > 0 && !canGrantDiscount) {
      return setError('You do not have permission to grant customer discounts (approve_payment_discount).');
    }

    for (const [invId, d] of activeDiscounts) {
      const inv = openInvoices.find((i) => i.id === invId);
      const invNum = inv?.invoiceNumber || 'invoice';
      if (!d.reason || !d.reason.trim()) {
        return setError(`Please provide a reason for the discount granted on ${invNum}.`);
      }
    }

    setSaving(true);
    try {
      const discountAllocations = activeDiscounts.map(([invoiceId, d]) => ({
        invoiceId,
        discountAmount: num(d.amount),
        discountType: d.type || 'Settlement Discount',
        discountReason: d.reason.trim(),
      }));

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
        discountAllocations: discountAllocations.length > 0 ? discountAllocations : undefined,
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
      size="3xl"
      title="Record Customer Payment & Settle Invoices"
      subtitle="Post bank/cash receipt and approved discounts directly to customer ledger and GL accounts."
      footer={(
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div className="text-[12px] text-muted flex flex-wrap items-center gap-2 sm:gap-3">
            <span>Allocated Cash: <strong className="font-mono text-text font-semibold">{money(allocated)}</strong></span>
            {totalDiscount > 0 && (
              <span>Discount: <strong className="font-mono text-amber-700 font-semibold">{money(totalDiscount)}</strong></span>
            )}
            <span>Total Settled: <strong className="font-mono text-emerald-700 font-bold">{money(totalSettled)}</strong></span>
            {unallocated > 0.005 && (
              <span className="text-indigo-600 font-medium">({money(unallocated)} as Advance)</span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className={ghostBtn} onClick={onClose}>Cancel</button>
            <button type="submit" form="record-payment-form" className={primaryBtn} disabled={saving}>
              {saving ? 'Saving…' : 'Save receipt'}
            </button>
          </div>
        </div>
      )}
    >
      <form id="record-payment-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="rp-customer">Customer *</label>
            <select
              id="rp-customer"
              className={field}
              value={customerId}
              onChange={(e) => { setCustomerId(e.target.value); setAlloc({}); setDiscounts({}); }}
            >
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
            <input id="rp-amount" type="number" min="0" step="0.01" className={`${field} font-mono`} value={form.amount} onChange={set('amount')} placeholder="0.00" required />
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
            <input id="rp-txn" className={`${field} font-mono`} value={form.transactionReference} onChange={set('transactionReference')} placeholder="e.g. UTR12984029" />
          </div>
          <div>
            <label className={label} htmlFor="rp-ref">Reference number</label>
            <input id="rp-ref" className={field} value={form.referenceNumber} onChange={set('referenceNumber')} placeholder="e.g. REC-0092" />
          </div>
          <div>
            <label className={label} htmlFor="rp-notes">Notes</label>
            <input id="rp-notes" className={field} value={form.notes} onChange={set('notes')} placeholder="Optional receipt notes" />
          </div>
        </div>

        <div className="rounded-xl border border-border overflow-hidden shadow-xs">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-slate-50/80">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-slate-800">Invoice Allocation & Settlement</span>
              {openInvoices.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                  {openInvoices.length} Open
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={autoAllocate}
              disabled={!amount || openInvoices.length === 0}
              className="text-[12px] font-semibold text-primary hover:underline disabled:opacity-40 cursor-pointer"
            >
              Allocate oldest first
            </button>
          </div>

          {!customerId ? (
            <p className="px-3 py-6 text-center text-[12.5px] text-muted">Choose a customer above to view their outstanding invoices.</p>
          ) : openInvoices.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12.5px] text-muted">No open invoices found. The received amount will be kept as customer advance.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="text-slate-600 bg-slate-50 border-b border-border text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Invoice</th>
                    <th className="px-3 py-2 font-semibold">Due Date</th>
                    <th className="px-3 py-2 font-semibold text-right">Outstanding</th>
                    <th className="px-3 py-2 font-semibold text-right w-36">Cash Allocated (₹)</th>
                    <th className="px-3 py-2 font-semibold text-right w-36">Discount Given (₹)</th>
                    <th className="px-3 py-2 font-semibold text-right">Remaining</th>
                    <th className="px-3 py-2 font-semibold text-center w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {openInvoices.map((inv) => {
                    const invOutstanding = num(inv.outstandingAmount);
                    const invCash = num(alloc[inv.id]);
                    const disc = discounts[inv.id];
                    const isDiscEnabled = Boolean(disc?.enabled);
                    const invDiscount = isDiscEnabled ? num(disc?.amount) : 0;
                    const invSettled = Math.round((invCash + invDiscount) * 100) / 100;
                    const invRemaining = Math.round((invOutstanding - invSettled) * 100) / 100;
                    const isOver = invRemaining < -0.005;
                    const isFullySettled = invSettled > 0 && Math.abs(invRemaining) <= 0.005;
                    const isEarly = inv.dueDate && daysBetween(form.date, inv.dueDate) > 0;

                    return (
                      <React.Fragment key={inv.id}>
                        <tr className={`transition-colors ${isOver ? 'bg-rose-50/60' : isFullySettled ? 'bg-emerald-50/30' : isDiscEnabled ? 'bg-amber-50/20' : 'hover:bg-slate-50/60'}`}>
                          <td className="px-3 py-2 font-mono">
                            <div className="font-semibold text-slate-800">{inv.invoiceNumber}</div>
                            <div className="text-[11px] text-muted">{date(inv.invoiceDate)}</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className={`text-[12px] ${inv.paymentStatus === 'Overdue' ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                              {date(inv.dueDate)}
                            </div>
                            {inv.paymentStatus === 'Overdue' && (
                              <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700">Overdue</span>
                            )}
                            {isEarly && (
                              <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-100 text-sky-700">Early</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-medium text-slate-900">
                            {money(inv.outstandingAmount)}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              aria-label={`Allocate cash to ${inv.invoiceNumber}`}
                              className={`${field} h-8 text-right font-mono font-semibold ${isOver ? 'border-rose-400 bg-rose-50/40 text-rose-700' : ''}`}
                              value={alloc[inv.id] || ''}
                              onChange={(e) => setAlloc((a) => ({ ...a, [inv.id]: e.target.value }))}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            {isDiscEnabled ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                aria-label={`Discount on ${inv.invoiceNumber}`}
                                className={`${field} h-8 text-right font-mono font-semibold text-amber-800 border-amber-300 bg-amber-50/30 ${isOver ? 'border-rose-400' : ''}`}
                                value={disc?.amount || ''}
                                onChange={(e) => updateDiscount(inv.id, 'amount', e.target.value)}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleDiscount(inv.id)}
                                disabled={!canGrantDiscount}
                                title={!canGrantDiscount ? "Granting discount requires approve_payment_discount permission" : "Add discount for this invoice"}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Percent size={11} /> + Discount
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {isOver ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title="Cash allocation + discount exceeds outstanding balance">
                                <AlertCircle size={11} /> -{money(Math.abs(invRemaining))}
                              </span>
                            ) : isFullySettled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check size={11} /> Settled
                              </span>
                            ) : (
                              <span className="text-slate-700 font-medium">{money(invRemaining)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleSettleRow(inv)}
                              className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                              title="Auto-allocate remaining balance to this invoice"
                            >
                              Settle
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Discount Configuration Sub-Row */}
                        {isDiscEnabled && (
                          <tr className="bg-amber-50/25 border-t border-dashed border-amber-200/90">
                            <td colSpan={7} className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-2.5 text-xs bg-white/80 p-2.5 rounded-lg border border-amber-200 shadow-2xs">
                                <span className="font-semibold text-amber-900 flex items-center gap-1 shrink-0">
                                  <Percent size={12} className="text-amber-600" />
                                  Discount for {inv.invoiceNumber}:
                                </span>

                                <div className="flex items-center gap-1">
                                  <label className="text-[11px] font-medium text-slate-600 shrink-0">Type:</label>
                                  <select
                                    className={`${field} h-7 text-xs w-44`}
                                    value={disc?.type || 'Settlement Discount'}
                                    onChange={(e) => updateDiscount(inv.id, 'type', e.target.value)}
                                  >
                                    {DISCOUNT_TYPES.map((t) => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="flex items-center gap-1 flex-1 min-w-[200px]">
                                  <label className="text-[11px] font-medium text-slate-600 shrink-0">Reason *:</label>
                                  <input
                                    type="text"
                                    placeholder="Reason for granting discount (required)..."
                                    className={`${field} h-7 text-xs flex-1`}
                                    value={disc?.reason || ''}
                                    onChange={(e) => updateDiscount(inv.id, 'reason', e.target.value)}
                                    required
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => toggleDiscount(inv.id)}
                                  className="text-[11px] text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 font-medium cursor-pointer shrink-0 ml-auto"
                                  title="Remove discount for this invoice"
                                >
                                  <Trash2 size={12} /> Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Live Multi-Invoice Settlement Summary Card */}
        {openInvoices.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-[11.5px] font-bold text-slate-700 uppercase tracking-wider">Settlement Summary</span>
              <span className="text-[11px] text-slate-500">
                Total Customer Outstanding: <strong className="font-mono text-slate-800">{money(totalCustomerOutstanding)}</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs pt-0.5">
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-[10.5px] text-slate-500 block">Total Cash Received</span>
                <span className="font-mono font-bold text-slate-900 text-[13px]">{money(amount)}</span>
                {unallocated > 0.005 ? (
                  <span className="text-[10px] text-indigo-600 block mt-0.5">+{money(unallocated)} as Advance</span>
                ) : (
                  <span className="text-[10px] text-slate-400 block mt-0.5">Debited to Bank/Cash</span>
                )}
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                <span className="text-[10.5px] text-slate-500 block">Cash Allocated</span>
                <span className="font-mono font-bold text-slate-900 text-[13px]">{money(allocated)}</span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">Allocated to Invoices</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-amber-200/80 bg-amber-50/20">
                <span className="text-[10.5px] text-amber-800 font-medium block">Total Discount Granted</span>
                <span className="font-mono font-bold text-amber-700 text-[13px]">{money(totalDiscount)}</span>
                <span className="text-[10px] text-amber-600 block mt-0.5">Credit Note Reduction</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-200/80 bg-emerald-50/20">
                <span className="text-[10.5px] text-emerald-800 font-medium block">Total Settled</span>
                <span className="font-mono font-bold text-emerald-700 text-[13px]">{money(totalSettled)}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Remaining O/S: {money(remainingCustomerOutstanding)}</span>
              </div>
            </div>
          </div>
        )}

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
        .filter((p) => p.onInvoice > 0 && invoice.dueDate && daysBetween(p.date, invoice.dueDate) > 0);
      setPayments(list);
      setPaymentId(list[0]?.id || '');
    }).catch((err) => setError(errorText(err, 'Could not load receipts.')));
  }, [isOpen, invoice]);

  const payment = useMemo(() => payments.find((p) => p.id === paymentId), [payments, paymentId]);
  const early = payment && invoice?.dueDate ? daysBetween(payment.date, invoice.dueDate) : 0;

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
      title="Payment discount request"
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
          <p className="text-[12.5px] text-muted">
            No receipt paid before the due date is available. The customer must pay earlier than {date(invoice.dueDate)} to qualify.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={label} htmlFor="dr-payment">Receipt *</label>
              <select id="dr-payment" className={field} value={paymentId} onChange={(e) => setPaymentId(e.target.value)}>
                {payments.map((p) => <option key={p.id} value={p.id}>{p.paymentNumber} · {date(p.date)} · {money(p.onInvoice)} on this invoice</option>)}
              </select>
              {payment && (
                <p className="mt-1 text-[12px] text-emerald-700">
                  Paid {early} day{early === 1 ? '' : 's'} before the due date.
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
