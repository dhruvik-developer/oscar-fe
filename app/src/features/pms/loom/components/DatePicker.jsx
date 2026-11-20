import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { formatDateDDMMYYYY, getCurrentISODate } from '../../../../utils/dateUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseYMD(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
  return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

function toYMD(year, monthIndex, day) {
  const y = String(year).padStart(4, '0');
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DatePicker({
  value,
  onChange,
  label = 'Date:',
  className = '',
  align = 'auto',
  readOnly = false,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const [menuAlign, setMenuAlign] = useState(align === 'right' ? 'right' : 'left');

  const selectedParts = useMemo(() => parseYMD(value), [value]);

  // Calendar navigation view state
  const [viewYear, setViewYear] = useState(selectedParts.year);
  const [viewMonth, setViewMonth] = useState(selectedParts.month);

  // Sync viewing month/year whenever picker opens or value changes
  useEffect(() => {
    if (open) {
      setViewYear(selectedParts.year);
      setViewMonth(selectedParts.month);
    }
  }, [open, selectedParts.year, selectedParts.month]);

  const updateAlignment = () => {
    if (align === 'left' || align === 'right') {
      setMenuAlign(align);
      return;
    }
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownWidth = 280;
      const spaceOnRight = window.innerWidth - rect.left;
      const spaceOnLeft = rect.right;

      if (spaceOnRight < dropdownWidth && spaceOnLeft >= dropdownWidth) {
        setMenuAlign('right');
      } else {
        setMenuAlign('left');
      }
    }
  };

  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    if (open) {
      updateAlignment();
      window.addEventListener('resize', updateAlignment);
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('resize', updateAlignment);
        document.removeEventListener('mousedown', handleOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [open, align]);

  const handleToggle = () => {
    if (readOnly) return;
    if (!open) {
      updateAlignment();
    }
    setOpen((prev) => !prev);
  };

  const todayStr = useMemo(() => getCurrentISODate(), []);
  const isToday = value === todayStr;

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toYMD(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDate = (dateYMD) => {
    onChange?.(dateYMD);
    setOpen(false);
  };

  // Generate calendar days grid for viewYear and viewMonth
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days = [];

    // Trailing days from prev month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthIdx = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYearNum = viewMonth === 0 ? viewYear - 1 : viewYear;
      days.push({
        day: dayNum,
        dateStr: toYMD(prevYearNum, prevMonthIdx, dayNum),
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      days.push({
        day: d,
        dateStr: toYMD(viewYear, viewMonth, d),
        isCurrentMonth: true,
      });
    }

    // Next month filler days to complete grid (multiples of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonthIdx = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYearNum = viewMonth === 11 ? viewYear + 1 : viewYear;
      days.push({
        day: d,
        dateStr: toYMD(nextYearNum, nextMonthIdx, d),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  const displayFormatted = formatDateDDMMYYYY(value) || value || 'Select Date';

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${open ? 'z-30' : ''} ${className}`}>
      {/* Modern Trigger Button matching CompanySelector and Oscar ERP Control Bar */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={readOnly}
        title={readOnly ? 'Date locked (view only)' : undefined}
        className={`h-[38px] flex items-center gap-2 rounded-xl px-3 border transition-all select-none w-full justify-between sm:justify-start ${
          readOnly
            ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 cursor-default opacity-90'
            : open
            ? 'bg-blue-50/50 dark:bg-slate-800 border-blue-500 ring-2 ring-blue-500/20 cursor-pointer shadow-2xs'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <CalendarIcon size={13} />
          </div>
          {label && (
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline shrink-0">
              {label}
            </span>
          )}
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 text-left whitespace-nowrap">
            {displayFormatted}
          </span>
          {isToday && (
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
              Today
            </span>
          )}
        </div>
        {!readOnly && (
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-200 ml-0.5 shrink-0 ${
              open ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
            }`}
          />
        )}
      </button>

      {/* Custom Calendar Popover */}
      {open && (
        <div
          className={`absolute ${
            menuAlign === 'right' ? 'right-0' : 'left-0'
          } top-full mt-1.5 z-50 w-72 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 animate-in fade-in zoom-in-95 duration-150 select-none`}
        >
          {/* Header Month / Year Navigation */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              title="Next Month"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center pt-2 pb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
            {DAYS_SHORT.map((d) => (
              <div key={d} className="h-6 flex items-center justify-center">
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((item) => {
              const isSelected = item.dateStr === value;
              const isTodayCell = item.dateStr === todayStr;

              return (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => handleSelectDate(item.dateStr)}
                  className={`h-8 w-8 mx-auto flex items-center justify-center text-xs rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : isTodayCell
                      ? 'font-bold text-blue-600 dark:text-blue-400 border border-blue-400/50 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/40 hover:bg-blue-100/60'
                      : item.isCurrentMonth
                      ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                      : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Quick Action Footer */}
          <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleSelectDate(yesterdayStr)}
              className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => handleSelectDate(todayStr)}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
