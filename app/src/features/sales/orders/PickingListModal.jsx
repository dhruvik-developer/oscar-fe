import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Printer,
  X,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Truck,
  FileText,
  User,
  Calendar,
} from 'lucide-react';
import { SignatureSlot, useDocumentSignatures } from '../../../components/common/SignatureSlot';
import { salesService } from '../../../services/domainServices';

export default function PickingListModal({ orderId, orderNumber, onClose }) {
  const docSigs = useDocumentSignatures('PickingList', orderId, `Picking List ${orderNumber || ''}`);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    salesService
      .getOrderPickingList(orderId)
      .then((res) => {
        setData(res?.data || res);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || err?.message || 'Failed to load picking list.');
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50 print:bg-white">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="font-semibold text-slate-900">
                Warehouse Picking List: {orderNumber || data?.orderNumber}
              </h2>
              <p className="text-xs text-slate-500">
                Verified fabric rolls / takas reserved for vehicle dispatch
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded border border-slate-300"
            >
              <Printer className="w-3.5 h-3.5" /> Print Picking Slip
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto print:max-h-none print:overflow-visible">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading picking list details...</div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          ) : data ? (
            <>
              {/* Order & Customer Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">CUSTOMER</span>
                  <span className="font-bold text-slate-800 text-sm">{data.customerName || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">ORDER DATE</span>
                  <span className="font-semibold text-slate-800">{data.orderDate || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">STATUS</span>
                  <span className="inline-block px-2 py-0.5 rounded font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 mt-0.5">
                    {data.status || 'Confirmed'}
                  </span>
                </div>
              </div>

              {/* Items & Reserved Takas Breakdown */}
              <div className="space-y-4">
                <div className="text-sm font-semibold text-slate-800">
                  Reserved Takas / Rolls to Pick from Godown
                </div>

                {(!data.items || data.items.length === 0) ? (
                  <div className="text-center py-8 text-slate-400 text-sm border border-dashed rounded-lg">
                    No items reserved on this sales order yet.
                  </div>
                ) : (
                  data.items.map((item, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-100/70 p-3 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-slate-900 text-sm">{item.itemName}</span>
                          <span className="text-slate-500 ml-2">SKU: {item.sku || '—'}</span>
                        </div>
                        <div className="font-semibold text-slate-800">
                          Ordered: {item.orderedQty} {item.uom || 'Mtr'}
                        </div>
                      </div>

                      {item.reservedTakas && item.reservedTakas.length > 0 ? (
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">Taka / Barcode</th>
                              <th className="p-2.5">Lot Number</th>
                              <th className="p-2.5">Godown Location</th>
                              <th className="p-2.5 text-right">Available Qty</th>
                              <th className="p-2.5 text-right">Weight (Kg)</th>
                              <th className="p-2.5 text-center">Pick Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {item.reservedTakas.map((taka, tIdx) => (
                              <tr key={tIdx} className="hover:bg-slate-50/50">
                                <td className="p-2.5 font-bold text-slate-900">
                                  {taka.takaId || taka.barcode}
                                </td>
                                <td className="p-2.5 font-medium text-slate-700">{taka.lotNumber}</td>
                                <td className="p-2.5 text-slate-600 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  {taka.locationName || 'Main Godown'}
                                </td>
                                <td className="p-2.5 text-right font-semibold text-indigo-600">
                                  {taka.availableQty} Mtr
                                </td>
                                <td className="p-2.5 text-right text-slate-600">{taka.weightKg || '—'}</td>
                                <td className="p-2.5 text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3" /> Reserved
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-3 text-xs text-amber-700 bg-amber-50/50">
                          No specific takas assigned yet. Rolls will be picked via FIFO at dispatch.
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Picking Sign-off Section */}
              <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-200 text-xs">
                <div>
                  <SignatureSlot doc={docSigs} signatory="picker" label="Warehouse Picker" modalType="authorized" className="h-10" defaultDesignation="Warehouse Picker" />
                  <div className="border-t border-dashed border-slate-400 pt-2 text-center text-slate-500">
                    Warehouse Picker Signature & Date
                  </div>
                </div>
                <div>
                  <SignatureSlot doc={docSigs} signatory="driver" label="Vehicle Driver / Transporter" modalType="receiver" className="h-10" defaultDesignation="Driver / Transporter" />
                  <div className="border-t border-dashed border-slate-400 pt-2 text-center text-slate-500">
                    Vehicle Driver / Transporter Sign & LR Date
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
