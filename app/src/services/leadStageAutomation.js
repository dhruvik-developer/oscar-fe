/**
 * leadStageAutomation — stage rules, as the server runs them.
 *
 * This used to be a ~600-line engine in the browser: it kept the stage/master
 * task configuration in `localStorage`, picked an assignee from a hardcoded
 * team list, generated the follow-up tasks itself and wrote them back into
 * three more storage blobs.
 *
 * The API does all of that now (api.md §9.4) — a lead created or moved through
 * a stage comes back with its tasks already made, stamped
 * `Created by Lead Stage Automation`. So what is left here is the thin part
 * the UI still needs: re-read what the server produced, and answer the
 * questions the screens ask about stages, roles and task configuration from
 * the collections the CRM store holds.
 *
 * The exported names are unchanged, because seven screens import them.
 */
import { useCrmStore } from '../stores/crmStore';
import { crmSync } from './crmSync';

/** Screens still listen for this to re-read after something changed. */
export const CRM_EVENT = 'crm:data-updated';

export const TASK_SOURCE_AUTOMATION = 'Created by Lead Stage Automation';
export const TASK_SOURCE_MANUAL = 'Manual';

export function notifyCrmDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CRM_EVENT));
  }
}

/** Stage names differ in casing between screens; compare them normalised. */
export function normalizeStageName(rawStage) {
  return String(rawStage || '')
    .trim()
    .replace(/[\s_-]+/g, ' ')
    .toLowerCase();
}

/**
 * The stage → tasks configuration, assembled from `/crm/stages/` and
 * `/crm/stage-tasks/` rather than a browser blob.
 */
export function loadLeadStageTasksConfig() {
  const { stages, stageTasks } = useCrmStore.getState();
  return stages.map((stage) => ({
    ...stage,
    tasks: stageTasks
      .filter((task) => task.stageId === stage.id)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)),
  }));
}

/** `/crm/master-tasks/` — the reusable task definitions. */
export function loadMasterTasksConfig() {
  return useCrmStore.getState().masterTasks;
}

/** The task list behind `/crm/tasks`. */
export function loadCrmTasks() {
  return useCrmStore.getState().tasks;
}

/**
 * Persist tasks a screen just built. Rows the server already knows about are
 * left alone; the rest are created through the API.
 */
export function saveCrmTasks(tasks) {
  const { tasks: current, createTask, updateTask } = useCrmStore.getState();
  const known = new Map(current.map((task) => [String(task.id), task]));

  (tasks || []).forEach((task) => {
    if (!task) return;
    const existing = known.get(String(task.id));
    if (!existing) {
      createTask(task).catch((err) => console.warn('[CRM] task not created:', err?.message || err));
      return;
    }
    // Only send a PATCH when something actually differs.
    if (JSON.stringify(existing) !== JSON.stringify(task)) {
      updateTask(task.id, task).catch((err) => console.warn('[CRM] task not saved:', err?.message || err));
    }
  });

  notifyCrmDataChanged();
  return true;
}

/** Who can take a task, from `/crm/team-roster/`. */
export function findEligibleEmployee(taskRole, department) {
  if (!taskRole) return null;
  const target = normalizeStageName(taskRole).replace(/\s+/g, '');
  const wantedDept = department && department !== 'Any' ? normalizeStageName(department) : null;
  const members = useCrmStore.getState().teamMembers;

  const matches = members.filter((member) => {
    const role = normalizeStageName(member.role).replace(/\s+/g, '');
    return role === target || role.includes(target) || target.includes(role);
  });

  if (wantedDept) {
    const inDept = matches.find((m) => normalizeStageName(m.department) === wantedDept);
    if (inDept) return inDept;
  }
  return matches[0] || null;
}

/** The roster as a flat list — screens use it for assignee pickers. */
export function getCrmTeamMembers() {
  return useCrmStore.getState().teamMembers;
}

/**
 * Kept as a named export because screens import it directly. It is a live read
 * of the roster, not a fixed list of invented colleagues.
 */
export const CRM_TEAM_MEMBERS = new Proxy([], {
  get(_target, prop) {
    const members = useCrmStore.getState().teamMembers;
    const value = members[prop];
    return typeof value === 'function' ? value.bind(members) : value;
  },
  has(_target, prop) {
    return prop in useCrmStore.getState().teamMembers;
  },
  ownKeys() {
    return Reflect.ownKeys(useCrmStore.getState().teamMembers);
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(useCrmStore.getState().teamMembers, prop);
  },
});

/** The order stages are configured in, for the funnel charts. */
export function getLeadStageOrder() {
  return useCrmStore.getState().stages
    .slice()
    .sort((a, b) => (Number(a.order ?? a.sequence) || 0) - (Number(b.order ?? b.sequence) || 0))
    .map((stage) => stage.name);
}

/**
 * The server created whatever this stage change called for, so all this does is
 * re-read the collections it touched and let the screens know.
 *
 * Returns the tasks that appeared for this lead, matching the old signature.
 */
export function runLeadStageAutomation(lead, targetStage, options = {}) {
  if (!lead?.id) {
    console.warn('[CRM Automation] Ignored: lead id is missing.');
    return [];
  }

  const before = new Set(loadCrmTasks().map((task) => String(task.id)));

  Promise.all([
    crmSync.pull('tasks'),
    crmSync.pull('deals'),
  ]).then(([tasks, deals]) => {
    const store = useCrmStore.setState;
    if (tasks) store({ tasks });
    if (deals) store({ deals });
    notifyCrmDataChanged();
  }).catch((err) => {
    console.warn('[CRM Automation] could not refresh after stage change:', err?.message || err);
  });

  return loadCrmTasks().filter((task) => (
    String(task.leadId) === String(lead.id) && !before.has(String(task.id))
  ));
}

export default runLeadStageAutomation;
