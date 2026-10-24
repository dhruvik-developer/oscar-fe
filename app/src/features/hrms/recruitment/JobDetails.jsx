import { useParams, useNavigate } from "react-router-dom";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { Button } from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import PageInfoButton from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  MapPin,
  Clock,
  Users,
  Calendar,
  CheckCircle2,
  FileText,
  UserCheck,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

export default function JobDetails() {
  const { id } = useParams();
  const jobs = useRecruitmentStore((s) => s.jobs);
  const candidates = useRecruitmentStore((s) => s.candidates);
  const navigate = useNavigate();

  const job = jobs.find((j) => j.id === id);

  if (!job) {
    return (
      <div className="py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <Briefcase size={22} />
        </div>
        <h3 className="text-base font-bold text-text">Job Requisition Not Found</h3>
        <p className="text-xs text-muted mt-1">The requested job opening ID does not exist or was removed.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/hrms/recruitment/jobs")}
          className="mt-4"
        >
          Back to Jobs Directory
        </Button>
      </div>
    );
  }

  const applicants = candidates.filter(
    (c) => c.jobId === job.id || c.position?.toLowerCase() === job.title?.toLowerCase()
  );

  const stats = [
    { label: "Applicants", value: applicants.length, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-100 dark:border-blue-900/40" },
    { label: "Screening", value: applicants.filter((a) => a.stage === "Screening").length, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/40", border: "border-cyan-100 dark:border-cyan-900/40" },
    { label: "Interviews", value: applicants.filter((a) => a.stage === "Interview").length, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/40", border: "border-purple-100 dark:border-purple-900/40" },
    { label: "Shortlisted", value: applicants.filter((a) => a.stage === "Shortlisted").length, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-100 dark:border-indigo-900/40" },
    { label: "Offers Issued", value: applicants.filter((a) => a.stage === "Offer").length, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-100 dark:border-amber-900/40" },
    { label: "Hired", value: applicants.filter((a) => a.stage === "Hired").length, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-100 dark:border-emerald-900/40" },
  ];

  const timelineEvents = [
    { title: "Job Requisition Created", date: job.createdAt || "15 Sep 2024", done: true },
    { title: "Applications Intake Started", date: job.startDate || "01 Oct 2024", done: true },
    { title: "First Candidate Interviews", date: "10 Oct 2024", done: true },
    { title: "Candidate Shortlisting Round", date: "15 Oct 2024", done: applicants.some((a) => a.stage === "Shortlisted" || a.stage === "Offer" || a.stage === "Hired") },
    { title: "Formal Offer Formulated", date: "20 Oct 2024", done: applicants.some((a) => a.stage === "Offer" || a.stage === "Hired") },
    { title: "Candidate Hired & Onboarding", date: "25 Oct 2024", done: applicants.some((a) => a.stage === "Hired") },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Back Navigation */}
      <button
        type="button"
        onClick={() => navigate("/hrms/recruitment/jobs")}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors w-fit cursor-pointer group"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to Jobs</span>
      </button>

      {/* Entity Hero Card */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center shrink-0">
              <Briefcase size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[20px] font-extrabold tracking-tight text-slate-900">{job.title}</h1>
                <PageInfoButton guide={hrmsGuides.jobDetails} />
                <span className="font-mono text-xs px-2 py-0.5 bg-soft border border-border rounded-md text-muted">
                  {job.code || job.id}
                </span>
                <StatusBadge status={job.status === "Open" || job.status === "Active" ? "Active" : job.status === "Draft" ? "Draft" : "Cancelled"} />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted font-medium mt-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <Building2 size={13} className="text-muted" />
                  {job.department}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-muted" />
                  {job.branch || job.location} ({job.workMode})
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock size={13} className="text-muted" />
                  {job.employmentType}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-primary font-semibold">
                  <Users size={13} />
                  {job.openings} approved vacancies
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/hrms/recruitment/jobs")}
            >
              All Jobs
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Users}
              onClick={() => navigate("/hrms/recruitment/applications")}
            >
              View Applicants ({job.applicants || applicants.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Main Two-Column Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Requisition Details */}
        <div className="lg:col-span-7 space-y-5">
          {/* Job Description Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                Job Overview & Purpose
              </h3>
              <p className="text-xs text-text leading-relaxed">
                {job.description || "No specific job description provided."}
              </p>
            </div>

            <div className="pt-3 border-t border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                Core Responsibilities
              </h3>
              <p className="text-xs text-text leading-relaxed whitespace-pre-line">
                {job.responsibilities || "Design and implement production features, review architectural decisions, collaborate across product and engineering."}
              </p>
            </div>

            <div className="pt-3 border-t border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                Required Technical Skills
              </h3>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(job.requiredSkills ? job.requiredSkills.split(",") : ["React", "TypeScript", "Node.js"]).map((sk) => (
                  <span
                    key={sk}
                    className="text-xs font-semibold px-2.5 py-1 bg-soft border border-border rounded-lg text-text"
                  >
                    {sk.trim()}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Hiring Team & Parameters Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
              Requisition Team & Compensation
            </h3>
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-soft/50 border border-border/80 rounded-xl p-3">
                <span className="text-[10px] font-bold uppercase text-muted block">Lead Recruiter</span>
                <span className="font-bold text-text mt-0.5 block">{job.recruiter || "Ayesha Khan"}</span>
                <span className="text-[11px] text-muted">Talent Acquisition Lead</span>
              </div>
              <div className="bg-soft/50 border border-border/80 rounded-xl p-3">
                <span className="text-[10px] font-bold uppercase text-muted block">Hiring Manager</span>
                <span className="font-bold text-text mt-0.5 block">{job.hiringManager || "David Park"}</span>
                <span className="text-[11px] text-muted">Department Lead</span>
              </div>
              <div className="bg-soft/50 border border-border/80 rounded-xl p-3">
                <span className="text-[10px] font-bold uppercase text-muted block">Approved Compensation</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{job.salaryRange || "$85,000 - $115,000 / annum"}</span>
                <span className="text-[11px] text-muted">Includes base + bonus</span>
              </div>
              <div className="bg-soft/50 border border-border/80 rounded-xl p-3">
                <span className="text-[10px] font-bold uppercase text-muted block">Required Experience</span>
                <span className="font-bold text-text mt-0.5 block">{job.experience || "3-5 years"}</span>
                <span className="text-[11px] text-muted">Relevant industry background</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Statistics & Recruitment Milestones */}
        <div className="lg:col-span-5 space-y-5">
          {/* Recruitment Funnel Stats */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Pipeline Metric Breakdown
              </h3>
              <span className="text-[10px] font-bold text-primary bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/40">
                Live Funnel
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3.5">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className={`rounded-xl p-3 border ${s.bg} ${s.border} text-center`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block truncate">
                    {s.label}
                  </span>
                  <span className={`text-xl font-black ${s.color} mt-1 block`}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recruitment Lifecycle Timeline */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
              Requisition Lifecycle Milestones
            </h3>
            <div className="relative pl-6 space-y-4 border-l border-border/80 text-xs">
              {timelineEvents.map((t, idx) => (
                <div key={idx} className="relative">
                  <span
                    className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      t.done
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-card border-border text-muted"
                    }`}
                  >
                    {t.done && <CheckCircle2 size={10} strokeWidth={3} />}
                  </span>
                  <div>
                    <div className={`font-bold ${t.done ? "text-text" : "text-muted"}`}>
                      {t.title}
                    </div>
                    <div className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                      <Calendar size={11} />
                      <span>{t.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
