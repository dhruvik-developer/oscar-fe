import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Plus, Wrench, User } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
export const ServiceUsagePage = () => {
    const { serviceUsages, items, addServiceUsage, getCurrentISODate } = useERP();
    const [showAddModal, setShowAddModal] = useState(false);
    // [PHASE-4] clear demo defaults → empty/new-entry state
    const [ticketNumber, setTicketNumber] = useState('');
    const [technician, setTechnician] = useState('');
    const [sku, setSku] = useState(items[0]?.sku || '');
    const [qtyUsed, setQtyUsed] = useState('');
    const [purpose, setPurpose] = useState('');
    const handleCreate = (e) => {
        e.preventDefault();
        addServiceUsage({
            ticketNumber: ticketNumber || `TKT-${String(serviceUsages.length + 1).padStart(3, '0')}`,
            technician: technician || 'Unassigned',
            sku,
            qtyUsed: parseInt(qtyUsed, 10) || 1,
            date: getCurrentISODate(),
            purpose,
        });
        setShowAddModal(false);
    };
    const columns = [
        {
            key: 'ticketNumber',
            header: 'Service Ticket #',
            width: '16%',
            render: (s) => (<span className="font-mono font-bold text-text-secondary flex items-center gap-1.5">
          <Wrench size={13} className="text-primary"/> {s.ticketNumber}
        </span>),
        },
        {
            key: 'technician',
            header: 'Assigned Field Tech',
            width: '16%',
            render: (s) => (<span className="text-text font-semibold flex items-center gap-1">
          <User size={12} className="text-muted"/> {s.technician}
        </span>),
        },
        {
            key: 'sku',
            header: 'Consumed SKU',
            width: '14%',
            render: (s) => <span className="font-mono font-bold text-primary">{s.sku}</span>,
        },
        {
            key: 'qtyUsed',
            header: 'Quantity Consumed',
            align: 'center',
            width: '14%',
            render: (s) => (<span className="font-mono font-bold text-text">{s.qtyUsed} Units</span>),
        },
        {
            key: 'date',
            header: 'Consumption Date',
            width: '14%',
            render: (s) => <span className="text-muted font-mono text-[11px]">{s.date}</span>,
        },
        {
            key: 'purpose',
            header: 'Work Description / Purpose',
            width: '26%',
            render: (s) => <span className="text-text-secondary text-xs">{s.purpose}</span>,
        },
    ];
    return (<div className="space-y-6">
      <PageHeader
        title="Service & Maintenance Part Usage"
        subtitle="Track spare parts and components consumed by field technicians during on-site maintenance and repairs."
        actions={
          <Button icon={Plus} onClick={() => setShowAddModal(true)}>
            Log Part Consumption
          </Button>
        }
      />

      <DataTable title="Field Service Part Logs" columns={columns} data={serviceUsages} keyExtractor={(s) => s.id} searchPlaceholder="Search ticket #, tech, or SKU..." searchFilter={(s, term) => String(s.ticketNumber ?? '').toLowerCase().includes(term) ||
            String(s.technician ?? '').toLowerCase().includes(term) ||
            String(s.sku ?? '').toLowerCase().includes(term) ||
            String(s.purpose ?? '').toLowerCase().includes(term)}/>

      {showAddModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-2 sm:p-4">
          <div className="bg-white rounded-lg border border-[#CED4DA] shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[95vh] overflow-y-auto">
            <h3 className="font-bold text-base text-[#1F2E4A] mb-1">
              Log Service Part Consumption
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Deduct consumed spare part from inventory and attribute to service ticket.
            </p>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Ticket #</label>
                <input required value={ticketNumber} onChange={(e) => setTicketNumber(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA] font-mono" placeholder="TKT-9041"/>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Field Technician</label>
                <input required value={technician} onChange={(e) => setTechnician(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]" placeholder="Liam Vance"/>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SKU Code</label>
                  <input required value={sku} onChange={(e) => setSku(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA] font-mono" placeholder="CAB-6-01"/>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Units Consumed</label>
                  <input type="number" required value={qtyUsed} onChange={(e) => setQtyUsed(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA] font-mono"/>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Application Purpose</label>
                <input required value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]" placeholder="Server rack maintenance"/>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap justify-end gap-2 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3.5 py-1.5 border border-[#CED4DA] rounded text-slate-600 hover:bg-slate-100">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded font-semibold">
                  Deduct from Inventory
                </button>
              </div>
            </form>
          </div>
        </div>)}
    </div>);
};
