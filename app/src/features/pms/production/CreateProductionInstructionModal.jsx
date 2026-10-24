import React, { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { api } from '../../../services/api';
import MasterSourceLink from '../../../components/common/MasterSourceLink';

const todayISO = () => new Date().toISOString().slice(0, 10);
const rowsOf = (res) => (Array.isArray(res) ? res : res?.results || res?.data || []);

/**
 * Production Work Instruction / Production Order, created from the PMS
 * project slide before production starts (client requirement PDF section 05).
 * Same endpoint as the Production Instructions page (POST
 * /production/instructions/). Raised from the approved Vendor A Production
 * PO: the order reference is that PO number, which links the original PO,
 * the Final Job Work PO and the agency bill in the three-way match.
 */
export function CreateProductionInstructionModal({ project, po, defaultQty, onClose, onCreated }) {
  const poLine = (po?.items || po?.lineItems || [])[0] || {};
  const [agencies, setAgencies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    piDate: todayISO(),
    agencyId: '',
    fabric: poLine.name || poLine.description || '',
    processType: 'Weaving',
    orderMeter: poLine.qty ? String(poLine.qty) : (defaultQty ? String(defaultQty) : ''),
    takaCount: '',
    totalWeight: '',
    tentativeRate: '',
    agreedJobRate: poLine.rate ? String(poLine.rate) : '',
    rateUom: 'Meter',
    expectedStartDate: '',
    expectedCompletionDate: '',
    employeeId: '',
    supervisorId: '',
    specialTerms: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api.get('/masters/agencies/', { query: { page_size: 200 } }).then((r) => {
      const list = rowsOf(r);
      setAgencies(list);
      // Pre-select the agency that is the PO vendor.
      const vendorName = (po?.vendor || po?.partyName || '').trim().toLowerCase();
      const match = vendorName && list.find((a) => (a.name || '').trim().toLowerCase() === vendorName);
      if (match) setForm((f) => (f.agencyId ? f : { ...f, agencyId: String(match.id) }));
    }).catch(() => {});
    api.get('/hrms/employees/', { query: { page_size: 200, status: 'Active' } }).then((r) => setEmployees(rowsOf(r))).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.agencyId) return setError('Select the external agency.');
    if (!(Number(form.orderMeter) > 0)) return setError('Enter the order quantity (meter).');
    if (!form.employeeId) return setError('Assign the company production employee.');
    const agency = agencies.find((a) => String(a.id) === String(form.agencyId));
    const payload = {
      agencyId: form.agencyId,
      agency_name: agency?.name,
      order_reference: po?.poNumber || project?.code,
      order_meter: Number(form.orderMeter),
      taka_count: Number(form.takaCount) || 0,
      total_weight: Number(form.totalWeight) || 0,
      tentative_rate: Number(form.tentativeRate) || 0,
      agreed_job_rate: Number(form.agreedJobRate) || 0,
      rate_uom: form.rateUom,
      pi_date: form.piDate,
      fabric: form.fabric || null,
      process_type: form.processType || null,
      expectedStartDate: form.expectedStartDate || null,
      expectedCompletionDate: form.expectedCompletionDate || null,
      employeeId: form.employeeId,
      supervisorId: form.supervisorId || null,
      special_terms: form.specialTerms || null,
      notes: form.notes || '',
    };
    setSaving(true);
    try {
      const created = await api.post('/production/instructions/', payload);
      onCreated?.(created);
    } catch (err) {
      setError(err?.message || 'The production work instruction was not saved.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800';
  const label = 'block font-semibold text-slate-700 mb-1';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200 text-xs">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-amber-600" />
            <h3 className="font-extrabold text-slate-900 text-sm">Production Work Instruction</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-slate-500">
            Order reference: <strong className="text-slate-800">{po?.poNumber || project?.code}</strong> · saved as Draft. The Final Job Work PO is generated only after production is verified.
          </div>

          <fieldset className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <legend className="col-span-full font-bold text-slate-800 mb-1">Header</legend>
            <label><span className={label}>Date</span><input type="date" value={form.piDate} onChange={set('piDate')} className={field} /></label>
            <label className="sm:col-span-2"><span className="flex items-baseline justify-between"><span className={label}>External Agency</span><MasterSourceLink source="agencies" /></span>
              <select value={form.agencyId} onChange={set('agencyId')} className={field}>
                <option value="">Select…</option>
                {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label><span className={label}>Fabric Quality</span><input value={form.fabric} onChange={set('fabric')} className={field} /></label>
            <label><span className={label}>Process Type</span><input value={form.processType} onChange={set('processType')} className={field} /></label>
            <label><span className={label}>Expected Start</span><input type="date" value={form.expectedStartDate} onChange={set('expectedStartDate')} className={field} /></label>
            <label><span className={label}>Expected Completion</span><input type="date" value={form.expectedCompletionDate} onChange={set('expectedCompletionDate')} className={field} /></label>
          </fieldset>

          <fieldset className="grid grid-cols-3 gap-3">
            <legend className="col-span-full font-bold text-slate-800 mb-1">Quantity</legend>
            <label><span className={label}>Order Meter</span><input type="number" min="0" step="0.01" value={form.orderMeter} onChange={set('orderMeter')} className={`${field} font-mono`} /></label>
            <label><span className={label}>Taka / Roll Count</span><input type="number" min="0" value={form.takaCount} onChange={set('takaCount')} className={`${field} font-mono`} /></label>
            <label><span className={label}>Weight (kg)</span><input type="number" min="0" step="0.01" value={form.totalWeight} onChange={set('totalWeight')} className={`${field} font-mono`} /></label>
          </fieldset>

          <fieldset className="grid grid-cols-3 gap-3">
            <legend className="col-span-full font-bold text-slate-800 mb-1">Commercial</legend>
            <label><span className={label}>Tentative Rate (₹)</span><input type="number" min="0" step="0.01" value={form.tentativeRate} onChange={set('tentativeRate')} className={`${field} font-mono`} /></label>
            <label><span className={label}>Agreed Rate (₹)</span><input type="number" min="0" step="0.01" value={form.agreedJobRate} onChange={set('agreedJobRate')} className={`${field} font-mono`} /></label>
            <label><span className={label}>Rate UOM</span>
              <select value={form.rateUom} onChange={set('rateUom')} className={field}>
                <option>Meter</option><option>Kg</option><option>Taka</option>
              </select>
            </label>
            <label className="col-span-full"><span className={label}>Special Terms</span><input value={form.specialTerms} onChange={set('specialTerms')} className={field} /></label>
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="col-span-full font-bold text-slate-800 mb-1">Responsibility</legend>
            <label><span className="flex items-baseline justify-between"><span className={label}>Company Production Employee</span><MasterSourceLink source="employees" /></span>
              <select value={form.employeeId} onChange={set('employeeId')} className={field}>
                <option value="">Select…</option>
                {employees.map((em) => <option key={em.id} value={em.id}>{em.name}{em.employeeCode ? ` (${em.employeeCode})` : ''}</option>)}
              </select>
            </label>
            <label><span className="flex items-baseline justify-between"><span className={label}>Supervisor / Approver</span><MasterSourceLink source="employees" /></span>
              <select value={form.supervisorId} onChange={set('supervisorId')} className={field}>
                <option value="">—</option>
                {employees.map((em) => <option key={em.id} value={em.id}>{em.name}</option>)}
              </select>
            </label>
          </fieldset>

          <label className="block"><span className={label}>Remarks</span><textarea rows={2} value={form.notes} onChange={set('notes')} className={field} /></label>
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-100 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold">Cancel</button>
          <button type="submit" disabled={saving} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-60">
            {saving ? 'Saving…' : 'Create Instruction'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateProductionInstructionModal;
