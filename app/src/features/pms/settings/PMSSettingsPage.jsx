import React, { useState, useEffect } from 'react';
import { Settings, Layers, Save, RefreshCw } from 'lucide-react';
import { api } from '../../../services/api';
import { useAppStore } from '../../../stores/appStore';
import StageConfigPage from '../stages/StageConfigPage';

const TABS = [
  { id: 'general', label: 'General Settings', icon: Settings },
  { id: 'stages', label: 'Stage Templates', icon: Layers },
];

const DEFAULT_SETTINGS = {
  atRiskThresholdPct: 20,
  requireClientApprovalOnDesign: false,
  requireQaCertificate: false,
  defaultDepartmentCapacity: 20,
  notifications: {
    notify_on_delay: true,
    notify_on_completion: true,
  },
};

export default function PMSSettingsPage() {
  const showToast = useAppStore((s) => s.showToast);
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get('/pms/settings/')
      .then((data) => {
        if (!active || !data) return;
        setSettings({
          atRiskThresholdPct: data.atRiskThresholdPct ?? data.at_risk_threshold_pct ?? 20,
          requireClientApprovalOnDesign: Boolean(data.requireClientApprovalOnDesign ?? data.require_client_approval_on_design),
          requireQaCertificate: Boolean(data.requireQaCertificate ?? data.require_qa_certificate),
          defaultDepartmentCapacity: data.defaultDepartmentCapacity ?? data.default_department_capacity ?? 20,
          notifications: {
            notify_on_delay: Boolean(data.notifications?.notify_on_delay ?? true),
            notify_on_completion: Boolean(data.notifications?.notify_on_completion ?? true),
          },
        });
      })
      .catch((err) => {
        if (!active) return;
        console.warn('[PMSSettingsPage] Failed to fetch settings:', err);
        setError(err?.message || 'Failed to load PMS settings');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        atRiskThresholdPct: Number(settings.atRiskThresholdPct),
        requireClientApprovalOnDesign: Boolean(settings.requireClientApprovalOnDesign),
        requireQaCertificate: Boolean(settings.requireQaCertificate),
        defaultDepartmentCapacity: Number(settings.defaultDepartmentCapacity),
        notifications: settings.notifications,
      };
      await api.put('/pms/settings/', payload);
      showToast('PMS settings saved successfully');
    } catch (err) {
      showToast(err?.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  function Field({ label, help, children }) {
    return (
      <div className="flex items-start justify-between gap-4 py-4 border-b border-[var(--border)] last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--text)]">{label}</p>
          {help && <p className="text-[11.5px] text-[var(--muted)] mt-0.5">{help}</p>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text)]">PMS Settings</h1>
          <p className="text-[13px] text-[var(--muted)] mt-0.5">
            At-risk thresholds, approval policies, notification defaults, and dynamic stage templates.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors cursor-pointer -mb-px ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'stages' && <StageConfigPage />}

      {activeTab === 'general' && (
        <form onSubmit={handleSave}>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[var(--muted)] text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" /> Loading settings…
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">{error}</div>
          ) : (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
              <Field
                label="At-risk threshold (%)"
                help="Stages are flagged as at-risk when delay exceeds this percentage of their planned duration."
              >
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.atRiskThresholdPct}
                  onChange={(e) => setSettings((s) => ({ ...s, atRiskThresholdPct: Number(e.target.value) }))}
                  className="w-24 px-3 py-1.5 border border-[var(--border)] rounded-lg text-[13px] text-[var(--text)] bg-[var(--input)] focus:outline-none focus:border-blue-500"
                />
              </Field>

              <Field
                label="Default department daily capacity"
                help="Nominal active production capacity per department used when evaluating queue bottlenecking."
              >
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={settings.defaultDepartmentCapacity}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultDepartmentCapacity: Number(e.target.value) }))}
                  className="w-24 px-3 py-1.5 border border-[var(--border)] rounded-lg text-[13px] text-[var(--text)] bg-[var(--input)] focus:outline-none focus:border-blue-500"
                />
              </Field>

              <Field label="Require client approval on design" help="Stages in design phase cannot hand off to production until client approval token is recorded.">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={Boolean(settings.requireClientApprovalOnDesign)}
                    onChange={(e) => setSettings((s) => ({ ...s, requireClientApprovalOnDesign: e.target.checked }))}
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </Field>

              <Field label="Require QA certificate" help="Final inspection stage must issue an approved QA certificate before dispatch.">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={Boolean(settings.requireQaCertificate)}
                    onChange={(e) => setSettings((s) => ({ ...s, requireQaCertificate: e.target.checked }))}
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </Field>

              <Field label="Notify on delay" help="Send automated exceptions to PM and department head on overdue stages.">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={Boolean(settings.notifications?.notify_on_delay)}
                    onChange={(e) => setSettings((s) => ({
                      ...s,
                      notifications: { ...s.notifications, notify_on_delay: e.target.checked }
                    }))}
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </Field>

              <Field label="Notify on completion" help="Send completion alerts upon final delivery verification.">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={Boolean(settings.notifications?.notify_on_completion)}
                    onChange={(e) => setSettings((s) => ({
                      ...s,
                      notifications: { ...s.notifications, notify_on_completion: e.target.checked }
                    }))}
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </Field>
            </div>
          )}

          {!loading && !error && (
            <div className="flex justify-end mt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-[13px] font-semibold transition-colors cursor-pointer"
              >
                <Save size={14} />
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
