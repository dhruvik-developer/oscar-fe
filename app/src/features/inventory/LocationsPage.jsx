import React, { useState, useEffect, useMemo } from 'react';
import {
  Warehouse,
  MapPin,
  Server,
  Layers,
  LayoutGrid,
  Box,
  Package,
  PackageCheck,
  CheckCircle2,
  Database,
  PieChart,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ArrowLeftRight,
  Truck,
  FileText,
  CheckSquare,
  Scissors,
  ShieldCheck,
  RefreshCw,
  X,
  AlertTriangle,
  Info,
  User,
  Hash,
  Activity,
  SlidersHorizontal,
} from 'lucide-react';
import { inventoryService } from '../../services/domainServices';
import PageInfoButton from '../../components/ui/PageInfoButton';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

export const LocationsPage = () => {
  // State for data
  const [locations, setLocations] = useState([]);
  const [summary, setSummary] = useState({
    total_warehouses: 0,
    total_locations: 0,
    total_racks: 0,
    total_bins: 0,
    locations_with_stock: 0,
    empty_locations: 0,
    total_capacity: 0,
    total_used: 0,
    capacity_utilization: 0,
  });
  const [hierarchyTree, setHierarchyTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filters & Pagination
  const [typeFilter, setTypeFilter] = useState('All');
  const [warehouseFilter, setWarehouseFilter] = useState('All');
  const [zoneFilter, setZoneFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modal State (Add / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [formData, setFormData] = useState({
    type: 'Godown',
    parent: '',
    code: '',
    name: '',
    capacity: '',
    capacity_uom: 'Meter (m)',
    manager: '',
    is_active: true,
    description: '',
  });
  const [formErrors, setFormErrors] = useState({});

  // Details Modal State (Pop-up on click, not inline on main page)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [locationDetails, setLocationDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'taka' | 'transactions'
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, loc: null });

  // Tree expanded state
  const [expandedNodes, setExpandedNodes] = useState({});

  // Helper to normalize location object from API
  const normalizeLocation = (l) => {
    if (!l) return null;
    return {
      ...l,
      parent_code: l.parentCode ?? l.parent_code ?? '-',
      parent_name: l.parentName ?? l.parent_name ?? '-',
      warehouse_code: l.warehouseCode ?? l.warehouse_code ?? (l.type === 'Warehouse' ? l.code : '-'),
      warehouse_name: l.warehouseName ?? l.warehouse_name ?? (l.type === 'Warehouse' ? l.name : '-'),
      zone_code: l.zoneCode ?? l.zone_code ?? (l.type === 'Zone' ? l.code : '-'),
      zone_name: l.zoneName ?? l.zone_name ?? (l.type === 'Zone' ? l.name : '-'),
      is_active: l.isActive !== undefined ? l.isActive : (l.is_active !== undefined ? l.is_active : true),
      used_quantity: l.usedQuantity !== undefined ? parseFloat(l.usedQuantity) : (parseFloat(l.used_quantity) || 0),
      available_capacity: l.availableCapacity !== undefined ? parseFloat(l.availableCapacity) : (parseFloat(l.available_capacity) || 0),
      utilization_pct: l.utilizationPct !== undefined ? parseFloat(l.utilizationPct) : (parseFloat(l.utilization_pct) || 0),
      capacity_uom: l.capacityUom ?? l.capacity_uom ?? 'Meter (m)',
      stock_item_count: l.stockItemCount ?? l.stock_item_count ?? 0,
      lot_taka_count: l.lotTakaCount ?? l.lot_taka_count ?? 0,
    };
  };

  // Load Data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [locRes, sumRes, hierRes] = await Promise.all([
        inventoryService.getLocations(),
        inventoryService.getLocationsSummary().catch(() => null),
        inventoryService.getLocationsHierarchy().catch(() => null),
      ]);

      // Unpack locations list (handling direct array, { results: [] }, or { data: [] })
      const rawList = Array.isArray(locRes)
        ? locRes
        : (locRes?.results || locRes?.items || locRes?.data?.results || locRes?.data || []);

      const locList = rawList.map(normalizeLocation);
      setLocations(locList);

      // Unpack summary
      const sumData = (sumRes && sumRes.total_warehouses !== undefined) ? sumRes : (sumRes?.data || null);
      if (sumData) {
        setSummary({
          total_warehouses: sumData.total_warehouses ?? sumData.totalWarehouses ?? 0,
          total_locations: sumData.total_locations ?? sumData.totalLocations ?? 0,
          total_racks: sumData.total_racks ?? sumData.totalRacks ?? 0,
          total_bins: sumData.total_bins ?? sumData.totalBins ?? 0,
          locations_with_stock: sumData.locations_with_stock ?? sumData.locationsWithStock ?? 0,
          empty_locations: sumData.empty_locations ?? sumData.emptyLocations ?? 0,
          total_capacity: sumData.total_capacity ?? sumData.totalCapacity ?? 0,
          total_used: sumData.total_used ?? sumData.totalUsed ?? 0,
          capacity_utilization: sumData.capacity_utilization ?? sumData.capacityUtilization ?? 0,
        });
      } else {
        // Fallback calculation from list if summary endpoint unavailable
        const total_wh = locList.filter((l) => l.type === 'Warehouse').length;
        const total_loc = locList.length;
        const total_rk = locList.filter((l) => l.type === 'Rack').length;
        const total_bn = locList.filter((l) => l.type === 'Bin').length;
        const with_stk = locList.filter((l) => (l.used_quantity || 0) > 0).length;
        const empty_loc = Math.max(0, total_loc - with_stk);
        const tot_cap = locList.reduce((acc, l) => acc + (parseFloat(l.capacity) || 0), 0);
        const tot_used = locList.reduce((acc, l) => acc + (parseFloat(l.used_quantity) || 0), 0);
        const util = tot_cap > 0 ? Math.round((tot_used / tot_cap) * 100) : 0;
        setSummary({
          total_warehouses: total_wh,
          total_locations: total_loc,
          total_racks: total_rk,
          total_bins: total_bn,
          locations_with_stock: with_stk,
          empty_locations: empty_loc,
          total_capacity: tot_cap,
          total_used: tot_used,
          capacity_utilization: util,
        });
      }

      // Unpack hierarchy tree
      const hierData = hierRes?.tree || hierRes?.data?.tree || [];
      if (Array.isArray(hierData) && hierData.length > 0) {
        setHierarchyTree(hierData);
        // Expand root nodes by default
        const initExpanded = {};
        const expandAll = (nodes) => {
          nodes.forEach((n) => {
            initExpanded[n.id] = true;
            if (n.children && n.children.length > 0) {
              expandAll(n.children);
            }
          });
        };
        expandAll(hierData);
        setExpandedNodes(initExpanded);
      } else if (locList.length > 0) {
        // Fallback: build tree from local locList
        const tree = [];
        const map = {};
        locList.forEach((l) => {
          map[l.id] = { ...l, children: [] };
        });
        locList.forEach((l) => {
          if (l.parent && map[l.parent]) {
            map[l.parent].children.push(map[l.id]);
          } else {
            tree.push(map[l.id]);
          }
        });
        setHierarchyTree(tree);
      }
    } catch (err) {
      console.error('Failed to load location data:', err);
      setError('Unable to load locations from server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch location details whenever selectedLocationId changes
  useEffect(() => {
    if (!selectedLocationId) return;
    let isMounted = true;
    setDetailsLoading(true);

    inventoryService
      .getLocationDetails(selectedLocationId)
      .then((res) => {
        if (!isMounted) return;
        const detailsData = res?.location ? res : (res?.data?.location ? res.data : null);
        if (detailsData) {
          const loc = normalizeLocation(detailsData.location);
          const rawItems = detailsData.stock_by_item || detailsData.stockByItem || [];
          const rawTakas = detailsData.lot_takas || detailsData.lotTakas || [];
          const rawTxs = detailsData.transactions || [];
          const rawUtil = detailsData.utilization || {
            capacity: parseFloat(loc.capacity) || 0,
            used: parseFloat(loc.used_quantity) || 0,
            available: parseFloat(loc.available_capacity) || 0,
            utilization_pct: parseFloat(loc.utilization_pct) || 0,
          };

          setLocationDetails({
            location: loc,
            stock_by_item: rawItems.map((it) => ({
              ...it,
              item_code: it.item_code ?? it.itemCode,
              item_name: it.item_name ?? it.itemName,
              fabric_quality: it.fabric_quality ?? it.fabricQuality,
              lot_number: it.lot_number ?? it.lotNumber,
              lot_taka_count: it.lot_taka_count ?? it.lotTakaCount,
              location_code: it.location_code ?? it.locationCode,
            })),
            lot_takas: rawTakas.map((tk) => ({
              ...tk,
              taka_id: tk.taka_id ?? tk.takaId,
              lot_number: tk.lot_number ?? tk.lotNumber,
              taka_number: tk.taka_number ?? tk.takaNumber,
              item_code: tk.item_code ?? tk.itemCode,
              item_name: tk.item_name ?? tk.itemName,
              qc_status: tk.qc_status ?? tk.qcStatus,
              tag_status: tk.tag_status ?? tk.tagStatus,
              location_code: tk.location_code ?? tk.locationCode,
              received_date: tk.received_date ?? tk.receivedDate,
            })),
            transactions: rawTxs.map((tx) => ({
              ...tx,
              movement_date: tx.movement_date ?? tx.movementDate,
              reference_number: tx.reference_number ?? tx.referenceNumber,
              item_code: tx.item_code ?? tx.itemCode,
              item_name: tx.item_name ?? tx.itemName,
              user_name: tx.user_name ?? tx.userName,
            })),
            utilization: {
              capacity: parseFloat(rawUtil.capacity) || 0,
              used: parseFloat(rawUtil.used) || 0,
              available: parseFloat(rawUtil.available) || 0,
              utilization_pct: parseFloat(rawUtil.utilization_pct ?? rawUtil.utilizationPct) || 0,
            },
          });
        }
      })
      .catch((err) => {
        console.error('Failed to fetch details:', err);
        const local = locations.find((l) => l.id === selectedLocationId);
        if (local && isMounted) {
          setLocationDetails({
            location: local,
            stock_by_item: [],
            lot_takas: [],
            transactions: [],
            utilization: {
              capacity: parseFloat(local.capacity) || 0,
              used: parseFloat(local.used_quantity) || 0,
              available: parseFloat(local.available_capacity) || 0,
              utilization_pct: parseFloat(local.utilization_pct) || 0,
            },
          });
        }
      })
      .finally(() => {
        if (isMounted) setDetailsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedLocationId, locations]);

  // Open details modal
  const handleOpenDetails = (locId) => {
    setSelectedLocationId(locId);
    setDetailsModalOpen(true);
  };

  // Warehouse and Zone options for filters
  const warehouseOptions = useMemo(() => {
    return locations.filter((l) => l.type === 'Warehouse');
  }, [locations]);

  const zoneOptions = useMemo(() => {
    return locations.filter((l) => l.type === 'Zone');
  }, [locations]);

  // Selectable parent locations for the modal
  const selectableParents = useMemo(() => {
    return locations.filter((loc) => {
      if (editingLocation && loc.id === editingLocation.id) return false;
      return loc.is_active !== false;
    });
  }, [locations, editingLocation]);

  // Derived parent object for displaying Warehouse/Zone in modal
  const selectedParentObj = useMemo(() => {
    if (!formData.parent) return null;
    return locations.find((l) => l.id === formData.parent) || null;
  }, [locations, formData.parent]);

  // Filtered Locations
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      if (typeFilter !== 'All' && loc.type !== typeFilter) return false;
      if (statusFilter !== 'All') {
        const isAct = statusFilter === 'Active';
        if (loc.is_active !== isAct) return false;
      }
      if (warehouseFilter !== 'All') {
        if (loc.warehouse_code !== warehouseFilter && loc.code !== warehouseFilter) {
          return false;
        }
      }
      if (zoneFilter !== 'All') {
        if (loc.zone_code !== zoneFilter && loc.code !== zoneFilter) {
          return false;
        }
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const codeMatch = (loc.code || '').toLowerCase().includes(term);
        const nameMatch = (loc.name || '').toLowerCase().includes(term);
        const mgrMatch = (loc.manager || '').toLowerCase().includes(term);
        const descMatch = (loc.description || '').toLowerCase().includes(term);
        if (!codeMatch && !nameMatch && !mgrMatch && !descMatch) return false;
      }
      return true;
    });
  }, [locations, typeFilter, statusFilter, warehouseFilter, zoneFilter, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredLocations.length / pageSize) || 1;
  const paginatedLocations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLocations.slice(start, start + pageSize);
  }, [filteredLocations, currentPage, pageSize]);

  // Modal open helpers
  const handleOpenAdd = () => {
    setEditingLocation(null);
    const defaultType = locations.length === 0 ? 'Warehouse' : 'Godown';
    const firstParent = locations.length > 0 ? locations[0].id : '';
    setFormData({
      type: defaultType,
      parent: defaultType === 'Warehouse' ? '' : firstParent,
      code: '',
      name: '',
      capacity: '',
      capacity_uom: 'Meter (m)',
      manager: '',
      is_active: true,
      description: '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (loc) => {
    setEditingLocation(loc);
    setFormData({
      type: loc.type || 'Warehouse',
      parent: loc.parent || '',
      code: loc.code || '',
      name: loc.name || '',
      capacity: loc.capacity !== null && loc.capacity !== undefined ? loc.capacity : '',
      capacity_uom: loc.capacity_uom || 'Meter (m)',
      manager: loc.manager || '',
      is_active: loc.is_active !== undefined ? loc.is_active : true,
      description: loc.description || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  // Form Submission
  const handleSaveLocation = async (e) => {
    e.preventDefault();
    setFormErrors({});

    // Validation
    const errors = {};
    if (!formData.name?.trim()) errors.name = 'Location Name is required';
    if (!formData.type) errors.type = 'Location Type is required';
    if (formData.type !== 'Warehouse' && !formData.parent) {
      errors.parent = 'Parent location is required for sub-locations';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        parent: formData.parent ? formData.parent : null,
        code: formData.code.trim().toUpperCase() || undefined,
        capacity: formData.capacity !== '' ? parseFloat(formData.capacity) : 0,
        capacity_uom: formData.capacity_uom || 'Meter (m)',
        manager: formData.manager.trim() || null,
        is_active: Boolean(formData.is_active),
        description: formData.description.trim() || null,
      };

      if (editingLocation) {
        await inventoryService.updateLocation(editingLocation.id, payload);
        setFeedback({ type: 'success', message: `Location '${payload.name}' updated successfully!` });
      } else {
        await inventoryService.createLocation(payload);
        setFeedback({ type: 'success', message: `Location '${payload.name}' created successfully!` });
      }

      setModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Failed to save location:', err);
      const detail =
        err?.payload?.detail ||
        err?.payload?.message ||
        (err?.payload && typeof err.payload === 'object' && Object.values(err.payload)[0]) ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to save location. Please verify inputs.';
      setFormErrors({ submit: String(detail) });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete / Deactivate location
  const handleDelete = (loc) => {
    setDeleteConfirm({ isOpen: true, loc });
  };

  const handleConfirmDelete = async () => {
    const loc = deleteConfirm.loc;
    if (!loc) return;

    setActionLoading(true);
    try {
      await inventoryService.deleteLocation(loc.id);
      setFeedback({ type: 'success', message: `Location '${loc.name}' deleted successfully.` });
      setDeleteConfirm({ isOpen: false, loc: null });
      await fetchData();
    } catch (err) {
      const msg =
        err?.payload?.detail ||
        err?.payload?.message ||
        err?.message ||
        'Cannot delete location. It may have child locations, stock, or ledger transactions. Try deactivating it instead.';
      setFeedback({ type: 'error', message: String(msg) });
      setDeleteConfirm({ isOpen: false, loc: null });
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedIds.size === paginatedLocations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedLocations.map((l) => l.id)));
    }
  };

  const handleToggleSelectOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Helper for type styling
  const getTypeBadge = (type) => {
    switch (type) {
      case 'Warehouse':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';
      case 'Zone':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300';
      case 'Godown':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300';
      case 'Rack':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300';
      case 'Bin':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getTypeIcon = (type, size = 16) => {
    switch (type) {
      case 'Warehouse':
        return <Warehouse size={size} className="text-blue-600" />;
      case 'Zone':
        return <Layers size={size} className="text-indigo-600" />;
      case 'Godown':
        return <Box size={size} className="text-emerald-600" />;
      case 'Rack':
        return <Server size={size} className="text-amber-600" />;
      case 'Bin':
        return <LayoutGrid size={size} className="text-purple-600" />;
      default:
        return <MapPin size={size} className="text-slate-500" />;
    }
  };

  const getProgressColor = (pct) => {
    if (pct > 85) return 'bg-rose-500';
    if (pct > 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  // Recursive Tree Node Renderer for Hierarchy View
  const renderTreeNode = (node, depth = 0) => {
    const isExpanded = !!expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => handleOpenDetails(node.id)}
          className="group flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition-colors text-xs font-medium hover:bg-blue-50 text-slate-700 dark:hover:bg-slate-800 dark:text-slate-300"
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedNodes((prev) => ({ ...prev, [node.id]: !prev[node.id] }));
                }}
                className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-3.5 inline-block" />
            )}
            {getTypeIcon(node.type, 14)}
            <span className="truncate font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600">
              {node.name}
            </span>
            <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold underline">
              ({node.code})
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {node.capacity > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
                {Math.round(node.utilization_pct || node.utilizationPct || 0)}%
              </span>
            )}
            <span
              className={`w-2 h-2 rounded-full ${
                node.is_active !== false ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            />
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3 pl-1">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Header matching Image 1 */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs">
                <Warehouse size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    Godown / Rack – Locations Management
                  </h1>
                  <PageInfoButton title="Godown / Rack - Locations Management" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage warehouse, zone, godown, rack and bin locations for fabric inventory with complete tracking.
                </p>
              </div>
            </div>
          </div>

          {/* Top Right Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
              Organized Locations
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
              Better Stock Tracking
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
              Faster Operations
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800 font-semibold">
              Full Traceability
            </span>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-lg text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PANEL 1: LOCATIONS DASHBOARD */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        {/* Panel 1 Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                  1
                </span>
                <span>Locations Dashboard</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Overview of all warehouses, zones, godowns, racks and bins. Click any location code or row to view complete details.
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 font-mono">
                <span>Dashboard</span>
                <span>&gt;</span>
                <span>Inventory</span>
                <span>&gt;</span>
                <span className="text-blue-600 font-bold">Godown / Rack</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus size={15} />
                Add Warehouse Location
              </button>
            </div>
          </div>
        </div>

        {/* 8 KPI Cards Grid matching Image 1 */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {/* 1. Total Warehouses */}
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Warehouse size={15} />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Warehouses</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {summary.total_warehouses}
              </div>
            </div>

            {/* 2. Total Locations */}
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <MapPin size={15} />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Total Locs</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {summary.total_locations}
              </div>
            </div>

            {/* 3. Total Racks */}
            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-lg">
              <div className="flex items-center gap-2 text-indigo-600 mb-1">
                <Server size={15} />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Total Racks</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {summary.total_racks}
              </div>
            </div>

            {/* 4. Total Bins */}
            <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-lg">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <LayoutGrid size={15} />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Total Bins</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {summary.total_bins}
              </div>
            </div>

            {/* 5. Locations with Stock */}
            <div className="p-3 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 rounded-lg">
              <div className="flex items-center gap-2 text-teal-600 mb-1">
                <PackageCheck size={15} />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">With Stock</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {summary.locations_with_stock}
              </div>
            </div>

            {/* 6. Empty Locations */}
            <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-lg">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <Box size={15} />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Empty Locs</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {summary.empty_locations}
              </div>
            </div>

            {/* 7. Total Capacity */}
            <div className="p-3 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 rounded-lg">
              <div className="flex items-center gap-2 text-violet-600 mb-1">
                <Database size={15} />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Capacity</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono truncate">
                {Number(summary.total_capacity).toLocaleString()} <span className="text-xs font-normal">m</span>
              </div>
            </div>

            {/* 8. Capacity Utilization */}
            <div className="p-3 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 rounded-lg">
              <div className="flex items-center gap-2 text-sky-600 mb-1">
                <PieChart size={15} />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Utilization</span>
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {summary.capacity_utilization}%
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            {/* Type */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Location Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All Types</option>
                <option value="Warehouse">Warehouse</option>
                <option value="Zone">Zone</option>
                <option value="Godown">Godown</option>
                <option value="Rack">Rack</option>
                <option value="Bin">Bin</option>
              </select>
            </div>

            {/* Warehouse */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Warehouse
              </label>
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All Warehouses</option>
                {warehouseOptions.map((wh) => (
                  <option key={wh.id} value={wh.code}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Zone */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Zone
              </label>
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All Zones</option>
                {zoneOptions.map((zn) => (
                  <option key={zn.id} value={zn.code}>
                    {zn.name} ({zn.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {/* Search Input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Search
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search code, name, manager..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Register Table matching Image 1 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={
                      paginatedLocations.length > 0 &&
                      selectedIds.size === paginatedLocations.length
                    }
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-2.5 px-2 w-8 text-center">#</th>
                <th className="py-2.5 px-3 font-semibold">Location Code</th>
                <th className="py-2.5 px-3 font-semibold">Location Name</th>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Parent Location</th>
                <th className="py-2.5 px-3 text-right font-semibold">Capacity (m)</th>
                <th className="py-2.5 px-3 text-right font-semibold">Used (m)</th>
                <th className="py-2.5 px-4 font-semibold text-center">Utilization</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                    Loading real locations and occupancy from database...
                  </td>
                </tr>
              ) : paginatedLocations.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-400">
                    <Warehouse size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">No locations found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm || typeFilter !== 'All'
                        ? 'Try clearing your search or filters.'
                        : "Click '+ Add Warehouse Location' to create your first warehouse or godown."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedLocations.map((loc, idx) => {
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;
                  const cap = parseFloat(loc.capacity) || 0;
                  const used = parseFloat(loc.used_quantity) || 0;
                  const utilPct = parseFloat(loc.utilization_pct) || 0;

                  return (
                    <tr
                      key={loc.id}
                      onClick={() => handleOpenDetails(loc.id)}
                      className="cursor-pointer transition-colors hover:bg-blue-50/40 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(loc.id)}
                          onChange={() => handleToggleSelectOne(loc.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                        {rowNum}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(loc.id);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-700 cursor-pointer font-bold font-mono"
                          title="Click to view complete details"
                        >
                          {loc.code}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {loc.name}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${getTypeBadge(
                            loc.type
                          )}`}
                        >
                          {getTypeIcon(loc.type, 12)}
                          {loc.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {loc.parent_code && loc.parent_code !== '-' ? (
                          <span className="inline-block px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px]">
                            {loc.parent_code}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {cap > 0 ? cap.toLocaleString() : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {used.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-20 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getProgressColor(utilPct)}`}
                              style={{ width: `${Math.min(100, utilPct)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 w-9 text-right">
                            {utilPct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            loc.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {loc.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            title="View Details"
                            onClick={() => handleOpenDetails(loc.id)}
                            className="p-1 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded transition-colors"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            title="Edit Location"
                            onClick={() => handleOpenEdit(loc)}
                            className="p-1 hover:bg-amber-50 text-slate-500 hover:text-amber-600 rounded transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            title="Delete / Deactivate"
                            onClick={() => handleDelete(loc)}
                            className="p-1 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded transition-colors"
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

        {/* Pagination Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
          <div>
            Showing{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              {filteredLocations.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              {Math.min(currentPage * pageSize, filteredLocations.length)}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-200">
              {filteredLocations.length}
            </span>{' '}
            entries
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded disabled:opacity-40 hover:bg-slate-50 text-xs"
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  type="button"
                  onClick={() => setCurrentPage(pg)}
                  className={`w-7 h-7 rounded text-xs font-semibold ${
                    currentPage === pg
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {pg}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded disabled:opacity-40 hover:bg-slate-50 text-xs"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PANEL 3: LOCATION HIERARCHY VIEW (Full-width clean card) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                2
              </span>
              <span>Location Hierarchy Structure</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visual structure of warehouse &rarr; zone &rarr; godown &rarr; rack &rarr; bin. Click any location code to inspect items, takas, and stock movements.
            </p>
          </div>

          {/* Quick expand/collapse controls */}
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                const allExp = {};
                const markExp = (nodes) => {
                  nodes.forEach((n) => {
                    allExp[n.id] = true;
                    if (n.children) markExp(n.children);
                  });
                };
                markExp(hierarchyTree);
                setExpandedNodes(allExp);
              }}
              className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 rounded text-[11px]"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() => setExpandedNodes({})}
              className="px-2.5 py-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300 rounded text-[11px]"
            >
              Collapse All
            </button>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Tree Structure (col-span-8) */}
          <div className="md:col-span-8 overflow-y-auto max-h-[420px] space-y-1 pr-2 border-r border-slate-100 dark:border-slate-800">
            {hierarchyTree.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No location hierarchy built yet. Create warehouses and child locations to view the visual tree.
              </div>
            ) : (
              hierarchyTree.map((rootNode) => renderTreeNode(rootNode, 0))
            )}
          </div>

          {/* Legend & Level Descriptions (col-span-4) */}
          <div className="md:col-span-4 space-y-3 text-xs">
            <div className="font-bold text-slate-800 dark:text-slate-200 text-xs border-b border-slate-200 dark:border-slate-700 pb-2">
              Storage Level Hierarchy Guide
            </div>
            <div className="space-y-2.5 text-slate-600 dark:text-slate-400">
              <div className="p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded border border-blue-100 dark:border-blue-900/30 flex items-start gap-2">
                <Warehouse size={16} className="text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900 dark:text-slate-100">Warehouse</strong>
                  <div className="text-[11px] text-slate-500">Main physical facility or mill campus</div>
                </div>
              </div>

              <div className="p-2 bg-indigo-50/50 dark:bg-indigo-950/20 rounded border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-2">
                <Layers size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900 dark:text-slate-100">Zone</strong>
                  <div className="text-[11px] text-slate-500">Functional area (e.g. Greige Zone, Finished Zone)</div>
                </div>
              </div>

              <div className="p-2 bg-emerald-50/50 dark:bg-emerald-950/20 rounded border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-2">
                <Box size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900 dark:text-slate-100">Godown</strong>
                  <div className="text-[11px] text-slate-500">Dedicated fabric storage building or hall</div>
                </div>
              </div>

              <div className="p-2 bg-amber-50/50 dark:bg-amber-950/20 rounded border border-amber-100 dark:border-amber-900/30 flex items-start gap-2">
                <Server size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900 dark:text-slate-100">Rack</strong>
                  <div className="text-[11px] text-slate-500">Shelving unit or stack row (optional)</div>
                </div>
              </div>

              <div className="p-2 bg-purple-50/50 dark:bg-purple-950/20 rounded border border-purple-100 dark:border-purple-900/30 flex items-start gap-2">
                <LayoutGrid size={16} className="text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900 dark:text-slate-100">Bin</strong>
                  <div className="text-[11px] text-slate-500">Individual shelf slot or roll container (optional)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* POPUP MODAL: LOCATION DETAILS (Triggered upon clicking any location) */}
      {/* ========================================================================= */}
      {detailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full p-6 text-xs max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  {locationDetails?.location ? getTypeIcon(locationDetails.location.type, 20) : <MapPin size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      {locationDetails?.location?.name || 'Location Details'}
                    </h3>
                    {locationDetails?.location?.code && (
                      <span className="font-mono px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded font-bold text-xs">
                        {locationDetails.location.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Real-time capacity, fabric stock balances, taka register, and stock movements.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {locationDetails?.location && (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenEdit(locationDetails.location);
                      setDetailsModalOpen(false);
                    }}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs"
                  >
                    <Edit2 size={13} />
                    Edit Location
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {detailsLoading ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw size={26} className="animate-spin mx-auto mb-2 text-blue-500" />
                Loading real location details, takas and movements from database...
              </div>
            ) : !locationDetails?.location ? (
              <div className="py-12 text-center text-slate-400">
                <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500" />
                Unable to load details for the selected location.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Details Properties Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Location Code</span>
                    <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {locationDetails.location.code}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Location Name</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {locationDetails.location.name}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Type</span>
                    <div className="mt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${getTypeBadge(
                          locationDetails.location.type
                        )}`}
                      >
                        {locationDetails.location.type}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Parent</span>
                    <div className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                      {locationDetails.location.parent_name ||
                        locationDetails.location.parent_code ||
                        '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Warehouse</span>
                    <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                      {locationDetails.location.warehouse_name ||
                        locationDetails.location.warehouse_code ||
                        '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Zone</span>
                    <div className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                      {locationDetails.location.zone_name ||
                        locationDetails.location.zone_code ||
                        '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Capacity</span>
                    <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {Number(locationDetails.utilization.capacity).toLocaleString()} m
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Used Quantity</span>
                    <div className="font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                      {Number(locationDetails.utilization.used).toLocaleString()} m
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Available</span>
                    <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {Number(locationDetails.utilization.available).toLocaleString()} m
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Utilization</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {locationDetails.utilization.utilization_pct}%
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Manager</span>
                    <div className="text-slate-700 dark:text-slate-300 mt-0.5 flex items-center gap-1">
                      <User size={12} className="text-slate-400" />
                      {locationDetails.location.manager || 'Unassigned'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Status</span>
                    <div className="mt-0.5">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          locationDetails.location.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {locationDetails.location.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  {locationDetails.location.description && (
                    <div className="col-span-2 sm:col-span-4 border-t border-slate-200 dark:border-slate-700 pt-2 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Description: </span>
                      {locationDetails.location.description}
                    </div>
                  )}
                </div>

                {/* Utilization progress bar visualization */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Capacity Breakdown:</span>
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <span className="text-blue-600 font-semibold">
                        Used: {locationDetails.utilization.used.toLocaleString()} m ({locationDetails.utilization.utilization_pct}%)
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="text-emerald-600 font-semibold">
                        Available: {locationDetails.utilization.available.toLocaleString()} m
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden flex">
                    <div
                      className={getProgressColor(locationDetails.utilization.utilization_pct)}
                      style={{ width: `${Math.min(100, locationDetails.utilization.utilization_pct)}%` }}
                    />
                    <div
                      className="bg-emerald-200 dark:bg-emerald-950/60 h-full"
                      style={{
                        width: `${Math.max(
                          0,
                          100 - locationDetails.utilization.utilization_pct
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Sub-tabs: Stock by Item / Lot / Taka-wise / Transactions */}
                <div className="pt-2">
                  <div className="flex border-b border-slate-200 dark:border-slate-700 gap-6 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveTab('stock')}
                      className={`pb-2 font-semibold transition-colors relative ${
                        activeTab === 'stock'
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Stock by Item ({locationDetails.stock_by_item?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('taka')}
                      className={`pb-2 font-semibold transition-colors relative ${
                        activeTab === 'taka'
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Lot / Taka-wise ({locationDetails.lot_takas?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('transactions')}
                      className={`pb-2 font-semibold transition-colors relative ${
                        activeTab === 'transactions'
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Transactions ({locationDetails.transactions?.length || 0})
                    </button>
                  </div>

                  <div className="mt-3 overflow-x-auto max-h-64 overflow-y-auto">
                    {/* TAB 1: Stock by Item */}
                    {activeTab === 'stock' && (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-semibold border-b border-slate-200 dark:border-slate-700">
                            <th className="py-2 px-3">Item Code</th>
                            <th className="py-2 px-3">Fabric Item</th>
                            <th className="py-2 px-3">Quality / Design / Shade</th>
                            <th className="py-2 px-3 text-center">Lot/Takas</th>
                            <th className="py-2 px-3 text-right">Qty (m)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {locationDetails.stock_by_item?.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="py-6 text-center text-slate-400">
                                No active item stock at this location.
                              </td>
                            </tr>
                          ) : (
                            locationDetails.stock_by_item.map((item, i) => (
                              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-2 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {item.item_code}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                  {item.item_name}
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                                  {[item.fabric_quality, item.design, item.shade].filter(Boolean).join(' • ') || '-'}
                                </td>
                                <td className="py-2 px-3 text-center font-mono">
                                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">
                                    {item.lot_taka_count}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                  {item.quantity.toLocaleString()} {item.uom}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}

                    {/* TAB 2: Lot / Taka-wise */}
                    {activeTab === 'taka' && (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-semibold border-b border-slate-200 dark:border-slate-700">
                            <th className="py-2 px-3">Taka ID</th>
                            <th className="py-2 px-3">Lot #</th>
                            <th className="py-2 px-2 text-center">Taka #</th>
                            <th className="py-2 px-3">Fabric Item</th>
                            <th className="py-2 px-3 text-right">Qty</th>
                            <th className="py-2 px-3 text-center">QC Status</th>
                            <th className="py-2 px-3 font-mono">Barcode</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {locationDetails.lot_takas?.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="py-6 text-center text-slate-400">
                                No fabric takas stored at this location.
                              </td>
                            </tr>
                          ) : (
                            locationDetails.lot_takas.map((tk) => (
                              <tr key={tk.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-2 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                                  {tk.taka_id}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                                  {tk.lot_number}
                                </td>
                                <td className="py-2 px-2 text-center font-mono">
                                  #{tk.taka_number}
                                </td>
                                <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-medium truncate max-w-[140px]">
                                  {tk.item_name}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-semibold">
                                  {tk.quantity} {tk.uom}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      tk.qc_status === 'Passed'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : tk.qc_status === 'Pending'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {tk.qc_status}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                                  {tk.barcode}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}

                    {/* TAB 3: Transactions */}
                    {activeTab === 'transactions' && (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-semibold border-b border-slate-200 dark:border-slate-700">
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">Movement Type</th>
                            <th className="py-2 px-3">Ref Document</th>
                            <th className="py-2 px-3">Item</th>
                            <th className="py-2 px-3 text-right">Quantity</th>
                            <th className="py-2 px-3">User</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {locationDetails.transactions?.length === 0 ? (
                            <tr>
                              <td colSpan="6" className="py-6 text-center text-slate-400">
                                No inventory movements recorded at this location yet.
                              </td>
                            </tr>
                          ) : (
                            locationDetails.transactions.map((tx) => (
                              <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-2 px-3 font-mono text-slate-500">
                                  {tx.movement_date || '-'}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="inline-block px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-semibold text-[10px]">
                                    {tx.type}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-mono text-blue-600">
                                  {tx.reference_number}
                                </td>
                                <td className="py-2 px-3 text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                                  {tx.item_name}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-mono font-semibold ${
                                    tx.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'
                                  }`}
                                >
                                  {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                                </td>
                                <td className="py-2 px-3 text-slate-500">
                                  {tx.user_name}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDetailsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold text-xs transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PANEL 2: ADD / EDIT WAREHOUSE LOCATION MODAL */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 text-xs max-h-[95vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                    +
                  </span>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {editingLocation ? 'Edit Warehouse Location' : 'Add Warehouse Location'}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Create warehouse, zone, godown, rack or bin with full details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error banner if submit fails */}
            {formErrors.submit && (
              <div className="mb-4 p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{formErrors.submit}</span>
              </div>
            )}

            <form onSubmit={handleSaveLocation} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Location Type * */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Location Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        type: newType,
                        parent: newType === 'Warehouse' ? '' : (prev.parent || (selectableParents[0]?.id || '')),
                      }));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Warehouse">Warehouse (Main physical building)</option>
                    <option value="Zone">Zone (Category within warehouse)</option>
                    <option value="Godown">Godown (Storage area)</option>
                    <option value="Rack">Rack (Shelving unit)</option>
                    <option value="Bin">Bin (Smallest storage container)</option>
                  </select>
                  {formErrors.type && <p className="text-rose-500 text-[10px] mt-1">{formErrors.type}</p>}
                </div>

                {/* Parent Location * */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Parent Location {formData.type !== 'Warehouse' && <span className="text-rose-500">*</span>}
                  </label>
                  <select
                    value={formData.parent}
                    disabled={formData.type === 'Warehouse' && selectableParents.length === 0}
                    onChange={(e) => setFormData((prev) => ({ ...prev, parent: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">
                      {formData.type === 'Warehouse'
                        ? 'None (Top-level Warehouse)'
                        : '-- Select Parent Location --'}
                    </option>
                    {selectableParents.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.code} - {loc.name} ({loc.type})
                      </option>
                    ))}
                  </select>
                  {formErrors.parent && <p className="text-rose-500 text-[10px] mt-1">{formErrors.parent}</p>}
                </div>

                {/* Location Code * */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Location Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. WH-01, Z-01, G-01, R-01"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono uppercase focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  {formErrors.code && <p className="text-rose-500 text-[10px] mt-1">{formErrors.code}</p>}
                </div>

                {/* Location Name * */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Location Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Main Warehouse, Rack 1"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  {formErrors.name && <p className="text-rose-500 text-[10px] mt-1">{formErrors.name}</p>}
                </div>

                {/* Derived Warehouse */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Warehouse
                  </label>
                  <input
                    type="text"
                    disabled
                    value={
                      formData.type === 'Warehouse'
                        ? 'This Location (Root Warehouse)'
                        : selectedParentObj
                        ? `${selectedParentObj.warehouse_code} - ${selectedParentObj.warehouse_name}`
                        : 'Derived from Parent Location'
                    }
                    className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* Derived Zone */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Zone
                  </label>
                  <input
                    type="text"
                    disabled
                    value={
                      formData.type === 'Zone'
                        ? 'This Location (Zone)'
                        : selectedParentObj?.zone_code && selectedParentObj.zone_code !== '-'
                        ? `${selectedParentObj.zone_code} - ${selectedParentObj.zone_name}`
                        : 'None / Derived from Parent'
                    }
                    className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* Capacity (m) */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Capacity (m)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.capacity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, capacity: e.target.value }))}
                    placeholder="e.g. 5000"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Capacity UOM */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Capacity UOM
                  </label>
                  <select
                    value={formData.capacity_uom}
                    onChange={(e) => setFormData((prev) => ({ ...prev, capacity_uom: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Meter (m)">Meter (m)</option>
                    <option value="Kilogram (kg)">Kilogram (kg)</option>
                    <option value="Rolls / Takas">Rolls / Takas</option>
                    <option value="Pieces (pcs)">Pieces (pcs)</option>
                  </select>
                </div>

                {/* Location Manager */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Location Manager
                  </label>
                  <input
                    type="text"
                    value={formData.manager}
                    onChange={(e) => setFormData((prev) => ({ ...prev, manager: e.target.value }))}
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Status Toggle */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {formData.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Storage Purpose
                </label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g. Main storage rack for Cotton 60s greige and finished fabric."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  {actionLoading && <RefreshCw size={13} className="animate-spin" />}
                  {editingLocation ? 'Update Location' : 'Save Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Centered Modern Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => !actionLoading && setDeleteConfirm({ isOpen: false, loc: null })}
        onConfirm={handleConfirmDelete}
        title="Delete Location"
        message="Are you sure you want to delete this location? If it has historical movements or active stock, the system will prevent deletion to preserve ledger integrity."
        itemName={deleteConfirm.loc ? `${deleteConfirm.loc.name} (${deleteConfirm.loc.code})` : null}
        confirmText="Delete Location"
        cancelText="Cancel"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
};

export default LocationsPage;
