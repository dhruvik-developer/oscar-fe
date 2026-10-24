import React, { useMemo, useState } from 'react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { usePmsStore, nextProjectId, getProjectManagers } from '../../../../stores/pmsStore';
import { useERP } from '../../../../context/ERPContext';
import { formatCurrency } from '../../../../utils/currencyUtils';
import { AlertCircle, Link2, PackageCheck } from 'lucide-react';
import MasterSourceLink from '../../../../components/common/MasterSourceLink';

/**
 * CreateProjectModal — turns a confirmed CRM/ERP sales order into a project.
 *
 * Orders come from the ERP sales orders the server returned, and
 * any order already linked to a project is excluded so the same order cannot be
 * converted twice. Selecting an order auto-fills customer, product and value.
 */

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const fieldClass =
  'w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1.5';

function todayLocalDate() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function CreateProjectModal({ isOpen, onClose, onCreated, initialOrderNumber = '' }) {
  const projects = usePmsStore((s) => s.projects);
  const stageConfigs = usePmsStore((s) => s.stageConfigs);
  const employees = usePmsStore((s) => s.employees);
  const createProjectFromOrder = usePmsStore((s) => s.createProjectFromOrder);
  const showToast = usePmsStore((s) => s.showToast);
  // The sales orders a project can be created from, as the server returned them.
  const { salesOrders = [] } = useERP() || {};

  const activeConfigs = useMemo(
    () => stageConfigs.filter((c) => c.isActive).sort((a, b) => a.sequence - b.sequence),
    [stageConfigs]
  );
  const managers = useMemo(() => getProjectManagers(employees), [employees]);

  // An order already converted into a project cannot be converted twice, but it
  // still appears in the list — disabled, naming the project that owns it — so
  // an empty dropdown never looks like a loading failure.
  const { availableOrders, linkedOrders } = useMemo(() => {
    const linkedBy = new Map();
    for (const p of projects) {
      if (p.crmOrderId) linkedBy.set(p.crmOrderId, p.id);
    }
    return {
      availableOrders: salesOrders.filter((o) => !linkedBy.has(o.orderNumber)),
      linkedOrders: salesOrders
        .filter((o) => linkedBy.has(o.orderNumber))
        .map((o) => ({ ...o, linkedProjectId: linkedBy.get(o.orderNumber) })),
    };
  }, [projects, salesOrders]);

  function distributeEvenly(ids) {
    if (!ids || ids.length === 0) return {};
    const equal = Math.floor(100 / ids.length);
    const remainder = 100 - equal * ids.length;
    const map = {};
    ids.forEach((id, idx) => {
      map[id] = idx === ids.length - 1 ? equal + remainder : equal;
    });
    return map;
  }

  const [orderNumber, setOrderNumber] = useState(initialOrderNumber || '');
  React.useEffect(() => {
    if (initialOrderNumber && isOpen) {
      setOrderNumber(initialOrderNumber);
    }
  }, [initialOrderNumber, isOpen]);
  const [managerId, setManagerId] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [startDate, setStartDate] = useState(todayLocalDate());
  const [specifications, setSpecifications] = useState('');
  const [selectedConfigIds, setSelectedConfigIds] = useState(() => activeConfigs.map((c) => c.id));
  const [stagePercentages, setStagePercentages] = useState(() =>
    distributeEvenly(activeConfigs.map((c) => c.id))
  );
  const [errors, setErrors] = useState({});

  const selectedOrder = availableOrders.find((o) => o.orderNumber === orderNumber) ?? null;
  const projectCode = useMemo(() => nextProjectId(projects), [projects]);

  const totalPercentage = useMemo(() => {
    return selectedConfigIds.reduce(
      (acc, id) => acc + (Number(stagePercentages[id]) || 0),
      0
    );
  }, [selectedConfigIds, stagePercentages]);

  function toggleConfig(id) {
    setSelectedConfigIds((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      // Automatically rebalance percentages among active selections
      setStagePercentages(distributeEvenly(next));
      return next;
    });
  }

  function handlePercentageChange(id, val) {
    const num = val === '' ? '' : Math.max(0, Math.min(100, Number(val)));
    setStagePercentages((prev) => ({
      ...prev,
      [id]: num,
    }));
  }

  function handleDistributeEvenly() {
    setStagePercentages(distributeEvenly(selectedConfigIds));
  }

  function reset() {
    setOrderNumber('');
    setManagerId('');
    setPriority('Medium');
    setStartDate(todayLocalDate());
    setSpecifications('');
    const defaultIds = activeConfigs.map((c) => c.id);
    setSelectedConfigIds(defaultIds);
    setStagePercentages(distributeEvenly(defaultIds));
    setErrors({});
  }

  function handleClose() {
    reset();
    onClose?.();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const nextErrors = {};
    if (!selectedOrder) nextErrors.order = 'Select a CRM sales order.';
    // The server accepts a null manager and zero stages — only enforce these
    // when the tenant actually has managers / stage templates to choose from,
    // otherwise creation would be impossible on a fresh workspace.
    if (managers.length > 0 && !managerId) nextErrors.manager = 'Assign a project manager.';
    if (activeConfigs.length > 0 && selectedConfigIds.length === 0) nextErrors.stages = 'Pick at least one stage.';
    if (activeConfigs.length > 0 && selectedConfigIds.length > 0 && Math.round(totalPercentage * 100) / 100 !== 100) {
      nextErrors.stages = `Total stage percentage must equal 100% (currently ${Math.round(totalPercentage * 100) / 100}%).`;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const manager = managers.find((m) => m.id === managerId) || null;
    let id;
    const stageWeights = Object.fromEntries(
      selectedConfigIds.map((cid) => [cid, Number(stagePercentages[cid]) || 0])
    );
    try {
      id = await createProjectFromOrder({
        order: selectedOrder,
        projectManager: manager
          ? {
              id: manager.id,
              name: manager.name,
              email: manager.email,
              avatar: manager.avatar,
            }
          : null,
        priority,
        startDate: new Date(`${startDate}T09:00:00`).toISOString(),
        stageConfigIds: selectedConfigIds,
        stageWeights,
        specifications,
      });
    } catch (err) {
      setErrors({ order: err?.message || 'The project could not be created.' });
      return;
    }

    showToast(`${id} created from ${selectedOrder.orderNumber}.`);
    reset();
    onCreated?.(id);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Project from CRM Order"
      subtitle={`New project will be created as ${projectCode}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="pms-create-project" icon={PackageCheck}>
            Create Project
          </Button>
        </>
      }
    >
      <form id="pms-create-project" onSubmit={handleSubmit} className="space-y-4">
        {/* CRM order */}
        <div>
          <label className={labelClass} htmlFor="pms-order">
            CRM Sales Order <span className="text-rose-500">*</span>
          </label>
          <select
            id="pms-order"
            className={fieldClass}
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
          >
            <option value="">Select a confirmed sales order…</option>
            {availableOrders.map((o) => (
              <option key={o.orderNumber} value={o.orderNumber}>
                {o.orderNumber} — {o.customer} ({formatCurrency(o.total ?? o.amount ?? 0)})
              </option>
            ))}
            {linkedOrders.length > 0 && (
              <optgroup label="Already converted">
                {linkedOrders.map((o) => (
                  <option key={o.orderNumber} value={o.orderNumber} disabled>
                    {o.orderNumber} — {o.customer} · linked to {o.linkedProjectId}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {availableOrders.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1.5">
              Every sales order already has a project. Add a sales order in ERP, or unlink one,
              to create another project.
            </p>
          )}
          {errors.order && (
            <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
              <AlertCircle size={11} /> {errors.order}
            </p>
          )}
        </div>

        {/* Auto-filled order summary */}
        {selectedOrder && (
          <div className="rounded-lg border border-[#dce5f4] bg-[#f6f9ff] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Link2 size={12} className="text-blue-500" />
              <span className="text-[11px] font-bold text-slate-700">Auto-filled from order</span>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Customer', selectedOrder.customer],
                ['Order value', formatCurrency(selectedOrder.total ?? selectedOrder.amount ?? 0)],
                ['Line items', selectedOrder.itemsCount ?? selectedOrder.items?.length ?? 0],
                ['Delivery due', selectedOrder.deliveryDate ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[10px] text-slate-500">{k}</dt>
                  <dd className="text-[11px] font-semibold text-slate-800 truncate" title={String(v)}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass + ' mb-0'} htmlFor="pms-pm">
                Project Manager{managers.length > 0 && <span className="text-rose-500"> *</span>}
              </label>
              <MasterSourceLink source="users" />
            </div>
            <select
              id="pms-pm"
              className={fieldClass}
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">Select a manager…</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.role}
                </option>
              ))}
            </select>
            {managers.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1.5">
                No team members found. Add users in Administration → Users first.
              </p>
            )}
            {errors.manager && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
                <AlertCircle size={11} /> {errors.manager}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="pms-priority">Priority</label>
            <select
              id="pms-priority"
              className={fieldClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="pms-start">Start Date</label>
            <input
              id="pms-start"
              type="date"
              className={fieldClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="pms-specs">Specifications</label>
          <textarea
            id="pms-specs"
            rows={2}
            className={fieldClass}
            value={specifications}
            onChange={(e) => setSpecifications(e.target.value)}
            placeholder="Technical notes, tolerances, finish requirements…"
          />
        </div>

        {/* Stage template picker */}
        <div>
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className={labelClass + ' mb-0'}>Stage Templates & Weights</span>
              <span className="text-[10px] text-slate-400">
                ({selectedConfigIds.length} of {activeConfigs.length} selected)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedConfigIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDistributeEvenly}
                  className="text-[10px] font-semibold text-blue-600 hover:underline"
                >
                  Distribute Evenly
                </button>
              )}
              {activeConfigs.length > 0 && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    Math.round(totalPercentage * 100) / 100 === 100
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  Total: {Math.round(totalPercentage * 100) / 100}% / 100%
                </span>
              )}
            </div>
          </div>
          {activeConfigs.length === 0 ? (
            <p className="text-[11px] text-amber-600 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              No stage templates exist yet — the project will be created without stages. Add templates in PMS settings and apply them to the project later.
            </p>
          ) : (
          <div className="rounded-lg border border-[#dce5f4] divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {activeConfigs.map((c) => {
              const isSelected = selectedConfigIds.includes(c.id);
              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-between gap-2.5 px-3 py-2 ${
                    isSelected ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleConfig(c.id)}
                      className="accent-blue-600"
                    />
                    <span className="text-[11px] font-semibold text-slate-700 truncate">
                      {c.sequence}. {c.name}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">
                      {c.department}
                    </span>
                  </label>
                  {isSelected ? (
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] text-slate-400">Weight:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={stagePercentages[c.id] ?? ''}
                        onChange={(e) => handlePercentageChange(c.id, e.target.value)}
                        className="w-16 text-right text-xs rounded-md border border-[#dce5f4] px-1.5 py-1 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        placeholder="0"
                      />
                      <span className="text-[11px] font-bold text-slate-500">%</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {c.defaultDuration} {c.durationUnit}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          )}
          {errors.stages && (
            <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
              <AlertCircle size={11} /> {errors.stages}
            </p>
          )}
          <p className="text-[10px] text-slate-400 mt-1.5">
            Stage percentage weights define overall project progress contribution and must total 100%.
          </p>
        </div>
      </form>
    </Modal>
  );
}

export default CreateProjectModal;
