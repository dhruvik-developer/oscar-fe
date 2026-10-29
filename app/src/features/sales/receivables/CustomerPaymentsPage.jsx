import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, BadgePercent, CalendarClock, CheckCircle2, Clock, IndianRupee, Plus, RefreshCw, Wallet,
} from 'lucide-react';
import KpiCard from '../../../components/ui/KpiCard';
import { PageHeader } from '../../../components/ui/PageHeader';
import { partiesService, receivablesService } from '../../../services/domainServices';
import { DiscountRequestDrawer } from './DiscountRequestDrawer';
import { DiscountRequestModal, PaymentTermsModal, RecordPaymentModal } from './PaymentDialogs';
import {
  DISCOUNT_STATUSES, INVOICE_STATUSES, STATUS_TONE, date, errorText, money, num, useCan,
} from './receivablesFormat';

const PAGE_SIZE = 25;
const input = 'h-9 rounded-lg border border-border bg-card px-2.5 text-[13px] text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
const linkBtn = 'text-[12.5px] font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer';

function rowsOf(body) {
  return Array.isArray(body) ? body : body?.results || [];
}

function Status({ value }) {
  return <span className={`inline-block whitespace-nowrap text-[11.5px] font-semibold px-2 py-0.5 rounded-md border ${STATUS_TONE[value] || 'border-border'}`}>{value}</span>;
}

function Pager({ page, count, onPage }) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-border text-[12.5px] text-muted">
      <span>{count} record{count === 1 ? '' : 's'}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={linkBtn} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button type="button" className={linkBtn} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

function Filters({ filters, setFilters, customers, statuses, statusLabel, searchPlaceholder }) {
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value, page: 1 }));
  return (
    <div className="flex flex-wrap items-end gap-2 px-3 py-3 border-b border-border">
      <input aria-label="Search" placeholder={searchPlaceholder} className={`${input} w-56`} value={filters.search} onChange={set('search')} />
      <select aria-label="Customer" className={`${input} w-48`} value={filters.customerId} onChange={set('customerId')}>
        <option value="">All customers</option>
        {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select aria-label={statusLabel} className={`${input} w-40`} value={filters.status} onChange={set('status')}>
        <option value="">All statuses</option>
        {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <label className="text-[12px] text-muted flex items-center gap-1">From <input type="date" className={input} value={filters.from} onChange={set('from')} /></label>
      <label className="text-[12px] text-muted flex items-center gap-1">To <input type="date" className={input} value={filters.to} onChange={set('to')} /></label>
    </div>
  );
}

const EMPTY_FILTERS = { search: '', customerId: '', status: '', from: '', to: '', page: 1 };

export default function CustomerPaymentsPage() {
  const can = useCan();
  const [tab, setTab] = useState('invoices');
  const [customers, setCustomers] = useState([]);
  const [invFilters, setInvFilters] = useState(EMPTY_FILTERS);
  const [reqFilters, setReqFilters] = useState(EMPTY_FILTERS);
  const [receivables, setReceivables] = useState({ results: [], count: 0, aggregates: {} });
  const [requests, setRequests] = useState({ results: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [payFor, setPayFor] = useState(null);       // { customerId, invoiceId } | {} for blank
  const [termsFor, setTermsFor] = useState(null);   // invoice row
  const [discountFor, setDiscountFor] = useState(null);
  const [openRequestId, setOpenRequestId] = useState(null);

  useEffect(() => {
    partiesService.getCustomers({ page_size: 200 }).then((b) => setCustomers(rowsOf(b))).catch(() => setCustomers([]));
  }, []);

  const loadReceivables = useCallback(() => {
    setLoading(true);
    setError('');
    return receivablesService.getReceivables({
      search: invFilters.search || undefined,
      customerId: invFilters.customerId || undefined,
      status: invFilters.status || undefined,
      date_from: invFilters.from || undefined,
      date_to: invFilters.to || undefined,
      page: invFilters.page,
      page_size: PAGE_SIZE,
    })
      .then((b) => setReceivables({ results: rowsOf(b), count: b?.count || 0, aggregates: b?.aggregates || {} }))
      .catch((err) => setError(errorText(err, 'Could not load receivables.')))
      .finally(() => setLoading(false));
  }, [invFilters]);

  const loadRequests = useCallback(() => receivablesService.getDiscountRequests({
    search: reqFilters.search || undefined,
    customerId: reqFilters.customerId || undefined,
    status: reqFilters.status || undefined,
    date_from: reqFilters.from || undefined,
    date_to: reqFilters.to || undefined,
    page: reqFilters.page,
    page_size: PAGE_SIZE,
  })
    .then((b) => setRequests({ results: rowsOf(b), count: b?.count || 0 }))
    .catch((err) => setError(errorText(err, 'Could not load discount requests.'))), [reqFilters]);

  useEffect(() => { loadReceivables(); }, [loadReceivables]);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  const refreshAll = () => { loadReceivables(); loadRequests(); };
  const k = receivables.aggregates;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customer Payments & Discounts"
        subtitle="Payment terms, receipts, outstanding balances and early-payment discount approvals."
        actions={(
          <div className="flex gap-2">
            <button type="button" onClick={refreshAll} className="h-9 px-3 rounded-lg border border-border text-[13px] font-medium text-text hover:bg-soft inline-flex items-center gap-1.5 cursor-pointer">
              <RefreshCw size={14} /> Refresh
            </button>
            {can('record_payment_in') && (
              <button type="button" onClick={() => setPayFor({})} className="h-9 px-3 rounded-lg bg-primary text-white text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                <Plus size={14} /> Record payment
              </button>
            )}
          </div>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Total outstanding" value={money(k.totalOutstanding)} icon={Wallet} tone="blue" />
        <KpiCard label="Due payments" value={money(k.dueAmount)} sub={`${k.dueCount || 0} invoice(s) not yet due`} icon={Clock} tone="amber" />
        <KpiCard label="Overdue payments" value={money(k.overdueAmount)} sub={`${k.overdueCount || 0} invoice(s)`} icon={AlertTriangle} tone="rose" onClick={() => { setTab('invoices'); setInvFilters({ ...EMPTY_FILTERS, status: 'Overdue' }); }} />
        <KpiCard label="Received payments" value={money(k.receivedAmount)} sub={`${k.receivedCount || 0} receipt(s)`} icon={IndianRupee} tone="emerald" />
        <KpiCard label="Pending discount requests" value={String(k.pendingDiscountCount || 0)} sub={`${money(k.pendingDiscountAmount)} requested`} icon={BadgePercent} tone="indigo" onClick={() => { setTab('discounts'); setReqFilters({ ...EMPTY_FILTERS, status: 'Submitted' }); }} />
        <KpiCard label="Approved discounts" value={money(k.approvedDiscountAmount)} sub={`${k.approvedDiscountCount || 0} approved`} icon={CheckCircle2} tone="teal" />
      </div>

      {error && <p role="alert" className="text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

      <section className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div role="tablist" aria-label="View" className="flex gap-1 px-3 border-b border-border">
          {[['invoices', 'Invoices & payments'], ['discounts', 'Early payment discount requests']].map(([id, text]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`-mb-px px-3 py-2.5 text-[13px] border-b-2 cursor-pointer ${tab === id ? 'border-primary text-text font-semibold' : 'border-transparent text-muted hover:text-text font-medium'}`}>
              {text}
            </button>
          ))}
        </div>

        {tab === 'invoices' ? (
          <>
            <Filters filters={invFilters} setFilters={setInvFilters} customers={customers} statuses={INVOICE_STATUSES}
              statusLabel="Payment status" searchPlaceholder="Invoice no. or customer" />
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="text-left text-muted bg-soft/50">
                  <tr>
                    {['Customer', 'Invoice no.', 'Invoice date', 'Due date', 'Terms', 'Invoice amount', 'Paid', 'Approved discount', 'Outstanding', 'Status', ''].map((h, i) => (
                      <th key={h || i} className={`px-3 py-2 font-medium whitespace-nowrap ${i >= 5 && i <= 8 ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && receivables.results.length === 0 ? (
                    <tr><td colSpan={11} className="px-3 py-8 text-center text-muted">Loading…</td></tr>
                  ) : receivables.results.length === 0 ? (
                    <tr><td colSpan={11} className="px-3 py-8 text-center text-muted">No finalized invoices match these filters.</td></tr>
                  ) : receivables.results.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-soft/40">
                      <td className="px-3 py-2 font-medium text-text">{r.customerName}</td>
                      <td className="px-3 py-2 font-mono">{r.invoiceNumber}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{date(r.invoiceDate)}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${r.daysOverdue > 0 ? 'text-rose-600 font-medium' : ''}`}>
                        {date(r.dueDate)}{r.daysOverdue > 0 ? ` · ${r.daysOverdue}d late` : ''}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.paymentTerms || (r.creditDays != null ? `${r.creditDays} days` : '—')}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(r.invoiceAmount)}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(r.paidAmount)}</td>
                      <td className="px-3 py-2 text-right font-mono">{num(r.approvedDiscount) > 0 ? money(r.approvedDiscount) : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-text">
                        {money(r.outstandingAmount)}
                        {num(r.customerCredit) > 0 && <div className="text-[11px] font-normal text-emerald-700">Credit {money(r.customerCredit)}</div>}
                      </td>
                      <td className="px-3 py-2"><Status value={r.paymentStatus} /></td>
                      <td className="px-3 py-2">
                        <div className="flex gap-3 justify-end whitespace-nowrap">
                          {can('record_payment_in') && num(r.outstandingAmount) > 0 && (
                            <button type="button" className={linkBtn} onClick={() => setPayFor({ customerId: r.customerId, invoiceId: r.id })}>Record payment</button>
                          )}
                          <button type="button" className={linkBtn} onClick={() => setTermsFor(r)}>Terms</button>
                          {can('request_payment_discount') && num(r.paidAmount) > 0 && (
                            <button type="button" className={linkBtn} onClick={() => setDiscountFor(r)}>
                              Request discount{r.openDiscountRequests ? ` (${r.openDiscountRequests} open)` : ''}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={invFilters.page} count={receivables.count} onPage={(page) => setInvFilters((f) => ({ ...f, page }))} />
          </>
        ) : (
          <>
            <Filters filters={reqFilters} setFilters={setReqFilters} customers={customers} statuses={DISCOUNT_STATUSES}
              statusLabel="Request status" searchPlaceholder="Request, invoice no. or customer" />
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="text-left text-muted bg-soft/50">
                  <tr>
                    {['Request no.', 'Customer', 'Invoice no.', 'Payment date', 'Due date', 'Days early', 'Requested', 'Approved', 'Status', ''].map((h, i) => (
                      <th key={h || i} className={`px-3 py-2 font-medium whitespace-nowrap ${[5, 6, 7].includes(i) ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.results.length === 0 ? (
                    <tr><td colSpan={10} className="px-3 py-8 text-center text-muted">No discount requests match these filters.</td></tr>
                  ) : requests.results.map((q) => (
                    <tr key={q.id} className="border-t border-border hover:bg-soft/40">
                      <td className="px-3 py-2 font-mono">{q.requestNumber}</td>
                      <td className="px-3 py-2 font-medium text-text">{q.customerName}</td>
                      <td className="px-3 py-2 font-mono">{q.invoiceNumber}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{date(q.paymentDate)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{date(q.dueDate)}</td>
                      <td className={`px-3 py-2 text-right ${q.daysPaidEarly > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{q.daysPaidEarly}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(q.requestedAmount)}</td>
                      <td className="px-3 py-2 text-right font-mono">{q.approvedAmount != null ? money(q.approvedAmount) : '—'}</td>
                      <td className="px-3 py-2"><Status value={q.status} /></td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" className={linkBtn} onClick={() => setOpenRequestId(q.id)}>
                          {['Submitted', 'Under Review'].includes(q.status) && can('approve_payment_discount') ? 'Review' : 'Open'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={reqFilters.page} count={requests.count} onPage={(page) => setReqFilters((f) => ({ ...f, page }))} />
          </>
        )}
      </section>

      <p className="flex items-center gap-1.5 text-[12px] text-muted">
        <CalendarClock size={13} /> Outstanding = invoice amount − money received − approved discounts. Discounts are posted as credit notes; receipts are never changed.
      </p>

      <RecordPaymentModal
        isOpen={Boolean(payFor)}
        onClose={() => setPayFor(null)}
        presetCustomerId={payFor?.customerId}
        presetInvoiceId={payFor?.invoiceId}
        onSaved={refreshAll}
      />
      <PaymentTermsModal
        isOpen={Boolean(termsFor)}
        onClose={() => setTermsFor(null)}
        invoice={termsFor}
        canEdit={can('edit_payment_terms')}
        onSaved={refreshAll}
      />
      <DiscountRequestModal
        isOpen={Boolean(discountFor)}
        onClose={() => setDiscountFor(null)}
        invoice={discountFor}
        onSaved={() => { refreshAll(); setTab('discounts'); }}
      />
      <DiscountRequestDrawer requestId={openRequestId} onClose={() => setOpenRequestId(null)} onChanged={refreshAll} />
    </div>
  );
}
