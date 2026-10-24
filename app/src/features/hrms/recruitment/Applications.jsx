import { useState, useMemo } from "react";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { useAppStore } from "../../../stores/appStore";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/ui/PageHeader";
import { DataTable } from "../../../components/hrms/DataTable";
import { FilterBar } from "../../../components/hrms/FilterBar";
import { Button } from "../../../components/hrms/Button";
import { StatusBadge } from "../../../components/hrms/StatusBadge";
import {
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  UserCheck,
  Eye,
  HelpCircle,
  Plus,
  Briefcase,
  Layers,
  ArrowRight
} from "lucide-react";

export default function Applications() {
  const candidates = useRecruitmentStore((s) => s.candidates);
  const changeStage = useRecruitmentStore((s) => s.changeStage);
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [guideOpen, setGuideOpen] = useState(false);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (
        search &&
        !`${c.name} ${c.position} ${c.source || ""}`.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (stageFilter !== "All" && c.stage !== stageFilter) {
        return false;
      }
      return true;
    });
  }, [candidates, search, stageFilter]);

  const stages = ["Applied", "Screening", "Interview", "Shortlisted", "Offer", "Hired", "Rejected"];

  const appliedCount = candidates.filter((c) => c.stage === "Applied").length;
  const screeningOrInterview = candidates.filter(
    (c) => c.stage === "Screening" || c.stage === "Interview"
  ).length;
  const offeredOrHired = candidates.filter((c) => c.stage === "Offer" || c.stage === "Hired").length;

  const cols = [
    {
      key: "name",
      header: "Candidate",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <img
            src={r.avatar || "https://i.pravatar.cc/100?img=15"}
            alt={r.name}
            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
          />
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-100 block text-[13px]">
              {r.name}
            </span>
            <span className="text-[11px] text-muted block">{r.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "position",
      header: "Position Applied",
      sortable: true,
      render: (r) => (
        <div className="font-medium text-slate-800 dark:text-slate-200 text-[12.5px] flex items-center gap-1.5">
          <Briefcase size={13} className="text-slate-400" />
          <span>{r.position}</span>
        </div>
      ),
    },
    {
      key: "appliedDate",
      header: "Applied Date",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-300">
          <Calendar size={13} className="text-slate-400" />
          <span>{r.appliedDate || "12 Sep 2026"}</span>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
          {r.source || "Website"}
        </span>
      ),
    },
    {
      key: "stage",
      header: "Pipeline Stage",
      render: (r) => (
        <select
          value={r.stage}
          onChange={(e) => {
            changeStage(r.id, e.target.value);
            showToast(`Moved ${r.name} to ${e.target.value}`);
          }}
          className={`h-7 px-2 text-[11.5px] font-medium rounded-lg border outline-none cursor-pointer transition ${
            r.stage === "Hired"
              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
              : r.stage === "Offer"
              ? "bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
              : r.stage === "Rejected"
              ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800"
              : r.stage === "Interview"
              ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800"
              : "bg-slate-50 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
          }`}
        >
          {stages.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "recruiter",
      header: "Assigned Recruiter",
      render: (r) => (
        <span className="text-[12px] text-slate-600 dark:text-slate-300">
          {r.recruiter || "Kavita Rao"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <button
          onClick={() => navigate(`/hrms/recruitment/candidates/${r.id}`)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-medium text-slate-700 dark:text-slate-200 hover:text-navy dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
        >
          <Eye size={12} />
          <span>Profile</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Page Header */}
      <PageHeader
        title="Job Applications"
        subtitle="Track incoming resumes, application stages, and candidate progress."
        breadcrumb={[
          { label: "HRMS", path: "/hrms" },
          { label: "Recruitment", path: "/hrms/recruitment" },
          { label: "Applications" },
        ]}
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
              onClick={() => navigate("/hrms/recruitment/candidates", { state: { openRegister: true } })}
              className="shadow-xs whitespace-nowrap font-medium"
            >
              Add Candidate
            </Button>
          </div>
        }
      />

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {[
          {
            label: "Total Applications",
            count: candidates.length,
            sub: "Across all postings",
            icon: FileText,
            color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200/60",
          },
          {
            label: "Newly Applied",
            count: appliedCount,
            sub: "Pending initial review",
            icon: Clock,
            color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200/60",
          },
          {
            label: "Screening / Interview",
            count: screeningOrInterview,
            sub: "In active evaluation",
            icon: Layers,
            color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200/60",
          },
          {
            label: "Offered & Hired",
            count: offeredOrHired,
            sub: "Successful conversions",
            icon: CheckCircle2,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60",
          },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center justify-between"
            >
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {m.label}
                </div>
                <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
                  {m.count}
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {m.sub}
                </div>
              </div>
              <div className={`p-2.5 rounded-xl border ${m.color}`}>
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearch={setSearch}
        selects={[
          {
            value: stageFilter,
            onChange: setStageFilter,
            options: [
              { label: "All Stages", value: "All" },
              { label: "Applied", value: "Applied" },
              { label: "Screening", value: "Screening" },
              { label: "Interview", value: "Interview" },
              { label: "Shortlisted", value: "Shortlisted" },
              { label: "Offer", value: "Offer" },
              { label: "Hired", value: "Hired" },
              { label: "Rejected", value: "Rejected" },
            ],
          },
        ]}
        onClear={() => {
          setSearch("");
          setStageFilter("All");
        }}
      />

      {/* Table */}
      <DataTable
        columns={cols}
        data={filtered}
        emptyTitle="No applications found"
        emptyDesc="Applications will appear here once candidates apply or are imported."
      />

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
                  Job Applications Guide
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
                  1. Quick Stage Progression
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Change pipeline stages right from the table dropdown. Candidates will automatically reflect in the Kanban pipeline and Onboarding.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  2. Candidate Profile & Resume
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Click 'Profile' on any row to open the complete candidate dossier, preview uploaded resumes, and view past interview scorecards.
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
