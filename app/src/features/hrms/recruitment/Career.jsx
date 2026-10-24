import { useState, useMemo } from "react";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { Button } from "../../../components/hrms/Button";
import { Modal } from "../../../components/hrms/Modal";
import { useAppStore } from "../../../stores/appStore";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/ui/PageHeader";
import {
  Search,
  Building2,
  MapPin,
  Clock,
  Briefcase,
  Sparkles,
  FilterX,
  UploadCloud,
  CheckCircle2,
  FileText
} from "lucide-react";

export default function Career() {
  const jobs = useRecruitmentStore((s) => s.jobs);
  const candidates = useRecruitmentStore((s) => s.candidates);
  const addCandidate = useRecruitmentStore((s) => s.addCandidate);
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");
  const [loc, setLoc] = useState("All");
  const [type, setType] = useState("All");

  // Apply Modal state
  const [applyJob, setApplyJob] = useState(null);
  const [applyForm, setApplyForm] = useState({
    name: "",
    email: "",
    phone: "",
    experience: "3 years",
    skills: "",
    resumeAttached: false,
  });

  const liveJobs = useMemo(() => {
    return jobs.filter((j) => j.status === "Open" || j.status === "Active");
  }, [jobs]);

  const uniqueDepartments = useMemo(() => {
    const list = Array.from(new Set(liveJobs.map((j) => j.department).filter(Boolean)));
    return ["All", ...list];
  }, [liveJobs]);

  const uniqueLocations = useMemo(() => {
    const list = Array.from(new Set(liveJobs.map((j) => j.location || j.branch).filter(Boolean)));
    return ["All", ...list];
  }, [liveJobs]);

  const filtered = useMemo(() => {
    return liveJobs.filter((j) => {
      if (search && !`${j.title} ${j.department} ${j.description}`.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (dept !== "All" && j.department !== dept) return false;
      if (loc !== "All" && (j.location !== loc && j.branch !== loc)) return false;
      if (type !== "All" && j.employmentType !== type) return false;
      return true;
    });
  }, [liveJobs, search, dept, loc, type]);

  function resetFilters() {
    setSearch("");
    setDept("All");
    setLoc("All");
    setType("All");
  }

  function handleOpenApply(job) {
    setApplyJob(job);
    setApplyForm({
      name: "",
      email: "",
      phone: "",
      experience: "3 years",
      skills: job.requiredSkills || "",
      resumeAttached: false,
    });
  }

  function handleSubmitApplication() {
    if (!applyForm.name.trim() || !applyForm.email.trim()) {
      showToast("Please provide your name and email address");
      return;
    }

    const todayStr = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const newCandidate = {
      id: `CAND-${String(candidates.length + 1).padStart(3, "0")}`,
      name: applyForm.name.trim(),
      avatar: `https://i.pravatar.cc/100?img=${Math.floor(10 + Math.random() * 40)}`,
      email: applyForm.email.trim(),
      phone: applyForm.phone.trim() || "+1 (555) 019-2834",
      location: applyJob.location || applyJob.branch || "New York",
      position: applyJob.title,
      jobId: applyJob.id,
      experience: applyForm.experience || "3 years",
      appliedDate: todayStr,
      stage: "Applied",
      recruiter: applyJob.recruiter || "Ayesha Khan",
      source: "Career Portal",
      skills: applyForm.skills || applyJob.requiredSkills || "General Domain Expertise",
      interviewStatus: "Not Scheduled",
    };

    addCandidate(newCandidate);
    showToast(`Application submitted successfully for ${applyJob.title}!`);
    setApplyJob(null);
  }

  return (
    <div className="space-y-6">
      {/* Back button and page header */}
      <PageHeader
        title="Career Portal"
        subtitle="Public-facing career page preview for discovering open positions and submitting applications."
        breadcrumb={[
          { label: "HRMS", path: "/hrms" },
          { label: "Recruitment", path: "/hrms/recruitment" },
          { label: "Careers" },
        ]}
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate("/hrms/recruitment/jobs")}
            className="flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Briefcase size={14} />
            <span>Manage Job Postings</span>
          </Button>
        }
      />

      {/* Hero Banner with Integrated Search */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-8 md:p-10 shadow-lg border border-slate-800">
        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 backdrop-blur-xs">
            <Sparkles size={12} />
            <span>We are hiring • {liveJobs.length} Open Positions</span>
          </div>

          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
            Build the Future of Enterprise With Us
          </h1>
          <p className="text-slate-300 text-[13.5px] md:text-[14.5px] max-w-xl mx-auto leading-relaxed">
            Join a collaborative team pushing the frontiers of software, design, and operations. Discover open roles across our global offices.
          </p>

          {/* Search & Filter Controls */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
            <div className="relative flex-1 min-w-[220px]">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search job titles, department, or keywords..."
                className="w-full h-10 pl-9 pr-3.5 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 rounded-xl text-[13px] text-white placeholder-slate-400 outline-none backdrop-blur-xs transition"
              />
            </div>

            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="h-10 px-3 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 rounded-xl text-[13px] text-white outline-none backdrop-blur-xs transition cursor-pointer"
            >
              {uniqueDepartments.map((d) => (
                <option key={d} value={d} className="text-slate-900">
                  {d === "All" ? "All Departments" : d}
                </option>
              ))}
            </select>

            <select
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              className="h-10 px-3 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 rounded-xl text-[13px] text-white outline-none backdrop-blur-xs transition cursor-pointer"
            >
              {uniqueLocations.map((l) => (
                <option key={l} value={l} className="text-slate-900">
                  {l === "All" ? "All Locations" : l}
                </option>
              ))}
            </select>

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 px-3 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 rounded-xl text-[13px] text-white outline-none backdrop-blur-xs transition cursor-pointer"
            >
              <option value="All" className="text-slate-900">
                All Types
              </option>
              <option value="Full-time" className="text-slate-900">
                Full-time
              </option>
              <option value="Part-time" className="text-slate-900">
                Part-time
              </option>
              <option value="Contract" className="text-slate-900">
                Contract
              </option>
            </select>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Results Header */}
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
        <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
          Showing <span className="text-indigo-600 dark:text-indigo-400">{filtered.length}</span>{" "}
          Available Openings
        </span>
        {(search || dept !== "All" || loc !== "All" || type !== "All") && (
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-rose-600 transition cursor-pointer"
          >
            <FilterX size={13} />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Job Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((j) => (
          <div
            key={j.id}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition group"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-[15px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                  {j.title}
                </h3>
              </div>

              {/* Tag Chips */}
              <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md flex items-center gap-1">
                  <Building2 size={11} className="text-slate-400" />
                  <span>{j.department}</span>
                </span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md flex items-center gap-1">
                  <MapPin size={11} className="text-slate-400" />
                  <span>{j.location || j.branch}</span>
                </span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md flex items-center gap-1">
                  <Clock size={11} className="text-slate-400" />
                  <span>{j.employmentType}</span>
                </span>
              </div>

              <p className="text-[12.5px] text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                {j.description}
              </p>
            </div>

            {/* Bottom Card Actions */}
            <div className="flex items-center gap-2 mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/hrms/recruitment/jobs/${j.id}`)}
                className="flex-1"
              >
                View Job
              </Button>
              <Button
                size="sm"
                onClick={() => handleOpenApply(j)}
                className="flex-1"
              >
                Apply Now
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 grid place-items-center mx-auto mb-3">
            <Search size={20} />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white text-base">
            No matching jobs found
          </h3>
          <p className="text-[13px] text-muted max-w-sm mx-auto mt-1 mb-4">
            Try adjusting your search criteria or clearing department/location filters.
          </p>
          <Button size="sm" variant="secondary" onClick={resetFilters}>
            Clear All Filters
          </Button>
        </div>
      )}

      {/* Centered Apply Application Modal */}
      <Modal
        isOpen={!!applyJob}
        onClose={() => setApplyJob(null)}
        title={`Apply for ${applyJob?.title || "Role"}`}
        subtitle={`${applyJob?.department || "Department"} • ${applyJob?.location || applyJob?.branch || "Location"} (${applyJob?.employmentType || "Full-time"})`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApplyJob(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitApplication}>Submit Application</Button>
          </>
        }
      >
        <div className="space-y-4 text-[13px]">
          <div className="grid sm:grid-cols-2 gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300">
                Full Name *
              </span>
              <input
                value={applyForm.name}
                onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
                placeholder="e.g. Rachel Adams"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300">
                Email Address *
              </span>
              <input
                type="email"
                value={applyForm.email}
                onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
                placeholder="rachel.adams@example.com"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300">
                Phone Number
              </span>
              <input
                value={applyForm.phone}
                onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
                placeholder="+1 (555) 012-3456"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300">
                Years of Experience
              </span>
              <input
                value={applyForm.experience}
                onChange={(e) => setApplyForm({ ...applyForm, experience: e.target.value })}
                className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
                placeholder="e.g. 4 years"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300">
              Key Skills & Technologies
            </span>
            <input
              value={applyForm.skills}
              onChange={(e) => setApplyForm({ ...applyForm, skills: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
              placeholder="e.g. React, Node.js, GraphQL, PostgreSQL"
            />
          </label>

          {/* Resume Upload Dropzone */}
          <div
            onClick={() => {
              setApplyForm((p) => ({ ...p, resumeAttached: !p.resumeAttached }));
              showToast(
                !applyForm.resumeAttached
                  ? "Resume document attached: CV_Candidate.pdf"
                  : "Resume removed"
              );
            }}
            className={`border border-dashed rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
              applyForm.resumeAttached
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-400 text-emerald-800 dark:text-emerald-300"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-400"
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 shadow-xs flex items-center justify-center">
              {applyForm.resumeAttached ? (
                <CheckCircle2 size={20} className="text-emerald-600" />
              ) : (
                <UploadCloud size={20} className="text-indigo-600" />
              )}
            </div>
            <span className="font-semibold text-[12.5px] mt-1">
              {applyForm.resumeAttached ? "CV_Resume_Attached.pdf (2.1 MB)" : "Upload Resume / Portfolio (PDF or DOCX)"}
            </span>
            <span className="text-[11px] opacity-75">
              {applyForm.resumeAttached ? "Click to change attachment" : "Drag & drop file or click to browse"}
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}