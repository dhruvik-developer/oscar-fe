import { useEffect, useState } from 'react';
import { ensureModule } from '../services/lazyModules';

/**
 * False until the browser has gone idle after the first paint.
 *
 * The shell's own data — the sidebar badges, the topbar's alert list — belongs
 * to no page in particular, and reading a collection is what pulls it
 * (`ERPContext`). Gating those reads on this flag keeps the first paint's
 * requests to the ones the page being opened actually needs; a moment later the
 * badges fill in.
 */
export function useIdleReady(timeout = 3000) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.requestIdleCallback) {
      const handle = window.requestIdleCallback(() => setReady(true), { timeout });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(handle);
  }, [timeout]);

  return ready;
}

/**
 * Load a module store once the browser is idle, without making the reading
 * component wait for it. For data the shell shows on every screen — a nav
 * badge — where the page the user asked for should have the network first.
 */
export function useModuleWhenIdle(name) {
  const ready = useIdleReady();
  useEffect(() => {
    if (ready) ensureModule(name);
  }, [ready, name]);
  return ready;
}

export default useIdleReady;
