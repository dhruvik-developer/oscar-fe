import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Users,
  User,
  Receipt,
  Download,
  Eye,
  CheckCircle2,
  Plus,
  Search,
  X,
  ChevronRight,
  Check,
  CreditCard,
  Calendar,
  ArrowRight,
  Edit3,
  Printer,
  FileText,
  ChevronDown,
  ShieldCheck,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import {
  usePayrollStore,
  WORKFLOW_STAGES,
  periodLabel,
  periodStage,
} from "../../../stores/payrollStore";
import { aggregatePayrollStats, formatINR } from "./salaryCalculations";
import { describeError, localISODate } from "../../../services/hrmsSync";
import { Badge } from "../../../components/hrms/Badge";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { Avatar } from "../../../components/hrms/Avatar";

/** Payslip statuses the server uses, in order. */
const PAYSLIP_STAGES = WORKFLOW_STAGES.filter((s) => s.id !== "Ready for Review");

/** Day counts can be fractional (half days) — print `20` or `19.5`. */
function fmtDays(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** `YYYY-MM-DD` → `31 Oct 2026`; anything else is shown as given. */
function fmtDate(value) {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!m) return String(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Month label for a payslip row (`period` is `YYYY-MM`). */
function slipMonth(p) {
  return periodLabel(p?.period || String(p?.month || "").slice(0, 7));
}

/**
 * Display aliases over a server payslip. Nothing here recomputes pay: the
 * earned and net figures are the server's.
 */
function withAliases(p) {
  const std = Number(p.standardSalary) || 0;
  const earned = Number(p.earnedSalary) || 0;
  return {
    ...p,
    remainingPayable: Number(p.netPayable) || 0,
    payableDays: (Number(p.attendedDays) || 0) + (Number(p.paidLeaves) || 0),
    earnedProgress: std > 0 ? Math.max(0, Math.min(100, Math.round((earned / std) * 100))) : 100,
  };
}

/** Attendance behind a payslip, as one line of text. */
function attendanceLine(p) {
  const a = p.attendance || {};
  const parts = [
    `${fmtDays(p.attendedDays)} attended`,
    `${fmtDays(p.paidLeaves)} paid leave`,
    `${fmtDays(p.unpaidLeaves)} LOP`,
    `${fmtDays(p.absentDays)} deducted`,
  ];
  const detail = [
    a.present ? `${fmtDays(a.present)} present` : "",
    a.late ? `${fmtDays(a.late)} late` : "",
    a.wfh ? `${fmtDays(a.wfh)} WFH` : "",
    a.halfDay ? `${fmtDays(a.halfDay)} half day` : "",
    a.absent ? `${fmtDays(a.absent)} absent` : "",
  ].filter(Boolean);
  return `${parts.join(" | ")} of ${fmtDays(p.totalDays)} working days${detail.length ? ` (${detail.join(", ")})` : ""}`;
}

// Clean browser PDF payslip generator with full formula breakdown
function downloadPayslipPdf(p) {
  const clean = (s) =>
    String(s || "")
      .replace(/[()\\]/g, "")
      .replace(/[₹•–—]/g, "-")
      .replace(/[^\x20-\x7E]/g, " ");

  const name = clean(p.name || "EMPLOYEE").toUpperCase();
  const id = clean(String(p.id || "").slice(0, 8).toUpperCase() || "-");
  const empId = clean(p.empId || "-");
  const role = clean(p.role || "-");
  const dept = clean(p.department || "-");
  const month = clean(slipMonth(p));
  const bank = clean(p.bank || "-");

  const std = Number(p.standardSalary || 0);
  const totalD = Number(p.totalDays || 0);
  const attended = Number(p.attendedDays || 0);
  const paidLeave = Number(p.paidLeaves || 0);
  const lop = Number(p.unpaidLeaves || 0);
  const absent = Number(p.absentDays || 0);
  const perDay = Number(p.perDaySalary || 0);
  const attDeduction = Number(p.attendanceDeduction || 0);
  const earned = Number(p.earnedSalary || 0);
  const earnings = Number(p.additionalEarnings || 0);
  const deductions = Number(p.deductions || 0);
  const advance = Number(p.advance || 0);
  const remaining = Number(p.netPayable ?? p.remainingPayable ?? 0);
  const basic = Number(p.basic || 0);
  const hra = Number(p.hra || 0);
  const allowances = Number(p.allowances || 0);
  const status = clean(p.status || "In Progress");
  const paidDate = clean(fmtDate(p.paymentDate) || "N/A");
  const paidAmt = p.paidAmount !== null && p.paidAmount !== undefined ? Number(p.paidAmount) : remaining;
  const inr = (n) => Math.round(n).toLocaleString("en-IN");

  const lines = [
    "BT",
    "/F1 18 Tf",
    "50 780 Td",
    "(EVENMORE ERP - CONFIDENTIAL SALARY SLIP) Tj",
    "/F1 10 Tf",
    "0 -22 Td",
    `(Pay Period: ${month}   |   Slip Ref: ${id}   |   Status: ${status}) Tj`,
    "0 -18 Td",
    `(Employee: ${name}   |   Staff ID: ${empId}) Tj`,
    "0 -16 Td",
    `(Designation: ${role}   |   Department: ${dept}) Tj`,
    "0 -16 Td",
    `(Disbursal Bank: ${bank}) Tj`,
    "0 -26 Td",
    "/F1 12 Tf",
    "(MONTHLY SALARY CALCULATION BREAKDOWN:) Tj",
    "0 -18 Td",
    "/F1 10 Tf",
    `(Standard Monthly Salary: INR ${inr(std)}) Tj`,
    "0 -16 Td",
    `(Working Days: ${fmtDays(totalD)} | Attended: ${fmtDays(attended)} | Paid Leave: ${fmtDays(paidLeave)} | LOP: ${fmtDays(lop)} | Deducted Days: ${fmtDays(absent)}) Tj`,
    "0 -16 Td",
    `(Rate: INR ${inr(perDay)}/day | Attendance Deduction: - INR ${inr(attDeduction)}) Tj`,
    "0 -16 Td",
    `(Earned Salary: INR ${inr(earned)}) Tj`,
    "0 -16 Td",
    `(Basic: INR ${inr(basic)}   |   HRA: INR ${inr(hra)}   |   Allowances: INR ${inr(allowances)}) Tj`,
    "0 -16 Td",
    `(Additional Earnings: + INR ${inr(earnings)}) Tj`,
    "0 -16 Td",
    `(Deductions: - INR ${inr(deductions)}) Tj`,
    "0 -16 Td",
    `(Salary Advance Recovered: - INR ${inr(advance)}) Tj`,
    "0 -24 Td",
    "/F1 11 Tf",
    "(FORMULA: Net = Standard - Per-day x Deducted Days + Earnings - Deductions - Advance) Tj",
    "0 -22 Td",
    "/F1 14 Tf",
    `(NET PAYABLE: INR ${inr(remaining)}) Tj`,
    "0 -24 Td",
    "/F1 10 Tf",
    `(Payout Status: ${status}   |   Disbursed: INR ${status === "Paid" ? inr(paidAmt) : "0"}   |   Date: ${paidDate}) Tj`,
    "0 -32 Td",
    "/F1 9 Tf",
    "(This is a computer-generated salary slip. Attendance and leave figures are taken from HRMS records.) Tj",
    "ET",
  ];

  const stream = lines.join("\n");
  const streamBytes = new TextEncoder().encode(stream).length;

  let out = "%PDF-1.4\n";
  const offsets = [];

  function addObj(content) {
    offsets.push(new TextEncoder().encode(out).length);
    out += content + "\n";
  }

  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  addObj("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj");
  addObj(`4 0 obj\n<< /Length ${streamBytes} >>\nstream\n${stream}\nendstream\nendobj`);
  addObj("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");

  const startXref = new TextEncoder().encode(out).length;
  out += "xref\n0 " + (offsets.length + 1) + "\n0000000000 65535 f \n";
  for (const off of offsets) {
    out += String(off).padStart(10, "0") + " 00000 n \n";
  }
  out += "trailer\n<< /Size " + (offsets.length + 1) + " /Root 1 0 R >>\nstartxref\n" + startXref + "\n%%EOF";

  const blob = new Blob([out], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Payslip_${(p.name || "Employee").replace(/\s+/g, "_")}_${month.replace(/\s+/g, "_")}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Modern printable/save-as-PDF window generator with corporate styling
function printPayslip(p) {
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const inr = (n) => Math.round(Number(n) || 0).toLocaleString("en-IN");
  const std = Number(p.standardSalary || 0);
  const totalD = Number(p.totalDays || 0);
  const attended = Number(p.attendedDays || 0);
  const paidLeave = Number(p.paidLeaves || 0);
  const lop = Number(p.unpaidLeaves || 0);
  const absent = Number(p.absentDays || 0);
  const perDay = Number(p.perDaySalary || 0);
  const attDeduction = Number(p.attendanceDeduction || 0);
  const earned = Number(p.earnedSalary || 0);
  const earnings = Number(p.additionalEarnings || 0);
  const deductions = Number(p.deductions || 0);
  const advance = Number(p.advance || 0);
  const remaining = Number(p.netPayable ?? p.remainingPayable ?? 0);
  const basic = Number(p.basic || 0);
  const hra = Number(p.hra || 0);
  const allowances = Number(p.allowances || 0);
  const month = slipMonth(p);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Payslip - ${esc(p.name)} - ${esc(month)}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .logo { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
          .subtitle { font-size: 12px; color: #64748b; }
          .badge { background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; display: inline-block; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
          .label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
          .val { font-size: 13.5px; font-weight: 700; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 12px; font-weight: 700; color: #334155; border: 1px solid #cbd5e1; }
          td { padding: 8px 12px; font-size: 12.5px; border: 1px solid #e2e8f0; }
          .num { text-align: right; font-weight: 600; }
          .formula-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
          .net-payable { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 14px 18px; border-radius: 8px; font-size: 16px; font-weight: 800; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">EVENMORE TECHNOLOGIES</div>
            <div class="subtitle">CONFIDENTIAL SALARY STATEMENT • CORPORATE HRMS</div>
          </div>
          <div style="text-align: right;">
            <span class="badge">${esc(p.status || "In Progress")}</span>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Pay Period: ${esc(month)}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="box">
            <div class="label">Employee Details</div>
            <div class="val">${esc(p.name)}</div>
            <div style="color: #475569; font-size: 12px; margin-top: 2px;">${esc(p.role || "-")} • ${esc(p.department || "-")}</div>
            <div style="color: #64748b; font-size: 11.5px; margin-top: 4px;">Staff ID: ${esc(p.empId || "-")}</div>
          </div>
          <div class="box">
            <div class="label">Disbursal &amp; Attendance</div>
            <div class="val">${esc(p.bank || "-")}</div>
            <div style="color: #475569; font-size: 12px; margin-top: 2px;">${fmtDays(attended)} attended + ${fmtDays(paidLeave)} paid leave of ${fmtDays(totalD)} working days • ${fmtDays(lop)} LOP • ${fmtDays(absent)} days deducted</div>
            <div style="color: #64748b; font-size: 11.5px; margin-top: 4px;">${p.paymentDate ? `Paid on ${esc(fmtDate(p.paymentDate))} • ` : ""}Rate: INR ${inr(perDay)}/day</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>EARNINGS</th>
              <th class="num">AMOUNT (INR)</th>
              <th>DEDUCTIONS &amp; RECOVERIES</th>
              <th class="num">AMOUNT (INR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic Salary</td>
              <td class="num">${inr(basic)}</td>
              <td>Attendance deduction (${fmtDays(absent)} days @ INR ${inr(perDay)}/d)</td>
              <td class="num" style="color: #b91c1c;">-${inr(attDeduction)}</td>
            </tr>
            <tr>
              <td>House Rent Allowance (HRA)</td>
              <td class="num">${inr(hra)}</td>
              <td>Salary Advance Recovered</td>
              <td class="num" style="color: #b45309;">-${inr(advance)}</td>
            </tr>
            <tr>
              <td>Allowances</td>
              <td class="num">${inr(allowances)}</td>
              <td>Other Deductions</td>
              <td class="num">-${inr(deductions)}</td>
            </tr>
            <tr>
              <td>Additional Earnings</td>
              <td class="num">+${inr(earnings)}</td>
              <td></td>
              <td class="num"></td>
            </tr>
            <tr style="font-weight: 700; background: #f8fafc;">
              <td>Earned Salary</td>
              <td class="num" style="color: #1e40af;">INR ${inr(earned)}</td>
              <td>Total Deductions &amp; Advances</td>
              <td class="num" style="color: #b91c1c;">-INR ${inr(deductions + advance + attDeduction)}</td>
            </tr>
            <tr style="font-weight: 700; background: #f8fafc;">
              <td>Standard Monthly Salary</td>
              <td class="num">INR ${inr(std)}</td>
              <td>Net Payable</td>
              <td class="num" style="color: #15803d;">INR ${inr(remaining)}</td>
            </tr>
          </tbody>
        </table>

        <div class="formula-box">
          <div style="font-weight: 700; font-size: 11.5px; color: #15803d; margin-bottom: 2px;">FORMULA AUDIT TRAIL:</div>
          <div style="font-size: 12px; color: #334155;">
            Net Payable = Standard (INR ${inr(std)}) - Attendance deduction (INR ${inr(attDeduction)} for ${fmtDays(absent)} days not attended or on paid leave) + Additional Earnings (INR ${inr(earnings)}) - Deductions (INR ${inr(deductions)}) - Advance (INR ${inr(advance)})
          </div>
        </div>

        <div class="net-payable">
          <span>NET PAYABLE</span>
          <span>INR ${inr(remaining)}</span>
        </div>

        <div class="footer">
          <div>Computer-generated salary slip from Evenmore ERP HRMS.</div>
          <div>Authorized Signatory: Head of Payroll &amp; Finance</div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=850,height=900");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }
}

export default function Payroll() {
  const showToast = useAppStore((s) => s.showToast);
  const currentUser = useAppStore((s) => s.currentUser);

  const {
    employees: payrollEmployees,
    structures,
    period,
    loading,
    error: loadError,
    generating,
    bulk,
    setPeriod,
    generate,
    reloadPeriod,
    adjust,
    approve,
    markPaid,
    approveAll,
    markAllPaid,
    addStructure,
    ownHistory: ownHistoryRaw = [],
    loadOwnHistory,
  } = usePayrollStore();

  // Primary 4 views: 'overall' | 'department' | 'employee' | 'own'
  const [activeTab, setActiveTab] = useState("overall");

  // Coming back to the screen: re-read the month (the first visit is loaded by the store itself).
  useEffect(() => {
    if (usePayrollStore.getState().loaded) usePayrollStore.getState().reloadPeriod();
  }, []);

  // The "My Salary" tab shows this user's own payslips, read by employee id.
  const ownEmployeeId = currentUser?.employeeId || null;
  useEffect(() => {
    if (ownEmployeeId && activeTab === "own") loadOwnHistory?.(ownEmployeeId);
  }, [ownEmployeeId, activeTab, loadOwnHistory]);

  // Filters for Employee-wise tab
  const [empSearch, setEmpSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Modals state
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAddStructureModal, setShowAddStructureModal] = useState(false);
  const [newStructure, setNewStructure] = useState({ name: "", department: "", employees: "" });

  // Bulk approve / pay confirmation: { kind: 'approve' | 'pay', ids, scope }
  const [confirmBulk, setConfirmBulk] = useState(null);
  const [bulkPayDate, setBulkPayDate] = useState(localISODate());
  const [showGenerateSlipModal, setShowGenerateSlipModal] = useState(false);
  const [slipSelectedEmpId, setSlipSelectedEmpId] = useState("");
  const [slipPickerOpen, setSlipPickerOpen] = useState(false);
  const [slipSearchQuery, setSlipSearchQuery] = useState("");

  // Adjustment modal (earnings / deductions / advance only)
  const [editingId, setEditingId] = useState(null);
  const [editAdvance, setEditAdvance] = useState(0);
  const [editEarnings, setEditEarnings] = useState(0);
  const [editDeductions, setEditDeductions] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyRowId, setBusyRowId] = useState(null);

  // Server payslips for the month, with display aliases only.
  const computedEmployeePayrolls = useMemo(() => payrollEmployees.map(withAliases), [payrollEmployees]);
  const editingEmployee = useMemo(
    () => (editingId ? computedEmployeePayrolls.find((p) => p.id === editingId) || null : null),
    [computedEmployeePayrolls, editingId]
  );

  const workflowStep = periodStage(computedEmployeePayrolls);
  const inProgressIds = useMemo(
    () => computedEmployeePayrolls.filter((p) => p.status === "In Progress" || p.status === "Ready for Review" || !p.status).map((p) => p.id),
    [computedEmployeePayrolls]
  );
  const approvedIds = useMemo(
    () => computedEmployeePayrolls.filter((p) => p.status === "Approved").map((p) => p.id),
    [computedEmployeePayrolls]
  );
  const stageCounts = {
    "In Progress": inProgressIds.length,
    Approved: approvedIds.length,
    Paid: computedEmployeePayrolls.filter((p) => p.status === "Paid").length,
  };
  const hasRows = computedEmployeePayrolls.length > 0;
  const showLoading = loading && !hasRows;
  const monthLabel = periodLabel(period);
  const isBusy = Boolean(bulk) || generating;

  // Selected employee for generate payslip modal
  const slipSelectedEmp = useMemo(() => {
    if (!slipSelectedEmpId) return computedEmployeePayrolls[0];
    return (
      computedEmployeePayrolls.find((e) => e.id === slipSelectedEmpId) ||
      computedEmployeePayrolls[0]
    );
  }, [computedEmployeePayrolls, slipSelectedEmpId]);

  // Filtered employees for slip modal picker search
  const filteredPickerEmployees = useMemo(() => {
    if (!slipSearchQuery.trim()) return computedEmployeePayrolls;
    const q = slipSearchQuery.toLowerCase().trim();
    return computedEmployeePayrolls.filter(
      (e) =>
        String(e.name ?? "").toLowerCase().includes(q) ||
        String(e.role ?? "").toLowerCase().includes(q) ||
        String(e.department ?? "").toLowerCase().includes(q) ||
        String(e.empId ?? "").toLowerCase().includes(q)
    );
  }, [computedEmployeePayrolls, slipSearchQuery]);

  // Overall Statistics Aggregation (sums of the server's figures)
  const overallStats = useMemo(() => {
    return aggregatePayrollStats(computedEmployeePayrolls);
  }, [computedEmployeePayrolls]);

  const departmentNames = useMemo(
    () => Array.from(new Set(computedEmployeePayrolls.map((p) => p.department || "General"))).sort(),
    [computedEmployeePayrolls]
  );

  // Department-wise Grouping
  const departmentPayrolls = useMemo(() => {
    const groups = {};
    computedEmployeePayrolls.forEach((p) => {
      const d = p.department || "General";
      if (!groups[d]) {
        groups[d] = {
          name: d,
          employees: [],
          totalStandard: 0,
          totalEarned: 0,
          totalEarnings: 0,
          totalDeductions: 0,
          totalAdvance: 0,
          totalRemaining: 0,
          totalAttendanceDeduction: 0,
          paidCount: 0,
          inProgressIds: [],
          approvedIds: [],
        };
      }
      const g = groups[d];
      g.employees.push(p);
      g.totalStandard += Number(p.standardSalary) || 0;
      g.totalEarned += Number(p.earnedSalary) || 0;
      g.totalEarnings += Number(p.additionalEarnings) || 0;
      g.totalDeductions += Number(p.deductions) || 0;
      g.totalAdvance += Number(p.advance) || 0;
      g.totalRemaining += Number(p.remainingPayable) || 0;
      g.totalAttendanceDeduction += Number(p.attendanceDeduction) || 0;
      if (p.status === "Paid") g.paidCount += 1;
      else if (p.status === "Approved") g.approvedIds.push(p.id);
      else g.inProgressIds.push(p.id);
    });

    return Object.values(groups).map((g) => ({
      ...g,
      headcount: g.employees.length,
      workingDays: g.employees[0]?.totalDays,
      earnedProgress: g.totalStandard > 0 ? Math.round((g.totalEarned / g.totalStandard) * 100) : 100,
      avgSalary: Math.round(g.totalRemaining / (g.employees.length || 1)),
      allPaid: g.paidCount === g.employees.length,
    }));
  }, [computedEmployeePayrolls]);

  // Filtered Employee-wise list
  const filteredEmployees = useMemo(() => {
    return computedEmployeePayrolls.filter((p) => {
      const q = empSearch.toLowerCase();
      const matchSearch =
        String(p.name ?? "").toLowerCase().includes(q) ||
        String(p.role ?? "").toLowerCase().includes(q) ||
        String(p.empId ?? "").toLowerCase().includes(q);
      const matchDept = deptFilter === "All" || (p.department || "General") === deptFilter;
      const matchStatus = statusFilter === "All" || p.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [computedEmployeePayrolls, empSearch, deptFilter, statusFilter]);

  // Own salary: the signed-in employee's payslips, newest first.
  const ownHistory = useMemo(
    () =>
      ownHistoryRaw
        .map(withAliases)
        .sort((a, b) => String(b.period || b.month || "").localeCompare(String(a.period || a.month || ""))),
    [ownHistoryRaw]
  );
  const ownRecord = useMemo(
    () => ownHistory.find((h) => h.period === period) || ownHistory[0] || null,
    [ownHistory, period]
  );

  // What each bulk action does on the server.
  const STAGE_SCENARIOS = {
    approve: {
      title: "Approve payslips",
      description:
        "Each In Progress payslip is approved as it stands. Approval freezes its attendance figures and adjustments and posts the salary accrual to Accounts.",
      actionLabel: "Approve",
      bullets: [
        "Pay already reflects attendance and approved leave for the month",
        "Approved payslips are no longer refreshed by Re-generate",
        "Adjustments can no longer be edited after approval",
        "Salary accrual is posted to the accounting ledger",
      ],
    },
    pay: {
      title: "Mark payslips paid",
      description:
        "Each Approved payslip is marked Paid with the payment date below, settling its net payable.",
      actionLabel: "Mark Paid",
      bullets: [
        "Records the payment date and paid amount on each payslip",
        "Paid payslips are final for the month",
        "Payslip PDFs remain available for download",
      ],
    },
  };

  // ── Handlers ──

  const handleGenerate = async () => {
    try {
      const result = await generate();
      if (result === null) {
        showToast("Payroll could not be generated — the server is not reachable", "error");
        return;
      }
      const count = Array.isArray(result?.payslips)
        ? result.payslips.length
        : usePayrollStore.getState().employees.length;
      showToast(`Payroll for ${monthLabel} generated from attendance & leave — ${count} payslip(s).`);
      setShowGenerateModal(false);
    } catch (err) {
      showToast(`Payroll not generated — ${describeError(err)}`, "error");
    }
  };

  const handleApproveRow = async (p) => {
    if (busyRowId || isBusy) return;
    setBusyRowId(p.id);
    try {
      await approve(p.id);
      showToast(`Payslip approved for ${p.name}`);
    } catch (err) {
      showToast(`Payslip not approved — ${describeError(err)}`, "error");
    } finally {
      setBusyRowId(null);
    }
  };

  const handlePayRow = async (p) => {
    if (busyRowId || isBusy) return;
    setBusyRowId(p.id);
    try {
      await markPaid(p.id, localISODate());
      showToast(`Marked ${p.name} as Paid (${formatINR(p.remainingPayable)})`);
    } catch (err) {
      showToast(`Not marked paid — ${describeError(err)}`, "error");
    } finally {
      setBusyRowId(null);
    }
  };

  const openBulk = (kind, ids, scope = "all") => {
    if (!ids.length) return;
    setBulkPayDate(localISODate());
    setConfirmBulk({ kind, ids, scope });
  };

  const executeBulk = async () => {
    if (!confirmBulk) return;
    const { kind, ids } = confirmBulk;
    if (kind === "pay" && !bulkPayDate) return showToast("Choose a payment date", "error");
    setConfirmBulk(null);
    const result = kind === "approve" ? await approveAll(ids) : await markAllPaid(ids, bulkPayDate);
    const verb = kind === "approve" ? "approved" : "marked paid";
    if (result.failed.length) {
      const first = result.failed[0];
      showToast(
        `${result.done} payslip(s) ${verb}; ${result.failed.length} failed — ${first.name}: ${first.error}`,
        "error"
      );
    } else {
      showToast(`${result.done} payslip(s) ${verb} for ${monthLabel}.`);
    }
    reloadPeriod();
  };

  const handleBatchDownloadSlips = () => {
    computedEmployeePayrolls.forEach((emp, i) => {
      setTimeout(() => {
        downloadPayslipPdf(emp);
      }, i * 150);
    });
    showToast(`Downloading PDF payslips for all ${computedEmployeePayrolls.length} employees...`);
  };

  const handleAddStructureSubmit = (e) => {
    e.preventDefault();
    if (!newStructure.name) return;
    addStructure({
      name: newStructure.name,
      department: newStructure.department || undefined,
      employees: Number(newStructure.employees) || undefined,
    });
    setNewStructure({ name: "", department: "", employees: "" });
    setShowAddStructureModal(false);
    showToast("New salary structure added");
  };

  const openEditModal = (emp) => {
    setEditingId(emp.id);
    setEditAdvance(Number(emp.advance) || 0);
    setEditEarnings(Number(emp.additionalEarnings) || 0);
    setEditDeductions(Number(emp.deductions) || 0);
  };

  const handleSaveParams = async (e) => {
    e.preventDefault();
    if (!editingEmployee || savingEdit) return;
    setSavingEdit(true);
    try {
      await adjust(editingEmployee.id, {
        additionalEarnings: Math.max(0, Number(editEarnings) || 0),
        deductions: Math.max(0, Number(editDeductions) || 0),
        advance: Math.max(0, Number(editAdvance) || 0),
      });
      showToast(`Adjustments saved for ${editingEmployee.name} — payslip recomputed`);
      setEditingId(null);
    } catch (err) {
      showToast(`Adjustments not saved — ${describeError(err)}`, "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const statusTone = (status) =>
    status === "Paid" ? "success" : status === "Approved" ? "info" : status === "Ready for Review" ? "warning" : "neutral";

  const emptyState = (
    <div className="bg-white border border-dashed border-bdr rounded-2xl p-8 shadow-xs flex flex-col items-center text-center gap-3">
      {showLoading ? (
        <>
          <Loader2 size={28} className="text-navy animate-spin" />
          <div className="text-[13.5px] text-slate-600">Loading payroll for {monthLabel}…</div>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-2xl bg-navy/5 text-navy flex items-center justify-center">
            <Receipt size={22} />
          </div>
          <div>
            <h3 className="font-bold text-[15px] text-slate-900">No payslips for {monthLabel}</h3>
            <p className="text-[12.5px] text-muted mt-1 max-w-md">
              {loadError
                ? "Payroll could not be loaded. Check your connection and try again."
                : "Generate the month's payroll: each employee's payslip is computed from their attendance (Present, Late, WFH, Half Day) and approved leave for the month. Unmarked working days, absences and Loss of Pay are deducted."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {loadError && (
              <button
                type="button"
                onClick={() => reloadPeriod()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-bdr rounded-xl text-[13px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <RefreshCw size={14} /> Retry
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white rounded-xl text-[13px] font-semibold shadow-xs hover:bg-navy/90 cursor-pointer"
            >
              <RefreshCw size={14} /> Generate from Attendance
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payroll Management"
        subtitle={<>Attendance-driven payroll: <span className="font-semibold text-slate-700">Net Payable = Standard − Per-day × (Working days − Attended − Paid leave) + Earnings − Deductions − Advance</span></>}
        guide={hrmsGuides.payroll}
        actions={
          <>
            <label className="flex items-center gap-2 px-3 h-10 bg-white border border-bdr rounded-xl text-[13px] font-medium text-slate-700 shadow-xs">
              <Calendar size={14} className="text-navy shrink-0" />
              <span className="text-muted text-[12px] whitespace-nowrap">Month:</span>
              <input
                type="month"
                value={period}
                onChange={(e) => e.target.value && setPeriod(e.target.value)}
                className="font-semibold text-slate-900 bg-transparent outline-none cursor-pointer text-[13px]"
              />
            </label>

            <Link
              to="/hrms/hr-admin/working-days"
              className="inline-flex items-center gap-1.5 px-3 h-10 bg-white border border-bdr rounded-xl text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
              title="Working-day calendar used to count each month's working days"
            >
              <ShieldCheck size={15} className="text-emerald-700" />
              <span>Working Days Setup</span>
            </Link>

            <button
              type="button"
              disabled={!hasRows}
              onClick={() => setShowGenerateSlipModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-300 text-slate-800 rounded-xl text-[13px] font-semibold shadow-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Generate and download employee PDF salary slip"
            >
              <FileText size={15} className="text-emerald-700" />
              <span>Generate Payslip (PDF)</span>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-navy text-white rounded-xl text-[13px] font-medium shadow-xs hover:bg-navy/90 transition-colors cursor-pointer disabled:opacity-60"
            >
              {generating ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />}
              <span>{hasRows ? "Re-generate from Attendance" : "Generate from Attendance"}</span>
            </button>
          </>
        }
      />

      {/* ── Minimal 4-Tab Navigation Bar ── */}
      <div className="flex border-b border-bdr gap-1 bg-white px-3 pt-2.5 rounded-2xl border shadow-xs overflow-x-auto lg:overflow-visible scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("overall")}
          className={`pb-3 px-3 text-[13.5px] font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 lg:shrink whitespace-nowrap ${
            activeTab === "overall"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 size={16} />
          <span>Overall Salary</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("department")}
          className={`pb-3 px-3 text-[13.5px] font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 lg:shrink whitespace-nowrap ${
            activeTab === "department"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users size={16} />
          <span>Department-wise</span>
          <span className="px-1.5 py-0.2 text-[10.5px] rounded-md bg-slate-100 text-slate-600 font-medium">
            {departmentPayrolls.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("employee")}
          className={`pb-3 px-3 text-[13.5px] font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 lg:shrink whitespace-nowrap ${
            activeTab === "employee"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <User size={16} />
          <span>Employee-wise</span>
          <span className="px-1.5 py-0.2 text-[10.5px] rounded-md bg-slate-100 text-slate-600 font-medium">
            {computedEmployeePayrolls.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("own")}
          className={`pb-3 px-3 text-[13.5px] font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 lg:shrink whitespace-nowrap ${
            activeTab === "own"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CreditCard size={16} />
          <span>My Salary</span>
        </button>
      </div>

      {bulk && (
        <div className="bg-white border border-bdr rounded-2xl px-4 py-3 shadow-xs flex items-center gap-3 text-[12.5px] text-slate-700">
          <Loader2 size={15} className="animate-spin text-navy shrink-0" />
          <span className="font-semibold">{bulk.label} payslips…</span>
          <span className="text-muted">{bulk.done} / {bulk.total}</span>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-navy rounded-full transition-all duration-300"
              style={{ width: `${bulk.total ? Math.round((bulk.done / bulk.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 1: OVERALL SALARY (COMPANY SUMMARY & LIFECYCLE)
         ========================================================================= */}
      {activeTab === "overall" && !hasRows && emptyState}
      {activeTab === "overall" && hasRows && (
        <div className="flex flex-col gap-6">
          {/* Top KPI Cards - Advanced Salary Matrix */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col justify-between">
              <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">
                Total Standard Budget
              </span>
              <div className="text-[26px] font-extrabold text-slate-900 mt-2 leading-none">
                {formatINR(overallStats.totalStandard)}
              </div>
              <span className="text-[12px] text-muted mt-2">Agreed monthly salary · {overallStats.totalHeadcount} staff</span>
            </div>

            <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col justify-between">
              <span className="text-[12px] font-semibold text-blue-700 uppercase tracking-wide">
                Total Earned Salary
              </span>
              <div className="text-[26px] font-extrabold text-blue-950 mt-2 leading-none">
                {formatINR(overallStats.totalEarned)}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round((overallStats.totalEarned / (overallStats.totalStandard || 1)) * 100))}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-blue-700 font-semibold">
                  {Math.round((overallStats.totalEarned / (overallStats.totalStandard || 1)) * 100)}%
                </span>
              </div>
              {overallStats.totalAttendanceDeduction > 0 && (
                <span className="text-[11px] text-rose-600 block mt-1 font-medium">
                  -{formatINR(overallStats.totalAttendanceDeduction)} attendance deduction
                </span>
              )}
            </div>

            <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col justify-between">
              <span className="text-[12px] font-semibold text-rose-700 uppercase tracking-wide">
                Advances &amp; Deductions
              </span>
              <div className="text-[26px] font-extrabold text-rose-950 mt-2 leading-none">
                {formatINR(overallStats.totalAdvance + overallStats.totalDeductions)}
              </div>
              <span className="text-[12px] text-muted mt-2">
                Advance: {formatINR(overallStats.totalAdvance)} • Deductions: {formatINR(overallStats.totalDeductions)}
              </span>
            </div>

            <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col justify-between">
              <span className="text-[12px] font-semibold text-emerald-700 uppercase tracking-wide">
                Net Payable
              </span>
              <div className="text-[26px] font-extrabold text-emerald-950 mt-2 leading-none">
                {formatINR(overallStats.totalRemaining)}
              </div>
              <span className="text-[12px] text-emerald-700 mt-2 font-medium">
                {overallStats.paidCount} Paid • {overallStats.totalHeadcount - overallStats.paidCount} Pending
              </span>
            </div>
          </div>

          {/* Month-End Lifecycle Flow Strip */}
          <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14.5px] font-bold text-slate-900">
                  {monthLabel} Payroll Lifecycle
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Current: {workflowStep}
                </span>
              </div>
              <p className="text-[12px] text-muted mt-0.5">
                Generated from attendance → Approved → Paid. Re-generate refreshes In Progress payslips only.
              </p>
            </div>

            {/* Step Indicators */}
            <div className="flex flex-wrap items-center gap-2">
              {PAYSLIP_STAGES.map((step, idx) => {
                const order = PAYSLIP_STAGES.map((s) => s.id);
                const currentIdx = order.indexOf(workflowStep);
                const isActive = workflowStep === step.id;
                const isPassed = currentIdx > idx;

                return (
                  <div key={step.id} className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 ${
                        isActive
                          ? "bg-navy text-white shadow-xs"
                          : isPassed
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isPassed && <Check size={12} className="text-emerald-700" />}
                      <span>{step.label}</span>
                      <span className={`text-[10.5px] px-1.5 rounded-md ${isActive ? "bg-white/20" : "bg-white/70"}`}>
                        {stageCounts[step.id] || 0}
                      </span>
                    </span>
                    {idx < PAYSLIP_STAGES.length - 1 && (
                      <ArrowRight size={13} className="text-slate-300" />
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setShowGenerateSlipModal(true)}
                className="ml-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-[12px] font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                title="Generate employee payslip PDF"
              >
                <Download size={13} className="text-emerald-600" />
                <span>Payslip (PDF)</span>
              </button>

              {inProgressIds.length > 0 && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => openBulk("approve", inProgressIds)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12px] font-semibold transition cursor-pointer shadow-xs flex items-center gap-1 disabled:opacity-60"
                >
                  <span>Approve all ({inProgressIds.length})</span>
                  <ChevronRight size={14} />
                </button>
              )}
              {approvedIds.length > 0 && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => openBulk("pay", approvedIds)}
                  className="px-3 py-1.5 bg-navy hover:bg-navy/90 text-white rounded-xl text-[12px] font-semibold transition cursor-pointer shadow-xs flex items-center gap-1 disabled:opacity-60"
                >
                  <CreditCard size={13} />
                  <span>Mark all paid ({approvedIds.length})</span>
                </button>
              )}
              {workflowStep === "Paid" && (
                <button
                  type="button"
                  onClick={handleBatchDownloadSlips}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12px] font-semibold transition cursor-pointer shadow-xs flex items-center gap-1"
                  title="Download payslips for all staff"
                >
                  <Download size={13} />
                  <span>Download All Slips</span>
                </button>
              )}
            </div>
          </div>

          {/* Two-Column: Salary Structures & Cost Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Salary Band Structures */}
            <div className="lg:col-span-6 bg-white border border-bdr rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-bdr/60 mb-3">
                <div>
                  <h3 className="font-bold text-[15px] text-slate-900">Standard Salary Band Structures</h3>
                  <p className="text-[12px] text-muted">Baseline grade compensation slabs</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddStructureModal(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[12px] font-medium transition cursor-pointer"
                >
                  <Plus size={13} />
                  Add Band
                </button>
              </div>

              <div className="divide-y divide-bdr/40">
                {structures.length === 0 && (
                  <div className="py-6 text-center text-[12.5px] text-muted">No salary structures set up yet.</div>
                )}
                {structures.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-[13px]">
                    <div>
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-muted">{item.department || item.code || ""}</div>
                    </div>
                    <div className="text-right">
                      {(item.baseMin || item.baseMax) && (
                        <div className="font-semibold text-slate-800">{item.baseMin} - {item.baseMax}</div>
                      )}
                      {item.employees != null && (
                        <span className="text-[10.5px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                          {item.employees} staff active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Department Cost Share Progress Bars */}
            <div className="lg:col-span-6 bg-white border border-bdr rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-bdr/60 mb-3">
                <div>
                  <h3 className="font-bold text-[15px] text-slate-900">Department Net Payable Share</h3>
                  <p className="text-[12px] text-muted">Net payout allocation per department</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("department")}
                  className="text-navy text-[12.5px] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                >
                  View Details
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-3 pt-1">
                {departmentPayrolls.slice(0, 5).map((d) => {
                  const percent = Math.round((d.totalRemaining / (overallStats.totalRemaining || 1)) * 100);
                  return (
                    <div key={d.name} className="space-y-1">
                      <div className="flex justify-between items-center text-[12.5px]">
                        <span className="font-medium text-slate-800">
                          {d.name} <span className="text-muted text-[11px]">({d.headcount} staff)</span>
                        </span>
                        <span className="font-semibold text-slate-900">
                          {formatINR(d.totalRemaining)} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-navy rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DEPARTMENT-WISE PAYROLL
         ========================================================================= */}
      {activeTab === "department" && !hasRows && emptyState}
      {activeTab === "department" && hasRows && (
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="font-bold text-[15px] text-slate-900">Department Allocations &amp; Formulas</h3>
              <p className="text-[12px] text-muted">
                Net Payable = Earned Salary (after attendance deduction) + Earnings − Deductions − Advance
              </p>
            </div>
            <span className="text-[12px] text-muted font-medium">
              {departmentPayrolls.length} departments · {monthLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departmentPayrolls.map((dept) => (
              <div
                key={dept.name}
                className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col justify-between transition hover:border-slate-300"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="font-bold text-[15px] text-slate-900">{dept.name}</h4>
                      <div className="text-[11.5px] text-muted flex items-center gap-1.5 mt-0.5">
                        <span>{dept.headcount} staff</span>
                        {dept.workingDays != null && (
                          <>
                            <span>•</span>
                            <span>{fmtDays(dept.workingDays)} working days</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge tone={dept.allPaid ? "success" : "warning"}>
                      {dept.allPaid ? "Paid" : `${dept.paidCount}/${dept.headcount} Paid`}
                    </Badge>
                  </div>

                  {/* Clean Formula Metrics Breakdown */}
                  <div className="bg-slate-50 border border-bdr/60 rounded-xl p-3 space-y-1.5 text-[12.5px]">
                    <div className="flex justify-between">
                      <span className="text-muted">Standard Salary:</span>
                      <span className="font-medium text-slate-700">{formatINR(dept.totalStandard)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Attendance Deduction:</span>
                      <span className="font-medium text-rose-700">-{formatINR(dept.totalAttendanceDeduction)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Earned Salary:</span>
                      <span className="font-medium text-blue-800">{formatINR(dept.totalEarned)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Additional Earnings:</span>
                      <span className="font-medium text-emerald-700">+{formatINR(dept.totalEarnings)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Deductions:</span>
                      <span className="font-medium text-rose-700">-{formatINR(dept.totalDeductions)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Salary Advance:</span>
                      <span className="font-medium text-amber-800">-{formatINR(dept.totalAdvance)}</span>
                    </div>

                    <div className="pt-2 border-t border-bdr/60 flex justify-between font-bold text-[13px]">
                      <span className="text-slate-900">Net Payable:</span>
                      <span className="text-emerald-700">{formatINR(dept.totalRemaining)}</span>
                    </div>
                  </div>

                  {/* Progress Indicator: Earned vs Standard */}
                  <div className="mt-3 px-1">
                    <div className="flex justify-between text-[11.5px] text-muted mb-1">
                      <span>Earned Progress</span>
                      <span className="font-semibold text-slate-800">{dept.earnedProgress}% of Standard</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-navy rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, dept.earnedProgress)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-[11.5px] text-muted mt-2.5 px-1">
                    <span>Average Payable per staff:</span>
                    <span className="font-semibold text-slate-800">{formatINR(dept.avgSalary)}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-bdr/60 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeptFilter(dept.name);
                      setActiveTab("employee");
                    }}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[12px] font-medium transition cursor-pointer text-center"
                  >
                    View Staff ({dept.headcount})
                  </button>
                  {dept.inProgressIds.length > 0 ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => openBulk("approve", dept.inProgressIds, dept.name)}
                      className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-[12px] font-semibold transition cursor-pointer shadow-xs disabled:opacity-60"
                    >
                      Approve ({dept.inProgressIds.length})
                    </button>
                  ) : dept.approvedIds.length > 0 ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => openBulk("pay", dept.approvedIds, dept.name)}
                      className="px-3 py-1.5 bg-navy text-white hover:bg-navy/90 rounded-xl text-[12px] font-semibold transition cursor-pointer shadow-xs disabled:opacity-60"
                    >
                      Mark Paid ({dept.approvedIds.length})
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: EMPLOYEE-WISE PAYROLL
         ========================================================================= */}
      {activeTab === "employee" && !hasRows && emptyState}
      {activeTab === "employee" && hasRows && (
        <div className="flex flex-col gap-4">
          {/* Filter Toolbar */}
          <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="Search name, ID, or designation..."
                  className="w-full h-9.5 pl-9 pr-3.5 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-800 focus:outline-none focus:border-navy"
                />
              </div>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-9.5 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer"
              >
                <option value="All">All Departments</option>
                {departmentNames.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9.5 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="In Progress">In Progress</option>
                <option value="Approved">Approved</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            <div className="text-[12px] text-muted">
              Showing <span className="font-semibold text-slate-800">{filteredEmployees.length}</span> staff members
            </div>
          </div>

          {/* Master Employee Table with server-computed figures */}
          <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-[13px]">
                <thead className="bg-slate-50/75 border-b border-bdr text-[11px] uppercase tracking-wider text-muted font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-3">Standard Salary</th>
                    <th className="py-3.5 px-3">Attendance &amp; Leave</th>
                    <th className="py-3.5 px-3">Per-day &amp; Deduction</th>
                    <th className="py-3.5 px-3">Earned Salary</th>
                    <th className="py-3.5 px-3">Adjustments</th>
                    <th className="py-3.5 px-3 font-bold text-slate-900">Net Payable</th>
                    <th className="py-3.5 px-3">Status &amp; Payment</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/40">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted">
                        No employees found matching the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((p) => {
                      const rowBusy = busyRowId === p.id;
                      const editable = p.status === "In Progress" || p.status === "Ready for Review" || !p.status;
                      return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        {/* Employee Details */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={p.name} size="sm" />
                            <div>
                              <div className="font-semibold text-slate-900">{p.name}</div>
                              <div className="text-[11px] text-muted">
                                {p.role || "—"} • <span className="font-mono">{p.empId}</span> • {p.department || "—"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Standard Salary */}
                        <td className="py-3.5 px-3 font-medium text-slate-800">
                          <div className="font-bold text-slate-900">{formatINR(p.standardSalary)}</div>
                          <div className="text-[10.5px] text-muted">{fmtDays(p.totalDays)} working days</div>
                        </td>

                        {/* Attendance & Leave */}
                        <td className="py-3.5 px-3 text-[11.5px]">
                          <div className="font-semibold text-slate-900 text-[12.5px]">
                            {fmtDays(p.attendedDays)}<span className="text-muted font-normal"> attended</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.paidLeaves > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                {fmtDays(p.paidLeaves)} paid leave
                              </span>
                            )}
                            {p.unpaidLeaves > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                                {fmtDays(p.unpaidLeaves)} LOP
                              </span>
                            )}
                            {p.absentDays > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                                {fmtDays(p.absentDays)} deducted
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium">Full pay</span>
                            )}
                          </div>
                        </td>

                        {/* Per-day & Deduction */}
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-900 text-[12.5px]">
                            {formatINR(p.perDaySalary)}<span className="text-slate-500 font-normal text-[11px]">/day</span>
                          </div>
                          {p.attendanceDeduction > 0 ? (
                            <div className="text-[11px] text-rose-700 font-medium mt-0.5">
                              -{formatINR(p.attendanceDeduction)} ({fmtDays(p.absentDays)}d)
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted mt-0.5">No deduction</div>
                          )}
                        </td>

                        {/* Earned Salary */}
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-blue-900">{formatINR(p.earnedSalary)}</div>
                          <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                            {fmtDays(p.payableDays)}/{fmtDays(p.totalDays)} paid days
                          </div>
                        </td>

                        {/* Adjustments */}
                        <td className="py-3.5 px-3 text-[11.5px] leading-tight">
                          <div className="text-emerald-700 font-medium">+{formatINR(p.additionalEarnings)} earnings</div>
                          <div className="text-rose-700 font-medium mt-0.5">-{formatINR(p.deductions)} deductions</div>
                          <div className="text-amber-800 font-medium mt-0.5">-{formatINR(p.advance)} advance</div>
                        </td>

                        {/* Net Payable */}
                        <td className="py-3.5 px-3 font-bold text-slate-900">
                          <span className="text-emerald-700 text-[14px] block">
                            {formatINR(p.remainingPayable)}
                          </span>
                        </td>

                        {/* Payroll Status & Payment Info */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col gap-0.5">
                            <Badge tone={statusTone(p.status)}>{p.status || "In Progress"}</Badge>

                            {p.status === "Paid" && (
                              <div className="text-[10.5px] text-slate-600 mt-1 leading-tight">
                                <span className="font-semibold text-emerald-700">
                                  Paid: {formatINR(p.paidAmount ?? p.remainingPayable)}
                                </span>
                                {p.paymentDate && (
                                  <div className="text-muted text-[10px] flex items-center gap-1 mt-0.5">
                                    <Calendar size={10} />
                                    <span>{fmtDate(p.paymentDate)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-navy transition cursor-pointer"
                              title={editable ? "Adjust earnings / deductions / advance" : "View attendance & adjustments"}
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedPayslip(p)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-navy transition cursor-pointer"
                              title="View Payslip"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                downloadPayslipPdf(p);
                                showToast(`Downloading PDF Payslip for ${p.name}`);
                              }}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                              title="Download PDF"
                            >
                              <Download size={15} />
                            </button>
                            {editable && (
                              <button
                                type="button"
                                disabled={rowBusy || isBusy}
                                onClick={() => handleApproveRow(p)}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-[11px] font-semibold transition cursor-pointer ml-1 disabled:opacity-60"
                              >
                                {rowBusy ? <Loader2 size={12} className="animate-spin" /> : "Approve"}
                              </button>
                            )}
                            {p.status === "Approved" && (
                              <button
                                type="button"
                                disabled={rowBusy || isBusy}
                                onClick={() => handlePayRow(p)}
                                className="px-2.5 py-1 bg-navy/5 text-navy border border-navy/20 hover:bg-navy/10 rounded-lg text-[11px] font-semibold transition cursor-pointer ml-1 disabled:opacity-60"
                              >
                                {rowBusy ? <Loader2 size={12} className="animate-spin" /> : "Mark Paid"}
                              </button>
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
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: MY SALARY (PERSONAL PAYSLIPS & FORMULA BREAKDOWN)
         ========================================================================= */}
      {activeTab === "own" && !ownRecord && (
        <div className="bg-white border border-dashed border-bdr rounded-2xl p-8 shadow-xs flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-navy/5 text-navy flex items-center justify-center">
            <CreditCard size={22} />
          </div>
          <h3 className="font-bold text-[15px] text-slate-900">
            {ownEmployeeId ? "No payslips yet" : "No employee record linked"}
          </h3>
          <p className="text-[12.5px] text-muted max-w-md">
            {ownEmployeeId
              ? "Your payslips appear here once payroll has been generated for a month."
              : "Your login is not linked to an employee record, so there are no personal payslips to show."}
          </p>
        </div>
      )}
      {activeTab === "own" && ownRecord && (
        <div className="flex flex-col gap-5">
          {/* Minimal Clean Hero Card */}
          <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-navy/5 text-navy border border-navy/15 flex items-center justify-center font-bold text-[18px]">
                {currentUser?.initials || String(ownRecord.name || "?").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] font-bold text-slate-900 leading-tight">
                    {ownRecord.name}
                  </h2>
                  <Badge tone={statusTone(ownRecord.status)}>{ownRecord.status}</Badge>
                </div>
                <p className="text-[12.5px] text-muted mt-0.5">
                  {ownRecord.role || "—"} • {ownRecord.department || "—"} • <span className="text-slate-700 font-mono">{ownRecord.empId}</span>
                </p>
                <div className="text-[11.5px] text-muted mt-1.5">
                  {ownRecord.bank && (
                    <>Direct deposit: <b className="text-slate-800">{ownRecord.bank}</b></>
                  )}
                  {ownRecord.status === "Paid" && ownRecord.paymentDate && (
                    <span>{ownRecord.bank ? " • " : ""}Paid on <b className="text-emerald-700">{fmtDate(ownRecord.paymentDate)}</b></span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-bdr/60">
              <div className="text-left md:text-right">
                <span className="text-[11px] text-muted uppercase tracking-wider block font-medium">
                  {ownRecord.status === "Paid" ? "Net Paid Amount" : "Net Payable"} · {slipMonth(ownRecord)}
                </span>
                <span className="text-[26px] font-extrabold text-emerald-950 leading-none">
                  {formatINR(ownRecord.status === "Paid" ? (ownRecord.paidAmount ?? ownRecord.remainingPayable) : ownRecord.remainingPayable)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  downloadPayslipPdf(ownRecord);
                  showToast(`Downloading ${slipMonth(ownRecord)} Payslip (PDF)`);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-navy text-white rounded-xl text-[13px] font-medium shadow-xs hover:bg-navy/90 transition cursor-pointer shrink-0"
              >
                <Download size={14} />
                <span>Download Payslip PDF</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] text-muted uppercase font-semibold block">Standard Salary</span>
              <span className="text-[17px] font-bold text-slate-900 block mt-1">{formatINR(ownRecord.standardSalary)}</span>
              <span className="text-[10.5px] text-slate-500">{fmtDays(ownRecord.totalDays)} working days</span>
            </div>

            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] text-blue-700 uppercase font-semibold block">Earned Salary</span>
              <span className="text-[17px] font-bold text-blue-950 block mt-1">{formatINR(ownRecord.earnedSalary)}</span>
              <span className="text-[10.5px] text-blue-700">
                {fmtDays(ownRecord.attendedDays)} attended + {fmtDays(ownRecord.paidLeaves)} paid leave
              </span>
            </div>

            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] text-emerald-700 uppercase font-semibold block">Additional Earnings</span>
              <span className="text-[17px] font-bold text-emerald-800 block mt-1">+{formatINR(ownRecord.additionalEarnings)}</span>
              <span className="text-[10.5px] text-muted">Overtime / bonuses</span>
            </div>

            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] text-rose-700 uppercase font-semibold block">Deductions</span>
              <span className="text-[17px] font-bold text-rose-800 block mt-1">-{formatINR(ownRecord.deductions)}</span>
              <span className="text-[10.5px] text-muted">Statutory &amp; other</span>
            </div>

            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] text-amber-800 uppercase font-semibold block">Advance Recovered</span>
              <span className="text-[17px] font-bold text-amber-900 block mt-1">-{formatINR(ownRecord.advance)}</span>
              <span className="text-[10.5px] text-muted">Salary advance</span>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] text-emerald-800 uppercase font-bold block">Net Payable</span>
              <span className="text-[17px] font-extrabold text-emerald-950 block mt-1">{formatINR(ownRecord.remainingPayable)}</span>
              <span className="text-[10.5px] text-emerald-700 font-medium">
                {ownRecord.status === "Paid" ? "Paid" : ownRecord.status}
              </span>
            </div>
          </div>

          {/* Salary Progress Indicator */}
          <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs">
            <div className="flex flex-wrap justify-between items-center gap-2 text-[12.5px] mb-2">
              <span className="font-semibold text-slate-800">
                Salary Progress: Earned vs Standard
              </span>
              <span className="font-bold text-slate-900">
                {formatINR(ownRecord.earnedSalary)} of {formatINR(ownRecord.standardSalary)} ({ownRecord.earnedProgress}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-navy rounded-full transition-all duration-300"
                style={{ width: `${ownRecord.earnedProgress}%` }}
              />
            </div>
            <div className="text-[11px] text-muted mt-2">{attendanceLine(ownRecord)}</div>
          </div>

          {/* Detailed Earnings vs Deductions Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Earnings Section */}
            <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2.5 border-b border-bdr/60">
                  <h3 className="font-bold text-[15px] text-slate-900">Earnings Components</h3>
                  <span className="font-bold text-slate-900">{formatINR(ownRecord.earnedSalary + ownRecord.additionalEarnings)}</span>
                </div>

                <div className="space-y-2 text-[13px] pt-3">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Standard Base Salary</span>
                    <span className="font-medium text-slate-900">{formatINR(ownRecord.standardSalary)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">
                      Earned Salary ({fmtDays(ownRecord.payableDays)}/{fmtDays(ownRecord.totalDays)} Days)
                    </span>
                    <span className="font-semibold text-blue-900">{formatINR(ownRecord.earnedSalary)}</span>
                  </div>
                  {(ownRecord.components || [])
                    .filter((c) => String(c.kind || "").toLowerCase() === "earning")
                    .map((c, i) => (
                      <div key={`e-${i}`} className="flex justify-between py-1 border-b border-slate-50">
                        <span className="text-slate-500">{c.name}</span>
                        <span className="font-medium text-slate-900">{formatINR(c.amount)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Overtime &amp; Incentives</span>
                    <span className="font-semibold text-emerald-700">+{formatINR(ownRecord.additionalEarnings)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-bdr/60 mt-4 flex justify-between font-bold text-[14px]">
                <span className="text-slate-900">Total Earned + Additions</span>
                <span className="text-slate-900">{formatINR(ownRecord.earnedSalary + ownRecord.additionalEarnings)}</span>
              </div>
            </div>

            {/* Deductions & Advance Section */}
            <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2.5 border-b border-bdr/60">
                  <h3 className="font-bold text-[15px] text-slate-900">Deductions &amp; Advance</h3>
                  <span className="font-bold text-rose-700">
                    -{formatINR(ownRecord.deductions + ownRecord.advance)}
                  </span>
                </div>

                <div className="space-y-2 text-[13px] pt-3">
                  {ownRecord.attendanceDeduction > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-50 bg-rose-50/50 px-2 rounded-lg">
                      <span className="text-rose-800 font-medium">
                        Attendance deduction ({fmtDays(ownRecord.absentDays)}d, incl. {fmtDays(ownRecord.unpaidLeaves)}d LOP)
                      </span>
                      <span className="font-bold text-rose-700">-{formatINR(ownRecord.attendanceDeduction)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Deductions</span>
                    <span className="font-medium text-rose-700">-{formatINR(ownRecord.deductions)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 bg-amber-50/50 px-2 rounded-lg">
                    <span className="text-amber-800 font-medium">Salary Advance Recovered</span>
                    <span className="font-bold text-amber-900">-{formatINR(ownRecord.advance)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-bdr/60 mt-4 flex justify-between font-bold text-[14px]">
                <span className="text-slate-900">Total Deductions + Advance</span>
                <span className="text-rose-700">
                  -{formatINR(ownRecord.deductions + ownRecord.advance)}
                </span>
              </div>
            </div>
          </div>

          {/* Payslip History Table */}
          <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 pb-2 border-b border-bdr/60 flex flex-wrap lg:flex-nowrap justify-between items-center gap-2 lg:gap-0">
              <div>
                <h3 className="font-bold text-[15px] text-slate-900">Payslip Archive &amp; History</h3>
                <p className="text-[12px] text-muted">{ownHistory.length} payslip(s) with PDF download</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] lg:min-w-0 text-left text-[13px]">
                <thead className="bg-slate-50/75 border-b border-bdr text-[11px] uppercase tracking-wider text-muted font-bold">
                  <tr>
                    <th className="py-3.5 px-5">Month</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5">Standard</th>
                    <th className="py-3.5 px-5">Attendance</th>
                    <th className="py-3.5 px-5">Earned</th>
                    <th className="py-3.5 px-5">Advance</th>
                    <th className="py-3.5 px-5 font-bold">Net Payable</th>
                    <th className="py-3.5 px-5">Payment Date</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/40">
                  {ownHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-5 font-medium text-slate-900">{slipMonth(h)}</td>
                      <td className="py-3 px-5"><Badge tone={statusTone(h.status)}>{h.status}</Badge></td>
                      <td className="py-3 px-5 text-slate-700">{formatINR(h.standardSalary)}</td>
                      <td className="py-3 px-5 text-slate-600 text-[12px]">
                        {fmtDays(h.attendedDays)} + {fmtDays(h.paidLeaves)} leave / {fmtDays(h.totalDays)}
                      </td>
                      <td className="py-3 px-5 text-blue-900 font-medium">{formatINR(h.earnedSalary)}</td>
                      <td className="py-3 px-5 text-amber-800">-{formatINR(h.advance)}</td>
                      <td className="py-3 px-5 font-bold text-emerald-700">{formatINR(h.remainingPayable)}</td>
                      <td className="py-3 px-5 text-slate-600">{fmtDate(h.paymentDate) || "—"}</td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPayslip(h)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-navy transition cursor-pointer"
                            title="View Slip"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              downloadPayslipPdf(h);
                              showToast(`Downloaded PDF Payslip for ${slipMonth(h)}`);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                            title="Download PDF"
                          >
                            <Download size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: PAYSLIP DETAIL MODAL (FORMULA BREAKDOWN)
         ========================================================================= */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-md p-4 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
              <div className="flex items-center gap-3">
                <Avatar name={selectedPayslip.name} size="lg" />
                <div>
                  <h3 className="font-bold text-[16px] text-slate-900 leading-tight">
                    {selectedPayslip.name}
                  </h3>
                  <p className="text-[12px] text-muted">
                    {selectedPayslip.role || "—"} • {slipMonth(selectedPayslip)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formula Calculation Matrix */}
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Standard Salary</span>
                <span className="font-semibold text-slate-800">
                  {formatINR(selectedPayslip.standardSalary)}
                </span>
              </div>
              <div className="flex justify-between gap-3 py-1 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Working Days &amp; Attendance</span>
                <span className="font-semibold text-slate-700 text-right">
                  {fmtDays(selectedPayslip.attendedDays)} attended + {fmtDays(selectedPayslip.paidLeaves)} paid leave / {fmtDays(selectedPayslip.totalDays)} days
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Loss of Pay (unpaid leave)</span>
                <span className="font-medium text-slate-700">{fmtDays(selectedPayslip.unpaidLeaves)} day(s)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Per-Day Salary Rate</span>
                <span className="font-medium text-slate-700">
                  {formatINR(selectedPayslip.perDaySalary)} / day
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Attendance Deduction ({fmtDays(selectedPayslip.absentDays)}d) (-)</span>
                <span className="font-semibold text-rose-700">
                  -{formatINR(selectedPayslip.attendanceDeduction || 0)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Earned Salary</span>
                <span className="font-semibold text-blue-900">
                  {formatINR(selectedPayslip.earnedSalary)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Additional Earnings (+)</span>
                <span className="font-medium text-emerald-700">
                  +{formatINR(selectedPayslip.additionalEarnings)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Deductions (-)</span>
                <span className="font-medium text-rose-700">
                  -{formatINR(selectedPayslip.deductions)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Salary Advance Recovered (-)</span>
                <span className="font-bold text-amber-800">
                  -{formatINR(selectedPayslip.advance)}
                </span>
              </div>

              {/* Attendance detail */}
              <div className="bg-slate-50 p-2.5 rounded-xl text-[11px] text-slate-600">
                <b>Attendance:</b> {attendanceLine(selectedPayslip)}
              </div>

              {/* Net Payable */}
              <div className="flex justify-between py-2.5 font-bold text-[15px] text-slate-900 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 mt-2">
                <span>Net Payable</span>
                <span className="text-emerald-800">
                  {formatINR(selectedPayslip.remainingPayable ?? selectedPayslip.netPayable)}
                </span>
              </div>

              {/* Payment Info if Paid */}
              {selectedPayslip.status === "Paid" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[12px] text-slate-700 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted">Payment Status:</span>
                    <span className="font-bold text-emerald-700">Paid</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Paid Amount:</span>
                    <span className="font-semibold text-slate-900">
                      {formatINR(selectedPayslip.paidAmount ?? selectedPayslip.remainingPayable)}
                    </span>
                  </div>
                  {selectedPayslip.paymentDate && (
                    <div className="flex justify-between">
                      <span className="text-muted">Payment Date:</span>
                      <span className="font-medium text-slate-800">{fmtDate(selectedPayslip.paymentDate)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  downloadPayslipPdf(selectedPayslip);
                  showToast(`Downloaded PDF Payslip for ${selectedPayslip.name}`);
                  setSelectedPayslip(null);
                }}
                className="flex-1 bg-navy hover:bg-navy/90 text-white rounded-xl py-2.5 font-semibold text-[13px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={14} />
                Download PDF Payslip
              </button>
              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                className="px-4 bg-off border border-bdr text-slate-700 hover:bg-slate-100 rounded-xl py-2.5 font-medium text-[13px] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: GENERATE PAYROLL FROM ATTENDANCE (CONFIRMATION)
         ========================================================================= */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-md p-4 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
              <h3 className="font-bold text-[16px] text-slate-900">
                {hasRows ? "Re-generate" : "Generate"} Payroll — {monthLabel}
              </h3>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[13.5px] text-slate-700 leading-relaxed">
              This pulls <b>{monthLabel}</b>'s attendance and approved leave for every employee and
              computes each payslip on the server:
            </p>
            <ul className="space-y-1.5 text-[12.5px] text-slate-700">
              <li className="flex items-start gap-2">
                <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Attended days = Present + Late + WFH + ½ × Half Day</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Approved paid leave is paid; unmarked working days, Absent and Loss of Pay are deducted at the per-day rate</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Existing earnings / deductions / advance adjustments are kept</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <span>Approved and Paid payslips are frozen and are not changed</span>
              </li>
            </ul>
            {hasRows && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[12.5px] text-slate-700 flex justify-between">
                <span>Current payslips: {computedEmployeePayrolls.length}</span>
                <span>{stageCounts["In Progress"]} will be refreshed</span>
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerate}
                className="flex-1 bg-navy hover:bg-navy/90 text-white rounded-xl py-2.5 font-semibold text-[13px] transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {generating && <Loader2 size={14} className="animate-spin" />}
                {generating ? "Generating…" : "Generate from Attendance"}
              </button>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="px-4 bg-off border border-bdr text-slate-700 hover:bg-slate-100 rounded-xl py-2.5 font-medium text-[13px] transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: ADJUST EARNINGS / DEDUCTIONS / ADVANCE
         ========================================================================= */}
      {editingEmployee && (() => {
        const editable =
          editingEmployee.status === "In Progress" || editingEmployee.status === "Ready for Review" || !editingEmployee.status;
        const previewNet =
          (Number(editingEmployee.earnedSalary) || 0) +
          (Number(editEarnings) || 0) -
          (Number(editDeductions) || 0) -
          (Number(editAdvance) || 0);
        return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <form
            onSubmit={handleSaveParams}
            className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-lg p-4 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
              <div>
                <h3 className="font-bold text-[16px] text-slate-900">Adjust Payslip — {monthLabel}</h3>
                <p className="text-[12px] text-muted">{editingEmployee.name} ({editingEmployee.empId}) • {editingEmployee.department || "—"}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Attendance (read-only, from the attendance register) */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex justify-between items-center text-[12.5px]">
                <span className="text-slate-600 font-medium">Standard Monthly Salary:</span>
                <span className="font-bold text-slate-900 text-[13.5px]">{formatINR(editingEmployee.standardSalary)}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-center">
                {[
                  ["Working days", editingEmployee.totalDays],
                  ["Attended", editingEmployee.attendedDays],
                  ["Paid leave", editingEmployee.paidLeaves],
                  ["LOP", editingEmployee.unpaidLeaves],
                ].map(([label, value]) => (
                  <div key={label} className="bg-white rounded-lg border border-slate-200 py-1.5">
                    <div className="text-[10.5px] text-muted uppercase font-semibold">{label}</div>
                    <div className="text-[14px] font-bold text-slate-900">{fmtDays(value)}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11.5px] space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Per-day rate:</span>
                  <span className="font-mono font-medium">{formatINR(editingEmployee.perDaySalary)}/day</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Days deducted:</span>
                  <span className={`font-semibold ${editingEmployee.absentDays > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {fmtDays(editingEmployee.absentDays)} {editingEmployee.absentDays > 0 ? "day(s)" : "(full pay)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 font-medium">Attendance deduction:</span>
                  <span className="font-bold text-rose-700">-{formatINR(editingEmployee.attendanceDeduction)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-100 font-semibold text-blue-900">
                  <span>Earned Salary:</span>
                  <span>{formatINR(editingEmployee.earnedSalary)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-slate-600">
                <span>Attendance is wrong? Correct it in the register, then re-generate.</span>
                <div className="flex items-center gap-1.5">
                  {editingEmployee.employeeId && (
                    <Link
                      to={`/hrms/attendance/individual?employeeId=${encodeURIComponent(editingEmployee.employeeId)}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-bdr rounded-lg font-semibold text-navy hover:bg-slate-50"
                    >
                      <ExternalLink size={12} /> Attendance
                    </Link>
                  )}
                  {editable && (
                    <button
                      type="button"
                      disabled={generating}
                      onClick={handleGenerate}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-bdr rounded-lg font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
                    >
                      {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Re-generate
                    </button>
                  )}
                </div>
              </div>
            </div>

            {!editable && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-900 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <span>This payslip is {editingEmployee.status} and can no longer be adjusted.</span>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Salary Advance Recovered [₹]
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={!editable}
                  value={editAdvance}
                  onChange={(e) => setEditAdvance(e.target.value)}
                  className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy disabled:opacity-60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="e.g. 5000"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Additional Earnings [₹]
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={!editable}
                    value={editEarnings}
                    onChange={(e) => setEditEarnings(e.target.value)}
                    className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy disabled:opacity-60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Deductions [₹]
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={!editable}
                    value={editDeductions}
                    onChange={(e) => setEditDeductions(e.target.value)}
                    className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy disabled:opacity-60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[12.5px] space-y-1">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-emerald-950">Net Payable {editable ? "(preview)" : ""}:</span>
                  <span className="text-emerald-800 text-[15px] font-extrabold">
                    {formatINR(editable ? previewNet : editingEmployee.remainingPayable)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-emerald-200/60 leading-tight">
                  Earned ({formatINR(editingEmployee.earnedSalary)}) + Earnings ({formatINR(editEarnings)}) − Deductions ({formatINR(editDeductions)}) − Advance ({formatINR(editAdvance)}). The server recomputes on save.
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              {editable && (
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 bg-navy hover:bg-navy/90 text-white rounded-xl py-2.5 font-semibold text-[13px] transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {savingEdit && <Loader2 size={14} className="animate-spin" />}
                  Save Adjustments
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className={`px-4 bg-off border border-bdr text-slate-700 hover:bg-slate-100 rounded-xl py-2.5 font-medium text-[13px] transition cursor-pointer ${editable ? "" : "flex-1"}`}
              >
                {editable ? "Cancel" : "Close"}
              </button>
            </div>
          </form>
        </div>
        );
      })()}

      {/* =========================================================================
          MODAL 4: ADD SALARY STRUCTURE MODAL
         ========================================================================= */}
      {showAddStructureModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <form
            onSubmit={handleAddStructureSubmit}
            className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-md p-4 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[95vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
              <h3 className="font-bold text-[16px] text-slate-900">Add Salary Band Structure</h3>
              <button
                type="button"
                onClick={() => setShowAddStructureModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Structure / Band Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering — L5 (Staff Dev)"
                  value={newStructure.name}
                  onChange={(e) => setNewStructure({ ...newStructure, name: e.target.value })}
                  className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    list="payroll-departments"
                    placeholder="e.g. Production"
                    value={newStructure.department}
                    onChange={(e) => setNewStructure({ ...newStructure, department: e.target.value })}
                    className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[12.5px] focus:outline-none focus:border-navy"
                  />
                  <datalist id="payroll-departments">
                    {departmentNames.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Staff Headcount
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 15"
                    value={newStructure.employees}
                    onChange={(e) => setNewStructure({ ...newStructure, employees: e.target.value })}
                    className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                className="flex-1 bg-navy hover:bg-navy/90 text-white rounded-xl py-2.5 font-semibold text-[13px] transition cursor-pointer shadow-xs"
              >
                Save Structure
              </button>
              <button
                type="button"
                onClick={() => setShowAddStructureModal(false)}
                className="px-4 bg-off border border-bdr text-slate-700 hover:bg-slate-100 rounded-xl py-2.5 font-medium text-[13px] transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: BULK APPROVE / MARK PAID CONFIRMATION
         ========================================================================= */}
      {confirmBulk && (() => {
        const scenario = STAGE_SCENARIOS[confirmBulk.kind];
        const targets = computedEmployeePayrolls.filter((p) => confirmBulk.ids.includes(p.id));
        const targetNet = targets.reduce((sum, p) => sum + (Number(p.remainingPayable) || 0), 0);
        return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-2xl w-full max-w-lg p-4 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Payroll Lifecycle · {confirmBulk.scope === "all" ? "All departments" : confirmBulk.scope}
                </span>
                <h3 className="font-bold text-[17px] text-slate-900 mt-0.5">
                  {scenario.title} ({targets.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmBulk(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <p className="text-[13px] text-slate-600 leading-relaxed">{scenario.description}</p>
            </div>

            <ul className="space-y-1 text-[12.5px] text-slate-700">
              {scenario.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {confirmBulk.kind === "pay" && (
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={bulkPayDate}
                  onChange={(e) => setBulkPayDate(e.target.value)}
                  className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy"
                />
              </div>
            )}

            {/* Financial Overview Summary */}
            <div className="bg-slate-900 text-white rounded-xl p-3.5 flex items-center justify-between text-[12px]">
              <div>
                <div className="text-slate-400 text-[11px]">Pay Period</div>
                <div className="font-bold text-white">{monthLabel}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[11px]">Payslips</div>
                <div className="font-bold text-white">{targets.length} Staff</div>
              </div>
              <div>
                <div className="text-slate-400 text-[11px]">Total Net Payable</div>
                <div className="font-extrabold text-emerald-400 text-[14px]">{formatINR(targetNet)}</div>
              </div>
            </div>

            <div className="flex gap-2.5 mt-1">
              <button
                type="button"
                disabled={isBusy}
                onClick={executeBulk}
                className="flex-1 bg-navy hover:bg-navy/90 text-white rounded-xl py-2.5 font-semibold text-[13px] transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <span>{scenario.actionLabel} {targets.length} payslip(s)</span>
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setConfirmBulk(null)}
                className="px-4 bg-off border border-bdr text-slate-700 hover:bg-slate-100 rounded-xl py-2.5 font-medium text-[13px] transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* =========================================================================
          MODAL 6: GENERATE PAYROLL SLIP (PDF)
         ========================================================================= */}
      {showGenerateSlipModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-2xl w-full max-w-xl p-4 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Download size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[16px] text-slate-900">
                    Generate Payroll Slip (PDF)
                  </h3>
                  <p className="text-[12px] text-muted">
                    {monthLabel} payslips as computed from attendance and leave
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateSlipModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {!slipSelectedEmp ? (
              <div className="py-8 text-center text-[13px] text-muted">
                No payslips for {monthLabel} yet — generate payroll first.
              </div>
            ) : (
            <>
            {/* Employee Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-slate-700">
                  Select Employee:
                </label>
                <span className="text-[11px] text-slate-500">
                  {computedEmployeePayrolls.length} payslips
                </span>
              </div>

              {/* Selected Employee Card Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSlipPickerOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between p-2.5 bg-slate-50/90 hover:bg-slate-100/80 border border-slate-300 rounded-xl transition cursor-pointer text-left focus:outline-none focus:border-navy"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <Avatar name={slipSelectedEmp?.name} size="sm" />
                    <div className="min-w-0">
                      <div className="font-bold text-[13px] text-slate-900 truncate">
                        {slipSelectedEmp?.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {slipSelectedEmp?.role || "—"} • {slipSelectedEmp?.department || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11.5px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                      {formatINR(slipSelectedEmp?.remainingPayable)}
                    </span>
                    <div className="flex items-center gap-1 text-[11.5px] text-navy font-semibold bg-white border border-slate-200 rounded-md px-2 py-1 shadow-2xs hover:bg-slate-50">
                      <span>{slipPickerOpen ? "Close" : "Switch"}</span>
                      <ChevronDown
                        size={13}
                        className={`transition-transform duration-150 ${
                          slipPickerOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>
                </button>

                {/* Searchable Picker Dropdown Menu */}
                {slipPickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setSlipPickerOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
                      {/* Search Bar */}
                      <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                        <Search size={13} className="text-slate-400 shrink-0 ml-1" />
                        <input
                          type="text"
                          value={slipSearchQuery}
                          onChange={(e) => setSlipSearchQuery(e.target.value)}
                          placeholder="Search by name, role, department..."
                          className="w-full bg-transparent border-none text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
                          autoFocus
                        />
                        {slipSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setSlipSearchQuery("")}
                            className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Employee List */}
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                        {filteredPickerEmployees.length === 0 ? (
                          <div className="p-4 text-center text-[12px] text-slate-400">
                            No employee matches &quot;{slipSearchQuery}&quot;
                          </div>
                        ) : (
                          filteredPickerEmployees.map((emp) => {
                            const isSelected = emp.id === slipSelectedEmp?.id;
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => {
                                  setSlipSelectedEmpId(emp.id);
                                  setSlipPickerOpen(false);
                                  setSlipSearchQuery("");
                                }}
                                className={`w-full flex items-center justify-between p-2.5 text-left transition cursor-pointer ${
                                  isSelected
                                    ? "bg-navy/5 font-semibold"
                                    : "hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <Avatar name={emp.name} size="xs" />
                                  <div className="min-w-0 truncate">
                                    <div className="text-[12.5px] font-medium text-slate-900 truncate">
                                      {emp.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate">
                                      {emp.role || "—"} • {emp.department || "—"}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                    {formatINR(emp.remainingPayable)}
                                  </span>
                                  {isSelected && (
                                    <Check size={14} className="text-navy shrink-0" />
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payslip Live Preview Card */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-3">
                  <Avatar name={slipSelectedEmp.name} size="md" />
                  <div>
                    <h4 className="font-bold text-[14.5px] text-slate-900">
                      {slipSelectedEmp.name}
                    </h4>
                    <p className="text-[11.5px] text-muted">
                      {slipSelectedEmp.role || "—"} • {slipSelectedEmp.department || "—"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    slipSelectedEmp.status === "Paid"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-blue-100 text-blue-800"
                  }`}>
                    {slipSelectedEmp.status}
                  </span>
                  <div className="text-[11px] text-muted mt-1">
                    {slipMonth(slipSelectedEmp)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                  <div className="text-slate-500 text-[11px]">Standard Salary</div>
                  <div className="font-bold text-slate-800">{formatINR(slipSelectedEmp.standardSalary)}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                  <div className="text-slate-500 text-[11px]">Earned Salary</div>
                  <div className="font-bold text-blue-900">{formatINR(slipSelectedEmp.earnedSalary)}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                  <div className="text-slate-500 text-[11px]">Attendance Deduction</div>
                  <div className="font-bold text-rose-700">-{formatINR(slipSelectedEmp.attendanceDeduction || 0)}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                  <div className="text-slate-500 text-[11px]">Additional Earnings (+)</div>
                  <div className="font-bold text-emerald-700">+{formatINR(slipSelectedEmp.additionalEarnings)}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                  <div className="text-slate-500 text-[11px]">Deductions (-)</div>
                  <div className="font-bold text-rose-700">-{formatINR(slipSelectedEmp.deductions || 0)}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                  <div className="text-slate-500 text-[11px]">Advance Recovered (-)</div>
                  <div className="font-bold text-amber-800">
                    -{formatINR(slipSelectedEmp.advance || 0)}
                  </div>
                </div>
              </div>

              {/* Net Payable Bar */}
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[13px]">
                <span className="font-semibold text-emerald-900">Net Payable</span>
                <span className="text-[16px] font-extrabold text-emerald-800">
                  {formatINR(slipSelectedEmp.remainingPayable)}
                </span>
              </div>

              <div className="text-[11px] text-slate-500">
                {attendanceLine(slipSelectedEmp)}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  downloadPayslipPdf(slipSelectedEmp);
                  showToast(`Downloaded PDF Payslip for ${slipSelectedEmp.name}`);
                }}
                className="flex-1 bg-navy hover:bg-navy/90 text-white rounded-xl py-2.5 font-semibold text-[13px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={15} />
                <span>Download PDF Slip</span>
              </button>

              <button
                type="button"
                onClick={() => printPayslip(slipSelectedEmp)}
                className="inline-flex items-center gap-1.5 px-4 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl py-2.5 font-semibold text-[13px] transition cursor-pointer"
              >
                <Printer size={15} />
                <span>Print / Save PDF</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDownloadSlips}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[12.5px] font-medium transition cursor-pointer"
              >
                <Download size={13} className="text-emerald-700" />
                <span>Download All {computedEmployeePayrolls.length} Payslips (Batch)</span>
              </button>
            </div>
            </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
