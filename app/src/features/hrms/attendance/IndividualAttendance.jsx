import { useState, useMemo, useEffect, useCallback } from "react";
import { ChevronRight, ChevronLeft, X } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import { pullIndividualAttendance, HRMS_RESOURCES, isServerId } from "../../../services/hrmsSync";
import { api } from "../../../services/api";
import Modal from "../../../components/ui/Modal";
import { PageInfoButton } from "../../../components/common/PageInfoButton";
import Pagination from "../../../components/ui/Pagination";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { UserInitials } from "../../../components/common/UserInitials";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(THIS_YEAR - i));

function parseRecordDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  // YYYY-MM-DD or YYYY/MM/DD
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(str);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // DD-MM-YYYY or DD/MM/YYYY
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(str);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTimeDisplay(value) {
  if (!value || value === "—" || value === "-") return "—";
  if (typeof value === "string" && value.includes("T")) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      let hours = d.getHours();
      const mins = String(d.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, "0")}:${mins} ${ampm}`;
    }
  }
  if (typeof value === "string" && /^\d{1,2}:\d{2}/.test(value)) {
    const m = /(\d{1,2}):(\d{2})/.exec(value);
    if (m) {
      let hours = parseInt(m[1], 10);
      const mins = m[2];
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, "0")}:${mins} ${ampm}`;
    }
  }
  return String(value);
}

function toHHMM(value) {
  if (!value || value === "—" || value === "-") return "—";
  if (typeof value === "string" && value.includes("T")) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
  }
  const m = /(\d{1,2}):(\d{2})/.exec(String(value));
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : String(value);
}

function toTimeInputValue(val) {
  if (!val || val === "—" || val === "-" || val === "--:--") return "";
  const s = String(val).trim();
  if (s.includes("T")) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
  }
  const match = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = match[2];
    const ampm = match[3]?.toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${mins}`;
  }
  const single = s.match(/^(\d{1,2})$/);
  if (single) {
    const h = parseInt(single[1], 10);
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, "0")}:00`;
    }
  }
  return "";
}

function isRecordForEmployee(r, emp) {
  if (!r || !emp) return false;
  const empId = String(emp.id || "").toLowerCase();
  const empCode = String(emp.empId || emp.employeeCode || "").toLowerCase();
  const empName = String(emp.name || "").trim().toLowerCase();

  const rEmpId = String(r.employeeId || r.employee_id || "").toLowerCase();
  const rCode = String(r.employeeCode || r.empId || "").toLowerCase();
  const rId = String(r.id || "").toLowerCase();
  const rName = String(r.employee || r.name || r.employeeName || "").trim().toLowerCase();

  if (empId && (rEmpId === empId || rId === empId)) return true;
  if (empCode && (rCode === empCode || rEmpId === empCode || rId === empCode)) return true;
  if (empName && rName && rName === empName) return true;
  return false;
}

function minutesOf(value) {
  const m = /(\d{1,2}):(\d{2})/.exec(String(value || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function workedMinutes(r) {
  const a = minutesOf(r.checkIn);
  const b = minutesOf(r.checkOut);
  return a !== null && b !== null && b > a ? b - a : 0;
}

const statusStyles = {
  Present: { background: "#e6f4ea", color: "#15803d", border: "#a7f3d0" },
  Late: { background: "#fef3c7", color: "#b45309", border: "#fde68a" },
  Absent: { background: "#fee2e2", color: "#dc2626", border: "#fca5a5" },
  WFH: { background: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  "On Leave": { background: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  "Half Day": { background: "#f3e8ff", color: "#7e22ce", border: "#d8b4fe" },
  "Week Off": { background: "#f1f5f9", color: "#64748b", border: "#e2e8f0" },
  "Holiday": { background: "#fdf4ff", color: "#c026d3", border: "#f5d0fe" },
  "Not Marked": { background: "#f8fafc", color: "#94a3b8", border: "#e2e8f0" },
};

export default function IndividualAttendance() {
  const setToast = useAppStore((s) => s.setToast || s.showToast);
  const storeEmployees = useAppStore((s) => s.employees || []);
  const storeRecords = useAttendanceStore((s) => s.records || []);
  const updateStoreRecord = useAttendanceStore((s) => s.updateRecord);

  const employeesList = useMemo(() => {
    const map = new Map();
    (storeEmployees || []).forEach((e) => {
      const name = (e.name || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: e.id || e.empId || e.employeeId,
          empId: e.empId || e.employeeCode || "",
          name: e.name,
          designation: e.designation || e.role || "Employee",
          dept: e.department || e.dept || "—",
          manager: e.manager || e.reportingManager || "—",
          location: e.location || e.workLocation || "—",
          status: e.status || "Active",
          avatar: e.avatar || `https://i.pravatar.cc/100?u=${e.id || e.name}`,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [storeEmployees]);

  const now = new Date();
  const [selectedEmpId, setSelectedEmpId] = useState(() => employeesList[0]?.id || "");
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[now.getMonth()]);
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [viewMode, setViewMode] = useState("Table");
  const [tableAllMonthsTab, setTableAllMonthsTab] = useState("Summary"); // "Summary" | "Records"

  const [localEdits, setLocalEdits] = useState({});
  const [editItem, setEditItem] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const currentEmp = useMemo(
    () =>
      employeesList.find((e) => e.id === selectedEmpId) ||
      employeesList[0] || {
        id: "",
        name: "No employee selected",
        designation: "—",
        dept: "—",
        manager: "—",
        location: "—",
        status: "—",
        avatar: "",
      },
    [employeesList, selectedEmpId]
  );

  // The store's attendance pull is capped, so an older month can be missing
  // from it. Read the picked employee's month straight from the API and merge
  // it with the store (the store copy wins -- it carries today's punches).
  const [monthRecords, setMonthRecords] = useState(null);

  const fetchMonthRecords = useCallback(() => {
    if (!isServerId(currentEmp.id)) return;
    const yearNum = Number(selectedYear);
    const pad = (n) => String(n).padStart(2, "0");

    let date_from = `${yearNum}-01-01`;
    let date_to = `${yearNum}-12-31`;

    if (selectedMonth !== "All") {
      const monthIdx = MONTHS.indexOf(selectedMonth);
      if (monthIdx >= 0) {
        const lastDay = new Date(yearNum, monthIdx + 1, 0).getDate();
        date_from = `${yearNum}-${pad(monthIdx + 1)}-01`;
        date_to = `${yearNum}-${pad(monthIdx + 1)}-${pad(lastDay)}`;
      }
    }

    pullIndividualAttendance(currentEmp.id, {
      date_from,
      date_to,
    }).then((body) => {
      const rows = Array.isArray(body) ? body : (body?.results || []);
      setMonthRecords(Array.isArray(rows) ? rows.map(HRMS_RESOURCES.attendance.fromApi) : []);
    }).catch((err) => {
      console.warn("[IndividualAttendance] Failed to fetch month attendance:", err);
    });
  }, [currentEmp.id, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchMonthRecords();
  }, [fetchMonthRecords]);

  useEffect(() => {
    if (!storeRecords || storeRecords.length === 0) {
      useAttendanceStore.getState().refreshAttendance?.();
    }
  }, []);

  const sourceRecords = useMemo(() => {
    if (!monthRecords) return storeRecords || [];
    const byId = new Map((storeRecords || []).map((r) => [r.id, r]));
    monthRecords.forEach((r) => byId.set(r.id, r));
    return [...byId.values()];
  }, [monthRecords, storeRecords]);

  const records = useMemo(() => {
    if (!currentEmp.id) return [];
    const monthIdx = MONTHS.indexOf(selectedMonth);
    const yearNum = Number(selectedYear);
    const pad = (n) => String(n).padStart(2, "0");

    return sourceRecords
      .filter((r) => {
        if (!isRecordForEmployee(r, currentEmp)) return false;
        const d = parseRecordDate(r.rawDate || r.date);
        if (!d || d.getFullYear() !== yearNum) return false;
        if (selectedMonth !== "All" && d.getMonth() !== monthIdx) return false;
        return true;
      })
      .map((r) => {
        const d = parseRecordDate(r.rawDate || r.date);
        const isoDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const key = `${r.id ?? ""}|${r.rawDate || r.date || isoDate}`;
        const editOverride = localEdits[isoDate] || localEdits[key];
        const merged = editOverride ? { ...r, ...editOverride } : r;
        const mins = workedMinutes(merged);
        const hasCheckedOut = Boolean(
          (merged.checkOut && merged.checkOut !== "-" && merged.checkOut !== "—" && merged.checkOut !== "") ||
          merged.check_out ||
          (Array.isArray(merged.punches) && merged.punches.some((p) => p.punchType === "OUT" || p.punch_type === "OUT"))
        );
        const workHoursFormatted =
          merged.formattedWorkingHours && merged.formattedWorkingHours !== "00h 00m"
            ? merged.formattedWorkingHours
            : merged.workHours && merged.workHours !== "-" && merged.workHours !== "—"
            ? merged.workHours
            : merged.workingHours && Number(merged.workingHours) > 0
            ? `${String(Math.floor(Number(merged.workingHours))).padStart(2, "0")}:${String(Math.round((Number(merged.workingHours) % 1) * 60)).padStart(2, "0")}`
            : mins > 0
            ? `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
            : hasCheckedOut
            ? "00:00"
            : "—";

        const base = {
          key,
          recordId: r.id,
          employeeId: currentEmp.id,
          sortTime: d.getTime(),
          dayNum: d.getDate(),
          monthIdx: d.getMonth(),
          monthName: MONTHS[d.getMonth()],
          isoDate,
          rawDate: r.rawDate || isoDate,
          date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          day: DAY_NAMES[d.getDay()],
          checkIn: formatTimeDisplay(merged.firstPunch || merged.first_punch || merged.checkIn),
          checkOut: hasCheckedOut ? formatTimeDisplay(merged.lastPunch || merged.last_punch || merged.checkOut) : "—",
          rawCheckIn: toHHMM(merged.checkIn || merged.firstPunch),
          rawCheckOut: hasCheckedOut ? toHHMM(merged.checkOut || merged.lastPunch) : "",
          workHours: workHoursFormatted,
          breakDuration: (merged.totalBreakMinutes || merged.total_break_minutes) ? `${merged.totalBreakMinutes || merged.total_break_minutes}m` : "-",
          lateMinutes: (merged.lateMinutes || merged.late_minutes) ? `${merged.lateMinutes || merged.late_minutes}m` : "-",
          shift: merged.shift || "General",
          status: merged.status || "Present",
          remarks: merged.remarks || merged.notes || "",
        };
        return base;
      })
      .sort((a, b) => a.sortTime - b.sortTime);
  }, [sourceRecords, currentEmp, selectedMonth, selectedYear, localEdits]);

  const monthWiseSummary = useMemo(() => {
    const yearNum = Number(selectedYear);
    const pad = (n) => String(n).padStart(2, "0");
    return MONTHS.map((monthName, idx) => {
      const monthRecordsList = (sourceRecords || []).filter((r) => {
        if (!isRecordForEmployee(r, currentEmp)) return false;
        const d = parseRecordDate(r.rawDate || r.date);
        return d && d.getFullYear() === yearNum && d.getMonth() === idx;
      }).map((r) => {
        const d = parseRecordDate(r.rawDate || r.date);
        const iso = d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
        return localEdits[iso] ? { ...r, ...localEdits[iso] } : r;
      });

      // Incorporate local edits for this month not yet in sourceRecords
      const totalDays = new Date(yearNum, idx + 1, 0).getDate();
      for (let day = 1; day <= totalDays; day++) {
        const iso = `${yearNum}-${pad(idx + 1)}-${pad(day)}`;
        if (localEdits[iso]) {
          const already = monthRecordsList.some((r) => {
            const d = parseRecordDate(r.rawDate || r.date);
            return d && d.getDate() === day;
          });
          if (!already) {
            monthRecordsList.push({ ...localEdits[iso], date: iso, rawDate: iso });
          }
        }
      }

      const present = monthRecordsList.filter((r) => r.status === "Present").length;
      const absent = monthRecordsList.filter((r) => r.status === "Absent").length;
      const late = monthRecordsList.filter((r) => r.status === "Late").length;
      const halfDay = monthRecordsList.filter((r) => r.status === "Half Day").length;
      const leave = monthRecordsList.filter((r) => r.status === "On Leave").length;
      const wfh = monthRecordsList.filter((r) => r.status === "WFH").length;
      const totalMarked = present + absent + late + halfDay + leave + wfh;
      const attendanceRate = totalMarked > 0 ? Math.round(((present + late + wfh + halfDay * 0.5) / totalMarked) * 100) : 0;

      return {
        month: monthName,
        monthIdx: idx,
        year: yearNum,
        totalDays,
        present,
        absent,
        late,
        halfDay,
        leave,
        wfh,
        totalMarked,
        attendanceRate: totalMarked > 0 ? `${attendanceRate}%` : "—",
      };
    });
  }, [sourceRecords, currentEmp, selectedYear, localEdits]);

  const recordsByDay = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      map[r.dayNum] = r;
    });

    // Also inject any localEdits for this month/year even if no server row existed yet
    const pad = (n) => String(n).padStart(2, "0");
    const curMonthIdx = new Date().getMonth();
    const monthIdx = selectedMonth === "All" ? curMonthIdx : MONTHS.indexOf(selectedMonth);
    const yearNum = Number(selectedYear);
    if (monthIdx >= 0 && yearNum) {
      const totalDays = new Date(yearNum, monthIdx + 1, 0).getDate();
      for (let day = 1; day <= totalDays; day++) {
        const iso = `${yearNum}-${pad(monthIdx + 1)}-${pad(day)}`;
        const edit = localEdits[iso];
        if (edit) {
          const prev = map[day] || {};
          const d = new Date(yearNum, monthIdx, day);
          map[day] = {
            ...prev,
            dayNum: day,
            isoDate: iso,
            rawDate: iso,
            date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
            day: DAY_NAMES[d.getDay()],
            checkIn: edit.status === "Absent" ? "—" : (edit.checkIn || prev.checkIn || "09:30"),
            checkOut: edit.status === "Absent" ? "—" : (edit.checkOut || prev.checkOut || "18:30"),
            workHours: edit.status === "Absent" ? "—" : (edit.workHours || prev.workHours || "09:00"),
            shift: edit.shift || prev.shift || "General",
            status: edit.status || prev.status || "Present",
            remarks: edit.remarks !== undefined ? edit.remarks : (prev.remarks || ""),
          };
        }
      }
    }
    return map;
  }, [records, localEdits, selectedMonth, selectedYear]);

  const monthDailyRows = useMemo(() => {
    if (selectedMonth === "All") {
      return records;
    }

    const monthIdx = MONTHS.indexOf(selectedMonth);
    const yearNum = Number(selectedYear);
    if (monthIdx < 0 || !yearNum) return [];

    const totalDays = new Date(yearNum, monthIdx + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getMonth() === monthIdx && today.getFullYear() === yearNum;
    const todayDate = today.getDate();

    const rows = [];
    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(yearNum, monthIdx, day);
      const dayOfWeek = dateObj.getDay();
      const isSunday = dayOfWeek === 0;
      const isToday = isCurrentMonth && day === todayDate;
      const isPast = isCurrentMonth
        ? day < todayDate
        : new Date(yearNum, monthIdx, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const pad = (n) => String(n).padStart(2, "0");
      const isoDate = `${yearNum}-${pad(monthIdx + 1)}-${pad(day)}`;
      const formattedDate = dateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const record = recordsByDay[day];

      let status = "Not Marked";
      let checkIn = "—";
      let checkOut = "—";
      let workHours = "—";
      let shift = "General";
      let remarks = "";

      if (record) {
        status = record.status || "Present";
        checkIn = record.checkIn;
        checkOut = record.checkOut;
        workHours = record.workHours;
        shift = record.shift || "General";
        remarks = record.remarks;
      } else if (isSunday) {
        status = "Week Off";
      } else if (isPast) {
        status = "Absent";
      } else if (isToday) {
        status = "Not Marked";
      }

      rows.push({
        key: `row-${day}`,
        recordId: record?.recordId,
        dayNum: day,
        dateObj,
        isoDate,
        date: formattedDate,
        day: DAY_NAMES[dayOfWeek],
        isToday,
        isSunday,
        isPast,
        record,
        checkIn,
        checkOut,
        workHours,
        breakDuration: record?.breakDuration || ((record?.totalBreakMinutes || record?.total_break_minutes) ? `${record.totalBreakMinutes || record.total_break_minutes}m` : "-"),
        lateMinutes: record?.lateMinutes || ((record?.lateMinutes || record?.late_minutes) ? `${record.lateMinutes || record.late_minutes}m` : "-"),
        shift,
        status,
        remarks,
      });
    }

    return rows;
  }, [selectedMonth, selectedYear, records, recordsByDay]);

  const [recPage, setRecPage] = useState(1);
  const [recPageSize, setRecPageSize] = useState(10);
  const [dailyPage, setDailyPage] = useState(1);
  const [dailyPageSize, setDailyPageSize] = useState(10);

  useEffect(() => {
    setRecPage(1);
  }, [selectedYear, recPageSize]);

  useEffect(() => {
    setDailyPage(1);
  }, [selectedMonth, selectedYear, dailyPageSize]);

  const paginatedRecords = useMemo(() => {
    const start = (recPage - 1) * recPageSize;
    return records.slice(start, start + recPageSize);
  }, [records, recPage, recPageSize]);

  const paginatedDaily = useMemo(() => {
    const start = (dailyPage - 1) * dailyPageSize;
    return monthDailyRows.slice(start, start + dailyPageSize);
  }, [monthDailyRows, dailyPage, dailyPageSize]);

  const calendarDays = useMemo(() => {
    const curMonthIdx = new Date().getMonth();
    const monthIdx = selectedMonth === "All" ? curMonthIdx : MONTHS.indexOf(selectedMonth);
    const yearNum = Number(selectedYear);
    if (monthIdx < 0 || !yearNum) return [];

    const totalDays = new Date(yearNum, monthIdx + 1, 0).getDate();
    // Monday as index 0 (0=Mon, 1=Tue, ..., 6=Sun)
    const firstDayOfWeek = (new Date(yearNum, monthIdx, 1).getDay() + 6) % 7;

    const today = new Date();
    const isCurrentMonth = today.getMonth() === monthIdx && today.getFullYear() === yearNum;
    const todayDate = today.getDate();

    const days = [];

    // Preceding padding cells from previous month
    const prevMonthTotalDays = new Date(yearNum, monthIdx, 0).getDate();
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevDayNum = prevMonthTotalDays - firstDayOfWeek + 1 + i;
      days.push({
        key: `prev-${prevDayNum}`,
        dayNum: prevDayNum,
        isOtherMonth: true,
      });
    }

    // All days in the current month
    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(yearNum, monthIdx, day);
      const dayOfWeek = dateObj.getDay(); // 0 is Sun, 6 is Sat
      const isSunday = dayOfWeek === 0;
      const isToday = isCurrentMonth && day === todayDate;
      const isPast = isCurrentMonth
        ? day < todayDate
        : new Date(yearNum, monthIdx, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const pad = (n) => String(n).padStart(2, "0");
      const isoDate = `${yearNum}-${pad(monthIdx + 1)}-${pad(day)}`;
      const formattedDate = dateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const record = recordsByDay[day];

      let status = "";
      let checkIn = "";
      let checkOut = "";
      let workHours = "";
      let remarks = "";

      if (record) {
        status = record.status || "Present";
        checkIn = record.checkIn;
        checkOut = record.checkOut;
        workHours = record.workHours;
        remarks = record.remarks;
      } else if (isSunday) {
        status = "Week Off";
      } else if (isPast) {
        status = "Absent";
      } else if (isToday) {
        status = "Not Marked";
      }

      days.push({
        key: `curr-${day}`,
        dayNum: day,
        dateObj,
        isoDate,
        formattedDate,
        dayName: DAY_NAMES[dayOfWeek],
        isOtherMonth: false,
        isToday,
        isSunday,
        isPast,
        record,
        status,
        checkIn,
        checkOut,
        workHours,
        remarks,
      });
    }

    // Trailing padding cells to complete 7 columns
    const totalFilled = days.length;
    const remaining = (7 - (totalFilled % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        key: `next-${i}`,
        dayNum: i,
        isOtherMonth: true,
      });
    }

    return days;
  }, [selectedMonth, selectedYear, recordsByDay]);

  const stats = useMemo(() => {
    return {
      present: records.filter((r) => r.status === "Present").length,
      absent: records.filter((r) => r.status === "Absent").length,
      late: records.filter((r) => r.status === "Late").length,
      halfDay: records.filter((r) => r.status === "Half Day").length,
      leave: records.filter((r) => r.status === "On Leave").length,
      wfh: records.filter((r) => r.status === "WFH").length,
    };
  }, [records]);

  const handlePrevMonth = () => {
    const currentIdx = MONTHS.indexOf(selectedMonth);
    if (currentIdx === 0) {
      setSelectedMonth(MONTHS[11]);
      setSelectedYear((y) => String(Number(y) - 1));
    } else {
      setSelectedMonth(MONTHS[currentIdx - 1]);
    }
  };

  const handleNextMonth = () => {
    const currentIdx = MONTHS.indexOf(selectedMonth);
    if (currentIdx === 11) {
      setSelectedMonth(MONTHS[0]);
      setSelectedYear((y) => String(Number(y) + 1));
    } else {
      setSelectedMonth(MONTHS[currentIdx + 1]);
    }
  };

  const handleCellClick = (cell) => {
    if (cell.isOtherMonth) return;
    if (cell.record) {
      setEditItem({
        ...cell.record,
        isoDate: cell.isoDate,
        date: cell.formattedDate || cell.record.date,
        dayNum: cell.dayNum,
        checkIn: toTimeInputValue(cell.record.rawCheckIn || cell.record.checkIn),
        checkOut: toTimeInputValue(cell.record.rawCheckOut || cell.record.checkOut),
      });
    } else {
      setEditItem({
        key: `new|${currentEmp.id}|${cell.isoDate}`,
        recordId: undefined,
        employeeId: currentEmp.id,
        dayNum: cell.dayNum,
        date: cell.formattedDate,
        isoDate: cell.isoDate,
        checkIn: cell.status === "Absent" || cell.status === "Week Off" ? "" : "09:30",
        checkOut: cell.status === "Absent" || cell.status === "Week Off" ? "" : "18:30",
        workHours: cell.status === "Absent" || cell.status === "Week Off" ? "—" : "09:00",
        shift: "General",
        status: cell.status && cell.status !== "Not Marked" && cell.status !== "Week Off" ? cell.status : "Present",
        remarks: "",
        isNew: true,
      });
    }
  };

  const handleEditSave = async () => {
    if (!editItem) return;

    const pad = (n) => String(n).padStart(2, "0");
    let isoDate = editItem.isoDate;
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      const parsedD = parseRecordDate(editItem.rawDate || editItem.date);
      if (parsedD) {
        isoDate = `${parsedD.getFullYear()}-${pad(parsedD.getMonth() + 1)}-${pad(parsedD.getDate())}`;
      }
    }
    if (!isoDate) {
      const curMonthIdx = MONTHS.indexOf(selectedMonth);
      const mIdx = curMonthIdx >= 0 ? curMonthIdx : new Date().getMonth();
      const dNum = editItem.dayNum || 1;
      isoDate = `${selectedYear}-${pad(mIdx + 1)}-${pad(dNum)}`;
    }

    const updatedItem = {
      ...editItem,
      isoDate,
      status: editItem.status,
      checkIn: editItem.status === "Absent" ? "—" : (editItem.checkIn || "09:30"),
      checkOut: editItem.status === "Absent" ? "—" : (editItem.checkOut || "18:30"),
      remarks: editItem.remarks || "",
    };

    setLocalEdits((prev) => ({
      ...prev,
      [isoDate]: updatedItem,
      ...(editItem.key ? { [editItem.key]: updatedItem } : {}),
    }));

    // Optimistically update monthRecords
    setMonthRecords((prev) => {
      const list = prev ? [...prev] : [];
      const idx = list.findIndex(
        (r) =>
          (r.id && editItem.recordId && r.id === editItem.recordId) ||
          r.rawDate === isoDate ||
          r.date === isoDate ||
          r.date === editItem.date
      );
      const newRow = {
        ...(idx >= 0 ? list[idx] : {}),
        id: editItem.recordId || list[idx]?.id || `att-${currentEmp.id}-${isoDate}`,
        employeeId: currentEmp.id,
        employeeName: currentEmp.name,
        name: currentEmp.name,
        rawDate: isoDate,
        date: editItem.date || isoDate,
        checkIn: editItem.status === "Absent" ? null : (editItem.checkIn && editItem.checkIn !== "—" ? editItem.checkIn : null),
        checkOut: editItem.status === "Absent" ? null : (editItem.checkOut && editItem.checkOut !== "—" ? editItem.checkOut : null),
        status: editItem.status,
        remarks: editItem.remarks || "",
        notes: editItem.remarks || "",
      };
      if (idx >= 0) {
        list[idx] = newRow;
      } else {
        list.push(newRow);
      }
      return list;
    });

    if (updateStoreRecord && editItem.recordId !== undefined) {
      updateStoreRecord(editItem.recordId, {
        checkIn: editItem.checkIn,
        checkOut: editItem.checkOut,
        status: editItem.status,
      });
    }

    const sanitizeTime = (t) => {
      if (!t || typeof t !== "string") return null;
      const clean = t.trim();
      if (clean === "—" || clean === "-" || clean === "--:--" || clean === "") return null;
      const m = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (!m) return null;
      return `${m[1].padStart(2, "0")}:${m[2]}`;
    };

    try {
      await api.post("/hrms/attendance/bulk/", {
        date: isoDate,
        records: [
          {
            employeeId: currentEmp.id,
            checkIn: editItem.status === "Absent" ? null : sanitizeTime(editItem.checkIn),
            checkOut: editItem.status === "Absent" ? null : sanitizeTime(editItem.checkOut),
            status: editItem.status,
            remark: editItem.remarks || null,
          },
        ],
      });
      await useAttendanceStore.getState().refreshAttendance();
      fetchMonthRecords();
    } catch (err) {
      console.warn("[IndividualAttendance] Failed to save attendance to server:", err);
    }

    setToast(`Attendance record for ${editItem.date || isoDate} updated.`);
    setEditItem(null);
  };

  return (
    <div className="ind-att-page">
      {/* Breadcrumb */}
      <nav className="ind-crumb">
        <span style={{ cursor: "pointer" }}>Home</span>
        <ChevronRight size={13} style={{ color: "#9aa7bd" }} />
        <span style={{ color: "#111f36", fontWeight: 600 }}>Attendance / Individual Attendance</span>
      </nav>

      {/* Header Row */}
      <div className="ind-title-row">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="ind-title">Individual Attendance</h1>
            <PageInfoButton guide={hrmsGuides.attendanceIndividual} />
          </div>
          <p className="ind-sub">View and manage per-employee attendance history.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ind-card ind-filter-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select
            value={currentEmp.id}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="ind-select ind-select-emp"
          >
            {employeesList.length === 0 && <option value="">No employees</option>}
            {employeesList.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.empId || e.id}
              </option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="ind-select"
          >
            <option value="All">All Months (Year {selectedYear})</option>
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m} {m === MONTHS[now.getMonth()] && selectedYear === String(now.getFullYear()) ? "(Current)" : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              const curNow = new Date();
              setSelectedMonth(MONTHS[curNow.getMonth()]);
              setSelectedYear(String(curNow.getFullYear()));
            }}
            className="ind-btn-current-month"
            title="Switch to Current Month"
          >
            Current Month
          </button>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="ind-select"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* View Toggle */}
        <div className="ind-tabs">
          <button
            type="button"
            onClick={() => setViewMode("Table")}
            className={viewMode === "Table" ? "ind-tab active" : "ind-tab"}
          >
            Table View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("Calendar")}
            className={viewMode === "Calendar" ? "ind-tab active" : "ind-tab"}
          >
            Calendar View
          </button>
        </div>
      </div>

      {/* Hero Employee Card */}
      <div className="ind-card ind-hero-card">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {currentEmp.id && <UserInitials name={currentEmp.name} className="ind-hero-avatar w-11 h-11 text-sm" />}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                {currentEmp.name}
              </h3>
              <span style={{ fontSize: "12.5px", color: "#6b7280" }}>{currentEmp.id}</span>
            </div>
            <div style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
              {currentEmp.designation} • {currentEmp.dept} • Manager: {currentEmp.manager} •{" "}
              <span className="ind-status-pill">{currentEmp.status}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowProfileModal(true)}
          className="ind-btn-view-emp"
          disabled={!currentEmp.id}
        >
          View Employee
        </button>
      </div>

      {/* Stats Cards Row (6 Cards) */}
      <div className="ind-stats-grid">
        <div className="ind-stat-card">
          <span className="ind-stat-label">PRESENT DAYS</span>
          <span className="ind-stat-val">{stats.present}</span>
        </div>
        <div className="ind-stat-card">
          <span className="ind-stat-label">ABSENT DAYS</span>
          <span className="ind-stat-val">{stats.absent}</span>
        </div>
        <div className="ind-stat-card">
          <span className="ind-stat-label">LATE DAYS</span>
          <span className="ind-stat-val">{stats.late}</span>
        </div>
        <div className="ind-stat-card">
          <span className="ind-stat-label">HALF DAYS</span>
          <span className="ind-stat-val">{stats.halfDay}</span>
        </div>
        <div className="ind-stat-card">
          <span className="ind-stat-label">LEAVE DAYS</span>
          <span className="ind-stat-val">{stats.leave}</span>
        </div>
        <div className="ind-stat-card">
          <span className="ind-stat-label">WFH DAYS</span>
          <span className="ind-stat-val">{stats.wfh}</span>
        </div>
      </div>

      {/* Table or Calendar View */}
      {viewMode === "Table" ? (
        selectedMonth === "All" ? (
          <div className="ind-card ind-main-card">
            {/* Toolbar for All Months */}
            <div className="ind-table-toolbar">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
                  All Months Attendance Summary — Year {selectedYear}
                </h3>
              </div>
              <div className="ind-tabs">
                <button
                  type="button"
                  onClick={() => setTableAllMonthsTab("Summary")}
                  className={tableAllMonthsTab === "Summary" ? "ind-tab active" : "ind-tab"}
                >
                  Month-Wise List
                </button>
                <button
                  type="button"
                  onClick={() => setTableAllMonthsTab("Records")}
                  className={tableAllMonthsTab === "Records" ? "ind-tab active" : "ind-tab"}
                >
                  All Punch Records ({records.length})
                </button>
              </div>
            </div>

            {tableAllMonthsTab === "Summary" ? (
              <div style={{ overflowX: "auto" }}>
                <table className="ind-table">
                  <thead>
                    <tr>
                      <th>MONTH</th>
                      <th>TOTAL DAYS</th>
                      <th>PRESENT</th>
                      <th>ABSENT</th>
                      <th>LATE</th>
                      <th>HALF DAY</th>
                      <th>LEAVE</th>
                      <th>WFH</th>
                      <th>ATTENDANCE %</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthWiseSummary.map((m) => {
                      const isCurrentM = m.month === MONTHS[now.getMonth()] && String(m.year) === String(now.getFullYear());
                      return (
                        <tr key={m.month}>
                          <td className="ind-date">
                            <span style={{ fontWeight: 700, color: "#111827" }}>{m.month}</span>
                            {isCurrentM && (
                              <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, background: "#dbeafe", color: "#2563eb", padding: "2px 7px", borderRadius: 999 }}>
                                Current
                              </span>
                            )}
                          </td>
                          <td style={{ color: "#475569" }}>{m.totalDays} days</td>
                          <td>
                            <span className="ind-status" style={{ ...statusStyles.Present }}>
                              {m.present}
                            </span>
                          </td>
                          <td>
                            <span className="ind-status" style={{ ...statusStyles.Absent }}>
                              {m.absent}
                            </span>
                          </td>
                          <td>
                            <span className="ind-status" style={{ ...statusStyles.Late }}>
                              {m.late}
                            </span>
                          </td>
                          <td>
                            <span className="ind-status" style={{ ...statusStyles["Half Day"] }}>
                              {m.halfDay}
                            </span>
                          </td>
                          <td>
                            <span className="ind-status" style={{ ...statusStyles["On Leave"] }}>
                              {m.leave}
                            </span>
                          </td>
                          <td>
                            <span className="ind-status" style={{ ...statusStyles.WFH }}>
                              {m.wfh}
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: m.totalMarked > 0 ? "#111827" : "#94a3b8" }}>
                              {m.attendanceRate}
                            </strong>
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => setSelectedMonth(m.month)}
                              className="ind-btn-edit"
                              style={{ color: "#2563eb", borderColor: "#bfdbfe", background: "#eff6ff" }}
                            >
                              View Month →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
              <div style={{ overflowX: "auto" }}>
                <table className="ind-table">
                  <thead>
                    <tr>
                      <th>DATE</th>
                      <th>DAY</th>
                      <th>CHECK IN</th>
                      <th>CHECK OUT</th>
                      <th>BREAK</th>
                      <th>WORK HOURS</th>
                      <th>LATE</th>
                      <th>SHIFT</th>
                      <th>STATUS</th>
                      <th>REMARKS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: "center", color: "#6b7280", padding: "32px" }}>
                          No attendance records found for {selectedYear}.
                        </td>
                      </tr>
                    ) : (
                      paginatedRecords.map((r) => (
                        <tr key={r.key}>
                          <td className="ind-date">{r.date}</td>
                          <td style={{ color: "#374151" }}>{r.day}</td>
                          <td className="ind-time">{r.checkIn}</td>
                          <td className="ind-time">{r.checkOut}</td>
                          <td className="ind-time text-amber-600 font-medium">{r.breakDuration || "-"}</td>
                          <td className="ind-time">{r.workHours}</td>
                          <td className="ind-time text-rose-600 font-medium">{r.lateMinutes || "-"}</td>
                          <td style={{ color: "#374151" }}>{r.shift}</td>
                          <td>
                            <span className="ind-status" style={{ ...statusStyles[r.status] }}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ color: "#6b7280" }}>{r.remarks || "—"}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => setEditItem({
                                ...r,
                                isoDate: r.isoDate,
                                dayNum: r.dayNum,
                                checkIn: toTimeInputValue(r.rawCheckIn || r.checkIn),
                                checkOut: toTimeInputValue(r.rawCheckOut || r.checkOut),
                              })}
                              className="ind-btn-edit"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-slate-100 bg-white">
                <Pagination
                  total={records.length}
                  page={recPage}
                  pageSize={recPageSize}
                  pageSizeOptions={[10, 20, 50, 100]}
                  onPageSizeChange={(sz) => { setRecPageSize(sz); setRecPage(1); }}
                  onChange={setRecPage}
                />
              </div>
              </>
            )}
          </div>
        ) : (
          <div className="ind-card ind-main-card">
            <div className="ind-table-toolbar">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
                  Daily Attendance List — {selectedMonth} {selectedYear}
                </h3>
                {selectedMonth === MONTHS[now.getMonth()] && selectedYear === String(now.getFullYear()) && (
                  <span style={{ fontSize: 11, fontWeight: 700, background: "#dbeafe", color: "#2563eb", padding: "2px 8px", borderRadius: 999 }}>
                    Current Month
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedMonth("All")}
                className="ind-btn-edit"
                style={{ fontSize: 12 }}
              >
                ← View All Months
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="ind-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>DAY</th>
                    <th>CHECK IN</th>
                    <th>CHECK OUT</th>
                    <th>BREAK</th>
                    <th>WORK HOURS</th>
                    <th>LATE</th>
                    <th>SHIFT</th>
                    <th>STATUS</th>
                    <th>REMARKS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDaily.map((r) => {
                    const rowStyle = statusStyles[r.status] || { background: "#f8fafc", color: "#64748b", border: "#e2e8f0" };
                    return (
                      <tr key={r.key} style={r.isToday ? { background: "#f8fbff" } : {}}>
                        <td className="ind-date">
                          <span style={{ color: r.isSunday ? "#ef4444" : "#111827" }}>{r.date}</span>
                          {r.isToday && (
                            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, background: "#dbeafe", color: "#2563eb", padding: "1px 6px", borderRadius: 999 }}>
                              Today
                            </span>
                          )}
                        </td>
                        <td style={{ color: r.isSunday ? "#ef4444" : "#374151", fontWeight: r.isSunday ? 600 : 400 }}>{r.day}</td>
                        <td className="ind-time">{r.checkIn}</td>
                        <td className="ind-time">{r.checkOut}</td>
                        <td className="ind-time text-amber-600 font-medium">{r.breakDuration || "-"}</td>
                        <td className="ind-time">{r.workHours}</td>
                        <td className="ind-time text-rose-600 font-medium">{r.lateMinutes || "-"}</td>
                        <td style={{ color: "#374151" }}>{r.shift}</td>
                        <td>
                          <span className="ind-status" style={{ ...rowStyle }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ color: "#6b7280" }}>{r.remarks || "—"}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              if (r.record) {
                                setEditItem({
                                  ...r.record,
                                  isoDate: r.isoDate,
                                  date: r.date,
                                  dayNum: r.dayNum,
                                  checkIn: toTimeInputValue(r.record.rawCheckIn || r.record.checkIn),
                                  checkOut: toTimeInputValue(r.record.rawCheckOut || r.record.checkOut),
                                });
                              } else {
                                setEditItem({
                                  key: `new|${currentEmp.id}|${r.isoDate}`,
                                  recordId: undefined,
                                  employeeId: currentEmp.id,
                                  dayNum: r.dayNum,
                                  date: r.date,
                                  isoDate: r.isoDate,
                                  checkIn: r.status === "Absent" || r.status === "Week Off" ? "" : "09:30",
                                  checkOut: r.status === "Absent" || r.status === "Week Off" ? "" : "18:30",
                                  workHours: r.status === "Absent" || r.status === "Week Off" ? "—" : "09:00",
                                  shift: "General",
                                  status: r.status && r.status !== "Not Marked" && r.status !== "Week Off" ? r.status : "Present",
                                  remarks: "",
                                  isNew: true,
                                });
                              }
                            }}
                            className="ind-btn-edit"
                          >
                            {r.record ? "Edit" : "Mark"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 bg-white">
              <Pagination
                total={monthDailyRows.length}
                page={dailyPage}
                pageSize={dailyPageSize}
                pageSizeOptions={[10, 15, 31]}
                onPageSizeChange={(sz) => { setDailyPageSize(sz); setDailyPage(1); }}
                onChange={setDailyPage}
              />
            </div>
          </div>
        )
      ) : (
        <div className="ind-card ind-cal-card">
          <div className="ind-cal-toolbar">
            <div className="ind-cal-month-nav">
              <button
                type="button"
                className="ind-cal-nav-btn"
                onClick={handlePrevMonth}
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <h2 className="ind-cal-month-title">
                {selectedMonth === "All" ? `${MONTHS[now.getMonth()]} ${selectedYear} (Current)` : `${selectedMonth} ${selectedYear}`}
              </h2>
              <button
                type="button"
                className="ind-cal-nav-btn"
                onClick={handleNextMonth}
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="ind-cal-legend">
              <span className="ind-cal-legend-item">
                <span className="ind-cal-legend-dot" style={{ background: "#15803d" }} />
                Present
              </span>
              <span className="ind-cal-legend-item">
                <span className="ind-cal-legend-dot" style={{ background: "#b45309" }} />
                Late
              </span>
              <span className="ind-cal-legend-item">
                <span className="ind-cal-legend-dot" style={{ background: "#7e22ce" }} />
                Half Day
              </span>
              <span className="ind-cal-legend-item">
                <span className="ind-cal-legend-dot" style={{ background: "#dc2626" }} />
                Absent
              </span>
              <span className="ind-cal-legend-item">
                <span className="ind-cal-legend-dot" style={{ background: "#2563eb" }} />
                On Leave
              </span>
              <span className="ind-cal-legend-item">
                <span className="ind-cal-legend-dot" style={{ background: "#475569" }} />
                WFH
              </span>
              <span className="ind-cal-legend-item">
                <span className="ind-cal-legend-dot" style={{ background: "#94a3b8" }} />
                Week Off
              </span>
            </div>
          </div>

          <div className="ind-cal-grid">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, idx) => (
              <div key={d} className={`ind-cal-day-header ${idx === 6 ? "weekend" : ""}`}>
                {d}
              </div>
            ))}
            {calendarDays.map((cell) => {
              if (cell.isOtherMonth) {
                return (
                  <div key={cell.key} className="ind-cal-cell other-month">
                    <div className="ind-cal-cell-top">
                      <span className="ind-cal-day-num" style={{ color: "#94a3b8" }}>{cell.dayNum}</span>
                    </div>
                  </div>
                );
              }
              const currentStyle = statusStyles[cell.status] || { background: "#f8fafc", color: "#64748b", border: "#e2e8f0" };
              return (
                <div
                  key={cell.key}
                  className={`ind-cal-cell ${cell.isToday ? "today" : ""} ${cell.isSunday ? "sunday" : ""}`}
                  onClick={() => handleCellClick(cell)}
                  title={cell.status ? `${cell.formattedDate}: ${cell.status} (Click to edit)` : `${cell.formattedDate}: Click to mark attendance`}
                >
                  <div className="ind-cal-cell-top">
                    <span className="ind-cal-day-num" style={{ color: cell.isSunday ? "#ef4444" : "#1e293b" }}>
                      {cell.dayNum}
                    </span>
                    {cell.isToday && <span className="ind-cal-today-badge">Today</span>}
                  </div>

                  {cell.status ? (
                    <div>
                      <span className="ind-cal-badge" style={{ ...currentStyle }}>
                        {cell.status}
                      </span>
                      {cell.checkIn && cell.checkIn !== "—" && (
                        <div className="ind-cal-timing">
                          <span>{cell.checkIn}{cell.checkOut && cell.checkOut !== "—" ? ` - ${cell.checkOut}` : ""}</span>
                          {cell.workHours && cell.workHours !== "—" && (
                            <span className="ind-cal-hours">{cell.workHours}</span>
                          )}
                        </div>
                      )}
                      {cell.remarks && (
                        <div className="ind-cal-remarks" title={cell.remarks}>
                          {cell.remarks}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "auto" }}>
                      —
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      <Modal
        isOpen={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        title={`Edit Attendance — ${editItem?.date || ""}`}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setEditItem(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleEditSave}>
              Save Record
            </button>
          </>
        }
      >
        {editItem && (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Check In Time</label>
                <input
                  type="time"
                  className="form-input cursor-pointer font-mono"
                  value={toTimeInputValue(editItem.checkIn)}
                  onChange={(e) => setEditItem({ ...editItem, checkIn: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Check Out Time</label>
                <input
                  type="time"
                  className="form-input cursor-pointer font-mono"
                  value={toTimeInputValue(editItem.checkOut)}
                  onChange={(e) => setEditItem({ ...editItem, checkOut: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={editItem.status}
                  onChange={(e) => {
                    const nextStatus = e.target.value;
                    setEditItem({
                      ...editItem,
                      status: nextStatus,
                      checkIn: nextStatus === "Absent" ? "" : (editItem.checkIn || "09:30"),
                      checkOut: nextStatus === "Absent" ? "" : (editItem.checkOut || "18:30"),
                    });
                  }}
                >
                  <option>Present</option>
                  <option>Late</option>
                  <option>Absent</option>
                  <option>Half Day</option>
                  <option>WFH</option>
                  <option>On Leave</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Remarks</label>
                <input
                  className="form-input"
                  value={editItem.remarks || ""}
                  onChange={(e) => setEditItem({ ...editItem, remarks: e.target.value })}
                  placeholder="e.g. Grace 10 min / Sick leave"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* View Employee Profile Modal */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title={`Employee Profile — ${currentEmp.name}`}
        footer={
          <button type="button" className="btn-primary" onClick={() => setShowProfileModal(false)}>
            Close
          </button>
        }
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
          {currentEmp.id && <UserInitials name={currentEmp.name} className="w-[60px] h-[60px] text-lg" />}
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{currentEmp.name}</h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>{currentEmp.id} • {currentEmp.designation}</p>
          </div>
        </div>
        <div style={{ display: "grid", gap: 10, fontSize: 13.5, color: "#334155" }}>
          <div><strong>Department:</strong> {currentEmp.dept}</div>
          <div><strong>Reporting Manager:</strong> {currentEmp.manager}</div>
          <div><strong>Employment Status:</strong> {currentEmp.status}</div>
          <div><strong>Work Location:</strong> {currentEmp.location}</div>
        </div>
      </Modal>

      <style>{`
        .ind-att-page { background: #f8fafc; margin: -16px -24px -24px; padding: 18px 24px 28px; min-height: calc(100vh - 62px); }
        .ind-crumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #6b7a90; margin-bottom: 10px; }
        .ind-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .ind-title { margin: 0; font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
        .ind-sub { margin: 4px 0 0; font-size: 13px; color: #6b7280; }

        .ind-card { background: #fff; border: 1px solid #e8edf3; border-radius: 16px; box-shadow: 0 1px 3px rgba(16,24,40,0.03); }
        .ind-filter-card { border: none; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }

        .ind-select { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 32px 7px 14px; font-size: 13px; color: #374151; font-weight: 500; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230f172a' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 12px; min-width: 100px; }
        .ind-select:focus { border-color: #94a3b8; background-color: #fff; }
        .ind-select-emp { min-width: 210px; }

        .ind-tabs { display: inline-flex; align-items: center; gap: 3px; background: #f4f4f6; border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 4px; }
        .ind-tab { border: 1px solid transparent; border-radius: 999px; padding: 6px 16px; font-size: 12px; font-weight: 600; color: var(--muted); background: transparent; cursor: pointer; transition: all 0.15s ease; }
        .ind-tab.active { font-weight: 700; color: var(--primary); background: var(--card); border-color: var(--primary); box-shadow: 0 1px 2px rgba(31,107,255,0.15); }

        .ind-hero-card { padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .ind-hero-avatar { width: 44px; height: 44px; border-radius: 999px; object-fit: cover; }
        .ind-status-pill { display: inline-block; font-size: 11px; font-weight: 600; color: #15803d; background: #e6f4ea; border: 1px solid #a7f3d0; border-radius: 999px; padding: 2px 9px; }
        .ind-btn-view-emp { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 36px; padding: 0 16px; border-radius: var(--radius-lg, 12px); font-size: 13px; font-weight: 600; line-height: 1; white-space: nowrap; cursor: pointer; transition: all 0.15s ease; background: var(--card); color: var(--text); border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .ind-btn-view-emp:hover { background: var(--card-hover); color: var(--text); }

        .ind-stats-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
        .ind-stat-card { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; padding: 16px 14px; text-align: center; box-shadow: 0 1px 2px rgba(16,24,40,0.03); }
        .ind-stat-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #6b7280; text-transform: uppercase; }
        .ind-stat-val { display: block; font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.02em; margin-top: 6px; }

        .ind-main-card { overflow: hidden; }
        .ind-table { width: 100%; border-collapse: collapse; min-width: 800px; font-size: 13.5px; }
        .ind-table thead tr { background: #ffffff; border-bottom: 1px solid #e2e8f0; }
        .ind-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7b8aa0; padding: 14px 20px; white-space: nowrap; }
        .ind-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s ease; }
        .ind-table tbody tr:hover { background: #f8fafc; }
        .ind-table td { padding: 14px 20px; vertical-align: middle; }

        .ind-date { font-weight: 600; color: #111827; white-space: nowrap; }
        .ind-time { font-family: inherit; font-size: 13px; color: #374151; white-space: nowrap; }
        .ind-status { display: inline-block; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 3px 12px; border: 1px solid; white-space: nowrap; }

        .ind-btn-edit { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 10px; font-size: 12px; font-weight: 600; line-height: 1; white-space: nowrap; cursor: pointer; transition: all 0.15s ease; background: var(--card); color: var(--text); border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .ind-btn-edit:hover { background: var(--card-hover); color: var(--text); }
        .ind-btn-view-emp:active, .ind-btn-edit:active { transform: scale(0.99); }

        .ind-table-toolbar { padding: 14px 20px; border-bottom: 1px solid #eef2f6; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .ind-btn-current-month { display: inline-flex; align-items: center; justify-content: center; height: 33px; padding: 0 13px; border-radius: 10px; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
        .ind-btn-current-month:hover { background: #dbeafe; }

        .ind-cal-card { padding: 22px; }
        .ind-cal-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #eef2f6; }
        .ind-cal-month-nav { display: flex; align-items: center; gap: 12px; }
        .ind-cal-month-title { font-size: 19px; font-weight: 700; color: #0f172a; margin: 0; }
        .ind-cal-nav-btn { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9px; border: 1px solid #e2e8f0; background: #ffffff; color: #475569; cursor: pointer; transition: all 0.15s; }
        .ind-cal-nav-btn:hover { background: #f1f5f9; color: #0f172a; border-color: #cbd5e1; }
        .ind-cal-legend { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .ind-cal-legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: #475569; }
        .ind-cal-legend-dot { width: 8px; height: 8px; border-radius: 999px; }

        .ind-cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
        .ind-cal-day-header { text-align: center; font-size: 12px; font-weight: 700; color: #64748b; padding: 10px 0; text-transform: uppercase; letter-spacing: 0.04em; background: #f8fafc; border-radius: 8px; }
        .ind-cal-day-header.weekend { color: #ef4444; }

        .ind-cal-cell { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; min-height: 105px; cursor: pointer; transition: all 0.15s ease; display: flex; flex-direction: column; justify-content: space-between; position: relative; }
        .ind-cal-cell:hover { border-color: #93c5fd; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08); transform: translateY(-1px); }
        .ind-cal-cell.today { border: 2px solid #3b82f6; background: #f8fbff; }
        .ind-cal-cell.other-month { background: #fafbfc; border-color: #f1f5f9; opacity: 0.4; cursor: default; }
        .ind-cal-cell.other-month:hover { border-color: #f1f5f9; box-shadow: none; transform: none; }
        .ind-cal-cell.sunday { background: #fdfefe; }

        .ind-cal-cell-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .ind-cal-day-num { font-size: 13.5px; font-weight: 700; color: #1e293b; }
        .ind-cal-today-badge { font-size: 10px; font-weight: 700; color: #2563eb; background: #dbeafe; border-radius: 999px; padding: 1px 7px; text-transform: uppercase; letter-spacing: 0.03em; }

        .ind-cal-badge { display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; border-radius: 6px; padding: 2.5px 8px; border: 1px solid; white-space: nowrap; width: fit-content; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }

        .ind-cal-timing { margin-top: 6px; font-size: 11px; color: #64748b; font-weight: 500; display: flex; flex-direction: column; gap: 2px; }
        .ind-cal-hours { font-size: 10.5px; font-weight: 600; color: #475569; }
        .ind-cal-remarks { font-size: 10.5px; color: #94a3b8; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; margin-top: 2px; }

        @media (max-width: 1200px) {
          .ind-stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .ind-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ind-att-page { padding: 14px 14px 22px; }
        }
        @media (max-width: 1023px) {
          .ind-att-page { margin: -16px -20px -24px; }
        }
        @media (max-width: 767px) {
          .ind-att-page { margin: -12px -14px -20px; }
        }
        @media (max-width: 640px) {
          .ind-filter-card, .ind-hero-card { padding: 12px 14px; }
          .ind-hero-avatar { flex-shrink: 0; }
          .ind-tabs { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
          .ind-tab { flex-shrink: 0; white-space: nowrap; }
          .ind-cal-grid { gap: 4px; }
          .ind-cal-cell { min-height: 65px; padding: 6px; border-radius: 8px; }
          .ind-cal-day-num { font-size: 11.5px; }
          .ind-cal-badge { font-size: 9.5px; padding: 1px 5px; }
          .ind-cal-timing { display: none; }
        }
      `}</style>
    </div>
  );
}
