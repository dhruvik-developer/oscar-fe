import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Infinity as InfinityIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Headphones,
  X,
  Clock,
  Building2,
  Info,
} from 'lucide-react';

const SESSION_END_NOTICES = {
  expired: 'Your session expired. Please sign in again to continue.',
  revoked: 'You were signed out because your password changed or an administrator ended your session.',
};
import { useAppStore } from '../../stores/appStore';
import { login as loginRequest, getSupportInfo } from '../../services/authService';
import { describeError } from '../../services/resourceSync';
import { getStoredToken, takeAuthEndReason } from '../../utils/authUtils';
import { capsLockOn } from './passwordRules';
import ForgotPasswordModal from './ForgotPasswordModal';
import TwoFactorStep from './TwoFactorStep';
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
  const [capsOn, setCapsOn] = useState(false);
  const [notice, setNotice] = useState('');

  // Filled only when the server answers TENANT_REQUIRED: the same email and
  // password open accounts in more than one workspace.
  const [workspaces, setWorkspaces] = useState([]);
  const [tenant, setTenant] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  // { email, phone, hours } from the server; null until the box is opened.
  const [support, setSupport] = useState(null);
  // Set when the password was right but the account wants an emailed code.
  const [twoFactor, setTwoFactor] = useState(null);

  useEffect(() => {
    if (!isHelpOpen || support) return;
    getSupportInfo()
      .then((info) => setSupport(info || {}))
      .catch(() => setSupport({}));
  }, [isHelpOpen, support]);

  useEffect(() => {
    const existingToken = getStoredToken();
    if (existingToken) {
      navigate(returnTo || '/dashboard', { replace: true });
    }
  }, [navigate, returnTo]);

  // Explain a sign-out the user did not ask for. The reason is read once.
  useEffect(() => {
    const reason = takeAuthEndReason();
    if (reason && SESSION_END_NOTICES[reason]) setNotice(SESSION_END_NOTICES[reason]);
  }, []);

  const finishSignIn = ({ user, permissions }) => {
    setCurrentUser(user);
    setPermissions(permissions);

    showToast?.(`Signed in successfully as ${user?.name || email}`);
    const targetRoute = (returnTo && returnTo !== '/dashboard')
      ? returnTo
      : getRoleDefaultRoute(user?.roleCode || user?.role?.code, permissions);
    if (user?.mustChangePassword) {
      navigate(`/change-password?returnTo=${encodeURIComponent(targetRoute)}`, { replace: true });
      return;
    }
    navigate(targetRoute, { replace: true });
  };

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
    if (workspaces.length > 0 && !tenant) {
      setError('Please choose a workspace.');
      return;
    }

    setIsLoading(true);
    setError('');
    setNotice('');

    try {
      const result = await loginRequest({
        email,
        password,
        tenant: workspaces.length > 0 ? tenant : undefined,
        remember: rememberMe,
      });
      if (result.twoFactor) {
        setTwoFactor(result.twoFactor);
        setPassword('');
        return;
      }
      finishSignIn(result);
    } catch (err) {
      const choices = err?.payload?.code === 'TENANT_REQUIRED'
        ? err.payload.payload?.workspaces || []
        : [];
      if (choices.length > 0) {
        setWorkspaces(choices);
        setTenant('');
      }
      setError(describeError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // A different email may belong to different workspaces; drop the old list.
  const handleEmailChange = (value) => {
    setEmail(value);
    if (workspaces.length > 0) {
      setWorkspaces([]);
      setTenant('');
    }
  };

  const openForgotModal = () => {
    setForgotEmail(email.trim());
    setIsForgotModalOpen(true);
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

            {/* Why the last session ended (expired / revoked) */}
            {notice && !error && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                <Info size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <div className="flex-1 leading-relaxed font-semibold">{notice}</div>
              </div>
            )}

            {/* Error Banner (the code step shows its own) */}
            {error && !twoFactor && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 leading-relaxed font-semibold">{error}</div>
              </div>
            )}

            {/* Sign-in Form */}
            {twoFactor ? (
              <TwoFactorStep
                challenge={twoFactor}
                remember={rememberMe}
                onSignedIn={finishSignIn}
                onCancel={() => { setTwoFactor(null); setError(''); }}
              />
            ) : (
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
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="you@company.com"
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
                    onKeyUp={(e) => setCapsOn(capsLockOn(e))}
                    onKeyDown={(e) => setCapsOn(capsLockOn(e))}
                    onBlur={() => setCapsOn(false)}
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

                {/* Caps Lock warning + Forgot Password link */}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11.5px] font-semibold text-amber-700" aria-live="polite">
                    {capsOn ? 'Caps Lock is on' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={openForgotModal}
                    className="text-[11.5px] font-semibold text-[var(--brand-primary,#1e6cfb)] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {/* Workspace picker: only when the account exists in several */}
              {workspaces.length > 0 && (
                <div>
                  <label className="block text-[12.5px] font-medium text-slate-700 mb-1.5">
                    Workspace
                  </label>
                  <div className="relative flex items-center">
                    <Building2 size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                    <select
                      required
                      value={tenant}
                      onChange={(e) => setTenant(e.target.value)}
                      className="w-full h-11 bg-[#f0f4f9] hover:bg-[#eaf0f7] focus:bg-white border border-transparent focus:border-[var(--brand-primary,#1e6cfb)] rounded-xl py-2 pl-10 pr-3.5 text-xs sm:text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition cursor-pointer"
                    >
                      <option value="">Choose a workspace…</option>
                      {workspaces.map((w) => (
                        <option key={w.slug} value={w.slug}>{w.name || w.slug}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

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
            )}

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

      {/* ── MODAL 1: FORGOT PASSWORD (code or link) ── */}
      {isForgotModalOpen && (
        <ForgotPasswordModal initialEmail={forgotEmail} onClose={() => setIsForgotModalOpen(false)} />
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

            <h3 className="text-base font-bold text-slate-900">IT Helpdesk</h3>
            <p className="text-xs text-slate-500 mt-1 mb-3 leading-relaxed">
              For sign-in problems, locked accounts or access to more modules:
            </p>

            {support === null ? (
              <p className="text-xs text-slate-400">Loading contact details…</p>
            ) : support.email || support.phone || support.hours ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 divide-y divide-slate-200/60 text-xs">
                {support.email && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500 font-medium">Email</span>
                    <a href={`mailto:${support.email}`} className="font-mono font-semibold text-slate-800 hover:underline">{support.email}</a>
                  </div>
                )}
                {support.phone && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500 font-medium">Phone</span>
                    <a href={`tel:${support.phone.replace(/[^\d+]/g, '')}`} className="font-mono font-semibold text-slate-800 hover:underline">{support.phone}</a>
                  </div>
                )}
                {support.hours && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500 font-medium">Hours</span>
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <Clock size={12} /> {support.hours}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 leading-relaxed">
                Please contact your system administrator. They can unlock your account, reset your password or change your access.
              </p>
            )}

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
