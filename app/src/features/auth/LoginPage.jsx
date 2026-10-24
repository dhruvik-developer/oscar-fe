import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Infinity as InfinityIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Headphones,
  X,
  Clock,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { login as loginRequest } from '../../services/authService';
import { describeError } from '../../services/resourceSync';
import { getStoredToken } from '../../utils/authUtils';
import BrandLogo, { useBrandName } from '../../components/common/BrandLogo';

export function getRoleDefaultRoute(roleCode, permissions = []) {
  const code = (roleCode || '').toUpperCase();
  if (code.includes('QC')) return '/inventory/qc';
  if (code.includes('PURCHASE_OFFICER')) return '/purchase/orders';
  if (code.includes('PURCHASE_MGR')) return '/purchase/orders';
  if (code.includes('STORE') || code.includes('INV_MGR') || code.includes('GODOWN')) return '/inventory/dashboard';
  if (code.includes('PROD_COORD') || code.includes('PC')) return '/pms/production-dashboard';
  if (code.includes('PROD_STAFF') || code.includes('FIELD_STAFF')) return '/pms/daily-production';
  if (code.includes('JOBWORK')) return '/job-work/orders';
  if (code.includes('ACCOUNTS_MGR') || code.includes('ACCOUNTS')) return '/accounts/day-book';
  if (code.includes('SALES')) return '/sales/orders';
  if (code.includes('LOGISTICS')) return '/inventory/trips';
  if (code.includes('AUDITOR')) return '/reports';
  if (code.includes('STAFF') || code.includes('EMPLOYEE') || code.includes('EMP')) return '/employee/portal';
  if (code.includes('OWNER') || code.includes('MANAGEMENT')) return '/dashboard';
  return '/dashboard';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/dashboard';

  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const setPermissions = useAppStore((s) => s.setPermissions);
  const showToast = useAppStore((s) => s.showToast);
  const brandName = useBrandName('Oscar');
  const heroBrandName = useBrandName('OSCAR TEXTILES');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    const existingToken = getStoredToken();
    if (existingToken) {
      navigate(returnTo || '/dashboard', { replace: true });
    }
  }, [navigate, returnTo]);

  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { user, permissions } = await loginRequest({
        email,
        password,
        remember: rememberMe,
      });

      setCurrentUser(user);
      setPermissions(permissions);

      showToast?.(`Signed in successfully as ${user?.name || email}`);
      const targetRoute = (returnTo && returnTo !== '/dashboard')
        ? returnTo
        : getRoleDefaultRoute(user?.roleCode || user?.role?.code, permissions);
      navigate(targetRoute, { replace: true });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSent(true);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans bg-[#f3f4f6] text-slate-900 select-none">
      {/* ── 1. FULL-BLEED TEXTILE SHOWROOM BACKGROUND ── */}
      <div className="absolute inset-0 z-0">
        <img
          src="/login-bg.png"
          alt="Oscar Textile Architecture"
          className="w-full h-full object-cover object-[30%_center]"
        />

        {/* Ambient bottom-left vignette for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#051326]/95 via-[#071a33]/65 to-transparent to-55% pointer-events-none" />

        {/* Subtle top left ambient shadow */}
        <div className="absolute top-0 left-0 w-1/3 h-1/3 bg-gradient-to-br from-black/25 to-transparent pointer-events-none" />

        {/* Soft right readability veil for tablet/laptop if window is narrow */}
        <div className="absolute inset-y-0 right-0 w-full sm:w-1/2 bg-gradient-to-l from-white/30 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* ── 2. FOREGROUND CONTENT GRID ── */}
      <div className="relative z-10 min-h-screen w-full flex flex-col p-6 sm:p-10 lg:p-14 xl:p-20">
        {/* Top spacer (can host mobile branding if needed) */}
        <div className="w-full flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2.5 bg-slate-900/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20">
            <BrandLogo size={22} strokeWidth={2.4} className="text-[var(--brand-accent,#38bdf8)]" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white">
              {brandName}
            </span>
          </div>
          <div />
        </div>

        {/* Main Stage: Left Branding Typography + Right Login Card */}
        <div className="w-full flex-1 flex flex-col md:flex-row items-center justify-center md:justify-end gap-10 py-4">
          {/* ── LEFT HERO: OSCAR TEXTILES BRANDING (pinned bottom-left on desktop) ── */}
          <div className="order-2 md:order-none w-full md:absolute md:left-10 md:bottom-10 lg:left-14 lg:bottom-14 xl:left-20 xl:bottom-16 md:max-w-[46%] xl:max-w-xl text-left text-white">
            {/* Small Brand Header */}
            <div className="flex items-center gap-2.5 mb-3">
              <BrandLogo
                size={26}
                fallback={
                  <div className="relative inline-flex items-center justify-center">
                    <InfinityIcon size={26} strokeWidth={2.6} className="text-[var(--brand-accent,#38bdf8)]" />
                    <span className="absolute -right-0.5 top-0.5 flex gap-[1.5px]">
                      <i className="w-[3px] h-[3px] rounded-full bg-[var(--brand-accent,#38bdf8)] block" />
                      <i className="w-[2.5px] h-[2.5px] rounded-full bg-[var(--brand-accent,#38bdf8)]/70 block mt-[3px]" />
                    </span>
                    <span className="absolute right-[1px] top-[10px] flex gap-[1.5px]">
                      <i className="w-[2.5px] h-[2.5px] rounded-full bg-[var(--brand-accent,#38bdf8)]/80 block" />
                      <i className="w-[2px] h-[2px] rounded-full bg-[var(--brand-accent,#38bdf8)]/60 block" />
                    </span>
                  </div>
                }
              />
              <span className="text-[12px] font-black uppercase tracking-[0.32em] text-white/95 font-sans">
                {heroBrandName}
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[58px] xl:text-[64px] font-serif font-normal leading-[1.06] text-white tracking-tight drop-shadow-md">
              Every thread.<br />
              <span className="text-[var(--brand-accent,#60a5fa)]">One vision.</span>
            </h1>

            {/* Supporting Subtitle */}
            <p className="mt-4 text-sm sm:text-base lg:text-[17px] text-slate-200/90 font-normal leading-relaxed drop-shadow-sm max-w-md">
              Your workspace for smarter operations.
            </p>
          </div>

          {/* ── RIGHT HERO: THE CLEAN, FLOATING LOGIN CARD ── */}
          <div className="w-full max-w-[460px] md:w-[44%] md:mr-[2%] xl:mr-[4%] bg-white/95 backdrop-blur-sm rounded-[28px] sm:rounded-[32px] p-7 sm:p-10 xl:p-11 shadow-[0_24px_70px_rgba(15,35,70,0.18)] border border-white/80">
            {/* Brand Logo & Welcome Headings */}
            <div className="text-center">
              {/* Infinity Logo with signature 4 dots */}
              <div className="flex justify-center mb-1">
                <BrandLogo
                  size={54}
                  fallback={
                    <div className="relative inline-flex items-center justify-center">
                      <InfinityIcon size={54} strokeWidth={2.6} className="text-[var(--brand-primary,#1e6cfb)]" />
                      <span className="absolute -right-0.5 top-0.5 flex gap-[2px]">
                        <i className="w-[4px] h-[4px] rounded-full bg-[var(--brand-primary,#1e6cfb)] block" />
                        <i className="w-[3px] h-[3px] rounded-full bg-[var(--brand-primary,#1e6cfb)]/70 block mt-[4px]" />
                      </span>
                      <span className="absolute right-[2px] top-[14px] flex gap-[2px]">
                        <i className="w-[3px] h-[3px] rounded-full bg-[var(--brand-primary,#1e6cfb)]/80 block" />
                        <i className="w-[2.5px] h-[2.5px] rounded-full bg-[var(--brand-primary,#1e6cfb)]/60 block" />
                      </span>
                    </div>
                  }
                />
              </div>

              {/* Wordmark */}
              <div className="text-[26px] leading-none font-extrabold tracking-tight text-[#0f2743]">
                {brandName}
              </div>

              <h2 className="mt-4 text-2xl font-black tracking-tight text-[#0f2743]">
                Welcome back
              </h2>
              <p className="mt-1 text-xs sm:text-[13px] text-slate-500 font-medium">
                Sign in to continue to your workspace.
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 leading-relaxed font-semibold">{error}</div>
              </div>
            )}

            {/* Sign-in Form */}
            <form onSubmit={handleLoginSubmit} className="mt-5 space-y-3.5">
              {/* Email Address */}
              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <div className="relative flex items-center">
                  <Mail size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@oscartextiles.com"
                    autoComplete="username"
                    className="w-full h-11 bg-[#f0f4f9] hover:bg-[#eaf0f7] focus:bg-white border border-transparent focus:border-[var(--brand-primary,#1e6cfb)] rounded-xl py-2 pl-10 pr-3.5 text-xs sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[12.5px] font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="w-full h-11 bg-[#f0f4f9] hover:bg-[#eaf0f7] focus:bg-white border border-transparent focus:border-[var(--brand-primary,#1e6cfb)] rounded-xl py-2 pl-10 pr-10 text-xs sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition font-mono"
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

                {/* Forgot Password Right Link */}
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-[11.5px] font-semibold text-[var(--brand-primary,#1e6cfb)] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[var(--brand-primary,#1e6cfb)] focus:ring-blue-500 cursor-pointer accent-[var(--brand-primary,#1e6cfb)]"
                  />
                  <span className="text-[12px] font-medium text-slate-700">
                    Keep me signed in on this device
                  </span>
                </label>
              </div>

              {/* Primary Sign In Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 px-4 rounded-xl bg-[var(--brand-primary,#1e6cfb)] hover:bg-[var(--brand-primary-dark,#155de0)] active:scale-[0.99] text-white font-semibold text-[13.5px] sm:text-sm shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition duration-150 disabled:opacity-60 disabled:cursor-not-allowed select-none mt-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in to Workspace</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>

            {/* Card Footer: Need assistance + IT Helpdesk */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11.5px] text-slate-500">
              <span>Need access assistance?</span>
              <button
                type="button"
                onClick={() => setIsHelpOpen(true)}
                className="text-[var(--brand-primary,#1e6cfb)] font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Headphones size={14} className="text-[var(--brand-primary,#1e6cfb)]" />
                <span>IT Helpdesk</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL 1: FORGOT PASSWORD ── */}
      {isForgotModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setIsForgotModalOpen(false); }}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 relative">
            <button
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition"
            >
              <X size={16} />
            </button>

            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5 border border-blue-100">
              <KeyRound size={20} />
            </div>

            <h3 className="text-base font-bold text-slate-900">Reset Your Password</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Enter your corporate email address. If an account is active, your system administrator will issue password reset credentials.
            </p>

            {forgotSent ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>Recovery link generated. Please check your inbox or notify your workspace administrator.</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsForgotModalOpen(false); setForgotSent(false); }}
                  className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 transition cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="admin@oscartextiles.com"
                    className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    Send Instructions
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL 2: ENTERPRISE IT HELPDESK ── */}
      {isHelpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setIsHelpOpen(false); }}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 relative">
            <button
              type="button"
              onClick={() => setIsHelpOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition"
            >
              <X size={16} />
            </button>

            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5 border border-blue-100">
              <Headphones size={20} />
            </div>

            <h3 className="text-base font-bold text-slate-900">Enterprise IT Helpdesk</h3>
            <p className="text-xs text-slate-500 mt-1 mb-3 leading-relaxed">
              For immediate credentials assistance, account lockouts, or role authorization requests:
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Support Email</span>
                <span className="font-mono font-semibold text-slate-800">support@evenmore.io</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Hotline Ext.</span>
                <span className="font-mono font-semibold text-slate-800">+91 (022) 4800-ERP1</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 font-medium">Availability</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <Clock size={12} /> 24/7 Operations Desk
                </span>
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 transition cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
