/**
 * PMS Module — Centralized State (Stage 1)
 *
 * Single source of truth for the Project Management System: projects, their
 * runtime stage instances, tasks, design documents, approvals and the audit
 * trail. Zustand + localStorage, matching the convention used by the other
 * HRMS/ERP stores in this folder.
 *
 * The recalculation helpers at the top are exported as pure functions so
 * presentation layers (later stages) can derive timings without pulling the
 * whole store in.
 */

import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import * as pmsApi from "../services/pmsSync";
import { pmsSync, describeError, isBackendEnabled } from "../services/pmsSync";

/**
 * Defaults used only until `hydrate()` has answered — never as data. The server
 * owns projects, stages, departments and settings (api.md §10); these are the
 * shapes the selectors read while the first request is in flight.
 */
const EMPTY_SETTINGS = {
  atRiskThresholdPct: 70,
  requireClientApprovalOnDesign: true,
  requireQaCertificate: true,
  notifications: { enabled: true, onDelay: true, onApproval: true, onAssignment: true, onCompletion: true },
  defaultDepartmentCapacity: 20,
  departmentCapacity: {},
  statusColors: {},
  delayCategories: [],
};

// ─── Time Primitives ─────────────────────────────────────────────────

export const MS_PER_HOUR = 60 * 60 * 1000;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Parse anything date-ish into a valid Date, or null. */
export function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Convert a planned duration + unit into milliseconds. */
export function durationToMs(duration, unit = "Days") {
  const n = Number(duration);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return unit === "Hours" ? n * MS_PER_HOUR : n * MS_PER_DAY;
}

// ─── Core Formulas ───────────────────────────────────────────────────
//
//   Expected Completion = Start + Planned Duration
//   Remaining Time      = max(0, Expected Completion − Now)
//   Delay Duration      = max(0, (Actual ?? Now) − Expected Completion)
//   Stage Completion %  = mean(task %) when tasks exist, else the stage's own %
//   Project Completion% = mean(stage completion %)

/** Start + planned duration → ISO string (null when the stage has not started). */
export function computeExpectedCompletion(startDateTime, plannedDuration, durationUnit) {
  const start = toDate(startDateTime);
  if (!start) return null;
  const ms = durationToMs(plannedDuration, durationUnit);
  return new Date(start.getTime() + ms).toISOString();
}

/** Milliseconds left before the expected completion; never negative. */
export function computeRemainingMs(expectedCompletionDateTime, now = Date.now()) {
  const expected = toDate(expectedCompletionDateTime);
  if (!expected) return 0;
  return Math.max(0, expected.getTime() - now);
}

/** Milliseconds overdue, measured against the actual completion or now. */
export function computeDelayMs(
  expectedCompletionDateTime,
  actualCompletionDateTime = null,
  now = Date.now()
) {
  const expected = toDate(expectedCompletionDateTime);
  if (!expected) return 0;
  const actual = toDate(actualCompletionDateTime);
  const reference = actual ? actual.getTime() : now;
  return Math.max(0, reference - expected.getTime());
}

/** Share of the planned window already consumed, 0–100+ (can exceed 100). */
export function computeElapsedPct(stage, now = Date.now()) {
  const start = toDate(stage?.startDateTime);
  const total = durationToMs(stage?.plannedDuration, stage?.durationUnit);
  if (!start || total <= 0) return 0;
  return ((now - start.getTime()) / total) * 100;
}

/** Stage completion: mean of its task percentages, else its own value. */
export function computeStageCompletionPct(stage) {
  const tasks = stage?.tasks ?? [];
  if (tasks.length === 0) return clampPct(stage?.completionPct ?? 0);
  const sum = tasks.reduce((acc, t) => acc + clampPct(t.completionPct ?? 0), 0);
  return clampPct(sum / tasks.length);
}

/** Project completion: weighted sum of stage completion percentages using stage weights (totaling 100%),
 *  falling back to simple mean for legacy projects without configured weights. */
export function computeProjectCompletionPct(stages = []) {
  if (stages.length === 0) return 0;
  const totalWeight = stages.reduce(
    (acc, s) => acc + (Number(s.percentage ?? s.weightPct ?? s.weight) || 0),
    0
  );
  if (totalWeight > 0) {
    const weightedSum = stages.reduce((acc, s) => {
      const w = Number(s.percentage ?? s.weightPct ?? s.weight) || 0;
      return acc + computeStageCompletionPct(s) * w;
    }, 0);
    return clampPct(weightedSum / totalWeight);
  }
  const sum = stages.reduce((acc, s) => acc + computeStageCompletionPct(s), 0);
  return clampPct(sum / stages.length);
}

/** Project start + the sum of every stage's planned duration. */
export function computeProjectExpectedCompletion(startDate, stages = []) {
  const start = toDate(startDate);
  if (!start || stages.length === 0) return null;
  const totalMs = stages.reduce(
    (acc, s) => acc + durationToMs(s.plannedDuration, s.durationUnit),
    0
  );
  if (totalMs <= 0) return null;
  return new Date(start.getTime() + totalMs).toISOString();
}

function clampPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

/** Humanize a millisecond span as "3d 4h" / "5h 30m" / "—". */
export function formatDuration(ms) {
  const v = Number(ms);
  if (!Number.isFinite(v) || v <= 0) return "—";
  const days = Math.floor(v / MS_PER_DAY);
  const hours = Math.floor((v % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((v % MS_PER_HOUR) / (60 * 1000));
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

// ─── Derived Status ──────────────────────────────────────────────────

// Statuses the delay engine may overwrite. Anything else (Submitted, Under
// Review, Approved, Completed, Blocked, …) was set deliberately by a human and
// is left untouched.
const AUTO_STATUSES = new Set(["Assigned", "In Progress", "At Risk", "Delayed"]);

/**
 * Re-derive a stage's status from the clock. Returns the existing status
 * unchanged unless the stage is in an auto-managed state.
 */
export function deriveStageStatus(stage, now = Date.now(), atRiskThresholdPct = 70) {
  const current = stage?.status;
  if (!AUTO_STATUSES.has(current)) return current;
  if (stage?.delayDetails?.isDelayed) return "Delayed";

  const expected = toDate(stage?.expectedCompletionDateTime);
  if (!expected) return current;

  // Delay detection: past the expected completion and not finished.
  if (now > expected.getTime()) return "Delayed";

  // At-risk heuristic: burning the window faster than the work is progressing.
  // Both conditions are required — a stage at 90% elapsed and 95% done is
  // simply near the finish line, not at risk.
  const elapsed = computeElapsedPct(stage, now);
  const completion = computeStageCompletionPct(stage);
  if (elapsed > atRiskThresholdPct && completion < DASHBOARD_AT_RISK_COMPLETION_PCT) {
    return "At Risk";
  }

  return current === "At Risk" || current === "Delayed" ? "In Progress" : current;
}

/** Roll stage-level signals up into the project status. */
export function deriveProjectStatus(project, now = Date.now(), atRiskThresholdPct = 70) {
  // On Hold is a deliberate pause and only a human clears it.
  if (project?.status === "On Hold") return project.status;

  // An explicit sign-off stamps actualCompletionDate and is terminal — a later
  // stage edit must not quietly reopen a closed project.
  if (project?.actualCompletionDate) return "Completed";

  const stages = project?.stages ?? [];
  if (stages.length === 0) return project?.status ?? "Draft";

  const statuses = stages.map((s) => deriveStageStatus(s, now, atRiskThresholdPct));

  // Draft is derived, not sticky: a project stays Draft only while no stage has
  // been picked up. Assigning the first stage moves it on by itself.
  if (statuses.every((s) => s === "Not Started")) return "Draft";
  if (statuses.every((s) => s === "Completed")) return "Completed";
  if (statuses.includes("Delayed")) return "Delayed";
  if (statuses.includes("At Risk")) return "At Risk";
  return "In Progress";
}

// ─── Recalculation ───────────────────────────────────────────────────

/** Recompute one stage's derived fields (dates, %, status). */
export function recalcStage(stage, now = Date.now(), atRiskThresholdPct = 70) {
  const completionPct = computeStageCompletionPct(stage);
  const expectedCompletionDateTime =
    computeExpectedCompletion(
      stage.startDateTime,
      stage.plannedDuration,
      stage.durationUnit
    ) ?? stage.expectedCompletionDateTime ?? null;

  const next = { ...stage, completionPct, expectedCompletionDateTime };
  next.status = deriveStageStatus(next, now, atRiskThresholdPct);
  return next;
}

/** Recompute a whole project: every stage, then the project rollups. */
export function recalcProject(project, now = Date.now(), atRiskThresholdPct = 70) {
  const stages = (project.stages ?? []).map((s) =>
    recalcStage(s, now, atRiskThresholdPct)
  );
  const next = {
    ...project,
    stages,
    overallCompletionPct:
      stages.length > 0
        ? computeProjectCompletionPct(stages)
        : (project.overallCompletionPct ?? 0),
    expectedCompletionDate:
      (stages.length > 0 ? computeProjectExpectedCompletion(project.startDate, stages) : null) ??
      project.expectedCompletionDate ??
      null,
  };
  next.status = deriveProjectStatus(next, now, atRiskThresholdPct);
  return next;
}

/**
 * Sidebar nav counters, derived purely so components can memoize on the raw
 * slices rather than on a fresh object handed back by a store selector.
 */
export function computeNavBadges(projects = [], currentUserId = null) {
  let pmsActiveCount = 0;
  let pmsDelayedCount = 0;
  let pmsMyTasksPending = 0;

  for (const p of projects) {
    if (p.status === "Delayed") pmsDelayedCount += 1;
    if (p.status !== "Completed" && p.status !== "Draft") pmsActiveCount += 1;

    for (const stage of p.stages ?? []) {
      for (const task of stage.tasks ?? []) {
        if (task.assignedUser?.id === currentUserId && task.status !== "Completed") {
          pmsMyTasksPending += 1;
        }
      }
    }
  }

  return { pmsActiveCount, pmsDelayedCount, pmsMyTasksPending };
}

// ─── Stage 4 Dashboard Derivations ───────────────────────────
//
// These follow the dashboard spec's own definitions, which are deliberately
// stricter than the store's general-purpose getKpis(): "active" excludes On
// Hold, "delayed" also counts projects whose stages have run past due, and
// "at risk" is measured per stage at a 70%/50% cut rather than via
// settings.atRiskThresholdPct.

export const DASHBOARD_AT_RISK_ELAPSED_PCT = 70;
export const DASHBOARD_AT_RISK_COMPLETION_PCT = 50;

const ACTIVE_STATUSES = new Set(["In Progress", "At Risk", "Delayed"]);

/** A stage still open and already past its expected completion. */
export function isStageOverdue(stage, now = Date.now()) {
  if (!stage || stage.status === "Completed") return false;
  const expected = toDate(stage.expectedCompletionDateTime);
  return Boolean(expected) && now > expected.getTime();
}

/** A started, unfinished stage burning its window faster than its progress. */
export function isStageAtRisk(stage, now = Date.now()) {
  if (!stage || stage.status === "Completed" || !stage.startDateTime) return false;
  return (
    computeElapsedPct(stage, now) > DASHBOARD_AT_RISK_ELAPSED_PCT &&
    computeStageCompletionPct(stage) < DASHBOARD_AT_RISK_COMPLETION_PCT
  );
}

/** Days from now until `iso`, or null. Negative means already past. */
function daysUntil(iso, now = Date.now()) {
  const d = toDate(iso);
  if (!d) return null;
  return (d.getTime() - now) / MS_PER_DAY;
}

/** The seven headline dashboard metrics. */
export function computeDashboardMetrics(projects = [], now = Date.now()) {
  let activeProjects = 0;
  let completedProjects = 0;
  let delayedProjects = 0;
  let atRiskStages = 0;
  let dueTodayCount = 0;
  let dueThisWeekCount = 0;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = startOfToday.getTime() + MS_PER_DAY;

  for (const p of projects) {
    if (ACTIVE_STATUSES.has(p.status)) activeProjects += 1;
    if (p.status === "Completed") completedProjects += 1;

    const stages = p.stages ?? [];
    if (p.status === "Delayed" || stages.some((s) => isStageOverdue(s, now))) {
      delayedProjects += 1;
    }
    for (const stage of stages) {
      if (isStageAtRisk(stage, now)) atRiskStages += 1;
    }

    // Deadline counters only make sense for work still in flight.
    if (p.status !== "Completed" && p.expectedCompletionDate) {
      const due = toDate(p.expectedCompletionDate)?.getTime();
      if (due != null) {
        if (due >= startOfToday.getTime() && due < endOfToday) dueTodayCount += 1;
        if (due >= now && due <= now + 7 * MS_PER_DAY) dueThisWeekCount += 1;
      }
    }
  }

  return {
    totalProjects: projects.length,
    activeProjects,
    completedProjects,
    delayedProjects,
    atRiskStages,
    dueTodayCount,
    dueThisWeekCount,
  };
}

/** Project counts bucketed by the department currently holding the work. */
export function computePipelineByDepartment(projects = []) {
  const buckets = new Map();
  for (const p of projects) {
    if (p.status === "Completed" || p.status === "Draft") continue;
    const current = p.stages?.find((s) => s.id === p.currentStageId);
    const dept = current?.department ?? p.currentDepartment ?? "Unassigned";
    const entry = buckets.get(dept) ?? { department: dept, count: 0, projects: [] };
    entry.count += 1;
    entry.projects.push(p.id);
    buckets.set(dept, entry);
  }
  const rows = [...buckets.values()].sort((a, b) => b.count - a.count);
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
  return rows.map((r) => ({ ...r, sharePct: max > 0 ? Math.round((r.count / max) * 100) : 0 }));
}

/** Open task load per department against its configured capacity. */
export function computeDepartmentWorkload(projects = [], capacityPerDept = {}, defaultCapacity = 20) {
  const buckets = new Map();

  for (const p of projects) {
    for (const stage of p.stages ?? []) {
      for (const task of stage.tasks ?? []) {
        if (task.status === "Completed") continue;
        const dept = task.department ?? stage.department ?? "Unassigned";
        const entry = buckets.get(dept) ?? { department: dept, openTasks: 0, blockedTasks: 0 };
        entry.openTasks += 1;
        if (task.status === "Blocked") entry.blockedTasks += 1;
        buckets.set(dept, entry);
      }
    }
  }

  return [...buckets.values()]
    .map((entry) => {
      const capacity = capacityPerDept[entry.department] ?? defaultCapacity;
      const utilisationPct = capacity > 0 ? Math.round((entry.openTasks / capacity) * 100) : 0;
      return {
        ...entry,
        capacity,
        utilisationPct,
        load: utilisationPct >= 90 ? "High" : utilisationPct >= 65 ? "Medium" : "Low",
      };
    })
    .sort((a, b) => b.utilisationPct - a.utilisationPct);
}

/** Every stage that is overdue or explicitly delayed, with project context. */
export function computeDelayWatchlist(projects = [], now = Date.now()) {
  const rows = [];
  for (const p of projects) {
    for (const stage of p.stages ?? []) {
      const flagged = stage.delayDetails?.isDelayed || stage.status === "Delayed";
      const overdue = isStageOverdue(stage, now);
      if (!flagged && !overdue) continue;

      const timing = getStageTiming(stage, now);
      rows.push({
        id: `${p.id}:${stage.id}`,
        projectId: p.id,
        stageId: stage.id,
        customerName: p.customerName,
        productName: p.productDetails?.productName ?? "",
        priority: p.priority,
        stageName: stage.name,
        department: stage.department,
        status: stage.status,
        owner: stage.assignedUser?.name ?? stage.assignedTeam ?? "Unassigned",
        // A stage can be overdue before anyone has logged a reason; the Delay
        // Center surfaces both so nothing slips through unattributed.
        isLogged: Boolean(stage.delayDetails?.isDelayed),
        category: stage.delayDetails?.category ?? null,
        reason: stage.delayDetails?.reason ?? "",
        responsibleDepartment: stage.delayDetails?.responsibleDepartment ?? stage.department,
        responsibleUser:
          stage.delayDetails?.responsibleUser ?? stage.assignedUser?.name ?? "Unassigned",
        expectedRecoveryDate: stage.delayDetails?.expectedRecoveryDate ?? null,
        resolutionNotes: stage.delayDetails?.resolutionNotes ?? "",
        expectedCompletionDateTime: stage.expectedCompletionDateTime ?? null,
        completionPct: computeStageCompletionPct(stage),
        delayMs: timing.delayMs,
        delayLabel: timing.delayLabel,
        timing,
      });
    }
  }
  return rows.sort((a, b) => b.delayMs - a.delayMs);
}

/** In-flight projects due within `days`, soonest first. */
export function computeUpcomingDeadlines(projects = [], days = 7, now = Date.now()) {
  return projects
    .filter((p) => p.status !== "Completed" && p.status !== "Draft" && p.expectedCompletionDate)
    .map((p) => {
      const remaining = daysUntil(p.expectedCompletionDate, now);
      return {
        id: p.id,
        customerName: p.customerName,
        productName: p.productDetails?.productName ?? "",
        priority: p.priority,
        status: p.status,
        completionPct: p.overallCompletionPct ?? 0,
        expectedCompletionDate: p.expectedCompletionDate,
        daysRemaining: remaining,
        isOverdue: remaining != null && remaining < 0,
      };
    })
    .filter((row) => row.daysRemaining != null && row.daysRemaining <= days)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// ─── Stage 12 Completion Sign-Off ────────────────────────────

/**
 * The completion gate: a project may close only when every stage it carries is
 * Completed and a project manager signs off.
 *
 * Returns one blocker per unfinished stage. An empty array means the first half
 * of the rule holds; the sign-off is the caller supplying an actor.
 */
export function validateProjectCompletion(project) {
  const blockers = [];
  if (!project) return [{ code: "NO_PROJECT", label: "Project not found.", hard: true }];

  if (project.status === "Completed") {
    blockers.push({ code: "ALREADY_COMPLETED", label: "This project is already completed.", hard: true });
  }

  const stages = project.stages ?? [];
  if (stages.length === 0) {
    blockers.push({
      code: "NO_STAGES",
      label: "No stages configured — there is nothing to sign off.",
      hard: true,
    });
  }

  for (const stage of stages) {
    if (stage.status === "Completed") continue;
    blockers.push({
      code: "STAGE_OPEN",
      stageId: stage.id,
      label: `Stage ${stage.sequence} (${stage.name}) is ${stage.status}.`,
      hard: true,
    });
  }

  return blockers;
}

/**
 * The immutable record written at sign-off.
 *
 * Captured once, at the moment of closure, rather than derived later — the
 * planned dates a project was judged against can change afterwards, and a
 * turnaround figure that silently rewrites itself is worthless for reporting.
 */
export function computeProjectCompletionMetrics(project, now = Date.now(), signedOffBy = null) {
  const start = toDate(project?.startDate);
  const actual = new Date(now);
  const expected = toDate(project?.expectedCompletionDate);

  const totalDurationMs = start ? Math.max(0, actual.getTime() - start.getTime()) : 0;
  const totalDelayMs = expected ? Math.max(0, actual.getTime() - expected.getTime()) : 0;

  return {
    actualCompletionDate: actual.toISOString(),
    totalDurationDays: Math.round((totalDurationMs / MS_PER_DAY) * 10) / 10,
    totalDelayHours: Math.round((totalDelayMs / MS_PER_HOUR) * 10) / 10,
    finalCompletionPct: 100,
    stageCount: (project?.stages ?? []).length,
    signedOffBy: signedOffBy ? { id: signedOffBy.id, name: signedOffBy.name } : null,
    signedOffAt: actual.toISOString(),
  };
}

/** Audit event types, with the label each one reads as in the trail. */
export const AUDIT_EVENT_TYPES = [
  { action: "PROJECT_CREATED", label: "Project Created" },
  { action: "STAGES_CONFIGURED", label: "Stages Configured" },
  { action: "STAGE_ASSIGNED", label: "Stage Assigned" },
  { action: "STAGE_STARTED", label: "Stage Started" },
  { action: "PROGRESS_UPDATED", label: "Progress Updated" },
  { action: "STAGE_STATUS_CHANGED", label: "Status Changed" },
  { action: "DOCUMENT_UPLOADED", label: "Design Uploaded" },
  { action: "APPROVAL_REQUESTED", label: "Sent for Approval" },
  { action: "DOCUMENT_APPROVED", label: "Client Approved" },
  { action: "REVISION_REQUESTED", label: "Revision Requested" },
  { action: "DELAY_LOGGED", label: "Delay Logged" },
  { action: "RECOVERY_PLAN_UPDATED", label: "Recovery Plan Updated" },
  { action: "DELAY_RESOLVED", label: "Delay Resolved" },
  { action: "STAGE_HANDOFF", label: "Stage Handoff" },
  { action: "PROJECT_COMPLETED", label: "Project Completed" },
];

/** Filter an audit trail by event type and free text. */
export function filterAuditTrail(entries = [], { action = "all", search = "" } = {}) {
  const q = search.trim().toLowerCase();
  return entries.filter((e) => {
    if (action !== "all" && e.action !== action) return false;
    if (q) {
      const hay = [e.description, e.actor?.name, e.comments, e.from, e.to]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ─── Stage 11 Workspaces & Analytics ─────────────────────────

/**
 * Bucket a contributor's tasks for the My Tasks workbench.
 *
 * Overdue work is folded into Due Today rather than given its own bucket, so
 * the top group is always "what needs attention now".
 */
export function groupMyTasks(tasks = [], now = Date.now()) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = startOfToday.getTime() + MS_PER_DAY;

  const groups = { dueToday: [], inProgress: [], upcoming: [], completed: [] };

  for (const task of tasks) {
    if (task.status === "Completed") {
      groups.completed.push(task);
      continue;
    }
    const due = toDate(task.dueDate)?.getTime() ?? null;
    if (due != null && due < endOfToday) groups.dueToday.push(task);
    else if (task.status === "In Progress" || task.status === "Blocked") {
      groups.inProgress.push(task);
    } else groups.upcoming.push(task);
  }

  // An undated task is the least urgent, not the most, so it sorts last in
  // every bucket rather than being treated as due at the epoch.
  const dueMs = (t) => toDate(t.dueDate)?.getTime() ?? null;
  const compare = (a, b, direction) => {
    const x = dueMs(a);
    const y = dueMs(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return direction * (x - y);
  };

  groups.dueToday.sort((a, b) => compare(a, b, 1));
  groups.inProgress.sort((a, b) => compare(a, b, 1));
  groups.upcoming.sort((a, b) => compare(a, b, 1));
  groups.completed.sort((a, b) => compare(a, b, -1));
  return groups;
}

/** On-time versus delayed delivery across completed projects. */
export function computeVelocityReport(projects = []) {
  let onTime = 0;
  let delayed = 0;

  for (const p of projects) {
    if (p.status !== "Completed" || !p.actualCompletionDate) continue;
    const expected = toDate(p.expectedCompletionDate);
    const actual = toDate(p.actualCompletionDate);
    if (!expected || !actual) continue;
    if (actual.getTime() <= expected.getTime()) onTime += 1;
    else delayed += 1;
  }

  const completed = onTime + delayed;
  return {
    completed,
    onTime,
    delayed,
    onTimePct: completed > 0 ? Math.round((onTime / completed) * 100) : 0,
  };
}

/**
 * Average cycle time per department, measured only on stages that actually
 * finished — an unfinished stage has no cycle time yet, and counting it as
 * "so far" would flatter slow departments.
 */
export function computeStageBottlenecks(projects = []) {
  const byDepartment = new Map();

  for (const p of projects) {
    for (const stage of p.stages ?? []) {
      const start = toDate(stage.startDateTime);
      const end = toDate(stage.actualCompletionDateTime);
      if (!start || !end) continue;

      const dept = stage.department ?? "Unassigned";
      const entry = byDepartment.get(dept) ?? { department: dept, totalMs: 0, samples: 0, plannedMs: 0 };
      entry.totalMs += Math.max(0, end.getTime() - start.getTime());
      entry.plannedMs += durationToMs(stage.plannedDuration, stage.durationUnit);
      entry.samples += 1;
      byDepartment.set(dept, entry);
    }
  }

  return [...byDepartment.values()]
    .map((e) => {
      const avgMs = e.samples > 0 ? e.totalMs / e.samples : 0;
      const avgPlannedMs = e.samples > 0 ? e.plannedMs / e.samples : 0;
      return {
        department: e.department,
        samples: e.samples,
        avgCycleMs: avgMs,
        avgCycleDays: Math.round((avgMs / MS_PER_DAY) * 10) / 10,
        avgPlannedDays: Math.round((avgPlannedMs / MS_PER_DAY) * 10) / 10,
        // >100% means the department routinely overruns its own estimate.
        scheduleRatioPct: avgPlannedMs > 0 ? Math.round((avgMs / avgPlannedMs) * 100) : 0,
      };
    })
    .sort((a, b) => b.avgCycleMs - a.avgCycleMs);
}

/**
 * Delay causes ranked by frequency with a running cumulative share.
 *
 * Both measures are percentages of the same total, so the bars and the
 * cumulative curve share one 0–100 axis — no second scale.
 */
export function computeDelayPareto(projects = []) {
  const counts = new Map();
  let total = 0;

  for (const p of projects) {
    for (const stage of p.stages ?? []) {
      const details = stage.delayDetails;
      if (!details || (!details.isDelayed && !details.reason)) continue;
      const category = details.category ?? "Other";
      counts.set(category, (counts.get(category) ?? 0) + 1);
      total += 1;
    }
  }

  const rows = [...counts.entries()]
    .map(([category, count]) => ({ category, count, sharePct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);

  let running = 0;
  return rows.map((r) => {
    running += r.count;
    return { ...r, cumulativePct: Math.round((running / total) * 100) };
  });
}

/** Stage spans for the cross-project Gantt. */
export function computeTimelineRows(projects = [], now = Date.now()) {
  const rows = [];

  for (const p of projects) {
    if (p.status === "Draft") continue;
    const bars = [];

    for (const stage of [...(p.stages ?? [])].sort((a, b) => a.sequence - b.sequence)) {
      const start = toDate(stage.startDateTime);
      if (!start) continue;
      const end =
        toDate(stage.actualCompletionDateTime) ??
        toDate(stage.expectedCompletionDateTime) ??
        new Date(now);

      bars.push({
        id: stage.id,
        name: stage.name,
        department: stage.department,
        status: stage.status,
        startMs: start.getTime(),
        endMs: Math.max(end.getTime(), start.getTime() + MS_PER_DAY / 4),
        isOverdue: isStageOverdue(stage, now),
        completionPct: computeStageCompletionPct(stage),
      });
    }

    if (bars.length === 0) continue;
    rows.push({
      projectId: p.id,
      customerName: p.customerName,
      status: p.status,
      priority: p.priority,
      department: p.currentDepartment,
      projectManagerId: p.projectManager?.id ?? null,
      bars,
      startMs: Math.min(...bars.map((b) => b.startMs)),
      endMs: Math.max(...bars.map((b) => b.endMs)),
    });
  }

  return rows.sort((a, b) => a.startMs - b.startMs);
}

/** The overall time window a set of Gantt rows spans, padded for readability. */
export function computeTimelineWindow(rows = [], now = Date.now()) {
  if (rows.length === 0) {
    return { startMs: now - 7 * MS_PER_DAY, endMs: now + 7 * MS_PER_DAY, totalMs: 14 * MS_PER_DAY };
  }
  const startMs = Math.min(...rows.map((r) => r.startMs)) - MS_PER_DAY;
  const endMs = Math.max(...rows.map((r) => r.endMs)) + MS_PER_DAY;
  return { startMs, endMs, totalMs: Math.max(1, endMs - startMs) };
}

// ─── Stage 10 Delay Engine ───────────────────────────────────

/** Standard root causes a delay must be attributed to. */
export const DELAY_REASON_CATEGORIES = [
  "Client Revision",
  "Client Approval Pending",
  "Design Issue",
  "Resource Unavailable",
  "Production Issue",
  "Quality Issue",
  "Material Issue",
  "Internal Dependency",
  "Other",
];

/** Validate a delay entry before it reaches the store. */
export function validateDelayEntry(draft = {}) {
  const errors = {};
  if (!DELAY_REASON_CATEGORIES.includes(draft.category)) {
    errors.category = "Select a root-cause category.";
  }
  if (!(draft.reason ?? "").trim()) {
    errors.reason = "Describe what actually happened.";
  }
  if (!draft.expectedRecoveryDate) {
    errors.expectedRecoveryDate = "Set an expected recovery date.";
  }
  return errors;
}

/** Headline metrics for the Delay Center. */
export function computeDelayMetrics(rows = []) {
  const projectIds = new Set();
  const byDepartment = new Map();
  let totalDelayMs = 0;
  let measured = 0;

  for (const row of rows) {
    projectIds.add(row.projectId);
    if (row.delayMs > 0) {
      totalDelayMs += row.delayMs;
      measured += 1;
    }
    const dept = row.department ?? "Unassigned";
    const entry = byDepartment.get(dept) ?? { department: dept, count: 0, delayMs: 0 };
    entry.count += 1;
    entry.delayMs += row.delayMs;
    byDepartment.set(dept, entry);
  }

  const departments = [...byDepartment.values()].sort(
    (a, b) => b.delayMs - a.delayMs || b.count - a.count
  );
  const avgDelayMs = measured > 0 ? Math.round(totalDelayMs / measured) : 0;

  return {
    delayedProjects: projectIds.size,
    delayedStages: rows.length,
    avgDelayMs,
    avgDelayLabel: formatDuration(avgDelayMs),
    totalDelayMs,
    bottleneck: departments[0] ?? null,
    departments,
  };
}

const EMPTY_DELAY_FILTERS = {
  projectId: "all",
  department: "all",
  stageName: "all",
  category: "all",
  dateFrom: "",
  dateTo: "",
};

export function emptyDelayFilters() {
  return { ...EMPTY_DELAY_FILTERS };
}

export function hasActiveDelayFilters(filters = {}) {
  const f = { ...EMPTY_DELAY_FILTERS, ...filters };
  return Boolean(
    f.projectId !== "all" ||
      f.department !== "all" ||
      f.stageName !== "all" ||
      f.category !== "all" ||
      f.dateFrom ||
      f.dateTo
  );
}

/** Apply the Delay Center filter bar to watchlist rows. */
export function filterDelays(rows = [], filters = {}) {
  const f = { ...EMPTY_DELAY_FILTERS, ...filters };

  return rows.filter((row) => {
    if (f.projectId !== "all" && row.projectId !== f.projectId) return false;
    if (f.department !== "all" && row.department !== f.department) return false;
    if (f.stageName !== "all" && row.stageName !== f.stageName) return false;
    if (f.category !== "all" && (row.category ?? "Other") !== f.category) return false;

    if (f.dateFrom || f.dateTo) {
      // Filter on when the stage was due, which is when the delay began.
      const due = toDate(row.expectedCompletionDateTime);
      if (!due) return false;
      if (f.dateFrom && due.getTime() < new Date(f.dateFrom).setHours(0, 0, 0, 0)) return false;
      if (f.dateTo && due.getTime() > new Date(f.dateTo).setHours(23, 59, 59, 999)) return false;
    }

    return true;
  });
}

/** Distinct dropdown options for the Delay Center filter bar. */
export function getDelayFilterOptions(rows = []) {
  const projects = new Map();
  const departments = new Set();
  const stageNames = new Set();
  const categories = new Set();

  for (const row of rows) {
    projects.set(row.projectId, row.customerName ?? row.projectId);
    if (row.department) departments.add(row.department);
    if (row.stageName) stageNames.add(row.stageName);
    if (row.category) categories.add(row.category);
  }

  const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b));
  return {
    projects: [...projects.entries()].map(([id, label]) => ({ id, label })),
    departments: sorted(departments),
    stageNames: sorted(stageNames),
    categories: sorted(categories),
  };
}

// ─── Stage 9 Design Proofing ─────────────────────────────────

export const PROOF_DECISIONS = ["Approved", "Need Improvement"];

/**
 * Validate a client/PM decision on a proof.
 *
 * A "Need Improvement" verdict without a reason is useless to the designer who
 * has to act on it, so the reason is mandatory and enforced here rather than
 * only in the dialog.
 */
export function validateApprovalDecision(decision, { revisionReason = "", approverName = "" } = {}) {
  const errors = {};
  if (!PROOF_DECISIONS.includes(decision)) {
    errors.decision = "Choose Approve or Need Improvement.";
  }
  if (!approverName.trim()) {
    errors.approverName = "Signer name is required.";
  }
  if (decision === "Need Improvement" && !revisionReason.trim()) {
    errors.revisionReason = "A revision reason is required so the designer knows what to change.";
  }
  return errors;
}

/** The newest proof on a stage, or null. */
export function getLatestDocument(stage) {
  const docs = stage?.documents ?? [];
  if (docs.length === 0) return null;
  return docs.reduce((latest, d) => ((d.version ?? 0) > (latest.version ?? 0) ? d : latest), docs[0]);
}

/**
 * Where a stage sits in the proofing chain:
 * upload → PM review → sent to client → client decision.
 */
export function getProofWorkflowState(stage) {
  const latest = getLatestDocument(stage);
  const approvals = stage?.approvals ?? [];
  const pending = approvals.find(
    (a) => a.status === "Pending" && (!latest || a.documentId === latest.id)
  );
  const decided = latest
    ? approvals.filter((a) => a.documentId === latest.id && a.status !== "Pending")
    : [];

  let step = "awaiting-upload";
  if (latest) {
    if (latest.approvalStatus === "Approved") step = "approved";
    else if (latest.approvalStatus === "Need Improvement") step = "needs-revision";
    else if (pending) step = "with-client";
    else step = "pm-review";
  }

  return {
    latest,
    versionCount: (stage?.documents ?? []).length,
    pendingApproval: pending ?? null,
    decisions: decided,
    step,
    canUpload: true,
    canSendToClient: Boolean(latest) && step === "pm-review",
    canDecide: Boolean(latest) && step === "with-client",
    isApproved: step === "approved",
    needsRevision: step === "needs-revision",
  };
}

// ─── Stage 8 Handoff Gates ───────────────────────────────────

/**
 * Pre-conditions a stage must satisfy before it can be handed off.
 *
 * Returns one entry per unmet gate, each with the reason and whether it is
 * hard (config-mandated) or advisory, so the dialog can explain precisely why
 * the confirm button is disabled instead of just greying it out.
 */
export function validateStageHandoff(stage, config, now = Date.now()) {
  const blockers = [];
  if (!stage) return [{ code: "NO_STAGE", label: "Stage not found.", hard: true }];

  if (stage.status === "Completed") {
    blockers.push({ code: "ALREADY_DONE", label: "This stage is already completed.", hard: true });
  }

  if (stage.status === "Not Started" || !stage.startDateTime) {
    blockers.push({ code: "NOT_STARTED", label: "Stage has not been started yet.", hard: true });
  }

  const completion = computeStageCompletionPct(stage);
  if (completion < 100) {
    blockers.push({
      code: "INCOMPLETE",
      label: `Stage is at ${completion}% — finish the work before handing off.`,
      hard: false,
    });
  }

  const blockedTasks = (stage.tasks ?? []).filter((t) => t.status === "Blocked");
  if (blockedTasks.length > 0) {
    blockers.push({
      code: "BLOCKED_TASKS",
      label: `${blockedTasks.length} task${blockedTasks.length === 1 ? " is" : "s are"} still blocked.`,
      hard: true,
    });
  }

  if (stage.delayDetails?.isDelayed) {
    blockers.push({
      code: "OPEN_DELAY",
      label: "An open delay is logged against this stage — resolve it first.",
      hard: true,
    });
  }

  if (config?.requiredDocument && (stage.documents ?? []).length === 0) {
    blockers.push({
      code: "NEEDS_DOCUMENT",
      label: "This stage requires a document upload before handoff.",
      hard: true,
    });
  }

  if (config?.requiredApproval) {
    const approved = (stage.approvals ?? []).some((a) => a.status === "Approved");
    if (!approved) {
      blockers.push({
        code: "NEEDS_APPROVAL",
        label: "This stage requires an approved sign-off before handoff.",
        hard: true,
      });
    }
  }

  void now;
  return blockers;
}

/** A completed stage's headline numbers, for the handoff summary panel. */
export function summariseStageForHandoff(stage, now = Date.now()) {
  const timing = getStageTiming(stage, now);
  const start = toDate(stage?.startDateTime);
  const takenMs = start ? Math.max(0, now - start.getTime()) : 0;
  const plannedMs = durationToMs(stage?.plannedDuration, stage?.durationUnit);

  return {
    plannedLabel: `${stage?.plannedDuration ?? 0} ${stage?.durationUnit ?? "Days"}`,
    takenLabel: formatDuration(takenMs),
    delayLabel: timing.delayMs > 0 ? timing.delayLabel : "On time",
    isOverdue: timing.delayMs > 0,
    overrunPct: plannedMs > 0 ? Math.round((takenMs / plannedMs) * 100) : 0,
    completionPct: computeStageCompletionPct(stage),
    taskCount: (stage?.tasks ?? []).length,
    doneTaskCount: (stage?.tasks ?? []).filter((t) => t.status === "Completed").length,
  };
}

// ─── Stage 6 Configurator Derivations ────────────────────────

/**
 * How many live projects and stage instances were spun up from a template.
 *
 * Instances copy the template's name, department and duration at creation, so
 * removing a template never rewrites history — but an administrator should
 * still see what a template is currently driving before deleting it.
 */
export function computeStageConfigUsage(projects = [], configId) {
  let projectCount = 0;
  let stageCount = 0;
  let activeStageCount = 0;

  for (const p of projects) {
    let usedHere = 0;
    for (const stage of p.stages ?? []) {
      if (stage.stageConfigId !== configId) continue;
      usedHere += 1;
      if (stage.status !== "Completed" && stage.status !== "Not Started") {
        activeStageCount += 1;
      }
    }
    if (usedHere > 0) {
      projectCount += 1;
      stageCount += usedHere;
    }
  }

  return { projectCount, stageCount, activeStageCount };
}

/** Validate a stage template before it reaches the store. */
export function validateStageConfig(draft = {}, existing = [], editingId = null) {
  const errors = {};
  const name = (draft.name ?? "").trim();

  if (!name) {
    errors.name = "Stage name is required.";
  } else if (
    existing.some(
      (c) => c.id !== editingId && (c.name ?? "").trim().toLowerCase() === name.toLowerCase()
    )
  ) {
    errors.name = "Another stage already uses this name.";
  }

  if (!draft.department) errors.department = "Choose a responsible department.";

  const duration = Number(draft.defaultDuration);
  if (!Number.isFinite(duration) || duration <= 0) {
    errors.defaultDuration = "Duration must be greater than zero.";
  } else if (!Number.isInteger(duration)) {
    errors.defaultDuration = "Duration must be a whole number.";
  }

  if (!["Hours", "Days"].includes(draft.durationUnit)) {
    errors.durationUnit = "Unit must be Hours or Days.";
  }

  return errors;
}

// ─── Department catalogue ────────────────────────────────────
//
// A department is referenced by *name* from three places — a project's
// `currentDepartment`, each runtime stage, and each stage template — so renaming
// or removing one has to carry every reference with it. These helpers are what
// the catalogue actions below are built from.

/** Used when a department is created without a colour. */
export const DEPARTMENT_FALLBACK_COLOR = "#64748b";

/**
 * `#abc` / `abc123` / `#ABC123` → `#abc123`, or null when it is not a colour.
 * Returning null rather than a default lets the caller decide whether an
 * unreadable value is a validation error or simply absent.
 */
export function normaliseHex(value) {
  const raw = String(value ?? "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.split("").map((c) => c + c).join("").toLowerCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toLowerCase()}`;
  return null;
}

/**
 * Check a department draft. Returns `{}` when it is fine, otherwise a map of
 * field → message, in the shape the modals render.
 *
 * `editingId` excludes the row being edited from the duplicate-name check, so
 * renaming a department to its own name is not an error.
 */
export function validateDepartment(draft = {}, existing = [], editingId = null) {
  const errors = {};
  const name = (draft.name ?? "").trim();

  if (!name) {
    errors.name = "Department name is required.";
  } else if (
    existing.some(
      (d) => d.id !== editingId && (d.name ?? "").trim().toLowerCase() === name.toLowerCase()
    )
  ) {
    errors.name = "Another department already uses this name.";
  }

  if (draft.color !== undefined && draft.color !== "" && !normaliseHex(draft.color)) {
    errors.color = "Use a hex colour such as #1f6bff.";
  }

  return errors;
}

/**
 * What a department is currently driving. The delete confirmation shows these
 * counts, and `inUse` is what decides whether the work has to be reassigned
 * before the department can go.
 */
export function computeDepartmentUsage(projects = [], stageConfigs = [], name) {
  const target = String(name ?? "").trim().toLowerCase();
  const matches = (value) => String(value ?? "").trim().toLowerCase() === target;

  let projectCount = 0;
  let stageCount = 0;

  projects.forEach((project) => {
    let touched = matches(project.currentDepartment);
    (project.stages ?? []).forEach((stage) => {
      if (matches(stage.department)) {
        stageCount += 1;
        touched = true;
      }
    });
    if (touched) projectCount += 1;
  });

  const templateCount = stageConfigs.filter((c) => matches(c.department)).length;

  return {
    name,
    projects: projectCount,
    stages: stageCount,
    templates: templateCount,
    inUse: projectCount > 0 || stageCount > 0 || templateCount > 0,
  };
}

/**
 * Rewrite every reference to `fromName` as `toName`, across projects, their
 * stages, the stage templates and the capacity map.
 *
 * Returns `null` when nothing referenced the old name, so a caller can tell a
 * rename that moved work from one that did not.
 */
export function renameDepartmentIn(state, fromName, toName) {
  const from = String(fromName ?? "").trim().toLowerCase();
  const to = String(toName ?? "").trim();
  if (!from || !to) return null;

  const matches = (value) => String(value ?? "").trim().toLowerCase() === from;
  let changed = false;

  const projects = (state.projects ?? []).map((project) => {
    const stages = (project.stages ?? []).map((stage) => (
      matches(stage.department) ? { ...stage, department: to } : stage
    ));
    const stagesChanged = stages.some((stage, i) => stage !== (project.stages ?? [])[i]);
    const headerChanged = matches(project.currentDepartment);
    if (!stagesChanged && !headerChanged) return project;
    changed = true;
    return {
      ...project,
      currentDepartment: headerChanged ? to : project.currentDepartment,
      stages,
    };
  });

  const stageConfigs = (state.stageConfigs ?? []).map((config) => {
    if (!matches(config.department)) return config;
    changed = true;
    return { ...config, department: to };
  });

  const capacity = { ...(state.settings?.departmentCapacity ?? {}) };
  const oldKey = Object.keys(capacity).find((key) => matches(key));
  if (oldKey !== undefined) {
    const value = capacity[oldKey];
    delete capacity[oldKey];
    // A rename onto an existing department keeps that department's own capacity.
    if (capacity[to] === undefined) capacity[to] = value;
    changed = true;
  }

  if (!changed) return null;

  return {
    projects,
    stageConfigs,
    settings: { ...state.settings, departmentCapacity: capacity },
  };
}

// ─── Stage 5 Directory Derivations ───────────────────────────

/** Next sequential project code for a year, e.g. "PRJ-2026-006". */
export function nextProjectId(projects = [], year = new Date().getFullYear()) {
  const prefix = `PRJ-${year}-`;
  const highest = projects.reduce((max, p) => {
    if (typeof p?.id !== "string" || !p.id.startsWith(prefix)) return max;
    const n = Number.parseInt(p.id.slice(prefix.length), 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

/**
 * Per-row display data for the project directory: which stage is live, where
 * it sits in the sequence, and how the schedule is tracking.
 */
export function getProjectRowMeta(project, now = Date.now()) {
  const stages = project?.stages ?? [];
  const ordered = [...stages].sort((a, b) => a.sequence - b.sequence);
  const current =
    ordered.find((s) => s.id === project?.currentStageId) ??
    ordered.find((s) => s.status !== "Completed") ??
    null;

  const index = current ? ordered.findIndex((s) => s.id === current.id) + 1 : 0;
  const timing = current ? getStageTiming(current, now) : null;

  // Project-level delay measures the promised end date, not the live stage.
  const projectDelayMs = computeDelayMs(
    project?.expectedCompletionDate,
    project?.actualCompletionDate,
    now
  );
  const remainingMs = computeRemainingMs(project?.expectedCompletionDate, now);

  return {
    currentStage: current,
    sequenceLabel: current ? `Stage ${index}/${ordered.length}: ${current.name}` : "No stages",
    stageIndex: index,
    stageCount: ordered.length,
    department: current?.department ?? project?.currentDepartment ?? "—",
    timing,
    projectDelayMs,
    projectDelayLabel: formatDuration(projectDelayMs),
    isOverdue: projectDelayMs > 0 && project?.status !== "Completed",
    remainingMs,
    remainingLabel: remainingMs > 0 ? `In ${formatDuration(remainingMs)}` : "Overdue",
  };
}

const EMPTY_FILTERS = {
  search: "",
  customer: "all",
  projectManagerId: "all",
  department: "all",
  stageName: "all",
  statuses: [],
  delayedOnly: false,
  dateField: "startDate",
  dateFrom: "",
  dateTo: "",
};

/** The blank filter set, for a page's initial state and its Reset action. */
export function emptyProjectFilters() {
  return { ...EMPTY_FILTERS, statuses: [] };
}

/** True when anything is actually narrowing the list. */
export function hasActiveFilters(filters = {}) {
  const f = { ...EMPTY_FILTERS, ...filters };
  return Boolean(
    f.search.trim() ||
      f.customer !== "all" ||
      f.projectManagerId !== "all" ||
      f.department !== "all" ||
      f.stageName !== "all" ||
      (f.statuses?.length ?? 0) > 0 ||
      f.delayedOnly ||
      f.dateFrom ||
      f.dateTo
  );
}

/** Apply the directory's multi-facet filter bar to a project list. */
export function filterProjects(projects = [], filters = {}, now = Date.now()) {
  const f = { ...EMPTY_FILTERS, ...filters };
  const q = f.search.trim().toLowerCase();

  return projects.filter((p) => {
    // Global search spans project code, customer, order id and product name.
    if (q) {
      const haystack = [
        p.id,
        p.customerName,
        p.crmOrderId,
        p.productDetails?.productName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (f.customer !== "all" && p.customerName !== f.customer) return false;
    if (f.projectManagerId !== "all" && p.projectManager?.id !== f.projectManagerId) {
      return false;
    }
    const meta = getProjectRowMeta(p, now);
    if (f.statuses?.length > 0) {
      const isStatusMatch =
        f.statuses.includes(p.status) ||
        (f.statuses.includes('Delayed') && (p.isOverdue || meta.isOverdue));
      if (!isStatusMatch) return false;
    }
    if (f.department !== "all" && meta.department !== f.department) return false;
    if (f.stageName !== "all" && meta.currentStage?.name !== f.stageName) return false;

    if (f.delayedOnly) {
      const overdueStage = (p.stages ?? []).some((s) => isStageOverdue(s, now));
      if (p.status !== "Delayed" && !meta.isOverdue && !overdueStage) return false;
    }

    if (f.dateFrom || f.dateTo) {
      const value = toDate(p[f.dateField]);
      if (!value) return false;
      if (f.dateFrom && value.getTime() < new Date(f.dateFrom).setHours(0, 0, 0, 0)) {
        return false;
      }
      if (f.dateTo && value.getTime() > new Date(f.dateTo).setHours(23, 59, 59, 999)) {
        return false;
      }
    }

    return true;
  });
}

/** Project-manager options for dropdowns: flagged employees, deduped by id
 * (the team roster lists a person once per role, so a manager can arrive twice).
 * Falls back to the whole roster when nobody carries the PM flag, so the
 * dropdown is never an empty dead-end. */
export function getProjectManagers(employees = []) {
  const seen = new Map();
  for (const e of employees) {
    if (e?.isProjectManager && e?.id != null && !seen.has(e.id)) seen.set(e.id, e);
  }
  if (seen.size > 0) {
    return [...seen.values()].sort((a, b) =>
      String(a.name ?? '').localeCompare(String(b.name ?? ''))
    );
  }
  for (const e of employees) {
    if (e?.id != null && !seen.has(e.id)) seen.set(e.id, e);
  }
  return [...seen.values()].sort((a, b) =>
    String(a.name ?? '').localeCompare(String(b.name ?? ''))
  );
}

/** Distinct dropdown options derived from the projects themselves. */
export function getProjectFilterOptions(projects = []) {
  const customers = new Set();
  const departments = new Set();
  const stageNames = new Set();
  const managers = new Map();

  for (const p of projects) {
    if (p.customerName) customers.add(p.customerName);
    if (p.projectManager?.id) managers.set(p.projectManager.id, p.projectManager);
    for (const stage of p.stages ?? []) {
      if (stage.department) departments.add(stage.department);
      if (stage.name) stageNames.add(stage.name);
    }
  }

  const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b));
  return {
    customers: sorted(customers),
    departments: sorted(departments),
    stageNames: sorted(stageNames),
    managers: [...managers.values()].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''))),
  };
}

/** Per-stage timing summary for timeline / card rendering. */
export function getStageTiming(stage, now = Date.now()) {
  const expected = stage?.expectedCompletionDateTime ?? null;
  const remainingMs = computeRemainingMs(expected, now);
  const delayMs = computeDelayMs(expected, stage?.actualCompletionDateTime, now);
  return {
    expectedCompletionDateTime: expected,
    remainingMs,
    remainingLabel: formatDuration(remainingMs),
    delayMs,
    delayLabel: formatDuration(delayMs),
    isOverdue: delayMs > 0,
    elapsedPct: Math.round(computeElapsedPct(stage, now)),
  };
}

// ─── Server round-trips ──────────────────────────────────────────────

/**
 * Local state is optimistic; the server is authoritative. Every mutator applies
 * its change immediately so the board does not stutter, then calls this with
 * the request that owns the rule. Whatever the server returns replaces the
 * optimistic project; a rejection re-reads the project so the screen shows what
 * actually happened rather than a change that was refused.
 */
function pushProject(projectId, request) {
  if (!isBackendEnabled() || !request) return Promise.resolve(null);
  return Promise.resolve()
    .then(request)
    .then(async (result) => {
      const project = result?.project || (result?.id && result?.stages ? result : null);
      const fresh = project || (await pmsApi.pullProject(projectId));
      if (fresh) applyServerProject(fresh);
      return result;
    })
    .catch(async (err) => {
      console.warn("[PMS] change not saved:", describeError(err));
      const fresh = await pmsApi.pullProject(projectId);
      if (fresh) applyServerProject(fresh);
      usePmsStore.getState().showToast(`Not saved — ${describeError(err)}`, "error");
      return null;
    });
}

/** Drop the server's copy of a project into state, recalculated. */
function applyServerProject(project) {
  usePmsStore.setState((st) => ({
    projects: st.projects.some((p) => p.id === project.id)
      ? st.projects.map((p) => (p.id === project.id
        ? recalcProject(project, Date.now(), st.settings.atRiskThresholdPct)
        : p))
      : [recalcProject(project, Date.now(), st.settings.atRiskThresholdPct), ...st.projects],
  }));
}

// ─── ID & Log Helpers ────────────────────────────────────────────────

const uid = (prefix) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function makeActivity(action, entityType, entityId, description, actor) {
  return {
    id: uid("ACT"),
    timestamp: new Date().toISOString(),
    actor: actor ?? { id: "SYSTEM", name: "System" },
    action,
    entityType,
    entityId,
    description,
  };
}

/**
 * Apply `mutator` to one project, recalculate it, optionally append an audit
 * entry, then persist. Every mutating action funnels through here so derived
 * fields can never drift from the raw data.
 */
function applyToProject(state, projectId, mutator, activity) {
  const threshold = state.settings.atRiskThresholdPct;
  const now = Date.now();
  const projects = state.projects.map((p) => {
    if (p.id !== projectId) return p;
    const mutated = mutator(p);
    const withLog = activity
      ? { ...mutated, activityLog: [...(mutated.activityLog ?? []), activity] }
      : mutated;
    return recalcProject(withLog, now, threshold);
  });
  return { projects };
}

// ─── Store ───────────────────────────────────────────────────────────

const usePmsStoreBase = create((set, get) => ({
  // ── State ──
  projects: [],
  stageConfigs: [],
  departments: [],
  statusColors: {},
  employees: [],
  settings: EMPTY_SETTINGS,
  // Set from the signed-in user once the session resolves.
  currentUserId: null,

  status: { loading: false, loaded: false, error: null, lastSyncAt: null },

  setCurrentUserId: (currentUserId) => set({ currentUserId }),

  // Transient UI state (not persisted)
  toast: null,
  showToast: (msg, tone = 'success') =>
    set({ toast: { msg, tone, id: Date.now().toString() } }),
  clearToast: () => set({ toast: null }),

  /**
   * Load PMS from the API. Projects arrive with their stages nested, so every
   * board, timeline and delay view reads the same server state.
   */
  hydrate: async ({ force = false } = {}) => {
    if (!isBackendEnabled()) {
      set({
        projects: [], stageConfigs: [], departments: [], employees: [],
        statusColors: {}, settings: EMPTY_SETTINGS,
        status: { loading: false, loaded: false, error: null, lastSyncAt: null },
      });
      return null;
    }
    if (get().status.loading) return null;
    if (get().status.loaded && !force) return null;

    set((st) => ({ status: { ...st.status, loading: true, error: null } }));
    try {
      const [projects, stageConfigs, departments, settings, employees] = await Promise.all([
        pmsApi.pullProjects(),
        pmsSync.pull("stageConfigs"),
        pmsSync.pull("departments"),
        pmsApi.pullSettings(),
        pmsApi.pullEmployees(),
      ]);

      const nextSettings = settings || get().settings || EMPTY_SETTINGS;
      const threshold = nextSettings.atRiskThresholdPct;
      const now = Date.now();

      set((st) => ({
        projects: projects ? projects.map((p) => recalcProject(p, now, threshold)) : st.projects,
        stageConfigs: stageConfigs || st.stageConfigs,
        departments: departments || st.departments,
        employees: employees || st.employees,
        settings: nextSettings,
        statusColors: nextSettings.statusColors || st.statusColors,
        status: { loading: false, loaded: true, error: null, lastSyncAt: new Date().toISOString() },
      }));
      return true;
    } catch (err) {
      set((st) => ({ status: { ...st.status, loading: false, error: describeError(err) } }));
      return null;
    }
  },

  /** Re-read one project — after an action whose effects the server computed. */
  refreshProject: async (projectId) => {
    const fresh = await pmsApi.pullProject(projectId);
    if (fresh) applyServerProject(fresh);
    return fresh;
  },

  /** Empty on sign-out so the next user never sees the previous one's board. */
  clear: () => set({
    projects: [], stageConfigs: [], departments: [], employees: [],
    statusColors: {}, settings: EMPTY_SETTINGS, currentUserId: null,
    status: { loading: false, loaded: false, error: null, lastSyncAt: null },
  }),

  /** Re-read the tenant's saved settings, discarding unsaved edits. */
  resetSettings: async () => {
    const settings = await pmsApi.pullSettings();
    if (!settings) return null;
    set((st) => ({
      settings,
      statusColors: settings.statusColors || st.statusColors,
      projects: st.projects.map((p) => recalcProject(p, Date.now(), settings.atRiskThresholdPct)),
    }));
    return settings;
  },

  // ── Global recalculation ──

  /** Re-derive every project against the current clock. */
  recalcAll: () =>
    set((st) => {
      const threshold = st.settings.atRiskThresholdPct;
      const now = Date.now();
      const projects = st.projects.map((p) => recalcProject(p, now, threshold));
      return { projects };
    }),

  /** Discard anything local and re-read everything from the server. */
  resetPmsData: () => get().hydrate({ force: true }),

  // ── Settings ──

  updateSettings: (patch) => {
    set((st) => {
      const settings = { ...st.settings, ...patch };
      const projects = st.projects.map((p) =>
        recalcProject(p, Date.now(), settings.atRiskThresholdPct)
      );
      return { settings, projects };
    });
    // The thresholds drive the server's own at-risk and overdue maths, so they
    // have to live there, not in this tab.
    pmsApi.pushSettings(get().settings).catch((err) => {
      console.warn("[PMS] settings not saved:", describeError(err));
    });
    return get().settings;
  },

  // ── Department catalogue ──
  //
  // Unlike the rest of PMS Settings these actions commit immediately: a rename
  // has to rewrite the stages, tasks and templates that point at the old name,
  // which is not something to leave half-applied in a draft.

  addDepartment: (draft) => {
    const st = get();
    const errors = validateDepartment(draft, st.departments);
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const optimistic = {
      id: uid("dept"),
      name: draft.name.trim(),
      color: normaliseHex(draft.color) ?? DEPARTMENT_FALLBACK_COLOR,
    };
    set({ departments: [...st.departments, optimistic] });

    pmsSync.create("departments", optimistic)
      .then((saved) => {
        if (!saved) return;
        set((cur) => ({
          departments: cur.departments.map((d) => (d.id === optimistic.id ? saved : d)),
        }));
      })
      .catch((err) => {
        console.warn("[PMS] department not created:", describeError(err));
        set((cur) => ({ departments: cur.departments.filter((d) => d.id !== optimistic.id) }));
      });

    return { ok: true, errors: {} };
  },

  /** Rename and/or recolour a department, carrying every reference with it. */
  updateDepartment: (id, patch) => {
    const st = get();
    const target = st.departments.find((d) => d.id === id);
    if (!target) return { ok: false, errors: { name: "That department no longer exists." } };

    const draft = { name: target.name, color: target.color, ...patch };
    const errors = validateDepartment(draft, st.departments, id);
    if (Object.keys(errors).length > 0) return { ok: false, errors };

    const nextName = draft.name.trim();
    const departments = st.departments.map((d) =>
      d.id === id ? { ...d, name: nextName, color: normaliseHex(draft.color) } : d
    );
    const cascade = renameDepartmentIn({ ...st, departments }, target.name, nextName) ?? {};
    set({ departments, ...cascade });

    // The rename cascades through stages and templates server-side too, so the
    // projects are re-read rather than trusting the local cascade.
    pmsSync.update("departments", id, { name: nextName, color: normaliseHex(draft.color) })
      .then(() => (nextName !== target.name ? get().hydrate({ force: true }) : null))
      .catch((err) => console.warn("[PMS] department not saved:", describeError(err)));

    return { ok: true, errors: {}, renamed: nextName !== target.name };
  },

  /**
   * Remove a department. One that is driving live work can only go if its work
   * is reassigned — an orphaned department would leave stages pointing at a
   * name no chart, filter or capacity figure knows about.
   */
  deleteDepartment: (id, { reassignTo = null } = {}) => {
    const st = get();
    const target = st.departments.find((d) => d.id === id);
    if (!target) return { ok: false, reason: "NOT_FOUND" };
    if (st.departments.length <= 1) {
      return { ok: false, reason: "LAST_ONE", usage: computeDepartmentUsage(st.projects, st.stageConfigs, target.name) };
    }

    const usage = computeDepartmentUsage(st.projects, st.stageConfigs, target.name);
    if (usage.inUse && !reassignTo) return { ok: false, reason: "IN_USE", usage };
    if (reassignTo && !st.departments.some((d) => d.name === reassignTo && d.id !== id)) {
      return { ok: false, reason: "BAD_TARGET", usage };
    }

    // Move the work first, then drop the name it used to point at.
    const moved = usage.inUse ? renameDepartmentIn(st, target.name, reassignTo) : null;
    const base = moved ?? { projects: st.projects, stageConfigs: st.stageConfigs, settings: st.settings };

    const capacity = { ...(base.settings.departmentCapacity ?? {}) };
    delete capacity[target.name];

    const next = {
      ...base,
      settings: { ...base.settings, departmentCapacity: capacity },
      departments: st.departments.filter((d) => d.id !== id),
    };
    set(next);

    pmsSync.remove("departments", id)
      .then(() => (usage.inUse ? get().hydrate({ force: true }) : null))
      .catch((err) => {
        console.warn("[PMS] department not deleted:", describeError(err));
        get().hydrate({ force: true });
      });

    return { ok: true, usage, reassignedTo: usage.inUse ? reassignTo : null };
  },

  /** Recolour a reserved state (overdue). States are never renamed or removed. */
  setStatusColor: (key, color) => {
    const hex = normaliseHex(color);
    if (!hex) return { ok: false };
    const st = get();
    const statusColors = { ...st.statusColors, [key]: hex };
    set({ statusColors });
    pmsApi.pushSettings({ ...st.settings, statusColors }).catch((err) => {
      console.warn("[PMS] status colour not saved:", describeError(err));
    });
    return { ok: true };
  },

  /** What a department drives right now — for the delete confirmation. */
  getDepartmentUsage: (name) =>
    computeDepartmentUsage(get().projects, get().stageConfigs, name),

  /** Re-read the department catalogue from the server. */
  resetDepartments: async () => {
    const departments = await pmsSync.pull("departments");
    if (!departments) return { ok: false, reason: "UNAVAILABLE", stranded: [] };
    set({ departments });
    return { ok: true };
  },

  // ── Stage configuration templates ──

  addStageConfig: (config) =>
    set((st) => {
      // Append after the highest existing sequence rather than counting rows,
      // so an add can never collide with an existing position.
      const highest = st.stageConfigs.reduce(
        (max, c) => Math.max(max, Number(c.sequence) || 0),
        0
      );
      const stageConfigs = [
        ...st.stageConfigs,
        {
          id: uid("stage-cfg"),
          description: "",
          assignedRole: "",
          durationUnit: "Days",
          requiredApproval: false,
          requiredDocument: false,
          isActive: true,
          ...config,
          sequence: highest + 1,
        },
      ];
      const created = stageConfigs[stageConfigs.length - 1];
      pmsSync.create("stageConfigs", created)
        .then((saved) => {
          if (!saved) return;
          set((cur) => ({
            stageConfigs: cur.stageConfigs.map((c) => (c.id === created.id ? saved : c)),
          }));
        })
        .catch((err) => {
          console.warn("[PMS] stage template not created:", describeError(err));
          set((cur) => ({ stageConfigs: cur.stageConfigs.filter((c) => c.id !== created.id) }));
        });
      return { stageConfigs };
    }),

  updateStageConfig: (id, patch) =>
    set((st) => {
      const stageConfigs = st.stageConfigs.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      );
      pmsSync.update("stageConfigs", id, patch)
        .catch((err) => console.warn("[PMS] stage template not saved:", describeError(err)));
      return { stageConfigs };
    }),

  deleteStageConfig: (id) =>
    set((st) => {
      const stageConfigs = st.stageConfigs
        .filter((c) => c.id !== id)
        .map((c, i) => ({ ...c, sequence: i + 1 }));
      pmsSync.remove("stageConfigs", id)
        .catch((err) => {
          const msg = describeError(err);
          console.warn("[PMS] stage template not deleted:", msg);
          get().showToast(`Not deleted — ${msg}`, "error");
          get().hydrate({ force: true });
        });
      return { stageConfigs };
    }),

  /** Flip a template between Active and Inactive. */
  toggleStageConfigActive: (id) =>
    set((st) => {
      const stageConfigs = st.stageConfigs.map((c) =>
        c.id === id ? { ...c, isActive: !c.isActive } : c
      );
      pmsSync.act("stageConfigs", id, "toggle-active", {})
        .catch((err) => console.warn("[PMS] stage template not toggled:", describeError(err)));
      return { stageConfigs };
    }),

  /** What a template is currently driving, for the delete confirmation. */
  getStageConfigUsage: (id) => computeStageConfigUsage(get().projects, id),

  /** Move a template up (-1) or down (+1) in the execution order. */
  reorderStageConfig: (id, direction) =>
    set((st) => {
      const ordered = [...st.stageConfigs].sort((a, b) => a.sequence - b.sequence);
      const idx = ordered.findIndex((c) => c.id === id);
      const target = idx + direction;
      if (idx === -1 || target < 0 || target >= ordered.length) return {};
      [ordered[idx], ordered[target]] = [ordered[target], ordered[idx]];
      const stageConfigs = ordered.map((c, i) => ({ ...c, sequence: i + 1 }));
      pmsSync.act("stageConfigs", null, "reorder", { ids: stageConfigs.map((c) => c.id) })
        .catch((err) => console.warn("[PMS] order not saved:", describeError(err)));
      return { stageConfigs };
    }),

  // ── Projects ──

  addProject: (project) =>
    set((st) => {
      const id = project.id ?? uid("PRJ");
      const created = recalcProject(
        {
          overallCompletionPct: 0,
          actualCompletionDate: null,
          status: "Draft",
          priority: "Medium",
          currentStageId: null,
          stages: [],
          activityLog: [],
          ...project,
          id,
        },
        Date.now(),
        st.settings.atRiskThresholdPct
      );
      created.activityLog = [
        ...created.activityLog,
        makeActivity(
          "PROJECT_CREATED",
          "Project",
          id,
          `Project created${project.crmOrderId ? ` from sales order ${project.crmOrderId}` : ""}.`,
          project.projectManager
        ),
      ];
      const projects = [created, ...st.projects];
      pmsSync.create("projects", created)
        .then((saved) => {
          if (!saved) return;
          set((cur) => ({
            projects: cur.projects.map((p) => (p.id === id ? { ...saved, stages: saved.stages || [] } : p)),
          }));
        })
        .catch((err) => {
          console.warn("[PMS] project not created:", describeError(err));
          set((cur) => ({ projects: cur.projects.filter((p) => p.id !== id) }));
        });
      return { projects };
    }),

  /**
   * Create a project from a CRM sales order — the Stage 5 creation workflow.
   *
   * Does the whole thing in one write: allocates the next sequential code,
   * copies the order's commercial detail, initialises every chosen active
   * stage template in "Not Started", and logs the Project Created audit entry.
   * Returns the new project id so the caller can navigate to it.
   */
  createProjectFromOrder: async ({
    order,
    projectManager,
    priority = "Medium",
    startDate,
    stageConfigIds = null,
    stageWeights = null,
    specifications = "",
  }) => {
    if (!order) throw new Error("A CRM order is required to create a project.");
    // The server accepts a null manager (fresh workspaces may have no PM user
    // yet) — the modal only requires one when managers exist to choose from.

    // `POST /pms/projects/from-order/` allocates the sequential project code,
    // copies the order's commercial detail and instantiates the chosen stage
    // templates in one write (api.md §10.2), so none of that is done here.
    const created = await pmsApi.createProjectFromOrder({
      salesOrderId: order.id ?? order.orderNumber,
      orderId: order.id ?? order.orderNumber,
      orderNumber: order.orderNumber ?? order.id,
      projectManagerId: projectManager?.id ?? null,
      priority,
      startDate: startDate || new Date().toISOString(),
      stageConfigIds,
      stageWeights,
      specifications,
    });

    const project = created?.project || created;
    if (!project?.id) throw new Error("The server did not return the new project.");

    const full = (await pmsApi.pullProject(project.id)) || project;
    applyServerProject(full);
    return full.code || full.id;
  },

  updateStagePercentages: async (projectId, stagePercentages) => {
    const stageArray = Array.isArray(stagePercentages)
      ? stagePercentages
      : Object.entries(stagePercentages).map(([id, percentage]) => ({ id, percentage }));

    set((st) =>
      applyToProject(
        st,
        projectId,
        (p) => {
          const weightMap = new Map(
            stageArray.map((s) => [s.id || s.stageId, Number(s.percentage ?? s.weightPct ?? s.weight) || 0])
          );
          const updatedStages = (p.stages || []).map((stage) => {
            if (weightMap.has(stage.id)) {
              const pct = weightMap.get(stage.id);
              return { ...stage, percentage: pct, weightPct: pct };
            }
            return stage;
          });
          return {
            ...p,
            stages: updatedStages,
          };
        },
        makeActivity(
          "STAGES_CONFIGURED",
          "Project",
          projectId,
          "Stage percentage weights updated."
        )
      )
    );

    try {
      const saved = await pmsApi.updateStagePercentages(projectId, { stages: stageArray });
      if (saved) {
        applyServerProject(saved);
      }
    } catch (err) {
      console.warn("[PMS] updateStagePercentages failed:", describeError(err));
      const reverted = await pmsApi.pullProject(projectId);
      if (reverted) applyServerProject(reverted);
      throw err;
    }
  },

  addDynamicStage: async (projectId, stageData, stagePercentages = null) => {
    const payload = {
      ...stageData,
      stagePercentages,
    };
    const saved = await pmsApi.addStage(projectId, payload);
    if (saved) {
      const full = await pmsApi.pullProject(projectId);
      if (full) applyServerProject(full);
      return saved;
    }
    return null;
  },

  removeProjectStage: async (projectId, stageId) => {
    // 1. Optimistic local removal
    set((st) => ({
      projects: st.projects.map((p) => {
        if (p.id !== projectId) return p;
        const filtered = (p.stages || []).filter((s) => s.id !== stageId && s.sequence !== stageId);
        return recalcProject({ ...p, stages: filtered }, Date.now(), st.settings.atRiskThresholdPct);
      }),
    }));
    // 2. Server removal & resync
    try {
      await pmsApi.deleteStage(projectId, stageId);
    } catch (err) {
      console.warn('[PMS] remove stage error:', pmsApi.describeError(err));
    }
    const full = await pmsApi.pullProject(projectId);
    if (full) applyServerProject(full);
  },

  syncPipelineStages: async (projectId) => {
    const full = await pmsApi.pullProject(projectId);
    if (full) applyServerProject(full);
    return full;
  },

  updateProject: (projectId, patch) => {
    set((st) => applyToProject(st, projectId, (p) => ({ ...p, ...patch })));
    pushProject(projectId, () => pmsSync.update("projects", projectId, patch));
  },

  deleteProject: (projectId) => {
    const previous = get().projects;
    set({ projects: previous.filter((p) => p.id !== projectId) });
    pmsSync.remove("projects", projectId).catch((err) => {
      console.warn("[PMS] project not deleted:", describeError(err));
      set({ projects: previous });
    });
  },

  /** Build a project's runtime stages from the active templates. */
  applyStageTemplate: (projectId, configIds = null) => {
    set((st) => {
      const configs = st.stageConfigs
        .filter((c) => c.isActive && (!configIds || configIds.includes(c.id)))
        .sort((a, b) => a.sequence - b.sequence);

      return applyToProject(
        st,
        projectId,
        (p) => ({
          ...p,
          stages: configs.map((c, i) => ({
            id: uid("stg-inst"),
            stageConfigId: c.id,
            name: c.name,
            sequence: i + 1,
            department: c.department,
            assignedTeam: null,
            assignedUser: null,
            completionPct: 0,
            plannedDuration: c.defaultDuration,
            durationUnit: c.durationUnit,
            startDateTime: null,
            expectedCompletionDateTime: null,
            actualCompletionDateTime: null,
            status: "Not Started",
            tasks: [],
            documents: [],
            approvals: [],
          })),
        }),
        makeActivity(
          "STAGES_CONFIGURED",
          "Project",
          projectId,
          `${configs.length} stages applied from the template library.`
        )
      );
    });
    // The server instantiates the templates, so its stage ids are the real ones.
    pushProject(projectId, () => pmsApi.applyStageTemplate(projectId, configIds ? { stageConfigIds: configIds } : {}));
  },

  /**
   * Close a project — the Stage 12 sign-off.
   *
   * Enforces the completion rule (every stage Completed, plus a PM sign-off)
   * and writes the immutable completion record. `force` exists for the case
   * where a manager consciously closes work that is not formally finished; it
   * still requires an actor, because an unsigned closure is not a sign-off.
   */
  completeProject: (projectId, actor = null, { force = false } = {}) => {
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) throw new Error(`Unknown project ${projectId}`);

    if (!actor) {
      const err = new Error("A project manager must sign off before a project can be completed.");
      err.blockers = [{ code: "NO_SIGNOFF", label: "Sign-off is required.", hard: true }];
      throw err;
    }

    const blockers = validateProjectCompletion(project);
    const blocking = blockers.filter((b) => b.hard && b.code !== "ALREADY_COMPLETED");
    if (blockers.some((b) => b.code === "ALREADY_COMPLETED")) {
      const err = new Error("This project is already completed.");
      err.blockers = blockers;
      throw err;
    }
    if (blocking.length > 0 && !force) {
      const err = new Error(blocking.map((b) => b.label).join(" "));
      err.blockers = blocking;
      throw err;
    }

    const metrics = computeProjectCompletionMetrics(project, Date.now(), actor);

    set((st) =>
      applyToProject(
        st,
        projectId,
        (p) => ({
          ...p,
          status: "Completed",
          actualCompletionDate: metrics.actualCompletionDate,
          // Frozen at closure; never recomputed by recalcProject.
          completion: { ...metrics, forced: force && blocking.length > 0 },
        }),
        (() => {
          const entry = makeActivity(
            "PROJECT_COMPLETED",
            "Project",
            projectId,
            `Project signed off by ${actor.name} — ${metrics.totalDurationDays} day turnaround.`,
            actor
          );
          entry.from = project.status;
          entry.to = "Completed";
          if (force && blocking.length > 0) {
            entry.comments = `Closed with ${blocking.length} stage(s) still open.`;
          }
          return entry;
        })()
      )
    );

    // `POST /pms/projects/{id}/complete/` writes the sign-off record and the
    // completion metrics; `force` is passed through so the server logs that the
    // closure was deliberate.
    pushProject(projectId, () => pmsApi.completeProject(projectId, {
      signedOffById: actor?.id,
      signedOffBy: actor?.name,
      force,
    }));

    return metrics;
  },

  // ── Stage instances ──

  /**
   * Assign a stage to a department, team and employee — the Stage 8 workflow.
   *
   * Stamps the start time, lets the expected completion recalculate from the
   * (possibly overridden) duration, and injects an actionable task for the
   * assignee so the work shows up in their /pms/my-tasks list. The audit entry
   * records who assigned what to whom.
   */
  assignStage: (
    projectId,
    stageId,
    {
      assignedUser,
      assignedTeam,
      department,
      plannedDuration,
      durationUnit,
      startDateTime,
      status = "Assigned",
      notes = "",
      actor = null,
      injectTask = true,
    } = {}
  ) => {
   
    set((st) => {
      const project = st.projects.find((p) => p.id === projectId);
      const target = project?.stages.find((s2) => s2.id === stageId);
      const stageName = target?.name ?? "stage";
      const nextDepartment = department ?? target?.department;

      const assignment = makeActivity(
        "STAGE_ASSIGNED",
        "Stage",
        stageId,
        `${actor?.name ?? "PM"} assigned Stage ${target?.sequence ?? "?"} (${stageName}) to ${
          assignedUser?.name ?? assignedTeam ?? "the team"
        }${nextDepartment ? ` in ${nextDepartment}` : ""}.`,
        actor
      );
      assignment.from = target?.assignedUser?.name ?? "Unassigned";
      assignment.to = assignedUser?.name ?? assignedTeam ?? "Team";
      if (notes) assignment.comments = notes;

      return applyToProject(
        st,
        projectId,
        (p) => ({
          ...p,
          currentStageId: stageId,
          currentDepartment: nextDepartment ?? p.currentDepartment,
          stages: p.stages.map((stage) => {
            if (stage.id !== stageId) return stage;

            const start = startDateTime ?? stage.startDateTime ?? new Date().toISOString();
            const duration = plannedDuration ?? stage.plannedDuration;
            const unit = durationUnit ?? stage.durationUnit;

            const next = {
              ...stage,
              assignedUser: assignedUser ?? stage.assignedUser,
              assignedTeam: assignedTeam ?? stage.assignedTeam,
              department: nextDepartment ?? stage.department,
              plannedDuration: duration,
              durationUnit: unit,
              startDateTime: start,
              status,
            };

            // Give the assignee something actionable. A stage with no tasks
            // tracks its own percentage, so the injected task inherits it and
            // the rollup does not jump backwards.
            if (injectTask && assignedUser?.id) {
              const alreadyHasOne = (stage.tasks ?? []).some(
                (t) => t.assignedUser?.id === assignedUser.id && t.status !== "Completed"
              );
              if (!alreadyHasOne) {
                next.tasks = [
                  ...(stage.tasks ?? []),
                  {
                    id: uid("TSK"),
                    stageId,
                    projectId,
                    taskName: `${stageName} — ${nextDepartment ?? "work"}`,
                    description:
                      notes || `Complete the ${stageName} stage and submit it for review.`,
                    assignedUser: { id: assignedUser.id, name: assignedUser.name },
                    department: nextDepartment ?? stage.department,
                    startDate: start,
                    dueDate:
                      computeExpectedCompletion(start, duration, unit) ?? start,
                    completionPct:
                      (stage.tasks ?? []).length === 0 ? clampPct(stage.completionPct ?? 0) : 0,
                    priority: p.priority ?? "Medium",
                    status: status === "In Progress" ? "In Progress" : "Not Started",
                  },
                ];
              }
            }

            return next;
          }),
        }),
        assignment
      );
    });
    // Assignment is a server action: it notifies the assignee and re-times the stage.
    pushProject(projectId, () => pmsApi.assignStage(projectId, stageId, { assignedUserId: assignedUser?.id, assignedTeam, department, plannedDuration, durationUnit, startDateTime, status, notes }));
  },

  /**
   * Start a stage: stamps the start time (first start only) and moves it to
   * In Progress, which is what makes the expected-completion clock run.
   */
  startStage: (projectId, stageId, actor) => {
    set((st) =>
      applyToProject(
        st,
        projectId,
        (p) => ({
          ...p,
          currentStageId: stageId,
          currentDepartment:
            p.stages.find((s2) => s2.id === stageId)?.department ?? p.currentDepartment,
          stages: p.stages.map((stage) =>
            stage.id !== stageId
              ? stage
              : {
                  ...stage,
                  startDateTime: stage.startDateTime ?? new Date().toISOString(),
                  status: "In Progress",
                }
          ),
        }),
        makeActivity("STAGE_STARTED", "Stage", stageId, "Stage started.", actor)
      )
    );
    // The server stamps the real start time and moves the project pointer.
    pushProject(projectId, () => pmsApi.startStage(projectId, stageId));
  },

  updateStage: (projectId, stageId, patch) => {
    set((st) =>
      applyToProject(st, projectId, (p) => ({
        ...p,
        stages: p.stages.map((stage) =>
          stage.id === stageId ? { ...stage, ...patch } : stage
        ),
      }))
    );
    pushProject(projectId, () => pmsApi.patchStage(projectId, stageId, patch));
  },

  /** Set a stage's own progress. Ignored once the stage has tasks driving it. */
  setStageProgress: (projectId, stageId, pct) => {
    set((st) =>
      applyToProject(st, projectId, (p) => ({
        ...p,
        stages: p.stages.map((stage) =>
          stage.id === stageId ? { ...stage, completionPct: clampPct(pct) } : stage
        ),
      }))
    );
    pushProject(projectId, () => pmsApi.setStageProgress(projectId, stageId, { completionPct: clampPct(pct) }));
  },

  setStageStatus: (projectId, stageId, status, actor) => {
    set((st) =>
      applyToProject(
        st,
        projectId,
        (p) => ({
          ...p,
          stages: p.stages.map((stage) =>
            stage.id !== stageId
              ? stage
              : {
                  ...stage,
                  status,
                  actualCompletionDateTime:
                    status === "Completed"
                      ? stage.actualCompletionDateTime ?? new Date().toISOString()
                      : stage.actualCompletionDateTime,
                }
          ),
        }),
        makeActivity("STAGE_STATUS_CHANGED", "Stage", stageId, `Stage marked ${status}.`, actor)
      )
    );
    pushProject(projectId, () => pmsApi.setStageStatus(projectId, stageId, { status }));
  },

  /** Complete a stage and advance the project pointer to the next one. */
  completeStageAndAdvance: (projectId, stageId, actor) => {
    set((st) =>
      applyToProject(
        st,
        projectId,
        (p) => {
          const ordered = [...p.stages].sort((a, b) => a.sequence - b.sequence);
          const idx = ordered.findIndex((s2) => s2.id === stageId);
          const next = idx >= 0 ? ordered[idx + 1] : undefined;
          const nowIso = new Date().toISOString();

          return {
            ...p,
            currentStageId: next?.id ?? stageId,
            currentDepartment: next?.department ?? p.currentDepartment,
            stages: p.stages.map((stage) => {
              if (stage.id === stageId) {
                return {
                  ...stage,
                  status: "Completed",
                  completionPct: 100,
                  actualCompletionDateTime: stage.actualCompletionDateTime ?? nowIso,
                  tasks: stage.tasks.map((t) => ({
                    ...t,
                    completionPct: 100,
                    status: "Completed",
                  })),
                };
              }
              if (next && stage.id === next.id) {
                return { ...stage, status: "Assigned", startDateTime: nowIso };
              }
              return stage;
            }),
          };
        },
        makeActivity(
          "STAGE_HANDOFF",
          "Stage",
          stageId,
          "Stage completed and handed off to the next department.",
          actor
        )
      )
    );
    // Advancing is the server's call: it owns the stage order and the rollup.
    pushProject(projectId, () => pmsApi.completeStage(projectId, stageId));
  },

  /**
   * Hand a completed stage to the next department — the Stage 8 protocol:
   * current department completes → PM review → next department starts.
   *
   * Closes the current stage with its actual completion time, unlocks and
   * assigns the next stage in sequence, and writes a handoff record carrying
   * From User → To User and From Dept → To Dept with the handover notes.
   */
  handoffStage: (
    projectId,
    stageId,
    { recipient, recipientTeam, notes = "", checklist = [], actor = null, force = false } = {}
  ) => {
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) throw new Error(`Unknown project ${projectId}`);

    const ordered = [...(project.stages ?? [])].sort((a, b) => a.sequence - b.sequence);
    const index = ordered.findIndex((s) => s.id === stageId);
    const stage = ordered[index];
    if (!stage) throw new Error(`Unknown stage ${stageId}`);

    const config = state.stageConfigs.find((c) => c.id === stage.stageConfigId);
    const blockers = validateStageHandoff(stage, config);
    const hardBlockers = blockers.filter((b) => b.hard);
    if (hardBlockers.length > 0 && !force) {
      const err = new Error(hardBlockers.map((b) => b.label).join(" "));
      err.blockers = hardBlockers;
      throw err;
    }

    const nextStage = ordered[index + 1] ?? null;
    const nowIso = new Date().toISOString();

    const handoff = makeActivity(
      "STAGE_HANDOFF",
      "Stage",
      stageId,
      nextStage
        ? `${stage.name} completed and handed off to ${nextStage.name}.`
        : `${stage.name} completed — final stage in the pipeline.`,
      actor
    );
    handoff.from = `${stage.assignedUser?.name ?? "Unassigned"} · ${stage.department}`;
    handoff.to = nextStage
      ? `${recipient?.name ?? "Unassigned"} · ${nextStage.department}`
      : "Project close-out";
    if (notes) handoff.comments = notes;
    if (checklist.length > 0) handoff.checklist = checklist;

    set((st) =>
      applyToProject(
        st,
        projectId,
        (p) => ({
          ...p,
          currentStageId: nextStage?.id ?? stageId,
          currentDepartment: nextStage?.department ?? p.currentDepartment,
          stages: p.stages.map((s2) => {
            if (s2.id === stageId) {
              return {
                ...s2,
                status: "Completed",
                completionPct: 100,
                actualCompletionDateTime: s2.actualCompletionDateTime ?? nowIso,
                tasks: (s2.tasks ?? []).map((t) => ({
                  ...t,
                  completionPct: 100,
                  status: "Completed",
                })),
              };
            }
            if (nextStage && s2.id === nextStage.id) {
              return {
                ...s2,
                assignedUser: recipient ?? s2.assignedUser,
                assignedTeam: recipientTeam ?? s2.assignedTeam,
                startDateTime: s2.startDateTime ?? nowIso,
                status: "Assigned",
              };
            }
            return s2;
          }),
        }),
        handoff
      )
    );

    // The server re-checks the handoff prerequisites and notifies the next
    // department, so the local pointer move is only the optimistic half.
    pushProject(projectId, () => pmsApi.handoffStage(projectId, stageId, {
      recipientId: recipient?.id,
      notes,
      force,
    }));

    return nextStage?.id ?? null;
  },

  // ── Delay tracking ──

  /** Record a delay against a stage with its root cause and recovery date. */
  logDelay: (projectId, stageId, delayDetails = {}, actor = null) => {
    const errors = validateDelayEntry(delayDetails);
    if (Object.keys(errors).length > 0) {
      const err = new Error(Object.values(errors).join(" "));
      err.fieldErrors = errors;
      throw err;
    }

    set((st) =>
      applyToProject(
        st,
        projectId,
        (p) => ({
          ...p,
          stages: p.stages.map((stage) =>
            stage.id !== stageId
              ? stage
              : {
                  ...stage,
                  status: "Delayed",
                  delayDetails: {
                    isDelayed: true,
                    category: "Other",
                    reason: "",
                    responsibleDepartment: stage.department,
                    responsibleUser: stage.assignedUser?.name ?? "",
                    delayStartDateTime:
                      stage.delayDetails?.delayStartDateTime ?? new Date().toISOString(),
                    expectedRecoveryDate: null,
                    resolutionNotes: "",
                    ...delayDetails,
                  },
                }
          ),
        }),
        (() => {
          const entry = makeActivity(
            "DELAY_LOGGED",
            "Stage",
            stageId,
            `Delay logged — ${delayDetails.category}: ${delayDetails.reason}`,
            actor
          );
          entry.comments = delayDetails.reason;
          return entry;
        })()
      )
    );
    pushProject(projectId, () => pmsApi.logDelay(projectId, stageId, delayDetails));
  },

  /** Revise the recovery plan without clearing the delay. */
  updateRecoveryPlan: (projectId, stageId, { expectedRecoveryDate, resolutionNotes, category, responsibleUser } = {}, actor = null) => {
    set((st) => {
      const before = st.projects
        .find((p) => p.id === projectId)
        ?.stages.find((s2) => s2.id === stageId)?.delayDetails?.expectedRecoveryDate;

      return applyToProject(
        st,
        projectId,
        (p) => ({
          ...p,
          stages: p.stages.map((stage) =>
            stage.id !== stageId
              ? stage
              : {
                  ...stage,
                  delayDetails: {
                    ...(stage.delayDetails ?? { isDelayed: true }),
                    ...(expectedRecoveryDate !== undefined ? { expectedRecoveryDate } : {}),
                    ...(resolutionNotes !== undefined ? { resolutionNotes } : {}),
                    ...(category !== undefined ? { category } : {}),
                    ...(responsibleUser !== undefined ? { responsibleUser } : {}),
                  },
                }
          ),
        }),
        (() => {
          const entry = makeActivity(
            "RECOVERY_PLAN_UPDATED",
            "Stage",
            stageId,
            "Recovery plan updated.",
            actor
          );
          if (expectedRecoveryDate !== undefined) {
            entry.from = before ? new Date(before).toLocaleDateString("en-GB") : "—";
            entry.to = expectedRecoveryDate
              ? new Date(expectedRecoveryDate).toLocaleDateString("en-GB")
              : "—";
          }
          if (resolutionNotes) entry.comments = resolutionNotes;
          return entry;
        })()
      );
    });
    pushProject(projectId, () => pmsApi.updateRecoveryPlan(projectId, stageId, { expectedRecoveryDate, resolutionNotes, category, responsibleUser }));
  },

  /** Clear a delay and return the stage to the running pipeline. */
  resolveDelay: (projectId, stageId, resolutionNotes = "", actor = null) => {
    set((st) =>
      applyToProject(
        st,
        projectId,
        (p) => ({
          ...p,
          stages: p.stages.map((stage) =>
            stage.id !== stageId
              ? stage
              : {
                  ...stage,
                  status: "In Progress",
                  delayDetails: {
                    ...stage.delayDetails,
                    isDelayed: false,
                    resolvedAt: new Date().toISOString(),
                    resolutionNotes: resolutionNotes || stage.delayDetails?.resolutionNotes || "",
                  },
                }
          ),
        }),
        (() => {
          const entry = makeActivity("DELAY_RESOLVED", "Stage", stageId, "Delay resolved.", actor);
          entry.from = "Delayed";
          entry.to = "In Progress";
          if (resolutionNotes) entry.comments = resolutionNotes;
          return entry;
        })()
      )
    );
    pushProject(projectId, () => pmsApi.resolveDelay(projectId, stageId, { resolutionNotes }));
  },

  // ── Tasks ──

  addTask: (projectId, stageId, task) => {
   
    set((st) =>
      applyToProject(st, projectId, (p) => ({
        ...p,
        stages: p.stages.map((stage) =>
          stage.id !== stageId
            ? stage
            : {
                ...stage,
                tasks: [
                  ...stage.tasks,
                  {
                    id: uid("TSK"),
                    stageId,
                    projectId,
                    completionPct: 0,
                    priority: "Medium",
                    status: "Not Started",
                    department: stage.department,
                    ...task,
                  },
                ],
              }
        ),
      }))
    );
    pushProject(projectId, () => pmsApi.addTask(projectId, stageId, task));
  },

  updateTask: (projectId, stageId, taskId, patch, actor = null) => {
   
    set((st) => {
      // Capture the previous percentage so the audit trail can record the
      // before → after the spec asks for.
      const previous = st.projects
        .find((p) => p.id === projectId)
        ?.stages.find((s2) => s2.id === stageId)
        ?.tasks.find((t) => t.id === taskId);

      const progressChanged =
        patch.completionPct !== undefined &&
        clampPct(patch.completionPct) !== clampPct(previous?.completionPct ?? 0);

      const activity = progressChanged
        ? (() => {
            const entry = makeActivity(
              "PROGRESS_UPDATED",
              "Task",
              taskId,
              `${previous?.taskName ?? "Task"} progress updated.`,
              actor
            );
            entry.from = `${clampPct(previous?.completionPct ?? 0)}%`;
            entry.to = `${clampPct(patch.completionPct)}%`;
            return entry;
          })()
        : undefined;

      return applyToProject(st, projectId, (p) => ({
        ...p,
        stages: p.stages.map((stage) =>
          stage.id !== stageId
            ? stage
            : {
                ...stage,
                // Progress and status are kept consistent in both directions:
                // 100% means Completed, and reopening a task must drop it below
                // 100% or the stage average would still count it as finished.
                tasks: stage.tasks.map((t) => {
                  if (t.id !== taskId) return t;
                  const next = { ...t, ...patch };
                  if (patch.completionPct !== undefined) {
                    next.completionPct = clampPct(patch.completionPct);
                    if (next.completionPct === 100) next.status = "Completed";
                    else if (next.status === "Completed") next.status = "In Progress";
                  }
                  if (patch.status === "Completed") {
                    next.completionPct = 100;
                  } else if (patch.status !== undefined && next.completionPct === 100) {
                    next.completionPct = 99;
                  }
                  return next;
                }),
              }
        ),
      }), activity);
    });
    pushProject(projectId, () => pmsApi.patchTask(projectId, stageId, taskId, patch));
  },

  deleteTask: (projectId, stageId, taskId) => {
   
    set((st) =>
      applyToProject(st, projectId, (p) => ({
        ...p,
        stages: p.stages.map((stage) =>
          stage.id !== stageId
            ? stage
            : { ...stage, tasks: stage.tasks.filter((t) => t.id !== taskId) }
        ),
      }))
    );
    pushProject(projectId, () => pmsApi.deleteTask(projectId, stageId, taskId));
  },

  // ── Design documents & versioning ──

  /** Upload a proof. Version auto-increments from the stage's existing stack. */
  addDocument: (projectId, stageId, doc, actor) => {
   
    set((st) =>
      applyToProject(
        st,
        projectId,
        (p) => ({
          ...p,
          stages: p.stages.map((stage) => {
            if (stage.id !== stageId) return stage;
            const nextVersion =
              stage.documents.reduce((max, d) => Math.max(max, d.version ?? 0), 0) + 1;
            return {
              ...stage,
              documents: [
                ...stage.documents,
                {
                  id: uid("DOC"),
                  version: nextVersion,
                  fileSize: "—",
                  previewUrl: "",
                  uploadedAt: new Date().toISOString(),
                  comments: "",
                  approvalStatus: "Pending",
                  ...doc,
                },
              ],
            };
          }),
        }),
        makeActivity(
          "DOCUMENT_UPLOADED",
          "Stage",
          stageId,
          `Design proof uploaded: ${doc?.fileName ?? "document"}.`,
          actor
        )
      )
    );
    pushProject(projectId, () => pmsApi.addDocument(projectId, stageId, doc));
  },

  /**
   * Send a proof out for sign-off — the "Send to Client" step.
   *
   * Opens a Pending approval record against the document and parks the stage in
   * Under Review, so the proofing centre can tell "not circulated yet" apart
   * from "waiting on the client".
   */
  requestApproval: (projectId, stageId, documentId, { approverType = "Client", approverName, actor = null } = {}) => {
   
    set((st) => {
      const project = st.projects.find((p) => p.id === projectId);
      const stage = project?.stages.find((s2) => s2.id === stageId);
      const doc = stage?.documents.find((d) => d.id === documentId);

      return applyToProject(
        st,
        projectId,
        (p) => ({
          ...p,
          stages: p.stages.map((s2) =>
            s2.id !== stageId
              ? s2
              : {
                  ...s2,
                  status: "Under Review",
                  approvals: [
                    ...(s2.approvals ?? []),
                    {
                      id: uid("APR"),
                      documentId,
                      approverType,
                      approverName: approverName ?? p.customerName ?? "Client",
                      requestedBy: actor,
                      requestedAt: new Date().toISOString(),
                      status: "Pending",
                      decisionAt: null,
                      comments: "",
                    },
                  ],
                }
          ),
        }),
        makeActivity(
          "APPROVAL_REQUESTED",
          "Document",
          documentId,
          `${doc?.fileName ?? "Proof"} sent to ${approverName ?? project?.customerName ?? "the client"} for approval.`,
          actor
        )
      );
    });
    pushProject(projectId, () => pmsApi.requestApproval(projectId, stageId, documentId, { approverType, approverName }));
  },

  /**
   * Record a decision on a proof.
   *
   * Resolves the open Pending request for that document rather than stacking a
   * second record beside it, so the approvals list reads as one thread per
   * circulation. Past versions are never touched.
   */
  decideDocument: (
    projectId,
    stageId,
    documentId,
    decision,
    { comments = "", revisionReason = "", approverName = "", approverType = "Client" } = {},
    actor = null
  ) => {
    const errors = validateApprovalDecision(decision, { revisionReason, approverName });
    if (Object.keys(errors).length > 0) {
      const err = new Error(Object.values(errors).join(" "));
      err.fieldErrors = errors;
      throw err;
    }

    const nowIso = new Date().toISOString();
    const isRevision = decision === "Need Improvement";

    set((st) =>
      applyToProject(
        st,
        projectId,
        (p) => ({
          ...p,
          stages: p.stages.map((stage) => {
            if (stage.id !== stageId) return stage;

            const approvals = stage.approvals ?? [];
            const openIndex = approvals.findIndex(
              (a) => a.documentId === documentId && a.status === "Pending"
            );

            const resolved = {
              id: openIndex >= 0 ? approvals[openIndex].id : uid("APR"),
              documentId,
              approverType,
              approverName,
              requestedBy: openIndex >= 0 ? approvals[openIndex].requestedBy : actor,
              requestedAt: openIndex >= 0 ? approvals[openIndex].requestedAt : nowIso,
              status: decision,
              decisionAt: nowIso,
              comments,
              ...(isRevision ? { revisionReason } : {}),
            };

            return {
              ...stage,
              status: isRevision ? "Need Improvement" : "Approved",
              // Only the addressed version changes; earlier versions are frozen.
              documents: stage.documents.map((d) =>
                d.id !== documentId
                  ? d
                  : {
                      ...d,
                      approvalStatus: decision,
                      comments: comments || d.comments,
                      ...(isRevision ? { revisionReason } : {}),
                    }
              ),
              approvals:
                openIndex >= 0
                  ? approvals.map((a, i) => (i === openIndex ? resolved : a))
                  : [...approvals, resolved],
            };
          }),
        }),
        (() => {
          const entry = makeActivity(
            isRevision ? "REVISION_REQUESTED" : "DOCUMENT_APPROVED",
            "Document",
            documentId,
            isRevision
              ? `${approverName} requested a revision.`
              : `${approverName} approved the proof.`,
            actor
          );
          entry.from = "Pending";
          entry.to = decision;
          if (isRevision) entry.comments = revisionReason;
          else if (comments) entry.comments = comments;
          return entry;
        })()
      )
    );

    // The decision is the client's answer on a shared proof, so it has to be
    // recorded server-side where the approval link can see it.
    pushProject(projectId, () => pmsApi.decideDocument(projectId, stageId, documentId, {
      decision,
      comments,
      revisionReason,
      approverName,
      approverType,
    }));
  },

  // ── Audit trail ──

  logActivity: (projectId, action, entityType, entityId, description, actor) =>
    set((st) =>
      applyToProject(
        st,
        projectId,
        (p) => p,
        makeActivity(action, entityType, entityId, description, actor)
      )
    ),

  // ── Selectors ──

  getProjectById: (projectId) => get().projects.find((p) => p.id === projectId) ?? null,

  getStage: (projectId, stageId) => {
    const project = get().projects.find((p) => p.id === projectId);
    return project?.stages.find((s2) => s2.id === stageId) ?? null;
  },

  getCurrentStage: (projectId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return null;
    return project.stages.find((s2) => s2.id === project.currentStageId) ?? null;
  },

  getProjectsByStatus: (status) =>
    status && status !== "all"
      ? get().projects.filter((p) => p.status === status)
      : get().projects,

  /** Every stage currently flagged Delayed, flattened with project context. */
  getDelayedStages: () =>
    get().projects.flatMap((p) =>
      p.stages
        .filter((s2) => s2.status === "Delayed" || s2.delayDetails?.isDelayed)
        .map((s2) => ({
          projectId: p.id,
          projectCustomer: p.customerName,
          projectPriority: p.priority,
          stage: s2,
          timing: getStageTiming(s2),
        }))
    ),

  /** Every task assigned to one user across all projects. */
  getTasksForUser: (userId) =>
    get().projects.flatMap((p) =>
      p.stages.flatMap((s2) =>
        s2.tasks
          .filter((t) => t.assignedUser?.id === userId)
          .map((t) => ({
            ...t,
            projectId: p.id,
            projectCustomer: p.customerName,
            stageName: s2.name,
          }))
      )
    ),

  getCurrentUser: () => {
    const { employees, currentUserId } = get();
    return employees.find((e) => e.id === currentUserId) ?? null;
  },

  /** Projects managed by the current user — backs /pms/my-projects. */
  getMyProjects: () => {
    const { projects, currentUserId } = get();
    return projects.filter((p) => p.projectManager?.id === currentUserId);
  },

  /** Unfinished tasks assigned to the current user — backs /pms/my-tasks. */
  getMyPendingTasks: () => {
    const { currentUserId } = get();
    return get()
      .getTasksForUser(currentUserId)
      .filter((t) => t.status !== "Completed");
  },

  /** Live counters for the sidebar nav badges. */
  getNavBadges: () => computeNavBadges(get().projects, get().currentUserId),

  // ── Stage 4 dashboard selectors ──

  getDashboardMetrics: () => computeDashboardMetrics(get().projects),

  getPipelineByDepartment: () => computePipelineByDepartment(get().projects),

  getDepartmentWorkload: () => {
    const { projects, settings } = get();
    return computeDepartmentWorkload(
      projects,
      settings.departmentCapacity ?? {},
      settings.defaultDepartmentCapacity ?? 20
    );
  },

  getDelayWatchlist: () => computeDelayWatchlist(get().projects),

  getUpcomingDeadlines: (days = 7) => computeUpcomingDeadlines(get().projects, days),

  /** Merged, newest-first audit feed across every project. */
  getRecentActivity: (limit = 20) =>
    get()
      .projects.flatMap((p) =>
        (p.activityLog ?? []).map((a) => ({
          ...a,
          projectId: p.id,
          projectCustomer: p.customerName,
        }))
      )
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit),

  /** Headline metrics for the executive dashboard. */
  getKpis: () => {
    const projects = get().projects;
    const active = projects.filter(
      (p) => p.status !== "Completed" && p.status !== "Draft"
    );
    const delayed = projects.filter((p) => p.status === "Delayed");
    const atRisk = projects.filter((p) => p.status === "At Risk");
    const completed = projects.filter((p) => p.status === "Completed");
    const avgCompletion = projects.length
      ? Math.round(
          projects.reduce((acc, p) => acc + (p.overallCompletionPct ?? 0), 0) /
            projects.length
        )
      : 0;
    const orderValue = projects.reduce(
      (acc, p) => acc + (p.productDetails?.orderValue ?? 0),
      0
    );
    return {
      totalProjects: projects.length,
      activeProjects: active.length,
      delayedProjects: delayed.length,
      atRiskProjects: atRisk.length,
      completedProjects: completed.length,
      avgCompletionPct: avgCompletion,
      totalOrderValue: orderValue,
    };
  },
}));

/**
 * Check if the given user is the creator of the project.
 * Allows superuser/admin by default, and defaults to true if project has no creator set (legacy projects).
 */
export function isProjectCreator(project, user) {
  if (!project || !user) return false;
  if (user.role === 'Admin' || user.role === 'Superadmin' || user.isSuperuser) return true;
  const creatorId = project.createdBy?.id || project.createdById || project.createdBy;
  if (!creatorId) return true;
  return String(creatorId) === String(user.id);
}

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const usePmsStore = lazyStore(usePmsStoreBase, "pms");
