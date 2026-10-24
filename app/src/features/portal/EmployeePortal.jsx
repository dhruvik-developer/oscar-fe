import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck,
  Calendar,
  Clock,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Clock3,
  XCircle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  LogIn,
  LogOut,
  Loader2,
  FileText,
  Briefcase,
  ChevronRight,
  Eye,
  Plane,
  ShieldCheck,
  Shield,
  FileCheck,
  History,
  Building2,
  Sparkles,
  Tag,
  CalendarDays,
  Layers,
  Info,
  Home,
  Sun,
  Sunset,
  AlertTriangle,
  HelpCircle,
  Send,
  ClipboardList,
  Award,
  TrendingUp,
  ArrowRightLeft,
  UserMinus,
  UploadCloud,
  Download,
  Check,
  PackageCheck,
  PackagePlus,
  Undo2,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAttendanceStore } from '../../stores/attendanceStore';
import { useAssetStore } from '../../stores/assetStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useDocumentFileUrl, downloadDocumentFile } from '../../hooks/useDocumentFile';
import { usePolicyStore } from '../../stores/policyStore';
import { api } from '../../services/api';
import { hrmsSync, isServerId, describeError, pullAvailableAssets, pullMyAssets } from '../../services/hrmsSync';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/hrms/Badge';
import { EarlyPunchOutModal } from '../hrms/attendance/components/EarlyPunchOutModal';
import { usePunchActions } from '../hrms/attendance/usePunchActions';
import {
  fetchEmployeeTransfers,
  fetchEmployeePromotions,
  fetchEmployeeWarnings,
  fetchEmployeeAwards,
} from '../../services/upgradeService';
import { NOTIFICATION_EVENT } from '../../services/crmEventNotifications';

// Career & Milestones (transfers, promotions, warnings, awards) is not in the
// Oscar letter pad scope. Kept for reference, do not delete: set to true (and
// re-enable the routes in oscar-backend/apps/hrms/urls.py) to bring it back.
const CAREER_MILESTONES_ENABLED = false;

const PORTAL_DOC_CATEGORIES = [
  'Identity',
  'Contract',
  'Financial',
  'Compliance',
  'Legal',
  'Educational',
  'General',
];

const todayISO = () => new Date().toISOString().slice(0, 10);

/** `2024-11-01` + `09:30` → the ISO instant for that local wall-clock time. */
const clockToISO = (date, clock) => {
  if (!date || !clock) return undefined;
  const d = new Date(`${date}T${clock}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/** Offered for "Other" asset requests until HR has set up asset categories; new names are created on submit. */
const ASSET_CATEGORY_FALLBACK = ['Laptop', 'Monitor', 'Mobile', 'Tools', 'Safety Equipment', 'Furniture', 'Software'];

/** Shown when the tenant has not configured leave types yet; the server sets them up on first use. */
const DEFAULT_LEAVE_TYPE_NAMES = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Loss of Pay'];

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoStr;
  }
}

export default function EmployeePortal() {
  const currentUser = useAppStore((s) => s.currentUser);
  const showToast = useAppStore((s) => s.showToast || s.setToast);
  const leaves = useAppStore((s) => s.leaves || []);
  const addLeave = useAppStore((s) => s.addLeave);
  const employees = useAppStore((s) => s.employees || []);
  const hydrateHrms = useAppStore((s) => s.hydrateHrms);

  const {
    todayPunch,
    fetchTodayPunch,
    tickPunch,
    submitting: submittingPunch,
    error: punchError,
    doPunchIn,
    doPunchOut,
    executePunchOut,
    earlyModalOpen,
    setEarlyModalOpen,
  } = usePunchActions();

  // Asset Store
  const assetRequests = useAssetStore((s) => s.requests || []);
  const hydrateAssets = useAssetStore((s) => s.hydrate);
  const createAssetRequest = useAssetStore((s) => s.addRequest);
  const withdrawAssetRequest = useAssetStore((s) => s.cancelRequest);
  const refreshAssetRequests = useAssetStore((s) => s.refreshRequests);

  // Attendance Store
  const attendanceRequests = useAttendanceStore((s) => s.requests || []);
  const refreshAttendanceRequests = useAttendanceStore((s) => s.refreshRequests);

  // Policy Store
  const policies = usePolicyStore((s) => s.policies || []);
  const policyCategories = usePolicyStore((s) => s.categories || []);
  const policyAcknowledgements = usePolicyStore((s) => s.acknowledgements || []);
  const acknowledgePolicy = usePolicyStore((s) => s.acknowledgePolicy);

  // Local state
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'POLICIES' | 'LEAVE' | 'HALFDAY' | 'EARLY' | 'REGULARIZATION' | 'WFH' | 'ASSET'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Pending' | 'Approved' | 'Rejected'
  const [searchQuery, setSearchQuery] = useState('');

  // Policy Portal filters & modal states
  const [policyScopeFilter, setPolicyScopeFilter] = useState('DEPARTMENT'); // 'DEPARTMENT' | 'ALL'
  const [policyStatusFilter, setPolicyStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'ARCHIVED'
  const [policyCategoryFilter, setPolicyCategoryFilter] = useState('All');
  const [viewPolicyModal, setViewPolicyModal] = useState(null);
  const [viewHistoricalVersion, setViewHistoricalVersion] = useState(null);

  // Modals for each request type
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isHalfDayModalOpen, setIsHalfDayModalOpen] = useState(false);
  const [isEarlyLeaveModalOpen, setIsEarlyLeaveModalOpen] = useState(false);
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [isWfhModalOpen, setIsWfhModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isGeneralModalOpen, setIsGeneralModalOpen] = useState(false);
  const [viewRequestModal, setViewRequestModal] = useState(null);

  // Form states
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: '',
    leaveTypeName: 'Casual Leave',
    fromDate: todayISO(),
    toDate: todayISO(),
    reason: '',
    delegateId: '',
  });

  const [halfDayForm, setHalfDayForm] = useState({
    date: todayISO(),
    session: 'First Half (09:00 – 13:30)',
    leaveTypeId: '',
    leaveTypeName: 'Casual Leave',
    reason: '',
    delegateId: '',
  });

  const [earlyLeaveForm, setEarlyLeaveForm] = useState({
    date: todayISO(),
    departureTime: '15:00',
    category: 'Doctor / Medical Appointment',
    reason: '',
  });

  const [wfhForm, setWfhForm] = useState({
    date: todayISO(),
    tasks: '',
    reason: '',
  });

  const [generalForm, setGeneralForm] = useState({
    title: '',
    category: 'Workplace Requirement / Facilities',
    urgency: 'Medium',
    date: todayISO(),
    description: '',
  });

  // Asset requests: pick an available unit from inventory, or ask for something not in stock.
  const emptyAssetForm = { requestedAssetId: '', itemName: '', categoryName: '', priority: 'Medium', justification: '' };
  const [assetCategories, setAssetCategories] = useState([]);
  const [assetRequestMode, setAssetRequestMode] = useState('INVENTORY'); // 'INVENTORY' | 'OTHER'
  const [availableAssets, setAvailableAssets] = useState([]);
  const [availableAssetsLoading, setAvailableAssetsLoading] = useState(false);
  const [myAssets, setMyAssets] = useState([]);
  const [assetCategoryCustom, setAssetCategoryCustom] = useState(false);
  const [assetForm, setAssetForm] = useState(emptyAssetForm);

  const [regForm, setRegForm] = useState({
    date: todayISO(),
    type: 'Missed Punch In',
    requestedCheckIn: '09:00',
    requestedCheckOut: '18:30',
    requestedStatus: 'Present',
    reason: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resignation State & Helpers
  const [myResignations, setMyResignations] = useState([]);
  const [isResignationModalOpen, setIsResignationModalOpen] = useState(false);

  const computeLWD = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + Number(days));
    return d.toISOString().slice(0, 10);
  };

  const [resignationForm, setResignationForm] = useState({
    noticePeriodDays: 30,
    noticePeriod: '30 Days',
    lastWorkingDay: computeLWD(30),
    handoverToId: '',
    handoverTo: '',
    category: 'Better Career Opportunity',
    reason: '',
    confirmed: false,
  });

  const fetchMyResignations = () => {
    hrmsSync.pull('resignations').then((rows) => {
      const list = Array.isArray(rows) ? rows : rows?.results || [];
      setMyResignations(list);
    }).catch((err) => console.warn('Failed to fetch resignations:', err));
  };

  const loadAssetCategories = () => {
    hrmsSync.pull('assetCategories').then((rows) => {
      if (Array.isArray(rows)) setAssetCategories(rows);
    }).catch(() => {});
  };

  const loadMyAssets = () => {
    pullMyAssets().then((res) => {
      if (res) setMyAssets(Array.isArray(res) ? res : res?.results || []);
    }).catch(() => {});
  };

  // Re-read available stock on every open, so only units still in inventory are offered.
  const openAssetModal = async () => {
    setAssetForm(emptyAssetForm);
    setAssetRequestMode('INVENTORY');
    setAssetCategoryCustom(false);
    setIsAssetModalOpen(true);
    loadAssetCategories();
    loadMyAssets();
    setAvailableAssetsLoading(true);
    try {
      const res = await pullAvailableAssets();
      setAvailableAssets(Array.isArray(res) ? res : res?.results || []);
    } finally {
      setAvailableAssetsLoading(false);
    }
  };

  // Load Leave Types & Asset Categories & Resignations & Hydrate HRMS Data
  useEffect(() => {
    fetchTodayPunch();
    hydrateAssets?.();
    fetchMyResignations();
    usePolicyStore.getState().hydrate();

    // Hydrate HRMS core data (employees, leaves, attendance, balances)
    hydrateHrms?.(true).catch(() => {});

    // Pull leave types
    hrmsSync.pull('leaveTypes').then((rows) => {
      if (rows && rows.length > 0) {
        setLeaveTypes(rows);
        setLeaveForm((prev) => ({ ...prev, leaveTypeId: rows[0].id, leaveTypeName: rows[0].name }));
        setHalfDayForm((prev) => ({ ...prev, leaveTypeId: rows[0].id, leaveTypeName: rows[0].name }));
      }
    }).catch(() => {});

    // Asset categories (for "Other" requests) and the assets this employee holds
    loadAssetCategories();
    loadMyAssets();
  }, [hydrateHrms]); // Run on initial mount

  // Live timer for active punch
  useEffect(() => {
    if (!todayPunch?.isPunchedIn) return;
    const timer = setInterval(() => tickPunch?.(), 1000);
    return () => clearInterval(timer);
  }, [todayPunch?.isPunchedIn, tickPunch]);

  // Current employee information
  const employeeName = currentUser?.name || currentUser?.fullName || 'Employee';
  const employeeEmail = currentUser?.email || '';
  const currentEmployee = useMemo(() => {
    return employees.find((e) =>
      (currentUser?.employeeId && (e.id === currentUser.employeeId || e.employeeCode === currentUser.employeeId)) ||
      (employeeEmail && e.email?.toLowerCase() === employeeEmail.toLowerCase()) ||
      (employeeName && e.name?.toLowerCase() === employeeName.toLowerCase())
    );
  }, [employees, currentUser, employeeEmail, employeeName]);

  const department = currentEmployee?.department || currentEmployee?.dept || currentUser?.department || 'General';
  const designation = currentEmployee?.designation || currentEmployee?.role || currentUser?.role?.name || 'Staff Member';
  const employeeCode = currentEmployee?.employeeCode || currentEmployee?.empId || currentUser?.employeeCode || 'EMP-SELF';

  // Colleagues for handover
  const colleagues = useMemo(() => {
    return employees.filter((e) => e.id !== currentEmployee?.id);
  }, [employees, currentEmployee]);

  // Employee Lifecycle Records (Promotions, Transfers, Warnings, Awards)
  const [myTransfers, setMyTransfers] = useState([]);
  const [myPromotions, setMyPromotions] = useState([]);
  const [myWarnings, setMyWarnings] = useState([]);
  const [myAwards, setMyAwards] = useState([]);

  // The lifecycle endpoints filter on the employee UUID, so only a linked
  // Employee record can be queried — codes/names (or the 'EMP-SELF'
  // placeholder) are rejected by the backend with a 400.
  const empTarget = CAREER_MILESTONES_ENABLED ? currentEmployee?.id || null : null;

  useEffect(() => {
    if (!empTarget) {
      setMyTransfers([]);
      setMyPromotions([]);
      setMyWarnings([]);
      setMyAwards([]);
      return;
    }

    let cancelled = false;
    const loadCareer = () => {
      Promise.all([
        fetchEmployeeTransfers(empTarget).catch(() => []),
        fetchEmployeePromotions(empTarget).catch(() => []),
        fetchEmployeeWarnings(empTarget).catch(() => []),
        fetchEmployeeAwards(empTarget).catch(() => []),
      ]).then(([t, p, w, a]) => {
        if (cancelled) return;
        setMyTransfers(Array.isArray(t?.data) ? t.data : Array.isArray(t) ? t : []);
        setMyPromotions(Array.isArray(p?.data) ? p.data : Array.isArray(p) ? p : []);
        setMyWarnings(Array.isArray(w?.data) ? w.data : Array.isArray(w) ? w : []);
        setMyAwards(Array.isArray(a?.data) ? a.data : Array.isArray(a) ? a : []);
      });
    };

    loadCareer();
    window.addEventListener(NOTIFICATION_EVENT, loadCareer);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATION_EVENT, loadCareer);
    };
  }, [empTarget]);

  // Map of policyId -> current employee acknowledged record
  const employeeAckMap = useMemo(() => {
    const map = {};
    const myId = currentEmployee?.id || employeeCode;
    const myName = employeeName?.toLowerCase();
    (policyAcknowledgements || [])
      .filter((a) => (
        (a.employeeId && (a.employeeId === myId || a.employeeId === currentEmployee?.id)) ||
        (a.employeeName && a.employeeName.toLowerCase() === myName)
      ) && a.status === 'Acknowledged')
      .forEach((a) => {
        map[a.policyId] = a;
      });
    return map;
  }, [policyAcknowledgements, currentEmployee, employeeCode, employeeName]);

  // Check if a policy belongs or is applicable to this employee's department
  const isDeptRelatedPolicy = (p) => {
    if (!p) return false;
    const deptNorm = (department || '').toLowerCase().trim();
    const ownerNorm = (p.ownerDept || '').toLowerCase().trim();
    const appNorm = (p.applicableTo || '').toLowerCase().trim();

    if (appNorm === 'all employees' || appNorm === 'all' || !appNorm) return true;
    if (deptNorm && deptNorm !== 'general') {
      if (ownerNorm === deptNorm || ownerNorm.includes(deptNorm) || deptNorm.includes(ownerNorm)) return true;
      if (appNorm === deptNorm || appNorm.includes(deptNorm) || deptNorm.includes(appNorm)) return true;
    }
    return false;
  };

  const myDeptPoliciesCount = useMemo(() => {
    return policies.filter((p) => isDeptRelatedPolicy(p)).length;
  }, [policies, department]);

  const filteredPortalPolicies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return policies.filter((p) => {
      // 1. Department/Scope filter
      if (policyScopeFilter === 'DEPARTMENT' && !isDeptRelatedPolicy(p)) {
        return false;
      }

      // 2. Status / version filter (Active vs Old/Archived)
      if (policyStatusFilter === 'ACTIVE' && p.status !== 'Active') return false;
      if (policyStatusFilter === 'ARCHIVED' && p.status !== 'Archived') return false;

      // 3. Category filter
      if (policyCategoryFilter !== 'All' && p.category !== policyCategoryFilter) return false;

      // 4. Search query matching
      if (q) {
        const matchesName = String(p.name || '').toLowerCase().includes(q);
        const matchesCat = String(p.category || '').toLowerCase().includes(q);
        const matchesDept = String(p.ownerDept || '').toLowerCase().includes(q);
        const matchesSummary = String(p.summary || '').toLowerCase().includes(q);
        const matchesVersion = String(p.version || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesDept && !matchesSummary && !matchesVersion) {
          return false;
        }
      }

      return true;
    });
  }, [policies, policyScopeFilter, policyStatusFilter, policyCategoryFilter, searchQuery, department]);

  // Document Submission State & Helpers
  const { documents, addDocument } = useDocumentStore();
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState(null);
  const docPreview = useDocumentFileUrl(previewDocModal);
  const [docCategoryFilter, setDocCategoryFilter] = useState('All');
  const [docUploadForm, setDocUploadForm] = useState({
    title: '',
    category: 'Identity',
    expiry: '',
    description: '',
    fileName: '',
    file: null,
    fileSize: '',
  });

  const getDocAuthCategory = (docOrCat) => {
    const cat = typeof docOrCat === 'string' ? docOrCat : (docOrCat?.category || '');
    const lower = String(cat).trim().toLowerCase();
    if (lower === 'identity') return 'Identity';
    if (lower === 'contract') return 'Contract';
    if (lower === 'financial') return 'Financial';
    if (lower === 'compliance' || lower === 'security') return 'Compliance';
    if (lower === 'legal') return 'Legal';
    if (lower === 'educational' || lower === 'education') return 'Educational';
    if (lower === 'general' || lower === 'policy') return 'General';
    return 'General';
  };

  useEffect(() => {
    useDocumentStore.getState().hydrate();
  }, []);

  const myDocuments = useMemo(() => {
    const empId = currentEmployee?.id;
    const empCode = currentEmployee?.employee_code || currentEmployee?.employeeId || employeeCode;
    const empNameLower = String(employeeName || '').toLowerCase().trim();

    return documents.filter((d) => {
      if (d.employee === 'All Staff' || d.employeeId === 'ALL') return false;
      if (empId && d.employeeId && String(d.employeeId) === String(empId)) return true;
      if (empCode && ((d.employeeCode && String(d.employeeCode) === String(empCode)) || (d.employeeId && String(d.employeeId) === String(empCode)))) return true;
      if (empNameLower && d.employee && String(d.employee).toLowerCase().trim() === empNameLower) return true;
      return false;
    });
  }, [documents, currentEmployee, employeeName, employeeCode]);

  const myDocCategoryCounts = useMemo(() => {
    const counts = { All: myDocuments.length };
    PORTAL_DOC_CATEGORIES.forEach((c) => {
      counts[c] = 0;
    });
    myDocuments.forEach((d) => {
      const cat = getDocAuthCategory(d);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [myDocuments]);

  const filteredMyPortalDocs = useMemo(() => {
    return myDocuments.filter((doc) => {
      const authCat = getDocAuthCategory(doc);
      if (docCategoryFilter !== 'All' && authCat !== docCategoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          String(doc.title || '').toLowerCase().includes(q) ||
          authCat.toLowerCase().includes(q) ||
          String(doc.fileName || '').toLowerCase().includes(q) ||
          String(doc.description || '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [myDocuments, docCategoryFilter, searchQuery]);

  const handlePdfFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showToast?.('Only PDF format documents are allowed.', 'error');
      e.target.value = '';
      return;
    }

    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    if (file.size > 15 * 1024 * 1024) {
      showToast?.('File size exceeds the 15 MB limit.', 'error');
      e.target.value = '';
      return;
    }

    // Keep the File itself: it is uploaded through /files/ on submit.
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    const defaultTitle = cleanName
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    setDocUploadForm((prev) => ({
      ...prev,
      fileName: file.name,
      file,
      fileSize: `${sizeInMb} MB`,
      title: prev.title.trim() ? prev.title : defaultTitle,
    }));
  };

  const handleSubmitDocument = async (e) => {
    e.preventDefault();
    if (!docUploadForm.file) {
      showToast?.('Please select a PDF document from your device.', 'error');
      return;
    }
    if (!docUploadForm.title.trim()) {
      showToast?.('Please specify a title for the document.', 'error');
      return;
    }
    if (!docUploadForm.category) {
      showToast?.('Please select a document category.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (!currentEmployee?.id) {
        showToast?.('Your login is not linked to an employee record. Ask HR to link it.', 'error');
        return;
      }
      await addDocument({
        file: docUploadForm.file,
        title: docUploadForm.title.trim(),
        category: docUploadForm.category,
        expiry: docUploadForm.expiry || null,
        description: docUploadForm.description.trim() || undefined,
        employeeId: currentEmployee.id,
        tags: [docUploadForm.category, 'Employee Upload'],
      });
      showToast?.(`Document "${docUploadForm.title.trim()}" uploaded successfully!`);
      setIsDocModalOpen(false);
      setDocUploadForm({
        title: '',
        category: 'Identity',
        expiry: '',
        description: '',
        fileName: '',
        file: null,
        fileSize: '',
      });
      useDocumentStore.getState().hydrate();
    } catch (err) {
      console.error(err);
      showToast?.(`Failed to upload document: ${err?.message || 'server error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadDoc = async (doc) => {
    try {
      await downloadDocumentFile(doc);
    } catch (err) {
      showToast?.(err?.message || 'Could not download the file', 'error');
    }
  };

  const activeResignation = useMemo(() => {
    return (
      myResignations.find((r) => {
        const st = String(r.status || '').toLowerCase();
        return !['rejected', 'cancelled', 'relieved', 'settled', 'completed'].includes(st);
      }) || null
    );
  }, [myResignations]);

  // Combine all requests into a unified list
  const unifiedRequests = useMemo(() => {
    const list = [];

    // 1. Leave & Half Day Requests
    leaves.forEach((l) => {
      const isMine = !currentEmployee || l.employeeId === currentEmployee.id || l.employee === currentEmployee.name || l.employeeName === employeeName;
      if (isMine || leaves.length <= 10) {
        const isHalf = Number(l.days) === 0.5 || String(l.type || '').toLowerCase().includes('half day') || String(l.reason || '').toLowerCase().includes('half day');
        list.push({
          id: l.id,
          rawId: l.id,
          requestType: isHalf ? 'HALFDAY' : 'LEAVE',
          typeName: l.type || (isHalf ? 'Half Day Leave' : 'Leave Request'),
          date: l.fromDate || l.from || l.date || l.createdAt,
          dateDisplay: l.fromDate && l.toDate && l.fromDate !== l.toDate ? `${formatDate(l.fromDate)} → ${formatDate(l.toDate)}` : formatDate(l.fromDate || l.date),
          days: l.days || (isHalf ? 0.5 : 1),
          reason: l.reason || 'Leave requested',
          status: l.status || 'Pending Review',
          remark: l.remark || '',
          approver: l.approverName || l.approver || 'HR Manager / Reporting Head',
          created_at: l.created_at || l.createdAt || l.fromDate || todayISO(),
          verificationModule: 'HRMS › Leave Approvals (/hrms/leave)',
          raw: l,
        });
      }
    });

    // 2. Asset Requests
    // The server scopes this list (an employee gets only their own), so show every row.
    assetRequests.forEach((a) => {
      const isInventory = a.requestType === 'Inventory';
      const details = [
        isInventory && a.requestedAssetCode ? `Unit ${a.requestedAssetCode}` : '',
        !isInventory && a.category ? a.category : '',
        a.priority ? `${a.priority} priority` : '',
        a.status === 'Fulfilled' && (a.fulfilledAssetCode || a.fulfilledAsset) ? `Issued: ${a.fulfilledAssetCode || a.fulfilledAsset}` : '',
      ].filter(Boolean).join(' • ');
      list.push({
        id: a.id,
        rawId: a.id,
        requestType: 'ASSET',
        typeName: isInventory ? 'Asset: From Inventory' : 'Asset: Other Request',
        itemTitle: a.assetName || a.itemName || 'Asset Request',
        timeDetails: details,
        date: a.createdAt || a.requestedDate,
        dateDisplay: a.createdAt ? formatDate(a.createdAt) : (a.requestedDate || '—'),
        reason: a.justification || a.reason || 'Asset allocation requested',
        // Fulfilled = approved and handed over; keep it in the "approved" bucket.
        status: a.status === 'Fulfilled' ? 'Approved — Asset Issued' : (a.status || 'Pending'),
        priority: a.priority || 'Medium',
        remark: a.remark || '',
        approver: a.approverName || 'HR / IT Admin',
        created_at: a.createdAt || todayISO(),
        verificationModule: 'HRMS › Asset Setup › Employee Requests (/hrms/assets?tab=requests)',
        canWithdraw: a.status === 'Pending',
        raw: a,
      });
    });

    // 3. Attendance Regularizations, Early Leave, Half Day Attendance, WFH
    attendanceRequests.forEach((r) => {
      const isMine = !currentEmployee || r.employeeId === currentEmployee.id || r.employee === employeeName;
      if (isMine || attendanceRequests.length <= 10) {
        const typeStr = String(r.type || '').toLowerCase();
        const reqType =
          typeStr.includes('general') || typeStr.includes('requirement') || typeStr.includes('other') ? 'GENERAL' :
          typeStr.includes('early') ? 'EARLY' :
          typeStr.includes('half') ? 'HALFDAY' :
          typeStr.includes('wfh') || typeStr.includes('home') ? 'WFH' :
          'REGULARIZATION';

        list.push({
          id: r.id,
          rawId: r.id,
          requestType: reqType,
          typeName: r.type || 'Attendance Regularization',
          date: r.date || r.work_date,
          dateDisplay: formatDate(r.date || r.work_date),
          timeDetails: `${r.curIn || r.reqIn || '09:00'} → ${r.curOut || r.reqOut || '18:30'}`,
          reason: r.reason || 'Attendance regularized',
          status: r.status || 'Pending Review',
          remark: r.remark || '',
          approver: r.approver || 'HR Manager / Supervisor',
          created_at: r.created_at || r.submitted || todayISO(),
          verificationModule: 'HRMS › Attendance Requests (/hrms/attendance/requests)',
          raw: r,
        });
      }
    });

    // 4. Resignation Requests
    myResignations.forEach((r) => {
      const isMine =
        !currentEmployee ||
        r.employeeId === currentEmployee.id ||
        r.employeeCode === currentEmployee.employeeCode ||
        r.employee === currentEmployee.name ||
        r.employeeName === employeeName;
      if (isMine || myResignations.length <= 10) {
        list.push({
          id: r.id,
          rawId: r.id,
          requestType: 'RESIGNATION',
          typeName: 'Voluntary Resignation Notice',
          date: r.submittedDate || r.submittedOn || r.created_at,
          dateDisplay: formatDate(r.submittedDate || r.submittedOn || r.created_at),
          timeDetails: `Notice: ${r.noticePeriod || 'Standard'} • LWD: ${formatDate(r.lastWorkingDay)}`,
          reason: r.reason || 'Voluntary resignation notice',
          status: r.status || 'Pending Review',
          remark: r.remark || '',
          approver: r.approver || r.approverName || 'HR Admin / Reporting Head',
          handoverTo: r.handoverTo || 'Pending Assignment',
          lastWorkingDay: r.lastWorkingDay,
          created_at: r.created_at || r.submittedDate || todayISO(),
          verificationModule: 'HRMS › Organization › Resignations (/hrms/organization)',
          raw: r,
        });
      }
    });

    // Sort descending by creation date or date
    return list.sort((a, b) => String(b.created_at || b.date).localeCompare(String(a.created_at || a.date)));
  }, [leaves, assetRequests, attendanceRequests, myResignations, currentEmployee, employeeName]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return unifiedRequests.filter((r) => {
      // Tab filter
      if (activeTab !== 'ALL' && r.requestType !== activeTab) return false;

      // Status filter
      if (statusFilter !== 'ALL') {
        const normStatus = String(r.status || '').toLowerCase();
        const normFilter = statusFilter.toLowerCase();
        if (normFilter === 'pending' && !normStatus.includes('pending')) return false;
        if (normFilter === 'approved' && !normStatus.includes('approved')) return false;
        if (normFilter === 'rejected' && !normStatus.includes('reject')) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          r.typeName?.toLowerCase().includes(q) ||
          r.reason?.toLowerCase().includes(q) ||
          r.itemTitle?.toLowerCase().includes(q) ||
          r.dateDisplay?.toLowerCase().includes(q) ||
          r.status?.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [unifiedRequests, activeTab, statusFilter, searchQuery]);

  // Request stats
  const stats = useMemo(() => {
    const total = unifiedRequests.length;
    const pending = unifiedRequests.filter((r) => String(r.status || '').toLowerCase().includes('pending')).length;
    const approved = unifiedRequests.filter((r) => String(r.status || '').toLowerCase().includes('approved')).length;
    const rejected = unifiedRequests.filter((r) => String(r.status || '').toLowerCase().includes('reject')).length;
    return { total, pending, approved, rejected };
  }, [unifiedRequests]);

  // ── SUBMIT HANDLERS ──

  // The signed-in employee's server id; the API resolves it itself when absent.
  const myEmployeeId = isServerId(currentEmployee?.id) ? currentEmployee.id : undefined;

  // Regularization, early leave, WFH and general requests all land in the
  // attendance-request queue HR verifies at /hrms/attendance/requests.
  const postAttendanceRequest = async ({ date, checkIn, checkOut, status = 'Present', reason }) => {
    const saved = await api.post('/hrms/attendance/regularizations/', {
      employeeId: myEmployeeId,
      date,
      requestedCheckIn: clockToISO(date, checkIn),
      requestedCheckOut: clockToISO(date, checkOut),
      requestedStatus: status,
      reason,
    });
    refreshAttendanceRequests?.().catch(() => {});
    return saved;
  };

  // 1. Submit Full Day Leave
  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.fromDate || !leaveForm.toDate) {
      showToast?.('Please specify both from and to dates.', 'error');
      return;
    }
    if (!leaveForm.reason.trim()) {
      showToast?.('Please specify a reason for your leave request.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const resolvedEmpId = isServerId(currentEmployee?.id) ? currentEmployee.id : (myEmployeeId || undefined);
      const payload = {
        employeeId: resolvedEmpId,
        leaveTypeId: leaveForm.leaveTypeId || undefined,
        leaveTypeName: leaveForm.leaveTypeName,
        type: leaveForm.leaveTypeName,
        fromDate: leaveForm.fromDate,
        toDate: leaveForm.toDate,
        reason: leaveForm.reason.trim(),
        delegateId: leaveForm.delegateId || undefined,
        status: 'Pending Review',
      };

      await addLeave(payload);
      showToast?.('Leave application submitted for HR verification!');
      setIsLeaveModalOpen(false);
      setLeaveForm({
        leaveTypeId: leaveTypes[0]?.id || '',
        leaveTypeName: leaveTypes[0]?.name || 'Casual Leave',
        fromDate: todayISO(),
        toDate: todayISO(),
        reason: '',
        delegateId: '',
      });
    } catch (err) {
      const msg = err?.payload?.message || err?.message || 'Failed to submit leave request';
      showToast?.(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Submit Half Day Request
  const handleSubmitHalfDay = async (e) => {
    e.preventDefault();
    if (!halfDayForm.date) {
      showToast?.('Please select the date for your half-day request.', 'error');
      return;
    }
    if (!halfDayForm.reason.trim()) {
      showToast?.('Please specify a reason for taking a half day.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const sessionLabel = halfDayForm.session.includes('First') ? 'First Half' : 'Second Half';
      const formattedReason = `[Half Day — ${sessionLabel}] ${halfDayForm.reason.trim()}`;

      // Submit to Leave store & API (0.5 day deducted upon HR approval)
      const resolvedEmpId = isServerId(currentEmployee?.id) ? currentEmployee.id : (myEmployeeId || undefined);
      await addLeave({
        employeeId: resolvedEmpId,
        leaveTypeId: halfDayForm.leaveTypeId || undefined,
        leaveTypeName: halfDayForm.leaveTypeName,
        type: `${halfDayForm.leaveTypeName} (Half Day)`,
        fromDate: halfDayForm.date,
        toDate: halfDayForm.date,
        days: 0.5,
        reason: formattedReason,
        delegateId: halfDayForm.delegateId || undefined,
        status: 'Pending Review',
      });

      showToast?.('Half day request submitted for HR verification!');
      setIsHalfDayModalOpen(false);
      setHalfDayForm({
        date: todayISO(),
        session: 'First Half (09:00 – 13:30)',
        leaveTypeId: leaveTypes[0]?.id || '',
        leaveTypeName: leaveTypes[0]?.name || 'Casual Leave',
        reason: '',
        delegateId: '',
      });
    } catch (err) {
      const msg = err?.payload?.message || err?.message || 'Failed to submit half day request';
      showToast?.(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Submit Early Leave / Clock-Out Request
  const handleSubmitEarlyLeave = async (e) => {
    e.preventDefault();
    if (!earlyLeaveForm.date) {
      showToast?.('Please specify the date for early departure.', 'error');
      return;
    }
    if (!earlyLeaveForm.reason.trim()) {
      showToast?.('Please specify why you need to leave early.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const earlyReason = `[Early Leave: ${earlyLeaveForm.category}] Leaving at ${earlyLeaveForm.departureTime}. Reason: ${earlyLeaveForm.reason.trim()}`;

      await postAttendanceRequest({
        date: earlyLeaveForm.date,
        checkIn: '09:00',
        checkOut: earlyLeaveForm.departureTime,
        reason: earlyReason,
      });

      showToast?.('Early leave request submitted for HR verification!');
      setIsEarlyLeaveModalOpen(false);
      setEarlyLeaveForm({
        date: todayISO(),
        departureTime: '15:00',
        category: 'Doctor / Medical Appointment',
        reason: '',
      });
    } catch (err) {
      const msg = err?.payload?.message || err?.message || 'Failed to submit early leave request';
      showToast?.(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Submit Attendance Regularization
  const handleSubmitReg = async (e) => {
    e.preventDefault();
    if (!regForm.date) {
      showToast?.('Please choose the attendance date to regularize.', 'error');
      return;
    }
    if (!regForm.reason.trim()) {
      showToast?.('Please state the reason for attendance regularization.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const fullReason = `[Regularization — ${regForm.type}] ${regForm.reason.trim()}`;

      await postAttendanceRequest({
        date: regForm.date,
        checkIn: regForm.requestedCheckIn,
        checkOut: regForm.requestedCheckOut,
        status: regForm.requestedStatus,
        reason: fullReason,
      });

      showToast?.('Attendance regularization submitted for HR verification!');
      setIsRegModalOpen(false);
      setRegForm({
        date: todayISO(),
        type: 'Missed Punch In',
        requestedCheckIn: '09:00',
        requestedCheckOut: '18:30',
        requestedStatus: 'Present',
        reason: '',
      });
    } catch (err) {
      const msg = err?.payload?.message || err?.message || 'Failed to submit regularization';
      showToast?.(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Submit Work From Home (WFH)
  const handleSubmitWfh = async (e) => {
    e.preventDefault();
    if (!wfhForm.date) {
      showToast?.('Please choose the WFH date.', 'error');
      return;
    }
    if (!wfhForm.tasks.trim()) {
      showToast?.('Please specify tasks to be delivered from home.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const wfhReason = `[Work From Home] Tasks: ${wfhForm.tasks.trim()}${wfhForm.reason ? ` — Note: ${wfhForm.reason.trim()}` : ''}`;

      await postAttendanceRequest({
        date: wfhForm.date,
        checkIn: '09:00',
        checkOut: '18:30',
        status: 'WFH',
        reason: wfhReason,
      });

      showToast?.('Work From Home request submitted for HR verification!');
      setIsWfhModalOpen(false);
      setWfhForm({
        date: todayISO(),
        tasks: '',
        reason: '',
      });
    } catch (err) {
      const msg = err?.payload?.message || err?.message || 'Failed to submit WFH request';
      showToast?.(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Submit Asset Request
  const handleSubmitAsset = async (e) => {
    e?.preventDefault?.();
    const isInventory = assetRequestMode === 'INVENTORY';
    const justification = assetForm.justification.trim();
    const payload = { priority: assetForm.priority };

    if (isInventory) {
      const unit = availableAssets.find((a) => a.id === assetForm.requestedAssetId);
      if (!unit) {
        showToast?.('Please select an available asset from the inventory list.', 'error');
        return;
      }
      payload.requestType = 'Inventory';
      payload.requestedAssetId = unit.id;
    } else {
      const itemName = assetForm.itemName.trim();
      if (!itemName) {
        showToast?.('Please enter the item you need.', 'error');
        return;
      }
      const catName = assetForm.categoryName.trim();
      const known = assetCategories.find((c) => String(c.name || '').toLowerCase() === catName.toLowerCase());
      payload.requestType = 'Other';
      payload.itemName = itemName;
      if (known && isServerId(known.id)) payload.categoryId = known.id;
      else if (catName) payload.categoryName = catName;
    }

    if (!justification) {
      showToast?.('Please explain why you need this asset (justification).', 'error');
      return;
    }
    payload.justification = justification;

    try {
      setIsSubmitting(true);
      await createAssetRequest(payload);
      refreshAssetRequests?.()?.catch?.(() => {});

      showToast?.(
        isInventory
          ? 'Asset request submitted — HR will review and issue the unit to you.'
          : 'Asset request submitted for HR / IT review!'
      );
      setIsAssetModalOpen(false);
      setAssetForm(emptyAssetForm);

      // Take the employee to their request in the list below.
      setSearchQuery('');
      setStatusFilter('ALL');
      setActiveTab('ASSET');
      setTimeout(() => {
        document.getElementById('portal-requests-register')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } catch (err) {
      showToast?.(`Asset request not submitted — ${describeError(err)}`, 'error');
      // The unit may have just been issued to someone else; refresh what is on offer.
      if (isInventory) {
        pullAvailableAssets().then((res) => {
          if (res) setAvailableAssets(Array.isArray(res) ? res : res?.results || []);
        }).catch(() => {});
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // The requester withdraws their own pending asset request.
  const handleWithdrawAssetRequest = async (id) => {
    if (!window.confirm('Withdraw this asset request?')) return;
    try {
      setIsSubmitting(true);
      await withdrawAssetRequest(id);
      showToast?.('Asset request withdrawn.');
      setViewRequestModal(null);
    } catch (err) {
      showToast?.(`Could not withdraw the request — ${describeError(err)}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Available units grouped by category, for the dropdown's option groups.
  const availableAssetGroups = (() => {
    const groups = new Map();
    availableAssets
      .forEach((a) => {
        const key = a.category || 'Uncategorised';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
      });
    return [...groups.entries()].sort(([x], [y]) => x.localeCompare(y));
  })();

  const assetCategoryOptions = assetCategories.length > 0
    ? assetCategories.map((c) => c.name).filter(Boolean)
    : ASSET_CATEGORY_FALLBACK;

  // 7. Submit General Request / Other Reasons & Requirements
  const handleSubmitGeneral = async (e) => {
    e.preventDefault();
    if (!generalForm.title.trim()) {
      showToast?.('Please specify a title or requirement summary.', 'error');
      return;
    }
    if (!generalForm.description.trim()) {
      showToast?.('Please describe your request details or reason.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const formattedReason = `[Requirement: ${generalForm.category}] (${generalForm.urgency} Urgency) ${generalForm.title.trim()} — ${generalForm.description.trim()}`;

      // Lands in the attendance-request queue so HR can query & verify it
      await postAttendanceRequest({
        date: generalForm.date,
        checkIn: '09:00',
        checkOut: '18:30',
        reason: formattedReason,
      });

      showToast?.('Request & Requirement submitted for HR verification!');
      setIsGeneralModalOpen(false);
      setGeneralForm({
        title: '',
        category: 'Workplace Requirement / Facilities',
        urgency: 'Medium',
        date: todayISO(),
        description: '',
      });
    } catch (err) {
      const msg = err?.payload?.message || err?.message || 'Failed to submit request';
      showToast?.(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 8. Submit Voluntary Resignation Notice
  const handleSubmitResignation = async (e) => {
    e?.preventDefault?.();
    if (!resignationForm.reason.trim()) {
      showToast?.('Please specify a detailed reason for resignation.', 'error');
      return;
    }
    if (!resignationForm.confirmed) {
      showToast?.('Please acknowledge the resignation declaration checkbox.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const handoverEmp = colleagues.find((c) => c.id === resignationForm.handoverToId);
      const effectiveLWD = resignationForm.lastWorkingDay || computeLWD(resignationForm.noticePeriodDays);

      const payload = {
        employeeId: currentEmployee?.id || undefined,
        employee: currentEmployee?.name || employeeName,
        submittedDate: todayISO(),
        submittedOn: todayISO(),
        noticePeriod: `${resignationForm.noticePeriodDays} Days`,
        noticePeriodDays: Number(resignationForm.noticePeriodDays),
        lastWorkingDay: effectiveLWD,
        handoverToId: resignationForm.handoverToId || undefined,
        handoverTo: handoverEmp?.name || resignationForm.handoverTo || undefined,
        reason: `${resignationForm.category ? `[${resignationForm.category}] ` : ''}${resignationForm.reason.trim()}`,
      };

      await hrmsSync.create('resignations', payload);
      showToast?.('Voluntary resignation notice submitted successfully. Sent to HR Admin for verification!');
      setIsResignationModalOpen(false);
      setResignationForm({
        noticePeriodDays: 30,
        noticePeriod: '30 Days',
        lastWorkingDay: computeLWD(30),
        handoverToId: '',
        handoverTo: '',
        category: 'Better Career Opportunity',
        reason: '',
        confirmed: false,
      });
      fetchMyResignations();
    } catch (err) {
      const msg = err?.payload?.message || err?.response?.data?.message || err?.message || 'Failed to submit resignation notice';
      showToast?.(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelResignation = async (resigId) => {
    if (!window.confirm('Are you sure you want to withdraw/cancel your voluntary resignation notice?')) return;
    try {
      setIsSubmitting(true);
      await api.post(`/hrms/resignations/${resigId}/cancel/`, { reason: 'Withdrawn by employee' });
      showToast?.('Resignation notice has been withdrawn successfully.', 'success');
      fetchMyResignations();
      setIsResignationModalOpen(false);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to withdraw resignation notice';
      showToast?.(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s.includes('approved')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={12} /> Approved by HR
        </span>
      );
    }
    if (s.includes('notice') || s.includes('clearance') || s.includes('interview')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Clock size={12} /> {status}
        </span>
      );
    }
    if (s.includes('reject') || s.includes('cancel')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle size={12} /> {status || 'Rejected by HR'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock3 size={12} /> Pending HR Review
      </span>
    );
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'LEAVE':
        return <Plane size={15} className="text-indigo-600" />;
      case 'HALFDAY':
        return <Sun size={15} className="text-amber-600" />;
      case 'EARLY':
        return <Sunset size={15} className="text-purple-600" />;
      case 'REGULARIZATION':
        return <Clock size={15} className="text-blue-600" />;
      case 'WFH':
        return <Home size={15} className="text-sky-600" />;
      case 'ASSET':
        return <Laptop size={15} className="text-cyan-600" />;
      case 'GENERAL':
        return <ClipboardList size={15} className="text-emerald-600" />;
      case 'RESIGNATION':
        return <LogOut size={15} className="text-rose-600" />;
      default:
        return <FileText size={15} className="text-slate-600" />;
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-full pb-10">
      {/* Top Welcome & Punch Banner */}
      <div className="bg-white border border-bdr rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/5 via-primary/0 to-transparent rounded-bl-full pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* User Info */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-blue-400 text-white font-black text-2xl flex items-center justify-center shadow-sm shrink-0">
              {employeeName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Welcome, {employeeName}!
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-primary border border-blue-200">
                  Self-Service Portal
                </span>
              </div>
              <p className="text-[13px] text-muted mt-1 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                  <Briefcase size={13} className="text-slate-400" /> {designation}
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                  <Building2 size={13} className="text-slate-400" /> {department}
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                  {employeeCode}
                </span>
                {Number(currentEmployee?.standardSalary || currentEmployee?.salary || currentEmployee?.ctc || 0) > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold">
                      CTC: Rs {Number(currentEmployee?.standardSalary || currentEmployee?.salary || currentEmployee?.ctc).toLocaleString('en-IN')}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Punch Widget */}
          <div className="bg-slate-50 border border-bdr/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  todayPunch?.isPunchedIn
                    ? 'bg-emerald-100 text-emerald-700 animate-pulse'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                <Clock size={20} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-muted">
                  Shift: {todayPunch?.shiftStart || '09:00'} – {todayPunch?.shiftEnd || '18:30'}
                </div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                  <span>{todayPunch?.isPunchedIn ? 'Currently Active' : 'Off Clock'}</span>
                  {todayPunch?.isPunchedIn && (
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {todayPunch?.formattedWorkingTime || '00h 00m'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full sm:w-auto">
              {todayPunch?.isPunchedIn ? (
                <button
                  type="button"
                  onClick={doPunchOut}
                  disabled={submittingPunch}
                  className="w-full sm:w-auto h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                >
                  {submittingPunch ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  Punch Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={doPunchIn}
                  disabled={submittingPunch}
                  className="w-full sm:w-auto h-10 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                >
                  {submittingPunch ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                  {todayPunch?.dayCompleted ? 'Punch In Again' : 'Punch In'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Request Hub — ALL 6 REQUEST TYPES */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Make an Employee Request</h2>
            <p className="text-xs text-muted">
              Submit requests directly for verification and approval by HR & Department Supervisors.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Request Full Day Leave */}
          <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs hover:border-indigo-300 hover:shadow-sm transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Plane size={20} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-[14.5px]">Leave Application</h3>
                <span className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">Full Day</span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Apply for Casual, Sick, Paid / Earned, or Unpaid leaves with colleague handover.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsLeaveModalOpen(true)}
              className="mt-4 w-full h-9 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Apply for Leave
            </button>
          </div>

          {/* 2. Half Day Request */}
          <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs hover:border-amber-300 hover:shadow-sm transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Sun size={20} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-[14.5px]">Half Day Request</h3>
                <span className="text-[10.5px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">0.5 Day</span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Request First Half (Morning) or Second Half (Afternoon) leave verified by HR.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsHalfDayModalOpen(true)}
              className="mt-4 w-full h-9 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Request Half Day
            </button>
          </div>

          {/* 3. Early Leave Request */}
          <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Sunset size={20} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-[14.5px]">Early Leave / Clock-Out</h3>
                <span className="text-[10.5px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">Early Exit</span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Permission to leave before regular shift completion for doctor visit or emergencies.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEarlyLeaveModalOpen(true)}
              className="mt-4 w-full h-9 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Request Early Leave
            </button>
          </div>

          {/* 4. Attendance Regularization */}
          <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Clock size={20} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-[14.5px]">Attendance Regularization</h3>
                <span className="text-[10.5px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">Correction</span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Fix missed biometric punches, machine offline issues, or late arrival timestamps.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsRegModalOpen(true)}
              className="mt-4 w-full h-9 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Regularize Attendance
            </button>
          </div>

          {/* 5. Work From Home (WFH) */}
          <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs hover:border-sky-300 hover:shadow-sm transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Home size={20} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-[14.5px]">Work From Home (WFH)</h3>
                <span className="text-[10.5px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">Remote</span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Request remote working authorization with day's key task deliverables.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsWfhModalOpen(true)}
              className="mt-4 w-full h-9 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Request WFH
            </button>
          </div>

          {/* 6. Request Asset & Hardware */}
          <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs hover:border-cyan-300 hover:shadow-sm transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Laptop size={20} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-[14.5px]">Asset & Equipment Request</h3>
                <span className="text-[10.5px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md">IT / Tools</span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Pick an available unit from company inventory, or raise a request for anything not in stock.
              </p>
              {myAssets.length > 0 && (
                <div className="mt-2.5 p-2 rounded-lg bg-slate-50 border border-bdr">
                  <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">My assets ({myAssets.length})</div>
                  <div className="space-y-0.5 max-h-16 overflow-y-auto">
                    {myAssets.map((a) => (
                      <div key={a.id} className="text-[11px] text-slate-700 truncate" title={`${a.name} (${a.assetCode})`}>
                        <span className="font-mono font-semibold text-slate-500">{a.assetCode}</span> {a.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={openAssetModal}
              className="mt-4 w-full h-9 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Request Asset
            </button>
          </div>

          {/* 7. Other Reasons & General Requirements */}
          <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <ClipboardList size={20} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-[14.5px]">Other Requirement</h3>
                <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">General</span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Special equipment, document requests, facility issues, or work adjustments.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsGeneralModalOpen(true)}
              className="mt-4 w-full h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Make Request
            </button>
          </div>

          {/* 8. Voluntary Resignation Notice */}
          <div className={`bg-white border rounded-2xl p-5 shadow-xs transition-all group flex flex-col justify-between ${
            activeResignation ? 'border-amber-300 ring-1 ring-amber-200 hover:border-amber-400' : 'border-bdr hover:border-rose-300 hover:shadow-sm'
          }`}>
            <div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform ${
                activeResignation ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-rose-50 border border-rose-100 text-rose-600'
              }`}>
                <LogOut size={20} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-[14.5px]">Voluntary Resignation</h3>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${
                  activeResignation
                    ? 'text-amber-800 bg-amber-50 border border-amber-200'
                    : 'text-rose-700 bg-rose-50'
                }`}>
                  {activeResignation ? activeResignation.status : 'Formal Notice'}
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                {activeResignation
                  ? `Notice active: Last working day ${formatDate(activeResignation.lastWorkingDay || activeResignation.lastWorkingDate)}.`
                  : 'Submit formal voluntary resignation notice with handover plan and exit clearance.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsResignationModalOpen(true)}
              className={`mt-4 w-full h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                activeResignation
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
              }`}
            >
              {activeResignation ? <Eye size={14} /> : <Plus size={14} />}
              {activeResignation ? 'View Notice & Handover' : 'Submit Resignation'}
            </button>
          </div>

          {/* 9. Employee Document Upload */}
          <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <UploadCloud size={20} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-[14.5px]">Upload Document</h3>
                <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">PDF Only</span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Submit identity cards, signed agreements, degrees, bank forms, or compliance certificates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsDocModalOpen(true)}
              className="mt-4 w-full h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Upload PDF Document
            </button>
          </div>

          {/* 10. Company Policies & Departmental Governance */}
          <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all group flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <ShieldCheck size={20} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-[14.5px]">Company Policies</h3>
                <span className="text-[10.5px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                  {myDeptPoliciesCount} In Scope
                </span>
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Review official policies for {department}, explore historical versions, and submit required compliance acknowledgements.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('POLICIES')}
              className="mt-4 w-full h-9 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye size={14} /> View Company Policies
            </button>
          </div>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Requests</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{stats.total}</div>
          <p className="text-[11.5px] text-muted mt-1">Submitted requests</p>
        </div>

        <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending HR Review</div>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">{stats.pending}</div>
          <p className="text-[11.5px] text-amber-600 font-medium mt-1">Awaiting verification</p>
        </div>

        <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Approved by HR</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{stats.approved}</div>
          <p className="text-[11.5px] text-emerald-600 font-medium mt-1">Approved & credited</p>
        </div>

        <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Leave Balance</div>
          <div className="text-2xl font-extrabold text-indigo-700 mt-1">
            {currentEmployee?.leaveBalance || '12'} Days
          </div>
          <p className="text-[11.5px] text-indigo-600 font-medium mt-1">Available balance</p>
        </div>
      </div>

      {/* Recognition & Milestone Notification Banner */}
      {CAREER_MILESTONES_ENABLED && (myAwards.length > 0 || myPromotions.length > 0) && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-emerald-500/10 border border-amber-300 dark:border-amber-700/50 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Award size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                {myAwards.length > 0 ? `Honored with: ${myAwards[0].award_name || myAwards[0].title}` : `Promoted: ${myPromotions[0].toDesignationTitle || myPromotions[0].new_designation}`}
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                {myAwards.length > 0
                  ? (myAwards[0].citation || 'Congratulations on your outstanding contribution and achievement!')
                  : `Effective from ${myPromotions[0].effective_date || myPromotions[0].effectiveDate}. Congratulations!`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('CAREER')}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            View Career Milestones ({myTransfers.length + myPromotions.length + myWarnings.length + myAwards.length})
          </button>
        </div>
      )}

      {/* Central Requests History Register */}
      <div id="portal-requests-register" className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden scroll-mt-4">
        {/* Table Header & Controls */}
        <div className="p-5 border-b border-bdr flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {activeTab === 'POLICIES'
                ? 'Company Policies & Departmental Governance'
                : activeTab === 'CAREER'
                ? 'My Career Milestones, Promotions & Notices'
                : activeTab === 'DOCUMENTS'
                ? 'My Personal Documents & Vault Records'
                : 'My Requests & HR Verification Status'}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {activeTab === 'POLICIES'
                ? `Official standards and governance policies applicable to ${department} and all staff, including revision history.`
                : activeTab === 'CAREER'
                ? 'Official record of promotions, department transfers, awards, and formal conduct notices.'
                : activeTab === 'DOCUMENTS'
                ? 'Your uploaded PDF verification documents, certificates, and contracts saved to the HRMS Vault.'
                : 'Live status of your submitted requests. Every request is verified by HR / Reporting Supervisors.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === 'DOCUMENTS' && (
              <button
                type="button"
                onClick={() => setIsDocModalOpen(true)}
                className="btn-primary h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
              >
                <UploadCloud size={14} />
                <span>Upload PDF</span>
              </button>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={activeTab === 'POLICIES' ? 'Search company policies…' : activeTab === 'DOCUMENTS' ? 'Search documents…' : 'Search requests…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 pr-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary w-48 sm:w-56"
              />
            </div>

            {/* Status Filter */}
            {activeTab !== 'CAREER' && activeTab !== 'DOCUMENTS' && activeTab !== 'POLICIES' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="ALL">All HR Statuses</option>
                <option value="Pending">Pending HR Review</option>
                <option value="Approved">Approved by HR</option>
                <option value="Rejected">Rejected by HR</option>
              </select>
            )}
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-bdr bg-slate-50/50 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Requests', count: unifiedRequests.length },
            { id: 'POLICIES', label: 'Company Policies', count: myDeptPoliciesCount },
            { id: 'DOCUMENTS', label: 'My Documents', count: myDocuments.length },
            { id: 'LEAVE', label: 'Leaves', count: unifiedRequests.filter((r) => r.requestType === 'LEAVE').length },
            { id: 'HALFDAY', label: 'Half Day', count: unifiedRequests.filter((r) => r.requestType === 'HALFDAY').length },
            { id: 'EARLY', label: 'Early Leave', count: unifiedRequests.filter((r) => r.requestType === 'EARLY').length },
            { id: 'REGULARIZATION', label: 'Regularization', count: unifiedRequests.filter((r) => r.requestType === 'REGULARIZATION').length },
            { id: 'WFH', label: 'Work From Home', count: unifiedRequests.filter((r) => r.requestType === 'WFH').length },
            { id: 'ASSET', label: 'Assets & IT', count: unifiedRequests.filter((r) => r.requestType === 'ASSET').length },
            { id: 'GENERAL', label: 'Other Requirements', count: unifiedRequests.filter((r) => r.requestType === 'GENERAL').length },
            { id: 'RESIGNATION', label: 'Resignation & Exit', count: unifiedRequests.filter((r) => r.requestType === 'RESIGNATION').length },
            ...(CAREER_MILESTONES_ENABLED
              ? [{ id: 'CAREER', label: 'Career & Milestones', count: myTransfers.length + myPromotions.length + myWarnings.length + myAwards.length }]
              : []),
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`h-9 px-3.5 rounded-t-xl font-bold text-xs flex items-center gap-2 border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary bg-white shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-600'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Requests or Career Table */}
        <div className="overflow-x-auto">
          {CAREER_MILESTONES_ENABLED && activeTab === 'CAREER' ? (
            <div className="p-6 space-y-6">
              {/* Promotions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Career Progression & Role Revisions</h3>
                    <p className="text-[11px] text-muted">Your designation upgrades and revised compensation records</p>
                  </div>
                </div>
                {myPromotions.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">No promotions recorded on file.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Previous Role</th>
                          <th className="py-2.5 px-4">Promoted Role</th>
                          <th className="py-2.5 px-4">Effective Date</th>
                          <th className="py-2.5 px-4 text-right">Revised CTC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myPromotions.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 text-slate-600">{p.fromDesignationTitle || p.previous_designation || '—'}</td>
                            <td className="py-2.5 px-4 font-semibold text-emerald-700">{p.toDesignationTitle || p.new_designation || '—'}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-600">{p.effective_date || p.effectiveDate || '—'}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                              {p.new_salary ? `Rs ${Number(p.new_salary).toLocaleString('en-IN')}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Transfers */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <ArrowRightLeft size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Department & Location Transfers</h3>
                    <p className="text-[11px] text-muted">Movement records across teams, departments, and branch locations</p>
                  </div>
                </div>
                {myTransfers.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">No transfers recorded.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">From Department</th>
                          <th className="py-2.5 px-4">To Department</th>
                          <th className="py-2.5 px-4">Effective Date</th>
                          <th className="py-2.5 px-4">Reason / Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myTransfers.map((t, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 text-slate-600">{t.fromDepartmentName || t.from_department || '—'}</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-800">{t.toDepartmentName || t.to_department || '—'}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-600">{t.effective_date || t.effectiveDate || '—'}</td>
                            <td className="py-2.5 px-4 text-slate-600">{t.reason || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Awards */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Award size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Awards & Spot Recognitions</h3>
                    <p className="text-[11px] text-muted">Excellence citations, performance bonuses, and honors awarded by leadership</p>
                  </div>
                </div>
                {myAwards.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">No awards recorded.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Award Title</th>
                          <th className="py-2.5 px-4">Date Presented</th>
                          <th className="py-2.5 px-4 text-right">Prize Amount</th>
                          <th className="py-2.5 px-4">Citation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myAwards.map((a, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 font-semibold text-amber-800 flex items-center gap-1.5">
                              <Award size={14} className="text-amber-600" /> {a.award_name || a.title || '—'}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-600">{a.award_date || a.presentation_date || '—'}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                              {(a.gift_amount || a.cash_reward) ? `Rs ${Number(a.gift_amount || a.cash_reward).toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">{a.citation || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Warnings */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Official Notices & Conduct Records</h3>
                    <p className="text-[11px] text-muted">Formal HR performance notices and advisories</p>
                  </div>
                </div>
                {myWarnings.length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">No disciplinary warnings on file.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Notice Title</th>
                          <th className="py-2.5 px-4">Severity</th>
                          <th className="py-2.5 px-4">Date Issued</th>
                          <th className="py-2.5 px-4">Details / Explanation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myWarnings.map((w, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 font-semibold text-slate-800">{w.subject || w.title || '—'}</td>
                            <td className="py-2.5 px-4">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                (w.severity || w.warning_level) === 'Severe' || (w.severity || w.warning_level) === 'Final Written' || (w.severity || w.warning_level) === 'Suspension' ? 'bg-rose-100 text-rose-800' :
                                (w.severity || w.warning_level) === 'Medium' || (w.severity || w.warning_level) === 'First Written' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {w.severity || w.warning_level || 'Notice'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-600">{w.issue_date || w.warning_date || '—'}</td>
                            <td className="py-2.5 px-4 text-slate-600">{w.description || w.explanation || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'DOCUMENTS' ? (
            <div className="p-6">
              {/* Category Filter Pills Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-5 pb-4 border-b border-bdr/60">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDocCategoryFilter('All')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                      docCategoryFilter === 'All'
                        ? 'bg-primary text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>All</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      docCategoryFilter === 'All' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {myDocCategoryCounts.All}
                    </span>
                  </button>
                  {PORTAL_DOC_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDocCategoryFilter(cat)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                        docCategoryFilter === cat
                          ? 'bg-primary text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        docCategoryFilter === cat ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {myDocCategoryCounts[cat] || 0}
                      </span>
                    </button>
                  ))}
                </div>

                <span className="text-xs text-muted">
                  Showing <b className="text-slate-800">{filteredMyPortalDocs.length}</b> of {myDocuments.length} document{myDocuments.length === 1 ? '' : 's'}
                </span>
              </div>

              {myDocuments.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-3 font-bold text-xs shadow-xs">
                    PDF
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No personal documents uploaded</h3>
                  <p className="text-xs text-muted mt-1 max-w-md mx-auto">
                    Upload your passport, Aadhaar, degree certificates, employment contract, or financial documents. Once submitted, they will appear here and in the HRMS Documents register.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsDocModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition shadow-xs cursor-pointer"
                  >
                    <UploadCloud size={14} />
                    <span>Upload PDF Document</span>
                  </button>
                </div>
              ) : filteredMyPortalDocs.length === 0 ? (
                <div className="py-12 text-center text-muted">
                  <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No documents found in category "{docCategoryFilter}"</p>
                  <p className="text-xs text-muted mt-1">Try switching to "All" or choosing another category.</p>
                  <button
                    type="button"
                    onClick={() => setDocCategoryFilter('All')}
                    className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    View All Categories
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMyPortalDocs.map((doc) => {
                    const authoritativeCat = getDocAuthCategory(doc);
                    return (
                      <div
                        key={doc.id}
                        className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col justify-between hover:border-slate-300 hover:shadow-sm transition"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border bg-slate-50 text-slate-700 border-slate-200">
                              {authoritativeCat}
                            </span>
                            <Badge tone={doc.status === 'Valid' ? 'success' : doc.status === 'Expired' ? 'danger' : 'warning'}>
                              {doc.status || 'Valid'}
                            </Badge>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1" title={doc.title}>
                            {doc.title}
                          </h4>
                          <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                            {doc.description || 'Personal document recorded under corporate compliance policies.'}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-bdr/60">
                          <div className="flex items-center justify-between text-[11px] text-muted mb-2">
                            <span>Uploaded: <b className="text-slate-700">{doc.uploadDate || doc.updatedOn || todayISO()}</b></span>
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">PDF</span>
                          </div>
                          {doc.fileName && (
                            <div className="text-[11px] font-mono text-slate-500 truncate mb-3" title={doc.fileName}>
                              {doc.fileName}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewDocModal(doc)}
                              className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Eye size={13} />
                              <span>Preview</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadDoc(doc)}
                              className="flex-1 py-1.5 px-3 bg-primary/10 hover:bg-primary/15 text-primary rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Download size={13} />
                              <span>Download</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'POLICIES' ? (
            <div className="p-6">
              {/* Scope & Version Filter Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-bdr/60">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Scope filter: My Department vs All Policies */}
                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPolicyScopeFilter('DEPARTMENT')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                        policyScopeFilter === 'DEPARTMENT'
                          ? 'bg-white text-primary shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Building2 size={13} />
                      <span>My Department ({department})</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        policyScopeFilter === 'DEPARTMENT' ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {myDeptPoliciesCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPolicyScopeFilter('ALL')}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                        policyScopeFilter === 'ALL'
                          ? 'bg-white text-primary shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers size={13} />
                      <span>All Company Policies</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        policyScopeFilter === 'ALL' ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {policies.length}
                      </span>
                    </button>
                  </div>

                  {/* Status / Version filter: All vs Active vs Old/Archived */}
                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPolicyStatusFilter('ALL')}
                      className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                        policyStatusFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Versions
                    </button>
                    <button
                      type="button"
                      onClick={() => setPolicyStatusFilter('ACTIVE')}
                      className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                        policyStatusFilter === 'ACTIVE'
                          ? 'bg-white text-emerald-700 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Active & Enforced
                    </button>
                    <button
                      type="button"
                      onClick={() => setPolicyStatusFilter('ARCHIVED')}
                      className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                        policyStatusFilter === 'ARCHIVED'
                          ? 'bg-white text-slate-800 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Old / Archived Policies
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted">Category:</span>
                  <select
                    value={policyCategoryFilter}
                    onChange={(e) => setPolicyCategoryFilter(e.target.value)}
                    className="h-8 px-2.5 rounded-xl bg-slate-50 border border-bdr text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    {policyCategories.map((c) => (
                      <option key={c.id || c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Policies List or Empty State */}
              {filteredPortalPolicies.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto mb-3 font-bold text-xs shadow-xs">
                    <Shield size={20} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No company policies found</h3>
                  <p className="text-xs text-muted mt-1 max-w-md mx-auto">
                    {searchQuery || policyCategoryFilter !== 'All' || policyStatusFilter !== 'ALL'
                      ? 'No policies match the selected filters. Try clearing search or viewing All Company Policies.'
                      : `No published policies are currently assigned to ${department}. Switch to "All Company Policies" to view organization-wide standards.`}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPortalPolicies.map((p) => {
                    const ackRecord = employeeAckMap[p.id];
                    const isAcked = Boolean(ackRecord);
                    const isDeptMatch = isDeptRelatedPolicy(p);
                    const pastVersionsCount = (p.versionHistory || []).length;

                    return (
                      <div
                        key={p.id}
                        className="bg-white border border-bdr rounded-2xl p-5 shadow-xs hover:border-primary/50 hover:shadow-sm transition-all flex flex-col justify-between group"
                      >
                        <div>
                          {/* Card Header: Category & Status */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center gap-1">
                                <Tag size={11} /> {p.category || 'General'}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-slate-100 text-slate-700">
                                {p.version || 'v1.0'}
                              </span>
                              {isDeptMatch && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                  Your Dept
                                </span>
                              )}
                            </div>

                            <div>
                              {p.status === 'Active' ? (
                                <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
                                  Active
                                </span>
                              ) : p.status === 'Archived' ? (
                                <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-200 text-slate-700">
                                  Archived
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-100 text-amber-800">
                                  {p.status}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors">
                            {p.name}
                          </h3>

                          {/* Scope / Dept metadata */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted mt-1.5">
                            <span className="flex items-center gap-1">
                              <Building2 size={12} className="text-slate-400" />
                              <b>Dept:</b> {p.ownerDept || 'General'}
                            </span>
                            <span>•</span>
                            <span>
                              <b>Applicable:</b> {p.applicableTo || 'All Employees'}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar size={12} className="text-slate-400" />
                              <b>Effective:</b> {formatDate(p.effectiveDate)}
                            </span>
                          </div>

                          {/* Summary */}
                          <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">
                            {p.summary || p.content || 'Standard enterprise policy guidelines and corporate compliance requirements.'}
                          </p>
                        </div>

                        {/* Card Footer: Acknowledgement & Action */}
                        <div className="mt-4 pt-3.5 border-t border-bdr flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs">
                            {p.ackRequired ? (
                              isAcked ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[11.5px] border border-emerald-200">
                                  <CheckCircle2 size={13} />
                                  <span>Acknowledged</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold text-[11.5px] border border-amber-200">
                                  <AlertCircle size={13} />
                                  <span>Pending Acknowledgment</span>
                                </span>
                              )
                            ) : (
                              <span className="text-[11px] text-muted font-medium">Standard Compliance</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {p.ackRequired && !isAcked && (
                              <button
                                type="button"
                                onClick={() => {
                                  acknowledgePolicy(p.id, employeeName, currentEmployee?.id || employeeCode, department);
                                  showToast?.(`Acknowledged policy "${p.name}"`);
                                }}
                                className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                              >
                                <Check size={13} /> Acknowledge
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setViewPolicyModal(p);
                                setViewHistoricalVersion(null);
                              }}
                              className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <Eye size={13} />
                              <span>View & History {pastVersionsCount > 1 ? `(${pastVersionsCount})` : ''}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <FileText size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No requests found</h3>
              <p className="text-xs text-muted mt-1">
                {searchQuery || statusFilter !== 'ALL' || activeTab !== 'ALL'
                  ? 'Try clearing your search or status filter.'
                  : 'Submit a new request above to see it recorded here for HR review.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-bdr text-[11px] uppercase tracking-wider text-muted font-bold">
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-4">Subject & Details</th>
                  <th className="py-3 px-4">Date / Timing</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">HR Verification</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/60">
                {filteredRequests.map((req) => (
                  <tr key={`${req.requestType}-${req.id}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          {getTypeIcon(req.requestType)}
                        </span>
                        <span>{req.typeName}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{req.itemTitle || req.typeName}</div>
                      {req.timeDetails && <div className="text-[11px] text-muted mt-0.5">{req.timeDetails}</div>}
                    </td>

                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {req.dateDisplay}
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-muted truncate text-[11.5px]" title={req.reason}>
                        {req.reason}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      {getStatusBadge(req.status)}
                    </td>

                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {req.requestType === 'ASSET' && req.canWithdraw && (
                          <button
                            type="button"
                            onClick={() => handleWithdrawAssetRequest(req.rawId)}
                            disabled={isSubmitting}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                          >
                            <Undo2 size={12} /> Withdraw
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setViewRequestModal(req)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye size={12} /> View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── MODAL 1: Request Leave (Full Day) ── */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title="Apply for Leave"
        subtitle="Submit a full day leave application for HR verification."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setIsLeaveModalOpen(false)}
              className="btn-outline h-9 px-4 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitLeave}
              disabled={isSubmitting}
              className="btn-primary h-9 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plane size={14} />}
              Submit Leave Application
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmitLeave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Leave Type</label>
            <select
              value={leaveForm.leaveTypeId || leaveForm.leaveTypeName}
              onChange={(e) => {
                const selected = leaveTypes.find((lt) => lt.id === e.target.value);
                setLeaveForm({
                  ...leaveForm,
                  leaveTypeId: selected?.id || '',
                  leaveTypeName: selected?.name || e.target.value,
                });
              }}
              className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
            >
              {leaveTypes.length > 0 ? (
                leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} (Max {lt.annual_entitlement || lt.annualEntitlement || 12} days/yr)
                  </option>
                ))
              ) : (
                DEFAULT_LEAVE_TYPE_NAMES.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">From Date</label>
              <input
                type="date"
                value={leaveForm.fromDate}
                onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">To Date</label>
              <input
                type="date"
                value={leaveForm.toDate}
                onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Handover Colleague (Optional)</label>
            <select
              value={leaveForm.delegateId}
              onChange={(e) => setLeaveForm({ ...leaveForm, delegateId: e.target.value })}
              className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
            >
              <option value="">Select a colleague covering your tasks</option>
              {colleagues.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name} ({col.department || col.dept || 'Staff'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Reason for Leave *</label>
            <textarea
              rows={3}
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              placeholder="e.g. Attending a family function, medical treatment, or personal travel..."
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary resize-none"
              required
            />
          </div>
        </form>
      </Modal>

      {/* ── MODAL 2: Request Half Day ── */}
      <Modal
        isOpen={isHalfDayModalOpen}
        onClose={() => setIsHalfDayModalOpen(false)}
        title="Request Half Day"
        subtitle="Apply for a 0.5 day leave session verified by HR."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setIsHalfDayModalOpen(false)}
              className="btn-outline h-9 px-4 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitHalfDay}
              disabled={isSubmitting}
              className="btn-primary h-9 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Sun size={14} />}
              Submit Half Day Request
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmitHalfDay} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Half Day Date</label>
              <input
                type="date"
                value={halfDayForm.date}
                onChange={(e) => setHalfDayForm({ ...halfDayForm, date: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Session Timing</label>
              <select
                value={halfDayForm.session}
                onChange={(e) => setHalfDayForm({ ...halfDayForm, session: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
              >
                <option value="First Half (09:00 – 13:30)">First Half (Morning 09:00 – 13:30)</option>
                <option value="Second Half (13:30 – 18:30)">Second Half (Afternoon 13:30 – 18:30)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Leave Category</label>
            <select
              value={halfDayForm.leaveTypeId || halfDayForm.leaveTypeName}
              onChange={(e) => {
                const selected = leaveTypes.find((lt) => lt.id === e.target.value);
                setHalfDayForm({
                  ...halfDayForm,
                  leaveTypeId: selected?.id || '',
                  leaveTypeName: selected?.name || e.target.value,
                });
              }}
              className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
            >
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} (0.5 Day deduction)
                </option>
              ))}
              {leaveTypes.length === 0 && DEFAULT_LEAVE_TYPE_NAMES.map((name) => (
                <option key={name} value={name}>{name} (0.5 Day)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Work Handover Colleague (Optional)</label>
            <select
              value={halfDayForm.delegateId}
              onChange={(e) => setHalfDayForm({ ...halfDayForm, delegateId: e.target.value })}
              className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
            >
              <option value="">Select a colleague</option>
              {colleagues.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name} ({col.department || col.dept || 'Staff'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Reason for Half Day *</label>
            <textarea
              rows={3}
              value={halfDayForm.reason}
              onChange={(e) => setHalfDayForm({ ...halfDayForm, reason: e.target.value })}
              placeholder="e.g. Doctor appointment in morning, or urgent personal work in afternoon..."
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary resize-none"
              required
            />
          </div>
        </form>
      </Modal>

      {/* ── MODAL 3: Request Early Leave / Clock-Out ── */}
      <Modal
        isOpen={isEarlyLeaveModalOpen}
        onClose={() => setIsEarlyLeaveModalOpen(false)}
        title="Request Early Leave / Clock-Out"
        subtitle="Obtain HR permission to leave work before normal shift completion."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setIsEarlyLeaveModalOpen(false)}
              className="btn-outline h-9 px-4 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitEarlyLeave}
              disabled={isSubmitting}
              className="btn-primary h-9 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Sunset size={14} />}
              Submit Early Leave Request
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmitEarlyLeave} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={earlyLeaveForm.date}
                onChange={(e) => setEarlyLeaveForm({ ...earlyLeaveForm, date: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Requested Departure Time</label>
              <input
                type="time"
                value={earlyLeaveForm.departureTime}
                onChange={(e) => setEarlyLeaveForm({ ...earlyLeaveForm, departureTime: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Early Departure Reason Category</label>
            <select
              value={earlyLeaveForm.category}
              onChange={(e) => setEarlyLeaveForm({ ...earlyLeaveForm, category: e.target.value })}
              className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
            >
              <option value="Doctor / Medical Appointment">Doctor / Medical Appointment</option>
              <option value="Personal Emergency">Personal Emergency / Health issue</option>
              <option value="Family Obligation">Family Obligation / Event</option>
              <option value="Official Client Site Visit">Official Client Site Visit</option>
              <option value="Government / Bank Work">Official Government / Bank Work</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Detailed Reason *</label>
            <textarea
              rows={3}
              value={earlyLeaveForm.reason}
              onChange={(e) => setEarlyLeaveForm({ ...earlyLeaveForm, reason: e.target.value })}
              placeholder="Provide context for HR verification (e.g. Doctor appointment scheduled at 3:30 PM)..."
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary resize-none"
              required
            />
          </div>

          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-[11px] text-purple-800 leading-normal">
            <strong>HR Policy Notice:</strong> Once HR approves your early departure, attendance is processed without penalty deductions in monthly payroll.
          </div>
        </form>
      </Modal>

      {/* ── MODAL 4: Attendance Regularization ── */}
      <Modal
        isOpen={isRegModalOpen}
        onClose={() => setIsRegModalOpen(false)}
        title="Attendance Regularization"
        subtitle="Correct missed punches or scanner issues so full attendance is credited."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setIsRegModalOpen(false)}
              className="btn-outline h-9 px-4 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitReg}
              disabled={isSubmitting}
              className="btn-primary h-9 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
              Submit Regularization
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmitReg} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Date of Attendance</label>
              <input
                type="date"
                value={regForm.date}
                onChange={(e) => setRegForm({ ...regForm, date: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Correction Type</label>
              <select
                value={regForm.type}
                onChange={(e) => setRegForm({ ...regForm, type: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
              >
                <option value="Missed Punch In">Missed Punch In (Check-in time)</option>
                <option value="Missed Punch Out">Missed Punch Out (Check-out time)</option>
                <option value="Biometric Scanner Glitch">Biometric Device Glitch / Offline</option>
                <option value="Late Clock-In Correction">Late Clock-In Regularization</option>
                <option value="Client Site Visit">Client Site Visit / Field Work</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Correct Check-In Time</label>
              <input
                type="time"
                value={regForm.requestedCheckIn}
                onChange={(e) => setRegForm({ ...regForm, requestedCheckIn: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Correct Check-Out Time</label>
              <input
                type="time"
                value={regForm.requestedCheckOut}
                onChange={(e) => setRegForm({ ...regForm, requestedCheckOut: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Reason for Regularization *</label>
            <textarea
              rows={3}
              value={regForm.reason}
              onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
              placeholder="e.g. Biometric scanner failed to recognize fingerprint, arrived at 09:00 AM..."
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary resize-none"
              required
            />
          </div>
        </form>
      </Modal>

      {/* ── MODAL 5: Work From Home (WFH) ── */}
      <Modal
        isOpen={isWfhModalOpen}
        onClose={() => setIsWfhModalOpen(false)}
        title="Request Work From Home (WFH)"
        subtitle="Submit remote working authorization for HR review."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setIsWfhModalOpen(false)}
              className="btn-outline h-9 px-4 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitWfh}
              disabled={isSubmitting}
              className="btn-primary h-9 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Home size={14} />}
              Submit WFH Request
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmitWfh} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">WFH Date</label>
            <input
              type="date"
              value={wfhForm.date}
              onChange={(e) => setWfhForm({ ...wfhForm, date: e.target.value })}
              className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Planned Deliverables / Tasks *</label>
            <textarea
              rows={2}
              value={wfhForm.tasks}
              onChange={(e) => setWfhForm({ ...wfhForm, tasks: e.target.value })}
              placeholder="List specific tasks you plan to complete remotely today..."
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary resize-none"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Reason (Optional)</label>
            <input
              type="text"
              value={wfhForm.reason}
              onChange={(e) => setWfhForm({ ...wfhForm, reason: e.target.value })}
              placeholder="e.g. Mild illness, severe commute traffic, home maintenance..."
              className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
            />
          </div>
        </form>
      </Modal>

      {/* ── MODAL 6: Request Asset & Equipment ── */}
      <Modal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        title="Request Asset & Equipment"
        subtitle="Request an available unit from company inventory, or ask HR / IT for something not in stock."
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setIsAssetModalOpen(false)}
              className="btn-outline h-9 px-4 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitAsset}
              disabled={isSubmitting || (assetRequestMode === 'INVENTORY' && !assetForm.requestedAssetId)}
              className="btn-primary h-9 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Laptop size={14} />}
              Submit Asset Request
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmitAsset} className="space-y-4 text-xs">
          {/* Request mode */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 border border-bdr">
            {[
              { id: 'INVENTORY', label: 'From Inventory', hint: 'Available stock', icon: <PackageCheck size={14} /> },
              { id: 'OTHER', label: 'Other Asset Request', hint: 'Not in inventory', icon: <PackagePlus size={14} /> },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setAssetRequestMode(m.id)}
                className={`h-11 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  assetRequestMode === m.id ? 'bg-white text-primary shadow-2xs border border-bdr' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-1.5 font-bold text-xs">{m.icon}{m.label}</span>
                <span className="text-[10px] text-muted font-medium">{m.hint}</span>
              </button>
            ))}
          </div>

          {myAssets.length > 0 && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-bdr">
              <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Assets currently with you</div>
              <div className="flex flex-wrap gap-1.5">
                {myAssets.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-bdr text-[11px] text-slate-700">
                    <span className="font-mono font-semibold text-slate-500">{a.assetCode}</span> {a.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {assetRequestMode === 'INVENTORY' ? (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block font-bold text-slate-700">Select an Available Asset *</label>
                <span className="text-[10.5px] text-muted">{availableAssets.length} in stock</span>
              </div>
              {availableAssetsLoading ? (
                <div className="h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs text-muted flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Loading available inventory…
                </div>
              ) : availableAssets.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    No assets are available in inventory right now.{' '}
                    <button
                      type="button"
                      onClick={() => setAssetRequestMode('OTHER')}
                      className="font-bold underline cursor-pointer"
                    >
                      Raise an Other Asset Request
                    </button>{' '}
                    instead.
                  </div>
                </div>
              ) : (
                <>
                  <select
                    value={assetForm.requestedAssetId}
                    onChange={(e) => setAssetForm({ ...assetForm, requestedAssetId: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">Select an asset…</option>
                    {availableAssetGroups.map(([cat, units]) => (
                      <optgroup key={cat} label={`${cat} (${units.length})`}>
                        {units.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} — {a.assetCode}{a.condition ? ` (${a.condition})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {(() => {
                    const unit = availableAssets.find((a) => a.id === assetForm.requestedAssetId);
                    if (!unit) return null;
                    return (
                      <div className="mt-2 p-2.5 rounded-xl border border-primary/30 bg-primary/5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] text-muted">
                        <CheckCircle2 size={13} className="text-primary shrink-0" />
                        <span className="font-bold text-slate-900 text-xs">{unit.name}</span>
                        <span>•</span>
                        <span className="font-mono font-semibold text-slate-600">{unit.assetCode}</span>
                        <span>•</span>
                        <span>{unit.category || 'Uncategorised'}</span>
                        <span>•</span>
                        <span className={unit.condition === 'Excellent' ? 'text-emerald-700' : unit.condition === 'Needs Repair' ? 'text-amber-700' : ''}>
                          {unit.condition || 'Good'}
                        </span>
                        {unit.serialNumber && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{unit.serialNumber}</span>
                          </>
                        )}
                        {unit.location && (
                          <>
                            <span>•</span>
                            <span>{unit.location}</span>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Item Needed *</label>
                <input
                  type="text"
                  placeholder="e.g. Dell Latitude 16GB RAM or Welding Helmet"
                  value={assetForm.itemName}
                  onChange={(e) => setAssetForm({ ...assetForm, itemName: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
                {assetCategoryCustom ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Type a new category"
                      value={assetForm.categoryName}
                      onChange={(e) => setAssetForm({ ...assetForm, categoryName: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAssetCategoryCustom(false);
                        setAssetForm({ ...assetForm, categoryName: '' });
                      }}
                      className="h-9 px-2.5 rounded-xl border border-bdr text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
                    >
                      List
                    </button>
                  </div>
                ) : (
                  <select
                    value={assetForm.categoryName}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setAssetCategoryCustom(true);
                        setAssetForm({ ...assetForm, categoryName: '' });
                      } else {
                        setAssetForm({ ...assetForm, categoryName: e.target.value });
                      }
                    }}
                    className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                  >
                    <option value="">Select category (optional)</option>
                    {assetCategoryOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="__new__">+ Other (type a new category)</option>
                  </select>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Priority / Urgency</label>
            <select
              value={assetForm.priority}
              onChange={(e) => setAssetForm({ ...assetForm, priority: e.target.value })}
              className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
            >
              <option value="Low">Low — Next scheduled hardware allocation cycle</option>
              <option value="Medium">Medium — Standard work requirement</option>
              <option value="High">High — Client deliverable blocked without this</option>
              <option value="Urgent">Urgent — Immediate hardware replacement</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Business Justification *</label>
            <textarea
              rows={3}
              value={assetForm.justification}
              onChange={(e) => setAssetForm({ ...assetForm, justification: e.target.value })}
              placeholder="Explain why this equipment is needed for your work..."
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary resize-none"
              required
            />
          </div>
        </form>
      </Modal>

      {/* ── MODAL: Other Reason / Requirement Request (Received by HR) ── */}
      <Modal
        isOpen={isGeneralModalOpen}
        onClose={() => setIsGeneralModalOpen(false)}
        title="Other Request & Requirement"
        subtitle="Submit any special request, workplace requirement, or other need for HR review & verification."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setIsGeneralModalOpen(false)}
              className="btn-outline h-9 px-4 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitGeneral}
              disabled={isSubmitting}
              className="btn-primary h-9 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit to HR
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmitGeneral} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Request Category / Nature *</label>
            <select
              value={generalForm.category}
              onChange={(e) => setGeneralForm({ ...generalForm, category: e.target.value })}
              className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
            >
              <option value="Workplace Requirement / Facilities">Workplace Requirement / Facilities & Seating</option>
              <option value="Stationery & Office Supplies">Stationery & Office Consumables</option>
              <option value="HR Document / Experience / NOC">HR Document Request (Experience Letter / Bonafide / NOC)</option>
              <option value="Policy / Shift Flexibility Requirement">Special Timing / Shift Flexibility</option>
              {/* <option value="Training & Upskilling Requirement">Training / Course Material Requirement</option> */}
              <option value="Health, Safety & Ergonomic Support">Health, Safety & Ergonomic Support</option>
              <option value="Other Workplace Reason">Other Specific Workplace Reason</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Subject / Requirement Summary *</label>
            <input
              type="text"
              placeholder="e.g. Ergonomic chair request or NOC letter for passport verification"
              value={generalForm.title}
              onChange={(e) => setGeneralForm({ ...generalForm, title: e.target.value })}
              className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Target Date</label>
              <input
                type="date"
                value={generalForm.date}
                onChange={(e) => setGeneralForm({ ...generalForm, date: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Priority / Urgency</label>
              <select
                value={generalForm.urgency}
                onChange={(e) => setGeneralForm({ ...generalForm, urgency: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
              >
                <option value="Low">Low — Can be fulfilled anytime</option>
                <option value="Medium">Medium — Standard priority</option>
                <option value="High">High — Needed soon</option>
                <option value="Urgent">Urgent — Immediate requirement</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Detailed Explanation & Requirement Details *</label>
            <textarea
              rows={4}
              value={generalForm.description}
              onChange={(e) => setGeneralForm({ ...generalForm, description: e.target.value })}
              placeholder="Provide complete details, exact requirement specifications, or explanation so HR can verify and take prompt action..."
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary resize-none"
              required
            />
          </div>

          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 leading-normal flex items-start gap-2">
            <ClipboardList size={14} className="shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <strong>HR Verification Workflow:</strong> This request is routed straight to the HR team. You can monitor verification status (Pending, Approved, or Rejected with remarks) directly in your portal tracker below.
            </div>
          </div>
        </form>
      </Modal>

      {/* ── MODAL 7: View Detailed Request & HR Verification Remarks ── */}
      {viewRequestModal && (
        <Modal
          isOpen={Boolean(viewRequestModal)}
          onClose={() => setViewRequestModal(null)}
          title={`${viewRequestModal.typeName}`}
          subtitle={`Submitted on ${formatDate(viewRequestModal.created_at)}`}
          size="md"
          footer={
            <div className="flex justify-end gap-2.5 w-full">
              {viewRequestModal.requestType === 'ASSET' && viewRequestModal.canWithdraw && (
                <button
                  type="button"
                  onClick={() => handleWithdrawAssetRequest(viewRequestModal.rawId)}
                  disabled={isSubmitting}
                  className="h-9 px-4 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                  Withdraw Request
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewRequestModal(null)}
                className="btn-outline h-9 px-4 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-bdr">
              <span className="font-bold text-slate-700">HR Verification Status:</span>
              <span>{getStatusBadge(viewRequestModal.status)}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-bdr space-y-2">
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px]">Date / Period:</span>
                <p className="font-semibold text-slate-800 mt-0.5">{viewRequestModal.dateDisplay}</p>
              </div>
              {viewRequestModal.timeDetails && (
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Working Hours / Timing:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{viewRequestModal.timeDetails}</p>
                </div>
              )}
              {viewRequestModal.priority && (
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Priority:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{viewRequestModal.priority}</p>
                </div>
              )}
              {viewRequestModal.handoverTo && (
                <div>
                  <span className="font-bold text-slate-500 uppercase text-[10px]">Handover Assignee:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{viewRequestModal.handoverTo}</p>
                </div>
              )}
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px]">Verification Authority:</span>
                <p className="font-semibold text-slate-800 mt-0.5">{viewRequestModal.approver}</p>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase text-[10px]">HR Review Queue:</span>
                <p className="font-mono text-slate-600 mt-0.5 text-[11px]">{viewRequestModal.verificationModule}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-bdr">
              <span className="font-bold text-slate-500 uppercase text-[10px]">Reason & Justification:</span>
              <p className="font-medium text-slate-800 mt-1 leading-relaxed whitespace-pre-wrap">
                {viewRequestModal.reason}
              </p>
            </div>

            {viewRequestModal.remark && (
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                <span className="font-bold text-blue-800 uppercase text-[10px]">HR Reviewer Remarks:</span>
                <p className="font-medium text-blue-900 mt-0.5">{viewRequestModal.remark}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── MODAL 8: Voluntary Resignation Notice ── */}
      <Modal
        isOpen={isResignationModalOpen}
        onClose={() => setIsResignationModalOpen(false)}
        title={activeResignation ? 'Voluntary Resignation Notice & Clearance Status' : 'Submit Voluntary Resignation Notice'}
        subtitle={
          activeResignation
            ? 'Track your resignation review, notice period, handover assignee, and exit clearance.'
            : 'Initiates official notice period, handover assignment, and HR Admin clearance workflow.'
        }
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {activeResignation && ['pending', 'pending review'].includes(String(activeResignation.status || '').toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => handleCancelResignation(activeResignation.id)}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 font-semibold text-xs transition cursor-pointer"
                >
                  Withdraw Resignation Notice
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsResignationModalOpen(false)}
                className="btn-outline h-9 px-4 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {activeResignation ? 'Close' : 'Cancel'}
              </button>
              {!activeResignation && (
                <button
                  type="button"
                  onClick={handleSubmitResignation}
                  disabled={isSubmitting || !resignationForm.reason.trim() || !resignationForm.confirmed}
                  className="btn-primary h-9 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  Submit Resignation Notice
                </button>
              )}
            </div>
          </div>
        }
      >
        {activeResignation ? (
          <div className="space-y-4 text-xs">
            {/* Active Resignation Notice Banner */}
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <LogOut size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-bold text-amber-950 text-sm">Resignation Notice Active</h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    {activeResignation.status || 'Pending Review'}
                  </span>
                </div>
                <p className="text-amber-800 text-xs mt-1 leading-relaxed">
                  Your resignation notice was registered on{' '}
                  <span className="font-bold">{formatDate(activeResignation.submittedDate || activeResignation.submittedOn)}</span>.
                  Your notice period is <span className="font-bold">{activeResignation.noticePeriod || 'Standard'}</span> with an
                  effective last working day of{' '}
                  <span className="font-bold">{formatDate(activeResignation.lastWorkingDay)}</span>.
                </p>
              </div>
            </div>

            {/* Key Parameters Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-bdr">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Handover Colleague (Assignee)</span>
                <p className="font-bold text-slate-900 text-sm mt-1">{activeResignation.handoverTo || 'Pending Assignment'}</p>
                <p className="text-[11px] text-muted mt-0.5">Knowledge transfer & project transition assignee</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-bdr">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">HR Verification Queue</span>
                <p className="font-bold text-slate-900 text-sm mt-1">HR Admin & Governance</p>
                <p className="text-[11px] font-mono text-muted mt-0.5">/hrms/organization › Resignations</p>
              </div>
            </div>

            {/* Reason on Record */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-bdr">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Reason on Record</span>
              <p className="font-medium text-slate-800 mt-1 leading-relaxed whitespace-pre-wrap">
                {activeResignation.reason || 'Voluntary resignation notice'}
              </p>
            </div>

            {/* Exit Checklist Status if available */}
            {Array.isArray(activeResignation.checklist) && activeResignation.checklist.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-bdr space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Exit Clearance Checklist</span>
                <div className="space-y-1.5 mt-2">
                  {activeResignation.checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                      <span className="text-xs font-medium text-slate-800">{item.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.isCompleted ? 'Cleared' : 'Pending Clearance'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11.5px] text-blue-900 flex items-start gap-2">
              <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>HR Notice:</strong> Your resignation is linked directly to the HR Admin Resignation section.
                HR administrators will complete your exit interview, handover sign-off, and final settlement upon reaching your last working day.
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitResignation} className="space-y-4 text-xs">
            {/* Employee Profile Preview */}
            <div className="p-3.5 bg-slate-50 border border-bdr rounded-xl flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Staff Member</span>
                <h4 className="font-bold text-slate-900 text-sm mt-0.5">{currentEmployee?.name || employeeName}</h4>
                <p className="text-muted text-[11px] mt-0.5">
                  {employeeCode} • {designation} • {department}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-xs border border-indigo-200">
                Auto-fills to HR Admin
              </span>
            </div>

            {/* Notice Period and Last Working Day */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Notice Period (Days) *</label>
                <select
                  value={resignationForm.noticePeriodDays}
                  onChange={(e) => {
                    const days = Number(e.target.value);
                    setResignationForm({
                      ...resignationForm,
                      noticePeriodDays: days,
                      noticePeriod: `${days} Days`,
                      lastWorkingDay: computeLWD(days),
                    });
                  }}
                  className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value={15}>15 Days (Probation / Early Release)</option>
                  <option value={30}>30 Days (Standard Staff Notice)</option>
                  <option value={60}>60 Days (Managerial / Operational)</option>
                  <option value={90}>90 Days (Executive / Specialized)</option>
                </select>
                <p className="text-[10.5px] text-muted mt-1">Contractual period of work before formal release.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Proposed Last Working Day *</label>
                <input
                  type="date"
                  value={resignationForm.lastWorkingDay}
                  onChange={(e) => setResignationForm({ ...resignationForm, lastWorkingDay: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary"
                  required
                />
                <p className="text-[10.5px] text-muted mt-1">Calculated from submission date + notice period.</p>
              </div>
            </div>

            {/* Handover Colleague */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Handover Colleague (Knowledge Transfer Assignee)</label>
              <select
                value={resignationForm.handoverToId}
                onChange={(e) => {
                  const sel = colleagues.find((c) => c.id === e.target.value);
                  setResignationForm({
                    ...resignationForm,
                    handoverToId: e.target.value,
                    handoverTo: sel?.name || '',
                  });
                }}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">Select a team member for handover...</option>
                {colleagues.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name} ({col.employeeCode || col.empId || 'Staff'}) — {col.designation || col.role || 'Colleague'}
                  </option>
                ))}
              </select>
              <p className="text-[10.5px] text-muted mt-1">Colleague who will receive task handover and ongoing responsibilities.</p>
            </div>

            {/* Resignation Category & Reason */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Primary Reason Category *</label>
              <select
                value={resignationForm.category}
                onChange={(e) => setResignationForm({ ...resignationForm, category: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="Better Career Opportunity">Better Career Opportunity / New Role</option>
                <option value="Relocation / Family Reasons">Relocation / Personal & Family Reasons</option>
                <option value="Higher Studies">Higher Studies / Educational Pursuit</option>
                <option value="Health / Medical">Health / Medical Well-being</option>
                <option value="Career Break / Sabbatical">Career Break / Sabbatical</option>
                <option value="Entrepreneurship">Entrepreneurship / Personal Venture</option>
                <option value="Other Personal Reasons">Other Personal Reasons</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Detailed Explanation & Transition Notes *</label>
              <textarea
                rows={3}
                value={resignationForm.reason}
                onChange={(e) => setResignationForm({ ...resignationForm, reason: e.target.value })}
                placeholder="State your reasons, key project transition status, and any special requests for HR Admin..."
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary resize-none"
                required
              />
            </div>

            {/* Formal Declaration Checkbox */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resignationForm.confirmed}
                  onChange={(e) => setResignationForm({ ...resignationForm, confirmed: e.target.checked })}
                  className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                  required
                />
                <span className="text-[11.5px] text-slate-800 leading-snug">
                  <strong>Formal Notice Declaration:</strong> I confirm that I am submitting this voluntary resignation notice. I understand this will be routed directly to HR Admin &amp; Management under <strong>HRMS › Organization › Resignations</strong> to initiate the exit review, handover sign-off, and clearance procedure.
                </span>
              </label>
            </div>
          </form>
        )}
      </Modal>

      {/* ── MODAL 9: Upload Employee Document (PDF) ── */}
      <Modal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        title="Upload Personal Document (PDF)"
        subtitle="Submit personal verification documents to the HRMS Vault. All submissions are automatically linked to your employee record."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsDocModalOpen(false)}
              className="btn-outline h-9 px-4 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitDocument}
              disabled={isSubmitting || !docUploadForm.file || !docUploadForm.title.trim()}
              className="btn-primary h-9 px-5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
              Upload Document
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmitDocument} className="space-y-4 text-xs">
          {/* File Picker & Drag-and-Drop Area */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Select PDF Document * <span className="text-muted font-normal">(PDF format only, max 15MB)</span>
            </label>
            <div className="border-2 border-dashed border-bdr rounded-2xl p-5 text-center hover:border-primary/50 transition bg-slate-50/50">
              <input
                type="file"
                accept=".pdf,application/pdf"
                id="employeePdfUploadInput"
                onChange={handlePdfFileSelect}
                className="hidden"
              />
              <label
                htmlFor="employeePdfUploadInput"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold text-xs shadow-xs">
                  PDF
                </div>
                {docUploadForm.fileName ? (
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{docUploadForm.fileName}</div>
                    <div className="text-[11px] text-muted mt-0.5">{docUploadForm.fileSize} • Click to change file</div>
                  </div>
                ) : (
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Click to browse or drag PDF here</div>
                    <div className="text-[11px] text-muted mt-0.5">Official PDFs: Identity, Contract, Financial, Compliance, etc.</div>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Document Title */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Document Title *</label>
            <input
              type="text"
              value={docUploadForm.title}
              onChange={(e) => setDocUploadForm({ ...docUploadForm, title: e.target.value })}
              placeholder="e.g. Passport Copy, Degree Certificate, Signed NDA..."
              className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
              required
            />
          </div>

          {/* Document Category (7 Required Categories) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Document Category *</label>
              <select
                value={docUploadForm.category}
                onChange={(e) => setDocUploadForm({ ...docUploadForm, category: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary cursor-pointer"
                required
              >
                <option value="Identity">Identity (Passport, Aadhaar, ID, License)</option>
                <option value="Contract">Contract (Employment Agreement, Offer, NDA)</option>
                <option value="Financial">Financial (Bank Proof, Form 16, Tax Returns)</option>
                <option value="Compliance">Compliance (Work Authorization, Visa, Certifications)</option>
                <option value="Legal">Legal (Declarations, Statutory Forms, Bonds)</option>
                <option value="Educational">Educational (Degrees, Diplomas, Marksheets)</option>
                <option value="General">General (Other Official Personnel Documents)</option>
              </select>
            </div>

            {/* Document Expiry Date */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Document Expiry Date (Optional)</label>
              <input
                type="date"
                value={docUploadForm.expiry}
                onChange={(e) => setDocUploadForm({ ...docUploadForm, expiry: e.target.value })}
                className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Description / Additional Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Notes / Description (Optional)</label>
            <textarea
              rows={2}
              value={docUploadForm.description}
              onChange={(e) => setDocUploadForm({ ...docUploadForm, description: e.target.value })}
              placeholder="Additional remarks or issuing authority details for HR record..."
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-bdr text-xs font-medium text-slate-800 focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Ownership Attestation */}
          <div className="p-3 bg-slate-50 border border-bdr rounded-xl flex items-center justify-between text-muted text-[11.5px]">
            <span>Submitting as: <strong className="text-slate-800">{employeeName}</strong> ({employeeCode})</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <Check size={13} /> Session Verified
            </span>
          </div>
        </form>
      </Modal>

      {/* ── MODAL 10: PDF Preview Modal ── */}
      <Modal
        isOpen={Boolean(previewDocModal)}
        onClose={() => setPreviewDocModal(null)}
        title={previewDocModal ? `PDF Document: ${previewDocModal.title}` : 'Preview Document'}
        subtitle="Electronic document preview from Evenmore HRMS Vault"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-muted">
              {previewDocModal?.category} • Uploaded {previewDocModal?.uploadDate || previewDocModal?.updatedOn}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewDocModal(null)}
                className="btn-outline h-9 px-4 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              {previewDocModal && (
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(previewDocModal)}
                  className="btn-primary h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} /> Download PDF
                </button>
              )}
            </div>
          </div>
        }
      >
        {previewDocModal && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-bdr rounded-xl text-xs">
              <div>
                <span className="text-muted">File: </span>
                <span className="font-mono font-semibold text-slate-800">{previewDocModal.fileName || `${previewDocModal.title}.pdf`}</span>
              </div>
              <Badge tone={previewDocModal.status === 'Valid' ? 'success' : 'warning'}>
                {previewDocModal.status || 'Valid'}
              </Badge>
            </div>
            {docPreview.url ? (
              <iframe
                src={docPreview.url}
                title={previewDocModal.title}
                className="w-full h-[450px] rounded-xl border border-bdr"
              />
            ) : (
              <div className="p-12 text-center text-muted bg-slate-50 rounded-xl border border-bdr">
                <FileText size={42} className="mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-800">
                  {docPreview.loading ? 'Loading file…' : previewDocModal.hasFile ? 'Preview unavailable' : 'No file attached'}
                </p>
                <p className="text-xs text-muted mt-1">{docPreview.error || 'This document is stored securely in the HRMS Vault.'}</p>
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(previewDocModal)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition cursor-pointer"
                >
                  <Download size={14} />
                  Download Document File
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Policy Details & Version History Modal */}
      <Modal
        isOpen={Boolean(viewPolicyModal)}
        onClose={() => {
          setViewPolicyModal(null);
          setViewHistoricalVersion(null);
        }}
        title={`Policy: ${viewPolicyModal?.name || 'Company Policy'}`}
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            <div>
              {viewPolicyModal?.ackRequired && (
                employeeAckMap[viewPolicyModal.id] ? (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 size={15} /> Acknowledged on {employeeAckMap[viewPolicyModal.id].ackDate || 'file'}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      acknowledgePolicy(viewPolicyModal.id, employeeName, currentEmployee?.id || employeeCode, department);
                      showToast?.(`Acknowledged policy "${viewPolicyModal.name}"`);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <Check size={14} /> I have read & acknowledge this policy
                  </button>
                )
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setViewPolicyModal(null);
                setViewHistoricalVersion(null);
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        {viewPolicyModal && (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Header info banner */}
            <div className="bg-slate-50 border border-bdr rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {viewPolicyModal.category || 'General'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-200 text-slate-800">
                    {viewHistoricalVersion ? viewHistoricalVersion.version : viewPolicyModal.version || 'v1.0'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                    (viewHistoricalVersion ? viewHistoricalVersion.status : viewPolicyModal.status) === 'Active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {viewHistoricalVersion ? viewHistoricalVersion.status : viewPolicyModal.status}
                  </span>
                </div>
                <div className="text-xs text-muted">
                  ID: <b className="text-slate-800 font-mono">{viewPolicyModal.id}</b>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mt-3 pt-3 border-t border-bdr/60">
                <div>
                  <span className="text-muted block text-[11px]">Owner Department</span>
                  <span className="font-bold text-slate-800">{viewPolicyModal.ownerDept || 'General'}</span>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">Applicable To</span>
                  <span className="font-bold text-slate-800">{viewPolicyModal.applicableTo || 'All Employees'}</span>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">Effective Date</span>
                  <span className="font-bold text-slate-800">
                    {formatDate(viewHistoricalVersion ? viewHistoricalVersion.effectiveDate : viewPolicyModal.effectiveDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* If viewing historical version banner */}
            {viewHistoricalVersion && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-800">
                <span>
                  Viewing historical version <b>{viewHistoricalVersion.version}</b> (effective {formatDate(viewHistoricalVersion.effectiveDate)})
                </span>
                <button
                  type="button"
                  onClick={() => setViewHistoricalVersion(null)}
                  className="font-bold underline hover:text-amber-900 cursor-pointer"
                >
                  Return to Current ({viewPolicyModal.version})
                </button>
              </div>
            )}

            {/* Policy Summary */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Executive Summary</h4>
              <p className="text-xs text-slate-700 bg-slate-50/80 p-3.5 rounded-xl border border-bdr leading-relaxed">
                {viewHistoricalVersion?.summary || viewPolicyModal.summary || 'No summary available.'}
              </p>
            </div>

            {/* Policy Clauses & Full Content */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5">Policy Content & Clauses</h4>
              <div className="text-xs text-slate-800 bg-white p-4 rounded-xl border border-bdr leading-relaxed whitespace-pre-wrap font-sans">
                {viewHistoricalVersion?.content || viewPolicyModal.content || 'Standard operational procedures and obligations apply as prescribed by enterprise compliance standards.'}
              </div>
            </div>

            {/* Old Versions & Revision History */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2">
                <History size={15} className="text-slate-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Version History & Old Policies ({(viewPolicyModal.versionHistory || []).length})
                </h4>
              </div>

              {(viewPolicyModal.versionHistory || []).length <= 1 ? (
                <p className="text-xs text-muted bg-slate-50 p-3 rounded-xl border border-dashed border-bdr">
                  This is the initial version ({viewPolicyModal.version || 'v1.0'}) of this policy. No previous versions recorded.
                </p>
              ) : (
                <div className="divide-y divide-bdr/60 border border-bdr rounded-xl overflow-hidden bg-slate-50/50">
                  {(viewPolicyModal.versionHistory || []).map((v, idx) => (
                    <div key={`${v.version}-${idx}`} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800">{v.version}</span>
                          <span className="text-[11px] text-muted">• {formatDate(v.effectiveDate)}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            v.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {v.status || (idx === 0 ? 'Active' : 'Archived')}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-600 mt-1">
                          {v.summary || 'Policy update'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (idx === 0) setViewHistoricalVersion(null);
                          else setViewHistoricalVersion(v);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-bdr text-[11px] font-bold hover:bg-slate-100 transition cursor-pointer shrink-0"
                      >
                        {viewHistoricalVersion?.version === v.version ? 'Current View' : 'Inspect Version'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Early Punch Out Modal if triggered */}
      <EarlyPunchOutModal
        isOpen={earlyModalOpen}
        onClose={() => setEarlyModalOpen(false)}
        onConfirm={executePunchOut}
        todayPunch={todayPunch}
        isSubmitting={submittingPunch}
      />
    </div>
  );
}
