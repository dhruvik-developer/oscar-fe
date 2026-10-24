import React, { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FileText,
  Shield,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Search,
  Filter,
  Plus,
  ArrowRight,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  Archive,
  RotateCcw,
  Check,
  X,
  Send,
  UploadCloud,
  History,
  Tag,
  Building,
  Calendar,
  Layers,
  FileCheck,
  AlertCircle,
  HelpCircle,
  FolderPlus,
  Download,
  Info,
  ExternalLink,
  ChevronDown,
  UserCheck,
  Sparkles,
  Lock,
  Heart,
  Laptop,
  Scale,
  Award,
  RefreshCw,
} from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { usePolicyStore } from "../../../stores/policyStore";
import { Badge } from "../../../components/hrms/Badge";
import Modal from "../../../components/ui/Modal";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import MasterSourceLink from "../../../components/common/MasterSourceLink";

// Category icon helper
function getCategoryIcon(catName) {
  switch (catName) {
    case "Code of Conduct":
      return <Shield size={16} className="text-blue-600" />;
    case "IT & Security":
      return <Lock size={16} className="text-purple-600" />;
    case "Employee Benefits":
      return <Heart size={16} className="text-emerald-600" />;
    case "Workplace Safety":
      return <AlertTriangle size={16} className="text-amber-600" />;
    case "Remote Work":
      return <Laptop size={16} className="text-cyan-600" />;
    case "Compliance":
      return <Scale size={16} className="text-rose-600" />;
    case "Employee Relations":
      return <Users size={16} className="text-indigo-600" />;
    default:
      return <Tag size={16} className="text-slate-600" />;
  }
}

// Status badge helper
function getPolicyStatusBadge(status) {
  switch (status) {
    case "Active":
      return <Badge variant="green">Active</Badge>;
    case "Approved":
      return <Badge variant="blue">Approved</Badge>;
    case "Pending Approval":
      return <Badge variant="yellow">Pending Approval</Badge>;
    case "Draft":
      return <Badge variant="gray">Draft</Badge>;
    case "Review / Update":
      return <Badge variant="orange">Review Due</Badge>;
    case "Archived":
      return <Badge variant="gray" className="opacity-70">Archived</Badge>;
    default:
      return <Badge variant="gray">{status}</Badge>;
  }
}

export function CompanyPolicyModule({ forcedSection }) {
  const location = useLocation();
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast || s.setToast);
  const employees = useAppStore((s) => s.employees || []);
  const currentUser = useAppStore((s) => s.currentUser || { name: "System User", role: "Operations Admin" });

  const {
    policies,
    categories,
    acknowledgements,
    addPolicy,
    updatePolicy,
    approvePolicy,
    rejectPolicy,
    publishPolicy,
    archivePolicy,
    restorePolicy,
    deletePolicy,
    createNewVersion,
    addCategory,
    updateCategory,
    deleteCategory,
    acknowledgePolicy,
    resetAll,
  } = usePolicyStore();

  // Determine current active section from prop or URL
  const activeSection = useMemo(() => {
    if (forcedSection) return forcedSection;
    const path = location.pathname;
    if (path.includes("/policies")) return "policies";
    if (path.includes("/categories")) return "categories";
    if (path.includes("/pending-approval")) return "pending-approval";
    if (path.includes("/acknowledgements")) return "acknowledgements";
    if (path.includes("/archive")) return "archive";
    return "dashboard";
  }, [forcedSection, location.pathname]);

  // Role toggle: Employee View vs Admin/HR View
  const [isEmployeeView, setIsEmployeeView] = useState(false);

  // Search & Filter state for Policies table
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Selected policy for View Detail modal
  const [viewPolicy, setViewPolicy] = useState(null);

  // Policy Create/Edit Drawer / Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [newVersionPolicy, setNewVersionPolicy] = useState(null);

  // Create/Edit form fields
  const [formFields, setFormFields] = useState({
    name: "",
    category: "Code of Conduct",
    ownerDept: "Human Resources",
    applicableTo: "All Employees",
    version: "v1.0",
    effectiveDate: new Date().toISOString().slice(0, 10),
    reviewDate: "",
    approvalRequired: true,
    ackRequired: true,
    status: "Active",
    summary: "",
    content: "",
  });

  // Category Add/Edit Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catFormData, setCatFormData] = useState({ name: "", description: "", color: "blue", icon: "Shield" });

  // Delete confirmation modal
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  // Reject confirmation modal
  const [rejectModalPolicy, setRejectModalPolicy] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Quick acknowledgement modal for Employee View
  const [ackModalPolicy, setAckModalPolicy] = useState(null);

  // Synchronize initial form fields when editing or creating version
  const openCreateModal = () => {
    setEditingPolicy(null);
    setNewVersionPolicy(null);
    setFormFields({
      name: "",
      category: categories[0]?.name || "Code of Conduct",
      ownerDept: "Human Resources",
      applicableTo: "All Employees",
      version: "v1.0",
      effectiveDate: new Date().toISOString().slice(0, 10),
      reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      approvalRequired: true,
      ackRequired: true,
      status: "Active",
      summary: "",
      content: "",
    });
    setIsCreateOpen(true);
  };

  const openEditModal = (p) => {
    setEditingPolicy(p);
    setNewVersionPolicy(null);
    setFormFields({
      name: p.name,
      category: p.category,
      ownerDept: p.ownerDept,
      applicableTo: p.applicableTo,
      version: p.version,
      effectiveDate: p.effectiveDate,
      reviewDate: p.reviewDate || "",
      approvalRequired: p.approvalRequired,
      ackRequired: p.ackRequired,
      status: p.status,
      summary: p.summary,
      content: p.content,
    });
    setIsCreateOpen(true);
  };

  const openNewVersionModal = (p) => {
    setEditingPolicy(null);
    setNewVersionPolicy(p);
    // calculate next version
    const currNum = parseFloat(p.version.replace("v", "")) || 1.0;
    const nextVer = `v${(currNum + 0.1).toFixed(1)}`;
    setFormFields({
      name: p.name,
      category: p.category,
      ownerDept: p.ownerDept,
      applicableTo: p.applicableTo,
      version: nextVer,
      effectiveDate: new Date().toISOString().slice(0, 10),
      reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      approvalRequired: true,
      ackRequired: p.ackRequired,
      status: "Pending Approval",
      summary: `Revision of ${p.version}: updated terms and standards.`,
      content: p.content,
    });
    setIsCreateOpen(true);
  };

  const handleFormSubmit = (submitForApproval = false) => {
    if (!formFields.name.trim()) {
      showToast?.("Policy name is required", "error");
      return;
    }
    if (!formFields.summary.trim()) {
      showToast?.("Please provide a brief policy summary", "error");
      return;
    }

    if (newVersionPolicy) {
      createNewVersion(newVersionPolicy.id, {
        ...formFields,
        author: currentUser?.name,
        approvalRequired: submitForApproval ? formFields.approvalRequired : false,
      });
      showToast?.(`Version ${formFields.version} created for "${formFields.name}"`);
    } else if (editingPolicy) {
      updatePolicy(editingPolicy.id, {
        ...formFields,
        actor: currentUser?.name,
      });
      showToast?.(`Policy "${formFields.name}" updated successfully`);
    } else {
      addPolicy({
        ...formFields,
        author: currentUser?.name,
      }, submitForApproval);
      showToast?.(`Policy "${formFields.name}" ${submitForApproval ? "submitted for approval" : "saved as draft"}`);
    }

    setIsCreateOpen(false);
  };

  // ── KPI Calculations ─────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = policies.length;
    const active = policies.filter((p) => p.status === "Active").length;
    const pendingApproval = policies.filter((p) => p.status === "Pending Approval").length;
    const pendingAcks = acknowledgements.filter((a) => a.status === "Pending" || a.status === "Overdue").length;

    // Due for review: reviewDate exists and within 60 days
    const now = new Date();
    const sixtyDaysLater = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const dueForReview = policies.filter((p) => {
      if (p.status !== "Active" || !p.reviewDate) return false;
      const rDate = new Date(p.reviewDate);
      return rDate <= sixtyDaysLater;
    }).length;

    return { total, active, pendingApproval, pendingAcks, dueForReview };
  }, [policies, acknowledgements]);

  // Distinct departments for filter
  const departments = useMemo(() => {
    return Array.from(new Set(policies.map((p) => p.ownerDept).filter(Boolean)));
  }, [policies]);

  // Current user's pending acknowledgements
  const myPendingAcks = useMemo(() => {
    return acknowledgements.filter(
      (a) => (a.employeeName === currentUser?.name || a.employeeId === "EMP-USR") && a.status !== "Acknowledged"
    );
  }, [acknowledgements, currentUser]);

  // Map policyId -> user has acknowledged
  const userAckMap = useMemo(() => {
    const map = {};
    acknowledgements
      .filter((a) => (a.employeeName === currentUser?.name || a.employeeId === "EMP-USR") && a.status === "Acknowledged")
      .forEach((a) => {
        map[a.policyId] = true;
      });
    return map;
  }, [acknowledgements, currentUser]);

  // Filtered policies list based on activeSection & controls
  const filteredPolicies = useMemo(() => {
    return policies.filter((p) => {
      // Scope filtering based on section
      if (activeSection === "pending-approval" && p.status !== "Pending Approval") return false;
      if (activeSection === "archive" && p.status !== "Archived") return false;
      if (activeSection === "policies" && p.status === "Archived") return false;
      if (isEmployeeView && p.status !== "Active") return false; // Employee only sees active policies

      // Search matching
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        String(p.name ?? '').toLowerCase().includes(q) ||
        String(p.id ?? '').toLowerCase().includes(q) ||
        String(p.category ?? '').toLowerCase().includes(q) ||
        String(p.ownerDept ?? '').toLowerCase().includes(q) ||
        (p.summary && String(p.summary ?? '').toLowerCase().includes(q));

      // Category matching
      const matchesCat = categoryFilter === "All" || p.category === categoryFilter;

      // Status matching (when on general policies list)
      const matchesStatus = statusFilter === "All" || p.status === statusFilter;

      // Department matching
      const matchesDept = deptFilter === "All" || p.ownerDept === deptFilter;

      return matchesSearch && matchesCat && matchesStatus && matchesDept;
    }).sort((a, b) => {
      let va = a[sortBy] || "";
      let vb = b[sortBy] || "";
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortOrder === "asc" ? -1 : 1;
      if (va > vb) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [policies, activeSection, isEmployeeView, searchQuery, categoryFilter, statusFilter, deptFilter, sortBy, sortOrder]);

  // Pagination slice
  const paginatedPolicies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPolicies.slice(start, start + pageSize);
  }, [filteredPolicies, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredPolicies.length / pageSize) || 1;

  // Acknowledgement statistics per policy
  const getPolicyAckStats = (policyId) => {
    const policyAcks = acknowledgements.filter((a) => a.policyId === policyId);
    if (!policyAcks.length) return { total: 0, acked: 0, pending: 0, overdue: 0, pct: 0 };
    const acked = policyAcks.filter((a) => a.status === "Acknowledged").length;
    const pending = policyAcks.filter((a) => a.status === "Pending").length;
    const overdue = policyAcks.filter((a) => a.status === "Overdue").length;
    const pct = Math.round((acked / policyAcks.length) * 100);
    return { total: policyAcks.length, acked, pending, overdue, pct };
  };

  // Switch sections smoothly
  const handleNavSection = (sectionKey) => {
    setCurrentPage(1);
    setSearchQuery("");
    setCategoryFilter("All");
    setStatusFilter("All");
    if (sectionKey === "dashboard") {
      navigate("/company-policy");
    } else {
      navigate(`/company-policy/${sectionKey}`);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      <PageHeader
        title="Company Policy"
        subtitle="Enterprise compliance repository, version lifecycle, staff acknowledgements, and regulatory governance."
        guide={hrmsGuides.companyPolicy}
        breadcrumb={[
          { label: "Dashboard", path: "/hrms/dashboard" },
          { label: "Company Policy", path: "/company-policy" },
          ...(activeSection !== "dashboard"
            ? [{
                label: activeSection
                  .split("-")
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" "),
              }]
            : []),
        ]}
        titleExtra={
          <>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-bdr text-[11px] font-semibold text-slate-700">
              <Shield size={12} className="text-navy" /> Enterprise Governance
            </span>
            {isEmployeeView && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">
                <UserCheck size={12} /> Employee Portal Mode
              </span>
            )}
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsEmployeeView(!isEmployeeView)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-semibold border transition cursor-pointer ${
                isEmployeeView
                  ? "bg-amber-50 text-amber-800 border-amber-300 shadow-xs"
                  : "bg-white text-slate-700 border-bdr hover:bg-off"
              }`}
              title="Toggle between HR Admin management mode and Staff Employee reading mode"
            >
              <UserCheck size={15} />
              <span>{isEmployeeView ? "Switch to Admin Mode" : "Employee View"}</span>
            </button>

            {!isEmployeeView && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-navy text-white rounded-xl text-[13px] font-bold hover:bg-navy/90 transition shadow-xs cursor-pointer"
              >
                <Plus size={16} />
                <span>Create Policy</span>
              </button>
            )}
          </>
        }
      />

      {/* ── Sub-Navigation Tabs ─────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-bdr overflow-x-auto scrollbar-none pb-0 -mb-1">
        <button
          type="button"
          onClick={() => handleNavSection("dashboard")}
          className={`pb-3 px-3.5 text-[13.5px] font-semibold transition-colors relative flex items-center gap-2 shrink-0 lg:shrink cursor-pointer whitespace-nowrap ${
            activeSection === "dashboard" ? "text-navy font-bold" : "text-muted hover:text-slate-800"
          }`}
        >
          <Layers size={15} />
          <span>Dashboard</span>
          {activeSection === "dashboard" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleNavSection("policies")}
          className={`pb-3 px-3.5 text-[13.5px] font-semibold transition-colors relative flex items-center gap-2 shrink-0 lg:shrink cursor-pointer whitespace-nowrap ${
            activeSection === "policies" ? "text-navy font-bold" : "text-muted hover:text-slate-800"
          }`}
        >
          <FileText size={15} />
          <span>All Policies</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {policies.filter((p) => p.status !== "Archived").length}
          </span>
          {activeSection === "policies" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleNavSection("categories")}
          className={`pb-3 px-3.5 text-[13.5px] font-semibold transition-colors relative flex items-center gap-2 shrink-0 lg:shrink cursor-pointer whitespace-nowrap ${
            activeSection === "categories" ? "text-navy font-bold" : "text-muted hover:text-slate-800"
          }`}
        >
          <Tag size={15} />
          <span>Categories</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {categories.length}
          </span>
          {activeSection === "categories" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t" />
          )}
        </button>

        {!isEmployeeView && (
          <button
            type="button"
            onClick={() => handleNavSection("pending-approval")}
            className={`pb-3 px-3.5 text-[13.5px] font-semibold transition-colors relative flex items-center gap-2 shrink-0 lg:shrink cursor-pointer whitespace-nowrap ${
              activeSection === "pending-approval" ? "text-navy font-bold" : "text-muted hover:text-slate-800"
            }`}
          >
            <Clock size={15} />
            <span>Pending Approval</span>
            {kpis.pendingApproval > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                {kpis.pendingApproval}
              </span>
            )}
            {activeSection === "pending-approval" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => handleNavSection("acknowledgements")}
          className={`pb-3 px-3.5 text-[13.5px] font-semibold transition-colors relative flex items-center gap-2 shrink-0 lg:shrink cursor-pointer whitespace-nowrap ${
            activeSection === "acknowledgements" ? "text-navy font-bold" : "text-muted hover:text-slate-800"
          }`}
        >
          <FileCheck size={15} />
          <span>Acknowledgements</span>
          {myPendingAcks.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              {myPendingAcks.length} Required
            </span>
          )}
          {activeSection === "acknowledgements" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t" />
          )}
        </button>

        {!isEmployeeView && (
          <button
            type="button"
            onClick={() => handleNavSection("archive")}
            className={`pb-3 px-3.5 text-[13.5px] font-semibold transition-colors relative flex items-center gap-2 shrink-0 lg:shrink cursor-pointer whitespace-nowrap ${
              activeSection === "archive" ? "text-navy font-bold" : "text-muted hover:text-slate-800"
            }`}
          >
            <Archive size={15} />
            <span>Archive</span>
            {activeSection === "archive" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t" />
            )}
          </button>
        )}
      </div>

      {/* ── SECTION 1: DASHBOARD VIEW ──────────────────────────── */}
      {activeSection === "dashboard" && (
        <div className="flex flex-col gap-6">
          {/* Employee Action Banner if user has pending acknowledgements */}
          {myPendingAcks.length > 0 && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 grid place-items-center shrink-0 mt-0.5">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-[14px] text-amber-950">
                    Mandatory Policy Acknowledgements Required ({myPendingAcks.length})
                  </h4>
                  <p className="text-[12.5px] text-amber-800 mt-0.5">
                    You have unconfirmed enterprise compliance policies. Please review and acknowledge to remain compliant.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleNavSection("acknowledgements")}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-[12.5px] font-semibold transition shrink-0 self-start sm:self-center cursor-pointer shadow-xs"
              >
                <span>Review & Acknowledge</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div
              onClick={() => handleNavSection("policies")}
              className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">Total Policies</span>
                <FileText size={17} className="text-slate-400" />
              </div>
              <div className="text-[26px] font-bold text-slate-900 mt-1">{kpis.total}</div>
              <div className="text-[11.5px] text-muted mt-0.5">Across {categories.length} categories</div>
            </div>

            <div
              onClick={() => handleNavSection("policies")}
              className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">Active & Published</span>
                <CheckCircle2 size={17} className="text-emerald-500" />
              </div>
              <div className="text-[26px] font-bold text-emerald-700 mt-1">{kpis.active}</div>
              <div className="text-[11.5px] text-muted mt-0.5">Enforced across org</div>
            </div>

            <div
              onClick={() => handleNavSection("pending-approval")}
              className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">Pending Approval</span>
                <Clock size={17} className="text-amber-500" />
              </div>
              <div className="text-[26px] font-bold text-amber-600 mt-1">{kpis.pendingApproval}</div>
              <div className="text-[11.5px] text-muted mt-0.5">Awaiting executive sign-off</div>
            </div>

            <div
              onClick={() => handleNavSection("acknowledgements")}
              className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">Pending Acks</span>
                <FileCheck size={17} className="text-rose-500" />
              </div>
              <div className="text-[26px] font-bold text-rose-600 mt-1">{kpis.pendingAcks}</div>
              <div className="text-[11.5px] text-muted mt-0.5">Staff sign-offs pending</div>
            </div>

            <div
              onClick={() => {
                setStatusFilter("All");
                handleNavSection("policies");
              }}
              className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">Due for Review</span>
                <AlertTriangle size={17} className="text-orange-500" />
              </div>
              <div className="text-[26px] font-bold text-orange-600 mt-1">{kpis.dueForReview}</div>
              <div className="text-[11.5px] text-muted mt-0.5">Next 60 days cycle</div>
            </div>
          </div>

          {/* Two-Column Grid: Recently Updated Policies & Quick Actions / Requiring Attention */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Recently Updated Policies */}
            <div className="lg:col-span-2 bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-bdr">
                  <div>
                    <h3 className="text-[15.5px] font-bold text-slate-900 flex items-center gap-2">
                      <FileText size={17} className="text-navy" />
                      <span>Recently Updated Policies</span>
                    </h3>
                    <p className="text-[12px] text-muted mt-0.5">
                      Latest regulatory standards and operational procedures published.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavSection("policies")}
                    className="text-[12.5px] text-navy hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    View All →
                  </button>
                </div>

                <div className="divide-y divide-bdr/50">
                  {policies.slice(0, 5).map((p) => {
                    const stats = getPolicyAckStats(p.id);
                    return (
                      <div key={p.id} className="py-3 flex items-center justify-between gap-3 hover:bg-off/50 px-2 rounded-xl transition">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-off border border-bdr grid place-items-center shrink-0 mt-0.5">
                            {getCategoryIcon(p.category)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                onClick={() => setViewPolicy(p)}
                                className="font-semibold text-slate-900 hover:text-navy cursor-pointer text-[13.5px] truncate"
                              >
                                {p.name}
                              </span>
                              <span className="font-mono text-[10.5px] px-1.5 py-0.5 bg-off rounded text-slate-600 border border-bdr">
                                {p.version}
                              </span>
                              {getPolicyStatusBadge(p.status)}
                            </div>
                            <div className="text-[11.5px] text-muted flex items-center gap-3 mt-1 flex-wrap">
                              <span>{p.category}</span>
                              <span>•</span>
                              <span>Effective: {p.effectiveDate}</span>
                              <span>•</span>
                              <span>Dept: {p.ownerDept}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {p.status === "Active" && (
                            <div className="text-right hidden sm:block">
                              <div className="text-[11.5px] font-bold text-slate-700">{stats.pct}% acked</div>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                <div className="h-full bg-navy rounded-full" style={{ width: `${stats.pct}%` }} />
                              </div>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewPolicy(p)}
                            className="p-1.5 rounded-lg border border-bdr hover:bg-off text-muted hover:text-navy transition cursor-pointer"
                            title="View Policy Details"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-bdr/60 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 text-[12px] text-muted">
                <span>Showing 5 of {policies.length} registered policies</span>
                <span className="text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} /> Synchronized with enterprise vault
                </span>
              </div>
            </div>

            {/* Right 1 Col: Policies Requiring Attention & Quick Actions */}
            <div className="flex flex-col gap-5">
              {/* Quick Actions Card */}
              <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs">
                <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500" />
                  <span>Quick Actions</span>
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {!isEmployeeView && (
                    <>
                      <button
                        type="button"
                        onClick={openCreateModal}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl border border-bdr hover:border-navy hover:bg-off/50 transition flex items-center justify-between text-[13px] font-semibold text-slate-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Plus size={15} className="text-navy" />
                          <span>Draft New Policy</span>
                        </div>
                        <ChevronRight size={14} className="text-slate-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(null);
                          setCatFormData({ name: "", description: "", color: "blue", icon: "Shield" });
                          setIsCategoryModalOpen(true);
                        }}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl border border-bdr hover:border-navy hover:bg-off/50 transition flex items-center justify-between text-[13px] font-semibold text-slate-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <FolderPlus size={15} className="text-purple-600" />
                          <span>Add Policy Category</span>
                        </div>
                        <ChevronRight size={14} className="text-slate-400" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => handleNavSection("acknowledgements")}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl border border-bdr hover:border-navy hover:bg-off/50 transition flex items-center justify-between text-[13px] font-semibold text-slate-800 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileCheck size={15} className="text-emerald-600" />
                      <span>Acknowledgement Tracker</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavSection("categories")}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl border border-bdr hover:border-navy hover:bg-off/50 transition flex items-center justify-between text-[13px] font-semibold text-slate-800 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Tag size={15} className="text-cyan-600" />
                      <span>Browse Categories</span>
                    </div>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Policies Requiring Attention Card */}
              <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs">
                <h3 className="text-[15px] font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-500" />
                  <span>Requiring Attention</span>
                </h3>
                <p className="text-[11.5px] text-muted mb-3">
                  Policies in pending review, upcoming renewal, or high overdue acknowledgement rates.
                </p>

                <div className="space-y-2.5">
                  {policies
                    .filter((p) => p.status === "Pending Approval" || (p.reviewDate && new Date(p.reviewDate) <= new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)))
                    .slice(0, 3)
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setViewPolicy(item)}
                        className="p-2.5 rounded-xl border border-bdr bg-off/40 hover:bg-off transition cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 text-[12.5px] truncate max-w-[180px]">
                            {item.name}
                          </span>
                          {getPolicyStatusBadge(item.status)}
                        </div>
                        <div className="text-[11px] text-muted mt-1 flex items-center justify-between">
                          <span>{item.ownerDept}</span>
                          <span className="font-mono text-slate-600">{item.version}</span>
                        </div>
                      </div>
                    ))}

                  {policies.filter((p) => p.status === "Pending Approval").length === 0 && (
                    <div className="py-6 text-center text-muted text-[12.5px]">
                      <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-1" />
                      All policies are up to date!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 2 & 4 & 6: POLICIES TABLE (All Policies / Pending Approval / Archive) ── */}
      {(activeSection === "policies" || activeSection === "pending-approval" || activeSection === "archive") && (
        <div className="flex flex-col gap-4">
          {/* Section banner / guidance */}
          {activeSection === "pending-approval" && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-amber-900 text-[13px]">
                <Clock size={16} className="text-amber-600 shrink-0" />
                <span>
                  <strong>Approval Queue:</strong> The following policies are waiting for Executive and Legal sign-off before publication.
                </span>
              </div>
            </div>
          )}

          {activeSection === "archive" && (
            <div className="bg-slate-50 border border-bdr rounded-2xl p-4 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-slate-700 text-[13px]">
                <Archive size={16} className="text-slate-500 shrink-0" />
                <span>
                  <strong>Historical Policy Archive:</strong> Deprecated or superseded policy versions stored for audit and compliance trails.
                </span>
              </div>
            </div>
          )}

          {/* Search, Filter Toolbar */}
          <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[240px] flex-1 max-w-sm">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search policies by name, ID, department..."
                  className="pl-10 pr-4 h-9 w-full bg-off border border-bdr rounded-xl text-[13px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy"
                />
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1.5 text-[12.5px]">
                <span className="text-muted font-medium">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter (only shown on 'policies' tab) */}
              {activeSection === "policies" && !isEmployeeView && (
                <div className="flex items-center gap-1.5 text-[12.5px]">
                  <span className="text-muted font-medium">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Review / Update">Review / Update</option>
                  </select>
                </div>
              )}

              {/* Department Filter */}
              <div className="flex items-center gap-1.5 text-[12.5px]">
                <span className="text-muted font-medium">Department:</span>
                <select
                  value={deptFilter}
                  onChange={(e) => {
                    setDeptFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer"
                >
                  <option value="All">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-2 text-[12.5px]">
              <span className="text-muted font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer"
              >
                <option value="updatedAt">Last Updated</option>
                <option value="name">Policy Name</option>
                <option value="effectiveDate">Effective Date</option>
                <option value="version">Version</option>
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="h-9 px-2.5 border border-bdr bg-off hover:bg-white rounded-xl text-[12px] font-semibold text-slate-700 transition cursor-pointer"
                title="Toggle ascending/descending order"
              >
                {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
              </button>
            </div>
          </div>

          {/* Policy Management Table */}
          <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] lg:min-w-0 text-left text-[13px] border-collapse">
                <thead className="bg-off border-b border-bdr text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="py-3 px-5">Policy Name</th>
                    <th className="py-3 px-5">Policy ID</th>
                    <th className="py-3 px-5">Category</th>
                    <th className="py-3 px-5">Owner / Dept</th>
                    <th className="py-3 px-5">Version</th>
                    <th className="py-3 px-5">Effective Date</th>
                    <th className="py-3 px-5">Review Date</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Acknowledgement</th>
                    <th className="py-3 px-5">Last Updated</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/50">
                  {paginatedPolicies.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-14 text-center text-muted">
                        <FileText size={36} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700 text-[14px]">No policies match your filters.</p>
                        <p className="text-[12px] text-muted mt-0.5">Try resetting search filters or register a new policy draft.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery("");
                            setCategoryFilter("All");
                            setStatusFilter("All");
                            setDeptFilter("All");
                          }}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-navy hover:underline cursor-pointer"
                        >
                          <RefreshCw size={12} /> Clear all filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    paginatedPolicies.map((p) => {
                      const ackStats = getPolicyAckStats(p.id);
                      const isAckedByMe = userAckMap[p.id];
                      return (
                        <tr key={p.id} className="hover:bg-off/60 transition-colors">
                          {/* Policy Name & icon */}
                          <td className="py-3.5 px-5 font-semibold text-slate-900 max-w-xs">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-off border border-bdr grid place-items-center shrink-0">
                                {getCategoryIcon(p.category)}
                              </div>
                              <div className="min-w-0">
                                <div
                                  onClick={() => setViewPolicy(p)}
                                  className="truncate hover:text-navy cursor-pointer font-semibold"
                                  title={p.name}
                                >
                                  {p.name}
                                </div>
                                <div className="text-[11px] text-muted line-clamp-1 mt-0.5">
                                  {p.summary || "Official company standard"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* ID */}
                          <td className="py-3.5 px-5 font-mono text-[12px] text-slate-600 font-semibold">
                            {p.id}
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-off border border-bdr text-[11.5px] font-medium text-slate-700">
                              {p.category}
                            </span>
                          </td>

                          {/* Owner / Dept */}
                          <td className="py-3.5 px-5 text-slate-700 text-[12.5px]">
                            <div>{p.ownerDept}</div>
                            <div className="text-[11px] text-muted">{p.applicableTo}</div>
                          </td>

                          {/* Version */}
                          <td className="py-3.5 px-5">
                            <span className="font-mono text-[11.5px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                              {p.version}
                            </span>
                          </td>

                          {/* Effective Date */}
                          <td className="py-3.5 px-5 text-slate-600 text-[12px]">
                            {p.effectiveDate || "—"}
                          </td>

                          {/* Review Date */}
                          <td className="py-3.5 px-5 text-slate-600 text-[12px]">
                            {p.reviewDate || "—"}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-5">
                            {getPolicyStatusBadge(p.status)}
                          </td>

                          {/* Acknowledgement Status */}
                          <td className="py-3.5 px-5">
                            {isEmployeeView ? (
                              isAckedByMe ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                                  <Check size={12} /> Confirmed
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setAckModalPolicy(p)}
                                  className="px-2.5 py-1 rounded-lg bg-navy text-white text-[11px] font-bold hover:bg-navy/90 transition shadow-xs cursor-pointer"
                                >
                                  Acknowledge
                                </button>
                              )
                            ) : (
                              <div>
                                <div className="text-[11.5px] font-semibold text-slate-700">
                                  {ackStats.pct}% ({ackStats.acked}/{ackStats.total || 1248})
                                </div>
                                <div className="w-20 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                  <div className="h-full bg-navy rounded-full" style={{ width: `${ackStats.pct}%` }} />
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Last Updated */}
                          <td className="py-3.5 px-5 text-slate-500 text-[12px]">
                            {p.updatedAt || p.effectiveDate}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Action */}
                              <button
                                type="button"
                                onClick={() => setViewPolicy(p)}
                                className="w-7 h-7 rounded-lg border border-bdr hover:bg-off grid place-items-center text-muted hover:text-navy transition cursor-pointer"
                                title="View Full Policy & Versions"
                              >
                                <Eye size={14} />
                              </button>

                              {/* Employee view: show acknowledge button if pending */}
                              {isEmployeeView ? (
                                !isAckedByMe && (
                                  <button
                                    type="button"
                                    onClick={() => setAckModalPolicy(p)}
                                    className="px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1"
                                    title="Acknowledge Policy"
                                  >
                                    <Check size={12} /> Ack
                                  </button>
                                )
                              ) : (
                                <>
                                  {/* Admin Actions: Edit */}
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(p)}
                                    className="w-7 h-7 rounded-lg border border-bdr hover:bg-off grid place-items-center text-muted hover:text-slate-900 transition cursor-pointer"
                                    title="Edit Policy"
                                  >
                                    <Edit size={13} />
                                  </button>

                                  {/* Create New Version */}
                                  <button
                                    type="button"
                                    onClick={() => openNewVersionModal(p)}
                                    className="w-7 h-7 rounded-lg border border-bdr hover:bg-off grid place-items-center text-muted hover:text-blue-600 transition cursor-pointer"
                                    title="Create New Version"
                                  >
                                    <History size={13} />
                                  </button>

                                  {/* Approval Actions for Pending Approval */}
                                  {p.status === "Pending Approval" && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          approvePolicy(p.id, currentUser?.name);
                                          showToast?.(`Approved and published policy ${p.name}`);
                                        }}
                                        className="w-7 h-7 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 grid place-items-center transition cursor-pointer"
                                        title="Approve & Publish"
                                      >
                                        <Check size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRejectModalPolicy(p);
                                          setRejectReason("");
                                        }}
                                        className="w-7 h-7 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 grid place-items-center transition cursor-pointer"
                                        title="Reject / Return to Draft"
                                      >
                                        <X size={14} />
                                      </button>
                                    </>
                                  )}

                                  {/* Archive / Restore */}
                                  {p.status === "Archived" ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        restorePolicy(p.id, currentUser?.name);
                                        showToast?.(`Restored ${p.name} to Active status`);
                                      }}
                                      className="w-7 h-7 rounded-lg border border-bdr hover:bg-blue-50 text-muted hover:text-blue-600 grid place-items-center transition cursor-pointer"
                                      title="Restore to Active"
                                    >
                                      <RotateCcw size={13} />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        archivePolicy(p.id, currentUser?.name);
                                        showToast?.(`Archived policy ${p.name}`);
                                      }}
                                      className="w-7 h-7 rounded-lg border border-bdr hover:bg-slate-100 text-muted hover:text-slate-700 grid place-items-center transition cursor-pointer"
                                      title="Archive Policy"
                                    >
                                      <Archive size={13} />
                                    </button>
                                  )}

                                  {/* Delete */}
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmTarget(p)}
                                    className="w-7 h-7 rounded-lg border border-bdr hover:bg-rose-50 text-muted hover:text-rose-600 grid place-items-center transition cursor-pointer"
                                    title="Delete Policy"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination & Count */}
            <div className="p-4 border-t border-bdr flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted">
              <div>
                Showing <b>{paginatedPolicies.length}</b> of <b>{filteredPolicies.length}</b> policies
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 border border-bdr rounded-lg hover:bg-off disabled:opacity-40 disabled:hover:bg-transparent font-medium cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2">
                  Page <b>{currentPage}</b> of <b>{totalPages}</b>
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 border border-bdr rounded-lg hover:bg-off disabled:opacity-40 disabled:hover:bg-transparent font-medium cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 3: CATEGORIES VIEW ─────────────────────────── */}
      {activeSection === "categories" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[17px] font-bold text-slate-900">Policy Categories</h3>
              <p className="text-[12.5px] text-muted mt-0.5">
                Organize company guidelines by domain, compliance scope, and functional ownership.
              </p>
            </div>
            {!isEmployeeView && (
              <button
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setCatFormData({ name: "", description: "", color: "blue", icon: "Shield" });
                  setIsCategoryModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white rounded-xl text-[13px] font-bold hover:bg-navy/90 transition shadow-xs cursor-pointer"
              >
                <Plus size={15} />
                <span>Add Category</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const count = policies.filter((p) => p.category === cat.name && p.status !== "Archived").length;
              return (
                <div
                  key={cat.id}
                  className="bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-9 h-9 rounded-xl bg-off border border-bdr grid place-items-center shrink-0">
                        {getCategoryIcon(cat.name)}
                      </div>
                      {!isEmployeeView && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategory(cat);
                              setCatFormData({
                                name: cat.name,
                                description: cat.description || "",
                                color: cat.color || "blue",
                                icon: cat.icon || "Shield",
                              });
                              setIsCategoryModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-bdr hover:bg-off text-muted hover:text-slate-900 transition cursor-pointer"
                            title="Edit Category"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete category "${cat.name}"?`)) {
                                deleteCategory(cat.id);
                                showToast?.(`Deleted category ${cat.name}`);
                              }
                            }}
                            className="p-1.5 rounded-lg border border-bdr hover:bg-rose-50 text-muted hover:text-rose-600 transition cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    <h4 className="text-[15.5px] font-bold text-slate-900 mt-3">{cat.name}</h4>
                    <p className="text-[12.5px] text-slate-600 mt-1 leading-relaxed">
                      {cat.description || "Corporate governance guidelines and rules."}
                    </p>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-bdr flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-slate-700">
                      <b>{count}</b> {count === 1 ? "Policy" : "Policies"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter(cat.name);
                        handleNavSection("policies");
                      }}
                      className="text-[12px] font-semibold text-navy hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Explore</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 5: ACKNOWLEDGEMENTS TRACKER VIEW ─────────────── */}
      {activeSection === "acknowledgements" && (
        <div className="flex flex-col gap-5">
          {/* Employee personal confirmation banner */}
          <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-[16px] font-bold text-slate-900 flex items-center gap-2">
                <FileCheck size={18} className="text-navy" />
                <span>Personnel Policy Acknowledgements</span>
              </h3>
              <p className="text-[12.5px] text-muted mt-0.5">
                Audited proof-of-acknowledgement log ensuring all staff understand active workplace guidelines.
              </p>
            </div>
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
              <span className="text-[12.5px] font-semibold text-slate-700 bg-off px-3 py-1.5 rounded-xl border border-bdr">
                Your Status:{" "}
                <b className={myPendingAcks.length > 0 ? "text-amber-700" : "text-emerald-700"}>
                  {myPendingAcks.length > 0 ? `${myPendingAcks.length} Pending` : "100% Up to Date ✓"}
                </b>
              </span>
            </div>
          </div>

          {/* Acknowledgements Table */}
          <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] lg:min-w-0 text-left text-[13px] border-collapse">
                <thead className="bg-off border-b border-bdr text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="py-3 px-5">Policy Name</th>
                    <th className="py-3 px-5">Version</th>
                    <th className="py-3 px-5">Employee / Requester</th>
                    <th className="py-3 px-5">Department</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Acknowledged Date & Time</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/50">
                  {acknowledgements.map((ack) => {
                    const isCurrentUser = ack.employeeName === currentUser?.name || ack.employeeId === "EMP-USR";
                    return (
                      <tr key={ack.id} className="hover:bg-off/60 transition">
                        <td className="py-3.5 px-5 font-semibold text-slate-900">
                          <div>{ack.policyName}</div>
                          <div className="font-mono text-[11px] text-muted">{ack.policyId}</div>
                        </td>
                        <td className="py-3.5 px-5 font-mono text-[12px] font-bold text-slate-700">
                          {ack.version}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-medium text-slate-900">{ack.employeeName}</div>
                          <div className="text-[11px] font-mono text-muted">{ack.employeeId}</div>
                        </td>
                        <td className="py-3.5 px-5 text-slate-700">{ack.dept}</td>
                        <td className="py-3.5 px-5">
                          {ack.status === "Acknowledged" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                              <Check size={12} /> Acknowledged
                            </span>
                          ) : ack.status === "Overdue" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold">
                              <AlertCircle size={12} /> Overdue
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold">
                              <Clock size={12} /> Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-[12px] text-slate-600">
                          {ack.ackDate || "—"}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          {ack.status !== "Acknowledged" && isCurrentUser ? (
                            <button
                              type="button"
                              onClick={() => {
                                acknowledgePolicy(ack.policyId, currentUser?.name, "EMP-USR", "Operations");
                                showToast?.(`Acknowledged ${ack.policyName}`);
                              }}
                              className="px-3 py-1 rounded-lg bg-navy text-white text-[11.5px] font-bold hover:bg-navy/90 transition shadow-xs cursor-pointer"
                            >
                              Acknowledge Policy
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11.5px] italic">No action needed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 1: VIEW POLICY DETAIL ────────────────────────── */}
      <Modal
        isOpen={Boolean(viewPolicy)}
        onClose={() => setViewPolicy(null)}
        title={viewPolicy ? `${viewPolicy.name} (${viewPolicy.version})` : "Policy Details"}
        size="lg"
        footer={
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 w-full">
            <div className="flex items-center gap-2">
              {viewPolicy && userAckMap[viewPolicy.id] ? (
                <span className="text-[12px] font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 size={15} /> You have acknowledged this policy
                </span>
              ) : (
                viewPolicy && viewPolicy.status === "Active" && (
                  <button
                    type="button"
                    onClick={() => {
                      acknowledgePolicy(viewPolicy.id, currentUser?.name, "EMP-USR", "Operations");
                      showToast?.(`Acknowledged policy ${viewPolicy.name}`);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12.5px] font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Check size={14} /> Acknowledge Policy
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isEmployeeView && viewPolicy && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const p = viewPolicy;
                      setViewPolicy(null);
                      openEditModal(p);
                    }}
                    className="px-3.5 py-2 border border-bdr hover:bg-off rounded-xl text-[12.5px] font-medium transition cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = viewPolicy;
                      setViewPolicy(null);
                      openNewVersionModal(p);
                    }}
                    className="px-3.5 py-2 bg-navy text-white rounded-xl text-[12.5px] font-semibold hover:bg-navy/90 transition cursor-pointer"
                  >
                    New Version
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setViewPolicy(null)}
                className="px-4 py-2 border border-bdr hover:bg-slate-100 rounded-xl text-[12.5px] font-medium transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        }
      >
        {viewPolicy && (
          <div className="flex flex-col gap-4.5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Metadata banner */}
            <div className="bg-slate-50 border border-bdr rounded-2xl p-4.5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-bold px-2 py-0.5 rounded bg-white border border-bdr text-slate-700">
                    {viewPolicy.id}
                  </span>
                  <span className="font-mono text-[12px] font-bold px-2 py-0.5 rounded bg-white border border-bdr text-slate-700">
                    {viewPolicy.version}
                  </span>
                  {getPolicyStatusBadge(viewPolicy.status)}
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-bdr text-[12px] font-semibold text-slate-700">
                  {getCategoryIcon(viewPolicy.category)}
                  {viewPolicy.category}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-bdr/60 text-[12px]">
                <div>
                  <span className="text-muted block">Owner Dept</span>
                  <span className="font-semibold text-slate-800">{viewPolicy.ownerDept}</span>
                </div>
                <div>
                  <span className="text-muted block">Applicable To</span>
                  <span className="font-semibold text-slate-800">{viewPolicy.applicableTo}</span>
                </div>
                <div>
                  <span className="text-muted block">Effective Date</span>
                  <span className="font-semibold text-slate-800">{viewPolicy.effectiveDate || "—"}</span>
                </div>
                <div>
                  <span className="text-muted block">Review Date</span>
                  <span className="font-semibold text-slate-800">{viewPolicy.reviewDate || "Annual"}</span>
                </div>
              </div>
            </div>

            {/* Policy Summary */}
            <div>
              <h4 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                Executive Summary
              </h4>
              <p className="text-[13px] text-slate-700 bg-off p-3.5 rounded-xl border border-bdr leading-relaxed">
                {viewPolicy.summary}
              </p>
            </div>

            {/* Policy Full Content */}
            <div>
              <h4 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider mb-1.5">
                Policy Content & Compliance Directives
              </h4>
              <div className="text-[13px] text-slate-700 bg-white border border-bdr rounded-xl p-4 leading-relaxed whitespace-pre-line font-sans">
                {viewPolicy.content}
              </div>
            </div>

            {/* Version History & Activity Log Tabs */}
            <div className="pt-3 border-t border-bdr flex flex-col gap-3">
              <h4 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider">
                Version History & Audit Log
              </h4>
              <div className="space-y-2">
                {(viewPolicy.versionHistory || []).map((v, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl border border-bdr bg-off/40 flex items-center justify-between text-[12px]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{v.version}</span>
                        <span className="text-muted">• {v.effectiveDate}</span>
                        <span className="text-slate-600">by {v.updatedBy}</span>
                      </div>
                      <div className="text-muted mt-0.5">{v.summary}</div>
                    </div>
                    {getPolicyStatusBadge(v.status || "Active")}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL 2: CREATE / EDIT POLICY DRAWER MODAL ─────────── */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={
          newVersionPolicy
            ? `Create New Version for ${newVersionPolicy.name}`
            : editingPolicy
            ? `Edit Policy: ${editingPolicy.name}`
            : "Create Company Policy"
        }
        size="lg"
        footer={
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 w-full">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium transition cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleFormSubmit(false)}
                className="px-4 py-2 border border-bdr bg-off hover:bg-white text-slate-800 rounded-xl text-[13px] font-semibold transition cursor-pointer"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleFormSubmit(true)}
                className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-bold hover:bg-navy/90 transition shadow-xs cursor-pointer"
              >
                {formFields.approvalRequired ? "Submit for Approval" : "Publish Active"}
              </button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Policy Name */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              Policy Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Remote & Hybrid Work Protocol"
              value={formFields.name}
              onChange={(e) => setFormFields({ ...formFields, name: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          {/* Category & Owner Dept */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[12px] font-semibold text-slate-700">
                  Category
                </label>
                <MasterSourceLink source="policyCategories" />
              </div>
              <select
                value={formFields.category}
                onChange={(e) => setFormFields({ ...formFields, category: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                Owner / Department
              </label>
              <select
                value={formFields.ownerDept}
                onChange={(e) => setFormFields({ ...formFields, ownerDept: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
              >
                <option value="Human Resources">Human Resources</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
                <option value="Legal & Compliance">Legal & Compliance</option>
                <option value="Facilities & Admin">Facilities & Admin</option>
                <option value="Engineering">Engineering</option>
              </select>
            </div>
          </div>

          {/* Applicable Scope & Version */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                Applicable Employees
              </label>
              <select
                value={formFields.applicableTo}
                onChange={(e) => setFormFields({ ...formFields, applicableTo: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
              >
                <option value="All Employees">All Employees</option>
                <option value="Full-Time Staff">Full-Time Staff</option>
                <option value="Contractors & Interns">Contractors & Interns</option>
                <option value="Engineering & Product">Engineering & Product</option>
                <option value="Management & Sales">Management & Sales</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                Version Tag
              </label>
              <input
                type="text"
                placeholder="v1.0"
                value={formFields.version}
                onChange={(e) => setFormFields({ ...formFields, version: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy font-mono"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                Effective Date
              </label>
              <input
                type="date"
                value={formFields.effectiveDate}
                onChange={(e) => setFormFields({ ...formFields, effectiveDate: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                Review Due Date
              </label>
              <input
                type="date"
                value={formFields.reviewDate}
                onChange={(e) => setFormFields({ ...formFields, reviewDate: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>
          </div>

          {/* Governance Toggles */}
          <div className="bg-off border border-bdr rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4">
            <label className="flex items-center gap-2.5 text-[13px] font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formFields.approvalRequired}
                onChange={(e) => setFormFields({ ...formFields, approvalRequired: e.target.checked })}
                className="w-4 h-4 rounded text-navy"
              />
              <span>Requires Executive Board Approval before Active</span>
            </label>

            <label className="flex items-center gap-2.5 text-[13px] font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formFields.ackRequired}
                onChange={(e) => setFormFields({ ...formFields, ackRequired: e.target.checked })}
                className="w-4 h-4 rounded text-navy"
              />
              <span>Mandatory Employee Acknowledgement</span>
            </label>
          </div>

          {/* Executive Summary */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              Policy Summary *
            </label>
            <textarea
              rows={2}
              required
              placeholder="Brief summary of policy intent, scope, and key compliance terms..."
              value={formFields.summary}
              onChange={(e) => setFormFields({ ...formFields, summary: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          {/* Full Policy Content */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
              Full Policy Content & Clauses
            </label>
            <textarea
              rows={6}
              placeholder="Enter full structured text, clauses, obligations, and guidelines..."
              value={formFields.content}
              onChange={(e) => setFormFields({ ...formFields, content: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy font-mono"
            />
          </div>
        </div>
      </Modal>

      {/* ── MODAL 3: CATEGORY ADD / EDIT MODAL ─────────────────── */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? `Edit Category: ${editingCategory.name}` : "Add Policy Category"}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!catFormData.name.trim()) return showToast?.("Category name is required", "error");
                if (editingCategory) {
                  updateCategory(editingCategory.id, catFormData);
                  showToast?.(`Category "${catFormData.name}" updated`);
                } else {
                  addCategory(catFormData);
                  showToast?.(`Category "${catFormData.name}" added`);
                }
                setIsCategoryModalOpen(false);
              }}
              className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-bold hover:bg-navy/90 transition shadow-xs cursor-pointer"
            >
              Save Category
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">
              Category Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Workplace Safety"
              value={catFormData.name}
              onChange={(e) => setCatFormData({ ...catFormData, name: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Describe scope of guidelines organized under this category..."
              value={catFormData.description}
              onChange={(e) => setCatFormData({ ...catFormData, description: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>
        </div>
      </Modal>

      {/* ── MODAL 4: EMPLOYEE ACKNOWLEDGE CONFIRMATION ──────────── */}
      <Modal
        isOpen={Boolean(ackModalPolicy)}
        onClose={() => setAckModalPolicy(null)}
        title="Confirm Policy Acknowledgement"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setAckModalPolicy(null)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (ackModalPolicy) {
                  acknowledgePolicy(ackModalPolicy.id, currentUser?.name, "EMP-USR", "Operations");
                  showToast?.(`You have acknowledged "${ackModalPolicy.name}"`);
                  setAckModalPolicy(null);
                }
              }}
              className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-[13px] font-bold hover:bg-emerald-700 transition shadow-xs cursor-pointer"
            >
              I Understand & Acknowledge
            </button>
          </div>
        }
      >
        {ackModalPolicy && (
          <div className="flex flex-col gap-3 text-[13px] text-slate-700">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 font-medium leading-relaxed">
              By confirming below, you legally acknowledge that you have read, understood, and agreed to abide by the directives and expectations outlined in:
            </div>
            <div className="font-bold text-[15px] text-slate-900 mt-1">
              {ackModalPolicy.name} ({ackModalPolicy.version})
            </div>
            <p className="text-slate-600 bg-off p-3 rounded-xl border border-bdr text-[12.5px]">
              {ackModalPolicy.summary}
            </p>
            <div className="text-[11.5px] text-muted">
              Signed by: <b>{currentUser?.name}</b> (Operations Admin) on {new Date().toLocaleDateString()}
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL 5: REJECT POLICY CONFIRMATION ────────────────── */}
      <Modal
        isOpen={Boolean(rejectModalPolicy)}
        onClose={() => setRejectModalPolicy(null)}
        title="Return Policy to Draft (Revisions Required)"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setRejectModalPolicy(null)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (rejectModalPolicy) {
                  rejectPolicy(rejectModalPolicy.id, rejectReason, currentUser?.name);
                  showToast?.(`Policy returned to Draft`);
                  setRejectModalPolicy(null);
                }
              }}
              className="px-5 py-2 bg-rose-600 text-white rounded-xl text-[13px] font-bold hover:bg-rose-700 transition shadow-xs cursor-pointer"
            >
              Confirm Rejection
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-slate-700">
            Provide feedback explaining why <b>{rejectModalPolicy?.name}</b> is being returned to Draft status:
          </p>
          <textarea
            rows={3}
            placeholder="e.g. Clause 3.2 needs revision regarding travel per diems..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
          />
        </div>
      </Modal>

      {/* ── MODAL 6: DELETE CONFIRMATION ───────────────────────── */}
      <Modal
        isOpen={Boolean(deleteConfirmTarget)}
        onClose={() => setDeleteConfirmTarget(null)}
        title="Confirm Policy Deletion"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setDeleteConfirmTarget(null)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleteConfirmTarget) {
                  deletePolicy(deleteConfirmTarget.id);
                  showToast?.(`Deleted ${deleteConfirmTarget.name}`);
                  setDeleteConfirmTarget(null);
                }
              }}
              className="px-5 py-2 bg-rose-600 text-white rounded-xl text-[13px] font-bold hover:bg-rose-700 transition shadow-xs cursor-pointer"
            >
              Delete Permanently
            </button>
          </div>
        }
      >
        <p className="text-[13.5px] text-slate-700 leading-relaxed">
          Are you sure you want to permanently delete <b>{deleteConfirmTarget?.name}</b> ({deleteConfirmTarget?.id})? This will remove its historical audit trails.
        </p>
      </Modal>
    </div>
  );
}

export default CompanyPolicyModule;
