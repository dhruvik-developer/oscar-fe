import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Plus, Building2, DollarSign, Clock, X, Eye, FileSpreadsheet } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
const vendorGuide = {
    title: 'Vendor Master & Supplier Directory',
    subtitle: 'Supplier relationship management, procurement terms, and Accounts Payable ledgers',
    purpose: 'Use this page to manage registered suppliers, track supplier contact details, configure payment credit terms (e.g. Net 30), and inspect real-time running Accounts Payable ledgers.',
    workflow: ['Register Vendor Profile', 'Assign Payment Terms', 'Issue Purchase Orders', 'Review AP Statement & Settle'],
    keyTerms: [
        {
            term: 'Vendor Master Record',
            definition: 'Central database profile storing supplier contact info, payment terms, and historical procurement records.',
        },
        {
            term: 'Payment Terms (Net 15 / 30 / 45)',
            definition: 'Contractual agreement stipulating the number of calendar days allowed before paying an intake invoice.',
        },
        {
            term: 'Accounts Payable (AP)',
            definition: 'Total outstanding debt owed by your company to suppliers for delivered raw materials and inventory.',
        },
        {
            term: 'Vendor Statement / AP Ledger',
            definition: 'A detailed chronological ledger showing every bill, payment, and return debit note issued to a supplier.',
        },
    ],
    tips: [
        'Click "Statement" on any vendor row to view or print an official vendor ledger balance.',
    ],
};
export const VendorsPage = () => {
    const { vendors, addVendor, getVendorLedger, formatCurrency, formatDateDDMMYYYY } = useERP();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedVendor, setSelectedVendor] = useState(null);
    const [newVend, setNewVend] = useState({
        name: '',
        code: '',
        category: 'Hardware',
        contactPerson: '',
        email: '',
        phone: '',
        paymentTerms: 'Net 30',
    });
    const totalPayable = vendors.reduce((sum, v) => sum + v.balance, 0);
    const columns = [
        {
            header: 'Code',
            accessor: 'code',
            width: '12%',
            render: (v) => (
              <button
                onClick={() => setSelectedVendor(v)}
                className="font-mono font-bold text-primary hover:underline text-left cursor-pointer whitespace-nowrap"
              >
                {v.code}
              </button>
            ),
        },
        {
            header: 'Supplier / Vendor',
            accessor: 'name',
            width: '26%',
            render: (v) => (
              <div>
                <p className="font-bold text-text">{v.name}</p>
                <p className="text-[11px] text-muted">{v.category}</p>
              </div>
            ),
        },
        {
            header: 'Contact Person',
            accessor: 'contactPerson',
            width: '22%',
            render: (v) => (
              <div>
                <p className="text-text font-medium">{v.contactPerson}</p>
                <p className="text-[11px] text-muted">{v.email}</p>
              </div>
            ),
        },
        {
            header: 'Payment Terms',
            accessor: 'paymentTerms',
            align: 'center',
            width: '12%',
            render: (v) => (
              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-medium text-text-secondary text-xs whitespace-nowrap">
                {v.paymentTerms}
              </span>
            ),
        },
        {
            header: 'Accounts Payable',
            accessor: 'balance',
            align: 'right',
            width: '12%',
            render: (v) => {
                const bal = v.balance ?? 0;
                return (
                  <span className={`font-mono font-bold whitespace-nowrap ${bal > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary'}`}>
                    {formatCurrency(bal)}
                  </span>
                );
            },
        },
        {
            header: 'Status',
            align: 'center',
            width: '8%',
            render: (v) => (
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 whitespace-nowrap">
                {v.status}
              </span>
            ),
        },
        {
            header: 'AP Ledger',
            align: 'center',
            width: '8%',
            render: (v) => (
              <button
                onClick={() => setSelectedVendor(v)}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-card-hover text-text-secondary hover:text-primary rounded-lg transition-colors inline-flex items-center gap-1 text-xs cursor-pointer font-medium whitespace-nowrap"
                title="View AP Statement"
              >
                <Eye className="w-3.5 h-3.5"/>
                <span>Statement</span>
              </button>
            ),
        },
    ];
    const handleCreate = (e) => {
        e.preventDefault();
        if (!newVend.name)
            return;
        addVendor({
            code: newVend.code || `VEND-${String(vendors.length + 1).padStart(3, '0')}`,
            name: newVend.name,
            category: newVend.category || 'Hardware',
            contactPerson: newVend.contactPerson || 'Vendor Account Rep',
            email: newVend.email || 'orders@supplier.com',
            phone: newVend.phone || '+1 (800) 000-0000',
            balance: 0,
            paymentTerms: newVend.paymentTerms || 'Net 30',
            status: 'Active',
        });
        setIsModalOpen(false);
        setNewVend({ name: '', code: '', category: 'Hardware', contactPerson: '', email: '', phone: '', paymentTerms: 'Net 30' });
    };
    const vendorEntries = selectedVendor ? getVendorLedger(selectedVendor.id) : [];
    return (<div className="space-y-6">
      <PageHeader title="Vendor Master & AP Ledgers" subtitle="Supplier directory, procurement credit terms, intake bill history, and running accounts payable statements." guide={vendorGuide} actions={<Button icon={Plus} onClick={() => setIsModalOpen(true)}>
            New Vendor
          </Button>}/>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Suppliers" value={vendors.length} icon={Building2}/>
        <StatCard label="Accounts Payable" value={formatCurrency(totalPayable)} icon={DollarSign}/>
        <StatCard label="Standard Terms" value="Net 30 / Net 45" icon={Clock}/>
      </div>

      <DataTable
        title="Active Vendor Directory"
        data={vendors}
        columns={columns}
        keyExtractor={(v) => v.id}
        searchPlaceholder="Search vendors..."
        searchFilter={(v, term) =>
          (v.name || '').toLowerCase().includes(term) ||
          (v.code || '').toLowerCase().includes(term) ||
          (v.category || '').toLowerCase().includes(term) ||
          (v.contactPerson || '').toLowerCase().includes(term)
        }
      />

      {isModalOpen && (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">New Vendor Master</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18}/>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Vendor Code</label>
                  <input type="text" placeholder="e.g. VEND-005" value={newVend.code} onChange={(e) => setNewVend({ ...newVend, code: e.target.value })} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-mono"/>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Company / Supplier Name *</label>
                  <input type="text" required value={newVend.name} onChange={(e) => setNewVend({ ...newVend, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category</label>
                  <input type="text" value={newVend.category} onChange={(e) => setNewVend({ ...newVend, category: e.target.value })} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"/>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Payment Terms</label>
                  <select value={newVend.paymentTerms} onChange={(e) => setNewVend({ ...newVend, paymentTerms: e.target.value })} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800">
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Due on Receipt">Due on Receipt</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Contact Person</label>
                  <input type="text" value={newVend.contactPerson} onChange={(e) => setNewVend({ ...newVend, contactPerson: e.target.value })} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"/>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input type="email" value={newVend.email} onChange={(e) => setNewVend({ ...newVend, email: e.target.value })} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"/>
                </div>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded hover:bg-slate-100 font-medium">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded font-bold shadow-sm">
                  Register Vendor
                </button>
              </div>
            </form>
          </div>
        </div>)}

      {/* Vendor Statement / AP Ledger Modal */}
      {selectedVendor && (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-4 sm:p-6 text-xs max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden printable-document">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pb-3 border-b border-slate-200">
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-3 min-w-0 lg:min-w-auto">
                <h3 className="font-bold text-lg text-[#1F2E4A]">{selectedVendor.name}</h3>
                <span className="font-mono text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  {selectedVendor.code}
                </span>
                <span className="text-slate-500">
                  Terms: {selectedVendor.paymentTerms}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer">
                  Print AP Statement
                </button>
                <button onClick={() => setSelectedVendor(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                  <X size={18}/>
                </button>
              </div>
            </div>

            <div className="space-y-6 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Billed (Liability Credit)</span>
                  <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                    {formatCurrency(vendorEntries.reduce((s, e) => s + e.credit, 0))}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Disbursed (Debit)</span>
                  <p className="text-lg font-bold font-mono text-emerald-700 mt-0.5">
                    {formatCurrency(vendorEntries.reduce((s, e) => s + e.debit, 0))}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Net Accounts Payable Balance</span>
                  <p className="text-lg font-bold font-mono text-amber-700 mt-0.5">
                    {formatCurrency(selectedVendor.balance || 0)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-slate-400"/>
                  Supplier Statement Ledger ({vendorEntries.length} entries)
                </h4>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[760px] lg:min-w-0 text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Reference #</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right">Debit (Payment/Return)</th>
                        <th className="py-2.5 px-3 text-right">Credit (Bill)</th>
                        <th className="py-2.5 px-3 text-right">Payable Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {vendorEntries.length === 0 ? (<tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400">
                            No statement transactions recorded for this supplier.
                          </td>
                        </tr>) : (vendorEntries.map((e) => (<tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{formatDateDDMMYYYY(e.date)}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{e.type}</td>
                            <td className="py-2 px-3 font-mono text-blue-600 font-bold">{e.reference}</td>
                            <td className="py-2 px-3 text-slate-600 max-w-xs truncate">{e.description}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-700">
                              {e.debit > 0 ? formatCurrency(e.debit) : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-800">
                              {e.credit > 0 ? formatCurrency(e.credit) : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(e.balance)}
                            </td>
                          </tr>)))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-0 pt-4 border-t border-slate-200 bg-slate-50 -mx-4 -mb-4 px-4 sm:-mx-6 sm:-mb-6 sm:px-6 py-3">
              <span className="text-slate-500">
                Contact: {selectedVendor.contactPerson} ({selectedVendor.email})
              </span>
              <Button variant="outline" onClick={() => setSelectedVendor(null)}>
                Close Statement
              </Button>
            </div>
          </div>
        </div>)}
    </div>);
};
