import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, KeyRound, Monitor, LogOut, History, AlertCircle, RefreshCw,
} from 'lucide-react';
import {
  listSessions,
  revokeSession,
  revokeOtherSessions,
  getLoginHistory,
  updateProfile,
} from '../../services/authService';
import { describeError } from '../../services/resourceSync';
import { useAppStore } from '../../stores/appStore';

const EVENT_LABELS = {
  login: 'Signed in',
  login_failed: 'Wrong password',
  login_blocked: 'Blocked (account locked)',
  login_code_sent: 'Sign-in code emailed',
  logout: 'Signed out',
  change_password: 'Password changed',
  password_reset: 'Password reset',
  sessions_revoked: 'Other devices signed out',
};
const WARNING_EVENTS = new Set(['login_failed', 'login_blocked']);

const when = (value) => (value ? new Date(value).toLocaleString() : '—');

function Card({ icon: Icon, title, action, children }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Icon size={16} className="text-blue-600" /> {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * `/account/security` — the signed-in user's own security settings:
 * password, two-step sign-in, devices signed in, and recent sign-in activity.
 */
export default function AccountSecurityPage() {
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const showToast = useAppStore((s) => s.showToast);

  const [sessions, setSessions] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [rows, events] = await Promise.all([listSessions(), getLoginHistory()]);
      const now = Date.now();
      setSessions(rows.filter((s) => !s.revokedAt && new Date(s.expiresAt).getTime() > now));
      setHistory(events);
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (key, task, message) => {
    setBusy(key);
    setError('');
    try {
      await task();
      if (message) showToast?.(message);
      await load();
    } catch (err) {
      setError(err?.message || describeError(err));
    } finally {
      setBusy('');
    }
  };

  // The role can require two-step sign-in; then the user cannot switch it off.
  const roleRequires = Boolean(currentUser?.twoFactorRequired && !currentUser?.twoFactorEnabled);
  const twoFactorOn = Boolean(currentUser?.twoFactorRequired);

  const toggleTwoFactor = () => run('2fa', async () => {
    const user = await updateProfile({ twoFactorEnabled: !currentUser?.twoFactorEnabled });
    setCurrentUser({ ...currentUser, ...user });
  }, currentUser?.twoFactorEnabled ? 'Two-step sign-in turned off.' : 'Two-step sign-in turned on.');

  const others = (sessions || []).filter((s) => !s.isCurrent);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-black tracking-tight text-slate-900">Security</h1>
        <p className="text-xs text-slate-500 mt-1">
          Your password, two-step sign-in, signed-in devices and recent activity.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{error}</div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card icon={KeyRound} title="Password">
          <p className="text-xs text-slate-500 mb-4">
            Changing your password signs out every other device.
          </p>
          <button
            type="button"
            onClick={() => navigate('/change-password?returnTo=/account/security')}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            Change password
          </button>
        </Card>

        <Card icon={ShieldCheck} title="Two-step sign-in">
          <p className="text-xs text-slate-500 mb-4">
            After your password, enter a 6-digit code emailed to{' '}
            <span className="font-semibold text-slate-700">{currentUser?.email}</span>.
          </p>
          <label className={`flex items-center gap-3 ${roleRequires ? 'opacity-70' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={twoFactorOn}
              disabled={roleRequires || busy === '2fa'}
              onChange={toggleTwoFactor}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="text-xs font-semibold text-slate-800">
              {twoFactorOn ? 'On' : 'Off'}
              {roleRequires && <span className="ml-1.5 font-normal text-slate-500">(required by your role)</span>}
            </span>
          </label>
        </Card>
      </div>

      <Card
        icon={Monitor}
        title="Signed-in devices"
        action={(
          <button
            type="button"
            disabled={!others.length || busy === 'others'}
            onClick={() => run('others', revokeOtherSessions, 'Other devices signed out.')}
            className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11.5px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <LogOut size={13} /> Sign out all other devices
          </button>
        )}
      >
        {sessions === null ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <li key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                    {s.device || 'Unknown device'}
                    {s.isCurrent && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">This device</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {s.ip || 'IP unknown'} · signed in {when(s.issuedAt)} · last active {when(s.lastSeenAt)}
                  </div>
                </div>
                {!s.isCurrent && (
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => run(s.id, () => revokeSession(s.id), 'Device signed out.')}
                    className="text-[11.5px] font-semibold text-rose-600 hover:underline cursor-pointer disabled:opacity-40"
                  >
                    Sign out
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        icon={History}
        title="Recent sign-in activity"
        action={(
          <button type="button" onClick={load} className="text-slate-400 hover:text-slate-700 cursor-pointer" title="Refresh">
            <RefreshCw size={14} />
          </button>
        )}
      >
        {history === null ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-slate-400">No activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1.5 pr-3 font-semibold">When</th>
                  <th className="py-1.5 pr-3 font-semibold">Event</th>
                  <th className="py-1.5 font-semibold">IP address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{when(row.at)}</td>
                    <td className={`py-2 pr-3 font-semibold ${WARNING_EVENTS.has(row.action) ? 'text-rose-600' : 'text-slate-800'}`}>
                      {EVENT_LABELS[row.action] || row.description || row.action}
                    </td>
                    <td className="py-2 text-slate-500 font-mono">{row.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          Do not recognise something? Change your password and sign out all other devices.
        </p>
      </Card>
    </div>
  );
}
