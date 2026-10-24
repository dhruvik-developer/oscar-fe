import React, { useEffect, useState } from 'react';
import { PenTool, Printer, ShieldCheck, Truck, X } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { api } from '../../services/api';
import DigitalSignatureModal from './DigitalSignatureModal';
import { dash, fmtDate, fmtMoney, fmtNum, fmtAddress } from './printDocUtils';

const SIGNATORIES = [
  { key: 'consignor', label: 'Consignor (sign)', modalType: 'authorized', designation: 'Consignor — Authorized Signatory' },
  { key: 'driver', label: 'Driver / Transporter (sign)', modalType: 'receiver', designation: 'Driver / Transporter' },
  { key: 'consignee', label: 'Consignee (receipt stamp & sign)', modalType: 'receiver', designation: 'Consignee — Received in good condition' },
];

/** A saved e-signature as it appears on the printed LR. */
function SignatureMark({ sig }) {
  return (
    <div className="h-14 flex flex-col items-center justify-end">
      {sig.type === 'digital_stamp' ? (
        <div className="border border-emerald-600 text-emerald-800 rounded px-2 py-0.5 text-[9px] leading-tight">
          <div className="flex items-center justify-center gap-1 font-bold"><ShieldCheck size={10} /> E-SIGNED</div>
          <div className="font-bold text-[10px]">{sig.name}</div>
        </div>
      ) : (
        <img src={sig.signatureData} alt={`Signature of ${sig.name}`} className="max-h-12 max-w-[160px] object-contain" />
      )}
    </div>
  );
}

const TRIP_TYPE_LABEL = {
  JOBWORK_OUT: 'Job Work Outward',
  JOBWORK_IN: 'Job Work Inward',
  OUTWARD: 'Outward',
  INWARD: 'Inward',
  TRANSFER: 'Internal Transfer',
};

/**
 * Lorry Receipt / Consignment Note (company copy) printed from a Logistics
 * Trip (requirement PDF section 13: trip, material, charges, tracking).
 * The LR number itself is the transporter's; every value is read from the
 * saved trip -- nothing is invented.
 */
export function PrintLorryReceiptModal({ isOpen, onClose, tripId }) {
  const { companyProfile } = useERP();
  const [trip, setTrip] = useState(null);
  const [transporter, setTransporter] = useState(null);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState(null); // signatory key whose pad is open
  const [savingSig, setSavingSig] = useState(false);

  const saveSignature = async (key, signature) => {
    setSavingSig(true);
    try {
      const updated = await api.post(`/inventory/trips/${tripId}/sign/`, { signatoryType: key, signature });
      setTrip((prev) => ({ ...prev, signatures: updated?.signatures || {} }));
    } finally {
      setSavingSig(false);
    }
  };

  const clearSignature = async (key) => {
    if (!window.confirm('Remove this signature?')) return;
    try {
      await saveSignature(key, null);
    } catch (err) {
      setError(err?.message || 'Could not remove the signature.');
    }
  };

  useEffect(() => {
    if (!isOpen || !tripId) return undefined;
    let live = true;
    setError('');
    setTrip(null);
    setTransporter(null);
    api.get(`/inventory/trips/${tripId}/`)
      .then((t) => {
        if (!live) return;
        setTrip(t);
        if (t?.transporterId) {
          api.get(`/masters/transporters/${t.transporterId}/`).then((tr) => live && setTransporter(tr)).catch(() => {});
        }
      })
      .catch((err) => live && setError(err?.message || 'Could not load the trip.'));
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => { live = false; document.removeEventListener('keydown', onKey); };
  }, [isOpen, tripId, onClose]);

  if (!isOpen) return null;

  const materials = trip?.materials || [];
  const totalQty = materials.reduce((s, m) => s + Number(m.quantity || 0), 0);
  const totalKg = materials.reduce((s, m) => s + Number(m.rollWeight || 0), 0);
  const references = [...new Set(materials.map((m) => m.document_reference_number || m.documentReferenceNumber).filter(Boolean))];
  const cell = 'border border-slate-400 px-2 py-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-auto overflow-hidden print:shadow-none print:max-w-none print:rounded-none">
        <div className="bg-[#1F2E4A] text-white px-4 py-3 flex items-center justify-between no-print">
          <span className="font-bold text-sm flex items-center gap-2"><Truck size={15} /> Lorry Receipt — {trip?.lrNumber || trip?.tripNumber || '…'}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!trip} onClick={() => window.print()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-xs flex items-center gap-1.5 disabled:opacity-50">
              <Printer size={14} /> Print / Save as PDF
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={18} /></button>
          </div>
        </div>

        {error && <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 no-print">{error}</div>}
        {!trip && !error && <div className="p-6 text-xs text-slate-500 no-print">Loading trip…</div>}

        {trip && (
          <div className="overflow-x-auto print:overflow-visible">
            <div className="printable-document p-8 min-w-[720px] print:min-w-0 bg-white text-slate-900 text-[11px] space-y-3 relative">
              {!trip.lrNumber && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-5xl font-black text-rose-200 rotate-[-20deg]">LR NUMBER NOT RECORDED</span>
                </div>
              )}
              <div className="flex justify-between border-b-2 border-slate-900 pb-2">
                <div>
                  <div className="text-lg font-extrabold uppercase">Lorry Receipt / Consignment Note</div>
                  <div className="font-semibold">Transporter: {dash(trip.transporterName || transporter?.name)}</div>
                  <div>GSTIN: {dash(transporter?.gstin)} · {fmtAddress(transporter?.address) || '—'}</div>
                  <div>Phone: {dash(transporter?.phone)}</div>
                </div>
                <div className="text-right space-y-0.5">
                  <div>LR No: <strong className="font-mono text-sm">{dash(trip.lrNumber)}</strong></div>
                  <div>LR Date: <strong>{fmtDate(trip.lrDate)}</strong></div>
                  <div>Trip No: <strong className="font-mono">{dash(trip.tripNumber)}</strong></div>
                  <div>Trip Date: {fmtDate(trip.tripDate)}</div>
                  <div>Type: {TRIP_TYPE_LABEL[trip.tripType] || dash(trip.tripType)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-0 border border-slate-400">
                <div className="p-2 border-r border-slate-400">
                  <div className="font-bold uppercase text-[10px] text-slate-500">Consignor (From)</div>
                  <div className="font-bold">{dash(companyProfile?.name)}</div>
                  <div>{fmtAddress(companyProfile?.address) || '—'}</div>
                  <div>GSTIN: {dash(companyProfile?.gstin)}</div>
                  <div>From: <strong>{dash(trip.fromLocation)}</strong></div>
                </div>
                <div className="p-2">
                  <div className="font-bold uppercase text-[10px] text-slate-500">Consignee (To)</div>
                  <div>To: <strong>{dash(trip.toLocation)}</strong></div>
                  {references.length > 0 && <div>Against: {references.join(', ')}</div>}
                </div>
              </div>

              <div className="grid grid-cols-3 border border-slate-400">
                <div className="p-2 border-r border-slate-400">Vehicle No: <strong className="font-mono">{dash(trip.vehicleNumber)}</strong></div>
                <div className="p-2 border-r border-slate-400">Driver: <strong>{dash(trip.driverName)}</strong></div>
                <div className="p-2">Mobile: <strong>{dash(trip.driverMobile)}</strong></div>
              </div>

              <table className="w-full border-collapse">
                <thead className="bg-slate-100">
                  <tr>
                    <th className={cell}>#</th>
                    <th className={`${cell} text-left`}>Description</th>
                    <th className={cell}>Lot / Taka</th>
                    <th className={cell}>Packages</th>
                    <th className={`${cell} text-right`}>Meters</th>
                    <th className={`${cell} text-right`}>Weight (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.length === 0 && (
                    <tr><td colSpan={6} className={`${cell} text-center text-slate-500`}>No material lines on this trip.</td></tr>
                  )}
                  {materials.map((m, i) => (
                    <tr key={m.id || i}>
                      <td className={`${cell} text-center`}>{i + 1}</td>
                      <td className={cell}>{m.itemName || (m.lotNumber ? `Fabric roll — Lot ${m.lotNumber}` : '—')}</td>
                      <td className={`${cell} font-mono text-center`}>{[m.lotNumber, m.takaNumber].filter(Boolean).join(' / ') || '—'}</td>
                      <td className={`${cell} text-center`}>1 roll</td>
                      <td className={`${cell} text-right font-mono`}>{fmtNum(m.quantity)}</td>
                      <td className={`${cell} text-right font-mono`}>{fmtNum(m.rollWeight)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-slate-50">
                    <td className={cell} colSpan={3}>TOTAL</td>
                    <td className={`${cell} text-center`}>{materials.length} rolls</td>
                    <td className={`${cell} text-right font-mono`}>{fmtNum(totalQty)}</td>
                    <td className={`${cell} text-right font-mono`}>{fmtNum(totalKg)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="grid grid-cols-5 border border-slate-400">
                {[
                  ['Freight', trip.freightAmount], ['Loading', trip.loadingCharges], ['Unloading', trip.unloadingCharges],
                  ['Other', trip.otherCharges], ['Total', trip.totalCharges],
                ].map(([k, v], i) => (
                  <div key={k} className={`p-2 ${i < 4 ? 'border-r border-slate-400' : ''} ${k === 'Total' ? 'font-bold' : ''}`}>{k}: {fmtMoney(v)}</div>
                ))}
              </div>
              <div className="grid grid-cols-3 border border-slate-400">
                <div className="p-2 border-r border-slate-400">Paid by: <strong>{dash(trip.paidBy)}</strong></div>
                <div className="p-2 border-r border-slate-400">Dispatch: {trip.dispatchTime ? new Date(trip.dispatchTime).toLocaleString('en-IN') : '—'}</div>
                <div className="p-2">Delivery: {trip.deliveryTime ? new Date(trip.deliveryTime).toLocaleString('en-IN') : '—'}</div>
              </div>
              {trip.remarks && <div className="border border-slate-400 p-2">Remarks: {trip.remarks}</div>}

              <div className="grid grid-cols-3 gap-6 pt-4 text-center">
                {SIGNATORIES.map(({ key, label }) => {
                  const sig = trip.signatures?.[key];
                  return (
                    <div key={key}>
                      {sig ? <SignatureMark sig={sig} /> : (
                        <div className="h-14 flex items-end justify-center pb-1 no-print">
                          <button type="button" onClick={() => setSigning(key)}
                            className="px-2.5 py-1 rounded border border-dashed border-blue-400 text-blue-700 hover:bg-blue-50 text-[10px] font-bold inline-flex items-center gap-1">
                            <PenTool size={11} /> Sign digitally
                          </button>
                        </div>
                      )}
                      {!sig && <div className="h-14 hidden print:block" />}
                      <div className="border-t border-slate-500 pt-1">{label}</div>
                      {sig && (
                        <div className="text-[9px] text-slate-500 leading-tight">
                          {sig.name}{sig.designation ? `, ${sig.designation}` : ''}
                          <br />{sig.signedAt ? new Date(sig.signedAt).toLocaleString('en-IN') : ''}
                          <button type="button" onClick={() => clearSignature(key)} className="ml-1 text-rose-600 hover:underline no-print">remove</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-[9px] text-slate-500 text-center">Company copy of the consignment; the LR number is issued by the transporter.</div>
            </div>
          </div>
        )}
      </div>
      {signing && (() => {
        const s = SIGNATORIES.find((x) => x.key === signing);
        return (
          <DigitalSignatureModal
            isOpen
            onClose={() => setSigning(null)}
            signatoryType={s.modalType}
            documentTitle={`Lorry Receipt ${trip?.lrNumber || trip?.tripNumber || ''} — ${s.label}`}
            defaultName={s.key === 'driver' ? (trip?.driverName || '') : s.key === 'consignor' ? (companyProfile?.name || '') : ''}
            defaultDesignation={s.designation}
            onSave={(sig) => saveSignature(s.key, sig)}
            isSaving={savingSig}
          />
        );
      })()}
    </div>
  );
}

export default PrintLorryReceiptModal;
