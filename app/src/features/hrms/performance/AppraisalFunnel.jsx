import { useMemo } from "react";
import { usePerformanceStore } from "../../../stores/performanceStore";
import { AlertTriangle, CheckCircle, ArrowRight, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

export default function AppraisalFunnel() {
  const navigate = useNavigate();
  const { appraisals, cycles } = usePerformanceStore();

  const total = appraisals.length || 1;

  const funnelStages = useMemo(() => {
    const draftCount = appraisals.filter((a) => a.status === "Draft").length;
    const selfReviewCount = appraisals.filter((a) => a.stage === "Self Review" && a.status !== "Completed").length;
    const managerReviewCount = appraisals.filter((a) => a.stage === "Manager Review" && a.status !== "Completed").length;
    const hrReviewCount = appraisals.filter((a) => a.stage === "HR Review" && a.status !== "Completed").length;
    const finalizationCount = appraisals.filter((a) => a.stage === "Finalization" && a.status !== "Completed").length;
    const completedCount = appraisals.filter((a) => a.status === "Completed").length;

    // Progression counts (cumulative through pipeline)
    const s1 = total;
    const s2 = total - draftCount;
    const s3 = s2 - Math.floor(selfReviewCount * 0.4);
    const s4 = s3 - Math.floor(managerReviewCount * 0.5);
    const s5 = completedCount + finalizationCount;
    const s6 = completedCount;

    const maxCount = s1 || 1;

    return [
      { label: "Draft & Initiated", count: s1, currentPending: draftCount, pct: 100, bottleneck: false },
      { label: "Self Review", count: s2, currentPending: selfReviewCount, pct: Math.round((s2 / maxCount) * 100), bottleneck: false },
      { label: "Manager Review", count: s3, currentPending: managerReviewCount, pct: Math.round((s3 / maxCount) * 100), bottleneck: managerReviewCount >= 3 },
      { label: "HR Review & Calibration", count: s4, currentPending: hrReviewCount, pct: Math.round((s4 / maxCount) * 100), bottleneck: false },
      { label: "Finalization", count: s5, currentPending: finalizationCount, pct: Math.round((s5 / maxCount) * 100), bottleneck: false },
      { label: "Completed & Synced", count: s6, currentPending: 0, pct: Math.round((s6 / maxCount) * 100), bottleneck: false },
    ];
  }, [appraisals, total]);

  const max = funnelStages[0].count || 1;
  const completedStage = funnelStages[funnelStages.length - 1];
  const bottleneckStage = funnelStages.find((s) => s.bottleneck) || funnelStages[2];

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <PageHeader
        title="Appraisal Funnel"
        subtitle="Live workflow progression from initiation to finalized rating sync."
        guide={hrmsGuides.appraisalFunnel}
        actions={
          <button
            onClick={() => navigate("/hrms/performance/appraisal")}
            className="px-3.5 py-1.5 bg-[#16233a] text-white rounded-xl text-[12.5px] font-medium hover:bg-[#0f172a] transition shadow-2xs flex items-center gap-1.5"
          >
            Manage Appraisals <ArrowRight size={14} />
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Main Chart */}
        <div className="lg:col-span-8 bg-white border border-[#e2e8f0] rounded-2xl p-4 sm:p-6 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-col gap-3.5">
            {funnelStages.map((s, i) => {
              const isDraft = i === 0;
              const isBottleneck = s.bottleneck;
              const isCompleted = i === funnelStages.length - 1;

              let barColor = "bg-[#16233a]";
              if (isDraft) barColor = "bg-slate-300";
              else if (isBottleneck) barColor = "bg-[#f59e0b]";
              else if (isCompleted) barColor = "bg-[#10b981]";

              return (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="w-24 sm:w-32 text-[12.5px] font-medium text-slate-700 truncate">
                    {String(i + 1).padStart(2, "0")} {s.label}
                  </div>
                  <div className="flex-1 h-9 rounded-full overflow-hidden relative bg-slate-100">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all flex items-center justify-center`}
                      style={{ width: `${Math.max(12, (s.count / max) * 100)}%` }}
                    >
                      <span
                        className={`text-[12px] font-medium ${
                          isDraft ? "text-slate-700 font-semibold" : "text-white font-semibold"
                        }`}
                      >
                        {s.count} • {s.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="w-12 text-right text-[12px] text-slate-400 font-medium">{s.pct}%</div>
                  {s.bottleneck ? (
                    <div className="w-24">
                      <span className="px-2.5 py-1 bg-[#fffbeb] border border-[#fef08a] text-[#b45309] rounded-full text-[11px] font-medium flex items-center gap-1">
                        <AlertTriangle size={12} className="text-[#b45309]" />
                        Bottleneck
                      </span>
                    </div>
                  ) : (
                    <div className="w-24 text-[11px] text-slate-400 text-right pr-1">
                      {s.currentPending > 0 ? `${s.currentPending} pending` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap gap-2 text-[12px]">
            <span className="px-3.5 py-1.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-full text-slate-600 font-medium">
              Overall Conversion: {completedStage.pct}% completed
            </span>
            <span className="px-3.5 py-1.5 bg-[#fffbeb] border border-[#fef08a] text-[#b45309] rounded-full font-medium">
              {bottleneckStage.currentPending} awaiting action in {bottleneckStage.label}
            </span>
          </div>
        </div>

        {/* Right Column Cards */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs flex flex-col gap-3">
            <h3 className="font-bold text-[15px] text-slate-800 flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-[#f59e0b]" />
              Workflow Insights
            </h3>
            <p className="text-[13px] text-slate-500 leading-relaxed">
              <strong className="text-slate-700 font-semibold">{bottleneckStage.label}</strong> currently has {bottleneckStage.currentPending} pending reviews. Suggested action: send review reminders to assigned evaluators.
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-[#fffbeb] border border-[#fef08a] text-[#b45309] rounded-full text-[12px] font-medium">
                Stage SLA: 3 days remaining
              </span>
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs flex flex-col gap-3">
            <h3 className="font-bold text-[15px] text-slate-800 flex items-center gap-1.5">
              <CheckCircle size={16} className="text-[#10b981]" />
              Completed Appraisals
            </h3>
            <div className="text-[22px] font-bold text-slate-900">
              {completedStage.count}{" "}
              <span className="text-[13px] font-normal text-slate-400">/ {total} appraisals</span>
            </div>
            <p className="text-[12px] text-slate-500 leading-relaxed">
              Finalized ratings have been locked and synced to employee profiles and compensation review tables.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
