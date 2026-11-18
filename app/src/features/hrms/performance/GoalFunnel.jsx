import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { hrmsSync } from "../../../services/hrmsSync";
import PageInfoButton from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
export default function GoalFunnel() {
  const [goals, setGoals] = useState([]);

  // Goals live in `/hrms/performance/goals/`.
  useEffect(() => {
    let cancelled = false;
    hrmsSync.pull("goals").then((rows) => {
      if (!cancelled && rows) setGoals(rows);
    });
    return () => { cancelled = true; };
  }, []);

  const total = goals.length;
  const pctOf = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const assignedCount = goals.filter((g) => g.employee).length;
  const inProgressCount = goals.filter((g) => g.status === "In Progress").length;
  const atRisk = goals.filter((g) => g.status === "At Risk");
  const completedCount = goals.filter((g) => g.status === "Completed").length;
  const activeCount = goals.filter((g) => g.status !== "Completed").length;
  const stages = [
    { label: "Created", count: total, pct: pctOf(total) },
    { label: "Assigned", count: assignedCount, pct: pctOf(assignedCount) },
    { label: "In Progress", count: inProgressCount, pct: pctOf(inProgressCount) },
    { label: "At Risk", count: atRisk.length, pct: pctOf(atRisk.length), alert: true },
    { label: "Completed", count: completedCount, pct: pctOf(completedCount) }
  ];
  const max = stages[0].count || 1;
  return <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-bold text-slate-800">Goal Funnel</h1>
          <PageInfoButton guide={hrmsGuides.goalFunnel} />
        </div>
        <p className="text-[13px] text-muted">Created to completed with at-risk visibility.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-white border border-bdr rounded-xl p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            {stages.map((s) => <div key={s.label} className="flex items-center gap-3">
                <div className="w-24 text-[12px] font-medium">{s.label}</div>
                <div className="flex-1 h-8 bg-off border border-bdr rounded-xl overflow-hidden relative">
                  <div className={`h-full rounded-xl ${s.alert ? "bg-red-500" : s.label === "Completed" ? "bg-emerald-500" : "bg-navy"}`} style={{ width: `${s.count / max * 100}%` }} />
                  <span className="absolute inset-0 grid place-items-center text-[11px] font-medium text-white">{s.count} • {s.pct}%</span>
                </div>
                {s.alert && <span className="px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded-full text-[11px]">At-risk: {s.count}</span>}
              </div>)}
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-[12px]">
            <div className="bg-off border border-bdr rounded-xl p-3"><div className="text-muted">Conversion</div><div className="font-bold text-[16px]">{pctOf(completedCount)}%</div><div className="text-muted">Created → Completed</div></div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3"><div className="text-red-700">At-risk</div><div className="font-bold text-[16px] text-red-700">{atRisk.length} goals</div><div className="text-muted">{activeCount > 0 ? Math.round((atRisk.length / activeCount) * 100) : 0}% of active</div></div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3"><div className="text-emerald-700">Completed</div><div className="font-bold text-[16px]">{completedCount}</div><div className="text-muted">{pctOf(completedCount)}% of all goals</div></div>
          </div>
        </div>
        <div className="lg:col-span-4 bg-white border border-bdr rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold flex items-center gap-2"><AlertTriangle size={14} className="text-red-500" />At-risk callout</h3>
          <p className="text-[13px] text-muted mt-2">{atRisk.length > 0 ? `${atRisk.length} goal${atRisk.length === 1 ? "" : "s"} flagged At Risk. Suggested: weekly check-ins.` : "No goals are flagged At Risk."}</p>
          <div className="mt-3 space-y-1 text-[13px]">
            {atRisk.slice(0, 5).map((g) => <div key={g.id} className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-700">{`${g.employee || "Unassigned"} \u2014 ${g.goal || "Untitled goal"}`}</div>)}
          </div>
        </div>
      </div>
    </div>;
}
