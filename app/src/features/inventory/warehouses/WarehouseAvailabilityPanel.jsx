import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryService } from '../../../services/domainServices';
import { describeApiError, formatNumberIN } from '../../accounts/accountingShared';

const n = (v) => formatNumberIN(v || 0);

/**
 * Free stock of one item in every warehouse, the shortage at the dispatch
 * warehouse, and a button to raise a transfer request (stock reserved at the
 * source) from a warehouse that has it.
 */
export default function WarehouseAvailabilityPanel({ itemId, qty, warehouseId, salesOrderId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [created, setCreated] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setError('');
    inventoryService.getWarehouseAvailability({ itemId, qty: qty || 0, warehouseId: warehouseId || undefined })
      .then((res) => alive && setData(res))
      .catch((err) => alive && setError(describeApiError(err) || 'Availability could not be loaded.'));
    return () => { alive = false; };
  }, [itemId, qty, warehouseId, reload]);

  const shortage = Number(data?.shortage || 0);
  const request = async (from) => {
    setBusy(from.warehouseId);
    setError('');
    try {
      const t = await inventoryService.createShortageTransfer({
        itemId, qty: Math.min(shortage, Number(from.available)), fromWarehouseId: from.warehouseId,
        toWarehouseId: warehouseId, salesOrderId: salesOrderId || undefined,
      });
      setCreated(t);
      setReload((r) => r + 1);
    } catch (err) {
      setError(describeApiError(err) || 'The transfer request could not be raised.');
    } finally {
      setBusy('');
    }
  };

  if (!data && !error) return <p className="text-slate-400 text-xs">Loading warehouse stock…</p>;
  return (
    <div className="space-y-2 text-xs">
      {error && <div role="alert" className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}
      {created && (
        <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
          Transfer {created.transfer_number} requested ({created.sourceLocation} → {created.destLocation}); the stock is reserved at the source.{' '}
          <Link to="/inventory/transfers" className="font-semibold underline">Open transfers</Link>
        </div>
      )}
      {data && warehouseId && Number(data.required) > 0 && (
        <div className={`p-2 rounded-lg border ${shortage > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          {shortage > 0
            ? <>Short by <b>{n(data.shortage)}</b> at the dispatch warehouse (free there: {n(data.availableHere)}).{data.canCover ? ' Other warehouses can cover it.' : ' Other warehouses cannot cover all of it.'}</>
            : <>The dispatch warehouse has enough free stock ({n(data.availableHere)}).</>}
        </div>
      )}
      {data && (
        <table className="w-full">
          <thead className="text-[10px] uppercase text-slate-400">
            <tr><th className="text-left py-1">Warehouse</th><th className="text-right py-1">Physical</th><th className="text-right py-1">Reserved</th><th className="text-right py-1">QC pending</th><th className="text-right py-1">Available</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.warehouses.length === 0 && <tr><td colSpan={6} className="py-3 text-center text-slate-400">No stock of this item in any warehouse.</td></tr>}
            {data.warehouses.map((r) => (
              <tr key={r.warehouseId} className={r.warehouseId === String(warehouseId) ? 'bg-blue-50/50' : ''}>
                <td className="py-1.5 font-semibold">{r.warehouseName}{r.warehouseId === String(warehouseId) ? ' (dispatch)' : ''}</td>
                <td className="py-1.5 text-right tabular-nums">{n(r.physical)} {r.uom}</td>
                <td className="py-1.5 text-right tabular-nums">{n(r.reserved)}</td>
                <td className="py-1.5 text-right tabular-nums">{n(r.qcPending)}</td>
                <td className="py-1.5 text-right tabular-nums font-bold">{n(r.available)}</td>
                <td className="py-1.5 text-right">
                  {shortage > 0 && warehouseId && r.warehouseId !== String(warehouseId) && Number(r.available) > 0 && (
                    <button type="button" disabled={!!busy} onClick={() => request(r)} className="h-7 px-2 rounded-md bg-blue-600 text-white font-semibold disabled:opacity-60 cursor-pointer">
                      {busy === r.warehouseId ? 'Requesting…' : `Request ${n(Math.min(shortage, Number(r.available)))}`}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
