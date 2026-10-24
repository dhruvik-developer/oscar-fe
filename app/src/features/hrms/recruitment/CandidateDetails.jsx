import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { useAppStore } from "../../../stores/appStore";
import { Button } from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import PageInfoButton from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  Calendar,
  Clock,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Award,
  Video,
  Download,
  AlertCircle,
  TrendingUp,
  UserCheck,
  Building2,
  ChevronRight,
} from "lucide-react";
import OfferLetterModal from "../organization/OfferLetterModal";

export default function CandidateDetails() {
  const { id } = useParams();
  const candidates = useRecruitmentStore((s) => s.candidates);
  const interviews = useRecruitmentStore((s) => s.interviews);
  const offers = useRecruitmentStore((s) => s.offers || []);
  const addOffer = useRecruitmentStore((s) => s.addOffer);
  const updateOffer = useRecruitmentStore((s) => s.updateOffer);
  const changeStage = useRecruitmentStore((s) => s.changeStage);
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();

  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [activeOffer, setActiveOffer] = useState(null);

  const c = candidates.find((x) => x.id === id);

  if (!c) {
    return (
      <div className="py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={22} />
        </div>
        <h3 className="text-base font-bold text-text">Candidate Record Not Found</h3>
        <p className="text-xs text-muted mt-1">The candidate you are trying to view does not exist.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/hrms/recruitment/candidates")}
          className="mt-4"
        >
          Back to Candidates
        </Button>
      </div>
    );
  }

  const history = interviews.filter((i) => i.candidateId === c.id);

  const openOfferLetter = () => {
    const existing = offers.find((o) => o.candidateId === c.id);
    if (existing) {
      setActiveOffer(existing);
    } else {
      let dept = "Engineering";
      const pos = (c.position || "").toLowerCase();
      if (pos.includes("design") || pos.includes("ui")) dept = "Design";
      else if (pos.includes("hr") || pos.includes("people")) dept = "HR";
      else if (pos.includes("finance")) dept = "Finance";
      else if (pos.includes("marketing")) dept = "Sales & Marketing";

      setActiveOffer({
        id: `OFF-${Math.floor(100 + Math.random() * 900)}`,
        candidateId: c.id,
        candidateName: c.name,
        email: c.email,
        position: c.position,
        jobType: "Full-time",
        dept,
        salary: "$95,000 / annum",
        location: c.location || "New York HQ",
        workMode: "Hybrid",
        sentDate: new Date().toISOString().split("T")[0],
        joiningDate: new Date(Date.now() + 21 * 86400000).toISOString().split("T")[0],
        reportingManager: "David Park (CTO)",
        probationPeriod: "3 Months",
        status: "Pending",
      });
    }
    setIsOfferModalOpen(true);
  };

  const handleConfirmOffer = (offerData) => {
    addOffer(offerData);
    changeStage(c.id, "Offer");
    showToast(`Offer letter confirmed and issued for ${c.name}`);
  };

  const handleUpdateOffer = (offerData) => {
    updateOffer(offerData.id, offerData);
    showToast(`Offer letter updated for ${c.name}`);
  };

  const timelineSteps = [
    "Applied",
    "Screening",
    "Interview Scheduled",
    "Interview Completed",
    "Shortlisted",
    "Offer",
    "Hired",
  ];

  const getStepIndex = (stage) => {
    if (stage === "Applied") return 0;
    if (stage === "Screening") return 1;
    if (stage === "Interview") return 2;
    if (stage === "Shortlisted") return 4;
    if (stage === "Offer") return 5;
    if (stage === "Hired") return 6;
    if (stage === "Rejected") return 0;
    return 0;
  };

  const currentStepIdx = getStepIndex(c.stage);

  return (
    <div className="flex flex-col gap-5">
      {/* Back to Candidates Directory */}
      <button
        type="button"
        onClick={() => navigate("/hrms/recruitment/candidates")}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors w-fit cursor-pointer group"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to Candidates Roster</span>
      </button>

      {/* Candidate Entity Hero Card */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <img
              src={c.avatar}
              alt={c.name}
              className="w-16 h-16 rounded-2xl object-cover border border-border shadow-xs shrink-0"
            />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[20px] font-extrabold tracking-tight text-slate-900">{c.name}</h1>
                <PageInfoButton guide={hrmsGuides.candidateDetails} />
                <span className="font-mono text-xs px-2 py-0.5 bg-soft border border-border rounded-md text-muted">
                  {c.id}
                </span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    c.stage === "Hired"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : c.stage === "Offer"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : c.stage === "Shortlisted"
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : c.stage === "Interview"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : c.stage === "Rejected"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-soft text-text border-border"
                  }`}
                >
                  {c.stage}
                </span>
              </div>
              <p className="text-xs font-semibold text-muted mt-1">{c.position} • {c.experience}</p>
              <div className="flex items-center gap-3 text-xs text-muted mt-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail size={12} /> {c.email}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Phone size={12} /> {c.phone}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {c.location}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
            <div className="flex items-center gap-1 bg-soft border border-border rounded-xl px-2 py-1">
              <span className="text-[10px] uppercase font-bold text-muted">Stage:</span>
              <select
                value={c.stage}
                onChange={(e) => {
                  const newStage = e.target.value;
                  changeStage(c.id, newStage);
                  showToast(`Candidate stage updated to ${newStage}`);
                  if (newStage === "Offer") {
                    openOfferLetter();
                  }
                }}
                className="h-7 px-2 bg-transparent text-xs font-bold text-text focus:outline-none cursor-pointer"
              >
                <option>Applied</option>
                <option>Screening</option>
                <option>Interview</option>
                <option>Shortlisted</option>
                <option>Offer</option>
                <option>Hired</option>
                <option>Rejected</option>
              </select>
            </div>

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
              variant="secondary"
              icon={CheckCircle2}
              onClick={() => {
                changeStage(c.id, "Shortlisted");
                showToast("Candidate moved to Shortlisted stage");
              }}
            >
              Shortlist
            </Button>

            <Button
              size="sm"
              variant="primary"
              icon={FileText}
              onClick={openOfferLetter}
            >
              {c.stage === "Offer" || c.stage === "Hired" ? "View Offer Letter" : "Generate Offer"}
            </Button>

            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                changeStage(c.id, "Rejected");
                showToast("Candidate marked as Rejected");
              }}
            >
              Reject
            </Button>
          </div>
        </div>
      </div>

      {/* Profile & History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Info & Resume */}
        <div className="lg:col-span-7 space-y-5">
          {/* Detailed Info Cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
                <Mail size={13} className="text-primary" /> Contact Details
              </h3>
              <div className="text-xs space-y-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">Email</span>
                  <span className="font-semibold text-text">{c.email}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">Phone</span>
                  <span className="font-semibold text-text">{c.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">Location</span>
                  <span className="font-semibold text-text">{c.location}</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
                <Briefcase size={13} className="text-primary" /> Professional Background
              </h3>
              <div className="text-xs space-y-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">Target Role</span>
                  <span className="font-semibold text-text">{c.position}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">Total Experience</span>
                  <span className="font-semibold text-text">{c.experience}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">Primary Skills</span>
                  <span className="font-semibold text-text">{c.skills || "Not specified"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted block">Source & Recruiter</span>
                  <span className="font-semibold text-text">{c.source || "Direct"} • {c.recruiter}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resume & Portfolio Attachment Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
              Application Documents
            </h3>
            <div className="border border-border/80 rounded-xl p-4 bg-soft/60 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center font-bold">
                  <FileText size={20} />
                </div>
                <div>
                  <span className="text-xs font-bold text-text block">{c.name.replace(/\s+/g, "_")}_Resume.pdf</span>
                  <span className="text-[11px] text-muted">2.4 MB • Verified candidate CV document</span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                icon={Download}
                onClick={() => showToast("Downloading resume file...")}
              >
                Download
              </Button>
            </div>
          </div>

          {/* Interview Evaluation Rounds & History */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Interview Logs & Scores
              </h3>
              {c.recommendation && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  {c.recommendation}
                </span>
              )}
            </div>

            {history.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                No interview sessions recorded yet for this candidate.
              </div>
            ) : (
              <div className="space-y-3 mt-3.5">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="border border-border/80 rounded-xl p-3.5 bg-soft/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-text">{h.type}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                        {h.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-text">
                        <Clock size={11} /> {h.date} • {h.start}-{h.end}
                      </span>
                      <span>•</span>
                      <span>Interviewer: {h.interviewer}</span>
                      <span>•</span>
                      <span>Mode: {h.mode}</span>
                    </div>
                    {h.score && (
                      <div className="pt-2 border-t border-border/60 text-xs text-text flex items-center justify-between">
                        <span>Score: <b className="text-primary">{h.score}%</b></span>
                        <span className="text-muted italic">"{h.feedback}"</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(c.technicalScore || c.hrScore) && (
              <div className="mt-4 pt-3 border-t border-border flex items-center gap-4 text-xs">
                <div className="bg-soft border border-border rounded-xl px-3 py-2 text-center flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted block">Technical Score</span>
                  <span className="text-base font-black text-blue-600">{c.technicalScore}%</span>
                </div>
                <div className="bg-soft border border-border rounded-xl px-3 py-2 text-center flex-1">
                  <span className="text-[10px] uppercase font-bold text-muted block">HR Assessment</span>
                  <span className="text-base font-black text-purple-600">{c.hrScore}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Candidate Progression Timeline */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
              Candidate Pipeline Progression
            </h3>

            <div className="relative pl-6 space-y-4 border-l border-border text-xs">
              {timelineSteps.map((stepName, idx) => {
                const isCompleted = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <div key={stepName} className="relative">
                    <span
                      className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                        isCurrent
                          ? "bg-primary border-primary text-white shadow-xs shadow-primary/40 ring-4 ring-primary/10"
                          : isCompleted
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "bg-card border-border text-muted"
                      }`}
                    >
                      {isCompleted && !isCurrent && <CheckCircle2 size={10} strokeWidth={3} />}
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>

                    <div>
                      <div
                        className={`font-bold flex items-center gap-1.5 ${
                          isCurrent ? "text-primary" : isCompleted ? "text-text" : "text-muted"
                        }`}
                      >
                        <span>{stepName}</span>
                        {isCurrent && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted block mt-0.5">
                        {isCompleted
                          ? idx === 0
                            ? `Application submitted on ${c.appliedDate || "recent date"}`
                            : `Stage cleared successfully`
                          : "Pending progression"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Offer Letter Live Editor & PDF Modal */}
      <OfferLetterModal
        isOpen={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
        offer={activeOffer}
        onConfirmOffer={handleConfirmOffer}
        onUpdateOffer={handleUpdateOffer}
      />
    </div>
  );
}
