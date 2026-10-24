import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import {
  hrmsSync,
  writeThrough,
  pullTracked,
  pullWorkingDays,
  pushWorkingDays,
  pullPayrollFor,
  pullPayrollPeriod,
  processPayroll,
  approvePayroll,
  markPayrollPaid,
  describeError,
  localISODate,
} from "../services/hrmsSync";

export const WORKFLOW_STAGES = [
  { id: "In Progress", label: "In Progress" },
  { id: "Ready for Review", label: "Ready for Review" },
  { id: "Approved", label: "Approved" },
  { id: "Paid", label: "Paid" },
];

export const DEFAULT_DEPARTMENT_WORKING_DAYS = {
  "Engineering": 24,
  "Operations": 24,
  "Design": 24,
  "Marketing": 24,
  "Finance": 22,
  "Human Resources": 24,
  "Sales & CRM": 26,
  "Warehouse & Inventory": 26,
  "Executive": 22,
};

export const DEFAULT_DEPARTMENT_WORKING_HOURS = {
  "Engineering": 8,
  "Operations": 9,
  "Design": 8,
  "Marketing": 8,
  "Finance": 8,
  "Human Resources": 8,
  "Sales & CRM": 9,
  "Warehouse & Inventory": 9,
  "Executive": 8,
};

export function getDepartmentDays(departmentWorkingDays, deptName) {
  if (!deptName) return 24;
  if (departmentWorkingDays && departmentWorkingDays[deptName]) {
    return departmentWorkingDays[deptName];
  }
  const lower = deptName.toLowerCase();
  const found = Object.keys(departmentWorkingDays || {}).find(
    (k) => k.toLowerCase() === lower || lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  );
  if (found && departmentWorkingDays[found]) {
    return departmentWorkingDays[found];
  }
  return 24;
}

export function getDepartmentHours(departmentWorkingHours, deptName) {
  if (!deptName) return 8;
  if (departmentWorkingHours && departmentWorkingHours[deptName]) {
    return Number(departmentWorkingHours[deptName]);
  }
  const lower = deptName.toLowerCase();
  const found = Object.keys(departmentWorkingHours || {}).find(
    (k) => k.toLowerCase() === lower || lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)
  );
  if (found && departmentWorkingHours[found]) {
    return Number(departmentWorkingHours[found]);
  }
  return 8;
}

/** This month as `YYYY-MM`, in local time. */
export function currentPayrollPeriod(d = new Date()) {
  return localISODate(d).slice(0, 7);
}

/** `2026-10` → `October 2026`. */
export function periodLabel(period) {
  const [y, m] = String(period || "").split("-").map(Number);
  if (!y || !m) return String(period || "");
  return new Date(y, m - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
}

/**
 * Where a month's payroll stands, from its payslips' own statuses: anything
 * still being worked on keeps the month "In Progress"; it is "Paid" only once
 * every payslip is.
 */
export function periodStage(rows = []) {
  if (!rows.length) return null;
  const statuses = rows.map((r) => r.status);
  if (statuses.every((s) => s === "Paid")) return "Paid";
  if (statuses.some((s) => s === "In Progress" || !s)) return "In Progress";
  if (statuses.some((s) => s === "Ready for Review")) return "Ready for Review";
  return "Approved";
}

/** Swap server copies into the list by id. */
function replaceRows(list, fresh) {
  const byId = new Map(fresh.filter(Boolean).map((r) => [String(r.id), r]));
  if (byId.size === 0) return list;
  return list.map((r) => byId.get(String(r.id)) || r);
}

/**
 * Payroll for one month at a time, straight from `/hrms/payroll/`.
 *
 * Every number on a payslip (attended days, paid leave, LOP, earned, net) is
 * computed by the server from attendance and approved leave — this store
 * never recomputes pay. It only asks the server to (re)generate a month,
 * adjust a payslip's earnings/deductions/advance, approve it, or mark it paid,
 * and swaps the server's answer in.
 */
const usePayrollStoreBase = create((set, get) => ({
  /** The selected month's payslips. */
  employees: [],
  structures: [],
  /** Selected month, `YYYY-MM`. */
  period: currentPayrollPeriod(),
  loading: false,
  loaded: false,
  error: null,
  generating: false,
  /** `{ label, done, total }` while a bulk approve / pay runs. */
  bulk: null,
  defaultWorkingDays: 24,
  departmentWorkingDays: DEFAULT_DEPARTMENT_WORKING_DAYS,
  departmentWorkingHours: DEFAULT_DEPARTMENT_WORKING_HOURS,

  /** Load the selected month's payslips, the salary structures and the working-day setup. */
  hydrate: async () => {
    const period = get().period;
    set({ loading: true, error: null });
    const [rows, structures, settings] = await Promise.all([
      pullPayrollPeriod(period),
      pullTracked("salaryStructures"),
      pullWorkingDays(),
    ]);
    // The month changed while this was in flight — its own pull will land.
    if (get().period !== period) return rows;
    set((s) => ({
      employees: rows || [],
      loading: false,
      loaded: true,
      error: rows ? null : "Payroll could not be loaded.",
      structures: structures || s.structures,
      defaultWorkingDays: settings?.defaultWorkingDays ?? s.defaultWorkingDays,
      departmentWorkingDays: settings?.departmentWorkingDays ?? s.departmentWorkingDays,
      departmentWorkingHours: settings?.departmentWorkingHours ?? s.departmentWorkingHours,
    }));
    return rows;
  },

  /** Re-read only the selected month's payslips. */
  reloadPeriod: async () => {
    const period = get().period;
    set({ loading: true, error: null });
    const rows = await pullPayrollPeriod(period);
    if (get().period !== period) return rows;
    set({
      employees: rows || [],
      loading: false,
      loaded: true,
      error: rows ? null : "Payroll could not be loaded.",
    });
    return rows;
  },

  /** Switch month (`YYYY-MM`) and load it. */
  setPeriod: (period) => {
    if (!period || period === get().period) return Promise.resolve(get().employees);
    set({ period, employees: [], loaded: false });
    return get().reloadPeriod();
  },

  /**
   * (Re)generate every employee's payslip for the selected month from its
   * attendance and approved leave. Adjustments are kept; Approved/Paid
   * payslips are left as they are. Throws the server's error.
   */
  generate: async () => {
    const period = get().period;
    set({ generating: true });
    try {
      const result = await processPayroll({ month: `${period}-01` });
      await get().reloadPeriod();
      return result;
    } finally {
      set({ generating: false });
    }
  },

  /** Change additional earnings / deductions / advance; the server recomputes the payslip. */
  adjust: async (id, { additionalEarnings, deductions, advance } = {}) => {
    const row = await hrmsSync.update("payroll", id, { additionalEarnings, deductions, advance });
    if (row && row.id) set((s) => ({ employees: replaceRows(s.employees, [row]) }));
    return row;
  },

  approve: async (id) => {
    const row = await approvePayroll(id);
    if (row && row.id) set((s) => ({ employees: replaceRows(s.employees, [row]) }));
    return row;
  },

  markPaid: async (id, paymentDate = localISODate()) => {
    const row = await markPayrollPaid(id, { paymentDate });
    if (row && row.id) set((s) => ({ employees: replaceRows(s.employees, [row]) }));
    return row;
  },

  /**
   * Run `action` over `ids` one at a time (approval posts to accounts, so
   * they are not fired in parallel). Returns `{ done, failed: [{id, name, error}] }`.
   */
  runBulk: async (label, ids, action) => {
    const list = (ids || []).filter(Boolean);
    const failed = [];
    let done = 0;
    set({ bulk: { label, done: 0, total: list.length } });
    try {
      for (const id of list) {
        try {
          await action(id);
          done += 1;
        } catch (err) {
          const row = get().employees.find((r) => String(r.id) === String(id));
          failed.push({ id, name: row?.name || String(id), error: describeError(err) });
        }
        set({ bulk: { label, done: done + failed.length, total: list.length } });
      }
    } finally {
      set({ bulk: null });
    }
    return { done, failed };
  },

  approveAll: (ids) => get().runBulk("Approving", ids, (id) => get().approve(id)),

  markAllPaid: (ids, paymentDate = localISODate()) =>
    get().runBulk("Marking paid", ids, (id) => get().markPaid(id, paymentDate)),

  /**
   * The signed-in user's own payslips, for the "My Salary" tab. Filled by
   * `loadOwnHistory` once the session knows which employee they are.
   */
  ownHistory: [],

  loadOwnHistory: async (employeeId) => {
    if (!employeeId) return [];
    const rows = (await pullPayrollFor(employeeId)) || [];
    set({ ownHistory: rows });
    return rows;
  },

  /** Empty on sign-out so the next user sees nothing of the previous one. */
  clear: () =>
    set({
      employees: [],
      structures: [],
      ownHistory: [],
      loaded: false,
      error: null,
      bulk: null,
      period: currentPayrollPeriod(),
    }),

  // ── Department working-day display config (HR Admin) ──────────────────────
  // The server derives each payslip's working days from its working-day
  // calendar; these maps are a tenant setting shown on screen and never
  // change a payslip's numbers here.

  setDepartmentWorkingDays: (deptName, days) => {
    const d = Math.max(1, Math.min(31, Number(days) || 24));
    const currentMap = get().departmentWorkingDays || DEFAULT_DEPARTMENT_WORKING_DAYS;
    set({ departmentWorkingDays: { ...currentMap, [deptName]: d } });
    get().persistWorkingDays();
  },

  setDepartmentWorkingHours: (deptName, hours) => {
    const h = Math.max(1, Math.min(24, Number(hours) || 8));
    const currentMap = get().departmentWorkingHours || DEFAULT_DEPARTMENT_WORKING_HOURS;
    set({ departmentWorkingHours: { ...currentMap, [deptName]: h } });
    get().persistWorkingDays();
  },

  resetDepartmentWorkingDays: () => {
    set({
      departmentWorkingDays: { ...DEFAULT_DEPARTMENT_WORKING_DAYS },
      departmentWorkingHours: { ...DEFAULT_DEPARTMENT_WORKING_HOURS },
    });
    get().persistWorkingDays();
  },

  setDefaultWorkingDays: (days) => {
    set({ defaultWorkingDays: Math.max(1, Number(days) || 24) });
    get().persistWorkingDays();
  },

  addStructure: (newStruct) => {
    const next = [
      ...get().structures,
      {
        id: Date.now(),
        status: "Active",
        ...newStruct,
      },
    ];
    set({ structures: next });
    writeThrough("salaryStructures", next).then((rows) => {
      if (Array.isArray(rows)) set({ structures: rows });
    });
  },

  persistWorkingDays: () => {
    pushWorkingDays({
      defaultWorkingDays: get().defaultWorkingDays,
      departmentWorkingDays: get().departmentWorkingDays,
      departmentWorkingHours: get().departmentWorkingHours,
    }).catch((err) => console.warn("[HRMS] working days not saved:", err?.message || err));
  },

  /** Kept for callers of the old API: saves the working-day setup only. */
  persist: () => get().persistWorkingDays(),

  /** Discard anything local and re-read payroll from the server. */
  resetDefaults: () => usePayrollStore.getState().hydrate(),
}));

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const usePayrollStore = lazyStore(usePayrollStoreBase, "payroll");
