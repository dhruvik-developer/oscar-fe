import { create } from "zustand";
import { lazyStore } from "../services/lazyModules";
import { writeThrough, pullTracked } from "../services/hrmsSync";

const STORAGE_KEY = "hrms_calendar_events_v2";


const useCalendarStoreBase = create((set, get) => ({
  /** Load this module's collections from the API. */
  hydrate: async () => {
    const rows = await Promise.all([
      pullTracked("calendarEvents"),
    ]);
    set((s) => ({
      events: rows[0] || s.events,
    }));
    return rows;
  },

  /** Empty on sign-out so the next user sees nothing of the previous one. */
  clear: () => set({ events: [] }),

  events: [],

  addEvent: (eventData) => {
    const id = `EV-${Date.now()}`;
    const newEvent = {
      id,
      startDate: eventData.startDate || eventData.date,
      endDate: eventData.endDate || eventData.startDate || eventData.date,
      date: eventData.startDate || eventData.date,
      ...eventData,
    };

    set((state) => {
      const updated = [newEvent, ...state.events];
      try {
        writeThrough("calendarEvents", updated);
      } catch (err) {
        console.error("Storage error:", err);
      }
      return { events: updated };
    });

    return newEvent;
  },

  updateEvent: (id, updatedFields) => {
    set((state) => {
      const updated = state.events.map((ev) => {
        if (ev.id === id) {
          const startDate = updatedFields.startDate || updatedFields.date || ev.startDate || ev.date;
          const endDate = updatedFields.endDate || updatedFields.startDate || updatedFields.date || ev.endDate || ev.date;
          return {
            ...ev,
            ...updatedFields,
            startDate,
            endDate,
            date: startDate,
          };
        }
        return ev;
      });

      try {
        writeThrough("calendarEvents", updated);
      } catch (err) {
        console.error("Storage error:", err);
      }

      return { events: updated };
    });
  },

  deleteEvent: (id) => {
    set((state) => {
      const updated = state.events.filter((ev) => ev.id !== id);
      try {
        writeThrough("calendarEvents", updated);
      } catch (err) {
        console.error("Storage error:", err);
      }
      return { events: updated };
    });
  },

  resetToDefaults: () => {
    try {
      
    } catch {}
    set({ events: [] });
  },

  // Helper selectors
  getEventsForDate: (dateStr) => {
    const all = get().events;
    return all.filter((ev) => {
      const start = ev.startDate || ev.date;
      const end = ev.endDate || ev.startDate || ev.date;
      return dateStr >= start && dateStr <= end;
    });
  },

  getUpcomingHolidays: (fromDateStr, limit = 4) => {
    const all = get().events;
    return all
      .filter((ev) => ev.type === "Holiday" && (ev.startDate || ev.date) >= fromDateStr)
      .sort((a, b) => (a.startDate || a.date).localeCompare(b.startDate || b.date))
      .slice(0, limit);
  },

  getUpcomingFunEvents: (fromDateStr, limit = 3) => {
    const all = get().events;
    return all
      .filter((ev) => ev.type === "Fun" && (ev.startDate || ev.date) >= fromDateStr)
      .sort((a, b) => (a.startDate || a.date).localeCompare(b.startDate || b.date))
      .slice(0, limit);
  },
}));

// Hydrated the first time a screen reads it, not at boot — services/lazyModules.
export const useCalendarStore = lazyStore(useCalendarStoreBase, "calendar");
