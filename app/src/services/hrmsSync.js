/**
 * hrmsSync — the HRMS half of the API contract (api.md §11).
 *
 * HRMS is the widest module: people, leave, attendance, payroll, recruitment,
 * performance, training, policies and assets, spread over nine stores that each
 * used to seed themselves from `data/hrms/mocks/`. They all want the same four
 * verbs against different paths, so the registry below is the whole mapping and
 * `createSync` supplies the transport.
 *
 * Fields come off the wire in the shape the screens read, so most readers only
 * convert dates (`YYYY-MM-DD` on the wire, `DD/MM/YYYY` on screen) and add the
 * one or two aliases a table column expects.
 */
import { createSync, compact, asText, isBackendEnabled, isServerId, describeError } from './resourceSync';
import { api } from './api';
import { formatDateDDMMYYYY, toISODate } from '../utils/dateUtils';

export { isBackendEnabled, isServerId, describeError };

function isoOut(value) {
  if (!value) return undefined;
  return toISODate(value) || undefined;
}

function displayIn(value) {
  return value ? formatDateDDMMYYYY(value) : value;
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** Short label for a stored file ("PDF", "Image", "Word", …). */
function fileTypeLabel(contentType, fileName) {
  const type = String(contentType || '').toLowerCase();
  const ext = String(fileName || '').split('.').pop().toLowerCase();
  if (type === 'application/pdf' || ext === 'pdf') return 'PDF';
  if (type.startsWith('image/')) return 'Image';
  if (type.includes('word') || ['doc', 'docx'].includes(ext)) return 'Word';
  if (type.includes('sheet') || type.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'Excel';
  return contentType ? (ext || 'File').toUpperCase() : '';
}

/** Weekday name for a wire date (`2024-11-01` → `Friday`). Empty when unparseable. */
function weekdayName(value) {
  if (!value) return '';
  try {
    const iso = toISODate(value);
    const d = iso ? new Date(`${iso}T00:00:00`) : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  } catch {
    return '';
  }
}

/** `60 Days` / `60` → `60` for integer day-count columns. */
function parseDayCount(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const match = String(value).match(/(\d+)/);
  return match ? Number(match[1]) : fallback;
}

/** `$95,000 / annum` → `95000` for CTC columns. Undefined when unparseable. */
function parseCtc(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const digits = String(value).replace(/[^0-9.]/g, '');
  const amount = Number(digits);
  return Number.isFinite(amount) && digits !== '' ? amount : undefined;
}

/** HR screen offer statuses → API vocabulary (api.md §11.5). */
function offerStatusToServer(status) {
  if (!status) return undefined;
  if (String(status).toLowerCase() === 'pending') return 'Sent';
  return status;
}

/** `2024-11-01` + `09:30` → the ISO instant for that local wall-clock time. */
function clockToDateTime(isoDate, value) {
  if (!value) return undefined;
  if (String(value).includes('T')) return value; // already a datetime
  if (!isoDate || !/^\d{1,2}:\d{2}/.test(String(value))) return undefined;
  const d = new Date(`${isoDate}T${String(value).padStart(5, '0')}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** An ISO datetime → its local `HH:MM`. Empty when missing. */
function dateTimeToClock(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The request type the self-service forms tag onto a regularization's reason. */
function regularizationType(reason, requestedStatus) {
  const tag = String(reason || '').toLowerCase();
  if (tag.startsWith('[requirement')) return 'General Request';
  if (tag.startsWith('[early leave')) return 'Early Leave';
  if (tag.startsWith('[half day')) return 'Half Day';
  if (tag.startsWith('[work from home') || requestedStatus === 'WFH') return 'Work From Home (WFH)';
  return 'Regularization';
}

/** `8.5` → `08h 30m`; `—` when there is nothing to show. */
export function formatHours(hours) {
  const n = Number(hours);
  if (hours === null || hours === undefined || hours === '' || !Number.isFinite(n)) return '—';
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

/** An ISO instant → `09:41 AM` in the browser's own (live) clock. */
export function formatClock12(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
}

/** Today as `YYYY-MM-DD` in local time (toISOString would give the UTC day). */
export function localISODate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Pass the row through, marking it as the server's. */
const plain = (path, extra = {}) => ({
  path,
  toApi: (row) => compact({ ...row, id: undefined, _synced: undefined, _pending: undefined }),
  fromApi: (row) => ({ ...row, _synced: true }),
  ...extra,
});

/** A row whose `date`-ish fields need reformatting for the tables. */
const dated = (path, fields, extra = {}) => ({
  path,
  toApi: (row) => {
    const payload = { ...row, id: undefined, _synced: undefined, _pending: undefined };
    fields.forEach((f) => { if (payload[f] !== undefined) payload[f] = isoOut(payload[f]); });
    return compact(payload);
  },
  fromApi: (row) => {
    const out = { ...row, _synced: true };
    fields.forEach((f) => { if (out[f]) out[f] = displayIn(out[f]); });
    return out;
  },
  ...extra,
});

export const HRMS_RESOURCES = {
  // ── people ────────────────────────────────────────────────────────────────
  employees: {
    path: '/hrms/employees/',
    toApi: (e) => compact({
      name: e.name,
      email: e.email || undefined,
      phone: e.phone || undefined,
      employeeCode: e.employeeCode || e.empId || undefined,
      departmentId: e.departmentId || e.department_id || undefined,
      department: e.department || e.dept || undefined,
      designationId: e.designationId || e.designation_id || undefined,
      designation: e.designation || e.role || undefined,
      managerId: e.managerId || e.manager_id || e.reportingManagerId || undefined,
      locationId: e.locationId || e.location_id || undefined,
      location: typeof e.location === 'string' ? e.location : undefined,
      joiningDate: isoOut(e.joiningDate || e.joining || e.doj) || undefined,
      joining: isoOut(e.joiningDate || e.joining || e.doj) || undefined,
      dateOfBirth: isoOut(e.dateOfBirth || e.dob),
      gender: e.gender || undefined,
      employmentType: e.employmentType || undefined,
      status: e.status || undefined,
      avatar: e.avatar || undefined,
    }),
    fromApi: (row) => ({
      ...asText(row, [
        'name', 'email', 'phone', 'department', 'designation', 'manager',
        'employmentType', 'gender', 'location', 'status',
      ]),
      // Tables read `empId` and `role`; the API calls them `employeeCode` and
      // `designation`. The wire sends `joining` (joining_date); accept the
      // `joiningDate` alias too. `manager` is the manager's name, `managerId`
      // its id (backend) — keep `reportingManager*` aliases for older rows.
      id: row.id,
      empId: row.employeeCode || row.empId || row.id || '',
      employeeCode: row.employeeCode || '',
      role: row.designation || row.role || '',
      managerId: row.managerId || row.manager_id || row.reportingManagerId || '',
      reportingManager: row.manager || row.reportingManager || row.reporting_manager || '',
      reportingManagerId: row.managerId || row.manager_id || row.reportingManagerId || '',
      doj: displayIn(row.joiningDate || row.joining),
      joiningDate: displayIn(row.joiningDate || row.joining),
      joining: displayIn(row.joiningDate || row.joining),
      _synced: true,
    }),
  },

  departments: plain('/hrms/departments/'),
  designations: plain('/hrms/designations/'),
  // The server keeps `address` as a JSON object ({line1, city, state, ...});
  // the screens show and edit it as one line of text. Office type has no
  // column, so it rides inside the address object.
  locations: plain('/hrms/locations/', {
    toApi: (loc) => {
      const detail = loc.addressDetail && typeof loc.addressDetail === 'object' ? loc.addressDetail : {};
      const address = typeof loc.address === 'object' && loc.address !== null
        ? { ...detail, ...loc.address }
        : { ...detail, line1: loc.address || undefined };
      if (loc.type) address.type = loc.type;
      return compact({ name: loc.name, timezone: loc.timezone || undefined, address });
    },
    fromApi: (row) => {
      const detail = row.address && typeof row.address === 'object' ? row.address : {};
      const text = typeof row.address === 'string'
        ? row.address
        : ['line1', 'line2', 'city', 'state', 'pincode', 'country']
          .map((k) => detail[k])
          .filter(Boolean)
          .join(', ');
      return {
        ...row,
        address: text,
        addressDetail: detail,
        type: detail.type || 'Branch',
        timezone: row.timezone || '',
        count: num(row.employeeCount),
        _synced: true,
      };
    },
  }),
  teams: plain('/hrms/teams/'),
  holidays: {
    ...dated('/hrms/holidays/', ['date']),
    toApi: (h) => compact({
      name: h.name,
      date: isoOut(h.date),
      holidayType: h.holidayType || h.type || undefined,
      appliesTo: h.appliesTo || undefined,
      status: h.status || undefined,
      locationId: h.locationId || undefined,
    }),
    // The table reads the local keys (`day`, `type`, `appliesTo`); the
    // weekday is derived from the date, the rest pass through.
    fromApi: (row) => ({
      ...row,
      date: displayIn(row.date),
      day: weekdayName(row.date),
      type: row.holidayType || row.type || '',
      appliesTo: row.appliesTo || '',
      status: row.status || 'Upcoming',
      _synced: true,
    }),
  },

  // ── leave ─────────────────────────────────────────────────────────────────
  leaves: {
    path: '/hrms/leave/',
    toApi: (l) => compact({
      employeeId: l.employeeId || undefined,
      leaveTypeId: isServerId(l.leaveTypeId) ? l.leaveTypeId : undefined,
      // Lets the server resolve (or set up) the type when no id is known.
      leaveTypeName: l.leaveTypeName || (isServerId(l.leaveTypeId) ? undefined : l.type) || undefined,
      fromDate: isoOut(l.fromDate || l.from),
      toDate: isoOut(l.toDate || l.to),
      days: l.days !== undefined ? num(l.days) : undefined,
      reason: l.reason || undefined,
      status: l.status || undefined,
      delegateId: isServerId(l.delegateId) ? l.delegateId : undefined,
      remark: l.remark || l.rejectReason || undefined,
    }),
    fromApi: (row) => ({
      ...asText(row, ['reason', 'status', 'type', 'employeeName', 'delegate']),
      from: displayIn(row.fromDate),
      to: displayIn(row.toDate),
      fromDate: displayIn(row.fromDate),
      toDate: displayIn(row.toDate),
      employee: row.employeeName || row.employee || '',
      _synced: true,
    }),
  },
  leaveTypes: plain('/hrms/leave/types/'),
  leaveEncashments: dated('/hrms/leave/encashments/', ['requestDate']),
  compOffs: dated('/hrms/comp-offs/', ['workedDate', 'expiryDate']),

  // ── attendance ────────────────────────────────────────────────────────────
  attendance: {
    path: '/hrms/attendance/',
    toApi: (a) => compact({
      employeeId: a.employeeId || undefined,
      date: isoOut(a.date),
      checkIn: a.checkIn || undefined,
      checkOut: a.checkOut || undefined,
      status: a.status || undefined,
      workLocation: a.workLocation || undefined,
      notes: a.notes || undefined,
    }),
    fromApi: (row) => ({
      ...asText(row, ['status', 'workLocation', 'notes', 'employeeName']),
      isoDate: row.date || '',
      date: displayIn(row.date),
      employee: row.employeeName || row.employee || '',
      name: row.employeeName || row.employee || '',
      empCode: row.employeeCode || '',
      dept: row.department || '',
      checkInAt: row.checkIn || null,
      checkOutAt: row.checkOut || null,
      checkIn: dateTimeToClock(row.checkIn),
      checkOut: dateTimeToClock(row.checkOut),
      workHours: formatHours(row.hours),
      _synced: true,
    }),
  },
  // The request screens keep clock times (`09:30`) beside the date; the API
  // wants full datetimes, and has no `type` column — the self-service forms
  // tag the reason instead (`[Work From Home] …`), so the type is read back
  // from that tag.
  attendanceRegularizations: {
    path: '/hrms/attendance/regularizations/',
    toApi: (r) => {
      const date = isoOut(r.date);
      return compact({
        employeeId: isServerId(r.employeeId) ? r.employeeId : undefined,
        date,
        requestedCheckIn: clockToDateTime(date, r.requestedCheckIn || r.requestedIn || r.reqIn),
        requestedCheckOut: clockToDateTime(date, r.requestedCheckOut || r.requestedOut || r.reqOut),
        requestedStatus: r.requestedStatus || undefined,
        reason: r.reason || undefined,
        status: r.status || undefined,
        remark: r.remark || r.rejectReason || undefined,
      });
    },
    fromApi: (row) => {
      const reqIn = dateTimeToClock(row.requestedCheckIn);
      const reqOut = dateTimeToClock(row.requestedCheckOut);
      return {
        ...row,
        employee: row.employeeName || '',
        requestedBy: row.employeeName || '',
        type: regularizationType(row.reason, row.requestedStatus),
        date: displayIn(row.date),
        reqIn,
        reqOut,
        requestedIn: reqIn,
        requestedOut: reqOut,
        submitted: displayIn(String(row.createdAt || '').slice(0, 10)),
        _synced: true,
      };
    },
  },

  // ── payroll ───────────────────────────────────────────────────────────────
  payroll: {
    path: '/hrms/payroll/',
    toApi: (p) => compact({
      additionalEarnings: p.additionalEarnings !== undefined ? num(p.additionalEarnings) : undefined,
      deductions: p.deductions !== undefined ? num(p.deductions) : undefined,
      advance: p.advance !== undefined ? num(p.advance) : undefined,
      earnedSalary: p.earnedSalaryOverride !== undefined ? num(p.earnedSalaryOverride) : undefined,
    }),
    fromApi: (row) => ({
      ...row,
      standardSalary: num(row.standardSalary),
      earnedSalary: num(row.earnedSalary),
      additionalEarnings: num(row.additionalEarnings),
      deductions: num(row.deductions),
      advance: num(row.advance),
      netPayable: num(row.netPayable),
      paidAmount: row.paidAmount != null ? num(row.paidAmount) : row.paidAmount,
      attendedDays: num(row.attendedDays),
      paidLeaves: num(row.paidLeaves),
      totalDays: num(row.totalDays, 24),
      unpaidLeaves: num(row.attendance?.unpaidLeave),
      absentDays: num(row.breakdown?.absentDays),
      attendanceDeduction: num(row.breakdown?.attendanceDeduction),
      perDaySalary: num(row.breakdown?.perDaySalary),
      period: String(row.month || '').slice(0, 7),
      _synced: true,
    }),
    // Payslips are generated, not created by hand.
    omitOnUpdate: ['employeeId', 'month', 'year'],
  },
  salaryStructures: plain('/hrms/payroll/salary-structures/'),
  advances: dated('/hrms/payroll/advances/', ['requestDate', 'date']),

  // ── recruitment ───────────────────────────────────────────────────────────
  jobs: dated('/hrms/jobs/', ['postedDate', 'closingDate']),
  candidates: dated('/hrms/candidates/', ['appliedDate']),
  applications: dated('/hrms/applications/', ['appliedDate']),
  interviews: dated('/hrms/interviews/', ['scheduledDate', 'date']),
  offers: {
    ...dated('/hrms/offers/', ['offerDate', 'joiningDate', 'expiryDate']),
    // The letter form reads flat keys (`position`, `salary`, `dept` …);
    // the API keeps the same columns plus the application link.
    toApi: (o) => compact({
      applicationId: o.applicationId || undefined,
      offeredCtc: o.offeredCtc !== undefined ? num(o.offeredCtc) : parseCtc(o.salary),
      joiningDate: isoOut(o.joiningDate),
      expiryDate: isoOut(o.expiryDate),
      status: offerStatusToServer(o.status),
      position: o.position || undefined,
      department: o.department || o.dept || undefined,
      jobType: o.jobType || o.job_type || undefined,
      location: o.location || undefined,
      workMode: o.workMode || o.work_mode || undefined,
      reportingManager: o.reportingManager || o.reporting_manager || undefined,
      probationPeriod: o.probationPeriod || o.probation_period || undefined,
      notes: o.notes || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      joiningDate: displayIn(row.joiningDate),
      expiryDate: displayIn(row.expiryDate),
      dept: row.department || row.dept || '',
      jobType: row.jobType || row.job_type || 'Full-time',
      workMode: row.workMode || row.work_mode || '',
      reportingManager: row.reportingManager || row.reporting_manager || '',
      probationPeriod: row.probationPeriod || row.probation_period || '',
      salary: row.salary || (row.offeredCtc != null ? `${Number(row.offeredCtc).toLocaleString('en-IN')} / annum` : ''),
      _synced: true,
    }),
  },
  onboarding: dated('/hrms/onboarding/', ['startDate']),
  recruitmentQuestions: plain('/hrms/recruitment/questions/'),

  // ── performance ───────────────────────────────────────────────────────────
  appraisals: dated('/hrms/performance/appraisals/', ['dueDate', 'completedDate']),
  cycles: dated('/hrms/performance/cycles/', ['startDate', 'endDate']),
  goals: dated('/hrms/performance/goals/', ['dueDate']),
  indicators: plain('/hrms/performance/indicators/'),
  kpis: plain('/hrms/performance/kpis/'),

  // ── training ──────────────────────────────────────────────────────────────
  // trainings: dated('/hrms/trainings/', ['startDate', 'endDate']),
  // trainers: plain('/hrms/trainers/'),

  // ── policies ──────────────────────────────────────────────────────────────
  policies: dated('/hrms/policies/', ['effectiveDate', 'publishedDate']),
  policyCategories: plain('/hrms/policy-categories/'),

  assets: {
    path: '/hrms/assets/',
    toApi: (a) => compact({
      name: a.name,
      categoryId: isServerId(a.categoryId) ? a.categoryId : undefined,
      categoryName: !isServerId(a.categoryId) && a.category ? a.category : undefined,
      employeeId: isServerId(a.employeeId) ? a.employeeId : undefined,
      serialNumber: a.serialNumber || undefined,
      condition: a.condition || undefined,
      status: a.status || undefined,
      location: a.location || undefined,
      notes: a.notes || undefined,
      purchaseDate: isoOut(a.purchaseDate),
      warrantyExpiry: isoOut(a.warrantyExpiry),
      purchaseCost: (a.purchaseCost != null && a.purchaseCost !== '—' && !isNaN(Number(String(a.purchaseCost).replace(/[^0-9.-]+/g, ''))))
        ? Number(String(a.purchaseCost).replace(/[^0-9.-]+/g, ''))
        : null,
    }),
    fromApi: (row) => ({
      ...row,
      displayId: row.assetCode || row.id,
      category: row.category || 'Uncategorised',
      assignedTo: row.assignedTo || '',
      dept: row.dept || '',
      purchaseDate: displayIn(row.purchaseDate),
      warrantyExpiry: displayIn(row.warrantyExpiry),
      _synced: true,
    }),
    // Assignment goes through its own action, which writes the history row.
    omitOnUpdate: ['employeeId'],
  },
  assetCategories: plain('/hrms/asset-categories/'),
  assetRequests: {
    path: '/hrms/asset-requests/',
    toApi: (r) => compact({
      employeeId: isServerId(r.employeeId) ? r.employeeId : undefined,
      requestType: r.requestType || (r.requestedAssetId ? 'Inventory' : 'Other'),
      requestedAssetId: isServerId(r.requestedAssetId) ? r.requestedAssetId : undefined,
      itemName: r.itemName || r.assetName || undefined,
      categoryId: isServerId(r.categoryId) ? r.categoryId : undefined,
      categoryName: !isServerId(r.categoryId) ? (r.categoryName || r.category || undefined) : undefined,
      priority: r.priority || undefined,
      justification: r.justification || r.reason || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      assetName: row.requestType === 'Inventory'
        ? (row.requestedAsset || row.itemName || '')
        : (row.itemName || ''),
      reason: row.justification || '',
      category: row.category || '',
      dept: row.dept || '',
      requestedDate: displayIn(row.requestedDate),
      allocatedAssetId: row.fulfilledAssetCode || row.fulfilledAssetId || null,
      _synced: true,
    }),
  },

  // ── employee lifecycle ────────────────────────────────────────────────────
  resignations: {
    ...dated('/hrms/resignations/', ['lastWorkingDay']),
    toApi: (r) => compact({
      employeeId: r.employeeId || undefined,
      submittedOn: isoOut(r.submittedDate || r.submittedOn),
      noticePeriodDays: parseDayCount(r.noticePeriod ?? r.noticePeriodDays, 30),
      lastWorkingDay: isoOut(r.lastWorkingDay),
      handoverTo: r.handoverTo || undefined,
      reason: r.reason || undefined,
      status: r.status || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      employee: row.employeeName || row.employee || '',
      submittedDate: displayIn(row.submittedOn),
      noticePeriod: row.noticePeriodDays != null ? `${row.noticePeriodDays} Days` : (row.noticePeriod || ''),
      _synced: true,
    }),
  },
  terminations: dated('/hrms/terminations/', ['terminationDate']),
  complaints: dated('/hrms/complaints/', ['raisedDate']),
  // The file itself is uploaded through /files/ (see stores/documentStore);
  // the document row only carries its `fileId`. Status is derived on the
  // server from the expiry date, so it is never sent.
  documents: {
    path: '/hrms/documents/',
    toApi: (doc) => {
      const version = parseInt(String(doc.version ?? '').replace(/^v/i, ''), 10);
      const expiry = doc.expiry && doc.expiry !== '—' ? isoOut(doc.expiry) : null;
      return compact({
        title: doc.title,
        category: doc.category,
        // "All Staff" (company-wide) is a document with no employee.
        employeeId: doc.employeeId === undefined ? undefined : (isServerId(doc.employeeId) ? doc.employeeId : null),
        version: Number.isFinite(version) ? version : undefined,
        expiry: doc.expiry === undefined ? undefined : expiry,
        fileId: isServerId(doc.fileId) ? doc.fileId : undefined,
        tags: Array.isArray(doc.tags) ? doc.tags : undefined,
        description: doc.description,
      });
    },
    fromApi: (row) => ({
      ...row,
      employee: row.employee || 'All Staff',
      employeeId: row.employeeId || null,
      version: `v${row.version || 1}.0`,
      expiry: row.expiry ? displayIn(row.expiry) : '—',
      expiryIso: row.expiry || '',
      contentType: row.fileType || '',
      fileType: fileTypeLabel(row.fileType, row.fileName),
      fileSize: row.fileSize ? formatBytes(row.fileSize) : '',
      fileSizeBytes: row.fileSize || 0,
      hasFile: Boolean(row.fileId),
      updatedOn: row.updatedOn ? displayIn(String(row.updatedOn).slice(0, 10)) : '',
      _synced: true,
    }),
  },
  approvalChains: plain('/hrms/approval-chains/'),
  calendarEvents: dated('/hrms/calendar/events/', ['startDate', 'endDate', 'date']),

  // ── textile HR operational resources (Oscar Scope) ───────────────────────
  incentives: {
    path: '/hrms/incentives/',
    toApi: (inc) => compact({
      employeeId: inc.employeeId || inc.employee || undefined,
      scheme: inc.scheme || inc.schemeId || undefined,
      periodType: inc.periodType || inc.period_type || undefined,
      periodName: inc.periodName || inc.period_name || undefined,
      startDate: isoOut(inc.startDate || inc.start_date),
      endDate: isoOut(inc.endDate || inc.end_date),
      grossSales: inc.grossSales !== undefined ? num(inc.grossSales) : undefined,
      returnsDeduction: inc.returnsDeduction !== undefined ? num(inc.returnsDeduction) : undefined,
      netEligibleSales: inc.netEligibleSales !== undefined ? num(inc.netEligibleSales) : undefined,
      applicableRate: inc.applicableRate !== undefined ? num(inc.applicableRate) : undefined,
      calculatedIncentive: inc.calculatedIncentive !== undefined ? num(inc.calculatedIncentive) : undefined,
      status: inc.status || undefined,
      holdReason: inc.holdReason || inc.hold_reason || undefined,
      notes: inc.notes || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      startDate: displayIn(row.startDate || row.start_date),
      endDate: displayIn(row.endDate || row.end_date),
      grossSales: num(row.grossSales ?? row.gross_sales),
      returnsDeduction: num(row.returnsDeduction ?? row.returns_deduction),
      netEligibleSales: num(row.netEligibleSales ?? row.net_eligible_sales),
      applicableRate: num(row.applicableRate ?? row.applicable_rate),
      calculatedIncentive: num(row.calculatedIncentive ?? row.calculated_incentive),
      _synced: true,
    }),
  },
  incentiveSchemes: plain('/hrms/incentive-schemes/'),
  brokerCommissions: {
    path: '/hrms/broker-commissions/',
    toApi: (bc) => compact({
      broker: bc.broker || bc.brokerId || undefined,
      invoice: bc.invoice || bc.invoiceId || undefined,
      party: bc.party || bc.partyId || undefined,
      salesperson: bc.salesperson || bc.salespersonId || undefined,
      invoiceDate: isoOut(bc.invoiceDate || bc.invoice_date),
      invoiceAmount: bc.invoiceAmount !== undefined ? num(bc.invoiceAmount) : undefined,
      commissionBasis: bc.commissionBasis || bc.commission_basis || undefined,
      commissionType: bc.commissionType || bc.commission_type || undefined,
      rate: bc.rate !== undefined ? num(bc.rate) : undefined,
      commissionAmount: bc.commissionAmount !== undefined ? num(bc.commissionAmount) : undefined,
      paidAmount: bc.paidAmount !== undefined ? num(bc.paidAmount) : undefined,
      status: bc.status || undefined,
      notes: bc.notes || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      invoiceDate: displayIn(row.invoiceDate || row.invoice_date),
      invoiceAmount: num(row.invoiceAmount ?? row.invoice_amount),
      commissionAmount: num(row.commissionAmount ?? row.commission_amount),
      paidAmount: num(row.paidAmount ?? row.paid_amount),
      _synced: true,
    }),
  },
};

export const hrmsSync = createSync(HRMS_RESOURCES, { label: 'hrmsSync' });

/** What the HRMS shell loads on sign-in. The rest load per screen. */
export const HRMS_CORE_KEYS = [
  'employees', 'departments', 'designations', 'locations', 'teams', 'holidays',
  'leaves', 'leaveTypes', 'attendance', 'payroll',
];

/** The wider set, for screens that need their own collection. */
export const HRMS_EXTRA_KEYS = Object.keys(HRMS_RESOURCES)
  .filter((key) => !HRMS_CORE_KEYS.includes(key));

// ── singletons and aggregates ───────────────────────────────────────────────

async function read(path, query, label) {
  if (!isBackendEnabled()) return null;
  try {
    return await api.get(path, query ? { query } : undefined);
  } catch (err) {
    console.warn(`[hrmsSync] ${label} failed:`, err?.message || err);
    return null;
  }
}

export const pullHrmsSettings = () => read('/hrms/settings/', null, 'settings');
export const pullWorkingDays = () => read('/hrms/working-days/', null, 'working days');
export const pullFlexibility = () => read('/hrms/attendance/flexibility/', null, 'flexibility');
export const pullAttendanceSummary = (query) => read('/hrms/attendance/summary/', query, 'attendance summary');
export const pullAttendanceAudit = (query) => read('/hrms/attendance/audit/', query, 'attendance audit');
export const pullLeaveBalances = (query) => read('/hrms/leave/balances/', query, 'leave balances');
export const pullOrgChart = () => read('/hrms/org-chart/', null, 'org chart');
export const pullHrmsDashboard = (query) => read('/hrms/dashboard/', query, 'dashboard');
export const pullPayrollSummary = (query) => read('/hrms/payroll/summary/', query, 'payroll summary');
export const pullRecruitmentDashboard = () => read('/hrms/recruitment/dashboard/', null, 'recruitment dashboard');
export const pullRecruitmentFunnel = () => read('/hrms/recruitment/funnel/', null, 'recruitment funnel');
// export const pullTrainingDashboard = () => read('/hrms/trainings/dashboard/', null, 'training dashboard');
export const pullTrainingDashboard = () => Promise.resolve({ data: {} });
// export const pullTrainingFunnel = () => read('/hrms/trainings/funnel/', null, 'training funnel');
export const pullTrainingFunnel = () => Promise.resolve({ data: {} });
export const pullPerformanceDashboard = () => read('/hrms/performance/dashboard/', null, 'performance dashboard');
export const pullIndividualAttendance = (employeeId, query) =>
  read(`/hrms/attendance/individual/${employeeId}/`, query, 'individual attendance');
/** `{date, summary, results: [one row per employee]}` for the register screens. */
export const pullDailyAttendance = (date, query = {}) =>
  read('/hrms/attendance/daily/', { date, ...query }, 'daily attendance');
/** One employee's month: `{employee, month, days[], summary}`. */
export const pullMonthlyAttendance = (employeeId, month) =>
  read(`/hrms/attendance/individual/${employeeId}/`, { month }, 'monthly attendance');
/** Leave cards for one employee (the caller's own when no id is given). */
export const pullLeaveBalanceSummary = (employeeId, year) =>
  read('/hrms/leave/balances/summary/', compact({ employeeId: employeeId || undefined, year }), 'leave balance summary');
/** Stock any employee may request (Available units only). */
export const pullAvailableAssets = () => read('/hrms/assets/available/', null, 'available assets');
/** Assets the signed-in employee currently holds. */
export const pullMyAssets = () => read('/hrms/assets/mine/', null, 'my assets');

/** Write a day's register: `{date, records: [{employeeId, status, checkIn, checkOut, remark}]}`. */
export async function saveAttendanceDay(date, records) {
  if (!isBackendEnabled()) return null;
  return api.post('/hrms/attendance/bulk/', { date, records });
}

/** Un-mark a day for some employees (rows posted by an approved leave are kept). */
export async function clearAttendanceDay(date, employeeIds) {
  if (!isBackendEnabled()) return null;
  return api.post('/hrms/attendance/clear/', { date, employeeIds });
}

export async function pushHrmsSettings(settings) {
  if (!isBackendEnabled()) return null;
  return api.put('/hrms/settings/', settings);
}

export async function pushWorkingDays(config) {
  if (!isBackendEnabled()) return null;
  return api.put('/hrms/working-days/', config);
}

export async function pushFlexibility(config) {
  if (!isBackendEnabled()) return null;
  return api.put('/hrms/attendance/flexibility/', config);
}

export async function bulkAttendance(rows, date) {
  if (!isBackendEnabled()) return null;
  return api.post('/hrms/attendance/bulk/', compact({ date, records: rows }));
}

// ── record actions ──────────────────────────────────────────────────────────

export const approvePayroll = (id) => hrmsSync.act('payroll', id, 'approve', {});
export const markPayrollPaid = (id, payload = {}) => hrmsSync.act('payroll', id, 'mark-paid', payload);
export const cancelLeave = (id, payload = {}) => hrmsSync.act('leaves', id, 'cancel', payload);
export const publishJob = (id) => hrmsSync.act('jobs', id, 'publish', {});
export const assignAsset = (id, payload) => hrmsSync.act('assets', id, 'assign', payload);
export const returnAsset = (id, payload = {}) => hrmsSync.act('assets', id, 'return', payload);
export const acknowledgePolicy = (id, payload = {}) => hrmsSync.act('policies', id, 'acknowledge', payload);
export const approvePolicy = (id, payload = {}) => hrmsSync.act('policies', id, 'approve', payload);
export const archivePolicy = (id, payload = {}) => hrmsSync.act('policies', id, 'archive', payload);
export const submitPolicyForApproval = (id, payload = {}) =>
  hrmsSync.act('policies', id, 'submit-for-approval', payload);
export const terminateEmployee = (id, payload) => hrmsSync.act('employees', id, 'terminate', payload);
export const approveAssetRequest = (id, payload = {}) => hrmsSync.act('assetRequests', id, 'approve', payload);
export const rejectAssetRequest = (id, payload = {}) => hrmsSync.act('assetRequests', id, 'reject', payload);
export const fulfillAssetRequest = (id, payload) => hrmsSync.act('assetRequests', id, 'fulfill', payload);
export const cancelAssetRequest = (id) => hrmsSync.act('assetRequests', id, 'cancel', {});
export const approveRegularization = (id, payload = {}) =>
  hrmsSync.act('attendanceRegularizations', id, 'approve', payload);
export const rejectRegularization = (id, payload = {}) =>
  hrmsSync.act('attendanceRegularizations', id, 'reject', payload);
// export const assignTrainer = (id, payload) => hrmsSync.act('trainings', id, 'assign-trainer', payload);
// export const evaluateTraining = (id, payload) => hrmsSync.act('trainings', id, 'evaluate', payload);
// export const addTrainingParticipants = (id, payload) => hrmsSync.act('trainings', id, 'participants', payload);

/**
 * The last rows the server gave us, per collection.
 *
 * `writeThrough` diffs against this rather than asking its caller for the
 * previous array, which is what lets the stores keep their existing actions:
 * they hand over the collection as they now want it and this works out which
 * rows are new, changed or gone.
 */
const snapshots = new Map();

/** Load a collection and remember it as the baseline for later writes. */
export async function pullTracked(key, query) {
  const rows = await hrmsSync.pull(key, query);
  if (rows) snapshots.set(key, rows);
  return rows;
}

/**
 * Write a whole collection back after a store mutated it locally.
 *
 * The HRMS stores each kept their rows in `localStorage` and saved the array
 * wholesale. Rather than rewrite every one of their actions, they now hand the
 * new array here: rows the server has not seen are created, rows that changed
 * are patched, rows that disappeared are deleted, and the fresh collection
 * becomes the next baseline.
 */
export function writeThrough(key, next = []) {
  if (!isBackendEnabled()) return Promise.resolve(next);

  const previous = snapshots.get(key) || [];
  const before = new Map(previous.map((row) => [String(row?.id), row]));
  const after = new Set(next.map((row) => String(row?.id)));
  const work = [];

  next.forEach((row) => {
    if (!row) return;
    const existing = before.get(String(row.id));
    if (!existing) {
      work.push(hrmsSync.create(key, row));
    } else if (isServerId(row.id) && JSON.stringify(existing) !== JSON.stringify(row)) {
      work.push(hrmsSync.update(key, row.id, row));
    }
  });

  previous.forEach((row) => {
    if (row && !after.has(String(row.id)) && isServerId(row.id)) {
      work.push(hrmsSync.remove(key, row.id));
    }
  });

  if (work.length === 0) {
    snapshots.set(key, next);
    return Promise.resolve(next);
  }

  return Promise.all(work)
    .then(() => pullTracked(key))
    .then((rows) => rows || next)
    .catch((err) => {
      console.warn(`[hrmsSync] ${key} not saved:`, describeError(err));
      return next;
    });
}

/** One employee's payslip history, for the "My Salary" tab. */
export async function pullPayrollFor(employeeId) {
  if (!employeeId) return null;
  return hrmsSync.pull('payroll', { employeeId });
}

export async function processPayroll(payload) {
  if (!isBackendEnabled()) return null;
  return api.post('/hrms/payroll/process/', payload);
}

/** One month's payslips (`period` = `YYYY-MM`). */
export const pullPayrollPeriod = (period) => pullTracked('payroll', period ? { period } : undefined);


// ── Textile Operational HR Actions & Data Fetchers (Oscar Scope) ────────────
export const calculateQuarterlyIncentive = (payload) => api.post('/hrms/incentives/calculate-quarterly/', payload);
export const holdIncentivePayout = (id, reason) => api.post(`/hrms/incentives/${id}/hold/`, { reason });
export const releaseIncentivePayout = (id) => api.post(`/hrms/incentives/${id}/release/`, {});
export const approveIncentivePayout = (id) => api.post(`/hrms/incentives/${id}/approve/`, {});
export const markIncentivePaid = (id) => api.post(`/hrms/incentives/${id}/mark-paid/`, {});
export const createIncentiveScheme = (data) => api.post('/hrms/incentive-schemes/', data);
export const updateIncentiveScheme = (id, data) => api.patch(`/hrms/incentive-schemes/${id}/`, data);

export const approveBrokerCommission = (id) => api.post(`/hrms/broker-commissions/${id}/approve/`, {});
export const markBrokerCommissionPayable = (id) => api.post(`/hrms/broker-commissions/${id}/mark-payable/`, {});
export const markBrokerCommissionPaid = (id) => api.post(`/hrms/broker-commissions/${id}/mark-paid/`, {});
export const holdBrokerCommission = (id) => api.post(`/hrms/broker-commissions/${id}/hold/`, {});

// =============================================================================
// COMMENTED OUT PER OSCAR SCOPE (Kept for reference, do not delete):
// =============================================================================
// export const recordPunch = (payload) => writeThrough('attendance/punch/', payload);
// export const pullTodayPunch = () => read('/hrms/attendance/today/');
// export const submitPunchCorrection = (payload) => writeThrough('attendance/correct-punch/', payload);
// export const sendOfferLetter = (offerId) => writeThrough(`/hrms/offers/${offerId}/send/`);
// export const acceptOfferLetter = (offerId) => writeThrough(`/hrms/offers/${offerId}/accept/`);
// export const hireCandidate = (candidateId) => writeThrough(`/hrms/candidates/${candidateId}/hire/`);
// export const pullMeetings = () => read('/hrms/meetings/');


/** Get current user / employee punch state today. */
export async function pullTodayPunch(employeeId = null) {
  if (!isBackendEnabled()) return null;
  return api.get('/hrms/attendance/today/', employeeId ? { query: { employeeId } } : undefined);
}

/** Record a Punch In or Punch Out event. */
export async function recordPunch({
  punchType,
  remark,
  notes,
  employeeId,
  source = 'web',
  earlyReason,
  requestRegularization,
}) {
  if (!isBackendEnabled()) return null;
  return api.post('/hrms/attendance/punch/', {
    punchType,
    remark: remark || notes,
    source,
    employeeId: employeeId || undefined,
    earlyReason: earlyReason || undefined,
    requestRegularization: Boolean(requestRegularization),
  });
}

/** Get punch timeline for a given employee and date. */
export async function pullPunchTimeline(employeeId, date) {
  if (!isBackendEnabled()) return [];
  return api.get('/hrms/attendance/punch-timeline/', {
    query: compact({ employeeId: employeeId || undefined, date: isoOut(date) || date }),
  });
}

export default hrmsSync;


