import { useState, useMemo, useEffect } from "react";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { useAppStore } from "../../../stores/appStore";
import { useNavigate, useLocation } from "react-router-dom";
import { DataTable } from "../../../components/hrms/DataTable";
import { Modal } from "../../../components/hrms/Modal";
import { Button } from "../../../components/hrms/Button";
import PageHeader from "../../../components/ui/PageHeader";
import StatusBadge from "../../../components/ui/StatusBadge";
import {
  Search,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Users,
  ArrowLeft,
  Plus,
  Briefcase,
  X,
  ChevronDown,
  Building2,
  MapPin,
  Calendar,
} from "lucide-react";

const JOBS_GUIDE = {
  title: "Job Requisitions & Openings",
  subtitle: "Define staffing requisitions, specifications, target headcount, and published status.",
  purpose: "Job Openings serve as the central requisition records that candidates apply to, recruiters source for, and interview panels evaluate against.",
  workflow: [
    "Draft Specification",
    "Define Headcount & Budget",
    "Publish Requisition",
    "Collect Applications",
    "Fill & Close Position",
  ],
  keyTerms: [
    { term: "Requisition Code", definition: "Unique organizational identifier for auditing and department allocations." },
    { term: "Openings Count", definition: "Total number of approved headcount vacancies for the position." },
    { term: "Hiring Manager", definition: "The departmental leader accountable for final hiring decisions." },
    { term: "Work Mode", definition: "Designation of On-site, Hybrid, or fully Remote operational requirements." },
  ],
};

export default function Jobs() {
  const { jobs, addJob, updateJob, deleteJob } = useRecruitmentStore();
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");
  const [branch, setBranch] = useState("All");
  const [status, setStatus] = useState("All");
  const [workMode, setWorkMode] = useState("All");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (location.state?.openCreate) {
      openCreate();
    }
  }, [location.state]);
  const [form, setForm] = useState({
    title: "",
    code: "",
    department: "Engineering",
    branch: "New York",
    employmentType: "Full-time",
    experience: "3-5 years",
    openings: 1,
    description: "",
    responsibilities: "",
    requiredSkills: "",
    location: "New York",
    workMode: "Hybrid",
    recruiter: "Ayesha Khan",
    hiringManager: "David Park",
    startDate: "01 Oct 2024",
  });

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (search && !`${j.title} ${j.code}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (dept !== "All" && j.department !== dept) return false;
      if (branch !== "All" && j.branch !== branch) return false;
      if (status !== "All") {
        if (status === "Open" && !(j.status === "Open" || j.status === "Active")) return false;
        if (status === "Draft" && j.status !== "Draft") return false;
        if (status === "Closed" && !(j.status === "Closed" || j.status === "Cancelled")) return false;
      }
      if (workMode !== "All" && j.workMode !== workMode) return false;
      return true;
    });
  }, [jobs, search, dept, branch, status, workMode]);

  function openCreate() {
    setEditing(null);
    setForm({
      title: "",
      code: "",
      department: "Engineering",
      branch: "New York",
      employmentType: "Full-time",
      experience: "3-5 years",
      openings: 1,
      description: "",
      responsibilities: "",
      requiredSkills: "",
      location: "New York",
      workMode: "Hybrid",
      recruiter: "Ayesha Khan",
      hiringManager: "David Park",
      startDate: "01 Oct 2024",
    });
    setDrawerOpen(true);
  }

  function openEdit(j) {
    setEditing(j.id);
    setForm({
      title: j.title,
      code: j.code,
      department: j.department,
      branch: j.branch,
      employmentType: j.employmentType,
      experience: j.experience,
      openings: j.openings,
      description: j.description,
      responsibilities: j.responsibilities,
      requiredSkills: j.requiredSkills,
      location: j.location,
      workMode: j.workMode,
      recruiter: j.recruiter,
      hiringManager: j.hiringManager,
      startDate: j.startDate,
    });
    setDrawerOpen(true);
  }

  function save(publish) {
    if (!form.title.trim()) {
      showToast("Job Title required");
      return;
    }
    if (!form.department) {
      showToast("Department required");
      return;
    }
    if (editing) {
      updateJob(editing, {
        title: form.title,
        code: form.code || `CODE-${Date.now()}`,
        department: form.department,
        branch: form.branch,
        employmentType: form.employmentType,
        experience: form.experience,
        openings: Number(form.openings),
        description: form.description,
        responsibilities: form.responsibilities,
        requiredSkills: form.requiredSkills,
        location: form.location,
        workMode: form.workMode,
        recruiter: form.recruiter,
        hiringManager: form.hiringManager,
        status: publish ? "Open" : "Draft",
      });
      showToast(publish ? "Job published" : "Draft saved");
    } else {
      addJob({
        id: `JOB-${String(jobs.length + 1).padStart(3, "0")}`,
        title: form.title,
        code: form.code || `JOB-${Date.now()}`,
        department: form.department,
        branch: form.branch,
        employmentType: form.employmentType,
        experience: form.experience,
        openings: Number(form.openings),
        applicants: 0,
        interviews: 0,
        startDate: form.startDate,
        createdAt: "09 Sep 2026",
        status: publish ? "Open" : "Draft",
        recruiter: form.recruiter,
        hiringManager: form.hiringManager,
        description: form.description,
        responsibilities: form.responsibilities,
        requiredSkills: form.requiredSkills,
        salaryRange: "$80k",
        location: form.location,
      });
      showToast(publish ? "Job opening created successfully." : "Draft saved");
    }
    setDrawerOpen(false);
  }

  const cols = [
    {
      key: "title",
      header: "JOB —",
      sortable: true,
      render: (r) => (
        <button
          onClick={() => navigate(`/hrms/recruitment/jobs/${r.id}`)}
          className="font-medium text-[#1e3a8a] underline hover:text-[#2563eb] text-left transition"
        >
          {r.title}
        </button>
      ),
    },
    { key: "department", header: "DEPARTMENT —", sortable: true },
    { key: "branch", header: "BRANCH" },
    { key: "openings", header: "OPENINGS" },
    { key: "applicants", header: "APPLICANTS —", sortable: true },
    { key: "startDate", header: "START DATE" },
    {
      key: "status",
      header: "STATUS",
      render: (r) => {
        const st = r.status === "Open" || r.status === "Active" ? "Active" : r.status === "Closed" || r.status === "Cancelled" ? "Cancelled" : "Draft";
        if (st === "Active") {
          return <span className="px-3 py-0.5 rounded-full text-[12px] font-medium bg-[#e6f4ea] text-[#15803d] border border-[#a7f3d0]">Active</span>;
        }
        if (st === "Cancelled") {
          return <span className="px-3 py-0.5 rounded-full text-[12px] font-medium bg-[#fee2e2] text-[#dc2626] border border-[#fca5a5]">Cancelled</span>;
        }
        return <span className="px-3 py-0.5 rounded-full text-[12px] font-medium bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]">Draft</span>;
      },
    },
    { key: "createdAt", header: "CREATED AT" },
    {
      key: "actions",
      header: "ACTIONS",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1 text-slate-500">
          <button
            type="button"
            title="View Details"
            aria-label="View"
            onClick={() => navigate(`/hrms/recruitment/jobs/${r.id}`)}
            className="p-1.5 rounded-lg hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
          >
            <Eye size={15} />
          </button>
          <button
            type="button"
            title="Edit Requisition"
            aria-label="Edit"
            onClick={() => openEdit(r)}
            className="p-1.5 rounded-lg hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            title="View Applicants"
            aria-label="Applicants"
            onClick={() => navigate(`/hrms/recruitment/applications`)}
            className="p-1.5 rounded-lg hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
          >
            <Users size={15} />
          </button>
          <button
            type="button"
            title="Duplicate Requisition"
            aria-label="Duplicate"
            onClick={() => {
              addJob({ ...r, id: `JOB-${Date.now()}`, title: r.title + " Copy" });
              showToast("Job opening duplicated");
            }}
            className="p-1.5 rounded-lg hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition cursor-pointer"
          >
            <Copy size={15} />
          </button>
          <button
            type="button"
            title="Delete Job"
            aria-label="Delete"
            onClick={() => setDeleteId(r.id)}
            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  const totalOpeningsCount = jobs.reduce((acc, j) => acc + (Number(j.openings) || 0), 0);
  const totalApplicantsCount = jobs.reduce((acc, j) => acc + (Number(j.applicants) || 0), 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => navigate("/hrms/recruitment")}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors w-fit cursor-pointer group"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to Recruitment Setup</span>
      </button>

      {/* Standard PageHeader */}
      <PageHeader
        title="Job Requisitions"
        subtitle={`Manage job requisitions, headcount targets, and staffing statuses. Showing ${filtered.length} of ${jobs.length} jobs.`}
        breadcrumb={[
          { label: "Dashboard", path: "/dashboard" },
          { label: "HRMS", path: "/hrms" },
          { label: "Recruitment", path: "/hrms/recruitment" },
          { label: "Jobs", path: "/hrms/recruitment/jobs" },
        ]}
        guide={JOBS_GUIDE}
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={openCreate}>
            Create Job Opening
          </Button>
        }
      />

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Requisitions</span>
          <div className="text-2xl font-black text-text mt-1">{jobs.length}</div>
          <span className="text-[11px] text-muted font-medium">All department records</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Active Openings</span>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {jobs.filter((j) => j.status === "Open" || j.status === "Active").length}
          </div>
          <span className="text-[11px] text-muted font-medium">{totalOpeningsCount} target headcount</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Applicants</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{totalApplicantsCount}</div>
          <span className="text-[11px] text-muted font-medium">Across all open roles</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Draft Requisitions</span>
          <div className="text-2xl font-black text-slate-500 mt-1">
            {jobs.filter((j) => j.status === "Draft").length}
          </div>
          <span className="text-[11px] text-muted font-medium">Pending approval</span>
        </div>
      </div>

      {/* Modern FilterBar */}
      <div className="bg-card border border-border rounded-2xl p-3.5 flex flex-wrap items-center gap-2.5 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-full sm:max-w-[260px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job title or code..."
            className="w-full h-9 pl-9 pr-8 bg-soft border border-border rounded-xl text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary focus:bg-card transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 grid place-items-center text-muted"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="h-9 pl-3 pr-8 bg-soft border border-border rounded-xl text-xs font-semibold text-text focus:outline-none focus:border-primary cursor-pointer transition appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px_14px] bg-[right_10px_center] bg-no-repeat"
        >
          <option value="All">All Departments</option>
          <option value="Engineering">Engineering</option>
          <option value="Design">Design</option>
          <option value="HR">HR</option>
          <option value="Marketing">Marketing</option>
          <option value="Finance">Finance</option>
          <option value="Operations">Operations</option>
        </select>

        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="h-9 pl-3 pr-8 bg-soft border border-border rounded-xl text-xs font-semibold text-text focus:outline-none focus:border-primary cursor-pointer transition appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px_14px] bg-[right_10px_center] bg-no-repeat"
        >
          <option value="All">All Branches</option>
          <option value="New York">New York</option>
          <option value="London">London</option>
          <option value="Dubai">Dubai</option>
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 pl-3 pr-8 bg-soft border border-border rounded-xl text-xs font-semibold text-text focus:outline-none focus:border-primary cursor-pointer transition appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px_14px] bg-[right_10px_center] bg-no-repeat"
        >
          <option value="All">All Status</option>
          <option value="Open">Active</option>
          <option value="Draft">Draft</option>
          <option value="Closed">Closed</option>
        </select>

        <select
          value={workMode}
          onChange={(e) => setWorkMode(e.target.value)}
          className="h-9 pl-3 pr-8 bg-soft border border-border rounded-xl text-xs font-semibold text-text focus:outline-none focus:border-primary cursor-pointer transition appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px_14px] bg-[right_10px_center] bg-no-repeat"
        >
          <option value="All">All Work Mode</option>
          <option value="On-site">On-site</option>
          <option value="Hybrid">Hybrid</option>
          <option value="Remote">Remote</option>
        </select>

        {(search || dept !== "All" || branch !== "All" || status !== "All" || workMode !== "All") && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setDept("All");
              setBranch("All");
              setStatus("All");
              setWorkMode("All");
            }}
            className="h-9 px-3.5 bg-card border border-border hover:bg-soft rounded-xl text-xs font-semibold text-muted hover:text-text transition shadow-2xs cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Jobs DataTable */}
      <DataTable
        columns={cols}
        data={filtered}
        emptyTitle="No job openings found"
        emptyDesc="Create a new job requisition to start sourcing talent."
        emptyAction={
          <Button variant="primary" size="sm" icon={Plus} onClick={openCreate}>
            Create Job Opening
          </Button>
        }
      />

      {/* Create / Edit Requisition Modal */}
      <Modal
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? "Edit Job Requisition" : "Create Job Requisition"}
        subtitle={editing ? "Update position requirements and parameters" : "Define staffing requisition, headcount, and criteria"}
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => save(false)}>
              Save Draft
            </Button>
            <Button variant="primary" size="sm" onClick={() => save(true)}>
              {editing ? "Update Job" : "Publish Job"}
            </Button>
          </>
        }
      >
        <div className="space-y-5 text-xs">
          {/* Section 1 */}
          <div className="bg-soft/40 border border-border/80 rounded-2xl p-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted mb-3">
              Basic Specification
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="font-semibold text-text text-xs">Job Title *</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary transition"
                  placeholder="e.g. Senior Backend Developer"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Job Code</span>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary transition"
                  placeholder="ENG-BE-001"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Department *</span>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="h-9 px-3 bg-card border border-border rounded-xl text-xs text-text focus:outline-none focus:border-primary transition"
                >
                  <option>Engineering</option>
                  <option>Design</option>
                  <option>HR</option>
                  <option>Finance</option>
                  <option>Marketing</option>
                  <option>Operations</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Employment Type *</span>
                <select
                  value={form.employmentType}
                  onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                  className="h-9 px-3 bg-card border border-border rounded-xl text-xs text-text focus:outline-none focus:border-primary transition"
                >
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Headcount Vacancies *</span>
                <input
                  type="number"
                  min="1"
                  value={form.openings}
                  onChange={(e) => setForm({ ...form, openings: Number(e.target.value) })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text focus:outline-none focus:border-primary transition"
                />
              </label>
            </div>
          </div>

          {/* Section 2 */}
          <div className="bg-soft/40 border border-border/80 rounded-2xl p-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted mb-3">
              Description & Requirements
            </h4>
            <div className="grid gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Job Description *</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="p-3 bg-card border border-border rounded-xl text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary resize-none transition"
                  placeholder="Outline purpose and role objective..."
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Responsibilities *</span>
                <textarea
                  value={form.responsibilities}
                  onChange={(e) => setForm({ ...form, responsibilities: e.target.value })}
                  rows={2}
                  className="p-3 bg-card border border-border rounded-xl text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary resize-none transition"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Required Skills *</span>
                <input
                  value={form.requiredSkills}
                  onChange={(e) => setForm({ ...form, requiredSkills: e.target.value })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary transition"
                  placeholder="e.g. Node.js, PostgreSQL, Docker"
                />
              </label>
            </div>
          </div>

          {/* Section 3 */}
          <div className="bg-soft/40 border border-border/80 rounded-2xl p-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted mb-3">
              Location & Team
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Work Mode</span>
                <select
                  value={form.workMode}
                  onChange={(e) => setForm({ ...form, workMode: e.target.value })}
                  className="h-9 px-3 bg-card border border-border rounded-xl text-xs text-text focus:outline-none focus:border-primary transition"
                >
                  <option>On-site</option>
                  <option>Hybrid</option>
                  <option>Remote</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Location</span>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text focus:outline-none focus:border-primary transition"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Recruiter</span>
                <input
                  value={form.recruiter}
                  onChange={(e) => setForm({ ...form, recruiter: e.target.value })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text focus:outline-none focus:border-primary transition"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Hiring Manager</span>
                <input
                  value={form.hiringManager}
                  onChange={(e) => setForm({ ...form, hiringManager: e.target.value })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text focus:outline-none focus:border-primary transition"
                />
              </label>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Job Requisition?"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (deleteId) deleteJob(deleteId);
                setDeleteId(null);
                showToast("Job opening deleted successfully");
              }}
            >
              Confirm Delete
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted leading-relaxed">
          Are you sure you want to permanently remove this job requisition? Existing applicant records
          and interview schedules will be archived.
        </p>
      </Modal>
    </div>
  );
}
