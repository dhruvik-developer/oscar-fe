import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, X } from "lucide-react";

/**
 * SearchableSelect — A clean, modern select dropdown with searchable input
 * and styled popup list. Replaces native browser <datalist> to prevent dark/black
 * popups and ensure consistent light theme UI across all OS and browsers.
 */
export function SearchableSelect({
  value = "",
  onChange,
  options = [],
  placeholder = "Select or enter option",
  error,
  className = "",
  disabled = false,
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Normalize options into { value, label }
  const normalizedOptions = useMemo(() => {
    return options
      .map((opt) => {
        if (typeof opt === "string") return { value: opt, label: opt };
        if (opt && typeof opt === "object") {
          return {
            value: String(opt.value ?? opt.label ?? opt.name ?? ""),
            label: String(opt.label ?? opt.value ?? opt.name ?? ""),
          };
        }
        return null;
      })
      .filter((opt) => opt && opt.value.trim().length > 0);
  }, [options]);

  // Keep query in sync when value changes or when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery(value || "");
    }
  }, [value, isOpen]);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        if (query !== value) {
          onChange?.(query);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [query, value, onChange]);

  // Filtered options based on user input
  const filteredOptions = useMemo(() => {
    if (!query || query.trim() === "") return normalizedOptions;
    const q = query.toLowerCase().trim();
    return normalizedOptions.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [normalizedOptions, query]);

  function handleSelect(val) {
    onChange?.(val);
    setQuery(val);
    setIsOpen(false);
  }

  function handleInputChange(e) {
    const val = e.target.value;
    setQuery(val);
    onChange?.(val);
    if (!isOpen) setIsOpen(true);
  }

  function handleInputFocus() {
    if (!disabled) {
      setIsOpen(true);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "Enter") {
      if (isOpen && filteredOptions.length > 0) {
        e.preventDefault();
        handleSelect(filteredOptions[0].value);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === "ArrowDown" && !isOpen) {
      setIsOpen(true);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={isOpen ? query : (value || "")}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onClick={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={`w-full h-9 pl-3 pr-8 bg-white border rounded-xl text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-2xs ${
            error ? "border-red-500" : "border-[#e2e8f0]"
          } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50" : "cursor-text"} ${className}`}
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect("");
                inputRef.current?.focus();
              }}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition"
              aria-label="Clear value"
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) {
                setIsOpen((prev) => !prev);
                if (!isOpen) inputRef.current?.focus();
              }
            }}
            className="text-slate-400 hover:text-slate-600 p-0.5"
            aria-label="Toggle options"
          >
            <ChevronDown
              size={15}
              className={`transition-transform duration-150 ${isOpen ? "rotate-180 text-blue-500" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Styled Clean Light Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto py-1 text-[13px]">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = String(value).toLowerCase() === opt.value.toLowerCase();
              return (
                <div
                  key={opt.value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt.value);
                  }}
                  className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={14} className="text-blue-600 flex-shrink-0 ml-2" />}
                </div>
              );
            })
          ) : (
            <div className="px-3 py-2.5 text-center text-xs text-slate-400">
              {query.trim() ? (
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(query.trim());
                  }}
                  className="text-blue-600 hover:underline cursor-pointer"
                >
                  Use &ldquo;<span className="font-semibold">{query.trim()}</span>&rdquo;
                </div>
              ) : (
                "No options available"
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
