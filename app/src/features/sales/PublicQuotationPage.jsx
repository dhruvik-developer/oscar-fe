import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { acceptQuotation, publicQuoteRequest, rejectQuotation } from '../../services/quotationSharing';
import { QuotationDocument } from '../../components/common/QuotationDocument';
import { Button } from '../../components/ui/Button';

export default function PublicQuotationPage() {
  const { quotationNumber, secureToken } = useParams();
  const [searchParams] = useSearchParams();
  const decisionHint = searchParams.get('decision');
  const responseRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [decisionDone, setDecisionDone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [reason, setReason] = useState('');
  const tracked = useRef('');
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    setDecisionDone('');
    setDecisionError('');
    publicQuoteRequest(quotationNumber, secureToken).then(async result => {
      if (!active) return;
      setData(result);
      const key = `${quotationNumber}/${secureToken}`;
      if (tracked.current !== key) {
        tracked.current = key;
        try { await publicQuoteRequest(quotationNumber, secureToken, 'view'); }
        catch { tracked.current = ''; }
      }
    }).catch(() => { if (active) setError('This quotation link is invalid or has expired. Please contact the sender.'); });
    return () => { active = false; };
  }, [quotationNumber, secureToken]);

  // Email Accept/Reject buttons land here with ?decision= — bring the
  // response section into view so the customer can confirm in one click.
  useEffect(() => {
    if (data && (decisionHint === 'accept' || decisionHint === 'reject')) {
      responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [data, decisionHint]);

  async function decide(accepted) {
    setDecisionError('');
    setDeciding(true);
    try {
      const payload = {};
      if (customerName.trim()) payload.name = customerName.trim();
      if (reason.trim()) payload.reason = reason.trim();
      const result = accepted
        ? await acceptQuotation(quotationNumber, secureToken, payload)
        : await rejectQuotation(quotationNumber, secureToken, payload);
      const status = result?.status || (accepted ? 'Accepted' : 'Rejected');
      setDecisionDone(
        status === 'Accepted'
          ? 'Thank you — this quotation is accepted. The supplier has been notified.'
          : 'This quotation has been rejected. The supplier has been notified.',
      );
      // Re-read so the page reflects the final status (buttons hide).
      try {
        const fresh = await publicQuoteRequest(quotationNumber, secureToken);
        setData(fresh);
      } catch { /* the decision itself already succeeded */ }
    } catch (err) {
      setDecisionError(err?.message || 'Your response could not be recorded. Please try again.');
    } finally {
      setDeciding(false);
    }
  }

  const canDecide = Boolean(data?.canDecide) && !decisionDone;
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8 print:bg-white print:p-0"><meta name="referrer" content="no-referrer"/><meta name="robots" content="noindex,nofollow"/>
    <div className="max-w-4xl mx-auto mb-5 no-print flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-4"><div><p className="text-blue-600 font-bold">EVENMORE ERP</p><h1 className="text-xl font-bold text-slate-800 mt-1">Your quotation</h1><p className="text-sm text-slate-500 mt-1">Review your products, pricing and terms below.</p></div><span className="rounded-full border border-blue-200 bg-blue-50 text-blue-700 px-3 py-2 text-xs">Shared quotation</span></div>
    <div className="max-w-4xl mx-auto bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      {error && <p role="alert" className="p-8">{error}</p>}
      {!data && !error && <p className="p-8">Loading quotation…</p>}
      {data && <><QuotationDocument quotation={data.quotation}/>{data.allowDownload && <div className="no-print p-6 flex gap-4 items-center"><Button onClick={async () => { try { await publicQuoteRequest(quotationNumber, secureToken, 'download'); window.print(); } catch { setError('This quotation link is invalid or has expired. Please contact the sender.'); } }}>Download PDF</Button><span className="text-xs">Choose Save as PDF in the print dialog.</span></div>}</>}
    </div>
    {data && !error && (
      <div ref={responseRef} className="max-w-4xl mx-auto mt-4 no-print rounded-xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
        <h2 className="text-sm font-bold text-slate-900">Your response</h2>
        <p className="text-xs text-slate-500 mt-1">Accept or reject this quotation online — the supplier is notified immediately.</p>
        {decisionHint === 'accept' && canDecide && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800">You chose Accept — press “Accept quotation” below to confirm.</p>
        )}
        {decisionHint === 'reject' && canDecide && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-800">You chose Reject — press “Reject” below to confirm.</p>
        )}
        {decisionDone && (
          <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800">{decisionDone}</p>
        )}
        {!decisionDone && !canDecide && (
          <p className="mt-3 text-xs text-slate-500">A decision has already been recorded for this quotation — no further action is needed.</p>
        )}
        {canDecide && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Your name (optional)</span>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1">Message for the supplier (optional)</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Approved — please proceed"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </label>
            </div>
            {decisionError && <p role="alert" className="text-xs font-semibold text-rose-600">{decisionError}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={deciding}
                onClick={() => decide(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
              >
                {deciding ? 'Sending…' : 'Accept quotation'}
              </button>
              <button
                type="button"
                disabled={deciding}
                onClick={() => decide(false)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold rounded-lg border border-rose-300 disabled:opacity-50"
              >
                {deciding ? 'Sending…' : 'Reject'}
              </button>
            </div>
          </div>
        )}
      </div>
    )}
  </main>;
}
