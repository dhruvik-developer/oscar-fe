import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppStore } from "../../../stores/appStore";
import { useAssetStore } from "../../../stores/assetStore";
import { describeError, isServerId } from "../../../services/hrmsSync";
import { toISODate } from "../../../utils/dateUtils";
import { Badge } from "../../../components/hrms/Badge";
import Modal from "../../../components/ui/Modal";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import MasterSourceLink from "../../../components/common/MasterSourceLink";
import {
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  Cpu,
  Headphones,
  Armchair,
  Box,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Wrench,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  Edit2,
  Trash2,
  Eye,
  History,
  Info,
  Send,
  Inbox,
  Check,
  X,
  ClipboardList,
  Loader2,
  RefreshCw,
  PackageCheck,
  PackagePlus,
} from "lucide-react";

const ASSET_STATUSES = ["Available", "Assigned", "Under Maintenance", "Under Repair", "Lost/Damaged", "Retired"];
const EDITABLE_STATUSES = ASSET_STATUSES.filter((s) => s !== "Assigned");
const CONDITIONS = ["Excellent", "Good", "Needs Repair"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const REQUEST_STATUSES = ["Pending", "Approved", "Fulfilled", "Rejected", "Cancelled"];

const LABEL = "block text-[12.5px] font-semibold text-slate-700 mb-1.5";
const INPUT = "w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy";
const FILTER_SELECT = "h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy";
const NEW_CATEGORY = "__new__";

const INACTIVE_EMPLOYEE = /terminat|inactive|resign|exit|relieved/i;

function emptyAssetForm() {
  return {
    name: "",
    category: "",
    serialNumber: "",
    status: "Available",
    condition: "Excellent",
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseCost: "",
    warrantyExpiry: "",
    notes: "",
    assignTo: "",
  };
}

function emptyRequestForm() {
  return {
    employeeId: "",
    requestType: "Inventory",
    requestedAssetId: "",
    itemName: "",
    category: "",
    priority: "Medium",
    justification: "",
  };
}

/** `2024-11-01T10:20:00Z` / `2024-11-01` → `01 Nov 2024`; anything else as given. */
function fmtDate(value) {
  if (!value) return "—";
  const str = String(value);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCost(value) {
  if (value === null || value === undefined || value === "" || value === "—") return "";
  const n = Number(String(value).replace(/[^0-9.-]+/g, ""));
  if (!Number.isFinite(n) || String(value).trim() === "") return String(value);
  return `₹${n.toLocaleString("en-IN")}`;
}

function shortId(id) {
  return `#${String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function initials(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function employeeLabel(emp) {
  const code = emp.employeeCode || emp.empId;
  const dept = emp.department || emp.dept;
  return `${emp.name}${code ? ` (${code})` : ""}${dept ? ` — ${dept}` : ""}`;
}

function getCategoryIcon(cat) {
  const c = String(cat || "").toLowerCase();
  if (c.includes("laptop")) return <Laptop size={15} className="text-blue-500" />;
  if (c.includes("monitor") || c.includes("display")) return <Monitor size={15} className="text-purple-500" />;
  if (c.includes("mobile") || c.includes("phone")) return <Smartphone size={15} className="text-emerald-500" />;
  if (c.includes("tablet")) return <Tablet size={15} className="text-indigo-500" />;
  if (c.includes("workstation") || c.includes("desktop") || c.includes("software")) return <Cpu size={15} className="text-orange-500" />;
  if (c.includes("audio") || c.includes("headphone") || c.includes("peripheral")) return <Headphones size={15} className="text-pink-500" />;
  if (c.includes("furniture") || c.includes("chair")) return <Armchair size={15} className="text-amber-500" />;
  if (c.includes("tool") || c.includes("safety")) return <Wrench size={15} className="text-slate-600" />;
  return <Box size={15} className="text-slate-500" />;
}

function getStatusBadge(status) {
  switch (status) {
    case "Assigned":
      return <Badge variant="green">Assigned</Badge>;
    case "Available":
      return <Badge variant="blue">Available</Badge>;
    case "Under Maintenance":
      return <Badge variant="yellow">Under Maintenance</Badge>;
    case "Under Repair":
      return <Badge variant="orange">Under Repair</Badge>;
    case "Lost/Damaged":
      return <Badge variant="red">Lost / Damaged</Badge>;
    default:
      return <Badge variant="gray">{status || "—"}</Badge>;
  }
}

function getReqPriorityBadge(priority) {
  switch (priority) {
    case "Urgent":
      return <Badge variant="red">Urgent</Badge>;
    case "High":
      return <Badge variant="orange">High</Badge>;
    case "Medium":
      return <Badge variant="yellow">Medium</Badge>;
    case "Low":
      return <Badge variant="blue">Low</Badge>;
    default:
      return <Badge variant="gray">{priority || "—"}</Badge>;
  }
}

function getReqStatusBadge(status) {
  switch (status) {
    case "Pending":
      return <Badge variant="yellow">Pending</Badge>;
    case "Approved":
      return <Badge variant="blue">Approved</Badge>;
    case "Fulfilled":
      return <Badge variant="green">Fulfilled</Badge>;
    case "Rejected":
      return <Badge variant="red">Rejected</Badge>;
    case "Cancelled":
      return <Badge variant="gray">Withdrawn</Badge>;
    default:
      return <Badge variant="gray">{status || "—"}</Badge>;
  }
}

/** Pick an existing category, or switch to typing a new one. */
function CategoryField({ value, onChange, options, required = false }) {
  const known = options.includes(value);
  const [custom, setCustom] = useState(Boolean(value) && !known);

  if (custom || options.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          required={required}
          autoFocus={custom}
          placeholder="Type a category, e.g. Laptop"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        />
        {options.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setCustom(false);
              onChange("");
            }}
            className="shrink-0 px-2.5 py-2 rounded-xl border border-bdr text-[11.5px] text-muted hover:text-navy hover:bg-off cursor-pointer"
          >
            Choose
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      required={required}
      value={known ? value : ""}
      onChange={(e) => {
        if (e.target.value === NEW_CATEGORY) {
          setCustom(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
      className={INPUT}
    >
      <option value="">Select category</option>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
      <option value={NEW_CATEGORY}>+ New category…</option>
    </select>
  );
}

export function AssetsPage() {
  const showToast = useAppStore((s) => s.showToast);
  const employees = useAppStore((s) => s.employees || []);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  const {
    assets = [],
    requests = [],
    categories = [],
    loading,
    loaded,
    hydrate,
    addAsset,
    updateAsset,
    deleteAsset,
    assignAsset,
    returnAsset,
    addRequest,
    approveRequest,
    rejectRequest,
    fulfillRequest,
  } = useAssetStore();

  // Tab State: 'inventory' | 'requests' (with URL query synchronization)
  const [activeTab, setActiveTab] = useState(tabParam === "requests" ? "requests" : "inventory");

  useEffect(() => {
    if (tabParam === "requests" && activeTab !== "requests") {
      setActiveTab("requests");
    } else if (tabParam === "inventory" && activeTab !== "inventory") {
      setActiveTab("inventory");
    }
  }, [tabParam, activeTab]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab === "requests") {
      setSearchParams({ tab: "requests" });
    } else {
      setSearchParams({});
    }
  };

  // In-flight action key, e.g. `${id}:approve` — disables the buttons it covers.
  const [busyKey, setBusyKey] = useState(null);

  async function run(key, fn, successMsg, failurePrefix) {
    setBusyKey(key);
    try {
      const result = await fn();
      if (successMsg) showToast(typeof successMsg === "function" ? successMsg(result) : successMsg);
      return result;
    } catch (err) {
      showToast(`${failurePrefix} — ${describeError(err)}`);
      return undefined;
    } finally {
      setBusyKey(null);
    }
  }

  // Search & Filters for Inventory
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");

  // Search & Filters for Requests
  const [reqSearch, setReqSearch] = useState("");
  const [reqStatusFilter, setReqStatusFilter] = useState("All");
  const [reqPriorityFilter, setReqPriorityFilter] = useState("All");
  const [reqTypeFilter, setReqTypeFilter] = useState("All");

  // Modals state (Inventory)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Modals state (Requests)
  const [isAddReqOpen, setIsAddReqOpen] = useState(false);
  const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [fulfillAssetId, setFulfillAssetId] = useState("");
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectRemark, setRejectRemark] = useState("");

  const [requestForm, setRequestForm] = useState(emptyRequestForm);

  // Selected item tracking (by id, so the modals follow the server's latest copy)
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) || null,
    [assets, selectedAssetId],
  );

  // Form states
  const [assetForm, setAssetForm] = useState(emptyAssetForm);
  const [assignForm, setAssignForm] = useState({ employeeId: "", notes: "" });
  const [returnForm, setReturnForm] = useState({ condition: "Good", notes: "" });

  // ── derived lists ─────────────────────────────────────────────────────────

  const activeEmployees = useMemo(
    () =>
      employees
        .filter((e) => isServerId(e.id) && !INACTIVE_EMPLOYEE.test(String(e.status || "")))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [employees],
  );
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const categoryNames = useMemo(() => {
    const names = new Set();
    categories.forEach((c) => c?.name && names.add(c.name));
    assets.forEach((a) => a.category && a.category !== "Uncategorised" && names.add(a.category));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [categories, assets]);

  const categoryFilterOptions = useMemo(() => {
    const names = new Set(categoryNames);
    if (assets.some((a) => a.category === "Uncategorised")) names.add("Uncategorised");
    return [...names];
  }, [categoryNames, assets]);

  const deptOptions = useMemo(() => {
    const names = new Set();
    assets.forEach((a) => a.dept && names.add(a.dept));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [assets]);

  // Filtered Assets
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      const matchesSearch =
        !q ||
        [a.name, a.assetCode, a.displayId, a.serialNumber, a.assignedTo, a.employeeCode, a.category]
          .some((v) => String(v || "").toLowerCase().includes(q));

      const matchesCat = categoryFilter === "All" || a.category === categoryFilter;
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Maintenance"
          ? a.status === "Under Maintenance" || a.status === "Under Repair"
          : a.status === statusFilter);
      const matchesDept = deptFilter === "All" || a.dept === deptFilter;

      return matchesSearch && matchesCat && matchesStatus && matchesDept;
    });
  }, [assets, search, categoryFilter, statusFilter, deptFilter]);

  // Statistics
  const total = assets.length;
  const assignedCount = assets.filter((a) => a.status === "Assigned").length;
  const availableCount = assets.filter((a) => a.status === "Available").length;
  const maintenanceCount = assets.filter((a) => a.status === "Under Maintenance" || a.status === "Under Repair").length;
  const lostDamagedCount = assets.filter((a) => a.status === "Lost/Damaged").length;

  const availableAssets = useMemo(() => assets.filter((a) => a.status === "Available"), [assets]);

  const availableByCategory = useMemo(() => {
    const groups = new Map();
    availableAssets.forEach((a) => {
      const key = a.category || "Uncategorised";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [availableAssets]);

  // Request Helpers & Statistics
  const filteredRequests = useMemo(() => {
    const q = reqSearch.trim().toLowerCase();
    return requests.filter((r) => {
      const matchesSearch =
        !q ||
        [
          r.employeeName, r.employeeCode, r.id, r.assetName, r.itemName, r.requestedAsset,
          r.requestedAssetCode, r.fulfilledAssetCode, r.category, r.dept,
        ].some((v) => String(v || "").toLowerCase().includes(q));

      const matchesStatus =
        reqStatusFilter === "All" ||
        (reqStatusFilter === "Closed"
          ? r.status === "Rejected" || r.status === "Cancelled"
          : r.status === reqStatusFilter);
      const matchesPriority = reqPriorityFilter === "All" || r.priority === reqPriorityFilter;
      const matchesType = reqTypeFilter === "All" || r.requestType === reqTypeFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesType;
    });
  }, [requests, reqSearch, reqStatusFilter, reqPriorityFilter, reqTypeFilter]);

  const reqCancelled = requests.filter((r) => r.status === "Cancelled").length;
  const reqTotal = requests.length;
  const reqActive = reqTotal - reqCancelled;
  const reqPending = requests.filter((r) => r.status === "Pending").length;
  const reqApproved = requests.filter((r) => r.status === "Approved").length;
  const reqFulfilled = requests.filter((r) => r.status === "Fulfilled").length;
  const reqRejected = requests.filter((r) => r.status === "Rejected").length;

  const isInitialLoad = loading && !loaded;

  // ── inventory handlers ────────────────────────────────────────────────────

  function handleOpenAdd() {
    setAssetForm({ ...emptyAssetForm(), category: categoryNames[0] || "" });
    setIsAddOpen(true);
  }

  async function handleSaveAdd(e) {
    e.preventDefault();
    if (!assetForm.name.trim()) return;
    const fields = { ...assetForm };
    const assignTo = fields.assignTo;
    delete fields.assignTo;

    const created = await run(
      "add",
      async () => {
        const row = await addAsset({ ...fields, name: fields.name.trim(), category: fields.category.trim() });
        let assignError = null;
        if (assignTo) {
          try {
            await assignAsset(row.id, { employeeId: assignTo, notes: "Issued on registration." });
          } catch (err) {
            assignError = describeError(err);
          }
        }
        return { row, assignError };
      },
      ({ row, assignError }) =>
        assignError
          ? `Asset ${row.displayId} registered, but not assigned — ${assignError}`
          : `Asset ${row.displayId} registered successfully`,
      "Asset not registered",
    );
    if (created) setIsAddOpen(false);
  }

  function handleOpenEdit(asset) {
    setSelectedAssetId(asset.id);
    setAssetForm({
      name: asset.name || "",
      category: asset.category && asset.category !== "Uncategorised" ? asset.category : "",
      serialNumber: asset.serialNumber || "",
      status: asset.status || "Available",
      condition: asset.condition || "Good",
      purchaseDate: toISODate(asset.purchaseDate) || "",
      purchaseCost: asset.purchaseCost ?? "",
      warrantyExpiry: toISODate(asset.warrantyExpiry) || "",
      notes: asset.notes || "",
      assignTo: "",
    });
    setIsEditOpen(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!selectedAsset) return;
    const fields = { ...assetForm };
    delete fields.assignTo;
    const saved = await run(
      "edit",
      () =>
        updateAsset(selectedAsset.id, {
          ...fields,
          name: fields.name.trim(),
          category: fields.category.trim(),
          categoryId: undefined,
        }),
      `Asset ${selectedAsset.displayId} updated`,
      "Asset not updated",
    );
    if (saved) setIsEditOpen(false);
  }

  function handleOpenAssign(asset) {
    setSelectedAssetId(asset.id);
    setAssignForm({ employeeId: "", notes: "" });
    setIsAssignOpen(true);
  }

  async function handleSaveAssign(e) {
    e.preventDefault();
    if (!selectedAsset || !assignForm.employeeId) return;
    const emp = employeeById.get(assignForm.employeeId);
    const saved = await run(
      "assign",
      () => assignAsset(selectedAsset.id, { employeeId: assignForm.employeeId, notes: assignForm.notes.trim() }),
      `Asset ${selectedAsset.displayId} assigned to ${emp?.name || "employee"}`,
      "Asset not assigned",
    );
    if (saved) setIsAssignOpen(false);
  }

  function handleOpenReturn(asset) {
    setSelectedAssetId(asset.id);
    setReturnForm({ condition: asset.condition || "Good", notes: "" });
    setIsReturnOpen(true);
  }

  async function handleSaveReturn(e) {
    e.preventDefault();
    if (!selectedAsset) return;
    const saved = await run(
      "return",
      () => returnAsset(selectedAsset.id, { condition: returnForm.condition, notes: returnForm.notes.trim() }),
      (row) =>
        row?.status === "Under Maintenance"
          ? `Asset ${selectedAsset.displayId} returned and sent to maintenance`
          : `Asset ${selectedAsset.displayId} returned to inventory`,
      "Asset not returned",
    );
    if (saved) setIsReturnOpen(false);
  }

  function handleOpenDetails(asset) {
    setSelectedAssetId(asset.id);
    setIsDetailsOpen(true);
  }

  function handleOpenDelete(asset) {
    setSelectedAssetId(asset.id);
    setIsDeleteOpen(true);
  }

  async function handleConfirmDelete() {
    if (!selectedAsset) return;
    const label = selectedAsset.displayId;
    setBusyKey("delete");
    try {
      await deleteAsset(selectedAsset.id);
      setIsDeleteOpen(false);
      setSelectedAssetId(null);
      showToast(`Asset ${label} deleted`);
    } catch (err) {
      showToast(`Asset not deleted — ${describeError(err)}`);
    } finally {
      setBusyKey(null);
    }
  }

  function showPendingFor(asset) {
    setReqSearch(asset.assetCode || asset.displayId || "");
    setReqStatusFilter("Pending");
    setReqTypeFilter("All");
    setReqPriorityFilter("All");
    handleTabChange("requests");
  }

  // ── request handlers ──────────────────────────────────────────────────────

  function handleOpenAddReq() {
    setRequestForm({
      ...emptyRequestForm(),
      requestType: availableAssets.length > 0 ? "Inventory" : "Other",
      category: categoryNames[0] || "",
    });
    setIsAddReqOpen(true);
  }

  async function handleSaveAddReq(e) {
    e.preventDefault();
    const f = requestForm;
    if (!f.employeeId) {
      showToast("Select the employee this request is for.");
      return;
    }
    if (f.requestType === "Inventory" && !f.requestedAssetId) {
      showToast("Select an available asset from inventory.");
      return;
    }
    if (f.requestType === "Other" && !f.itemName.trim()) {
      showToast("Enter the item being requested.");
      return;
    }
    if (!f.justification.trim()) {
      showToast("Enter a justification for the request.");
      return;
    }

    const payload = {
      employeeId: f.employeeId,
      requestType: f.requestType,
      priority: f.priority,
      justification: f.justification.trim(),
    };
    if (f.requestType === "Inventory") {
      payload.requestedAssetId = f.requestedAssetId;
    } else {
      payload.itemName = f.itemName.trim();
      const name = f.category.trim();
      const match = categories.find((c) => String(c.name || "").toLowerCase() === name.toLowerCase());
      if (match) payload.categoryId = match.id;
      else if (name) payload.categoryName = name;
    }

    const created = await run(
      "addReq",
      () => addRequest(payload),
      (row) => `Asset request ${shortId(row.id)} raised for ${row.employeeName || "employee"}`,
      "Request not submitted",
    );
    if (created) setIsAddReqOpen(false);
  }

  function handleApproveRequest(req) {
    const isInventory = req.requestType === "Inventory";
    run(
      `${req.id}:approve`,
      () => approveRequest(req.id),
      (row) =>
        row?.status === "Fulfilled"
          ? `${row.requestedAssetCode || row.fulfilledAssetCode || "Asset"} issued to ${row.employeeName}`
          : `Request ${shortId(req.id)} approved${isInventory ? "" : " — fulfil it from stock when ready"}`,
      "Request not approved",
    );
  }

  function handleOpenReject(req) {
    setRejectTarget(req);
    setRejectRemark("");
  }

  async function handleConfirmReject(e) {
    e.preventDefault();
    if (!rejectTarget) return;
    if (!rejectRemark.trim()) {
      showToast("Add a remark explaining the rejection.");
      return;
    }
    const saved = await run(
      `${rejectTarget.id}:reject`,
      () => rejectRequest(rejectTarget.id, rejectRemark.trim()),
      `Request ${shortId(rejectTarget.id)} rejected`,
      "Request not rejected",
    );
    if (saved) setRejectTarget(null);
  }

  // Available stock for the request being fulfilled, same category first.
  const fulfillCandidates = useMemo(() => {
    if (!selectedRequest) return { matching: [], others: [] };
    const sameCategory = (a) =>
      (selectedRequest.categoryId && a.categoryId === selectedRequest.categoryId) ||
      (selectedRequest.category && a.category === selectedRequest.category);
    return {
      matching: availableAssets.filter(sameCategory),
      others: availableAssets.filter((a) => !sameCategory(a)),
    };
  }, [selectedRequest, availableAssets]);

  function handleOpenFulfill(req) {
    setSelectedRequest(req);
    const sameCategory = availableAssets.find(
      (a) => (req.categoryId && a.categoryId === req.categoryId) || (req.category && a.category === req.category),
    );
    const requested = req.requestedAssetId && availableAssets.find((a) => a.id === req.requestedAssetId);
    setFulfillAssetId((requested || sameCategory)?.id || "");
    setIsFulfillModalOpen(true);
  }

  async function handleConfirmFulfill(e) {
    e.preventDefault();
    if (!selectedRequest || !fulfillAssetId) return;
    const asset = availableAssets.find((a) => a.id === fulfillAssetId);
    const saved = await run(
      `${selectedRequest.id}:fulfill`,
      () => fulfillRequest(selectedRequest.id, fulfillAssetId),
      `Request ${shortId(selectedRequest.id)} fulfilled with ${asset?.displayId || "asset"}`,
      "Request not fulfilled",
    );
    if (saved) setIsFulfillModalOpen(false);
  }

  const selectedReqUnit = useMemo(
    () => availableAssets.find((a) => a.id === requestForm.requestedAssetId) || null,
    [availableAssets, requestForm.requestedAssetId],
  );

  const requestEmployee = employeeById.get(requestForm.employeeId);

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        title="Asset Setup & Inventory"
        subtitle="Lifecycle management, hardware provisioning, allocations, repairs & return audits."
        guide={hrmsGuides.assets}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => hydrate?.()}
              disabled={loading}
              className="h-10 w-10 rounded-xl border border-bdr bg-white hover:bg-off grid place-items-center text-muted hover:text-navy transition cursor-pointer disabled:opacity-60"
              title="Refresh from server"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            {activeTab === "inventory" ? (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                Register Asset
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAddReq}
                className="px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                New Asset Request
              </button>
            )}
          </div>
        }
      />

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-bdr overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
        <button
          type="button"
          onClick={() => handleTabChange("inventory")}
          className={`pb-3 px-3 text-[14px] font-semibold transition-colors relative flex items-center gap-2 shrink-0 lg:shrink cursor-pointer ${
            activeTab === "inventory" ? "text-navy" : "text-muted hover:text-slate-700"
          }`}
        >
          <Box size={16} />
          <span>Asset Inventory</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {total}
          </span>
          {activeTab === "inventory" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("requests")}
          className={`pb-3 px-3 text-[14px] font-semibold transition-colors relative flex items-center gap-2 shrink-0 lg:shrink cursor-pointer ${
            activeTab === "requests" ? "text-navy" : "text-muted hover:text-slate-700"
          }`}
        >
          <ClipboardList size={16} />
          <span>Employee Requests</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
              reqPending > 0
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {reqPending > 0 ? `${reqPending} Pending` : reqTotal}
          </span>
          {activeTab === "requests" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t" />
          )}
        </button>
      </div>

      {/* INVENTORY TAB VIEW */}
      {activeTab === "inventory" && (
        <>
          {/* KPI Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {[
              { key: "All", label: "Total Assets", value: total, hint: "All registered units", icon: <Box size={16} className="text-slate-400" />, tone: "text-slate-900", ring: "border-navy ring-1 ring-navy/10" },
              { key: "Assigned", label: "Assigned", value: assignedCount, hint: "Active with staff", icon: <UserCheck size={16} className="text-emerald-500" />, tone: "text-emerald-600", ring: "border-emerald-500 ring-1 ring-emerald-500/10" },
              { key: "Available", label: "Available Stock", value: availableCount, hint: "Ready for deployment", icon: <CheckCircle2 size={16} className="text-blue-500" />, tone: "text-blue-600", ring: "border-blue-500 ring-1 ring-blue-500/10" },
              { key: "Maintenance", label: "Maintenance", value: maintenanceCount, hint: "Maintenance or repair", icon: <Wrench size={16} className="text-amber-500" />, tone: "text-amber-600", ring: "border-amber-500 ring-1 ring-amber-500/10" },
              { key: "Lost/Damaged", label: "Lost / Damaged", value: lostDamagedCount, hint: "Incident reported", icon: <AlertTriangle size={16} className="text-red-500" />, tone: "text-red-600", ring: "border-red-500 ring-1 ring-red-500/10" },
            ].map((card) => (
              <div
                key={card.key}
                onClick={() => setStatusFilter(card.key)}
                className={`bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer ${
                  statusFilter === card.key ? card.ring : "border-bdr hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-muted">{card.label}</span>
                  {card.icon}
                </div>
                <div className={`text-[22px] font-bold mt-1 ${card.tone}`}>{card.value}</div>
                <div className="text-[11px] text-muted mt-0.5">{card.hint}</div>
              </div>
            ))}
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by model, asset code, serial or assignee..."
                  className="pl-10 pr-4 h-9 w-full bg-off border border-bdr rounded-xl text-[13px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy"
                />
              </div>

              <div className="flex items-center gap-1.5 text-[12.5px]">
                <span className="text-muted font-medium">Category:</span>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={FILTER_SELECT}>
                  <option value="All">All Categories</option>
                  {categoryFilterOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-[12.5px]">
                <span className="text-muted font-medium">Status:</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={FILTER_SELECT}>
                  <option value="All">All Statuses</option>
                  {ASSET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="Maintenance">Maintenance + Repair</option>
                </select>
              </div>

              {deptOptions.length > 0 && (
                <div className="flex items-center gap-1.5 text-[12.5px]">
                  <span className="text-muted font-medium">Department:</span>
                  <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className={FILTER_SELECT}>
                    <option value="All">All Departments</option>
                    {deptOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {(search || categoryFilter !== "All" || statusFilter !== "All" || deptFilter !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("All");
                  setStatusFilter("All");
                  setDeptFilter("All");
                }}
                className="text-[12px] text-muted hover:text-navy underline cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Assets Inventory Table */}
          <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-[13px] border-collapse">
                <thead className="bg-off border-b border-bdr text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="py-3 px-5">Asset Details</th>
                    <th className="py-3 px-5">Asset ID</th>
                    <th className="py-3 px-5">Category</th>
                    <th className="py-3 px-5">Serial Number</th>
                    <th className="py-3 px-5">Assigned To</th>
                    <th className="py-3 px-5">Department</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/50">
                  {isInitialLoad ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted">
                        <Loader2 size={24} className="mx-auto animate-spin text-slate-400 mb-2" />
                        <p className="text-[13px]">Loading asset register…</p>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted">
                        <Box size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-medium text-slate-700 text-[14px]">
                          {assets.length === 0 ? "No assets registered yet." : "No assets match your search or filters."}
                        </p>
                        <p className="text-[12px] text-muted mt-0.5">
                          {assets.length === 0
                            ? "Click \"Register Asset\" to add the first unit to inventory."
                            : "Try resetting filters or registering a new asset unit."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const cost = fmtCost(r.purchaseCost);
                      return (
                        <tr key={r.id} className="hover:bg-off/60 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-off border border-bdr grid place-items-center shrink-0">
                                {getCategoryIcon(r.category)}
                              </div>
                              <div>
                                <div
                                  onClick={() => handleOpenDetails(r)}
                                  className="font-semibold text-slate-900 hover:text-navy cursor-pointer"
                                >
                                  {r.name}
                                </div>
                                <div className="text-[11.5px] text-muted flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span>{r.condition || "Good"} condition</span>
                                  {cost && (
                                    <>
                                      <span>•</span>
                                      <span>{cost}</span>
                                    </>
                                  )}
                                  {Number(r.pendingRequests) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => showPendingFor(r)}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold cursor-pointer hover:bg-amber-100"
                                      title="View pending requests for this unit"
                                    >
                                      <Clock size={10} /> {r.pendingRequests} pending request{Number(r.pendingRequests) === 1 ? "" : "s"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-5 font-mono text-[12px] font-semibold text-slate-700 whitespace-nowrap">
                            {r.displayId || r.assetCode || "—"}
                          </td>

                          <td className="py-3.5 px-5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-off border border-bdr rounded-lg text-[11.5px] font-medium text-slate-700 whitespace-nowrap">
                              {r.category || "Uncategorised"}
                            </span>
                          </td>

                          <td className="py-3.5 px-5 font-mono text-[12px] text-slate-600">
                            {r.serialNumber || "—"}
                          </td>

                          <td className="py-3.5 px-5">
                            {r.status === "Assigned" && r.assignedTo ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-navy/10 text-navy font-bold text-[10px] grid place-items-center shrink-0">
                                  {initials(r.assignedTo)}
                                </div>
                                <div>
                                  <div className="font-medium text-slate-900 text-[12.5px]">{r.assignedTo}</div>
                                  {r.employeeCode && (
                                    <div className="text-[10.5px] text-muted font-mono">{r.employeeCode}</div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted text-[12px] italic">Unassigned (Stock)</span>
                            )}
                          </td>

                          <td className="py-3.5 px-5 text-slate-700 text-[12.5px]">{r.dept || "—"}</td>

                          <td className="py-3.5 px-5">{getStatusBadge(r.status)}</td>

                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {r.status === "Assigned" ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReturn(r)}
                                  className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1"
                                  title="Return asset to inventory"
                                >
                                  <RotateCcw size={13} />
                                  Return
                                </button>
                              ) : r.status === "Available" ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAssign(r)}
                                  className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                                  title="Assign asset to employee"
                                >
                                  <UserCheck size={13} />
                                  Assign
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => handleOpenDetails(r)}
                                className="w-7 h-7 rounded-lg border border-bdr hover:bg-off grid place-items-center text-muted hover:text-slate-900 transition-colors cursor-pointer"
                                title="View Specifications & History"
                              >
                                <Eye size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEdit(r)}
                                className="w-7 h-7 rounded-lg border border-bdr hover:bg-off grid place-items-center text-muted hover:text-slate-900 transition-colors cursor-pointer"
                                title="Edit Details"
                              >
                                <Edit2 size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenDelete(r)}
                                className="w-7 h-7 rounded-lg border border-bdr hover:bg-red-50 text-muted hover:text-red-600 grid place-items-center transition-colors cursor-pointer"
                                title="Decommission / Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* REQUESTS TAB VIEW */}
      {activeTab === "requests" && (
        <>
          {/* Requests KPI Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {[
              { key: "All", label: "All Requests", value: reqTotal, hint: reqCancelled > 0 ? `${reqActive} active · ${reqCancelled} withdrawn` : "Submitted requisitions", icon: <ClipboardList size={16} className="text-slate-400" />, tone: "text-slate-900", ring: "border-navy ring-1 ring-navy/10" },
              { key: "Pending", label: "Pending Review", value: reqPending, hint: "Awaiting HR / IT action", icon: <Clock size={16} className="text-amber-500" />, tone: "text-amber-600", ring: "border-amber-500 ring-1 ring-amber-500/10" },
              { key: "Approved", label: "Approved", value: reqApproved, hint: "Awaiting fulfilment from stock", icon: <CheckCircle2 size={16} className="text-blue-500" />, tone: "text-blue-600", ring: "border-blue-500 ring-1 ring-blue-500/10" },
              { key: "Fulfilled", label: "Fulfilled", value: reqFulfilled, hint: "Asset handed over", icon: <UserCheck size={16} className="text-emerald-500" />, tone: "text-emerald-600", ring: "border-emerald-500 ring-1 ring-emerald-500/10" },
              { key: "Closed", label: "Rejected / Withdrawn", value: reqRejected + reqCancelled, hint: `${reqRejected} rejected · ${reqCancelled} withdrawn`, icon: <AlertTriangle size={16} className="text-red-500" />, tone: "text-red-600", ring: "border-red-500 ring-1 ring-red-500/10" },
            ].map((card) => (
              <div
                key={card.key}
                onClick={() => setReqStatusFilter(card.key)}
                className={`bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer ${
                  reqStatusFilter === card.key ? card.ring : "border-bdr hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-muted">{card.label}</span>
                  {card.icon}
                </div>
                <div className={`text-[22px] font-bold mt-1 ${card.tone}`}>{card.value}</div>
                <div className="text-[11px] text-muted mt-0.5">{card.hint}</div>
              </div>
            ))}
          </div>

          {/* Requests Search & Filters Toolbar */}
          <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={reqSearch}
                  onChange={(e) => setReqSearch(e.target.value)}
                  placeholder="Search by employee, item, asset code, department..."
                  className="pl-10 pr-4 h-9 w-full bg-off border border-bdr rounded-xl text-[13px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy"
                />
              </div>

              <div className="flex items-center gap-1.5 text-[12.5px]">
                <span className="text-muted font-medium">Type:</span>
                <select value={reqTypeFilter} onChange={(e) => setReqTypeFilter(e.target.value)} className={FILTER_SELECT}>
                  <option value="All">All Types</option>
                  <option value="Inventory">From Inventory</option>
                  <option value="Other">Other Request</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-[12.5px]">
                <span className="text-muted font-medium">Status:</span>
                <select value={reqStatusFilter} onChange={(e) => setReqStatusFilter(e.target.value)} className={FILTER_SELECT}>
                  <option value="All">All Statuses</option>
                  {REQUEST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s === "Cancelled" ? "Withdrawn" : s}
                    </option>
                  ))}
                  <option value="Closed">Rejected + Withdrawn</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-[12.5px]">
                <span className="text-muted font-medium">Priority:</span>
                <select value={reqPriorityFilter} onChange={(e) => setReqPriorityFilter(e.target.value)} className={FILTER_SELECT}>
                  <option value="All">All Priorities</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(reqSearch || reqStatusFilter !== "All" || reqPriorityFilter !== "All" || reqTypeFilter !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setReqSearch("");
                  setReqStatusFilter("All");
                  setReqPriorityFilter("All");
                  setReqTypeFilter("All");
                }}
                className="text-[12px] text-muted hover:text-navy underline cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Requests Table */}
          <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-[13px] border-collapse">
                <thead className="bg-off border-b border-bdr text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="py-3 px-5">Request</th>
                    <th className="py-3 px-5">Employee</th>
                    <th className="py-3 px-5">Type</th>
                    <th className="py-3 px-5">Requested Item</th>
                    <th className="py-3 px-5">Priority</th>
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/50">
                  {isInitialLoad ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted">
                        <Loader2 size={24} className="mx-auto animate-spin text-slate-400 mb-2" />
                        <p className="text-[13px]">Loading requests…</p>
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted">
                        <Inbox size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-medium text-slate-700 text-[14px]">
                          {requests.length === 0 ? "No asset requests yet." : "No employee requests match your filters."}
                        </p>
                        <p className="text-[12px] text-muted mt-0.5">
                          Employees raise requests from the Employee Portal; HR can also click &quot;New Asset Request&quot; above.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => {
                      const isInventory = req.requestType === "Inventory";
                      const unitUnavailable =
                        isInventory && req.status === "Pending" && req.requestedAssetStatus && req.requestedAssetStatus !== "Available";
                      const busy = busyKey && busyKey.startsWith(`${req.id}:`);
                      const decided = ["Approved", "Fulfilled", "Rejected", "Cancelled"].includes(req.status);
                      return (
                        <tr key={req.id} className="hover:bg-off/60 transition-colors align-top">
                          <td className="py-3.5 px-5">
                            <div className="font-mono text-[12px] font-semibold text-slate-700" title={req.id}>
                              {shortId(req.id)}
                            </div>
                          </td>

                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-navy/10 text-navy font-bold text-[11px] grid place-items-center shrink-0">
                                {initials(req.employeeName || "E")}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 text-[12.5px]">{req.employeeName || "—"}</div>
                                <div className="text-[11px] text-muted flex items-center gap-1.5 flex-wrap">
                                  {req.employeeCode && <span className="font-mono">{req.employeeCode}</span>}
                                  {req.employeeCode && req.dept && <span>•</span>}
                                  {req.dept && <span>{req.dept}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-5 whitespace-nowrap">
                            {isInventory ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200 text-[11px] font-semibold">
                                <PackageCheck size={12} /> From Inventory
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold">
                                <PackagePlus size={12} /> Other
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-5">
                            <div className="max-w-xs">
                              <div className="font-medium text-slate-900 text-[13px]">{req.assetName || req.itemName || "—"}</div>
                              <div className="text-[11px] text-muted flex flex-wrap items-center gap-1.5 mt-0.5">
                                {isInventory && req.requestedAssetCode && (
                                  <span className="font-mono font-semibold text-slate-600">{req.requestedAssetCode}</span>
                                )}
                                {req.category && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-off border border-bdr rounded text-[10.5px] text-slate-700">
                                    {getCategoryIcon(req.category)}
                                    {req.category}
                                  </span>
                                )}
                              </div>
                              {isInventory && req.status === "Pending" && (
                                unitUnavailable ? (
                                  <div className="text-[10.5px] text-amber-700 mt-1 flex items-center gap-1">
                                    <AlertTriangle size={11} /> No longer available — now {req.requestedAssetStatus}
                                  </div>
                                ) : req.requestedAssetStatus === "Available" ? (
                                  <div className="text-[10.5px] text-emerald-700 mt-1 flex items-center gap-1">
                                    <CheckCircle2 size={11} /> In stock — available to issue
                                  </div>
                                ) : null
                              )}
                              {req.justification && (
                                <div className="text-[11.5px] text-muted line-clamp-2 mt-1" title={req.justification}>
                                  {req.justification}
                                </div>
                              )}
                              {req.status === "Fulfilled" && (req.fulfilledAssetCode || req.fulfilledAsset) && (
                                <div className="text-[10.5px] text-emerald-700 font-mono mt-1 flex items-center gap-1">
                                  <CheckCircle2 size={11} /> Issued: {req.fulfilledAssetCode || req.fulfilledAsset}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-5">{getReqPriorityBadge(req.priority)}</td>

                          <td className="py-3.5 px-5 text-slate-600 text-[12px] whitespace-nowrap">
                            {req.requestedDate || fmtDate(req.createdAt)}
                          </td>

                          <td className="py-3.5 px-5">
                            {getReqStatusBadge(req.status)}
                            {decided && (req.approverName || req.decidedAt) && (
                              <div className="text-[10.5px] text-muted mt-1 whitespace-nowrap">
                                {req.approverName ? `by ${req.approverName}` : ""}
                                {req.decidedAt ? ` · ${fmtDate(req.decidedAt)}` : ""}
                              </div>
                            )}
                            {req.remark && (
                              <div className="text-[10.5px] text-slate-600 italic mt-0.5 max-w-[180px] line-clamp-2" title={req.remark}>
                                &ldquo;{req.remark}&rdquo;
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-5 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              {req.status === "Pending" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveRequest(req)}
                                    disabled={Boolean(busy) || unitUnavailable}
                                    className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    title={
                                      unitUnavailable
                                        ? "The requested unit is no longer available — reject this request"
                                        : isInventory
                                          ? "Approve and issue the requested unit to the employee"
                                          : "Approve requisition"
                                    }
                                  >
                                    {busyKey === `${req.id}:approve` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                    {isInventory ? "Approve & Issue" : "Approve"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReject(req)}
                                    disabled={Boolean(busy)}
                                    className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                    title="Reject requisition"
                                  >
                                    <X size={13} />
                                    Reject
                                  </button>
                                </>
                              )}

                              {req.status === "Approved" && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenFulfill(req)}
                                  disabled={Boolean(busy)}
                                  className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                  title="Issue an available unit from stock"
                                >
                                  <UserCheck size={13} />
                                  Fulfill
                                </button>
                              )}

                              {!["Pending", "Approved"].includes(req.status) && (
                                <span className="text-[11px] text-muted">—</span>
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
          </div>
        </>
      )}

      {/* MODAL 1: ADD ASSET */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Register Company Asset" size="lg">
        <form onSubmit={handleSaveAdd} className="flex flex-col gap-4">
          <div>
            <label className={LABEL}>
              Asset Name / Model Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. MacBook Pro 16 M3 Max or Dell UltraSharp 32"
              value={assetForm.name}
              onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              className={`${INPUT} text-[13.5px]`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={LABEL}>Category</label>
              <CategoryField
                value={assetForm.category}
                options={categoryNames}
                onChange={(category) => setAssetForm((f) => ({ ...f, category }))}
              />
            </div>

            <div>
              <label className={LABEL}>Serial / Tag Number</label>
              <input
                type="text"
                placeholder="e.g. C02G41ABMD6M"
                value={assetForm.serialNumber}
                onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                className={`${INPUT} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={LABEL}>Initial Status</label>
              <select
                value={assetForm.status}
                onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value, assignTo: e.target.value === "Available" ? assetForm.assignTo : "" })}
                className={INPUT}
              >
                {EDITABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "Available" ? "Available (In Stock)" : s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL}>Condition</label>
              <select
                value={assetForm.condition}
                onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value })}
                className={INPUT}
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {assetForm.status === "Available" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[12.5px] font-semibold text-slate-700">Issue Immediately To (optional)</label>
                <MasterSourceLink source="employees" />
              </div>
              <select
                value={assetForm.assignTo}
                onChange={(e) => setAssetForm({ ...assetForm, assignTo: e.target.value })}
                className={INPUT}
              >
                <option value="">Keep in stock</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {employeeLabel(emp)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className={LABEL}>Purchase Date</label>
              <input
                type="date"
                value={assetForm.purchaseDate}
                onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>Purchase Cost (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 145000"
                value={assetForm.purchaseCost}
                onChange={(e) => setAssetForm({ ...assetForm, purchaseCost: e.target.value })}
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>Warranty Expiry</label>
              <input
                type="date"
                value={assetForm.warrantyExpiry}
                onChange={(e) => setAssetForm({ ...assetForm, warrantyExpiry: e.target.value })}
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Hardware Notes / Specs</label>
            <textarea
              rows={2}
              placeholder="e.g. 32GB RAM, 1TB NVMe, AppleCare+ extended warranty included."
              value={assetForm.notes}
              onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
              className={INPUT}
            />
          </div>

          <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busyKey === "add"}
              className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              {busyKey === "add" && <Loader2 size={14} className="animate-spin" />}
              Register Asset
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT ASSET */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Asset: ${selectedAsset?.displayId || ""}`}
        size="lg"
      >
        <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
          <div>
            <label className={LABEL}>Asset Description</label>
            <input
              type="text"
              required
              value={assetForm.name}
              onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              className={`${INPUT} text-[13.5px]`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={LABEL}>Category</label>
              <CategoryField
                value={assetForm.category}
                options={categoryNames}
                onChange={(category) => setAssetForm((f) => ({ ...f, category }))}
              />
            </div>

            <div>
              <label className={LABEL}>Serial Number</label>
              <input
                type="text"
                value={assetForm.serialNumber}
                onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                className={`${INPUT} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={LABEL}>Status</label>
              {selectedAsset?.status === "Assigned" ? (
                <>
                  <input
                    type="text"
                    readOnly
                    value={`Assigned to ${selectedAsset.assignedTo || "employee"}`}
                    className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-slate-100 text-slate-600 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-muted mt-1">Use &quot;Return&quot; to bring it back to stock.</p>
                </>
              ) : (
                <select
                  value={assetForm.status}
                  onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value })}
                  className={INPUT}
                >
                  {EDITABLE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className={LABEL}>Condition</label>
              <select
                value={assetForm.condition}
                onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value })}
                className={INPUT}
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className={LABEL}>Purchase Date</label>
              <input
                type="date"
                value={assetForm.purchaseDate}
                onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>Purchase Cost (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={assetForm.purchaseCost}
                onChange={(e) => setAssetForm({ ...assetForm, purchaseCost: e.target.value })}
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>Warranty Expiry</label>
              <input
                type="date"
                value={assetForm.warrantyExpiry}
                onChange={(e) => setAssetForm({ ...assetForm, warrantyExpiry: e.target.value })}
                className={INPUT}
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Notes</label>
            <textarea
              rows={2}
              value={assetForm.notes}
              onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
              className={INPUT}
            />
          </div>

          <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busyKey === "edit"}
              className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              {busyKey === "edit" && <Loader2 size={14} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: ASSIGN ASSET */}
      <Modal isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} title={`Assign Asset: ${selectedAsset?.name || ""}`}>
        <form onSubmit={handleSaveAssign} className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5 text-[12.5px] text-blue-900">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              Allocating <span className="font-semibold">{selectedAsset?.displayId}</span> ({selectedAsset?.name}). An assignment entry is written to the custody log automatically.
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[12.5px] font-semibold text-slate-700">
                Select Employee <span className="text-red-500">*</span>
              </label>
              <MasterSourceLink source="employees" />
            </div>
            <select
              required
              value={assignForm.employeeId}
              onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}
              className={INPUT}
            >
              <option value="">Select Employee</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {employeeLabel(emp)}
                </option>
              ))}
            </select>
            {activeEmployees.length === 0 && (
              <p className="text-[11.5px] text-amber-700 mt-1">No active employees loaded yet.</p>
            )}
          </div>

          <div>
            <label className={LABEL}>Department</label>
            <input
              type="text"
              readOnly
              value={employeeById.get(assignForm.employeeId)?.department || "—"}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-slate-100 text-slate-600 cursor-not-allowed"
            />
          </div>

          <div>
            <label className={LABEL}>Handover Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Handed over with charger, power cable and sleeve."
              value={assignForm.notes}
              onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
              className={INPUT}
            />
          </div>

          <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsAssignOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busyKey === "assign" || !assignForm.employeeId}
              className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-[13px] font-medium hover:bg-emerald-700 cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              {busyKey === "assign" ? <Loader2 size={15} className="animate-spin" /> : <UserCheck size={15} />}
              Confirm Assignment
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: RETURN ASSET */}
      <Modal isOpen={isReturnOpen} onClose={() => setIsReturnOpen(false)} title={`Return Asset: ${selectedAsset?.name || ""}`}>
        <form onSubmit={handleSaveReturn} className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100 flex items-start gap-2.5 text-[12.5px] text-amber-900">
            <RotateCcw size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              Returning <span className="font-semibold">{selectedAsset?.displayId}</span> from{" "}
              <span className="font-semibold">{selectedAsset?.assignedTo || "employee"}</span> to inventory stock.
            </div>
          </div>

          <div>
            <label className={LABEL}>Inspection Condition</label>
            <select
              value={returnForm.condition}
              onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })}
              className={INPUT}
            >
              <option value="Excellent">Excellent (No defects)</option>
              <option value="Good">Good (Normal wear)</option>
              <option value="Needs Repair">Needs Repair (Sent to maintenance)</option>
            </select>
          </div>

          <div>
            <label className={LABEL}>Check-in Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Checked all ports and display; wiped clean and returned to stock."
              value={returnForm.notes}
              onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
              className={INPUT}
            />
          </div>

          <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsReturnOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busyKey === "return"}
              className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              {busyKey === "return" ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
              Confirm Return
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: ASSET DETAILS & HISTORY */}
      <Modal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="Asset Specifications & History" size="lg">
        {selectedAsset && (
          <div className="flex flex-col gap-5">
            {/* Asset Headline */}
            <div className="flex flex-wrap items-start justify-between gap-3 p-4 bg-off border border-bdr rounded-2xl">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-white border border-bdr grid place-items-center shrink-0">
                  {getCategoryIcon(selectedAsset.category)}
                </div>
                <div>
                  <h3 className="font-bold text-[16px] text-slate-900">{selectedAsset.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="font-mono text-[12px] bg-white border border-bdr px-2 py-0.5 rounded-md font-semibold text-slate-700">
                      {selectedAsset.displayId}
                    </span>
                    <span className="text-[12px] text-muted">•</span>
                    <span className="text-[12px] text-muted">{selectedAsset.category}</span>
                  </div>
                </div>
              </div>
              <div>{getStatusBadge(selectedAsset.status)}</div>
            </div>

            {/* Spec Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Serial Number", value: selectedAsset.serialNumber || "—", mono: true },
                {
                  label: "Assigned Holder",
                  value:
                    selectedAsset.status === "Assigned"
                      ? `${selectedAsset.assignedTo || "—"}${selectedAsset.employeeCode ? ` (${selectedAsset.employeeCode})` : ""}`
                      : "In Stock",
                },
                { label: "Department", value: selectedAsset.dept || "—" },
                { label: "Condition", value: selectedAsset.condition || "—" },
                { label: "Purchase Date", value: selectedAsset.purchaseDate || "—" },
                { label: "Purchase Cost", value: fmtCost(selectedAsset.purchaseCost) || "—" },
                { label: "Warranty Expiry", value: selectedAsset.warrantyExpiry || "—" },
                { label: "Pending Requests", value: String(selectedAsset.pendingRequests || 0) },
              ].map((item) => (
                <div key={item.label} className="p-3 bg-white border border-bdr rounded-xl">
                  <div className="text-[11px] text-muted uppercase font-semibold">{item.label}</div>
                  <div className={`font-medium text-[12.5px] text-slate-900 mt-1 truncate ${item.mono ? "font-mono" : ""}`} title={item.value}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            {selectedAsset.notes && (
              <div className="p-3.5 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 whitespace-pre-wrap">
                <span className="font-semibold text-slate-900">Notes &amp; Specs: </span>
                {selectedAsset.notes}
              </div>
            )}

            {/* History Timeline */}
            <div>
              <h4 className="font-bold text-[13.5px] text-slate-900 flex items-center gap-1.5 mb-3">
                <History size={15} className="text-navy" />
                Custody Log
              </h4>

              {(selectedAsset.history || []).length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-bdr text-center text-[12px] text-muted">
                  This unit has never been assigned.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {(selectedAsset.history || []).map((h, idx) => (
                    <div
                      key={h.id || idx}
                      className="p-3 rounded-xl border border-bdr bg-white flex flex-wrap items-start justify-between gap-3 text-[12px]"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800">
                          Assigned to {h.employeeName || h.employee || "employee"}
                        </div>
                        <div className="text-muted mt-0.5">
                          {h.returnedAt ? (
                            <>
                              Returned {fmtDate(h.returnedAt)}
                              {h.returnedCondition ? ` · Condition: ${h.returnedCondition}` : ""}
                            </>
                          ) : (
                            <span className="text-emerald-700 font-medium">Currently held</span>
                          )}
                        </div>
                        {h.notes && <div className="text-muted mt-0.5 whitespace-pre-wrap">{h.notes}</div>}
                      </div>
                      <div className="text-right shrink-0 text-muted">
                        <div>{fmtDate(h.assignedAt)}</div>
                        {h.assignedBy && <div className="text-[11px]">by {h.assignedBy}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-bdr">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 6: DELETE CONFIRMATION */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Decommission Asset">
        <div className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[12.5px] text-red-900">
            <AlertTriangle size={17} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              Are you sure you want to decommission / delete{" "}
              <span className="font-bold text-red-950">{selectedAsset?.displayId}</span> ({selectedAsset?.name})? This permanently removes the asset and its custody log.
              {selectedAsset?.status === "Assigned" && (
                <div className="mt-1 font-semibold">This unit is currently assigned to {selectedAsset.assignedTo}.</div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={busyKey === "delete"}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[13px] font-medium cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              {busyKey === "delete" && <Loader2 size={14} className="animate-spin" />}
              Delete Asset
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 7: NEW ASSET REQUEST (raised by HR on behalf of an employee) */}
      <Modal
        isOpen={isAddReqOpen}
        onClose={() => setIsAddReqOpen(false)}
        title="Raise Asset Request for Employee"
        size="lg"
      >
        <form onSubmit={handleSaveAddReq} className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[12.5px] font-semibold text-slate-700">
                Employee <span className="text-red-500">*</span>
              </label>
              <MasterSourceLink source="employees" />
            </div>
            <select
              required
              value={requestForm.employeeId}
              onChange={(e) => setRequestForm({ ...requestForm, employeeId: e.target.value })}
              className={INPUT}
            >
              <option value="">Select Employee</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {employeeLabel(emp)}
                </option>
              ))}
            </select>
            {requestEmployee && (
              <p className="text-[11.5px] text-muted mt-1">
                {requestEmployee.designation || requestEmployee.role || "Staff"} · {requestEmployee.department || "—"}
              </p>
            )}
          </div>

          {/* Mode switch */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-off border border-bdr rounded-xl">
            {[
              { id: "Inventory", label: "From Inventory", icon: <PackageCheck size={14} /> },
              { id: "Other", label: "Other Asset Request", icon: <PackagePlus size={14} /> },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setRequestForm({ ...requestForm, requestType: m.id })}
                className={`h-9 rounded-lg text-[12.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  requestForm.requestType === m.id ? "bg-white text-navy shadow-xs border border-bdr" : "text-muted hover:text-slate-800"
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          {requestForm.requestType === "Inventory" ? (
            availableAssets.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  No units are <strong>Available</strong> in inventory right now. Switch to &quot;Other Asset Request&quot; to request something that is not in stock.
                </div>
              </div>
            ) : (
              <div>
                <label className={LABEL}>
                  Available Unit <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={requestForm.requestedAssetId}
                  onChange={(e) => setRequestForm({ ...requestForm, requestedAssetId: e.target.value })}
                  className={INPUT}
                >
                  <option value="">Choose an available unit…</option>
                  {availableByCategory.map(([cat, list]) => (
                    <optgroup key={cat} label={`${cat} (${list.length})`}>
                      {list.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.displayId} — {a.name} ({a.condition || "Good"})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {selectedReqUnit && (
                  <p className="text-[11.5px] text-muted mt-1">
                    {selectedReqUnit.category} · Serial {selectedReqUnit.serialNumber || "N/A"} · {selectedReqUnit.condition || "Good"} condition
                  </p>
                )}
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={LABEL}>
                  Item Requested <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 27-inch 4K monitor"
                  value={requestForm.itemName}
                  onChange={(e) => setRequestForm({ ...requestForm, itemName: e.target.value })}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Category</label>
                <CategoryField
                  value={requestForm.category}
                  options={categoryNames}
                  onChange={(category) => setRequestForm((f) => ({ ...f, category }))}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className={LABEL}>Priority</label>
              <select
                value={requestForm.priority}
                onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}
                className={INPUT}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>
                Business Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Why is this equipment necessary?"
                value={requestForm.justification}
                onChange={(e) => setRequestForm({ ...requestForm, justification: e.target.value })}
                className={`${INPUT} resize-none`}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsAddReqOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busyKey === "addReq" || (requestForm.requestType === "Inventory" && availableAssets.length === 0)}
              className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              {busyKey === "addReq" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit Request
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 8: FULFILL REQUEST FROM INVENTORY */}
      <Modal
        isOpen={isFulfillModalOpen}
        onClose={() => setIsFulfillModalOpen(false)}
        title="Fulfill Asset Requisition"
        size="md"
      >
        <form onSubmit={handleConfirmFulfill} className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-bdr text-[12.5px] text-slate-700 space-y-1">
            <div>
              <span className="font-semibold text-slate-900">Requester: </span>
              {selectedRequest?.employeeName}
              {selectedRequest?.employeeCode ? ` (${selectedRequest.employeeCode})` : ""}
              {selectedRequest?.dept ? ` · ${selectedRequest.dept}` : ""}
            </div>
            <div>
              <span className="font-semibold text-slate-900">Requested: </span>
              {selectedRequest?.assetName || selectedRequest?.itemName}
              {selectedRequest?.category ? ` (${selectedRequest.category})` : ""}
            </div>
            {selectedRequest?.justification && (
              <div className="text-muted text-[11.5px] pt-1 italic">&ldquo;{selectedRequest.justification}&rdquo;</div>
            )}
          </div>

          {availableAssets.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                There are currently no assets with <strong>&quot;Available&quot;</strong> status in stock.
                Register a new asset or return an existing one to fulfil this request.
              </div>
            </div>
          ) : (
            <div>
              <label className={LABEL}>
                Select Available Stock Asset <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={fulfillAssetId}
                onChange={(e) => setFulfillAssetId(e.target.value)}
                className={`${INPUT} py-2.5`}
              >
                <option value="">Choose asset to allocate...</option>
                {fulfillCandidates.matching.length > 0 && (
                  <optgroup label={`Matching category${selectedRequest?.category ? ` — ${selectedRequest.category}` : ""}`}>
                    {fulfillCandidates.matching.map((ast) => (
                      <option key={ast.id} value={ast.id}>
                        {ast.displayId} — {ast.name} [SN: {ast.serialNumber || "N/A"}]
                      </option>
                    ))}
                  </optgroup>
                )}
                {fulfillCandidates.others.length > 0 && (
                  <optgroup label="Other available stock">
                    {fulfillCandidates.others.map((ast) => (
                      <option key={ast.id} value={ast.id}>
                        {ast.displayId} — {ast.name} ({ast.category}) [SN: {ast.serialNumber || "N/A"}]
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="text-[11.5px] text-muted mt-1.5">
                The selected unit is assigned to {selectedRequest?.employeeName} and the request is marked <strong>&quot;Fulfilled&quot;</strong>.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsFulfillModalOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={availableAssets.length === 0 || !fulfillAssetId || Boolean(busyKey)}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-[13px] font-medium cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              {busyKey && selectedRequest && busyKey === `${selectedRequest.id}:fulfill` ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Confirm Allocation
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 9: REJECT REQUEST */}
      <Modal isOpen={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject Asset Request" size="md">
        <form onSubmit={handleConfirmReject} className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[12.5px] text-red-900">
            Rejecting <span className="font-semibold">{rejectTarget?.assetName || rejectTarget?.itemName}</span> requested by{" "}
            <span className="font-semibold">{rejectTarget?.employeeName}</span>. The employee sees your remark in their portal.
          </div>
          <div>
            <label className={LABEL}>
              Remark <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              autoFocus
              placeholder="e.g. Unit reserved for the new joiners batch; please request a standard laptop instead."
              value={rejectRemark}
              onChange={(e) => setRejectRemark(e.target.value)}
              className={`${INPUT} resize-none`}
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setRejectTarget(null)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={Boolean(busyKey)}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[13px] font-medium cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              {busyKey && rejectTarget && busyKey === `${rejectTarget.id}:reject` ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <X size={14} />
              )}
              Reject Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export const Assets = AssetsPage;
export default AssetsPage;
