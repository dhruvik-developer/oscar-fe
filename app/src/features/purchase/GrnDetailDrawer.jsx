import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, PackageCheck, ShieldCheck, FileText, RefreshCw } from 'lucide-react';
import { Drawer } from '../../components/ui/Drawer';
import api from '../../services/api';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { formatQty } from '../../utils/uom';
import { numIN } from '../../utils/formatters';

const QC_PILL = {
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

const pick = (obj, camel, snake) => obj?.[camel] ?? obj?.[snake];

// QC disposition stores its split as JSON in qcNote (apps/inventory/qc.py);
// older GRNs hold a plain-text note.
function parseQcNote(raw) {
  const text = String(raw || '').trim();
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const meta = JSON.parse(text);
      const c = meta.cumulative || {};
      const num = (v) => Number(v) || 0;
      return {
        remarks: meta.remarks || '',
        split: {
          Good: num(c.good ?? meta.goodQty),
          'Second Quality': num(c.second ?? meta.secondQualityQty),
          Reprocess: num(c.reprocess ?? meta.reprocessQty),
          Rejected: num(c.reject ?? meta.rejectedQty),
          Hold: num(meta.holdQty),
        },
      };
    } catch {
      // fall through to plain text
    }
  }
  return { remarks: text, split: null };
}

const SPLIT_TONE = {
  Good: 'text-emerald-700', 'Second Quality': 'text-sky-700', Reprocess: 'text-violet-700', Rejected: 'text-rose-700', Hold: 'text-amber-700',
};

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-right font-medium text-slate-900 min-w-0 break-words">{children || '—'}</span>
    </div>
  );
}

/**
 * Read-only view of one GRN (Goods Receipt Note): header, received lines and
 * QC outcome. Shows the list row straight away, then refreshes from
 * GET /purchase/receipts/{id}/.
 */
export default function GrnDetailDrawer({ grn, onClose }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(grn);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDetail(grn);
    if (!grn?.id) return undefined;
    let active = true;
    setLoading(true);
    api.get(`/purchase/receipts/${grn.id}/`)
      .then((res) => { if (active && res) setDetail((prev) => ({ ...prev, ...res })); })
      .catch(() => {}) // the list row is still shown
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [grn]);

  if (!grn) return null;

  const g = detail || grn;
  const grnNumber = pick(g, 'grnNumber', 'grn_number');
  const qcStatus = pick(g, 'qcStatus', 'qc_status') || 'Pending';
  const qcAt = pick(g, 'qcAt', 'qc_at');
  const qc = parseQcNote(pick(g, 'qcNote', 'qc_note'));
  const challanNo = pick(g, 'supplierChallanNo', 'supplier_challan_no');
  const challanDate = pick(g, 'supplierChallanDate', 'supplier_challan_date');
  const poId = pick(g, 'purchaseOrder', 'purchase_order');
  const lines = Array.isArray(g.lines) ? g.lines : [];
  const totalValue = lines.reduce((s, l) => s + (Number(l.receivedQty) || 0) * (Number(l.unitCost) || 0), 0);

  return (
    <Drawer
      isOpen
      onClose={onClose}
      width="lg"
      title={grnNumber || 'Goods Receipt'}
      subtitle={[g.vendorName, formatDateDDMMYYYY(pick(g, 'receiptDate', 'receipt_date'))].filter(Boolean).join(' • ')}
      footer={
        <>
          {poId && (
            <button
              type="button"
              onClick={() => navigate(`/purchase/orders?po=${poId}`)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
            >
              <ExternalLink size={13} /> Open {g.poNumber || 'PO'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Close
          </button>
        </>
      }
    >
      <div className="space-y-5 text-xs">
        {/* Header facts */}
        <section className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <FileText size={14} className="text-slate-400" /> Receipt Details
            </h3>
            <div className="flex items-center gap-2">
              {loading && <RefreshCw size={12} className="animate-spin text-slate-400" aria-label="Refreshing" />}
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${QC_PILL[qcStatus] || 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                QC {qcStatus}
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            <InfoRow label="GRN Number"><span className="font-mono">{grnNumber}</span></InfoRow>
            <InfoRow label="Receipt Date">{formatDateDDMMYYYY(pick(g, 'receiptDate', 'receipt_date'))}</InfoRow>
            <InfoRow label="Supplier">
              {g.vendorName}{g.vendorCode ? <span className="text-slate-400 font-mono"> ({g.vendorCode})</span> : null}
            </InfoRow>
            <InfoRow label="PO Number"><span className="font-mono">{g.poNumber}</span></InfoRow>
            <InfoRow label="Supplier Challan">
              {challanNo ? <><span className="font-mono">{challanNo}</span>{challanDate ? ` (${formatDateDDMMYYYY(challanDate)})` : ''}</> : null}
            </InfoRow>
            <InfoRow label="Vendor Bill">
              {g.billNumber ? <span className="font-mono">{g.billNumber}</span> : <span className="text-slate-400 font-normal">Not billed yet</span>}
            </InfoRow>
          </div>
        </section>

        {/* Received lines */}
        <section className="rounded-xl border border-slate-200 overflow-hidden">
          <h3 className="font-bold text-slate-900 flex items-center gap-1.5 px-4 py-3 border-b border-slate-100">
            <PackageCheck size={14} className="text-slate-400" /> Received Material ({lines.length})
          </h3>
          {lines.length === 0 ? (
            <p className="px-4 py-6 text-center text-slate-400">No line items on this GRN.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Ordered</th>
                    <th className="px-3 py-2 text-right">Received</th>
                    <th className="px-3 py-2 text-right">Taka / Roll</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l, i) => {
                    const short = Number(l.shortageQty) || 0;
                    const rejected = Number(l.rejectedQty) || 0;
                    const excess = Number(l.excessQty) || 0;
                    return (
                      <tr key={l.id || i} className="align-top">
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-slate-900">{l.itemName || l.sku || '—'}</p>
                          <p className="text-[10.5px] text-slate-400 font-mono">
                            {[l.sku, l.batchNumber && `Lot ${l.batchNumber}`].filter(Boolean).join(' • ')}
                          </p>
                          {(short > 0 || rejected > 0 || excess > 0) && (
                            <p className="mt-0.5 text-[10.5px] font-semibold">
                              {short > 0 && <span className="text-amber-700 mr-2">Short {formatQty(short, l.uom)}</span>}
                              {rejected > 0 && <span className="text-rose-700 mr-2">Rejected {formatQty(rejected, l.uom)}</span>}
                              {excess > 0 && <span className="text-sky-700">Excess {formatQty(excess, l.uom)}</span>}
                            </p>
                          )}
                          {l.remarks && <p className="mt-0.5 text-[10.5px] text-slate-500">{l.remarks}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">{formatQty(l.orderedQty, l.uom)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900">
                          {formatQty(l.receivedQty, l.uom)}
                          {Number(l.weightKg) > 0 && l.uom !== 'Kg' && (
                            <span className="block text-[10.5px] font-normal text-slate-400">{formatQty(l.weightKg, 'Kg')}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-700">{l.rollCount ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                          {Number(l.unitCost) > 0 ? `₹${numIN(l.unitCost)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {totalValue > 0 && (
                  <tfoot className="bg-slate-50 font-semibold">
                    <tr>
                      <td className="px-4 py-2 text-slate-600" colSpan={4}>Received value</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-900">₹{numIN(totalValue)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>

        {/* QC outcome */}
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-1.5 mb-2">
            <ShieldCheck size={14} className="text-slate-400" /> Quality Check
          </h3>
          <div className="divide-y divide-slate-100">
            <InfoRow label="Status">{qcStatus}</InfoRow>
            <InfoRow label="Checked On">{qcAt ? formatDateDDMMYYYY(String(qcAt).slice(0, 10)) : null}</InfoRow>
            <InfoRow label="QC Note">{qc.remarks}</InfoRow>
          </div>
          {qc.split && (
            <div className="mt-3 grid grid-cols-5 gap-2 text-center">
              {Object.entries(qc.split).map(([label, qty]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-1 py-1.5">
                  <span className="block text-[10px] text-slate-500">{label}</span>
                  <span className={`block font-mono font-semibold ${qty > 0 ? SPLIT_TONE[label] : 'text-slate-400'}`}>
                    {formatQty(qty, lines[0]?.uom)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
}
