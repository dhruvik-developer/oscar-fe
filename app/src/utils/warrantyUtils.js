/**
 * Warranty Utilities for Evenmore Unified ERP
 * 
 * Provides safe date arithmetic for warranty expiry, live coverage status calculation,
 * standard company warranty terms & conditions, and display formatters.
 */

export const DEFAULT_WARRANTY_TERMS = `1. COVERAGE: This Warranty Certificate covers defects in materials and manufacturing workmanship under normal operating conditions and recommended usage guidelines.
2. WARRANTY PERIOD: Warranty coverage commences from the official Start Event Date recorded on this document and remains valid until the specified Expiry Date.
3. EXCLUSIONS: This warranty does not cover:
   a) Physical damage, accidental drop, or transit mishandling after verified delivery.
   b) Damage caused by incorrect electrical power supply, surges, or environmental conditions outside technical specifications.
   c) Consumable accessories, wear-and-tear items, and periodic calibration unless explicitly specified.
   d) Equipment modified, opened, repaired, or serviced by unauthorized technicians.
4. COMPONENT LEVEL WARRANTY: Where individual components (e.g. motors, sensors, camera heads, controllers) have independent warranty periods specified, those terms govern the respective component.
5. WARRANTY SERVICE PROCEDURE: For support or service requests during the active warranty period, present this Warranty Certificate Number along with the original Delivery Challan reference.`;

/**
 * Safely parse date string to Date object
 */
export function parseDateSafe(dateInput) {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? new Date() : dateInput;
    
    // Handle standard string or formatted string
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }
    // Handle DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyyMatch = String(dateInput).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    }
    return new Date();
}

/**
 * Format date to YYYY-MM-DD for form inputs
 */
export function formatDateToISO(dateInput) {
    if (!dateInput) return '';
    const d = parseDateSafe(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format date to human-friendly format (e.g. 30 Sep 2026)
 */
export function formatDisplayDate(dateInput) {
    if (!dateInput) return '—';
    const d = parseDateSafe(dateInput);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
}

/**
 * Calculate Warranty Expiry Date safely handling year and month arithmetic and month-end dates
 * e.g., 30 Sep 2026 + 5 Years = 29 Sep 2031 (standard warranty day-before anniversary)
 * e.g., 30 Sep 2026 + 6 Months = 29 Mar 2027
 */
export function calculateWarrantyExpiry(startDateInput, period = 1, unit = 'Years') {
    if (!startDateInput) return '';
    const startDate = parseDateSafe(startDateInput);
    const p = Math.max(1, Number(period) || 1);
    
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const day = startDate.getDate();

    const expiryDate = new Date(year, month, day);

    if (String(unit).toLowerCase() === 'months' || String(unit).toLowerCase() === 'month') {
        // Add months safely handling month overflow (e.g. Jan 31 + 1 month -> Feb 28/29)
        const targetMonth = month + p;
        expiryDate.setMonth(targetMonth);
        
        // If the day changed due to overflow into next month, clamp to last day of target month
        if (expiryDate.getMonth() !== (targetMonth % 12 + 12) % 12) {
            expiryDate.setDate(0); // Sets to last day of previous month
        }
        // Expiry is 1 day before the anniversary date
        expiryDate.setDate(expiryDate.getDate() - 1);
    } else {
        // Years
        expiryDate.setFullYear(year + p);
        // Handle leap year Feb 29 rollover
        if (month === 1 && day === 29 && expiryDate.getMonth() !== 1) {
            expiryDate.setDate(0);
        }
        // Expiry is 1 day before the anniversary date
        expiryDate.setDate(expiryDate.getDate() - 1);
    }

    return formatDateToISO(expiryDate);
}

/**
 * Calculate Warranty Coverage Status dynamically from dates and document status
 * Options: 'Pending Activation' | 'Active' | 'Expiring Soon' | 'Expired' | 'Cancelled'
 */
export function calculateWarrantyCoverageStatus(startDateInput, expiryDateInput, documentStatus = 'Generated') {
    if (documentStatus === 'Cancelled') {
        return 'Cancelled';
    }
    if (documentStatus === 'Suspended') {
        return 'Suspended';
    }
    
    if (!startDateInput || !expiryDateInput) {
        return 'Pending Activation';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = parseDateSafe(startDateInput);
    start.setHours(0, 0, 0, 0);

    const expiry = parseDateSafe(expiryDateInput);
    expiry.setHours(23, 59, 59, 999);

    if (today < start) {
        return 'Pending Activation';
    }

    if (today > expiry) {
        return 'Expired';
    }

    // Check if expiring within 60 days
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    if (expiry.getTime() - today.getTime() <= sixtyDaysMs) {
        return 'Expiring Soon';
    }

    return 'Active';
}

/**
 * Returns color classes and badge styles for warranty status
 */
export function getWarrantyStatusStyle(status) {
    switch (status) {
        case 'Active':
            return {
                bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
                dot: 'bg-emerald-500',
                label: 'Active Coverage',
            };
        case 'Suspended':
            return {
                bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
                dot: 'bg-purple-500',
                label: 'Suspended / On Hold',
            };
        case 'Expiring Soon':
            return {
                bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
                dot: 'bg-amber-500',
                label: 'Expiring Soon',
            };
        case 'Expired':
            return {
                bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
                dot: 'bg-rose-500',
                label: 'Warranty Expired',
            };
        case 'Pending Activation':
            return {
                bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
                dot: 'bg-blue-500',
                label: 'Pending Activation',
            };
        case 'Cancelled':
            return {
                bg: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
                dot: 'bg-slate-400',
                label: 'Cancelled / Void',
            };
        default:
            return {
                bg: 'bg-slate-50 text-slate-700 border-slate-200',
                dot: 'bg-slate-400',
                label: status || 'Unknown',
            };
    }
}

/**
 * Formats warranty duration string (e.g., "5 Years" or "6 Months")
 */
export function formatWarrantyPeriod(period, unit = 'Years') {
    if (!period) return 'No Warranty';
    const p = Number(period);
    const u = String(unit).toLowerCase();
    if (u === 'months' || u === 'month') {
        return `${p} ${p === 1 ? 'Month' : 'Months'}`;
    }
    return `${p} ${p === 1 ? 'Year' : 'Years'}`;
}
