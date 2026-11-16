import React, { useEffect, useRef, useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Loader2,
  Edit3
} from 'lucide-react';

/**
 * Unified GlobalModal Component
 * Follows OSCAR ERP's design system:
 * - Always centered on screen
 * - Dark translucent backdrop with blur (z-[99999])
 * - Clean white card with subtle border and deep shadow
 * - Navy/blue primary accents, semantic danger/warning/success tones
 * - Responsive, accessible, smooth animations
 */
export function GlobalModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmation',
  message,
  children,
  confirmText,
  cancelText = 'Cancel',
  variant = 'primary', // 'primary' | 'danger' | 'warning' | 'info' | 'success' | 'prompt'
  icon: CustomIcon,
  itemName,
  loading = false,
  dismissible = true,
  // Prompt specific props
  isPrompt = false,
  promptLabel,
  promptPlaceholder = '',
  promptDefaultValue = '',
  promptRequired = false,
  promptValidate,
}) {
  const [promptValue, setPromptValue] = useState(promptDefaultValue);
  const [promptError, setPromptError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);
  const confirmBtnRef = useRef(null);

  // Sync prompt default value on open
  useEffect(() => {
    if (isOpen) {
      setPromptValue(promptDefaultValue || '');
      setPromptError('');
      setIsSubmitting(false);
    }
  }, [isOpen, promptDefaultValue]);

  // Autofocus input or confirm button
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (isPrompt && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      } else if (confirmBtnRef.current) {
        confirmBtnRef.current.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, isPrompt]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && dismissible && !loading && !isSubmitting) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, dismissible, loading, isSubmitting, onClose]);

  if (!isOpen) return null;

  // Resolve visual styling according to variant
  let Icon = CustomIcon;
  let iconBoxClass = 'bg-blue-50 text-blue-600 border border-blue-200/80';
  let confirmBtnClass = 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs';
  let defaultConfirm = 'Confirm';
  let isSingleAction = variant === 'info' || variant === 'success' || variant === 'error';

  if (variant === 'danger' || variant === 'delete') {
    if (!Icon) Icon = Trash2;
    iconBoxClass = 'bg-rose-50 text-rose-600 border border-rose-200/80';
    confirmBtnClass = 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs';
    defaultConfirm = 'Delete';
  } else if (variant === 'warning') {
    if (!Icon) Icon = AlertTriangle;
    iconBoxClass = 'bg-amber-50 text-amber-600 border border-amber-200/80';
    confirmBtnClass = 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs';
    defaultConfirm = 'Proceed';
  } else if (variant === 'success') {
    if (!Icon) Icon = CheckCircle2;
    iconBoxClass = 'bg-emerald-50 text-emerald-600 border border-emerald-200/80';
    confirmBtnClass = 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs';
    defaultConfirm = 'OK';
  } else if (variant === 'error') {
    if (!Icon) Icon = AlertCircle;
    iconBoxClass = 'bg-rose-50 text-rose-600 border border-rose-200/80';
    confirmBtnClass = 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs';
    defaultConfirm = 'Close';
  } else if (variant === 'info') {
    if (!Icon) Icon = Info;
    iconBoxClass = 'bg-sky-50 text-sky-600 border border-sky-200/80';
    confirmBtnClass = 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs';
    defaultConfirm = 'OK';
  } else if (isPrompt) {
    if (!Icon) Icon = Edit3;
    iconBoxClass = 'bg-indigo-50 text-indigo-600 border border-indigo-200/80';
    confirmBtnClass = 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-xs';
    defaultConfirm = 'Submit';
  } else {
    if (!Icon) Icon = HelpCircle;
  }

  const resolvedConfirmText = confirmText || defaultConfirm;
  const isBusy = loading || isSubmitting;

  const handleConfirmClick = async () => {
    if (isBusy) return;

    if (isPrompt) {
      if (promptRequired && (!promptValue || !promptValue.trim())) {
        setPromptError('This field is required.');
        inputRef.current?.focus();
        return;
      }
      if (typeof promptValidate === 'function') {
        const error = promptValidate(promptValue);
        if (error) {
          setPromptError(error);
          inputRef.current?.focus();
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      if (isPrompt) {
        await onConfirm?.(promptValue);
      } else {
        await onConfirm?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromptFormSubmit = (e) => {
    e.preventDefault();
    handleConfirmClick();
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissible && !isBusy) {
          onClose?.();
        }
      }}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-150 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="p-5 sm:p-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBoxClass}`}>
              <Icon size={22} className="shrink-0" />
            </div>

            {dismissible && (
              <button
                type="button"
                disabled={isBusy}
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-40"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="mt-3.5">
            <h3
              id="global-modal-title"
              className="text-[16px] sm:text-[17px] font-bold text-[#17294e] leading-snug tracking-tight"
            >
              {title}
            </h3>

            {message && (
              <div className="mt-2 text-[12.5px] sm:text-[13px] text-slate-600 leading-relaxed break-words whitespace-pre-line">
                {message}
              </div>
            )}

            {itemName && (
              <div className="mt-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200/90 text-[12px] font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                <span className="truncate">{itemName}</span>
              </div>
            )}

            {/* Custom Content or Prompt Form */}
            {isPrompt ? (
              <form onSubmit={handlePromptFormSubmit} className="mt-4 space-y-2">
                {promptLabel && (
                  <label className="block text-[11.5px] font-bold text-slate-700">
                    {promptLabel} {promptRequired && <span className="text-rose-500">*</span>}
                  </label>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={promptValue}
                  disabled={isBusy}
                  onChange={(e) => {
                    setPromptValue(e.target.value);
                    if (promptError) setPromptError('');
                  }}
                  placeholder={promptPlaceholder}
                  className={`w-full px-3 py-2 text-[13px] border rounded-xl outline-none transition bg-white text-slate-900 placeholder:text-slate-400 ${
                    promptError ? 'border-rose-400 focus:border-rose-500 ring-1 ring-rose-200' : 'border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
                  }`}
                />
                {promptError && (
                  <p className="text-[11px] font-medium text-rose-600">{promptError}</p>
                )}
              </form>
            ) : children ? (
              <div className="mt-3">{children}</div>
            ) : null}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {!isSingleAction && (
            <button
              type="button"
              disabled={isBusy}
              onClick={onClose}
              className="px-4 py-2 text-[12.5px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition cursor-pointer disabled:opacity-40"
            >
              {cancelText}
            </button>
          )}

          <button
            ref={confirmBtnRef}
            type="button"
            disabled={isBusy}
            onClick={handleConfirmClick}
            className={`px-4 py-2 text-[12.5px] font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${confirmBtnClass}`}
          >
            {isBusy ? <Loader2 size={14} className="animate-spin shrink-0" /> : null}
            <span>{isBusy ? 'Processing…' : resolvedConfirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default GlobalModal;
