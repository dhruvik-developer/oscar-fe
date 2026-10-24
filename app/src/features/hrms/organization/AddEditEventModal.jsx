import { useState, useEffect } from "react";
import { X, Calendar, Clock, MapPin, Users, Link as LinkIcon, Trash2, Tag, Info } from "lucide-react";
import { EVENT_CATEGORIES, DEPARTMENTS } from "./calendarConfig";

export function AddEditEventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialEvent = null,
  defaultDate = "",
}) {
  const isEditMode = Boolean(initialEvent && initialEvent.id);

  const [formData, setFormData] = useState({
    title: "",
    type: "Meeting",
    startDate: defaultDate || new Date().toISOString().slice(0, 10),
    endDate: defaultDate || new Date().toISOString().slice(0, 10),
    isMultiDay: false,
    allDay: false,
    time: "10:00 AM - 11:00 AM",
    location: "Conference Room 1",
    virtualLink: "",
    dept: "All Staff",
    organizer: "Current User",
    description: "",
  });

  useEffect(() => {
    if (initialEvent) {
      const start = initialEvent.startDate || initialEvent.date || defaultDate;
      const end = initialEvent.endDate || start;
      setFormData({
        title: initialEvent.title || "",
        type: initialEvent.type || "Meeting",
        startDate: start,
        endDate: end,
        isMultiDay: start !== end,
        allDay: initialEvent.time === "All Day" || initialEvent.time === "Full Day" || initialEvent.time === "Public Holiday",
        time: initialEvent.time || "10:00 AM - 11:00 AM",
        location: initialEvent.location || "",
        virtualLink: initialEvent.virtualLink || "",
        dept: initialEvent.dept || "All Staff",
        organizer: initialEvent.organizer || "Current User",
        description: initialEvent.description || "",
      });
    } else {
      const dateToUse = defaultDate || new Date().toISOString().slice(0, 10);
      setFormData({
        title: "",
        type: "Meeting",
        startDate: dateToUse,
        endDate: dateToUse,
        isMultiDay: false,
        allDay: false,
        time: "10:00 AM - 11:00 AM",
        location: "Conference Room 1",
        virtualLink: "",
        dept: "All Staff",
        organizer: "Current User",
        description: "",
      });
    }
  }, [initialEvent, defaultDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const payload = {
      title: formData.title.trim(),
      type: formData.type,
      startDate: formData.startDate,
      endDate: formData.isMultiDay ? (formData.endDate || formData.startDate) : formData.startDate,
      date: formData.startDate,
      time: formData.allDay ? "Full Day" : formData.time,
      location: formData.location.trim() || "Main Office",
      virtualLink: formData.virtualLink.trim(),
      dept: formData.dept,
      organizer: formData.organizer.trim(),
      description: formData.description.trim(),
    };

    onSave(payload, initialEvent?.id);
  };

  const selectedCategoryMeta = EVENT_CATEGORIES[formData.type] || EVENT_CATEGORIES.Meeting;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl border border-bdr shadow-2xl w-full max-w-lg overflow-hidden my-2 sm:my-6">
        {/* Header */}
        <div className="flex justify-between items-center gap-2 lg:gap-0 px-4 sm:px-6 py-4 border-b border-bdr bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${selectedCategoryMeta.dotClass}`} />
            <div>
              <h3 className="font-bold text-[16px] text-slate-900">
                {isEditMode ? "Edit Calendar Entry" : "Add Calendar Entry"}
              </h3>
              <p className="text-[11.5px] text-muted">
                {isEditMode ? "Update event specifications or reschedule" : "Schedule a meeting, leave, holiday or HR activity"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/60 grid place-items-center text-muted hover:text-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 flex flex-col gap-4 max-h-[80vh] sm:max-h-[75vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              Event Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Annual Hackathon / Sprint Review / Vacation"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy transition"
            />
          </div>

          {/* Category & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Tag size={13} className="text-slate-400" />
                Event Category
              </label>
              <select
                value={formData.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  const isOff = newType === "Holiday" || newType === "Leave";
                  setFormData({
                    ...formData,
                    type: newType,
                    allDay: isOff ? true : formData.allDay,
                    location: isOff ? "All Offices / Out of Office" : formData.location,
                  });
                }}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer transition font-medium"
              >
                {Object.keys(EVENT_CATEGORIES).map((catKey) => (
                  <option key={catKey} value={catKey}>
                    {EVENT_CATEGORIES[catKey].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Users size={13} className="text-slate-400" />
                Department / Audience
              </label>
              <select
                value={formData.dept}
                onChange={(e) => setFormData({ ...formData, dept: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer transition font-medium"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Multi-Day toggle */}
          <div className="flex items-center justify-between p-2.5 bg-off/60 rounded-xl border border-bdr/60">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-slate-500" />
              <span className="text-[12.5px] font-medium text-slate-700">Multi-Day Event / Leave Span</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isMultiDay}
                onChange={(e) => setFormData({ ...formData, isMultiDay: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-navy"></div>
            </label>
          </div>

          {/* Dates */}
          <div className={`grid ${formData.isMultiDay ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"} gap-3`}>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                {formData.isMultiDay ? "Start Date" : "Date"}
              </label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setFormData({
                    ...formData,
                    startDate: newStart,
                    endDate: formData.isMultiDay && formData.endDate < newStart ? newStart : formData.endDate,
                  });
                }}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy transition"
              />
            </div>

            {formData.isMultiDay && (
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">End Date</label>
                <input
                  type="date"
                  required
                  min={formData.startDate}
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy transition"
                />
              </div>
            )}
          </div>

          {/* Time & All-Day */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400" />
                Time Schedule
              </label>
              <label className="flex items-center gap-1.5 text-[11.5px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allDay}
                  onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                  className="rounded text-navy focus:ring-navy"
                />
                All Day / Full Day
              </label>
            </div>
            {!formData.allDay ? (
              <input
                type="text"
                placeholder="e.g. 10:00 AM - 11:30 AM"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy transition"
              />
            ) : (
              <div className="px-3.5 py-2 rounded-xl border border-dashed border-bdr text-[12.5px] bg-off text-muted font-medium">
                Marked as an all-day / full-day calendar entry
              </div>
            )}
          </div>

          {/* Location & Virtual Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-400" />
                Location
              </label>
              <input
                type="text"
                placeholder="e.g. Meeting Room 2 / Zoom"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <LinkIcon size={13} className="text-slate-400" />
                Virtual Link (Optional)
              </label>
              <input
                type="url"
                placeholder="https://zoom.us/... or meet.google.com/..."
                value={formData.virtualLink}
                onChange={(e) => setFormData({ ...formData, virtualLink: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy transition"
              />
            </div>
          </div>

          {/* Organizer */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              Host / Organizer / Employee
            </label>
            <input
              type="text"
              placeholder="e.g. David Park or Sarah Mitchell"
              value={formData.organizer}
              onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              Description &amp; Agenda Details
            </label>
            <textarea
              rows={2}
              placeholder="Brief summary, meeting agenda items, or leave coverage notes..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy transition resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-4 mt-2 border-t border-bdr">
            {isEditMode && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete "${formData.title}"?`)) {
                    onDelete(initialEvent.id);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-medium text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
              >
                <Trash2 size={15} />
                Delete
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 transition shadow-xs"
              >
                {isEditMode ? "Update Event" : "Schedule Event"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
