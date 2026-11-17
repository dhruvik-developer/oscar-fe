import React, { useState, useMemo, useEffect, useRef } from "react";
import { useAppStore } from "../../../stores/appStore";
import { usePerformanceStore, getRatingScaleTier } from "../../../stores/performanceStore";
import { useERP } from "../../../context/ERPContext";
import { downloadElementAsPdf } from "../../../services/exportUtils";
import {
  X,
  Printer,
  Star,
  Award,
  CheckCircle2,
  FileText,
  Target,
  TrendingUp,
  Building2,
  User,
  Calendar,
  ShieldCheck,
  Briefcase,
  Layers,
  ChevronDown,
  Download,
  Loader2,
} from "lucide-react";
import UserInitials from "../../../components/common/UserInitials";

export default function PerformanceReportModal({
  isOpen,
  onClose,
  employee: initialEmployee,
  appraisal: initialAppraisal,
}) {
  const employees = useAppStore((s) => s.employees || []);
  const currentUser = useAppStore((s) => s.currentUser);
  const { companyProfile } = useERP();

  const { appraisals, indicators, kpis, cycles } = usePerformanceStore();

  const [selectedEmpName, setSelectedEmpName] = useState(
    initialEmployee?.name || initialAppraisal?.employee || (employees[0]?.name || "")
  );

  useEffect(() => {
    if (initialEmployee?.name) {
      setSelectedEmpName(initialEmployee.name);
    } else if (initialAppraisal?.employee) {
      setSelectedEmpName(initialAppraisal.employee);
    }
  }, [initialEmployee, initialAppraisal]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Build comprehensive available employees list across directory and performance records
  const availableEmployees = useMemo(() => {
    const map = new Map();
    employees.forEach((emp) => {
      if (emp.name) map.set(emp.name.toLowerCase(), { name: emp.name, department: emp.department || "General" });
    });
    appraisals.forEach((app) => {
      if (app.employee && !map.has(app.employee.toLowerCase())) {
        map.set(app.employee.toLowerCase(), { name: app.employee, department: app.department || "General" });
      }
    });
    if (initialEmployee?.name && !map.has(initialEmployee.name.toLowerCase())) {
      map.set(initialEmployee.name.toLowerCase(), { name: initialEmployee.name, department: initialEmployee.department || "General" });
    }
    return Array.from(map.values());
  }, [employees, appraisals, initialEmployee]);

  // Resolve current active employee
  const currentEmp = useMemo(() => {
    const found = employees.find((e) => e.name?.toLowerCase() === selectedEmpName?.toLowerCase());
    if (found) return found;
    if (initialEmployee && initialEmployee.name?.toLowerCase() === selectedEmpName?.toLowerCase()) {
      return initialEmployee;
    }
    const matchingAppraisal = appraisals.find((a) => a.employee?.toLowerCase() === selectedEmpName?.toLowerCase());
    if (matchingAppraisal) {
      return {
        name: matchingAppraisal.employee,
        department: matchingAppraisal.department || "Operations",
        designation: matchingAppraisal.designation || "Specialist",
        employeeCode: `EMP-${Math.abs(matchingAppraisal.id || 101)}`,
        avatar: matchingAppraisal.avatar,
      };
    }
    return {
      name: selectedEmpName || "Employee",
      department: "Operations",
      designation: "Team Member",
      employeeCode: "EMP-101",
    };
  }, [employees, selectedEmpName, initialEmployee, appraisals]);

  // Appraisals matching this employee
  const employeeAppraisals = useMemo(() => {
    return appraisals.filter(
      (a) =>
        String(a.employee ?? "").toLowerCase() === String(currentEmp.name ?? "").toLowerCase() ||
        (currentEmp.id && a.employeeId === currentEmp.id)
    );
  }, [appraisals, currentEmp]);

  // Primary appraisal record for the report
  const primaryAppraisal = useMemo(() => {
    if (initialAppraisal && initialAppraisal.employee === currentEmp.name) {
      return initialAppraisal;
    }
    return employeeAppraisals[0] || null;
  }, [initialAppraisal, employeeAppraisals, currentEmp]);

  // Matching KPIs
  const employeeKpis = useMemo(() => {
    return kpis.filter(
      (k) =>
        k.assignedEmployee === currentEmp.name ||
        k.assignedEmployee === "All in Department" ||
        k.department === currentEmp.department
    );
  }, [kpis, currentEmp]);

  // Matching Indicators
  const employeeIndicators = useMemo(() => {
    return indicators.filter(
      (ind) =>
        ind.assignedEmployee === currentEmp.name ||
        ind.assignedEmployee === "All in Designation" ||
        ind.department === currentEmp.department ||
        ind.designation === currentEmp.designation
    );
  }, [indicators, currentEmp]);

  // Performance Rating & Metrics
  const ratingValue = Number.isFinite(Number(primaryAppraisal?.rating)) ? Number(primaryAppraisal.rating) : 4.2;
  const ratingTier = getRatingScaleTier(ratingValue);
  const rawWeighted = Number(primaryAppraisal?.weightedScore);
  const weightedScore = Number.isFinite(rawWeighted) && rawWeighted > 0
    ? Math.round(rawWeighted)
    : Math.round((Number(ratingValue) / 5) * 100);
  const sheetRef = useRef(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!sheetRef.current || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const empSafeName = (currentEmp?.name || 'Employee').replace(/\s+/g, '_');
      await downloadElementAsPdf(sheetRef.current, `Performance_Report_${empSafeName}.pdf`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:backdrop-blur-none">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none">
        
        {/* Top Control Bar (Hidden during Print) */}
        <div className="bg-[#1F2E4A] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 no-print shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold">
              <Award size={16} />
            </div>
            <div>
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                <span className="font-bold text-sm text-white">
                  Performance Evaluation Report
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  {currentEmp.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Official HR appraisal &amp; competency assessment
              </p>
            </div>
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            {/* Employee Switcher */}
            {availableEmployees.length > 1 && (
              <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-xl border border-white/20">
                <span className="text-[10.5px] text-slate-300 uppercase font-semibold">Employee:</span>
                <select
                  value={selectedEmpName}
                  onChange={(e) => setSelectedEmpName(e.target.value)}
                  className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  {availableEmployees.map((emp) => (
                    <option key={emp.name} value={emp.name} className="text-slate-900">
                      {emp.name} ({emp.department || "Staff"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Download PDF (Direct 1-Click) */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
              title="Download PDF directly to Downloads folder"
            >
              {isDownloadingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>Download PDF</span>
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs bg-white/10 hover:bg-white/20 text-white border border-white/20"
              title="Print document"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition ml-1 cursor-pointer"
              title="Close Report"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Report Content Body (Printable Document Sheet) */}
        <div ref={sheetRef} className="p-6 sm:p-10 bg-white text-slate-800 space-y-6 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-8">
          
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black text-sm">
                  {companyProfile?.name?.slice(0, 2).toUpperCase() || "EV"}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-950 uppercase tracking-tight">
                    {companyProfile?.name || "Evenmore Technologies Inc."}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {companyProfile?.address || "Global Corporate Headquarters"} • HR &amp; Talent Directorate
                  </p>
                </div>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                Official HR Record • Confidential
              </span>
              <div className="text-xs font-bold text-slate-900 mt-1">
                Report Date: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Doc Ref: PERF-REP-{new Date().getFullYear()}-{currentEmp.employeeCode || currentEmp.id || "101"}
              </div>
            </div>
          </div>

          {/* Title Banner */}
          <div className="text-center py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
              Employee Performance Evaluation &amp; Competency Audit
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Review Cycle: <span className="font-bold text-slate-900">{primaryAppraisal?.cycle || "Annual Appraisal Cycle 2026"}</span>
            </p>
          </div>

          {/* Employee Particulars Grid */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <User size={13} className="text-blue-600" /> Employee Particulars
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Full Name</span>
                <span className="font-bold text-slate-900 text-[13px]">{currentEmp.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Employee Code / ID</span>
                <span className="font-mono font-semibold text-slate-700">{currentEmp.employeeCode || currentEmp.empId || currentEmp.id || "EMP-042"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Department</span>
                <span className="font-semibold text-slate-800">{currentEmp.department || "General"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Designation</span>
                <span className="font-semibold text-slate-800">{currentEmp.designation || "Staff Member"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Reporting Manager</span>
                <span className="font-semibold text-slate-800">{primaryAppraisal?.reviewer || currentEmp.manager || "Department Lead"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Work Location</span>
                <span className="font-semibold text-slate-800">{currentEmp.location || "Headquarters"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Date of Joining</span>
                <span className="font-semibold text-slate-800">{currentEmp.joiningDate || currentEmp.joining || "01 Jan 2025"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Appraisal Status</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 size={11} />
                  {primaryAppraisal?.status || "Completed"}
                </span>
              </div>
            </div>
          </div>

          {/* Executive Scorecard */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Overall Rating</span>
              <div className="my-2">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-black text-blue-900">{ratingValue.toFixed(1)}</span>
                  <span className="text-sm font-semibold text-blue-600">/ 5.0</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={14}
                      className={star <= Math.round(ratingValue) ? "text-amber-500 fill-amber-400" : "text-slate-300"}
                    />
                  ))}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-blue-800">
                Performance Level: {ratingTier?.label || "Exceeds Expectations"}
              </span>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Weighted Score</span>
              <div className="my-2">
                <div className="text-3xl font-black text-emerald-900">{weightedScore}%</div>
                <div className="w-full bg-emerald-200/60 rounded-full h-2 mt-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, weightedScore)}%` }}
                  />
                </div>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800">
                Composite benchmark index
              </span>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-200 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Competency Classification</span>
              <div className="my-2">
                <div className="text-base font-black text-purple-900 line-clamp-1">{ratingTier?.label || "Level 4 — Commendable"}</div>
                <p className="text-[11px] text-purple-700 mt-1 leading-snug">
                  {ratingTier?.description || "Consistently exceeds standard benchmarks with high ownership."}
                </p>
              </div>
              <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">
                HR Calibrated Result
              </span>
            </div>
          </div>

          {/* Key Performance Indicators (KPI Data Table) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Target size={14} className="text-blue-600" /> Key Performance Indicators (KPI Targets &amp; Results)
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2 px-3">KPI Name</th>
                    <th className="py-2 px-3">Target Benchmark</th>
                    <th className="py-2 px-3">Measurement</th>
                    <th className="py-2 px-3 text-center">Weight</th>
                    <th className="py-2 px-3 text-right">Status / Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeeKpis.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 px-3 text-center text-slate-400">
                        No individual KPIs mapped. Standard department KPIs applied.
                      </td>
                    </tr>
                  ) : (
                    employeeKpis.map((kpi, idx) => (
                      <tr key={kpi.id || idx} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{kpi.name}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">{kpi.target}</td>
                        <td className="py-2.5 px-3 text-slate-500">{kpi.measurementType || "Percentage"}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-blue-700">{kpi.weight || 15}%</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Achieved ({kpi.status || "Active"})
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Performance Competency Indicators */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers size={14} className="text-purple-600" /> Behavioral &amp; Technical Competency Indicators
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2 px-3">Indicator</th>
                    <th className="py-2 px-3">Department / Role</th>
                    <th className="py-2 px-3">Target Expectation</th>
                    <th className="py-2 px-3 text-center">Weight</th>
                    <th className="py-2 px-3 text-right">Rating Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeeIndicators.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 px-3 text-center text-slate-400">
                        General competency indicators referenced from appraisal template.
                      </td>
                    </tr>
                  ) : (
                    employeeIndicators.map((ind, idx) => (
                      <tr key={ind.id || idx} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{ind.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{ind.department || currentEmp.department}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">{ind.target || "≥ 95%"}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">{ind.weight || 15}%</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                          {Number(ind.rating || ratingValue).toFixed(1)} / 5.0
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Qualitative Reviews & Feedback Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Self Evaluation */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold uppercase text-[10.5px] text-slate-500 tracking-wider">
                  Employee Self-Assessment
                </span>
                <span className="font-bold text-blue-700">
                  Self Rating: {primaryAppraisal?.selfReview?.rating ? `${primaryAppraisal.selfReview.rating} / 5.0` : `${ratingValue.toFixed(1)} / 5.0`}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-700 text-[11px] block">Key Strengths Noted:</span>
                <p className="text-slate-600 mt-0.5 leading-relaxed">
                  {primaryAppraisal?.selfReview?.strengths ||
                    "Demonstrated outstanding ownership of deliverables, timely task execution, and effective cross-departmental collaboration."}
                </p>
              </div>
              <div>
                <span className="font-bold text-slate-700 text-[11px] block">Areas for Development:</span>
                <p className="text-slate-600 mt-0.5 leading-relaxed">
                  {primaryAppraisal?.selfReview?.areasForImprovement ||
                    "Expanding domain architecture skills and mentoring junior team members during sprint planning."}
                </p>
              </div>
            </div>

            {/* Manager Review */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold uppercase text-[10.5px] text-slate-500 tracking-wider">
                  Manager Review &amp; Recommendation
                </span>
                <span className="font-bold text-emerald-700">
                  Manager Rating: {primaryAppraisal?.managerReview?.rating ? `${primaryAppraisal.managerReview.rating} / 5.0` : `${ratingValue.toFixed(1)} / 5.0`}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-700 text-[11px] block">Manager Observations:</span>
                <p className="text-slate-600 mt-0.5 leading-relaxed">
                  {primaryAppraisal?.managerReview?.comments ||
                    "Consistently reliable, proactive problem-solver with high code quality and customer satisfaction metrics."}
                </p>
              </div>
              <div>
                <span className="font-bold text-slate-700 text-[11px] block">Developmental Plan:</span>
                <p className="text-slate-600 mt-0.5 leading-relaxed">
                  {primaryAppraisal?.managerReview?.developmentFeedback ||
                    "Recommended for specialized technical leadership certifications and strategic project ownership."}
                </p>
              </div>
            </div>
          </div>

          {/* HR Calibration Remarks */}
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-xs">
            <span className="font-bold text-blue-900 block text-[11px] uppercase tracking-wider mb-1">
              HR Calibration &amp; Committee Sign-off
            </span>
            <p className="text-blue-900/90 leading-relaxed">
              {primaryAppraisal?.hrReview?.comments ||
                "Performance verified and calibrated across organizational parity benchmarks. Recommended for standard annual merit increment and qualification for advancement opportunities."}
            </p>
          </div>

          {/* Formal Tripartite Sign-off Block */}
          <div className="pt-6 border-t-2 border-slate-200 grid grid-cols-3 gap-6 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Employee Signature
              </span>
              <div className="pt-6 border-b border-slate-300 w-full" />
              <div className="font-bold text-slate-900 pt-1">{currentEmp.name}</div>
              <div className="text-[10px] text-slate-500">Date: ____________________</div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Reporting Manager Signature
              </span>
              <div className="pt-6 border-b border-slate-300 w-full" />
              <div className="font-bold text-slate-900 pt-1">
                {primaryAppraisal?.reviewer || currentEmp.manager || "Department Head"}
              </div>
              <div className="text-[10px] text-slate-500">Date: ____________________</div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                HR Director / Calibration Head
              </span>
              <div className="pt-6 border-b border-slate-300 w-full" />
              <div className="font-bold text-slate-900 pt-1">{currentUser?.name || "HR Director"}</div>
              <div className="text-[10px] text-slate-500">Date: ____________________</div>
            </div>
          </div>

          {/* Minimal Document Footer */}
          <div className="pt-4 text-center text-[9.5px] text-slate-400 border-t border-slate-100">
            {companyProfile?.name || "Evenmore Technologies Inc."} • Official Employee Performance Appraisal Document • Confidential HR Copy
          </div>

        </div>

      </div>
    </div>
  );
}
