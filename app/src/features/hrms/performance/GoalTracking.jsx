import { useState, useMemo, useEffect } from "react";
import { hrmsSync, isServerId } from "../../../services/hrmsSync";
import { DataTable } from "../../../components/hrms/DataTable";
import { FilterBar } from "../../../components/hrms/FilterBar";
import { StatusBadge } from "../../../components/hrms/StatusBadge";
import { ProgressBar } from "../../../components/hrms/ProgressBar";
import { Modal } from "../../../components/hrms/Modal";
import { Drawer } from "../../../components/hrms/Drawer";
import { Button } from "../../../components/hrms/Button";
import { useAppStore } from "../../../stores/appStore";
import { Eye, Pencil, Trash2 } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import MasterSourceLink from "../../../components/common/MasterSourceLink";
export default function GoalTracking() {
  const { showToast, employees } = useAppStore();
  const [data, setData] = useState([]);

  const [formError, setFormError] = useState("");

  /** Server row → table row. Target/Current ride in `description`
   * (`Target: X | Current: Y`) — the model has no separate columns. */
  function serverGoalToRow(row) {
    const desc = String(row.description || "");
    const target = (/Target:\s*([^|]*)/.exec(desc)?.[1] || "").trim();
    const current = (/Current:\s*(.*)/.exec(desc)?.[1] || "").trim();
    const emp = employees.find((e) => String(e.id) === String(row.employeeId));
    return {
      id: row.id,
      employeeId: row.employeeId,
      employee: emp?.name || row.employee || "",
      avatar: emp?.avatar || "",
      department: emp?.department || "",
      goal: row.title || "",
      target,
      current,
      progress: Number(row.progressPct ?? row.progress ?? 0) || 0,
      due: row.dueDate || row.due || "",
      status: row.status || "In Progress",
      _synced: true,
    };
  }

  function formToPayload() {
    const emp = employees.find((x) => x.name === form.employee);
    const employeeId = emp?.id && isServerId(emp.id) ? emp.id : undefined;
    const parts = [];
    if (String(form.target || "").trim()) parts.push(`Target: ${String(form.target).trim()}`);
    if (String(form.current || "").trim()) parts.push(`Current: ${String(form.current).trim()}`);
    return {
      employee: form.employee,
      employeeId,
      title: form.goal.trim(),
      description: parts.join(" | ") || undefined,
      dueDate: form.due || undefined,
      progressPct: Number(form.progress) || 0,
      status: form.status,
    };
  }

  async function reloadGoals() {
    try {
      const rows = await hrmsSync.pull("goals");
      if (rows) setData(rows.map(serverGoalToRow));
    } catch { /* keep current rows */ }
  }

  // Goals live in `/hrms/performance/goals/`.
  useEffect(() => {
    let cancelled = false;
    hrmsSync.pull("goals").then((rows) => {
      if (!cancelled && rows) setData(rows.map(serverGoalToRow));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState("All");
  const [dept, setDept] = useState("All");
  const [status, setStatus] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [form, setForm] = useState({ employee: "", goal: "", target: "", current: "", progress: 30, due: "31 Dec 2024", status: "In Progress", department: "Engineering" });
  const filtered = useMemo(() => data.filter((r) => {
    if (search && !`${r.employee} ${r.goal}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (employee !== "All" && r.employee !== employee) return false;
    if (dept !== "All" && r.department !== dept) return false;
    if (status !== "All" && r.status !== status) return false;
    return true;
  }), [data, search, employee, dept, status]);
  async function save() {
    if (!form.employee.trim() || !form.goal.trim()) {
      showToast("Employee and Goal required");
      return;
    }
    const payload = formToPayload();
    if (!payload.employeeId) {
      showToast("Select an employee that is saved in the backend.");
      return;
    }
    setFormError("");
    try {
      if (editRow) {
        const saved = isServerId(editRow.id)
          ? await hrmsSync.update("goals", editRow.id, payload)
          : null;
        if (saved) {
          setData((d) => d.map((x) => x.id === editRow.id ? serverGoalToRow({ ...saved, employeeId: saved.employeeId || payload.employeeId }) : x));
        } else {
          setData((d) => d.map((x) => x.id === editRow.id ? { ...x, ...form, progress: Number(form.progress) } : x));
        }
        showToast("Goal updated successfully.");
        setEditRow(null);
      } else {
        const saved = await hrmsSync.create("goals", payload);
        if (saved) {
          setData((d) => [serverGoalToRow({ ...saved, employeeId: saved.employeeId || payload.employeeId }), ...d]);
        } else {
          setData((d) => [{ id: `GOAL-${String(d.length + 1).padStart(2, "0")}`, employee: form.employee, avatar: "", department: form.department, goal: form.goal, target: form.target, current: form.current, progress: Number(form.progress), due: form.due, status: form.status }, ...d]);
        }
        showToast("Goal created successfully.");
        setAddOpen(false);
      }
    } catch (err) {
      setFormError(err?.message || "Goal could not be saved.");
    }
  }
  const cols = [
    { key: "employee", header: "Employee", sortable: true, render: (r) => <div className="flex items-center gap-2">{r.avatar ? <img src={r.avatar} alt="" className="w-7 h-7 rounded-full" /> : <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 grid place-items-center text-[10px] font-bold">{String(r.employee || "?").slice(0, 1).toUpperCase()}</span>}{r.employee}</div> },
    { key: "goal", header: "Goal", render: (r) => <span className="max-w-[260px] truncate block">{r.goal}</span> },
    { key: "target", header: "Target" },
    { key: "current", header: "Current" },
    { key: "progress", header: "Progress", render: (r) => <ProgressBar value={r.progress} /> },
    { key: "due", header: "Due Date", sortable: true },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", header: "Actions", render: (r) => <div className="flex gap-1">
        <button onClick={() => setViewRow(r)} className="w-7 h-7 rounded-lg hover:bg-off grid place-items-center"><Eye size={14} /></button>
        <button onClick={() => {
      setForm({ employee: r.employee, goal: r.goal, target: r.target, current: r.current, progress: r.progress, due: r.due, status: r.status, department: r.department });
      setEditRow(r);
    }} className="w-7 h-7 rounded-lg hover:bg-off grid place-items-center"><Pencil size={14} /></button>
        <button onClick={() => setDeleteRow(r)} className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-600 grid place-items-center"><Trash2 size={14} /></button>
      </div> }
  ];
  function FormFields() {
    return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted">Employee *</span>
            <MasterSourceLink source="employees" />
          </span>
          <select
            value={form.employee}
            onChange={(e) => {
              const emp = employees.find((x) => x.name === e.target.value);
              setForm({
                ...form,
                employee: e.target.value,
                department: emp?.department || form.department,
              });
            }}
            className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]"
          >
            <option value="">Select Employee</option>
            {employees.map((e) => (
              <option key={e.id || e.name} value={e.name}>
                {e.name} ({e.department || e.designation})
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
        {formError && <p className="sm:col-span-2 text-[12px] font-medium text-red-600" role="alert">{formError}</p>}
      </div>;
  }
  return <div className="flex flex-col gap-5">
      <PageHeader
        title="Goal Tracking"
        subtitle="Track and manage individual employee goals, progress bars, and completion deadlines."
        guide={hrmsGuides.goalTracking}
        actions={<Button onClick={() => {
    setForm({ employee: "", goal: "", target: "", current: "", progress: 30, due: "31 Dec 2024", status: "In Progress", department: "Engineering" });
    setAddOpen(true);
  }}>+ Add Goal</Button>}
      />
      <FilterBar
    search={search}
    onSearch={setSearch}
    selects={[
      {
        label: "Employee",
        value: employee,
        onChange: setEmployee,
        options: [{ value: "All", label: "All Employees" }, ...employees.map((e) => ({ value: e.name, label: e.name }))],
      },
      { label: "Department", value: dept, onChange: setDept, options: [{ value: "All", label: "All Departments" }, { value: "Engineering", label: "Engineering" }, { value: "Design", label: "Design" }, { value: "Marketing", label: "Marketing" }] },
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
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Goal" footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={save}>Save Goal</Button></>}><FormFields /></Modal>
      <Modal isOpen={!!editRow} onClose={() => setEditRow(null)} title="Edit Goal" footer={<><Button variant="secondary" onClick={() => setEditRow(null)}>Cancel</Button><Button onClick={save}>Save Goal</Button></>}><FormFields /></Modal>
      <Drawer isOpen={!!viewRow} onClose={() => setViewRow(null)} title={viewRow?.goal ?? ""} subtitle={`${viewRow?.employee} \u2022 Due ${viewRow?.due}`} footer={<Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>}>
        {viewRow && <div className="space-y-3 text-[13px]"><div>Target: {viewRow.target} • Current: {viewRow.current}</div><ProgressBar value={viewRow.progress} /><div>Status: <StatusBadge status={viewRow.status} /></div></div>}
      </Drawer>
      <Modal isOpen={!!deleteRow} onClose={() => setDeleteRow(null)} title="Delete Goal?" footer={<><Button variant="secondary" onClick={() => setDeleteRow(null)}>Cancel</Button><Button variant="danger" onClick={async () => {
    if (deleteRow) {
      if (isServerId(deleteRow.id)) {
        try {
          await hrmsSync.remove("goals", deleteRow.id);
        } catch (err) {
          showToast(err?.message || "Goal could not be deleted.");
          return;
        }
      }
      setData((d) => d.filter((x) => x.id !== deleteRow.id));
    }
    setDeleteRow(null);
    showToast("Goal deleted successfully.");
  }}>Delete Goal</Button></>}><p className="text-[13px] text-muted">Delete goal <b>{deleteRow?.goal}</b>?</p></Modal>
    </div>;
}
