import { useState, useMemo, useEffect } from "react";
import { ChevronDown, Search, Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import Modal from "../../../components/ui/Modal";
import { ConfirmModal } from "../../../components/hrms/Shared";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { Avatar } from "../../../components/hrms/Avatar";
import MasterSourceLink from "../../../components/common/MasterSourceLink";
import { localISODate, describeError } from "../../../services/hrmsSync";

const BASE_STATUSES = ["Pending", "Approved", "Rejected"];
const REG_STATUSES = ["Present", "Half Day", "WFH"];

const typeStyles = {
  Regularization: { background: "#eff6ff", color: "#2563eb", borderColor: "#bfdbfe" },
  "Early Leave": { background: "#f3e8ff", color: "#7e22ce", borderColor: "#d8b4fe" },
  "Half Day": { background: "#fdf4ff", color: "#a21caf", borderColor: "#f5d0fe" },
  "Work From Home (WFH)": { background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd" },
  "General Request": { background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" },
};

const statusStyles = {
  Pending: { background: "#fef3c7", color: "#b45309", borderColor: "#fde68a" },
  Approved: { background: "#e6f4ea", color: "#15803d", borderColor: "#a7f3d0" },
  Rejected: { background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5" },
  Cancelled: { background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" },
};

/** `[Early Leave] Doctor visit` → `Doctor visit`. */
function stripTag(reason) {
  return String(reason || "").replace(/^\[[^\]]*\]\s*/, "");
}

/** `DD/MM/YYYY` → `YYYY-MM-DD` (passes ISO through). */
function toISO(value) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function shortId(id) {
  const text = String(id || "");
  return text.length > 10 ? `#${text.slice(0, 8).toUpperCase()}` : text;
}

function timeRange(a, b) {
  if (!a && !b) return "—";
  return `${a || "—"} – ${b || "—"}`;
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className={`req-filter-dropdown ${value !== "All" ? "active" : ""}`}>
      <span className="req-filter-text">{value === "All" ? label : value}</span>
      <ChevronDown size={13} className="req-filter-arrow" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="req-filter-native-select" aria-label={`${label} Filter`}>
        <option value="All">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function emptyRegForm() {
  return { employeeId: "", date: localISODate(), reqIn: "09:30", reqOut: "18:30", requestedStatus: "Present", reason: "" };
}

function emptyEarlyForm() {
  return { employeeId: "", date: localISODate(), reqIn: "09:30", reqOut: "16:30", reason: "" };
}

export default function Requests() {
  const showToast = useAppStore((s) => s.showToast || s.setToast);
  const storeEmployees = useAppStore((s) => s.employees || []);
  const storeRequests = useAttendanceStore((s) => s.requests || []);
  const flexibility = useAttendanceStore((s) => s.flexibility || {});
  const refreshRequests = useAttendanceStore((s) => s.refreshRequests);
  const setRequestStatus = useAttendanceStore((s) => s.setRequestStatus);
  const addRequest = useAttendanceStore((s) => s.addRequest);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.resolve(refreshRequests?.())
      .catch(() => null)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [refreshRequests]);

  const employeeById = useMemo(() => {
    const map = new Map();
    storeEmployees.forEach((e) => e.id && map.set(String(e.id), e));
    return map;
  }, [storeEmployees]);

  const employeeOptions = useMemo(
    () =>
      storeEmployees
        .filter((e) => e.id)
        .map((e) => ({ id: e.id, name: e.name, code: e.employeeCode || e.empId || "" }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [storeEmployees]
  );

  const requestsList = useMemo(
    () =>
      storeRequests.map((r) => {
        const emp = employeeById.get(String(r.employeeId));
        return {
          ...r,
          employee: r.employee || emp?.name || "—",
          dept: emp?.department || "",
          code: emp?.employeeCode || emp?.empId || "",
          isoDate: toISO(r.date),
          reasonText: stripTag(r.reason),
        };
      }),
    [storeRequests, employeeById]
  );

  const typeTabs = useMemo(() => ["All", ...Array.from(new Set(requestsList.map((r) => r.type).filter(Boolean)))], [requestsList]);
  const deptOptions = useMemo(() => Array.from(new Set(requestsList.map((r) => r.dept).filter(Boolean))).sort(), [requestsList]);
  const statusOptions = useMemo(
    () => Array.from(new Set([...BASE_STATUSES, ...requestsList.map((r) => r.status).filter(Boolean)])),
    [requestsList]
  );

  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");

  const [selectedReq, setSelectedReq] = useState(null);
  const [approveId, setApproveId] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const [showRegModal, setShowRegModal] = useState(false);
  const [showEarlyModal, setShowEarlyModal] = useState(false);
  const [regForm, setRegForm] = useState(emptyRegForm);
  const [earlyForm, setEarlyForm] = useState(emptyEarlyForm);
  const [submitting, setSubmitting] = useState(false);

  // A tab that no longer has requests falls back to All.
  useEffect(() => {
    if (!typeTabs.includes(tab)) setTab("All");
  }, [typeTabs, tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requestsList
      .filter((r) => {
        if (tab !== "All" && r.type !== tab) return false;
        if (
          q &&
          !(
            String(r.employee ?? "").toLowerCase().includes(q) ||
            String(r.code ?? "").toLowerCase().includes(q) ||
            String(r.id ?? "").toLowerCase().includes(q) ||
            String(r.reason ?? "").toLowerCase().includes(q)
          )
        )
          return false;
        if (deptFilter !== "All" && r.dept !== deptFilter) return false;
        if (typeFilter !== "All" && r.type !== typeFilter) return false;
        if (statusFilter !== "All" && r.status !== statusFilter) return false;
        if (dateFilter && r.isoDate !== dateFilter) return false;
        return true;
      })
      // Pending first; otherwise keep the server's (newest-first) order.
      .sort((a, b) => (b.status === "Pending") - (a.status === "Pending"));
  }, [requestsList, tab, search, deptFilter, typeFilter, statusFilter, dateFilter]);

  const countForTab = (t) => (t === "All" ? requestsList.length : requestsList.filter((r) => r.type === t).length);
  const pendingCount = requestsList.filter((r) => r.status === "Pending").length;

  const handleClearFilters = () => {
    setSearch("");
    setDeptFilter("All");
    setTypeFilter("All");
    setStatusFilter("All");
    setDateFilter("");
  };

  async function handleReload() {
    setLoading(true);
    try {
      await refreshRequests?.();
    } finally {
      setLoading(false);
    }
  }

  async function decide(id, status, remark = "") {
    setBusyId(id);
    try {
      await setRequestStatus(id, status, { remark });
      showToast(status === "Approved" ? "Request approved — attendance updated." : "Request rejected.");
      setSelectedReq((prev) => (prev?.id === id ? null : prev));
    } catch (err) {
      showToast(`Request not ${status === "Approved" ? "approved" : "rejected"} — ${describeError(err)}`, "error");
    } finally {
      setBusyId(null);
    }
  }

  const handleApprove = () => {
    const id = approveId;
    setApproveId(null);
    if (id) decide(id, "Approved");
  };

  const handleReject = (reason) => {
    const id = rejectId;
    const remark = String(reason ?? rejectReason).trim();
    if (!id || !remark) return;
    setRejectId(null);
    setRejectReason("");
    decide(id, "Rejected", remark);
  };

  function openRegModal() {
    setRegForm({ ...emptyRegForm(), reqIn: flexibility.shiftStart || "09:30", reqOut: flexibility.shiftEnd || "18:30" });
    setShowRegModal(true);
  }

  function openEarlyModal() {
    setEarlyForm({ ...emptyEarlyForm(), reqIn: flexibility.shiftStart || "09:30" });
    setShowEarlyModal(true);
  }

  async function submitRequest(payload, successMsg, close) {
    setSubmitting(true);
    try {
      const created = await addRequest(payload);
      if (!created) {
        showToast("Request not sent — the server is not reachable.", "error");
        return;
      }
      showToast(successMsg);
      close();
    } catch (err) {
      showToast(`Request not sent — ${describeError(err)}`, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const handleRegSubmit = () => {
    if (!regForm.employeeId) return showToast("Please select an employee.", "error");
    if (!regForm.date) return showToast("Please choose a date.", "error");
    if (!regForm.reason.trim()) return showToast("Please enter a reason for the regularization.", "error");
    const tag = regForm.requestedStatus === "Half Day" ? "[Half Day] " : regForm.requestedStatus === "WFH" ? "[Work From Home] " : "";
    submitRequest(
      {
        employeeId: regForm.employeeId,
        date: regForm.date,
        requestedCheckIn: regForm.reqIn,
        requestedCheckOut: regForm.reqOut,
        requestedStatus: regForm.requestedStatus,
        reason: `${tag}${regForm.reason.trim()}`,
      },
      "Regularization request submitted.",
      () => setShowRegModal(false)
    );
  };

  const handleEarlySubmit = () => {
    if (!earlyForm.employeeId) return showToast("Please select an employee.", "error");
    if (!earlyForm.date) return showToast("Please choose a date.", "error");
    if (!earlyForm.reqOut) return showToast("Please enter the early check-out time.", "error");
    if (!earlyForm.reason.trim()) return showToast("Please enter a reason for the early clock-out.", "error");
    submitRequest(
      {
        employeeId: earlyForm.employeeId,
        date: earlyForm.date,
        requestedCheckIn: earlyForm.reqIn,
        requestedCheckOut: earlyForm.reqOut,
        requestedStatus: "Present",
        reason: `[Early Leave] ${earlyForm.reason.trim()}`,
      },
      "Early clock-out request submitted.",
      () => setShowEarlyModal(false)
    );
  };

  const employeeSelect = (value, onChange) => (
    <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select employee…</option>
      {employeeOptions.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
          {e.code ? ` (${e.code})` : ""}
        </option>
      ))}
    </select>
  );

  return (
    <div className="req-page">
      <PageHeader
        title="Attendance Requests"
        subtitle="Regularization, early clock-out, half day and WFH requests awaiting review."
        guide={hrmsGuides.attendanceRequests}
        actions={
          <>
            <button type="button" onClick={openRegModal} className="req-btn-outline">
              New Regularization
            </button>
            <button type="button" onClick={openEarlyModal} className="req-btn-primary">
              Early Clock-Out Request
            </button>
          </>
        }
      />

      {/* Type tabs (only the types that occur) */}
      <div className="req-tabs">
        {typeTabs.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={tab === t ? "req-tab active" : "req-tab"}>
            {t} ({countForTab(t)})
          </button>
        ))}
      </div>

      {/* Filter Bar Card */}
      <div className="req-card req-filter-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="req-search-wrap">
            <Search size={15} style={{ color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search employee, ID or reason"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="req-search-input"
            />
          </div>

          {deptOptions.length > 0 && <FilterSelect label="Department" value={deptFilter} onChange={setDeptFilter} options={deptOptions} />}
          <FilterSelect label="Request Type" value={typeFilter} onChange={setTypeFilter} options={typeTabs.slice(1)} />
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />

          <div className="req-date-wrap">
            <span>{dateFilter ? dateFilter.split("-").reverse().join("-") : "dd-mm-yyyy"}</span>
            <CalendarIcon size={14} style={{ color: "#475569" }} />
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="req-date-native" aria-label="Filter date" />
          </div>

          <button type="button" onClick={handleClearFilters} className="req-btn-clear">
            Clear Filters
          </button>
          <button type="button" onClick={handleReload} className="req-btn-clear" title="Reload" aria-label="Reload">
            <RefreshCw size={14} />
          </button>
          <span style={{ fontSize: 12.5, color: "#6b7280", marginLeft: "auto" }}>{pendingCount} pending</span>
        </div>
      </div>

      {/* Main Requests Table */}
      <div className="req-card req-main-card">
        <div style={{ overflowX: "auto" }}>
          <table className="req-table">
            <thead>
              <tr>
                <th>REQUEST</th>
                <th>EMPLOYEE</th>
                <th>REQUEST TYPE</th>
                <th>DATE</th>
                <th>REQUESTED TIME</th>
                <th>REQ. STATUS</th>
                <th>REASON</th>
                <th>SUBMITTED</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading && requestsList.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", color: "#6b7280", padding: "32px" }}>
                    Loading requests…
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button type="button" onClick={() => setSelectedReq(r)} className="req-id-link" title={r.id}>
                      {shortId(r.id)}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={r.employee} size="sm" />
                      <div>
                        <div style={{ fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{r.employee}</div>
                        <div style={{ fontSize: "12px", color: "#6b7280", whiteSpace: "nowrap" }}>
                          {[r.code, r.dept].filter(Boolean).join(" • ") || "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="req-type-pill" style={typeStyles[r.type] || typeStyles.Regularization}>
                      {r.type}
                    </span>
                  </td>
                  <td className="req-date">{r.date || "—"}</td>
                  <td className="req-time">{timeRange(r.reqIn, r.reqOut)}</td>
                  <td style={{ color: "#374151", whiteSpace: "nowrap" }}>{r.requestedStatus || "—"}</td>
                  <td className="req-reason" title={r.reasonText}>
                    {r.reasonText || "—"}
                  </td>
                  <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{r.submitted || "—"}</td>
                  <td>
                    <span className="req-status" style={statusStyles[r.status] || statusStyles.Cancelled}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    {r.status === "Pending" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button type="button" disabled={busyId === r.id} onClick={() => setApproveId(r.id)} className="req-btn-approve">
                          {busyId === r.id ? "…" : "Approve"}
                        </button>
                        <button type="button" disabled={busyId === r.id} onClick={() => setRejectId(r.id)} className="req-btn-reject">
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setSelectedReq(r)} className="req-btn-view">
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", color: "#6b7280", padding: "32px" }}>
                    {requestsList.length === 0 ? "No attendance requests yet." : "No attendance requests match the filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={Boolean(selectedReq)}
        onClose={() => setSelectedReq(null)}
        title={`Request Details — ${shortId(selectedReq?.id)}`}
        footer={
          selectedReq?.status === "Pending" ? (
            <>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setRejectId(selectedReq.id);
                  setSelectedReq(null);
                }}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busyId === selectedReq.id}
                onClick={() => decide(selectedReq.id, "Approved")}
              >
                Approve Request
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setSelectedReq(null)}>
              Close
            </button>
          )
        }
      >
        {selectedReq && (
          <div style={{ display: "grid", gap: 16, fontSize: "13.5px", color: "#334155" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={selectedReq.employee} size="lg" />
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selectedReq.employee}</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748b" }}>
                  {[selectedReq.code, selectedReq.dept, selectedReq.submitted ? `Submitted ${selectedReq.submitted}` : ""].filter(Boolean).join(" • ")}
                </p>
              </div>
            </div>

            <div className="form-row">
              <div className="req-detail-box">
                <span className="req-detail-label">Date</span>
                <div className="req-detail-val">{selectedReq.date || "—"}</div>
              </div>
              <div className="req-detail-box">
                <span className="req-detail-label">Requested Time</span>
                <div className="req-detail-val">{timeRange(selectedReq.reqIn, selectedReq.reqOut)}</div>
              </div>
            </div>

            <div>
              <span className="req-detail-label">Reason</span>
              <div style={{ marginTop: 4, padding: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#111827" }}>
                {selectedReq.reasonText || "—"}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
              <div><strong>Type:</strong> {selectedReq.type}</div>
              <div>
                <strong>Status:</strong>{" "}
                <span className="req-status" style={statusStyles[selectedReq.status] || statusStyles.Cancelled}>
                  {selectedReq.status}
                </span>
              </div>
              <div><strong>Requested Status:</strong> {selectedReq.requestedStatus || "—"}</div>
              <div><strong>Requested By:</strong> {selectedReq.requestedBy || selectedReq.employee}</div>
              {selectedReq.reviewedBy && <div><strong>Reviewed By:</strong> {selectedReq.reviewedBy}</div>}
              <div style={{ wordBreak: "break-all" }}><strong>Request ID:</strong> {selectedReq.id}</div>
            </div>

            {selectedReq.remark && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  ...(selectedReq.status === "Rejected"
                    ? { background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b" }
                    : { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#334155" }),
                }}
              >
                <strong>{selectedReq.status === "Rejected" ? "Rejection reason" : "Reviewer remark"}:</strong> {selectedReq.remark}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Regularize Modal */}
      <Modal
        isOpen={showRegModal}
        onClose={() => setShowRegModal(false)}
        title="New Regularization Request"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setShowRegModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={submitting} onClick={handleRegSubmit}>
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div className="form-group">
            <div className="flex items-center justify-between">
              <label className="form-label">Employee</label>
              <MasterSourceLink source="employees" />
            </div>
            {employeeSelect(regForm.employeeId, (v) => setRegForm({ ...regForm, employeeId: v }))}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" max={localISODate()} value={regForm.date} onChange={(e) => setRegForm({ ...regForm, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Requested Status</label>
              <select className="form-select" value={regForm.requestedStatus} onChange={(e) => setRegForm({ ...regForm, requestedStatus: e.target.value })}>
                {REG_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Requested Check In</label>
              <input type="time" className="form-input" value={regForm.reqIn} onChange={(e) => setRegForm({ ...regForm, reqIn: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Requested Check Out</label>
              <input type="time" className="form-input" value={regForm.reqOut} onChange={(e) => setRegForm({ ...regForm, reqOut: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              Reason for Correction <span className="required">*</span>
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Explain missed check-in or correction details..."
              value={regForm.reason}
              onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Early Clock-Out Modal */}
      <Modal
        isOpen={showEarlyModal}
        onClose={() => setShowEarlyModal(false)}
        title="Early Clock-Out Request"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setShowEarlyModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={submitting} onClick={handleEarlySubmit}>
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div className="form-group">
            <div className="flex items-center justify-between">
              <label className="form-label">Employee</label>
              <MasterSourceLink source="employees" />
            </div>
            {employeeSelect(earlyForm.employeeId, (v) => setEarlyForm({ ...earlyForm, employeeId: v }))}
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={earlyForm.date} onChange={(e) => setEarlyForm({ ...earlyForm, date: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Check In</label>
              <input type="time" className="form-input" value={earlyForm.reqIn} onChange={(e) => setEarlyForm({ ...earlyForm, reqIn: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Early Check Out Time</label>
              <input type="time" className="form-input" value={earlyForm.reqOut} onChange={(e) => setEarlyForm({ ...earlyForm, reqOut: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              Reason for Early Clock-Out <span className="required">*</span>
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Explain personal appointment or medical reason..."
              value={earlyForm.reason}
              onChange={(e) => setEarlyForm({ ...earlyForm, reason: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Confirmation Modals */}
      <ConfirmModal
        open={Boolean(approveId)}
        title="Approve Attendance Request?"
        desc="The employee's attendance for that day will be rewritten from this request and the request marked approved."
        confirmLabel="Approve"
        onClose={() => setApproveId(null)}
        onConfirm={handleApprove}
      />

      <ConfirmModal
        open={Boolean(rejectId)}
        title="Reject Request"
        desc="Please enter a rejection reason. The employee will see it."
        confirmLabel="Reject Request"
        danger
        onClose={() => {
          setRejectId(null);
          setRejectReason("");
        }}
        onConfirm={handleReject}
        requireReason
        reason={rejectReason}
        setReason={setRejectReason}
      />

      <style>{`
        .req-page { background: #f8fafc; margin: -24px -28px -40px; padding: 18px 26px 28px; min-height: calc(100vh - 62px); }

        .req-btn-outline { background: #fff; border: 1px solid #d1d5db; border-radius: 10px; padding: 8px 18px; font-size: 13.5px; font-weight: 600; color: #374151; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
        .req-btn-outline:hover { background: #f9fafb; }
        .req-btn-primary { background: #16233a; color: #fff; border: none; border-radius: 10px; padding: 9px 18px; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .req-btn-primary:hover { background: #0f172a; }

        .req-tabs { display: inline-flex; align-items: center; gap: 3px; background: #f4f4f6; border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 4px; margin-bottom: 16px; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
        .req-tab { border: 1.5px solid transparent; border-radius: 999px; padding: 5px 16px; font-size: 13px; font-weight: 500; color: #8e9baa; background: transparent; cursor: pointer; transition: all 0.15s ease; flex-shrink: 0; white-space: nowrap; }
        .req-tab.active { font-weight: 600; color: #000000; background: #ffffff; border-color: #000000; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }

        .req-card { background: #fff; border: 1px solid #e8edf3; border-radius: 16px; box-shadow: 0 1px 3px rgba(16,24,40,0.03); }
        .req-filter-card { border: none; padding: 14px 18px; margin-bottom: 16px; }

        .req-search-wrap { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 12px; min-width: 200px; }
        .req-search-input { border: none; background: transparent; font-size: 13px; color: #1e293b; outline: none; width: 100%; }

        .req-date-wrap { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 14px; font-size: 13px; color: #374151; min-width: 120px; cursor: pointer; }
        .req-date-native { position: absolute; right: 0; top: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

        .req-filter-dropdown { position: relative; display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0 12px; height: 35px; cursor: pointer; transition: all 0.15s ease; box-sizing: border-box; }
        .req-filter-dropdown:hover { border-color: #cbd5e1; background: #f1f5f9; }
        .req-filter-dropdown.active { border-color: #3b82f6; background: #eff6ff; }
        .req-filter-text { font-size: 13px; color: #374151; font-weight: 500; white-space: nowrap; user-select: none; }
        .req-filter-dropdown.active .req-filter-text { color: #1d4ed8; font-weight: 600; }
        .req-filter-arrow { color: #64748b; flex-shrink: 0; pointer-events: none; }
        .req-filter-dropdown.active .req-filter-arrow { color: #2563eb; }
        .req-filter-native-select { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

        .req-btn-clear { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 14px; font-size: 13px; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s ease; }
        .req-btn-clear:hover { background: #f8fafc; color: #111827; }

        .req-main-card { overflow: hidden; }
        .req-table { width: 100%; border-collapse: collapse; min-width: 1080px; font-size: 13.5px; }
        .req-table thead tr { background: #ffffff; border-bottom: 1px solid #e2e8f0; }
        .req-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7b8aa0; padding: 14px 16px; white-space: nowrap; }
        .req-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s ease; }
        .req-table tbody tr:hover { background: #f8fafc; }
        .req-table td { padding: 12px 16px; vertical-align: middle; }

        .req-id-link { background: transparent; border: none; font-family: inherit; font-size: 12.5px; font-weight: 600; color: #111827; text-decoration: underline; cursor: pointer; padding: 0; white-space: nowrap; }
        .req-type-pill { display: inline-block; font-size: 12px; font-weight: 500; border-radius: 999px; padding: 3px 12px; border: 1px solid; white-space: nowrap; }
        .req-date { font-family: inherit; font-size: 12.5px; color: #111827; white-space: nowrap; }
        .req-time { font-family: inherit; font-size: 12.5px; color: #374151; white-space: nowrap; }
        .req-reason { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #374151; }
        .req-status { display: inline-block; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 3px 12px; border: 1px solid; white-space: nowrap; }
        .req-detail-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; flex: 1; }
        .req-detail-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .req-detail-val { font-size: 14px; font-weight: 600; margin-top: 4px; color: #111827; }

        .req-btn-approve { background: #059669; color: #fff; border: none; border-radius: 8px; padding: 4px 12px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s ease; }
        .req-btn-approve:hover:not(:disabled) { background: #047857; }
        .req-btn-reject { background: #fff; border: 1px solid #d1d5db; border-radius: 8px; padding: 4px 12px; font-size: 12px; font-weight: 500; color: #475569; cursor: pointer; transition: background 0.15s ease; }
        .req-btn-reject:hover:not(:disabled) { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
        .req-btn-approve:disabled, .req-btn-reject:disabled { opacity: 0.5; cursor: not-allowed; }
        .req-btn-view { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px 12px; font-size: 12px; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s ease; }
        .req-btn-view:hover { background: #f8fafc; color: #111827; }
        @media (max-width: 1023px) {
          .req-page { margin: -16px -20px -24px; }
        }
        @media (max-width: 767px) {
          .req-page { margin: -12px -14px -20px; }
        }
        @media (max-width: 640px) {
          .req-page { padding: 14px 14px 22px; }
          .req-filter-card { padding: 12px 14px; }
          .req-search-wrap { flex: 1 1 100%; min-width: 0; }
        }
      `}</style>
    </div>
  );
}
