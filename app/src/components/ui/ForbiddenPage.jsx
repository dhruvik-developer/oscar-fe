import { ShieldX, LayoutDashboard, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

/**
 * ForbiddenPage — shown when a signed-in user opens a route their role does
 * not include. Kept inside MainLayout so the sidebar/topbar still work and the
 * user can move somewhere they do have access to.
 */
export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/25">
          <ShieldX size={28} strokeWidth={1.8} />
        </div>

        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-500">
          403 · Access denied
        </p>
        <h1 className="text-xl font-bold text-[var(--text)]">
          You don&apos;t have permission to view this page
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
          Your role does not include access to this area. If you think this is a
          mistake, ask an administrator to update your role permissions.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--card-hover)]"
          >
            <ArrowLeft size={15} />
            Go back
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <LayoutDashboard size={15} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
