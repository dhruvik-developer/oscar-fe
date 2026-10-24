// ─────────────────────────────────────────────────────────────
// HRMS Setup Page — Hidden from sidebar and commented out per user request
// ─────────────────────────────────────────────────────────────

export function HrmsSetupPage() {
  return null;
}

export const HrmsSetup = HrmsSetupPage;
export default HrmsSetupPage;

/*
import { useState } from "react";
import {
  Sliders,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Eye,
  Plus,
  Edit,
  RotateCcw,
  FileCheck,
  History,
  AlertTriangle,
} from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import PageHeader from "../../../components/ui/PageHeader";

const MODULES = [
  "Dashboard Overview",
  "Employee Directory",
  "Attendance & Tracking",
  "Leave Management",
  "Payroll & Compensation",
  "Performance & Appraisals",
  "Recruitment Pipeline",
  "Training & Certifications",
  "Assets & Equipment",
  "Company Documents",
  "Organization Hierarchy",
];

const DEFAULT_ROLES = [
  {
    role: "Super Admin",
    desc: "Complete enterprise control across all HRMS & ERP partitions.",
    view: true,
    create: true,
    edit: true,
    delete: true,
    approve: true,
    export: true,
  },
  {
    role: "HR Director",
    desc: "Full strategic access to payroll, appraisals, audits, and policy definitions.",
    view: true,
    create: true,
    edit: true,
    delete: false,
    approve: true,
    export: true,
  },
  {
    role: "HR Operations Lead",
    desc: "Daily operational administration, attendance correction, onboarding, leave verification.",
    view: true,
    create: true,
    edit: true,
    delete: false,
    approve: true,
    export: true,
  },
  {
    role: "Department Manager",
    desc: "Review squad attendance, approve member leave, evaluate quarterly appraisals.",
    view: true,
    create: false,
    edit: false,
    delete: false,
    approve: true,
    export: true,
  },
  {
    role: "Standard Employee",
    desc: "Self-service access for clock-in, leave application, personal payslips, goal tracking.",
    view: true,
    create: false,
    edit: false,
    delete: false,
    approve: false,
    export: false,
  },
];

const DEFAULT_AUDIT = [
  { id: "LOG-1092", user: "Sarah Mitchell", action: "Salary Reclassification", target: "EMP1024 (Team Member)", timestamp: "Oct 11, 09:42 AM", ip: "192.168.1.104" },
  { id: "LOG-1091", user: "Ayesha Khan", action: "Approved Leave Request", target: "LV-2041 (Marcus Chen)", timestamp: "Oct 11, 08:20 AM", ip: "192.168.1.118" },
  { id: "LOG-1090", user: "David Park", action: "Created New Team", target: "Core Infrastructure", timestamp: "Oct 10, 04:15 PM", ip: "192.168.1.88" },
  { id: "LOG-1089", user: "James Wilson", action: "Verified Payroll Batch", target: "October 2024 Cycle", timestamp: "Oct 10, 02:00 PM", ip: "192.168.1.14" },
  { id: "LOG-1088", user: "System Admin", action: "Updated Flexibility Rules", target: "Grace Period 5m -> 10m", timestamp: "Oct 09, 11:30 AM", ip: "192.168.1.5" },
];

function HrmsSetupPageOriginal() {
  const showToast = useAppStore((s) => s.showToast);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [auditLogs, setAuditLogs] = useState(DEFAULT_AUDIT);
  const [selectedRole, setSelectedRole] = useState(roles[1]);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [newRole, setNewRole] = useState({
    role: "",
    desc: "",
    view: true,
    create: false,
    edit: false,
    delete: false,
    approve: false,
    export: false,
  });

  const handleTogglePermission = (roleIndex, permKey) => {
    const updated = [...roles];
    updated[roleIndex][permKey] = !updated[roleIndex][permKey];
    setRoles(updated);
    showToast(`Updated ${permKey} permission for ${updated[roleIndex].role}`);
  };

  const handleCreateRole = (e) => {
    e.preventDefault();
    if (!newRole.role) return;
    setRoles([...roles, newRole]);
    setIsRoleModalOpen(false);
    setNewRole({ role: "", desc: "", view: true, create: false, edit: false, delete: false, approve: false, export: false });
    showToast(`Role "${newRole.role}" added to matrix`);
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      <PageHeader
        title="HRMS Setup & Governance"
        subtitle="Manage granular role permissions, access control matrix, and system security audit trails."
        actions={
          <button
            type="button"
            onClick={() => setIsRoleModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs"
          >
            <Plus size={16} />
            Define Role
          </button>
        }
      />

      <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-bdr flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-[16px] text-slate-900 flex items-center gap-2">
              <ShieldCheck size={18} className="text-navy" />
              Roles &amp; Granular Permissions Matrix
            </h3>
            <p className="text-[12.5px] text-muted mt-0.5">
              Click checkboxes to modify capability entitlements for each user persona.
            </p>
          </div>
          <button
            type="button"
            onClick={() => showToast("Permissions matrix saved")}
            className="px-4 py-2 bg-[#f8fafc] border border-bdr rounded-xl text-[12.5px] font-semibold text-slate-700 hover:bg-slate-100"
          >
            Save Matrix State
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] lg:min-w-0 text-left text-[13px]">
            <thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted">
              <tr>
                <th className="py-3.5 px-5">Role &amp; Responsibilities</th>
                <th className="py-3.5 px-4 text-center">View</th>
                <th className="py-3.5 px-4 text-center">Create</th>
                <th className="py-3.5 px-4 text-center">Edit</th>
                <th className="py-3.5 px-4 text-center">Delete</th>
                <th className="py-3.5 px-4 text-center">Approve</th>
                <th className="py-3.5 px-4 text-center">Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr/40">
              {roles.map((r, idx) => (
                <tr key={r.role} className="hover:bg-off/60 transition">
                  <td className="py-4 px-5">
                    <div className="font-bold text-slate-900">{r.role}</div>
                    <div className="text-[12px] text-muted max-w-md mt-0.5">{r.desc}</div>
                  </td>
                  {["view", "create", "edit", "delete", "approve", "export"].map((permKey) => (
                    <td key={permKey} className="py-4 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={r[permKey]}
                        onChange={() => handleTogglePermission(idx, permKey)}
                        className="w-4 h-4 rounded text-navy focus:ring-navy cursor-pointer accent-[#1F2E4A]"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-bdr rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-bdr">
          <div className="flex items-center gap-2">
            <History size={18} className="text-navy" />
            <h3 className="font-bold text-[16px] text-slate-900">Governance &amp; Security Audit Logs</h3>
          </div>
          <span className="text-[12px] text-muted">Real-time immutable audit trail</span>
        </div>

        <div className="space-y-2.5">
          {auditLogs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 bg-off border border-bdr rounded-xl flex flex-wrap items-center justify-between gap-3 text-[13px] hover:border-slate-300 transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <div>
                  <span className="font-bold text-slate-900">{log.user}</span>
                  <span className="text-muted"> performed </span>
                  <span className="font-semibold text-slate-800">{log.action}</span>
                  <span className="text-muted"> on </span>
                  <span className="text-slate-800 font-mono text-[12px]">{log.target}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-muted">
                <span>IP: {log.ip}</span>
                <span>•</span>
                <span>{log.timestamp}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-md p-4 sm:p-6 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-bdr">
              <h3 className="font-bold text-[16px] text-slate-900">Define Custom Role</h3>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-off grid place-items-center text-muted hover:text-slate-800"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateRole} className="flex flex-col gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Role Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Talent Acquisition Specialist"
                  value={newRole.role}
                  onChange={(e) => setNewRole({ ...newRole, role: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Role Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manages job posts, candidates, and interview scheduling."
                  value={newRole.desc}
                  onChange={(e) => setNewRole({ ...newRole, desc: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
                />
              </div>
              <div className="pt-2">
                <label className="block text-[12px] font-semibold text-slate-700 mb-2">Initial Permissions</label>
                <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                  {["view", "create", "edit", "delete", "approve", "export"].map((k) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRole[k]}
                        onChange={(e) => setNewRole({ ...newRole, [k]: e.target.checked })}
                        className="w-4 h-4 rounded text-navy"
                      />
                      <span className="capitalize">{k}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2.5 mt-3 pt-3 border-t border-bdr">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90"
                >
                  Add Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
*/
