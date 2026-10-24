import { useMemo, useState } from "react";
import {
  AtSign,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Coins,
  Copy,
  Eye,
  FileText,
  GripVertical,
  Hash,
  ImagePlus,
  ListChecks,
  Lock,
  Mail,
  Pencil,
  Phone,
  Plus,
  Save,
  Trash2,
  Type,
  Upload,
  User,
  X,
} from "lucide-react";
import { FIELD_LIBRARY } from "../../../data/crm/leadFormSchema";
import PageHeader from "../../../components/ui/PageHeader";

const FIELD_ICONS = {
  "Single Line": Type,
  "Multi Line": FileText,
  Number: Hash,
  Email: Mail,
  Phone: Phone,
  Date: CalendarDays,
  Dropdown: ChevronDown,
  "Multi Select": ListChecks,
  Checkbox: CheckSquare,
  Radio: CircleDot,
  "File Upload": Upload,
  Currency: Coins,
  User: User,
  Lookup: AtSign,
  "Lead Image": ImagePlus,
};

function readDragPayload(event) {
  const raw =
    event.dataTransfer?.getData("application/json") ||
    event.dataTransfer?.getData("text/plain");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function FieldPreview({
  field,
  sectionId,
  selected,
  onSelect,
  onOpenProperties,
  onRemove,
  onDropField,
  onDragStart,
}) {
  const Icon = FIELD_ICONS[field.type] ?? Type;
  const isTextArea = field.type === "Multi Line";
  const isDropdown = field.type === "Dropdown";
  const isLeadImage = field.type === "Lead Image";
  const [previewValue, setPreviewValue] = useState("");
  const previewOptions =
    Array.isArray(field.options) && field.options.length > 0
      ? field.options
      : field.label?.toLowerCase().includes("source")
      ? ["Broker", "Sales Person"]
      : ["Option 1", "Option 2", "Option 3"];

  function handleDrop(event, position) {
    event.preventDefault();
    event.stopPropagation();
    onDropField(readDragPayload(event), sectionId, position);
  }

  return (
    <div
      className="relative group/drop"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => handleDrop(event, "before")}
    >
      <div
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onOpenProperties();
        }}
        className={`rounded-xl border transition-all p-3.5 bg-white cursor-pointer select-none ${
          selected
            ? "border-blue-500 ring-2 ring-blue-100 shadow-xs"
            : "border-slate-200 hover:border-slate-300 hover:shadow-2xs"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              draggable
              onDragStart={(event) =>
                onDragStart(event, { kind: "field", fieldId: field.id, sectionId })
              }
              onDragOver={(event) => event.preventDefault()}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex text-slate-300 group-hover/drop:text-slate-400 cursor-grab shrink-0"
              role="button"
              tabIndex={0}
              title={`Drag ${field.label}`}
            >
              <GripVertical size={13} />
            </span>
            <span className="text-xs font-semibold text-slate-800 truncate">
              {field.label}
              {field.required && <span className="text-rose-500 ml-0.5">*</span>}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenProperties();
              }}
              className="text-slate-300 hover:text-blue-600 transition-colors p-0.5 cursor-pointer"
              title={`Edit ${field.label}`}
            >
              <Pencil size={13} />
            </button>
            {field.locked ? (
              <Lock size={13} className="text-slate-300 shrink-0" />
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(field.id);
                }}
                className="text-slate-300 hover:text-rose-500 transition-colors p-0.5 cursor-pointer"
                title={`Remove ${field.label}`}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {isLeadImage ? (
          <div className="mt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">{field.label}</span>
              <div className="w-8 h-4.5 bg-emerald-500 rounded-full flex items-center p-0.5 justify-end cursor-pointer">
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
              </div>
            </div>
            <div className="w-14 h-14 rounded-xl bg-slate-100/80 border border-slate-200/80 flex items-center justify-center text-slate-400 mt-2.5">
              <ImagePlus size={24} strokeWidth={1.5} />
            </div>
          </div>
        ) : isTextArea ? (
          <textarea
            rows={2}
            placeholder={field.placeholder}
            readOnly
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-400 resize-none pointer-events-none focus:outline-none"
          />
        ) : isDropdown ? (
          <div
            className="relative"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <select
              value={previewValue}
              onChange={(event) => setPreviewValue(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onFocus={() => onSelect()}
              className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-700 appearance-none pr-8 cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="" disabled>
                {field.placeholder || `Select ${String(field.label ?? '').toLowerCase()}`}
              </option>
              {previewOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="text-slate-400 shrink-0 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        ) : (
          <div className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 flex items-center justify-between text-xs text-slate-400 shadow-2xs pointer-events-none">
            <span className="truncate mr-2">{field.placeholder || `Enter ${String(field.label ?? '').toLowerCase()}`}</span>
            <Icon size={14} className="text-slate-400 shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadFormBuilder({
  sections = [],
  selectedFieldId,
  onSelectField,
  selectedField,
  onUpdateField,
  onAddField,
  onRemoveField,
  onMoveField,
  onAddSection,
  onRemoveSection,
  onUpdateSectionTitle,
  onDuplicateSection,
  onPreview,
  onSaveAndOpen,
  saveSuccess = false,
  formTitle = "Lead Form Builder",
  hideHeader = false,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(() => sections[0]?.id || null);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [collapsedSections, setCollapsedSections] = useState({});
  const [newOptionText, setNewOptionText] = useState("");

  const effectiveSectionId = activeSectionId || sections[0]?.id;

  const SelectedTypeIcon = FIELD_ICONS[selectedField?.type] ?? Type;

  const libraryItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return FIELD_LIBRARY;
    return FIELD_LIBRARY.filter((item) => item.toLowerCase().includes(query));
  }, [searchQuery]);

  function handleDragStart(event, payload) {
    const serialized = JSON.stringify(payload);
    event.dataTransfer.setData("application/json", serialized);
    event.dataTransfer.setData("text/plain", serialized);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(payload, sectionId, position, anchorFieldId) {
    if (!payload) return;

    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;

    let targetIndex = section.fields.length;

    if (anchorFieldId) {
      const anchorIndex = section.fields.findIndex((field) => field.id === anchorFieldId);
      if (anchorIndex >= 0) {
        targetIndex = position === "before" ? anchorIndex : anchorIndex + 1;
      }
    }

    if (payload.kind === "library") {
      onAddField(sectionId, payload.type, targetIndex);
      return;
    }

    if (payload.kind === "field") {
      if (payload.sectionId === sectionId) {
        const sourceIndex = section.fields.findIndex((field) => field.id === payload.fieldId);
        if (sourceIndex >= 0 && sourceIndex < targetIndex) {
          targetIndex -= 1;
        }
      }
      onMoveField(payload.fieldId, sectionId, targetIndex);
    }
  }

  function startEditingSectionTitle(section) {
    setEditingSectionId(section.id);
    setEditingSectionTitle(section.title);
  }

  function saveEditingSectionTitle(sectionId) {
    if (editingSectionTitle.trim()) {
      onUpdateSectionTitle?.(sectionId, editingSectionTitle.trim());
    }
    setEditingSectionId(null);
  }

  function toggleSectionCollapse(sectionId) {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }

  function addOptionToField() {
    if (!newOptionText.trim() || !selectedField) return;
    const currentOptions = Array.isArray(selectedField.options) ? selectedField.options : [];
    onUpdateField(selectedField.id, { options: [...currentOptions, newOptionText.trim()] });
    setNewOptionText("");
  }

  function removeOptionFromField(index) {
    if (!selectedField) return;
    const currentOptions = Array.isArray(selectedField.options) ? selectedField.options : [];
    const updated = currentOptions.filter((_, i) => i !== index);
    onUpdateField(selectedField.id, { options: updated });
  }

  const isOptionBasedField =
    selectedField?.type === "Dropdown" ||
    selectedField?.type === "Multi Select" ||
    selectedField?.type === "Radio";

  return (
    <section className="w-full">
      {!hideHeader && (
        <PageHeader
          title={formTitle || "Lead Form Builder"}
          subtitle="Create and manage your lead form with custom fields. Click or drag fields to build your layout."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onPreview}
                className="btn-outline"
              >
                <Eye size={16} />
                Preview
              </button>
              <button
                type="button"
                onClick={onSaveAndOpen}
                className="btn-primary"
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          }
        />
      )}

      <div className="flex flex-col lg:flex-row items-start gap-6">
        <aside className="w-full lg:w-72 shrink-0 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3 tracking-tight">Fields</h3>

          <div className="relative flex items-center mb-4">
            <Type size={14} className="text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search field types..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            {libraryItems.map((type) => {
              const Icon = FIELD_ICONS[type] ?? Type;
              return (
                <div
                  key={type}
                  draggable
                  onDragStart={(event) => handleDragStart(event, { kind: "library", type })}
                  onClick={() => onAddField(effectiveSectionId, type)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/40 text-slate-700 text-xs font-medium transition shadow-2xs cursor-grab active:cursor-grabbing select-none group text-left"
                >
                  <Icon size={14} className="text-slate-500 group-hover:text-blue-600 transition-colors shrink-0" />
                  <span className="truncate">{type}</span>
                </div>
              );
            })}
            {libraryItems.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">No matching fields</p>
            )}
          </div>
        </aside>

        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Form Layout</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any field from the left panel to add it into the selected section.
              </p>
            </div>
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onAddSection}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-xs transition cursor-pointer"
              >
                <Plus size={14} />
                Add Section
              </button>
              <button
                type="button"
                onClick={() => onAddField(effectiveSectionId, "Single Line")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-xs transition cursor-pointer"
              >
                <Plus size={14} />
                Add Field
              </button>
            </div>
          </div>

          <div className="border border-dashed border-slate-200 rounded-3xl p-4 sm:p-5 bg-transparent">
            <div className="space-y-4">
              {sections.map((section) => {
                const isActive = section.id === effectiveSectionId;
                const isCollapsed = collapsedSections[section.id];
                const isEditingTitle = editingSectionId === section.id;

                return (
                  <div
                    key={section.id}
                    onClick={() => setActiveSectionId(section.id)}
                    className={`bg-white rounded-2xl border transition-all p-5 sm:p-6 shadow-xs ${
                      isActive ? "border-blue-500 ring-2 ring-blue-50" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-slate-800 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSectionCollapse(section.id);
                          }}
                          className="text-slate-500 hover:text-slate-800 transition p-0.5"
                        >
                          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isEditingTitle ? (
                          <div className="flex items-center gap-1.5 flex-1 max-w-xs" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingSectionTitle}
                              onChange={(e) => setEditingSectionTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEditingSectionTitle(section.id);
                              }}
                              autoFocus
                              className="px-2 py-1 text-xs font-bold text-slate-900 border border-blue-500 rounded focus:outline-none w-full"
                            />
                            <button
                              type="button"
                              onClick={() => saveEditingSectionTitle(section.id)}
                              className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-bold text-slate-900 truncate">{section.title}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingSectionTitle(section);
                              }}
                              className="text-slate-400 hover:text-blue-600 transition p-0.5"
                              title="Rename section"
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-slate-400 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddField(section.id, "Single Line");
                          }}
                          title="Add field to section"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded-md transition"
                        >
                          <Plus size={13} />
                          <span>Field</span>
                        </button>

                        {onDuplicateSection && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicateSection(section.id);
                            }}
                            title="Duplicate section"
                            className="p-1 hover:text-slate-600 transition cursor-pointer"
                          >
                            <Copy size={15} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveSection?.(section.id);
                          }}
                          title="Remove section"
                          className="p-1 hover:text-rose-500 transition cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleDrop(readDragPayload(event), section.id)}
                      >
                        {section.fields.map((field) => (
                          <FieldPreview
                            key={field.id}
                            field={field}
                            sectionId={section.id}
                            selected={field.id === selectedFieldId}
                            onSelect={() => onSelectField(field.id)}
                            onOpenProperties={() => {
                              onSelectField(field.id);
                              setIsPropertiesOpen(true);
                            }}
                            onRemove={onRemoveField}
                            onDragStart={handleDragStart}
                            onDropField={(payload, targetSectionId, position) =>
                              handleDrop(payload, targetSectionId, position, field.id)
                            }
                          />
                        ))}
                        {section.fields.length === 0 && (
                          <div className="col-span-1 md:col-span-2 border-2 border-dashed border-slate-200 rounded-xl py-10 flex flex-col items-center justify-center text-slate-400 text-xs gap-1.5">
                            <Plus size={20} className="text-slate-300" />
                            <span>Drop a field from the left panel or click Add Field</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {isPropertiesOpen && selectedField && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4"
          role="presentation"
          onClick={() => setIsPropertiesOpen(false)}
        >
          <section
            className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="builder-properties-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 id="builder-properties-title" className="text-sm font-bold text-slate-900">
                Field Properties
              </h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
                aria-label="Close properties"
                onClick={() => setIsPropertiesOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg w-fit text-slate-700">
                <SelectedTypeIcon size={16} className="text-slate-500" />
                <span className="text-xs font-semibold">{selectedField.type}</span>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Label *
                  </label>
                  <input
                    type="text"
                    value={selectedField.label}
                    onChange={(event) =>
                      onUpdateField(selectedField.id, { label: event.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Placeholder
                  </label>
                  <input
                    type="text"
                    value={selectedField.placeholder || ""}
                    onChange={(event) =>
                      onUpdateField(selectedField.id, { placeholder: event.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Field Type
                  </label>
                  <select
                    value={selectedField.type}
                    onChange={(event) =>
                      onUpdateField(selectedField.id, { type: event.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800"
                  >
                    {FIELD_LIBRARY.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {isOptionBasedField && (
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      Field Options / Choices
                    </label>
                    <div className="space-y-1.5">
                      {(selectedField.options || ["Option 1", "Option 2"]).map((opt, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                          <span className="text-slate-700 font-medium truncate">{opt}</span>
                          <button
                            type="button"
                            onClick={() => removeOptionFromField(idx)}
                            className="text-slate-400 hover:text-rose-500 transition p-0.5"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        placeholder="Add new option..."
                        value={newOptionText}
                        onChange={(e) => setNewOptionText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addOptionToField();
                        }}
                        className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={addOptionToField}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span className="text-xs font-medium text-slate-700">Required</span>
                    <input
                      type="checkbox"
                      checked={!!selectedField.required}
                      onChange={(event) =>
                        onUpdateField(selectedField.id, { required: event.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span className="text-xs font-medium text-slate-700">Show in List View</span>
                    <input
                      type="checkbox"
                      checked={!!selectedField.showInList}
                      onChange={(event) =>
                        onUpdateField(selectedField.id, { showInList: event.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between py-1 cursor-pointer">
                    <span className="text-xs font-medium text-slate-700">Unique Value</span>
                    <input
                      type="checkbox"
                      checked={!!selectedField.uniqueValue}
                      onChange={(event) =>
                        onUpdateField(selectedField.id, { uniqueValue: event.target.checked })
                      }
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Help Text
                  </label>
                  <textarea
                    rows={2}
                    value={selectedField.helpText || ""}
                    onChange={(event) =>
                      onUpdateField(selectedField.id, { helpText: event.target.value })
                    }
                    placeholder="Enter help text (optional)"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    onRemoveField(selectedField.id);
                    setIsPropertiesOpen(false);
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Remove Field
                </button>
                <button
                  type="button"
                  onClick={() => setIsPropertiesOpen(false)}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition cursor-pointer"
                >
                  Save Field
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {saveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 size={16} />
          <span>Form layout saved successfully!</span>
        </div>
      )}
    </section>
  );
}
