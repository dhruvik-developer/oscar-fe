/**
 * [PHASE-4] LEGACY ORPHAN — this component is NOT routed. The live Settings page is
 *   features/settings/SettingsPage.jsx (company profile, currency, GSTIN). Deprecated
 *   `features/accounts/SettingsPage.jsx` kept intact per the no-delete rule.
 */
import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { Button } from '../../components/ui/Button';
import { Building2, Sliders, FileCheck, CheckCircle2, Save, } from 'lucide-react';
export const SettingsPage = () => {
    const { currency: globalCurrency, setCurrency: setGlobalCurrency } = useERP();
    const [savedToast, setSavedToast] = useState(false);
    // Settings State
    const [companyName, setCompanyName] = useState('Horizon Industrial & Hardware Solutions');
    const [taxId, setTaxId] = useState('US-EIN-94-2039481');
    const [currency, setCurrency] = useState(globalCurrency || 'USD ($)');
    const [fiscalYear, setFiscalYear] = useState('January - December (Calendar)');
    const [invoicePrefix, setInvoicePrefix] = useState('INV-2026-');
    const [soPrefix, setSoPrefix] = useState('SO-2026-');
    const [poPrefix, setPoPrefix] = useState('PO-2026-');
    const [safetyBufferPct, setSafetyBufferPct] = useState('20');
    const [autoApprovalThreshold, setAutoApprovalThreshold] = useState('5000');
    const handleSave = (e) => {
        e.preventDefault();
        setGlobalCurrency(currency);
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 3000);
    };
    return (<div className="space-y-6 max-w-4xl">
      {savedToast && (<div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16}/> System configurations & numbering series saved successfully!
        </div>)}

      <div>
        <h2 className="text-xl font-bold text-[#1F2E4A] tracking-tight">
          System Settings & Enterprise Configuration
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Manage fiscal periods, corporate tax details, automated reorder thresholds, and document voucher numbering.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Organization Settings */}
        <div className="bg-white rounded-lg border border-[#CED4DA] p-5 shadow-xs">
          <h3 className="font-bold text-sm text-[#1F2E4A] mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-[#1F2E4A]"/> Company & Fiscal Entity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company Legal Name</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]"/>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tax / EIN Identifier</label>
              <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA] font-mono"/>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Base Accounting Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]">
                <option value="USD ($)">USD ($) - United States Dollar</option>
                <option value="EUR (€)">EUR (€) - Euro</option>
                <option value="GBP (£)">GBP (£) - British Pound</option>
                <option value="INR (₹)">INR (₹) - Indian Rupee</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fiscal Year Cycle</label>
              <input value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]"/>
            </div>
          </div>
        </div>

        {/* Voucher & Document Series Prefix */}
        <div className="bg-white rounded-lg border border-[#CED4DA] p-5 shadow-xs">
          <h3 className="font-bold text-sm text-[#1F2E4A] mb-4 flex items-center gap-2">
            <FileCheck size={16} className="text-[#1F2E4A]"/> Document Numbering Series
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Sales Invoice Prefix</label>
              <input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA] font-mono"/>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Sales Order Prefix</label>
              <input value={soPrefix} onChange={(e) => setSoPrefix(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA] font-mono"/>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Purchase Order Prefix</label>
              <input value={poPrefix} onChange={(e) => setPoPrefix(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA] font-mono"/>
            </div>
          </div>
        </div>

        {/* Inventory Automation & Safety Stock Thresholds */}
        <div className="bg-white rounded-lg border border-[#CED4DA] p-5 shadow-xs">
          <h3 className="font-bold text-sm text-[#1F2E4A] mb-4 flex items-center gap-2">
            <Sliders size={16} className="text-[#1F2E4A]"/> Inventory Safety & Automation Rules
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Safety Stock Buffer (%)</label>
              <input type="number" value={safetyBufferPct} onChange={(e) => setSafetyBufferPct(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA] font-mono"/>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Flags "Low Stock" warning when available falls below this buffer.
              </span>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Auto-Approval Threshold ($)</label>
              <input type="number" value={autoApprovalThreshold} onChange={(e) => setAutoApprovalThreshold(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA] font-mono"/>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Purchase orders below this amount skip multi-level supervisor approval.
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button icon={Save} type="submit">
            Save System Configurations
          </Button>
        </div>
      </form>
    </div>);
};
