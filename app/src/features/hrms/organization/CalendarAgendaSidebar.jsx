import { Clock, MapPin, ExternalLink, Edit2, Plus, Calendar, Sparkles, PartyPopper } from "lucide-react";
import { EVENT_CATEGORIES } from "./calendarConfig";
import { formatHumanDate, formatShortDate } from "./calendarUtils";

export function CalendarAgendaSidebar({
  selectedDate,
  events,
  upcomingHolidays,
  upcomingFunEvents,
  onEventClick,
  onAddEventForDate,
}) {
  const selectedDateFormatted = formatHumanDate(selectedDate);
  const shortDateHeader = formatShortDate(selectedDate);

  const getEventBadge = (type) => {
    const cat = EVENT_CATEGORIES[type] || EVENT_CATEGORIES.Meeting;
    return `${cat.badgeClass} border`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Selected Day Agenda Card */}
      <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3.5 border-b border-bdr">
          <div>
            <h3 className="font-bold text-[15px] text-slate-900 leading-tight">
              Agenda for {shortDateHeader}
            </h3>
            <p className="text-[11.5px] text-muted mt-0.5">{selectedDateFormatted}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-off border border-bdr text-[11.5px] text-slate-600 font-mono font-semibold">
              {events.length} {events.length === 1 ? "item" : "items"}
            </span>
            {onAddEventForDate && (
              <button
                type="button"
                onClick={() => onAddEventForDate(selectedDate)}
                className="w-7 h-7 rounded-lg bg-navy/10 text-navy hover:bg-navy hover:text-white grid place-items-center transition"
                title="Add event for this date"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Events list */}
        <div className="flex flex-col gap-3 mt-4 max-h-[380px] overflow-y-auto pr-0.5">
          {events.map((ev) => {
            const cat = EVENT_CATEGORIES[ev.type] || EVENT_CATEGORIES.Meeting;
            return (
              <div
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="p-3.5 bg-off/70 border border-bdr rounded-xl flex flex-col gap-2 hover:border-slate-300 hover:bg-off transition cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-[13.5px] text-slate-900 group-hover:text-navy transition">
                    {ev.title}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-medium shrink-0 ${getEventBadge(ev.type)}`}>
                    {cat.shortLabel}
                  </span>
                </div>

                {ev.description && (
                  <p className="text-[12px] text-slate-600 line-clamp-2 leading-relaxed">
                    {ev.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2.5 text-[11.5px] text-slate-500 pt-0.5">
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-slate-400" />
                    <span>{ev.time || "All Day"}</span>
                  </div>
                  {ev.location && (
                    <div className="flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400" />
                      <span className="truncate max-w-[140px]">{ev.location}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 mt-1 border-t border-bdr/60">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {ev.dept || "All Staff"}
                  </span>
                  <div className="flex items-center gap-2">
                    {ev.virtualLink && (
                      <a
                        href={ev.virtualLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-medium"
                      >
                        <ExternalLink size={11} />
                        Join
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      className="text-[11px] text-slate-500 hover:text-navy font-medium flex items-center gap-0.5"
                    >
                      <Edit2 size={11} />
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {events.length === 0 && (
            <div className="py-9 px-4 text-center text-muted flex flex-col items-center justify-center">
              <Calendar size={28} className="text-slate-300 mb-2" />
              <p className="text-[13px] font-medium text-slate-700">No scheduled events</p>
              <p className="text-[11.5px] text-slate-400 mt-0.5">
                No meetings, leaves, or company activities on this date.
              </p>
              {onAddEventForDate && (
                <button
                  type="button"
                  onClick={() => onAddEventForDate(selectedDate)}
                  className="mt-3.5 px-3.5 py-1.5 bg-off border border-bdr hover:border-navy hover:text-navy rounded-xl text-[12px] font-medium transition"
                >
                  + Add Event
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Public Holidays Card */}
      <div className="bg-[#f8fafc] border border-bdr rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <h4 className="font-bold text-[13.5px] text-slate-900">Upcoming Public Holidays</h4>
          </div>
          <span className="text-[11px] text-muted font-medium">Regional &amp; National</span>
        </div>

        <div className="space-y-2 text-[12.5px]">
          {upcomingHolidays.map((h) => {
            const dateFmt = formatShortDate(h.startDate || h.date);
            return (
              <div
                key={h.id}
                onClick={() => onEventClick(h)}
                className="p-3 bg-white border border-bdr rounded-xl flex justify-between items-center hover:border-purple-200 transition cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-slate-800 leading-tight">{h.title}</div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {dateFmt} • {h.location || "Office Closed"}
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[11px] font-semibold shrink-0">
                  Holiday
                </span>
              </div>
            );
          })}

          {upcomingHolidays.length === 0 && (
            <div className="py-4 text-center text-muted text-[12px]">
              No upcoming public holidays in this period.
            </div>
          )}
        </div>
      </div>

      {/* Fun & Team Celebrations Card */}
      <div className="bg-[#fdf8f6] border border-orange-100 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PartyPopper size={15} className="text-pink-500" />
            <h4 className="font-bold text-[13.5px] text-slate-900">Fun &amp; Celebrations</h4>
          </div>
          <span className="text-[11px] text-pink-700 font-medium">Culture Hub</span>
        </div>

        <div className="space-y-2 text-[12.5px]">
          {upcomingFunEvents.map((f) => {
            const dateFmt = formatShortDate(f.startDate || f.date);
            return (
              <div
                key={f.id}
                onClick={() => onEventClick(f)}
                className="p-3 bg-white border border-pink-100 rounded-xl flex justify-between items-center hover:border-pink-300 transition cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-slate-800 leading-tight">{f.title}</div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {dateFmt} • {f.location || "Office Lounge"}
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-pink-50 text-pink-700 border border-pink-200 rounded text-[11px] font-semibold shrink-0">
                  Fun
                </span>
              </div>
            );
          })}

          {upcomingFunEvents.length === 0 && (
            <div className="py-4 text-center text-muted text-[12px]">
              No upcoming fun events scheduled yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
