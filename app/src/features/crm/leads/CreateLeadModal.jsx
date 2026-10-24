import { useEffect, useMemo, useRef, useState } from "react";
import { useERP } from "../../../context/ERPContext";
import { useCrmStore } from '../../../stores/crmStore';
import { loadForms, findForm, getLiveLeadFormId, LEAD_FORM } from '../../../services/crmForms';
import { defaultLeadFormSections, TEXTILE_FABRIC_OPTIONS, LEGACY_FABRIC_OPTIONS } from '../../../data/crm/leadFormSchema';
import { matchKnownLeadField } from './leadColumns';
import { CalendarDays, ChevronDown, Clock3, ImagePlus, Plus, X, Building2, ShieldCheck, Percent } from "lucide-react";
import { salesService } from "../../../services/domainServices";
import MasterSourceLink from "../../../components/common/MasterSourceLink";

/** Shipped Lead Source options — only these are offered for new selection. */
export const DEFAULT_LEAD_SOURCES = [
  "Broker",
  "Sales Person",
];

/**
 * Options for the Lead Source dropdown: the backend sources are the source
 * of truth; the shipped pair only fills gaps when the workspace has no
 * sources configured yet, and the lead's current value is preserved so
 * existing rows never render blank or lose data on save.
 */
export function leadSourceOptions(sources, current) {
  // Sources deactivated under CRM Setup -> Lead Sources are not offered for
  // new selection (a lead already carrying one keeps it, see below).
  const rows = (sources || []).filter((s) => s?.isActive !== false);
  for (const name of DEFAULT_LEAD_SOURCES) {
    if (!(sources || []).some((s) => String(s?.name ?? '').toLowerCase() === name.toLowerCase())) {
      rows.push({ id: name, name });
    }
  }
  const cur = String(current ?? '');
  if (cur && !rows.some((s) => String(s.id) === cur || String(s?.name ?? '').toLowerCase() === cur.toLowerCase())) {
    const known = (sources || []).find((s) => String(s.id) === cur);
    rows.push({ id: cur, name: known?.name ?? cur });
  }
  return rows.map((s) => ({ id: s.id, name: s.name }));
}

/** Saved forms still carrying the old medical-device placeholders (or no
 * options at all) on the Products/Fabric field are healed to the textile
 * set on read, so the builder never has to be re-saved by hand. */
function withFabricDefaults(sections) {
  return (sections || []).map((section) => ({
    ...section,
    fields: (section.fields || []).map((field) => {
      if (matchKnownLeadField(field)?.kind !== 'products') return field;
      const opts = Array.isArray(field.options) ? field.options : [];
      const isLegacy = opts.length > 0
        && opts.length === LEGACY_FABRIC_OPTIONS.length
        && LEGACY_FABRIC_OPTIONS.every((o) => opts.includes(o));
      if (opts.length > 0 && !isLegacy) return field;
      return { ...field, options: [] };
    }),
  }));
}

/** Resolve the active form sections from the store, falling back to defaults. */
function useFormSections() {
  // Subscribe so the modal re-renders when the builder saves a new layout.
  useCrmStore((s) => s.forms);
  return getActiveLeadFormSections();
}

/**
 * Non-hook version for pages (e.g. the leads table) that need the same
 * field list to build dynamic columns.
 */
export function getActiveLeadFormSections() {
  const forms = loadForms(LEAD_FORM);
  // Respect the toggle in Manage Lead Create Forms: the form switched on there
  // (server-side, for every user) is the form Create Lead renders. `forms[0]`
  // only keeps the leads table columns sensible while every form is off —
  // Create Lead itself does not open then.
  const activeId = getLiveLeadFormId();
  const active = (activeId ? findForm(activeId) : null) ?? forms[0] ?? null;
  return withFabricDefaults(active?.sections ?? defaultLeadFormSections);
}

function useUserOptions() {
  // The assignee roster comes from `/crm/team-roster/` — the backend is the
  // source of truth, so no sample directory is substituted here. Selecting a
  // sample id would be dropped by the API mapper (ids must be server UUIDs).
  return useCrmStore((s) => s.teamMembers);
}

function useSources() {
  return useCrmStore((s) => s.sources);
}

// ---------------------------------------------------------------------------
// Individual field renderers
// ---------------------------------------------------------------------------

function TextField({ field, value, onChange }) {
  const type =
    field.type === "Email" ? "email"
    : field.type === "Phone" ? "tel"
    : field.type === "Number" || field.type === "Currency" ? "number"
    : "text";
  return (
    <input
      type={type}
      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TextAreaField({ field, value, onChange }) {
  return (
    <textarea
      rows={3}
      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ resize: "vertical" }}
    />
  );
}

function DateField({ field, value, onChange }) {
  const ref = useRef(null);
  return (
    <div className="input-icon-wrap">
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span
        role="button"
        tabIndex={0}
        aria-label="Open calendar"
        style={{ position: "absolute", top: 0, right: 0, width: 34, height: "100%", display: "grid", placeItems: "center", cursor: "pointer" }}
        onClick={() => { try { ref.current?.showPicker?.(); } catch { ref.current?.focus(); } }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); try { ref.current?.showPicker?.(); } catch { ref.current?.focus(); } } }}
      >
        <CalendarDays size={16} />
      </span>
    </div>
  );
}

function TimeField({ field, value, onChange }) {
  const ref = useRef(null);
  return (
    <div className="input-icon-wrap">
      <input
        ref={ref}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span
        role="button"
        tabIndex={0}
        aria-label="Open time picker"
        style={{ position: "absolute", top: 0, right: 0, width: 34, height: "100%", display: "grid", placeItems: "center", cursor: "pointer" }}
        onClick={() => { try { ref.current?.showPicker?.(); } catch { ref.current?.focus(); } }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); try { ref.current?.showPicker?.(); } catch { ref.current?.focus(); } } }}
      >
        <Clock3 size={16} />
      </span>
    </div>
  );
}

function DropdownField({ field, sources, userOptions, value, onChange }) {
  // Special handling for known semantic fields
  const isSource = field.id === "lead-source" || field.label?.toLowerCase().includes("source");
  const isOwner = field.id === "lead-owner" || field.label?.toLowerCase().includes("owner");
  const isLeadName = field.id === "lead-name";

  if (isLeadName) {
    return (
      <input
        type="text"
        placeholder="Enter lead name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (isSource) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select source</option>
        {leadSourceOptions(sources, value).map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.name}</option>
        ))}
      </select>
    );
  }

  if (isOwner) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select User</option>
        {userOptions.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    );
  }

  const options = Array.isArray(field.options) && field.options.length > 0
    ? field.options
    : ["Option 1", "Option 2", "Option 3"];

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{field.placeholder || "Select option"}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function UserField({ field, userOptions, value, onChange }) {
  const isLeadUsers = field.id === "lead-users" || field.label?.toLowerCase().includes("lead users");

  // Deduplicate users so duplicate roles do not cause duplicate dropdown entries
  const uniqueUsers = useMemo(() => {
    const seen = new Set();
    return (userOptions || []).filter((m) => {
      if (!m) return false;
      const key = String(m.id || m.name || '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [userOptions]);

  if (isLeadUsers) {
    // Multi-value user selector
    const selected = Array.isArray(value) ? value : [];
    const toggle = (name) =>
      onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {selected.map((name) => (
          <span
            key={name}
            className="token-chip"
            onClick={() => toggle(name)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle(name); }}
          >
            {name}<X size={12} />
          </span>
        ))}
        <select
          value=""
          onChange={(e) => { if (e.target.value) toggle(e.target.value); }}
          style={{ flex: 1, minWidth: 120 }}
        >
          <option value="">{field.placeholder || "Select Users"}</option>
          {uniqueUsers.filter((m) => !selected.includes(m.name)).map((m) => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{field.placeholder || "Select User"}</option>
      {uniqueUsers.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  );
}

function MultiSelectField({ field, value, onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const isFabric = matchKnownLeadField(field)?.kind === 'products';
  const { items = [], fabrics = [] } = useERP() || {};

  // Real product/fabric data from ERP masters + any custom choices configured on field
  const availableOptions = useMemo(() => {
    const seen = new Set();
    const result = [];
    const add = (val) => {
      const trimmed = String(val || '').trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(trimmed);
      }
    };

    if (Array.isArray(field.options)) {
      field.options.forEach(add);
    }

    if (isFabric) {
      (fabrics || []).forEach((f) => add(f.name));
      (items || []).forEach((i) => add(i.name));
    }

    selected.forEach(add);
    return result;
  }, [field.options, isFabric, fabrics, items, selected]);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (opt) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((o) => o !== opt));
    } else {
      onChange([...selected, opt]);
    }
    setSearch("");
  };

  const removeOption = (e, opt) => {
    e.stopPropagation();
    onChange(selected.filter((o) => o !== opt));
  };

  const handleAddNew = () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    if (!selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setSearch("");
  };

  const filteredOptions = availableOptions.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const canAddNew = search.trim() && !availableOptions.some((o) => o.toLowerCase() === search.trim().toLowerCase());

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className={`min-h-[40px] w-full px-3 py-1.5 border rounded-lg bg-white flex flex-wrap items-center gap-1.5 cursor-pointer transition ${
          isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-300 hover:border-slate-400'
        }`}
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
      >
        {selected.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
          >
            {item}
            <button
              type="button"
              onClick={(e) => removeOption(e, item)}
              className="hover:text-blue-900 rounded-full focus:outline-none"
            >
              <X size={12} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-[120px] text-xs bg-transparent border-none outline-none focus:ring-0 text-slate-800 placeholder-slate-400 p-0"
          placeholder={selected.length === 0 ? (field.placeholder || "Search or type products...") : "Add more..."}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (canAddNew && filteredOptions.length === 0) {
                handleAddNew();
              } else if (filteredOptions.length > 0 && search.trim()) {
                toggleOption(filteredOptions[0]);
              } else if (canAddNew) {
                handleAddNew();
              }
            } else if (e.key === 'Backspace' && !search && selected.length > 0) {
              onChange(selected.slice(0, -1));
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
        />

        <div className="ml-auto flex items-center pl-1 text-slate-400">
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          {canAddNew && (
            <div
              className="px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer flex items-center gap-1.5 border-b border-slate-100"
              onClick={handleAddNew}
            >
              <Plus size={14} /> Add &ldquo;{search.trim()}&rdquo; as new product
            </div>
          )}

          {filteredOptions.length === 0 && !canAddNew ? (
            <div className="px-3 py-3 text-xs text-slate-400 text-center">
              No products found
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <div
                  key={opt}
                  className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition ${
                    isSelected ? 'bg-blue-50 text-blue-800 font-medium' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => toggleOption(opt)}
                >
                  <span>{opt}</span>
                  {isSelected && <span className="text-blue-600 text-xs font-bold">&#10003;</span>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function CheckboxField({ field, value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16 }}
      />
      {field.placeholder || field.label}
    </label>
  );
}

function RadioField({ field, value, onChange }) {
  const options = Array.isArray(field.options) && field.options.length > 0
    ? field.options
    : ["Option 1", "Option 2", "Option 3"];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {options.map((opt) => (
        <label key={opt} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
          <input
            type="radio"
            name={field.id}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

function LeadImageField({ value, onChange }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="sr-only" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Downscale to a small avatar-sized data URL so it can travel with
        // the lead (custom_values) without bloating the payload.
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          try {
            const max = 256;
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            onChange(canvas.toDataURL('image/jpeg', 0.8));
          } catch {
            onChange(url);
          } finally {
            URL.revokeObjectURL(url);
          }
        };
        img.onerror = () => onChange(url);
        img.src = url;
      }} />
      <button type="button" className="lead-photo-upload" onClick={() => ref.current?.click()}>
        {value ? (
          <img src={value} alt="Lead preview" className="lead-photo-preview" />
        ) : (
          <>
            <span className="lead-photo-placeholder"><ImagePlus size={24} /></span>
            <strong>Upload Image</strong>
            <small>JPG, PNG or WebP</small>
          </>
        )}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Renders one field based on its type
// ---------------------------------------------------------------------------
export function DynamicField({ field, values, onChange, sources, userOptions }) {
  const value = values[field.id] ?? "";
  const set = (v) => onChange(field.id, v);

  const isWide =
    field.type === "Multi Line" ||
    field.type === "Lead Image" ||
    field.type === "Multi Select" ||
    field.id === "lead-users";

  const inner = (() => {
    switch (field.type) {
      case "Single Line":
      case "Number":
      case "Currency":
        return <TextField field={field} value={value} onChange={set} />;
      case "Email":
        return <TextField field={field} value={value} onChange={set} />;
      case "Phone":
        return <TextField field={field} value={value} onChange={set} />;
      case "Multi Line":
        return <TextAreaField field={field} value={value} onChange={set} />;
      case "Date":
        // task-time is stored as a separate time field in schema but keyed "task-time"
        if (field.id === "task-time") return <TimeField field={field} value={value} onChange={set} />;
        return <DateField field={field} value={value} onChange={set} />;
      case "Dropdown":
        return <DropdownField field={field} sources={sources} userOptions={userOptions} value={value} onChange={set} />;
      case "User":
        return <UserField field={field} userOptions={userOptions} value={value} onChange={set} />;
      case "Multi Select":
        return <MultiSelectField field={field} value={value} onChange={set} />;
      case "Checkbox":
        return <CheckboxField field={field} value={value} onChange={set} />;
      case "Radio":
        return <RadioField field={field} value={value} onChange={set} />;
      case "Lead Image":
        return <LeadImageField value={value} onChange={set} />;
      default:
        return <TextField field={field} value={value} onChange={set} />;
    }
  })();

  // Time field — handle as Single Line with clock icon
  if (field.id === "task-time" && field.type === "Single Line") {
    return (
      <label className={`lead-create-field${isWide ? " lead-create-field-wide" : ""}`}>
        <span>{field.label}{field.required && " *"}</span>
        <TimeField field={field} value={value} onChange={set} />
        {field.helpText && <small className="lead-create-help">{field.helpText}</small>}
      </label>
    );
  }

  // Master-backed fields get a "+ Add / Manage" link to where their options live.
  const lowerLabel = String(field.label || "").toLowerCase();
  const isSourceField = field.id === "lead-source" || lowerLabel.includes("source");
  const isOwnerField = field.id === "lead-owner" || lowerLabel.includes("owner");
  const masterSource =
    field.type === "User" || (field.type === "Dropdown" && !isSourceField && isOwnerField)
      ? "users"
      : field.type === "Dropdown" && isSourceField
        ? "leadSources"
        : field.type === "Multi Select" && matchKnownLeadField(field)?.kind === "products"
          ? "items"
          : null;

  return (
    <label className={`lead-create-field${isWide ? " lead-create-field-wide" : ""}`}>
      {masterSource ? (
        <span className="flex items-center justify-between gap-2">
          <span>{field.label}{field.required && " *"}</span>
          <MasterSourceLink source={masterSource} />
        </span>
      ) : (
        <span>{field.label}{field.required && " *"}</span>
      )}
      {inner}
      {field.helpText && <small className="lead-create-help">{field.helpText}</small>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Maps a flat `{ fieldId: value }` capture (modal or CSV import) to the shape
// LeadsPage.saveLead expects. Ids come first; label matching covers renamed
// builder fields (e.g. a "Compnay" typo still maps).
// ---------------------------------------------------------------------------
export function leadFormValuesToPayload(values, sections, { sources = [], userOptions = [] } = {}) {
  const allFields = (sections || []).flatMap((s) => s.fields || []);
  const labelOf = (f) => String(f?.label || '').toLowerCase();
  const byLabel = (re) => allFields.find((f) => re.test(labelOf(f)));
  const fieldBy = (id, re) =>
    allFields.find((f) => f.id === id) || (re ? byLabel(re) : undefined);
  const get = (id) => values[id] ?? "";
  const getValue = (id, re) => {
    const f = fieldBy(id, re);
    return f ? get(f.id) : "";
  };
  const sourceField = fieldBy("lead-source", /source/);
  const ownerField  = fieldBy("lead-owner", /owner/);
  const usersField  = fieldBy("lead-users", /lead\s*users?/);
  const photoField  = fieldBy("lead-photo", /photo|image/);
  const productsField = fieldBy("products", /products?/);
  const rawSource = sourceField ? String(get(sourceField.id) || "") : "";
  // Only a real store row may travel as sourceId (the API field is a PK —
  // a shipped-default name would 400). Unknown names still ride along as
  // `source` for local rows; the backend seed covers server rows.
  const storeSource = (sources || []).find((s) => String(s.id) === rawSource) || null;
  const rawOwner = ownerField ? String(get(ownerField.id) || "") : "";
  const storeOwner = (userOptions || []).find((m) => String(m.id) === rawOwner) || null;
  // Every captured value, keyed by field id — the leads table renders
  // custom builder fields from this map. The photo travels separately
  // (data URL) and is excluded here.
  const fieldValues = { ...values };
  if (photoField?.id) delete fieldValues[photoField.id];

  return {
    leadName:    getValue("lead-name", /^\s*lead\s*name\s*$/i),
    company:     getValue("company", /comp/),
    email:       getValue("email", /^\s*e-?mail\s*$/i),
    phone:       getValue("phone", /^\s*phone\s*$/i),
    sourceId:    storeSource ? storeSource.id : undefined,
    source:      storeSource ? storeSource.name : rawSource,
    titleValue:  getValue("title", /^\s*title\s*$/i),
    industry:    getValue("industry", /^\s*industry\s*$/i),
    ownerId:     storeOwner ? storeOwner.id : undefined,
    owner:       storeOwner ? storeOwner.name : rawOwner,
    createdOn:   getValue("created-on", /creat\w*\s*on/),
    taskDate:    getValue("task-date", /task\s*date/),
    taskTime:    getValue("task-time", /task\s*time/),
    products:    (productsField ? get(productsField.id) : "") || [],
    leadUsers:   (usersField ? get(usersField.id) : "") || [],
    photoPreview: photoField ? get(photoField.id) : "",
    // Pass through any extra dynamic values
    _extra: values,
    fieldValues,
    customValues: {
      broker_id: values.broker_id || undefined,
      broker_name: values.broker_name || undefined,
      broker_code: values.broker_code || undefined,
      commission_basis: values.commission_basis || undefined,
      commission_rate: values.commission_rate || undefined,
      commission_notes: values.commission_notes || undefined,
      expected_meters: values.expected_meters || undefined,
      expected_takas: values.expected_takas || undefined,
      fabric_quality: values.fabric_quality || undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------
export default function CreateLeadModal({ isOpen, onClose, onCreate, onEditLayout, showTour, submitting = false, serverError = '' }) {
  const sections = useFormSections();
  const userOptions = useUserOptions();
  const sources = useSources();

  // Flat map of fieldId → value
  const [values, setValues] = useState({});
  const [brokers, setBrokers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      salesService.getBrokersList().then((res) => {
        const rows = res?.data || res?.results || res || [];
        if (Array.isArray(rows)) setBrokers(rows);
      }).catch(() => {});
    }
  }, [isOpen]);

  // Only the lead name is truly required — the server stores every other
  // field as optional, so filling just the name is enough to create a lead.
  // (Schema `required` flags stay as visual "*" hints.)
  // Custom builder forms can rename field ids, so resolve by id first and
  // fall back to matching the label (e.g. a "Compnay" typo still maps).
  const allFields = sections.flatMap((s) => s.fields);
  const labelOf = (f) => String(f?.label || '').toLowerCase();
  const byLabel = (re) => allFields.find((f) => re.test(labelOf(f)));
  const fieldBy = (id, re) =>
    allFields.find((f) => f.id === id) || (re ? byLabel(re) : undefined);
  const nameField = fieldBy('lead-name', /^\s*lead\s*name\s*$/i);
  const isFormComplete = String(values[nameField?.id] ?? '').trim() !== '';

  useEffect(() => {
    if (!isOpen) setValues({});
  }, [isOpen]);

  if (!isOpen) return null;

  function handleChange(fieldId, val) {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
  }

  function handleClose() {
    onClose();
  }

  function handleCreate() {
    // Duplicate-submission guard: the parent owns the async save and reports
    // `submitting` while it is in flight; a second click is a no-op.
    if (submitting) return;
    onCreate(leadFormValuesToPayload(values, sections, { sources, userOptions }));
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={handleClose}>
      <section
        className="lead-create-modal relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-lead-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="lead-create-modal-head">
          <h2 id="create-lead-title">Create Lead</h2>
          <button type="button" className="modal-close" onClick={handleClose} aria-label="Close create lead form">
            <X size={18} />
          </button>
        </div>

        {/* Tour hint */}
        {showTour && (
          <div className="pointer-events-none absolute left-[22%] top-[58px] z-30 flex flex-col items-center">
            <div className="inline-flex w-max max-w-[280px] items-center gap-2.5 rounded-[16px] bg-[#1d6bff] px-4 py-2.5 text-left text-[14px] font-medium leading-snug text-white shadow-[0_4px_14px_rgba(29,107,255,0.35)]">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-bold text-[#1d6bff]">3</span>
              <span>Fill in the lead details here</span>
            </div>
            <svg width="56" height="48" viewBox="0 0 56 48" fill="none" className="-mt-1" aria-hidden="true">
              <path d="M28 2 C 28 26, 24 36, 14 42" stroke="#1d6bff" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              <path d="M6 34 L13 43 L23 35" stroke="#1d6bff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        )}

        {/* Dynamic body — renders whatever sections/fields the builder saved */}
        <div className="lead-create-modal-body">
          {(() => {
            const sourceField = fieldBy('lead-source', /source/);
            const currentSourceVal = String(values[sourceField?.id] ?? '');
            const matchedSource = (sources || []).find((s) => String(s.id) === currentSourceVal || String(s.name).toLowerCase() === currentSourceVal.toLowerCase());
            const isBroker = (matchedSource?.name || currentSourceVal).toLowerCase() === 'broker' || Boolean(values.broker_id);
            if (!isBroker) return null;

            return (
              <div className="col-span-full bg-indigo-50/70 p-4 rounded-xl border border-indigo-200 mb-2 space-y-3">
                <div className="text-xs font-bold text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-indigo-600" />
                  Broker Attribution & Agreed Commission Agreement
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Select Broker <span className="text-rose-500">*</span>
                      </label>
                      <MasterSourceLink source="brokers" />
                    </div>
                    <select
                      value={values.broker_id || ''}
                      onChange={(e) => {
                        const bId = e.target.value;
                        const b = brokers.find((x) => String(x.id) === String(bId));
                        setValues((prev) => ({
                          ...prev,
                          broker_id: bId,
                          broker_name: b?.name || '',
                          broker_code: b?.code || '',
                          commission_basis: b?.commission_type || 'percent',
                          commission_rate: b?.default_value ? String(b.default_value) : '',
                          commission_notes: b ? `Terms from ${b.name} (${b.commission_type} @ ${b.default_value || 0})` : '',
                        }));
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                    >
                      <option value="">-- Select Broker --</option>
                      {brokers.map((b) => (
                        <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Commission Basis</label>
                    <select
                      value={values.commission_basis || 'percent'}
                      onChange={(e) => setValues((prev) => ({ ...prev, commission_basis: e.target.value }))}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                    >
                      <option value="percent">Percentage of Net Value (%)</option>
                      <option value="per_meter">Fixed per Meter (₹/m)</option>
                      <option value="per_taka">Fixed per Taka (₹/taka)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Agreed Rate</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 2.0 or 2.50"
                      value={values.commission_rate ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, commission_rate: e.target.value }))}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fabric Quality</label>
                    <input
                      type="text"
                      placeholder="e.g. 60 Lea Linen or 40s Cotton"
                      value={values.fabric_quality ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, fabric_quality: e.target.value }))}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Commission Notes / Approval</label>
                    <input
                      type="text"
                      placeholder="Terms agreed for this lead..."
                      value={values.commission_notes ?? ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, commission_notes: e.target.value }))}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                </div>
              </div>
            );
          })()}
          {sections.map((section) => (
            <div key={section.id} style={{ gridColumn: "1 / -1", display: "contents" }}>
              {sections.length > 1 && (
                <h3 className="lead-create-section-title" style={{ gridColumn: "1 / -1" }}>
                  {section.title}
                </h3>
              )}
              {sections.length === 1 && (
                <h3 className="lead-create-section-title">{section.title}</h3>
              )}
              {section.fields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  values={values}
                  onChange={handleChange}
                  sources={sources}
                  userOptions={userOptions}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        {serverError && (
          <p className="px-5 pb-1 text-xs font-semibold text-rose-600" role="alert">{serverError}</p>
        )}
        <div className="lead-create-modal-actions">
          <div className="relative inline-block">
            {showTour && isFormComplete && (
              <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-30 flex flex-col items-start">
                <div className="inline-flex w-max max-w-[280px] items-start gap-2.5 rounded-[16px] bg-[#1d6bff] px-4 py-3 text-left text-[14px] font-medium leading-snug text-white shadow-[0_4px_14px_rgba(29,107,255,0.35)]">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-bold text-[#1d6bff]">4</span>
                  <span>Click here to edit the form layout<br />(if needed)</span>
                </div>
                <svg width="64" height="42" viewBox="0 0 64 42" fill="none" className="mb-[-6px] ml-[24px] mt-[-4px]" aria-hidden="true">
                  <path d="M54 2 C 36 10, 22 20, 16 34" stroke="#1d6bff" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                  <path d="M8 26 L15 35 L25 28" stroke="#1d6bff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
            )}
            <button type="button" className="btn-outline" onClick={onEditLayout}>
              <Plus size={15} />
              Edit Page Layout
            </button>
          </div>
          <div className="lead-create-action-right">
            <button type="button" className="btn-outline" onClick={handleClose}>Cancel</button>
            <div className="relative inline-block">
              {showTour && isFormComplete && (
                <div className="pointer-events-none absolute bottom-[calc(100%+6px)] right-0 z-30 flex flex-col items-end">
                  <div className="inline-flex w-max max-w-[280px] items-center gap-2.5 rounded-[16px] bg-[#1d6bff] px-4 py-3 text-left text-[14px] font-medium leading-snug text-white shadow-[0_4px_14px_rgba(29,107,255,0.35)]">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-bold text-[#1d6bff]">5</span>
                    <span>Click Submit to create the lead</span>
                  </div>
                  <svg width="56" height="48" viewBox="0 0 56 48" fill="none" className="mb-[-6px] mr-[52px] mt-[-4px]" aria-hidden="true">
                    <path d="M28 2 C 28 26, 26 36, 20 42" stroke="#1d6bff" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                    <path d="M12 34 L19 43 L29 35" stroke="#1d6bff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreate}
                disabled={!isFormComplete || submitting}
                style={!isFormComplete || submitting ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              >
                {submitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
