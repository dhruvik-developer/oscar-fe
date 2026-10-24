import React, { useEffect, useState } from 'react';
import { Printer, Truck, X } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { api } from '../../services/api';
import { dash, fmtDate, fmtNum, fmtAddress, partyAddress } from './printDocUtils';

/**
 * Job Work Outward Challan -- delivery challan for goods sent to a processor
 * for job work (requirement PDF section 07; GST Sec. 143 job-work challan,
 * reported in ITC-04). Read from the saved JWO + outward row (and its taka
 * lines); a draft outward prints with a "not valid for dispatch" watermark.
 */
export function PrintJobWorkChallanModal({ isOpen, onClose, jwoId, outwardId }) {
  const { companyProfile, items = [] } = useERP();
  const [jwo, setJwo] = useState(null);
  const [processor, setProcessor] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !jwoId) return undefined;
    let live = true;
    setError('');
    setJwo(null);
    setProcessor(null);
    api.get(`/jobwork/orders/${jwoId}/`)
      .then((o) => {
        if (!live) return;
        setJwo(o);
        if (o?.vendorId) api.get(`/parties/${o.vendorId}/`).then((p) => live && setProcessor(p)).catch(() => {});
      })
      .catch((err) => live && setError(err?.message || 'Could not load the job work order.'));
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => { live = false; document.removeEventListener('keydown', onKey); };
  }, [isOpen, jwoId, onClose]);

  if (!isOpen) return null;

  const outward = (jwo?.outwards || []).find((o) => String(o.id) === String(outwardId));
  const material = (jwo?.materials || [])[0] || {};
  const item = items.find((i) => i.name && (i.name === material.fabricItem || i.name === material.fabric_item));
  const hsn = item?.hsnCode || item?.hsn_code || item?.hsn || '';
  const takas = outward?.takas || [];
  const rows = takas.length > 0
    ? takas.map((t) => ({ lot: t.lotNo, taka: t.takaNo, meters: t.meters, kg: t.weight_kg ?? t.weightKg }))
    : [{ lot: material.lotNo || material.lot_no, taka: null, meters: outward?.qty, kg: null }];
  const totalMeters = rows.reduce((s, r) => s + Number(r.meters || 0), 0);
  const totalKg = rows.reduce((s, r) => s + Number(r.kg || 0), 0);
  const isDraft = (outward?.status || '').toLowerCase() === 'draft';
  const cell = 'border border-slate-400 px-2 py-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-auto overflow-hidden print:shadow-none print:max-w-none print:rounded-none">
        <div className="bg-[#1F2E4A] text-white px-4 py-3 flex items-center justify-between no-print">
          <span className="font-bold text-sm flex items-center gap-2"><Truck size={15} /> Job Work Outward Challan — {outward?.no || '…'}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!outward} onClick={() => window.print()}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-xs flex items-center gap-1.5 disabled:opacity-50">
              <Printer size={14} /> Print / Save as PDF
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X size={18} /></button>
          </div>
        </div>

        {error && <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 no-print">{error}</div>}
        {!jwo && !error && <div className="p-6 text-xs text-slate-500 no-print">Loading challan…</div>}
        {jwo && !outward && <div className="p-6 text-xs text-rose-600 no-print">This outward challan was not found on the job work order.</div>}

        {outward && (
          <div className="overflow-x-auto print:overflow-visible">
            <div className="printable-document p-8 min-w-[720px] print:min-w-0 bg-white text-slate-900 text-[11px] space-y-3 relative">
              {isDraft && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-5xl font-black text-rose-200 rotate-[-20deg]">DRAFT – NOT VALID FOR DISPATCH</span>
                </div>
              )}
              <div className="flex justify-between border-b-2 border-slate-900 pb-2">
                <div>
                  <div className="text-lg font-extrabold uppercase">{dash(companyProfile?.name)}</div>
                  <div>{fmtAddress(companyProfile?.address) || '—'}</div>
                  <div>GSTIN: {dash(companyProfile?.gstin)} · PAN: {dash(companyProfile?.pan)} · Phone: {dash(companyProfile?.phone)}</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold">DELIVERY CHALLAN</div>
                  <div className="text-[10px]">Sent for Job Work (Sec. 143, CGST Act)</div>
                  <div className="mt-1">Challan No: <strong className="font-mono">{dash(outward.no)}</strong></div>
                  <div>Date: <strong>{fmtDate(outward.date)}</strong></div>
                  <div>Status: {dash(outward.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 border border-slate-400">
                <div className="p-2 border-r border-slate-400">
                  <div className="font-bold uppercase text-[10px] text-slate-500">Consignor (Company)</div>
                  <div className="font-bold">{dash(companyProfile?.name)}</div>
                  <div>{fmtAddress(companyProfile?.address) || '—'}</div>
                  <div>GSTIN: {dash(companyProfile?.gstin)}</div>
                </div>
                <div className="p-2">
                  <div className="font-bold uppercase text-[10px] text-slate-500">Consignee (Processor / Job Worker)</div>
                  <div className="font-bold">{dash(processor?.name || jwo.vendor)}</div>
                  <div>{partyAddress(processor) || '—'}</div>
                  <div>GSTIN: {dash(processor?.gstin)} · State: {dash(processor?.state || processor?.placeOfSupply)}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 border border-slate-400">
                <div className="p-2 border-r border-slate-400">JWO: <strong className="font-mono">{dash(jwo.jwoNo)}</strong></div>
                <div className="p-2 border-r border-slate-400">Project: <strong>{dash(jwo.projectCode)}</strong></div>
                <div className="p-2">Process: <strong>{dash(jwo.process)}</strong></div>
                <div className="p-2 border-r border-t border-slate-400">Shade: {dash(material.shade)}</div>
                <div className="p-2 border-r border-t border-slate-400">Expected return: {fmtDate(jwo.expectedCompletion)}</div>
                <div className="p-2 border-t border-slate-400">Source warehouse: {dash(outward.warehouse)}</div>
              </div>

              <table className="w-full border-collapse">
                <thead className="bg-slate-100">
                  <tr>
                    <th className={cell}>#</th>
                    <th className={`${cell} text-left`}>Fabric / Quality</th>
                    <th className={cell}>HSN</th>
                    <th className={cell}>Lot No</th>
                    <th className={cell}>Taka / Roll</th>
                    <th className={`${cell} text-right`}>Meters</th>
                    <th className={`${cell} text-right`}>Kg</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className={`${cell} text-center`}>{i + 1}</td>
                      <td className={cell}>{[material.fabricItem || material.fabric_item, material.fabricQuality || material.fabric_quality].filter(Boolean).join(' · ') || '—'}</td>
                      <td className={`${cell} text-center font-mono`}>{dash(hsn)}</td>
                      <td className={`${cell} text-center font-mono`}>{dash(r.lot)}</td>
                      <td className={`${cell} text-center font-mono`}>{dash(r.taka)}</td>
                      <td className={`${cell} text-right font-mono`}>{fmtNum(r.meters)}</td>
                      <td className={`${cell} text-right font-mono`}>{r.kg ? fmtNum(r.kg) : '—'}</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-slate-50">
                    <td className={cell} colSpan={4}>TOTAL</td>
                    <td className={`${cell} text-center`}>{takas.length ? `${takas.length} taka` : '—'}</td>
                    <td className={`${cell} text-right font-mono`}>{fmtNum(totalMeters)}</td>
                    <td className={`${cell} text-right font-mono`}>{totalKg ? fmtNum(totalKg) : '—'}</td>
                  </tr>
                </tbody>
              </table>

              <div className="grid grid-cols-4 border border-slate-400">
                <div className="p-2 border-r border-slate-400">LR No: <strong className="font-mono">{dash(outward.lrNo)}</strong></div>
                <div className="p-2 border-r border-slate-400">Transporter: {dash(outward.transporter)}</div>
                <div className="p-2 border-r border-slate-400">Vehicle: <span className="font-mono">{dash(outward.vehicleNo)}</span></div>
                <div className="p-2">Driver: {dash(outward.driver)}</div>
              </div>
              {outward.remarks && <div className="border border-slate-400 p-2">Remarks: {outward.remarks}</div>}

              <div className="border border-slate-400 p-2 text-[10px]">
                Goods are sent for job work and remain the property of the consignor. They are to be returned after
                processing (or the loss accounted) within the period allowed under GST law.
              </div>

              <div className="grid grid-cols-3 gap-6 pt-10 text-center">
                <div className="border-t border-slate-500 pt-1">Authorised Sender (sign)</div>
                <div className="border-t border-slate-500 pt-1">Transporter (sign)</div>
                <div className="border-t border-slate-500 pt-1">Received by Processor (stamp &amp; sign)</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PrintJobWorkChallanModal;
