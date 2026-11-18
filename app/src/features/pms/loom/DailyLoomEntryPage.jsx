import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
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
  Share2,
  Check,
  Building2,
  ShieldCheck,
  AlertCircle,
  Radio,
  Smartphone,
  Wifi,
  Copy,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import TablePagination from '../../../components/ui/TablePagination';
import { Modal } from '../../../components/ui/Modal';
import { loomService } from '../../../services/loomService';
import { formatNum, preventNegativeInput, clampNonNegative } from '../utils/loomCalculations';
import { useERP } from '../../../context/ERPContext';
import { useAppStore } from '../../../stores/appStore';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import CompanySelector from './components/CompanySelector';
import DatePicker from './components/DatePicker';

/**
 * Checks whether user has Administrator, Admin, or General Manager privileges.
 * Regular employees / field staff / coordinators are restricted to their assigned factories.
 */
export function isLoomAdminOrManager(user) {
  if (!user) return false;
  const roleCode = (
    user.roleCode ||
    user.role?.code ||
    (typeof user.role === 'string' ? user.role : '') ||
    ''
  ).toUpperCase();
  const roleName = (
    user.role?.name ||
    (typeof user.role === 'string' ? user.role : '') ||
    ''
  ).toLowerCase();

  // If role explicitly indicates staff/employee/coordinator, they are restricted to assigned factories
  if (['PROD_STAFF', 'PC', 'PROD_COORD', 'EMPLOYEE', 'STAFF'].includes(roleCode)) {
    return false;
  }
  if (roleName.includes('employee') || roleName.includes('field staff')) {
    return false;
  }

  // Superuser check
  if (user.isSuperuser || user.is_superuser) return true;

  // Admin / General Manager / Owner / Management
  const adminCodes = ['SYS_ADMIN', 'ADMIN', 'AD', 'OWNER', 'GM', 'GENERAL_MANAGER', 'MGMT'];
  if (adminCodes.includes(roleCode)) return true;

  const adminKeywords = ['administrator', 'admin', 'general manager', 'owner', 'management', 'gm'];
  return adminKeywords.some((kw) => roleName.includes(kw));
}

export default function DailyLoomEntryPage() {
  const { showToast } = useERP();
  const currentUser = useAppStore((s) => s.currentUser);
  const isAdminOrGM = useMemo(() => isLoomAdminOrManager(currentUser), [currentUser]);

  const [searchParams, setSearchParams] = useSearchParams();
  const urlFactoryId = searchParams.get('factory');
  const urlDate = searchParams.get('date');

  const [deleteEntryConfirmId, setDeleteEntryConfirmId] = useState(null);
  const [pendingSaveWarnings, setPendingSaveWarnings] = useState(null);
  const [factories, setFactories] = useState([]);
  const [selectedFactoryId, setSelectedFactoryId] = useState(
    () => urlFactoryId || localStorage.getItem('oscar_pms_selected_factory') || ''
  );
  const [dateStr, setDateStr] = useState(
    () => (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) ? urlDate : new Date().toISOString().slice(0, 10))
  );
  const [powerCut, setPowerCut] = useState(0);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);

  // Track if user is actively editing rows to avoid live-sync overwriting their input
  const isDirtyRef = useRef(false);

  const selectedFactory = useMemo(() => {
    return factories.find((f) => f.id === selectedFactoryId) || factories[0] || null;
  }, [factories, selectedFactoryId]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  // Generates mobile-friendly URL: automatically replaces "localhost" with LAN IP (e.g. 192.168.1.8) so mobile phones can connect
  const getShareableUrl = useCallback(() => {
    let baseOrigin = window.location.origin;
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    const lanIp = import.meta.env?.VITE_LAN_IP;

    if (isLocalhost && lanIp) {
      baseOrigin = `${window.location.protocol}//${lanIp}:${window.location.port || '5173'}`;
    }
    return `${baseOrigin}/pms/loom-daily?factory=${selectedFactoryId}&date=${dateStr}&standalone=1`;
  }, [selectedFactoryId, dateStr]);

  // Generate QR code whenever the share modal is open
  useEffect(() => {
    if (showShareModal) {
      const url = getShareableUrl();
      QRCode.toDataURL(url, {
        width: 200,
        margin: 1.5,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then((dataUrl) => setQrCodeDataUrl(dataUrl))
        .catch((err) => console.error('Failed to generate QR code:', err));
    }
  }, [showShareModal, getShareableUrl]);

  // Keep URL query params in sync with currently selected factory and date
  const updateUrlParams = useCallback((factoryId, date) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (factoryId) next.set('factory', factoryId);
        if (date) next.set('date', date);
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const handleSelectFactory = (val) => {
    setSelectedFactoryId(val);
    localStorage.setItem('oscar_pms_selected_factory', val);
    updateUrlParams(val, dateStr);
  };

  const handleChangeDate = (val) => {
    setDateStr(val);
    updateUrlParams(selectedFactoryId, val);
  };

  // Copy or share direct link (Supports Web Share API on Mobile like WhatsApp and opens QR modal on PC)
  const handleCopyLink = async () => {
    const url = getShareableUrl();
    const shareData = {
      title: 'Daily Loom Production Entry',
      text: `Daily Loom Entry for ${selectedFactory?.name || 'Unit'} (${dateStr})`,
      url,
    };

    if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Copy to clipboard and open QR modal
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopiedLink(true);
        setShowShareModal(true);
        showToast(
          `Mobile link copied! (Network IP: ${import.meta.env?.VITE_LAN_IP || 'LAN'})`,
          'success'
        );
        setTimeout(() => setCopiedLink(false), 2500);
      })
      .catch(() => {
        setShowShareModal(true);
      });
  };

  const loadFactories = async () => {
    try {
      const res = await loomService.getFactories();
      const list = Array.isArray(res) ? res : res?.results || [];
      setFactories(list);

      if (list.length > 0) {
        let chosenId = '';
        // 1. If factory in URL matches an allowed factory
        if (urlFactoryId && list.some((f) => f.id === urlFactoryId)) {
          chosenId = urlFactoryId;
        } else if (urlFactoryId && !isAdminOrGM) {
          // Employee tried opening a link for an unassigned factory
          showToast(
            'The factory in the shared link is not assigned to your account. Showing your assigned unit instead.',
            'warning'
          );
          chosenId = list[0].id;
        } else {
          // 2. Saved factory from localStorage if valid
          const saved = localStorage.getItem('oscar_pms_selected_factory');
          const exists = list.some((f) => f.id === saved);
          if (saved && exists) {
            chosenId = saved;
          } else {
            // 3. Fallback to active unit or first assigned unit
            const activeF =
              list.find((f) => f.name?.toLowerCase().includes('shree laxmi') || f.machines_count > 0) ||
              list[0];
            chosenId = activeF.id;
          }
        }
        setSelectedFactoryId(chosenId);
        localStorage.setItem('oscar_pms_selected_factory', chosenId);
        updateUrlParams(chosenId, dateStr);
      } else {
        setSelectedFactoryId('');
      }
    } catch (err) {
      console.error('Failed to load factories:', err);
    }
  };

  const fetchDayData = useCallback(async (silent = false) => {
    if (!selectedFactoryId || !dateStr) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await loomService.getFactoryDayProduction(selectedFactoryId, dateStr);
      setPowerCut(res?.power || 0);
      setRows(res?.rows || []);
      setLastSyncedAt(new Date());
      isDirtyRef.current = false;
    } catch (err) {
      if (!silent) {
        if (err?.status === 403 || err?.payload?.detail?.includes('access')) {
          showToast('You do not have access to this factory. Please select your assigned unit.', 'error');
        } else {
          console.error('Failed to load day production:', err);
        }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedFactoryId, dateStr, showToast]);

  useEffect(() => {
    loadFactories();
  }, [currentUser]);

  useEffect(() => {
    fetchDayData();
  }, [fetchDayData]);

  // Live Connectivity: Listen to cross-tab BroadcastChannel
  useEffect(() => {
    let channel;
    try {
      channel = new BroadcastChannel('oscar_loom_live_sync');
      channel.onmessage = (event) => {
        const data = event.data;
        if (data?.type === 'LOOM_DAILY_ENTRY_SAVED') {
          if (data.factoryId === selectedFactoryId && data.date === dateStr) {
            showToast(`🟢 Live Update: ${data.userName} just registered daily entries for this unit!`, 'info');
            fetchDayData(true);
          } else if (isAdminOrGM) {
            showToast(`📢 Live Alert: ${data.userName} filed daily entries for ${data.factoryName || 'a unit'}.`, 'info');
          }
        }
      };
    } catch (e) {
      // BroadcastChannel unsupported in older browsers
    }
    return () => {
      try {
        channel?.close();
      } catch (e) {}
    };
  }, [selectedFactoryId, dateStr, isAdminOrGM, fetchDayData, showToast]);

  // Live Connectivity: Periodic smart background polling (every 10 seconds)
  useEffect(() => {
    if (!selectedFactoryId || !dateStr) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isDirtyRef.current && !saving) {
        setIsLiveSyncing(true);
        loomService
          .getFactoryDayProduction(selectedFactoryId, dateStr)
          .then((res) => {
            setLastSyncedAt(new Date());
            if (res?.rows && !isDirtyRef.current) {
              setRows((prev) => {
                const differs = res.rows.some((sr, idx) => {
                  const pr = prev[idx];
                  return pr && (pr.meters !== sr.meters || pr.done !== sr.done);
                });
                return differs ? res.rows : prev;
              });
              if (res.power !== undefined) {
                setPowerCut(res.power || 0);
              }
            }
          })
          .catch(() => {})
          .finally(() => setIsLiveSyncing(false));
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedFactoryId, dateStr, saving]);

  const handleRowChange = (machineId, field, val) => {
    isDirtyRef.current = true;
    let sanitizedVal = val;
    const numericFields = ['meters', 'damage', 'rpm', 'hours', 'stop'];
    if (numericFields.includes(field)) {
      if (val === '') {
        sanitizedVal = '';
      } else {
        const num = parseFloat(val);
        sanitizedVal = isNaN(num) || num < 0 ? 0 : field === 'hours' && num > 24 ? 24 : num;
      }
    }
    setRows((prev) =>
      prev.map((r) => {
        if (r.machine_id === machineId) {
          return { ...r, [field]: sanitizedVal };
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
      isDirtyRef.current = false;
      showToast('Day production saved successfully!', 'success');

      // Live broadcast to all other tabs and users
      try {
        const channel = new BroadcastChannel('oscar_loom_live_sync');
        channel.postMessage({
          type: 'LOOM_DAILY_ENTRY_SAVED',
          factoryId: selectedFactoryId,
          factoryName: selectedFactory?.name || '',
          date: dateStr,
          userName: currentUser?.name || 'Production Staff',
          timestamp: Date.now(),
        });
        channel.close();
      } catch (err) {}

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

    const hasNegative =
      rows.some(
        (r) =>
          (r.meters !== '' && Number(r.meters) < 0) ||
          Number(r.damage || 0) < 0 ||
          Number(r.rpm || 0) < 0 ||
          Number(r.hours || 0) < 0 ||
          Number(r.stop || 0) < 0
      ) || Number(powerCut || 0) < 0;

    if (hasNegative) {
      showToast('Negative values are not allowed. Please enter 0 or greater.', 'error');
      return;
    }

    const warnings = [];

    // Client side check for beam remaining overages
    rows.forEach((r) => {
      if (r.meters && Number(r.meters) > Number(r.remaining_m) + 50) {
        warnings.push(
          `MCN ${r.machine_no}: ${r.meters} m entered but only ${formatNum(r.remaining_m)} m remaining on beam.`
        );
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
    <div className="pms-screen w-full space-y-6">
      <PageHeader
        title="Daily Loom Production Entry"
        subtitle="Single-click coordinator matrix: Log daily machine output, stops, and power cuts across active looms."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Share / Direct Link Button */}
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy shareable link for this daily entry"
              className="pms-btn-secondary"
            >
              {copiedLink ? (
                <>
                  <Check size={14} className="mr-1 text-emerald-600 dark:text-emerald-400" />
                  Link Copied!
                </>
              ) : (
                <>
                  <Share2 size={14} className="mr-1" />
                  Share Link
                </>
              )}
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchDayData()}
              disabled={loading}
              className="pms-btn-secondary"
            >
              <RefreshCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {/* Save Day Entries */}
            <button
              type="button"
              onClick={handleSaveDay}
              disabled={saving || loading || !selectedFactoryId}
              className="pms-btn-emerald"
            >
              <Save size={15} className="mr-1.5" />
              {saving ? 'Saving...' : 'Save Day Entries'}
            </button>
          </div>
        }
      />

      {/* Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Factory select with permission scoping */}
            <CompanySelector
              factories={factories}
              selectedFactoryId={selectedFactoryId}
              align="left"
              onSelect={handleSelectFactory}
            />

            {/* Date Picker */}
            <DatePicker value={dateStr} onChange={handleChangeDate} align="left" />

            {/* Power cut */}
            <div className="h-[38px] flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 shadow-2xs">
              <Zap size={15} className="text-amber-500 shrink-0" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                Power Cut:
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={powerCut}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setPowerCut('');
                  } else {
                    const num = parseFloat(val);
                    setPowerCut(isNaN(num) || num < 0 ? 0 : num);
                  }
                }}
                onKeyDown={preventNegativeInput}
                className="w-12 bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none text-right"
              />
              <span className="text-xs text-slate-400">hrs</span>
            </div>

            {/* Role Scope Pill */}
            {isAdminOrGM ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <ShieldCheck size={13} className="text-blue-600 dark:text-blue-400" />
                Admin / GM View (All Units)
              </span>
            ) : selectedFactory ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <Building2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                Assigned Unit: {selectedFactory.name}
              </span>
            ) : null}

            {/* Live Connectivity Badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
              title={`Live real-time connectivity active. ${lastSyncedAt ? `Last checked: ${lastSyncedAt.toLocaleTimeString()}` : ''}`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-[11px]">Live Connected</span>
              {isLiveSyncing && (
                <span className="text-[10px] text-emerald-500 animate-pulse ml-0.5">syncing...</span>
              )}
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
              disabled={saving || loading || !selectedFactoryId}
              className="pms-btn-emerald sm:hidden"
            >
              <Save size={14} className="mr-1" /> Save
            </button>
          </div>
        </div>
      </div>

      {/* Empty State: If Employee has NO factory assigned */}
      {!loading && factories.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center space-y-2.5 shadow-2xs">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle size={22} />
          </div>
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
            No Manufacturing Factory Assigned
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-400 max-w-md mx-auto">
            Your employee account ({currentUser?.name || 'Field Staff'}) is not currently assigned to any factory or project.
            Please contact an Administrator, Admin, or General Manager to assign a production unit to your profile.
          </p>
        </div>
      )}

      {/* Grid Entry Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="pms-table-container overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="pms-sticky-header bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3 sticky left-0 bg-slate-50 dark:bg-slate-800 z-20">MCN</th>
                <th className="py-2.5 px-3">Quality</th>
                <th className="py-2.5 px-3 text-right">On Loom (m)</th>
                <th className="py-2.5 px-3">Meters Today</th>
                <th className="py-2.5 px-3">Stop Reason</th>
                <th className="py-2.5 px-3 text-right">Damage (m)</th>
                {showMore && (
                  <>
                    <th className="py-2.5 px-3 text-right">RPM</th>
                    <th className="py-2.5 px-3 text-right">Hours</th>
                    <th className="py-2.5 px-3 text-right">Stop (hrs)</th>
                  </>
                )}
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedRows.map((r) => {
                if (!r.has_beam) {
                  return (
                    <tr
                      key={r.machine_id}
                      className="bg-slate-50/40 dark:bg-slate-800/20 text-slate-400"
                    >
                      <td className="py-1.5 px-3 font-bold text-slate-500 sticky left-0 bg-slate-50/90 dark:bg-slate-800/90">
                        MCN {r.machine_no}
                      </td>
                      <td colSpan={showMore ? 8 : 5} className="py-1.5 px-3 italic text-[11px]">
                        No beam on loom (Idle — park/load a beam to log output)
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                          Idle
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center">—</td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={r.machine_id}
                    className="hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-1.5 px-3 font-bold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-xs">
                      MCN {r.machine_no}
                    </td>
                    <td className="py-1.5 px-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {r.quality_name}
                      <span className="text-slate-400 font-mono text-[10px] ml-1.5">
                        ({r.beam_no})
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono text-slate-500">
                      {formatNum(r.remaining_m)}
                    </td>
                    <td className="py-1 px-3">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        placeholder="0"
                        value={r.meters ?? ''}
                        onChange={(e) => handleRowChange(r.machine_id, 'meters', e.target.value)}
                        onKeyDown={preventNegativeInput}
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
                        inputMode="decimal"
                        min="0"
                        placeholder="0"
                        value={r.damage ?? ''}
                        onChange={(e) => handleRowChange(r.machine_id, 'damage', e.target.value)}
                        onKeyDown={preventNegativeInput}
                        className="w-14 px-1.5 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-right outline-none"
                      />
                    </td>
                    {showMore && (
                      <>
                        <td className="py-1 px-3 text-right">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={r.rpm ?? ''}
                            onChange={(e) => handleRowChange(r.machine_id, 'rpm', e.target.value)}
                            onKeyDown={preventNegativeInput}
                            className="w-16 px-1.5 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 text-right outline-none"
                          />
                        </td>
                        <td className="py-1 px-3 text-right">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="24"
                            value={r.hours ?? ''}
                            onChange={(e) => handleRowChange(r.machine_id, 'hours', e.target.value)}
                            onKeyDown={preventNegativeInput}
                            className="w-14 px-1.5 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 text-right outline-none"
                          />
                        </td>
                        <td className="py-1 px-3 text-right">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={r.stop ?? ''}
                            onChange={(e) => handleRowChange(r.machine_id, 'stop', e.target.value)}
                            onKeyDown={preventNegativeInput}
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
                      {r.done && r.prod_id ? (
                        <button
                          onClick={() => setDeleteEntryConfirmId(r.prod_id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded transition-colors inline-flex items-center justify-center"
                          title="Delete filed row"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 font-mono text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={showMore ? 11 : 8} className="py-8 text-center text-slate-400">
                    {factories.length === 0
                      ? 'No assigned factory available.'
                      : 'No machines configured for this factory.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          total={rows.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          pageSizeOptions={[10, 20, 25, 50, 100]}
        />
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
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              The entered meters exceed remaining beam meters:
            </p>
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

      {/* Share & Mobile QR Code Modal */}
      <Modal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Daily Loom Entry Link"
        subtitle="Open directly on mobile phone or send to assigned operators"
        size="md"
      >
        <div className="space-y-4 py-2 text-slate-800 dark:text-slate-100">
          {/* QR Code Section */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt="Scan to open on phone"
                className="w-48 h-48 rounded-xl shadow-xs border-2 border-white dark:border-slate-700"
              />
            ) : (
              <div className="w-48 h-48 bg-slate-200 animate-pulse rounded-xl" />
            )}
            <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Smartphone size={15} className="text-emerald-500" />
              Scan with phone camera to open on mobile
            </p>
          </div>

          {/* Link box */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Direct Mobile Network Link:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={getShareableUrl()}
                className="w-full text-xs font-mono px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none select-all"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(getShareableUrl());
                  setCopiedLink(true);
                  showToast('Mobile link copied to clipboard!', 'success');
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="pms-btn-emerald shrink-0"
              >
                {copiedLink ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* WhatsApp Share Button - sends pure URL so WhatsApp recognizes it as a clickable link */}
          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(getShareableUrl())}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#25D366] hover:bg-[#20ba59] transition-colors shadow-2xs"
          >
            <Share2 size={14} /> Send Link on WhatsApp
          </a>

          {/* Network Explanation Box */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs space-y-1.5 text-blue-900 dark:text-blue-200">
            <p className="font-bold flex items-center gap-1.5 text-blue-900 dark:text-blue-200">
              <Wifi size={14} className="text-blue-600 dark:text-blue-400" /> Why "localhost" cannot be opened on mobile:
            </p>
            <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
              <b>localhost</b> only exists inside this computer. For a mobile phone, connect the phone to the <b>same Wi-Fi or mobile hotspot</b> as this computer and open the IP address (<b>{import.meta.env?.VITE_LAN_IP || '192.168.1.8'}</b>).
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
