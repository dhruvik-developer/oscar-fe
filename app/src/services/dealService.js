import { useCrmStore } from '../stores/crmStore';
import { syncCollection } from './crmCollections';

/**
 * Deals live at `/crm/deals/`. This module keeps its old signatures because six
 * screens import them; what changed is that they read the CRM store instead of
 * a `localStorage` blob, and a save is a request.
 */
export const DEALS_STORAGE_KEY = 'evenmore_crm_deals_v2';

export function getInitialsFromName(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarColorFromName(name = '') {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-emerald-100 text-emerald-700',
    'bg-indigo-100 text-indigo-700',
    'bg-sky-100 text-sky-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash += name.charCodeAt(i);
  }
  return colors[hash % colors.length];
}

export const EMPTY_DEAL_FORM = {
  name: '',
  price: '',
  client: '',
  phone: '',
  product: 'Diamond Jewelry',
  stage: 'Draft',
  source: 'Website',
  assignedUser: '',
  date: '15 Sep 2025',
  tag: '',
};


/** The deals the CRM store is holding, as the server returned them. */
export function loadDeals() {
  return useCrmStore.getState().deals;
}

/** Persist the deal list a screen just produced. */
export function saveDeals(deals) {
  syncCollection('deals', deals, useCrmStore.getState().deals);
}

export function buildDeal(input, id = `dl-${Date.now()}`) {
  const value = { ...EMPTY_DEAL_FORM, ...input };
  const name = String(value.name || '').trim();
  const client = String(value.client || '').trim();
  const phone = String(value.phone || '').trim();
  if (!name || !client || !phone) throw new Error('Deal name, client and phone are required.');
  return { ...value, id, name, client, phone, price: Number(value.price) || 0,
    initials: getInitialsFromName(client), avatarColor: getAvatarColorFromName(client),
    tag: value.stage === 'Won' ? 'Won' : value.stage === 'Lost' ? 'Lost' : value.tag || '' };
}

export function findDealForLead(leadId) {
  try {
    return loadDeals().find((deal) => deal.leadId != null && String(deal.leadId) === String(leadId)) || null;
  } catch (error) {
    console.error('[CRM Deals] Unable to read linked deal:', error);
    return null;
  }
}
