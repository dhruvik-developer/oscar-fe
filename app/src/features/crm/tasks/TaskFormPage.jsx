import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, CalendarDays, PhoneCall, MapPinned, X, ChevronDown, LayoutGrid, Rows3 } from 'lucide-react';
import InfoBanner from '../common/InfoBanner';
import PageHeader from '../../../components/ui/PageHeader';
import { useCrmStore } from '../../../stores/crmStore';
import { loadForms, saveForms, TASK_FORM } from '../../../services/crmForms';


function iconFor(name) {
  return name === 'visit' ? MapPinned : PhoneCall;
}

function parseDateValue(dateString) {
  if (!dateString || typeof dateString !== 'string') return 0;
  const [day, month, year] = dateString.split('/').map(Number);
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day).getTime();
}

export default function TaskFormPage() {
  const navigate = useNavigate();
  // Task forms are the same server collection as lead forms, tagged by kind.
  // Single source of truth: the list is DERIVED from the store (falling back
  // to the last saved builder state), never mirrored into local state.
  // The old mirror-then-push-back effects raced within a single flush — the
  // push fired with stale local rows while the mirror was already fixing
  // them, clobbering server truth back and forth until React threw
  // "Maximum update depth exceeded". User actions below write through
  // saveForms directly, so no effect can chase its own tail.
  const storeForms = useCrmStore((s) => s.forms);
  // loadForms reads the store itself — the dep below re-runs this when the
  // store reference changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const forms = useMemo(() => loadForms(TASK_FORM), [storeForms]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [sortOrder, setSortOrder] = useState('Newest First');
  const [viewMode, setViewMode] = useState('grid');

  // (Derived `forms` above replaces the old push-back effect entirely.)

  function openCreateModal() {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setIsModalOpen(true);
  }

  function openEditModal(form) {
    try {
      localStorage.setItem('activeTaskFormId', form.id);
    } catch { /* ignore */ }
    navigate(`/crm/leads/task-form/builder?formId=${form.id}`);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setSaveError('');
  }

  function saveFailureMessage(res) {
    const first = res && res.errors && res.errors[0];
    const message = first && first.error && first.error.message;
    return message || 'Could not save the form to the server. Your input is kept — try again.';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const title = formName.trim();
    if (!title || saving) return;
    const desc = formDescription.trim() || 'No description provided';
    const today = new Date().toLocaleDateString('en-GB');

    setSaving(true);
    setSaveError('');
    try {
      if (editingId) {
        const res = await saveForms(forms.map((f) => (f.id === editingId ? { ...f, title, description: desc, lastUpdated: today } : f)), TASK_FORM);
        if (res && !res.ok) {
          setSaveError(saveFailureMessage(res));
          return;
        }
        closeModal();
      } else {
        const newId = `task-form-${Date.now()}`;
        const newForm = {
          id: newId,
          kind: TASK_FORM,
          title,
          description: desc,
          fields: [],
          sections: [{ id: 'task-information', title: 'Task Information', fields: [] }],
          lastUpdated: today,
          status: 'ACTIVE',
          iconName: 'call',
        };
        const res = await saveForms([...forms, newForm], TASK_FORM);
        const confirmed = res && (res.results || []).find((r) => String(r.id) === String(newId) && r.saved && r.saved.id);
        if (confirmed) {
          // Open the builder on the confirmed server id — opening it on the
          // temp id orphans every field edit (saves silently no-op and a
          // refresh discards the fields).
          const serverId = confirmed.saved.id;
          closeModal();
          try {
            localStorage.setItem('activeTaskFormId', serverId);
          } catch { /* ignore */ }
          navigate(`/crm/leads/task-form/builder?formId=${serverId}`);
          return;
        }
        if (res && res.ok) {
          // Offline: the temp id is the record.
          closeModal();
          try {
            localStorage.setItem('activeTaskFormId', newId);
          } catch { /* ignore */ }
          navigate(`/crm/leads/task-form/builder?formId=${newId}`);
          return;
        }
        setSaveError(saveFailureMessage(res));
      }
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!deleteId) return;
    saveForms(forms.filter((f) => f.id !== deleteId), TASK_FORM);
    setDeleteId(null);
  }

  function fieldInfo(form) {
    if (form.sections && Array.isArray(form.sections)) {
      const labels = form.sections.flatMap((s) => (s.fields || []).map((fl) => fl.label));
      return {
        count: labels.length,
        text: labels.length > 0 ? labels.join(', ') : 'No fields defined',
      };
    }
    const arr = form.fields || [];
    return { count: arr.length, text: arr.length > 0 ? arr.join(', ') : 'No fields defined' };
  }

  const visible = useMemo(() => {
    const nextForms = forms.filter((form) => (
      statusFilter === 'All Status' ||
      (statusFilter === 'Active' && (form.status || 'ACTIVE') === 'ACTIVE')
    ));

    nextForms.sort((a, b) => {
      const aDate = parseDateValue(a.lastUpdated);
      const bDate = parseDateValue(b.lastUpdated);
      return sortOrder === 'Oldest First' ? aDate - bDate : bDate - aDate;
    });

    return nextForms;
  }, [forms, sortOrder, statusFilter]);

  return (
    <section className="w-full">
      <PageHeader
        title="Manage Lead Task Forms"
        subtitle="Design the fields collected while doing a task — every call, visit or follow-up follows the same checklist."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={openCreateModal}
              aria-label="Create new task form"
            >
              <Plus size={16} />
              <span>Create Form</span>
            </button>
          </div>
        }
      />

      <div className="mt-5">
        <InfoBanner
          storageKey="infoBannerLeadTaskFormV1"
          title="Why use Lead Task Forms?"
          text="These define the fields collected while doing a task. You design the form once, then every call, visit or follow-up follows the same checklist."
        />
      </div>

      <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 sm:p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
              {visible.length} {visible.length === 1 ? 'Form' : 'Forms'}
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
                onClick={() => setViewMode('grid')}
                className={`inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-sm font-semibold transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-[#2f6fed] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Rows3 size={15} />
                <span>Grid View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tile')}
                className={`inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-sm font-semibold transition cursor-pointer ${
                  viewMode === 'tile' ? 'bg-[#2f6fed] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid size={15} />
                <span>Tile View</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[18px] border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          Create a task form using the top-right button, then open it in the builder to add sections and fields.
        </div>

        {visible.length === 0 ? (
          <div className="mt-5 rounded-[20px] border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm font-semibold text-slate-700">No forms found</p>
            <p className="mt-1 text-xs text-slate-500">Create a new form to get started.</p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-[12px] bg-[#2f6fed] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              Create Form
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50/95">
                  <tr className="text-left text-[12px] font-bold uppercase tracking-[0.04em] text-slate-500">
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
                  {visible.map((form, index) => {
                    const Icon = iconFor(form.iconName);
                    const { count } = fieldInfo(form);

                    return (
                      <tr key={form.id} className="text-sm text-slate-700 transition hover:bg-slate-50/60">
                        <td className="px-5 py-4 font-medium text-slate-500 whitespace-nowrap">{index + 1}</td>
                        <td className="px-5 py-4 min-w-[210px]">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                              <Icon size={16} />
                            </span>
                            <span className="font-bold text-slate-900 whitespace-nowrap">{form.title}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                          {form.description || 'No description provided'}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
                            {count} Fields
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-700 whitespace-nowrap">{form.lastUpdated}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                            {form.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEditModal(form)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                            >
                              <Pencil size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteId(form.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                              aria-label={`Delete ${form.title}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((form) => {
              const Icon = iconFor(form.iconName);
              const { count, text: fieldText } = fieldInfo(form);

              return (
                <article
                  key={form.id}
                  className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <Icon size={16} />
                        </span>
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-bold text-slate-900">{form.title}</h2>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                            {form.description || 'No description provided'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 text-[11px] leading-relaxed text-slate-500" title={fieldText}>
                    {fieldText}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-[14px] bg-slate-50 p-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Fields</div>
                      <div className="mt-0.5 text-sm font-bold text-slate-900">{count}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Status</div>
                      <div className="mt-0.5 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {form.status || 'ACTIVE'}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Created On</div>
                      <div className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        <CalendarDays size={13} />
                        <span>{form.lastUpdated}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2.5">
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-[12px] bg-[#2f6fed] px-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] cursor-pointer"
                      onClick={() => openEditModal(form)}
                    >
                      <Pencil size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 cursor-pointer"
                      onClick={() => setDeleteId(form.id)}
                      aria-label={`Delete ${form.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing {visible.length === 0 ? 0 : 1} to {visible.length} of {visible.length} forms
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-400"
              disabled
              aria-label="Previous page"
            >
              <ChevronDown size={16} className="rotate-90" />
            </button>
            <button
              type="button"
              className="inline-flex h-10 min-w-10 items-center justify-center rounded-[12px] bg-[#2f6fed] px-3 text-sm font-semibold text-white"
            >
              1
            </button>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-400"
              disabled
              aria-label="Next page"
            >
              <ChevronDown size={16} className="-rotate-90" />
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4"
          role="presentation"
          onMouseDown={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 max-h-[95vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{editingId ? 'Edit Form' : 'Create New Form'}</h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Form Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter form name (e.g. Website Inquiry Form)"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Enter form description (optional)"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800 text-xs resize-none"
                />
              </div>

              {saveError && <p role="alert" className="text-[11px] font-semibold text-rose-600">{saveError}</p>}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formName.trim() || saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-xs transition cursor-pointer text-xs"
                >
                  {saving ? 'Saving…' : (editingId ? 'Save Changes' : 'Create Form')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4"
          role="presentation"
          onMouseDown={() => setDeleteId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 p-5"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-bold text-slate-900">Delete this form?</h2>
            <p className="text-xs text-slate-500 mt-1">This action cannot be undone. The form will be removed permanently.</p>
            <div className="flex items-center justify-end gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
