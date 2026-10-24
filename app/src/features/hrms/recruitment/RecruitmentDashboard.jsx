import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { useAppStore } from "../../../stores/appStore";
import { useNavigate } from "react-router-dom";
import { CandidatePipeline } from "../../../components/hrms/CandidatePipeline";
import PageHeader from "../../../components/ui/PageHeader";
import {
  Users,
  Briefcase,
  Calendar,
  Award,
  UserCheck,
  TrendingUp,
  Plus,
  Video,
  MapPin,
  ExternalLink,
  ArrowRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";

const RECRUITMENT_GUIDE = {
  title: "Recruitment Operations",
  subtitle: "End-to-end talent acquisition, candidate pipeline, and hiring lifecycle.",
  purpose: "The Recruitment module orchestrates job requisition, applicant tracking, interview rounds, offer letter generation, and onboarding handoff into the employee directory.",
  workflow: [
    "Job Requisition",
    "Candidate Application",
    "Screening & Interviews",
    "Shortlisting & Evaluation",
    "Offer Letter Issued",
    "Employee Onboarding",
  ],
  keyTerms: [
    { term: "Candidate Pipeline", definition: "Visual progression tracking candidates across stages from Applied to Hired." },
    { term: "Interview Rounds", definition: "Technical, HR, and managerial evaluations scheduled with real-time video links." },
    { term: "Offer Generation", definition: "Live interactive offer letter authoring, CTC compensation formulation, and PDF issuance." },
    { term: "Onboarding Handoff", definition: "Seamless transition converting hired candidates into active employee directory records." },
  ],
};

export default function RecruitmentDashboard() {
  const { jobs, candidates, interviews, offers, changeStage } = useRecruitmentStore();
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();

  const openPositionsCount = jobs.filter((j) => j.status === "Open" || j.status === "Active").length;
  const pendingOffersCount = offers.filter((o) => o.status === "Pending").length;
  const hiredCount = candidates.filter((c) => c.stage === "Hired").length;

  const kpis = [
    {
      label: "Open Positions",
      value: String(openPositionsCount),
      sub: `${jobs.length} total jobs`,
      to: "/hrms/recruitment/jobs",
      icon: Briefcase,
      color: "blue",
      badgeBg: "bg-blue-50 dark:bg-blue-950/40",
      badgeFg: "text-blue-600 dark:text-blue-400",
      borderCol: "border-blue-100 dark:border-blue-900/40",
    },
    {
      label: "Total Candidates",
      value: String(candidates.length),
      sub: `${candidates.filter((c) => c.stage !== "Hired" && c.stage !== "Rejected").length} in pipeline`,
      to: "/hrms/recruitment/candidates",
      icon: Users,
      color: "teal",
      badgeBg: "bg-teal-50 dark:bg-teal-950/40",
      badgeFg: "text-teal-600 dark:text-teal-400",
      borderCol: "border-teal-100 dark:border-teal-900/40",
    },
    {
      label: "Interviews",
      value: String(interviews.length),
      sub: `Scheduled: ${interviews.filter((i) => i.status === "Scheduled").length}`,
      to: "/hrms/recruitment/interviews",
      icon: Calendar,
      color: "purple",
      badgeBg: "bg-purple-50 dark:bg-purple-950/40",
      badgeFg: "text-purple-600 dark:text-purple-400",
      borderCol: "border-purple-100 dark:border-purple-900/40",
    },
    {
      label: "Pending Offers",
      value: String(pendingOffersCount),
      sub: `${offers.length} Total Offers`,
      to: "/hrms/recruitment/offers",
      icon: Award,
      color: "amber",
      badgeBg: "bg-amber-50 dark:bg-amber-950/40",
      badgeFg: "text-amber-600 dark:text-amber-400",
      borderCol: "border-amber-100 dark:border-amber-900/40",
    },
    {
      label: "Hired Talent",
      value: String(hiredCount),
      sub: "Ready for Onboarding",
      to: "/hrms/recruitment/onboarding",
      icon: UserCheck,
      color: "emerald",
      badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
      badgeFg: "text-emerald-600 dark:text-emerald-400",
      borderCol: "border-emerald-100 dark:border-emerald-900/40",
    },
  ];

  const todays = interviews.filter((i) => i.status === "Scheduled").slice(0, 2);
  const upcoming = interviews.filter((i) => i.status === "Scheduled").slice(0, 4);
  const shortlisted = candidates.filter((c) => c.stage === "Shortlisted").slice(0, 3);
  const recent = candidates.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* Canonical Unified PageHeader */}
      <PageHeader
        title="Recruitment Operations"
        subtitle="Manage candidate pipeline, conduct interviews, formulate offers, and oversee onboarding handoffs."
        breadcrumb={[
          { label: "Dashboard", path: "/dashboard" },
          { label: "HRMS", path: "/hrms" },
          { label: "Recruitment", path: "/hrms/recruitment" },
        ]}
        guide={RECRUITMENT_GUIDE}
        actions={
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Users}
              onClick={() => navigate("/hrms/recruitment/candidates", { state: { openAdd: true } })}
            >
              Add Candidate
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => navigate("/hrms/recruitment/jobs", { state: { openCreate: true } })}
            >
              Create Job Opening
            </Button>
          </div>
        }
      />

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {kpis.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => navigate(k.to)}
            className="bg-card border border-border rounded-2xl p-4 shadow-2xs hover:shadow-xs hover:border-primary/40 transition-all text-left group cursor-pointer flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold tracking-wider uppercase text-muted">
                {k.label}
              </span>
              <div
                className={`w-9 h-9 rounded-xl ${k.badgeBg} ${k.badgeFg} border ${k.borderCol} flex items-center justify-center transition-transform group-hover:scale-105`}
              >
                <k.icon size={16} strokeWidth={2.2} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-text tracking-tight">{k.value}</div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                <TrendingUp size={12} />
                <span>{k.sub}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick Navigation Action Strip */}
      <div className="bg-card border border-border rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted px-2">
            Quick Actions:
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              icon={Plus}
              onClick={() => navigate("/hrms/recruitment/jobs", { state: { openCreate: true } })}
            >
              New Job
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={Users}
              onClick={() => navigate("/hrms/recruitment/candidates", { state: { openAdd: true } })}
            >
              Add Candidate
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={Calendar}
              onClick={() => navigate("/hrms/recruitment/interviews", { state: { openSchedule: true } })}
            >
              Schedule Interview
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={Award}
              onClick={() => navigate("/hrms/recruitment/offers", { state: { openCreate: true } })}
            >
              Create Offer
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/hrms/recruitment/candidates")}
            className="text-xs font-semibold text-primary hover:underline px-2 cursor-pointer inline-flex items-center gap-1"
          >
            <span>All Candidates</span>
            <ChevronRight size={13} />
          </button>
          <span className="text-border">|</span>
          <button
            type="button"
            onClick={() => navigate("/hrms/recruitment/interviews")}
            className="text-xs font-semibold text-primary hover:underline px-2 cursor-pointer inline-flex items-center gap-1"
          >
            <span>Interview Schedule</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Interviews Grid: Today's & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Today's Interviews Card */}
        <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold">
                  <Calendar size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-text">Today's Scheduled Interviews</h3>
                  <p className="text-[11px] text-muted">Real-time candidate meetings and evaluation sessions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/hrms/recruitment/interviews")}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                View Full Calendar
              </button>
            </div>

            {todays.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted flex flex-col items-center justify-center">
                <Calendar size={28} className="text-muted/50 mb-2" />
                <p className="font-semibold text-text">No interviews scheduled for today</p>
                <p className="text-[11px] text-muted mt-0.5">Upcoming interviews will be listed here automatically.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {todays.map((it) => (
                  <div
                    key={it.id}
                    className="rounded-xl p-4 bg-soft border border-border/80 hover:border-primary/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={it.avatar}
                        alt={it.candidateName}
                        className="w-11 h-11 rounded-full object-cover border border-border shrink-0 shadow-2xs"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-text">{it.candidateName}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                            {it.type}
                          </span>
                        </div>
                        <p className="text-xs text-muted font-medium mt-0.5">{it.job}</p>
                        <div className="flex items-center gap-3 text-[11px] text-muted mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 font-semibold text-text">
                            <Clock size={12} className="text-primary" />
                            {it.start} - {it.end} ({it.duration})
                          </span>
                          <span>•</span>
                          <span>Interviewer: <b className="text-text">{it.interviewer}</b></span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            {it.mode === "Video Call" ? (
                              <span className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                                <Video size={12} /> Google Meet
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-600">
                                <MapPin size={12} /> {it.location}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                      {it.meetingLink && (
                        <Button
                          size="sm"
                          variant="primary"
                          icon={ExternalLink}
                          onClick={() => window.open(it.meetingLink, "_blank")}
                        >
                          Join Meet
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/hrms/recruitment/candidates/${it.candidateId}`)}
                      >
                        Profile
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Interviews Pipeline */}
        <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                <h3 className="font-bold text-sm text-text">Upcoming Schedule</h3>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-soft rounded-full text-muted border border-border">
                {upcoming.length} Next
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5">
              {upcoming.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => navigate(`/hrms/recruitment/interviews/${it.id}`)}
                  className="w-full text-left rounded-xl p-3 bg-soft hover:bg-card-hover border border-border transition flex items-center justify-between gap-2 group cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-text group-hover:text-primary transition-colors truncate">
                      {it.candidateName}
                    </div>
                    <div className="text-[11px] text-muted truncate">{it.type} • {it.job}</div>
                    <div className="text-[10px] font-semibold text-primary mt-1 flex items-center gap-1">
                      <Clock size={10} />
                      <span>{it.date} • {it.start}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-muted group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              ))}

              {upcoming.length === 0 && (
                <div className="py-8 text-center text-xs text-muted">
                  No upcoming interviews scheduled.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-border mt-3 text-center">
            <button
              type="button"
              onClick={() => navigate("/hrms/recruitment/interviews", { state: { openSchedule: true } })}
              className="text-xs font-bold text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <Plus size={13} /> Schedule New Interview
            </button>
          </div>
        </div>
      </div>

      {/* Requires Your Attention Notification Matrix */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={16} className="text-amber-500" />
          <h3 className="font-bold text-sm text-text">Requires Action & Follow-Up</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              title: "3 Interviews scheduled today",
              desc: "Ensure interview rooms and links are active.",
              to: "/hrms/recruitment/interviews",
              badge: "Action Required",
              badgeStyle: "bg-blue-50 text-blue-700 border-blue-200",
            },
            {
              title: "5 Candidates waiting for screening",
              desc: "Profiles submitted via Careers and LinkedIn.",
              to: "/hrms/recruitment/candidates",
              badge: "Review",
              badgeStyle: "bg-purple-50 text-purple-700 border-purple-200",
            },
            {
              title: "2 Shortlisted candidates waiting for final round",
              desc: "Manager approvals submitted.",
              to: "/hrms/recruitment/candidates",
              badge: "Decision",
              badgeStyle: "bg-indigo-50 text-indigo-700 border-indigo-200",
            },
            {
              title: `${pendingOffersCount} Offers awaiting candidate signature`,
              desc: "Track offer expiration and status.",
              to: "/hrms/recruitment/offers",
              badge: "Pending",
              badgeStyle: "bg-amber-50 text-amber-700 border-amber-200",
            },
            {
              title: "2 Job openings closing within 7 days",
              desc: "Review final applicant counts.",
              to: "/hrms/recruitment/jobs",
              badge: "Closing Soon",
              badgeStyle: "bg-rose-50 text-rose-700 border-rose-200",
            },
            {
              title: "3 Candidates awaiting recruiter response",
              desc: "Application acknowledgement pending.",
              to: "/hrms/recruitment/applications",
              badge: "Communication",
              badgeStyle: "bg-teal-50 text-teal-700 border-teal-200",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl p-3.5 bg-soft/60 border border-border hover:border-primary/40 transition flex items-start justify-between gap-3"
            >
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeStyle}`}>
                  {item.badge}
                </span>
                <div className="text-xs font-bold text-text mt-1.5 leading-snug">{item.title}</div>
                <p className="text-[11px] text-muted mt-0.5">{item.desc}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(item.to)}
                className="shrink-0 text-[11px]"
              >
                View
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Modern Candidate Pipeline Board */}
      <CandidatePipeline />

      {/* Recent Candidates & Shortlisted Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Candidates Table */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-5 shadow-2xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-sm text-text">Recent Candidate Submissions</h3>
                <p className="text-[11px] text-muted">Latest talent applications across all active requisitions</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/hrms/recruitment/candidates")}
              >
                View All Candidates
              </Button>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-[10.5px] font-bold text-muted uppercase tracking-wider bg-table-head">
                    <th className="py-2.5 px-3">Candidate</th>
                    <th className="py-2.5 px-3">Position</th>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {recent.map((c) => (
                    <tr key={c.id} className="hover:bg-card-hover transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={c.avatar}
                            alt={c.name}
                            className="w-7 h-7 rounded-full object-cover border border-border shadow-2xs"
                          />
                          <div>
                            <div className="font-bold text-text">{c.name}</div>
                            <div className="text-[10px] text-muted">{c.experience}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-text font-medium">{c.position}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-soft border border-border rounded-full text-text">
                          {c.stage}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/hrms/recruitment/candidates/${c.id}`)}
                          className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Shortlisted Candidates Ready for Offer */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-sm text-text">Shortlisted Talent</h3>
                <p className="text-[11px] text-muted">Ready for final interviews or formal offers</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                {shortlisted.length} Qualified
              </span>
            </div>

            {shortlisted.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                No candidates in shortlisted stage right now.
              </div>
            ) : (
              <div className="mt-3.5 space-y-3">
                {shortlisted.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl bg-soft border border-border/80 hover:border-primary/40 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={c.avatar}
                          alt={c.name}
                          className="w-8 h-8 rounded-full object-cover border border-border shadow-2xs"
                        />
                        <div>
                          <div className="text-xs font-bold text-text">{c.name}</div>
                          <div className="text-[11px] text-muted">{c.position}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full">
                        {c.recommendation || "Recommended"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-muted mt-2 pt-2 border-t border-border/60">
                      <span>Tech Score: <b className="text-text">{c.technicalScore || 85}%</b></span>
                      <span>HR Score: <b className="text-text">{c.hrScore || 90}%</b></span>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-2.5 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/hrms/recruitment/candidates/${c.id}`)}
                      >
                        Profile
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          changeStage(c.id, "Offer");
                          showToast(`Candidate ${c.name} moved to Offer stage.`);
                          navigate("/hrms/recruitment/offers", { state: { openCreate: true } });
                        }}
                      >
                        Issue Offer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Job Openings Table Card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="font-bold text-sm text-text">Active Job Openings</h3>
            <p className="text-[11px] text-muted">Positions actively receiving candidates</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/hrms/recruitment/jobs")}
          >
            Manage All Jobs
          </Button>
        </div>

        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-border text-[10.5px] font-bold text-muted uppercase tracking-wider bg-table-head">
                <th className="py-2.5 px-3">Job Title</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Location / Branch</th>
                <th className="py-2.5 px-3 text-center">Openings</th>
                <th className="py-2.5 px-3 text-center">Applicants</th>
                <th className="py-2.5 px-3 text-center">Interviews</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {jobs
                .filter((j) => j.status === "Open" || j.status === "Active")
                .slice(0, 5)
                .map((j) => (
                  <tr key={j.id} className="hover:bg-card-hover transition-colors">
                    <td className="py-2.5 px-3 font-bold text-text">{j.title}</td>
                    <td className="py-2.5 px-3 text-muted">{j.department}</td>
                    <td className="py-2.5 px-3 text-muted">{j.branch || j.location}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-text">{j.openings}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-blue-600">{j.applicants}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-purple-600">{j.interviews}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                        {j.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/hrms/recruitment/jobs/${j.id}`)}
                        className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                      >
                        View Requisition
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
