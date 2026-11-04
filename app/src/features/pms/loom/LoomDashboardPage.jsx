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
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import KpiCard from '../../../components/ui/KpiCard';
import { Button } from '../../../components/ui/Button';
import { loomService } from '../../../services/loomService';
import { formatNum } from '../utils/loomCalculations';

export default function LoomDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [role, setRole] = useState('ceo'); // 'ceo' | 'prod' | 'coo' | 'coord'

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
    if (!confirm('Reset Loom PMS to prototype demo dataset? All manual testing entries will be restored to seed state.')) return;
    try {
      await loomService.resetDemoData();
      alert('Demo data restored successfully!');
      fetchDashboard();
    } catch (err) {
      alert('Failed to reset demo data');
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loom Manufacturing Command Center"
        subtitle="Executive monitoring: Loom beam runout predictions, automated yarn weft cover days, and active production orders."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Role switch */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs">
              <UserCheck size={13} className="text-slate-400" />
              <span className="text-slate-500 font-medium">Viewing as:</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 outline-none"
              >
                <option value="ceo">Sharad (CEO)</option>
                <option value="prod">Het (Production Head)</option>
                <option value="coo">Mayur (COO)</option>
                <option value="coord">Coordinator</option>
              </select>
            </div>

            <Button variant="secondary" onClick={handleExportJson} className="h-8 text-xs">
              <Download size={13} className="mr-1" /> Export JSON
            </Button>
            <Button variant="secondary" onClick={handleResetDemo} className="h-8 text-xs text-amber-600 dark:text-amber-400">
              <RotateCcw size={13} className="mr-1" /> Reset Demo
            </Button>
            <Button variant="secondary" onClick={fetchDashboard} disabled={loading} className="h-8 text-xs">
              <RefreshCw size={13} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        }
      />

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <KpiCard
          title="Looms in Operation"
          value={`${runningLooms} / ${totalLooms}`}
          subtitle={`${totalLooms - runningLooms} idle looms`}
          icon={Factory}
          color={totalLooms - runningLooms > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          title="Meters on Looms"
          value={formatNum(totalMetersOnLooms)}
          subtitle={`+ ${formatNum(totalSpareMeters)} m in spares`}
          icon={Layers}
          color="blue"
        />
        <KpiCard
          title="Daily Output"
          value={`${formatNum(totalDailyOutput)} m/d`}
          subtitle="7-day factory moving average"
          icon={TrendingUp}
          color="green"
        />
        <KpiCard
          title="Avg Loom Cover"
          value={`${totalDailyOutput > 0 ? formatNum(totalMetersOnLooms / totalDailyOutput, 1) : 0} days`}
          subtitle="Until current beams run out"
          icon={Clock}
          color="blue"
        />
        <KpiCard
          title="Beams to Prepare"
          value={totalBeamsToPrepare}
          subtitle="Ending in ≤ 7 days without spare"
          icon={AlertTriangle}
          color={totalBeamsToPrepare > 0 ? 'rose' : 'green'}
        />
      </div>

      {/* Factory-Wise Beam Status Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Factory-Wise Beam Status & Stoppage Forecast
          </h3>
          <span className="text-[11px] text-slate-400">
            Click factory name to inspect loom machines
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Factory</th>
                <th className="py-2.5 px-3 text-right">Running / Total</th>
                <th className="py-2.5 px-3 text-right">Meters on Looms</th>
                <th className="py-2.5 px-3 text-right">Spare Beams</th>
                <th className="py-2.5 px-3 text-right">Daily Output (m)</th>
                <th className="py-2.5 px-3 text-right">Days on Looms</th>
                <th className="py-2.5 px-3 text-right">...With Spares</th>
                <th className="py-2.5 px-3 text-center">Beams to Prep (≤7d)</th>
                <th className="py-2.5 px-3">Urgent (≤2d, No Spare)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {factories.map((f) => {
                const isUrgent = f.urgent_machines && f.urgent_machines.length > 0;
                return (
                  <tr key={f.factory_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td
                      className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      onClick={() => navigate('/pms/looms')}
                    >
                      {f.factory_name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {f.running_machines} / {f.total_machines}
                      {f.idle_machines > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {f.idle_machines} idle
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium">{formatNum(f.on_loom_m)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {f.spares_count} <span className="text-slate-400">({formatNum(f.spares_m)} m)</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">{formatNum(f.daily_out)}</td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      <span className={f.days_on_loom <= 3 ? 'text-rose-600' : f.days_on_loom <= 7 ? 'text-amber-600' : 'text-emerald-600'}>
                        {formatNum(f.days_on_loom, 1)} d
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {formatNum(f.days_with_spare, 1)} d
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {f.within7_count > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {f.within7_count}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
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

      {/* Yarn Cover by Factory Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Yarn Cover Days by Factory (Weft Burn Rate)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Factory</th>
                <th className="py-2.5 px-3">Yarn</th>
                <th className="py-2.5 px-3 text-right">Balance kg</th>
                <th className="py-2.5 px-3 text-right">Bags</th>
                <th className="py-2.5 px-3 text-right">Weft Use / Day (kg)</th>
                <th className="py-2.5 px-3 text-right font-bold">Days of Weft Cover</th>
                <th className="py-2.5 px-3 text-right">Pending Delivery (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {factories.flatMap((f) =>
                (f.yarn_cover || []).map((x) => (
                  <tr key={`${f.factory_id}-${x.yarn_id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{f.factory_name}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">{x.yarn_name}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      <span className={x.bal < 0 ? 'text-rose-600 font-bold' : ''}>{formatNum(x.bal)}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatNum(x.bags, 1)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {x.daily > 0 ? formatNum(x.daily, 1) : <span className="text-slate-400">warp only</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {x.days === null ? (
                        <span className="text-slate-400">—</span>
                      ) : x.days <= 5 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 font-bold">
                          {formatNum(x.days, 1)} days
                        </span>
                      ) : x.days <= 10 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-bold">
                          {formatNum(x.days, 1)} days
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">{formatNum(x.days, 1)} days</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-blue-600 font-medium">
                      {formatNum(x.pending)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Programs Overview Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Active Programs Target vs Actuals
          </h3>
          <Button variant="secondary" onClick={() => navigate('/pms/programs')} className="h-7 text-xs">
            Manage Programs
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Program</th>
                <th className="py-2.5 px-3">Factory</th>
                <th className="py-2.5 px-3 text-right">Done / Target (m)</th>
                <th className="py-2.5 px-3 text-right">Expected by Today</th>
                <th className="py-2.5 px-3 text-right">Days Used</th>
                <th className="py-2.5 px-3 text-right">Looms on It</th>
                <th className="py-2.5 px-3 text-right">Loom Eff %</th>
                <th className="py-2.5 px-3 text-right">Warp kg Needed</th>
                <th className="py-2.5 px-3 text-right">Weft kg Needed</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">At Factory (m)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {programs.map((p) => {
                const s = p.stats || {};
                const onTrack = (s.meters || 0) >= (s.expected || 0);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td
                      className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      onClick={() => navigate('/pms/programs')}
                    >
                      {p.name}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">{p.factory_name}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      <span className={onTrack ? 'text-emerald-600' : 'text-amber-600'}>
                        {formatNum(s.meters)} / {formatNum(p.target)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatNum(s.expected)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{s.days_used} / {s.total_days}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{s.machines}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      <span className={(s.eff_pct || 0) >= p.t_eff ? 'text-emerald-600' : 'text-rose-600'}>
                        {formatNum(s.eff_pct, 1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatNum(s.warp_need, 1)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatNum(s.weft_need, 1)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600">
                      {formatNum(s.at_factory)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
