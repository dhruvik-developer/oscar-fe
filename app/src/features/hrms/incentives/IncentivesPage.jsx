import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  Award,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Plus,
  ShieldAlert,
  Search,
  Check,
  Ban,
  Settings,
  Pencil,
  X,
} from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { MetricCard } from "../../../components/hrms/MetricCard";
import { useIncentiveStore } from "../../../stores/incentiveStore";
import { describeError } from "../../../services/resourceSync";

const BASIS_LABELS = {
  INVOICE: "Invoice Value",
  COLLECTION: "Payment Collection",
  GROSS_PROFIT: "Gross Profit",
};

// How the rate is applied. Maps onto the scheme's slab_type + slabs
// (pms.IncentiveScheme / compute_scheme_incentive).
const RATE_MODES = {
  flat: "Flat % on all sales",
  slab: "Slab: whole sales at the rate of the slab reached",
  tiered: "Tiered: each band earns its own rate",
};

const DEFAULT_SLABS = [
  { min: 0, max: 1000000, rate_pct: 1.0 },
  { min: 1000000, max: 2500000, rate_pct: 1.5 },
  { min: 2500000, max: "", rate_pct: 2.0 },
];

const emptyScheme = () => ({
  id: null,
  name: "",
  description: "",
  basis: "INVOICE",
  mode: "tiered",
  ratePct: 1.5,
  slabs: DEFAULT_SLABS.map((s) => ({ ...s })),
  holdUnpaidInvoices: false,
  excludeGst: true,
  payoutAfterDays: 90,
  isActive: true,
});

const schemeToForm = (s) => {
  const slabs = Array.isArray(s.slabs) ? s.slabs : [];
  return {
    id: s.id,
    name: s.name || "",
    description: s.description || "",
    basis: s.basis || "INVOICE",
    mode: s.slabType === "TIERED" ? "tiered" : slabs.length ? "slab" : "flat",
    ratePct: Number(s.ratePct || 0),
    slabs: slabs.length
      ? slabs.map((sl) => ({ min: sl.min ?? 0, max: sl.max ?? "", rate_pct: sl.rate_pct ?? sl.rate ?? 0 }))
      : DEFAULT_SLABS.map((sl) => ({ ...sl })),
    holdUnpaidInvoices: Boolean(s.holdUnpaidInvoices),
    excludeGst: Boolean(s.excludeGst),
    payoutAfterDays: s.payoutAfterDays ?? 90,
    isActive: Boolean(s.isActive),
  };
};

const formToPayload = (f) => {
  const slabs =
    f.mode === "flat"
      ? []
      : f.slabs.map((sl) => ({
          min: Number(sl.min) || 0,
          max: sl.max === "" || sl.max === null ? null : Number(sl.max),
          rate_pct: Number(sl.rate_pct) || 0,
        }));
  return {
    id: f.id || undefined,
    name: f.name.trim(),
    description: f.description || null,
    periodType: "Quarterly",
    basis: f.basis,
    slabType: f.mode === "tiered" ? "TIERED" : "FLAT",
    ratePct: Number(f.ratePct) || 0,
    slabs,
    holdUnpaidInvoices: f.holdUnpaidInvoices,
    excludeGst: f.excludeGst,
    payoutAfterDays: Math.max(0, parseInt(f.payoutAfterDays, 10) || 0),
    isActive: f.isActive,
  };
};

const describeRate = (s) => {
  const slabs = Array.isArray(s.slabs) ? s.slabs : [];
  if (!slabs.length) return `${Number(s.ratePct || 0)}% flat`;
  const rates = slabs.map((sl) => `${Number(sl.rate_pct ?? sl.rate ?? 0)}%`).join(" / ");
  return `${s.slabType === "TIERED" ? "Tiered" : "Slab"} ${rates}`;
};

export default function IncentivesPage() {
  const {
    accruals,
    schemes,
    loading,
    error,
    quarterlyReport,
    hydrate,
    calculateQuarterlyIncentive,
    approveIncentive,
    holdPayout,
    releasePayout,
    markPaid,
    saveScheme,
    clearError,
  } = useIncentiveStore();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [calculating, setCalculating] = useState(false);
  const [calcQuarter, setCalcQuarter] = useState(1);
  const [calcYear, setCalcYear] = useState(() => {
    const now = new Date();
    // Financial year starts in April: Jan-Mar belong to the previous FY.
    return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  });
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [selectedAccrual, setSelectedAccrual] = useState(null);
  const [holdReason, setHoldReason] = useState("");
  const [schemeForm, setSchemeForm] = useState(emptyScheme);
  const [savingScheme, setSavingScheme] = useState(false);
  const [schemeError, setSchemeError] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const runAction = async (fn) => {
    try {
      await fn();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      await calculateQuarterlyIncentive(calcQuarter, calcYear);
      setIsCalcModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCalculating(false);
    }
  };

  const handleHoldConfirm = async () => {
    if (!selectedAccrual) return;
    try {
      await holdPayout(selectedAccrual.id, holdReason || "Managerial Hold");
      setIsHoldModalOpen(false);
      setSelectedAccrual(null);
      setHoldReason("");
    } catch (err) {
      console.error(err);
    }
  };

  const openSchemeModal = (scheme) => {
    setSchemeForm(scheme ? schemeToForm(scheme) : emptyScheme());
    setSchemeError("");
    setIsSchemeModalOpen(true);
  };

  const handleSaveScheme = async () => {
    if (!schemeForm.name.trim()) {
      setSchemeError("Give the scheme a name.");
      return;
    }
    setSavingScheme(true);
    setSchemeError("");
    try {
      await saveScheme(formToPayload(schemeForm));
      setIsSchemeModalOpen(false);
    } catch (err) {
      setSchemeError(describeError(err) || "The scheme could not be saved.");
    } finally {
      setSavingScheme(false);
    }
  };

  const toggleSchemeActive = (scheme) =>
    runAction(() => saveScheme({ id: scheme.id, isActive: !scheme.isActive }));

  const updateSlab = (idx, field, value) => {
    const slabs = schemeForm.slabs.map((sl, i) => (i === idx ? { ...sl, [field]: value } : sl));
    setSchemeForm({ ...schemeForm, slabs });
  };

  const filteredAccruals = useMemo(() => {
    return (accruals || []).filter((item) => {
      const matchSearch =
        !search ||
        (item.employeeName || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.period_name || item.periodName || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || (item.status || "").toUpperCase() === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [accruals, search, statusFilter]);

  const stats = useMemo(() => {
    let gross = 0;
    let returns = 0;
    let net = 0;
    let incentive = 0;
    let paid = 0;

    (accruals || []).forEach((a) => {
      if (a.status === "REVERSED") return;
      gross += Number(a.gross_sales || a.grossSales || 0);
      returns += Number(a.returns_deduction || a.returnsDeduction || 0);
      net += Number(a.net_eligible_sales || a.netEligibleSales || 0);
      incentive += Number(a.calculated_incentive || a.calculatedIncentive || 0);
      paid += Number(a.paidAmount || 0);
    });

    return { gross, returns, net, incentive, paid };
  }, [accruals]);

  const getStatusBadge = (status) => {
    const s = (status || "DRAFT").toUpperCase();
    switch (s) {
      case "APPROVED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">Approved</span>;
      case "PAID":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400">Paid</span>;
      case "HELD":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400">Held</span>;
      case "ACCRUED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">Accrued</span>;
      case "REVERSED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 line-through">Reversed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">Draft</span>;
    }
  };

  const skipped = quarterlyReport?.skipped || [];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Salesperson Incentive Management"
        subtitle="Configure incentive schemes, calculate quarterly payouts net of returns, and control approve / hold / payout (Scope §12). Incentive is paid outside payroll."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => openSchemeModal(null)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-lg bg-card hover:bg-soft transition"
            >
              <Plus className="w-4 h-4 text-muted" />
              New Scheme
            </button>
            <button
              onClick={() => setIsCalcModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Calculate Quarterly
            </button>
          </div>
        }
      />

      {error && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} title="Dismiss" className="shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {quarterlyReport && (
        <div className="p-3 rounded-lg border border-border bg-soft text-sm text-text">
          <b>{quarterlyReport.period_name || quarterlyReport.periodName}:</b> calculated {quarterlyReport.count} salesperson
          {quarterlyReport.count === 1 ? "" : "s"}.
          {skipped.length > 0 && (
            <span className="text-muted">
              {" "}Left unchanged (already approved / paid / reversed):{" "}
              {skipped.map((s) => `${s.employeeName} (${s.status})`).join(", ")}.
            </span>
          )}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Gross Eligible Sales" value={`₹${stats.gross.toLocaleString("en-IN")}`} sub="Quarterly aggregated" icon={TrendingUp} />
        <MetricCard label="Deducted Returns" value={`₹${stats.returns.toLocaleString("en-IN")}`} sub="Sales returns & credit notes" icon={ShieldAlert} />
        <MetricCard label="Net Incentive Base" value={`₹${stats.net.toLocaleString("en-IN")}`} sub="Base the rate applies to" icon={DollarSign} />
        <MetricCard label="Calculated Accrual" value={`₹${stats.incentive.toLocaleString("en-IN")}`} sub="Total incentive earned" icon={Award} />
        <MetricCard label="Disbursed / Paid" value={`₹${stats.paid.toLocaleString("en-IN")}`} sub="Paid out to salespersons" icon={CheckCircle2} />
      </div>

      {/* Schemes */}
      <div className="bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-semibold text-text">
            <Settings className="w-4 h-4 text-muted" /> Incentive Schemes
          </div>
          <span className="text-xs text-muted">Every active quarterly scheme is applied when you calculate a quarter.</span>
        </div>
        {(schemes || []).length === 0 ? (
          <div className="px-4 py-6 text-sm text-center text-muted">
            No schemes yet. Click "New Scheme" to set the incentive rate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-soft border-b border-border text-xs font-semibold text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Scheme</th>
                  <th className="py-2.5 px-4">Basis</th>
                  <th className="py-2.5 px-4">Rate</th>
                  <th className="py-2.5 px-4">Rules</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schemes.map((s) => (
                  <tr key={s.id} className="hover:bg-soft/50 transition">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-text">{s.name}</div>
                      {s.periodType && s.periodType !== "Quarterly" && (
                        <div className="text-[11px] text-amber-600">{s.periodType}: not used by quarterly calculation</div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-text">{BASIS_LABELS[s.basis] || s.basis}</td>
                    <td className="py-2.5 px-4 text-text">{describeRate(s)}</td>
                    <td className="py-2.5 px-4 text-xs text-muted">
                      {[
                        `Paid ${s.payoutAfterDays ?? 90} days after customer payment`,
                        s.holdUnpaidInvoices && "Holds unpaid share",
                        s.excludeGst && "Excl. GST",
                      ].filter(Boolean).join(" · ")}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => toggleSchemeActive(s)}
                        title={s.isActive ? "Deactivate" : "Activate"}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          s.isActive
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                        }`}
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => openSchemeModal(s)}
                        title="Edit scheme"
                        className="p-1.5 text-muted hover:text-text hover:bg-soft rounded transition"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search salesperson or period..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-soft border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <Filter className="w-4 h-4 text-muted" />
          <span className="text-xs font-medium text-muted">Status:</span>
          {["ALL", "ACCRUED", "APPROVED", "PAID", "HELD", "REVERSED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                statusFilter === st ? "bg-primary text-white" : "bg-soft text-muted hover:text-text border border-border"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Accruals Table */}
      <div className="bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-soft border-b border-border text-xs font-semibold text-muted uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Salesperson</th>
                <th className="py-3.5 px-4">Period</th>
                <th className="py-3.5 px-4 text-right">Gross Sales</th>
                <th className="py-3.5 px-4 text-right">Returns Cut</th>
                <th className="py-3.5 px-4 text-right">Net Sales Base</th>
                <th className="py-3.5 px-4 text-center">Rate (%)</th>
                <th className="py-3.5 px-4 text-right">Incentive</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAccruals.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-muted">
                    {loading ? "Loading…" : 'No incentive accruals found. Click "Calculate Quarterly" to evaluate salesperson incentives.'}
                  </td>
                </tr>
              ) : (
                filteredAccruals.map((row) => (
                  <tr key={row.id} className="hover:bg-soft/50 transition">
                    <td className="py-3 px-4">
                      <div className="font-medium text-text">{row.employeeName || row.employee?.name || "Salesperson"}</div>
                      <div className="text-xs text-muted">{row.employeeCode || row.employee?.employee_code || "—"}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-text">{row.period_name || row.periodName}</div>
                      {row.schemeName && <div className="text-xs text-muted">{row.schemeName}</div>}
                    </td>
                    <td className="py-3 px-4 text-right text-text">
                      ₹{Number(row.gross_sales || row.grossSales || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right text-red-600 font-medium">
                      -₹{Number(row.returns_deduction || row.returnsDeduction || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-text">
                      ₹{Number(row.net_eligible_sales || row.netEligibleSales || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-text">{row.applicable_rate || row.applicableRate}%</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{Number(row.calculated_incentive || row.calculatedIncentive || 0).toLocaleString("en-IN")}
                      {row.status === "APPROVED" && (
                        <div className="text-[11px] font-medium text-muted">
                          Payable now ₹{Number(row.payableNow || 0).toLocaleString("en-IN")}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(row.status)}
                      {(row.hold_reason || row.holdReason) && (
                        <div className="text-[11px] text-red-500 truncate max-w-[140px] mt-0.5" title={row.hold_reason || row.holdReason}>
                          {row.hold_reason || row.holdReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.status === "ACCRUED" && (
                          <>
                            <button
                              onClick={() => runAction(() => approveIncentive(row.id))}
                              title="Approve"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded dark:hover:bg-emerald-950/50 transition"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAccrual(row);
                                setIsHoldModalOpen(true);
                              }}
                              title="Hold Payout (Bad Debt / Delay)"
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-950/50 transition"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {row.status === "HELD" && (
                          <button
                            onClick={() => runAction(() => releasePayout(row.id))}
                            title="Release Hold"
                            className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded dark:bg-amber-950/40 dark:text-amber-400 transition"
                          >
                            Release
                          </button>
                        )}
                        {row.status === "APPROVED" && Number(row.payableNow || 0) > 0 && (
                          <button
                            onClick={() => runAction(() => markPaid(row.id))}
                            title="Mark as Paid"
                            className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded dark:bg-blue-950/40 dark:text-blue-400 transition"
                          >
                            Mark Paid
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

      {/* Calculate Quarterly Modal */}
      {isCalcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-text">Calculate Quarterly Incentive</h3>
            <p className="text-sm text-muted">
              Takes the quarter's invoices and returns for every salesperson named on them and applies each active quarterly
              scheme. Rows already approved or paid are left as they are.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted uppercase">Quarter</label>
                <select
                  value={calcQuarter}
                  onChange={(e) => setCalcQuarter(Number(e.target.value))}
                  className="w-full mt-1.5 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                >
                  <option value={1}>Q1 (Apr - Jun)</option>
                  <option value={2}>Q2 (Jul - Sep)</option>
                  <option value={3}>Q3 (Oct - Dec)</option>
                  <option value={4}>Q4 (Jan - Mar)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted uppercase">Financial Year (start)</label>
                <input
                  type="number"
                  value={calcYear}
                  onChange={(e) => setCalcYear(Number(e.target.value))}
                  className="w-full mt-1.5 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                />
                <div className="text-[11px] text-muted mt-1">
                  FY {calcYear}-{String((calcYear + 1) % 100).padStart(2, "0")}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setIsCalcModalOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft"
              >
                Cancel
              </button>
              <button
                disabled={calculating}
                onClick={handleCalculate}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                {calculating && <RefreshCw className="w-4 h-4 animate-spin" />}
                Calculate Accruals
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hold Modal */}
      {isHoldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-text text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Hold Incentive Payout
            </h3>
            <p className="text-sm text-muted">
              Place a managerial hold on <b>{selectedAccrual?.employeeName}</b>'s incentive payout due to overdue customer
              accounts, returns, or pending verification.
            </p>
            <div>
              <label className="text-xs font-semibold text-muted uppercase">Reason for Hold</label>
              <textarea
                rows="3"
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="e.g. Pending party payment for Invoice #INV-204"
                className="w-full mt-1.5 p-2.5 bg-soft border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setIsHoldModalOpen(false);
                  setSelectedAccrual(null);
                }}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft"
              >
                Cancel
              </button>
              <button
                onClick={handleHoldConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheme Modal */}
      {isSchemeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-text">{schemeForm.id ? "Edit Incentive Scheme" : "New Incentive Scheme"}</h3>
            <p className="text-sm text-muted">
              Quarterly salesperson incentive (Oscar Letter Pad §12). Sales returns and credit notes are always deducted.
            </p>
            {schemeError && (
              <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400">
                {schemeError}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted uppercase">Scheme Name</label>
                <input
                  type="text"
                  value={schemeForm.name}
                  onChange={(e) => setSchemeForm({ ...schemeForm, name: e.target.value })}
                  placeholder="e.g. Quarterly Standard Slab"
                  className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted uppercase">Calculation Basis</label>
                  <select
                    value={schemeForm.basis}
                    onChange={(e) => setSchemeForm({ ...schemeForm, basis: e.target.value })}
                    className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                  >
                    {Object.entries(BASIS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted uppercase">Rate Structure</label>
                  <select
                    value={schemeForm.mode}
                    onChange={(e) => setSchemeForm({ ...schemeForm, mode: e.target.value })}
                    className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                  >
                    {Object.entries(RATE_MODES).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {schemeForm.mode === "flat" ? (
                <div>
                  <label className="text-xs font-semibold text-muted uppercase">Flat Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={schemeForm.ratePct}
                    onChange={(e) => setSchemeForm({ ...schemeForm, ratePct: e.target.value })}
                    className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted uppercase">Sales Brackets (₹) — leave the last "Max" empty for no limit</label>
                  {schemeForm.slabs.map((slab, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-muted w-12">Tier {idx + 1}:</span>
                      <input
                        type="number"
                        placeholder="Min"
                        value={slab.min}
                        onChange={(e) => updateSlab(idx, "min", e.target.value)}
                        className="w-28 p-1.5 bg-soft border border-border rounded text-xs text-text"
                      />
                      <span className="text-xs text-muted">to</span>
                      <input
                        type="number"
                        placeholder="No limit"
                        value={slab.max ?? ""}
                        onChange={(e) => updateSlab(idx, "max", e.target.value)}
                        className="w-28 p-1.5 bg-soft border border-border rounded text-xs text-text"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="%"
                        value={slab.rate_pct}
                        onChange={(e) => updateSlab(idx, "rate_pct", e.target.value)}
                        className="w-16 p-1.5 bg-soft border border-border rounded text-xs text-text font-bold"
                      />
                      <span className="text-xs text-muted">%</span>
                      {schemeForm.slabs.length > 1 && (
                        <button
                          onClick={() => setSchemeForm({ ...schemeForm, slabs: schemeForm.slabs.filter((_, i) => i !== idx) })}
                          title="Remove tier"
                          className="p-1 text-muted hover:text-red-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const last = schemeForm.slabs[schemeForm.slabs.length - 1];
                      const start = last && last.max !== "" && last.max !== null ? Number(last.max) : 0;
                      setSchemeForm({ ...schemeForm, slabs: [...schemeForm.slabs, { min: start, max: "", rate_pct: 0 }] });
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add tier
                  </button>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted uppercase">Pay incentive after (days from customer payment)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={schemeForm.payoutAfterDays}
                  onChange={(e) => setSchemeForm({ ...schemeForm, payoutAfterDays: e.target.value })}
                  className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                />
                <div className="text-[11px] text-muted mt-1">
                  Each customer payment releases its share of the incentive once it is this many days old. Default 90.
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={schemeForm.holdUnpaidInvoices}
                    onChange={(e) => setSchemeForm({ ...schemeForm, holdUnpaidInvoices: e.target.checked })}
                    className="rounded border-border"
                  />
                  Hold the share of unpaid invoices (released automatically as the customer pays)
                </label>
                <label className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={schemeForm.excludeGst}
                    onChange={(e) => setSchemeForm({ ...schemeForm, excludeGst: e.target.checked })}
                    className="rounded border-border"
                  />
                  Exclude GST from the sales base
                </label>
                <label className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={schemeForm.isActive}
                    onChange={(e) => setSchemeForm({ ...schemeForm, isActive: e.target.checked })}
                    className="rounded border-border"
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setIsSchemeModalOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft"
              >
                Close
              </button>
              <button
                disabled={savingScheme}
                onClick={handleSaveScheme}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                {savingScheme && <RefreshCw className="w-4 h-4 animate-spin" />}
                Save Scheme
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
