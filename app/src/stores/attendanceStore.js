import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import {
  hrmsSync,
  pullTracked,
  pullFlexibility,
  pushFlexibility,
  pullTodayPunch,
  recordPunch,
  formatClock12,
  saveAttendanceDay,
  approveRegularization,
  rejectRegularization,
  isServerId,
} from "../services/hrmsSync";

function formatSeconds(secs) {
  if (!secs || secs < 0) return "00h 00m";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

/** `09:30`, `09:30:00` or an ISO instant → local `HH:MM`; `''` otherwise. */
function toClock(value) {
  if (!value || value === "—") return "";
  const text = String(value);
  if (text.includes("T")) {
    const d = new Date(text);
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const m = text.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** `YYYY-MM-DD` or `DD/MM/YYYY` → `YYYY-MM-DD`; `''` when unrecognised. */
function toISODateSafe(value) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

const DEFAULT_TODAY_PUNCH = {
  hasEmployee: true,
  employee: null,
  status: "Not Punched In",
  isPunchedIn: false,
  dayCompleted: false,
  canPunchIn: true,
  canPunchOut: false,
  isEarlyOut: false,
  earlyLeavingMinutes: 0,
  shiftStart: "09:30",
  shiftEnd: "18:30",
  fullDayHours: 8,
  halfDayThresholdHours: 4,
  hasPendingRegularization: false,
  attendanceStatus: null,
  firstPunch: null,
  lastPunch: null,
  firstPunchIso: null,
  lastPunchIso: null,
  workingSeconds: 0,
  formattedWorkingTime: "00h 00m",
  workingHours: 0,
  lateMinutes: 0,
  overtimeHours: 0,
  punches: [],
  pairs: [],
  loading: false,
  error: null,
};

function mapPunchPayload(res) {
  if (!res) return null;
  return {
    hasEmployee: res.has_employee !== false,
    employee: res.employee || null,
    status: res.status || "Not Punched In",
    isPunchedIn: Boolean(res.is_punched_in),
    dayCompleted: Boolean(res.day_completed),
    canPunchIn: res.can_punch_in !== undefined ? Boolean(res.can_punch_in) : (!res.is_punched_in && !res.day_completed),
    canPunchOut: res.can_punch_out !== undefined ? Boolean(res.can_punch_out) : Boolean(res.is_punched_in),
    isEarlyOut: Boolean(res.is_early_out),
    earlyLeavingMinutes: res.early_leaving_minutes || res.early_minutes || 0,
    shiftStart: res.shift_start || "09:30",
    shiftEnd: res.shift_end || "18:30",
    fullDayHours: res.full_day_hours || 8,
    halfDayThresholdHours: res.half_day_threshold_hours || 4,
    hasPendingRegularization: Boolean(res.has_pending_regularization),
    attendanceStatus: res.attendance_status || null,
    // Shown in the browser's own clock, so the header reads the user's live
    // local time whatever zone the server formats in.
    firstPunch: formatClock12(res.first_punch_iso) || res.first_punch || null,
    lastPunch: formatClock12(res.last_punch_iso) || res.last_punch || null,
    firstPunchIso: res.first_punch_iso || null,
    lastPunchIso: res.last_punch_iso || null,
    workingSeconds: res.working_seconds || 0,
    formattedWorkingTime: res.formatted_working_time || "00h 00m",
    workingHours: res.working_hours || 0,
    lateMinutes: res.late_minutes || 0,
    overtimeHours: res.overtime_hours || 0,
    punches: (res.punches || []).map((p) => ({
      ...p,
      timeDisplay: formatClock12(p.punchTime) || p.timeDisplay,
    })),
    pairs: res.pairs || [],
    loading: false,
    error: null,
  };
}

const useAttendanceStoreBase = create((set, get) => ({
  /** Load this module's collections from the API. */
  hydrate: async () => {
    const rows = await Promise.all([
      pullTracked("attendance"),
      pullTracked("attendanceRegularizations"),
      pullFlexibility(),
    ]);
    set((s) => ({
      records: rows[0] || s.records,
      requests: rows[1] || s.requests,
      flexibility: rows[2] || s.flexibility,
    }));
    return rows;
  },

  /** Re-read the request queue after something posted to the API directly. */
  refreshRequests: async () => {
    const rows = await pullTracked("attendanceRegularizations");
    if (rows) set({ requests: rows });
    return rows;
  },

  /** Empty on sign-out so the next user sees nothing of the previous one. */
  clear: () => set({ records: [], requests: [], todayPunch: DEFAULT_TODAY_PUNCH }),

  records: [],
  requests: [],
  todayPunch: DEFAULT_TODAY_PUNCH,

  fetchTodayPunch: async (employeeId = null) => {
    try {
      set((s) => ({ todayPunch: { ...s.todayPunch, loading: true, error: null } }));
      const punchStatus = await pullTodayPunch(employeeId);
      if (punchStatus) {
        set({
          todayPunch: mapPunchPayload(punchStatus),
        });
      } else {
        set((s) => ({ todayPunch: { ...s.todayPunch, loading: false } }));
      }
      return punchStatus;
    } catch (err) {
      set((s) => ({
        todayPunch: {
          ...s.todayPunch,
          loading: false,
          error: err?.message || "Failed to load today punch status",
        },
      }));
      return null;
    }
  },

  punchIn: async (notes = "") => {
    try {
      set((s) => ({ todayPunch: { ...s.todayPunch, loading: true, error: null } }));
      const res = await recordPunch({ punchType: "IN", notes });
      if (res) {
        set({
          todayPunch: mapPunchPayload(res),
        });
        get().refreshAttendance();
      }
      return res;
    } catch (err) {
      const msg = err?.payload?.message || err?.message || "Failed to punch in";
      set((s) => ({ todayPunch: { ...s.todayPunch, loading: false, error: msg } }));
      throw err;
    }
  },

  punchOut: async (payload = {}) => {
    try {
      set((s) => ({ todayPunch: { ...s.todayPunch, loading: true, error: null } }));
      const notes = typeof payload === "string" ? payload : (payload?.notes || payload?.remark || "");
      const earlyReason = typeof payload === "object" ? payload?.earlyReason || payload?.reason : undefined;
      const requestRegularization = typeof payload === "object" ? payload?.requestRegularization : undefined;

      const res = await recordPunch({
        punchType: "OUT",
        notes,
        earlyReason,
        requestRegularization,
      });
      if (res) {
        set({
          todayPunch: mapPunchPayload(res),
        });
        get().refreshAttendance();
      }
      return res;
    } catch (err) {
      const msg = err?.payload?.message || err?.message || "Failed to punch out";
      set((s) => ({ todayPunch: { ...s.todayPunch, loading: false, error: msg } }));
      throw err;
    }
  },

  tickPunch: () => {
    const { todayPunch } = get();
    if (todayPunch.isPunchedIn) {
      const nextSeconds = (todayPunch.workingSeconds || 0) + 1;
      const nextHours = Number((nextSeconds / 3600).toFixed(2));
      set({
        todayPunch: {
          ...todayPunch,
          workingSeconds: nextSeconds,
          workingHours: nextHours,
          formattedWorkingTime: formatSeconds(nextSeconds),
        },
      });
    }
  },

  refreshAttendance: async () => {
    try {
      const recs = await pullTracked("attendance");
      if (recs) set({ records: recs });
      return recs;
    } catch {
      return null;
    }
  },

  // Grace periods and the like are tenant settings the server owns.
  flexibility: {},
  role: "HR",

  /**
   * Write one day's register for several employees. `rows` carry
   * `{employeeId, status, checkIn:'HH:MM', checkOut:'HH:MM', remark}`; the
   * server derives hours and Late/Present itself. Returns `{written, skipped}`.
   */
  saveDailyAttendance: async (date, rows = []) => {
    const records = rows
      .filter((r) => r && isServerId(r.employeeId) && r.status && r.status !== "Not Marked")
      .map((r) => ({
        employeeId: r.employeeId,
        status: r.status,
        checkIn: toClock(r.checkIn),
        checkOut: toClock(r.checkOut),
        remark: r.remark || r.remarks || "",
      }));
    if (!date || records.length === 0) return { written: 0, skipped: [] };
    const res = await saveAttendanceDay(date, records);
    get().refreshAttendance();
    return res;
  },

  /**
   * Kept for callers that still patch "a record": `id` is the employee's
   * server id. With a `date` and `status` in the patch the day is written
   * through the register endpoint; otherwise (e.g. after a leave approval,
   * which the server posts itself) the local copy is simply re-read.
   */
  updateRecord: async (id, patch = {}) => {
    const employeeId = patch.employeeId || id;
    const date = toISODateSafe(patch.isoDate || patch.date);
    if (date && patch.status && isServerId(employeeId)) {
      try {
        await get().saveDailyAttendance(date, [{ ...patch, employeeId }]);
      } catch (err) {
        console.warn("[HRMS] attendance not saved:", err?.message || err);
      }
      return null;
    }
    return get().refreshAttendance();
  },

  /** Set one status for many employees on `date` (no-op without a date). */
  bulkUpdate: async (employeeIds = [], status, date) => {
    const day = toISODateSafe(date);
    if (!day || !status) return get().refreshAttendance();
    return get().saveDailyAttendance(day, employeeIds.map((employeeId) => ({ employeeId, status })));
  },

  /**
   * File a regularization on the server: `{employeeId, date:'YYYY-MM-DD',
   * requestedCheckIn, requestedCheckOut, requestedStatus, reason}`. Throws
   * when the server refuses it.
   */
  addRequest: async (r) => {
    const created = await hrmsSync.create("attendanceRegularizations", {
      employeeId: r.employeeId,
      date: r.date,
      requestedCheckIn: r.requestedCheckIn || r.requestedIn || r.reqIn,
      requestedCheckOut: r.requestedCheckOut || r.requestedOut || r.reqOut,
      requestedStatus: r.requestedStatus || "Present",
      reason: r.reason,
    });
    await get().refreshRequests();
    return created;
  },

  /**
   * Approve or reject a regularization. Approval makes the server rewrite
   * that day's attendance, so both lists are re-read afterwards. Throws on
   * a server refusal so the screen can say why.
   */
  setRequestStatus: async (id, status, extra = {}) => {
    const remark = extra.remark || extra.rejectReason || "";
    let res = null;
    if (status === "Approved") res = await approveRegularization(id, { remark });
    else if (status === "Rejected") res = await rejectRegularization(id, { remark });
    else return null;
    await Promise.all([get().refreshRequests(), get().refreshAttendance()]);
    return res;
  },

  /** Load the policy on its own (the Flexibility screen needs nothing else). */
  loadFlexibility: async () => {
    const policy = await pullFlexibility();
    if (policy) set({ flexibility: policy });
    return policy;
  },

  /**
   * Save the policy's screen labels; the server derives the engine keys and
   * answers with the merged policy, which replaces ours. Throws on refusal.
   */
  saveFlexibility: async (flexibility) => {
    const saved = await pushFlexibility(flexibility);
    set({ flexibility: saved || { ...get().flexibility, ...flexibility } });
    return saved;
  },

  setRole: (role) => set({ role }),
}));

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const useAttendanceStore = lazyStore(useAttendanceStoreBase, "attendance");
