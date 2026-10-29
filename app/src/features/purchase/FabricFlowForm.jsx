import React from 'react';
import { Factory, Warehouse, Droplets, ArrowRight, Plus, Trash2 } from 'lucide-react';

/**
 * Factory fabric flows of the Create Purchase Order form. The PO stores the
 * chosen flow (``fabricFlow``) and is received through the ordinary grey
 * stock GRN; the server decides batches, stock and costs.
 */
export const FABRIC_FLOW_A = 'FACTORY_TO_OSCAR';
export const FABRIC_FLOW_B = 'FACTORY_TO_MILL';

export const FABRIC_FLOW_OPTIONS = [
  {
    value: FABRIC_FLOW_A,
    label: 'Factory → OSCAR Warehouse',
    hint: 'Factory manufactures grey fabric and delivers it directly to OSCAR.',
    icons: [Factory, Warehouse],
    steps: ['PO', 'Factory production & dispatch', 'Receipt at OSCAR', 'Grey Fabric batch per receipt', 'QC → stock'],
  },
  {
    value: FABRIC_FLOW_B,
    label: 'Factory → Dyeing Mill → OSCAR',
    hint: 'Factory sends grey fabric directly to the dyeing mill. OSCAR receives the dyed fabric after processing.',
    icons: [Factory, Droplets, Warehouse],
    steps: ['PO', 'Factory dispatch to mill', 'Mill receipt & dyeing', 'Dyed fabric receipt at OSCAR', 'Dyed Fabric batch per receipt', 'QC → stock'],
  },
];

export const flowLabel = (value) => FABRIC_FLOW_OPTIONS.find((o) => o.value === value)?.label || '';

export const EXPENSE_CATEGORIES = [
  { value: 'MANUFACTURING', label: 'Factory / manufacturing', types: ['Manufacturing charges', 'Additional factory expense'] },
  { value: 'YARN', label: 'Yarn', types: ['Yarn cost', 'Other yarn expense'] },
  { value: 'DYEING', label: 'Dyeing / processing', types: ['Dyeing charges', 'Processing charges', 'Other mill expense'], flowB: true },
  { value: 'FREIGHT', label: 'Freight / transportation', types: ['Factory-to-mill freight', 'Mill-to-OSCAR freight', 'Factory-to-OSCAR freight', 'Other transportation'] },
  { value: 'OTHER', label: 'Other', types: ['Loading / unloading', 'Other expense'] },
];

export const expenseCategoriesFor = (flow) => EXPENSE_CATEGORIES.filter((c) => !c.flowB || flow === FABRIC_FLOW_B);

const inputCls = 'w-full border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800';

/** The two workflow cards shown at the top of the Create PO form. */
export function FabricFlowCards({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Fabric workflow" className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {FABRIC_FLOW_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${active ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <input type="radio" name="fabricFlow" value={opt.value} checked={active} onChange={() => onChange(opt.value)} className="mt-1 h-4 w-4 accent-blue-600" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 mb-1.5" aria-hidden="true">
                {opt.icons.map((Icon, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ArrowRight size={12} className="text-slate-300" />}
                    <span className={`grid h-8 w-8 place-items-center rounded-lg ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}><Icon size={15} /></span>
                  </React.Fragment>
                ))}
              </span>
              <span className="block text-[13px] font-bold text-slate-800">{opt.label}</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">{opt.hint}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Steps the selected flow goes through after approval. */
export function FabricFlowSteps({ flow }) {
  const opt = FABRIC_FLOW_OPTIONS.find((o) => o.value === flow);
  if (!opt) return null;
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[10.5px] font-semibold text-slate-600">
      {opt.steps.map((s, i) => (
        <li key={s} className="inline-flex items-center gap-1">
          {i > 0 && <ArrowRight size={11} className="text-slate-300" aria-hidden="true" />}
          <span className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export const blankYarnLine = () => ({ key: `y-${Date.now()}-${Math.floor(Math.random() * 1000)}`, itemId: '', yarnQuality: '', supplierId: '', supplierName: '', supplierPhone: '', yarnLot: '', requiredQty: '', uom: 'Kg', rate: '', remarks: '' });
export const blankCostLine = (flow) => ({ key: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`, category: 'MANUFACTURING', expenseType: 'Manufacturing charges', amount: '', status: 'ESTIMATED', billReference: '', flow });

/**
 * Planned yarn for the order. Planning only: nothing is issued from stock.
 * Every field is typed by hand; yarn items and vendors only suggest -- a
 * typed name that matches one links it, anything else is kept as typed.
 */
export function YarnLinesEditor({ rows, onChange, yarnItems, vendors, formatCurrency }) {
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const update = (i, key, value) => onChange(rows.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [key]: value };
    if (key === 'yarnQuality') {
      const it = yarnItems.find((y) => same(y.name, value));
      next.itemId = it ? it.id : '';
      if (it) { next.uom = it.uom || next.uom; next.rate = next.rate || it.costPrice || ''; }
    }
    if (key === 'supplierName') {
      const v = vendors.find((p) => same(p.name, value));
      next.supplierId = v ? v.id : '';
      if (v && !next.supplierPhone) next.supplierPhone = v.phone || v.mobile || '';
    }
    return next;
  }));
  return (
    <div>
      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-[12px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Yarn / quality *</th>
              <th className="px-2 py-2 w-44">Yarn supplier</th>
              <th className="px-2 py-2 w-36">Supplier contact</th>
              <th className="px-2 py-2 w-28">Lot / ref</th>
              <th className="px-2 py-2 w-24 text-right">Required qty</th>
              <th className="px-2 py-2 w-16">UOM</th>
              <th className="px-2 py-2 w-24 text-right">Rate (₹)</th>
              <th className="px-2 py-2 w-28 text-right">Amount (₹)</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-3 text-center text-slate-400">No yarn planned. Add a line if the factory uses yarn for this order.</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.key || r.id || i}>
                <td className="px-2 py-1.5">
                  <input aria-label="Yarn quality" list="yarn-item-options" value={r.yarnQuality} onChange={(e) => update(i, 'yarnQuality', e.target.value)} placeholder="e.g. 60s combed cotton" className={inputCls} />
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label="Yarn supplier" list="yarn-supplier-options" value={r.supplierName || ''} onChange={(e) => update(i, 'supplierName', e.target.value)} placeholder="Supplier name" className={inputCls} />
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label="Supplier contact number" type="tel" inputMode="tel" value={r.supplierPhone || ''} onChange={(e) => update(i, 'supplierPhone', e.target.value.replace(/[^0-9+ -]/g, ''))} placeholder="e.g. 98250 12345" className={inputCls} />
                </td>
                <td className="px-2 py-1.5"><input aria-label="Yarn lot" value={r.yarnLot} onChange={(e) => update(i, 'yarnLot', e.target.value)} className={inputCls} /></td>
                <td className="px-2 py-1.5"><input aria-label="Required quantity" type="number" min="0" step="any" value={r.requiredQty} onChange={(e) => update(i, 'requiredQty', e.target.value)} className={`${inputCls} text-right font-mono`} /></td>
                <td className="px-2 py-1.5"><input aria-label="Unit" value={r.uom} onChange={(e) => update(i, 'uom', e.target.value)} className={inputCls} /></td>
                <td className="px-2 py-1.5"><input aria-label="Rate" type="number" min="0" step="any" value={r.rate} onChange={(e) => update(i, 'rate', e.target.value)} className={`${inputCls} text-right font-mono`} /></td>
                <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-700">{(Number(r.requiredQty) || 0) * (Number(r.rate) || 0) > 0 ? formatCurrency((Number(r.requiredQty) || 0) * (Number(r.rate) || 0)) : '—'}</td>
                <td className="px-1 py-1.5 text-center">
                  <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" aria-label="Remove yarn line"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="yarn-item-options">{yarnItems.map((y) => <option key={y.id} value={y.name} />)}</datalist>
        <datalist id="yarn-supplier-options">{vendors.map((v) => <option key={v.id} value={v.name} />)}</datalist>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => onChange([...rows, blankYarnLine()])} className="inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:underline"><Plus size={13} /> Add yarn line</button>
        <span className="text-[10.5px] text-slate-400">Planned yarn only — it is not taken out of yarn stock. Record yarn bills under Costs &amp; Expenses.</span>
      </div>
    </div>
  );
}

/** Costs known when the order is placed. More can be added on the PO later. */
export function OpeningCostsEditor({ rows, onChange, flow, formatCurrency }) {
  const categories = expenseCategoriesFor(flow);
  const update = (i, key, value) => onChange(rows.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, [key]: value };
    if (key === 'category') next.expenseType = (EXPENSE_CATEGORIES.find((c) => c.value === value)?.types || [''])[0];
    return next;
  }));
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  return (
    <div>
      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[12px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2 w-44">Category *</th>
              <th className="px-2 py-2">Expense</th>
              <th className="px-2 py-2 w-32 text-right">Amount (₹) *</th>
              <th className="px-2 py-2 w-32">Status</th>
              <th className="px-2 py-2 w-32">Bill / ref no.</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-3 text-center text-slate-400">No costs yet. You can add them now or later on the PO when bills arrive.</td></tr>
            )}
            {rows.map((r, i) => {
              const types = EXPENSE_CATEGORIES.find((c) => c.value === r.category)?.types || [];
              return (
                <tr key={r.key || i}>
                  <td className="px-2 py-1.5">
                    <select aria-label="Cost category" value={r.category} onChange={(e) => update(i, 'category', e.target.value)} className={inputCls}>
                      {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input aria-label="Expense" list={`cost-types-${i}`} value={r.expenseType} onChange={(e) => update(i, 'expenseType', e.target.value)} className={inputCls} />
                    <datalist id={`cost-types-${i}`}>{types.map((t) => <option key={t} value={t} />)}</datalist>
                  </td>
                  <td className="px-2 py-1.5"><input aria-label="Amount" type="number" min="0" step="0.01" value={r.amount} onChange={(e) => update(i, 'amount', e.target.value)} className={`${inputCls} text-right font-mono`} /></td>
                  <td className="px-2 py-1.5">
                    <select aria-label="Cost status" value={r.status} onChange={(e) => update(i, 'status', e.target.value)} className={inputCls}>
                      <option value="ESTIMATED">Estimated</option>
                      <option value="ACTUAL">Actual (billed)</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><input aria-label="Bill reference" value={r.billReference} onChange={(e) => update(i, 'billReference', e.target.value)} className={inputCls} /></td>
                  <td className="px-1 py-1.5 text-center">
                    <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" aria-label="Remove cost"><Trash2 size={13} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/60 font-bold">
                <td className="px-2 py-2" colSpan={2}>Total costs entered</td>
                <td className="px-2 py-2 text-right font-mono">{formatCurrency(total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <button type="button" onClick={() => onChange([...rows, blankCostLine(flow)])} className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:underline"><Plus size={13} /> Add cost</button>
    </div>
  );
}

/** Rows of the form -> the API payload; returns an error message or the payload. */
export function fabricFlowPayload({ flow, dyeingMillId, yarnRows, costRows }) {
  const yarnLines = yarnRows.filter((r) => r.itemId || r.yarnQuality || Number(r.requiredQty) > 0);
  if (yarnLines.some((r) => !r.itemId && !String(r.yarnQuality || '').trim())) {
    return { error: 'Every yarn line needs a yarn item or a typed yarn quality.' };
  }
  if (yarnLines.some((r) => r.supplierPhone && !/^\+?[0-9][0-9 -]{5,18}[0-9]$/.test(String(r.supplierPhone).trim()))) {
    return { error: 'Enter a valid yarn supplier contact number.' };
  }
  const expenses = costRows.filter((r) => r.amount !== '' || r.billReference);
  if (expenses.some((r) => !(Number(r.amount) > 0))) return { error: 'Every cost needs an amount greater than zero.' };
  return {
    payload: {
      fabricFlow: flow,
      dyeingMillId: flow === FABRIC_FLOW_B ? (dyeingMillId || undefined) : undefined,
      yarnLines: yarnLines.map(({ key, ...r }) => ({
        ...r,
        itemId: r.itemId || undefined,
        supplierId: r.supplierId || undefined,
        supplierName: String(r.supplierName || '').trim() || undefined,
        supplierPhone: String(r.supplierPhone || '').trim() || undefined,
        requiredQty: Number(r.requiredQty) || 0,
        rate: Number(r.rate) || 0,
      })),
      expenses: expenses.map(({ key, flow: _f, ...r }) => ({ ...r, amount: Number(r.amount) })),
    },
  };
}
