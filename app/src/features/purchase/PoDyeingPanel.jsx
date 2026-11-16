import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Droplets, Trash2, Undo2 } from 'lucide-react';
import Drawer from '../../components/ui/Drawer';
import { useERP } from '../../context/ERPContext';
import { api } from '../../services/api';
import { newIdempotencyKey } from '../../services/resourceSync';
import { numIN } from '../../utils/formatters';

/**
 * Flow 2 (OSCAR -> dyeing mill -> OSCAR): a dyeing order on the mill for batches
 * of a grey fabric PO. Every quantity comes from the server, which decides what
 * can be sent or returned; the screen only shows it.
 */
const today = () => new Date().toISOString().split('T')[0];
const inputCls = 'w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-500';
const labelCls = 'text-[11px] font-bold text-slate-600 block mb-1';
const thCls = 'px-3 py-2 font-bold whitespace-nowrap';

const message = (err, fallback) => {
  const fields = err?.payload?.field_errors;
  const first = fields && Object.values(fields)[0];
  return (Array.isArray(first) ? first[0] : first) || err?.payload?.message || err?.message || fallback;
};

function useDyeing(poId) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!poId) return;
    try {
      setError('');
      setData(await api.get(`/purchase/orders/${poId}/dyeing/`));
    } catch (err) {
      setError(message(err, 'Dyeing details could not be loaded.'));
    }
  }, [poId]);
  useEffect(() => { load(); }, [load]);
  return { data, error, load };
}

function Fact({ label, value }) {
  return (
    <div className="min-w-0">
      <span className="text-[10px] uppercase font-bold text-slate-500 block">{label}</span>
      <strong className="text-xs text-slate-900 block truncate">{value ?? '—'}</strong>
    </div>
  );
}

function ErrorNote({ text }) {
  if (!text) return null;
  return (
    <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
      <AlertTriangle size={14} className="shrink-0" /> {text}
    </div>
  );
}

function Table({ title, head, children, empty }) {
  return (
    <div>
      <h5 className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600 mb-1.5">{title}</h5>
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-xs text-slate-700">
          <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
            <tr>{head.map(([label, right]) => <th key={label} className={`${thCls} ${right ? 'text-right' : 'text-left'}`}>{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {children}
            {empty && <tr><td colSpan={head.length} className="px-3 py-5 text-center text-slate-400">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The Create PO form's lines for Flow 2: pick a grey PO, keep the batches to send. */
export function DyeingOrderLines({ sources, sourcePoId, onSource, rows, onRows, rate, onRate }) {
  const update = (batchId, qty) => onRows(rows.map((r) => (r.batchId === batchId ? { ...r, qty } : r)));
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="po-source" className="block font-semibold text-slate-700 mb-1">Grey Fabric PO *</label>
          <select id="po-source" value={sourcePoId} onChange={(e) => onSource(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800">
            <option value="">Select grey fabric PO...</option>
            {sources.map((p) => <option key={p.id} value={p.id}>{p.poNumber} · {p.vendorName} · {p.fabric} · {numIN(p.availableQty)} available</option>)}
          </select>
          {sources.length === 0 && <p className="mt-1 text-[10.5px] text-amber-700">No grey fabric PO has QC-passed stock free to send.</p>}
        </div>
        <div>
          <label htmlFor="po-dyeing-rate" className="block font-semibold text-slate-700 mb-1">Dyeing Rate (₹ / unit) *</label>
          <input id="po-dyeing-rate" type="number" min="0" step="0.01" value={rate} onChange={(e) => onRate(e.target.value)} placeholder="e.g. 15" className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
        </div>
      </div>
      {sourcePoId && (
        <Table
          title="Batches to Send"
          head={[['Batch'], ['GRN'], ['Fabric'], ['Available', true], ['Qty to Send', true], ['']]}
          empty={rows.length === 0 ? 'No batch selected. Pick the PO again to reload its batches.' : null}
        >
          {rows.map((r) => (
            <tr key={r.batchId}>
              <td className="px-3 py-2 font-mono font-bold text-blue-700 whitespace-nowrap">{r.batchCode}</td>
              <td className="px-3 py-2 font-mono whitespace-nowrap">{r.grnNumber}</td>
              <td className="px-3 py-2">{r.fabric}</td>
              <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">{numIN(r.availableToSend)}</td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number" min="0" step="0.01" aria-label={`Quantity for ${r.batchCode}`} value={r.qty}
                  onChange={(e) => update(r.batchId, e.target.value)}
                  className="w-28 px-2 py-1 text-xs text-right border border-slate-300 rounded-lg"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <button type="button" onClick={() => onRows(rows.filter((x) => x.batchId !== r.batchId))} aria-label={`Remove ${r.batchCode}`} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer">
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function DyeingReturnDrawer({ po, dispatch, poColour, onClose, onSaved }) {
  const { locations = [], refreshCollections } = useERP();
  const [form, setForm] = useState({
    returnDate: today(), millChallanNo: '', colourName: poColour?.name || '', locationId: locations[0]?.id || '',
    processingDetails: '', remarks: '',
  });
  const [qty, setQty] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const keyRef = useRef(newIdempotencyKey());
  const lines = dispatch.lines.filter((l) => Number(l.pendingQty) > 0);

  const save = async () => {
    setSaveError('');
    if (!form.colourName.trim()) return setSaveError('Enter the actual fabric colour.');
    if (!form.locationId) return setSaveError('Select the godown.');
    if (!lines.some((l) => Number(qty[l.batchId]) > 0)) return setSaveError('Enter the returned quantity for at least one batch.');
    const over = lines.find((l) => Number(qty[l.batchId]) > Number(l.pendingQty));
    if (over) return setSaveError(`${over.batchCode}: only ${numIN(over.pendingQty)} is still at the mill.`);
    setSaving(true);
    try {
      await api.post(`/purchase/orders/${po.id}/dyeing/dispatches/${dispatch.id}/returns/`, {
        ...form,
        colourHex: form.colourName.trim() === poColour?.name ? poColour?.hex : undefined,
        lines: lines.filter((l) => Number(qty[l.batchId]) > 0).map((l) => ({ batchId: l.batchId, qty: Number(qty[l.batchId]) })),
      }, { idempotencyKey: keyRef.current });
      refreshCollections?.(['purchaseOrders', 'inventory']);
      await onSaved?.();
      onClose();
    } catch (err) {
      setSaveError(message(err, 'The return could not be saved.'));
      keyRef.current = newIdempotencyKey();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen
      onClose={onClose}
      width={820}
      title={`Receive Dyed Fabric — ${dispatch.dispatchNumber}`}
      subtitle="Each returned batch becomes a Dyed Fabric batch at QC Hold. Only QC-accepted fabric becomes available."
      footer={(
        <button type="button" onClick={save} disabled={saving} className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer">
          <Undo2 size={13} /> {saving ? 'Saving…' : 'Save & Send to QC'}
        </button>
      )}
    >
      <div className="space-y-3 text-xs">
        <ErrorNote text={saveError} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <Fact label="PO" value={po.poNumber} />
          <Fact label="Dyeing Mill" value={dispatch.millName} />
          <Fact label="Dispatch" value={dispatch.dispatchNumber} />
          <Fact label="Still at Mill" value={numIN(dispatch.pendingQty)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="ret-date" className={labelCls}>Return Date *</label>
            <input id="ret-date" type="date" value={form.returnDate} onChange={(e) => setForm({ ...form, returnDate: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ret-challan" className={labelCls}>Mill Challan Number</label>
            <input id="ret-challan" value={form.millChallanNo} onChange={(e) => setForm({ ...form, millChallanNo: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ret-colour" className={labelCls}>Actual Colour / Shade *</label>
            <input id="ret-colour" value={form.colourName} onChange={(e) => setForm({ ...form, colourName: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ret-godown" className={labelCls}>Godown *</label>
            <select id="ret-godown" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className={inputCls}>
              <option value="">Select godown...</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ret-details" className={labelCls}>Processing Details</label>
            <input id="ret-details" value={form.processingDetails} onChange={(e) => setForm({ ...form, processingDetails: e.target.value })} className={inputCls} />
          </div>
        </div>
        <Table title="Batches at the Mill" head={[['Grey Batch'], ['Sent', true], ['Previously Returned', true], ['Remaining', true], ['Returned Qty', true]]}>
          {lines.map((l) => (
            <tr key={l.batchId}>
              <td className="px-3 py-2 font-mono font-bold text-blue-700">{l.batchCode}</td>
              <td className="px-3 py-2 text-right tabular-nums">{numIN(l.sentQty)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{numIN(l.returnedQty)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-bold text-amber-700">{numIN(l.pendingQty)}</td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number" min="0" step="0.01" aria-label={`Returned quantity for ${l.batchCode}`}
                  value={qty[l.batchId] ?? ''}
                  onChange={(e) => setQty({ ...qty, [l.batchId]: e.target.value })}
                  className="w-24 px-2 py-1 text-xs text-right border border-slate-300 rounded-lg"
                />
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </Drawer>
  );
}

/** Opens the receipt straight from the PO menu. An order approved before the
 * fabric went out automatically is sent first, once, by the server. */
export function ReceiveDyedFabricDrawer({ po, onClose, onSaved }) {
  const [state, setState] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        let data = await api.get(`/purchase/orders/${po.id}/dyeing/`);
        if (data.dispatches.length === 0) {
          data = await api.post(`/purchase/orders/${po.id}/dyeing/dispatches/`, {}, { idempotencyKey: newIdempotencyKey() });
        }
        if (live) setState({ data, dispatch: data.dispatches.find((d) => Number(d.pendingQty) > 0) });
      } catch (err) {
        if (live) setState({ error: message(err, 'This order could not be opened.') });
      }
    })();
    return () => { live = false; };
  }, [po.id]);

  if (!state) return null;
  if (!state.dispatch) {
    return (
      <Drawer isOpen onClose={onClose} width={520} title="Receive Dyed Fabric">
        <ErrorNote text={state.error || 'All fabric of this order is already back from the mill.'} />
      </Drawer>
    );
  }
  return (
    <DyeingReturnDrawer
      po={po}
      dispatch={state.dispatch}
      poColour={{ name: state.data.colourName, hex: state.data.colourHex }}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
