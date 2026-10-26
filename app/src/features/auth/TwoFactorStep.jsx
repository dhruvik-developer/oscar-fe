import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';
import { verifyLoginOtp, resendLoginOtp } from '../../services/authService';
import { describeError } from '../../services/resourceSync';

const RESEND_SECONDS = 30;

/**
 * Second step of a two-step sign-in, shown in the login card after a correct
 * password. `challenge` is `{ challengeId, email, expiresIn }` from `login()`.
 */
export default function TwoFactorStep({ challenge: initial, remember, onSignedIn, onCancel }) {
  const [challenge, setChallenge] = useState(initial);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const session = await verifyLoginOtp({ challengeId: challenge.challengeId, otp: code, remember });
      onSignedIn(session);
    } catch (err) {
      setError(err?.message || describeError(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setError('');
    try {
      const next = await resendLoginOtp(challenge.challengeId);
      setChallenge(next);
      setCode('');
      setResendIn(RESEND_SECONDS);
      setInfo(`A new code was sent to ${next.email}. Earlier codes no longer work.`);
    } catch (err) {
      setError(err?.message || describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const minutes = Math.max(1, Math.round((challenge.expiresIn || 300) / 60));

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800">
        <ShieldCheck size={16} className="shrink-0 text-blue-600" />
        <span>
          Two-step sign-in is on for this account. We emailed a code to{' '}
          <span className="font-semibold">{challenge.email}</span>.
        </span>
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
          <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 leading-relaxed font-semibold">{error}</div>
        </div>
      )}
      {!error && info && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          {info}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
        <div>
          <label className="block text-[12.5px] font-medium text-slate-700 mb-1.5">Sign-in code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            className="w-full h-11 bg-[#f0f4f9] focus:bg-white border border-transparent focus:border-[var(--brand-primary,#1e6cfb)] rounded-xl px-3.5 text-center text-base font-mono tracking-[0.5em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          />
          <div className="flex justify-between items-center mt-1.5 text-[11.5px]">
            <span className="text-slate-400">Valid for {minutes} minutes. Check spam too.</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={busy || resendIn > 0}
              className="font-semibold text-[var(--brand-primary,#1e6cfb)] hover:underline cursor-pointer disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full h-11 px-4 rounded-xl bg-[var(--brand-primary,#1e6cfb)] hover:bg-[var(--brand-primary-dark,#155de0)] text-white font-semibold text-[13.5px] shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? 'Verifying…' : 'Verify and sign in'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-[12px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <ArrowLeft size={13} /> Use a different account
        </button>
      </form>
    </div>
  );
}
