import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import { writeThrough, pullTracked, hrmsSync, isBackendEnabled, isServerId } from "../services/hrmsSync";
import { api } from "../services/api";



/**
 * Every action hands the whole recruitment state here after changing part of
 * it. Each collection is written through to its own endpoint; `writeThrough`
 * works out which rows are new, changed or gone, so a change to jobs does not
 * touch candidates.
 */
function persist(state) {
  writeThrough("jobs", state.jobs);
  writeThrough("candidates", state.candidates);
  writeThrough("interviews", state.interviews);
  writeThrough("offers", state.offers);
  writeThrough("recruitmentQuestions", state.questions);
}

const useRecruitmentStoreBase = create((set, get) => ({
  jobs: [],
  candidates: [],
  interviews: [],
  offers: [],
  questions: [],
  onboardedMap: {},
  verifiedDocsMap: {},

  toast: null,
  showToast: (msg) => set({ toast: { msg, id: Date.now().toString() } }),
  clear: () => set({ toast: null }),

  /** Load the recruitment pipeline from the API. */
  hydrate: async () => {
    const rows = await Promise.all([
      pullTracked("jobs"),
      pullTracked("candidates"),
      pullTracked("interviews"),
      pullTracked("offers"),
      pullTracked("recruitmentQuestions"),
      pullTracked("onboarding"),
    ]);
    // Rebuild the checklist ticks from the server: a candidate linked to an
    // employee is onboarded; a completed document task means verified docs.
    const tasks = rows[5] || [];
    const verified = {};
    tasks.forEach((t) => {
      if (t?.candidateId && t.completedAt && /document|verif|kyc/i.test(String(t.title || ""))) {
        verified[String(t.candidateId)] = true;
      }
    });
    const onboarded = {};
    (rows[1] || []).forEach((c) => {
      if (c?.employee) onboarded[String(c.id)] = true;
    });
    set((s) => ({
      jobs: rows[0] || s.jobs,
      candidates: rows[1] || s.candidates,
      interviews: rows[2] || s.interviews,
      offers: rows[3] || s.offers,
      questions: rows[4] || s.questions,
      onboardedMap: { ...onboarded, ...s.onboardedMap },
      verifiedDocsMap: { ...verified, ...s.verifiedDocsMap },
    }));
    return rows;
  },

  /** Empty on sign-out so the next user sees nothing of the previous one. */
  clearData: () => set({
    jobs: [], candidates: [], interviews: [], offers: [], questions: [],
    onboardedMap: {}, verifiedDocsMap: {},
  }),

  // ─── JOBS ──────────────────────────────────────────
  addJob: (j) =>
    set((st) => {
      const ns = [j, ...st.jobs];
      persist({ ...st, jobs: ns });
      return { jobs: ns };
    }),

  updateJob: (id, p) =>
    set((st) => {
      const ns = st.jobs.map((j) => (j.id === id ? { ...j, ...p } : j));
      persist({ ...st, jobs: ns });
      return { jobs: ns };
    }),

  deleteJob: (id) =>
    set((st) => {
      const ns = st.jobs.filter((j) => j.id !== id);
      persist({ ...st, jobs: ns });
      return { jobs: ns };
    }),

  // ─── CANDIDATES ────────────────────────────────────
  addCandidate: (c) =>
    set((st) => {
      // If no explicit jobId is provided, find matching job by title
      const matchedJob = c.jobId
        ? st.jobs.find((j) => j.id === c.jobId)
        : st.jobs.find((j) => j.title?.toLowerCase() === c.position?.toLowerCase());

      const enrichedCand = {
        ...c,
        jobId: matchedJob?.id || c.jobId || "JOB-001",
        position: matchedJob?.title || c.position || "Senior Backend Developer",
      };

      const ns = [enrichedCand, ...st.candidates];
      const updatedJobs = st.jobs.map((j) =>
        j.id === enrichedCand.jobId ? { ...j, applicants: (j.applicants || 0) + 1 } : j
      );

      persist({ ...st, candidates: ns, jobs: updatedJobs });
      return { candidates: ns, jobs: updatedJobs };
    }),

  updateCandidate: (id, p) =>
    set((st) => {
      const ns = st.candidates.map((c) => (c.id === id ? { ...c, ...p } : c));
      persist({ ...st, candidates: ns });
      return { candidates: ns };
    }),

  deleteCandidate: (id) =>
    set((st) => {
      const ns = st.candidates.filter((c) => c.id !== id);
      persist({ ...st, candidates: ns });
      return { candidates: ns };
    }),

  changeStage: (id, stage) =>
    set((st) => {
      const ns = st.candidates.map((c) => (c.id === id ? { ...c, stage } : c));
      persist({ ...st, candidates: ns });
      return { candidates: ns };
    }),

  // ─── INTERVIEWS ────────────────────────────────────
  addInterview: (i) =>
    set((st) => {
      const ns = [i, ...st.interviews];
      // Update candidate's interviewStatus if candidate exists
      const updatedCandidates = st.candidates.map((c) =>
        c.id === i.candidateId ? { ...c, interviewStatus: "Scheduled" } : c
      );
      persist({ ...st, interviews: ns, candidates: updatedCandidates });
      return { interviews: ns, candidates: updatedCandidates };
    }),

  updateInterview: (id, p) =>
    set((st) => {
      const ns = st.interviews.map((i) => (i.id === id ? { ...i, ...p } : i));
      const target = ns.find((i) => i.id === id);

      // If interview is marked completed with score, sync with candidate
      let updatedCandidates = st.candidates;
      if (target && p.score !== undefined) {
        updatedCandidates = st.candidates.map((c) =>
          c.id === target.candidateId
            ? {
                ...c,
                technicalScore: p.score,
                interviewStatus: target.status === "Completed" ? "Completed" : c.interviewStatus,
              }
            : c
        );
      }

      persist({ ...st, interviews: ns, candidates: updatedCandidates });
      return { interviews: ns, candidates: updatedCandidates };
    }),

  // ─── OFFERS ────────────────────────────────────────
  addOffer: (o) =>
    set((st) => {
      const ns = [o, ...st.offers];
      // Automatically advance candidate stage to "Offer"
      const updatedCandidates = st.candidates.map((c) =>
        c.id === o.candidateId ? { ...c, stage: "Offer" } : c
      );
      persist({ ...st, offers: ns, candidates: updatedCandidates });
      return { offers: ns, candidates: updatedCandidates };
    }),

  updateOffer: (id, p) =>
    set((st) => {
      const ns = st.offers.map((o) => (o.id === id ? { ...o, ...p } : o));
      const target = ns.find((o) => o.id === id);

      // If offer is Accepted, promote candidate stage to "Hired"
      let updatedCandidates = st.candidates;
      if (target && p.status === "Accepted") {
        updatedCandidates = st.candidates.map((c) =>
          c.id === target.candidateId ? { ...c, stage: "Hired" } : c
        );
      }

      persist({ ...st, offers: ns, candidates: updatedCandidates });
      return { offers: ns, candidates: updatedCandidates };
    }),

  // ─── QUESTIONS ─────────────────────────────────────
  addQuestion: (q) =>
    set((st) => {
      const ns = [q, ...st.questions];
      persist({ ...st, questions: ns });
      return { questions: ns };
    }),

  updateQuestion: (id, p) =>
    set((st) => {
      const ns = st.questions.map((q) => (q.id === id ? { ...q, ...p } : q));
      persist({ ...st, questions: ns });
      return { questions: ns };
    }),

  deleteQuestion: (id) =>
    set((st) => {
      const ns = st.questions.filter((q) => q.id !== id);
      persist({ ...st, questions: ns });
      return { questions: ns };
    }),

  toggleQuestion: (id) =>
    set((st) => {
      const ns = st.questions.map((q) => (q.id === id ? { ...q, enabled: !q.enabled } : q));
      persist({ ...st, questions: ns });
      return { questions: ns };
    }),

  // ─── ONBOARDING ────────────────────────────────────
  // The tick stays local for instant UI, but the record of it lives in
  // Postgres: completion converts the candidate to an employee
  // (`POST /hrms/onboarding/{id}/complete/`), verification completes an
  // onboarding task row. Both survive refresh and other devices.
  completeOnboarding: async (candidateId) => {
    set((st) => ({ onboardedMap: { ...st.onboardedMap, [candidateId]: true } }));
    if (!isBackendEnabled() || !isServerId(candidateId)) return null;
    try {
      return await api.post(`/hrms/onboarding/${candidateId}/complete/`, {});
    } catch (err) {
      // Already converted on another device — the tick above still stands.
      if (err?.status === 409) return err.payload || { already: true };
      set((st) => {
        const copy = { ...st.onboardedMap };
        delete copy[candidateId];
        return { onboardedMap: copy };
      });
      console.warn("[HRMS] onboarding not saved:", err?.message || err);
      throw err;
    }
  },

  verifyDocuments: async (candidateId) => {
    set((st) => ({ verifiedDocsMap: { ...st.verifiedDocsMap, [candidateId]: true } }));
    if (!isBackendEnabled() || !isServerId(candidateId)) return null;
    try {
      const existing = await hrmsSync.pull("onboarding", { candidateId });
      const open = (existing || []).find(
        (t) => !t.completedAt && /document|verif|kyc/i.test(String(t.title || ""))
      );
      const now = new Date().toISOString();
      if (open && isServerId(open.id)) {
        return await hrmsSync.update("onboarding", open.id, { completedAt: now });
      }
      return await hrmsSync.create("onboarding", {
        candidateId, title: "Documents verified", completedAt: now,
      });
    } catch (err) {
      console.warn("[HRMS] document verification not saved:", err?.message || err);
      return null;
    }
  },
}));

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const useRecruitmentStore = lazyStore(useRecruitmentStoreBase, "recruitment");
