import { useEffect, useRef } from 'react';

/** Subscribers per channel key: `useSharedPolling` runs the poll once per key. */
const shared = new Map();

function runShared(key) {
  const entry = shared.get(key);
  if (!entry) return;
  entry.lastRun = Date.now();
  entry.fn();
}

function stopShared(entry) {
  if (entry.timer) {
    clearInterval(entry.timer);
    entry.timer = null;
  }
}

function startShared(key, intervalMs) {
  const entry = shared.get(key);
  if (!entry || entry.timer || entry.subs === 0) return;
  if (Date.now() - entry.lastRun >= intervalMs) runShared(key);
  entry.timer = setInterval(() => runShared(key), intervalMs);
}

function ensureShared(key, intervalMs) {
  let entry = shared.get(key);
  if (!entry) {
    entry = {
      subs: 0,
      timer: null,
      lastRun: 0,
      fn: () => {},
      onVisibilityChange: () => {
        if (document.hidden) stopShared(entry);
        else startShared(key, intervalMs);
      },
    };
    shared.set(key, entry);
  }
  return entry;
}

/**
 * Calls `fn` on mount and then every `intervalMs`, but only while the tab is visible.
 * Polling stops when the tab is hidden. On return it resumes, and refreshes
 * immediately if the last call is older than `intervalMs`.
 */
export function usePolling(fn, intervalMs) {
  const fnRef = useRef(fn);
  // A ref, not a local of the effect: StrictMode runs the effect twice on mount,
  // and a local would reset between the two and fire `fn` twice.
  const lastRunRef = useRef(0);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    let timer = null;

    const run = () => {
      lastRunRef.current = Date.now();
      fnRef.current();
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (timer !== null) return;
      if (Date.now() - lastRunRef.current >= intervalMs) run();
      timer = setInterval(run, intervalMs);
    };
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs]);
}

/**
 * Like `usePolling`, but a single timer per `key` shared by every mounted
 * subscriber. Two components polling the same resource with the same interval
 * no longer fire it twice (e.g. the Topbar and the notification bell both
 * reading active incidents/approvals).
 */
export function useSharedPolling(key, fn, intervalMs) {
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!key) return undefined;
    const entry = ensureShared(key, intervalMs);
    entry.subs += 1;
    entry.fn = () => fnRef.current();

    if (entry.subs === 1) {
      document.addEventListener('visibilitychange', entry.onVisibilityChange);
      if (!document.hidden) startShared(key, intervalMs);
    }

    return () => {
      entry.subs -= 1;
      if (entry.subs === 0) {
        stopShared(entry);
        document.removeEventListener('visibilitychange', entry.onVisibilityChange);
        // Keep the entry (and its lastRun) so a StrictMode remount or a quick
        // remount does not trigger an extra immediate fetch.
      }
    };
  }, [key, intervalMs]);
}
