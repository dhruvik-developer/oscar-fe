import { useState } from "react";
import { useRecruitmentStore } from "../../stores/recruitmentStore";
import { useAppStore } from "../../stores/appStore";
import { Users, GripVertical, ArrowDownToLine, MoveHorizontal } from "lucide-react";

const STAGE_CONFIG = [
  {
    key: "Applied",
    label: "Applied",
    color: "blue",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    activeDropBg: "ring-2 ring-blue-500/60 bg-blue-50/70 border-blue-400 dark:bg-blue-950/40 dark:border-blue-700",
  },
  {
    key: "Screening",
    label: "Screening",
    color: "cyan",
    dot: "bg-cyan-500",
    badge: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800",
    activeDropBg: "ring-2 ring-cyan-500/60 bg-cyan-50/70 border-cyan-400 dark:bg-cyan-950/40 dark:border-cyan-700",
  },
  {
    key: "Interview",
    label: "Interview",
    color: "indigo",
    dot: "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
    activeDropBg: "ring-2 ring-indigo-500/60 bg-indigo-50/70 border-indigo-400 dark:bg-indigo-950/40 dark:border-indigo-700",
  },
  {
    key: "Shortlisted",
    label: "Shortlisted",
    color: "purple",
    dot: "bg-purple-500",
    badge: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
    activeDropBg: "ring-2 ring-purple-500/60 bg-purple-50/70 border-purple-400 dark:bg-purple-950/40 dark:border-purple-700",
  },
  {
    key: "Offer",
    label: "Offer",
    color: "amber",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    activeDropBg: "ring-2 ring-amber-500/60 bg-amber-50/70 border-amber-400 dark:bg-amber-950/40 dark:border-amber-700",
  },
  {
    key: "Hired",
    label: "Hired",
    color: "emerald",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    activeDropBg: "ring-2 ring-emerald-500/60 bg-emerald-50/70 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700",
  },
  {
    key: "Rejected",
    label: "Rejected",
    color: "rose",
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    activeDropBg: "ring-2 ring-rose-500/60 bg-rose-50/70 border-rose-400 dark:bg-rose-950/40 dark:border-rose-700",
  },
];

export function CandidatePipeline({ onSelectCandidate }) {
  const candidates = useRecruitmentStore((s) => s.candidates);
  const changeStage = useRecruitmentStore((s) => s.changeStage);
  const showToast = useAppStore((s) => s.showToast);

  const [draggedCandidateId, setDraggedCandidateId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const handleDragStart = (e, candidate) => {
    e.dataTransfer.setData("text/plain", candidate.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedCandidateId(candidate.id);
  };

  const handleDragEnd = () => {
    setDraggedCandidateId(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e, stageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stageKey) {
      setDragOverStage(stageKey);
    }
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverStage(null);
    }
  };

  const handleDrop = (e, targetStageKey, targetStageLabel) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData("text/plain") || draggedCandidateId;
    setDragOverStage(null);
    setDraggedCandidateId(null);

    if (!candidateId) return;

    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) return;

    if (candidate.stage === targetStageKey) {
      return; // Already in this stage, no-op
    }

    changeStage(candidateId, targetStageKey);
    showToast(`${candidate.name} moved to ${targetStageLabel}`);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-2xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
            <Users size={16} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-text">Candidate Pipeline</h3>
            <p className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
              <span>Visual stage progression</span>
              <span className="inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                <MoveHorizontal size={12} /> Drag & drop cards between stages
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {draggedCandidateId && (
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              Dragging card...
            </span>
          )}
          <span className="text-xs font-semibold text-muted bg-soft px-2.5 py-1 rounded-full border border-border">
            {candidates.length} Active Candidates
          </span>
        </div>
      </div>

      {/* Kanban Grid */}
      <div className="flex overflow-x-auto snap-x snap-mandatory pb-2 gap-3 lg:grid lg:grid-cols-7 lg:overflow-visible lg:snap-none lg:pb-0">
        {STAGE_CONFIG.map(({ key, label, dot, badge, activeDropBg }) => {
          const colCandidates = candidates.filter((c) => c.stage === key);
          const isDropActive = dragOverStage === key;

          return (
            <div
              key={key}
              onDragOver={(e) => handleDragOver(e, key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, key, label)}
              className={`rounded-xl p-3 flex flex-col min-h-[260px] min-w-[280px] shrink-0 snap-start lg:min-w-0 lg:shrink transition-all duration-200 ${
                isDropActive
                  ? activeDropBg
                  : "bg-soft/70 border border-border/80 hover:border-border"
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border/60">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
                  <span className="text-[11px] font-bold text-text uppercase tracking-wider truncate">
                    {label}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${badge}`}>
                  {colCandidates.length}
                </span>
              </div>

              {/* Candidates Column Drop List */}
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[440px] pr-0.5 custom-scrollbar">
                {/* Active drop indicator at top when dragging over */}
                {isDropActive && (
                  <div className="border-2 border-dashed border-blue-500/70 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl p-2.5 text-center text-[10px] font-bold text-blue-700 dark:text-blue-300 flex items-center justify-center gap-1.5 animate-pulse shadow-inner">
                    <ArrowDownToLine size={13} />
                    <span>Drop to move to {label}</span>
                  </div>
                )}

                {colCandidates.map((c) => {
                  const isBeingDragged = draggedCandidateId === c.id;

                  return (
                    <div
                      key={c.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, c)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onSelectCandidate?.(c)}
                      className={`bg-card border rounded-xl p-2.5 shadow-2xs transition-all duration-150 relative group cursor-grab active:cursor-grabbing select-none ${
                        isBeingDragged
                          ? "opacity-35 border-dashed border-blue-500 ring-2 ring-blue-500/30 scale-[0.98]"
                          : "border-border hover:shadow-xs hover:border-primary/40 hover:-translate-y-0.5"
                      }`}
                    >
                      {/* Drag Grip Indicator & Candidate Header */}
                      <div className="flex items-start gap-1.5">
                        <div
                          className="text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors shrink-0 mt-0.5"
                          title="Drag to change stage"
                        >
                          <GripVertical size={14} />
                        </div>

                        <img
                          src={c.avatar}
                          alt={c.name}
                          className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-text truncate group-hover:text-primary transition-colors leading-tight">
                            {c.name}
                          </div>
                          <div className="text-[11px] text-muted truncate mt-0.5">{c.position}</div>
                        </div>
                      </div>

                      {/* Info Row: Experience & Candidate ID */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-[10px] text-muted">
                        <span>{c.experience}</span>
                        <span className="font-mono text-[9px] text-slate-400 dark:text-slate-500">{c.id}</span>
                      </div>

                      {/* Move Stage Select (Accessibility & Manual Option) */}
                      <div
                        className="mt-2"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="block text-[9px] uppercase font-bold text-muted mb-0.5">
                          Move Stage
                        </label>
                        <select
                          value={c.stage}
                          onChange={(e) => {
                            const newStage = e.target.value;
                            if (newStage !== c.stage) {
                              changeStage(c.id, newStage);
                              const found = STAGE_CONFIG.find((s) => s.key === newStage);
                              showToast(`${c.name} moved to ${found?.label || newStage}`);
                            }
                          }}
                          className="w-full h-6 px-1.5 bg-soft border border-border rounded-lg text-[10px] font-medium text-text focus:outline-none focus:border-primary cursor-pointer transition"
                        >
                          {STAGE_CONFIG.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}

                {colCandidates.length === 0 && !isDropActive && (
                  <div className="h-28 border border-dashed border-border/80 rounded-xl flex items-center justify-center text-[11px] text-muted/70 text-center p-2">
                    No candidates
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CandidatePipeline;
