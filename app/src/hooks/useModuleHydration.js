/**
 * useModuleHydration — keeps the module stores in step with the session.
 *
 * It no longer fills them. Every module store hydrates itself the first time a
 * screen reads it (`services/lazyModules`), so opening the app costs the
 * requests of the page being opened and nothing else; the CRM, PMS, payroll,
 * recruitment and training pulls happen when those screens are actually asked
 * for.
 *
 * What still has to be watched from here is the session itself:
 *
 *   signed out — empty every store, so the next user sees nothing of the
 *                previous one, and forget what was loaded.
 *   signed in  — forget what was loaded and re-pull whichever modules this tab
 *                has already used: screens that are already mounted will not
 *                read their store a second time on their own.
 */
import { useEffect } from 'react';
import { getStoredToken } from '../utils/authUtils';
import { refreshNotifications } from '../services/crmEventNotifications';
import {
  resetLazyModules,
  refreshRequestedModules,
  requestedModuleNames,
} from '../services/lazyModules';
import { useAppStore } from '../stores/appStore';
import { useCrmStore } from '../stores/crmStore';
import { usePmsStore } from '../stores/pmsStore';
import { useAttendanceStore } from '../stores/attendanceStore';
import { useRecruitmentStore } from '../stores/recruitmentStore';
import { usePerformanceStore } from '../stores/performanceStore';
import { usePayrollStore } from '../stores/payrollStore';
import { usePolicyStore } from '../stores/policyStore';
// import { useTrainingStore } from '../stores/trainingStore';
import { useAssetStore } from '../stores/assetStore';
import { useDocumentStore } from '../stores/documentStore';
import { useCalendarStore } from '../stores/calendarStore';

/** Every store that owns server data, for the sign-out sweep. */
const MODULE_STORES = [
  useCrmStore,
  usePmsStore,
  useAttendanceStore,
  useRecruitmentStore,
  usePerformanceStore,
  usePayrollStore,
  usePolicyStore,
  // useTrainingStore,
  useAssetStore,
  useDocumentStore,
  useCalendarStore,
];

/** Run when the browser is next idle, so it never competes with the first paint. */
function whenIdle(fn) {
  if (typeof window !== 'undefined' && window.requestIdleCallback) {
    return window.requestIdleCallback(fn, { timeout: 3000 });
  }
  return setTimeout(fn, 1200);
}

export function useModuleHydration() {
  useEffect(() => {
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      const app = useAppStore.getState();

      if (!getStoredToken()) {
        MODULE_STORES.forEach((store) => {
          const state = store.getState();
          // Some stores already used `clear` for their toast, so the data reset
          // is `clearData` there.
          (state.clearData || state.clear)?.();
        });
        app.clearHrms?.();
        resetLazyModules();
        return;
      }

      // A session just appeared (or changed). Anything this tab already pulled
      // belongs to the previous one, so re-pull exactly that much; everything
      // else stays unloaded until a screen asks.
      refreshRequestedModules(requestedModuleNames());

      // PMS filters "my projects" / "my tasks" by the signed-in user.
      const me = app.currentUser;
      if (me?.id) usePmsStore.getState().setCurrentUserId(me.employeeId || me.id);
    };

    run();

    // The notification bell lives in the topbar on every screen, so its feed is
    // session-wide — but it is one request behind the page the user asked for.
    const idle = whenIdle(() => {
      if (!cancelled && getStoredToken()) refreshNotifications();
    });

    // Signing in from another tab, or the token being cleared by a 401, both
    // change what this shell should be holding.
    window.addEventListener('evenmore:authorized', run);
    window.addEventListener('evenmore:unauthorized', run);
    window.addEventListener('storage', run);
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined' && window.cancelIdleCallback) {
        window.cancelIdleCallback(idle);
      } else {
        clearTimeout(idle);
      }
      window.removeEventListener('evenmore:authorized', run);
      window.removeEventListener('evenmore:unauthorized', run);
      window.removeEventListener('storage', run);
    };
  }, []);
}

export default useModuleHydration;
