import { create } from "zustand";
import { lazyStoreForKeys } from "../services/lazyModules";
import { hrmsSync } from "../services/hrmsSync";
import * as hrmsApi from "../services/hrmsSync";
import { loadBranding, saveBranding, applyBranding, EMPTY_BRANDING } from "../utils/branding";

/** Local placeholder id for an optimistic row, replaced by the server's. */
function tempId(prefix) {
  return `${prefix}-local-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}
const THEME_KEY = "evenmore_theme";
const HRMS_MODULES_KEY = "evenmore_hrms_modules";

function loadModuleFlags() {
  try {
    const saved = JSON.parse(localStorage.getItem(HRMS_MODULES_KEY) || "{}");
    return {
      recruitmentEnabled: saved.recruitmentEnabled !== false,
      trainingEnabled: false, // Training feature commented out
    };
  } catch {}
  return { recruitmentEnabled: true, trainingEnabled: false };
}

function saveModuleFlags(recruitmentEnabled, trainingEnabled) {
  try {
    localStorage.setItem(
      HRMS_MODULES_KEY,
      JSON.stringify({ recruitmentEnabled, trainingEnabled })
    );
  } catch {}
}

const initialModuleFlags = loadModuleFlags();

function applyThemeAttributes(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (theme !== "light" && theme !== "oscar") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && ["light", "dark", "midnight", "emerald", "oscar"].includes(saved)) {
      // "light" was the previous default — move those users to the new
      // Oscar textile sidebar theme; explicit dark/midnight/emerald stay.
      const next = saved === "light" ? "oscar" : saved;
      applyThemeAttributes(next);
      return next;
    }
  } catch {}
  applyThemeAttributes("oscar");
  return "oscar";
}

function loadAndApplyBranding() {
  const branding = loadBranding();
  try { applyBranding(branding); } catch {}
  return branding;
}

const useAppStoreBase = create((set) => ({
  // Theme state
  theme: loadTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
      applyThemeAttributes(theme);
    } catch {}
    set({ theme });
  },

  // Custom branding (logo + brand colour), see utils/branding.js
  branding: loadAndApplyBranding(),
  setBranding: (branding) => {
    const next = { ...EMPTY_BRANDING, ...branding };
    saveBranding(next);
    try { applyBranding(next); } catch {}
    set({ branding: next });
  },
  resetBranding: () => {
    saveBranding(EMPTY_BRANDING);
    try { applyBranding(EMPTY_BRANDING); } catch {}
    set({ branding: { ...EMPTY_BRANDING } });
  },

  // Layout & Global App State
  // Filled by SessionGate from /auth/me/ — null until the server answers, so
  // nothing on screen can claim to be a user who is not signed in.
  currentUser: null,
  setCurrentUser: (currentUser) => set({ currentUser }),

  // The permission codes the token carries (api.md §2). Screens gate on these
  // rather than on a role label.
  permissions: [],
  setPermissions: (permissions) => set({ permissions: permissions || [] }),
  hasPermission: (code) => {
    if (!code) return true;
    const granted = useAppStore.getState().permissions || [];
    return granted.includes(code);
  },
  globalSearch: "",
  setGlobalSearch: (globalSearch) => set({ globalSearch }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  sidebarWidth: 280,
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
  // Off-canvas navigation drawer below the `lg` breakpoint.
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
  toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),

  // ── HRMS data ─────────────────────────────────────────────────────────────
  //
  // Filled by `hydrateHrms()` from the API. Every mutator writes through to the
  // server and keeps its optimistic row only until the answer comes back; a
  // rejection rolls it back, so nothing on screen is a change that was refused.
  employees: [],
  leaves: [],
  attendance: [],
  candidates: [],
  encashments: [],
  compOffCredits: [],
  sandwichRuleEnabled: true,
  maxCarryForwardDays: 12,
  recruitmentEnabled: initialModuleFlags.recruitmentEnabled,
  trainingEnabled: initialModuleFlags.trainingEnabled,
  carriedForwardLeaves: {},
  hrmsStatus: { loading: false, loaded: false, error: null },

  toast: null,
  showBanner: true,
  setBanner: (showBanner) => set({ showBanner }),

  /** Load the HRMS collections the shared screens read. */
  hydrateHrms: async ({ force = false } = {}) => {
    const state = useAppStore.getState();
    if (!hrmsApi.isBackendEnabled()) {
      set({
        employees: [], leaves: [], attendance: [], candidates: [],
        encashments: [], compOffCredits: [], carriedForwardLeaves: {},
        hrmsStatus: { loading: false, loaded: false, error: null },
      });
      return null;
    }
    if (state.hrmsStatus.loading) return null;
    if (state.hrmsStatus.loaded && !force) return null;

    set((s) => ({ hrmsStatus: { ...s.hrmsStatus, loading: true, error: null } }));
    try {
      const [core, balances, settings] = await Promise.all([
        hrmsSync.pullMany(["employees", "leaves", "attendance",
          "leaveEncashments", "compOffs"]),
        hrmsApi.pullLeaveBalances(),
        hrmsApi.pullHrmsSettings(),
      ]);
      set((s) => ({
        employees: core.employees ?? s.employees,
        leaves: core.leaves ?? s.leaves,
        attendance: core.attendance ?? s.attendance,
        candidates: core.candidates ?? s.candidates,
        encashments: core.leaveEncashments ?? s.encashments,
        compOffCredits: core.compOffs ?? s.compOffCredits,
        carriedForwardLeaves: balances?.carriedForward || s.carriedForwardLeaves,
        sandwichRuleEnabled: settings?.sandwichRuleEnabled ?? s.sandwichRuleEnabled,
        maxCarryForwardDays: settings?.maxCarryForwardDays ?? s.maxCarryForwardDays,
        recruitmentEnabled: settings?.recruitmentEnabled ?? s.recruitmentEnabled,
        trainingEnabled: settings?.trainingEnabled ?? s.trainingEnabled,
        hrmsStatus: { loading: false, loaded: true, error: null },
      }));
      // Keep the sidebar toggles in sync for the next reload (offline-safe).
      try {
        const st = useAppStore.getState();
        saveModuleFlags(st.recruitmentEnabled, st.trainingEnabled);
      } catch {}
      return true;
    } catch (err) {
      set((s) => ({
        hrmsStatus: { ...s.hrmsStatus, loading: false, error: hrmsApi.describeError(err) },
      }));
      return null;
    }
  },

  clearHrms: () => set({
    employees: [], leaves: [], attendance: [], candidates: [],
    encashments: [], compOffCredits: [], carriedForwardLeaves: {},
    hrmsStatus: { loading: false, loaded: false, error: null },
  }),

  refreshHrms: async (key, stateKey) => {
    const rows = await hrmsSync.pull(key);
    if (rows) set({ [stateKey || key]: rows });
    return rows;
  },

  // ── employees ─────────────────────────────────────────────────────────────

  addEmployee: (employee) => {
    const optimistic = { ...employee, id: employee.id || tempId("emp"), _pending: true };
    set((s) => ({ employees: [optimistic, ...s.employees] }));
    return hrmsSync.create("employees", employee)
      .then((saved) => {
        // Backend disabled → keep the local row so the directory still works offline.
        if (!saved && !hrmsApi.isBackendEnabled()) {
          set((s) => ({
            employees: s.employees.map((e) => (e.id === optimistic.id ? { ...e, _pending: false } : e)),
          }));
          return optimistic;
        }
        set((s) => ({
          employees: saved
            ? s.employees.map((e) => (e.id === optimistic.id ? saved : e))
            : s.employees.filter((e) => e.id !== optimistic.id),
        }));
        return saved;
      })
      .catch((err) => {
        set((s) => ({ employees: s.employees.filter((e) => e.id !== optimistic.id) }));
        useAppStore.getState().showToast(`Employee not saved — ${hrmsApi.describeError(err)}`);
        throw err;
      });
  },

  deleteEmployee: (id) => {
    const previous = useAppStore.getState().employees;
    const idStr = String(id);
    const target = previous.find((x) => String(x.id) === idStr);
    // Resolve the server id: the table passes the UUID, but older rows may
    // only carry `empId`/`employeeCode`. Sending `EMP0002` would 404 while
    // the row looks deleted locally, so fall back to the row's real id.
    const serverId = target?.id ?? id;
    set({ employees: previous.filter((x) => String(x.id) !== idStr) });
    return hrmsSync.remove("employees", serverId)
      .then((result) => {
        // `null` = local-only row or backend disabled — local removal is the delete.
        return true;
      })
      .catch((err) => {
        set({ employees: previous });
        const reason = hrmsApi.describeError(err);
        useAppStore.getState().showToast(`Employee not deleted — ${reason}`);
        throw err;
      });
  },

  updateEmployee: (id, updates) => {
    const previous = useAppStore.getState().employees;
    set({ employees: previous.map((x) => (x.id === id || x.name === id ? { ...x, ...updates } : x)) });
    const target = previous.find((x) => x.id === id || x.name === id);
    if (!target?.id) return Promise.resolve(null);
    return hrmsSync.update("employees", target.id, updates)
      .then((saved) => {
        if (saved) set((s) => ({ employees: s.employees.map((x) => (x.id === saved.id ? saved : x)) }));
        return saved;
      })
      .catch((err) => {
        set({ employees: previous });
        useAppStore.getState().showToast(`Change not saved — ${hrmsApi.describeError(err)}`);
      });
  },

  updateEmployeeStatus: (idOrName, status) =>
    useAppStore.getState().updateEmployee(idOrName, { status }),

  // ── leave ─────────────────────────────────────────────────────────────────

  addLeave: (leave) => {
    const optimistic = { ...leave, id: leave.id || tempId("lv"), _pending: true };
    set((s) => ({ leaves: [optimistic, ...s.leaves] }));
    return hrmsSync.create("leaves", leave)
      .then((saved) => {
        set((s) => ({
          leaves: saved
            ? s.leaves.map((l) => (l.id === optimistic.id ? saved : l))
            : s.leaves.filter((l) => l.id !== optimistic.id),
        }));
        return saved;
      })
      .catch((err) => {
        set((s) => ({ leaves: s.leaves.filter((l) => l.id !== optimistic.id) }));
        useAppStore.getState().showToast(`Leave not submitted — ${hrmsApi.describeError(err)}`, "error");
        throw err;
      });
  },

  updateLeaveStatus: (id, status, extra = {}) => {
    const previous = useAppStore.getState().leaves;
    set({ leaves: previous.map((x) => (x.id === id ? { ...x, status, ...extra } : x)) });
    return hrmsSync.update("leaves", id, { status, ...extra })
      .then((saved) => {
        if (saved) set((s) => ({ leaves: s.leaves.map((l) => (l.id === id ? saved : l)) }));
        return saved;
      })
      .catch((err) => {
        set({ leaves: previous });
        useAppStore.getState().showToast(`Leave not updated — ${hrmsApi.describeError(err)}`, "error");
        return null;
      });
  },

  approveLeave: (id, delegate) =>
    useAppStore.getState().updateLeaveStatus(id, "Approved", { delegate }),

  rejectLeave: (id, reason = "") =>
    useAppStore.getState().updateLeaveStatus(id, "Rejected", { rejectReason: reason }),

  // ── attendance ────────────────────────────────────────────────────────────

  addAttendance: (record) => {
    const optimistic = { ...record, id: record.id || tempId("att"), _pending: true };
    set((s) => ({ attendance: [optimistic, ...s.attendance] }));
    return hrmsSync.create("attendance", record)
      .then((saved) => {
        set((s) => ({
          attendance: saved
            ? s.attendance.map((a) => (a.id === optimistic.id ? saved : a))
            : s.attendance.filter((a) => a.id !== optimistic.id),
        }));
        return saved;
      })
      .catch((err) => {
        set((s) => ({ attendance: s.attendance.filter((a) => a.id !== optimistic.id) }));
        useAppStore.getState().showToast(`Attendance not saved — ${hrmsApi.describeError(err)}`);
      });
  },

  // ── recruitment ───────────────────────────────────────────────────────────

  moveCandidate: (id, stage) => {
    const previous = useAppStore.getState().candidates;
    set({ candidates: previous.map((c) => (c.id === id ? { ...c, stage } : c)) });
    return hrmsSync.update("candidates", id, { stage }).catch((err) => {
      set({ candidates: previous });
      useAppStore.getState().showToast(`Candidate not moved — ${hrmsApi.describeError(err)}`);
    });
  },

  // ── leave encashment ──────────────────────────────────────────────────────

  requestEncashment: (request) => {
    const optimistic = { ...request, id: tempId("enc"), status: "Pending", _pending: true };
    set((s) => ({ encashments: [optimistic, ...s.encashments] }));
    return hrmsSync.create("leaveEncashments", request)
      .then((saved) => {
        set((s) => ({
          encashments: saved
            ? s.encashments.map((e) => (e.id === optimistic.id ? saved : e))
            : s.encashments.filter((e) => e.id !== optimistic.id),
        }));
        return saved;
      })
      .catch((err) => {
        set((s) => ({ encashments: s.encashments.filter((e) => e.id !== optimistic.id) }));
        useAppStore.getState().showToast(`Request not sent — ${hrmsApi.describeError(err)}`);
      });
  },

  setEncashmentStatus: (id, status, extra = {}) => {
    const previous = useAppStore.getState().encashments;
    set({ encashments: previous.map((e) => (e.id === id ? { ...e, status, ...extra } : e)) });
    return hrmsSync.update("leaveEncashments", id, { status, ...extra }).catch((err) => {
      set({ encashments: previous });
      useAppStore.getState().showToast(`Not updated — ${hrmsApi.describeError(err)}`);
    });
  },

  approveEncashment: (id) => useAppStore.getState().setEncashmentStatus(id, "Approved"),
  rejectEncashment: (id, reason = "") =>
    useAppStore.getState().setEncashmentStatus(id, "Rejected", { rejectReason: reason }),

  // ── comp-off ──────────────────────────────────────────────────────────────

  requestCompOff: (claim) => {
    const optimistic = { ...claim, id: tempId("cmp"), status: "Pending", used: false, _pending: true };
    set((s) => ({ compOffCredits: [optimistic, ...s.compOffCredits] }));
    return hrmsSync.create("compOffs", claim)
      .then((saved) => {
        set((s) => ({
          compOffCredits: saved
            ? s.compOffCredits.map((c) => (c.id === optimistic.id ? saved : c))
            : s.compOffCredits.filter((c) => c.id !== optimistic.id),
        }));
        return saved;
      })
      .catch((err) => {
        set((s) => ({ compOffCredits: s.compOffCredits.filter((c) => c.id !== optimistic.id) }));
        useAppStore.getState().showToast(`Claim not sent — ${hrmsApi.describeError(err)}`);
      });
  },

  setCompOffStatus: (id, status, extra = {}) => {
    const previous = useAppStore.getState().compOffCredits;
    set({ compOffCredits: previous.map((c) => (c.id === id ? { ...c, status, ...extra } : c)) });
    return hrmsSync.update("compOffs", id, { status, ...extra }).catch((err) => {
      set({ compOffCredits: previous });
      useAppStore.getState().showToast(`Not updated — ${hrmsApi.describeError(err)}`);
    });
  },

  approveCompOff: (id) => useAppStore.getState().setCompOffStatus(id, "Approved"),
  rejectCompOff: (id, reason = "") =>
    useAppStore.getState().setCompOffStatus(id, "Rejected", { rejectReason: reason }),

  // ── leave policy ──────────────────────────────────────────────────────────
  //
  // Tenant settings, so they live in `/hrms/settings/`; the carry-forward run
  // itself is the server's, because it rewrites every employee's balance.

  toggleSandwichRule: (val) => {
    const previous = useAppStore.getState().sandwichRuleEnabled;
    const sandwichRuleEnabled = typeof val === "boolean" ? val : !previous;
    set({ sandwichRuleEnabled });
    hrmsApi.pushHrmsSettings({
      sandwichRuleEnabled,
      maxCarryForwardDays: useAppStore.getState().maxCarryForwardDays,
      recruitmentEnabled: useAppStore.getState().recruitmentEnabled,
      trainingEnabled: useAppStore.getState().trainingEnabled,
    }).catch((err) => {
      set({ sandwichRuleEnabled: previous });
      useAppStore.getState().showToast(`Setting not saved — ${hrmsApi.describeError(err)}`);
    });
  },

  setMaxCarryForwardDays: (days) => {
    const previous = useAppStore.getState().maxCarryForwardDays;
    const maxCarryForwardDays = Number(days) || previous;
    set({ maxCarryForwardDays });
    hrmsApi.pushHrmsSettings({
      sandwichRuleEnabled: useAppStore.getState().sandwichRuleEnabled,
      maxCarryForwardDays,
      recruitmentEnabled: useAppStore.getState().recruitmentEnabled,
      trainingEnabled: useAppStore.getState().trainingEnabled,
    }).catch((err) => {
      set({ maxCarryForwardDays: previous });
      useAppStore.getState().showToast(`Setting not saved — ${hrmsApi.describeError(err)}`);
    });
  },

  // ── HRMS module toggles (Recruitment / Training) ──────────────────────
  // Persisted in localStorage for instant sidebar updates and synced to
  // `/hrms/settings/` so every device for the tenant sees the same modules.
  setRecruitmentEnabled: (val) => {
    const previous = useAppStore.getState().recruitmentEnabled;
    const recruitmentEnabled = typeof val === "boolean" ? val : !previous;
    set({ recruitmentEnabled });
    saveModuleFlags(recruitmentEnabled, useAppStore.getState().trainingEnabled);
    hrmsApi.pushHrmsSettings({
      sandwichRuleEnabled: useAppStore.getState().sandwichRuleEnabled,
      maxCarryForwardDays: useAppStore.getState().maxCarryForwardDays,
      recruitmentEnabled,
      trainingEnabled: useAppStore.getState().trainingEnabled,
    }).catch((err) => {
      set({ recruitmentEnabled: previous });
      useAppStore.getState().showToast(`Setting not saved — ${hrmsApi.describeError(err)}`);
    });
  },

  setTrainingEnabled: (val) => {
    const previous = useAppStore.getState().trainingEnabled;
    const trainingEnabled = typeof val === "boolean" ? val : !previous;
    set({ trainingEnabled });
    saveModuleFlags(useAppStore.getState().recruitmentEnabled, trainingEnabled);
    hrmsApi.pushHrmsSettings({
      sandwichRuleEnabled: useAppStore.getState().sandwichRuleEnabled,
      maxCarryForwardDays: useAppStore.getState().maxCarryForwardDays,
      recruitmentEnabled: useAppStore.getState().recruitmentEnabled,
      trainingEnabled,
    }).catch((err) => {
      set({ trainingEnabled: previous });
      useAppStore.getState().showToast(`Setting not saved — ${hrmsApi.describeError(err)}`);
    });
  },

  executeCarryForwardRollover: async () => {
    const balances = await hrmsApi.pullLeaveBalances({ recalculate: true });
    if (balances?.carriedForward) set({ carriedForwardLeaves: balances.carriedForward });
    return balances;
  },

  showToast: (msg) => set({ toast: { id: Date.now().toString(), msg } }),
  setToast: (msg) => set({ toast: { id: Date.now().toString(), msg } }),
  clearToast: () => set({ toast: null }),
}));

/**
 * The HRMS slice of this store — everything `hydrateHrms()` fills, plus the
 * actions that write to it.
 *
 * `appStore` is read by every screen for the theme, the toast and the sidebar,
 * so it cannot pull the HRMS collections just because it was touched. These
 * keys are what marks a read as an HRMS read; see `services/lazyModules`.
 */
const HRMS_KEYS = [
  "employees", "leaves", "attendance", "candidates", "encashments",
  "compOffCredits", "carriedForwardLeaves", "sandwichRuleEnabled",
  "maxCarryForwardDays", "recruitmentEnabled", "trainingEnabled", "hrmsStatus",
  "hydrateHrms", "refreshHrms", "addEmployee", "deleteEmployee", "updateEmployee",
  "updateEmployeeStatus", "addLeave", "updateLeaveStatus", "approveLeave",
  "rejectLeave", "addAttendance", "moveCandidate", "requestEncashment",
  "setEncashmentStatus", "approveEncashment", "rejectEncashment",
  "requestCompOff", "setCompOffStatus", "approveCompOff", "rejectCompOff",
  "toggleSandwichRule", "setMaxCarryForwardDays", "setRecruitmentEnabled",
  "setTrainingEnabled", "executeCarryForwardRollover",
];

// Reading any of those is what loads HRMS; reading the theme is not.
export const useAppStore = lazyStoreForKeys(
  useAppStoreBase,
  "hrms",
  HRMS_KEYS,
  () => useAppStoreBase.getState().hydrateHrms?.(),
);
