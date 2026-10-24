import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Layers,
  Box,
  Package,
  PackageCheck,
  Wallet,
  Clock,
  AlertTriangle,
  Search,
  RotateCcw,
  Download,
  Plus,
  Eye,
  Edit2,
  Printer,
  X,
  CheckCircle2,
  Calendar,
  Building,
  Warehouse,
  Tag,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Barcode,
  Image as ImageIcon,
  Sparkles,
  Info,
  ShieldAlert,
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Trash2,
  ExternalLink,
  Activity,
  FileCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { inventoryService, partiesService } from '../../services/domainServices';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';
import { useAppStore } from '../../stores/appStore';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { TakaTagLabel } from './TakaTagPrintPage';
import PageInfoButton from '../../components/ui/PageInfoButton';
import KpiCard from '../../components/ui/KpiCard';
import MasterSourceLink from '../../components/common/MasterSourceLink';

// Helper for Indian Currency formatting
function formatINR(val) {
  if (val === null || val === undefined || isNaN(val)) return '₹ 0';
  const num = Math.round(Number(val));
  return '₹ ' + num.toLocaleString('en-IN');
}

// Helper for Quantity formatting
function formatQty(val, uom = 'm') {
  if (val === null || val === undefined || isNaN(val)) return '0' + (uom ? ` ${uom}` : '');
  const num = Number(val);
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return uom ? `${formatted} ${uom}` : formatted;
}

// CSV Export Helper
function exportToCsv(filename, rows) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object');
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

export default function LotTakaRegisterPage({
  initialPo = null,
  initialGrn = null,
  poId: propPoId = null,
  grnId: propGrnId = null,
  isEmbedded = false,
  onSelectStage = null,
} = {}) {
  const { items = [], locations = [], vendors = [], user: erpUser = { name: 'Admin' } } = useERP();
  const appCurrentUser = useAppStore((s) => s.currentUser);
  const permissions = useAppStore((s) => s.permissions) || [];
  const currentUser = appCurrentUser || erpUser;
  const isAuthorizedManager = useMemo(() => {
    return Boolean(
      currentUser?.is_superuser ||
      currentUser?.is_staff ||
      currentUser?.role?.name?.toLowerCase().includes('manager') ||
      currentUser?.role?.name?.toLowerCase().includes('admin') ||
      currentUser?.role?.name?.toLowerCase().includes('lead') ||
      permissions.includes('adjust_stock') ||
      permissions.includes('manage_inventory') ||
      permissions.includes('view_inventory') ||
      !currentUser
    );
  }, [currentUser, permissions]);

  // Fallback direct-fetched master data if context has not loaded
  const [masterItems, setMasterItems] = useState([]);
  const [masterVendors, setMasterVendors] = useState([]);
  const [masterLocations, setMasterLocations] = useState([]);

  useEffect(() => {
    if (!items || items.length === 0) {
      inventoryService.getItems().then((res) => {
        const arr = Array.isArray(res) ? res : res?.results || [];
        setMasterItems(arr);
      }).catch(() => {});
    }
  }, [items]);

  useEffect(() => {
    if (!vendors || vendors.length === 0) {
      partiesService.getVendors().then((res) => {
        const arr = Array.isArray(res) ? res : res?.results || [];
        setMasterVendors(arr);
      }).catch(() => {});
    }
  }, [vendors]);

  useEffect(() => {
    if (!locations || locations.length === 0) {
      inventoryService.getLocations().then((res) => {
        const arr = Array.isArray(res) ? res : res?.results || [];
        setMasterLocations(arr);
      }).catch(() => {});
    }
  }, [locations]);

  const availableItems = items && items.length > 0 ? items : masterItems;
  const availableVendors = vendors && vendors.length > 0 ? vendors : masterVendors;
  const availableLocations = locations && locations.length > 0 ? locations : masterLocations;

  // Data State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters State
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [selectedQuality, setSelectedQuality] = useState('All');
  const [selectedDesign, setSelectedDesign] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedQCStatus, setSelectedQCStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination & Selection
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());

  // Side Panel / Drawer State ("Lot / Taka Details")
  const [activeLotRecord, setActiveLotRecord] = useState(null);
  const [detailsTab, setDetailsTab] = useState('movements'); // 'movements' | 'measurements' | 'qc'

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Resolve pipeline context from props, navigation state, or URL params
  const activePoId = propPoId || searchParams.get('po') || location.state?.poId || location.state?.po?.id || initialPo?.id || null;
  const activePoNumber = searchParams.get('poNumber') || location.state?.poNumber || location.state?.po?.poNumber || initialPo?.poNumber || null;
  const activeGrnId = propGrnId || searchParams.get('grn') || location.state?.grnId || location.state?.grn?.id || initialGrn?.id || null;
  const activeGrnNumber = searchParams.get('grnNumber') || location.state?.grnNumber || location.state?.grn?.grnNumber || initialGrn?.grnNumber || null;

  const [pipelinePo, setPipelinePo] = useState(initialPo || location.state?.po || null);
  const [pipelineGrns, setPipelineGrns] = useState(initialGrn ? [initialGrn] : (location.state?.grn ? [location.state?.grn] : []));
  const [selectedPipelineGrn, setSelectedPipelineGrn] = useState(initialGrn || location.state?.grn || null);
  const [loadingPipelineDocs, setLoadingPipelineDocs] = useState(false);
  const [isPipelineFilterActive, setIsPipelineFilterActive] = useState(
    Boolean(activePoId || activePoNumber || activeGrnId || activeGrnNumber || isEmbedded)
  );

  useEffect(() => {
    if (activePoId || activePoNumber || activeGrnId || activeGrnNumber || initialPo || initialGrn || isEmbedded) {
      setIsPipelineFilterActive(true);
      if (initialPo && (!pipelinePo || pipelinePo.id !== initialPo.id)) {
        setPipelinePo(initialPo);
      }
      if (initialGrn && (!selectedPipelineGrn || selectedPipelineGrn.id !== initialGrn.id)) {
        setSelectedPipelineGrn(initialGrn);
        setPipelineGrns((prev) => (prev.some((g) => g.id === initialGrn.id) ? prev : [initialGrn, ...prev]));
      }
    }
  }, [activePoId, activePoNumber, activeGrnId, activeGrnNumber, initialPo, initialGrn, isEmbedded]);

  useEffect(() => {
    if (!isPipelineFilterActive) return;

    let isMounted = true;
    const loadPipelineContext = async () => {
      setLoadingPipelineDocs(true);
      try {
        // 1. Resolve PO if needed
        let resolvedPo = pipelinePo;
        if (!resolvedPo && activePoId) {
          try {
            const poRes = await api.get(`/purchase/orders/${activePoId}/`);
            if (isMounted && poRes) {
              resolvedPo = poRes.data || poRes;
              setPipelinePo(resolvedPo);
            }
          } catch (e) {
            console.warn('Could not fetch PO details:', e);
          }
        }

        // 2. Resolve GRNs linked to this PO or GRN ID
        let grnList = [...pipelineGrns];
        if (activeGrnId && (!grnList || grnList.length === 0)) {
          try {
            const grnRes = await api.get(`/purchase/receipts/${activeGrnId}/`);
            const g = grnRes?.data || grnRes;
            if (g && isMounted) {
              grnList = [g];
              setPipelineGrns(grnList);
              setSelectedPipelineGrn(g);
            }
          } catch (e) {
            console.warn('Could not fetch GRN details:', e);
          }
        } else if (activePoId && (!grnList || grnList.length === 0)) {
          try {
            const receiptsRes = await api.get('/purchase/receipts/', {
              params: { purchaseOrderId: activePoId }
            });
            const rData = Array.isArray(receiptsRes)
              ? receiptsRes
              : (receiptsRes?.results || receiptsRes?.data || []);
            if (isMounted) {
              setPipelineGrns(rData);
              if (rData.length > 0 && !selectedPipelineGrn) {
                const matched = activeGrnNumber
                  ? rData.find(g => (g.grn_number || g.grnNumber) === activeGrnNumber)
                  : rData[0];
                setSelectedPipelineGrn(matched || rData[0]);
              }
            }
          } catch (e) {
            console.warn('Could not fetch PO receipts:', e);
          }
        }
      } finally {
        if (isMounted) setLoadingPipelineDocs(false);
      }
    };

    loadPipelineContext();
    return () => { isMounted = false; };
  }, [activePoId, activeGrnId, activeGrnNumber, isPipelineFilterActive]);

  // Derived active GRN & calculations
  const activeGrn = selectedPipelineGrn || (pipelineGrns.length > 0 ? pipelineGrns[0] : null);
  const grnLines = activeGrn?.lines || [];
  const grnTotalReceivedQty = useMemo(() => {
    if (!grnLines.length) return Number(location.state?.receivedQty || activeGrn?.receivedQty || 0);
    return grnLines.reduce((s, l) => s + Number(l.received_qty || l.receivedQty || 0), 0);
  }, [grnLines, location.state, activeGrn]);

  // Takas matching active GRN
  const takasLinkedToGrn = useMemo(() => {
    if (!activeGrn || !data?.records) return [];
    const grnNo = (activeGrn.grn_number || activeGrn.grnNumber || '').toLowerCase();
    const grnId = String(activeGrn.id || '');
    return data.records.filter((r) => {
      const docNo = String(r.grnNo || '').toLowerCase();
      const docId = String(r.sourceDocumentId || '');
      return (grnNo && docNo === grnNo) || (grnId && docId === grnId);
    });
  }, [activeGrn, data?.records]);

  const assignedGrnMeters = useMemo(() => {
    return takasLinkedToGrn.reduce((s, r) => s + Number(r.receivedQty || 0), 0);
  }, [takasLinkedToGrn]);

  const unassignedGrnMeters = useMemo(() => {
    return Math.max(0, grnTotalReceivedQty - assignedGrnMeters);
  }, [grnTotalReceivedQty, assignedGrnMeters]);

  const poHasNoGrn = Boolean(
    isPipelineFilterActive && activePoId && !loadingPipelineDocs && pipelineGrns.length === 0
  );

  // GRN Split & Create Modal State
  const [isGrnSplitModalOpen, setIsGrnSplitModalOpen] = useState(false);
  const [submittingGrnSplit, setSubmittingGrnSplit] = useState(false);
  const [grnSplitSuccessMsg, setGrnSplitSuccessMsg] = useState(null);
  const [grnSplitForm, setGrnSplitForm] = useState({
    lotNo: '',
    itemId: '',
    itemName: '',
    supplierId: '',
    supplierName: '',
    rate: '',
    width: '',
    gsm: '',
    rollCount: 5,
    takas: [],
  });

  const openGrnSplitModal = useCallback(() => {
    if (!activeGrn) return;
    const firstLine = grnLines[0] || {};
    const defaultMetersToSplit = unassignedGrnMeters > 0 ? unassignedGrnMeters : grnTotalReceivedQty;
    const DEFAULT_TAKA_METERS = 90;
    const fullRolls = Math.floor(defaultMetersToSplit / DEFAULT_TAKA_METERS);
    const remainder = Math.round((defaultMetersToSplit - (fullRolls * DEFAULT_TAKA_METERS)) * 10000) / 10000;
    const defaultRolls = fullRolls + (remainder > 0.0001 ? 1 : 0);

    const generatedTakas = [];
    const existingCount = takasLinkedToGrn.length;
    for (let i = 0; i < fullRolls; i++) {
      const rollNum = existingCount + i + 1;
      generatedTakas.push({
        id: `taka-${Date.now()}-${i}`,
        takaRoll: String(rollNum),
        qty: DEFAULT_TAKA_METERS,
        rollWeight: '',
        width: firstLine.fabric_width || firstLine.fabricWidth || '58',
        remarks: '',
      });
    }
    if (remainder > 0.0001) {
      generatedTakas.push({
        id: `taka-${Date.now()}-${fullRolls}`,
        takaRoll: String(existingCount + fullRolls + 1),
        qty: remainder,
        rollWeight: '',
        width: firstLine.fabric_width || firstLine.fabricWidth || '58',
        remarks: '',
      });
    }
    if (generatedTakas.length === 0 && defaultMetersToSplit > 0) {
      generatedTakas.push({
        id: `taka-${Date.now()}-0`,
        takaRoll: String(existingCount + 1),
        qty: defaultMetersToSplit,
        rollWeight: '',
        width: firstLine.fabric_width || firstLine.fabricWidth || '58',
        remarks: '',
      });
    }

    const defaultLotNo = `LOT-${(activeGrn.grn_number || activeGrn.grnNumber || 'GRN').replace(/[^a-zA-Z0-9]/g, '')}`;

    setGrnSplitForm({
      lotNo: defaultLotNo,
      itemId: firstLine.itemId || firstLine.item_id || '',
      itemName: firstLine.itemName || firstLine.name || 'Grey Fabric',
      supplierId: activeGrn.party || activeGrn.vendorId || '',
      supplierName: activeGrn.vendorName || activeGrn.party_name || '',
      rate: firstLine.unit_cost || firstLine.rate || '',
      width: firstLine.fabric_width || firstLine.fabricWidth || '58',
      gsm: '',
      rollCount: defaultRolls,
      takas: generatedTakas,
    });
    setGrnSplitSuccessMsg(null);
    setIsGrnSplitModalOpen(true);
  }, [activeGrn, grnLines, unassignedGrnMeters, grnTotalReceivedQty, takasLinkedToGrn.length]);

  const handleAutoDistributeTakas = (count) => {
    const numRolls = Math.max(1, parseInt(count, 10) || 1);
    const available = unassignedGrnMeters > 0 ? unassignedGrnMeters : grnTotalReceivedQty;
    const metersPerRoll = Math.floor(available / numRolls);
    const remainder = available - (metersPerRoll * numRolls);
    const existingCount = takasLinkedToGrn.length;

    const newTakas = [];
    for (let i = 0; i < numRolls; i++) {
      const rollNum = existingCount + i + 1;
      const mtrs = i === numRolls - 1 ? metersPerRoll + remainder : metersPerRoll;
      newTakas.push({
        id: `taka-${Date.now()}-${i}`,
        takaRoll: String(rollNum),
        qty: mtrs,
        rollWeight: '',
        width: grnSplitForm.width || '58',
        remarks: '',
      });
    }
    setGrnSplitForm((prev) => ({
      ...prev,
      rollCount: numRolls,
      takas: newTakas,
    }));
  };

  const handleAutoDistributeDefault90m = () => {
    const available = unassignedGrnMeters > 0 ? unassignedGrnMeters : grnTotalReceivedQty;
    const DEFAULT_TAKA_METERS = 90;
    const fullRolls = Math.floor(available / DEFAULT_TAKA_METERS);
    const remainder = Math.round((available - (fullRolls * DEFAULT_TAKA_METERS)) * 10000) / 10000;
    const existingCount = takasLinkedToGrn.length;

    const newTakas = [];
    for (let i = 0; i < fullRolls; i++) {
      const rollNum = existingCount + i + 1;
      newTakas.push({
        id: `taka-${Date.now()}-${i}`,
        takaRoll: String(rollNum),
        qty: DEFAULT_TAKA_METERS,
        rollWeight: '',
        width: grnSplitForm.width || '58',
        remarks: '',
      });
    }
    if (remainder > 0.0001) {
      newTakas.push({
        id: `taka-${Date.now()}-${fullRolls}`,
        takaRoll: String(existingCount + fullRolls + 1),
        qty: remainder,
        rollWeight: '',
        width: grnSplitForm.width || '58',
        remarks: '',
      });
    }
    if (newTakas.length === 0 && available > 0) {
      newTakas.push({
        id: `taka-${Date.now()}-0`,
        takaRoll: String(existingCount + 1),
        qty: available,
        rollWeight: '',
        width: grnSplitForm.width || '58',
        remarks: '',
      });
    }
    setGrnSplitForm((prev) => ({
      ...prev,
      rollCount: newTakas.length,
      takas: newTakas,
    }));
  };

  const handleAddTakaRow = () => {
    const existingCount = grnSplitForm.takas.length;
    const nextRollNum = (parseInt(grnSplitForm.takas[existingCount - 1]?.takaRoll, 10) || existingCount) + 1;
    const currentSum = grnSplitForm.takas.reduce((s, t) => s + (Number(t.qty) || 0), 0);
    const maxAvail = unassignedGrnMeters > 0 ? unassignedGrnMeters : grnTotalReceivedQty;
    const remainingToAssign = Math.max(0, maxAvail - currentSum);

    setGrnSplitForm((prev) => ({
      ...prev,
      takas: [
        ...prev.takas,
        {
          id: `taka-${Date.now()}-${existingCount}`,
          takaRoll: String(nextRollNum),
          qty: remainingToAssign > 0 ? Math.min(90, remainingToAssign) : 90,
          rollWeight: '',
          width: prev.width || '58',
          remarks: '',
        },
      ],
    }));
  };

  const handleRemoveTakaRow = (idx) => {
    if (grnSplitForm.takas.length <= 1) return;
    setGrnSplitForm((prev) => ({
      ...prev,
      takas: prev.takas.filter((_, i) => i !== idx),
    }));
  };

  const handleTakaFieldChange = (idx, field, value) => {
    setGrnSplitForm((prev) => {
      const updated = [...prev.takas];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, takas: updated };
    });
  };

  const totalAssignedSplitMeters = grnSplitForm.takas.reduce(
    (s, t) => s + (Number(t.qty) || 0),
    0
  );
  const maxAllowedMeters = unassignedGrnMeters > 0 ? unassignedGrnMeters : grnTotalReceivedQty;
  const isSplitExceeding = totalAssignedSplitMeters > maxAllowedMeters + 0.001;
  const hasInvalidSplitRow = grnSplitForm.takas.some(
    (t) => !t.qty || Number(t.qty) <= 0 || !t.takaRoll
  );

  const handleSubmitGrnSplit = async (e) => {
    e.preventDefault();
    if (isSplitExceeding || hasInvalidSplitRow || submittingGrnSplit) return;
    setSubmittingGrnSplit(true);
    try {
      const payload = {
        itemId: grnSplitForm.itemId,
        supplierId: grnSplitForm.supplierId,
        grnId: activeGrn?.id,
        grnNo: activeGrn?.grn_number || activeGrn?.grnNumber,
        receivedDate: activeGrn?.receipt_date || new Date().toISOString().split('T')[0],
        lotNo: grnSplitForm.lotNo.trim(),
        qcStatus: 'Pending',
        rate: grnSplitForm.rate || 0,
        width: grnSplitForm.width || null,
        gsm: grnSplitForm.gsm || null,
        takas: grnSplitForm.takas.map((t) => ({
          takaRoll: String(t.takaRoll).trim(),
          qty: Number(t.qty),
          rollWeight: t.rollWeight ? Number(t.rollWeight) : null,
          width: t.width ? Number(t.width) : null,
          remarks: t.remarks || null,
        })),
      };

      const res = await api.post('/inventory/lot-register/', payload);
      setGrnSplitSuccessMsg(res?.message || `Successfully created ${payload.takas.length} takas for Lot ${payload.lotNo}!`);
      setTimeout(() => {
        setIsGrnSplitModalOpen(false);
        setGrnSplitSuccessMsg(null);
        fetchData(true);
      }, 1200);
    } catch (err) {
      console.error('Failed to create split takas:', err);
      const errDetail = err?.data?.message || err?.data?.detail || err?.message || 'Failed to create takas from GRN.';
      alert(`Error creating takas: ${errDetail}`);
    } finally {
      setSubmittingGrnSplit(false);
    }
  };

  const handleClearPipelineFilter = () => {
    setIsPipelineFilterActive(false);
    setSelectedPipelineGrn(null);
    setSearchParams({});
  };

  const [tagQrDataUrl, setTagQrDataUrl] = useState('');
  const [printingTag, setPrintingTag] = useState(false);

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // Image 2 Modal Popup
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isPrintTagModalOpen, setIsPrintTagModalOpen] = useState(false);
  const [tagModalRecord, setTagModalRecord] = useState(null);

  // Traceability Modal & Drawer State (Phase 2.3)
  const [isTraceabilityModalOpen, setIsTraceabilityModalOpen] = useState(false);
  const [traceabilityRecord, setTraceabilityRecord] = useState(null);
  const [traceabilityData, setTraceabilityData] = useState(null);
  const [traceabilityLoading, setTraceabilityLoading] = useState(false);
  const [traceabilityError, setTraceabilityError] = useState(null);

  const openTraceabilityModal = useCallback(async (record) => {
    if (!record) return;
    setTraceabilityRecord(record);
    setIsTraceabilityModalOpen(true);
    setTraceabilityLoading(true);
    setTraceabilityError(null);
    try {
      const target = record.id || record.takaId || record.lotNo;
      const res = await inventoryService.getLotTraceability(target);
      setTraceabilityData(res);
    } catch (err) {
      console.error('Failed to load lot traceability:', err);
      setTraceabilityError(err?.message || 'Could not fetch traceability tree.');
    } finally {
      setTraceabilityLoading(false);
    }
  }, []);

  const loadDrawerTraceability = useCallback(async (record) => {
    if (!record) return;
    setTraceabilityLoading(true);
    setTraceabilityError(null);
    try {
      const target = record.id || record.takaId || record.lotNo;
      const res = await inventoryService.getLotTraceability(target);
      setTraceabilityData(res);
    } catch (err) {
      console.error('Failed to load lot traceability:', err);
      setTraceabilityError(err?.message || 'Could not fetch traceability tree.');
    } finally {
      setTraceabilityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeLotRecord && detailsTab === 'traceability') {
      loadDrawerTraceability(activeLotRecord);
    }
  }, [activeLotRecord, detailsTab, loadDrawerTraceability]);

  // Lot cost ledger: every cost posting for the lot, including each
  // reprocess round as its own line (PDF §08, §09).
  const [lotCost, setLotCost] = useState(null);
  const [lotCostError, setLotCostError] = useState(null);
  useEffect(() => {
    if (!activeLotRecord || detailsTab !== 'cost') return;
    let active = true;
    setLotCost(null);
    setLotCostError(null);
    inventoryService.getLotLandedCost(activeLotRecord.lotNo)
      .then((res) => { if (active) setLotCost(res); })
      .catch((err) => { if (active) setLotCostError(err?.message || 'Could not load the lot cost.'); });
    return () => { active = false; };
  }, [activeLotRecord, detailsTab]);

  // Add Lot Modal Form State
  const [addForm, setAddForm] = useState({
    itemId: '',
    supplierId: '',
    sourceDoc: 'GRN',
    grnNo: '',
    receivedDate: new Date().toISOString().split('T')[0],
    lotNo: '',
    takaRoll: '1',
    barcode: '',
    receivedQty: '',
    rollWeight: '',
    width: '',
    pieces: '1',
    gsm: '',
    rate: '',
    locationId: '',
    qcStatus: '',
    remarks: '',
    tags: [],
    tagInput: '',
    imageUrl: '',
  });
  const [itemPreview, setItemPreview] = useState(null);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addSuccessMsg, setAddSuccessMsg] = useState(null);

  // Edit Modal Form State
  // Only descriptive fields are editable; location / rate / status / QC
  // status change through documents (transfer, adjustment, QC disposition).
  const [editForm, setEditForm] = useState({
    remarks: '',
    tags: [],
    rollWeight: '',
    width: '',
    gsm: '',
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editSuccessMsg, setEditSuccessMsg] = useState(null);

  // Fetch Register Data from Backend
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const query = {};
      if (fromDate) query.from_date = fromDate;
      if (toDate) query.to_date = toDate;
      if (selectedSupplier !== 'All') query.supplier = selectedSupplier;
      if (selectedQuality !== 'All') query.quality = selectedQuality;
      if (selectedDesign !== 'All') query.design = selectedDesign;
      if (selectedStatus !== 'All') query.status = selectedStatus;
      if (selectedQCStatus !== 'All') query.qc_status = selectedQCStatus;
      if (selectedLocation !== 'All') query.location = selectedLocation;
      if (searchQuery) query.search = searchQuery;

      // Pass pipeline context filter to backend where supported
      if (isPipelineFilterActive || isEmbedded) {
        if (selectedPipelineGrn?.grn_number || selectedPipelineGrn?.grnNumber || activeGrnNumber) {
          query.grn = selectedPipelineGrn?.grn_number || selectedPipelineGrn?.grnNumber || activeGrnNumber;
        } else if (activeGrnId) {
          query.grn = activeGrnId;
        } else if (activePoId) {
          query.po = activePoId;
        } else if (activePoNumber) {
          query.po = activePoNumber;
        } else if (isEmbedded) {
          // Still resolving PO/GRN context; avoid loading unrelated global lots
          setData({
            records: [],
            summaryCards: {
              totalLots: 0,
              totalQuantity: { qty: 0, inStock: 0, uom: 'm' },
              totalValue: { val: 0, avgRate: 0 },
              pendingQC: { qty: 0, lots: 0, uom: 'm' },
              onHold: { qty: 0, lots: 0, uom: 'm' }
            }
          });
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      const res = await inventoryService.getLotRegister(query);
      setData(res);

      // Auto-select first record for side panel if none selected
      if (!activeLotRecord && res?.records && res.records.length > 0) {
        setActiveLotRecord(res.records[0]);
      } else if (activeLotRecord && res?.records) {
        const found = res.records.find((r) => r.id === activeLotRecord.id);
        if (found) setActiveLotRecord(found);
      }
    } catch (err) {
      console.error('Failed to fetch lot register:', err);
      setError(err?.message || 'Failed to retrieve lot/taka records from the database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    fromDate,
    toDate,
    selectedSupplier,
    selectedQuality,
    selectedDesign,
    selectedStatus,
    selectedQCStatus,
    selectedLocation,
    searchQuery,
    isPipelineFilterActive,
    selectedPipelineGrn,
    activeGrnId,
    activeGrnNumber,
    activePoId,
    activePoNumber,
    isEmbedded,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Search & Filter Reset
  const handleResetFilters = () => {
    setFromDate('');
    setToDate('');
    setSelectedSupplier('All');
    setSelectedQuality('All');
    setSelectedDesign('All');
    setSelectedStatus('All');
    setSelectedLocation('All');
    setSelectedQCStatus('All');
    setSearchQuery('');
    setCurrentPage(1);
    if (isPipelineFilterActive) {
      setIsPipelineFilterActive(false);
      setSelectedPipelineGrn(null);
      setSearchParams({});
    }
  };

  // Merge the selected takas into one processing batch (PDF §06).
  const [mergeLotNumber, setMergeLotNumber] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeMessage, setMergeMessage] = useState('');
  const handleMergeLots = async () => {
    const ids = [...selectedRowIds];
    if (ids.length < 2) return;
    if (!window.confirm(`Merge ${ids.length} takas into one lot? Their full available quantity moves to the new lot.`)) return;
    setMerging(true);
    setMergeMessage('');
    try {
      const res = await inventoryService.mergeLots({ lotTakaIds: ids, lotNumber: mergeLotNumber.trim() || undefined });
      setMergeMessage(res?.message || 'Lots merged.');
      setSelectedRowIds(new Set());
      setMergeLotNumber('');
      fetchData(true);
    } catch (err) {
      const problems = err?.payload?.payload?.problems;
      setMergeMessage(problems?.length ? problems.join(' ') : (err?.message || 'Could not merge the lots.'));
    } finally {
      setMerging(false);
    }
  };

  // Row selection handlers
  const toggleSelectRow = (id) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  const paginatedRecords = useMemo(() => {
    const all = data?.records || [];
    const start = (currentPage - 1) * pageSize;
    return all.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  const totalPages = Math.ceil((data?.records?.length || 0) / pageSize) || 1;

  const isAllPageSelected =
    paginatedRecords.length > 0 && paginatedRecords.every((r) => selectedRowIds.has(r.id));

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      const next = new Set(selectedRowIds);
      paginatedRecords.forEach((r) => next.delete(r.id));
      setSelectedRowIds(next);
    } else {
      const next = new Set(selectedRowIds);
      paginatedRecords.forEach((r) => next.add(r.id));
      setSelectedRowIds(next);
    }
  };

  // When selecting an item in Add Lot Modal
  const handleItemSelectInAddModal = async (itemId) => {
    const chosen = availableItems.find((i) => String(i.id) === String(itemId));
    setAddForm((prev) => ({
      ...prev,
      itemId,
      uom: chosen?.uom || 'm',
      rate: chosen?.standard_cost || prev.rate || '',
    }));

    if (itemId) {
      try {
        const res = await inventoryService.getLotRegister({ item_id: itemId });
        if (res?.itemPreview) {
          setItemPreview(res.itemPreview);
        } else if (chosen) {
          setItemPreview({
            itemCode: chosen.sku,
            itemName: chosen.name,
            quality: chosen.fabric_quality || chosen.name,
            design: chosen.fabric_design || 'Plain',
            shade: chosen.fabric_color || 'Default',
            uom: chosen.uom || 'm',
            currentStock: 0,
            recentLots: [],
          });
        }
      } catch (err) {
        console.warn('Failed to load item preview:', err);
      }
    } else {
      setItemPreview(null);
    }
  };

  // Generate Auto Barcode
  const handleGenerateBarcode = () => {
    if (!addForm.lotNo || !addForm.takaRoll) {
      alert('Enter the lot number and taka / roll first.');
      return;
    }
    const lot = addForm.lotNo;
    const taka = addForm.takaRoll;
    setAddForm((prev) => ({ ...prev, barcode: `${lot}-${taka}` }));
  };

  // Add tag pill in Add Modal
  const handleAddTag = (e) => {
    if (e.key === 'Enter' && addForm.tagInput.trim()) {
      e.preventDefault();
      const val = addForm.tagInput.trim();
      if (!addForm.tags.includes(val)) {
        setAddForm((prev) => ({
          ...prev,
          tags: [...prev.tags, val],
          tagInput: '',
        }));
      }
    }
  };

  const handleRemoveTag = (tToRemove) => {
    setAddForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tToRemove),
    }));
  };

  // Submit Add Lot Form (Image 2)
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.itemId) {
      alert('Please select a fabric item.');
      return;
    }
    if (!addForm.locationId) {
      alert('Please choose the storage location.');
      return;
    }
    if (!addForm.qcStatus) {
      alert('Please choose the QC status (Passed goes to stock, Pending goes to QC Hold).');
      return;
    }
    if (!addForm.receivedQty || Number(addForm.receivedQty) <= 0) {
      alert('Please enter a valid received quantity greater than 0.');
      return;
    }

    setSubmittingAdd(true);
    setAddSuccessMsg(null);
    try {
      const payload = {
        itemId: addForm.itemId,
        supplierId: addForm.supplierId || undefined,
        supplier: availableVendors.find((v) => String(v.id) === String(addForm.supplierId))?.name || '',
        sourceDoc: addForm.sourceDoc,
        grnNo: addForm.grnNo || undefined,
        receivedDate: addForm.receivedDate,
        // Blank lot number -> the server allocates one (LOT series).
        lotNo: addForm.lotNo.trim() || undefined,
        takaRoll: addForm.takaRoll.trim(),
        barcode: addForm.barcode.trim(),
        receivedQty: Number(addForm.receivedQty),
        rollWeight: addForm.rollWeight ? Number(addForm.rollWeight) : undefined,
        width: addForm.width ? Number(addForm.width) : undefined,
        pieces: Number(addForm.pieces || 1),
        gsm: addForm.gsm ? Number(addForm.gsm) : undefined,
        rate: addForm.rate ? Number(addForm.rate) : 0,
        locationId: addForm.locationId,
        qcStatus: addForm.qcStatus,
        remarks: addForm.remarks,
        tags: addForm.tags,
        imageUrl: addForm.imageUrl,
      };

      const res = await inventoryService.createLotTaka(payload);
      setAddSuccessMsg(res?.message || 'Lot / Taka registered and posted to stock ledger!');

      setTimeout(() => {
        setIsAddModalOpen(false);
        setAddSuccessMsg(null);
        setAddForm({
          itemId: '',
          supplierId: '',
          sourceDoc: 'GRN',
          grnNo: '',
          receivedDate: new Date().toISOString().split('T')[0],
          lotNo: '',
          takaRoll: '1',
          barcode: '',
          receivedQty: '',
          rollWeight: '',
          width: '',
          pieces: '1',
          gsm: '',
          rate: '',
          locationId: '',
          qcStatus: '',
          remarks: '',
          tags: [],
          tagInput: '',
          imageUrl: '',
        });
        setItemPreview(null);
        fetchData(true);
      }, 1000);
    } catch (err) {
      alert(err?.response?.data?.detail || err?.message || 'Failed to create Lot/Taka.');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Edit Lot Modal Handler
  const openEditModal = (row) => {
    setEditingRecord(row);
    setEditForm({
      remarks: row.remarks === '-' ? '' : row.remarks,
      tags: Array.isArray(row.tags) ? [...row.tags] : [],
      rollWeight: row.rollWeight ?? '',
      width: row.width ?? '',
      gsm: row.gsm ?? '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;
    setSubmittingEdit(true);
    setEditSuccessMsg(null);
    try {
      const payload = {
        remarks: editForm.remarks,
        tags: editForm.tags,
        rollWeight: editForm.rollWeight === '' ? null : Number(editForm.rollWeight),
        width: editForm.width === '' ? null : Number(editForm.width),
        gsm: editForm.gsm === '' ? null : Number(editForm.gsm),
      };

      const res = await inventoryService.updateLotTaka(editingRecord.id, payload);
      setEditSuccessMsg(res?.message || 'Lot details updated successfully.');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccessMsg(null);
        setEditingRecord(null);
        fetchData(true);
      }, 900);
    } catch (err) {
      alert(err?.response?.data?.detail || err?.message || 'Failed to update Lot.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Print Tag Modal Handler
  const openPrintTagModal = async (row) => {
    setTagModalRecord(row);
    setIsPrintTagModalOpen(true);
    try {
      const qrPayload = JSON.stringify({
        id: row.takaId || row.barcode || `${row.lotNo}-${row.takaRoll}`,
        lot: row.lotNo,
        roll: row.takaRoll,
        item: row.itemCode,
        qty: row.receivedQty,
        qc: row.qcStatus,
      });
      const url = await QRCode.toDataURL(qrPayload, {
        width: 120,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setTagQrDataUrl(url);
    } catch {
      setTagQrDataUrl('');
    }
  };

  const handlePrintTagAndRecord = async () => {
    if (!tagModalRecord) return;
    setPrintingTag(true);
    try {
      await inventoryService.recordTakaTagPrint({
        ids: [tagModalRecord.id],
        actionType: (tagModalRecord.printCount || 0) > 0 ? 'REPRINT' : 'PRINT',
        notes: 'Printed from Lot/Taka Register',
      });
      fetchData(true);
      window.print();
    } catch (err) {
      console.warn('Failed to record print audit log:', err);
      window.print();
    } finally {
      setPrintingTag(false);
    }
  };

  // CSV Export
  const handleExport = () => {
    const recordsToExport = data?.records || [];
    exportToCsv(`Lot_Taka_Register_${new Date().toISOString().split('T')[0]}.csv`, recordsToExport);
  };

  const summary = data?.summaryCards || {};

  return (
    <div className={isEmbedded ? "space-y-4 p-1" : "space-y-4"}>
      {/* ── TOP HEADER (Image 1) ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 grid place-items-center shrink-0">
            <Package size={20} className="text-teal-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Lot / Taka Register</h1>
              <PageInfoButton title="Lot / Taka Register" />
              <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-50 text-teal-700 rounded border border-teal-200">
                Live Register
              </span>
              {isPipelineFilterActive && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded border border-blue-200">
                  Pipeline Mode: {activePoNumber ? `PO #${activePoNumber}` : (activeGrnNumber ? `GRN #${activeGrnNumber}` : 'Filtered')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Track fabric lot/taka wise details, quantities, stock status and complete movement history.
            </p>
          </div>
        </div>

        {/* Action Buttons: [Taka Tag Hub], [Print] and [+ Add Lot / Taka] */}
        <div className="flex items-center gap-2">
          {!isEmbedded && isPipelineFilterActive && (
            <button
              onClick={handleClearPipelineFilter}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              title="Clear pipeline filter and show all lots"
            >
              <RotateCcw size={13} />
              All Lots
            </button>
          )}
          <button
            onClick={() => {
              if (isEmbedded) {
                const targetRecord = activeLotRecord || (data?.records && data.records[0]);
                if (targetRecord) {
                  openPrintTagModal(targetRecord);
                } else {
                  alert('No takas registered yet for this order. Please inward GRN in Stage 3 and split rolls first.');
                }
              } else {
                navigate('/inventory/taka-tags');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            title={isEmbedded ? "Preview & Print Taka Tag directly in this slide" : "Open Taka Tag Print Hub with Barcode Scanner & Multi-print"}
          >
            <Tag size={13} className="text-purple-600" />
            Taka Tag Hub
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Printer size={13} />
            Print
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus size={14} />
            + Add Lot / Taka
          </button>
        </div>
      </div>

      {/* ── PIPELINE CONTEXT BANNER ────────────────────────────────────────── */}
      {isPipelineFilterActive && (
        <div className="space-y-2">
          {poHasNoGrn ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 border border-amber-200 text-amber-700 grid place-items-center shrink-0 mt-0.5">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-amber-900">GRN / Inward Required Before Lot Creation</h3>
                    <span className="px-2 py-0.5 text-[10.5px] font-mono font-bold bg-amber-100 text-amber-800 rounded border border-amber-300">
                      PO #{activePoNumber || activePoId}
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-1">
                    No Goods Receipt (GRN) has been recorded for this Purchase Order yet. In accordance with textile inventory rules, fabric lots and takas cannot be created from an unreceived PO. Please record GRN / Inward first.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isEmbedded && onSelectStage ? (
                  <button
                    type="button"
                    onClick={() => onSelectStage(3)}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <PackageCheck size={14} /> Record GRN in Stage 3
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/purchase/orders')}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <PackageCheck size={14} /> Go to PO & Record GRN
                  </button>
                )}
                {!isEmbedded && (
                  <button
                    type="button"
                    onClick={handleClearPipelineFilter}
                    className="px-3 py-1.5 bg-white border border-amber-200 hover:bg-amber-50 text-amber-800 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                  >
                    View All Lots
                  </button>
                )}
              </div>
            </div>
          ) : activeGrn ? (
            <div className={`rounded-xl p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs transition-all ${
              unassignedGrnMeters > 0 || takasLinkedToGrn.length === 0
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50/50 border-blue-200'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 mt-0.5 border ${
                  unassignedGrnMeters > 0 || takasLinkedToGrn.length === 0
                    ? 'bg-blue-100 border-blue-200 text-blue-700'
                    : 'bg-emerald-100 border-emerald-200 text-emerald-700'
                }`}>
                  {unassignedGrnMeters > 0 || takasLinkedToGrn.length === 0 ? <PackageCheck size={18} /> : <CheckCircle2 size={18} />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider rounded bg-blue-100 text-blue-800 border border-blue-200">
                      Pipeline Context
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800">
                      GRN #{activeGrn.grn_number || activeGrn.grnNumber}
                    </span>
                    {(activePoNumber || activeGrn.poNumber) && (
                      <span className="text-xs text-slate-500 font-medium">
                        (Linked PO #{activePoNumber || activeGrn.poNumber})
                      </span>
                    )}
                    {activeGrn.vendorName && (
                      <span className="text-xs text-slate-600 font-semibold">
                        • {activeGrn.vendorName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    <strong>{grnTotalReceivedQty.toLocaleString('en-IN')} M</strong> received on GRN.
                    {' '}<strong className="text-indigo-700">{takasLinkedToGrn.length} Takas</strong> created ({assignedGrnMeters.toLocaleString('en-IN')} M assigned).
                    {unassignedGrnMeters > 0 ? (
                      <span className="text-amber-700 font-bold ml-1">
                        • {unassignedGrnMeters.toLocaleString('en-IN')} M unassigned & ready to split into takas.
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-semibold ml-1">
                        • Complete quantity assigned. All takas in QC Hold awaiting inspection.
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(unassignedGrnMeters > 0 || takasLinkedToGrn.length === 0) && (
                  <button
                    type="button"
                    onClick={openGrnSplitModal}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} /> Create & Split Takas from GRN
                  </button>
                )}
                {!isEmbedded && (
                  <button
                    type="button"
                    onClick={handleClearPipelineFilter}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer flex items-center gap-1"
                  >
                    <X size={13} /> Clear Filter (View All)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-blue-600" />
                <span className="font-semibold text-blue-900">
                  Filtering lot/taka register for PO #{activePoNumber || activePoId}
                </span>
              </div>
              {!isEmbedded && (
                <button
                  type="button"
                  onClick={handleClearPipelineFilter}
                  className="px-3 py-1 bg-white border border-blue-200 hover:bg-blue-50 text-blue-800 rounded-lg text-xs font-semibold shadow-2xs cursor-pointer flex items-center gap-1"
                >
                  <X size={12} /> Clear Filter
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 5 TOP SUMMARY CARDS (Image 1) ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <KpiCard
          label="Total Lots / Taka"
          value={summary.totalLots?.count ? summary.totalLots.count.toLocaleString('en-IN') : '0'}
          sub={`Active ${summary.totalLots?.active || 0} | Closed ${summary.totalLots?.closed || 0}`}
          icon={Layers}
          tone="blue"
        />
        <KpiCard
          label="Total Quantity"
          value={formatQty(summary.totalQuantity?.qty, summary.totalQuantity?.uom || 'm')}
          sub={`In Stock ${formatQty(summary.totalQuantity?.inStock, summary.totalQuantity?.uom || 'm')}`}
          icon={Package}
          tone="emerald"
        />
        <KpiCard
          label="Total Value"
          value={formatINR(summary.totalValue?.val)}
          sub={`Avg. Rate ₹ ${summary.totalValue?.avgRate?.toFixed(2) || '0.00'}/m`}
          icon={Wallet}
          tone="sky"
        />
        <KpiCard
          label="Pending QC"
          value={formatQty(summary.pendingQC?.qty, summary.pendingQC?.uom || 'm')}
          sub={`${summary.pendingQC?.lots || 0} Lots`}
          icon={Clock}
          tone="purple"
        />
        <KpiCard
          label="On Hold"
          value={formatQty(summary.onHold?.qty, summary.onHold?.uom || 'm')}
          sub={`${summary.onHold?.lots || 0} Lots`}
          icon={AlertTriangle}
          tone="amber"
        />
      </div>

      {/* ── FILTER TOOLBAR (Image 1) ────────────────────────────────────────── */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
          {/* From Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supplier</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              {(data?.filters?.suppliers || []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Quality</label>
            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              {(data?.filters?.qualities || []).map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          {/* Design */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Design</label>
            <select
              value={selectedDesign}
              onChange={(e) => setSelectedDesign(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              {(data?.filters?.designs || []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Location / Godown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Location</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              {(data?.filters?.locations || []).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Lot No, Taka No, Item code, Supplier..."
              className="w-full h-8 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchData()}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Search size={13} />
              Search
            </button>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <RotateCcw size={12} />
              Reset
            </button>
            <button
              onClick={handleExport}
              disabled={!data?.records?.length}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Download size={13} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA (Split Table & Details Drawer) ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left / Center Table Section */}
        <div className={`${activeLotRecord ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200`}>
          {loading ? (
            <div className="py-20 text-center">
              <RotateCcw size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading live lot/taka register...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <ShieldAlert size={28} className="text-rose-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">Failed to load register</p>
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
              {selectedRowIds.size >= 2 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-blue-50 px-3 py-2 text-xs">
                  <span className="font-semibold text-blue-900">{selectedRowIds.size} takas selected</span>
                  <input
                    type="text"
                    value={mergeLotNumber}
                    onChange={(e) => setMergeLotNumber(e.target.value)}
                    placeholder="New lot no. (optional)"
                    className="w-44 rounded border border-slate-300 px-2 py-1"
                  />
                  <button
                    type="button"
                    disabled={merging}
                    onClick={handleMergeLots}
                    className="rounded bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    title="Same item, same godown, available stock only"
                  >
                    {merging ? 'Merging…' : 'Merge lots'}
                  </button>
                  <button type="button" onClick={() => setSelectedRowIds(new Set())} className="text-slate-500 hover:underline">
                    Clear
                  </button>
                  {mergeMessage && <span className="font-semibold text-slate-700">{mergeMessage}</span>}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={isAllPageSelected}
                          onChange={toggleSelectAllPage}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-2">#</th>
                      <th className="py-3 px-3">Lot No.</th>
                      <th className="py-3 px-2.5">Taka / Roll No.</th>
                      <th className="py-3 px-3">Item Code</th>
                      <th className="py-3 px-3">Fabric Item</th>
                      <th className="py-3 px-2.5">Quality</th>
                      <th className="py-3 px-2.5">Design</th>
                      <th className="py-3 px-2.5">Shade</th>
                      <th className="py-3 px-3 text-right">Received Qty (m)</th>
                      <th className="py-3 px-3 text-center">QC Status</th>
                      <th className="py-3 px-3 text-right">Available Qty (m)</th>
                      <th className="py-3 px-3">Location</th>
                      <th className="py-3 px-3">Supplier</th>
                      <th className="py-3 px-3">Received Date</th>
                      <th className="py-3 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {paginatedRecords.map((row, idx) => {
                      const isSelected = selectedRowIds.has(row.id);
                      const isDrawerActive = activeLotRecord?.id === row.id;

                      return (
                        <tr
                          key={row.id || idx}
                          onClick={() => setActiveLotRecord(row)}
                          className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                            isDrawerActive
                              ? 'bg-blue-50/40 ring-1 ring-blue-500/20'
                              : isSelected
                              ? 'bg-blue-50/20'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
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
                          <td className="py-2 px-3 font-mono font-bold text-blue-600">{row.lotNo}</td>
                          <td className="py-2 px-2.5 font-mono font-semibold text-slate-700">{row.takaRoll}</td>
                          <td className="py-2 px-3 font-mono text-slate-900 font-semibold">{row.itemCode}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{row.itemName}</td>
                          <td className="py-2 px-2.5 text-slate-700">{row.quality}</td>
                          <td className="py-2 px-2.5 text-slate-600">{row.design}</td>
                          <td className="py-2 px-2.5 text-slate-600">{row.shade}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatQty(row.receivedQty, '')}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                row.qcStatus === 'Passed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : row.qcStatus === 'Pending'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : row.qcStatus === 'On Hold'
                                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                  : row.qcStatus === 'Reprocess'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {row.qcStatus}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-teal-700">
                            {formatQty(row.availableQty, '')}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 text-[10.5px]">{row.location}</td>
                          <td className="py-2 px-3 font-medium text-slate-700 truncate max-w-[120px]">{row.supplier}</td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">{row.receivedDate}</td>

                          {/* Action Buttons: [Eye] View, [Pencil] Edit, [Printer] Print Tag */}
                          <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setActiveLotRecord(row)}
                                className="w-6 h-6 rounded border border-blue-200 bg-blue-50/60 text-blue-600 hover:bg-blue-100 grid place-items-center transition cursor-pointer"
                                title="View Lot Details"
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                onClick={() => openEditModal(row)}
                                className="w-6 h-6 rounded border border-amber-200 bg-amber-50/60 text-amber-600 hover:bg-amber-100 grid place-items-center transition cursor-pointer"
                                title="Edit Lot Information"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => openPrintTagModal(row)}
                                className="w-6 h-6 rounded border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 grid place-items-center transition cursor-pointer"
                                title="Print Taka Tag"
                              >
                                <Printer size={12} />
                              </button>
                              <button
                                onClick={() => openTraceabilityModal(row)}
                                className="w-6 h-6 rounded border border-purple-200 bg-purple-50/60 text-purple-600 hover:bg-purple-100 grid place-items-center transition cursor-pointer"
                                title="Trace Lineage & Journey"
                              >
                                <GitBranch size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {paginatedRecords.length === 0 && (
                      <tr>
                        <td colSpan={16} className="py-12 text-center text-slate-400 font-sans text-xs">
                          {isPipelineFilterActive || isEmbedded ? (
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-600">
                                No takas registered for PO #{activePoNumber || activePoId || 'Active Order'} yet.
                              </p>
                              <p className="text-[11px] text-slate-500">
                                Total order quantity: {pipelinePo?.totalQuantity || pipelinePo?.qty || 189} M.
                                {activeGrn ? ' Click "Create & Split Takas from GRN" above to split this GRN into individual rolls.' : ' Record GRN / Inward in Stage 3 first to generate lots and takas.'}
                              </p>
                            </div>
                          ) : (
                            'No lot/taka records found matching current filters. Click "+ Add Lot / Taka" to register a new roll.'
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                <div>
                  Showing{' '}
                  <span className="font-bold text-slate-900">
                    {data?.records?.length ? (currentPage - 1) * pageSize + 1 : 0}
                  </span>{' '}
                  to{' '}
                  <span className="font-bold text-slate-900">
                    {Math.min(currentPage * pageSize, data?.records?.length || 0)}
                  </span>{' '}
                  of <span className="font-bold text-slate-900">{data?.records?.length || 0}</span> entries
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-7 px-2 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="w-7 h-7 grid place-items-center bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="px-2 text-xs font-bold text-slate-800">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="w-7 h-7 grid place-items-center bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT SIDE DETAILS PANEL ("Lot / Taka Details" - Image 1) ────── */}
        {activeLotRecord && (
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Lot / Taka Details</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {activeLotRecord.status || 'Active'}
                </span>
              </div>
              <button
                onClick={() => setActiveLotRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              {/* Fabric Swatch / Image Box */}
              <div className="relative rounded-xl overflow-hidden border border-slate-200 h-36 bg-gradient-to-tr from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center group">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                <div className="text-center z-10 px-3">
                  <span className="font-mono text-xs font-bold text-white tracking-widest uppercase block">
                    {activeLotRecord.lotNo} • TAKA {activeLotRecord.takaRoll}
                  </span>
                  <span className="text-[11px] text-blue-200 block mt-0.5 font-medium">
                    {activeLotRecord.itemName} ({activeLotRecord.shade})
                  </span>
                </div>
                <button
                  onClick={() => openEditModal(activeLotRecord)}
                  className="absolute bottom-2 left-2 px-2.5 py-1 bg-white/90 hover:bg-white text-slate-800 rounded-md text-[10.5px] font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <ImageIcon size={11} />
                  Change Image
                </button>
              </div>

              {/* Key-Value Details List (Image 1) */}
              <div className="space-y-2 text-[11.5px] border-b border-slate-100 pb-3">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Lot No.</span>
                  <span className="font-mono font-bold text-blue-600">{activeLotRecord.lotNo}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Taka / Roll No.</span>
                  <span className="font-mono font-semibold text-slate-800">{activeLotRecord.takaRoll}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Item Code</span>
                  <span className="font-mono font-bold text-slate-900">{activeLotRecord.itemCode}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Fabric Item</span>
                  <span className="font-semibold text-slate-800">{activeLotRecord.itemName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Quality</span>
                  <span className="text-slate-700 font-medium">{activeLotRecord.quality}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Design</span>
                  <span className="text-slate-700">{activeLotRecord.design}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Shade</span>
                  <span className="text-slate-700">{activeLotRecord.shade}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">UOM</span>
                  <span className="text-slate-700 uppercase font-semibold">{activeLotRecord.uom}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Received Qty</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatQty(activeLotRecord.receivedQty, activeLotRecord.uom)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">QC Status</span>
                  <span className="font-bold text-emerald-700">{activeLotRecord.qcStatus}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Available Qty</span>
                  <span className="font-mono font-extrabold text-teal-700">
                    {formatQty(activeLotRecord.availableQty, activeLotRecord.uom)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Location</span>
                  <span className="font-mono text-slate-700">{activeLotRecord.location}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Supplier</span>
                  <span className="font-medium text-slate-800">{activeLotRecord.supplier}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Received Date</span>
                  <span className="font-mono text-slate-600">{activeLotRecord.receivedDate}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400 font-medium">Remarks</span>
                  <span className="text-slate-600 italic">{activeLotRecord.remarks || '-'}</span>
                </div>
              </div>

              {/* Sub-Tabs: [Stock Movement] [Measurements] [QC Details] */}
              <div className="space-y-2">
                <div className="flex items-center gap-1 border-b border-slate-200 pb-1 text-xs">
                  <button
                    onClick={() => setDetailsTab('movements')}
                    className={`px-2.5 py-1 font-bold text-[11px] rounded-lg transition cursor-pointer ${
                      detailsTab === 'movements'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Stock Movement
                  </button>
                  <button
                    onClick={() => setDetailsTab('measurements')}
                    className={`px-2.5 py-1 font-bold text-[11px] rounded-lg transition cursor-pointer ${
                      detailsTab === 'measurements'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Measurements
                  </button>
                  <button
                    onClick={() => setDetailsTab('qc')}
                    className={`px-2.5 py-1 font-bold text-[11px] rounded-lg transition cursor-pointer ${
                      detailsTab === 'qc'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    QC Details
                  </button>
                  <button
                    onClick={() => {
                      setDetailsTab('traceability');
                      loadDrawerTraceability(activeLotRecord);
                    }}
                    className={`px-2.5 py-1 font-bold text-[11px] rounded-lg transition cursor-pointer ${
                      detailsTab === 'traceability'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Traceability
                  </button>
                  <button
                    onClick={() => setDetailsTab('cost')}
                    className={`px-2.5 py-1 font-bold text-[11px] rounded-lg transition cursor-pointer ${
                      detailsTab === 'cost'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Cost
                  </button>
                </div>

                {detailsTab === 'cost' && (
                  <div className="space-y-2 text-[11px]">
                    {lotCostError && <p className="font-semibold text-rose-600">{lotCostError}</p>}
                    {!lotCost && !lotCostError && <p className="text-slate-500">Loading lot cost…</p>}
                    {lotCost && (
                      <>
                        <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <span>Total cost <b className="font-mono">₹{lotCost.totalCost}</b></span>
                          <span>Good metres <b className="font-mono">{lotCost.goodFinishedMeters}</b></span>
                          <span>Cost per good metre <b className="font-mono">₹{lotCost.costPerMeter}</b></span>
                          <span>Reprocess <b className="font-mono">₹{lotCost.breakdown?.reprocess}</b></span>
                        </div>
                        <div className="overflow-hidden rounded-lg border border-slate-200">
                          <table className="w-full text-left text-[10.5px]">
                            <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-600">
                              <tr>
                                <th className="px-2 py-2">Date</th>
                                <th className="px-2 py-2">Cost type</th>
                                <th className="px-2 py-2">Source</th>
                                <th className="px-2 py-2 text-right">Metres</th>
                                <th className="px-2 py-2 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(lotCost.entries || []).length === 0 ? (
                                <tr><td colSpan={5} className="px-2 py-3 text-center text-slate-400">No costs posted to this lot yet.</td></tr>
                              ) : lotCost.entries.map((e) => (
                                <tr key={e.id} className={e.costType === 'Reprocess' ? 'bg-amber-50/60' : ''}>
                                  <td className="px-2 py-1.5">{e.date || '-'}</td>
                                  <td className="px-2 py-1.5 font-semibold">{e.costType}</td>
                                  <td className="px-2 py-1.5">{e.sourceDocumentNumber || e.sourceDocumentType}{e.remarks ? ` — ${e.remarks}` : ''}</td>
                                  <td className="px-2 py-1.5 text-right font-mono">{e.quantity}</td>
                                  <td className="px-2 py-1.5 text-right font-mono">₹{e.amount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Tab 1: Stock Movement Table */}
                {detailsTab === 'movements' && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-[10.5px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                        <tr>
                          <th className="py-2 px-2">Date</th>
                          <th className="py-2 px-2">Type</th>
                          <th className="py-2 px-2 text-right">Qty (m)</th>
                          <th className="py-2 px-2 text-right">Balance</th>
                          <th className="py-2 px-2">Ref. No.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {(activeLotRecord.stockMovements || []).map((m, mIdx) => (
                          <tr key={mIdx} className="hover:bg-slate-50/70">
                            <td className="py-1.5 px-2 text-slate-500">{m.date}</td>
                            <td className="py-1.5 px-2 font-sans font-medium text-slate-800">{m.type}</td>
                            <td
                              className={`py-1.5 px-2 text-right font-bold ${
                                m.qty > 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {m.qty > 0 ? `+${m.qty}` : m.qty}
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold text-slate-900">{m.balance}</td>
                            <td className="py-1.5 px-2 text-slate-600">{m.refNo}</td>
                          </tr>
                        ))}
                        {(!activeLotRecord.stockMovements || activeLotRecord.stockMovements.length === 0) && (
                          <tr>
                            <td colSpan={5} className="py-3 text-center text-slate-400 font-sans italic">
                              No movement transactions logged yet for this lot.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 2: Measurements */}
                {detailsTab === 'measurements' && (
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px]">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Roll Weight</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {activeLotRecord.rollWeight ? `${activeLotRecord.rollWeight} kg` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Width</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {activeLotRecord.width ? `${activeLotRecord.width} Inch` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg. GSM</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {activeLotRecord.gsm ? `${activeLotRecord.gsm} GSM` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Pieces / Rolls</span>
                      <span className="font-mono font-semibold text-slate-800">{activeLotRecord.pieces || 1}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Cost Rate</span>
                      <span className="font-mono font-bold text-slate-900">
                        ₹ {Number(activeLotRecord.rate || 0).toFixed(2)} / {activeLotRecord.uom}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tab 3: QC Details */}
                {detailsTab === 'qc' && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-bold uppercase text-[10px]">QC Inspection Status:</span>
                      <span className="font-bold text-emerald-700">{activeLotRecord.qcStatus}</span>
                    </div>
                    <div className="text-slate-600">
                      Quality check verified against Textile standard for Lot {activeLotRecord.lotNo}.
                    </div>
                    <button
                      onClick={() => openPrintTagModal(activeLotRecord)}
                      className="mt-2 w-full py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer size={13} />
                      Print Tag Slip
                    </button>
                  </div>
                )}

                {/* Tab 4: Traceability Quick View */}
                {detailsTab === 'traceability' && (
                  <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-3 text-[11px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <GitBranch size={14} className="text-purple-600" />
                        <span className="font-bold text-slate-800 uppercase text-[10.5px]">End-to-End Lineage</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">
                        Lineage Trace
                      </span>
                    </div>

                    {traceabilityLoading && (
                      <div className="py-4 text-center text-slate-400 italic">
                        Loading complete lineage tree...
                      </div>
                    )}

                    {!traceabilityLoading && traceabilityError && (
                      <div className="p-2 bg-rose-50 text-rose-700 rounded-lg text-xs">
                        {traceabilityError}
                      </div>
                    )}

                    {!traceabilityLoading && !traceabilityError && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white p-2 rounded-lg border border-purple-100">
                            <span className="text-[10px] text-slate-400 block font-semibold">Grey Parent Lots</span>
                            <span className="font-mono font-bold text-slate-800 text-xs">
                              {(traceabilityData?.ancestors || []).length > 0
                                ? `${traceabilityData.ancestors.length} Source Lot(s)`
                                : 'Direct / Origin Lot'}
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-purple-100">
                            <span className="text-[10px] text-slate-400 block font-semibold">Job Work Stages</span>
                            <span className="font-mono font-bold text-slate-800 text-xs">
                              {(traceabilityData?.jobWorkHistory || []).length > 0
                                ? `${traceabilityData.jobWorkHistory.length} Operation(s)`
                                : 'No Job Work'}
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-purple-100">
                            <span className="text-[10px] text-slate-400 block font-semibold">QC 4-Point Grade</span>
                            <span className="font-mono font-bold text-emerald-700 text-xs">
                              {(traceabilityData?.qcHistory || []).length > 0
                                ? `Grade ${traceabilityData.qcHistory[0].grade || 'Pass'}`
                                : (activeLotRecord.qcStatus || 'Pending')}
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-purple-100">
                            <span className="text-[10px] text-slate-400 block font-semibold">Child / Split Rolls</span>
                            <span className="font-mono font-bold text-slate-800 text-xs">
                              {(traceabilityData?.descendants || []).length} Output Rolls
                            </span>
                          </div>
                        </div>

                        {(traceabilityData?.jobWorkHistory || []).length > 0 && (
                          <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Latest Process</span>
                            <div className="text-[11px] font-semibold text-slate-800">
                              {traceabilityData.jobWorkHistory[0].process || 'Processing'} — {traceabilityData.jobWorkHistory[0].vendor}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Challan {traceabilityData.jobWorkHistory[0].challanNo} • {traceabilityData.jobWorkHistory[0].meters} m
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => openTraceabilityModal(activeLotRecord)}
                          className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <GitBranch size={13} />
                          Open Full Traceability Tree
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── IMAGE 2: + ADD LOT / TAKA MODAL POPUP (Directly inside page) ───── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-900 text-white grid place-items-center">
                  <Box size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Lot / Taka</h3>
                  <p className="text-[11px] text-slate-500">
                    Create a new lot/taka record for received fabric. This will be used in stock, QC, sample, sales and other transactions.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              {addSuccessMsg && (
                <div className="m-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>{addSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[75vh] overflow-y-auto">
                {/* Left Side: Steps indicator */}
                <div className="lg:col-span-2 bg-slate-50/60 p-4 border-r border-slate-200/80 space-y-4 text-xs hidden lg:block">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Steps</span>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0 mt-0.5">
                        1
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-[11px]">Basic Details</div>
                        <div className="text-[10px] text-slate-500 leading-tight">Select item, supplier and fabric details</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0 mt-0.5">
                        2
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-[11px]">Lot / Taka Information</div>
                        <div className="text-[10px] text-slate-500 leading-tight">Enter lot and taka/roll details</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0 mt-0.5">
                        3
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-[11px]">Quantity & Measurement</div>
                        <div className="text-[10px] text-slate-500 leading-tight">Enter received quantity and dimensions</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0 mt-0.5">
                        4
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-[11px]">Additional Details</div>
                        <div className="text-[10px] text-slate-500 leading-tight">Location, tags, remarks and documents</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle: 4 Form Sections */}
                <div className="lg:col-span-7 p-5 space-y-5 text-xs">
                  {/* 1. Basic Details */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0">
                        1
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs">Basic Details</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-bold text-slate-700 text-[11px]">
                            Item Code <span className="text-rose-500">*</span>
                          </label>
                          <MasterSourceLink source="items" />
                        </div>
                        <select
                          required
                          value={addForm.itemId}
                          onChange={(e) => handleItemSelectInAddModal(e.target.value)}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                        >
                          <option value="">Select Item Code</option>
                          {availableItems.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.sku} ({it.name})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Fabric Item <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={itemPreview?.itemName || ''}
                          placeholder="Auto-populated"
                          className="w-full h-8 px-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-semibold text-[11px]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Quality <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={itemPreview?.quality || ''}
                          placeholder="Auto-populated"
                          className="w-full h-8 px-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-semibold text-[11px]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Design <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={itemPreview?.design || ''}
                          placeholder="Auto-populated"
                          className="w-full h-8 px-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-semibold text-[11px]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Shade / Colour <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={itemPreview?.shade || ''}
                          placeholder="Auto-populated"
                          className="w-full h-8 px-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-semibold text-[11px]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          UOM <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={addForm.uom}
                          onChange={(e) => setAddForm({ ...addForm, uom: e.target.value })}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="Meter (m)">Meter (m)</option>
                          <option value="Yard">Yard</option>
                          <option value="Kg">Kg</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block font-bold text-slate-700 text-[11px]">
                              Supplier <span className="text-rose-500">*</span>
                            </label>
                            <MasterSourceLink source="vendors" />
                          </div>
                          <select
                            value={addForm.supplierId}
                            onChange={(e) => setAddForm({ ...addForm, supplierId: e.target.value })}
                            className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select Supplier</option>
                            {availableVendors.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1 text-[11px]">Source Document</label>
                          <select
                            value={addForm.sourceDoc}
                            onChange={(e) => setAddForm({ ...addForm, sourceDoc: e.target.value })}
                            className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="GRN">GRN</option>
                            <option value="Job Work Inward">Job Work Inward</option>
                            <option value="Opening Stock">Opening Stock</option>
                            <option value="Purchase Order">Purchase Order</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                            GRN No. <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={addForm.grnNo}
                            onChange={(e) => setAddForm({ ...addForm, grnNo: e.target.value })}
                            placeholder="e.g. GRN-001"
                            className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                            Received Date <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={addForm.receivedDate}
                            onChange={(e) => setAddForm({ ...addForm, receivedDate: e.target.value })}
                            className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Lot / Taka Information */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0">
                        2
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs">Lot / Taka Information</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Lot No. <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={addForm.lotNo}
                          onChange={(e) => setAddForm({ ...addForm, lotNo: e.target.value })}
                          placeholder="e.g. LT-001"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Taka / Roll No. <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={addForm.takaRoll}
                          onChange={(e) => setAddForm({ ...addForm, takaRoll: e.target.value })}
                          placeholder="e.g. 1"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Barcode / QR (Optional)</label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={addForm.barcode}
                            onChange={(e) => setAddForm({ ...addForm, barcode: e.target.value })}
                            placeholder="e.g. LT001-1"
                            className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={handleGenerateBarcode}
                            className="px-2.5 h-8 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10.5px] font-bold hover:bg-blue-100 transition shrink-0 cursor-pointer"
                          >
                            Generate
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Quantity & Measurement */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0">
                        3
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs">Quantity & Measurement</h4>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Received Quantity (m) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={addForm.receivedQty}
                          onChange={(e) => setAddForm({ ...addForm, receivedQty: e.target.value })}
                          placeholder="e.g. 100"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Roll Weight (kg) (Optional)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={addForm.rollWeight}
                          onChange={(e) => setAddForm({ ...addForm, rollWeight: e.target.value })}
                          placeholder="e.g. 25.50"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Width (Inch) (Optional)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={addForm.width}
                          onChange={(e) => setAddForm({ ...addForm, width: e.target.value })}
                          placeholder="e.g. 58"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">No. of Pieces / Rolls</label>
                        <input
                          type="number"
                          value={addForm.pieces}
                          onChange={(e) => setAddForm({ ...addForm, pieces: e.target.value })}
                          placeholder="e.g. 1"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Avg. GSM (Optional)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={addForm.gsm}
                          onChange={(e) => setAddForm({ ...addForm, gsm: e.target.value })}
                          placeholder="e.g. 120"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Rate (₹/m) (Optional)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={addForm.rate}
                          onChange={(e) => setAddForm({ ...addForm, rate: e.target.value })}
                          placeholder="e.g. 200.50"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Additional Details */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0">
                        4
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs">Additional Details</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-bold text-slate-700 text-[11px]">
                            Storage Location <span className="text-rose-500">*</span>
                          </label>
                          <MasterSourceLink source="godowns" />
                        </div>
                        <select
                          required
                          value={addForm.locationId}
                          onChange={(e) => setAddForm({ ...addForm, locationId: e.target.value })}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select Location / Rack</option>
                          {availableLocations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          QC Status <span className="text-rose-500">*</span>
                        </label>
                        <select
                          required
                          value={addForm.qcStatus}
                          onChange={(e) => setAddForm({ ...addForm, qcStatus: e.target.value })}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select</option>
                          <option value="Passed">Passed — goes into stock at this location</option>
                          <option value="Pending">Pending — held at QC Hold until inspected</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Tags (Optional)</label>
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={addForm.tagInput}
                            onChange={(e) => setAddForm({ ...addForm, tagInput: e.target.value })}
                            onKeyDown={handleAddTag}
                            placeholder="Type and press Enter (e.g. Premium)"
                            className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                          />
                          <div className="flex flex-wrap gap-1">
                            {addForm.tags.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold"
                              >
                                {t}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTag(t)}
                                  className="hover:text-rose-600 cursor-pointer"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Remarks</label>
                        <input
                          type="text"
                          value={addForm.remarks}
                          onChange={(e) => setAddForm({ ...addForm, remarks: e.target.value })}
                          placeholder="e.g. First lot received - good condition."
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column inside Modal: Item Preview & Stock Impact (Image 2) */}
                <div className="lg:col-span-3 bg-slate-50/70 p-4 border-l border-slate-200/80 space-y-4 text-xs">
                  {/* Item Preview */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Item Preview
                    </span>

                    <div className="w-full h-24 rounded-lg bg-gradient-to-tr from-slate-900 to-blue-900 flex items-center justify-center p-2 text-center text-white">
                      <div>
                        <div className="font-mono font-bold text-xs">{itemPreview?.itemCode || 'SELECT ITEM'}</div>
                        <div className="text-[10px] text-blue-200">{itemPreview?.itemName || 'Fabric item preview'}</div>
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] pt-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Item Code</span>
                        <span className="font-mono font-bold text-slate-900">{itemPreview?.itemCode || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Quality</span>
                        <span className="font-medium text-slate-800">{itemPreview?.quality || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Design</span>
                        <span className="text-slate-700">{itemPreview?.design || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Shade</span>
                        <span className="text-slate-700">{itemPreview?.shade || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">UOM</span>
                        <span className="text-slate-700 uppercase">{itemPreview?.uom || 'm'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stock & Availability (After Save) */}
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                      Stock & Availability (After Save)
                    </span>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between text-slate-600">
                        <span>Current Stock for this Item:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatQty(itemPreview?.currentStock || 0, itemPreview?.uom || 'm')}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>After Adding This Lot:</span>
                        <span className="font-mono font-bold">
                          +{formatQty(Number(addForm.receivedQty || 0), itemPreview?.uom || 'm')}
                        </span>
                      </div>
                      <div className="border-t border-emerald-200/80 pt-1 flex justify-between font-bold text-slate-900">
                        <span>Total Stock (Expected):</span>
                        <span className="font-mono text-emerald-800 text-xs">
                          {formatQty(
                            (Number(itemPreview?.currentStock || 0) + Number(addForm.receivedQty || 0)),
                            itemPreview?.uom || 'm'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Lots for this Item */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Recent Lots for this Item
                      </span>
                    </div>

                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(itemPreview?.recentLots || []).map((rl, rIdx) => (
                        <div
                          key={rIdx}
                          className="flex items-center justify-between py-1 border-b border-slate-50 text-[10.5px]"
                        >
                          <span className="font-mono font-bold text-blue-600">{rl.lotNo}</span>
                          <span className="text-slate-500 font-mono">Taka {rl.takaRoll}</span>
                          <span className="font-mono font-semibold text-slate-800">{rl.qty} m</span>
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] bg-emerald-50 text-emerald-700 font-bold">
                            {rl.status}
                          </span>
                        </div>
                      ))}
                      {(!itemPreview?.recentLots || itemPreview.recentLots.length === 0) && (
                        <p className="text-[10px] text-slate-400 italic py-2 text-center">
                          No previous lots recorded for this item.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 p-3.5 border-t border-slate-200 bg-slate-50/70">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50 transition cursor-pointer"
                >
                  {submittingAdd ? 'Saving Lot / Taka...' : 'Save Lot / Taka'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT LOT / TAKA MODAL ────────────────────────────────────────── */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Edit Lot: {editingRecord.lotNo} (Taka {editingRecord.takaRoll})
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-4 space-y-3 text-xs">
              {editSuccessMsg && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold">
                  {editSuccessMsg}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.rollWeight}
                    onChange={(e) => setEditForm({ ...editForm, rollWeight: e.target.value })}
                    className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Width (in)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.width}
                    onChange={(e) => setEditForm({ ...editForm, width: e.target.value })}
                    className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GSM</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.gsm}
                    onChange={(e) => setEditForm({ ...editForm, gsm: e.target.value })}
                    className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  placeholder="Update remarks..."
                  className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PRINT TAKA TAG MODAL (Feature 4) ──────────────────────────────── */}
      {isPrintTagModalOpen && tagModalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-3.5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Printer size={16} className="text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">Physical Taka Tag Preview</h3>
                <span className="text-[10px] font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                  {tagModalRecord.takaId || tagModalRecord.barcode || `${tagModalRecord.lotNo}-${tagModalRecord.takaRoll}`}
                </span>
              </div>
              <button
                onClick={() => setIsPrintTagModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Printable Taka Tag Canvas */}
            <div className="p-4 space-y-3 bg-slate-50">
              <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs flex justify-center">
                <TakaTagLabel taka={tagModalRecord} qrDataUrl={tagQrDataUrl} />
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                {!isEmbedded ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintTagModalOpen(false);
                      navigate(`/inventory/taka-tags?search=${encodeURIComponent(tagModalRecord.takaId || tagModalRecord.lotNo)}`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                    title="Open in full Taka Tag Print Hub with scanner, batch printing and audit logs"
                  >
                    <Tag size={13} className="text-purple-600" />
                    Tag Hub
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    {data?.records && data.records.length > 1 && (
                      <select
                        value={tagModalRecord.id}
                        onChange={(e) => {
                          const chosen = data.records.find((r) => r.id === e.target.value);
                          if (chosen) openPrintTagModal(chosen);
                        }}
                        className="text-xs font-semibold px-2 py-1 border border-slate-300 rounded-lg bg-white text-slate-700 shadow-2xs"
                        title="Switch between takas for this order"
                      >
                        {data.records.map((r, idx) => (
                          <option key={r.id} value={r.id}>
                            Taka #{r.takaRoll || idx + 1} ({r.receivedQty || 0}m)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => inventoryService.openTakaTagsPdf([tagModalRecord.id]).catch((err) => alert(err?.message || 'Could not download PDF.'))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                    title="Download 60x40mm thermal label PDF"
                  >
                    <Download size={12} />
                    PDF Label
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintTagAndRecord}
                    disabled={printingTag}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Printer size={13} />
                    {printingTag ? 'Recording...' : 'Print Tag'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FULL TRACEABILITY MODAL ──────────── */}
      {isTraceabilityModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 grid place-items-center font-bold">
                  <GitBranch size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">End-to-End Lot & Taka Traceability</h3>
                    <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                      Full Traceability
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Target: <span className="font-mono font-bold text-slate-800">{traceabilityRecord?.lotNo}</span> • Roll <span className="font-mono font-bold text-slate-800">{traceabilityRecord?.takaRoll || 1}</span> • ID: <span className="font-mono text-purple-700">{traceabilityRecord?.takaId || traceabilityRecord?.id}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTraceabilityModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg hover:bg-slate-200 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
              {traceabilityLoading && (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <div className="inline-block animate-spin w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full" />
                  <p className="font-medium text-sm">Building complete lineage tree & process history...</p>
                </div>
              )}

              {!traceabilityLoading && traceabilityError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Error loading traceability data
                  </div>
                  <p>{traceabilityError}</p>
                </div>
              )}

              {!traceabilityLoading && !traceabilityError && traceabilityData && (
                <>
                  {/* Hero Target Card */}
                  <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-4 rounded-xl shadow-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                      <div>
                        <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider block">Inspected Fabric Roll</span>
                        <h4 className="text-base font-bold">
                          {traceabilityData.target?.itemName || traceabilityRecord?.itemName || 'Fabric Item'}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-xs">
                          Status: {traceabilityData.target?.status || traceabilityRecord?.status}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                          QC: {traceabilityData.target?.qcStatus || traceabilityRecord?.qcStatus}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-[11px]">
                      <div>
                        <span className="text-white/60 block text-[10px]">Quality</span>
                        <span className="font-semibold text-white">{traceabilityData.target?.quality || '—'}</span>
                      </div>
                      <div>
                        <span className="text-white/60 block text-[10px]">Design</span>
                        <span className="font-semibold text-white">{traceabilityData.target?.design || '—'}</span>
                      </div>
                      <div>
                        <span className="text-white/60 block text-[10px]">Shade</span>
                        <span className="font-semibold text-white">{traceabilityData.target?.shade || '—'}</span>
                      </div>
                      <div>
                        <span className="text-white/60 block text-[10px]">Current Location</span>
                        <span className="font-mono font-semibold text-white">{traceabilityData.target?.location || '—'}</span>
                      </div>
                      <div>
                        <span className="text-white/60 block text-[10px]">Available Qty</span>
                        <span className="font-mono font-bold text-emerald-300">
                          {traceabilityData.target?.availableQty} {traceabilityData.target?.uom || 'm'}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/60 block text-[10px]">Width / GSM</span>
                        <span className="font-mono text-white">
                          {traceabilityData.target?.width || '—'}" / {traceabilityData.target?.gsm || '—'} GSM
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 1. Origin Grey Parent Lots */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                        <Building size={14} className="text-blue-600" />
                        1. Origin Grey Parent Lots (Source Lineage)
                      </h4>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {(traceabilityData.ancestors || []).length} Parent Lot(s)
                      </span>
                    </div>

                    {(traceabilityData.ancestors || []).length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase">
                            <tr>
                              <th className="py-2 px-3">Parent Lot No</th>
                              <th className="py-2 px-3">Taka / Roll</th>
                              <th className="py-2 px-3">Item / Quality</th>
                              <th className="py-2 px-3 text-right">Received Qty</th>
                              <th className="py-2 px-3">Location</th>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Source Document</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                            {traceabilityData.ancestors.map((anc, aIdx) => (
                              <tr key={aIdx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-bold text-blue-700">{anc.lotNo}</td>
                                <td className="py-2 px-3">{anc.takaRoll}</td>
                                <td className="py-2 px-3 font-sans font-medium text-slate-800">{anc.quality || anc.itemName}</td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900">{anc.receivedQty} {anc.uom}</td>
                                <td className="py-2 px-3 text-slate-600">{anc.location || '—'}</td>
                                <td className="py-2 px-3 text-slate-500">{anc.receivedDate}</td>
                                <td className="py-2 px-3 text-slate-600 font-sans">{anc.sourceDocType || 'GRN'} {anc.sourceDocNo}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 flex items-center justify-between">
                        <span>Direct Grey Inward: This lot was received directly from mill/supplier without prior internal parent lots.</span>
                        <span className="font-mono text-[11px] font-bold text-slate-700">GRN: {traceabilityData.target?.sourceDocNo || 'Original'}</span>
                      </div>
                    )}
                  </div>

                  {/* 2. Processing & Job Work History */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                        <Layers size={14} className="text-amber-600" />
                        2. Outsourced Processing & Job Work History
                      </h4>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {(traceabilityData.jobWorkHistory || []).length} Transaction(s)
                      </span>
                    </div>

                    {(traceabilityData.jobWorkHistory || []).length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase">
                            <tr>
                              <th className="py-2 px-3">Stage Type</th>
                              <th className="py-2 px-3">JWO Order #</th>
                              <th className="py-2 px-3">Processor (Job Worker)</th>
                              <th className="py-2 px-3">Process</th>
                              <th className="py-2 px-3">Challan No</th>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3 text-right">Meters</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[11px]">
                            {traceabilityData.jobWorkHistory.map((jw, jIdx) => (
                              <tr key={jIdx} className="hover:bg-slate-50 font-mono">
                                <td className="py-2 px-3 font-sans">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    jw.type === 'Outward' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  }`}>
                                    {jw.type}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900">{jw.jwoNo}</td>
                                <td className="py-2 px-3 font-sans font-medium text-slate-800">{jw.vendor}</td>
                                <td className="py-2 px-3 font-sans font-semibold text-blue-700">{jw.process}</td>
                                <td className="py-2 px-3 text-slate-600">{jw.challanNo}</td>
                                <td className="py-2 px-3 text-slate-500">{jw.date}</td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900">{jw.meters} m</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 italic">
                        No outsourced dyeing, printing or finishing job-work order transactions recorded on this lot.
                      </div>
                    )}
                  </div>

                  {/* 3. QC Inspections & ASTM 4-Point Auto-Grading */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                        <FileCheck size={14} className="text-emerald-600" />
                        3. Quality Control Inspections & ASTM D5430 4-Point Grading
                      </h4>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {(traceabilityData.qcHistory || []).length} Inspection(s)
                      </span>
                    </div>

                    {(traceabilityData.qcHistory || []).length > 0 ? (
                      <div className="space-y-2.5">
                        {traceabilityData.qcHistory.map((qc, qIdx) => (
                          <div key={qIdx} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 font-mono text-xs">{qc.inspectionNo}</span>
                                <span className="text-slate-400 font-mono text-[11px]">• {qc.date}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10.5px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                                  Score: {qc.pointsPer100M} pts/100m²
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10.5px] font-extrabold border ${
                                  qc.grade === 'A' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                                  qc.grade === 'B' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                                  qc.grade === 'C' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                  'bg-rose-50 text-rose-700 border-rose-300'
                                }`}>
                                  Grade {qc.grade}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-100 text-slate-700">
                                  Disposition: {qc.disposition}
                                </span>
                              </div>
                            </div>

                            {/* Defects Breakdown */}
                            {(qc.defects || []).length > 0 ? (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Defect Breakdown:</span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {qc.defects.map((def, dIdx) => (
                                    <div key={dIdx} className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-[11px]">
                                      <div className="font-semibold text-slate-800">{def.defect}</div>
                                      <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                        {def.category} • {def.count} instance(s) ({def.points} pts)
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-emerald-700 text-xs font-medium flex items-center gap-1">
                                <CheckCircle2 size={13} /> Zero defects logged. Clean roll passed textile quality inspection.
                              </div>
                            )}

                            {qc.remarks && (
                              <div className="text-[11px] text-slate-600 italic bg-slate-50/70 p-2 rounded border border-slate-100">
                                Notes: {qc.remarks}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 flex items-center justify-between">
                        <span>Current QC Status: <strong>{traceabilityData.target?.qcStatus || 'Pending'}</strong></span>
                        <span className="text-slate-400 italic">No 4-point ASTM piece-by-piece inspection lines logged yet.</span>
                      </div>
                    )}
                  </div>

                  {/* 4. Child / Split Rolls */}
                  {(traceabilityData.descendants || []).length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                          <Package size={14} className="text-indigo-600" />
                          4. Child / Split / Processed Output Rolls
                        </h4>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {traceabilityData.descendants.length} Child Roll(s)
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase">
                            <tr>
                              <th className="py-2 px-3">Child Lot No</th>
                              <th className="py-2 px-3">Roll #</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3 text-right">Available Qty</th>
                              <th className="py-2 px-3">Location</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                            {traceabilityData.descendants.map((ch, cIdx) => (
                              <tr key={cIdx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-bold text-indigo-700">{ch.lotNo}</td>
                                <td className="py-2 px-3">{ch.takaRoll}</td>
                                <td className="py-2 px-3 font-sans">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                    {ch.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900">{ch.availableQty} {ch.uom}</td>
                                <td className="py-2 px-3 text-slate-600">{ch.location || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 5. Complete Stock Movement Audit Ledger */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                        <Activity size={14} className="text-teal-600" />
                        5. Complete Stock Movement Audit Trail
                      </h4>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {(traceabilityData.movements || []).length} Movement(s)
                      </span>
                    </div>

                    {(traceabilityData.movements || []).length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase">
                            <tr>
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Movement Type</th>
                              <th className="py-2 px-3 text-right">Quantity</th>
                              <th className="py-2 px-3">Location / Godown</th>
                              <th className="py-2 px-3">Reference Document</th>
                              <th className="py-2 px-3">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                            {traceabilityData.movements.map((mv, mIdx) => (
                              <tr key={mIdx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-slate-500">{mv.date}</td>
                                <td className="py-2 px-3 font-sans font-bold text-slate-800">{mv.type}</td>
                                <td className={`py-2 px-3 text-right font-bold ${
                                  mv.qty > 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}>
                                  {mv.qty > 0 ? `+${mv.qty}` : mv.qty}
                                </td>
                                <td className="py-2 px-3 text-slate-700">{mv.location}</td>
                                <td className="py-2 px-3 text-blue-700 font-medium">
                                  {mv.refType ? `${mv.refType}: ` : ''}{mv.refNo || '—'}
                                </td>
                                <td className="py-2 px-3 text-slate-500 font-sans italic">{mv.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 italic">
                        No individual movement journal ledger records for this taka.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-3.5 border-t border-slate-200 bg-slate-50/80 shrink-0">
              <span className="text-[11px] text-slate-400">
                Data generated via Server Lineage Engine • Single Source of Truth
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTraceabilityModalOpen(false)}
                  className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE & SPLIT TAKAS FROM GRN MODAL ─────────────────────────────── */}
      {isGrnSplitModalOpen && activeGrn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50/60 to-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 text-blue-700 grid place-items-center">
                  <Layers size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">
                      Create Lot & Split Takas from GRN
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      GRN #{activeGrn.grn_number || activeGrn.grnNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Generate traceable rolls for received fabric. Each taka will carry a unique roll number and barcode.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGrnSplitModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitGrnSplit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
              {grnSplitSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 font-medium">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{grnSplitSuccessMsg}</span>
                </div>
              )}

              {/* Source Document Auto-Filled Details */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Supplier / Mill</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block truncate">
                    {grnSplitForm.supplierName || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Fabric Item</span>
                  <span className="font-bold text-blue-700 text-xs mt-0.5 block truncate">
                    {grnSplitForm.itemName || 'Grey Fabric'}
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Total GRN Received</span>
                  <span className="font-black text-slate-900 text-xs mt-0.5 block font-mono">
                    {grnTotalReceivedQty.toLocaleString('en-IN')} M
                  </span>
                </div>
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Available to Split</span>
                  <span className="font-black text-emerald-700 text-xs mt-0.5 block font-mono">
                    {maxAllowedMeters.toLocaleString('en-IN')} M
                  </span>
                </div>
              </div>

              {/* Lot Configuration Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Lot Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={grnSplitForm.lotNo}
                    onChange={(e) => setGrnSplitForm({ ...grnSplitForm, lotNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. LOT-GRN-101"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fabric Width (inches/cm)</label>
                  <input
                    type="number"
                    step="any"
                    value={grnSplitForm.width}
                    onChange={(e) => {
                      const w = e.target.value;
                      setGrnSplitForm((prev) => ({
                        ...prev,
                        width: w,
                        takas: prev.takas.map((t) => ({ ...t, width: w })),
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 58"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fabric GSM</label>
                  <input
                    type="number"
                    step="any"
                    value={grnSplitForm.gsm}
                    onChange={(e) => setGrnSplitForm({ ...grnSplitForm, gsm: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 140"
                  />
                </div>
              </div>

              {/* Quick Split Tool */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                    <SlidersHorizontal size={14} className="text-blue-600" />
                    <span>Quick Split Generator</span>
                    <button
                      type="button"
                      onClick={handleAutoDistributeDefault90m}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer ml-1"
                    >
                      <Sparkles size={12} /> Reset to 90m per Taka
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[2, 4, 5, 8, 10, 20].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleAutoDistributeTakas(preset)}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold border transition ${
                          grnSplitForm.rollCount === preset
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {preset} Rolls
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Takas Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                    Taka / Roll Breakdown ({grnSplitForm.takas.length} Rolls)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddTakaRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold cursor-pointer"
                  >
                    <Plus size={13} /> Add Roll
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-3 w-12 text-center">#</th>
                        <th className="py-2 px-3 w-32">Roll #</th>
                        <th className="py-2 px-3 w-32 text-right">Meters (Qty) *</th>
                        <th className="py-2 px-3 w-28 text-right">Weight (kg)</th>
                        <th className="py-2 px-3 w-24 text-right">Width</th>
                        <th className="py-2 px-3">Remarks</th>
                        <th className="py-2 px-3 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {grnSplitForm.takas.map((t, idx) => (
                        <tr key={t.id || idx} className="hover:bg-slate-50/50">
                          <td className="py-1.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={t.takaRoll}
                              onChange={(e) => handleTakaFieldChange(idx, 'takaRoll', e.target.value)}
                              className="w-full px-2 py-1 rounded border border-slate-200 font-mono text-xs font-bold"
                              placeholder={`#${idx + 1}`}
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <input
                              type="number"
                              step="any"
                              disabled={!isAuthorizedManager}
                              value={t.qty}
                              onChange={(e) => handleTakaFieldChange(idx, 'qty', e.target.value)}
                              className="w-full px-2 py-1 rounded border border-blue-200 text-right font-mono font-bold text-blue-900 text-xs bg-blue-50/20 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                              placeholder="90.00"
                              title={isAuthorizedManager ? "Authorized manager editable quantity" : "Requires manager authorization"}
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <input
                              type="number"
                              step="any"
                              value={t.rollWeight}
                              onChange={(e) => handleTakaFieldChange(idx, 'rollWeight', e.target.value)}
                              className="w-full px-2 py-1 rounded border border-slate-200 text-right text-xs"
                              placeholder="kg"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-right">
                            <input
                              type="number"
                              step="any"
                              value={t.width}
                              onChange={(e) => handleTakaFieldChange(idx, 'width', e.target.value)}
                              className="w-full px-2 py-1 rounded border border-slate-200 text-right text-xs"
                              placeholder="in"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={t.remarks}
                              onChange={(e) => handleTakaFieldChange(idx, 'remarks', e.target.value)}
                              className="w-full px-2 py-1 rounded border border-slate-200 text-xs"
                              placeholder="Optional roll notes"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveTakaRow(idx)}
                              disabled={grnSplitForm.takas.length <= 1}
                              className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
                              title="Remove taka"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold text-xs">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3 text-slate-700">
                          Total Taka Meters:
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-black text-sm ${
                          isSplitExceeding ? 'text-rose-600' : 'text-slate-900'
                        }`}>
                          {totalAssignedSplitMeters.toLocaleString('en-IN')} M
                        </td>
                        <td colSpan={4} className="py-2.5 px-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">
                              Available on GRN: <strong className="text-slate-800">{maxAllowedMeters.toLocaleString('en-IN')} M</strong>
                            </span>
                            <span className={isSplitExceeding ? 'text-rose-600 font-bold' : (totalAssignedSplitMeters === maxAllowedMeters ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold')}>
                              {isSplitExceeding
                                ? `Exceeds by ${(totalAssignedSplitMeters - maxAllowedMeters).toFixed(2)} M`
                                : totalAssignedSplitMeters === maxAllowedMeters
                                ? '✓ Exact quantity matched'
                                : `Remaining: ${(maxAllowedMeters - totalAssignedSplitMeters).toFixed(2)} M unassigned`}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Validation Alerts */}
              {isSplitExceeding && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs font-semibold">
                  <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                  <span>
                    Validation Error: Total taka meters ({totalAssignedSplitMeters} M) exceeds the available quantity ({maxAllowedMeters} M).
                    Reduce taka quantities before saving.
                  </span>
                </div>
              )}

              {/* QC Hold Notice */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-slate-600 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={15} className="text-amber-600 shrink-0" />
                  <span>
                    Stock Rule: Created takas will be assigned to <strong>SYS-QC-HOLD</strong> with <strong>QC Status: Pending</strong> and 0 available stock until inspected and released by Quality Control.
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsGrnSplitModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSplitExceeding || totalAssignedSplitMeters <= 0 || hasInvalidSplitRow || submittingGrnSplit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <PackageCheck size={14} />
                  {submittingGrnSplit ? 'Creating Takas...' : `Create ${grnSplitForm.takas.length} Takas & Send to QC Hold`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
