import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Layers,
  Plus,
  RefreshCw,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  TrendingUp,
  Cpu,
  AlertTriangle,
  ClipboardList,
  FileCheck2,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import KpiCard from '../../../components/ui/KpiCard';
import { Button } from '../../../components/ui/Button';
import { loomService } from '../../../services/loomService';
import { qc, formatNum } from '../utils/loomCalculations';

export default function LoomProgramsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState([]);
  const [factories, setFactories] = useState([]);
  const [qualities, setQualities] = useState([]);
  const [yarns, setYarns] = useState([]);
  const [openProgId, setOpenProgId] = useState(null);
  const [progStats, setProgStats] = useState(null);

  // Form
  const [pName, setPName] = useState('');
  const [pFactory, setPFactory] = useState('');
  const [pQuality, setPQuality] = useState('');
  const [pTarget, setPTarget] = useState(60000);
  const [pStart, setPStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [pDeadline, setPDeadline] = useState('');
  const [pTrpm, setPTrpm] = useState(650);
  const [pTeff, setPTeff] = useState(85);
  const [pTpower, setPTpower] = useState(2);

  const yarnMap = useMemo(() => {
    const map = {};
    yarns.forEach((y) => { map[y.id] = y; });
    return map;
  }, [yarns]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prRes, fRes, qRes, yRes] = await Promise.all([
        loomService.getPrograms(),
        loomService.getFactories(),
        loomService.getQualities(),
        loomService.getYarns(),
      ]);
      const prList = Array.isArray(prRes) ? prRes : prRes?.results || [];
      const fList = Array.isArray(fRes) ? fRes : fRes?.results || [];
      const qList = Array.isArray(qRes) ? qRes : qRes?.results || [];
      const yList = Array.isArray(yRes) ? yRes : yRes?.results || [];

      setPrograms(prList);
      setFactories(fList);
      setQualities(qList);
      setYarns(yList);

      if (fList.length && !pFactory) setPFactory(fList[0].id);
      if (qList.length && !pQuality) setPQuality(qList[0].id);
    } catch (err) {
      console.error('Failed to load programs:', err);
    } finally {
      setLoading(false);
    }
  }, [pFactory, pQuality]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load single program stats when openProgId changes
  useEffect(() => {
    if (!openProgId) {
      setProgStats(null);
      return;
    }
    const fetchStats = async () => {
      try {
        const stats = await loomService.getProgramStats(openProgId);
        setProgStats(stats);
      } catch (err) {
        console.error('Failed to load program stats:', err);
      }
    };
    fetchStats();
  }, [openProgId]);

  // Live Program Preview
  const liveProgPreview = useMemo(() => {
    const q = qualities.find((x) => x.id === pQuality);
    if (!q) return null;
    const c = qc(q, yarnMap);
    if (!c) return null;
    const T = Number(pTarget || 0);

    return {
      warpKg: T * c.warpKgM,
      weftKg: T * c.weftKgM,
      yarnCost: T * (c.warpCost + c.weftCost),
      jobCost: T * c.jobCost,
      totalCost: T * c.totalCost,
      costPerM: c.totalCost,
      warpYarnName: q.warp_yarn_name,
      weftYarnName: q.weft_yarn_name,
      gsm: c.gsm,
    };
  }, [pQuality, pTarget, qualities, yarnMap]);

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    if (!pName || !pDeadline || !pTarget) return alert('Name, Deadline and Target required');
    try {
      await loomService.createProgram({
        name: pName,
        factory: pFactory,
        quality: pQuality,
        target: Number(pTarget),
        start: pStart,
        deadline: pDeadline,
        t_rpm: Number(pTrpm),
        t_eff: Number(pTeff),
        t_power: Number(pTpower),
        status: 'Planned',
      });
      setPName('');
      loadData();
    } catch (err) {
      alert(err?.payload?.detail || 'Failed to create program');
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await loomService.updateProgramStatus(id, status);
      loadData();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleDeleteProgram = async (id) => {
    if (!confirm('Delete this program?')) return;
    try {
      await loomService.deleteProgram(id);
      loadData();
    } catch (err) {
      alert('Failed to delete program');
    }
  };

  const activeProg = programs.find((p) => p.id === openProgId);

  // If a program is open, render its full drilldown view
  if (activeProg && progStats) {
    const q = qualities.find((x) => x.id === activeProg.quality);
    const c = q ? qc(q, yarnMap) : null;

    return (
      <div className="pms-screen w-full space-y-3 sm:space-y-3.5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button variant="secondary" onClick={() => setOpenProgId(null)} size="sm">
            <ArrowLeft size={13} className="mr-1" /> Back to Programs
          </Button>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">{activeProg.name}</h2>
          <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
            {activeProg.factory_name}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
            {activeProg.quality_name}
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <KpiCard
            title="Produced Meters"
            value={`${formatNum(progStats.meters)} / ${formatNum(progStats.target)}`}
            subtitle={`${formatNum(progStats.pct, 1)}% of target`}
            icon={TrendingUp}
            color={progStats.pct >= 100 ? 'green' : 'blue'}
          />
          <KpiCard
            title="Days Timeline"
            value={`${progStats.days_used} / ${progStats.total_days} d`}
            subtitle={`${activeProg.start} → ${activeProg.deadline}`}
            icon={Clock}
            color="amber"
          />
          <KpiCard
            title="Target Run Rate"
            value={`${formatNum(progStats.per_day)} m/d`}
            subtitle={`Expected by today: ${formatNum(progStats.expected)} m`}
            icon={Calendar}
            color="blue"
          />
          <KpiCard
            title="Efficiency vs Target"
            value={`${formatNum(progStats.eff_pct, 1)}%`}
            subtitle={`Target: ${activeProg.t_eff}% | Avg RPM: ${formatNum(progStats.avg_rpm)}`}
            icon={Cpu}
            color={progStats.eff_pct >= activeProg.t_eff ? 'green' : 'rose'}
          />
        </div>

        {/* 2 Column Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Quality Spec In Force */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Technical Quality Spec in Force
            </h3>
            {c && q && (
              <div className="text-xs space-y-2 text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 sm:p-3.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">Warp:</span> {q.warp_yarn_name} · {c.warpDen} den · {q.ends} ends · crimp {q.crimp}%
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">Weft:</span> {q.weft_yarn_name} · {c.weftDen} den · reed {q.reed} · {q.reed_w}" · {q.ppi} PPI ({formatNum(c.ppm, 1)} picks/m) · wastage {q.wastage}%
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-3">
                  <span>Warp: <b>{c.warpKgM.toFixed(4)} kg/m</b></span>
                  <span>Weft: <b>{c.weftKgM.toFixed(4)} kg/m</b></span>
                  <span>Total: <b>{c.totKgM.toFixed(4)} kg/m</b></span>
                  <span>GSM: <b>{formatNum(c.gsm, 1)}</b></span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-3 font-semibold">
                  <span>Yarn: ₹{(c.warpCost + c.weftCost).toFixed(2)}/m</span>
                  <span>Job-work: ₹{c.jobCost.toFixed(2)}/m</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">Total Grey: ₹{c.totalCost.toFixed(2)}/m</span>
                </div>
              </div>
            )}
          </div>

          {/* Yarn & Fabric Position */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Yarn & Fabric Ledger Position
            </h3>
            <div className="pms-table-container">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="py-2 text-slate-500">Remaining Meters to Weave</td>
                    <td className="py-2 text-right font-mono font-bold text-blue-600">{formatNum(progStats.remaining)} m</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-500">Warp Yarn Still Needed</td>
                    <td className="py-2 text-right font-mono font-semibold">{formatNum(progStats.warp_need, 1)} kg</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-500">Weft Yarn Still Needed</td>
                    <td className="py-2 text-right font-mono font-semibold">{formatNum(progStats.weft_need, 1)} kg</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-500">Produced Grey Fabric</td>
                    <td className="py-2 text-right font-mono text-emerald-600">{formatNum(progStats.meters)} m</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-500">Dispatched to Godown</td>
                    <td className="py-2 text-right font-mono">{formatNum(progStats.godown)} m</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-500">Dispatched to Dyeing Mill</td>
                    <td className="py-2 text-right font-mono">{formatNum(progStats.mill)} m</td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-800/40 font-bold">
                    <td className="py-2 px-2 text-slate-800 dark:text-slate-200">Grey Fabric Still at Factory</td>
                    <td className="py-2 px-2 text-right font-mono text-indigo-600 dark:text-indigo-400">
                      {formatNum(progStats.at_factory)} m
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Work Instruction (PI) & Auto-PO Settlement Bridge */}
        <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/60 dark:from-slate-900 dark:to-blue-950/40 border border-blue-200/80 dark:border-blue-800 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-600 dark:text-blue-400" />
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                Work Instruction (PI) & Job-Work Settlement Bridge
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Generate the formal job-card Production Instruction (PI) for {activeProg.factory_name} or verify completion output to auto-generate the final Job-Work PO.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/pms/production-instructions?query=${encodeURIComponent(activeProg.name)}`)}
            >
              <ClipboardList size={13} className="mr-1.5 text-blue-600" />
              View / Issue PI
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/pms/production-completion?query=${encodeURIComponent(activeProg.name)}`)}
            >
              <CheckCircle2 size={13} className="mr-1.5" />
              Verify Output & Auto-PO
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pms-screen w-full space-y-3 sm:space-y-3.5">
      <PageHeader
        title="Production Programs (Orders & Batches)"
        subtitle="Schedule and track manufacturing targets by factory and quality with dynamic yarn demand forecasts."
        actions={
          <Button variant="secondary" onClick={loadData} disabled={loading} size="sm">
            <RefreshCw size={13} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Create Program Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-3">
        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
          Create Production Program <span className="text-slate-400 font-normal text-xs">(CEO / Production Head)</span>
        </h3>
        <form onSubmit={handleCreateProgram} className="grid grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
          <div className="md:col-span-2">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Program Name</label>
            <input
              type="text"
              placeholder="e.g. 3103-A – Shree Laxmi – Nov"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              className="w-full mt-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs"
              required
            />
          </div>
          <div>
            <label className="pms-label">Factory</label>
            <select
              value={pFactory}
              onChange={(e) => setPFactory(e.target.value)}
              className="pms-select w-full cursor-pointer"
            >
              {factories.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="pms-label">Quality</label>
            <select
              value={pQuality}
              onChange={(e) => setPQuality(e.target.value)}
              className="pms-select w-full cursor-pointer"
            >
              {qualities.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="pms-label">Target Meters</label>
            <input
              type="number"
              value={pTarget}
              onChange={(e) => setPTarget(Number(e.target.value))}
              className="pms-input w-full font-mono"
              required
            />
          </div>
          <div>
            <label className="pms-label">Start Date</label>
            <input
              type="date"
              value={pStart}
              onChange={(e) => setPStart(e.target.value)}
              className="pms-input w-full"
            />
          </div>
          <div>
            <label className="pms-label">Deadline</label>
            <input
              type="date"
              value={pDeadline}
              onChange={(e) => setPDeadline(e.target.value)}
              className="pms-input w-full"
              required
            />
          </div>
          <div>
            <label className="pms-label">Target RPM</label>
            <input
              type="number"
              value={pTrpm}
              onChange={(e) => setPTrpm(Number(e.target.value))}
              className="pms-input w-full"
            />
          </div>
          <div>
            <label className="pms-label">Target Eff %</label>
            <input
              type="number"
              value={pTeff}
              onChange={(e) => setPTeff(Number(e.target.value))}
              className="pms-input w-full"
            />
          </div>
          <div>
            <button type="submit" className="pms-btn-emerald w-full">
              <Plus size={16} /> Create Program
            </button>
          </div>
        </form>

        {/* Live Program Calculation Preview */}
        {liveProgPreview && (
          <div className="p-2.5 sm:p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-900 dark:text-blue-200 flex flex-wrap gap-2.5 items-center">
            <span>
              For <b>{formatNum(pTarget)} m</b>: Warp <b>{formatNum(liveProgPreview.warpKg, 1)} kg</b> ({liveProgPreview.warpYarnName})
            </span>
            <span>· Weft <b>{formatNum(liveProgPreview.weftKg, 1)} kg</b> ({liveProgPreview.weftYarnName})</span>
            <span>· Yarn ₹{formatNum(liveProgPreview.yarnCost)}</span>
            <span>· Job-work ₹{formatNum(liveProgPreview.jobCost)}</span>
            <span className="font-bold text-blue-700 dark:text-blue-400">
              Total Budget: ₹{formatNum(liveProgPreview.totalCost)} (₹{liveProgPreview.costPerM.toFixed(2)}/m)
            </span>
          </div>
        )}
      </div>

      {/* Programs List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Active Programs & Progress
          </h3>
        </div>
        <div className="pms-table-container">
          <table className="w-full text-xs text-left pms-sticky-header">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Program</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Factory</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Quality</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Target (m)</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Done (m)</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Needed / Day</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Start</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Deadline</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Total ₹/m</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Status</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {programs.map((p) => {
                const s = p.stats || {};
                const isLate = (s.meters || 0) < (s.expected || 0);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-bold text-blue-600 hover:underline cursor-pointer" onClick={() => setOpenProgId(p.id)}>
                      {p.name}
                    </td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-semibold text-slate-700 dark:text-slate-300">{p.factory_name}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3">{p.quality_name}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-medium">{formatNum(p.target)}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-bold">
                      <span className={isLate ? 'text-amber-600' : 'text-emerald-600'}>
                        {formatNum(s.meters)}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono text-slate-500">{formatNum(s.per_day)}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-slate-500">{p.start}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-medium">{p.deadline}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-semibold">₹{s.cost_m?.toFixed(2) || '—'}</td>
                    <td className="py-1.5 px-2.5 sm:py-2 sm:px-3">
                      <select
                        value={p.status}
                        onChange={(e) => handleUpdateStatus(p.id, e.target.value)}
                        className="h-7 text-xs font-semibold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5"
                      >
                        <option value="Planned">Planned</option>
                        <option value="Running">Running</option>
                        <option value="Hold">Hold</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/pms/production-instructions?query=${encodeURIComponent(p.name)}`)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded transition-colors"
                          title="View / Issue Production Work Instruction (PI)"
                        >
                          <ClipboardList size={13} />
                        </button>
                        <button
                          onClick={() => navigate(`/pms/production-completion?query=${encodeURIComponent(p.name)}`)}
                          className="text-emerald-600 hover:text-emerald-800 p-1 rounded transition-colors"
                          title="Verify Output & Auto-PO"
                        >
                          <CheckCircle2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteProgram(p.id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                          title="Delete Program"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!programs.length && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    No programs scheduled. Create one above to start tracking.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
