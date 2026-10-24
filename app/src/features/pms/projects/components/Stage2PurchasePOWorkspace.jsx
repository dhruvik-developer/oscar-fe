import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  FileText,
  CheckCircle2,
  ExternalLink,
  Layers,
  AlertCircle,
  Calendar,
  Building,
  Clock,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  IndianRupee,
  Package,
} from 'lucide-react';
import { api } from '../../../../services/api';
import {
  getProjectPurchaseOrders,
  createProjectPurchaseOrder,
} from '../../../../services/pmsSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { useERP } from '../../../../context/ERPContext';
import MasterSourceLink from '../../../../components/common/MasterSourceLink';

export function Stage2PurchasePOWorkspace({
  project,
  stage,
  onSyncPipeline,
  onSelectStage,
}) {
  const showToast = usePmsStore((s) => s.showToast);
  const toast = useMemo(
    () => ({
      success: (msg) => showToast?.(msg, 'success'),
      error: (msg) => showToast?.(msg, 'error'),
      info: (msg) => showToast?.(msg, 'info'),
    }),
    [showToast]
  );

  const erp = useERP();
  const erpVendors = erp?.vendors || [];
  const erpParties = erp?.parties || [];
  const erpItems = erp?.items || [];

  const projectId = project?.id;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);

  // Create PO Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Success Confirmation Popup State
  const [createdPoSuccess, setCreatedPoSuccess] = useState(null);

  const shortageMeters = Number(
    project?.shortageMeters ??
      project?.pipelineSummary?.shortage_meters ??
      (project?.requirementMeters && project?.allocatedMeters
        ? Math.max(0, project.requirementMeters - project.allocatedMeters)
        : 0)
  );

  const [form, setForm] = useState({
    vendorId: '',
    itemId: '',
    quantity: shortageMeters || 1000,
    rate: 45.0,
    expectedDate: '',
    notes: '',
  });

  // Consolidated Vendor List with resilient fallbacks to ensure real DB data is always available
  const activeVendors = useMemo(() => {
    if (vendors && vendors.length > 0) return vendors;
    if (erpVendors && erpVendors.length > 0) return erpVendors;
    if (erpParties && erpParties.length > 0) {
      const vOnly = erpParties.filter((p) => {
        const t = (p.type || '').toLowerCase();
        return t === 'vendor' || t === 'both' || p.isProcessor || p.is_processor;
      });
      return vOnly.length > 0 ? vOnly : erpParties;
    }
    return [];
  }, [vendors, erpVendors, erpParties]);

  // Consolidated Fabric Item List with resilient fallbacks
  const activeItems = useMemo(() => {
    if (items && items.length > 0) return items;
    if (erpItems && erpItems.length > 0) return erpItems;
    return [];
  }, [items, erpItems]);

  // Load Real Master Vendors & Items from API endpoints
  const loadMasterData = async () => {
    try {
      const [vendorsRes, itemsRes] = await Promise.allSettled([
        api.get('/parties/vendors/').catch(() => api.get('/parties/')).catch(() => api.get('/masters/parties/vendors/')),
        api.get('/inventory/items/').catch(() => api.get('/masters/items/')),
      ]);

      if (vendorsRes.status === 'fulfilled' && vendorsRes.value) {
        const val = vendorsRes.value;
        const vList = Array.isArray(val) ? val : (val.results || val.data || []);
        if (vList.length > 0) {
          setVendors(vList);
        }
      }

      if (itemsRes.status === 'fulfilled' && itemsRes.value) {
        const val = itemsRes.value;
        const iList = Array.isArray(val) ? val : (val.results || val.data || []);
        if (iList.length > 0) {
          setItems(iList);
        }
      }
    } catch (err) {
      console.warn('Error fetching master vendors/items:', err);
    }
  };

  // Load Real Linked Purchase Orders & Available Vendors/Items from Backend
  const loadPurchaseOrders = async () => {
    if (!projectId) return;
    try {
      const res = await getProjectPurchaseOrders(projectId);
      if (res) {
        const list = Array.isArray(res) ? res : res.orders || res.data || res.results || [];
        setPurchaseOrders(list);

        if (Array.isArray(res.availableVendors) && res.availableVendors.length > 0) {
          setVendors((prev) => (prev.length > 0 ? prev : res.availableVendors));
        }
        if (Array.isArray(res.availableItems) && res.availableItems.length > 0) {
          setItems((prev) => (prev.length > 0 ? prev : res.availableItems));
        }
      }
    } catch (err) {
      console.warn('Error loading purchase orders:', err);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      loadPurchaseOrders().finally(() => setLoading(false));
    }
  }, [projectId]);

  // Auto-select first active vendor when available and form vendorId is not yet set
  useEffect(() => {
    if (activeVendors.length > 0 && !form.vendorId) {
      setForm((prev) => ({ ...prev, vendorId: activeVendors[0].id }));
    }
  }, [activeVendors, form.vendorId]);

  // Auto-select matching fabric item when available and form itemId is not yet set
  useEffect(() => {
    if (activeItems.length > 0 && !form.itemId) {
      const matched = activeItems.find(
        (i) =>
          (i.name || '').toLowerCase().includes('fabric') ||
          (i.itemKind || i.item_kind || '').toLowerCase() === 'fabric'
      );
      setForm((prev) => ({ ...prev, itemId: (matched || activeItems[0]).id }));
    }
  }, [activeItems, form.itemId]);

  // Update default quantity whenever shortageMeters changes
  useEffect(() => {
    if (shortageMeters > 0) {
      setForm((prev) => ({
        ...prev,
        quantity: shortageMeters,
        notes: prev.notes || `Grey fabric shortage procurement for Project ${project?.code || ''}`,
      }));
    }
  }, [shortageMeters, project?.code]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadPurchaseOrders();
      await loadMasterData();
      if (onSyncPipeline) await onSyncPipeline();
      toast.info('Purchase order list refreshed from database.');
    } catch (err) {
      toast.error('Failed to refresh: ' + (err?.message || 'Server error'));
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenCreateModal = () => {
    const defaultVendorId = form.vendorId || activeVendors[0]?.id || '';
    const matchedItem = activeItems.find(
      (i) =>
        (i.name || '').toLowerCase().includes('fabric') ||
        (i.itemKind || i.item_kind || '').toLowerCase() === 'fabric'
    );
    const defaultItemId = form.itemId || (matchedItem || activeItems[0])?.id || '';

    setForm({
      vendorId: defaultVendorId,
      itemId: defaultItemId,
      quantity: shortageMeters > 0 ? shortageMeters : 1000,
      rate: 45.0,
      expectedDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      notes: `Grey fabric shortage procurement for Project ${project?.code || ''}`,
    });
    setIsModalOpen(true);
  };

  const handleCreatePurchaseOrder = async (e) => {
    e?.preventDefault();
    if (!form.vendorId) {
      toast.error('Please select a supplier / vendor.');
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      toast.error('Please enter a valid quantity greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        vendorId: form.vendorId,
        itemId: form.itemId || undefined,
        quantity: Number(form.quantity),
        rate: Number(form.rate || 0),
        expectedDate: form.expectedDate || undefined,
        notes: form.notes,
      };

      const res = await createProjectPurchaseOrder(projectId, payload);
      const createdData = res?.data || res;

      toast.success(
        `Purchase Order ${createdData?.poNumber || ''} created successfully!`
      );

      // Close create form and show professional success modal
      setIsModalOpen(false);
      setCreatedPoSuccess(createdData);

      // Refresh list & pipeline
      await loadPurchaseOrders();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error('Failed to create Purchase Order: ' + (err?.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  // Stats calculation
  const totalOrderedQty = useMemo(() => {
    return purchaseOrders.reduce((sum, po) => sum + (Number(po.qty) || 0), 0);
  }, [purchaseOrders]);

  const totalPoValue = useMemo(() => {
    return purchaseOrders.reduce(
      (sum, po) => sum + (Number(po.grandTotal) || 0),
      0
    );
  }, [purchaseOrders]);

  const coveragePct =
    shortageMeters > 0
      ? Math.min(100, Math.round((totalOrderedQty / shortageMeters) * 100))
      : 100;

  return (
    <div className="space-y-4">
      {/* Stage Header Banner */}
      {/* 4 KPI Summary Cards */}
      <div className="rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl p-3 bg-rose-50/70 border border-rose-100">
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">
              Required Shortage
            </span>
            <p className="text-lg font-black text-rose-700 mt-0.5">
              {shortageMeters.toLocaleString('en-IN')} <span className="text-xs font-normal">m</span>
            </p>
            <p className="text-[10px] text-rose-500 mt-0.5">From Stage 1 stock analysis</p>
          </div>

          <div className="rounded-xl p-3 bg-blue-50/70 border border-blue-100">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
              Ordered in POs
            </span>
            <p className="text-lg font-black text-blue-700 mt-0.5">
              {totalOrderedQty.toLocaleString('en-IN')} <span className="text-xs font-normal">m</span>
            </p>
            <p className="text-[10px] text-blue-500 mt-0.5">Across {purchaseOrders.length} linked PO(s)</p>
          </div>

          <div className="rounded-xl p-3 bg-emerald-50/70 border border-emerald-100">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
              PO Coverage
            </span>
            <p className="text-lg font-black text-emerald-700 mt-0.5">
              {coveragePct}%
            </p>
            <p className="text-[10px] text-emerald-600 mt-0.5">
              {totalOrderedQty >= shortageMeters && shortageMeters > 0
                ? 'Full shortage covered'
                : `${Math.max(0, shortageMeters - totalOrderedQty).toLocaleString('en-IN')} m remaining`}
            </p>
          </div>

          <div className="rounded-xl p-3 bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Order Value
            </span>
            <p className="text-lg font-black text-slate-800 mt-0.5">
              ₹{totalPoValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Live ERP document total</p>
          </div>
        </div>
      </div>

      {/* Linked Purchase Orders Table Section */}
      <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#dce5f4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Linked Purchase Orders for Project ({purchaseOrders.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">
              Ref: <strong className="text-slate-800">{project?.code}</strong>
            </span>
          
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs cursor-pointer"
            >
              <Plus size={14} />
              <span>+ Create Purchase PO</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
            Loading real purchase orders from database...
          </div>
        ) : purchaseOrders.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100">
              <ShoppingCart size={22} />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No Purchase Orders Created Yet</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Click the button below to generate a real Purchase Order for the shortage quantity ({shortageMeters.toLocaleString('en-IN')} m) from your approved suppliers.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Create Purchase PO</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#dce5f4] bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3.5">PO Number</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Supplier / Vendor</th>
                  <th className="py-3 px-3">Fabric Quality / Item</th>
                  <th className="py-3 px-3 text-right">Qty (m)</th>
                  <th className="py-3 px-3 text-right">Rate (₹/m)</th>
                  <th className="py-3 px-3 text-right">Total Amount (₹)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseOrders.map((po) => {
                  const statusColors = {
                    Draft: 'bg-slate-100 text-slate-700 border-slate-200',
                    'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200',
                    Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    Issued: 'bg-blue-50 text-blue-700 border-blue-200',
                    'Partially Received': 'bg-purple-50 text-purple-700 border-purple-200',
                    'Fully Received': 'bg-teal-50 text-teal-700 border-teal-200',
                    Cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
                  };
                  const colorClass =
                    statusColors[po.status] || 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <tr key={po.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-3.5 font-bold text-blue-600 flex items-center gap-1.5">
                        <FileText size={14} className="shrink-0 text-slate-400" />
                        <span>{po.poNumber}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{po.docDate || '—'}</td>
                      <td className="py-3 px-3 font-medium text-slate-900">{po.vendorName || '—'}</td>
                      <td className="py-3 px-3 text-slate-600">{po.itemName || 'Grey Fabric'}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {Number(po.qty || 0).toLocaleString('en-IN')} m
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700">
                        ₹{Number(po.rate || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        ₹{Number(po.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${colorClass}`}>
                          {po.status || 'Draft'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <a
                          href={`/purchase/orders`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <span>View PO</span>
                          <ExternalLink size={11} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-200 text-xs">
                  <td colSpan={4} className="py-2.5 px-3.5 text-slate-600">
                    Total {purchaseOrders.length} Order(s)
                  </td>
                  <td className="py-2.5 px-3 text-right text-blue-700">
                    {totalOrderedQty.toLocaleString('en-IN')} m
                  </td>
                  <td className="py-2.5 px-3" />
                  <td className="py-2.5 px-3 text-right text-emerald-700">
                    ₹{totalPoValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      

      {/* CREATE PURCHASE PO MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Create Grey Purchase Order</h4>
                  <p className="text-[11px] text-slate-500">
                    Generates official PO linked to Project {project?.code}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePurchaseOrder} className="space-y-3.5">
              {/* Supplier Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Supplier / Vendor <span className="text-rose-500">*</span>
                  </label>
                  <MasterSourceLink source="vendors" />
                </div>
                <select
                  required
                  value={form.vendorId}
                  onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                >
                  <option value="" disabled>
                    -- Select Supplier / Vendor --
                  </option>
                  {activeVendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.code ? `(${v.code})` : ''} {v.type ? `• ${v.type}` : ''}
                    </option>
                  ))}
                </select>
                {activeVendors.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    No vendors found in database. Please create a vendor in Masters.
                  </p>
                )}
              </div>

              {/* Fabric Item Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Fabric Item / Quality <span className="text-rose-500">*</span>
                  </label>
                  <MasterSourceLink source="items" />
                </div>
                <select
                  required
                  value={form.itemId}
                  onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                >
                  <option value="" disabled>
                    -- Select Fabric Item --
                  </option>
                  {activeItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} {i.sku ? `[${i.sku}]` : ''} {i.itemKind || i.item_kind ? `(${i.itemKind || i.item_kind})` : ''}
                    </option>
                  ))}
                </select>
                {activeItems.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    No fabric items found in database. Please create an item in Inventory Masters.
                  </p>
                )}
              </div>

              {/* Quantity and Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Order Quantity (m) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Shortage balance: {shortageMeters.toLocaleString('en-IN')} m
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rate per Meter (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.rate}
                    onChange={(e) => setForm({ ...form, rate: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                    Est. Total: ₹{((Number(form.quantity) || 0) * (Number(form.rate) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Expected Delivery Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={form.expectedDate}
                  onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Internal Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Notes for purchase department..."
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {submitting && <RefreshCw size={13} className="animate-spin" />}
                  <span>{submitting ? 'Generating PO...' : 'Confirm & Generate PO'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUCCESS CONFIRMATION POPUP MODAL (As specifically requested by user) */}
      {createdPoSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-emerald-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Purchase Order Created!
              </h3>
              <p className="text-xs text-slate-500">
                The purchase order has been successfully generated and recorded in the database.
              </p>
            </div>

            {/* PO Details Card */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                <span className="text-slate-500 font-medium">Purchase Order No:</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-sm">
                  {createdPoSuccess.poNumber}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Supplier / Vendor:</span>
                <span className="font-bold text-slate-800">{createdPoSuccess.vendorName}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Fabric Quality / Item:</span>
                <span className="font-medium text-slate-800">{createdPoSuccess.itemName}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Ordered Quantity:</span>
                <span className="font-bold text-slate-900">
                  {Number(createdPoSuccess.quantity || 0).toLocaleString('en-IN')} m
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Unit Rate:</span>
                <span className="text-slate-800">₹{Number(createdPoSuccess.rate || 0).toFixed(2)}/m</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
                <span className="text-slate-700 font-bold">Total Order Value:</span>
                <span className="font-black text-emerald-700 text-sm">
                  ₹{Number(createdPoSuccess.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {createdPoSuccess.expectedDate && (
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Expected Delivery:</span>
                  <span>{createdPoSuccess.expectedDate}</span>
                </div>
              )}
            </div>

            {/* Popup Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <a
                href="/purchase/orders"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <span>View in Purchase Module</span>
                <ExternalLink size={12} />
              </a>

              <button
                type="button"
                onClick={() => setCreatedPoSuccess(null)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Done & View in Table</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stage2PurchasePOWorkspace;
