/**
 * usePunchActions — Punch In / Punch Out, shared by the topbar button and the
 * Mark Attendance page so both drive (and show) the same punch.
 */
import { useCallback, useState } from 'react';
import { useAttendanceStore } from '../../../stores/attendanceStore';
import { useAppStore } from '../../../stores/appStore';

/** Leaving before the shift ends, or with under 8h worked, asks for a reason. */
export function isEarlyDeparture(todayPunch, now = new Date()) {
  const [endH, endM] = String(todayPunch?.shiftEnd || '18:30').split(':').map((v) => parseInt(v, 10) || 0);
  const shiftEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM, 0);
  const earlyMins = Math.floor((shiftEnd.getTime() - now.getTime()) / 60000);
  const workingHours = Number(todayPunch?.workingHours || 0);
  return earlyMins > 0 || (workingHours > 0 && workingHours < 8);
}

export function usePunchActions() {
  const todayPunch = useAttendanceStore.raw((s) => s.todayPunch);
  const fetchTodayPunch = useAttendanceStore.raw((s) => s.fetchTodayPunch);
  const tickPunch = useAttendanceStore.raw((s) => s.tickPunch);
  const punchIn = useAttendanceStore.raw((s) => s.punchIn);
  const punchOut = useAttendanceStore.raw((s) => s.punchOut);
  const showToast = useAppStore((s) => s.showToast);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [earlyModalOpen, setEarlyModalOpen] = useState(false);

  const doPunchIn = useCallback(async () => {
    try {
      setSubmitting(true);
      setError(null);
      await punchIn();
      showToast?.('Punched In successfully!');
    } catch (err) {
      const msg = err?.payload?.message || err?.message || 'Failed to punch in';
      setError(msg);
      showToast?.(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }, [punchIn, showToast]);

  const executePunchOut = useCallback(async (earlyPayload = null) => {
    try {
      setSubmitting(true);
      setError(null);
      await punchOut(earlyPayload || {});
      showToast?.(
        earlyPayload?.requestRegularization
          ? 'Early Punch Out recorded & Regularization submitted!'
          : 'Punched Out successfully!'
      );
      setEarlyModalOpen(false);
    } catch (err) {
      const msg = err?.payload?.message || err?.message || 'Failed to punch out';
      setError(msg);
      showToast?.(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }, [punchOut, showToast]);

  /** Punch out, asking for a reason first when it is an early departure. */
  const doPunchOut = useCallback(async () => {
    if (isEarlyDeparture(todayPunch)) {
      setEarlyModalOpen(true);
      return;
    }
    await executePunchOut();
  }, [todayPunch, executePunchOut]);

  return {
    todayPunch,
    fetchTodayPunch,
    tickPunch,
    submitting,
    error,
    doPunchIn,
    doPunchOut,
    executePunchOut,
    earlyModalOpen,
    setEarlyModalOpen,
  };
}

export default usePunchActions;
