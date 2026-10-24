import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useERP } from '../../context/ERPContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import {
  Plus, MapPin, AlertTriangle, Layers, Tag, Zap, CheckCircle2, Upload,
  DollarSign, Package, Cpu, QrCode, Shirt, Palette, ShoppingCart, Trash2,
  Search, Info, Clock, ArrowRight, X, ChevronDown, MoreVertical, RefreshCw,
  AlertCircle, ExternalLink, ChevronLeft, ChevronRight, Sliders
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BarcodeLabelModal } from '../../components/common/BarcodeLabelModal';
import { ImportModal } from '../../components/common/ImportModal';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import { inventoryService } from '../../services/domainServices';
import { describeError, isServerId } from '../../services/backendSync';

/** Map a fabric colour name to a display hex for the swatch dot. */
const FABRIC_COLOR_HEX = {
  white: '#f8fafc', black: '#0f172a', blue: '#2563eb', red: '#dc2626',
  grey: '#9ca3af', gray: '#9ca3af', green: '#16a34a', yellow: '#eab308',
  pink: '#ec4899', orange: '#ea580c', purple: '#9333ea', brown: '#92400e',
  beige: '#d6c9a8', navy: '#1e3a8a', maroon: '#7f1d1d', cream: '#fef3c7',
};
const fabricColorHex = (name) =>
  FABRIC_COLOR_HEX[String(name || '').trim().toLowerCase()] || '#cbd5e1';

function formatQtyNumber(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const num = Math.round(Number(val));
  return num.toLocaleString('en-IN');
}

function formatINR(val) {
  if (val === null || val === undefined || isNaN(val)) return '₹0.00';
  const num = Number(val);
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const ItemsMasterPage = () => {
  const {
    items,
    itemParts = [],
    addInventoryItem,
    deleteInventoryItem,
    refreshCollections,
    vendors = [],
    addPurchaseOrder,
    formatCurrency,
    showToast,
    getCurrentISODate,
    addDaysISO,
  } = useERP();

  const navigate = useNavigate();
  const location = useLocation();

  // Route modes
  const isFabricView = location.pathname.includes('/fabric');
  const isMachineView = location.pathname.includes('/machines');

  // Modals state
  const [selectedBarcodeItem, setSelectedBarcodeItem] = useState(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [showShortageModal, setShowShortageModal] = useState(false);
  const [poModalConfig, setPoModalConfig] = useState(null); // { isOpen, item, suggestedQty, vendorId }
  const [deleteModalConfig, setDeleteModalConfig] = useState({
    isOpen: false,
    items: [],
    loading: false,
  });

  // Filter state
  const [qualityFilter, setQualityFilter] = useState('All');
  const [designFilter, setDesignFilter] = useState('All');
  const [colorFilter, setColorFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination & selection
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Live Authoritative Combined Grey Stock from backend
  const [combinedStockData, setCombinedStockData] = useState({
    physicalGrey: 0,
    reservedGrey: 0,
    availableGrey: 0,
    externalWip: 0,
    wipByParty: [],
    uom: 'Mtr',
    qualitiesCount: 0,
    threshold: 0,
    shortage: 0,
    status: 'Sufficient',
    isConfigured: false,
    isEnabled: true,
    loading: true,
  });

  // Threshold form state
  const [thresholdInput, setThresholdInput] = useState('');
  const [thresholdEnabled, setThresholdEnabled] = useState(true);
  const [savingThreshold, setSavingThreshold] = useState(false);

  // Fetch backend combined grey stock calculation
  const fetchCombinedGreyStock = useCallback(async () => {
    try {
      const res = await inventoryService.getCombinedGreyStock();
      const data = res?.data || res || {};
      setCombinedStockData({
        physicalGrey: Number(data.physicalGrey || 0),
        reservedGrey: Number(data.reservedGrey || 0),
        availableGrey: Number(data.availableGrey || 0),
        externalWip: Number(data.externalWip || 0),
        wipByParty: data.wipByParty || [],
        uom: data.uom || 'Mtr',
        qualitiesCount: Number(data.qualitiesCount || 0),
        threshold: Number(data.threshold || 0),
        shortage: Number(data.shortage || 0),
        status: data.status || (data.shortage > 0 ? 'Low Stock' : 'Sufficient'),
        isConfigured: Boolean(data.isConfigured),
        isEnabled: data.isEnabled !== false,
        loading: false,
      });
      if (data.threshold !== undefined) {
        setThresholdInput(String(data.threshold));
      }
      if (data.isEnabled !== undefined) {
        setThresholdEnabled(data.isEnabled);
      }
    } catch (err) {
      console.warn('Failed to fetch combined grey stock from backend:', err);
      setCombinedStockData((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchCombinedGreyStock();
  }, [fetchCombinedGreyStock]);

  // Handle saving the minimum combined grey stock threshold
  const handleSaveThreshold = async (e) => {
    e.preventDefault();
    const val = parseFloat(thresholdInput);
    if (isNaN(val) || val < 0) {
      showToast?.('Please enter a valid threshold in meters.');
      return;
    }
    setSavingThreshold(true);
    try {
      await inventoryService.updateCombinedGreyStockSetting({
        threshold: val,
        is_enabled: thresholdEnabled,
        channels: ['in_app', 'email'],
      });
      showToast?.('Minimum Grey Stock threshold updated successfully.');
      setShowThresholdModal(false);
      await fetchCombinedGreyStock();
    } catch (err) {
      showToast?.('Failed to update minimum threshold.');
    } finally {
      setSavingThreshold(false);
    }
  };

  // Base list of items
  const baseItems = useMemo(() => {
    // Deleting an item archives it on the server (history is kept), so hide archived rows.
    const live = items.filter((i) => i.lifecycleStatus !== 'Archived');
    if (isMachineView) {
      return live.filter((i) => i.itemKind === 'Machine');
    }
    // Default to fabric inventory for Total Inventory / Fabric views
    return live.filter((i) => i.itemKind === 'Fabric' || (!isMachineView && (i.fabricQuality || i.category?.includes('Fabric'))));
  }, [items, isMachineView]);

  // Distinct filter options
  const uniqueQualities = useMemo(() => {
    return [...new Set(baseItems.map((i) => i.fabricQuality || i.name).filter(Boolean))].sort();
  }, [baseItems]);

  const uniqueDesigns = useMemo(() => {
    return [...new Set(baseItems.map((i) => i.fabricDesign).filter(Boolean))].sort();
  }, [baseItems]);

  const uniqueColors = useMemo(() => {
    return [...new Set(baseItems.map((i) => i.fabricColor).filter(Boolean))].sort();
  }, [baseItems]);

  const uniqueLocations = useMemo(() => {
    return [...new Set(baseItems.map((i) => i.location).filter(Boolean))].sort();
  }, [baseItems]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return baseItems.filter((i) => {
      // Quality filter
      if (qualityFilter !== 'All') {
        const q = (i.fabricQuality || i.name || '').toLowerCase();
        if (q !== qualityFilter.toLowerCase()) return false;
      }
      // Design filter
      if (designFilter !== 'All') {
        const d = (i.fabricDesign || '').toLowerCase();
        if (d !== designFilter.toLowerCase()) return false;
      }
      // Color filter
      if (colorFilter !== 'All') {
        const c = (i.fabricColor || '').toLowerCase();
        if (c !== colorFilter.toLowerCase()) return false;
      }
      // Location filter
      if (locationFilter !== 'All') {
        const l = (i.location || '').toLowerCase();
        if (l !== locationFilter.toLowerCase()) return false;
      }
      // Stock Status filter
      if (statusFilter !== 'All') {
        const st = (i.status || '').toLowerCase();
        const sf = statusFilter.toLowerCase();
        if (sf === 'normal' && !['normal', 'optimal', 'available'].includes(st)) return false;
        if (sf === 'low stock' && st !== 'low stock') return false;
        if (sf === 'watch' && !['watch', 'warning', 'critical'].includes(st)) return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchSku = String(i.sku || '').toLowerCase().includes(term);
        const matchName = String(i.name || '').toLowerCase().includes(term);
        const matchQuality = String(i.fabricQuality || '').toLowerCase().includes(term);
        const matchDesign = String(i.fabricDesign || '').toLowerCase().includes(term);
        const matchColor = String(i.fabricColor || '').toLowerCase().includes(term);
        const matchLocation = String(i.location || '').toLowerCase().includes(term);
        if (!matchSku && !matchName && !matchQuality && !matchDesign && !matchColor && !matchLocation) {
          return false;
        }
      }
      return true;
    });
  }, [baseItems, qualityFilter, designFilter, colorFilter, locationFilter, statusFilter, searchTerm]);

  // Reset all filters
  const handleResetFilters = () => {
    setQualityFilter('All');
    setDesignFilter('All');
    setColorFilter('All');
    setLocationFilter('All');
    setStatusFilter('All');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Paginated items
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Selection helpers
  const allOnPageSelected = paginatedItems.length > 0 && paginatedItems.every((i) => selectedIds.has(String(i.id)));
  const someOnPageSelected = paginatedItems.length > 0 && paginatedItems.some((i) => selectedIds.has(String(i.id)));

  const handleToggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedItems.forEach((i) => next.delete(String(i.id)));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedItems.forEach((i) => next.add(String(i.id)));
        return next;
      });
    }
  };

  const handleToggleSelect = (id) => {
    const idStr = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idStr)) next.delete(idStr);
      else next.add(idStr);
      return next;
    });
  };

  // Bulk / Single Delete Handlers
  const handleDeleteItem = (item) => {
    setDeleteModalConfig({
      isOpen: true,
      items: [item],
      loading: false,
    });
  };

  const handleBulkDeleteSelected = () => {
    const selected = items.filter((i) => selectedIds.has(String(i.id)));
    if (selected.length === 0) return;
    setDeleteModalConfig({
      isOpen: true,
      items: selected,
      loading: false,
    });
  };

  const handleConfirmDelete = async () => {
    setDeleteModalConfig((prev) => ({ ...prev, loading: true }));
    try {
      const toDelete = deleteModalConfig.items;
      const deleted = [];
      const failed = [];
      // Wait for the server so a refused delete (e.g. item used on an open PO)
      // is reported instead of the row silently coming back on next refresh.
      for (const it of toDelete) {
        if (!isServerId(it.id)) {
          deleteInventoryItem?.(it.id);
          deleted.push(it);
          continue;
        }
        try {
          await inventoryService.deleteItem(it.id);
          deleted.push(it);
        } catch (e) {
          failed.push(`${it.sku || it.name}: ${describeError(e)}`);
        }
      }
      if (deleted.length && typeof refreshCollections === 'function') {
        await refreshCollections(['items']);
      }
      if (deleted.length) showToast?.(`Deleted ${deleted.length} item(s) successfully.`);
      if (failed.length) showToast?.(`Could not delete ${failed.length} item(s) — ${failed.join('; ')}`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deleted.forEach((it) => next.delete(String(it.id)));
        return next;
      });
      setDeleteModalConfig({ isOpen: false, items: [], loading: false });
    } catch (err) {
      showToast?.('Error deleting items: ' + (err?.message || 'Failed'));
      setDeleteModalConfig((prev) => ({ ...prev, loading: false }));
    }
  };

  // Bulk PO Handler
  const handleBulkCreatePo = () => {
    const selected = items.filter((i) => selectedIds.has(String(i.id)));
    if (selected.length === 0) return;
    const first = selected[0];
    const vendorId = first.vendorId || first.vendor_id || vendors[0]?.id || '';
    setPoModalConfig({
      isOpen: true,
      mode: 'bulk',
      item: first,
      selectedItems: selected,
      suggestedQty: selected.reduce((acc, it) => {
        const avail = Number(it.availableQty ?? it.stock ?? 0);
        const reorder = Number(it.reorderLevel ?? 500);
        return acc + Math.max(reorder, reorder - avail > 0 ? reorder - avail : 500);
      }, 0),
      vendorId: vendorId,
    });
  };

  // Bulk Export Handler
  const handleExportSelected = () => {
    const selected = items.filter((i) => selectedIds.has(String(i.id)));
    if (selected.length === 0) return;
    const headers = ['Sr. No', 'SKU', 'Fabric Quality', 'Design', 'Colour', 'Total Stock (m)', 'Reserved (m)', 'Available (m)', 'Unit Cost', 'Selling Rate', 'Status', 'Reorder Qty'];
    const rows = selected.map((it, idx) => [
      idx + 1,
      `"${it.sku || ''}"`,
      `"${it.fabricQuality || it.name || ''}"`,
      `"${it.fabricDesign || ''}"`,
      `"${it.fabricColor || ''}"`,
      Number(it.onHandQty ?? it.stock ?? it.availableQty ?? 0),
      Number(it.reservedQty ?? 0),
      Number(it.availableQty ?? it.stock ?? 0),
      Number(it.costPrice ?? it.unitCost ?? 0),
      Number(it.sellingPrice ?? 0),
      `"${it.status || 'Normal'}"`,
      Number(it.reorderLevel ?? 0),
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fabric_inventory_selected_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.(`Exported ${selected.length} selected items to CSV.`);
  };

  // CSV Import handler
  const handleImportCsv = (rows) => {
    const num = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : undefined;
    };
    let skipped = 0;
    rows.forEach((r) => {
      const name = (r['NAME'] || r['Name'] || r['Product Name'] || '').trim();
      if (!name) { skipped += 1; return; }
      addInventoryItem({
        sku: r['SKU'] || r['Sku'] || r['Part Number'] || '',
        name,
        category: r['CATEGORY'] || r['Category'] || 'Fabric',
        itemKind: 'Fabric',
        uom: r['UOM'] || r['Unit'] || 'Mtr',
        unitCost: num(r['COST'] || r['Cost Price'] || r['costPrice']),
        costPrice: num(r['COST'] || r['Cost Price'] || r['costPrice']),
        sellingPrice: num(r['PRICE'] || r['Selling Price'] || r['sellingPrice']),
        reorderLevel: num(r['REORDER'] || r['Reorder Level']),
      });
    });
    if (skipped > 0) {
      showToast?.(`${skipped} row(s) skipped — the item name is required.`);
    }
  };

  // ── Purchase Order Creation Integration ──
  // 1. Open PO modal for a single item row
  const handleOpenPoForSingleItem = (item) => {
    const avail = Number(item.availableQty ?? item.stock ?? 0);
    const reorder = Number(item.reorderLevel || 500);
    const suggestedQty = Math.max(100, reorder * 2 - avail);
    setPoModalConfig({
      isOpen: true,
      mode: 'single',
      item,
      itemsList: [{
        itemId: item.id,
        sku: item.sku,
        name: item.name || item.fabricQuality,
        qty: suggestedQty,
        rate: Number(item.costPrice ?? item.unitCost ?? 0),
        uom: item.purchaseUnit || item.uom || 'Mtr',
      }],
      vendorId: item.vendorId || item.vendor_id || (vendors[0]?.id || ''),
      notes: `Replenishment PO for ${item.name || item.sku} (Available: ${avail} Mtr, Reorder: ${reorder} Mtr)`,
    });
  };

  // 2. Open PO modal for the combined shortage alert
  const handleOpenPoForShortage = () => {
    const shortageAmount = combinedStockData.shortage || 1000;
    // Find items below reorder level or distribute shortage across top fabric qualities
    const lowItems = baseItems.filter((i) => Number(i.availableQty ?? i.stock ?? 0) <= Number(i.reorderLevel || 500));
    const targetItems = lowItems.length > 0 ? lowItems : baseItems.slice(0, 4);
    const perItemQty = Math.max(100, Math.round(shortageAmount / (targetItems.length || 1)));

    const lines = targetItems.map((it) => ({
      itemId: it.id,
      sku: it.sku,
      name: it.name || it.fabricQuality,
      qty: perItemQty,
      rate: Number(it.costPrice ?? it.unitCost ?? 0),
      uom: it.purchaseUnit || it.uom || 'Mtr',
    }));

    setPoModalConfig({
      isOpen: true,
      mode: 'shortage',
      itemsList: lines,
      vendorId: vendors[0]?.id || '',
      notes: `Replenishment PO for Grey Fabric combined shortage of ${formatQtyNumber(shortageAmount)} Mtr.`,
    });
  };

  // 3. Submit PO to backend via useERP
  const [submittingPo, setSubmittingPo] = useState(false);
  const handleSubmitPo = async (e) => {
    e.preventDefault();
    if (!poModalConfig || !poModalConfig.vendorId) {
      showToast?.('Please select a supplier/vendor.');
      return;
    }
    const validLines = (poModalConfig.itemsList || []).filter((l) => Number(l.qty) > 0);
    if (validLines.length === 0) {
      showToast?.('Please specify a positive quantity for at least one fabric line.');
      return;
    }

    setSubmittingPo(true);
    try {
      const newPo = await addPurchaseOrder({
        vendorId: poModalConfig.vendorId,
        date: getCurrentISODate(),
        expectedDate: addDaysISO(getCurrentISODate(), 10),
        status: 'Draft',
        items: validLines.map((l) => ({
          itemId: l.itemId,
          itemSku: l.sku,
          description: l.name,
          qty: Number(l.qty),
          rate: Number(l.rate || 0),
          amount: Number(l.qty) * Number(l.rate || 0),
          uom: l.uom || 'Mtr',
        })),
        notes: poModalConfig.notes || '',
      });
      setPoModalConfig(null);
      showToast?.(`Purchase Order ${newPo.poNumber || ''} created successfully in Draft status.`);
      fetchCombinedGreyStock();
    } catch (err) {
      // Reason displayed by context toast
    } finally {
      setSubmittingPo(false);
    }
  };

  const newItemKind = isFabricView ? 'Fabric' : isMachineView ? 'Machine' : 'Fabric';

  return (
    <div className="space-y-5 pb-12">
      {/* ── Top Header / Breadcrumb ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {/* Breadcrumb matching image */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1 font-medium">
            <Link to="/inventory/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</Link>
            <ChevronRight size={12} className="text-slate-300" />
            <span>Inventory</span>
            <ChevronRight size={12} className="text-slate-300" />
            <span className="text-slate-700 font-semibold">Total Inventory</span>
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Total Inventory – Grey Fabric
            </h1>
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 rounded-full hover:bg-slate-100 cursor-pointer"
              title="Page Guide & System Details"
            >
              <Info size={18} />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete grey fabric inventory with stock status, low stock alerts and replenishment.
          </p>
        </div>

        {/* Action Buttons Top Right matching image */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
          <button
            type="button"
            className="btn-outline flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-2xs cursor-pointer transition-colors"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload size={14} />
            Import CSV
          </button>
          <button
            type="button"
            className="btn-outline flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-2xs cursor-pointer transition-colors"
            onClick={() => navigate('/inventory/categories')}
          >
            <Layers size={14} />
            Categories
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-2xs cursor-pointer transition-colors"
            onClick={() => navigate(`/inventory/items/new?kind=${newItemKind}`)}
          >
            <Plus size={15} />
            {isMachineView ? 'Add New Machine' : 'Add Fabric'}
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards & Shortage Alert Banner (Matching Attached Reference Image) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* 4 Stat Cards */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Card 1: Total Grey Fabric Stock */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-blue-300 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Shirt size={16} />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 leading-tight">Total Grey Fabric Stock</span>
            </div>
            <div className="mt-2.5">
              <span className="text-xl font-black text-slate-900 tracking-tight">
                {formatQtyNumber(combinedStockData.availableGrey)} m
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Available for processing</span>
            </div>
          </div>

          {/* Card 2: Minimum Stock Level */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-amber-300 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock size={16} />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 leading-tight">Minimum Stock Level</span>
            </div>
            <div className="mt-2.5">
              <span className="text-xl font-black text-slate-900 tracking-tight">
                {combinedStockData.isConfigured ? `${formatQtyNumber(combinedStockData.threshold)} m` : 'Not Set'}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Configured for grey fabric</span>
            </div>
          </div>

          {/* Card 3: Shortage */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-rose-300 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                combinedStockData.shortage > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                <AlertTriangle size={16} />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 leading-tight">Shortage</span>
            </div>
            <div className="mt-2.5">
              <span className={`text-xl font-black tracking-tight ${
                combinedStockData.shortage > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}>
                {formatQtyNumber(combinedStockData.shortage)} m
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {combinedStockData.shortage > 0 ? 'Below minimum level' : 'Sufficient safety buffer'}
              </span>
            </div>
          </div>

          {/* Card 4: Total Fabric Types */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between hover:border-indigo-300 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Layers size={16} />
              </div>
              <span className="text-[11px] font-semibold text-slate-500 leading-tight">Total Fabric Types</span>
            </div>
            <div className="mt-2.5">
              <span className="text-xl font-black text-slate-900 tracking-tight">
                {combinedStockData.qualitiesCount || uniqueQualities.length || 12}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Grey fabric qualities</span>
            </div>
          </div>
        </div>

        {/* Right Alert Banner Card (Red Box from Image) */}
        <div className="lg:col-span-4 flex">
          {combinedStockData.shortage > 0 ? (
            <div className="w-full bg-rose-50/70 border-l-4 border-rose-600 border-y border-r border-rose-200 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-rose-950 leading-tight">
                    Grey Fabric Stock Below Minimum Level
                  </h4>
                  <p className="text-[11px] text-rose-800 mt-1 leading-snug">
                    Total grey fabric stock is <strong>{formatQtyNumber(combinedStockData.availableGrey)} meters</strong>, which is <strong>{formatQtyNumber(combinedStockData.shortage)} meters</strong> below the minimum level of {formatQtyNumber(combinedStockData.threshold)} meters.
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-rose-200/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleOpenPoForShortage}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <ShoppingCart size={13} />
                  Create PO
                </button>
                <button
                  type="button"
                  onClick={() => setShowShortageModal(true)}
                  className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                >
                  View Details
                </button>
              </div>
            </div>
          ) : !combinedStockData.isConfigured ? (
            <div className="w-full bg-amber-50/80 border-l-4 border-amber-500 border-y border-r border-amber-200 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-950">Minimum Stock Level Not Configured</h4>
                  <p className="text-[11px] text-amber-800 mt-1 leading-snug">
                    Set a combined grey fabric threshold to activate automated low-stock notifications and replenishment advice.
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-amber-200/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowThresholdModal(true)}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  Configure Minimum Level
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full bg-emerald-50/70 border-l-4 border-emerald-600 border-y border-r border-emerald-200 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">Grey Fabric Stock Sufficient</h4>
                  <p className="text-[11px] text-emerald-800 mt-1 leading-snug">
                    Available grey stock ({formatQtyNumber(combinedStockData.availableGrey)} m) safely exceeds the configured minimum level of {formatQtyNumber(combinedStockData.threshold)} m.
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-emerald-200/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowThresholdModal(true)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                >
                  Adjust Threshold ({formatQtyNumber(combinedStockData.threshold)} m)
                </button>
                <button
                  type="button"
                  onClick={handleOpenPoForShortage}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                >
                  <ShoppingCart size={12} />
                  New PO
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Filter Controls Row (Matching Attached Reference Image) ── */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* 1. Fabric Quality */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Fabric Quality</label>
            <select
              value={qualityFilter}
              onChange={(e) => { setQualityFilter(e.target.value); setCurrentPage(1); }}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-700"
            >
              <option value="All">All</option>
              {uniqueQualities.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          {/* 2. Design */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Design</label>
            <select
              value={designFilter}
              onChange={(e) => { setDesignFilter(e.target.value); setCurrentPage(1); }}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-700"
            >
              <option value="All">All</option>
              {uniqueDesigns.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* 3. Shade / Colour */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Shade / Colour</label>
            <select
              value={colorFilter}
              onChange={(e) => { setColorFilter(e.target.value); setCurrentPage(1); }}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-700"
            >
              <option value="All">All</option>
              {uniqueColors.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 4. Warehouse */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Warehouse</label>
            <select
              value={locationFilter}
              onChange={(e) => { setLocationFilter(e.target.value); setCurrentPage(1); }}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-700"
            >
              <option value="All">All</option>
              {uniqueLocations.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* 5. Stock Status */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Stock Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-700"
            >
              <option value="All">All</option>
              <option value="Normal">Normal</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Watch">Watch</option>
            </select>
          </div>

          {/* 6. Search & Reset */}
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Search</label>
              <Search size={14} className="absolute left-2.5 top-[30px] text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Search SKU, quality, name..."
                className="w-full text-xs border border-slate-200 rounded-lg pl-8 pr-2.5 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 text-slate-700"
              />
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-[35px] px-3 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shrink-0 cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* ── Fabric Inventory Table (Exact Columns & Design from Reference Image) ── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold text-[11px]">
                <th className="py-3 px-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 accent-blue-600 text-blue-600 focus:ring-blue-500 cursor-pointer transition"
                    title={allOnPageSelected ? 'Deselect all on this page' : 'Select all on this page'}
                  />
                </th>
                <th className="py-3 px-2 text-center w-14">Sr. No.</th>
                <th className="py-3 px-3">SKU / Model #</th>
                <th className="py-3 px-3">Fabric Quality</th>
                <th className="py-3 px-3">Design</th>
                <th className="py-3 px-3">Shade / Colour</th>
                <th className="py-3 px-3 text-right">Total Stock (m)</th>
                <th className="py-3 px-3 text-right">Reserved (m)</th>
                <th className="py-3 px-3 text-right">Available (m)</th>
                <th className="py-3 px-3 text-right">Unit Cost (₹)</th>
                <th className="py-3 px-3 text-right">Selling Rate (₹)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Reorder Qty (m)</th>
                <th className="py-3 px-3 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan="14" className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No fabric inventory records found.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try clearing your filters or adding a new fabric item.</p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const srNo = (currentPage - 1) * pageSize + idx + 1;
                  const isChecked = selectedIds.has(String(item.id));
                  const onHand = Number(item.onHandQty ?? item.stock ?? item.availableQty ?? 0);
                  const reserved = Number(item.reservedQty ?? 0);
                  const avail = Number(item.availableQty ?? item.stock ?? 0);
                  const cost = Number(item.costPrice ?? item.unitCost ?? 0);
                  const sell = Number(item.sellingPrice ?? 0);
                  const reorder = Number(item.reorderLevel ?? 0);

                  // Status mapping
                  const rawStatus = String(item.status || '').toLowerCase();
                  let displayStatus = 'Normal';
                  let statusTone = 'emerald';
                  if (rawStatus === 'critical' || rawStatus === 'low stock' || (reorder > 0 && avail <= reorder)) {
                    displayStatus = 'Low Stock';
                    statusTone = 'rose';
                  } else if (rawStatus === 'watch' || rawStatus === 'warning') {
                    displayStatus = 'Watch';
                    statusTone = 'amber';
                  }

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isChecked ? 'bg-blue-50/50 font-medium' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3 px-3.5 text-center cursor-pointer select-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelect(item.id);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(item.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-slate-300 accent-blue-600 text-blue-600 focus:ring-blue-500 cursor-pointer transition"
                        />
                      </td>

                      {/* Sr. No. */}
                      <td className="py-3 px-2 text-center font-mono text-slate-500 text-[11px]">
                        {srNo}
                      </td>

                      {/* SKU / Model # */}
                      <td className="py-3 px-3">
                        <Link
                          to={`/inventory/items/edit/${item.id}`}
                          className="font-mono font-bold text-blue-600 hover:underline"
                        >
                          {item.sku}
                        </Link>
                      </td>

                      {/* Fabric Quality */}
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {item.fabricQuality || item.name}
                      </td>

                      {/* Design */}
                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {item.fabricDesign || 'Plain'}
                      </td>

                      {/* Shade / Colour */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                          <span
                            className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs inline-block shrink-0"
                            style={{ backgroundColor: fabricColorHex(item.fabricColor || 'Grey') }}
                          />
                          {item.fabricColor || 'Grey'}
                        </span>
                      </td>

                      {/* Total Stock (m) */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                        {formatQtyNumber(onHand)}
                      </td>

                      {/* Reserved (m) */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {formatQtyNumber(reserved)}
                      </td>

                      {/* Available (m) in Green */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                        {formatQtyNumber(avail)}
                      </td>

                      {/* Unit Cost (₹) */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {formatINR(cost)}
                      </td>

                      {/* Selling Rate (₹) */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {formatINR(sell)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          statusTone === 'emerald'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : statusTone === 'rose'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            statusTone === 'emerald'
                              ? 'bg-emerald-500'
                              : statusTone === 'rose'
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                          }`} />
                          {displayStatus}
                        </span>
                      </td>

                      {/* Reorder Qty (m) */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {formatQtyNumber(reorder || 500)}
                      </td>

                      {/* Actions matching image */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPoForSingleItem(item)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                            title="Create Purchase Order for replenishment"
                          >
                            <ShoppingCart size={13} />
                            Create PO
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                              className="w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition cursor-pointer"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {activeMenuId === item.id && (
                              <div
                                className="absolute right-0 top-8 z-30 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1 text-xs animate-in fade-in duration-100"
                                onMouseLeave={() => setActiveMenuId(null)}
                              >
                                <Link
                                  to={`/inventory/items/edit/${item.id}`}
                                  className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50"
                                >
                                  Edit Item Master
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBarcodeItem(item);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50"
                                >
                                  <Tag size={13} /> Barcode Label
                                </button>
                                <Link
                                  to="/inventory/lot-register"
                                  className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50"
                                >
                                  View Takas in Register
                                </Link>
                                <Link
                                  to="/inventory/transfers"
                                  className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50"
                                >
                                  Stock Transfer
                                </Link>
                                <div className="border-t border-slate-100 my-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleDeleteItem(item);
                                  }}
                                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 cursor-pointer font-medium"
                                >
                                  <Trash2 size={13} /> Delete Item
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer & Pagination (Matching Reference Image) ── */}
        <div className="p-3.5 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing <strong>{filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * pageSize, filteredItems.length)}</strong> of{' '}
            <strong>{filteredItems.length}</strong> records
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-slate-200 rounded-lg p-1 bg-white text-xs font-semibold focus:outline-none"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                const isActive = p === currentPage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating Bulk Action Bar when checkboxes are selected ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3.5 border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
              {selectedIds.size === 1 ? '1 item' : `${selectedIds.size} items`} selected
            </span>
          </div>

          <button
            type="button"
            onClick={handleBulkCreatePo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
          >
            <ShoppingCart size={13} />
            Create PO
          </button>

          <button
            type="button"
            onClick={handleExportSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700 cursor-pointer whitespace-nowrap"
          >
            <Upload size={13} className="rotate-180" />
            Export CSV
          </button>

          <button
            type="button"
            onClick={handleBulkDeleteSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Trash2 size={13} />
            Delete Selected
          </button>

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-slate-400 hover:text-white transition px-2 py-1 ml-1 cursor-pointer whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Purchase Order Creation Modal (Direct from Total Inventory) ── */}
      {poModalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">
                    {poModalConfig.mode === 'shortage'
                      ? 'Create Grey Fabric Replenishment PO'
                      : `Create Purchase Order: ${poModalConfig.item?.sku || ''}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pre-filled with authoritative inventory metrics and replenishment formula.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPoModalConfig(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPo} className="space-y-4 text-xs">
              {/* Supplier Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 block">
                    Supplier / Vendor <span className="text-rose-500">*</span>
                  </label>
                  <MasterSourceLink source="vendors" />
                </div>
                <select
                  value={poModalConfig.vendorId}
                  onChange={(e) => setPoModalConfig({ ...poModalConfig, vendorId: e.target.value })}
                  required
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-600 font-medium"
                >
                  <option value="">Select a registered fabric vendor...</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.code || 'Vendor'})</option>
                  ))}
                </select>
              </div>

              {/* Order Items Table */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Order Fabric Line Items</label>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Fabric Quality / SKU</th>
                        <th className="p-2.5 w-24 text-right">Order Qty</th>
                        <th className="p-2.5 w-16 text-center">UOM</th>
                        <th className="p-2.5 w-28 text-right">Unit Rate (₹)</th>
                        <th className="p-2.5 w-28 text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {poModalConfig.itemsList.map((line, idx) => {
                        const amount = Number(line.qty || 0) * Number(line.rate || 0);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2.5">
                              <span className="font-bold text-slate-800 block">{line.name}</span>
                              <span className="font-mono text-[11px] text-slate-400">{line.sku}</span>
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min="1"
                                required
                                value={line.qty}
                                onChange={(e) => {
                                  const updated = [...poModalConfig.itemsList];
                                  updated[idx].qty = Math.max(1, parseFloat(e.target.value) || 0);
                                  setPoModalConfig({ ...poModalConfig, itemsList: updated });
                                }}
                                className="w-20 text-right border border-slate-200 rounded-lg p-1.5 font-mono font-bold text-xs"
                              />
                            </td>
                            <td className="p-2.5 text-center font-mono text-slate-500">
                              {line.uom || 'Mtr'}
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={line.rate}
                                onChange={(e) => {
                                  const updated = [...poModalConfig.itemsList];
                                  updated[idx].rate = parseFloat(e.target.value) || 0;
                                  setPoModalConfig({ ...poModalConfig, itemsList: updated });
                                }}
                                className="w-24 text-right border border-slate-200 rounded-lg p-1.5 font-mono text-xs"
                              />
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              {formatINR(amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50/60 font-bold border-t border-slate-200">
                      <tr>
                        <td className="p-2.5 text-slate-700">Total Order Summary</td>
                        <td className="p-2.5 text-right font-mono text-slate-900">
                          {formatQtyNumber(poModalConfig.itemsList.reduce((acc, l) => acc + Number(l.qty || 0), 0))} m
                        </td>
                        <td />
                        <td />
                        <td className="p-2.5 text-right font-mono text-blue-600">
                          {formatINR(poModalConfig.itemsList.reduce((acc, l) => acc + (Number(l.qty || 0) * Number(l.rate || 0)), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Order Notes / Terms</label>
                <textarea
                  rows="2"
                  value={poModalConfig.notes}
                  onChange={(e) => setPoModalConfig({ ...poModalConfig, notes: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:bg-white text-xs"
                />
              </div>

              {/* Notice */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  The Purchase Order will be created in <strong>Draft status</strong> and can be approved according to company permissions.
                  Creating or approving this PO does not increase physical stock — stock increases strictly upon confirmed <strong>Goods Receipt (GRN)</strong>.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/purchase/orders', {
                      state: {
                        createPo: true,
                        prefill: {
                          vendorId: poModalConfig.vendorId,
                          items: poModalConfig.itemsList,
                          notes: poModalConfig.notes,
                        },
                      },
                    });
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink size={12} />
                  Open in Full Purchase Orders Page
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPoModalConfig(null)}
                    className="btn-outline px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPo}
                    className="btn-primary px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {submittingPo ? 'Submitting PO...' : 'Save & Submit PO'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Minimum Threshold Settings Modal ── */}
      {showThresholdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <Sliders size={18} className="text-blue-600" />
                Combined Grey Stock Alert Setting
              </h3>
              <button
                type="button"
                onClick={() => setShowThresholdModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveThreshold} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Minimum Total Grey Stock Level (Meters)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  placeholder="e.g. 10000"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 font-mono text-sm font-bold bg-slate-50 focus:bg-white text-slate-800"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Authoritative combined threshold across all grey fabric qualities.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="thresholdEnabled"
                  checked={thresholdEnabled}
                  onChange={(e) => setThresholdEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <label htmlFor="thresholdEnabled" className="font-semibold text-slate-700">
                  Enable Low Stock Alert Notifications
                </label>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px] space-y-1">
                <p className="font-semibold text-slate-800">Calculation Metric:</p>
                <p>• Physical Grey Stock at Godowns minus Sales Order Reservations.</p>
                <p>• External Processor WIP and Finished Fabric are excluded.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowThresholdModal(false)}
                  className="btn-outline px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingThreshold}
                  className="btn-primary px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {savingThreshold ? 'Saving...' : 'Save Threshold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Shortage Details Modal ── */}
      {showShortageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-600" />
                Grey Fabric Stock Analysis & Breakdown
              </h3>
              <button
                type="button"
                onClick={() => setShowShortageModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-500 block">Physical Godown Grey</span>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {formatQtyNumber(combinedStockData.physicalGrey)} m
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-500 block">Reserved for Sales Orders</span>
                  <span className="font-mono font-bold text-sm text-amber-700">
                    {formatQtyNumber(combinedStockData.reservedGrey)} m
                  </span>
                </div>
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <span className="text-[11px] text-blue-700 block font-semibold">Available Grey Stock</span>
                  <span className="font-mono font-bold text-sm text-blue-900">
                    {formatQtyNumber(combinedStockData.availableGrey)} m
                  </span>
                </div>
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <span className="text-[11px] text-amber-700 block font-semibold">Configured Minimum</span>
                  <span className="font-mono font-bold text-sm text-amber-900">
                    {formatQtyNumber(combinedStockData.threshold)} m
                  </span>
                </div>
              </div>

              {combinedStockData.shortage > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs block">Active Shortage Deficit:</span>
                    <span className="text-[11px]">Immediate replenishment required</span>
                  </div>
                  <span className="font-mono font-black text-lg text-rose-600">
                    {formatQtyNumber(combinedStockData.shortage)} m
                  </span>
                </div>
              )}

              {/* External WIP breakdown if any */}
              {combinedStockData.wipByParty && combinedStockData.wipByParty.length > 0 && (
                <div>
                  <span className="font-bold text-slate-700 block mb-1">External Processor WIP (Excluded):</span>
                  <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 max-h-36 overflow-y-auto space-y-1">
                    {combinedStockData.wipByParty.map((wp, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-700 font-medium">{wp.partyName}</span>
                        <span className="font-mono font-bold text-slate-900">{formatQtyNumber(wp.qty)} m</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowShortageModal(false)}
                className="btn-outline px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowShortageModal(false);
                  handleOpenPoForShortage();
                }}
                className="btn-primary px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <ShoppingCart size={13} />
                Create Replenishment PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Guide Modal ── */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <Info size={18} className="text-blue-600" />
                Total Inventory – Grey Fabric Architecture
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong>Purpose:</strong> Serves as the central operational overview and entry point for grey-fabric replenishment, stock tracking, and supplier procurement.
              </p>
              <p>
                <strong>Authoritative Stock Model:</strong> Everything that changes stock is tracked through the central stock movement ledger. Physical stock represents fabric rolls/takas residing inside company godowns.
              </p>
              <p>
                <strong>Stock Buckets:</strong>
                <br />• <em>Available Grey Stock</em> = Physical Godown Grey - Sales Order Reservations.
                <br />• <em>External Job Work WIP</em> = Grey fabric sent to external dyeing/printing processors (tracked separately per vendor).
                <br />• <em>Excluded buckets</em>: Finished fabric, QC Hold, Reprocess, Reject/Scrap, and Sample items.
              </p>
              <p>
                <strong>Replenishment:</strong> Creating a Purchase Order produces an approved commercial contract. Only confirmed <strong>Goods Receipt (GRN)</strong> physically increases warehouse inventory.
              </p>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="btn-primary px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteModalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800">
                  Delete {deleteModalConfig.items.length === 1 ? 'Fabric Item' : `${deleteModalConfig.items.length} Fabric Items`}?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This action will remove the selected items from the master catalog.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 max-h-40 overflow-y-auto space-y-1 text-xs">
              {deleteModalConfig.items.map((it) => (
                <div key={it.id} className="flex justify-between items-center text-slate-700 py-0.5">
                  <span className="font-mono font-semibold">{it.sku}</span>
                  <span className="text-slate-500 truncate max-w-[180px]">{it.fabricQuality || it.name}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deleteModalConfig.loading}
                onClick={() => setDeleteModalConfig({ isOpen: false, items: [], loading: false })}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteModalConfig.loading}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {deleteModalConfig.loading ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    Confirm Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Tag Modal */}
      <BarcodeLabelModal item={selectedBarcodeItem} onClose={() => setSelectedBarcodeItem(null)} />

      {/* CSV Data Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Inventory Items"
        templateHeaders={['SKU', 'Name', 'Category', 'UOM', 'Cost Price', 'Selling Price', 'Stock', 'Reorder Level', 'Location']}
        sampleRow={['FAB-COTTON', 'Cotton Grey Fabric', 'Fabric', 'Mtr', 70.0, 110.0, 500, 1000, 'Main Central Warehouse']}
        onImport={handleImportCsv}
      />
    </div>
  );
};

export default ItemsMasterPage;
