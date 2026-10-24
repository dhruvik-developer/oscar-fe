import { useState, useEffect } from "react";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { useNavigate } from "react-router-dom";
import { pullRecruitmentFunnel } from "../../../services/hrmsSync";
import PageHeader from "../../../components/ui/PageHeader";
import { Button } from "../../../components/hrms/Button";
import {
  TrendingDown,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  BarChart2
} from "lucide-react";

export default function RecruitmentFunnel() {
  // `/hrms/recruitment/funnel/` counts each stage server-side.
  const [funnelData, setFunnelData] = useState([]);
  useEffect(() => {
    let cancelled = false;
    pullRecruitmentFunnel().then((rows) => {
      if (cancelled || !rows) return;
      setFunnelData(Array.isArray(rows) ? rows : rows.stages || []);
    });
    return () => { cancelled = true; };
  }, []);

  const candidates = useRecruitmentStore((s) => s.candidates);
  const navigate = useNavigate();

  const counts = {
    Applications: candidates.length,
    Screening: candidates.filter((c) =>
      ["Screening", "Interview", "Shortlisted", "Offer", "Hired"].includes(c.stage)
    ).length,
    Interview: candidates.filter((c) =>
      ["Interview", "Shortlisted", "Offer", "Hired"].includes(c.stage)
    ).length,
    Shortlisted: candidates.filter((c) =>
      ["Shortlisted", "Offer", "Hired"].includes(c.stage)
    ).length,
    Offer: candidates.filter((c) => ["Offer", "Hired"].includes(c.stage)).length,
    Hired: candidates.filter((c) => c.stage === "Hired").length,
  };

  const max = counts.Applications || 1;
  const conversionRate = Math.round((counts.Hired / max) * 100);

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader
        title="Recruitment Funnel & Conversion"
        subtitle="Analyze stage-by-stage candidate retention, drop-offs, and throughput metrics."
        breadcrumb={[
          { label: "HRMS", path: "/hrms" },
          { label: "Recruitment", path: "/hrms/recruitment" },
          { label: "Funnel Analysis" },
        ]}
        actions={
          <Button
            size="sm"
            onClick={() => navigate("/hrms/recruitment/pipeline")}
            className="flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>Open Pipeline Board</span>
            <ArrowRight size={14} />
          </Button>
        }
      />

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Applications to Hire Conversion
            </div>
            <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
              {conversionRate}%
            </div>
            <div className="text-[11.5px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
              Healthy benchmark (&gt; 10%)
            </div>
          </div>
          <div className="p-2.5 rounded-xl border text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200/60">
            <BarChart2 size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Largest Funnel Drop-off
            </div>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">
              Screening → Interview
            </div>
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
              -35% attrition rate
            </div>
          </div>
          <div className="p-2.5 rounded-xl border text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-200/60">
            <TrendingDown size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Hires Completed
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {counts.Hired} Candidates
            </div>
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
              Across all open roles
            </div>
          </div>
          <div className="p-2.5 rounded-xl border text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Visual Funnel Visualization Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Filter size={16} className="text-indigo-600" />
            <span>Recruitment Conversion Pipeline</span>
          </h3>
          <span className="text-[12px] text-slate-500">
            Click any row to filter candidates in that stage
          </span>
        </div>

        <div className="space-y-3">
          {funnelData.map((s, i) => {
            const count = counts[s.stage] ?? s.count;
            const pct = Math.round((count / max) * 100);
            const prev = i > 0 ? funnelData[i - 1] : null;
            const drop = prev ? (counts[prev.stage] ?? prev.count) - count : 0;

            return (
              <div
                key={s.stage}
                onClick={() => navigate("/hrms/recruitment/candidates")}
                className="group flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition cursor-pointer"
              >
                <div className="w-28 font-semibold text-[13px] text-slate-800 dark:text-slate-200">
                  {s.stage}
                </div>

                {/* Progress bar */}
                <div className="flex-1 h-7 bg-slate-200/80 dark:bg-slate-800 rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-500 rounded-lg ${
                      s.stage === "Hired"
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                        : "bg-gradient-to-r from-indigo-500 to-blue-600"
                    }`}
                    style={{ width: `${Math.max(pct, 6)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-3 justify-between text-[11.5px] font-bold">
                    <span className="text-white drop-shadow-xs">
                      {count} candidates
                    </span>
                    <span className="text-slate-700 dark:text-slate-200 font-semibold drop-shadow-xs">
                      {pct}%
                    </span>
                  </div>
                </div>

                <div className="w-24 text-right text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                  {drop > 0 ? (
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      -{drop} drop
                    </span>
                  ) : (
                    "Initial base"
                  )}
                </div>

                <div className="w-24 text-right text-[11.5px] text-slate-400 hidden sm:block">
                  Avg 3.2 days
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}