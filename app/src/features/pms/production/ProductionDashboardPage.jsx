import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory,
  Users,
  Calendar,
  AlertTriangle,
  Clock,
  TrendingUp,
  Layers,
  Search,
  Download,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { productionService } from '../../../services/domainServices';
import PageHeader from '../../../components/ui/PageHeader';
import KpiCard from '../../../components/ui/KpiCard';
import { Button } from '../../../components/ui/Button';

function fmtNum(val) {
  if (val === null || val === undefined || isNaN(val)) return '0.00';
  return Number(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString('en-IN');
}

export default function ProductionDashboardPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('agencies'); // 'agencies' | 'employees'
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [agencyData, setAgencyData] = useState([]);
  const [employeeData, setEmployeeData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDelayedOnly, setFilterDelayedOnly] = useState(false);
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [agenciesRes, employeesRes] = await Promise.all([
        productionService.getAgencyDashboard({ day: selectedDate }),
        productionService.getEmployeeDashboard({ day: selectedDate }),
      ]);

      const aRows = Array.isArray(agenciesRes)
        ? agenciesRes
        : (agenciesRes?.results || agenciesRes?.data || []);
      const eRows = Array.isArray(employeesRes)
        ? employeesRes
        : (employeesRes?.results || employeesRes?.data || []);

      setAgencyData(aRows);
      setEmployeeData(eRows);
    } catch (err) {
      console.error('Failed to load production dashboard:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to load production dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Global KPI Summary Calculations
  const kpis = useMemo(() => {
    const totalTodayProduced = agencyData.reduce((acc, r) => acc + (Number(r.todayProduced) || 0), 0);
    const totalTodayTakas = agencyData.reduce((acc, r) => acc + (Number(r.todayTakas) || 0), 0);
    const totalCumulative = agencyData.reduce((acc, r) => acc + (Number(r.cumulativeProduced) || 0), 0);
    const totalOrderMeters = agencyData.reduce((acc, r) => acc + (Number(r.orderMeters) || 0), 0);
    const totalBalance = agencyData.reduce((acc, r) => acc + (Number(r.balanceMeters) || 0), 0);
    const totalDelayed = agencyData.reduce((acc, r) => acc + (Number(r.delayed) || 0), 0);
    const totalMissingUpdates = agencyData.reduce((acc, r) => acc + (Number(r.missingTodayUpdate) || 0), 0);
    const activeAgencies = agencyData.filter((r) => (Number(r.activeInstructions) || 0) > 0).length;

    return {
      totalTodayProduced,
      totalTodayTakas,
      totalCumulative,
      totalOrderMeters,
      totalBalance,
      totalDelayed,
      totalMissingUpdates,
      activeAgencies,
    };
  }, [agencyData]);

  // Filtered Agency Rows
  const filteredAgencies = useMemo(() => {
    return agencyData.filter((row) => {
      const matchSearch =
        !searchQuery ||
        (row.agency || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (row.agencyCode || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchDelayed = !filterDelayedOnly || (Number(row.delayed) || 0) > 0;
      const matchMissing = !filterMissingOnly || (Number(row.missingTodayUpdate) || 0) > 0;
      return matchSearch && matchDelayed && matchMissing;
    });
  }, [agencyData, searchQuery, filterDelayedOnly, filterMissingOnly]);

  // Filtered Employee Rows
  const filteredEmployees = useMemo(() => {
    return employeeData.filter((row) => {
      const matchSearch =
        !searchQuery ||
        (row.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (row.employeeCode || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchDelayed = !filterDelayedOnly || (Number(row.delayed) || 0) > 0;
      const matchMissing = !filterMissingOnly || (Number(row.missingTodayUpdate) || 0) > 0;
      return matchSearch && matchDelayed && matchMissing;
    });
  }, [employeeData, searchQuery, filterDelayedOnly, filterMissingOnly]);

  // CSV Export
  const handleExportCsv = () => {
    const isAgencies = activeTab === 'agencies';
    const rows = isAgencies ? filteredAgencies : filteredEmployees;
    if (!rows.length) return;

    let headers = [];
    let dataRows = [];

    if (isAgencies) {
      headers = [
        'Agency Name',
        'Agency Code',
        'Active Instructions',
        'Today Produced (m)',
        'Today Takas',
        'Cumulative (m)',
        'Order Meters (m)',
        'Balance (m)',
        'Delayed',
        'Missing Today Update',
        'Accepted (m)',
        'Rejected (m)',
        'Reprocess (m)',
        'Reject %',
        'Reprocess %',
      ];
      dataRows = rows.map((r) => [
        `"${r.agency || ''}"`,
        `"${r.agencyCode || ''}"`,
        r.activeInstructions || 0,
        r.todayProduced || 0,
        r.todayTakas || 0,
        r.cumulativeProduced || 0,
        r.orderMeters || 0,
        r.balanceMeters || 0,
        r.delayed || 0,
        r.missingTodayUpdate || 0,
        r.acceptedMeters || 0,
        r.rejectedMeters || 0,
        r.reprocessMeters || 0,
        r.rejectPct || 0,
        r.reprocessPct || 0,
      ]);
    } else {
      headers = [
        'Employee Name',
        'Employee Code',
        'Status',
        'Agencies Handled',
        'Active Orders',
        'Today Produced (m)',
        'Cumulative (m)',
        'Delayed Orders',
        'Missing Updates',
      ];
      dataRows = rows.map((r) => [
        `"${r.name || ''}"`,
        `"${r.employeeCode || ''}"`,
        `"${r.status || ''}"`,
        r.agenciesHandled || 0,
        r.activeInstructions || 0,
        r.todayProduced || 0,
        r.cumulativeProduced || 0,
        r.delayed || 0,
        r.missingTodayUpdate || 0,
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...dataRows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `production_dashboard_${activeTab}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1 border-b border-slate-200">
        <div>
          <PageHeader
            title="External Production Dashboard"
            description="Daily grey production monitoring across external agencies, weaver looms, and assigned supervisors."
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-3 py-1.5 shadow-sm text-xs font-medium text-slate-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-semibold text-slate-800 cursor-pointer"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboardData(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 h-8 text-xs font-medium bg-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 h-8 text-xs font-medium bg-white text-slate-700"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/pms/daily-production')}
            className="flex items-center gap-1.5 h-8 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            + Enter Daily Log
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* ── KPI TILES ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Production */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's Produced</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {fmtNum(kpis.totalTodayProduced)} <span className="text-sm font-normal text-slate-500">m</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-semibold text-emerald-600">{fmtInt(kpis.totalTodayTakas)} rolls</span> produced on {selectedDate}
          </div>
        </div>

        {/* Cumulative Production */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Cumulative Total</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {fmtNum(kpis.totalCumulative)} <span className="text-sm font-normal text-slate-500">m</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Balance: <span className="font-semibold text-amber-600">{fmtNum(kpis.totalBalance)} m</span> pending
          </div>
        </div>

        {/* Delayed Orders */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Delayed Orders</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600">
            {kpis.totalDelayed}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Past expected start date without progress
          </div>
        </div>

        {/* Missing Today's Update */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Missing Update</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {kpis.totalMissingUpdates}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Running instructions with zero entry today
          </div>
        </div>
      </div>

      {/* ── TABS & FILTER BAR ───────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Tab buttons */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('agencies')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'agencies'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Factory className="w-3.5 h-3.5" />
              Agency-Wise Performance ({agencyData.length})
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'employees'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Supervisor Workload ({employeeData.length})
            </button>
          </div>

          {/* Quick Filter Badges */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterDelayedOnly(!filterDelayedOnly)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                filterDelayedOnly
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Delayed Only ({kpis.totalDelayed})
            </button>
            <button
              onClick={() => setFilterMissingOnly(!filterMissingOnly)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                filterMissingOnly
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Missing Update ({kpis.totalMissingUpdates})
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              activeTab === 'agencies'
                ? 'Search by agency name or code...'
                : 'Search by employee name or code...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* ── TABLE ───────────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          {activeTab === 'agencies' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Production Agency</th>
                  <th className="py-2.5 px-3 text-center">Active Orders</th>
                  <th className="py-2.5 px-3 text-right">Today's Produced</th>
                  <th className="py-2.5 px-3 text-right">Cumulative</th>
                  <th className="py-2.5 px-3 text-right">Target Order</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                  <th className="py-2.5 px-3 text-right" title="Share of submitted production: accepted / rejected / sent for reprocess">Quality</th>
                  <th className="py-2.5 px-3 text-center">Delayed</th>
                  <th className="py-2.5 px-3 text-center">Today's Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Loading agency production data...
                    </td>
                  </tr>
                ) : filteredAgencies.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No matching agency records found.
                    </td>
                  </tr>
                ) : (
                  filteredAgencies.map((row, idx) => {
                    const isMissing = (Number(row.missingTodayUpdate) || 0) > 0;
                    const isDelayed = (Number(row.delayed) || 0) > 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-medium text-slate-900">
                          <div>{row.agency}</div>
                          {row.agencyCode && (
                            <div className="text-[11px] text-slate-400 font-normal">
                              Code: {row.agencyCode}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-700">
                          {row.activeInstructions || 0}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">
                            / {row.instructions || 0}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-emerald-600">
                          {fmtNum(row.todayProduced)} m
                          {row.todayTakas > 0 && (
                            <div className="text-[10px] font-normal text-slate-400">
                              {row.todayTakas} rolls
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-900">
                          {fmtNum(row.cumulativeProduced)} m
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600">
                          {fmtNum(row.orderMeters)} m
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-amber-600">
                          {fmtNum(row.balanceMeters)} m
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap text-[11px]">
                          <div className="font-semibold text-emerald-700" title={`${fmtNum(row.acceptedMeters)} m accepted`}>
                            {Number(row.acceptedPct || 0).toFixed(1)}% ok
                          </div>
                          <div className="text-rose-600" title={`${fmtNum(row.rejectedMeters)} m rejected`}>
                            {Number(row.rejectPct || 0).toFixed(1)}% rej · {fmtNum(row.rejectedMeters)} m
                          </div>
                          <div className="text-purple-600" title={`${fmtNum(row.reprocessMeters)} m sent for reprocess`}>
                            {Number(row.reprocessPct || 0).toFixed(1)}% rep · {fmtNum(row.reprocessMeters)} m
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isDelayed ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              {row.delayed} Delayed
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isMissing ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              {row.missingTodayUpdate} Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              Updated
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() =>
                              navigate(
                                `/pms/production-instructions?vendor=${encodeURIComponent(row.agency)}`
                              )
                            }
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold text-xs"
                          >
                            Orders <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Supervisor / Employee</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Agencies</th>
                  <th className="py-2.5 px-3 text-center">Active Orders</th>
                  <th className="py-2.5 px-3 text-right">Today's Entered</th>
                  <th className="py-2.5 px-3 text-right">Cumulative</th>
                  <th className="py-2.5 px-3 text-center">Delayed Orders</th>
                  <th className="py-2.5 px-3 text-center">Missing Updates</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Loading supervisor workload data...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No matching employee records found.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((row, idx) => {
                    const isMissing = (Number(row.missingTodayUpdate) || 0) > 0;
                    const isDelayed = (Number(row.delayed) || 0) > 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-medium text-slate-900">
                          <div>{row.name}</div>
                          {row.employeeCode && (
                            <div className="text-[11px] text-slate-400 font-normal">
                              {row.employeeCode}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              row.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {row.status || 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-slate-700">
                          {row.agenciesHandled || 0}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-700">
                          {row.activeInstructions || 0}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">
                            / {row.ordersMonitored || 0}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-emerald-600">
                          {fmtNum(row.todayProduced)} m
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-900">
                          {fmtNum(row.cumulativeProduced)} m
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isDelayed ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              {row.delayed}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isMissing ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              {row.missingTodayUpdate}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-medium">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() =>
                              navigate(
                                `/pms/daily-production?emp=${encodeURIComponent(row.employeeId)}`
                              )
                            }
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold text-xs"
                          >
                            Daily Logs <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
