import React, { useEffect, useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer';
import { receivablesService } from '../../../services/domainServices';
import { useAppStore } from '../../../stores/appStore';
import { STATUS_TONE, date, errorText, money, num, useCan } from './receivablesFormat';

const field = 'w-full h-9 rounded-lg border border-border bg-card px-2.5 text-[13px] text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
const btn = 'h-9 px-3 rounded-lg text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

const ACTION_LABELS = {
  discount_request_create: 'Request created',
  discount_request_update: 'Draft edited',
  discount_request_submit: 'Submitted',
  discount_request_review: 'Review started',
  discount_request_propose: 'Amount proposed',
  discount_request_approve: 'Approved',
  discount_request_reject: 'Rejected',
  discount_request_cancel: 'Cancelled',
};

function Row({ label, children }) {
  return (
    <div>
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="text-[13px] text-text font-medium">{children ?? '—'}</dd>
    </div>
  );
}

/** One request: details, the decision controls the viewer is allowed, and its audit trail. */
export function DiscountRequestDrawer({ requestId, onClose, onChanged }) {
  const can = useCan();
  const me = useAppStore((s) => s.currentUser);
  const [req, setReq] = useState(null);
  const [history, setHistory] = useState([]);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const loadHistory = (id) => receivablesService.getDiscountRequestHistory(id)
    .then((b) => setHistory(b?.results || []))
    .catch(() => setHistory([]));

  useEffect(() => {
    if (!requestId) { setReq(null); return; }
    setReq(null);
    setError('');
    setReason('');
    receivablesService.getDiscountRequest(requestId)
      .then((row) => {
        setReq(row);
        setAmount(String(num(row.proposedAmount ?? row.requestedAmount)));
      })
      .catch((err) => setError(errorText(err, 'Could not load the request.')));
    loadHistory(requestId);
  }, [requestId]);

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      const row = await fn();
      if (row?.id) {
        setReq(row);
        setAmount(String(num(row.proposedAmount ?? row.requestedAmount)));
      }
      setReason('');
      await loadHistory(requestId);
      onChanged?.();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy('');
    }
  };

  const isApprover = can('approve_payment_discount');
  const isMine = req && me && String(req.requestedById) === String(me.id);
  const selfBlocked = isMine && !(me?.is_superuser || me?.isSuperuser);
  const open = req && ['Submitted', 'Under Review'].includes(req.status);
  const needReason = () => {
    if (!reason.trim()) { setError('Record the reason for this decision.'); return true; }
    return false;
  };

  return (
    <Drawer
      isOpen={Boolean(requestId)}
      onClose={onClose}
      width={560}
      title={req ? `Discount request ${req.requestNumber}` : 'Discount request'}
      subtitle={req ? `${req.customerName} · ${req.invoiceNumber}` : ''}
    >
      {!req ? (
        <p className="p-4 text-[13px] text-muted">{error || 'Loading…'}</p>
      ) : (
        <div className="space-y-5 p-1">
          <div className="flex items-center gap-2">
            <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-md border ${STATUS_TONE[req.status] || ''}`}>{req.status}</span>
            {req.creditNoteNumber && <span className="text-[12px] text-muted">Credit note {req.creditNoteNumber}</span>}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Row label="Invoice">{req.invoiceNumber}</Row>
            <Row label="Invoice date">{date(req.invoiceDate)}</Row>
            <Row label="Invoice amount">{money(req.invoiceTotal)}</Row>
            <Row label="Payment terms">{req.paymentTerms}</Row>
            <Row label="Due date">{date(req.dueDate)}</Row>
            <Row label="Payment date">{date(req.paymentDate)}</Row>
            <Row label="Receipt">{req.paymentNumber}</Row>
            <Row label="Eligible amount">{money(req.eligibleAmount)}</Row>
            <Row label="Days paid early">
              <span className={req.daysPaidEarly > 0 ? 'text-emerald-700' : 'text-amber-700'}>
                {req.daysPaidEarly > 0 ? req.daysPaidEarly : `${req.daysPaidEarly} (not early)`}
              </span>
            </Row>
            <Row label="Outstanding now">{money(req.invoiceOutstanding)}</Row>
            <Row label="Discount requested">{money(req.requestedAmount)}</Row>
            <Row label="Proposed">{req.proposedAmount != null ? money(req.proposedAmount) : '—'}</Row>
            <Row label="Approved">{req.approvedAmount != null ? money(req.approvedAmount) : '—'}</Row>
            <Row label="Customer's request date">{date(req.customerRequestDate)}</Row>
            <Row label="Requested by">{req.requestedByName}</Row>
            <Row label="Decided by">{req.decidedByName ? `${req.decidedByName} · ${new Date(req.decidedAt).toLocaleString()}` : '—'}</Row>
          </dl>
          <div className="space-y-1 text-[13px]">
            <p><span className="text-muted">Reason: </span>{req.reason}</p>
            {req.notes && <p><span className="text-muted">Notes: </span>{req.notes}</p>}
            {req.decisionReason && <p><span className="text-muted">Decision: </span>{req.decisionReason}</p>}
            {req.cancellationReason && <p><span className="text-muted">Cancelled: </span>{req.cancellationReason}</p>}
          </div>

          {/* Actions */}
          <div className="rounded-lg border border-border p-3 space-y-3">
            {req.status === 'Draft' && (isMine || isApprover) && (
              <div className="flex flex-wrap gap-2">
                {isMine && (
                  <button type="button" className={`${btn} bg-primary text-white`} disabled={!!busy}
                    onClick={() => run('submit', () => receivablesService.submitDiscountRequest(req.id))}>
                    {busy === 'submit' ? 'Submitting…' : 'Submit for approval'}
                  </button>
                )}
              </div>
            )}

            {open && isApprover && selfBlocked && (
              <p className="text-[12.5px] text-amber-700">You raised this request, so another approver has to decide it.</p>
            )}

            {open && isApprover && !selfBlocked && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1" htmlFor="dd-amount">Discount amount (₹)</label>
                    <input id="dd-amount" type="number" min="0.01" step="0.01" className={`${field} font-mono`} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1" htmlFor="dd-reason">Reason / comments *</label>
                    <input id="dd-reason" className={field} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {req.status === 'Submitted' && (
                    <button type="button" className={`${btn} border border-border text-text hover:bg-soft`} disabled={!!busy}
                      onClick={() => run('review', () => receivablesService.reviewDiscountRequest(req.id, { comments: reason || undefined }))}>
                      Start review
                    </button>
                  )}
                  <button type="button" className={`${btn} border border-border text-text hover:bg-soft`} disabled={!!busy}
                    onClick={() => run('propose', () => receivablesService.proposeDiscount(req.id, { proposedAmount: num(amount), reason: reason || undefined }))}>
                    Save proposed amount
                  </button>
                  <button type="button" className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`} disabled={!!busy}
                    onClick={() => { if (!needReason()) run('approve', () => receivablesService.approveDiscountRequest(req.id, { approvedAmount: num(amount), reason: reason.trim() })); }}>
                    {busy === 'approve' ? 'Approving…' : `Approve ${money(amount)}`}
                  </button>
                  <button type="button" className={`${btn} bg-rose-600 text-white hover:bg-rose-700`} disabled={!!busy}
                    onClick={() => { if (!needReason()) run('reject', () => receivablesService.rejectDiscountRequest(req.id, { reason: reason.trim() })); }}>
                    Reject
                  </button>
                </div>
                <p className="text-[12px] text-muted">Approving posts a credit note to the customer ledger. The receipt itself is not changed.</p>
              </>
            )}

            {((['Draft', 'Submitted', 'Under Review'].includes(req.status) && (isMine || isApprover))
              || (req.status === 'Approved' && isApprover)) && (
              <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-border">
                {!(open && isApprover && !selfBlocked) && (
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1" htmlFor="dd-cancel">Reason *</label>
                    <input id="dd-cancel" className={field} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                )}
                <button type="button" className={`${btn} border border-rose-200 text-rose-700 hover:bg-rose-50`} disabled={!!busy}
                  onClick={() => { if (!needReason()) run('cancel', () => receivablesService.cancelDiscountRequest(req.id, { reason: reason.trim() })); }}>
                  {req.status === 'Approved' ? 'Reverse approved discount' : 'Cancel request'}
                </button>
              </div>
            )}

            {['Rejected', 'Cancelled'].includes(req.status) && <p className="text-[12.5px] text-muted">This request is closed.</p>}
            {!isApprover && open && <p className="text-[12.5px] text-muted">Waiting for an approver.</p>}
            {error && <p role="alert" className="text-[12.5px] text-rose-600">{error}</p>}
          </div>

          <div>
            <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">Audit trail</h4>
            <ol className="space-y-2">
              {history.map((h, i) => (
                <li key={`${h.at}-${i}`} className="text-[12.5px] border-l-2 border-border pl-3">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-text">{ACTION_LABELS[h.action] || h.action}</span>
                    <span className="text-muted">{new Date(h.at).toLocaleString()}</span>
                  </div>
                  <div className="text-muted">{h.actorName}{h.description ? ` · ${h.description}` : ''}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Drawer>
  );
}
