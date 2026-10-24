import { useState, useMemo } from "react";
import { Avatar } from "../../../components/hrms/Avatar";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  LayoutGrid,
  List as ListIcon,
  Search,
  Users,
  Calendar,
  IndianRupee,
  ArrowRight,
  ArrowLeft,
  Pencil,
  Trash2,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Info,
  GripVertical,
  ArrowDownToLine,
  MoveHorizontal,
} from "lucide-react";
import { useTrainingStore, TRAINING_FUNNEL_STAGES } from "../../../stores/trainingStore";
import { useAppStore } from "../../../stores/appStore";
import { Drawer } from "../../../components/hrms/Drawer";
import { Modal } from "../../../components/hrms/Modal";
import { Button } from "../../../components/hrms/Button";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

const STAGE_DROP_STYLES = {
  Requested: "ring-2 ring-slate-500/60 bg-slate-100/80 border-slate-400",
  "Trainer Assigned": "ring-2 ring-cyan-500/60 bg-cyan-50/80 border-cyan-400",
  Scheduled: "ring-2 ring-blue-500/60 bg-blue-50/80 border-blue-400",
  Ongoing: "ring-2 ring-amber-500/60 bg-amber-50/80 border-amber-400",
  Completed: "ring-2 ring-emerald-500/60 bg-emerald-50/80 border-emerald-400",
  Evaluated: "ring-2 ring-lime-500/60 bg-lime-50/80 border-lime-400",
  Cancelled: "ring-2 ring-rose-500/60 bg-rose-50/80 border-rose-400",
};

export default function TrainingFunnel({ embedded = false, onBack }) {
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const {
    trainings,
    trainers,
    addTraining,
    updateTraining,
    moveTrainingStage,
    deleteTraining,
    resetToDefaults,
  } = useTrainingStore();

  // View state: 'kanban' or 'list'
  const [viewMode, setViewMode] = useState("kanban");

  // Filters
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");

  // Modal / Drawer state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [defaultStage, setDefaultStage] = useState("Requested");
  const [deleteId, setDeleteId] = useState(null);

  // Drag & drop state
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    trainer: "Unassigned",
    department: "Engineering",
    type: "Technical",
    stage: "Requested",
    cost: 25000,
    participants: 12,
    start: "18 Oct 2024",
    end: "19 Oct 2024",
    location: "Training Hall A",
    description: "",
  });

  // Filtered list
  const filteredTrainings = useMemo(() => {
    return trainings.filter((t) => {
      if (deptFilter !== "All" && t.department !== deptFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const mName = (t.name || "").toLowerCase().includes(q);
        const mTrainer = (t.trainer || "").toLowerCase().includes(q);
        const mDept = (t.department || "").toLowerCase().includes(q);
        if (!mName && !mTrainer && !mDept) return false;
      }
      return true;
    });
  }, [trainings, deptFilter, search]);

  // Overall totals
  const totalCount = filteredTrainings.length;
  const openCount = filteredTrainings.filter((t) =>
    ["Requested", "Trainer Assigned", "Scheduled", "Ongoing"].includes(t.stage)
  ).length;
  const closedCount = filteredTrainings.filter((t) =>
    ["Completed", "Evaluated", "Cancelled"].includes(t.stage)
  ).length;

  // Drag and Drop Actions
  const handleDragStart = (e, item) => {
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(item.id);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
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
    const id = e.dataTransfer.getData("text/plain") || draggedId;
    setDragOverStage(null);
    setDraggedId(null);

    if (!id) return;

    const item = trainings.find((t) => t.id === id);
    if (!item) return;

    if (item.stage === targetStageKey) {
      return; // Already in target stage
    }

    moveTrainingStage(id, targetStageKey);
    showToast(`Moved "${item.name}" to ${targetStageLabel}`);
  };

  // Actions
  const handleOpenAdd = (stage = "Requested") => {
    setEditingItem(null);
    setDefaultStage(stage);
    setForm({
      name: "",
      trainer: "Unassigned",
      department: "Engineering",
      type: "Technical",
      stage,
      cost: 25000,
      participants: 12,
      start: "18 Oct 2024",
      end: "19 Oct 2024",
      location: "Training Hall A",
      description: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setForm({
      name: item.name || "",
      trainer: item.trainer || "Unassigned",
      department: item.department || "Engineering",
      type: item.type || "Technical",
      stage: item.stage || "Requested",
      cost: item.cost || 0,
      participants: item.participants || 1,
      start: item.start || "",
      end: item.end || "",
      location: item.location || "",
      description: item.description || "",
    });
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast("Training title is required");
      return;
    }

    if (editingItem) {
      updateTraining(editingItem.id, {
        ...form,
        cost: Number(form.cost),
        participants: Number(form.participants),
      });
      showToast(`Updated "${form.name}"`);
    } else {
      addTraining({
        ...form,
        cost: Number(form.cost),
        participants: Number(form.participants),
      });
      showToast(`Training "${form.name}" created`);
    }
    setModalOpen(false);
  };

  const departmentsList = [
    "All",
    "Engineering",
    "Product",
    "Design",
    "HR",
    "Finance",
    "Marketing",
    "Operations",
  ];

  return (
    <div className="flex flex-col gap-5 w-full pb-16">
      {/* Header */}
      <div className="flex flex-col gap-1">
        {/* Back button to Training Setup - Commented out */}
        {/* {!embedded && (
          <button
            type="button"
            onClick={() => (onBack ? onBack() : navigate("/hrms/training"))}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-navy transition w-fit cursor-pointer group mb-1"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Training Setup</span>
          </button>
        )} */}

        <PageHeader
          title="Training Funnel"
          guide={hrmsGuides.trainingFunnel}
          actions={<>
            {/* View switcher: Kanban vs List */}
            <div className="flex p-1 bg-white border border-bdr rounded-xl shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`p-2 rounded-lg text-slate-700 transition cursor-pointer ${
                  viewMode === "kanban" ? "bg-slate-800 text-white shadow-xs" : "hover:bg-off"
                }`}
                title="Kanban Funnel View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg text-slate-700 transition cursor-pointer ${
                  viewMode === "list" ? "bg-slate-800 text-white shadow-xs" : "hover:bg-off"
                }`}
                title="Table / List View"
              >
                <ListIcon size={16} />
              </button>
            </div>

            {/* + Add Button */}
            <button
              type="button"
              onClick={() => handleOpenAdd("Requested")}
              className="w-9 h-9 rounded-xl bg-[#1e3a8a] text-white hover:bg-[#1e40af] transition grid place-items-center shadow-xs cursor-pointer"
              title="Add / Request Training"
            >
              <Plus size={18} />
            </button>
          </>}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-bdr rounded-2xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search trainings, trainers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-3 bg-off border border-bdr rounded-xl text-[12.5px] focus:bg-white focus:outline-none focus:border-navy transition"
            />
          </div>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer font-medium"
          >
            {departmentsList.map((d) => (
              <option key={d} value={d}>
                {d === "All" ? "All Departments" : d}
              </option>
            ))}
          </select>

          {(search || deptFilter !== "All") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDeptFilter("All");
              }}
              className="h-9 px-2.5 rounded-xl border border-bdr text-muted hover:text-slate-800 hover:bg-off text-[12px] flex items-center gap-1 transition"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>

        {/* Quick Links to other training modules - Commented out */}
        {/*
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/hrms/training/list")}
            className="text-[12px] text-slate-600 hover:text-navy px-2.5 py-1 rounded-lg hover:bg-off font-medium transition"
          >
            Programs List &rarr;
          </button>
          <button
            type="button"
            onClick={() => navigate("/hrms/training/trainers")}
            className="text-[12px] text-slate-600 hover:text-navy px-2.5 py-1 rounded-lg hover:bg-off font-medium transition"
          >
            Trainers &rarr;
          </button>
        </div>
        */}
      </div>

      {/* Main Funnel Card */}
      <div className="bg-white border border-bdr rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col gap-5 overflow-hidden">
        {/* Card Header matching image */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">Training Funnel</h2>
            <div className="text-[12px] text-slate-500 mt-0.5 font-medium flex items-center gap-2 flex-wrap">
              <span>
                Total: <span className="text-slate-700 font-semibold">{totalCount}</span> • Open:{" "}
                <span className="text-blue-700 font-semibold">{openCount}</span> • Closed:{" "}
                <span className="text-slate-700 font-semibold">{closedCount}</span>
              </span>
              <span className="inline-block w-1 h-1 rounded-full bg-slate-300" />
              <span className="inline-flex items-center gap-1 font-medium text-blue-600 text-[11.5px]">
                <MoveHorizontal size={12} /> Drag & drop cards between stages
              </span>
            </div>
          </div>

          {draggedId && (
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1.5 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              Dragging training program...
            </span>
          )}
        </div>

        {/* KANBAN FUNNEL VIEW */}
        {viewMode === "kanban" && (
          <div className="flex overflow-x-auto snap-x snap-mandatory pb-2 gap-2.5 lg:grid lg:grid-cols-7 lg:overflow-visible lg:snap-none lg:pb-0 lg:gap-2 xl:gap-2.5 w-full min-h-[480px]">
            {TRAINING_FUNNEL_STAGES.map((stageObj) => {
              const stageTrainings = filteredTrainings.filter((t) => t.stage === stageObj.key);
              const stageCount = stageTrainings.length;
              const stagePct = totalCount > 0 ? Math.round((stageCount / totalCount) * 100) : 0;
              const stageCost = stageTrainings.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
              const isDropActive = dragOverStage === stageObj.key;

              return (
                <div
                  key={stageObj.key}
                  onDragOver={(e) => handleDragOver(e, stageObj.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stageObj.key, stageObj.label)}
                  className={`rounded-2xl p-2.5 lg:p-2 xl:p-2.5 flex flex-col justify-between transition-all duration-200 min-w-[280px] w-[280px] shrink-0 snap-start lg:min-w-0 lg:w-full lg:shrink ${
                    isDropActive
                      ? STAGE_DROP_STYLES[stageObj.key] || "ring-2 ring-blue-500/60 bg-blue-50/70 border-blue-400"
                      : "bg-slate-50/50 border border-[#e2e8f0] hover:border-slate-300"
                  }`}
                >
                  {/* Column Header matching screenshot */}
                  <div className="flex flex-col pb-2 border-b border-slate-200/80 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1.5 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight shadow-2xs truncate ${stageObj.badgeClass}`}
                        title={stageObj.label}
                      >
                        {stageObj.label}
                      </span>
                      <span className="text-[12.5px] font-bold text-slate-800 font-mono shrink-0">
                        {stageCount}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 font-medium truncate">
                      {stagePct}% of all records
                    </div>

                    <div className="text-[10.5px] text-slate-700 font-semibold mt-0.5 truncate">
                      Cost: ₹ {stageCost.toLocaleString("en-IN")}
                    </div>

                    <div className="text-[9.5px] text-slate-400 italic mt-0.5 leading-tight line-clamp-2" title={stageObj.subtitle}>
                      {stageObj.subtitle}
                    </div>
                  </div>

                  {/* Column Body: Items or "Empty" placeholder */}
                  <div className="flex-1 py-2 flex flex-col gap-2 overflow-y-auto max-h-[440px] custom-scrollbar min-w-0">
                    {/* Active drop indicator */}
                    {isDropActive && (
                      <div className="border-2 border-dashed border-blue-500/70 bg-blue-500/10 rounded-xl p-2 text-center text-[10px] font-bold text-blue-700 flex items-center justify-center gap-1 animate-pulse shadow-inner">
                        <ArrowDownToLine size={12} />
                        <span className="truncate">Drop to move</span>
                      </div>
                    )}

                    {stageTrainings.length === 0 && !isDropActive ? (
                      <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-[12px] italic font-medium">
                        Empty
                      </div>
                    ) : (
                      stageTrainings.map((item) => {
                        const isDragging = draggedId === item.id;

                        return (
                          <div
                            key={item.id}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, item)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleOpenEdit(item)}
                            className={`bg-white border rounded-xl p-2 lg:p-2.5 shadow-2xs transition-all duration-150 cursor-grab active:cursor-grabbing text-left group select-none relative flex flex-col gap-1.5 min-w-0 w-full ${
                              isDragging
                                ? "opacity-35 border-dashed border-blue-500 ring-2 ring-blue-500/30 scale-[0.98]"
                                : "border-bdr hover:border-slate-300 hover:shadow-xs hover:-translate-y-0.5"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 min-w-0">
                              <div className="flex items-start gap-1 flex-1 min-w-0">
                                <div
                                  className="text-slate-300 group-hover:text-blue-600 transition-colors shrink-0 mt-0.5"
                                  title="Drag card"
                                >
                                  <GripVertical size={12} />
                                </div>
                                <span className="font-bold text-[11px] lg:text-[11.5px] text-slate-900 group-hover:text-navy transition line-clamp-2 leading-snug break-words">
                                  {item.name}
                                </span>
                              </div>
                              <span className="px-1 py-0.5 bg-off border border-bdr rounded text-[8.5px] lg:text-[9px] font-medium text-slate-600 shrink-0 truncate max-w-[54px]" title={item.department}>
                                {item.department}
                              </span>
                            </div>

                            {/* Trainer info */}
                            <div className="flex items-center gap-1 text-[10.5px] text-slate-600 mt-0.5 min-w-0">
                              {item.avatar ? (
                                <img src={item.avatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full bg-slate-200 grid place-items-center text-[7.5px] font-bold text-slate-600 shrink-0">
                                  {item.trainer ? item.trainer[0] : "U"}
                                </div>
                              )}
                              <span className="truncate">{item.trainer || "Unassigned"}</span>
                            </div>

                            {/* Date and Cost */}
                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 gap-1 min-w-0">
                              <span className="truncate">{item.start || "TBD"}</span>
                              <span className="font-semibold text-slate-800 text-[10px] lg:text-[10.5px] whitespace-nowrap shrink-0">
                                ₹ {Number(item.cost || 0).toLocaleString("en-IN")}
                              </span>
                            </div>

                            {/* Move stage dropdown / quick action */}
                            <div
                              className="flex items-center justify-between pt-0.5 gap-1 min-w-0"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <select
                                value={item.stage}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  moveTrainingStage(item.id, e.target.value);
                                  showToast(`Moved "${item.name}" to ${e.target.value}`);
                                }}
                                className="h-5.5 px-1 bg-off border border-bdr rounded text-[9.5px] text-slate-600 font-medium focus:outline-none focus:border-navy cursor-pointer w-full truncate"
                              >
                                {TRAINING_FUNNEL_STAGES.map((s) => (
                                  <option key={s.key} value={s.key}>
                                    → {s.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Bottom + Quick Add Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenAdd(stageObj.key)}
                    className="w-full py-1 rounded-xl border border-dashed border-bdr text-slate-500 hover:text-navy hover:border-navy hover:bg-white text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer mt-1"
                  >
                    <Plus size={12} />
                    Add
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST / TABLE VIEW */}
        {viewMode === "list" && (
          <div className="border border-bdr rounded-xl overflow-x-auto">
            <table className="w-full min-w-[640px] lg:min-w-0 text-left text-[13px]">
              <thead className="bg-off border-b border-bdr text-[11px] uppercase tracking-wider text-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Program Name</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Trainer</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Participants</th>
                  <th className="py-3 px-4">Cost</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/60">
                {filteredTrainings.map((t) => {
                  const stageObj =
                    TRAINING_FUNNEL_STAGES.find((s) => s.key === t.stage) ||
                    TRAINING_FUNNEL_STAGES[0];
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{t.name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold ${stageObj.badgeClass}`}
                        >
                          {t.stage}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={t.trainer || t.name} size="xs" />
                          <span>{t.trainer}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{t.department}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{t.participants}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        ₹ {Number(t.cost || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[12px]">
                        {t.start} {t.end && t.end !== t.start ? `– ${t.end}` : ""}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(t)}
                            className="p-1 text-slate-500 hover:text-navy rounded-lg hover:bg-off transition"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete training "${t.name}"?`)) {
                                deleteTraining(t.id);
                                showToast(`Deleted "${t.name}"`);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                            title="Delete"
                          >
                            <Trash2 size={14} />
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

        {/* Footer Reset & Stats Bar */}
        <div className="pt-3 border-t border-bdr flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted">
          <div className="flex items-center gap-2 font-medium">
            <span>7-Stage Learning &amp; Development Pipeline</span>
            <span>•</span>
            <span>Budget trackable across all stages</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (confirm("Reset training funnel data to initial realistic defaults?")) {
                resetToDefaults();
                showToast("Training data reset to defaults");
              }
            }}
            className="text-[11.5px] text-muted hover:text-slate-800 underline decoration-dotted transition"
          >
            Reset Seed Data
          </button>
        </div>
      </div>

      {/* Add / Edit Training Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="flex justify-between items-center gap-2 lg:gap-0 px-4 sm:px-6 py-4 border-b border-bdr bg-slate-50/80">
              <div>
                <h3 className="font-bold text-[16px] text-slate-900">
                  {editingItem ? "Edit Training Program" : "Create Training Request"}
                </h3>
                <p className="text-[12px] text-muted">
                  Specify learning objectives, trainer assignment, and budget
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 grid place-items-center text-muted hover:text-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-6 flex flex-col gap-4 max-h-[80vh] sm:max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                  Training Program Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Leadership Essentials / Kubernetes Security"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    Funnel Stage
                  </label>
                  <select
                    value={form.stage}
                    onChange={(e) => setForm({ ...form, stage: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer font-medium"
                  >
                    {TRAINING_FUNNEL_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    Assigned Trainer
                  </label>
                  <select
                    value={form.trainer}
                    onChange={(e) => {
                      const selectedTrainer = trainers.find((tr) => tr.name === e.target.value);
                      setForm({
                        ...form,
                        trainer: e.target.value,
                        avatar: selectedTrainer?.avatar || null,
                      });
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer font-medium"
                  >
                    <option value="Unassigned">Unassigned (Need identified)</option>
                    {trainers.map((tr) => (
                      <option key={tr.id} value={tr.name}>
                        {tr.name} ({tr.specialization})
                      </option>
                    ))}
                    <option value="External Agency">External Agency</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    Department
                  </label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer font-medium"
                  >
                    {departmentsList
                      .filter((d) => d !== "All")
                      .map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    Training Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer font-medium"
                  >
                    <option>Technical</option>
                    <option>Leadership</option>
                    <option>Design</option>
                    <option>Workshop</option>
                    <option>Operations</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    Cost / Budget (₹)
                  </label>
                  <input
                    type="number"
                    value={form.cost}
                    onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    Participants
                  </label>
                  <input
                    type="number"
                    value={form.participants}
                    onChange={(e) => setForm({ ...form, participants: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 18 Oct 2024"
                    value={form.start}
                    onChange={(e) => setForm({ ...form, start: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                    End Date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 19 Oct 2024"
                    value={form.end}
                    onChange={(e) => setForm({ ...form, end: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                  Location / Mode
                </label>
                <input
                  type="text"
                  placeholder="e.g. Auditorium B & Zoom"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                  Description / Curriculum Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Key training outcomes, syllabus modules..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy resize-none"
                />
              </div>

              <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-4 mt-2 border-t border-bdr">
                {editingItem ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete training "${editingItem.name}"?`)) {
                        deleteTraining(editingItem.id);
                        setModalOpen(false);
                        showToast("Training deleted");
                      }
                    }}
                    className="text-rose-600 hover:text-rose-700 text-[12.5px] font-medium flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 transition shadow-xs"
                  >
                    {editingItem ? "Update Training" : "Save to Funnel"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
