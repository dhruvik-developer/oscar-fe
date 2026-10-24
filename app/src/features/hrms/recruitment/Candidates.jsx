import { useState, useMemo, useEffect } from "react";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { useAppStore } from "../../../stores/appStore";
import { useNavigate, useLocation } from "react-router-dom";
import { DataTable } from "../../../components/hrms/DataTable";
import { FilterBar } from "../../../components/hrms/FilterBar";
import { Modal } from "../../../components/hrms/Modal";
import { Button } from "../../../components/ui/Button";
import PageHeader from "../../../components/ui/PageHeader";
import StatusBadge from "../../../components/ui/StatusBadge";
import {
  ArrowLeft,
  FileText,
  Plus,
  Users,
  Eye,
  Pencil,
  Trash2,
  UploadCloud,
  CheckCircle2,
  Clock,
  Award,
  LayoutGrid,
  List,
} from "lucide-react";
import OfferLetterModal from "../organization/OfferLetterModal";
import { CandidatePipeline } from "../../../components/hrms/CandidatePipeline";

const CANDIDATES_GUIDE = {
  title: "Candidate Directory & Pipeline",
  subtitle: "Sourcing, screening, stage management, and offer letter generation.",
  purpose: "The Candidates directory stores all applicants, tracks their real-time hiring stage, records technical/HR scores, and connects to offer generation.",
  workflow: [
    "Candidate Ingestion",
    "Initial Screening",
    "Interview Evaluation",
    "Shortlist Selection",
    "Offer Letter Issuance",
    "Hired & Onboarding",
  ],
  keyTerms: [
    { term: "Hiring Stage", definition: "Current status within the recruitment pipeline (Applied, Screening, Interview, Shortlisted, Offer, Hired, Rejected)." },
    { term: "Interview Status", definition: "Indicates whether technical or HR interviews are Not Scheduled, Scheduled, Pending, or Completed." },
    { term: "Offer Generation", definition: "Seamlessly launches the official offer letter authoring modal for immediate PDF export." },
  ],
};

export default function Candidates() {
  const {
    candidates,
    jobs,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    changeStage,
    offers,
    addOffer,
    updateOffer,
  } = useRecruitmentStore();
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();
  const location = useLocation();

  const [search, setSearch] = useState("");
  const [job, setJob] = useState("All");
  const [stage, setStage] = useState("All");
  const [exp, setExp] = useState("All");
  const [viewMode, setViewMode] = useState("table");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [activeOffer, setActiveOffer] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    location: "New York",
    position: "Senior Backend Developer",
    experience: "5 years",
    skills: "Node.js",
    jobId: "JOB-001",
    stage: "Applied",
    recruiter: "Ayesha Khan",
  });

  useEffect(() => {
    if (location.state?.openAdd) {
      openAdd();
    }
  }, [location.state]);

  const uniqueJobs = useMemo(() => {
    const fromCandidates = candidates.map((c) => c.position).filter(Boolean);
    const fromJobs = jobs.map((j) => j.title).filter(Boolean);
    const list = Array.from(new Set([...fromJobs, ...fromCandidates]));
    return ["All", ...list];
  }, [candidates, jobs]);

  const uniqueStages = useMemo(() => {
    return ["All", "Applied", "Screening", "Interview", "Shortlisted", "Offer", "Hired", "Rejected"];
  }, []);

  const uniqueExp = useMemo(() => {
    const list = Array.from(new Set(candidates.map((c) => c.experience).filter(Boolean)));
    return ["All", ...list];
  }, [candidates]);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (search && !`${c.name} ${c.email} ${c.phone} ${c.id}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (job !== "All" && c.position !== job) return false;
      if (stage !== "All" && c.stage !== stage) return false;
      if (exp !== "All" && c.experience !== exp) return false;
      return true;
    });
  }, [candidates, search, job, stage, exp]);

  function openAdd() {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      location: "New York",
      position: "Senior Backend Developer",
      experience: "5 years",
      skills: "Node.js",
      jobId: "JOB-001",
      stage: "Applied",
      recruiter: "Ayesha Khan",
    });
    setDrawerOpen(true);
  }

  function save() {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      showToast("Name, Email, Phone required");
      return;
    }
    if (editing) {
      updateCandidate(editing, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        location: form.location,
        position: form.position,
        experience: form.experience,
        skills: form.skills,
        jobId: form.jobId,
        stage: form.stage,
        recruiter: form.recruiter,
      });
      showToast("Candidate updated successfully");
      setDrawerOpen(false);
    } else {
      addCandidate({
        id: `CAND-${String(candidates.length + 1).padStart(3, "0")}`,
        name: form.name,
        avatar: `https://i.pravatar.cc/100?img=${15 + (candidates.length % 50)}`,
        email: form.email,
        phone: form.phone,
        location: form.location,
        position: form.position,
        jobId: form.jobId,
        experience: form.experience,
        appliedDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        stage: form.stage,
        recruiter: form.recruiter,
        source: "Career Portal",
        skills: form.skills,
        interviewStatus: "Not Scheduled",
      });
      showToast("Candidate registered successfully");
      setDrawerOpen(false);
    }
  }

  const handleOpenOffer = (cand) => {
    const existing = offers.find((o) => o.candidateId === cand.id);
    if (existing) {
      setActiveOffer(existing);
    } else {
      setActiveOffer({
        id: `OFF-${Math.floor(100 + Math.random() * 900)}`,
        candidateId: cand.id,
        candidateName: cand.name,
        email: cand.email,
        position: cand.position,
        jobType: "Full-time",
        dept: cand.position?.includes("Design") ? "Design" : cand.position?.includes("HR") ? "HR" : "Engineering",
        salary: "$95,000 / annum",
        location: cand.location || "New York HQ",
        workMode: "Hybrid",
        sentDate: new Date().toISOString().split("T")[0],
        joiningDate: new Date(Date.now() + 21 * 86400000).toISOString().split("T")[0],
        reportingManager: "David Park (CTO)",
        probationPeriod: "3 Months",
        status: cand.stage === "Offer" || cand.stage === "Hired" ? "Confirmed" : "Draft",
      });
    }
    setIsOfferModalOpen(true);
  };

  const handleConfirmOffer = (offerData) => {
    const existingIndex = offers.findIndex((o) => o.id === offerData.id || o.candidateId === offerData.candidateId);
    if (existingIndex >= 0) {
      updateOffer(offers[existingIndex].id, { ...offerData, status: "Pending" });
    } else {
      addOffer({ ...offerData, status: "Pending" });
    }
    changeStage(offerData.candidateId, "Offer");
    showToast(`Offer letter confirmed and issued for ${offerData.candidateName}`);
  };

  const handleUpdateOffer = (offerData) => {
    updateOffer(offerData.id, offerData);
    showToast(`Offer letter updated for ${offerData.candidateName}`);
  };

  const cols = [
    {
      key: "name",
      header: "CANDIDATE",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <img
            src={r.avatar}
            alt={r.name}
            className="w-8 h-8 rounded-full object-cover border border-border shadow-2xs"
          />
          <div>
            <div className="font-bold text-text hover:text-primary transition-colors cursor-pointer" onClick={() => navigate(`/hrms/recruitment/candidates/${r.id}`)}>
              {r.name}
            </div>
            <div className="text-[11px] text-muted">{r.email}</div>
          </div>
        </div>
      ),
    },
    { key: "position", header: "APPLIED POSITION", sortable: true },
    { key: "experience", header: "EXPERIENCE" },
    { key: "appliedDate", header: "APPLIED DATE", sortable: true },
    {
      key: "stage",
      header: "STAGE",
      render: (r) => (
        <span
          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
            r.stage === "Hired"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : r.stage === "Offer"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : r.stage === "Shortlisted"
              ? "bg-purple-50 text-purple-700 border-purple-200"
              : r.stage === "Interview"
              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
              : r.stage === "Rejected"
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : "bg-soft text-text border-border"
          }`}
        >
          {r.stage}
        </span>
      ),
    },
    {
      key: "interviewStatus",
      header: "INTERVIEW",
      render: (r) => (
        <span className="text-[11px] font-medium text-muted">
          {r.interviewStatus || "Not Scheduled"}
        </span>
      ),
    },
    { key: "recruiter", header: "RECRUITER" },
    {
      key: "actions",
      header: "ACTIONS",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            title="View Profile"
            onClick={() => navigate(`/hrms/recruitment/candidates/${r.id}`)}
            className="p-1.5 rounded-lg hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-500 transition cursor-pointer"
          >
            <Eye size={15} />
          </button>
          <button
            type="button"
            title="Generate / View Offer Letter"
            onClick={() => handleOpenOffer(r)}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border font-semibold transition cursor-pointer ${
              r.stage === "Offer" || r.stage === "Hired" || offers.some((o) => o.candidateId === r.id)
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                : "bg-soft text-text border-border hover:bg-card-hover"
            }`}
          >
            <FileText size={12} />
            <span>Offer</span>
          </button>
          <button
            type="button"
            title="Edit Candidate"
            onClick={() => {
              setForm({
                name: r.name,
                email: r.email,
                phone: r.phone,
                location: r.location,
                position: r.position,
                experience: r.experience,
                skills: r.skills,
                jobId: r.jobId,
                stage: r.stage,
                recruiter: r.recruiter,
              });
              setEditing(r.id);
              setDrawerOpen(true);
            }}
            className="p-1.5 rounded-lg hover:text-slate-800 hover:bg-slate-100 text-slate-500 transition cursor-pointer"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            title="Delete Candidate"
            onClick={() => setDeleteId(r.id)}
            className="p-1.5 rounded-lg hover:text-rose-700 hover:bg-rose-50 text-rose-500 transition cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

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
        title="Candidate Pipeline & Roster"
        subtitle={`Track applications, evaluate candidates, and manage hiring stages. Showing ${filtered.length} of ${candidates.length} candidates.`}
        breadcrumb={[
          { label: "Dashboard", path: "/dashboard" },
          { label: "HRMS", path: "/hrms" },
          { label: "Recruitment", path: "/hrms/recruitment" },
          { label: "Candidates", path: "/hrms/recruitment/candidates" },
        ]}
        guide={CANDIDATES_GUIDE}
        actions={
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">
            <div className="inline-flex items-center bg-soft border border-border rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === "table"
                    ? "bg-card text-primary shadow-2xs border border-border"
                    : "text-muted hover:text-text"
                }`}
              >
                <List size={14} />
                <span>Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === "kanban"
                    ? "bg-card text-primary shadow-2xs border border-border"
                    : "text-muted hover:text-text"
                }`}
              >
                <LayoutGrid size={14} />
                <span>Kanban Pipeline</span>
              </button>
            </div>
            <Button variant="primary" size="sm" icon={Plus} onClick={openAdd}>
              Add Candidate
            </Button>
          </div>
        }
      />

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Applicants</span>
          <div className="text-2xl font-black text-text mt-1">{candidates.length}</div>
          <span className="text-[11px] text-muted font-medium">Registered in talent pool</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">In Evaluation</span>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {candidates.filter((c) => c.stage === "Screening" || c.stage === "Interview").length}
          </div>
          <span className="text-[11px] text-muted font-medium">Active screening & rounds</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Shortlisted / Offers</span>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {candidates.filter((c) => c.stage === "Shortlisted" || c.stage === "Offer").length}
          </div>
          <span className="text-[11px] text-muted font-medium">High qualification fit</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Successfully Hired</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {candidates.filter((c) => c.stage === "Hired").length}
          </div>
          <span className="text-[11px] text-muted font-medium">Transferred to onboarding</span>
        </div>
      </div>

      {/* Main Content: Kanban Drag & Drop Pipeline vs DataTable */}
      {viewMode === "kanban" ? (
        <CandidatePipeline
          onSelectCandidate={(c) => navigate(`/hrms/recruitment/candidates/${c.id}`)}
        />
      ) : (
        <>
          {/* FilterBar */}
          <FilterBar
            search={search}
            onSearch={setSearch}
            placeholder="Search by candidate name, email, phone..."
            selects={[
              {
                label: "Job",
                value: job,
                onChange: setJob,
                options: uniqueJobs.map((j) => ({ value: j, label: j === "All" ? "All Jobs" : j })),
              },
              {
                label: "Stage",
                value: stage,
                onChange: setStage,
                options: uniqueStages.map((s) => ({ value: s, label: s === "All" ? "All Stages" : s })),
              },
              {
                label: "Experience",
                value: exp,
                onChange: setExp,
                options: uniqueExp.map((e) => ({ value: e, label: e === "All" ? "All Experience" : e })),
              },
            ]}
            onClear={() => {
              setSearch("");
              setJob("All");
              setStage("All");
              setExp("All");
            }}
          />

          {/* Main Candidates DataTable */}
          <DataTable
            columns={cols}
            data={filtered}
            emptyTitle="No candidates found"
            emptyDesc="Adjust filters or register a new candidate."
            emptyAction={
              <Button variant="primary" size="sm" icon={Plus} onClick={openAdd}>
                Add Candidate
              </Button>
            }
          />
        </>
      )}

      {/* Add / Edit Candidate Modal */}
      <Modal
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? "Edit Candidate Profile" : "Register Candidate"}
        subtitle="Capture applicant details, role requisition, and hiring stage"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={save}>
              {editing ? "Update Candidate" : "Save Candidate"}
            </Button>
          </>
        }
      >
        <div className="space-y-5 text-xs">
          {/* Personal Information */}
          <div className="bg-soft/40 border border-border/80 rounded-2xl p-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted mb-3">
              Personal Information
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Full Name *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary transition"
                  placeholder="e.g. Elena Rostova"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Email Address *</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary transition"
                  placeholder="elena.r@example.com"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Phone Number *</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary transition"
                  placeholder="+1 (555) 012-3456"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Location / City</span>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary transition"
                  placeholder="New York, NY"
                />
              </label>
            </div>
          </div>

          {/* Application Details */}
          <div className="bg-soft/40 border border-border/80 rounded-2xl p-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted mb-3">
              Application & Qualifications
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Applied Position *</span>
                <select
                  value={form.position}
                  onChange={(e) => {
                    const matched = jobs.find((j) => j.title === e.target.value);
                    setForm({
                      ...form,
                      position: e.target.value,
                      jobId: matched?.id || form.jobId,
                    });
                  }}
                  className="h-9 px-3 bg-card border border-border rounded-xl text-xs text-text focus:outline-none focus:border-primary transition"
                >
                  {jobs.map((j) => (
                    <option key={j.id} value={j.title}>
                      {j.title} ({j.department})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Experience Level</span>
                <input
                  value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary transition"
                  placeholder="e.g. 4 years"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Primary Skills</span>
                <input
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  className="h-9 px-3.5 bg-card border border-border rounded-xl text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary transition"
                  placeholder="e.g. React, Node.js, AWS"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-semibold text-text text-xs">Current Pipeline Stage</span>
                <select
                  value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value })}
                  className="h-9 px-3 bg-card border border-border rounded-xl text-xs text-text focus:outline-none focus:border-primary transition"
                >
                  <option>Applied</option>
                  <option>Screening</option>
                  <option>Interview</option>
                  <option>Shortlisted</option>
                  <option>Offer</option>
                  <option>Hired</option>
                  <option>Rejected</option>
                </select>
              </label>
            </div>
          </div>

          {/* Resume Upload Dropzone */}
          <div className="border border-dashed border-border rounded-2xl p-5 bg-card text-center flex flex-col items-center justify-center gap-1.5 text-muted hover:border-primary transition cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <UploadCloud size={20} />
            </div>
            <span className="font-bold text-xs text-text mt-1">Upload Resume or CV (PDF, DOCX)</span>
            <span className="text-[11px] text-muted">Drag & drop files or click to browse</span>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Candidate Record?"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (deleteId) deleteCandidate(deleteId);
                setDeleteId(null);
                showToast("Candidate record removed");
              }}
            >
              Confirm Delete
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted leading-relaxed">
          Are you sure you want to permanently remove this candidate record? Associated interview logs
          and offer drafts will be removed.
        </p>
      </Modal>

      {/* Offer Letter Live Editor & PDF Issuance Modal */}
      <OfferLetterModal
        isOpen={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
        offer={activeOffer}
        onConfirmOffer={handleConfirmOffer}
        onUpdateOffer={handleUpdateOffer}
      />
    </div>
  );
}
