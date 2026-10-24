import { useEffect, useMemo, useState, useRef } from "react";
import { pushHrmsSettings, pullHrmsSettings } from "../../../services/hrmsSync";
import { pullAuditTrail } from "../../../services/auditTrail";
import {
  UserCheck,
  Plane,
  Briefcase,
  UserPlus,
  ClipboardCheck,
  CalendarDays,
  Calendar as CalendarIcon,
  X,
  Zap,
  ChevronDown,
  Plus,
  Check,
  Bell,
  CheckCheck,
  Search,
  Trash2,
  RefreshCw,
  Settings,
  Laptop,
  Home,
  Clock,
  Receipt,
  Key,
  GraduationCap,
  LogOut,
  HeartPulse,
  FileCheck,
  HelpCircle,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import Modal from "../../../components/ui/Modal";
import { useAppStore } from "../../../stores/appStore";
import { useAssetStore } from "../../../stores/assetStore";
import AnalyticsVolumeChart from "./AnalyticsVolumeChart";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

const MODULE_META = {
  "Leave Management": { Icon: Plane, bg: "#fef3c7", fg: "#b45309" },
  Performance: { Icon: ClipboardCheck, bg: "#dcfce7", fg: "#15803d" },
  "HR Admin": { Icon: UserPlus, bg: "#dbeafe", fg: "#1d4ed8" },
  "Payroll Core": { Icon: Briefcase, bg: "#f3e8ff", fg: "#7c3aed" },
  Schedule: { Icon: CalendarDays, bg: "#e0f2fe", fg: "#0369a1" },
  "Asset & IT": { Icon: Laptop, bg: "#e0e7ff", fg: "#4338ca" },
  System: { Icon: Zap, bg: "#f1f5f9", fg: "#475569" },
};


const DEFAULT_REQUEST_TYPES = [
  "Casual Leave",
  "Sick / Medical Leave",
  "Annual / Earned Leave",
  "Work From Home (WFH)",
  "Attendance Regularization",
  "Asset Request (Hardware / Laptop / Accessories)",
  "Software & Tool License Request",
  "Expense Reimbursement",
  "Travel & Conveyance Request",
  "Document & Bonafide Certificate",
  "Shift Change Request",
  "Overtime Approval",
  // "Training & Upskilling Request", // Hidden: Training commented out
  "HR Grievance / Query",
  "Resignation / Separation Request",
];

function loadRequestTypes() {
  try {
    const stored = null; // replaced by the tenant setting once it loads
    if (stored) {
      const parsed = stored;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_REQUEST_TYPES;
}

function getRequestTypeIcon(type = "") {
  const lower = type.toLowerCase();
  if (lower.includes("sick") || lower.includes("medical")) return HeartPulse;
  if (lower.includes("annual") || lower.includes("earned") || lower.includes("vacation")) return Plane;
  if (lower.includes("casual")) return CalendarDays;
  if (lower.includes("wfh") || lower.includes("work from home")) return Home;
  if (lower.includes("attendance") || lower.includes("regularization")) return Clock;
  if (lower.includes("software") || lower.includes("license") || lower.includes("tool")) return Key;
  if (lower.includes("asset") || lower.includes("hardware") || lower.includes("laptop")) return Laptop;
  if (lower.includes("expense") || lower.includes("reimburse")) return Receipt;
  if (lower.includes("travel") || lower.includes("conveyance")) return Plane;
  if (lower.includes("document") || lower.includes("bonafide") || lower.includes("certificate")) return FileCheck;
  if (lower.includes("shift")) return RefreshCw;
  if (lower.includes("overtime")) return Clock;
  if (lower.includes("training") || lower.includes("upskilling")) return GraduationCap;
  if (lower.includes("resignation") || lower.includes("separation")) return LogOut;
  if (lower.includes("grievance") || lower.includes("query")) return HelpCircle;
  return Zap;
}

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m > 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d > 1 ? "s" : ""} ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * The activity strip is the audit trail (`GET /audit/`), not a local log — an
 * action taken by a colleague has to show up here too.
 */
function loadActivities() {
  return [];
}

const ACTIVITY = [];

export default function HRMSDashboard() {
  const setToast = useAppStore((s) => s.setToast);

  const [showNotice, setShowNotice] = useState(true);

  // Dynamic current date helpers
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth();
  const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const thisMonthName = monthNamesShort[currentMonthIdx];
  const lastMonthDate = new Date(currentYear, currentMonthIdx - 1, 1);
  const lastMonthName = monthNamesShort[lastMonthDate.getMonth()];
  const lastMonthYear = lastMonthDate.getFullYear();
  const daysInThisMonth = new Date(currentYear, currentMonthIdx + 1, 0).getDate();
  const daysInLastMonth = new Date(lastMonthYear, lastMonthDate.getMonth() + 1, 0).getDate();
  const pad = (n) => String(n).padStart(2, "0");

  const initialRangeLabel = `${thisMonthName} 1 – ${thisMonthName} ${daysInThisMonth}, ${currentYear}`;
  const initialStart = `${currentYear}-${pad(currentMonthIdx + 1)}-01`;
  const initialEnd = `${currentYear}-${pad(currentMonthIdx + 1)}-${pad(daysInThisMonth)}`;
  const initialLeaveDate = `${currentYear}-${pad(currentMonthIdx + 1)}-${pad(today.getDate())}`;

  // Date range filter state
  const [dateRangeLabel, setDateRangeLabel] = useState(initialRangeLabel);
  const [showDateModal, setShowDateModal] = useState(false);
  const [customStart, setCustomStart] = useState(initialStart);
  const [customEnd, setCustomEnd] = useState(initialEnd);

  // Handover notes state
  const [showHandoverModal, setShowHandoverModal] = useState(false);

  // Quick request form & configurable types
  const [requestTypes, setRequestTypes] = useState(loadRequestTypes);
  const [showManageTypesModal, setShowManageTypesModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [leaveType, setLeaveType] = useState(() => {
    const list = loadRequestTypes();
    return list[0] || "Casual Leave";
  });
  const [leaveDate, setLeaveDate] = useState(initialLeaveDate);
  const [leaveNote, setLeaveNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [requestDropdownOpen, setRequestDropdownOpen] = useState(false);
  const [requestSearch, setRequestSearch] = useState("");
  const [openUpward, setOpenUpward] = useState(false);
  const requestDropdownRef = useRef(null);

  const toggleDropdown = () => {
    if (!requestDropdownOpen && requestDropdownRef.current) {
      const rect = requestDropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 240);
    }
    setRequestDropdownOpen((prev) => !prev);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (requestDropdownRef.current && !requestDropdownRef.current.contains(event.target)) {
        setRequestDropdownOpen(false);
      }
    }
    if (requestDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [requestDropdownOpen]);

  const filteredRequestTypes = useMemo(() => {
    if (!requestSearch.trim()) return requestTypes;
    return requestTypes.filter((t) =>
      t.toLowerCase().includes(requestSearch.toLowerCase())
    );
  }, [requestTypes, requestSearch]);

  // The request catalogue is a tenant setting (`/hrms/settings/`), so the menu
  // is the same for everyone raising a request.
  useEffect(() => {
    if (requestTypes.length === 0) return;
    pushHrmsSettings({ quickRequestTypes: requestTypes }).catch((err) => {
      console.warn("[HRMS] request types not saved:", err?.message || err);
    });
  }, [requestTypes]);

  // Recent Activity — working, minimal, user-friendly
  const [activities, setActivities] = useState(loadActivities);
  const [activityTab, setActivityTab] = useState("All");
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [activityQuery, setActivityQuery] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    pullAuditTrail({ limit: 50 }).then((rows) => {
      if (cancelled || !rows) return;
      setActivities(rows.map((row) => ({
        id: row.id,
        actor: row.actorName || row.actor || 'System',
        action: row.description || row.action || '',
        module: row.entityType || 'System',
        ts: Date.parse(row.createdAt || row.at) || Date.now(),
        read: false,
      })));
    });
    return () => { cancelled = true; };
  }, []);

  // Re-render relative timestamps every minute
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const pushActivity = (actor, action, module) => {
    setActivities((prev) =>
      [{ id: `a${Date.now()}`, actor, action, module, ts: Date.now(), read: false }, ...prev].slice(0, 50)
    );
  };

  const activityModules = useMemo(
    () => ["All", ...Array.from(new Set(activities.map((a) => a.module)))],
    [activities]
  );
  const unreadCount = activities.filter((a) => !a.read).length;
  const visibleActivities = useMemo(() => {
    return activities.slice(0, 5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, tick]);
  const modalActivities = useMemo(() => {
    const q = activityQuery.trim().toLowerCase();
    return activities.filter((a) => {
      const matchTab = activityTab === "All" || a.module === activityTab;
      const matchQ = !q || `${a.actor} ${a.action} ${a.module}`.toLowerCase().includes(q);
      return matchTab && matchQ;
    });
  }, [activities, activityTab, activityQuery]);

  const markAllRead = () => setActivities((prev) => prev.map((a) => ({ ...a, read: true })));
  const markOneRead = (id) => setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
  const removeActivity = (id) => setActivities((prev) => prev.filter((a) => a.id !== id));
  const clearActivities = () => setActivities([]);
  const resetActivities = () => {
    const seed = [];
    setActivities(seed);
    setActivityTab("All");
    setActivityQuery("");
  };

  const handleAddRequestType = (e) => {
    e?.preventDefault();
    const trimmed = newTypeName.trim();
    if (!trimmed) {
      return setToast("Please enter a request type name.", "error");
    }
    if (requestTypes.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      return setToast("This request type already exists.", "error");
    }
    setRequestTypes((prev) => [...prev, trimmed]);
    setLeaveType(trimmed);
    setNewTypeName("");
    setToast(`Added "${trimmed}" to request types.`);
  };

  const handleRemoveRequestType = (typeToRemove) => {
    if (requestTypes.length <= 1) {
      return setToast("You must keep at least one request type.", "error");
    }
    const updated = requestTypes.filter((t) => t !== typeToRemove);
    setRequestTypes(updated);
    if (leaveType === typeToRemove) {
      setLeaveType(updated[0] || "");
    }
    setToast(`Removed "${typeToRemove}".`);
  };

  const handleResetRequestTypes = () => {
    setRequestTypes(DEFAULT_REQUEST_TYPES);
    setLeaveType(DEFAULT_REQUEST_TYPES[0]);
    setToast("Request types reset to default list.");
  };

  const handleSelectRequestType = (e) => {
    const val = e.target.value;
    if (val === "__manage__") {
      setShowManageTypesModal(true);
      return;
    }
    setLeaveType(val);
  };

  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const [lastSubmittedAssetReqId, setLastSubmittedAssetReqId] = useState(null);

  const handleQuickRequest = () => {
    if (!leaveDate) return setToast("Please pick a date for your request.", "error");
    if (!leaveType) return setToast("Please select a request type.", "error");
    setSubmitted(true);
    const lower = leaveType.toLowerCase();
    const isAsset =
      lower.includes("asset") ||
      lower.includes("software") ||
      lower.includes("hardware") ||
      lower.includes("laptop") ||
      lower.includes("monitor") ||
      lower.includes("equipment") ||
      lower.includes("tool") ||
      lower.includes("peripherals");

    const mod = lower.includes("leave") || lower.includes("wfh") || lower.includes("attendance")
      ? "Leave Management"
      : isAsset
      ? "Asset & IT"
      : lower.includes("expense") || lower.includes("payroll") || lower.includes("reimburse")
      ? "Payroll Core"
      : "HR Admin";

    // If it's an asset-related request, register it directly in useAssetStore
    if (isAsset) {
      const category =
        lower.includes("laptop") ? "Laptop"
        : lower.includes("monitor") ? "Monitor"
        : lower.includes("software") || lower.includes("license") ? "Software / License"
        : lower.includes("phone") || lower.includes("mobile") ? "Mobile"
        : lower.includes("headphone") || lower.includes("peripheral") ? "Audio / Peripherals"
        : "Workstation";

      // Filed as an "Other" request for the signed-in employee; HR sees it
      // under Asset Setup › Employee Requests.
      useAssetStore.getState().addRequest({
        requestType: "Other",
        category,
        assetName: leaveType,
        reason: leaveNote.trim() || `Submitted via HRMS Dashboard Quick Request for ${leaveDate}.`,
        priority: "Medium",
      })
        .then((newReq) => setLastSubmittedAssetReqId(newReq?.id || null))
        .catch((err) => setToast(`Asset request not submitted — ${err?.message || "server error"}`));
    } else {
      setLastSubmittedAssetReqId(null);
    }

    pushActivity("You", `requested ${leaveType} for ${leaveDate.split("-").reverse().join("-")}.`, mod);
    setToast(`${leaveType} request submitted for approval!`);
    setLeaveNote("");
    setTimeout(() => {
      setSubmitted(false);
      setLastSubmittedAssetReqId(null);
    }, 5000);
  };

  const handleApplyDateRange = (label) => {
    setDateRangeLabel(label);
    setShowDateModal(false);
    setToast(`Dashboard filter updated: ${label}`);
  };

  return (
    <div className="hrms-dash">
      <PageHeader
        title="Dashboard Overview"
        guide={hrmsGuides.dashboard}
        actions={
          <button
            type="button"
            onClick={() => setShowDateModal(true)}
            className="hrms-date-btn"
            title="Click to select date range"
          >
            <CalendarIcon size={15} style={{ color: "#475569" }} />
            {dateRangeLabel}
          </button>
        }
      />

      {/* Delegation notice */}
      {showNotice && (
        <div className="hrms-notice">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <UserCheck size={17} style={{ color: "#475569" }} />
            <span>
              <strong>Delegation Notice:</strong> You&apos;re covering for Ayesha Khan until Oct 14 —{" "}
              <u
                style={{ cursor: "pointer", fontWeight: 600 }}
                onClick={() => setShowHandoverModal(true)}
              >
                View handover notes →
              </u>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowNotice(false)}
            aria-label="Dismiss notice"
            className="hrms-notice-x"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* Analytics Volume Chart (Workforce, Attendance, Leave, Payroll, etc.) */}
      <AnalyticsVolumeChart />

      {/* Main grid - Recent Activity + Quick Request */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>

          {/* Recent Activity — live, minimal */}
          <div className="hrms-card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 className="hrms-h3" style={{ fontSize: 15.5, display: "flex", alignItems: "center", gap: 8 }}>
                Recent Activity
                {unreadCount > 0 && <span className="hrms-unread">{unreadCount} new</span>}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {unreadCount > 0 && (
                  <button type="button" className="hrms-iconbtn" title="Mark all as read" onClick={markAllRead}>
                    <CheckCheck size={15} />
                  </button>
                )}
                <button type="button" className="hrms-viewall" onClick={() => setShowAllActivity(true)}>
                  View All
                </button>
              </div>
            </div>

            <div style={{ position: "relative", paddingLeft: 2, marginTop: 6 }}>
              <div className="hrms-timeline-line" />
              <div style={{ display: "grid", gap: 14 }}>
                {visibleActivities.length === 0 && (
                  <div className="hrms-aempty">
                    <Bell size={18} style={{ color: "#94a3b8" }} />
                    <p>No activity yet. New leave requests, schedules and updates will appear here.</p>
                    <button type="button" className="hrms-export" onClick={resetActivities}>
                      <RefreshCw size={13} /> Restore sample
                    </button>
                  </div>
                )}
                {visibleActivities.map((a) => {
                  const meta = MODULE_META[a.module] || MODULE_META.System;
                  const MIcon = meta.Icon;
                  return (
                    <div
                      key={a.id}
                      className="hrms-arow"
                      onClick={() => {
                        markOneRead(a.id);
                        if (a.module === "Asset & IT") {
                          navigate("/hrms/assets?tab=requests");
                        }
                      }}
                      title={a.module === "Asset & IT" ? "Click to view Asset Requests" : "Click to mark as read"}
                      style={{ cursor: "pointer" }}
                    >
                      <span className="hrms-aicon" style={{ background: meta.bg, color: meta.fg }}>
                        <MIcon size={14} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.45 }}>
                          <strong style={{ color: "#16233a" }}>{a.actor}</strong> {a.action}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#7b8aa0", display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{timeAgo(a.ts)} · {a.module}</span>
                          {!a.read && <span className="hrms-bluedot" />}
                          {a.module === "Asset & IT" && (
                            <span style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}>→ View</span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="hrms-ax"
                        aria-label="Dismiss"
                        onClick={(e) => { e.stopPropagation(); removeActivity(a.id); }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            {activities.length > 5 && (
              <button type="button" className="hrms-afull" onClick={() => setShowAllActivity(true)}>
                View all {activities.length} updates →
              </button>
            )}
          </div>

          {/* Quick Request */}
          <div className="hrms-card" style={{ padding: "16px 18px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 className="hrms-h3" style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={16} style={{ color: "#334155" }} /> Quick Request
              </h3>
              <button
                type="button"
                onClick={() => setShowManageTypesModal(true)}
                className="hrms-manage-pill-btn"
                title="HR Admin: Add or remove request types"
              >
                <Settings size={12} /> Manage Types
              </button>
            </div>
            {/* Custom Request Type Dropdown */}
            <div className="relative mb-2" ref={requestDropdownRef}>
              <button
                type="button"
                onClick={toggleDropdown}
                className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl border text-[13px] font-medium transition-all cursor-pointer shadow-2xs focus:outline-none ${
                  requestDropdownOpen
                    ? "border-primary ring-2 ring-primary/15 bg-card text-text"
                    : "border-border bg-soft hover:bg-card-hover text-text"
                }`}
                aria-haspopup="listbox"
                aria-expanded={requestDropdownOpen}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  {(() => {
                    const TypeIcon = getRequestTypeIcon(leaveType);
                    return <TypeIcon size={15} className="text-primary shrink-0" />;
                  })()}
                  <span className="truncate">{leaveType || "Select Request Type..."}</span>
                </div>
                <ChevronDown
                  size={15}
                  className={`text-muted transition-transform duration-200 shrink-0 ${
                    requestDropdownOpen ? "rotate-180 text-primary" : ""
                  }`}
                />
              </button>

              {requestDropdownOpen && (
                <div
                  className={`absolute ${
                    openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
                  } left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden backdrop-blur-md animate-in fade-in-0 duration-150`}
                >
                  {/* Integrated sleek search filter */}
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-soft/40">
                    <Search size={13} className="text-muted shrink-0" />
                    <input
                      type="text"
                      value={requestSearch}
                      onChange={(e) => setRequestSearch(e.target.value)}
                      placeholder="Search request type..."
                      className="w-full bg-transparent text-[12px] text-text placeholder:text-muted focus:outline-none border-none p-0"
                      autoFocus
                    />
                    {requestSearch && (
                      <button
                        type="button"
                        onClick={() => setRequestSearch("")}
                        className="text-muted hover:text-text p-0.5 rounded cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* List of request options */}
                  <div className="max-h-40 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                    {filteredRequestTypes.length === 0 ? (
                      <div className="px-3 py-3 text-center text-[12px] text-muted">
                        No request types found
                      </div>
                    ) : (
                      filteredRequestTypes.map((type) => {
                        const ItemIcon = getRequestTypeIcon(type);
                        const isSelected = leaveType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setLeaveType(type);
                              setRequestDropdownOpen(false);
                              setRequestSearch("");
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[12.5px] rounded-lg transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-text hover:bg-soft"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <ItemIcon
                                size={14}
                                className={isSelected ? "text-primary shrink-0" : "text-muted shrink-0"}
                              />
                              <span className="truncate">{type}</span>
                            </div>
                            {isSelected && <Check size={14} className="text-primary shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Manage Types Action at bottom */}
                  <div className="border-t border-border p-1 bg-soft/40">
                    <button
                      type="button"
                      onClick={() => {
                        setRequestDropdownOpen(false);
                        setShowManageTypesModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px] font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <Settings size={13} className="shrink-0" />
                      <span>Manage Request Types (HR)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="hrms-input hrms-date-wrap mb-2" style={{ padding: "8px 12px" }}>
              <span>{leaveDate.split("-").reverse().join(" - ").replaceAll(" - ", "-")}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 0, position: "relative" }}>
                <CalendarIcon size={14} style={{ color: "#334155", pointerEvents: "none" }} />
                <input
                  type="date"
                  value={leaveDate}
                  onChange={(e) => e.target.value && setLeaveDate(e.target.value)}
                  className="hrms-date-native"
                  aria-label="Select date"
                />
              </span>
            </div>
            <textarea
              value={leaveNote}
              onChange={(e) => setLeaveNote(e.target.value)}
              placeholder="Provide brief context..."
              rows={2}
              className="hrms-input hrms-area"
              style={{ minHeight: "52px", resize: "none", marginBottom: "8px", padding: "8px 12px" }}
            />
            <button type="button" onClick={handleQuickRequest} className="hrms-submit" style={{ padding: "10px" }}>
              {submitted ? "Request Submitted ✓" : "Submit Request"}
            </button>
            {submitted && (
              <div style={{ margin: "8px 0 0", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 12, color: "#059669", fontWeight: 500 }}>
                  {leaveType} for {leaveDate} sent for approval.
                </p>
                {lastSubmittedAssetReqId && (
                  <Link
                    to="/hrms/assets?tab=requests"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 4,
                      fontSize: 11.5,
                      color: "#2563eb",
                      fontWeight: 600,
                      textDecoration: "underline",
                    }}
                  >
                    View in Asset Setup & Requests ({lastSubmittedAssetReqId}) →
                  </Link>
                )}
              </div>
            )}
          </div>
      </div>

      {/* Date Range Modal */}
      <Modal
        isOpen={showDateModal}
        onClose={() => setShowDateModal(false)}
        title="Select Date Range"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setShowDateModal(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleApplyDateRange(`${customStart} – ${customEnd}`)}
            >
              Apply Custom Range
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 16 }}>
          <label className="form-label">Preset Ranges:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn-outline"
              style={{ fontSize: 13, textAlign: "left", justifyContent: "flex-start" }}
              onClick={() => handleApplyDateRange(`${thisMonthName} 1 – ${thisMonthName} ${daysInThisMonth}, ${currentYear}`)}
            >
              {thisMonthName} 1 – {thisMonthName} {daysInThisMonth}, {currentYear} (This Month)
            </button>
            <button
              type="button"
              className="btn-outline"
              style={{ fontSize: 13, textAlign: "left", justifyContent: "flex-start" }}
              onClick={() => handleApplyDateRange(`${lastMonthName} 1 – ${lastMonthName} ${daysInLastMonth}, ${lastMonthYear}`)}
            >
              {lastMonthName} 1 – {lastMonthName} {daysInLastMonth}, {lastMonthYear} (Last Month)
            </button>
            <button
              type="button"
              className="btn-outline"
              style={{ fontSize: 13, textAlign: "left", justifyContent: "flex-start" }}
              onClick={() => handleApplyDateRange(`Q${Math.floor(currentMonthIdx / 3) + 1} ${currentYear}`)}
            >
              Q{Math.floor(currentMonthIdx / 3) + 1} {currentYear}
            </button>
            <button
              type="button"
              className="btn-outline"
              style={{ fontSize: 13, textAlign: "left", justifyContent: "flex-start" }}
              onClick={() => handleApplyDateRange(`Year ${currentYear}`)}
            >
              Year {currentYear}
            </button>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "4px 0" }} />

          <label className="form-label">Custom Range:</label>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Handover Notes Modal */}
      <Modal
        isOpen={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
        title="Delegation Handover Notes — Ayesha Khan"
        footer={
          <button type="button" className="btn-primary" onClick={() => setShowHandoverModal(false)}>
            Acknowledge &amp; Close
          </button>
        }
      >
        <div style={{ display: "grid", gap: 14, fontSize: "13.5px", color: "#334155" }}>
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 12 }}>
            <strong style={{ color: "#1e40af" }}>Delegation Period:</strong> Oct 1, 2024 – Oct 14, 2024
            <br />
            <span style={{ fontSize: 12.5, color: "#3b82f6" }}>
              Covering Manager: Current User (HR Ops Lead)
            </span>
          </div>

          <div>
            <h4 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#111827" }}>
              Key Responsibilities Delegated:
            </h4>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
              <li>Approve pending annual &amp; casual leave requests for People Ops team.</li>
              <li>Conduct final round onboarding reviews for Q4 new joiners.</li>
              <li>Verify attendance regularization requests prior to payroll cutoff (Oct 12).</li>
              <li>Escalate critical grievances directly to Head of HR.</li>
            </ul>
          </div>

          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
            <strong style={{ color: "#111827" }}>Emergency Contact:</strong>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              Email: ayesha.k@evenmore.in | Slack: @ayesha_hr (Urgent escalations only)
            </p>
          </div>
        </div>
      </Modal>

      {/* Recent Activity — View All */}
      <Modal
        isOpen={showAllActivity}
        onClose={() => setShowAllActivity(false)}
        title={`Recent Activity (${modalActivities.length})`}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={clearActivities} disabled={activities.length === 0}>
              Clear all
            </button>
            <button type="button" className="btn-primary" onClick={markAllRead} disabled={unreadCount === 0}>
              Mark all read
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "#94a3b8" }} />
              <input
                className="form-input"
                style={{ paddingLeft: 30 }}
                placeholder="Search activity…"
                value={activityQuery}
                onChange={(e) => setActivityQuery(e.target.value)}
              />
            </div>
            <select className="form-select" style={{ maxWidth: 160 }} value={activityTab} onChange={(e) => setActivityTab(e.target.value)}>
              {activityModules.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 10, maxHeight: 380, overflowY: "auto" }}>
            {modalActivities.length === 0 && (
              <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: 16 }}>
                No matching activity.
              </p>
            )}
            {modalActivities.map((a) => {
              const meta = MODULE_META[a.module] || MODULE_META.System;
              const MIcon = meta.Icon;
              return (
                <div
                  key={a.id}
                  className="hrms-arow"
                  style={{ background: a.read ? "#fff" : "#f8fafc", cursor: "pointer" }}
                  onClick={() => {
                    markOneRead(a.id);
                    if (a.module === "Asset & IT") {
                      setShowAllActivity(false);
                      navigate("/hrms/assets?tab=requests");
                    }
                  }}
                  title={a.module === "Asset & IT" ? "Click to view Asset Requests" : "Click to mark as read"}
                >
                  <span className="hrms-aicon" style={{ background: meta.bg, color: meta.fg }}>
                    <MIcon size={14} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "#334155" }}>
                      <strong style={{ color: "#16233a" }}>{a.actor}</strong> {a.action}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#7b8aa0" }}>
                      {timeAgo(a.ts)} · {a.module} {!a.read && "· Unread"}
                      {a.module === "Asset & IT" && (
                        <span style={{ fontSize: 11, color: "#2563eb", fontWeight: 600, marginLeft: 6 }}>→ View</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="hrms-ax"
                    aria-label="Remove"
                    onClick={(e) => { e.stopPropagation(); removeActivity(a.id); }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Manage Request Types Modal (HR) */}
      <Modal
        isOpen={showManageTypesModal}
        onClose={() => setShowManageTypesModal(false)}
        title="Manage Quick Request Types (HR)"
        footer={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <button
              type="button"
              className="btn-outline"
              style={{ fontSize: 12.5 }}
              onClick={handleResetRequestTypes}
            >
              Reset to Defaults
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowManageTypesModal(false)}
            >
              Done
            </button>
          </div>
        }
      >
        <div style={{ display: "grid", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
            Customize the list of requests available to employees and managers. You can add new custom request types or remove existing ones.
          </p>

          {/* Add New Type Form */}
          <form
            onSubmit={handleAddRequestType}
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <input
              className="form-input"
              style={{ flex: 1 }}
              placeholder="e.g. Relocation Assistance, Maternity / Paternity Leave..."
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{ whiteSpace: "nowrap", padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Plus size={15} /> Add Type
            </button>
          </form>

          {/* List of Types */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Configured Request Types ({requestTypes.length})
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: 6,
                maxHeight: 280,
                overflowY: "auto",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 8,
                background: "#f8fafc",
              }}
            >
              {requestTypes.map((t) => (
                <div
                  key={t}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 12px",
                    background: "#ffffff",
                    border: "1px solid #edf2f7",
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{t}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRequestType(t)}
                    title={`Delete "${t}"`}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: 4,
                      borderRadius: 6,
                      display: "grid",
                      placeItems: "center",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#ef4444";
                      e.currentTarget.style.backgroundColor = "#fee2e2";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#94a3b8";
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <style>{`
        .hrms-dash { background: #f7f9fc; margin: -24px -28px -40px; padding: 18px 26px 28px; min-height: calc(100vh - 62px); }
        .hrms-manage-pill-btn { display: inline-flex; align-items: center; gap: 5px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 999px; padding: 4px 10px; font-size: 11.5px; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.15s ease; }
        .hrms-manage-pill-btn:hover { background: #e2e8f0; color: #0f172a; border-color: #cbd5e1; }
        .hrms-crumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #6b7a90; margin-bottom: 10px; }
        .hrms-title-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
        .hrms-title { margin: 0; font-size: 24px; font-weight: 800; color: #16233a; letter-spacing: -0.01em; }
        .hrms-date-btn { display: inline-flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 500; color: #334155; box-shadow: 0 1px 2px rgba(16,24,40,0.05); cursor: pointer; }
        .hrms-add-btn { background: #1b2b4a; color: #fff; border: none; border-radius: 10px; padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .hrms-notice { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #eef1f6; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; font-size: 13.5px; color: #1e293b; margin-bottom: 16px; }
        .hrms-notice-x { border: 0; background: transparent; display: grid; place-items: center; color: #334155; cursor: pointer; }
        .hrms-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; margin-bottom: 14px; }
        .hrms-stat-card { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; padding: 16px 18px; box-shadow: 0 1px 2px rgba(16,24,40,0.03); }
        .hrms-pill { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
        .hrms-main-grid { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 16px; align-items: start; }
        .hrms-card { background: #fff; border: 1px solid #e8edf3; border-radius: 16px; box-shadow: 0 1px 3px rgba(16,24,40,0.03); }
        .hrms-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px 14px; flex-wrap: wrap; }
        .hrms-h3 { margin: 0; font-size: 16px; font-weight: 750; color: #111827; }
        .hrms-sub { margin: 4px 0 0; font-size: 12.5px; color: #6b7280; }
        .hrms-tabs { display: inline-flex; align-items: center; gap: 3px; background: #f4f4f6; border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 4px; }
        .hrms-tab { border: 1.5px solid transparent; border-radius: 999px; padding: 4px 14px; font-size: 12.5px; font-weight: 500; color: #8e9baa; background: transparent; cursor: pointer; transition: all 0.15s ease; }
        .hrms-tab.active { font-weight: 600; color: #000000; background: #ffffff; border-color: #000000; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .hrms-export { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #d1d5db; border-radius: 9px; padding: 6px 14px; font-size: 12.5px; font-weight: 600; color: #374151; cursor: pointer; transition: background 0.15s ease; }
        .hrms-export:hover { background: #f9fafb; }
        .hrms-table { width: 100%; border-collapse: collapse; min-width: 640px; font-size: 13.5px; }
        .hrms-table thead tr { background: #ffffff; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #e2e8f0; }
        .hrms-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7b8aa0; padding: 12px 16px; white-space: nowrap; }
        .hrms-table tbody tr { border-bottom: 1px solid #f1f5f9; }
        .hrms-table td { padding: 13px 16px; }
        .hrms-time { font-family: inherit; font-size: 12.5px; font-weight: 600; color: #334155; white-space: nowrap; }
        .hrms-dept { color: #64748b; white-space: nowrap; }
        .hrms-avatar { width: 30px; height: 30px; border-radius: 999px; object-fit: cover; }
        .hrms-event { display: inline-block; font-size: 12px; font-weight: 500; color: #374151; background: #f3f4f6; border: none; border-radius: 999px; padding: 4px 13px; white-space: nowrap; }
        .hrms-status { display: inline-block; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 4px 13px; border: 1px solid; white-space: nowrap; }
        .hrms-viewall { border: 0; background: transparent; font-size: 12.5px; font-weight: 600; color: #475569; cursor: pointer; }
        .hrms-viewall:hover { color: #111827; }
        .hrms-timeline-line { position: absolute; left: 20px; top: 10px; bottom: 10px; width: 1.5px; background: #e2e8f0; }
        .hrms-unread { font-size: 10.5px; font-weight: 700; background: #1b2b4a; color: #fff; border-radius: 999px; padding: 2px 8px; }
        .hrms-iconbtn { border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; width: 26px; height: 26px; display: grid; place-items: center; color: #475569; cursor: pointer; }
        .hrms-iconbtn:hover { background: #f8fafc; color: #111827; }
        .hrms-afilter { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
        .hrms-achip { border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; font-size: 11.5px; font-weight: 600; border-radius: 999px; padding: 4px 11px; cursor: pointer; }
        .hrms-achip.active { background: #111f36; border-color: #111f36; color: #fff; }
        .hrms-arow { display: flex; gap: 10px; position: relative; align-items: flex-start; border: 1px solid transparent; border-radius: 10px; padding: 6px; margin: 0 -6px; cursor: pointer; }
        .hrms-arow:hover { background: #f8fafc; border-color: #f1f5f9; }
        .hrms-arow:hover .hrms-ax { opacity: 1; }
        .hrms-aicon { width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; flex-shrink: 0; z-index: 1; }
        .hrms-bluedot { width: 7px; height: 7px; border-radius: 999px; background: #2563eb; display: inline-block; }
        .hrms-ax { border: 0; background: transparent; color: #94a3b8; cursor: pointer; opacity: 0; padding: 4px; border-radius: 6px; }
        .hrms-ax:hover { color: #ef4444; background: #fef2f2; opacity: 1; }
        .hrms-aempty { text-align: center; padding: 18px 10px; display: grid; gap: 8px; justify-items: center; }
        .hrms-aempty p { margin: 0; font-size: 12.5px; color: #64748b; line-height: 1.5; }
        .hrms-afull { margin-top: 12px; width: 100%; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 8px; font-size: 12.5px; font-weight: 600; color: #334155; cursor: pointer; }
        .hrms-afull:hover { background: #eef2f7; }
        .hrms-input { width: 100%; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 10px 12px; font-size: 13px; color: #334155; margin-bottom: 10px; outline: none; box-sizing: border-box; transition: all 0.15s ease; }
        .hrms-input:focus { border-color: #94a3b8; background: #fff; }
        .hrms-area { resize: none; margin-bottom: 12px; color: #334155; }
        .hrms-submit { width: 100%; background: #19273c; color: #fff; border: 0; border-radius: 10px; padding: 12px; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background 0.15s ease; }
        .hrms-submit:hover { background: #0f172a; }
        .hrms-date-wrap { display: flex; align-items: center; justify-content: space-between; }
        .hrms-date-native { position: absolute; right: -6px; top: -6px; width: 32px; height: 28px; opacity: 0; cursor: pointer; }
        .hrms-date-native::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 1; }
        .hrms-select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230f172a' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; background-size: 13px; padding-right: 32px; }
        .hrms-select:focus { border-color: #94a3b8; background-color: #fff; }
        .hrms-select option { padding: 8px 12px; font-size: 13px; color: #1e293b; }
        .hrms-select option:checked { background: #2563eb; color: #fff; }
        @media (max-width: 1100px) {
          .hrms-stat-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .hrms-main-grid { grid-template-columns: minmax(0,1fr); }
        }
        @media (max-width: 1023px) {
          .hrms-dash { margin: -16px -20px -24px; }
        }
        @media (max-width: 767px) {
          .hrms-dash { margin: -12px -14px -20px; }
        }
        @media (max-width: 640px) {
          .hrms-stat-grid { grid-template-columns: minmax(0,1fr); }
          .hrms-dash { padding: 14px 14px 22px; }
          .hrms-card-head { padding: 14px 14px 12px; }
          .hrms-tabs { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
          .hrms-tab { flex-shrink: 0; white-space: nowrap; }
        }
      `}</style>
    </div>
  );
}
