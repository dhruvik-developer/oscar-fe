import { useState } from "react";
import { useEffect } from "react";
import { useAppStore } from "../../../stores/appStore";
import { hrmsSync } from "../../../services/hrmsSync";
import { Badge } from "../../../components/hrms/Badge";
import PageHeader from "../../../components/ui/PageHeader";
import { Avatar } from "../../../components/hrms/Avatar";
export { OrgChart } from "./OrgChartPage";
export function Departments() {
  const showToast = useAppStore((s) => s.showToast);
  const [q, setQ] = useState("");
  const [view, setView] = useState("table");
  const [departments, setDepartments] = useState([]);

  // `/hrms/departments/` — the organisation's real structure.
  useEffect(() => {
    let cancelled = false;
    hrmsSync.pull("departments").then((rows) => {
      if (!cancelled && rows) setDepartments(rows);
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = departments.filter((d) => String(d.name ?? '').toLowerCase().includes(q.toLowerCase()));
  return <div className="flex flex-col gap-6">
      <PageHeader
        title="Departments"
        subtitle="Manage organizational structure"
        actions={
          <button onClick={() => showToast("Add department")} className="px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium">Add Department</button>
        }
      />
      <div className="bg-white border border-bdr rounded-xl p-4 shadow-sm flex flex-wrap justify-between gap-3">
        <div className="relative w-full sm:w-auto"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted text-[18px]">search</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search department" className="pl-10 pr-4 h-9 w-full sm:w-64 bg-off border border-bdr rounded-xl text-[13px]" /></div>
        <div className="flex p-1 bg-off border border-bdr rounded-xl"><button onClick={() => setView("table")} className={`px-3 py-1.5 rounded-lg text-[12px] ${view === "table" ? "bg-white border border-bdr shadow-sm font-medium" : ""}`}>List</button><button onClick={() => setView("grid")} className={`px-3 py-1.5 rounded-lg text-[12px] ${view === "grid" ? "bg-white border border-bdr shadow-sm font-medium" : ""}`}>Grid</button></div>
      </div>
      {view === "table" ? <div className="bg-white border border-bdr rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full min-w-[640px] lg:min-w-0 text-left"><thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted"><tr><th className="py-3 px-5">Department</th><th className="py-3 px-5">Head</th><th className="py-3 px-5">Teams</th><th className="py-3 px-5">Employees</th><th className="py-3 px-5">Status</th></tr></thead>
            <tbody className="divide-y divide-bdr/40 text-[13px]">{filtered.map((d) => <tr key={d.name} className="hover:bg-off/60"><td className="py-4 px-5 font-medium flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">{d.icon}</span>{d.name}</td><td className="py-4 px-5"><div className="flex items-center gap-2"><Avatar name={d.head} size="xs" />{d.head}</div></td><td className="py-4 px-5">{d.teams}</td><td className="py-4 px-5">{d.employees}</td><td className="py-4 px-5"><Badge tone={d.status === "Active" ? "success" : "warning"}>{d.status}</Badge></td></tr>)}</tbody>
          </table>
        </div> : <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map((d) => <div key={d.name} className="bg-white border border-bdr rounded-xl p-5 shadow-sm"><div className="font-semibold">{d.name}</div><div className="text-[12px] text-muted flex items-center gap-2 mt-2"><Avatar name={d.head} size="xs" />{d.head}</div><div className="flex gap-2 mt-3 text-[11px]"><span className="px-2 py-1 bg-off border border-bdr rounded-full">{d.teams} teams</span><span className="px-2 py-1 bg-off border border-bdr rounded-full">{d.employees} employees</span></div></div>)}</div>}
    </div>;
}
