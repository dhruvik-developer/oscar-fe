import { AlertTriangle } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
const stages = [
  { label: "Created", count: 42, pct: 100 },
  { label: "Assigned", count: 38, pct: 90 },
  { label: "In Progress", count: 28, pct: 66 },
  { label: "At Risk", count: 8, pct: 19, alert: true },
  { label: "Completed", count: 18, pct: 42 }
];
export default function GoalFunnel() {
  const max = stages[0].count;
  return <div className="flex flex-col gap-6">
      <PageHeader
        title="Goal Funnel"
        subtitle="Created to completed with at-risk visibility."
        guide={hrmsGuides.goalFunnel}
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-white border border-bdr rounded-xl p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            {stages.map((s) => <div key={s.label} className="flex items-center gap-3">
                <div className="w-24 text-[12px] font-medium">{s.label}</div>
                <div className="flex-1 h-8 bg-off border border-bdr rounded-xl overflow-hidden relative">
                  <div className={`h-full rounded-xl ${s.alert ? "bg-red-500" : s.label === "Completed" ? "bg-emerald-500" : "bg-navy"}`} style={{ width: `${s.count / max * 100}%` }} />
                  <span className="absolute inset-0 grid place-items-center text-[11px] font-medium text-white">{s.count} • {s.pct}%</span>
                </div>
                {s.alert && <span className="px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded-full text-[11px]">At-risk: 8</span>}
              </div>)}
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-[12px]">
            <div className="bg-off border border-bdr rounded-xl p-3"><div className="text-muted">Conversion</div><div className="font-bold text-[16px]">42%</div><div className="text-muted">Created → Completed</div></div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3"><div className="text-red-700">At-risk</div><div className="font-bold text-[16px] text-red-700">8 goals</div><div className="text-muted">19% of active</div></div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3"><div className="text-emerald-700">Completed</div><div className="font-bold text-[16px]">18</div><div className="text-muted">+6% vs last quarter</div></div>
          </div>
        </div>
        <div className="lg:col-span-4 bg-white border border-bdr rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold flex items-center gap-2"><AlertTriangle size={14} className="text-red-500" />At-risk callout</h3>
          <p className="text-[13px] text-muted mt-2">8 goals flagged At Risk — mostly Engineering (CI migration, MTTR). Suggested: weekly check-ins.</p>
          <div className="mt-3 space-y-1 text-[13px]">
            {["Liam Cooper \u2014 Migrate CI to Buildkite", "Chen Li \u2014 Cut MTTR to <30m", "James Wilson \u2014 Reduce close to 4 days"].map((g) => <div key={g} className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-700">{g}</div>)}
          </div>
        </div>
      </div>
    </div>;
}
