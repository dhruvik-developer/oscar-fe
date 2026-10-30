import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

/** Splits ``text`` so the part matching ``query`` can be bolded. */
function Highlight({ text, query }) {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent text-blue-700 font-bold">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/**
 * A text box with a styled suggestion list (in place of the browser's
 * <datalist>). Typing filters the options by label and meta; ↑ ↓ move,
 * Enter picks, Esc closes. Free text is allowed -- ``onChange`` gets every
 * keystroke and ``onSelect`` the option picked.
 *
 *   <SearchableCombobox value={name} onChange={setName} onSelect={(o) => ...}
 *     options={[{ id, label, meta }]} placeholder="Search…" />
 */
export default function SearchableCombobox({
  value = '', onChange, onSelect, options = [], placeholder, autoFocus, required, ariaLabel,
  emptyText = 'No match — what you typed will be used.', maxResults = 50, selectedId,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q
      ? options.filter((o) => `${o.label} ${o.meta || ''}`.toLowerCase().includes(q))
      : options;
    // Names that start with the text come first.
    return [...list]
      .sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)))
      .slice(0, maxResults);
  }, [options, value, maxResults]);

  useEffect(() => { setActive(0); }, [value]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (option) => {
    onSelect?.(option);
    setOpen(false);
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true); else setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && matches[active]) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          required={required}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => { onChange?.(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          style={{ paddingLeft: 36, paddingRight: 36 }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? 'Close list' : 'Open list'}
          onClick={() => setOpen((o) => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1.5 w-full max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10"
        >
          {matches.length === 0 && (
            <li className="px-3 py-2.5 text-xs text-slate-500">{value.trim() ? emptyText : 'Nothing to choose from yet.'}</li>
          )}
          {matches.map((o, i) => {
            const isActive = i === active;
            const isSelected = selectedId != null && String(o.id) === String(selectedId);
            return (
              <li
                key={o.id ?? o.label}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                onMouseEnter={() => setActive(i)}
                className={`flex items-start gap-2 rounded-lg px-3 py-2 cursor-pointer ${isActive ? 'bg-blue-50' : ''}`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold text-slate-800 truncate"><Highlight text={o.label} query={value} /></span>
                  {o.meta && <span className="block text-[11px] text-slate-500 truncate"><Highlight text={o.meta} query={value} /></span>}
                </span>
                {isSelected && <Check size={15} className="mt-0.5 text-blue-600 shrink-0" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
