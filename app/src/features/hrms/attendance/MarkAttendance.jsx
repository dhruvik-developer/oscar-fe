/**
 * Mark Attendance — two screens behind one route.
 *
 *  - HR admin, super admin and executive roles (`mark_attendance` together
 *    with `view_team_attendance`) get the team register for any day: every
 *    employee, with the check-in / check-out the server already worked out
 *    from their Punch In / Punch Out, editable as a correction.
 *  - Everyone else gets their own attendance: Punch In / Punch Out (the same
 *    punch as the topbar button), today's punches and their own history. The
 *    server only returns their own rows and refuses hand edits from them —
 *    corrections go through regularization.
 */
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Coffee,
  Fingerprint,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Users,
  Check,
  X,
  RotateCcw,
  Building2,
  Filter,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import { hrmsSync } from "../../../services/hrmsSync";
import { api } from "../../../services/api";
import { Badge } from "../../../components/hrms/Badge";
import { PageInfoButton } from "../../../components/common/PageInfoButton";
import Pagination from "../../../components/ui/Pagination";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { EarlyPunchOutModal } from "./components/EarlyPunchOutModal";
import { usePunchActions } from "./usePunchActions";

const STATUSES = ["Present", "Late", "Half Day", "WFH", "Absent", "On Leave"];

const STATUS_CONFIG = {
  Present: {
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200/90",
    dot: "bg-emerald-500",
  },
  Late: {
    bg: "bg-amber-50 text-amber-700 border-amber-200/90",
    dot: "bg-amber-500",
  },
  "Half Day": {
    bg: "bg-purple-50 text-purple-700 border-purple-200/90",
    dot: "bg-purple-500",
  },
  Absent: {
    bg: "bg-rose-50 text-rose-700 border-rose-200/90",
    dot: "bg-rose-500",
  },
  WFH: {
    bg: "bg-sky-50 text-sky-700 border-sky-200/90",
    dot: "bg-sky-500",
  },
  "On Leave": {
    bg: "bg-indigo-50 text-indigo-700 border-indigo-200/90",
    dot: "bg-indigo-500",
  },
};

const AVATAR_PALETTE = [
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-teal-100 text-teal-700 border-teal-200",
];

function getInitials(name) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash += name.charCodeAt(i);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(isoStr, deltaDays) {
  const parts = (isoStr || todayISO()).split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateDisplay(isoStr) {
  if (!isoStr) return "";
  const parts = isoStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** ISO timestamp → local `HH:MM` for a time input; blank when absent. */
function toHHMM(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function statusTone(status) {
  if (status === "Present" || status === "WFH") return "success";
  if (status === "Late" || status === "Half Day") return "warning";
  if (status === "Absent") return "critical";
  return "neutral";
}

function PageTitle({ subtitle }) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <h1 className="text-[24px] font-bold tracking-tight text-slate-900">Mark Attendance</h1>
        <PageInfoButton guide={hrmsGuides.attendanceMark} />
      </div>
      <p className="text-[13px] text-muted">{subtitle}</p>
    </div>
  );
}

export default function MarkAttendance() {
  const permissions = useAppStore((s) => s.permissions) || [];
  const canMarkTeam = permissions.includes("mark_attendance") && permissions.includes("view_team_attendance");
  return canMarkTeam ? <TeamMarkAttendance /> : <MyAttendance />;
}

// ── Self-service: Punch In / Punch Out and my own record ───────────────────

function MyAttendance() {
  const {
    todayPunch, fetchTodayPunch, tickPunch, submitting, error,
    doPunchIn, doBreakIn, doBreakOut, doPunchOut, executePunchOut, earlyModalOpen, setEarlyModalOpen,
  } = usePunchActions();
  const records = useAttendanceStore((s) => s.records);
  const refreshAttendance = useAttendanceStore((s) => s.refreshAttendance);

  useEffect(() => { fetchTodayPunch(); }, [fetchTodayPunch]);

  // Live timer for active punch session or break
  useEffect(() => {
    if (!todayPunch?.isPunchedIn) return;
    const interval = setInterval(() => {
      tickPunch?.();
    }, 1000);
    return () => clearInterval(interval);
  }, [todayPunch?.isPunchedIn, tickPunch]);

  const month = todayISO().slice(0, 7);
  const history = useMemo(
    () => (records || [])
      .filter((r) => String(r.rawDate || "").startsWith(month))
      .sort((a, b) => String(b.rawDate).localeCompare(String(a.rawDate))),
    [records, month]
  );
  const summary = useMemo(() => {
    const count = (fn) => history.filter(fn).length;
    return {
      present: count((r) => ["Present", "Late", "WFH", "Half Day"].includes(r.status)),
      late: count((r) => r.status === "Late"),
      absent: count((r) => r.status === "Absent"),
      leave: count((r) => r.status === "On Leave"),
    };
  }, [history]);

  const punches = todayPunch?.punches || [];
  const breaks = todayPunch?.breaks || [];
  const noEmployee = todayPunch?.hasEmployee === false;

  const badgeTone = todayPunch?.isOnBreak
    ? "warning"
    : todayPunch?.isWorking || (todayPunch?.isPunchedIn && !todayPunch?.isOnBreak)
    ? "success"
    : todayPunch?.dayCompleted || todayPunch?.status === "Punched Out"
    ? "info"
    : "neutral";

  return (
    <div className="flex flex-col gap-6">
      <PageTitle subtitle="Punch in when you start, take breaks with Break In/Out, and punch out when you leave." />

      {noEmployee ? (
        <div className="bg-white border border-bdr rounded-2xl p-8 text-center shadow-xs text-[13px] text-muted">
          Your login is not linked to an employee record, so attendance cannot be recorded. Ask HR to link it.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Today */}
          <div className="lg:col-span-5 bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-[15px] text-slate-900">Today</h3>
                <p className="text-[12px] text-muted">
                  Shift {todayPunch?.shiftStart || "—"} – {todayPunch?.shiftEnd || "—"}
                </p>
              </div>
              <Badge tone={badgeTone}>
                {todayPunch?.status || "Not Punched In"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                ["First In", todayPunch?.firstIn || todayPunch?.firstPunch || "—", "text-slate-900"],
                ["Last Out", todayPunch?.lastOut || (todayPunch?.dayCompleted ? todayPunch?.lastPunch : "—") || "—", "text-slate-900"],
                ["Total Break", todayPunch?.formattedBreakTime || "00h 00m", "text-amber-600 font-mono"],
                ["Net Worked", todayPunch?.formattedWorkingTime || "00h 00m", "text-primary font-mono"],
              ].map(([label, value, colorClass]) => (
                <div key={label} className="bg-slate-50 border border-bdr/70 rounded-xl p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</div>
                  <div className={`text-[14px] font-bold mt-0.5 truncate ${colorClass}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Attendance & Break Actions based on exact 5-state workflow */}
            {todayPunch?.isOnBreak ? (
              /* State 3: On Break -> Show Break Out (resumes working), disable Punch Out */
              <div className="flex flex-col gap-2">
                <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-3 flex items-center justify-between text-amber-900 text-[12.5px]">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    Break in progress
                  </div>
                  <span className="font-mono font-semibold">{todayPunch?.formattedBreakTime || "00h 00m"}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => doBreakOut()}
                    disabled={submitting || todayPunch?.canBreakOut === false}
                    className="flex-1 h-11 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-[14px] flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Coffee size={16} />}
                    Break Out (Resume Work)
                  </button>
                  <button
                    type="button"
                    disabled={true}
                    title="You must end your break (Break Out) before Punching Out"
                    className="h-11 px-4 rounded-xl bg-slate-100 text-slate-400 font-semibold text-[13px] flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200"
                  >
                    <LogOut size={15} /> Punch Out
                  </button>
                </div>
              </div>
            ) : (todayPunch?.isWorking || (todayPunch?.isPunchedIn && !todayPunch?.isOnBreak)) ? (
              /* State 2 & 4: Working -> Show Break In and Punch Out */
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => doBreakIn()}
                  disabled={submitting || todayPunch?.canBreakIn === false}
                  className="flex-1 h-11 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold text-[14px] flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Coffee size={16} />}
                  Break In
                </button>
                <button
                  type="button"
                  onClick={doPunchOut}
                  disabled={submitting || todayPunch?.canPunchOut === false}
                  className="flex-1 h-11 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-[14px] flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                  Punch Out
                </button>
              </div>
            ) : (todayPunch?.dayCompleted || todayPunch?.status === "Punched Out") ? (
              /* State 5: Punched Out -> Work session completed */
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-[13px] font-semibold text-slate-700 flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Work session completed for today
                </div>
                <p className="text-[11.5px] text-muted mt-0.5">
                  Total Attendance: {todayPunch?.formattedAttendanceTime || "00h 00m"} • Net Worked: {todayPunch?.formattedWorkingTime || "00h 00m"}
                </p>
              </div>
            ) : (
              /* State 1: Not Punched In -> Punch In */
              <button
                type="button"
                onClick={doPunchIn}
                disabled={submitting || todayPunch?.canPunchIn === false}
                className="h-11 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-semibold text-[14px] flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                Punch In
              </button>
            )}

            {error && <p className="text-[12px] text-rose-700">{error}</p>}

            {/* Today's Breaks */}
            {breaks.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-[12px] font-semibold text-slate-700 mb-1.5">
                  <span>Today&apos;s breaks ({breaks.length})</span>
                  <span className="text-[11px] font-normal text-muted">Total: {todayPunch?.formattedBreakTime || "00h 00m"}</span>
                </div>
                <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                  {breaks.map((b, idx) => {
                    const isActive = !b.breakOutTime;
                    return (
                      <li
                        key={b.id || idx}
                        className="flex items-center justify-between text-[12px] bg-slate-50 border border-bdr/60 rounded-lg px-3 py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-amber-500 animate-pulse" : "bg-slate-400"}`} />
                          <span className="font-medium text-slate-800">
                            Break #{idx + 1}: {b.breakInTime || "—"} → {b.breakOutTime || "Active"}
                          </span>
                        </div>
                        <span className={`font-mono font-semibold ${isActive ? "text-amber-600" : "text-slate-600"}`}>
                          {b.duration || "Active"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Today's Punches */}
            <div>
              <div className="text-[12px] font-semibold text-slate-700 mb-2">Today&apos;s punches</div>
              {punches.length === 0 ? (
                <p className="text-[12.5px] text-muted">No punches yet today.</p>
              ) : (
                <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                  {punches.map((p) => {
                    const isPunchIn = p.punchType === "IN";
                    const isPunchOut = p.punchType === "OUT";
                    const isBreakIn = p.punchType === "BREAK_IN";
                    const label = isPunchIn
                      ? "Punch In"
                      : isPunchOut
                      ? "Punch Out"
                      : isBreakIn
                      ? "Break In"
                      : "Break Out";
                    const color = isPunchIn
                      ? "text-emerald-700"
                      : isPunchOut
                      ? "text-rose-700"
                      : isBreakIn
                      ? "text-amber-700"
                      : "text-blue-700";

                    return (
                      <li key={p.id} className="flex items-center justify-between text-[12.5px] bg-slate-50 border border-bdr/60 rounded-lg px-3 py-1.5">
                        <span className={`font-semibold ${color}`}>
                          {label}
                        </span>
                        <span className="text-slate-700 font-medium font-mono">{p.timeDisplay || p.punchTime?.slice(11, 16)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* My month */}
          <div className="lg:col-span-7 bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 pb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-[15px] text-slate-900">My attendance this month</h3>
                <p className="text-[12px] text-muted">Missed a punch or a wrong time? Ask HR for a correction.</p>
              </div>
              <button
                type="button"
                onClick={() => { refreshAttendance?.(); fetchTodayPunch(); }}
                className="btn-outline h-8 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 px-5 pb-4">
              {[
                ["Present", summary.present, "text-emerald-700"],
                ["Late", summary.late, "text-amber-700"],
                ["Absent", summary.absent, "text-rose-700"],
                ["On Leave", summary.leave, "text-slate-700"],
              ].map(([label, value, tone]) => (
                <div key={label} className="bg-slate-50 border border-bdr/70 rounded-xl p-3">
                  <div className="text-[10.5px] font-semibold uppercase text-muted">{label}</div>
                  <div className={`text-[18px] font-bold ${tone}`}>{value}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead className="bg-slate-50/75 border-y border-bdr text-[11px] uppercase tracking-wider text-muted font-bold">
                  <tr>
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Check In</th>
                    <th className="py-3 px-5">Check Out</th>
                    <th className="py-3 px-5">Hours</th>
                    <th className="py-3 px-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/40">
                  {history.length === 0 && (
                    <tr><td colSpan={5} className="py-8 px-5 text-center text-muted">No attendance recorded this month yet.</td></tr>
                  )}
                  {history.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 px-5 font-medium text-slate-900">{r.date}</td>
                      <td className="py-3 px-5">{toHHMM(r.checkIn) || "—"}</td>
                      <td className="py-3 px-5">{toHHMM(r.checkOut) || "—"}</td>
                      <td className="py-3 px-5">{r.workingHours ? `${r.workingHours}h` : "—"}</td>
                      <td className="py-3 px-5"><Badge tone={statusTone(r.status)}>{r.status || "—"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <EarlyPunchOutModal
        isOpen={earlyModalOpen}
        onClose={() => setEarlyModalOpen(false)}
        onConfirm={executePunchOut}
        todayPunch={todayPunch}
        isSubmitting={submitting}
      />
    </div>
  );
}

// ── HR / admin: the team register for a day ────────────────────────────────

function TeamMarkAttendance() {
  const showToast = useAppStore((s) => s.showToast);
  const employees = useAppStore((s) => s.employees);
  const todayPunch = useAttendanceStore.raw((s) => s.todayPunch);
  const flexibility = useAttendanceStore((s) => s.flexibility);

  const [date, setDate] = useState(todayISO);
  const [dept, setDept] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [serverRows, setServerRows] = useState([]);
  const [edits, setEdits] = useState({});
  const [checked, setChecked] = useState({});
  const [bulkStatus, setBulkStatus] = useState("Present");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectAllRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      try {
        await api.post("/hrms/attendance/sync-punches/", { date });
      } catch {
        // fallback quietly to direct pull
      }
      const data = (await hrmsSync.pull("attendance", { date })) || [];
      setServerRows(data);
      setEdits({});
      setChecked({});
      await useAttendanceStore.getState().refreshAttendance();
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (date === todayISO()) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayPunch?.isPunchedIn, todayPunch?.lastPunchIso]);

  // Everyone on the payroll of people, with the day's row where there is one.
  const rows = useMemo(() => {
    const byEmployee = new Map(serverRows.map((r) => [String(r.employeeId), r]));
    const peopleRaw = employees?.length
      ? employees.filter((e) => !["Resigned", "Terminated"].includes(e.status))
      : serverRows.map((r) => ({ id: r.employeeId, name: r.name, department: r.dept, empId: r.empId }));

    const peopleMap = new Map();
    peopleRaw.forEach((p) => {
      const name = (p.name || "").trim().toLowerCase();
      const id = String(p.id || p.employeeId || "").trim().toLowerCase();
      const key = id || name;
      if (key && !peopleMap.has(key) && (!name || !peopleMap.has(name))) {
        peopleMap.set(key, p);
        if (name) peopleMap.set(name, p);
      }
    });
    const people = Array.from(new Set(peopleMap.values()));

    return people.map((e) => {
      const att = byEmployee.get(String(e.id));
      const base = {
        employeeId: String(e.id),
        name: e.name || att?.name || "Employee",
        empId: e.empId || e.employeeCode || att?.empId || "",
        dept: e.department || e.dept || att?.dept || "",
        avatar: e.avatar || e.photo || e.img || "",
        checkIn: toHHMM(att?.checkIn),
        checkOut: toHHMM(att?.checkOut),
        status: att?.status || "",
        remark: att?.remark || "",
        source: att?.source || "",
        punchCount: (att?.punches || []).length,
        marked: Boolean(att),
      };
      return { ...base, ...(edits[base.employeeId] || {}) };
    });
  }, [employees, serverRows, edits]);

  const departments = useMemo(() => ["All", ...new Set(rows.map((r) => r.dept).filter(Boolean))], [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (dept !== "All" && r.dept !== dept) return false;
      if (statusFilter !== "All") {
        if (statusFilter === "Not Marked" && r.marked && r.status) return false;
        if (statusFilter === "Punched" && !(r.source === "punch" || r.punchCount > 0)) return false;
        if (statusFilter !== "Not Marked" && statusFilter !== "Punched" && r.status !== statusFilter) return false;
      }
      if (q && !r.name?.toLowerCase().includes(q) && !r.empId?.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [rows, dept, statusFilter, search]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [search, dept, statusFilter, date, pageSize]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const dirtyIds = Object.keys(edits);
  const selectedIds = filtered.filter((r) => checked[r.employeeId]).map((r) => r.employeeId);

  const counts = useMemo(() => ({
    total: rows.length,
    punched: rows.filter((r) => r.source === "punch" || r.punchCount > 0).length,
    marked: rows.filter((r) => r.marked || r.status).length,
    notMarked: rows.filter((r) => !r.marked && !r.status).length,
    present: rows.filter((r) => r.status === "Present").length,
    absent: rows.filter((r) => r.status === "Absent").length,
  }), [rows]);

  const isAttended = (st) => ["Present", "Late", "Half Day", "WFH"].includes(st);
  // Handle selection state for checkboxes
  const isAllChecked = filtered.length > 0 && filtered.every((r) => Boolean(checked[r.employeeId]));
  const isSomeChecked = filtered.some((r) => Boolean(checked[r.employeeId]));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !isAllChecked && isSomeChecked;
    }
  }, [isAllChecked, isSomeChecked]);

  function edit(employeeId, patch) {
    setEdits((prev) => ({ ...prev, [employeeId]: { ...(prev[employeeId] || {}), ...patch } }));
  }

  function resetEdit(employeeId) {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
  }

  async function toggleRowAttendance(r) {
    const isCurrentlyAttended = isAttended(r.status);
    const nextStatus = isCurrentlyAttended ? "Absent" : "Present";
    const defaultIn = flexibility?.shiftStart || "09:00";
    const defaultOut = flexibility?.shiftEnd || "18:00";

    const patch = {
      status: nextStatus,
      checkIn: nextStatus === "Present" ? (r.checkIn || defaultIn) : "",
      checkOut: nextStatus === "Present" ? (r.checkOut || defaultOut) : "",
      remark: r.remark || "",
    };

    edit(r.employeeId, patch);
    setChecked((p) => ({ ...p, [r.employeeId]: nextStatus === "Present" }));

    try {
      await api.post("/hrms/attendance/bulk/", {
        date,
        records: [
          {
            employeeId: r.employeeId,
            checkIn: patch.checkIn || null,
            checkOut: patch.checkOut || null,
            status: patch.status,
            remark: patch.remark || null,
          },
        ],
      });
      resetEdit(r.employeeId);
      await useAttendanceStore.getState().refreshAttendance();
      await load();
      showToast?.(`Marked ${r.name} as ${nextStatus}`);
    } catch (err) {
      showToast?.(`Failed to update attendance — ${err?.payload?.message || err?.message || "try again"}`);
    }
  }

  function toggleSelectAll() {
    if (isAllChecked) {
      setChecked({});
    } else {
      const nextChecked = {};
      filtered.forEach((r) => {
        nextChecked[r.employeeId] = true;
      });
      setChecked(nextChecked);
    }
  }

  async function handleStatusChange(employeeId, newStatus) {
    const r = rows.find((row) => row.employeeId === employeeId);
    const defaultIn = flexibility?.shiftStart || "09:00";
    const defaultOut = flexibility?.shiftEnd || "18:00";

    const patch = {
      status: newStatus,
      checkIn: newStatus === "Absent" ? "" : (r?.checkIn || (newStatus === "Present" ? defaultIn : "")),
      checkOut: newStatus === "Absent" ? "" : (r?.checkOut || (newStatus === "Present" ? defaultOut : "")),
    };
    edit(employeeId, patch);
    setChecked((p) => ({ ...p, [employeeId]: isAttended(newStatus) }));

    if (newStatus) {
      try {
        await api.post("/hrms/attendance/bulk/", {
          date,
          records: [
            {
              employeeId,
              checkIn: patch.checkIn || null,
              checkOut: patch.checkOut || null,
              status: patch.status,
              remark: r?.remark || null,
            },
          ],
        });
        resetEdit(employeeId);
        await useAttendanceStore.getState().refreshAttendance();
        await load();
        showToast?.(`Updated status for ${r?.name || "employee"} to ${newStatus}`);
      } catch (err) {
        showToast?.(`Failed to update status — ${err?.payload?.message || err?.message || "try again"}`);
      }
    }
  }

  async function quickMark(employeeId, newStatus) {
    const current = rows.find((r) => r.employeeId === employeeId);
    const defaultIn = flexibility?.shiftStart || "09:00";
    const defaultOut = flexibility?.shiftEnd || "18:00";

    let inTime = newStatus === "Present" ? (current?.checkIn || defaultIn) : "";
    let outTime = newStatus === "Absent" ? "" : (current?.checkOut || (newStatus === "Present" ? defaultOut : ""));
    if (newStatus === "Present") {
      if (!inTime) inTime = defaultIn;
      if (!outTime || outTime <= inTime) outTime = defaultOut;
    }

    const patch = {
      status: newStatus,
      checkIn: inTime,
      checkOut: outTime,
    };
    edit(employeeId, patch);

    try {
      await api.post("/hrms/attendance/bulk/", {
        date,
        records: [
          {
            employeeId,
            checkIn: patch.checkIn || null,
            checkOut: patch.checkOut || null,
            status: patch.status,
            remark: current?.remark || null,
          },
        ],
      });
      resetEdit(employeeId);
      await useAttendanceStore.getState().refreshAttendance();
      await load();
      showToast?.(`Marked ${current?.name || "employee"} as ${newStatus}`);
    } catch (err) {
      showToast?.(`Failed to update attendance — ${err?.payload?.message || err?.message || "try again"}`);
    }
  }

  function applyBulkStatus(statusToApply = bulkStatus) {
    if (!selectedIds.length) return;
    const defaultIn = flexibility?.shiftStart || "09:00";
    const defaultOut = flexibility?.shiftEnd || "18:00";

    selectedIds.forEach((id) => {
      const row = rows.find((r) => r.employeeId === id);
      const patch = { status: statusToApply };
      if (statusToApply === "Present") {
        let inTime = row?.checkIn || defaultIn;
        let outTime = row?.checkOut || defaultOut;
        if (outTime && inTime && outTime <= inTime) {
          inTime = defaultIn;
          outTime = defaultOut;
        }
        patch.checkIn = inTime;
        patch.checkOut = outTime;
      } else if (statusToApply === "Absent") {
        patch.checkIn = "";
        patch.checkOut = "";
      }
      edit(id, patch);
    });

    showToast?.(`Marked ${selectedIds.length} employee${selectedIds.length === 1 ? "" : "s"} as ${statusToApply}. Click "Save Attendance" to save.`);
  }

  function clearSelection() {
    setChecked({});
  }

  function selectAll() {
    const next = {};
    filtered.forEach((r) => { next[r.employeeId] = true; });
    setChecked(next);
  }

  async function save() {
    let targetRows = rows.filter((r) => edits[r.employeeId]);
    if (!targetRows.length && selectedIds.length > 0) {
      applyBulkStatus(bulkStatus);
      targetRows = rows.filter((r) => edits[r.employeeId] || selectedIds.includes(r.employeeId));
    }
    for (const r of targetRows) {
      if (r.checkIn && r.checkOut && r.checkOut <= r.checkIn) {
        showToast?.(`Cannot save: Check-out (${r.checkOut}) must be after Check-in (${r.checkIn}) for ${r.name || "employee"}.`, "error");
        return;
      }
    }
    const records = targetRows.map((r) => ({
      employeeId: r.employeeId,
      checkIn: r.checkIn || null,
      checkOut: r.checkOut || null,
      status: r.status || (r.checkIn ? "Present" : "Absent"),
      remark: r.remark || null,
    }));
    if (!records.length) return;
    setSaving(true);
    try {
      await api.post("/hrms/attendance/bulk/", { date, records });
      setChecked({});
      setEdits({});
      await useAttendanceStore.getState().refreshAttendance();
      await load();
      showToast?.(`Attendance saved for ${records.length} employee${records.length === 1 ? "" : "s"} on ${formatDateDisplay(date)}`);
    } catch (err) {
      showToast?.(`Attendance not saved — ${err?.payload?.message || err?.message || "try again"}`);
    } finally {
      setSaving(false);
    }
  }

  const isToday = date === todayISO();

  return (
    <div className="flex flex-col gap-6 max-w-full">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[24px] font-extrabold tracking-tight text-slate-900">Mark Attendance</h1>
            <PageInfoButton guide={hrmsGuides.attendanceMark} />
            {isToday && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Today
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted mt-0.5">
            Daily register synchronized from biometric punches. Edit check-in, check-out, or status to override.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn-outline h-9 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-primary" : "text-slate-500"} />
            <span>{loading ? "Syncing…" : "Sync Punches"}</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Employees */}
        <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Roster</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Users size={16} />
            </span>
          </div>
          <div className="text-[24px] font-extrabold text-slate-900 leading-none">{counts.total}</div>
          <p className="text-[11.5px] text-muted mt-1.5 flex items-center gap-1">Active team members</p>
        </div>

        {/* Card 2: From Punches */}
        <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">From Punches</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Fingerprint size={16} />
            </span>
          </div>
          <div className="text-[24px] font-extrabold text-emerald-700 leading-none">{counts.punched}</div>
          <p className="text-[11.5px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1">
            <Check size={12} /> Biometric auto-synced
          </p>
        </div>

        {/* Card 3: Marked */}
        <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Marked Today</span>
            <span className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="text-[24px] font-extrabold text-slate-900 leading-none">{counts.marked}</div>
          <p className="text-[11.5px] text-muted mt-1.5">
            {counts.total > 0 ? `${Math.round((counts.marked / counts.total) * 100)}% registered` : "No roster records"}
          </p>
        </div>

        {/* Card 4: Not Marked Yet */}
        <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Not Marked Yet</span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <AlertCircle size={16} />
            </span>
          </div>
          <div className={`text-[24px] font-extrabold leading-none ${counts.notMarked > 0 ? "text-amber-700" : "text-slate-900"}`}>
            {counts.notMarked}
          </div>
          <p className="text-[11.5px] text-amber-700 font-medium mt-1.5">
            {counts.notMarked > 0 ? "Pending punch or manual entry" : "All employees marked!"}
          </p>
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="bg-white border border-bdr rounded-2xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Date Selector with Next / Prev */}
        <div className="flex items-center gap-1 bg-slate-50 border border-bdr rounded-xl p-0.5">
          <button
            type="button"
            title="Previous Day"
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-2xs cursor-pointer transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          <label className="flex items-center gap-2 px-2.5 h-8 bg-white border border-bdr/70 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer shadow-2xs">
            <CalendarIcon size={13} className="text-primary" />
            <span>{formatDateDisplay(date)}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="sr-only"
            />
          </label>

          <button
            type="button"
            title="Next Day"
            onClick={() => setDate((d) => shiftDate(d, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:shadow-2xs cursor-pointer transition-colors"
          >
            <ChevronRight size={16} />
          </button>

          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(todayISO())}
              className="px-2 h-7 rounded-lg text-[11px] font-bold text-primary hover:bg-primary/10 cursor-pointer transition-colors ml-0.5"
            >
              Today
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Department Filter */}
          <div className="relative min-w-[140px]">
            <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="w-full h-9 pl-8 pr-7 bg-slate-50 hover:bg-slate-100/70 border border-bdr rounded-xl text-xs font-medium text-slate-800 outline-none appearance-none cursor-pointer transition-colors"
            >
              {departments.map((d) => (
                <option key={d} value={d}>{d === "All" ? "All Departments" : d}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative min-w-[130px]">
            <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 pl-8 pr-7 bg-slate-50 hover:bg-slate-100/70 border border-bdr rounded-xl text-xs font-medium text-slate-800 outline-none appearance-none cursor-pointer transition-colors"
            >
              <option value="All">All Statuses</option>
              <option value="Punched">Punched Only</option>
              <option value="Not Marked">Not Marked</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[170px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee or ID…"
              className="w-full h-9 pl-8 pr-7 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-bdr focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl text-xs text-slate-800 placeholder:text-muted outline-none transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (Displayed prominently when items are checked) */}
      {selectedIds.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-purple-50/90 border border-blue-200/80 rounded-2xl p-3 px-4 shadow-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              {selectedIds.length}
            </span>
            <div className="text-xs font-bold text-slate-900">
              Employee{selectedIds.length === 1 ? "" : "s"} selected
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer ml-1"
            >
              Clear selection
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applyBulkStatus("Present")}
              className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <Check size={13} />
              Mark Present
            </button>
            <button
              type="button"
              onClick={() => applyBulkStatus("Absent")}
              className="h-8 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <X size={13} />
              Mark Absent
            </button>

            <div className="flex items-center gap-1.5 ml-1 border-l border-blue-200 pl-2">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="h-8 px-2.5 bg-white border border-blue-200 rounded-xl text-xs font-medium text-slate-800 outline-none cursor-pointer"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => applyBulkStatus(bulkStatus)}
                className="btn-outline h-8 px-3 rounded-xl text-xs font-semibold cursor-pointer bg-white hover:bg-slate-50 transition-colors"
              >
                Apply
              </button>
            </div>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary h-8 px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors ml-1"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              <span>Save Attendance</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Register Table Card */}
      <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[13px] border-collapse">
            <thead className="bg-slate-50/80 border-b border-bdr text-[11px] uppercase tracking-wider text-muted font-bold select-none">
              <tr>
                <th className="py-3.5 pl-4 pr-2 w-10">
                  <input
                    type="checkbox"
                    ref={selectAllRef}
                    checked={isAllChecked}
                    onChange={toggleSelectAll}
                    title={isAllChecked ? "Deselect all employees" : "Select all employees"}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3">Employee</th>
                <th className="py-3.5 px-3">Department</th>
                <th className="py-3.5 px-3">Source</th>
                <th className="py-3.5 px-3">Check In</th>
                <th className="py-3.5 px-3">Check Out</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Remark</th>
                <th className="py-3.5 pr-4 pl-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr/50">
              {loading && serverRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted">
                    <Loader2 size={18} className="inline animate-spin mr-2 text-primary" />
                    <span className="text-xs font-medium">Fetching attendance register…</span>
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted">
                    <p className="text-sm font-semibold text-slate-700">No employees found</p>
                    <p className="text-xs text-muted mt-1">Try adjusting the department or status filters.</p>
                  </td>
                </tr>
              )}
              {paginatedRows.map((r) => {
                const punched = r.source === "punch" || r.punchCount > 0;
                const dirty = Boolean(edits[r.employeeId]);
                const isChecked = isAttended(r.status);
                const isRowSelected = Boolean(checked[r.employeeId]);
                const statusStyle = STATUS_CONFIG[r.status] || {
                  bg: "bg-slate-50 text-slate-600 border-slate-200",
                  dot: "bg-slate-400",
                };

                return (
                  <tr
                    key={r.employeeId}
                    className={`transition-colors group ${
                      dirty
                        ? "bg-amber-50/35 border-l-4 border-l-amber-500"
                        : isRowSelected
                        ? "bg-blue-50/25"
                        : "hover:bg-slate-50/70"
                    }`}
                  >
                    {/* Selection Checkbox */}
                    <td className="py-3 pl-4 pr-2">
                      <input
                        type="checkbox"
                        checked={Boolean(checked[r.employeeId])}
                        onChange={() => {
                          setChecked((prev) => {
                            const next = { ...prev };
                            if (next[r.employeeId]) {
                              delete next[r.employeeId];
                            } else {
                              next[r.employeeId] = true;
                            }
                            return next;
                          });
                        }}
                        title="Select employee"
                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                      />
                    </td>

                    {/* Employee Profile */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        {r.avatar ? (
                          <img
                            src={r.avatar}
                            alt={r.name}
                            className="w-8 h-8 rounded-full object-cover border border-bdr shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-[11px] shrink-0 ${getAvatarColor(
                              r.name
                            )}`}
                          >
                            {getInitials(r.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 truncate leading-tight">{r.name}</span>
                            {dirty && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                Edited
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-muted leading-tight mt-0.5">
                            {r.empId || "—"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3 px-3">
                      <span className="text-xs text-slate-700 font-medium">{r.dept || "—"}</span>
                    </td>

                    {/* Source */}
                    <td className="py-3 px-3">
                      {punched ? (
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-full px-2.5 py-0.5 ${
                            r.checkIn && r.checkOut
                              ? "text-emerald-700 bg-emerald-50/90 border border-emerald-200/90"
                              : "text-blue-700 bg-blue-50/90 border border-blue-200/90"
                          }`}
                        >
                          <Fingerprint
                            size={12}
                            className={
                              r.checkIn && r.checkOut
                                ? "text-emerald-600 shrink-0"
                                : "text-blue-600 shrink-0"
                            }
                          />
                          <span>
                            {r.checkIn && r.checkOut
                              ? "Punch In & Out"
                              : r.checkIn
                              ? "Punch In"
                              : r.checkOut
                              ? "Punch Out"
                              : "Punch"}
                          </span>
                        </span>
                      ) : r.marked ? (
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-600 bg-slate-50 border border-slate-200/90 rounded-full px-2.5 py-0.5">
                          <UserCheck size={12} className="text-slate-500 shrink-0" />
                          <span className="capitalize">{r.source || "manual"}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-amber-700 bg-amber-50/90 border border-amber-200/80 rounded-full px-2.5 py-0.5">
                          <Clock size={12} className="text-amber-500 shrink-0" />
                          <span>Not marked</span>
                        </span>
                      )}
                    </td>

                    {/* Check In Time */}
                    <td className="py-3 px-3">
                      <div className="relative inline-flex items-center">
                        <Clock size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                        <input
                          type="time"
                          value={r.checkIn || ""}
                          onChange={(e) => edit(r.employeeId, { checkIn: e.target.value })}
                          className="h-8 pl-7 pr-2.5 bg-white border border-bdr rounded-lg text-xs font-mono font-medium text-slate-800 outline-none hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
                        />
                      </div>
                    </td>

                    {/* Check Out Time */}
                    <td className="py-3 px-3">
                      <div className="relative inline-flex items-center">
                        <Clock size={12} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                        <input
                          type="time"
                          value={r.checkOut || ""}
                          onChange={(e) => edit(r.employeeId, { checkOut: e.target.value })}
                          className="h-8 pl-7 pr-2.5 bg-white border border-bdr rounded-lg text-xs font-mono font-medium text-slate-800 outline-none hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
                        />
                      </div>
                    </td>

                    {/* Status Select Badge */}
                    <td className="py-3 px-3">
                      <div className="relative inline-flex items-center">
                        <select
                          value={r.status || ""}
                          onChange={(e) => handleStatusChange(r.employeeId, e.target.value)}
                          className={`h-8 pl-3 pr-7 text-xs font-semibold rounded-lg border appearance-none cursor-pointer outline-none transition-all shadow-2xs ${
                            r.status ? statusStyle.bg : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <option value="">Select status</option>
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 pointer-events-none opacity-60 text-slate-600" />
                      </div>
                    </td>

                    {/* Remark Input */}
                    <td className="py-3 px-3">
                      <input
                        value={r.remark || ""}
                        onChange={(e) => edit(r.employeeId, { remark: e.target.value })}
                        placeholder={punched && dirty ? "Reason for correction…" : "Add note…"}
                        className="h-8 px-2.5 w-44 bg-white border border-bdr rounded-lg text-xs text-slate-800 placeholder:text-muted/70 outline-none hover:border-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                      />
                    </td>

                    {/* Quick Row Actions */}
                    <td className="py-3 pr-4 pl-2 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {dirty && (
                          <button
                            type="button"
                            title="Discard edits for this employee"
                            onClick={() => resetEdit(r.employeeId)}
                            className="w-7 h-7 rounded-lg text-amber-700 bg-amber-100/70 hover:bg-amber-200 flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          title={r.status === "Present" ? "Currently marked Present" : "Mark Present"}
                          onClick={() => quickMark(r.employeeId, "Present")}
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                            r.status === "Present"
                              ? "text-white bg-emerald-600 border-emerald-600 shadow-2xs"
                              : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                          }`}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          title={r.status === "Absent" ? "Currently marked Absent" : "Mark Absent"}
                          onClick={() => quickMark(r.employeeId, "Absent")}
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                            r.status === "Absent"
                              ? "text-white bg-rose-600 border-rose-600 shadow-2xs"
                              : "text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200"
                          }`}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-bdr bg-white">
          <Pagination
            total={filtered.length}
            page={page}
            pageSize={pageSize}
            pageSizeOptions={[10, 20, 50, 100]}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            onChange={setPage}
          />
        </div>

        {/* Bottom Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-bdr bg-slate-50/60">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-600" />
              Showing {filtered.length} of {rows.length} employees. Biometric punches sync automatically.
            </span>
          </div>
        </div>
      </div>


    </div>
  );
}
