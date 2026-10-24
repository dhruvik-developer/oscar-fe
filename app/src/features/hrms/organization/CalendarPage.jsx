import { useState, useMemo, useEffect, useRef } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  Search,
  Download,
  Filter,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useCalendarStore } from "../../../stores/calendarStore";
import { EVENT_CATEGORIES, DEPARTMENTS, MONTH_NAMES } from "./calendarConfig";
import {
  formatDateKey,
  parseDateKey,
  generateMonthGrid,
  generateWeekDays,
  getQuarterInfo,
  exportEventsToICS,
  isEventOnDate,
} from "./calendarUtils";

import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarListView } from "./CalendarListView";
import { CalendarAgendaSidebar } from "./CalendarAgendaSidebar";
import { AddEditEventModal } from "./AddEditEventModal";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

export function CalendarPage() {
  const showToast = useAppStore((s) => s.showToast);

  // Store state
  const { events, addEvent, updateEvent, deleteEvent, resetToDefaults } = useCalendarStore();

  // Active view: 'Month' | 'Week' | 'Schedule List'
  const [view, setView] = useState("Month");

  // Navigation state - dynamically defaults to current year, month, and today's date
  const [activeYear, setActiveYear] = useState(() => new Date().getFullYear());
  const [activeMonth, setActiveMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  });

  // Dynamic year options covering current context and neighboring years
  const yearOptions = useMemo(() => {
    const cy = new Date().getFullYear();
    const startYear = Math.min(2023, cy - 3);
    const endYear = Math.max(2028, cy + 4);
    const list = [];
    for (let y = startYear; y <= endYear; y++) {
      list.push(y);
    }
    return list;
  }, []);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [modalDefaultDate, setModalDefaultDate] = useState("");
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const deptRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (deptRef.current && !deptRef.current.contains(e.target)) {
        setDeptDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Navigation handlers
  const handlePrev = () => {
    if (view === "Week") {
      const d = parseDateKey(selectedDate);
      d.setDate(d.getDate() - 7);
      const newDateStr = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
      setSelectedDate(newDateStr);
      setActiveYear(d.getFullYear());
      setActiveMonth(d.getMonth());
    } else {
      let nextMonth = activeMonth - 1;
      let nextYear = activeYear;
      if (nextMonth < 0) {
        nextMonth = 11;
        nextYear = activeYear - 1;
      }
      setActiveMonth(nextMonth);
      setActiveYear(nextYear);

      const now = new Date();
      if (nextYear === now.getFullYear() && nextMonth === now.getMonth()) {
        setSelectedDate(formatDateKey(now.getFullYear(), now.getMonth(), now.getDate()));
      } else {
        const [, , d] = selectedDate.split("-").map(Number);
        const daysInMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
        const clampedDay = Math.min(d || 1, daysInMonth);
        setSelectedDate(formatDateKey(nextYear, nextMonth, clampedDay));
      }
    }
  };

  const handleNext = () => {
    if (view === "Week") {
      const d = parseDateKey(selectedDate);
      d.setDate(d.getDate() + 7);
      const newDateStr = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
      setSelectedDate(newDateStr);
      setActiveYear(d.getFullYear());
      setActiveMonth(d.getMonth());
    } else {
      let nextMonth = activeMonth + 1;
      let nextYear = activeYear;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear = activeYear + 1;
      }
      setActiveMonth(nextMonth);
      setActiveYear(nextYear);

      const now = new Date();
      if (nextYear === now.getFullYear() && nextMonth === now.getMonth()) {
        setSelectedDate(formatDateKey(now.getFullYear(), now.getMonth(), now.getDate()));
      } else {
        const [, , d] = selectedDate.split("-").map(Number);
        const daysInMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
        const clampedDay = Math.min(d || 1, daysInMonth);
        setSelectedDate(formatDateKey(nextYear, nextMonth, clampedDay));
      }
    }
  };

  const handleMonthChange = (newMonth) => {
    setActiveMonth(newMonth);
    const now = new Date();
    if (activeYear === now.getFullYear() && newMonth === now.getMonth()) {
      setSelectedDate(formatDateKey(now.getFullYear(), now.getMonth(), now.getDate()));
    } else {
      const [, , d] = selectedDate.split("-").map(Number);
      const daysInNewMonth = new Date(activeYear, newMonth + 1, 0).getDate();
      const clampedDay = Math.min(d || 1, daysInNewMonth);
      setSelectedDate(formatDateKey(activeYear, newMonth, clampedDay));
    }
  };

  const handleYearChange = (newYear) => {
    setActiveYear(newYear);
    const now = new Date();
    if (newYear === now.getFullYear() && activeMonth === now.getMonth()) {
      setSelectedDate(formatDateKey(now.getFullYear(), now.getMonth(), now.getDate()));
    } else {
      const [, , d] = selectedDate.split("-").map(Number);
      const daysInNewMonth = new Date(newYear, activeMonth + 1, 0).getDate();
      const clampedDay = Math.min(d || 1, daysInNewMonth);
      setSelectedDate(formatDateKey(newYear, activeMonth, clampedDay));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setActiveYear(today.getFullYear());
    setActiveMonth(today.getMonth());
    const todayStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    setSelectedDate(todayStr);
    showToast("Jumped to Today");
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Category filter
      if (categoryFilter !== "All" && ev.type !== categoryFilter) {
        return false;
      }
      // Department filter
      if (deptFilter !== "All" && ev.dept !== deptFilter && ev.dept !== "All Staff") {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (ev.title || "").toLowerCase().includes(q);
        const matchesDesc = (ev.description || "").toLowerCase().includes(q);
        const matchesLoc = (ev.location || "").toLowerCase().includes(q);
        const matchesOrg = (ev.organizer || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesLoc && !matchesOrg) {
          return false;
        }
      }
      return true;
    });
  }, [events, categoryFilter, deptFilter, searchQuery]);

  // Month grid cells
  const monthCells = useMemo(() => {
    return generateMonthGrid(activeYear, activeMonth);
  }, [activeYear, activeMonth]);

  // Week days
  const weekDays = useMemo(() => {
    return generateWeekDays(selectedDate);
  }, [selectedDate]);

  // Selected date agenda items
  const selectedDateEvents = useMemo(() => {
    return filteredEvents.filter((e) => isEventOnDate(e, selectedDate));
  }, [filteredEvents, selectedDate]);

  // Upcoming holidays
  const upcomingHolidays = useMemo(() => {
    return events
      .filter((ev) => ev.type === "Holiday" && (ev.startDate || ev.date) >= selectedDate)
      .sort((a, b) => (a.startDate || a.date).localeCompare(b.startDate || b.date))
      .slice(0, 4);
  }, [events, selectedDate]);

  // Upcoming fun & culture events
  const upcomingFunEvents = useMemo(() => {
    return events
      .filter((ev) => ev.type === "Fun" && (ev.startDate || ev.date) >= selectedDate)
      .sort((a, b) => (a.startDate || a.date).localeCompare(b.startDate || b.date))
      .slice(0, 3);
  }, [events, selectedDate]);

  // CRUD actions
  const handleOpenCreateModal = (dateStr = "") => {
    setEditingEvent(null);
    setModalDefaultDate(dateStr || selectedDate);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event) => {
    setEditingEvent(event);
    setModalDefaultDate(event.startDate || event.date || selectedDate);
    setIsModalOpen(true);
  };

  const handleSaveEvent = (eventData, id) => {
    if (id) {
      updateEvent(id, eventData);
      showToast(`Updated "${eventData.title}"`);
    } else {
      const created = addEvent(eventData);
      showToast(`Scheduled "${created.title}"`);
    }
    setIsModalOpen(false);
  };

  const handleDeleteEvent = (id) => {
    const target = events.find((e) => e.id === id);
    deleteEvent(id);
    setIsModalOpen(false);
    showToast(target ? `Deleted "${target.title}"` : "Event deleted");
  };

  const handleExport = () => {
    exportEventsToICS(filteredEvents, `HRMS-Calendar-${MONTH_NAMES[activeMonth]}-${activeYear}`);
    showToast("Calendar (.ics) downloaded successfully");
  };

  const handleResetDefaults = () => {
    if (confirm("Reset calendar to default company events and holidays?")) {
      resetToDefaults();
      showToast("Calendar reset to defaults");
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      <PageHeader
        title="Personal & Team Calendar"
        subtitle="Track leaves, company public holidays, scheduled training sessions, and key milestones."
        guide={hrmsGuides.calendar}
        actions={
          <>
            {/* View Switcher */}
            <div className="flex p-1 bg-white border border-bdr rounded-xl shadow-xs">
              {["Month", "Week", "Schedule List"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition cursor-pointer ${
                    view === v ? "bg-navy text-white shadow-xs" : "text-muted hover:text-slate-900"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Export to ICS button */}
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-bdr text-slate-700 rounded-xl text-[13px] font-medium hover:bg-off transition shadow-xs cursor-pointer"
              title="Export calendar to iCal (.ics) for Google/Outlook Calendar"
            >
              <Download size={15} />
              Export (.ics)
            </button>

            {/* Add Event Button */}
            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center gap-2 px-5 py-2 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs cursor-pointer"
            >
              <Plus size={16} />
              Add Event
            </button>
          </>
        }
      />

      {/* Toolbar: Filters & Quick Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-bdr rounded-2xl shadow-xs">
        {/* Left: Department Filter, Category Tabs */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Department Dropdown */}
          <div className="relative" ref={deptRef}>
            <button
              type="button"
              onClick={() => setDeptDropdownOpen((o) => !o)}
              className="h-9 px-3 rounded-xl border border-bdr bg-white hover:bg-off text-[13px] font-medium text-slate-700 flex items-center gap-2 transition"
            >
              <Filter size={13} className="text-muted" />
              <span>Dept: {deptFilter}</span>
              <ChevronDown size={14} className="text-muted ml-0.5" />
            </button>

            {deptDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-52 bg-white border border-bdr rounded-xl shadow-lg z-30 p-1">
                <div
                  onClick={() => {
                    setDeptFilter("All");
                    setDeptDropdownOpen(false);
                  }}
                  className={`px-3 py-1.5 text-[12.5px] rounded-lg cursor-pointer flex items-center justify-between ${
                    deptFilter === "All" ? "bg-navy/10 text-navy font-semibold" : "hover:bg-off text-slate-700"
                  }`}
                >
                  <span>All Departments</span>
                  {deptFilter === "All" && <Check size={14} />}
                </div>
                <div className="h-px bg-bdr my-1" />
                {DEPARTMENTS.map((dept) => (
                  <div
                    key={dept}
                    onClick={() => {
                      setDeptFilter(dept);
                      setDeptDropdownOpen(false);
                    }}
                    className={`px-3 py-1.5 text-[12.5px] rounded-lg cursor-pointer flex items-center justify-between ${
                      deptFilter === dept ? "bg-navy/10 text-navy font-semibold" : "hover:bg-off text-slate-700"
                    }`}
                  >
                    <span>{dept}</span>
                    {deptFilter === dept && <Check size={14} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Category Chips */}
          <div className="hidden sm:flex items-center gap-1 p-0.5 bg-off border border-bdr rounded-xl">
            <button
              type="button"
              onClick={() => setCategoryFilter("All")}
              className={`px-3 py-1 rounded-lg text-[12px] font-medium transition ${
                categoryFilter === "All" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-muted hover:text-slate-800"
              }`}
            >
              All Types
            </button>
            {Object.keys(EVENT_CATEGORIES).map((key) => {
              const cat = EVENT_CATEGORIES[key];
              const isActive = categoryFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategoryFilter(isActive ? "All" : key)}
                  className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition flex items-center gap-1.5 ${
                    isActive
                      ? "bg-white text-slate-900 shadow-2xs font-semibold"
                      : "text-muted hover:text-slate-800"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${cat.dotClass}`} />
                  <span>{cat.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Search Box & Reset */}
        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search meetings, holidays..."
              className="w-full h-9 pl-9 pr-3 text-[12.5px] rounded-xl border border-bdr bg-off/50 focus:bg-white focus:outline-none focus:border-navy transition"
            />
          </div>

          {(categoryFilter !== "All" || deptFilter !== "All" || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("All");
                setDeptFilter("All");
                setSearchQuery("");
              }}
              title="Reset active filters"
              className="h-9 px-2.5 rounded-xl border border-bdr text-muted hover:text-slate-800 hover:bg-off text-[12px] flex items-center gap-1 transition"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Grid + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Main Calendar Canvas */}
        <div className="lg:col-span-8 bg-white border border-bdr rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            {/* Calendar Controls & Month/Year Title */}
            <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-bdr gap-3">
              <div className="flex items-center gap-3">
                {/* Month & Year Selection */}
                <div className="flex items-center gap-2">
                  <select
                    value={activeMonth}
                    onChange={(e) => handleMonthChange(Number(e.target.value))}
                    className="font-bold text-[18px] text-slate-900 bg-transparent hover:bg-off rounded-lg px-2 py-0.5 border border-transparent hover:border-bdr focus:outline-none focus:border-navy cursor-pointer transition"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={activeYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    className="font-bold text-[18px] text-slate-900 bg-transparent hover:bg-off rounded-lg px-2 py-0.5 border border-transparent hover:border-bdr focus:outline-none focus:border-navy cursor-pointer transition"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="px-2.5 py-0.5 bg-off border border-bdr rounded-full text-[11.5px] text-muted font-medium">
                  {getQuarterInfo(activeMonth, activeYear)}
                </span>
              </div>

              {/* Prev / Today / Next Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="w-8 h-8 rounded-lg border border-bdr text-slate-700 hover:bg-off grid place-items-center transition cursor-pointer shadow-2xs"
                  title="Previous"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  className="h-8 px-3 rounded-lg border border-bdr text-[12px] font-medium hover:bg-off text-slate-700 transition cursor-pointer shadow-2xs"
                  title="Jump to Today"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-8 h-8 rounded-lg border border-bdr text-slate-700 hover:bg-off grid place-items-center transition cursor-pointer shadow-2xs"
                  title="Next"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {/* Active View Canvas */}
            {view === "Month" && (
              <CalendarMonthView
                cells={monthCells}
                events={filteredEvents}
                selectedDate={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
                onEventClick={handleOpenEditModal}
                onQuickAddDate={handleOpenCreateModal}
              />
            )}

            {view === "Week" && (
              <CalendarWeekView
                weekDays={weekDays}
                events={filteredEvents}
                selectedDate={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
                onEventClick={handleOpenEditModal}
                onQuickAddDate={handleOpenCreateModal}
              />
            )}

            {view === "Schedule List" && (
              <CalendarListView
                events={filteredEvents}
                onEventClick={handleOpenEditModal}
                onDeleteEvent={handleDeleteEvent}
                onAddNewEvent={() => handleOpenCreateModal()}
              />
            )}
          </div>

          {/* Comprehensive Legend at Bottom */}
          <div className="pt-4 mt-6 border-t border-bdr flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted">
            <div className="flex flex-wrap items-center gap-4">
              {Object.keys(EVENT_CATEGORIES).map((key) => {
                const cat = EVENT_CATEGORIES[key];
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${cat.dotClass}`} />
                    <span className="text-slate-700 font-medium">{cat.label}</span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-[11px] text-muted hover:text-slate-800 underline decoration-dotted transition"
            >
              Reset Seed Data
            </button>
          </div>
        </div>

        {/* Right 4 Cols: Dynamic Agenda & Upcoming Cards */}
        <div className="lg:col-span-4">
          <CalendarAgendaSidebar
            selectedDate={selectedDate}
            events={selectedDateEvents}
            upcomingHolidays={upcomingHolidays}
            upcomingFunEvents={upcomingFunEvents}
            onEventClick={handleOpenEditModal}
            onAddEventForDate={handleOpenCreateModal}
          />
        </div>
      </div>

      {/* Add / Edit Event Modal */}
      <AddEditEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialEvent={editingEvent}
        defaultDate={modalDefaultDate}
      />
    </div>
  );
}

export const Calendar = CalendarPage;
export default CalendarPage;
