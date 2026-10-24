import { useState, useRef, useEffect } from "react";
import { hrmsSync, isBackendEnabled, isServerId, pullHrmsSettings, pushHrmsSettings } from '../../../services/hrmsSync';
import { Link, useSearchParams } from "react-router-dom";
import MasterSourceLink from "../../../components/common/MasterSourceLink";
import {
  ShieldCheck,
  Users,
  Settings,
  Sliders,
  CheckCircle2,
  Clock,
  Building,
  KeyRound,
  FileCheck,
  Plus,
  Edit,
  Trash2,
  Mail,
  AlertCircle,
  ExternalLink,
  UserMinus,
  UserX,
  MessageSquareWarning,
  Calendar,
  CalendarCheck,
  Receipt,
  RotateCcw,
  Search,
  Filter,
  Eye,
  Check,
  X,
  FileText,
  AlertTriangle,
  Printer,
  Sparkles,
  Briefcase,
  Award,
  FileCheck2,
  ChevronDown,
  ArrowRight,
  Shield,
  Building2,
  Layers,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useRecruitmentStore } from "../../../stores/recruitmentStore";
import { useCalendarStore } from "../../../stores/calendarStore";
import {
  usePayrollStore,
  getDepartmentDays,
  getDepartmentHours,
  DEFAULT_DEPARTMENT_WORKING_DAYS,
  DEFAULT_DEPARTMENT_WORKING_HOURS,
} from "../../../stores/payrollStore";
import TerminationLetterModal from "./TerminationLetterModal";
import OfferLetterModal from "./OfferLetterModal";
import GenerateOfferModal from "./GenerateOfferModal";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

/** Merge server rows into a local list: same server id wins, local-only rows stay. */
function mergeServerRows(previous, serverRows) {
  const prev = Array.isArray(previous) ? previous : [];
  const server = Array.isArray(serverRows) ? serverRows : [];
  if (server.length === 0) return prev;
  const byId = new Map(prev.map((r) => [String(r?.serverOfferId || r?.backendId || r?.id), r]));
  const merged = prev.map((row) => {
    const key = String(row?.serverOfferId || row?.backendId || '');
    if (key && server.some((s) => String(s.id) === key)) {
      const fresh = server.find((s) => String(s.id) === key);
      return { ...row, ...fresh, id: row.id, serverOfferId: key, backendId: key };
    }
    return row;
  });
  const known = new Set(merged.map((r) => String(r?.serverOfferId || r?.backendId || r?.id)));
  server.forEach((s) => {
    if (!known.has(String(s.id))) merged.push(s);
  });
  return merged;
}

/** A `/hrms/offers/` row in the offer-letter table shape. */
function serverOfferToRow(offer, applications = []) {
  const app = (applications || []).find((a) => String(a?.id) === String(offer.applicationId));
  return {
    id: offer.id,
    serverOfferId: offer.id,
    applicationId: offer.applicationId,
    candidateId: app?.candidateId || offer.candidateId || '',
    candidateName: offer.candidateName || '',
    email: '',
    position: offer.position || '',
    dept: offer.dept || offer.department || '',
    jobType: offer.jobType || 'Full-time',
    salary: offer.salary || '',
    location: offer.location || '',
    joiningDate: offer.joiningDate || '',
    expiryDate: offer.expiryDate || '',
    reportingManager: offer.reportingManager || '',
    probationPeriod: offer.probationPeriod || '',
    sentDate: offer.sentDate || '',
    status: offer.status === 'Sent' ? 'Pending' : (offer.status || 'Pending'),
    notes: offer.notes || '',
  };
}

/** Find (or open) the job application behind a candidate, for offer linkage. */
async function resolveApplicationId(candidateId, candidates) {
  if (!isServerId(candidateId)) return null;
  try {
    const existing = await hrmsSync.pull('applications', { candidateId });
    if (existing && existing[0]?.id) return existing[0].id;
    const cand = (candidates || []).find((c) => String(c?.id) === String(candidateId));
    const jobId = cand?.jobId && isServerId(cand.jobId) ? cand.jobId : null;
    if (!jobId) return null;
    const created = await hrmsSync.create('applications', { candidateId, jobId });
    return created?.id || null;
  } catch {
    return null;
  }
}

export default function HRAdminPage({ defaultTab }) {
  const showToast = useAppStore((s) => s.showToast);
  const employees = useAppStore((s) => s.employees || []);
  const { candidates, addOffer } = useRecruitmentStore();
  const updateEmployeeStatus = useAppStore((s) => s.updateEmployeeStatus);
  const addCalendarEvent = useCalendarStore((s) => s.addEvent);

  // Leave Governance & Carry-Forward Policies
  const sandwichRuleEnabled = useAppStore((s) => s.sandwichRuleEnabled);
  const toggleSandwichRule = useAppStore((s) => s.toggleSandwichRule);
  const maxCarryForwardDays = useAppStore((s) => s.maxCarryForwardDays);
  const setMaxCarryForwardDays = useAppStore((s) => s.setMaxCarryForwardDays);
  const executeCarryForwardRollover = useAppStore((s) => s.executeCarryForwardRollover);
  const carriedForwardLeaves = useAppStore((s) => s.carriedForwardLeaves);

  // HRMS module availability toggles — Recruitment & Training sidebar + routes
  const recruitmentEnabled = useAppStore((s) => s.recruitmentEnabled ?? true);
  const setRecruitmentEnabled = useAppStore((s) => s.setRecruitmentEnabled);
  const trainingEnabled = useAppStore((s) => s.trainingEnabled ?? true);
  const setTrainingEnabled = useAppStore((s) => s.setTrainingEnabled);

  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || defaultTab || "teams";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) setActiveTab(tabParam);
    else if (defaultTab) setActiveTab(defaultTab);
  }, [defaultTab, searchParams]);

  // Payroll Store Integration for Department Working Days & Hours
  const departmentWorkingDays = usePayrollStore((s) => s.departmentWorkingDays);
  const setDepartmentWorkingDays = usePayrollStore((s) => s.setDepartmentWorkingDays);
  const departmentWorkingHours = usePayrollStore((s) => s.departmentWorkingHours);
  const setDepartmentWorkingHours = usePayrollStore((s) => s.setDepartmentWorkingHours);
  const resetDepartmentWorkingDays = usePayrollStore((s) => s.resetDepartmentWorkingDays);
  const payrollEmployees = usePayrollStore((s) => s.employees || []);

  // Core Data Lists
  // Teams, approval chains and terminations are HRMS collections.
  const [departmentsConfig, setDepartmentsConfig] = useState([]);
  const [teams, setTeams] = useState([]);
  const [approvalChains, setApprovalChains] = useState([]);
  const [terminations, setTerminations] = useState([]);

  useEffect(() => {
    let cancelled = false;
    hrmsSync.pullMany(['teams', 'approvalChains', 'terminations', 'complaints', 'departments', 'offers', 'resignations', 'holidays', 'applications'])
      .then((rows) => {
        if (cancelled) return;
        if (rows.teams) setTeams(rows.teams);
        if (rows.approvalChains) setApprovalChains(rows.approvalChains);
        if (rows.terminations) setTerminations(rows.terminations);
        if (rows.complaints) setComplaints(rows.complaints);
        if (rows.departments) setDepartmentsConfig(rows.departments);
        // Tabs that used to start empty: seed them from the server. Rows
        // already on screen (local creates) win over the same server row.
        if (rows.resignations) {
          setResignations((prev) => mergeServerRows(prev, rows.resignations));
        }
        if (rows.holidays) {
          setHolidays((prev) => mergeServerRows(prev, rows.holidays));
        }
        if (rows.offers) {
          setOffersList((prev) => mergeServerRows(
            prev, rows.offers.map((o) => serverOfferToRow(o, rows.applications || [])),
          ));
        }
      });
    // Org configuration itself lives under the `hrms` settings key.
    pullHrmsSettings().then((settings) => {
      if (!cancelled && settings && settings.org) {
        setOrgSettings((prev) => ({ ...prev, ...settings.org }));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [offersList, setOffersList] = useState([]);
  const [resignations, setResignations] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [holidays, setHolidays] = useState([]);

  // Search & Filters for each tab
  const [search, setSearch] = useState("");
  const [teamDeptFilter, setTeamDeptFilter] = useState("all");
  const [chainStatusFilter, setChainStatusFilter] = useState("all");
  const [offerStatusFilter, setOfferStatusFilter] = useState("all");
  const [terminationFilter, setTerminationFilter] = useState("all");
  const [resignationFilter, setResignationFilter] = useState("all");
  const [complaintPriorityFilter, setComplaintPriorityFilter] = useState("all");
  const [holidayFilter, setHolidayFilter] = useState("all");

  // Quick Action Dropdown State
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const quickActionRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (quickActionRef.current && !quickActionRef.current.contains(e.target)) {
        setIsQuickActionOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Letter & Offer Modals State
  const [activeTerminationLetter, setActiveTerminationLetter] = useState(null);
  const [isTerminationLetterModalOpen, setIsTerminationLetterModalOpen] = useState(false);
  const [activeOfferLetter, setActiveOfferLetter] = useState(null);
  const [isOfferLetterModalOpen, setIsOfferLetterModalOpen] = useState(false);
  const [isGenerateOfferModalOpen, setIsGenerateOfferModalOpen] = useState(false);

  // Modals (Add / Edit)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: "", lead: "", members: 1, approver: "", dept: "Engineering" });

  const [isChainModalOpen, setIsChainModalOpen] = useState(false);
  const [editingChain, setEditingChain] = useState(null);
  const [newChain, setNewChain] = useState({ module: "Leave Management", tier1: "", tier2: "", tier3: "—", autoEscalateDays: 3, status: "Active" });

  const [isTerminationModalOpen, setIsTerminationModalOpen] = useState(false);
  const [newTermination, setNewTermination] = useState({
    employee: "",
    employeeId: "",
    dept: "Engineering",
    role: "",
    terminationType: "Involuntary (Performance)",
    noticeDate: "2024-10-11",
    exitDate: "2024-11-11",
    severance: "1 Month Gross",
    reason: "",
  });

  const [isResignationModalOpen, setIsResignationModalOpen] = useState(false);
  const [newResignation, setNewResignation] = useState({
    employee: "",
    employeeId: "",
    dept: "Engineering",
    role: "",
    submittedDate: "2024-10-11",
    lastWorkingDay: "2024-12-11",
    noticePeriod: "60 Days",
    handoverTo: "",
    reason: "",
  });

  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [newComplaint, setNewComplaint] = useState({
    complainant: "",
    against: "",
    category: "Workplace Harassment / POSH",
    priority: "High",
    assignedInvestigator: "Ayesha Khan (HR Director)",
    summary: "",
  });

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [newHoliday, setNewHoliday] = useState({
    name: "",
    date: "2024-11-01",
    day: "Friday",
    type: "National Gazetted",
    appliesTo: "All Locations",
  });

  // Org Settings State
  const [orgSettings, setOrgSettings] = useState({
    companyName: "Evenmore Infotech Ltd.",
    workWeek: "Monday - Friday (5 Days)",
    timezone: "IST (UTC +05:30) — Asia/Kolkata",
    fiscalYearStart: "April 01",
    probationPeriod: "90 Days (3 Months)",
    noticePeriod: "60 Days (2 Months)",
    allowEmployeeDelegation: true,
    requireTwoFactorForAdmin: true,
  });

  // ── Team Handlers ──────────────────────────────────────────
  const handleOpenAddTeam = () => {
    setEditingTeam(null);
    setNewTeam({ name: "", lead: "", members: 1, approver: "", dept: "Engineering" });
    setIsTeamModalOpen(true);
  };

  const handleOpenEditTeam = (team) => {
    setEditingTeam(team);
    setNewTeam({
      name: team.name,
      lead: team.lead,
      members: team.members,
      approver: team.approver,
      dept: team.dept,
    });
    setIsTeamModalOpen(true);
  };

  const handleSaveTeam = (e) => {
    e.preventDefault();
    if (!newTeam.name) return;

    if (editingTeam) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === editingTeam.id
            ? { ...t, ...newTeam, members: Number(newTeam.members) || 1 }
            : t
        )
      );
      if (isBackendEnabled()) {
        hrmsSync.update('teams', editingTeam.id, newTeam).catch(console.warn);
      }
      showToast(`Team "${newTeam.name}" updated successfully`);
    } else {
      const created = {
        id: `T-0${teams.length + 1}`,
        ...newTeam,
        members: Number(newTeam.members) || 1,
      };
      setTeams([...teams, created]);
      if (isBackendEnabled()) {
        hrmsSync.create('teams', created).then((saved) => {
          if (saved?.id) {
            setTeams((prev) => prev.map((t) => (t.id === created.id ? saved : t)));
          }
        }).catch(console.warn);
      }
      showToast(`Team "${created.name}" created successfully`);
    }
    setIsTeamModalOpen(false);
    setEditingTeam(null);
  };

  const handleDeleteTeam = (id, name) => {
    if (window.confirm(`Are you sure you want to remove team "${name}"?`)) {
      setTeams((prev) => prev.filter((t) => t.id !== id));
      if (isBackendEnabled()) {
        hrmsSync.remove('teams', id).catch(console.warn);
      }
      showToast(`Team "${name}" removed`);
    }
  };

  // ── Approval Chain Handlers ─────────────────────────────────
  const handleOpenAddChain = () => {
    setEditingChain(null);
    setNewChain({ module: "Leave Management", tier1: "", tier2: "", tier3: "—", autoEscalateDays: 3, status: "Active" });
    setIsChainModalOpen(true);
  };

  const handleOpenEditChain = (chain) => {
    setEditingChain(chain);
    setNewChain({
      module: chain.module,
      tier1: chain.tier1,
      tier2: chain.tier2,
      tier3: chain.tier3,
      autoEscalateDays: chain.autoEscalateDays,
      status: chain.status,
    });
    setIsChainModalOpen(true);
  };

  const handleSaveChain = (e) => {
    e.preventDefault();
    if (!newChain.tier1) return;

    if (editingChain) {
      setApprovalChains((prev) =>
        prev.map((c) => (c.id === editingChain.id ? { ...c, ...newChain } : c))
      );
      if (isBackendEnabled()) {
        hrmsSync.update('approvalChains', editingChain.id, newChain).catch(console.warn);
      }
      showToast(`Approval chain for "${newChain.module}" updated`);
    } else {
      const created = {
        id: `AC-0${approvalChains.length + 1}`,
        ...newChain,
        status: newChain.status || "Active",
      };
      setApprovalChains([...approvalChains, created]);
      if (isBackendEnabled()) {
        hrmsSync.create('approvalChains', created).then((saved) => {
          if (saved?.id) {
            setApprovalChains((prev) => prev.map((c) => (c.id === created.id ? saved : c)));
          }
        }).catch(console.warn);
      }
      showToast(`Approval chain for "${created.module}" configured`);
    }
    setIsChainModalOpen(false);
    setEditingChain(null);
  };

  const toggleChainStatus = (id) => {
    setApprovalChains((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = c.status === "Active" ? "Inactive" : "Active";
        if (isBackendEnabled()) {
          hrmsSync.update('approvalChains', id, { status: next }).catch(console.warn);
        }
        showToast(`Workflow status for ${c.module} set to ${next}`);
        return { ...c, status: next };
      })
    );
  };

  const handleDeleteChain = (id, module) => {
    if (window.confirm(`Remove approval workflow for "${module}"?`)) {
      setApprovalChains((prev) => prev.filter((c) => c.id !== id));
      if (isBackendEnabled()) {
        hrmsSync.remove('approvalChains', id).catch(console.warn);
      }
      showToast(`Approval chain for "${module}" removed`);
    }
  };

  // ── Termination Handlers ────────────────────────────────────
  const handleCreateTermination = (e) => {
    e.preventDefault();
    if (!newTermination.employee) return;
    const created = {
      id: `TRM-${100 + terminations.length + 1}`,
      ...newTermination,
      status: "In Exit Clearance",
      createdAt: new Date().toISOString().split("T")[0],
    };
    setTerminations([created, ...terminations]);
    if (isBackendEnabled()) {
      hrmsSync.create('terminations', created).then((saved) => {
        if (saved?.id) {
          setTerminations((prev) => prev.map((t) => (t.id === created.id ? saved : t)));
        }
      }).catch(console.warn);
    }
    setIsTerminationModalOpen(false);
    setActiveTerminationLetter(created);
    setIsTerminationLetterModalOpen(true);

    updateEmployeeStatus?.(created.employee, "Terminated");

    setNewTermination({
      employee: "",
      employeeId: "",
      dept: "Engineering",
      role: "",
      terminationType: "Involuntary (Performance)",
      noticeDate: new Date().toISOString().split("T")[0],
      exitDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      severance: "1 Month Gross",
      reason: "",
    });
    showToast(`Termination order logged & letter generated for ${created.employee}`);
  };

  const handleUpdateTermination = (updated) => {
    setTerminations((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
    if (isBackendEnabled()) {
      hrmsSync.update('terminations', updated.id, updated).catch(console.warn);
    }
    setActiveTerminationLetter(updated);
    showToast(`Termination letter & record updated`);
  };

  const toggleTerminationStatus = (id) => {
    setTerminations((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const nextStatus = t.status === "Completed" ? "In Exit Clearance" : "Completed";
        if (isBackendEnabled()) {
          hrmsSync.update('terminations', id, { status: nextStatus }).catch(console.warn);
        }
        showToast(`Termination status set to ${nextStatus}`);
        return { ...t, status: nextStatus };
      })
    );
  };

  // ── Offer Letters Handlers ──────────────────────────────────
  // Offers persist in `/hrms/offers/` linked to the candidate's application;
  // the local row keeps the letter fields and carries `serverOfferId`.
  const handleCreateOffer = async (newOffer) => {
    const row = { ...newOffer, serverOfferId: null };
    setOffersList((prev) => [row, ...prev]);
    addOffer?.(newOffer);
    setActiveOfferLetter(row);
    setIsOfferLetterModalOpen(true);
    showToast(`Offer letter generated for ${newOffer.candidateName}`);
    if (!isBackendEnabled() || !isServerId(newOffer.candidateId)) return;
    try {
      const applicationId = newOffer.applicationId
        || await resolveApplicationId(newOffer.candidateId, candidates);
      if (!applicationId) return;
      try {
        useRecruitmentStore.getState().updateCandidate?.(newOffer.candidateId, { stage: 'Offer' });
      } catch { /* stage sync is best-effort */ }
      const saved = await hrmsSync.create('offers', { ...newOffer, applicationId });
      if (saved?.id) {
        setOffersList((prev) => prev.map((o) =>
          (o.id === newOffer.id ? { ...o, serverOfferId: saved.id } : o)));
      }
    } catch (err) {
      console.warn('[HRMS] offer not saved:', err?.message || err);
    }
  };

  const handleUpdateOffer = (updated) => {
    setOffersList((prev) =>
      prev.map((o) => (o.id === updated.id ? updated : o))
    );
    if (updated?.serverOfferId && isBackendEnabled()) {
      hrmsSync.update('offers', updated.serverOfferId, updated).catch(console.warn);
    }
    setActiveOfferLetter(updated);
    showToast(`Offer letter updated`);
  };

  const toggleOfferStatus = (id, newStatus) => {
    setOffersList((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        if (o.serverOfferId && isBackendEnabled()) {
          hrmsSync.update('offers', o.serverOfferId, { status: newStatus }).catch(console.warn);
        }
        return { ...o, status: newStatus };
      })
    );
    showToast(`Offer status updated to ${newStatus}`);
  };

  // ── Resignation Handlers ───────────────────────────────────
  const handleCreateResignation = (e) => {
    e.preventDefault();
    if (!newResignation.employee) return;
    const created = {
      id: `RSG-${200 + resignations.length + 1}`,
      ...newResignation,
      status: "Pending Manager Review",
    };
    // Link the real employee row so the backend accepts the record: match
    // by name/email/chat id, otherwise the row stays local-only.
    if (isBackendEnabled() && !isServerId(created.employeeId)) {
      const match = (employees || []).find((x) =>
        (x?.name && x.name.toLowerCase() === String(created.employee).toLowerCase()) ||
        (created.employeeId && (String(x?.id) === String(created.employeeId) ||
          String(x?.email || '').toLowerCase() === String(created.employeeId).toLowerCase())));
      if (match && isServerId(match.id)) created.employeeId = match.id;
    }
    setResignations([created, ...resignations]);
    if (isBackendEnabled()) {
      hrmsSync.create('resignations', created).then((saved) => {
        if (saved?.id) {
          setResignations((prev) => prev.map((r) => (r.id === created.id ? saved : r)));
        }
      }).catch(console.warn);
    }
    setIsResignationModalOpen(false);

    updateEmployeeStatus?.(created.employee, "Notice Period");

    setNewResignation({
      employee: "",
      employeeId: "",
      dept: "Engineering",
      role: "",
      submittedDate: "2024-10-11",
      lastWorkingDay: "2024-12-11",
      noticePeriod: "60 Days",
      handoverTo: "",
      reason: "",
    });
    showToast(`Resignation recorded & status updated to Notice Period for ${created.employee}`);
  };

  const toggleResignationStatus = (id) => {
    setResignations((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next =
          r.status === "Pending Manager Review"
            ? "Exit Interview Scheduled"
            : r.status === "Exit Interview Scheduled"
            ? "Clearance In Progress"
            : r.status === "Clearance In Progress"
            ? "Relieved & Completed"
            : "Pending Manager Review";
        if (isBackendEnabled()) {
          hrmsSync.update('resignations', id, { status: next }).catch(console.warn);
        }
        showToast(`Resignation status updated to ${next}`);
        return { ...r, status: next };
      })
    );
  };

  // ── Complaint / Grievance Handlers ─────────────────────────
  const handleCreateComplaint = (e) => {
    e.preventDefault();
    if (!newComplaint.complainant || !newComplaint.against) return;
    const created = {
      id: `GRV-${300 + complaints.length + 1}`,
      ...newComplaint,
      filedOn: "2024-10-11",
      status: "Open",
    };
    setComplaints([created, ...complaints]);
    if (isBackendEnabled()) {
      hrmsSync.create('complaints', created).then((saved) => {
        if (saved?.id) {
          setComplaints((prev) => prev.map((c) => (c.id === created.id ? saved : c)));
        }
      }).catch(console.warn);
    }
    setIsComplaintModalOpen(false);
    setNewComplaint({
      complainant: "",
      against: "",
      category: "Workplace Harassment / POSH",
      priority: "High",
      assignedInvestigator: "Ayesha Khan (HR Director)",
      summary: "",
    });
    showToast(`Grievance ticket ${created.id} registered`);
  };

  const toggleComplaintStatus = (id) => {
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next =
          c.status === "Open"
            ? "Under Investigation"
            : c.status === "Under Investigation"
            ? "Resolved"
            : "Open";
        if (isBackendEnabled()) {
          hrmsSync.update('complaints', id, { status: next }).catch(console.warn);
        }
        showToast(`Grievance ${c.id} marked as ${next}`);
        return { ...c, status: next };
      })
    );
  };

  // ── Holiday Handlers ───────────────────────────────────────
  const handleOpenAddHoliday = () => {
    setEditingHoliday(null);
    setNewHoliday({ name: "", date: "2024-11-01", day: "Friday", type: "National Gazetted", appliesTo: "All Locations" });
    setIsHolidayModalOpen(true);
  };

  const handleOpenEditHoliday = (h) => {
    setEditingHoliday(h);
    setNewHoliday({
      name: h.name,
      date: h.date,
      day: h.day,
      type: h.type,
      appliesTo: h.appliesTo,
    });
    setIsHolidayModalOpen(true);
  };

  const handleSaveHoliday = (e) => {
    e.preventDefault();
    if (!newHoliday.name) return;

    if (editingHoliday) {
      setHolidays((prev) =>
        prev.map((h) => (h.id === editingHoliday.id ? { ...h, ...newHoliday } : h))
      );
      if (isBackendEnabled()) {
        hrmsSync.update('holidays', editingHoliday.id, newHoliday).catch(console.warn);
      }
      showToast(`Holiday "${newHoliday.name}" updated`);
    } else {
      const created = {
        id: `HOL-0${holidays.length + 1}`,
        ...newHoliday,
        status: "Upcoming",
      };
      setHolidays([...holidays, created]);
      if (isBackendEnabled()) {
        hrmsSync.create('holidays', created).then((saved) => {
          if (saved?.id) {
            setHolidays((prev) => prev.map((h) => (h.id === created.id ? saved : h)));
          }
        }).catch(console.warn);
      }

      addCalendarEvent?.({
        id: `EV-HOL-${Date.now()}`,
        title: created.name,
        date: created.date,
        startDate: created.date,
        endDate: created.date,
        type: "Holiday",
        category: "Company Holiday",
        time: "All Day",
        location: created.appliesTo,
        dept: "All Staff",
        organizer: "HR Governance",
        description: `${created.type} holiday applying to ${created.appliesTo}.`,
      });

      showToast(`Holiday "${created.name}" added and synced to calendar`);
    }
    setIsHolidayModalOpen(false);
    setEditingHoliday(null);
  };

  const handleDeleteHoliday = (id, name) => {
    if (window.confirm(`Remove holiday "${name}"?`)) {
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      if (isBackendEnabled()) {
        hrmsSync.remove('holidays', id).catch(console.warn);
      }
      showToast(`Holiday "${name}" removed`);
    }
  };

  // ── Org Settings ───────────────────────────────────────────
  // The configuration itself is stored server-side under the `hrms`
  // settings key, so it survives refresh and other devices.
  const handleSaveOrgSettings = async (e) => {
    e.preventDefault();
    if (!isBackendEnabled()) {
      showToast("Organization configuration updated successfully");
      return;
    }
    try {
      const current = await pullHrmsSettings().catch(() => ({}));
      await pushHrmsSettings({ ...(current || {}), org: orgSettings });
      showToast("Organization configuration updated successfully");
    } catch (err) {
      showToast(err?.message || "Organization configuration could not be saved.");
    }
  };

  // Unique departments for filter
  const departmentsList = Array.from(new Set(teams.map((t) => t.dept))).filter(Boolean);
  const totalTeamMembers = teams.reduce((acc, t) => acc + (Number(t.members) || 0), 0);

  // ── 9 Top KPI Button Cards Configuration ──
  const TOP_KPI_BUTTONS = [
    {
      id: "teams",
      label: "Teams",
      count: teams.length,
      subtext: `Across ${departmentsList.length} depts`,
      icon: Users,
      iconColor: "text-blue-700",
      accentBg: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      id: "working-days",
      label: "Work Schedule",
      count: `${departmentsConfig.length} Depts`,
      subtext: "Days & daily hours",
      icon: CalendarCheck,
      iconColor: "text-emerald-700",
      accentBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      id: "approvals",
      label: "Workflows",
      count: approvalChains.length,
      subtext: "Multi-tier active",
      icon: ShieldCheck,
      iconColor: "text-emerald-700",
      accentBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      id: "offers",
      label: "Offer Letters",
      count: offersList.length,
      subtext: "Hired & issued",
      icon: FileCheck2,
      iconColor: "text-teal-700",
      accentBg: "bg-teal-50 text-teal-700 border-teal-200",
    },
    {
      id: "terminations",
      label: "Terminations",
      count: terminations.length,
      subtext: "Exits recorded",
      icon: UserX,
      iconColor: "text-red-700",
      accentBg: "bg-red-50 text-red-700 border-red-200",
    },
    {
      id: "resignations",
      label: "Resignations",
      count: resignations.length,
      subtext: "Serving notice",
      icon: UserMinus,
      iconColor: "text-amber-700",
      accentBg: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      id: "complaints",
      label: "Grievances",
      count: complaints.length,
      subtext: "Active tickets",
      icon: MessageSquareWarning,
      iconColor: "text-purple-700",
      accentBg: "bg-purple-50 text-purple-700 border-purple-200",
    },
    {
      id: "holidays",
      label: "Holidays (2024)",
      count: holidays.length,
      subtext: "Gazetted & opt",
      icon: Calendar,
      iconColor: "text-indigo-700",
      accentBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    {
      id: "settings",
      label: "Org Settings",
      count: "8 Rules",
      subtext: "Governance active",
      icon: Settings,
      iconColor: "text-slate-700",
      accentBg: "bg-slate-50 text-slate-700 border-slate-200",
    },
  ];

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      <PageHeader
        title="HR Admin Setup & Governance"
        titleExtra={
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            Live Governance Hub
          </span>
        }
        subtitle="Configure organization settings, approval chains, offer letters, exits, grievances, and holiday calendars."
        guide={hrmsGuides.hrAdmin}
        actions={
          <>
            {/* Quick Action Dropdown */}
            <div className="relative" ref={quickActionRef}>
              <button
                type="button"
                onClick={() => setIsQuickActionOpen(!isQuickActionOpen)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-bdr rounded-xl text-[13px] font-semibold text-slate-800 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              >
                <Plus size={15} className="text-primary" />
                <span>Quick Action</span>
                <ChevronDown size={14} className="text-muted" />
              </button>

              {isQuickActionOpen && (
                <div className="absolute left-0 lg:left-auto lg:right-0 mt-2 w-56 bg-white border border-bdr rounded-2xl shadow-xl z-30 py-2 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-muted uppercase tracking-wider">
                    Create / Initiate
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenAddTeam();
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <Users size={14} className="text-blue-700" /> New Team / Squad
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenAddChain();
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck size={14} className="text-emerald-700" /> Approval Workflow
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsGenerateOfferModalOpen(true);
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <FileCheck2 size={14} className="text-teal-700" /> Generate Offer Letter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTerminationModalOpen(true);
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <UserX size={14} className="text-red-700" /> Record Termination
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResignationModalOpen(true);
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <UserMinus size={14} className="text-amber-700" /> Log Resignation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsComplaintModalOpen(true);
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <MessageSquareWarning size={14} className="text-purple-700" /> Register Grievance
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenAddHoliday();
                      setIsQuickActionOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                  >
                    <Calendar size={14} className="text-indigo-700" /> Add Holiday
                  </button>
                </div>
              )}
            </div>

            {/* Contextual Primary Action Button */}
            {activeTab === "teams" && (
              <button
                type="button"
                onClick={handleOpenAddTeam}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs cursor-pointer"
              >
                <Plus size={16} /> Create Team
              </button>
            )}
            {activeTab === "working-days" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetDepartmentWorkingDays();
                    showToast("Reset all departments to standard 24 working days");
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-[13px] font-medium hover:bg-slate-50 transition shadow-xs cursor-pointer"
                >
                  <RotateCcw size={14} /> Reset (24 Days)
                </button>
                <Link
                  to="/hrms/payroll"
                  style={{ color: '#ffffff', backgroundColor: '#1F2E4A' }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-navy text-white !text-white rounded-xl text-[13px] font-semibold hover:bg-navy/90 transition shadow-xs cursor-pointer"
                >
                  <Receipt size={15} className="text-white" style={{ color: '#ffffff' }} />
                  <span className="text-white font-semibold" style={{ color: '#ffffff' }}>View Live Payroll</span>
                  <ArrowRight size={14} className="text-white" style={{ color: '#ffffff' }} />
                </Link>
              </div>
            )}
            {activeTab === "approvals" && (
              <button
                type="button"
                onClick={handleOpenAddChain}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs cursor-pointer"
              >
                <Plus size={16} /> New Approval Chain
              </button>
            )}
            {activeTab === "offers" && (
              <button
                type="button"
                onClick={() => setIsGenerateOfferModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs cursor-pointer"
              >
                <Plus size={16} /> Generate Offer Letter
              </button>
            )}
            {activeTab === "terminations" && (
              <button
                type="button"
                onClick={() => setIsTerminationModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-700 text-white rounded-xl text-[13.5px] font-medium hover:bg-red-800 transition shadow-xs cursor-pointer"
              >
                <UserX size={16} /> Record Termination
              </button>
            )}
            {activeTab === "resignations" && (
              <button
                type="button"
                onClick={() => setIsResignationModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs cursor-pointer"
              >
                <UserMinus size={16} /> Submit Resignation
              </button>
            )}
            {activeTab === "complaints" && (
              <button
                type="button"
                onClick={() => setIsComplaintModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-700 text-white rounded-xl text-[13.5px] font-medium hover:bg-amber-800 transition shadow-xs cursor-pointer"
              >
                <MessageSquareWarning size={16} /> File Grievance / Complaint
              </button>
            )}
            {activeTab === "holidays" && (
              <button
                type="button"
                onClick={handleOpenAddHoliday}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs cursor-pointer"
              >
                <Calendar size={16} /> Add Holiday
              </button>
            )}
            {activeTab === "settings" && (
              <button
                type="button"
                onClick={handleSaveOrgSettings}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs cursor-pointer"
              >
                <CheckCircle2 size={16} /> Save Configuration
              </button>
            )}
          </>
        }
      />

      {/* ── TOP BUTTONS: Interactive 9 KPI Buttons ── */}
      {/* Clicking any button immediately switches the view */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
        {TOP_KPI_BUTTONS.map((btn) => {
          const isActive = activeTab === btn.id;
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => {
                setActiveTab(btn.id);
                setSearch("");
              }}
              title={`Switch to ${btn.label} view`}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
                isActive
                  ? "bg-white border-navy ring-2 ring-navy/20 shadow-xs"
                  : "bg-white border-bdr hover:border-slate-300 hover:shadow-xs hover:-translate-y-0.5"
              }`}
            >
              {isActive && <span className="absolute top-0 left-0 right-0 h-1 bg-navy" />}
              <div className="text-[11.5px] text-muted flex items-center justify-between font-medium">
                <span className={isActive ? "font-bold text-slate-900" : ""}>{btn.label}</span>
                <Icon size={15} className={btn.iconColor} />
              </div>
              <div className={`text-[20px] font-bold mt-1 ${isActive ? "text-navy" : "text-slate-900"}`}>
                {btn.count}
              </div>
              <div className="text-[10.5px] text-muted flex items-center justify-between mt-0.5">
                <span>{btn.subtext}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-navy animate-pulse" title="Active View" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          VIEW 1: TEAMS & SQUADS DIRECTORY (THE TABLE)
          Separated dedicated container with search, department filters,
          and interactive management table
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === "teams" && (
        <div className="flex flex-col gap-4">
          {/* Dedicated View Header */}
          <div className="bg-white border border-bdr rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">Teams &amp; Squads Directory</h2>
                <p className="text-[12px] text-muted">
                  Organizational squads, department structures, team leaders, and designated leave approvers.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                {teams.length} Squads • {totalTeamMembers} Total Staff
              </span>
            </div>
          </div>

          {/* Search & Department Filters Toolbar */}
          <div className="bg-white border border-bdr rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search teams by name, ID, lead, approver..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-[12.5px] rounded-lg border border-bdr bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
            </div>

            {/* Department Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] text-muted font-medium mr-1">Dept:</span>
              <button
                type="button"
                onClick={() => setTeamDeptFilter("all")}
                className={`px-3 py-1 rounded-lg text-[12px] font-medium transition cursor-pointer ${
                  teamDeptFilter === "all" ? "bg-navy text-white font-semibold" : "bg-off text-muted hover:text-slate-800"
                }`}
              >
                All
              </button>
              {departmentsList.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTeamDeptFilter(d)}
                  className={`px-3 py-1 rounded-lg text-[12px] font-medium transition cursor-pointer ${
                    teamDeptFilter === d ? "bg-navy text-white font-semibold" : "bg-off text-muted hover:text-slate-800"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Teams Table Container */}
          <div className="bg-white border border-bdr rounded-xl shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-bdr flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 bg-off/50">
              <span className="text-[12.5px] font-bold text-slate-800">Departmental Squad List</span>
              <span className="text-[11.5px] text-muted">
                Showing {teams.filter((t) => {
                  const matchSearch = !search || String(t.name ?? '').toLowerCase().includes(search.toLowerCase()) || String(t.lead ?? '').toLowerCase().includes(search.toLowerCase()) || String(t.id ?? '').toLowerCase().includes(search.toLowerCase()) || String(t.dept ?? '').toLowerCase().includes(search.toLowerCase());
                  const matchDept = teamDeptFilter === "all" || t.dept === teamDeptFilter;
                  return matchSearch && matchDept;
                }).length} of {teams.length} teams
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] lg:min-w-0 text-left text-[13px]">
                <thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted">
                  <tr>
                    <th className="py-3 px-5">Team Name</th>
                    <th className="py-3 px-5">ID</th>
                    <th className="py-3 px-5">Department</th>
                    <th className="py-3 px-5">Team Lead</th>
                    <th className="py-3 px-5">Headcount</th>
                    <th className="py-3 px-5">Default Approver</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/40">
                  {teams
                    .filter((t) => {
                      const matchSearch =
                        !search ||
                        String(t.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        String(t.lead ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        String(t.id ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        String(t.dept ?? '').toLowerCase().includes(search.toLowerCase());
                      const matchDept = teamDeptFilter === "all" || t.dept === teamDeptFilter;
                      return matchSearch && matchDept;
                    })
                    .map((t) => (
                      <tr key={t.id} className="hover:bg-off/60 transition">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-center font-bold text-[12px]">
                              {t.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{t.name}</div>
                              <div className="text-[11px] text-muted">Designated Operational Squad</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-muted font-mono text-[12px]">{t.id}</td>
                        <td className="py-4 px-5">
                          <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-800 rounded-full text-[11.5px] font-medium">
                            {t.dept}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-slate-800 font-medium">{t.lead}</td>
                        <td className="py-4 px-5 text-slate-700">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                            <Users size={13} className="text-muted" />
                            {t.members} members
                          </span>
                        </td>
                        <td className="py-4 px-5 text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            {t.approver}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditTeam(t)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-muted hover:text-slate-900 transition cursor-pointer"
                              title="Edit Team Details"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTeam(t.id, t.name)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-muted hover:text-red-600 transition cursor-pointer"
                              title="Remove Team"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {teams.filter((t) => {
                const matchSearch =
                  !search ||
                  String(t.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
                  String(t.lead ?? '').toLowerCase().includes(search.toLowerCase()) ||
                  String(t.id ?? '').toLowerCase().includes(search.toLowerCase()) ||
                  String(t.dept ?? '').toLowerCase().includes(search.toLowerCase());
                const matchDept = teamDeptFilter === "all" || t.dept === teamDeptFilter;
                return matchSearch && matchDept;
              }).length === 0 && (
                <div className="py-12 text-center text-muted">
                  <Users size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-slate-700">No teams matching criteria</p>
                  <p className="text-[12px] mt-0.5">Try adjusting your search query or department filter</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VIEW 2: APPROVAL CHAINS (ROUTING WORKFLOWS)
          Separated dedicated container for approval tiers & SLA rules
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === "approvals" && (
        <div className="flex flex-col gap-4">
          {/* View Header */}
          <div className="bg-white border border-bdr rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">Multi-Tier Approval Chains</h2>
                <p className="text-[12px] text-muted">
                  Define automated approval hierarchies, multi-level sign-offs, and SLA auto-escalations.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-medium text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                {approvalChains.filter((c) => c.status === "Active").length} Active Workflows
              </span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white border border-bdr rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search workflows by module name or approver..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-[12.5px] rounded-lg border border-bdr bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-muted font-medium mr-1">Status:</span>
              {["all", "Active", "Inactive"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setChainStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-[12px] font-medium transition cursor-pointer ${
                    chainStatusFilter === st
                      ? "bg-navy text-white font-semibold"
                      : "bg-off text-muted hover:text-slate-800"
                  }`}
                >
                  {st === "all" ? "All Workflows" : st}
                </button>
              ))}
            </div>
          </div>

          {/* Approval Chains Table */}
          <div className="bg-white border border-bdr rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] lg:min-w-0 text-left text-[13px]">
                <thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted">
                  <tr>
                    <th className="py-3 px-5">Target Module</th>
                    <th className="py-3 px-5">Tier 1 (First Line)</th>
                    <th className="py-3 px-5">Tier 2 (Managerial)</th>
                    <th className="py-3 px-5">Tier 3 (Final Authority)</th>
                    <th className="py-3 px-5">SLA Escalation</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/40">
                  {approvalChains
                    .filter((c) => {
                      const matchSearch =
                        !search ||
                        String(c.module ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        String(c.tier1 ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        String(c.tier2 ?? '').toLowerCase().includes(search.toLowerCase()) ||
                        String(c.tier3 ?? '').toLowerCase().includes(search.toLowerCase());
                      const matchStatus =
                        chainStatusFilter === "all" || c.status === chainStatusFilter;
                      return matchSearch && matchStatus;
                    })
                    .map((c) => (
                      <tr key={c.id} className="hover:bg-off/60 transition">
                        <td className="py-4 px-5 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <Layers size={15} className="text-navy" />
                            <span>{c.module}</span>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-medium text-slate-800">
                            <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] flex items-center justify-center">1</span>
                            {c.tier1}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-medium text-slate-800">
                            <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center">2</span>
                            {c.tier2}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          {c.tier3 && c.tier3 !== "—" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[12px] font-medium text-slate-800">
                              <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px] flex items-center justify-center">3</span>
                              {c.tier3}
                            </span>
                          ) : (
                            <span className="text-muted text-[12px]">—</span>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                            <Clock size={12} />
                            {c.autoEscalateDays} days
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <button
                            type="button"
                            onClick={() => toggleChainStatus(c.id)}
                            title="Click to toggle active status"
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition cursor-pointer ${
                              c.status === "Active"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                            }`}
                          >
                            {c.status}
                          </button>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditChain(c)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-muted hover:text-slate-900 transition cursor-pointer"
                              title="Edit Approval Chain"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteChain(c.id, c.module)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-muted hover:text-red-600 transition cursor-pointer"
                              title="Delete Approval Chain"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VIEW 3: EMPLOYMENT OFFER LETTERS (OPTION LIST)
          Separated dedicated container with recruitment integration
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === "offers" && (
        <div className="flex flex-col gap-4">
          {/* View Header */}
          <div className="bg-white border border-bdr rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center font-bold">
                <FileCheck2 size={20} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">Employment Offer Letters &amp; Terms</h2>
                <p className="text-[12px] text-muted">
                  Track issued offer letters, compensation terms, candidate responses, and printable formal PDFs.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-medium text-teal-800 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
                {offersList.length} Generated Offers
              </span>
            </div>
          </div>

          {/* Hired Candidates Banner */}
          {candidates.some((c) => c.stage === "Hired") && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-emerald-950">
                    Recruitment Integration: Hired Candidates Ready for Official Offer Letters
                  </div>
                  <div className="text-[12px] text-emerald-700">
                    Candidates in pipeline currently in &ldquo;Hired&rdquo; stage:{" "}
                    <b>
                      {candidates
                        .filter((c) => c.stage === "Hired")
                        .map((c) => c.name)
                        .join(", ")}
                    </b>
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Ready for Offer
              </span>
            </div>
          )}

          {/* Filter / Search Bar */}
          <div className="bg-white border border-bdr rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search offer letters by candidate, position, or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-[12.5px] rounded-lg border border-bdr bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-muted font-medium mr-1">Status:</span>
              {["all", "Accepted", "Pending", "Declined"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setOfferStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-[12px] font-medium transition cursor-pointer ${
                    offerStatusFilter === st
                      ? "bg-navy text-white font-semibold"
                      : "bg-off text-muted hover:text-slate-800"
                  }`}
                >
                  {st === "all" ? "All Offers" : st}
                </button>
              ))}
            </div>
          </div>

          {/* Offer Letters Table */}
          <div className="bg-white border border-bdr rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-bdr flex flex-wrap items-center justify-between gap-3 bg-off/50">
              <span className="text-[13px] font-semibold text-slate-800">
                Issued Employment Offer Letters &amp; Compensation Terms
              </span>
              <span className="text-[12px] text-muted">
                Showing {offersList.length} total generated offers
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] lg:min-w-0 text-left text-[13px]">
                <thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted">
                  <tr>
                    <th className="py-3 px-5">Candidate &amp; ID</th>
                    <th className="py-3 px-5">Role &amp; Department</th>
                    <th className="py-3 px-5">Job Type</th>
                    <th className="py-3 px-5">Stipend / Salary</th>
                    <th className="py-3 px-5">Location &amp; Mode</th>
                    <th className="py-3 px-5">Joining Date</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/40">
                  {offersList
                    .filter((o) => {
                      const matchSearch =
                        !search ||
                        o.candidateName?.toLowerCase().includes(search.toLowerCase()) ||
                        o.position?.toLowerCase().includes(search.toLowerCase()) ||
                        o.id?.toLowerCase().includes(search.toLowerCase());
                      const matchStatus =
                        offerStatusFilter === "all" || o.status === offerStatusFilter;
                      return matchSearch && matchStatus;
                    })
                    .map((o) => (
                      <tr key={o.id} className="hover:bg-off/60 transition">
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-900">{o.candidateName}</div>
                          <div className="text-[11px] font-mono text-muted">
                            {o.id} • {o.email || "No email"}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="text-slate-800 font-medium">{o.position}</div>
                          <div className="text-[11px] text-muted">{o.dept}</div>
                        </td>
                        <td className="py-4 px-5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              o.jobType === "Internship"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : o.jobType === "Contract"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {o.jobType || "Full-time"}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <div className="font-bold text-emerald-800">{o.salary}</div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="text-slate-800">{o.location || "New York HQ"}</div>
                          <div className="text-[11px] text-muted">{o.workMode || "Hybrid"}</div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="text-slate-800 font-medium">{o.joiningDate}</div>
                        </td>
                        <td className="py-4 px-5">
                          <select
                            value={o.status}
                            onChange={(e) => toggleOfferStatus(o.id, e.target.value)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer focus:outline-none ${
                              o.status === "Accepted"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : o.status === "Declined"
                                ? "bg-red-50 text-red-800 border-red-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Accepted">Accepted</option>
                            <option value="Declined">Declined</option>
                          </select>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveOfferLetter(o);
                                setIsOfferLetterModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition cursor-pointer"
                              title="View / Edit Offer Letter & Print PDF"
                            >
                              <FileCheck2 size={13} />
                              <span>Letter &amp; PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveOfferLetter(o);
                                setIsOfferLetterModalOpen(true);
                                setTimeout(() => window.print(), 350);
                              }}
                              className="p-1.5 hover:bg-off rounded-lg text-muted hover:text-slate-900 cursor-pointer"
                              title="Direct Print / Save PDF"
                            >
                              <Printer size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VIEW 4: TERMINATION LIST
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === "terminations" && (
        <div className="bg-white border border-bdr rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-bdr flex flex-wrap items-center justify-between gap-3 bg-off/50">
            <div>
              <span className="text-[13px] font-semibold text-slate-800">
                Involuntary Exits, Disciplinary Records &amp; Termination Letters
              </span>
              <p className="text-[11.5px] text-muted">
                Formal legal notices, exit clearance status, and changeable PDF termination documents
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-medium text-red-800 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                {terminations.length} Exit Records
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] lg:min-w-0 text-left text-[13px]">
              <thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted">
                <tr>
                  <th className="py-3 px-5">Employee &amp; ID</th>
                  <th className="py-3 px-5">Department &amp; Role</th>
                  <th className="py-3 px-5">Termination Type</th>
                  <th className="py-3 px-5">Notice &amp; Exit Date</th>
                  <th className="py-3 px-5">Severance Terms</th>
                  <th className="py-3 px-5">Clearance Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/40">
                {terminations
                  .filter((t) => {
                    if (!search) return true;
                    return (
                      t.employee?.toLowerCase().includes(search.toLowerCase()) ||
                      t.employeeId?.toLowerCase().includes(search.toLowerCase()) ||
                      t.role?.toLowerCase().includes(search.toLowerCase()) ||
                      t.id?.toLowerCase().includes(search.toLowerCase())
                    );
                  })
                  .map((t) => (
                    <tr key={t.id} className="hover:bg-off/60 transition">
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900">{t.employee}</div>
                        <div className="text-[11px] font-mono text-muted">{t.employeeId} • {t.id}</div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-slate-800 font-medium">{t.role}</div>
                        <div className="text-[11px] text-muted">{t.dept}</div>
                      </td>
                      <td className="py-4 px-5">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                          {t.terminationType}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-slate-800">Exit: <b>{t.exitDate}</b></div>
                        <div className="text-[11px] text-muted">Notice: {t.noticeDate}</div>
                      </td>
                      <td className="py-4 px-5 text-slate-700">{t.severance}</td>
                      <td className="py-4 px-5">
                        <button
                          type="button"
                          onClick={() => toggleTerminationStatus(t.id)}
                          title="Click to toggle clearance status"
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition cursor-pointer ${
                            t.status === "Completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                          }`}
                        >
                          {t.status}
                        </button>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTerminationLetter(t);
                              setIsTerminationLetterModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-semibold bg-red-50 text-red-700 hover:bg-red-100 rounded-lg border border-red-200 transition cursor-pointer"
                            title="View / Edit Termination Letter & Print PDF"
                          >
                            <FileText size={13} />
                            <span>Letter &amp; PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTerminationLetter(t);
                              setIsTerminationLetterModalOpen(true);
                              setTimeout(() => window.print(), 350);
                            }}
                            className="p-1.5 hover:bg-off rounded-lg text-muted hover:text-slate-900 cursor-pointer"
                            title="Direct Print / Save PDF"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => showToast(`Reason: ${t.reason}`)}
                            className="p-1.5 hover:bg-off rounded-lg text-muted hover:text-slate-900 cursor-pointer"
                            title="View Reason"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VIEW 5: RESIGNATION LIST
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === "resignations" && (
        <div className="bg-white border border-bdr rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-bdr flex flex-wrap items-center justify-between gap-3 bg-off/50">
            <div>
              <span className="text-[13px] font-semibold text-slate-800">
                Voluntary Resignations &amp; Notice Period Tracker
              </span>
              <p className="text-[11.5px] text-muted">Knowledge transfer and handover coordination</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-medium text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                {resignations.length} Active Notice Periods
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] lg:min-w-0 text-left text-[13px]">
              <thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted">
                <tr>
                  <th className="py-3 px-5">Employee &amp; ID</th>
                  <th className="py-3 px-5">Role &amp; Department</th>
                  <th className="py-3 px-5">Submission Date</th>
                  <th className="py-3 px-5">Last Working Day</th>
                  <th className="py-3 px-5">Handover Assignee</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/40">
                {resignations.map((r) => (
                  <tr key={r.id} className="hover:bg-off/60 transition">
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900">{r.employee}</div>
                      <div className="text-[11px] font-mono text-muted">{r.employeeId} • {r.id}</div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="text-slate-800 font-medium">{r.role}</div>
                      <div className="text-[11px] text-muted">{r.dept}</div>
                    </td>
                    <td className="py-4 px-5 text-slate-700">{r.submittedDate}</td>
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900">{r.lastWorkingDay}</div>
                      <div className="text-[11px] text-muted">Notice: {r.noticePeriod}</div>
                    </td>
                    <td className="py-4 px-5 text-slate-800">{r.handoverTo}</td>
                    <td className="py-4 px-5">
                      <button
                        type="button"
                        onClick={() => toggleResignationStatus(r.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer ${
                          r.status.includes("Approved")
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : r.status.includes("Clearance")
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {r.status}
                      </button>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => showToast(`Resignation Reason: ${r.reason}`)}
                        className="p-1.5 hover:bg-off rounded-lg text-muted hover:text-slate-900 cursor-pointer"
                        title="View Reason"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VIEW 6: COMPLAINT & GRIEVANCE LIST
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === "complaints" && (
        <div className="bg-white border border-bdr rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-bdr flex flex-wrap items-center justify-between gap-3 bg-off/50">
            <div>
              <span className="text-[13px] font-semibold text-slate-800">
                Employee Grievances, POSH &amp; Compliance Inquiries
              </span>
              <p className="text-[11.5px] text-muted">Confidential investigation and resolution records</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-medium text-purple-800 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200">
                {complaints.length} Registered Tickets
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] lg:min-w-0 text-left text-[13px]">
              <thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted">
                <tr>
                  <th className="py-3 px-5">Ticket &amp; Filed On</th>
                  <th className="py-3 px-5">Complainant / Against</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5">Priority</th>
                  <th className="py-3 px-5">Assigned Investigator</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/40">
                {complaints.map((c) => (
                  <tr key={c.id} className="hover:bg-off/60 transition">
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900">{c.id}</div>
                      <div className="text-[11px] text-muted">{c.filedOn}</div>
                    </td>
                    <td className="py-4 px-5">
                      <div className="text-slate-900 font-medium">By: {c.complainant}</div>
                      <div className="text-[11px] text-muted">Target: {c.against}</div>
                    </td>
                    <td className="py-4 px-5 text-slate-800 font-medium">{c.category}</td>
                    <td className="py-4 px-5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${
                          c.priority === "High"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : c.priority === "Medium"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {c.priority}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-800">{c.assignedInvestigator}</td>
                    <td className="py-4 px-5">
                      <button
                        type="button"
                        onClick={() => toggleComplaintStatus(c.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer ${
                          c.status === "Resolved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : c.status === "Under Investigation"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {c.status}
                      </button>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => showToast(`Grievance: ${c.summary}`)}
                        className="p-1.5 hover:bg-off rounded-lg text-muted hover:text-slate-900 cursor-pointer"
                        title="View Summary"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VIEW 7: HOLIDAYS SETUP CALENDAR
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === "holidays" && (
        <div className="bg-white border border-bdr rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-bdr flex flex-wrap items-center justify-between gap-3 bg-off/50">
            <div>
              <span className="text-[13px] font-semibold text-slate-800">
                Annual Enterprise Holiday Schedule (2024–2025)
              </span>
              <p className="text-[11.5px] text-muted">Synchronized across Personal Calendar &amp; Attendance modules</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-medium text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                {holidays.length} Annual Holidays
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] lg:min-w-0 text-left text-[13px]">
              <thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted">
                <tr>
                  <th className="py-3 px-5">Holiday Name</th>
                  <th className="py-3 px-5">Date &amp; Day</th>
                  <th className="py-3 px-5">Classification</th>
                  <th className="py-3 px-5">Applies To</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/40">
                {holidays.map((h) => (
                  <tr key={h.id} className="hover:bg-off/60 transition">
                    <td className="py-4 px-5 font-bold text-slate-900 flex items-center gap-2">
                      <Calendar size={15} className="text-navy" />
                      {h.name}
                    </td>
                    <td className="py-4 px-5">
                      <div className="text-slate-900 font-medium">{h.date}</div>
                      <div className="text-[11px] text-muted">{h.day}</div>
                    </td>
                    <td className="py-4 px-5">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-off border border-bdr text-slate-700">
                        {h.type}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-800">{h.appliesTo}</td>
                    <td className="py-4 px-5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                          h.status === "Upcoming"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {h.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditHoliday(h)}
                          className="p-1.5 hover:bg-off rounded-lg text-muted hover:text-slate-900 cursor-pointer"
                          title="Edit Holiday"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHoliday(h.id, h.name)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-muted hover:text-red-600 cursor-pointer"
                          title="Remove Holiday"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VIEW 8: GENERAL ORGANIZATION SETTINGS
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === "settings" && (
        <form onSubmit={handleSaveOrgSettings} className="bg-white border border-bdr rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Legal Company Name</label>
              <input
                type="text"
                value={orgSettings.companyName}
                onChange={(e) => setOrgSettings({ ...orgSettings, companyName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Default Work Week</label>
              <select
                value={orgSettings.workWeek}
                onChange={(e) => setOrgSettings({ ...orgSettings, workWeek: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
              >
                <option>Monday - Friday (5 Days)</option>
                <option>Monday - Saturday (6 Days)</option>
                <option>Alternate Saturdays Off (5.5 Days)</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Primary Office Timezone</label>
              <select
                value={orgSettings.timezone}
                onChange={(e) => setOrgSettings({ ...orgSettings, timezone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
              >
                <option>IST (UTC +05:30) — Asia/Kolkata</option>
                <option>EST (UTC -05:00) — America/New_York</option>
                <option>GMT (UTC +00:00) — Europe/London</option>
                <option>GST (UTC +04:00) — Asia/Dubai</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Fiscal Year Start</label>
              <select
                value={orgSettings.fiscalYearStart}
                onChange={(e) => setOrgSettings({ ...orgSettings, fiscalYearStart: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
              >
                <option>April 01 (Indian Standard Fiscal Cycle)</option>
                <option>January 01 (Calendar Year)</option>
                <option>July 01</option>
                <option>October 01</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Standard Probation Period</label>
              <input
                type="text"
                value={orgSettings.probationPeriod}
                onChange={(e) => setOrgSettings({ ...orgSettings, probationPeriod: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Standard Notice Period</label>
              <input
                type="text"
                value={orgSettings.noticePeriod}
                onChange={(e) => setOrgSettings({ ...orgSettings, noticePeriod: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-bdr flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={orgSettings.allowEmployeeDelegation}
                onChange={(e) => setOrgSettings({ ...orgSettings, allowEmployeeDelegation: e.target.checked })}
                className="w-4 h-4 rounded text-navy focus:ring-navy cursor-pointer"
              />
              <span className="text-[13px] text-slate-800">
                Allow team members to designate peer delegates during planned leaves
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={orgSettings.requireTwoFactorForAdmin}
                onChange={(e) => setOrgSettings({ ...orgSettings, requireTwoFactorForAdmin: e.target.checked })}
                className="w-4 h-4 rounded text-navy focus:ring-navy cursor-pointer"
              />
              <span className="text-[13px] text-slate-800">
                Enforce mandatory 2-Factor Authentication (2FA) for HR and Operations Admin accounts
              </span>
            </label>
          </div>

          {/* HRMS Module Availability — Recruitment & Training toggles */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold">
                <Sliders size={20} />
              </div>
              <div>
                <h4 className="font-bold text-[14px] text-slate-900">Module Availability — Recruitment</h4>
                <p className="text-[12px] text-muted">
                  Turn a module ON to show it in the HRMS sidebar and enable its pages. Turn it OFF to hide it completely.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Recruitment toggle */}
              <div className="bg-white border border-bdr rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-bold text-slate-900">Recruitment</div>
                  <div className="text-[11.5px] text-muted mt-0.5">
                    Jobs, Candidates, Interviews, Offers &amp; Onboarding
                  </div>
                  <span className={`inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${recruitmentEnabled ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-300"}`}>
                    {recruitmentEnabled ? "Visible in sidebar" : "Hidden"}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={recruitmentEnabled}
                  aria-label="Toggle Recruitment module"
                  onClick={() => {
                    setRecruitmentEnabled(!recruitmentEnabled);
                    showToast(`Recruitment module ${!recruitmentEnabled ? "Enabled — visible in sidebar" : "Disabled — hidden from sidebar"}.`);
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${recruitmentEnabled ? "bg-emerald-600" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${recruitmentEnabled ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              {/* Training toggle commented out
              <div className="bg-white border border-bdr rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-bold text-slate-900">Training</div>
                  <div className="text-[11.5px] text-muted mt-0.5">
                    Training programs, Trainers &amp; Funnel
                  </div>
                  <span className={`inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${trainingEnabled ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-300"}`}>
                    {trainingEnabled ? "Visible in sidebar" : "Hidden"}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={trainingEnabled}
                  aria-label="Toggle Training module"
                  onClick={() => {
                    setTrainingEnabled(!trainingEnabled);
                    showToast(`Training module ${!trainingEnabled ? "Enabled — visible in sidebar" : "Disabled — hidden from sidebar"}.`);
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${trainingEnabled ? "bg-emerald-600" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${trainingEnabled ? "left-[22px]" : "left-0.5"}`} />
                </button>
                </div>
              </div>
              */}
            </div>
          </div>

          {/* Department Working Days Policy Preview Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 lg:gap-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
                <CalendarCheck size={20} />
              </div>
              <div>
                <h4 className="font-bold text-[14px] text-slate-900">Department Working Days Policy</h4>
                <p className="text-[12px] text-muted">
                  Configured across {departmentsConfig.length} operational departments. Controls salary per-day rates and absent day deductions in Payroll.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("working-days")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 text-slate-800 rounded-xl text-[12.5px] font-medium hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            >
              <span>Configure Schedule</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="submit"
              className="px-6 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs cursor-pointer"
            >
              Save Organization Settings
            </button>
          </div>
        </form>
      )}

      {/* ════════════════════════════════════════════════════════════════
          VIEW 9: DEPARTMENT WORKING DAYS GOVERNANCE
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === "working-days" && (
        <div className="flex flex-col gap-4">
          {/* Dedicated View Header */}
          <div className="bg-white border border-bdr rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
                <CalendarCheck size={20} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">Department Working Schedule &amp; Hours Governance</h2>
                <p className="text-[12px] text-muted">
                  Configure monthly working days and daily operational working hours per department. All changes sync dynamically with Employee-wise Payroll calculations.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  resetDepartmentWorkingDays();
                  showToast("Reset all departments to standard 24 working days and 8 hours/day");
                }}
                className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-[12.5px] font-medium hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              >
                Reset Defaults (24d • 8h)
              </button>
              <Link
                to="/hrms/payroll"
                style={{ color: '#ffffff', backgroundColor: '#1F2E4A' }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white !text-white rounded-xl text-[12.5px] font-semibold hover:bg-navy/90 transition shadow-xs cursor-pointer"
              >
                <Receipt size={14} className="text-white" style={{ color: '#ffffff' }} />
                <span className="text-white font-semibold" style={{ color: '#ffffff' }}>Open Payroll Management</span>
                <ArrowRight size={13} className="text-white" style={{ color: '#ffffff' }} />
              </Link>
            </div>
          </div>

          {/* Quick Metrics Bar (4 Metrics) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[11.5px] font-medium text-muted">Configured Departments</div>
                <div className="text-[20px] font-bold text-slate-900 mt-0.5">{departmentsConfig.length} Departments</div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                <Building2 size={18} />
              </div>
            </div>

            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[11.5px] font-medium text-muted">Standard Working Days</div>
                <div className="text-[20px] font-bold text-slate-900 mt-0.5">24 Days / Month</div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
                <Calendar size={18} />
              </div>
            </div>

            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[11.5px] font-medium text-muted">Standard Daily Hours</div>
                <div className="text-[20px] font-bold text-slate-900 mt-0.5">8.0 Hours / Day</div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                <Clock size={18} />
              </div>
            </div>

            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[11.5px] font-medium text-muted">Payroll Attendance Sync</div>
                <div className="text-[13px] font-bold text-emerald-700 flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  Live Reactive Calculations
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                <CheckCircle2 size={18} />
              </div>
            </div>
          </div>

          {/* Department Working Days & Hours Table */}
          <div className="bg-white border border-bdr rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-bdr/60 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
              <div>
                <h3 className="font-bold text-[14px] text-slate-900">Monthly Working Days &amp; Daily Hours by Department</h3>
                <p className="text-[12px] text-muted">
                  Use dropdowns to customize days and daily hours. Pure dropdown selectors without up/down arrows — synced to payroll calculations.
                </p>
              </div>
              <span className="text-[12px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <Check size={12} />
                Auto-Saved to Local Storage
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] lg:min-w-0 text-[13px]">
                <thead className="bg-slate-50/75 border-b border-bdr/60 text-slate-600 font-semibold text-[12px]">
                  <tr>
                    <th className="py-3 px-4 text-left">Department</th>
                    <th className="py-3 px-4 text-left">Department Head</th>
                    <th className="py-3 px-4 text-center">Payroll Staff</th>
                    <th className="py-3 px-4 text-left">Working Days (Dropdown)</th>
                    <th className="py-3 px-4 text-left">Daily Working Hours (Dropdown)</th>
                    <th className="py-3 px-4 text-right">Payroll Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/60">
                  {departmentsConfig.map((dept) => {
                    const currentDays = getDepartmentDays(departmentWorkingDays, dept.name);
                    const currentHours = getDepartmentHours(departmentWorkingHours, dept.name);
                    const staffCount = payrollEmployees.filter(
                      (e) =>
                        e.department?.toLowerCase() === String(dept.name ?? '').toLowerCase() ||
                        (dept.name === "Human Resources" && e.department?.toLowerCase() === "hr") ||
                        (dept.name === "Sales & CRM" && e.department?.toLowerCase().includes("sales")) ||
                        (dept.name === "Warehouse & Inventory" && e.department?.toLowerCase().includes("warehouse"))
                    ).length;

                    return (
                      <tr key={dept.name} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-[12px] border border-blue-100">
                              <Building2 size={15} />
                            </div>
                            <div>
                              <div>{dept.name}</div>
                              <div className="text-[11px] text-muted font-normal">{dept.code}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          <div className="font-medium">{dept.head}</div>
                          <div className="text-[11px] text-muted">{dept.role}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-semibold text-[11.5px] border border-slate-200">
                            {staffCount} Staff
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {/* Pure Dropdown with NO up/down arrows */}
                          <div className="inline-flex items-center gap-2 bg-slate-50 border border-bdr rounded-xl px-2.5 py-1 shadow-2xs">
                            <Calendar size={14} className="text-navy" />
                            <select
                              value={currentDays}
                              onChange={(e) => {
                                const days = Number(e.target.value);
                                setDepartmentWorkingDays(dept.name, days);
                                showToast(`Updated ${dept.name} to ${days} working days. Payroll synced.`);
                              }}
                              className="font-bold text-slate-900 bg-transparent outline-none cursor-pointer text-[13px] py-1"
                            >
                              <option value={20}>20 Days</option>
                              <option value={21}>21 Days</option>
                              <option value={22}>22 Days</option>
                              <option value={23}>23 Days</option>
                              <option value={24}>24 Days (Standard)</option>
                              <option value={25}>25 Days</option>
                              <option value={26}>26 Days</option>
                              <option value={27}>27 Days</option>
                              <option value={28}>28 Days</option>
                              <option value={30}>30 Days</option>
                              <option value={31}>31 Days</option>
                            </select>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {/* Pure Dropdown for Daily Hours */}
                          <div className="inline-flex items-center gap-2 bg-slate-50 border border-bdr rounded-xl px-2.5 py-1 shadow-2xs">
                            <Clock size={14} className="text-emerald-700" />
                            <select
                              value={currentHours}
                              onChange={(e) => {
                                const hrs = Number(e.target.value);
                                setDepartmentWorkingHours(dept.name, hrs);
                                showToast(`Updated ${dept.name} to ${hrs} hours/day. Synced to Payroll.`);
                              }}
                              className="font-bold text-slate-900 bg-transparent outline-none cursor-pointer text-[13px] py-1"
                            >
                              <option value={7}>7.0 Hours/day</option>
                              <option value={7.5}>7.5 Hours/day</option>
                              <option value={8}>8.0 Hours/day (Standard)</option>
                              <option value={8.5}>8.5 Hours/day</option>
                              <option value={9}>9.0 Hours/day</option>
                              <option value={9.5}>9.5 Hours/day</option>
                              <option value={10}>10.0 Hours/day</option>
                            </select>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <Check size={12} /> Active in Payroll
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leave Policy, Carry-Forward & Sandwich-Leave Governance Card */}
          <div className="bg-white border border-bdr rounded-xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bdr/60 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">Leave Policy, Carry-Forward &amp; Sandwich Rule Governance</h3>
                  <p className="text-[12px] text-muted">
                    Configure automated sandwich leave deduction rules and annual leave rollover caps for organizational compliance.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  executeCarryForwardRollover();
                  showToast(`Executed Year-End Rollover: Rolled over up to ${maxCarryForwardDays || 12} days per employee for the new cycle.`);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-[12.5px] font-semibold transition shadow-xs cursor-pointer"
              >
                <Sparkles size={14} />
                <span>Execute Year-End Rollover</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sandwich-Leave Rule Card */}
              <div className="bg-slate-50 border border-bdr rounded-xl p-4 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                      🥪 Sandwich-Leave Policy Rule
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${sandwichRuleEnabled ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-300"}`}>
                      {sandwichRuleEnabled ? "Active Policy" : "Rule Disabled"}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted mt-1 leading-relaxed">
                    When enabled, intervening weekend days and gazetted holidays falling between leave days (e.g. Friday to Monday) are counted and deducted from employee leave balances.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-bdr/60">
                  <span className="text-[12px] font-medium text-slate-700">Policy Mode:</span>
                  <div className="inline-flex items-center gap-2 bg-white border border-bdr rounded-xl px-2.5 py-1 shadow-2xs">
                    <select
                      value={sandwichRuleEnabled ? "enabled" : "disabled"}
                      onChange={(e) => {
                        const val = e.target.value === "enabled";
                        toggleSandwichRule(val);
                        showToast(`Sandwich Rule ${val ? "Enabled" : "Disabled"}. Leave calculations updated.`);
                      }}
                      className="font-bold text-slate-900 bg-transparent outline-none cursor-pointer text-[12.5px] py-0.5"
                    >
                      <option value="enabled">Enabled (Count Intervening Weekends)</option>
                      <option value="disabled">Disabled (Exclude Weekends &amp; Holidays)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Carry-Forward Policy Card */}
              <div className="bg-slate-50 border border-bdr rounded-xl p-4 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                      🔄 Annual Leave Carry-Forward Threshold
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                      Cap: {maxCarryForwardDays || 12} Days
                    </span>
                  </div>
                  <p className="text-[12px] text-muted mt-1 leading-relaxed">
                    Maximum unutilized annual leave days permitted to roll over into the subsequent calendar or financial year cycle. Excess unused balances lapse automatically.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-bdr/60">
                  <span className="text-[12px] font-medium text-slate-700">Max Carry-Forward Cap:</span>
                  <div className="inline-flex items-center gap-2 bg-white border border-bdr rounded-xl px-2.5 py-1 shadow-2xs">
                    <select
                      value={maxCarryForwardDays || 12}
                      onChange={(e) => {
                        const days = Number(e.target.value);
                        setMaxCarryForwardDays(days);
                        showToast(`Updated Carry-Forward cap to ${days} days.`);
                      }}
                      className="font-bold text-slate-900 bg-transparent outline-none cursor-pointer text-[12.5px] py-0.5"
                    >
                      <option value={6}>6 Days Maximum</option>
                      <option value={8}>8 Days Maximum</option>
                      <option value={10}>10 Days Maximum</option>
                      <option value={12}>12 Days Maximum (Standard Policy)</option>
                      <option value={15}>15 Days Maximum</option>
                      <option value={18}>18 Days Maximum (Full Rollover)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Rollover Summary Pill */}
            <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl text-[12px] text-purple-950 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-purple-700 shrink-0" />
                <span>
                  <b>Current Active Rollover Pool:</b>{" "}
                  {Object.entries(carriedForwardLeaves || {}).map(([emp, d]) => `${emp}: ${d}d`).join(", ") || "Ayesha Khan: 6d, Employee: 8d, Liam Cooper: 4d"}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-purple-700 bg-white px-2 py-0.5 rounded-md border border-purple-200">
                Synced with Leave Balance Quotas
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add / Edit Team ── */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-md p-4 sm:p-6 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-bdr">
              <h3 className="font-bold text-[16px] text-slate-900">
                {editingTeam ? `Edit Team (${editingTeam.id})` : "Create New Team"}
              </h3>
              <button
                type="button"
                onClick={() => setIsTeamModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-off grid place-items-center text-muted hover:text-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveTeam} className="flex flex-col gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mobile Engineering Squad"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Department</label>
                  <select
                    value={newTeam.dept}
                    onChange={(e) => setNewTeam({ ...newTeam, dept: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
                  >
                    <option>Engineering</option>
                    <option>HR</option>
                    <option>Finance</option>
                    <option>Design</option>
                    <option>Marketing</option>
                    <option>Operations</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Headcount</label>
                  <input
                    type="number"
                    min="1"
                    value={newTeam.members}
                    onChange={(e) => setNewTeam({ ...newTeam, members: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Team Lead</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Liam Cooper"
                  value={newTeam.lead}
                  onChange={(e) => setNewTeam({ ...newTeam, lead: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Default Approver</label>
                <input
                  type="text"
                  placeholder="e.g. David Park"
                  value={newTeam.approver}
                  onChange={(e) => setNewTeam({ ...newTeam, approver: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div className="flex justify-end gap-2.5 mt-3 pt-3 border-t border-bdr">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer shadow-xs"
                >
                  {editingTeam ? "Save Changes" : "Create Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add / Edit Approval Chain ── */}
      {isChainModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-md p-4 sm:p-6 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-bdr">
              <h3 className="font-bold text-[16px] text-slate-900">
                {editingChain ? `Edit Chain (${editingChain.module})` : "New Approval Chain"}
              </h3>
              <button
                type="button"
                onClick={() => setIsChainModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-off grid place-items-center text-muted hover:text-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveChain} className="flex flex-col gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Target Module</label>
                <select
                  value={newChain.module}
                  onChange={(e) => setNewChain({ ...newChain, module: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
                >
                  <option>Leave Management</option>
                  <option>Attendance Regularization</option>
                  <option>Asset Allocation</option>
                  <option>Payroll Revisions</option>
                  <option>Expense Reimbursement</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Tier 1 Approver</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Line Manager"
                  value={newChain.tier1}
                  onChange={(e) => setNewChain({ ...newChain, tier1: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Tier 2 Approver</label>
                <input
                  type="text"
                  placeholder="e.g. Department Head"
                  value={newChain.tier2}
                  onChange={(e) => setNewChain({ ...newChain, tier2: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Tier 3 (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. HR Director"
                    value={newChain.tier3}
                    onChange={(e) => setNewChain({ ...newChain, tier3: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">SLA Escalation</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={newChain.autoEscalateDays}
                    onChange={(e) => setNewChain({ ...newChain, autoEscalateDays: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2.5 mt-3 pt-3 border-t border-bdr">
                <button
                  type="button"
                  onClick={() => setIsChainModalOpen(false)}
                  className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer shadow-xs"
                >
                  {editingChain ? "Save Workflow" : "Save Chain"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Record Termination ── */}
      {isTerminationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-lg p-4 sm:p-6 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-bdr">
              <div>
                <h3 className="font-bold text-[16px] text-slate-900">Record Employee Termination</h3>
                <p className="text-[11.5px] text-muted">Auto-generates official separation letter upon submission</p>
              </div>
              <button
                type="button"
                onClick={() => setIsTerminationModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-off grid place-items-center text-muted hover:text-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTermination} className="flex flex-col gap-4">
              {/* Quick Select Employee from Directory */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11.5px] font-bold text-slate-700">
                    Select Employee (Auto-fills from Staff Directory)
                  </label>
                  <MasterSourceLink source="employees" />
                </div>
                <select
                  value={newTermination.employeeId || ""}
                  onChange={(e) => {
                    const emp = employees.find((x) => x.id === e.target.value);
                    if (emp) {
                      setNewTermination({
                        ...newTermination,
                        employee: emp.name,
                        employeeId: emp.id,
                        dept: emp.department || newTermination.dept,
                        role: emp.designation || newTermination.role,
                      });
                    }
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-[12.5px] bg-white text-slate-800 focus:outline-none focus:border-navy cursor-pointer"
                >
                  <option value="">-- Choose active staff member (or enter below) --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.id}) — {emp.designation} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Employee Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sameer Dixit"
                    value={newTermination.employee}
                    onChange={(e) => setNewTermination({ ...newTermination, employee: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Employee ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-1099"
                    value={newTermination.employeeId}
                    onChange={(e) => setNewTermination({ ...newTermination, employeeId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Department</label>
                  <select
                    value={newTermination.dept}
                    onChange={(e) => setNewTermination({ ...newTermination, dept: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
                  >
                    <option>Engineering</option>
                    <option>Sales &amp; Marketing</option>
                    <option>Operations</option>
                    <option>HR</option>
                    <option>Finance</option>
                    <option>Design</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Designation / Role</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Staff Architect"
                    value={newTermination.role}
                    onChange={(e) => setNewTermination({ ...newTermination, role: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Termination Type</label>
                  <select
                    value={newTermination.terminationType}
                    onChange={(e) => setNewTermination({ ...newTermination, terminationType: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
                  >
                    <option>Involuntary (Performance)</option>
                    <option>Disciplinary / Breach</option>
                    <option>Redundancy / Restructuring</option>
                    <option>Contract Non-Renewal</option>
                    <option>Probation Failure</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Severance Terms</label>
                  <input
                    type="text"
                    placeholder="e.g. 2 Months Gross"
                    value={newTermination.severance}
                    onChange={(e) => setNewTermination({ ...newTermination, severance: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Notice Served Date</label>
                  <input
                    type="date"
                    value={newTermination.noticeDate}
                    onChange={(e) => setNewTermination({ ...newTermination, noticeDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Exit Date</label>
                  <input
                    type="date"
                    value={newTermination.exitDate}
                    onChange={(e) => setNewTermination({ ...newTermination, exitDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Reason &amp; Legal Context</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Summarize the background, review documents, and justification..."
                  value={newTermination.reason}
                  onChange={(e) => setNewTermination({ ...newTermination, reason: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div className="flex justify-end gap-2.5 mt-3 pt-3 border-t border-bdr">
                <button
                  type="button"
                  onClick={() => setIsTerminationModalOpen(false)}
                  className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-700 text-white rounded-xl text-[13px] font-medium hover:bg-red-800 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileText size={14} />
                  <span>Confirm &amp; Generate Letter</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Submit Resignation ── */}
      {isResignationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-lg p-4 sm:p-6 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-bdr">
              <h3 className="font-bold text-[16px] text-slate-900">Log Voluntary Resignation</h3>
              <button
                type="button"
                onClick={() => setIsResignationModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-off grid place-items-center text-muted hover:text-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateResignation} className="flex flex-col gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11.5px] font-bold text-slate-700">
                    Select Employee (Auto-fills from Staff Directory)
                  </label>
                  <MasterSourceLink source="employees" />
                </div>
                <select
                  value={newResignation.employeeId || ""}
                  onChange={(e) => {
                    const emp = employees.find((x) => x.id === e.target.value);
                    if (emp) {
                      setNewResignation({
                        ...newResignation,
                        employee: emp.name,
                        employeeId: emp.id,
                        dept: emp.department || newResignation.dept,
                        role: emp.designation || newResignation.role,
                      });
                    }
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-[12.5px] bg-white text-slate-800 focus:outline-none focus:border-navy cursor-pointer"
                >
                  <option value="">-- Choose active staff member (or enter below) --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.id}) — {emp.designation} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Employee Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rohan Varma"
                    value={newResignation.employee}
                    onChange={(e) => setNewResignation({ ...newResignation, employee: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Employee ID</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-1044"
                    value={newResignation.employeeId}
                    onChange={(e) => setNewResignation({ ...newResignation, employeeId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Department</label>
                  <select
                    value={newResignation.dept}
                    onChange={(e) => setNewResignation({ ...newResignation, dept: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
                  >
                    <option>Engineering</option>
                    <option>Design</option>
                    <option>HR</option>
                    <option>Finance</option>
                    <option>Marketing</option>
                    <option>Operations</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Role / Designation</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior UI Designer"
                    value={newResignation.role}
                    onChange={(e) => setNewResignation({ ...newResignation, role: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Submission Date</label>
                  <input
                    type="date"
                    value={newResignation.submittedDate}
                    onChange={(e) => setNewResignation({ ...newResignation, submittedDate: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Last Working Day</label>
                  <input
                    type="date"
                    value={newResignation.lastWorkingDay}
                    onChange={(e) => setNewResignation({ ...newResignation, lastWorkingDay: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Notice Period</label>
                  <input
                    type="text"
                    value={newResignation.noticePeriod}
                    onChange={(e) => setNewResignation({ ...newResignation, noticePeriod: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Handover To (Assignee)</label>
                  <input
                    type="text"
                    placeholder="e.g. Marcus Chen"
                    value={newResignation.handoverTo}
                    onChange={(e) => setNewResignation({ ...newResignation, handoverTo: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Reason for Resignation</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Employee reasons, transition plan notes..."
                  value={newResignation.reason}
                  onChange={(e) => setNewResignation({ ...newResignation, reason: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div className="flex justify-end gap-2.5 mt-3 pt-3 border-t border-bdr">
                <button
                  type="button"
                  onClick={() => setIsResignationModalOpen(false)}
                  className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer shadow-xs"
                >
                  Submit Resignation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: File Grievance / Complaint ── */}
      {isComplaintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-lg p-4 sm:p-6 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-bdr">
              <div>
                <h3 className="font-bold text-[16px] text-slate-900">File Grievance / Compliance Ticket</h3>
                <p className="text-[11.5px] text-muted">Confidential intake with assigned legal/HR investigator</p>
              </div>
              <button
                type="button"
                onClick={() => setIsComplaintModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-off grid place-items-center text-muted hover:text-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateComplaint} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Complainant Name</label>
                  <input
                    type="text"
                    placeholder="Leave blank for Anonymous"
                    value={newComplaint.complainant}
                    onChange={(e) => setNewComplaint({ ...newComplaint, complainant: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Against / Target</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Operations Manager"
                    value={newComplaint.against}
                    onChange={(e) => setNewComplaint({ ...newComplaint, against: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Category</label>
                  <select
                    value={newComplaint.category}
                    onChange={(e) => setNewComplaint({ ...newComplaint, category: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
                  >
                    <option>Workplace Harassment / POSH</option>
                    <option>Reimbursement &amp; Payroll Delay</option>
                    <option>Physical Workplace Environment</option>
                    <option>Management / Discrimination</option>
                    <option>Ethics &amp; Compliance Violation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Priority Level</label>
                  <select
                    value={newComplaint.priority}
                    onChange={(e) => setNewComplaint({ ...newComplaint, priority: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12px] font-semibold text-slate-700">Assign Lead Investigator</label>
                  <MasterSourceLink source="employees" />
                </div>
                <select
                  value={newComplaint.assignedInvestigator}
                  onChange={(e) => setNewComplaint({ ...newComplaint, assignedInvestigator: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
                >
                  <option value="Ayesha Khan (HR Director)">Ayesha Khan (HR Director)</option>
                  <option value="Sarah Mitchell (CEO)">Sarah Mitchell (CEO)</option>
                  {employees.map((e) => (
                    <option key={e.id || e.name} value={`${e.name} (${e.designation})`}>
                      {e.name} ({e.designation})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Summary of Grievance</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detailed description of incidents, dates, and impact..."
                  value={newComplaint.summary}
                  onChange={(e) => setNewComplaint({ ...newComplaint, summary: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div className="flex justify-end gap-2.5 mt-3 pt-3 border-t border-bdr">
                <button
                  type="button"
                  onClick={() => setIsComplaintModalOpen(false)}
                  className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-700 text-white rounded-xl text-[13px] font-medium hover:bg-amber-800 cursor-pointer shadow-xs"
                >
                  File Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add / Edit Holiday ── */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-md p-4 sm:p-6 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-bdr">
              <h3 className="font-bold text-[16px] text-slate-900">
                {editingHoliday ? "Edit Holiday" : "Add Holiday to Calendar"}
              </h3>
              <button
                type="button"
                onClick={() => setIsHolidayModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-off grid place-items-center text-muted hover:text-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveHoliday} className="flex flex-col gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Holiday Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eid-ul-Fitr"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Holiday Date</label>
                  <input
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Day of Week</label>
                  <input
                    type="text"
                    placeholder="e.g. Friday"
                    value={newHoliday.day}
                    onChange={(e) => setNewHoliday({ ...newHoliday, day: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Classification</label>
                  <select
                    value={newHoliday.type}
                    onChange={(e) => setNewHoliday({ ...newHoliday, type: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
                  >
                    <option>National Gazetted</option>
                    <option>Regional Holiday</option>
                    <option>Restricted / Optional</option>
                    <option>Company Milestone Day</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Applies To</label>
                  <input
                    type="text"
                    value={newHoliday.appliesTo}
                    onChange={(e) => setNewHoliday({ ...newHoliday, appliesTo: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2.5 mt-3 pt-3 border-t border-bdr">
                <button
                  type="button"
                  onClick={() => setIsHolidayModalOpen(false)}
                  className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer shadow-xs"
                >
                  {editingHoliday ? "Save Holiday" : "Add Holiday"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Termination Letter Live Editor & PDF ── */}
      <TerminationLetterModal
        isOpen={isTerminationLetterModalOpen}
        onClose={() => setIsTerminationLetterModalOpen(false)}
        termination={activeTerminationLetter}
        onUpdateTermination={handleUpdateTermination}
      />

      {/* ── Modal: Offer Letter Live Editor & PDF ── */}
      <OfferLetterModal
        isOpen={isOfferLetterModalOpen}
        onClose={() => setIsOfferLetterModalOpen(false)}
        offer={activeOfferLetter}
        onUpdateOffer={handleUpdateOffer}
      />

      {/* ── Modal: Generate Offer Letter (Connected to Recruits) ── */}
      <GenerateOfferModal
        isOpen={isGenerateOfferModalOpen}
        onClose={() => setIsGenerateOfferModalOpen(false)}
        onSubmit={handleCreateOffer}
      />
    </div>
  );
}
