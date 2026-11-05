import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory,
  RefreshCw,
  Layers,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Package,
  TrendingUp,
  Download,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  LayoutGrid,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import KpiCard from '../../../components/ui/KpiCard';
import { Button } from '../../../components/ui/Button';
import { loomService } from '../../../services/loomService';
import { formatNum } from '../utils/loomCalculations';
import { useERP } from '../../../context/ERPContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

export default function LoomDashboardPage() {
  const navigate = useNavigate();
  const { showToast } = useERP();
  const [loading, setLoading] = useState(true);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [role, setRole] = useState('ceo'); // 'ceo' | 'prod' | 'coo' | 'coord'
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem('oscar_pms_dashboard_tab') || 'looms'
  );

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('oscar_pms_dashboard_tab', tabId);
  };

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loomService.getDashboardOverview();
      setDashboardData(res);
    } catch (err) {
      console.error('Failed to load loom dashboard overview:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleResetDemo = async () => {
    try {
      await loomService.resetDemoData();
      showToast('Demo data restored successfully!', 'success');
      fetchDashboard();
    } catch (err) {
      showToast('Failed to reset demo data', 'error');
    }
  };

  const handleExportJson = () => {
    if (!dashboardData) return;
    const blob = new Blob([JSON.stringify(dashboardData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oscar-loom-pms-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const factories = dashboardData?.factories || [];
  const programs = dashboardData?.programs || [];

  // Aggregated totals
  const totalLooms = factories.reduce((acc, f) => acc + (f.total_machines || 0), 0);
  const runningLooms = factories.reduce((acc, f) => acc + (f.running_machines || 0), 0);
  const totalMetersOnLooms = factories.reduce((acc, f) => acc + (f.on_loom_m || 0), 0);
  const totalSpareMeters = factories.reduce((acc, f) => acc + (f.spares_m || 0), 0);
  const totalDailyOutput = factories.reduce((acc, f) => acc + (f.daily_out || 0), 0);
  const totalBeamsToPrepare = factories.reduce((acc, f) => acc + (f.within7_count || 0), 0);

  const tabs = [
    {
      id: 'looms',
      label: 'Loom Stoppage Forecast',
      icon: Factory,
      badge: factories.length,
      badgeColor: totalBeamsToPrepare > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : undefined,
    },
    {
      id: 'yarn',
      label: 'Yarn Weft Cover',
      icon: Package,
      badge: factories.reduce((acc, f) => acc + (f.yarn_cover?.length || 0), 0),
    },
    {
      id: 'programs',
      label: 'Active Programs',
      icon: Layers,
      badge: programs.length,
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
        title="Loom Manufacturing Command Center"
        subtitle="Executive monitoring: Beam runout forecasts, automated yarn weft cover days, and active production batches."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Role switch */}
            <div className="h-[38px] flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 shadow-2xs text-xs">
              <UserCheck size={15} className="text-slate-400" />
              <span className="text-slate-500 font-medium hidden sm:inline">Role:</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="ceo">Sharad (CEO)</option>
                <option value="prod">Het (Production Head)</option>
                <option value="coo">Mayur (COO)</option>
                <option value="coord">Coordinator</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleExportJson}
              className="pms-btn-secondary"
            >
              <Download size={14} className="mr-1" /> Export
            </button>
            <button
              type="button"
              onClick={() => setResetConfirmOpen(true)}
              className="pms-btn-secondary text-amber-600 dark:text-amber-400"
            >
              <RotateCcw size={14} className="mr-1" /> Reset Demo
            </button>
            <button
              type="button"
              onClick={fetchDashboard}
              disabled={loading}
              className="pms-btn-secondary"
            >
              <RefreshCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        }
      />

      {/* KPI Cards Strip - Responsive 5 cols on lg, 2 cols on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <KpiCard
          title="Looms Running"
          value={`${runningLooms} / ${totalLooms}`}
          subtitle={totalLooms - runningLooms > 0 ? `${totalLooms - runningLooms} idle looms` : 'Full capacity'}
          icon={Factory}
          color={totalLooms - runningLooms > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          title="Meters on Looms"
          value={formatNum(totalMetersOnLooms)}
          subtitle={`+ ${formatNum(totalSpareMeters)} m spares`}
          icon={Layers}
          color="blue"
        />
        <KpiCard
          title="Daily Output"
          value={`${formatNum(totalDailyOutput)} m/d`}
          subtitle="7-day factory avg"
          icon={TrendingUp}
          color="green"
        />
        <KpiCard
          title="Avg Loom Cover"
          value={`${totalDailyOutput > 0 ? formatNum(totalMetersOnLooms / totalDailyOutput, 1) : 0} d`}
          subtitle="Until beams run out"
          icon={Clock}
          color="blue"
        />
        <KpiCard
          title="Beams to Prepare"
          value={totalBeamsToPrepare}
          subtitle="Ending in ≤ 7d with no spare"
          icon={AlertTriangle}
          color={totalBeamsToPrepare > 0 ? 'rose' : 'green'}
        />
      </div>

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

      {/* Section 1: Factory-Wise Beam Status Table */}
      {(activeTab === 'looms' || activeTab === 'all') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-3.5 sm:px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <Factory size={14} className="text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Factory-Wise Beam Status & Stoppage Forecast
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Click factory name to view looms
          </span>
        </div>
        <div className={`pms-table-container overflow-y-auto ${activeTab === 'all' ? 'max-h-[380px]' : 'max-h-[calc(100vh-275px)] min-h-[380px]'}`}>
          <table className="w-full text-xs text-left">
            <thead className="pms-sticky-header bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 px-3">Factory</th>
                <th className="py-2 px-3 text-right">Running / Total</th>
                <th className="py-2 px-3 text-right">Meters on Looms</th>
                <th className="py-2 px-3 text-right">Spare Beams</th>
                <th className="py-2 px-3 text-right">Daily Output (m)</th>
                <th className="py-2 px-3 text-right">Days on Looms</th>
                <th className="py-2 px-3 text-right">...With Spares</th>
                <th className="py-2 px-3 text-center">Prep Needed (≤7d)</th>
                <th className="py-2 px-3">Urgent (≤2d, No Spare)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {factories.map((f) => {
                const isUrgent = f.urgent_machines && f.urgent_machines.length > 0;
                return (
                  <tr key={f.factory_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <td
                      className="py-2 px-3 font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      onClick={() => navigate('/pms/looms')}
                    >
                      {f.factory_name}
                    </td>
                    <td className="py-2 px-3 text-right font-medium">
                      {f.running_machines} / {f.total_machines}
                      {f.idle_machines > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {f.idle_machines} idle
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium">{formatNum(f.on_loom_m)}</td>
                    <td className="py-2 px-3 text-right font-mono">
                      {f.spares_count} <span className="text-slate-400 text-[11px]">({formatNum(f.spares_m)} m)</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{formatNum(f.daily_out)}</td>
                    <td className="py-2 px-3 text-right font-bold">
                      <span className={f.days_on_loom <= 3 ? 'text-rose-600' : f.days_on_loom <= 7 ? 'text-amber-600' : 'text-emerald-600'}>
                        {formatNum(f.days_on_loom, 1)} d
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {formatNum(f.days_with_spare, 1)} d
                    </td>
                    <td className="py-2 px-3 text-center">
                      {f.within7_count > 0 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {f.within7_count}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isUrgent ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 animate-pulse">
                          MCN {f.urgent_machines.join(', ')}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold text-[11px]">✓ All covered</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Sections 2 & 3: Yarn Cover & Active Programs */}
      {(activeTab === 'yarn' || activeTab === 'programs' || activeTab === 'all') && (
        <div className={activeTab === 'all' ? 'grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-3.5' : 'space-y-3'}>
          {/* Yarn Cover by Factory Table */}
          {(activeTab === 'yarn' || activeTab === 'all') && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <div className="px-3.5 sm:px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-slate-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Yarn Cover Days (Weft Burn Rate)
                  </h3>
                </div>
                <Button variant="ghost" onClick={() => navigate('/pms/yarn')} className="h-6 text-[11px] px-1.5 text-blue-600">
                  Manage Yarn <ArrowRight size={11} className="ml-1" />
                </Button>
              </div>
              <div className={`pms-table-container overflow-y-auto ${activeTab === 'all' ? 'max-h-[360px]' : 'max-h-[calc(100vh-275px)] min-h-[380px]'}`}>
            <table className="w-full text-xs text-left">
              <thead className="pms-sticky-header bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2 px-2.5">Factory</th>
                  <th className="py-2 px-2.5">Yarn</th>
                  <th className="py-2 px-2.5 text-right">Balance kg</th>
                  <th className="py-2 px-2.5 text-right">Weft kg/d</th>
                  <th className="py-2 px-2.5 text-right font-bold">Cover Days</th>
                  <th className="py-2 px-2.5 text-right">Pending kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {factories.flatMap((f) =>
                  (f.yarn_cover || []).map((x) => (
                    <tr key={`${f.factory_id}-${x.yarn_id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-2 px-2.5 font-semibold text-slate-800 dark:text-slate-200">{f.factory_name}</td>
                      <td className="py-2 px-2.5 font-medium text-slate-700 dark:text-slate-300">{x.yarn_name}</td>
                      <td className="py-2 px-2.5 text-right font-mono font-semibold">
                        <span className={x.bal < 0 ? 'text-rose-600 font-bold' : ''}>{formatNum(x.bal)}</span>
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-500">
                        {x.daily > 0 ? formatNum(x.daily, 1) : <span className="text-slate-400">warp</span>}
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold">
                        {x.days === null ? (
                          <span className="text-slate-400">—</span>
                        ) : x.days <= 5 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-bold">
                            {formatNum(x.days, 1)} d
                          </span>
                        ) : x.days <= 10 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-bold">
                            {formatNum(x.days, 1)} d
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">{formatNum(x.days, 1)} d</span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-blue-600 font-medium">
                        {formatNum(x.pending)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Active Programs Summary Table */}
        {(activeTab === 'programs' || activeTab === 'all') && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="px-3.5 sm:px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Active Programs Progress
                </h3>
              </div>
              <Button variant="ghost" onClick={() => navigate('/pms/programs')} className="h-6 text-[11px] px-1.5 text-blue-600">
                All Programs <ArrowRight size={11} className="ml-1" />
              </Button>
            </div>
            <div className={`pms-table-container overflow-y-auto ${activeTab === 'all' ? 'max-h-[360px]' : 'max-h-[calc(100vh-275px)] min-h-[380px]'}`}>
            <table className="w-full text-xs text-left">
              <thead className="pms-sticky-header bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2 px-2.5">Program</th>
                  <th className="py-2 px-2.5">Factory</th>
                  <th className="py-2 px-2.5 text-right">Done / Target</th>
                  <th className="py-2 px-2.5 text-right">Loom Eff %</th>
                  <th className="py-2 px-2.5 text-right font-bold">At Factory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {programs.map((p) => {
                  const s = p.stats || {};
                  const onTrack = (s.meters || 0) >= (s.expected || 0);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td
                        className="py-2 px-2.5 font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        onClick={() => navigate('/pms/programs')}
                      >
                        {p.name}
                      </td>
                      <td className="py-2 px-2.5 font-medium text-slate-700 dark:text-slate-300">{p.factory_name}</td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold">
                        <span className={onTrack ? 'text-emerald-600' : 'text-amber-600'}>
                          {formatNum(s.meters)} / {formatNum(p.target)}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-semibold">
                        <span className={(s.eff_pct || 0) >= p.t_eff ? 'text-emerald-600' : 'text-rose-600'}>
                          {formatNum(s.eff_pct, 1)}%
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-indigo-600">
                        {formatNum(s.at_factory)} m
                      </td>
                    </tr>
                  );
                })}
                {!programs.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No active production programs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
      )}

      <ConfirmModal
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={async () => {
          setResetConfirmOpen(false);
          await handleResetDemo();
        }}
        title="Reset Loom PMS Data"
        message="Reset Loom PMS to prototype demo dataset? All manual testing entries will be restored to seed state."
        confirmText="Reset Demo Data"
        variant="warning"
      />
    </div>
  );
}
