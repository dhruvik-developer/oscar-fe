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
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import KpiCard from '../../../components/ui/KpiCard';
import { Button } from '../../../components/ui/Button';
import { loomService } from '../../../services/loomService';
import { qc, formatNum } from '../utils/loomCalculations';

export default function MachinesAndBeamsPage() {
  const [loading, setLoading] = useState(true);
  const [factories, setFactories] = useState([]);
  const [selectedFactoryId, setSelectedFactoryId] = useState('');
  const [statusData, setStatusData] = useState(null);
  const [qualities, setQualities] = useState([]);
  const [yarns, setYarns] = useState([]);
  const [beams, setBeams] = useState([]);

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
      if (fList.length && !selectedFactoryId) setSelectedFactoryId(fList[0].id);
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

  // Add Beam
  const handleAddBeam = async (e) => {
    e.preventDefault();
    if (!bNo || !bLength) return alert('Beam number and length required');
    const q = qualities.find((x) => x.id === bQuality);
    const m = statusData?.machines?.find((x) => x.machine_id === bMachine);

    if (m && q && m.reed !== q.reed) {
      if (!confirm(`Reed mismatch! Quality needs Reed ${q.reed}, but Machine ${m.no} is Reed ${m.reed}. Continue?`)) {
        return;
      }
    }

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
      setBNo('');
      fetchFactoryData();
    } catch (err) {
      alert(err?.payload?.detail || 'Failed to add beam');
    }
  };

  const handleLoadToLoom = async (beamId, machineId) => {
    const beam = beams.find((b) => b.id === beamId);
    const m = statusData?.machines?.find((x) => x.machine_id === machineId);
    const q = qualities.find((x) => x.id === beam?.quality);

    if (m && q && m.reed !== q.reed) {
      if (!confirm(`Reed mismatch! Quality needs Reed ${q.reed}, but Machine ${m.no} is Reed ${m.reed}. Continue?`)) {
        return;
      }
    }

    try {
      await loomService.loadBeamToLoom(beamId, machineId);
      fetchFactoryData();
    } catch (err) {
      alert(err?.payload?.detail || 'Failed to load beam on loom');
    }
  };

  const handleAssignSpare = async (beamId, machineId) => {
    try {
      await loomService.assignSpareBeam(beamId, machineId);
      fetchFactoryData();
    } catch (err) {
      alert('Failed to park spare');
    }
  };

  const handleCutoffBeam = async (beamId) => {
    if (!confirm('Mark beam finished / cut off?')) return;
    try {
      await loomService.cutoffBeam(beamId);
      fetchFactoryData();
    } catch (err) {
      alert('Failed to cut off beam');
    }
  };

  const handleDeleteBeam = async (beamId) => {
    if (!confirm('Delete beam entry?')) return;
    try {
      await loomService.deleteBeam(beamId);
      fetchFactoryData();
    } catch (err) {
      alert('Failed to delete beam');
    }
  };

  const machines = statusData?.machines || [];
  const activeBeams = beams.filter((b) => b.status !== 'Finished');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loom Machines & Beams"
        subtitle="Manage on-loom warp meters, spare beam parking, reed count validation, and daily loom status."
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1">
              <Factory size={14} className="text-slate-400" />
              <select
                value={selectedFactoryId}
                onChange={(e) => setSelectedFactoryId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
              >
                {factories.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <Button variant="secondary" onClick={fetchFactoryData} disabled={loading}>
              <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* KPI Cards Strip */}
      {statusData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
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
            subtitle="Across running beams"
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
            title="Beams to Prepare"
            value={statusData.within7_count}
            subtitle={statusData.urgent_machines.length > 0 ? `Urgent: MCN ${statusData.urgent_machines.join(', ')}` : 'No urgent alerts'}
            icon={AlertTriangle}
            color={statusData.urgent_machines.length > 0 ? 'rose' : statusData.within7_count > 0 ? 'amber' : 'green'}
          />
        </div>
      )}

      {/* Machine Status Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Loom Machine Status & Days Remaining
          </h3>
          <span className="text-[11px] text-slate-400">
            Sorted by urgency (days left until beam runout)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">MCN</th>
                <th className="py-2.5 px-3">Quality</th>
                <th className="py-2.5 px-3">Active Beam</th>
                <th className="py-2.5 px-3 text-right">On Loom Mtr</th>
                <th className="py-2.5 px-3 text-right">7-Day Avg m/d</th>
                <th className="py-2.5 px-3 text-right">Days Left</th>
                <th className="py-2.5 px-3">Spare Parked</th>
                <th className="py-2.5 px-3 text-right">Reed</th>
                <th className="py-2.5 px-3 text-center">Alert Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...machines]
                .sort((a, b) => (a.beam ? a.days_left : -1) - (b.beam ? b.days_left : -1))
                .map((m) => {
                  let alertBadge = null;
                  if (!m.beam) {
                    alertBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">Idle — load beam</span>;
                  } else if (m.days_left <= 2 && !m.spare) {
                    alertBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 animate-pulse">Prepare beam now</span>;
                  } else if (m.days_left <= 7 && !m.spare) {
                    alertBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Prepare this week</span>;
                  } else if (m.spare) {
                    alertBadge = <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Spare ready</span>;
                  } else {
                    alertBadge = <span className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-500">Normal</span>;
                  }

                  return (
                    <tr key={m.machine_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">MCN {m.no}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">{m.quality?.name || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">{m.beam?.no || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{m.beam ? formatNum(m.rem) : '—'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{formatNum(m.avg)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                        {m.beam ? (isFinite(m.days_left) ? formatNum(m.days_left, 1) : '—') : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {m.spare ? (
                          <span className="text-emerald-600 font-medium">
                            {m.spare.quality_name} <span className="text-slate-400 font-mono text-[10px]">({m.spare.no})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{m.reed}</td>
                      <td className="py-2.5 px-3 text-center">{alertBadge}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Beams Management Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Beams (Add, Park Spare & Load to Loom)
        </h3>

        {/* Add Beam Form */}
        <form onSubmit={handleAddBeam} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase">New Beam No</label>
            <input
              type="text"
              placeholder="e.g. B201"
              value={bNo}
              onChange={(e) => setBNo(e.target.value)}
              className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs font-mono"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase">Quality</label>
            <select
              value={bQuality}
              onChange={(e) => setBQuality(e.target.value)}
              className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-semibold"
            >
              {qualities.map((q) => (
                <option key={q.id} value={q.id}>{q.name} (Reed {q.reed})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase">Warp Length (m)</label>
            <input
              type="number"
              value={bLength}
              onChange={(e) => setBLength(Number(e.target.value))}
              className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase">Prep Date</label>
            <input
              type="date"
              value={bDate}
              onChange={(e) => setBDate(e.target.value)}
              className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase">Park As Spare For</label>
            <select
              value={bMachine}
              onChange={(e) => setBMachine(e.target.value)}
              className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs"
            >
              <option value="">— Unassigned —</option>
              {machines.map((m) => (
                <option key={m.machine_id} value={m.machine_id}>MCN {m.no} (Reed {m.reed})</option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="primary" className="h-9">
            <Plus size={14} className="mr-1" /> Add Beam
          </Button>
        </form>

        {/* Live Beam Preview Hint */}
        {liveBeamPreview && (
          <div className="text-xs text-slate-500 flex flex-wrap gap-2 items-center px-1">
            <span>
              Warp Yarn needed: <b>{formatNum(liveBeamPreview.warpKg, 1)} kg</b> of {liveBeamPreview.warpYarnName}
            </span>
            <span>(Factory Stock: {formatNum(liveBeamPreview.warpBal, 1)} kg)</span>
            {liveBeamPreview.isShort ? (
              <span className="text-rose-600 font-bold">⚠️ Shortage: {formatNum(liveBeamPreview.warpKg - liveBeamPreview.warpBal, 1)} kg</span>
            ) : (
              <span className="text-emerald-600 font-semibold">✓ Stock Available</span>
            )}
            <span>· Requires Reed {liveBeamPreview.reed} · Estimated weft: {formatNum(liveBeamPreview.weftKg, 1)} kg</span>
          </div>
        )}

        {/* Beams Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Beam No</th>
                <th className="py-2.5 px-3">Quality</th>
                <th className="py-2.5 px-3 text-right">Length (m)</th>
                <th className="py-2.5 px-3 text-right">Remaining (m)</th>
                <th className="py-2.5 px-3 text-right">Warp (kg)</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Machine</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeBeams.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">{b.beam_no}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">{b.quality_name}</td>
                  <td className="py-2.5 px-3 text-right font-medium">{formatNum(b.length)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-blue-600">{formatNum(b.remaining_meters)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500">{formatNum(b.warp_kg, 1)}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        b.status === 'On loom'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                    {b.machine_no ? `MCN ${b.machine_no}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {b.status === 'Spare' ? (
                        <>
                          <select
                            id={`target_m_${b.id}`}
                            defaultValue={b.machine || ''}
                            className="h-7 text-[11px] rounded border border-slate-200 dark:border-slate-700 px-1 font-semibold"
                          >
                            <option value="">Select MCN...</option>
                            {machines.map((m) => (
                              <option key={m.machine_id} value={m.machine_id}>MCN {m.no}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const el = document.getElementById(`target_m_${b.id}`);
                              if (!el.value) return alert('Select target machine');
                              handleLoadToLoom(b.id, el.value);
                            }}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold hover:bg-blue-700"
                          >
                            Load to Loom
                          </button>
                          <button
                            onClick={() => {
                              const el = document.getElementById(`target_m_${b.id}`);
                              handleAssignSpare(b.id, el.value);
                            }}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px] font-semibold hover:bg-slate-200"
                          >
                            Park
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleCutoffBeam(b.id)}
                          className="px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 rounded text-[11px] font-semibold hover:bg-amber-100"
                        >
                          Cut off
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteBeam(b.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!activeBeams.length && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    No active beams in this factory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Factory Yarn Stock & Weft Cover */}
      {statusData?.yarn_cover && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Yarn Stock & Weft Cover Days at this Factory
            </h3>
          </div>
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Yarn</th>
                <th className="py-2.5 px-3 text-right">Balance kg</th>
                <th className="py-2.5 px-3 text-right">Bags</th>
                <th className="py-2.5 px-3 text-right">Weft Use / Day (kg)</th>
                <th className="py-2.5 px-3 text-right font-bold">Days Weft Cover</th>
                <th className="py-2.5 px-3 text-right">Pending Delivery (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {statusData.yarn_cover.map((y) => (
                <tr key={y.yarn_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{y.yarn_name}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">
                    <span className={y.bal < 0 ? 'text-rose-600 font-bold' : ''}>{formatNum(y.bal)}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500">{formatNum(y.bags, 1)}</td>
                  <td className="py-2.5 px-3 text-right">{y.daily > 0 ? formatNum(y.daily, 1) : <span className="text-slate-400">warp only</span>}</td>
                  <td className="py-2.5 px-3 text-right font-bold">
                    {y.days === null ? (
                      <span className="text-slate-400">—</span>
                    ) : y.days <= 5 ? (
                      <span className="text-rose-600 animate-pulse">{formatNum(y.days, 1)} days</span>
                    ) : y.days <= 10 ? (
                      <span className="text-amber-600">{formatNum(y.days, 1)} days</span>
                    ) : (
                      <span className="text-emerald-600">{formatNum(y.days, 1)} days</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-blue-600">{formatNum(y.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
