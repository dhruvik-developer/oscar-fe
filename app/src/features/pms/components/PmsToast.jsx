import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { usePmsStore } from '../../../stores/pmsStore';

/**
 * PmsToast — transient confirmation for PMS actions.
 *
 * Mounted once per PMS page. The store already carried a toast slot from
 * Stage 1; this is the host that finally renders it. Auto-dismisses, but the
 * close button is always present so a screen-reader user is not racing a timer.
 */

const TONES = {
  success: { icon: CheckCircle2, bg: '#d1fae5', fg: '#065f46', border: '#a7f3d0' },
  error: { icon: AlertTriangle, bg: '#ffe4e6', fg: '#9f1239', border: '#fecdd3' },
  info: { icon: Info, bg: '#e0f2fe', fg: '#0369a1', border: '#bae6fd' },
};

const DISMISS_MS = 4000;

export function PmsToast() {
  const toast = usePmsStore((s) => s.toast);
  const clearToast = usePmsStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => clearToast(), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  const tone = TONES[toast.tone] ?? TONES.success;
  const Icon = tone.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-50 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-lg"
      style={{
        background: tone.bg,
        borderColor: tone.border,
        color: tone.fg,
        // Sits above the mobile nav and clear of the support bubble.
        bottom: 24,
        left: 16,
        right: 16,
        maxWidth: 380,
        marginLeft: 'auto',
      }}
      data-test="pms-toast"
    >
      <Icon size={15} strokeWidth={2.4} className="shrink-0 mt-0.5" />
      <p className="text-xs font-semibold flex-1 min-w-0">{toast.msg}</p>
      <button
        type="button"
        onClick={clearToast}
        aria-label="Dismiss notification"
        className="shrink-0 opacity-60 hover:opacity-100"
        style={{ color: tone.fg }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default PmsToast;
