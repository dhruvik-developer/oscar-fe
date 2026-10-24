import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Calendar as CalendarIcon, Search, AlertTriangle, Lock, RefreshCw } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import { ConfirmModal } from "../../../components/hrms/Shared";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import {
  pullDailyAttendance,
  saveAttendanceDay,
  clearAttendanceDay,
  localISODate,
  formatClock12,
  describeError,
} from "../../../services/hrmsSync";
import { Avatar } from "../../../components/hrms/Avatar";

const STATUS_OPTIONS = ["Present", "Late", "Half Day", "WFH", "Absent", "On Leave"];
const FILTER_STATUSES = ["Present", "Late", "Half Day", "WFH", "Absent", "On Leave", "Not Marked", "Holiday", "Week Off"];
// Present / WFH get the shift's hours. Late is sent without times: the server
// re-derives Late vs Present from the check-in, and an on-time shift start
// would turn it back into Present.
const SHIFT_TIMED = ["Present", "WFH"];

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

function uniqueValues(rows, key) {
  return Array.from(new Set(rows.map((r) => r[key]).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
}

export default function BulkAttendance() {
  const showToast = useAppStore((s) => s.showToast || s.setToast);

  const [date, setDate] = useState(() => localISODate());
  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(0);

  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");
  const [location, setLocation] = useState("All");
  const [shift, setShift] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkStatus, setBulkStatus] = useState("Present");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const load = useCallback(async () => {
    const ticket = ++requestRef.current;
    setLoading(true);
    setLoadError(false);
    const res = await pullDailyAttendance(date);
    if (ticket !== requestRef.current) return;
    if (res) setDaily(res);
    else {
      setDaily(null);
      setLoadError(true);
    }
    setSelectedIds(new Set());
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => daily?.results || [], [daily]);
  const shiftStart = daily?.shiftStart || "09:30";
  const shiftEnd = daily?.shiftEnd || "18:30";

  const deptOptions = useMemo(() => uniqueValues(rows, "department"), [rows]);
  const locOptions = useMemo(() => uniqueValues(rows, "location"), [rows]);
  const shiftOptions = useMemo(() => uniqueValues(rows, "shift"), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((e) => {
      if (dept !== "All" && e.department !== dept) return false;
      if (location !== "All" && e.location !== location) return false;
      if (shift !== "All" && e.shift !== shift) return false;
      if (statusFilter !== "All" && e.status !== statusFilter) return false;
      if (q && !String(e.name ?? "").toLowerCase().includes(q) && !String(e.employeeCode ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, dept, location, shift, statusFilter, search]);

  const selectable = useMemo(() => filtered.filter((e) => !e.leaveType), [filtered]);
  const selectedRows = useMemo(() => rows.filter((e) => selectedIds.has(e.employeeId) && !e.leaveType), [rows, selectedIds]);
  const allSelected = selectable.length > 0 && selectable.every((e) => selectedIds.has(e.employeeId));

  function toggleAll(v) {
    const next = new Set(selectedIds);
    selectable.forEach((e) => (v ? next.add(e.employeeId) : next.delete(e.employeeId)));
    setSelectedIds(next);
  }

  function toggleOne(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function handleSaveClick() {
    if (selectedRows.length === 0) {
      showToast("Select at least one employee first.", "error");
      return;
    }
    setConfirmOpen(true);
  }

  function handleClearClick() {
    if (selectedRows.length === 0) {
      showToast("Select the employees whose marking should be cleared.", "error");
      return;
    }
    setClearOpen(true);
  }

  async function handleConfirmSave() {
    setConfirmOpen(false);
    setBusy(true);
    const timed = SHIFT_TIMED.includes(bulkStatus);
    try {
      const res = await saveAttendanceDay(
        date,
        selectedRows.map((e) => ({
          employeeId: e.employeeId,
          status: bulkStatus,
          checkIn: timed ? shiftStart : "",
          checkOut: timed ? shiftEnd : "",
          remark: e.remark || "",
        }))
      );
      if (!res) throw new Error("The server is not reachable");
      const skipped = res.skipped || [];
      if (skipped.length) {
        showToast(
          `${res.written ?? 0} saved as "${bulkStatus}"; skipped: ${skipped.map((s) => `${s.name || "employee"} (${s.reason})`).join(", ")}`,
          "error"
        );
      } else {
        showToast(`Attendance saved as "${bulkStatus}" for ${res.written ?? selectedRows.length} employee(s) on ${date}.`);
      }
      await load();
      useAttendanceStore.getState().refreshAttendance?.();
    } catch (err) {
      showToast(`Attendance not saved — ${describeError(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmClear() {
    setClearOpen(false);
    setBusy(true);
    try {
      const res = await clearAttendanceDay(date, selectedRows.map((e) => e.employeeId));
      if (!res) throw new Error("The server is not reachable");
      showToast(`Marking cleared for ${res.cleared ?? 0} employee(s) on ${date}.`);
      await load();
      useAttendanceStore.getState().refreshAttendance?.();
    } catch (err) {
      showToast(`Marking not cleared — ${describeError(err)}`, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bulk-att-page">
      <PageHeader
        title="Bulk Attendance"
        subtitle="Update attendance for multiple employees at once."
        guide={hrmsGuides.attendanceBulk}
      />

      {/* Top Filter Card */}
      <div className="bulk-card bulk-filter-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="bulk-date-wrap">
            <span>{date.split("-").reverse().join("-")}</span>
            <CalendarIcon size={14} style={{ color: "#475569" }} />
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="bulk-date-native"
              aria-label="Select date"
            />
          </div>

          <div className="bulk-search-wrap">
            <Search size={14} style={{ color: "#94a3b8" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or ID"
              className="bulk-search-input"
            />
          </div>

          <select value={dept} onChange={(e) => setDept(e.target.value)} className="bulk-select" aria-label="Department">
            <option value="All">All departments</option>
            {deptOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {locOptions.length > 0 && (
            <select value={location} onChange={(e) => setLocation(e.target.value)} className="bulk-select" aria-label="Location">
              <option value="All">All locations</option>
              {locOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}

          {shiftOptions.length > 0 && (
            <select value={shift} onChange={(e) => setShift(e.target.value)} className="bulk-select" aria-label="Shift">
              <option value="All">All shifts</option>
              {shiftOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bulk-select" aria-label="Current status">
            <option value="All">All statuses</option>
            {FILTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button type="button" className="bulk-btn-icon" onClick={load} title="Reload" aria-label="Reload">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {daily && daily.isWorkingDay === false && (
        <div className="bulk-banner">
          {daily.holiday ? `Holiday: ${typeof daily.holiday === "string" ? daily.holiday : daily.holiday.name || "Holiday"}` : "Week off"} — {date} is not a working day.
        </div>
      )}

      {/* Action & Selection Bar Card */}
      <div className="bulk-card bulk-action-card">
        <div style={{ fontSize: 13, color: "#374151" }}>
          <b>{selectedRows.length}</b> selected
          <span style={{ color: "#6b7280" }}>
            {" "}
            • {SHIFT_TIMED.includes(bulkStatus) ? `times ${shiftStart}–${shiftEnd}` : "no check-in/out times"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="bulk-pills-group">
            {STATUS_OPTIONS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setBulkStatus(st)}
                className={bulkStatus === st ? "bulk-pill active" : "bulk-pill"}
              >
                {st}
              </button>
            ))}
          </div>

          <button type="button" onClick={handleClearClick} disabled={busy} className="bulk-btn-outline">
            Clear marking
          </button>
          <button type="button" onClick={handleSaveClick} disabled={busy} className="bulk-btn-save">
            {busy ? "Saving…" : "Save Attendance"}
          </button>
        </div>
      </div>

      {/* Employee List Table */}
      <div className="bulk-card bulk-main-card">
        {loadError ? (
          <div className="bulk-empty">
            <AlertTriangle size={20} style={{ color: "#dc2626" }} />
            <div>Could not load attendance for {date}.</div>
            <button type="button" className="bulk-btn-outline" onClick={load}>
              Retry
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="bulk-table">
              <thead>
                <tr>
                  <th style={{ width: 40, paddingLeft: 20 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="bulk-checkbox"
                      aria-label="Select all"
                    />
                  </th>
                  <th>EMPLOYEE</th>
                  <th>EMPLOYEE ID</th>
                  <th>DEPARTMENT</th>
                  <th>CHECK IN / OUT</th>
                  <th>CURRENT STATUS</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="bulk-empty-cell">
                      Loading employees…
                    </td>
                  </tr>
                )}
                {filtered.map((e) => {
                  const locked = Boolean(e.leaveType);
                  return (
                    <tr key={e.employeeId} className={locked ? "bulk-row-locked" : ""}>
                      <td style={{ paddingLeft: 20 }}>
                        {locked ? (
                          <Lock size={14} style={{ color: "#94a3b8" }} aria-label="Locked by leave" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(e.employeeId)}
                            onChange={() => toggleOne(e.employeeId)}
                            className="bulk-checkbox"
                            aria-label={`Select ${e.name}`}
                          />
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={e.name} size="sm" />
                          <div>
                            <div style={{ fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{e.name}</div>
                            {e.designation && <div className="bulk-sub-text">{e.designation}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="bulk-id">{e.employeeCode || "—"}</td>
                      <td style={{ color: "#374151", whiteSpace: "nowrap" }}>{e.department || "—"}</td>
                      <td className="bulk-id">
                        {e.checkIn || e.checkOut ? `${formatClock12(e.checkIn) || "—"} – ${formatClock12(e.checkOut) || "—"}` : "—"}
                      </td>
                      <td>
                        <span className="bulk-status" style={statusStyles[e.status] || statusStyles["Not Marked"]}>
                          {e.status}
                        </span>
                        {locked && (
                          <div className="bulk-sub-text">
                            On leave: {e.leaveType}
                            {e.leavePaid === false ? " (unpaid)" : ""}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="bulk-empty-cell">
                      {rows.length === 0 ? "No employees found." : "No employees match the selected filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm bulk update?"
        desc={`Mark ${selectedRows.length} selected employee(s) as "${bulkStatus}" on ${date}? Existing marks for that day will be overwritten (leave days are kept).`}
        confirmLabel="Confirm Update"
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSave}
      />

      <ConfirmModal
        open={clearOpen}
        title="Clear attendance marking?"
        desc={`Un-mark ${selectedRows.length} selected employee(s) for ${date}? Days posted by approved leave are kept.`}
        confirmLabel="Clear Marking"
        danger
        onClose={() => setClearOpen(false)}
        onConfirm={handleConfirmClear}
      />

      <style>{`
        .bulk-att-page { background: #f8fafc; margin: -24px -28px -40px; padding: 18px 26px 28px; min-height: calc(100vh - 62px); }

        .bulk-card { background: #fff; border: 1px solid #e8edf3; border-radius: 16px; box-shadow: 0 1px 3px rgba(16,24,40,0.03); }
        .bulk-filter-card { border: none; padding: 14px 18px; margin-bottom: 16px; }

        .bulk-date-wrap { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 14px; font-size: 13px; color: #374151; min-width: 120px; cursor: pointer; }
        .bulk-date-native { position: absolute; right: 0; top: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
        .bulk-search-wrap { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 12px; min-width: 170px; }
        .bulk-search-input { border: none; background: transparent; font-size: 13px; color: #1e293b; outline: none; width: 100%; }

        .bulk-select { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 32px 7px 14px; font-size: 13px; color: #374151; font-weight: 500; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230f172a' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 12px; min-width: 100px; }
        .bulk-select:focus { border-color: #94a3b8; background-color: #fff; }
        .bulk-btn-icon { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; color: #475569; cursor: pointer; display: grid; place-items: center; }

        .bulk-banner { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; border-radius: 12px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; }

        .bulk-action-card { border: none; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .bulk-checkbox { width: 16px; height: 16px; border-radius: 4px; accent-color: #16233a; cursor: pointer; }

        .bulk-pills-group { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .bulk-pill { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 14px; font-size: 12.5px; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s ease; }
        .bulk-pill:hover { background: #f8fafc; color: #111827; }
        .bulk-pill.active { background: #16233a; color: #fff; border-color: #16233a; font-weight: 600; }

        .bulk-btn-outline { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 16px; font-size: 13px; font-weight: 500; color: #475569; cursor: pointer; }
        .bulk-btn-outline:hover:not(:disabled) { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
        .bulk-btn-save { background: #16233a; color: #fff; border: none; border-radius: 10px; padding: 9px 20px; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .bulk-btn-save:hover:not(:disabled) { background: #0f172a; }
        .bulk-btn-save:disabled, .bulk-btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }

        .bulk-main-card { overflow: hidden; }
        .bulk-table { width: 100%; border-collapse: collapse; min-width: 760px; font-size: 13.5px; }
        .bulk-table thead tr { background: #ffffff; border-bottom: 1px solid #e2e8f0; }
        .bulk-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7b8aa0; padding: 14px 20px; white-space: nowrap; }
        .bulk-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s ease; }
        .bulk-table tbody tr:hover { background: #f8fafc; }
        .bulk-table tbody tr.bulk-row-locked { background: #fafbff; }
        .bulk-table td { padding: 12px 20px; vertical-align: middle; }
        .bulk-empty-cell { text-align: center; color: #6b7280; padding: 32px !important; }
        .bulk-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 36px 16px; color: #475569; font-size: 13.5px; }

        .bulk-sub-text { font-size: 11.5px; color: #6b7280; margin-top: 2px; white-space: nowrap; }
        .bulk-id { font-family: inherit; font-size: 12.5px; color: #6b7280; white-space: nowrap; }
        .bulk-status { display: inline-block; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 4px 13px; border: 1px solid; white-space: nowrap; }
        @media (max-width: 1023px) {
          .bulk-att-page { margin: -16px -20px -24px; }
        }
        @media (max-width: 767px) {
          .bulk-att-page { margin: -12px -14px -20px; }
        }
        @media (max-width: 640px) {
          .bulk-att-page { padding: 14px 14px 22px; }
          .bulk-filter-card, .bulk-action-card { padding: 12px 14px; }
          .bulk-search-wrap { flex: 1 1 100%; min-width: 0; }
        }
      `}</style>
    </div>
  );
}
