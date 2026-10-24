import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, ChevronDown, Search, X } from "lucide-react";

function ColumnSelect({ options, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);

  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const searchText = query.trim().toLowerCase();
    if (!searchText) return options;
    return options.filter((option) => String(option.label ?? '').toLowerCase().includes(searchText));
  }, [options, query]);

  useEffect(() => {
    function handleOutside(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleSelect(nextValue) {
    onChange(nextValue);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div className="sort-select" ref={rootRef}>
      <button
        type="button"
        className={`sort-select-trigger${isOpen ? " open" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedOption?.label ?? "None"}</span>
        <ChevronDown size={16} />
      </button>
      {isOpen && (
        <div className="sort-select-menu">
          <label className="sort-search">
            <Search size={15} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              autoFocus
            />
          </label>
          <div className="sort-option-list" role="listbox">
            {filteredOptions.map((option) => (
              <button
                key={option.value || "none"}
                type="button"
                className={`sort-option${option.value === value ? " selected" : ""}`}
                onClick={() => handleSelect(option.value)}
                role="option"
                aria-selected={option.value === value}
              >
                {option.label}
              </button>
            ))}
            {filteredOptions.length === 0 && <div className="sort-option-empty">No columns found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SortPopover({
  isOpen,
  sortDraft,
  sortApplied,
  options,
  onToggle,
  onDraftChange,
  onApply,
  onCancel,
  onClear,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleOutside(event) {
      if (!panelRef.current?.contains(event.target)) {
        onCancel();
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onCancel]);

  const activeLabel = options.find((option) => option.value === sortApplied.field)?.label;

  return (
    <div className="sort-popover-wrap" ref={panelRef}>
      <button
        type="button"
        className={`toolbar-pill${sortApplied.field ? " active" : ""}`}
        onClick={onToggle}
      >
        <ArrowUpDown size={17} className="sort-pill-icon" aria-hidden="true" />
        {activeLabel ? `Sort: ${activeLabel}` : "Sort"}
      </button>
      {sortApplied.field && (
        <button type="button" className="sort-clear-btn" onClick={onClear} aria-label="Clear sort">
          <X size={14} />
        </button>
      )}
      {isOpen && (
        <div className="sort-popover-card" role="dialog" aria-label="Sort leads">
          <div className="sort-popover-arrow" />
          <h3>Sort By</h3>
          <div className="sort-popover-grid">
            <ColumnSelect
              options={options}
              value={sortDraft.field}
              onChange={(field) => onDraftChange("field", field)}
            />
            <label className="sort-direction-field">
              <span className="sr-only">Sort direction</span>
              <select
                value={sortDraft.direction}
                onChange={(event) => onDraftChange("direction", event.target.value)}
              >
                <option value="ascending">Ascending</option>
                <option value="descending">Descending</option>
              </select>
            </label>
          </div>
          <div className="sort-popover-actions">
            <button type="button" className="btn-outline" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={onApply}
              disabled={!sortDraft.field}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
