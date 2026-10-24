import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Layers,
  CheckCircle2,
  FlaskConical,
  Trash2,
  RefreshCw,
  Undo2,
  ShieldCheck,
  XCircle,
  Plus,
  Download,
  Search,
  Filter,
  Calendar,
  Warehouse,
  Info,
  Clock,
  ArrowRight,
  AlertCircle,
  Eye,
  ChevronDown,
  Printer,
  RotateCcw,
  Check,
  X,
  User,
  Settings,
  LogOut,
  Bell,
  History,
} from 'lucide-react';
import { SignatureSlot, useDocumentSignatures } from '../../components/common/SignatureSlot';
import { inventoryService } from '../../services/domainServices';
import { useERP } from '../../context/ERPContext';
import PageInfoButton from '../../components/ui/PageInfoButton';
import MasterSourceLink from '../../components/common/MasterSourceLink';

// Indian Currency Helper
function formatINR(val) {
  if (val === null || val === undefined || isNaN(val)) return '₹ 0';
  const num = Math.round(Number(val));
  return '₹ ' + num.toLocaleString('en-IN');
}

// Quantity Helper
function formatQty(val, uom = 'Mtr') {
  if (val === null || val === undefined) return '0.00 Mtr';
  const num = Number(val);
  if (isNaN(num)) return '0.00 Mtr';
  const displayUom = !uom || uom === 'Mixed' ? 'Mtr' : uom;
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${displayUom}`;
}

// Convert dataset to CSV and trigger browser download
function exportToCsv(filename, rows) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map((row) =>
        keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
          })
          .join(separator)
      )
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Searchable Dropdown with Checkboxes Component
function MultiSearchDropdown({
  label,
  options = [],
  selected = [],
  onChange,
  placeholder = 'All',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return options;
    return options.filter((opt) => opt.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((item) => item !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const isAllSelected = selected.length === 0;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-3 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs flex items-center gap-1.5 min-w-[110px] justify-between cursor-pointer"
      >
        <span className="truncate max-w-[90px]">
          {isAllSelected ? label : selected.length === 1 ? selected[0] : `${label} (${selected.length})`}
        </span>
        <ChevronDown size={12} className="text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full h-7 pl-7 pr-2 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-44 overflow-y-auto space-y-0.5 pt-1">
            <label
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer font-medium text-slate-700"
              onClick={() => {
                onChange([]);
                setIsOpen(false);
              }}
            >
              <input
                type="checkbox"
                checked={isAllSelected}
                readOnly
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span>All ({label})</span>
            </label>

            {filtered.map((opt) => {
              const isChecked = selected.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer font-normal text-slate-800"
                  onClick={() => toggleOption(opt)}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                  />
                  <span className="truncate">{opt}</span>
                </label>
              );
            })}

            {filtered.length === 0 && (
              <div className="py-3 text-center text-slate-400 text-[11px]">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function StockPositionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { customers = [], locations = [], items = [], user: currentUser = { name: 'Admin', role: 'Admin' } } = useERP();

  // Tab mapping syncing with ?type=...
  const rawType = searchParams.get('type');
  const activeTab = useMemo(() => {
    if (rawType === 'sample') return 'sample';
    if (rawType === 'wastage') return 'wastage';
    if (rawType === 'good') return 'good';
    if (rawType === 'reprocess') return 'reprocess';
    if (rawType === 'customer-return') return 'customer-return';
    return 'overview';
  }, [rawType]);

  const setTab = (tabKey) => {
    if (tabKey === 'overview') {
      searchParams.delete('type');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ type: tabKey });
    }
  };

  // State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Common & View-specific filter inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    fromDate: '',
    toDate: '',
    qualities: [],
    designs: [],
    shades: [],
    customers: [],
    godowns: [],
    status: '',
    item: '',
    reason: '',
    vendor: '',
    process: '',
  });

  // Staged filter state (applied when user clicks "Apply")
  const [stagedFromDate, setStagedFromDate] = useState('');
  const [stagedToDate, setStagedToDate] = useState('');
  const [stagedQualities, setStagedQualities] = useState([]);
  const [stagedDesigns, setStagedDesigns] = useState([]);
  const [stagedShades, setStagedShades] = useState([]);
  const [stagedCustomers, setStagedCustomers] = useState([]);
  const [stagedGodowns, setStagedGodowns] = useState([]);
  const [stagedStatus, setStagedStatus] = useState('');
  const [stagedItem, setStagedItem] = useState('');

  // Pagination & Page Size (matching #16 in reference: 10, 25, 50, 100)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row selection checkboxes (#11)
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());

  // Interactive Modals State
  const [viewModalRecord, setViewModalRecord] = useState(null); // #12 View (Eye)
  const [returnModalRecord, setReturnModalRecord] = useState(null); // #13 Return (Arrow)
  const [printModalRecord, setPrintModalRecord] = useState(null); // #14 Print (Printer)
  const sampleIssueSigs = useDocumentSignatures('SampleIssue', printModalRecord?.id || printModalRecord?.issueNo, `Sample Issue Slip ${printModalRecord?.issueNo || ''}`);
  const [historyModalRecord, setHistoryModalRecord] = useState(null); // View History Audit
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false); // #10 + Issue Sample
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [thresholdInput, setThresholdInput] = useState('');
  const [thresholdEnabled, setThresholdEnabled] = useState(true);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const [thresholdError, setThresholdError] = useState(null);

  // Top Bar User Menu & Notifications (#1, #2, #3)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form states
  const [sampleForm, setSampleForm] = useState({
    itemId: '',
    customer: '',
    qty: '',
    lotNo: '',
    locationId: '',
    expectedReturnDate: '',
    notes: '',
    quality: '',
    design: '',
    shade: '',
    uom: 'Mtr',
    availableStock: null,
  });
  const [submittingSample, setSubmittingSample] = useState(false);
  const [sampleSuccessMsg, setSampleSuccessMsg] = useState(null);

  const [returnForm, setReturnForm] = useState({
    returnQty: '',
    returnDate: new Date().toISOString().split('T')[0],
    condition: 'usable',
    remarks: '',
  });
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnSuccessMsg, setReturnSuccessMsg] = useState(null);

  // Fetch live database figures
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const query = { detail: 'true' };
      if (appliedFilters.fromDate) query.start_date = appliedFilters.fromDate;
      if (appliedFilters.toDate) query.end_date = appliedFilters.toDate;

      const res = await inventoryService.getStockPositions(query);
      setData(res);

      if (!stagedFromDate && res?.filters?.dateRange?.from) {
        setStagedFromDate(res.filters.dateRange.from);
      }
      if (!stagedToDate && res?.filters?.dateRange?.to) {
        setStagedToDate(res.filters.dateRange.to);
      }
    } catch (err) {
      console.error('Failed to fetch stock positions:', err);
      setError(err?.message || 'Failed to retrieve stock records from the database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedFilters.fromDate, appliedFilters.toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Apply button handler (#9)
  const handleApplyFilters = () => {
    setAppliedFilters({
      ...appliedFilters,
      fromDate: stagedFromDate,
      toDate: stagedToDate,
      qualities: stagedQualities,
      designs: stagedDesigns,
      shades: stagedShades,
      customers: stagedCustomers,
      godowns: stagedGodowns,
      status: stagedStatus,
      item: stagedItem,
    });
    setCurrentPage(1);
    fetchData(true);
  };

  // Reset page when switching tabs or filtering
  useEffect(() => {
    setCurrentPage(1);
    setSelectedRowIds(new Set());
  }, [activeTab, searchQuery, pageSize]);

  // Handle Item selection in Issue Sample Modal (auto-populates fabric details & available stock)
  const handleSampleItemSelect = (selectedId) => {
    const chosenItem = items.find((i) => String(i.id) === String(selectedId));
    const availableLotsForItem = (data?.filters?.availableLots || []).filter(
      (l) => String(l.itemId) === String(selectedId)
    );
    const firstLot = availableLotsForItem[0];
    const totalAvail = availableLotsForItem.reduce(
      (acc, l) => acc + (Number(l.available) || 0),
      0
    );

    setSampleForm((prev) => ({
      ...prev,
      itemId: selectedId,
      lotNo: firstLot ? (firstLot.lotNo || '') : '',
      lotTakaId: firstLot?.lotTakaId || '',
      locationId: firstLot ? firstLot.locationId : '',
      quality: chosenItem?.fabric_quality || chosenItem?.name || firstLot?.quality || '',
      design: chosenItem?.fabric_design || firstLot?.design || '',
      shade: chosenItem?.fabric_color || firstLot?.shade || '',
      uom: chosenItem?.uom || firstLot?.uom || '',
      availableStock: firstLot ? firstLot.available : totalAvail,
    }));
  };

  // Handle Lot selection in Issue Sample Modal
  const handleSampleLotSelect = (lotNumber) => {
    // The option value is the taka id (or "loc:<locationId>" for stock not on takas).
    const matchingLot = (data?.filters?.availableLots || []).find(
      (l) => String(l.itemId) === String(sampleForm.itemId)
        && (l.lotTakaId ? l.lotTakaId === lotNumber : `loc:${l.locationId}` === lotNumber)
    );
    setSampleForm((prev) => ({
      ...prev,
      lotNo: matchingLot?.lotNo || '',
      lotTakaId: matchingLot?.lotTakaId || '',
      locationId: matchingLot ? matchingLot.locationId : prev.locationId,
      availableStock: matchingLot ? matchingLot.available : prev.availableStock,
    }));
  };

  // Handle Issue Sample Submission (#10)
  const handleIssueSampleSubmit = async (e) => {
    e.preventDefault();
    if (!sampleForm.itemId) {
      alert('Please select an item.');
      return;
    }
    const issueQty = Number(sampleForm.qty);
    if (!issueQty || issueQty <= 0) {
      alert('Please enter a valid positive quantity.');
      return;
    }
    if (sampleForm.availableStock !== null && issueQty > sampleForm.availableStock) {
      alert(`Requested sample quantity (${issueQty} ${sampleForm.uom}) exceeds available Good Fabric Stock (${sampleForm.availableStock} ${sampleForm.uom}).`);
      return;
    }

    setSubmittingSample(true);
    setSampleSuccessMsg(null);
    try {
      const res = await inventoryService.issueSample({
        itemId: sampleForm.itemId,
        customer: sampleForm.customer,
        qty: sampleForm.qty,
        lotNo: sampleForm.lotNo,
        lotTakaId: sampleForm.lotTakaId || undefined,
        locationId: sampleForm.locationId,
        expectedReturnDate: sampleForm.expectedReturnDate || '',
        notes: sampleForm.notes || '',
      });

      setSampleSuccessMsg(res?.message || 'Sample issued and ledger updated successfully!');
      setTimeout(() => {
        setIsSampleModalOpen(false);
        setSampleSuccessMsg(null);
        setSampleForm({
          itemId: '',
          customer: '',
          qty: '',
          lotNo: '',
          locationId: '',
          expectedReturnDate: '',
          notes: '',
          quality: '',
          design: '',
          shade: '',
          uom: 'Mtr',
          availableStock: null,
        });
        fetchData(true);
      }, 1000);
    } catch (err) {
      alert(err?.response?.data?.detail || err?.message || 'Failed to issue sample.');
    } finally {
      setSubmittingSample(false);
    }
  };

  // Handle Return Sample Submission (#13)
  const handleReturnSampleSubmit = async (e) => {
    e.preventDefault();
    if (!returnModalRecord) return;
    const rQty = Number(returnForm.returnQty);
    if (!rQty || rQty <= 0) {
      alert('Please enter a valid return quantity greater than 0.');
      return;
    }
    if (rQty > Number(returnModalRecord.remainingQty || 0)) {
      alert(`Return quantity cannot exceed remaining pending quantity (${returnModalRecord.remainingQty} ${returnModalRecord.uom}).`);
      return;
    }

    setSubmittingReturn(true);
    setReturnSuccessMsg(null);
    try {
      const res = await inventoryService.returnSample({
        movementId: returnModalRecord.id,
        returnQty: rQty,
        condition: returnForm.condition || 'usable',
        remarks: returnForm.remarks || `Sample returned by ${returnModalRecord.customer}`,
      });

      setReturnSuccessMsg(res?.message || 'Sample return recorded successfully!');
      setTimeout(() => {
        setReturnModalRecord(null);
        setReturnSuccessMsg(null);
        setReturnForm({
          returnQty: '',
          returnDate: new Date().toISOString().split('T')[0],
          condition: 'usable',
          remarks: '',
        });
        fetchData(true);
      }, 1000);
    } catch (err) {
      alert(err?.response?.data?.detail || err?.message || 'Failed to record return.');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // ── Metrics for the 4 Dedicated Sample Stock Cards ──────────────────────
  const sampleMetrics = useMemo(() => {
    const records = data?.sampleRecords || [];
    const issued = records.reduce((acc, r) => acc + (Number(r.issuedQty) || 0), 0);
    const returned = records.reduce((acc, r) => acc + (Number(r.returnedQty) || 0), 0);
    const pending = records.reduce((acc, r) => acc + (Number(r.remainingQty) || 0), 0);
    const active = records.filter((r) => Number(r.remainingQty) > 0).length;
    const uom = records[0]?.uom || 'Mtr';
    return { issued, returned, pending, active, uom };
  }, [data]);

  // ── Metrics for the 8 KPI Cards ──────────────────────────────────────────
  const summaryCards = useMemo(() => {
    const sc = data?.summaryCards || {};
    const resolveQty = (c) => Number(c?.qty ?? c?.byUom?.[0]?.qty ?? 0);
    const resolveUom = (c) => (c?.uom && c?.uom !== 'Mixed' ? c?.uom : (c?.byUom?.[0]?.uom || 'Mtr'));

    return [
      {
        id: 'overview',
        label: 'Total Fabric Stock',
        qty: resolveQty(sc.totalStock),
        uom: resolveUom(sc.totalStock),
        val: sc.totalStock?.value ?? 0,
        pct: sc.totalStock?.pct ?? 100,
        icon: Layers,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        tabKey: 'overview',
      },
      {
        id: 'good',
        label: 'Good Fabric Stock',
        qty: resolveQty(sc.goodStock),
        uom: resolveUom(sc.goodStock),
        val: sc.goodStock?.value ?? 0,
        pct: sc.goodStock?.pct ?? 0,
        icon: CheckCircle2,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        tabKey: 'good',
      },
      {
        id: 'sample',
        label: 'Sample Stock',
        qty: resolveQty(sc.sampleStock),
        uom: resolveUom(sc.sampleStock),
        val: sc.sampleStock?.value ?? 0,
        pct: sc.sampleStock?.pct ?? 0,
        icon: FlaskConical,
        color: 'text-teal-600',
        bg: 'bg-teal-50',
        border: 'border-teal-200',
        tabKey: 'sample',
      },
      {
        id: 'wastage',
        label: 'Wastage Stock',
        qty: resolveQty(sc.wastageStock),
        uom: resolveUom(sc.wastageStock),
        val: sc.wastageStock?.value ?? 0,
        pct: sc.wastageStock?.pct ?? 0,
        icon: Trash2,
        color: 'text-rose-600',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        tabKey: 'wastage',
      },
      {
        id: 'reprocess',
        label: 'Reprocessing Stock',
        qty: resolveQty(sc.reprocessingStock),
        uom: resolveUom(sc.reprocessingStock),
        val: sc.reprocessingStock?.value ?? 0,
        pct: sc.reprocessingStock?.pct ?? 0,
        icon: RefreshCw,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        tabKey: 'reprocess',
      },
      {
        id: 'customerReturn',
        label: 'Customer Return Stock',
        qty: resolveQty(sc.customerReturnStock),
        uom: resolveUom(sc.customerReturnStock),
        val: sc.customerReturnStock?.value ?? 0,
        pct: sc.customerReturnStock?.pct ?? 0,
        icon: Undo2,
        color: 'text-purple-600',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        tabKey: 'customer-return',
      },
      {
        id: 'qcHold',
        label: 'QC Held Stock',
        qty: resolveQty(sc.qcHoldStock),
        uom: resolveUom(sc.qcHoldStock),
        val: sc.qcHoldStock?.value ?? 0,
        pct: sc.qcHoldStock?.pct ?? 0,
        icon: ShieldCheck,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        tabKey: 'overview',
      },
      {
        id: 'rejected',
        label: 'Rejected Stock',
        qty: resolveQty(sc.rejectedStock),
        uom: resolveUom(sc.rejectedStock),
        val: sc.rejectedStock?.value ?? 0,
        pct: sc.rejectedStock?.pct ?? 0,
        icon: XCircle,
        color: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
        tabKey: 'wastage',
      },
    ];
  }, [data]);

  // Distinct master options for search dropdowns
  const qualityOptions = useMemo(() => {
    const set = new Set();
    (data?.qualityStock || []).forEach((q) => q.qualityName && set.add(q.qualityName));
    (items || []).forEach((i) => i.fabric_quality && set.add(i.fabric_quality));
    return Array.from(set).sort();
  }, [data, items]);

  const designOptions = useMemo(() => {
    const set = new Set(['Plain', 'Floral', 'Check', 'Stripe', 'Jacquard', 'Dobby', 'Printed']);
    (items || []).forEach((i) => i.fabric_design && set.add(i.fabric_design));
    return Array.from(set).sort();
  }, [items]);

  const shadeOptions = useMemo(() => {
    const set = new Set(['Navy', 'Blue', 'Maroon', 'Black', 'White', 'Green', 'Grey', 'Off-White', 'Red']);
    (items || []).forEach((i) => i.fabric_color && set.add(i.fabric_color));
    return Array.from(set).sort();
  }, [items]);

  const customerOptions = useMemo(() => {
    const set = new Set();
    (data?.sampleRecords || []).forEach((r) => r.customer && set.add(r.customer));
    (data?.returnRecords || []).forEach((r) => r.customer && set.add(r.customer));
    customers.forEach((c) => c.name && set.add(c.name));
    return Array.from(set).sort();
  }, [data, customers]);

  const godownOptions = useMemo(() => {
    const list = data?.filters?.godowns || [];
    if (list.length) return list.map((g) => g.name);
    return locations.map((l) => l.name);
  }, [data, locations]);

  const itemOptions = useMemo(() => {
    const set = new Set();
    (data?.sampleRecords || []).forEach((r) => r.itemCode && set.add(r.itemCode));
    (items || []).forEach((i) => i.sku && set.add(i.sku));
    return Array.from(set).sort();
  }, [data, items]);

  // ── FILTERED DATASETS PER TAB ──────────────────────────────────────────

  // 1. Overview: Stock Position by Quality
  const filteredQualityStock = useMemo(() => {
    let list = data?.qualityStock || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.qualityCode?.toLowerCase().includes(q) ||
          it.qualityName?.toLowerCase().includes(q)
      );
    }
    if (appliedFilters.qualities.length > 0) {
      list = list.filter((it) => appliedFilters.qualities.includes(it.qualityName));
    }
    return list;
  }, [data, searchQuery, appliedFilters.qualities]);

  // 2. Sample Stock Records (#4, #5, #6, #7, #8, #9, #15)
  const filteredSampleRecords = useMemo(() => {
    let list = data?.sampleRecords || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.itemCode?.toLowerCase().includes(q) ||
          it.itemName?.toLowerCase().includes(q) ||
          it.issueNo?.toLowerCase().includes(q) ||
          it.quality?.toLowerCase().includes(q) ||
          it.design?.toLowerCase().includes(q) ||
          it.shade?.toLowerCase().includes(q) ||
          it.customer?.toLowerCase().includes(q) ||
          it.lotNo?.toLowerCase().includes(q)
      );
    }
    if (appliedFilters.qualities.length > 0) {
      list = list.filter((it) => appliedFilters.qualities.includes(it.quality));
    }
    if (appliedFilters.designs.length > 0) {
      list = list.filter((it) => appliedFilters.designs.includes(it.design));
    }
    if (appliedFilters.shades.length > 0) {
      list = list.filter((it) => appliedFilters.shades.includes(it.shade));
    }
    if (appliedFilters.customers.length > 0) {
      list = list.filter((it) => appliedFilters.customers.includes(it.customer));
    }
    if (appliedFilters.status) {
      list = list.filter((it) => it.status === appliedFilters.status);
    }
    if (appliedFilters.item) {
      list = list.filter(
        (it) => it.itemCode === appliedFilters.item || it.itemName === appliedFilters.item
      );
    }
    if (appliedFilters.fromDate) {
      list = list.filter((it) => it.rawDate >= appliedFilters.fromDate);
    }
    if (appliedFilters.toDate) {
      list = list.filter((it) => it.rawDate <= appliedFilters.toDate);
    }
    return list;
  }, [
    data,
    searchQuery,
    appliedFilters.qualities,
    appliedFilters.designs,
    appliedFilters.shades,
    appliedFilters.customers,
    appliedFilters.status,
    appliedFilters.item,
    appliedFilters.fromDate,
    appliedFilters.toDate,
  ]);

  // 3. Wastage Stock Records
  const filteredWastageRecords = useMemo(() => {
    let list = data?.wastageRecords || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.itemCode?.toLowerCase().includes(q) ||
          it.quality?.toLowerCase().includes(q) ||
          it.reason?.toLowerCase().includes(q) ||
          it.sourceDoc?.toLowerCase().includes(q) ||
          it.lotNo?.toLowerCase().includes(q)
      );
    }
    if (appliedFilters.qualities.length > 0) {
      list = list.filter((it) => appliedFilters.qualities.includes(it.quality));
    }
    return list;
  }, [data, searchQuery, appliedFilters.qualities]);

  // 4. Good Fabric Stock Records
  const filteredGoodRecords = useMemo(() => {
    let list = data?.goodRecords || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.itemCode?.toLowerCase().includes(q) ||
          it.quality?.toLowerCase().includes(q) ||
          it.design?.toLowerCase().includes(q) ||
          it.shade?.toLowerCase().includes(q) ||
          it.lotNo?.toLowerCase().includes(q) ||
          it.godown?.toLowerCase().includes(q)
      );
    }
    if (appliedFilters.qualities.length > 0) {
      list = list.filter((it) => appliedFilters.qualities.includes(it.quality));
    }
    if (appliedFilters.designs.length > 0) {
      list = list.filter((it) => appliedFilters.designs.includes(it.design));
    }
    if (appliedFilters.shades.length > 0) {
      list = list.filter((it) => appliedFilters.shades.includes(it.shade));
    }
    return list;
  }, [data, searchQuery, appliedFilters.qualities, appliedFilters.designs, appliedFilters.shades]);

  // 5. Reprocessing Stock Records
  const filteredReprocessRecords = useMemo(() => {
    let list = data?.reprocessRecords || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.itemCode?.toLowerCase().includes(q) ||
          it.quality?.toLowerCase().includes(q) ||
          it.process?.toLowerCase().includes(q) ||
          it.vendor?.toLowerCase().includes(q) ||
          it.lotNo?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, searchQuery]);

  // 6. Customer Return Stock Records
  const filteredReturnRecords = useMemo(() => {
    let list = data?.returnRecords || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.itemCode?.toLowerCase().includes(q) ||
          it.quality?.toLowerCase().includes(q) ||
          it.customer?.toLowerCase().includes(q) ||
          it.reason?.toLowerCase().includes(q) ||
          it.lotNo?.toLowerCase().includes(q)
      );
    }
    if (appliedFilters.customers.length > 0) {
      list = list.filter((it) => appliedFilters.customers.includes(it.customer));
    }
    return list;
  }, [data, searchQuery, appliedFilters.customers]);

  // Active dataset for pagination
  const currentDataset = useMemo(() => {
    if (activeTab === 'overview') return filteredQualityStock;
    if (activeTab === 'sample') return filteredSampleRecords;
    if (activeTab === 'wastage') return filteredWastageRecords;
    if (activeTab === 'good') return filteredGoodRecords;
    if (activeTab === 'reprocess') return filteredReprocessRecords;
    if (activeTab === 'customer-return') return filteredReturnRecords;
    return [];
  }, [
    activeTab,
    filteredQualityStock,
    filteredSampleRecords,
    filteredWastageRecords,
    filteredGoodRecords,
    filteredReprocessRecords,
    filteredReturnRecords,
  ]);

  const totalPages = Math.ceil(currentDataset.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return currentDataset.slice(start, start + pageSize);
  }, [currentDataset, currentPage, pageSize]);

  // Checkbox row selection handlers (#11)
  const toggleSelectRow = (id) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  const toggleSelectAllPage = () => {
    if (paginatedData.every((r) => selectedRowIds.has(r.id))) {
      const next = new Set(selectedRowIds);
      paginatedData.forEach((r) => next.delete(r.id));
      setSelectedRowIds(next);
    } else {
      const next = new Set(selectedRowIds);
      paginatedData.forEach((r) => next.add(r.id));
      setSelectedRowIds(next);
    }
  };

  const isAllPageSelected =
    paginatedData.length > 0 && paginatedData.every((r) => selectedRowIds.has(r.id));

  // CSV Export handler
  const handleExport = () => {
    const filename = `Stock_Position_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCsv(filename, currentDataset);
  };

  // Dynamic Page Header Metadata per active tab
  const tabHeaderInfo = useMemo(() => {
    switch (activeTab) {
      case 'sample':
        return {
          title: 'Sample Stock',
          badge: 'Sample Inventory',
          badgeStyle: 'bg-teal-50 text-teal-700 border-teal-200',
          subtitle: 'Track fabric issued as samples and their return status.',
          icon: FlaskConical,
          iconBg: 'bg-teal-50 border-teal-200',
          iconColor: 'text-teal-600',
        };
      case 'wastage':
        return {
          title: 'Wastage Stock',
          badge: 'Scrap & Waste',
          badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200',
          subtitle: 'Track damaged rolls, scraps, and recorded fabric wastage.',
          icon: Trash2,
          iconBg: 'bg-rose-50 border-rose-200',
          iconColor: 'text-rose-600',
        };
      case 'good':
        return {
          title: 'Good Fabric Stock',
          badge: 'Usable Fabric',
          badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          subtitle: 'Commercially usable fabric stock ready for production and dispatch.',
          icon: CheckCircle2,
          iconBg: 'bg-emerald-50 border-emerald-200',
          iconColor: 'text-emerald-600',
        };
      case 'reprocess':
        return {
          title: 'Reprocessing Stock',
          badge: 'Reprocessing',
          badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200',
          subtitle: 'Fabric held or undergoing re-processing and finishing rework.',
          icon: RefreshCw,
          iconBg: 'bg-amber-50 border-amber-200',
          iconColor: 'text-amber-600',
        };
      case 'customer-return':
        return {
          title: 'Customer Return Stock',
          badge: 'Returns',
          badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200',
          subtitle: 'Fabric returned from customers awaiting inspection and disposition.',
          icon: Undo2,
          iconBg: 'bg-purple-50 border-purple-200',
          iconColor: 'text-purple-600',
        };
      default:
        return {
          title: 'Fabric Stock Overview',
          badge: 'Stock Position',
          badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200',
          subtitle: 'Live fabric inventory across all godowns, qualities, and stock statuses.',
          icon: Layers,
          iconBg: 'bg-blue-50 border-blue-200',
          iconColor: 'text-blue-600',
        };
    }
  }, [activeTab]);

  const TabHeaderIcon = tabHeaderInfo.icon;

  return (
    <div className="space-y-5">
      {/* ── TOP PAGE HEADER ────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl border grid place-items-center shrink-0 ${tabHeaderInfo.iconBg}`}>
            <TabHeaderIcon size={20} className={tabHeaderInfo.iconColor} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{tabHeaderInfo.title}</h1>
              <PageInfoButton title={tabHeaderInfo.title} />
              <span className={`px-2 py-0.5 text-[10.5px] font-bold rounded border ${tabHeaderInfo.badgeStyle}`}>
                {tabHeaderInfo.badge}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {tabHeaderInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Global Action / Search / Refresh Header */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-48 sm:w-64">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quality, item, lot, customer..."
              className="w-full h-8 pl-8 pr-7 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={() => fetchData(false)}
            disabled={refreshing || loading}
            title="Refresh Stock Data"
            className="h-8 w-8 grid place-items-center bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-blue-600 hover:border-slate-300 shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing || loading ? 'animate-spin text-blue-600' : ''} />
          </button>

          {activeTab === 'sample' && (
            <button
              onClick={() => setIsSampleModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Plus size={13} />
              <span>Issue Sample</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 8 TOP KPI CARDS ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const isActive =
            card.tabKey === activeTab && (card.tabKey !== 'overview' || card.id === 'overview');

          return (
            <button
              key={card.id}
              onClick={() => setTab(card.tabKey)}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between shadow-xs cursor-pointer ${
                isActive
                  ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                  : 'bg-white border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold text-slate-600 truncate max-w-[110px]" title={card.label}>
                  {card.label}
                </span>
                <div className={`w-6 h-6 rounded-md grid place-items-center shrink-0 ${card.bg}`}>
                  <Icon size={12} className={card.color} />
                </div>
              </div>

              <div className="mt-2">
                <div className="text-base font-extrabold text-slate-900 tracking-tight font-mono">
                  {formatQty(card.qty, card.uom)}
                </div>
                <div className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">
                  {formatINR(card.val)} ({card.pct}%)
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── NAVIGATION TABS (SYNCED WITH SIDEBAR & QUERY PARAMS) ──────────── */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 text-xs overflow-x-auto scrollbar-none pb-0.5">
        {[
          { key: 'overview', label: 'Fabric Stock Overview', icon: Layers },
          { key: 'sample', label: 'Sample Stock (Sample Inventory)', icon: FlaskConical },
          { key: 'wastage', label: 'Wastage Stock (Scrap & Waste)', icon: Trash2 },
          { key: 'good', label: 'Good Fabric Stock (Usable Fabric)', icon: CheckCircle2 },
          { key: 'reprocess', label: 'Reprocessing Stock', icon: RefreshCw },
          { key: 'customer-return', label: 'Customer Return Stock', icon: Undo2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg font-bold text-xs whitespace-nowrap transition cursor-pointer border-b-2 ${
                isSelected
                  ? 'border-blue-600 text-blue-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              <Icon size={13} className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── 4 DEDICATED SAMPLE STOCK SUMMARY CARDS (When activeTab === 'sample') ─── */}
      {activeTab === 'sample' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                Samples Issued
              </span>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono">
                {formatQty(sampleMetrics.issued, sampleMetrics.uom)}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Total sample volume issued</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 grid place-items-center shrink-0">
              <FlaskConical size={18} className="text-teal-600" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                Returned Quantity
              </span>
              <div className="text-xl font-black text-emerald-700 mt-1 font-mono">
                {formatQty(sampleMetrics.returned, sampleMetrics.uom)}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Restored into inventory / QC</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 grid place-items-center shrink-0">
              <RotateCcw size={18} className="text-emerald-600" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                Pending Return Quantity
              </span>
              <div className="text-xl font-black text-amber-700 mt-1 font-mono">
                {formatQty(sampleMetrics.pending, sampleMetrics.uom)}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Outstanding with clients</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 grid place-items-center shrink-0">
              <Clock size={18} className="text-amber-600" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">
                Active Sample Records
              </span>
              <div className="text-xl font-black text-blue-700 mt-1 font-mono">
                {sampleMetrics.active} Records
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Pending or partially returned</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 grid place-items-center shrink-0">
              <Layers size={18} className="text-blue-600" />
            </div>
          </div>
        </div>
      )}

      {/* ── COMPLETE FILTER BAR (#4, #5, #6, #7, #8, #9, #10) ─── */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* #4 From Date / To Date Picker */}
          <div className="inline-flex items-center gap-1.5 h-8 px-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 shadow-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase">From</span>
            <input
              type="date"
              value={stagedFromDate}
              onChange={(e) => setStagedFromDate(e.target.value)}
              className="bg-transparent text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
              title="From Date"
            />
            <span className="text-slate-300">-</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase">To</span>
            <input
              type="date"
              value={stagedToDate}
              onChange={(e) => setStagedToDate(e.target.value)}
              className="bg-transparent text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
              title="To Date"
            />
          </div>

          {/* Fabric Item Filter Dropdown (Sample Stock) */}
          {activeTab === 'sample' && (
            <MultiSearchDropdown
              label="Fabric Item"
              options={itemOptions}
              selected={stagedItem ? [stagedItem] : []}
              onChange={(arr) => setStagedItem(arr[0] || '')}
            />
          )}

          {/* #5 Quality Filter Dropdown */}
          <MultiSearchDropdown
            label="Quality"
            options={qualityOptions}
            selected={stagedQualities}
            onChange={setStagedQualities}
          />

          {/* #6 Design Filter Dropdown */}
          <MultiSearchDropdown
            label="Design"
            options={designOptions}
            selected={stagedDesigns}
            onChange={setStagedDesigns}
          />

          {/* #7 Shade Filter Dropdown */}
          <MultiSearchDropdown
            label="Shade"
            options={shadeOptions}
            selected={stagedShades}
            onChange={setStagedShades}
          />

          {/* #8 Customer Filter Dropdown */}
          <MultiSearchDropdown
            label="Customer"
            options={customerOptions}
            selected={stagedCustomers}
            onChange={setStagedCustomers}
          />

          {/* Status Filter Dropdown for Sample Stock */}
          {activeTab === 'sample' && (
            <div className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Status</span>
              <select
                value={stagedStatus}
                onChange={(e) => setStagedStatus(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="Issued">Issued</option>
                <option value="Partial">Partial Return</option>
                <option value="Returned">Returned</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          )}

          {/* #9 Apply Button */}
          <button
            onClick={handleApplyFilters}
            className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            Apply
          </button>
        </div>

        {/* Right side: #10 + Issue Sample Button & Export CSV */}
        <div className="flex items-center gap-2">
          {activeTab === 'sample' && (
            <button
              onClick={() => setIsSampleModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus size={14} />
              + Issue Sample
            </button>
          )}

          <button
            onClick={handleExport}
            disabled={!currentDataset.length}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <Download size={13} />
            Export CSV
          </button>

          {/* Configure Threshold trigger */}
          {data?.combinedGreyStock && (
            <button
              type="button"
              onClick={() => {
                setThresholdInput(data.combinedGreyStock.threshold > 0 ? String(data.combinedGreyStock.threshold) : '');
                setThresholdEnabled(data.combinedGreyStock.isEnabled ?? true);
                setThresholdError(null);
                setIsThresholdModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Settings size={13} />
              <span>Threshold Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Grey Fabric Shortage Alert (Only shown if shortage exists) */}
      {data?.combinedGreyStock?.shortage > 0 && data?.combinedGreyStock?.isEnabled && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-800 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>
              <strong>Combined Grey Stock Alert:</strong> Available grey fabric ({formatQty(data.combinedGreyStock.availableGrey, data.combinedGreyStock.uom)}) has fallen below safety threshold ({formatQty(data.combinedGreyStock.threshold, data.combinedGreyStock.uom)}) by {formatQty(data.combinedGreyStock.shortage, data.combinedGreyStock.uom)}.
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/administration/alerts')}
            className="text-[11px] font-semibold text-rose-700 hover:text-rose-900 underline shrink-0 cursor-pointer text-left"
          >
            View Alert Center &rarr;
          </button>
        </div>
      )}

      {/* ── TAB CONTENT & DATA TABLE ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading verified stock records...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle size={28} className="text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-800">Failed to load records</p>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              onClick={() => fetchData()}
              className="mt-3 px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              {/* 1. OVERVIEW: Stock Position by Quality */}
              {activeTab === 'overview' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3">Quality Code</th>
                      <th className="py-3 px-3">Quality Name</th>
                      <th className="py-3 px-3 text-right">Good Stock</th>
                      <th className="py-3 px-3 text-right">Sample</th>
                      <th className="py-3 px-3 text-right">Wastage</th>
                      <th className="py-3 px-3 text-right">Reprocess</th>
                      <th className="py-3 px-3 text-right">Re-inward</th>
                      <th className="py-3 px-3 text-right">Return</th>
                      <th className="py-3 px-3 text-right">QC Hold</th>
                      <th className="py-3 px-3 text-right">Rejected</th>
                      <th className="py-3 px-3 text-right font-extrabold text-slate-900">Total Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {paginatedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-blue-600">{row.qualityCode}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{row.qualityName}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatQty(row.goodStock)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-teal-700">{formatQty(row.sample)}</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-700">{formatQty(row.wastage)}</td>
                        <td className="py-2 px-3 text-right font-mono text-amber-700">{formatQty(row.reprocess)}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">{formatQty(row.reinward)}</td>
                        <td className="py-2 px-3 text-right font-mono text-purple-700">{formatQty(row.return)}</td>
                        <td className="py-2 px-3 text-right font-mono text-indigo-700">{formatQty(row.qcHold)}</td>
                        <td className="py-2 px-3 text-right font-mono text-red-700">{formatQty(row.rejected)}</td>
                        <td className="py-2 px-3 text-right font-mono font-black text-slate-900 bg-slate-50/50">
                          {formatQty(row.total)}
                        </td>
                      </tr>
                    ))}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-10 text-center text-slate-400 font-sans text-xs">
                          No quality records found in the ledger for current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* 2. SAMPLE STOCK: Sample Inventory (#11, #12, #13, #14, #15) */}
              {activeTab === 'sample' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                      {/* #11 Row Checkbox */}
                      <th className="py-3 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={isAllPageSelected}
                          onChange={toggleSelectAllPage}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-2">#</th>
                      <th className="py-3 px-3">Sample Number</th>
                      <th className="py-3 px-3">Fabric Item</th>
                      <th className="py-3 px-3">Quality</th>
                      <th className="py-3 px-3">Design</th>
                      <th className="py-3 px-3">Shade</th>
                      <th className="py-3 px-3">Lot / Taka</th>
                      <th className="py-3 px-3 text-right">Issued Qty</th>
                      <th className="py-3 px-3 text-right">Returned Qty</th>
                      <th className="py-3 px-3 text-right">Remaining Qty</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Issue Date</th>
                      <th className="py-3 px-3">Expected Return</th>
                      {/* #15 Status Badge */}
                      <th className="py-3 px-3 text-center">Status</th>
                      {/* Action column with #12, #13, #14, and History */}
                      <th className="py-3 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {paginatedData.map((row, idx) => {
                      const isSelected = selectedRowIds.has(row.id);
                      return (
                        <tr
                          key={row.id || idx}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isSelected ? 'bg-blue-50/30' : ''
                          }`}
                        >
                          {/* #11 Checkbox */}
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(row.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-2 text-slate-400 font-mono text-[10px]">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-blue-600">{row.issueNo}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">
                            <div className="font-mono text-slate-900 font-bold">{row.itemCode}</div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[130px]">{row.itemName}</div>
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-800">{row.quality}</td>
                          <td className="py-2 px-3 text-slate-600">{row.design}</td>
                          <td className="py-2 px-3 text-slate-600">{row.shade}</td>
                          <td className="py-2 px-3 font-mono text-slate-500 text-[10.5px]">{row.lotNo}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                            {formatQty(row.issuedQty, row.uom)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">
                            {formatQty(row.returnedQty, row.uom)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-teal-700">
                            {formatQty(row.remainingQty, row.uom)}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-700">{row.customer}</td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">{row.issueDate}</td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">
                            {row.expectedReturnDate || '—'}
                          </td>

                          {/* #15 Status Badges */}
                          <td className="py-2 px-3 text-center">
                            {row.status === 'Issued' && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                Issued
                              </span>
                            )}
                            {row.status === 'Partial' && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Partial Return
                              </span>
                            )}
                            {row.status === 'Returned' && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Returned
                              </span>
                            )}
                            {row.status === 'Overdue' && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Overdue
                              </span>
                            )}
                            {!['Issued', 'Partial', 'Returned', 'Overdue'].includes(row.status) && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
                                {row.status || 'Active'}
                              </span>
                            )}
                          </td>

                          {/* Actions: #12 View, #13 Return, #14 Print, View History */}
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* #12 View Button */}
                              <button
                                onClick={() => setViewModalRecord(row)}
                                className="w-6 h-6 rounded border border-blue-200 bg-blue-50/60 text-blue-600 hover:bg-blue-100 grid place-items-center transition cursor-pointer"
                                title="View Sample Details"
                              >
                                <Eye size={12} />
                              </button>

                              {/* #13 Return Button */}
                              <button
                                onClick={() => {
                                  setReturnModalRecord(row);
                                  setReturnForm({
                                    returnQty: row.remainingQty > 0 ? String(row.remainingQty) : '',
                                    returnDate: new Date().toISOString().split('T')[0],
                                    condition: 'usable',
                                    remarks: '',
                                  });
                                }}
                                disabled={row.remainingQty <= 0}
                                className="w-6 h-6 rounded border border-teal-200 bg-teal-50/60 text-teal-600 hover:bg-teal-100 grid place-items-center transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Record Sample Return"
                              >
                                <RotateCcw size={12} />
                              </button>

                              {/* #14 Print Button */}
                              <button
                                onClick={() => setPrintModalRecord(row)}
                                className="w-6 h-6 rounded border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 grid place-items-center transition cursor-pointer"
                                title="Print / Download Sample Issue Report"
                              >
                                <Printer size={12} />
                              </button>

                              {/* View History Audit Button */}
                              <button
                                onClick={() => setHistoryModalRecord(row)}
                                className="w-6 h-6 rounded border border-purple-200 bg-purple-50/60 text-purple-600 hover:bg-purple-100 grid place-items-center transition cursor-pointer"
                                title="View Movement History & Audit Trail"
                              >
                                <Clock size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td colSpan={16} className="py-10 text-center text-slate-400 font-sans text-xs">
                          No sample movements recorded yet. Click &quot;+ Issue Sample&quot; to issue a sample.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* 3. WASTAGE STOCK */}
              {activeTab === 'wastage' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">Item Code</th>
                      <th className="py-3 px-3">Quality</th>
                      <th className="py-3 px-3">Design</th>
                      <th className="py-3 px-3">Shade</th>
                      <th className="py-3 px-3">Lot / Taka</th>
                      <th className="py-3 px-3 text-right">Quantity</th>
                      <th className="py-3 px-3">UOM</th>
                      <th className="py-3 px-3">Reason</th>
                      <th className="py-3 px-3">Source Doc</th>
                      <th className="py-3 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {paginatedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-600">{row.itemCode}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{row.quality}</td>
                        <td className="py-2 px-3 text-slate-600">{row.design}</td>
                        <td className="py-2 px-3 text-slate-600">{row.shade}</td>
                        <td className="py-2 px-3 font-mono text-slate-500 text-[10.5px]">{row.lotNo}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
                          {formatQty(row.quantity, '')}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{row.uom}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            {row.reason}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 text-[10.5px]">{row.sourceDoc}</td>
                        <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">{row.date}</td>
                      </tr>
                    ))}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-10 text-center text-slate-400 font-sans text-xs">
                          No wastage or scrap stock movements found in the ledger.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* 4. GOOD FABRIC STOCK */}
              {activeTab === 'good' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">Item Code</th>
                      <th className="py-3 px-3">Quality</th>
                      <th className="py-3 px-3">Design</th>
                      <th className="py-3 px-3">Shade</th>
                      <th className="py-3 px-3">Lot / Taka</th>
                      <th className="py-3 px-3 text-right">Total Qty</th>
                      <th className="py-3 px-3 text-right">Available</th>
                      <th className="py-3 px-3 text-right">Reserved</th>
                      <th className="py-3 px-3">UOM</th>
                      <th className="py-3 px-3">Godown</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {paginatedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-600">{row.itemCode}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{row.quality}</td>
                        <td className="py-2 px-3 text-slate-600">{row.design}</td>
                        <td className="py-2 px-3 text-slate-600">{row.shade}</td>
                        <td className="py-2 px-3 font-mono text-slate-500 text-[10.5px]">{row.lotNo}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatQty(row.totalQty, '')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40">
                          {formatQty(row.available, '')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-400">
                          {formatQty(row.reserved, '')}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{row.uom}</td>
                        <td className="py-2 px-3 font-medium text-slate-700">{row.godown}</td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              row.status === 'Available'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td colSpan={12} className="py-10 text-center text-slate-400 font-sans text-xs">
                          No positive usable fabric stock records in inventory.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* 5. REPROCESSING STOCK */}
              {activeTab === 'reprocess' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">Item Code</th>
                      <th className="py-3 px-3">Quality</th>
                      <th className="py-3 px-3">Design</th>
                      <th className="py-3 px-3">Shade</th>
                      <th className="py-3 px-3">Lot / Taka</th>
                      <th className="py-3 px-3 text-right">Sent Qty</th>
                      <th className="py-3 px-3 text-right">Received Qty</th>
                      <th className="py-3 px-3 text-right">Pending Qty</th>
                      <th className="py-3 px-3">Process</th>
                      <th className="py-3 px-3">Vendor / Processor</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {paginatedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-600">{row.itemCode}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{row.quality}</td>
                        <td className="py-2 px-3 text-slate-600">{row.design}</td>
                        <td className="py-2 px-3 text-slate-600">{row.shade}</td>
                        <td className="py-2 px-3 font-mono text-slate-500 text-[10.5px]">{row.lotNo}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                          {formatQty(row.sentQty)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700">
                          {formatQty(row.receivedQty)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                          {formatQty(row.pendingQty)}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-700">{row.process}</td>
                        <td className="py-2 px-3 text-slate-600">{row.vendor}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td colSpan={12} className="py-10 text-center text-slate-400 font-sans text-xs">
                          No fabric currently out for reprocessing.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* 6. CUSTOMER RETURN STOCK */}
              {activeTab === 'customer-return' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">Item Code</th>
                      <th className="py-3 px-3">Quality</th>
                      <th className="py-3 px-3">Design</th>
                      <th className="py-3 px-3">Shade</th>
                      <th className="py-3 px-3">Lot / Taka</th>
                      <th className="py-3 px-3 text-right">Return Qty</th>
                      <th className="py-3 px-3">UOM</th>
                      <th className="py-3 px-3">Reason</th>
                      <th className="py-3 px-3">QC Status</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {paginatedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-600">{row.itemCode}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{row.quality}</td>
                        <td className="py-2 px-3 text-slate-600">{row.design}</td>
                        <td className="py-2 px-3 text-slate-600">{row.shade}</td>
                        <td className="py-2 px-3 font-mono text-slate-500 text-[10.5px]">{row.lotNo}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-purple-700">
                          {formatQty(row.returnQty, '')}
                        </td>
                        <td className="py-2 px-3 text-slate-500">{row.uom}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            {row.reason}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {row.qcStatus}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-700">{row.customer}</td>
                        <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">{row.date}</td>
                      </tr>
                    ))}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td colSpan={12} className="py-10 text-center text-slate-400 font-sans text-xs">
                          No customer returns recorded in the ledger.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination footer (#16 - Page Size Dropdown & Page Numbers) */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs gap-3">
              <span className="text-slate-500">
                Showing{' '}
                <strong className="text-slate-800">
                  {currentDataset.length ? (currentPage - 1) * pageSize + 1 : 0}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-800">
                  {Math.min(currentPage * pageSize, currentDataset.length)}
                </strong>{' '}
                of <strong className="text-slate-800">{currentDataset.length}</strong> entries
              </span>

              <div className="flex items-center gap-3">
                {/* Page Size Selector (#16: 10, 25, 50, 100 per page) */}
                <div className="flex items-center gap-1.5 text-slate-600">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-7 px-2 bg-white border border-slate-200 rounded text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-[11px] text-slate-500">per page</span>
                </div>

                {/* Page Numbers (#16: < 1 2 3 4 >) */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="w-7 h-7 grid place-items-center bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    ‹
                  </button>

                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                    const pNum = i + 1;
                    const isActive = pNum === currentPage;
                    return (
                      <button
                        key={pNum}
                        onClick={() => setCurrentPage(pNum)}
                        className={`w-7 h-7 grid place-items-center rounded text-xs font-bold transition cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="w-7 h-7 grid place-items-center bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── #12 VIEW DETAILS MODAL ────────────────────────────────────────── */}
      {viewModalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 grid place-items-center">
                  <Eye size={16} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Sample Details</h3>
                  <p className="text-[11px] text-slate-500">Ref: {viewModalRecord.issueNo}</p>
                </div>
              </div>
              <button
                onClick={() => setViewModalRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Item Code</span>
                  <span className="font-mono font-bold text-blue-600">{viewModalRecord.itemCode}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer</span>
                  <span className="font-bold text-slate-800">{viewModalRecord.customer}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Quality</span>
                  <span className="font-medium text-slate-700">{viewModalRecord.quality}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Design</span>
                  <span className="font-medium text-slate-700">{viewModalRecord.design}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Shade</span>
                  <span className="font-medium text-slate-700">{viewModalRecord.shade}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Lot / Taka</span>
                  <span className="font-mono font-semibold text-slate-600">{viewModalRecord.lotNo}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Issued Qty</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatQty(viewModalRecord.issuedQty, viewModalRecord.uom)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Returned Qty</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatQty(viewModalRecord.returnedQty, viewModalRecord.uom)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining Qty</span>
                  <span className="font-mono font-extrabold text-teal-700">
                    {formatQty(viewModalRecord.remainingQty, viewModalRecord.uom)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {viewModalRecord.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Issue Date</span>
                  <span className="font-mono text-slate-600">{viewModalRecord.issueDate}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Expected Return</span>
                  <span className="font-mono text-slate-600">{viewModalRecord.expectedReturnDate || '—'}</span>
                </div>
                {viewModalRecord.remarks && (
                  <div className="col-span-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Remarks</span>
                    <span className="text-slate-600 italic">{viewModalRecord.remarks}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setViewModalRecord(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── #13 RETURN SAMPLE MODAL ───────────────────────────────────────── */}
      {returnModalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 grid place-items-center">
                  <RotateCcw size={16} className="text-teal-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Return Sample</h3>
                  <p className="text-[11px] text-slate-500">Record sample return and update stock ledger</p>
                </div>
              </div>
              <button
                onClick={() => setReturnModalRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReturnSampleSubmit} className="p-5 space-y-4 text-xs">
              {returnSuccessMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>{returnSuccessMsg}</span>
                </div>
              )}

              {/* Sample Context Snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Sample Number</span>
                  <span className="font-mono font-bold text-blue-600">{returnModalRecord.issueNo}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer</span>
                  <span className="font-bold text-slate-800 truncate block">{returnModalRecord.customer}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Lot / Taka</span>
                  <span className="font-mono font-semibold text-slate-700">{returnModalRecord.lotNo}</span>
                </div>
                <div className="sm:col-span-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Fabric Item</span>
                  <span className="font-mono font-semibold text-slate-800">{returnModalRecord.itemCode}</span>
                  <span className="text-slate-600 ml-1.5 font-medium">({returnModalRecord.quality} • {returnModalRecord.design} • {returnModalRecord.shade})</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Original Issued</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {formatQty(returnModalRecord.issuedQty, returnModalRecord.uom)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Already Returned</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {formatQty(returnModalRecord.returnedQty, returnModalRecord.uom)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining Returnable</span>
                  <span className="font-mono font-black text-amber-700">
                    {formatQty(returnModalRecord.remainingQty, returnModalRecord.uom)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Return Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={returnForm.returnDate}
                    onChange={(e) => setReturnForm({ ...returnForm, returnDate: e.target.value })}
                    className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Actual Returned Qty ({returnModalRecord.uom || 'Mtr'}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={returnModalRecord.remainingQty}
                    required
                    value={returnForm.returnQty}
                    onChange={(e) => setReturnForm({ ...returnForm, returnQty: e.target.value })}
                    placeholder={`Max: ${returnModalRecord.remainingQty}`}
                    className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Fabric Condition & Routing <span className="text-rose-500">*</span>
                </label>
                <select
                  value={returnForm.condition}
                  onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })}
                  className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  <option value="usable">Good — back to the godown it was issued from</option>
                  <option value="hold">Hold — QC Hold location for inspection</option>
                  <option value="reprocess">Reprocess — Reprocess location</option>
                  <option value="second">Second Quality — Second Quality location</option>
                  <option value="wastage">Reject / Scrap — Reject location</option>
                </select>
                <div className="mt-1 text-[10.5px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {returnForm.condition === 'usable' && (
                    <span className="text-emerald-700 font-medium">✓ Restores available Good Fabric Stock ledger balance immediately.</span>
                  )}
                  {returnForm.condition === 'hold' && (
                    <span className="text-indigo-700 font-medium">⚠ Quarantined: Enters QC Inspection queue before release into stock.</span>
                  )}
                  {returnForm.condition === 'reprocess' && (
                    <span className="text-amber-700 font-medium">🔄 Moves to the Reprocess location.</span>
                  )}
                  {returnForm.condition === 'second' && (
                    <span className="text-cyan-700 font-medium">Moves to the Second Quality location (not available as good stock).</span>
                  )}
                  {returnForm.condition === 'wastage' && (
                    <span className="text-rose-700 font-medium">✕ Moves to the Reject / Scrap location.</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  value={returnForm.remarks}
                  onChange={(e) => setReturnForm({ ...returnForm, remarks: e.target.value })}
                  placeholder="e.g. Returned after client swatch approval"
                  className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReturnModalRecord(null)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReturn}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingReturn ? 'Saving Return...' : 'Save Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── #14 PRINT SAMPLE REPORT MODAL ─────────────────────────────────── */}
      {printModalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Printer size={16} className="text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">Sample Issue Report</h3>
              </div>
              <button
                onClick={() => setPrintModalRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Printable Report Canvas */}
            <div className="p-6 space-y-4 text-xs font-sans text-slate-800">
              {/* Report Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">OSCAR TEXTILE ERP</h2>
                  <p className="text-[11px] text-slate-500">Inventory & Fabric Movement Engine</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">Sample Issue Slip</span>
                  <span className="font-mono font-bold text-blue-600 text-xs">{printModalRecord.issueNo}</span>
                </div>
              </div>

              {/* Report Fields */}
              <div className="grid grid-cols-2 gap-y-2.5 text-xs py-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Issue Date</span>
                  <span className="font-medium text-slate-800">{printModalRecord.issueDate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer / Recipient</span>
                  <span className="font-bold text-slate-900">{printModalRecord.customer}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Fabric Item</span>
                  <span className="font-medium text-slate-800">{printModalRecord.itemCode} • {printModalRecord.itemName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Quality</span>
                  <span className="font-medium text-slate-800">{printModalRecord.quality}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Design / Shade</span>
                  <span className="font-medium text-slate-800">{printModalRecord.design} / {printModalRecord.shade}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Lot / Taka No.</span>
                  <span className="font-mono font-medium text-slate-800">{printModalRecord.lotNo}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Issued Quantity</span>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {formatQty(printModalRecord.issuedQty, printModalRecord.uom)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Status</span>
                  <span className="font-bold text-teal-700">{printModalRecord.status}</span>
                </div>
              </div>

              {/* Signatures */}
              <div className="flex items-center justify-between pt-10 border-t border-slate-200 text-[10px] text-slate-400 font-semibold uppercase">
                <div className="text-center w-44 normal-case font-normal">
                  <div className="border-b border-slate-300 mb-1 pb-1">
                    <SignatureSlot doc={sampleIssueSigs} signatory="authorized" label="Authorized Signatory" modalType="authorized" className="h-10" />
                  </div>
                  <span className="uppercase font-semibold">Authorized Signatory</span>
                </div>
                <div className="text-center w-44 normal-case font-normal">
                  <div className="border-b border-slate-300 mb-1 pb-1">
                    <SignatureSlot doc={sampleIssueSigs} signatory="receiver" label="Receiver's Signature" modalType="receiver" className="h-10"
                      defaultName={printModalRecord.customer || ''} defaultDesignation="Receiver" />
                  </div>
                  <span className="uppercase font-semibold">Receiver&apos;s Signature</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPrintModalRecord(null)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Printer size={13} />
                  Print Slip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SAMPLE HISTORY & AUDIT TRAIL MODAL ───────────────────────── */}
      {historyModalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 grid place-items-center">
                  <Clock size={16} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Sample Movement History & Audit Trail</h3>
                  <p className="text-[11px] text-slate-500">Ref: {historyModalRecord.issueNo}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Summary Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer</span>
                  <span className="font-bold text-slate-800 truncate block">{historyModalRecord.customer}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Fabric Item</span>
                  <span className="font-mono font-bold text-blue-600">{historyModalRecord.itemCode}</span>
                  <div className="text-[10px] text-slate-500 truncate">{historyModalRecord.itemName}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Quality / Lot</span>
                  <span className="font-medium text-slate-700">{historyModalRecord.quality} • {historyModalRecord.lotNo}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining Pending</span>
                  <span className="font-mono font-black text-amber-700">
                    {formatQty(historyModalRecord.remainingQty, historyModalRecord.uom)}
                  </span>
                </div>
              </div>

              {/* Audit Movements Timeline */}
              <div>
                <h4 className="font-bold text-slate-700 mb-2 uppercase text-[10px] tracking-wider">
                  Ledger Movement History
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Reference No.</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3">Routing / Condition</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {/* Initial Issue Movement */}
                      <tr className="bg-blue-50/20">
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded bg-blue-100/70 text-blue-800 font-bold text-[10px]">
                            Sample Issue
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{historyModalRecord.issueNo}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{historyModalRecord.issueDate}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          -{formatQty(historyModalRecord.issuedQty, historyModalRecord.uom)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">Good Stock ➔ Customer</td>
                        <td className="py-2.5 px-3 text-slate-500 italic max-w-[150px] truncate">
                          {historyModalRecord.remarks || 'Sample Issued'}
                        </td>
                      </tr>

                      {/* Return Movements */}
                      {(historyModalRecord.history || []).map((ret, idx) => (
                        <tr key={ret.movementId || idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100/70 text-emerald-800 font-bold text-[10px]">
                              Return #{idx + 1}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">{ret.returnNo}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{ret.date}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            +{formatQty(ret.qty, historyModalRecord.uom)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              ret.condition?.includes('Usable') || ret.condition?.includes('Good')
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : ret.condition?.includes('QC')
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : ret.condition?.includes('Reprocess')
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {ret.condition}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 italic max-w-[150px] truncate">
                            {ret.remarks}
                          </td>
                        </tr>
                      ))}

                      {(!historyModalRecord.history || historyModalRecord.history.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-3 px-3 text-center text-slate-400 italic">
                            No return transactions posted yet. Full quantity of {formatQty(historyModalRecord.issuedQty, historyModalRecord.uom)} remains outstanding.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="text-[11px] text-slate-500">
                  Status: <span className="font-bold text-slate-700">{historyModalRecord.status}</span>
                  {historyModalRecord.expectedReturnDate && (
                    <span className="ml-2">• Expected: <span className="font-mono text-slate-700">{historyModalRecord.expectedReturnDate}</span></span>
                  )}
                </div>
                <button
                  onClick={() => setHistoryModalRecord(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── #10 ISSUE SAMPLE MODAL ────────────────────────────────────────── */}
      {isSampleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 grid place-items-center">
                  <FlaskConical size={16} className="text-teal-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Issue Fabric Sample</h3>
                  <p className="text-[11px] text-slate-500">Deduct sample fabric from Good Fabric Stock ledger</p>
                </div>
              </div>
              <button
                onClick={() => setIsSampleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleIssueSampleSubmit} className="p-5 space-y-3.5 text-xs">
              {sampleSuccessMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>{sampleSuccessMsg}</span>
                </div>
              )}

              {/* Customer selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">
                    Customer / Recipient <span className="text-rose-500">*</span>
                  </label>
                  <MasterSourceLink source="customers" />
                </div>
                <div className="space-y-1">
                  <select
                    value={customers.some((c) => c.name === sampleForm.customer) ? sampleForm.customer : (sampleForm.customer ? '__other__' : '')}
                    onChange={(e) => {
                      if (e.target.value === '__other__') {
                        setSampleForm({ ...sampleForm, customer: '' });
                      } else {
                        setSampleForm({ ...sampleForm, customer: e.target.value });
                      }
                    }}
                    className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  >
                    <option value="">Select Existing Customer / Party Master</option>
                    {customers.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name} {c.party_code ? `(${c.party_code})` : ''}
                      </option>
                    ))}
                    <option value="__other__">+ Enter Custom / Other Recipient</option>
                  </select>
                  {(!customers.some((c) => c.name === sampleForm.customer) || !sampleForm.customer) && (
                    <input
                      type="text"
                      required
                      value={sampleForm.customer}
                      onChange={(e) => setSampleForm({ ...sampleForm, customer: e.target.value })}
                      placeholder="Type Customer / Buyer Name directly..."
                      className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  )}
                </div>
              </div>

              {/* Fabric Item Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">
                    Fabric Item / Variant <span className="text-rose-500">*</span>
                  </label>
                  <MasterSourceLink source="items" />
                </div>
                <select
                  required
                  value={sampleForm.itemId}
                  onChange={(e) => handleSampleItemSelect(e.target.value)}
                  className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  <option value="">Search / Select Fabric Item</option>
                  {(items || []).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.sku} — {i.name} ({i.fabric_quality || 'Fabric'} • {i.fabric_design || 'Plain'} • {i.fabric_color || 'Default'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-populated Fabric Details Snapshot */}
              {sampleForm.itemId && (
                <div className="grid grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[10.5px]">
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Quality</span>
                    <span className="font-semibold text-slate-800 truncate block">{sampleForm.quality}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Design</span>
                    <span className="font-semibold text-slate-800 truncate block">{sampleForm.design}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Shade</span>
                    <span className="font-semibold text-slate-800 truncate block">{sampleForm.shade}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">UOM</span>
                    <span className="font-semibold text-blue-700 uppercase block">{sampleForm.uom}</span>
                  </div>
                </div>
              )}

              {/* Available Good Fabric Stock Banner */}
              {sampleForm.itemId && (
                <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                  sampleForm.availableStock !== null && sampleForm.availableStock > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className={sampleForm.availableStock > 0 ? 'text-emerald-600' : 'text-rose-600'} />
                    <span className="font-bold">Available Good Fabric Stock:</span>
                  </div>
                  <span className="font-mono font-black text-sm">
                    {sampleForm.availableStock !== null ? `${formatQty(sampleForm.availableStock, sampleForm.uom)}` : 'Checking...'}
                  </span>
                </div>
              )}

              {/* Lot / Taka and Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lot / Taka Number</label>
                  {/* If available lots exist for this item, allow dropdown select or custom */}
                  {(data?.filters?.availableLots || []).filter((l) => String(l.itemId) === String(sampleForm.itemId)).length > 0 ? (
                    <select
                      value={sampleForm.lotTakaId || (sampleForm.locationId ? `loc:${sampleForm.locationId}` : '')}
                      onChange={(e) => handleSampleLotSelect(e.target.value)}
                      className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    >
                      {(data?.filters?.availableLots || [])
                        .filter((l) => String(l.itemId) === String(sampleForm.itemId))
                        .map((l, idx) => (
                          <option key={idx} value={l.lotTakaId || `loc:${l.locationId}`}>
                            {l.lotNo || 'Not on takas'} — {l.godown} ({l.available} {l.uom})
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={sampleForm.lotNo}
                      onChange={(e) => setSampleForm({ ...sampleForm, lotNo: e.target.value })}
                      placeholder="e.g. LT-001"
                      className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Sample Issue Qty ({sampleForm.uom || 'Mtr'}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={sampleForm.availableStock !== null && sampleForm.availableStock > 0 ? sampleForm.availableStock : undefined}
                    required
                    value={sampleForm.qty}
                    onChange={(e) => setSampleForm({ ...sampleForm, qty: e.target.value })}
                    placeholder="Enter Quantity"
                    className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                  />
                  {sampleForm.availableStock !== null && Number(sampleForm.qty) > sampleForm.availableStock && (
                    <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
                      Exceeds available stock ({sampleForm.availableStock} {sampleForm.uom})
                    </span>
                  )}
                </div>
              </div>

              {/* Source Godown & Expected Return Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Source Godown</label>
                    <MasterSourceLink source="godowns" />
                  </div>
                  <select
                    value={sampleForm.locationId}
                    onChange={(e) => setSampleForm({ ...sampleForm, locationId: e.target.value })}
                    className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Default Godown</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expected Return Date</label>
                  <input
                    type="date"
                    value={sampleForm.expectedReturnDate}
                    onChange={(e) => setSampleForm({ ...sampleForm, expectedReturnDate: e.target.value })}
                    className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Purpose / Remarks</label>
                <input
                  type="text"
                  value={sampleForm.notes}
                  onChange={(e) => setSampleForm({ ...sampleForm, notes: e.target.value })}
                  placeholder="e.g. Swatch sample for client approval"
                  className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <span className="text-[10.5px] text-slate-400">
                  Issued By: <span className="font-semibold text-slate-600">{currentUser?.name || 'Authorized Officer'}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSampleModalOpen(false)}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingSample || (sampleForm.availableStock !== null && Number(sampleForm.qty) > sampleForm.availableStock)}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submittingSample ? 'Saving & Posting...' : 'Issue Sample'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CONFIGURE COMBINED GREY STOCK THRESHOLD MODAL ────────────────── */}
      {isThresholdModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Configure Combined Grey Stock Threshold</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsThresholdModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingThreshold(true);
                setThresholdError(null);
                try {
                  const val = parseFloat(thresholdInput) || 0;
                  await inventoryService.updateCombinedGreyStockSetting({
                    threshold: val,
                    isEnabled: thresholdEnabled,
                    uom: 'Mtr',
                  });
                  setIsThresholdModalOpen(false);
                  fetchData(true);
                } catch (err) {
                  console.error('Failed to update threshold:', err);
                  setThresholdError(err?.message || 'Failed to update threshold setting.');
                } finally {
                  setIsSavingThreshold(false);
                }
              }}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Minimum Total Grey Stock Level (Meters) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  placeholder="e.g. 10000"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 font-mono font-bold focus:bg-white focus:outline-blue-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Single minimum threshold applied to total available grey fabric across all qualities. Metric: Available Grey = Physical Grey - Sales Reservations.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-800 block">Enable Low-Stock Alert</span>
                  <span className="text-[11px] text-slate-500">
                    Triggers Alert Center incident and topbar notification when breached.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={thresholdEnabled}
                  onChange={(e) => setThresholdEnabled(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </div>

              {thresholdError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {thresholdError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsThresholdModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingThreshold}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSavingThreshold ? 'Saving...' : 'Save Threshold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockPositionPage;

