import { Clock, MapPin, Plus, ExternalLink } from "lucide-react";
import { EVENT_CATEGORIES } from "./calendarConfig";
import { isEventOnDate } from "./calendarUtils";

export function CalendarWeekView({
  weekDays,
  events,
  selectedDate,
  onSelectDate,
  onEventClick,
  onQuickAddDate,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-3 min-h-[520px]">
      {weekDays.map((day) => {
        const isSelected = selectedDate === day.dateStr;
        const dayEvents = events.filter((e) => isEventOnDate(e, day.dateStr));

        return (
          <div
            key={day.dateStr}
            onClick={() => onSelectDate(day.dateStr)}
            className={`flex flex-col rounded-2xl border transition-all cursor-pointer overflow-hidden ${
              isSelected
                ? "border-navy ring-2 ring-navy/20 bg-blue-50/10 shadow-xs"
                : day.isToday
                ? "border-navy/60 bg-slate-50/60"
                : "border-bdr/80 hover:border-slate-300 bg-white"
            }`}
          >
            {/* Column Header */}
            <div
              className={`p-3 text-center border-b ${
                day.isToday
                  ? "bg-navy text-white border-navy"
                  : isSelected
                  ? "bg-blue-50/70 border-blue-200 text-navy font-bold"
                  : "bg-off/80 border-bdr text-slate-700"
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider font-semibold opacity-90">
                {day.dayName}
              </div>
              <div className="text-[17px] font-bold mt-0.5">{day.dayNumber}</div>
            </div>

            {/* Event Cards for this Day */}
            <div className="p-2.5 flex-1 flex flex-col gap-2 overflow-y-auto">
              {dayEvents.map((ev) => {
                const cat = EVENT_CATEGORIES[ev.type] || EVENT_CATEGORIES.Meeting;
                return (
                  <div
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition hover:shadow-xs hover:border-slate-400 flex flex-col gap-1.5 ${cat.bgClass} ${cat.borderClass}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-bold text-[12.5px] text-slate-900 leading-tight line-clamp-2">
                        {ev.title}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-medium border shrink-0 ${cat.badgeClass}`}>
                        {cat.shortLabel}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 flex items-center gap-1">
                      <Clock size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate">{ev.time || "All Day"}</span>
                    </div>

                    {ev.location && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <MapPin size={11} className="text-slate-400 shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </div>
                    )}

                    {ev.virtualLink && (
                      <a
                        href={ev.virtualLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10.5px] text-blue-600 hover:underline font-medium mt-0.5"
                      >
                        <ExternalLink size={10} />
                        Join Link
                      </a>
                    )}
                  </div>
                );
              })}

              {dayEvents.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-muted">
                  <span className="text-[11.5px]">No events</span>
                </div>
              )}

              {/* Quick Add Button */}
              {onQuickAddDate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAddDate(day.dateStr);
                  }}
                  className="mt-auto py-1.5 px-2 rounded-xl border border-dashed border-bdr text-slate-500 hover:text-navy hover:border-navy hover:bg-off text-[11.5px] font-medium flex items-center justify-center gap-1 transition"
                >
                  <Plus size={13} />
                  Add
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
