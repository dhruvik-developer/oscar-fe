import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import { writeThrough, pullTracked, hrmsSync, isBackendEnabled, isServerId } from "../services/hrmsSync";
import { RATING_SCALES } from "../services/performanceScales";
import { useAppStore } from "./appStore";




export function calculateWeightedScore(kpiResults, defaultRating = 4.0) {
  if (!kpiResults || kpiResults.length === 0) {
    return {
      weightedScore: Math.round((defaultRating / 5) * 100),
      overallRating: defaultRating,
    };
  }
  const totalWeight = kpiResults.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  if (totalWeight === 0) {
    return {
      weightedScore: Math.round((defaultRating / 5) * 100),
      overallRating: defaultRating,
    };
  }
  const weightedSum = kpiResults.reduce((sum, item) => {
    const r = Number(item.score ?? item.rating ?? defaultRating);
    const w = Number(item.weight || 0);
    return sum + r * w;
  }, 0);
  const overallRating = Number((weightedSum / totalWeight).toFixed(1));
  const weightedScore = Math.min(100, Math.round((overallRating / 5) * 100));
  return { weightedScore, overallRating };
}

export function getRatingScaleTier(rating) {
  const r = Number(rating) || 0;
  for (const tier of RATING_SCALES) {
    if (r >= tier.minScore) return tier;
  }
  return RATING_SCALES[RATING_SCALES.length - 1];
}

const usePerformanceStoreBase = create((set, get) => ({
  /** Load this module's collections from the API. */
  hydrate: async () => {
    const rows = await Promise.all([
      pullTracked("cycles"),
      pullTracked("appraisals"),
      pullTracked("indicators"),
      pullTracked("kpis"),
    ]);
    set((s) => ({
      cycles: rows[0] || s.cycles,
      appraisals: rows[1] || s.appraisals,
      indicators: rows[2] || s.indicators,
      kpis: rows[3] || s.kpis,
    }));
    return rows;
  },

  /** Empty on sign-out so the next user sees nothing of the previous one. */
  clear: () => set({ cycles: [], appraisals: [], indicators: [], kpis: [] }),

  cycles: [],
  activeCycleId: "CYC-2024-Q4",
  appraisals: [],
  indicators: [],
  kpis: [],

  // Role Simulation ('HR' | 'Manager' | 'Employee')
  role: "HR",
  simulatedEmployeeName: "",
  simulatedManagerName: "",

  setRole: (role) => {
    set({ role });
    get().persist();
  },

  setSimulatedEmployee: (name) => {
    set({ simulatedEmployeeName: name });
    get().persist();
  },

  setSimulatedManager: (name) => {
    set({ simulatedManagerName: name });
    get().persist();
  },

  setActiveCycleId: (id) => {
    set({ activeCycleId: id });
    get().persist();
  },

  /**
   * Every action calls this after changing part of the state. Each collection
   * is written through to its own endpoint; `writeThrough` works out which rows
   * are new, changed or gone.
   */
  persist: () => {
    const s = get();
    writeThrough("cycles", s.cycles);
    writeThrough("appraisals", s.appraisals);
    writeThrough("indicators", s.indicators);
    writeThrough("kpis", s.kpis);
  },

  // ── Cycle Management ──────────────────────────────────────────
  addCycle: (cycle) => {
    const id = cycle.id || `CYC-${Date.now()}`;
    const newCycle = {
      ...cycle,
      id,
      status: cycle.status || "Active",
      appraisalCount: 0,
      completedCount: 0,
    };
    set((s) => ({ cycles: [newCycle, ...s.cycles] }));
    get().persist();
    return newCycle;
  },

  updateCycle: (id, patch) => {
    set((s) => ({
      cycles: s.cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    get().persist();
  },

  deleteCycle: (id) => {
    set((s) => ({
      cycles: s.cycles.filter((c) => c.id !== id),
    }));
    get().persist();
  },

  // ── KPI & Indicator Management ───────────────────────────────
  addIndicator: (ind) => {
    const id = ind.id || `IND-${String(get().indicators.length + 1).padStart(3, "0")}`;
    const created = {
      ...ind,
      id,
      rating: ind.rating ? Number(ind.rating) : 4.0,
      weight: Number(ind.weight) || 10,
      status: ind.status || "Active",
      createdAt: ind.createdAt || "Today",
      updatedAt: ind.updatedAt || "Today",
    };
    set((s) => ({ indicators: [created, ...s.indicators] }));
    get().persist();
    return created;
  },

  updateIndicator: (id, patch) => {
    set((s) => ({
      indicators: s.indicators.map((i) =>
        i.id === id
          ? {
              ...i,
              ...patch,
              weight: patch.weight !== undefined ? Number(patch.weight) : i.weight,
              rating: patch.rating !== undefined ? Number(patch.rating) : i.rating,
              updatedAt: "Just now",
            }
          : i
      ),
    }));
    get().persist();
  },

  deleteIndicator: (id) => {
    set((s) => ({ indicators: s.indicators.filter((i) => i.id !== id) }));
    get().persist();
  },

  addKpi: (kpi) => {
    const id = kpi.id || `KPI-${get().kpis.length + 101}`;
    const created = {
      ...kpi,
      id,
      weight: Number(kpi.weight) || 10,
      status: kpi.status || "Active",
      createdAt: kpi.createdAt || "Today",
    };
    set((s) => ({ kpis: [created, ...s.kpis] }));
    get().persist();
    return created;
  },

  updateKpi: (id, patch) => {
    set((s) => ({
      kpis: s.kpis.map((k) =>
        k.id === id
          ? {
              ...k,
              ...patch,
              weight: patch.weight !== undefined ? Number(patch.weight) : k.weight,
            }
          : k
      ),
    }));
    get().persist();
  },

  deleteKpi: (id) => {
    set((s) => ({ kpis: s.kpis.filter((k) => k.id !== id) }));
    get().persist();
  },

  // ── Appraisal Workflow Actions ────────────────────────────────
  addAppraisal: (appraisal) => {
    const id = appraisal.id || `APR-${String(get().appraisals.length + 1).padStart(3, "0")}`;
    const initialRating = Number(appraisal.rating) || 4.0;
    const tier = getRatingScaleTier(initialRating);
    const newAppr = {
      id,
      avatar: appraisal.avatar || "https://i.pravatar.cc/100?img=15",
      employee: appraisal.employee,
      cycle: appraisal.cycle || "Q4 2024",
      cycleId: appraisal.cycleId || "CYC-2024-Q4",
      reviewer: appraisal.reviewer,
      department: appraisal.department || "Engineering",
      designation: appraisal.designation || "Senior Specialist",
      rating: initialRating,
      ratingScaleLabel: tier.label,
      weightedScore: Math.round((initialRating / 5) * 100),
      stage: appraisal.stage || "Self Review",
      status: appraisal.status || "Pending",
      due: appraisal.due || "15 Nov 2024",
      selfReview: appraisal.selfReview || {
        rating: initialRating,
        comments: "",
        strengths: "",
        areasForImprovement: "",
        completedAt: null,
        submitted: false,
      },
      managerReview: appraisal.managerReview || {
        rating: initialRating,
        comments: "",
        strengths: "",
        areasForImprovement: "",
        developmentFeedback: "",
        reviewedAt: null,
        submitted: false,
      },
      hrReview: appraisal.hrReview || {
        comments: "",
        approved: false,
        approvedAt: null,
        status: "Pending",
      },
      history: [
        {
          stage: "Draft",
          action: "Appraisal Created",
          actor: "HR Admin",
          date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          note: "Appraisal initiated for " + (appraisal.cycle || "Q4 2024"),
        },
      ],
      kpiResults: appraisal.kpiResults || [
        { name: "Technical / Execution Quality", target: "≥ 95%", actual: "96%", weight: 50, score: initialRating },
        { name: "Team Leadership & SLA Adherence", target: "100%", actual: "98%", weight: 50, score: initialRating },
      ],
    };

    set((s) => ({ appraisals: [newAppr, ...s.appraisals] }));
    get().persist();
    return newAppr;
  },

  updateAppraisal: (id, patch) => {
    set((s) => ({
      appraisals: s.appraisals.map((a) => {
        if (a.id !== id) return a;
        const merged = { ...a, ...patch };
        if (patch.rating !== undefined) {
          const tier = getRatingScaleTier(patch.rating);
          merged.ratingScaleLabel = tier.label;
          merged.weightedScore = Math.round((patch.rating / 5) * 100);
        }
        return merged;
      }),
    }));
    get().persist();
  },

  deleteAppraisal: (id) => {
    set((s) => ({ appraisals: s.appraisals.filter((a) => a.id !== id) }));
    get().persist();
  },

  // 1. Submit Self Review (Employee -> Manager Review)
  submitSelfReview: (id, { rating, comments, strengths, areasForImprovement }) => {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const target = get().appraisals.find((a) => a.id === id);
    if (!target) return;

    const selfRating = Number(rating) || target.rating || 4.0;
    const tier = getRatingScaleTier(selfRating);

    const updated = {
      ...target,
      rating: selfRating,
      ratingScaleLabel: tier.label,
      weightedScore: Math.round((selfRating / 5) * 100),
      stage: "Manager Review",
      status: "Submitted",
      selfReview: {
        ...target.selfReview,
        rating: selfRating,
        comments,
        strengths,
        areasForImprovement,
        completedAt: today,
        submitted: true,
      },
      history: [
        {
          stage: "Self Review",
          action: "Self Review Submitted",
          actor: target.employee,
          date: today,
          note: `Self evaluation score: ${selfRating} / 5.0. Advanced to Manager Review.`,
        },
        ...(target.history || []),
      ],
    };

    set((s) => ({
      appraisals: s.appraisals.map((a) => (a.id === id ? updated : a)),
    }));
    get().persist();
  },

  // 2. Submit Manager Review (Manager -> HR Review OR return to Employee)
  submitManagerReview: (id, { rating, comments, strengths, areasForImprovement, developmentFeedback, kpiScores }) => {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const target = get().appraisals.find((a) => a.id === id);
    if (!target) return;

    let updatedKpiResults = target.kpiResults || [];
    if (kpiScores && Array.isArray(kpiScores)) {
      updatedKpiResults = updatedKpiResults.map((kpi, idx) => ({
        ...kpi,
        score: kpiScores[idx] !== undefined ? Number(kpiScores[idx]) : kpi.score,
      }));
    }

    const { weightedScore, overallRating } = calculateWeightedScore(
      updatedKpiResults,
      rating ? Number(rating) : target.rating
    );
    const tier = getRatingScaleTier(overallRating);

    const updated = {
      ...target,
      rating: overallRating,
      ratingScaleLabel: tier.label,
      weightedScore,
      kpiResults: updatedKpiResults,
      stage: "HR Review",
      status: "In Progress",
      managerReview: {
        ...target.managerReview,
        rating: Number(rating) || overallRating,
        comments,
        strengths,
        areasForImprovement,
        developmentFeedback,
        reviewedAt: today,
        submitted: true,
      },
      history: [
        {
          stage: "Manager Review",
          action: "Manager Review Submitted",
          actor: target.reviewer || "Manager",
          date: today,
          note: `Manager rated: ${overallRating} / 5.0 (${tier.label}). Submitted to HR Review.`,
        },
        ...(target.history || []),
      ],
    };

    set((s) => ({
      appraisals: s.appraisals.map((a) => (a.id === id ? updated : a)),
    }));
    get().persist();
  },

  // Return Appraisal to previous stage (Manager -> Employee OR HR -> Manager)
  returnAppraisal: (id, returnToStage, reason) => {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const target = get().appraisals.find((a) => a.id === id);
    if (!target) return;

    const actor = get().role === "HR" ? "HR Admin" : target.reviewer || "Manager";

    const updated = {
      ...target,
      stage: returnToStage,
      status: "Returned",
      history: [
        {
          stage: target.stage,
          action: `Returned to ${returnToStage}`,
          actor,
          date: today,
          note: `Revision requested: "${reason || "Please adjust scores and comments"}"`,
        },
        ...(target.history || []),
      ],
    };

    set((s) => ({
      appraisals: s.appraisals.map((a) => (a.id === id ? updated : a)),
    }));
    get().persist();
  },

  // 3. HR Review & Approval
  approveAppraisal: (id, hrComments) => {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const target = get().appraisals.find((a) => a.id === id);
    if (!target) return;

    const updated = {
      ...target,
      stage: "Finalization",
      status: "Approved",
      hrReview: {
        ...target.hrReview,
        comments: hrComments || "Calibrated and approved by HR Admin.",
        approved: true,
        approvedAt: today,
        status: "Approved",
      },
      history: [
        {
          stage: "HR Review",
          action: "Approved by HR Admin",
          actor: "HR Admin",
          date: today,
          note: hrComments || "Performance calibrated across department. Approved for finalization.",
        },
        ...(target.history || []),
      ],
    };

    set((s) => ({
      appraisals: s.appraisals.map((a) => (a.id === id ? updated : a)),
    }));
    get().persist();
  },

  // 4. Finalize & Sync to Profile
  finalizeAppraisal: (id) => {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const target = get().appraisals.find((a) => a.id === id);
    if (!target) return;

    const updated = {
      ...target,
      stage: "Finalization",
      status: "Completed",
      history: [
        {
          stage: "Finalization",
          action: "Finalized & Rating Synced",
          actor: "HR Admin",
          date: today,
          note: `Final rating of ${target.rating.toFixed(1)}/5 (${target.ratingScaleLabel}) locked & synced to employee profile.`,
        },
        ...(target.history || []),
      ],
    };

    set((s) => ({
      appraisals: s.appraisals.map((a) => (a.id === id ? updated : a)),
    }));
    get().persist();

    // Sync to employee record in global appStore
    try {
      const appStore = useAppStore.getState();
      const employees = appStore.employees || [];
      const emp = employees.find((e) => String(e.name ?? '').toLowerCase() === String(target.employee ?? '').toLowerCase());
      if (emp && appStore.updateEmployee) {
        appStore.updateEmployee(emp.id, {
          performanceRating: `${target.rating.toFixed(1)} / 5`,
        });
      }
    } catch (e) {
      console.warn("Could not sync to appStore employee profile", e);
    }
  },

  syncRatingToProfile: (id) => {
    const target = get().appraisals.find((a) => a.id === id);
    if (!target) return false;
    try {
      const appStore = useAppStore.getState();
      const employees = appStore.employees || [];
      const emp = employees.find((e) => String(e.name ?? '').toLowerCase() === String(target.employee ?? '').toLowerCase());
      if (emp && appStore.updateEmployee) {
        appStore.updateEmployee(emp.id, {
          performanceRating: `${target.rating.toFixed(1)} / 5`,
        });
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  },

  // ── Metrics Calculations ──────────────────────────────────────
  getMetrics: () => {
    const appraisals = get().appraisals;
    const cycles = get().cycles;
    const indicators = get().indicators;

    const activeCycle = cycles.find((c) => c.status === "Active") || cycles[0] || { name: "Q4 2024", reviewPeriod: "Oct - Dec" };
    const pendingReviews = appraisals.filter((a) => a.status === "Pending" || a.status === "In Progress" || a.status === "Submitted" || a.status === "Returned").length;
    const completedReviews = appraisals.filter((a) => a.status === "Completed").length;
    const overdueReviews = appraisals.filter((a) => a.status === "Overdue").length;

    const ratedAppraisals = appraisals.filter((a) => Number(a.rating) > 0);
    const avgRatingNum = ratedAppraisals.length
      ? ratedAppraisals.reduce((sum, a) => sum + Number(a.rating), 0) / ratedAppraisals.length
      : 4.2;
    const avgRating = `${avgRatingNum.toFixed(1)} / 5`;

    const activeIndicators = indicators.filter((i) => i.status === "Active");
    const indicatorCompletion = activeIndicators.length
      ? `${Math.round((activeIndicators.filter((i) => (Number(i.rating) || 0) >= 3.5).length / activeIndicators.length) * 100)}%`
      : "86%";

    return [
      { label: "Active Cycle", value: activeCycle.name.replace("Performance Cycle", "").replace("Appraisal Cycle", "").trim(), sub: activeCycle.reviewPeriod || "Oct – Dec 2024" },
      { label: "Pending Reviews", value: String(pendingReviews), sub: "Awaiting stage action" },
      { label: "Completed", value: String(completedReviews), sub: "This cycle" },
      { label: "Avg Rating", value: avgRating, sub: "Across all departments" },
      { label: "KPI/Indicator Completion", value: indicatorCompletion, sub: "Evaluations on-track" },
      { label: "Overdue Reviews", value: String(overdueReviews), sub: "Action required" },
    ];
  },
}));

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const usePerformanceStore = lazyStore(usePerformanceStoreBase, "performance");
