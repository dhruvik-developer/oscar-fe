import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Factory, ChevronDown, Check, Building2, Search, X } from 'lucide-react';

/**
 * CompanySelector — User-friendly Company / Manufacturing Unit Selector.
 * Replaces the raw native OS <select> dropdown with a polished Oscar ERP UI popover.
 */
export default function CompanySelector({
  factories = [],
  selectedFactoryId,
  onSelect,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedFactory = factories.find((f) => f.id === selectedFactoryId) || factories[0];

  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    if (open) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('keydown', handleKeyDown);
      // focus search input if factories > 3
      if (factories.length > 3) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      return () => {
        document.removeEventListener('mousedown', handleOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      setSearchQuery('');
    }
  }, [open, factories.length]);

  const filteredFactories = useMemo(() => {
    if (!searchQuery.trim()) return factories;
    const q = searchQuery.toLowerCase().trim();
    return factories.filter(
      (f) =>
        f.name?.toLowerCase().includes(q) ||
        f.code?.toLowerCase().includes(q) ||
        String(f.machines_count || '').includes(q)
    );
  }, [factories, searchQuery]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Modern Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`h-[38px] flex items-center gap-2 rounded-xl px-3 border transition-all cursor-pointer shadow-2xs select-none ${
          open
            ? 'bg-blue-50/50 dark:bg-slate-800 border-blue-500 ring-2 ring-blue-500/20'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Factory size={13} />
        </div>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
          Company:
        </span>
        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[140px] sm:max-w-[180px] truncate text-left">
          {selectedFactory?.name || 'Select Company'}
        </span>
        {selectedFactory?.machines_count !== undefined && selectedFactory.machines_count > 0 && (
          <span className="hidden md:inline-flex items-center text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {selectedFactory.machines_count}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ml-0.5 shrink-0 ${
            open ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
          }`}
        />
      </button>

      {/* Floating Popover Menu */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Building2 size={13} className="text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Manufacturing Units
              </span>
            </div>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full">
              {factories.length} Available
            </span>
          </div>

          {/* Optional Search if more than 3 factories */}
          {factories.length > 3 && (
            <div className="mt-2 relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search unit by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Factory List */}
          <div className="mt-2 max-h-64 overflow-y-auto space-y-1 scrollbar-thin">
            {filteredFactories.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No manufacturing unit matches &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredFactories.map((f, idx) => {
                const isSelected = f.id === selectedFactoryId;
                // Check if name is duplicated in the list to help user differentiate
                const isDupeName = factories.filter((item) => item.name === f.name).length > 1;

                return (
                  <button
                    key={f.id || idx}
                    type="button"
                    onClick={() => {
                      onSelect(f.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold border border-blue-200/50 dark:border-blue-900/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Factory size={13} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="block text-xs truncate font-semibold">
                            {f.name}
                          </span>
                          {isDupeName && (
                            <span className="text-[9px] font-mono text-slate-400 px-1 rounded bg-slate-100 dark:bg-slate-800">
                              #{f.id.slice(0, 4)}
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] text-slate-400">
                          {f.machines_count !== undefined && f.machines_count > 0
                            ? `${f.machines_count} looms allocated`
                            : 'No looms allocated'}
                        </span>
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    ) : f.machines_count > 0 ? (
                      <span className="text-[10px] font-semibold text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        {f.machines_count} looms
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
