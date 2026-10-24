import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useCrmStore } from '../../stores/crmStore';
import { MASTER_SOURCES } from './masterSources';

export { MASTER_SOURCES };

/** Fired on `window` when a master popup closes, so forms holding their own option lists can reload them. */
export const MASTER_DATA_CHANGED = 'master-data-changed';

/**
 * Reload a form's own option list after the user edits a master in the popup.
 *   useMasterDataRefresh(loadVehicles, ['vehicles', 'drivers']);
 * Without `sources`, every master popup triggers it.
 */
export function useMasterDataRefresh(callback, sources) {
  const key = sources ? sources.join(',') : '';
  useEffect(() => {
    const wanted = key ? key.split(',') : null;
    const handler = (e) => {
      if (!wanted || wanted.includes(e.detail?.source)) callback();
    };
    window.addEventListener(MASTER_DATA_CHANGED, handler);
    return () => window.removeEventListener(MASTER_DATA_CHANGED, handler);
  }, [callback, key]);
}

/**
 * "+ Add / Manage" beside a dropdown's label. Opens the master page in a
 * popup on top of the current form (the app runs inside an iframe without its
 * sidebar, see MainLayout), so the user never leaves the form. Closing the
 * popup re-reads the shared data stores and fires MASTER_DATA_CHANGED.
 *
 *   <div className="flex items-center justify-between mb-1">
 *     <label>Vehicle</label>
 *     <MasterSourceLink source="vehicles" />
 *   </div>
 */
export default function MasterSourceLink({ source, label = '+ Add / Manage', className = '' }) {
  const entry = MASTER_SOURCES[source];
  const { refreshFromBackend } = useERP() || {};
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    refreshFromBackend?.();
    const crm = useCrmStore.getState();
    if (crm.status?.loaded) crm.hydrate({ force: true });
    window.dispatchEvent(new CustomEvent(MASTER_DATA_CHANGED, { detail: { source } }));
  }, [refreshFromBackend, source]);

  // Escape closes only the popup, not the form underneath it.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  if (!entry) return null;

  return (
    <>
      <a
        href={entry.to}
        onClick={(e) => {
          // Ctrl/Cmd/middle-click still open a normal new tab.
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title={`Data comes from: ${entry.menu}. Click to add or edit it here without leaving this form.`}
        className={`text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold whitespace-nowrap no-print ${className}`}
      >
        {label}
      </a>
      {open && createPortal(
        <div
          className="fixed inset-0 z-[1000] bg-slate-900/60 flex items-center justify-center p-2 sm:p-6 no-print"
          // React bubbles portal events to the form's own handlers (e.g. a
          // backdrop that closes the form); keep them inside the popup.
          onMouseDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) close(); }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 bg-slate-50">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">{entry.menu.split(' → ').pop()}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  Data comes from: {entry.menu}. Close this window to return to your form; the list refreshes automatically.
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a href={entry.to} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200" title="Open in a new tab">
                  <ExternalLink size={16} />
                </a>
                <button type="button" onClick={close}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1">
                  <X size={14} /> Close &amp; return to form
                </button>
              </div>
            </div>
            <iframe title={entry.menu} src={entry.to} className="flex-1 w-full border-0 bg-slate-50" />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
