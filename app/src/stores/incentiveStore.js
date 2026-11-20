import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import {
  pullTracked,
  calculateQuarterlyIncentive as apiCalculateQuarterly,
  holdIncentivePayout as apiHoldPayout,
  releaseIncentivePayout as apiReleasePayout,
  approveIncentivePayout as apiApprovePayout,
  markIncentivePaid as apiMarkPaid,
  createIncentiveScheme as apiCreateScheme,
  updateIncentiveScheme as apiUpdateScheme,
  reverseIncentivePayout as apiReversePayout,
  payIncentiveDirect as apiPayDirect,
  payIncentiveThroughSalary as apiPaySalary,
  pullIncentivePaymentHistory as apiPullPaymentHistory,
  pullBankAccounts as apiPullBankAccounts,
  pullSalespersonPerformance,
  pullIncentiveDashboardSummary,
  pullSalespersonDetail,
} from "../services/hrmsSync";

const useIncentiveStoreBase = create((set, get) => ({
  refreshAccruals: async () => {
    const fresh = await pullTracked("incentives");
    if (fresh) set({ accruals: fresh });
    // Also refresh performance, summary, and payment history
    get().fetchSalespersonPerformance().catch(() => {});
    get().fetchDashboardSummary().catch(() => {});
    get().fetchPaymentHistory().catch(() => {});
    return fresh;
  },

  schemes: [],
  accruals: [],
  salespersonPerformance: [],
  dashboardSummary: null,
  selectedSalespersonDetail: null,
  detailLoading: false,
  paymentHistory: [],
  paymentHistoryLoading: false,
  bankAccounts: [],
  quarterlyReport: null,
  loading: false,
  error: null,

  hydrate: async (quarter = null, year = null) => {
    set({ loading: true, error: null });
    try {
      const query = (quarter && year) ? { quarter, year } : undefined;
      const [accruals, schemes, perfRes, summaryRes] = await Promise.all([
        pullTracked("incentives"),
        pullTracked("incentiveSchemes"),
        pullSalespersonPerformance(query).catch(() => null),
        pullIncentiveDashboardSummary(query).catch(() => null),
      ]);
      set({
        accruals: accruals || [],
        schemes: schemes || [],
        salespersonPerformance: perfRes?.salespeople || [],
        dashboardSummary: summaryRes || null,
        loading: false,
      });
      return { accruals, schemes, salespersonPerformance: perfRes?.salespeople, dashboardSummary: summaryRes };
    } catch (err) {
      set({ error: err?.message || "Failed to load incentives", loading: false });
      return null;
    }
  },

  fetchSalespersonPerformance: async (quarter = null, year = null) => {
    try {
      const query = (quarter && year) ? { quarter, year } : undefined;
      const res = await pullSalespersonPerformance(query);
      if (res?.salespeople) {
        set({ salespersonPerformance: res.salespeople });
      }
      return res;
    } catch (err) {
      console.warn("fetchSalespersonPerformance failed:", err);
      return null;
    }
  },

  fetchDashboardSummary: async (quarter = null, year = null) => {
    try {
      const query = (quarter && year) ? { quarter, year } : undefined;
      const res = await pullIncentiveDashboardSummary(query);
      if (res) {
        set({ dashboardSummary: res });
      }
      return res;
    } catch (err) {
      console.warn("fetchDashboardSummary failed:", err);
      return null;
    }
  },

  fetchSalespersonDetail: async (employeeId, quarter = null, year = null) => {
    set({ detailLoading: true });
    try {
      const query = (quarter && year) ? { quarter, year } : undefined;
      const res = await pullSalespersonDetail(employeeId, query);
      set({ selectedSalespersonDetail: res, detailLoading: false });
      return res;
    } catch (err) {
      set({ detailLoading: false, error: err?.message || "Failed to load salesperson details" });
      throw err;
    }
  },

  clearSelectedSalespersonDetail: () => set({ selectedSalespersonDetail: null }),

  clear: () => set({
    accruals: [],
    schemes: [],
    salespersonPerformance: [],
    dashboardSummary: null,
    selectedSalespersonDetail: null,
    quarterlyReport: null,
    error: null,
  }),

  fetchIncentives: async () => {
    return get().hydrate();
  },

  calculateQuarterlyIncentive: async (quarter, year, employeeId = null) => {
    set({ loading: true, error: null });
    try {
      const payload = { quarter, year };
      if (employeeId) payload.employee_id = employeeId;
      const res = await apiCalculateQuarterly(payload);
      const freshAccruals = await pullTracked("incentives");
      set({
        accruals: freshAccruals || get().accruals,
        quarterlyReport: res,
        loading: false,
      });
      // Refresh performance and summary for this quarter
      get().fetchSalespersonPerformance(quarter, year).catch(() => {});
      get().fetchDashboardSummary(quarter, year).catch(() => {});
      return res;
    } catch (err) {
      set({ error: err?.message || "Calculation failed", loading: false });
      throw err;
    }
  },

  holdPayout: async (id, reason = "Management hold") => {
    try {
      const updated = await apiHoldPayout(id, reason);
      await get().refreshAccruals();
      return updated;
    } catch (err) {
      set({ error: err?.message || "Failed to hold payout" });
      throw err;
    }
  },

  releasePayout: async (id) => {
    try {
      const updated = await apiReleasePayout(id);
      await get().refreshAccruals();
      return updated;
    } catch (err) {
      set({ error: err?.message || "Failed to release payout" });
      throw err;
    }
  },

  approveIncentive: async (id) => {
    try {
      const updated = await apiApprovePayout(id);
      await get().refreshAccruals();
      return updated;
    } catch (err) {
      set({ error: err?.message || "Failed to approve payout" });
      throw err;
    }
  },

  markPaid: async (id) => {
    try {
      const updated = await apiMarkPaid(id);
      await get().refreshAccruals();
      return updated;
    } catch (err) {
      set({ error: err?.message || "Failed to mark paid" });
      throw err;
    }
  },

  reversePayout: async (id, reason = "Management reversal") => {
    try {
      const updated = await apiReversePayout(id, reason);
      await get().refreshAccruals();
      return updated;
    } catch (err) {
      set({ error: err?.message || "Failed to reverse payout" });
      throw err;
    }
  },

  payDirect: async (id, payload) => {
    try {
      const updated = await apiPayDirect(id, payload);
      await get().refreshAccruals();
      return updated;
    } catch (err) {
      set({ error: err?.payload?.message || err?.message || "Failed to post direct payment" });
      throw err;
    }
  },

  payThroughSalary: async (id, payload) => {
    try {
      const updated = await apiPaySalary(id, payload);
      await get().refreshAccruals();
      return updated;
    } catch (err) {
      set({ error: err?.payload?.message || err?.message || "Failed to queue in salary" });
      throw err;
    }
  },

  fetchPaymentHistory: async (query = {}) => {
    set({ paymentHistoryLoading: true });
    try {
      const res = await apiPullPaymentHistory(query);
      const rows = res?.results || res?.data || (Array.isArray(res) ? res : []);
      set({ paymentHistory: rows, paymentHistoryLoading: false });
      return rows;
    } catch (err) {
      set({ paymentHistoryLoading: false, error: err?.message || "Failed to load payment history" });
      return [];
    }
  },

  fetchBankAccounts: async () => {
    try {
      const res = await apiPullBankAccounts();
      const rows = res?.results || res?.data || (Array.isArray(res) ? res : []);
      set({ bankAccounts: rows });
      return rows;
    } catch (err) {
      console.warn("fetchBankAccounts failed:", err);
      return [];
    }
  },

  saveScheme: async (scheme) => {
    const { id, ...payload } = scheme;
    const saved = id ? await apiUpdateScheme(id, payload) : await apiCreateScheme(payload);
    const fresh = await pullTracked("incentiveSchemes");
    if (fresh) set({ schemes: fresh });
    return saved;
  },

  clearError: () => set({ error: null }),
}));

export const useIncentiveStore = lazyStore(useIncentiveStoreBase, "incentives");
export default useIncentiveStore;
