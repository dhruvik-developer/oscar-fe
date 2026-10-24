import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import LeadFormsManager from '../leads/LeadFormsManager';
import LeadGuideModal from '../leads/LeadGuideModal';
import { defaultLeadFormSections } from '../../../data/crm/leadFormSchema';
import { useCrmStore } from '../../../stores/crmStore';
import { loadForms, saveForms, setActiveFormId, fetchLiveLeadFormId, setLiveLeadForm, LEAD_FORM } from '../../../services/crmForms';
import { isServerId } from '../../../services/resourceSync';

export default function LeadFormsPage() {
  const navigate = useNavigate();
  // Forms live at `/crm/forms/`, so a form designed here is the form the
  // capture page renders for everyone.
  // Single source of truth: derived from store/storage instead of mirroring into
  // local state, preventing infinite re-render loops ("Maximum update depth exceeded").
  const storeForms = useCrmStore((s) => s.forms);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const leadForms = useMemo(() => {
    const loaded = loadForms(LEAD_FORM);
    if (loaded.length === 0) {
      const defaultId = 'lead-form-default';
      return [
        {
          id: defaultId,
          name: 'Lead Create Form',
          description: 'Default lead capture form with all standard fields.',
          createdOn: new Date().toLocaleDateString('en-GB'),
          sections: defaultLeadFormSections,
          kind: LEAD_FORM,
        },
      ];
    }
    return loaded;
  }, [storeForms]);

  // Which form Create Lead renders for every user — the server's isActive
  // flag, flipped by the row toggle. Refreshed on open in case another user
  // changed it since the forms were loaded.
  const activeFormId = useMemo(
    () => (storeForms || []).find((f) => (f.kind || LEAD_FORM) === LEAD_FORM && f.isActive)?.id ?? null,
    [storeForms],
  );
  const [toggling, setToggling] = useState(false);
  useEffect(() => {
    fetchLiveLeadFormId().catch(() => {});
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');

  function openCreateModal() {
    setFormName('');
    setFormDesc('');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  async function handleToggleForm(formId) {
    // Single active form: toggling on shows this form on Create Lead for
    // everyone; toggling the active one off leaves none, and Create Lead then
    // asks the user to switch a form on.
    if (toggling) return;
    if (!isServerId(formId)) {
      alert('Open this form in the builder and save it before switching it on.');
      return;
    }
    const next = String(activeFormId) === String(formId) ? null : formId;
    setToggling(true);
    try {
      await setLiveLeadForm(next);
    } catch (err) {
      alert(`Could not change the form status: ${err?.message || err}`);
    } finally {
      setToggling(false);
    }
  }

  function handleCreateSubmit(e) {
    e.preventDefault();
    if (!formName.trim()) return;

    const newId = `lead-form-${Date.now()}`;
    const newForm = {
      id: newId,
      name: formName.trim(),
      description: formDesc.trim() || 'Custom lead capture form',
      createdOn: new Date().toLocaleDateString('en-GB'),
      sections: [{ id: 'lead-information', title: 'Lead Information', fields: [] }],
      kind: LEAD_FORM,
    };

    saveForms([...leadForms, newForm], LEAD_FORM);
    // Builder position only: a new (empty) form is not switched on for
    // everyone until the user toggles it on.
    setActiveFormId(newId);
    setIsModalOpen(false);
    navigate(`/crm/leads/form-builder?formId=${newId}`);
  }

  function handleEditForm(formId) {
    setActiveFormId(formId);
    navigate(`/crm/leads/form-builder?formId=${formId}`);
  }

  function handleDeleteForm(formId) {
    const updated = leadForms.filter((f) => f.id !== formId);
    // Deleting the live form leaves none switched on; the server drops it with
    // the form, so there is nothing else to update here.
    saveForms(updated, LEAD_FORM);
  }

  return (
    <>
      <LeadFormsManager
        forms={leadForms}
        activeFormId={activeFormId}
        onToggleForm={handleToggleForm}
        onCreateForm={openCreateModal}
        onEditForm={handleEditForm}
        onDeleteForm={handleDeleteForm}
        onOpenGuide={() => setIsGuideOpen(true)}
      />
      <LeadGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} variant="form" />

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4"
          role="presentation"
          onMouseDown={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Create New Form</h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Enter form description (optional)"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 shadow-2xs text-slate-800 text-xs resize-none"
                />
              </div>

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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition cursor-pointer text-xs"
                >
                  Create Form
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
