import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Download, ChevronDown, Search, Calendar as CalendarIcon, Pencil, CalendarDays, RefreshCw, AlertTriangle, Info } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import Modal from "../../../components/ui/Modal";
import { useAppStore } from "../../../stores/appStore";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { Avatar } from "../../../components/hrms/Avatar";
import MasterSourceLink from "../../../components/common/MasterSourceLink";
import {
  pullDailyAttendance,
  saveAttendanceDay,
  clearAttendanceDay,
  formatClock12,
  formatHours,
  localISODate,
  describeError,
} from "../../../services/hrmsSync";

const STATUS_FILTERS = ["All", "Present", "Late", "Half Day", "WFH", "Absent", "On Leave", "Not Marked", "Holiday", "Week Off"];
const EDIT_STATUSES = ["Present", "Late", "Half Day", "WFH", "Absent", "On Leave"];
const TIMED_STATUSES = ["Present", "Late", "Half Day", "WFH"];

const statusStyles = {
  Present: { background: "#e6f4ea", color: "#15803d", borderColor: "#a7f3d0" },
  Late: { background: "#fef3c7", color: "#b45309", borderColor: "#fde68a" },
  Absent: { background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5" },
  WFH: { background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd" },
  "Half Day": { background: "#f3e8ff", color: "#7e22ce", borderColor: "#d8b4fe" },
  "On Leave": { background: "#eff6ff", color: "#2563eb", borderColor: "#bfdbfe" },
  "Not Marked": { background: "#f8fafc", color: "#64748b", borderColor: "#cbd5e1", borderStyle: "dashed" },
  Holiday: { background: "#ecfdf5", color: "#047857", borderColor: "#6ee7b7" },
  "Week Off": { background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" },
};

/** An ISO instant → local `HH:MM` for an `<input type="time">`. */
function isoToTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function uniqueValues(rows, key) {
  return Array.from(new Set(rows.map((r) => r[key]).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
}

function holidayName(holiday) {
  if (!holiday) return "";
  if (typeof holiday === "string") return holiday;
  return holiday.name || holiday.title || "Holiday";
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className={`att-filter-dropdown ${value !== "All" ? "active" : ""}`}>
      <span className="att-filter-text">{value === "All" ? label : value}</span>
      <ChevronDown size={13} className="att-filter-arrow" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="att-filter-native-select"
        aria-label={`${label} Filter`}
      >
        <option value="All">All {label === "Status" ? "statuses" : label.toLowerCase() + "s"}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AttendanceOverview() {
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast || s.setToast);
  const storeEmployees = useAppStore((s) => s.employees || []);
  const addAttendanceRequest = useAttendanceStore((s) => s.addRequest);

  const [dateVal, setDateVal] = useState(() => localISODate());
  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const requestRef = useRef(0);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [shiftFilter, setShiftFilter] = useState("All");
  const [locFilter, setLocFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({ status: "Present", checkIn: "", checkOut: "", remark: "" });
  const [saving, setSaving] = useState(false);

  const [showRegModal, setShowRegModal] = useState(false);
  const [regEmp, setRegEmp] = useState("");
  const [regDate, setRegDate] = useState(() => localISODate());
  const [regReason, setRegReason] = useState("");
  const [regIn, setRegIn] = useState("09:30");
  const [regOut, setRegOut] = useState("18:30");
  const [regSaving, setRegSaving] = useState(false);

  const load = useCallback(async () => {
    const ticket = ++requestRef.current;
    setLoading(true);
    setLoadError(false);
    const res = await pullDailyAttendance(dateVal);
    if (ticket !== requestRef.current) return;
    if (res) setDaily(res);
    else {
      setDaily(null);
      setLoadError(true);
    }
    setLoading(false);
  }, [dateVal]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => daily?.results || [], [daily]);
  const summary = useMemo(() => daily?.summary || {}, [daily]);
  const shiftStart = daily?.shiftStart || "09:30";
  const shiftEnd = daily?.shiftEnd || "18:30";

  const deptOptions = useMemo(() => uniqueValues(rows, "department"), [rows]);
  const shiftOptions = useMemo(() => uniqueValues(rows, "shift"), [rows]);
  const locOptions = useMemo(() => uniqueValues(rows, "location"), [rows]);
  const typeOptions = useMemo(() => uniqueValues(rows, "employmentType"), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((item) => {
      const matchSearch =
        !q ||
        String(item.name ?? "").toLowerCase().includes(q) ||
        String(item.employeeCode ?? "").toLowerCase().includes(q);
      const matchDept = deptFilter === "All" || item.department === deptFilter;
      const matchStatus = statusFilter === "All" || item.status === statusFilter;
      const matchShift = shiftFilter === "All" || item.shift === shiftFilter;
      const matchLoc = locFilter === "All" || item.location === locFilter;
      const matchType = typeFilter === "All" || item.employmentType === typeFilter;
      return matchSearch && matchDept && matchStatus && matchShift && matchLoc && matchType;
    });
  }, [rows, search, deptFilter, statusFilter, shiftFilter, locFilter, typeFilter]);

  const statsData = useMemo(() => {
    const total = summary.total || 0;
    const pct = summary.attendancePct ?? 0;
    return [
      { label: "PRESENT", val: summary.present ?? 0, sub: total ? `${pct}% attendance${summary.halfDay ? ` • ${summary.halfDay} half day` : ""}` : "No employees", dotColor: "#22c55e" },
      { label: "ABSENT", val: summary.absent ?? 0, sub: "Marked absent", dotColor: "#ef4444" },
      { label: "LATE", val: summary.late ?? 0, sub: daily ? `Grace ${daily.graceMinutes ?? 0} min` : "—", dotColor: "#f59e0b" },
      { label: "ON LEAVE", val: summary.onLeave ?? 0, sub: "Approved leave", dotColor: "#3b82f6" },
      { label: "WFH", val: summary.wfh ?? 0, sub: "Remote", dotColor: "#0ea5e9" },
      { label: "NOT MARKED", val: summary.notMarked ?? 0, sub: total ? `of ${total} employees` : "—", dotColor: "#94a3b8" },
      { label: "OVERTIME", val: formatHours(summary.overtimeHours || 0), sub: "This day", dotColor: "#8b5cf6" },
    ];
  }, [summary, daily]);

  const regEmployees = useMemo(() => {
    if (rows.length > 0) {
      return rows.map((r) => ({ id: r.employeeId, name: r.name, code: r.employeeCode }));
    }
    return storeEmployees
      .filter((e) => e.id)
      .map((e) => ({ id: e.id, name: e.name, code: e.employeeCode || e.empId }));
  }, [rows, storeEmployees]);

  const handleClearFilters = () => {
    setSearch("");
    setDeptFilter("All");
    setStatusFilter("All");
    setShiftFilter("All");
    setLocFilter("All");
    setTypeFilter("All");
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      showToast("Nothing to export for the current filters.");
      return;
    }
    const header = ["Employee ID", "Name", "Department", "Designation", "Date", "Check In", "Check Out", "Work Hours", "Overtime", "Shift", "Status", "Leave Type", "Source", "Remark"];
    const lines = filtered.map((r) =>
      [
        r.employeeCode,
        r.name,
        r.department,
        r.designation,
        dateVal,
        formatClock12(r.checkIn),
        formatClock12(r.checkOut),
        r.hours == null ? "" : formatHours(r.hours),
        r.overtimeHours ? formatHours(r.overtimeHours) : "",
        r.shift,
        r.status,
        r.leaveType || "",
        r.source || "",
        r.remark || "",
      ].map(csvCell).join(",")
    );
    const blob = new Blob([[header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${dateVal}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEdit = (row) => {
    const marked = EDIT_STATUSES.includes(row.status);
    setEditRow(row);
    setEditForm({
      status: marked ? row.status : "Present",
      checkIn: isoToTime(row.checkIn) || (marked ? "" : shiftStart),
      checkOut: isoToTime(row.checkOut) || (marked ? "" : shiftEnd),
      remark: row.remark || "",
    });
  };

  const handleEditStatus = (status) => {
    setEditForm((f) => {
      if (!TIMED_STATUSES.includes(status)) return { ...f, status, checkIn: "", checkOut: "" };
      if (status !== "Half Day" && !f.checkIn && !f.checkOut) {
        return { ...f, status, checkIn: shiftStart, checkOut: shiftEnd };
      }
      return { ...f, status };
    });
  };

  const reportSkipped = (res) => {
    const skipped = res?.skipped || [];
    if (skipped.length > 0) {
      showToast(`Not saved for ${skipped.map((s) => `${s.name || "employee"} (${s.reason})`).join(", ")}`, "error");
      return true;
    }
    return false;
  };

  const handleEditSave = async () => {
    if (!editRow) return;
    const timed = TIMED_STATUSES.includes(editForm.status);
    setSaving(true);
    try {
      const res = await saveAttendanceDay(dateVal, [
        {
          employeeId: editRow.employeeId,
          status: editForm.status,
          checkIn: timed ? editForm.checkIn : "",
          checkOut: timed ? editForm.checkOut : "",
          remark: editForm.remark,
        },
      ]);
      if (!res) {
        showToast("Attendance not saved — the server is not reachable.", "error");
        return;
      }
      if (!reportSkipped(res)) showToast(`${editRow.name}'s attendance saved for ${dateVal}.`);
      setEditRow(null);
      load();
      useAttendanceStore.getState().refreshAttendance?.();
    } catch (err) {
      showToast(`Attendance not saved — ${describeError(err)}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleClearMarking = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      const res = await clearAttendanceDay(dateVal, [editRow.employeeId]);
      showToast(res?.cleared ? `Marking cleared for ${editRow.name}.` : "Nothing to clear for this day.");
      setEditRow(null);
      load();
      useAttendanceStore.getState().refreshAttendance?.();
    } catch (err) {
      showToast(`Marking not cleared — ${describeError(err)}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const openRegularize = () => {
    setRegDate(dateVal);
    setRegIn(shiftStart);
    setRegOut(shiftEnd);
    setShowRegModal(true);
  };

  const handleRegularizeSubmit = async () => {
    if (!regEmp) return showToast("Please select an employee for regularization.", "error");
    if (!regDate) return showToast("Please choose the date to regularize.", "error");
    if (!regReason.trim()) return showToast("Please provide a reason for regularization.", "error");
    setRegSaving(true);
    try {
      // The store's addRequest posts to the API and re-reads the request queue.
      const created = await addAttendanceRequest({
        employeeId: regEmp,
        date: regDate,
        requestedCheckIn: regIn,
        requestedCheckOut: regOut,
        requestedStatus: "Present",
        reason: regReason.trim(),
      });
      if (!created) {
        showToast("Request not sent — the server is not reachable.", "error");
        return;
      }
      const emp = regEmployees.find((e) => e.id === regEmp);
      showToast(`Regularization request for ${emp?.name || "employee"} submitted for approval.`);
      setShowRegModal(false);
      setRegReason("");
      setRegEmp("");
    } catch (err) {
      showToast(`Request not sent — ${describeError(err)}`, "error");
    } finally {
      setRegSaving(false);
    }
  };

  const editLocked = Boolean(editRow?.leaveType);
  const editTimed = TIMED_STATUSES.includes(editForm.status);

  return (
    <div className="att-mgmt-page">
      <PageHeader
        title="Attendance Management"
        subtitle="Daily tracking, attendance status, regularization, shifts and overtime."
        guide={hrmsGuides.attendanceOverview}
        actions={
          <>
            <button type="button" onClick={handleExport} className="att-export-btn">
              <Download size={15} /> Export
            </button>
            <button type="button" onClick={openRegularize} className="att-reg-btn">
              Regularize Attendance
            </button>
          </>
        }
      />

      {daily && daily.isWorkingDay === false && (
        <div className="att-banner">
          <Info size={16} />
          <span>
            {daily.holiday
              ? <><b>{holidayName(daily.holiday)}</b> — public holiday. Attendance is optional for this day.</>
              : <><b>Week off</b> — {dateVal} is not a working day.</>}
          </span>
        </div>
      )}

      {/* Stat Cards Row */}
      <div className="att-stats-grid">
        {statsData.map((s) => (
          <div key={s.label} className="att-stat-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="att-stat-label">{s.label}</span>
              {s.dotColor && <span className="att-stat-dot" style={{ backgroundColor: s.dotColor }} />}
            </div>
            <div className="att-stat-val">{loading && !daily ? "…" : s.val}</div>
            <div className="att-stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar Card */}
      <div className="att-card att-filter-card">
        <div className="att-filter-left">
          <div className="att-search-wrap">
            <Search size={15} style={{ color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="att-search-input"
            />
          </div>

          <div className="att-date-wrap">
            <span>{dateVal.split("-").reverse().join("-")}</span>
            <CalendarIcon size={14} style={{ color: "#64748b" }} />
            <input
              type="date"
              value={dateVal}
              onChange={(e) => e.target.value && setDateVal(e.target.value)}
              className="att-date-native"
              aria-label="Attendance date"
            />
          </div>

          <FilterSelect label="Department" value={deptFilter} onChange={setDeptFilter} options={deptOptions} />
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTERS.slice(1)} />
          <FilterSelect label="Shift" value={shiftFilter} onChange={setShiftFilter} options={shiftOptions} />
          <FilterSelect label="Location" value={locFilter} onChange={setLocFilter} options={locOptions} />
          <FilterSelect label="Job Type" value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
        </div>

        <div className="att-filter-right">
          <button type="button" onClick={() => setDateVal(localISODate())} className="att-btn-outline">
            Today
          </button>
          <button type="button" onClick={handleClearFilters} className="att-btn-outline">
            Clear Filters
          </button>
          <button type="button" onClick={load} className="att-btn-outline" title="Reload" aria-label="Reload">
            <RefreshCw size={14} className={loading ? "att-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="att-card att-main-card">
        {loadError ? (
          <div className="att-empty">
            <AlertTriangle size={20} style={{ color: "#dc2626" }} />
            <div>Could not load attendance for {dateVal}.</div>
            <button type="button" className="att-btn-outline" onClick={load}>
              Retry
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="att-table">
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>EMPLOYEE ID</th>
                  <th>DEPARTMENT</th>
                  <th>CHECK IN</th>
                  <th>CHECK OUT</th>
                  <th>WORK HOURS</th>
                  <th>SHIFT</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading && !daily && (
                  <tr>
                    <td colSpan={9} className="att-empty-cell">
                      Loading attendance…
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.employeeId}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={row.name} size="sm" />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{row.name || "—"}</div>
                          {row.designation && <div className="att-sub-text">{row.designation}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="att-id">{row.employeeCode || "—"}</td>
                    <td style={{ color: "#374151", whiteSpace: "nowrap" }}>{row.department || "—"}</td>
                    <td className="att-time">{formatClock12(row.checkIn) || "—"}</td>
                    <td className="att-time">{formatClock12(row.checkOut) || "—"}</td>
                    <td className="att-time">
                      {formatHours(row.hours)}
                      {row.overtimeHours > 0 && <div className="att-sub-text">+{formatHours(row.overtimeHours)} OT</div>}
                    </td>
                    <td>{row.shift ? <span className="att-shift-pill">{row.shift}</span> : "—"}</td>
                    <td>
                      <span className="att-status" style={statusStyles[row.status] || statusStyles["Not Marked"]}>
                        {row.status}
                      </span>
                      {row.leaveType && (
                        <div className="att-sub-text">
                          {row.leaveType}
                          {row.leavePaid === false ? " (unpaid)" : ""}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          type="button"
                          className="att-dots-btn"
                          onClick={() => openEdit(row)}
                          title="Update attendance"
                          aria-label={`Update attendance for ${row.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="att-dots-btn"
                          onClick={() => navigate(`/hrms/attendance/individual?employeeId=${row.employeeId}&month=${dateVal.slice(0, 7)}`)}
                          title="View month"
                          aria-label={`View month for ${row.name}`}
                        >
                          <CalendarDays size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="att-empty-cell">
                      {rows.length === 0 ? "No employees found for this day." : "No attendance records match the filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick update modal */}
      <Modal
        isOpen={Boolean(editRow)}
        onClose={() => setEditRow(null)}
        title={`Update Attendance — ${editRow?.name || ""}`}
        subtitle={`${dateVal.split("-").reverse().join("-")}${editRow?.employeeCode ? ` • ${editRow.employeeCode}` : ""}`}
        footer={
          <>
            {editRow?.marked && !editLocked && (
              <button type="button" className="btn-outline" disabled={saving} onClick={handleClearMarking} style={{ marginRight: "auto" }}>
                Clear marking
              </button>
            )}
            <button type="button" className="btn-outline" onClick={() => setEditRow(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={saving || editLocked} onClick={handleEditSave}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        {editRow && (
          <div style={{ display: "grid", gap: 16 }}>
            {editLocked ? (
              <div className="att-lock-note">
                On leave: <b>{editRow.leaveType}</b>. This day was posted by an approved leave and cannot be overwritten here.
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <div className="att-pill-row">
                    {EDIT_STATUSES.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleEditStatus(st)}
                        className={editForm.status === st ? "att-pill active" : "att-pill"}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
                {editTimed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Check In</label>
                      <input type="time" className="form-input" value={editForm.checkIn} onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Check Out</label>
                      <input type="time" className="form-input" value={editForm.checkOut} onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })} />
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Remark</label>
                  <input className="form-input" value={editForm.remark} onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })} placeholder="Optional note" />
                </div>
                <div className="att-sub-text" style={{ fontSize: 12 }}>
                  Shift {shiftStart}–{shiftEnd}. Hours, and Late vs Present, are worked out by the server from the flexibility policy.
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Regularize Attendance Modal */}
      <Modal
        isOpen={showRegModal}
        onClose={() => setShowRegModal(false)}
        title="Regularize Attendance"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setShowRegModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={regSaving} onClick={handleRegularizeSubmit}>
              {regSaving ? "Submitting…" : "Submit Regularization"}
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div className="form-group">
            <div className="flex items-center justify-between">
              <label className="form-label">Select Employee</label>
              <MasterSourceLink source="employees" />
            </div>
            <select className="form-select" value={regEmp} onChange={(e) => setRegEmp(e.target.value)}>
              <option value="">Select employee…</option>
              {regEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.code ? ` (${e.code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={regDate} max={localISODate()} onChange={(e) => setRegDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Check In Time</label>
              <input type="time" className="form-input" value={regIn} onChange={(e) => setRegIn(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Check Out Time</label>
              <input type="time" className="form-input" value={regOut} onChange={(e) => setRegOut(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reason / Context</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Explain missed check-in or correction reason..."
              value={regReason}
              onChange={(e) => setRegReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <style>{`
        .att-mgmt-page { background: #f8fafc; margin: -24px -28px -40px; padding: 18px 26px 28px; min-height: calc(100vh - 62px); }
        .att-export-btn { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #d1d5db; border-radius: 10px; padding: 8px 16px; font-size: 13.5px; font-weight: 600; color: #374151; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
        .att-export-btn:hover { background: #f9fafb; }
        .att-reg-btn { background: #16233a; color: #fff; border: none; border-radius: 10px; padding: 9px 18px; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .att-reg-btn:hover { background: #0f172a; }

        .att-banner { display: flex; align-items: center; gap: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; border-radius: 12px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; }

        .att-stats-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
        .att-stat-card { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; padding: 14px 16px; box-shadow: 0 1px 2px rgba(16,24,40,0.03); min-width: 0; }
        .att-stat-label { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #6b7280; text-transform: uppercase; }
        .att-stat-dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
        .att-stat-val { font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.02em; margin-top: 6px; line-height: 1.1; white-space: nowrap; }
        .att-stat-sub { font-size: 12px; color: #6b7280; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .att-card { background: #fff; border: 1px solid #e8edf3; border-radius: 16px; box-shadow: 0 1px 3px rgba(16,24,40,0.03); }
        .att-filter-card { border: none; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .att-filter-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .att-filter-right { display: flex; align-items: center; gap: 8px; }

        .att-search-wrap { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 12px; min-width: 180px; }
        .att-search-input { border: none; background: transparent; font-size: 13px; color: #1e293b; outline: none; width: 100%; }

        .att-date-wrap { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 14px; font-size: 13px; color: #374151; min-width: 120px; cursor: pointer; }
        .att-date-native { position: absolute; right: 0; top: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

        .att-filter-dropdown { position: relative; display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0 12px; height: 35px; cursor: pointer; transition: all 0.15s ease; box-sizing: border-box; }
        .att-filter-dropdown:hover { border-color: #cbd5e1; background: #f1f5f9; }
        .att-filter-dropdown.active { border-color: #3b82f6; background: #eff6ff; }
        .att-filter-text { font-size: 13px; color: #374151; font-weight: 500; white-space: nowrap; user-select: none; }
        .att-filter-dropdown.active .att-filter-text { color: #1d4ed8; font-weight: 600; }
        .att-filter-arrow { color: #64748b; flex-shrink: 0; pointer-events: none; }
        .att-filter-dropdown.active .att-filter-arrow { color: #2563eb; }
        .att-filter-native-select { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

        .att-btn-outline { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 14px; font-size: 13px; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s ease; }
        .att-btn-outline:hover { background: #f8fafc; color: #111827; }
        .att-spin { animation: att-spin 0.9s linear infinite; }
        @keyframes att-spin { to { transform: rotate(360deg); } }

        .att-main-card { overflow: hidden; }
        .att-table { width: 100%; border-collapse: collapse; min-width: 900px; font-size: 13.5px; }
        .att-table thead tr { background: #ffffff; border-bottom: 1px solid #e2e8f0; }
        .att-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7b8aa0; padding: 14px 18px; white-space: nowrap; }
        .att-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s ease; }
        .att-table tbody tr:hover { background: #f8fafc; }
        .att-table td { padding: 12px 18px; vertical-align: middle; }
        .att-empty-cell { text-align: center; color: #6b7280; padding: 32px !important; }
        .att-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 36px 16px; color: #475569; font-size: 13.5px; }

        .att-sub-text { font-size: 11.5px; color: #6b7280; margin-top: 2px; white-space: nowrap; }
        .att-id { font-family: inherit; font-size: 12.5px; color: #6b7280; white-space: nowrap; }
        .att-time { font-family: inherit; font-size: 13px; font-weight: 500; color: #334155; white-space: nowrap; }
        .att-shift-pill { display: inline-block; font-size: 12px; font-weight: 500; color: #374151; background: #f3f4f6; border-radius: 999px; padding: 3px 12px; white-space: nowrap; }
        .att-status { display: inline-block; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 4px 13px; border: 1px solid; white-space: nowrap; }
        .att-dots-btn { border: none; background: transparent; color: #6b7280; cursor: pointer; padding: 6px; border-radius: 6px; display: grid; place-items: center; }
        .att-dots-btn:hover { color: #111827; background: #f1f5f9; }

        .att-pill-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .att-pill { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 12px; font-size: 12.5px; font-weight: 500; color: #475569; cursor: pointer; }
        .att-pill.active { background: #16233a; color: #fff; border-color: #16233a; font-weight: 600; }
        .att-lock-note { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; border-radius: 10px; padding: 12px; font-size: 13px; }

        @media (max-width: 1280px) {
          .att-stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        @media (max-width: 1023px) {
          .att-mgmt-page { margin: -16px -20px -24px; }
        }
        @media (max-width: 767px) {
          .att-mgmt-page { margin: -12px -14px -20px; }
        }
        @media (max-width: 640px) {
          .att-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .att-mgmt-page { padding: 14px 14px 22px; }
          .att-filter-card { padding: 12px 14px; }
          .att-filter-left { width: 100%; }
          .att-search-wrap { flex: 1 1 100%; min-width: 0; }
          .att-filter-right { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}
