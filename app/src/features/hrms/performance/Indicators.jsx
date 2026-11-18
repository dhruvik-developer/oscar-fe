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
import { Eye, Pencil, Trash2, Star, Target, Sliders, Layers, ChevronDown } from "lucide-react";
import PageInfoButton from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { hrmsSync } from "../../../services/hrmsSync";

const DEFAULT_BRANCHES = [
  "Headquarters",
  "Main Branch",
  "Plant 1",
  "Regional Office",
];

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

export default function Indicators() {
  const showToast = useAppStore((s) => s.showToast);
  const employees = useAppStore((s) => s.employees) || [];
  const currentUser = useAppStore((s) => s.currentUser);

  const { indicators = [], addIndicator, updateIndicator, deleteIndicator } = usePerformanceStore();

  const [departmentsList, setDepartmentsList] = useState([]);
  const [designationsList, setDesignationsList] = useState([]);
  const [locationsList, setLocationsList] = useState([]);

  useEffect(() => {
    hrmsSync.pull("departments").then((deps) => {
      if (Array.isArray(deps)) setDepartmentsList(deps);
    }).catch(() => {});
    hrmsSync.pull("designations").then((desigs) => {
      if (Array.isArray(desigs)) setDesignationsList(desigs);
    }).catch(() => {});
    hrmsSync.pull("locations").then((locs) => {
      if (Array.isArray(locs)) setLocationsList(locs);
    }).catch(() => {});
  }, []);

  const [search, setSearch] = useState("");
  const [empFilter, setEmpFilter] = useState("All");
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
    branch: "",
    department: "",
    designation: "",
    assignedEmployee: "All in Designation",
    target: "",
    measurementType: "Percentage",
    weight: 15,
    description: "",
    status: "Active",
  });
  const [errors, setErrors] = useState({});

  const filtered = useMemo(() => {
    return indicators.filter((r) => {
      if (search && !`${r.name} ${r.department} ${r.designation} ${r.target || ""} ${r.assignedEmployee || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (empFilter !== "All" && r.assignedEmployee !== empFilter && r.assignedEmployee !== "All in Designation" && r.assignedEmployee !== "All in Role") return false;
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
  }, [indicators, search, empFilter, branch, dept, desig, status, rating]);

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
      branch: "",
      department: "",
      designation: "",
      assignedEmployee: "All in Designation",
      target: "",
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
        addedBy: currentUser?.name || "",
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
            className="w-7 h-7 rounded-xl hover:bg-slate-100 text-slate-600 grid place-items-center transition"
          >
            <Eye size={14} />
          </button>
          <button
            aria-label={`Edit ${r.name}`}
            onClick={() => openEdit(r)}
            className="w-7 h-7 rounded-xl hover:bg-slate-100 text-slate-600 grid place-items-center transition"
          >
            <Pencil size={14} />
          </button>
          <button
            aria-label={`Delete ${r.name}`}
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

  const allBranches = useMemo(() => {
    return [
      ...new Set([
        ...DEFAULT_BRANCHES,
        ...locationsList.map((l) => l.name || l.title).filter(Boolean),
        ...employees.map((e) => e.location).filter(Boolean),
        ...indicators.map((r) => r.branch).filter(Boolean),
        form.branch,
      ].filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
  }, [locationsList, employees, indicators, form.branch]);

  const allDepartments = useMemo(() => {
    return [
      ...new Set([
        ...DEFAULT_DEPARTMENTS,
        ...departmentsList.map((d) => d.name || d.title).filter(Boolean),
        ...employees.map((e) => e.department).filter(Boolean),
        ...indicators.map((r) => r.department).filter(Boolean),
        form.department,
      ].filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
  }, [departmentsList, employees, indicators, form.department]);

  const allDesignations = useMemo(() => {
    return [
      ...new Set([
        ...DEFAULT_DESIGNATIONS,
        ...designationsList.map((d) => d.name || d.title).filter(Boolean),
        ...employees.map((e) => e.designation || e.role).filter(Boolean),
        ...indicators.map((r) => r.designation).filter(Boolean),
        form.designation,
      ].filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
  }, [designationsList, employees, indicators, form.designation]);

  const branchOpts = [
    { value: "All", label: "All Branches" },
    ...allBranches.map((v) => ({ value: v, label: v })),
  ];
  const deptOpts = [
    { value: "All", label: "All Departments" },
    ...allDepartments.map((v) => ({ value: v, label: v })),
  ];
  const desigOpts = [
    { value: "All", label: "All Designations" },
    ...allDesignations.map((v) => ({ value: v, label: v })),
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
    if (form.assignedEmployee && form.assignedEmployee !== "All in Designation" && !names.includes(form.assignedEmployee)) {
      names.unshift(form.assignedEmployee);
    }
    return [
      { value: "All in Designation", label: "All in Designation" },
      ...names.map((name) => ({ value: name, label: name })),
    ];
  }, [employees, form.department, form.designation, form.assignedEmployee]);

  function FormFields() {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
        {/* Indicator Name */}
        <label className="sm:col-span-2 flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-0.5">
            Indicator Name <span className="text-red-500 font-bold">*</span>
          </span>
          <input
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              if (errors.name) setErrors((err) => ({ ...err, name: "" }));
            }}
            placeholder="e.g. Code Review Thoroughness & Discipline"
            className={`w-full h-10 px-3.5 bg-slate-50/70 border rounded-xl text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs ${
              errors.name ? "border-red-500" : "border-slate-200"
            }`}
          />
          {errors.name && <span className="text-[11px] text-red-500 font-medium">{errors.name}</span>}
        </label>

        {/* Branch */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-0.5">
            Branch <span className="text-red-500 font-bold">*</span>
          </span>
          <div className="relative">
            <select
              value={form.branch}
              onChange={(e) => {
                setForm({ ...form, branch: e.target.value });
                if (errors.branch) setErrors((err) => ({ ...err, branch: "" }));
              }}
              className={`w-full h-10 pl-3.5 pr-10 bg-slate-50/70 border rounded-xl text-[13px] appearance-none cursor-pointer focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs ${
                errors.branch ? "border-red-500" : "border-slate-200"
              } ${!form.branch ? "text-slate-400" : "text-slate-800 font-medium"}`}
            >
              <option value="">Select branch</option>
              {allBranches.map((b) => (
                <option key={b} value={b} className="text-slate-800">
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {errors.branch && <span className="text-[11px] text-red-500 font-medium">{errors.branch}</span>}
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

        {/* Target Benchmark */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-0.5">
            Target Benchmark <span className="text-red-500 font-bold">*</span>
          </span>
          <input
            value={form.target}
            onChange={(e) => {
              setForm({ ...form, target: e.target.value });
              if (errors.target) setErrors((err) => ({ ...err, target: "" }));
            }}
            placeholder="e.g. ≥ 95% on-time"
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
              <option>Rating Score</option>
              <option>Numeric Score</option>
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
        <label className="flex flex-col gap-1.5">
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

        {/* Evaluation Criteria & Guidance */}
        <label className="sm:col-span-2 flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-slate-700">Evaluation Criteria & Guidance</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Specific expectations, behaviors, and rubric for measuring this indicator..."
            className="w-full p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition shadow-2xs resize-y"
          />
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
            <h1 className="text-[22px] font-bold text-slate-800">Performance Indicators</h1>
            <PageInfoButton guide={hrmsGuides.indicators} />
          </div>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Technical and organizational indicators with benchmarks, measurement types, and weightages.
          </p>
        </div>
        <Button onClick={openAdd}>+ Add Indicator</Button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearch={setSearch}
        selects={[
          { label: "Employee", value: empFilter, onChange: setEmpFilter, options: empOpts },
          { label: "Branch", value: branch, onChange: setBranch, options: branchOpts },
          { label: "Department", value: dept, onChange: setDept, options: deptOpts },
          { label: "Designation", value: desig, onChange: setDesig, options: desigOpts },
          { label: "Rating", value: rating, onChange: setRating, options: ratingOpts },
          { label: "Status", value: status, onChange: setStatus, options: statusOpts },
        ]}
        onClear={() => {
          setSearch("");
          setEmpFilter("All");
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
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Indicator</Button>
          </>
        }
      >
        {FormFields()}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editRow}
        onClose={() => setEditRow(null)}
        title="Edit Performance Indicator"
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
              <span>Added by: {viewRow.addedBy || "—"} • Created: {viewRow.createdAt}</span>
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
