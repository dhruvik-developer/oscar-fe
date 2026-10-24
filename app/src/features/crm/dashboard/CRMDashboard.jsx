import CrmKpiCard from '../common/CrmKpiCard';
import PageHeader from "../../../components/ui/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users, UserPlus, Clock, TrendingUp, DollarSign, Search, Mail, Phone, CalendarDays, FileText, ClipboardList, Video, Send } from "lucide-react";
import { useCrmStore } from "../../../stores/crmStore";
import { initials, describeError, pullDashboard as pullCrmDashboard } from "../../../services/crmSync";
import { useERP } from "../../../context/ERPContext";
import { useAppStore } from "../../../stores/appStore";
import { CRM_TEAM_MEMBERS } from "../../../services/leadStageAutomation";
import { completeTaskWithOutcome, resolveLeadForTask, NEXT_ACTION_LABELS } from "../../../services/taskCompletionService";
import CompleteTaskModal from "../tasks/CompleteTaskModal";
import CreateLeadModal from "../leads/CreateLeadModal";
import { runLeadStageAutomation } from "../../../services/leadStageAutomation";
const DEAL_STORAGE_KEY = "crm-deals-v1";
const TASK_STORAGE_KEY = "crm-tasks-v1";
const DEAL_STAGES = ["Draft", "Sent", "Open", "Revised", "Declined"];
const SOURCE_COLORS = ["#2f6fed", "#7c3aed", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#64748b"];
const AVATAR_COLORS = ["#2f6fed", "#7c3aed", "#059669", "#ea580c", "#db2777", "#0891b2", "#4f46e5"];
const PIPELINE_BG = ["#eef4ff", "#f5f0ff", "#fff7e8", "#eef4ff", "#ecfdf5"];
const PIPELINE_FG = ["#2f6fed", "#7c3aed", "#b45309", "#2f6fed", "#059669"];
/** Lower-cased text, safe on a field the server left unset. */
function text(value) {
  return String(value ?? '').toLowerCase();
}

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
  const parts = splitLeadName(t.lead);
  return {
    id: t.id,
    title: t.title,
    lead: parts.lead || t.lead,
    company: parts.company,
    due: t.dueDate,
    dueDate: t.dueDate,
    priority: t.priority,
    status: t.status,
    owner: t.owner
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
  const { invoices, quotations, salesOrders, paymentIns, formatCurrency, getInvoiceOutstanding } = useERP();
  const currentUser = useAppStore((s) => s.currentUser);
  const leads = useCrmStore((s) => s.leads);
  const deals = useCrmStore((s) => s.deals);
  const tasks = useCrmStore((s) => s.tasks);
  const createLead = useCrmStore((s) => s.createLead);
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
  const [crmDashboardKpis, setCrmDashboardKpis] = useState(null);
  useEffect(() => {
    let active = true;
    pullCrmDashboard().then((data) => {
      if (active) setCrmDashboardKpis(data?.kpis || null);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function handleCreateLead(data) {
    try {
      const newLead = await createLead({
        // The server requires the lead to enter the pipeline at a stage.
        stageId: data.stageId || firstStageId,
        name: data.leadName || 'Untitled Lead',
        company: data.company || '',
        phone: data.phone || '',
        email: data.email || '',
        ownerId: data.ownerId || undefined,
        sourceId: data.sourceId || undefined,
        industryId: data.industryId || undefined,
        jobTitle: data.titleValue || '',
        createdOn: data.createdOn || undefined,
      });
      if (newLead) {
        try {
          runLeadStageAutomation(newLead, 'New');
        } catch (err) {
          console.error(err);
        }
      }
    } catch (err) {
      console.error('Error creating lead:', describeError(err));
    }
    setIsCreateLeadOpen(false);
  }
  const firstName = (currentUser?.name || "").split(" ")[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const todayStr = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const todayISO = new Date().toISOString().slice(0, 10);
  const totalLeads = leads.length;
  const activeLeads = leads.filter((l) => l.status !== "Lost Lead").length;
  const newLeads = leads.filter((l) => l.status === "New").length;
  const pendingTasks = tasks.filter((t) => t.status !== "Completed").length;
  const activeDeals = deals.filter((d) => d.stage !== "Declined");
  const pipelineDeals = activeDeals.length;
  const dealsTotal = deals.reduce((a, d) => a + (Number(d.price) || 0), 0);
  const invoicesTotal = invoices.reduce((a, i) => a + (i.total || 0), 0);
  const quotationsTotal = quotations.reduce((a, q) => a + (q.amount || q.total || 0), 0);
  const ordersTotal = salesOrders.reduce((a, o) => a + (o.total || o.amount || 0), 0);
  const collectedTotal = paymentIns.reduce((a, p) => a + (p.amount || 0), 0);
  const outstandingTotal = invoices.reduce((a, i) => {
    const r = getInvoiceOutstanding(i.id || i.invoiceNumber);
    return a + (r.balanceDue || 0);
  }, 0);
  const revenueExpected = dealsTotal + invoicesTotal + quotationsTotal;
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
  const bucket = (t) => {
    if (t.status === "Completed") return "Upcoming";
    if (t.dueDate < todayISO) return "Overdue";
    if (t.dueDate === todayISO) return "Today";
    return "Upcoming";
  };
  const counts = {
    All: tasks.length,
    Overdue: tasks.filter((t) => bucket(t) === "Overdue").length,
    Today: tasks.filter((t) => bucket(t) === "Today").length,
    Upcoming: tasks.filter((t) => bucket(t) === "Upcoming").length
  };
  const filtered = tasks.filter((t) => {
    const okTab = tab === "All" || bucket(t) === tab;
    const q = query.trim().toLowerCase();
    const okQ = !q || text(t.title).includes(q) || text(t.lead).includes(q) || text(t.owner).includes(q);
    return okTab && okQ;
  });
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
  const calendar = tasks
    .filter((t) => t.dueDate === todayISO && t.status !== "Completed")
    .sort((x, y) => String(x.dueTime || "").localeCompare(String(y.dueTime || "")))
    .slice(0, 4)
    .map((t, i) => ({
      key: t.id || `${t.title}-${i}`,
      time: t.dueTime || "Today",
      title: t.lead ? `${t.title} - ${t.lead}` : t.title,
      sub: t.company || t.owner || "",
      color: CAL_COLORS[i % CAL_COLORS.length],
    }));
  return (
    <div className="grid-cols-1 lg:grid-cols-none" style={{ display: "grid", gap: 14, background: "#f6f9ff", minHeight: "100%" }}>
      <PageHeader
        title={`${greet}, ${firstName}!`}
        subtitle={`Here is what is happening with your CRM today.${ordersTotal > 0 ? ` ${formatCurrency(ordersTotal)} orders` : ''}${paymentIns.length > 0 ? ` ${paymentIns.length} payments` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#334155" }}>
              <CalendarDays size={15} color="#64748b" /> {todayStr}
            </div>
          </div>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 my-4">
        {kpis.map((k, index) => {
          return (
            <CrmKpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} tone={['blue', 'emerald', 'amber', 'purple', 'rose'][index]}>
              {k.note && (
                <span className="flex flex-wrap items-center gap-1 text-[11px] font-semibold text-slate-400">
                  <em className="font-normal not-italic">{k.note}</em>
                </span>
              )}
            </CrmKpiCard>
          );
        })}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 6, marginTop: 12 }}>
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
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 lg:gap-0 flex-wrap lg:flex-nowrap">
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f1f3d" }}>My Tasks</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div className="flex-wrap lg:flex-nowrap" style={{ display: "flex", gap: 6 }}>
              {["All", "Overdue", "Today", "Upcoming"].map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} style={{ border: "1px solid", borderColor: tab === t ? "#2f6fed" : "#e2e8f0", background: tab === t ? "#eef4ff" : "#fff", color: tab === t ? "#2f6fed" : "#64748b", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
                  {t} ({counts[t]})
                </button>
              ))}
            </div>
            <span style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#64748b" }}>
              <Search size={14} /> <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks..." style={{ border: 0, outline: 0, fontSize: 12, width: 110 }} />
            </span>
          </div>
        </div>
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ padding: "8px" }}>Task</th>
                <th style={{ padding: "8px" }}>Related Lead</th>
                <th style={{ padding: "8px" }}>Due Date</th>
                <th style={{ padding: "8px" }}>Priority</th>
                <th style={{ padding: "8px" }}>Status</th>
                <th style={{ padding: "8px" }}>Assigned To</th>
                <th style={{ padding: "8px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const b = bucket(t);
                const overdue = b === "Overdue";
                const pColor = t.priority === "High" || t.priority === "Urgent" ? "#ef4444" : t.priority === "Medium" ? "#f59e0b" : "#10b981";
                const sBg = t.status === "Completed" ? "#dcfce7" : overdue ? "#fee2e2" : b === "Today" ? "#fef3c7" : "#eef4ff";
                const sFg = t.status === "Completed" ? "#15803d" : overdue ? "#b91c1c" : b === "Today" ? "#b45309" : "#2f6fed";
                return (
                  <tr key={t.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td style={{ padding: "10px 8px", fontWeight: 700, color: "#0f1f3d" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 8, background: "#eef4ff", display: "grid", placeItems: "center", color: "#2f6fed" }}>
                          <Phone size={14} />
                        </span> {t.title}
                      </span>
                      {t.status === "Completed" && (t.completionOutcome || t.nextAction || t.completedBy) && (
                        <span style={{ display: "block", fontSize: 10, color: "#15803d", fontWeight: 700, marginTop: 3 }}>
                          {t.completionOutcome ? "Outcome: " + t.completionOutcome : ""}
                          {t.nextAction ? " · Next: " + (NEXT_ACTION_LABELS[t.nextAction] || t.nextAction) : ""}
                          {t.completedBy ? " · by " + t.completedBy : ""}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 8px", color: "#334155" }}>{t.lead}<br /><span style={{ color: "#94a3b8", fontSize: 11 }}>{t.company}</span></td>
                    <td style={{ padding: "10px 8px", color: overdue ? "#dc2626" : "#475569", fontWeight: overdue ? 700 : 400 }}>{t.due}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700, color: pColor }}>
                        <span style={{ width: 7, height: 7, borderRadius: 99, background: pColor }} /> {t.priority}
                      </span>
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{ background: sBg, color: sFg, borderRadius: 99, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>{t.status === "Completed" ? "Completed" : b}</span>
                    </td>
                    <td style={{ padding: "10px 8px", color: "#334155", fontWeight: 600 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 26, height: 26, borderRadius: 99, background: avatarColor(t.owner), color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>{initials(t.owner)}</span>
                        {t.owner}
                      </span>
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "right" }}>
                      {(() => {
                        const isDone = t.status === "Completed";
                        return (
                          <button
                            type="button"
                            onClick={() => completeTask(t)}
                            disabled={isDone}
                            title={isDone ? "Task is completed" : "Click to complete task"}
                            style={{
                              border: isDone ? "1px solid #16a34a" : "1px solid #dc2626",
                              color: isDone ? "#15803d" : "#dc2626",
                              background: isDone ? "#f0fdf4" : "#fef2f2",
                              borderRadius: 8,
                              padding: "6px 14px",
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: isDone ? "default" : "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {isDone ? "Done" : "Complete"}
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
          <p style={{ margin: "2px 0 12px", fontSize: 11, color: "#64748b" }}>Perform tasks with one click | {deals.length} deals {invoices.length} invoices</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, textAlign: "center" }}>
            <button type="button" onClick={() => setIsCreateLeadOpen(true)} style={{ display: "grid", gap: 6, placeItems: "center", border: "1px solid #eef2f7", borderRadius: 12, padding: "12px 6px", fontSize: 11, fontWeight: 700, color: "#334155", background: "none", cursor: "pointer", width: "100%" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#eef4ff", color: "#2f6fed", display: "grid", placeItems: "center" }}><UserPlus size={17} /></span> Add Lead
            </button>
            <Link to="/crm/tasks" style={{ display: "grid", gap: 6, placeItems: "center", border: "1px solid #eef2f7", borderRadius: 12, padding: "12px 6px", fontSize: 11, fontWeight: 700, color: "#334155" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#ecfdf5", color: "#10b981", display: "grid", placeItems: "center" }}><ClipboardList size={17} /></span> Add Task
            </Link>
            <Link to="/crm/tasks" style={{ display: "grid", gap: 6, placeItems: "center", border: "1px solid #eef2f7", borderRadius: 12, padding: "12px 6px", fontSize: 11, fontWeight: 700, color: "#334155" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#f5efff", color: "#8b5cf6", display: "grid", placeItems: "center" }}><Video size={17} /></span> Meeting
            </Link>
            <Link to="/crm/leads" style={{ display: "grid", gap: 6, placeItems: "center", border: "1px solid #eef2f7", borderRadius: 12, padding: "12px 6px", fontSize: 11, fontWeight: 700, color: "#334155" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#fff7e8", color: "#d97706", display: "grid", placeItems: "center" }}><Send size={17} /></span> Send Email
            </Link>
            <Link to="/sales/quotations" style={{ display: "grid", gap: 6, placeItems: "center", border: "1px solid #eef2f7", borderRadius: 12, padding: "12px 6px", fontSize: 11, fontWeight: 700, color: "#334155" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#eef4ff", color: "#2f6fed", display: "grid", placeItems: "center" }}><FileText size={17} /></span> Quotation
            </Link>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Link to="/crm/leads" style={{ flex: 1, textAlign: "center", background: "#0f1f3d", color: "#fff", borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Mail size={14} /> Email
            </Link>
            <Link to="/crm/deals" style={{ flex: 1, textAlign: "center", background: "var(--card)", border: "1px solid var(--border)", color: "#0f1f3d", borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 800 }}>
              Deals
            </Link>
          </div>
        </div>
      </div>
      <CompleteTaskModal
        open={Boolean(completeTarget)}
        task={completeTarget ? { ...completeTarget, stage: completeTarget.stage || 'New Lead', dueAt: completeTarget.dueDate || completeTarget.due || '', assignee: completeTarget.owner || 'Unassigned' } : null}
        lead={resolveLeadForTask(completeTarget)}
        onCancel={handleCompleteSuccess}
        onComplete={handleComplete}
        onSuccess={handleCompleteSuccess}
      />
    </div>
  );
}
