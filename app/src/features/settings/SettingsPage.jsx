import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useERP } from '../../context/ERPContext';
import { useAppStore } from '../../stores/appStore';
import { isUserAdmin } from '../../components/layout/Sidebar';
import { inventoryService } from '../../services/domainServices';
import { Button } from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import { Building, Bell, Database, Save, Check, RotateCcw, AlertTriangle, Cog, LayoutGrid, Briefcase, UserCheck, Percent, ShieldCheck } from 'lucide-react';
import { useDiscountPolicy } from '../../hooks/useDiscountPolicy';
import BrandingSettingsCard from './BrandingSettingsCard';

// Module settings pages, loaded on demand so the Settings bundle stays light.
const CRMSystemSetupPage = lazy(() => import('../crm/setup/CRMSystemSetupPage'));
const PMSSettingsPage = lazy(() => import('../pms/settings/PMSSettingsPage'));
const HRAdminPage = lazy(() => import('../hrms/organization/HRAdminPage'));

const TABS = [
  { id: 'general', label: 'General', icon: Cog },
  { id: 'crm', label: 'CRM', icon: LayoutGrid },
  { id: 'pms', label: 'PMS (Projects)', icon: Briefcase },
  { id: 'hrms', label: 'HRMS', icon: UserCheck },
];

function GeneralSettings() {
    const {
        resetDemoData,
        exportDatabaseSnapshot,
        currency: globalCurrency,
        setCurrency: setGlobalCurrency,
        companyProfile,
        setCompanyProfile,
        showToast,
    } = useERP();
    const currentUser = useAppStore((s) => s.currentUser);
    const permissions = useAppStore((s) => s.permissions) || [];
    const isAdmin = isUserAdmin(currentUser, permissions);
    const [saved, setSaved] = useState(false);
    const [companyName, setCompanyName] = useState(companyProfile?.name || '');
    const [gstin, setGstin] = useState(companyProfile?.gstin || '');
    const [pan, setPan] = useState(companyProfile?.pan || '');
    const [address, setAddress] = useState(companyProfile?.address || '');
    const [phone, setPhone] = useState(companyProfile?.phone || '');
    const [currency, setCurrency] = useState(globalCurrency || 'INR (₹)');
    const [fiscalYear, setFiscalYear] = useState('Apr - Mar');
    const [autoReorder, setAutoReorder] = useState(true);
    const [emailAlerts, setEmailAlerts] = useState(true);
    const [greyThreshold, setGreyThreshold] = useState('');
    const [greyAlertEnabled, setGreyAlertEnabled] = useState(true);
    const [showConfirmReset, setShowConfirmReset] = useState(false);

    const { policy: discountPolicy, savePolicy: saveDiscountPolicy } = useDiscountPolicy();
    const [discForm, setDiscForm] = useState({ autoAllowPct: '', salespersonMaxPct: '', managerMaxPct: '', minMarginPct: '' });
    const [discSaved, setDiscSaved] = useState(false);
    const [discError, setDiscError] = useState('');
    // Sync from loaded policy
    useEffect(() => {
      setDiscForm({
        autoAllowPct: String(discountPolicy.autoAllowPct),
        salespersonMaxPct: String(discountPolicy.salespersonMaxPct),
        managerMaxPct: String(discountPolicy.managerMaxPct),
        minMarginPct: String(discountPolicy.minMarginPct),
      });
    }, [discountPolicy]);

    useEffect(() => {
        let active = true;
        inventoryService.getCombinedGreyStockSetting().then((res) => {
            if (active && res) {
                if (res.threshold !== undefined && res.threshold !== null) {
                    setGreyThreshold(res.threshold > 0 ? String(res.threshold) : '');
                }
                if (res.isEnabled !== undefined) {
                    setGreyAlertEnabled(Boolean(res.isEnabled));
                }
            }
        }).catch((err) => {
            console.error('Failed to load combined grey stock setting:', err);
        });
        return () => { active = false; };
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setGlobalCurrency(currency);
        let profileOk = true;
        if (typeof setCompanyProfile === 'function') {
            try {
                await setCompanyProfile({
                    name: companyName,
                    gstin,
                    pan,
                    address,
                    phone,
                });
            } catch (err) {
                profileOk = false;
                console.error('Failed to save company profile:', err);
                if (showToast) showToast(err?.message || 'Failed to save company profile', 'error');
            }
        }
        try {
            const numericThreshold = parseFloat(greyThreshold) || 0;
            await inventoryService.updateCombinedGreyStockSetting({
                threshold: numericThreshold,
                isEnabled: greyAlertEnabled,
                uom: 'Mtr',
            });
        } catch (err) {
            console.error('Failed to update combined grey stock setting:', err);
            if (showToast) showToast('Failed to save combined grey stock setting', 'error');
        }
        if (profileOk) {
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            if (showToast) showToast('Settings saved successfully');
        }
    };
    const handleResetData = () => {
        resetDemoData();
        setShowConfirmReset(false);
    };
    const handleSaveDiscountPolicy = async (e) => {
      e.preventDefault();
      setDiscError('');
      try {
        await saveDiscountPolicy({
          autoAllowPct: Number(discForm.autoAllowPct),
          salespersonMaxPct: Number(discForm.salespersonMaxPct),
          managerMaxPct: Number(discForm.managerMaxPct),
          minMarginPct: Number(discForm.minMarginPct),
        });
        setDiscSaved(true);
        setTimeout(() => setDiscSaved(false), 3000);
      } catch (err) {
        const fieldErrors = err?.payload?.field_errors;
        const first = fieldErrors && Object.values(fieldErrors).flat()[0];
        setDiscError(first || err?.message || 'Could not save the discount policy.');
      }
    };
    return (<div className="space-y-6 max-w-4xl">
      <BrandingSettingsCard isAdmin={isAdmin} />

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white border border-[#CED4DA] rounded-lg p-5">
          <div className="flex items-center gap-2 pb-3 border-b border-[#CED4DA] mb-4">
            <Building className="text-[#1F2E4A]" size={18}/>
            <h3 className="font-bold text-sm text-[#1F2E4A]">Company Profile & Taxation</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Company Legal Entity</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full p-2 border border-[#CED4DA] rounded bg-[#F8F9FA]"/>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Base Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full p-2 border border-[#CED4DA] rounded bg-[#F8F9FA]">
                <option value="INR (₹)">INR (₹) - Indian Rupee</option>
                <option value="USD ($)">USD ($) - United States Dollar</option>
                <option value="EUR (€)">EUR (€) - Euro</option>
                <option value="GBP (£)">GBP (£) - British Pound</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Fiscal Year</label>
              <input type="text" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} className="w-full p-2 border border-[#CED4DA] rounded bg-[#F8F9FA]"/>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">GSTIN (Tax Registration)</label>
              <input type="text" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="e.g. 29AABCU8912E1ZB" className="w-full p-2 border border-[#CED4DA] rounded bg-[#F8F9FA]"/>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">PAN</label>
              <input type="text" value={pan} onChange={(e) => setPan(e.target.value)} placeholder="e.g. AABCU8912E" className="w-full p-2 border border-[#CED4DA] rounded bg-[#F8F9FA]"/>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Business Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 22 4000 0000" className="w-full p-2 border border-[#CED4DA] rounded bg-[#F8F9FA]"/>
            </div>
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1">Registered Address</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Line 1, Line 2, City, State, PIN" className="w-full p-2 border border-[#CED4DA] rounded bg-[#F8F9FA]"/>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#CED4DA] rounded-lg p-5">
          <div className="flex items-center gap-2 pb-3 border-b border-[#CED4DA] mb-4">
            <Bell className="text-[#1F2E4A]" size={18}/>
            <h3 className="font-bold text-sm text-[#1F2E4A]">Inventory Automation & Alerts</h3>
          </div>
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between gap-3 lg:gap-0">
              <div>
                <p className="font-semibold text-slate-800">Automated Reorder Triggering</p>
                <p className="text-slate-500 text-[11px]">
                  Draft purchase orders automatically when stock levels breach SKU minimum safety points.
                </p>
              </div>
              <input type="checkbox" checked={autoReorder} onChange={(e) => setAutoReorder(e.target.checked)} className="w-4 h-4 shrink-0 lg:shrink accent-[#1F2E4A]"/>
            </div>
            <div className="flex items-center justify-between gap-3 lg:gap-0">
              <div>
                <p className="font-semibold text-slate-800">Low Stock & RMA Email Notifications</p>
                <p className="text-slate-500 text-[11px]">
                  Send daily briefing notifications to warehouse floor managers and QA engineers.
                </p>
              </div>
              <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} className="w-4 h-4 shrink-0 lg:shrink accent-[#1F2E4A]"/>
            </div>
            <div className="pt-3 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="max-w-md">
                  <p className="font-semibold text-slate-800">Combined Grey Fabric Stock Minimum Alert</p>
                  <p className="text-slate-500 text-[11px]">
                    Triggers a company-wide low-stock alert when combined available grey fabric across all qualities falls below this threshold. Excludes finished fabric, external Job Work WIP, QC Hold, and sales reservations.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 5000"
                      value={greyThreshold}
                      onChange={(e) => setGreyThreshold(e.target.value)}
                      className="w-28 p-1.5 border border-[#CED4DA] rounded bg-[#F8F9FA] text-right font-mono font-semibold text-slate-900"
                    />
                    <span className="font-bold text-slate-500">Mtr</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                    <input
                      type="checkbox"
                      checked={greyAlertEnabled}
                      onChange={(e) => setGreyAlertEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#1F2E4A]"
                    />
                    <span className="text-[11px] font-semibold text-slate-700">Enabled</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 lg:gap-0 pt-2">
          {saved ? (<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded">
              <Check size={14}/> Configuration saved successfully
            </span>) : (<span />)}
          <Button icon={Save} type="submit">
            Save Preferences
          </Button>
        </div>
      </form>

      {/* Discount Approval Policy */}
      <div className="bg-white border border-[#CED4DA] rounded-lg p-5">
        <div className="flex items-center gap-2 pb-3 border-b border-[#CED4DA] mb-4">
          <ShieldCheck className="text-[#1F2E4A]" size={18}/>
          <h3 className="font-bold text-sm text-[#1F2E4A]">Sales Discount Approval Policy</h3>
        </div>
        <form onSubmit={handleSaveDiscountPolicy} className="space-y-4 text-xs">
          <p className="text-slate-500 text-[11px] leading-relaxed">
            Up to the salesperson limit a salesperson gives the discount on their own. Above it, up to the manager
            limit, the Sales Manager must approve; above that — or on any line sold below cost or below the
            minimum margin — the Owner must approve. Quotations and orders wait in the approvals inbox until then.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ['autoAllowPct', 'Allowed for everyone up to (%)', 'Nobody needs to approve discounts up to this.'],
              ['salespersonMaxPct', 'Salesperson limit (%)', 'A salesperson may give up to this without approval.'],
              ['managerMaxPct', 'Sales Manager limit (%)', 'Above the salesperson limit and up to this, the Sales Manager approves. Above it, the Owner.'],
              ['minMarginPct', 'Minimum margin (%)', 'A line with a lower margin over landed cost needs Owner approval.'],
            ].map(([key, label, hint]) => (
              <div key={key}>
                <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                  <Percent size={12} /> {label}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={discForm[key]}
                  onChange={(e) => setDiscForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full p-2 border border-[#CED4DA] rounded bg-[#F8F9FA] font-mono font-semibold text-slate-900"
                />
                <p className="text-[11px] text-slate-400 mt-1">{hint}</p>
              </div>
            ))}
          </div>
          {discError && <p role="alert" className="text-xs font-semibold text-rose-600">{discError}</p>}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#1F2E4A] hover:bg-[#2a3f65] rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <ShieldCheck size={13} /> Save Discount Policy
            </button>
            {discSaved && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded">
                <Check size={14}/> Discount policy saved
              </span>
            )}
          </div>
        </form>
      </div>

      {/* ERP Snapshot Backup & Recovery Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 text-[#1F2E4A]">
          <Database size={18}/>
          <h3 className="font-bold text-sm">ERP Database Backup & Portability</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Export / Backup */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div>
              <p className="font-bold text-slate-900">Export Complete Database Snapshot</p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Download a JSON snapshot containing all customers, vendors, inventory items, orders, invoices, and accounting journals.
              </p>
            </div>
            <button
              type="button"
              onClick={exportDatabaseSnapshot}
              className="px-3.5 py-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Database size={14} /> Download Backup (.json)
            </button>
          </div>

        </div>

        {/* Factory Reset */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-semibold text-slate-800">Reload From Server</p>
            <p className="text-slate-500 text-[11px]">
              Discard what this screen is holding and re-read every collection from the server.
            </p>
          </div>
          {!showConfirmReset ? (
            <button
              type="button"
              onClick={() => setShowConfirmReset(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5"/> Reload Data
            </button>
          ) : (
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetData}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5"/> Confirm Reload
              </button>
            </div>
          )}
        </div>
      </div>
    </div>);
}

export const SettingsPage = () => {
    const [tab, setTab] = useState('general');
    return (
      <div className="space-y-5">
        <PageHeader
          title="Settings"
          subtitle="All module settings in one place — General, CRM, PMS and HRMS."
        />
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1F2E4A] text-white border-[#1F2E4A]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
        {tab === 'general' && <GeneralSettings />}
        {tab !== 'general' && (
          <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading settings…</div>}>
            {tab === 'crm' && <CRMSystemSetupPage />}
            {tab === 'pms' && <PMSSettingsPage />}
            {tab === 'hrms' && <HRAdminPage />}
          </Suspense>
        )}
      </div>
    );
};
