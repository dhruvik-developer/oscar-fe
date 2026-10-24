import { useState, useMemo, useEffect, useCallback } from "react";
import { useAppStore } from "../../../stores/appStore";
import { useCalendarStore } from "../../../stores/calendarStore";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import { hrmsSync, pullLeaveBalanceSummary, cancelLeave, describeError } from "../../../services/hrmsSync";
import { Badge } from "../../../components/hrms/Badge";
import Modal from "../../../components/ui/Modal";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { Avatar } from "../../../components/hrms/Avatar";
import MasterSourceLink from "../../../components/common/MasterSourceLink";
import {
  Calendar,
  Search,
  AlertTriangle,
  Info,
  Check,
  Clock,
  XCircle,
  Plus,
  Sparkles,
  Plane,
  HeartPulse,
  Coffee,
  Coins,
  CalendarCheck,
  Loader2,
} from "lucide-react";

/** Requests still waiting on a decision. */
const PENDING_STATUSES = ["Pending Review", "Delegate Confirmed"];

/** Card icon for a leave type, by its name/code. */
function leaveTypeIcon(name = "", code = "") {
  const key = `${name} ${code}`.toLowerCase();
  if (key.includes("sick")) return HeartPulse;
  if (key.includes("casual")) return Coffee;
  if (key.includes("earned") || key.includes("annual") || key.includes("privilege")) return Plane;
  if (key.includes("comp")) return Clock;
  if (key.includes("loss of pay") || key.includes("lop") || key.includes("unpaid")) return XCircle;
  return CalendarCheck;
}

/** `YYYY-MM-DD` → Date at local midnight (no UTC shift). */
function localDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDays(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export default function Leave() {
  const {
    leaves = [],
    updateLeaveStatus,
    rejectLeave,
    addLeave,
    showToast,
    employees = [],
    currentUser,
    encashments = [],
    compOffCredits = [],
    requestEncashment,
    approveEncashment,
    rejectEncashment,
    requestCompOff,
    approveCompOff,
    rejectCompOff,
  } = useAppStore();

  const calendarEvents = useCalendarStore((s) => s.events || []);

  const [tab, setTab] = useState("assigned");

  // Approval filters
  const [approvalSearch, setApprovalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  // Modal states
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedLeaveToReject, setSelectedLeaveToReject] = useState(null);
  const [rejectReasonInput, setRejectReasonInput] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [detailModalLeave, setDetailModalLeave] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyLeaveId, setBusyLeaveId] = useState(null);

  // Encashment & Comp-Off Modal States
  const [encashModalOpen, setEncashModalOpen] = useState(false);
  const [compOffModalOpen, setCompOffModalOpen] = useState(false);
  const [encashForm, setEncashForm] = useState({
    employeeName: "",
    days: 1,
    reason: "",
  });
  const [compOffForm, setCompOffForm] = useState({
    employeeName: "",
    workedDate: new Date().toISOString().slice(0, 10),
    hoursWorked: 8,
    creditDays: 1,
    reason: "",
  });

  const [form, setForm] = useState({
    employeeId: "",
    leaveTypeId: "",
    from: "",
    to: "",
    halfDay: false,
    reason: "",
    delegateSearch: "",
    delegateId: "",
    handover: "",
  });
  const [delegateSelect, setDelegateSelect] = useState({});

  const empById = useMemo(() => new Map(employees.map((e) => [String(e.id), e])), [employees]);
  const employeeName = useCallback((id) => empById.get(String(id || ""))?.name || "", [empById]);
  const delegateNameOf = useCallback(
    (l) => employeeName(l.delegateId) || (typeof l.delegate === "string" ? l.delegate : "") || "",
    [employeeName]
  );

  // Who the form (and the balance cards) is about: the picked employee, else
  // the signed-in user's own record, else the first employee on the list.
  const defaultEmployeeId = useMemo(() => {
    const own = currentUser?.employeeId;
    if (own && empById.has(String(own))) return String(own);
    return employees[0]?.id ? String(employees[0].id) : "";
  }, [currentUser, empById, employees]);
  const selectedEmployeeId = form.employeeId || defaultEmployeeId;
  const selectedEmployee = empById.get(String(selectedEmployeeId)) || null;

  // ── Leave types (server-configured) ──
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveTypesLoaded, setLeaveTypesLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    hrmsSync
      .pull("leaveTypes")
      .then((rows) => {
        if (!alive) return;
        setLeaveTypes(Array.isArray(rows) ? rows : []);
        setLeaveTypesLoaded(true);
      })
      .catch(() => alive && setLeaveTypesLoaded(true));
    return () => {
      alive = false;
    };
  }, []);
  const selectedTypeId = form.leaveTypeId || leaveTypes[0]?.id || "";
  const selectedType = leaveTypes.find((t) => String(t.id) === String(selectedTypeId)) || null;

  // ── Balances for the selected employee (server summary) ──
  const [balanceReload, setBalanceReload] = useState(0);
  const [balanceState, setBalanceState] = useState({ key: "", rows: [], error: false });
  const balanceKey = `${selectedEmployeeId}:${balanceReload}`;
  useEffect(() => {
    if (!selectedEmployeeId) return undefined;
    let alive = true;
    pullLeaveBalanceSummary(selectedEmployeeId)
      .then((res) => {
        if (!alive) return;
        setBalanceState({
          key: balanceKey,
          rows: Array.isArray(res?.balances) ? res.balances : [],
          error: !res,
        });
      })
      .catch(() => alive && setBalanceState({ key: balanceKey, rows: [], error: true }));
    return () => {
      alive = false;
    };
  }, [selectedEmployeeId, balanceKey]);
  const balancesLoading = Boolean(selectedEmployeeId) && balanceState.key !== balanceKey;
  const balances = useMemo(
    () => (balanceState.key === balanceKey ? balanceState.rows : []),
    [balanceState, balanceKey]
  );
  const reloadBalances = () => setBalanceReload((n) => n + 1);

  const selectedTypeBalance = useMemo(
    () => balances.find((b) => String(b.leaveTypeId) === String(selectedTypeId)) || null,
    [balances, selectedTypeId]
  );

  const filteredEmployees = useMemo(() => {
    if (!form.delegateSearch) return [];
    return employees
      .filter((e) =>
        String(e.name ?? "").toLowerCase().includes(String(form.delegateSearch ?? "").toLowerCase()) &&
        String(e.id) !== String(selectedEmployeeId)
      )
      .slice(0, 5);
  }, [employees, form.delegateSearch, selectedEmployeeId]);

  // Official holidays inside the requested interval
  const holidayOverlap = useMemo(() => {
    if (!form.from || !form.to) return [];
    return calendarEvents.filter((ev) => {
      if (ev.type !== "Holiday") return false;
      const hDate = String(ev.startDate || ev.date || "").slice(0, 10);
      return hDate >= form.from && hDate <= form.to;
    });
  }, [calendarEvents, form.from, form.to]);

  const isSingleDay = Boolean(form.from && form.to && form.from === form.to);

  // Estimate only — the server counts working days from the configured
  // working-day calendar when the request is filed.
  const calculatedDays = useMemo(() => {
    const start = localDate(form.from);
    const end = localDate(form.to);
    if (!start || !end || end < start) return 0;
    if (isSingleDay && form.halfDay) return 0.5;
    let weekdays = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) weekdays++;
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(0, weekdays - holidayOverlap.length);
  }, [form.from, form.to, form.halfDay, isSingleDay, holidayOverlap.length]);

  const exceedsBalance = Boolean(
    selectedType?.isPaid !== false &&
      selectedTypeBalance &&
      calculatedDays > Number(selectedTypeBalance.available || 0)
  );

  /** Re-read everything an approval/rejection/cancellation touches. */
  function refreshAfterDecision() {
    useAppStore.getState().refreshHrms("leaves");
    useAttendanceStore.getState().refreshAttendance?.();
    reloadBalances();
  }

  async function submitLeave() {
    if (submitting) return;
    if (!selectedEmployeeId) return showToast("Please select an employee", "error");
    if (!selectedType) return showToast("Please select a leave type", "error");
    if (!form.from || !form.to) return showToast("Please select leave dates", "error");
    if (form.to < form.from) return showToast("To Date cannot be before From Date", "error");
    if (!form.reason.trim()) return showToast("Reason required for leave application", "error");

    const handover = form.handover.trim();
    const payload = {
      employeeId: selectedEmployeeId,
      employee: selectedEmployee?.name || "",
      leaveTypeId: selectedType.id,
      type: selectedType.name,
      fromDate: form.from,
      toDate: form.to,
      from: form.from,
      to: form.to,
      reason: handover ? `${form.reason.trim()} — Handover: ${handover}` : form.reason.trim(),
      delegateId: form.delegateId || undefined,
      status: "Pending Review",
    };
    // Half a day must be stated; otherwise the server counts working days.
    if (isSingleDay && form.halfDay) payload.days = 0.5;

    setSubmitting(true);
    try {
      const saved = await addLeave(payload);
      if (!saved) {
        showToast("Leave not submitted — the server is not reachable", "error");
        return;
      }
      showToast(
        `Leave applied for ${selectedEmployee?.name || "employee"} (${formatDays(saved.days ?? calculatedDays)} day(s)) — awaiting approval`
      );
      setForm((f) => ({ ...f, from: "", to: "", halfDay: false, reason: "", handover: "", delegateSearch: "", delegateId: "" }));
      setApplyModalOpen(false);
      reloadBalances();
    } catch {
      // addLeave already toasted the server's reason (overlap, validation …)
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(leaveItem) {
    if (busyLeaveId) return;
    const chosenDelegateId = delegateSelect[leaveItem.id] ?? leaveItem.delegateId ?? "";
    setBusyLeaveId(leaveItem.id);
    try {
      // A reassigned delegate is saved first — the approval itself only moves the status.
      if (String(chosenDelegateId || "") !== String(leaveItem.delegateId || "")) {
        try {
          await hrmsSync.update("leaves", leaveItem.id, { delegateId: chosenDelegateId || null });
        } catch (err) {
          showToast(`Delegate not changed — ${describeError(err)}`, "error");
          return;
        }
      }
      const saved = await updateLeaveStatus(leaveItem.id, "Approved");
      if (saved) {
        const delegate = employeeName(chosenDelegateId);
        showToast(
          `Leave approved for ${leaveItem.employee}${delegate ? ` with delegate ${delegate}` : ""}. Attendance marked On Leave.`
        );
      }
    } finally {
      setBusyLeaveId(null);
      refreshAfterDecision();
    }
  }

  function handleOpenReject(leaveItem) {
    setSelectedLeaveToReject(leaveItem);
    setRejectReasonInput("");
    setRejectModalOpen(true);
  }

  async function handleConfirmReject() {
    if (!selectedLeaveToReject || busyLeaveId) return;
    const target = selectedLeaveToReject;
    setBusyLeaveId(target.id);
    try {
      const saved = await rejectLeave(target.id, rejectReasonInput.trim() || "Scheduling conflict / insufficient coverage.");
      if (saved) showToast(`Leave request for ${target.employee} has been rejected.`);
      setRejectModalOpen(false);
      setSelectedLeaveToReject(null);
    } finally {
      setBusyLeaveId(null);
      refreshAfterDecision();
    }
  }

  function handleOpenCancel(leaveItem) {
    setCancelTarget(leaveItem);
    setCancelReasonInput("");
  }

  async function handleConfirmCancel() {
    if (!cancelTarget || busyLeaveId) return;
    const target = cancelTarget;
    setBusyLeaveId(target.id);
    try {
      await cancelLeave(target.id, { reason: cancelReasonInput.trim() || undefined });
      showToast(
        target.status === "Approved"
          ? `Leave cancelled for ${target.employee} — attendance and balance restored.`
          : `Leave request for ${target.employee} cancelled.`
      );
      setCancelTarget(null);
    } catch (err) {
      showToast(`Leave not cancelled — ${describeError(err)}`, "error");
    } finally {
      setBusyLeaveId(null);
      refreshAfterDecision();
    }
  }

  const filteredLeaves = useMemo(() => {
    const q = approvalSearch.toLowerCase();
    return leaves.filter((l) => {
      const matchSearch =
        !q ||
        String(l.employee ?? "").toLowerCase().includes(q) ||
        String(l.employeeCode ?? "").toLowerCase().includes(q) ||
        String(l.reason ?? "").toLowerCase().includes(q) ||
        String(l.id ?? "").toLowerCase().includes(q);
      const matchStatus =
        statusFilter === "All" ||
        (statusFilter === "Pending Review" ? PENDING_STATUSES.includes(l.status) : l.status === statusFilter);
      const matchType = typeFilter === "All" || String(l.leaveTypeId) === String(typeFilter);
      return matchSearch && matchStatus && matchType;
    });
  }, [leaves, approvalSearch, statusFilter, typeFilter]);

  const userDelegations = useMemo(() => {
    const myId = currentUser?.employeeId ? String(currentUser.employeeId) : "";
    const myName = String(currentUser?.name || "").toLowerCase();
    const isMe = (id, name) =>
      (myId && String(id || "") === myId) || (!myId && myName && String(name || "").toLowerCase() === myName);
    const statusOf = (l) =>
      l.status === "Approved" ? "Active" : l.status === "Rejected" || l.status === "Cancelled" ? "Declined" : "Upcoming";

    const assigned = leaves
      .filter((l) => isMe(l.delegateId, delegateNameOf(l)))
      .map((l) => ({
        id: l.id,
        emp: l.employee,
        dates: `${l.from} – ${l.to}`,
        note: l.reason || "—",
        status: statusOf(l),
        type: l.type,
      }));

    const mine = leaves
      .filter((l) => isMe(l.employeeId, l.employee) && (l.delegateId || l.delegate))
      .map((l) => ({
        id: l.id,
        emp: delegateNameOf(l) || "Assigned Colleague",
        dates: `${l.from} – ${l.to}`,
        note: l.reason || "—",
        status: statusOf(l),
        type: l.type,
      }));

    return {
      assigned,
      mine,
    };
  }, [leaves, currentUser, delegateNameOf]);

  const pendingCount = leaves.filter((l) => PENDING_STATUSES.includes(l.status)).length;

  const typeOptions = leaveTypes.map((t) => (
    <option key={t.id} value={t.id}>
      {t.name}{t.isPaid === false ? " (unpaid)" : ""}
    </option>
  ));

  const balanceHint = selectedType ? (
    selectedType.isPaid === false ? (
      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-[11.5px] text-slate-600">
        <Info size={14} className="text-slate-500 shrink-0" />
        <span>{selectedType.name} is unpaid — no quota; these days are deducted from salary (LOP).</span>
      </div>
    ) : balancesLoading ? (
      <div className="text-[11.5px] text-muted flex items-center gap-1.5">
        <Loader2 size={13} className="animate-spin" /> Loading balance…
      </div>
    ) : selectedTypeBalance ? (
      <div
        className={`p-2.5 border rounded-xl flex items-start gap-2 text-[12px] ${
          exceedsBalance ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-emerald-50/70 border-emerald-200/80 text-emerald-800"
        }`}
      >
        {exceedsBalance ? (
          <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
        ) : (
          <CalendarCheck size={15} className="shrink-0 mt-0.5 text-emerald-600" />
        )}
        <span>
          <b>{formatDays(selectedTypeBalance.available)}</b> day(s) of {selectedType.name} available
          {Number(selectedTypeBalance.pending) > 0 && ` (${formatDays(selectedTypeBalance.pending)} pending approval)`}.
          {exceedsBalance &&
            ` Requested ~${formatDays(calculatedDays)} day(s) exceeds the balance — approval will be refused unless the balance is topped up or Loss of Pay is used.`}
        </span>
      </div>
    ) : null
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leave Management"
        subtitle="Apply, approve, monitor leave quotas, encashment, and comp-off credits"
        guide={hrmsGuides.leave}
        actions={
          <>
            <button
              type="button"
              onClick={() => setCompOffModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-[13px] font-medium shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Clock size={15} className="text-amber-600" />
              Claim Comp-Off
            </button>
            <button
              type="button"
              onClick={() => setEncashModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-[13px] font-medium shadow-2xs hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Coins size={15} className="text-emerald-700" />
              Encash Leave
            </button>
            <button
              type="button"
              onClick={() => setApplyModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium shadow-xs hover:bg-navy/90 transition-colors cursor-pointer"
            >
              <Plus size={16} />
              Apply Leave
            </button>
          </>
        }
      />

      {/* ── Leave Quota Balance Cards (server balances, one per leave type) ── */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12.5px] font-semibold text-slate-700">
            Leave balances{selectedEmployee ? ` — ${selectedEmployee.name}` : ""}
            <span className="text-muted font-medium"> · {new Date().getFullYear()}</span>
          </span>
          {balancesLoading && (
            <span className="text-[11.5px] text-muted inline-flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" /> Loading balances…
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {balancesLoading &&
            [0, 1, 2, 3].map((i) => (
              <div key={`sk-${i}`} className="bg-white border border-bdr rounded-2xl p-4 shadow-xs h-[118px] animate-pulse">
                <div className="h-3 w-24 bg-slate-100 rounded" />
                <div className="h-6 w-16 bg-slate-100 rounded mt-4" />
                <div className="h-1.5 w-full bg-slate-100 rounded mt-6" />
              </div>
            ))}
          {!balancesLoading && balances.length === 0 && (
            <div className="col-span-2 md:col-span-4 text-center py-6 text-muted text-[13px] border border-dashed border-bdr rounded-2xl bg-white">
              {!selectedEmployeeId
                ? "Add employees to see leave balances."
                : balanceState.error
                ? "Leave balances could not be loaded."
                : "No leave types are set up yet."}
            </div>
          )}
          {balances.map((item) => {
            const isPaid = item.isPaid !== false;
            const total = Number(item.total) || 0;
            const available = Number(item.available) || 0;
            const used = Number(item.used) || 0;
            const pending = Number(item.pending) || 0;
            const carried = Number(item.carriedForward) || 0;
            const percent = isPaid && total > 0 ? Math.max(0, Math.min(100, Math.round((available / total) * 100))) : 0;
            const IconComp = leaveTypeIcon(item.leaveType, item.code);

            return (
              <div
                key={item.leaveTypeId}
                className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-semibold text-slate-600 uppercase tracking-wide">
                    {item.leaveType}
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                    <IconComp size={15} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-baseline justify-between">
                  {isPaid ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[24px] font-extrabold text-slate-900 tracking-tight leading-none">
                        {formatDays(available)}
                      </span>
                      <span className="text-[11.5px] text-muted font-medium">/ {formatDays(total)} left</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[24px] font-extrabold text-slate-900 tracking-tight leading-none">
                        {formatDays(used)}
                      </span>
                      <span className="text-[11.5px] text-muted font-medium">days taken · unpaid</span>
                    </div>
                  )}
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    {formatDays(used)} used
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-2 text-[10.5px] font-semibold">
                  {pending > 0 && <span className="text-amber-700">{formatDays(pending)} pending</span>}
                  {carried > 0 && <span className="text-emerald-700">+{formatDays(carried)} carried over</span>}
                  {!isPaid && <span className="text-slate-500">No quota — deducted as LOP</span>}
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-navy rounded-full transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Leave Application Form */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 self-start bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
            <div>
              <h3 className="font-bold text-[15px] text-slate-900">Apply for Leave</h3>
              <p className="text-[12px] text-muted mt-0.5">Fill in duration and, optionally, a work delegate</p>
            </div>
            <span className="text-[11.5px] font-semibold px-2.5 py-1 bg-navy/5 text-navy rounded-lg" title="Estimate — the server counts working days from the working-day calendar">
              ~{formatDays(calculatedDays)} working day{calculatedDays === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[12px] font-semibold text-slate-700 block">Applying Employee</label>
                <MasterSourceLink source="employees" />
              </div>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value, delegateId: "" })}
                className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13.5px] font-medium text-slate-900 focus:outline-none focus:border-navy"
              >
                {employees.length === 0 && <option value="">No employees</option>}
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.department} • {emp.designation})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-slate-700 block mb-1">Leave Type</label>
              <select
                value={selectedTypeId}
                onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
                className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
              >
                {leaveTypes.length === 0 && (
                  <option value="">{leaveTypesLoaded ? "No leave types configured" : "Loading leave types…"}</option>
                )}
                {typeOptions}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted block mb-1">From Date</label>
                <input
                  type="date"
                  value={form.from}
                  onChange={(e) => setForm({ ...form, from: e.target.value, to: form.to && form.to < e.target.value ? e.target.value : form.to })}
                  className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] text-slate-900 focus:outline-none focus:border-navy"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted block mb-1">To Date</label>
                <input
                  type="date"
                  value={form.to}
                  min={form.from || undefined}
                  onChange={(e) => setForm({ ...form, to: e.target.value })}
                  className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] text-slate-900 focus:outline-none focus:border-navy"
                />
              </div>
            </div>

            {isSingleDay && (
              <label className="flex items-center gap-2 text-[12.5px] text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.halfDay}
                  onChange={(e) => setForm({ ...form, halfDay: e.target.checked })}
                />
                Half day (0.5 day — marked "Half Day" in attendance)
              </label>
            )}

            {balanceHint}

            {holidayOverlap.length > 0 && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[12px] text-emerald-800 flex items-start gap-2">
                <Sparkles size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Holiday Calendar Detection:</span> {holidayOverlap.length} official holiday(s) in this period (
                  <b>{holidayOverlap.map((h) => h.title).join(", ")}</b>) will not deduct from the quota.
                </div>
              </div>
            )}

            <div>
              <label className="text-[12px] font-semibold text-slate-700 block mb-1">Reason for Leave *</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Brief reason for leave..."
                rows={2}
                className="w-full p-3 bg-off border border-bdr rounded-xl text-[13.5px] resize-none focus:outline-none focus:border-navy"
              />
            </div>

            <div>
              <label className="text-[12px] font-semibold text-slate-700 block mb-1">
                Assign Work Coverage (Delegate)
              </label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={form.delegateSearch}
                  onChange={(e) => setForm({ ...form, delegateSearch: e.target.value })}
                  placeholder="Search colleague by name..."
                  className="w-full h-10 pl-9 pr-4 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy"
                />
              </div>

              {form.delegateSearch && filteredEmployees.length > 0 && (
                <div className="mt-1.5 border border-bdr rounded-xl divide-y divide-bdr/40 max-h-36 overflow-y-auto bg-white shadow-md z-10 relative">
                  {filteredEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      onClick={() => setForm({ ...form, delegateId: String(emp.id), delegateSearch: "" })}
                      className={`flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer ${
                        String(form.delegateId) === String(emp.id) ? "bg-navy/5" : ""
                      }`}
                    >
                      <Avatar name={emp.name} size="xs" />
                      <div>
                        <div className="text-[13px] font-medium leading-none text-slate-900">{emp.name}</div>
                        <div className="text-[11px] text-muted mt-0.5">
                          {emp.designation} • {emp.department}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {form.delegateId && (
                <div className="mt-2 text-[12.5px] text-slate-600 flex items-center gap-1.5">
                  <span>Selected delegate:</span>
                  <span className="font-semibold text-navy bg-navy/5 px-2 py-0.5 rounded-md">
                    {employeeName(form.delegateId)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, delegateId: "" })}
                    className="text-[11.5px] text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-[12px] font-semibold text-slate-700 block mb-1">
                Handover Responsibilities / Notes
              </label>
              <textarea
                value={form.handover}
                onChange={(e) => setForm({ ...form, handover: e.target.value })}
                placeholder="Describe pending tasks, open issues, or handover responsibilities..."
                rows={2}
                className="w-full p-3 bg-off border border-bdr rounded-xl text-[13px] resize-none focus:outline-none focus:border-navy"
              />
            </div>

            <p className="text-[11px] text-muted flex items-center gap-1.5 pt-1">
              <Info size={13} className="shrink-0 text-slate-400" />
              On approval the leave days are marked "On Leave" in attendance and deducted from the balance.
            </p>

            <button
              type="button"
              onClick={submitLeave}
              disabled={submitting}
              className="w-full py-2.5 bg-navy hover:bg-navy/90 disabled:opacity-60 text-white rounded-xl text-[13.5px] font-semibold transition-colors cursor-pointer shadow-xs"
            >
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
          </div>
        </div>

        {/* Pending Approvals Queue */}
        <div className="lg:col-span-7 bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex flex-wrap justify-between items-center gap-3 border-b border-bdr/60 pb-3">
            <div>
              <h3 className="font-bold text-[15px] text-slate-900 flex items-center gap-2">
                Approvals &amp; Leave Requests
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-bold">
                  {pendingCount} pending
                </span>
              </h3>
              <p className="text-[12px] text-muted mt-0.5">Review, reassign delegates, and approve team leaves</p>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl max-w-full lg:max-w-none overflow-x-auto lg:overflow-visible scrollbar-none">
              {["All", "Pending Review", "Approved", "Rejected", "Cancelled"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-lg transition cursor-pointer shrink-0 lg:shrink whitespace-nowrap ${
                    statusFilter === st ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {st === "Pending Review" ? "Pending" : st}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Type Filter Bar */}
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[180px] lg:min-w-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={approvalSearch}
                onChange={(e) => setApprovalSearch(e.target.value)}
                placeholder="Search employee, code, or reason..."
                className="w-full h-9 pl-8 pr-3 bg-off border border-bdr rounded-xl text-[12.5px] focus:outline-none focus:border-navy"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy"
            >
              <option value="All">All Types</option>
              {typeOptions}
            </select>
          </div>

          {/* Leaves List with clean internal scrolling */}
          <div className="space-y-3.5 mt-1 max-h-[600px] overflow-y-auto pr-2">
            {filteredLeaves.map((l) => {
              const isPending = PENDING_STATUSES.includes(l.status);
              const currentDelegateId = delegateSelect[l.id] ?? l.delegateId ?? "";
              const currentDelegate = employeeName(currentDelegateId) || (currentDelegateId ? "" : delegateNameOf(l));
              const busy = busyLeaveId === l.id;
              const canCancel = isPending || l.status === "Approved";

              return (
                <div
                  key={l.id}
                  className="border border-bdr rounded-2xl p-4 flex flex-col gap-3 transition hover:border-slate-300"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3 min-w-0 lg:min-w-auto">
                      <Avatar name={l.employee} size="md" />
                      <div className="min-w-0 lg:min-w-auto">
                        <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-2">
                          <span className="text-[13.5px] font-bold text-slate-900">{l.employee}</span>
                          {l.employeeCode && (
                            <span className="text-[11px] font-medium text-slate-400">({l.employeeCode})</span>
                          )}
                        </div>
                        <div className="text-[12px] text-slate-600 font-medium">
                          {l.type} • <span className="font-semibold text-slate-900">{formatDays(l.days)} day(s)</span>
                        </div>
                        <div className="text-[11.5px] text-muted mt-0.5">
                          {l.from} – {l.to}
                          {l.reason && (
                            <>
                              {" "}• Reason: <span className="text-slate-700 italic">"{l.reason}"</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Badge
                      tone={
                        l.status === "Approved"
                          ? "success"
                          : l.status === "Rejected"
                          ? "critical"
                          : l.status === "Cancelled"
                          ? "neutral"
                          : l.status === "Delegate Confirmed"
                          ? "info"
                          : "warning"
                      }
                    >
                      {l._pending ? "Submitting…" : l.status}
                    </Badge>
                  </div>

                  {/* Delegate Handover Card */}
                  {(isPending || currentDelegate) && (
                    <div className="bg-slate-50 border border-bdr/70 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={currentDelegate || "?"} size="xs" />
                        <div>
                          <div className="text-[12.5px] font-semibold text-slate-800 flex items-center gap-1.5">
                            <span>Delegate: {currentDelegate || "None assigned"}</span>
                          </div>
                          <div className="text-[11px] text-muted">
                            {l.status === "Delegate Confirmed" ? "Delegate has confirmed coverage" : "Assigned handover coverage"}
                          </div>
                        </div>
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <span className="text-[11.5px] text-muted">Reassign:</span>
                          <select
                            value={currentDelegateId}
                            onChange={(e) =>
                              setDelegateSelect({ ...delegateSelect, [l.id]: e.target.value })
                            }
                            className="h-7.5 px-2 bg-white border border-bdr rounded-lg text-[12px] font-medium text-slate-800 focus:outline-none focus:border-navy cursor-pointer max-w-[180px]"
                          >
                            <option value="">No delegate</option>
                            {employees
                              .filter((emp) => String(emp.id) !== String(l.employeeId))
                              .map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {l.status === "Rejected" && (l.remark || l.rejectReason) && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[12px] text-rose-800">
                      <b>Rejection Reason:</b> {l.remark || l.rejectReason}
                    </div>
                  )}
                  {l.status === "Cancelled" && l.remark && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] text-slate-700">
                      <b>Cancellation note:</b> {l.remark}
                    </div>
                  )}

                  {canCancel && !l._pending && (
                    <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 pt-1 border-t border-bdr/40">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleOpenCancel(l)}
                        className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-[12.5px] font-medium transition cursor-pointer disabled:opacity-60"
                      >
                        {l.status === "Approved" ? "Cancel Leave" : "Withdraw"}
                      </button>
                      {isPending && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleOpenReject(l)}
                            className="px-3.5 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-700 rounded-xl text-[12.5px] font-medium transition cursor-pointer disabled:opacity-60"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleApprove(l)}
                            className="inline-flex items-center gap-1 px-4 py-1.5 bg-navy hover:bg-navy/90 text-white rounded-xl text-[12.5px] font-semibold transition cursor-pointer shadow-xs disabled:opacity-60"
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            {currentDelegate ? `Approve with ${currentDelegate}` : "Approve"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredLeaves.length === 0 && (
              <div className="text-center py-10 text-muted text-[13px] border border-dashed border-bdr rounded-2xl">
                {leaves.length === 0
                  ? "No leave requests yet. Applications submitted here appear in this queue."
                  : "No leave requests match the selected filters."}
              </div>
            )}
          </div>

          {filteredLeaves.length > 0 && (
            <div className="pt-2 border-t border-bdr/60 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 text-[11.5px] text-muted">
              <span>Showing {filteredLeaves.length} leave application{filteredLeaves.length === 1 ? "" : "s"}</span>
              {filteredLeaves.length > 3 && (
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Scroll for more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Delegations & Governance Tracker Card ── */}
      <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 pb-0">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="font-bold text-[16px] text-slate-900">Work Handover, Comp-Off &amp; Encashment Governance</h3>
              <p className="text-[12px] text-muted mt-0.5">
                Track team delegations, approve compensatory off claims, and manage leave encashment payouts
              </p>
            </div>
            <span className="text-[12px] text-muted">
              {tab === "assigned" && `Showing ${userDelegations.assigned.length} assigned delegation(s)`}
              {tab === "mine" && `Showing ${userDelegations.mine.length} active coverage assignment(s)`}
              {tab === "compoff" && `Showing ${compOffCredits.length} comp-off claim(s)`}
              {tab === "encashment" && `Showing ${encashments.length} leave encashment request(s)`}
            </span>
          </div>

          <div className="flex gap-4 mt-4 border-b border-bdr overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setTab("assigned")}
              className={`pb-3 text-[13px] font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 lg:shrink ${
                tab === "assigned"
                  ? "border-navy text-navy"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>Assigned to me</span>
              <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-700">
                {userDelegations.assigned.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("mine")}
              className={`pb-3 text-[13px] font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 lg:shrink ${
                tab === "mine"
                  ? "border-navy text-navy"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>My delegations</span>
              <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-700">
                {userDelegations.mine.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("compoff")}
              className={`pb-3 text-[13px] font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 lg:shrink ${
                tab === "compoff"
                  ? "border-navy text-navy"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Clock size={14} className="text-amber-600" />
              <span>Comp-Off Credits</span>
              <span className="px-2 py-0.5 text-[11px] rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                {compOffCredits.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("encashment")}
              className={`pb-3 text-[13px] font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 lg:shrink ${
                tab === "encashment"
                  ? "border-navy text-navy"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Coins size={14} className="text-emerald-600" />
              <span>Leave Encashments</span>
              <span className="px-2 py-0.5 text-[11px] rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                {encashments.length}
              </span>
            </button>
          </div>
        </div>

        {/* Delegations View */}
        {(tab === "assigned" || tab === "mine") && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] lg:min-w-0 text-left">
              <thead className="bg-slate-50/75 border-y border-bdr text-[11px] uppercase tracking-wider text-muted font-bold">
                <tr>
                  <th className="py-3.5 px-5">Colleague</th>
                  <th className="py-3.5 px-5">Leave Period</th>
                  <th className="py-3.5 px-5">Handover Deliverables</th>
                  <th className="py-3.5 px-5">Type</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/40 text-[13px]">
                {(tab === "assigned" ? userDelegations.assigned : userDelegations.mine).map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.emp} size="xs" />
                        <span className="font-semibold text-slate-900">{r.emp}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-[12.5px] text-slate-700 font-medium">{r.dates}</td>
                    <td className="py-3.5 px-5 text-[12.5px] text-slate-600 max-w-[280px]">
                      <div className="truncate">{r.note}</div>
                    </td>
                    <td className="py-3.5 px-5 text-[12.5px] text-slate-600">
                      <span className="font-medium">{r.type || "—"}</span>
                    </td>
                    <td className="py-3.5 px-5">
                      <Badge
                        tone={
                          r.status === "Active"
                            ? "success"
                            : r.status === "Upcoming"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailModalLeave(r)}
                        className="px-3 py-1 bg-white border border-bdr rounded-lg text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Comp-Off Credits View */}
        {tab === "compoff" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] lg:min-w-0 text-left">
              <thead className="bg-slate-50/75 border-y border-bdr text-[11px] uppercase tracking-wider text-muted font-bold">
                <tr>
                  <th className="py-3.5 px-5">Claim ID &amp; Employee</th>
                  <th className="py-3.5 px-5">Worked Date &amp; Hours</th>
                  <th className="py-3.5 px-5">Credit Entitlement</th>
                  <th className="py-3.5 px-5">Project / Justification</th>
                  <th className="py-3.5 px-5">Expiry Window</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/40 text-[13px]">
                {compOffCredits.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.employee} size="xs" />
                        <div>
                          <div className="font-semibold text-slate-900">{c.employee}</div>
                          <div className="text-[11px] text-muted">{c.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-[12.5px] text-slate-700 font-medium">
                      <div>{c.workedDate}</div>
                      <div className="text-[11px] text-muted">{c.hoursWorked}h logged</div>
                    </td>
                    <td className="py-3.5 px-5 text-[12.5px]">
                      <span className="font-bold text-slate-900 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                        {c.creditDays} Day{c.creditDays > 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[12.5px] text-slate-600 max-w-[260px]">
                      <div className="truncate">{c.reason}</div>
                    </td>
                    <td className="py-3.5 px-5 text-[12px] text-muted font-medium">
                      {c.expiryDate || "—"}
                    </td>
                    <td className="py-3.5 px-5">
                      <Badge tone={c.status === "Approved" ? "success" : c.status === "Rejected" ? "critical" : "warning"}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {c.status === "Pending" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              rejectCompOff(c.id, "Insufficient overtime proof");
                              showToast(`Comp-off claim ${c.id} rejected.`);
                            }}
                            className="px-2.5 py-1 text-[11.5px] font-medium text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              approveCompOff(c.id);
                              showToast(`Comp-off claim approved: ${c.creditDays} day credited to ${c.employee}.`);
                            }}
                            className="px-3 py-1 text-[11.5px] font-semibold text-white bg-navy rounded-lg hover:bg-navy/90 transition shadow-2xs cursor-pointer flex items-center gap-1"
                          >
                            <Check size={12} /> Approve
                          </button>
                        </div>
                      ) : c.status === "Approved" ? (
                        <span className="text-[11.5px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                          <Check size={11} /> Credited to Balance
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-rose-700 font-medium">Rejected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Leave Encashments View */}
        {tab === "encashment" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] lg:min-w-0 text-left">
              <thead className="bg-slate-50/75 border-y border-bdr text-[11px] uppercase tracking-wider text-muted font-bold">
                <tr>
                  <th className="py-3.5 px-5">Request ID &amp; Employee</th>
                  <th className="py-3.5 px-5">Encashed Days</th>
                  <th className="py-3.5 px-5">Estimated Payout Rate</th>
                  <th className="py-3.5 px-5">Reason</th>
                  <th className="py-3.5 px-5">Payroll Cycle</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Approval &amp; Payroll Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/40 text-[13px]">
                {encashments.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.employee} size="xs" />
                        <div>
                          <div className="font-semibold text-slate-900">{e.employee}</div>
                          <div className="text-[11px] text-muted">{e.id} • {e.requestDate}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-[12.5px]">
                      <span className="font-bold text-slate-900 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {e.days} Day{e.days > 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[12.5px] text-slate-700 font-medium">
                      <div className="font-bold text-slate-900">₹{(e.amount || e.days * 2083).toLocaleString()}</div>
                      <div className="text-[11px] text-muted">@ ₹{e.ratePerDay || 2083}/day rate</div>
                    </td>
                    <td className="py-3.5 px-5 text-[12.5px] text-slate-600 max-w-[240px]">
                      <div className="truncate">{e.reason}</div>
                    </td>
                    <td className="py-3.5 px-5 text-[12px] text-slate-700 font-medium">
                      {e.processedMonth || "—"}
                    </td>
                    <td className="py-3.5 px-5">
                      <Badge tone={e.status === "Approved" ? "success" : e.status === "Rejected" ? "critical" : "warning"}>
                        {e.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {e.status === "Pending" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              rejectEncashment(e.id, "Exceeds annual encashment quota");
                              showToast(`Encashment ${e.id} rejected.`);
                            }}
                            className="px-2.5 py-1 text-[11.5px] font-medium text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              approveEncashment(e.id);
                              showToast(`Approved! Added ₹${(e.amount || e.days * 2083).toLocaleString()} to Payroll additional earnings.`);
                            }}
                            className="px-3 py-1 text-[11.5px] font-semibold text-white bg-navy rounded-lg hover:bg-navy/90 transition shadow-2xs cursor-pointer flex items-center gap-1"
                          >
                            <Coins size={12} /> Approve Payout
                          </button>
                        </div>
                      ) : e.status === "Approved" ? (
                        <span className="text-[11.5px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                          <Coins size={12} /> Synced to Payroll (+₹{(e.amount || e.days * 2083).toLocaleString()})
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-rose-700 font-medium">Rejected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal 1: Apply Leave Modal ── */}
      <Modal
        isOpen={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        title="Apply for Leave"
        footer={
          <>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setApplyModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={submitting}
              onClick={submitLeave}
            >
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div className="form-group">
            <div className="flex items-center justify-between">
              <label className="form-label">Applying Employee</label>
              <MasterSourceLink source="employees" />
            </div>
            <select
              className="form-select"
              value={selectedEmployeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value, delegateId: "" })}
            >
              {employees.length === 0 && <option value="">No employees</option>}
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.department} • {emp.designation})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Leave Type</label>
            <select
              className="form-select"
              value={selectedTypeId}
              onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
            >
              {leaveTypes.length === 0 && (
                <option value="">{leaveTypesLoaded ? "No leave types configured" : "Loading leave types…"}</option>
              )}
              {typeOptions}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">From Date</label>
              <input
                type="date"
                className="form-input"
                value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value, to: form.to && form.to < e.target.value ? e.target.value : form.to })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">To Date</label>
              <input
                type="date"
                className="form-input"
                value={form.to}
                min={form.from || undefined}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
              />
            </div>
          </div>

          {isSingleDay && (
            <label className="flex items-center gap-2 text-[12.5px] text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.halfDay}
                onChange={(e) => setForm({ ...form, halfDay: e.target.checked })}
              />
              Half day (0.5 day)
            </label>
          )}

          {form.from && form.to && (
            <div className="text-[12px] text-slate-600">
              Approx. <b>{formatDays(calculatedDays)}</b> working day(s) — the server confirms the count from the working-day calendar.
            </div>
          )}

          {balanceHint}

          <div className="form-group">
            <div className="flex items-center justify-between">
              <label className="form-label">Assign Work Delegate (optional)</label>
              <MasterSourceLink source="employees" />
            </div>
            <select
              className="form-select"
              value={form.delegateId}
              onChange={(e) => setForm({ ...form, delegateId: e.target.value })}
            >
              <option value="">No delegate</option>
              {employees
                .filter((e) => String(e.id) !== String(selectedEmployeeId))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.department})
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Reason for Leave *</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Reason for requested leave..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Handover Details</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Responsibilities assigned to delegate..."
              value={form.handover}
              onChange={(e) => setForm({ ...form, handover: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* ── Cancel / Withdraw Leave Dialog ── */}
      <Modal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={cancelTarget?.status === "Approved" ? "Cancel Approved Leave" : "Withdraw Leave Request"}
        footer={
          <>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setCancelTarget(null)}
            >
              Keep Leave
            </button>
            <button
              type="button"
              disabled={Boolean(busyLeaveId)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl text-[13px] font-semibold transition"
              onClick={handleConfirmCancel}
            >
              Confirm Cancellation
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <p className="text-[13.5px] text-slate-700">
            Cancel the {cancelTarget?.type} for <b>{cancelTarget?.employee}</b> ({cancelTarget?.from} – {cancelTarget?.to})?
            {cancelTarget?.status === "Approved" &&
              " The \"On Leave\" attendance posted for these days is removed and the balance is restored."}
          </p>
          <div className="form-group">
            <label className="form-label">Reason (optional)</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="e.g. Plans changed, returning to work..."
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal 2: Reject Leave Dialog ── */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Leave Request"
        footer={
          <>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setRejectModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={Boolean(busyLeaveId)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl text-[13px] font-semibold transition"
              onClick={handleConfirmReject}
            >
              Confirm Rejection
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <p className="text-[13.5px] text-slate-700">
            Are you sure you want to reject the leave request for <b>{selectedLeaveToReject?.employee}</b>?
          </p>
          <div className="form-group">
            <label className="form-label">Reason for Rejection</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="e.g. Critical sprint deadline, key client demo on these dates..."
              value={rejectReasonInput}
              onChange={(e) => setRejectReasonInput(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal 3: View Handover Details Dialog ── */}
      <Modal
        isOpen={Boolean(detailModalLeave)}
        onClose={() => setDetailModalLeave(null)}
        title="Delegation Handover Brief"
        footer={
          <button
            type="button"
            className="btn-primary"
            onClick={() => setDetailModalLeave(null)}
          >
            Close
          </button>
        }
      >
        {detailModalLeave && (
          <div style={{ display: "grid", gap: 14, fontSize: "13.5px", color: "#334155" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={detailModalLeave.emp} size="md" />
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  {detailModalLeave.emp}
                </h4>
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748b" }}>
                  Period: {detailModalLeave.dates} • Type: {detailModalLeave.type || "Leave"}
                </p>
              </div>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Handover Notes &amp; Assigned Responsibilities
              </span>
              <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "#1e293b", lineHeight: 1.5 }}>
                {detailModalLeave.note}
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Status</span>
              <Badge tone={detailModalLeave.status === "Active" ? "success" : "warning"}>
                {detailModalLeave.status}
              </Badge>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal 4: Request Leave Encashment ── */}
      <Modal
        isOpen={encashModalOpen}
        onClose={() => setEncashModalOpen(false)}
        title="Request Leave Encashment"
        footer={
          <>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setEncashModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (!encashForm.employeeName) return showToast("Please select an employee", "error");
                const daysNum = Number(encashForm.days) || 1;
                const dailyRate = 2083; // Standard rate on ₹50k CTC / 24 working days
                const totalAmt = daysNum * dailyRate;
                requestEncashment({
                  employee: encashForm.employeeName,
                  avatar: null,
                  days: daysNum,
                  ratePerDay: dailyRate,
                  amount: totalAmt,
                  reason: encashForm.reason,
                  processedMonth: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
                });
                showToast(`Encashment requested for ${daysNum} days (₹${totalAmt.toLocaleString()}). Will reflect in Payroll upon approval.`);
                setEncashModalOpen(false);
              }}
            >
              Submit Encashment Request
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div className="form-group">
            <div className="flex items-center justify-between">
              <label className="form-label">Employee</label>
              <MasterSourceLink source="employees" />
            </div>
            <select
              className="form-select"
              value={encashForm.employeeName}
              onChange={(e) => setEncashForm({ ...encashForm, employeeName: e.target.value })}
            >
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.name}>
                  {emp.name} ({emp.department} • {emp.designation})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Unused Days to Encash (Pure Dropdown)</label>
            <select
              className="form-select"
              value={encashForm.days}
              onChange={(e) => setEncashForm({ ...encashForm, days: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => (
                <option key={d} value={d}>
                  {d} Day{d > 1 ? "s" : ""} — ₹{(d * 2083).toLocaleString()} Payout
                </option>
              ))}
            </select>
            <span className="text-[11.5px] text-muted mt-1 block">
              Calculated at standard daily rate: ₹2,083/day (₹50,000 CTC ÷ 24 working days).
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 text-[13px] flex items-center justify-between">
            <div>
              <div className="font-bold text-[14px]">
                ₹{(Number(encashForm.days) * 2083).toLocaleString()} Estimated Payout
              </div>
              <div className="text-[11.5px] text-emerald-700 mt-0.5">
                Automatically added to Payroll additional earnings upon HR approval
              </div>
            </div>
            <Coins size={24} className="text-emerald-600" />
          </div>

          <div className="form-group">
            <label className="form-label">Reason / Justification</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="e.g. Encashing surplus accrued annual leaves..."
              value={encashForm.reason}
              onChange={(e) => setEncashForm({ ...encashForm, reason: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal 5: Claim Comp-Off ── */}
      <Modal
        isOpen={compOffModalOpen}
        onClose={() => setCompOffModalOpen(false)}
        title="Claim Compensatory Off (Comp-Off)"
        footer={
          <>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setCompOffModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (!compOffForm.employeeName) return showToast("Please select an employee", "error");
                if (!compOffForm.reason.trim()) return showToast("Please enter work justification", "error");
                requestCompOff({
                  employee: compOffForm.employeeName,
                  avatar: null,
                  workedDate: compOffForm.workedDate,
                  hoursWorked: Number(compOffForm.hoursWorked),
                  creditDays: Number(compOffForm.creditDays),
                  reason: compOffForm.reason,
                  expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                });
                showToast(`Comp-off claimed for ${compOffForm.creditDays} day(s). Awaiting manager/HR approval.`);
                setCompOffModalOpen(false);
              }}
            >
              Submit Comp-Off Claim
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div className="form-group">
            <div className="flex items-center justify-between">
              <label className="form-label">Employee</label>
              <MasterSourceLink source="employees" />
            </div>
            <select
              className="form-select"
              value={compOffForm.employeeName}
              onChange={(e) => setCompOffForm({ ...compOffForm, employeeName: e.target.value })}
            >
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.name}>
                  {emp.name} ({emp.department} • {emp.designation})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Weekend / Holiday Date Worked</label>
              <input
                type="date"
                className="form-input"
                value={compOffForm.workedDate}
                onChange={(e) => setCompOffForm({ ...compOffForm, workedDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Hours Logged (Pure Dropdown)</label>
              <select
                className="form-select"
                value={compOffForm.hoursWorked}
                onChange={(e) => {
                  const hrs = Number(e.target.value);
                  const cred = hrs >= 8 ? 1 : 0.5;
                  setCompOffForm({ ...compOffForm, hoursWorked: hrs, creditDays: cred });
                }}
              >
                <option value={4}>4 Hours (Half Day Shift)</option>
                <option value={8}>8 Hours (Full Day Shift)</option>
                <option value={10}>10 Hours (Overtime Extended)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Credit Entitlement (Pure Dropdown)</label>
            <select
              className="form-select"
              value={compOffForm.creditDays}
              onChange={(e) => setCompOffForm({ ...compOffForm, creditDays: Number(e.target.value) })}
            >
              <option value={0.5}>0.5 Comp-Off Day (Half Day)</option>
              <option value={1}>1.0 Comp-Off Day (Full Day)</option>
              <option value={1.5}>1.5 Comp-Off Days</option>
              <option value={2}>2.0 Comp-Off Days (Weekend Sprint)</option>
            </select>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-[12px] flex items-start gap-2">
            <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Validity:</span> Approved comp-off credits must be availed within 60 days of approval. Once approved, credits are added directly to your Comp-Off leave balance.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Project / Work Done *</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="e.g. Critical cloud infrastructure maintenance and client emergency release..."
              value={compOffForm.reason}
              onChange={(e) => setCompOffForm({ ...compOffForm, reason: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

