/**
 * leadDetailStore — the sub-collections behind one lead's detail drawer.
 *
 * These lived in a single `evenmore-crm-lead-details-v1` blob in localStorage,
 * alongside a set of `build*` helpers that invented sources, emails, files and
 * a timeline whenever the blob was empty. Every one of those sections has a
 * real endpoint (`/crm/leads/{id}/notes/`, `/emails/`, `/files/`, …), so the
 * drawer now shows what the server has — including nothing, when there is
 * nothing.
 *
 * Sections are cached per lead so the ten call sites inside `LeadDetailView`
 * can stay synchronous reads of a snapshot.
 */
import { create } from 'zustand';
import { pullLeadDetail, pushLeadDetail, patchLeadSection, deleteLeadSection } from '../services/crmSync';
import { isServerId, mapWithLimit } from '../services/resourceSync';

/** The sections the drawer renders, in the order it loads them. */
export const LEAD_SECTIONS = [
  'users', 'products', 'sources', 'emails',
  'timeline', 'files', 'notes', 'threads',
];

const EMPTY_SECTIONS = Object.freeze(
  Object.fromEntries(LEAD_SECTIONS.map((section) => [section, []])),
);

/** `tasks` and `activities` come from the CRM task list and the timeline. */
export const EMPTY_DETAIL = Object.freeze({
  ...EMPTY_SECTIONS,
  tasks: [],
  activities: [],
});

export const useLeadDetailStore = create((set, get) => ({
  byLead: {},
  loading: {},

  /** Everything the drawer knows about one lead, never undefined. */
  sectionsFor: (leadId) => get().byLead[String(leadId || '')] || EMPTY_DETAIL,

  /**
   * Load every section for a lead. Sections whose request fails stay empty
   * rather than falling back to invented rows.
   */
  load: async (leadId, { force = false } = {}) => {
    const key = String(leadId || '');
    if (!isServerId(leadId)) return EMPTY_DETAIL;
    if (!force && get().byLead[key]) return get().byLead[key];
    if (get().loading[key]) return get().byLead[key] || EMPTY_DETAIL;

    set((s) => ({ loading: { ...s.loading, [key]: true } }));
    const pairs = await mapWithLimit(
      LEAD_SECTIONS,
      async (section) => [section, (await pullLeadDetail(leadId, section)) || []],
    );
    const sections = { ...EMPTY_DETAIL, ...Object.fromEntries(pairs) };
    // The drawer's "activities" strip is the same data as the timeline.
    sections.activities = sections.timeline;
    set((s) => ({
      byLead: { ...s.byLead, [key]: sections },
      loading: { ...s.loading, [key]: false },
    }));
    return sections;
  },

  /** Append to one section, server first, then the cache. */
  add: async (leadId, section, payload) => {
    const key = String(leadId || '');
    const saved = await pushLeadDetail(leadId, section, payload);
    // `saved` is the normalized server row; when the row cannot be posted
    // (local-only lead, file preview without a file record) the payload
    // itself stays in the cache marked unsynced so nothing typed is lost.
    const row = saved || { ...payload, _synced: false };
    set((s) => {
      const current = s.byLead[key] || EMPTY_DETAIL;
      return {
        byLead: {
          ...s.byLead,
          [key]: { ...current, [section]: [...(current[section] || []), row] },
        },
      };
    });
    return row;
  },

  /** Re-read one section after something outside the drawer changed it. */
  refreshSection: async (leadId, section) => {
    const key = String(leadId || '');
    const rows = await pullLeadDetail(leadId, section);
    if (!rows) return null;
    set((s) => ({
      byLead: { ...s.byLead, [key]: { ...(s.byLead[key] || EMPTY_DETAIL), [section]: rows } },
    }));
    return rows;
  },

  /**
   * Update one section row, server first, then the cache. The patch is
   * merged over the stored row so partial edits still map to a complete
   * API payload. Local-only rows stay local.
   */
  updateSection: async (leadId, section, rowId, patch) => {
    const key = String(leadId || '');
    const current = get().byLead[key] || EMPTY_DETAIL;
    const rows = current[section] || [];
    const existing = rows.find((row) => String(row?.id) === String(rowId));
    if (!existing) return null;
    const next = { ...existing, ...patch };
    const saved = await patchLeadSection(leadId, section, rowId, next);
    const row = saved || { ...next, _synced: false };
    set((s) => {
      const now = s.byLead[key] || EMPTY_DETAIL;
      return {
        byLead: {
          ...s.byLead,
          [key]: {
            ...now,
            [section]: (now[section] || []).map((item) =>
              (String(item?.id) === String(rowId) ? row : item)),
          },
        },
      };
    });
    return row;
  },

  /** Delete one section row, server first, then the cache. */
  removeSection: async (leadId, section, rowId) => {
    const key = String(leadId || '');
    await deleteLeadSection(leadId, section, rowId);
    set((s) => {
      const now = s.byLead[key] || EMPTY_DETAIL;
      return {
        byLead: {
          ...s.byLead,
          [key]: {
            ...now,
            [section]: (now[section] || []).filter(
              (item) => String(item?.id) !== String(rowId)),
          },
        },
      };
    });
    return true;
  },

  clear: () => set({ byLead: {}, loading: {} }),
}));

export default useLeadDetailStore;
