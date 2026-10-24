import { useState, useMemo } from "react";
import { DataTable } from "../../../components/hrms/DataTable";
import { FilterBar } from "../../../components/hrms/FilterBar";
import { StatusBadge } from "../../../components/hrms/StatusBadge";
import { Modal } from "../../../components/hrms/Modal";
import { Drawer } from "../../../components/hrms/Drawer";
import { Button } from "../../../components/hrms/Button";
import { useAppStore } from "../../../stores/appStore";
import { useTrainingStore } from "../../../stores/trainingStore";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Trash2, ArrowLeft } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { Avatar } from "../../../components/hrms/Avatar";

export default function Trainers({ embedded = false, onBack }) {
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();
  const { trainers, addTrainer, updateTrainer, deleteTrainer, trainings } = useTrainingStore();

  const [search, setSearch] = useState("");
  const [spec, setSpec] = useState("All");
  const [status, setStatus] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [form, setForm] = useState({ name: "", specialization: "Leadership", email: "", phone: "", programs: 1, status: "Active" });

  const filtered = useMemo(() => trainers.filter((r) => {
    if (search && !`${r.name} ${r.email}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (spec !== "All" && r.specialization !== spec) return false;
    if (status !== "All" && r.status !== status) return false;
    return true;
  }), [trainers, search, spec, status]);

  function save() {
    if (!form.name.trim() || !form.email.trim()) {
      showToast("Name and Email required");
      return;
    }
    if (editRow) {
      updateTrainer(editRow.id, { ...form, programs: Number(form.programs) });
      showToast("Trainer updated successfully.");
      setEditRow(null);
    } else {
      addTrainer({ ...form, programs: Number(form.programs) });
      showToast("Trainer created successfully.");
      setAddOpen(false);
    }
  }

  const cols = [
    { key: "name", header: "Trainer Name", sortable: true, render: (r) => <div className="flex items-center gap-2"><Avatar name={r.name} size="xs" />{r.name}</div> },
    { key: "specialization", header: "Specialization", sortable: true },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "programs", header: "Assigned Programs", sortable: true, render: (r) => {
      const activeCount = trainings.filter(t => t.trainer === r.name).length;
      return <span className="font-semibold">{activeCount || r.programs}</span>;
    } },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", header: "Actions", render: (r) => <div className="flex gap-1">
        <button onClick={() => setViewRow(r)} className="w-7 h-7 rounded-lg hover:bg-off grid place-items-center text-slate-600"><Eye size={14} /></button>
        <button onClick={() => {
          setForm({ name: r.name, specialization: r.specialization, email: r.email, phone: r.phone, programs: r.programs, status: r.status });
          setEditRow(r);
        }} className="w-7 h-7 rounded-lg hover:bg-off grid place-items-center text-slate-600"><Pencil size={14} /></button>
        <button onClick={() => setDeleteRow(r)} className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-600 grid place-items-center"><Trash2 size={14} /></button>
      </div> }
  ];

  function FormFields() {
    return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="sm:col-span-2 flex flex-col gap-1"><span className="text-[11px] font-medium text-muted">Trainer Name *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" placeholder="Sarah Mitchell" /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-muted">Specialization</span><select value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]"><option>Leadership</option><option>Engineering</option><option>Design</option><option>Marketing</option><option>Finance</option><option>Operations</option></select></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-muted">Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]"><option>Active</option><option>Inactive</option><option>On Leave</option></select></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-muted">Email *</span><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" placeholder="sarah.m@company.com" /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-muted">Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" placeholder="+1 212..." /></label>
        <label className="flex flex-col gap-1"><span className="text-[11px] font-medium text-muted">Training Programs</span><input type="number" value={form.programs} onChange={(e) => setForm({ ...form, programs: Number(e.target.value) })} className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px]" /></label>
      </div>;
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
        title="Trainer Directory"
        subtitle={`${trainers.length} registered trainers across departments`}
        guide={hrmsGuides.trainers}
        // actions={<>
        //   <button
        //     type="button"
        //     onClick={() => navigate("/hrms/training/training-funnel")}
        //     className="px-3.5 py-2 border border-bdr rounded-xl text-[12.5px] font-medium text-slate-700 hover:bg-off transition"
        //   >
        //     View Funnel &rarr;
        //   </button>
        //   <Button onClick={() => {
        //     setForm({ name: "", specialization: "Leadership", email: "", phone: "", programs: 1, status: "Active" });
        //     setAddOpen(true);
        //   }}>+ Add Trainer</Button>
        // </>}
      />

      <FilterBar
        search={search}
        onSearch={setSearch}
        selects={[
          { label: "Specialization", value: spec, onChange: setSpec, options: [{ value: "All", label: "All Specializations" }, { value: "Leadership", label: "Leadership" }, { value: "Engineering", label: "Engineering" }, { value: "Design", label: "Design" }, { value: "Marketing", label: "Marketing" }] },
          { label: "Status", value: status, onChange: setStatus, options: [{ value: "All", label: "All Status" }, { value: "Active", label: "Active" }, { value: "On Leave", label: "On Leave" }, { value: "Inactive", label: "Inactive" }] }
        ]}
        onClear={() => {
          setSearch("");
          setSpec("All");
          setStatus("All");
        }}
      />

      <DataTable columns={cols} data={filtered} emptyTitle="No trainers found" emptyDesc="Add a trainer to get started." emptyAction={<Button onClick={() => setAddOpen(true)}>+ Add Trainer</Button>} />

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Trainer" footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={save}>Save Trainer</Button></>}>
        <FormFields />
      </Modal>

      <Modal isOpen={!!editRow} onClose={() => setEditRow(null)} title="Edit Trainer" footer={<><Button variant="secondary" onClick={() => setEditRow(null)}>Cancel</Button><Button onClick={save}>Save Trainer</Button></>}>
        <FormFields />
      </Modal>

      <Drawer isOpen={!!viewRow} onClose={() => setViewRow(null)} title={viewRow?.name ?? ""} subtitle={viewRow?.specialization} footer={<Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>}>
        {viewRow && (
          <div className="space-y-4 text-[13px]">
            <div className="flex items-center gap-3 pb-3 border-b border-bdr">
              <Avatar name={viewRow.name} size="lg" />
              <div>
                <div className="font-bold text-[15px]">{viewRow.name}</div>
                <div className="text-muted">{viewRow.specialization} Specialist</div>
              </div>
            </div>
            <div><strong>Email:</strong> {viewRow.email}</div>
            <div><strong>Phone:</strong> {viewRow.phone}</div>
            <div><strong>Status:</strong> <StatusBadge status={viewRow.status} /></div>
            <div>
              <strong>Assigned Trainings:</strong>
              <div className="mt-2 space-y-1.5">
                {trainings.filter(t => t.trainer === viewRow.name).map(t => (
                  <div key={t.id} className="p-2 bg-off border border-bdr rounded-lg flex items-center justify-between text-[12px]">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-[11px] text-muted">{t.stage}</span>
                  </div>
                ))}
                {trainings.filter(t => t.trainer === viewRow.name).length === 0 && (
                  <div className="text-muted italic text-[12px]">No active training programs assigned</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal isOpen={!!deleteRow} onClose={() => setDeleteRow(null)} title="Delete Trainer?" footer={<><Button variant="secondary" onClick={() => setDeleteRow(null)}>Cancel</Button><Button variant="danger" onClick={() => {
        if (deleteRow) deleteTrainer(deleteRow.id);
        setDeleteRow(null);
        showToast("Trainer deleted");
      }}>Delete Trainer</Button></>}>
        <p className="text-[13px] text-muted">Delete <b>{deleteRow?.name}</b>?</p>
      </Modal>
    </div>
  );
}
