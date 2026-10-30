import React, { useEffect, useState } from 'react';
import { X, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import {
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} from '../../services/authService';
import { describeError } from '../../services/resourceSync';
import { passwordProblems, capsLockOn } from './passwordRules';

const RESEND_SECONDS = 30;
const fieldClass =
  'w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

function Banner({ tone, children }) {
  const styles = tone === 'error'
    ? 'bg-rose-50 border-rose-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${styles}`}>
      <Icon size={15} className="shrink-0 mt-0.5" />
      <div className="flex-1 leading-relaxed font-semibold">{children}</div>
    </div>
  );
}

/**
 * Forgot password in three steps: email → emailed 6-digit code + new password
 * → done. The same email also carries a link (`/reset-password`) for anyone
 * who prefers to click.
 */
export default function ForgotPasswordModal({ initialEmail = '', onClose }) {
  const [step, setStep] = useState('email'); // email | code | done
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  // Token from a verified code; kept so a password-rule error does not burn
  // the code — the next submit goes straight to the reset.
  const [resetToken, setResetToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const problems = passwordProblems(password);
  const trackCaps = (e) => setCapsOn(capsLockOn(e));

  const sendCode = async () => {
    setBusy(true);
    setError('');
    try {
      await forgotPassword(email);
      setStep('code');
      setCode('');
      setResetToken('');
      setResendIn(RESEND_SECONDS);
      setInfo('If an active account uses this address, we have emailed a 6-digit code and a reset link.');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (email.trim()) sendCode();
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (!resetToken && !/^\d{6}$/.test(code.trim())) {
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
    setBusy(true);
    setError('');
    setInfo('');
    try {
      let token = resetToken;
      if (!token) {
        ({ token } = await verifyResetOtp({ email, otp: code.trim() }));
        setResetToken(token);
      }
      await resetPassword({ token, newPassword: password });
      setStep('done');
    } catch (err) {
      const passwordErrors = err?.payload?.field_errors?.newPassword || [];
      setError(passwordErrors.length ? passwordErrors.join(' ') : err?.message || describeError(err));
      // A dead exchange token means starting over with a fresh code.
      if (err?.payload?.code === 'TOKEN_EXPIRED') setResetToken('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition"
        >
          <X size={16} />
        </button>

        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5 border border-blue-100">
          <KeyRound size={20} />
        </div>

        <h3 className="text-base font-bold text-slate-900">Reset Your Password</h3>

        {step === 'email' && (
          <>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Enter the email address you sign in with. We will email you a 6-digit code and a reset link.
            </p>
            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              {error && <Banner tone="error">{error}</Banner>}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className={fieldClass}
                />
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? 'Sending…' : 'Send Code'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Enter the code sent to <span className="font-semibold text-slate-700">{email}</span> and choose a new password.
            </p>
            <form onSubmit={handleCodeSubmit} className="space-y-3">
              {error && <Banner tone="error">{error}</Banner>}
              {!error && info && <Banner tone="info">{info}</Banner>}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required={!resetToken}
                  disabled={Boolean(resetToken)}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className={`${fieldClass} font-mono tracking-[0.5em] text-center text-sm disabled:bg-slate-50`}
                />
                <div className="flex justify-between items-center mt-1.5 text-[11px]">
                  <span className="text-slate-400">Valid for 10 minutes. Check spam too.</span>
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={busy || resendIn > 0}
                    className="font-semibold text-blue-600 hover:underline cursor-pointer disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">New password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={trackCaps}
                  onKeyDown={trackCaps}
                  autoComplete="new-password"
                  className={`${fieldClass} font-mono`}
                />
                {password && problems.length > 0 && (
                  <p className="mt-1 text-[11px] text-amber-700">Needs: {problems.join(' · ')}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Confirm new password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyUp={trackCaps}
                  onKeyDown={trackCaps}
                  autoComplete="new-password"
                  className={`${fieldClass} font-mono`}
                />
                {confirm && confirm !== password && (
                  <p className="mt-1 text-[11px] text-rose-600">Passwords do not match.</p>
                )}
              </div>

              {capsOn && <p className="text-[11px] font-semibold text-amber-700">Caps Lock is on.</p>}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); setInfo(''); }}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft size={13} /> Back
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? 'Saving…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'done' && (
          <div className="space-y-4 mt-3">
            <Banner tone="info">
              Your password has been changed and every device has been signed out. Sign in with the new password.
            </Banner>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer"
            >
              Return to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
