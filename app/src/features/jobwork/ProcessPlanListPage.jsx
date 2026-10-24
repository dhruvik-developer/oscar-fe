import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus,
  Eye,
  Pencil,
  MoreHorizontal,
  Calendar,
  Trash2,
  Copy,
  Printer,
  ChevronDown,
  X,
} from 'lucide-react';
import { numIN, toDDMMYYYY, purgeLegacyJobWorkCache } from './jobWorkOrdersStore';
import PageHeader from '../../components/ui/PageHeader';
import TablePagination from '../../components/ui/TablePagination';
import { useERP } from '../../context/ERPContext';
import { api } from '../../services/api';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import { fetchPlans, createPlan, updatePlan, deletePlan, errorMessage } from '../../services/jobWorkSync';

export { toDDMMYYYY, numIN };

// Phase 2 turns process / category into configurable masters.
export const PROCESS_OPTIONS = ['Dyeing', 'Printing', 'Bleaching', 'Finishing', 'Washing', 'Coating'];
export const PROCESS_CATEGORY_OPTIONS = ['Colouring', 'Bleaching', 'Pre-treatment', 'Post-treatment', 'Printing', 'Finishing'];
/** Backend ProcessPlan.STATUSES. */
export const PLAN_STATUSES = ['Draft', 'Active', 'Completed'];

const rowsOf = (body) => (Array.isArray(body) ? body : body?.results || []);

/**
 * Real option lists for the plan form: vendors / processors from the party
 * master (ERPContext), fabric items from the item master, employees from
 * /hrms/employees/.
 */
export function useJobWorkLookups() {
  const { vendors = [], items = [] } = useERP();
  const [employees, setEmployees] = useState([]);
  const [employeeError, setEmployeeError] = useState('');
  const [processes, setProcesses] = useState([]);
  useEffect(() => {
    let live = true;
    api.get('/hrms/employees/', { query: { limit: 500 } })
      .then((body) => {
        if (live) setEmployees(rowsOf(body).map((e) => ({ id: e.id, name: e.name || '' })).filter((e) => e.name));
      })
      .catch((err) => { if (live) setEmployeeError(errorMessage(err, 'Could not load employees.')); });

    api.get('/masters/processes/', { query: { limit: 200 } })
      .then((body) => {
        if (live) {
          const list = rowsOf(body);
          if (list && list.length > 0) setProcesses(list);
        }
      })
      .catch(() => {});

    return () => { live = false; };
  }, []);
  const activeVendors = useMemo(
    () => (vendors || []).filter((v) => v && v.name && v.status !== 'Inactive'),
    [vendors],
  );
  return { vendors: activeVendors, items: items || [], employees, employeeError, processes };
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDaysISO = (iso, days) => {
  const base = /^\d{4}-\d{2}-\d{2}/.test(iso || '') ? new Date(`${iso}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return todayISO();
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
};

export const statusPill = (s) => {
  if (s === 'Active') return 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]';
  if (s === 'Draft' || s === 'Pending') return 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]';
  if (s === 'Completed') return 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]';
  return 'bg-slate-50 text-slate-600 border-slate-200';
};

export const calculateReturnQty = (qty, loss) => {
  const q = Number(qty) || 0;
  const l = Number(loss) || 0;
  if (!q) return '';
  const calculated = q * (1 - l / 100);
  return String(Math.round(calculated * 100) / 100);
};

// ─────────────────────────────────────────────────────────────
// REUSABLE PROCESS PLAN FORM (matching Screenshot 2)
// ─────────────────────────────────────────────────────────────
export function ProcessPlanForm({
  title,
  initial = {},
  isEdit = false,
  plans = [],
  onSave,
  onClose,
  isModal = false,
}) {
  const navigate = useNavigate();

  const { vendors, items, employees, employeeError, processes } = useJobWorkLookups();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const processList = useMemo(() => {
    if (processes && processes.length > 0) {
      return processes.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category || '',
        expectedLossPct: p.expected_loss_pct ?? p.expectedLossPct ?? 0,
        tolerancePct: p.tolerance_pct ?? p.tolerancePct ?? 0,
      }));
    }
    return PROCESS_OPTIONS.map((name) => ({ id: name, name, category: '', expectedLossPct: 0, tolerancePct: 0 }));
  }, [processes]);

  const processCategoryList = useMemo(() => {
    const fromProcesses = processList.map((p) => p.category).filter(Boolean);
    return [...new Set([...PROCESS_CATEGORY_OPTIONS, ...fromProcesses])];
  }, [processList]);

  const [form, setForm] = useState(() => ({
    planNo: initial.planNo || '',
    date: initial.date || todayISO(),
    process: initial.process || (processes[0]?.name || PROCESS_OPTIONS[0]),
    processCategory: initial.processCategory || '',
    vendor: initial.vendor || '',
    contactPerson: initial.contactPerson || '',
    phone: initial.phone || '',
    email: initial.email || '',
    address: initial.address || '',
    fabricItem: initial.fabricItem || '',
    greyLotNo: initial.greyLotNo || '',
    fabricQuality: initial.fabricQuality || '',
    takaRollNo: initial.takaRollNo || initial.takaRoll || '',
    shade: initial.shade || '',
    plannedQty: String(initial.plannedQty ?? initial.expectedQty ?? ''),
    expectedLoss: String(initial.expectedLoss ?? ''),
    expectedReturnQty: String(initial.expectedReturnQty ?? ''),
    takaRoll: initial.takaRoll || initial.takaRollNo || '',
    weight: String(initial.weight || ''),
    finishedWeight: String(initial.finishedWeight || ''),
    noOfRolls: String(initial.noOfRolls || ''),
    startDate: initial.startDate || '',
    expectedCompletionDate: initial.expectedCompletionDate || initial.targetDate || '',
    assignedEmployee: initial.assignedEmployee || '',
    approver: initial.approver || '',
    status: initial.status || 'Active',
    remarks: initial.remarks || '',
  }));

  const handleProcessChange = (e) => {
    const name = e.target.value;
    const found = processList.find((p) => p.name === name);
    setForm((prev) => {
      const nextLoss = found && Number(found.expectedLossPct) > 0 ? String(found.expectedLossPct) : prev.expectedLoss;
      return {
        ...prev,
        process: name,
        processCategory: found?.category || prev.processCategory,
        expectedLoss: nextLoss,
        expectedReturnQty: calculateReturnQty(prev.plannedQty, nextLoss),
      };
    });
  };

  const vendorNames = useMemo(() => {
    const names = vendors.map((v) => v.name);
    if (form.vendor && !names.includes(form.vendor)) names.unshift(form.vendor);
    return names;
  }, [vendors, form.vendor]);
  const fabricNames = useMemo(() => {
    const names = [...new Set(items.map((it) => it.name).filter(Boolean))];
    if (form.fabricItem && !names.includes(form.fabricItem)) names.unshift(form.fabricItem);
    return names;
  }, [items, form.fabricItem]);
  const qualityOptions = useMemo(() => [...new Set(items.map((it) => it.fabricQuality).filter(Boolean))], [items]);
  const shadeOptions = useMemo(() => [...new Set(items.map((it) => it.fabricColor).filter(Boolean))], [items]);
  const employeeNames = useMemo(() => {
    const names = employees.map((e) => e.name);
    [form.assignedEmployee, form.approver].forEach((n) => { if (n && !names.includes(n)) names.unshift(n); });
    return names;
  }, [employees, form.assignedEmployee, form.approver]);

  const handleVendorChange = (e) => {
    const v = e.target.value;
    const party = vendors.find((x) => x.name === v) || {};
    setForm((prev) => ({
      ...prev,
      vendor: v,
      contactPerson: party.contactPerson || '',
      phone: party.phone || '',
      email: party.email || '',
      address: party.address || '',
    }));
  };

  const handleFabricChange = (e) => {
    const name = e.target.value;
    const item = items.find((it) => it.name === name) || {};
    setForm((prev) => ({
      ...prev,
      fabricItem: name,
      fabricQuality: item.fabricQuality || prev.fabricQuality,
      shade: item.fabricColor || prev.shade,
    }));
  };

  const handleQtyChange = (e) => {
    const q = e.target.value;
    setForm((prev) => ({
      ...prev,
      plannedQty: q,
      expectedReturnQty: calculateReturnQty(q, prev.expectedLoss),
    }));
  };

  const handleLossChange = (e) => {
    const l = e.target.value;
    setForm((prev) => ({
      ...prev,
      expectedLoss: l,
      expectedReturnQty: calculateReturnQty(prev.plannedQty, l),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError('');
    const plannedQtyNum = Number(form.plannedQty) || 0;
    if (!(plannedQtyNum > 0)) {
      setSaveError('Planned Quantity (M) must be greater than 0.');
      return;
    }
    if (!form.vendor) { setSaveError('Select a vendor / processor.'); return; }
    if (!form.fabricItem) { setSaveError('Select a fabric item.'); return; }
    const lossNum = Number(form.expectedLoss) || 0;
    const returnNum = Number(form.expectedReturnQty) || (plannedQtyNum * (1 - lossNum / 100));

    const payload = {
      date: form.date,
      process: form.process,
      processCategory: form.processCategory,
      vendor: form.vendor,
      contactPerson: form.contactPerson,
      phone: form.phone,
      fabricItem: form.fabricItem,
      greyLotNo: form.greyLotNo,
      fabricQuality: form.fabricQuality,
      takaRollNo: form.takaRollNo,
      shade: form.shade,
      plannedQty: plannedQtyNum,
      expectedQty: plannedQtyNum,
      expectedLoss: lossNum,
      expectedReturnQty: returnNum,
      takaRoll: form.takaRoll,
      weight: Number(form.weight) || 0,
      finishedWeight: Number(form.finishedWeight) || 0,
      noOfRolls: Number(form.noOfRolls) || 0,
      startDate: form.startDate,
      expectedCompletionDate: form.expectedCompletionDate,
      targetDate: form.expectedCompletionDate,
      assignedEmployee: form.assignedEmployee,
      approver: form.approver,
      status: form.status,
      remarks: form.remarks,
    };

    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(payload);
    } catch (err) {
      setSaveError(errorMessage(err, 'Could not save the process plan.'));
    } finally {
      setSaving(false);
    }
  };

  const formBody = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ── ROW 1: Basic Info, Processor/Vendor, Material Details ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Card 1: Basic Information */}
        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
          <h3 className="mb-3 text-[13px] font-bold text-[#2563eb]">Basic Information</h3>
          <div className="space-y-3 text-[12px]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Process Plan No. <span className="text-rose-500">*</span>
                </label>
                <input
                  readOnly
                  value={form.planNo}
                  placeholder="Auto-generated on save"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-medium text-slate-700 outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Plan Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-600">
                    Process <span className="text-rose-500">*</span>
                  </label>
                  <MasterSourceLink source="processes" />
                </div>
                <select
                  required
                  value={form.process}
                  onChange={handleProcessChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none focus:border-blue-400"
                >
                  {processList.map((o) => (
                    <option key={o.id || o.name} value={o.name}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Process Category</label>
                <select
                  value={form.processCategory}
                  onChange={(e) => setForm({ ...form, processCategory: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none focus:border-blue-400"
                >
                  <option value="">Select Category</option>
                  {processCategoryList.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Processor / Vendor */}
        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
          <h3 className="mb-3 text-[13px] font-bold text-[#2563eb]">Processor / Vendor</h3>
          <div className="space-y-3 text-[12px]">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-600">
                  Vendor / Processor <span className="text-rose-500">*</span>
                </label>
                <MasterSourceLink source="vendors" />
              </div>
              <select
                required
                value={form.vendor}
                onChange={handleVendorChange}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none focus:border-blue-400"
              >
                <option value="">Select Vendor</option>
                {vendorNames.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Contact Person</label>
              <input
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="Contact person"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-800 outline-none focus:border-blue-400"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Material Details */}
        <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
          <h3 className="mb-3 text-[13px] font-bold text-[#2563eb]">Material Details</h3>
          <div className="space-y-3 text-[12px]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-600">
                    Fabric Item <span className="text-rose-500">*</span>
                  </label>
                  <MasterSourceLink source="items" />
                </div>
                <select
                  required
                  value={form.fabricItem}
                  onChange={handleFabricChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none focus:border-blue-400"
                >
                  <option value="">Select Fabric Item</option>
                  {fabricNames.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Grey Lot No.</label>
                <input
                  value={form.greyLotNo}
                  onChange={(e) => setForm({ ...form, greyLotNo: e.target.value })}
                  placeholder="e.g. LOT-001"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-800 outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Fabric Quality <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  list="pp-quality-options"
                  value={form.fabricQuality}
                  onChange={(e) => setForm({ ...form, fabricQuality: e.target.value })}
                  placeholder="Fabric quality"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none focus:border-blue-400"
                />
                <datalist id="pp-quality-options">
                  {qualityOptions.map((q) => (<option key={q} value={q} />))}
                </datalist>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Taka / Roll No.</label>
                <input
                  value={form.takaRollNo}
                  onChange={(e) => setForm({ ...form, takaRollNo: e.target.value })}
                  placeholder="e.g. T-001"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-800 outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Shade / Colour</label>
              <input
                list="pp-shade-options"
                value={form.shade}
                onChange={(e) => setForm({ ...form, shade: e.target.value })}
                placeholder="Shade / colour"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none focus:border-blue-400"
              />
              <datalist id="pp-shade-options">
                {shadeOptions.map((o) => (<option key={o} value={o} />))}
              </datalist>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Quantity Details, Timeline, Responsibility ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Card 4: Quantity Details (lg:col-span-6) */}
        <div className="lg:col-span-6 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
          <h3 className="mb-3 text-[13px] font-bold text-[#2563eb]">Quantity Details</h3>
          <div className="space-y-3 text-[12px]">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1 leading-tight">
                  Planned Quantity (M) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={form.plannedQty}
                  onChange={handleQtyChange}
                  placeholder="e.g. 25000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-800 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1 leading-tight">
                  Expected Loss (%) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.expectedLoss}
                  onChange={handleLossChange}
                  placeholder="e.g. 2.00"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-800 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1 leading-tight">
                  Expected Return Qty (M)
                </label>
                <input
                  readOnly
                  value={form.expectedReturnQty}
                  placeholder="Auto"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-slate-900 outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1 leading-tight">Taka / Roll</label>
                <input
                  value={form.takaRoll}
                  onChange={(e) => setForm({ ...form, takaRoll: e.target.value })}
                  placeholder="e.g. T-001"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-800 outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Weight (KG)</label>
                <input
                  type="number"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  placeholder="e.g. 12500"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-800 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Finished Weight (KG)</label>
                <input
                  type="number"
                  value={form.finishedWeight}
                  onChange={(e) => setForm({ ...form, finishedWeight: e.target.value })}
                  placeholder="e.g. 38500"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-800 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">No. of Rolls</label>
                <input
                  type="number"
                  value={form.noOfRolls}
                  onChange={(e) => setForm({ ...form, noOfRolls: e.target.value })}
                  placeholder="e.g. 250"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-slate-800 outline-none focus:border-blue-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 5: Timeline (lg:col-span-3) */}
        <div className="lg:col-span-3 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
          <h3 className="mb-3 text-[13px] font-bold text-[#2563eb]">Timeline</h3>
          <div className="space-y-3 text-[12px]">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Expected Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Expected Completion Date</label>
              <input
                type="date"
                value={form.expectedCompletionDate}
                onChange={(e) => setForm({ ...form, expectedCompletionDate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-400"
              />
            </div>
          </div>
        </div>

        {/* Card 6: Responsibility (lg:col-span-3) */}
        <div className="lg:col-span-3 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
          <h3 className="mb-3 text-[13px] font-bold text-[#2563eb]">Responsibility</h3>
          <div className="space-y-3 text-[12px]">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-600">Assigned Employee</label>
                <MasterSourceLink source="employees" />
              </div>
              <select
                value={form.assignedEmployee}
                onChange={(e) => setForm({ ...form, assignedEmployee: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none focus:border-blue-400"
              >
                <option value="">Select Employee</option>
                {employeeNames.map((emp) => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-600">Approver</label>
                <MasterSourceLink source="employees" />
              </div>
              <select
                value={form.approver}
                onChange={(e) => setForm({ ...form, approver: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none focus:border-blue-400"
              >
                <option value="">Select Approver</option>
                {employeeNames.map((app) => (
                  <option key={app} value={app}>{app}</option>
                ))}
              </select>
              {employeeError && <p className="mt-1 text-[11px] text-rose-600">{employeeError}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: Remarks ── */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <h3 className="mb-2 text-[13px] font-bold text-[#2563eb]">Remarks</h3>
        <textarea
          rows={2}
          value={form.remarks}
          onChange={(e) => setForm({ ...form, remarks: e.target.value })}
          placeholder="Remarks"
          className="w-full rounded-lg border border-slate-200 p-3 text-[12.5px] text-slate-800 outline-none focus:border-blue-400"
        />
      </div>

      {saveError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-600">{saveError}</div>
      )}

      {/* ── Bottom Buttons ── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-[12.5px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#2563eb] px-6 py-2 text-[12.5px] font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors shadow-2xs"
        >
          {saving ? 'Saving…' : 'Save Process Plan'}
        </button>
      </div>
    </form>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
        <div className="relative my-8 w-full max-w-5xl rounded-2xl bg-[#f4f7fb] p-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-[18px] font-bold text-[#17294e]">
              {title || (isEdit ? `Edit Process Plan — ${form.planNo}` : 'Create Process Plan')}
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          {formBody}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Title */}
      <PageHeader
        title={title || (isEdit ? `Edit Process Plan — ${form.planNo}` : 'Create Process Plan')}
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'PMS', path: '/pms' },
          { label: 'Job Work / Processing' },
          { label: 'Process Plan', path: '/job-work/process-plan' },
          { label: isEdit ? 'Edit Process Plan' : 'Create Process Plan' },
        ]}
      />

      {formBody}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROCESS PLAN LIST PAGE (matching Screenshot 1)
// ─────────────────────────────────────────────────────────────
export default function ProcessPlanListPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [processFilter, setProcessFilter] = useState('All');
  const [fabricFilter, setFabricFilter] = useState('All');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Mode: list vs create/edit
  const isCreateRoute = location.pathname.endsWith('/create');
  const [isFormOpen, setIsFormOpen] = useState(isCreateRoute);
  const [editingPlan, setEditingPlan] = useState(null);
  const [menuId, setMenuId] = useState(null);

  // Server is the source of truth: GET /jobwork/process-plans/.
  useEffect(() => {
    let live = true;
    purgeLegacyJobWorkCache();
    fetchPlans()
      .then((rows) => { if (live) setPlans(rows); })
      .catch((err) => { if (live) setLoadError(errorMessage(err, 'Could not load process plans.')); })
      .finally(() => { if (live) setLoading(false); });
    return () => {
      live = false;
    };
  }, []);

  // Sync form open state with route if directly accessed via /create or ?edit=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editId = params.get('edit');
    if (editId) {
      const p = plans.find((x) => String(x.id) === String(editId));
      if (p) {
        setEditingPlan(p);
        setIsFormOpen(true);
      }
    } else if (isCreateRoute && !isFormOpen) {
      setEditingPlan(null);
      setIsFormOpen(true);
    }
  }, [location.search, isCreateRoute, plans]);

  const { processes: masterProcesses } = useJobWorkLookups();
  const processes = useMemo(() => [
    'All',
    ...new Set([...(masterProcesses?.map((p) => p.name) || []), ...PROCESS_OPTIONS, ...plans.map((p) => p.process)].filter(Boolean))
  ], [masterProcesses, plans]);
  const fabrics = useMemo(() => ['All', ...new Set(plans.map((p) => p.fabricItem).filter(Boolean))], [plans]);
  const vendors = useMemo(() => ['All', ...new Set(plans.map((p) => p.vendor).filter(Boolean))], [plans]);

  const filteredRows = useMemo(() => {
    return plans.filter((p) => {
      if (processFilter !== 'All' && p.process !== processFilter) return false;
      if (fabricFilter !== 'All' && p.fabricItem !== fabricFilter) return false;
      if (vendorFilter !== 'All' && p.vendor !== vendorFilter) return false;
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if ((fromDate || toDate) && /^\d{4}-\d{2}-\d{2}/.test(p.date || '')) {
        if (fromDate && p.date < fromDate) return false;
        if (toDate && p.date > toDate) return false;
      }
      return true;
    });
  }, [plans, processFilter, fabricFilter, vendorFilter, statusFilter, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
  }, [processFilter, fabricFilter, vendorFilter, statusFilter, fromDate, toDate]);

  const pagedPlans = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingPlan(p);
    setIsFormOpen(true);
    setMenuId(null);
  };

  const handleCancelForm = () => {
    setIsFormOpen(false);
    setEditingPlan(null);
    if (isCreateRoute) {
      navigate('/job-work/process-plan');
    }
  };

  // Throws on failure so the form shows the error and stays open.
  const handleSaveForm = async (payload) => {
    if (editingPlan) {
      const saved = await updatePlan(editingPlan.id, { ...editingPlan, ...payload });
      setPlans((prev) => prev.map((p) => (p.id === editingPlan.id ? saved : p)));
    } else {
      const saved = await createPlan(payload);
      setPlans((prev) => [saved, ...prev]);
    }

    setIsFormOpen(false);
    setEditingPlan(null);
    if (isCreateRoute) {
      navigate('/job-work/process-plan');
    }
  };

  const handleDuplicate = async (p) => {
    setMenuId(null);
    try {
      const saved = await createPlan({
        ...p,
        status: 'Active',
        date: todayISO(),
        charges: (p.charges || []).map(({ type, description, rate, qty }) => ({ type, description, rate, qty })),
      });
      setPlans((prev) => [saved, ...prev]);
    } catch (err) {
      window.alert(errorMessage(err, 'Could not duplicate the process plan.'));
    }
  };

  const handleDelete = async (id) => {
    setMenuId(null);
    if (!window.confirm('Delete this process plan?')) return;
    try {
      await deletePlan(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      window.alert(errorMessage(err, 'Could not delete the process plan.'));
    }
  };

  // ─────────────────────────────────────────────────────────────
  // VIEW 1: Create / Edit Process Plan Screen (matching Screenshot 2)
  // ─────────────────────────────────────────────────────────────
  if (isFormOpen) {
    return (
      <ProcessPlanForm
        plans={plans}
        isEdit={!!editingPlan}
        initial={editingPlan || { date: todayISO() }}
        onSave={handleSaveForm}
        onClose={handleCancelForm}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────
  // VIEW 2: Process Plan List Screen (matching Screenshot 1)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#f4f7fb] p-3 md:p-5 space-y-3.5">
      {/* Top Header */}
      <PageHeader
        title="Process Plan"
        subtitle="Plan and manage external job work processing."
        actions={
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-[#1d4ed8] transition-colors"
          >
            <Plus size={14} className="stroke-[2.5]" /> Create Process Plan
          </button>
        }
      />

      {/* Main Container Card */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        {/* Filters Bar (matching Screenshot 1) */}
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-3.5 sm:grid-cols-3 lg:grid-cols-6 bg-[#ffffff]">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Process</label>
            <select
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-blue-400"
            >
              {processes.map((o) => (
                <option key={o} value={o}>{o === 'All' ? 'All Processes' : o}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Fabric Item</label>
            <select
              value={fabricFilter}
              onChange={(e) => setFabricFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-blue-400"
            >
              {fabrics.map((o) => (
                <option key={o} value={o}>{o === 'All' ? 'All Fabric Items' : o}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Vendor</label>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-blue-400"
            >
              {vendors.map((o) => (
                <option key={o} value={o}>{o === 'All' ? 'All Vendors' : o}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 outline-none focus:border-blue-400"
            >
              {['All', ...PLAN_STATUSES].map((o) => (
                <option key={o} value={o}>{o === 'All' ? 'All Status' : o}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* Table (matching Screenshot 1) */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
                <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                <th className="px-3.5 py-2.5">Plan No.</th>
                <th className="px-3.5 py-2.5">Date</th>
                <th className="px-3.5 py-2.5">Process</th>
                <th className="px-3.5 py-2.5">Fabric Item</th>
                <th className="px-3.5 py-2.5">Fabric Quality</th>
                <th className="px-3.5 py-2.5">Shade / Colour</th>
                <th className="px-3.5 py-2.5">Vendor</th>
                <th className="px-3.5 py-2.5 text-center">Planned Qty (M)</th>
                <th className="px-3.5 py-2.5 text-center">Expected Loss (%)</th>
                <th className="px-3.5 py-2.5 text-center">Expected Return (M)</th>
                <th className="px-3.5 py-2.5 text-center">Status</th>
                <th className="px-3.5 py-2.5 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading || loadError || filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className={`px-4 py-12 text-center text-[12.5px] ${loadError ? 'font-semibold text-rose-600' : 'text-slate-400'}`}>
                    {loading
                      ? 'Loading process plans…'
                      : loadError || 'No process plans recorded yet. Click "+ Create Process Plan" above to create one.'}
                  </td>
                </tr>
              ) : (
                pagedPlans.map((p, idx) => {
                  const pQty = Number(p.plannedQty || p.expectedQty) || 0;
                  const pLoss = Number(p.expectedLoss) || 0;
                  const pRet = Number(p.expectedReturnQty) || Math.round(pQty * (1 - pLoss / 100));
                  return (
                    <tr key={p.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-3.5 py-3 text-center text-slate-500 font-medium">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="px-3.5 py-3">
                        <button
                          onClick={() => navigate(`/job-work/process-plan/${p.id}`)}
                          className="font-mono font-semibold text-[#2563eb] underline hover:text-[#1d4ed8]"
                        >
                          {p.planNo}
                        </button>
                      </td>
                      <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap">{toDDMMYYYY(p.date)}</td>
                      <td className="px-3.5 py-3 font-semibold text-slate-800">{p.process}</td>
                      <td className="px-3.5 py-3 text-slate-700">{p.fabricItem}</td>
                      <td className="px-3.5 py-3 text-slate-700">{p.fabricQuality}</td>
                      <td className="px-3.5 py-3 text-slate-700">{p.shade || '—'}</td>
                      <td className="px-3.5 py-3 text-slate-800 font-medium">{p.vendor}</td>
                      <td className="px-3.5 py-3 text-center font-mono font-semibold text-slate-800">
                        {numIN(pQty)}
                      </td>
                      <td className="px-3.5 py-3 text-center font-mono text-slate-700">
                        {pLoss.toFixed(2)}
                      </td>
                      <td className="px-3.5 py-3 text-center font-mono font-semibold text-slate-800">
                        {numIN(pRet)}
                      </td>
                      <td className="px-3.5 py-3 text-center">
                        <span className={`inline-block rounded-md border px-2.5 py-0.5 text-[10.5px] font-bold ${statusPill(p.status)}`}>
                          {p.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            title="View Plan"
                            onClick={() => navigate(`/job-work/process-plan/${p.id}`)}
                            className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            title="Edit Plan"
                            onClick={() => handleOpenEdit(p)}
                            className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                          >
                            <Pencil size={13} />
                          </button>
                          <div className="relative">
                            <button
                              title="More options"
                              onClick={() => setMenuId(menuId === p.id ? null : p.id)}
                              className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                            >
                              <MoreHorizontal size={13} />
                            </button>
                            {menuId === p.id && (
                              <div className="absolute right-0 top-8 z-20 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left">
                                <button
                                  onClick={() => handleDuplicate(p)}
                                  className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                                >
                                  <Copy size={12} /> Duplicate
                                </button>
                                <button
                                  onClick={() => {
                                    setMenuId(null);
                                    window.print();
                                  }}
                                  className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                                >
                                  <Printer size={12} /> Print
                                </button>
                                <button
                                  onClick={() => handleDelete(p.id)}
                                  className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                                >
                                  <Trash2 size={12} /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={filteredRows.length}
            onPageChange={setPage}
            onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          />
        </div>
      </div>
    </div>
  );
}
