import { useEffect, useState } from "react";
import { Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { useMemo } from 'react';
import { useCrmStore, statusFacetsFrom, sourceFacetsFrom } from '../../../stores/crmStore';

const SYSTEM_DEFINED_FILTERS = [
  "Activities",
  "Campaigns",
  "Latest Email Status",
  "Locked",
  "Record Action",
  "Related Records",
  "Touched Records",
  "Untouched Records",
];

function toggleValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function CheckboxSection({ title, items, selected, onToggle, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="checkbox-section">
      <button type="button" className="checkbox-section-head" onClick={() => setOpen((value) => !value)}>
        <span className="checkbox-title-wrap">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <strong>{title}</strong>
        </span>
      </button>

      {open && (
        <div className="checkbox-list">
          {items.map((item) => {
            const value = typeof item === "string" ? item : item.label;
            const count = typeof item === "string" ? null : item.count;

            return (
              <label key={value} className="filter-check-row">
                <input
                  type="checkbox"
                  checked={selected.includes(value)}
                  onChange={() => onToggle(toggleValue(selected, value))}
                />
                <span>{value}</span>
                {count !== null && <small>({count})</small>}
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function FilterPanel({
  statusFilters: selectedStatuses,
  sourceFilters: selectedSources,
  systemDefinedFilters,
  searchFilter,
  onStatusChange,
  onSourceChange,
  onSystemDefinedChange,
  onSearchChange,
  onApply,
  onClear,
  onClose,
}) {
  // Facets reflect what is actually in the pipeline, not a fixed list.
  const leads = useCrmStore((s) => s.leads);
  const sources = useCrmStore((s) => s.sources);
  const statusFacets = useMemo(() => statusFacetsFrom(leads), [leads]);
  const sourceFacets = useMemo(() => sourceFacetsFrom(leads, sources), [leads, sources]);
  function handleClose() {
    if (typeof onClose === "function") {
      onClose();
    }
  }

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape" && typeof onClose === "function") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <aside className="filter-card screenshot-filter-card">
      <div className="filter-header">
        <h3>Filter Leads by</h3>
        <button type="button" className="filter-close" aria-label="Close filters" onClick={handleClose}>
          <X size={18} />
        </button>
      </div>

      <label className="filter-search screenshot-filter-search">
        <Search size={16} className="filter-search-ico" />
        <input
          type="text"
          placeholder="Search"
          value={searchFilter}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <CheckboxSection
        title="System Defined Filters"
        items={SYSTEM_DEFINED_FILTERS}
        selected={systemDefinedFilters}
        onToggle={onSystemDefinedChange}
      />

      <CheckboxSection
        title="Lead Status"
        items={statusFacets}
        selected={selectedStatuses}
        onToggle={onStatusChange}
      />

      <CheckboxSection
        title="Lead Source"
        items={sourceFacets}
        selected={selectedSources}
        onToggle={onSourceChange}
        defaultOpen={false}
      />

      <div className="filter-actions">
        <button type="button" className="btn-primary" onClick={onApply}>Apply</button>
        <button type="button" className="btn-outline" onClick={onClear}>Clear</button>
      </div>
    </aside>
  );
}
