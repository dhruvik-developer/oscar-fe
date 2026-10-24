import { create } from 'zustand';
import {
  createDocumentShare,
  revokeDocumentShare,
  pullDocumentShares,
} from '../services/pmsSync';

/**
 * proofShareStore — the approval links issued against a design proof.
 *
 * Kept out of pmsStore deliberately: a link is a circulation artefact, not part
 * of a project's own record, and the decision it carries is written back through
 * pmsStore.decideDocument so every stage rule and audit entry still applies.
 *
 * The token is issued by the server (api.md §10.5), so the link works for the
 * recipient rather than only inside the browser that created it. This store
 * holds what the project manager sees about a link; the recipient's side is the
 * public approval page.
 */


/** Links go stale on their own so a circulated drawing does not stay open forever. */
export const DEFAULT_VALIDITY_DAYS = 14;

// The server issues the token and owns the link's lifecycle; nothing here is
// cached, because a link only this browser knows about is not a link.

/** The public URL for a token, absolute so it can be pasted into an email. */
export function shareUrlFor(token) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/pms/approve/${token}`;
}

/**
 * Why a link cannot be opened, or null when it is good to use.
 * Callers render this verbatim, so each reason is written for the client.
 */
export function shareBlockReason(share, now = Date.now()) {
  if (!share) return 'not-found';
  if (share.status === 'Revoked') return 'revoked';
  if (share.decision) return 'decided';
  if (share.expiresAt && new Date(share.expiresAt).getTime() < now) return 'expired';
  return null;
}


export const useProofShareStore = create((set, get) => ({
  shares: [],

  /** Every link issued against one document (`GET /pms/documents/{id}/shares/`). */
  loadShares: async (documentId) => {
    const rows = await pullDocumentShares(documentId);
    if (!rows) return [];
    set((st) => ({
      shares: [
        ...rows,
        ...st.shares.filter((s) => !rows.some((r) => r.token === s.token)),
      ],
    }));
    return rows;
  },

  clear: () => set({ shares: [] }),

  /**
   * Issue a link for one document version. Re-issuing for the same document
   * revokes the previous live link, so only one circulation is ever open.
   */
  createShare: async ({
    projectId,
    stageId,
    documentId,
    documentVersion,
    fileName,
    fileKey = null,
    mimeType = null,
    recipientName = '',
    recipientEmail = '',
    createdBy = '',
    validityDays = DEFAULT_VALIDITY_DAYS,
    message = '',
  }) => {
    // `POST /pms/projects/{id}/documents/{docId}/share/` mints the token, sets
    // the expiry and supersedes any link still open on the same document — all
    // of which has to be the server's, because the recipient is outside the app.
    const share = await createDocumentShare(projectId, documentId, {
      stageId,
      documentVersion,
      fileName,
      fileKey,
      mimeType,
      recipientName,
      recipientEmail,
      createdBy,
      // Server field is `expiryDays` (ShareProofSerializer) — `validityDays`
      // would be silently ignored and every link would default to 14 days.
      expiryDays: Number(validityDays) || DEFAULT_VALIDITY_DAYS,
      message,
    });
    if (!share) return null;

    set((st) => ({
      shares: [
        share,
        ...st.shares.map((s) =>
          s.documentId === documentId && s.status === 'Active' && !s.decision
            ? { ...s, status: 'Revoked', revokedReason: 'Superseded by a newer link' }
            : s
        ),
      ],
    }));

    return share;
  },

  revokeShare: (token, reason = 'Revoked by the project manager') => {
    set((st) => ({
      shares: st.shares.map((s) =>
        s.token !== token ? s : { ...s, status: 'Revoked', revokedAt: new Date().toISOString(), revokedReason: reason }
      ),
    }));
    // The link has to stop working for the recipient, not just in this tab.
    revokeDocumentShare(token, reason).catch((err) => {
      console.warn('[PMS] share not revoked:', err?.message || err);
    });
  },

  /** Stamp the first time the client opened the link — shown on the PM's side. */
  markOpened: (token) =>
    set((st) => {
      const share = st.shares.find((s) => s.token === token);
      if (!share || share.openedAt) return st;
      // The server stamps this when the recipient opens the public page.
      return {
        shares: st.shares.map((s) =>
          s.token !== token ? s : { ...s, openedAt: new Date().toISOString() }
        ),
      };
    }),

  /** Close the link out once the client has decided. */
  recordDecision: (token, { decision, decidedBy, comments = '', revisionReason = '' }) =>
    set((st) => {
      const shares = st.shares.map((s) =>
        s.token !== token
          ? s
          : {
              ...s,
              status: 'Used',
              decision,
              decidedAt: new Date().toISOString(),
              decidedBy,
              decisionComments: comments,
              revisionReason,
            }
      );
      // The decision itself is recorded by the public approval endpoint; this
      // only reflects it for the project manager watching the link.
      return { shares };
    }),

  getShare: (token) => get().shares.find((s) => s.token === token) ?? null,

  /** Live link for a document, if one is open. */
  getActiveShareFor: (documentId) =>
    get().shares.find((s) => s.documentId === documentId && s.status === 'Active' && !s.decision) ?? null,

  /** Every link ever issued for a document, newest first. */
  getSharesFor: (documentId) =>
    get().shares.filter((s) => s.documentId === documentId),
}));

export default useProofShareStore;
