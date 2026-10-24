import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import { hrmsSync, pullTracked, isBackendEnabled } from "../services/hrmsSync";
import { uploadFileToBackend } from "../services/fileUploadService";
import api from "../services/api";

/**
 * HRMS documents. The file goes up through the platform file protocol
 * (`/files/upload-url/` → PUT → commit) and the document row keeps only its
 * `fileId`; preview and download fetch the stored file through a fresh signed
 * link. Every action talks to the server and rejects on failure, so the page
 * never shows a document the server did not keep.
 */
const FILE_SCOPE = "hrms_document";

const useDocumentStoreBase = create((set, get) => ({
  /** Load this module's collections from the API. */
  hydrate: async () => {
    const rows = await Promise.all([
      pullTracked("documents"),
    ]);
    set((s) => ({
      documents: rows[0] || s.documents,
    }));
    return rows;
  },

  /** Empty on sign-out so the next user sees nothing of the previous one. */
  clear: () => set({ documents: [] }),

  documents: [],

  /** Upload `file`, then create the document that points at it. */
  addDocument: async ({ file, ...meta }) => {
    if (!isBackendEnabled()) throw new Error("The server is not connected, so the document cannot be saved.");
    const fileId = file ? await uploadFileToBackend(file, file.name, FILE_SCOPE) : undefined;
    const saved = await hrmsSync.create("documents", { version: "v1.0", ...meta, fileId });
    if (!saved?.id) throw new Error("The server did not return the saved document.");
    set((s) => ({ documents: [saved, ...s.documents] }));
    return saved;
  },

  /**
   * Save edits. With `file`, the stored file is replaced and the version is
   * bumped (v1.0 → v2.0).
   */
  updateDocument: async (id, updates, { file } = {}) => {
    const current = get().documents.find((d) => d.id === id);
    const payload = { ...updates };
    if (file) {
      payload.fileId = await uploadFileToBackend(file, file.name, FILE_SCOPE);
      const n = parseInt(String(current?.version ?? "v1").replace(/^v/i, ""), 10) || 1;
      payload.version = `v${n + 1}.0`;
    }
    const saved = await hrmsSync.update("documents", id, payload);
    if (!saved?.id) throw new Error("The server did not return the updated document.");
    set((s) => ({ documents: s.documents.map((d) => (d.id === id ? saved : d)) }));
    return saved;
  },

  deleteDocument: async (id) => {
    await hrmsSync.remove("documents", id);
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
  },

  /** The stored file as a Blob, through a freshly signed download link. */
  fetchDocumentFile: async (doc) => {
    if (!doc?.hasFile) throw new Error("No file is attached to this document.");
    const res = await api.get(`/hrms/documents/${doc.id}/download/`);
    const link = res?.downloadUrl || res?.data?.downloadUrl;
    if (!link) throw new Error("The server did not return a download link.");
    // The link is absolute to the API host; in dev it must go through the
    // Vite proxy, so keep only the path when it points at the API.
    let target = link;
    try {
      const parsed = new URL(link, window.location.origin);
      if (parsed.pathname.startsWith("/api/")) target = `${parsed.pathname}${parsed.search}`;
    } catch {
      // keep the link as given
    }
    const fileRes = await fetch(target);
    if (!fileRes.ok) throw new Error(`Could not open the file (${fileRes.status}).`);
    return fileRes.blob();
  },

  /** Discard anything local and re-read the documents from the server. */
  resetToDefault: () => useDocumentStore.getState().hydrate()
}));

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const useDocumentStore = lazyStore(useDocumentStoreBase, "documents");
