import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Plus,
  RefreshCw,
  Trash2,
  Factory,
  Package,
  Layers,
  CheckCircle2,
  Warehouse,
  ClipboardList,
  LayoutGrid,
  Printer,
  FileText,
  X,
  AlertTriangle,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import TablePagination from '../../../components/ui/TablePagination';
import { loomService } from '../../../services/loomService';
import { formatNum, preventNegativeInput } from '../utils/loomCalculations';
import { partiesService, jobworkService } from '../../../services/domainServices';
import { useERP } from '../../../context/ERPContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import CompanySelector from './components/CompanySelector';

export default function FabricOutPage() {
  const navigate = useNavigate();
  const { showToast } = useERP();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [showStockWarning, setShowStockWarning] = useState(false);
  const [allowExceedStock, setAllowExceedStock] = useState(false);
  const [previewChallan, setPreviewChallan] = useState(null);

  const [factories, setFactories] = useState([]);
  const [qualities, setQualities] = useState([]);
  const [dyeingParties, setDyeingParties] = useState([]);
  const [jobWorkOrders, setJobWorkOrders] = useState([]);
  const [selectedFactoryId, setSelectedFactoryId] = useState('');
  const [dispatches, setDispatches] = useState([]);
  const [dispatchPage, setDispatchPage] = useState(1);
  const [dispatchPageSize, setDispatchPageSize] = useState(10);
  const [inventorySummary, setInventorySummary] = useState(null);

  const paginatedDispatches = useMemo(() => {
    const start = (dispatchPage - 1) * dispatchPageSize;
    return dispatches.slice(start, start + dispatchPageSize);
  }, [dispatches, dispatchPage, dispatchPageSize]);

  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem('oscar_pms_fabric_out_tab') || 'dispatch'
  );

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('oscar_pms_fabric_out_tab', tabId);
  };

  // Dispatch Form
  const [oQuality, setOQuality] = useState('');
  const [oDate, setODate] = useState(() => new Date().toISOString().slice(0, 10));
  const [oTaka, setOTaka] = useState('');
  const [oMeters, setOMeters] = useState('');
  const [oDest, setODest] = useState('Dyeing mill');
  const [oDestName, setODestName] = useState('');
  const [dyeingMillParty, setDyeingMillParty] = useState('');
  const [jobWorkOrder, setJobWorkOrder] = useState('');
  const [oChallan, setOChallan] = useState('');
  const [oVehicle, setOVehicle] = useState('');

  // Current Quality Available Inventory at selected factory
  const currentQualityInventory = useMemo(() => {
    if (!inventorySummary?.factory_inventory || !oQuality) return null;
    return inventorySummary.factory_inventory.find(
      (x) => String(x.quality_id) === String(oQuality)
    ) || null;
  }, [inventorySummary, oQuality]);

  const availableStock = currentQualityInventory ? Number(currentQualityInventory.at_factory_m || 0) : 0;

  const loadInitial = async () => {
    try {
      const [fRes, qRes, pRes, jwoRes] = await Promise.all([
        loomService.getFactories(),
        loomService.getQualities(),
        partiesService.getParties().catch(() => []),
        jobworkService.getOrders().catch(() => []),
      ]);
      const fList = Array.isArray(fRes) ? fRes : fRes?.results || [];
      const qList = Array.isArray(qRes) ? qRes : qRes?.results || [];
      const pList = Array.isArray(pRes) ? pRes : pRes?.results || [];
      const jwoList = Array.isArray(jwoRes) ? jwoRes : jwoRes?.results || [];

      setFactories(fList);
      setQualities(qList);
      setDyeingParties(
        pList.filter(
          (p) =>
            !p.party_type ||
            p.party_type.toLowerCase() === 'vendor' ||
            p.party_type.toLowerCase() === 'supplier' ||
            p.type?.toLowerCase() === 'vendor'
        )
      );
      setJobWorkOrders(jwoList);

      const savedFactory = localStorage.getItem('oscar_pms_selected_factory');
      if (savedFactory && fList.some((f) => String(f.id) === String(savedFactory))) {
        setSelectedFactoryId(savedFactory);
      } else if (fList.length) {
        setSelectedFactoryId(fList[0].id);
      }
      if (qList.length) setOQuality(qList[0].id);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  const fetchFactoryDispatches = useCallback(async () => {
    if (!selectedFactoryId) return;
    setLoading(true);
    try {
      const [dRes, invRes] = await Promise.all([
        loomService.getFabricDispatches({ factory: selectedFactoryId }),
        loomService.getFabricInventorySummary(selectedFactoryId),
      ]);
      const dList = Array.isArray(dRes) ? dRes : dRes?.results || [];
      setDispatches(dList);
      setInventorySummary(invRes);
    } catch (err) {
      console.error('Failed to load dispatches:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedFactoryId]);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    fetchFactoryDispatches();
  }, [fetchFactoryDispatches]);

  // Execute Dispatch API Call
  const executeDispatch = async () => {
    if (!selectedFactoryId) {
      showToast('Please select a factory before recording dispatch', 'warning');
      return;
    }
    if (!oQuality) {
      showToast('Please select a fabric quality', 'warning');
      return;
    }
    if (!oMeters || Number(oMeters) <= 0) {
      showToast('Please enter dispatch meters (must be greater than 0)', 'warning');
      return;
    }
    if (oTaka && Number(oTaka) < 0) {
      showToast('Taka count cannot be negative', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      await loomService.createFabricDispatch({
        factory: selectedFactoryId,
        quality: oQuality,
        date: oDate,
        taka: oTaka ? Number(oTaka) : 0,
        meters: Number(oMeters),
        dest: oDest,
        dest_name: oDest === 'Godown' ? (oDestName || 'Godown') : oDestName,
        dyeing_mill_party: oDest === 'Dyeing mill' ? (dyeingMillParty || null) : null,
        job_work_order: oDest === 'Dyeing mill' ? (jobWorkOrder || null) : null,
        challan: oChallan || '',
        vehicle: oVehicle || '',
      });
      showToast('Dispatch challan recorded successfully', 'success');
      setOMeters('');
      setOTaka('');
      setOChallan('');
      setOVehicle('');
      setDyeingMillParty('');
      setJobWorkOrder('');
      setODestName('');
      fetchFactoryDispatches();
    } catch (err) {
      showToast(err?.payload?.detail || err?.message || 'Failed to record dispatch', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordDispatch = async (e) => {
    e.preventDefault();
    if (!selectedFactoryId) {
      showToast('Please select a factory', 'warning');
      return;
    }
    if (!oQuality) {
      showToast('Please select a fabric quality', 'warning');
      return;
    }
    if (!oMeters || Number(oMeters) <= 0) {
      showToast('Please enter dispatch meters (must be greater than 0)', 'warning');
      return;
    }

    // Check if entered meters exceed recorded stock at factory
    if (Number(oMeters) > availableStock && !allowExceedStock) {
      setShowStockWarning(true);
      return;
    }

    await executeDispatch();
  };

  const handleDeleteDispatch = async (id) => {
    try {
      await loomService.deleteFabricDispatch(id);
      showToast('Dispatch record deleted', 'success');
      fetchFactoryDispatches();
    } catch (err) {
      showToast('Failed to delete dispatch', 'error');
    }
  };

  const selectedFactoryName = factories.find((f) => String(f.id) === String(selectedFactoryId))?.name || 'Factory';
  const selectedQualityName = qualities.find((q) => String(q.id) === String(oQuality))?.name || 'Quality';

  const tabs = [
    {
      id: 'dispatch',
      label: 'Record Dispatch',
      icon: Plus,
    },
    {
      id: 'stock',
      label: 'Fabric Stock & Mills',
      icon: Layers,
    },
    {
      id: 'history',
      label: 'Dispatch Challans Log',
      icon: Truck,
    },
    {
      id: 'all',
      label: 'Show All',
      icon: LayoutGrid,
    },
  ];

  return (
    <div className="pms-screen w-full space-y-6">
      <PageHeader
        title="Fabric Out & Dyeing Mill Dispatches"
        subtitle="Record fabric rolls (taka & meters) leaving the factory for dyeing mills, godowns or processing."
        actions={
          <div className="flex items-center gap-2">
            <CompanySelector
              factories={factories}
              selectedFactoryId={selectedFactoryId}
              onSelect={(val) => {
                setSelectedFactoryId(val);
                localStorage.setItem('oscar_pms_selected_factory', val);
              }}
            />
            <button
              type="button"
              onClick={fetchFactoryDispatches}
              disabled={loading}
              className="pms-btn-secondary"
            >
              <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Screen Section Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="inline-flex max-w-full overflow-x-auto no-scrollbar p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-xl shadow-2xs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 hidden sm:flex items-center gap-1.5">
          <span>Active view: <b className="text-slate-700 dark:text-slate-300 font-semibold">{tabs.find((t) => t.id === activeTab)?.label}</b></span>
        </div>
      </div>

      {/* Section 1: Record Dispatch Form */}
      {(activeTab === 'dispatch' || activeTab === 'all') && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Record Fabric Out Challan <span className="text-slate-400 font-normal text-xs">(Coordinator)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Issue physical delivery challan & dispatch grey fabric from <b>{selectedFactoryName}</b>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Recorded Factory Stock:</span>
            <span
              className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md border ${
                availableStock > 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              {formatNum(availableStock)} m ({selectedQualityName})
            </span>
          </div>
        </div>

        <form onSubmit={handleRecordDispatch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="pms-label">Quality</label>
            <select
              value={oQuality}
              onChange={(e) => setOQuality(e.target.value)}
              className="pms-select w-full cursor-pointer"
              required
            >
              {qualities.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="pms-label">Date</label>
            <input
              type="date"
              value={oDate}
              onChange={(e) => setODate(e.target.value)}
              className="pms-input w-full"
              required
            />
          </div>
          <div>
            <label className="pms-label">Taka (Rolls)</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 10"
              value={oTaka}
              onChange={(e) => setOTaka(e.target.value)}
              onKeyDown={preventNegativeInput}
              className="pms-input w-full font-mono"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="pms-label">Meters</label>
              <span
                className={`text-[9px] font-semibold px-1 py-0.2 rounded border ${
                  availableStock > 0
                    ? 'text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800'
                    : 'text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800'
                }`}
                title="Recorded fabric meters at factory"
              >
                Avail: {formatNum(availableStock)}m
              </span>
            </div>
            <input
              type="number"
              min="0.01"
              step="any"
              placeholder="1000"
              value={oMeters}
              onChange={(e) => setOMeters(e.target.value)}
              onKeyDown={preventNegativeInput}
              className="pms-input w-full font-mono font-medium"
              required
            />
          </div>
          <div>
            <label className="pms-label">Destination</label>
            <select
              value={oDest}
              onChange={(e) => {
                setODest(e.target.value);
                if (e.target.value !== 'Dyeing mill') {
                  setDyeingMillParty('');
                  setJobWorkOrder('');
                }
              }}
              className="pms-select w-full cursor-pointer"
            >
              <option value="Dyeing mill">Dyeing mill</option>
              <option value="Godown">Godown</option>
              <option value="Other factory">Other factory</option>
            </select>
          </div>
          {oDest === 'Dyeing mill' ? (
            <>
              <div>
                <label className="pms-label flex items-center justify-between">
                  <span>Dyeing Mill (Party)</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">Parties</span>
                </label>
                <select
                  value={dyeingMillParty}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setDyeingMillParty(selId);
                    const party = dyeingParties.find((p) => String(p.id) === String(selId));
                    if (party) setODestName(party.name);
                  }}
                  className="pms-select w-full cursor-pointer"
                >
                  <option value="">-- Select Mill Party --</option>
                  {dyeingParties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.gstin ? `(${p.gstin})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="pms-label flex items-center justify-between">
                  <span>Linked JWO</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal">Job Work</span>
                </label>
                <select
                  value={jobWorkOrder}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setJobWorkOrder(selId);
                    const jwo = jobWorkOrders.find((j) => String(j.id) === String(selId));
                    if (jwo) {
                      if (!dyeingMillParty && jwo.vendor) setDyeingMillParty(jwo.vendor);
                      if (!oDestName && (jwo.vendor_name || jwo.vendor_details?.name)) {
                        setODestName(jwo.vendor_name || jwo.vendor_details?.name);
                      }
                    }
                  }}
                  className="pms-select w-full cursor-pointer"
                >
                  <option value="">-- None / Manual JWO --</option>
                  {jobWorkOrders.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.order_number || j.order_no || `JWO #${j.id}`} {j.vendor_name ? `- ${j.vendor_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="pms-label">Destination Name</label>
                <input
                  type="text"
                  placeholder="e.g. Shree Dyeing"
                  value={oDestName}
                  onChange={(e) => setODestName(e.target.value)}
                  className="pms-input w-full"
                />
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <label className="pms-label">Destination Name</label>
              <input
                type="text"
                placeholder={oDest === 'Godown' ? 'e.g. Central Godown' : 'e.g. Factory 2'}
                value={oDestName}
                onChange={(e) => setODestName(e.target.value)}
                className="pms-input w-full"
              />
            </div>
          )}
          <div>
            <label className="pms-label">Challan No</label>
            <input
              type="text"
              placeholder="SL/101"
              value={oChallan}
              onChange={(e) => setOChallan(e.target.value)}
              className="pms-input w-full font-mono"
            />
          </div>
          <div>
            <label className="pms-label">Vehicle No</label>
            <input
              type="text"
              placeholder="MH 09 AB 1234"
              value={oVehicle}
              onChange={(e) => setOVehicle(e.target.value)}
              className="pms-input w-full font-mono uppercase"
            />
          </div>

          <div className="col-span-full flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400 select-none">
              <input
                type="checkbox"
                checked={allowExceedStock}
                onChange={(e) => setAllowExceedStock(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Allow dispatch exceeding recorded factory stock (e.g. pending shift production logs)</span>
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="pms-btn-emerald"
            >
              <Truck size={15} className={submitting ? 'animate-spin' : ''} />
              {submitting ? 'Recording Dispatch...' : 'Record Dispatch Challan'}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Section 2: Fabric Stock & Mills */}
      {(activeTab === 'stock' || activeTab === 'all') && (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Fabric Stock at Selected Factory */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Grey Fabric at Factory by Quality ({selectedFactoryName})
              </h3>
              <span className="text-[11px] text-slate-400">Auto-balanced live</span>
            </div>
            <div className="pms-table-container overflow-x-auto">
            <table className="w-full text-xs text-left pms-sticky-header">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Quality</th>
                  <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Produced (m)</th>
                  <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Godown (m)</th>
                  <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Dyeing Mill (m)</th>
                  <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-bold text-slate-900 dark:text-slate-100">Still at Factory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(inventorySummary?.factory_inventory || []).map((row) => (
                  <tr key={row.quality_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-bold text-slate-800 dark:text-slate-200">{row.quality_name}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">{formatNum(row.produced_m)}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono text-slate-500">{formatNum(row.godown_m)}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono text-slate-500">{formatNum(row.mill_m)}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                      {formatNum(row.at_factory_m)}
                    </td>
                  </tr>
                ))}
                {!(inventorySummary?.factory_inventory || []).length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No grey fabric records at this factory yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grey at Dyeing Mills */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Grey Fabric Lying at Dyeing Mills
            </h3>
            <span className="text-[11px] text-slate-400">Across all mills</span>
          </div>
          <div className="pms-table-container overflow-x-auto">
            <table className="w-full text-xs text-left pms-sticky-header">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Dyeing Mill</th>
                  <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Quality</th>
                  <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Total Meters</th>
                  <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Takas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(inventorySummary?.grey_at_mills || []).map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-bold text-slate-800 dark:text-slate-200">{m.mill_name}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-medium text-slate-700 dark:text-slate-300">{m.quality_name}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-bold text-purple-600 dark:text-purple-400">{formatNum(m.meters)}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-medium">{m.taka}</td>
                  </tr>
                ))}
                {!(inventorySummary?.grey_at_mills || []).length && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No fabric currently pending at dyeing mills.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Settlement Banner */}
      <div className="bg-gradient-to-r from-emerald-50/80 to-blue-50/80 dark:from-slate-900 dark:to-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 rounded-xl p-3 sm:p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            Fabric rolls dispatched? Complete quality verification & auto-generate the <b>Final Job-Work PO</b> for agency billing.
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/pms/production-completion')}
        >
          <CheckCircle2 size={13} className="mr-1.5 text-emerald-600" />
          Open Completion & Auto-PO
        </Button>
      </div>
      </div>
      )}

      {/* Section 3: Dispatches Log Table */}
      {(activeTab === 'history' || activeTab === 'all') && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Dispatch Challans Log ({selectedFactoryName})
          </h3>
          <span className="text-xs text-slate-400">{dispatches.length} Total Dispatches</span>
        </div>
        <div className="pms-table-container overflow-x-auto">
          <table className="w-full text-xs text-left pms-sticky-header">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Date</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Quality</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Takas</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Meters</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Destination</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Destination Name</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Challan / Vehicle</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedDispatches.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-slate-500 whitespace-nowrap">{d.date}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-semibold text-slate-800 dark:text-slate-200">{d.quality_name}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">{d.taka}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">{formatNum(d.meters)}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-medium text-slate-700 dark:text-slate-300">{d.dest}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-slate-600 dark:text-slate-400">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{d.dest_name || '—'}</span>
                      {d.dyeing_mill_party_name && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-900/50 w-fit">
                          Vendor: {d.dyeing_mill_party_name}
                        </span>
                      )}
                      {d.job_work_order_number && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-900/50 w-fit font-mono">
                          JWO #{d.job_work_order_number}
                        </span>
                      )}
                      {d.batch_code && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-900/50 w-fit font-mono">
                          Batch: {d.batch_code}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3">
                    <div className="flex flex-col gap-0.5 font-mono">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{d.challan || '—'}</span>
                      {d.vehicle && (
                        <span className="text-[10px] text-slate-400 tracking-wider uppercase">{d.vehicle}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3">
                    <div className="flex flex-col gap-0.5 font-mono">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{d.challan || '—'}</span>
                      {d.vehicle && (
                        <span className="text-[10px] text-slate-400 tracking-wider uppercase">{d.vehicle}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewChallan(d)}
                        className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded transition-colors"
                        title="View / Print Delivery Challan Slip"
                      >
                        <Printer size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(d.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                        title="Delete dispatch challan"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!dispatches.length && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No dispatches logged yet for {selectedFactoryName}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          total={dispatches.length}
          page={dispatchPage}
          pageSize={dispatchPageSize}
          onPageChange={setDispatchPage}
          onPageSizeChange={(newSize) => {
            setDispatchPageSize(newSize);
            setDispatchPage(1);
          }}
          pageSizeOptions={[10, 20, 50]}
        />
      </div>
      )}

      {/* Stock Warning Confirmation Modal */}
      <ConfirmModal
        isOpen={showStockWarning}
        onClose={() => setShowStockWarning(false)}
        onConfirm={async () => {
          setShowStockWarning(false);
          await executeDispatch();
        }}
        title="Stock Warning — Confirm Dispatch"
        message={`Recorded inventory shows only ${formatNum(availableStock)} m of this quality currently logged at ${selectedFactoryName}, but you are dispatching ${formatNum(oMeters)} m (${formatNum(Math.max(0, Number(oMeters) - availableStock))} m over recorded stock). If loom production logs are still being entered or in progress, you can confirm this dispatch now.`}
        confirmText="Confirm & Dispatch Anyway"
        cancelText="Go Back & Edit"
        variant="warning"
      />

      {/* Delete Dispatch Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={async () => {
          const id = deleteConfirmId;
          setDeleteConfirmId(null);
          await handleDeleteDispatch(id);
        }}
        title="Delete Dispatch Challan"
        message="Are you sure you want to delete this dispatch challan record? The dispatched fabric meters will be restored to factory inventory."
        confirmText="Delete Dispatch"
        variant="danger"
      />

      {/* Delivery Challan Printable Slip Modal */}
      {previewChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Delivery Challan Slip
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewChallan(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div id="challan-printable-slip" className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/40 text-xs">
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-700 pb-2">
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wide text-slate-800 dark:text-slate-100">OSCAR TEXTILES ERP</h4>
                  <p className="text-[11px] text-slate-500">Fabric Delivery & Transit Challan</p>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold text-blue-600 dark:text-blue-400 text-sm">{previewChallan.challan || 'SL/CH-DRAFT'}</div>
                  <div className="text-slate-400">{previewChallan.date}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Dispatch From (Factory):</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{previewChallan.factory_name || selectedFactoryName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Destination:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {previewChallan.dest} — {previewChallan.dest_name || 'Godown'}
                  </span>
                </div>
                {previewChallan.dyeing_mill_party_name && (
                  <div>
                    <span className="text-slate-400 block">Dyeing Mill Party:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{previewChallan.dyeing_mill_party_name}</span>
                  </div>
                )}
                {previewChallan.job_work_order_number && (
                  <div>
                    <span className="text-slate-400 block">Linked JWO:</span>
                    <span className="font-semibold font-mono text-purple-600 dark:text-purple-400">JWO #{previewChallan.job_work_order_number}</span>
                  </div>
                )}
                {previewChallan.vehicle && (
                  <div>
                    <span className="text-slate-400 block">Vehicle No:</span>
                    <span className="font-bold font-mono text-slate-700 dark:text-slate-200 uppercase">{previewChallan.vehicle}</span>
                  </div>
                )}
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-700/60 font-semibold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-2 text-left">Quality</th>
                      <th className="p-2 text-right">Takas (Rolls)</th>
                      <th className="p-2 text-right">Total Meters</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100 dark:border-slate-700">
                      <td className="p-2 font-bold text-slate-800 dark:text-slate-200">{previewChallan.quality_name}</td>
                      <td className="p-2 text-right font-mono">{previewChallan.taka}</td>
                      <td className="p-2 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{formatNum(previewChallan.meters)} m</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="pt-6 flex justify-between text-[10px] text-slate-400">
                <div className="border-t border-slate-300 dark:border-slate-700 pt-1 w-28 text-center">
                  Factory Supervisor
                </div>
                <div className="border-t border-slate-300 dark:border-slate-700 pt-1 w-28 text-center">
                  Transporter / Driver
                </div>
                <div className="border-t border-slate-300 dark:border-slate-700 pt-1 w-28 text-center">
                  Receiver Signature
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewChallan(null)}
                className="pms-btn-secondary"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="pms-btn-primary"
              >
                <Printer size={14} className="mr-1.5" />
                Print Challan Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
