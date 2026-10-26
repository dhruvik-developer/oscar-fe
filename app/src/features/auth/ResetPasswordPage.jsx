import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle, ArrowRight, Hash } from 'lucide-react';
import { resetPassword } from '../../services/authService';
import { describeError } from '../../services/resourceSync';
import { clearStoredAuth } from '../../utils/authUtils';
import { passwordProblems, capsLockOn } from './passwordRules';

const inputClass =
  'w-full h-11 bg-[#f0f4f9] hover:bg-[#eaf0f7] focus:bg-white border border-transparent focus:border-[var(--brand-primary,#1e6cfb)] rounded-xl py-2 pl-10 pr-10 text-xs sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition font-mono';

/**
 * Landing page for the emailed reset link: `/reset-password?token=…`.
 * Public on purpose. The link alone is not enough: the 6-digit code from the
 * same email goes with it, so a forwarded or leaked link cannot change the
 * password by itself.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const problems = passwordProblems(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    if (problems.length > 0) {
      setError(`Password needs: ${problems.join(', ').toLowerCase()}.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await resetPassword({ token, otp: code, newPassword: password });
      // The server signed every session out; forget any local one too.
      clearStoredAuth();
      setDone(true);
    } catch (err) {
      // Password rules come back per field; a dead token has a whole-sentence
      // message ("That reset link is no longer valid…") worth showing as is.
      const passwordErrors = err?.payload?.field_errors?.newPassword || [];
      setError(passwordErrors.length ? passwordErrors.join(' ') : err?.message || describeError(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#f3f4f6] font-sans text-slate-900">
      <div className="w-full max-w-[420px] bg-white rounded-[28px] p-7 sm:p-9 shadow-[0_24px_70px_rgba(15,35,70,0.12)] border border-slate-100">
        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
          <KeyRound size={22} />
        </div>

        {!token ? (
          <>
            <h1 className="text-xl font-black tracking-tight text-[#0f2743]">Link is incomplete</h1>
            <p className="mt-1.5 text-xs sm:text-[13px] text-slate-500 leading-relaxed">
              This reset link has no token. Open the link from your email again, or request a new one from the sign-in page.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="mt-6 w-full h-11 rounded-xl bg-[var(--brand-primary,#1e6cfb)] hover:bg-[var(--brand-primary-dark,#155de0)] text-white font-semibold text-[13.5px] flex items-center justify-center gap-2 cursor-pointer transition"
            >
              Back to Sign in <ArrowRight size={17} />
            </button>
          </>
        ) : done ? (
          <>
            <h1 className="text-xl font-black tracking-tight text-[#0f2743]">Password updated</h1>
            <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>Your password has been changed and every device has been signed out. Sign in with the new password.</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="mt-6 w-full h-11 rounded-xl bg-[var(--brand-primary,#1e6cfb)] hover:bg-[var(--brand-primary-dark,#155de0)] text-white font-semibold text-[13.5px] flex items-center justify-center gap-2 cursor-pointer transition"
            >
              Go to Sign in <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-black tracking-tight text-[#0f2743]">Choose a new password</h1>
            <p className="mt-1.5 text-xs sm:text-[13px] text-slate-500">
              Enter the 6-digit code from the same email, then your new password.
              After saving, you will be signed out everywhere.
            </p>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 leading-relaxed font-semibold">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1.5">Verification code</label>
                <div className="relative flex items-center">
                  <Hash size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    className={`${inputClass} tracking-[0.35em]`}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">The code is in the same email as this link and is valid for 10 minutes.</p>
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1.5">New password</label>
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    onKeyUp={(e) => setCapsOn(capsLockOn(e))}
                    onKeyDown={(e) => setCapsOn(capsLockOn(e))}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password && problems.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-amber-700">Needs: {problems.join(' · ')}</p>
                )}
              </div>

              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1.5">Confirm new password</label>
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    onKeyUp={(e) => setCapsOn(capsLockOn(e))}
                    onKeyDown={(e) => setCapsOn(capsLockOn(e))}
                    className={inputClass}
                  />
                </div>
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
                {isSaving ? 'Saving…' : 'Save new password'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full text-[12px] font-semibold text-[var(--brand-primary,#1e6cfb)] hover:underline cursor-pointer"
              >
                Back to Sign in
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
