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
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import TablePagination from '../../../components/ui/TablePagination';
import { loomService } from '../../../services/loomService';
import { formatNum, preventNegativeInput } from '../utils/loomCalculations';
import { useERP } from '../../../context/ERPContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

export default function FabricOutPage() {
  const navigate = useNavigate();
  const { showToast } = useERP();
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [factories, setFactories] = useState([]);
  const [qualities, setQualities] = useState([]);
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
  const [oChallan, setOChallan] = useState('');
  const [oVehicle, setOVehicle] = useState('');

  const loadInitial = async () => {
    try {
      const [fRes, qRes] = await Promise.all([
        loomService.getFactories(),
        loomService.getQualities(),
      ]);
      const fList = Array.isArray(fRes) ? fRes : fRes?.results || [];
      const qList = Array.isArray(qRes) ? qRes : qRes?.results || [];

      setFactories(fList);
      setQualities(qList);

      if (fList.length && !selectedFactoryId) setSelectedFactoryId(fList[0].id);
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

  const handleRecordDispatch = async (e) => {
    e.preventDefault();
    if (!oMeters || Number(oMeters) <= 0) {
      showToast('Please enter dispatch meters (must be greater than 0)', 'warning');
      return;
    }
    if (oTaka && Number(oTaka) <= 0) {
      showToast('Taka count must be greater than 0', 'warning');
      return;
    }

    // Validation: Check if meters exceed available fabric at factory
    const invRow = inventorySummary?.factory_inventory?.find((x) => x.quality_id === oQuality);
    const available = invRow ? invRow.at_factory_m : 0;
    if (Number(oMeters) > available) {
      showToast(`Only ${formatNum(available)} m of this quality available at this factory!`, 'warning');
      return;
    }

    try {
      await loomService.createFabricDispatch({
        factory: selectedFactoryId,
        quality: oQuality,
        date: oDate,
        taka: oTaka ? Number(oTaka) : 0,
        meters: Number(oMeters),
        dest: oDest,
        dest_name: oDest === 'Godown' ? '' : oDestName,
        challan: oChallan,
        vehicle: oVehicle,
      });
      showToast('Dispatch challan recorded successfully', 'success');
      setOMeters('');
      setOTaka('');
      setOChallan('');
      setOVehicle('');
      fetchFactoryDispatches();
    } catch (err) {
      showToast(err?.payload?.detail || 'Failed to record dispatch', 'error');
    }
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
            <div className="h-[38px] flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 shadow-2xs">
              <Factory size={15} className="text-slate-400" />
              <select
                value={selectedFactoryId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedFactoryId(val);
                  localStorage.setItem('oscar_pms_selected_factory', val);
                }}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                {factories.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
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
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-xl shadow-2xs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Record Fabric Out Challan <span className="text-slate-400 font-normal text-xs">(Coordinator)</span>
        </h3>
        <form onSubmit={handleRecordDispatch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="pms-label">Quality</label>
            <select
              value={oQuality}
              onChange={(e) => setOQuality(e.target.value)}
              className="pms-select w-full cursor-pointer"
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
            />
          </div>
          <div>
            <label className="pms-label">Taka (Rolls)</label>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 12"
              value={oTaka}
              onChange={(e) => setOTaka(e.target.value)}
              onKeyDown={preventNegativeInput}
              className="pms-input w-full font-mono"
            />
          </div>
          <div>
            <label className="pms-label">Meters</label>
            <input
              type="number"
              min="0.01"
              step="any"
              placeholder="1440"
              value={oMeters}
              onChange={(e) => setOMeters(e.target.value)}
              onKeyDown={preventNegativeInput}
              className="pms-input w-full font-mono"
              required
            />
          </div>
          <div>
            <label className="pms-label">Destination</label>
            <select
              value={oDest}
              onChange={(e) => setODest(e.target.value)}
              className="pms-select w-full cursor-pointer"
            >
              <option value="Dyeing mill">Dyeing mill</option>
              <option value="Godown">Godown</option>
              <option value="Other factory">Other factory</option>
            </select>
          </div>
          <div>
            <label className="pms-label">Mill / Party Name</label>
            <input
              type="text"
              placeholder="e.g. Shree Dyeing"
              value={oDestName}
              disabled={oDest === 'Godown'}
              onChange={(e) => setODestName(e.target.value)}
              className="pms-input w-full disabled:opacity-50"
            />
          </div>
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
          <div className="col-span-full flex justify-end pt-1">
            <button type="submit" className="pms-btn-emerald">
              <Truck size={15} /> Record Dispatch Challan
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
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Grey Fabric at Factory by Quality
              </h3>
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
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-bold text-blue-600">
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
          <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Grey Fabric Lying at Dyeing Mills
            </h3>
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
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-bold text-purple-600">{formatNum(m.meters)}</td>
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
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Dispatch Challans Log
          </h3>
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
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Challan No</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedDispatches.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-slate-500">{d.date}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-semibold text-slate-800 dark:text-slate-200">{d.quality_name}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">{d.taka}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-bold">{formatNum(d.meters)}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-medium text-slate-700 dark:text-slate-300">{d.dest}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-slate-600 dark:text-slate-400">{d.dest_name || '—'}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-mono font-semibold text-blue-600">{d.challan || '—'}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">
                    <button
                      onClick={() => setDeleteConfirmId(d.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                      title="Delete dispatch challan"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {!dispatches.length && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No dispatches logged yet.
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
    </div>
  );
}
