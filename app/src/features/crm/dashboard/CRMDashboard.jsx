import CrmKpiCard from '../common/CrmKpiCard';
import PageHeader from "../../../components/ui/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, UserPlus, Clock, TrendingUp, DollarSign, Search, Mail, Phone, CalendarDays, FileText, ClipboardList, Video, Send, CheckCircle2, ArrowRight, AlertTriangle, Building2, RotateCcw, PhoneCall } from "lucide-react";
import { toISODate, getCurrentISODate } from "../../../utils/dateUtils";
import { useCrmStore } from "../../../stores/crmStore";
import { initials, describeError, pullDashboard as pullCrmDashboard } from "../../../services/crmSync";
import { useERP } from "../../../context/ERPContext";
import { useAppStore } from "../../../stores/appStore";
import { CRM_TEAM_MEMBERS } from "../../../services/leadStageAutomation";
import { completeTaskWithOutcome, resolveLeadForTask, NEXT_ACTION_LABELS } from "../../../services/taskCompletionService";
import CompleteTaskModal from "../tasks/CompleteTaskModal";
import CreateLeadModal from "../leads/CreateLeadModal";
import LogCallModal from "./LogCallModal";
import { runLeadStageAutomation } from "../../../services/leadStageAutomation";
import { emitCrmEvent, CRM_EVENT_TYPES } from "../../../services/crmEventNotifications";
import { buildLeadPayload } from "../leads/leadPayload";
const DEAL_STORAGE_KEY = "crm-deals-v1";
const TASK_STORAGE_KEY = "crm-tasks-v1";
// Open pipeline stages shown on the dashboard (Revised / Declined are retired).
const DEAL_STAGES = ["Draft", "Sent", "Open"];
const SOURCE_COLORS = ["#2f6fed", "#7c3aed", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#64748b"];
const AVATAR_COLORS = ["#2f6fed", "#7c3aed", "#059669", "#ea580c", "#db2777", "#0891b2", "#4f46e5"];
const PIPELINE_BG = ["#eef4ff", "#f5f0ff", "#fff7e8", "#eef4ff", "#ecfdf5"];
const PIPELINE_FG = ["#2f6fed", "#7c3aed", "#b45309", "#2f6fed", "#059669"];
/** Lower-cased text, safe on a field the server left unset. */
function text(value) {
  return String(value ?? '').toLowerCase();
}

function getTaskBucket(t, todayISO) {
  if (t?.status === 'Completed') return 'Completed';
  const isoDue = toISODate(t?.dueDate || t?.due);
  if (!isoDue) return 'Upcoming';
  if (isoDue < todayISO) return 'Overdue';
  if (isoDue === todayISO) return 'Today';
  return 'Upcoming';
}

function getPriorityScore(t, todayISO) {
  if (t?.status === 'Completed') return 4;
  const bucket = getTaskBucket(t, todayISO);
  if (bucket === 'Overdue') return 1;
  if (bucket === 'Today') return 2;
  return 3;
}

function formatDueDate(value) {
  if (!value) return '—';
  const iso = toISODate(value);
  if (!iso) return String(value);
  const [y, m, d] = iso.split('-');
  const dateObj = new Date(`${iso}T00:00:00`);
  if (isNaN(dateObj.getTime())) return `${d}-${m}-${y}`;
  return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getPriorityStyle(priority) {
  const p = String(priority || 'Medium').toLowerCase();
  if (p === 'urgent') return { label: 'Urgent', color: '#dc2626', dot: '#dc2626' };
  if (p === 'high') return { label: 'High', color: '#ea580c', dot: '#ea580c' };
  if (p === 'low') return { label: 'Low', color: '#059669', dot: '#059669' };
  return { label: 'Medium', color: '#d97706', dot: '#d97706' };
}

function getTaskIconComponent(task) {
  const title = String(task?.title || '').toLowerCase();
  const icon = String(task?.icon || '').toLowerCase();
  if (icon === 'phone' || title.includes('call') || title.includes('phone')) return Phone;
  if (icon === 'email' || title.includes('email') || title.includes('mail')) return Mail;
  if (icon === 'video' || title.includes('meeting') || title.includes('meet') || title.includes('zoom')) return Video;
  if (title.includes('proposal') || title.includes('quote') || title.includes('invoice') || title.includes('review')) return FileText;
  return ClipboardList;
}

const DASHBOARD_TASK_LIMIT = 8;
const TASK_TABS = [
  { id: 'All', label: 'All Tasks', countKey: 'All' },
  { id: 'Overdue', label: 'Overdue', countKey: 'Overdue' },
  { id: 'Today', label: 'Today', countKey: 'Today' },
  { id: 'Upcoming', label: 'Upcoming', countKey: 'Upcoming' },
];

function splitLeadName(full) {
  const text = full || "";
  const open = text.indexOf("(");
  const close = text.indexOf(")");
  if (open > 0 && close > open) {
    return { lead: text.slice(0, open).trim(), company: text.slice(open + 1, close).trim() };
  }
  return { lead: text, company: "" };
}
function normalizeTask(t) {
  if (!t) return {};
  const parts = splitLeadName(t.lead || t.leadName);
  return {
    ...t,
    id: t.id,
    title: t.title || 'Untitled Task',
    lead: parts.lead || t.lead || t.leadName || '—',
    company: parts.company || t.company || '',
    due: t.dueDate || t.due,
    dueDate: t.dueDate || t.due,
    priority: t.priority || 'Medium',
    status: t.status || 'Open',
    owner: t.owner || t.assigneeName || 'Unassigned'
  };
}
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function polarToCartesian(cx, cy, r, angle) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeArc(cx, cy, r, a0, a1) {
  const s = polarToCartesian(cx, cy, r, a1);
  const e = polarToCartesian(cx, cy, r, a0);
  const f = a1 - a0 <= 180 ? "0" : "1";
  return ["M", s.x, s.y, "A", r, r, 0, f, 0, e.x, e.y].join(" ");
}
function statusPill(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("new")) return { bg: "#eef4ff", fg: "#2f6fed" };
  if (s.includes("contact") || s.includes("attempt")) return { bg: "#f5f0ff", fg: "#7c3aed" };
  if (s.includes("qualif")) return { bg: "#ecfdf5", fg: "#059669" };
  if (s.includes("proposal") || s.includes("negot")) return { bg: "#fff7e8", fg: "#b45309" };
  if (s.includes("won") || s.includes("convert")) return { bg: "#ecfdf5", fg: "#15803d" };
  if (s.includes("lost")) return { bg: "#fee2e2", fg: "#b91c1c" };
  return { bg: "#f1f5f9", fg: "#475569" };
}
function formatShortINR(value) {
  const n = Number(value) || 0;
  if (n >= 10000000) return "Rs " + (n / 10000000).toFixed(2) + " Cr";
  if (n >= 100000) return "Rs " + (n / 100000).toFixed(2) + " L";
  if (n >= 1000) return "Rs " + (n / 1000).toFixed(1) + "k";
  return "Rs " + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}
export default function DashboardView() {
  const { formatCurrency } = useERP();
  const currentUser = useAppStore((s) => s.currentUser);
  const leads = useCrmStore((s) => s.leads);
  const deals = useCrmStore((s) => s.deals);
  const tasks = useCrmStore((s) => s.tasks);
  const createLead = useCrmStore((s) => s.createLead);
  const refreshCrm = useCrmStore((s) => s.refresh);
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();
  const completeCrmTask = useCrmStore((s) => s.completeTask);
  const firstStageId = useCrmStore((s) => (
    [...s.stages]
      .filter((stage) => stage.isActive !== false)
      .sort((a, b) => (Number(a.order ?? a.sequence) || 0) - (Number(b.order ?? b.sequence) || 0))[0]?.id
  ));
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [completeTarget, setCompleteTarget] = useState(null);
  const [isCreateLeadOpen, setIsCreateLeadOpen] = useState(false);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [createLeadError, setCreateLeadError] = useState('');
  const [isLogCallOpen, setIsLogCallOpen] = useState(false);
  const [crmDashboardKpis, setCrmDashboardKpis] = useState(null);
  useEffect(() => {
    let active = true;
    pullCrmDashboard().then((data) => {
      if (active) setCrmDashboardKpis(data?.kpis || null);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Quick action "Add Lead": the same modal and payload as the Leads page.
  async function handleCreateLead(formData) {
    if (isCreatingLead) return;
    setIsCreatingLead(true);
    setCreateLeadError('');
    let created = null;
    try {
      const payload = buildLeadPayload(formData, firstStageId);
      // Always saved on the server; it picks the first stage when none is set.
      created = await createLead(payload);
      if (created && !payload.stageId) refreshCrm('stages');
    } catch (err) {
      const message = `Lead not created — ${describeError(err)}`;
      setCreateLeadError(message);
      showToast?.(message);
      setIsCreatingLead(false);
      return;
    }
    setIsCreatingLead(false);
    setIsCreateLeadOpen(false);
    if (!created) return;
    try {
      runLeadStageAutomation(created, 'New Lead');
    } catch (err) {
      console.error('[CRM Automation] Error generating stage tasks for new lead:', err);
    }
    emitCrmEvent({
      type: CRM_EVENT_TYPES.LEAD_CREATED,
      entityType: 'lead',
      entityId: created.id,
      payload: {
        leadRef: created.leadNumber,
        leadName: created.name,
        ownerName: created.owner,
        path: `/crm/leads/${created.id}`,
      },
    });
    showToast?.(`Lead ${created.leadNumber || created.name || ''} created.`.trim());
  }
  const firstName = (currentUser?.name || "").split(" ")[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const todayStr = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const todayISO = getCurrentISODate();
  const totalLeads = leads.length;
  const activeLeads = leads.filter((l) => l.status !== "Lost Lead").length;
  const newLeads = leads.filter((l) => l.status === "New").length;
  const pendingTasks = tasks.filter((t) => t.status !== "Completed").length;
  const activeDeals = deals.filter((d) => d.stage !== "Declined");
  const pipelineDeals = activeDeals.length;
  const dealsTotal = deals.reduce((a, d) => a + (Number(d.price) || 0), 0);
  const kpis = [
    { label: "Total Active Leads", value: String(crmDashboardKpis?.openLeads ?? activeLeads), icon: Users },
    { label: "New Leads", value: String(newLeads), icon: UserPlus },
    { label: "Pending Tasks", value: String(crmDashboardKpis?.openTasks ?? pendingTasks), icon: Clock },
    { label: "Deals in Pipeline", value: String(crmDashboardKpis?.openDeals ?? pipelineDeals), icon: TrendingUp, note: formatShortINR(crmDashboardKpis?.pipelineValue ?? dealsTotal) },
    { label: "Won Value", value: formatCurrency(crmDashboardKpis?.wonValue ?? 0), icon: DollarSign, note: (crmDashboardKpis?.winRatePct ?? 0) + "% win rate" }
  ];
  const pipeline = DEAL_STAGES.map((stage, i) => ({
    label: stage,
    value: deals.filter((d) => d.stage === stage).length,
    total: deals.filter((d) => d.stage === stage).reduce((a, d) => a + (Number(d.price) || 0), 0),
    bg: PIPELINE_BG[i % PIPELINE_BG.length],
    fg: PIPELINE_FG[i % PIPELINE_FG.length]
  }));
  const sourceGroups = useMemo(() => {
    const m = new Map();
    leads.forEach((l) => {
      const k = l.source || "Others";
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).map(([name, count], i) => ({
      name,
      count,
      pct: Math.round((count / (totalLeads || 1)) * 100),
      color: SOURCE_COLORS[i % SOURCE_COLORS.length]
    }));
  }, [totalLeads]);
  let acc = 0;
  const donut = sourceGroups.map((s) => {
    const a0 = (acc / (totalLeads || 1)) * 360;
    acc += s.count;
    const a1 = (acc / (totalLeads || 1)) * 360;
    return { ...s, path: describeArc(90, 90, 62, a0, a1 >= 360 ? 359.9 : a1) };
  });
  const counts = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    for (const raw of tasks) {
      if (raw.status === 'Completed') continue;
      const b = getTaskBucket(raw, todayISO);
      if (b === 'Overdue') overdue++;
      else if (b === 'Today') today++;
      else upcoming++;
    }
    return {
      All: tasks.length,
      Overdue: overdue,
      Today: today,
      Upcoming: upcoming,
    };
  }, [tasks, todayISO]);

  const sortedFilteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tasks.filter((raw) => {
      const b = getTaskBucket(raw, todayISO);
      const okTab =
        tab === 'All' ||
        (tab === 'Overdue' && b === 'Overdue') ||
        (tab === 'Today' && b === 'Today') ||
        (tab === 'Upcoming' && b === 'Upcoming');
      if (!okTab) return false;

      if (!q) return true;
      const t = normalizeTask(raw);
      return (
        text(t.title).includes(q) ||
        text(t.lead).includes(q) ||
        text(t.company).includes(q) ||
        text(t.owner).includes(q)
      );
    });

    return list.sort((a, b) => {
      // Prioritize 1. Overdue -> 2. Today -> 3. Upcoming -> 4. Completed
      const sA = getPriorityScore(a, todayISO);
      const sB = getPriorityScore(b, todayISO);
      if (sA !== sB) return sA - sB;

      // Within category, earliest due date first
      const dateA = toISODate(a.dueDate || a.due) || '9999-99-99';
      const dateB = toISODate(b.dueDate || b.due) || '9999-99-99';
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      // Same date, earliest due time
      const timeA = a.dueTime || '';
      const timeB = b.dueTime || '';
      if (timeA && timeB && timeA !== timeB) return timeA.localeCompare(timeB);

      // Priority: Urgent > High > Medium > Low
      const prioWeight = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
      const pA = prioWeight[a.priority] ?? 2;
      const pB = prioWeight[b.priority] ?? 2;
      return pA - pB;
    });
  }, [tasks, tab, query, todayISO]);

  const displayTasks = sortedFilteredTasks.slice(0, DASHBOARD_TASK_LIMIT);

  const completeTask = (t) => {
    if (t.status === "Completed") return;
    setCompleteTarget(t);
  };
  async function handleComplete(outcome, nextAction, note, nextFollowUpAt, targetStageId) {
    if (!completeTarget) return { ok: false, message: "No task selected." };
    return completeTaskWithOutcome({ task: completeTarget, outcome, nextAction, note, nextFollowUpAt, targetStageId });
  }
  const handleCompleteSuccess = () => setCompleteTarget(null);
  const recent = leads.slice(0, 5);
  const CAL_COLORS = ["#2f6fed", "#8b5cf6", "#10b981", "#f59e0b"];
  const calendar = useMemo(() => {
    return tasks
      .filter((t) => {
        if (t.status === 'Completed') return false;
        return toISODate(t.dueDate || t.due) === todayISO;
      })
      .sort((x, y) => String(x.dueTime || "").localeCompare(String(y.dueTime || "")))
      .slice(0, 4)
      .map((raw, i) => {
        const t = normalizeTask(raw);
        return {
          key: t.id || `${t.title}-${i}`,
          time: t.dueTime || "Today",
          title: t.lead ? `${t.title} - ${t.lead}` : t.title,
          sub: t.company || t.owner || "",
          color: CAL_COLORS[i % CAL_COLORS.length],
        };
      });
  }, [tasks, todayISO]);
  return (
    <div className="grid-cols-1 lg:grid-cols-none" style={{ display: "grid", gap: 14, background: "#f6f9ff", minHeight: "100%" }}>
      <PageHeader
        title={`${greet}, ${firstName}!`}
        subtitle="Here is what is happening with your CRM today."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#334155" }}>
              <CalendarDays size={15} color="#64748b" /> {todayStr}
            </div>
          </div>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 my-4">
        {kpis.map((k, index) => (
          <CrmKpiCard
            key={k.label}
            index={index}
            label={k.label}
            value={k.value}
            icon={k.icon}
            sub={k.note}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]" style={{ gap: 12 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f1f3d" }}>Sales Pipeline</h3>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>Deals by stage from Manage Deals | {formatShortINR(dealsTotal)} total</p>
            </div>
            <Link to="/crm/deals" style={{ fontSize: 12, fontWeight: 700, color: "#2f6fed" }}>View Pipeline</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${pipeline.length},minmax(0,1fr))`, gap: 6, marginTop: 12 }}>
            {pipeline.map((p, i) => (
              <div key={p.label} title={p.label + ": " + p.value + " deals " + formatShortINR(p.total)} style={{ position: "relative", background: p.bg, color: p.fg, borderRadius: 8, padding: "10px 6px", textAlign: "center", clipPath: i === 0 ? "polygon(0 0,calc(100% - 10px) 0,100% 50%,calc(100% - 10px) 100%,0 100%)" : i === pipeline.length - 1 ? "polygon(10px 0,100% 0,100% 100%,10px 100%,0 50%)" : "polygon(10px 0,calc(100% - 10px) 0,100% 50%,calc(100% - 10px) 100%,10px 100%,0 50%)" }}>
                <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{p.value}</div>
                <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{formatShortINR(p.total)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f1f3d" }}>Leads by Source</h3>
            <span style={{ fontSize: 11, fontWeight: 700, border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 10px", color: "#475569" }}>This month</span>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 8 }}>
            <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
              <svg viewBox="0 0 180 180" style={{ width: "100%", height: "100%" }}>
                <circle cx="90" cy="90" r="62" fill="none" stroke="#eef2f7" strokeWidth="22" />
                {donut.map((d) => (
                  <path key={d.name} d={d.path} stroke={d.color} strokeWidth="22" strokeLinecap="round" fill="none" />
                ))}
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", textAlign: "center" }}>
                <strong style={{ fontSize: 20, color: "#0f1f3d" }}>{totalLeads}</strong>
                <span style={{ fontSize: 10, color: "#64748b" }}>Total Leads</span>
              </div>
            </div>
            <div style={{ display: "grid", gap: 7, fontSize: 12, flex: 1 }}>
              {sourceGroups.map((s) => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, color: "#334155", fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: s.color }} /> {s.name}
                  </span>
                  <strong style={{ color: "#0f1f3d" }}>{s.pct}%</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* My Tasks Section */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap lg:flex-nowrap">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f1f3d" }}>My Tasks</h3>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", background: "#f1f5f9", padding: "3px 8px", borderRadius: 6 }}>
              Showing {displayTasks.length} of {sortedFilteredTasks.length} prioritized
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="flex-wrap sm:flex-nowrap" style={{ display: "flex", gap: 6 }}>
              {TASK_TABS.map((t) => {
                const isSelected = tab === t.id;
                const count = counts[t.countKey] || 0;
                const isOverdueTab = t.id === 'Overdue';
                const isTodayTab = t.id === 'Today';
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      border: "1px solid",
                      borderColor: isSelected
                        ? "#2f6fed"
                        : isOverdueTab && count > 0
                        ? "#fecaca"
                        : isTodayTab && count > 0
                        ? "#fde68a"
                        : "#e2e8f0",
                      background: isSelected
                        ? "#eef4ff"
                        : "#ffffff",
                      color: isSelected
                        ? "#2f6fed"
                        : isOverdueTab && count > 0
                        ? "#dc2626"
                        : isTodayTab && count > 0
                        ? "#b45309"
                        : "#64748b",
                      borderRadius: 8,
                      padding: "6px 11px",
                      fontSize: 12,
                      fontWeight: isSelected ? 800 : 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{t.label}</span>
                    <span
                      style={{
                        borderRadius: 99,
                        padding: "1px 6px",
                        fontSize: 11,
                        fontWeight: 800,
                        background: isSelected
                          ? "#2f6fed"
                          : isOverdueTab && count > 0
                          ? "#fee2e2"
                          : isTodayTab && count > 0
                          ? "#fef3c7"
                          : "#f1f5f9",
                        color: isSelected
                          ? "#ffffff"
                          : isOverdueTab && count > 0
                          ? "#b91c1c"
                          : isTodayTab && count > 0
                          ? "#92400e"
                          : "#64748b",
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <span style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #e2e8f0", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#64748b", background: "#fff" }}>
              <Search size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks..."
                style={{ border: 0, outline: 0, fontSize: 12, width: 110, background: "transparent" }}
              />
            </span>

            <Link
              to="/crm/tasks"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 700,
                color: "#2f6fed",
                textDecoration: "none",
                padding: "6px 12px",
                borderRadius: 8,
                background: "#eef4ff",
                border: "1px solid #dbeafe",
                whiteSpace: "nowrap",
              }}
            >
              <span>View All Tasks</span>
              <span style={{ background: "#2f6fed", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 11, fontWeight: 800 }}>{counts.All}</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 860 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #eef2f7" }}>
                <th style={{ padding: "8px 10px" }}>Task</th>
                <th style={{ padding: "8px 10px" }}>Related Lead / Customer</th>
                <th style={{ padding: "8px 10px" }}>Due Date</th>
                <th style={{ padding: "8px 10px" }}>Priority</th>
                <th style={{ padding: "8px 10px" }}>Status</th>
                <th style={{ padding: "8px 10px" }}>Assigned Employee</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "36px 16px", textAlign: "center", color: "#64748b" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 size={32} color="#10b981" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                        {tab === "Overdue"
                          ? "No overdue tasks! You're caught up."
                          : tab === "Today"
                          ? "No tasks due today."
                          : tab === "Upcoming"
                          ? "No upcoming tasks scheduled."
                          : "No tasks found matching your filter."}
                      </span>
                      {tab !== "All" && (
                        <button
                          type="button"
                          onClick={() => setTab("All")}
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: "#2f6fed",
                            fontWeight: 700,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          View all tasks ({counts.All})
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayTasks.map((raw) => {
                  const t = normalizeTask(raw);
                  const b = getTaskBucket(raw, todayISO);
                  const isOverdue = b === "Overdue";
                  const isToday = b === "Today";
                  const isDone = raw.status === "Completed";
                  const prio = getPriorityStyle(t.priority);
                  const IconComp = getTaskIconComponent(t);

                  const statusConfig = isDone
                    ? { bg: "#dcfce7", fg: "#15803d", border: "#bbf7d0", label: "Completed" }
                    : isOverdue
                    ? { bg: "#fee2e2", fg: "#b91c1c", border: "#fecaca", label: "Overdue" }
                    : isToday
                    ? { bg: "#fef3c7", fg: "#b45309", border: "#fde68a", label: "Today" }
                    : { bg: "#eff6ff", fg: "#2563eb", border: "#dbeafe", label: "Upcoming" };

                  return (
                    <tr
                      key={t.id}
                      style={{
                        borderTop: "1px solid #f1f5f9",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      {/* Task Title */}
                      <td style={{ padding: "9px 10px", fontWeight: 700, color: "#0f1f3d", maxWidth: 260 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: isOverdue ? "#fef2f2" : "#eef4ff",
                              color: isOverdue ? "#dc2626" : "#2f6fed",
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            <IconComp size={14} />
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              lineHeight: 1.3,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={t.title}
                          >
                            {t.title}
                          </span>
                        </div>
                        {isDone && (raw.completionOutcome || raw.nextAction || raw.completedBy) && (
                          <div style={{ fontSize: 10, color: "#15803d", fontWeight: 700, marginTop: 2, paddingLeft: 36 }}>
                            {raw.completionOutcome ? "Outcome: " + raw.completionOutcome : ""}
                            {raw.nextAction ? " · Next: " + (NEXT_ACTION_LABELS[raw.nextAction] || raw.nextAction) : ""}
                            {raw.completedBy ? " · by " + raw.completedBy : ""}
                          </div>
                        )}
                      </td>

                      {/* Related Lead / Customer */}
                      <td style={{ padding: "9px 10px", color: "#334155", maxWidth: 200 }}>
                        {t.leadId ? (
                          <Link
                            to={`/crm/leads/${t.leadId}`}
                            style={{
                              display: "block",
                              fontWeight: 700,
                              color: "#1e293b",
                              textDecoration: "none",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = "#2f6fed"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = "#1e293b"; }}
                          >
                            {t.lead}
                          </Link>
                        ) : (
                          <span
                            style={{
                              display: "block",
                              fontWeight: 700,
                              color: "#1e293b",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.lead}
                          </span>
                        )}
                        {t.company && (
                          <span
                            style={{
                              display: "block",
                              color: "#64748b",
                              fontSize: 11,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t.company}
                          </span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
                        {isOverdue ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              color: "#dc2626",
                              fontWeight: 700,
                              fontSize: 11,
                              background: "#fef2f2",
                              border: "1px solid #fecaca",
                              borderRadius: 6,
                              padding: "2px 7px",
                            }}
                          >
                            <AlertTriangle size={12} color="#dc2626" />
                            {formatDueDate(t.dueDate)}
                          </span>
                        ) : isToday ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              color: "#b45309",
                              fontWeight: 700,
                              fontSize: 11,
                              background: "#fffbeb",
                              border: "1px solid #fde68a",
                              borderRadius: 6,
                              padding: "2px 7px",
                            }}
                          >
                            <Clock size={12} color="#b45309" />
                            Today{t.dueTime ? ` (${t.dueTime})` : ""}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              color: "#475569",
                              fontSize: 11,
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                              padding: "2px 7px",
                            }}
                          >
                            <CalendarDays size={12} color="#94a3b8" />
                            {formatDueDate(t.dueDate)}
                          </span>
                        )}
                      </td>

                      {/* Priority */}
                      <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontWeight: 700,
                            fontSize: 11,
                            color: prio.color,
                          }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: 99, background: prio.dot }} />
                          {prio.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            background: statusConfig.bg,
                            color: statusConfig.fg,
                            border: `1px solid ${statusConfig.border}`,
                            borderRadius: 99,
                            padding: "3px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.2,
                            display: "inline-block",
                          }}
                        >
                          {statusConfig.label}
                        </span>
                      </td>

                      {/* Assigned Employee */}
                      <td style={{ padding: "9px 10px", color: "#334155", fontWeight: 600, whiteSpace: "nowrap" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 99,
                              background: avatarColor(t.owner),
                              color: "#fff",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 10,
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {initials(t.owner)}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              maxWidth: 130,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={t.owner}
                          >
                            {t.owner}
                          </span>
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: "9px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {isDone ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              border: "1px solid #bbf7d0",
                              color: "#16a34a",
                              background: "#f0fdf4",
                              borderRadius: 7,
                              padding: "4px 9px",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            <CheckCircle2 size={12} /> Done
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => completeTask(raw)}
                            title="Click to complete task"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              border: "1px solid #2f6fed",
                              color: "#2f6fed",
                              background: "#f0f5ff",
                              borderRadius: 7,
                              padding: "4px 10px",
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#2f6fed";
                              e.currentTarget.style.color = "#fff";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#f0f5ff";
                              e.currentTarget.style.color = "#2f6fed";
                            }}
                          >
                            <CheckCircle2 size={12} /> Complete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Compact Footer with Summary & Link to Task Management */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            background: "#f8fafc",
            borderTop: "1px solid #eef2f7",
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            marginTop: 8,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
            Showing {displayTasks.length} of {sortedFilteredTasks.length} tasks
            {sortedFilteredTasks.length !== counts.All ? ` in "${tab}" (${counts.All} total in CRM)` : ""}
            {" · "}
            <span style={{ color: "#94a3b8" }}>Order: Overdue &rarr; Today &rarr; Upcoming</span>
          </span>
          <Link
            to="/crm/tasks"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#2f6fed",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              textDecoration: "none",
            }}
          >
            <span>Open Task Management ({counts.All})</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]" style={{ gap: 12 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f1f3d" }}>Recent Leads</h3>
            <Link to="/crm/leads" style={{ fontSize: 12, fontWeight: 700, color: "#2f6fed" }}>View All</Link>
          </div>
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {recent.map((l) => {
              const pill = statusPill(l.status);
              return (
                <Link key={l.id} to={"/crm/leads/" + l.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 99, background: l.avatarColor || avatarColor(l.name), color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {initials(l.name)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: "block", fontSize: 12, color: "#0f1f3d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</strong>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span style={{ background: pill.bg, color: pill.fg, borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 800 }}>{l.status}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{l.createdOn} | {l.source} | {formatCurrency(l.amount || 0)}</span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f1f3d" }}>Today Calendar</h3>
            <Link to="/crm/tasks" style={{ fontSize: 12, fontWeight: 700, color: "#2f6fed" }}>View Calendar</Link>
          </div>
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {calendar.length === 0 && (
              <span style={{ fontSize: 12, color: "#64748b" }}>No tasks due today.</span>
            )}
            {calendar.map((c) => (
              <div key={c.key} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#475569", width: 64, flexShrink: 0, paddingTop: 2 }}>{c.time}</span>
                <span style={{ width: 3, borderRadius: 99, background: c.color, alignSelf: "stretch" }} />
                <span>
                  <strong style={{ display: "block", fontSize: 12, color: "#0f1f3d" }}>{c.title}</strong>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{c.sub}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f1f3d" }}>Quick Actions</h3>
          <p style={{ margin: "2px 0 12px", fontSize: 11, color: "#64748b" }}>Perform tasks with one click | {deals.length} deals in pipeline</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, textAlign: "center" }}>
            <button type="button" onClick={() => { setCreateLeadError(''); setIsCreateLeadOpen(true); }} style={{ display: "grid", gap: 6, placeItems: "center", border: "1px solid #eef2f7", borderRadius: 12, padding: "12px 6px", fontSize: 11, fontWeight: 700, color: "#334155", background: "none", cursor: "pointer", width: "100%" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#eef4ff", color: "#2f6fed", display: "grid", placeItems: "center" }}><UserPlus size={17} /></span> Add Lead
            </button>
            <Link to="/crm/deals" style={{ display: "grid", gap: 6, placeItems: "center", border: "1px solid #eef2f7", borderRadius: 12, padding: "12px 6px", fontSize: 11, fontWeight: 700, color: "#334155" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#ecfdf5", color: "#10b981", display: "grid", placeItems: "center" }}><TrendingUp size={17} /></span> Deals
            </Link>
            <Link to="/crm/tasks" style={{ display: "grid", gap: 6, placeItems: "center", border: "1px solid #eef2f7", borderRadius: 12, padding: "12px 6px", fontSize: 11, fontWeight: 700, color: "#334155" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#f5efff", color: "#8b5cf6", display: "grid", placeItems: "center" }}><ClipboardList size={17} /></span> Tasks
            </Link>
            <button type="button" onClick={() => setIsLogCallOpen(true)} style={{ display: "grid", gap: 6, placeItems: "center", border: "1px solid #eef2f7", borderRadius: 12, padding: "12px 6px", fontSize: 11, fontWeight: 700, color: "#334155", background: "none", cursor: "pointer", width: "100%" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#fffbeb", color: "#d97706", display: "grid", placeItems: "center" }}><PhoneCall size={17} /></span> Log Call
            </button>
            <Link to="/crm/leads/lost" style={{ display: "grid", gap: 6, placeItems: "center", border: "1px solid #eef2f7", borderRadius: 12, padding: "12px 6px", fontSize: 11, fontWeight: 700, color: "#334155" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#fef2f2", color: "#e11d48", display: "grid", placeItems: "center" }}><RotateCcw size={17} /></span> Lost Leads
            </Link>
            <Link to="/crm/customers" style={{ display: "grid", gap: 6, placeItems: "center", border: "1px solid #eef2f7", borderRadius: 12, padding: "12px 6px", fontSize: 11, fontWeight: 700, color: "#334155" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#f0f9ff", color: "#0284c7", display: "grid", placeItems: "center" }}><Building2 size={17} /></span> Customers
            </Link>
          </div>
        </div>
      </div>
      <CreateLeadModal
        isOpen={isCreateLeadOpen}
        submitting={isCreatingLead}
        serverError={createLeadError}
        onClose={() => { if (!isCreatingLead) setIsCreateLeadOpen(false); }}
        onCreate={handleCreateLead}
        onEditLayout={() => { setIsCreateLeadOpen(false); navigate('/crm/leads/form-builder'); }}
      />
      <CompleteTaskModal
        open={Boolean(completeTarget)}
        task={completeTarget ? { ...completeTarget, stage: completeTarget.stage || 'New Lead', dueAt: completeTarget.dueDate || completeTarget.due || '', assignee: completeTarget.owner || 'Unassigned' } : null}
        lead={resolveLeadForTask(completeTarget)}
        onCancel={handleCompleteSuccess}
        onComplete={handleComplete}
        onSuccess={handleCompleteSuccess}
      />
      <LogCallModal
        isOpen={isLogCallOpen}
        onClose={() => setIsLogCallOpen(false)}
      />
    </div>
  );
}
