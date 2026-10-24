import React, { useState } from 'react';
import { Plus, Printer, Edit2, CheckCircle2, Truck, X, Save, FileText } from 'lucide-react';
import { ReportFaultyModal } from './ReportFaultyModal';
import { PrintLabelModal } from './PrintLabelModal';
export const FaultyPartsView = ({ parts, onAddPart, onUpdatePartStatus, onUpdatePartNotes, searchTerm = '', }) => {
    const [selectedPartId, setSelectedPartId] = useState(parts[0]?.id || 'fp-1');
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [isEditNotesModalOpen, setIsEditNotesModalOpen] = useState(false);
    const [editNotesValue, setEditNotesValue] = useState('');
    const [toastMessage, setToastMessage] = useState(null);
    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };
    const filteredParts = parts.filter((p) => {
        if (!searchTerm.trim())
            return true;
        const term = searchTerm.toLowerCase();
        return (String(p.product ?? '').toLowerCase().includes(term) ||
            String(p.vendor ?? '').toLowerCase().includes(term) ||
            String(p.rmaNumber ?? '').toLowerCase().includes(term) ||
            String(p.serialNumber ?? '').toLowerCase().includes(term) ||
            String(p.status ?? '').toLowerCase().includes(term));
    });
    const selectedPart = parts.find((p) => p.id === selectedPartId) || parts[0] || null;
    const handleMarkAsShipped = (partId) => {
        onUpdatePartStatus(partId, 'Sent for Replacement');
        showToast(`RMA Package marked as shipped to vendor courier.`);
    };

    const handleOpenEditNotes = () => {
        if (!selectedPart) return;
        setEditNotesValue(selectedPart.notes || '');
        setIsEditNotesModalOpen(true);
    };

    const handleSaveNotes = (e) => {
        e.preventDefault();
        if (!selectedPart) return;
        if (onUpdatePartNotes) {
            onUpdatePartNotes(selectedPart.id, editNotesValue);
        }
        selectedPart.notes = editNotesValue;
        setIsEditNotesModalOpen(false);
        showToast('RMA diagnostic notes updated successfully.');
    };
    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'Reported':
                return 'bg-[#f1f3f5] text-[#1F2E4A] border-[#CED4DA] font-semibold';
            case 'Sent for Replacement':
                return 'bg-[#f1f3f5] text-[#343A40] border-[#CED4DA]';
            case 'Replaced':
                return 'bg-[#e8f5e9] text-[#1b5e20] border-[#c8e6c9]';
            case 'Credited':
                return 'bg-[#f1f3f5] text-[#343A40] border-[#CED4DA]';
            case 'Closed':
                return 'bg-[#f1f3f5] text-[#767c7e] border-[#CED4DA]';
            default:
                return 'bg-[#f1f3f5] text-[#343A40] border-[#CED4DA]';
        }
    };
    return (<div className="flex-1 flex flex-col lg:flex-row lg:h-[calc(100vh-56px)] lg:overflow-hidden font-sans">
      {/* Toast Notification */}
      {toastMessage && (<div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 bg-[#1F2E4A] text-white text-xs px-4 py-2.5 rounded shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400"/>
          <span>{toastMessage}</span>
        </div>)}

      {/* Left Pane: List View */}
      <div className="flex-1 min-w-0 lg:min-w-auto flex flex-col h-full bg-transparent overflow-x-auto lg:overflow-hidden">
        {/* Header Actions */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 lg:gap-0 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-[#1F2E4A] tracking-tight">
              Faulty Parts
            </h2>
            <p className="text-[#343A40] mt-1 text-xs">
              Manage RMA and replacement lifecycle
            </p>
          </div>
          <button onClick={() => setIsReportModalOpen(true)} className="bg-[#1F2E4A] hover:bg-[#152036] text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 shadow-sm transition-all active:scale-[0.99] cursor-pointer">
            <Plus className="w-4 h-4"/>
            Report Faulty
          </button>
        </div>

        {/* Data Table Header */}
        <div className="px-4 pr-[calc(1rem+8px)] sm:px-8 sm:pr-[calc(2rem+8px)] min-w-[640px] lg:min-w-0 flex items-center border-b border-[#CED4DA] pb-2 text-xs font-semibold text-[#343A40] uppercase tracking-wider shrink-0 select-none">
          <div className="w-[120px]">Date</div>
          <div className="flex-1">Product</div>
          <div className="w-[80px]">Qty</div>
          <div className="w-[150px]">Vendor</div>
          <div className="w-[150px]">Status</div>
        </div>

        {/* Data Table Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8 min-w-[640px] lg:min-w-0 space-y-0 text-sm">
          {filteredParts.length === 0 ? (<div className="py-12 text-center text-xs text-[#767c7e]">
              No faulty parts match your search criteria.
            </div>) : (filteredParts.map((part) => {
            const isActive = selectedPart?.id === part.id;
            return (<div key={part.id} onClick={() => setSelectedPartId(part.id)} className={`flex items-center h-[42px] border-b border-[#CED4DA] cursor-pointer transition-all duration-150 pr-4 ${isActive
                    ? 'bg-[#e9ecef] border-l-4 border-l-[#1F2E4A] pl-3 -ml-1 shadow-2xs font-medium'
                    : 'hover:bg-[#f1f3f5] pl-0 text-[#343A40]'}`}>
                  <div className="w-[120px] text-xs text-[#343A40]">
                    {part.date}
                  </div>
                  <div className="flex-1 font-medium text-[#1F2E4A] truncate pr-2">
                    {part.product}
                  </div>
                  <div className="w-[80px] text-[#343A40] font-mono text-xs">
                    {part.qty}
                  </div>
                  <div className="w-[150px] text-[#343A40] truncate text-xs">
                    {part.vendor}
                  </div>
                  <div className="w-[150px]">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] border ${getStatusBadgeStyle(part.status)}`}>
                      {part.status}
                    </span>
                  </div>
                </div>);
        }))}
        </div>
      </div>

      {/* Right Pane: Detail View / Timeline */}
      {selectedPart && (<aside className="w-full lg:w-[400px] border-t lg:border-t-0 lg:border-l border-[#CED4DA] bg-white h-full flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.03)] shrink-0 z-10">
          {/* Detail Header */}
          <div className="p-4 sm:p-6 border-b border-[#CED4DA] bg-white shrink-0">
            <div className="flex justify-between items-start mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#f1f3f5] text-[#1F2E4A] border border-[#CED4DA] uppercase tracking-wide">
                {selectedPart.status}
              </span>
              <span className="text-xs text-[#343A40] font-mono font-medium">
                {selectedPart.rmaNumber}
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#1F2E4A] leading-tight">
              {selectedPart.product}
            </h3>
            <p className="text-sm text-[#343A40] mt-1 font-mono text-xs">
              S/N: {selectedPart.serialNumber} • Qty: {selectedPart.qty}
            </p>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleOpenEditNotes}
                className="flex-1 bg-white border border-[#CED4DA] text-[#1F2E4A] py-1.5 rounded text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Edit2 className="w-3.5 h-3.5"/>
                Edit Diagnostics
              </button>
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="flex-1 bg-white border border-[#CED4DA] text-[#1F2E4A] py-1.5 rounded text-xs font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5"/>
                Print Label
              </button>
            </div>
          </div>

          {/* Detail Body (Timeline) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white">
            <h4 className="text-xs font-bold uppercase text-[#343A40] tracking-wider mb-6">
              Lifecycle Timeline
            </h4>

            <div className="relative pl-5 ml-1 border-l border-[#CED4DA] pb-4 space-y-7">
              {/* Step 1: Fault Reported */}
              <div className="relative">
                <div className="timeline-dot completed"/>
                <div className="pl-3">
                  <div className="text-xs text-[#343A40] mb-0.5">
                    {selectedPart.date} • 09:41 AM
                  </div>
                  <div className="font-semibold text-[#1F2E4A] text-sm">
                    Fault Reported
                  </div>
                  <div className="text-xs text-[#343A40] mt-1.5 bg-[#F8F9FA] p-2.5 rounded border border-[#CED4DA] leading-relaxed">
                    {selectedPart.notes ||
                'Port 12-24 failing PoE negotiation. Diagnostic logs attached. Initiated by System Admin.'}
                  </div>
                </div>
              </div>

              {/* Step 2: Ship to Vendor */}
              <div className="relative">
                <div className={`timeline-dot ${selectedPart.status === 'Sent for Replacement' ||
                selectedPart.status === 'Replaced' ||
                selectedPart.status === 'Credited' ||
                selectedPart.status === 'Closed'
                ? 'completed'
                : 'border-[#1F2E4A] bg-white'}`}>
                  {selectedPart.status === 'Reported' && (<div className="w-1.5 h-1.5 bg-[#1F2E4A] rounded-full absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%]"/>)}
                </div>
                <div className="pl-3">
                  <div className="text-xs text-[#343A40] mb-0.5">
                    {selectedPart.status === 'Reported'
                ? 'Pending Action'
                : 'Shipped Oct 25, 2023'}
                  </div>
                  <div className="font-semibold text-[#1F2E4A] text-sm">
                    Ship to Vendor
                  </div>
                  {selectedPart.status === 'Reported' ? (<div className="mt-2.5">
                      <button onClick={() => handleMarkAsShipped(selectedPart.id)} className="bg-[#1F2E4A] hover:bg-[#152036] text-white px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs">
                        <Truck className="w-3.5 h-3.5"/>
                        Mark as Shipped
                      </button>
                    </div>) : (<p className="text-xs text-[#5a6062] mt-1">
                      Carrier: FedEx Logistics (Tracking: FX-90812301)
                    </p>)}
                </div>
              </div>

              {/* Step 3: Vendor Assessment */}
              <div className={`relative ${selectedPart.status === 'Reported' ? 'opacity-50' : ''}`}>
                <div className={`timeline-dot ${selectedPart.status === 'Replaced' ||
                selectedPart.status === 'Credited' ||
                selectedPart.status === 'Closed'
                ? 'completed'
                : 'bg-white'}`}/>
                <div className="pl-3">
                  <div className="text-xs text-[#343A40] mb-0.5">
                    {selectedPart.status === 'Sent for Replacement'
                ? 'In Review • ETA 3 days'
                : 'Expected: Oct 28, 2023'}
                  </div>
                  <div className="font-semibold text-[#1F2E4A] text-sm">
                    Vendor Assessment
                  </div>
                  {selectedPart.status === 'Sent for Replacement' && (<div className="mt-2 flex gap-2">
                      <button onClick={() => {
                    onUpdatePartStatus(selectedPart.id, 'Replaced');
                    showToast('Part marked as Replaced and Restocked.');
                }} className="bg-[#1F2E4A] text-white px-2.5 py-1 rounded text-xs hover:bg-[#152036]">
                        Approve Replacement
                      </button>
                      <button onClick={() => {
                    onUpdatePartStatus(selectedPart.id, 'Credited');
                    showToast('Credit memo recorded for RMA item.');
                }} className="border border-[#CED4DA] text-xs px-2 py-1 rounded hover:bg-gray-100">
                        Issue Credit
                      </button>
                    </div>)}
                </div>
              </div>

              {/* Step 4: Replacement / Credit */}
              <div className={`relative ${selectedPart.status === 'Reported' ||
                selectedPart.status === 'Sent for Replacement'
                ? 'opacity-50'
                : ''}`}>
                <div className={`timeline-dot ${selectedPart.status === 'Replaced' ||
                selectedPart.status === 'Credited' ||
                selectedPart.status === 'Closed'
                ? 'completed'
                : 'bg-white'}`}/>
                <div className="pl-3">
                  <div className="font-semibold text-[#1F2E4A] text-sm">
                    Replacement / Credit
                  </div>
                  <p className="text-xs text-[#5a6062] mt-0.5">
                    {selectedPart.status === 'Replaced'
                ? 'New hardware registered in inventory master.'
                : selectedPart.status === 'Credited'
                    ? 'Vendor credit applied to accounting account.'
                    : 'Final RMA resolution & item closure.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>)}

      {/* Modals */}
      <ReportFaultyModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} onSubmit={onAddPart}/>

      {selectedPart && (<PrintLabelModal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} part={selectedPart}/>)}

      {/* Edit Diagnostic Notes Modal */}
      {isEditNotesModalOpen && selectedPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col text-[#1F2E4A]">
            <div className="flex items-center justify-between gap-2 lg:gap-0 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5 min-w-0 lg:min-w-auto">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1F2E4A]">
                    Edit RMA Diagnostic Notes
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedPart.rmaNumber} • S/N: {selectedPart.serialNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditNotesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNotes} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Part / Equipment Name
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedPart.product}
                  className="w-full text-xs px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Technical Diagnostic & Failure Observations <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={editNotesValue}
                  onChange={(e) => setEditNotesValue(e.target.value)}
                  placeholder="Detail the failure symptoms, test bench findings, error codes, burn-in diagnostics..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-y transition font-sans"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  These notes will appear on warranty RMA logs, courier manifests, and vendor credit slips.
                </p>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditNotesModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1F2E4A] hover:bg-[#152033] rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Save size={14} />
                  Save Diagnostics
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>);
};
