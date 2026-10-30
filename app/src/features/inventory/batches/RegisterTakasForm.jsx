import React, { useState } from 'react';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatNumberIN } from '../../accounts/accountingShared';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Cut takas out of a batch's unregistered (bulk) metres. One row per taka;
 * the server gives each its own taka ID and keeps the batch, lot and cost.
 */
export default function RegisterTakasForm({ batch, onDone }) {
  const left = num(batch.quantities?.unregistered);
  const uom = batch.quantities?.uom || 'm';
  const [rows, setRows] = useState([{ meters: '', weightKg: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const total = rows.reduce((s, r) => s + num(r.meters), 0);
  const update = (i, key, value) => setRows(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  const submit = async (e) => {
    e.preventDefault();
    if (total > left + 1e-6) {
      setError(`The takas add up to ${formatNumberIN(total)}, only ${formatNumberIN(left)} ${uom} is left.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const next = await inventoryService.registerTakas(batch.batchCode, {
        takas: rows.filter((r) => num(r.meters) > 0).map((r) => ({ meters: r.meters, weightKg: r.weightKg || undefined })),
      });
      setRows([{ meters: '', weightKg: '' }]);
      onDone(next);
    } catch (err) {
      setError(describeApiError(err) || 'The takas could not be registered.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 text-xs">
      <p className="text-slate-600">
        <span className="font-semibold">{formatNumberIN(left)} {uom}</span> of this batch is not registered as takas yet.
        Enter each taka&apos;s metres; what you don&apos;t register stays in the batch.
      </p>
      <table className="w-full max-w-md">
        <thead className="text-[10px] uppercase text-slate-400"><tr><th className="text-left py-1 w-10">#</th><th className="text-right py-1">Metres *</th><th className="text-right py-1">Weight (kg)</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-1 text-slate-400">{i + 1}</td>
              <td className="py-1 text-right"><input type="number" min="0.0001" step="any" required={i === 0} aria-label={`Metres of taka ${i + 1}`} value={r.meters} onChange={(e) => update(i, 'meters', e.target.value)} className="w-28 h-8 px-2 rounded-md border border-slate-200 text-right" /></td>
              <td className="py-1 text-right"><input type="number" min="0" step="any" aria-label={`Weight of taka ${i + 1}`} value={r.weightKg} onChange={(e) => update(i, 'weightKg', e.target.value)} className="w-24 h-8 px-2 rounded-md border border-slate-200 text-right" /></td>
              <td className="py-1 pl-2">{rows.length > 1 && <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-rose-600 font-semibold cursor-pointer" aria-label={`Remove taka ${i + 1}`}>✕</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setRows([...rows, { meters: '', weightKg: '' }])} className="h-8 px-3 rounded-lg border border-slate-200 font-semibold hover:bg-slate-50 cursor-pointer">+ Taka</button>
        <span className={total > left + 1e-6 ? 'text-rose-700 font-semibold' : 'text-slate-500'}>
          {rows.filter((r) => num(r.meters) > 0).length} taka(s), {formatNumberIN(total)} {uom} · {formatNumberIN(Math.max(0, left - total))} {uom} will stay unregistered
        </span>
        <button type="submit" disabled={saving} className="ml-auto h-8 px-4 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 cursor-pointer">{saving ? 'Registering…' : 'Register takas'}</button>
      </div>
      {error && <div role="alert" className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
    </form>
  );
}
