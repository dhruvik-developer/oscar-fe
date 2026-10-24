import React, { useEffect, useState, useMemo } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Sliders,
  Filter,
  Search,
  Check,
  RefreshCw,
  Info,
  XCircle,
  ShieldAlert,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import { alertService } from '../../services/domainServices';

const SEVERITY_PILL = {
  Critical: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
  Warning: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
  Info: 'bg-blue-100 text-blue-800 border-blue-300 font-medium',
};

const STATUS_PILL = {
  Active: 'bg-rose-50 text-rose-700 border-rose-200 font-semibold',
  Acknowledged: 'bg-amber-50 text-amber-700 border-amber-200 font-medium',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium',
};

const ALERT_TYPE_LABELS = {
  production_update_missing: 'Production Entry Missing by EOD',
  delayed_production_instruction: 'Delayed External Production',
  delayed_job_order: 'Delayed Job Work Order',
  processor_pending_aging: 'Processor Material Ageing > N Days',
  excessive_job_loss: 'Job Loss Above Tolerance %',
  qc_reject_threshold: 'QC Reject / Reprocess Exceeds %',
  insufficient_inventory: 'Negative / Insufficient Stock',
  credit_limit_breach: 'Credit Limit / Overdue Breach',
  below_cost_sale: 'Sale Below Landed Cost / Margin',
  large_discount_override: 'High Discount / Brokerage Override',
  overdue_sampling: 'Sampling Return Overdue',
  slow_moving_stock: 'Slow Moving Finished Fabric',
  combined_grey_stock_low: 'Combined Grey Stock Threshold',
};

const formatAlertValue = (val) => {
  if (val == null) return '-';
  const num = Number(val);
  return Number.isNaN(num) ? String(val) : num.toFixed(2);
};

const formatAlertText = (text) => {
  if (!text) return '';
  return String(text).replace(/(\d+\.\d{2})\d{2,}/g, '$1');
};

export default function AlertCenterPage() {
  const [activeTab, setActiveTab] = useState('incidents'); // 'incidents' | 'settings'
  const [incidents, setIncidents] = useState([]);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [badgeCount, setBadgeCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [severityFilter, setSeverityFilter] = useState('All');

  // Edit Setting State
  const [editingSetting, setEditingSetting] = useState(null);
  const [savingSetting, setSavingSetting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [incRes, setRes, badgeRes] = await Promise.all([
        alertService.getIncidents(),
        alertService.getSettings(),
        alertService.getIncidentBadge(),
      ]);
      setIncidents(incRes.results || incRes || []);
      setSettings(setRes.results || setRes || []);
      setBadgeCount(badgeRes.activeCount || 0);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load alert center data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAcknowledge = async (id) => {
    try {
      await alertService.acknowledgeIncident(id);
      await loadData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to acknowledge incident');
    }
  };

  const handleResolve = async (id) => {
    try {
      await alertService.resolveIncident(id);
      await loadData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to resolve incident');
    }
  };

  const handleSaveSetting = async (e) => {
    e.preventDefault();
    if (!editingSetting) return;
    setSavingSetting(true);
    try {
      await alertService.updateSetting(editingSetting.id, {
        threshold_days: editingSetting.threshold_days ? parseInt(editingSetting.threshold_days) : null,
        tolerance_percent: editingSetting.tolerance_percent ? parseFloat(editingSetting.tolerance_percent) : null,
        is_active: editingSetting.is_active,
        notify_in_app: editingSetting.notify_in_app,
        notify_email: editingSetting.notify_email,
      });
      setEditingSetting(null);
      await loadData();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to update alert setting');
    } finally {
      setSavingSetting(false);
    }
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      if (statusFilter !== 'All' && inc.status !== statusFilter) return false;
      if (severityFilter !== 'All' && inc.severity !== severityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const ref = (inc.document_ref || '').toLowerCase();
        const title = (inc.title || '').toLowerCase();
        const msg = (inc.message || '').toLowerCase();
        if (!ref.includes(q) && !title.includes(q) && !msg.includes(q)) return false;
      }
      return true;
    });
  }, [incidents, statusFilter, severityFilter, search]);

  const kpis = useMemo(() => {
    const active = incidents.filter((i) => i.status === 'Active').length;
    const critical = incidents.filter((i) => i.severity === 'Critical' && i.status === 'Active').length;
    const acknowledged = incidents.filter((i) => i.status === 'Acknowledged').length;
    const resolved = incidents.filter((i) => i.status === 'Resolved').length;
    return { active, critical, acknowledged, resolved };
  }, [incidents]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alert Center & Operational Exceptions"
        subtitle="Automated background monitoring for production delays, loss variances, and commercial exceptions."
      >
        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </PageHeader>

      {/* KPI Cards (Standardized CRM KpiCard) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          label="Active Incidents"
          value={kpis.active}
          icon={AlertTriangle}
          tone="rose"
          sub="Requires immediate attention"
        />
        <KpiCard
          label="Critical Priority"
          value={kpis.critical}
          icon={ShieldAlert}
          tone="rose"
          sub="Immediate action required"
        />
        <KpiCard
          label="Acknowledged"
          value={kpis.acknowledged}
          icon={Clock}
          tone="amber"
          sub="Under operational review"
        />
        <KpiCard
          label="Resolved Incidents"
          value={kpis.resolved}
          icon={CheckCircle2}
          tone="emerald"
          sub="Successfully cleared"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('incidents')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'incidents'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          Active & Past Incidents
          {badgeCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-rose-500 text-white font-bold">
              {badgeCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'settings'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Alert Thresholds & Configuration
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* TAB 1: INCIDENTS */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center flex-1">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search incident title, document ref..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg w-full focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 outline-none bg-white font-medium text-slate-700"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Acknowledged">Acknowledged</option>
                <option value="Resolved">Resolved</option>
              </select>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 outline-none bg-white font-medium text-slate-700"
              >
                <option value="All">All Severities</option>
                <option value="Critical">Critical Only</option>
                <option value="Warning">Warning</option>
                <option value="Info">Info</option>
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold">{filteredIncidents.length}</span> incident(s)
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Alert Type / Title</th>
                    <th className="py-3 px-4">Document Ref</th>
                    <th className="py-3 px-4">Details & Message</th>
                    <th className="py-3 px-4">Triggered At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Loading incident records...
                      </td>
                    </tr>
                  ) : filteredIncidents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No operational alert incidents found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredIncidents.map((inc) => (
                      <tr key={inc.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 text-xs rounded-full border ${
                              SEVERITY_PILL[inc.severity] || SEVERITY_PILL.Info
                            }`}
                          >
                            {inc.severity}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{formatAlertText(inc.title)}</div>
                          <div className="text-xs text-indigo-600 font-medium">
                            {ALERT_TYPE_LABELS[inc.alert_type] || inc.alert_type}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-xs font-bold text-slate-800">
                          {inc.document_ref || '-'}
                        </td>
                        <td className="py-3 px-4 max-w-sm">
                          <div className="line-clamp-2 text-xs text-slate-600">{formatAlertText(inc.message)}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                          {inc.triggered_at ? new Date(inc.triggered_at).toLocaleString() : '-'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 text-xs rounded-full border ${
                              STATUS_PILL[inc.status] || STATUS_PILL.Active
                            }`}
                          >
                            {inc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {inc.status === 'Active' && (
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => handleAcknowledge(inc.id)}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 transition"
                              >
                                Acknowledge
                              </button>
                              <button
                                onClick={() => handleResolve(inc.id)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition"
                              >
                                Resolve
                              </button>
                            </div>
                          )}
                          {inc.status === 'Acknowledged' && (
                            <button
                              onClick={() => handleResolve(inc.id)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition"
                            >
                              Resolve
                            </button>
                          )}
                          {inc.status === 'Resolved' && (
                            <span className="text-xs text-emerald-600 font-medium flex items-center justify-end gap-1">
                              <Check className="w-3.5 h-3.5" /> Resolved
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Operational Exception Rule</th>
                    <th className="py-3 px-4">Threshold Days</th>
                    <th className="py-3 px-4">Tolerance %</th>
                    <th className="py-3 px-4">In-App</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Active</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {settings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No alert settings found. System defaults will be applied on the next scheduled run.
                      </td>
                    </tr>
                  ) : (
                    settings.map((setting) => (
                      <tr key={setting.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{setting.name}</div>
                          <div className="text-xs text-slate-500 font-mono">{setting.alert_type}</div>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium">
                          {setting.threshold_days != null ? `${setting.threshold_days} days` : '-'}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium">
                          {setting.tolerance_percent != null ? `${formatAlertValue(setting.tolerance_percent)}%` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              setting.notify_in_app ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {setting.notify_in_app ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              setting.notify_email ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {setting.notify_email ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full border ${
                              setting.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {setting.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setEditingSetting({ ...setting })}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                          >
                            Configure
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SETTING MODAL */}
      {editingSetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveSetting}
            className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                Configure Threshold
              </h3>
              <button
                type="button"
                onClick={() => setEditingSetting(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rule Name</label>
                <div className="font-bold text-slate-900 text-sm">{editingSetting.name}</div>
                <div className="text-slate-400 font-mono text-[11px]">{editingSetting.alert_type}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Threshold Days</label>
                  <input
                    type="number"
                    min="0"
                    value={editingSetting.threshold_days ?? ''}
                    onChange={(e) =>
                      setEditingSetting({ ...editingSetting, threshold_days: e.target.value })
                    }
                    placeholder="e.g. 5"
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tolerance %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingSetting.tolerance_percent ?? ''}
                    onChange={(e) =>
                      setEditingSetting({ ...editingSetting, tolerance_percent: e.target.value })
                    }
                    placeholder="e.g. 2.5"
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingSetting.notify_in_app}
                    onChange={(e) =>
                      setEditingSetting({ ...editingSetting, notify_in_app: e.target.checked })
                    }
                    className="rounded text-indigo-600"
                  />
                  <span className="font-medium text-slate-700">Deliver In-App Alert Notification</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingSetting.notify_email}
                    onChange={(e) =>
                      setEditingSetting({ ...editingSetting, notify_email: e.target.checked })
                    }
                    className="rounded text-indigo-600"
                  />
                  <span className="font-medium text-slate-700">Send Email Alert (when SMTP active)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingSetting.is_active}
                    onChange={(e) =>
                      setEditingSetting({ ...editingSetting, is_active: e.target.checked })
                    }
                    className="rounded text-indigo-600"
                  />
                  <span className="font-bold text-slate-900">Rule Enabled in Background Runner</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setEditingSetting(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSetting}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
              >
                {savingSetting ? 'Saving...' : 'Update Threshold'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
