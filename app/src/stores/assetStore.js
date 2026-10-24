import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import {
  hrmsSync,
  isBackendEnabled,
  isServerId,
  assignAsset as assignAssetApi,
  returnAsset as returnAssetApi,
  approveAssetRequest,
  rejectAssetRequest,
  fulfillAssetRequest,
  cancelAssetRequest,
} from "../services/hrmsSync";

/**
 * Asset register and asset requisitions.
 *
 * Every action goes to the API first and keeps the server's copy of the row;
 * nothing is invented locally. Failures throw so the screen can toast them.
 * Assignment, return, approval and fulfilment use their own server actions,
 * which write the custody history and keep the request/asset pair consistent.
 */

function requireBackend() {
  if (!isBackendEnabled()) throw new Error("Sign in to manage assets.");
}

function ensureRow(row, what) {
  if (!row || typeof row !== "object" || !row.id) {
    throw new Error(`The server did not return the ${what}.`);
  }
  return row;
}

function upsert(list, row) {
  return list.some((r) => r.id === row.id)
    ? list.map((r) => (r.id === row.id ? row : r))
    : [row, ...list];
}

/** Attach the known category id for a category name, or leave the name to be created. */
function withCategory(data, categories) {
  const out = { ...data };
  let name = String(out.category || "").trim();
  // The reader labels a missing category "Uncategorised"; that is not a name to create.
  if (name === "Uncategorised" && !isServerId(out.categoryId)) name = "";
  if (isServerId(out.categoryId)) {
    const known = categories.find((c) => c.id === out.categoryId);
    if (!name || (known && known.name === name)) return out;
  }
  const match = name
    ? categories.find((c) => String(c.name || "").toLowerCase() === name.toLowerCase())
    : null;
  if (match) {
    out.categoryId = match.id;
    out.category = match.name;
  } else {
    out.categoryId = undefined;
    out.category = name || undefined;
  }
  return out;
}

/** Fields the register form must never push through a plain update. */
function stripAssignment(data) {
  const out = { ...data };
  delete out.employeeId;
  delete out.assignedTo;
  delete out.history;
  delete out.pendingRequests;
  if (out.status === "Assigned") delete out.status;
  // A blank cost field means "unknown", not zero.
  if (out.purchaseCost === "" || out.purchaseCost === "—") out.purchaseCost = null;
  return out;
}

const useAssetStoreBase = create((set, get) => ({
  assets: [],
  requests: [],
  categories: [],
  loading: false,
  loaded: false,

  /** Load assets, requests and categories from the API in parallel. */
  hydrate: async () => {
    set({ loading: true });
    try {
      const [assets, requests, categories] = await Promise.all([
        hrmsSync.pull("assets"),
        hrmsSync.pull("assetRequests"),
        hrmsSync.pull("assetCategories"),
      ]);
      set((s) => ({
        assets: assets || s.assets,
        requests: requests || s.requests,
        categories: categories || s.categories,
        loaded: true,
      }));
      return [assets, requests, categories];
    } finally {
      set({ loading: false });
    }
  },

  refreshAssets: async () => {
    const rows = await hrmsSync.pull("assets");
    if (rows) set({ assets: rows });
    return rows;
  },

  refreshRequests: async () => {
    const rows = await hrmsSync.pull("assetRequests");
    if (rows) set({ requests: rows });
    return rows;
  },

  refreshCategories: async () => {
    const rows = await hrmsSync.pull("assetCategories");
    if (rows) set({ categories: rows });
    return rows;
  },

  /** Empty on sign-out so the next user sees nothing of the previous one. */
  clear: () => set({ assets: [], requests: [], categories: [], loaded: false, loading: false }),

  // ── register ─────────────────────────────────────────────────────────────

  addAsset: async (assetData) => {
    requireBackend();
    const payload = stripAssignment(withCategory(assetData, get().categories));
    const row = ensureRow(await hrmsSync.create("assets", payload), "asset");
    set((s) => ({ assets: upsert(s.assets, row) }));
    if (!isServerId(payload.categoryId) && payload.category) get().refreshCategories();
    return row;
  },

  updateAsset: async (id, updates) => {
    requireBackend();
    const current = get().assets.find((a) => a.id === id) || {};
    const payload = stripAssignment(withCategory({ ...current, ...updates }, get().categories));
    const row = ensureRow(await hrmsSync.update("assets", id, payload), "asset");
    set((s) => ({ assets: upsert(s.assets, row) }));
    if (!isServerId(payload.categoryId) && payload.category) get().refreshCategories();
    return row;
  },

  deleteAsset: async (id) => {
    requireBackend();
    await hrmsSync.remove("assets", id);
    set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }));
  },

  /** Issue a unit to an employee; the server writes the custody history. */
  assignAsset: async (id, { employeeId, notes } = {}) => {
    requireBackend();
    if (!isServerId(employeeId)) throw new Error("Select an employee to assign this asset to.");
    const row = ensureRow(
      await assignAssetApi(id, { employeeId, notes: notes || undefined }),
      "asset",
    );
    set((s) => ({ assets: upsert(s.assets, row) }));
    await get().refreshAssets();
    return row;
  },

  /** Check a unit back in; `Needs Repair` sends it to maintenance. */
  returnAsset: async (id, { condition = "Good", notes = "" } = {}) => {
    requireBackend();
    const row = ensureRow(
      await returnAssetApi(id, { condition, notes: notes || undefined }),
      "asset",
    );
    set((s) => ({ assets: upsert(s.assets, row) }));
    await get().refreshAssets();
    return row;
  },

  setAssetStatus: async (id, newStatus, reason = "") => {
    const current = get().assets.find((a) => a.id === id);
    const notes = reason
      ? [current?.notes, reason].filter(Boolean).join("\n")
      : current?.notes;
    return get().updateAsset(id, { status: newStatus, notes });
  },

  // ── requests ─────────────────────────────────────────────────────────────

  /**
   * Raise a request: `{ requestType: 'Inventory', requestedAssetId }` or
   * `{ requestType: 'Other', itemName, categoryId | categoryName }`, plus
   * priority and justification. `employeeId` is optional (defaults to the caller).
   */
  addRequest: (payload) => {
    const run = (async () => {
      requireBackend();
      const row = ensureRow(await hrmsSync.create("assetRequests", payload), "request");
      set((s) => ({ requests: upsert(s.requests, row) }));
      return row;
    })();
    // Some callers fire and forget; the ones that await still see the error.
    run.catch(() => {});
    return run;
  },

  /** Inventory requests are issued on approval (→ Fulfilled); Other requests become Approved. */
  approveRequest: async (id, { remark, assetId } = {}) => {
    requireBackend();
    const body = {};
    if (remark) body.remark = remark;
    if (assetId) body.assetId = assetId;
    const row = ensureRow(await approveAssetRequest(id, body), "request");
    set((s) => ({ requests: upsert(s.requests, row) }));
    await Promise.all([get().refreshAssets(), get().refreshRequests()]);
    return row;
  },

  rejectRequest: async (id, remark = "") => {
    requireBackend();
    const row = ensureRow(
      await rejectAssetRequest(id, remark ? { remark } : {}),
      "request",
    );
    set((s) => ({ requests: upsert(s.requests, row) }));
    await get().refreshAssets();
    return row;
  },

  /** Issue an available unit against an approved Other request. */
  fulfillRequest: async (id, assetId) => {
    requireBackend();
    if (!assetId) throw new Error("Select an available asset to issue.");
    const row = ensureRow(await fulfillAssetRequest(id, { assetId }), "request");
    set((s) => ({ requests: upsert(s.requests, row) }));
    await Promise.all([get().refreshAssets(), get().refreshRequests()]);
    return row;
  },

  /** The requester withdraws their own pending request. */
  cancelRequest: async (id) => {
    requireBackend();
    const row = ensureRow(await cancelAssetRequest(id), "request");
    set((s) => ({ requests: upsert(s.requests, row) }));
    return row;
  },

  /** Discard anything local and re-read the register from the server. */
  resetDefaults: () => useAssetStoreBase.getState().hydrate(),
}));

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const useAssetStore = lazyStore(useAssetStoreBase, "assets");
