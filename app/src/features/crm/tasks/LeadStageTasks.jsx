import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  MousePointerClick,
  Plus,
  Users,
  Workflow,
  X,
  CheckCircle2,
} from "lucide-react";
import InfoBanner from "../common/InfoBanner";
import PageHeader from "../../../components/ui/PageHeader";
import StageTasksGuideModal from "./StageTasksGuideModal";
import MasterSourceLink from "../../../components/common/MasterSourceLink";
import { useCrmStore } from "../../../stores/crmStore";
import { syncCollection } from "../../../services/crmCollections";

const STAGE_THEMES = [
  {
    headerBg: "bg-[#eff6ff] border-[#dbeafe]",
    badgeBg: "bg-blue-600 text-white",
    ribbonBg: "bg-blue-600 text-white shadow-xs",
    badgeNumber: 1,
    flowOn: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    flowOff: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)",
    flowOffText: "#1d4ed8",
    glow: "rgba(37, 99, 235, 0.35)",
  },
  {
    headerBg: "bg-[#f0fdf4] border-[#bbf7d0]",
    badgeBg: "bg-emerald-600 text-white",
    ribbonBg: "bg-[#ccfbf1] text-[#0f766e]",
    badgeNumber: 2,
    flowOn: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
    flowOff: "linear-gradient(135deg, #bbf7d0 0%, #ecfdf5 100%)",
    flowOffText: "#047857",
    glow: "rgba(5, 150, 105, 0.35)",
  },
  {
    headerBg: "bg-[#fefce8] border-[#fef08a]",
    badgeBg: "bg-amber-500 text-white",
    ribbonBg: "bg-[#fef9c3] text-[#a16207]",
    badgeNumber: 3,
    flowOn: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
    flowOff: "linear-gradient(135deg, #fde68a 0%, #fffbeb 100%)",
    flowOffText: "#b45309",
    glow: "rgba(217, 119, 6, 0.35)",
  },
  {
    headerBg: "bg-[#faf5ff] border-[#f3e8ff]",
    badgeBg: "bg-purple-600 text-white",
    ribbonBg: "bg-[#f3e8ff] text-[#7e22ce]",
    badgeNumber: 4,
    flowOn: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
    flowOff: "linear-gradient(135deg, #e9d5ff 0%, #faf5ff 100%)",
    flowOffText: "#7e22ce",
    glow: "rgba(147, 51, 234, 0.35)",
  },
  {
    headerBg: "bg-[#eef2ff] border-[#e0e7ff]",
    badgeBg: "bg-indigo-600 text-white",
    ribbonBg: "bg-[#e0e7ff] text-[#4338ca]",
    badgeNumber: 5,
    flowOn: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
    flowOff: "linear-gradient(135deg, #c7d2fe 0%, #eef2ff 100%)",
    flowOffText: "#4338ca",
    glow: "rgba(79, 70, 229, 0.35)",
  },
  {
    headerBg: "bg-[#eff6ff] border-[#dbeafe]",
    badgeBg: "bg-sky-600 text-white",
    ribbonBg: "bg-[#dbeafe] text-[#1d4ed8]",
    badgeNumber: 6,
    flowOn: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)",
    flowOff: "linear-gradient(135deg, #bae6fd 0%, #f0f9ff 100%)",
    flowOffText: "#0369a1",
    glow: "rgba(2, 132, 199, 0.35)",
  },
  {
    headerBg: "bg-[#f0fdf4] border-[#dcfce7]",
    badgeBg: "bg-teal-600 text-white",
    ribbonBg: "bg-[#dcfce7] text-[#15803d]",
    badgeNumber: 7,
    flowOn: "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)",
    flowOff: "linear-gradient(135deg, #99f6e4 0%, #f0fdfa 100%)",
    flowOffText: "#0f766e",
    glow: "rgba(13, 148, 136, 0.35)",
  },
  {
    headerBg: "bg-[#fff1f2] border-[#ffe4e6]",
    badgeBg: "bg-rose-500 text-white",
    ribbonBg: "bg-[#ffe4e6] text-[#be123c]",
    badgeNumber: 8,
    flowOn: "linear-gradient(135deg, #f43f5e 0%, #be123c 100%)",
    flowOff: "linear-gradient(135deg, #fecdd3 0%, #fff1f2 100%)",
    flowOffText: "#be123c",
    glow: "rgba(225, 29, 72, 0.35)",
  },
];

/** Arrow shapes for the connected pipeline flow (clip-path, so no borders). */
const CHEVRON_FIRST =
  "polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)";
const CHEVRON_STEP =
  "polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)";

const TASK_ROLE_MAP = {
  "Follow-up": "BDE",
  "Follow-up with customer": "BDE",
  "Send email": "Sales Support Executive",
  "Send quotation": "BDE",
  "Schedule demo": "Area Sales Manager",
  "Client meeting": "Sales Support Executive",
  "Negotiate pricing": "BDE",
};

/** Soft chip colors per role — [background, text, dot]. */
const ROLE_CHIP_STYLES = {
  "BDE": ["linear-gradient(135deg, #ecfeff, #f0fdfa)", "#0e7490", "#06b6d4"],
  "Sales Support Executive": ["linear-gradient(135deg, #eff6ff, #eef2ff)", "#1d4ed8", "#3b82f6"],
  "Area Sales Manager": ["linear-gradient(135deg, #fffbeb, #fff7ed)", "#b45309", "#f59e0b"],
};
const ROLE_CHIP_FALLBACK = ["linear-gradient(135deg, #f8fafc, #f1f5f9)", "#475569", "#94a3b8"];

function getDynamicTaskOptions(masterTasks = []) {
  const names = (Array.isArray(masterTasks) ? masterTasks : [])
    .map((m) => m.name || m.title)
    .filter(Boolean);
  // Master tasks come from the server only — no browser-stored copy.
  return [...new Set(names)];
}

/**
 * Small −/+ control for numeric cells (MAX REPEATS). Typing still works, but
 * the buttons give one-click increments; the value never leaves 1…max.
 */
function NumberStepper({ value, onChange, min = 1, max = 99, ariaLabel }) {
  const parsed = Number(value);
  const current = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const commit = (next) => onChange(Math.min(max, Math.max(min, next)));
  const btn =
    "grid h-7 w-7 place-items-center text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer text-sm font-bold";
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
      <button
        type="button"
        onClick={() => commit(current - 1)}
        disabled={current <= min}
        className={btn}
        aria-label={`Decrease ${ariaLabel}`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          if (/^\d{1,2}$/.test(raw)) onChange(Number(raw));
        }}
        onBlur={() => commit(current)}
        className="w-9 border-0 py-1.5 text-center text-xs font-bold text-slate-800 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => commit(current + 1)}
        disabled={current >= max}
        className={btn}
        aria-label={`Increase ${ariaLabel}`}
      >
        +
      </button>
    </div>
  );
}

// Which pipeline the screen is looking at is a view preference, not data.
const PIPELINE_KEY = 'leadStageTasksPipelineV1';

/** A blank stage task, as the "add task" form opens it. */
const EMPTY_MASTER_TASK = {
  name: '',
  description: '',
  role: 'BDE',
  department: 'Any',
  priority: 'Medium',
  dueIn: 1,
  repeats: 1,
  time: '',
  form: '',
  autoCreate: true,
  isActive: true,
};

function getStoredPipeline() {
  try {
    return localStorage.getItem(PIPELINE_KEY) || 'Sales';
  } catch { /* ignore */ }
  return 'Sales';
}

/**
 * The screen renders a stage with its tasks nested. The API keeps them apart
 * (`/crm/stages/` and `/crm/stage-tasks/`), so they are joined here.
 */
function stagesWithTasks(stages, stageTasks) {
  return stages.map((stage) => ({
    ...stage,
    tasks: stageTasks
      .filter((task) => task.stageId === stage.id)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)),
  }));
}

export default function LeadStageTasks({ leadForms = [] }) {
  const storeStages = useCrmStore((s) => s.stages);
  const storeStageTasks = useCrmStore((s) => s.stageTasks);
  const storeMasterTasks = useCrmStore((s) => s.masterTasks);
  const [stages, setStages] = useState([]);
  // Each distinct tree state is written back at most once. Without this,
  // a sync that never sticks (offline create/update that the server
  // rejects) re-triggers this effect via the store subscription forever —
  // "Maximum update depth exceeded".
  const lastSyncedRef = useRef('');

  useEffect(() => {
    setStages(stagesWithTasks(storeStages, storeStageTasks));
  }, [storeStages, storeStageTasks]);
  const [openStages, setOpenStages] = useState([]);
  const [isTaskRolesOpen, setIsTaskRolesOpen] = useState(false);
  const [pipeline, setPipeline] = useState(getStoredPipeline);
  const [taskModalStageId, setTaskModalStageId] = useState(null);
  const [masterTask, setMasterTask] = useState(EMPTY_MASTER_TASK);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formError, setFormError] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [stageDrafts, setStageDrafts] = useState({});
  const taskOptions = useMemo(() => getDynamicTaskOptions(storeMasterTasks), [storeMasterTasks]);


  // An edit anywhere in the tree is written back as the flat task collection
  // the API stores, with each task carrying the stage it belongs to.
  useEffect(() => {
    if (stages.length === 0) return;
    const flat = stages.flatMap((stage) =>
      (stage.tasks || []).map((task, index) => ({ ...task, stageId: stage.id, order: index + 1 }))
    );
    const key = JSON.stringify(flat);
    if (key === lastSyncedRef.current) return;
    lastSyncedRef.current = key;
    syncCollection('stageTasks', flat, storeStageTasks);
  }, [stages, storeStageTasks]);

  useEffect(() => {
    useCrmStore.getState().refresh("masterTasks").catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PIPELINE_KEY, pipeline);
    } catch { /* ignore */ }
  }, [pipeline]);

  /** Re-read the configured stages and their tasks from the server. */
  function resetToDefaults() {
    const store = useCrmStore.getState();
    Promise.all([store.refresh('stages'), store.refresh('stageTasks')]).catch((err) => {
      console.warn('[CRM] could not reload stage tasks:', err?.message || err);
    });
  }

  function getDraft(stageId) {
    return (
      stageDrafts[stageId] || {
        name: "",
        order: 0,
        required: true,
        autoCreate: true,
        repeats: "",
        dueIn: "",
      }
    );
  }

  function updateDraft(stageId, key, value) {
    setStageDrafts((prev) => ({
      ...prev,
      [stageId]: {
        ...getDraft(stageId),
        [key]: value,
      },
    }));
  }

  function isDuplicateTaskName(stageId, name, excludeTaskId = null) {
    if (!name?.trim()) return false;
    const normalized = name.trim().toLowerCase();
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return false;
    return (stage.tasks || []).some(
      (t) => t.id !== excludeTaskId && (t.name || "").trim().toLowerCase() === normalized
    );
  }

  function addDraftTask(stageId) {
    const draft = getDraft(stageId);
    if (!draft.name) return;
    if (isDuplicateTaskName(stageId, draft.name)) {
      setFormError(`"${draft.name.trim()}" already exists in this stage. Duplicate tasks are not allowed.`);
      setTimeout(() => setFormError(""), 3500);
      return;
    }
    const selectedMaster = (Array.isArray(storeMasterTasks) ? storeMasterTasks : []).find(
      (m) => (m.name || m.title || "") === draft.name
    );
    const role = selectedMaster?.role || TASK_ROLE_MAP[draft.name] || "BDE";
    const department = selectedMaster?.department || "Any";
    setStages((current) =>
      current.map((stage) => {
        if (stage.id !== stageId) return stage;
        return {
          ...stage,
          tasks: [
            ...stage.tasks,
            {
              id: Date.now(),
              name: draft.name,
              description: `${draft.name} task`,
              role,
              department,
              order: Number(draft.order) || 0,
              required: draft.required ?? true,
              autoCreate: draft.autoCreate ?? true,
              repeats: draft.repeats === "" ? 14 : Number(draft.repeats) || 0,
              dueIn: draft.dueIn === "" ? 0 : Number(draft.dueIn) || 0,
            },
          ],
        };
      })
    );
    setStageDrafts((prev) => ({
      ...prev,
      [stageId]: {
        name: "",
        order: 0,
        required: true,
        autoCreate: true,
        repeats: "",
        dueIn: "",
      },
    }));
    triggerSaveToast();
  }

  function addTask(stageId) {
    const targetId = stageId || stages[0]?.id;
    if (!targetId) return;
    setTaskModalStageId(targetId);
    setMasterTask({ ...EMPTY_MASTER_TASK });
  }

  function closeTaskModal() {
    setTaskModalStageId(null);
    setFormError("");
  }

  function updateMasterTask(key, value) {
    setMasterTask((current) => ({ ...current, [key]: value }));
  }

  function handleMasterTaskSelect(name) {
    const selected = (Array.isArray(storeMasterTasks) ? storeMasterTasks : []).find(
      (m) => (m.name || m.title || "") === name
    );
    if (selected) {
      setMasterTask((current) => ({
        ...current,
        name: selected.name || selected.title || "",
        description: selected.description || current.description,
        role: selected.role || current.role,
        department: selected.department || current.department,
        priority: selected.priority || current.priority,
        dueIn: selected.dueIn ?? current.dueIn,
      }));
    } else {
      setMasterTask((current) => ({ ...current, name }));
    }
  }

  function createMasterTask(event) {
    event.preventDefault();
    if (!masterTask.name.trim()) return;
    if (isDuplicateTaskName(taskModalStageId, masterTask.name)) {
      setFormError(`"${masterTask.name.trim()}" already exists in this stage. Duplicate tasks are not allowed.`);
      return;
    }

    setStages((current) =>
      current.map((stage) => {
        if (stage.id !== taskModalStageId) return stage;
        return {
          ...stage,
          tasks: [
            ...stage.tasks,
            {
              id: Date.now(),
              name: masterTask.name.trim(),
              description: masterTask.description.trim() || "New stage task",
              role: masterTask.role || "BDE",
              department: masterTask.department || "Any",
              priority: masterTask.priority,
              time: masterTask.time,
              form: masterTask.form,
              order: stage.tasks.length,
              required: true,
              autoCreate: true,
              repeats: Number(masterTask.repeats) || 1,
              dueIn: Number(masterTask.dueIn) || 0,
            },
          ],
        };
      })
    );
    if (!openStages.includes(taskModalStageId)) {
      setOpenStages((prev) => [...prev, taskModalStageId]);
    }
    setIsTaskRolesOpen(true);
    closeTaskModal();
    setFormError("");
    triggerSaveToast();
  }

  function deleteTask(stageId, taskId) {
    setStages((current) =>
      current.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              tasks: stage.tasks.filter((task) => task.id !== taskId),
            }
          : stage
      )
    );
    triggerSaveToast();
  }

  function updateTask(stageId, taskId, key, value) {
    setStages((current) =>
      current.map((stage) =>
        stage.id === stageId
          ? {
              ...stage,
              tasks: stage.tasks.map((task) =>
                task.id === taskId ? { ...task, [key]: value } : task
              ),
            }
          : stage
      )
    );
  }

  function toggleStage(stageId) {
    setOpenStages((current) =>
      current.includes(stageId)
        ? current.filter((id) => id !== stageId)
        : [...current, stageId]
    );
  }

  function triggerSaveToast() {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  }

  const stageRoleTasks = useMemo(() => {
    const seen = new Set();
    const unique = [];
    stages
      .flatMap((stage) => stage.tasks.map((task) => ({ ...task, stageId: stage.id })))
      .forEach((task) => {
        const key = (task.name || "").trim().toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          unique.push(task);
        }
      });
    return unique;
  }, [stages]);

  function updateTaskRoleForName(name, key, value) {
    const normalized = (name || "").trim().toLowerCase();
    if (!normalized) return;
    setStages((current) =>
      current.map((stage) => ({
        ...stage,
        tasks: stage.tasks.map((task) =>
          (task.name || "").trim().toLowerCase() === normalized
            ? { ...task, [key]: value }
            : task
        ),
      }))
    );
  }
  const uniqueRoles = [...new Set(stageRoleTasks.map((task) => task.role).filter(Boolean))];

  return (
    <section className="w-full space-y-4">
      <PageHeader
        title="Lead Stage Tasks"
        subtitle="Assign and manage tasks for each lead stage. When a lead moves to a stage, selected tasks are created automatically."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              aria-label="How to create lead stage tasks"
              className="group inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 pl-1.5 pr-3.5 text-[13px] font-semibold text-blue-700 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-blue-400 hover:shadow-md hover:shadow-blue-500/15"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-[13px] font-bold text-white shadow-sm transition-transform duration-200 group-hover:scale-105 group-hover:rotate-6">?</span>
              How to create lead stage tasks?
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <span>Pipeline</span>
              <select
                value={pipeline}
                onChange={(e) => setPipeline(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
              >
                <option>Sales</option>
                <option>Support</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => addTask(stages[0]?.id)}
              disabled={stages.length === 0}
              title={stages.length === 0 ? "No stages configured yet" : "Add a task to the first stage"}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Add Stage Task
            </button>
          </div>
        }
      />

      <InfoBanner
        storageKey="infoBannerLeadStageTasksV1"
        title="Why use Lead Stage Tasks?"
        text="These auto-create the right tasks when a lead enters a stage. You map tasks once, then every stage change creates follow-ups automatically."
      />

      {formError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
          <X size={14} className="shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="relative bg-gradient-to-br from-white via-white to-slate-50/70 rounded-2xl border border-slate-200 shadow-sm mb-8 overflow-hidden">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-500 to-blue-600" />
        <div
          onClick={() => setIsTaskRolesOpen((prev) => !prev)}
          className="flex items-center justify-between gap-3 lg:gap-0 p-4 sm:p-5 cursor-pointer hover:bg-slate-50/50 transition select-none"
        >
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-slate-400 mt-2.5">
              {isTaskRolesOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </span>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-blue-500/30">
              <Users size={19} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Task Roles</h3>
                <span className="text-[11px] font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 px-2 py-0.5 rounded-full shadow-sm">
                  {stageRoleTasks.length} Tasks
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tasks added to lead stages with their assigned roles and departments.
              </p>
              {uniqueRoles.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {uniqueRoles.slice(0, 4).map((role) => {
                    const [bg, text, dot] = ROLE_CHIP_STYLES[role] || ROLE_CHIP_FALLBACK;
                    return (
                      <span
                        key={role}
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-xs"
                        style={{ background: bg, color: text }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
                        {role}
                      </span>
                    );
                  })}
                  {uniqueRoles.length > 4 && (
                    <span className="text-[10px] font-semibold text-slate-400">
                      +{uniqueRoles.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {isTaskRolesOpen && (
          <div className="border-t border-slate-100 overflow-x-auto">
            <table className="w-full min-w-[640px] lg:min-w-0 text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 via-slate-50/80 to-indigo-50/40 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">TASK</th>
                  <th className="px-4 py-3">ROLE</th>
                  <th className="px-4 py-3">DEPARTMENT</th>
                  <th className="px-5 py-3 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stageRoleTasks.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-9 text-center">
                      <span className="mx-auto mb-2.5 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/70 text-slate-400">
                        <ClipboardList size={18} />
                      </span>
                      <p className="text-xs text-slate-400">
                        No stage tasks yet. Click <span className="font-semibold text-slate-500">Add Stage Task</span> and then Create to display a task here.
                      </p>
                    </td>
                  </tr>
                )}
                {stageRoleTasks.map((task) => (
                  <tr key={`${task.stageId}-${task.id}`} className="even:bg-slate-50/40 hover:bg-blue-50/40 transition">
                    <td className="px-5 py-3.5 font-bold text-slate-800 whitespace-nowrap">
                      {task.name}
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={task.role}
                        onChange={(e) =>
                          updateTaskRoleForName(task.name, "role", e.target.value)
                        }
                        className="w-full max-w-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                      >
                        <option>BDE</option>
                        <option>Sales Support Executive</option>
                        <option>Area Sales Manager</option>
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={task.department || "Any"}
                        onChange={(e) =>
                          updateTaskRoleForName(task.name, "department", e.target.value)
                        }
                        className="w-full max-w-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                      >
                        <option>Any</option>
                        <option>Sales</option>
                        <option>Support</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => triggerSaveToast()}
                          className="px-4 py-1.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25">
            <Workflow size={15} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Lead Stage Tasks</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure the tasks that are created when a lead enters each stage.
            </p>
          </div>
        </div>

        {stages.length === 0 && (
          <div className="mt-3.5 rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 px-6 py-12 text-center">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
              <Workflow size={26} />
            </span>
            <h4 className="text-sm font-bold text-slate-900">No lead stages yet</h4>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
              Lead stages power this page. Add your pipeline stages first, then come back to map follow-up tasks to each stage.
            </p>
          </div>
        )}

        {stages.length > 0 && (
          <div className="mt-4 mb-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/80 p-3.5 shadow-xs">
            <div className="flex items-stretch overflow-x-auto px-0.5 pb-1 pt-0.5">
              {stages.map((stage, idx) => {
                const theme = STAGE_THEMES[idx % STAGE_THEMES.length];
                const isOpen = openStages.includes(stage.id);
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => toggleStage(stage.id)}
                    aria-pressed={isOpen}
                    title={`${stage.name} — ${stage.tasks.length} task${stage.tasks.length === 1 ? "" : "s"}`}
                    className="group flex items-center gap-2.5 py-3 pl-5 pr-9 text-left transition-all duration-200 hover:-translate-y-0.5 cursor-pointer select-none"
                    style={{
                      flex: "1 1 160px",
                      minWidth: 150,
                      maxWidth: 260,
                      clipPath: idx === 0 ? CHEVRON_FIRST : CHEVRON_STEP,
                      marginLeft: idx === 0 ? 0 : -12,
                      background: isOpen ? theme.flowOn : theme.flowOff,
                      filter: isOpen
                        ? `drop-shadow(0 8px 16px ${theme.glow})`
                        : "drop-shadow(0 2px 4px rgba(15, 23, 42, 0.10))",
                    }}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${isOpen ? "bg-white/25 text-white" : "text-white shadow-sm"}`}
                      style={isOpen ? undefined : { background: theme.flowOn }}
                    >
                      {idx + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-[13px] font-bold leading-4 ${isOpen ? "text-white" : ""}`}
                        style={isOpen ? undefined : { color: theme.flowOffText }}
                      >
                        {stage.name}
                      </span>
                      <span
                        className={`mt-0.5 block text-[10px] font-semibold leading-3 ${isOpen ? "text-white/75" : "opacity-70"}`}
                        style={isOpen ? undefined : { color: theme.flowOffText }}
                      >
                        {stage.tasks.length} task{stage.tasks.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {stages.length > 0 && !stages.some((s) => openStages.includes(s.id)) && (
          <div className="mb-5 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-8 text-center">
            <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25">
              <MousePointerClick size={20} />
            </span>
            <p className="text-xs font-semibold text-slate-600">No stage selected</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Click a stage in the pipeline above to view and configure its tasks.
            </p>
          </div>
        )}

        <div className="space-y-3.5">
          {stages.map((stage, idx) => {
            const isOpen = openStages.includes(stage.id);
            const theme = STAGE_THEMES[idx % STAGE_THEMES.length];
            const draft = getDraft(stage.id);

            if (!isOpen) return null;

            return (
              <div
                key={stage.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition"
              >
                <div
                  className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 select-none"
                  style={{ background: theme.flowOn }}
                >
                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 min-w-0 lg:min-w-auto">
                    <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-bold text-white">{stage.name}</span>
                    <span className="text-[11px] font-semibold text-white/90 bg-white/15 px-2 py-0.5 rounded-full">
                      {stage.tasks.length} Tasks
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addTask(stage.id);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg border border-white/30 transition cursor-pointer"
                    >
                      <Plus size={13} />
                      Add Task
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStage(stage.id)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition cursor-pointer"
                      aria-label={`Collapse ${stage.name}`}
                    >
                      <ChevronUp size={15} />
                    </button>
                  </div>
                </div>

                {(
                  <div className="border-t border-slate-100 overflow-x-auto">
                    <table className="w-full min-w-[900px] lg:min-w-0 text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-slate-100 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                          <th className="px-3 py-3 w-64">
                            <div className="flex items-center justify-between gap-2">
                              <span>TASK</span>
                              <MasterSourceLink source="leadTasks" className="normal-case tracking-normal" />
                            </div>
                          </th>
                          <th className="px-3 py-3">ROLE</th>
                          <th className="px-3 py-3 w-28">ORDER</th>
                          <th className="px-3 py-3 w-24 text-center">REQUIRED</th>
                          <th className="px-3 py-3 w-28 text-center">
                            <div>AUTO CREATE</div>
                            <div className="text-[9px] font-normal text-slate-400 normal-case tracking-normal mt-0.5">Auto-created when lead enters stage</div>
                          </th>
                          <th className="px-3 py-3 w-32">MAX REPEATS</th>
                          <th className="px-3 py-3 w-32">DUE IN (DAYS)</th>
                          <th className="px-3 py-3 w-40 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {stage.tasks.map((task) => {
                          const currentRole = task.role || TASK_ROLE_MAP[task.name] || "BDE";
                          return (
                            <tr key={task.id} className="hover:bg-slate-50/50 transition">
                              <td className="px-3 py-2.5">
                                <select
                                  value={task.name}
                                  onChange={(e) => {
                                    const newName = e.target.value;
                                    if (newName && isDuplicateTaskName(stage.id, newName, task.id)) {
                                      setFormError(`"${newName.trim()}" already exists in this stage. Duplicate tasks are not allowed.`);
                                      setTimeout(() => setFormError(""), 3500);
                                      return;
                                    }
                                    const selectedMaster = (Array.isArray(storeMasterTasks) ? storeMasterTasks : []).find(
                                      (m) => (m.name || m.title || "") === newName
                                    );
                                    const newRole = selectedMaster?.role || TASK_ROLE_MAP[newName] || task.role;
                                    updateTask(stage.id, task.id, "name", newName);
                                    updateTask(stage.id, task.id, "role", newRole);
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                                >
                                  <option value="">Select Task</option>
                                  {[...new Set([...taskOptions, task.name].filter(Boolean))].map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-1 bg-[#22b7c6] text-white text-xs font-semibold rounded-md shadow-2xs">
                                  {currentRole}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <input
                                  type="number"
                                  value={task.order}
                                  onChange={(e) =>
                                    updateTask(stage.id, task.id, "order", Number(e.target.value))
                                  }
                                  className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 text-center focus:outline-none focus:border-blue-500 shadow-2xs"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={task.required}
                                  onChange={(e) =>
                                    updateTask(stage.id, task.id, "required", e.target.checked)
                                  }
                                  className="w-4 h-4 text-[#0f4c81] rounded border-slate-300 cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={task.autoCreate}
                                  onChange={(e) =>
                                    updateTask(stage.id, task.id, "autoCreate", e.target.checked)
                                  }
                                  className="w-4 h-4 text-[#0f4c81] rounded border-slate-300 cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-2.5">
                                <NumberStepper
                                  value={task.repeats}
                                  onChange={(v) => updateTask(stage.id, task.id, "repeats", v)}
                                  ariaLabel="max repeats"
                                />
                              </td>
                              <td className="px-3 py-2.5">
                                <input
                                  type="text"
                                  value={task.dueIn ?? ""}
                                  onChange={(e) =>
                                    updateTask(stage.id, task.id, "dueIn", e.target.value)
                                  }
                                  className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                                />
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => triggerSaveToast()}
                                    className="px-3.5 py-1.5 bg-[#0f4c81] hover:bg-[#0c3c66] text-white text-xs font-semibold rounded-md shadow-2xs transition cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteTask(stage.id, task.id)}
                                    className="px-3 py-1.5 bg-white border border-[#f43f5e] text-[#f43f5e] hover:bg-rose-50 text-xs font-semibold rounded-md shadow-2xs transition cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        <tr className="bg-white hover:bg-slate-50/50 transition">
                          <td className="px-3 py-2.5">
                            <select
                              value={draft.name}
                              onChange={(e) => updateDraft(stage.id, "name", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                            >
                              <option value="">Select Task</option>
                              {taskOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 bg-transparent text-transparent text-xs font-semibold rounded-md min-w-[20px]">
                              &nbsp;
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              value={draft.order}
                              onChange={(e) =>
                                updateDraft(stage.id, "order", Number(e.target.value))
                              }
                              className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 text-center focus:outline-none focus:border-blue-500 shadow-2xs"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={draft.required}
                              onChange={(e) => updateDraft(stage.id, "required", e.target.checked)}
                              className="w-4 h-4 text-[#0f4c81] rounded border-slate-300 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={draft.autoCreate}
                              onChange={(e) =>
                                updateDraft(stage.id, "autoCreate", e.target.checked)
                              }
                              className="w-4 h-4 text-[#0f4c81] rounded border-slate-300 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              placeholder="default"
                              value={draft.repeats}
                              onChange={(e) => updateDraft(stage.id, "repeats", e.target.value)}
                              className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              placeholder="default"
                              value={draft.dueIn}
                              onChange={(e) => updateDraft(stage.id, "dueIn", e.target.value)}
                              className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
                            />
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => addDraftTask(stage.id)}
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#50667a] hover:bg-[#415363] text-white text-xs font-semibold rounded-md shadow-2xs transition cursor-pointer"
                            >
                              <Plus size={13} /> Add
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {taskModalStageId && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4"
          role="presentation"
          onMouseDown={closeTaskModal}
        >
          <form
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden"
            onSubmit={createMasterTask}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Add Task to Stage</h2>
              <button
                type="button"
                onClick={closeTaskModal}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
                aria-label="Close task form"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3.5 max-h-[75vh] overflow-y-auto text-xs">
              {formError && taskModalStageId && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  {formError}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Task Name <span className="text-rose-500">*</span>
                  </label>
                  <MasterSourceLink source="leadTasks" />
                </div>
                <select
                  autoFocus
                  value={masterTask.name}
                  onChange={(e) => handleMasterTaskSelect(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800 cursor-pointer"
                >
                  <option value="">Select Task</option>
                  {(Array.isArray(storeMasterTasks) ? storeMasterTasks : []).map((m) => {
                    const taskName = m.name || m.title || "";
                    return (
                      <option key={m.id} value={taskName}>
                        {taskName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Performed By (Role)
                  </label>
                  <select
                    value={masterTask.role}
                    onChange={(e) => updateMasterTask("role", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                  >
                    <option>BDE</option>
                    <option>Sales Support Executive</option>
                    <option>Area Sales Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={masterTask.department}
                    onChange={(e) => updateMasterTask("department", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                  >
                    <option>Any</option>
                    <option>Sales</option>
                    <option>Support</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Priority
                  </label>
                  <select
                    value={masterTask.priority}
                    onChange={(e) => updateMasterTask("priority", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Due In (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={masterTask.dueIn}
                    onChange={(e) => updateMasterTask("dueIn", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Repeats
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={masterTask.repeats}
                    onChange={(e) => updateMasterTask("repeats", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Time
                  </label>
                  <input
                    type="time"
                    value={masterTask.time}
                    onChange={(e) => updateMasterTask("time", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={masterTask.description}
                  onChange={(e) => updateMasterTask("description", e.target.value)}
                  placeholder="Enter Description"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50/70 border-t border-slate-100">
              <button
                type="button"
                onClick={closeTaskModal}
                className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition cursor-pointer text-xs"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {saveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl shadow-lg text-xs font-semibold">
          <CheckCircle2 size={16} />
          <span>Stage tasks updated successfully!</span>
        </div>
      )}
      <StageTasksGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </section>
  );
}
