// Production Lifecycle (Vendor A Production PO, 8 stages).
//
// The backend derives every stage from the saved records
// (apps/pms/lifecycle_services.py). The Purchase PO screen and the PMS project
// view both render it through these helpers, so they always agree.
import { api } from '../../services/api';

export const PRODUCTION_LIFECYCLE_STAGE_KEYS = [
  'purchase_order',
  'production_instruction',
  'daily_production_entry',
  'grey_fabric_qc',
  'completion_verification',
  'final_job_work_po',
  'agency_bill_match',
  'disbursement_payment',
];

export const getPoProductionLifecycle = (poId) =>
  api.get(`/purchase/orders/${poId}/production-lifecycle/`);

export const getProjectProductionLifecycle = (projectId) =>
  api.get(`/pms/projects/${projectId}/production-lifecycle/`);

/** Existing record / workspace for a stage: the PO screen opened on that stage. */
export const lifecycleStageRoute = (lifecycle, stageKey) =>
  `/purchase/orders?po=${encodeURIComponent(lifecycle.purchaseOrderId)}&stage=${encodeURIComponent(stageKey)}`;

const STATE_TO_TIMELINE = { completed: 'completed', active: 'current', pending: 'pending' };

const formatDate = (iso) => {
  if (!iso) return undefined;
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : undefined;
};

/** Backend lifecycle -> DocumentTimeline steps. */
export const lifecycleToTimelineSteps = (lifecycle, { activeKey } = {}) => {
  const stages = lifecycle?.stages || [];
  const lastCompletedIdx = stages.reduce(
    (max, s, i) =>
      s.state === 'completed' || ['Approved', 'Verified', 'Completed', 'Paid'].includes(s.status)
        ? i
        : max,
    -1
  );

  return stages.map((stage, idx) => {
    const isCompleted =
      stage.state === 'completed' ||
      (lastCompletedIdx >= 0 && idx <= lastCompletedIdx && stage.state !== 'pending') ||
      ['Approved', 'Verified', 'Completed', 'Paid'].includes(stage.status);

    return {
      key: stage.key,
      label: stage.label,
      docNumber: stage.docNumber || undefined,
      date: formatDate(stage.date),
      amount: stage.amount ?? undefined,
      status: isCompleted ? 'completed' : (STATE_TO_TIMELINE[stage.state] || 'pending'),
      statusLabel: stage.blocked ? stage.status : (stage.state === 'pending' ? undefined : stage.status || undefined),
      highlightCard: Boolean(activeKey) && activeKey === stage.key && !isCompleted,
    };
  });
};

const fmtQty = (v) => (v === null || v === undefined ? null : `${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })} m`);
const fmtAmt = (v) => (v === null || v === undefined ? null : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);

/** One-line detail per stage (quantities / amounts / payment) for tables. */
export const lifecycleStageDetail = (stage) => {
  switch (stage.key) {
    case 'purchase_order':
      return [fmtQty(stage.quantity), stage.party].filter(Boolean).join(' · ');
    case 'production_instruction':
      return [fmtQty(stage.quantity), stage.party, stage.employee].filter(Boolean).join(' · ');
    case 'daily_production_entry':
      if (!stage.entryCount) return '';
      return [
        `Produced ${fmtQty(stage.quantity)}`,
        stage.orderQuantity != null ? `of ${fmtQty(stage.orderQuantity)}` : null,
        stage.balanceQuantity != null ? `balance ${fmtQty(stage.balanceQuantity)}` : null,
        stage.draftEntryCount ? `${stage.draftEntryCount} draft` : null,
      ].filter(Boolean).join(' · ');
    case 'grey_fabric_qc':
      if (!stage.inspectionCount) return '';
      return `Inspected ${fmtQty(stage.quantity)} · passed ${fmtQty(stage.passedQuantity)} · pending ${fmtQty(stage.pendingQuantity)}`;
    case 'completion_verification':
      return [stage.quantity != null ? `Verified ${fmtQty(stage.quantity)}` : null, stage.verifiedBy].filter(Boolean).join(' · ');
    case 'final_job_work_po':
      return [fmtQty(stage.quantity), stage.party].filter(Boolean).join(' · ');
    case 'agency_bill_match':
      return [stage.matchResult ? `3-way: ${stage.matchResult}` : null, stage.matchStatus].filter(Boolean).join(' · ');
    // Client PDF section 05 stages (PMS project view).
    case 'production_work_instruction':
      return [fmtQty(stage.quantity), stage.fabric, stage.processType, stage.rate ? `${fmtAmt(stage.rate)}/m` : null].filter(Boolean).join(' · ');
    case 'external_agency_assignment':
      return [stage.party, stage.employee, stage.supervisor ? `Supervisor: ${stage.supervisor}` : null].filter(Boolean).join(' · ');
    case 'production_completion':
      if (!stage.quantity) return '';
      return `Produced ${fmtQty(stage.quantity)} · accepted ${fmtQty(stage.acceptedQuantity)} · rejected ${fmtQty(stage.rejectedQuantity)} · shortage ${fmtQty(stage.shortageQuantity)}`;
    case 'final_quantity_verification':
      return [stage.quantity != null ? `Verified ${fmtQty(stage.quantity)}` : null, stage.verifiedBy].filter(Boolean).join(' · ');
    case 'approval_payable':
    case 'disbursement_payment':
      return [
        stage.approvalStatus ? `Approval: ${stage.approvalStatus}` : null,
        stage.payableStatus ? `Payable: ${stage.payableStatus}` : null,
        stage.payableStatus ? `Paid ${fmtAmt(stage.amountPaid)}` : null,
        stage.balanceDue != null ? `Balance ${fmtAmt(stage.balanceDue)}` : null,
      ].filter(Boolean).join(' · ');
    default:
      return '';
  }
};
