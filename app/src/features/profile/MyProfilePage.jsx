import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Briefcase,
  Calendar,
  Shield,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Pencil,
  X,
  Lock,
  Eye,
  EyeOff,
  Save,
  Clock,
  Globe,
  UserCheck,
  AlertTriangle,
  Upload,
  Check,
  ChevronRight,
  BadgeAlert,
  Layers,
  HeartPulse,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import PageHeader from '../../components/ui/PageHeader';
import {
  updateProfile,
  changePassword,
  fetchMe,
} from '../../services/authService';
import { describeError } from '../../services/resourceSync';


const formatDate = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(val);
  }
};

const formatDateTime = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(val);
  }
};

export default function MyProfilePage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const permissions = useAppStore((s) => s.permissions) || [];
  const showToast = useAppStore((s) => s.showToast);

  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'professional' | 'security' | 'permissions'
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Security state
  const [securityBusy, setSecurityBusy] = useState('');
  const [securityMessage, setSecurityMessage] = useState({ text: '', type: '' });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState({ text: '', type: '' });

  // Edit profile form state
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    avatar: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    personalEmail: '',
    street: '',
    city: '',
    state: '',
    pincode: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
  });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  // Synchronize editForm with currentUser
  const syncEditForm = useCallback((user) => {
    if (!user) return;
    const addr = user.address || {};
    const emg = user.emergencyContact || {};
    setEditForm({
      name: user.name || '',
      phone: user.phone ? user.phone.replace('+91 ', '').trim() : '',
      avatar: user.avatar || '',
      dateOfBirth: user.dateOfBirth || '',
      gender: user.gender || '',
      bloodGroup: user.bloodGroup || '',
      personalEmail: user.personalEmail || '',
      street: addr.street || addr.line1 || addr.address || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || addr.zip || '',
      emergencyName: emg.name || '',
      emergencyPhone: emg.phone ? String(emg.phone).replace('+91 ', '').trim() : '',
      emergencyRelation: emg.relation || emg.relationship || '',
    });
  }, []);

  useEffect(() => {
    if (currentUser) {
      syncEditForm(currentUser);
    }
  }, [currentUser, syncEditForm]);

  // Re-sync authenticated profile state on mount to ensure two-factor flags are fresh
  useEffect(() => {
    fetchMe().then((data) => {
      if (data?.user) {
        setCurrentUser(data.user);
      }
    }).catch(() => {});
  }, [setCurrentUser]);



  // Reload entire profile
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await fetchMe();
      if (data?.user) {
        setCurrentUser(data.user);
        syncEditForm(data.user);
      }
      showToast('Profile refreshed with latest data');
    } catch (err) {
      showToast('Failed to refresh profile');
    } finally {
      setRefreshing(false);
    }
  };

  // Password Change Handler
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordFeedback({ text: '', type: '' });

    if (!passwordForm.currentPassword) {
      setPasswordFeedback({ text: 'Please enter your current password.', type: 'error' });
      return;
    }
    if (!passwordForm.newPassword) {
      setPasswordFeedback({ text: 'Please enter a new password.', type: 'error' });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordFeedback({ text: 'New password must be at least 6 characters.', type: 'error' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ text: 'New password and confirmation do not match.', type: 'error' });
      return;
    }

    setPasswordBusy(true);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordFeedback({ text: 'Your password has been successfully changed.', type: 'success' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Password changed successfully');
    } catch (err) {
      const msg = err?.message || describeError(err) || 'Failed to change password.';
      setPasswordFeedback({ text: msg, type: 'error' });
    } finally {
      setPasswordBusy(false);
    }
  };

  // Toggle Two-Factor Authentication
  const handleToggleTwoFactor = async () => {
    if (securityBusy === '2fa') return;
    setSecurityBusy('2fa');
    setSecurityMessage({ text: '', type: '' });
    try {
      const targetState = !Boolean(currentUser?.twoFactorEnabled);
      const updated = await updateProfile({ twoFactorEnabled: targetState });
      if (updated) {
        setCurrentUser(updated);
        showToast(updated.twoFactorEnabled ? 'Two-step verification enabled' : 'Two-step verification disabled');
      }
    } catch (err) {
      const msg = err?.message || describeError(err) || 'Failed to update two-factor authentication.';
      setSecurityMessage({ text: msg, type: 'error' });
      showToast(msg);
    } finally {
      setSecurityBusy('');
    }
  };



  // Save Edit Profile Changes
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setEditError('');

    if (!editForm.name.trim()) {
      setEditError('Name is required.');
      return;
    }

    setEditBusy(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() ? editForm.phone.trim() : null,
        avatar: editForm.avatar || null,
        dateOfBirth: editForm.dateOfBirth || null,
        gender: editForm.gender || null,
        bloodGroup: editForm.bloodGroup || null,
        personalEmail: editForm.personalEmail ? editForm.personalEmail.trim() : null,
        address: {
          street: editForm.street.trim(),
          city: editForm.city.trim(),
          state: editForm.state.trim(),
          pincode: editForm.pincode.trim(),
        },
        emergencyContact: {
          name: editForm.emergencyName.trim(),
          phone: editForm.emergencyPhone.trim(),
          relation: editForm.emergencyRelation.trim(),
        },
      };

      const updated = await updateProfile(payload);
      if (updated) {
        setCurrentUser(updated);
        syncEditForm(updated);
        showToast('Profile updated successfully');
        setIsEditModalOpen(false);
      }
    } catch (err) {
      setEditError(err?.message || describeError(err) || 'Failed to update profile.');
    } finally {
      setEditBusy(false);
    }
  };

  // Handle avatar file upload
  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setEditError('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setEditError('Image size should be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setEditForm((prev) => ({ ...prev, avatar: uploadEvent.target.result }));
    };
    reader.readAsDataURL(file);
  };

  // Derived Values
  const initials = currentUser?.initials || (currentUser?.name || '?').slice(0, 2).toUpperCase();
  const roleName = currentUser?.role || 'Staff Member';
  const roleCode = currentUser?.roleCode || 'USER';
  const isSuperuser = Boolean(currentUser?.isSuperuser);
  const designation = currentUser?.designation || (isSuperuser ? 'System Administrator' : roleName);
  const department = currentUser?.department || 'Administration';
  const employeeId = currentUser?.employeeId || currentUser?.employeeCode || '—';
  const isActive = (currentUser?.status || 'Active').toLowerCase() === 'active';

  // Group permissions by module for the permissions tab
  const groupedPermissions = useMemo(() => {
    if (!permissions || !Array.isArray(permissions)) return {};
    const groups = {};
    permissions.forEach((perm) => {
      const parts = perm.split('.');
      const mod = parts.length > 1 ? parts[0].toUpperCase() : 'GENERAL';
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(perm);
    });
    return groups;
  }, [permissions]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* ── Breadcrumb & Top Header ────────────────────────────────────── */}
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal details, employment information, security credentials, and access permissions."
        breadcrumb={[
          { label: 'Home', path: '/' },
          { label: 'My Profile', isCurrent: true },
        ]}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-sm active:scale-95 disabled:opacity-50"
              title="Refresh profile details"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => {
                syncEditForm(currentUser);
                setEditError('');
                setIsEditModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm hover:shadow transition active:scale-95"
            >
              <Pencil size={13} />
              <span>Edit Profile</span>
            </button>
          </div>
        }
      />

      {/* ── Profile Header Hero Card ───────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar / Photo */}
            <div className="relative group">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100 shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-sm tracking-wider">
                  {initials}
                </div>
              )}
              <button
                onClick={() => {
                  syncEditForm(currentUser);
                  setIsEditModalOpen(true);
                }}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-white text-slate-700 border border-slate-200 rounded-lg flex items-center justify-center shadow-md hover:text-blue-600 transition hover:scale-105"
                title="Change Photo"
              >
                <Pencil size={13} />
              </button>
            </div>

            {/* Basic Info */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {currentUser?.name || 'User Profile'}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {isActive ? 'Active' : 'Inactive'}
                </span>
                {isSuperuser && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                    <Shield size={11} />
                    Superuser
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-slate-400" />
                  <span className="font-medium text-slate-700">{currentUser?.email || '—'}</span>
                </span>
                {currentUser?.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} className="text-slate-400" />
                    <span>{currentUser.phone}</span>
                  </span>
                )}
                {employeeId !== '—' && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-semibold">ID:</span>
                    <span className="font-mono font-medium text-slate-800">{employeeId}</span>
                  </span>
                )}
              </div>

              {/* Department & Designation Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200/80 text-slate-700">
                  <Briefcase size={12} className="text-blue-500" />
                  {designation}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200/80 text-slate-700">
                  <Building2 size={12} className="text-emerald-500" />
                  {department}
                </span>
                {currentUser?.location && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200/80 text-slate-700">
                    <MapPin size={12} className="text-amber-500" />
                    {currentUser.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats / Summary Card */}
          <div className="w-full sm:w-auto flex sm:flex-col gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 sm:items-end">
            <div className="text-left sm:text-right">
              <span className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">Role</span>
              <span className="text-xs font-semibold text-slate-800">{roleName}</span>
            </div>
            <div className="text-left sm:text-right">
              <span className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">Last Login</span>
              <span className="text-xs font-medium text-slate-600">{formatDateTime(currentUser?.lastLogin)}</span>
            </div>
          </div>
        </div>

        {/* ── Tabs Navigation Bar ──────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-t border-slate-100 mt-6 pt-4 overflow-x-auto">
          {[
            { id: 'personal', label: 'Personal Information', icon: User },
            { id: 'professional', label: 'Professional Information', icon: Briefcase },
            { id: 'security', label: 'Account & Security', icon: Lock },
            { id: 'permissions', label: 'Roles & Permissions', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB 1: Personal Information ──────────────────────────────── */}
      {activeTab === 'personal' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Identity & Contact Card */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <User size={16} className="text-blue-600" />
                <span>Identity & Contact Details</span>
              </h2>
              <span className="text-[11px] font-medium text-slate-400">Basic Info</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Full Name</label>
                <p className="font-semibold text-slate-800">{currentUser?.name || '—'}</p>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Employee ID</label>
                <p className="font-mono font-semibold text-slate-800">{employeeId}</p>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Official Email</label>
                <p className="font-medium text-slate-800">{currentUser?.email || '—'}</p>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Mobile Number</label>
                <p className="font-medium text-slate-800">{currentUser?.phone || 'Not provided'}</p>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Personal Email</label>
                <p className="font-medium text-slate-800">{currentUser?.personalEmail || 'Not provided'}</p>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Blood Group</label>
                <p className="font-medium text-slate-800">{currentUser?.bloodGroup || 'Not specified'}</p>
              </div>
            </div>
          </section>

          {/* Demographics Card */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar size={16} className="text-blue-600" />
                <span>Demographics & Personal</span>
              </h2>
              <span className="text-[11px] font-medium text-slate-400">Personal</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Date of Birth</label>
                <p className="font-medium text-slate-800">{formatDate(currentUser?.dateOfBirth)}</p>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Gender</label>
                <p className="font-medium text-slate-800 capitalize">{currentUser?.gender || 'Not specified'}</p>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Account Created</label>
                <p className="font-medium text-slate-800">{formatDate(currentUser?.joiningDate)}</p>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">Profile Status</label>
                <p className="font-medium text-slate-800">
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle2 size={13} />
                    Verified User
                  </span>
                </p>
              </div>
            </div>
          </section>

          {/* Address Information Card */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin size={16} className="text-blue-600" />
                <span>Residential Address</span>
              </h2>
              <span className="text-[11px] font-medium text-slate-400">Location</span>
            </div>

            {currentUser?.address && Object.keys(currentUser.address).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-medium mb-1">Street Address</label>
                  <p className="font-medium text-slate-800">
                    {currentUser.address.street || currentUser.address.line1 || currentUser.address.address || '—'}
                  </p>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">City</label>
                  <p className="font-medium text-slate-800">{currentUser.address.city || '—'}</p>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">State</label>
                  <p className="font-medium text-slate-800">{currentUser.address.state || '—'}</p>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">PIN / Postal Code</label>
                  <p className="font-medium text-slate-800">{currentUser.address.pincode || currentUser.address.zip || '—'}</p>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-400">
                No residential address on file. Click <span className="font-semibold text-blue-600 cursor-pointer" onClick={() => setIsEditModalOpen(true)}>Edit Profile</span> to add your address.
              </div>
            )}
          </section>

          {/* Emergency Contact Card */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <HeartPulse size={16} className="text-rose-500" />
                <span>Emergency Contact</span>
              </h2>
              <span className="text-[11px] font-medium text-slate-400">Safety</span>
            </div>

            {currentUser?.emergencyContact && (currentUser.emergencyContact.name || currentUser.emergencyContact.phone) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Contact Name</label>
                  <p className="font-semibold text-slate-800">{currentUser.emergencyContact.name || '—'}</p>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Relationship</label>
                  <p className="font-medium text-slate-800">{currentUser.emergencyContact.relation || currentUser.emergencyContact.relationship || '—'}</p>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Emergency Phone</label>
                  <p className="font-medium text-slate-800">{currentUser.emergencyContact.phone || '—'}</p>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-400">
                No emergency contact configured. Click <span className="font-semibold text-blue-600 cursor-pointer" onClick={() => setIsEditModalOpen(true)}>Edit Profile</span> to add one.
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── TAB 2: Professional Information ──────────────────────────── */}
      {activeTab === 'professional' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Department & Designation */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 size={16} className="text-blue-600" />
                  <span>Position & Department</span>
                </h2>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-0.5">Assigned Department</label>
                  <p className="font-semibold text-slate-900 text-sm">{department}</p>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-0.5">Official Designation</label>
                  <p className="font-semibold text-slate-900 text-sm">{designation}</p>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-0.5">Assigned System Role</label>
                  <p className="font-medium text-slate-700">{roleName} ({roleCode})</p>
                </div>
              </div>
            </section>

            {/* Reporting & Location */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck size={16} className="text-blue-600" />
                  <span>Reporting & Location</span>
                </h2>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-0.5">Reporting Manager</label>
                  <p className="font-semibold text-slate-900 text-sm">{currentUser?.reportingManager || 'Direct to Management'}</p>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-0.5">Branch / Work Location</label>
                  <p className="font-semibold text-slate-900 text-sm">{currentUser?.location || 'Corporate Headquarters'}</p>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-0.5">Employee Code</label>
                  <p className="font-mono font-medium text-slate-700">{employeeId}</p>
                </div>
              </div>
            </section>

            {/* Employment Status & Joining */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar size={16} className="text-blue-600" />
                  <span>Tenure & Status</span>
                </h2>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-0.5">Date of Joining</label>
                  <p className="font-semibold text-slate-900 text-sm">{formatDate(currentUser?.joiningDate)}</p>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-0.5">Employment Status</label>
                  <p className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {currentUser?.employmentStatus || currentUser?.status || 'Active'}
                  </p>
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-0.5">Employment Type</label>
                  <p className="font-medium text-slate-700">{currentUser?.employmentType || 'Full-time'}</p>
                </div>
              </div>
            </section>
          </div>

          {/* HRMS Integration Policy Notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-600">
            <Building2 size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">HRMS Master Record Synchronization</p>
              <p className="mt-0.5 text-slate-500">
                Professional and organizational parameters such as department, designation, reporting line, and joining date are managed centrally by the Human Resources & Administration team. To request updates to these fields, please contact your HR representative.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Account & Security ────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Change Password Card */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound size={16} className="text-blue-600" />
                  <span>Change Password</span>
                </h2>
                <span className="text-[11px] font-medium text-slate-400">Credentials</span>
              </div>

              {passwordFeedback.text && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    passwordFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {passwordFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{passwordFeedback.text}</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                      placeholder="••••••••••••"
                      required
                      className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((v) => !v)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                      placeholder="Minimum 6 characters"
                      required
                      minLength={6}
                      className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Confirm your new password"
                      required
                      className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={passwordBusy}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
                  >
                    {passwordBusy ? <RefreshCw size={13} className="animate-spin" /> : <Lock size={13} />}
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            </section>

            {/* [COMMENTED OUT] Two-Step Verification & Status
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-blue-600" />
                  <span>Two-Step Verification & Status</span>
                </h2>
                <span className="text-[11px] font-medium text-slate-400">Security</span>
              </div>

              {securityMessage.text && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    securityMessage.type === 'error'
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <AlertCircle size={15} />
                  <span>{securityMessage.text}</span>
                </div>
              )}

              <div className="space-y-4 text-xs">
                // 2FA Toggle Block
                <div className="flex items-start justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span>Two-Factor Authentication (2FA)</span>
                      {currentUser?.twoFactorRequired && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                          Enforced by Role
                        </span>
                      )}
                    </p>
                    <p className="text-slate-500 text-[11px]">
                      Receive a 6-digit confirmation code on your registered email address when signing in.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={securityBusy === '2fa'}
                    onClick={handleToggleTwoFactor}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      currentUser?.twoFactorEnabled ? 'bg-blue-600' : 'bg-slate-300'
                    } ${securityBusy === '2fa' ? 'opacity-60 cursor-wait' : 'hover:opacity-90'}`}
                    title={currentUser?.twoFactorEnabled ? 'Click to disable 2FA' : 'Click to enable 2FA'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        currentUser?.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                // Account Details
                <div className="space-y-2.5 pt-1">
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Account Status</span>
                    <span className="font-semibold text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active & Secured
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Last Successful Sign-In</span>
                    <span className="font-medium text-slate-800">{formatDateTime(currentUser?.lastLogin)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-slate-500">Authentication Method</span>
                    <span className="font-medium text-slate-800">Password + Token Session</span>
                  </div>
                </div>
              </div>
            </section>
            */}
          </div>

        </div>
      )}

      {/* ── TAB 4: Roles & Permissions ───────────────────────────────── */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          {/* Assigned Role Banner */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={20} className="text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">{roleName}</h2>
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    {roleCode}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {isSuperuser
                    ? 'Superuser account holding full unrestricted administrative permissions across all system modules.'
                    : `Role-based profile assigned to ${department} department.`}
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <Lock size={13} />
                <span>Read-Only Access View</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-0.5">Assigned Role</label>
                <p className="font-semibold text-slate-800">{roleName}</p>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-0.5">Department Access</label>
                <p className="font-semibold text-slate-800">{department || 'Organization-wide'}</p>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-0.5">Access Scope</label>
                <p className="font-semibold text-slate-800">
                  {isSuperuser ? 'All Modules & Global Settings' : 'Assigned Functional Modules'}
                </p>
              </div>
            </div>
          </section>

          {/* Module Access Summary */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers size={16} className="text-blue-600" />
                <span>Module Access Capabilities</span>
              </h2>
              <span className="text-[11px] font-medium text-slate-400">RBAC Scope</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {[
                { name: 'CRM Module', desc: 'Leads, Deals, Stages, and Pipeline', hasAccess: true },
                { name: 'PMS & Production', desc: 'Manufacturing, Looms, and Jobwork', hasAccess: true },
                { name: 'Sales & Invoicing', desc: 'Orders, Invoices, Delivery Challans', hasAccess: true },
                { name: 'Purchase Module', desc: 'Orders, Inwards, and Supplier Ledger', hasAccess: true },
                { name: 'Inventory & Stock', desc: 'Raw Materials, Fabrics, and Batches', hasAccess: true },
                { name: 'Accounts & Ledgers', desc: 'Cash/Bank, Journal, Financial MIS', hasAccess: true },
                { name: 'HRMS & Staffing', desc: 'Employees, Attendance, and Payroll', hasAccess: true },
                { name: 'Administration', desc: 'User Management and System Setup', hasAccess: isSuperuser || roleCode === 'ADMIN' },
              ].map((mod, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-900">{mod.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        mod.hasAccess ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {mod.hasAccess ? 'Granted' : 'Restricted'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{mod.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Granular Permissions List (if available) */}
          {!isSuperuser && Object.keys(groupedPermissions).length > 0 && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Shield size={16} className="text-blue-600" />
                  <span>Granted Permissions Breakdown</span>
                </h2>
                <span className="text-xs font-semibold text-slate-600">{permissions.length} Total Permissions</span>
              </div>

              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([mod, perms]) => (
                  <div key={mod} className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{mod}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {perms.map((p) => (
                        <span
                          key={p}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Security Policy Reminder */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-800">
            <Lock size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-900">Strict Read-Only Permission Architecture</p>
              <p className="mt-0.5 text-amber-700">
                In adherence with enterprise security compliance, users cannot modify their own assigned roles or grant themselves elevated privileges. If you require additional module or workflow access, please reach out to your system administrator.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PROFILE MODAL ───────────────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Pencil size={18} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Edit Personal Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-5 text-xs">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{editError}</span>
                </div>
              )}

              {/* Photo Upload Section */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                {editForm.avatar ? (
                  <img
                    src={editForm.avatar}
                    alt="Preview"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-sm">
                    {initials}
                  </div>
                )}
                <div className="space-y-1.5 flex-1">
                  <p className="font-semibold text-slate-800">Profile Picture</p>
                  <p className="text-[11px] text-slate-500">Upload a PNG, JPG or WEBP image up to 2MB.</p>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-pointer hover:bg-slate-100 transition shadow-sm text-xs">
                      <Upload size={13} />
                      <span>Choose Photo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleAvatarFileChange}
                      />
                    </label>
                    {editForm.avatar && (
                      <button
                        type="button"
                        onClick={() => setEditForm((p) => ({ ...p, avatar: '' }))}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. John Doe"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="10-digit number e.g. 9876543210"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>
              </div>

              {/* Demographics: DOB, Gender, Blood Group */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={editForm.dateOfBirth}
                    onChange={(e) => setEditForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Blood Group</label>
                  <select
                    value={editForm.bloodGroup}
                    onChange={(e) => setEditForm((p) => ({ ...p, bloodGroup: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  >
                    <option value="">Select blood group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              {/* Personal Email */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Personal Email Address</label>
                <input
                  type="email"
                  value={editForm.personalEmail}
                  onChange={(e) => setEditForm((p) => ({ ...p, personalEmail: e.target.value }))}
                  placeholder="personal.email@example.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                />
              </div>

              {/* Address Fields */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="font-bold text-slate-800">Residential Address</p>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    value={editForm.street}
                    onChange={(e) => setEditForm((p) => ({ ...p, street: e.target.value }))}
                    placeholder="House / Flat / Street address"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">City</label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                      placeholder="City"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={editForm.state}
                      onChange={(e) => setEditForm((p) => ({ ...p, state: e.target.value }))}
                      placeholder="State"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">PIN / Postal Code</label>
                    <input
                      type="text"
                      value={editForm.pincode}
                      onChange={(e) => setEditForm((p) => ({ ...p, pincode: e.target.value }))}
                      placeholder="PIN Code"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="font-bold text-slate-800">Emergency Contact</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={editForm.emergencyName}
                      onChange={(e) => setEditForm((p) => ({ ...p, emergencyName: e.target.value }))}
                      placeholder="e.g. Spouse / Parent"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Relationship</label>
                    <input
                      type="text"
                      value={editForm.emergencyRelation}
                      onChange={(e) => setEditForm((p) => ({ ...p, emergencyRelation: e.target.value }))}
                      placeholder="e.g. Father, Spouse"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Emergency Phone</label>
                    <input
                      type="text"
                      value={editForm.emergencyPhone}
                      onChange={(e) => setEditForm((p) => ({ ...p, emergencyPhone: e.target.value }))}
                      placeholder="10-digit number"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={editBusy}
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editBusy}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
                >
                  {editBusy ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
