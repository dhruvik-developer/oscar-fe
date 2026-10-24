import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  MapPin,
  Clock,
  UserCheck,
  Laptop,
  FileText,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Save,
  Users,
  Shield,
  Layers,
  ChevronRight,
} from "lucide-react";
import { Avatar } from "../../../components/hrms/Avatar";
import { useAppStore } from "../../../stores/appStore";
import { useAssetStore } from "../../../stores/assetStore";

const DEPARTMENTS = [
  "Engineering",
  "Design",
  "Marketing",
  "Finance",
  "HR",
  "Operations",
  "Sales",
  "Administration",
  "Sales Department",
];

const STATUS_OPTIONS = ["Active", "On Leave", "Probation"];
const EMPLOYMENT_TYPES = ["Full Time", "Contract", "Intern", "Part Time"];
const SHIFT_OPTIONS = ["General", "Flexible", "Night", "Morning"];

const statusStyles = {
  Active: { bg: "#e6f4ea", text: "#15803d", border: "#a7f3d0" },
  "On Leave": { bg: "#fef3c7", text: "#b45309", border: "#fde68a" },
  Probation: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
};

export default function EmployeeProfileModal({ isOpen, employee, onClose, onEmployeeUpdated }) {
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "attendance" | "leaves" | "assets" | "edit"
  const [saving, setSaving] = useState(false);

  const updateStoreEmployee = useAppStore((s) => s.updateEmployee);
  const showToast = useAppStore((s) => s.setToast || s.showToast);
  const allEmployees = useAppStore((s) => s.employees || []);
  const attendanceList = useAppStore((s) => s.attendance || []);
  const leavesList = useAppStore((s) => s.leaves || []);
  const assetList = useAssetStore((s) => s.assets || []);

  // Form state for editing
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    designation: "",
    department: "",
    location: "",
    managerId: "",
    employmentType: "Full Time",
    shift: "General",
    status: "Active",
    joiningDate: "",
  });

  // Keep form in sync when employee changes
  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name || "",
        email: employee.email || "",
        phone: employee.phone || "",
        designation: employee.designation || employee.role || "",
        department: employee.department || employee.dept || "",
        location: typeof employee.location === "string" ? employee.location : "Mumbai",
        managerId: employee.managerId || employee.reportingManagerId || "",
        employmentType: employee.employmentType || "Full Time",
        shift: employee.shift || "General",
        status: employee.status || "Active",
        joiningDate: employee.joiningDate || employee.joining || employee.doj || "",
      });
      setActiveTab("overview");
    }
  }, [employee]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !employee) return null;

  const empId = employee.empId || employee.employeeCode || employee.id || "EMP";
  const empName = employee.name || "Employee";
  const statusInfo = statusStyles[employee.status] || statusStyles.Active;

  // Filter attendance records for this employee
  const employeeAttendance = attendanceList.filter((a) => {
    const idMatch = a.employeeId && String(a.employeeId) === String(employee.id);
    const nameMatch = a.employeeName && a.employeeName.toLowerCase() === empName.toLowerCase();
    const codeMatch = a.employeeCode && a.employeeCode === empId;
    return idMatch || nameMatch || codeMatch;
  });

  // Filter leaves for this employee
  const employeeLeaves = leavesList.filter((l) => {
    const idMatch = l.employeeId && String(l.employeeId) === String(employee.id);
    const nameMatch = l.employeeName && l.employeeName.toLowerCase() === empName.toLowerCase();
    return idMatch || nameMatch;
  });

  // Filter assigned assets for this employee
  const employeeAssets = assetList.filter((ast) => {
    const idMatch = ast.assignedToId && String(ast.assignedToId) === String(employee.id);
    const nameMatch = ast.assignedTo && ast.assignedTo.toLowerCase() === empName.toLowerCase();
    return idMatch || nameMatch;
  });

  // Manager details
  const reportingManagerName =
    employee.manager ||
    employee.reportingManager ||
    allEmployees.find((x) => String(x.id) === String(employee.managerId))?.name ||
    "—";

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) {
      showToast?.("Employee name cannot be empty.", "error");
      return;
    }
    setSaving(true);
    try {
      const selectedMgr = allEmployees.find((x) => String(x.id) === String(form.managerId));
      const updates = {
        ...form,
        manager: selectedMgr ? selectedMgr.name : form.managerId ? reportingManagerName : "",
        reportingManager: selectedMgr ? selectedMgr.name : form.managerId ? reportingManagerName : "",
      };

      const result = await updateStoreEmployee(employee.id, updates);
      showToast?.(`Profile updated for ${form.name}`);
      onEmployeeUpdated?.({ ...employee, ...updates });
      setActiveTab("overview");
    } catch (err) {
      // error handled in store
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header Banner ── */}
        <div className="relative bg-gradient-to-r from-[#111827] via-[#1f293d] to-[#0f172a] text-white p-5 sm:p-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            title="Close modal"
          >
            <X size={16} />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Avatar name={empName} size="xl" className="border-2 border-white/20 shadow-md shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
                  {empName}
                </h2>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                  style={{
                    backgroundColor: statusInfo.bg,
                    color: statusInfo.text,
                    borderColor: statusInfo.border,
                  }}
                >
                  {employee.status || "Active"}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-white/15 text-slate-200 text-xs font-mono font-medium">
                  {empId}
                </span>
              </div>
              <p className="text-sm text-slate-300 font-medium flex items-center gap-2 flex-wrap">
                <span>{employee.designation || employee.role || "Employee"}</span>
                <span>•</span>
                <span className="text-slate-200">{employee.department || "General"}</span>
                {employee.location && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-slate-300 text-xs">
                      <MapPin size={12} /> {employee.location}
                    </span>
                  </>
                )}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-300 flex-wrap">
                {employee.email && (
                  <a
                    href={`mailto:${employee.email}`}
                    className="inline-flex items-center gap-1.5 hover:text-white transition underline-offset-2 hover:underline"
                  >
                    <Mail size={13} className="text-slate-400" />
                    {employee.email}
                  </a>
                )}
                {employee.phone && (
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <Phone size={13} className="text-slate-400" />
                    {employee.phone}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "edit" ? "overview" : "edit")}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                activeTab === "edit"
                  ? "bg-white text-slate-900 border-white"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/20"
              }`}
            >
              <Edit3 size={13} />
              {activeTab === "edit" ? "View Profile" : "Edit Profile"}
            </button>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="flex items-center gap-1 border-b border-[#e5e7eb] px-5 bg-[#f8fafc] text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-3 relative transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "overview" ? "text-slate-950 font-bold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Overview
            {activeTab === "overview" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-900 rounded-t" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("attendance")}
            className={`py-3 px-3 relative transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "attendance" ? "text-slate-950 font-bold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Attendance
            {employeeAttendance.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                {employeeAttendance.length}
              </span>
            )}
            {activeTab === "attendance" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-900 rounded-t" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("leaves")}
            className={`py-3 px-3 relative transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "leaves" ? "text-slate-950 font-bold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Leaves &amp; Time Off
            {employeeLeaves.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                {employeeLeaves.length}
              </span>
            )}
            {activeTab === "leaves" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-900 rounded-t" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("assets")}
            className={`py-3 px-3 relative transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "assets" ? "text-slate-950 font-bold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Assets
            {employeeAssets.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                {employeeAssets.length}
              </span>
            )}
            {activeTab === "assets" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-900 rounded-t" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={`py-3 px-3 relative transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "edit" ? "text-slate-950 font-bold" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Edit Information
            {activeTab === "edit" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-900 rounded-t" />
            )}
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="p-5 overflow-y-auto flex-1 text-xs">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Personal Details Card */}
              <div className="border border-[#e2e8f0] rounded-xl p-4 bg-white shadow-2xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <UserCheck size={14} className="text-slate-600" />
                  Personal &amp; Contact Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                    <span className="text-[11px] text-slate-500 font-medium block">Full Name</span>
                    <span className="text-slate-900 font-semibold text-xs mt-0.5 block">{empName}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                    <span className="text-[11px] text-slate-500 font-medium block">Work Email</span>
                    <span className="text-slate-900 font-semibold text-xs mt-0.5 block truncate">
                      {employee.email || "—"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                    <span className="text-[11px] text-slate-500 font-medium block">Phone Number</span>
                    <span className="text-slate-900 font-semibold text-xs mt-0.5 block">
                      {employee.phone || "—"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                    <span className="text-[11px] text-slate-500 font-medium block">Employee Code / ID</span>
                    <span className="text-slate-900 font-semibold text-xs mt-0.5 block font-mono">{empId}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                    <span className="text-[11px] text-slate-500 font-medium block">Status</span>
                    <span className="text-slate-900 font-semibold text-xs mt-0.5 block">
                      {employee.status || "Active"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                    <span className="text-[11px] text-slate-500 font-medium block">Employment Type</span>
                    <span className="text-slate-900 font-semibold text-xs mt-0.5 block">
                      {employee.employmentType || "Full Time"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Job & Hierarchy Card */}
              <div className="border border-[#e2e8f0] rounded-xl p-4 bg-white shadow-2xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Briefcase size={14} className="text-slate-600" />
                  Job Position &amp; Organization
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                    <span className="text-[11px] text-slate-500 font-medium block">Department</span>
                    <span className="text-slate-900 font-semibold text-xs mt-0.5 block">
                      {employee.department || "General"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                    <span className="text-[11px] text-slate-500 font-medium block">Designation / Role</span>
                    <span className="text-slate-900 font-semibold text-xs mt-0.5 block">
                      {employee.designation || employee.role || "Senior Staff"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                    <span className="text-[11px] text-slate-500 font-medium block">Reporting Manager</span>
                    <span className="text-slate-900 font-semibold text-xs mt-0.5 block">
                      {reportingManagerName}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                    <span className="text-[11px] text-slate-500 font-medium block">Work Location</span>
                    <span className="text-slate-900 font-semibold text-xs mt-0.5 block">
                      {employee.location || "Mumbai Head Office"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                    <span className="text-[11px] text-slate-500 font-medium block">Date of Joining</span>
                    <span className="text-slate-900 font-semibold text-xs mt-0.5 block">
                      {employee.joiningDate || employee.joining || employee.doj || "Recorded in ERP"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#f1f5f9]">
                    <span className="text-[11px] text-slate-500 font-medium block">Assigned Shift</span>
                    <span className="text-slate-900 font-semibold text-xs mt-0.5 block">
                      {employee.shift || "General (09:30 - 18:30)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Summary Badges */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-[#e2e8f0] rounded-xl p-3 bg-[#f8fafc] text-center">
                  <span className="text-[11px] font-medium text-slate-500 block">Attendance Records</span>
                  <span className="text-base font-bold text-slate-900 mt-0.5 block">
                    {employeeAttendance.length} logs
                  </span>
                </div>
                <div className="border border-[#e2e8f0] rounded-xl p-3 bg-[#f8fafc] text-center">
                  <span className="text-[11px] font-medium text-slate-500 block">Leave Applications</span>
                  <span className="text-base font-bold text-slate-900 mt-0.5 block">
                    {employeeLeaves.length} applied
                  </span>
                </div>
                <div className="border border-[#e2e8f0] rounded-xl p-3 bg-[#f8fafc] text-center">
                  <span className="text-[11px] font-medium text-slate-500 block">Assigned Assets</span>
                  <span className="text-base font-bold text-slate-900 mt-0.5 block">
                    {employeeAssets.length} active
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ATTENDANCE */}
          {activeTab === "attendance" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Logged Attendance Entries ({employeeAttendance.length})
                </span>
              </div>
              {employeeAttendance.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-[#cbd5e1] rounded-xl bg-[#f8fafc]">
                  <Clock size={28} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No attendance records for {empName}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Records will appear once daily punch-in/out or bulk attendance is logged.
                  </p>
                </div>
              ) : (
                <div className="border border-[#e2e8f0] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-slate-500 font-semibold">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Check In</th>
                        <th className="p-2.5">Check Out</th>
                        <th className="p-2.5">Work Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {employeeAttendance.map((rec, i) => (
                        <tr key={rec.id || i} className="hover:bg-[#f8fafc]">
                          <td className="p-2.5 font-medium text-slate-900">{rec.date || "—"}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                rec.status === "Present"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : rec.status === "Half Day"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {rec.status || "Present"}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600">{rec.checkIn || rec.inTime || "09:30 AM"}</td>
                          <td className="p-2.5 text-slate-600">{rec.checkOut || rec.outTime || "06:30 PM"}</td>
                          <td className="p-2.5 text-slate-600 font-medium">{rec.workHours || "8.5 hrs"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LEAVES */}
          {activeTab === "leaves" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Leave Applications &amp; Approvals ({employeeLeaves.length})
                </span>
              </div>
              {employeeLeaves.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-[#cbd5e1] rounded-xl bg-[#f8fafc]">
                  <Calendar size={28} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No leave requests recorded</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Any leave requests applied by or for this employee will appear here.
                  </p>
                </div>
              ) : (
                <div className="border border-[#e2e8f0] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-slate-500 font-semibold">
                      <tr>
                        <th className="p-2.5">Leave Type</th>
                        <th className="p-2.5">Duration</th>
                        <th className="p-2.5">Days</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {employeeLeaves.map((lv, i) => (
                        <tr key={lv.id || i} className="hover:bg-[#f8fafc]">
                          <td className="p-2.5 font-semibold text-slate-900">{lv.type || lv.leaveType || "Casual Leave"}</td>
                          <td className="p-2.5 text-slate-600">
                            {lv.startDate || lv.date || "—"} {lv.endDate && `to ${lv.endDate}`}
                          </td>
                          <td className="p-2.5 font-medium text-slate-800">{lv.days || 1} day(s)</td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                lv.status === "Approved"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : lv.status === "Rejected"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {lv.status || "Approved"}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600 max-w-[200px] truncate">{lv.reason || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ASSETS */}
          {activeTab === "assets" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Assigned Hardware &amp; IT Assets ({employeeAssets.length})
                </span>
              </div>
              {employeeAssets.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-[#cbd5e1] rounded-xl bg-[#f8fafc]">
                  <Laptop size={28} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No active assets allocated</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Assets assigned to this staff member in HRMS &gt; Assets will be listed here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {employeeAssets.map((ast, i) => (
                    <div
                      key={ast.id || i}
                      className="border border-[#e2e8f0] rounded-xl p-3.5 bg-white shadow-2xs flex items-start gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        <Laptop size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-slate-900 text-xs truncate">{ast.name || "Asset"}</h4>
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {ast.status || "Assigned"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {ast.category || "General"} {ast.tagNumber ? `• Tag: ${ast.tagNumber}` : ""}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Assigned: {ast.assignedDate || "Active"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: EDIT FORM */}
          {activeTab === "edit" && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-[#cbd5e1] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Work Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-[#cbd5e1] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800"
                    placeholder="e.g. john@oscar.test"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-[#cbd5e1] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={form.designation}
                    onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-[#cbd5e1] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800"
                    placeholder="e.g. Senior Software Engineer"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-[#cbd5e1] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800 cursor-pointer"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Reporting Manager
                  </label>
                  <select
                    value={form.managerId}
                    onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-[#cbd5e1] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800 cursor-pointer"
                  >
                    <option value="">No manager selected</option>
                    {allEmployees
                      .filter((x) => String(x.id) !== String(employee.id))
                      .map((mgr) => (
                        <option key={mgr.id} value={mgr.id}>
                          {mgr.name} ({mgr.department || "Staff"})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Work Location
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-[#cbd5e1] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800"
                    placeholder="e.g. Mumbai HQ / Remote"
                  />
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Employment Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-[#cbd5e1] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800 cursor-pointer"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Employment Type
                  </label>
                  <select
                    value={form.employmentType}
                    onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-[#cbd5e1] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800 cursor-pointer"
                  >
                    {EMPLOYMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Shift
                  </label>
                  <select
                    value={form.shift}
                    onChange={(e) => setForm({ ...form, shift: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-[#cbd5e1] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-800 cursor-pointer"
                  >
                    {SHIFT_OPTIONS.map((sh) => (
                      <option key={sh} value={sh}>
                        {sh}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className="px-3.5 py-1.5 rounded-xl border border-[#cbd5e1] text-slate-700 hover:bg-[#f8fafc] font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#111827] text-white hover:bg-slate-950 font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  <Save size={13} />
                  {saving ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="px-5 py-3 border-t border-[#e5e7eb] bg-[#f8fafc] flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono text-[11px]">System ID: {String(employee.id)}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-[#cbd5e1] bg-white text-slate-700 font-semibold hover:bg-slate-50 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
