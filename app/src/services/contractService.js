export { formatContractMoney, formatContractDate } from '../utils/contractFormatting.js';
import { loadDeals, DEALS_STORAGE_KEY } from './dealService.js';
import { crmStorage } from './crmStorage.js';
import { crmSync, isBackendEnabled, isServerId } from './crmSync.js';
import { crmService } from './domainServices.js';
import { toISODate } from '../utils/dateUtils.js';
import { emitCrmEvent, CRM_EVENT_TYPES } from './crmEventNotifications.js';

export const CONTRACT_TYPES = [
  'Supply Agreement',
  'Service Contract',
  'AMC',
  'Purchase Agreement',
  'NDA',
  'Maintenance Contract',
  'Consulting Agreement',
  'Other',
];

export const CONTRACT_STATUSES = ['Draft', 'Active', 'Closed', 'Cancelled'];

export const CONTRACT_TEMPLATES = [
  'Standard Supply Agreement',
  'Standard Service Contract',
  'Standard AMC',
  'Standard NDA',
  'Custom',
];

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

function toDay(value) {
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value || '') ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function notifyUpdated() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('crm:data-updated'));
}

function isValidCalendarDate(value) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!parts) return false;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function assertContractDates(startDate, endDate) {
  for (const date of [startDate, endDate]) {
    if (date && !isValidCalendarDate(date)) throw new Error('Enter valid contract dates.');
  }
  if (startDate && endDate && startDate > endDate) throw new Error('End date must be on or after start date.');
}

export function nextContractNumber(contracts) {
  const next = Math.max(0, ...contracts.map((item) => Number(/^CN-(\d+)$/.exec(item.contractNumber || '')?.[1]) || 0)) + 1;
  return `CN-${String(next).padStart(5, '0')}`;
}

export function getContractDisplayStatus(contract, today = new Date()) {
  const stored = contract.status || 'Draft';
  if (/^(cancelled|closed)$/i.test(stored)) return stored.charAt(0).toUpperCase() + stored.slice(1).toLowerCase();
  const end = toDay(contract.endDate);
  if (end) {
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (end < base) return 'Expired';
    const daysLeft = Math.round((end - base) / 86400000);
    if (daysLeft <= 30) return 'Expiring Soon';
  }
  if (/^draft$/i.test(stored)) return 'Draft';
  return 'Active';
}

function enrich(deal, contract) {
  return {
    ...contract,
    dealId: deal.id,
    dealName: deal.name,
    dealNumber: deal.dealNumber,
    client: contract.customer || deal.client,
    leadId: deal.leadId,
    leadNumber: deal.leadNumber,
    projectId: deal.projectId,
  };
}

export function loadContracts(storage = crmStorage) {
  const local = readLocalContracts(storage);
  if (serverContractCache.length === 0) return local;
  const byBackend = new Map(serverContractCache.map((c) => [String(c.backendId || c.id), c]));
  const merged = local.map((c) => {
    const key = c.backendId ? String(c.backendId) : null;
    return key && byBackend.has(key) ? { ...byBackend.get(key), id: c.backendId, backendId: c.backendId } : c;
  });
  const known = new Set([
    ...local.map((c) => String(c.backendId || c.id)),
    ...merged.map((c) => String(c.backendId || c.id)),
  ]);
  serverContractCache.forEach((c) => {
    if (!known.has(String(c.backendId || c.id))) merged.push(c);
  });
  return merged.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
}

/**
 * Backend-first persistence. Contracts always belong to a deal, and the
 * server owns numbering (`CON-…`), so every row that can live in Postgres
 * does: `loadContracts()` merges the server cache with deal-nested local
 * rows (matched by `backendId`), and creates/updates/deletes write through
 * `/crm/contracts/` first. Rows without a linkable party stay local-only
 * instead of 400ing.
 */

/** Server rows fetched by the last `refreshContractsCache()` (service shape). */
let serverContractCache = [];

function apiContractToServiceRow(server, deals = []) {
  const deal = deals.find((d) => sameId(d.id, server.dealId || server.deal));
  return {
    id: server.id,
    backendId: server.id,
    contractNumber: server.contractNumber || server.contract_number || `CN-${String(server.id).slice(0, 8).toUpperCase()}`,
    title: server.title || '',
    customer: server.customerName || '',
    customerId: server.customerId || undefined,
    contractType: server.contractType || server.contract_type || 'Other',
    amount: server.value ?? 0,
    startDate: toISODate(server.startDate) || '',
    endDate: toISODate(server.endDate) || '',
    description: server.description || '',
    terms: server.body || '',
    template: server.templateKey || server.template_key || '',
    status: server.status || 'Active',
    esignStatus: server.esignStatus || server.esign_status || '',
    esignSignerEmail: server.esignSignerEmail || server.esign_signer_email || '',
    esignSentAt: server.esignSentAt || server.esign_sent_at || '',
    signedAt: server.signedAt || server.signed_at || '',
    signedFileUrl: server.signedFileUrl || '',
    attachments: [],
    notifyCustomer: false,
    dealId: server.dealId || server.deal || deal?.id || '',
    dealName: deal?.name || '',
    dealNumber: deal?.dealNumber || '',
    leadId: deal?.leadId || '',
    leadNumber: deal?.leadNumber || '',
    projectId: deal?.projectId || '',
    client: server.customerName || deal?.client || '',
    createdAt: server.createdAt || server.created_at || new Date().toISOString(),
    _synced: true,
  };
}

/** Pull `/crm/contracts/` into the merge cache. Pages call this on mount. */
export async function refreshContractsCache() {
  if (!isBackendEnabled()) return [];
  try {
    const rows = await crmSync.pull('contracts');
    let deals = [];
    try { deals = loadDeals(); } catch { deals = []; }
    serverContractCache = (rows || []).map((row) => apiContractToServiceRow(row, deals));
    return serverContractCache;
  } catch {
    return [];
  }
}

function serviceContractToApiPayload(contract, deal) {
  return {
    title: [contract.contractType, contract.customer].filter(Boolean).join(' — ') || contract.title || undefined,
    customerId: contract.customerId || (isServerId(deal?.customerId || deal?.partyId) ? (deal.customerId || deal.partyId) : undefined),
    dealId: isServerId(contract.dealId || deal?.id) ? (contract.dealId || deal.id) : undefined,
    contractType: contract.contractType || undefined,
    value: contract.amount ?? undefined,
    startDate: contract.startDate || undefined,
    endDate: contract.endDate || undefined,
    status: contract.status || undefined,
    templateKey: contract.template || undefined,
    description: contract.description || undefined,
    body: contract.terms || undefined,
  };
}

function annotateNestedBackendId(deals, dealId, contractId, backendId, storage) {
  const next = deals.map((item) => sameId(item.id, dealId)
    ? { ...item, contracts: (item.contracts || []).map((entry) => sameId(entry.id, contractId) ? { ...entry, backendId } : entry) }
    : item);
  storage.setItem(DEALS_STORAGE_KEY, JSON.stringify(next));
}

function readLocalContracts(storage = crmStorage) {
  const deals = loadDeals(storage);
  let sequence = 0;
  deals.forEach((deal) => (deal.contracts || []).forEach((contract) => {
    const match = /^CN-(\d+)$/.exec(contract.contractNumber || '');
    if (match) sequence = Math.max(sequence, Number(match[1]));
  }));
  let changed = false;
  const numbered = deals.map((deal) => {
    if (!Array.isArray(deal.contracts)) return deal;
    const contracts = deal.contracts.map((contract) => {
      if (contract.contractNumber) return contract;
      changed = true;
      sequence += 1;
      return { ...contract, contractNumber: `CN-${String(sequence).padStart(5, '0')}` };
    });
    return { ...deal, contracts };
  });
  if (changed) storage.setItem(DEALS_STORAGE_KEY, JSON.stringify(numbered));
  const flat = [];
  numbered.forEach((deal) => (deal.contracts || []).forEach((contract) => flat.push(enrich(deal, contract))));
  return flat.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
}

export function findContract(contractId, storage = crmStorage) {
  // Merged list first, so server rows from another device resolve too.
  const flat = loadContracts(storage);
  const hit = flat.find((item) => sameId(item.id, contractId) || sameId(item.backendId, contractId));
  if (hit) {
    let deal = null;
    try {
      const deals = loadDeals(storage);
      deal = deals.find((d) => sameId(d.id, hit.dealId)) || null;
    } catch { deal = null; }
    return { contract: hit, deal };
  }
  return { contract: null, deal: null };
}

function writeDeals(deals, storage) {
  storage.setItem(DEALS_STORAGE_KEY, JSON.stringify(deals));
  notifyUpdated();
}

export async function createContract(input = {}, { storage = crmStorage } = {}) {
  const deals = loadDeals(storage);
  const deal = deals.find((item) => sameId(item.id, input.dealId));
  if (!deal) throw new Error('Select a deal for this contract.');
  const customer = String(input.customer ?? deal.client ?? '').trim();
  if (!customer) throw new Error('Customer is required.');
  const contractType = String(input.contractType ?? '').trim();
  if (!contractType) throw new Error('Select a contract type.');
  const amount = Number(input.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter a valid contract value.');
  const startDate = input.startDate || '';
  const endDate = input.endDate || '';
  if (!startDate || !endDate) throw new Error('Start date and end date are required.');
  assertContractDates(startDate, endDate);
  const all = [];
  deals.forEach((item) => (item.contracts || []).forEach((contract) => all.push(contract)));
  const timestamp = new Date().toISOString();
  const contract = {
    id: `contract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    contractNumber: nextContractNumber(all),
    customer,
    contractType,
    amount,
    startDate,
    endDate,
    description: String(input.description ?? '').trim(),
    terms: String(input.terms ?? '').trim(),
    template: String(input.template ?? '').trim(),
    status: input.status || 'Active',
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    notifyCustomer: Boolean(input.notifyCustomer),
    createdAt: timestamp,
  };
  writeDeals(deals.map((item) => sameId(item.id, deal.id) ? { ...item, contracts: [contract, ...(item.contracts || [])] } : item), storage);
  appendDealActivity(deal.id, `Contract ${contract.contractNumber} created for ${customer}.`, 'CRM User', { storage });
  // Backend-first: same row, server-owned numbering. Needs a linkable party;
  // without one the nested local row is the record (as before).
  if (isBackendEnabled()) {
    const payload = serviceContractToApiPayload(contract, deal);
    if (payload.customerId) {
      try {
        const saved = await crmSync.create('contracts', payload);
        if (saved?.id) {
          contract.backendId = saved.id;
          annotateNestedBackendId(loadDeals(storage), deal.id, contract.id, saved.id, storage);
        }
      } catch (err) {
        console.warn('[CRM Contract] backend save failed, kept locally:', err?.message || err);
      }
    } else {
      console.warn('[CRM Contract] no linkable party — kept locally only.');
    }
  }
  return enrich(deal, contract);
}

export async function updateContract(dealId, contractId, patch = {}, { storage = crmStorage } = {}) {
  const deals = loadDeals(storage);
  const deal = deals.find((item) => sameId(item.id, dealId));
  if (!deal) throw new Error('Deal was not found.');
  const current = (deal.contracts || []).find((item) => sameId(item.id, contractId));
  if (!current) throw new Error('Contract was not found.');
  const updated = { ...current };
  for (const field of ['customer', 'contractType', 'description', 'terms', 'template', 'status']) {
    if (patch[field] !== undefined) updated[field] = typeof patch[field] === 'string' ? patch[field].trim() : patch[field];
  }
  if (patch.amount !== undefined) {
    const amount = Number(patch.amount);
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter a valid contract value.');
    updated.amount = amount;
  }
  if (patch.startDate !== undefined) updated.startDate = patch.startDate || '';
  if (patch.endDate !== undefined) updated.endDate = patch.endDate || '';
  if (patch.attachments !== undefined) updated.attachments = patch.attachments;
  if (patch.notifyCustomer !== undefined) updated.notifyCustomer = Boolean(patch.notifyCustomer);
  if (!updated.customer) throw new Error('Customer is required.');
  if (!updated.contractType) throw new Error('Select a contract type.');
  assertContractDates(updated.startDate, updated.endDate);
  writeDeals(deals.map((item) => sameId(item.id, deal.id)
    ? { ...item, contracts: (item.contracts || []).map((entry) => sameId(entry.id, contractId) ? updated : entry) }
    : item), storage);
  if (current.backendId && isBackendEnabled() && isServerId(current.backendId)) {
    try {
      await crmSync.update('contracts', current.backendId, serviceContractToApiPayload(updated, deal));
    } catch (err) {
      console.warn('[CRM Contract] backend update failed, kept locally:', err?.message || err);
    }
  }
  if (current.status !== 'Active' && updated.status === 'Active') {
    emitCrmEvent({
      type: CRM_EVENT_TYPES.CONTRACT_SIGNED,
      entityType: 'contract',
      entityId: updated.id,
      payload: {
        contractRef: updated.contractNumber,
        customerName: updated.customer,
        ownerName: deal.assignedUser || deal.owner,
        path: `/crm/contracts/${updated.id}`,
      },
    });
  }
  return enrich(deal, updated);
}

export async function deleteContract(dealId, contractId, { storage = crmStorage } = {}) {
  const deals = loadDeals(storage);
  const deal = deals.find((item) => sameId(item.id, dealId));
  if (!deal) throw new Error('Deal was not found.');
  const removed = (deal.contracts || []).find((item) => sameId(item.id, contractId));
  if (!removed) throw new Error('Contract was not found.');
  if (removed.backendId && isBackendEnabled() && isServerId(removed.backendId)) {
    try {
      await crmSync.remove('contracts', removed.backendId);
    } catch (err) {
      console.warn('[CRM Contract] backend delete failed:', err?.message || err);
    }
  }
  writeDeals(deals.map((item) => sameId(item.id, deal.id)
    ? { ...item, contracts: (item.contracts || []).filter((entry) => !sameId(entry.id, contractId)) }
    : item), storage);
  return removed;
}

export function appendDealActivity(dealId, title, actor = 'CRM User', { storage = crmStorage } = {}) {
  const deals = loadDeals(storage);
  const deal = deals.find((item) => sameId(item.id, dealId));
  if (!deal) return;
  const activity = {
    id: `contract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title, actor, timestamp: new Date().toISOString(), type: 'contract',
  };
  writeDeals(deals.map((item) => sameId(item.id, deal.id) ? { ...item, activities: [activity, ...(item.activities || [])] } : item), storage);
  // Best-effort mirror into the server timeline (the audit trail stays source).
  if (isBackendEnabled() && isServerId(dealId)) {
    crmService.postDealActivity(dealId, { type: 'contract', description: title })
      .catch((err) => console.warn('[CRM] deal activity not saved:', err?.message || err));
  }
}

export function addDealActivity(dealId, entry = {}, { storage = crmStorage } = {}) {
  const deals = loadDeals(storage);
  const deal = deals.find((item) => sameId(item.id, dealId));
  if (!deal) throw new Error('Deal was not found.');
  const activity = {
    id: `contract-activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    type: 'activity',
    actor: 'CRM User',
    ...entry,
  };
  writeDeals(deals.map((item) => sameId(item.id, deal.id) ? { ...item, activities: [activity, ...(item.activities || [])] } : item), storage);
  if (isBackendEnabled() && isServerId(dealId)) {
    crmService.postDealActivity(dealId, { type: entry.type || 'note', description: entry.title || '' })
      .catch((err) => console.warn('[CRM] deal activity not saved:', err?.message || err));
  }
  return activity;
}
