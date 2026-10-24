import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  Info,
  LayoutGrid,
  Pencil,
  Plus,
  Rows3,
  Trash2,
} from "lucide-react";
import InfoBanner from "../common/InfoBanner";
import PageHeader from "../../../components/ui/PageHeader";

function parseDateValue(dateString) {
  if (!dateString || typeof dateString !== "string") return 0;
  const [day, month, year] = dateString.split("/").map(Number);
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day).getTime();
}

function getFieldCount(form) {
  if (typeof form.fieldsCount === "number") return form.fieldsCount;
  if (!Array.isArray(form.sections)) return 0;
  return form.sections.reduce((total, section) => total + (section.fields?.length || 0), 0);
}

export default function LeadFormsManager({ forms, activeFormId, onToggleForm, onCreateForm, onEditForm, onDeleteForm, onOpenGuide }) {
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [sortOrder, setSortOrder] = useState("Newest First");
  const [viewMode, setViewMode] = useState("grid");

  const filteredForms = useMemo(() => {
    const nextForms = forms.filter((form) => {
      const matchesStatus =
        statusFilter === "All Status" ||
        (statusFilter === "Active" && form.id === activeFormId);

      return matchesStatus;
    });

    nextForms.sort((a, b) => {
      const aDate = parseDateValue(a.createdOn);
      const bDate = parseDateValue(b.createdOn);
      return sortOrder === "Oldest First" ? aDate - bDate : bDate - aDate;
    });

    return nextForms;
  }, [forms, sortOrder, statusFilter, activeFormId]);

function StatusToggle({ form, activeFormId, onToggleForm }) {
  const isOn = form?.id === activeFormId;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={`${isOn ? 'Deactivate' : 'Activate'} ${form?.name || ''}`}
        title={isOn ? 'On — this form opens from Create Lead' : 'Off — toggle on to use this form'}
        onClick={() => onToggleForm?.(form?.id)}
        className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors ${
          isOn ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'
        }`}
        style={{ height: 22 }}
      >
        <span className="inline-block h-4 w-4 rounded-full bg-white shadow-xs" />
      </button>
      <span className={`text-[11px] font-bold ${isOn ? 'text-emerald-700' : 'text-slate-400'}`}>
        {isOn ? 'ACTIVE' : 'OFF'}
      </span>
      {isOn && <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
    </span>
  );
}

  return (
    <section className="w-full">
      <PageHeader
        title="Manage Lead Create Forms"
        subtitle="Define which fields appear while creating a lead — design once, every new lead follows the same structure."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {onOpenGuide && (
              <button
                type="button"
                onClick={onOpenGuide}
                aria-haspopup="dialog"
                aria-label="How to create a form"
                className="group inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 pl-1.5 pr-3.5 text-[13px] font-semibold text-blue-700 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-blue-400 hover:shadow-md hover:shadow-blue-500/15 whitespace-nowrap"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-[13px] font-bold text-white shadow-sm transition-transform duration-200 group-hover:scale-105 group-hover:rotate-6">?</span>
                How to create a form?
              </button>
            )}

            <button
              type="button"
              className="btn-primary"
              onClick={onCreateForm}
              aria-label="Create new lead form"
            >
              <Plus size={16} />
              <span>Create Form</span>
            </button>
          </div>
        }
      />

      <div className="mt-5">
        <InfoBanner
          storageKey="infoBannerLeadCreateFormV1"
          title="Why use Lead Create Forms?"
          text="These define which fields appear while creating a lead. You design the form once, then every new lead follows the same structure."
        />
      </div>

      <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <div className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 px-3 py-1.5 text-sm font-semibold text-blue-700">
              {filteredForms.length} {filteredForms.length === 1 ? "Form" : "Forms"}
            </div>

            <div className="relative shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 min-w-[150px] appearance-none rounded-[14px] border border-slate-200 bg-white px-4 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-[#2f6fed]"
              >
                <option>All Status</option>
                <option>Active</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <div className="relative shrink-0">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="h-11 min-w-[160px] appearance-none rounded-[14px] border border-slate-200 bg-white px-4 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-[#2f6fed]"
              >
                <option>Newest First</option>
                <option>Oldest First</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            <div className="inline-flex shrink-0 rounded-[16px] border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-sm font-semibold transition cursor-pointer ${
                  viewMode === "grid" ? "bg-[#2f6fed] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Rows3 size={15} />
                <span>Grid View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("tile")}
                className={`inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-sm font-semibold transition cursor-pointer ${
                  viewMode === "tile" ? "bg-[#2f6fed] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutGrid size={15} />
                <span>Tile View</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2.5 rounded-[18px] border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 px-4 py-3 text-sm text-slate-600">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
            <Info size={13} />
          </span>
          Create a form using the top-right button, then open it in the builder to add sections and fields.
        </div>

        {viewMode === "grid" ? (
          <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-slate-50 via-slate-50/90 to-indigo-50/50">
                  <tr className="text-left text-[12px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    <th className="px-5 py-4 whitespace-nowrap">#</th>
                    <th className="px-5 py-4 whitespace-nowrap">Form Name</th>
                    <th className="px-5 py-4 whitespace-nowrap">Description</th>
                    <th className="px-5 py-4 whitespace-nowrap">Fields</th>
                    <th className="px-5 py-4 whitespace-nowrap">Created On</th>
                    <th className="px-5 py-4 whitespace-nowrap">Status</th>
                    <th className="px-5 py-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredForms.map((form, index) => (
                    <tr key={form.id} className="text-sm text-slate-700 transition-all even:bg-slate-50/40 hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_0_#2f6fed]">
                      <td className="px-5 py-4 font-medium text-slate-500 whitespace-nowrap">{index + 1}</td>
                      <td className="px-5 py-4 min-w-[210px]">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25 shrink-0">
                            <FileText size={16} />
                          </span>
                          <span className="font-bold text-slate-900 whitespace-nowrap">{form.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                        {form.description || "No description provided"}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm">
                          {getFieldCount(form)} Fields
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700 whitespace-nowrap">{form.createdOn}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <StatusToggle form={form} activeFormId={activeFormId} onToggleForm={onToggleForm} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onEditForm(form.id)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 text-sm font-semibold text-blue-700 transition hover:-translate-y-px hover:border-blue-400 hover:shadow-md hover:shadow-blue-500/15 cursor-pointer"
                          >
                            <Pencil size={13} />
                            <span>Edit</span>
                          </button>
                          {onDeleteForm && (
                            <button
                              type="button"
                              onClick={() => onDeleteForm(form.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                              aria-label={`Delete ${form.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredForms.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
                          <FileText size={22} />
                        </span>
                        <p className="text-sm font-semibold text-slate-600">No forms found</p>
                        <p className="mt-1 text-xs text-slate-400">Create your first form with the button above.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredForms.map((form) => (
              <article
                key={form.id}
                className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-900/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25">
                        <FileText size={16} />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold text-slate-900">{form.name}</h2>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                          {form.description || "No description provided"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-[14px] bg-slate-50 p-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Fields</div>
                    <div className="mt-0.5 text-sm font-bold text-slate-900">{getFieldCount(form)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Status</div>
                    <div className="mt-1">
                      <StatusToggle form={form} activeFormId={activeFormId} onToggleForm={onToggleForm} />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Created On</div>
                    <div className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <CalendarDays size={13} />
                      <span>{form.createdOn}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2.5">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-1.5 rounded-[12px] bg-gradient-to-r from-blue-600 to-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md hover:shadow-blue-500/25 cursor-pointer"
                    onClick={() => onEditForm(form.id)}
                  >
                    <Pencil size={13} />
                    <span>Edit</span>
                  </button>
                  {onDeleteForm && (
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 cursor-pointer"
                      onClick={() => onDeleteForm(form.id)}
                      aria-label={`Delete ${form.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing {filteredForms.length === 0 ? 0 : 1} to {filteredForms.length} of {filteredForms.length} forms
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 disabled:opacity-50"
              disabled
              aria-label="Previous page"
            >
              <ChevronDown size={16} className="rotate-90" />
            </button>
            <button
              type="button"
              className="inline-flex h-10 min-w-10 items-center justify-center rounded-[12px] bg-[#2f6fed] px-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-[#1d4ed8]"
            >
              1
            </button>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 disabled:opacity-50"
              disabled
              aria-label="Next page"
            >
              <ChevronDown size={16} className="-rotate-90" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
