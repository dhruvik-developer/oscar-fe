/**
 * taskCompletionService — completing a CRM task, through the API.
 *
 * `POST /crm/tasks/{id}/complete/` is the whole flow (api.md §9.3): it closes
 * the task, records the outcome and note, and then either advances the lead to
 * its next stage — running that stage's automation — or creates the follow-up
 * the chosen next action calls for, preferring a matching stage template over
 * its fallbacks. The server's answer carries the updated task, the follow-up
 * and whether the stage moved.
 *
 * The previous version of this file did all of that in the browser against five
 * `localStorage` blobs, which meant a completion was only ever true in the tab
 * that performed it. What remains local here is the option list the modal
 * renders — UI copy, not data.
 */
import { useCrmStore } from '../stores/crmStore';
import { completeTask as completeTaskRequest, describeError } from './crmSync';
import {
  CRM_EVENT,
  normalizeStageName,
  getLeadStageOrder as stageOrderFromStore,
  notifyCrmDataChanged,
} from './leadStageAutomation';

/* ── Outcome options for "What Happened?" ───────────────────── */
export const TASK_OUTCOMES = [
  { value: 'Connected', label: 'Connected', description: 'Successfully reached the contact.' },
  { value: 'No Answer', label: 'No Answer', description: 'Contact did not answer.' },
  { value: 'Interested', label: 'Interested', description: 'Contact showed interest in the offering.' },
  { value: 'Not Interested', label: 'Not Interested', description: 'Contact declined the offering.' },
  { value: 'Follow-up Required', label: 'Follow-up Required', description: 'Needs another touch point later.' },
];

/* ── Next action options for "What's Next?" ─────────────────── */
export const NEXT_ACTIONS = [
  { value: 'needs-another-attempt', label: 'Needs another attempt', description: 'Creates another attempt in this same stage.' },
  { value: 'ready-to-move-on', label: 'Ready to move on', description: 'Moves the lead to the next stage and creates that stage\u2019s task.' },
  { value: 'finished-with-lead', label: 'Finished with this lead', description: 'Closes every open task on it. The lead stays in its current stage.' },
];

export const NEXT_ACTION_LABELS = NEXT_ACTIONS.reduce((map, item) => {
  map[item.value] = item.label;
  return map;
}, {});

export { CRM_EVENT };

/** Only used as a last resort when the tenant has configured no stages yet. */
export const DEFAULT_STAGE_ORDER = [];

export function buildLeadDisplay(lead) {
  if (!lead) return '';
  return `${lead.name || 'Untitled Lead'}${lead.company ? ` (${lead.company})` : ''}`;
}

/** The lead rows the CRM store is holding. */
export function loadLeadRows() {
  return useCrmStore.getState().leads;
}

/**
 * Resolve the lead behind a task row. Tasks carry `leadId`; the display-name
 * match is kept for rows rendered as "Name (Company)".
 */
export function resolveLeadForTask(task) {
  const rows = loadLeadRows();
  if (rows.length === 0) return null;

  if (task?.leadId) {
    const byId = rows.find((l) => String(l.id) === String(task.leadId));
    if (byId) return byId;
  }

  const display = String(task?.lead || task?.leadName || '').trim().toLowerCase();
  if (!display) return null;

  return rows.find((l) => {
    const full = buildLeadDisplay(l).toLowerCase();
    if (display === full) return true;
    const name = String(l.name || '').toLowerCase();
    const company = String(l.company || '').toLowerCase();
    return name && company && display.includes(name) && display.includes(company);
  }) || null;
}

/** Stage names in their configured order, from `/crm/stages/`. */
export function getLeadStageOrder() {
  const order = stageOrderFromStore();
  return order.length > 0 ? order : DEFAULT_STAGE_ORDER;
}

/** The stage after `currentStage`, or null at the end of the pipeline. */
export function getNextStageName(currentStage) {
  const order = getLeadStageOrder();
  const normalized = normalizeStageName(currentStage);
  const index = order.findIndex((name) => normalizeStageName(name) === normalized);
  if (index === -1 || index >= order.length - 1) return null;
  return order[index + 1];
}

/**
 * Complete a task. The server decides what follows; this returns the same
 * `{ok, message, createdTask, stageChanged}` shape the screens already read.
 */
export async function completeTaskWithOutcome({ task, outcome, nextAction, note, nextFollowUpAt, targetStageId }) {
  if (!task?.id) {
    return { ok: false, message: 'No task selected.', createdTask: null, stageChanged: false };
  }

  try {
    const result = await completeTaskRequest(task.id, {
      outcome,
      nextAction,
      note: String(note || '').trim() || undefined,
      nextFollowUpAt: nextFollowUpAt || undefined,
      targetStageId: targetStageId || undefined,
    });

    const store = useCrmStore.getState();
    await store.refresh('tasks');
    if (result?.stageChanged || result?.lead || result?.leadId) await store.refresh('leads');
    notifyCrmDataChanged();

    const createdTasks = result?.createdTasks || [];
    const createdTask = result?.followUpTask || createdTasks[0] || null;
    const lead = result?.lead || null;
    const leadId = result?.leadId || lead?.id || task?.leadId || null;
    const stageChanged = Boolean(result?.stageChanged);
    const taskCount = createdTasks.length;
    return {
      ok: true,
      message: stageChanged && lead
        ? `Lead moved to ${lead.status || lead.stageName || 'the new stage'}. ${taskCount} task${taskCount === 1 ? '' : 's'} created.`
        : createdTask
          ? `Task completed. ${createdTask.title} created.`
          : 'Task completed successfully.',
      createdTask,
      createdTasks,
      stageChanged,
      task: result?.task || null,
      lead,
      leadId: leadId ? String(leadId) : null,
    };
  } catch (err) {
    return {
      ok: false,
      message: describeError(err),
      createdTask: null,
      stageChanged: false,
    };
  }
}

export default completeTaskWithOutcome;
