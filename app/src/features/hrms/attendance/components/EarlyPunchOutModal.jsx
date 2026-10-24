import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Clock, FileText, CheckCircle2, X, Loader2 } from 'lucide-react';

/**
 * EarlyPunchOutModal
 * Modal displayed when an employee attempts to punch out before their scheduled shift end
 * or before completing full required working hours.
 */
export function EarlyPunchOutModal({
  isOpen,
  onClose,
  onConfirm,
  todayPunch,
  isSubmitting = false,
}) {
  const [reason, setReason] = useState('');
  const [requestRegularization, setRequestRegularization] = useState(true);
  const [validationError, setValidationError] = useState('');

  if (!isOpen) return null;

  const shiftEndStr = todayPunch?.shiftEnd || '18:30';
  const [endH, endM] = shiftEndStr.split(':').map((v) => parseInt(v, 10) || 0);

  const now = new Date();
  const shiftEndDt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM, 0);
  const diffMs = shiftEndDt.getTime() - now.getTime();
  const earlyMins = Math.max(0, Math.floor(diffMs / 60000));
  const hoursEarly = Math.floor(earlyMins / 60);
  const minsEarly = earlyMins % 60;
  const earlyFormatted = hoursEarly > 0 ? `${hoursEarly}h ${minsEarly}m early` : `${minsEarly} min early`;

  const workingHours = Number(todayPunch?.workingHours || 0);
  const isUnderHalfDay = workingHours < 4;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setValidationError('Please provide a reason for early punch out.');
      return;
    }
    setValidationError('');
    await onConfirm({
      reason: reason.trim(),
      requestRegularization,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose?.();
      }}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-600">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Early Punch Out</h3>
              <p className="text-[11px] text-slate-500">Confirm leaving before shift completion</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4.5 space-y-4 overflow-y-auto">
          {/* Shift & Time Warning Notice */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-300 text-xs space-y-1.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-amber-600 shrink-0" />
                Shift Ends at {shiftEndStr}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-bold">
                {earlyFormatted}
              </span>
            </div>
            <div className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
              Your worked duration so far is <strong className="font-mono">{todayPunch?.formattedWorkingTime || '00h 00m'}</strong>.
              {isUnderHalfDay ? (
                <span className="block mt-1 text-rose-600 dark:text-rose-400 font-medium">
                  ⚠️ Note: Working less than 4 hours is categorized as a <strong>Half Day</strong> in payroll (0.5 day deduction) unless regularized.
                </span>
              ) : (
                <span className="block mt-1 font-medium">
                  Early leaving will be recorded on your attendance profile.
                </span>
              )}
            </div>
          </div>

          {/* Validation error message */}
          {validationError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-medium">
              {validationError}
            </div>
          )}

          {/* Reason Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Reason for Early Punch Out <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (validationError) setValidationError('');
              }}
              placeholder="e.g., Doctor appointment, medical emergency, urgent personal work, client on-site visit..."
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition resize-none"
            />
          </div>

          {/* Regularization Option Checkbox */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={requestRegularization}
                onChange={(e) => setRequestRegularization(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500/30 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText size={13} className="text-blue-600" />
                  Request Attendance Regularization
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                  Automatically submit a regularization request to your manager for approval.
                  Once approved, your full day attendance is credited in monthly payroll.
                </p>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              <span>Confirm Early Punch Out</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default EarlyPunchOutModal;
