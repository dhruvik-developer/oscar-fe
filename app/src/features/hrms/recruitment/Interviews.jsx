import { useState, useMemo, useEffect } from "react";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { useAppStore } from "../../../stores/appStore";
import { useNavigate, useLocation } from "react-router-dom";
import PageHeader from "../../../components/ui/PageHeader";
import { DataTable } from "../../../components/hrms/DataTable";
import { FilterBar } from "../../../components/hrms/FilterBar";
import { Modal } from "../../../components/hrms/Modal";
import { Button } from "../../../components/hrms/Button";
import { StatusBadge } from "../../../components/hrms/StatusBadge";
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  Phone,
  CheckCircle2,
  XCircle,
  Plus,
  List,
  CalendarDays,
  ExternalLink,
  Eye,
  HelpCircle,
  Users,
  AlertCircle,
  Search,
  X,
} from "lucide-react";
import {
  generateMonthGrid,
  formatHumanDate,
  formatShortDate,
} from "../organization/calendarUtils";
import { MONTH_NAMES, DAYS_OF_WEEK } from "../organization/calendarConfig";

const INTERVIEW_CATEGORIES = {
  "Technical Interview": {
    label: "Technical Interview",
    shortLabel: "Technical",
    badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    dotClass: "bg-blue-500",
  },
  "HR Interview": {
    label: "HR Interview",
    shortLabel: "HR Round",
    badgeClass: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    dotClass: "bg-purple-500",
  },
  "Manager Interview": {
    label: "Manager Interview",
    shortLabel: "Manager",
    badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    dotClass: "bg-amber-500",
  },
  "Final Interview": {
    label: "Final Interview",
    shortLabel: "Final",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    dotClass: "bg-emerald-500",
  },
  Assessment: {
    label: "Assessment / Coding",
    shortLabel: "Assessment",
    badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    dotClass: "bg-rose-500",
  },
};

const MONTH_SHORT_MAP = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function toDateKey(dateStr) {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, "0");
    const mon = MONTH_SHORT_MAP[parts[1].toLowerCase().slice(0, 3)] || "09";
    const yr = parts[2];
    return `${yr}-${mon}-${day}`;
  }
  return "";
}

function toHumanDate(dateKey) {
  if (!dateKey) return "";
  const [y, m, d] = dateKey.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monName = monthNames[parseInt(m, 10) - 1] || "Sep";
  return `${d} ${monName} ${y}`;
}

function getCategory(type) {
  return (
    INTERVIEW_CATEGORIES[type] || {
      label: type || "Interview",
      shortLabel: type || "Round",
      badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      dotClass: "bg-blue-500",
    }
  );
}

export default function Interviews() {
  const { interviews, addInterview, candidates, jobs } = useRecruitmentStore();
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("List");
  const [typeFilter, setTypeFilter] = useState("All");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [activeYear, setActiveYear] = useState(2026);
  const [activeMonth, setActiveMonth] = useState(8); // 8 = September
  const [selectedDate, setSelectedDate] = useState("2026-09-09");
  const [hoveredCellDate, setHoveredCellDate] = useState(null);

  useEffect(() => {
    if (location.state?.openSchedule) {
      setDrawerOpen(true);
    }
  }, [location.state]);

  const [form, setForm] = useState({
    candidateId: "CAND-001",
    job: "Senior Backend Developer",
    type: "Technical Interview",
    interviewer: "Rahul Mehta",
    date: "10 Sep 2026",
    start: "10:30 AM",
    end: "11:30 AM",
    mode: "Video Call",
    meetingLink: "https://meet.google.com/abc",
    notes: "",
  });

  const filtered = useMemo(() => {
    return interviews.filter((i) => {
      if (
        search &&
        !`${i.candidateName} ${i.job} ${i.interviewer}`.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (typeFilter !== "All" && i.type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [interviews, search, typeFilter]);

  const scheduledCount = interviews.filter((i) => i.status === "Scheduled").length;
  const completedCount = interviews.filter((i) => i.status === "Completed").length;
  const cancelledCount = interviews.filter((i) => i.status === "Cancelled").length;

  const handleToday = () => {
    setActiveYear(2026);
    setActiveMonth(8); // September 2026
    setSelectedDate("2026-09-09");
    showToast("Jumped to September 2026");
  };

  const monthCells = useMemo(() => {
    return generateMonthGrid(activeYear, activeMonth);
  }, [activeYear, activeMonth]);

  const selectedDateInterviews = useMemo(() => {
    return filtered.filter((iv) => toDateKey(iv.date) === selectedDate);
  }, [filtered, selectedDate]);

  const currentMonthInterviewCount = useMemo(() => {
    const targetMonthPrefix = `${activeYear}-${String(activeMonth + 1).padStart(2, "0")}`;
    return filtered.filter((iv) => toDateKey(iv.date).startsWith(targetMonthPrefix)).length;
  }, [filtered, activeYear, activeMonth]);

  const upcomingInterviews = useMemo(() => {
    return interviews
      .filter((iv) => iv.status === "Scheduled")
      .slice(0, 3);
  }, [interviews]);

  function schedule() {
    if (!form.candidateId) {
      showToast("Candidate required");
      return;
    }
    const cand = candidates.find((c) => c.id === form.candidateId);
    addInterview({
      id: `INT-${Date.now()}`,
      candidateId: form.candidateId,
      candidateName: cand?.name || "Candidate",
      avatar: cand?.avatar || "https://i.pravatar.cc/100?img=15",
      job: form.job,
      type: form.type,
      date: form.date,
      start: form.start,
      end: form.end,
      duration: "60m",
      interviewer: form.interviewer,
      mode: form.mode,
      location: form.mode === "Video Call" ? form.meetingLink : "Office",
      status: "Scheduled",
      meetingLink: form.meetingLink,
    });
    showToast("Interview scheduled successfully.");
    setDrawerOpen(false);
  }

  const cols = [
    {
      key: "candidateName",
      header: "Candidate",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <img
            src={r.avatar}
            alt={r.candidateName}
            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
          />
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-100 block text-[13px]">
              {r.candidateName}
            </span>
            <span className="text-[11px] text-muted block truncate max-w-[180px]">{r.job}</span>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Interview Type",
      render: (r) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
          {r.type}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date & Time",
      sortable: true,
      render: (r) => (
        <div>
          <div className="flex items-center gap-1.5 font-medium text-[12.5px] text-slate-800 dark:text-slate-200">
            <Calendar size={13} className="text-slate-400" />
            <span>{r.date}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted mt-0.5">
            <Clock size={12} className="text-slate-400" />
            <span>
              {r.start} - {r.end} ({r.duration || "60m"})
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "interviewer",
      header: "Interviewer",
      render: (r) => (
        <div className="flex items-center gap-1.5 text-[12.5px] text-slate-700 dark:text-slate-300 font-medium">
          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 grid place-items-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
            {r.interviewer.charAt(0)}
          </div>
          <span>{r.interviewer}</span>
        </div>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      render: (r) => {
        const isVideo = r.mode?.toLowerCase().includes("video") || r.mode?.toLowerCase().includes("meet");
        const isPhone = r.mode?.toLowerCase().includes("phone");
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
              isVideo
                ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                : isPhone
                ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
                : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
            }`}
          >
            {isVideo ? <Video size={11} /> : isPhone ? <Phone size={11} /> : <MapPin size={11} />}
            <span>{r.mode}</span>
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const statusMap = {
          Scheduled: "Pending",
          Completed: "Active",
          Cancelled: "Cancelled",
        };
        return <StatusBadge status={statusMap[r.status] || r.status} label={r.status} />;
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(`/hrms/recruitment/interviews/${r.id}`)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-medium text-slate-700 dark:text-slate-200 hover:text-navy dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <Eye size={12} />
            <span>View</span>
          </button>
          {r.meetingLink && (
            <button
              onClick={() => window.open(r.meetingLink || "#", "_blank")}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg transition"
            >
              <ExternalLink size={12} />
              <span>Join</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <PageHeader
        title="Interview Schedules"
        subtitle="Manage panel discussions, technical assessments, and interview statuses."
        breadcrumb={[
          { label: "HRMS", path: "/hrms" },
          { label: "Recruitment", path: "/hrms/recruitment" },
          { label: "Interviews" },
        ]}
        actions={
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-muted hover:text-text hover:bg-soft text-xs font-semibold transition cursor-pointer shadow-2xs whitespace-nowrap"
            >
              <HelpCircle size={14} />
              <span>Guide</span>
            </button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setDrawerOpen(true)}
              className="shadow-xs whitespace-nowrap font-medium"
            >
              Schedule Interview
            </Button>
          </div>
        }
      />

      {/* Metric Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {[
          {
            label: "Upcoming Interviews",
            count: scheduledCount,
            sub: "Scheduled sessions",
            icon: Clock,
            color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200/60",
          },
          {
            label: "Total Sessions",
            count: interviews.length,
            sub: "All pipeline rounds",
            icon: Calendar,
            color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200/60",
          },
          {
            label: "Completed",
            count: completedCount,
            sub: "Evaluated & scored",
            icon: CheckCircle2,
            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60",
          },
          {
            label: "Cancelled / Missed",
            count: cancelledCount,
            sub: "Rescheduled or closed",
            icon: XCircle,
            color: "text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-200/60",
          },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="bg-card border border-border rounded-2xl p-4 shadow-2xs flex items-center justify-between"
            >
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  {m.label}
                </div>
                <div className="text-2xl font-black text-text mt-1">
                  {m.count}
                </div>
                <div className="text-[11.5px] text-muted font-medium mt-0.5">
                  {m.sub}
                </div>
              </div>
              <div className={`p-2.5 rounded-xl border ${m.color}`}>
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Unified View Switcher & Filter Bar */}
      <div className="bg-card border border-border rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* View Switcher sized matching filter inputs (h-9 / 36px) */}
        <div className="h-9 inline-flex p-0.5 bg-soft border border-border rounded-xl items-center">
          <button
            type="button"
            onClick={() => setView("List")}
            className={`h-full px-3.5 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium transition cursor-pointer select-none ${
              view === "List"
                ? "bg-card text-primary font-semibold shadow-xs border border-border/70"
                : "text-muted hover:text-text hover:bg-card/40"
            }`}
          >
            <List size={15} />
            <span>List View</span>
          </button>
          <button
            type="button"
            onClick={() => setView("Calendar")}
            className={`h-full px-3.5 inline-flex items-center gap-1.5 rounded-lg text-[13px] font-medium transition cursor-pointer select-none ${
              view === "Calendar"
                ? "bg-card text-primary font-semibold shadow-xs border border-border/70"
                : "text-muted hover:text-text hover:bg-card/40"
            }`}
          >
            <CalendarDays size={15} />
            <span>Calendar View</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Input */}
          <div className="relative w-full sm:w-auto min-w-[200px] max-w-full sm:max-w-[260px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search || ""}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate, role..."
              className="w-full h-9 pl-9 pr-8 bg-soft border border-border rounded-xl text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-primary focus:bg-card transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-card-hover grid place-items-center text-muted cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Type Select */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 pl-3.5 pr-8 bg-soft border border-border rounded-xl text-[13px] text-text font-medium cursor-pointer focus:outline-none focus:border-primary focus:bg-card transition"
          >
            <option value="All">All Types</option>
            <option value="Technical Interview">Technical Interview</option>
            <option value="HR Interview">HR Interview</option>
            <option value="Manager Interview">Manager Interview</option>
            <option value="Final Interview">Final Interview</option>
          </select>

          {/* Clear Filters Button */}
          {(search || typeFilter !== "All") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter("All");
              }}
              className="h-9 px-3.5 bg-card border border-border rounded-xl text-[12.5px] font-medium text-text-secondary hover:bg-soft transition shadow-2xs cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {view === "List" ? (
        <DataTable
          columns={cols}
          data={filtered}
          emptyTitle="No interviews found"
          emptyDesc="Schedule an interview to start evaluation rounds."
          emptyAction={
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setDrawerOpen(true)}>
              Schedule Interview
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 8 Cols: Main Calendar Canvas */}
          <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              {/* Calendar Controls & Month/Year Title */}
              <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-border gap-3">
                <div className="flex items-center gap-3">
                  {/* Month & Year Selection */}
                  <div className="flex items-center gap-2">
                    <select
                      value={activeMonth}
                      onChange={(e) => setActiveMonth(Number(e.target.value))}
                      className="font-bold text-[18px] text-text bg-transparent hover:bg-soft rounded-lg px-2 py-0.5 border border-transparent hover:border-border focus:outline-none focus:border-primary cursor-pointer transition"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx}>
                          {m}
                        </option>
                      ))}
                    </select>

                    <select
                      value={activeYear}
                      onChange={(e) => setActiveYear(Number(e.target.value))}
                      className="font-bold text-[18px] text-text bg-transparent hover:bg-soft rounded-lg px-2 py-0.5 border border-transparent hover:border-border focus:outline-none focus:border-primary cursor-pointer transition"
                    >
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="px-2.5 py-0.5 bg-soft border border-border rounded-full text-[11.5px] text-muted font-medium">
                    {currentMonthInterviewCount} {currentMonthInterviewCount === 1 ? "Session" : "Sessions"}
                  </span>
                </div>

                {/* Today Button */}
                <div>
                  <button
                    type="button"
                    onClick={handleToday}
                    className="h-8 px-3.5 rounded-lg border border-border text-[12px] font-medium hover:bg-soft text-text transition cursor-pointer shadow-2xs"
                    title="Visit Today"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* Days Header */}
              <div className="grid grid-cols-7 text-center text-[12px] font-semibold text-muted uppercase tracking-wider mb-2">
                {DAYS_OF_WEEK.map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* 35 or 42 Cells Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {monthCells.map((cell) => {
                  const isSelected = selectedDate === cell.dateStr;
                  const isCurrentMonth = cell.isCurrentMonth;
                  const dayEvents = filtered.filter((iv) => toDateKey(iv.date) === cell.dateStr);
                  const isHovered = hoveredCellDate === cell.dateStr;

                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() => setSelectedDate(cell.dateStr)}
                      onMouseEnter={() => setHoveredCellDate(cell.dateStr)}
                      onMouseLeave={() => setHoveredCellDate(null)}
                      className={`group relative min-h-[94px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/20 bg-primary/5 shadow-xs"
                          : cell.isToday
                          ? "border-primary/60 bg-soft/80"
                          : !isCurrentMonth
                          ? "border-border/40 bg-soft/30 text-muted opacity-60"
                          : "border-border/70 hover:border-slate-300 hover:bg-soft/40 bg-card"
                      }`}
                    >
                      {/* Top Row: Date Number & Indicators */}
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-[12px] font-bold transition ${
                            cell.isToday
                              ? "w-6 h-6 rounded-full bg-primary text-white grid place-items-center shadow-xs"
                              : isSelected
                              ? "text-primary font-extrabold"
                              : isCurrentMonth
                              ? "text-text"
                              : "text-muted"
                          }`}
                        >
                          {cell.dayNumber}
                        </span>

                        {/* Quick Add Button or Indicator Dot */}
                        <div className="flex items-center gap-1">
                          {isHovered && (
                            <button
                              type="button"
                              title={`Schedule interview on ${toHumanDate(cell.dateStr)}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setForm((prev) => ({ ...prev, date: toHumanDate(cell.dateStr) }));
                                setDrawerOpen(true);
                              }}
                              className="w-5 h-5 rounded-md bg-primary text-white hover:bg-primary/90 grid place-items-center shadow-2xs transition cursor-pointer"
                            >
                              <Plus size={12} />
                            </button>
                          )}
                          {dayEvents.length > 0 && !isHovered && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </div>
                      </div>

                      {/* Event Tags */}
                      <div className="flex flex-col gap-1 mt-1.5">
                        {dayEvents.slice(0, 2).map((ev) => {
                          const cat = getCategory(ev.type);
                          return (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(cell.dateStr);
                              }}
                              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium truncate transition hover:opacity-85 border flex items-center justify-between gap-1 shadow-2xs ${cat.badgeClass}`}
                              title={`${ev.candidateName} • ${ev.type} (${ev.start})`}
                            >
                              <span className="truncate">{ev.candidateName}</span>
                              <span className="text-[9px] shrink-0 opacity-80">{ev.start}</span>
                            </div>
                          );
                        })}

                        {dayEvents.length > 2 && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(cell.dateStr);
                            }}
                            className="text-[9.5px] text-muted hover:text-primary font-semibold transition"
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

            {/* Comprehensive Legend at Bottom */}
            <div className="pt-4 mt-6 border-t border-border flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted">
              <div className="flex flex-wrap items-center gap-4">
                {Object.keys(INTERVIEW_CATEGORIES).map((key) => {
                  const cat = INTERVIEW_CATEGORIES[key];
                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${cat.dotClass}`} />
                      <span className="text-text font-medium">{cat.label}</span>
                    </div>
                  );
                })}
              </div>
              <span className="text-[11.5px] text-muted">
                Click any day to inspect full session details
              </span>
            </div>
          </div>

          {/* Right 4 Cols: Dynamic Agenda & Upcoming Cards */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            {/* Selected Day Agenda Card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3.5 border-b border-border">
                <div>
                  <h3 className="font-bold text-[15px] text-text leading-tight">
                    Agenda for {formatShortDate(selectedDate)}
                  </h3>
                  <p className="text-[11.5px] text-muted mt-0.5">
                    {formatHumanDate(selectedDate)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-soft border border-border text-[11.5px] text-text font-mono font-semibold">
                    {selectedDateInterviews.length} {selectedDateInterviews.length === 1 ? "session" : "sessions"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, date: toHumanDate(selectedDate) }));
                      setDrawerOpen(true);
                    }}
                    className="w-7 h-7 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white grid place-items-center transition cursor-pointer"
                    title="Schedule interview for this date"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Sessions list */}
              <div className="flex flex-col gap-3 mt-4 max-h-[380px] overflow-y-auto pr-0.5">
                {selectedDateInterviews.map((ev) => {
                  const cat = getCategory(ev.type);
                  return (
                    <div
                      key={ev.id}
                      onClick={() => navigate(`/hrms/recruitment/interviews/${ev.id}`)}
                      className="p-3.5 bg-soft/40 border border-border rounded-xl flex flex-col gap-2 hover:border-primary/40 hover:bg-soft transition cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={ev.avatar || "https://i.pravatar.cc/100?img=15"}
                            alt={ev.candidateName}
                            className="w-6 h-6 rounded-full object-cover border border-border"
                          />
                          <span className="font-bold text-[13.5px] text-text group-hover:text-primary transition">
                            {ev.candidateName}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-medium shrink-0 border ${cat.badgeClass}`}>
                          {cat.shortLabel}
                        </span>
                      </div>

                      <p className="text-[12px] text-muted leading-relaxed">
                        {ev.job}
                      </p>

                      <div className="flex flex-wrap items-center gap-2.5 text-[11.5px] text-muted pt-0.5">
                        <div className="flex items-center gap-1">
                          <Clock size={12} className="text-muted/70" />
                          <span>{ev.start} - {ev.end} ({ev.duration || "60m"})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {ev.mode === "Video Call" ? (
                            <>
                              <Video size={12} className="text-blue-500" />
                              <span>{ev.location || "Video Call"}</span>
                            </>
                          ) : ev.mode === "Phone" ? (
                            <>
                              <Phone size={12} className="text-amber-500" />
                              <span>Phone</span>
                            </>
                          ) : (
                            <>
                              <MapPin size={12} className="text-emerald-500" />
                              <span>{ev.location || "In Person"}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/60">
                        <span className="text-[11px] text-muted font-medium">
                          Interviewer: {ev.interviewer}
                        </span>
                        <div className="flex items-center gap-2">
                          {ev.meetingLink && (
                            <a
                              href={ev.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                            >
                              <ExternalLink size={11} />
                              Join
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/hrms/recruitment/interviews/${ev.id}`);
                            }}
                            className="text-[11px] text-muted hover:text-primary font-medium flex items-center gap-0.5 cursor-pointer"
                          >
                            <Eye size={11} />
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {selectedDateInterviews.length === 0 && (
                  <div className="py-9 px-4 text-center text-muted flex flex-col items-center justify-center">
                    <Calendar size={28} className="text-muted/40 mb-2" />
                    <p className="text-[13px] font-medium text-text">No scheduled interviews</p>
                    <p className="text-[11.5px] text-muted mt-0.5">
                      No candidate rounds scheduled on this date.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, date: toHumanDate(selectedDate) }));
                        setDrawerOpen(true);
                      }}
                      className="mt-3.5 px-3.5 py-1.5 bg-soft border border-border hover:border-primary hover:text-primary rounded-xl text-[12px] font-medium transition cursor-pointer"
                    >
                      + Schedule Interview
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Interviews Card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <h4 className="font-bold text-[13.5px] text-text">Upcoming Pipeline Sessions</h4>
                </div>
                <span className="text-[11px] text-muted font-medium">Scheduled</span>
              </div>

              <div className="space-y-2 text-[12.5px]">
                {upcomingInterviews.map((iv) => {
                  const cat = getCategory(iv.type);
                  return (
                    <div
                      key={iv.id}
                      onClick={() => navigate(`/hrms/recruitment/interviews/${iv.id}`)}
                      className="p-3 bg-soft/30 border border-border rounded-xl flex justify-between items-center hover:border-primary/40 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <img
                          src={iv.avatar || "https://i.pravatar.cc/100?img=15"}
                          alt={iv.candidateName}
                          className="w-7 h-7 rounded-full object-cover shrink-0 border border-border"
                        />
                        <div className="truncate">
                          <span className="font-bold text-[12.5px] text-text block truncate">
                            {iv.candidateName}
                          </span>
                          <span className="text-[11px] text-muted block truncate">
                            {iv.job}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11.5px] font-semibold text-text block">
                          {iv.date}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium border ${cat.badgeClass}`}>
                          {cat.shortLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Interview Modal */}
      <Modal
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Schedule Interview"
        subtitle="Set panel members, meeting links, and candidate slots"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={schedule}>Schedule Interview</Button>
          </>
        }
      >
        <div className="grid sm:grid-cols-2 gap-3.5 text-[13px]">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Candidate *
            </span>
            <select
              value={form.candidateId}
              onChange={(e) => {
                const found = candidates.find((c) => c.id === e.target.value);
                setForm({
                  ...form,
                  candidateId: e.target.value,
                  job: found?.position || form.job,
                });
              }}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
            >
              <option value="">Select Candidate</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.position}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Job Position *
            </span>
            <select
              value={form.job}
              onChange={(e) => setForm({ ...form, job: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.title}>
                  {j.title} ({j.department})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Interview Type *
            </span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
            >
              <option>Technical Interview</option>
              <option>HR Interview</option>
              <option>Manager Interview</option>
              <option>Final Interview</option>
              <option>Coding Assessment</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Interviewer Name *
            </span>
            <input
              value={form.interviewer}
              onChange={(e) => setForm({ ...form, interviewer: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
              placeholder="e.g. Rahul Mehta"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Date *
            </span>
            <input
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
              placeholder="e.g. 10 Sep 2026"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Start Time *
            </span>
            <input
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
              placeholder="10:30 AM"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              End Time *
            </span>
            <input
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
              placeholder="11:30 AM"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Interview Mode *
            </span>
            <select
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
            >
              <option>Video Call</option>
              <option>In Person</option>
              <option>Phone</option>
            </select>
          </label>

          <label className="sm:col-span-2 flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Meeting Link or Office Room
            </span>
            <input
              value={form.meetingLink}
              onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
              className="h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px]"
              placeholder="https://meet.google.com/... or Conference Room B"
            />
          </label>

          <label className="sm:col-span-2 flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
              Preparation Notes / Questions
            </span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 text-[13px] resize-none"
              placeholder="Areas to evaluate: system design, concurrency, culture fit..."
            />
          </label>
        </div>
      </Modal>

      {/* Guide Modal */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-4 sm:p-6 max-h-[95vh] overflow-y-auto text-[13px] text-slate-600 dark:text-slate-300 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
                  <HelpCircle size={18} />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 dark:text-white">
                  Interviews Guide
                </h3>
              </div>
              <button
                onClick={() => setGuideOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  1. Multi-Stage Scheduling
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Assign technical, HR, and managerial rounds. Add meeting links to enable direct one-click access for interviewers and candidates.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  2. Calendar & List Modes
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Switch between standard table and a monthly calendar grid to avoid double booking panel interviewers.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  3. Feedback & Scoring
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  Click 'View' on any session to score the candidate and log evaluation feedback.
                </p>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Button size="sm" onClick={() => setGuideOpen(false)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
