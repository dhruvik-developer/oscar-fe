import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Headphones, X, Clock, Settings, BarChart3, Layers, Truck, Mail, Lock, Eye, EyeOff, ArrowRight, Sun, Moon } from 'lucide-react';
import './LoginPage.css';

/** localStorage key of the sign-in screen look: 'light' | 'dark'. */
const LOOK_KEY = 'oscar.login.look';
const INFINITY_PATH = 'M32 18c-5-8-10-12-16-12C9 6 4 11 4 18s5 12 12 12c6 0 11-4 16-12zm0 0c5 8 10 12 16 12 7 0 12-5 12-12S55 6 48 6c-6 0-11 4-16 12z';

const SESSION_END_NOTICES = {
  expired: 'Your session expired. Please sign in again to continue.',
  revoked: 'You were signed out because your password changed or an administrator ended your session.',
};
import { useAppStore } from '../../stores/appStore';
import { login as loginRequest, getSupportInfo, getLoginRoles } from '../../services/authService';
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
  // Light (white card) or dark (glass card) sign-in; remembered in this browser.
  const [look, setLook] = useState(() => {
    try { return window.localStorage.getItem(LOOK_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  const dark = look === 'dark';
  const chooseLook = (value) => {
    setLook(value);
    try { window.localStorage.setItem(LOOK_KEY, value); } catch { /* per-browser convenience only */ }
  };
  const [rememberMe, setRememberMe] = useState(true);
  const [capsOn, setCapsOn] = useState(false);
  const [notice, setNotice] = useState('');
  // "Select Your Role": options come from GET /auth/login-roles/ and the
  // server checks the pick against the account on sign-in.
  const [roles, setRoles] = useState([]);
  const [rolesState, setRolesState] = useState('loading'); // loading | ready | error
  const [rolesReload, setRolesReload] = useState(0);
  const [role, setRole] = useState('');

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

  // Re-read when a workspace is chosen: its roles may differ.
  useEffect(() => {
    let cancelled = false;
    setRolesState('loading');
    getLoginRoles(tenant || undefined)
      .then((list) => {
        if (cancelled) return;
        setRoles(list);
        setRole((current) => {
          if (list.some((r) => r.code === current)) return current;
          return list.length === 1 ? list[0].code : '';
        });
        setRolesState('ready');
      })
      .catch(() => {
        if (!cancelled) setRolesState('error');
      });
    return () => { cancelled = true; };
  }, [tenant, rolesReload]);

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
    if (!role) {
      setError('Please select your role.');
      return;
    }
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
        role,
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
    <div className={`oscar-login${dark ? ' oscar-login--dark' : ''}`}>
      {/* ── Background: base gradient, photo, side overlay, vignette ── */}
      <div className="oscar-login__bg" aria-hidden="true">
        <img src="/images/login-bg.png" alt="" className="oscar-login__photo" draggable={false} />
        <div className="oscar-login__side" />
        <div className="oscar-login__vignette" />
      </div>

      <div className="oscar-login__wrap">
        {/* ── Left hero text ── */}
        <div className="oscar-login__hero">
          <div className="oscar-login__brandrow">
            <BrandLogo
              size={34}
              fallback={
                <svg width="58" height="34" viewBox="0 0 64 36" fill="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="oscarHeroMark" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#1B4FD0" />
                      <stop offset="1" stopColor="#3B9BF0" />
                    </linearGradient>
                  </defs>
                  <path d={INFINITY_PATH} stroke="url(#oscarHeroMark)" strokeWidth="5" strokeLinejoin="round" />
                </svg>
              }
            />
            <span className="oscar-login__brandtext">
              <span className="oscar-login__brandname">{heroBrandName}</span>
              <span className="oscar-login__brandsub">ERP System</span>
            </span>
          </div>
          <span className="oscar-login__rule" aria-hidden="true" />
          <p className="oscar-login__eyebrow">Textile operations<br />simplified</p>
          <h1 className="oscar-login__headline">
            Efficiency<br />in Every<br />
            <span>Process.</span>
          </h1>
          <p className="oscar-login__tagline">Textile ERP for<br />a Smarter Tomorrow.</p>
          <ul className="oscar-login__pillars" aria-label="What Oscar ERP covers">
            {[
              [Settings, 'Plan', 'Orders & purchase'],
              [BarChart3, 'Produce', 'Production & job work'],
              [Layers, 'Track', 'Batches, QC & stock'],
              [Truck, 'Deliver', 'Dispatch & billing'],
            ].map(([Icon, label, detail]) => (
              <li key={label}>
                <span className="oscar-login__pillar-icon"><Icon size={22} strokeWidth={1.5} aria-hidden="true" /></span>
                <span className="oscar-login__pillar-label">{label}</span>
                <span className="oscar-login__pillar-detail">{detail}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Right: login card ── */}
        <div className="oscar-login__side-col">
          <div className="oscar-login__card">
            <div className="oscar-login__logo">
              <svg width="52" height="30" viewBox="0 0 64 36" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="oscarLoginMark" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#1B4FD0" />
                    <stop offset=".6" stopColor="#1E8BE0" />
                    <stop offset="1" stopColor="#22C8E8" />
                  </linearGradient>
                </defs>
                <path d={INFINITY_PATH} stroke="url(#oscarLoginMark)" strokeWidth="5" strokeLinejoin="round" />
              </svg>
              <div className="oscar-login__wordmark" role="img" aria-label="Evenmore Infotech Pvt Ltd">
                <span className="oscar-login__wordmark-main" aria-hidden="true">EVEN<b>M</b>ORE</span>
                <span className="oscar-login__wordmark-sub" aria-hidden="true">INFOTECH PVT LTD</span>
              </div>
            </div>

            <h2 className="oscar-login__title">{`Welcome to ${brandName} ERP`}</h2>
            <p className="oscar-login__subtitle">Sign in to continue to your workspace.</p>

            {twoFactor ? (
              <div className="oscar-login__twofactor">
                <TwoFactorStep
                  challenge={twoFactor}
                  remember={rememberMe}
                  onSignedIn={finishSignIn}
                  onCancel={() => { setTwoFactor(null); setError(''); }}
                />
              </div>
            ) : (
              <>
                <form onSubmit={handleLoginSubmit} className="oscar-login__form">
                  <div>
                    <label htmlFor="login-role" className="oscar-login__label">Select Your Role</label>
                    <select
                      id="login-role"
                      required
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={rolesState !== 'ready' || roles.length === 0}
                      aria-busy={rolesState === 'loading'}
                      aria-describedby="login-role-hint"
                      className="oscar-login__input"
                    >
                      {rolesState === 'loading' && <option value="">Loading roles…</option>}
                      {rolesState === 'error' && <option value="">Roles unavailable</option>}
                      {rolesState === 'ready' && roles.length === 0 && <option value="">No roles available</option>}
                      {rolesState === 'ready' && roles.length > 0 && (
                        <>
                          <option value="">Choose your role…</option>
                          {roles.map((r) => (
                            <option key={r.code} value={r.code}>{r.name}</option>
                          ))}
                        </>
                      )}
                    </select>
                    <span id="login-role-hint" className="oscar-login__hint" aria-live="polite">
                      {rolesState === 'error' && (
                        <>
                          Could not load roles.{' '}
                          <button type="button" className="oscar-login__link" onClick={() => setRolesReload((n) => n + 1)}>
                            Try again
                          </button>
                        </>
                      )}
                      {rolesState === 'ready' && roles.length === 0 && 'No active user has a role yet. Ask your administrator to assign one.'}
                    </span>
                  </div>

                  <div>
                    <label htmlFor="login-username" className="oscar-login__label">Email</label>
                    <div className="oscar-login__field">
                    {dark && <Mail size={18} className="oscar-login__icon" aria-hidden="true" />}
                    <input
                      id="login-username"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="username"
                      className={`oscar-login__input${dark ? ' oscar-login__input--icon' : ''}`}
                    />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="login-password" className="oscar-login__label">Password</label>
                    <div className="oscar-login__field">
                      {dark && <Lock size={18} className="oscar-login__icon" aria-hidden="true" />}
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyUp={(e) => setCapsOn(capsLockOn(e))}
                        onKeyDown={(e) => setCapsOn(capsLockOn(e))}
                        onBlur={() => setCapsOn(false)}
                        placeholder="Your password"
                        autoComplete="current-password"
                        className={`oscar-login__input oscar-login__input--pw${dark ? ' oscar-login__input--icon' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="oscar-login__toggle"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {dark
                          ? (showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />)
                          : (showPassword ? 'Hide' : 'Show')}
                      </button>
                    </div>
                    <span className="oscar-login__caps" aria-live="polite">
                      {capsOn ? 'Caps Lock is on' : ''}
                    </span>
                  </div>

                  {/* Workspace picker: only when the account exists in several */}
                  {workspaces.length > 0 && (
                    <div>
                      <label htmlFor="login-workspace" className="oscar-login__label">Workspace</label>
                      <select
                        id="login-workspace"
                        required
                        value={tenant}
                        onChange={(e) => setTenant(e.target.value)}
                        className="oscar-login__input"
                      >
                        <option value="">Choose a workspace…</option>
                        {workspaces.map((w) => (
                          <option key={w.slug} value={w.slug}>{w.name || w.slug}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="oscar-login__row">
                    <label className="oscar-login__remember">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span>Keep me signed in</span>
                    </label>
                    <button type="button" onClick={openForgotModal} className="oscar-login__link">
                      Forgot password?
                    </button>
                  </div>

                  <button type="submit" disabled={isLoading || !role} className="oscar-login__submit">
                    {isLoading ? (
                      <>
                        <span className="oscar-login__spinner" aria-hidden="true" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign in</span>
                        {dark && <ArrowRight size={18} aria-hidden="true" />}
                      </>
                    )}
                  </button>
                </form>

                {/* Error, or why the last session ended (expired / revoked) */}
                <div
                  className={`oscar-login__status${error ? ' oscar-login__status--error' : ''}`}
                  role={error ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {error || notice}
                </div>
              </>
            )}

            <div className="oscar-login__card-footer">
              Need access?{' '}
              <button type="button" onClick={() => setIsHelpOpen(true)} className="oscar-login__link">
                Ask your administrator.
              </button>
            </div>
          </div>
          <div className="oscar-login__look" role="radiogroup" aria-label="Sign-in screen theme">
            <button type="button" role="radio" aria-checked={!dark} onClick={() => chooseLook('light')} className={!dark ? 'is-active' : ''}>
              <Sun size={14} aria-hidden="true" /> Light
            </button>
            <button type="button" role="radio" aria-checked={dark} onClick={() => chooseLook('dark')} className={dark ? 'is-active' : ''}>
              <Moon size={14} aria-hidden="true" /> Dark
            </button>
          </div>
          <div className="oscar-login__footer">Oscar Creation · Surat</div>
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
