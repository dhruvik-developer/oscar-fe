import React, { useState } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import MasterSourceLink from '../../components/common/MasterSourceLink';
export const ReportFaultyModal = ({ isOpen, onClose, onSubmit, }) => {
    const [product, setProduct] = useState('');
    const { vendors = [] } = useERP() || {};
    const [vendor, setVendor] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [qty, setQty] = useState(1);
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    if (!isOpen)
        return null;
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!product.trim() || !serialNumber.trim()) {
            setError('Product name and Serial Number are required.');
            return;
        }
        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
        onSubmit({
            product,
            vendor,
            serialNumber,
            qty: Number(qty) || 1,
            notes: notes.trim(),
            status: 'Reported',
            date: formattedDate,
            // The server allocates the RMA number and records who reported it.
        });
        onClose();
    };
    return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white rounded-lg border border-[#CED4DA] shadow-xl w-full max-w-lg max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-[#CED4DA] flex items-center justify-between gap-2 lg:gap-0 bg-[#F8F9FA]">
          <div className="flex items-center gap-2.5 min-w-0 lg:min-w-auto">
            <div className="w-8 h-8 rounded bg-[#1F2E4A]/10 text-[#1F2E4A] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4"/>
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1F2E4A]">Report Faulty Part</h3>
              <p className="text-xs text-[#5a6062]">Initiate RMA diagnostic and vendor replacement flow</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#767c7e] hover:text-[#1F2E4A] p-1 rounded-md transition-colors">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-sm text-[#2d3335]">
          {error && (<div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
              {error}
            </div>)}

          <div>
            <label className="block text-xs font-semibold text-[#1F2E4A] uppercase tracking-wider mb-1">
              Product Description *
            </label>
            <input type="text" required placeholder="Product name" value={product} onChange={(e) => {
            setProduct(e.target.value);
            setError('');
        }} className="w-full border border-[#CED4DA] rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1F2E4A]"/>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F2E4A] uppercase tracking-wider mb-1">
                Serial Number (S/N) *
              </label>
              <input type="text" required placeholder="e.g. FCW2348L0P9" value={serialNumber} onChange={(e) => {
            setSerialNumber(e.target.value);
            setError('');
        }} className="w-full border border-[#CED4DA] rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1F2E4A]"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F2E4A] uppercase tracking-wider mb-1">
                Defective Quantity
              </label>
              <input type="number" min="1" value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-full border border-[#CED4DA] rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1F2E4A]"/>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#1F2E4A] uppercase tracking-wider">
                Vendor / Distributor
              </label>
              <MasterSourceLink source="vendors" />
            </div>
            <select value={vendor} onChange={(e) => setVendor(e.target.value)} className="w-full border border-[#CED4DA] rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1F2E4A] bg-white">
              <option value="">Select vendor</option>
              {vendors.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1F2E4A] uppercase tracking-wider mb-1">
              Diagnostic & Failure Details
            </label>
            <textarea rows={3} placeholder="e.g. Port 12-24 failing PoE negotiation. Diagnostic logs attached..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-[#CED4DA] rounded p-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#1F2E4A]"/>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-[#CED4DA] flex flex-wrap lg:flex-nowrap items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#CED4DA] text-[#343A40] rounded text-xs font-medium hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-[#1F2E4A] hover:bg-[#152036] text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm">
              <Check className="w-3.5 h-3.5"/>
              Register Faulty Part
            </button>
          </div>
        </form>
      </div>
    </div>);
};
