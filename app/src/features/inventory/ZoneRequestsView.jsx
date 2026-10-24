import React, { useState } from 'react';
import { Clock, CheckCircle2, TrendingUp, BatteryCharging, MoreVertical, X, Check, AlertCircle, Warehouse, Plus, } from 'lucide-react';
import { CreateZoneRequestModal } from './CreateZoneRequestModal';
export const ZoneRequestsView = ({ requests, onRequestUpdate, onAddRequest, searchTerm = '', }) => {
    const [selectedRequestId, setSelectedRequestId] = useState(requests[0]?.id || 'req-8042');
    const [isDetailOpen, setIsDetailOpen] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };
    const selectedRequest = requests.find((r) => r.id === selectedRequestId) || requests[0] || null;
    // Stats calculation
    const pendingCount = requests.filter((r) => r.status === 'Requested').length;
    const approvedCount = requests.filter((r) => r.status === 'Approved').length;
    const fulfilledCount = requests.filter((r) => r.status === 'Fulfilled').length;
    const total = requests.length;
    const fulfillmentRate = total > 0 ? Math.round((fulfilledCount / total) * 100) : 94;
    const filteredRequests = requests.filter((r) => {
        if (!searchTerm.trim())
            return true;
        const term = searchTerm.toLowerCase();
        return (String(r.product ?? '').toLowerCase().includes(term) ||
            String(r.requestedBy ?? '').toLowerCase().includes(term) ||
            String(r.zone ?? '').toLowerCase().includes(term) ||
            String(r.requestNumber ?? '').toLowerCase().includes(term) ||
            String(r.sku ?? '').toLowerCase().includes(term));
    });
    const handleApprove = (id) => {
        onRequestUpdate(id, 'Approved');
        showToast(`Request approved for zone dispatch.`);
    };
    const handleFulfill = (id) => {
        onRequestUpdate(id, 'Fulfilled');
        showToast(`Stock transferred and fulfilled.`);
    };
    const handleReject = (id) => {
        onRequestUpdate(id, 'Rejected');
        showToast(`Request rejected.`);
    };
    const getStatusBadge = (status) => {
        switch (status) {
            case 'Requested':
                return 'bg-amber-100 text-amber-800';
            case 'Approved':
                return 'bg-blue-100 text-blue-800';
            case 'Fulfilled':
                return 'bg-emerald-100 text-emerald-800';
            case 'Rejected':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    return (<div className="flex-1 flex flex-col lg:flex-row lg:h-[calc(100vh-56px)] bg-[#FBFBFC] lg:overflow-hidden font-sans">
      {/* Toast Notification */}
      {toastMessage && (<div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 bg-[#1F2E4A] text-white text-xs px-4 py-2.5 rounded shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-[#0CB1AC]"/>
          <span>{toastMessage}</span>
        </div>)}

      {/* Table Section */}
      <div className="flex-1 min-w-0 lg:min-w-auto p-4 sm:p-6 overflow-y-auto">
        {/* Bento-style Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Card 1: Pending Requests */}
          <div className="bg-white p-4 rounded-lg border border-[#E1E1E1] flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-xs text-[#5a6062] font-semibold uppercase tracking-wider">
                Pending Requests
              </p>
              <p className="text-2xl font-bold mt-1 text-[#2d3335]">
                {pendingCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <Clock className="w-5 h-5"/>
            </div>
          </div>

          {/* Card 2: Approved Today */}
          <div className="bg-white p-4 rounded-lg border border-[#E1E1E1] flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-xs text-[#5a6062] font-semibold uppercase tracking-wider">
                Approved Today
              </p>
              <p className="text-2xl font-bold mt-1 text-[#2d3335]">
                {approvedCount + 20}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <CheckCircle2 className="w-5 h-5"/>
            </div>
          </div>

          {/* Card 3: Fulfillment Rate */}
          <div className="bg-white p-4 rounded-lg border border-[#E1E1E1] flex items-center justify-between shadow-2xs">
            <div>
              <p className="text-xs text-[#5a6062] font-semibold uppercase tracking-wider">
                Fulfillment Rate
              </p>
              <p className="text-2xl font-bold mt-1 text-[#2d3335]">
                {fulfillmentRate}%
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <TrendingUp className="w-5 h-5"/>
            </div>
          </div>
        </div>

        {/* Action button bar */}
        <div className="flex flex-wrap lg:flex-nowrap justify-between items-center gap-2 lg:gap-0 mb-3">
          <p className="text-xs text-[#5a6062] font-medium">
            Active zone requisition queues across production facilities
          </p>
          <button onClick={() => setIsCreateModalOpen(true)} className="bg-[#0CB1AC] hover:bg-[#0aa09c] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-[0.99]">
            <Plus className="w-4 h-4"/>
            New Requisition
          </button>
        </div>

        {/* Main Data Table inside a Card */}
        <div className="bg-white border border-[#E1E1E1] rounded-lg overflow-x-auto flex flex-col shadow-2xs">
          {/* Table Header */}
          <div className="grid grid-cols-[1.5fr_1.5fr_0.5fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 min-w-[760px] lg:min-w-0 border-b border-[#E1E1E1] bg-[#f1f4f5] text-xs font-semibold text-[#5a6062] uppercase tracking-wider items-center select-none">
            <div>Requested By</div>
            <div>Product</div>
            <div>Qty</div>
            <div>Zone</div>
            <div>Date</div>
            <div>Status</div>
            <div className="text-right">Action</div>
          </div>

          {/* Table Body */}
          <div className="flex flex-col text-sm divide-y divide-[#E1E1E1] min-w-[760px] lg:min-w-0">
            {filteredRequests.length === 0 ? (<div className="py-8 text-center text-xs text-gray-500">
                No zone requests found.
              </div>) : (filteredRequests.map((req) => {
            const isSelected = selectedRequest?.id === req.id;
            return (<div key={req.id} onClick={() => {
                    setSelectedRequestId(req.id);
                    setIsDetailOpen(true);
                }} className={`grid grid-cols-[1.5fr_1.5fr_0.5fr_1fr_1fr_1fr_1fr] gap-4 px-4 items-center h-[42px] cursor-pointer transition-colors duration-150 ${isSelected
                    ? 'bg-[#F0F5E6] border-l-3 border-l-[#0CB1AC] font-medium'
                    : 'hover:bg-[#F0F5E6]/60'}`}>
                    <div className="font-medium text-[#2d3335] truncate text-xs">
                      {req.requestedBy}
                    </div>
                    <div className="truncate text-[#5a6062] text-xs">
                      {req.product}
                    </div>
                    <div className="font-semibold text-xs text-[#2d3335] font-mono">
                      {req.qty}
                    </div>
                    <div className="text-[#5a6062] text-xs">{req.zone}</div>
                    <div className="text-[#5a6062] text-xs">{req.date}</div>
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${getStatusBadge(req.status)}`}>
                        {req.status}
                      </span>
                    </div>
                    <div className="text-right flex items-center justify-end gap-1">
                      {req.status === 'Requested' ? (<button onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(req.id);
                    }} className="bg-[#0CB1AC] text-white text-xs px-3 py-1 rounded font-medium hover:opacity-90 transition-opacity">
                          Approve
                        </button>) : req.status === 'Approved' ? (<button onClick={(e) => {
                        e.stopPropagation();
                        handleFulfill(req.id);
                    }} className="text-xs px-3 py-1 rounded font-medium border border-[#E1E1E1] text-[#5a6062] hover:bg-slate-100 transition-colors">
                          Fulfill
                        </button>) : (<button onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRequestId(req.id);
                        setIsDetailOpen(true);
                    }} className="text-[#767c7e] hover:text-[#0CB1AC] p-1" title="View Details">
                          <MoreVertical className="w-4 h-4"/>
                        </button>)}
                    </div>
                  </div>);
        }))}
          </div>
        </div>
      </div>

      {/* Side Detail Card (List-to-Detail Pattern) */}
      {isDetailOpen && selectedRequest && (<aside className="w-full lg:w-[340px] border-t lg:border-t-0 lg:border-l border-[#E1E1E1] bg-[#F0F5E6] flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.02)] z-10 overflow-y-auto shrink-0 transition-all">
          {/* Detail Header */}
          <div className="p-4 sm:p-6 border-b border-[#E1E1E1] flex justify-between items-start gap-2 lg:gap-0 bg-white/50 backdrop-blur-xs sticky top-0">
            <div>
              <h3 className="font-bold text-lg text-[#2d3335]">
                Request {selectedRequest.requestNumber}
              </h3>
              <p className="text-xs text-[#5a6062] mt-1">
                {selectedRequest.submittedAt}
              </p>
            </div>
            <button onClick={() => setIsDetailOpen(false)} className="text-[#767c7e] hover:text-[#2d3335] p-1 rounded transition-colors" title="Close drawer">
              <X className="w-4 h-4"/>
            </button>
          </div>

          {/* Detail Content */}
          <div className="p-4 sm:p-6 flex-1 flex flex-col gap-6">
            {/* Status Banner */}
            {selectedRequest.status === 'Requested' ? (<div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0"/>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Awaiting Approval
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Requires manager sign-off for {selectedRequest.zone}.
                  </p>
                </div>
              </div>) : selectedRequest.status === 'Approved' ? (<div className="bg-blue-50 border border-blue-200 rounded p-3 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0"/>
                <div>
                  <p className="text-sm font-semibold text-blue-800">
                    Approved by Operations
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Inventory allocation confirmed for {selectedRequest.zone}.
                  </p>
                </div>
              </div>) : selectedRequest.status === 'Fulfilled' ? (<div className="bg-emerald-50 border border-emerald-200 rounded p-3 flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0"/>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    Fulfilled & Dispatched
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Items delivered and signed into zone custody.
                  </p>
                </div>
              </div>) : (<div className="bg-red-50 border border-red-200 rounded p-3 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0"/>
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    Request Rejected
                  </p>
                  <p className="text-xs text-red-700 mt-0.5">
                    Declined due to priority schedule constraints.
                  </p>
                </div>
              </div>)}

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
              <div>
                <p className="text-xs text-[#5a6062] mb-1">Requested By</p>
                <p className="font-medium text-[#2d3335] flex items-center gap-2 text-xs">
                  <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-[#1F2E4A]">
                    {selectedRequest.avatarInitials}
                  </span>
                  {selectedRequest.requestedBy}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#5a6062] mb-1">Target Zone</p>
                <p className="font-medium text-[#2d3335] text-xs">
                  {selectedRequest.targetSector}
                </p>
              </div>

              <div className="col-span-2 mt-2">
                <p className="text-xs text-[#5a6062] mb-1">Product Details</p>
                <div className="border border-[#E1E1E1] rounded bg-white p-3 flex gap-3 items-center shadow-2xs">
                  <div className="w-10 h-10 bg-slate-100 flex items-center justify-center rounded text-[#5a6062]">
                    <BatteryCharging className="w-5 h-5"/>
                  </div>
                  <div className="flex-1 min-w-0 lg:min-w-auto">
                    <p className="font-semibold text-xs text-[#2d3335]">
                      {selectedRequest.product}
                    </p>
                    <p className="text-[11px] text-[#5a6062] font-mono">
                      SKU: {selectedRequest.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[#5a6062] uppercase">Qty</p>
                    <p className="font-bold text-base text-[#2d3335] font-mono">
                      {selectedRequest.qty}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <p className="text-xs text-[#5a6062] mb-2 font-medium">Request Notes</p>
              <div className="p-3 bg-white border border-[#E1E1E1] rounded text-xs text-[#5a6062] italic shadow-2xs leading-relaxed">
                "{selectedRequest.notes}"
              </div>
            </div>

            {/* Inventory Context */}
            <div className="mt-2 border-t border-[#E1E1E1] pt-4">
              <p className="text-xs text-[#5a6062] mb-2 flex items-center gap-1.5 font-medium">
                <Warehouse className="w-3.5 h-3.5"/>
                Current Stock Levels
              </p>
              <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded border border-[#E1E1E1]">
                <span className="text-[#2d3335] font-medium">Main Warehouse</span>
                <span className="font-semibold text-green-700">
                  {selectedRequest.warehouseStock} Available
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 sm:p-6 border-t border-[#E1E1E1] bg-white/80 backdrop-blur-md sticky bottom-0 mt-auto flex flex-col gap-3">
            {selectedRequest.status === 'Requested' && (<button onClick={() => handleApprove(selectedRequest.id)} className="w-full bg-[#0CB1AC] hover:bg-[#0aa09c] text-white py-2.5 rounded font-medium shadow-sm flex items-center justify-center gap-2 text-xs transition-all active:scale-[0.99]">
                <Check className="w-4 h-4"/>
                Approve Request
              </button>)}

            <div className="flex gap-2">
              <button onClick={() => handleReject(selectedRequest.id)} disabled={selectedRequest.status === 'Rejected'} className="flex-1 py-2 border border-[#E1E1E1] rounded text-[#5a6062] font-medium hover:bg-slate-100 transition-colors text-xs disabled:opacity-50">
                Reject
              </button>
              <button onClick={() => handleFulfill(selectedRequest.id)} disabled={selectedRequest.status !== 'Approved'} className={`flex-1 py-2 border border-[#E1E1E1] rounded font-medium transition-colors text-xs ${selectedRequest.status === 'Approved'
                ? 'bg-[#1F2E4A] text-white hover:bg-[#152036] cursor-pointer'
                : 'text-[#5a6062] opacity-50 cursor-not-allowed bg-slate-50'}`}>
                Fulfill
              </button>
            </div>
          </div>
        </aside>)}

      {/* Modal */}
      <CreateZoneRequestModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={onAddRequest}/>
    </div>);
};
