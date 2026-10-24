import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

import useUnits from '../../hooks/useUnits';
import { resolveUnit, sameUnitText, unitsCompatibleWith } from '../../utils/uom';

/**
 * Searchable unit picker fed by the UOM master.
 *
 * - `stockUom` limits the list to units that convert to the item's stock
 *   unit (CM / Meter for a fabric in Mtr; never Kg).
 * - The current `value` is always shown, even if it is now inactive, so an
 *   old document still displays the unit it was saved with.
 */
export default function UomSelect({
  value,
  onChange,
  stockUom,
  disabled = false,
  placeholder = 'Unit',
  className = '',
  size = 'sm',
}) {
  const { units, activeUnits } = useUnits();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);

  const options = useMemo(() => {
    const list = stockUom ? unitsCompatibleWith(units, stockUom) : activeUnits;
    // The item's own spelling ("Mtr") stays selectable even when the master
    // row is spelled differently ("Meter").
    const extra = [];
    for (const text of [stockUom, value]) {
      if (text && !list.some((u) => sameUnitText(u.code, text)) && !extra.some((u) => sameUnitText(u.code, text))) {
        const unit = resolveUnit(units, text);
        extra.push({ id: `text:${text}`, code: text, label: unit?.label || unit?.name || text, uomType: unit?.uomType || '' });
      }
    }
    return [...extra, ...list];
  }, [units, activeUnits, stockUom, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((u) => [u.code, u.label, u.name, u.uomType].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (unit) => {
    // Keep the item's own spelling when the pick is the same unit.
    const next = stockUom && sameUnitText(unit.code, stockUom) ? stockUom : unit.code;
    onChange?.(next);
    setOpen(false);
    setQuery('');
  };

  const pad = size === 'xs' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-1 ${pad} bg-white border border-slate-200 rounded-md text-slate-800 hover:border-slate-300 focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value ? '' : 'text-slate-400'}>{value || placeholder}</span>
        {!disabled && <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-52 right-0 bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="relative p-1.5 border-b border-slate-100">
            <Search className="w-3 h-3 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered[0]) { e.preventDefault(); pick(filtered[0]); }
                if (e.key === 'Escape') setOpen(false);
              }}
              placeholder="Search unit..."
              className="w-full pl-6 pr-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
            {filtered.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => pick(u)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 hover:bg-blue-50 ${sameUnitText(u.code, value) ? 'bg-blue-50/60 font-semibold' : ''}`}
                >
                  <span className="text-slate-800">{u.code}<span className="text-slate-400 font-normal"> · {u.label || u.name}</span></span>
                  {u.uomType && <span className="text-[10px] text-slate-400">{u.uomType}</span>}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-2 text-[11px] text-slate-400">No matching unit</li>}
          </ul>
          {stockUom && (
            <p className="px-3 py-1.5 border-t border-slate-100 text-[10px] text-slate-400">Units that convert to {stockUom}</p>
          )}
        </div>
      )}
    </div>
  );
}
