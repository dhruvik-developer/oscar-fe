import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Calendar as CalendarIcon, Search, AlertTriangle, Lock, RefreshCw } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { Avatar } from "../../../components/hrms/Avatar";
import {
  pullDailyAttendance,
  saveAttendanceDay,
  clearAttendanceDay,
  localISODate,
  formatHours,
  describeError,
} from "../../../services/hrmsSync";

const STATUSES = ["Present", "Late", "Half Day", "WFH", "Absent", "On Leave", "Not Marked"];
const TIMED_STATUSES = ["Present", "Late", "Half Day", "WFH"];

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

/** Server row → editable row. Holiday / Week Off unmarked days edit as "Not Marked". */
function toEditable(r) {
  const status = STATUSES.includes(r.status) ? r.status : "Not Marked";
  return {
    ...r,
    editStatus: status,
    inTime: isoToTime(r.checkIn),
    outTime: isoToTime(r.checkOut),
    editRemark: r.remark || "",
    original: { status, inTime: isoToTime(r.checkIn), outTime: isoToTime(r.checkOut), remark: r.remark || "" },
    locked: Boolean(r.leaveType),
  };
}

function isDirty(r) {
  const o = r.original;
  return o.status !== r.editStatus || o.inTime !== r.inTime || o.outTime !== r.outTime || o.remark !== r.editRemark;
}

export default function MarkAttendance() {
  const showToast = useAppStore((s) => s.showToast || s.setToast);

  const [date, setDate] = useState(() => localISODate());
  const [daily, setDaily] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skipped, setSkipped] = useState([]);
  const requestRef = useRef(0);

  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");
  const [location, setLocation] = useState("All");
  const [shift, setShift] = useState("All");

  const load = useCallback(async () => {
    const ticket = ++requestRef.current;
    setLoading(true);
    setLoadError(false);
    const res = await pullDailyAttendance(date);
    if (ticket !== requestRef.current) return;
    if (res) {
      setDaily(res);
      setRows((res.results || []).map(toEditable));
    } else {
      setDaily(null);
      setRows([]);
      setLoadError(true);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const shiftStart = daily?.shiftStart || "09:30";
  const shiftEnd = daily?.shiftEnd || "18:30";

  const deptOptions = useMemo(() => uniqueValues(rows, "department"), [rows]);
  const locOptions = useMemo(() => uniqueValues(rows, "location"), [rows]);
  const shiftOptions = useMemo(() => uniqueValues(rows, "shift"), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (dept !== "All" && r.department !== dept) return false;
      if (location !== "All" && r.location !== location) return false;
      if (shift !== "All" && r.shift !== shift) return false;
      if (q && !String(r.name ?? "").toLowerCase().includes(q) && !String(r.employeeCode ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, dept, location, shift, search]);

  const dirtyRows = useMemo(() => rows.filter((r) => !r.locked && isDirty(r)), [rows]);
  const unmarkedCount = useMemo(() => filtered.filter((r) => !r.locked && r.editStatus === "Not Marked").length, [filtered]);

  function updateRow(employeeId, patch) {
    setRows((prev) => prev.map((r) => (r.employeeId === employeeId ? { ...r, ...patch } : r)));
  }

  function changeStatus(row, status) {
    const patch = { editStatus: status };
    if (!TIMED_STATUSES.includes(status)) {
      patch.inTime = "";
      patch.outTime = "";
    } else if (status !== "Half Day" && !row.inTime && !row.outTime) {
      patch.inTime = shiftStart;
      patch.outTime = shiftEnd;
    }
    updateRow(row.employeeId, patch);
  }

  function markUnmarkedPresent() {
    const ids = new Set(filtered.filter((r) => !r.locked && r.editStatus === "Not Marked").map((r) => r.employeeId));
    if (ids.size === 0) {
      showToast("Everyone in view is already marked.");
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        ids.has(r.employeeId)
          ? { ...r, editStatus: "Present", inTime: r.inTime || shiftStart, outTime: r.outTime || shiftEnd }
          : r
      )
    );
    showToast(`${ids.size} employee(s) set to Present — click Save Attendance to record.`);
  }

  function changeDate(next) {
    if (!next || next === date) return;
    if (dirtyRows.length > 0 && !window.confirm(`Discard ${dirtyRows.length} unsaved change(s)?`)) return;
    setSkipped([]);
    setDate(next);
  }

  async function handleSave() {
    const toWrite = dirtyRows.filter((r) => r.editStatus !== "Not Marked");
    const toClear = dirtyRows.filter((r) => r.editStatus === "Not Marked" && r.marked);
    if (toWrite.length === 0 && toClear.length === 0) {
      showToast("No changes to save.");
      return;
    }
    const missingTimes = toWrite.filter((r) => ["Present", "Late"].includes(r.editStatus) && !r.inTime);
    if (missingTimes.length > 0) {
      showToast(`Enter a check-in time for ${missingTimes[0].name}${missingTimes.length > 1 ? ` and ${missingTimes.length - 1} more` : ""}.`, "error");
      return;
    }
    setSaving(true);
    setSkipped([]);
    try {
      let written = 0;
      let skippedRows = [];
      if (toWrite.length > 0) {
        const res = await saveAttendanceDay(
          date,
          toWrite.map((r) => {
            const timed = TIMED_STATUSES.includes(r.editStatus);
            return {
              employeeId: r.employeeId,
              status: r.editStatus,
              checkIn: timed ? r.inTime : "",
              checkOut: timed ? r.outTime : "",
              remark: r.editRemark,
            };
          })
        );
        if (!res) throw new Error("The server is not reachable");
        written = res.written ?? toWrite.length;
        skippedRows = res.skipped || [];
      }
      let cleared = 0;
      if (toClear.length > 0) {
        const res = await clearAttendanceDay(date, toClear.map((r) => r.employeeId));
        cleared = res?.cleared ?? 0;
      }
      setSkipped(skippedRows);
      const parts = [`${written} record(s) saved for ${date}`];
      if (cleared) parts.push(`${cleared} cleared`);
      if (skippedRows.length) parts.push(`${skippedRows.length} skipped`);
      showToast(parts.join(", ") + ".", skippedRows.length ? "error" : undefined);
      await load();
      useAttendanceStore.getState().refreshAttendance?.();
    } catch (err) {
      showToast(`Attendance not saved — ${describeError(err)}`, "error");
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        editStatus: r.original.status,
        inTime: r.original.inTime,
        outTime: r.original.outTime,
        editRemark: r.original.remark,
      }))
    );
  }

  return (
    <div className="mark-att-page">
      <PageHeader
        title="Mark Attendance"
        subtitle="Record daily employee attendance. Hours and Late vs Present are calculated from the flexibility policy."
        guide={hrmsGuides.attendanceMark}
      />

      {/* Filter Control Bar */}
      <div className="mark-card mark-filter-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="mark-date-wrap">
            <span>{date.split("-").reverse().join("-")}</span>
            <CalendarIcon size={14} style={{ color: "#475569" }} />
            <input
              type="date"
              value={date}
              onChange={(e) => changeDate(e.target.value)}
              className="mark-date-native"
              aria-label="Select date"
            />
          </div>

          <div className="mark-search-wrap">
            <Search size={14} style={{ color: "#94a3b8" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or ID"
              className="mark-search-input"
            />
          </div>

          <select value={dept} onChange={(e) => setDept(e.target.value)} className="mark-select" aria-label="Department">
            <option value="All">All departments</option>
            {deptOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {locOptions.length > 0 && (
            <select value={location} onChange={(e) => setLocation(e.target.value)} className="mark-select" aria-label="Location">
              <option value="All">All locations</option>
              {locOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}

          {shiftOptions.length > 0 && (
            <select value={shift} onChange={(e) => setShift(e.target.value)} className="mark-select" aria-label="Shift">
              <option value="All">All shifts</option>
              {shiftOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", color: dirtyRows.length ? "#b45309" : "#6b7280", fontWeight: dirtyRows.length ? 600 : 400 }}>
            {dirtyRows.length} unsaved change{dirtyRows.length === 1 ? "" : "s"}
          </span>
          <button type="button" className="mark-btn-cancel" onClick={markUnmarkedPresent} disabled={loading || unmarkedCount === 0}>
            Mark all unmarked as Present{unmarkedCount ? ` (${unmarkedCount})` : ""}
          </button>
          <button type="button" className="mark-btn-icon" onClick={load} title="Reload" aria-label="Reload">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {daily && daily.isWorkingDay === false && (
        <div className="mark-banner">
          {daily.holiday ? `Holiday: ${typeof daily.holiday === "string" ? daily.holiday : daily.holiday.name || "Holiday"}` : "Week off"} — {date} is not a working day. Mark only those who worked.
        </div>
      )}

      {skipped.length > 0 && (
        <div className="mark-skipped">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Skipped by the server:</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {skipped.map((s) => (
              <li key={s.employeeId}>
                {s.name || s.employeeId}: {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Table Card */}
      <div className="mark-card mark-main-card">
        {loadError ? (
          <div className="mark-empty">
            <AlertTriangle size={20} style={{ color: "#dc2626" }} />
            <div>Could not load the register for {date}.</div>
            <button type="button" className="mark-btn-cancel" onClick={load}>
              Retry
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="mark-table">
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>EMPLOYEE ID</th>
                  <th>DEPARTMENT</th>
                  <th>CHECK IN</th>
                  <th>CHECK OUT</th>
                  <th>HOURS</th>
                  <th>STATUS</th>
                  <th>REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="mark-empty-cell">
                      Loading register…
                    </td>
                  </tr>
                )}
                {filtered.map((r) => {
                  const dirty = !r.locked && isDirty(r);
                  const timed = TIMED_STATUSES.includes(r.editStatus);
                  return (
                    <tr key={r.employeeId} className={dirty ? "mark-row-dirty" : ""}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={r.name} size="sm" />
                          <div>
                            <div style={{ fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{r.name}</div>
                            {r.designation && <div className="mark-sub-text">{r.designation}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="mark-id">{r.employeeCode || "—"}</td>
                      <td style={{ color: "#374151", whiteSpace: "nowrap" }}>{r.department || "—"}</td>
                      {r.locked ? (
                        <>
                          <td colSpan={3}>
                            <span className="mark-lock">
                              <Lock size={12} /> On leave: {r.leaveType}
                              {r.leavePaid === false ? " (unpaid)" : ""}
                            </span>
                          </td>
                          <td>
                            <span className="mark-status-readonly">{r.status}</span>
                          </td>
                          <td className="mark-sub-text">{r.remark || "—"}</td>
                        </>
                      ) : (
                        <>
                          <td>
                            <input
                              type="time"
                              value={r.inTime}
                              disabled={!timed}
                              onChange={(e) => updateRow(r.employeeId, { inTime: e.target.value })}
                              className="mark-input mark-input-time"
                              aria-label={`Check in for ${r.name}`}
                            />
                          </td>
                          <td>
                            <input
                              type="time"
                              value={r.outTime}
                              disabled={!timed}
                              onChange={(e) => updateRow(r.employeeId, { outTime: e.target.value })}
                              className="mark-input mark-input-time"
                              aria-label={`Check out for ${r.name}`}
                            />
                          </td>
                          <td className="mark-sub-text" style={{ fontSize: 12.5 }}>
                            {dirty ? "—" : formatHours(r.hours)}
                          </td>
                          <td>
                            <select
                              value={r.editStatus}
                              onChange={(e) => changeStatus(r, e.target.value)}
                              className="mark-select-status"
                              aria-label={`Status for ${r.name}`}
                            >
                              {STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                            {r.source && !dirty && <div className="mark-sub-text">via {r.source}</div>}
                          </td>
                          <td>
                            <input
                              type="text"
                              value={r.editRemark}
                              onChange={(e) => updateRow(r.employeeId, { editRemark: e.target.value })}
                              placeholder="—"
                              className="mark-input mark-input-remarks"
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="mark-empty-cell">
                      {rows.length === 0 ? "No employees found." : "No employees match the selected filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mark-footer">
          <button type="button" onClick={discardChanges} disabled={dirtyRows.length === 0 || saving} className="mark-btn-cancel">
            Discard Changes
          </button>
          <button type="button" onClick={handleSave} disabled={saving || dirtyRows.length === 0} className="mark-btn-save">
            {saving ? "Saving…" : `Save Attendance${dirtyRows.length ? ` (${dirtyRows.length})` : ""}`}
          </button>
        </div>
      </div>

      <style>{`
        .mark-att-page { background: #f8fafc; margin: -24px -28px -40px; padding: 18px 26px 28px; min-height: calc(100vh - 62px); }

        .mark-card { background: #fff; border: 1px solid #e8edf3; border-radius: 16px; box-shadow: 0 1px 3px rgba(16,24,40,0.03); }
        .mark-filter-card { border: none; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }

        .mark-date-wrap { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 14px; font-size: 13px; color: #374151; min-width: 120px; cursor: pointer; }
        .mark-date-native { position: absolute; right: 0; top: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
        .mark-search-wrap { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 12px; min-width: 170px; }
        .mark-search-input { border: none; background: transparent; font-size: 13px; color: #1e293b; outline: none; width: 100%; }

        .mark-select { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 32px 7px 14px; font-size: 13px; color: #374151; font-weight: 500; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230f172a' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 12px; min-width: 100px; }
        .mark-select:focus { border-color: #94a3b8; background-color: #fff; }

        .mark-banner { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; border-radius: 12px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; }
        .mark-skipped { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 12px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; }

        .mark-main-card { overflow: hidden; }
        .mark-table { width: 100%; border-collapse: collapse; min-width: 960px; font-size: 13.5px; }
        .mark-table thead tr { background: #ffffff; border-bottom: 1px solid #e2e8f0; }
        .mark-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7b8aa0; padding: 14px 16px; white-space: nowrap; }
        .mark-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s ease; }
        .mark-table tbody tr:hover { background: #f8fafc; }
        .mark-table tbody tr.mark-row-dirty { background: #fffbeb; }
        .mark-table td { padding: 10px 16px; vertical-align: middle; }
        .mark-empty-cell { text-align: center; color: #6b7280; padding: 32px !important; }
        .mark-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 36px 16px; color: #475569; font-size: 13.5px; }

        .mark-sub-text { font-size: 11.5px; color: #6b7280; margin-top: 2px; white-space: nowrap; }
        .mark-id { font-family: inherit; font-size: 12.5px; color: #6b7280; white-space: nowrap; }
        .mark-lock { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 999px; padding: 3px 12px; white-space: nowrap; }
        .mark-status-readonly { display: inline-block; font-size: 12px; font-weight: 600; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 999px; padding: 3px 12px; white-space: nowrap; }

        .mark-input { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 10px; font-size: 13px; color: #1e293b; outline: none; transition: border-color 0.15s ease; }
        .mark-input:focus { border-color: #94a3b8; }
        .mark-input:disabled { background: #f8fafc; color: #94a3b8; }
        .mark-input-time { width: 112px; }
        .mark-input-remarks { width: 140px; }

        .mark-select-status { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 28px 6px 12px; font-size: 13px; color: #1e293b; font-weight: 500; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230f172a' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 12px; width: 124px; }
        .mark-select-status:focus { border-color: #94a3b8; }

        .mark-footer { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 14px 20px; background: #ffffff; border-top: 1px solid #f1f5f9; }
        .mark-btn-cancel { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 16px; font-size: 13px; font-weight: 500; color: #475569; cursor: pointer; transition: background 0.15s ease; }
        .mark-btn-cancel:hover:not(:disabled) { background: #f8fafc; color: #111827; }
        .mark-btn-cancel:disabled, .mark-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
        .mark-btn-icon { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; color: #475569; cursor: pointer; display: grid; place-items: center; }
        .mark-btn-save { background: #16233a; color: #fff; border: none; border-radius: 10px; padding: 9px 20px; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .mark-btn-save:hover:not(:disabled) { background: #0f172a; }
        @media (max-width: 1023px) {
          .mark-att-page { margin: -16px -20px -24px; }
        }
        @media (max-width: 767px) {
          .mark-att-page { margin: -12px -14px -20px; }
        }
        @media (max-width: 640px) {
          .mark-att-page { padding: 14px 14px 22px; }
          .mark-filter-card { padding: 12px 14px; }
          .mark-search-wrap { flex: 1 1 100%; min-width: 0; }
          .mark-footer { flex-wrap: wrap; padding: 12px 14px; }
        }
      `}</style>
    </div>
  );
}
