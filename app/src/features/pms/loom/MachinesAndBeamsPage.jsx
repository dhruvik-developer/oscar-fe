import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Factory,
  RefreshCw,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  Layers,
  ArrowRight,
  ShieldAlert,
  Package,
  LayoutGrid,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import KpiCard from '../../../components/ui/KpiCard';
import { Button } from '../../../components/ui/Button';
import { loomService } from '../../../services/loomService';
import { qc, formatNum } from '../utils/loomCalculations';
import { useERP } from '../../../context/ERPContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

export default function MachinesAndBeamsPage() {
  const { showToast } = useERP();
  const [loading, setLoading] = useState(true);
  const [deleteConfirmBeamId, setDeleteConfirmBeamId] = useState(null);
  const [cutoffConfirmBeamId, setCutoffConfirmBeamId] = useState(null);
  const [reedConfirmModal, setReedConfirmModal] = useState(null);
  const [factories, setFactories] = useState([]);
  const [selectedFactoryId, setSelectedFactoryId] = useState(
    () => localStorage.getItem('oscar_pms_selected_factory') || ''
  );
  const [statusData, setStatusData] = useState(null);
  const [qualities, setQualities] = useState([]);
  const [yarns, setYarns] = useState([]);
  const [beams, setBeams] = useState([]);
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem('oscar_pms_machines_beams_tab') || 'machines'
  );

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('oscar_pms_machines_beams_tab', tabId);
  };

  // Add Beam form state
  const [bNo, setBNo] = useState('');
  const [bQuality, setBQuality] = useState('');
  const [bLength, setBLength] = useState(9000);
  const [bDate, setBDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bMachine, setBMachine] = useState('');

  const yarnMap = useMemo(() => {
    const map = {};
    yarns.forEach((y) => { map[y.id] = y; });
    return map;
  }, [yarns]);

  const loadInitial = async () => {
    try {
      const [fRes, qRes, yRes] = await Promise.all([
        loomService.getFactories(),
        loomService.getQualities(),
        loomService.getYarns(),
      ]);
      const fList = Array.isArray(fRes) ? fRes : fRes?.results || [];
      const qList = Array.isArray(qRes) ? qRes : qRes?.results || [];
      const yList = Array.isArray(yRes) ? yRes : yRes?.results || [];

      setFactories(fList);
      setQualities(qList);
      setYarns(yList);

      if (qList.length) setBQuality(qList[0].id);

      if (fList.length) {
        const saved = localStorage.getItem('oscar_pms_selected_factory');
        const exists = fList.some((f) => f.id === saved);
        if (saved && exists) {
          setSelectedFactoryId(saved);
        } else {
          // Default to the factory that has active machines/data, or fList[0]
          const activeF =
            fList.find((f) => f.name?.toLowerCase().includes('shree laxmi') || f.machines_count > 0) ||
            fList[0];
          setSelectedFactoryId(activeF.id);
          localStorage.setItem('oscar_pms_selected_factory', activeF.id);
        }
      }
    } catch (err) {
      console.error('Error loading loom data:', err);
    }
  };

  const fetchFactoryData = useCallback(async () => {
    if (!selectedFactoryId) return;
    setLoading(true);
    try {
      const [stRes, bRes] = await Promise.all([
        loomService.getFactoryStatus(selectedFactoryId),
        loomService.getBeams({ factory: selectedFactoryId }),
      ]);
      setStatusData(stRes);
      const bList = Array.isArray(bRes) ? bRes : bRes?.results || [];
      setBeams(bList);
    } catch (err) {
      console.error('Failed to load factory status:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedFactoryId]);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    fetchFactoryData();
  }, [fetchFactoryData]);

  // Live beam preview
  const liveBeamPreview = useMemo(() => {
    const q = qualities.find((x) => x.id === bQuality);
    if (!q) return null;
    const c = qc(q, yarnMap);
    if (!c) return null;
    const needWarpKg = c.warpKgM * Number(bLength || 0);
    const needWeftKg = c.weftKgM * Number(bLength || 0);

    const st = statusData?.yarn_cover?.find((x) => x.yarn_id === (q.warp_yarn || q.warpYarn));
    const warpBal = st ? st.bal : 0;
    const isShort = needWarpKg > warpBal;

    return {
      warpKg: needWarpKg,
      weftKg: needWeftKg,
      warpYarnName: q.warp_yarn_name,
      weftYarnName: q.weft_yarn_name,
      reed: q.reed,
      warpBal,
      isShort,
    };
  }, [bQuality, bLength, qualities, yarnMap, statusData]);

  const doCreateBeam = async () => {
    try {
      await loomService.createBeam({
        beam_no: bNo,
        factory: selectedFactoryId,
        quality: bQuality,
        length: Number(bLength),
        date: bDate,
        status: 'Spare',
        machine: bMachine || null,
      });
      showToast('Beam created successfully', 'success');
      setBNo('');
      fetchFactoryData();
    } catch (err) {
      showToast(err?.payload?.detail || 'Failed to add beam', 'error');
    }
  };

  const handleAddBeam = async (e) => {
    e.preventDefault();
    if (!bNo || !bLength) {
      showToast('Beam number and length are required', 'warning');
      return;
    }
    const q = qualities.find((x) => x.id === bQuality);
    const m = statusData?.machines?.find((x) => x.machine_id === bMachine);

    if (m && q && m.reed !== q.reed) {
      setReedConfirmModal({
        title: 'Reed Mismatch Warning',
        message: `Quality needs Reed ${q.reed}, but Machine ${m.no} is Reed ${m.reed}. Do you want to proceed and assign anyway?`,
        onProceed: doCreateBeam,
      });
      return;
    }

    await doCreateBeam();
  };

  const doLoadBeam = async (beamId, machineId) => {
    try {
      await loomService.loadBeamToLoom(beamId, machineId);
      showToast('Beam loaded to loom successfully', 'success');
      fetchFactoryData();
    } catch (err) {
      showToast(err?.payload?.detail || 'Failed to load beam on loom', 'error');
    }
  };

  const handleLoadToLoom = async (beamId, machineId) => {
    const beam = beams.find((b) => b.id === beamId);
    const m = statusData?.machines?.find((x) => x.machine_id === machineId);
    const q = qualities.find((x) => x.id === beam?.quality);

    if (m && q && m.reed !== q.reed) {
      setReedConfirmModal({
        title: 'Reed Mismatch Warning',
        message: `Quality needs Reed ${q.reed}, but Machine ${m.no} is Reed ${m.reed}. Do you want to load to this loom anyway?`,
        onProceed: () => doLoadBeam(beamId, machineId),
      });
      return;
    }

    await doLoadBeam(beamId, machineId);
  };

  const handleAssignSpare = async (beamId, machineId) => {
    try {
      await loomService.assignSpareBeam(beamId, machineId);
      showToast('Beam parked as spare', 'success');
      fetchFactoryData();
    } catch (err) {
      showToast('Failed to park spare', 'error');
    }
  };

  const handleCutoffBeam = async (beamId) => {
    try {
      await loomService.cutoffBeam(beamId);
      showToast('Beam marked finished and cut off', 'success');
      fetchFactoryData();
    } catch (err) {
      showToast('Failed to cut off beam', 'error');
    }
  };

  const handleDeleteBeam = async (beamId) => {
    try {
      await loomService.deleteBeam(beamId);
      showToast('Beam entry deleted', 'success');
      fetchFactoryData();
    } catch (err) {
      showToast('Failed to delete beam', 'error');
    }
  };

  const machines = statusData?.machines || [];
  const activeBeams = beams.filter((b) => b.status !== 'Finished');

  const tabs = [
    {
      id: 'machines',
      label: 'Loom Machine Status',
      icon: Factory,
      badge: machines.length,
      badgeColor:
        statusData?.urgent_machines?.length > 0
          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse'
          : undefined,
    },
    {
      id: 'beams',
      label: 'Beams & Allocation',
      icon: Layers,
      badge: activeBeams.length,
    },
    {
      id: 'yarn',
      label: 'Yarn Stock & Cover',
      icon: Package,
      badge: statusData?.yarn_cover?.length || 0,
    },
    {
      id: 'all',
      label: 'Show All',
      icon: LayoutGrid,
    },
  ];

  return (
    <div className="pms-screen w-full space-y-3 sm:space-y-3.5">
      <PageHeader
        title="Loom Machines & Beams"
        subtitle="Manage on-loom warp meters, spare beam parking, reed count validation, and daily loom status."
        actions={
          <div className="flex items-center gap-2">
            <div className="h-[38px] flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 shadow-2xs">
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
              onClick={fetchFactoryData}
              disabled={loading}
              className="pms-btn-secondary"
            >
              <RefreshCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
      />

      {/* KPI Cards Strip */}
      {statusData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          <KpiCard
            title="Looms Running"
            value={`${statusData.running_machines} / ${statusData.total_machines}`}
            subtitle={statusData.idle_machines > 0 ? `${statusData.idle_machines} idle looms` : 'Full capacity'}
            icon={Factory}
            color={statusData.idle_machines > 0 ? 'amber' : 'green'}
          />
          <KpiCard
            title="Meters on Looms"
            value={formatNum(statusData.on_loom_m)}
            subtitle="Across active looms"
            icon={Layers}
            color="blue"
          />
          <KpiCard
            title="Spare Beams Ready"
            value={statusData.spares_count}
            subtitle={`${formatNum(statusData.spares_m)} spare meters`}
            icon={CheckCircle2}
            color="green"
          />
          <KpiCard
            title="Loom Cover Days"
            value={`${formatNum(statusData.days_on_loom, 1)} d`}
            subtitle={`...with spares: ${formatNum(statusData.days_with_spare, 1)} d`}
            icon={Clock}
            color={statusData.days_on_loom <= 3 ? 'rose' : statusData.days_on_loom <= 7 ? 'amber' : 'green'}
          />
          <KpiCard
            title="Prep Needed (≤7d)"
            value={statusData.within7_count}
            subtitle={statusData.urgent_machines.length > 0 ? `Urgent: MCN ${statusData.urgent_machines.join(', ')}` : 'No urgent alerts'}
            icon={AlertTriangle}
            color={statusData.urgent_machines.length > 0 ? 'rose' : statusData.within7_count > 0 ? 'amber' : 'green'}
          />
        </div>
      )}

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
                {tab.badge !== undefined && (
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                      tab.badgeColor ||
                      (isActive
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                        : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300')
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 hidden sm:flex items-center gap-1.5">
          <span>Active view: <b className="text-slate-700 dark:text-slate-300 font-semibold">{tabs.find((t) => t.id === activeTab)?.label}</b></span>
        </div>
      </div>

      {/* Section 1: Machine Status Table */}
      {(activeTab === 'machines' || activeTab === 'all') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Loom Machine Status & Days Remaining
          </h3>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Ordered by beam runout urgency
          </span>
        </div>
        <div className={`pms-table-container overflow-y-auto ${activeTab === 'all' ? 'max-h-[420px]' : 'max-h-[calc(100vh-275px)] min-h-[440px]'}`}>
          <table className="w-full text-xs text-left">
            <thead className="pms-sticky-header bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50 dark:bg-slate-800">MCN</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50 dark:bg-slate-800">Quality</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50 dark:bg-slate-800">Active Beam</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-50 dark:bg-slate-800">On Loom Mtr</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-50 dark:bg-slate-800">7-Day Avg m/d</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-50 dark:bg-slate-800">Days Left</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50 dark:bg-slate-800">Spare Parked</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-50 dark:bg-slate-800">Reed</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap bg-slate-50 dark:bg-slate-800">Alert Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {machines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No loom machines found for this factory. Configure machines in Loom Masters or switch factory.
                  </td>
                </tr>
              ) : (
                [...machines]
                  .sort((a, b) => (a.beam ? a.days_left : -1) - (b.beam ? b.days_left : -1))
                  .map((m) => {
                    let alertBadge = null;
                    if (!m.beam) {
                      alertBadge = <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">Idle — load beam</span>;
                    } else if (m.days_left <= 2 && !m.spare) {
                      alertBadge = <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 animate-pulse">Prepare beam now</span>;
                    } else if (m.days_left <= 7 && !m.spare) {
                      alertBadge = <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Prepare this week</span>;
                    } else if (m.spare) {
                      alertBadge = <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Spare ready</span>;
                    } else {
                      alertBadge = <span className="px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-500">Normal</span>;
                    }

                    return (
                      <tr key={m.machine_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">MCN {m.no}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{m.quality?.name || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-xs whitespace-nowrap">{m.beam?.no || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-medium whitespace-nowrap">{m.beam ? formatNum(m.rem) : '—'}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500 whitespace-nowrap">{formatNum(m.avg)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {m.beam ? (isFinite(m.days_left) ? formatNum(m.days_left, 1) : '—') : '—'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {m.spare ? (
                            <span className="text-emerald-600 font-medium text-xs">
                              {m.spare.quality_name} <span className="text-slate-400 font-mono text-[11px]">({m.spare.no})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 whitespace-nowrap">{m.reed}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">{alertBadge}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Section 2: Beams Management Card */}
      {(activeTab === 'beams' || activeTab === 'all') && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Beams (Add, Park Spare & Load to Loom)
          </h3>
          <span className="text-xs text-slate-500 hidden sm:inline">Active & Spare Beams in Factory</span>
        </div>

        {/* Add Beam Form - Matching Project Section Field Sizes & Styles */}
        <form onSubmit={handleAddBeam} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 items-end">
          <div>
            <label className="pms-label">Beam No</label>
            <input
              type="text"
              placeholder="e.g. B201"
              value={bNo}
              onChange={(e) => setBNo(e.target.value)}
              className="pms-input w-full font-mono"
              required
            />
          </div>
          <div>
            <label className="pms-label">Quality</label>
            <select
              value={bQuality}
              onChange={(e) => setBQuality(e.target.value)}
              className="pms-select w-full cursor-pointer"
            >
              {qualities.map((q) => (
                <option key={q.id} value={q.id}>{q.name} (Reed {q.reed})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="pms-label">Length (m)</label>
            <input
              type="number"
              value={bLength}
              onChange={(e) => setBLength(Number(e.target.value))}
              className="pms-input w-full font-mono"
              required
            />
          </div>
          <div>
            <label className="pms-label">Date</label>
            <input
              type="date"
              value={bDate}
              onChange={(e) => setBDate(e.target.value)}
              className="pms-input w-full"
            />
          </div>
          <div>
            <label className="pms-label">Park For</label>
            <select
              value={bMachine}
              onChange={(e) => setBMachine(e.target.value)}
              className="pms-select w-full cursor-pointer"
            >
              <option value="">— Unassigned —</option>
              {machines.map((m) => (
                <option key={m.machine_id} value={m.machine_id}>MCN {m.no} (Reed {m.reed})</option>
              ))}
            </select>
          </div>
          <div>
            <button type="submit" className="pms-btn-emerald w-full">
              <Plus size={16} /> Add Beam
            </button>
          </div>
        </form>

        {/* Live Beam Preview Hint */}
        {liveBeamPreview && (
          <div className="text-xs text-slate-700 dark:text-slate-300 bg-blue-50/80 dark:bg-blue-950/30 px-3.5 py-2 rounded-lg border border-blue-100 dark:border-blue-900/40 flex flex-wrap gap-2.5 items-center">
            <span>
              Warp Yarn needed: <b>{formatNum(liveBeamPreview.warpKg, 1)} kg</b> ({liveBeamPreview.warpYarnName})
            </span>
            <span>· Stock: {formatNum(liveBeamPreview.warpBal, 1)} kg</span>
            {liveBeamPreview.isShort ? (
              <span className="text-rose-600 font-bold">⚠️ Shortage: {formatNum(liveBeamPreview.warpKg - liveBeamPreview.warpBal, 1)} kg</span>
            ) : (
              <span className="text-emerald-600 font-semibold">✓ Stock Available</span>
            )}
            <span>· Reed {liveBeamPreview.reed} · Weft needed: ≈ {formatNum(liveBeamPreview.weftKg, 1)} kg</span>
          </div>
        )}

        {/* Beams Table */}
        <div className={`pms-table-container overflow-y-auto ${activeTab === 'all' ? 'max-h-[360px]' : 'max-h-[calc(100vh-420px)] min-h-[360px]'}`}>
          <table className="w-full text-xs text-left">
            <thead className="pms-sticky-header bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50 dark:bg-slate-800">Beam No</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50 dark:bg-slate-800">Quality</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-50 dark:bg-slate-800">Length (m)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-50 dark:bg-slate-800">Remaining (m)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-50 dark:bg-slate-800">Warp (kg)</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50 dark:bg-slate-800">Status</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50 dark:bg-slate-800">Machine</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap min-w-[220px] bg-slate-50 dark:bg-slate-800">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeBeams.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{b.beam_no}</td>
                  <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{b.quality_name}</td>
                  <td className="py-2 px-3 text-right font-medium whitespace-nowrap">{formatNum(b.length)}</td>
                  <td className="py-2 px-3 text-right font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{formatNum(b.remaining_meters)}</td>
                  <td className="py-2 px-3 text-right text-slate-500 whitespace-nowrap">{formatNum(b.warp_kg, 1)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                        b.status === 'On loom'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${b.status === 'On loom' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {b.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {b.machine_no ? `MCN ${b.machine_no}` : <span className="text-slate-400 font-normal">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center whitespace-nowrap min-w-[230px]">
                    <div className="flex items-center justify-center gap-1.5">
                      {b.status === 'Spare' ? (
                        <>
                          <select
                            id={`target_m_${b.id}`}
                            defaultValue={b.machine || ''}
                            className="h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 font-medium text-slate-800 dark:text-slate-200 cursor-pointer min-w-[120px] outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                          >
                            <option value="">Select MCN...</option>
                            {machines.map((m) => (
                              <option key={m.machine_id} value={m.machine_id}>MCN {m.no}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`target_m_${b.id}`);
                              if (!el.value) {
                                showToast('Please select a target machine', 'warning');
                                return;
                              }
                              handleLoadToLoom(b.id, el.value);
                            }}
                            className="h-8 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`target_m_${b.id}`);
                              handleAssignSpare(b.id, el.value);
                            }}
                            className="h-8 px-3 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                          >
                            Park
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCutoffConfirmBeamId(b.id)}
                          className="h-8 px-3 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          Cut off
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmBeamId(b.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer ml-0.5"
                        title="Delete Beam"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!activeBeams.length && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                    No active beams in this factory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Section 3: Factory Yarn Stock & Weft Cover */}
      {(activeTab === 'yarn' || activeTab === 'all') && statusData && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="px-3.5 sm:px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Yarn Stock & Weft Cover Days at this Factory
            </h3>
          </div>
          <div className={`pms-table-container overflow-y-auto ${activeTab === 'all' ? 'max-h-[300px]' : 'max-h-[calc(100vh-280px)] min-h-[300px]'}`}>
            <table className="w-full text-xs text-left">
              <thead className="pms-sticky-header bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50 dark:bg-slate-800">Yarn</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-50 dark:bg-slate-800">Balance kg</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-50 dark:bg-slate-800">Bags</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-50 dark:bg-slate-800">Weft Use / Day (kg)</th>
                  <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap bg-slate-50 dark:bg-slate-800">Days Weft Cover</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-50 dark:bg-slate-800">Pending Delivery (kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(!statusData.yarn_cover || statusData.yarn_cover.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      No yarn stock records found for this factory.
                    </td>
                  </tr>
                ) : (
                  statusData.yarn_cover.map((y) => (
                    <tr key={y.yarn_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">{y.yarn_name}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold whitespace-nowrap">
                        <span className={y.bal < 0 ? 'text-rose-600 font-bold' : ''}>{formatNum(y.bal)}</span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500 whitespace-nowrap">{formatNum(y.bags, 1)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">{y.daily > 0 ? formatNum(y.daily, 1) : <span className="text-slate-400">warp</span>}</td>
                      <td className="py-2 px-3 text-right font-bold whitespace-nowrap">
                        {y.days === null ? (
                          <span className="text-slate-400">—</span>
                        ) : y.days <= 5 ? (
                          <span className="text-rose-600 animate-pulse font-bold">{formatNum(y.days, 1)} days</span>
                        ) : y.days <= 10 ? (
                          <span className="text-amber-600 font-semibold">{formatNum(y.days, 1)} days</span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">{formatNum(y.days, 1)} days</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-blue-600 whitespace-nowrap">{formatNum(y.pending)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteConfirmBeamId)}
        onClose={() => setDeleteConfirmBeamId(null)}
        onConfirm={async () => {
          const id = deleteConfirmBeamId;
          setDeleteConfirmBeamId(null);
          await handleDeleteBeam(id);
        }}
        title="Delete Beam Entry"
        message="Are you sure you want to delete this beam record? This action cannot be undone."
        confirmText="Delete Beam"
        variant="danger"
      />

      <ConfirmModal
        isOpen={Boolean(cutoffConfirmBeamId)}
        onClose={() => setCutoffConfirmBeamId(null)}
        onConfirm={async () => {
          const id = cutoffConfirmBeamId;
          setCutoffConfirmBeamId(null);
          await handleCutoffBeam(id);
        }}
        title="Cut Off Beam"
        message="Mark this beam as completely finished / cut off? The machine will become empty and available for a new beam."
        confirmText="Mark Finished & Cut Off"
        variant="warning"
      />

      <ConfirmModal
        isOpen={Boolean(reedConfirmModal)}
        onClose={() => setReedConfirmModal(null)}
        onConfirm={async () => {
          const callback = reedConfirmModal?.onProceed;
          setReedConfirmModal(null);
          if (callback) await callback();
        }}
        title={reedConfirmModal?.title || 'Reed Mismatch Warning'}
        message={reedConfirmModal?.message || 'The reed of the machine does not match the reed required by the fabric quality. Continue?'}
        confirmText="Proceed Anyway"
        variant="warning"
      />
    </div>
  );
}
