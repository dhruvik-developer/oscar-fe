import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  Search,
  CalendarDays,
  ChevronDown,
  Command,
  Inbox,
  Menu,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { usePunchActions } from '../../features/hrms/attendance/usePunchActions';
import { EarlyPunchOutModal } from '../../features/hrms/attendance/components/EarlyPunchOutModal';
import { useAppStore } from '../../stores/appStore';
import { approvalService } from '../../services/domainServices';
import NotificationCenter from './NotificationCenter';




export default function Topbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const globalSearch = useAppStore((s) => s.globalSearch);
  const setGlobalSearch = useAppStore((s) => s.setGlobalSearch);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const mobileSidebarOpen = useAppStore((s) => s.mobileSidebarOpen);
  const toggleMobileSidebar = useAppStore((s) => s.toggleMobileSidebar);

  const [isPunchOpen, setIsPunchOpen] = useState(false);

  const punchRef = useRef(null);

  const currentUser = useAppStore((s) => s.currentUser);

  const {
    todayPunch,
    fetchTodayPunch,
    tickPunch,
    submitting: punchSubmitting,
    error: punchError,
    doPunchIn,
    doPunchOut,
    executePunchOut,
    earlyModalOpen: isEarlyPunchModalOpen,
    setEarlyModalOpen: setIsEarlyPunchModalOpen,
  } = usePunchActions();

  useEffect(() => {
    fetchTodayPunch();
  }, [fetchTodayPunch]);

  // Live seconds tick when punched in
  useEffect(() => {
    if (!todayPunch?.isPunchedIn) return;
    const interval = setInterval(() => {
      tickPunch();
    }, 1000);
    return () => clearInterval(interval);
  }, [todayPunch?.isPunchedIn, tickPunch]);

  // Outside click listener for punch popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (punchRef.current && !punchRef.current.contains(event.target)) {
        setIsPunchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [approvalBadge, setApprovalBadge] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchBadge = async () => {
      try {
        const res = await approvalService.getRequestBadge();
        if (cancelled) return;
        const c = res?.pendingCount ?? res?.count ?? 0;
        setApprovalBadge(Number(c) || 0);
      } catch {
        // silent fallback
      }
    };
    fetchBadge();
    const interval = setInterval(fetchBadge, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname]);


  return (
    <header className="topbar">
      {/* Mobile / tablet navigation toggle (below lg only) */}
      <button
        type="button"
        onClick={toggleMobileSidebar}
        className="topbar-hamburger"
        aria-label={mobileSidebarOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileSidebarOpen}
        title="Menu"
      >
        <Menu size={18} />
      </button>

      {/* Compact search trigger (phones only) — opens the Command Palette */}
      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className="top-search-compact"
        aria-label="Search (Ctrl+K)"
        title="Search"
      >
        <Search size={16} />
      </button>

      {/* Search Input Bar */}
      <label className="top-search cursor-pointer group">
        <Search size={15} className="top-search-ico shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors" />
        <input
          type="text"
          placeholder="Search records, contacts, deals... (Ctrl+K)"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          onClick={() => setCommandPaletteOpen(true)}
          readOnly
          className="w-full bg-transparent text-[13px] font-normal text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none cursor-pointer"
        />
        <div className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-500 dark:text-slate-400 shadow-[0_1px_1px_rgba(0,0,0,0.05)] group-hover:border-slate-300 dark:group-hover:border-slate-600 transition-colors">
          <Command size={10} className="opacity-70" />
          <span>K</span>
        </div>
      </label>

      {/* Right Actions Cluster */}
      <div className="top-actions flex items-center gap-2 shrink-0">
        {/* Harmonized Icon Buttons Cluster */}
        <div className="flex items-center gap-2 pl-1">
          {/* Approvals Inbox Shortcut with Badge (Phase 4.1) */}
          <Link
            to="/administration/approvals"
            className="w-9 h-9 rounded-full border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-400/60 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center transition-all duration-200 cursor-pointer relative shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_3px_10px_rgba(37,99,235,0.12)] hover:-translate-y-px active:scale-95"
            aria-label="Pending Approvals"
            title={approvalBadge > 0 ? `${approvalBadge} Pending Approvals` : "My Approvals Inbox"}
          >
            <ClipboardCheck size={16} />
            {approvalBadge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-[9.5px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-[0_2px_5px_rgba(245,158,11,0.4)] animate-pulse">
                {approvalBadge}
              </span>
            )}
          </Link>

          <NotificationCenter />

          {/* Subtle separator */}
          <div className="h-5 w-px bg-slate-200/80 dark:bg-slate-800 hidden sm:block mx-0.5" />

          {/* Punch In / Out Primary Pill & Dropdown Popover */}
          <div className="relative" ref={punchRef}>
            {todayPunch?.isPunchedIn ? (
              <button
                type="button"
                onClick={() => setIsPunchOpen(!isPunchOpen)}
                className="h-9 px-3 sm:px-3.5 rounded-full border border-emerald-500/30 dark:border-emerald-500/40 bg-gradient-to-r from-emerald-500/[0.12] via-emerald-500/[0.06] to-teal-500/[0.10] hover:from-emerald-500/[0.18] hover:to-teal-500/[0.16] dark:from-emerald-500/20 dark:to-teal-500/15 text-emerald-950 dark:text-emerald-100 flex items-center gap-2 text-xs font-semibold shadow-[0_2px_8px_rgba(16,185,129,0.12)] hover:shadow-[0_4px_14px_rgba(16,185,129,0.22)] hover:-translate-y-px transition-all duration-200 cursor-pointer"
                title="View Today's Punches"
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                </span>
                <span className="font-bold text-emerald-950 dark:text-emerald-100 text-[12px] tracking-tight whitespace-nowrap">
                  Punched In
                </span>
                <span className="w-1 h-1 rounded-full bg-emerald-400/80 dark:bg-emerald-500 shrink-0" />
                <span className="font-semibold text-emerald-900 dark:text-emerald-200 text-[11px] font-mono tracking-tight bg-emerald-500/15 dark:bg-emerald-500/25 px-1.5 py-0.5 rounded-md border border-emerald-500/25 whitespace-nowrap">
                  {todayPunch.firstPunch || todayPunch.punches?.[todayPunch.punches.length - 1]?.timeDisplay || 'Active'}
                </span>
                <ChevronDown
                  size={12}
                  className={`text-emerald-700/70 dark:text-emerald-400 transition-transform duration-200 ${isPunchOpen ? 'rotate-180' : ''}`}
                />
              </button>
            ) : (todayPunch?.dayCompleted || (todayPunch?.punches?.length > 0 && !todayPunch?.canPunchIn)) ? (
              <button
                type="button"
                onClick={() => setIsPunchOpen(!isPunchOpen)}
                className="h-9 px-3 sm:px-3.5 rounded-full border border-teal-500/30 dark:border-teal-500/40 bg-gradient-to-r from-teal-500/10 to-emerald-500/10 hover:from-teal-500/15 hover:to-emerald-500/15 text-teal-950 dark:text-teal-100 flex items-center gap-2 text-xs font-semibold shadow-[0_2px_8px_rgba(20,184,166,0.1)] hover:shadow-[0_4px_12px_rgba(20,184,166,0.2)] hover:-translate-y-px transition-all duration-200 cursor-pointer"
                title="Today's attendance completed"
              >
                <CheckCircle2 size={13} className="text-teal-600 dark:text-teal-400 font-bold shrink-0" />
                <span className="font-bold text-teal-950 dark:text-teal-100 text-[12px] tracking-tight whitespace-nowrap">
                  Day Completed
                </span>
                <span className="w-1 h-1 rounded-full bg-teal-400/80 dark:bg-teal-500 shrink-0" />
                <span className="font-semibold text-teal-900 dark:text-teal-200 text-[11px] font-mono tracking-tight bg-teal-500/15 dark:bg-teal-500/25 px-1.5 py-0.5 rounded-md border border-teal-500/25 whitespace-nowrap">
                  {todayPunch.lastPunch || todayPunch.punches?.[todayPunch.punches.length - 1]?.timeDisplay || 'Done'}
                </span>
                <ChevronDown
                  size={12}
                  className={`text-teal-700/70 dark:text-teal-400 transition-transform duration-200 ${isPunchOpen ? 'rotate-180' : ''}`}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsPunchOpen(!isPunchOpen)}
                className="h-9 px-3 sm:px-3.5 rounded-full border border-amber-300/80 dark:border-amber-600/50 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-orange-500/10 hover:from-amber-500/15 hover:to-orange-500/15 text-amber-900 dark:text-amber-200 flex items-center gap-2 text-xs font-semibold shadow-[0_2px_8px_rgba(245,158,11,0.1)] hover:shadow-[0_4px_14px_rgba(245,158,11,0.2)] hover:-translate-y-px transition-all duration-200 cursor-pointer"
                title="Today's Punch Status"
              >
                <Clock size={13} className="text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
                <span className="font-bold text-[12px] tracking-tight whitespace-nowrap">Not Punched In</span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/20 whitespace-nowrap">
                  Punch In
                </span>
                <ChevronDown
                  size={12}
                  className={`text-amber-700/60 dark:text-amber-400 transition-transform duration-200 ${isPunchOpen ? 'rotate-180' : ''}`}
                />
              </button>
            )}

            {/* Attendance Popover Dropdown Card */}
            {isPunchOpen && (
              <div className="top-dropdown-menu w-80 max-w-[calc(100vw-24px)] p-4 animate-in fade-in zoom-in-95 duration-150 shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl z-50 absolute right-0 top-11">
                {/* Header Profile / Status */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {todayPunch?.employee?.name || currentUser?.name || 'Administrator'}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {todayPunch?.employee?.employeeCode || 'EMP-001'} • {todayPunch?.employee?.department || currentUser?.department || 'Management & Administration'}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      todayPunch?.isPunchedIn
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800'
                        : todayPunch?.dayCompleted
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800'
                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                    }`}
                  >
                    {todayPunch?.status || 'Not Punched In'}
                  </span>
                </div>

                {punchError && (
                  <div className="mb-3 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-[11.5px] leading-tight flex items-start gap-1.5">
                    <span>⚠️</span>
                    <span>{punchError}</span>
                  </div>
                )}

                {/* Metrics Table */}
                <div className="space-y-2 text-xs mb-3.5 bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11.5px]">Status</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{todayPunch?.status || 'Not Punched In'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11.5px]">First Punch In</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{todayPunch?.firstPunch || '--:--'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11.5px]">Last Punch</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{todayPunch?.lastPunch || '--:--'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-[11.5px]">Working Time</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{todayPunch?.formattedWorkingTime || '00h 00m'}</span>
                  </div>
                  {todayPunch?.lateMinutes > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-[11.5px]">Late</span>
                      <span className="font-semibold text-amber-600">{todayPunch.lateMinutes} min late</span>
                    </div>
                  )}
                </div>

                {/* Today\'s Punches List */}
                <div className="mb-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                    <span>TODAY\'S PUNCHES</span>
                    <span className="font-semibold font-mono text-[10px] text-slate-400">
                      {todayPunch?.punches?.length || 0} {todayPunch?.punches?.length === 1 ? 'EVENT' : 'EVENTS'}
                    </span>
                  </div>
                  {todayPunch?.punches?.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                      {todayPunch.punches.map((p, idx) => (
                        <div key={p.id || idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-2xs">
                          <span className="font-mono text-slate-600 dark:text-slate-300 font-medium text-[12px]">{p.timeDisplay || p.punchTime?.slice(11, 16)}</span>
                          <span className="text-slate-300 dark:text-slate-600">→</span>
                          <span className={`font-semibold text-[11.5px] ${p.punchType === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {p.punchType === 'IN' ? 'Punch In' : 'Punch Out'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-2.5 text-center text-[11px] text-slate-400 italic bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                      No punches recorded today yet
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800 text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">
                    <span>Total Working Time:</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{todayPunch?.formattedWorkingTime || '00h 00m'}</span>
                  </div>
                </div>

                {/* Big Action Button in Dropdown */}
                <div className="pt-1">
                  {todayPunch?.isPunchedIn ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsPunchOpen(false);
                        doPunchOut();
                      }}
                      disabled={punchSubmitting}
                      className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {punchSubmitting ? <Loader2 size={13} className="animate-spin" /> : null}
                      <span>Punch Out</span>
                    </button>
                  ) : todayPunch?.dayCompleted ? (
                    <div className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs flex items-center justify-center gap-1.5 text-center">
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      <span>Day Completed (1 Punch In/Out per day)</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsPunchOpen(false);
                        doPunchIn();
                      }}
                      disabled={punchSubmitting}
                      className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {punchSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
                      <span>Punch In</span>
                    </button>
                  )}
                </div>

                {/* Link to Attendance Overview */}
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <Link
                    to="/hrms/attendance"
                    onClick={() => setIsPunchOpen(false)}
                    className="text-[11.5px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <span>View Attendance →</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Subtle separator */}
          <div className="h-5 w-px bg-slate-200/80 dark:bg-slate-800 hidden sm:block mx-0.5" />

          {/* Calendar Shortcut */}
          <Link
            to="/hrms/attendance"
            className="w-9 h-9 rounded-full border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-400/60 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hidden sm:flex items-center justify-center transition-all duration-200 cursor-pointer relative shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_3px_10px_rgba(37,99,235,0.12)] hover:-translate-y-px active:scale-95"
            aria-label="Calendar & Schedule"
            title="Attendance & Schedule"
          >
            <CalendarDays size={16} />
          </Link>

          {/* Messages & Tasks Shortcut */}
          <Link
            to="/crm/tasks"
            className="w-9 h-9 rounded-full border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-400/60 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hidden sm:flex items-center justify-center transition-all duration-200 cursor-pointer relative shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_3px_10px_rgba(37,99,235,0.12)] hover:-translate-y-px active:scale-95"
            aria-label="Tasks & Activities"
            title="Tasks & Activities"
          >
            <Inbox size={16} />
          </Link>

        </div>
      </div>
      {/* Early Punch Out Confirmation Modal */}
      <EarlyPunchOutModal
        isOpen={isEarlyPunchModalOpen}
        onClose={() => setIsEarlyPunchModalOpen(false)}
        onConfirm={executePunchOut}
        todayPunch={todayPunch}
        isSubmitting={punchSubmitting}
      />
    </header>
  );
}
