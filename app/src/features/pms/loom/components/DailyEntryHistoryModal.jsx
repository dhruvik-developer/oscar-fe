import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Search,
  Download,
  RefreshCw,
  Building2,
  Clock,
  User,
  Activity,
  Layers,
  AlertTriangle,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import TablePagination from '../../../../components/ui/TablePagination';
import { loomService } from '../../../../services/loomService';
import { formatNum } from '../../utils/loomCalculations';

export default function DailyEntryHistoryModal({
  isOpen,
  onClose,
  factoryId,
  factories = [],
  initialDate,
  isAdminOrGM = false,
}) {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [selectedFactory, setSelectedFactory] = useState(factoryId || '');
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'last7', 'this_month', 'custom'
  const [customDate, setCustomDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    if (factoryId) {
      setSelectedFactory(factoryId);
    }
  }, [factoryId]);

  const fetchLogs = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const params = {};
      if (selectedFactory) {
        params.factory = selectedFactory;
      }
      if (dateFilter === 'today') {
        params.date = new Date().toISOString().slice(0, 10);
      } else if (dateFilter === 'custom' && customDate) {
        params.date = customDate;
      }
      // Fetch up to 1000 recent logs
      params.page_size = 500;

      const res = await loomService.getDailyProductionHistory(params);
      const list = Array.isArray(res) ? res : res?.results || [];
      setLogs(list);
    } catch (err) {
      console.error('Failed to fetch daily production logs:', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, selectedFactory, dateFilter, customDate]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Client-side date filtering for multi-day ranges (e.g. last 7 days, this month)
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (dateFilter === 'last7') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const minDate = d.toISOString().slice(0, 10);
      result = result.filter((item) => (item.date || '') >= minDate);
    } else if (dateFilter === 'this_month') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      result = result.filter((item) => (item.date || '').startsWith(currentMonth));
    }

    if (reasonFilter !== 'all') {
      result = result.filter((item) => (item.reason || 'Normal') === reasonFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        const mcn = String(item.machine_no || '').toLowerCase();
        const qual = (item.quality_name || '').toLowerCase();
        const beam = (item.beam_no || '').toLowerCase();
        const user = (item.created_by_name || item.updated_by_name || '').toLowerCase();
        const fac = (item.factory_name || '').toLowerCase();
        return mcn.includes(q) || qual.includes(q) || beam.includes(q) || user.includes(q) || fac.includes(q);
      });
    }

    return result;
  }, [logs, dateFilter, reasonFilter, searchQuery]);

  // Summary Metrics
  const summary = useMemo(() => {
    const totalMeters = filteredLogs.reduce((acc, r) => acc + (Number(r.meters) || 0), 0);
    const totalDamage = filteredLogs.reduce((acc, r) => acc + (Number(r.damage) || 0), 0);
    const uniqueMachines = new Set(filteredLogs.map((r) => r.machine || r.machine_no)).size;
    return {
      count: filteredLogs.length,
      meters: totalMeters,
      damage: totalDamage,
      machines: uniqueMachines,
    };
  }, [filteredLogs]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

  // Export filtered logs to CSV
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;
    const headers = [
      'Date',
      'Factory',
      'Machine No',
      'Quality',
      'Beam No',
      'Meters (m)',
      'RPM',
      'Hours',
      'Stop Reason',
      'Damage (m)',
      'Logged By',
      'Last Updated',
    ];

    const csvRows = filteredLogs.map((r) => [
      r.date || '',
      `"${r.factory_name || ''}"`,
      r.machine_no || '',
      `"${r.quality_name || ''}"`,
      r.beam_no || '',
      r.meters || 0,
      r.rpm || 650,
      r.hours || 22,
      `"${r.reason || 'Normal'}"`,
      r.damage || 0,
      `"${r.updated_by_name || r.created_by_name || 'Coordinator'}"`,
      r.updated_at ? new Date(r.updated_at).toLocaleString() : '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Daily_Production_Logs_${dateFilter}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daily Loom Production — Entry History & Audit Log"
      size="xl"
    >
      <div className="space-y-4">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
              Total Output
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono text-blue-900 dark:text-blue-100">
                {formatNum(summary.meters)}
              </span>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">m</span>
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              Total Entries Logged
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono text-emerald-900 dark:text-emerald-100">
                {summary.count}
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">records</span>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
              Looms Recorded
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono text-purple-900 dark:text-purple-100">
                {summary.machines}
              </span>
              <span className="text-xs text-purple-600 dark:text-purple-400">looms</span>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Reported Damage
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono text-amber-900 dark:text-amber-100">
                {formatNum(summary.damage)}
              </span>
              <span className="text-xs text-amber-600 dark:text-amber-400">m</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            {/* Factory select (Admin/GM can see all) */}
            {isAdminOrGM && (
              <select
                value={selectedFactory}
                onChange={(e) => {
                  setSelectedFactory(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 font-medium"
              >
                <option value="">All Factories / Units</option>
                {factories.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}

            {/* Date filter dropdown */}
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 font-medium"
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
              <option value="last7">Last 7 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Specific Date...</option>
            </select>

            {dateFilter === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 font-mono"
              />
            )}

            {/* Stop reason filter */}
            <select
              value={reasonFilter}
              onChange={(e) => {
                setReasonFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 font-medium"
            >
              <option value="all">All Stop Reasons</option>
              <option value="Normal">Normal</option>
              <option value="Yarn short">Yarn short</option>
              <option value="Breakdown">Breakdown</option>
              <option value="Beam change">Beam change</option>
              <option value="Power">Power</option>
              <option value="Labour">Labour</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Search input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search MCN, quality, user..."
                className="h-8 pl-8 pr-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 w-44 sm:w-56 outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              title="Refresh logs"
              className="pms-btn-secondary h-8 px-2.5"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredLogs.length === 0}
              title="Export filtered records to CSV"
              className="pms-btn-secondary h-8 px-2.5 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <Download size={13} className="mr-1" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="pms-table-container border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-[460px] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="pms-sticky-header bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Unit / Factory</th>
                <th className="py-2.5 px-3">MCN</th>
                <th className="py-2.5 px-3">Quality & Beam</th>
                <th className="py-2.5 px-3 text-right">Output (m)</th>
                <th className="py-2.5 px-3 text-right">RPM / Hours</th>
                <th className="py-2.5 px-3">Stop Reason</th>
                <th className="py-2.5 px-3 text-right">Damage (m)</th>
                <th className="py-2.5 px-3">Logged By</th>
                <th className="py-2.5 px-3">Saved Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw size={18} className="animate-spin inline mr-2 text-blue-500" />
                    Loading daily entry logs...
                  </td>
                </tr>
              )}

              {!loading && paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 italic">
                    No daily entry logs found matching the selected filters.
                  </td>
                </tr>
              )}

              {!loading &&
                paginatedLogs.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2 px-3 font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {item.factory_name || '—'}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                      MCN {item.machine_no}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {item.quality_name || '—'}
                      </span>
                      {item.beam_no && (
                        <span className="text-slate-400 font-mono text-[10px] ml-1.5">
                          ({item.beam_no})
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatNum(item.meters)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-500">
                      {item.rpm || 650} / {item.hours || 22}h
                    </td>
                    <td className="py-2 px-3">
                      {item.reason && item.reason !== 'Normal' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                          {item.reason}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Normal</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {Number(item.damage) > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          {formatNum(item.damage)}
                        </span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {item.updated_by_name || item.created_by_name || 'Coordinator'}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {item.updated_at
                        ? new Date(item.updated_at).toLocaleString([], {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredLogs.length > pageSize && (
          <div className="pt-1">
            <TablePagination
              currentPage={page}
              totalItems={filteredLogs.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
