import { create } from "zustand";
import { lazyStore, sessionCan } from "../services/lazyModules";
import {
  writeThrough,
  pullTracked,
  pullFlexibility,
  pushFlexibility,
  pullTodayPunch,
  recordPunch,
  isBackendEnabled,
  isServerId,
} from "../services/hrmsSync";
import { api } from "../services/api";

function formatSeconds(secs) {
  if (!secs || secs < 0) return "00h 00m";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

const DEFAULT_TODAY_PUNCH = {
  hasEmployee: true,
  employee: null,
  status: "Not Punched In",
  isPunchedIn: false,
  isOnBreak: false,
  isWorking: false,
  dayCompleted: false,
  canPunchIn: true,
  canPunchOut: false,
  canBreakIn: false,
  canBreakOut: false,
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
  firstIn: null,
  lastOut: null,
  firstPunchIso: null,
  lastPunchIso: null,
  workingSeconds: 0,
  formattedWorkingTime: "00h 00m",
  workingHours: 0,
  attendanceSeconds: 0,
  formattedAttendanceTime: "00h 00m",
  attendanceHours: 0,
  totalBreakSeconds: 0,
  formattedBreakTime: "00h 00m",
  totalBreakMinutes: 0,
  breakHours: 0,
  activeBreak: null,
  lateMinutes: 0,
  overtimeHours: 0,
  breaks: [],
  punches: [],
  pairs: [],
  loading: false,
  error: null,
};

function mapPunchPayload(res) {
  if (!res) return null;
  const punches = res.punches || [];
  const lastPunch = punches.length > 0 ? punches[punches.length - 1] : null;
  const lastPunchType = String(lastPunch?.punchType || lastPunch?.punch_type || '').toUpperCase();

  const isPunchedIn = res.is_punched_in !== undefined
    ? Boolean(res.is_punched_in)
    : res.isPunchedIn !== undefined
    ? Boolean(res.isPunchedIn)
    : (lastPunchType === 'IN' || lastPunchType === 'BREAK_IN' || lastPunchType === 'BREAK_OUT');

  const isOnBreak = res.is_on_break !== undefined
    ? Boolean(res.is_on_break)
    : res.isOnBreak !== undefined
    ? Boolean(res.isOnBreak)
    : (lastPunchType === 'BREAK_IN');

  const dayCompleted = res.day_completed !== undefined
    ? Boolean(res.day_completed)
    : res.dayCompleted !== undefined
    ? Boolean(res.dayCompleted)
    : (lastPunchType === 'OUT');

  const isWorking = res.is_working !== undefined
    ? Boolean(res.is_working)
    : res.isWorking !== undefined
    ? Boolean(res.isWorking)
    : (isPunchedIn && !isOnBreak && !dayCompleted);

  const canPunchIn = res.can_punch_in !== undefined
    ? Boolean(res.can_punch_in)
    : res.canPunchIn !== undefined
    ? Boolean(res.canPunchIn)
    : (!isPunchedIn && !dayCompleted);

  const canPunchOut = res.can_punch_out !== undefined
    ? Boolean(res.can_punch_out)
    : res.canPunchOut !== undefined
    ? Boolean(res.canPunchOut)
    : (isPunchedIn && !isOnBreak && !dayCompleted);

  const canBreakIn = res.can_break_in !== undefined
    ? Boolean(res.can_break_in)
    : res.canBreakIn !== undefined
    ? Boolean(res.canBreakIn)
    : (isPunchedIn && !isOnBreak && !dayCompleted);

  const canBreakOut = res.can_break_out !== undefined
    ? Boolean(res.can_break_out)
    : res.canBreakOut !== undefined
    ? Boolean(res.canBreakOut)
    : (isPunchedIn && isOnBreak && !dayCompleted);

  return {
    hasEmployee: res.has_employee !== false && res.hasEmployee !== false,
    employee: res.employee || null,
    status: res.status || (isOnBreak ? "On Break" : isWorking ? "Working" : dayCompleted ? "Punched Out" : "Not Punched In"),
    isPunchedIn,
    isOnBreak,
    isWorking,
    dayCompleted,
    canPunchIn,
    canPunchOut,
    canBreakIn,
    canBreakOut,
    isEarlyOut: Boolean(res.is_early_out ?? res.isEarlyOut),
    earlyLeavingMinutes: res.early_leaving_minutes ?? res.earlyLeavingMinutes ?? res.early_minutes ?? res.earlyMinutes ?? 0,
    shiftStart: res.shift_start ?? res.shiftStart ?? "09:30",
    shiftEnd: res.shift_end ?? res.shiftEnd ?? "18:30",
    fullDayHours: res.full_day_hours ?? res.fullDayHours ?? 8,
    halfDayThresholdHours: res.half_day_threshold_hours ?? res.halfDayThresholdHours ?? 4,
    hasPendingRegularization: Boolean(res.has_pending_regularization ?? res.hasPendingRegularization),
    attendanceStatus: res.attendance_status ?? res.attendanceStatus ?? null,
    firstPunch: res.first_punch ?? res.firstPunch ?? null,
    lastPunch: res.last_punch ?? res.lastPunch ?? null,
    firstIn: res.first_in ?? res.firstIn ?? null,
    lastOut: res.last_out ?? res.lastOut ?? null,
    firstPunchIso: res.first_punch_iso ?? res.firstPunchIso ?? null,
    lastPunchIso: res.last_punch_iso ?? res.lastPunchIso ?? null,
    workingSeconds: res.working_seconds ?? res.workingSeconds ?? 0,
    netWorkingSeconds: res.net_working_seconds ?? res.netWorkingSeconds ?? res.working_seconds ?? res.workingSeconds ?? 0,
    formattedWorkingTime: res.formatted_working_time ?? res.formattedWorkingTime ?? "00h 00m",
    workingHours: res.working_hours ?? res.workingHours ?? 0,
    attendanceSeconds: res.attendance_seconds ?? res.attendanceSeconds ?? 0,
    formattedAttendanceTime: res.formatted_attendance_time ?? res.formattedAttendanceTime ?? "00h 00m",
    attendanceHours: res.attendance_hours ?? res.attendanceHours ?? 0,
    totalBreakSeconds: res.total_break_seconds ?? res.totalBreakSeconds ?? 0,
    formattedBreakTime: res.formatted_break_time ?? res.formattedBreakTime ?? "00h 00m",
    totalBreakMinutes: res.total_break_minutes ?? res.totalBreakMinutes ?? 0,
    breakHours: res.break_hours ?? res.breakHours ?? 0,
    activeBreak: res.active_break ?? res.activeBreak ?? null,
    lateMinutes: res.late_minutes ?? res.lateMinutes ?? 0,
    overtimeHours: res.overtime_hours ?? res.overtimeHours ?? 0,
    breaks: res.breaks || [],
    punches,
    pairs: res.pairs || [],
    loading: false,
    error: null,
  };
}

/**
 * The flexibility policy is a team read (`view_team_attendance`). Attendance
 * rows are readable by anyone who marks attendance — the server returns only
 * their own unless they hold the team permission.
 */
function canViewTeamAttendance() {
  return sessionCan("view_team_attendance");
}

function canReadAttendance() {
  return sessionCan(["view_team_attendance", "mark_attendance"]);
}

const useAttendanceStoreBase = create((set, get) => ({
  /**
   * Load this module's collections from the API. Today's punch status is not
   * here: the topbar and the HRMS dashboard each fetch it themselves.
   */
  hydrate: async () => {
    const team = canViewTeamAttendance();
    const [attRows, reqRows, flex] = await Promise.all([
      canReadAttendance() ? pullTracked("attendance") : null,
      pullTracked("attendanceRegularizations"),
      team ? pullFlexibility() : null,
    ]);
    set((s) => ({
      records: attRows || s.records,
      requests: reqRows || s.requests,
      flexibility: flex || s.flexibility,
    }));
    return [attRows, reqRows, flex];
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
        // Sync attendance records in background
        get().refreshAttendance();
      }
      return res;
    } catch (err) {
      const msg = err?.payload?.message || err?.message || "Failed to punch in";
      set((s) => ({ todayPunch: { ...s.todayPunch, loading: false, error: msg } }));
      if (
        err?.payload?.code === "ALREADY_PUNCHED_IN" ||
        /already punched in/i.test(msg) ||
        err?.status === 400
      ) {
        try {
          await get().fetchTodayPunch();
        } catch {}
      }
      throw err;
    }
  },

  punchOut: async (payload = {}) => {
    try {
      set((s) => ({ todayPunch: { ...s.todayPunch, loading: true, error: null } }));
      const notes = typeof payload === "string" ? payload : (payload?.notes || payload?.remark || "");
      const earlyReason = typeof payload === "object" ? (payload?.earlyReason || payload?.reason) : undefined;
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
      if (
        err?.payload?.code === "CANNOT_PUNCH_OUT" ||
        /cannot punch out|already punched out/i.test(msg) ||
        err?.status === 400
      ) {
        try {
          await get().fetchTodayPunch();
        } catch {}
      }
      throw err;
    }
  },

  breakIn: async (notes = "") => {
    try {
      set((s) => ({ todayPunch: { ...s.todayPunch, loading: true, error: null } }));
      const res = await recordPunch({ punchType: "BREAK_IN", notes });
      if (res) {
        set({
          todayPunch: mapPunchPayload(res),
        });
        get().refreshAttendance();
      }
      return res;
    } catch (err) {
      const msg = err?.payload?.message || err?.message || "Failed to start break";
      set((s) => ({ todayPunch: { ...s.todayPunch, loading: false, error: msg } }));
      if (err?.payload?.code === "ALREADY_ON_BREAK" || err?.status === 400) {
        try {
          await get().fetchTodayPunch();
        } catch {}
      }
      throw err;
    }
  },

  breakOut: async (notes = "") => {
    try {
      set((s) => ({ todayPunch: { ...s.todayPunch, loading: true, error: null } }));
      const res = await recordPunch({ punchType: "BREAK_OUT", notes });
      if (res) {
        set({
          todayPunch: mapPunchPayload(res),
        });
        get().refreshAttendance();
      }
      return res;
    } catch (err) {
      const msg = err?.payload?.message || err?.message || "Failed to end break";
      set((s) => ({ todayPunch: { ...s.todayPunch, loading: false, error: msg } }));
      if (err?.payload?.code === "NOT_ON_BREAK" || err?.status === 400) {
        try {
          await get().fetchTodayPunch();
        } catch {}
      }
      throw err;
    }
  },

  tickPunch: () => {
    const { todayPunch } = get();
    if (todayPunch.isPunchedIn && !todayPunch.dayCompleted) {
      const nextAttSeconds = (todayPunch.attendanceSeconds || 0) + 1;
      const nextAttHours = Number((nextAttSeconds / 3600).toFixed(2));

      if (todayPunch.isOnBreak) {
        const nextBreakSeconds = (todayPunch.totalBreakSeconds || 0) + 1;
        const nextBreakMinutes = Math.floor(nextBreakSeconds / 60);
        const nextActiveSeconds = (todayPunch.activeBreak?.activeSeconds || 0) + 1;

        set({
          todayPunch: {
            ...todayPunch,
            attendanceSeconds: nextAttSeconds,
            attendanceHours: nextAttHours,
            formattedAttendanceTime: formatSeconds(nextAttSeconds),
            totalBreakSeconds: nextBreakSeconds,
            totalBreakMinutes: nextBreakMinutes,
            formattedBreakTime: formatSeconds(nextBreakSeconds),
            activeBreak: todayPunch.activeBreak
              ? {
                  ...todayPunch.activeBreak,
                  activeSeconds: nextActiveSeconds,
                  formattedDuration: formatSeconds(nextActiveSeconds),
                }
              : null,
          },
        });
      } else {
        const nextSeconds = (todayPunch.workingSeconds || 0) + 1;
        const nextHours = Number((nextSeconds / 3600).toFixed(2));
        set({
          todayPunch: {
            ...todayPunch,
            attendanceSeconds: nextAttSeconds,
            attendanceHours: nextAttHours,
            formattedAttendanceTime: formatSeconds(nextAttSeconds),
            workingSeconds: nextSeconds,
            workingHours: nextHours,
            formattedWorkingTime: formatSeconds(nextSeconds),
          },
        });
      }
    }
  },

  // Refresh attendance records from API
  refreshAttendance: async () => {
    if (!canReadAttendance()) return null;
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

  saveDailyAttendance: (date, updatedRecords) => set((s) => {
    const norm = (d) => {
      if (!d) return "";
      const str = String(d).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
      if (/^\d{2}-\d{2}-\d{4}/.test(str)) return str.slice(0, 10).split("-").reverse().join("-");
      if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) return str.slice(0, 10).split("/").reverse().join("-");
      return str;
    };
    const targetDateNorm = norm(date);
    const otherRecords = s.records.filter((r) => {
      const rDateNorm = norm(r.rawDate || r.work_date || r.workDate || r.date);
      return rDateNorm !== targetDateNorm && r.date !== date;
    });

    // Deduplicate incoming updated records by employee
    const seenEmp = new Set();
    const cleanUpdated = [];
    (updatedRecords || []).forEach((r) => {
      const empKey = String(r.employeeId || r.empId || r.name || r.id || "").toLowerCase().trim();
      if (empKey && !seenEmp.has(empKey)) {
        seenEmp.add(empKey);
        cleanUpdated.push(r);
      } else if (!empKey) {
        cleanUpdated.push(r);
      }
    });

    const combined = [...cleanUpdated, ...otherRecords];
    writeThrough("attendance", combined);
    return { records: combined };
  }),

  updateRecord: (id, patch) => set((s) => {
    const recs = s.records.map((r) => r.id === id ? { ...r, ...patch } : r);
    writeThrough("attendance", recs);
    return { records: recs };
  }),

  bulkUpdate: (ids, status) => set((s) => {
    const idsSet = new Set(ids.map(String));
    const recs = s.records.map((r) =>
      idsSet.has(String(r.id)) ||
      idsSet.has(String(r.employeeId)) ||
      idsSet.has(String(r.empId))
        ? { ...r, status }
        : r
    );
    writeThrough("attendance", recs);
    return { records: recs };
  }),

  addRequest: (r) => set((s) => {
    const newReq = {
      id: r.id || `REQ-${Date.now().toString().slice(-4)}`,
      submitted: "Today",
      status: "Pending",
      ...r,
    };
    const reqs = [newReq, ...s.requests];
    writeThrough("attendanceRegularizations", reqs);
    return { requests: reqs };
  }),

  setRequestStatus: async (id, status, extra = {}) => {
    const targetReq = get().requests.find((r) => r.id === id);
    const approved = status === "Approved";

    if (isBackendEnabled() && isServerId(id)) {
      try {
        await api.patch(`/hrms/attendance/regularizations/${id}/`, {
          approved,
          remark: extra?.rejectReason || extra?.remark || (approved ? "Approved" : "Rejected"),
        });
      } catch (err) {
        console.warn("[HRMS] Failed to update regularization status on backend:", err);
      }
    }

    set((s) => {
      const reqs = s.requests.map((r) => (r.id === id ? { ...r, status, ...extra } : r));

      let updatedRecords = s.records;
      // If approved and was a regularization or early clock-out, write directly to matching record
      if (status === "Approved" && targetReq) {
        updatedRecords = s.records.map((rec) => {
          const matches =
            (targetReq.employeeId && rec.id === targetReq.employeeId) ||
            (rec.name &&
              targetReq.employee &&
              String(rec.name ?? "").toLowerCase() === String(targetReq.employee ?? "").toLowerCase());

          if (matches) {
            return {
              ...rec,
              checkIn: targetReq.requestedIn || rec.checkIn,
              checkOut: targetReq.requestedOut || rec.checkOut,
              status: targetReq.type === "Half Day" ? "Half Day" : targetReq.type === "Work From Home (WFH)" ? "WFH" : "Present",
              earlyLeavingMinutes: 0,
              earlyMins: 0,
              isEarlyOut: false,
              workHours: targetReq.type === "Half Day" ? "04:30" : "08:30",
            };
          }
          return rec;
        });
      }

      writeThrough("attendanceRegularizations", reqs);
      writeThrough("attendance", updatedRecords);
      return { requests: reqs, records: updatedRecords };
    });

    get().fetchTodayPunch();
    get().refreshAttendance();
  },

  saveFlexibility: (flexibility) => {
    set({ flexibility });
    pushFlexibility(flexibility)
      .then(() => {
        get().refreshAttendance();
        get().fetchTodayPunch();
      })
      .catch((err) => {
        console.warn("[HRMS] flexibility not saved:", err?.message || err);
      });
  },

  // Which view the screen shows (HR vs employee); a UI choice, not stored data.
  setRole: (role) => set({ role })
}));

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const useAttendanceStore = lazyStore(useAttendanceStoreBase, "attendance");
