import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import PageHeader from "../../../components/ui/PageHeader";
import DataTable from "../../../components/ui/DataTable";
import StatusBadge from "../../../components/ui/StatusBadge";
import { Button } from "../../../components/hrms/Button";
import {
  Users,
  Briefcase,
  Layers,
  Calendar,
  FileText,
  UserCheck,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  Plus
} from "lucide-react";

export default function Recruitment() {
  const navigate = useNavigate();
  const [guideOpen, setGuideOpen] = useState(false);

  const candidates = useRecruitmentStore((s) => s.candidates);
  const jobs = useRecruitmentStore((s) => s.jobs);
  const interviews = useRecruitmentStore((s) => s.interviews);
  const offers = useRecruitmentStore((s) => s.offers);

  const tableData = useMemo(() => {
    return candidates.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.position,
      dept: c.position?.includes("Design")
        ? "Design"
        : c.position?.includes("HR")
        ? "HR"
        : c.position?.includes("Finance")
        ? "Finance"
        : "Engineering",
      stage: c.stage,
      applied: c.appliedDate || "10 Sep 2026",
      source: c.source || "Direct",
      status: c.stage === "Rejected" ? "Inactive" : "Active",
      avatar: c.avatar,
    }));
  }, [candidates]);

  const COLUMNS = [
    {
      key: "name",
      label: "Candidate",
      sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-2.5">
          <img
            src={row.avatar}
            alt=""
            className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
          />
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-100 block text-[13px]">
              {val}
            </span>
            <span className="text-[11px] text-muted block">{row.id}</span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Applied Role",
      sortable: true,
      render: (val, row) => (
        <div>
          <span className="font-medium text-slate-800 dark:text-slate-200 text-[12.5px] block">
            {val}
          </span>
          <span className="text-[11px] text-muted block">{row.dept}</span>
        </div>
      ),
    },
    {
      key: "stage",
      label: "Stage",
      render: (val) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
          {val}
        </span>
      ),
    },
    {
      key: "applied",
      label: "Applied On",
      render: (val) => <span className="text-[12px] text-slate-600 dark:text-slate-300">{val}</span>,
    },
    {
      key: "source",
      label: "Source",
      render: (val) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          {val}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, row) => (
        <button
          onClick={() => navigate(`/hrms/recruitment/candidates/${row.id}`)}
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition cursor-pointer"
        >
          <span>Manage</span>
          <ArrowRight size={12} />
        </button>
      ),
    },
  ];

  const submodules = [
    {
      title: "Recruitment Dashboard",
      desc: "Overview of open roles, pipeline funnel, and upcoming interviews",
      icon: TrendingUp,
      path: "/hrms/recruitment/dashboard",
      color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/60",
      metric: `${candidates.length} In Pipeline`,
    },
    {
      title: "Job Postings",
      desc: "Create and publish requisitions across teams",
      icon: Briefcase,
      path: "/hrms/recruitment/jobs",
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200/60",
      metric: `${jobs.length} Positions`,
    },
    {
      title: "Candidate Roster",
      desc: "Manage applicants, resumes, and hiring stages",
      icon: Users,
      path: "/hrms/recruitment/candidates",
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60",
      metric: `${candidates.length} Applicants`,
    },
    {
      title: "Kanban Pipeline",
      desc: "Visual drag-and-drop recruitment stage progression",
      icon: Layers,
      path: "/hrms/recruitment/pipeline",
      color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200/60",
      metric: "7 Live Stages",
    },
    {
      title: "Interview Schedules",
      desc: "Coordinate technical rounds, scores, and calendar dates",
      icon: Calendar,
      path: "/hrms/recruitment/interviews",
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200/60",
      metric: `${interviews.length} Scheduled`,
    },
    {
      title: "Offer Packages",
      desc: "Generate compensation letters and track acceptance",
      icon: FileText,
      path: "/hrms/recruitment/offers",
      color: "text-teal-600 bg-teal-50 dark:bg-teal-950/40 border-teal-200/60",
      metric: `${offers.length} Released`,
    },
    {
      title: "New Hire Onboarding",
      desc: "Pre-boarding workflows and employee directory induction",
      icon: UserCheck,
      path: "/hrms/recruitment/onboarding",
      color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200/60",
      metric: `${candidates.filter((c) => c.stage === "Hired").length} Hired`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader
        title="Recruitment & Talent Hub"
        subtitle="Manage talent acquisition pipelines, candidate scoring, and team onboarding."
        breadcrumb={[{ label: "HRMS", path: "/hrms" }, { label: "Recruitment" }]}
        actions={
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-muted hover:text-text hover:bg-soft text-xs font-semibold transition cursor-pointer shadow-2xs whitespace-nowrap"
            >
              <HelpCircle size={14} />
              <span>Guide</span>
            </button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => navigate("/hrms/recruitment/candidates", { state: { openAdd: true } })}
              className="shadow-xs whitespace-nowrap font-medium"
            >
              Add Candidate
            </Button>
          </div>
        }
      />

      {/* Quick Access Module Cards */}
      <div>
        <h2 className="text-[14px] font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
          <Layers size={16} className="text-indigo-600" />
          <span>Recruitment Management Modules</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {submodules.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.title}
                onClick={() => navigate(m.path)}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-2xl p-4 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl border ${m.color}`}>
                      <Icon size={18} />
                    </div>
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {m.metric}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-[14px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    {m.title}
                  </h3>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {m.desc}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11.5px] text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                  <span>Open Module</span>
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real Candidate Activity Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
          <h2 className="text-[14px] font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users size={16} className="text-indigo-600" />
            <span>Recent Candidate Records ({candidates.length})</span>
          </h2>
          <button
            onClick={() => navigate("/hrms/recruitment/candidates")}
            className="text-[12px] font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 transition cursor-pointer"
          >
            View All Candidates →
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <DataTable
            columns={COLUMNS}
            data={tableData}
            rowKey="id"
            searchable
            searchPlaceholder="Search candidate name, role, department..."
            emptyMessage="No candidates found."
            pageSize={5}
          />
        </div>
      </div>

      {/* Guide Modal */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-4 sm:p-6 max-h-[95vh] overflow-y-auto text-[13px] text-slate-600 dark:text-slate-300 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
                  <HelpCircle size={18} />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 dark:text-white">
                  Recruitment Hub Guide
                </h3>
              </div>
              <button
                onClick={() => setGuideOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  End-to-End Talent Acquisition
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  From requisition creation, public career portal listings, and resume parsing to multi-round interview scoring, offer letter rollouts, and new hire induction.
                </p>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Button size="sm" onClick={() => setGuideOpen(false)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
