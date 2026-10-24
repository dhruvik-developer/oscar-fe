/**
 * crmStorage — a Storage-shaped adapter over the CRM API.
 *
 * `contractService`, `dealProjectService` and `leadDealConversion` each perform
 * a small transaction: collect several `[key, value]` writes, apply them, and
 * roll back the ones that succeeded if a later one throws. That logic is worth
 * keeping — what was wrong was the destination.
 *
 * So instead of rewriting those three services, they are handed this object in
 * place of `localStorage`. It speaks the same four methods, and routes the CRM
 * keys to the store and the API:
 *
 *   deals   → the CRM store's `deals`, saved through `/crm/deals/`
 *   details → the per-lead sections, which the server already maintains
 *
 * A key it does not recognise falls through to real `localStorage`, so a caller
 * that stores a genuine UI preference still works.
 */
import { useCrmStore } from '../stores/crmStore';
import { syncCollection } from './crmCollections';

export const DEALS_KEY = 'evenmore_crm_deals_v2';
export const LEAD_DETAILS_KEY = 'evenmore-crm-lead-details-v1';

function realStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export const crmStorage = {
  getItem(key) {
    if (key === DEALS_KEY) {
      return JSON.stringify(useCrmStore.getState().deals);
    }
    if (key === LEAD_DETAILS_KEY) {
      // The callers only read `activities` out of this, and the server keeps
      // the timeline itself — so an empty map is the honest answer.
      return '{}';
    }
    return realStorage()?.getItem(key) ?? null;
  },

  setItem(key, value) {
    if (key === DEALS_KEY) {
      let deals;
      try {
        deals = JSON.parse(value);
      } catch {
        throw new Error('Invalid deal data.');
      }
      if (!Array.isArray(deals)) throw new Error('Invalid deal data.');
      syncCollection('deals', deals, useCrmStore.getState().deals);
      return;
    }
    if (key === LEAD_DETAILS_KEY) {
      // The lead timeline is written server-side from the changes themselves,
      // so there is nothing to mirror here.
      return;
    }
    realStorage()?.setItem(key, value);
  },

  removeItem(key) {
    if (key === DEALS_KEY || key === LEAD_DETAILS_KEY) return;
    realStorage()?.removeItem(key);
  },

  clear() {
    realStorage()?.clear();
  },
};

export default crmStorage;
