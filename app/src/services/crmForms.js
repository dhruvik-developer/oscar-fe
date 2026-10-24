/**
 * crmForms — the lead-capture and task form definitions, at `/crm/forms/`.
 *
 * The form builders kept their definitions in three `localStorage` keys
 * (`dynamicLeadForms`, `leadFormSections`, `leadTaskFormsV1`), which meant a
 * form designed on one machine did not exist on any other. They are one server
 * collection, distinguished by `kind`, so a form published from the builder is
 * the form the capture page renders.
 *
 * Which form the builder currently has open stays in the browser: that is a
 * per-tab editing position, not part of the form.
 */
import { api } from './api';
import { useCrmStore } from '../stores/crmStore';
import { isBackendEnabled, isServerId } from './resourceSync';

// Form definitions are server records: no copy is kept in browser storage.
const NOT_SIGNED_IN = 'You are not signed in to the server — the form was not saved.';

export const LEAD_FORM = 'lead';
export const TASK_FORM = 'task';

function dedupe(rows) {
  const seen = new Map();
  (rows || []).forEach((form) => {
    if (form && form.id) seen.set(String(form.id), form);
  });
  return [...seen.values()];
}

/** The forms of one kind, as the server returned them. Pure read — never
 * writes, so it is safe to call during render (builders call it in useMemo,
 * the create modal calls it in the render body). */
export function loadForms(kind = LEAD_FORM) {
  const inStore = dedupe(
    (useCrmStore.getState().forms || []).filter((form) => form && (form.kind || LEAD_FORM) === kind),
  );
  return inStore;
}

/** temp/local id -> confirmed server UUID, filled in as creates resolve. */
const serverIdByTempId = new Map();

/** Per-row promise chain so rapid builder edits serialize behind the
 * in-flight request instead of firing a parallel create per keystroke
 * (which used to mint a duplicate backend row and orphan the editor on a
 * temp id whose saves then silently no-op). */
const saveQueues = new Map();

/** Follow the temp -> server id chain for a form id. */
export function resolveFormId(id) {
  let current = id == null ? id : String(id);
  const seen = new Set();
  while (current != null && serverIdByTempId.has(current) && !seen.has(current)) {
    seen.add(current);
    current = serverIdByTempId.get(current);
  }
  return current;
}

function enqueueSave(key, task) {
  const tail = (saveQueues.get(key) || Promise.resolve()).then(task);
  saveQueues.set(key, tail);
  tail.finally(() => {
    if (saveQueues.get(key) === tail) saveQueues.delete(key);
  });
  return tail;
}

/** Remember which server id a temp id became, so later edits update it. */
function reconcileLocal(requestedId, saved) {
  if (!saved || !saved.id) return;
  const serverId = String(saved.id);
  if (String(requestedId) !== serverId) serverIdByTempId.set(String(requestedId), serverId);
}

/** Persist the form list a builder just produced.
 *
 * Returns a promise `{ ok, results, errors }` — callers must await it and
 * surface `errors` instead of navigating away assuming success. Drafts are
 * not kept in the browser: a failed save is reported, and what was typed stays
 * in the open builder until the user retries.
 */
export function saveForms(next = [], kind = LEAD_FORM) {
  const seen = new Map();
  (next || []).forEach((form) => {
    if (form && form.id) seen.set(String(form.id), { ...form, kind: form.kind || kind });
  });
  const stamped = [...seen.values()];
  const previous = useCrmStore.getState().forms || [];
  // Forms of the other kind are untouched, so they are carried through as-is.
  const others = previous.filter((form) => form && (form.kind || LEAD_FORM) !== kind);
  const merged = [...others, ...stamped];
  if (JSON.stringify(merged) === JSON.stringify(previous)) {
    return Promise.resolve({ ok: true, noop: true, results: [] });
  }
  if (!isBackendEnabled()) {
    // Without a session nothing can be saved, and nothing is kept locally.
    const error = new Error(NOT_SIGNED_IN);
    return Promise.resolve({ ok: false, results: [], errors: [{ error }] });
  }
  const store = useCrmStore.getState();
  const sameKind = (form) => (form && (form.kind || LEAD_FORM)) === kind;
  const nextById = new Map(stamped.map((form) => [String(form?.id), form]));
  const jobs = [];
  previous.filter(sameKind).forEach((old) => {
    if (!old || !isServerId(old.id)) return;
    const stillWanted = [...nextById.keys()].some((key) => resolveFormId(key) === String(old.id));
    if (!stillWanted) {
      jobs.push(enqueueSave(String(old.id), async () => {
        try {
          await store.deleteRecord('forms', old.id);
          return { id: String(old.id), deleted: true };
        } catch (err) {
          console.warn('[CRM] form not deleted:', err?.message || err);
          return { id: String(old.id), error: err };
        }
      }));
    }
  });
  stamped.forEach((form) => {
    const requestedKey = String(form.id);
    jobs.push(enqueueSave(requestedKey, async () => {
      const live = useCrmStore.getState();
      const serverKey = resolveFormId(requestedKey);
      const row = serverKey !== requestedKey ? { ...form, id: serverKey } : form;
      const old = (live.forms || []).find((item) => String(item?.id) === String(serverKey) && sameKind(item));
      try {
        let saved;
        if (!old) {
          if (isServerId(serverKey)) return { id: requestedKey, noop: true };
          saved = await live.createRecord('forms', row);
        } else if (JSON.stringify(old) === JSON.stringify({ ...row, kind: row.kind || kind })) {
          return { id: requestedKey, noop: true };
        } else {
          saved = await live.updateRecord('forms', old.id, row);
        }
        if (!saved) throw new Error('The server did not save the form.');
        reconcileLocal(requestedKey, saved);
        return { id: requestedKey, saved };
      } catch (err) {
        console.warn('[CRM] form not saved:', err?.message || err);
        return { id: requestedKey, error: err };
      }
    }));
  });
  return Promise.all(jobs).then((results) => {
    const errors = results.filter((result) => result && result.error);
    return { ok: errors.length === 0, results, errors };
  });
}

/** One form by id, across both kinds. */
export function findForm(formId) {
  return useCrmStore.getState().forms.find((form) => String(form.id) === String(formId)) || null;
}

/** Which form the builder has open — a per-tab editing position. */
export function getActiveFormId(key = 'activeLeadFormId') {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The live lead form: which form Create Lead renders, for every user. It is
// the server's `isActive` flag (at most one lead form), not browser storage,
// so switching every form off in Manage Lead Create Forms blocks Create Lead
// on every machine.
// ---------------------------------------------------------------------------

function applyLiveLeadForm(formId) {
  const id = formId == null ? null : String(formId);
  useCrmStore.setState((state) => ({
    forms: (state.forms || []).map((form) => (
      (form.kind || LEAD_FORM) === LEAD_FORM ? { ...form, isActive: id !== null && String(form.id) === id } : form
    )),
  }));
}

/** The switched-on lead form id from the loaded forms, or null when all are off. */
export function getLiveLeadFormId() {
  const live = (useCrmStore.getState().forms || [])
    .find((form) => (form.kind || LEAD_FORM) === LEAD_FORM && form.isActive);
  return live ? String(live.id) : null;
}

/** Ask the server which lead form is live (another user may have changed it). */
export async function fetchLiveLeadFormId() {
  const res = await api.get('/crm/forms/active/', { query: { kind: LEAD_FORM } });
  const id = res?.formId ?? res?.data?.formId ?? null;
  applyLiveLeadForm(id);
  return id;
}

/** Switch one lead form on for everyone; `null` switches them all off. */
export async function setLiveLeadForm(formId) {
  const res = await api.post('/crm/forms/set-active/', { formId: formId || null, kind: LEAD_FORM });
  const id = res?.formId ?? res?.data?.formId ?? null;
  applyLiveLeadForm(id);
  return id;
}

/** True when a lead form is switched on in Manage Lead Create Forms. */
export function isLeadFormSwitchedOn() {
  return getLiveLeadFormId() !== null;
}

export function setActiveFormId(formId, key = 'activeLeadFormId') {
  try {
    if (formId) localStorage.setItem(key, formId);
    else localStorage.removeItem(key);
  } catch {
    /* private mode — the builder still works, it just does not reopen */
  }
}
