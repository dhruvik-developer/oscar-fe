import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, HelpCircle, AlertCircle, X, Loader2 } from 'lucide-react';

/**
 * ConfirmModal — Modern, centered confirmation dialog.
 * Replaces native browser window.confirm() prompts with an enterprise ERP dialog.
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onConfirm: () => void | Promise<void>
 * - title: string
 * - message: string | React.ReactNode
 * - confirmText?: string (default: 'Confirm' or 'Delete')
 * - cancelText?: string (default: 'Cancel')
 * - variant?: 'danger' | 'warning' | 'primary' | 'info' (default: 'danger')
 * - icon?: LucideIcon
 * - loading?: boolean
 * - itemName?: string | React.ReactNode
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText,
  cancelText = 'Cancel',
  variant = 'danger',
  icon: CustomIcon,
  loading = false,
  itemName = null,
}) {
  const confirmBtnRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  // Determine icon and theme styles based on variant
  let Icon = CustomIcon;
  let iconContainerClass = '';
  let confirmBtnClass = '';
  const defaultConfirmText = variant === 'danger' ? 'Delete' : 'Confirm';
  const resolvedConfirmText = confirmText || defaultConfirmText;

  if (variant === 'danger') {
    if (!Icon) Icon = Trash2;
    iconContainerClass = 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40';
    confirmBtnClass = 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs shadow-rose-600/25';
  } else if (variant === 'warning') {
    if (!Icon) Icon = AlertTriangle;
    iconContainerClass = 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40';
    confirmBtnClass = 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs shadow-amber-600/25';
  } else {
    if (!Icon) Icon = HelpCircle;
    iconContainerClass = 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40';
    confirmBtnClass = 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs shadow-blue-600/25';
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-200 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header & Content */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconContainerClass}`}>
              <Icon size={22} className="shrink-0" />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4">
            <h3 id="confirm-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
              {title}
            </h3>

            <div className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {message}
            </div>

            {itemName && (
              <div className="mt-3.5 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                <span className="truncate">{itemName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/70 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/80 transition cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>

          <button
            ref={confirmBtnRef}
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50 ${confirmBtnClass}`}
          >
            {loading ? <Loader2 size={15} className="animate-spin shrink-0" /> : null}
            <span>{loading ? 'Processing...' : resolvedConfirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
