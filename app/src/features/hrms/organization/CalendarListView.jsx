import { Clock, MapPin, Users, ExternalLink, Edit2, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { EVENT_CATEGORIES } from "./calendarConfig";
import { formatHumanDate, formatShortDate } from "./calendarUtils";

export function CalendarListView({
  events,
  onEventClick,
  onDeleteEvent,
  onAddNewEvent,
}) {
  // Sort events chronologically by startDate
  const sorted = [...events].sort((a, b) => {
    const da = a.startDate || a.date;
    const db = b.startDate || b.date;
    return da.localeCompare(db);
  });

  if (sorted.length === 0) {
    return (
      <div className="bg-white border border-bdr rounded-2xl p-12 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-off border border-bdr grid place-items-center text-muted mb-3">
          <CalendarIcon size={24} />
        </div>
        <h3 className="font-bold text-[16px] text-slate-800">No scheduled events found</h3>
        <p className="text-[13px] text-muted max-w-sm mt-1 mb-4">
          There are no events matching your active filters or scheduled period.
        </p>
        {onAddNewEvent && (
          <button
            type="button"
            onClick={onAddNewEvent}
            className="px-4 py-2 bg-navy text-white text-[13px] font-medium rounded-xl hover:bg-navy/90 transition shadow-xs"
          >
            Schedule New Event
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((ev) => {
        const cat = EVENT_CATEGORIES[ev.type] || EVENT_CATEGORIES.Meeting;
        const startDateFormatted = formatShortDate(ev.startDate || ev.date);
        const endDateFormatted = ev.endDate && ev.endDate !== (ev.startDate || ev.date) ? formatShortDate(ev.endDate) : null;

        return (
          <div
            key={ev.id}
            onClick={() => onEventClick(ev)}
            className="bg-white border border-bdr rounded-2xl p-4 shadow-xs hover:border-slate-300 hover:shadow-sm transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            {/* Left: Date pill & Details */}
            <div className="flex items-start gap-3.5">
              {/* Date Box */}
              <div className="w-16 h-16 rounded-xl bg-slate-50 border border-bdr flex flex-col items-center justify-center shrink-0">
                <span className="text-[11px] uppercase font-bold text-slate-500">
                  {new Date((ev.startDate || ev.date) + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                </span>
                <span className="text-[18px] font-extrabold text-navy leading-none mt-0.5">
                  {new Date((ev.startDate || ev.date) + "T00:00:00").getDate()}
                </span>
              </div>

              {/* Title & metadata */}
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[14.5px] text-slate-900 hover:text-navy transition">
                    {ev.title}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cat.badgeClass}`}>
                    {cat.shortLabel}
                  </span>
                  {ev.dept && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-off border border-bdr text-slate-600 font-medium">
                      {ev.dept}
                    </span>
                  )}
                </div>

                {ev.description && (
                  <p className="text-[12.5px] text-slate-600 line-clamp-1">
                    {ev.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-[12px] text-slate-500 mt-0.5">
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-slate-400" />
                    <span>
                      {endDateFormatted ? `${startDateFormatted} - ${endDateFormatted}` : ev.time || "All Day"}
                    </span>
                  </div>

                  {ev.location && (
                    <div className="flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400" />
                      <span>{ev.location}</span>
                    </div>
                  )}

                  {ev.organizer && (
                    <div className="flex items-center gap-1">
                      <Users size={12} className="text-slate-400" />
                      <span>{ev.organizer}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {ev.virtualLink && (
                <a
                  href={ev.virtualLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-[12px] font-medium transition"
                >
                  <ExternalLink size={13} />
                  Join Link
                </a>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(ev);
                }}
                className="w-8 h-8 rounded-xl border border-bdr hover:bg-off grid place-items-center text-slate-600 transition"
                title="Edit Event"
              >
                <Edit2 size={14} />
              </button>

              {onDeleteEvent && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete event "${ev.title}"?`)) {
                      onDeleteEvent(ev.id);
                    }
                  }}
                  className="w-8 h-8 rounded-xl border border-bdr hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 grid place-items-center transition"
                  title="Delete Event"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
