import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Play, Plus, Send } from 'lucide-react';
import { api } from '../../../services/api';
import { useERP } from '../../../context/ERPContext';
import { CreateProductionInstructionModal } from './CreateProductionInstructionModal';
import { RESOURCES } from '../../../services/backendSync';
import { CompletionVerificationInlineSlide } from '../../purchase/CompletionVerificationInlineSlide';
import { FinalJobWorkPoInlineSlide } from '../../purchase/FinalJobWorkPoInlineSlide';
import { AgencyBillMatchingInlineSlide } from '../../purchase/AgencyBillMatchingInlineSlide';

const rowsOf = (res) => (Array.isArray(res) ? res : res?.results || res?.data || []);
const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const money = (v) => `₹${n(v)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);

const Card = ({ children }) => (
  <div className="rounded-2xl border border-[#dce5f4] bg-white p-4 space-y-3 text-xs">{children}</div>
);
const Fact = ({ label, value, mono }) => (
  <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
    <span className="text-[11px] font-semibold text-slate-400 block">{label}</span>
    <span className={`font-bold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
  </div>
);
const Btn = ({ children, onClick, disabled, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-emerald-600 hover:bg-emerald-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
    rose: 'bg-rose-600 hover:bg-rose-700',
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-bold disabled:opacity-60 cursor-pointer ${tones[tone]}`}>
      {children}
    </button>
  );
};

/**
 * One stage of the client's External Agency Production flow (PDF section 05),
 * worked on inside the PMS project slide. Every action calls the existing
 * production / purchase endpoints, so records, permissions, audit, stock and
 * accounting stay exactly as in the Production and Purchase modules.
 */
export function InstructionStageWorkspace({ project, lifecycle, stageKey, onStageChange, onUpdated }) {
  const instructionId = lifecycle?.instructionId;
  const poId = lifecycle?.purchaseOrderId;
  const { purchaseOrders = [], updatePurchaseOrderStatus } = useERP();
  const [fetchedPo, setFetchedPo] = useState(null);
  const [showPiForm, setShowPiForm] = useState(false);
  // The PO in the ERP shape the Purchase screens use.
  const contextPo = poId ? purchaseOrders.find((x) => String(x.id) === String(poId)) : null;
  const po = contextPo || fetchedPo;
  useEffect(() => {
    if (!poId || contextPo) return;
    api.get(`/purchase/orders/${poId}/`)
      .then((row) => row && setFetchedPo(RESOURCES.purchaseOrders.fromApi(row)))
      .catch(() => {});
  }, [poId, contextPo]);
  const [pi, setPi] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!instructionId) return;
    const [inst, comp] = await Promise.all([
      api.get(`/production/instructions/${instructionId}/`).catch(() => null),
      api.get(`/production/instructions/${instructionId}/completion/`).catch(() => null),
    ]);
    setPi(inst);
    setCompletion(comp);
  }, [instructionId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
      onUpdated?.();
    } catch (err) {
      setError(err?.message || 'The action was not completed.');
    } finally {
      setBusy(false);
    }
  };
  const post = (path, body) => run(() => api.post(path, body || {}));
  const go = (key) => key && onStageChange?.(key);
  const stage = lifecycle?.stages?.find((s) => s.key === stageKey);

  const errorBox = error && (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{error}</div>
  );
  const poApproved = lifecycle?.stages?.[0]?.state === 'completed';

  // Stage 1 -- Purchase Order (Vendor A Production): same server transitions
  // as the Purchase screen (submit-for-approval / approve, approver rules).
  if (stageKey === 'purchase_order') {
    if (!poId) {
      return <Card><div className="text-slate-500">This production run was raised without a purchase order.</div></Card>;
    }
    if (!po) return <div className="text-xs text-slate-500 p-3">Loading purchase order…</div>;
    const line = (po.items || po.lineItems || [])[0] || {};
    return (
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Fact label="PO No." value={po.poNumber} mono />
          <Fact label="Vendor / Agency" value={po.vendor || po.partyName} />
          <Fact label="Fabric" value={line.name || line.description} />
          <Fact label="Status" value={po.status} />
          <Fact label="Quantity" value={`${n(line.qty)} m`} mono />
          <Fact label="Rate" value={money(line.rate)} mono />
          <Fact label="PO Value" value={money(po.amount || po.total)} mono />
          <Fact label="Expected" value={po.expectedDate} />
        </div>
        {errorBox}
        <div className="flex gap-2 items-center">
          {po.status === 'Draft' && (
            <Btn disabled={busy} onClick={() => run(() => updatePurchaseOrderStatus(po.id, 'Pending Approval'))}>
              <Send size={13} /> Submit for Approval
            </Btn>
          )}
          {po.status === 'Pending Approval' && (
            <Btn tone="green" disabled={busy} onClick={() => run(() => updatePurchaseOrderStatus(po.id, 'Approved'))}>
              <CheckCircle2 size={13} /> Approve PO
            </Btn>
          )}
          {poApproved && <Btn onClick={() => go('production_work_instruction')}>Next: Production Work Instruction</Btn>}
          <span className="text-slate-500">Approval follows the purchase rules (approver permission, no self-approval).</span>
        </div>
      </Card>
    );
  }

  // No instruction yet: it is raised from the approved PO.
  if (!instructionId) {
    if (stageKey !== 'production_work_instruction') {
      return <Card><div className="text-slate-500">Raise the Production Work Instruction first.</div></Card>;
    }
    return (
      <Card>
        {poApproved ? (
          <div className="flex items-center gap-2">
            <Btn tone="amber" onClick={() => setShowPiForm(true)}><Plus size={13} /> Create Production Work Instruction</Btn>
            <span className="text-slate-500">Raised from {lifecycle?.poNumber}; quantity, fabric and rate come from the PO.</span>
          </div>
        ) : (
          <div className="text-slate-500">Approve purchase order {lifecycle?.poNumber} first; the instruction is raised from the approved PO.</div>
        )}
        {showPiForm && (
          <CreateProductionInstructionModal
            project={project}
            po={po}
            onClose={() => setShowPiForm(false)}
            onCreated={() => { setShowPiForm(false); onUpdated?.(); }}
          />
        )}
      </Card>
    );
  }

  if (!pi) return <div className="text-xs text-slate-500 p-3">Loading production work instruction…</div>;
  const status = pi.status;
  // The purchase slides read the instruction in the PO-endpoint shape.
  const slideInstruction = {
    ...pi,
    instructionNumber: pi.instructionNumber,
    orderMeter: pi.orderMeter,
    agreed_job_rate: pi.agreedJobRate,
    agencyName: pi.agencyName,
    finalPoId: pi.finalPoId,
    finalPoNumber: pi.finalPoNumber,
    completion: completion ? { acceptedQty: completion.acceptedQty, totalProduced: completion.totalProduced } : undefined,
  };

  switch (stageKey) {
    case 'production_work_instruction':
      return (
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Fact label="Instruction No." value={pi.instructionNumber} mono />
            <Fact label="Date" value={pi.piDate} />
            <Fact label="Fabric / Process" value={[pi.fabric, pi.processType].filter(Boolean).join(' · ') || '—'} />
            <Fact label="Status" value={status} />
            <Fact label="Order Meter" value={`${n(pi.orderMeter)} m`} mono />
            <Fact label="Taka / Weight" value={`${pi.takaCount || 0} · ${n(pi.totalWeight)} kg`} mono />
            <Fact label="Agreed Rate" value={`${money(pi.agreedJobRate || pi.agreedRate)} / ${pi.rateUom || 'Meter'}`} mono />
            <Fact label="Expected" value={[pi.expectedStartDate, pi.expectedCompletionDate].filter(Boolean).join(' → ') || '—'} />
          </div>
          {pi.specialTerms && <div className="text-slate-600">Terms: {pi.specialTerms}</div>}
          {errorBox}
          <div className="flex gap-2">
            {status === 'Draft' && (
              <Btn tone="green" disabled={busy} onClick={() => post(`/production/instructions/${pi.id}/approve/`)}>
                <CheckCircle2 size={13} /> Approve Instruction
              </Btn>
            )}
            {status !== 'Draft' && <Btn onClick={() => go('external_agency_assignment')}>Next: Agency Assignment</Btn>}
          </div>
        </Card>
      );

    case 'external_agency_assignment':
      return (
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Fact label="External Agency" value={pi.agencyName} />
            <Fact label="Agency Code" value={pi.agencyCode} mono />
            <Fact label="Production Employee" value={pi.employeeName} />
            <Fact label="Supervisor / Approver" value={pi.supervisorName} />
          </div>
          {errorBox}
          <div className="flex gap-2">
            {status === 'Draft' && <span className="text-slate-500">Approve the instruction first, then start production.</span>}
            {['Approved', 'Not Started'].includes(status) && (
              <Btn tone="amber" disabled={busy} onClick={() => post(`/production/instructions/${pi.id}/start/`)}>
                <Play size={13} /> Start Production
              </Btn>
            )}
            {!['Draft', 'Approved', 'Not Started'].includes(status) && (
              <Btn onClick={() => go('daily_production_entry')}>Next: Daily Production Entry</Btn>
            )}
          </div>
        </Card>
      );

    case 'daily_production_entry':
      return <DailyEntries pi={pi} completion={completion} busy={busy} run={run} errorBox={errorBox} go={go} />;

    case 'production_completion':
      return (
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Fact label="Order" value={`${n(completion?.orderQty)} m`} mono />
            <Fact label="Produced" value={`${n(completion?.totalProduced)} m`} mono />
            <Fact label="Rejected / Reprocess" value={`${n(completion?.rejectedQty)} / ${n(completion?.reprocessQty)} m`} mono />
            <Fact label="Accepted" value={`${n(completion?.acceptedQty)} m`} mono />
            <Fact label="Shortage" value={`${n(completion?.shortageQty)} m`} mono />
          </div>
          {errorBox}
          <div className="flex gap-2">
            {stage?.state !== 'completed' && !['Draft'].includes(status) && (
              <Btn tone="green" disabled={busy} onClick={() => post(`/production/instructions/${pi.id}/complete/`)}>
                <CheckCircle2 size={13} /> Mark Production Complete
              </Btn>
            )}
            {stage?.state === 'completed' && <Btn onClick={() => go('final_quantity_verification')}>Next: Final Quantity Verification</Btn>}
          </div>
        </Card>
      );

    case 'final_quantity_verification':
      return (
        <CompletionVerificationInlineSlide
          po={null}
          instruction={slideInstruction}
          onClose={() => go('production_completion')}
          onPrevStep={() => go('production_completion')}
          onNextStep={(key) => go(key === 'final_job_work_po' ? 'final_job_work_po' : key)}
          onUpdated={() => { load(); onUpdated?.(); }}
        />
      );

    case 'final_job_work_po':
      return (
        <FinalJobWorkPoInlineSlide
          po={null}
          instruction={slideInstruction}
          onClose={() => go('final_quantity_verification')}
          onPrevStep={() => go('final_quantity_verification')}
          onNextStep={(key) => go(key)}
          onUpdated={() => { load(); onUpdated?.(); }}
        />
      );

    case 'agency_bill_match':
      return <AgencyMatch pi={pi} originalPo={po} slideInstruction={slideInstruction} go={go} onUpdated={() => { load(); onUpdated?.(); }} />;

    case 'approval_payable':
      return <ApprovalPayable lifecycle={lifecycle} stage={stage} busy={busy} run={run} errorBox={errorBox} />;

    default:
      return null;
  }
}

function DailyEntries({ pi, completion, busy, run, errorBox, go }) {
  const [form, setForm] = useState({ date: todayISO(), meters: '', reject: '', reprocess: '', remarks: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const locked = ['Draft', 'Verified', 'PO Pending', 'PO Created', 'Closed'].includes(pi.status);
  const rows = completion?.rows || [];

  const save = (status) => {
    const meters = Number(form.meters) || 0;
    const reject = Number(form.reject) || 0;
    const reprocess = Number(form.reprocess) || 0;
    return run(async () => {
      if (!(meters > 0)) throw new Error('Enter today’s produced meters.');
      await api.post('/production/daily-entries/', {
        instructionId: pi.id,
        entryDate: form.date,
        meters,
        rejectMeter: reject,
        reprocessMeter: reprocess,
        goodMeter: Math.max(0, meters - reject - reprocess),
        enteredByEmployeeId: pi.employeeId,
        remarks: form.remarks,
        status,
      });
      setForm((f) => ({ ...f, meters: '', reject: '', reprocess: '', remarks: '' }));
    });
  };
  const field = 'w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono';

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Fact label="Order" value={`${n(completion?.orderQty)} m`} mono />
        <Fact label="Cumulative" value={`${n(completion?.totalProduced)} m`} mono />
        <Fact label="Pending Balance" value={`${n(completion?.balanceQty)} m`} mono />
        <Fact label="Entered By" value={pi.employeeName} />
      </div>

      <div className="rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
            <tr>
              <th className="p-2">Date</th><th className="p-2 text-right">Produced</th><th className="p-2 text-right">Good</th>
              <th className="p-2 text-right">Reject</th><th className="p-2 text-right">Reprocess</th>
              <th className="p-2 text-right">Cumulative</th><th className="p-2 text-right">Balance</th>
              <th className="p-2">Remarks</th><th className="p-2">Status</th><th className="p-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr><td colSpan={10} className="p-3 text-center text-slate-400">No daily production recorded yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-2 font-mono">{r.date}</td>
                <td className="p-2 text-right font-mono">{n(r.produced)}</td>
                <td className="p-2 text-right font-mono">{n(r.accepted)}</td>
                <td className="p-2 text-right font-mono">{n(r.rejected)}</td>
                <td className="p-2 text-right font-mono">{n(r.reprocess)}</td>
                <td className="p-2 text-right font-mono">{n(r.cumulative)}</td>
                <td className="p-2 text-right font-mono">{n(r.balance)}</td>
                <td className="p-2">{r.remarks}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2 text-right">
                  {r.status === 'Draft' && (
                    <button type="button" disabled={busy} className="text-[11px] font-bold text-blue-600"
                      onClick={() => run(() => api.post(`/production/daily-entries/${r.id}/submit/`))}>
                      Submit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {locked ? (
        <div className="text-slate-500">
          {pi.status === 'Draft' ? 'Approve and start the instruction before recording production.' : 'Production is closed for entries.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
          <label><span className="block font-semibold text-slate-700 mb-1">Date</span><input type="date" value={form.date} max={todayISO()} onChange={set('date')} className={field} /></label>
          <label><span className="block font-semibold text-slate-700 mb-1">Produced (m)</span><input type="number" min="0" step="0.01" value={form.meters} onChange={set('meters')} className={field} /></label>
          <label><span className="block font-semibold text-slate-700 mb-1">Reject (m)</span><input type="number" min="0" step="0.01" value={form.reject} onChange={set('reject')} className={field} /></label>
          <label><span className="block font-semibold text-slate-700 mb-1">Reprocess (m)</span><input type="number" min="0" step="0.01" value={form.reprocess} onChange={set('reprocess')} className={field} /></label>
          <label className="col-span-2"><span className="block font-semibold text-slate-700 mb-1">Proof / Remarks</span><input value={form.remarks} onChange={set('remarks')} className="w-full border border-slate-300 rounded-lg p-2" /></label>
          <div className="col-span-full flex gap-2">
            <Btn tone="green" disabled={busy} onClick={() => save('Submitted')}><Plus size={13} /> Submit Entry</Btn>
            <Btn disabled={busy} onClick={() => save('Draft')}>Save Draft</Btn>
          </div>
        </div>
      )}
      {errorBox}
      {Number(completion?.totalProduced) > 0 && Number(completion?.balanceQty) <= 0 && (
        <Btn onClick={() => go('production_completion')}>Next: Production Completion</Btn>
      )}
    </Card>
  );
}

function AgencyMatch({ pi, originalPo, slideInstruction, go, onUpdated }) {
  const [finalPo, setFinalPo] = useState(null);
  useEffect(() => {
    if (!pi.finalPoId) return;
    api.get(`/purchase/orders/${pi.finalPoId}/`)
      .then((row) => row && setFinalPo(RESOURCES.purchaseOrders.fromApi(row)))
      .catch(() => {});
  }, [pi.finalPoId]);

  if (!pi.finalPoId) {
    return <Card><div className="text-slate-500">Generate and approve the Final Job Work PO first; the agency invoice is matched against it.</div></Card>;
  }
  if (!finalPo && !originalPo) return <div className="text-xs text-slate-500 p-3">Loading Final Job Work PO…</div>;
  return (
    <AgencyBillMatchingInlineSlide
      // Matched on the original PO when there is one: the server then joins
      // original PO + Final Job Work PO + vendor bill (three-way match).
      po={originalPo || finalPo}
      instruction={slideInstruction}
      onClose={() => go('final_job_work_po')}
      onPrevStep={(key) => go(key)}
      onNextStep={(key) => go(key === 'disbursement_payment' ? 'approval_payable' : key)}
      onBillMatched={onUpdated}
    />
  );
}

function ApprovalPayable({ lifecycle, stage, busy, run, errorBox }) {
  const [remarks, setRemarks] = useState('');
  const vendorBillId = lifecycle?.vendorBillId;
  const approval = stage?.approvalStatus;
  if (!vendorBillId) {
    return <Card><div className="text-slate-500">Record and match the agency invoice first.</div></Card>;
  }
  const pending = ['Pending', 'Pending Approval'].includes(approval);
  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Fact label="Agency Invoice Approval" value={approval} />
        <Fact label="Payable (Purchase Bill)" value={stage?.docNumber} mono />
        <Fact label="Payable Status" value={stage?.payableStatus} />
        <Fact label="Amount / Balance" value={stage?.amount != null ? `${money(stage.amount)} / ${money(stage.balanceDue)}` : '—'} mono />
      </div>
      {(stage?.payments || []).length > 0 && (
        <div className="rounded-xl border border-slate-200 p-2.5 space-y-1">
          {stage.payments.map((p) => (
            <div key={p.id} className="flex justify-between text-slate-600">
              <span className="font-mono">{p.paymentNumber}</span><span>{p.date} · {p.mode}</span><span className="font-mono font-bold">{money(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
      {pending && (
        <>
          <label className="block">
            <span className="block font-semibold text-slate-700 mb-1">Approval remarks (required when the match has a variance)</span>
            <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2" />
          </label>
          <div className="flex gap-2">
            <Btn tone="green" disabled={busy}
              onClick={() => run(() => api.post(`/purchase/vendor-bills/${vendorBillId}/approve/`, { remarks, createPayable: true }))}>
              <Send size={13} /> Approve & Create Payable
            </Btn>
            <Btn tone="rose" disabled={busy}
              onClick={() => run(() => api.post(`/purchase/vendor-bills/${vendorBillId}/reject/`, { remarks }))}>
              Reject
            </Btn>
          </div>
        </>
      )}
      <div className="text-slate-500">Payment against the payable is recorded in Accounts (Payment Out).</div>
      {errorBox}
    </Card>
  );
}

export default InstructionStageWorkspace;
