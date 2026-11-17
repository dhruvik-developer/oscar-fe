import { useState, useMemo } from "react";
import { DataTable } from "../../../components/hrms/DataTable";
import { FilterBar } from "../../../components/hrms/FilterBar";
import { StatusBadge } from "../../../components/hrms/StatusBadge";
import { Modal } from "../../../components/hrms/Modal";
import { Drawer } from "../../../components/hrms/Drawer";
import { Button } from "../../../components/hrms/Button";
import { useAppStore } from "../../../stores/appStore";
import { useTrainingStore, TRAINING_FUNNEL_STAGES } from "../../../stores/trainingStore";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Trash2, ArrowLeft } from "lucide-react";
import PageInfoButton from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

export default function TrainingList({ embedded = false, onBack }) {
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();
  const { trainings, addTraining, updateTraining, deleteTraining, trainers } = useTrainingStore();
  const employees = useAppStore((s) => s.employees || []);
  const departmentsList = [
    ...new Set([
      "General",
      ...employees.map((e) => e.department).filter(Boolean),
      ...trainings.map((t) => t.department).filter(Boolean),
    ]),
  ];

  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);

  const [form, setForm] = useState({
    name: "",
    trainer: "Unassigned",
    department: "General",
    type: "Technical",
    participants: 1,
    cost: 0,
    start: "",
    end: "",
    status: "Requested",
  });

  const filtered = useMemo(() => trainings.filter((r) => {
    if (search && !`${r.name} ${r.trainer}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (dept !== "All" && r.department !== dept) return false;
    if (type !== "All" && r.type !== type) return false;
    if (status !== "All" && r.status !== status && r.stage !== status) return false;
    return true;
  }), [trainings, search, dept, type, status]);

  function save() {
    if (!form.name.trim()) {
      showToast("Training Name required", "error");
      return;
    }
    if (form.start && form.end && form.end < form.start) {
      showToast("End date cannot precede start date", "error");
      return;
    }
    if (editRow) {
      updateTraining(editRow.id, {
        ...form,
        stage: form.status,
        cost: Number(form.cost) || 0,
        participants: Number(form.participants),
      });
      showToast("Training updated successfully.");
      setEditRow(null);
    } else {
      addTraining({
        ...form,
        stage: form.status,
        cost: Number(form.cost) || 0,
        participants: Number(form.participants),
      });
      showToast("Training created successfully.");
      setAddOpen(false);
    }
  }

  const cols = [
    { key: "name", header: "Training Name", sortable: true, render: (r) => <span className="font-medium text-slate-900">{r.name || r.title}</span> },
    { key: "trainer", header: "Trainer", render: (r) => <div className="flex items-center gap-2">{r.avatar ? <img src={r.avatar} alt="" className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 rounded-full bg-slate-200 grid place-items-center text-[10px]">{(r.trainer || r.trainerName || "U")[0]}</div>}<span>{r.trainer || r.trainerName || "Unassigned"}</span></div> },
    { key: "department", header: "Department" },
    { key: "participants", header: "Participants", sortable: true, render: (r) => <span>{Array.isArray(r.participants) ? r.participants.length : (r.participants ?? 0)}</span> },
    { key: "cost", header: "Cost", render: (r) => <span className="font-semibold">₹ {Number(r.cost || 0).toLocaleString("en-IN")}</span> },
    { key: "start", header: "Dates", sortable: true, render: (r) => `${r.start || r.startDate || ""}${r.end && r.end !== r.start ? ` – ${r.end}` : ""}` },
    { key: "status", header: "Stage / Status", render: (r) => <StatusBadge status={r.status || r.stage} /> },
    { key: "actions", header: "Actions", render: (r) => <div className="flex gap-1">
        <button onClick={() => setViewRow(r)} className="w-7 h-7 rounded-xl hover:bg-off grid place-items-center text-slate-600"><Eye size={14} /></button>
        <button onClick={() => {
          const pCount = Array.isArray(r.participants) ? r.participants.length : (r.participants || 1);
          setForm({ name: r.name || r.title || "", trainer: r.trainer || r.trainerName || "Unassigned", department: r.department || "General", type: r.type || "Technical", participants: pCount, cost: r.cost || 0, start: r.start || r.startDate || "", end: r.end || r.endDate || "", status: r.status || r.stage || "Requested" });
          setEditRow(r);
        }} className="w-7 h-7 rounded-xl hover:bg-off grid place-items-center text-slate-600"><Pencil size={14} /></button>
        <button onClick={() => setDeleteRow(r)} className="w-7 h-7 rounded-xl hover:bg-red-50 text-red-600 grid place-items-center"><Trash2 size={14} /></button>
      </div> }
  ];

  function renderFormFields() {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="sm:col-span-2 flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Training Name *</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px] cursor-text focus:outline-none focus:border-navy"
            placeholder="Leadership Essentials"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Trainer</span>
          <select
            value={form.trainer}
            onChange={(e) => setForm({ ...form, trainer: e.target.value })}
            className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px] cursor-pointer focus:outline-none focus:border-navy"
          >
            <option value="Unassigned">Unassigned</option>
            {trainers.map((tr) => (
              <option key={tr.id} value={tr.name}>
                {tr.name} ({tr.specialization})
              </option>
            ))}
            <option value="External Agency">External Agency</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Department</span>
          <select
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px] cursor-pointer focus:outline-none focus:border-navy"
          >
            {departmentsList.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Training Type</span>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px] cursor-pointer focus:outline-none focus:border-navy"
          >
            <option>Leadership</option>
            <option>Technical</option>
            <option>Design</option>
            <option>Workshop</option>
            <option>Operations</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Participants</span>
          <input
            type="number"
            min={1}
            value={form.participants}
            onChange={(e) => setForm({ ...form, participants: Number(e.target.value) })}
            className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px] cursor-text focus:outline-none focus:border-navy"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Cost (₹)</span>
          <input
            type="number"
            min={0}
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
            className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px] cursor-text focus:outline-none focus:border-navy"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Start Date</span>
          <input
            type="date"
            value={form.start}
            onChange={(e) => setForm({ ...form, start: e.target.value })}
            className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px] cursor-pointer focus:outline-none focus:border-navy"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">End Date</span>
          <input
            type="date"
            value={form.end}
            onChange={(e) => setForm({ ...form, end: e.target.value })}
            className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px] cursor-pointer focus:outline-none focus:border-navy"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Stage / Status</span>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px] cursor-pointer focus:outline-none focus:border-navy font-medium"
          >
            {TRAINING_FUNNEL_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-slate-900">Training Programs</h1>
            <PageInfoButton guide={hrmsGuides.trainingList} />
          </div>
          <p className="text-[13px] text-muted">{trainings.length} total programs linked to Funnel and Performance</p>
        </div>
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/hrms/training/training-funnel")}
            className="px-3.5 py-2 border border-bdr rounded-xl text-[12.5px] font-medium text-slate-700 hover:bg-off transition"
          >
            View Funnel &rarr;
          </button>
          <Button onClick={() => {
            setForm({ name: "", trainer: "Unassigned", department: "General", type: "Technical", participants: 1, cost: 0, start: "", end: "", status: "Requested" });
            setAddOpen(true);
          }}>+ Add Training</Button>
        </div>
      </div>

      <FilterBar
        search={search}
        onSearch={setSearch}
        selects={[
          { label: "Department", value: dept, onChange: setDept, options: [{ value: "All", label: "All Departments" }, ...departmentsList.map((d) => ({ value: d, label: d }))] },
          { label: "Type", value: type, onChange: setType, options: [{ value: "All", label: "All Types" }, { value: "Leadership", label: "Leadership" }, { value: "Technical", label: "Technical" }, { value: "Design", label: "Design" }, { value: "Workshop", label: "Workshop" }] },
          { label: "Status", value: status, onChange: setStatus, options: [{ value: "All", label: "All Stages" }, ...TRAINING_FUNNEL_STAGES.map(s => ({ value: s.key, label: s.label }))] }
        ]}
        onClear={() => {
          setSearch("");
          setDept("All");
          setType("All");
          setStatus("All");
        }}
      />

      <DataTable columns={cols} data={filtered} emptyTitle="No trainings" emptyDesc="Add a training program to get started." emptyAction={<Button onClick={() => setAddOpen(true)}>+ Add Training</Button>} />

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Training Program" footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={save}>Save Training</Button></>}>
        {renderFormFields()}
      </Modal>

      <Modal isOpen={!!editRow} onClose={() => setEditRow(null)} title="Edit Training Program" footer={<><Button variant="secondary" onClick={() => setEditRow(null)}>Cancel</Button><Button onClick={save}>Save Training</Button></>}>
        {renderFormFields()}
      </Modal>

      <Drawer isOpen={!!viewRow} onClose={() => setViewRow(null)} title={viewRow?.name || viewRow?.title || ""} subtitle={`${viewRow?.trainer || viewRow?.trainerName || "Unassigned"} • ${viewRow?.department || "General"}`} footer={<Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>}>
        {viewRow && (
          <div className="space-y-3 text-[13px]">
            <div><strong>Trainer:</strong> {viewRow.trainer || viewRow.trainerName || "Unassigned"}</div>
            <div><strong>Department:</strong> {viewRow.department || "General"}</div>
            <div><strong>Type:</strong> {viewRow.type || "Technical"}</div>
            <div><strong>Participants:</strong> {Array.isArray(viewRow.participants) ? viewRow.participants.length : (viewRow.participants ?? 0)}</div>
            <div><strong>Budget / Cost:</strong> ₹ {Number(viewRow.cost || 0).toLocaleString("en-IN")}</div>
            <div><strong>Schedule:</strong> {viewRow.start || viewRow.startDate || "—"}{viewRow.end && viewRow.end !== viewRow.start ? ` – ${viewRow.end}` : ""}</div>
            <div><strong>Stage / Status:</strong> <StatusBadge status={viewRow.status || viewRow.stage} /></div>
            {viewRow.description && <div><strong>Description:</strong> <p className="text-muted mt-1">{viewRow.description}</p></div>}
          </div>
        )}
      </Drawer>

      <Modal isOpen={!!deleteRow} onClose={() => setDeleteRow(null)} title="Delete Training?" footer={<><Button variant="secondary" onClick={() => setDeleteRow(null)}>Cancel</Button><Button variant="danger" onClick={() => {
        if (deleteRow) deleteTraining(deleteRow.id);
        setDeleteRow(null);
        showToast("Training deleted successfully.");
      }}>Delete Training</Button></>}>
        <p className="text-[13px] text-muted">Delete <b>{deleteRow?.name}</b>?</p>
      </Modal>
    </div>
  );
}
