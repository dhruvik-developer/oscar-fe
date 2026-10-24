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
} from "../services/hrmsSync";

const useIncentiveStoreBase = create((set, get) => ({
  // Re-read the rows after an action: the backend owns the resulting status.
  refreshAccruals: async () => {
    const fresh = await pullTracked("incentives");
    if (fresh) set({ accruals: fresh });
    return fresh;
  },

  schemes: [],
  accruals: [],
  quarterlyReport: null,
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const [accruals, schemes] = await Promise.all([
        pullTracked("incentives"),
        pullTracked("incentiveSchemes"),
      ]);
      set({
        accruals: accruals || [],
        schemes: schemes || [],
        loading: false,
      });
      return { accruals, schemes };
    } catch (err) {
      set({ error: err?.message || "Failed to load incentives", loading: false });
      return null;
    }
  },

  clear: () => set({ accruals: [], schemes: [], quarterlyReport: null, error: null }),

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

  // Saves straight to the canonical scheme (pms.IncentiveScheme) and throws
  // on a validation error so the form can show it.
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
