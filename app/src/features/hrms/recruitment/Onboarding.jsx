import { useState } from "react";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { useAppStore } from "../../../stores/appStore";
import { Button } from "../../../components/hrms/Button";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/ui/PageHeader";
import {
  UserCheck,
  CheckCircle2,
  Clock,
  FileCheck,
  Calendar,
  Building2,
  Users,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Check
} from "lucide-react";

export default function Onboarding() {
  const {
    candidates,
    offers,
    onboardedMap,
    verifiedDocsMap,
    completeOnboarding,
    verifyDocuments,
  } = useRecruitmentStore();
  const { showToast, employees } = useAppStore();
  const navigate = useNavigate();
  const [guideOpen, setGuideOpen] = useState(false);

  const hired = candidates.filter((c) => c.stage === "Hired");
  const steps = [
    "Offer Accepted",
    "Documents Pending",
    "Documents Verified",
    "Joining Scheduled",
    "Onboarding Complete",
  ];

  async function handleCompleteOnboarding(c) {
    const isAlreadyEmployee = employees.some(
      (e) =>
        e.email?.toLowerCase() === c.email?.toLowerCase() ||
        e.name?.toLowerCase() === c.name?.toLowerCase()
    );

    // The server converts the candidate to a real employee row
    // (`POST /hrms/onboarding/{id}/complete/`) — no fabricated directory
    // entries. Afterwards both lists re-read from the backend.
    try {
      await completeOnboarding(c.id);
      await Promise.all([
        useRecruitmentStore.getState().hydrate().catch(() => {}),
        useAppStore.getState().refreshHrms("employees").catch(() => {}),
      ]);
      if (!isAlreadyEmployee) {
        showToast(`Onboarding completed & ${c.name} added to Employee Directory!`);
      } else {
        showToast(`Onboarding completed for ${c.name}!`);
      }
    } catch (err) {
      showToast(`Could not complete onboarding for ${c.name}: ${err?.message || 'Server error'}`);
    }
  }

  const completedCount = hired.filter((c) => onboardedMap?.[c.id]).length;
  const pendingCount = hired.length - completedCount;

  return (
    <div className="space-y-5">
      {/* Top Page Header */}
      <PageHeader
        title="Candidate Onboarding"
        subtitle="Track document verification, IT provisioning, and employee directory induction."
        breadcrumb={[
          { label: "HRMS", path: "/hrms" },
          { label: "Recruitment", path: "/hrms/recruitment" },
          { label: "Onboarding" },
        ]}
        actions={
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-[12px] font-medium transition cursor-pointer"
            >
              <HelpCircle size={14} />
              <span>Guide</span>
            </button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/hrms/employees")}
              className="flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Users size={15} />
              <span>Employee Directory</span>
            </Button>
          </div>
        }
      />

      {/* Metric Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {[
          {
            label: "In Onboarding",
            count: hired.length,
            sub: "Hired candidates transition",
            icon: Users,
            color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200/60",
          },
          {
            label: "Pending Verification",
            count: Math.max(0, pendingCount),
            sub: "Awaiting documents or IT setup",
            icon: Clock,
            color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200/60",
          },
          {
            label: "Fully Inducted",
            count: completedCount,
            sub: "Active in employee directory",
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

      {/* Main Content */}
      {hired.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 grid place-items-center mx-auto mb-3">
            <UserCheck size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No Candidates In Onboarding
          </h3>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-5">
            When candidates accept their offers and are marked 'Hired' in the pipeline, their pre-boarding checklist and verification milestones will appear here.
          </p>
          <Button size="sm" onClick={() => navigate("/hrms/recruitment/candidates")}>
            View Pipeline Candidates
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {hired.map((c) => {
            const isDone = Boolean(onboardedMap?.[c.id]);
            const isDocsDone = Boolean(verifiedDocsMap?.[c.id] || isDone);
            const matchingOffer = offers.find((o) => o.candidateId === c.id);

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5"
              >
                {/* Candidate Summary Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={c.avatar || "https://i.pravatar.cc/100?img=15"}
                      alt={c.name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-[15px]">
                          {c.name}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isDone
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
                          }`}
                        >
                          {isDone ? "Inducted Employee" : "Pre-Boarding"}
                        </span>
                      </div>
                      <div className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-3">
                        <span>{c.position}</span>
                        <span>•</span>
                        <span>Experience: {c.experience || "3+ yrs"}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          <span>Joining: {matchingOffer?.joiningDate || "01 Oct 2026"}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        verifyDocuments(c.id);
                        showToast(`All documents verified for ${c.name}`);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <ShieldCheck size={14} className={isDocsDone ? "text-emerald-500" : "text-slate-500"} />
                      <span>{isDocsDone ? "Docs Verified ✓" : "Verify Docs"}</span>
                    </Button>

                    <Button
                      size="sm"
                      disabled={isDone}
                      onClick={() => handleCompleteOnboarding(c)}
                      className={`flex items-center gap-1.5 cursor-pointer ${
                        isDone ? "opacity-70 cursor-not-allowed bg-emerald-600 text-white" : ""
                      }`}
                    >
                      <CheckCircle2 size={14} />
                      <span>{isDone ? "Onboarding Complete ✓" : "Complete Onboarding"}</span>
                    </Button>

                    {isDone && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate("/hrms/employees")}
                        className="flex items-center gap-1.5"
                      >
                        <Users size={14} />
                        <span>View in Directory</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress Stepper */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {steps.map((step, i) => {
                      const activeStepIndex = isDone ? 4 : isDocsDone ? 3 : 1;
                      const isStepComplete = isDone
                        ? true
                        : i === 0
                        ? true
                        : (i === 1 || i === 2) && isDocsDone;
                      const isCurrent = i === activeStepIndex && !isDone;

                      return (
                        <div
                          key={step}
                          className={`p-3 rounded-xl border transition-all ${
                            isStepComplete
                              ? "bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                              : isCurrent
                              ? "bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 ring-1 ring-amber-400"
                              : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`w-5 h-5 rounded-full grid place-items-center text-[10.5px] font-bold ${
                                isStepComplete
                                  ? "bg-emerald-600 text-white"
                                  : isCurrent
                                  ? "bg-amber-500 text-white"
                                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                              }`}
                            >
                              {isStepComplete ? <Check size={11} /> : i + 1}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                              Step {i + 1}
                            </span>
                          </div>
                          <div className="text-[12px] font-semibold truncate">{step}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                  Job Onboarding Guide
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
                  1. Automatic Pipeline Ingestion
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Candidates marked 'Hired' automatically land in Onboarding with their matched offer details and expected joining dates.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  2. One-Click Employee Directory Handoff
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Clicking 'Complete Onboarding' creates their official company profile, assigns an Employee ID, sets reporting hierarchy, and provisions their account in the Employee Directory.
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