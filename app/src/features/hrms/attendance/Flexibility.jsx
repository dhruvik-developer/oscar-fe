function addMinutesToClock(baseTime = "09:00", minutes = 30) {
  const match = String(baseTime).match(/(\d{1,2}):(\d{2})/);
  const h = match ? parseInt(match[1], 10) : 9;
  const m = match ? parseInt(match[2], 10) : 0;
  const total = (h * 60 + m + Number(minutes)) % 1440;
  const newH = String(Math.floor(total / 60)).padStart(2, "0");
  const newM = String(total % 60).padStart(2, "0");
  return `${newH}:${newM}`;
}

function getMinutesDiff(startClock = "09:00", endClock = "09:30") {
  const m1 = String(startClock).match(/(\d{1,2}):(\d{2})/);
  const m2 = String(endClock).match(/(\d{1,2}):(\d{2})/);
  if (!m1 || !m2) return 0;
  const t1 = parseInt(m1[1], 10) * 60 + parseInt(m1[2], 10);
  const t2 = parseInt(m2[1], 10) * 60 + parseInt(m2[2], 10);
  return Math.max(0, t2 - t1);
}

import { useState, useEffect } from "react";
import {
  Clock,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  LogOut,
  Sliders,
  RotateCcw,
  Check,
  Info,
  Briefcase,
  Zap,
} from "lucide-react";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import { useAppStore } from "../../../stores/appStore";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { describeError } from "../../../services/hrmsSync";

export default function Flexibility() {
  const flexibility = useAttendanceStore((s) => s.flexibility);
  const saveFlexibility = useAttendanceStore((s) => s.saveFlexibility);
  const role = useAttendanceStore((s) => s.role);
  const showToast = useAppStore((s) => s.showToast);

  const [form, setForm] = useState(() => flexibility || {});
  const [activePreset, setActivePreset] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const canEdit = role === "HR" || role === "Admin";
  const loaded = Boolean(flexibility && Object.keys(flexibility).length > 0);

  // The store fills lazily; ask for the policy if it is not there yet.
  useEffect(() => {
    if (loaded) return;
    const store = useAttendanceStore.getState();
    const pull = store.loadFlexibility || store.hydrate;
    Promise.resolve(pull?.())
      .then((res) => {
        if (!res) setLoadFailed(true);
      })
      .catch(() => setLoadFailed(true));
  }, [loaded]);

  // Whenever the server's policy arrives (or is re-saved), show it.
  useEffect(() => {
    if (loaded) {
      setForm(flexibility);
      setLoadFailed(false);
    }
  }, [flexibility, loaded]);

  async function retryLoad() {
    setLoadFailed(false);
    const res = await useAttendanceStore.getState().loadFlexibility?.();
    if (!res) setLoadFailed(true);
  }

  async function save() {
    if (!canEdit) {
      showToast("Only HR/Admin can change settings");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveFlexibility(form);
      showToast(saved ? "Attendance flexibility policies saved successfully" : "Saved locally — the server is not reachable");
    } catch (err) {
      showToast(`Policy not saved — ${describeError(err)}`);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setForm(flexibility || {});
    setActivePreset(null);
    showToast("Restored saved values");
  }

  // Quick preset loader
  function applyPreset(preset) {
    setActivePreset(preset);
    const start = flexibility?.shiftStart || "09:30";
    if (preset === "Strict (9-5 Corporate)") {
      setForm({
        ...form,
        shiftStart: "09:00",
        shiftEnd: "17:05",
        gracePeriod: "5 minutes",
        lateAfter: "09:05",
        halfDayThreshold: "4 hours",
        minimumWorkingHours: "8 hours",
        flexibleWorkingHours: "09:00 - 17:05 (Fixed)",
        earlyClockOutRequiresApproval: true,
        overtimeStartsAfter: "8 hours",
        overtimeRequiresApproval: true,
      });
      showToast("Applied Strict Corporate preset");
    } else if (preset === "Flexible Hybrid") {
      setForm({
        ...form,
        shiftStart: "08:30",
        shiftEnd: "19:00",
        gracePeriod: "60 minutes",
        lateAfter: "09:30",
        halfDayThreshold: "4 hours",
        minimumWorkingHours: "8 hours",
        flexibleWorkingHours: "08:30 - 19:00 (Core 10-4)",
        earlyClockOutRequiresApproval: false,
        overtimeStartsAfter: "9 hours",
        overtimeRequiresApproval: true,
      });
      showToast("Applied Flexible Hybrid preset");
    } else {
      // Standard: 9:00 - 9:30 flexible punch in, 8 hours working
      setForm({
        ...form,
        shiftStart: "09:00",
        shiftEnd: "18:00",
        gracePeriod: "30 minutes",
        lateAfter: "09:30",
        halfDayThreshold: "4 hours",
        minimumWorkingHours: "8 hours",
        flexibleWorkingHours: "09:00 - 18:00 (Flexible)",
        earlyClockOutRequiresApproval: true,
        overtimeStartsAfter: "8 hours",
        overtimeRequiresApproval: true,
      });
      showToast("Applied Standard preset (9:00–9:30 flexible punch-in)");
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      <PageHeader
        title="Attendance Flexibility Rules"
        subtitle="Set organizational grace periods, work shifts, approval gates, and overtime thresholds."
        guide={hrmsGuides.attendanceFlexibility}
        actions={
          <>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#e2e8f0] rounded-xl text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs"
            >
              <RotateCcw size={14} className="text-slate-400" />
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canEdit || saving || !loaded}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-xl text-[13px] font-semibold hover:bg-primary-dark disabled:opacity-50 transition shadow-xs"
            >
              <Check size={15} />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </>
        }
      />

      {loadFailed && !loaded && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-[13px] text-red-800 flex flex-wrap items-center gap-2.5">
          <AlertTriangle size={17} className="text-red-600 shrink-0" />
          <span className="flex-1">Could not load the attendance policy from the server.</span>
          <button type="button" onClick={retryLoad} className="px-3 py-1.5 bg-white border border-red-200 rounded-lg text-[12.5px] font-medium hover:bg-red-100">
            Retry
          </button>
        </div>
      )}

      {!loaded && !loadFailed && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-3.5 text-[13px] text-slate-500">Loading attendance policy…</div>
      )}

      {loaded && (
        <div className="bg-white border border-[#e2e8f0] rounded-xl px-4 py-3 text-[12.5px] text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <Calendar size={14} className="text-[#1e3a8a]" /> Effective rules:
          </span>
          <span>
            Shift <b>{flexibility.shiftStart || "09:00"}–{flexibility.shiftEnd || "18:00"}</b>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-medium border border-emerald-100">
            Flexible In: <b>{flexibility.shiftStart || "09:00"}–{flexibility.lateAfter || "09:30"}</b> (Not late)
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-medium border border-blue-100">
            Flexible Exit: <b>{flexibility.flexiblePunchOutStart || "17:00"}–{flexibility.flexiblePunchOutEnd || "17:30"}</b> (8h completed)
          </span>
          <span>
            Half day below <b>{flexibility.halfDayThresholdHours ?? "4"}h</b>
          </span>
          <span>
            Full day <b>{flexibility.fullDayHours ?? 8}h</b>
          </span>
        </div>
      )}

      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-[13px] text-amber-800 flex items-center gap-2.5">
          <AlertTriangle size={17} className="text-amber-600 shrink-0" />
          <span>
            <b>View-only mode:</b> You are logged in as an employee. Only HR &amp; Admin roles can modify organizational flexibility parameters.
          </span>
        </div>
      )}

      {/* ── Presets Bar ── */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-[#1e3a8a]" />
          <span className="text-[13px] font-semibold text-slate-800">Quick Policy Presets:</span>
          <span className="text-[12px] text-slate-400 hidden sm:inline">Load pre-configured policy rules</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["Standard", "Strict (9-5 Corporate)", "Flexible Hybrid"].map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={!canEdit}
              onClick={() => applyPreset(preset)}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-medium transition border ${
                activePreset === preset
                  ? "bg-[#1e3a8a] text-white border-[#1e3a8a] shadow-xs"
                  : "bg-[#f8fafc] text-slate-600 border-[#e2e8f0] hover:bg-slate-100"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2-Column Responsive Form Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Card 1: Late Arrival & Flexible Punch-In Rules ── */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div>
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-[#f1f5f9]">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 grid place-items-center">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[15.5px] text-slate-900">Late Arrival &amp; Flexible Punch-In</h3>
                <p className="text-[12px] text-slate-500">Tolerances and flexible time window for morning clock-in</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Shift Start Time */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Shift Start Time
                </label>
                <input
                  type="time"
                  disabled={!canEdit}
                  value={form.shiftStart || "09:00"}
                  onChange={(e) => {
                    const startVal = e.target.value;
                    const mins = parseInt(form.gracePeriod, 10) || 30;
                    setForm({ ...form, shiftStart: startVal, lateAfter: addMinutesToClock(startVal, mins) });
                  }}
                  className="w-full h-10 px-3.5 bg-white border border-[#cbd5e1] rounded-xl text-[13px] text-slate-800 disabled:bg-[#f8fafc] focus:outline-none focus:border-[#1e3a8a]"
                />
                <span className="block text-[11px] text-slate-400 mt-1">
                  Base start time for daily schedule.
                </span>
              </div>

              {/* Late After / Flexible In Cutoff */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Flexible Punch-In Cutoff (Mark Late After)
                </label>
                <input
                  type="time"
                  disabled={!canEdit}
                  value={form.lateAfter || "09:30"}
                  onChange={(e) => {
                    const lateVal = e.target.value;
                    const startVal = form.shiftStart || "09:00";
                    const diff = getMinutesDiff(startVal, lateVal);
                    setForm({ ...form, lateAfter: lateVal, gracePeriod: `${diff} minutes` });
                  }}
                  className="w-full h-10 px-3.5 bg-white border border-[#cbd5e1] rounded-xl text-[13px] text-slate-800 disabled:bg-[#f8fafc] focus:outline-none focus:border-[#1e3a8a]"
                />
                <span className="block text-[11px] text-slate-400 mt-1">
                  Punches after this trigger &apos;Late&apos; flag.
                </span>
              </div>

              {/* Grace Period Window */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Grace Period Window
                </label>
                <div className="relative">
                  <select
                    disabled={!canEdit}
                    value={form.gracePeriod || "30 minutes"}
                    onChange={(e) => {
                      const graceVal = e.target.value;
                      const mins = parseInt(graceVal, 10) || 0;
                      const start = form.shiftStart || "09:00";
                      const newLate = addMinutesToClock(start, mins);
                      setForm({ ...form, gracePeriod: graceVal, lateAfter: newLate });
                    }}
                    className="w-full h-10 px-3.5 bg-white border border-[#cbd5e1] rounded-xl text-[13px] text-slate-800 disabled:bg-[#f8fafc] focus:outline-none focus:border-[#1e3a8a] cursor-pointer"
                  >
                    <option value="0 minutes">None (0 min strict)</option>
                    <option value="5 minutes">5 minutes</option>
                    <option value="10 minutes">10 minutes</option>
                    <option value="15 minutes">15 minutes</option>
                    <option value="20 minutes">20 minutes</option>
                    <option value="30 minutes">30 minutes (Standard 9:00–9:30)</option>
                    <option value="45 minutes">45 minutes</option>
                    <option value="60 minutes">60 minutes (1 hour flexible)</option>
                  </select>
                </div>
                <div className="mt-2.5 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[12px] text-emerald-800 flex items-start gap-2">
                  <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Employees punching in between <b>{form.shiftStart || "09:00"}</b> and <b>{form.lateAfter || "09:30"}</b> are within the flexible time window and considered <b>Present</b> (not marked Late).
                  </span>
                </div>
              </div>

              {/* Half-Day Threshold */}
              <div className="sm:col-span-2 mt-1 pt-3 border-t border-[#f8fafc]">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Half-Day Threshold
                </label>
                <div className="flex items-center gap-3">
                  <select
                    disabled={!canEdit}
                    value={form.halfDayThreshold || "4 hours"}
                    onChange={(e) => setForm({ ...form, halfDayThreshold: e.target.value })}
                    className="flex-1 h-10 px-3.5 bg-white border border-[#cbd5e1] rounded-xl text-[13px] text-slate-800 disabled:bg-[#f8fafc] focus:outline-none focus:border-[#1e3a8a] cursor-pointer"
                  >
                    <option value="3 hours">3 hours</option>
                    <option value="4 hours">4 hours (Standard half shift)</option>
                    <option value="5 hours">5 hours</option>
                  </select>
                </div>
                <span className="block text-[11px] text-slate-400 mt-1">
                  Working below this duration automatically converts attendance to Half Day.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 2: Early Clock-Out Rules ── */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div>
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-[#f1f5f9]">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center">
                <LogOut size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[15.5px] text-slate-900">Early Departure &amp; Exit Rules</h3>
                <p className="text-[12px] text-slate-500">Punch-out validation and flexible departure gates</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4 p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl">
                <div>
                  <div className="text-[13px] font-bold text-slate-800">
                    Require Manager Approval for Early Clock-Out
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5">
                    Triggered only when leaving before completing required working hours ({form.minimumWorkingHours || "8 hours"}).
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={!!form.earlyClockOutRequiresApproval}
                    onChange={(e) =>
                      setForm({ ...form, earlyClockOutRequiresApproval: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1e3a8a]"></div>
                </label>
              </div>

              <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-[12px] text-blue-900 flex items-start gap-2.5">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <b>Exit Punch-Out Flexibility:</b> When an employee completes their <b>{form.minimumWorkingHours || "8 hours"}</b> (e.g. punch in at <b>09:30 AM</b> and punch out at <b>05:30 PM</b> with no breaks), the working hours are considered a full 8 hours and <b>not penalized</b> as early clock-out.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 3: Working Hours & Shifts ── */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div>
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-[#f1f5f9]">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center">
                <Briefcase size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[15.5px] text-slate-900">Working Hours &amp; Shifts</h3>
                <p className="text-[12px] text-slate-500">Minimum expected work hours and flexible shift windows</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Minimum Working Hours / Day
                </label>
                <select
                  disabled={!canEdit}
                  value={form.minimumWorkingHours || "8 hours"}
                  onChange={(e) => setForm({ ...form, minimumWorkingHours: e.target.value })}
                  className="w-full h-10 px-3.5 bg-white border border-[#cbd5e1] rounded-xl text-[13px] text-slate-800 disabled:bg-[#f8fafc] focus:outline-none focus:border-[#1e3a8a] cursor-pointer"
                >
                  <option value="7 hours">7 hours</option>
                  <option value="7.5 hours">7.5 hours</option>
                  <option value="8 hours">8 hours (Full Time standard)</option>
                  <option value="9 hours">9 hours (incl. 1hr break)</option>
                </select>
                <span className="block text-[11px] text-slate-400 mt-1">
                  Required duration for a full day credit.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Flexible Shift Window
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={form.flexibleWorkingHours || "09:00 - 18:00 (Flexible)"}
                  onChange={(e) => setForm({ ...form, flexibleWorkingHours: e.target.value })}
                  placeholder="e.g. 09:00 - 18:00 (Flexible)"
                  className="w-full h-10 px-3.5 bg-white border border-[#cbd5e1] rounded-xl text-[13px] text-slate-800 disabled:bg-[#f8fafc] focus:outline-none focus:border-[#1e3a8a]"
                />
                <span className="block text-[11px] text-slate-400 mt-1">
                  Permitted punch window for employees.
                </span>
              </div>

              <div className="sm:col-span-2 p-3 bg-slate-50 border border-[#e2e8f0] rounded-xl text-[12px] text-slate-600">
                <span className="font-semibold text-slate-700">Dynamic Exit Window: </span>
                {addMinutesToClock(form.shiftStart || "09:00", (parseFloat(form.minimumWorkingHours) || 8) * 60)} – {addMinutesToClock(form.lateAfter || "09:30", (parseFloat(form.minimumWorkingHours) || 8) * 60)} (e.g. punch in at 09:30 completes 8h at 17:30)
              </div>
            </div>
          </div>
        </div>

        {/* ── Card 4: Overtime Rules ── */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div>
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-[#f1f5f9]">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 grid place-items-center">
                <Zap size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[15.5px] text-slate-900">Overtime Calculation</h3>
                <p className="text-[12px] text-slate-500">Thresholds and approvals for overtime pay calculations</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Overtime Starts After
                </label>
                <select
                  disabled={!canEdit}
                  value={form.overtimeStartsAfter || "8 hours"}
                  onChange={(e) => setForm({ ...form, overtimeStartsAfter: e.target.value })}
                  className="w-full h-10 px-3.5 bg-white border border-[#cbd5e1] rounded-xl text-[13px] text-slate-800 disabled:bg-[#f8fafc] focus:outline-none focus:border-[#1e3a8a] cursor-pointer"
                >
                  <option value="8 hours">After 8 completed hours</option>
                  <option value="8.5 hours">After 8.5 completed hours</option>
                  <option value="9 hours">After 9 completed hours</option>
                  <option value="10 hours">After 10 completed hours</option>
                </select>
                <span className="block text-[11px] text-slate-400 mt-1">
                  Time logged above this qualifies as overtime.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Manager Verification Required
                </label>
                <select
                  disabled={!canEdit}
                  value={form.overtimeRequiresApproval ? "Yes" : "No"}
                  onChange={(e) =>
                    setForm({ ...form, overtimeRequiresApproval: e.target.value === "Yes" })
                  }
                  className="w-full h-10 px-3.5 bg-white border border-[#cbd5e1] rounded-xl text-[13px] text-slate-800 disabled:bg-[#f8fafc] focus:outline-none focus:border-[#1e3a8a] cursor-pointer"
                >
                  <option value="Yes">Yes — requires manager sign-off</option>
                  <option value="No">No — automatic payroll accrual</option>
                </select>
                <span className="block text-[11px] text-slate-400 mt-1">
                  Sent to team leads for overtime verification.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Policy Summary Card ── */}
      <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#cbd5e1] grid place-items-center text-slate-700">
            <ShieldCheck size={18} className="text-[#1e3a8a]" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-slate-800">
              Active Policy Status: Enforced across all departments
            </div>
            <div className="text-[12px] text-slate-500">
              Flexible In: <b>{form.shiftStart || "09:00"}–{form.lateAfter || "09:30"}</b> (Not late) • Min hours: <b>{form.minimumWorkingHours || "8 hrs"}</b> • Flexible Exit: <b>{addMinutesToClock(form.shiftStart || "09:00", (parseFloat(form.minimumWorkingHours) || 8) * 60)}–{addMinutesToClock(form.lateAfter || "09:30", (parseFloat(form.minimumWorkingHours) || 8) * 60)}</b>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 text-[12.5px] font-medium text-slate-600 bg-white border border-[#cbd5e1] rounded-xl hover:bg-slate-50"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}
