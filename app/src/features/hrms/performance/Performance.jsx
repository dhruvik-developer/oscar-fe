import { useState } from "react";
import { Avatar } from "../../../components/hrms/Avatar";
import { useAppStore } from "../../../stores/appStore";
import { Badge } from "../../../components/hrms/Badge";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
export default function Performance() {
  const showToast = useAppStore((s) => s.showToast);
  const [goals, setGoals] = useState([
    { id: "G1", emp: "Team Member", avatar: "https://i.pravatar.cc/100?img=15", title: "Reduce API latency by 30%", target: "30%", progress: 72, due: "Dec 31", status: "In Progress" },
    { id: "G2", emp: "Marcus Chen", avatar: "https://i.pravatar.cc/100?img=16", title: "Launch Design System v2", target: "1 release", progress: 100, due: "Oct 15", status: "Completed" }
  ]);
  const [filter, setFilter] = useState("All");
  const filtered = filter === "All" ? goals : goals.filter((g) => g.status === filter);
  return <div className="flex flex-col gap-6">
      <PageHeader
        title="Performance Management"
        guide={hrmsGuides.performanceDashboard}
        actions={<button onClick={() => showToast("New review cycle created")} className="px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium">New Review Cycle</button>}
      />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[{ l: "Active Cycle", v: "Q3 2024" }, { l: "Reviews Pending", v: "42" }, { l: "Completed", v: "186" }, { l: "Avg Rating", v: "4.2 / 5" }, { l: "Goals Completed", v: "78%" }].map((x) => <div key={x.l} className="bg-white border border-bdr rounded-xl p-4 shadow-sm"><div className="text-[12px] text-muted">{x.l}</div><div className="text-[20px] font-bold mt-1">{x.v}</div></div>)}
      </div>
      <div className="bg-white border border-bdr rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 flex flex-wrap justify-between gap-3 border-b border-bdr"><h3 className="font-semibold">Goals & KPIs</h3>
          <div className="flex gap-2"><select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 px-2 bg-off border border-bdr rounded-lg text-[12px]"><option>All</option><option>In Progress</option><option>Completed</option></select><button onClick={() => {
    const t = prompt("Goal title");
    if (t) setGoals([...goals, { id: "G" + Date.now(), emp: "Ayesha Khan", avatar: "https://i.pravatar.cc/100?img=5", title: t, target: "1", progress: 10, due: "Dec 31", status: "In Progress" }]);
  }} className="px-3 py-1.5 bg-navy text-white rounded-lg text-[12px]">Add Goal</button></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] lg:min-w-0 text-left text-[13px]"><thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted"><tr><th className="py-3 px-5">Employee</th><th className="py-3 px-5">Goal</th><th className="py-3 px-5">Target</th><th className="py-3 px-5">Progress</th><th className="py-3 px-5">Status</th></tr></thead>
            <tbody className="divide-y divide-bdr/40">
              {filtered.map((g) => <tr key={g.id} className="hover:bg-off/60"><td className="py-3 px-5"><div className="flex items-center gap-2"><img src={g.avatar} className="w-7 h-7 rounded-full" />{g.emp}</div></td><td className="py-3 px-5">{g.title}</td><td className="py-3 px-5">{g.target}</td><td className="py-3 px-5"><div className="flex items-center gap-2"><div className="w-24 h-1.5 bg-off border border-bdr rounded-full"><div className="h-full bg-navy rounded-full" style={{ width: g.progress + "%" }} /></div><input type="range" min={0} max={100} value={g.progress} onChange={(e) => setGoals(goals.map((x) => x.id === g.id ? { ...x, progress: Number(e.target.value), status: Number(e.target.value) === 100 ? "Completed" : "In Progress" } : x))} className="w-20 accent-navy" /><span className="text-[11px] text-muted">{g.progress}%</span></div></td><td className="py-3 px-5"><Badge tone={g.status === "Completed" ? "success" : "warning"}>{g.status}</Badge></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
}
