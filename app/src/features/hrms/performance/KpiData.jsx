import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../../../stores/appStore";
import { usePerformanceStore } from "../../../stores/performanceStore";
import { DataTable } from "../../../components/hrms/DataTable";
import { FilterBar } from "../../../components/hrms/FilterBar";
import { StatusBadge } from "../../../components/hrms/StatusBadge";
import { Modal } from "../../../components/hrms/Modal";
import { Drawer } from "../../../components/hrms/Drawer";
import { Button } from "../../../components/hrms/Button";
import { SearchableSelect } from "../../../components/hrms/SearchableSelect";
import { Eye, Pencil, Trash2, Target, Award, Layers, ChevronDown } from "lucide-react";
import PageInfoButton from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { hrmsSync } from "../../../services/hrmsSync";

const DEFAULT_DEPARTMENTS = [
  "Accounts & Finance",
  "Engineering",
  "General",
  "Human Resources",
  "Management & Administration",
  "Marketing",
  "Operations",
  "Production & Fabrication",
  "Quality Assurance",
  "Sales",
];

const DEFAULT_DESIGNATIONS = [
  "Accounts Executive",
  "Accounts Manager",
  "Assembly Technician",
  "Fabrication Technician",
  "General Manager",
  "HR Executive",
  "HR Manager",
  "Operations Manager",
  "Production Supervisor",
  "Quality Inspector",
  "Software Engineer",
];

export default function KpiData() {
  const showToast = useAppStore((s) => s.showToast);
  const employees = useAppStore((s) => s.employees) || [];

  const { kpis = [], indicators = [], addKpi, updateKpi, deleteKpi } = usePerformanceStore();

  const [departmentsList, setDepartmentsList] = useState([]);
  const [designationsList, setDesignationsList] = useState([]);

  useEffect(() => {
    hrmsSync.pull("departments").then((deps) => {
      if (Array.isArray(deps)) setDepartmentsList(deps);
    }).catch(() => {});
    hrmsSync.pull("designations").then((desigs) => {
      if (Array.isArray(desigs)) setDesignationsList(desigs);
    }).catch(() => {});
  }, []);

  const [search, setSearch] = useState("");
  const [empFilter, setEmpFilter] = useState("All");
  const [dept, setDept] = useState("All");
  const [desig, setDesig] = useState("All");
  const [status, setStatus] = useState("All");

  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);

  const [form, setForm] = useState({
    name: "",
    department: "",
    designation: "",
    assignedEmployee: "All in Department",
    target: "",
    measurementType: "Percentage",
    weight: 15,
    status: "Active",
  });
  const [errors, setErrors] = useState({});

  const filtered = useMemo(() => {
    return kpis.filter((r) => {
      if (search && !`${r.name} ${r.department} ${r.designation} ${r.target} ${r.assignedEmployee || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (empFilter !== "All" && r.assignedEmployee !== empFilter && r.assignedEmployee !== "All in Department") return false;
      if (dept !== "All" && r.department !== dept) return false;
      if (desig !== "All" && r.designation !== desig) return false;
      if (status !== "All" && r.status !== status) return false;
      return true;
    });
  }, [kpis, search, empFilter, dept, desig, status]);

  function validate(f) {
    const e = {};
    if (!f.name.trim()) e.name = "KPI name is required";
    if (!f.target.trim()) e.target = "Target is required";
    if (!f.department) e.department = "Department is required";
    if (!f.designation) e.designation = "Designation is required";
    if (!String(f.weight).trim() || isNaN(Number(f.weight)) || Number(f.weight) <= 0 || Number(f.weight) > 100) {
      e.weight = "Weightage must be between 1 and 100%";
    }
    return e;
  }

  function openAdd() {
    setForm({
      name: "",
      department: "",
      designation: "",
      assignedEmployee: "All in Department",
      target: "",
      measurementType: "Percentage",
      weight: 15,
      status: "Active",
    });
    setErrors({});
    setAddOpen(true);
  }

  function openEdit(r) {
    setEditRow(r);
    setForm({
      name: r.name,
      department: r.department,
      designation: r.designation,
      assignedEmployee: r.assignedEmployee || "All in Department",
      target: r.target,
      measurementType: r.measurementType || "Percentage",
      weight: r.weight,
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
      updateKpi(editRow.id, { ...form, weight: Number(form.weight) });
      showToast("KPI updated successfully.");
      setEditRow(null);
    } else {
      addKpi({ ...form, weight: Number(form.weight) });
      showToast("KPI created successfully.");
      setAddOpen(false);
    }
  }

  const cols = [
    {
      key: "name",
      header: "KPI Name",
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-semibold text-slate-800 text-[13px] block">{r.name}</span>
          <span className="text-[11px] text-slate-400">ID: {r.id}</span>
        </div>
      ),
    },
    {
      key: "target",
      header: "Target & Type",
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-semibold text-slate-800 text-[12.5px] block">{r.target}</span>
          <span className="text-[10.5px] text-slate-400">{r.measurementType || "Numeric"}</span>
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
          <span className="font-medium text-slate-800 text-[12.5px] block">{r.department}</span>
          <span className="text-[11px] text-slate-500">{r.assignedEmployee || r.designation}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "createdAt",
      header: "Created At",
      sortable: true,
      render: (r) => <span className="text-[12px] text-slate-500">{r.createdAt}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            aria-label="View"
            onClick={() => setViewRow(r)}
            className="w-7 h-7 rounded-xl hover:bg-slate-100 text-slate-600 grid place-items-center transition"
          >
            <Eye size={14} />
          </button>
          <button
            aria-label="Edit"
            onClick={() => openEdit(r)}
            className="w-7 h-7 rounded-xl hover:bg-slate-100 text-slate-600 grid place-items-center transition"
          >
            <Pencil size={14} />
          </button>
          <button
            aria-label="Delete"
            onClick={() => setDeleteRow(r)}
            className="w-7 h-7 rounded-xl hover:bg-red-50 text-red-600 grid place-items-center transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const uniqueEmployeeNames = useMemo(() => {
    return [...new Set(employees.map((e) => (e.name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const empOpts = [
    { value: "All", label: "All Employees" },
    ...uniqueEmployeeNames.map((name) => ({ value: name, label: name })),
  ];

  const allDepartments = useMemo(() => {
    return [
      ...new Set([
        ...DEFAULT_DEPARTMENTS,
        ...departmentsList.map((d) => d.name || d.title).filter(Boolean),
        ...employees.map((e) => e.department).filter(Boolean),
        ...indicators.map((r) => r.department).filter(Boolean),
        ...kpis.map((r) => r.department).filter(Boolean),
        form.department,
      ].filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
  }, [departmentsList, employees, indicators, kpis, form.department]);

  const allDesignations = useMemo(() => {
    return [
      ...new Set([
        ...DEFAULT_DESIGNATIONS,
        ...designationsList.map((d) => d.name || d.title).filter(Boolean),
        ...employees.map((e) => e.designation || e.role).filter(Boolean),
        ...indicators.map((r) => r.designation).filter(Boolean),
        ...kpis.map((r) => r.designation).filter(Boolean),
        form.designation,
      ].filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
  }, [designationsList, employees, indicators, kpis, form.designation]);

  const deptOpts = [
    { value: "All", label: "All Departments" },
    ...allDepartments.map((v) => ({ value: v, label: v })),
  ];
  const desigOpts = [
    { value: "All", label: "All Designations" },
    ...allDesignations.map((v) => ({ value: v, label: v })),
  ];
  const statusOpts = [
    { value: "All", label: "All Statuses" },
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
    { value: "Draft", label: "Draft" },
  ];

  const assignedEmployeeOpts = useMemo(() => {
    let list = employees;
    if (form.department) {
      const match = list.filter((e) => (e.department || "").toLowerCase() === form.department.toLowerCase());
      if (match.length > 0) list = match;
    }
    if (form.designation) {
      const match = list.filter((e) => (e.designation || e.role || "").toLowerCase() === form.designation.toLowerCase());
      if (match.length > 0) list = match;
    }
    const names = [...new Set(list.map((e) => (e.name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    if (form.assignedEmployee && form.assignedEmployee !== "All in Department" && !names.includes(form.assignedEmployee)) {
      names.unshift(form.assignedEmployee);
    }
    return [
      { value: "All in Department", label: "All in Department" },
      ...names.map((name) => ({ value: name, label: name })),
    ];
  }, [employees, form.department, form.designation, form.assignedEmployee]);

  function FormFields() {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
        {/* KPI Name */}
        <label className="sm:col-span-2 flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-0.5">
            KPI Name <span className="text-red-500 font-bold">*</span>
          </span>
          <input
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              if (errors.name) setErrors((err) => ({ ...err, name: "" }));
            }}
            placeholder="e.g. Sprint Velocity Stability"
            className={`w-full h-10 px-3.5 bg-slate-50/70 border rounded-xl text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs ${
              errors.name ? "border-red-500" : "border-slate-200"
            }`}
          />
          {errors.name && <span className="text-[11px] text-red-500 font-medium">{errors.name}</span>}
        </label>

        {/* Department */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-0.5">
            Department <span className="text-red-500 font-bold">*</span>
          </span>
          <div className="relative">
            <select
              value={form.department}
              onChange={(e) => {
                setForm({ ...form, department: e.target.value });
                if (errors.department) setErrors((err) => ({ ...err, department: "" }));
              }}
              className={`w-full h-10 pl-3.5 pr-10 bg-slate-50/70 border rounded-xl text-[13px] appearance-none cursor-pointer focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs ${
                errors.department ? "border-red-500" : "border-slate-200"
              } ${!form.department ? "text-slate-400" : "text-slate-800 font-medium"}`}
            >
              <option value="">Select department</option>
              {allDepartments.map((d) => (
                <option key={d} value={d} className="text-slate-800">
                  {d}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {errors.department && <span className="text-[11px] text-red-500 font-medium">{errors.department}</span>}
        </label>

        {/* Designation */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-0.5">
            Designation <span className="text-red-500 font-bold">*</span>
          </span>
          <div className="relative">
            <select
              value={form.designation}
              onChange={(e) => {
                setForm({ ...form, designation: e.target.value });
                if (errors.designation) setErrors((err) => ({ ...err, designation: "" }));
              }}
              className={`w-full h-10 pl-3.5 pr-10 bg-slate-50/70 border rounded-xl text-[13px] appearance-none cursor-pointer focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs ${
                errors.designation ? "border-red-500" : "border-slate-200"
              } ${!form.designation ? "text-slate-400" : "text-slate-800 font-medium"}`}
            >
              <option value="">Select designation</option>
              {allDesignations.map((d) => (
                <option key={d} value={d} className="text-slate-800">
                  {d}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {errors.designation && <span className="text-[11px] text-red-500 font-medium">{errors.designation}</span>}
        </label>

        {/* Employee Assignment */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700">Employee Assignment</span>
          <div className="relative">
            <select
              value={form.assignedEmployee}
              onChange={(e) => setForm({ ...form, assignedEmployee: e.target.value })}
              className="w-full h-10 pl-3.5 pr-10 bg-slate-50/70 border border-slate-200 rounded-xl text-[13px] text-slate-800 font-medium appearance-none cursor-pointer focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
            >
              {assignedEmployeeOpts.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </label>

        {/* Target */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-0.5">
            Target <span className="text-red-500 font-bold">*</span>
          </span>
          <input
            value={form.target}
            onChange={(e) => {
              setForm({ ...form, target: e.target.value });
              if (errors.target) setErrors((err) => ({ ...err, target: "" }));
            }}
            placeholder="e.g. ≥ 42 pts or ±3%"
            className={`w-full h-10 px-3.5 bg-slate-50/70 border rounded-xl text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs ${
              errors.target ? "border-red-500" : "border-slate-200"
            }`}
          />
          {errors.target && <span className="text-[11px] text-red-500 font-medium">{errors.target}</span>}
        </label>

        {/* Measurement Type */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700">Measurement Type</span>
          <div className="relative">
            <select
              value={form.measurementType}
              onChange={(e) => setForm({ ...form, measurementType: e.target.value })}
              className="w-full h-10 pl-3.5 pr-10 bg-slate-50/70 border border-slate-200 rounded-xl text-[13px] text-slate-800 font-medium appearance-none cursor-pointer focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
            >
              <option>Percentage</option>
              <option>Numeric Score</option>
              <option>Rating Score</option>
              <option>Milestone / SLA</option>
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </label>

        {/* Weightage (%) */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-0.5">
            Weightage (%) <span className="text-red-500 font-bold">*</span>
          </span>
          <div className="relative flex items-center">
            <input
              type="number"
              min={1}
              max={100}
              value={form.weight}
              onChange={(e) => {
                setForm({ ...form, weight: Number(e.target.value) });
                if (errors.weight) setErrors((err) => ({ ...err, weight: "" }));
              }}
              className={`w-full h-10 pl-3.5 pr-8 bg-slate-50/70 border rounded-xl text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs ${
                errors.weight ? "border-red-500" : "border-slate-200"
              }`}
            />
            <span className="absolute right-3.5 text-xs font-semibold text-slate-400 pointer-events-none">%</span>
          </div>
          {errors.weight && <span className="text-[11px] text-red-500 font-medium">{errors.weight}</span>}
        </label>

        {/* Status */}
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[12px] font-semibold text-slate-700">Status</span>
          <div className="relative">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full h-10 pl-3.5 pr-10 bg-slate-50/70 border border-slate-200 rounded-xl text-[13px] text-slate-800 font-medium appearance-none cursor-pointer focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
            >
              <option>Active</option>
              <option>Inactive</option>
              <option>Draft</option>
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-slate-800">Key Performance Indicators (KPI Data)</h1>
            <PageInfoButton guide={hrmsGuides.kpiData} />
          </div>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Define organizational KPIs with targets, measurement scales, and department/role assignments.
          </p>
        </div>
        <Button onClick={openAdd}>+ Add KPI</Button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearch={setSearch}
        selects={[
          { label: "Employee", value: empFilter, onChange: setEmpFilter, options: empOpts },
          { label: "Department", value: dept, onChange: setDept, options: deptOpts },
          { label: "Designation", value: desig, onChange: setDesig, options: desigOpts },
          { label: "Status", value: status, onChange: setStatus, options: statusOpts },
        ]}
        onClear={() => {
          setSearch("");
          setEmpFilter("All");
          setDept("All");
          setDesig("All");
          setStatus("All");
        }}
      />

      {/* Main DataTable */}
      <DataTable
        columns={cols}
        data={filtered}
        emptyTitle="No KPIs found"
        emptyDesc="Adjust your search criteria or create a new KPI."
        emptyAction={<Button onClick={openAdd}>+ Add KPI</Button>}
      />

      {/* Add Modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Key Performance Indicator"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save KPI</Button>
          </>
        }
      >
        {FormFields()}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editRow}
        onClose={() => setEditRow(null)}
        title="Edit Key Performance Indicator"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Changes</Button>
          </>
        }
      >
        {FormFields()}
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
                <span className="text-[11px] text-slate-400 block uppercase font-semibold">Target Criteria</span>
                <span className="font-bold text-slate-800 text-[16px]">{viewRow.target}</span>
                <span className="text-[11px] text-slate-500 block">Measurement: {viewRow.measurementType || "Percentage"}</span>
              </div>
              <StatusBadge status={viewRow.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-[#e2e8f0] rounded-xl text-[12.5px]">
              <div>
                <span className="text-slate-400 text-[11px] block">Weightage</span>
                <span className="font-bold text-slate-900 text-[14px]">{viewRow.weight}%</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Department</span>
                <span className="font-medium text-slate-800">{viewRow.department}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Designation</span>
                <span className="font-medium text-slate-800">{viewRow.designation}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Assigned Scope</span>
                <span className="font-medium text-slate-800">{viewRow.assignedEmployee || "All in Dept"}</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 pt-2 border-t border-[#e2e8f0]">
              <span>Created on: {viewRow.createdAt}</span>
            </div>
          </div>
        )}
      </Drawer>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        title="Delete KPI?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteRow) deleteKpi(deleteRow.id);
                setDeleteRow(null);
                showToast("KPI deleted successfully.");
              }}
            >
              Delete KPI
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-slate-600">
          Delete KPI <b>{deleteRow?.name}</b>? This will remove it from performance score weighting rubrics.
        </p>
      </Modal>
    </div>
  );
}
