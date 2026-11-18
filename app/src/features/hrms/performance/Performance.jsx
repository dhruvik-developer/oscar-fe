import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../../../stores/appStore";
import { Badge } from "../../../components/hrms/Badge";
import { Pagination } from "../../../components/ui/Pagination";
import PageInfoButton from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

export default function Performance() {
  const showToast = useAppStore((s) => s.showToast);
  const currentUser = useAppStore((s) => s.currentUser);
  const [goals, setGoals] = useState([]);
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = filter === "All" ? goals : goals.filter((g) => g.status === filter);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const pagedGoals = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[24px] font-bold">Performance Management</h1>
          <PageInfoButton guide={hrmsGuides.performanceDashboard} />
        </div>
        <button onClick={() => showToast("New review cycle created")} className="btn-primary h-9 px-4 rounded-xl text-xs font-semibold">New Review Cycle</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[{ l: "Total Goals", v: String(goals.length) }, { l: "In Progress", v: String(goals.filter((g) => g.status === "In Progress").length) }, { l: "Completed", v: String(goals.filter((g) => g.status === "Completed").length) }, { l: "Avg Progress", v: `${goals.length ? Math.round(goals.reduce((sum, g) => sum + (Number(g.progress) || 0), 0) / goals.length) : 0}%` }, { l: "Goals Completed", v: `${goals.length ? Math.round((goals.filter((g) => g.status === "Completed").length / goals.length) * 100) : 0}%` }].map((x) => <div key={x.l} className="bg-white border border-bdr rounded-xl p-4 shadow-sm"><div className="text-[12px] text-muted">{x.l}</div><div className="text-[20px] font-bold mt-1">{x.v}</div></div>)}
      </div>
      <div className="bg-white border border-bdr rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 flex flex-wrap justify-between gap-3 border-b border-bdr"><h3 className="font-semibold">Goals & KPIs</h3>
          <div className="flex gap-2"><select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 px-2 bg-off border border-bdr rounded-xl text-xs font-semibold"><option>All</option><option>In Progress</option><option>Completed</option></select><button onClick={() => {
    const t = prompt("Goal title");
    if (t) setGoals([...goals, { id: "G" + Date.now(), emp: currentUser?.name || "—", avatar: `https://i.pravatar.cc/100?u=${encodeURIComponent(currentUser?.name || "goal")}`, title: t, target: "1", progress: 0, due: "—", status: "In Progress" }]);
  }} className="btn-primary h-9 px-4 rounded-xl text-xs font-semibold">Add Goal</button></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] lg:min-w-0 text-left text-[13px]"><thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted"><tr><th className="py-3 px-5">Employee</th><th className="py-3 px-5">Goal</th><th className="py-3 px-5">Target</th><th className="py-3 px-5">Progress</th><th className="py-3 px-5">Status</th></tr></thead>
            <tbody className="divide-y divide-bdr/40">
              {filtered.length === 0 && <tr><td colSpan={5} className="py-8 px-5 text-center text-muted">No goals yet.</td></tr>}
              {pagedGoals.map((g) => <tr key={g.id} className="hover:bg-off/60"><td className="py-3 px-5"><div className="flex items-center gap-2"><img src={g.avatar} className="w-7 h-7 rounded-full" />{g.emp}</div></td><td className="py-3 px-5">{g.title}</td><td className="py-3 px-5">{g.target}</td><td className="py-3 px-5"><div className="flex items-center gap-2"><div className="w-24 h-1.5 bg-off border border-bdr rounded-full"><div className="h-full bg-navy rounded-full" style={{ width: g.progress + "%" }} /></div><input type="range" min={0} max={100} value={g.progress} onChange={(e) => setGoals(goals.map((x) => x.id === g.id ? { ...x, progress: Number(e.target.value), status: Number(e.target.value) === 100 ? "Completed" : "In Progress" } : x))} className="w-20 accent-navy" /><span className="text-[11px] text-muted">{g.progress}%</span></div></td><td className="py-3 px-5"><Badge tone={g.status === "Completed" ? "success" : "warning"}>{g.status}</Badge></td></tr>)}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="border-t border-bdr bg-off/50 px-4 py-2">
            <Pagination
              total={filtered.length}
              page={page}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 50]}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </div>;
}
