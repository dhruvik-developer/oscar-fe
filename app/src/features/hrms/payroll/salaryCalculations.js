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
  dailyHours = 8,
  earlyLeavingMinutes = 0,
  shortHoursDeduction = 0,
  promotion = null, // { effective_date, previous_salary, new_salary }
  cycleYearMonth = null, // e.g. "2026-10"
  salaryType = "monthly", // "monthly" | "hourly"
  hourlyRate: explicitHourlyRate = null,
  totalAttendedHours = null,
}) {
  let std = Math.max(0, Number(standardSalary) || 0);

  // If a promotion occurred within the cycle month, calculate pro-rated standard salary
  // from the promotion effective date.
  if (promotion && (promotion.new_salary || promotion.newSalary)) {
    const effDateStr = promotion.effective_date || promotion.effectiveDate;
    if (effDateStr) {
      const effDate = new Date(effDateStr);
      if (!isNaN(effDate.getTime())) {
        const year = effDate.getFullYear();
        const month = effDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dayOfMonth = effDate.getDate(); // 1 to 31

        const prevSal = Number(promotion.previous_salary || promotion.previousSalary) || std;
        const newSal = Number(promotion.new_salary || promotion.newSalary) || std;

        // Days before promotion effective date vs days from promotion date onwards
        const daysBefore = Math.max(0, dayOfMonth - 1);
        const daysAfter = Math.max(1, daysInMonth - daysBefore);

        std = Math.round(((prevSal * daysBefore) + (newSal * daysAfter)) / daysInMonth);
      }
    }
  }

  const totalD = Math.max(1, Number(totalDays) || 24);
  const dHours = Math.max(1, Number(dailyHours) || 8);

  // If attendedDays is explicitly provided, use it; otherwise default to totalD
  // Note: Half days are passed as 0.5 day (e.g. 23.5 days), meaning 0.5 day is cut.
  const attDays =
    attendedDays !== null && attendedDays !== undefined && !isNaN(Number(attendedDays))
      ? Math.max(0, Number(attendedDays))
      : totalD;

  // Approved paid leaves given by the company are protected and do not cause salary deduction.
  const pLeaves = Math.max(0, Number(paidLeaves) || 0);
  const payableDays = Math.min(totalD, attDays + pLeaves);
  const absentDays = Math.max(0, totalD - payableDays); // Remaining unattended days

  // Per-day rate and hourly rate calculation
  const perDaySalary = totalD > 0 ? std / totalD : 0;
  let effectiveHourlyRate = (totalD * dHours) > 0 ? std / (totalD * dHours) : 0;
  if (explicitHourlyRate !== null && explicitHourlyRate !== undefined && !isNaN(Number(explicitHourlyRate))) {
    effectiveHourlyRate = Math.max(0, Number(explicitHourlyRate));
  }

  // Attendance deduction: Remaining unapproved / unattended days removed from final salary
  let attendanceDeduction = Math.round(perDaySalary * absentDays);

  // Early checkout / short working hours deduction
  const earlyMins = Math.max(0, Number(earlyLeavingMinutes) || 0);
  const earlyCheckoutDeduction = earlyMins > 0 ? Math.round((earlyMins / 60) * effectiveHourlyRate) : 0;
  const explicitShortDeduction = Math.max(0, Number(shortHoursDeduction) || 0);
  const totalWorkingHourDeduction = earlyCheckoutDeduction + explicitShortDeduction;

  // Earned salary calculation:
  // If Hourly Salary mode: Earned = Attended Hours * Hourly Rate + Paid Leaves Value
  // If Monthly Salary mode: Earned = Standard Base - Attendance LOP
  let earned = 0;
  if (salaryType === "hourly") {
    const workedHours = totalAttendedHours !== null && totalAttendedHours !== undefined
      ? Number(totalAttendedHours)
      : attDays * dHours;
    const paidLeaveHours = pLeaves * dHours;
    earned = Math.round((workedHours + paidLeaveHours) * effectiveHourlyRate);
    attendanceDeduction = Math.max(0, Math.round(absentDays * dHours * effectiveHourlyRate));
    // For hourly mode, baseline standard represents scheduled full month target
    if (std === 0 && effectiveHourlyRate > 0) {
      std = Math.round(totalD * dHours * effectiveHourlyRate);
    }
  } else {
    earned =
      earnedSalary !== null && earnedSalary !== undefined && !isNaN(earnedSalary) && attendedDays === null
        ? Math.max(0, Number(earnedSalary))
        : Math.max(0, std - attendanceDeduction);
  }

  const earnings = Math.max(0, Number(additionalEarnings) || 0);
  const standardDeductions = Math.max(0, Number(deductions) || 0);
  const totalDeductions = standardDeductions + (salaryType === "hourly" ? explicitShortDeduction : totalWorkingHourDeduction);
  const adv = Math.max(0, Number(advance) || 0);

  // Core formula:
  // Remaining Payable = Earned Salary + Additional Earnings - Deductions - Advance
  const remainingPayable = Math.max(0, earned + earnings - totalDeductions - adv);

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
    salaryType,
    standardSalary: std,
    earnedSalary: earned,
    perDaySalary: Math.round(perDaySalary),
    hourlyRate: Math.round(effectiveHourlyRate),
    attendanceDeduction,
    absentDays,
    attendedDays: attDays,
    totalDays: totalD,
    payableDays,
    paidLeaves: pLeaves,
    earlyLeavingMinutes: earlyMins,
    workingHourDeduction: totalWorkingHourDeduction,
    additionalEarnings: earnings,
    deductions: totalDeductions,
    standardDeductions,
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
