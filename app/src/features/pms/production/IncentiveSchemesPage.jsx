import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  BookOpen,
  RotateCcw,
  AlertCircle,
  X,
  CreditCard,
  User,
  Calendar,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { StatCard } from '../../../components/ui/StatCard';
import { Button } from '../../../components/ui/Button';
import { productionService, hrmsService } from '../../../services/domainServices';
import MasterSourceLink from '../../../components/common/MasterSourceLink';
import { formatINR, formatDate, unwrapList, describeApiError } from '../../accounts/accountingShared';

const STATUS_PILLS = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-300',
  Approved: 'bg-blue-50 text-blue-800 border-blue-300',
  Posted: 'bg-purple-50 text-purple-800 border-purple-300',
  Paid: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Cancelled: 'bg-rose-50 text-rose-800 border-rose-300',
};

const BASIS_LABELS = {
  INVOICE: 'Invoice Value',
  COLLECTION: 'Payment Collection',
  GROSS_PROFIT: 'Gross Profit',
};

export default function IncentiveSchemesPage() {
  const [activeTab, setActiveTab] = useState('schemes'); // 'schemes' | 'calculations'

  // Schemes State
  const [schemes, setSchemes] = useState([]);
  const [loadingSchemes, setLoadingSchemes] = useState(true);
  const [schemesError, setSchemesError] = useState('');

  // Calculations State
  const [calculations, setCalculations] = useState([]);
  const [loadingCalcs, setLoadingCalcs] = useState(false);
  const [calcsError, setCalcsError] = useState('');

  // Create Scheme Modal
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const [editingScheme, setEditingScheme] = useState(null);
  const [schemeForm, setSchemeForm] = useState({
    name: '',
    description: '',
    period_type: 'Quarterly',
    basis: 'INVOICE',
    slab_type: 'FLAT',
    rate_pct: '2.5',
    hold_unpaid_invoices: false,
    exclude_gst: true,
    is_active: true,
  });
  const [savingScheme, setSavingScheme] = useState(false);
  const [schemeModalError, setSchemeModalError] = useState('');

  // Calculate Modal
  const [calcModalScheme, setCalcModalScheme] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [calcForm, setCalcForm] = useState({
    employeeId: '',
    periodLabel: 'Q1 FY26',
    periodStart: '2026-04-01',
    periodEnd: '2026-06-30',
  });
  const [runningCalc, setRunningCalc] = useState(false);
  const [calcModalError, setCalcModalError] = useState('');

  // Pay Modal
  const [payTarget, setPayTarget] = useState(null);
  const [payMode, setPayMode] = useState('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);

  const loadSchemes = async () => {
    setLoadingSchemes(true);
    setSchemesError('');
    try {
      const res = await productionService.getIncentiveSchemes();
      setSchemes(unwrapList(res));
    } catch (err) {
      setSchemesError(describeApiError(err));
    } finally {
      setLoadingSchemes(false);
    }
  };

  const loadCalculations = async () => {
    setLoadingCalcs(true);
    setCalcsError('');
    try {
      const res = await productionService.getIncentiveCalculations();
      setCalculations(unwrapList(res));
    } catch (err) {
      setCalcsError(describeApiError(err));
    } finally {
      setLoadingCalcs(false);
    }
  };

  const loadEmployees = async () => {
    if (employees.length > 0) return;
    try {
      const res = await hrmsService.getEmployees({ page_size: 200 });
      setEmployees(unwrapList(res));
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    loadSchemes();
    loadCalculations();
  }, []);

  const handleOpenCreateScheme = () => {
    setEditingScheme(null);
    setSchemeForm({
      name: '',
      description: '',
      period_type: 'Quarterly',
      basis: 'INVOICE',
      slab_type: 'FLAT',
      rate_pct: '2.5',
      hold_unpaid_invoices: false,
      exclude_gst: true,
      is_active: true,
    });
    setSchemeModalError('');
    setShowSchemeModal(true);
  };

  const handleOpenEditScheme = (scheme) => {
    setEditingScheme(scheme);
    setSchemeForm({
      name: scheme.name,
      description: scheme.description || '',
      period_type: scheme.period_type || 'Quarterly',
      basis: scheme.basis || 'INVOICE',
      slab_type: scheme.slab_type || 'FLAT',
      rate_pct: String(scheme.rate_pct || '0'),
      hold_unpaid_invoices: Boolean(scheme.hold_unpaid_invoices),
      exclude_gst: Boolean(scheme.exclude_gst),
      is_active: Boolean(scheme.is_active),
    });
    setSchemeModalError('');
    setShowSchemeModal(true);
  };

  const handleSaveScheme = async (e) => {
    e.preventDefault();
    setSavingScheme(true);
    setSchemeModalError('');
    try {
      const payload = {
        name: schemeForm.name,
        description: schemeForm.description || undefined,
        period_type: schemeForm.period_type,
        basis: schemeForm.basis,
        slab_type: schemeForm.slab_type,
        rate_pct: parseFloat(schemeForm.rate_pct) || 0,
        hold_unpaid_invoices: schemeForm.hold_unpaid_invoices,
        exclude_gst: schemeForm.exclude_gst,
        is_active: schemeForm.is_active,
      };

      if (editingScheme) {
        await productionService.updateIncentiveScheme(editingScheme.id, payload);
      } else {
        await productionService.createIncentiveScheme(payload);
      }
      setShowSchemeModal(false);
      loadSchemes();
    } catch (err) {
      setSchemeModalError(describeApiError(err));
    } finally {
      setSavingScheme(false);
    }
  };

  const handleOpenRunCalc = (scheme) => {
    setCalcModalScheme(scheme);
    loadEmployees();
    setCalcForm({
      employeeId: '',
      periodLabel: `${scheme.period_type} Period`,
      periodStart: '2026-04-01',
      periodEnd: '2026-06-30',
    });
    setCalcModalError('');
  };

  const handleRunCalculateSubmit = async (e) => {
    e.preventDefault();
    if (!calcForm.employeeId) {
      setCalcModalError('Please select an employee.');
      return;
    }

    setRunningCalc(true);
    setCalcModalError('');
    try {
      await productionService.calculateIncentive(calcModalScheme.id, {
        employeeId: calcForm.employeeId,
        periodLabel: calcForm.periodLabel,
        periodStart: calcForm.periodStart,
        periodEnd: calcForm.periodEnd,
      });
      setCalcModalScheme(null);
      setActiveTab('calculations');
      loadCalculations();
    } catch (err) {
      setCalcModalError(describeApiError(err));
    } finally {
      setRunningCalc(false);
    }
  };

  const handleApproveCalc = async (id) => {
    try {
      await productionService.approveIncentiveCalculation(id);
      loadCalculations();
    } catch (err) {
      alert(describeApiError(err));
    }
  };

  const handlePostCalc = async (id) => {
    try {
      await productionService.postIncentiveCalculation(id);
      loadCalculations();
    } catch (err) {
      alert(describeApiError(err));
    }
  };

  const handleConfirmPay = async (e) => {
    e.preventDefault();
    if (!payTarget) return;
    setPaying(true);
    try {
      await productionService.payIncentiveCalculation(payTarget.id, {
        payment_mode: payMode,
        reference: payRef,
      });
      setPayTarget(null);
      loadCalculations();
    } catch (err) {
      alert(describeApiError(err));
    } finally {
      setPaying(false);
    }
  };

  const handleReverseCalc = async (id) => {
    const reason = prompt('Please specify reversal reason:');
    if (!reason) return;
    try {
      await productionService.reverseIncentiveCalculation(id, { reason });
      loadCalculations();
    } catch (err) {
      alert(describeApiError(err));
    }
  };

  // Stats
  const stats = useMemo(() => {
    const totalSchemes = schemes.length;
    const activeSchemes = schemes.filter((s) => s.is_active).length;
    let pendingPayout = 0;
    let settledPayout = 0;

    for (const c of calculations) {
      const amt = parseFloat(c.incentive_amount || 0);
      if (c.status === 'Paid') {
        settledPayout += amt;
      } else if (c.status !== 'Cancelled') {
        pendingPayout += amt;
      }
    }

    return { totalSchemes, activeSchemes, pendingPayout, settledPayout };
  }, [schemes, calculations]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production & Sales Incentives"
        subtitle="Configure salesperson and mill operator incentive schemes, trigger automated performance calculations, and route ledger payouts."
        actions={
          <Button
            icon={Plus}
            onClick={handleOpenCreateScheme}
            className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
          >
            Create Incentive Scheme
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Schemes" value={loadingSchemes ? '…' : `${stats.activeSchemes} / ${stats.totalSchemes}`} icon={Layers} />
        <StatCard label="Total Calculations" value={loadingCalcs ? '…' : calculations.length} icon={Clock} tone="amber" />
        <StatCard label="Pending Payouts" value={loadingCalcs ? '…' : formatINR(stats.pendingPayout)} icon={DollarSign} tone="blue" />
        <StatCard label="Settled Payouts" value={loadingCalcs ? '…' : formatINR(stats.settledPayout)} icon={CheckCircle2} tone="emerald" />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#CED4DA] gap-1 text-xs">
        <button
          onClick={() => setActiveTab('schemes')}
          className={`px-4 py-2.5 font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'schemes'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Incentive Schemes ({schemes.length})
        </button>
        <button
          onClick={() => setActiveTab('calculations')}
          className={`px-4 py-2.5 font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'calculations'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Calculations & Payouts ({calculations.length})
        </button>
      </div>

      {/* TAB 1: SCHEMES LIST */}
      {activeTab === 'schemes' && (
        <div className="space-y-4">
          {schemesError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{schemesError}</span>
            </div>
          )}

          <div className="bg-white border border-[#dce5f4] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#dce5f4] text-slate-600 font-semibold uppercase text-[10.5px]">
                    <th className="py-3 px-4">Scheme Name</th>
                    <th className="py-3 px-4">Cycle</th>
                    <th className="py-3 px-4">Basis</th>
                    <th className="py-3 px-4">Slab / Rate</th>
                    <th className="py-3 px-4">Rules</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dce5f4]">
                  {loadingSchemes ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading incentive schemes…
                      </td>
                    </tr>
                  ) : schemes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No incentive schemes defined yet. Click "Create Incentive Scheme" to add one.
                      </td>
                    </tr>
                  ) : (
                    schemes.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{s.name}</p>
                          {s.description && <p className="text-[11px] text-slate-400">{s.description}</p>}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">{s.period_type}</td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {BASIS_LABELS[s.basis] || s.basis}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">
                          {s.slab_type === 'FLAT' ? `${parseFloat(s.rate_pct)}% Flat` : 'Tiered Slabs'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {s.hold_unpaid_invoices && <span className="block">• Hold unpaid invoices</span>}
                          {s.exclude_gst && <span className="block">• Exclude GST</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenRunCalc(s)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] transition flex items-center gap-1 cursor-pointer"
                              title="Calculate Incentive"
                            >
                              <Play className="w-3 h-3" /> Run Calc
                            </button>
                            <button
                              onClick={() => handleOpenEditScheme(s)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
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

      {/* TAB 2: CALCULATIONS & PAYOUTS */}
      {activeTab === 'calculations' && (
        <div className="space-y-4">
          {calcsError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{calcsError}</span>
            </div>
          )}

          <div className="bg-white border border-[#dce5f4] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#dce5f4] text-slate-600 font-semibold uppercase text-[10.5px]">
                    <th className="py-3 px-4">Calc #</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4 text-right">Net Sales</th>
                    <th className="py-3 px-4 text-right">Incentive Amt</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dce5f4]">
                  {loadingCalcs ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading incentive calculations…
                      </td>
                    </tr>
                  ) : calculations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No incentive calculations found. Select a scheme and click "Run Calc" to generate one.
                      </td>
                    </tr>
                  ) : (
                    calculations.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">{c.calc_number}</td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800">{c.employeeName || '—'}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{c.employeeCode}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div>
                            <span className="font-medium text-slate-800">{c.period_label}</span>
                            <span className="block text-[10px] text-slate-400">
                              {formatDate(c.period_start)} to {formatDate(c.period_end)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">{formatINR(c.net_sales)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {formatINR(c.incentive_amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              STATUS_PILLS[c.status] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {c.status === 'Draft' && (
                              <button
                                onClick={() => handleApproveCalc(c.id)}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold cursor-pointer"
                              >
                                Approve
                              </button>
                            )}
                            {c.status === 'Approved' && (
                              <button
                                onClick={() => handlePostCalc(c.id)}
                                className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold cursor-pointer"
                              >
                                Post GL
                              </button>
                            )}
                            {c.status === 'Posted' && (
                              <button
                                onClick={() => {
                                  setPayTarget(c);
                                  setPayRef('');
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold cursor-pointer"
                              >
                                Settle Pay
                              </button>
                            )}
                            {c.status !== 'Paid' && c.status !== 'Cancelled' && (
                              <button
                                onClick={() => handleReverseCalc(c.id)}
                                className="px-2 py-1 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded text-[11px] font-medium cursor-pointer"
                              >
                                Reverse
                              </button>
                            )}
                          </div>
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

      {/* CREATE / EDIT SCHEME MODAL */}
      {showSchemeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-5 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">
                {editingScheme ? 'Edit Incentive Scheme' : 'Create Incentive Scheme'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSchemeModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {schemeModalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-2.5 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{schemeModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveScheme} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Scheme Name *</label>
                <input
                  type="text"
                  required
                  value={schemeForm.name}
                  onChange={(e) => setSchemeForm({ ...schemeForm, name: e.target.value })}
                  placeholder="e.g. Sales Executive Quarterly Incentive"
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={schemeForm.description}
                  onChange={(e) => setSchemeForm({ ...schemeForm, description: e.target.value })}
                  placeholder="Policy and qualifying criteria..."
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period Cycle</label>
                  <select
                    value={schemeForm.period_type}
                    onChange={(e) => setSchemeForm({ ...schemeForm, period_type: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Calculation Basis</label>
                  <select
                    value={schemeForm.basis}
                    onChange={(e) => setSchemeForm({ ...schemeForm, basis: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                  >
                    <option value="INVOICE">Invoice Value</option>
                    <option value="COLLECTION">Payment Collection</option>
                    <option value="GROSS_PROFIT">Gross Profit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Slab Type</label>
                  <select
                    value={schemeForm.slab_type}
                    onChange={(e) => setSchemeForm({ ...schemeForm, slab_type: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                  >
                    <option value="FLAT">Flat Rate (%)</option>
                    <option value="TIERED">Tiered Slabs</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={schemeForm.rate_pct}
                    onChange={(e) => setSchemeForm({ ...schemeForm, rate_pct: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schemeForm.hold_unpaid_invoices}
                    onChange={(e) => setSchemeForm({ ...schemeForm, hold_unpaid_invoices: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span className="text-slate-700">Hold incentive payout for unpaid customer invoices</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schemeForm.exclude_gst}
                    onChange={(e) => setSchemeForm({ ...schemeForm, exclude_gst: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span className="text-slate-700">Calculate on taxable value (exclude GST)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schemeForm.is_active}
                    onChange={(e) => setSchemeForm({ ...schemeForm, is_active: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span className="text-slate-700 font-semibold">Active scheme</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowSchemeModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingScheme}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingScheme ? 'Saving…' : 'Save Scheme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RUN CALCULATION MODAL */}
      {calcModalScheme && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">Run Calculation: {calcModalScheme.name}</h3>
              <button
                type="button"
                onClick={() => setCalcModalScheme(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {calcModalError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-2.5 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{calcModalError}</span>
              </div>
            )}

            <form onSubmit={handleRunCalculateSubmit} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Employee *</label>
                  <MasterSourceLink source="employees" />
                </div>
                <select
                  required
                  value={calcForm.employeeId}
                  onChange={(e) => setCalcForm({ ...calcForm, employeeId: e.target.value })}
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                >
                  <option value="">Select Employee...</option>
                  {employees.map((em) => (
                    <option key={em.id} value={em.id}>
                      {em.name} {em.employee_code ? `(${em.employee_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period Label *</label>
                <input
                  type="text"
                  required
                  value={calcForm.periodLabel}
                  onChange={(e) => setCalcForm({ ...calcForm, periodLabel: e.target.value })}
                  placeholder="e.g. Q1 FY2026-27"
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period Start *</label>
                  <input
                    type="date"
                    required
                    value={calcForm.periodStart}
                    onChange={(e) => setCalcForm({ ...calcForm, periodStart: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period End *</label>
                  <input
                    type="date"
                    required
                    value={calcForm.periodEnd}
                    onChange={(e) => setCalcForm({ ...calcForm, periodEnd: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCalcModalScheme(null)}
                  className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={runningCalc}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {runningCalc ? 'Calculating…' : 'Generate Calculation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SETTLE PAY MODAL */}
      {payTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 shadow-2xl text-xs space-y-4">
            <h3 className="font-bold text-base text-[#1F2E4A]">Record Payout Settlement</h3>
            <p className="text-slate-600">
              Settle incentive payout of <strong className="text-slate-900">{formatINR(payTarget.incentive_amount)}</strong> to{' '}
              <strong>{payTarget.employeeName}</strong>.
            </p>

            <form onSubmit={handleConfirmPay} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Payment Mode</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Reference / UTR Number</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UTR-987654321"
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayTarget(null)}
                  className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {paying ? 'Recording…' : 'Confirm Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
