import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import { writeThrough, pullTracked } from "../services/hrmsSync";
import { useCalendarStore } from "./calendarStore";

const STORAGE_KEY = "hrms_trainings_v2";
const TRAINERS_KEY = "hrms_trainers_v2";

export const TRAINING_FUNNEL_STAGES = [
  {
    key: "Requested",
    label: "Requested",
    badgeClass: "bg-[#334155] text-white border-[#1e293b]",
    subtitle: "Need identified, trainer not fixed.",
    dotClass: "bg-slate-600",
  },
  {
    key: "Trainer Assigned",
    label: "Trainer Assigned",
    badgeClass: "bg-[#06b6d4] text-white border-[#0891b2]",
    subtitle: "Internal or external trainer confirmed.",
    dotClass: "bg-cyan-500",
  },
  {
    key: "Scheduled",
    label: "Scheduled",
    badgeClass: "bg-[#1d4ed8] text-white border-[#1e40af]",
    subtitle: "Dates locked and communicated.",
    dotClass: "bg-blue-600",
  },
  {
    key: "Ongoing",
    label: "Ongoing",
    badgeClass: "bg-[#f59e0b] text-white border-[#d97706]",
    subtitle: "Training in progress.",
    dotClass: "bg-amber-500",
  },
  {
    key: "Completed",
    label: "Completed",
    badgeClass: "bg-[#22c55e] text-white border-[#16a34a]",
    subtitle: "Delivered, awaiting evaluation.",
    dotClass: "bg-green-500",
  },
  {
    key: "Evaluated",
    label: "Evaluated",
    badgeClass: "bg-[#84cc16] text-white border-[#65a30d]",
    subtitle: "Performance rated and closed.",
    dotClass: "bg-lime-500",
  },
  {
    key: "Cancelled",
    label: "Cancelled",
    badgeClass: "bg-[#f43f5e] text-white border-[#e11d48]",
    subtitle: "Dropped or terminated.",
    dotClass: "bg-rose-500",
  },
];



const useTrainingStoreBase = create((set, get) => ({
  /** Load this module's collections from the API. */
  hydrate: async () => {
    const rows = await Promise.all([
      pullTracked("trainings"),
      pullTracked("trainers"),
    ]);
    set((s) => ({
      trainings: rows[0] || s.trainings,
      trainers: rows[1] || s.trainers,
    }));
    return rows;
  },

  /** Empty on sign-out so the next user sees nothing of the previous one. */
  clear: () => set({ trainings: [], trainers: [] }),

  trainings: [],
  trainers: [],

  addTraining: (item) => {
    const newId = `TRN-${Date.now().toString().slice(-4)}`;
    const created = {
      id: newId,
      stage: item.stage || "Requested",
      status: item.stage || "Requested",
      cost: Number(item.cost) || 0,
      participants: Number(item.participants) || 1,
      start: item.start || "18 Oct 2024",
      end: item.end || item.start || "19 Oct 2024",
      department: item.department || "General",
      type: item.type || "Technical",
      trainer: item.trainer || "Unassigned",
      avatar: item.avatar || (item.trainer && item.trainer !== "Unassigned" ? "https://i.pravatar.cc/100?img=11" : null),
      ...item,
    };

    set((state) => {
      const updated = [created, ...state.trainings];
      try {
        writeThrough("trainings", updated);
      } catch {}
      return { trainings: updated };
    });

    // Synchronize to Calendar if scheduled
    if (created.startDate) {
      try {
        useCalendarStore.getState().addEvent({
          id: `EV-TRN-${created.id}`,
          title: `Training: ${created.title}`,
          date: created.startDate,
          startDate: created.startDate,
          endDate: created.endDate || created.startDate,
          type: "Training",
          category: "Training Program",
          time: created.time || "10:00 AM - 01:00 PM",
          location: created.mode === "Online" ? "Zoom Webinar" : "Training Room 2",
          dept: created.department || "All Staff",
          organizer: created.trainer || "L&D Lead",
          description: `${created.type} workshop. Enrolled: ${created.participants || 12} participants.`,
        });
      } catch (err) {
        console.error("Calendar sync error:", err);
      }
    }

    return created;
  },

  updateTraining: (id, updates) => {
    set((state) => {
      const updated = state.trainings.map((t) => {
        if (t.id === id) {
          const next = { ...t, ...updates };
          if (updates.stage) next.status = updates.stage;
          if (updates.status && !updates.stage) next.stage = updates.status;

          // If stage changed to Scheduled or has startDate, sync calendar
          if (next.startDate && (next.stage === "Scheduled" || next.stage === "Ongoing")) {
            try {
              useCalendarStore.getState().addEvent({
                id: `EV-TRN-${next.id}`,
                title: `Training: ${next.title}`,
                date: next.startDate,
                startDate: next.startDate,
                endDate: next.endDate || next.startDate,
                type: "Training",
                category: "Training Program",
                time: next.time || "10:00 AM - 01:00 PM",
                location: next.mode === "Online" ? "Zoom Webinar" : "Training Room 2",
                dept: next.department || "All Staff",
                organizer: next.trainer || "L&D Lead",
                description: `${next.type} workshop. Enrolled: ${next.participants || 12} participants.`,
              });
            } catch {}
          }

          return next;
        }
        return t;
      });
      try {
        writeThrough("trainings", updated);
      } catch {}
      return { trainings: updated };
    });
  },

  moveTrainingStage: (id, newStage) => {
    set((state) => {
      const updated = state.trainings.map((t) => {
        if (t.id === id) {
          return { ...t, stage: newStage, status: newStage };
        }
        return t;
      });
      try {
        writeThrough("trainings", updated);
      } catch {}
      return { trainings: updated };
    });
  },

  deleteTraining: (id) => {
    set((state) => {
      const updated = state.trainings.filter((t) => t.id !== id);
      try {
        writeThrough("trainings", updated);
      } catch {}
      return { trainings: updated };
    });
  },

  addTrainer: (trainer) => {
    const id = `TRNR-${Date.now().toString().slice(-3)}`;
    const newTrainer = {
      id,
      avatar: `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 40) + 5}`,
      programs: 0,
      status: "Active",
      ...trainer,
    };
    set((state) => {
      const updated = [newTrainer, ...state.trainers];
      try {
        writeThrough("trainers", updated);
      } catch {}
      return { trainers: updated };
    });
    return newTrainer;
  },

  updateTrainer: (id, updates) => {
    set((state) => {
      const updated = state.trainers.map((tr) => (tr.id === id ? { ...tr, ...updates } : tr));
      try {
        writeThrough("trainers", updated);
      } catch {}
      return { trainers: updated };
    });
  },

  deleteTrainer: (id) => {
    set((state) => {
      const updated = state.trainers.filter((tr) => tr.id !== id);
      try {
        writeThrough("trainers", updated);
      } catch {}
      return { trainers: updated };
    });
  },

  resetToDefaults: () => {
    try {
      
      
    } catch {}
    set({ trainings: [], trainers: [] });
  },
}));

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const useTrainingStore = lazyStore(useTrainingStoreBase, "training");
