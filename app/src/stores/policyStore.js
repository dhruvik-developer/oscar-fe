import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import { useAppStore } from "./appStore";
import {
  writeThrough,
  pullTracked,
  acknowledgePolicy as acknowledgePolicyOnServer,
  approvePolicy as approvePolicyOnServer,
  archivePolicy as archivePolicyOnServer,
  isBackendEnabled,
  isServerId,
} from "../services/hrmsSync";

function getDefaultActor(actor) {
  if (actor && typeof actor === 'string' && actor.trim()) return actor.trim();
  const user = useAppStore.getState().currentUser;
  return user?.name || "System";
}

const usePolicyStoreBase = create((set, get) => ({
  /** Load this module's collections from the API. */
  hydrate: async () => {
    const rows = await Promise.all([
      pullTracked("policies"),
      pullTracked("policyCategories"),
    ]);
    set((s) => ({
      policies: rows[0] || s.policies,
      categories: rows[1] || s.categories,
    }));
    return rows;
  },

  /** Empty on sign-out so the next user sees nothing of the previous one. */
  clear: () => set({ policies: [], categories: [] }),

  policies: [],
  categories: [],
  acknowledgements: [],

  // Save helpers
  persistPolicies: (policies) => {
    writeThrough("policies", policies);
  },
  persistCategories: (categories) => {
    writeThrough("policyCategories", categories);
  },
  persistAcks: (acks) => {
    /* Acknowledgements are recorded by POST /hrms/policies/{id}/acknowledge/. */
  },

  // ── Policy Actions ─────────────────────────────────────────
  addPolicy: (data, submitForApproval = false) => {
    const state = get();
    const today = new Date().toISOString().slice(0, 10);
    const count = state.policies.length + 1;
    const newId = `POL-${String(count).padStart(3, "0")}`;
    const status = submitForApproval
      ? (data.approvalRequired ? "Pending Approval" : "Active")
      : (data.status || "Draft");
    const author = getDefaultActor(data.author);

    const newPolicy = {
      id: newId,
      name: data.name || "Untitled Policy",
      category: data.category || "Code of Conduct",
      ownerDept: data.ownerDept || "Human Resources",
      applicableTo: data.applicableTo || "All Employees",
      version: data.version || "v1.0",
      effectiveDate: data.effectiveDate || today,
      reviewDate: data.reviewDate || "",
      approvalRequired: Boolean(data.approvalRequired),
      ackRequired: Boolean(data.ackRequired),
      status,
      summary: data.summary || "",
      content: data.content || "",
      versionHistory: [
        {
          version: data.version || "v1.0",
          effectiveDate: data.effectiveDate || today,
          updatedBy: author,
          summary: data.summary || "Initial policy creation.",
          status,
        },
      ],
      activityLog: [
        {
          date: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          actor: author,
          action: submitForApproval ? "Created and submitted policy for approval" : "Created policy draft",
        },
      ],
      updatedAt: today,
    };

    const updated = [newPolicy, ...state.policies];
    set({ policies: updated });
    get().persistPolicies(updated);
    return newPolicy;
  },

  updatePolicy: (id, updates) => {
    const state = get();
    const today = new Date().toISOString().slice(0, 10);
    const actor = getDefaultActor(updates.actor);
    const updated = state.policies.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        ...updates,
        updatedAt: today,
        activityLog: [
          {
            date: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            actor,
            action: updates.actionLogText || `Updated policy details (${Object.keys(updates).filter(k => k !== 'activityLog' && k !== 'versionHistory').join(', ')})`,
          },
          ...(p.activityLog || []),
        ],
      };
    });
    set({ policies: updated });
    get().persistPolicies(updated);
  },

  approvePolicy: async (id, actor) => {
    const state = get();
    const today = new Date().toISOString().slice(0, 10);
    const resolvedActor = getDefaultActor(actor);
    const updated = state.policies.map((p) => {
      if (p.id !== id) return p;
      const newStatus = "Active";
      const updatedHistory = (p.versionHistory || []).map((v, i) =>
        i === 0 ? { ...v, status: "Active" } : v
      );
      return {
        ...p,
        status: newStatus,
        updatedAt: today,
        versionHistory: updatedHistory,
        activityLog: [
          {
            date: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            actor: resolvedActor,
            action: `Approved policy ${p.version} and published to Active`,
          },
          ...(p.activityLog || []),
        ],
      };
    });
    set({ policies: updated });
    if (isBackendEnabled() && isServerId(id)) {
      try {
        await approvePolicyOnServer(id);
      } catch (err) {
        console.warn("[HRMS] approvePolicy on backend failed, falling back to persist:", err?.message || err);
        get().persistPolicies(updated);
      }
    } else {
      get().persistPolicies(updated);
    }
  },

  rejectPolicy: (id, reason = "", actor) => {
    const state = get();
    const today = new Date().toISOString().slice(0, 10);
    const resolvedActor = getDefaultActor(actor);
    const updated = state.policies.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        status: "Draft",
        updatedAt: today,
        activityLog: [
          {
            date: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            actor: resolvedActor,
            action: `Returned policy to Draft. Reason: ${reason || "Revisions requested"}`,
          },
          ...(p.activityLog || []),
        ],
      };
    });
    set({ policies: updated });
    get().persistPolicies(updated);
  },

  publishPolicy: (id, actor) => {
    const state = get();
    const today = new Date().toISOString().slice(0, 10);
    const resolvedActor = getDefaultActor(actor);
    const updated = state.policies.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        status: "Active",
        updatedAt: today,
        activityLog: [
          {
            date: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            actor: resolvedActor,
            action: `Published policy (${p.version}) as Active`,
          },
          ...(p.activityLog || []),
        ],
      };
    });
    set({ policies: updated });
    get().persistPolicies(updated);
  },

  archivePolicy: async (id, actor) => {
    const state = get();
    const today = new Date().toISOString().slice(0, 10);
    const resolvedActor = getDefaultActor(actor);
    const updated = state.policies.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        status: "Archived",
        updatedAt: today,
        activityLog: [
          {
            date: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            actor: resolvedActor,
            action: `Archived policy (${p.version})`,
          },
          ...(p.activityLog || []),
        ],
      };
    });
    set({ policies: updated });
    if (isBackendEnabled() && isServerId(id)) {
      try {
        await archivePolicyOnServer(id);
      } catch (err) {
        console.warn("[HRMS] archivePolicy on backend failed, falling back to persist:", err?.message || err);
        get().persistPolicies(updated);
      }
    } else {
      get().persistPolicies(updated);
    }
  },

  restorePolicy: (id, actor) => {
    const state = get();
    const today = new Date().toISOString().slice(0, 10);
    const resolvedActor = getDefaultActor(actor);
    const updated = state.policies.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        status: "Active",
        updatedAt: today,
        activityLog: [
          {
            date: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            actor: resolvedActor,
            action: `Restored policy from archive to Active`,
          },
          ...(p.activityLog || []),
        ],
      };
    });
    set({ policies: updated });
    get().persistPolicies(updated);
  },

  deletePolicy: (id) => {
    const state = get();
    const updated = state.policies.filter((p) => p.id !== id);
    set({ policies: updated });
    get().persistPolicies(updated);
  },

  createNewVersion: (id, newVersionData) => {
    const state = get();
    const today = new Date().toISOString().slice(0, 10);
    const author = getDefaultActor(newVersionData.author);
    const updated = state.policies.map((p) => {
      if (p.id !== id) return p;

      const updatedHistory = [
        {
          version: newVersionData.version || `v${(parseFloat(p.version.replace("v", "")) + 0.1).toFixed(1)}`,
          effectiveDate: newVersionData.effectiveDate || today,
          updatedBy: author,
          summary: newVersionData.summary || "New version release",
          status: newVersionData.approvalRequired ? "Pending Approval" : "Active",
        },
        ...(p.versionHistory || []).map((h) => ({ ...h, status: "Archived" })),
      ];

      return {
        ...p,
        version: newVersionData.version || `v${(parseFloat(p.version.replace("v", "")) + 0.1).toFixed(1)}`,
        effectiveDate: newVersionData.effectiveDate || today,
        reviewDate: newVersionData.reviewDate || p.reviewDate,
        summary: newVersionData.summary || p.summary,
        content: newVersionData.content || p.content,
        status: newVersionData.approvalRequired ? "Pending Approval" : "Active",
        updatedAt: today,
        versionHistory: updatedHistory,
        activityLog: [
          {
            date: `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            actor: author,
            action: `Created new version ${newVersionData.version || "update"} (${newVersionData.approvalRequired ? "Submitted for approval" : "Directly activated"})`,
          },
          ...(p.activityLog || []),
        ],
      };
    });
    set({ policies: updated });
    get().persistPolicies(updated);
  },

  // ── Categories Actions ─────────────────────────────────────
  addCategory: (categoryData) => {
    const state = get();
    const count = state.categories.length + 1;
    const newCat = {
      id: `CAT-${String(count).padStart(2, "0")}`,
      name: categoryData.name,
      description: categoryData.description || "",
      color: categoryData.color || "blue",
      icon: categoryData.icon || "Folder",
    };
    const updated = [...state.categories, newCat];
    set({ categories: updated });
    get().persistCategories(updated);
    return newCat;
  },

  updateCategory: (id, updates) => {
    const state = get();
    const updated = state.categories.map((c) => (c.id === id ? { ...c, ...updates } : c));
    set({ categories: updated });
    get().persistCategories(updated);
  },

  deleteCategory: (id) => {
    const state = get();
    const updated = state.categories.filter((c) => c.id !== id);
    set({ categories: updated });
    get().persistCategories(updated);
  },

  // ── Acknowledgements Actions ───────────────────────────────
  // Compliance-critical: the tick is recorded in Postgres
  // (`POST /hrms/policies/{id}/acknowledge/`, stamped for the signed-in
  // employee) as well as locally for instant display.
  acknowledgePolicy: (policyId, employeeName, employeeId, dept = "Operations") => {
    const state = get();
    const user = useAppStore.getState().currentUser;
    const resolvedName = employeeName || user?.name || "Employee";
    const resolvedEmpId = employeeId || user?.employeeId || user?.id || "EMP-USR";
    const policy = state.policies.find((p) => p.id === policyId);
    const now = new Date();
    const nowStr = `${now.toISOString().slice(0, 10)} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const existingIndex = state.acknowledgements.findIndex(
      (a) => a.policyId === policyId && (a.employeeId === resolvedEmpId || a.employeeName === resolvedName)
    );

    let updatedAcks;
    if (existingIndex >= 0) {
      updatedAcks = state.acknowledgements.map((a, i) =>
        i === existingIndex
          ? { ...a, status: "Acknowledged", ackDate: nowStr, version: policy?.version || a.version }
          : a
      );
    } else {
      const newAck = {
        id: `ACK-${Date.now()}`,
        policyId,
        policyName: policy?.name || "Company Policy",
        version: policy?.version || "v1.0",
        employeeName: resolvedName,
        employeeId: resolvedEmpId,
        dept,
        status: "Acknowledged",
        ackDate: nowStr,
      };
      updatedAcks = [newAck, ...state.acknowledgements];
    }

    set({ acknowledgements: updatedAcks });
    get().persistAcks(updatedAcks);
    if (isBackendEnabled() && isServerId(policyId)) {
      acknowledgePolicyOnServer(policyId).catch((err) => {
        console.warn("[HRMS] acknowledgement not saved:", err?.message || err);
      });
    }
  },

  // Resets to initial sample fixtures if user clears or wants clean reset
  resetAll: () => {
    set({
      policies: [],
      categories: [],
      acknowledgements: [],
    });
    usePolicyStore.getState().hydrate();
  },
}));

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const usePolicyStore = lazyStore(usePolicyStoreBase, "policy");
