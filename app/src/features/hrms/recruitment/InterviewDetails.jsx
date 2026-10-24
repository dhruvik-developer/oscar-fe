import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { useAppStore } from "../../../stores/appStore";
import { Button } from "../../../components/hrms/Button";
import { StatusBadge } from "../../../components/hrms/StatusBadge";
import { Modal } from "../../../components/hrms/Modal";
import PageInfoButton from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Award,
  FileText,
  MessageSquare,
  AlertCircle,
  Edit3,
  CalendarClock
} from "lucide-react";

export default function InterviewDetails() {
  const { id } = useParams();
  const interviews = useRecruitmentStore((s) => s.interviews);
  const updateInterview = useRecruitmentStore((s) => s.updateInterview);
  const candidates = useRecruitmentStore((s) => s.candidates);
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();

  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [evalForm, setEvalForm] = useState({ score: "88", feedback: "Strong technical fundamentals, great problem solving skills." });

  const it = interviews.find((i) => i.id === id);
  const cand = candidates.find((c) => c.id === it?.candidateId);

  if (!it) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center max-w-lg mx-auto my-12 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 grid place-items-center mx-auto mb-3">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Interview Not Found</h3>
        <p className="text-[13px] text-muted mt-1 mb-5">
          The requested interview schedule could not be located or may have been removed.
        </p>
        <Button variant="secondary" onClick={() => navigate("/hrms/recruitment/interviews")}>
          Back to Interviews
        </Button>
      </div>
    );
  }

  const isVideo = it.mode?.toLowerCase().includes("video") || it.mode?.toLowerCase().includes("meet");
  const isPhone = it.mode?.toLowerCase().includes("phone");

  function handleSaveEvaluation() {
    updateInterview(it.id, {
      status: "Completed",
      score: parseInt(evalForm.score, 10) || 85,
      feedback: evalForm.feedback,
    });
    setFeedbackModalOpen(false);
    showToast("Interview marked completed with evaluation feedback.");
  }

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate("/hrms/recruitment/interviews")}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-navy dark:hover:text-white transition w-fit cursor-pointer group"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to Interview Schedules</span>
      </button>

      {/* Hero Entity Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <img
              src={it.avatar || "https://i.pravatar.cc/100?img=15"}
              alt={it.candidateName}
              className="w-16 h-16 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {it.candidateName}
                </h1>
                <PageInfoButton guide={hrmsGuides.interviewDetails} />
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                  {it.type}
                </span>
                <StatusBadge
                  status={
                    it.status === "Scheduled"
                      ? "Pending"
                      : it.status === "Completed"
                      ? "Active"
                      : "Cancelled"
                  }
                  label={it.status}
                />
              </div>

              <p className="text-[13.5px] text-slate-600 dark:text-slate-300 font-medium">
                {it.job}
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-3 text-[12px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  <span>{it.date}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-slate-400" />
                  <span>
                    {it.start} - {it.end} ({it.duration || "60m"})
                  </span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <User size={13} className="text-slate-400" />
                  <span>Interviewer: {it.interviewer}</span>
                </span>
                <span>•</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                    isVideo
                      ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300"
                      : isPhone
                      ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-300"
                      : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300"
                  }`}
                >
                  {isVideo ? <Video size={11} /> : isPhone ? <Phone size={11} /> : <MapPin size={11} />}
                  <span>{it.mode}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {it.meetingLink && (
              <Button
                size="sm"
                onClick={() => window.open(it.meetingLink, "_blank")}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Video size={14} />
                <span>Join Meeting</span>
              </Button>
            )}

            {it.status !== "Completed" && (
              <Button
                size="sm"
                onClick={() => setFeedbackModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Mark Completed</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="secondary"
              onClick={() => showToast("Reschedule notification sent to candidate & panel")}
              className="flex items-center gap-1.5"
            >
              <CalendarClock size={14} />
              <span>Reschedule</span>
            </Button>

            {it.status !== "Cancelled" && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  updateInterview(it.id, { status: "Cancelled" });
                  showToast("Interview has been cancelled");
                }}
                className="flex items-center gap-1.5"
              >
                <XCircle size={14} />
                <span>Cancel</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/hrms/recruitment/candidates/${it.candidateId}`)}
              className="flex items-center gap-1.5"
            >
              <User size={14} />
              <span>Candidate Profile</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Details & Evaluation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Columns: Interview Info & Feedback */}
        <div className="lg:col-span-2 space-y-5">
          {/* Evaluation Score Card */}
          {it.status === "Completed" ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs">
              <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
                    <Award size={18} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-800 dark:text-white">
                      Evaluation & Scores
                    </h3>
                    <p className="text-[12px] text-muted">Assessment logged by {it.interviewer}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-[11.5px] font-bold">
                  Recommended for Next Round
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 rounded-xl p-4 text-center">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Technical Score
                  </div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">
                    {it.score ?? 88}%
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 rounded-xl p-4 text-center">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Culture & HR
                  </div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">91%</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
                  <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Overall Rating
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    {Math.round(((it.score ?? 88) + 91) / 2)}%
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                <div className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                  <MessageSquare size={13} />
                  <span>Interviewer Feedback & Recommendation</span>
                </div>
                <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                  {it.feedback || "No feedback recorded."}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 sm:p-6 shadow-xs text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 grid place-items-center mx-auto mb-3">
                <Award size={22} />
              </div>
              <h3 className="text-[15px] font-bold text-slate-800 dark:text-white">
                Evaluation Pending
              </h3>
              <p className="text-[12.5px] text-muted max-w-md mx-auto mt-1 mb-4">
                This interview is scheduled. Once completed, submit candidate scores and interview feedback to help the hiring committee decide.
              </p>
              <Button size="sm" onClick={() => setFeedbackModalOpen(true)}>
                Submit Evaluation & Complete
              </Button>
            </div>
          )}

          {/* Meeting & Location Details */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs">
            <h3 className="text-[15px] font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <Video size={16} className="text-indigo-600" />
              <span>Location & Connectivity</span>
            </h3>

            <div className="grid sm:grid-cols-2 gap-4 text-[13px]">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Format
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {it.mode}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Link / Room
                </span>
                {it.mode === "Video Call" && it.meetingLink ? (
                  <a
                    href={it.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate"
                  >
                    <span>{it.meetingLink}</span>
                    <ExternalLink size={12} className="shrink-0" />
                  </a>
                ) : (
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {it.location || "Company HQ Conference Room"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Candidate Profile Widget & Session Checklist */}
        <div className="space-y-5">
          {/* Candidate Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <h3 className="text-[14px] font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
              <User size={15} className="text-indigo-600" />
              <span>Candidate Information</span>
            </h3>
            <div className="flex items-center gap-3 mb-4">
              <img
                src={cand?.avatar || it.avatar}
                alt=""
                className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
              <div>
                <div className="font-bold text-slate-900 dark:text-white text-[13.5px]">
                  {cand?.name || it.candidateName}
                </div>
                <div className="text-[12px] text-muted">{cand?.email || "candidate@email.com"}</div>
              </div>
            </div>

            <div className="space-y-2 text-[12px] pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Current Pipeline Stage</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {cand?.stage || "Interview"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Experience</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {cand?.experience || "4+ Years"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Applied Job</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right truncate max-w-[140px]">
                  {it.job}
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate(`/hrms/recruitment/candidates/${it.candidateId}`)}
              className="mt-4 w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-[12px] font-semibold rounded-xl transition cursor-pointer"
            >
              Open Candidate Dossier →
            </button>
          </div>

          {/* Interview Preparation Checklist */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs text-[12.5px]">
            <h3 className="text-[14px] font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
              <FileText size={15} className="text-indigo-600" />
              <span>Session Agenda</span>
            </h3>
            <ul className="space-y-2.5 text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                <span>10 mins: Introduction & candidate journey overview</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                <span>35 mins: Technical deep dive & architectural case study</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                <span>10 mins: Team fit, culture & collaboration principles</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                <span>5 mins: Candidate Q&A and next step timeline</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Mark Completed / Feedback Modal */}
      <Modal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        title="Interview Evaluation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFeedbackModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEvaluation}>Save Evaluation & Complete</Button>
          </>
        }
      >
        <div className="space-y-4 text-[13px]">
          <p className="text-[12.5px] text-muted">
            Log feedback and score for <b>{it.candidateName}</b> ({it.type}).
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300">
              Overall Score (0 - 100) *
            </span>
            <input
              type="number"
              min="0"
              max="100"
              value={evalForm.score}
              onChange={(e) => setEvalForm({ ...evalForm, score: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300">
              Interviewer Comments & Recommendation *
            </span>
            <textarea
              rows={4}
              value={evalForm.feedback}
              onChange={(e) => setEvalForm({ ...evalForm, feedback: e.target.value })}
              className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px] resize-none"
              placeholder="Detail candidate performance across coding, system design, and communication..."
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
