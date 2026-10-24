import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LeadFormBuilder from './LeadFormBuilder';
import { createFieldFromType, defaultLeadFormSections } from '../../../data/crm/leadFormSchema';
import { useCrmStore } from '../../../stores/crmStore';
import { loadForms, saveForms, findForm, getActiveFormId, setActiveFormId, LEAD_FORM } from '../../../services/crmForms';

export default function LeadFormBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formId = searchParams.get('formId') || getActiveFormId() || null;

  // The form being edited, from `/crm/forms/`.
  const storeForms = useCrmStore((s) => s.forms);
  const currentForm = useMemo(
    () => (formId ? findForm(formId) : null) || loadForms(LEAD_FORM)[0] || null,
    [formId, storeForms],
  );

  const [leadFormSections, setLeadFormSections] = useState(
    () => currentForm?.sections || defaultLeadFormSections,
  );

  // A form loaded after the first render replaces the blank starting point.
  useEffect(() => {
    if (currentForm?.sections) setLeadFormSections(currentForm.sections);
  }, [currentForm]);

  const [selectedBuilderFieldId, setSelectedBuilderFieldId] = useState(() => {
    const emailField = leadFormSections.flatMap((s) => s.fields).find((f) => f.id === 'email');
    return emailField?.id ?? leadFormSections[0]?.fields?.[0]?.id ?? null;
  });

  const selectedBuilderField =
    leadFormSections.flatMap((s) => s.fields).find((f) => f.id === selectedBuilderFieldId) ?? null;

  function updateLeadFormField(fieldId, updates) {
    setLeadFormSections((current) =>
      current.map((section) => ({
        ...section,
        fields: section.fields.map((field) =>
          field.id === fieldId ? { ...field, ...updates } : field
        ),
      }))
    );
  }

  function addLeadFormField(sectionId, type, index) {
    const targetSecId = sectionId || leadFormSections[0]?.id;
    const nextField = createFieldFromType(type, Date.now());
    setLeadFormSections((current) =>
      current.map((section) => {
        if (section.id !== targetSecId) return section;
        const nextFields = [...section.fields];
        const insertAt = typeof index === 'number' ? index : nextFields.length;
        nextFields.splice(insertAt, 0, nextField);
        return { ...section, fields: nextFields };
      })
    );
    setSelectedBuilderFieldId(nextField.id);
  }

  function removeLeadFormField(fieldId) {
    const allFields = leadFormSections.flatMap((s) => s.fields);
    const filtered = allFields.filter((f) => f.id !== fieldId);
    setLeadFormSections((current) =>
      current.map((section) => ({
        ...section,
        fields: section.fields.filter((f) => f.id !== fieldId),
      }))
    );
    setSelectedBuilderFieldId(filtered[0]?.id ?? null);
  }

  function moveLeadFormField(fieldId, targetSectionId, targetIndex) {
    setLeadFormSections((current) => {
      let movingField = null;
      const stripped = current.map((section) => ({
        ...section,
        fields: section.fields.filter((f) => {
          if (f.id === fieldId) {
            movingField = f;
            return false;
          }
          return true;
        }),
      }));
      if (!movingField) return current;
      return stripped.map((section) => {
        if (section.id !== targetSectionId) return section;
        const nextFields = [...section.fields];
        const insertAt = typeof targetIndex === 'number' ? targetIndex : nextFields.length;
        nextFields.splice(insertAt, 0, movingField);
        return { ...section, fields: nextFields };
      });
    });
    setSelectedBuilderFieldId(fieldId);
  }

  function addLeadFormSection() {
    const nextSectionId = `custom-section-${Date.now()}`;
    setLeadFormSections((current) => [
      ...current,
      { id: nextSectionId, title: `New Section ${current.length + 1}`, fields: [] },
    ]);
  }

  function removeLeadFormSection(sectionId) {
    const remaining = leadFormSections.filter((section) => section.id !== sectionId);
    if (remaining.length === 0) return;
    setLeadFormSections(remaining);
    const nextField = remaining.flatMap((section) => section.fields)[0];
    setSelectedBuilderFieldId(nextField?.id ?? null);
  }

  function updateLeadFormSectionTitle(sectionId, newTitle) {
    setLeadFormSections((current) =>
      current.map((section) => (section.id === sectionId ? { ...section, title: newTitle } : section))
    );
  }

  function duplicateLeadFormSection(sectionId) {
    setLeadFormSections((current) => {
      const targetSec = current.find((s) => s.id === sectionId);
      if (!targetSec) return current;
      const newSecId = `custom-section-${Date.now()}`;
      const clonedFields = (targetSec.fields || []).map((f, i) => ({
        ...f,
        id: `field-${Date.now()}-${i}`,
      }));
      const newSec = {
        ...targetSec,
        id: newSecId,
        title: `${targetSec.title} (Copy)`,
        fields: clonedFields,
      };
      const idx = current.findIndex((s) => s.id === sectionId);
      const next = [...current];
      next.splice(idx + 1, 0, newSec);
      return next;
    });
  }

  const [saveSuccess, setSaveSuccess] = useState(false);

  function openLeadCreateForm() {
    // Save first, so the capture page renders what is on screen here.
    // The in-progress form id travels in router state so preview always
    // shows this form, even when a different form is toggled on.
    persistSections();
    navigate('/crm/leads/create-form', { state: { formId: currentForm?.id || formId } });
  }

  function persistSections() {
    const forms = loadForms(LEAD_FORM);
    // When the builder was opened with no formId and no toggled-on form,
    // `targetId` used to be `null` — saving `{ id: null }` meant the next
    // load fell back to `defaultLeadFormSections` (with Email back in it).
    // Generate a real local id and toggle it on instead.
    let targetId = currentForm?.id || formId;
    if (!targetId) {
      targetId = `lead-form-${Date.now()}`;
      setActiveFormId(targetId);
    }
    const updated = forms.some((f) => f.id === targetId)
      ? forms.map((f) => (f.id === targetId ? { ...f, sections: leadFormSections } : f))
      : [...forms, { id: targetId, name: currentForm?.name || 'Lead create form', sections: leadFormSections }];
    saveForms(updated, LEAD_FORM);
  }

  function saveLeadForm() {
    persistSections();
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      navigate('/crm/leads/forms');
    }, 600);
  }

  return (
    <LeadFormBuilder
      sections={leadFormSections}
      selectedFieldId={selectedBuilderFieldId}
      selectedField={selectedBuilderField}
      onSelectField={setSelectedBuilderFieldId}
      onUpdateField={updateLeadFormField}
      onAddField={addLeadFormField}
      onRemoveField={removeLeadFormField}
      onMoveField={moveLeadFormField}
      onAddSection={addLeadFormSection}
      onRemoveSection={removeLeadFormSection}
      onUpdateSectionTitle={updateLeadFormSectionTitle}
      onDuplicateSection={duplicateLeadFormSection}
      onPreview={openLeadCreateForm}
      onSaveAndOpen={saveLeadForm}
      saveSuccess={saveSuccess}
      formTitle={currentForm?.name}
    />
  );
}
