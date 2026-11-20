import { useEffect, useState } from 'react';
import { useCrmStore } from '../../../stores/crmStore';
import { DynamicField, getActiveLeadFormSections } from './CreateLeadModal';
import SalespersonSelect from '../../../components/common/SalespersonSelect';
import MasterSourceLink from '../../../components/common/MasterSourceLink';
import { Percent } from 'lucide-react';

/**
 * Edit renders the SAME active form sections as Create, prefilled from the
 * lead row — so the two dialogs can never drift apart again (custom builder
 * fields included). Nothing extra is appended: status changes belong to the
 * pipeline (Close/Reopen, detail page), not this form.
 */

function buildInitialValues(lead, sections, sources, team) {
  const values = {};
  if (!lead) return values;
  const allFields = (sections || []).flatMap((s) => s.fields || []);
  const labelOf = (f) => String(f?.label || '').toLowerCase();
  const fieldBy = (id, re) =>
    allFields.find((f) => f.id === id) || (re ? allFields.find((f) => re.test(labelOf(f))) : undefined);
  const set = (id, re, value) => {
    const f = fieldBy(id, re);
    if (f) values[f.id] = value ?? '';
  };

  set('lead-name', /^\s*lead\s*name\s*$/i, lead.name ?? '');
  set('company', /comp/, lead.company ?? '');
  set('email', /^\s*e-?mail\s*$/i, lead.email ?? '');
  set('phone', /^\s*phone\s*$/i, lead.phone ? (String(lead.phone).startsWith('+91') ? lead.phone : `+91 ${lead.phone}`) : '+91 ');
  set('title', /^\s*title\s*$/i, lead.jobTitle ?? lead.title ?? '');
  set('industry', /^\s*industry\s*$/i, lead.industry ?? '');
  set('created-on', /creat\w*\s*on/, lead.createdOn ?? '');
  set('task-date', /task\s*date/, lead.customValues?.taskDate ?? '');
  set('task-time', /task\s*time/, lead.customValues?.taskTime ?? '');
  set('products', /products?/, lead.customValues?.products ?? []);
  set('lead-users', /lead\s*users?/, lead.customValues?.leadUsers ?? []);
  set('lead-photo', /photo|image/, lead.photo ?? lead.customValues?.photo ?? '');
  values['salesperson_id'] = lead.salespersonId || lead.customValues?.salesperson_id || lead.customValues?.fields?.salesperson_id || '';
  values['salesperson_name'] = lead.salespersonName || lead.customValues?.salesperson_name || lead.customValues?.fields?.salesperson_name || '';
  values['salesperson_commission_basis'] = lead.customValues?.salesperson_commission_basis || lead.customValues?.fields?.salesperson_commission_basis || 'percent';
  values['salesperson_commission_rate'] = lead.customValues?.salesperson_commission_rate || lead.customValues?.fields?.salesperson_commission_rate || '';
  values['salesperson_notes'] = lead.customValues?.salesperson_notes || lead.customValues?.fields?.salesperson_notes || '';

  const sourceField = fieldBy('lead-source', /source/);
  if (sourceField) {
    const match = (sources || []).find(
      (s) => String(s.id) === String(lead.sourceId) || String(s.name) === String(lead.source),
    );
    values[sourceField.id] = match?.id ?? lead.source ?? '';
  }
  const ownerField = fieldBy('lead-owner', /owner/);
  if (ownerField) {
    const match = (team || []).find(
      (m) => String(m.id) === String(lead.ownerId) || String(m.name) === String(lead.owner),
    );
    values[ownerField.id] = match?.id ?? lead.owner ?? '';
  }
  // Any other builder field lives in customValues.fields keyed by field id.
  // Also heals rows saved before a label typo (e.g. "Compnay") was mapped:
  // if the row column is empty but a custom value exists for this field,
  // prefer the stored custom value so nothing the user typed is lost.
  const knownIds = new Set(allFields.map((f) => f.id));
  for (const field of allFields) {
    const current = values[field.id];
    if (current !== undefined && current !== '' && !(Array.isArray(current) && current.length === 0)) continue;
    const fromFields = lead.customValues?.fields?.[field.id];
    const fromTop = lead.customValues?.[field.id];
    const healed = fromFields ?? fromTop ?? lead[field.id] ?? '';
    if (healed !== '' && !(Array.isArray(healed) && healed.length === 0)) {
      values[field.id] = healed;
    } else if (current === undefined) {
      values[field.id] = healed;
    }
  }
  void knownIds;
  return values;
}

export default function EditLeadModal({ lead, isOpen, onClose, onSave }) {
  // Subscribe so both dialogs rebuild when the form builder saves.
  useCrmStore((s) => s.forms);
  const sections = getActiveLeadFormSections();
  const sources = useCrmStore((s) => s.sources);
  const team = useCrmStore((s) => s.teamMembers);

  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  // Duplicate-submission guard + backend error surface for the async save.
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && lead) {
      useCrmStore.getState().refresh("sources").catch(() => {});
      setValues(buildInitialValues(lead, sections, sources, team));
      setError('');
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lead?.id]);

  if (!isOpen || !lead) return null;

  const allFields = sections.flatMap((s) => s.fields || []);
  const labelOf = (f) => String(f?.label || '').toLowerCase();
  const fieldBy = (id, re) =>
    allFields.find((f) => f.id === id) || (re ? allFields.find((f) => re.test(labelOf(f))) : undefined);
  const nameField = fieldBy('lead-name', /^\s*lead\s*name\s*$/i);
  const isValid = String(values[nameField?.id] ?? '').trim() !== '';

  function handleChange(fieldId, val) {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
  }

  async function handleSave() {
    if (saving) return;
    const get = (id) => values[id] ?? '';
    const getValue = (id, re) => {
      const f = fieldBy(id, re);
      return f ? get(f.id) : '';
    };
    const trimmedName = String(getValue('lead-name', /^\s*lead\s*name\s*$/i)).trim();
    if (!trimmedName) {
      setError('Lead name is required.');
      return;
    }
    const sourceField = fieldBy('lead-source', /source/);
    const ownerField = fieldBy('lead-owner', /owner/);
    const usersField = fieldBy('lead-users', /lead\s*users?/);
    const photoField = fieldBy('lead-photo', /photo|image/);
    const productsField = fieldBy('products', /products?/);
    const rawSource = sourceField ? String(get(sourceField.id) || '') : '';
    // Only a real store row may travel as sourceId (the API field is a PK).
    const storeSource = (sources || []).find(
      (s) => String(s.id) === rawSource || String(s?.name || "").trim().toLowerCase() === rawSource.trim().toLowerCase()
    ) || null;
    const ownerId = ownerField ? get(ownerField.id) : '';
    const fieldValues = { ...values };
    if (photoField?.id) delete fieldValues[photoField.id];

    // The parent save is async (PATCH `/crm/leads/{id}/`) and reports backend
    // validation failures by throwing. Stay open on failure so the user can
    // fix the field; close only when the save resolves.
    setSaving(true);
    setError('');
    try {
      await onSave?.(lead.id, {
        name: trimmedName,
        company: String(getValue('company', /comp/)).trim(),
        email: String(getValue('email', /^\s*e-?mail\s*$/i)).trim(),
        phone: (() => {
        const p = String(getValue('phone', /^\s*phone\s*$/i) ?? '').trim();
        return (p !== '+91' && p !== '+91 ') ? p : '';
      })(),
        sourceId: storeSource ? storeSource.id : undefined,
        source: sourceField ? (storeSource ? storeSource.name : rawSource) : lead.source,
        ownerId: ownerId || undefined,
        owner: ownerField
          ? ((team || []).find((m) => String(m.id) === String(ownerId))?.name ?? String(ownerId))
          : lead.owner,
        jobTitle: String(getValue('title', /^\s*title\s*$/i)).trim(),
        industry: String(getValue('industry', /^\s*industry\s*$/i)).trim(),
        createdOn: String(getValue('created-on', /creat\w*\s*on/)).trim(),
        photo: photoField ? get(photoField.id) : lead.photo,
        customValues: {
          ...(lead.customValues || {}),
          products: (productsField ? get(productsField.id) : '') || [],
          leadUsers: (usersField ? get(usersField.id) : '') || [],
          taskDate: String(getValue('task-date', /task\s*date/)),
          taskTime: String(getValue('task-time', /task\s*time/)),
          photo: photoField ? get(photoField.id) : lead.customValues?.photo,
          salesperson_id: values.salesperson_id || undefined,
          salesperson_name: values.salesperson_name || undefined,
          salesperson_commission_basis: values.salesperson_commission_rate ? (values.salesperson_commission_basis || 'percent') : undefined,
          salesperson_commission_rate: values.salesperson_commission_rate || undefined,
          salesperson_notes: values.salesperson_notes || undefined,
          fields: {
            ...fieldValues,
            salesperson_id: values.salesperson_id || undefined,
            salesperson_name: values.salesperson_name || undefined,
            salesperson_commission_basis: values.salesperson_commission_rate ? (values.salesperson_commission_basis || 'percent') : undefined,
            salesperson_commission_rate: values.salesperson_commission_rate || undefined,
            salesperson_notes: values.salesperson_notes || undefined,
          },
        },
      });
    } catch (err) {
      setError(err?.message || 'Lead not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit lead ${lead.name || ''}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Edit Lead Information</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Update the lead details for {lead.name || 'this lead'}
            </p>
          </div>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            onClick={onClose}
            aria-label="Close edit lead dialog"
          >
            ×
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sections.map((section) => (
            <div key={section.id} style={{ gridColumn: '1 / -1', display: 'contents' }}>
              {sections.length > 1 && (
                <h3 className="lead-create-section-title" style={{ gridColumn: '1 / -1' }}>
                  {section.title}
                </h3>
              )}
              {section.fields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  values={values}
                  onChange={handleChange}
                  sources={sources}
                  userOptions={team}
                />
              ))}
            </div>
          ))}

                    {/* Salesperson Assignment & Attribution (Requirement §1) */}
          <div className="col-span-full bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-3">
            <div className="text-xs font-bold text-emerald-950 uppercase tracking-wide flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Percent size={15} className="text-emerald-600" />
                Salesperson Attribution & Incentive
              </span>
              <MasterSourceLink source="salespeople" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Salesperson
                </label>
                <SalespersonSelect
                  value={values.salesperson_id || ''}
                  name={values.salesperson_name || ''}
                  onChange={(person) => setValues((prev) => ({
                    ...prev,
                    salesperson_id: person.id,
                    salesperson_name: person.name,
                  }))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Commission Basis</label>
                <select
                  value={values.salesperson_commission_basis || 'percent'}
                  onChange={(e) => setValues((prev) => ({ ...prev, salesperson_commission_basis: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
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
                  min="0"
                  step="any"
                  placeholder="e.g. 2.0 or 2.50"
                  value={values.salesperson_commission_rate ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, salesperson_commission_rate: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                />
              </div>
            </div>
            {lead.assignmentHistory && lead.assignmentHistory.length > 0 && (
              <div className="text-[11px] text-slate-500 pt-2 border-t border-emerald-200">
                <span className="font-semibold text-slate-700">Assignment History: </span>
                {lead.assignmentHistory.map((h, i) => (
                  <span key={i} className="inline-block mr-2">
                    {h.previous_salesperson_name ? `${h.previous_salesperson_name} → ` : ''}
                    <b>{h.new_salesperson_name || 'Assigned'}</b> ({h.assigned_at ? new Date(h.assigned_at).toLocaleDateString() : 'N/A'})
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="sm:col-span-2 text-xs font-semibold text-rose-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-xl">
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            onClick={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
