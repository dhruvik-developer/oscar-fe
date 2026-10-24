import InfoBanner from '../../components/ui/InfoBanner';
import PageHeader from '../../components/ui/PageHeader';
import AdministrationGuideButton from './AdministrationGuideButton';
import KpiCard from '../../components/ui/KpiCard';
import { useAppStore } from '../../stores/appStore';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  adminSync,
  activateUser,
  deactivateUser,
  setUserPermissions,
  pullPermissionCatalogue,
  describeError,
} from '../../services/adminSync';
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  Search,
  RotateCcw,
  Plus,
  MoreVertical,
  X,
  Mail,
  Phone,
  Calendar,
  Clock,
  User,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  List,
  Edit2,
  KeyRound,
  Trash2,
  UserMinus,
  UserPlus,
  ShieldCheck,
  Eye,
  AlertTriangle,
  Briefcase,
} from 'lucide-react';

const USERS_PER_PAGE = 16;

// Temporary password from the browser's cryptographic RNG; the user changes it on first login.
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const body = Array.from(bytes, (b) => chars[b % chars.length]).join('');
  return `${body}@${(bytes[0] % 90) + 10}`;
}

/**
 * Case-insensitive contains, safe on a field the server left unset — a user can
 * exist before they have been given a role, a department or an employee number.
 */
function matches(value, query) {
  if (!query) return false;
  return String(value || '').toLowerCase().includes(query);
}

/**
 * Tailwind classes for a role chip. The colour is derived from the role name so
 * a role added on the server gets a stable chip without a frontend change.
 */
const ROLE_BADGE_STYLES = [
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
  'bg-indigo-50 text-indigo-700 border-indigo-200',
];

function getRoleBadgeStyle(role) {
  const key = String(role || '');
  if (!key) return 'bg-slate-100 text-slate-600 border-slate-200';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return ROLE_BADGE_STYLES[Math.abs(hash) % ROLE_BADGE_STYLES.length];
}

export function getUserInitials(name = '') {
  if (!name || typeof name !== 'string') return 'U';
  const clean = name.trim();
  if (!clean) return 'U';
  const words = clean.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (words.length === 0) return clean.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const AVATAR_GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-600 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-fuchsia-600 to-pink-500',
  'from-indigo-500 to-cyan-600',
];

function getUserAvatarGradient(name = '') {
  const key = String(name || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function UserAvatar({ user, size = 'md', className = '' }) {
  const [imgError, setImgError] = useState(false);
  const avatarSrc = user?.avatar;

  useEffect(() => {
    setImgError(false);
  }, [avatarSrc]);

  const name = user?.name || user?.username || user?.email || 'User';
  const initials = getUserInitials(name);
  const gradient = getUserAvatarGradient(name);

  const sizeMap = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-14 h-14 text-base font-bold',
  };
  const sizeClass = sizeMap[size] || sizeMap.md;

  const hasImage = Boolean(avatarSrc) && !imgError && !avatarSrc.includes('ui-avatars.com');

  if (hasImage) {
    return (
      <img
        src={avatarSrc}
        alt={name}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-slate-100 shadow-xs flex-shrink-0 ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-tr ${gradient} text-white font-bold flex items-center justify-center shrink-0 shadow-xs ring-2 ring-slate-100 select-none tracking-wider ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
}

export function UsersPage() {
  // ── Users, from /admin/users/ ────────────────────────────────
  const [users, setUsers] = useState([]);

  // The permission catalogue the server will actually enforce.
  const [permissionModules, setPermissionModules] = useState([]);
  useEffect(() => {
    let cancelled = false;
    pullPermissionCatalogue().then((modules) => {
      if (!cancelled && modules) setPermissionModules(modules);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminSync.pull('users').then((rows) => {
      if (cancelled || !rows) return;
      setUsers(rows);
      setSelectedUserId((current) => current || rows[0]?.id || null);
    });
    return () => { cancelled = true; };
  }, []);

  // ── State for Filter & Search ────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedSource, setSelectedSource] = useState('All Sources');
  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);

  // ── Selected User for Side Drawer ────────────────────────────
  const [selectedUserId, setSelectedUserId] = useState('usr-1');
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  // ── Modals State ─────────────────────────────────────────────
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToModify, setUserToModify] = useState(null);

  // ── Form State for Create / Edit ─────────────────────────────
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'BDE',
    department: 'Sales',
    status: 'Active',
    employeeId: '',
    location: 'Mumbai, India',
    reportingManager: 'Jayesh Nair',
    permissions: ['View Leads', 'Create Tasks', 'Manage Deals'],
  });

  // ── Password Reset State ─────────────────────────────────────
  const [newPassword, setNewPassword] = useState('Evenmore@2026!');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // ── Notification toast ───────────────────────────────────────
  const [toastMessage, setToastMessage] = useState(null);
  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ── Active User in Detail Drawer ─────────────────────────────
  const activeUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId) || users[0] || null;
  }, [users, selectedUserId]);

  // ── Dynamic Roles & Departments list for Dropdowns ───────────
  const uniqueRoles = useMemo(() => {
    const set = new Set(users.map((u) => u.role));
    return ['All Roles', ...Array.from(set)];
  }, [users]);

  const uniqueDepartments = useMemo(() => {
    const set = new Set(users.map((u) => u.department).filter(Boolean));
    return ['All Departments', ...Array.from(set)];
  }, [users]);

  // ── Filtering Logic ──────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        matches(u.name, q) ||
        matches(u.email, q) ||
        matches(u.role, q) ||
        matches(u.department, q) ||
        matches(u.designation, q) ||
        matches(u.employeeId, q);

      const matchesRole = selectedRole === 'All Roles' || u.role === selectedRole;
      const matchesDept = selectedDepartment === 'All Departments' || u.department === selectedDepartment;
      const matchesStatus = selectedStatus === 'All Status' || u.status === selectedStatus;
      // Staff who came in through HRMS are the employees; the rest were
      // created on this screen. Neither set is hidden, they are just a cut.
      const matchesSource =
        selectedSource === 'All Sources'
          || (selectedSource === 'From HRMS' && u.isFromHrms)
          || (selectedSource === 'Direct Accounts' && !u.isFromHrms);

      return matchesSearch && matchesRole && matchesDept && matchesStatus && matchesSource;
    });
  }, [users, searchQuery, selectedRole, selectedDepartment, selectedStatus, selectedSource]);

  // ── Pagination Calculation ───────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const startCount = filteredUsers.length === 0 ? 0 : (currentPage - 1) * USERS_PER_PAGE + 1;
  const endCount = Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length);

  // ── Stats Summary Calculation ────────────────────────────────
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === 'Active').length;
    const inactive = users.filter((u) => u.status === 'Inactive').length;
    const admins = users.filter(
      (u) =>
        matches(u.role, 'admin') ||
        matches(u.role, 'director') ||
        matches(u.department, 'executive')
    ).length;
    // Synced from HRMS: an account exists for this many of your employees.
    const employees = users.filter((u) => u.isFromHrms).length;
    return { total, active, inactive, admins, employees };
  }, [users]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedRole('All Roles');
    setSelectedDepartment('All Departments');
    setSelectedStatus('All Status');
    setSelectedSource('All Sources');
    setCurrentPage(1);
  };

  const handleCardClick = (user) => {
    setSelectedUserId(user.id);
    setIsDrawerOpen(true);
  };

  const openCreateModal = () => {
    const nextEmpNum = users.length + 1;
    setUserForm({
      name: '',
      email: '',
      phone: '+91 ',
      role: 'Sales support execut.',
      department: 'Sales',
      status: 'Active',
      employeeId: `EMP00${nextEmpNum < 10 ? '0' + nextEmpNum : nextEmpNum}`,
      location: 'Mumbai, India',
      reportingManager: 'Jayesh Nair',
      permissions: ['View Leads', 'Manage Deals', 'Create Tasks', 'View Reports'],
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email) return;

    let newUser;
    try {
      newUser = await adminSync.create('users', {
        name: userForm.name,
        email: userForm.email,
        phone: userForm.phone,
        role: userForm.role,
        roleId: userForm.roleId,
        department: userForm.department,
        status: userForm.status,
        employeeId: userForm.employeeId,
        location: userForm.location,
        reportingManager: userForm.reportingManager,
      });
    } catch (err) {
      showNotification(`User not created — ${describeError(err)}`);
      return;
    }
    if (!newUser) return;

    setUsers((prev) => [newUser, ...prev]);
    setSelectedUserId(newUser.id);
    setIsCreateModalOpen(false);
    showNotification(`User "${newUser.name}" successfully created!`);
    useAppStore.getState().refreshHrms?.('employees');
  };

  const openEditModal = (user) => {
    const target = user || activeUser;
    if (!target) return;
    setUserToModify(target);
    setUserForm({
      name: target.name,
      email: target.email,
      phone: target.phone,
      role: target.role,
      department: target.department,
      status: target.status,
      employeeId: target.employeeId,
      location: target.location,
      reportingManager: target.reportingManager,
      permissions: target.permissions || [],
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!userToModify) return;

    const updates = {
      name: userForm.name,
      email: userForm.email,
      phone: userForm.phone,
      role: userForm.role,
      roleId: userForm.roleId,
      department: userForm.department,
      status: userForm.status,
      employeeId: userForm.employeeId,
      location: userForm.location,
      reportingManager: userForm.reportingManager,
    };
    setUsers((prev) => prev.map((u) => (u.id === userToModify.id ? { ...u, ...updates } : u)));
    adminSync.update('users', userToModify.id, updates)
      .then((saved) => {
        if (saved) setUsers((prev) => prev.map((u) => (u.id === saved.id ? saved : u)));
      })
      .catch((err) => showNotification(`Change not saved — ${describeError(err)}`));
    setIsEditModalOpen(false);
    showNotification(`User details updated for "${userForm.name}"!`);
    useAppStore.getState().refreshHrms?.('employees');
  };

  const handleToggleStatus = (user) => {
    const target = user || activeUser;
    if (!target) return;
    const newStatus = target.status === 'Active' ? 'Inactive' : 'Active';
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, status: newStatus } : u))
    );
    // Activation is its own endpoint: it also ends the user's open sessions.
    (newStatus === 'Active' ? activateUser(target.id) : deactivateUser(target.id))
      .catch((err) => showNotification(`Status not saved — ${describeError(err)}`));
    showNotification(`User "${target.name}" is now marked as ${newStatus}.`);
    useAppStore.getState().refreshHrms?.('employees');
  };

  const openDeleteModal = (user) => {
    const target = user || activeUser;
    if (!target) return;
    setUserToModify(target);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteUser = () => {
    if (!userToModify) return;
    setUsers((prev) => prev.filter((u) => u.id !== userToModify.id));
    adminSync.remove('users', userToModify.id)
      .catch((err) => showNotification(`User not deleted — ${describeError(err)}`));
    setIsDeleteModalOpen(false);
    useAppStore.getState().refreshHrms?.('employees');
    if (selectedUserId === userToModify.id) {
      const remaining = users.filter((u) => u.id !== userToModify.id);
      if (remaining.length > 0) setSelectedUserId(remaining[0].id);
    }
    showNotification(`User "${userToModify.name}" has been removed.`);
  };

  const openResetPasswordModal = (user) => {
    const target = user || activeUser;
    if (!target) return;
    setUserToModify(target);
    setNewPassword('Evenmore@2026!');
    setPasswordSuccess(false);
    setIsResetPasswordModalOpen(true);
  };

  const handlePasswordResetSubmit = (e) => {
    e.preventDefault();
    setPasswordSuccess(true);
    setTimeout(() => {
      setIsResetPasswordModalOpen(false);
      setPasswordSuccess(false);
      showNotification(`Password has been reset for "${userToModify?.name}".`);
    }, 1200);
  };

  const openPermissionsModal = (user) => {
    const target = user || activeUser;
    if (!target) return;
    setUserToModify(target);
    setUserForm((prev) => ({ ...prev, permissions: target.permissions || [] }));
    setIsPermissionsModalOpen(true);
  };

  const togglePermissionItem = (permLabel) => {
    setUserForm((prev) => {
      const current = prev.permissions || [];
      if (current.includes(permLabel)) {
        return { ...prev, permissions: current.filter((p) => p !== permLabel) };
      } else {
        return { ...prev, permissions: [...current, permLabel] };
      }
    });
  };

  const handleSavePermissions = () => {
    if (!userToModify) return;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userToModify.id ? { ...u, permissions: userForm.permissions } : u
      )
    );
    setUserPermissions(userToModify.id, userForm.permissions)
      .catch((err) => showNotification(`Permissions not saved — ${describeError(err)}`));
    setIsPermissionsModalOpen(false);
    showNotification(`Permissions updated for "${userToModify.name}".`);
  };

  return (
    <div className="space-y-6">
      {/* ── Toast Notification ─────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:top-6 sm:right-6 z-50 bg-[#0f172a] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ── Breadcrumb & Page Header ───────────────────────────── */}
      <PageHeader
        title="Manage Users"
        subtitle="View, manage and assign roles to your team members."
        actions={
          <>
            <AdministrationGuideButton entity="user" />
            <button
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 bg-[#1f6bff] hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-sm hover:shadow transition-all duration-150 active:scale-95"
            >
              <Plus size={18} strokeWidth={2.4} />
              <span>Create User</span>
            </button>
          </>
        }
      />

      {/* ── Top Metric / Stat Cards (4 Cards) ──────────────────── */}
      <InfoBanner
        storageKey="adminUsersInfoBannerV1"
        title="Why use User Management?"
        text="Create user accounts, assign roles and manage active or inactive status. Keep team details up to date so each person has the right access for their responsibilities."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Users" value={stats.total} icon={Users} tone="blue" />
        <KpiCard label="Active Users" value={stats.active} icon={UserCheck} tone="emerald" />
        <KpiCard label="Inactive Users" value={stats.inactive} icon={UserX} tone="rose" />
        <KpiCard label="Administrators" value={stats.admins} icon={Shield} tone="purple" />
        <KpiCard label="Synced from HRMS" value={stats.employees} icon={Briefcase} tone="purple" />
      </div>

      {/* ── Search & Filter Bar ────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name, email, role..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs md:text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="h-5 w-px bg-slate-200 hidden md:block" />

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Dropdown */}
          <div className="relative min-w-[140px]">
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {uniqueRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Department Dropdown */}
          <div className="relative min-w-[140px]">
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {uniqueDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Dropdown */}
          <div className="relative min-w-[110px]">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All Status">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Source Dropdown — employees synced from HRMS vs accounts made here */}
          <div className="relative min-w-[140px]">
            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All Sources">All Sources</option>
              <option value="From HRMS">From HRMS</option>
              <option value="Direct Accounts">Direct Accounts</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Reset Button */}
          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-colors"
            title="Reset Filters"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>

        <div className="flex items-center gap-1 self-end md:self-auto md:ml-auto">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl border transition-all ${
              viewMode === 'grid'
                ? 'bg-[#1f6bff] border-[#1f6bff] text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Grid View"
            aria-label="Grid View"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-xl border transition-all ${
              viewMode === 'list'
                ? 'bg-[#1f6bff] border-[#1f6bff] text-white shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="List View"
            aria-label="List View"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* ── Main Layout: Grid + Drawer ─────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-start gap-5">
        {/* User Cards Grid Area */}
        <div className="flex-1 w-full space-y-5">
          {paginatedUsers.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <UserX size={44} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">No users found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No users match your active search and filter criteria. Try resetting the filters.
              </p>
              <button
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-semibold hover:bg-blue-100"
              >
                Reset All Filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div
              className={`grid gap-3.5 ${
                isDrawerOpen
                  ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                  : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
              }`}
            >
              {paginatedUsers.map((user) => {
                const isSelected = selectedUserId === user.id && isDrawerOpen;
                return (
                  <UserCardItem
                    key={user.id}
                    user={user}
                    isSelected={isSelected}
                    onClick={() => handleCardClick(user)}
                    onEdit={() => openEditModal(user)}
                    onToggleStatus={() => handleToggleStatus(user)}
                    onResetPassword={() => openResetPasswordModal(user)}
                    onDelete={() => openDeleteModal(user)}
                    onViewPermissions={() => openPermissionsModal(user)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedUsers.map((user) => {
                const isSelected = selectedUserId === user.id && isDrawerOpen;
                return (
                  <UserListItem
                    key={user.id}
                    user={user}
                    isSelected={isSelected}
                    onClick={() => handleCardClick(user)}
                    onEdit={() => openEditModal(user)}
                    onToggleStatus={() => handleToggleStatus(user)}
                    onResetPassword={() => openResetPasswordModal(user)}
                    onDelete={() => openDeleteModal(user)}
                    onViewPermissions={() => openPermissionsModal(user)}
                  />
                );
              })}
            </div>
          )}

          {/* ── Footer / Pagination ─────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold text-slate-800">{startCount}</span> to{' '}
              <span className="font-semibold text-slate-800">{endCount}</span> of{' '}
              <span className="font-semibold text-slate-800">{filteredUsers.length}</span> users
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                <button
                  key={pg}
                  onClick={() => setCurrentPage(pg)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                    currentPage === pg
                      ? 'bg-[#1f6bff] text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pg}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Side Details Panel ("User Details") ─────────── */}
        {isDrawerOpen && activeUser && (
          <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-5 sticky top-4 animate-in fade-in slide-in-from-right-4 duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">User Details</h2>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Close Drawer"
              >
                <X size={17} />
              </button>
            </div>

            {/* Profile Hero */}
            <div className="flex items-center gap-3.5">
              <UserAvatar user={activeUser} size="lg" />
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                  {activeUser.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      activeUser.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        activeUser.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    {activeUser.status}
                  </span>
                  {activeUser.isFromHrms && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700">
                      <Briefcase size={10} />
                      Synced from HRMS
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1 truncate">
                  {activeUser.role} | {activeUser.department}
                </div>
              </div>
            </div>

            {/* Contact & Date Info */}
            <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50/60 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2.5 truncate">
                <Mail size={14} className="text-slate-400 flex-shrink-0" />
                <span className="truncate">{activeUser.email}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone size={14} className="text-slate-400 flex-shrink-0" />
                <span>{activeUser.phone || '+91 98765 43210'}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                <span>Joined {activeUser.joinedFull || activeUser.joinedDate}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock size={14} className="text-slate-400 flex-shrink-0" />
                <span>Last Login {activeUser.lastLogin}</span>
              </div>
            </div>

            {/* Role & Department */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Role & Department
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2.5 text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl font-medium">
                  <User size={15} className="text-blue-600 flex-shrink-0" />
                  <span>{activeUser.role}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl font-medium">
                  <Building2 size={15} className="text-blue-600 flex-shrink-0" />
                  <span>{activeUser.department} Department</span>
                </div>
                {activeUser.designation && (
                  <div className="flex items-center gap-2.5 text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-xl font-medium">
                    <Briefcase size={15} className="text-blue-600 flex-shrink-0" />
                    <span>{activeUser.designation}</span>
                  </div>
                )}
              </div>
            </div>

            {/* HRMS record — the employee row this login was synced from.
                Read-only: HR owns it, and the next employee edit carries the
                change back here. */}
            {activeUser.isFromHrms && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  HRMS Record
                </h4>
                <div className="space-y-2 text-xs divide-y divide-slate-100 border border-slate-200 rounded-xl px-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-500">Employee ID</span>
                    <span className="font-semibold text-slate-800">{activeUser.employeeId || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-500">Designation</span>
                    <span className="font-semibold text-slate-800">{activeUser.designation || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-500">Employment Status</span>
                    <span className="font-semibold text-slate-800">{activeUser.employeeStatus || '—'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Permissions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Permissions
                </h4>
                <button
                  onClick={() => openPermissionsModal(activeUser)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-0.5"
                >
                  View All Permissions &gt;
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(activeUser.permissions || []).slice(0, 4).map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 bg-blue-50/80 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-lg text-[11px] font-medium"
                  >
                    <ShieldCheck size={12} className="text-blue-600" />
                    {p}
                  </span>
                ))}
                {(activeUser.permissions || []).length > 4 && (
                  <button
                    onClick={() => openPermissionsModal(activeUser)}
                    className="inline-flex items-center bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors"
                  >
                    +{activeUser.permissions.length - 4} more
                  </button>
                )}
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Additional Information
              </h4>
              <div className="space-y-2 text-xs divide-y divide-slate-100">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Location</span>
                  <span className="font-semibold text-slate-800">{activeUser.location}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Reporting Manager</span>
                  <span className="font-semibold text-slate-800">{activeUser.reportingManager}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-100 mt-auto">
              <button
                onClick={() => openEditModal(activeUser)}
                className="w-full py-2 px-3 bg-[#1f6bff] hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Edit2 size={14} />
                <span>Edit User</span>
              </button>

              <button
                onClick={() => openResetPasswordModal(activeUser)}
                className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <KeyRound size={14} className="text-slate-500" />
                <span>Reset Password</span>
              </button>

              <button
                onClick={() => handleToggleStatus(activeUser)}
                className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                {activeUser.status === 'Active' ? (
                  <>
                    <UserMinus size={14} className="text-slate-500" />
                    <span>Disable Login</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={14} className="text-emerald-600" />
                    <span>Enable Login</span>
                  </>
                )}
              </button>

              <button
                onClick={() => openDeleteModal(activeUser)}
                className="w-full py-2 px-3 bg-rose-50/60 hover:bg-rose-100/80 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 size={14} />
                <span>Delete User</span>
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* ── Modal 1: Create New User ────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create New User</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add a new team member and configure their role and permissions.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Sharma"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="ramesh@imtendoscopy.com"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    placeholder="EMP0027"
                    value={userForm.employeeId}
                    onChange={(e) => setUserForm({ ...userForm, employeeId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Accountant">Accountant</option>
                    <option value="BDE">BDE</option>
                    <option value="Tele sales coordinator">Tele sales coordinator</option>
                    <option value="Relation ship manager">Relation ship manager</option>
                    <option value="Sales support execut.">Sales support execut.</option>
                    <option value="Area sales manager">Area sales manager</option>
                    <option value="HR Manager">HR Manager</option>
                    <option value="Driver">Driver</option>
                    <option value="CIW">CIW</option>
                    <option value="DIC">DIC</option>
                    <option value="Employee">Employee</option>
                    <option value="Super Administrator">Super Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={userForm.department}
                    onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Accounts">Accounts</option>
                    <option value="HR">HR</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Executive">Executive</option>
                    <option value="Warehouse">Warehouse</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="Mumbai, India"
                    value={userForm.location}
                    onChange={(e) => setUserForm({ ...userForm, location: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reporting Manager</label>
                  <input
                    type="text"
                    placeholder="Mahesh Kubawat"
                    value={userForm.reportingManager}
                    onChange={(e) => setUserForm({ ...userForm, reportingManager: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-4 gap-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="Active"
                      checked={userForm.status === 'Active'}
                      onChange={() => setUserForm({ ...userForm, status: 'Active' })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-emerald-700 font-semibold">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="Inactive"
                      checked={userForm.status === 'Inactive'}
                      onChange={() => setUserForm({ ...userForm, status: 'Inactive' })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-rose-600 font-semibold">Inactive</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1f6bff] hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition-colors"
                >
                  Save & Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 2: Edit User ──────────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit User Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update profile information and credentials for {userToModify?.name}.
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={userForm.employeeId}
                    onChange={(e) => setUserForm({ ...userForm, employeeId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Accountant">Accountant</option>
                    <option value="BDE">BDE</option>
                    <option value="Tele sales coordinator">Tele sales coordinator</option>
                    <option value="Relation ship manager">Relation ship manager</option>
                    <option value="Sales support execut.">Sales support execut.</option>
                    <option value="Area sales manager">Area sales manager</option>
                    <option value="HR Manager">HR Manager</option>
                    <option value="Driver">Driver</option>
                    <option value="CIW">CIW</option>
                    <option value="DIC">DIC</option>
                    <option value="Employee">Employee</option>
                    <option value="Super Administrator">Super Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={userForm.department}
                    onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Accounts">Accounts</option>
                    <option value="HR">HR</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Executive">Executive</option>
                    <option value="Warehouse">Warehouse</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={userForm.location}
                    onChange={(e) => setUserForm({ ...userForm, location: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reporting Manager</label>
                  <input
                    type="text"
                    value={userForm.reportingManager}
                    onChange={(e) => setUserForm({ ...userForm, reportingManager: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-4 gap-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editStatus"
                      value="Active"
                      checked={userForm.status === 'Active'}
                      onChange={() => setUserForm({ ...userForm, status: 'Active' })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-emerald-700 font-semibold">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editStatus"
                      value="Inactive"
                      checked={userForm.status === 'Inactive'}
                      onChange={() => setUserForm({ ...userForm, status: 'Inactive' })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-rose-600 font-semibold">Inactive</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1f6bff] hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 3: View & Configure Permissions Matrix ─────────── */}
      {isPermissionsModalOpen && userToModify && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Granular Permissions — {userToModify.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Role: <span className="font-semibold text-blue-600">{userToModify.role}</span> |{' '}
                  Department: <span className="font-semibold text-slate-700">{userToModify.department}</span>
                </p>
              </div>
              <button
                onClick={() => setIsPermissionsModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 my-5 text-xs">
              {permissionModules.map((group) => (
                <div key={group.module} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/40">
                  <h4 className="font-bold text-slate-800 mb-2.5 flex items-center gap-2">
                    <ShieldCheck size={14} className="text-[#1f6bff]" />
                    <span>{group.module}</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {group.actions.map((act) => {
                      const isChecked = (userForm.permissions || []).includes(act.label);
                      return (
                        <label
                          key={act.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none ${
                            isChecked
                              ? 'bg-blue-50/80 border-blue-200 text-blue-800 font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermissionItem(act.label)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="truncate">{act.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                {(userForm.permissions || []).length} permissions active
              </span>
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPermissionsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  className="px-5 py-2 bg-[#1f6bff] hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition-colors"
                >
                  Save Permissions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 4: Reset Password ─────────────────────────────── */}
      {isResetPasswordModalOpen && userToModify && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Reset User Password</h3>
              <button
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePasswordResetSubmit} className="space-y-4 mt-4 text-xs">
              <p className="text-slate-600">
                Set a new temporary password for{' '}
                <strong className="text-slate-900">{userToModify.name}</strong> ({userToModify.email}).
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Temporary Password</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setNewPassword(generateTempPassword())
                    }
                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                  >
                    Generate
                  </button>
                </div>
              </div>

              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Password successfully reset and invitation sent!</span>
                </div>
              )}

              <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1f6bff] hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Confirm Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 5: Delete Confirmation ────────────────────────── */}
      {isDeleteModalOpen && userToModify && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete User Account?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove <strong>{userToModify.name}</strong> ({userToModify.email})?
              This action cannot be undone and will revoke their system access immediately.
            </p>

            <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 mt-6 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-xs"
              >
                Yes, Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subcomponent: User Card Item ─────────────────────────────
function UserCardItem({
  user,
  isSelected,
  onClick,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onDelete,
  onViewPermissions,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const badgeStyle = getRoleBadgeStyle(user.role);

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white border rounded-2xl p-4 transition-all duration-150 cursor-pointer flex flex-col justify-between select-none ${
        isSelected
          ? 'border-[#1f6bff] ring-2 ring-blue-500/20 shadow-md bg-blue-50/10'
          : 'border-slate-200/90 hover:border-blue-300 hover:shadow-md'
      }`}
    >
      {/* ── Top Row: Role Badge & Three-dots Menu ─────────────── */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border truncate max-w-[170px] ${badgeStyle}`}
        >
          {user.role}
        </span>

        {/* Action Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <MoreVertical size={16} />
          </button>

          {isMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-8 z-30 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onClick();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
              >
                <Eye size={14} className="text-slate-500" />
                <span>View Details</span>
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onEdit();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
              >
                <Edit2 size={14} className="text-slate-500" />
                <span>Edit User</span>
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onViewPermissions();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
              >
                <ShieldCheck size={14} className="text-blue-600" />
                <span>Permissions</span>
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onResetPassword();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
              >
                <KeyRound size={14} className="text-slate-500" />
                <span>Reset Password</span>
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onToggleStatus();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
              >
                {user.status === 'Active' ? (
                  <>
                    <UserMinus size={14} className="text-amber-600" />
                    <span>Disable Account</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={14} className="text-emerald-600" />
                    <span>Enable Account</span>
                  </>
                )}
              </button>
              <div className="h-px bg-slate-100 my-1" />
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onDelete();
                }}
                className="w-full px-3 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2"
              >
                <Trash2 size={14} />
                <span>Delete User</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Middle: Avatar, Name, Email, Department ───────────── */}
      <div className="flex items-center gap-3 mb-4">
        <UserAvatar user={user} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-blue-600 transition-colors truncate">
              {user.name}
            </h4>
            {user.isFromHrms && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700"
                title={user.employeeId ? `Employee ${user.employeeId}` : 'Synced from HRMS'}
              >
                <Briefcase size={10} />
                HR
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5" title={user.email}>
            {user.email}
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
            {[user.department, user.designation].filter(Boolean).join(' • ') || '—'}
          </p>
        </div>
      </div>

      {/* ── Bottom Row: Status Badge & Joined Date ────────────── */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100/90 text-xs">
        <span
          className={`inline-flex items-center gap-1.5 font-medium text-[11px] ${
            user.status === 'Active' ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              user.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
          {user.status}
        </span>

        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <Calendar size={12} className="text-slate-400" />
          <span>Joined {user.joinedDate}</span>
        </span>
      </div>
    </div>
  );
}

function UserListItem({
  user,
  isSelected,
  onClick,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onDelete,
  onViewPermissions,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const badgeStyle = getRoleBadgeStyle(user.role);

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white border rounded-2xl px-4 py-3.5 transition-all duration-150 cursor-pointer ${
        isSelected
          ? 'border-[#1f6bff] ring-2 ring-blue-500/20 shadow-md bg-blue-50/10'
          : 'border-slate-200/90 hover:border-blue-300 hover:shadow-md'
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <UserAvatar user={user} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-blue-600 transition-colors truncate">
                {user.name}
              </h4>
              <span
                className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold truncate ${badgeStyle}`}
              >
                {user.role}
              </span>
              {user.isFromHrms && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700"
                  title={user.employeeId ? `Employee ${user.employeeId}` : 'Synced from HRMS'}
                >
                  <Briefcase size={10} />
                  HR
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5" title={user.email}>
              {user.email}
            </p>
            {user.designation && (
              <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                {user.designation}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3 lg:w-[460px] lg:flex-shrink-0">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <Building2 size={13} className="text-slate-400 flex-shrink-0" />
            <span className="truncate">{user.department}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <span
              className={`h-2 w-2 rounded-full ${
                user.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span className={user.status === 'Active' ? 'text-emerald-700' : 'text-rose-600'}>
              {user.status}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <Calendar size={13} className="text-slate-400 flex-shrink-0" />
            <span className="truncate">Joined {user.joinedDate}</span>
          </div>
        </div>

        <div className="relative self-end lg:self-auto" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <MoreVertical size={16} />
          </button>

          {isMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-11 z-30 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onClick();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
              >
                <Eye size={14} className="text-slate-500" />
                <span>View Details</span>
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onEdit();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
              >
                <Edit2 size={14} className="text-slate-500" />
                <span>Edit User</span>
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onViewPermissions();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
              >
                <ShieldCheck size={14} className="text-blue-600" />
                <span>Permissions</span>
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onResetPassword();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
              >
                <KeyRound size={14} className="text-slate-500" />
                <span>Reset Password</span>
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onToggleStatus();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
              >
                {user.status === 'Active' ? (
                  <>
                    <UserMinus size={14} className="text-amber-600" />
                    <span>Disable Account</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={14} className="text-emerald-600" />
                    <span>Enable Account</span>
                  </>
                )}
              </button>
              <div className="h-px bg-slate-100 my-1" />
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onDelete();
                }}
                className="w-full px-3 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2"
              >
                <Trash2 size={14} />
                <span>Delete User</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UsersPage;
