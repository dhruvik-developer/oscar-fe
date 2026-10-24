/**
 * salaryCalculations.js
 * 
 * Reusable calculation engine and utilities for HRMS Advanced Monthly Payroll.
 * Formula:
 *   Per-Day Salary = Standard Agreed Salary / Total Working Days
 *   Absent / Remaining Days = Total Working Days - Attended Days - Approved Paid Leaves
 *   Attendance Deduction = Per-Day Salary * Absent Days (Remaining days salary removed from final salary)
 *   Earned Salary = Standard Salary - Attendance Deduction
 *   Remaining Payable = Earned Salary + Additional Earnings - Regular Deductions - Advance Recovered
 */

/**
 * Format any numerical value as Indian Rupee (₹) standard currency.
 * e.g., 40000 => "₹40,000"
 */
export function formatINR(val) {
  if (val === null || val === undefined || isNaN(val)) return "₹0";
  const num = Math.round(Number(val));
  return "₹" + num.toLocaleString("en-IN");
}

/**
 * Advanced Monthly Salary Calculator with Attendance & Advance Recovery
 * 
 * @param {Object} params
 * @param {number} params.standardSalary - Monthly baseline standard CTC
 * @param {number} [params.earnedSalary] - Explicit earned salary override (optional)
 * @param {number} [params.totalDays=24] - Total working days in cycle (default 24)
 * @param {number} [params.attendedDays=24] - Actual days present (default full 24)
 * @param {number} [params.paidLeaves=0] - Approved paid leaves
 * @param {number} [params.additionalEarnings=0] - Overtime, bonus, incentives, allowances
 * @param {number} [params.deductions=0] - PF, insurance, TDS, statutory deductions
 * @param {number} [params.advance=0] - Salary advance taken (deducted from salary)
 * @param {string} [params.status="In Progress"] - Lifecycle status: In Progress | Ready for Review | Approved | Paid
 * @param {number} [params.paidAmount] - Disbursed amount when Paid
 * @param {string} [params.paymentDate] - Date of payment when Paid
 * @returns {Object} Comprehensive calculation matrix
 */
export function calculateSalaryComponents({
  standardSalary = 0,
  earnedSalary = null,
  totalDays = 24,
  attendedDays = null,
  paidLeaves = 0,
  additionalEarnings = 0,
  deductions = 0,
  advance = 0,
  status = "In Progress",
  paidAmount = null,
  paymentDate = null,
}) {
  const std = Math.max(0, Number(standardSalary) || 0);
  const totalD = Math.max(1, Number(totalDays) || 24);

  // If attendedDays is explicitly provided, use it; otherwise default to totalD
  const attDays =
    attendedDays !== null && attendedDays !== undefined && !isNaN(Number(attendedDays))
      ? Math.max(0, Number(attendedDays))
      : totalD;

  const pLeaves = Math.max(0, Number(paidLeaves) || 0);
  const payableDays = Math.min(totalD, attDays + pLeaves);
  const absentDays = Math.max(0, totalD - payableDays); // Remaining unattended days

  // Per-day rate calculation
  const perDaySalary = totalD > 0 ? std / totalD : 0;

  // Attendance deduction: Remaining days salary removed from final salary
  const attendanceDeduction = Math.round(perDaySalary * absentDays);

  // Earned salary: Standard base minus remaining days deduction
  const earned =
    earnedSalary !== null && earnedSalary !== undefined && !isNaN(earnedSalary) && attendedDays === null
      ? Math.max(0, Number(earnedSalary))
      : Math.max(0, std - attendanceDeduction);

  const earnings = Math.max(0, Number(additionalEarnings) || 0);
  const ded = Math.max(0, Number(deductions) || 0);
  const adv = Math.max(0, Number(advance) || 0);

  // Core formula:
  // Remaining Payable = Standard Salary - Attendance Deduction + Additional Earnings - Deductions - Advance
  // Equivalent to: Earned Salary + Additional Earnings - Deductions - Advance
  const remainingPayable = Math.max(0, earned + earnings - ded - adv);

  // Progress indicator: Earned vs Standard
  const earnedProgress = std > 0 ? Math.min(100, Math.round((earned / std) * 100)) : 100;

  // Month-end payout metadata
  const isPaid = status === "Paid";
  const finalPaidAmount = isPaid
    ? (paidAmount !== null && paidAmount !== undefined ? Number(paidAmount) : remainingPayable)
    : null;
  const finalPaymentDate = isPaid
    ? (paymentDate || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))
    : null;

  return {
    standardSalary: std,
    earnedSalary: earned,
    perDaySalary: Math.round(perDaySalary),
    attendanceDeduction,
    absentDays,
    attendedDays: attDays,
    totalDays: totalD,
    payableDays,
    paidLeaves: pLeaves,
    additionalEarnings: earnings,
    deductions: ded,
    advance: adv,
    remainingPayable,
    earnedProgress,
    status,
    isPaid,
    paidAmount: finalPaidAmount,
    paymentDate: finalPaymentDate,
  };
}

/**
 * Aggregates a list of employee calculations into high-level KPI metrics
 */
export function aggregatePayrollStats(calculatedEmployees = []) {
  const totalStandard = calculatedEmployees.reduce((sum, e) => sum + e.standardSalary, 0);
  const totalEarned = calculatedEmployees.reduce((sum, e) => sum + e.earnedSalary, 0);
  const totalAttendanceDeduction = calculatedEmployees.reduce(
    (sum, e) => sum + (e.attendanceDeduction || 0),
    0
  );
  const totalEarnings = calculatedEmployees.reduce((sum, e) => sum + e.additionalEarnings, 0);
  const totalDeductions = calculatedEmployees.reduce((sum, e) => sum + e.deductions, 0);
  const totalAdvance = calculatedEmployees.reduce((sum, e) => sum + e.advance, 0);
  const totalRemaining = calculatedEmployees.reduce((sum, e) => sum + e.remainingPayable, 0);

  const totalHeadcount = calculatedEmployees.length;
  const paidCount = calculatedEmployees.filter((e) => e.status === "Paid").length;
  const approvedCount = calculatedEmployees.filter((e) => e.status === "Approved").length;
  const reviewCount = calculatedEmployees.filter((e) => e.status === "Ready for Review").length;
  const inProgressCount = calculatedEmployees.filter((e) => e.status === "In Progress").length;

  const totalDisbursed = calculatedEmployees
    .filter((e) => e.status === "Paid")
    .reduce((sum, e) => sum + (e.paidAmount || e.remainingPayable), 0);

  return {
    totalStandard,
    totalEarned,
    totalAttendanceDeduction,
    totalEarnings,
    totalDeductions,
    totalAdvance,
    totalRemaining,
    totalDisbursed,
    totalHeadcount,
    paidCount,
    approvedCount,
    reviewCount,
    inProgressCount,
    completionRate: totalHeadcount > 0 ? Math.round((paidCount / totalHeadcount) * 100) : 0,
    avgStandard: totalHeadcount > 0 ? Math.round(totalStandard / totalHeadcount) : 0,
    avgPayable: totalHeadcount > 0 ? Math.round(totalRemaining / totalHeadcount) : 0,
  };
}
