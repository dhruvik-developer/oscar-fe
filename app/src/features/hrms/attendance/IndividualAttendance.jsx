import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Lock, RefreshCw } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import Modal from "../../../components/ui/Modal";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { Avatar } from "../../../components/hrms/Avatar";
import {
  pullMonthlyAttendance,
  saveAttendanceDay,
  clearAttendanceDay,
  localISODate,
  formatClock12,
  formatHours,
  describeError,
} from "../../../services/hrmsSync";

const EDIT_STATUSES = ["Present", "Late", "Half Day", "WFH", "Absent", "On Leave"];
const TIMED_STATUSES = ["Present", "Late", "Half Day", "WFH"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const statusStyles = {
  Present: { background: "#e6f4ea", color: "#15803d", borderColor: "#a7f3d0" },
  Late: { background: "#fef3c7", color: "#b45309", borderColor: "#fde68a" },
  Absent: { background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5" },
  WFH: { background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd" },
  "On Leave": { background: "#eff6ff", color: "#2563eb", borderColor: "#bfdbfe" },
  "Half Day": { background: "#f3e8ff", color: "#7e22ce", borderColor: "#d8b4fe" },
  "Not Marked": { background: "#fff7ed", color: "#c2410c", borderColor: "#fdba74", borderStyle: "dashed" },
  Holiday: { background: "#ecfdf5", color: "#047857", borderColor: "#6ee7b7" },
  "Week Off": { background: "#f1f5f9", color: "#64748b", borderColor: "#e2e8f0" },
  Upcoming: { background: "#ffffff", color: "#94a3b8", borderColor: "#e2e8f0" },
  "Not Joined": { background: "#f8fafc", color: "#94a3b8", borderColor: "#e2e8f0", borderStyle: "dashed" },
};

/** An ISO instant → local `HH:MM` for an `<input type="time">`. */
function isoToTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDay(iso) {
  return iso ? iso.split("-").reverse().join("/") : "";
}

function monthLabel(month) {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function IndividualAttendance() {
  const showToast = useAppStore((s) => s.showToast || s.setToast);
  const storeEmployees = useAppStore((s) => s.employees || []);
  const [searchParams, setSearchParams] = useSearchParams();

  const employeesList = useMemo(
    () =>
      storeEmployees
        .filter((e) => e.id)
        .map((e) => ({
          id: e.id,
          name: e.name,
          code: e.employeeCode || e.empId || "",
          designation: e.designation || e.role || "",
          department: e.department || "",
          status: e.status || "",
        }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [storeEmployees]
  );

  const paramEmployee = searchParams.get("employeeId") || "";
  const paramMonth = searchParams.get("month") || "";
  const [selectedEmpId, setSelectedEmpId] = useState(paramEmployee);
  const [month, setMonth] = useState(() => (/^\d{4}-\d{2}$/.test(paramMonth) ? paramMonth : localISODate().slice(0, 7)));
  const [viewMode, setViewMode] = useState("Table");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requestRef = useRef(0);

  const [editDay, setEditDay] = useState(null);
  const [editForm, setEditForm] = useState({ status: "Present", checkIn: "", checkOut: "", remark: "" });
  const [saving, setSaving] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Follow ?employeeId= when it changes (e.g. "View month" from the overview).
  useEffect(() => {
    if (paramEmployee) setSelectedEmpId(paramEmployee);
  }, [paramEmployee]);

  // No employee picked → default to the first in the directory.
  useEffect(() => {
    if (!selectedEmpId && employeesList.length > 0) setSelectedEmpId(employeesList[0].id);
  }, [selectedEmpId, employeesList]);

  const load = useCallback(async () => {
    if (!selectedEmpId || !month) return;
    const ticket = ++requestRef.current;
    setLoading(true);
    setLoadError(false);
    const res = await pullMonthlyAttendance(selectedEmpId, month);
    if (ticket !== requestRef.current) return;
    if (res) setData(res);
    else {
      setData(null);
      setLoadError(true);
    }
    setLoading(false);
  }, [selectedEmpId, month]);

  useEffect(() => {
    load();
  }, [load]);

  function selectEmployee(id) {
    setSelectedEmpId(id);
    const next = new URLSearchParams(searchParams);
    if (id) next.set("employeeId", id);
    else next.delete("employeeId");
    next.set("month", month);
    setSearchParams(next, { replace: true });
  }

  function selectMonth(value) {
    if (!value) return;
    setMonth(value);
    const next = new URLSearchParams(searchParams);
    next.set("month", value);
    if (selectedEmpId) next.set("employeeId", selectedEmpId);
    setSearchParams(next, { replace: true });
  }

  const today = localISODate();
  const directoryEmp = employeesList.find((e) => e.id === selectedEmpId);
  const emp = data?.employee
    ? {
        name: data.employee.name,
        code: data.employee.employeeCode,
        department: data.employee.department,
        designation: data.employee.designation,
        shift: data.employee.shift,
        location: data.employee.location,
        status: data.employee.employeeStatus,
        employmentType: data.employee.employmentType,
        email: data.employee.email,
      }
    : directoryEmp || null;

  const days = useMemo(() => data?.days || [], [data]);
  const summary = data?.summary || {};

  const statCards = [
    { label: "Present", val: summary.present ?? 0 },
    { label: "Late", val: summary.late ?? 0 },
    { label: "Half Day", val: summary.halfDay ?? 0 },
    { label: "WFH", val: summary.wfh ?? 0 },
    { label: "Absent", val: summary.absent ?? 0 },
    { label: "Paid Leave", val: summary.paidLeave ?? 0 },
    { label: "Unpaid Leave (LOP)", val: summary.unpaidLeave ?? 0 },
    { label: "Not Marked", val: summary.notMarked ?? 0 },
    { label: "Working Days", val: summary.workingDays ?? 0 },
    { label: "Total Hours", val: formatHours(summary.totalHours || 0) },
    { label: "Overtime", val: formatHours(summary.overtimeHours || 0) },
  ];

  // Leading blanks so the 1st lands under its weekday (Mon-first grid).
  const leadingBlanks = useMemo(() => {
    if (!days.length) return 0;
    const first = new Date(`${days[0].date}T00:00:00`);
    return (first.getDay() + 6) % 7;
  }, [days]);

  function lockReason(day) {
    if (!day) return "";
    if (day.leaveType) return `On leave: ${day.leaveType}${day.leavePaid === false ? " (unpaid)" : ""}`;
    if (day.date > today || day.status === "Upcoming") return "Future day — cannot be marked yet";
    if (day.status === "Not Joined") return "Before the employee's joining date";
    return "";
  }

  function openEdit(day) {
    const marked = EDIT_STATUSES.includes(day.status);
    setEditDay(day);
    setEditForm({
      status: marked ? day.status : "Present",
      checkIn: isoToTime(day.checkIn),
      checkOut: isoToTime(day.checkOut),
      remark: day.remark || "",
    });
  }

  function changeEditStatus(status) {
    setEditForm((f) => (TIMED_STATUSES.includes(status) ? { ...f, status } : { ...f, status, checkIn: "", checkOut: "" }));
  }

  async function handleEditSave() {
    if (!editDay || lockReason(editDay)) return;
    const timed = TIMED_STATUSES.includes(editForm.status);
    if (["Present", "Late"].includes(editForm.status) && !editForm.checkIn) {
      showToast("Enter a check-in time.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await saveAttendanceDay(editDay.date, [
        {
          employeeId: selectedEmpId,
          date: editDay.date,
          status: editForm.status,
          checkIn: timed ? editForm.checkIn : "",
          checkOut: timed ? editForm.checkOut : "",
          remark: editForm.remark,
        },
      ]);
      if (!res) throw new Error("The server is not reachable");
      const skipped = res.skipped || [];
      if (skipped.length) showToast(`Not saved — ${skipped.map((s) => s.reason).join(", ")}`, "error");
      else showToast(`Attendance for ${formatDay(editDay.date)} saved.`);
      setEditDay(null);
      await load();
      useAttendanceStore.getState().refreshAttendance?.();
    } catch (err) {
      showToast(`Attendance not saved — ${describeError(err)}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearDay() {
    if (!editDay) return;
    setSaving(true);
    try {
      const res = await clearAttendanceDay(editDay.date, [selectedEmpId]);
      if (!res) throw new Error("The server is not reachable");
      showToast(res.cleared ? `Marking for ${formatDay(editDay.date)} cleared.` : "Nothing to clear for this day.");
      setEditDay(null);
      await load();
      useAttendanceStore.getState().refreshAttendance?.();
    } catch (err) {
      showToast(`Marking not cleared — ${describeError(err)}`, "error");
    } finally {
      setSaving(false);
    }
  }

  const editLock = lockReason(editDay);
  const editTimed = TIMED_STATUSES.includes(editForm.status);

  return (
    <div className="ind-att-page">
      <PageHeader
        title="Individual Attendance"
        subtitle="View and manage per-employee attendance history."
        guide={hrmsGuides.attendanceIndividual}
      />

      {/* Filter Bar */}
      <div className="ind-card ind-filter-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select
            value={selectedEmpId}
            onChange={(e) => selectEmployee(e.target.value)}
            className="ind-select ind-select-emp"
            aria-label="Employee"
          >
            <option value="">Select employee…</option>
            {selectedEmpId && !directoryEmp && data?.employee && (
              <option value={selectedEmpId}>
                {data.employee.name}
                {data.employee.employeeCode ? ` (${data.employee.employeeCode})` : ""}
              </option>
            )}
            {employeesList.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.code ? ` (${e.code})` : ""}
              </option>
            ))}
          </select>

          <input
            type="month"
            value={month}
            onChange={(e) => selectMonth(e.target.value)}
            className="ind-month"
            aria-label="Month"
          />

          <button type="button" className="ind-btn-icon" onClick={load} title="Reload" aria-label="Reload">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="ind-tabs">
          <button type="button" onClick={() => setViewMode("Table")} className={viewMode === "Table" ? "ind-tab active" : "ind-tab"}>
            Table View
          </button>
          <button type="button" onClick={() => setViewMode("Calendar")} className={viewMode === "Calendar" ? "ind-tab active" : "ind-tab"}>
            Calendar View
          </button>
        </div>
      </div>

      {/* Hero Employee Card */}
      {emp ? (
        <div className="ind-card ind-hero-card">
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <Avatar name={emp.name} size="lg" />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" }}>{emp.name}</h3>
                {emp.code && <span style={{ fontSize: "12.5px", color: "#6b7280" }}>{emp.code}</span>}
                {emp.status && <span className="ind-status-pill">{emp.status}</span>}
              </div>
              <div style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
                {[emp.designation, emp.department, emp.shift ? `Shift: ${emp.shift}` : ""].filter(Boolean).join(" • ") || "—"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{monthLabel(month)}</span>
            <button type="button" onClick={() => setShowProfileModal(true)} className="ind-btn-view-emp">
              View Employee
            </button>
          </div>
        </div>
      ) : (
        <div className="ind-card ind-empty">
          {employeesList.length === 0 ? "No employees found. Add employees to view individual attendance." : "Select an employee to view their month."}
        </div>
      )}

      {/* Stats Cards */}
      {selectedEmpId && (
        <>
          <div className="ind-stats-grid">
            {statCards.map((c) => (
              <div key={c.label} className="ind-stat-card">
                <span className="ind-stat-label">{c.label}</span>
                <span className="ind-stat-val">{loading && !data ? "…" : c.val}</span>
              </div>
            ))}
          </div>
          <div className="ind-note">
            Payroll pays attended + paid leave days; absences, unmarked working days and unpaid leave are deducted.
          </div>
        </>
      )}

      {/* Table or Calendar View */}
      {selectedEmpId && loadError ? (
        <div className="ind-card ind-empty">
          <AlertTriangle size={20} style={{ color: "#dc2626" }} />
          <div>Could not load attendance for {monthLabel(month)}.</div>
          <button type="button" className="ind-btn-edit" onClick={load}>
            Retry
          </button>
        </div>
      ) : selectedEmpId && viewMode === "Table" ? (
        <div className="ind-card ind-main-card">
          <div style={{ overflowX: "auto" }}>
            <table className="ind-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>DAY</th>
                  <th>CHECK IN</th>
                  <th>CHECK OUT</th>
                  <th>WORK HOURS</th>
                  <th>STATUS</th>
                  <th>LEAVE TYPE</th>
                  <th>SOURCE</th>
                  <th>REMARKS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading && days.length === 0 && (
                  <tr>
                    <td colSpan={10} className="ind-empty-cell">
                      Loading month…
                    </td>
                  </tr>
                )}
                {days.map((d) => {
                  const locked = lockReason(d);
                  return (
                    <tr key={d.date} className={d.isWorkingDay ? "" : "ind-row-off"}>
                      <td className="ind-date">{formatDay(d.date)}</td>
                      <td style={{ color: "#374151" }}>{d.weekday}</td>
                      <td className="ind-time">{formatClock12(d.checkIn) || "—"}</td>
                      <td className="ind-time">{formatClock12(d.checkOut) || "—"}</td>
                      <td className="ind-time">
                        {formatHours(d.hours)}
                        {d.overtimeHours > 0 && <div className="ind-sub-text">+{formatHours(d.overtimeHours)} OT</div>}
                      </td>
                      <td>
                        <span className="ind-status" style={statusStyles[d.status] || statusStyles["Not Marked"]}>
                          {d.status}
                        </span>
                        {d.holiday && <div className="ind-sub-text">{typeof d.holiday === "string" ? d.holiday : d.holiday.name}</div>}
                      </td>
                      <td style={{ color: "#374151", whiteSpace: "nowrap" }}>
                        {d.leaveType ? `${d.leaveType}${d.leavePaid === false ? " (unpaid)" : ""}` : "—"}
                      </td>
                      <td style={{ color: "#6b7280", textTransform: "capitalize" }}>{d.source || "—"}</td>
                      <td className="ind-remark" title={d.remark || ""}>
                        {d.remark || "—"}
                      </td>
                      <td>
                        {locked ? (
                          <span title={locked} style={{ color: "#94a3b8", display: "inline-flex" }}>
                            <Lock size={14} />
                          </span>
                        ) : (
                          <button type="button" onClick={() => openEdit(d)} className="ind-btn-edit">
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && days.length === 0 && (
                  <tr>
                    <td colSpan={10} className="ind-empty-cell">
                      No attendance days for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedEmpId ? (
        <div className="ind-card" style={{ padding: "16px" }}>
          <div className="ind-cal-grid">
            {WEEKDAYS.map((d) => (
              <div key={d} className="ind-cal-header">
                {d}
              </div>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map((d) => {
              const locked = lockReason(d);
              const style = statusStyles[d.status] || statusStyles["Not Marked"];
              return (
                <button
                  type="button"
                  key={d.date}
                  className="ind-cal-cell"
                  style={{ background: style.background, borderColor: style.borderColor, cursor: locked ? "default" : "pointer", outline: d.date === today ? "2px solid #16233a" : "none" }}
                  onClick={() => !locked && openEdit(d)}
                  title={locked || `${d.status}${d.checkIn ? ` • ${formatClock12(d.checkIn)}–${formatClock12(d.checkOut) || "…"}` : ""}`}
                >
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>{Number(d.date.slice(8))}</span>
                  <span className="ind-cal-status" style={{ color: style.color }}>
                    {d.status}
                  </span>
                  {d.hours != null && <span className="ind-cal-hours">{formatHours(d.hours)}</span>}
                </button>
              );
            })}
          </div>
          {loading && days.length === 0 && <div className="ind-empty-cell">Loading month…</div>}
        </div>
      ) : null}

      {/* Edit Day Modal */}
      <Modal
        isOpen={Boolean(editDay)}
        onClose={() => setEditDay(null)}
        title={`Edit Attendance — ${formatDay(editDay?.date)}`}
        subtitle={emp ? `${emp.name}${editDay?.weekday ? ` • ${editDay.weekday}` : ""}` : ""}
        footer={
          <>
            {editDay?.attendanceId && !editLock && (
              <button type="button" className="btn-outline" disabled={saving} onClick={handleClearDay} style={{ marginRight: "auto" }}>
                Clear marking
              </button>
            )}
            <button type="button" className="btn-outline" onClick={() => setEditDay(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={saving || Boolean(editLock)} onClick={handleEditSave}>
              {saving ? "Saving…" : "Save Record"}
            </button>
          </>
        }
      >
        {editDay && (
          <div style={{ display: "grid", gap: 16 }}>
            {editLock ? (
              <div className="ind-lock-note">{editLock}</div>
            ) : (
              <>
                {!editDay.isWorkingDay && (
                  <div className="ind-sub-text" style={{ whiteSpace: "normal" }}>
                    This is a {editDay.holiday ? "holiday" : "week off"} — mark only if the employee worked.
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={editForm.status} onChange={(e) => changeEditStatus(e.target.value)}>
                      {EDIT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Remarks</label>
                    <input
                      className="form-input"
                      value={editForm.remark}
                      onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })}
                      placeholder="Optional note"
                    />
                  </div>
                </div>
                {editTimed && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Check In Time</label>
                      <input type="time" className="form-input" value={editForm.checkIn} onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Check Out Time</label>
                      <input type="time" className="form-input" value={editForm.checkOut} onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })} />
                    </div>
                  </div>
                )}
                <div className="ind-sub-text" style={{ whiteSpace: "normal" }}>
                  Hours, and Late vs Present, are worked out by the server from the flexibility policy.
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* View Employee Profile Modal */}
      <Modal
        isOpen={showProfileModal && Boolean(emp)}
        onClose={() => setShowProfileModal(false)}
        title={`Employee Profile — ${emp?.name || ""}`}
        footer={
          <button type="button" className="btn-primary" onClick={() => setShowProfileModal(false)}>
            Close
          </button>
        }
      >
        {emp && (
          <>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
              <Avatar name={emp.name} size="xl" />
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{emp.name}</h3>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>
                  {[emp.code, emp.designation].filter(Boolean).join(" • ")}
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 10, fontSize: 13.5, color: "#334155" }}>
              <div><strong>Department:</strong> {emp.department || "—"}</div>
              <div><strong>Shift:</strong> {emp.shift || "—"}</div>
              <div><strong>Employment Type:</strong> {emp.employmentType || "—"}</div>
              <div><strong>Employment Status:</strong> {emp.status || "—"}</div>
              <div><strong>Work Location:</strong> {emp.location || "—"}</div>
              {emp.email && <div><strong>Email:</strong> {emp.email}</div>}
            </div>
          </>
        )}
      </Modal>

      <style>{`
        .ind-att-page { background: #f8fafc; margin: -24px -28px -40px; padding: 18px 26px 28px; min-height: calc(100vh - 62px); }

        .ind-card { background: #fff; border: 1px solid #e8edf3; border-radius: 16px; box-shadow: 0 1px 3px rgba(16,24,40,0.03); }
        .ind-filter-card { border: none; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .ind-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px 16px; text-align: center; color: #6b7280; font-size: 13.5px; margin-bottom: 16px; }

        .ind-select { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 32px 7px 14px; font-size: 13px; color: #374151; font-weight: 500; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230f172a' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 12px; min-width: 100px; max-width: 100%; }
        .ind-select:focus { border-color: #94a3b8; background-color: #fff; }
        .ind-select-emp { min-width: 230px; }
        .ind-month { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px 12px; font-size: 13px; color: #374151; outline: none; }
        .ind-btn-icon { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; color: #475569; cursor: pointer; display: grid; place-items: center; }

        .ind-tabs { display: inline-flex; align-items: center; gap: 3px; background: #f4f4f6; border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 4px; }
        .ind-tab { border: 1.5px solid transparent; border-radius: 999px; padding: 4px 16px; font-size: 13px; font-weight: 500; color: #8e9baa; background: transparent; cursor: pointer; transition: all 0.15s ease; }
        .ind-tab.active { font-weight: 600; color: #000000; background: #ffffff; border-color: #000000; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }

        .ind-hero-card { padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .ind-status-pill { display: inline-block; font-size: 11px; font-weight: 600; color: #15803d; background: #e6f4ea; border: 1px solid #a7f3d0; border-radius: 999px; padding: 2px 9px; }
        .ind-btn-view-emp { background: #fff; border: 1px solid #d1d5db; border-radius: 10px; padding: 7px 16px; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; transition: background 0.15s ease; }
        .ind-btn-view-emp:hover { background: #f9fafb; }

        .ind-stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-bottom: 8px; }
        .ind-stat-card { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; padding: 14px 12px; text-align: center; box-shadow: 0 1px 2px rgba(16,24,40,0.03); min-width: 0; }
        .ind-stat-label { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; color: #6b7280; text-transform: uppercase; }
        .ind-stat-val { display: block; font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.02em; margin-top: 6px; white-space: nowrap; }
        .ind-note { font-size: 12px; color: #64748b; margin-bottom: 16px; }

        .ind-main-card { overflow: hidden; }
        .ind-table { width: 100%; border-collapse: collapse; min-width: 980px; font-size: 13.5px; }
        .ind-table thead tr { background: #ffffff; border-bottom: 1px solid #e2e8f0; }
        .ind-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7b8aa0; padding: 14px 16px; white-space: nowrap; }
        .ind-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s ease; }
        .ind-table tbody tr:hover { background: #f8fafc; }
        .ind-table tbody tr.ind-row-off { background: #fafafa; }
        .ind-table td { padding: 11px 16px; vertical-align: middle; }
        .ind-empty-cell { text-align: center; color: #6b7280; padding: 32px !important; }

        .ind-date { font-weight: 600; color: #111827; white-space: nowrap; }
        .ind-time { font-family: inherit; font-size: 13px; color: #374151; white-space: nowrap; }
        .ind-status { display: inline-block; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 3px 12px; border: 1px solid; white-space: nowrap; }
        .ind-sub-text { font-size: 11.5px; color: #6b7280; margin-top: 2px; white-space: nowrap; }
        .ind-remark { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #6b7280; }
        .ind-lock-note { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; border-radius: 10px; padding: 12px; font-size: 13px; }

        .ind-btn-edit { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px 12px; font-size: 12px; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s ease; }
        .ind-btn-edit:hover { background: #f8fafc; color: #111827; border-color: #cbd5e1; }

        .ind-cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
        .ind-cal-header { text-align: center; font-size: 12px; font-weight: 700; color: #6b7280; padding: 6px 0; }
        .ind-cal-cell { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px; min-height: 76px; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; font-family: inherit; min-width: 0; outline-offset: 1px; }
        .ind-cal-status { font-size: 11px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
        .ind-cal-hours { font-size: 10.5px; color: #64748b; }

        @media (max-width: 1023px) {
          .ind-att-page { margin: -16px -20px -24px; }
        }
        @media (max-width: 767px) {
          .ind-att-page { margin: -12px -14px -20px; }
        }
        @media (max-width: 640px) {
          .ind-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ind-att-page { padding: 14px 14px 22px; }
          .ind-filter-card, .ind-hero-card { padding: 12px 14px; }
          .ind-select-emp { min-width: 0; flex: 1 1 100%; }
          .ind-tabs { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
          .ind-tab { flex-shrink: 0; white-space: nowrap; }
          .ind-cal-grid { gap: 3px; }
          .ind-cal-cell { min-height: 52px; padding: 4px; }
          .ind-cal-status { font-size: 9px; }
          .ind-cal-hours { display: none; }
        }
      `}</style>
    </div>
  );
}
