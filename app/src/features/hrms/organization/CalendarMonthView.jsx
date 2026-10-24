import { useState } from "react";
import { Plus } from "lucide-react";
import { DAYS_OF_WEEK, EVENT_CATEGORIES } from "./calendarConfig";
import { isEventOnDate } from "./calendarUtils";

export function CalendarMonthView({
  cells,
  events,
  selectedDate,
  onSelectDate,
  onEventClick,
  onQuickAddDate,
}) {
  const [hoveredCellDate, setHoveredCellDate] = useState(null);

  const getEventBadgeClasses = (type) => {
    const cat = EVENT_CATEGORIES[type] || EVENT_CATEGORIES.Meeting;
    return `${cat.badgeClass} border`;
  };

  return (
    <div className="flex flex-col">
      {/* Days Header */}
      <div className="grid grid-cols-7 text-center text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* 35 or 42 Cells Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell) => {
          const isSelected = selectedDate === cell.dateStr;
          const isCurrentMonth = cell.isCurrentMonth;
          const dayEvents = events.filter((e) => isEventOnDate(e, cell.dateStr));
          const isHovered = hoveredCellDate === cell.dateStr;

          return (
            <div
              key={cell.dateStr}
              onClick={() => onSelectDate(cell.dateStr)}
              onMouseEnter={() => setHoveredCellDate(cell.dateStr)}
              onMouseLeave={() => setHoveredCellDate(null)}
              className={`group relative min-h-[92px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "border-navy ring-2 ring-navy/20 bg-blue-50/20 shadow-xs"
                  : cell.isToday
                  ? "border-navy/60 bg-slate-50/80"
                  : !isCurrentMonth
                  ? "border-bdr/40 bg-slate-50/40 text-slate-400 opacity-60"
                  : "border-bdr/70 hover:border-slate-300 hover:bg-slate-50/50 bg-white"
              }`}
            >
              {/* Top Row: Date Number & Indicators */}
              <div className="flex justify-between items-center">
                <span
                  className={`text-[12px] font-bold transition ${
                    cell.isToday
                      ? "w-6 h-6 rounded-full bg-navy text-white grid place-items-center shadow-xs"
                      : isSelected
                      ? "text-navy font-extrabold"
                      : isCurrentMonth
                      ? "text-slate-800"
                      : "text-slate-400"
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {/* Quick Add Button or Indicator Dot */}
                <div className="flex items-center gap-1">
                  {onQuickAddDate && isHovered && (
                    <button
                      type="button"
                      title={`Add event on ${cell.dateStr}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickAddDate(cell.dateStr);
                      }}
                      className="w-5 h-5 rounded-md bg-navy text-white hover:bg-navy/90 grid place-items-center shadow-2xs transition"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                  {dayEvents.length > 0 && !isHovered && (
                    <span className="w-1.5 h-1.5 rounded-full bg-navy" />
                  )}
                </div>
              </div>

              {/* Event Tags */}
              <div className="flex flex-col gap-1 mt-1.5">
                {dayEvents.slice(0, 2).map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium truncate transition hover:opacity-85 ${getEventBadgeClasses(
                      ev.type
                    )}`}
                    title={`${ev.title} (${ev.time || "All Day"})`}
                  >
                    {ev.title}
                  </div>
                ))}

                {dayEvents.length > 2 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate(cell.dateStr);
                    }}
                    className="text-[9.5px] text-slate-500 font-semibold hover:text-navy transition"
                  >
                    +{dayEvents.length - 2} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
