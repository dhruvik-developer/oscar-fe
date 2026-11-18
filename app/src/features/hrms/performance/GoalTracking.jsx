import { useState, useMemo, useEffect } from "react";
import { hrmsSync } from "../../../services/hrmsSync";
import { DataTable } from "../../../components/hrms/DataTable";
import { FilterBar } from "../../../components/hrms/FilterBar";
import { StatusBadge } from "../../../components/hrms/StatusBadge";
import { ProgressBar } from "../../../components/hrms/ProgressBar";
import { Modal } from "../../../components/hrms/Modal";
import { Drawer } from "../../../components/hrms/Drawer";
import { Button } from "../../../components/hrms/Button";
import { useAppStore } from "../../../stores/appStore";
import { Eye, Pencil, Trash2 } from "lucide-react";
import PageInfoButton from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
export default function GoalTracking() {
  const { showToast, employees } = useAppStore();
  const [data, setData] = useState([]);

  // Goals live in `/hrms/performance/goals/`.
  useEffect(() => {
    let cancelled = false;
    hrmsSync.pull("goals").then((rows) => {
      if (!cancelled && rows) setData(rows);
    });
    return () => { cancelled = true; };
  }, []);
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState("All");
  const [dept, setDept] = useState("All");
  const [status, setStatus] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [form, setForm] = useState({ employee: "", goal: "", target: "", current: "", progress: 0, due: "", status: "In Progress", department: "" });
  const filtered = useMemo(() => data.filter((r) => {
    if (search && !`${r.employee} ${r.goal}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (employee !== "All" && r.employee !== employee) return false;
    if (dept !== "All" && r.department !== dept) return false;
    if (status !== "All" && r.status !== status) return false;
    return true;
  }), [data, search, employee, dept, status]);
  function save() {
    if (!form.employee.trim() || !form.goal.trim()) {
      showToast("Employee and Goal required");
      return;
    }
    if (editRow) {
      setData((d) => d.map((x) => x.id === editRow.id ? { ...x, ...form, progress: Number(form.progress) } : x));
      showToast("Goal updated successfully.");
      setEditRow(null);
    } else {
      setData((d) => [{ id: `GOAL-${String(d.length + 1).padStart(2, "0")}`, employee: form.employee, avatar: `https://i.pravatar.cc/100?u=${encodeURIComponent(form.employee)}`, department: form.department, goal: form.goal, target: form.target, current: form.current, progress: Number(form.progress), due: form.due, status: form.status }, ...d]);
      showToast("Goal created successfully.");
      setAddOpen(false);
    }
  }
  const cols = [
    { key: "employee", header: "Employee", sortable: true, render: (r) => <div className="flex items-center gap-2"><img src={r.avatar} alt="" className="w-7 h-7 rounded-full" />{r.employee}</div> },
    { key: "goal", header: "Goal", render: (r) => <span className="max-w-[260px] truncate block">{r.goal}</span> },
    { key: "target", header: "Target" },
    { key: "current", header: "Current" },
    { key: "progress", header: "Progress", render: (r) => <ProgressBar value={r.progress} /> },
    { key: "due", header: "Due Date", sortable: true },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", header: "Actions", render: (r) => <div className="flex gap-1">
        <button onClick={() => setViewRow(r)} className="w-7 h-7 rounded-xl hover:bg-off grid place-items-center"><Eye size={14} /></button>
        <button onClick={() => {
      setForm({ employee: r.employee, goal: r.goal, target: r.target, current: r.current, progress: r.progress, due: r.due, status: r.status, department: r.department });
      setEditRow(r);
    }} className="w-7 h-7 rounded-xl hover:bg-off grid place-items-center"><Pencil size={14} /></button>
        <button onClick={() => setDeleteRow(r)} className="w-7 h-7 rounded-xl hover:bg-red-50 text-red-600 grid place-items-center"><Trash2 size={14} /></button>
      </div> }
  ];
  const uniqueEmployeeList = useMemo(() => {
    const seen = new Set();
    return (employees || []).filter((e) => {
      const n = (e.name || "").trim();
      if (!n || seen.has(n.toLowerCase())) return false;
      seen.add(n.toLowerCase());
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  function renderFormFields() {
    return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Employee *</span>
          <select
            value={form.employee}
            onChange={(e) => {
              const emp = uniqueEmployeeList.find((x) => x.name === e.target.value);
              setForm({
                ...form,
                employee: e.target.value,
                department: emp?.department || form.department,
              });
            }}
            className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]"
          >
            <option value="">Select Employee</option>
            {uniqueEmployeeList.map((e) => (
              <option key={e.id || e.name} value={e.name}>
                {e.name}{e.department || e.designation ? ` (${e.department || e.designation})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-muted">Department</span><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" /></label>
        <label className="sm:col-span-2 flex flex-col gap-1"><span className="text-[11px] font-medium text-muted">Goal *</span><input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" placeholder="Reduce API latency by 30%" /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-muted">Target</span><input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" placeholder="30%" /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-muted">Current</span><input value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" placeholder="22%" /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-muted">Progress</span><div className="flex gap-2 items-center"><input type="range" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} className="flex-1 accent-navy" /><span className="text-[12px] w-10">{form.progress}%</span></div></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-muted">Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]"><option>Not Started</option><option>In Progress</option><option>At Risk</option><option>Completed</option></select></label>
      </div>;
  }
  return <div className="flex flex-col gap-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-slate-800">Goal Tracking</h1>
            <PageInfoButton guide={hrmsGuides.goalTracking} />
          </div>
          <p className="text-[13px] text-muted">Track and manage individual employee goals, progress bars, and completion deadlines.</p>
        </div>
        <Button onClick={() => {
    setForm({ employee: "", goal: "", target: "", current: "", progress: 0, due: "", status: "In Progress", department: "" });
    setAddOpen(true);
  }}>+ Add Goal</Button></div>
      <FilterBar
    search={search}
    onSearch={setSearch}
    selects={[
      {
        label: "Employee",
        value: employee,
        onChange: setEmployee,
        options: [{ value: "All", label: "All Employees" }, ...uniqueEmployeeList.map((e) => ({ value: e.name, label: e.name }))],
      },
      { label: "Department", value: dept, onChange: setDept, options: [{ value: "All", label: "All Departments" }, ...[...new Set([...employees.map((e) => e.department), ...data.map((r) => r.department)].filter(Boolean))].map((d) => ({ value: d, label: d }))] },
      { label: "Status", value: status, onChange: setStatus, options: [{ value: "All", label: "All Status" }, { value: "Not Started", label: "Not Started" }, { value: "In Progress", label: "In Progress" }, { value: "At Risk", label: "At Risk" }, { value: "Completed", label: "Completed" }] }
    ]}
    onClear={() => {
      setSearch("");
      setEmployee("All");
      setDept("All");
      setStatus("All");
    }}
  />
      <DataTable columns={cols} data={filtered} emptyTitle="No goals" emptyDesc="Create your first goal to get started." emptyAction={<Button onClick={() => setAddOpen(true)}>+ Add Goal</Button>} />
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Goal" footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={save}>Save Goal</Button></>}>{renderFormFields()}</Modal>
      <Modal isOpen={!!editRow} onClose={() => setEditRow(null)} title="Edit Goal" footer={<><Button variant="secondary" onClick={() => setEditRow(null)}>Cancel</Button><Button onClick={save}>Save Goal</Button></>}>{renderFormFields()}</Modal>
      <Drawer isOpen={!!viewRow} onClose={() => setViewRow(null)} title={viewRow?.goal ?? ""} subtitle={`${viewRow?.employee} \u2022 Due ${viewRow?.due}`} footer={<Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>}>
        {viewRow && <div className="space-y-3 text-[13px]"><div>Target: {viewRow.target} • Current: {viewRow.current}</div><ProgressBar value={viewRow.progress} /><div>Status: <StatusBadge status={viewRow.status} /></div></div>}
      </Drawer>
      <Modal isOpen={!!deleteRow} onClose={() => setDeleteRow(null)} title="Delete Goal?" footer={<><Button variant="secondary" onClick={() => setDeleteRow(null)}>Cancel</Button><Button variant="danger" onClick={() => {
    if (deleteRow) setData((d) => d.filter((x) => x.id !== deleteRow.id));
    setDeleteRow(null);
    showToast("Goal deleted successfully.");
  }}>Delete Goal</Button></>}><p className="text-[13px] text-muted">Delete goal <b>{deleteRow?.goal}</b>?</p></Modal>
    </div>;
}
