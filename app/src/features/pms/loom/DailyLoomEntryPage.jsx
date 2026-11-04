import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Save,
  Trash2,
  RefreshCw,
  Factory,
  Zap,
  Sliders,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { loomService } from '../../../services/loomService';
import { formatNum } from '../utils/loomCalculations';

export default function DailyLoomEntryPage() {
  const [factories, setFactories] = useState([]);
  const [selectedFactoryId, setSelectedFactoryId] = useState('');
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [powerCut, setPowerCut] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const loadFactories = async () => {
    try {
      const res = await loomService.getFactories();
      const list = Array.isArray(res) ? res : res?.results || [];
      setFactories(list);
      if (list.length && !selectedFactoryId) {
        setSelectedFactoryId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load factories:', err);
    }
  };

  const fetchDayData = useCallback(async () => {
    if (!selectedFactoryId || !dateStr) return;
    setLoading(true);
    try {
      const res = await loomService.getFactoryDayProduction(selectedFactoryId, dateStr);
      setPowerCut(res?.power || 0);
      setRows(res?.rows || []);
    } catch (err) {
      console.error('Failed to load day production:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedFactoryId, dateStr]);

  useEffect(() => {
    loadFactories();
  }, []);

  useEffect(() => {
    fetchDayData();
  }, [fetchDayData]);

  const handleRowChange = (machineId, field, val) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.machine_id === machineId) {
          return { ...r, [field]: val };
        }
        return r;
      })
    );
  };

  const handleSaveDay = async () => {
    if (!selectedFactoryId) return alert('Select factory');
    setSaving(true);
    const warnings = [];

    // Client side check for beam remaining overages
    rows.forEach((r) => {
      if (r.meters && Number(r.meters) > Number(r.remaining_m) + 50) {
        warnings.push(`MCN ${r.machine_no}: ${r.meters} m entered but only ${formatNum(r.remaining_m)} m remaining on beam.`);
      }
    });

    if (warnings.length > 0) {
      if (!confirm(`Warning on entered meters:\n\n${warnings.join('\n')}\n\nDo you want to proceed and save?`)) {
        setSaving(false);
        return;
      }
    }

    try {
      await loomService.bulkSaveDailyProduction({
        factory_id: selectedFactoryId,
        date: dateStr,
        power: Number(powerCut),
        rows: rows.map((r) => ({
          machine_id: r.machine_id,
          beam_id: r.beam_id,
          meters: r.meters !== '' ? Number(r.meters) : null,
          rpm: Number(r.rpm || 650),
          hours: Number(r.hours || 22),
          stop: Number(r.stop || 0),
          reason: r.reason || '',
          damage: Number(r.damage || 0),
        })),
      });
      alert('Day production saved successfully!');
      fetchDayData();
    } catch (err) {
      alert(err?.payload?.detail || 'Failed to save daily entries');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (prodId) => {
    if (!confirm('Delete this filed entry?')) return;
    try {
      await loomService.deleteDailyProduction(prodId);
      fetchDayData();
    } catch (err) {
      alert('Failed to delete entry');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Loom Production Entry"
        subtitle="Rapid coordinator matrix: Enter daily meters, power outages and stop reasons across active looms."
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={fetchDayData} disabled={loading}>
              <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="primary" onClick={handleSaveDay} disabled={saving || loading}>
              <Save size={14} className="mr-1.5" />
              {saving ? 'Saving...' : 'Save Day Entries'}
            </Button>
          </div>
        }
      />

      {/* Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Factory select */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">Factory</label>
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 h-9">
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
            </div>

            {/* Date Picker */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">Entry Date</label>
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 h-9">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
            </div>

            {/* Power cut */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">Power Cut (hrs today)</label>
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 h-9 w-32">
                <Zap size={14} className="text-amber-500" />
                <input
                  type="number"
                  step="0.5"
                  value={powerCut}
                  onChange={(e) => setPowerCut(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">&nbsp;</label>
            <Button
              variant="secondary"
              onClick={() => setShowMore(!showMore)}
              className="text-xs h-9 flex items-center gap-1.5"
            >
              <Sliders size={13} />
              {showMore ? 'Hide RPM & Hours' : 'Show RPM & Hours'}
            </Button>
          </div>
        </div>
      </div>

      {/* Grid Entry Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">MCN</th>
                <th className="py-2.5 px-3">Quality</th>
                <th className="py-2.5 px-3 text-right">On Loom (m)</th>
                <th className="py-2.5 px-3">Meters Today</th>
                <th className="py-2.5 px-3">Stop Reason</th>
                <th className="py-2.5 px-3">Damage (m)</th>
                {showMore && (
                  <>
                    <th className="py-2.5 px-3">RPM</th>
                    <th className="py-2.5 px-3">Hours</th>
                    <th className="py-2.5 px-3">Stop (hrs)</th>
                  </>
                )}
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => {
                if (!r.has_beam) {
                  return (
                    <tr key={r.machine_id} className="bg-slate-50/30 dark:bg-slate-800/20 text-slate-400">
                      <td className="py-2.5 px-3 font-bold text-slate-500">MCN {r.machine_no}</td>
                      <td colSpan={showMore ? 8 : 5} className="py-2.5 px-3 italic">
                        No beam on loom (Idle — park a beam to record daily output)
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">Idle</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">—</td>
                    </tr>
                  );
                }

                return (
                  <tr key={r.machine_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                      MCN {r.machine_no}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {r.quality_name}
                      <span className="text-slate-400 font-mono text-[10px] ml-1.5">({r.beam_no})</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-500">
                      {formatNum(r.remaining_m)}
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        placeholder="0"
                        value={r.meters}
                        onChange={(e) => handleRowChange(r.machine_id, 'meters', e.target.value)}
                        className="w-24 px-2 py-1 text-xs font-semibold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={r.reason || ''}
                        onChange={(e) => handleRowChange(r.machine_id, 'reason', e.target.value)}
                        className="h-7 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 font-medium outline-none"
                      >
                        <option value="">Normal (no stoppage)</option>
                        <option value="Yarn short">Yarn short</option>
                        <option value="Breakdown">Breakdown</option>
                        <option value="Beam change">Beam change</option>
                        <option value="Power">Power</option>
                        <option value="Labour">Labour</option>
                        <option value="Other">Other</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        placeholder="0"
                        value={r.damage}
                        onChange={(e) => handleRowChange(r.machine_id, 'damage', e.target.value)}
                        className="w-16 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-right outline-none"
                      />
                    </td>
                    {showMore && (
                      <>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={r.rpm}
                            onChange={(e) => handleRowChange(r.machine_id, 'rpm', e.target.value)}
                            className="w-16 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-right outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={r.hours}
                            onChange={(e) => handleRowChange(r.machine_id, 'hours', e.target.value)}
                            className="w-14 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-right outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={r.stop}
                            onChange={(e) => handleRowChange(r.machine_id, 'stop', e.target.value)}
                            className="w-14 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 text-right outline-none"
                          />
                        </td>
                      </>
                    )}
                    <td className="py-2.5 px-3 text-center">
                      {r.done ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Filed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {r.done && r.prod_id && (
                        <button
                          onClick={() => handleDeleteEntry(r.prod_id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded"
                          title="Delete filed row"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No machines configured for this factory.
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
