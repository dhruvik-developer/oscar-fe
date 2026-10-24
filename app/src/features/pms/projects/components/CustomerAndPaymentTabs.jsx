import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Boxes, Layers, ShoppingCart, Truck, Receipt, CheckCircle2,
  Clock, AlertCircle, ArrowUpRight, ShieldCheck, Factory, Warehouse,
  Building2, IndianRupee, FileText, RefreshCw, Eye, Tag, AlertTriangle,
  Check, DollarSign, Calendar, Plus, Printer, ExternalLink, X, ChevronRight,
  Info, CreditCard, Send, CheckSquare, Square
} from 'lucide-react';
import { formatCurrency } from '../../../../utils/currencyUtils';
import {
  fetchCustomerProjectDetails,
  fetchOwnProjectDetails,
  fetchStage16DispatchData,
  createStage16Dispatch,
  updateStage16DispatchLR,
  fetchStage17InvoiceData,
  createStage17Proforma,
  convertStage17Proforma,
  cancelStage17Proforma,
  createStage17FinalInvoice,
  recordStage17Payment,
  errorMessage,
} from '../../../../services/jobWorkSync';
import { usePmsStore } from '../../../../stores/pmsStore';

const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function Card({ title, icon: Icon, badge, children }) {
  return (
    <div className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Icon size={14} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-800',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    purple: 'text-purple-600',
    rose: 'text-rose-600',
  };
  return (
    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
      <div className={`text-base font-black mt-0.5 ${tones[tone] || tones.slate}`}>{value ?? '—'}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

/**
 * CustomerProjectTab — Order & requirement fulfillment for the customer (Part 2)
 */
export function CustomerProjectTab({ project }) {
  const projectId = project?.id;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetchCustomerProjectDetails(projectId);
      setData(res?.data || res);
    } catch (err) {
      console.warn('Failed to fetch customer project details:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fallback calculations if loading or network error
  const summary = data?.summary || {
    customerRequirement: Number(project.productDetails?.quantity ?? project.quantity ?? project.requirementMeters ?? 0),
    customerAllocatedFabric: Number(project.pipelineSummary?.allocated_stock_qty || 0),
    processingPlanned: Number(project.requirementMeters || project.quantity || 0),
    sentForProcessing: Number(project.dyeingSentMeters || 0),
    processingInward: Number(project.customerProjectReceivedMeters || 0),
    qcPassedQuantity: Number(project.customerProjectReceivedMeters || 0),
    dispatchedQuantity: Number(project.dispatchedMeters || 0),
    remainingRequirement: Math.max(0, Number(project.requirementMeters || project.quantity || 0) - Number(project.dispatchedMeters || 0)),
  };

  const orderDetails = data?.customerOrderDetails || {
    customerName: project.customerName || 'Direct Customer',
    salesOrderNumber: project.salesOrder?.order_number || project.crmOrderId || project.code,
    fabricQuality: project.productDetails?.fabricQuality || project.fabricQuality || project.productName || 'Custom Quality',
    design: project.productDetails?.designNo || project.designNo || 'Standard',
    shade: project.productDetails?.shade || project.shade || 'Standard',
    width: project.productDetails?.width || '44 inches',
    requiredQuantity: summary.customerRequirement,
    deliveryDate: project.expectedCompletionDate || project.dueDate,
    orderStatus: project.status || 'Active',
  };

  const allocations = data?.fabricAllocations || [];
  const processingTracking = data?.processingTracking || [];
  const qcAndFulfilment = data?.qcAndFulfilment || {};
  const dispatches = qcAndFulfilment.dispatches || [];

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Package className="text-blue-600" size={18} />
            <span>Customer Project — Order Fulfillment & Traceability</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Traceable reservation, processing, QC, and dispatch records for Customer: <span className="font-semibold text-slate-700">{orderDetails.customerName}</span>
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 1. 8 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Stat
          label="1. Customer Requirement"
          value={`${n(summary.customerRequirement)} m`}
          sub="Customer target order"
          tone="blue"
        />
        <Stat
          label="2. Customer-Allocated"
          value={`${n(summary.customerAllocatedFabric)} m`}
          sub="Reserved from Grey Stock"
          tone="emerald"
        />
        <Stat
          label="3. Processing Planned"
          value={`${n(summary.processingPlanned)} m`}
          sub="Assigned in Stage 11"
          tone="slate"
        />
        <Stat
          label="4. Sent for Processing"
          value={`${n(summary.sentForProcessing)} m`}
          sub="Stage 12 Outward to Mill"
          tone="purple"
        />
        <Stat
          label="5. Processing Inward"
          value={`${n(summary.processingInward)} m`}
          sub="Received from Processor"
          tone="amber"
        />
        <Stat
          label="6. QC-Passed Quantity"
          value={`${n(summary.qcPassedQuantity)} m`}
          sub="Passed inspection"
          tone="emerald"
        />
        <Stat
          label="7. Dispatched Quantity"
          value={`${n(summary.dispatchedQuantity)} m`}
          sub="Delivered with Challan & LR"
          tone="blue"
        />
        <Stat
          label="8. Remaining Requirement"
          value={`${n(summary.remainingRequirement)} m`}
          sub={summary.remainingRequirement === 0 ? '100% Fulfilled' : 'Pending Fulfillment'}
          tone={summary.remainingRequirement === 0 ? 'emerald' : 'rose'}
        />
      </div>

      {/* 2. Customer & Order Details */}
      <Card title="Customer & Order Specifications" icon={Building2}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Customer Name</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">{orderDetails.customerName}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Sales Order / Ref</span>
            <span className="font-mono font-bold text-blue-600 text-sm mt-0.5 block">
              {orderDetails.salesOrderNumber || '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Fabric Quality & Specs</span>
            <span className="font-semibold text-slate-800 block mt-0.5">{orderDetails.fabricQuality}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Design & Shade / Color</span>
            <span className="font-semibold text-slate-800 block mt-0.5">{orderDetails.design} / {orderDetails.shade}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Width & Construction</span>
            <span className="font-semibold text-slate-700 block mt-0.5">{orderDetails.width}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Agreed Delivery Date</span>
            <span className="font-semibold text-slate-700 block mt-0.5">
              {orderDetails.deliveryDate ? new Date(orderDetails.deliveryDate).toLocaleDateString('en-GB') : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Order Value</span>
            <span className="font-bold text-emerald-700 block mt-0.5 font-mono">
              {formatCurrency(project.productDetails?.orderValue ?? project.budget ?? 0)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Current Order Status</span>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
              {orderDetails.orderStatus}
            </span>
          </div>
        </div>
      </Card>

      {/* 3. Fabric Allocation Table */}
      <Card title="Grey Fabric Allocation Register (Customer Reserved Stock)" icon={Boxes}>
        {allocations.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">Source PO / GRN</th>
                  <th className="p-3">Fabric Item / Quality</th>
                  <th className="p-3">Lot Number</th>
                  <th className="p-3">Taka / Roll</th>
                  <th className="p-3 text-right">Allocated Qty</th>
                  <th className="p-3 text-right">Available Qty</th>
                  <th className="p-3">Warehouse Location</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allocations.map((a, idx) => (
                  <tr key={a.id || idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-semibold text-blue-600">{a.sourcePo || 'Direct Stock'}</td>
                    <td className="p-3 font-semibold text-slate-900">{a.fabricItem} ({a.fabricQuality})</td>
                    <td className="p-3 font-mono">{a.lotNumber}</td>
                    <td className="p-3 font-mono">{a.takaNumber}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">{n(a.allocatedQty)} m</td>
                    <td className="p-3 text-right font-mono text-slate-600">{n(a.availableQty)} m</td>
                    <td className="p-3 text-slate-600">{a.location}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No specific piece-by-piece takas earmarked directly in database yet. Allocate grey stock in Stage 1.
          </div>
        )}
      </Card>

      {/* 4. Processing Tracking Table */}
      <Card title="Processing & Vendor Tracking (Stage 11–14)" icon={Factory}>
        {processingTracking.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">JWO Number</th>
                  <th className="p-3">Process Type</th>
                  <th className="p-3">Processor / Vendor B</th>
                  <th className="p-3 text-right">Planned Qty</th>
                  <th className="p-3 text-right">Outward Qty</th>
                  <th className="p-3 text-right">Inward Qty</th>
                  <th className="p-3 text-right">Pending Qty</th>
                  <th className="p-3 text-right">Rate (₹/m)</th>
                  <th className="p-3 text-center">Loss %</th>
                  <th className="p-3">Return Due</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processingTracking.map((p, idx) => (
                  <tr key={p.jwoNo || idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-blue-600">{p.jwoNo}</td>
                    <td className="p-3 font-semibold text-slate-800">{p.process}</td>
                    <td className="p-3 text-slate-700">{p.vendorName}</td>
                    <td className="p-3 text-right font-mono">{n(p.plannedQty)} m</td>
                    <td className="p-3 text-right font-mono font-semibold text-purple-700">{n(p.outwardQty)} m</td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-700">{n(p.inwardQty)} m</td>
                    <td className="p-3 text-right font-mono font-bold text-amber-700">{n(p.pendingQty)} m</td>
                    <td className="p-3 text-right font-mono">₹{n(p.rate)}</td>
                    <td className="p-3 text-center font-mono">{n(p.expectedLoss)}%</td>
                    <td className="p-3 text-slate-600">{p.expectedReturnDate || '—'}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No processing orders recorded for this customer requirement yet.
          </div>
        )}
      </Card>

      {/* 5. QC & Customer Fulfilment */}
      <Card title="Quality Inspection & Customer Dispatch Records" icon={Truck}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 mb-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">QC Passed Qty</span>
            <span className="font-bold text-emerald-700 text-sm mt-0.5 block">{n(qcAndFulfilment.qcPassedQuantity)} m</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">QC Rejected Qty</span>
            <span className="font-bold text-rose-700 text-sm mt-0.5 block">{n(qcAndFulfilment.rejectedQuantity)} m</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Payment Status</span>
            <span className="font-bold text-blue-700 text-sm mt-0.5 block">{qcAndFulfilment.paymentStatus || 'Pending'}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Fulfilment Balance</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">{n(qcAndFulfilment.customerFulfilmentBalance)} m</span>
          </div>
        </div>

        {dispatches.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">Delivery Challan</th>
                  <th className="p-3">Dispatch Date</th>
                  <th className="p-3 text-right">Dispatched Qty</th>
                  <th className="p-3">Transporter</th>
                  <th className="p-3">LR / Consignment No</th>
                  <th className="p-3">Destination</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dispatches.map((d, idx) => (
                  <tr key={d.id || idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-blue-600">{d.challanNo}</td>
                    <td className="p-3 text-slate-600">{d.date || '—'}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">{n(d.quantity)} m</td>
                    <td className="p-3 text-slate-700">{d.transporter || 'Direct Delivery'}</td>
                    <td className="p-3 font-mono text-slate-600">{d.lrNumber || '—'}</td>
                    <td className="p-3 text-slate-600">{d.destination}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No customer dispatch delivery challans generated yet. Dispatches occur in Stage 16.
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * OwnProjectTab — Buffer inventory & extra company stock allocation (Part 3)
 */
export function OwnProjectTab({ project }) {
  const projectId = project?.id;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetchOwnProjectDetails(projectId);
      setData(res?.data || res);
    } catch (err) {
      console.warn('Failed to fetch own project details:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = data?.summary || {
    extraFabricAllocated: Number(project.pipelineSummary?.own_stock_allocated || 0),
    processingPlanned: 0,
    sentForProcessing: 0,
    processingInward: 0,
    qcPassedQuantity: 0,
    processingLoss: 0,
    availableOwnStock: Number(project.pipelineSummary?.own_stock_allocated || 0),
  };

  const ownStockDetails = data?.ownStockDetails || [];
  const ownProcessingPlans = data?.ownProcessingPlans || [];
  const ownInventoryTracking = data?.ownInventoryTracking || {
    inwardQuantity: summary.processingInward,
    qcPassedQuantity: summary.qcPassedQuantity,
    rejectedQuantity: 0,
    reprocessingQuantity: 0,
    actualProcessingLoss: summary.processingLoss,
    availableForFutureSales: summary.availableOwnStock,
    inventoryValuation: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Layers className="text-purple-600" size={18} />
            <span>Own Project — Buffer Stock & Company Inventory Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bulk purchased surplus fabric retained for future sales and warehouse inventory buffering.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Strict Accounting Policy Banner */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-900">
        <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">Strict ERP Inventory Separation Rules</span>
          <span className="text-blue-800 leading-relaxed block mt-0.5">
            1. Surplus fabric retained under Own Project is NOT counted as an unfulfilled customer requirement.
            2. Vendor-held fabric is tracked as external WIP and only enters available warehouse stock after inward receipt and QC approval.
            3. The same physical meter cannot be double-counted in both Customer Project and Own Project.
          </span>
        </div>
      </div>

      {/* 1. 7 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat
          label="1. Extra Fabric"
          value={`${n(summary.extraFabricAllocated)} m`}
          sub="Company Allocation"
          tone="purple"
        />
        <Stat
          label="2. Planned"
          value={`${n(summary.processingPlanned)} m`}
          sub="In Process Plans"
          tone="slate"
        />
        <Stat
          label="3. Sent Outward"
          value={`${n(summary.sentForProcessing)} m`}
          sub="At Processor Mill"
          tone="blue"
        />
        <Stat
          label="4. Inward Rcvd"
          value={`${n(summary.processingInward)} m`}
          sub="Received from Mill"
          tone="amber"
        />
        <Stat
          label="5. QC Passed"
          value={`${n(summary.qcPassedQuantity)} m`}
          sub="Accepted Quality"
          tone="emerald"
        />
        <Stat
          label="6. Process Loss"
          value={`${n(summary.processingLoss)} m`}
          sub="Shrinkage / Loss"
          tone="rose"
        />
        <Stat
          label="7. Available Stock"
          value={`${n(summary.availableOwnStock)} m`}
          sub="Free for Future Sales"
          tone="emerald"
        />
      </div>

      {/* 2. Own Stock Details Table */}
      <Card title="Own Stock Inventory Details (Warehouse Physical Takas)" icon={Warehouse}>
        {ownStockDetails.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">Source PO / GRN</th>
                  <th className="p-3">Fabric Item / Quality</th>
                  <th className="p-3">Lot Number</th>
                  <th className="p-3">Taka / Roll</th>
                  <th className="p-3 text-right">Allocated Qty</th>
                  <th className="p-3 text-right">Available Qty</th>
                  <th className="p-3 text-right">Standard Valuation</th>
                  <th className="p-3">Godown Location</th>
                  <th className="p-3 text-center">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ownStockDetails.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-semibold text-blue-600">{s.sourcePo || 'Direct PO'}</td>
                    <td className="p-3 font-semibold text-slate-900">{s.fabricItem} ({s.fabricQuality})</td>
                    <td className="p-3 font-mono">{s.lotNumber}</td>
                    <td className="p-3 font-mono">{s.takaNumber}</td>
                    <td className="p-3 text-right font-mono font-bold text-purple-700">{n(s.allocatedQty)} m</td>
                    <td className="p-3 text-right font-mono text-slate-600">{n(s.availableQty)} m</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 font-mono">
                      {formatCurrency(s.valuation || 0)}
                    </td>
                    <td className="p-3 text-slate-600">{s.location}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No surplus grey stock allocated to Own Project for this project. All purchased stock is earmarked for customer requirement.
          </div>
        )}
      </Card>

      {/* 3. Own Processing Plans Table */}
      <Card title="Own Project Processing Plans (Stage 11–13)" icon={Factory}>
        {ownProcessingPlans.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">JWO Number</th>
                  <th className="p-3">Process</th>
                  <th className="p-3">Vendor / Processor</th>
                  <th className="p-3 text-right">Planned Qty</th>
                  <th className="p-3 text-right">Outward Qty</th>
                  <th className="p-3 text-right">Inward Qty</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-center">Loss %</th>
                  <th className="p-3">Expected Return</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ownProcessingPlans.map((p, idx) => (
                  <tr key={p.jwoNo || idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-purple-600">{p.jwoNo}</td>
                    <td className="p-3 font-semibold text-slate-800">{p.process}</td>
                    <td className="p-3 text-slate-700">{p.vendorName}</td>
                    <td className="p-3 text-right font-mono">{n(p.plannedQty)} m</td>
                    <td className="p-3 text-right font-mono font-bold text-blue-700">{n(p.outwardQty)} m</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">{n(p.inwardQty)} m</td>
                    <td className="p-3 text-right font-mono">₹{n(p.rate)}</td>
                    <td className="p-3 text-center font-mono">{n(p.expectedLoss)}%</td>
                    <td className="p-3 text-slate-600">{p.expectedReturnDate || '—'}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No dedicated Own Project processing plans created yet.
          </div>
        )}
      </Card>

      {/* 4. Own Inventory Tracking & Valuation */}
      <Card title="Own Inventory Tracking & Commercial Valuation" icon={DollarSign}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Actual Inward Quantity</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">{n(ownInventoryTracking.inwardQuantity)} m</span>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[11px]">QC-Passed Stock</span>
            <span className="font-bold text-emerald-700 text-sm mt-0.5 block">{n(ownInventoryTracking.qcPassedQuantity)} m</span>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Free Stock for Future Sales</span>
            <span className="font-bold text-blue-700 text-sm mt-0.5 block">{n(ownInventoryTracking.availableForFutureSales)} m</span>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Inventory Asset Valuation</span>
            <span className="font-bold text-emerald-800 text-sm mt-0.5 block font-mono">
              {formatCurrency(ownInventoryTracking.inventoryValuation || 0)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * PaymentDispatchTab — Comprehensive Billing, Payments, and Customer Delivery Tracking
 * 100% connected to real database records via existing OSCAR PMS, Sales, and Accounts APIs.
 */
export function PaymentDispatchTab({ project }) {
  const showToast = usePmsStore((s) => s.showToast);
  const toast = React.useMemo(
    () => ({
      success: (msg) => showToast?.(msg, 'success'),
      error: (msg) => showToast?.(msg, 'error'),
      info: (msg) => showToast?.(msg, 'info'),
      warning: (msg) => showToast?.(msg, 'warning'),
    }),
    [showToast]
  );

  const projectId = project?.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dispatchData, setDispatchData] = useState({
    eligibleTakas: [],
    challans: [],
    locations: [],
    summary: {},
  });
  const [invoiceData, setInvoiceData] = useState({
    dispatches: [],
    proformas: [],
    finalInvoices: [],
    payments: [],
    bankAccounts: [],
    summary: {},
    salesOrder: null,
  });

  // Active sub-tab in Invoicing section: 'proforma' | 'final' | 'payments'
  const [invoiceSubTab, setInvoiceSubTab] = useState('final');

  // Modals state
  const [isDispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [isLrModalOpen, setLrModalOpen] = useState(false);
  const [selectedChallanForLr, setSelectedChallanForLr] = useState(null);
  const [isProformaModalOpen, setProformaModalOpen] = useState(false);
  const [isFinalInvoiceModalOpen, setFinalInvoiceModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [dispatchForm, setDispatchForm] = useState({
    dispatchDate: new Date().toISOString().split('T')[0],
    challanNumber: `DC-${Date.now().toString().slice(-5)}`,
    transporter: 'V-Trans Logistics',
    vehicleNo: 'GJ-05-AX-9912',
    lrNo: `LR-${Date.now().toString().slice(-5)}`,
    destination: project?.customerName || 'Customer Central Warehouse',
    remarks: `Customer order delivery for project ${project?.code || ''}`,
    selectedTakaIds: {},
  });

  const [lrForm, setLrForm] = useState({
    transporter: '',
    lrNo: '',
    vehicleNo: '',
    remarks: '',
  });

  const [proformaForm, setProformaForm] = useState({
    challanId: '',
    date: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    quantity: '',
    unitRate: 120,
    taxPercent: 5,
    notes: 'Proforma quotation for advance payment request.',
  });

  const [finalInvoiceForm, setFinalInvoiceForm] = useState({
    challanId: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    quantity: '',
    unitRate: 120,
    taxPercent: 5,
    notes: `Official tax sales invoice for project ${project?.code || ''}`,
  });

  const [paymentForm, setPaymentForm] = useState({
    invoiceId: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    mode: 'Bank Transfer',
    bankAccountId: '',
    referenceNo: `UTR-${Date.now().toString().slice(-6)}`,
    notes: 'Customer sales invoice receivable receipt.',
  });

  // Load all live data
  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [dispRes, invRes] = await Promise.allSettled([
        fetchStage16DispatchData(projectId),
        fetchStage17InvoiceData(projectId),
      ]);

      if (dispRes.status === 'fulfilled' && dispRes.value) {
        setDispatchData(dispRes.value?.data || dispRes.value || {});
      }
      if (invRes.status === 'fulfilled' && invRes.value) {
        setInvoiceData(invRes.value?.data || invRes.value || {});
      }
    } catch (err) {
      console.warn('Failed to load payment & dispatch data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    toast.info('Payment & Dispatch records refreshed.');
  };

  // Metrics & summaries
  const requiredMeters = Number(project?.requirementMeters || project?.quantity || 3000);
  const eligibleTakas = dispatchData?.eligibleTakas || [];
  const qcPassedMeters = eligibleTakas.reduce((acc, t) => acc + Number(t.availableQty || t.quantity || 0), 0);
  const challans = dispatchData?.challans || [];
  const totalDispatchedQty = challans.reduce((acc, c) => acc + Number(c.totalQty || c.dispatchedQty || 0), 0);
  const remainingCustomerQty = Math.max(0, requiredMeters - totalDispatchedQty);

  const orderValue = Number(invoiceData?.salesOrder?.total || project?.productDetails?.orderValue || project?.budget || (requiredMeters * 120));
  const proformas = invoiceData?.proformas || [];
  const finalInvoices = invoiceData?.finalInvoices || [];
  const payments = invoiceData?.payments || [];
  const bankAccounts = invoiceData?.bankAccounts || [];

  const totalInvoicedAmount = finalInvoices.reduce((acc, inv) => acc + Number(inv.grandTotal || inv.total || 0), 0);
  const totalPaidAmount = finalInvoices.reduce((acc, inv) => acc + Number(inv.amountPaid || inv.amount_paid || 0), 0);
  const totalOutstandingBalance = Math.max(0, totalInvoicedAmount - totalPaidAmount);

  const ownStockAllocated = Number(
    project?.ownProjectTotalMeters ||
    project?.pipelineSummary?.own_stock_allocated ||
    0
  );

  // ── Dispatch Handlers ──
  const handleOpenCreateDispatch = () => {
    const initialMap = {};
    let runningSum = 0;
    eligibleTakas.forEach((t) => {
      if (runningSum < remainingCustomerQty) {
        const toTake = Math.min(Number(t.availableQty || 0), remainingCustomerQty - runningSum);
        if (toTake > 0) {
          initialMap[t.id] = toTake;
          runningSum += toTake;
        }
      }
    });

    setDispatchForm({
      dispatchDate: new Date().toISOString().split('T')[0],
      challanNumber: `DC-${Date.now().toString().slice(-5)}`,
      transporter: 'V-Trans Logistics',
      vehicleNo: 'GJ-05-AX-9912',
      lrNo: `LR-${Date.now().toString().slice(-5)}`,
      destination: project?.customerName || 'Customer Central Warehouse',
      remarks: `Customer delivery for project ${project?.code || ''}`,
      selectedTakaIds: initialMap,
    });
    setDispatchModalOpen(true);
  };

  const handleToggleTakaSelect = (takaId, maxQty) => {
    setDispatchForm((prev) => {
      const current = prev.selectedTakaIds[takaId];
      const updated = { ...prev.selectedTakaIds };
      if (current !== undefined) {
        delete updated[takaId];
      } else {
        updated[takaId] = maxQty;
      }
      return { ...prev, selectedTakaIds: updated };
    });
  };

  const handleUpdateTakaQty = (takaId, val, maxQty) => {
    const num = Math.min(maxQty, Math.max(0, Number(val) || 0));
    setDispatchForm((prev) => ({
      ...prev,
      selectedTakaIds: {
        ...prev.selectedTakaIds,
        [takaId]: num,
      },
    }));
  };

  const totalSelectedDispatchQty = Object.values(dispatchForm.selectedTakaIds).reduce(
    (acc, q) => acc + Number(q || 0),
    0
  );

  const handleSaveDispatch = async (e) => {
    e.preventDefault();
    if (totalSelectedDispatchQty <= 0) {
      toast.error('Please select at least one QC-passed taka with quantity greater than 0.');
      return;
    }
    if (totalSelectedDispatchQty > remainingCustomerQty) {
      toast.error(`Dispatch quantity cannot exceed remaining customer requirement (${remainingCustomerQty.toLocaleString('en-IN')} m).`);
      return;
    }

    setSubmitting(true);
    try {
      const takasPayload = Object.entries(dispatchForm.selectedTakaIds)
        .filter(([_, q]) => Number(q) > 0)
        .map(([id, q]) => ({
          lot_taka_id: id,
          meters: Number(q),
        }));

      await createStage16Dispatch(projectId, {
        challan_number: dispatchForm.challanNumber,
        dispatch_date: dispatchForm.dispatchDate,
        transporter: dispatchForm.transporter,
        vehicle_no: dispatchForm.vehicleNo,
        lr_number: dispatchForm.lrNo,
        destination: dispatchForm.destination,
        remarks: dispatchForm.remarks,
        takas: takasPayload,
      });

      toast.success(`Delivery Challan ${dispatchForm.challanNumber} created successfully! ${totalSelectedDispatchQty} m dispatched.`);
      setDispatchModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to create customer delivery challan.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenUpdateLr = (ch) => {
    setSelectedChallanForLr(ch);
    setLrForm({
      transporter: ch.transporter || '',
      lrNo: ch.lrNumber || ch.lr_number || '',
      vehicleNo: ch.vehicleNumber || ch.vehicle_no || '',
      remarks: ch.remarks || '',
    });
    setLrModalOpen(true);
  };

  const handleSaveLrUpdate = async (e) => {
    e.preventDefault();
    if (!selectedChallanForLr) return;
    setSubmitting(true);
    try {
      await updateStage16DispatchLR(projectId, {
        challan_id: selectedChallanForLr.id,
        transporter: lrForm.transporter,
        lr_number: lrForm.lrNo,
        vehicle_no: lrForm.vehicleNo,
        remarks: lrForm.remarks,
      });
      toast.success('Transporter & LR details updated successfully.');
      setLrModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update LR details.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Proforma Invoice Handlers ──
  const handleOpenCreateProforma = () => {
    const defaultChallan = challans[0];
    setProformaForm({
      challanId: defaultChallan?.id || '',
      date: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      quantity: defaultChallan ? defaultChallan.totalQty : remainingCustomerQty,
      unitRate: 120,
      taxPercent: 5,
      notes: 'Proforma invoice for payment advance request. Not a final tax document.',
    });
    setProformaModalOpen(true);
  };

  const handleSaveProforma = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const qty = Number(proformaForm.quantity) || 0;
      const rate = Number(proformaForm.unitRate) || 0;
      const taxPct = Number(proformaForm.taxPercent) || 0;
      const taxable = qty * rate;
      const tax = (taxable * taxPct) / 100;
      const total = taxable + tax;

      await createStage17Proforma(projectId, {
        proforma_number: `PI-${Date.now().toString().slice(-5)}`,
        doc_date: proformaForm.date,
        valid_until: proformaForm.validUntil,
        challan_id: proformaForm.challanId || undefined,
        quantity: qty,
        rate: rate,
        taxable_amount: taxable,
        tax_amount: tax,
        grand_total: total,
        notes: proformaForm.notes,
      });

      toast.success('Proforma Invoice created successfully (no accounting entry posted).');
      setProformaModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to create proforma invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertProforma = async (pi) => {
    if (!window.confirm(`Convert Proforma Invoice ${pi.proformaNumber || pi.proforma_number} into an official Tax Sales Invoice? This will post general ledger accounting entries.`)) return;
    setSubmitting(true);
    try {
      await convertStage17Proforma(projectId, pi.id);
      toast.success(`Proforma ${pi.proformaNumber} successfully converted to official Sales Tax Invoice!`);
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to convert proforma invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelProforma = async (pi) => {
    const reason = window.prompt('Enter cancellation reason:', 'Customer requested revised quote');
    if (reason === null) return;
    setSubmitting(true);
    try {
      await cancelStage17Proforma(projectId, pi.id, reason);
      toast.info(`Proforma ${pi.proformaNumber} cancelled.`);
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to cancel proforma invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Final Invoice Handlers ──
  const handleOpenCreateFinalInvoice = () => {
    const defaultChallan = challans[0];
    setFinalInvoiceForm({
      challanId: defaultChallan?.id || '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      quantity: defaultChallan ? defaultChallan.totalQty : (totalDispatchedQty || requiredMeters),
      unitRate: 120,
      taxPercent: 5,
      notes: `Official Sales Tax Invoice for Project ${project?.code || ''}`,
    });
    setFinalInvoiceModalOpen(true);
  };

  const handleSaveFinalInvoice = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const qty = Number(finalInvoiceForm.quantity) || 0;
      const rate = Number(finalInvoiceForm.unitRate) || 0;
      const taxPct = Number(finalInvoiceForm.taxPercent) || 0;
      const taxable = qty * rate;
      const tax = (taxable * taxPct) / 100;
      const total = taxable + tax;

      await createStage17FinalInvoice(projectId, {
        invoice_number: `INV-${Date.now().toString().slice(-5)}`,
        invoice_date: finalInvoiceForm.date,
        due_date: finalInvoiceForm.dueDate,
        challan_id: finalInvoiceForm.challanId || undefined,
        quantity: qty,
        rate: rate,
        taxable_amount: taxable,
        tax_amount: tax,
        grand_total: total,
        notes: finalInvoiceForm.notes,
      });

      toast.success('Final Sales Invoice created! Posted to Accounts Receivable ledger.');
      setFinalInvoiceModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to create final sales invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Payment Handlers ──
  const handleOpenRecordPayment = (inv = null) => {
    const targetInv = inv || finalInvoices.find((i) => Number(i.outstandingBalance || i.balance || 0) > 0) || finalInvoices[0];
    setSelectedInvoiceForPay(targetInv);
    const maxPayable = targetInv ? Number(targetInv.outstandingBalance || targetInv.balance || targetInv.grandTotal || 0) : totalOutstandingBalance;
    setPaymentForm({
      invoiceId: targetInv?.id || '',
      date: new Date().toISOString().split('T')[0],
      amount: String(maxPayable > 0 ? maxPayable : 10000),
      mode: 'Bank Transfer',
      bankAccountId: bankAccounts[0]?.id || '',
      referenceNo: `UTR-${Date.now().toString().slice(-6)}`,
      notes: `Receivable collection for invoice ${targetInv?.invoiceNumber || targetInv?.invoice_number || ''}`,
    });
    setPaymentModalOpen(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    const amt = Number(paymentForm.amount) || 0;
    if (amt <= 0) {
      toast.error('Payment amount must be greater than zero.');
      return;
    }

    const linkedInvoice = finalInvoices.find((i) => String(i.id) === String(paymentForm.invoiceId));
    const outstanding = linkedInvoice ? Number(linkedInvoice.outstandingBalance || linkedInvoice.balance || 0) : totalOutstandingBalance;

    if (outstanding > 0 && amt > outstanding) {
      toast.error(`Payment amount (₹${amt}) cannot exceed the outstanding balance (₹${outstanding}).`);
      return;
    }

    setSubmitting(true);
    try {
      await recordStage17Payment(projectId, {
        invoice_id: paymentForm.invoiceId || undefined,
        payment_date: paymentForm.date,
        amount: amt,
        payment_mode: paymentForm.mode,
        bank_account_id: paymentForm.bankAccountId || undefined,
        reference_no: paymentForm.referenceNo,
        notes: paymentForm.notes,
      });

      toast.success(`Payment voucher of ₹${amt.toLocaleString('en-IN')} recorded successfully!`);
      setPaymentModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to record payment entry.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Toolbar ── */}
      <div className="rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Truck size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Customer Payment & Dispatch Management
            </h3>
            <p className="text-xs text-slate-500">
              Traceable QC dispatch, Delivery Challans, Sales Invoices, and Payment Collections for project <strong className="text-slate-700">{project?.code}</strong>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs cursor-pointer self-start sm:self-center"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin text-blue-600' : ''} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* ── 1. Top 5 Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 text-xs">
        <div className="p-3.5 rounded-xl bg-white border border-[#dce5f4] shadow-2xs">
          <span className="text-[10.5px] font-semibold text-slate-400 block uppercase tracking-wider">
            Customer Order Value
          </span>
          <span className="font-mono font-black text-slate-900 text-base mt-1 block">
            {formatCurrency(orderValue)}
          </span>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block truncate">
            {invoiceData?.salesOrder?.order_number ? `SO: ${invoiceData.salesOrder.order_number}` : 'Agreed Sales Value'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#dce5f4] shadow-2xs">
          <span className="text-[10.5px] font-semibold text-slate-400 block uppercase tracking-wider">
            Customer Dispatch
          </span>
          <span className="font-mono font-black text-blue-700 text-base mt-1 block">
            {totalDispatchedQty.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-500">/ {requiredMeters.toLocaleString('en-IN')} m</span>
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 border ${
            totalDispatchedQty >= requiredMeters ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {totalDispatchedQty >= requiredMeters ? '100% Fully Dispatched' : `${Math.round((totalDispatchedQty / requiredMeters) * 100)}% Dispatched`}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#dce5f4] shadow-2xs">
          <span className="text-[10.5px] font-semibold text-slate-400 block uppercase tracking-wider">
            Final Invoiced Total
          </span>
          <span className="font-mono font-black text-purple-700 text-base mt-1 block">
            ₹ {totalInvoicedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10.5px] text-purple-600 mt-0.5 block">
            {finalInvoices.length} Final Tax Invoice(s)
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#dce5f4] shadow-2xs">
          <span className="text-[10.5px] font-semibold text-slate-400 block uppercase tracking-wider">
            Payment Status
          </span>
          <span className="font-mono font-black text-emerald-700 text-base mt-1 block">
            ₹ {totalPaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block truncate">
            Outstanding: <strong className={totalOutstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-700'}>₹ {totalOutstandingBalance.toLocaleString('en-IN')}</strong>
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#dce5f4] shadow-2xs col-span-2 md:col-span-1">
          <span className="text-[10.5px] font-semibold text-slate-400 block uppercase tracking-wider">
            Own Project / Surplus
          </span>
          <span className="font-mono font-black text-indigo-700 text-base mt-1 block">
            {ownStockAllocated.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-500">m</span>
          </span>
          <span className="text-[10.5px] text-slate-500 mt-0.5 block">
            Traceable Usable Stock
          </span>
        </div>
      </div>

      {/* ── 2. Customer Dispatch Records Section ── */}
      <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#dce5f4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Customer Delivery Challan & Dispatch Records
              </h3>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
              <span>Required: <strong className="text-slate-700">{requiredMeters.toLocaleString('en-IN')} m</strong></span>
              <span>&bull;</span>
              <span>QC-Passed Stock Available: <strong className="text-emerald-700">{qcPassedMeters.toLocaleString('en-IN')} m</strong></span>
              <span>&bull;</span>
              <span>Dispatched: <strong className="text-blue-700">{totalDispatchedQty.toLocaleString('en-IN')} m</strong></span>
              <span>&bull;</span>
              <span>Remaining to Dispatch: <strong className={remainingCustomerQty > 0 ? 'text-amber-700 font-bold' : 'text-emerald-700'}>{remainingCustomerQty.toLocaleString('en-IN')} m</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCreateDispatch}
              disabled={qcPassedMeters <= 0 || remainingCustomerQty <= 0}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={qcPassedMeters <= 0 ? 'No QC-passed customer stock available' : remainingCustomerQty <= 0 ? 'Order already fully dispatched' : 'Generate new Delivery Challan'}
            >
              <Plus size={14} />
              <span>+ Create Customer Dispatch</span>
            </button>
          </div>
        </div>

        {challans.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 space-y-2">
            <Truck size={28} className="mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600">No Customer Dispatches Recorded Yet</p>
            <p className="max-w-md mx-auto text-slate-400 text-[11px]">
              Only eligible, QC-passed customer-allocated stock can be dispatched. Click "+ Create Customer Dispatch" to generate the official Delivery Challan with transporter & LR details.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Challan #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Dispatched Qty</th>
                  <th className="py-2.5 px-3">Transporter</th>
                  <th className="py-2.5 px-3">LR / Bilty #</th>
                  <th className="py-2.5 px-3">Vehicle #</th>
                  <th className="py-2.5 px-3">Destination</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {challans.map((ch, idx) => {
                  const dcNum = ch.challanNumber || ch.challan_number || `DC-${idx + 1}`;
                  const lrNum = ch.lrNumber || ch.lr_number || '—';
                  const dateStr = ch.dispatchDate || ch.dispatch_date || ch.doc_date || '—';
                  const qty = Number(ch.totalQty || ch.dispatchedQty || ch.quantity || 0);

                  return (
                    <tr key={ch.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                        <Link to={`/sales/delivery-challans`} className="hover:underline flex items-center gap-1">
                          <FileText size={12} className="text-slate-400" />
                          <span>{dcNum}</span>
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{dateStr}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                        {qty.toLocaleString('en-IN')} m
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">{ch.transporter || 'Direct / Hand Delivery'}</td>
                      <td className="py-2.5 px-3 font-mono text-purple-700 font-bold">{lrNum}</td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{ch.vehicleNumber || ch.vehicle_no || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[140px]">{ch.destination || project?.customerName || '—'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {ch.status || 'Dispatched'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenUpdateLr(ch)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          <span>Update LR</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 3. Invoicing & Receivables Section ── */}
      <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs overflow-hidden">
        {/* Navigation Sub-Tabs */}
        <div className="p-4 border-b border-[#dce5f4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-purple-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Commercial Invoicing & Accounts Receivables
            </h3>
          </div>

          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setInvoiceSubTab('final')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                invoiceSubTab === 'final'
                  ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sales Invoices ({finalInvoices.length})
            </button>
            <button
              type="button"
              onClick={() => setInvoiceSubTab('proforma')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                invoiceSubTab === 'proforma'
                  ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Proforma Invoices ({proformas.length})
            </button>
            <button
              type="button"
              onClick={() => setInvoiceSubTab('payments')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                invoiceSubTab === 'payments'
                  ? 'bg-purple-50 text-purple-700 font-bold border border-purple-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Payment History ({payments.length})
            </button>
          </div>
        </div>

        {/* 3a. Final Sales Invoices Table */}
        {invoiceSubTab === 'final' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-500">
                Official tax invoices approved and posted to the General Ledger. Receivables are balanced via linked bank/cash payment receipts.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateFinalInvoice}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-2xs cursor-pointer"
              >
                <Plus size={13} />
                <span>+ Create Final Tax Invoice</span>
              </button>
            </div>

            {finalInvoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-1 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                <Receipt size={24} className="mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">No Final Tax Invoices Generated</p>
                <p className="text-[11px] text-slate-400">Generate an invoice against dispatched challans to post commercial receivables.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3 text-right">Taxable Amt</th>
                      <th className="py-2.5 px-3 text-right">Tax (GST)</th>
                      <th className="py-2.5 px-3 text-right">Grand Total</th>
                      <th className="py-2.5 px-3 text-right">Amount Paid</th>
                      <th className="py-2.5 px-3 text-right">Outstanding</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {finalInvoices.map((inv, idx) => {
                      const num = inv.invoiceNumber || inv.invoice_number || `INV-${idx + 1}`;
                      const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && Number(inv.outstandingBalance || inv.balance || 0) > 0;
                      const outstanding = Number(inv.outstandingBalance || inv.balance || (Number(inv.grandTotal || 0) - Number(inv.amountPaid || 0)));

                      return (
                        <tr key={inv.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-purple-700">
                            <Link to={`/sales/invoices`} className="hover:underline flex items-center gap-1">
                              <FileText size={12} className="text-slate-400" />
                              <span>{num}</span>
                            </Link>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{inv.invoiceDate || inv.date || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            <span>{inv.dueDate || '—'}</span>
                            {isOverdue && (
                              <span className="ml-1 text-[9px] font-extrabold uppercase px-1 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                Overdue
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            ₹ {Number(inv.taxableAmount || inv.taxable_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            ₹ {Number(inv.taxAmount || inv.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                            ₹ {Number(inv.grandTotal || inv.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-bold">
                            ₹ {Number(inv.amountPaid || inv.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black">
                            <span className={outstanding > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                              ₹ {outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              outstanding === 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : (Number(inv.amountPaid || 0) > 0)
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {outstanding === 0 ? 'Fully Paid' : (Number(inv.amountPaid || 0) > 0 ? 'Partially Paid' : 'Unpaid')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              {outstanding > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRecordPayment(inv)}
                                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                                >
                                  Record Pay
                                </button>
                              )}
                              <a
                                href={`/sales/invoices`}
                                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                View
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-200 text-xs">
                      <td colSpan={5} className="py-2.5 px-3 text-slate-600">
                        Total {finalInvoices.length} Invoice(s)
                      </td>
                      <td className="py-2.5 px-3 text-right text-purple-800 font-mono">
                        ₹ {totalInvoicedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-800 font-mono">
                        ₹ {totalPaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-700 font-mono">
                        ₹ {totalOutstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3b. Proforma Invoices Table */}
        {invoiceSubTab === 'proforma' && (
          <div className="p-4 space-y-4">
            <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5 text-xs">
              <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-amber-800">
                <strong>Proforma Invoice Notice:</strong> A Proforma Invoice is a quotation and advance payment request document. Generating a proforma does <strong>NOT</strong> post accounting ledger entries or reduce stock. Only converting to a Final Sales Invoice posts accounting entries.
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-500">
                Manage advance quotations and commercial billing requests issued to the customer.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateProforma}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-2xs cursor-pointer"
              >
                <Plus size={13} />
                <span>+ Create Proforma Invoice</span>
              </button>
            </div>

            {proformas.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-1 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                <FileText size={24} className="mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">No Proforma Invoices Issued</p>
                <p className="text-[11px] text-slate-400">Issue a proforma invoice to request advance customer payment before or during dispatch.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">PI #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Valid Until</th>
                      <th className="py-2.5 px-3 text-right">Taxable Amt</th>
                      <th className="py-2.5 px-3 text-right">Tax</th>
                      <th className="py-2.5 px-3 text-right">Grand Total</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {proformas.map((pi, idx) => {
                      const num = pi.proformaNumber || pi.proforma_number || `PI-${idx + 1}`;
                      const isConverted = pi.status === 'Converted';
                      const isCancelled = pi.status === 'Cancelled';

                      return (
                        <tr key={pi.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                            <Link to={`/sales/proforma-invoices`} className="hover:underline flex items-center gap-1">
                              <FileText size={12} className="text-slate-400" />
                              <span>{num}</span>
                            </Link>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{pi.docDate || pi.date || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{pi.validUntil || pi.valid_until || '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            ₹ {Number(pi.taxableAmount || pi.taxable_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            ₹ {Number(pi.taxAmount || pi.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                            ₹ {Number(pi.grandTotal || pi.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isConverted
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : isCancelled
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {pi.status || 'Draft'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              {!isConverted && !isCancelled && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleConvertProforma(pi)}
                                    className="text-[11px] font-bold text-purple-700 hover:text-purple-900 hover:underline cursor-pointer"
                                  >
                                    Convert to Final
                                  </button>
                                  <span className="text-slate-300">|</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelProforma(pi)}
                                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                              {isConverted && (
                                <span className="text-[11px] text-slate-400 font-medium">Converted ✓</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3c. Payment History Table */}
        {invoiceSubTab === 'payments' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-500">
                Live customer receivable payment receipts recorded via banking, UPI, or cash accounts.
              </p>
              <button
                type="button"
                onClick={() => handleOpenRecordPayment(null)}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs cursor-pointer"
              >
                <Plus size={13} />
                <span>+ Record Payment Receipt</span>
              </button>
            </div>

            {payments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-1 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                <CreditCard size={24} className="mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">No Payments Recorded Yet</p>
                <p className="text-[11px] text-slate-400">Click "+ Record Payment Receipt" to register customer remittance against sales invoices.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Receipt #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Payment Mode</th>
                      <th className="py-2.5 px-3">Bank Account</th>
                      <th className="py-2.5 px-3">Reference / UTR #</th>
                      <th className="py-2.5 px-3">Allocated Invoice</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p, idx) => {
                      const num = p.paymentNumber || p.payment_number || p.voucherNo || `PAY-${idx + 1}`;
                      return (
                        <tr key={p.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">{num}</td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{p.paymentDate || p.date || '—'}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{p.paymentMode || p.mode || 'Bank Transfer'}</td>
                          <td className="py-2.5 px-3 text-slate-600 truncate max-w-[130px]">{p.bankAccountName || p.account || 'Primary Bank'}</td>
                          <td className="py-2.5 px-3 font-mono text-purple-700 font-semibold">{p.referenceNo || p.ref_no || '—'}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">{p.invoiceNumber || p.invoice_number || 'Direct Project'}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700">
                            ₹ {Number(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {p.status || 'Received'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 4. Customer Project vs Own Project Comparative Traceability ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Customer Project Traceability" icon={Building2} badge={
          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            Dedicated Customer Allocation
          </span>
        }>
          <div className="space-y-0.5 text-xs">
            <Row label="Customer Name" value={project?.customerName || invoiceData?.salesOrder?.customer || 'Direct Customer'} />
            <Row label="Target Sales Requirement" value={`${requiredMeters.toLocaleString('en-IN')} m`} />
            <Row label="QC-Passed Available Stock" value={`${qcPassedMeters.toLocaleString('en-IN')} m`} />
            <Row label="Dispatched with DC & LR" value={`${totalDispatchedQty.toLocaleString('en-IN')} m`} />
            <Row label="Remaining Customer Balance" value={`${remainingCustomerQty.toLocaleString('en-IN')} m`} />
            <div className="pt-2 text-[10.5px] text-slate-400 italic">
              Only stock verified and QC-passed against customer specs is eligible for customer delivery challans.
            </div>
          </div>
        </Card>

        <Card title="Own Project / Surplus Inventory" icon={Warehouse} badge={
          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
            Own Stock Buffer
          </span>
        }>
          <div className="space-y-0.5 text-xs">
            <Row label="Surplus Procured / Woven" value={`${(Number(project?.allocatedMeters || requiredMeters) - requiredMeters > 0 ? Number(project?.allocatedMeters) - requiredMeters : ownStockAllocated).toLocaleString('en-IN')} m`} />
            <Row label="Traceable Own Allocation" value={`${ownStockAllocated.toLocaleString('en-IN')} m`} />
            <Row label="Usable Central Godown Stock" value={`${(qcPassedMeters + ownStockAllocated).toLocaleString('en-IN')} m`} />
            <Row label="Processing Loss & Tolerance" value="Within 4.0% Standard" />
            <Row label="Dispatch Guard" value="Cross-dispatch blocked without authorized transfer" />
            <div className="pt-2 text-[10.5px] text-slate-400 italic">
              Own stock cannot be dispatched against customer orders without an authorized allocation transfer in Stage 15.
            </div>
          </div>
        </Card>
      </div>

      {/* ── MODALS ── */}

      {/* Modal 1: Create Customer Dispatch */}
      {isDispatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Create Customer Delivery Challan (Dispatch)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveDispatch} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Challan Number *</label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.challanNumber}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, challanNumber: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Dispatch Date *</label>
                  <input
                    type="date"
                    required
                    value={dispatchForm.dispatchDate}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Transporter Name *</label>
                  <input
                    type="text"
                    required
                    value={dispatchForm.transporter}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, transporter: e.target.value })}
                    placeholder="e.g. V-Trans Logistics"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">LR / Bilty Number</label>
                  <input
                    type="text"
                    value={dispatchForm.lrNo}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, lrNo: e.target.value })}
                    placeholder="e.g. LR-9402"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Vehicle Number</label>
                  <input
                    type="text"
                    value={dispatchForm.vehicleNo}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNo: e.target.value })}
                    placeholder="e.g. GJ-05-AX-9912"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Destination Address / Consignee</label>
                <input
                  type="text"
                  value={dispatchForm.destination}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, destination: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              {/* Taka selection table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Select QC-Passed Customer Takas (Max Eligible: {qcPassedMeters.toLocaleString('en-IN')} m)
                  </label>
                  <span className="font-mono font-bold text-blue-700">
                    Total Selected: {totalSelectedDispatchQty.toLocaleString('en-IN')} m
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                      <tr className="text-[10px] font-bold text-slate-500 uppercase">
                        <th className="py-2 px-2.5 w-8">#</th>
                        <th className="py-2 px-2">Taka No</th>
                        <th className="py-2 px-2">Lot No</th>
                        <th className="py-2 px-2">Fabric Quality</th>
                        <th className="py-2 px-2 text-right">Avail (m)</th>
                        <th className="py-2 px-2 text-right">Dispatch Qty (m)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {eligibleTakas.map((t) => {
                        const isSelected = dispatchForm.selectedTakaIds[t.id] !== undefined;
                        const maxQ = Number(t.availableQty || t.quantity || 0);

                        return (
                          <tr key={t.id} className="hover:bg-blue-50/30">
                            <td className="py-2 px-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleTakaSelect(t.id, maxQ)}
                                className="cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-2 font-mono font-bold text-blue-700">{t.takaNumber || t.taka_number || t.takaNo || `TK-${t.id}`}</td>
                            <td className="py-2 px-2 font-mono text-slate-600">{t.lotNumber || t.lot_number || '—'}</td>
                            <td className="py-2 px-2 text-slate-700">{t.fabricName || t.fabricQuality || 'Grey Cotton 60s'}</td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">{maxQ}</td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                min="0"
                                max={maxQ}
                                disabled={!isSelected}
                                value={dispatchForm.selectedTakaIds[t.id] ?? 0}
                                onChange={(e) => handleUpdateTakaQty(t.id, e.target.value, maxQ)}
                                className="w-20 px-2 py-1 text-right border border-slate-300 rounded font-mono font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={dispatchForm.remarks}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, remarks: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDispatchModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || totalSelectedDispatchQty <= 0}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Generating Challan...' : `Confirm & Issue DC (${totalSelectedDispatchQty} m)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Update LR */}
      {isLrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Update Transporter & LR Details
              </h3>
              <button
                type="button"
                onClick={() => setLrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLrUpdate} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Transporter Name *</label>
                <input
                  type="text"
                  required
                  value={lrForm.transporter}
                  onChange={(e) => setLrForm({ ...lrForm, transporter: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">LR / Bilty Number *</label>
                <input
                  type="text"
                  required
                  value={lrForm.lrNo}
                  onChange={(e) => setLrForm({ ...lrForm, lrNo: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Vehicle Number</label>
                <input
                  type="text"
                  value={lrForm.vehicleNo}
                  onChange={(e) => setLrForm({ ...lrForm, vehicleNo: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={lrForm.remarks}
                  onChange={(e) => setLrForm({ ...lrForm, remarks: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLrModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save LR Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Create Proforma Invoice */}
      {isProformaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Create Proforma Invoice (Advance Request)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProformaModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveProforma} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Issue Date *</label>
                  <input
                    type="date"
                    required
                    value={proformaForm.date}
                    onChange={(e) => setProformaForm({ ...proformaForm, date: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Valid Until Date *</label>
                  <input
                    type="date"
                    required
                    value={proformaForm.validUntil}
                    onChange={(e) => setProformaForm({ ...proformaForm, validUntil: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Link to Delivery Challan (Optional)</label>
                <select
                  value={proformaForm.challanId}
                  onChange={(e) => setProformaForm({ ...proformaForm, challanId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="">No Challan (Advance Quotation)</option>
                  {challans.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.challanNumber || ch.challan_number} — {ch.totalQty} m
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Quantity (m) *</label>
                  <input
                    type="number"
                    required
                    value={proformaForm.quantity}
                    onChange={(e) => setProformaForm({ ...proformaForm, quantity: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Rate / m (₹) *</label>
                  <input
                    type="number"
                    required
                    value={proformaForm.unitRate}
                    onChange={(e) => setProformaForm({ ...proformaForm, unitRate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Tax (%)</label>
                  <input
                    type="number"
                    value={proformaForm.taxPercent}
                    onChange={(e) => setProformaForm({ ...proformaForm, taxPercent: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between font-bold">
                <span>Calculated Total:</span>
                <span className="font-mono text-purple-700">
                  ₹ {(Number(proformaForm.quantity || 0) * Number(proformaForm.unitRate || 0) * (1 + Number(proformaForm.taxPercent || 0)/100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes / Terms</label>
                <textarea
                  rows={2}
                  value={proformaForm.notes}
                  onChange={(e) => setProformaForm({ ...proformaForm, notes: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setProformaModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  {submitting ? 'Generating...' : 'Issue Proforma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Create Final Tax Invoice */}
      {isFinalInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Generate Final Sales Tax Invoice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFinalInvoiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveFinalInvoice} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    required
                    value={finalInvoiceForm.date}
                    onChange={(e) => setFinalInvoiceForm({ ...finalInvoiceForm, date: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Due Date *</label>
                  <input
                    type="date"
                    required
                    value={finalInvoiceForm.dueDate}
                    onChange={(e) => setFinalInvoiceForm({ ...finalInvoiceForm, dueDate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Link to Delivery Challan</label>
                <select
                  value={finalInvoiceForm.challanId}
                  onChange={(e) => setFinalInvoiceForm({ ...finalInvoiceForm, challanId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="">Direct Sales Order</option>
                  {challans.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.challanNumber || ch.challan_number} — {ch.totalQty} m
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Quantity (m) *</label>
                  <input
                    type="number"
                    required
                    value={finalInvoiceForm.quantity}
                    onChange={(e) => setFinalInvoiceForm({ ...finalInvoiceForm, quantity: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Rate / m (₹) *</label>
                  <input
                    type="number"
                    required
                    value={finalInvoiceForm.unitRate}
                    onChange={(e) => setFinalInvoiceForm({ ...finalInvoiceForm, unitRate: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">GST Tax (%)</label>
                  <input
                    type="number"
                    value={finalInvoiceForm.taxPercent}
                    onChange={(e) => setFinalInvoiceForm({ ...finalInvoiceForm, taxPercent: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-200 text-xs flex justify-between font-bold">
                <span className="text-purple-900">Total Invoice Amount:</span>
                <span className="font-mono text-purple-700">
                  ₹ {(Number(finalInvoiceForm.quantity || 0) * Number(finalInvoiceForm.unitRate || 0) * (1 + Number(finalInvoiceForm.taxPercent || 0)/100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Remarks / Payment Terms</label>
                <textarea
                  rows={2}
                  value={finalInvoiceForm.notes}
                  onChange={(e) => setFinalInvoiceForm({ ...finalInvoiceForm, notes: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFinalInvoiceModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  {submitting ? 'Posting...' : 'Create & Post Tax Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Record Payment Receipt */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Record Customer Payment Receipt
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Select Sales Invoice</label>
                <select
                  value={paymentForm.invoiceId}
                  onChange={(e) => {
                    const invId = e.target.value;
                    const matched = finalInvoices.find((i) => String(i.id) === String(invId));
                    setSelectedInvoiceForPay(matched);
                    setPaymentForm({
                      ...paymentForm,
                      invoiceId: invId,
                      amount: matched ? String(matched.outstandingBalance || matched.balance || matched.grandTotal || 0) : paymentForm.amount,
                    });
                  }}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="">General Project Receivable</option>
                  {finalInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber || inv.invoice_number} — Total: ₹{Number(inv.grandTotal || 0).toLocaleString('en-IN')} (Due: ₹{Number(inv.outstandingBalance || inv.balance || 0).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode *</label>
                  <select
                    value={paymentForm.mode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-semibold"
                  >
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI / Digital</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Bank Account</label>
                  <select
                    value={paymentForm.bankAccountId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, bankAccountId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                  >
                    <option value="">Primary Operating Account</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>{b.accountName || b.name || 'Bank'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Reference / UTR / Cheque #</label>
                <input
                  type="text"
                  value={paymentForm.referenceNo}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                  placeholder="e.g. UTR-982142091"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
                >
                  {submitting ? 'Recording...' : 'Record Payment Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
