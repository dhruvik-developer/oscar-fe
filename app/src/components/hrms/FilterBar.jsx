import { Search, X } from "lucide-react";

export function FilterBar({ search, onSearch, selects = [], onClear, placeholder = "Search...", children }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3.5 flex flex-wrap items-center gap-2.5 shadow-2xs">
      {/* Search Input */}
      {onSearch !== undefined && (
        <div className="relative flex-1 min-w-[200px] max-w-full sm:max-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search || ""}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            className="w-full h-9 pl-9 pr-8 bg-soft border border-border rounded-xl text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-primary focus:bg-card transition"
          />
          {search && (
            <button
              onClick={() => onSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-soft grid place-items-center text-muted"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Select Dropdowns */}
      {selects.map((s) => (
        <select
          key={s.label || s.value}
          value={s.value}
          onChange={(e) => s.onChange(e.target.value)}
          className="h-9 pl-3.5 pr-8 bg-soft border border-border rounded-xl text-[13px] text-text font-medium cursor-pointer focus:outline-none focus:border-primary focus:bg-card transition"
        >
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {/* Clear Filters Button */}
      {onClear && (
        <button
          onClick={onClear}
          className="h-9 px-4 bg-card border border-border rounded-xl text-[13px] font-medium text-text-secondary hover:bg-soft transition shadow-2xs"
        >
          Clear Filters
        </button>
      )}

      {children}
    </div>
  );
}

