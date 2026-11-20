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
  Users,
  Eye,
  RotateCcw,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  UserCheck,
  CreditCard,
  Building2,
  History,
  Clock,
} from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { MetricCard } from "../../../components/hrms/MetricCard";
import { useIncentiveStore } from "../../../stores/incentiveStore";
import { useAppStore } from "../../../stores/appStore";
import { describeError } from "../../../services/resourceSync";
import { useTableSort } from "../../../hooks/useTableSort";
import SortableTh from "../../../components/ui/SortableTh";
import AppPagination from "../../../components/ui/AppPagination";
import Modal from "../../../components/ui/Modal";

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
    salespersonPerformance,
    dashboardSummary,
    selectedSalespersonDetail,
    detailLoading,
    paymentHistory,
    paymentHistoryLoading,
    bankAccounts,
    loading,
    error,
    quarterlyReport,
    hydrate,
    calculateQuarterlyIncentive,
    approveIncentive,
    holdPayout,
    releasePayout,
    markPaid,
    payDirect,
    payThroughSalary,
    fetchPaymentHistory,
    fetchBankAccounts,
    reversePayout,
    saveScheme,
    fetchSalespersonDetail,
    clearSelectedSalespersonDetail,
    clearError,
  } = useIncentiveStore();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [salespersonSearch, setSalespersonSearch] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [calcQuarter, setCalcQuarter] = useState(3);
  const [calcYear, setCalcYear] = useState(() => {
    const now = new Date();
    return now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  });

  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("leads");

  const [selectedAccrual, setSelectedAccrual] = useState(null);
  const [holdReason, setHoldReason] = useState("");
  const [reverseReason, setReverseReason] = useState("");
  const [schemeForm, setSchemeForm] = useState(emptyScheme);
  const [savingScheme, setSavingScheme] = useState(false);
  const [schemeError, setSchemeError] = useState("");

  // Payment dialog state (Option A: Direct Payment / Option B: Pay Through Salary)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payModalAccrual, setPayModalAccrual] = useState(null);
  const [payMethod, setPayMethod] = useState("DIRECT"); // "DIRECT" or "SALARY"
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payAccountId, setPayAccountId] = useState("");
  const [payReference, setPayReference] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payMonth, setPayMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  // Payment history modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyTargetAccrual, setHistoryTargetAccrual] = useState(null);
  const [historyScope, setHistoryScope] = useState("THIS_INCENTIVE"); // "THIS_INCENTIVE" or "SALESPERSON" or "ALL"
  const [historyMethodFilter, setHistoryMethodFilter] = useState("ALL");
  const [historySearch, setHistorySearch] = useState("");

  useEffect(() => {
    hydrate(calcQuarter, calcYear);
    fetchBankAccounts();
  }, [hydrate, fetchBankAccounts]);

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

  const handleReverseConfirm = async () => {
    if (!selectedAccrual) return;
    try {
      await reversePayout(selectedAccrual.id, reverseReason || "Managerial Reversal");
      setIsReverseModalOpen(false);
      setSelectedAccrual(null);
      setReverseReason("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDetail = async (person) => {
    setIsDetailModalOpen(true);
    setDetailTab("leads");
    try {
      await fetchSalespersonDetail(person.employeeId || person.id, calcQuarter, calcYear);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenPayModal = (accrual) => {
    setPayModalAccrual(accrual);
    const isSalaryQueued = Boolean(
      accrual.payslipId ||
      accrual.detail?.queued_salary_amount ||
      (accrual.paymentMethod || '').toLowerCase().includes('salary')
    );
    setPayMethod(isSalaryQueued ? "SALARY" : "DIRECT");
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayReference("");
    setPayNotes("");
    setPayError("");
    const approved = Number(accrual.calculated_incentive || accrual.calculatedIncentive || 0);
    const paid = Number(accrual.paidAmount || accrual.paid_amount || 0);
    const remaining = Math.max(0, approved - paid);
    setPayAmount(remaining > 0 ? remaining.toFixed(2) : "0.00");
    const queuedMonth = accrual.detail?.queued_payroll_period;
    setPayMonth(queuedMonth || new Date().toISOString().slice(0, 7));
    if (bankAccounts && bankAccounts.length > 0) {
      const def = bankAccounts.find((b) => b.is_default || b.isDefault) || bankAccounts[0];
      setPayAccountId(def.id);
    }
    setIsPayModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!payModalAccrual) return;
    setPaying(true);
    setPayError("");
    try {
      if (payMethod === "DIRECT") {
        const amt = Number(payAmount);
        if (!amt || amt <= 0) {
          setPayError("Enter a valid payment amount greater than zero.");
          setPaying(false);
          return;
        }
        await payDirect(payModalAccrual.id, {
          paymentDate: payDate,
          bankAccountId: payAccountId || undefined,
          amount: amt,
          paymentReference: payReference.trim() || undefined,
          notes: payNotes.trim() || undefined,
        });
        useAppStore.getState().showToast(
          `Direct payment of ₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} posted successfully.`
        );
      } else {
        const amt = Number(payAmount);
        if (!amt || amt <= 0) {
          setPayError("Enter a valid incentive amount greater than zero.");
          setPaying(false);
          return;
        }
        await payThroughSalary(payModalAccrual.id, {
          month: payMonth,
          amount: amt,
        });
        useAppStore.getState().showToast(
          `Incentive of ₹${amt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} successfully linked to ${payMonth} salary under component "Sales Incentive".`
        );
      }
      setIsPayModalOpen(false);
      setPayModalAccrual(null);
    } catch (err) {
      console.error(err);
      setPayError(describeError(err) || err?.message || "Failed to process payment.");
    } finally {
      setPaying(false);
    }
  };

  const handleOpenHistory = async (accrual = null) => {
    setHistoryTargetAccrual(accrual);
    setHistoryScope(accrual ? "THIS_INCENTIVE" : "ALL");
    setHistoryMethodFilter("ALL");
    setHistorySearch("");
    setIsHistoryModalOpen(true);
    await fetchPaymentHistory();
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

  // Filtered accruals
  const filteredAccruals = useMemo(() => {
    return (accruals || []).filter((item) => {
      const matchSearch =
        !search ||
        (item.employeeName || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.period_name || item.periodName || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.paymentMethod || "").toLowerCase().includes(search.toLowerCase());

      const st = (item.status || "DRAFT").toUpperCase();
      let matchStatus = true;
      if (statusFilter !== "ALL") {
        if (statusFilter === "PARTIALLY_PAID") {
          matchStatus = st === "PARTIALLY_PAID";
        } else if (statusFilter === "APPROVED") {
          matchStatus = st === "APPROVED";
        } else {
          matchStatus = st === statusFilter;
        }
      }

      return matchSearch && matchStatus;
    });
  }, [accruals, search, statusFilter]);

  const accrualSort = useTableSort(filteredAccruals, {
    accessors: {
      employeeName: (r) => r.employeeName || r.employee?.name || "",
      periodName: (r) => r.period_name || r.periodName || "",
      grossSales: (r) => Number(r.gross_sales || r.grossSales || 0),
      returnsDeduction: (r) => Number(r.returns_deduction || r.returnsDeduction || 0),
      netEligibleSales: (r) => Number(r.net_eligible_sales || r.netEligibleSales || 0),
      applicableRate: (r) => Number(r.applicable_rate || r.applicableRate || 0),
      calculatedIncentive: (r) => Number(r.calculated_incentive || r.calculatedIncentive || 0),
      paidAmount: (r) => Number(r.paidAmount || r.paid_amount || 0),
      paymentMethod: (r) => r.paymentMethod || r.payment_method || "",
      status: (r) => r.status || "",
    },
  });

  const filteredHistory = useMemo(() => {
    let rows = paymentHistory || [];
    if (historyTargetAccrual) {
      if (historyScope === "THIS_INCENTIVE") {
        rows = rows.filter((r) => String(r.incentiveId) === String(historyTargetAccrual.id));
      } else if (historyScope === "SALESPERSON") {
        rows = rows.filter(
          (r) =>
            String(r.incentiveId) === String(historyTargetAccrual.id) ||
            (historyTargetAccrual.employeeId && String(r.salespersonId) === String(historyTargetAccrual.employeeId))
        );
      }
    }
    if (historyMethodFilter !== "ALL") {
      rows = rows.filter((r) => {
        const m = (r.paymentMethod || "").toLowerCase();
        if (historyMethodFilter === "DIRECT") return m.includes("direct");
        if (historyMethodFilter === "SALARY") return m.includes("salary");
        return true;
      });
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      rows = rows.filter((r) =>
        [r.salesperson, r.salespersonCode, r.incentivePeriod, r.paymentReference, r.payrollReference, r.paymentMethod, r.paymentStatus]
          .filter(Boolean)
          .some((val) => val.toLowerCase().includes(q))
      );
    }
    return rows;
  }, [paymentHistory, historyTargetAccrual, historyScope, historyMethodFilter, historySearch]);

  // Filtered salesperson performance
  const filteredPerformance = useMemo(() => {
    return (salespersonPerformance || []).filter((sp) => {
      if (!salespersonSearch) return true;
      const q = salespersonSearch.toLowerCase();
      return (
        (sp.employeeName || "").toLowerCase().includes(q) ||
        (sp.employeeCode || "").toLowerCase().includes(q) ||
        (sp.department || "").toLowerCase().includes(q) ||
        (sp.designation || "").toLowerCase().includes(q)
      );
    });
  }, [salespersonPerformance, salespersonSearch]);

  const performanceSort = useTableSort(filteredPerformance, {
    accessors: {
      employeeName: (sp) => sp.employeeName || "",
      assignedLeads: (sp) => Number(sp.assignedLeads || 0),
      activeLeads: (sp) => Number(sp.activeLeads || 0),
      convertedLeads: (sp) => Number(sp.convertedLeads || 0),
      lostLeads: (sp) => Number(sp.lostLeads || 0),
      grossEligibleSales: (sp) => Number(sp.grossEligibleSales || 0),
      incentiveEarned: (sp) => Number(sp.incentiveEarned || 0),
    },
  });

  const [perfPage, setPerfPage] = useState(1);
  const [perfPageSize, setPerfPageSize] = useState(5);

  const paginatedPerformance = useMemo(() => {
    const start = (perfPage - 1) * perfPageSize;
    return (performanceSort.rows || []).slice(start, start + perfPageSize);
  }, [performanceSort.rows, perfPage, perfPageSize]);

  const [accrualPage, setAccrualPage] = useState(1);
  const [accrualPageSize, setAccrualPageSize] = useState(10);

  useEffect(() => {
    setAccrualPage(1);
  }, [search, statusFilter, accrualPageSize]);

  const paginatedAccruals = useMemo(() => {
    const start = (accrualPage - 1) * accrualPageSize;
    return accrualSort.rows.slice(start, start + accrualPageSize);
  }, [accrualSort.rows, accrualPage, accrualPageSize]);

  // Dashboard KPI metrics: directly from real backend database summary (Scope §7)
  const stats = useMemo(() => {
    if (dashboardSummary) {
      return {
        gross: Number(dashboardSummary.grossEligibleSales || 0),
        returns: Number(dashboardSummary.deductedReturns || 0),
        net: Number(dashboardSummary.netIncentiveBase || 0),
        incentive: Number(dashboardSummary.calculatedAccrual || 0),
        paid: Number(dashboardSummary.disbursedPaid || 0),
      };
    }
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
  }, [accruals, dashboardSummary]);

  const getStatusBadge = (status) => {
    const s = (status || "DRAFT").toUpperCase();
    switch (s) {
      case "APPROVED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">Approved</span>;
      case "PARTIALLY_PAID":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">Partially Paid</span>;
      case "PAID":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400">Paid</span>;
      case "HELD":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400">Held</span>;
      case "ACCRUED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">Accrued</span>;
      case "REVERSED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 line-through">Reversed</span>;
      case "PENDING_CALC":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400">Sales Recorded</span>;
      case "ACTIVE":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">Draft</span>;
    }
  };

  const skipped = quarterlyReport?.skipped || [];

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      <PageHeader
        title="Salesperson Incentive Management"
        subtitle="Configure incentive schemes, calculate quarterly payouts net of returns, and manage direct and salary payouts."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleOpenHistory(null)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-lg bg-card hover:bg-soft transition shadow-2xs text-text"
              title="View all incentive payment logs"
            >
              <History className="w-4 h-4 text-primary" />
              Payment History
            </button>
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

      {/* Metric Cards - Actual Database Records */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <MetricCard index={0} label="Gross Eligible Sales" value={`₹${stats.gross.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="Quarterly aggregated" icon={TrendingUp} />
        <MetricCard index={1} label="Deducted Returns" value={`₹${stats.returns.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="Sales returns & credit notes" icon={ShieldAlert} />
        <MetricCard index={2} label="Net Incentive Base" value={`₹${stats.net.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="Base the rate applies to" icon={DollarSign} />
        <MetricCard index={3} label="Calculated Accrual" value={`₹${stats.incentive.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="Total incentive earned" icon={Award} />
        <MetricCard index={4} label="Disbursed / Paid" value={`₹${stats.paid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="Paid out to salespersons" icon={CheckCircle2} />
      </div>

{/* SECTION 3: Incentive Accruals & Payouts */}
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
          {["ALL", "ACCRUED", "APPROVED", "PARTIALLY_PAID", "PAID", "HELD", "REVERSED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                statusFilter === st ? "bg-primary text-white" : "bg-soft text-muted hover:text-text border border-border"
              }`}
            >
              {st === "ALL"
                ? "All"
                : st === "PARTIALLY_PAID"
                ? "Partially Paid"
                : st === "ACCRUED"
                ? "Accrued"
                : st === "APPROVED"
                ? "Approved"
                : st === "PAID"
                ? "Paid"
                : st === "HELD"
                ? "Held"
                : "Reversed"}
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
                <SortableTh sort={accrualSort} sortKey="employeeName" className="py-3.5 px-4">Salesperson</SortableTh>
                <SortableTh sort={accrualSort} sortKey="periodName" className="py-3.5 px-4">Period</SortableTh>
                <SortableTh sort={accrualSort} sortKey="grossSales" className="py-3.5 px-4 text-right" align="right">Gross Sales</SortableTh>
                <SortableTh sort={accrualSort} sortKey="returnsDeduction" className="py-3.5 px-4 text-right" align="right">Returns Cut</SortableTh>
                <SortableTh sort={accrualSort} sortKey="netEligibleSales" className="py-3.5 px-4 text-right" align="right">Net Sales Base</SortableTh>
                <SortableTh sort={accrualSort} sortKey="applicableRate" className="py-3.5 px-4 text-center" align="center">Rate (%)</SortableTh>
                <SortableTh sort={accrualSort} sortKey="calculatedIncentive" className="py-3.5 px-4 text-right" align="right">Incentive</SortableTh>
                <SortableTh sort={accrualSort} sortKey="paidAmount" className="py-3.5 px-4 text-right" align="right">Paid / Balance</SortableTh>
                <SortableTh sort={accrualSort} sortKey="paymentMethod" className="py-3.5 px-4 text-center" align="center">Method</SortableTh>
                <SortableTh sort={accrualSort} sortKey="status" className="py-3.5 px-4 text-center" align="center">Status</SortableTh>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAccruals.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-muted">
                    {loading ? "Loading…" : 'No incentive accruals found. Click "Calculate Quarterly" to evaluate salesperson incentives.'}
                  </td>
                </tr>
              ) : (
                paginatedAccruals.map((row) => {
                  const approvedAmt = Number(row.calculated_incentive || row.calculatedIncentive || 0);
                  const paidAmt = Number(row.paidAmount || row.paid_amount || 0);
                  const remainingAmt = Math.max(0, approvedAmt - paidAmt);
                  const isSalaryQueued = Boolean(
                    row.payslipId ||
                    row.detail?.queued_salary_amount ||
                    (row.paymentMethod || "").toLowerCase().includes("salary")
                  );
                  const isPayable = (row.status === "APPROVED" || row.status === "PARTIALLY_PAID") && remainingAmt > 0;
                  const hasHistory = (row.paymentHistory && row.paymentHistory.length > 0) || paidAmt > 0 || Boolean(row.detail?.payments && row.detail.payments.length > 0);

                  return (
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
                        ₹{Number(row.gross_sales || row.grossSales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right text-red-600 font-medium">
                        -₹{Number(row.returns_deduction || row.returnsDeduction || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-text">
                        ₹{Number(row.net_eligible_sales || row.netEligibleSales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-text">{row.applicable_rate || row.applicableRate}%</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{approvedAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-semibold text-text">
                          ₹{paidAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {remainingAmt > 0 && paidAmt > 0 && (
                          <div className="text-[11px] font-medium text-amber-600">
                            Rem: ₹{remainingAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.paymentMethod && row.paymentMethod !== "-" ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              row.paymentMethod.includes("Direct") && row.paymentMethod.includes("Salary")
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : row.paymentMethod.includes("Direct")
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {row.paymentMethod.includes("Direct") ? <CreditCard className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                            {row.paymentMethod}
                          </span>
                        ) : isSalaryQueued ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
                            <Building2 className="w-3 h-3" />
                            Through Salary
                          </span>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isSalaryQueued && row.status === "APPROVED" ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                              Approved
                            </span>
                            <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300" title="This payment will be given together with monthly salary">
                              <Building2 className="w-3 h-3 shrink-0" />
                              Pay with {row.detail?.queued_payroll_period || "Salary"}
                            </span>
                          </div>
                        ) : (
                          getStatusBadge(row.status)
                        )}
                        {(row.hold_reason || row.holdReason) && (
                          <div className="text-[11px] text-red-500 truncate max-w-[140px] mt-0.5" title={row.hold_reason || row.holdReason}>
                            {row.hold_reason || row.holdReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {isPayable && (
                            <button
                              onClick={() => handleOpenPayModal(row)}
                              title={isSalaryQueued ? "Payment Queued with Salary · Click to Review or Update" : "Pay Approved Incentive"}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg shadow-2xs transition ${
                                isSalaryQueued
                                  ? "text-blue-700 dark:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800"
                                  : "text-white bg-emerald-600 hover:bg-emerald-700"
                              }`}
                            >
                              {isSalaryQueued ? (
                                <>
                                  <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  Salary Linked
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-3.5 h-3.5" />
                                  Pay Incentive
                                </>
                              )}
                            </button>
                          )}
                          {hasHistory && (
                            <button
                              onClick={() => handleOpenHistory(row)}
                              title="View Payment History"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition"
                            >
                              <History className="w-3.5 h-3.5" />
                              History
                            </button>
                          )}
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
                              <button
                                onClick={() => {
                                  setSelectedAccrual(row);
                                  setIsReverseModalOpen(true);
                                }}
                                title="Reverse Accrual (Controlled Adjustment)"
                                className="p-1.5 text-neutral-500 hover:bg-neutral-100 rounded transition"
                              >
                                <RotateCcw className="w-4 h-4" />
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
                          {(row.status === "APPROVED" || row.status === "PARTIALLY_PAID") && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedAccrual(row);
                                  setIsHoldModalOpen(true);
                                }}
                                title="Hold Payout"
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAccrual(row);
                                  setIsReverseModalOpen(true);
                                }}
                                title="Reverse Incentive"
                                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded transition"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <AppPagination
          total={filteredAccruals.length}
          page={accrualPage}
          pageSize={accrualPageSize}
          onPageChange={setAccrualPage}
          onPageSizeChange={setAccrualPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>

{/* SECTION 1: Salesperson CRM Performance & Incentive Attribution (Requirement §2) */}
      <div className="bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3.5 border-b border-border gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-text">
              <Users className="w-4 h-4 text-primary" />
              Salesperson CRM Performance & Attribution
            </div>
            <p className="text-xs text-muted mt-0.5">
              Live CRM lead assignments, pipeline conversions, eligible sales, and earned incentives per salesperson.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search salesperson..."
              value={salespersonSearch}
              onChange={(e) => setSalespersonSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-soft border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-text"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-soft border-b border-border text-xs font-semibold text-muted uppercase tracking-wider">
              <tr>
                <SortableTh sort={performanceSort} sortKey="employeeName" className="py-3 px-4">Salesperson</SortableTh>
                <SortableTh sort={performanceSort} sortKey="assignedLeads" className="py-3 px-4 text-center" align="center">Assigned Leads</SortableTh>
                <SortableTh sort={performanceSort} sortKey="activeLeads" className="py-3 px-4 text-center" align="center">Active Leads</SortableTh>
                <SortableTh sort={performanceSort} sortKey="convertedLeads" className="py-3 px-4 text-center" align="center">Converted Leads</SortableTh>
                <SortableTh sort={performanceSort} sortKey="lostLeads" className="py-3 px-4 text-center" align="center">Lost Leads</SortableTh>
                <SortableTh sort={performanceSort} sortKey="grossEligibleSales" className="py-3 px-4 text-right" align="right">Total Eligible Sales</SortableTh>
                <SortableTh sort={performanceSort} sortKey="incentiveEarned" className="py-3 px-4 text-right" align="right">Incentive Earned</SortableTh>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPerformance.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-muted text-xs">
                    {loading ? "Loading salesperson records..." : "No salesperson records found matching filters."}
                  </td>
                </tr>
              ) : (
                paginatedPerformance.map((sp) => (
                  <tr
                    key={sp.id}
                    onClick={() => handleOpenDetail(sp)}
                    className="hover:bg-soft/60 transition cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-text group-hover:text-primary transition flex items-center gap-2">
                        {sp.employeeName}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/10 text-muted font-normal">
                          {sp.employeeCode}
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        {sp.designation} {sp.department ? `· ${sp.department}` : ""}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-text">
                        {sp.assignedLeads}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        {sp.activeLeads}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        {sp.convertedLeads}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                        {sp.lostLeads}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-text">
                      ₹{Number(sp.grossEligibleSales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{Number(sp.incentiveEarned || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(sp.status)}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenDetail(sp)}
                        title="View Performance & History"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <AppPagination
          total={filteredPerformance.length}
          page={perfPage}
          pageSize={perfPageSize}
          onPageChange={setPerfPage}
          onPageSizeChange={setPerfPageSize}
          pageSizeOptions={[5, 10, 20]}
        />
      </div>

      {/* MODAL 1: Calculate Quarterly Modal */}
      <Modal
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
        title="Calculate Quarterly Incentive"
        subtitle="Takes the quarter's invoices and returns for every salesperson named on them and applies each active quarterly scheme. Rows already approved or paid are left as they are."
        size="md"
        resizable={true}
        allowMaximize={true}
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => setIsCalcModalOpen(false)}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={calculating}
              onClick={handleCalculate}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-2"
            >
              {calculating && <RefreshCw className="w-4 h-4 animate-spin" />}
              Calculate Accruals
            </button>
          </div>
        }
      >
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
      </Modal>

      {/* MODAL 2: Salesperson Detailed Performance & History Modal (Requirement §2) */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          clearSelectedSalespersonDetail();
        }}
        title={
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            <span>Salesperson Detailed Performance & Incentive History</span>
          </div>
        }
        subtitle={
          selectedSalespersonDetail?.salesperson ? (
            <span className="flex items-center gap-2 text-xs text-muted">
              <b>{selectedSalespersonDetail.salesperson.name}</b> ({selectedSalespersonDetail.salesperson.employeeCode})
              · {selectedSalespersonDetail.salesperson.designation} · {selectedSalespersonDetail.salesperson.department}
            </span>
          ) : "Salesperson Performance Breakdown"
        }
        size="xl"
        resizable={true}
        allowMaximize={true}
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => {
                setIsDetailModalOpen(false);
                clearSelectedSalespersonDetail();
              }}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft text-text"
            >
              Close
            </button>
          </div>
        }
      >
        {detailLoading ? (
          <div className="py-16 text-center text-muted flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs">Loading performance records and attribution history...</span>
          </div>
        ) : selectedSalespersonDetail ? (
          <div className="flex flex-col gap-5">
            {/* Quick Metrics Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-soft p-3 rounded-xl border border-border">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Assigned Leads</div>
                <div className="text-lg font-bold text-text mt-0.5">
                  {selectedSalespersonDetail.leads?.length || 0}
                </div>
                <div className="text-[11px] text-muted">
                  {selectedSalespersonDetail.leads?.filter(l => l.status === "Active").length || 0} active · {selectedSalespersonDetail.leads?.filter(l => l.status === "Converted").length || 0} won
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Eligible Invoices</div>
                <div className="text-lg font-bold text-text mt-0.5">
                  ₹{Number(selectedSalespersonDetail.period?.grossSales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-muted">
                  {selectedSalespersonDetail.invoices?.length || 0} sales invoices
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Deducted Returns</div>
                <div className="text-lg font-bold text-red-600 mt-0.5">
                  -₹{Number(selectedSalespersonDetail.period?.returns || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-muted">
                  {selectedSalespersonDetail.returns?.length || 0} returns & credit notes
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Net Incentive Base</div>
                <div className="text-lg font-bold text-emerald-600 mt-0.5">
                  ₹{Number(selectedSalespersonDetail.period?.netSales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-muted">
                  {selectedSalespersonDetail.period?.periodLabel || "Period"}
                </div>
              </div>
            </div>

            {/* Sub-Tabs */}
            <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
              {[
                { id: "leads", label: `CRM Leads (${selectedSalespersonDetail.leads?.length || 0})`, icon: Users },
                { id: "invoices", label: `Sales Invoices (${selectedSalespersonDetail.invoices?.length || 0})`, icon: FileText },
                { id: "returns", label: `Sales Returns (${selectedSalespersonDetail.returns?.length || 0})`, icon: ShieldAlert },
                { id: "accruals", label: `Quarterly Accruals (${selectedSalespersonDetail.accruals?.length || 0})`, icon: Award },
                { id: "history", label: `Assignment History (${selectedSalespersonDetail.assignmentHistory?.length || 0})`, icon: RotateCcw },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                      detailTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted hover:text-text hover:border-border"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT */}
            {detailTab === "leads" && (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-soft border-b border-border text-[11px] font-semibold text-muted uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Lead #</th>
                      <th className="py-2.5 px-3">Lead Name</th>
                      <th className="py-2.5 px-3">Company</th>
                      <th className="py-2.5 px-3">Stage</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3">Created On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(!selectedSalespersonDetail.leads || selectedSalespersonDetail.leads.length === 0) ? (
                      <tr>
                        <td colSpan="7" className="py-6 text-center text-muted">
                          No leads assigned to this salesperson yet.
                        </td>
                      </tr>
                    ) : (
                      selectedSalespersonDetail.leads.map((l) => (
                        <tr key={l.id} className="hover:bg-soft/40 transition">
                          <td className="py-2 px-3 font-semibold text-primary">{l.leadNumber}</td>
                          <td className="py-2 px-3 font-medium text-text">{l.name}</td>
                          <td className="py-2 px-3 text-muted">{l.company}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {l.stage}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            ₹{Number(l.amount || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              l.status === "Converted"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : l.status === "Lost"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                            }`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-muted">{l.createdOn || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {detailTab === "invoices" && (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-soft border-b border-border text-[11px] font-semibold text-muted uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Party Name</th>
                      <th className="py-2.5 px-3 text-right">Taxable Value</th>
                      <th className="py-2.5 px-3 text-right">Gross Total</th>
                      <th className="py-2.5 px-3 text-right">Amount Paid</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(!selectedSalespersonDetail.invoices || selectedSalespersonDetail.invoices.length === 0) ? (
                      <tr>
                        <td colSpan="7" className="py-6 text-center text-muted">
                          No sales invoices attributed to this salesperson.
                        </td>
                      </tr>
                    ) : (
                      selectedSalespersonDetail.invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-soft/40 transition">
                          <td className="py-2 px-3 font-semibold text-text">{inv.invoiceNumber}</td>
                          <td className="py-2 px-3 text-muted">{inv.docDate || "—"}</td>
                          <td className="py-2 px-3 font-medium text-text">{inv.partyName}</td>
                          <td className="py-2 px-3 text-right text-muted">₹{Number(inv.taxableValue || 0).toLocaleString("en-IN")}</td>
                          <td className="py-2 px-3 text-right font-semibold text-text">₹{Number(inv.total || 0).toLocaleString("en-IN")}</td>
                          <td className="py-2 px-3 text-right text-emerald-600 font-medium">₹{Number(inv.amountPaid || 0).toLocaleString("en-IN")}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {detailTab === "returns" && (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-soft border-b border-border text-[11px] font-semibold text-muted uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Return #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Original Invoice</th>
                      <th className="py-2.5 px-3 text-right">Deducted Amount</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(!selectedSalespersonDetail.returns || selectedSalespersonDetail.returns.length === 0) ? (
                      <tr>
                        <td colSpan="5" className="py-6 text-center text-muted">
                          No sales returns or credit notes deducted.
                        </td>
                      </tr>
                    ) : (
                      selectedSalespersonDetail.returns.map((ret) => (
                        <tr key={ret.id} className="hover:bg-soft/40 transition">
                          <td className="py-2 px-3 font-semibold text-text">{ret.returnNumber}</td>
                          <td className="py-2 px-3 text-muted">{ret.docDate || "—"}</td>
                          <td className="py-2 px-3 text-muted">{ret.invoiceNumber}</td>
                          <td className="py-2 px-3 text-right font-semibold text-red-600">
                            -₹{Number(ret.total || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                              {ret.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {detailTab === "accruals" && (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-soft border-b border-border text-[11px] font-semibold text-muted uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Period</th>
                      <th className="py-2.5 px-3">Scheme</th>
                      <th className="py-2.5 px-3 text-right">Net Sales Base</th>
                      <th className="py-2.5 px-3 text-center">Rate</th>
                      <th className="py-2.5 px-3 text-right">Incentive</th>
                      <th className="py-2.5 px-3 text-right">Paid</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(!selectedSalespersonDetail.accruals || selectedSalespersonDetail.accruals.length === 0) ? (
                      <tr>
                        <td colSpan="7" className="py-6 text-center text-muted">
                          No incentive accruals generated yet. Click "Calculate Quarterly" to evaluate.
                        </td>
                      </tr>
                    ) : (
                      selectedSalespersonDetail.accruals.map((a) => (
                        <tr key={a.id} className="hover:bg-soft/40 transition">
                          <td className="py-2 px-3 font-semibold text-text">{a.period_name || a.periodName}</td>
                          <td className="py-2 px-3 text-muted">{a.schemeName || "Standard"}</td>
                          <td className="py-2 px-3 text-right font-medium">₹{Number(a.netEligibleSales || 0).toLocaleString("en-IN")}</td>
                          <td className="py-2 px-3 text-center font-semibold">{a.applicableRate || 0}%</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-600">₹{Number(a.calculatedIncentive || 0).toLocaleString("en-IN")}</td>
                          <td className="py-2 px-3 text-right text-blue-600 font-medium">₹{Number(a.paidAmount || 0).toLocaleString("en-IN")}</td>
                          <td className="py-2 px-3 text-center">{getStatusBadge(a.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {detailTab === "history" && (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-soft border-b border-border text-[11px] font-semibold text-muted uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Lead #</th>
                      <th className="py-2.5 px-3">Lead Name</th>
                      <th className="py-2.5 px-3">Event</th>
                      <th className="py-2.5 px-3">Previous Assignee</th>
                      <th className="py-2.5 px-3">New Assignee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(!selectedSalespersonDetail.assignmentHistory || selectedSalespersonDetail.assignmentHistory.length === 0) ? (
                      <tr>
                        <td colSpan="6" className="py-6 text-center text-muted">
                          No lead reassignment events recorded yet.
                        </td>
                      </tr>
                    ) : (
                      selectedSalespersonDetail.assignmentHistory.map((h, idx) => (
                        <tr key={idx} className="hover:bg-soft/40 transition">
                          <td className="py-2 px-3 text-muted">{h.assigned_at ? new Date(h.assigned_at).toLocaleDateString() : "—"}</td>
                          <td className="py-2 px-3 font-semibold text-primary">{h.leadNumber}</td>
                          <td className="py-2 px-3 font-medium text-text">{h.leadName}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                              {h.event || "Assignment"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-muted">{h.previous_salesperson_name || "—"}</td>
                          <td className="py-2 px-3 font-semibold text-text">{h.new_salesperson_name}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* MODAL 3: Reversal Modal (Requirement §5 & §6) */}
      <Modal
        isOpen={isReverseModalOpen}
        onClose={() => {
          setIsReverseModalOpen(false);
          setSelectedAccrual(null);
        }}
        title={
          <span className="flex items-center gap-2 text-rose-600">
            <RotateCcw className="w-5 h-5" /> Reverse Incentive Accrual
          </span>
        }
        subtitle={
          <span>
            Reverse incentive accrual for <b>{selectedAccrual?.employeeName}</b> for period <b>{selectedAccrual?.periodName}</b>.
            This will mark the accrual Reversed and reverse any posted journal entries.
          </span>
        }
        size="md"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => {
                setIsReverseModalOpen(false);
                setSelectedAccrual(null);
              }}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReverseConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700"
            >
              Confirm Reversal
            </button>
          </div>
        }
      >
        <div>
          <label className="text-xs font-semibold text-muted uppercase">Reason for Reversal</label>
          <textarea
            rows="3"
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
            placeholder="e.g. Sales return posted after calculation, customer default, or audit adjustment"
            className="w-full mt-1.5 p-2 bg-soft border border-border rounded-lg text-sm text-text"
          />
        </div>
      </Modal>

      {/* MODAL 4: Hold Modal */}
      <Modal
        isOpen={isHoldModalOpen}
        onClose={() => {
          setIsHoldModalOpen(false);
          setSelectedAccrual(null);
        }}
        title={
          <span className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" /> Hold Incentive Payout
          </span>
        }
        subtitle={
          <span>
            Place a managerial hold on <b>{selectedAccrual?.employeeName}</b>'s incentive payout due to overdue customer
            accounts, returns, or pending verification.
          </span>
        }
        size="md"
        resizable={true}
        allowMaximize={true}
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => {
                setIsHoldModalOpen(false);
                setSelectedAccrual(null);
              }}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleHoldConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
            >
              Confirm Hold
            </button>
          </div>
        }
      >
        <div>
          <label className="text-xs font-semibold text-muted uppercase">Reason for Hold</label>
          <textarea
            rows="3"
            value={holdReason}
            onChange={(e) => setHoldReason(e.target.value)}
            placeholder="e.g. Awaiting customer payment on INV-2026-0038"
            className="w-full mt-1.5 p-2 bg-soft border border-border rounded-lg text-sm text-text"
          />
        </div>
      </Modal>

      {/* MODAL 5: Scheme Modal */}
      <Modal
        isOpen={isSchemeModalOpen}
        onClose={() => setIsSchemeModalOpen(false)}
        title={schemeForm.id ? "Edit Incentive Scheme" : "New Incentive Scheme"}
        subtitle="Incentive rates are configured here and apply automatically on quarterly calculation. Payout is made outside payroll."
        size="lg"
        resizable={true}
        allowMaximize={true}
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button
              type="button"
              onClick={() => setIsSchemeModalOpen(false)}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingScheme}
              onClick={handleSaveScheme}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-2"
            >
              {savingScheme && <RefreshCw className="w-4 h-4 animate-spin" />}
              Save Scheme
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {schemeError && (
            <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400">
              {schemeError}
            </div>
          )}

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
                      type="button"
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
                type="button"
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
      </Modal>

      {/* MODAL: Pay Incentive (Option A: Direct Payment / Option B: Pay Through Salary) */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => {
          if (!paying) {
            setIsPayModalOpen(false);
            setPayModalAccrual(null);
          }
        }}
        title="Pay Salesperson Incentive"
        subtitle={
          payModalAccrual
            ? `${payModalAccrual.employeeName || "Salesperson"} (${payModalAccrual.employeeCode || "—"}) · Period: ${payModalAccrual.period_name || payModalAccrual.periodName}`
            : ""
        }
        size="lg"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <button
              type="button"
              disabled={paying}
              onClick={() => {
                setIsPayModalOpen(false);
                setPayModalAccrual(null);
              }}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft text-text"
            >
              Cancel
            </button>
            {(() => {
              const isSalaryAlreadyLinked = Boolean(
                payModalAccrual?.payslipId ||
                payModalAccrual?.detail?.queued_salary_amount ||
                (payModalAccrual?.paymentMethod || "").toLowerCase().includes("salary")
              );
              const isSalaryDisabled = payMethod === "SALARY" && isSalaryAlreadyLinked;

              return (
                <button
                  type="button"
                  disabled={paying || Number(payAmount) <= 0 || isSalaryDisabled}
                  onClick={handleConfirmPayment}
                  title={isSalaryDisabled ? "This incentive is already linked to salary." : undefined}
                  className={`px-5 py-2 text-sm font-medium rounded-lg flex items-center gap-2 shadow-sm transition ${
                    isSalaryDisabled
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 cursor-not-allowed opacity-75"
                      : "text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  {paying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {payMethod === "DIRECT"
                        ? "Post Direct Payment"
                        : isSalaryAlreadyLinked
                        ? "Already Linked to Salary"
                        : "Confirm & Update in Salary"}
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        }
      >
        {payModalAccrual && (() => {
          const approved = Number(payModalAccrual.calculated_incentive || payModalAccrual.calculatedIncentive || 0);
          const paid = Number(payModalAccrual.paidAmount || payModalAccrual.paid_amount || 0);
          const remaining = Math.max(0, approved - paid);
          const currentAmount = Number(payAmount) || 0;
          const afterRemaining = Math.max(0, remaining - currentAmount);

          return (
            <div className="space-y-5 py-1">
              {/* Summary KPI Strip */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-soft rounded-xl border border-border">
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Approved Incentive</span>
                  <span className="text-base font-bold text-text mt-0.5 block">
                    ₹{approved.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Already Paid</span>
                  <span className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5 block">
                    ₹{paid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Outstanding Balance</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    ₹{remaining.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector Cards */}
              <div>
                <label className="text-xs font-semibold text-text uppercase tracking-wider block mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayMethod("DIRECT")}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition ${
                      payMethod === "DIRECT"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card hover:bg-soft"
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${payMethod === "DIRECT" ? "bg-primary text-white" : "bg-muted/10 text-muted"}`}>
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-text flex items-center gap-1.5">
                        Option A – Direct Payment
                        {payMethod === "DIRECT" && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        Pay approved incentive directly from Cash or Bank ledger account. Full or partial payments supported.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod("SALARY")}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition ${
                      payMethod === "SALARY"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card hover:bg-soft"
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${payMethod === "SALARY" ? "bg-primary text-white" : "bg-muted/10 text-muted"}`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-text flex items-center gap-1.5">
                        Option B – Pay Through Salary
                        {payMethod === "SALARY" && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted mt-1 leading-relaxed">
                        Add incentive to the salesperson's next payroll under earning component "Sales Incentive".
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Method Specific Form */}
              {payMethod === "DIRECT" ? (
                <div className="space-y-3.5 p-4 bg-card rounded-xl border border-border">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-text block mb-1">Payment Date</label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-soft border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text block mb-1">Payment Account</label>
                      <select
                        value={payAccountId}
                        onChange={(e) => setPayAccountId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-soft border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {bankAccounts && bankAccounts.length > 0 ? (
                          bankAccounts.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.type || "Bank"})
                            </option>
                          ))
                        ) : (
                          <option value="">Default Cash Account</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text block mb-1">Payment Reference / Transaction No.</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR-98234125, NEFT-402, CHQ-10029"
                      value={payReference}
                      onChange={(e) => setPayReference(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-soft border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-text">Amount to Pay (₹)</label>
                      <button
                        type="button"
                        onClick={() => setPayAmount(remaining.toFixed(2))}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Pay Full Balance (₹{remaining.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={remaining}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-soft border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                    />
                    <div className="flex items-center justify-between mt-1 text-[11px] text-muted">
                      <span>Full or partial payments are supported.</span>
                      <span>
                        Remaining balance after payment:{" "}
                        <b className={afterRemaining === 0 ? "text-emerald-600" : "text-amber-600"}>
                          ₹{afterRemaining.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </b>
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text block mb-1">Notes / Remarks (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Approved incentive direct bank transfer"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-soft border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {(payModalAccrual.nextPayoutDate || payModalAccrual.next_payout_date) && (
                    <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg text-[11px] text-blue-800 dark:text-blue-300 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>
                        Standard scheme terms mature on <b>{payModalAccrual.nextPayoutDate || payModalAccrual.next_payout_date}</b>.
                        Posting direct payment will disburse funds immediately.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3.5 p-4 bg-card rounded-xl border border-border">
                  {Boolean(payModalAccrual?.payslipId || payModalAccrual?.detail?.queued_salary_amount) && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Currently queued in <b>{payModalAccrual?.detail?.queued_payroll_period || "upcoming"}</b> payroll under component <b>"Sales Incentive"</b>.
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 uppercase">
                        {payModalAccrual?.payslipStatus || "Pending Payroll"}
                      </span>
                    </div>
                  )}

                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                    <b>Payroll Integration:</b> This will link the approved incentive of{" "}
                    <b>₹{Number(payAmount || remaining).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> to the
                    employee's payroll record under the earning component <b>"Sales Incentive"</b>. Once payroll is processed and payment is posted, the
                    incentive will automatically be marked as <b>Paid Through Salary</b>.
                  </div>

                  {(() => {
                    const isSalaryAlreadyLinked = Boolean(
                      payModalAccrual?.payslipId ||
                      payModalAccrual?.detail?.queued_salary_amount ||
                      (payModalAccrual?.paymentMethod || "").toLowerCase().includes("salary")
                    );

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-text block mb-1">Target Payroll Month</label>
                            <input
                              type="month"
                              disabled={isSalaryAlreadyLinked}
                              value={payMonth}
                              onChange={(e) => setPayMonth(e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-soft border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-text block mb-1">Incentive Amount for Salary (₹)</label>
                            <input
                              type="number"
                              disabled={isSalaryAlreadyLinked}
                              step="0.01"
                              min="0.01"
                              max={remaining}
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-soft border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {isSalaryAlreadyLinked && (
                          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>This incentive has already been linked to salary. Duplicate linking is disabled to prevent multiple payroll entries.</span>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  <div className="text-[11px] text-muted">
                    * The incentive status will remain <b>Approved</b> in Incentive Management until the payroll payment is executed, preventing duplicate
                    disbursements.
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {payError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* MODAL: Payment History View */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setHistoryTargetAccrual(null);
        }}
        title="Incentive Payment History"
        subtitle={
          historyTargetAccrual
            ? `Viewing payment logs for ${historyTargetAccrual.employeeName || "Salesperson"} (${historyTargetAccrual.employeeCode || "—"})`
            : "Complete audit log of all direct and salary-based salesperson incentive payouts."
        }
        size="2xl"
        resizable={true}
        allowMaximize={true}
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted">
              Showing {filteredHistory.length} payment record{filteredHistory.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsHistoryModalOpen(false);
                setHistoryTargetAccrual(null);
              }}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft text-text"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="text"
                placeholder="Search salesperson, ref, period..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-soft border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              {historyTargetAccrual && (
                <div className="flex items-center gap-1 bg-soft p-1 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setHistoryScope("THIS_INCENTIVE")}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                      historyScope === "THIS_INCENTIVE"
                        ? "bg-primary text-white shadow-2xs"
                        : "text-muted hover:text-text"
                    }`}
                  >
                    This Incentive Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryScope("SALESPERSON")}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                      historyScope === "SALESPERSON"
                        ? "bg-primary text-white shadow-2xs"
                        : "text-muted hover:text-text"
                    }`}
                  >
                    All for {historyTargetAccrual.employeeName?.split(" ")[0] || "Staff"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryTargetAccrual(null);
                      setHistoryScope("ALL");
                    }}
                    className="px-2.5 py-1 text-xs font-medium rounded-md transition text-muted hover:text-text"
                  >
                    All Staff
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-muted">Method:</span>
                {["ALL", "DIRECT", "SALARY"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setHistoryMethodFilter(m)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition ${
                      historyMethodFilter === m ? "bg-primary text-white" : "bg-soft text-muted hover:text-text border border-border"
                    }`}
                  >
                    {m === "ALL" ? "All" : m === "DIRECT" ? "Direct" : "Salary"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl shadow-2xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-soft border-b border-border font-semibold text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Salesperson</th>
                  <th className="py-2.5 px-3">Incentive Period</th>
                  <th className="py-2.5 px-3 text-right">Approved</th>
                  <th className="py-2.5 px-3 text-center">Method</th>
                  <th className="py-2.5 px-3 text-center">Payment Date</th>
                  <th className="py-2.5 px-3 text-right">Amount Paid</th>
                  <th className="py-2.5 px-3 text-right">Remaining</th>
                  <th className="py-2.5 px-3">Payment Reference</th>
                  <th className="py-2.5 px-3">Payroll Reference</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paymentHistoryLoading ? (
                  <tr>
                    <td colSpan="10" className="py-8 text-center text-muted">
                      Loading payment records...
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="py-8 text-center text-muted">
                      No payment history records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-soft/50 transition">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-text">{row.salesperson || "—"}</div>
                        <div className="text-[11px] text-muted">{row.salespersonCode || ""}</div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-text">{row.incentivePeriod || "—"}</td>
                      <td className="py-2.5 px-3 text-right text-text">
                        ₹{Number(row.approvedIncentive || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            (row.paymentMethod || "").toLowerCase().includes("direct")
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {(row.paymentMethod || "").toLowerCase().includes("direct") ? (
                            <CreditCard className="w-3 h-3" />
                          ) : (
                            <Building2 className="w-3 h-3" />
                          )}
                          {row.paymentMethod || "—"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-muted">{row.paymentDate || "—"}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{Number(row.amountPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted">
                        ₹{Number(row.remainingBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-text">
                        {row.paymentReference || "—"}
                        {row.accountName && row.accountName !== "-" && (
                          <span className="block text-[10px] text-muted font-sans">{row.accountName}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted">{row.payrollReference || "—"}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            row.paymentStatus === "Paid"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                          }`}
                        >
                          {row.paymentStatus || "Paid"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

    </div>
  );
}
