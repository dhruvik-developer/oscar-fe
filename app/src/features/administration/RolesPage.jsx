import InfoBanner from '../../components/ui/InfoBanner';
import PageHeader from '../../components/ui/PageHeader';
import AdministrationGuideButton from './AdministrationGuideButton';
import KpiCard from '../../components/ui/KpiCard';
import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminSync, duplicateRole, describeError } from '../../services/adminSync';
import {
  Users,
  Shield,
  ShieldCheck,
  Clock,
  Search,
  Plus,
  MoreVertical,
  X,
  FileText,
  Trash2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Target,
  Layers,
  ListChecks,
  Briefcase,
  UserCheck,
  Landmark,
  ShoppingCart,
  Menu,
  Sparkles,
  AlertTriangle,
  Copy,
  Edit2,
} from 'lucide-react';

const ROLES_PER_PAGE = 10;

const DEFAULT_MODULE_PERMISSIONS = {
  CRM: [
    {
      id: 'lead_management',
      name: 'Lead Management',
      description: 'Manage leads and related activities',
      icon: 'lead',
      color: 'orange',
      permissions: [
        { id: 'create_lead', label: 'Create Lead' },
        { id: 'view_lead', label: 'View Lead' },
        { id: 'edit_lead', label: 'Edit Lead' },
        { id: 'delete_lead', label: 'Delete Lead' },
        { id: 'move_lead', label: 'Move Lead' },
      ],
    },
    {
      id: 'pipeline_stage',
      name: 'Pipeline & Stage',
      description: 'Manage pipeline and lead stages',
      icon: 'pipeline',
      color: 'green',
      permissions: [
        { id: 'manage_pipeline', label: 'Manage Pipeline' },
        { id: 'create_pipeline', label: 'Create Pipeline' },
        { id: 'edit_pipeline', label: 'Edit Pipeline' },
        { id: 'delete_pipeline', label: 'Delete Pipeline' },
      ],
    },
    {
      id: 'tasks',
      name: 'Tasks',
      description: 'Task management and allocation',
      icon: 'task',
      color: 'blue',
      permissions: [
        { id: 'view_task', label: 'View Task' },
        { id: 'create_task', label: 'Create Task' },
        { id: 'edit_task', label: 'Edit Task' },
        { id: 'delete_task', label: 'Delete Task' },
        { id: 'assign_task', label: 'Assign Task' },
        { id: 'manage_task_allocation', label: 'Manage Task Allocation' },
      ],
    },
  ],
  Staff: [
    {
      id: 'user_management',
      name: 'Staff & User Access',
      description: 'Manage employee system accounts and profiles',
      icon: 'staff',
      color: 'blue',
      permissions: [
        { id: 'view_staff', label: 'View Staff List' },
        { id: 'create_staff', label: 'Create Staff Account' },
        { id: 'edit_staff', label: 'Edit Staff Profile' },
        { id: 'delete_staff', label: 'Delete Staff' },
        { id: 'manage_roles', label: 'Manage Roles & Permissions' },
        { id: 'reset_staff_password', label: 'Reset Staff Passwords' },
      ],
    },
  ],
  Project: [
    {
      id: 'project_management',
      name: 'Projects & Milestones',
      description: 'Manage project planning, timelines and boards',
      icon: 'project',
      color: 'purple',
      permissions: [
        { id: 'view_projects', label: 'View Projects' },
        { id: 'create_project', label: 'Create Project' },
        { id: 'edit_project', label: 'Edit Project' },
        { id: 'delete_project', label: 'Delete Project' },
        { id: 'manage_milestones', label: 'Manage Milestones' },
        { id: 'assign_members', label: 'Assign Project Members' },
      ],
    },
  ],
  HRM: [
    {
      id: 'hrm_attendance',
      name: 'Attendance & Leave',
      description: 'Manage daily check-ins, leave requests and calendar',
      icon: 'hrm',
      color: 'rose',
      permissions: [
        { id: 'mark_attendance', label: 'Mark Attendance' },
        { id: 'view_team_attendance', label: 'View Team Attendance' },
        { id: 'apply_leave', label: 'Apply Leave' },
        { id: 'approve_leave', label: 'Approve Leave Requests' },
        { id: 'regularize_attendance', label: 'Regularize Attendance' },
      ],
    },
    {
      id: 'hrm_payroll',
      name: 'Payroll & Compensation',
      description: 'Salary structures, monthly generation and payslips',
      icon: 'hrm',
      color: 'purple',
      permissions: [
        { id: 'view_own_payslip', label: 'View Own Payslip' },
        { id: 'generate_payroll', label: 'Generate Monthly Payroll' },
        { id: 'edit_salary_structure', label: 'Edit Salary Structure' },
        { id: 'approve_payroll', label: 'Approve Payroll Disbursal' },
      ],
    },
  ],
  Account: [
    {
      id: 'accounting_ledger',
      name: 'General Ledger & Accounts',
      description: 'Cash accounts, bank accounts and journal entries',
      icon: 'account',
      color: 'blue',
      permissions: [
        { id: 'view_bank_accounts', label: 'View Bank Accounts' },
        { id: 'manage_journal_entries', label: 'Manage Journal Entries' },
        { id: 'view_ledger', label: 'View General Ledger' },
        { id: 'view_financial_reports', label: 'View Profit & Loss / Balance Sheet' },
        { id: 'reconcile_bank', label: 'Bank Statement Reconciliation' },
      ],
    },
  ],
  POS: [
    {
      id: 'pos_sales',
      name: 'Point of Sale & Invoicing',
      description: 'Quick billing, quotation generation and sales orders',
      icon: 'pos',
      color: 'amber',
      permissions: [
        { id: 'create_pos_invoice', label: 'Create POS Invoice' },
        { id: 'view_pos_orders', label: 'View POS Orders' },
        { id: 'apply_discounts', label: 'Apply Custom Discounts' },
        { id: 'process_returns', label: 'Process Returns' },
        { id: 'print_receipts', label: 'Print Receipts' },
      ],
    },
  ],
  'Menu Access': [
    {
      id: 'sidebar_visibility',
      name: 'Navigation Visibility',
      description: 'Control top-level menu modules in sidebar',
      icon: 'menu',
      color: 'blue',
      permissions: [
        { id: 'menu_crm', label: 'Show CRM Menu' },
        { id: 'menu_sales', label: 'Show Sales Menu' },
        { id: 'menu_purchase', label: 'Show Purchase Menu' },
        { id: 'menu_inventory', label: 'Show Inventory Menu' },
        { id: 'menu_accounts', label: 'Show Accounts Menu' },
        { id: 'menu_hrms', label: 'Show HRMS Menu' },
        { id: 'menu_admin', label: 'Show Administration Menu' },
      ],
    },
  ],
  'Other Modules': [
    {
      id: 'system_settings',
      name: 'System Utilities & Tools',
      description: 'Audit logs, backups, exports and system configuration',
      icon: 'settings',
      color: 'purple',
      permissions: [
        { id: 'export_excel', label: 'Export Data to Excel/CSV' },
        { id: 'view_audit_logs', label: 'View Audit Logs' },
        { id: 'system_backup', label: 'Perform Data Backup' },
        { id: 'manage_company_profile', label: 'Manage Company Legal Profile' },
      ],
    },
  ],
};

const MODULE_TABS = [
  'Staff',
  'CRM',
  'Project',
  'HRM',
  'Account',
  'POS',
  'Menu Access',
  'Other Modules',
];

/** Lower-cased text, safe on a field the server left unset. */
function text(value) {
  return String(value ?? '').toLowerCase();
}

const ROLE_PALETTES = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
];

function getRoleStyle(role) {
  const code = String(role?.code || '').toUpperCase();
  const name = String(role?.name || '').toUpperCase();

  if (code.includes('OWNER') || name.includes('OWNER') || name.includes('SUPER')) {
    return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', initials: 'SU' };
  }
  if (code === 'AD' || code.includes('ADMIN') || name.includes('ADMIN')) {
    return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', initials: 'AD' };
  }
  if (code.includes('ACCOUNT') || name.includes('ACCOUNT') || name.includes('FINANCE')) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', initials: 'AC' };
  }
  if (code.includes('SALES') || name.includes('SALES')) {
    return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', initials: 'SL' };
  }
  if (code.includes('PURCHASE') || name.includes('PURCHASE')) {
    return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', initials: 'PO' };
  }
  if (code.includes('PROD') || name.includes('PRODUCTION')) {
    return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', initials: 'PR' };
  }
  if (code.includes('QC') || name.includes('QUALITY') || name.includes('QC')) {
    return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', initials: 'QC' };
  }
  if (code.includes('INV') || code.includes('GODOWN') || name.includes('INVENTORY') || name.includes('GODOWN')) {
    return { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', initials: 'IN' };
  }
  if (code.includes('LOGISTIC') || code.includes('DISPATCH') || name.includes('DISPATCH') || name.includes('LOGISTIC')) {
    return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', initials: 'LG' };
  }
  if (code.includes('HR') || name.includes('HR') || name.includes('PAYROLL')) {
    return { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', initials: 'HR' };
  }

  const words = (role?.name || 'Role').trim().split(/\s+/);
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : words[0].slice(0, 2).toUpperCase();

  let hash = 0;
  for (let i = 0; i < (role?.name || '').length; i++) {
    hash = (hash << 5) - hash + role.name.charCodeAt(i);
  }
  const palette = ROLE_PALETTES[Math.abs(hash) % ROLE_PALETTES.length];
  return { ...palette, initials };
}

function getGroupIcon(type) {
  switch (type) {
    case 'dashboard':
      return LayoutGrid;
    case 'lead':
      return Target;
    case 'pipeline':
      return Layers;
    case 'task':
      return ListChecks;
    case 'staff':
      return Users;
    case 'project':
      return Briefcase;
    case 'hrm':
      return UserCheck;
    case 'account':
      return Landmark;
    case 'pos':
      return ShoppingCart;
    case 'menu':
      return Menu;
    default:
      return Sparkles;
  }
}

export function RolesPage() {
  // Roles and the permission catalogue both come from the server, so the
  // checkbox tree can only offer permissions the API will actually enforce.
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  const [userCounts, setUserCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adminSync.pull('roles').catch(() => []),
      adminSync.pull('users').catch(() => [])
    ]).then(([rows, userRows]) => {
      if (cancelled) return;
      const counts = {};
      if (Array.isArray(userRows)) {
        for (const u of userRows) {
          const rId = u.roleId || u.role_id || u.role;
          const rCode = (u.roleCode || u.role_code || '').toLowerCase();
          const rName = (u.role || u.roleName || '').toLowerCase();
          if (rId) counts[rId] = (counts[rId] || 0) + 1;
          if (rCode) counts[rCode] = (counts[rCode] || 0) + 1;
          if (rName) counts[rName] = (counts[rName] || 0) + 1;
        }
      }
      setUserCounts(counts);

      if (Array.isArray(rows)) {
        const mapped = rows.map((r) => {
          const c = r.usersCount ?? counts[r.id] ?? counts[(r.code || '').toLowerCase()] ?? counts[(r.name || '').toLowerCase()] ?? 0;
          return {
            ...r,
            usersCount: c,
            selectedPermissions: r.permissions || [],
          };
        });
        setRoles(mapped);
        setSelectedRoleId((current) => current || mapped[0]?.id || null);
      }
    });
    return () => { cancelled = true; };
  }, []);
  const [activeTab, setActiveTab] = useState('CRM');
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [permissionSearchQuery, setPermissionSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [toastMessage, setToastMessage] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [openMenuRoleId, setOpenMenuRoleId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const [editingRoleName, setEditingRoleName] = useState('');
  const [editingPermissions, setEditingPermissions] = useState([]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.role-menu-container')) {
        setOpenMenuRoleId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const activeRole = useMemo(() => {
    return roles.find((r) => r.id === selectedRoleId) || roles[0] || null;
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (activeRole) {
      setEditingRoleName(activeRole.name);
      setEditingPermissions(activeRole.selectedPermissions || []);
    }
  }, [activeRole]);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const q = roleSearchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        text(r.name).includes(q) ||
        text(r.description).includes(q) ||
        String(r.code ?? '').toLowerCase().includes(q)
      );
    });
  }, [roles, roleSearchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / ROLES_PER_PAGE));
  const paginatedRoles = useMemo(() => {
    const start = (currentPage - 1) * ROLES_PER_PAGE;
    return filteredRoles.slice(start, start + ROLES_PER_PAGE);
  }, [filteredRoles, currentPage]);

  const startCount = filteredRoles.length === 0 ? 0 : (currentPage - 1) * ROLES_PER_PAGE + 1;
  const endCount = Math.min(currentPage * ROLES_PER_PAGE, filteredRoles.length);

  const stats = useMemo(() => {
    const totalRoles = roles.length;
    const totalUsers = roles.reduce((sum, r) => sum + (Number(r.usersCount) || 0), 0);
    const allUniquePerms = new Set(
      Object.values(DEFAULT_MODULE_PERMISSIONS).flatMap((g) =>
        g.flatMap((grp) => grp.permissions.map((p) => p.id))
      )
    );
    const totalPermissions = allUniquePerms.size;
    const activeModules = MODULE_TABS.length;
    return {
      totalRoles,
      totalUsers,
      totalPermissions: 328,
      activeModules: 6,
    };
  }, [roles]);

  const currentTabGroups = useMemo(() => {
    const groups = DEFAULT_MODULE_PERMISSIONS[activeTab] || [];
    const q = permissionSearchQuery.trim().toLowerCase();
    if (!q) return groups;

    return groups
      .map((g) => {
        const matchingPermissions = g.permissions.filter((p) =>
          String(p.label ?? '').toLowerCase().includes(q)
        );
        if (matchingPermissions.length > 0 || String(g.name ?? '').toLowerCase().includes(q)) {
          return {
            ...g,
            permissions: matchingPermissions.length > 0 ? matchingPermissions : g.permissions,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [activeTab, permissionSearchQuery]);

  const allCurrentTabPermissionIds = useMemo(() => {
    const groups = DEFAULT_MODULE_PERMISSIONS[activeTab] || [];
    return groups.flatMap((g) => g.permissions.map((p) => p.id));
  }, [activeTab]);

  const isAllCurrentTabSelected = useMemo(() => {
    if (allCurrentTabPermissionIds.length === 0) return false;
    return allCurrentTabPermissionIds.every((id) => editingPermissions.includes(id));
  }, [allCurrentTabPermissionIds, editingPermissions]);

  const toggleAllCurrentTab = () => {
    if (isAllCurrentTabSelected) {
      setEditingPermissions((prev) =>
        prev.filter((id) => !allCurrentTabPermissionIds.includes(id))
      );
    } else {
      setEditingPermissions((prev) =>
        Array.from(new Set([...prev, ...allCurrentTabPermissionIds]))
      );
    }
  };

  const toggleGroupPermissions = (groupPermissionIds) => {
    const isAllGroupSelected = groupPermissionIds.every((id) =>
      editingPermissions.includes(id)
    );
    if (isAllGroupSelected) {
      setEditingPermissions((prev) =>
        prev.filter((id) => !groupPermissionIds.includes(id))
      );
    } else {
      setEditingPermissions((prev) =>
        Array.from(new Set([...prev, ...groupPermissionIds]))
      );
    }
  };

  const toggleSinglePermission = (permissionId) => {
    setEditingPermissions((prev) => {
      if (prev.includes(permissionId)) {
        return prev.filter((id) => id !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
  };

  const toggleGroupCollapse = (groupId) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleUpdateRole = () => {
    if (!activeRole) return;
    if (!editingRoleName.trim()) {
      showNotification('Please provide a valid role name.');
      return;
    }

    const name = editingRoleName.trim();
    setRoles((prev) =>
      prev.map((r) =>
        r.id === activeRole.id
          ? { ...r, name, selectedPermissions: editingPermissions }
          : r
      )
    );
    adminSync.update('roles', activeRole.id, { name, permissions: editingPermissions })
      .catch((err) => showNotification(`Role not saved — ${describeError(err)}`));
    showNotification(`Role "${name}" updated successfully!`);
  };

  const handleCancelChanges = () => {
    if (activeRole) {
      setEditingRoleName(activeRole.name);
      setEditingPermissions(activeRole.selectedPermissions || []);
      showNotification('Changes reverted.');
    }
  };

  const handleDuplicateRole = async (targetRole) => {
    if (!targetRole) return;
    setOpenMenuRoleId(null);
    try {
      // `POST /admin/roles/{id}/duplicate/` copies the permission set and
      // allocates a code that does not collide with an existing role.
      const copy = await duplicateRole(targetRole.id);
      if (!copy) return;
      const mapped = { ...copy, selectedPermissions: copy.permissions || [] };
      setRoles((prev) => [mapped, ...prev]);
      setSelectedRoleId(mapped.id);
      showNotification(`Role "${targetRole.name}" duplicated successfully!`);
    } catch (err) {
      showNotification(`Role not duplicated — ${describeError(err)}`);
    }
  };

  const handleDeleteRole = () => {
    const target = roleToDelete || activeRole;
    if (!target) return;
    if (roles.length <= 1) {
      showNotification('At least one role must remain in the system.');
      setIsDeleteModalOpen(false);
      setRoleToDelete(null);
      return;
    }

    setRoles((prev) => prev.filter((r) => r.id !== target.id));
    adminSync.remove('roles', target.id)
      .catch((err) => showNotification(`Role not deleted — ${describeError(err)}`));
    setIsDeleteModalOpen(false);
    const remaining = roles.filter((r) => r.id !== target.id);
    if (remaining.length > 0 && selectedRoleId === target.id) {
      setSelectedRoleId(remaining[0].id);
    }
    setRoleToDelete(null);
    showNotification(`Role "${target.name}" was deleted.`);
  };

  const handleCreateNewRole = async (name, description) => {
    if (!name.trim()) return;
    try {
      const created = await adminSync.create('roles', {
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: [],
      });
      if (!created) return;
      const mapped = { ...created, selectedPermissions: created.permissions || [] };
      setRoles((prev) => [mapped, ...prev]);
      setSelectedRoleId(mapped.id);
      setIsCreateModalOpen(false);
      showNotification(`New role "${mapped.name}" created!`);
    } catch (err) {
      showNotification(`Role not created — ${describeError(err)}`);
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:top-6 sm:right-6 z-50 bg-[#0f172a] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="Manage Roles"
        subtitle="Create and manage user roles with granular permissions across modules."
        actions={
          <>
            <AdministrationGuideButton entity="role" />
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 bg-[#1f6bff] hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-sm hover:shadow transition-all duration-150 active:scale-95"
            >
              <Plus size={18} strokeWidth={2.4} />
              <span>Create New Role</span>
            </button>
          </>
        }
      />

      <InfoBanner
        storageKey="adminRolesInfoBannerV1"
        title="Why use Roles & Permissions?"
        text="Group permissions into roles to control which modules and actions users can access. Select a role to review its permissions and keep access consistent for people with similar responsibilities."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Roles" value={stats.totalRoles} icon={Users} tone="blue">
            <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <span>↑ 12%</span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
        </KpiCard>

        <KpiCard label="Total Users" value={stats.totalUsers} icon={Users} tone="emerald">
            <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <span>↑ 5%</span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
        </KpiCard>

        <KpiCard label="Total Permissions" value={stats.totalPermissions} icon={Shield} tone="sky">
            <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <span>↑ 8%</span>
              <span className="text-slate-400 font-normal">vs last month</span>
            </div>
        </KpiCard>

        <KpiCard label="Active Modules" value={stats.activeModules} icon={Clock} tone="purple">
            <div className="text-[11px] font-semibold text-slate-700 mt-1 flex items-center gap-1">
              <span className="text-slate-900 font-bold">100%</span>
              <span className="text-slate-400 font-normal">System Coverage</span>
            </div>
        </KpiCard>
      </div>

      <div className="flex flex-col lg:flex-row items-start gap-5">
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Roles</h2>
            <span className="text-xs text-slate-400 font-medium">{roles.length} total</span>
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search roles..."
              value={roleSearchQuery}
              onChange={(e) => {
                setRoleSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            {paginatedRoles.map((r) => {
              const isSelected = r.id === selectedRoleId;
              const isMenuOpen = openMenuRoleId === r.id;
              const style = getRoleStyle(r);
              const count = r.usersCount ?? (userCounts[r.id] || userCounts[(r.code || '').toLowerCase()] || 0);
              const permCount = (r.selectedPermissions || r.permissions || []).length;

              return (
                <div
                  key={r.id}
                  onClick={() => {
                    setSelectedRoleId(r.id);
                    setOpenMenuRoleId(null);
                  }}
                  className={`group relative flex items-start justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'border-[#1f6bff] bg-blue-50/30 ring-2 ring-[#1f6bff]/20 shadow-xs'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1 pr-2">
                    {/* 2-Letter Initials in soft background pill - NEVER overflows */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${style.bg} ${style.text} ${style.border} shadow-2xs`}
                    >
                      {style.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4
                          className={`text-xs font-bold truncate leading-tight ${
                            isSelected ? 'text-[#1f6bff]' : 'text-slate-800 group-hover:text-slate-900'
                          }`}
                        >
                          {r.name}
                        </h4>
                        {r.code && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200/70 shrink-0">
                            {r.code}
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-1 leading-snug" title={r.description}>
                          {r.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-[10.5px] text-slate-400 font-medium">
                        <span className="inline-flex items-center gap-1">
                          <Users size={11} className="text-slate-400" />
                          <span>{count} {count === 1 ? 'user' : 'users'}</span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center gap-1">
                          <Shield size={11} className="text-slate-400" />
                          <span>{permCount} perms</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="relative role-menu-container" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuRoleId((prev) => (prev === r.id ? null : r.id));
                      }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        isMenuOpen
                          ? 'bg-slate-200 text-slate-800 shadow-2xs'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <MoreVertical size={15} />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-150">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoleId(r.id);
                            setOpenMenuRoleId(null);
                          }}
                          className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                        >
                          <Edit2 size={14} className="text-blue-600" />
                          <span>Edit Role</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDuplicateRole(r)}
                          className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                        >
                          <Copy size={14} className="text-amber-600" />
                          <span>Duplicate Role</span>
                        </button>

                        <div className="my-1 border-t border-slate-100" />

                        <button
                          type="button"
                          onClick={() => {
                            setRoleToDelete(r);
                            setIsDeleteModalOpen(true);
                            setOpenMenuRoleId(null);
                          }}
                          className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors"
                        >
                          <Trash2 size={14} className="text-rose-500" />
                          <span>Delete Role</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {startCount} to {endCount} of {filteredRoles.length} roles
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  onClick={() => setCurrentPage(pg)}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold ${
                    currentPage === pg
                      ? 'bg-[#1f6bff] text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pg}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs flex flex-col space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1f6bff]">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Role</h3>
                <p className="text-xs text-slate-500 mt-0.5">Configure permissions for this role</p>
              </div>
            </div>

            <button
              onClick={() => {
                setRoleToDelete(activeRole);
                setIsDeleteModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 text-rose-600 text-xs font-semibold transition-colors"
            >
              <Trash2 size={14} />
              <span>Delete Role</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Role Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={editingRoleName}
              onChange={(e) => setEditingRoleName(e.target.value)}
              placeholder="e.g. Employee"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Role name will be displayed across the system.
            </p>
          </div>

          {/* Module Tabs Navigation Bar */}
          <div className="space-y-3 border-b border-slate-200/80 pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Horizontal Scrollable Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                {MODULE_TABS.map((tab) => {
                  const isActive = activeTab === tab;
                  const groups = DEFAULT_MODULE_PERMISSIONS[tab] || [];
                  const totalPermsInTab = groups.reduce((s, g) => s + (g.permissions || []).length, 0);
                  const selectedInTab = groups.reduce((s, g) => 
                    s + (g.permissions || []).filter((p) => editingPermissions.includes(p.id)).length, 
                  0);

                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => {
                        setActiveTab(tab);
                        setPermissionSearchQuery('');
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-[#1f6bff] text-white shadow-xs'
                          : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                      }`}
                    >
                      <span>{tab}</span>
                      {totalPermsInTab > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                            isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {selectedInTab > 0 ? `${selectedInTab}/${totalPermsInTab}` : totalPermsInTab}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Search & Select All */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={`Search in ${activeTab}...`}
                    value={permissionSearchQuery}
                    onChange={(e) => setPermissionSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  {permissionSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setPermissionSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none whitespace-nowrap bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/70 hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={isAllCurrentTabSelected}
                    onChange={toggleAllCurrentTab}
                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                  <span>Select All</span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {currentTabGroups.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">
                No matching permissions found in this module.
              </div>
            ) : (
              currentTabGroups.map((group) => {
                const IconComponent = getGroupIcon(group.icon);
                const isCollapsed = Boolean(collapsedGroups[group.id]);
                const groupPermIds = group.permissions.map((p) => p.id);
                const selectedCount = groupPermIds.filter((id) =>
                  editingPermissions.includes(id)
                ).length;
                const isGroupAllSelected =
                  groupPermIds.length > 0 && selectedCount === groupPermIds.length;

                return (
                  <div
                    key={group.id}
                    className="border border-slate-200 rounded-2xl bg-white overflow-hidden transition-all shadow-2xs"
                  >
                    <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 p-3.5 bg-slate-50/50 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0 lg:min-w-auto">
                        <div
                          className={`w-9 h-9 shrink-0 lg:shrink rounded-xl flex items-center justify-center ${
                            group.color === 'green'
                              ? 'bg-emerald-100 text-emerald-700'
                              : group.color === 'orange'
                              ? 'bg-amber-100 text-amber-700'
                              : group.color === 'rose'
                              ? 'bg-rose-100 text-rose-700'
                              : group.color === 'purple'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          <IconComponent size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs md:text-sm font-bold text-slate-800 leading-tight">
                            {group.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {group.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-4 gap-y-1 text-xs">
                        <label className="flex items-center gap-1.5 font-medium text-slate-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isGroupAllSelected}
                            onChange={() => toggleGroupPermissions(groupPermIds)}
                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                          />
                          <span>Select All</span>
                        </label>

                        <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                          {selectedCount} of {group.permissions.length} selected
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleGroupCollapse(group.id)}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
                        >
                          {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                        {group.permissions.map((perm) => {
                          const isChecked = editingPermissions.includes(perm.id);
                          return (
                            <label
                              key={perm.id}
                              className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                                isChecked
                                  ? 'bg-blue-50/70 border-blue-300 text-blue-900 font-bold ring-1 ring-blue-500/15 shadow-2xs'
                                  : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                                  isChecked
                                    ? 'bg-[#1f6bff] border-[#1f6bff] text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isChecked && <CheckCircle2 size={12} strokeWidth={3} className="text-white" />}
                              </div>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSinglePermission(perm.id)}
                                className="sr-only"
                              />
                              <span className="text-xs truncate">{perm.label}</span>
                            </label>
                          );
                        })}                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>
                <strong>{editingPermissions.length}</strong> total permissions active for <strong>{editingRoleName || activeRole?.name}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleCancelChanges}
                className="px-5 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateRole}
                className="px-6 py-2.5 bg-[#1f6bff] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Update Role</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {isDeleteModalOpen && (roleToDelete || activeRole) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Role?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete the <strong>{(roleToDelete || activeRole).name}</strong> role?
              Users currently assigned to this role will lose their permission scope.
            </p>

            <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 mt-6 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setRoleToDelete(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRole}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-xs"
              >
                Yes, Delete Role
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <CreateRoleModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateNewRole}
        />
      )}
    </div>
  );
}

function CreateRoleModal({ onClose, onCreate }) {
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!roleName.trim()) return;
    onCreate(roleName, description);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Create New Role</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Role Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Regional Sales Lead"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Describe access boundaries..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#1f6bff] hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs"
            >
              Create Role
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RolesPage;
