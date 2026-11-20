import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Factory,
  Package,
  Play,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  Users,
  Volume1,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import {
  DEFAULT_SOUND_SETTINGS,
  getSoundSettings,
  isSoundSupported,
  playNotificationDing,
  saveSettings,
  unlockAudio,
} from '../../services/voiceNotificationService';

const CATEGORY_ITEMS = [
  { id: 'crm', label: 'CRM', desc: 'Leads, deals, client follow-ups', icon: Users, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'approvals', label: 'Purchase & Approvals', desc: 'Purchase orders, discount & stage approvals', icon: ShoppingCart, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'sales', label: 'Sales & Dispatch', desc: 'Orders, delivery challans, quotations', icon: ShoppingCart, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'inventory', label: 'Inventory & Stock Alerts', desc: 'Low stock, safety stock, negative stock', icon: Package, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'qc', label: 'Quality Control (QC)', desc: 'Inspection rejections, hold batches', icon: ShieldCheck, color: 'text-violet-600 bg-violet-50 border-violet-200' },
  { id: 'production', label: 'Production & Loom', desc: 'Job delays, loom completions, milestones', icon: Factory, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'accounts', label: 'Accounts & Billing', desc: 'Vendor mismatches, broker commissions', icon: Wallet, color: 'text-lime-700 bg-lime-50 border-lime-200' },
  { id: 'hr', label: 'HR & Attendance', desc: 'Leave requests, asset allocations, appraisals', icon: UserRound, color: 'text-pink-600 bg-pink-50 border-pink-200' },
  { id: 'tasks', label: 'Tasks & Reminders', desc: 'Task assignments and action reminders', icon: CheckCircle2, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  { id: 'system', label: 'System Alerts', desc: 'Critical system alerts and notices', icon: Bell, color: 'text-slate-600 bg-slate-50 border-slate-200' },
];

export default function VoiceSettingsModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState(getSoundSettings);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const supported = isSoundSupported();

  useEffect(() => {
    if (!isOpen) return;
    setSettings(getSoundSettings());
  }, [isOpen]);

  // Lock background scrolling and attach Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleEnabled = () => {
    unlockAudio();
    const next = { ...settings, enabled: !settings.enabled };
    setSettings(next);
    saveSettings(next);
  };

  const handleChange = (field, value) => {
    const next = { ...settings, [field]: value };
    setSettings(next);
    saveSettings(next);
  };

  const handleCategoryToggle = (catId) => {
    const nextCategories = {
      ...settings.categories,
      [catId]: !settings.categories?.[catId],
    };
    const next = { ...settings, categories: nextCategories };
    setSettings(next);
    saveSettings(next);
  };

  const allCategoriesChecked = CATEGORY_ITEMS.every((cat) => settings.categories?.[cat.id] ?? true);

  const handleToggleAllCategories = () => {
    const nextState = !allCategoriesChecked;
    const nextCategories = {};
    CATEGORY_ITEMS.forEach((c) => {
      nextCategories[c.id] = nextState;
    });
    const next = { ...settings, categories: nextCategories };
    setSettings(next);
    saveSettings(next);
  };

  const handleTestSound = () => {
    unlockAudio();
    setIsPlayingTest(true);
    playNotificationDing(settings.volume);
    setTimeout(() => {
      setIsPlayingTest(false);
    }, 700);
  };

  const handleResetDefaults = () => {
    setSettings({ ...DEFAULT_SOUND_SETTINGS });
    saveSettings({ ...DEFAULT_SOUND_SETTINGS });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 flex flex-col max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Notification Sound Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${settings.enabled ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
              {settings.enabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">Notification Sound Settings</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Professional single-tone Ding chime for real-time ERP alerts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4.5 overflow-y-auto flex-1 text-xs">
          {!supported && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-amber-600" />
              <span>Web Audio is not supported by your current browser. Please use Chrome, Edge, Safari, or Firefox.</span>
            </div>
          )}

          {/* Master Sound Switch */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Notification Sound</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  settings.enabled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  {settings.enabled ? 'ON' : 'MUTED'}
                </span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                {settings.enabled ? 'Playing single "Ding" chime for new notifications' : 'Notifications appear silently without audio'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={handleToggleEnabled}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Sub-controls when enabled */}
          <div className={`space-y-4 transition-opacity duration-200 ${settings.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            {/* Volume & Test Sound Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Volume Slider Card */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                    <Volume1 size={14} className="text-slate-500" />
                    Chime Volume
                  </label>
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                    {Math.round((settings.volume ?? 0.8) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={settings.volume ?? 0.8}
                  onChange={(e) => handleChange('volume', parseFloat(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Soft</span>
                  <span>Balanced</span>
                  <span>Crisp</span>
                </div>
              </div>

              {/* Test Sound Trigger Card */}
              <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 flex flex-col justify-between">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                    <Bell size={14} className="text-blue-600 dark:text-blue-400" /> Test Sound
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Audition the soft, professional Ding tone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestSound}
                  className="mt-2.5 w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Play size={12} className={isPlayingTest ? 'animate-ping' : ''} />
                  {isPlayingTest ? 'Playing Ding…' : 'Play Ding Tone'}
                </button>
              </div>
            </div>

            {/* Notification Categories */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">Category Sound Alerts</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Choose which ERP modules trigger chime sounds
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAllCategories}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {allCategoriesChecked ? 'Mute All' : 'Enable All'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CATEGORY_ITEMS.map((cat) => {
                  const Icon = cat.icon;
                  const isChecked = settings.categories?.[cat.id] ?? true;
                  return (
                    <label
                      key={cat.id}
                      onClick={() => handleCategoryToggle(cat.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                        isChecked
                          ? 'border-blue-200 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/20 shadow-2xs'
                          : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/20 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${cat.color}`}>
                          <Icon size={13} />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs block truncate">
                            {cat.label}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {cat.desc}
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Quiet Hours Section */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-slate-500" />
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs block">Quiet Hours</span>
                    <span className="text-[10.5px] text-slate-400">Mute chimes during meetings or night hours</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.quietHoursEnabled ?? false}
                    onChange={(e) => handleChange('quietHoursEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1.5px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {settings.quietHoursEnabled && (
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-[10.5px] font-medium text-slate-500 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={settings.quietHoursStart || '22:00'}
                      onChange={(e) => handleChange('quietHoursStart', e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-medium text-slate-500 mb-1">End Time</label>
                    <input
                      type="time"
                      value={settings.quietHoursEnd || '08:00'}
                      onChange={(e) => handleChange('quietHoursEnd', e.target.value)}
                      className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <RotateCcw size={13} /> Reset Defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
