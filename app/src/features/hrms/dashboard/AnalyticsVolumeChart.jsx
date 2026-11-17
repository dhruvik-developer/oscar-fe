import { useState, useMemo } from "react";
import { FileSpreadsheet, Download, ChevronDown } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";

const TABS = [
  "Employee",
  "Attendance",
  "Leave",
  "Payroll",
  "Performance",
  "Recruitment",
  "Asset",
  "Department",
];

const CURRENT_YEAR = new Date().getFullYear();

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DATE_RANGE_OPTIONS = [
  `Jan ${CURRENT_YEAR} - Dec ${CURRENT_YEAR} (Annual)`,
  `H1 ${CURRENT_YEAR} (Jan - Jun)`,
  `H2 ${CURRENT_YEAR} (Jul - Dec)`,
  `Q1 ${CURRENT_YEAR} (Jan - Mar)`,
  `Q2 ${CURRENT_YEAR} (Apr - Jun)`,
  `Q3 ${CURRENT_YEAR} (Jul - Sep)`,
  `Q4 ${CURRENT_YEAR} (Oct - Dec)`,
  `Q3 - Q4 ${CURRENT_YEAR}`,
];

const DATE_RANGE_MAP = {
  [`Jan ${CURRENT_YEAR} - Dec ${CURRENT_YEAR} (Annual)`]: [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ],
  [`H1 ${CURRENT_YEAR} (Jan - Jun)`]: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  [`H2 ${CURRENT_YEAR} (Jul - Dec)`]: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  [`Q1 ${CURRENT_YEAR} (Jan - Mar)`]: ["Jan", "Feb", "Mar"],
  [`Q2 ${CURRENT_YEAR} (Apr - Jun)`]: ["Apr", "May", "Jun"],
  [`Q3 ${CURRENT_YEAR} (Jul - Sep)`]: ["Jul", "Aug", "Sep"],
  [`Q4 ${CURRENT_YEAR} (Oct - Dec)`]: ["Oct", "Nov", "Dec"],
  [`Q3 - Q4 ${CURRENT_YEAR}`]: ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

const TAB_CONFIG = {
  Employee: {
    yAxisPrefix: "Y-Axis: Total Workforce Volume",
    seriesNames: ["Full Time", "Contract", "Interns"],
  },
  Attendance: {
    yAxisPrefix: "Y-Axis: Daily Attendance Headcount",
    seriesNames: ["Present", "On Leave / WFH", "Half Day / Late"],
  },
  Leave: {
    yAxisPrefix: "Y-Axis: Total Leave Applications",
    seriesNames: ["Paid Leave", "Unpaid Leave", "Other Requests"],
  },
  Payroll: {
    yAxisPrefix: "Y-Axis: Gross Disbursement (in ₹k)",
    seriesNames: ["Salaries", "Allowances", "Overtime / Additional"],
  },
  Performance: {
    yAxisPrefix: "Y-Axis: Completed Review Cycles",
    seriesNames: ["Exceeds", "Meets Expectations", "Needs Improvement"],
  },
  Recruitment: {
    yAxisPrefix: "Y-Axis: Candidate Pipeline",
    seriesNames: ["Applied", "Interview", "Hired / Offers"],
  },
  Asset: {
    yAxisPrefix: "Y-Axis: Total Active Assets Allocated",
    seriesNames: ["Laptops", "Monitors & Periph", "Other Devices"],
  },
  Department: {
    yAxisPrefix: "Y-Axis: Headcount by Division",
    seriesNames: ["HR", "General", "Operations"],
  },
};

export default function AnalyticsVolumeChart({ serverAnalytics = null, serverDepartments = [] }) {
  const showToast = useAppStore((s) => s.showToast || s.setToast);
  const employees = useAppStore((s) => s.employees || []);
  const leaves = useAppStore((s) => s.leaves || []);
  const attendance = useAppStore((s) => s.attendance || []);

  const [activeTab, setActiveTab] = useState("Employee");
  const [department, setDepartment] = useState("All Departments");
  const [dateRange, setDateRange] = useState(DATE_RANGE_OPTIONS[0]);
  const [selectedMonth, setSelectedMonth] = useState(() => MONTHS[new Date().getMonth()] || "Nov");
  const [hoveredData, setHoveredData] = useState(null);

  // Available real departments from server & live store
  const availableDepartments = useMemo(() => {
    const list = new Set();
    (serverDepartments || []).forEach((d) => {
      const name = typeof d === "string" ? d : d?.name;
      if (name) list.add(name);
    });
    (employees || []).forEach((e) => {
      const dName = typeof e.department === "string" ? e.department : e.department?.name;
      if (dName) list.add(dName);
    });
    const arr = Array.from(list).filter(Boolean).sort();
    return arr.length > 0 ? arr : ["HR"];
  }, [serverDepartments, employees]);

  // Series names (customized for Department tab)
  const tabConfig = TAB_CONFIG[activeTab] || TAB_CONFIG.Employee;
  const seriesNames = useMemo(() => {
    if (activeTab === "Department") {
      if (serverAnalytics?.departmentSeries && Array.isArray(serverAnalytics.departmentSeries) && serverAnalytics.departmentSeries.length > 0) {
        return serverAnalytics.departmentSeries;
      }
      return availableDepartments.slice(0, 3);
    }
    return tabConfig.seriesNames;
  }, [activeTab, serverAnalytics, availableDepartments, tabConfig]);

  // Generate processed months data from real live data or serverAnalytics
  const processedMonths = useMemo(() => {
    // If "All Departments" and backend provided serverAnalytics for this tab, use it directly
    if (department === "All Departments" && serverAnalytics?.[activeTab] && Array.isArray(serverAnalytics[activeTab])) {
      return serverAnalytics[activeTab];
    }

    // Otherwise calculate dynamically from current client store data
    const currentYear = CURRENT_YEAR;
    const targetDept = department;

    const filteredEmployees = targetDept === "All Departments"
      ? employees
      : employees.filter((e) => {
          const dName = typeof e.department === "string" ? e.department : e.department?.name;
          return dName === targetDept;
        });

    return MONTHS.map((monthName, mIdx) => {
      const monthNum = mIdx + 1;
      const endDay = new Date(currentYear, monthNum, 0).getDate();
      const monthEndDate = new Date(currentYear, mIdx, endDay, 23, 59, 59);

      if (activeTab === "Employee") {
        let ft = 0;
        let ct = 0;
        let intern = 0;
        filteredEmployees.forEach((e) => {
          const jStr = e.joiningDate || e.joining_date || e.createdAt || e.created_at;
          const jDate = jStr ? new Date(jStr) : null;
          if (!jDate || jDate <= monthEndDate) {
            const lStr = e.lastWorkingDay || e.last_working_day;
            if (lStr && new Date(lStr) < new Date(currentYear, mIdx, 1)) return;
            const et = String(e.employmentType || e.employment_type || "Full Time").toLowerCase();
            if (et.includes("contract")) ct++;
            else if (et.includes("intern")) intern++;
            else ft++;
          }
        });
        return { month: monthName, s1: ft, s2: ct, s3: intern, total: ft + ct + intern };
      }

      if (activeTab === "Attendance") {
        const mAtt = attendance.filter((a) => {
          const d = a.workDate || a.work_date || a.date;
          if (!d) return false;
          const dt = new Date(d);
          if (dt.getFullYear() !== currentYear || dt.getMonth() !== mIdx) return false;
          if (targetDept !== "All Departments") {
            const emp = employees.find((x) => x.id === a.employeeId || x.id === a.employee_id);
            const dName = typeof emp?.department === "string" ? emp.department : emp?.department?.name;
            if (dName !== targetDept) return false;
          }
          return true;
        });
        const s1 = mAtt.filter((a) => a.status === "Present").length;
        const s2 = mAtt.filter((a) => a.status === "On Leave" || a.status === "WFH").length;
        const s3 = mAtt.filter((a) => ["Half Day", "Late", "Grace"].includes(a.status)).length;
        return { month: monthName, s1, s2, s3, total: s1 + s2 + s3 };
      }

      if (activeTab === "Leave") {
        const mL = leaves.filter((l) => {
          const d = l.from || l.from_date || l.startDate || l.start_date;
          if (!d) return false;
          const dt = new Date(d);
          if (dt.getFullYear() !== currentYear || dt.getMonth() !== mIdx) return false;
          if (targetDept !== "All Departments") {
            const emp = employees.find((x) => x.id === l.employeeId || x.id === l.employee_id);
            const dName = typeof emp?.department === "string" ? emp.department : emp?.department?.name;
            if (dName !== targetDept) return false;
          }
          return true;
        });
        const s1 = mL.filter((l) => l.isPaid !== false).length;
        const s2 = mL.filter((l) => l.isPaid === false).length;
        const s3 = 0;
        return { month: monthName, s1, s2, s3, total: s1 + s2 + s3 };
      }

      // Fallback to serverAnalytics if present
      if (serverAnalytics?.[activeTab]?.[mIdx]) {
        return serverAnalytics[activeTab][mIdx];
      }

      return { month: monthName, s1: 0, s2: 0, s3: 0, total: 0 };
    });
  }, [serverAnalytics, activeTab, department, employees, attendance, leaves]);

  // Filter months according to selected Date Range
  const visibleMonthsData = useMemo(() => {
    const allowed = DATE_RANGE_MAP[dateRange] || DATE_RANGE_MAP[DATE_RANGE_OPTIONS[0]];
    return processedMonths.filter((m) => allowed.includes(m.month));
  }, [processedMonths, dateRange]);

  // Ensure selectedMonth stays valid when date range changes
  const activeSelectedMonth = useMemo(() => {
    const hasMonth = visibleMonthsData.some((m) => m.month === selectedMonth);
    if (hasMonth) return selectedMonth;
    return visibleMonthsData[visibleMonthsData.length - 1]?.month || "Nov";
  }, [visibleMonthsData, selectedMonth]);

  // Dynamic ScaleMax based on real maximum value in visible range
  const dynamicScaleMax = useMemo(() => {
    const maxVal = Math.max(
      ...visibleMonthsData.map((m) => Math.max(m.s1, m.s2, m.s3, m.total, 0)),
      0
    );
    if (maxVal <= 5) return 5;
    if (maxVal <= 10) return 10;
    if (maxVal <= 25) return 25;
    if (maxVal <= 50) return 50;
    if (maxVal <= 100) return 100;
    if (maxVal <= 250) return 250;
    if (maxVal <= 500) return 500;
    if (maxVal <= 1000) return 1000;
    return Math.ceil((maxVal * 1.25) / 100) * 100;
  }, [visibleMonthsData]);

  // Calculate Net Growth dynamically for the visible range
  const growthInfo = useMemo(() => {
    const nonZero = visibleMonthsData.filter((m) => m.total > 0);
    if (nonZero.length < 2) return "+0.0%";
    const first = nonZero[0].total;
    const last = nonZero[nonZero.length - 1].total;
    if (!first) return "+0.0%";
    const diff = ((last - first) / first) * 100;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${diff.toFixed(1)}%`;
  }, [visibleMonthsData]);

  // Data for the currently selected/active month
  const selectedMonthData = useMemo(() => {
    return visibleMonthsData.find((m) => m.month === activeSelectedMonth) || visibleMonthsData[0];
  }, [visibleMonthsData, activeSelectedMonth]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = `Month,${seriesNames.join(",")},Total\n`;
    const rows = visibleMonthsData
      .map((m) => `${m.month},${m.s1},${m.s2},${m.s3},${m.total}`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HRMS_${activeTab}_Volume_${department.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    if (showToast) showToast(`Exported ${activeTab} CSV data for ${department}`);
  };

  // Export Excel
  const handleExportExcel = () => {
    const headers = `Month\t${seriesNames.join("\t")}\tTotal\n`;
    const rows = visibleMonthsData
      .map((m) => `${m.month}\t${m.s1}\t${m.s2}\t${m.s3}\t${m.total}`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HRMS_${activeTab}_Volume_${department.replace(/\s+/g, "_")}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    if (showToast) showToast(`Exported ${activeTab} Excel file for ${department}`);
  };

  const currentMonthIdx = new Date().getMonth();

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] mb-5 overflow-hidden">
      {/* ── Top Tabs & Export Bar ── */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#e5e7eb] px-5 pt-3 gap-2">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar scrollbar-none max-w-full lg:max-w-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setHoveredData(null);
                }}
                className={`pb-3 text-[13.5px] font-semibold whitespace-nowrap shrink-0 lg:shrink relative transition-colors ${
                  isActive
                    ? "text-[#0f172a]"
                    : "text-[#64748b] hover:text-[#0f172a]"
                }`}
              >
                {tab}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#0f172a] rounded-t" />
                )}
              </button>
            );
          })}
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 pb-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[#334155] bg-white border border-[#cbd5e1] rounded-lg hover:bg-[#f8fafc] hover:border-[#94a3b8] transition cursor-pointer"
            title="Export CSV"
          >
            <Download size={13} className="text-[#64748b]" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[#334155] bg-white border border-[#cbd5e1] rounded-lg hover:bg-[#f8fafc] hover:border-[#94a3b8] transition cursor-pointer"
            title="Export Excel"
          >
            <FileSpreadsheet size={13} className="text-[#15803d]" />
            Excel
          </button>
        </div>
      </div>

      {/* ── Filters & Legend Row ── */}
      <div className="p-5 pb-2 flex flex-wrap items-center justify-between gap-4">
        {/* Left Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Select */}
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="text-[#64748b] font-medium">Department:</span>
            <div className="relative">
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  if (showToast) showToast(`Filtered by ${e.target.value}`);
                }}
                className="appearance-none pl-3 pr-8 py-1.5 bg-white border border-[#cbd5e1] rounded-xl text-[12.5px] font-medium text-[#1e293b] focus:outline-none focus:border-[#1F2E4A] cursor-pointer hover:border-[#94a3b8]"
              >
                <option value="All Departments">All Departments</option>
                {availableDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b]"
              />
            </div>
          </div>

          {/* Date Range Select */}
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="text-[#64748b] font-medium">Date Range:</span>
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value);
                  if (showToast) showToast(`Date range: ${e.target.value}`);
                }}
                className="appearance-none pl-3 pr-8 py-1.5 bg-white border border-[#cbd5e1] rounded-xl text-[12.5px] font-medium text-[#1e293b] focus:outline-none focus:border-[#1F2E4A] cursor-pointer hover:border-[#94a3b8]"
              >
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b]"
              />
            </div>
          </div>
        </div>

        {/* Right Legend */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-5 gap-y-1.5 text-[12px] text-[#475569]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#1F2E4A]" />
            <span className="font-medium">{seriesNames[0] || "Series 1"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#64748B]" />
            <span className="font-medium">{seriesNames[1] || "Series 2"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#CBD5E1]" />
            <span className="font-medium">{seriesNames[2] || "Series 3"}</span>
          </div>
        </div>
      </div>

      {/* ── Chart Canvas ── */}
      <div className="px-5 pt-3 pb-2">
        <div className="relative h-[240px] w-full flex items-end justify-between gap-1 sm:gap-2 pt-6">
          {/* Subtle horizontal grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
            <div className="border-b border-dashed border-[#cbd5e1] w-full" />
            <div className="border-b border-dashed border-[#cbd5e1] w-full" />
            <div className="border-b border-dashed border-[#cbd5e1] w-full" />
            <div className="border-b border-dashed border-[#cbd5e1] w-full" />
          </div>

          {/* Month Columns */}
          {visibleMonthsData.map((item, idx) => {
            const isSelected = activeSelectedMonth === item.month;
            const mIdxInYear = MONTHS.indexOf(item.month);
            const isFuture = mIdxInYear > currentMonthIdx;

            // Height proportions
            const h1 = item.s1 > 0 ? Math.max(6, Math.min(100, Math.round((item.s1 / dynamicScaleMax) * 100))) : 0;
            const h2 = item.s2 > 0 ? Math.max(6, Math.min(100, Math.round((item.s2 / dynamicScaleMax) * 100))) : 0;
            const h3 = item.s3 > 0 ? Math.max(6, Math.min(100, Math.round((item.s3 / dynamicScaleMax) * 100))) : 0;

            return (
              <div
                key={item.month}
                onClick={() => setSelectedMonth(item.month)}
                onMouseEnter={() => setHoveredData({ ...item, idx })}
                onMouseLeave={() => setHoveredData(null)}
                className={`relative flex-1 flex flex-col items-center h-full justify-end cursor-pointer group px-0.5 rounded-lg transition-all ${
                  isSelected ? "bg-[#f8fafc]/90 ring-1 ring-[#e2e8f0]" : "hover:bg-[#f8fafc]/60"
                }`}
                title={`Click to focus ${item.month}`}
              >
                {/* Hover Tooltip */}
                {hoveredData && hoveredData.month === item.month && (
                  <div className="absolute -top-20 z-30 bg-[#0f172a] text-white text-[11px] rounded-lg px-3 py-2 shadow-xl whitespace-nowrap flex flex-col pointer-events-none transition-all">
                    <div className="flex items-center justify-between gap-4 font-bold border-b border-white/20 pb-1 mb-1">
                      <span>{item.month} {CURRENT_YEAR}</span>
                      <span className="text-[#94a3b8] font-normal">{department}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-[#e2e8f0]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#38bdf8]" />
                        {seriesNames[0] || "Series 1"}:
                      </span>
                      <b>{item.s1.toLocaleString()}</b>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-[#cbd5e1]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#94a3b8]" />
                        {seriesNames[1] || "Series 2"}:
                      </span>
                      <b>{item.s2.toLocaleString()}</b>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-[#94a3b8]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#e2e8f0]" />
                        {seriesNames[2] || "Series 3"}:
                      </span>
                      <b>{item.s3.toLocaleString()}</b>
                    </div>
                    <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between font-semibold text-white">
                      <span>Total:</span>
                      <span>{item.total.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Grouped 3 Bars */}
                <div className="w-full flex items-end justify-center gap-[2px] sm:gap-[3px] h-[190px]">
                  {/* Bar 1: Primary Series */}
                  <div
                    style={{ height: `${h1}%` }}
                    className={`w-[6px] sm:w-[9px] md:w-[11px] rounded-t-xs transition-all duration-300 ${
                      h1 === 0
                        ? "bg-transparent"
                        : isFuture
                        ? "bg-[#64748B]/60 border border-dashed border-[#475569]"
                        : isSelected
                        ? "bg-[#1F2E4A] ring-1 ring-[#1F2E4A]"
                        : "bg-[#1F2E4A] group-hover:brightness-110"
                    }`}
                  />
                  {/* Bar 2: Secondary Series */}
                  <div
                    style={{ height: `${h2}%` }}
                    className={`w-[6px] sm:w-[9px] md:w-[11px] rounded-t-xs transition-all duration-300 ${
                      h2 === 0
                        ? "bg-transparent"
                        : isFuture
                        ? "bg-[#94A3B8]/60 border border-dashed border-[#64748b]"
                        : "bg-[#64748B] group-hover:brightness-110"
                    }`}
                  />
                  {/* Bar 3: Tertiary Series */}
                  <div
                    style={{ height: `${h3}%` }}
                    className={`w-[6px] sm:w-[9px] md:w-[11px] rounded-t-xs transition-all duration-300 ${
                      h3 === 0
                        ? "bg-transparent"
                        : isFuture
                        ? "bg-[#E2E8F0]/80 border border-dashed border-[#cbd5e1]"
                        : "bg-[#CBD5E1] group-hover:brightness-105"
                    }`}
                  />
                </div>

                {/* Month Label */}
                <span
                  className={`mt-2 text-[11.5px] tracking-tight ${
                    isSelected
                      ? "font-extrabold text-[#0f172a]"
                      : isFuture
                      ? "font-normal text-[#94a3b8]"
                      : "font-medium text-[#64748b]"
                  }`}
                >
                  {item.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer Info ── */}
      <div className="px-5 py-3 border-t border-[#f1f5f9] flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#64748b]">
        <div>
          {tabConfig.yAxisPrefix} (scale: 0 - {dynamicScaleMax.toLocaleString()})
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {selectedMonthData && (
            <span className="text-[#334155]">
              Focused: <strong className="text-[#0f172a]">{selectedMonthData.month}</strong> ({selectedMonthData.total.toLocaleString()} total)
            </span>
          )}
          <div className="font-semibold text-[#0f172a] flex items-center gap-1">
            <span>Overall Net Growth:</span>
            <span className="text-[#15803d] font-bold bg-[#dcfce7] px-2 py-0.5 rounded-full">
              {growthInfo} YTD
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
