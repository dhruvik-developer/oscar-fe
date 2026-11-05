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
import { useERP } from '../../../context/ERPContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

export default function DailyLoomEntryPage() {
  const { showToast } = useERP();
  const [deleteEntryConfirmId, setDeleteEntryConfirmId] = useState(null);
  const [pendingSaveWarnings, setPendingSaveWarnings] = useState(null);
  const [factories, setFactories] = useState([]);
  const [selectedFactoryId, setSelectedFactoryId] = useState(
    () => localStorage.getItem('oscar_pms_selected_factory') || ''
  );
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
      if (list.length) {
        const saved = localStorage.getItem('oscar_pms_selected_factory');
        const exists = list.some((f) => f.id === saved);
        if (saved && exists) {
          setSelectedFactoryId(saved);
        } else {
          const activeF =
            list.find((f) => f.name?.toLowerCase().includes('shree laxmi') || f.machines_count > 0) ||
            list[0];
          setSelectedFactoryId(activeF.id);
          localStorage.setItem('oscar_pms_selected_factory', activeF.id);
        }
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

  const executeSaveDay = async () => {
    setSaving(true);
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
      showToast('Day production saved successfully!', 'success');
      fetchDayData();
    } catch (err) {
      showToast(err?.payload?.detail || 'Failed to save daily entries', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDay = async () => {
    if (!selectedFactoryId) {
      showToast('Please select a factory first', 'warning');
      return;
    }
    const warnings = [];

    // Client side check for beam remaining overages
    rows.forEach((r) => {
      if (r.meters && Number(r.meters) > Number(r.remaining_m) + 50) {
        warnings.push(`MCN ${r.machine_no}: ${r.meters} m entered but only ${formatNum(r.remaining_m)} m remaining on beam.`);
      }
    });

    if (warnings.length > 0) {
      setPendingSaveWarnings(warnings);
      return;
    }

    await executeSaveDay();
  };

  const handleDeleteEntry = async (prodId) => {
    try {
      await loomService.deleteDailyProduction(prodId);
      showToast('Daily production entry deleted', 'success');
      fetchDayData();
    } catch (err) {
      showToast('Failed to delete entry', 'error');
    }
  };


  return (
    <div className="pms-screen w-full space-y-3 sm:space-y-3.5">
      <PageHeader
        title="Daily Loom Production Entry"
        subtitle="Single-click coordinator matrix: Log daily machine output, stops, and power cuts across active looms."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDayData}
              disabled={loading}
              className="pms-btn-secondary"
            >
              <RefreshCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleSaveDay}
              disabled={saving || loading}
              className="pms-btn-emerald"
            >
              <Save size={15} className="mr-1.5" />
              {saving ? 'Saving...' : 'Save Day Entries'}
            </button>
          </div>
        }
      />

      {/* Control Bar - Canonical Project Section Heights and Colors */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Factory select */}
            <div className="h-[38px] flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 shadow-2xs">
              <Factory size={15} className="text-slate-400 shrink-0" />
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

            {/* Date Picker */}
            <div className="h-[38px] flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 shadow-2xs">
              <Calendar size={15} className="text-slate-400 shrink-0" />
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              />
            </div>

            {/* Power cut */}
            <div className="h-[38px] flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 shadow-2xs">
              <Zap size={15} className="text-amber-500 shrink-0" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">Power Cut:</span>
              <input
                type="number"
                step="0.5"
                value={powerCut}
                onChange={(e) => setPowerCut(e.target.value)}
                className="w-12 bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none text-right"
              />
              <span className="text-xs text-slate-400">hrs</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMore(!showMore)}
              className="pms-btn-secondary"
            >
              <Sliders size={14} />
              {showMore ? 'Simple View' : 'Show RPM / Hours'}
            </button>
            <button
              type="button"
              onClick={handleSaveDay}
              disabled={saving || loading}
              className="pms-btn-emerald sm:hidden"
            >
              <Save size={14} className="mr-1" /> Save
            </button>
          </div>
        </div>
      </div>

      {/* Grid Entry Table - Fit to screen with sticky headers & horizontal scroll protection */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="pms-table-container max-h-[calc(100vh-250px)]">
          <table className="w-full text-xs text-left">
            <thead className="pms-sticky-header bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 px-3 sticky left-0 bg-slate-50 dark:bg-slate-800 z-20">MCN</th>
                <th className="py-2 px-3">Quality</th>
                <th className="py-2 px-3 text-right">On Loom (m)</th>
                <th className="py-2 px-3">Meters Today</th>
                <th className="py-2 px-3">Stop Reason</th>
                <th className="py-2 px-3 text-right">Damage (m)</th>
                {showMore && (
                  <>
                    <th className="py-2 px-3 text-right">RPM</th>
                    <th className="py-2 px-3 text-right">Hours</th>
                    <th className="py-2 px-3 text-right">Stop (hrs)</th>
                  </>
                )}
                <th className="py-2 px-3 text-center">Status</th>
                <th className="py-2 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => {
                if (!r.has_beam) {
                  return (
                    <tr key={r.machine_id} className="bg-slate-50/40 dark:bg-slate-800/20 text-slate-400">
                      <td className="py-1.5 px-3 font-bold text-slate-500 sticky left-0 bg-slate-50/90 dark:bg-slate-800/90">
                        MCN {r.machine_no}
                      </td>
                      <td colSpan={showMore ? 8 : 5} className="py-1.5 px-3 italic text-[11px]">
                        No beam on loom (Idle — park/load a beam to log output)
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-500">Idle</span>
                      </td>
                      <td className="py-1.5 px-3 text-center">—</td>
                    </tr>
                  );
                }

                return (
                  <tr key={r.machine_id} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-1.5 px-3 font-bold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-xs">
                      MCN {r.machine_no}
                    </td>
                    <td className="py-1.5 px-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {r.quality_name}
                      <span className="text-slate-400 font-mono text-[10px] ml-1.5">({r.beam_no})</span>
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono text-slate-500">
                      {formatNum(r.remaining_m)}
                    </td>
                    <td className="py-1 px-3">
                      <input
                        type="number"
                        placeholder="0"
                        value={r.meters}
                        onChange={(e) => handleRowChange(r.machine_id, 'meters', e.target.value)}
                        className="w-20 sm:w-24 px-2 py-1 text-xs font-mono font-bold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </td>
                    <td className="py-1 px-3">
                      <select
                        value={r.reason || ''}
                        onChange={(e) => handleRowChange(r.machine_id, 'reason', e.target.value)}
                        className="h-7 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 font-medium outline-none cursor-pointer"
                      >
                        <option value="">Normal</option>
                        <option value="Yarn short">Yarn short</option>
                        <option value="Breakdown">Breakdown</option>
                        <option value="Beam change">Beam change</option>
                        <option value="Power">Power</option>
                        <option value="Labour">Labour</option>
                        <option value="Other">Other</option>
                      </select>
                    </td>
                    <td className="py-1 px-3 text-right">
                      <input
                        type="number"
                        placeholder="0"
                        value={r.damage}
                        onChange={(e) => handleRowChange(r.machine_id, 'damage', e.target.value)}
                        className="w-14 px-1.5 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-right outline-none"
                      />
                    </td>
                    {showMore && (
                      <>
                        <td className="py-1 px-3 text-right">
                          <input
                            type="number"
                            value={r.rpm}
                            onChange={(e) => handleRowChange(r.machine_id, 'rpm', e.target.value)}
                            className="w-16 px-1.5 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 text-right outline-none"
                          />
                        </td>
                        <td className="py-1 px-3 text-right">
                          <input
                            type="number"
                            value={r.hours}
                            onChange={(e) => handleRowChange(r.machine_id, 'hours', e.target.value)}
                            className="w-14 px-1.5 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 text-right outline-none"
                          />
                        </td>
                        <td className="py-1 px-3 text-right">
                          <input
                            type="number"
                            value={r.stop}
                            onChange={(e) => handleRowChange(r.machine_id, 'stop', e.target.value)}
                            className="w-14 px-1.5 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 text-right outline-none"
                          />
                        </td>
                      </>
                    )}
                    <td className="py-1.5 px-3 text-center">
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
                    <td className="py-1.5 px-3 text-center">
                      {r.done && r.prod_id && (
                        <button
                          onClick={() => setDeleteEntryConfirmId(r.prod_id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
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

      <ConfirmModal
        isOpen={Boolean(deleteEntryConfirmId)}
        onClose={() => setDeleteEntryConfirmId(null)}
        onConfirm={async () => {
          const id = deleteEntryConfirmId;
          setDeleteEntryConfirmId(null);
          await handleDeleteEntry(id);
        }}
        title="Delete Daily Production Entry"
        message="Are you sure you want to delete this filed production entry? This will adjust the remaining beam meters."
        confirmText="Delete Entry"
        variant="danger"
      />

      <ConfirmModal
        isOpen={Boolean(pendingSaveWarnings && pendingSaveWarnings.length > 0)}
        onClose={() => setPendingSaveWarnings(null)}
        onConfirm={async () => {
          setPendingSaveWarnings(null);
          await executeSaveDay();
        }}
        title="Production Meters Warning"
        message={
          <div className="space-y-2 text-xs">
            <p className="font-semibold text-slate-700 dark:text-slate-200">The entered meters exceed remaining beam meters:</p>
            <ul className="list-disc pl-4 space-y-1 text-amber-700 dark:text-amber-400">
              {pendingSaveWarnings?.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
            <p className="text-slate-500 pt-1">Do you want to proceed and save anyway?</p>
          </div>
        }
        confirmText="Proceed & Save"
        cancelText="Review Meters"
        variant="warning"
      />
    </div>
  );
}
