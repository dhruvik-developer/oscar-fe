import { useState, useMemo } from "react";
import { useAppStore } from "../../../stores/appStore";
import { usePerformanceStore, getRatingScaleTier, calculateWeightedScore } from "../../../stores/performanceStore";
import { RATING_SCALES as ratingScales } from "../../../services/performanceScales";
import { DataTable } from "../../../components/hrms/DataTable";
import { FilterBar } from "../../../components/hrms/FilterBar";
import { StatusBadge } from "../../../components/hrms/StatusBadge";
import { Modal } from "../../../components/hrms/Modal";
import { Drawer } from "../../../components/hrms/Drawer";
import { Button } from "../../../components/hrms/Button";
import PageInfoButton from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import {
  Eye,
  Pencil,
  Trash2,
  Star,
  CheckCircle,
  RotateCcw,
  Send,
  Sparkles,
  Award,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Users,
  Clock,
  History,
  Info,
  HelpCircle,
  FileText,
  Printer,
  TrendingUp,
} from "lucide-react";
import PerformanceReportModal from "./PerformanceReportModal";
import UserInitials from "../../../components/common/UserInitials";
import { createEmployeePromotion, createEmployeeAward } from "../../../services/upgradeService";

export default function Appraisal() {
  const showToast = useAppStore((s) => s.showToast);
  const employees = useAppStore((s) => s.employees) || [];
  const currentUser = useAppStore((s) => s.currentUser);

  const {
    appraisals,
    cycles,
    role,
    setRole,
    simulatedEmployeeName,
    simulatedManagerName,
    addAppraisal,
    updateAppraisal,
    deleteAppraisal,
    submitSelfReview,
    submitManagerReview,
    returnAppraisal,
    approveAppraisal,
    finalizeAppraisal,
    syncRatingToProfile,
  } = usePerformanceStore();

  // Active Tab: 'active' | 'history'
  const [tab, setTab] = useState("active");

  // Filters
  const [search, setSearch] = useState("");
  const [cycleFilter, setCycleFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [empFilter, setEmpFilter] = useState("All");

  // Performance Report State
  const [perfReportOpen, setPerfReportOpen] = useState(false);
  const [selectedPerfAppraisal, setSelectedPerfAppraisal] = useState(null);

  // Modals & Drawers
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [scaleGuideOpen, setScaleGuideOpen] = useState(false);

  // Workflow Action Modals
  const [selfReviewModalRow, setSelfReviewModalRow] = useState(null);
  const [selfForm, setSelfForm] = useState({ rating: 4.5, comments: "", strengths: "", areasForImprovement: "" });

  const [managerReviewModalRow, setManagerReviewModalRow] = useState(null);
  const [managerForm, setManagerForm] = useState({
    rating: 4.5,
    comments: "",
    strengths: "",
    areasForImprovement: "",
    developmentFeedback: "",
    kpiScores: [],
  });

  const [returnModalRow, setReturnModalRow] = useState(null);
  const [returnForm, setReturnForm] = useState({ returnTo: "Self Review", reason: "" });

  const [hrApproveRow, setHrApproveRow] = useState(null);
  const [hrComments, setHrComments] = useState("Calibrated across department benchmarks and approved.");

  // Performance Lifecycle Promotion & Award Actions
  const [promoModalRow, setPromoModalRow] = useState(null);
  const [promoForm, setPromoForm] = useState({ new_designation: '', new_salary: '', effective_date: new Date().toISOString().slice(0, 10), notes: '' });
  const [awardModalRow, setAwardModalRow] = useState(null);
  const [awardForm, setAwardForm] = useState({ award_name: 'Performance Excellence Award', cash_reward: '5000', citation: '', presentation_date: new Date().toISOString().slice(0, 10) });
  const [aiReviewSummary, setAiReviewSummary] = useState(null);

  function handleOpenPromotion(r) {
    const matchedEmp = employees.find((e) => e.name?.toLowerCase() === r.employee?.toLowerCase());
    setPromoModalRow(r);
    setPromoForm({
      new_designation: r.designation || matchedEmp?.designation || '',
      new_salary: String(matchedEmp?.standardSalary || matchedEmp?.salary || ''),
      effective_date: new Date().toISOString().slice(0, 10),
      notes: `Promoted following appraisal review in ${r.cycle} (Rating: ${Number(r.rating || 4.5).toFixed(1)}/5).`,
    });
  }

  async function handleSavePromotion(e) {
    e.preventDefault();
    if (!promoModalRow) return;
    try {
      const matchedEmp = employees.find((e) => e.name?.toLowerCase() === promoModalRow.employee?.toLowerCase());
      await createEmployeePromotion({
        employeeId: matchedEmp?.id || promoModalRow.employeeId || promoModalRow.id,
        employeeName: promoModalRow.employee,
        previous_designation: promoModalRow.designation,
        new_designation: promoForm.new_designation,
        previous_salary: Number(matchedEmp?.standardSalary || matchedEmp?.salary || 0),
        new_salary: Number(promoForm.new_salary || 0),
        effective_date: promoForm.effective_date,
        notes: promoForm.notes,
      });
      showToast(`Promotion recorded for ${promoModalRow.employee} to ${promoForm.new_designation}. Synced to lifecycle!`);
      setPromoModalRow(null);
    } catch (err) {
      showToast("Failed to record promotion: " + (err?.message || "Server error"), "error");
    }
  }

  function handleOpenAward(r) {
    setAwardModalRow(r);
    setAwardForm({
      award_name: `Top Performer - ${r.cycle || 'Quarterly Review'}`,
      cash_reward: '5000',
      citation: `Honored for outstanding appraisal rating of ${Number(r.rating || 4.5).toFixed(1)}/5 in ${r.cycle}.`,
      presentation_date: new Date().toISOString().slice(0, 10),
    });
  }

  async function handleSaveAward(e) {
    e.preventDefault();
    if (!awardModalRow) return;
    try {
      const matchedEmp = employees.find((e) => e.name?.toLowerCase() === awardModalRow.employee?.toLowerCase());
      const cash = parseFloat(awardForm.cash_reward) || 0;
      await createEmployeeAward({
        employeeId: matchedEmp?.id || awardModalRow.employeeId || awardModalRow.id,
        employeeName: awardModalRow.employee,
        award_name: awardForm.award_name,
        category: "Excellence",
        gift_amount: cash,
        cash_reward: cash,
        citation: awardForm.citation,
        award_date: awardForm.presentation_date,
      });
      showToast(`Excellence award recorded for ${awardModalRow.employee}! Synced to payroll.`);
      setAwardModalRow(null);
    } catch (err) {
      showToast("Failed to record award: " + (err?.message || "Server error"), "error");
    }
  }

  function handleGenerateAiInsights(r) {
    const rating = Number(r.rating || 4.0);
    let summary = "";
    let roadmap = "";
    if (rating >= 4.5) {
      summary = `Exceptional performer in ${r.cycle}. Demonstrates mastery in cross-functional execution and milestone ownership. Calibration score of ${rating.toFixed(1)}/5 places this employee in the top 10th percentile.`;
      roadmap = `Strong candidate for immediate career step-up to senior/lead designation, accompanied by compensation increment and mentorship of junior engineers.`;
    } else if (rating >= 4.0) {
      summary = `Strong and dependable performer in ${r.cycle}. Consistently met core KPI weights and demonstrated high initiative across sprint deliverables.`;
      roadmap = `Recommend targeted leadership training and expanded ownership of strategic client initiatives to prepare for promotion next appraisal cycle.`;
    } else {
      summary = `Satisfactory alignment with core responsibilities in ${r.cycle}. Delivers expected outputs with room for accelerated domain velocity.`;
      roadmap = `Establish bi-weekly coaching cadence and structured technical objectives to support performance enhancement.`;
    }
    setAiReviewSummary({ employee: r.employee, rating, summary, roadmap, cycle: r.cycle });
  }

  const employeeViewName = simulatedEmployeeName || currentUser?.name || "";
  const managerViewName = simulatedManagerName || currentUser?.name || "";
  const activeCycleName = String(cycles.find((c) => c.status === "Active")?.name || "")
    .replace("Performance Cycle", "")
    .replace("Appraisal Cycle", "")
    .trim();

  // Add/Edit Form State
  const [form, setForm] = useState({
    employee: "",
    employeeId: "",
    cycle: "",
    cycleId: "",
    reviewer: "",
    managerId: "",
    rating: 4.0,
    status: "Draft",
    stage: "Self Review",
    due: "",
    department: "",
    designation: "",
  });
  const [formErrors, setFormErrors] = useState({});

  function openAddModal() {
    const defaultCycle = cycles.find((c) => c.status === "Active") || cycles[0];
    const defaultEmp = uniqueEmployeeList[0] || employees[0];
    const dueStr = defaultCycle?.periodEnd || defaultCycle?.endDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    setForm({
      employee: defaultEmp?.name || "",
      employeeId: defaultEmp?.id || "",
      cycle: defaultCycle?.name || activeCycleName || "Performance Cycle",
      cycleId: defaultCycle?.id || "",
      reviewer: "",
      managerId: "",
      rating: 4.0,
      status: "Draft",
      stage: "Self Review",
      due: dueStr,
      department: defaultEmp?.department || "",
      designation: defaultEmp?.designation || "",
    });
    setFormErrors({});
    setAddOpen(true);
  }

  // Filter appraisals based on role and tab
  const filtered = useMemo(() => {
    return appraisals.filter((r) => {
      // History tab filter: only Completed/Archived appraisals or previous cycles
      if (tab === "history") {
        if (r.status !== "Completed" && r.cycle === activeCycleName) return false;
      } else {
        // Active tab: exclude old completed records from prior cycles
        if (r.status === "Completed" && r.cycle !== activeCycleName) return false;
      }

      // Role filter simulation
      if (role === "Employee") {
        if (String(r.employee ?? '').toLowerCase() !== employeeViewName.toLowerCase()) return false;
      } else if (role === "Manager") {
        if (String(r.reviewer ?? '').toLowerCase() !== managerViewName.toLowerCase()) return false;
      }

      if (search && !`${r.employee} ${r.cycle} ${r.reviewer} ${r.department}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (cycleFilter !== "All" && r.cycle !== cycleFilter) return false;
      if (deptFilter !== "All" && r.department !== deptFilter) return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (stageFilter !== "All" && r.stage !== stageFilter) return false;
      if (empFilter !== "All" && r.employee !== empFilter) return false;
      return true;
    });
  }, [appraisals, tab, role, employeeViewName, managerViewName, activeCycleName, search, cycleFilter, deptFilter, statusFilter, stageFilter, empFilter]);

  const uniqueEmployeeList = useMemo(() => {
    const seen = new Set();
    return (employees || []).filter((e) => {
      const n = (e.name || "").trim();
      if (!n || seen.has(n.toLowerCase())) return false;
      seen.add(n.toLowerCase());
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const empOpts = useMemo(() => [
    { value: "All", label: "All Employees" },
    ...[...new Set([...uniqueEmployeeList.map((e) => e.name), ...appraisals.map((a) => a.employee)])]
      .filter(Boolean)
      .sort()
      .map((name) => ({ value: name, label: name })),
  ], [uniqueEmployeeList, appraisals]);

  // Sync to Employee Profile
  function handleSyncToProfile(r) {
    const success = syncRatingToProfile(r.id);
    if (success) {
      showToast(`Appraisal rating (${r.rating.toFixed(1)}/5) synced to ${r.employee}'s employee profile & bonus record!`);
    } else {
      showToast(`Rating (${r.rating.toFixed(1)}/5) recorded for ${r.employee}.`);
    }
  }

  // Open Self-Review Modal
  function handleOpenSelfReview(r) {
    setSelfReviewModalRow(r);
    setSelfForm({
      rating: r.selfReview?.rating || r.rating || 4.0,
      comments: r.selfReview?.comments || "",
      strengths: r.selfReview?.strengths || "",
      areasForImprovement: r.selfReview?.areasForImprovement || "",
    });
  }

  // Submit Self-Review
  function handleSaveSelfReview() {
    if (!selfForm.comments.trim()) {
      showToast("Please provide self-review comments before submitting.");
      return;
    }
    submitSelfReview(selfReviewModalRow.id, selfForm);
    showToast(`Self-review submitted for ${selfReviewModalRow.employee}. Advanced to Manager Review.`);
    setSelfReviewModalRow(null);
  }

  // Open Manager Review Modal
  function handleOpenManagerReview(r) {
    setManagerReviewModalRow(r);
    setManagerForm({
      rating: r.managerReview?.rating || r.rating || 4.2,
      comments: r.managerReview?.comments || "",
      strengths: r.managerReview?.strengths || r.selfReview?.strengths || "",
      areasForImprovement: r.managerReview?.areasForImprovement || "",
      developmentFeedback: r.managerReview?.developmentFeedback || "",
      kpiScores: (r.kpiResults || []).map((k) => k.score || 4.0),
    });
  }

  // Submit Manager Review
  function handleSaveManagerReview() {
    if (!managerForm.comments.trim()) {
      showToast("Please provide manager review feedback before submitting.");
      return;
    }
    submitManagerReview(managerReviewModalRow.id, managerForm);
    showToast(`Manager review submitted for ${managerReviewModalRow.employee}. Advanced to HR Review.`);
    setManagerReviewModalRow(null);
  }

  // Open Return Modal
  function handleOpenReturn(r) {
    setReturnModalRow(r);
    setReturnForm({
      returnTo: r.stage === "HR Review" ? "Manager Review" : "Self Review",
      reason: "",
    });
  }

  // Submit Return
  function handleSaveReturn() {
    if (!returnForm.reason.trim()) {
      showToast("Please specify the reason for revision.");
      return;
    }
    returnAppraisal(returnModalRow.id, returnForm.returnTo, returnForm.reason);
    showToast(`Appraisal returned to ${returnForm.returnTo} with requested revisions.`);
    setReturnModalRow(null);
  }

  // Finalize
  function handleFinalize(r) {
    finalizeAppraisal(r.id);
    showToast(`Appraisal finalized for ${r.employee}. Rating synced to employee record.`);
  }

  // Validate Add/Edit Form
  function validateForm() {
    const errs = {};
    if (!form.employee?.trim() && !form.employeeId) errs.employee = "Employee is required";
    if (!form.reviewer?.trim() && !form.managerId) errs.reviewer = "Reviewer is required";
    if (!form.due?.trim()) errs.due = "Due date is required";
    if (form.rating < 1 || form.rating > 5) errs.rating = "Rating must be between 1.0 and 5.0";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // Save Add/Edit
  function save() {
    if (!validateForm()) return;

    if (editRow) {
      updateAppraisal(editRow.id, form);
      if (form.status === "Completed") {
        syncRatingToProfile(editRow.id);
      }
      showToast("Appraisal updated successfully.");
      setEditRow(null);
    } else {
      addAppraisal(form);
      showToast("Appraisal created successfully.");
      setAddOpen(false);
    }
  }

  // Table Columns
  const cols = [
    {
      key: "employee",
      header: "Employee",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <UserInitials name={r.employee} className="w-8 h-8 text-xs" />
          <div>
            <div className="font-semibold text-slate-800 text-[13px]">{r.employee}</div>
            <div className="text-[11px] text-slate-500">{r.designation} • {r.department}</div>
          </div>
        </div>
      ),
    },
    {
      key: "cycle",
      header: "Review Cycle",
      sortable: true,
      render: (r) => (
        <div>
          <span className="font-medium text-slate-800 text-[13px]">{r.cycle}</span>
          <span className="text-[11px] text-slate-500 block">Due: {r.due}</span>
        </div>
      ),
    },
    {
      key: "reviewer",
      header: "Reviewer",
      sortable: true,
      render: (r) => (
        <div className="text-[12.5px] text-slate-700">
          <span className="font-medium">{r.reviewer}</span>
        </div>
      ),
    },
    {
      key: "stage",
      header: "Workflow Stage",
      sortable: true,
      render: (r) => {
        let badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
        if (r.stage === "Manager Review") badgeColor = "bg-amber-50 text-amber-700 border-amber-200";
        if (r.stage === "HR Review") badgeColor = "bg-purple-50 text-purple-700 border-purple-200";
        if (r.stage === "Finalization") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";

        return (
          <div className="flex flex-col gap-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border w-max ${badgeColor}`}>
              {r.stage}
            </span>
            <div className="flex items-center gap-1 text-[10.5px] text-slate-400">
              <span className={r.stage === "Self Review" ? "font-bold text-slate-700" : ""}>Self</span> →
              <span className={r.stage === "Manager Review" ? "font-bold text-slate-700" : ""}>Mgr</span> →
              <span className={r.stage === "HR Review" ? "font-bold text-slate-700" : ""}>HR</span> →
              <span className={r.stage === "Finalization" ? "font-bold text-slate-700" : ""}>Final</span>
            </div>
          </div>
        );
      },
    },
    {
      key: "rating",
      header: "Rating & Score",
      sortable: true,
      render: (r) => (
        <div>
          <div className="flex items-center gap-1 font-semibold text-slate-900 text-[13px]">
            <Star size={13} className="text-amber-500 fill-amber-400" />
            {r.rating ? r.rating.toFixed(1) : "0.0"} / 5.0
          </div>
          <div className="text-[11px] text-slate-500">
            {r.ratingScaleLabel || getRatingScaleTier(r.rating).label} • {r.weightedScore || Math.round((r.rating / 5) * 100)}%
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => {
        const isEmployee = role === "Employee";
        const isManager = role === "Manager";
        const isHR = role === "HR";

        return (
          <div className="flex items-center gap-1 flex-wrap">
            {/* Contextual Action Button based on current role and stage */}
            {r.stage === "Self Review" && (isEmployee || isHR) && (
              <button
                onClick={() => handleOpenSelfReview(r)}
                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-[11px] font-medium border border-blue-200 transition flex items-center gap-1"
                title="Fill & Submit Self Review"
              >
                <Send size={11} /> Self Review
              </button>
            )}

            {r.stage === "Manager Review" && (isManager || isHR) && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleOpenManagerReview(r)}
                  className="px-2 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-xl text-[11px] font-medium border border-amber-200 transition flex items-center gap-1"
                  title="Manager Evaluation"
                >
                  <Award size={11} /> Review
                </button>
                <button
                  onClick={() => handleOpenReturn(r)}
                  className="px-1.5 py-1 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl text-[11px] font-medium border border-slate-200 transition flex items-center"
                  title="Return to Employee for Revision"
                >
                  <RotateCcw size={11} />
                </button>
              </div>
            )}

            {r.stage === "HR Review" && isHR && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setHrApproveRow(r);
                    setHrComments("Calibrated across department benchmarks and approved.");
                  }}
                  className="px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-[11px] font-medium border border-purple-200 transition flex items-center gap-1"
                  title="Calibrate & Approve Appraisal"
                >
                  <CheckCircle size={11} /> Calibrate
                </button>
                <button
                  onClick={() => handleOpenReturn(r)}
                  className="px-1.5 py-1 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl text-[11px] font-medium border border-slate-200 transition flex items-center"
                  title="Return to Manager"
                >
                  <RotateCcw size={11} />
                </button>
              </div>
            )}

            {r.stage === "Finalization" && isHR && r.status !== "Completed" && (
              <button
                onClick={() => handleFinalize(r)}
                className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-[11px] font-medium border border-emerald-200 transition flex items-center gap-1"
                title="Finalize and lock rating"
              >
                <CheckCircle size={11} /> Finalize
              </button>
            )}

            {/* Sync Rating Button */}
            {r.status === "Completed" && isHR && (
              <button
                onClick={() => handleSyncToProfile(r)}
                className="px-2 py-1 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-xl text-[11px] font-medium border border-[#e2e8f0] transition shadow-2xs"
                title="Sync Rating to Employee Profile & Bonus Record"
              >
                Sync
              </button>
            )}

            {/* Performance Report */}
            <button
              onClick={() => {
                setSelectedPerfAppraisal(r);
                setPerfReportOpen(true);
              }}
              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-[11px] font-medium border border-blue-200 transition flex items-center gap-1"
              title="Generate Employee Performance Report"
            >
              <FileText size={11} /> Report
            </button>

            {/* View Details Drawer */}
            <button
              onClick={() => setViewRow(r)}
              className="w-7 h-7 rounded-xl hover:bg-slate-100 text-slate-600 grid place-items-center transition"
              title="View full appraisal details"
            >
              <Eye size={14} />
            </button>

            {/* Edit (HR only or unsubmitted) */}
            {isHR && (
              <button
                onClick={() => {
                  const matchedCycle = cycles.find((cy) => cy.id === r.cycleId || cy.name === r.cycle);
                  setForm({
                    employee: r.employee,
                    employeeId: r.employeeId || "",
                    cycle: r.cycle,
                    cycleId: r.cycleId || matchedCycle?.id || "",
                    reviewer: r.reviewer,
                    managerId: r.managerId || "",
                    rating: r.rating,
                    status: r.status,
                    stage: r.stage || "Self Review",
                    due: r.due,
                    department: r.department,
                    designation: r.designation,
                  });
                  setFormErrors({});
                  setEditRow(r);
                }}
                className="w-7 h-7 rounded-xl hover:bg-slate-100 text-slate-600 grid place-items-center transition"
                title="Edit appraisal"
              >
                <Pencil size={14} />
              </button>
            )}

            {/* Delete (HR only) */}
            {isHR && (
              <button
                onClick={() => setDeleteRow(r)}
                className="w-7 h-7 rounded-xl hover:bg-red-50 text-red-600 grid place-items-center transition"
                title="Delete appraisal"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Header & Role Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-slate-800">Performance Appraisal</h1>
            <PageInfoButton guide={hrmsGuides.appraisal} />
            <button
              onClick={() => setScaleGuideOpen(true)}
              className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-600 hover:bg-slate-200 transition font-medium flex items-center gap-1"
              title="View 5-tier rating scale criteria"
            >
              <HelpCircle size={12} /> Rating Scale
            </button>
          </div>
          <p className="text-[13px] text-slate-500 mt-0.5">
            4-Stage Workflow: Self Review → Manager Review → HR Review → Finalization.
          </p>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">
          {/* Simulated Role Selector */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#e2e8f0] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-400 px-2">Role:</span>
            <button
              onClick={() => setRole("HR")}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition ${
                role === "HR" ? "bg-[#16233a] text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              HR / Admin
            </button>
            <button
              onClick={() => setRole("Manager")}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition ${
                role === "Manager" ? "bg-[#16233a] text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Manager
            </button>
            <button
              onClick={() => setRole("Employee")}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition ${
                role === "Employee" ? "bg-[#16233a] text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Employee
            </button>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              setSelectedPerfAppraisal(null);
              setPerfReportOpen(true);
            }}
          >
            <FileText size={14} className="text-blue-600 mr-1.5" />
            Performance Report
          </Button>

          {/* Add Appraisal Button (Available to HR/Admin) */}
          {role === "HR" && (
            <Button onClick={openAddModal}>
              + Add Appraisal
            </Button>
          )}
        </div>
      </div>

      {/* Tabs: Active Appraisals vs Performance History */}
      <div className="flex items-center justify-between border-b border-[#e2e8f0]">
        <div className="flex items-center gap-4 min-w-0 lg:min-w-auto overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
          <button
            onClick={() => setTab("active")}
            className={`pb-2.5 text-[13.5px] font-medium transition border-b-2 flex items-center gap-1.5 shrink-0 lg:shrink ${
              tab === "active"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Active Appraisals
            <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-blue-50 text-blue-700 font-semibold">
              {appraisals.filter((a) => a.status !== "Completed" || a.cycle === activeCycleName).length}
            </span>
          </button>

          <button
            onClick={() => setTab("history")}
            className={`pb-2.5 text-[13.5px] font-medium transition border-b-2 flex items-center gap-1.5 shrink-0 lg:shrink ${
              tab === "history"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History size={14} />
            Performance History
            <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-slate-100 text-slate-600 font-semibold">
              {appraisals.filter((a) => a.status === "Completed").length}
            </span>
          </button>
        </div>

        {/* Active simulated role alert info */}
        <div className="text-[12px] text-slate-500 hidden sm:flex items-center gap-1">
          <Info size={13} className="text-blue-500" />
          <span>
            {role === "Employee" && `Showing reviews for employee: ${employeeViewName}`}
            {role === "Manager" && `Showing reviews assigned to manager: ${managerViewName}`}
            {role === "HR" && "Full administrative view across all departments"}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearch={setSearch}
        selects={[
          {
            label: "Employee",
            value: empFilter,
            onChange: setEmpFilter,
            options: empOpts,
          },
          {
            label: "Cycle",
            value: cycleFilter,
            onChange: setCycleFilter,
            options: [
              { value: "All", label: "All Cycles" },
              ...cycles.map((c) => ({
                value: c.name.replace("Performance Cycle", "").replace("Appraisal Cycle", "").trim(),
                label: c.name,
              })),
            ],
          },
          {
            label: "Department",
            value: deptFilter,
            onChange: setDeptFilter,
            options: [
              { value: "All", label: "All Departments" },
              { value: "Engineering", label: "Engineering" },
              { value: "Design", label: "Design" },
              { value: "Marketing", label: "Marketing" },
              { value: "Finance", label: "Finance" },
              { value: "HR", label: "HR" },
              { value: "Operations", label: "Operations" },
            ],
          },
          {
            label: "Stage",
            value: stageFilter,
            onChange: setStageFilter,
            options: [
              { value: "All", label: "All Stages" },
              { value: "Self Review", label: "Self Review" },
              { value: "Manager Review", label: "Manager Review" },
              { value: "HR Review", label: "HR Review" },
              { value: "Finalization", label: "Finalization" },
            ],
          },
          {
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "All", label: "All Statuses" },
              { value: "Draft", label: "Draft" },
              { value: "Pending", label: "Pending" },
              { value: "In Progress", label: "In Progress" },
              { value: "Submitted", label: "Submitted" },
              { value: "Approved", label: "Approved" },
              { value: "Completed", label: "Completed" },
              { value: "Overdue", label: "Overdue" },
              { value: "Returned", label: "Returned" },
            ],
          },
        ]}
        onClear={() => {
          setSearch("");
          setEmpFilter("All");
          setCycleFilter("All");
          setDeptFilter("All");
          setStatusFilter("All");
          setStageFilter("All");
        }}
      />

      {/* Main DataTable */}
      <DataTable
        columns={cols}
        data={filtered}
        emptyTitle={tab === "history" ? "No historical appraisals found" : "No appraisals found"}
        emptyDesc="Try clearing your filters or switch the simulated role perspective."
        emptyAction={
          role === "HR" && (
            <Button onClick={openAddModal}>+ Add Appraisal</Button>
          )
        }
      />

      {/* Add / Edit Appraisal Modal */}
      <Modal
        isOpen={addOpen || !!editRow}
        onClose={() => {
          setAddOpen(false);
          setEditRow(null);
        }}
        title={editRow ? "Edit Appraisal Record" : "Initiate Performance Appraisal"}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setAddOpen(false);
                setEditRow(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={save}>Save Appraisal</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Employee *</span>
            <select
              value={form.employeeId || form.employee}
              onChange={(e) => {
                const val = e.target.value;
                const emp = uniqueEmployeeList.find((x) => x.id === val || x.name === val);
                setForm({
                  ...form,
                  employee: emp?.name || val,
                  employeeId: emp?.id || val,
                  department: emp?.department || form.department,
                  designation: emp?.designation || form.designation,
                });
              }}
              className={`h-9 px-3 bg-white border rounded-xl text-[13px] ${
                formErrors.employee ? "border-red-500" : "border-[#e2e8f0]"
              }`}
            >
              <option value="">Select Employee</option>
              {uniqueEmployeeList.map((e) => (
                <option key={e.id || e.name} value={e.id || e.name}>
                  {e.name}{e.department || e.designation ? ` (${e.department || e.designation})` : ""}
                </option>
              ))}
            </select>
            {formErrors.employee && <span className="text-[11px] text-red-500">{formErrors.employee}</span>}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Review Cycle</span>
            <select
              value={form.cycleId || form.cycle}
              onChange={(e) => {
                const val = e.target.value;
                const cyc = cycles.find((c) => c.id === val || c.name === val);
                setForm({
                  ...form,
                  cycleId: cyc?.id || val,
                  cycle: cyc?.name || val,
                  due: cyc?.periodEnd || cyc?.endDate || form.due,
                });
              }}
              className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
            >
              {cycles.length === 0 && <option value="">Default Performance Cycle</option>}
              {cycles.map((c) => (
                <option key={c.id || c.name} value={c.id || c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Reviewer *</span>
            <select
              value={form.managerId || form.reviewer}
              onChange={(e) => {
                const val = e.target.value;
                const rev = uniqueEmployeeList.find((x) => x.id === val || x.name === val);
                setForm({
                  ...form,
                  reviewer: rev?.name || val,
                  managerId: rev?.id || val,
                });
              }}
              className={`h-9 px-3 bg-white border rounded-xl text-[13px] ${
                formErrors.reviewer ? "border-red-500" : "border-[#e2e8f0]"
              }`}
            >
              <option value="">Select Reviewer</option>
              {uniqueEmployeeList.map((e) => (
                <option key={e.id || e.name} value={e.id || e.name}>
                  {e.name}{e.designation ? ` (${e.designation})` : ""}
                </option>
              ))}
            </select>
            {formErrors.reviewer && <span className="text-[11px] text-red-500">{formErrors.reviewer}</span>}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Initial Rating (1.0 - 5.0)</span>
            <input
              type="number"
              step={0.1}
              min={1}
              max={5}
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
              className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Workflow Stage</span>
            <select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
              className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
            >
              <option>Self Review</option>
              <option>Manager Review</option>
              <option>HR Review</option>
              <option>Finalization</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Appraisal Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
            >
              <option>Draft</option>
              <option>Pending</option>
              <option>In Progress</option>
              <option>Submitted</option>
              <option>Approved</option>
              <option>Completed</option>
              <option>Overdue</option>
              <option>Returned</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] font-medium text-slate-500">Due Date *</span>
            <input
              type="date"
              value={form.due}
              onChange={(e) => setForm({ ...form, due: e.target.value })}
              className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px] cursor-pointer"
            />
          </label>
        </div>
      </Modal>

      {/* ── Workflow Action Modal 1: Submit Self Review ───────────── */}
      <Modal
        isOpen={!!selfReviewModalRow}
        onClose={() => setSelfReviewModalRow(null)}
        title={`Self Evaluation — ${selfReviewModalRow?.employee}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelfReviewModalRow(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSelfReview}>
              Submit to Manager
            </Button>
          </>
        }
      >
        {selfReviewModalRow && (
          <div className="flex flex-col gap-4 text-[13px]">
            <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl text-blue-900 text-[12px] leading-relaxed">
              Fill out your self-evaluation comments, highlight key achievements, and specify areas for growth. Submitting will advance your appraisal to <b>Manager Review</b>.
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-slate-700">Self Rating (1.0 to 5.0)</span>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step={0.1}
                  min={1}
                  max={5}
                  value={selfForm.rating}
                  onChange={(e) => setSelfForm({ ...selfForm, rating: Number(e.target.value) })}
                  className="h-9 w-24 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
                />
                <span className="text-[12px] font-medium text-slate-500">
                  {getRatingScaleTier(selfForm.rating).label}
                </span>
              </div>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-slate-700">Self Evaluation Summary *</span>
              <textarea
                rows={3}
                value={selfForm.comments}
                onChange={(e) => setSelfForm({ ...selfForm, comments: e.target.value })}
                placeholder="Describe your quarterly milestones, deliverables, and contributions..."
                className="p-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-slate-700">Key Strengths</span>
              <input
                type="text"
                value={selfForm.strengths}
                onChange={(e) => setSelfForm({ ...selfForm, strengths: e.target.value })}
                placeholder="e.g. Code quality, mentorship, problem solving"
                className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-slate-700">Areas for Improvement</span>
              <input
                type="text"
                value={selfForm.areasForImprovement}
                onChange={(e) => setSelfForm({ ...selfForm, areasForImprovement: e.target.value })}
                placeholder="e.g. Cross-functional documentation, automated testing coverage"
                className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
              />
            </label>
          </div>
        )}
      </Modal>

      {/* ── Workflow Action Modal 2: Submit Manager Review ────────── */}
      <Modal
        isOpen={!!managerReviewModalRow}
        onClose={() => setManagerReviewModalRow(null)}
        title={`Manager Review — ${managerReviewModalRow?.employee}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setManagerReviewModalRow(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveManagerReview}>
              Submit to HR Review
            </Button>
          </>
        }
      >
        {managerReviewModalRow && (
          <div className="flex flex-col gap-4 text-[13px] max-h-[75vh] overflow-y-auto pr-1">
            {managerReviewModalRow.selfReview?.comments && (
              <div className="p-3 bg-slate-50 border border-[#e2e8f0] rounded-xl">
                <span className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                  Employee's Self Evaluation (Score: {managerReviewModalRow.selfReview.rating}/5)
                </span>
                <p className="text-[12.5px] text-slate-700 italic">
                  "{managerReviewModalRow.selfReview.comments}"
                </p>
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-slate-700">Manager Rating (1.0 to 5.0) *</span>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step={0.1}
                  min={1}
                  max={5}
                  value={managerForm.rating}
                  onChange={(e) => setManagerForm({ ...managerForm, rating: Number(e.target.value) })}
                  className="h-9 w-24 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
                />
                <span className="text-[12px] font-medium text-slate-500">
                  {getRatingScaleTier(managerForm.rating).label}
                </span>
              </div>
            </label>

            {/* KPI / Indicator item scores */}
            {managerReviewModalRow.kpiResults && managerReviewModalRow.kpiResults.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[11.5px] font-medium text-slate-700">Indicator & KPI Score Adjustments</span>
                <div className="space-y-2">
                  {managerReviewModalRow.kpiResults.map((kpi, idx) => (
                    <div key={kpi.name} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-[#e2e8f0] text-[12px]">
                      <div>
                        <div className="font-medium text-slate-800">{kpi.name}</div>
                        <div className="text-[11px] text-slate-500">Target: {kpi.target} • Weight: {kpi.weight}%</div>
                      </div>
                      <input
                        type="number"
                        step={0.1}
                        min={1}
                        max={5}
                        value={managerForm.kpiScores[idx] ?? kpi.score}
                        onChange={(e) => {
                          const updated = [...managerForm.kpiScores];
                          updated[idx] = Number(e.target.value);
                          setManagerForm({ ...managerForm, kpiScores: updated });
                        }}
                        className="h-8 w-16 px-2 text-center bg-white border border-[#e2e8f0] rounded-lg text-[12px]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-slate-700">Manager Narrative & Feedback *</span>
              <textarea
                rows={3}
                value={managerForm.comments}
                onChange={(e) => setManagerForm({ ...managerForm, comments: e.target.value })}
                placeholder="Comprehensive evaluation of performance against departmental benchmarks..."
                className="p-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-medium text-slate-700">Observed Strengths</span>
                <input
                  type="text"
                  value={managerForm.strengths}
                  onChange={(e) => setManagerForm({ ...managerForm, strengths: e.target.value })}
                  placeholder="e.g. Technical leadership"
                  className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-medium text-slate-700">Areas for Improvement</span>
                <input
                  type="text"
                  value={managerForm.areasForImprovement}
                  onChange={(e) => setManagerForm({ ...managerForm, areasForImprovement: e.target.value })}
                  placeholder="e.g. Cross-team collaboration"
                  className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-slate-700">Development Feedback & Growth Path</span>
              <textarea
                rows={2}
                value={managerForm.developmentFeedback}
                onChange={(e) => setManagerForm({ ...managerForm, developmentFeedback: e.target.value })}
                placeholder="Recommended training, promotion roadmap, or mentoring initiatives..."
                className="p-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
              />
            </label>
          </div>
        )}
      </Modal>

      {/* ── Workflow Action Modal 3: Return to Previous Stage ────── */}
      <Modal
        isOpen={!!returnModalRow}
        onClose={() => setReturnModalRow(null)}
        title={`Return Appraisal — ${returnModalRow?.employee}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReturnModalRow(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleSaveReturn}>
              Return for Revision
            </Button>
          </>
        }
      >
        {returnModalRow && (
          <div className="flex flex-col gap-4 text-[13px]">
            <p className="text-slate-600">
              Return appraisal for <b>{returnModalRow.employee}</b> back for revision. The previous reviewer will receive notification to update their entries.
            </p>

            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-slate-700">Return to Stage</span>
              <select
                value={returnForm.returnTo}
                onChange={(e) => setReturnForm({ ...returnForm, returnTo: e.target.value })}
                className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
              >
                <option value="Self Review">Self Review (Employee Revision)</option>
                <option value="Manager Review">Manager Review (Manager Revision)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-slate-700">Reason for Revision *</span>
              <textarea
                rows={3}
                value={returnForm.reason}
                onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                placeholder="Explain clearly what information or metrics need adjustment..."
                className="p-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
              />
            </label>
          </div>
        )}
      </Modal>

      {/* ── Workflow Action Modal 4: HR Calibrate & Approve ──────── */}
      <Modal
        isOpen={!!hrApproveRow}
        onClose={() => setHrApproveRow(null)}
        title={`Calibrate & Approve — ${hrApproveRow?.employee}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setHrApproveRow(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                approveAppraisal(hrApproveRow.id, hrComments);
                showToast(`Appraisal approved by HR Admin for ${hrApproveRow.employee}. Ready for finalization.`);
                setHrApproveRow(null);
              }}
            >
              Approve & Advance
            </Button>
          </>
        }
      >
        {hrApproveRow && (
          <div className="flex flex-col gap-4 text-[13px]">
            <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl text-purple-900 text-[12px] leading-relaxed">
              Review calibrated ratings and manager observations for <b>{hrApproveRow.employee}</b>. Approving this appraisal advances it to <b>Finalization</b>.
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-[#e2e8f0] rounded-xl text-[12px]">
              <div>
                <span className="text-slate-400 block">Current Rating</span>
                <span className="font-bold text-slate-900 text-[14px]">{hrApproveRow.rating.toFixed(1)} / 5.0</span>
              </div>
              <div>
                <span className="text-slate-400 block">Scale Classification</span>
                <span className="font-bold text-slate-900 text-[14px]">{hrApproveRow.ratingScaleLabel}</span>
              </div>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-medium text-slate-700">HR Calibration Remarks</span>
              <textarea
                rows={3}
                value={hrComments}
                onChange={(e) => setHrComments(e.target.value)}
                placeholder="Add departmental calibration notes or promotion packet verification..."
                className="p-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
              />
            </label>
          </div>
        )}
      </Modal>

      {/* ── Detail Drawer (Rich Appraisal View) ───────────────────── */}
      <Drawer
        isOpen={!!viewRow}
        onClose={() => setViewRow(null)}
        title={viewRow?.employee ?? ""}
        subtitle={`${viewRow?.designation} • ${viewRow?.department} (${viewRow?.cycle})`}
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedPerfAppraisal(viewRow);
                  setPerfReportOpen(true);
                }}
              >
                <FileText size={14} className="text-blue-600 mr-1.5" />
                Performance Report
              </Button>
              {role === "HR" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleOpenPromotion(viewRow)}
                  >
                    <TrendingUp size={14} className="text-blue-600 mr-1.5" />
                    Promote
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleOpenAward(viewRow)}
                  >
                    <Award size={14} className="text-amber-600 mr-1.5" />
                    Award
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={() => handleGenerateAiInsights(viewRow)}
              >
                <Sparkles size={14} className="text-indigo-600 mr-1.5" />
                AI Review
              </Button>
              {role === "HR" && viewRow?.status === "Completed" && (
                <Button onClick={() => handleSyncToProfile(viewRow)}>
                  Sync to Profile
                </Button>
              )}
            </div>
            <Button variant="secondary" onClick={() => setViewRow(null)}>
              Close
            </Button>
          </div>
        }
      >
        {viewRow && (
          <div className="flex flex-col gap-5 text-[13px]">
            {/* Stage Progress Bar Banner */}
            <div className="p-4 bg-slate-50 border border-[#e2e8f0] rounded-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Current Stage</span>
                <StatusBadge status={viewRow.status} />
              </div>
              <div className="flex items-center justify-between text-[12px] font-medium text-slate-800">
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    viewRow.selfReview?.submitted ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                  }`}>1</div>
                  <span>Self Review</span>
                </div>
                <ArrowRight size={13} className="text-slate-400" />
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    viewRow.managerReview?.submitted ? 'bg-emerald-600 text-white' : viewRow.stage === 'Manager Review' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>2</div>
                  <span>Manager</span>
                </div>
                <ArrowRight size={13} className="text-slate-400" />
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    viewRow.hrReview?.approved ? 'bg-emerald-600 text-white' : viewRow.stage === 'HR Review' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>3</div>
                  <span>HR</span>
                </div>
                <ArrowRight size={13} className="text-slate-400" />
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    viewRow.status === 'Completed' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>4</div>
                  <span>Final</span>
                </div>
              </div>
            </div>

            {/* Score & Tier Highlight Card */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-white border border-[#e2e8f0] rounded-2xl shadow-2xs">
              <div>
                <span className="text-[11px] uppercase text-slate-400 font-semibold block">Overall Rating</span>
                <div className="flex items-center gap-1.5 mt-0.5 font-bold text-[20px] text-slate-900">
                  <Star size={18} className="text-amber-500 fill-amber-400" />
                  {viewRow.rating.toFixed(1)} <span className="text-[13px] font-normal text-slate-400">/ 5.0</span>
                </div>
                <span className="text-[12px] text-blue-600 font-semibold">{viewRow.ratingScaleLabel}</span>
              </div>
              <div className="border-l border-[#e2e8f0] pl-3">
                <span className="text-[11px] uppercase text-slate-400 font-semibold block">Weighted Performance</span>
                <div className="mt-0.5 font-bold text-[20px] text-emerald-600">
                  {viewRow.weightedScore || Math.round((viewRow.rating / 5) * 100)}%
                </div>
                <span className="text-[11px] text-slate-400 block">Calculated from KPI results</span>
              </div>
            </div>

            {/* Structured Performance Feedback Sections */}
            <div className="flex flex-col gap-3">
              <h4 className="font-bold text-[14px] text-slate-800 flex items-center gap-1.5">
                <Sparkles size={15} className="text-blue-500" /> Performance Feedback
              </h4>

              {/* Manager Feedback */}
              <div className="p-3.5 bg-white border border-[#e2e8f0] rounded-xl flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-slate-800">Manager Evaluation</span>
                  <span className="text-[11px] text-slate-400">Reviewer: {viewRow.reviewer}</span>
                </div>
                <p className="text-[12.5px] text-slate-700 leading-relaxed">
                  {viewRow.managerReview?.comments || "Manager evaluation pending submission."}
                </p>
                {viewRow.managerReview?.developmentFeedback && (
                  <div className="mt-2 pt-2 border-t border-[#f1f5f9] text-[12px]">
                    <span className="font-semibold text-slate-800 block text-[11px] uppercase text-slate-400">Development Feedback:</span>
                    <p className="text-slate-600">{viewRow.managerReview.developmentFeedback}</p>
                  </div>
                )}
              </div>

              {/* Employee Comments */}
              <div className="p-3.5 bg-white border border-[#e2e8f0] rounded-xl flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-slate-800">Employee Self-Reflection</span>
                  <span className="text-[11px] text-slate-400">
                    {viewRow.selfReview?.completedAt ? `Submitted on ${viewRow.selfReview.completedAt}` : "Pending"}
                  </span>
                </div>
                <p className="text-[12.5px] text-slate-700 leading-relaxed">
                  {viewRow.selfReview?.comments || "Self-evaluation narrative not yet submitted."}
                </p>
              </div>

              {/* Strengths & Areas for Improvement Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50/40 border border-emerald-200/70 rounded-xl">
                  <span className="text-[11px] font-bold uppercase text-emerald-800 block mb-1">Key Strengths</span>
                  <p className="text-[12px] text-slate-700">
                    {viewRow.managerReview?.strengths || viewRow.selfReview?.strengths || "Strengths documented in final review."}
                  </p>
                </div>
                <div className="p-3 bg-amber-50/40 border border-amber-200/70 rounded-xl">
                  <span className="text-[11px] font-bold uppercase text-amber-800 block mb-1">Areas for Improvement</span>
                  <p className="text-[12px] text-slate-700">
                    {viewRow.managerReview?.areasForImprovement || viewRow.selfReview?.areasForImprovement || "Development focus areas documented in final review."}
                  </p>
                </div>
              </div>
            </div>

            {/* KPI & Indicator Breakdown */}
            {viewRow.kpiResults && viewRow.kpiResults.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="font-bold text-[14px] text-slate-800">Indicator & KPI Breakdown</h4>
                <div className="space-y-2">
                  {viewRow.kpiResults.map((k) => (
                    <div key={k.name} className="p-2.5 bg-slate-50 border border-[#e2e8f0] rounded-xl flex items-center justify-between text-[12px]">
                      <div>
                        <div className="font-medium text-slate-800">{k.name}</div>
                        <div className="text-[11px] text-slate-500">Target: {k.target} • Actual: <b>{k.actual}</b> (Weight: {k.weight}%)</div>
                      </div>
                      <div className="font-bold text-slate-900 flex items-center gap-1">
                        <Star size={11} className="text-amber-500 fill-amber-400" />
                        {Number(k.score).toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit History Timeline */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#e2e8f0]">
              <h4 className="font-bold text-[13px] text-slate-800 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" /> Stage Audit History
              </h4>
              <div className="space-y-2">
                {(viewRow.history || []).map((h, i) => (
                  <div key={i} className="text-[12px] p-2.5 bg-white border border-[#e2e8f0] rounded-xl flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{h.action}</span>
                      <span className="text-[10.5px] text-slate-400">{h.date}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">By: {h.actor}</span>
                    {h.note && <span className="text-[11.5px] text-slate-600 italic">"{h.note}"</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Rating Scale Guide Modal ─────────────────────────────── */}
      <Modal
        isOpen={scaleGuideOpen}
        onClose={() => setScaleGuideOpen(false)}
        title="Configurable Rating Scale Criteria"
        footer={
          <Button variant="secondary" onClick={() => setScaleGuideOpen(false)}>
            Got it
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-[13px]">
          <p className="text-slate-500 text-[12.5px]">
            Standardized 5-tier evaluation system used for all employee appraisals, KPI weight calculations, and compensation calibrations.
          </p>
          <div className="space-y-2 mt-1">
            {ratingScales.map((s) => (
              <div key={s.value} className="p-3 bg-slate-50 border border-[#e2e8f0] rounded-xl flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Star size={14} className="text-amber-500 fill-amber-400" />
                    Tier {s.value}: {s.label}
                  </div>
                  <span className="text-[11px] px-2 py-0.5 bg-white border border-[#e2e8f0] rounded-full text-slate-600 font-semibold">
                    Score ≥ {s.minScore}
                  </span>
                </div>
                <p className="text-[12px] text-slate-600 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        title="Delete Appraisal?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteRow) deleteAppraisal(deleteRow.id);
                setDeleteRow(null);
                showToast("Appraisal deleted successfully.");
              }}
            >
              Delete Appraisal
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-slate-600">
          Are you sure you want to delete the appraisal for <b>{deleteRow?.employee}</b> ({deleteRow?.cycle})? This action cannot be undone.
        </p>
      </Modal>

      {/* Performance & Appraisal Report Modal */}
      <PerformanceReportModal
        isOpen={perfReportOpen}
        onClose={() => setPerfReportOpen(false)}
        appraisal={selectedPerfAppraisal}
      />

      {/* ── Career Promotion Modal ────────────────────────────── */}
      <Modal
        isOpen={!!promoModalRow}
        onClose={() => setPromoModalRow(null)}
        title={`Promote Employee — ${promoModalRow?.employee}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPromoModalRow(null)}>
              Cancel
            </Button>
            <Button onClick={handleSavePromotion}>
              Confirm Promotion & Update Lifecycle
            </Button>
          </>
        }
      >
        {promoModalRow && (
          <form onSubmit={handleSavePromotion} className="flex flex-col gap-3.5 text-[13px]">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-xs">
              Promoting <b>{promoModalRow.employee}</b> directly based on appraisal review rating of <b>{Number(promoModalRow.rating || 4.5).toFixed(1)}/5</b>.
              This records a career promotion and updates compensation in the employee directory and payroll.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-slate-700">Current Designation</span>
                <input
                  type="text"
                  readOnly
                  value={promoModalRow.designation || "Staff"}
                  className="p-2.5 bg-slate-100 border border-[#e2e8f0] rounded-xl text-slate-500 font-medium"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-slate-700">Promoted Designation *</span>
                <input
                  type="text"
                  required
                  value={promoForm.new_designation}
                  onChange={(e) => setPromoForm({ ...promoForm, new_designation: e.target.value })}
                  placeholder="e.g. Senior Software Engineer"
                  className="p-2.5 bg-white border border-[#e2e8f0] rounded-xl text-slate-800"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-slate-700">Revised Salary (Monthly CTC)</span>
                <input
                  type="number"
                  value={promoForm.new_salary}
                  onChange={(e) => setPromoForm({ ...promoForm, new_salary: e.target.value })}
                  placeholder="e.g. 60000"
                  className="p-2.5 bg-white border border-[#e2e8f0] rounded-xl text-slate-800 font-mono"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-slate-700">Effective Date *</span>
                <input
                  type="date"
                  required
                  value={promoForm.effective_date}
                  onChange={(e) => setPromoForm({ ...promoForm, effective_date: e.target.value })}
                  className="p-2.5 bg-white border border-[#e2e8f0] rounded-xl text-slate-800"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-slate-700">Justification & Notes</span>
              <textarea
                rows={2}
                value={promoForm.notes}
                onChange={(e) => setPromoForm({ ...promoForm, notes: e.target.value })}
                className="p-2.5 bg-white border border-[#e2e8f0] rounded-xl text-slate-800 text-xs"
              />
            </label>
          </form>
        )}
      </Modal>

      {/* ── Spot Award Modal ──────────────────────────────────── */}
      <Modal
        isOpen={!!awardModalRow}
        onClose={() => setAwardModalRow(null)}
        title={`Grant Performance Award — ${awardModalRow?.employee}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAwardModalRow(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAward}>
              Present Award & Push to Payroll
            </Button>
          </>
        }
      >
        {awardModalRow && (
          <form onSubmit={handleSaveAward} className="flex flex-col gap-3.5 text-[13px]">
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs">
              Grant spot excellence award to <b>{awardModalRow.employee}</b>. Cash reward is automatically included in the upcoming payroll run as an earning bonus.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-slate-700">Award Title *</span>
                <input
                  type="text"
                  required
                  value={awardForm.award_name}
                  onChange={(e) => setAwardForm({ ...awardForm, award_name: e.target.value })}
                  className="p-2.5 bg-white border border-[#e2e8f0] rounded-xl text-slate-800"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-slate-700">Cash Prize / Reward (₹)</span>
                <input
                  type="number"
                  value={awardForm.cash_reward}
                  onChange={(e) => setAwardForm({ ...awardForm, cash_reward: e.target.value })}
                  placeholder="5000"
                  className="p-2.5 bg-white border border-[#e2e8f0] rounded-xl text-slate-800 font-mono"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-slate-700">Official Citation</span>
              <textarea
                rows={2}
                value={awardForm.citation}
                onChange={(e) => setAwardForm({ ...awardForm, citation: e.target.value })}
                className="p-2.5 bg-white border border-[#e2e8f0] rounded-xl text-slate-800 text-xs"
              />
            </label>
          </form>
        )}
      </Modal>

      {/* ── AI Review Insights Modal ──────────────────────────── */}
      <Modal
        isOpen={!!aiReviewSummary}
        onClose={() => setAiReviewSummary(null)}
        title={`AI Performance Evaluation — ${aiReviewSummary?.employee}`}
        footer={
          <Button onClick={() => setAiReviewSummary(null)}>
            Done
          </Button>
        }
      >
        {aiReviewSummary && (
          <div className="flex flex-col gap-4 text-xs">
            <div className="p-3.5 bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] text-blue-200 uppercase font-bold tracking-wider">Calibration Grade</span>
                <div className="text-xl font-bold flex items-center gap-1.5 mt-0.5">
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                  <span>{aiReviewSummary.rating.toFixed(1)} / 5.0</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-blue-200">Cycle</span>
                <div className="font-semibold text-sm">{aiReviewSummary.cycle}</div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-600" /> Executive Evaluation Summary
              </span>
              <p className="text-slate-600 leading-relaxed text-[12px]">{aiReviewSummary.summary}</p>
            </div>

            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1.5">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-emerald-600" /> Career Growth & Promotion Roadmap
              </span>
              <p className="text-emerald-800 leading-relaxed text-[12px]">{aiReviewSummary.roadmap}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
