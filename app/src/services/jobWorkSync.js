/**
 * jobWorkSync — backend API layer for Job Work.
 *
 * The server is the source of truth: nothing here caches business records
 * in the browser. Every call throws on failure so the page can show the
 * error and keep the unsaved record off screen.
 *
 * Child rows of a Job Work Order (materials / outwards / inwards / charges /
 * reprocesses / documents) and of a Process Plan (charges) are written one
 * at a time through their per-row endpoints. A header PATCH never carries
 * child rows. Document numbers (JWO, outward, inward, reprocess) are
 * allocated by the server.
 */
import { api } from './api';
import { getStoredToken } from '../utils/authUtils';

export function isJobWorkBackendEnabled() {
  try {
    return Boolean(getStoredToken());
  } catch {
    return false;
  }
}

const PAGE_SIZE = 200;

function rowsFrom(body) {
  if (Array.isArray(body)) return body;
  return body?.results || [];
}

const num = (v) => Number(v ?? 0) || 0;
const orUndef = (v) => (v === '' || v === null || v === undefined ? undefined : v);

/* ── mapping: server already speaks camelCase (BaseModelSerializer) ── */

export function jwoFromApi(row) {
  if (!row) return row;
  return {
    id: row.id,
    jwoNo: row.jwoNo || '',
    projectId: row.projectId || row.project || null,
    projectCode: row.projectCode || '',
    projectDestination: row.projectDestination || 'Customer Project',
    processPlanId: row.processPlanId || null,
    processPlanNo: row.processPlanNo || row.process_plan_no || (row.process_plan && row.process_plan.plan_no) || '',
    expectedLossPct: num(row.expectedLossPct ?? row.expected_loss_pct),
    process: row.process || '',
    vendor: row.vendor || '',
    orderDate: row.orderDate || '',
    plannedQty: num(row.plannedQty),
    rate: num(row.rate),
    totalAmount: num(row.totalAmount),
    expectedCompletion: row.expectedCompletion || '',
    status: row.status || '',
    remarks: row.remarks || '',
    updatedAt: row.updated_at || row.updatedAt || '',
    materials: (row.materials || []).map((m) => ({
      id: m.id,
      fabricItem: m.fabricItem || '',
      fabricQuality: m.fabricQuality || '',
      shade: m.shade || '',
      lotNo: m.lotNo || '',
      qty: num(m.qty),
      rate: num(m.rate),
      amount: num(m.amount),
    })),
    outwards: (row.outwards || []).map((o) => ({
      id: o.id,
      no: o.no || '',
      challanNo: o.challanNo || o.challan_no || '',
      date: o.date || '',
      qty: num(o.qty),
      lrNo: o.lrNo || o.lr_no || '',
      transporter: o.transporter || '',
      warehouse: o.warehouse || '',
      vehicleNo: o.vehicleNo || o.vehicle_no || '',
      driver: o.driver || '',
      expectedReturnDate: o.expectedReturnDate || o.expected_return_date || '',
      authorizedById: o.authorizedById || o.authorized_by_id || null,
      authorizedByName: o.authorizedByName || o.authorized_by_name || '',
      remarks: o.remarks || '',
      status: o.status || 'Sent',
      takas: (o.takas || []).map((t) => ({
        id: t.id,
        lotTakaId: t.lotTakaId || t.lot_taka_id || t.lot_taka,
        takaNo: t.takaNo || t.taka_no || '',
        lotNo: t.lotNo || t.lot_no || '',
        meters: num(t.meters),
        weightKg: num(t.weightKg || t.weight_kg),
      })),
    })),
    inwards: (row.inwards || []).map((r) => ({
      id: r.id,
      no: r.no || '',
      date: r.date || '',
      qty: num(r.qty),
      accepted: num(r.accepted),
      rejected: num(r.rejected),
      challanNo: r.challanNo || '',
      status: r.status || '',
      takas: (r.takas || []).map((t) => ({
        id: t.id,
        takaNumber: t.taka_number || t.takaNumber || '',
        sourceTakaNumber: t.sourceTakaNumber || t.source_taka_number || '',
        sourceLotNumber: t.sourceLotNumber || t.source_lot_number || '',
        receivedTakaNumber: t.receivedTakaNumber || t.received_taka_number || '',
        receivedLotNumber: t.receivedLotNumber || t.received_lot_number || '',
        receivedTakaIdStr: t.receivedTakaIdStr || '',
        qcStatus: t.qcStatus || 'Pending',
        meters: num(t.meters),
        weightKg: num(t.weight_kg || t.weightKg),
        width: num(t.width),
        shade: t.shade || '',
      })),
    })),
    charges: (row.charges || []).map((c) => ({
      id: c.id,
      type: c.type || '',
      description: c.description || '',
      rate: num(c.rate),
      qty: num(c.qty),
      amount: num(c.amount),
      status: c.status || '',
    })),
    reprocesses: (row.reprocesses || []).map((r) => ({
      id: r.id,
      no: r.no || '',
      inwardNo: r.inwardNo || '',
      date: r.date || '',
      qty: num(r.qty),
      reason: r.reason || '',
      expectedReturn: r.expectedReturn || '',
      status: r.status || '',
      remarks: r.remarks || '',
    })),
    documents: (row.documents || []).map((d) => ({
      id: d.id,
      type: d.type || 'Other',
      no: d.no || '',
      date: d.date || '',
      fileName: d.fileName || '',
      uploadedBy: d.uploadedBy || '',
      url: d.url || '',
      fileId: d.fileId || '',
      remarks: d.remarks || '',
    })),
    signatures: row.signatures || {},
    lossEntries: (row.lossEntries || row.losses || []).map((l) => ({
      id: l.id,
      lossReasonId: l.lossReasonId || '',
      lossReasonName: l.lossReasonName || l.loss_reason_name || '',
      qty: num(l.qty),
      status: l.status || 'Pending',
      approvedBy: l.approvedBy || '',
      approvedAt: l.approvedAt || '',
      remarks: l.remarks || '',
    })),
  };
}

/** Header fields only — child rows go through the per-row endpoints. */
export function jwoHeaderToApi(jwo) {
  const out = {};
  if (jwo.processPlanId !== undefined) out.processPlanId = jwo.processPlanId || null;
  if (jwo.processMasterId !== undefined) out.processMasterId = jwo.processMasterId || null;
  if (jwo.process !== undefined) out.process = jwo.process || '';
  if (jwo.vendorId !== undefined) out.vendorId = jwo.vendorId || null;
  if (jwo.vendor !== undefined) out.vendor = jwo.vendor || '';
  if (jwo.orderDate !== undefined) out.orderDate = orUndef(jwo.orderDate);
  if (jwo.rate !== undefined) out.rate = num(jwo.rate);
  if (jwo.expectedCompletion !== undefined) out.expectedCompletion = jwo.expectedCompletion || null;
  if (jwo.expectedLossPct !== undefined) out.expectedLossPct = num(jwo.expectedLossPct);
  if (jwo.status !== undefined) out.status = jwo.status;
  if (jwo.remarks !== undefined) out.remarks = jwo.remarks || '';
  return out;
}

const ROW_MAPPERS = {
  materials: (m) => ({
    fabricItem: m.fabricItem || '',
    fabricQuality: m.fabricQuality || '',
    shade: m.shade || '',
    lotNo: m.lotNo || '',
    qty: num(m.qty),
    rate: num(m.rate),
  }),
  outwards: (o) => ({
    date: orUndef(o.date),
    qty: num(o.qty),
    challanNo: o.challanNo || o.challan_no || '',
    lrNo: o.lrNo || o.lr_no || '',
    transporter: o.transporter || '',
    warehouse: o.warehouse || '',
    vehicleNo: o.vehicleNo || o.vehicle_no || '',
    driver: o.driver || '',
    expectedReturnDate: orUndef(o.expectedReturnDate || o.expected_return_date),
    authorizedById: o.authorizedById || o.authorized_by_id || null,
    remarks: o.remarks || '',
    ...(o.takas ? { takas: o.takas } : {}),
    ...(o.status ? { status: o.status } : {}),
  }),
  inwards: (r) => ({
    date: orUndef(r.date),
    qty: num(r.qty),
    ...(r.accepted !== undefined && r.accepted !== '' ? { accepted: num(r.accepted) } : {}),
    rejected: num(r.rejected),
    challanNo: r.challanNo || '',
    ...(r.takas ? { takas: r.takas } : {}),
    ...(r.status ? { status: r.status } : {}),
  }),
  losses: (l) => ({
    lossReasonId: l.lossReasonId || null,
    qty: num(l.qty),
    remarks: l.remarks || '',
    ...(l.status ? { status: l.status } : {}),
  }),
  charges: (c) => ({
    type: c.type || '',
    description: c.description || '',
    rate: num(c.rate),
    qty: num(c.qty),
    ...(c.status ? { status: c.status } : {}),
  }),
  reprocesses: (r) => ({
    inwardNo: r.inwardNo || '',
    date: orUndef(r.date),
    qty: num(r.qty),
    reason: r.reason || '',
    expectedReturn: r.expectedReturn || null,
    ...(r.status ? { status: r.status } : {}),
    remarks: r.remarks || '',
  }),
  documents: (d) => ({
    type: d.type || 'Other',
    no: d.no || '',
    date: orUndef(d.date),
    fileName: d.fileName || '',
    fileId: d.fileId || null,
    remarks: d.remarks || '',
  }),
};

/** Create payload: header plus the initial rows the form collected. */
export function jwoCreateToApi(jwo) {
  const body = jwoHeaderToApi(jwo);
  ['materials', 'outwards', 'inwards', 'charges'].forEach((kind) => {
    const rows = (jwo[kind] || []).filter(Boolean);
    if (rows.length) body[kind] = rows.map(ROW_MAPPERS[kind]);
  });
  return body;
}

export function planFromApi(row) {
  if (!row) return row;
  const expQty = num(row.expectedQty);
  return {
    id: row.id,
    planNo: row.planNo || '',
    projectId: row.projectId || row.project || null,
    projectCode: row.projectCode || '',
    projectDestination: row.projectDestination || 'Customer Project',
    priority: row.priority || 'Normal',
    targetShadeFkId: row.targetShadeFkId || null,
    selectedTakas: row.selectedTakas || [],
    date: row.date || '',
    process: row.process || '',
    processCategory: row.processCategory || '',
    vendor: row.vendor || '',
    contactPerson: row.contactPerson || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    fabricItem: row.fabricItem || '',
    greyLotNo: row.greyLotNo || '',
    fabricQuality: row.fabricQuality || '',
    takaRollNo: row.takaRollNo || '',
    shade: row.shade || '',
    expectedQty: expQty,
    plannedQty: expQty,
    expectedLoss: num(row.expectedLoss),
    expectedReturnQty: num(row.expectedReturnQty),
    weight: num(row.weight),
    finishedWeight: num(row.finishedWeight),
    noOfRolls: num(row.noOfRolls),
    startDate: row.startDate || '',
    targetDate: row.targetDate || row.expectedCompletionDate || '',
    expectedCompletionDate: row.expectedCompletionDate || row.targetDate || '',
    assignedEmployee: row.assignedEmployee || '',
    approver: row.approver || '',
    status: row.status || '',
    remarks: row.remarks || '',
    created_at: row.created_at || '',
    updatedAt: row.updated_at || '',
    charges: (row.charges || []).map((c) => ({
      id: c.id,
      type: c.type || '',
      description: c.description || '',
      rate: num(c.rate),
      qty: num(c.qty),
      amount: num(c.amount),
      status: c.status || '',
    })),
  };
}

/** Plan header fields. `withCharges` only on create. */
export function planToApi(p, { withCharges = false } = {}) {
  const qty = num(p.plannedQty ?? p.expectedQty);
  const body = {
    date: orUndef(p.date),
    process: p.process || '',
    processCategory: p.processCategory || null,
    vendor: p.vendor || '',
    contactPerson: p.contactPerson || null,
    phone: p.phone || null,
    fabricItem: p.fabricItem || '',
    greyLotNo: p.greyLotNo || null,
    fabricQuality: p.fabricQuality || '',
    takaRollNo: p.takaRollNo || null,
    shade: p.shade || null,
    expectedQty: qty,
    expectedLoss: num(p.expectedLoss),
    expectedReturnQty: num(p.expectedReturnQty),
    weight: p.weight ? num(p.weight) : null,
    finishedWeight: p.finishedWeight ? num(p.finishedWeight) : null,
    noOfRolls: p.noOfRolls ? num(p.noOfRolls) : null,
    startDate: p.startDate || null,
    expectedCompletionDate: p.expectedCompletionDate || p.targetDate || null,
    email: p.email || null,
    address: p.address || null,
    assignedEmployee: p.assignedEmployee || null,
    approver: p.approver || null,
    remarks: p.remarks || null,
  };
  if (p.projectId) body.projectId = p.projectId;
  if (p.projectDestination) body.projectDestination = p.projectDestination;
  if (p.priority) body.priority = p.priority;
  if (p.targetShadeFkId) body.targetShadeFkId = p.targetShadeFkId;
  if (p.selectedTakas) body.selectedTakas = p.selectedTakas;
  if (p.status) body.status = p.status;
  if (withCharges) body.charges = (p.charges || []).map(ROW_MAPPERS.charges);
  return body;
}

/* ── Job Work Orders ── */

export async function fetchJWOs() {
  const body = await api.get('/jobwork/orders/', { query: { limit: PAGE_SIZE } });
  return rowsFrom(body).map(jwoFromApi);
}

export async function fetchJWO(id) {
  return jwoFromApi(await api.get(`/jobwork/orders/${id}/`));
}

export async function createJWO(jwo) {
  return jwoFromApi(await api.post('/jobwork/orders/', jwoCreateToApi(jwo)));
}

export async function updateJWOHeader(id, fields) {
  return jwoFromApi(await api.patch(`/jobwork/orders/${id}/`, jwoHeaderToApi(fields)));
}

export async function deleteJWO(id) {
  await api.delete(`/jobwork/orders/${id}/`);
  return true;
}

/** Approval point (approve_jobwork). */
export async function closeJWO(id, options) {
  const payload = typeof options === 'string' ? { remarks: options } : (options || {});
  return jwoFromApi(await api.post(`/jobwork/orders/${id}/close/`, payload));
}

/** kind: materials | outwards | inwards | charges | reprocesses | documents */
export async function createJWORow(orderId, kind, row) {
  return api.post(`/jobwork/orders/${orderId}/${kind}/`, ROW_MAPPERS[kind](row));
}

export async function updateJWORow(orderId, kind, rowId, row) {
  return api.patch(`/jobwork/orders/${orderId}/${kind}/${rowId}/`, ROW_MAPPERS[kind](row));
}

export async function deleteJWORow(orderId, kind, rowId) {
  await api.delete(`/jobwork/orders/${orderId}/${kind}/${rowId}/`);
  return true;
}

export async function signJWODocument(orderId, { documentType, documentId, signatoryType, signature }) {
  return api.post(`/jobwork/orders/${orderId}/sign/`, {
    documentType,
    documentId,
    signatoryType,
    signature,
  });
}

/* ── Process Plans ── */

export async function fetchPlans() {
  const body = await api.get('/jobwork/process-plans/', { query: { limit: PAGE_SIZE } });
  return rowsFrom(body).map(planFromApi);
}

export async function fetchPlan(id) {
  return planFromApi(await api.get(`/jobwork/process-plans/${id}/`));
}

export async function createPlan(plan) {
  return planFromApi(await api.post('/jobwork/process-plans/', planToApi(plan, { withCharges: true })));
}

export async function updatePlan(id, plan) {
  return planFromApi(await api.patch(`/jobwork/process-plans/${id}/`, planToApi(plan)));
}

export async function deletePlan(id) {
  await api.delete(`/jobwork/process-plans/${id}/`);
  return true;
}

/** Approval points (approve_jobwork). */
export async function approvePlan(id) {
  return planFromApi(await api.post(`/jobwork/process-plans/${id}/approve/`, {}));
}

export async function completePlan(id) {
  return planFromApi(await api.post(`/jobwork/process-plans/${id}/complete/`, {}));
}

export async function createJWOFromPlan(planId) {
  return jwoFromApi(await api.post(`/jobwork/process-plans/${planId}/create-jwo/`, {}));
}

export async function createPlanCharge(planId, charge) {
  return api.post(`/jobwork/process-plans/${planId}/charges/`, ROW_MAPPERS.charges(charge));
}

export async function updatePlanCharge(planId, chargeId, charge) {
  return api.patch(`/jobwork/process-plans/${planId}/charges/${chargeId}/`, ROW_MAPPERS.charges(charge));
}

export async function deletePlanCharge(planId, chargeId) {
  await api.delete(`/jobwork/process-plans/${planId}/charges/${chargeId}/`);
  return true;
}

/** Human-readable message from an api.js error. */
export function errorMessage(err, fallback = 'Could not save. Please try again.') {
  if (!err) return fallback;
  const fe = err.payload?.field_errors || err.payload?.fieldErrors;
  const base = err.payload?.message || err.message || fallback;
  if (fe && typeof fe === 'object') {
    const details = Object.values(fe).flat().filter(Boolean).join(' ');
    if (details && !base.includes(details)) return `${base} ${details}`;
  }
  return base;
}

export async function lookupJWORate({ processorId, processId, fabricQualityId }) {
  const query = {};
  if (processorId) query.processorId = processorId;
  if (processId) query.processId = processId;
  if (fabricQualityId) query.fabricQualityId = fabricQualityId;
  return api.get('/jobwork/orders/lookup-rate/', { query });
}

export async function approveJWOLoss(orderId, lossId) {
  return api.post(`/jobwork/orders/${orderId}/losses/${lossId}/approve/`, {});
}

export async function fetchProcessorLedger(processorId) {
  const query = {};
  if (processorId) query.processorId = processorId;
  return api.get('/jobwork/orders/processor-ledger/', { query });
}

export async function fetchPendingRegister(projectId) {
  const query = {};
  if (projectId) query.project = projectId;
  const res = await api.get('/jobwork/orders/pending-register/', { query });
  return res?.results || [];
}

export async function fetchVendorReconciliation(projectId) {
  const query = {};
  if (projectId) query.project = projectId;
  const res = await api.get('/jobwork/orders/vendor-reconciliation/', { query });
  return res?.results || [];
}

export async function validateJWOOutwardStock(orderId, payload) {
  return api.post(`/jobwork/orders/${orderId}/validate-stock/`, payload);
}

export async function confirmJWOOutward(orderId, outwardId) {
  return api.post(`/jobwork/orders/${orderId}/outwards/${outwardId}/confirm/`);
}

export async function fetchStage15QCStockData(projectId) {
  return api.get(`/pms/projects/${projectId}/qc-stock-allocation/`);
}

export async function submitStage15QCInspection(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/qc-stock-allocation/`, {
    action_type: 'save_inspection',
    ...payload,
  });
}

export async function approveStage15QCInspection(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/qc-stock-allocation/`, {
    action_type: 'approve_inspection',
    ...payload,
  });
}

export async function allocateStage15Stock(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/qc-stock-allocation/`, {
    action_type: 'allocate_stock',
    ...payload,
  });
}

export async function releaseStage15Allocation(projectId, allocationId) {
  return api.post(`/pms/projects/${projectId}/qc-stock-allocation/`, {
    action_type: 'release_allocation',
    allocation_id: allocationId,
  });
}


export async function fetchStage16DispatchData(projectId) {
  return api.get(`/pms/projects/${projectId}/customer-dispatch/`);
}

export async function createStage16Dispatch(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/customer-dispatch/`, {
    action_type: 'create_dispatch',
    ...payload,
  });
}

export async function updateStage16DispatchLR(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/customer-dispatch/`, {
    action_type: 'update_lr',
    ...payload,
  });
}

export async function fetchStage17InvoiceData(projectId) {
  return api.get(`/pms/projects/${projectId}/invoice-payment/`);
}

export async function createStage17Proforma(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/invoice-payment/`, {
    action_type: 'create_proforma',
    ...payload,
  });
}

export async function convertStage17Proforma(projectId, proformaId, extra = {}) {
  return api.post(`/pms/projects/${projectId}/invoice-payment/`, {
    action_type: 'convert_proforma_to_final',
    proforma_id: proformaId,
    ...extra,
  });
}

export async function cancelStage17Proforma(projectId, proformaId, reason = '') {
  return api.post(`/pms/projects/${projectId}/invoice-payment/`, {
    action_type: 'cancel_proforma',
    proforma_id: proformaId,
    reason,
  });
}

export async function createStage17FinalInvoice(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/invoice-payment/`, {
    action_type: 'create_final_invoice',
    ...payload,
  });
}

export async function recordStage17Payment(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/invoice-payment/`, {
    action_type: 'record_payment',
    ...payload,
  });
}

export async function fetchInventoryDocumentsData(projectId) {
  return api.get(`/pms/projects/${projectId}/inventory-documents/`);
}

export async function uploadProjectDocument(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/inventory-documents/`, {
    action_type: 'upload_document',
    ...payload,
  });
}

export async function sendProjectDocumentToClient(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/inventory-documents/`, {
    action_type: 'send_to_client',
    ...payload,
  });
}

export async function generateProjectDocumentLink(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/inventory-documents/`, {
    action_type: 'generate_link',
    ...payload,
  });
}

export async function recordClientDocumentDecision(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/inventory-documents/`, {
    action_type: 'record_client_decision',
    ...payload,
  });
}

export async function fetchCustomerProjectDetails(projectId) {
  return api.get(`/pms/projects/${projectId}/customer-project-details/`);
}

export async function fetchOwnProjectDetails(projectId) {
  return api.get(`/pms/projects/${projectId}/own-project-details/`);
}

export async function fetchClosureAuditData(projectId) {
  return api.get(`/pms/projects/${projectId}/closure-audit/`);
}

export async function closePmsProject(projectId, payload = {}) {
  return api.post(`/pms/projects/${projectId}/close/`, payload);
}

// -------------------------------------------------------------
// Customer Return Workflow (Returns, Inward, QC, Routing, Credit)
// -------------------------------------------------------------
export async function fetchCustomerReturnsWorkspace(projectId) {
  return api.get(`/pms/projects/${projectId}/customer-returns/`);
}

export async function createCustomerReturnRequest(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/customer-returns/`, {
    action_type: 'create_return_request',
    ...payload,
  });
}

export async function receiveCustomerReturnPhysical(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/customer-returns/`, {
    action_type: 'receive_physical_return',
    ...payload,
  });
}

export async function submitCustomerReturnQC(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/customer-returns/`, {
    action_type: 'inspect_qc',
    ...payload,
  });
}

export async function routeCustomerReturnStock(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/customer-returns/`, {
    action_type: 'route_stock',
    ...payload,
  });
}

export async function issueCustomerReturnCreditNote(projectId, payload) {
  return api.post(`/pms/projects/${projectId}/customer-returns/`, {
    action_type: 'issue_credit_note',
    ...payload,
  });
}


