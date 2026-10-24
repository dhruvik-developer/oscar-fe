import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Layers,
  Building2,
  Users,
  Briefcase,
  Wrench,
  Percent,
  AlertOctagon,
  ArrowDownLeft,
  RotateCcw,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  FileSpreadsheet,
  Truck,
  UserCheck,
  DollarSign,
  Tag,
} from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/ui/PageHeader';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { numIN } from '../../utils/formatters';
import { fmtAddress } from '../../components/common/printDocUtils';

const TABS = [
  { id: 'agencies', label: 'Agencies', singular: 'Agency', icon: Building2, desc: 'External grey production agencies' },
  { id: 'processors', label: 'Processors', singular: 'Processor', icon: Wrench, desc: 'Outsourced dyeing & processing job workers' },
  { id: 'brokers', label: 'Brokers', singular: 'Broker', icon: Users, desc: 'Fabric commission agents & brokers' },
  { id: 'processes', label: 'Process Master', singular: 'Process', icon: Layers, desc: 'Dyeing, printing, washing & finishing stages' },
  { id: 'jobwork-rates', label: 'Job-Work Rates', singular: 'Job-Work Rate', icon: Percent, desc: 'Contracted rates (processor × process × fabric)' },
  { id: 'defects', label: 'Defect Master', singular: 'Defect', icon: AlertOctagon, desc: 'Quality defect taxonomy & severity' },
  { id: 'loss-reasons', label: 'Loss Reasons', singular: 'Loss Reason', icon: ArrowDownLeft, desc: 'Standard process & shrinkage loss codes' },
  { id: 'return-reasons', label: 'Return Reasons', singular: 'Return Reason', icon: RotateCcw, desc: 'Supplier & customer return dispute reasons' },
  { id: 'transporters', label: 'Transporters', singular: 'Transporter', icon: Briefcase, desc: 'Transport companies, GSTIN & contact details (printed on the LR)' },
  { id: 'vehicles', label: 'Vehicles', singular: 'Vehicle', icon: Truck, desc: 'Transport tempo & vehicle registry' },
  { id: 'drivers', label: 'Drivers', singular: 'Driver', icon: UserCheck, desc: 'Driver profiles, mobile numbers & licenses' },
  { id: 'rate-masters', label: 'Rate Master', singular: 'Rate', icon: DollarSign, desc: 'Sales & purchase standard price lists, min selling rates' },
];

// Create / update endpoint per tab (processors are Party rows).
const TAB_ENDPOINTS = {
  agencies: '/masters/agencies/',
  processors: '/masters/parties/',
  brokers: '/masters/brokers/',
  processes: '/masters/processes/',
  'jobwork-rates': '/masters/jobwork-rates/',
  defects: '/masters/defects/',
  'loss-reasons': '/masters/loss-reasons/',
  'return-reasons': '/masters/return-reasons/',
  transporters: '/masters/transporters/',
  vehicles: '/masters/vehicles/',
  drivers: '/masters/drivers/',
  'rate-masters': '/masters/rate-masters/',
};

// Process types the proposal asks to be configurable (§07 "Processing planning").
const PROCESS_CATEGORIES = [
  'Dyeing', 'Printing', 'Washing', 'Finishing', 'Compacting', 'Embroidery', 'Coating / Heat Set', 'Other Job Work',
];

const COMMISSION_UNITS = { percent: '%', per_meter: ' ₹/m', per_taka: ' ₹/taka', fixed: ' ₹ fixed' };

// Starter rows taken from the proposal (§07 process types, §08 QC examples and
// suggested loss reasons, §11 sales-return reasons). "Load standard list"
// creates whichever of these the tenant does not have yet.
const STANDARD_ROWS = {
  processes: PROCESS_CATEGORIES.map((name, i) => ({
    code: `PRC-${String(i + 1).padStart(2, '0')}`, name, category: name, expectedLossPct: '0', tolerancePct: '0', isActive: true,
  })),
  defects: [
    { code: 'DEF-SHADE', name: 'Shade Variation', category: 'shade', severity: 'Major' },
    { code: 'DEF-STAIN', name: 'Stain', category: 'stain', severity: 'Minor' },
    { code: 'DEF-HOLE', name: 'Hole', category: 'hole', severity: 'Major' },
    { code: 'DEF-PRINT', name: 'Printing Defect', category: 'printing defect', severity: 'Major' },
    { code: 'DEF-FINISH', name: 'Finish Quality', category: 'finish', severity: 'Minor' },
  ].map((r) => ({ ...r, isActive: true })),
  'loss-reasons': [
    ['LR-SHRINK', 'Normal shrinkage / process loss'],
    ['LR-SHORT', 'Short meter'],
    ['LR-DAMAGE', 'Damage / hole / stain'],
    ['LR-SHADE', 'Shade rejection'],
    ['LR-TEST', 'Testing / sample consumption'],
    ['LR-CLAIM', 'Processor claim / scrap'],
    ['LR-OTHER', 'Other approved loss'],
  ].map(([code, name]) => ({ code, name, description: '', isActive: true })),
  'return-reasons': [
    ['RR-SHADE', 'Shade issue'],
    ['RR-QUALITY', 'Quality issue'],
    ['RR-SHORT', 'Short meter'],
    ['RR-DESIGN', 'Wrong design'],
    ['RR-RATE', 'Rate dispute'],
  ].map(([code, name]) => ({ code, name, description: '', isActive: true })),
};

// Optional fields the backend rejects as "" — send null (dates / nullable
// numbers) or drop them so the model default applies.
const EMPTY_TO_NULL = ['effectiveTo', 'validTo', 'minSellingRate'];
const EMPTY_TO_DEFAULT = ['defaultRate', 'defaultValue', 'expectedLossPct', 'tolerancePct'];

const isBlank = (v) => v === '' || v === undefined;

function cleanPayload(tab, formData) {
  const payload = { ...formData };
  EMPTY_TO_NULL.forEach((k) => { if (k in payload && isBlank(payload[k])) payload[k] = null; });
  EMPTY_TO_DEFAULT.forEach((k) => { if (k in payload && isBlank(payload[k])) delete payload[k]; });

  if (tab === 'jobwork-rates') {
    // A job-work rate has no code/name of its own (processor × process × quality).
    delete payload.code;
    delete payload.name;
  }
  if (tab === 'processors') {
    // Processors are Party rows: address is a JSON object, terms are payment
    // terms, and the active flag is the party status.
    const prev = payload.billingAddress && typeof payload.billingAddress === 'object' ? payload.billingAddress : {};
    payload.billingAddress = {
      ...prev,
      line1: (payload.addressLine1 || '').trim(),
      city: (payload.addressCity || '').trim(),
      state: (payload.addressState || '').trim(),
      pincode: (payload.addressPincode || '').trim(),
    };
    payload.paymentTerms = payload.terms || '';
    payload.status = payload.isActive === false ? 'Inactive' : 'Active';
    payload.isProcessor = true;
    if (!payload.type) payload.type = 'Processor';
    if (!payload.code) delete payload.code; // server allocates PROC-xxxx
    ['addressLine1', 'addressCity', 'addressState', 'addressPincode', 'terms', 'isActive', 'address'].forEach((k) => delete payload[k]);
  }
  if (tab === 'defects' && payload.severity) {
    // Backend choices are Minor / Major / Critical.
    const s = String(payload.severity).toLowerCase();
    payload.severity = s.charAt(0).toUpperCase() + s.slice(1);
  }
  return payload;
}

/** Field errors live on err.payload (services/api.js ApiError). */
function extractFieldErrors(err) {
  const raw = err?.payload?.field_errors || err?.payload?.fieldErrors || err?.field_errors || null;
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  Object.entries(raw).forEach(([key, val]) => {
    const list = Array.isArray(val) ? val.map(String) : [String(val)];
    out[key] = list;
    // Inline messages look fields up by their camelCase form name.
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = list;
  });
  return out;
}

const isProcessorRowActive = (row) => (row.status ? row.status === 'Active' : (row.isActive ?? true));

export default function TextileMastersPage() {
  const [searchParams] = useSearchParams();
  // ?tab=vehicles deep-links straight to a tab (used by the trip form).
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    return TABS.some((t) => t.id === tab) ? tab : 'agencies';
  });
  const activeTabMeta = TABS.find((t) => t.id === activeTab);
  const codeOptional = activeTab === 'transporters' || activeTab === 'processors';
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);

  // Modal form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Modern centered confirmation and alert dialog states (replaces browser window.confirm/alert)
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    id: null,
    name: '',
    loading: false,
  });
  const [seedConfirm, setSeedConfirm] = useState({
    isOpen: false,
    missing: [],
    label: '',
    loading: false,
  });
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info',
  });

  // Aux state for rate master dropdowns
  const [processorsList, setProcessorsList] = useState([]);
  const [processesList, setProcessesList] = useState([]);
  const [qualitiesList, setQualitiesList] = useState([]);
  const [transportersList, setTransportersList] = useState([]);
  const [partiesList, setPartiesList] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [designsList, setDesignsList] = useState([]);
  const [shadesList, setShadesList] = useState([]);

  // Fetch list based on active tab
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let endpoint = '';
      if (activeTab === 'agencies') endpoint = '/masters/agencies/';
      else if (activeTab === 'processors') endpoint = '/masters/parties/processors/';
      else if (activeTab === 'brokers') endpoint = '/masters/brokers/';
      else if (activeTab === 'processes') endpoint = '/masters/processes/';
      else if (activeTab === 'jobwork-rates') endpoint = '/masters/jobwork-rates/';
      else if (activeTab === 'defects') endpoint = '/masters/defects/';
      else if (activeTab === 'loss-reasons') endpoint = '/masters/loss-reasons/';
      else if (activeTab === 'return-reasons') endpoint = '/masters/return-reasons/';
      else if (activeTab === 'transporters') endpoint = '/masters/transporters/';
      else if (activeTab === 'vehicles') endpoint = '/masters/vehicles/';
      else if (activeTab === 'drivers') endpoint = '/masters/drivers/';
      else if (activeTab === 'rate-masters') endpoint = '/masters/rate-masters/';

      const res = await api.get(endpoint);
      const rows = Array.isArray(res) ? res : (res?.results || res?.rows || []);
      setData(rows);
    } catch (err) {
      console.error(`Failed to fetch ${activeTab}:`, err);
      setError(err?.message || 'Failed to load master records.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const loadTransporters = useCallback(() => {
    api.get('/masters/transporters/').then(r => setTransportersList(Array.isArray(r) ? r : (r?.results || []))).catch(() => {});
  }, []);

  // Load auxiliary data for composite forms. Re-runs on every tab switch, so a
  // transporter added in the Transporters tab shows up in the Vehicles / Drivers forms.
  useEffect(() => {
    if (activeTab === 'vehicles' || activeTab === 'drivers') {
      loadTransporters();
    }
    if (activeTab === 'jobwork-rates') {
      api.get('/masters/parties/processors/').then(r => setProcessorsList(Array.isArray(r) ? r : (r?.results || []))).catch(() => {});
      api.get('/masters/processes/').then(r => setProcessesList(Array.isArray(r) ? r : (r?.results || []))).catch(() => {});
      api.get('/inventory/fabric-qualities/').then(r => setQualitiesList(Array.isArray(r) ? r : (r?.results || []))).catch(() => {});
    }
    if (activeTab === 'rate-masters') {
      api.get('/masters/parties/').then(r => setPartiesList(Array.isArray(r) ? r : (r?.results || []))).catch(() => {});
      api.get('/masters/items/').then(r => setItemsList(Array.isArray(r) ? r : (r?.results || []))).catch(() => {});
      api.get('/inventory/fabric-qualities/').then(r => setQualitiesList(Array.isArray(r) ? r : (r?.results || []))).catch(() => {});
      api.get('/inventory/designs/').then(r => setDesignsList(Array.isArray(r) ? r : (r?.results || []))).catch(() => {});
      api.get('/inventory/shades/').then(r => setShadesList(Array.isArray(r) ? r : (r?.results || []))).catch(() => {});
    }
  }, [activeTab, loadTransporters]);

  useEffect(() => {
    fetchData();
    setSearch('');
  }, [fetchData]);

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((item) => {
      const name = (item.name || item.partyName || item.code || item.vehicleNumber || item.vehicle_number || '').toLowerCase();
      const code = (item.code || '').toLowerCase();
      const contact = (item.contactPerson || item.contact || item.phone || item.mobile || item.licence || item.transporterName || '').toLowerCase();
      const extra = [item.phone, item.gstin].filter(Boolean).join(' ').toLowerCase();
      return name.includes(q) || code.includes(q) || contact.includes(q) || extra.includes(q);
    });
  }, [data, search]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormErrors({});
    if (activeTab === 'agencies') {
      setFormData({ name: '', code: '', contactPerson: '', phone: '', email: '', gstin: '', address: '', defaultRate: '', rateUom: 'MTR', isActive: true });
    } else if (activeTab === 'processors') {
      setFormData({ name: '', code: '', phone: '', email: '', gstin: '', addressLine1: '', addressCity: '', addressState: '', addressPincode: '', terms: '', isProcessor: true, type: 'Processor', isActive: true });
    } else if (activeTab === 'brokers') {
      setFormData({ name: '', code: '', contactPerson: '', phone: '', email: '', pan: '', gstin: '', commissionType: 'percent', defaultValue: '1.00', isActive: true });
    } else if (activeTab === 'processes') {
      setFormData({ name: '', code: '', category: 'Dyeing', expectedLossPct: '3.00', tolerancePct: '1.00', isActive: true });
    } else if (activeTab === 'jobwork-rates') {
      setFormData({ processorId: '', processId: '', fabricQualityId: '', rate: '', rateUom: 'MTR', effectiveFrom: new Date().toISOString().split('T')[0], effectiveTo: '', isActive: true });
    } else if (activeTab === 'defects') {
      setFormData({ name: '', code: '', category: 'shade', severity: 'Minor', isActive: true });
    } else if (activeTab === 'loss-reasons' || activeTab === 'return-reasons') {
      setFormData({ name: '', code: '', description: '', isActive: true });
    } else if (activeTab === 'transporters') {
      setFormData({ name: '', code: '', contactPerson: '', phone: '', email: '', gstin: '', pan: '', addressLine1: '', addressCity: '', addressState: '', addressPincode: '', isActive: true });
    } else if (activeTab === 'vehicles') {
      setFormData({ vehicleNumber: '', vehicleType: 'Truck', capacity: '', transporterId: '', remarks: '', isActive: true });
    } else if (activeTab === 'drivers') {
      setFormData({ name: '', mobile: '', licence: '', transporterId: '', remarks: '', isActive: true });
    } else if (activeTab === 'rate-masters') {
      setFormData({
        rateType: 'Sales',
        partyId: '',
        itemId: '',
        fabricQualityId: '',
        designId: '',
        shadeId: '',
        rate: '',
        minSellingRate: '',
        uom: 'Meter',
        validFrom: new Date().toISOString().split('T')[0],
        validTo: '',
        notes: '',
        isActive: true,
      });
    }
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormErrors({});
    setFormData({
      ...item,
      contactPerson: item.contactPerson || item.contact_person || '',
      expectedLossPct: item.expectedLossPct ?? item.expected_loss_pct ?? '',
      tolerancePct: item.tolerancePct ?? item.tolerance_pct ?? '',
      processorId: item.processorId || item.processor || '',
      processId: item.processId || item.process || '',
      fabricQualityId: item.fabricQualityId || item.fabric_quality || '',
      defaultValue: item.defaultValue ?? item.default_value ?? '',
      commissionType: item.commissionType || item.commission_type || 'percent',
      defaultRate: item.defaultRate ?? item.default_rate ?? '',
      rateUom: item.rateUom || item.rate_uom || 'MTR',
      vehicleNumber: item.vehicleNumber || item.vehicle_number || '',
      vehicleType: item.vehicleType || item.vehicle_type || 'Truck',
      capacity: item.capacity || '',
      licence: item.licence || item.license || '',
      mobile: item.mobile || item.phone || '',
      transporterId: item.transporterId || item.transporter || '',
      rateType: item.rateType || item.rate_type || 'Sales',
      minSellingRate: item.minSellingRate ?? item.min_selling_rate ?? '',
      validFrom: item.validFrom || item.valid_from || '',
      validTo: item.validTo || item.valid_to || '',
      notes: item.notes || '',
      itemId: item.itemId || item.item || '',
      designId: item.designId || item.design || '',
      shadeId: item.shadeId || item.shade || '',
      partyId: item.partyId || item.party || '',
      uom: item.uom || 'Meter',
      effectiveFrom: item.effectiveFrom || item.effective_from || '',
      effectiveTo: item.effectiveTo || item.effective_to || '',
      severity: item.severity ? String(item.severity).charAt(0).toUpperCase() + String(item.severity).slice(1).toLowerCase() : 'Minor',
      isActive: item.isActive ?? item.is_active ?? true,
      ...(activeTab === 'processors' ? (() => {
        const addr = item.billingAddress && typeof item.billingAddress === 'object' ? item.billingAddress : {};
        return {
          addressLine1: addr.line1 || addr.street || '',
          addressCity: addr.city || '',
          addressState: addr.state || '',
          addressPincode: addr.pincode || addr.pin || '',
          terms: item.paymentTerms || item.payment_terms || '',
          isActive: isProcessorRowActive(item),
        };
      })() : {}),
      ...(activeTab === 'transporters' ? (() => {
        // Transporter address is a JSON object ({ line1, city, state, pincode }); older rows may hold a plain string.
        const addr = item.address && typeof item.address === 'object' ? item.address : { line1: item.address || '' };
        return {
          addressLine1: addr.line1 || addr.street || '',
          addressCity: addr.city || '',
          addressState: addr.state || '',
          addressPincode: addr.pincode || addr.pin || '',
        };
      })() : {}),
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormErrors({});

    try {
      let endpoint = '';
      if (activeTab === 'agencies') endpoint = '/masters/agencies/';
      else if (activeTab === 'processors') endpoint = '/masters/parties/';
      else if (activeTab === 'brokers') endpoint = '/masters/brokers/';
      else if (activeTab === 'processes') endpoint = '/masters/processes/';
      else if (activeTab === 'jobwork-rates') endpoint = '/masters/jobwork-rates/';
      else if (activeTab === 'defects') endpoint = '/masters/defects/';
      else if (activeTab === 'loss-reasons') endpoint = '/masters/loss-reasons/';
      else if (activeTab === 'return-reasons') endpoint = '/masters/return-reasons/';
      else if (activeTab === 'transporters') endpoint = '/masters/transporters/';
      else if (activeTab === 'vehicles') endpoint = '/masters/vehicles/';
      else if (activeTab === 'drivers') endpoint = '/masters/drivers/';
      else if (activeTab === 'rate-masters') endpoint = '/masters/rate-masters/';

      const payload = cleanPayload(activeTab, formData);
      if (activeTab === 'transporters') {
        const { addressLine1, addressCity, addressState, addressPincode } = payload;
        // Keep any other keys an existing address object carries (line2, country...).
        const { street: _street, pin: _pin, ...base } = payload.address && typeof payload.address === 'object' ? payload.address : {};
        payload.address = {
          ...base,
          line1: (addressLine1 || '').trim(),
          city: (addressCity || '').trim(),
          state: (addressState || '').trim(),
          pincode: (addressPincode || '').trim(),
        };
        delete payload.addressLine1;
        delete payload.addressCity;
        delete payload.addressState;
        delete payload.addressPincode;
      } else if (activeTab === 'brokers') {
        if (payload.contactPerson !== undefined) payload.contact_person = payload.contactPerson;
        if (payload.commissionType !== undefined) payload.commission_type = payload.commissionType;
        if (payload.defaultValue !== undefined) payload.default_value = payload.defaultValue;
        if (payload.isActive !== undefined) payload.is_active = payload.isActive;
      }
      if (editingItem) {
        await api.put(`${endpoint}${editingItem.id}/`, payload);
      } else {
        await api.post(endpoint, payload);
      }
      setModalOpen(false);
      fetchData();
      if (activeTab === 'transporters') loadTransporters();
    } catch (err) {
      console.error('Save failed:', err);
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        setFormErrors(fieldErrors);
      } else {
        setFormErrors({ _form: [err?.message || 'Failed to save record.'] });
      }
    } finally {
      setSaving(false);
    }
  };

  // Create whichever proposal-standard rows (STANDARD_ROWS) are missing.
  const [seeding, setSeeding] = useState(false);
  const handleLoadStandard = async () => {
    const rows = STANDARD_ROWS[activeTab];
    if (!rows) return;
    const key = (v) => String(v || '').trim().toLowerCase();
    const haveNames = new Set(data.map((r) => key(r.name)));
    const haveCodes = new Set(data.map((r) => key(r.code)));
    const missing = rows.filter((r) => !haveNames.has(key(r.name)) && !haveCodes.has(key(r.code)));
    if (!missing.length) {
      setFeedbackModal({
        isOpen: true,
        title: 'Already Up To Date',
        message: 'All standard entries already exist for this master category.',
        variant: 'info',
      });
      return;
    }
    const tabLabel = TABS.find((t) => t.id === activeTab)?.label || 'standard';
    setSeedConfirm({
      isOpen: true,
      missing,
      label: tabLabel,
      loading: false,
    });
  };

  const handleExecuteSeed = async () => {
    const { missing } = seedConfirm;
    if (!missing?.length) return;
    setSeedConfirm((prev) => ({ ...prev, loading: true }));
    setSeeding(true);
    const failed = [];
    for (const row of missing) {
      try {
        await api.post(TAB_ENDPOINTS[activeTab], cleanPayload(activeTab, row));
      } catch (err) {
        failed.push(`${row.name}: ${err?.message || 'failed'}`);
      }
    }
    setSeeding(false);
    setSeedConfirm({ isOpen: false, missing: [], label: '', loading: false });
    fetchData();
    if (failed.length) {
      setFeedbackModal({
        isOpen: true,
        title: 'Partial Import Result',
        message: `Some entries could not be added:\n${failed.join('\n')}`,
        variant: 'warning',
      });
    }
  };

  const promptDelete = (rowOrId) => {
    let id = rowOrId;
    let name = '';
    if (rowOrId && typeof rowOrId === 'object') {
      id = rowOrId.id;
      name = rowOrId.name || rowOrId.code || rowOrId.vehicleNumber || rowOrId.licenseNumber || `Record #${id}`;
    } else {
      const match = data.find((r) => r.id === rowOrId);
      name = match?.name || match?.code || match?.vehicleNumber || `Record #${id}`;
    }

    setDeleteConfirm({
      isOpen: true,
      id,
      name,
      loading: false,
    });
  };

  // Keep handleDelete as alias for promptDelete for backwards-compatibility
  const handleDelete = promptDelete;

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    setDeleteConfirm((prev) => ({ ...prev, loading: true }));
    try {
      let endpoint = '';
      if (activeTab === 'agencies') endpoint = '/masters/agencies/';
      else if (activeTab === 'processors') endpoint = '/masters/parties/';
      else if (activeTab === 'brokers') endpoint = '/masters/brokers/';
      else if (activeTab === 'processes') endpoint = '/masters/processes/';
      else if (activeTab === 'jobwork-rates') endpoint = '/masters/jobwork-rates/';
      else if (activeTab === 'defects') endpoint = '/masters/defects/';
      else if (activeTab === 'loss-reasons') endpoint = '/masters/loss-reasons/';
      else if (activeTab === 'return-reasons') endpoint = '/masters/return-reasons/';
      else if (activeTab === 'transporters') endpoint = '/masters/transporters/';
      else if (activeTab === 'vehicles') endpoint = '/masters/vehicles/';
      else if (activeTab === 'drivers') endpoint = '/masters/drivers/';
      else if (activeTab === 'rate-masters') endpoint = '/masters/rate-masters/';

      await api.delete(`${endpoint}${deleteConfirm.id}/`);
      setDeleteConfirm({ isOpen: false, id: null, name: '', loading: false });
      fetchData();
      if (activeTab === 'transporters') loadTransporters();
    } catch (err) {
      setDeleteConfirm((prev) => ({ ...prev, loading: false }));
      setFeedbackModal({
        isOpen: true,
        title: 'Delete Failed',
        message: err?.message || 'Failed to delete record. Please check dependencies and try again.',
        variant: 'danger',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Textile Masters"
        subtitle="Agencies, Processors, Brokers, Processes, Standard Rates, and Quality Taxonomies"
        breadcrumb={[
          { label: 'Masters', path: '/masters' },
          { label: 'Textile Masters' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {STANDARD_ROWS[activeTab] && (
              <button
                onClick={handleLoadStandard}
                disabled={seeding || loading}
                title="Add the standard entries listed in the requirement document"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition disabled:opacity-50"
              >
                <FileSpreadsheet size={15} /> {seeding ? 'Adding…' : 'Load Standard List'}
              </button>
            )}
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
            >
              <Plus size={15} /> Add {activeTabMeta?.singular || 'Record'}
            </button>
          </div>
        }
      />

      {/* Tabs Row */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#dce5f4] shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-500 font-medium">
            {filteredData.length} {filteredData.length === 1 ? 'record' : 'records'}
          </span>
          <button
            onClick={fetchData}
            title="Refresh"
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 border border-slate-200 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-[#dce5f4] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw size={16} className="animate-spin text-blue-500" />
            Loading {activeTab}...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500 text-xs">
            {error}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No records found. Click "+ Add" above to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">{activeTab === 'vehicles' ? 'Vehicle No' : activeTab === 'drivers' ? 'Driver Name' : activeTab === 'rate-masters' ? 'Type' : 'Code / ID'}</th>
                  <th className="px-4 py-3">{activeTab === 'vehicles' ? 'Vehicle Type' : activeTab === 'drivers' ? 'Mobile' : 'Name / Label'}</th>
                  {activeTab === 'agencies' && (
                    <>
                      <th className="px-4 py-3">Contact Person</th>
                      <th className="px-4 py-3">Phone / Email</th>
                      <th className="px-4 py-3">GSTIN</th>
                      <th className="px-4 py-3 text-right">Default Rate</th>
                    </>
                  )}
                  {activeTab === 'processors' && (
                    <>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">City / Address</th>
                      <th className="px-4 py-3">GSTIN</th>
                      <th className="px-4 py-3">Terms</th>
                    </>
                  )}
                  {activeTab === 'brokers' && (
                    <>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">PAN / GSTIN</th>
                      <th className="px-4 py-3">Commission Type</th>
                      <th className="px-4 py-3 text-right">Default Comm.</th>
                    </>
                  )}
                  {activeTab === 'processes' && (
                    <>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Expected Loss %</th>
                      <th className="px-4 py-3 text-right">Tolerance %</th>
                    </>
                  )}
                  {activeTab === 'jobwork-rates' && (
                    <>
                      <th className="px-4 py-3">Processor</th>
                      <th className="px-4 py-3">Process</th>
                      <th className="px-4 py-3">Fabric Quality</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3">Effective Range</th>
                    </>
                  )}
                  {activeTab === 'defects' && (
                    <>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Severity</th>
                    </>
                  )}
                  {(activeTab === 'loss-reasons' || activeTab === 'return-reasons') && (
                    <th className="px-4 py-3">Description</th>
                  )}
                  {activeTab === 'transporters' && (
                    <>
                      <th className="px-4 py-3">Contact Person</th>
                      <th className="px-4 py-3">Phone / Email</th>
                      <th className="px-4 py-3">GSTIN</th>
                      <th className="px-4 py-3">Address</th>
                    </>
                  )}
                  {activeTab === 'vehicles' && (
                    <>
                      <th className="px-4 py-3">Capacity</th>
                      <th className="px-4 py-3">Transporter</th>
                      <th className="px-4 py-3">Remarks</th>
                    </>
                  )}
                  {activeTab === 'drivers' && (
                    <>
                      <th className="px-4 py-3">License No</th>
                      <th className="px-4 py-3">Transporter</th>
                      <th className="px-4 py-3">Remarks</th>
                    </>
                  )}
                  {activeTab === 'rate-masters' && (
                    <>
                      <th className="px-4 py-3">Party (Customer/Vendor)</th>
                      <th className="px-4 py-3">Item / Quality</th>
                      <th className="px-4 py-3">Design / Shade</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-right">Min Selling Rate</th>
                      <th className="px-4 py-3">Validity</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-700">
                      {activeTab === 'vehicles'
                        ? (row.vehicleNumber || row.vehicle_number || '—')
                        : activeTab === 'drivers'
                        ? (row.name || '—')
                        : activeTab === 'rate-masters'
                        ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              (row.rateType || row.rate_type) === 'Purchase' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {row.rateType || row.rate_type || 'Sales'}
                            </span>
                          )
                        : (row.code || row.id?.slice(0, 8))}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {activeTab === 'vehicles'
                        ? (row.vehicleType || row.vehicle_type || 'Truck')
                        : activeTab === 'drivers'
                        ? (row.mobile || '—')
                        : activeTab === 'rate-masters'
                        ? (row.partyName || row.party?.name || 'General (All Parties)')
                        : (row.name || row.partyName || row.party?.name || '—')}
                    </td>
                    {activeTab === 'agencies' && (
                      <>
                        <td className="px-4 py-3 text-slate-600">{row.contactPerson || row.contact_person || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{row.phone || row.email || '—'}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{row.gstin || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {row.defaultRate ? `₹${numIN(row.defaultRate)} / ${row.rateUom || 'MTR'}` : '—'}
                        </td>
                      </>
                    )}
                    {activeTab === 'processors' && (
                      <>
                        <td className="px-4 py-3 text-slate-600">{row.phone || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{fmtAddress(row.billingAddress) || row.city || '—'}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{row.gstin || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{row.paymentTerms || row.payment_terms || row.terms || '—'}</td>
                      </>
                    )}
                    {activeTab === 'brokers' && (
                      <>
                        <td className="px-4 py-3 text-slate-600">{row.contactPerson || row.phone || '—'}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{row.pan || row.gstin || '—'}</td>
                        <td className="px-4 py-3 capitalize text-slate-700">{String(row.commissionType || row.commission_type || 'percent').replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {row.defaultValue || row.default_value
                            ? `${row.defaultValue || row.default_value}${COMMISSION_UNITS[row.commissionType || row.commission_type] ?? '%'}`
                            : '—'}
                        </td>
                      </>
                    )}
                    {activeTab === 'processes' && (
                      <>
                        <td className="px-4 py-3 text-slate-600">{row.category || '—'}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                          {row.expectedLossPct ?? row.expected_loss_pct ?? '0.00'}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                          ±{row.tolerancePct ?? row.tolerance_pct ?? '0.00'}%
                        </td>
                      </>
                    )}
                    {activeTab === 'jobwork-rates' && (
                      <>
                        <td className="px-4 py-3 text-slate-800 font-medium">{row.processorName || row.processor?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{row.processName || row.process?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{row.fabricQualityName || row.fabric_quality?.name || 'All Qualities'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          ₹{numIN(row.rate || 0)} / {row.rateUom || 'MTR'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {row.effectiveFrom || 'Ever'} {row.effectiveTo ? `to ${row.effectiveTo}` : ''}
                        </td>
                      </>
                    )}
                    {activeTab === 'defects' && (
                      <>
                        <td className="px-4 py-3 capitalize text-slate-700">{row.category || 'other'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            String(row.severity).toLowerCase() === 'critical' ? 'bg-rose-100 text-rose-700' :
                            String(row.severity).toLowerCase() === 'major' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {row.severity || 'minor'}
                          </span>
                        </td>
                      </>
                    )}
                    {(activeTab === 'loss-reasons' || activeTab === 'return-reasons') && (
                      <td className="px-4 py-3 text-slate-600">{row.description || '—'}</td>
                    )}
                    {activeTab === 'transporters' && (
                      <>
                        <td className="px-4 py-3 text-slate-600">{row.contactPerson || row.contact_person || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{[row.phone, row.email].filter(Boolean).join(' · ') || '—'}</td>
                        <td className="px-4 py-3 font-mono text-slate-600">{row.gstin || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{fmtAddress(row.address) || '—'}</td>
                      </>
                    )}
                    {activeTab === 'vehicles' && (
                      <>
                        <td className="px-4 py-3 text-slate-600">{row.capacity || '—'}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{row.transporterName || row.transporter?.name || 'Self / Own Fleet'}</td>
                        <td className="px-4 py-3 text-slate-500">{row.remarks || '—'}</td>
                      </>
                    )}
                    {activeTab === 'drivers' && (
                      <>
                        <td className="px-4 py-3 font-mono text-slate-600">{row.licence || row.license || '—'}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{row.transporterName || row.transporter?.name || 'Self / Direct'}</td>
                        <td className="px-4 py-3 text-slate-500">{row.remarks || '—'}</td>
                      </>
                    )}
                    {activeTab === 'rate-masters' && (
                      <>
                        <td className="px-4 py-3 text-slate-700">
                          {row.itemName || row.item?.name || row.fabricQualityName || row.fabric_quality?.name || 'All Fabrics'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {[row.designName || row.design?.name, row.shadeName || row.shade?.name].filter(Boolean).join(' • ') || 'All Variants'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          ₹{numIN(row.rate || 0)} / {row.uom || 'MTR'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          {(row.minSellingRate || row.min_selling_rate) ? `₹${numIN(row.minSellingRate || row.min_selling_rate)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {row.validFrom || row.valid_from || 'Always'} {row.validTo || row.valid_to ? `to ${row.validTo || row.valid_to}` : ''}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        (activeTab === 'processors' ? isProcessorRowActive(row) : (row.isActive ?? row.is_active ?? true)) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {(activeTab === 'processors' ? isProcessorRowActive(row) : (row.isActive ?? row.is_active ?? true)) ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(row)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => promptDelete(row)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingItem ? 'Edit' : 'Add New'} {activeTabMeta?.singular}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{activeTabMeta?.desc || 'Fill in the master attributes below'}</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Common Code and Name */}
              {formErrors._form && (
                <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 font-medium">
                  {formErrors._form[0]}
                </div>
              )}
              {(() => {
                // Field errors with no inline slot on this form still need to be seen.
                const inline = new Set(['_form', 'code', 'name', 'gstin', 'email']);
                const extra = Object.entries(formErrors).filter(([k]) => !inline.has(k) && !/_/.test(k));
                return extra.length > 0 && (
                  <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 space-y-0.5">
                    {extra.map(([k, v]) => (
                      <p key={k}><span className="font-semibold">{k}:</span> {v[0]}</p>
                    ))}
                  </div>
                );
              })()}

              {activeTab !== 'vehicles' && activeTab !== 'drivers' && activeTab !== 'rate-masters' && activeTab !== 'jobwork-rates' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {/* Transporter / processor codes are auto-generated by the backend when left blank. */}
                    <label className="block font-semibold text-slate-700 mb-1">{codeOptional ? 'Code' : 'Code *'}</label>
                    <input
                      type="text"
                      required={!codeOptional}
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder={codeOptional ? 'Auto if blank' : 'e.g. DYE-01'}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg uppercase font-mono focus:border-blue-500 focus:outline-none"
                    />
                    {formErrors.code && <p className="text-rose-500 text-[10px] mt-0.5">{formErrors.code[0]}</p>}
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Dyeing Process"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                    {formErrors.name && <p className="text-rose-500 text-[10px] mt-0.5">{formErrors.name[0]}</p>}
                  </div>
                </div>
              )}

              {/* Agencies Form */}
              {activeTab === 'agencies' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                      <input
                        type="text"
                        value={formData.contactPerson || ''}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                      <input
                        type="text"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
                      <input
                        type="text"
                        value={formData.gstin || ''}
                        onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono uppercase focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Default Rate (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.defaultRate || ''}
                        onChange={(e) => setFormData({ ...formData, defaultRate: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Rate UOM</label>
                      <input
                        type="text"
                        value={formData.rateUom || 'MTR'}
                        onChange={(e) => setFormData({ ...formData, rateUom: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg uppercase focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Processors Form — GST / commercial details and agreed terms (proposal §07) */}
              {activeTab === 'processors' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="9876543210"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                      {formErrors.email && <p className="text-rose-500 text-[10px] mt-0.5">{formErrors.email[0]}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={formData.gstin || ''}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                      placeholder="24AAAAA0000A1Z5"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono uppercase focus:border-blue-500 focus:outline-none"
                    />
                    {formErrors.gstin && <p className="text-rose-500 text-[10px] mt-0.5">{formErrors.gstin[0]}</p>}
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formData.addressLine1 || ''}
                      onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                      placeholder="Mill / factory address"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">City</label>
                      <input
                        type="text"
                        value={formData.addressCity || ''}
                        onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">State</label>
                      <input
                        type="text"
                        value={formData.addressState || ''}
                        onChange={(e) => setFormData({ ...formData, addressState: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Pincode</label>
                      <input
                        type="text"
                        value={formData.addressPincode || ''}
                        onChange={(e) => setFormData({ ...formData, addressPincode: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Agreed Terms</label>
                    <textarea
                      rows={2}
                      value={formData.terms || ''}
                      onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                      placeholder="Payment days, loss allowance, delivery terms..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Brokers Form */}
              {activeTab === 'brokers' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                      <input
                        type="text"
                        value={formData.contactPerson || ''}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                      <input
                        type="text"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">PAN</label>
                      <input
                        type="text"
                        value={formData.pan || ''}
                        onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono uppercase focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Commission Type</label>
                      <select
                        value={formData.commissionType || 'percent'}
                        onChange={(e) => setFormData({ ...formData, commissionType: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="percent">Percentage (%)</option>
                        <option value="per_meter">Per Meter (₹/m)</option>
                        <option value="per_taka">Per Taka (₹/taka)</option>
                        <option value="fixed">Fixed Amount (₹)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Default Commission Value</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.defaultValue || ''}
                      onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Processes Form */}
              {activeTab === 'processes' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Process Type</label>
                    <select
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">Select type...</option>
                      {PROCESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      {/* Keep a custom category saved earlier selectable. */}
                      {formData.category && !PROCESS_CATEGORIES.includes(formData.category) && (
                        <option value={formData.category}>{formData.category}</option>
                      )}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Expected Loss %</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.expectedLossPct || ''}
                        onChange={(e) => setFormData({ ...formData, expectedLossPct: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tolerance %</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.tolerancePct || ''}
                        onChange={(e) => setFormData({ ...formData, tolerancePct: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* JobWork Rates Form */}
              {activeTab === 'jobwork-rates' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Processor *</label>
                    <select
                      required
                      value={formData.processorId || ''}
                      onChange={(e) => setFormData({ ...formData, processorId: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                    >
                      <option value="">Select Processor...</option>
                      {processorsList.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.code || 'No code'})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Process *</label>
                      <select
                        required
                        value={formData.processId || ''}
                        onChange={(e) => setFormData({ ...formData, processId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="">Select Process...</option>
                        {processesList.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">Fabric Quality</label>
                        <MasterSourceLink source="fabricQualities" />
                      </div>
                      <select
                        value={formData.fabricQualityId || ''}
                        onChange={(e) => setFormData({ ...formData, fabricQualityId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="">All Qualities (Generic)</option>
                        {qualitiesList.map((q) => (
                          <option key={q.id} value={q.id}>{q.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Rate (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.rate || ''}
                        onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Rate UOM</label>
                      <input
                        type="text"
                        value={formData.rateUom || 'MTR'}
                        onChange={(e) => setFormData({ ...formData, rateUom: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg uppercase focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  {/* Job Work Orders pick the rate active on the order date (lookup-rate). */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Effective From *</label>
                      <input
                        type="date"
                        required
                        value={formData.effectiveFrom || ''}
                        onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Effective To (Optional)</label>
                      <input
                        type="date"
                        min={formData.effectiveFrom || undefined}
                        value={formData.effectiveTo || ''}
                        onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">Leave blank while the rate is still running.</p>
                    </div>
                  </div>
                </>
              )}

              {/* Defects Form */}
              {activeTab === 'defects' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Category</label>
                    <select
                      value={formData.category || 'shade'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                    >
                      <option value="shade">Shade</option>
                      <option value="stain">Stain</option>
                      <option value="hole">Hole</option>
                      <option value="printing defect">Printing Defect</option>
                      <option value="finish">Finish</option>
                      <option value="weaving defect">Weaving Defect</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Severity</label>
                    <select
                      value={formData.severity || 'Minor'}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                    >
                      <option value="Minor">Minor</option>
                      <option value="Major">Major</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Transporters Form */}
              {activeTab === 'transporters' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                      <input
                        type="text"
                        value={formData.contactPerson || ''}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="9876543210"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">GSTIN</label>
                      <input
                        type="text"
                        value={formData.gstin || ''}
                        onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                        placeholder="24AAAAA0000A1Z5"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono uppercase focus:border-blue-500 focus:outline-none"
                      />
                      {formErrors.gstin && <p className="text-rose-500 text-[10px] mt-0.5">{formErrors.gstin[0]}</p>}
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">PAN</label>
                      <input
                        type="text"
                        value={formData.pan || ''}
                        onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono uppercase focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                    {formErrors.email && <p className="text-rose-500 text-[10px] mt-0.5">{formErrors.email[0]}</p>}
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formData.addressLine1 || ''}
                      onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                      placeholder="Office / godown address"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">City</label>
                      <input
                        type="text"
                        value={formData.addressCity || ''}
                        onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">State</label>
                      <input
                        type="text"
                        value={formData.addressState || ''}
                        onChange={(e) => setFormData({ ...formData, addressState: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Pincode</label>
                      <input
                        type="text"
                        value={formData.addressPincode || ''}
                        onChange={(e) => setFormData({ ...formData, addressPincode: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Vehicles Form */}
              {activeTab === 'vehicles' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Vehicle Number *</label>
                      <input
                        type="text"
                        required
                        value={formData.vehicleNumber || ''}
                        onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                        placeholder="e.g. GJ05AB1234"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg uppercase font-mono focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Vehicle Type</label>
                      <select
                        value={formData.vehicleType || 'Truck'}
                        onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="Truck">Truck</option>
                        <option value="Mini Truck / LCV">Mini Truck / LCV</option>
                        <option value="Trailer">Trailer</option>
                        <option value="Container">Container</option>
                        <option value="Tanker">Tanker</option>
                        <option value="Tempo">Tempo</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Capacity</label>
                      <input
                        type="text"
                        value={formData.capacity || ''}
                        onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                        placeholder="e.g. 5 Tons / 5000 Kg"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Transporter</label>
                      <select
                        value={formData.transporterId || ''}
                        onChange={(e) => setFormData({ ...formData, transporterId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="">Self / Own Fleet (None)</option>
                        {transportersList.map((tr) => (
                          <option key={tr.id} value={tr.id}>{tr.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                    <textarea
                      rows={2}
                      value={formData.remarks || ''}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      placeholder="Optional notes or permit details..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Rate Master Form */}
              {activeTab === 'rate-masters' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Rate Type *</label>
                      <select
                        value={formData.rateType || 'Sales'}
                        onChange={(e) => setFormData({ ...formData, rateType: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white font-semibold"
                      >
                        <option value="Sales">Sales Rate</option>
                        <option value="Purchase">Purchase Rate</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">Party (Optional Contract)</label>
                        <MasterSourceLink source="parties" />
                      </div>
                      <select
                        value={formData.partyId || ''}
                        onChange={(e) => setFormData({ ...formData, partyId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="">General / All Parties (Default)</option>
                        {partiesList.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.type || 'Party'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">Item / Catalog SKU</label>
                        <MasterSourceLink source="items" />
                      </div>
                      <select
                        value={formData.itemId || ''}
                        onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="">Generic / By Quality</option>
                        {itemsList.map((it) => (
                          <option key={it.id} value={it.id}>{it.name} ({it.sku})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">Fabric Quality</label>
                        <MasterSourceLink source="fabricQualities" />
                      </div>
                      <select
                        value={formData.fabricQualityId || ''}
                        onChange={(e) => setFormData({ ...formData, fabricQualityId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="">All Qualities</option>
                        {qualitiesList.map((q) => (
                          <option key={q.id} value={q.id}>{q.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">Design</label>
                        <MasterSourceLink source="designs" />
                      </div>
                      <select
                        value={formData.designId || ''}
                        onChange={(e) => setFormData({ ...formData, designId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="">All Designs</option>
                        {designsList.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">Colour / Shade</label>
                        <MasterSourceLink source="shades" />
                      </div>
                      <select
                        value={formData.shadeId || ''}
                        onChange={(e) => setFormData({ ...formData, shadeId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="">All Shades</option>
                        {shadesList.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Standard Rate (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.rate || ''}
                        onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                        placeholder="e.g. 150.00"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Min Selling Rate (₹)
                        <span className="text-[10px] text-slate-400 block font-normal">Margin Control</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.minSellingRate || ''}
                        onChange={(e) => setFormData({ ...formData, minSellingRate: e.target.value })}
                        placeholder="e.g. 135.00"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">UOM</label>
                      <input
                        type="text"
                        value={formData.uom || 'Meter'}
                        onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Valid From</label>
                      <input
                        type="date"
                        value={formData.validFrom || ''}
                        onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Valid To (Optional)</label>
                      <input
                        type="date"
                        value={formData.validTo || ''}
                        onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Notes / Terms</label>
                    <textarea
                      rows={2}
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Special discount structure, bulk threshold, party contract note..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Drivers Form */}
              {activeTab === 'drivers' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Driver Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Ramesh Bhai"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Mobile Number *</label>
                      <input
                        type="tel"
                        required
                        value={formData.mobile || ''}
                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                        placeholder="9876543210"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Driving Licence No</label>
                      <input
                        type="text"
                        value={formData.licence || ''}
                        onChange={(e) => setFormData({ ...formData, licence: e.target.value.toUpperCase() })}
                        placeholder="e.g. GJ05-20150001234"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono uppercase focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Transporter</label>
                      <select
                        value={formData.transporterId || ''}
                        onChange={(e) => setFormData({ ...formData, transporterId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                      >
                        <option value="">Direct / Independent (None)</option>
                        {transportersList.map((tr) => (
                          <option key={tr.id} value={tr.id}>{tr.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                    <textarea
                      rows={2}
                      value={formData.remarks || ''}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      placeholder="Optional notes or badge number..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* Description for Loss / Return reasons */}
              {(activeTab === 'loss-reasons' || activeTab === 'return-reasons') && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description / Notes</label>
                  <textarea
                    rows={3}
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={Boolean(formData.isActive)}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-xs font-medium text-slate-700">
                  Record is Active
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Centered Modern Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => !deleteConfirm.loading && setDeleteConfirm({ isOpen: false, id: null, name: '', loading: false })}
        onConfirm={handleConfirmDelete}
        title={`Delete ${activeTabMeta?.singular || 'Record'}`}
        message="Are you sure you want to delete this master record? This action cannot be undone."
        itemName={deleteConfirm.name}
        confirmText="Delete Record"
        cancelText="Cancel"
        variant="danger"
        loading={deleteConfirm.loading}
      />

      {/* Centered Modern Seed Confirmation Modal */}
      <ConfirmModal
        isOpen={seedConfirm.isOpen}
        onClose={() => !seedConfirm.loading && setSeedConfirm({ isOpen: false, missing: [], label: '', loading: false })}
        onConfirm={handleExecuteSeed}
        title="Load Standard List"
        message={`Add ${seedConfirm.missing.length} standard ${seedConfirm.label} entries from the requirement list to your masters registry?`}
        confirmText="Add Standard Entries"
        cancelText="Cancel"
        variant="primary"
        loading={seedConfirm.loading}
      />

      {/* Centered Feedback / Alert Dialog */}
      <ConfirmModal
        isOpen={feedbackModal.isOpen}
        onClose={() => setFeedbackModal({ isOpen: false, title: '', message: '', variant: 'info' })}
        onConfirm={() => setFeedbackModal({ isOpen: false, title: '', message: '', variant: 'info' })}
        title={feedbackModal.title}
        message={feedbackModal.message}
        confirmText="OK"
        cancelText="Close"
        variant={feedbackModal.variant}
      />
    </div>
  );
}
