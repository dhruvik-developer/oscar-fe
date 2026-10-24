import { useState, useMemo } from "react";
import { useAppStore } from "../../../stores/appStore";
import { usePerformanceStore } from "../../../stores/performanceStore";
import { MetricCard } from "../../../components/hrms/MetricCard";
import { DataTable } from "../../../components/hrms/DataTable";
import { StatusBadge } from "../../../components/hrms/StatusBadge";
import { Modal } from "../../../components/hrms/Modal";
import { Button } from "../../../components/hrms/Button";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  Star,
  Activity,
  AlertTriangle,
  Plus,
  Pencil,
  Eye,
  ChevronRight,
  UserCheck,
  ShieldCheck,
  Users,
  Calendar,
  Layers,
  Sparkles,
  Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  const {
    cycles,
    activeCycleId,
    appraisals,
    role,
    setRole,
    simulatedEmployeeName,
    simulatedManagerName,
    addCycle,
    updateCycle,
    setActiveCycleId,
    getMetrics,
  } = usePerformanceStore();

  const metrics = getMetrics();
  const metricIcons = [CalendarCheck, Clock, CheckCircle2, Star, Activity, AlertTriangle];

  // Cycle Modal States
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState(null);
  const [cycleForm, setCycleForm] = useState({
    name: "",
    reviewPeriod: "",
    startDate: "",
    endDate: "",
    reviewFrequency: "Quarterly",
    status: "Active",
    description: "",
  });
  const [cycleErrors, setCycleErrors] = useState({});

  // Cycle Details Modal
  const [viewingCycle, setViewingCycle] = useState(null);

  // Table Filter
  const [stageFilter, setStageFilter] = useState("All");

  const activeCycle = cycles.find((c) => c.id === activeCycleId) || cycles[0];

  // Filtered appraisals based on selected role
  const roleAppraisals = useMemo(() => {
    let list = appraisals;
    if (role === "Employee") {
      list = appraisals.filter(
        (a) => String(a.employee ?? '').toLowerCase() === simulatedEmployeeName.toLowerCase()
      );
    } else if (role === "Manager") {
      list = appraisals.filter(
        (a) => String(a.reviewer ?? '').toLowerCase() === simulatedManagerName.toLowerCase()
      );
    }

    if (stageFilter !== "All") {
      list = list.filter((a) => a.stage === stageFilter);
    }
    return list;
  }, [appraisals, role, simulatedEmployeeName, simulatedManagerName, stageFilter]);

  // Stage distribution counts
  const stageCounts = useMemo(() => {
    return {
      all: appraisals.length,
      selfReview: appraisals.filter((a) => a.stage === "Self Review").length,
      managerReview: appraisals.filter((a) => a.stage === "Manager Review").length,
      hrReview: appraisals.filter((a) => a.stage === "HR Review").length,
      finalization: appraisals.filter((a) => a.stage === "Finalization").length,
      completed: appraisals.filter((a) => a.status === "Completed").length,
    };
  }, [appraisals]);

  // Open Add Cycle Modal
  const handleOpenNewCycle = () => {
    setEditingCycle(null);
    setCycleForm({
      name: `Q${Math.min(4, Math.floor(new Date().getMonth() / 3) + 1)} ${new Date().getFullYear()} Review Cycle`,
      reviewPeriod: "01 Oct 2024 – 31 Dec 2024",
      startDate: "2024-10-01",
      endDate: "2024-12-31",
      reviewFrequency: "Quarterly",
      status: "Active",
      description: "Appraisal cycle for quarterly performance evaluation and calibration.",
    });
    setCycleErrors({});
    setCycleModalOpen(true);
  };

  // Open Edit Cycle Modal
  const handleOpenEditCycle = (c) => {
    setEditingCycle(c);
    setCycleForm({
      name: c.name,
      reviewPeriod: c.reviewPeriod || "",
      startDate: c.startDate || "",
      endDate: c.endDate || "",
      reviewFrequency: c.reviewFrequency || "Quarterly",
      status: c.status || "Active",
      description: c.description || "",
    });
    setCycleErrors({});
    setCycleModalOpen(true);
  };

  const validateCycle = () => {
    const errs = {};
    if (!cycleForm.name.trim()) errs.name = "Cycle name is required";
    if (!cycleForm.reviewPeriod.trim()) errs.reviewPeriod = "Review period is required";
    if (!cycleForm.startDate) errs.startDate = "Start date is required";
    if (!cycleForm.endDate) errs.endDate = "End date is required";
    if (cycleForm.startDate && cycleForm.endDate && cycleForm.startDate > cycleForm.endDate) {
      errs.endDate = "End date must be on or after start date";
    }
    setCycleErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveCycle = () => {
    if (!validateCycle()) return;

    if (editingCycle) {
      updateCycle(editingCycle.id, cycleForm);
      showToast(`Performance cycle "${cycleForm.name}" updated successfully.`);
    } else {
      addCycle(cycleForm);
      showToast(`New review cycle "${cycleForm.name}" created successfully.`);
    }
    setCycleModalOpen(false);
  };

  // Table columns for Role Action Queue
  const queueCols = [
    {
      key: "employee",
      header: "Employee",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <img src={r.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-[#e2e8f0]" />
          <div>
            <div className="font-medium text-slate-800 text-[13px]">{r.employee}</div>
            <div className="text-[11px] text-slate-500">{r.designation} • {r.department}</div>
          </div>
        </div>
      ),
    },
    {
      key: "cycle",
      header: "Cycle",
      sortable: true,
      render: (r) => <span className="text-[12px] font-medium text-slate-700">{r.cycle}</span>,
    },
    {
      key: "stage",
      header: "Current Stage",
      sortable: true,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-800">
          <span className={`w-2 h-2 rounded-full ${
            r.stage === 'Finalization' ? 'bg-emerald-500' :
            r.stage === 'HR Review' ? 'bg-purple-500' :
            r.stage === 'Manager Review' ? 'bg-amber-500' : 'bg-blue-500'
          }`} />
          {r.stage}
        </span>
      ),
    },
    {
      key: "rating",
      header: "Rating & Scale",
      sortable: true,
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900 text-[13px] flex items-center gap-1">
            <Star size={12} className="text-amber-500 fill-amber-400" />
            {r.rating.toFixed(1)} / 5
          </div>
          <div className="text-[11px] text-slate-500">{r.ratingScaleLabel || 'Scale Tier'}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "due",
      header: "Due Date",
      sortable: true,
      render: (r) => (
        <span className={`text-[12px] ${r.status === 'Overdue' ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>
          {r.due}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Action",
      render: (r) => (
        <button
          onClick={() => navigate('/hrms/performance/appraisal')}
          className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-[#e2e8f0] text-slate-700 rounded-lg text-[11.5px] font-medium transition flex items-center gap-1 shadow-2xs"
        >
          Manage <ChevronRight size={13} />
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header & New Cycle Action */}
      <PageHeader
        title="Performance Management"
        subtitle="Overview of review cycles, appraisal workflows, indicators, and department ratings."
        guide={hrmsGuides.performanceDashboard}
        actions={
          <button
            onClick={handleOpenNewCycle}
            className="bg-[#16233a] text-white px-4 py-2 rounded-xl text-[13px] font-medium hover:bg-[#0f172a] transition shadow-2xs flex items-center gap-1.5"
          >
            <Plus size={15} />
            New Review Cycle
          </button>
        }
      />

      {/* Role Simulation Toolbar */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[12px]">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Simulated Role Perspective</div>
            <div className="text-[13px] font-medium text-slate-800">
              Viewing as: <span className="font-bold text-blue-600">{role}</span> {role === "Employee" && `(${simulatedEmployeeName})`}{role === "Manager" && `(${simulatedManagerName})`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#f8fafc] p-1 rounded-xl border border-[#e2e8f0]">
          <button
            onClick={() => setRole("HR")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition flex items-center gap-1.5 ${
              role === "HR"
                ? "bg-white text-slate-900 shadow-2xs border border-[#e2e8f0]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShieldCheck size={14} />
            HR / Admin
          </button>
          <button
            onClick={() => setRole("Manager")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition flex items-center gap-1.5 ${
              role === "Manager"
                ? "bg-white text-slate-900 shadow-2xs border border-[#e2e8f0]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users size={14} />
            Manager
          </button>
          <button
            onClick={() => setRole("Employee")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition flex items-center gap-1.5 ${
              role === "Employee"
                ? "bg-white text-slate-900 shadow-2xs border border-[#e2e8f0]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UserCheck size={14} />
            Employee
          </button>
        </div>
      </div>

      {/* 6 Metric Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {metrics.map((m, i) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            sub={m.sub}
            icon={metricIcons[i] ?? Target}
          />
        ))}
      </div>

      {/* Performance Cycles Overview & Controls */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f5f9] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar size={16} />
            </div>
            <div>
              <h2 className="font-bold text-[15px] text-slate-800">Performance Cycles</h2>
              <p className="text-[12px] text-slate-500">Configure review periods, frequencies, and active cycles.</p>
            </div>
          </div>
          <button
            onClick={handleOpenNewCycle}
            className="text-[12.5px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
          >
            <Plus size={14} />
            Add Cycle
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cycles.slice(0, 3).map((c) => {
            const isActive = c.status === "Active";
            return (
              <div
                key={c.id}
                className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
                  isActive
                    ? "bg-blue-50/40 border-blue-200"
                    : "bg-white border-[#e2e8f0] hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[14px] font-bold text-slate-800">{c.name}</div>
                    <div className="text-[12px] text-slate-500 mt-0.5">{c.reviewPeriod}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="flex items-center justify-between text-[11.5px] text-slate-500 pt-2 border-t border-[#e2e8f0]/60">
                  <span>Freq: <b className="text-slate-700">{c.reviewFrequency}</b></span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewingCycle(c)}
                      className="px-2 py-0.5 rounded hover:bg-white text-slate-600 hover:text-slate-900 transition text-[11px]"
                      title="View cycle details"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleOpenEditCycle(c)}
                      className="px-2 py-0.5 rounded hover:bg-white text-blue-600 hover:text-blue-800 transition text-[11px] font-medium"
                      title="Edit cycle"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage Distribution & Active Appraisal Queue */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-[16px] text-slate-800">
              {role === "Employee"
                ? "Your Performance Appraisals"
                : role === "Manager"
                ? "Team Reviews Pending Manager Action"
                : "Active Appraisal Workflow Queue"}
            </h2>
            <p className="text-[12.5px] text-slate-500">
              {role === "Employee"
                ? `Current evaluation progress for ${simulatedEmployeeName}`
                : role === "Manager"
                ? `Direct reports assigned to reviewer ${simulatedManagerName}`
                : "Live 4-stage review progression across all departments"}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {["All", "Self Review", "Manager Review", "HR Review", "Finalization"].map((st) => (
              <button
                key={st}
                onClick={() => setStageFilter(st)}
                className={`h-8 px-3 rounded-xl text-[12px] font-medium transition ${
                  stageFilter === st
                    ? "bg-[#16233a] text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-[#e2e8f0] hover:bg-slate-50"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={queueCols}
          data={roleAppraisals}
          emptyTitle="No appraisals in this stage"
          emptyDesc="Adjust your stage filter or navigate to the Appraisal module to initiate new evaluations."
          emptyAction={
            <Button onClick={() => navigate("/hrms/performance/appraisal")}>
              Go to Appraisal Module
            </Button>
          }
        />
      </div>

      {/* Add / Edit Cycle Modal */}
      <Modal
        isOpen={cycleModalOpen}
        onClose={() => setCycleModalOpen(false)}
        title={editingCycle ? "Edit Performance Cycle" : "Create Performance Cycle"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCycleModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCycle}>
              {editingCycle ? "Save Changes" : "Create Cycle"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="sm:col-span-2 flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Cycle Name *</span>
            <input
              type="text"
              value={cycleForm.name}
              onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
              placeholder="e.g. Q1 2025 Performance Cycle"
              className={`h-9 px-3 bg-white border rounded-xl text-[13px] ${
                cycleErrors.name ? "border-red-500" : "border-[#e2e8f0]"
              }`}
            />
            {cycleErrors.name && <span className="text-[11px] text-red-500">{cycleErrors.name}</span>}
          </label>

          <label className="sm:col-span-2 flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Review Period Label *</span>
            <input
              type="text"
              value={cycleForm.reviewPeriod}
              onChange={(e) => setCycleForm({ ...cycleForm, reviewPeriod: e.target.value })}
              placeholder="e.g. 01 Jan 2025 – 31 Mar 2025"
              className={`h-9 px-3 bg-white border rounded-xl text-[13px] ${
                cycleErrors.reviewPeriod ? "border-red-500" : "border-[#e2e8f0]"
              }`}
            />
            {cycleErrors.reviewPeriod && (
              <span className="text-[11px] text-red-500">{cycleErrors.reviewPeriod}</span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Start Date *</span>
            <input
              type="date"
              value={cycleForm.startDate}
              onChange={(e) => setCycleForm({ ...cycleForm, startDate: e.target.value })}
              className={`h-9 px-3 bg-white border rounded-xl text-[13px] ${
                cycleErrors.startDate ? "border-red-500" : "border-[#e2e8f0]"
              }`}
            />
            {cycleErrors.startDate && (
              <span className="text-[11px] text-red-500">{cycleErrors.startDate}</span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">End Date *</span>
            <input
              type="date"
              value={cycleForm.endDate}
              onChange={(e) => setCycleForm({ ...cycleForm, endDate: e.target.value })}
              className={`h-9 px-3 bg-white border rounded-xl text-[13px] ${
                cycleErrors.endDate ? "border-red-500" : "border-[#e2e8f0]"
              }`}
            />
            {cycleErrors.endDate && (
              <span className="text-[11px] text-red-500">{cycleErrors.endDate}</span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Review Frequency</span>
            <select
              value={cycleForm.reviewFrequency}
              onChange={(e) => setCycleForm({ ...cycleForm, reviewFrequency: e.target.value })}
              className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
            >
              <option>Quarterly</option>
              <option>Bi-Annual</option>
              <option>Annual</option>
              <option>Monthly</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Cycle Status</span>
            <select
              value={cycleForm.status}
              onChange={(e) => setCycleForm({ ...cycleForm, status: e.target.value })}
              className="h-9 px-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
            >
              <option>Draft</option>
              <option>Active</option>
              <option>Completed</option>
              <option>Archived</option>
            </select>
          </label>

          <label className="sm:col-span-2 flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-500">Description / Guidelines</span>
            <textarea
              rows={3}
              value={cycleForm.description}
              onChange={(e) => setCycleForm({ ...cycleForm, description: e.target.value })}
              placeholder="Instructions or scope for this performance evaluation cycle..."
              className="p-3 bg-white border border-[#e2e8f0] rounded-xl text-[13px]"
            />
          </label>
        </div>
      </Modal>

      {/* View Cycle Details Modal */}
      <Modal
        isOpen={!!viewingCycle}
        onClose={() => setViewingCycle(null)}
        title={viewingCycle?.name || "Cycle Details"}
        footer={
          <Button variant="secondary" onClick={() => setViewingCycle(null)}>
            Close
          </Button>
        }
      >
        {viewingCycle && (
          <div className="flex flex-col gap-4 text-[13px]">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
              <div>
                <span className="text-[11px] uppercase text-slate-400 font-semibold block">Period</span>
                <span className="font-semibold text-slate-800">{viewingCycle.reviewPeriod}</span>
              </div>
              <StatusBadge status={viewingCycle.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-600">
              <div>
                <span className="text-[11px] text-slate-400 block">Start Date</span>
                <span className="font-medium text-slate-800">{viewingCycle.startDate || "N/A"}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">End Date</span>
                <span className="font-medium text-slate-800">{viewingCycle.endDate || "N/A"}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Frequency</span>
                <span className="font-medium text-slate-800">{viewingCycle.reviewFrequency}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Total Appraisals</span>
                <span className="font-medium text-slate-800">{viewingCycle.appraisalCount || 24}</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Description</span>
              <p className="p-3 bg-slate-50 border border-[#e2e8f0] rounded-xl text-slate-700 leading-relaxed text-[12.5px]">
                {viewingCycle.description || "No description provided."}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
