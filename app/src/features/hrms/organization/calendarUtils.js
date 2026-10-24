import { MONTH_NAMES } from "./calendarConfig";

export function padZero(n) {
  return n.toString().padStart(2, "0");
}

export function formatDateKey(year, month, day) {
  return `${year}-${padZero(month + 1)}-${padZero(day)}`;
}

export function parseDateKey(dateStr) {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatHumanDate(dateStr) {
  if (!dateStr) return "";
  const d = parseDateKey(dateStr);
  const monthName = MONTH_NAMES[d.getMonth()];
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = days[d.getDay()];
  return `${dayName}, ${monthName.slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const d = parseDateKey(dateStr);
  const monthName = MONTH_NAMES[d.getMonth()];
  return `${monthName.slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

export function getQuarterInfo(month, year) {
  const q = Math.floor(month / 3) + 1;
  return `Q${q} ${year} Active Period`;
}

export function isEventOnDate(event, dateStr) {
  if (!event.date && !event.startDate) return false;
  const start = event.startDate || event.date;
  const end = event.endDate || event.startDate || event.date;
  return dateStr >= start && dateStr <= end;
}

/**
 * Generates the full 35 or 42 cells grid for a given year & month (0-indexed month)
 * Week starts on Monday (Mon = 0, Sun = 6)
 */
export function generateMonthGrid(year, month) {
  const today = new Date();
  const todayStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const firstDayOfMonth = new Date(year, month, 1);
  // getDay(): 0 = Sun, 1 = Mon ... 6 = Sat
  // We want Mon = 0, Tue = 1 ... Sun = 6
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6; // Sunday becomes 6

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];

  // Previous month trailing days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dateStr = formatDateKey(prevYear, prevMonth, day);
    cells.push({
      dayNumber: day,
      month: prevMonth,
      year: prevYear,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateKey(year, month, d);
    cells.push({
      dayNumber: d,
      month,
      year,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // Next month leading days to complete full weeks (multiple of 7, 35 or 42)
  const remainingCells = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dateStr = formatDateKey(nextYear, nextMonth, d);
    cells.push({
      dayNumber: d,
      month: nextMonth,
      year: nextYear,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  return cells;
}

/**
 * Generates the 7 days of the week containing the reference date
 */
export function generateWeekDays(currentDate) {
  const d = parseDateKey(currentDate);
  let dayOfWeek = d.getDay() - 1;
  if (dayOfWeek === -1) dayOfWeek = 6; // Monday = 0, Sunday = 6

  const monday = new Date(d);
  monday.setDate(d.getDate() - dayOfWeek);

  const today = new Date();
  const todayStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const days = [];
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    const dateStr = formatDateKey(current.getFullYear(), current.getMonth(), current.getDate());
    days.push({
      dayName: dayNames[i],
      dayNumber: current.getDate(),
      month: current.getMonth(),
      year: current.getFullYear(),
      dateStr,
      isToday: dateStr === todayStr,
    });
  }

  return days;
}

/**
 * Export events into an iCalendar (.ics) format and trigger download
 */
export function exportEventsToICS(events, calendarName = "HRMS-Calendar") {
  const formatICSDate = (dateStr, timeStr) => {
    const cleanDate = dateStr.replace(/-/g, "");
    return `${cleanDate}T090000Z`;
  };

  const today = new Date();
  const todayDefaultStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  let icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Evenmore HRMS//Personal & Team Calendar//EN",
    `X-WR-CALNAME:${calendarName}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  events.forEach((ev) => {
    const startStr = ev.startDate || ev.date || todayDefaultStr;
    const endStr = ev.endDate || ev.startDate || ev.date || todayDefaultStr;
    const icsStart = formatICSDate(startStr, ev.time);
    const icsEnd = formatICSDate(endStr, ev.time);

    icsContent.push(
      "BEGIN:VEVENT",
      `UID:${ev.id}@evenmore.hrms`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART:${icsStart}`,
      `DTEND:${icsEnd}`,
      `SUMMARY:${ev.title.replace(/,/g, "\\,")}`,
      `DESCRIPTION:${(ev.description || ev.type || "").replace(/\n/g, "\\n")}`,
      `LOCATION:${(ev.location || "Office").replace(/,/g, "\\,")}`,
      `CATEGORIES:${ev.type || "General"}`,
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  });

  icsContent.push("END:VCALENDAR");

  const blob = new Blob([icsContent.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${calendarName.toLowerCase()}-${Date.now()}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
