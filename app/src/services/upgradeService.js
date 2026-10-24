import { apiClient } from './api';

// ── HRMS Employee Lifecycle (§2.5, §11.9) ──────────────────────────────────
// Real backend endpoints backed by DRF ModelViewSets at /api/v1/hrms/:
// /transfers/, /promotions/, /warnings/, /awards/

function buildLifecycleQuery(employeeId) {
  return employeeId ? { employeeId } : {};
}

export async function fetchEmployeeTransfers(employeeId) {
  const res = await apiClient('/hrms/transfers/', { query: buildLifecycleQuery(employeeId) });
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : Array.isArray(res?.results) ? res.results : [];
}

export async function createEmployeeTransfer(data) {
  return apiClient('/hrms/transfers/', { method: 'POST', data });
}

export async function fetchEmployeePromotions(employeeId) {
  const res = await apiClient('/hrms/promotions/', { query: buildLifecycleQuery(employeeId) });
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : Array.isArray(res?.results) ? res.results : [];
}

export async function createEmployeePromotion(data) {
  return apiClient('/hrms/promotions/', { method: 'POST', data });
}

export async function fetchEmployeeWarnings(employeeId) {
  const res = await apiClient('/hrms/warnings/', { query: buildLifecycleQuery(employeeId) });
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : Array.isArray(res?.results) ? res.results : [];
}

export async function createEmployeeWarning(data) {
  return apiClient('/hrms/warnings/', { method: 'POST', data });
}

export async function fetchEmployeeAwards(employeeId) {
  const res = await apiClient('/hrms/awards/', { query: buildLifecycleQuery(employeeId) });
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : Array.isArray(res?.results) ? res.results : [];
}

export async function createEmployeeAward(data) {
  return apiClient('/hrms/awards/', { method: 'POST', data });
}

export async function sendOfferLetter(offerId) {
  return apiClient(`/hrms/offers/${offerId}/send_offer/`, { method: 'POST' });
}

export async function acceptOfferLetter(offerId) {
  return apiClient(`/hrms/offers/${offerId}/accept_offer/`, { method: 'POST' });
}
