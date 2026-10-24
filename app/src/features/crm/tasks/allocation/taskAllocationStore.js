import { useCrmStore } from '../../../../stores/crmStore';
import { isServerId } from '../../../../services/resourceSync';

/** Who can be allocated work, and the departments they sit in — from the roster. */
export function loadEmployees() {
  return useCrmStore.getState().teamMembers;
}

export function loadDepartments() {
  const seen = new Set();
  loadEmployees().forEach((m) => { if (m.department) seen.add(m.department); });
  return [...seen];
}

/**
 * Kept as named exports because the allocation screens read them directly.
 * Both are live reads of the roster rather than a fixed list of colleagues.
 */
export const EMPLOYEES = new Proxy([], {
  get(_t, prop) {
    const rows = loadEmployees();
    const value = rows[prop];
    return typeof value === 'function' ? value.bind(rows) : value;
  },
  ownKeys: () => Reflect.ownKeys(loadEmployees()),
  getOwnPropertyDescriptor: (_t, prop) =>
    Reflect.getOwnPropertyDescriptor(loadEmployees(), prop),
});

export const DEPARTMENTS = new Proxy([], {
  get(_t, prop) {
    const rows = loadDepartments();
    const value = rows[prop];
    return typeof value === 'function' ? value.bind(rows) : value;
  },
  ownKeys: () => Reflect.ownKeys(loadDepartments()),
  getOwnPropertyDescriptor: (_t, prop) =>
    Reflect.getOwnPropertyDescriptor(loadDepartments(), prop),
});
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const STATUSES = ['Pending', 'In Progress', 'Completed'];

/** The allocations the CRM store is holding, from `/crm/task-allocations/`. */
export function loadAllocationTasks() {
  return useCrmStore.getState().taskAllocations;
}

/**
 * Persist the allocation list a screen just produced. Rows the server has not
 * seen are created, rows that changed are patched, rows that went are deleted.
 */
export function saveAllocationTasks(tasks) {
  const store = useCrmStore.getState();
  const previous = store.taskAllocations;
  const before = new Map(previous.map((t) => [String(t.id), t]));
  const after = new Set((tasks || []).map((t) => String(t.id)));

  (tasks || []).forEach((task) => {
    if (!task) return;
    const existing = before.get(String(task.id));
    if (!existing) {
      store.createRecord('taskAllocations', task).catch(reportFailure);
    } else if (isServerId(task.id) && JSON.stringify(existing) !== JSON.stringify(task)) {
      store.updateRecord('taskAllocations', task.id, task).catch(reportFailure);
    }
  });

  previous.forEach((task) => {
    if (!after.has(String(task.id)) && isServerId(task.id)) {
      store.deleteRecord('taskAllocations', task.id).catch(reportFailure);
    }
  });

  window.dispatchEvent(new Event('crm:data-updated'));
}

function reportFailure(err) {
  console.warn('[CRM] allocation not saved:', err?.message || err);
}

export function formatDeadline(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}

export function formatAuditDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}
