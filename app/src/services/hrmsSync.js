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
import { scaleForScore } from './performanceScales';

export { isBackendEnabled, isServerId, describeError };

const snapshots = new Map();

export function setSnapshot(key, rows) {
  if (rows) snapshots.set(key, rows);
}

let entityGetters = {};
export function registerEntityGetters(getters) {
  entityGetters = { ...entityGetters, ...getters };
}

function getCachedEmployees() {
  const snap = snapshots.get('employees');
  if (Array.isArray(snap) && snap.length > 0) return snap;
  if (entityGetters.getEmployees) {
    try {
      const list = entityGetters.getEmployees();
      if (Array.isArray(list) && list.length > 0) return list;
    } catch {}
  }
  return [];
}

function getCachedCycles() {
  const snap = snapshots.get('cycles');
  if (Array.isArray(snap) && snap.length > 0) return snap;
  if (entityGetters.getCycles) {
    try {
      const list = entityGetters.getCycles();
      if (Array.isArray(list) && list.length > 0) return list;
    } catch {}
  }
  return [];
}

function isoOut(value) {
  if (!value) return undefined;
  return toISODate(value) || undefined;
}

function displayIn(value) {
  return value ? formatDateDDMMYYYY(value) : value;
}

const isoIn = displayIn;

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
    // Also the PATCH body, so a key is sent only when the caller set it: a
    // status change must not reset the joining date or re-offer a login.
    // (The server defaults the joining date to today on create.)
    toApi: (e) => {
      const joinIso = isoOut(e.joining || e.joiningDate || e.doj);
      return compact({
        name: e.name,
        email: e.email || undefined,
        phone: e.phone || undefined,
        employeeCode: e.employeeCode || e.empId || undefined,
        departmentId: e.departmentId || undefined,
        department: e.department || undefined,
        designationId: e.designationId || undefined,
        designation: e.designation || e.role || undefined,
        // null clears the reporting manager; absent leaves it alone.
        managerId: e.managerId !== undefined ? (e.managerId || null) : (e.reportingManagerId || undefined),
        locationId: e.locationId || undefined,
        location: e.location || undefined,
        joining: joinIso,
        joiningDate: joinIso,
        dateOfBirth: isoOut(e.dateOfBirth || e.dob),
        gender: e.gender || undefined,
        employmentType: e.employmentType || undefined,
        status: e.status || undefined,
        avatar: e.avatar || undefined,
        createUserAccount: e.createUserAccount,
        password: e.password || undefined,
        userPassword: e.userPassword || e.password || undefined,
        roleId: e.roleId || undefined,
        probationStartDate: isoOut(e.probationStartDate),
        probationPeriod: e.probationPeriod || undefined,
        probationEndDate: isoOut(e.probationEndDate),
        confirmationStatus: e.confirmationStatus || undefined,
        confirmationDate: isoOut(e.confirmationDate),
        confirmationRemarks: e.confirmationRemarks || undefined,
        noticePeriod: e.noticePeriod || undefined,
        noticePeriodDays: e.noticePeriodDays !== undefined ? num(e.noticePeriodDays) : undefined,
        standardSalary: e.standardSalary !== undefined ? num(e.standardSalary) : (e.salary !== undefined ? num(e.salary) : undefined),
        basicSalary: e.basicSalary !== undefined ? num(e.basicSalary) : undefined,
        salary: e.salary !== undefined ? num(e.salary) : (e.standardSalary !== undefined ? num(e.standardSalary) : undefined),
        ctc: e.ctc !== undefined ? num(e.ctc) : (e.standardSalary !== undefined ? num(e.standardSalary) : undefined),
        position: e.position || e.designation || undefined,
      });
    },
    fromApi: (row) => {
      const joinDisplay = displayIn(row.joining || row.joiningDate);
      return {
        ...row,
        ...asText(row, [
          'name', 'email', 'phone', 'department', 'designation',
          'employmentType', 'gender', 'location', 'status', 'position',
        ]),
        // Tables read `empId` and `role`; the API calls them `employeeCode` and
        // `designation`.
        empId: row.employeeCode || row.empId || '',
        employeeCode: row.employeeCode || row.empId || '',
        role: row.designation || row.role || '',
        position: row.position || row.designation || row.role || '',
        standardSalary: row.standardSalary !== undefined ? num(row.standardSalary) : (row.salary !== undefined ? num(row.salary) : 0),
        salary: row.salary !== undefined ? num(row.salary) : (row.standardSalary !== undefined ? num(row.standardSalary) : 0),
        basicSalary: row.basicSalary !== undefined ? num(row.basicSalary) : 0,
        ctc: row.ctc !== undefined ? num(row.ctc) : (row.standardSalary !== undefined ? num(row.standardSalary) : 0),
        joining: joinDisplay,
        doj: joinDisplay,
        joiningDate: joinDisplay,
        probationStartDate: displayIn(row.probationStartDate),
        probationEndDate: displayIn(row.probationEndDate),
        confirmationDate: displayIn(row.confirmationDate),
        probationPeriod: row.probationPeriod || '',
        confirmationStatus: row.confirmationStatus || 'On Probation',
        confirmationRemarks: row.confirmationRemarks || '',
        probationHistory: Array.isArray(row.probationHistory) ? row.probationHistory : [],
        noticePeriod: row.noticePeriod || '',
        noticePeriodDays: row.noticePeriodDays || 60,
        _synced: true,
      };
    },
  },

  // ── organization ──────────────────────────────────────────────────────────
  // The Organization section's units. Each body carries only the keys the
  // caller set (so it doubles as a partial PATCH); counts, head name and
  // department name are read-only and never sent.
  departments: {
    path: '/hrms/departments/',
    toApi: (d) => compact({
      name: d.name?.trim() || undefined,
      code: d.code ?? undefined,
      headEmployeeId: d.headEmployeeId !== undefined ? (d.headEmployeeId || null) : undefined,
      parentId: d.parentId !== undefined ? (d.parentId || null) : undefined,
      budget: d.budget !== undefined ? (d.budget === '' || d.budget === null ? null : num(d.budget)) : undefined,
      status: d.status || undefined,
      description: d.description ?? undefined,
    }),
    fromApi: (row) => ({
      ...row,
      name: row.name || '',
      head: row.head || '',
      employees: row.employees ?? 0,
      teams: row.teams ?? 0,
      openRoles: row.openRoles ?? 0,
      _synced: true,
    }),
  },
  // The screens say "title" and "L4"; the API stores `name` and 4.
  designations: {
    path: '/hrms/designations/',
    toApi: (d) => {
      const level = d.level === undefined ? undefined : Number(String(d.level).replace(/^L/i, ''));
      return compact({
        name: (d.name ?? d.title)?.trim() || undefined,
        level: level === undefined ? undefined : (Number.isFinite(level) ? level : null),
        departmentId: d.departmentId !== undefined ? (d.departmentId || null) : undefined,
      });
    },
    fromApi: (row) => ({
      ...row,
      title: row.name || '',
      level: row.level ? `L${row.level}` : '',
      department: row.department || '',
      employees: row.employees ?? 0,
      _synced: true,
    }),
  },
  locations: {
    path: '/hrms/locations/',
    toApi: (l) => compact({
      name: l.name?.trim() || undefined,
      type: l.type || undefined,
      address: typeof l.address === 'string' ? l.address : (l.address ?? undefined),
      timezone: l.timezone ?? undefined,
    }),
    fromApi: (row) => {
      let addrStr = '';
      if (typeof row.address === 'string') {
        addrStr = row.address;
      } else if (row.address && typeof row.address === 'object') {
        const parts = [row.address.line, row.address.line1, row.address.line2, row.address.city, row.address.state, row.address.pincode, row.address.country].filter(Boolean);
        addrStr = parts.length > 0 ? parts.join(', ') : Object.values(row.address).filter((v) => typeof v === 'string' && v.trim()).join(', ');
      }
      return {
        ...row,
        name: row.name || '',
        type: row.type || 'Branch',
        address: addrStr,
        timezone: row.timezone || 'Asia/Kolkata',
        count: row.employeeCount ?? row.employees ?? 0,
        employees: row.employeeCount ?? row.employees ?? 0,
        _synced: true,
      };
    },
  },
  teams: {
    path: '/hrms/teams/',
    toApi: (team) => {
      const memberIds = Array.isArray(team.memberIds)
        ? team.memberIds
        : Array.isArray(team.members)
          ? team.members
          : undefined;
      const headcount = !Array.isArray(team.members) && (typeof team.members === 'number' || !isNaN(Number(team.members)))
        ? Number(team.members)
        : (memberIds ? memberIds.length : undefined);
      return compact({
        code: team.code || team.teamCode || undefined,
        name: team.name,
        department: team.dept || team.department || undefined,
        departmentId: team.departmentId || team.deptId || undefined,
        dept: team.dept || team.department || undefined,
        lead: team.leadId || team.lead || undefined,
        leadId: team.leadId || undefined,
        leadName: team.leadName || (typeof team.lead === 'string' ? team.lead : undefined),
        approver: team.approverId || team.approver || undefined,
        approverId: team.approverId || undefined,
        approverName: team.approverName || (typeof team.approver === 'string' ? team.approver : undefined),
        memberIds: memberIds,
        members: memberIds || headcount,
        headcount: headcount,
        description: team.description || undefined,
        status: team.status || undefined,
      });
    },
    fromApi: (row) => ({
      ...row,
      id: row.id,
      code: row.code || '',
      teamCode: row.code || '',
      name: row.name || '',
      dept: row.dept || row.department || '',
      department: row.dept || row.department || '',
      departmentId: row.departmentId || undefined,
      lead: row.lead || row.leadName || '',
      leadName: row.leadName || row.lead || '',
      leadId: row.leadId || undefined,
      approver: row.approver || row.approverName || '',
      approverName: row.approverName || row.approver || '',
      approverId: row.approverId || undefined,
      members: Array.isArray(row.members) ? row.members.length : (row.headcount ?? row.memberCount ?? row.members ?? 0),
      memberIds: Array.isArray(row.memberIds)
        ? row.memberIds
        : (Array.isArray(row.membersDetail) ? row.membersDetail.map((m) => m.id) : (Array.isArray(row.members) ? row.members : [])),
      membersDetail: Array.isArray(row.membersDetail) ? row.membersDetail : [],
      memberCount: row.headcount ?? row.memberCount ?? (Array.isArray(row.members) ? row.members.length : 0),
      headcount: row.headcount ?? row.memberCount ?? 0,
      description: row.description || '',
      status: row.status || 'Active',
      _synced: true,
    }),
  },
  holidays: {
    path: '/hrms/holidays/',
    toApi: (h) => compact({
      id: h.id,
      name: h.name,
      date: isoOut(h.date),
      holidayType: h.holidayType || h.type,
      isOptional: h.isOptional !== undefined ? h.isOptional : (h.type === 'Optional' || h.type === 'Restricted'),
      status: h.status || 'Published',
      description: h.description,
      locationId: h.locationId,
      departmentId: h.departmentId,
    }),
    fromApi: (row) => ({
      ...row,
      date: isoIn(row.date),
      type: row.holidayType || (row.isOptional ? 'Optional' : 'Gazetted'),
      appliesTo: row.departmentName
        ? `${row.departmentName} Dept`
        : (row.locationName ? `${row.locationName} Hub` : 'All Hubs & Remote'),
      status: row.status || 'Published',
      _synced: true,
    }),
  },
  workSchedules: {
    path: '/hrms/work-schedules/',
    toApi: (s) => compact({
      id: s.id,
      name: s.name,
      code: s.code,
      shiftType: s.shiftType || 'Regular',
      shiftStart: s.shiftStart || '09:30',
      shiftEnd: s.shiftEnd || '18:30',
      breakDuration: s.breakDuration !== undefined ? num(s.breakDuration) : 60,
      workingHours: s.workingHours !== undefined ? num(s.workingHours) : 8.0,
      workingDays: Array.isArray(s.workingDays) ? s.workingDays : [0, 1, 2, 3, 4],
      weeklyOffs: Array.isArray(s.weeklyOffs) ? s.weeklyOffs : [5, 6],
      departmentId: s.departmentId || null,
      teamId: s.teamId || null,
      locationId: s.locationId || null,
      isDefault: !!s.isDefault,
      status: s.status || 'Active',
      effectiveFrom: isoOut(s.effectiveFrom),
      effectiveTo: isoOut(s.effectiveTo),
      description: s.description,
    }),
    fromApi: (row) => ({
      id: row.id,
      name: row.name,
      code: row.code || '',
      shiftType: row.shiftType || 'Regular',
      shiftStart: row.shiftStart ? String(row.shiftStart).slice(0, 5) : '09:30',
      shiftEnd: row.shiftEnd ? String(row.shiftEnd).slice(0, 5) : '18:30',
      breakDuration: row.breakDuration ?? 60,
      workingHours: Number(row.workingHours ?? 8),
      workingDays: row.workingDays || [0, 1, 2, 3, 4],
      weeklyOffs: row.weeklyOffs || [5, 6],
      departmentId: row.departmentId,
      departmentName: row.departmentName || '',
      teamId: row.teamId,
      teamName: row.teamName || '',
      locationId: row.locationId,
      locationName: row.locationName || '',
      isDefault: !!row.isDefault,
      status: row.status || 'Active',
      effectiveFrom: isoIn(row.effectiveFrom),
      effectiveTo: isoIn(row.effectiveTo),
      description: row.description || '',
      assignedCount: row.assignedCount || 0,
      _synced: true,
    }),
  },

  // ── leave ─────────────────────────────────────────────────────────────────
  leaves: {
    path: '/hrms/leave/',
    toApi: (l) => compact({
      employeeId: l.employeeId || undefined,
      leaveTypeId: l.leaveTypeId || undefined,
      fromDate: isoOut(l.fromDate || l.from),
      toDate: isoOut(l.toDate || l.to),
      days: l.days !== undefined ? num(l.days) : undefined,
      reason: l.reason || undefined,
      status: l.status || undefined,
      delegateId: l.delegateId || undefined,
      delegate: l.delegate || undefined,
      approved: l.approved !== undefined ? l.approved : (l.status === 'Approved' ? true : undefined),
      remark: l.remark || l.rejectReason || undefined,
    }),
    fromApi: (row) => ({
      ...asText(row, ['reason', 'status', 'type', 'employeeName', 'delegate']),
      id: row.id,
      delegateId: row.delegateId,
      pmsTask: row.pmsTask || row.pms_task || null,
      crmTask: row.crmTask || row.crm_task || null,
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
      ...asText(row, ['status', 'workLocation', 'notes', 'checkIn', 'checkOut', 'employeeName']),
      id: row.id,
      date: displayIn(row.date),
      rawDate: row.date,
      name: row.name || row.employeeName || row.employee || '',
      employee: row.employeeName || row.name || row.employee || '',
      employeeName: row.employeeName || row.name || row.employee || '',
      employeeId: row.employeeId || row.empId || row.employeeCode || row.id,
      employeeCode: row.employeeCode || row.empId || '',
      empId: row.employeeCode || row.empId || '',
      dept: row.dept || row.department || '',
      department: row.department || row.dept || '',
      shift: row.shift || 'General',
      firstPunch: row.firstPunch || row.checkIn,
      lastPunch: row.lastPunch || (row.status !== 'Absent' ? row.checkOut : null),
      workingHours: row.workingHours !== undefined && row.workingHours !== null ? Number(row.workingHours) : (Number(row.hours) || 0),
      hours: row.workingHours !== undefined && row.workingHours !== null ? Number(row.workingHours) : (Number(row.hours) || 0),
      lateMinutes: Number(row.lateMinutes) || 0,
      overtimeHours: Number(row.overtimeHours) || 0,
      formattedWorkingHours: row.formattedWorkingHours,
      totalBreakMinutes: Number(row.totalBreakMinutes ?? row.total_break_minutes) || 0,
      totalAttendanceHours: Number(row.totalAttendanceHours ?? row.total_attendance_hours) || 0,
      breaks: row.breaks || [],
      lateDisplay: row.lateDisplay,
      overtimeDisplay: row.overtimeDisplay,
      punches: row.punches || [],
      _synced: true,
    }),
  },
  attendanceRegularizations: {
    path: '/hrms/attendance/regularizations/',
    toApi: (r) => compact({
      employeeId: r.employeeId || undefined,
      date: isoOut(r.date || r.work_date),
      requestedCheckIn: r.requestedCheckIn || r.reqIn || r.curIn || undefined,
      requestedCheckOut: r.requestedCheckOut || r.reqOut || r.curOut || undefined,
      requestedStatus: r.requestedStatus || undefined,
      reason: r.reason || undefined,
    }),
    fromApi: (row) => {
      const reasonStr = String(row.reason || '');
      let inferredType = 'Regularization';
      if (reasonStr.toLowerCase().includes('[half day') || reasonStr.toLowerCase().includes('half day')) {
        inferredType = 'Half Day';
      } else if (reasonStr.toLowerCase().includes('early') || reasonStr.toLowerCase().includes('clock-out')) {
        inferredType = 'Early Clock-Out';
      } else if (reasonStr.toLowerCase().includes('[work from home') || reasonStr.toLowerCase().includes('wfh')) {
        inferredType = 'Work From Home (WFH)';
      } else if (reasonStr.toLowerCase().includes('[requirement:') || reasonStr.toLowerCase().includes('general request')) {
        inferredType = 'General Request';
      }

      const formatTime = (dtStr) => {
        if (!dtStr) return null;
        try {
          const d = new Date(dtStr);
          if (isNaN(d.getTime())) {
            const match = String(dtStr).match(/\d{2}:\d{2}/);
            return match ? match[0] : null;
          }
          return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch {
          return null;
        }
      };

      const reqInTime = formatTime(row.requestedCheckIn) || row.reqIn || '09:00';
      const reqOutTime = formatTime(row.requestedCheckOut) || row.reqOut || '18:30';

      return {
        id: row.id,
        employee: row.employeeName || row.employee || 'Employee',
        employeeId: row.employeeId || row.employee,
        type: row.type || inferredType,
        date: displayIn(row.date || row.work_date),
        rawDate: row.date || row.work_date,
        currentIn: row.currentIn || row.curIn || '09:00',
        currentOut: row.currentOut || row.curOut || '18:30',
        requestedIn: reqInTime,
        requestedOut: reqOutTime,
        reason: row.reason || 'Attendance request',
        requestedBy: row.employeeName || row.requestedBy || row.employee || 'Employee',
        submitted: row.submitted || 'Recent',
        status: row.status || 'Pending',
        remark: row.remark || '',
        _synced: true,
      };
    },
  },

  // ── payroll ───────────────────────────────────────────────────────────────
  payroll: {
    path: '/hrms/payroll/',
    toApi: (p) => compact({
      employeeId: p.employeeId || undefined,
      month: p.month || undefined,
      year: p.year !== undefined ? num(p.year) : undefined,
      status: p.status || undefined,
      standardSalary: p.standardSalary !== undefined ? num(p.standardSalary) : undefined,
      additionalEarnings: p.additionalEarnings !== undefined ? num(p.additionalEarnings) : undefined,
      deductions: p.deductions !== undefined ? num(p.deductions) : undefined,
      advance: p.advance !== undefined ? num(p.advance) : undefined,
      earnedSalaryOverride: p.earnedSalaryOverride !== undefined ? num(p.earnedSalaryOverride) : undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
    // Payslips are generated, not created by hand.
    omitOnUpdate: ['employeeId', 'month', 'year'],
  },
  salaryStructures: {
    path: '/hrms/payroll/salary-structures/',
    toApi: (s) => compact({
      name: s.name?.trim() || undefined,
      department: s.department || undefined,
      employees: s.employees !== undefined ? num(s.employees) : undefined,
      baseMin: s.baseMin || undefined,
      baseMax: s.baseMax || undefined,
      basic_pct: s.basic_pct !== undefined ? num(s.basic_pct) : undefined,
      hra_pct: s.hra_pct !== undefined ? num(s.hra_pct) : undefined,
      components: s.components || undefined,
      is_active: s.status ? s.status === 'Active' : undefined,
    }),
    fromApi: (row) => ({
      ...row,
      department: row.department || 'General',
      employees: row.employees || 0,
      baseMin: row.baseMin || '—',
      baseMax: row.baseMax || '—',
      status: row.status || (row.is_active !== false ? 'Active' : 'Inactive'),
      _synced: true,
    }),
  },
  advances: dated('/hrms/payroll/advances/', ['requestDate', 'date']),

  // ── recruitment ───────────────────────────────────────────────────────────
  jobs: {
    path: '/hrms/jobs/',
    toApi: (j) => compact({
      title: j.title?.trim() || undefined,
      code: j.code?.trim() || undefined,
      departmentId: j.departmentId || undefined,
      department: j.department || undefined,
      branch: j.branch || j.location || undefined,
      location: j.location || j.branch || undefined,
      employmentType: j.employmentType || undefined,
      experience: j.experience || undefined,
      openings: j.openings !== undefined ? num(j.openings, 1) : 1,
      salary: j.salary || undefined,
      salaryRange: j.salaryRange || j.salary || undefined,
      description: j.description || undefined,
      responsibilities: j.responsibilities || undefined,
      requiredSkills: j.requiredSkills || undefined,
      workMode: j.workMode || undefined,
      recruiter: j.recruiter || undefined,
      hiringManager: j.hiringManager || undefined,
      status: j.status || 'Draft',
      postedDate: isoOut(j.postedDate || j.startDate),
      closingDate: isoOut(j.closingDate),
    }),
    fromApi: (row) => ({
      ...row,
      id: row.id,
      title: row.title || '',
      code: row.code || '',
      department: row.department || '',
      departmentId: row.departmentId || undefined,
      branch: row.branch || row.location || '',
      location: row.location || row.branch || '',
      employmentType: row.employmentType || 'Full-time',
      experience: row.experience || row.experienceRange || '',
      openings: row.openings ?? 1,
      applicants: row.applicants ?? 0,
      interviews: row.interviews ?? 0,
      salary: row.salary || row.salaryRange || '',
      workMode: row.workMode || 'Hybrid',
      recruiter: row.recruiter || '',
      hiringManager: row.hiringManager || '',
      description: row.description || '',
      responsibilities: row.responsibilities || '',
      requiredSkills: row.requiredSkills || '',
      status: row.status || 'Draft',
      postedDate: displayIn(row.postedDate),
      startDate: displayIn(row.postedDate),
      closingDate: displayIn(row.closingDate),
      createdAt: displayIn(row.created_at) || displayIn(row.postedDate),
      _synced: true,
    }),
  },
  candidates: {
    path: '/hrms/candidates/',
    toApi: (c) => compact({
      name: c.name?.trim() || undefined,
      email: c.email?.trim() || undefined,
      phone: c.phone?.trim() || undefined,
      location: c.location || undefined,
      position: c.position || c.jobTitle || undefined,
      jobId: c.jobId || undefined,
      experience: c.experience || undefined,
      skills: c.skills || undefined,
      stage: c.stage || 'Applied',
      recruiter: c.recruiter || undefined,
      source: c.source || 'Career Portal',
      interviewStatus: c.interviewStatus || undefined,
      technicalScore: c.technicalScore !== undefined ? num(c.technicalScore) : undefined,
      avatar: c.avatar || undefined,
      isOnboarded: Boolean(c.isOnboarded),
      documentsVerified: Boolean(c.documentsVerified),
      appliedDate: isoOut(c.appliedDate),
      resumeFileId: c.resumeFileId || undefined,
      resumeFileName: c.resumeFileName || undefined,
      resumeFileSize: c.resumeFileSize || undefined,
      resumeFileUrl: c.resumeFileUrl || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      id: row.id,
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      location: row.location || '',
      position: row.position || row.jobTitle || '',
      jobId: row.jobId || '',
      experience: row.experience || '',
      skills: row.skills || '',
      stage: row.stage || 'Applied',
      recruiter: row.recruiter || '',
      source: row.source || 'Career Portal',
      avatar: row.avatar || `https://i.pravatar.cc/100?u=${row.id}`,
      interviewStatus: row.interviewStatus || 'Not Scheduled',
      technicalScore: row.technicalScore ?? null,
      isOnboarded: Boolean(row.isOnboarded),
      documentsVerified: Boolean(row.documentsVerified),
      appliedDate: displayIn(row.appliedDate || row.created_at),
      createdAt: displayIn(row.created_at),
      resumeFileId: row.resumeFileId || null,
      resumeFileName: row.resumeFileName || '',
      resumeFileSize: row.resumeFileSize || '',
      resumeFileUrl: row.resumeFileUrl || '',
      _synced: true,
    }),
  },
  applications: {
    path: '/hrms/applications/',
    toApi: (a) => compact({
      candidateId: a.candidateId || undefined,
      jobId: a.jobId || undefined,
      stage: a.stage || 'Applied',
      source: a.source || undefined,
      coverLetter: a.coverLetter || undefined,
      resumeUrl: a.resumeUrl || undefined,
      appliedDate: isoOut(a.appliedDate || a.applied_at),
    }),
    fromApi: (row) => ({
      ...row,
      id: row.id,
      candidateId: row.candidateId || undefined,
      candidateName: row.candidateName || row.candidate || '',
      jobId: row.jobId || undefined,
      jobTitle: row.jobTitle || row.job || '',
      stage: row.stage || 'Applied',
      source: row.source || 'Direct',
      appliedDate: displayIn(row.appliedDate || row.applied_at || row.created_at),
      _synced: true,
    }),
  },
  interviews: {
    path: '/hrms/interviews/',
    toApi: (i) => compact({
      applicationId: i.applicationId || undefined,
      candidateId: i.candidateId || undefined,
      candidateName: i.candidateName || undefined,
      job: i.job || undefined,
      interviewerId: i.interviewerId || undefined,
      interviewer: i.interviewer || undefined,
      type: i.type || 'Technical Interview',
      interviewType: i.type || i.interviewType || 'Technical Interview',
      date: isoOut(i.date),
      start: i.start || undefined,
      end: i.end || undefined,
      scheduledAt: i.scheduledAt || undefined,
      duration: i.duration || '60m',
      mode: i.mode || 'Video Call',
      location: i.location || i.meetingLink || undefined,
      meetingLink: i.meetingLink || i.location || undefined,
      status: i.status || 'Scheduled',
      score: i.score !== undefined ? num(i.score) : undefined,
      feedback: i.feedback || i.notes || undefined,
      notes: i.notes || i.feedback || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      id: row.id,
      candidateId: row.candidateId || undefined,
      candidateName: row.candidateName || 'Candidate',
      avatar: row.avatar || `https://i.pravatar.cc/100?u=${row.id}`,
      job: row.job || '',
      interviewer: row.interviewer || '',
      type: row.type || row.interviewType || 'Technical Interview',
      interviewType: row.type || row.interviewType || 'Technical Interview',
      date: displayIn(row.date || (row.scheduledAt ? row.scheduledAt.slice(0, 10) : '')),
      start: row.start || (row.scheduledAt ? new Date(row.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:30 AM'),
      end: row.end || '11:30 AM',
      duration: row.duration || '60m',
      mode: row.mode || 'Video Call',
      location: row.location || row.meetingLink || 'Office',
      meetingLink: row.meetingLink || row.location || '',
      status: row.status || 'Scheduled',
      score: row.score ?? null,
      feedback: row.feedback || row.notes || '',
      _synced: true,
    }),
  },
  offers: {
    path: '/hrms/offers/',
    toApi: (o) => compact({
      applicationId: o.applicationId || undefined,
      candidateId: o.candidateId || undefined,
      candidateName: o.candidateName || o.candidate || undefined,
      email: o.email || undefined,
      position: o.position || o.role || undefined,
      department: o.dept || o.department || undefined,
      dept: o.dept || o.department || undefined,
      location: o.location || undefined,
      jobType: o.jobType || undefined,
      workMode: o.workMode || undefined,
      salary: o.salary || undefined,
      offeredCtc: o.offeredCtc !== undefined ? num(o.offeredCtc) : undefined,
      joiningDate: isoOut(o.joiningDate),
      expiryDate: isoOut(o.expiryDate),
      reportingManager: o.reportingManager || undefined,
      probationPeriod: o.probationPeriod || undefined,
      letterContent: o.letterContent || undefined,
      approvalChainId: o.approvalChainId || undefined,
      status: o.status || undefined,
      notes: o.notes || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      id: row.id,
      candidateName: row.candidateName || row.candidate || 'Candidate',
      candidateId: row.candidateId || undefined,
      email: row.email || '',
      position: row.position || 'Staff Member',
      dept: row.dept || row.department || '',
      department: row.department || row.dept || '',
      location: row.location || 'HQ',
      jobType: row.jobType || 'Full-time',
      workMode: row.workMode || 'Hybrid',
      salary: row.salary || (row.offeredCtc ? `₹${Number(row.offeredCtc).toLocaleString()} / year` : 'Competitive'),
      offeredCtc: row.offeredCtc || undefined,
      joiningDate: displayIn(row.joiningDate),
      expiryDate: displayIn(row.expiryDate),
      reportingManager: row.reportingManager || '',
      probationPeriod: row.probationPeriod || '3 Months',
      letterContent: row.letterContent || null,
      approvalChainId: row.approvalChainId || null,
      currentStep: row.currentStep || 1,
      approvalHistory: row.approvalHistory || [],
      approverName: row.approverName || '',
      decidedAt: row.decidedAt || null,
      status: row.status || 'Pending',
      sentDate: row.sentDate || displayIn(row.sent_at || row.created_at) || '',
      _synced: true,
    }),
  },
  onboarding: {
    path: '/hrms/onboarding/',
    toApi: (t) => compact({
      candidateId: t.candidateId || undefined,
      title: t.title || t.name || undefined,
      description: t.description || undefined,
      dueDate: isoOut(t.dueDate || t.due),
      isCompleted: Boolean(t.isCompleted),
      status: t.status || (t.isCompleted ? 'Completed' : 'Pending'),
    }),
    fromApi: (row) => ({
      ...row,
      id: row.id,
      candidateId: row.candidateId || undefined,
      title: row.title || row.name || 'Onboarding Task',
      dueDate: displayIn(row.dueDate || row.due_date),
      isCompleted: Boolean(row.isCompleted || row.completed_at),
      status: row.isCompleted || row.completed_at ? 'Completed' : 'Pending',
      _synced: true,
    }),
  },
  // The page names a question `text` / `enabled`; the API calls them `question` / `isActive`.
  recruitmentQuestions: {
    path: '/hrms/recruitment/questions/',
    toApi: (q) => compact({
      question: q.text ?? q.question,
      type: q.type || undefined,
      options: Array.isArray(q.options) ? q.options : undefined,
      isActive: q.enabled !== undefined ? Boolean(q.enabled) : (q.isActive !== undefined ? Boolean(q.isActive) : true),
    }),
    fromApi: (row) => ({
      ...row,
      id: row.id,
      text: row.question || row.text || '',
      question: row.question || row.text || '',
      type: row.type || 'Short Text',
      options: row.options || [],
      enabled: row.isActive !== false && row.enabled !== false,
      isActive: row.isActive !== false && row.enabled !== false,
      _synced: true,
    }),
  },

  // ── performance ───────────────────────────────────────────────────────────
  appraisals: {
    path: '/hrms/performance/appraisals/',
    toApi: (a) => {
      let employeeId = isServerId(a.employeeId) ? a.employeeId : undefined;
      if (!employeeId && (a.employee || a.employeeId)) {
        const employees = getCachedEmployees();
        const found = employees.find(
          (e) => String(e.id) === String(a.employeeId) ||
                 String(e.name || '').toLowerCase() === String(a.employee || '').toLowerCase()
        );
        if (found && isServerId(found.id)) employeeId = found.id;
      }

      let managerId = isServerId(a.managerId) ? a.managerId : undefined;
      if (!managerId && (a.reviewer || a.managerId)) {
        const employees = getCachedEmployees();
        const found = employees.find(
          (e) => String(e.id) === String(a.managerId) ||
                 String(e.name || '').toLowerCase() === String(a.reviewer || '').toLowerCase()
        );
        if (found && isServerId(found.id)) managerId = found.id;
      }

      let cycleId = isServerId(a.cycleId) ? a.cycleId : undefined;
      if (!cycleId && (a.cycle || a.cycleName)) {
        const cycles = getCachedCycles();
        const targetName = String(a.cycle || a.cycleName || '').trim().toLowerCase();
        const found = cycles.find((c) => {
          const cName = String(c.name || '').trim().toLowerCase();
          return cName === targetName || cName.includes(targetName) || targetName.includes(cName);
        });
        if (found && isServerId(found.id)) cycleId = found.id;
      }
      if (!cycleId) {
        const cycles = getCachedCycles();
        const active = cycles.find((c) => c.status === 'Active') || cycles[0];
        if (active && isServerId(active.id)) cycleId = active.id;
      }

      const initialRating = a.rating !== undefined ? num(a.rating) : 4.0;
      const selfR = a.selfReview?.rating !== undefined ? num(a.selfReview.rating) : (a.selfRating !== undefined ? num(a.selfRating) : initialRating);
      const mgrR = a.managerReview?.rating !== undefined ? num(a.managerReview.rating) : (a.managerRating !== undefined ? num(a.managerRating) : undefined);
      const finR = a.finalRating !== undefined ? num(a.finalRating) : (a.status === 'Completed' ? num(a.rating) : undefined);

      return compact({
        employeeId,
        cycleId,
        managerId: managerId || null,
        selfRating: selfR,
        managerRating: mgrR,
        finalRating: finR,
        strengths: a.strengths || a.selfReview?.strengths || a.managerReview?.strengths || undefined,
        areasForImprovement: a.areasForImprovement || a.selfReview?.areasForImprovement || a.managerReview?.areasForImprovement || undefined,
        developmentFeedback: a.developmentFeedback || a.managerReview?.developmentFeedback || undefined,
        selfComments: a.selfComments || a.selfReview?.comments || undefined,
        hrComments: a.hrComments || a.hrReview?.comments || undefined,
      });
    },
    fromApi: (row) => {
      const employees = getCachedEmployees();
      const cycles = getCachedCycles();

      const emp = employees.find((e) => e.id === row.employeeId);
      const mgr = employees.find((e) => e.id === row.managerId);
      const cyc = cycles.find((c) => c.id === row.cycleId);

      const employeeName = emp?.name || row.employeeName || 'Unknown Employee';
      const reviewerName = mgr?.name || 'Assigned Manager';
      const cycleName = cyc?.name || 'Appraisal Cycle';

      const initialRating = Number(row.finalRating ?? row.managerRating ?? row.selfRating ?? 4.0);
      const tier = scaleForScore(initialRating) || { label: 'Meets Expectations' };

      const dueDate = row.dueDate
        ? displayIn(row.dueDate)
        : (cyc?.periodEnd ? displayIn(cyc.periodEnd) : (cyc?.endDate ? displayIn(cyc.endDate) : '31/12/2026'));

      return {
        ...row,
        id: row.id,
        employeeId: row.employeeId,
        employee: employeeName,
        avatar: emp?.avatar || `https://i.pravatar.cc/100?u=${encodeURIComponent(employeeName)}`,
        reviewer: reviewerName,
        managerId: row.managerId || null,
        cycle: cycleName,
        cycleId: row.cycleId,
        department: emp?.department || emp?.dept || '',
        designation: emp?.designation || emp?.role || '',
        rating: initialRating,
        ratingScaleLabel: tier.label,
        weightedScore: Math.round((initialRating / 5) * 100),
        stage: row.stage || 'Self Review',
        status: row.status || 'Draft',
        due: dueDate,
        selfReview: {
          rating: Number(row.selfRating ?? initialRating),
          comments: row.selfComments || '',
          strengths: row.strengths || '',
          areasForImprovement: row.areasForImprovement || '',
          completedAt: row.stage !== 'Self Review' ? (row.updatedAt ? displayIn(row.updatedAt) : 'Completed') : null,
          submitted: row.stage !== 'Self Review',
        },
        managerReview: {
          rating: Number(row.managerRating ?? initialRating),
          comments: row.developmentFeedback || '',
          strengths: row.strengths || '',
          areasForImprovement: row.areasForImprovement || '',
          developmentFeedback: row.developmentFeedback || '',
          reviewedAt: (row.stage === 'HR Review' || row.stage === 'Finalization') ? (row.updatedAt ? displayIn(row.updatedAt) : 'Completed') : null,
          submitted: row.stage === 'HR Review' || row.stage === 'Finalization',
        },
        hrReview: {
          comments: row.hrComments || '',
          approved: row.status === 'Approved' || row.status === 'Completed',
          approvedAt: (row.status === 'Approved' || row.status === 'Completed') ? (row.updatedAt ? displayIn(row.updatedAt) : 'Completed') : null,
          status: (row.status === 'Approved' || row.status === 'Completed') ? 'Approved' : 'Pending',
        },
        history: (Array.isArray(row.history) && row.history.length > 0)
          ? row.history.map((h) => ({
              stage: h.toStage || h.stage || 'Review',
              action: h.action || 'Stage Update',
              actor: h.actorName || h.actor || 'System',
              date: h.createdAt ? displayIn(h.createdAt) : 'Today',
              note: h.comment || h.note || '',
            }))
          : [
              {
                stage: 'Draft',
                action: 'Appraisal Created',
                actor: 'HR Admin',
                date: row.createdAt ? displayIn(row.createdAt) : 'Today',
                note: 'Appraisal initiated',
              },
            ],
        kpiResults: (Array.isArray(row.kpiScores) && row.kpiScores.length > 0)
          ? row.kpiScores.map((k) => ({
              name: k.kpiName || 'Indicator',
              target: k.target != null ? String(k.target) : '100%',
              actual: k.achieved != null ? String(k.achieved) : '',
              weight: Number(k.weight) || 10,
              score: Number(k.score) || initialRating,
            }))
          : [],
        _synced: true,
      };
    },
  },

  cycles: {
    path: '/hrms/performance/cycles/',
    toApi: (c) => compact({
      name: c.name,
      periodStart: isoOut(c.periodStart || c.startDate),
      periodEnd: isoOut(c.periodEnd || c.endDate),
      status: c.status || 'Draft',
      participantsScope: c.participantsScope || {},
    }),
    fromApi: (row) => {
      const start = displayIn(row.periodStart || row.period_start || row.startDate);
      const end = displayIn(row.periodEnd || row.period_end || row.endDate);
      const reviewPeriod = (start && end) ? `${start} - ${end}` : (start || end || '—');
      return {
        ...row,
        id: row.id,
        name: row.name,
        periodStart: row.periodStart || row.period_start || '',
        periodEnd: row.periodEnd || row.period_end || '',
        startDate: start || '',
        endDate: end || '',
        reviewPeriod,
        status: row.status || 'Draft',
        appraisalCount: row.appraisalCount || 0,
        completedCount: row.completedCount || 0,
        _synced: true,
      };
    },
  },

  goals: {
    path: '/hrms/performance/goals/',
    toApi: (g) => {
      let employeeId = isServerId(g.employeeId) ? g.employeeId : undefined;
      if (!employeeId && (g.emp || g.employee)) {
        const employees = getCachedEmployees();
        const found = employees.find(
          (e) => String(e.name || '').toLowerCase() === String(g.emp || g.employee || '').toLowerCase()
        );
        if (found && isServerId(found.id)) employeeId = found.id;
      }
      let cycleId = isServerId(g.cycleId) ? g.cycleId : (isServerId(g.cycle) ? g.cycle : undefined);
      return compact({
        employeeId,
        cycle: cycleId || null,
        title: g.title,
        description: g.description || undefined,
        targetDate: isoOut(g.targetDate || g.dueDate || g.due),
        progressPct: g.progressPct !== undefined ? num(g.progressPct) : (g.progress !== undefined ? num(g.progress) : 0),
        status: g.status || 'In Progress',
      });
    },
    fromApi: (row) => {
      const employees = getCachedEmployees();
      const emp = employees.find((e) => e.id === row.employeeId);
      const empName = emp?.name || 'Employee';
      return {
        ...row,
        id: row.id,
        employeeId: row.employeeId,
        emp: empName,
        employee: empName,
        avatar: emp?.avatar || `https://i.pravatar.cc/100?u=${encodeURIComponent(empName)}`,
        title: row.title,
        description: row.description || '',
        targetDate: row.targetDate || '',
        due: row.targetDate ? displayIn(row.targetDate) : '—',
        progress: row.progressPct || 0,
        progressPct: row.progressPct || 0,
        status: row.status || 'In Progress',
        _synced: true,
      };
    },
  },

  indicators: {
    path: '/hrms/performance/indicators/',
    toApi: (ind) => {
      let departmentId = isServerId(ind.departmentId) ? ind.departmentId : undefined;
      if (!departmentId && ind.department) {
        const depts = snapshots.get('departments') || [];
        const found = depts.find(
          (d) => String(d.name || '').toLowerCase() === String(ind.department || '').toLowerCase()
        );
        if (found && isServerId(found.id)) departmentId = found.id;
      }
      return compact({
        name: ind.name || ind.title,
        category: ind.category || 'Technical',
        weight: ind.weight !== undefined ? num(ind.weight) : 10,
        departmentId: departmentId || null,
      });
    },
    fromApi: (row) => {
      const depts = snapshots.get('departments') || [];
      const dept = depts.find((d) => d.id === row.departmentId);
      return {
        ...row,
        id: row.id,
        name: row.name,
        title: row.name,
        category: row.category || 'Technical',
        weight: Number(row.weight) || 10,
        departmentId: row.departmentId || null,
        department: dept?.name || '',
        rating: 4.0,
        status: 'Active',
        createdAt: row.createdAt ? displayIn(row.createdAt) : 'Today',
        updatedAt: 'Today',
        _synced: true,
      };
    },
  },

  kpis: {
    path: '/hrms/performance/kpis/',
    toApi: (k) => {
      const rawTarget = String(k.target ?? '');
      const numTarget = num(rawTarget.replace(/[^0-9.]/g, ''), 100);
      const unit = k.unit || (rawTarget.includes('%') ? '%' : '');
      return compact({
        name: k.name || k.title,
        indicatorId: isServerId(k.indicatorId) ? k.indicatorId : undefined,
        target: numTarget,
        unit: unit || undefined,
        appliesTo: k.appliesTo || 'All Staff',
      });
    },
    fromApi: (row) => {
      const targetStr = row.target != null ? `${row.target}${row.unit || ''}` : '100%';
      return {
        ...row,
        id: row.id,
        name: row.name,
        target: targetStr,
        unit: row.unit || '',
        appliesTo: row.appliesTo || 'All Staff',
        indicatorId: row.indicatorId || null,
        weight: 10,
        status: 'Active',
        createdAt: row.createdAt ? displayIn(row.createdAt) : 'Today',
        _synced: true,
      };
    },
  },

  // ── training ──────────────────────────────────────────────────────────────
  trainings: {
    path: '/hrms/trainings/',
    toApi: (t) => {
      const startIso = isoOut(t.start || t.startDate);
      const endIso = isoOut(t.end || t.endDate || t.start || t.startDate);
      return compact({
        title: t.name || t.title,
        description: t.description || undefined,
        type: t.type || undefined,
        trainerId: t.trainerId || undefined,
        departmentId: t.departmentId || undefined,
        startDate: startIso,
        endDate: endIso,
        venue: t.venue || t.location || undefined,
        cost: t.cost !== undefined ? num(t.cost) : undefined,
        stage: t.stage || t.status || undefined,
      });
    },
    fromApi: (row) => {
      const participantsList = Array.isArray(row.participants) ? row.participants : [];
      const participantsCount = Array.isArray(row.participants)
        ? row.participants.length
        : (num(row.participants) || 0);

      const start = displayIn(row.startDate || row.start_date || row.start);
      const end = displayIn(row.endDate || row.end_date || row.end);

      return {
        ...row,
        name: row.name || row.title || 'Untitled Training',
        title: row.title || row.name || 'Untitled Training',
        trainer: row.trainer || row.trainerName || 'Unassigned',
        trainerName: row.trainerName || row.trainer || 'Unassigned',
        start: start || '',
        end: end || start || '',
        startDate: row.startDate || row.start_date || '',
        endDate: row.endDate || row.end_date || '',
        stage: row.stage || row.status || 'Requested',
        status: row.stage || row.status || 'Requested',
        participants: participantsCount,
        participantsList,
        _synced: true,
      };
    },
  },
  trainers: {
    path: '/hrms/trainers/',
    toApi: (tr) => compact({
      name: tr.name,
      kind: tr.kind || (tr.type === 'External' ? 'External' : 'Internal'),
      organisation: tr.organisation || tr.org || undefined,
      expertise: tr.expertise || tr.specialization || undefined,
      contact: tr.contact || tr.email || tr.phone || undefined,
      rate: tr.rate !== undefined ? num(tr.rate) : undefined,
    }),
    fromApi: (row) => ({
      ...row,
      specialization: row.specialization || row.expertise || 'General',
      expertise: row.expertise || row.specialization || 'General',
      email: row.email || (row.contact && row.contact.includes('@') ? row.contact : '') || '',
      phone: row.phone || (row.contact && !row.contact.includes('@') ? row.contact : '') || '',
      status: row.status || 'Active',
      avatar: row.avatar || `https://i.pravatar.cc/100?u=${encodeURIComponent(row.id || row.name || 'tr')}`,
      _synced: true,
    }),
  },

  // ── policies ──────────────────────────────────────────────────────────────
  policies: dated('/hrms/policies/', ['effectiveDate', 'publishedDate']),
  policyCategories: plain('/hrms/policy-categories/'),

  assets: {
    path: '/hrms/assets/',
    toApi: (a) => compact({
      name: a.name,
      categoryId: a.categoryId || undefined,
      employeeId: a.employeeId || undefined,
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
      assetCode: row.assetCode || row.asset_code || '',
      category: row.category || row.categoryName || '',
      categoryId: row.categoryId || row.category_id || undefined,
      purchaseDate: displayIn(row.purchaseDate),
      warrantyExpiry: displayIn(row.warrantyExpiry),
      _synced: true,
    }),
  },
  assetCategories: plain('/hrms/asset-categories/'),
  assetRequests: {
    path: '/hrms/asset-requests/',
    toApi: (r) => compact({
      employeeId: r.employeeId || undefined,
      categoryId: r.categoryId || undefined,
      justification: r.justification || r.reason || (r.assetName ? `${r.assetName}${r.reason ? ` - ${r.reason}` : ''}` : undefined),
      status: r.status || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      id: row.id,
      category: row.categoryName || row.category || 'Hardware',
      reason: row.justification || '',
      assetName: row.justification ? (row.justification.split(' - ')[0] || row.justification) : 'Requested Item',
      requestedDate: row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      _synced: true,
    }),
  },

  resignations: {
    path: '/hrms/resignations/',
    toApi: (r) => compact({
      employeeId: r.employeeId || undefined,
      employee: r.employee || undefined,
      submittedOn: isoOut(r.submittedDate || r.submittedOn),
      submittedDate: isoOut(r.submittedDate || r.submittedOn),
      noticePeriod: r.noticePeriod || undefined,
      noticePeriodDays: r.noticePeriodDays !== undefined ? num(r.noticePeriodDays) : undefined,
      lastWorkingDay: isoOut(r.lastWorkingDay),
      handoverTo: r.handoverTo || undefined,
      handoverToId: r.handoverToId || undefined,
      reason: r.reason || undefined,
      status: r.status || undefined,
      noticeWaived: r.noticeWaived !== undefined ? Boolean(r.noticeWaived) : undefined,
      waiverReason: r.waiverReason || undefined,
      originalLastWorkingDay: isoOut(r.originalLastWorkingDay),
    }),
    fromApi: (row) => ({
      ...row,
      id: row.id,
      employee: row.employee || row.employeeName || 'Staff Member',
      employeeName: row.employeeName || row.employee || 'Staff Member',
      employeeId: row.employeeId || row.employeeCode || row.id,
      employeeCode: row.employeeCode || row.employeeId || '',
      dept: row.dept || row.department || '',
      role: row.role || row.designation || 'Staff',
      submittedDate: displayIn(row.submittedDate || row.submittedOn) || row.submittedDate || row.submittedOn || '',
      submittedOn: displayIn(row.submittedOn || row.submittedDate) || row.submittedOn || row.submittedDate || '',
      noticePeriod: row.noticePeriod || `${row.noticePeriodDays || 60} Days`,
      noticePeriodDays: row.noticePeriodDays || 60,
      lastWorkingDay: displayIn(row.lastWorkingDay) || row.lastWorkingDay || '',
      originalLastWorkingDay: displayIn(row.originalLastWorkingDay) || row.originalLastWorkingDay || '',
      noticeWaived: Boolean(row.noticeWaived),
      waiverReason: row.waiverReason || '',
      handoverTo: row.handoverTo || row.handoverName || 'Pending Assignment',
      reason: row.reason || '',
      status: row.status || 'Pending Manager Review',
      _synced: true,
    }),
  },
  terminations: {
    path: '/hrms/terminations/',
    toApi: (t) => compact({
      employeeId: t.employeeId || undefined,
      employee: t.employee || undefined,
      terminationType: t.terminationType || undefined,
      noticeDate: isoOut(t.noticeDate),
      exitDate: isoOut(t.exitDate || t.lastWorkingDay),
      lastWorkingDay: isoOut(t.lastWorkingDay || t.exitDate),
      severance: t.severance || undefined,
      reason: t.reason || undefined,
      letterContent: t.letterContent || undefined,
      settlement_amount: t.settlementAmount !== undefined ? num(t.settlementAmount) : undefined,
      status: t.status || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      id: row.id,
      employee: row.employee || row.employeeName || 'Staff Member',
      employeeName: row.employeeName || row.employee || 'Staff Member',
      employeeId: row.employeeId || row.employeeCode || row.id,
      employeeCode: row.employeeCode || row.employeeId || '',
      dept: row.dept || row.department || '',
      role: row.role || row.designation || 'Staff',
      terminationType: row.terminationType || 'Performance / Restructuring',
      noticeDate: displayIn(row.noticeDate) || row.noticeDate || '',
      exitDate: displayIn(row.exitDate || row.lastWorkingDay) || row.exitDate || row.lastWorkingDay || '',
      lastWorkingDay: displayIn(row.lastWorkingDay || row.exitDate) || row.lastWorkingDay || row.exitDate || '',
      severance: row.severance || '1 Month Gross Settlement',
      reason: row.reason || '',
      letterContent: row.letterContent || null,
      status: row.status || 'In Exit Clearance',
      _synced: true,
    }),
  },
  complaints: {
    path: '/hrms/complaints/',
    toApi: (c) => compact({
      raisedByEmployeeId: c.raisedByEmployeeId || undefined,
      complainant: c.complainant || c.raisedBy || undefined,
      againstEmployeeId: c.againstEmployeeId || undefined,
      against: c.against || c.againstName || undefined,
      category: c.category || undefined,
      description: c.summary || c.description || undefined,
      summary: c.summary || c.description || undefined,
      priority: c.priority || undefined,
      assignedInvestigator: c.assignedInvestigator || undefined,
      assigned_to: c.assignedTo || c.assigned_to || undefined,
      filedOn: isoOut(c.filedOn),
      isAnonymous: Boolean(c.isAnonymous),
      status: c.status || undefined,
      resolution: c.resolution || undefined,
      comments: Array.isArray(c.comments) ? c.comments : undefined,
    }),
    fromApi: (row) => ({
      ...row,
      id: row.id,
      complainant: row.complainant || row.raisedBy || 'Staff Member',
      raisedBy: row.raisedBy || row.complainant || 'Staff Member',
      against: row.against || row.againstName || 'Management / General',
      againstName: row.againstName || row.against || 'Management / General',
      category: row.category || 'General Workplace',
      priority: row.priority || 'Medium',
      assignedInvestigator: row.assignedInvestigator || row.assigned_investigator_name || 'Ethics Committee',
      filedOn: displayIn(row.filedOn) || row.filedOn || (row.created_at ? row.created_at.slice(0, 10) : ''),
      summary: row.summary || row.description || '',
      description: row.description || row.summary || '',
      status: row.status || 'Open',
      resolution: row.resolution || '',
      comments: Array.isArray(row.comments) ? row.comments : [],
      _synced: true,
    }),
  },
  documents: {
    path: '/hrms/documents/',
    toApi: (doc) => {
      let v = 1;
      if (typeof doc.version === 'number') {
        v = doc.version;
      } else if (typeof doc.version === 'string') {
        const cleaned = doc.version.toLowerCase().replace('v', '').split('.')[0].trim();
        v = parseInt(cleaned, 10) || 1;
      }

      let exp = null;
      if (doc.expiry && doc.expiry !== '—' && doc.expiry !== '-' && doc.expiry !== 'Permanent' && doc.expiry !== 'N/A') {
        exp = isoOut(doc.expiry) || null;
      }

      let empId = doc.employeeId;
      if (empId === 'ALL' || empId === 'All Staff' || !isServerId(empId)) {
        empId = null;
      }

      return compact({
        title: doc.title,
        category: doc.category || 'General',
        employeeId: empId,
        version: v,
        expiry: exp,
        description: doc.description || undefined,
        tags: Array.isArray(doc.tags) ? doc.tags : [doc.category || 'General'],
        is_confidential: Boolean(doc.is_confidential || doc.isConfidential),
        fileData: doc.fileData || undefined,
        fileName: doc.fileName || undefined,
        fileType: doc.fileType || 'PDF',
      });
    },
    fromApi: (row) => {
      const expDisplay = row.expiry ? displayIn(row.expiry) : '—';
      const rawCat = String(row.category || '').trim();
      const catLower = rawCat.toLowerCase();
      let canonicalCat = 'General';
      if (catLower === 'identity') canonicalCat = 'Identity';
      else if (catLower === 'contract') canonicalCat = 'Contract';
      else if (catLower === 'financial') canonicalCat = 'Financial';
      else if (catLower === 'compliance' || catLower === 'security') canonicalCat = 'Compliance';
      else if (catLower === 'legal') canonicalCat = 'Legal';
      else if (catLower === 'educational' || catLower === 'education') canonicalCat = 'Educational';
      else if (catLower === 'general' || catLower === 'policy') canonicalCat = 'General';
      else if (rawCat) canonicalCat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();

      return {
        ...row,
        category: canonicalCat,
        employee: row.employee || (row.employeeId && row.employeeId !== 'ALL' ? 'Staff Member' : 'All Staff'),
        employeeId: row.employeeId || 'ALL',
        employeeCode: row.employeeCode || undefined,
        version: typeof row.version === 'number' ? `v${row.version}.0` : (row.version || 'v1.0'),
        expiry: expDisplay,
        status: row.status || 'Valid',
        fileName: row.fileName || (row.title ? `${row.title}.pdf` : 'Document.pdf'),
        fileUrl: row.fileUrl || undefined,
        uploadDate: displayIn(row.uploadDate || row.created_at) || row.uploadDate || row.created_at,
        updatedOn: row.updatedOn ? displayIn(row.updatedOn) : (row.created_at ? displayIn(row.created_at) : new Date().toISOString().slice(0, 10)),
        fileType: row.fileType || 'PDF',
        fileSize: typeof row.fileSize === 'number' ? `${(row.fileSize / (1024 * 1024)).toFixed(1)} MB` : (row.fileSize || '0.1 MB'),
        _synced: true,
      };
    },
  },
  approvalChains: {
    path: '/hrms/approval-chains/',
    toApi: (chain) => compact({
      name: chain.name || `${chain.module || chain.applies_to || 'Workflow'} Approval Chain`,
      applies_to: chain.applies_to || chain.module || 'General',
      module: chain.module || chain.applies_to || 'General',
      tier1: chain.tier1,
      tier2: chain.tier2,
      tier3: chain.tier3,
      autoEscalateDays: Number(chain.autoEscalateDays) || 3,
      status: chain.status || 'Active',
      steps: chain.steps || [
        chain.tier1 ? { tier: 1, role: chain.tier1, autoEscalateDays: Number(chain.autoEscalateDays) || 3 } : null,
        chain.tier2 ? { tier: 2, role: chain.tier2 } : null,
        chain.tier3 && chain.tier3 !== '—' && chain.tier3 !== '-' ? { tier: 3, role: chain.tier3 } : null,
      ].filter(Boolean),
    }),
    fromApi: (row) => {
      const steps = Array.isArray(row.steps) ? row.steps : [];
      const t1 = row.tier1 || steps.find((s) => s.tier === 1 || s.level === 1)?.role || steps[0]?.role || 'Direct Line Manager';
      const t2 = row.tier2 || steps.find((s) => s.tier === 2 || s.level === 2)?.role || steps[1]?.role || 'Department Head';
      const t3 = row.tier3 || steps.find((s) => s.tier === 3 || s.level === 3)?.role || steps[2]?.role || '—';
      const escalate = row.autoEscalateDays || steps[0]?.autoEscalateDays || 3;
      return {
        id: row.id,
        module: row.module || row.appliesTo || row.applies_to || row.name?.replace(' Approval Chain', '') || 'General',
        name: row.name || `${row.module || row.appliesTo || 'Workflow'} Approval Chain`,
        tier1: t1,
        tier2: t2,
        tier3: t3,
        autoEscalateDays: Number(escalate) || 3,
        status: row.status || 'Active',
        _synced: true,
      };
    },
  },
  calendarEvents: {
    path: '/hrms/calendar/events/',
    toApi: (ev) => compact({
      ...ev,
      id: undefined,
      _synced: undefined,
      _pending: undefined,
      startDate: toISODate(ev.startDate || ev.date) || undefined,
      endDate: toISODate(ev.endDate || ev.startDate || ev.date) || undefined,
      date: toISODate(ev.date || ev.startDate) || undefined,
    }),
    fromApi: (row) => {
      const startDate = toISODate(row.startDate) || toISODate(row.date) || row.startDate;
      const endDate = toISODate(row.endDate) || toISODate(row.startDate) || startDate;
      const date = toISODate(row.date) || startDate;
      return {
        ...row,
        startDate,
        endDate,
        date,
        _synced: true,
      };
    },
  },
};

export const hrmsSync = createSync(HRMS_RESOURCES, { label: 'hrmsSync' });

/** What the HRMS shell loads on sign-in. The rest load per screen. */
export const HRMS_CORE_KEYS = [
  'employees', 'departments', 'designations', 'locations', 'teams', 'holidays',
  'workSchedules', 'leaves', 'leaveTypes', 'attendance', 'payroll',
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
export const pullTrainingDashboard = () => read('/hrms/trainings/dashboard/', null, 'training dashboard');
export const pullTrainingFunnel = () => read('/hrms/trainings/funnel/', null, 'training funnel');
export const pullPerformanceDashboard = () => read('/hrms/performance/dashboard/', null, 'performance dashboard');
export const pullIndividualAttendance = (employeeId, query) =>
  read(`/hrms/attendance/individual/${employeeId}/`, query, 'individual attendance');

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

export async function bulkAttendance(rows) {
  if (!isBackendEnabled()) return null;
  return api.post('/hrms/attendance/bulk/', { records: rows });
}

// ── record actions ──────────────────────────────────────────────────────────

export const approvePayroll = (id) => hrmsSync.act('payroll', id, 'approve', {});
export const markPayrollPaid = (id, payload = {}) => hrmsSync.act('payroll', id, 'mark-paid', payload);
export const approveLeave = (id, payload = {}) => hrmsSync.act('leaves', id, 'approve', payload);
export const rejectLeave = (id, payload = {}) => hrmsSync.act('leaves', id, 'reject', payload);
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
export const assignTrainer = (id, payload) => hrmsSync.act('trainings', id, 'assign-trainer', payload);
export const evaluateTraining = (id, payload) => hrmsSync.act('trainings', id, 'evaluate', payload);
export const addTrainingParticipants = (id, payload) => hrmsSync.act('trainings', id, 'participants', payload);
export const verifyCandidateDocuments = (candidateId) =>
  isBackendEnabled() ? api.post(`/hrms/onboarding/${candidateId}/verify-documents/`, {}) : Promise.resolve({ verified: true });
export const completeCandidateOnboarding = (candidateId) =>
  isBackendEnabled() ? api.post(`/hrms/onboarding/${candidateId}/complete/`, {}) : Promise.resolve({ completed: true });
export const sendOfferLetter = (offerId) =>
  isBackendEnabled() ? api.post(`/hrms/offers/${offerId}/send_offer/`, {}) : Promise.resolve({ status: 'Sent' });
export const acceptOfferLetter = (offerId) =>
  isBackendEnabled() ? api.post(`/hrms/offers/${offerId}/accept_offer/`, {}) : Promise.resolve({ status: 'Accepted' });

/**
 * The last rows the server gave us, per collection.
 *
 * `writeThrough` diffs against this rather than asking its caller for the
 * previous array, which is what lets the stores keep their existing actions:
 * they hand over the collection as they now want it and this works out which
 * rows are new, changed or gone.
 */

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
      // Payslips are server-generated via /hrms/payroll/process/, not created individually
      if (key !== 'payroll') {
        work.push(hrmsSync.create(key, row));
      }
    } else if (isServerId(row.id) && JSON.stringify(existing) !== JSON.stringify(row)) {
      work.push(hrmsSync.update(key, row.id, row));
    }
  });

  previous.forEach((row) => {
    if (row && !after.has(String(row.id)) && isServerId(row.id) && key !== 'payroll') {
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

/** Get current user / employee punch state today. */
export async function pullTodayPunch(employeeId = null) {
  if (!isBackendEnabled()) return null;
  const query = employeeId ? { employeeId } : undefined;
  return api.get('/hrms/attendance/today/', query ? { query } : undefined);
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
  const query = {
    employeeId,
    date: isoOut(date) || date,
  };
  return api.get('/hrms/attendance/punch-timeline/', { query });
}

/** HR / Admin punch correction. */
export async function submitPunchCorrection(payload) {
  if (!isBackendEnabled()) return null;
  return api.post('/hrms/attendance/correct-punch/', payload);
}

/** Add an employee to a squad. */
export async function addTeamMember(teamId, employeeId) {
  if (!isBackendEnabled()) return null;
  return api.post(`/hrms/teams/${teamId}/add-member/`, { employeeId });
}

/** Remove an employee from a squad. */
export async function removeTeamMember(teamId, employeeId) {
  if (!isBackendEnabled()) return null;
  return api.post(`/hrms/teams/${teamId}/remove-member/`, { employeeId });
}

export default hrmsSync;



// Helper formatters
export function formatClock12(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
}

export function formatHours(hours) {
  const n = Number(hours) || 0;
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

export function localISODate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const pullDailyAttendance = (date, query = {}) =>
  read('/hrms/attendance/daily/', { date: toISODate(date) || date, ...query }, 'daily attendance');

export const pullMonthlyAttendance = (employeeId, month) =>
  read('/hrms/attendance/monthly/', { employeeId, month }, 'monthly attendance');

export const pullLeaveBalanceSummary = (employeeId, year) =>
  read('/hrms/leave/balances/summary/', { employeeId, year }, 'leave balance summary');

export async function saveAttendanceDay(date, records) {
  const iso = toISODate(date) || date;
  return writeThrough('attendance', records.map((r) => ({ ...r, workDate: iso })));
}

export async function clearAttendanceDay(date, employeeIds) {
  const iso = toISODate(date) || date;
  return api.post('/hrms/attendance/clear-day/', { date: iso, employeeIds });
}

export const pullAvailableAssets = () => read('/hrms/assets/available/', null, 'available assets');
export const pullMyAssets = () => read('/hrms/assets/mine/', null, 'my assets');

export const approveAssetRequest = (id, payload = {}) => hrmsSync.act('assetRequests', id, 'approve', payload);
export const rejectAssetRequest = (id, payload = {}) => hrmsSync.act('assetRequests', id, 'reject', payload);
export const fulfillAssetRequest = (id, payload) => hrmsSync.act('assetRequests', id, 'fulfill', payload);
export const cancelAssetRequest = (id) => hrmsSync.act('assetRequests', id, 'cancel', {});

export const fetchPolicyAcknowledgements = (id) =>
  read(`/hrms/policies/${id}/acknowledgements/`, null, 'policy acknowledgements');

export const pullPayrollPeriod = (period) => pullTracked('payroll', period ? { period } : undefined);

// Textile Operational HR Actions (Oscar Scope)
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
