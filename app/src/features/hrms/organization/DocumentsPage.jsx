import { useState, useMemo, useRef, useEffect } from "react";
import api from "../../../services/api";
import { isBackendEnabled } from "../../../services/resourceSync";
import { useAppStore } from "../../../stores/appStore";
import { useDocumentStore } from "../../../stores/documentStore";
import { useDocumentFileUrl, downloadDocumentFile } from "../../../hooks/useDocumentFile";

/** Matches the server's FILE_MAX_BYTES (25 MB). */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function isPdf(file) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}
import { Badge } from "../../../components/hrms/Badge";
import Modal from "../../../components/ui/Modal";
import MasterSourceLink from "../../../components/common/MasterSourceLink";
import PageHeader from "../../../components/ui/PageHeader";
import AppPagination from "../../../components/ui/AppPagination";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { Avatar } from "../../../components/hrms/Avatar";
import {
  FileText,
  Download,
  Eye,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Filter,
  User,
  Users,
  Folder,
  Shield,
  Calendar,
  Building,
  UploadCloud,
  FileCheck,
  X,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Lock,
  Share2,
  Upload,
  FileUp,
} from "lucide-react";

// Inferred category from filename
function inferCategoryFromFilename(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes("offer") || lower.includes("contract") || lower.includes("agreement") || lower.includes("appointment")) {
    return "Contract";
  }
  if (lower.includes("passport") || lower.includes("aadhaar") || lower.includes("id") || lower.includes("license") || lower.includes("pan") || lower.includes("kyc")) {
    return "Identity";
  }
  if (lower.includes("policy") || lower.includes("handbook") || lower.includes("guideline") || lower.includes("manual")) {
    return "Policy";
  }
  if (lower.includes("tax") || lower.includes("form16") || lower.includes("salary") || lower.includes("cheque") || lower.includes("bank") || lower.includes("w2") || lower.includes("w4")) {
    return "Financial";
  }
  if (lower.includes("visa") || lower.includes("permit") || lower.includes("compliance") || lower.includes("nda") || lower.includes("confidential")) {
    return "Compliance";
  }
  if (lower.includes("degree") || lower.includes("certificate") || lower.includes("transcript") || lower.includes("diploma")) {
    return "Educational";
  }
  return "General";
}

export function DocumentsPage() {
  const showToast = useAppStore((s) => s.showToast);
  const employees = useAppStore((s) => s.employees);
  const currentUser = useAppStore((s) => s.currentUser) || {
    name: "System Admin",
    role: "Operations Admin",
    email: "admin@evenmore.io",
  };

  const {
    documents,
    addDocument,
    updateDocument,
    deleteDocument,
  } = useDocumentStore();

  // Primary navigation tabs: 'all' | 'employee' | 'my'
  const [activeTab, setActiveTab] = useState("all");

  // Filters & search state for All Documents tab
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [scopeFilter, setScopeFilter] = useState("All");
  const [employeeFilter, setEmployeeFilter] = useState("All");

  // Employee-wise tab state
  const [selectedEmpName, setSelectedEmpName] = useState(
    employees[0]?.name || ""
  );
  const [empSearch, setEmpSearch] = useState("");
  const [empCategoryFilter, setEmpCategoryFilter] = useState("All");

  // Keep selectedEmpName populated if employees loads asynchronously
  useEffect(() => {
    if (!selectedEmpName && employees.length > 0) {
      setSelectedEmpName(employees[0].name);
    }
  }, [employees, selectedEmpName]);

  // My Documents user override
  const [myDocUser, setMyDocUser] = useState(currentUser?.name || "");
  const [myDocCategoryFilter, setMyDocCategoryFilter] = useState("All");

  useEffect(() => {
    if (!myDocUser && currentUser?.name) {
      setMyDocUser(currentUser.name);
    }
  }, [currentUser, myDocUser]);

  // Modals state
  const [previewDoc, setPreviewDoc] = useState(null);
  const [deleteDocConfirm, setDeleteDocConfirm] = useState(null);
  const [editDoc, setEditDoc] = useState(null);
  const [editReplacement, setEditReplacement] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Upload modal state (Single category-based upload)
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("Contract");
  const [uploadEmpName, setUploadEmpName] = useState(selectedEmpName);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadExpiry, setUploadExpiry] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const modalFileInputRef = useRef(null);

  function openUploadModal(category = "Contract", empName = null) {
    const cat = category === "All" ? "Contract" : category;
    const emp = empName || (activeTab === "employee" ? selectedEmpName : activeTab === "my" ? (myDocUser || currentUser?.name || "admin1") : "All Staff");
    setUploadCategory(cat);
    setUploadEmpName(emp);
    setUploadTitle("");
    setUploadExpiry("");
    setUploadFile(null);
    setUploadLoading(false);
    setUploadModalOpen(true);
  }

  function handleModalFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reason = rejectReason(file);
    if (reason) {
      showToast(reason);
      return;
    }
    setUploadFile(file);
    if (!uploadTitle.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const formatted = baseName
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setUploadTitle(formatted);
    }
  }

  async function handleSaveUpload() {
    if (!uploadFile) {
      showToast("Please select a PDF file from your device.");
      return;
    }
    setUploadLoading(true);
    const title = uploadTitle.trim() || uploadFile.name;
    try {
      await addDocument({
        file: uploadFile,
        title,
        category: uploadCategory,
        employeeId: employeeIdFor(uploadEmpName),
        expiry: uploadExpiry || null,
        description: `Uploaded ${uploadCategory} record: ${uploadFile.name}`,
        tags: [uploadCategory, "Document Vault"],
      });
      showToast(`Saved "${title}" under ${uploadCategory} for ${uploadEmpName}`);
      setUploadModalOpen(false);
      if (activeTab === "employee") {
        setEmpCategoryFilter(uploadCategory);
      } else if (activeTab === "my") {
        setMyDocCategoryFilter(uploadCategory);
      }
    } catch (err) {
      showToast(`Could not save document: ${err?.message || "server error"}`);
    } finally {
      setUploadLoading(false);
    }
  }

  // Hidden native file inputs: new uploads, and a replacement for the edited document
  const deviceFileInputRef = useRef(null);
  const replaceFileInputRef = useRef(null);
  const [targetScopeForUpload, setTargetScopeForUpload] = useState("All Staff");
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);

  // The stored file, fetched from the server for the viewer
  const preview = useDocumentFileUrl(previewDoc);

  async function handleDownload(doc) {
    try {
      await downloadDocumentFile(doc);
    } catch (err) {
      showToast(err?.message || "Could not download the file");
    }
  }

  /** Server employee id for a scope name; null means company-wide (All Staff). */
  function employeeIdFor(scopeName) {
    if (!scopeName || scopeName === "All Staff") return null;
    const found = employees.find((x) => x.name === scopeName || x.id === scopeName);
    if (found?.id) return found.id;
    if (currentUser && (currentUser.name === scopeName || currentUser.email === scopeName || scopeName === "admin1")) {
      return currentUser.employeeUuid || currentUser.employee_id || currentUser.employeeId || null;
    }
    return null;
  }

  // KPI Statistics calculations
  const total = documents.length;
  const valid = documents.filter((d) => d.status === "Valid").length;
  const expiringSoon = documents.filter((d) => d.status === "Expiring Soon").length;
  const expired = documents.filter((d) => d.status === "Expired").length;

  // Distinct categories available across predefined list and current documents
  const categoriesList = useMemo(() => {
    const standard = [
      "All",
      "General",
      "Contract",
      "Educational",
      "Financial",
      "Identity",
      "Compliance",
      "Legal",
      "Policy",
      "Security",
    ];
    const fromDocs = (documents || [])
      .map((d) => d.category)
      .filter(Boolean);
    const seen = new Set();
    const result = [];
    [...standard, ...fromDocs].forEach((c) => {
      const key = String(c).trim();
      const lower = key.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(key);
      }
    });
    return result;
  }, [documents]);

  // Options for employee dropdown in All Documents filter
  const employeeFilterOptions = useMemo(() => {
    const list = [...employees];
    if (currentUser?.name && !list.some((e) => e.name === currentUser.name)) {
      list.unshift({ id: currentUser.employeeUuid || "current-user", name: currentUser.name });
    }
    (documents || []).forEach((d) => {
      if (
        d.employee &&
        d.employee !== "All Staff" &&
        !list.some((e) => String(e.name || '').toLowerCase() === String(d.employee).toLowerCase())
      ) {
        list.push({ id: d.employeeId || d.employee, name: d.employee });
      }
    });
    return list;
  }, [employees, currentUser, documents]);

  // Active filter indicator and reset
  const hasActiveFilters =
    Boolean(search.trim()) ||
    categoryFilter !== "All" ||
    statusFilter !== "All" ||
    scopeFilter !== "All" ||
    employeeFilter !== "All";

  function clearAllFilters() {
    setSearch("");
    setCategoryFilter("All");
    setStatusFilter("All");
    setScopeFilter("All");
    setEmployeeFilter("All");
  }

  // Filtered documents for "All Documents"
  const filteredAllDocs = useMemo(() => {
    return documents.filter((d) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        String(d.title ?? '').toLowerCase().includes(q) ||
        String(d.employee ?? '').toLowerCase().includes(q) ||
        String(d.id ?? '').toLowerCase().includes(q) ||
        String(d.category ?? '').toLowerCase().includes(q) ||
        String(d.fileName ?? '').toLowerCase().includes(q) ||
        String(d.description ?? '').toLowerCase().includes(q) ||
        String(d.status ?? '').toLowerCase().includes(q) ||
        (Array.isArray(d.tags) && d.tags.some((t) => String(t).toLowerCase().includes(q)));

      const matchesCat =
        categoryFilter === "All" ||
        String(d.category ?? '').toLowerCase().trim() === categoryFilter.toLowerCase().trim();

      const matchesStatus =
        statusFilter === "All" ||
        String(d.status ?? '').toLowerCase().trim() === statusFilter.toLowerCase().trim();

      const isCompanyWide =
        d.employee === "All Staff" ||
        d.employeeId === "ALL" ||
        (!d.employee && !d.employeeId);

      const matchesScope =
        scopeFilter === "All"
          ? true
          : scopeFilter === "Company"
          ? isCompanyWide
          : !isCompanyWide;

      const matchesEmployee =
        employeeFilter === "All"
          ? true
          : employeeFilter === "All Staff"
          ? isCompanyWide
          : (String(d.employee ?? '').toLowerCase().trim() === employeeFilter.toLowerCase().trim() ||
             (d.employeeId && String(d.employeeId) === employeeFilter));

      return matchesSearch && matchesCat && matchesStatus && matchesScope && matchesEmployee;
    });
  }, [documents, search, categoryFilter, statusFilter, scopeFilter, employeeFilter]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter, scopeFilter, employeeFilter, pageSize]);

  const paginatedAllDocs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAllDocs.slice(start, start + pageSize);
  }, [filteredAllDocs, page, pageSize]);

  // Selected employee object and documents
  const currentSelectedEmployee = useMemo(() => {
    return (
      employees.find((e) => e.name === selectedEmpName) || {
        id: "EMP-CUSTOM",
        name: selectedEmpName,
        designation: "Team Member",
        department: "General",
        email: `${(selectedEmpName || '').toLowerCase().replace(/\s+/g, ".")}@company.com`,
        joining: "Jan 15, 2023",
        status: "Active",
        avatar: null,
      }
    );
  }, [employees, selectedEmpName]);

  const employeeDocs = useMemo(() => {
    if (!selectedEmpName) return [];
    const selLower = selectedEmpName.toLowerCase().trim();
    const selEmp = employees.find(
      (e) => (e.name && e.name.toLowerCase().trim() === selLower) || (e.id && String(e.id) === selectedEmpName)
    );
    const selEmpId = selEmp?.id;
    const selEmpUuid = selEmp?.employeeUuid;
    const selEmpCode = (selEmp?.employee_code || selEmp?.employeeId || '').toLowerCase().trim();

    return documents.filter((d) => {
      const docEmp = String(d.employee || '').toLowerCase().trim();
      if (docEmp && docEmp === selLower) return true;
      if (selEmpCode && docEmp && docEmp === selEmpCode) return true;
      if (selEmpId && d.employeeId && String(d.employeeId) === String(selEmpId)) return true;
      if (selEmpUuid && d.employeeId && String(d.employeeId) === String(selEmpUuid)) return true;
      return false;
    });
  }, [documents, selectedEmpName, employees]);

  const filteredEmployeeDocs = useMemo(() => {
    if (empCategoryFilter === "All") return employeeDocs;
    const filterLower = empCategoryFilter.toLowerCase().trim();
    return employeeDocs.filter((d) => String(d.category || '').toLowerCase().trim() === filterLower);
  }, [employeeDocs, empCategoryFilter]);

  // Documents for "My Documents"
  const myDocs = useMemo(() => {
    const curEmpId = currentUser?.employeeUuid || currentUser?.employee_id || currentUser?.employeeId;
    const userName = (currentUser?.name || '').toLowerCase().trim();
    const targetName = (myDocUser || currentUser?.name || '').toLowerCase().trim();

    return documents.filter((d) => {
      const docEmp = String(d.employee || '').toLowerCase().trim();
      if (targetName && docEmp && docEmp === targetName) return true;
      if (curEmpId && (String(d.employeeId) === String(curEmpId) || String(d.employee_id) === String(curEmpId))) return true;
      if (userName && docEmp && docEmp === userName) return true;
      return false;
    });
  }, [documents, myDocUser, currentUser]);

  const filteredMyDocs = useMemo(() => {
    if (myDocCategoryFilter === "All") return myDocs;
    const filterLower = myDocCategoryFilter.toLowerCase().trim();
    return myDocs.filter((d) => String(d.category || '').toLowerCase().trim() === filterLower);
  }, [myDocs, myDocCategoryFilter]);

  // =========================================================================
  // SELECT FROM DEVICE: NO FORMS, DIRECT UPLOAD
  // =========================================================================
  function triggerSelectFromDevice(targetScope = "All Staff") {
    setTargetScopeForUpload(targetScope);
    if (deviceFileInputRef.current) {
      deviceFileInputRef.current.value = "";
      deviceFileInputRef.current.click();
    }
  }

  /** Returns an error message, or "" when the file can be uploaded. */
  function rejectReason(file) {
    if (!isPdf(file)) return `"${file.name}" is not a PDF.`;
    if (file.size > MAX_UPLOAD_BYTES) return `"${file.name}" is larger than 25 MB.`;
    return "";
  }

  // The real file goes to the server (/files/ upload, not base64), then the
  // document row is created pointing at it.
  async function processFilesFromDevice(fileList, targetScope) {
    if (!fileList || fileList.length === 0) return;

    for (const file of Array.from(fileList)) {
      const reason = rejectReason(file);
      if (reason) {
        showToast(reason);
        continue;
      }
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const formattedTitle = baseName
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const inferredCat = inferCategoryFromFilename(file.name);

      setUploadingCount((n) => n + 1);
      try {
        await addDocument({
          file,
          title: formattedTitle || file.name,
          category: inferredCat,
          employeeId: employeeIdFor(targetScope),
          description: `Uploaded from device: ${file.name}`,
          tags: [inferredCat, "Device Upload"],
        });
        showToast(`Uploaded "${file.name}" to ${targetScope}`);
      } catch (err) {
        showToast(`Could not upload "${file.name}": ${err?.message || "server error"}`);
      } finally {
        setUploadingCount((n) => n - 1);
      }
    }
  }

  function handleReplaceFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reason = rejectReason(file);
    if (reason) {
      showToast(reason);
      return;
    }
    setEditReplacement(file);
  }

  async function handleSaveEdit() {
    if (!editDoc) return;
    setSavingEdit(true);
    try {
      await updateDocument(
        editDoc.id,
        {
          title: editDoc.title,
          category: editDoc.category,
          employeeId: employeeIdFor(editDoc.employee),
          expiry: editDoc.expiryIso || null,
        },
        { file: editReplacement },
      );
      showToast(editReplacement ? `Updated "${editDoc.title}" with the new file` : `Updated "${editDoc.title}"`);
      setEditDoc(null);
      setEditReplacement(null);
    } catch (err) {
      showToast(`Could not save: ${err?.message || "server error"}`);
    } finally {
      setSavingEdit(false);
    }
  }

  function handleDeviceFileInputChange(e) {
    const files = e.target.files;
    processFilesFromDevice(files, targetScopeForUpload);
  }

  // Drag & drop handlers
  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    const currentScope =
      activeTab === "employee" ? selectedEmpName : activeTab === "my" ? myDocUser : "All Staff";
    processFilesFromDevice(files, currentScope);
  }

  async function handleDelete(doc) {
    try {
      await deleteDocument(doc.id);
      showToast(`Document "${doc.title}" removed`);
    } catch (err) {
      showToast(`Could not delete: ${err?.message || "server error"}`);
    } finally {
      setDeleteDocConfirm(null);
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case "Valid":
        return <Badge tone="success">Valid</Badge>;
      case "Expiring Soon":
        return <Badge tone="warning">Expiring Soon</Badge>;
      case "Expired":
        return <Badge tone="critical">Expired</Badge>;
      case "Pending Verification":
        return <Badge tone="info">Pending Review</Badge>;
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  }

  function getCategoryColor(cat) {
    const c = String(cat || '').toLowerCase().trim();
    switch (c) {
      case "policy":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "contract":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "identity":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "compliance":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "security":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "educational":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "financial":
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "legal":
        return "bg-slate-100 text-slate-700 border-slate-300";
      case "general":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  }

  return (
    <div
      className={`flex flex-col gap-6 transition ${
        isDragOver ? "ring-4 ring-navy/30 rounded-3xl" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Invisible device file input: selects directly from device */}
      <input
        type="file"
        ref={deviceFileInputRef}
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={handleDeviceFileInputChange}
      />
      <input
        type="file"
        ref={replaceFileInputRef}
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleReplaceFileChange}
      />

      <PageHeader
        title="Document Management"
        titleExtra={
          <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            PDF Vault
          </span>
        }
        subtitle="Manage company compliance policies, employee personnel dossiers, and personal records in PDF format"
        guide={hrmsGuides.documents}
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">
              Total Documents
            </span>
            <div className="text-[26px] font-extrabold text-slate-900 mt-1 leading-none">
              {total}
            </div>
            <span className="text-[11.5px] text-muted mt-1 inline-block">Format: PDF</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Folder size={20} />
          </div>
        </div>

        <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[12px] font-semibold text-emerald-700 uppercase tracking-wide">
              Valid &amp; Active
            </span>
            <div className="text-[26px] font-extrabold text-emerald-950 mt-1 leading-none">
              {valid}
            </div>
            <span className="text-[11.5px] text-emerald-700 mt-1 inline-block">
              {total > 0 ? Math.round((valid / total) * 100) : 0}% verified
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[12px] font-semibold text-amber-700 uppercase tracking-wide">
              Expiring Soon
            </span>
            <div className="text-[26px] font-extrabold text-amber-950 mt-1 leading-none">
              {expiringSoon}
            </div>
            <span className="text-[11.5px] text-amber-700 mt-1 inline-block">Needs renewal</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[12px] font-semibold text-rose-700 uppercase tracking-wide">
              Expired / Action Req.
            </span>
            <div className="text-[26px] font-extrabold text-rose-950 mt-1 leading-none">
              {expired}
            </div>
            <span className="text-[11.5px] text-rose-700 mt-1 inline-block">Re-upload PDF</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* Main Section Navigation Tabs */}
      <div className="flex border-b border-bdr gap-2 bg-white px-4 pt-3 rounded-2xl border shadow-xs overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`pb-3.5 px-3 text-[14px] font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 lg:shrink cursor-pointer ${
            activeTab === "all"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Folder size={17} />
          <span>All Documents</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-700 font-medium">
            {documents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("employee")}
          className={`pb-3.5 px-3 text-[14px] font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 lg:shrink cursor-pointer ${
            activeTab === "employee"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users size={17} />
          <span>Employee-wise Documents</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-700 font-medium">
            {employees.length} Staff
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("my")}
          className={`pb-3.5 px-3 text-[14px] font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 lg:shrink cursor-pointer ${
            activeTab === "my"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <User size={17} />
          <span>My Documents</span>
          <span className="px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-700 font-medium">
            {myDocs.length}
          </span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: ALL DOCUMENTS LIST
         ========================================================================= */}
      {activeTab === "all" && (
        <div className="flex flex-col gap-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative w-full sm:w-72">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title, employee, ID, category, tags..."
                    className="w-full h-9.5 pl-9 pr-3.5 bg-off border border-bdr rounded-xl text-[13px] text-slate-900 focus:outline-none focus:border-navy"
                  />
                </div>

                <select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  className="h-9.5 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer max-w-[190px]"
                  title="Filter by Employee"
                >
                  <option value="All">All Staff / Scopes</option>
                  <option value="All Staff">Company Wide (All Staff)</option>
                  {employeeFilterOptions.map((emp) => (
                    <option key={emp.id || emp.name} value={emp.name}>
                      {emp.name}
                    </option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-9.5 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer"
                  title="Filter by Category"
                >
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === "All" ? "All Categories" : cat}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9.5 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer"
                  title="Filter by Status"
                >
                  <option value="All">All Statuses</option>
                  <option value="Valid">Valid</option>
                  <option value="Expiring Soon">Expiring Soon</option>
                  <option value="Expired">Expired</option>
                  <option value="Pending Verification">Pending Verification</option>
                </select>

                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value)}
                  className="h-9.5 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer"
                  title="Filter by Scope"
                >
                  <option value="All">All Scopes</option>
                  <option value="Company">Company Wide Only</option>
                  <option value="Employee">Individual Staff Only</option>
                </select>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="h-9.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-[12.5px] font-semibold text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5 cursor-pointer"
                    title="Clear All Filters"
                  >
                    <X size={14} />
                    <span>Clear Filters</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openUploadModal("Contract", "All Staff")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-navy text-white rounded-xl text-[12.5px] font-semibold hover:bg-navy/90 transition cursor-pointer shadow-xs"
                >
                  <Plus size={14} />
                  <span>Upload Document</span>
                </button>
              </div>
            </div>

            {/* Quick Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-bdr/60">
              <span className="text-[11.5px] font-medium text-slate-400 mr-1 flex items-center gap-1">
                <Filter size={12} />
                Category:
              </span>
              {categoriesList.map((cat) => {
                const count = cat === "All"
                  ? documents.length
                  : documents.filter((d) => String(d.category || '').toLowerCase() === cat.toLowerCase()).length;
                const isSelected = categoryFilter.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(isSelected && cat !== "All" ? "All" : cat)}
                    className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-navy text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Master Table */}
          <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] lg:min-w-0 text-left text-[13px]">
                <thead className="bg-slate-50/75 border-b border-bdr text-[11px] uppercase tracking-wider text-muted font-bold">
                  <tr>
                    <th className="py-3.5 px-5">Document Title &amp; Details</th>
                    <th className="py-3.5 px-5">ID</th>
                    <th className="py-3.5 px-5">Category</th>
                    <th className="py-3.5 px-5">Employee / Scope</th>
                    <th className="py-3.5 px-5">Format &amp; Size</th>
                    <th className="py-3.5 px-5">Expiry</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/40">
                  {filteredAllDocs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted">
                        <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                        No documents match the specified search or filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedAllDocs.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-5">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                              PDF
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => setPreviewDoc(d)}
                                className="font-semibold text-slate-900 hover:text-navy text-left transition cursor-pointer"
                              >
                                {d.title}
                              </button>
                              <div className="text-[11.5px] text-muted flex items-center gap-2 mt-0.5">
                                <span>Updated: {d.updatedOn}</span>
                                {d.tags && d.tags.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-500">
                                      {d.tags.slice(0, 2).join(", ")}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-5 font-mono text-[12px] text-slate-500">
                          {d.id}
                        </td>

                        <td className="py-3.5 px-5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getCategoryColor(
                              d.category
                            )}`}
                          >
                            {d.category}
                          </span>
                        </td>

                        <td className="py-3.5 px-5">
                          {d.employee === "All Staff" ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11.5px] font-medium">
                              <Building size={12} />
                              All Staff
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Avatar name={d.employee} size="xs" />
                              <span className="font-medium text-slate-800">{d.employee}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-slate-800 flex items-center gap-1">
                            <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.2 rounded border border-rose-200 font-bold">PDF</span>
                            <span>{d.version || "v1.0"}</span>
                          </div>
                          <div className="text-[11px] text-muted">{d.fileSize || "—"}</div>
                        </td>

                        <td className="py-3.5 px-5 text-slate-700">
                          {d.expiry === "—" ? (
                            <span className="text-slate-400">Permanent</span>
                          ) : (
                            <span
                              className={
                                d.status === "Expiring Soon"
                                  ? "text-amber-700 font-semibold"
                                  : d.status === "Expired"
                                  ? "text-rose-700 font-semibold"
                                  : "text-slate-700"
                              }
                            >
                              {d.expiry}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-5">{getStatusBadge(d.status)}</td>

                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(d)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-navy transition cursor-pointer"
                              title="Preview PDF"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleDownload(d);
                              }}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                              title="Download PDF"
                            >
                              <Download size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditDoc(d)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition cursor-pointer"
                              title="Edit / Replace File"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteDocConfirm(d)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <AppPagination
              total={filteredAllDocs.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: EMPLOYEE-WISE DOCUMENTS
         ========================================================================= */}
      {activeTab === "employee" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Employee Directory Selector */}
          <div className="lg:col-span-4 bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-bdr/60">
              <h3 className="font-bold text-[15px] text-slate-900 flex items-center gap-1.5">
                <Users size={16} className="text-navy" />
                Staff Directory
              </h3>
              <span className="text-[11.5px] font-semibold text-muted">
                {employees.length} Employees
              </span>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                placeholder="Search colleague..."
                className="w-full h-8.5 pl-8 pr-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-800 focus:outline-none focus:border-navy"
              />
            </div>

            {/* List of employees */}
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {employees
                .filter(
                  (e) =>
                    String(e.name ?? '').toLowerCase().includes(empSearch.toLowerCase()) ||
                    String(e.department ?? '').toLowerCase().includes(empSearch.toLowerCase()) ||
                    String(e.designation ?? '').toLowerCase().includes(empSearch.toLowerCase())
                )
                .map((emp) => {
                  const empNameLower = (emp.name || '').toLowerCase().trim();
                  const empIdStr = emp.id ? String(emp.id) : null;
                  const empUuidStr = emp.employeeUuid ? String(emp.employeeUuid) : null;
                  const empCodeLower = (emp.employee_code || emp.employeeId || '').toLowerCase().trim();

                  const empDocCount = documents.filter((d) => {
                    const docEmp = String(d.employee || '').toLowerCase().trim();
                    if (docEmp && docEmp === empNameLower) return true;
                    if (empCodeLower && docEmp && docEmp === empCodeLower) return true;
                    if (empIdStr && d.employeeId && String(d.employeeId) === empIdStr) return true;
                    if (empUuidStr && d.employeeId && String(d.employeeId) === empUuidStr) return true;
                    return false;
                  }).length;
                  const isSelected = selectedEmpName === emp.name;

                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setSelectedEmpName(emp.name)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer ${
                        isSelected
                          ? "bg-navy/5 border-navy/30 shadow-xs"
                          : "bg-white border-transparent hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={emp.name} size="md" />
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-slate-900 truncate">
                            {emp.name}
                          </div>
                          <div className="text-[11px] text-muted truncate">
                            {emp.designation} • {emp.department}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 pl-2">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            empDocCount > 0
                              ? "bg-slate-100 text-slate-700"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {empDocCount} PDFs
                        </span>
                        <ChevronRight
                          size={15}
                          className={`transition ${
                            isSelected ? "text-navy rotate-90 sm:rotate-0" : "text-slate-300"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Right Selected Employee Dossier */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* Employee Profile Header Banner */}
            <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <Avatar name={currentSelectedEmployee.name} size="xl" className="rounded-2xl" />
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[18px] font-bold text-slate-900 leading-tight">
                      {currentSelectedEmployee.name}
                    </h2>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[11px] font-bold rounded-md">
                      {currentSelectedEmployee.id}
                    </span>
                    <Badge tone="success">Verified Personnel</Badge>
                  </div>
                  <p className="text-[12.5px] text-muted mt-0.5">
                    {currentSelectedEmployee.designation} • {currentSelectedEmployee.department} •{" "}
                    <span className="text-slate-700">{currentSelectedEmployee.email}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Dossier Category Filter Pills & Single Category-Based Upload Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-bdr rounded-2xl p-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  "All",
                  "General",
                  "Contract",
                  "Educational",
                  "Financial",
                  "Identity",
                  "Compliance",
                  "Legal",
                  "Policy",
                ].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setEmpCategoryFilter(cat)}
                    className={`px-3 py-1.5 text-[12px] font-semibold rounded-xl transition cursor-pointer ${
                      empCategoryFilter.toLowerCase() === cat.toLowerCase()
                        ? "bg-navy text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-[12px] text-muted pr-1">
                  <span className="font-semibold text-slate-800">{filteredEmployeeDocs.length}</span>{" "}
                  PDF files
                </div>

                <button
                  type="button"
                  onClick={() => openUploadModal(empCategoryFilter === "All" ? "Contract" : empCategoryFilter, selectedEmpName)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-navy text-white rounded-xl text-[12.5px] font-semibold hover:bg-navy/90 transition cursor-pointer shadow-xs"
                >
                  <Plus size={15} />
                  <span>Upload {empCategoryFilter === "All" ? "Document" : empCategoryFilter}</span>
                </button>
              </div>
            </div>

            {/* Employee's Document Cards */}
            <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
              {filteredEmployeeDocs.length === 0 ? (
                <div className="py-12 px-6 text-center text-muted">
                  <FileText size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-700">No PDF documents found for {selectedEmpName}</p>
                  <p className="text-[12px] text-muted mt-1">
                    Select a PDF file from your device to add it to this employee's dossier.
                  </p>
                  <button
                    type="button"
                    onClick={() => openUploadModal(empCategoryFilter === "All" ? "Contract" : empCategoryFilter, selectedEmpName)}
                    className="mt-4 inline-flex items-center gap-2 px-4.5 py-2.5 bg-navy text-white rounded-xl text-[13px] font-semibold hover:bg-navy/90 transition cursor-pointer"
                  >
                    <Plus size={16} />
                    Upload {empCategoryFilter === "All" ? "Document" : empCategoryFilter}
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-bdr/40">
                  {filteredEmployeeDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[11px]">
                          PDF
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="font-bold text-[14px] text-slate-900 hover:text-navy text-left transition cursor-pointer"
                            >
                              {doc.title}
                            </button>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${getCategoryColor(
                                doc.category
                              )}`}
                            >
                              {doc.category}
                            </span>
                            {getStatusBadge(doc.status)}
                          </div>
                          <div className="text-[12px] text-slate-600 mt-1 line-clamp-1">
                            {doc.description || "Official personnel PDF record."}
                          </div>
                          <div className="text-[11.5px] text-muted flex flex-wrap items-center gap-2.5 mt-1.5">
                            <span>ID: <b className="font-mono text-slate-700">{doc.id}</b></span>
                            <span>•</span>
                            <span>Format: <b className="text-rose-700">PDF</b></span>
                            <span>•</span>
                            <span>Size: <b>{doc.fileSize || "—"}</b></span>
                            <span>•</span>
                            <span>
                              Expiry:{" "}
                              <b
                                className={
                                  doc.status === "Expiring Soon"
                                    ? "text-amber-700"
                                    : doc.status === "Expired"
                                    ? "text-rose-700"
                                    : "text-slate-700"
                                }
                              >
                                {doc.expiry || "Permanent"}
                              </b>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-navy transition cursor-pointer"
                          title="Preview PDF"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleDownload(doc);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-emerald-700 transition cursor-pointer"
                          title="Download PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditDoc(doc)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteDocConfirm(doc)}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: MY DOCUMENTS SECTION
         ========================================================================= */}
      {activeTab === "my" && (
        <div className="flex flex-col gap-6">
          {/* My Profile Document Vault Banner */}
          <div className="bg-gradient-to-r from-navy/95 to-navy/80 text-white rounded-2xl p-4 sm:p-6 shadow-md flex flex-wrap justify-between items-center gap-6">
            <div className="flex items-center gap-4.5 min-w-0 lg:min-w-auto">
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white text-[22px] font-bold shadow-inner">
                {currentUser?.initials || "AG"}
              </div>
              <div>
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">
                  <h2 className="text-[20px] font-bold leading-tight">{myDocUser}</h2>
                  <span className="px-2.5 py-0.5 bg-white/15 border border-white/20 rounded-full text-[11px] font-medium">
                    Personal PDF Vault
                  </span>
                </div>
                <p className="text-[13px] text-white/80 mt-1">
                  Role: {currentUser?.role} • {currentUser?.email}
                </p>
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 mt-2 text-[12px] text-white/90">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    {myDocs.filter((d) => d.status === "Valid").length} Verified PDFs
                  </span>
                  <span>•</span>
                  <span>{myDocs.length} Total Records</span>
                </div>
              </div>
            </div>

            {/* View-As selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xs p-1.5 rounded-xl border border-white/15 text-[12px]">
                <span className="text-white/70 pl-2">Active User:</span>
                <select
                  value={myDocUser}
                  onChange={(e) => setMyDocUser(e.target.value)}
                  className="bg-navy/80 text-white border-none rounded-lg px-2.5 py-1 text-[12px] font-semibold focus:outline-none cursor-pointer"
                >
                  <option value={currentUser?.name}>{currentUser?.name} (You)</option>
                  {employees
                    .filter((e) => e.name !== currentUser?.name)
                    .map((e) => (
                      <option key={e.id} value={e.name}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Notice if Expiring */}
          {myDocs.some((d) => d.status === "Expiring Soon" || d.status === "Expired") && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 text-amber-900">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                <span className="text-[13px] font-medium">
                  One or more of your PDF documents requires renewal. Select an updated PDF from your device.
                </span>
              </div>
              <button
                type="button"
                onClick={() => triggerSelectFromDevice(myDocUser)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[12px] font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <UploadCloud size={14} />
                Select New PDF
              </button>
            </div>
          )}

          {/* Category Filter Pills */}
          <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                "All",
                "General",
                "Identity",
                "Contract",
                "Financial",
                "Compliance",
                "Legal",
                "Educational",
                "Policy",
              ].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setMyDocCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-[12.5px] font-semibold rounded-xl transition cursor-pointer ${
                    myDocCategoryFilter.toLowerCase() === cat.toLowerCase()
                      ? "bg-navy text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[12px] text-muted">
                {filteredMyDocs.length} personal record{filteredMyDocs.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => openUploadModal(myDocCategoryFilter === "All" ? "Contract" : myDocCategoryFilter, myDocUser)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-navy text-white rounded-xl text-[12.5px] font-semibold hover:bg-navy/90 transition cursor-pointer shadow-xs"
              >
                <Plus size={15} />
                <span>Upload {myDocCategoryFilter === "All" ? "Document" : myDocCategoryFilter}</span>
              </button>
            </div>
          </div>

          {/* My Documents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMyDocs.length === 0 ? (
              <div className="col-span-full bg-white border border-bdr rounded-2xl p-12 text-center text-muted">
                <FileText size={38} className="mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-800">No personal PDF documents found</p>
                <p className="text-[12.5px] text-muted mt-1">
                  Select your passport, Aadhaar, degree certificates, or signed contract directly from your device.
                </p>
                <button
                  type="button"
                  onClick={() => openUploadModal(myDocCategoryFilter === "All" ? "Contract" : myDocCategoryFilter, myDocUser)}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-[13px] font-semibold hover:bg-navy/90 transition cursor-pointer"
                >
                  <Plus size={16} />
                  Upload {myDocCategoryFilter === "All" ? "Document" : myDocCategoryFilter}
                </button>
              </div>
            ) : (
              filteredMyDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col justify-between transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getCategoryColor(
                          doc.category
                        )}`}
                      >
                        {doc.category}
                      </span>
                      {getStatusBadge(doc.status)}
                    </div>

                    <h3 className="font-bold text-[15px] text-slate-900 leading-snug">
                      {doc.title}
                    </h3>
                    <p className="text-[12px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {doc.description || "Personal PDF record saved in corporate vault."}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-bdr/60">
                    <div className="flex items-center justify-between text-[11.5px] text-muted mb-3">
                      <span>Format: <b className="text-rose-700">PDF</b> ({doc.fileSize || "—"})</span>
                      <span>
                        Expiry:{" "}
                        <b
                          className={
                            doc.status === "Expiring Soon"
                              ? "text-amber-700"
                              : doc.status === "Expired"
                              ? "text-rose-700"
                              : "text-slate-700"
                          }
                        >
                          {doc.expiry || "Permanent"}
                        </b>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[12px] font-semibold transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Eye size={14} />
                        View PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDownload(doc);
                        }}
                        className="flex-1 py-1.5 px-3 bg-navy/5 hover:bg-navy/10 text-navy rounded-xl text-[12px] font-semibold transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Download size={14} />
                        Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditDoc(doc)}
                        className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer"
                        title="Edit Details"
                      >
                        <Edit3 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 0: UPLOAD DOCUMENT ACCORDING TO CATEGORY
         ========================================================================= */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => { if (!uploadLoading) setUploadModalOpen(false); }}
        title={`Upload Document - ${uploadCategory}`}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-slate-50 font-medium cursor-pointer"
              disabled={uploadLoading}
              onClick={() => setUploadModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={uploadLoading || !uploadFile}
              className="inline-flex items-center gap-2 px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-semibold hover:bg-navy/90 transition cursor-pointer shadow-xs disabled:opacity-50"
              onClick={handleSaveUpload}
            >
              <UploadCloud size={16} />
              <span>{uploadLoading ? "Uploading & Saving…" : "Save Document"}</span>
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Target Employee Indicator */}
          <div className="bg-slate-50 border border-bdr rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Avatar name={uploadEmpName} size="sm" />
              <div>
                <div className="text-[11px] text-muted font-medium">Assigned To</div>
                <div className="text-[13px] font-bold text-slate-900">{uploadEmpName}</div>
              </div>
            </div>
            {activeTab === "all" && (
              <select
                value={uploadEmpName}
                onChange={(e) => setUploadEmpName(e.target.value)}
                className="text-[12px] px-2.5 py-1 bg-white border border-bdr rounded-lg text-slate-800 focus:outline-none focus:border-navy cursor-pointer"
              >
                <option value="All Staff">All Staff (Company-wide)</option>
                {currentUser?.name && !employees.some((e) => e.name === currentUser.name) && (
                  <option value={currentUser.name}>{currentUser.name} (You)</option>
                )}
                {employees.map((e) => (
                  <option key={e.id} value={e.name}>{e.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">
              Document Category
            </label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
            >
              <option value="Contract">Contract (Offer letter, Employment agreement, NDA)</option>
              <option value="Educational">Educational (Degrees, Certificates, Transcripts)</option>
              <option value="Financial">Financial (Payslips, Form 16, Tax docs, Bank passbook)</option>
              <option value="Identity">Identity (Aadhaar, Passport, PAN card, Driving license)</option>
              <option value="Compliance">Compliance (Visa, Work permits, Policy acknowledgments)</option>
              <option value="Legal">Legal (Statutory filings, Legal undertakings)</option>
              <option value="Policy">Policy (Company handbook, Standard operating procedures)</option>
              <option value="General">General</option>
            </select>
          </div>

          {/* PDF File Picker */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">
              PDF Document File <span className="text-rose-500">*</span>
            </label>
            <input
              type="file"
              ref={modalFileInputRef}
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleModalFileSelect}
            />
            <div
              onClick={() => modalFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                uploadFile
                  ? "border-emerald-300 bg-emerald-50/40"
                  : "border-slate-200 hover:border-navy/60 bg-slate-50/50 hover:bg-navy/5"
              }`}
            >
              {uploadFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold text-[10px]">
                      PDF
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-slate-900 truncate max-w-[220px]">
                        {uploadFile.name}
                      </div>
                      <div className="text-[11px] text-muted">
                        {(uploadFile.size / 1024).toFixed(1)} KB • Ready to save
                      </div>
                    </div>
                  </div>
                  <span className="text-[11.5px] font-semibold text-navy hover:underline">Change File</span>
                </div>
              ) : (
                <div className="py-2">
                  <UploadCloud size={28} className="mx-auto text-slate-400 mb-1" />
                  <div className="text-[13px] font-semibold text-slate-800">
                    Click to browse and choose PDF
                  </div>
                  <div className="text-[11.5px] text-muted mt-0.5">
                    Accepted format: PDF only (up to 25 MB)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Document Title */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">
              Document Title
            </label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="e.g. Employment Contract 2026"
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          {/* Expiry Date (Optional) */}
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">
              Expiry Date <span className="text-muted font-normal">(Optional)</span>
            </label>
            <input
              type="date"
              value={uploadExpiry}
              onChange={(e) => setUploadExpiry(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-bdr text-[12.5px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
            <p className="text-[11px] text-muted mt-1">
              Leave blank if permanent. Applies to passports, visas, or fixed-term contracts.
            </p>
          </div>
        </div>
      </Modal>

      {/* =========================================================================
          MODAL 1: PREVIEW PDF DOCUMENT MODAL (INTERACTIVE PDF VIEWER)
         ========================================================================= */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc ? `PDF Viewer: ${previewDoc.title}` : "Preview PDF"}
        size="xl"
        footer={
          <>
            <button
              type="button"
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-slate-50 font-medium cursor-pointer"
              onClick={() => setPreviewDoc(null)}
            >
              Close
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-navy text-white rounded-xl text-[13px] font-semibold hover:bg-navy/90 transition cursor-pointer shadow-xs"
              disabled={!previewDoc?.hasFile && !previewDoc?.fileId}
              onClick={() => {
                if (previewDoc) {
                  handleDownload(previewDoc);
                }
              }}
            >
              <Download size={15} />
              Download PDF File
            </button>
          </>
        }
      >
        {previewDoc && (
          <div className="flex flex-col gap-4">
            {/* Header summary */}
            <div className="bg-slate-50 border border-bdr rounded-2xl p-4 flex flex-wrap justify-between items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    PDF Document
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getCategoryColor(
                      previewDoc.category
                    )}`}
                  >
                    {previewDoc.category}
                  </span>
                  {getStatusBadge(previewDoc.status)}
                </div>
                <h3 className="text-[17px] font-bold text-slate-900 mt-1 leading-snug">
                  {previewDoc.title}
                </h3>
                <p className="text-[12.5px] text-muted mt-0.5">
                  Scope: <b className="text-slate-800">{previewDoc.employee}</b> • ID:{" "}
                  <b className="font-mono text-slate-800">{previewDoc.id}</b>
                </p>
              </div>

              <div className="text-right text-[12px] text-muted space-y-0.5">
                <div>File: <b className="text-slate-800">{previewDoc.fileName || "—"}</b> ({previewDoc.fileSize || "—"})</div>
                <div>Version: <b className="text-slate-800">{previewDoc.version}</b></div>
                <div>Updated: <b className="text-slate-800">{previewDoc.updatedOn}</b></div>
                <div>Expiry: <b className="text-slate-800">{previewDoc.expiry || "Permanent"}</b></div>
              </div>
            </div>

            {/* The stored file, fetched from the server */}
            {preview.url ? (
              <div className="border border-bdr rounded-2xl overflow-hidden bg-slate-100 shadow-inner">
                <iframe
                  src={preview.url}
                  title={previewDoc.title}
                  className="w-full h-[520px] rounded-2xl border-0"
                />
              </div>
            ) : (
              <div className="border border-bdr rounded-2xl bg-slate-50 p-12 text-center text-[13px] text-muted">
                {preview.loading
                  ? "Loading file…"
                  : preview.error
                  ? <span className="text-rose-700">{preview.error}</span>
                  : "No file is attached to this document."}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* =========================================================================
          MODAL 2: QUICK EDIT / REPLACE MODAL
         ========================================================================= */}
      <Modal
        isOpen={Boolean(editDoc)}
        onClose={() => { setEditDoc(null); setEditReplacement(null); }}
        title={editDoc ? `Edit: ${editDoc.title}` : "Edit"}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-slate-50 font-medium cursor-pointer"
              onClick={() => { setEditDoc(null); setEditReplacement(null); }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingEdit}
              className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-semibold hover:bg-navy/90 transition cursor-pointer shadow-xs disabled:opacity-60"
              onClick={handleSaveEdit}
            >
              {savingEdit ? "Saving…" : "Save Changes"}
            </button>
          </>
        }
      >
        {editDoc && (
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                Document Title
              </label>
              <input
                type="text"
                value={editDoc.title}
                onChange={(e) => setEditDoc({ ...editDoc, title: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={editDoc.category}
                  onChange={(e) => setEditDoc({ ...editDoc, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-bdr text-[12.5px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
                >
                  <option value="Policy">Policy</option>
                  <option value="Contract">Contract</option>
                  <option value="Identity">Identity</option>
                  <option value="Compliance">Compliance</option>
                  <option value="Security">Security</option>
                  <option value="Educational">Educational</option>
                  <option value="Financial">Financial</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[12px] font-semibold text-slate-700">
                    Assigned Scope / Employee
                  </label>
                  <MasterSourceLink source="employees" />
                </div>
                <select
                  value={editDoc.employee}
                  onChange={(e) => setEditDoc({ ...editDoc, employee: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-bdr text-[12.5px] bg-off focus:bg-white focus:outline-none focus:border-navy cursor-pointer"
                >
                  <option value="All Staff">All Staff</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={editDoc.expiryIso || ""}
                onChange={(e) => setEditDoc({ ...editDoc, expiryIso: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-bdr text-[12.5px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
              <p className="text-[11px] text-muted mt-1">
                Leave empty for a permanent document. Status (Valid / Expiring Soon / Expired) follows this date.
              </p>
            </div>

            {/* Replace this document's file (keeps the record, bumps the version) */}
            <div className="pt-2 border-t border-bdr">
              <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">
                Replace File ({editDoc.fileName || "no file attached"} · {editDoc.version})
              </label>
              <button
                type="button"
                onClick={() => replaceFileInputRef.current?.click()}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 border border-bdr rounded-xl text-[12.5px] font-semibold text-slate-800 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <UploadCloud size={16} />
                <span>{editReplacement ? `Selected: ${editReplacement.name}` : "Choose Replacement PDF from Device"}</span>
              </button>
              {editReplacement && (
                <p className="text-[11px] text-muted mt-1">
                  Uploaded when you save; the version becomes v{(parseInt(String(editDoc.version).replace(/^v/i, ""), 10) || 1) + 1}.0.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* =========================================================================
          MODAL 3: DELETE CONFIRMATION MODAL
         ========================================================================= */}
      <Modal
        isOpen={Boolean(deleteDocConfirm)}
        onClose={() => setDeleteDocConfirm(null)}
        title="Delete Document"
        size="md"
        footer={
          <>
            <button
              type="button"
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-slate-50 font-medium cursor-pointer"
              onClick={() => setDeleteDocConfirm(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[13px] font-semibold transition cursor-pointer shadow-xs"
              onClick={() => {
                if (deleteDocConfirm) handleDelete(deleteDocConfirm);
              }}
            >
              Confirm Delete
            </button>
          </>
        }
      >
        {deleteDocConfirm && (
          <div className="space-y-2">
            <p className="text-[13.5px] text-slate-700">
              Are you sure you want to permanently delete{" "}
              <b>"{deleteDocConfirm.title}"</b> (ID: {deleteDocConfirm.id})?
            </p>
            <p className="text-[12px] text-muted">
              This action will remove the PDF from active records.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export const Documents = DocumentsPage;
export default DocumentsPage;
