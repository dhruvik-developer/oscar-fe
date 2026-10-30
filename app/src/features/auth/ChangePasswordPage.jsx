import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, LogOut } from 'lucide-react';
import { changePassword, logout } from '../../services/authService';
import { describeError } from '../../services/resourceSync';
import { useAppStore } from '../../stores/appStore';
import { getRoleDefaultRoute } from './LoginPage';
import { passwordProblems, capsLockOn } from './passwordRules';

const inputClass =
  'w-full h-11 bg-[#f0f4f9] hover:bg-[#eaf0f7] focus:bg-white border border-transparent focus:border-[var(--brand-primary,#1e6cfb)] rounded-xl py-2 pl-10 pr-10 text-xs sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition font-mono';

/**
 * `/change-password` — signed in, outside the app shell.
 *
 * Users whose password an administrator chose (`mustChangePassword`) are held
 * here by RequireAuth until they pick their own; anyone else can open it too.
 */
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '';

  const currentUser = useAppStore((s) => s.currentUser);
  const permissions = useAppStore((s) => s.permissions);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const showToast = useAppStore((s) => s.showToast);
  const forced = Boolean(currentUser?.mustChangePassword);

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const problems = passwordProblems(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const trackCaps = (e) => setCapsOn(capsLockOn(e));

  const leave = () => {
    const target = returnTo && returnTo !== '/change-password'
      ? returnTo
      : getRoleDefaultRoute(currentUser?.roleCode, permissions);
    navigate(target, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (problems.length > 0) {
      setError(`Password needs: ${problems.join(', ').toLowerCase()}.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    if (password === current) {
      setError('Choose a password different from the current one.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await changePassword({ currentPassword: current, newPassword: password });
      if (currentUser) setCurrentUser({ ...currentUser, mustChangePassword: false });
      showToast?.('Password changed. Other devices have been signed out.');
      leave();
    } catch (err) {
      const fieldErrors = err?.payload?.field_errors || {};
      const detail = [...(fieldErrors.currentPassword || []), ...(fieldErrors.newPassword || [])];
      setError(detail.length ? detail.join(' ') : describeError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const passwordInput = (value, onChange, autoComplete) => (
    <div className="relative flex items-center">
      <Lock size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
      <input
        type={showPassword ? 'text' : 'password'}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyUp={trackCaps}
        onKeyDown={trackCaps}
        autoComplete={autoComplete}
        className={inputClass}
      />
    </div>
  );

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#f3f4f6] font-sans text-slate-900">
      <div className="w-full max-w-[420px] bg-white rounded-[28px] p-7 sm:p-9 shadow-[0_24px_70px_rgba(15,35,70,0.12)] border border-slate-100">
        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
          <ShieldCheck size={22} />
        </div>

        <h1 className="text-xl font-black tracking-tight text-[#0f2743]">
          {forced ? 'Set your own password' : 'Change password'}
        </h1>
        <p className="mt-1.5 text-xs sm:text-[13px] text-slate-500 leading-relaxed">
          {forced
            ? 'Your administrator gave you a temporary password. Choose your own before continuing.'
            : 'Other devices signed in to this account will be signed out.'}
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 leading-relaxed font-semibold">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div>
            <label className="block text-[12.5px] font-medium text-slate-700 mb-1.5">
              {forced ? 'Temporary password' : 'Current password'}
            </label>
            {passwordInput(current, setCurrent, 'current-password')}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[12.5px] font-medium text-slate-700">New password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11.5px] font-semibold text-[var(--brand-primary,#1e6cfb)] hover:underline cursor-pointer flex items-center gap-1"
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {passwordInput(password, setPassword, 'new-password')}
            {password && problems.length > 0 && (
              <p className="mt-1.5 text-[11px] text-amber-700">Needs: {problems.join(' · ')}</p>
            )}
          </div>

          <div>
            <label className="block text-[12.5px] font-medium text-slate-700 mb-1.5">Confirm new password</label>
            {passwordInput(confirm, setConfirm, 'new-password')}
            {mismatch && <p className="mt-1.5 text-[11px] text-rose-600">Passwords do not match.</p>}
          </div>

          {capsOn && (
            <p className="text-[11.5px] font-semibold text-amber-700">Caps Lock is on.</p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full h-11 px-4 rounded-xl bg-[var(--brand-primary,#1e6cfb)] hover:bg-[var(--brand-primary-dark,#155de0)] text-white font-semibold text-[13.5px] shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {isSaving ? 'Saving…' : 'Save password'}
          </button>

          {forced ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full text-[12px] font-semibold text-slate-500 hover:text-rose-600 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut size={13} /> Sign out instead
            </button>
          ) : (
            <button
              type="button"
              onClick={leave}
              className="w-full text-[12px] font-semibold text-[var(--brand-primary,#1e6cfb)] hover:underline cursor-pointer"
            >
              Cancel
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
