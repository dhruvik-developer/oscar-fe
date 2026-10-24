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
    if (preset === "Strict (9-5 Corporate)") {
      setForm({
        ...form,
        gracePeriod: "5 minutes",
        lateAfter: "09:05",
        halfDayThreshold: "4 hours",
        minimumWorkingHours: "8 hours",
        flexibleWorkingHours: "09:00 - 18:00 (Fixed)",
        earlyClockOutRequiresApproval: true,
        overtimeStartsAfter: "8 hours",
        overtimeRequiresApproval: true,
      });
      showToast("Applied Strict Corporate preset");
    } else if (preset === "Flexible Hybrid") {
      setForm({
        ...form,
        gracePeriod: "30 minutes",
        lateAfter: "10:00",
        halfDayThreshold: "4 hours",
        minimumWorkingHours: "8 hours",
        flexibleWorkingHours: "08:00 - 20:00 (Core 10-4)",
        earlyClockOutRequiresApproval: false,
        overtimeStartsAfter: "9 hours",
        overtimeRequiresApproval: true,
      });
      showToast("Applied Flexible Hybrid preset");
    } else {
      // Standard
      setForm({
        ...form,
        gracePeriod: "10 minutes",
        lateAfter: "09:10",
        halfDayThreshold: "4 hours",
        minimumWorkingHours: "8 hours",
        flexibleWorkingHours: "09:00 - 18:00 (Flexible)",
        earlyClockOutRequiresApproval: true,
        overtimeStartsAfter: "8 hours",
        overtimeRequiresApproval: true,
      });
      showToast("Applied Standard preset");
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
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#1e3a8a] text-white rounded-xl text-[13px] font-semibold hover:bg-[#1e40af] disabled:opacity-50 transition shadow-xs"
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
        <div className="bg-white border border-[#e2e8f0] rounded-xl px-4 py-3 text-[12.5px] text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <Calendar size={14} className="text-[#1e3a8a]" /> Effective rules:
          </span>
          <span>
            Shift <b>{flexibility.shiftStart || "—"}–{flexibility.shiftEnd || "—"}</b>
          </span>
          <span>
            Late after <b>{flexibility.lateAfter || "—"}</b>
            {flexibility.graceMinutes != null ? ` (${flexibility.graceMinutes} min grace)` : ""}
          </span>
          <span>
            Half day below <b>{flexibility.halfDayThresholdHours ?? "—"}h</b>
          </span>
          {flexibility.fullDayHours != null && (
            <span>
              Full day <b>{flexibility.fullDayHours}h</b>
            </span>
          )}
          {flexibility.overtimeAfterHours != null && (
            <span>
              Overtime after <b>{flexibility.overtimeAfterHours}h</b>
            </span>
          )}
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
        {/* ── Card 1: Late Arrival & Grace Period ── */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
          <div>
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-[#f1f5f9]">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 grid place-items-center">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[15.5px] text-slate-900">Late Arrival Rules</h3>
                <p className="text-[12px] text-slate-500">Tolerances for morning clock-in before marking late</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Grace Period */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Grace Period Window
                </label>
                <div className="relative">
                  <select
                    disabled={!canEdit}
                    value={form.gracePeriod || "10 minutes"}
                    onChange={(e) => setForm({ ...form, gracePeriod: e.target.value })}
                    className="w-full h-10 px-3.5 bg-white border border-[#cbd5e1] rounded-xl text-[13px] text-slate-800 disabled:bg-[#f8fafc] focus:outline-none focus:border-[#1e3a8a] cursor-pointer"
                  >
                    <option value="0 minutes">None (0 min strict)</option>
                    <option value="5 minutes">5 minutes</option>
                    <option value="10 minutes">10 minutes (Recommended)</option>
                    <option value="15 minutes">15 minutes</option>
                    <option value="30 minutes">30 minutes</option>
                  </select>
                </div>
                <span className="block text-[11px] text-slate-400 mt-1">
                  Buffer time after official shift start.
                </span>
              </div>

              {/* Late After */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Mark Late After
                </label>
                <input
                  type="time"
                  disabled={!canEdit}
                  value={form.lateAfter || "09:10"}
                  onChange={(e) => setForm({ ...form, lateAfter: e.target.value })}
                  className="w-full h-10 px-3.5 bg-white border border-[#cbd5e1] rounded-xl text-[13px] text-slate-800 disabled:bg-[#f8fafc] focus:outline-none focus:border-[#1e3a8a]"
                />
                <span className="block text-[11px] text-slate-400 mt-1">
                  Punches after this trigger &apos;Late&apos; flag.
                </span>
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
                <h3 className="font-bold text-[15.5px] text-slate-900">Early Departure Gate</h3>
                <p className="text-[12px] text-slate-500">Approvals and penalties when clocking out ahead of schedule</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4 p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl">
                <div>
                  <div className="text-[13px] font-bold text-slate-800">
                    Require Manager Approval for Early Clock-Out
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5">
                    Creates an automated pending item in <b>Attendance &gt; Requests</b> for manager sign-off.
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

              <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl text-[12px] text-blue-900 flex items-start gap-2.5">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Employees who depart before the shift end time ({flexibility?.shiftEnd || "18:30"}) will be prompted to supply a reason and request manager clearance.
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
              Grace window: <b>{form.gracePeriod || "10 min"}</b> • Late threshold: <b>{form.lateAfter || "09:10"}</b> • Min hours: <b>{form.minimumWorkingHours || "8 hrs"}</b>
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
          <button
            type="button"
            onClick={save}
            disabled={!canEdit || saving || !loaded}
            className="px-4 py-2 text-[12.5px] font-semibold text-white bg-[#1e3a8a] rounded-xl hover:bg-[#1e40af] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
