import { useState, useMemo } from "react";
import { useAppStore } from "../../../stores/appStore";
import { usePerformanceStore } from "../../../stores/performanceStore";
import { DataTable } from "../../../components/hrms/DataTable";
import { FilterBar } from "../../../components/hrms/FilterBar";
import { StatusBadge } from "../../../components/hrms/StatusBadge";
import { Modal } from "../../../components/hrms/Modal";
import { Drawer } from "../../../components/hrms/Drawer";
import { Button } from "../../../components/hrms/Button";
import { Eye, Pencil, Trash2, Star, Target, Sliders, Layers } from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import MasterSourceLink from "../../../components/common/MasterSourceLink";

export default function Indicators() {
  const showToast = useAppStore((s) => s.showToast);
  const employees = useAppStore((s) => s.employees) || [];

  const { indicators, addIndicator, updateIndicator, deleteIndicator } = usePerformanceStore();

  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("All");
  const [dept, setDept] = useState("All");
  const [desig, setDesig] = useState("All");
  const [rating, setRating] = useState("All");
  const [status, setStatus] = useState("All");

  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);

  const [form, setForm] = useState({
    name: "",
    branch: "New York",
    department: "Engineering",
    designation: "Senior Engineer",
    assignedEmployee: "All Engineers",
    target: "≥ 95%",
    measurementType: "Percentage",
    weight: 15,
    description: "",
    status: "Active",
  });
  const [errors, setErrors] = useState({});

  const filtered = useMemo(() => {
    return indicators.filter((r) => {
      if (search && !`${r.name} ${r.department} ${r.designation} ${r.target || ""} ${r.assignedEmployee || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (branch !== "All" && r.branch !== branch) return false;
      if (dept !== "All" && r.department !== dept) return false;
      if (desig !== "All" && r.designation !== desig) return false;
      if (status !== "All" && r.status !== status) return false;
      if (rating !== "All") {
        const v = Number(rating);
        if (Math.floor(r.rating) !== v) return false;
      }
      return true;
    });
  }, [indicators, search, branch, dept, desig, status, rating]);

  function validate(f) {
    const e = {};
    if (!f.name.trim()) e.name = "Indicator name is required";
    if (!f.branch) e.branch = "Branch is required";
    if (!f.department) e.department = "Department is required";
    if (!f.designation) e.designation = "Designation is required";
    if (!f.target.trim()) e.target = "Target benchmark is required";
    if (!String(f.weight).trim() || isNaN(Number(f.weight)) || Number(f.weight) <= 0 || Number(f.weight) > 100) {
      e.weight = "Weightage must be between 1 and 100%";
    }
    if (!f.status) e.status = "Status is required";
    return e;
  }

  function openAdd() {
    setForm({
      name: "",
      branch: "New York",
      department: "Engineering",
      designation: "Senior Engineer",
      assignedEmployee: "All Engineers",
      target: "≥ 95%",
      measurementType: "Percentage",
      weight: 15,
      description: "",
      status: "Active",
    });
    setErrors({});
    setAddOpen(true);
  }

  function openEdit(r) {
    setEditRow(r);
    setForm({
      name: r.name,
      branch: r.branch,
      department: r.department,
      designation: r.designation,
      assignedEmployee: r.assignedEmployee || "All in Role",
      target: r.target || "≥ 95%",
      measurementType: r.measurementType || "Percentage",
      weight: r.weight,
      description: r.description || "",
      status: r.status,
    });
    setErrors({});
  }

  function save() {
    const e = validate(form);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    if (editRow) {
      updateIndicator(editRow.id, {
        ...form,
        weight: Number(form.weight),
      });
      showToast("Indicator updated successfully.");
      setEditRow(null);
    } else {
      addIndicator({
        ...form,
        weight: Number(form.weight),
        rating: 4.0,
        addedBy: "Ayesha Khan",
      });
      showToast("Indicator created successfully.");
      setAddOpen(false);
    }
  }

  const cols = [
    {
      key: "name",
      header: "Indicator Name",
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-semibold text-slate-800 text-[13px] block">{r.name}</span>
          <span className="text-[11px] text-slate-500">{r.description ? r.description.slice(0, 50) + "..." : ""}</span>
        </div>
      ),
    },
    {
      key: "target",
      header: "Target",
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-medium text-slate-800 text-[12.5px] block">{r.target || "Standard"}</span>
          <span className="text-[10.5px] text-slate-400">{r.measurementType || "Score"}</span>
        </div>
      ),
    },
    {
      key: "weight",
      header: "Weightage",
      sortable: true,
      render: (r) => (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
          {r.weight}%
        </span>
      ),
    },
    {
      key: "assignment",
      header: "Dept / Assigned",
      sortable: true,
      render: (r) => (
        <div>
          <span className="text-[12.5px] font-medium text-slate-800 block">{r.department}</span>
          <span className="text-[11px] text-slate-500">{r.assignedEmployee || r.designation}</span>
        </div>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      render: (r) => (
        <span className="inline-flex items-center gap-1 font-semibold text-slate-900 text-[12.5px]">
          <Star size={12} className="text-amber-500 fill-amber-400" />
          {r.rating.toFixed(1)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            aria-label={`View ${r.name}`}
            onClick={() => setViewRow(r)}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-600 grid place-items-center transition"
          >
            <Eye size={14} />
          </button>
          <button
            aria-label={`Edit ${r.name}`}
            onClick={() => openEdit(r)}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-600 grid place-items-center transition"
          >
            <Pencil size={14} />
          </button>
          <button
            aria-label={`Delete ${r.name}`}
            onClick={() => setDeleteRow(r)}
            className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-600 grid place-items-center transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const branchOpts = [
    { value: "All", label: "All Branches" },
    { value: "New York", label: "New York" },
    { value: "London", label: "London" },
    { value: "Dubai", label: "Dubai" },
  ];
  const deptOpts = [
    { value: "All", label: "All Departments" },
    { value: "Engineering", label: "Engineering" },
    { value: "Design", label: "Design" },
    { value: "Marketing", label: "Marketing" },
    { value: "HR", label: "HR" },
    { value: "Finance", label: "Finance" },
    { value: "Operations", label: "Operations" },
  ];
  const desigOpts = [
    { value: "All", label: "All Designations" },
    { value: "Senior Engineer", label: "Senior Engineer" },
    { value: "Tech Lead", label: "Tech Lead" },
    { value: "Product Designer", label: "Product Designer" },
    { value: "DevOps Engineer", label: "DevOps Engineer" },
    { value: "Analyst", label: "Analyst" },
    { value: "HR Manager", label: "HR Manager" },
  ];
  const ratingOpts = [
    { value: "All", label: "All Ratings" },
    { value: "4", label: "4★ & up" },
    { value: "3", label: "3★ & up" },
  ];
  const statusOpts = [
    { value: "All", label: "All Statuses" },
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
    { value: "Draft", label: "Draft" },
  ];

  function FormFields() {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="sm:col-span-2 flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Indicator Name *</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Code Review Thoroughness & Discipline"
            className={`h-9 px-3 bg-white border rounded-xl text-[13px] ${
              errors.name ? "border-red-500" : "border-[#e2e8f0]"
            }`}
          />
          {errors.name && <span className="text-[11px] text-red-500">{errors.name}</span>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Branch *</span>
          <select
            value={form.branch}
            onChange={(e) => setForm({ ...form, branch: e.target.value })}
            className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
          >
            {branchOpts.slice(1).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Department *</span>
          <select
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
          >
            {deptOpts.slice(1).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Designation *</span>
          <select
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
          >
            {desigOpts.slice(1).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Employee Assignment</span>
            <MasterSourceLink source="employees" />
          </span>
          <select
            value={form.assignedEmployee}
            onChange={(e) => setForm({ ...form, assignedEmployee: e.target.value })}
            className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
          >
            <option value="All in Designation">All in Designation</option>
            {employees.map((e) => (
              <option key={e.id || e.name} value={e.name}>
                {e.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Target Benchmark *</span>
          <input
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
            placeholder="e.g. ≥ 95% on-time"
            className={`h-9 px-3 bg-white border rounded-xl text-[13px] ${
              errors.target ? "border-red-500" : "border-[#e2e8f0]"
            }`}
          />
          {errors.target && <span className="text-[11px] text-red-500">{errors.target}</span>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Measurement Type</span>
          <select
            value={form.measurementType}
            onChange={(e) => setForm({ ...form, measurementType: e.target.value })}
            className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
          >
            <option>Percentage</option>
            <option>Rating Score</option>
            <option>Numeric Score</option>
            <option>Milestone / SLA</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Weightage (%) *</span>
          <input
            type="number"
            min={1}
            max={100}
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
            className={`h-9 px-3 bg-white border rounded-xl text-[13px] ${
              errors.weight ? "border-red-500" : "border-[#e2e8f0]"
            }`}
          />
          {errors.weight && <span className="text-[11px] text-red-500">{errors.weight}</span>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Status</span>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
          >
            <option>Active</option>
            <option>Inactive</option>
            <option>Draft</option>
          </select>
        </label>

        <label className="sm:col-span-2 flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">Evaluation Criteria & Guidance</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Specific expectations, behaviors, and rubric for measuring this indicator..."
            className="p-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
          />
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <PageHeader
        title="Performance Indicators"
        subtitle="Technical and organizational indicators with benchmarks, measurement types, and weightages."
        guide={hrmsGuides.indicators}
        actions={<Button onClick={openAdd}>+ Add Indicator</Button>}
      />

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearch={setSearch}
        selects={[
          { label: "Branch", value: branch, onChange: setBranch, options: branchOpts },
          { label: "Department", value: dept, onChange: setDept, options: deptOpts },
          { label: "Designation", value: desig, onChange: setDesig, options: desigOpts },
          { label: "Rating", value: rating, onChange: setRating, options: ratingOpts },
          { label: "Status", value: status, onChange: setStatus, options: statusOpts },
        ]}
        onClear={() => {
          setSearch("");
          setBranch("All");
          setDept("All");
          setDesig("All");
          setRating("All");
          setStatus("All");
        }}
      />

      {/* Data Table */}
      <DataTable
        columns={cols}
        data={filtered}
        emptyTitle="No indicators found"
        emptyDesc="Adjust filters or add a new indicator."
        emptyAction={<Button onClick={openAdd}>+ Add Indicator</Button>}
      />

      {/* Add Modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Performance Indicator"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Indicator</Button>
          </>
        }
      >
        <FormFields />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editRow}
        onClose={() => setEditRow(null)}
        title="Edit Performance Indicator"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Changes</Button>
          </>
        }
      >
        <FormFields />
      </Modal>

      {/* View Drawer */}
      <Drawer
        isOpen={!!viewRow}
        onClose={() => setViewRow(null)}
        title={viewRow?.name ?? ""}
        subtitle={`${viewRow?.designation} • ${viewRow?.department}`}
        footer={
          <Button variant="secondary" onClick={() => setViewRow(null)}>
            Close
          </Button>
        }
      >
        {viewRow && (
          <div className="flex flex-col gap-4 text-[13px]">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
              <div>
                <span className="text-[11px] text-slate-400 block uppercase font-semibold">Target Benchmark</span>
                <span className="font-bold text-slate-800 text-[15px]">{viewRow.target || "≥ 95%"}</span>
                <span className="text-[11px] text-slate-500 block">Type: {viewRow.measurementType || "Percentage"}</span>
              </div>
              <StatusBadge status={viewRow.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-[#e2e8f0] rounded-xl text-[12.5px]">
              <div>
                <span className="text-slate-400 text-[11px] block">Weightage</span>
                <span className="font-bold text-slate-900">{viewRow.weight}%</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Current Rating</span>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Star size={12} className="text-amber-500 fill-amber-400" />
                  {viewRow.rating.toFixed(1)} / 5.0
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Assigned To</span>
                <span className="font-medium text-slate-800">{viewRow.assignedEmployee || viewRow.designation}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Branch</span>
                <span className="font-medium text-slate-800">{viewRow.branch}</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block uppercase font-semibold mb-1">
                Evaluation Criteria & Notes
              </span>
              <p className="p-3 bg-white border border-[#e2e8f0] rounded-xl text-slate-700 leading-relaxed text-[12.5px]">
                {viewRow.description || "No specific evaluation notes provided."}
              </p>
            </div>

            <div className="text-[11px] text-slate-400 pt-2 border-t border-[#e2e8f0]">
              <span>Added by: {viewRow.addedBy || "Ayesha Khan"} • Created: {viewRow.createdAt}</span>
            </div>
          </div>
        )}
      </Drawer>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        title="Delete Indicator?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteRow) deleteIndicator(deleteRow.id);
                setDeleteRow(null);
                showToast("Indicator deleted successfully.");
              }}
            >
              Delete Indicator
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-slate-600">
          Delete indicator <b>{deleteRow?.name}</b>? This will remove it from future review cycle rubrics.
        </p>
      </Modal>
    </div>
  );
}
