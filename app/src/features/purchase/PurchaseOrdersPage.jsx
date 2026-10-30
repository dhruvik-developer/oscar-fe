import React, { useState, useMemo, useEffect } from 'react';
import { TablePagination } from '../../components/ui/TablePagination';
import { useERP } from '../../context/ERPContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import {
  Plus, ClipboardList, ClipboardCheck, Send, ArrowRight, X, Copy, Printer, DollarSign,
  Clock, CheckCircle2, Package, Maximize2, Minimize2, Trash2, Ban, MapPin,
  ShoppingCart, FileText, Search, Filter, MoreVertical, ChevronDown, FileSpreadsheet,
  Truck, Factory, Info, PackageCheck, Layers, ShieldCheck, Warehouse, FileCheck2, CreditCard, Receipt,
  Building2, Calendar, Sparkles, QrCode,
} from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { toISODate } from '../../utils/dateUtils';
import { DocumentTimeline } from '../../components/common/DocumentTimeline';
import { SupplierDeliveryInlineSlide } from './SupplierDeliveryInlineSlide';
import { GoodsReceiptInlineSlide } from './GoodsReceiptInlineSlide';
import { LotTakaInlineSlide } from './LotTakaInlineSlide';
import { GreyQcInlineSlide } from './GreyQcInlineSlide';
import { GreyStockUpdatedInlineSlide } from './GreyStockUpdatedInlineSlide';
import { VendorBillInlineSlide } from './VendorBillInlineSlide';
import { SupplierBillMatchingInlineSlide } from './SupplierBillMatchingInlineSlide';
import { AgencyBillMatchingInlineSlide } from './AgencyBillMatchingInlineSlide';
import { SupplierPaymentInlineSlide } from './SupplierPaymentInlineSlide';
import { PoProductionInstructionSection } from './PoProductionInstructionSection';
import { PoDailyProductionEntrySection } from './PoDailyProductionEntrySection';
import { PoQualityControlSection } from './PoQualityControlSection';
import { CompletionVerificationInlineSlide } from './CompletionVerificationInlineSlide';
import { FinalJobWorkPoInlineSlide } from './FinalJobWorkPoInlineSlide';
import { getPoProductionLifecycle, lifecycleToTimelineSteps } from './productionLifecycle';
import { RelatedDocumentsCard } from '../../components/common/RelatedDocumentsCard';
import { PrintPurchaseOrderModal } from '../../components/common/PrintPurchaseOrderModal';
import PageHeader from '../../components/ui/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import { api } from '../../services/api';
import { fabricMasterSync } from '../../services/fabricMasterSync';
import UomSelect from '../../components/common/UomSelect';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import useUnits from '../../hooks/useUnits';
import { formatQty, formatUnitTotals, sumByUnit, unitKey, resolveUnit } from '../../utils/uom';
import {
  FabricFlowCards, FabricFlowSteps, YarnLinesEditor, OpeningCostsEditor, fabricFlowPayload, flowLabel,
  FABRIC_FLOW_B,
} from './FabricFlowForm';
import { PoFabricFlowPanel } from './PoFabricFlowPanel';

const purchaseOrderGuide = {
    title: 'Purchase Orders',
    subtitle: 'Supplier procurement contracts driving inventory replenishment and vendor billing.',
    purpose: 'A Purchase Order (PO) is an official commercial document issued by your business to an external supplier, committing to buy specified quantities of goods at negotiated prices. It serves as the baseline for warehouse goods intake and 3-way matching.',
    keyTerms: [
        { term: 'Purchase Order (PO)', definition: 'A legally binding procurement contract sent to a vendor before goods are shipped.' },
        { term: 'Vendor Lead Time', definition: 'The expected days between issuing the PO and receiving physical delivery at the warehouse dock.' },
        { term: 'PO to Bill Conversion', definition: 'Converts the verified order into a vendor invoice and automatically increases warehouse inventory on-hand.' },
    ],
    tips: [
        'Use the Clone button on frequent supplier orders to duplicate items into a new draft in 1 click.',
        'Once goods arrive at the dock, click "Create Bill" to post inventory intake and record Accounts Payable.',
    ],
    workflow: ['Auto-Generated / Draft PO', 'Issued to Vendor', 'Goods Intake & Vendor Bill', '3-Way Match Verified', 'Disbursement Settlement'],
};

function amountInWords(num) {
  const n = Math.floor(Number(num) || 0);
  if (n === 0) return 'Rupees Zero Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigits = (v) => v < 20 ? ones[v] : `${tens[Math.floor(v / 10)]}${v % 10 ? ' ' + ones[v % 10] : ''}`;
  const threeDigits = (v) => {
    const h = Math.floor(v / 100);
    const rest = v % 100;
    return `${h ? ones[h] + ' Hundred' + (rest ? ' ' : '') : ''}${rest ? twoDigits(rest) : ''}`;
  };
  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return `Rupees ${parts.join(' ')} Only`;
}

// KPI tiles use the shared, theme-aware KpiCard.
const KPI_TONE_BY_COLOR = { '#2563eb': 'blue', '#d97706': 'amber', '#059669': 'emerald', '#7c3aed': 'purple' };

function Kpi({ icon, value, label, trend, iconColor }) {
  return <KpiCard icon={icon} value={value} label={label} trend={trend || undefined} tone={KPI_TONE_BY_COLOR[iconColor] || 'blue'} />;
}

// Purchase type decides what happens after the PO is approved.
const PURCHASE_TYPE_GREY = 'Grey Stock Purchase';
const PURCHASE_TYPE_VENDOR_A = 'Vendor A Production';
const PURCHASE_TYPE_FINAL_JW = 'Final Job Work';
const PURCHASE_TYPE_OPTIONS = [
  {
    value: PURCHASE_TYPE_GREY,
    label: 'Ready Grey Fabric Purchase',
    hint: 'Buy ready fabric directly from supplier',
    icon: Truck,
    flow: 'PO → Supplier Delivery → GRN → Lot / Taka → QC → Stock → Vendor Bill → Bill Matching → Payment',
  },
  {
    value: PURCHASE_TYPE_VENDOR_A,
    label: 'Vendor A Production (Daily Entry)',
    hint: 'Produce fabric through Vendor A and record daily output',
    icon: Factory,
    flow: 'PO → Production Instruction → Daily Entry → Quality Control (QC) → Completion Verification → Final Job Work PO → Vendor Bill → Bill Matching',
  },
];
const purchaseTypeOf = (po) => po?.purchaseType || PURCHASE_TYPE_GREY;
const TYPE_BADGE = {
  [PURCHASE_TYPE_GREY]: { label: 'Ready Grey', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  [PURCHASE_TYPE_VENDOR_A]: { label: 'Vendor A', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  [PURCHASE_TYPE_FINAL_JW]: { label: 'Final Job Work', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};
const RECEIVABLE_STATUSES = ['Approved', 'Partially Received'];

const STATUS_PILL = {
  Draft: 'bg-amber-50 text-amber-600 border-amber-200',
  'Pending Approval': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Approved: 'bg-blue-50 text-blue-600 border-blue-200',
  'In Production': 'bg-violet-50 text-violet-600 border-violet-200',
  'Partially Received': 'bg-orange-50 text-orange-600 border-orange-200',
  'Fully Received': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  Cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
  Confirmed: 'bg-blue-50 text-blue-600 border-blue-200',
  'In Transit': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Received: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  Billed: 'bg-sky-50 text-sky-600 border-sky-200',
};

export const PurchaseOrdersPage = () => {
    const navigate = useNavigate();
    const { purchaseOrders, vendors, items: inventoryItems, locations: erpLocations = [], fabrics: fabricMasters, addPurchaseOrder, updatePurchaseOrderStatus, cancelPurchaseOrder, deletePurchaseOrder, getPoBilledStatus, convertPurchaseOrderToBill, purchaseBills, paymentOuts, formatCurrency, formatDateDDMMYYYY, getCurrentDateFormatted, getCurrentISODate, addDaysISO, showToast, refreshCollections } = useERP();
    const { units } = useUnits();
    const [showAddModal, setShowAddModal] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedPo, setSelectedPo] = useState(null);
    const [isDetailFullscreen, setIsDetailFullscreen] = useState(false);
    const [activeTimelineSlide, setActiveTimelineSlide] = useState(null);
    const qcSectionRef = React.useRef(null);
    const completionVerificationRef = React.useRef(null);
    const finalJobWorkPoRef = React.useRef(null);
    const [showVerificationInline, setShowVerificationInline] = useState(false);
    const [selectedDeliveryForGrn, setSelectedDeliveryForGrn] = useState(null);
    const [fabricVariantsList, setFabricVariantsList] = useState([]);
    const [fabricLoading, setFabricLoading] = useState(false);
    const [fabricLoadError, setFabricLoadError] = useState('');
    // refreshCollections is re-created on every ERP state change; reading it via a
    // ref keeps loadFabrics stable so opening the form doesn't re-trigger it forever.
    const refreshCollectionsRef = React.useRef(refreshCollections);
    refreshCollectionsRef.current = refreshCollections;
    const loadFabrics = React.useCallback(async () => {
        setFabricLoading(true);
        setFabricLoadError('');
        try {
            if (typeof refreshCollectionsRef.current === 'function') {
                refreshCollectionsRef.current(['items']);
            }
            const variants = await fabricMasterSync.pull('fabricVariants');
            if (Array.isArray(variants)) {
                setFabricVariantsList(variants);
            }
        } catch (err) {
            setFabricLoadError('Could not refresh fabric master items.');
        } finally {
            setFabricLoading(false);
        }
    }, []);
    useEffect(() => {
        if (showAddModal) {
            loadFabrics();
        }
    }, [showAddModal, loadFabrics]);
    const [poLifecycleData, setPoLifecycleData] = useState({
        deliveries: [],
        grns: [],
        takas: [],
        bills: [],
        loading: false,
    });

    const loadPoLifecycle = async (poId, poNumber) => {
        if (!poId) return;
        try {
            const [delRes, grnRes, lotRes, poDetailRes, billRes, piRes, lifecycleRes] = await Promise.all([
                api.get('/purchase/deliveries/', { params: { purchaseOrderId: poId } }).catch(() => []),
                api.get('/purchase/receipts/', { params: { purchaseOrderId: poId } }).catch(() => []),
                api.get('/inventory/lot-register/', { params: { po: poId } }).catch(() => ({ records: [] })),
                api.get(`/purchase/orders/${poId}/`).catch(() => null),
                api.get('/purchase/bills/', { params: { purchaseOrderId: poId } }).catch(() => []),
                api.get(`/purchase/orders/${poId}/production-instruction/`).catch(() => null),
                // Canonical 8-stage Production Lifecycle (shared with PMS).
                getPoProductionLifecycle(poId).catch(() => null),
            ]);

            const rawDeliveries = Array.isArray(delRes) ? delRes : (delRes?.results || delRes?.rows || delRes?.data || []);
            const deliveries = rawDeliveries.filter((d) =>
                String(d.purchaseOrderId || d.purchaseOrder || d.purchase_order || '') === String(poId) ||
                (poNumber && (d.poNumber === poNumber || d.po_number === poNumber))
            );

            const rawGrns = Array.isArray(grnRes) ? grnRes : (grnRes?.results || grnRes?.rows || grnRes?.data || []);
            const grns = rawGrns.filter((g) =>
                String(g.purchase_order || g.purchaseOrderId || g.purchaseOrder || g.poId || '') === String(poId) ||
                (poNumber && (g.poNumber === poNumber || g.po_number === poNumber))
            );

            const rawTakas = Array.isArray(lotRes) ? lotRes : (lotRes?.records || lotRes?.rows || lotRes?.data || lotRes?.results || []);
            const grnIds = new Set(grns.map((g) => String(g.id)));
            const grnNumbers = new Set(grns.map((g) => g.grn_number || g.grnNumber).filter(Boolean));
            const takas = rawTakas.filter((lt) => {
                const matchGrn = grnIds.has(String(lt.sourceDocumentId || lt.source_document_id || lt.grnId || lt.grn_id)) ||
                                 grnNumbers.has(lt.grnNo || lt.grnNumber || lt.source_document_number);
                const matchPo = String(lt.purchaseOrder || lt.poId || lt.poNumber || lt.sourceDocumentNumber || '') === String(poId) ||
                                String(lt.purchaseOrder || lt.poNumber || lt.sourceDocumentNumber || '') === String(poNumber);
                return matchGrn || matchPo;
            });

            const rawBills = Array.isArray(billRes) ? billRes : (billRes?.results || billRes?.rows || billRes?.data || []);
            const bills = rawBills.filter((b) =>
                String(b.purchase_order || b.purchaseOrderId || b.purchaseOrder || b.poId || '') === String(poId) ||
                (poNumber && (b.poNumber === poNumber || b.po_number === poNumber || b.poRef === poNumber || b.linkedPo === poNumber))
            );

            setPoLifecycleData({
                deliveries,
                grns,
                takas,
                bills,
                instruction: piRes?.instruction || null,
                instructions: piRes?.instructions || [],
                productionLifecycle: lifecycleRes?.applicable ? lifecycleRes : null,
                loading: false,
            });

            // If the PO status from backend is more up-to-date (e.g. Fully Received), mirror it
            if (poDetailRes && poDetailRes.status) {
                setSelectedPo((prev) => (prev && prev.id === poId ? { ...prev, ...poDetailRes } : prev));
            }
        } catch (err) {
            console.warn('Failed to load PO lifecycle data:', err);
        }
    };

    React.useEffect(() => {
        if (selectedPo?.id) {
            loadPoLifecycle(selectedPo.id, selectedPo.poNumber);
        } else {
            setPoLifecycleData({ deliveries: [], grns: [], takas: [], bills: [], loading: false });
        }
    }, [selectedPo?.id, selectedPo?.poNumber]);

    // Collapse the detail popup back to its default size whenever it is closed
    // or a different purchase order is opened.
    React.useEffect(() => {
        if (!selectedPo?.id) setIsDetailFullscreen(false);
    }, [selectedPo?.id]);

    const [printPoTarget, setPrintPoTarget] = useState(null);
    const [selectedVendorId, setSelectedVendorId] = useState(vendors[0]?.id || '');
    const [poDate, setPoDate] = useState(() => getCurrentISODate());
    const [expectedDate, setExpectedDate] = useState(() => addDaysISO(getCurrentISODate(), 10));
    const [lineItems, setLineItems] = useState([]);
    const [remarks, setRemarks] = useState('');
    const [purchaseType, setPurchaseType] = useState('');
    // Factory fabric flow (Factory -> OSCAR / Factory -> Dyeing Mill -> OSCAR);
    // empty for the older purchase types.
    const [fabricFlow, setFabricFlow] = useState('');
    const [dyeingMillId, setDyeingMillId] = useState('');
    const [yarnRows, setYarnRows] = useState([]);
    const [costRows, setCostRows] = useState([]);
    const resetFabricFlow = () => { setFabricFlow(''); setDyeingMillId(''); setYarnRows([]); setCostRows([]); };
    const chooseFabricFlow = (flow) => { setFabricFlow(flow); setPurchaseType(PURCHASE_TYPE_GREY); if (flow !== FABRIC_FLOW_B) setDyeingMillId(''); };
    // Used by the "Other purchase types" cards, hidden for now in the Create PO form.
    // const choosePurchaseType = (type) => { setPurchaseType(type); setFabricFlow(''); setDyeingMillId(''); };
    // Project association is separate from purchase type: a ready grey stock
    // purchase may be for a project or for general warehouse stock.
    const [projectMode, setProjectMode] = useState('general');
    const [projectId, setProjectId] = useState('');
    const [projects, setProjects] = useState([]);
    const [projectsError, setProjectsError] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [query, setQuery] = useState('');
    const [statusMonth, setStatusMonth] = useState('This Month');
    const [statusFilter, setStatusFilter] = useState('All');
    const [vendorFilter, setVendorFilter] = useState('All');
    const [fabricFilter, setFabricFilter] = useState('All');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    React.useEffect(() => {
        if (location.state?.createPo || searchParams.get('action') === 'create') {
            const prefill = location.state?.prefill || {};
            setSelectedVendorId(prefill.vendorId || vendors[0]?.id || '');
            setPoDate(getCurrentISODate());
            setExpectedDate(prefill.expectedDate || addDaysISO(getCurrentISODate(), 10));
            if (prefill.items && prefill.items.length > 0) {
                setLineItems(prefill.items.map((it, idx) => ({
                    id: `li-${Date.now()}-${idx}`,
                    itemId: it.itemId || it.id || '',
                    sku: it.sku || it.itemSku || '',
                    itemSku: it.sku || it.itemSku || '',
                    name: it.name || it.description || '',
                    qty: Number(it.qty || it.suggestedQty) || 100,
                    rate: Number(it.rate || it.costPrice) || 0,
                    amount: (Number(it.qty || it.suggestedQty) || 100) * (Number(it.rate || it.costPrice) || 0),
                    uom: it.uom || 'Mtr',
                    stockUom: it.stockUom || 'Mtr',
                })));
            } else if (prefill.itemId) {
                const sel = (inventoryItems || []).find((f) => f.id === prefill.itemId);
                setLineItems([{
                    id: `li-${Date.now()}`,
                    itemId: prefill.itemId,
                    sku: sel?.sku || prefill.sku || '',
                    itemSku: sel?.sku || prefill.sku || '',
                    name: sel?.name || prefill.name || '',
                    qty: Number(prefill.qty || prefill.suggestedQty) || 100,
                    rate: Number(prefill.rate || sel?.costPrice) || 0,
                    amount: (Number(prefill.qty || 100)) * (Number(prefill.rate || sel?.costPrice) || 0),
                    uom: sel?.purchaseUnit || sel?.uom || 'Mtr',
                    stockUom: sel?.uom || 'Mtr',
                }]);
            }
            setRemarks(prefill.notes || 'Replenishment order for grey fabric inventory.');
            setPurchaseType(prefill.purchaseType || PURCHASE_TYPE_GREY);
            setProjectMode(prefill.projectId ? 'project' : 'general');
            setProjectId(prefill.projectId || '');
            setShowAddModal(true);
        }
    }, [location.state, searchParams]);

    // Deep link from PMS / other screens: ?po=<id>&stage=<stage key>.
    const deepLinkPoId = searchParams.get('po');
    const deepLinkStage = searchParams.get('stage');
    React.useEffect(() => {
        if (!deepLinkPoId && !deepLinkStage) return;
        // [DISABLED] PO Detail deep link modal disabled as requested
        const next = new URLSearchParams(searchParams);
        next.delete('po');
        next.delete('stage');
        setSearchParams(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deepLinkPoId, deepLinkStage]);

    const handleOpenCreateModal = () => {
        setSelectedVendorId(vendors[0]?.id || '');
        setPoDate(getCurrentISODate());
        setExpectedDate(addDaysISO(getCurrentISODate(), 10));
        setLineItems([{ id: `li-${Date.now()}`, itemId: '', sku: '', itemSku: '', name: '', qty: '', rate: '', amount: 0 }]);
        setRemarks('');
        setPurchaseType('');
        resetFabricFlow();
        setProjectMode('general');
        setProjectId('');
        setIsFullscreen(false);
        setShowAddModal(true);
    };

    // Projects for the optional association, read when the form opens.
    React.useEffect(() => {
        if (!showAddModal) return undefined;
        let cancelled = false;
        setProjectsError('');
        api.get('/pms/projects/', { query: { limit: 200 } })
            .then((res) => {
                if (cancelled) return;
                const rows = Array.isArray(res) ? res : (res?.results || res?.data || []);
                setProjects(rows.filter((pr) => !['Cancelled', 'Completed', 'Closed'].includes(pr.status)));
            })
            .catch((err) => { if (!cancelled) setProjectsError(err?.message || 'Could not load projects.'); });
        return () => { cancelled = true; };
    }, [showAddModal]);

    const handleCloseCreateModal = () => {
        setShowAddModal(false);
        setSelectedVendorId(vendors[0]?.id || '');
        setPoDate(getCurrentISODate());
        setExpectedDate(addDaysISO(getCurrentISODate(), 10));
        setLineItems([]);
        setRemarks('');
        setPurchaseType('');
        resetFabricFlow();
        setProjectMode('general');
        setProjectId('');
        setIsFullscreen(false);
    };

    const updateLineItem = (idx, field, value) => {
        setLineItems((prev) => prev.map((l, i) => {
            if (i !== idx) return l;
            const next = { ...l, [field]: value };
            if (field === 'itemId') {
                const sel = fabricItems.find((f) => f.id === value);
                if (sel) {
                    next.name = sel.name;
                    next.sku = sel.sku;
                    next.itemSku = sel.sku;
                    next.rate = Number(sel.costPrice) || Number(sel.rate) || '';
                    next.fabricQualityId = sel.fabricQualityId || undefined;
                    next.designId = sel.designId || undefined;
                    next.shadeId = sel.shadeId || undefined;
                    // Default to the item's stock unit (fabric quality's UOM for
                    // master-derived fabrics); compatible units can be picked after.
                    next.stockUom = sel.uom || 'Mtr';
                    next.uom = sel.purchaseUnit || sel.purchase_unit || next.stockUom;
                }
            }
            next.amount = (Number(next.qty) || 0) * (Number(next.rate) || 0);
            return next;
        }));
    };

    const addBlankLine = () => setLineItems((prev) => [...prev, { id: `li-${Date.now()}-${Math.floor(Math.random() * 1000)}`, itemId: '', sku: '', itemSku: '', name: '', qty: '', rate: '', amount: 0 }]);
    const removeLine = (idx) => setLineItems((prev) => prev.filter((_, i) => i !== idx));

    const handleClonePo = (po) => {
        setSelectedVendorId(po.vendorId || vendors[0]?.id || '');
        setExpectedDate(po.expectedDate || addDaysISO(getCurrentISODate(), 10));
        setLineItems((po.items || []).map((it) => ({
            ...it,
            id: `li-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        })));
        setRemarks(po.notes || '');
        const clonedType = purchaseTypeOf(po);
        setPurchaseType(clonedType === PURCHASE_TYPE_FINAL_JW ? '' : clonedType);
        resetFabricFlow();
        if (po.fabricFlow) { setFabricFlow(po.fabricFlow); setDyeingMillId(po.dyeingMillId || ''); }
        setProjectMode(po.projectId ? 'project' : 'general');
        setProjectId(po.projectId || '');
        setIsFullscreen(false);
        setShowAddModal(true);
    };
    const [saving, setSaving] = useState(false);
    const handleCreate = async (e) => {
        e.preventDefault();
        const validLines = lineItems.filter((it) => it.itemId && Number(it.qty) > 0 && Number(it.rate) > 0);
        if (!purchaseType && !fabricFlow) { alert('Select how the fabric reaches OSCAR.'); return; }
        let flowExtras = {};
        if (fabricFlow) {
            const built = fabricFlowPayload({ flow: fabricFlow, dyeingMillId, yarnRows, costRows });
            if (built.error) { alert(built.error); return; }
            flowExtras = built.payload;
        }
        if (projectMode === 'project' && !projectId) { alert('Select the project, or choose General Stock.'); return; }
        if (!selectedVendorId) { alert('Vendor is required.'); return; }
        if (!poDate) { alert('PO Date is required.'); return; }
        if (!expectedDate) { alert('Expected Delivery is required.'); return; }
        if (validLines.length === 0) { alert('Add at least one fabric line with quantity and rate.'); return; }
        const vend = vendors.find((v) => v.id === selectedVendorId);
        if (!vend) { alert('Vendor is required.'); return; }
        const normalizedLines = validLines.map((it) => ({
            ...it,
            itemId: it.itemId,
            fabricQualityId: it.fabricQualityId || undefined,
            designId: it.designId || undefined,
            shadeId: it.shadeId || undefined,
            qty: Number(it.qty),
            rate: Number(it.rate),
            amount: Number(it.qty) * Number(it.rate),
            uom: it.uom || it.stockUom || 'Mtr',
            tax: 0,
            discount: 0,
        }));
        setSaving(true);
        try {
            await addPurchaseOrder({
                vendorId: vend.id,
                date: poDate,
                expectedDate,
                status: 'Draft',
                purchaseType: fabricFlow ? PURCHASE_TYPE_GREY : purchaseType,
                projectId: projectMode === 'project' ? projectId : undefined,
                items: normalizedLines,
                notes: remarks || '',
                ...flowExtras,
            });
            handleCloseCreateModal();
        } catch {
            // The reason was shown; the form stays open with what was typed.
        } finally {
            setSaving(false);
        }
    };
    const issuePo = (id) => {
        updatePurchaseOrderStatus(id, 'Pending Approval');
    };
    const approvePo = (id) => {
        updatePurchaseOrderStatus(id, 'Approved');
    };
    const startProductionPo = async (id) => {
        const po = purchaseOrders.find((p) => p.id === id);
        if (po && purchaseTypeOf(po) !== PURCHASE_TYPE_VENDOR_A) {
            showToast?.('Only a Vendor A Production PO starts production. Record a GRN for ready grey fabric.');
            return;
        }
        try {
            const res = await api.post(`/purchase/orders/${id}/start-production/`);
            // The server moved the PO to In Production; mirror it, never guess.
            if (res?.po) updatePurchaseOrderStatus(id, res.po.status || 'In Production');
            showToast?.(res?.message || 'Production started. Instruction registered in Production Dashboard.');
            setSelectedPo((prev) => (prev && prev.id === id ? { ...prev, status: res?.po?.status || 'In Production' } : prev));
            loadPoLifecycle(id, selectedPo?.poNumber);
            setActiveTimelineSlide('daily_production_entry');
        } catch (err) {
            showToast?.(`Production not started — ${err?.message || 'server error'}`);
        }
    };
    const recordGrnForPo = (po) => navigate('/purchase/receipts', { state: { grnForPo: po.id } });
    const handleConvertToBill = async (poId) => {
        try {
            await convertPurchaseOrderToBill(poId);
            navigate('/purchase/bills');
        } catch {
            // The reason was shown; stay on the order.
        }
    };
    const getPoTimelineSteps = (po) => {
        const isIssued = po.status !== 'Draft';
        const poStatusInfo = getPoBilledStatus(po.id);
        const lifecycleBills = poLifecycleData?.bills || [];
        const linkedBills = lifecycleBills.length > 0 ? lifecycleBills : (poStatusInfo.activeBills || []);
        const latestBill = linkedBills[0];
        const isBilled = linkedBills.length > 0 || poStatusInfo.totalBilledQty > 0 || po.status === 'Billed';
        const isPaid = latestBill?.status === 'Paid' || (Number(latestBill?.amountPaid || 0) > 0 && Number(latestBill?.balanceDue || 0) === 0);
        const isMatchApproved = latestBill?.match_status === 'Approved' || latestBill?.matchStatus === 'Approved' || latestBill?.status === 'Verified' || latestBill?.status === 'Approved';
        const isApproved = !['Draft', 'Pending Approval', 'Cancelled'].includes(po.status);
        const receivedQty = getPoReceivedQty(po);
        const hasReceived = receivedQty > 0;

        if (purchaseTypeOf(po) === PURCHASE_TYPE_VENDOR_A) {
            // Backend-derived lifecycle is the source of truth (same as PMS);
            // the client-side derivation below only covers the loading gap.
            const sharedLifecycle = poLifecycleData?.productionLifecycle;
            if (sharedLifecycle && String(sharedLifecycle.purchaseOrderId) === String(po.id)) {
                return lifecycleToTimelineSteps(sharedLifecycle, { activeKey: activeTimelineSlide });
            }
            const piObj = poLifecycleData?.instruction;
            const isPiApproved = piObj?.status && piObj?.status !== 'Draft';
            const hasFinalPo = Boolean(piObj?.finalPoNumber);
            const isPiVerified = piObj?.isVerified || ['Verified', 'PO Pending', 'PO Created', 'Closed'].includes(piObj?.status) || hasFinalPo;
            const totalProd = Number(piObj?.completion?.totalProduced || 0);
            const balQty = Number(piObj?.completion?.balanceQty ?? (piObj?.orderMeter ? Number(piObj?.orderMeter) - totalProd : 0));
            const isProdComplete = totalProd > 0 && balQty <= 0;
            const takas = poLifecycleData?.takas || [];
            const grns = poLifecycleData?.grns || [];
            const hasQcPassed = (takas.length > 0 && takas.some((t) => t.qcStatus === 'Passed')) || grns.some((g) => g.qc_status === 'Approved' || g.qc_status === 'Passed' || g.qcStatus === 'Passed');
            const isQcComplete = (takas.length > 0 && takas.every((t) => t.qcStatus === 'Passed')) || isPiVerified || hasFinalPo || (hasQcPassed && !isQcPartial);
            const isQcPartial = hasQcPassed && !isQcComplete;

            return [
                {
                    label: 'Purchase Order',
                    key: 'purchase_order',
                    docNumber: po.poNumber,
                    date: formatDateDDMMYYYY(po.date),
                    amount: po.amount,
                    status: isIssued ? 'completed' : 'current',
                },
                {
                    label: 'Production Instruction',
                    key: 'production_instruction',
                    docNumber: piObj?.instructionNumber,
                    status: (isPiApproved || po.status === 'In Production' || hasReceived) ? 'completed' : (isApproved ? 'current' : 'pending'),
                },
                {
                    label: 'Daily Production Entry',
                    key: 'daily_production_entry',
                    status: (isProdComplete || hasReceived || isPiVerified || isQcComplete)
                      ? 'completed'
                      : (isPiApproved || po.status === 'In Production' ? 'current' : 'pending'),
                },
                {
                    label: 'Quality Control (QC)',
                    key: 'grey_fabric_qc',
                    highlightCard: activeTimelineSlide === 'grey_fabric_qc' && !(isQcComplete || isPiVerified),
                    status: (isQcComplete || isPiVerified)
                      ? 'completed'
                      : isQcPartial
                      ? 'partial'
                      : (activeTimelineSlide === 'grey_fabric_qc' || totalProd > 0 || hasReceived)
                      ? 'current'
                      : 'pending',
                },
                {
                    label: 'Completion Verification',
                    key: 'completion_verification',
                    highlightCard: activeTimelineSlide === 'completion_verification' && !isPiVerified,
                    status: isPiVerified
                      ? 'completed'
                      : (activeTimelineSlide === 'completion_verification' ? 'current' : (isQcComplete || isProdComplete ? 'partial' : 'pending')),
                    statusLabel: isPiVerified
                      ? 'Verified'
                      : (activeTimelineSlide === 'completion_verification' ? 'In Progress' : (isQcComplete ? 'Pending Verification' : undefined)),
                },
                {
                    label: 'Final Job Work PO',
                    key: 'final_job_work_po',
                    docNumber: piObj?.finalPoNumber,
                    status: hasFinalPo ? 'completed' : (isPiVerified ? 'current' : 'pending'),
                },
                {
                    label: 'Agency Bill Match',
                    key: 'agency_bill_match',
                    docNumber: latestBill?.billNumber || latestBill?.vendorBillNumber || (isBilled ? 'Invoice Recorded' : undefined),
                    amount: latestBill?.total || latestBill?.amount,
                    date: formatDateDDMMYYYY(latestBill?.date || latestBill?.billDate),
                    status: (isMatchApproved || isPaid)
                        ? 'completed'
                        : (hasFinalPo || isBilled || activeTimelineSlide === 'agency_bill_match' || activeTimelineSlide === 'supplier_bill_matching')
                        ? 'current'
                        : 'pending',
                },
                {
                    label: 'Disbursement Payment',
                    key: 'disbursement_payment',
                    status: isPaid ? 'completed' : (isMatchApproved || isBilled ? 'current' : 'pending'),
                },
            ];
        }

        const totalOrderedQty = (po.lineItems || po.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
        const deliveries = (poLifecycleData?.deliveries || []);
        const totalDispatchedQty = deliveries.reduce((s, d) => s + (Number(d.dispatchedQty) || 0), 0);
        const hasDispatched = deliveries.length > 0 && (
            totalDispatchedQty > 0 ||
            deliveries.some((d) => ['Dispatched', 'In Transit', 'Delivered', 'Partially Delivered'].includes(d.status))
        );
        const isDeliveryComplete = totalOrderedQty > 0 ? (totalDispatchedQty >= totalOrderedQty) : hasDispatched;
        const isDeliveryPartial = !isDeliveryComplete && (totalDispatchedQty > 0 || deliveries.some((d) => d.status === 'Partially Delivered'));

        const grns = (poLifecycleData?.grns || []);
        const totalGrnQty = grns.reduce((sum, g) => {
            const direct = Number(g.totalQuantity || g.receivedQuantity || g.total_quantity || g.received_qty || 0);
            if (direct > 0) return sum + direct;
            if (Array.isArray(g.lines)) {
                return sum + g.lines.reduce((lSum, l) => lSum + (Number(l.received_qty || l.receivedQty || l.stock_qty || l.stockQty || 0)), 0);
            }
            return sum;
        }, 0);
        const effectiveGrnQty = totalGrnQty > 0 ? totalGrnQty : receivedQty;
        const isGrnComplete = po.status === 'Fully Received' || (totalOrderedQty > 0 && effectiveGrnQty >= totalOrderedQty);
        const isGrnPartial = !isGrnComplete && (effectiveGrnQty > 0 || po.status === 'Partially Received');

        const takas = (poLifecycleData?.takas || []);
        const totalTakaQty = takas.reduce((s, t) => s + (Number(t.receivedQty ?? t.receivedQuantity ?? t.qty ?? t.quantity ?? t.actual_meter ?? 0)), 0);
        const isTakaComplete = takas.length > 0 && (totalOrderedQty > 0 ? totalTakaQty >= totalOrderedQty : isGrnComplete);
        const isTakaPartial = !isTakaComplete && takas.length > 0;

        const hasQcPassed = (takas.length > 0 && takas.some((t) => t.qcStatus === 'Passed')) || grns.some((g) => g.qc_status === 'Approved' || g.qc_status === 'Passed' || g.qcStatus === 'Passed');
        const isQcComplete = isGrnComplete && takas.length > 0 && takas.every((t) => t.qcStatus === 'Passed');
        const isQcPartial = hasQcPassed && !isQcComplete;
        const hasStockUpdated = hasQcPassed;
        const isStockComplete = isQcComplete;

        return [
            {
                key: 'purchase_order',
                label: 'Purchase Order',
                docNumber: po.poNumber,
                date: formatDateDDMMYYYY(po.date),
                amount: po.amount,
                status: isApproved ? 'completed' : 'current',
            },
            {
                key: 'supplier_delivery',
                label: 'Supplier Delivery',
                docNumber: totalDispatchedQty > 0
                    ? (isDeliveryPartial
                        ? `${totalDispatchedQty.toLocaleString('en-IN')} / ${totalOrderedQty.toLocaleString('en-IN')} M`
                        : `${totalDispatchedQty.toLocaleString('en-IN')} M`)
                    : undefined,
                status: isDeliveryComplete
                    ? 'completed'
                    : isDeliveryPartial
                    ? 'partial'
                    : isApproved
                    ? 'current'
                    : 'pending',
                statusLabel: isDeliveryPartial ? 'Partially Delivered' : undefined,
            },
            {
                key: 'grn_inward',
                label: 'GRN / Inward',
                docNumber: effectiveGrnQty > 0
                    ? (isGrnPartial
                        ? `${effectiveGrnQty.toLocaleString('en-IN')} / ${totalOrderedQty.toLocaleString('en-IN')} M`
                        : `${effectiveGrnQty.toLocaleString('en-IN')} M`)
                    : undefined,
                status: isGrnComplete
                    ? 'completed'
                    : isGrnPartial
                    ? 'partial'
                    : (hasDispatched || activeTimelineSlide === 'grn_inward')
                    ? 'current'
                    : 'pending',
                statusLabel: isGrnPartial ? 'Partially Received' : undefined,
            },
            {
                key: 'lot_taka_creation',
                label: 'Lot / Taka Creation',
                docNumber: takas.length > 0
                    ? (isTakaPartial
                        ? `${takas.length} Rolls (${totalTakaQty.toLocaleString('en-IN')} / ${totalOrderedQty.toLocaleString('en-IN')} M)`
                        : `${takas.length} Rolls (${totalTakaQty.toLocaleString('en-IN')} M)`)
                    : undefined,
                status: isTakaComplete
                    ? 'completed'
                    : isTakaPartial
                    ? 'partial'
                    : (effectiveGrnQty > 0 || activeTimelineSlide === 'lot_taka_creation')
                    ? 'current'
                    : 'pending',
                statusLabel: isTakaPartial ? 'Partially Created' : undefined,
            },
            {
                key: 'grey_fabric_qc',
                label: 'Grey Fabric QC',
                status: isQcComplete
                    ? 'completed'
                    : isQcPartial
                    ? 'partial'
                    : (takas.length > 0 || activeTimelineSlide === 'grey_fabric_qc')
                    ? 'current'
                    : 'pending',
                statusLabel: isQcPartial ? 'QC In Progress' : undefined,
            },
            {
                key: 'grey_stock_updated',
                label: 'Grey Stock Updated',
                status: isStockComplete
                    ? 'completed'
                    : (hasStockUpdated || activeTimelineSlide === 'grey_stock_updated')
                    ? 'current'
                    : 'pending',
                statusLabel: isQcPartial ? 'Partial Stock' : undefined,
            },
            {
                key: 'vendor_bill',
                label: 'Vendor Bill',
                docNumber: latestBill?.billNumber || latestBill?.vendorBillNumber || (isBilled ? 'Bill Recorded' : undefined),
                amount: latestBill?.total || latestBill?.amount,
                status: (isBilled || isPaid || isMatchApproved)
                    ? 'completed'
                    : (hasStockUpdated || activeTimelineSlide === 'vendor_bill')
                    ? 'current'
                    : 'pending',
            },
            {
                key: 'supplier_bill_matching',
                label: 'Supplier Bill Matching',
                docNumber: isMatchApproved ? 'Verified 3-Way' : (isBilled ? 'Pending Match' : undefined),
                amount: latestBill?.total || latestBill?.amount,
                status: (isMatchApproved || isPaid)
                    ? 'completed'
                    : (isBilled || activeTimelineSlide === 'supplier_bill_matching')
                    ? 'current'
                    : 'pending',
            },
            {
                key: 'disbursement_payment',
                label: 'Disbursement Payment',
                status: isPaid
                    ? 'completed'
                    : (isMatchApproved || activeTimelineSlide === 'disbursement_payment')
                    ? 'current'
                    : 'pending',
            },
        ];
    };
    const getPoRelatedDocs = (po) => {
        const docs = [];
        const poStatusInfo = getPoBilledStatus(po.id);
        const lifecycleBills = poLifecycleData?.bills || [];
        const allBills = [...(poStatusInfo.activeBills || [])];
        lifecycleBills.forEach((lb) => {
            if (!allBills.some((b) => b.id === lb.id || (b.billNumber && (b.billNumber === lb.billNumber || b.billNumber === lb.bill_number)))) {
                allBills.push(lb);
            }
        });
        allBills.forEach((linkedBill) => {
            docs.push({
                type: 'Purchase Bill',
                number: linkedBill.billNumber || linkedBill.bill_number,
                amount: linkedBill.total || linkedBill.amount,
                date: formatDateDDMMYYYY(linkedBill.date || linkedBill.billDate || linkedBill.doc_date),
                status: linkedBill.status || 'Active',
            });
            const relatedPayments = paymentOuts.filter((p) => p.billId === linkedBill.id || p.billNumber === (linkedBill.billNumber || linkedBill.bill_number));
            relatedPayments.forEach((p) => {
                docs.push({
                    type: 'Payment',
                    number: p.voucherNumber,
                    amount: p.amount,
                    date: formatDateDDMMYYYY(p.date),
                    status: 'Paid',
                });
            });
        });
        return docs;
    };

    // ── Oscar workflow helpers (meter-based fabric procurement) ──────────────
    // Dropdown merges Fabric-kind items + Fabric master, so 12 fabrics show
    // even if one source is empty. Backend seeds both permanently.
    const fabricItems = useMemo(
      () => {
        const list = [];
        const seenIds = new Set();
        const seenNames = new Set();

        // 1. From active FabricVariants (the Fabric Item / Variant Master)
        (fabricVariantsList || []).filter((v) => v.isActive !== false).forEach((v) => {
          const matchedItem = (inventoryItems || []).find((i) => i.id === v.itemId || (v.code && i.sku && i.sku.toUpperCase() === v.code.toUpperCase()));
          // A deleted (archived) fabric item must not be offered for new POs.
          if (matchedItem?.lifecycleStatus === 'Archived') return;
          const id = matchedItem?.id || v.itemId || v.id;
          if (seenIds.has(id)) return;
          seenIds.add(id);
          const name = v.name || matchedItem?.name || v.code;
          seenNames.add(name.toLowerCase());
          list.push({
            id,
            itemId: id,
            variantId: v.id,
            fabricQualityId: v.qualityId || matchedItem?.fabricQualityId,
            designId: v.designId || matchedItem?.designId,
            shadeId: v.shadeId || matchedItem?.shadeId,
            sku: v.code || matchedItem?.sku || '',
            name,
            fabricQuality: v.qualityName || matchedItem?.fabricQuality || '',
            fabricType: v.fabricTypeName || v.fabricType || '',
            uom: v.uom || matchedItem?.uom || 'Mtr',
            stockUom: v.uom || matchedItem?.uom || 'Mtr',
            costPrice: v.rate || matchedItem?.costPrice || matchedItem?.sellingPrice || '',
            rate: v.rate || matchedItem?.costPrice || matchedItem?.sellingPrice || '',
            fabricGsm: v.gsm || matchedItem?.fabricGsm || '',
            fabricWidth: v.width || matchedItem?.fabricWidth || '',
            isActive: v.isActive !== false,
          });
        });

        // 2. From active inventoryItems with itemKind === 'Fabric'
        (inventoryItems || []).filter((i) => i.itemKind === 'Fabric' && i.lifecycleStatus !== 'Inactive' && i.lifecycleStatus !== 'Archived' && i.isActive !== false).forEach((i) => {
          if (seenIds.has(i.id)) return;
          const nameKey = (i.name || '').toLowerCase();
          if (seenNames.has(nameKey)) return;
          seenIds.add(i.id);
          seenNames.add(nameKey);
          list.push({
            id: i.id,
            itemId: i.id,
            sku: i.sku || '',
            name: i.name,
            fabricQuality: i.fabricQuality || '',
            fabricType: i.fabricType || '',
            uom: i.uom || 'Mtr',
            stockUom: i.uom || 'Mtr',
            costPrice: i.costPrice || i.sellingPrice || '',
            rate: i.costPrice || i.sellingPrice || '',
            fabricGsm: i.fabricGsm || '',
            fabricWidth: i.fabricWidth || '',
            isActive: true,
          });
        });

        return list;
      },
      [inventoryItems, fabricVariantsList],
    );

    const getPoLines = (po) => po.items || po.lineItems || [];
    const getPoFabric = (po) => {
      const l = getPoLines(po)[0];
      return l?.name || l?.description || '—';
    };
    const getPoQty = (po) => getPoLines(po).reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const getPoRate = (po) => Number(getPoLines(po)[0]?.rate) || 0;
    const lineUom = (l) => l?.uom || 'Mtr';
    const getPoReceivedLines = (po) => {
      // A GRN against the PO records receivedQty on its lines (server side).
      const fromGrn = getPoLines(po)
        .filter((l) => Number(l.receivedQty) > 0)
        .map((l) => ({ qty: Number(l.receivedQty) || 0, uom: lineUom(l) }));
      if (fromGrn.length) return fromGrn;
      return (purchaseBills || [])
        .filter((b) => (b.purchaseOrderId === po.id || b.poRef === po.poNumber || b.linkedPo === po.poNumber) && b.goodsReceived === true && b.status !== 'Cancelled')
        .flatMap((b) => (b.items || b.lineItems || []).map((it) => ({ qty: Number(it.receivedQty ?? it.qty) || 0, uom: lineUom(it) })));
    };
    const getPoReceivedQty = (po) => getPoReceivedLines(po).reduce((s, l) => s + l.qty, 0);
    // Quantities are only added up within one unit (Mtr and Kg never mix).
    const orderedByUnit = (po) => sumByUnit(getPoLines(po), { uom: lineUom, units });
    const receivedByUnit = (po) => sumByUnit(getPoReceivedLines(po), { units });
    const poQtyText = (po) => formatUnitTotals(orderedByUnit(po), { units });
    const poReceivedText = (po) => {
      const totals = receivedByUnit(po);
      return totals.length ? formatUnitTotals(totals, { units }) : formatQty(0, lineUom(getPoLines(po)[0]), { units });
    };
    const poRateText = (po) => `₹${getPoRate(po)}/${lineUom(getPoLines(po)[0])}`;
    const unitSlot = (text) => unitKey(resolveUnit(units, text)?.code || text);

    const LEGACY_STATUS_MAP = {
      Issued: 'Approved',
      Pending: 'Pending Approval',
      Received: 'Fully Received',
      Billed: 'Fully Received',
      'Partially Billed': 'Partially Received',
    };

    const getOscarStatus = (po) => {
      const ordered = orderedByUnit(po);
      const receivedMap = new Map(receivedByUnit(po).map((t) => [unitSlot(t.uom), t.qty]));
      const received = getPoReceivedQty(po);
      // Fully received only when every ordered unit is covered in that same unit.
      const fullyReceived = ordered.length > 0
        && ordered.every((t) => t.qty <= 0 || (receivedMap.get(unitSlot(t.uom)) || 0) >= t.qty);
      if (po.status === 'Cancelled') return 'Cancelled';
      if (po.status === 'Draft') return 'Draft';
      if (fullyReceived && received > 0) return 'Fully Received';
      if (received > 0) return 'Partially Received';
      if (['Pending Approval', 'Approved', 'In Production', 'Partially Received', 'Fully Received'].includes(po.status)) return po.status;
      return LEGACY_STATUS_MAP[po.status] || po.status || 'Draft';
    };

    const totalPoValue = purchaseOrders.reduce((sum, p) => sum + (p.amount ?? p.total ?? 0), 0);
    const openPoCount = purchaseOrders.filter((p) => !['Fully Received', 'Cancelled'].includes(getOscarStatus(p))).length;
    const draftPoCount = purchaseOrders.filter((p) => getOscarStatus(p) === 'Draft').length;
    const receivedQtyTotals = sumByUnit(purchaseOrders.flatMap((p) => getPoReceivedLines(p)), { units });

    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      return purchaseOrders.filter((p) => {
        if (q) {
          const hay = `${p.poNumber ?? ''} ${p.vendor ?? ''} ${getPoFabric(p)}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (statusFilter !== 'All' && getOscarStatus(p) !== statusFilter) return false;
        if (typeFilter !== 'All' && purchaseTypeOf(p) !== typeFilter) return false;
        if (vendorFilter !== 'All' && p.vendor !== vendorFilter) return false;
        if (fabricFilter !== 'All' && getPoFabric(p) !== fabricFilter) return false;
        if (dateFrom || dateTo) {
          const d = toISODate(p.date);
          if (d && dateFrom && d < dateFrom) return false;
          if (d && dateTo && d > dateTo) return false;
        }
        return true;
      });
    }, [purchaseOrders, query, statusFilter, typeFilter, vendorFilter, fabricFilter, dateFrom, dateTo, purchaseBills]);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
      setPage(1);
    }, [query, statusFilter, typeFilter, vendorFilter, fabricFilter, dateFrom, dateTo]);

    const paginatedOrders = useMemo(() => {
      const start = (page - 1) * pageSize;
      return filtered.slice(start, start + pageSize);
    }, [filtered, page, pageSize]);

    const vendorOptions = useMemo(() => [...new Set(purchaseOrders.map((p) => p.vendor).filter(Boolean))], [purchaseOrders]);
    const fabricOptions = useMemo(() => [...new Set(purchaseOrders.map((p) => getPoFabric(p)).filter((f) => f && f !== '—'))], [purchaseOrders]);

    const statusCounts = useMemo(() => {
      const c = { Draft: 0, 'Pending Approval': 0, Approved: 0, 'In Production': 0, 'Partially Received': 0, 'Fully Received': 0 };
      purchaseOrders.forEach((p) => {
        const s = getOscarStatus(p);
        if (c[s] !== undefined) c[s] += 1;
      });
      return c;
    }, [purchaseOrders, purchaseBills]);

    const recentRows = useMemo(() => {
      if (purchaseOrders.length) {
        return [...purchaseOrders].slice(-5).reverse().map((p) => ({
          id: p.id,
          po: p.poNumber,
          supplier: p.vendor,
          fabric: getPoFabric(p),
          qty: getPoQty(p),
          qtyText: poQtyText(p),
          date: formatDateDDMMYYYY(p.date),
          exp: formatDateDDMMYYYY(p.expectedDate),
          status: getOscarStatus(p),
          value: formatCurrency(p.amount ?? p.total ?? 0),
          raw: p,
        }));
      }
      return [];
    }, [purchaseOrders, purchaseBills, units]);

    const fabricTotals = useMemo(() => {
      const map = {};
      purchaseOrders.forEach((p) => {
        getPoLines(p).forEach((l) => {
          const k = l.name || l.description || 'Unknown Fabric';
          map[k] = (map[k] || 0) + (Number(l.qty) || 0);
        });
      });
      return Object.entries(map).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
    }, [purchaseOrders]);

    const maxBar = Math.max(1, ...Object.values(statusCounts));
    const barDefs = [
      { k: 'Draft', color: '#f59e0b' },
      { k: 'Pending Approval', color: '#fbbf24' },
      { k: 'Approved', color: '#3b82f6' },
      { k: 'In Production', color: '#8b5cf6' },
      { k: 'Partially Received', color: '#f97316' },
      { k: 'Fully Received', color: '#34d399' },
    ];

    const renderRowActions = (p) => {
      const poStatusInfo = getPoBilledStatus(p.id);
      const hasRemaining = poStatusInfo.totalRemainingQty > 0;
      return (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          {getOscarStatus(p) !== 'Cancelled' && (
            <button
              type="button"
              onClick={() => navigate(`/inventory/batches?po=${encodeURIComponent(p.id)}&poNumber=${encodeURIComponent(p.poNumber || '')}&view=po`)}
              className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-xs font-semibold hover:bg-blue-100 shadow-2xs whitespace-nowrap inline-flex items-center gap-1 cursor-pointer"
              title={`Manage receipt, batches, QC & dispatch for ${p.poNumber || 'this PO'} in Batch Registry`}
            >
              <Package size={12} /> Batch Registry
            </button>
          )}
          <button onClick={() => setPrintPoTarget(p)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Print Official Purchase Order">
            <Printer size={13}/>
          </button>
          <button onClick={() => handleClonePo(p)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Clone / Reorder this Purchase Order">
            <Copy size={13}/>
          </button>
          {p.status === 'Draft' && (
            <button type="button" onClick={() => deletePurchaseOrder(p.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Draft PO">
              <Trash2 size={13} />
            </button>
          )}
          {getOscarStatus(p) === 'Draft' ? (
            <button onClick={() => issuePo(p.id)} className="px-2.5 py-1 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors whitespace-nowrap inline-flex items-center gap-1">
              <Send size={11}/> Submit for Approval
            </button>
          ) : getOscarStatus(p) === 'Pending Approval' ? (
            <button onClick={() => approvePo(p.id)} className="px-2.5 py-1 bg-blue-600 text-white rounded-md text-xs font-semibold hover:bg-blue-700 shadow-xs transition-colors whitespace-nowrap inline-flex items-center gap-1">
              <CheckCircle2 size={11}/> Approve PO
            </button>
          ) : getOscarStatus(p) === 'Approved' && purchaseTypeOf(p) === PURCHASE_TYPE_VENDOR_A ? (
            <button onClick={() => startProductionPo(p.id)} className="px-2.5 py-1 bg-violet-600 text-white rounded-md text-xs font-semibold hover:bg-violet-700 shadow-xs transition-colors whitespace-nowrap inline-flex items-center gap-1">
              <ArrowRight size={11}/> Start Production
            </button>
          ) : getOscarStatus(p) === 'Cancelled' ? (
            <span className="text-xs text-rose-600 font-semibold inline-flex items-center gap-1"><Ban size={11}/> Cancelled</span>
          ) : getOscarStatus(p) === 'Fully Received' ? (
            <span className="text-xs text-emerald-600 font-semibold inline-flex items-center gap-1"><CheckCircle2 size={11}/> Fully Received</span>
          ) : (
            <div className="flex items-center gap-1">
              {poStatusInfo.totalBilledQty <= 0 && (
                <button onClick={() => cancelPurchaseOrder(p.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Cancel Purchase Order">
                  <Ban size={13}/>
                </button>
              )}
              {hasRemaining && (
                <button onClick={() => handleConvertToBill(p.id)} className="text-xs text-blue-600 font-semibold hover:underline inline-flex items-center gap-1 justify-end whitespace-nowrap">
                  {poStatusInfo.status === 'Partially Billed' ? `Bill Remaining (${poStatusInfo.totalRemainingQty})` : 'Create Bill'} <ArrowRight size={11}/>
                </button>
              )}
            </div>
          )}
        </div>
      );
    };

    return (
    <div className="-m-3 md:-m-5 bg-[#edf3fc] p-3 md:p-5 space-y-4 min-h-[calc(100vh-62px)]">
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage purchase orders and track vendor purchasing."
        guide={purchaseOrderGuide}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/purchase/final-job-work-pos')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] font-bold text-blue-700 hover:bg-blue-100 transition-colors shadow-xs"
            >
              <FileSpreadsheet size={14} /> Final Job Work POs
            </button>
            <Button icon={Plus} onClick={handleOpenCreateModal} className="!rounded-lg !bg-[#2563eb] hover:!bg-[#1d4ed8]">
              Create Purchase Order
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={ShoppingCart} value={totalPoValue ? formatCurrency(totalPoValue) : '₹0.00'} label="Total PO Value" trend="" iconBg="#e8f1fd" iconColor="#2563eb" wave="#cfe3fd" arrowBg="#f2f7ff" arrowColor="#2563eb" />
        <Kpi icon={FileText} value={`${openPoCount} Orders`} label="Open POs" trend="" iconBg="#e8f1fd" iconColor="#2563eb" wave="#c9ecdf" arrowBg="#f2f7ff" arrowColor="#2563eb" />
        <Kpi icon={Clock} value={`${draftPoCount} Order${draftPoCount === 1 ? '' : 's'}`} label="Draft POs" trend="" iconBg="#fdf3e0" iconColor="#d97706" wave="#fbe5bd" arrowBg="#fff8ec" arrowColor="#d97706" />
        <Kpi icon={Package} value={receivedQtyTotals.length ? formatUnitTotals(receivedQtyTotals, { units }) : '0'} label="Received Quantity" trend="" iconBg="#e8f1fd" iconColor="#2563eb" wave="#dcd6fb" arrowBg="#f2f7ff" arrowColor="#2563eb" />
      </div>

      {/* supplier table */}
      <div className="overflow-hidden rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3.5">
          <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Grey Fabric Purchase Orders</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search PO #, vendor or fabric..." className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[12px] outline-none placeholder:text-slate-400 focus:border-blue-400" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white py-2 px-2 text-[12px] font-medium text-slate-600 outline-none">
              <option value="All">All Status</option>
              {['Draft', 'Pending Approval', 'Approved', 'In Production', 'Partially Received', 'Fully Received', 'Cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white py-2 px-2 text-[12px] font-medium text-slate-600 outline-none">
              <option value="All">All Types</option>
              {[PURCHASE_TYPE_GREY, PURCHASE_TYPE_VENDOR_A, PURCHASE_TYPE_FINAL_JW].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white py-2 px-2 text-[12px] font-medium text-slate-600 outline-none">
              <option value="All">All Vendors</option>
              {vendorOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={fabricFilter} onChange={(e) => setFabricFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white py-2 px-2 text-[12px] font-medium text-slate-600 outline-none">
              <option value="All">All Fabrics</option>
              {fabricOptions.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-slate-200 bg-white py-2 px-2 text-[12px] text-slate-600 outline-none" title="PO Date from" />
            <span className="text-slate-400 text-[11px]">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-slate-200 bg-white py-2 px-2 text-[12px] text-slate-600 outline-none" title="PO Date to" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                {['PO Number', 'PO Date', 'Vendor', 'Fabric', 'Order Qty', 'Rate (₹/Unit)', 'Total Amount (₹)', 'Expected Delivery', 'Received', 'Status', 'Actions'].map((h, i) => (
                  <th key={h} className={`px-4 py-2.5 ${i >= 4 && i <= 8 ? 'text-right' : ''} ${i === 9 ? 'text-center' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((p) => {
                return (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                        <ClipboardList size={13} className="text-slate-400" /> {p.poNumber}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {p.fabricFlow
                          ? <span className="inline-block rounded border px-1.5 py-px text-[9.5px] font-bold bg-teal-50 text-teal-700 border-teal-200">{p.fabricFlow === FABRIC_FLOW_B ? 'Factory → Mill → OSCAR' : 'Factory → OSCAR'}</span>
                          : <span className={`inline-block rounded border px-1.5 py-px text-[9.5px] font-bold ${TYPE_BADGE[purchaseTypeOf(p)]?.cls || TYPE_BADGE[PURCHASE_TYPE_GREY].cls}`}>{TYPE_BADGE[purchaseTypeOf(p)]?.label || purchaseTypeOf(p)}</span>}
                        <span className="text-[9.5px] font-semibold text-slate-400">{p.projectCode || 'General Stock'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{formatDateDDMMYYYY(p.date)}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-700">{p.vendor}</td>
                    <td className="px-4 py-2.5 text-slate-600 font-medium whitespace-nowrap">{getPoFabric(p)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">{poQtyText(p)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">{poRateText(p)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">{formatCurrency(p.amount ?? p.total ?? 0)}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">{formatDateDDMMYYYY(p.expectedDate)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">{poReceivedText(p)}</td>
                    <td className="px-4 py-2.5 text-center"><StatusBadge status={getOscarStatus(p)} /></td>
                    <td className="px-4 py-2.5">{renderRowActions(p)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-500"><FileText size={20} /></div>
                    <p className="mt-3 text-[13px] font-extrabold text-[#17294e]">No records found</p>
                    <p className="mt-1 text-[11.5px] text-slate-400">There are no records matching your current filter criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* bottom row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)] xl:col-span-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[13.5px] font-extrabold text-[#17294e]">PO Status Overview</h3>
            <div className="relative">
              <select value={statusMonth} onChange={(e) => setStatusMonth(e.target.value)} className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-[11.5px] font-semibold text-slate-600 outline-none">
                <option>This Month</option>
                <option>Last Month</option>
                <option>This Quarter</option>
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="flex w-7 flex-col justify-between py-1 text-right text-[9px] font-semibold text-slate-400">
              {[40, 30, 20, 10, 0].map((t) => <span key={t}>{t}</span>)}
            </div>
            <div className="relative flex-1">
              <div className="absolute inset-0 flex flex-col justify-between">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="border-t border-slate-100" />)}</div>
              <div className="relative flex h-44 items-end justify-around gap-2 px-2">
                {barDefs.map((b) => (
                  <div key={b.k} className="flex h-full w-12 flex-col items-center justify-end gap-1.5">
                    <div className="w-10 rounded-t-[4px]" style={{ height: `${Math.max(4, (statusCounts[b.k] / maxBar) * 100)}%`, background: b.color }} />
                    <span className="text-[10px] font-medium text-slate-500">{b.k}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)] xl:col-span-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Fabric-wise Purchase Qty</h3>
          </div>
          {fabricTotals.length > 0 ? (
            <div className="flex items-center gap-5">
              <div
                className="h-36 w-36 shrink-0 rounded-full relative"
                style={{
                  background: `conic-gradient(${fabricTotals.map((f, i) => {
                    const colors = ['#3b82f6', '#60a5fa', '#93c5fd', '#c7d2fe', '#a5b4fc', '#7dd3fc'];
                    const total = fabricTotals.reduce((s, x) => s + x.qty, 0);
                    const start = fabricTotals.slice(0, i).reduce((s, x) => s + x.qty, 0) / total * 360;
                    const end = start + (f.qty / total) * 360;
                    return `${colors[i % colors.length]} ${start}deg ${end}deg`;
                  }).join(', ')})`,
                }}
              >
                <div className="absolute inset-0 m-auto h-20 w-20 rounded-full bg-white flex flex-col items-center justify-center">
                  <p className="text-[13px] font-extrabold text-[#17294e] leading-none">{fabricTotals.reduce((s, x) => s + x.qty, 0).toLocaleString('en-IN')}</p>
                  <p className="text-[9px] font-medium text-slate-400 mt-0.5">Total Ordered</p>
                </div>
              </div>
              <ul className="space-y-2 text-[11.5px]">
                {fabricTotals.map((f, i) => {
                  const colors = ['#3b82f6', '#60a5fa', '#93c5fd', '#c7d2fe', '#a5b4fc', '#7dd3fc'];
                  const total = fabricTotals.reduce((s, x) => s + x.qty, 0);
                  return (
                    <li key={f.name} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                      <span className="font-medium text-slate-600">{f.name}</span>
                      <span className="font-mono text-slate-800 font-bold">{f.qty.toLocaleString('en-IN')} ({Math.round((f.qty / total) * 100)}%)</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-[12px] text-slate-400 py-8 text-center">No fabric purchases recorded yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.05)] xl:col-span-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[13.5px] font-extrabold text-[#17294e]">Recent Purchase Orders</h3>
            <button className="text-[11px] font-bold text-blue-600 hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                  {['PO Number', 'Vendor', 'Fabric', 'Qty', 'Amount', 'Status'].map((h) => (
                    <th key={h} className="px-2 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentRows.map((r, i) => (
                  <tr key={r.id || r.po || i} className="hover:bg-slate-50/60">
                    <td className="px-2 py-2.5 font-mono text-[11.5px] font-bold text-blue-600">{r.po}</td>
                    <td className="px-2 py-2.5 font-medium text-slate-600">{r.supplier}</td>
                    <td className="px-2 py-2.5 text-slate-600">{r.fabric || '—'}</td>
                    <td className="px-2 py-2.5 font-mono text-slate-700 whitespace-nowrap">{r.qtyText || (r.qty != null ? formatQty(r.qty, 'Mtr') : '—')}</td>
                    <td className="px-2 py-2.5 font-mono font-bold text-slate-700 whitespace-nowrap">{r.value}</td>
                    <td className="px-2 py-2.5"><span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${STATUS_PILL[r.status] || STATUS_PILL.Draft}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create PO Modal */}
      {showAddModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-200 ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
          <div className={`bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            isFullscreen ? 'w-full h-full rounded-none p-4 sm:p-8' : 'max-w-5xl w-full rounded-2xl p-4 sm:p-6 max-h-[95vh] sm:max-h-[92vh]'
          } text-xs`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-[#1F2E4A]">Create Purchase Order</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Create a new grey fabric purchase order from a Vendor with quantity and rate.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition" title={isFullscreen ? "Exit Fullscreen" : "Maximize Fullscreen"}>
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button type="button" onClick={handleCloseCreateModal} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                  <X size={18}/>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">How does the fabric reach OSCAR? <span className="text-rose-500">*</span></label>
                <FabricFlowCards value={fabricFlow} onChange={chooseFabricFlow} />
                {fabricFlow && (
                  <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 space-y-1">
                    <p className="text-[11px] text-slate-600"><strong>After approval:</strong> one batch is created for every actual receipt — never for the ordered quantity.</p>
                    <FabricFlowSteps flow={fabricFlow} />
                  </div>
                )}
              </div>
              {/* "Other purchase types" (Ready Grey Fabric Purchase / Vendor A Production) is hidden
                  for now: new POs use the two factory fabric flows above. Restore by uncommenting
                  this block and `choosePurchaseType`.
              <div>
                <label className="block font-semibold text-slate-600 mb-1.5 text-[11px] uppercase tracking-wide">Other purchase types</label>
                <div role="radiogroup" aria-label="Purchase Type" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PURCHASE_TYPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = !fabricFlow && purchaseType === opt.value;
                    return (
                      <label key={opt.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${active ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                        <input type="radio" name="purchaseType" value={opt.value} checked={active} onChange={() => choosePurchaseType(opt.value)} className="h-4 w-4 accent-blue-600" />
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}><Icon size={18} /></span>
                        <span className="min-w-0">
                          <span className="block text-[12.5px] font-bold text-slate-800">{opt.label}</span>
                          <span className="block text-[11px] text-slate-500">{opt.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
                  <Info size={13} className="mt-px shrink-0 text-blue-500" />
                  {fabricFlow
                    ? <span>Selected: <strong>{flowLabel(fabricFlow)}</strong>. Choose one of these instead for a ready-fabric purchase or Vendor A production.</span>
                    : purchaseType
                      ? <span><strong>Next steps after approval:</strong> {PURCHASE_TYPE_OPTIONS.find((o) => o.value === purchaseType)?.flow}</span>
                      : <span>Selected cycle determines the next workflow after PO.</span>}
                </p>
              </div>
              */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Project Association</label>
                <div className="flex flex-wrap items-center gap-2">
                  {[['general', 'Without Project / General Stock'], ['project', 'With Project']].map(([mode, text]) => (
                    <label key={mode} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${projectMode === mode ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                      <input type="radio" name="projectMode" value={mode} checked={projectMode === mode} onChange={() => { setProjectMode(mode); if (mode === 'general') setProjectId(''); }} className="accent-blue-600" />
                      {text}
                    </label>
                  ))}
                  {projectMode === 'project' && (
                    <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="min-w-[240px] flex-1 border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                      <option value="">Select project...</option>
                      {projects.map((pr) => (
                        <option key={pr.id} value={pr.id}>{pr.code}{pr.customerName ? ` — ${pr.customerName}` : ''}</option>
                      ))}
                    </select>
                  )}
                </div>
                <p className="mt-1 text-[10.5px] text-slate-400">
                  {projectMode === 'general'
                    ? 'Accepted fabric goes to general warehouse stock and can be allocated to a project later.'
                    : (projectsError || 'The PO and its downstream documents are linked to this project.')}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">{fabricFlow ? 'Factory / Vendor *' : 'Vendor / Supplier *'}</label>
                    <MasterSourceLink source="vendors" />
                  </div>
                  <select value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.code}) - Terms: {v.paymentTerms}</option>
                    ))}
                  </select>
                  {(() => {
                    const vend = vendors.find(v => v.id === selectedVendorId) || vendors[0];
                    if (!vend) return null;
                    return (
                      <div className="mt-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>Vendor: {vend.name}</span>
                          <span className="text-emerald-700 font-mono text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Terms: {vend.paymentTerms || 'Net 30'}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600 text-[10px]">
                          <span>Code: <strong>{vend.code || '—'}</strong></span>
                          <span>POC: <strong>{vend.contactPerson || '—'}</strong></span>
                          <span>Email: {vend.email || '—'}</span>
                          <span>Phone: {vend.phone || '—'}</span>
                          {(vend.gstin || vend.gstNumber || vend.gst) && <span>GST No: <strong>{vend.gstin || vend.gstNumber || vend.gst}</strong></span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PO Number</label>
                  <input type="text" readOnly value="Auto-Generate" className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-500 font-medium cursor-not-allowed"/>
                  <p className="text-[10px] text-slate-400 mt-1">Allocated by the server when the PO is saved.</p>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PO Date *</label>
                  <input type="date" required value={poDate} onChange={(e) => setPoDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"/>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Delivery Date *</label>
                  <input type="date" required value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"/>
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-2">PO Item — Grey Fabric</label>
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-[12px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-2.5 w-10 text-center">#</th>
                        <th className="px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span>Fabric *</span>
                            <MasterSourceLink source="fabricVariants" className="normal-case tracking-normal" />
                          </div>
                        </th>
                        <th className="px-3 py-2.5 text-center w-32">Order Qty *</th>
                        <th className="px-3 py-2.5 w-28">
                          <div className="flex items-center justify-between gap-1">
                            <span>UOM *</span>
                            <MasterSourceLink source="uom" label="+ Manage" className="normal-case tracking-normal" />
                          </div>
                        </th>
                        <th className="px-3 py-2.5 text-right w-36">Rate (₹ / Unit) *</th>
                        <th className="px-3 py-2.5 text-right w-36">Amount (₹)</th>
                        <th className="w-12 px-2 py-2.5 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineItems.map((it, idx) => (
                        <tr key={it.id}>
                          <td className="px-3 py-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <select value={it.itemId || ''} onChange={(e) => updateLineItem(idx, 'itemId', e.target.value)} className="w-full border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800 font-medium" disabled={fabricLoading}>
                              <option value="">{fabricLoading ? 'Loading fabric items...' : 'Select fabric...'}</option>
                              {fabricItems.map((f) => {
                                const qualPart = f.fabricQuality && !f.name.toLowerCase().includes(f.fabricQuality.toLowerCase())
                                  ? ` — ${f.fabricQuality}`
                                  : '';
                                const gsmPart = f.fabricGsm ? ` • ${f.fabricGsm} GSM` : '';
                                const uomPart = f.uom ? ` [${f.uom}]` : '';
                                const skuPart = f.sku ? ` (${f.sku})` : '';
                                return (
                                  <option key={f.id} value={f.id}>
                                    {f.name}{skuPart}{qualPart}{gsmPart}{uomPart}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td className="px-3 py-2"><input type="number" min="0" step="any" value={it.qty} onChange={(e) => updateLineItem(idx, 'qty', e.target.value)} placeholder="40000" className="w-full border border-slate-300 rounded-lg p-1.5 text-center font-mono"/></td>
                          <td className="px-3 py-2">
                            <UomSelect
                              value={it.uom || ''}
                              stockUom={it.stockUom || fabricItems.find((f) => f.id === it.itemId)?.uom}
                              disabled={!it.itemId}
                              onChange={(u) => updateLineItem(idx, 'uom', u)}
                            />
                          </td>
                          <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={it.rate} onChange={(e) => updateLineItem(idx, 'rate', e.target.value)} placeholder="50" className="w-full border border-slate-300 rounded-lg p-1.5 text-right font-mono"/></td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 whitespace-nowrap">{((Number(it.qty) || 0) * (Number(it.rate) || 0)) > 0 ? formatCurrency((Number(it.qty) || 0) * (Number(it.rate) || 0)) : '—'}</td>
                          <td className="px-2 py-2 text-center">
                            {
                              <button type="button" onClick={() => removeLine(idx)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Remove line"><Trash2 size={13}/></button>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addBlankLine} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:underline"><Plus size={13}/> Add Fabric Line</button>
              </div>

              {fabricFlow === FABRIC_FLOW_B && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3.5">
                  <label className="block font-semibold text-slate-700 mb-1" htmlFor="po-dyeing-mill">Dyeing Mill</label>
                  <select id="po-dyeing-mill" value={dyeingMillId} onChange={(e) => setDyeingMillId(e.target.value)} className="w-full sm:w-96 border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    <option value="">Not decided yet</option>
                    {vendors.filter((v) => v.id !== selectedVendorId).map((v) => <option key={v.id} value={v.id}>{v.name}{v.code ? ` (${v.code})` : ''}</option>)}
                  </select>
                  <p className="mt-1 text-[10.5px] text-slate-500">The factory sends the grey fabric straight to this mill. It is tracked on the PO but never becomes OSCAR grey stock; OSCAR stock starts when the dyed fabric arrives.</p>
                </div>
              )}

              {fabricFlow && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-2">Yarn Details <span className="font-normal text-slate-400">(optional)</span></label>
                  <YarnLinesEditor
                    rows={yarnRows}
                    onChange={setYarnRows}
                    yarnItems={(inventoryItems || []).filter((i) => /yarn/i.test(`${i.itemKind || ''} ${i.category || ''} ${i.name || ''}`))}
                    vendors={vendors}
                    formatCurrency={formatCurrency}
                  />
                </div>
              )}

              {fabricFlow && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-2">Costs &amp; Expenses <span className="font-normal text-slate-400">(optional now — add or update on the PO later)</span></label>
                  <OpeningCostsEditor rows={costRows} onChange={setCostRows} flow={fabricFlow} formatCurrency={formatCurrency} />
                </div>
              )}

              {/* Remarks + Order Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-2">Remarks (Optional)</label>
                  <textarea rows={5} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Special instructions, terms, delivery notes, etc." className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 resize-none"/>
                  <p className="text-right text-[10px] text-slate-300 mt-1">{remarks.length}/500</p>
                </div>
                <div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    <h4 className="text-[12px] font-extrabold text-[#17294e] uppercase tracking-wide">Order Summary</h4>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-slate-500 font-medium">Total Quantity</span>
                      <strong className="font-mono text-slate-900">{formatUnitTotals(sumByUnit(lineItems.filter((it) => Number(it.qty) > 0), { uom: (it) => it.uom || 'Mtr', units }), { units })}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-slate-500 font-medium">Total Amount (₹)</span>
                      <strong className="font-mono text-slate-900">{formatCurrency(lineItems.reduce((s, it) => s + ((Number(it.qty) || 0) * (Number(it.rate) || 0)), 0))}</strong>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 mt-1">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Amount in Words</p>
                      <p className="text-[12px] font-semibold text-emerald-800 mt-0.5">{amountInWords(lineItems.reduce((s, it) => s + ((Number(it.qty) || 0) * (Number(it.rate) || 0)), 0))}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap lg:flex-nowrap justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={handleCloseCreateModal} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-bold shadow-sm disabled:opacity-60">{saving ? 'Saving…' : 'Save & Issue Purchase Order'}</button>
              </div>
            </form>
          </div>
        </div>)}

      {/* [DISABLED] PO Detail & Lifecycle Progression Modal removed as requested */}

 <PrintPurchaseOrderModal isOpen={Boolean(printPoTarget)} onClose={() => setPrintPoTarget(null)} po={printPoTarget} />
    </div>);
};
