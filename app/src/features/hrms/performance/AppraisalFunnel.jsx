import { useState, useMemo } from "react";
import { usePerformanceStore } from "../../../stores/performanceStore";
import { useAppStore } from "../../../stores/appStore";
import {
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
  Users,
  Sparkles,
  TrendingUp,
  Send,
  Filter,
  Check,
  ChevronRight,
  Building2,
  Star,
  Award,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageInfoButton from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import UserInitials from "../../../components/common/UserInitials";
import { dispatchNotification } from "../../../services/crmEventNotifications";

export default function AppraisalFunnel() {
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);
  const { appraisals, cycles, activeCycleId, approveAppraisal, finalizeAppraisal } = usePerformanceStore();

  const [selectedCycle, setSelectedCycle] = useState("All");
  const [selectedDept, setSelectedDept] = useState("All");
  const [activeStageKey, setActiveStageKey] = useState(null);
  const [aiAnalysisOpen, setAiAnalysisOpen] = useState(false);
  const [remindedEmployees, setRemindedEmployees] = useState(new Set());

  // Filter appraisals by selected cycle & department
  const filteredAppraisals = useMemo(() => {
    return appraisals.filter((a) => {
      if (selectedCycle !== "All" && a.cycle !== selectedCycle) return false;
      if (selectedDept !== "All" && a.department !== selectedDept) return false;
      return true;
    });
  }, [appraisals, selectedCycle, selectedDept]);

  const total = filteredAppraisals.length || 1;

  // Department options
  const departmentOptions = useMemo(() => {
    const set = new Set(appraisals.map((a) => a.department).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [appraisals]);

  // Stage Metrics & Progression
  const funnelStages = useMemo(() => {
    const draftList = filteredAppraisals.filter((a) => a.status === "Draft" || !a.stage);
    const selfReviewList = filteredAppraisals.filter((a) => a.stage === "Self Review" && a.status !== "Completed");
    const managerReviewList = filteredAppraisals.filter((a) => a.stage === "Manager Review" && a.status !== "Completed");
    const hrReviewList = filteredAppraisals.filter((a) => a.stage === "HR Review" && a.status !== "Completed");
    const finalizationList = filteredAppraisals.filter((a) => a.stage === "Finalization" && a.status !== "Completed");
    const completedList = filteredAppraisals.filter((a) => a.status === "Completed");

    const maxCount = total || 1;

    // Cumulative progress progression count
    const s1 = total;
    const s2 = Math.max(0, s1 - draftList.length);
    const s3 = Math.max(0, s2 - selfReviewList.length);
    const s4 = Math.max(0, s3 - managerReviewList.length);
    const s5 = completedList.length + finalizationList.length;
    const s6 = completedList.length;

    return [
      {
        key: "Draft",
        label: "Draft & Initiated",
        description: "Review cycle launched, self-appraisal packet awaiting employee input",
        count: s1,
        currentPending: draftList.length,
        employees: draftList,
        pct: 100,
        bottleneck: false,
        color: "bg-slate-400",
        border: "border-slate-300",
        badgeBg: "bg-slate-100 text-slate-700",
      },
      {
        key: "Self Review",
        label: "Self Review",
        description: "Employees reflecting on deliverables, KPI achievement, and learning goals",
        count: s2,
        currentPending: selfReviewList.length,
        employees: selfReviewList,
        pct: Math.round((s2 / maxCount) * 100),
        bottleneck: selfReviewList.length >= 4,
        color: "bg-blue-500",
        border: "border-blue-400",
        badgeBg: "bg-blue-50 text-blue-700",
      },
      {
        key: "Manager Review",
        label: "Manager Review",
        description: "Department managers scoring benchmarks, calibration, and competencies",
        count: s3,
        currentPending: managerReviewList.length,
        employees: managerReviewList,
        pct: Math.round((s3 / maxCount) * 100),
        bottleneck: managerReviewList.length >= 2,
        color: "bg-amber-500",
        border: "border-amber-400",
        badgeBg: "bg-amber-50 text-amber-700",
      },
      {
        key: "HR Review",
        label: "HR Calibration",
        description: "Organization-wide normalization, bell-curve alignment, and promo eligibility",
        count: s4,
        currentPending: hrReviewList.length,
        employees: hrReviewList,
        pct: Math.round((s4 / maxCount) * 100),
        bottleneck: hrReviewList.length >= 3,
        color: "bg-indigo-500",
        border: "border-indigo-400",
        badgeBg: "bg-indigo-50 text-indigo-700",
      },
      {
        key: "Finalization",
        label: "Finalization & Sign-off",
        description: "Executive endorsement, salary revision readiness, and meeting sign-off",
        count: s5,
        currentPending: finalizationList.length,
        employees: finalizationList,
        pct: Math.round((s5 / maxCount) * 100),
        bottleneck: false,
        color: "bg-purple-500",
        border: "border-purple-400",
        badgeBg: "bg-purple-50 text-purple-700",
      },
      {
        key: "Completed",
        label: "Completed & Synced",
        description: "Ratings finalized, bonus calculated, and pushed to payroll & employee records",
        count: s6,
        currentPending: completedList.length,
        employees: completedList,
        pct: Math.round((s6 / maxCount) * 100),
        bottleneck: false,
        color: "bg-emerald-500",
        border: "border-emerald-400",
        badgeBg: "bg-emerald-50 text-emerald-700",
      },
    ];
  }, [filteredAppraisals, total]);

  const max = funnelStages[0].count || 1;
  const completedStage = funnelStages[funnelStages.length - 1];
  const bottleneckStage = funnelStages.find((s) => s.bottleneck) || funnelStages[2];

  // Active Stage to show in table
  const currentActiveStage = funnelStages.find((s) => s.key === activeStageKey) || bottleneckStage;

  // Send Reminder to Reviewer / Employee
  const handleSendReminder = (appraisal, e) => {
    e?.stopPropagation();
    const recipient = appraisal.stage === "Self Review" ? appraisal.employee : (appraisal.reviewer || "Reporting Manager");
    dispatchNotification({
      id: `remind-${appraisal.id}-${Date.now()}`,
      title: "Appraisal Review Reminder",
      message: `Pending review reminder sent to ${recipient} for ${appraisal.employee} (${appraisal.stage}).`,
      category: "hrms",
      type: "hrms.appraisal_reminder",
      entityType: "Appraisal",
      createdAt: new Date().toISOString(),
      status: "unread",
    });
    setRemindedEmployees((prev) => new Set([...prev, appraisal.id]));
    showToast(`Review reminder dispatched to ${recipient}.`);
  };

  // Fast track appraisal
  const handleFastTrack = (appraisal, e) => {
    e?.stopPropagation();
    if (appraisal.stage === "HR Review") {
      approveAppraisal(appraisal.id, "Fast-tracked by HR Administrator");
      showToast(`${appraisal.employee}'s appraisal approved and advanced.`);
    } else if (appraisal.stage === "Finalization") {
      finalizeAppraisal(appraisal.id);
      showToast(`${appraisal.employee}'s appraisal finalized and ratings locked.`);
    } else {
      navigate("/hrms/performance/appraisal");
    }
  };

  // High performers ready for promotion
  const highPerformers = useMemo(() => {
    return filteredAppraisals.filter((a) => (Number(a.rating) >= 4.2 || a.ratingScaleLabel === "Exceeds Expectations" || a.ratingScaleLabel === "Outstanding"));
  }, [filteredAppraisals]);

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col gap-1">
        <div className="text-[12px] font-medium text-slate-400 flex items-center gap-1.5">
          <span className="hover:text-slate-600 cursor-pointer" onClick={() => navigate("/")}>Home</span>
          <ChevronRight size={12} />
          <span className="hover:text-slate-600 cursor-pointer" onClick={() => navigate("/hrms/performance")}>Performance</span>
          <ChevronRight size={12} />
          <span className="text-slate-700 font-semibold">Appraisal Funnel</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[24px] font-bold text-slate-800 tracking-tight">Appraisal Funnel & Review Pipeline</h1>
              <PageInfoButton guide={hrmsGuides.appraisalFunnel} />
            </div>
            <p className="text-[13px] text-slate-500 mt-0.5">
              Live workflow progression from review initiation to finalized ratings and compensation sync.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setAiAnalysisOpen(!aiAnalysisOpen)}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-semibold hover:from-blue-700 hover:to-indigo-700 transition shadow-sm flex items-center gap-1.5"
            >
              <Sparkles size={14} className="text-amber-300" />
              {aiAnalysisOpen ? "Hide AI Insights" : "AI Funnel Insights"}
            </button>
            <button
              onClick={() => navigate("/hrms/performance/appraisal")}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition shadow-sm flex items-center gap-1.5"
            >
              Manage Appraisals <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Top Filter Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Filter size={14} /> Filters:
          </div>
          <div>
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Cycles ({cycles.length})</option>
              {cycles.map((c) => (
                <option key={c.id || c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === "All" ? "All Departments" : dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Tracking <strong>{filteredAppraisals.length}</strong> active reviews</span>
          <span className="text-slate-300">•</span>
          <span className="text-emerald-600 font-semibold">{completedStage.count} Finalized</span>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total In Pipeline</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Users size={16} /></span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{total}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Across active review cycles</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Completion Rate</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle2 size={16} /></span>
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">{completedStage.pct}%</div>
          <p className="text-[11px] text-slate-400 mt-0.5">{completedStage.count} of {total} finalized</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Current Bottleneck</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl"><AlertTriangle size={16} /></span>
          </div>
          <div className="text-lg font-bold text-amber-700 mt-2 truncate">{bottleneckStage.label}</div>
          <p className="text-[11px] text-amber-600 mt-0.5 font-medium">{bottleneckStage.currentPending} reviews pending</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Promo Candidates</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Award size={16} /></span>
          </div>
          <div className="text-2xl font-bold text-purple-700 mt-2">{highPerformers.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Rating &ge; 4.2 / Outstanding</p>
        </div>
      </div>

      {/* AI Pipeline Insights Panel */}
      {aiAnalysisOpen && (
        <div className="p-5 bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-white rounded-3xl shadow-lg border border-indigo-800/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl">
                <Sparkles size={18} className="text-amber-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">AI Performance Pipeline Insights</h3>
                <p className="text-xs text-indigo-200">Algorithmic velocity & calibration readiness analysis</p>
              </div>
            </div>
            <button
              onClick={() => setAiAnalysisOpen(false)}
              className="text-xs text-indigo-300 hover:text-white underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl">
              <h4 className="font-bold text-indigo-300 mb-1 flex items-center gap-1.5">
                <Clock size={13} /> Turnaround Velocity
              </h4>
              <p className="text-slate-300 leading-relaxed">
                Appraisals are transitioning with an average turnaround of <strong>3.2 days</strong> per stage.
                Manager Review velocity is lagging by 1.8 days due to delayed evaluator feedback in the {bottleneckStage.label} queue.
              </p>
            </div>

            <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl">
              <h4 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                <Zap size={13} /> Actionable Clearance
              </h4>
              <p className="text-slate-300 leading-relaxed">
                Sending automated nudges to <strong>{bottleneckStage.currentPending} evaluators</strong> will clear the backlog before monthly payroll cut-off, avoiding salary review adjustments next cycle.
              </p>
            </div>

            <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl">
              <h4 className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                <TrendingUp size={13} /> Promotion Correlation
              </h4>
              <p className="text-slate-300 leading-relaxed">
                <strong>{highPerformers.length} employees</strong> meet the threshold for career promotion and spot awards. Connect them directly to Employee Lifecycle to lock revised compensation packages.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Funnel Visualization */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div>
          <h3 className="text-base font-bold text-slate-800">Review Pipeline Funnel</h3>
          <p className="text-xs text-slate-500">Click any stage to inspect pending employees and take workflow actions.</p>
        </div>

        <div className="space-y-3.5">
          {funnelStages.map((stage, idx) => {
            const isSelected = (currentActiveStage.key === stage.key);
            const widthPct = Math.max(16, (stage.count / max) * 100);

            return (
              <div
                key={stage.key}
                onClick={() => setActiveStageKey(stage.key)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  isSelected
                    ? "bg-blue-50/70 border-blue-400 shadow-xs ring-2 ring-blue-500/10"
                    : "bg-slate-50/60 border-slate-200 hover:bg-slate-100/70"
                }`}
              >
                {/* Stage Title & Info */}
                <div className="w-full md:w-56 flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                    stage.key === "Completed" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                  }`}>
                    0{idx + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      {stage.label}
                      {stage.bottleneck && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                          Bottleneck
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{stage.description}</p>
                  </div>
                </div>

                {/* Funnel Bar */}
                <div className="flex-1 h-9 rounded-2xl bg-slate-200/70 overflow-hidden relative p-1 flex items-center">
                  <div
                    className={`h-full rounded-xl transition-all duration-500 flex items-center justify-between px-3 ${stage.color} text-white shadow-xs`}
                    style={{ width: `${widthPct}%` }}
                  >
                    <span className="font-bold text-xs flex items-center gap-1">
                      {stage.count} <span className="opacity-80 text-[10px] font-normal">in cycle</span>
                    </span>
                    <span className="text-xs font-mono font-bold">{stage.pct}%</span>
                  </div>
                </div>

                {/* Right Action & Pending Badge */}
                <div className="w-full md:w-48 flex items-center justify-between md:justify-end gap-3 text-xs">
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${stage.badgeBg}`}>
                      {stage.currentPending} pending
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`p-1.5 rounded-lg border text-slate-400 transition ${
                      isSelected ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drilldown: Employees Active in Selected Stage */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>Roster in {currentActiveStage.label}</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                {currentActiveStage.employees.length} employees
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review progress, evaluator assignment, and rapid dispatch actions for this stage.
            </p>
          </div>

          {currentActiveStage.employees.length > 0 && currentActiveStage.key !== "Completed" && (
            <button
              onClick={() => {
                currentActiveStage.employees.forEach((emp) => handleSendReminder(emp));
              }}
              className="px-3.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold hover:bg-blue-100 transition flex items-center gap-1.5"
            >
              <Send size={12} /> Nudge All in Stage
            </button>
          )}
        </div>

        {currentActiveStage.employees.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
            <p className="font-semibold text-sm text-slate-700">No appraisals currently pending in this stage.</p>
            <p className="text-xs">All reviews have advanced through {currentActiveStage.label}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                  <th className="py-3 px-4 rounded-l-xl">Employee</th>
                  <th className="py-3 px-4">Department & Role</th>
                  <th className="py-3 px-4">Reviewer</th>
                  <th className="py-3 px-4">Current Score</th>
                  <th className="py-3 px-4">Cycle</th>
                  <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentActiveStage.employees.map((appr) => {
                  const isReminded = remindedEmployees.has(appr.id);
                  const isHigh = Number(appr.rating) >= 4.2;

                  return (
                    <tr key={appr.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <UserInitials name={appr.employee} className="w-8 h-8 text-xs font-bold" />
                          <div>
                            <span className="font-bold text-slate-800">{appr.employee}</span>
                            {isHigh && (
                              <span className="ml-1.5 px-1.5 py-0.2 bg-purple-50 text-purple-700 rounded text-[10px] font-semibold border border-purple-200">
                                High Performer
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{appr.department || "General"}</div>
                        <div className="text-[11px] text-slate-400">{appr.designation || "Staff"}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {appr.reviewer || "Reporting Manager"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <Star size={12} className="text-amber-500 fill-amber-500" />
                          <span>{Number(appr.rating || 4.0).toFixed(1)} / 5</span>
                        </div>
                        <span className="text-[10px] text-slate-400">Score: {appr.weightedScore || 80}%</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {appr.cycle}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {currentActiveStage.key !== "Completed" && (
                            <button
                              onClick={(e) => handleSendReminder(appr, e)}
                              disabled={isReminded}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                                isReminded
                                  ? "bg-slate-100 text-slate-400 cursor-default"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                              title="Send notification reminder"
                            >
                              <Send size={11} /> {isReminded ? "Reminded" : "Remind"}
                            </button>
                          )}
                          <button
                            onClick={(e) => handleFastTrack(appr, e)}
                            className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition flex items-center gap-1"
                          >
                            <span>Open</span> <ArrowUpRight size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
