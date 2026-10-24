import { useState, useMemo } from "react";
import { Avatar } from "../../../components/hrms/Avatar";
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
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

export default function TrainingList({ embedded = false, onBack }) {
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();
  const { trainings, addTraining, updateTraining, deleteTraining, trainers } = useTrainingStore();

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
    trainer: "Sarah Mitchell",
    department: "HR",
    type: "Leadership",
    participants: 10,
    cost: 30000,
    start: "18 Oct 2024",
    end: "19 Oct 2024",
    status: "Scheduled",
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
      showToast("Training Name required");
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
    { key: "name", header: "Training Name", sortable: true, render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    { key: "trainer", header: "Trainer", render: (r) => <div className="flex items-center gap-2"><Avatar name={r.trainer} size="xs" /><span>{r.trainer}</span></div> },
    { key: "department", header: "Department" },
    { key: "participants", header: "Participants", sortable: true },
    { key: "cost", header: "Cost", render: (r) => <span className="font-semibold">₹ {Number(r.cost || 0).toLocaleString("en-IN")}</span> },
    { key: "start", header: "Dates", sortable: true, render: (r) => `${r.start}${r.end && r.end !== r.start ? ` – ${r.end}` : ""}` },
    { key: "status", header: "Stage / Status", render: (r) => <StatusBadge status={r.status || r.stage} /> },
    { key: "actions", header: "Actions", render: (r) => <div className="flex gap-1">
        <button onClick={() => setViewRow(r)} className="w-7 h-7 rounded-lg hover:bg-off grid place-items-center text-slate-600"><Eye size={14} /></button>
        <button onClick={() => {
          setForm({ name: r.name, trainer: r.trainer, department: r.department, type: r.type, participants: r.participants, cost: r.cost || 0, start: r.start, end: r.end, status: r.status || r.stage });
          setEditRow(r);
        }} className="w-7 h-7 rounded-lg hover:bg-off grid place-items-center text-slate-600"><Pencil size={14} /></button>
        <button onClick={() => setDeleteRow(r)} className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-600 grid place-items-center"><Trash2 size={14} /></button>
      </div> }
  ];

  function FormFields() {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="sm:col-span-2 flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Training Name *</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" placeholder="Leadership Essentials" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Trainer</span>
          <select value={form.trainer} onChange={(e) => setForm({ ...form, trainer: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]">
            <option value="Unassigned">Unassigned</option>
            {trainers.map((tr) => (
              <option key={tr.id} value={tr.name}>{tr.name} ({tr.specialization})</option>
            ))}
            <option value="External Agency">External Agency</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Department</span>
          <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]">
            <option>Engineering</option><option>HR</option><option>Design</option><option>Finance</option><option>Marketing</option><option>Operations</option><option>Product</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Training Type</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]">
            <option>Leadership</option><option>Technical</option><option>Design</option><option>Workshop</option><option>Operations</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Participants</span>
          <input type="number" value={form.participants} onChange={(e) => setForm({ ...form, participants: Number(e.target.value) })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Cost (₹)</span>
          <input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Start Date</span>
          <input value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">End Date</span>
          <input value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">Stage / Status</span>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]">
            {TRAINING_FUNNEL_STAGES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Back button to Training Setup - Commented out */}
      {/* {!embedded && (
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate("/hrms/training"))}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-navy transition w-fit cursor-pointer group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Training Setup</span>
        </button>
      )} */}

      <PageHeader
        title="Training Programs"
        subtitle={`${trainings.length} total programs linked to Funnel and Performance`}
        guide={hrmsGuides.trainingList}
        // actions={<>
        //   <button
        //     type="button"
        //     onClick={() => navigate("/hrms/training/training-funnel")}
        //     className="px-3.5 py-2 border border-bdr rounded-xl text-[12.5px] font-medium text-slate-700 hover:bg-off transition"
        //   >
        //     View Funnel &rarr;
        //   </button>
        //   <Button onClick={() => {
        //     setForm({ name: "", trainer: "Unassigned", department: "Engineering", type: "Technical", participants: 10, cost: 25000, start: "18 Oct 2024", end: "19 Oct 2024", status: "Requested" });
        //     setAddOpen(true);
        //   }}>+ Add Training</Button>
        // </>}
      />

      <FilterBar
        search={search}
        onSearch={setSearch}
        selects={[
          { label: "Department", value: dept, onChange: setDept, options: [{ value: "All", label: "All Departments" }, { value: "HR", label: "HR" }, { value: "Engineering", label: "Engineering" }, { value: "Design", label: "Design" }, { value: "Finance", label: "Finance" }, { value: "Marketing", label: "Marketing" }] },
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
        <FormFields />
      </Modal>

      <Modal isOpen={!!editRow} onClose={() => setEditRow(null)} title="Edit Training Program" footer={<><Button variant="secondary" onClick={() => setEditRow(null)}>Cancel</Button><Button onClick={save}>Save Training</Button></>}>
        <FormFields />
      </Modal>

      <Drawer isOpen={!!viewRow} onClose={() => setViewRow(null)} title={viewRow?.name ?? ""} subtitle={`${viewRow?.trainer} \u2022 ${viewRow?.department}`} footer={<Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>}>
        {viewRow && (
          <div className="space-y-3 text-[13px]">
            <div><strong>Trainer:</strong> {viewRow.trainer}</div>
            <div><strong>Department:</strong> {viewRow.department}</div>
            <div><strong>Type:</strong> {viewRow.type}</div>
            <div><strong>Participants:</strong> {viewRow.participants}</div>
            <div><strong>Budget / Cost:</strong> ₹ {Number(viewRow.cost || 0).toLocaleString("en-IN")}</div>
            <div><strong>Schedule:</strong> {viewRow.start} – {viewRow.end}</div>
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
