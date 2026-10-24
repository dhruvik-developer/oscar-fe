import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Plus, Users, DollarSign, ShieldAlert, X, Eye } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Customer360Drawer } from '../../components/common/Customer360Drawer';
const customerGuide = {
    title: 'Customer Accounts & Statements',
    subtitle: 'Corporate client database, credit risk management, and statement of accounts.',
    purpose: 'The Customer Master manages client billing profiles, tax codes, authorized credit limits, and lifetime transaction histories. It allows finance teams to evaluate credit exposure, review running ledgers, and export official Statements of Account in 1 click.',
    keyTerms: [
        { term: 'Customer Account Code', definition: 'A unique identifier assigned to the client company (e.g. CUST-001).' },
        { term: 'Credit Limit Threshold', definition: 'The maximum allowable unpaid debt a customer can accumulate before new orders require executive approval.' },
        { term: 'Receivable Balance (AR)', definition: 'The live net amount currently owed by this client across all unsettled invoices.' },
        { term: 'Statement of Account', definition: 'A complete running audit ledger showing all debits (invoices) and credits (payments) in chronological order.' },
    ],
    tips: [
        'Click on any customer name or the "360° Profile" action to open their live financial summary, credit utilization gauge, and printable statement.',
        'Credit limits are actively verified in real time when drafting new Sales Orders.',
    ],
    workflow: ['Customer Profile Setup', 'Sales Orders Booked', 'Tax Invoices Issued', 'Payment Vouchers Posted', 'Ledger Reconciled'],
};
export const CustomersPage = () => {
    const { customers, addCustomer, getCustomerLedger, formatCurrency } = useERP();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCust360, setSelectedCust360] = useState(null);
    const [newCust, setNewCust] = useState({
        name: '',
        code: '',
        contactPerson: '',
        email: '',
        phone: '',
        creditLimit: 50000,
        balance: 0,
        status: 'Active',
    });
    const totalOutstanding = customers.reduce((sum, c) => sum + c.balance, 0);
    const columns = [
        {
            header: 'Code',
            accessor: 'code',
            width: '12%',
            render: (c) => (
              <button
                onClick={() => setSelectedCust360(c)}
                className="font-mono font-bold text-primary hover:underline text-left cursor-pointer whitespace-nowrap"
              >
                {c.code}
              </button>
            ),
        },
        {
            header: 'Customer Name',
            accessor: 'name',
            width: '26%',
            render: (c) => (
              <button onClick={() => setSelectedCust360(c)} className="text-left cursor-pointer hover:underline block">
                <p className="font-bold text-text">{c.name}</p>
                <p className="text-[11px] text-muted">Attn: {c.contactPerson}</p>
              </button>
            ),
        },
        {
            header: 'Email / Phone',
            accessor: 'email',
            width: '22%',
            render: (c) => (
              <div className="text-muted text-xs">
                <p className="text-text-secondary">{c.email}</p>
                <p className="text-[11px] text-muted">{c.phone}</p>
              </div>
            ),
        },
        {
            header: 'Receivable Balance',
            accessor: 'balance',
            align: 'right',
            width: '14%',
            render: (c) => {
                const bal = c.balance ?? 0;
                return (
                  <span className={`font-mono font-bold whitespace-nowrap ${bal > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatCurrency(bal)}
                  </span>
                );
            },
        },
        {
            header: 'Credit Limit',
            accessor: 'creditLimit',
            align: 'right',
            width: '12%',
            render: (c) => (
              <span className="font-mono text-muted whitespace-nowrap">
                {formatCurrency(c.creditLimit ?? 0, { noDecimals: true })}
              </span>
            ),
        },
        {
            header: 'Status',
            align: 'center',
            width: '8%',
            render: (c) => (
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${c.status === 'Active'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30'}`}>
                {c.status}
              </span>
            ),
        },
        {
            header: '360° Profile',
            align: 'center',
            width: '8%',
            render: (c) => (
              <button
                onClick={() => setSelectedCust360(c)}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-card-hover text-text-secondary hover:text-primary rounded-lg transition-colors inline-flex items-center gap-1 text-xs cursor-pointer font-medium whitespace-nowrap"
                title="Open Customer 360 Statement & Ledger"
              >
                <Eye className="w-3.5 h-3.5"/>
                <span>Statement</span>
              </button>
            ),
        },
    ];
    const handleCreate = (e) => {
        e.preventDefault();
        if (!newCust.name)
            return;
        addCustomer({
            code: newCust.code || `CUST-${String(customers.length + 1).padStart(3, '0')}`,
            name: newCust.name,
            contactPerson: newCust.contactPerson || 'General Contact',
            email: newCust.email || 'billing@client.com',
            phone: newCust.phone || '+1 (555) 000-0000',
            balance: 0,
            creditLimit: Number(newCust.creditLimit) || 50000,
            status: 'Active',
        });
        setIsModalOpen(false);
        setNewCust({ name: '', code: '', contactPerson: '', email: '', phone: '', creditLimit: 50000 });
    };
    return (<div className="space-y-6">
      <PageHeader title="Customer Master & Statements" subtitle="Corporate client accounts, active credit thresholds, multi-year invoice billing history, and real-time running statements." guide={customerGuide} actions={<Button icon={Plus} onClick={() => setIsModalOpen(true)}>
            New Customer
          </Button>}/>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Customers" value={customers.length} icon={Users}/>
        <StatCard label="Accounts Receivable" value={formatCurrency(totalOutstanding)} icon={DollarSign}/>
        <StatCard label="Active Accounts" value={customers.filter((c) => c.status === 'Active').length} icon={ShieldAlert}/>
      </div>

      <DataTable
        title="Customer Directory"
        subtitle="Search by company name, contact, email or code"
        data={customers}
        columns={columns}
        keyExtractor={(c) => c.id}
        searchPlaceholder="Search customers..."
        searchFilter={(c, term) =>
          (c.name || '').toLowerCase().includes(term) ||
          (c.code || '').toLowerCase().includes(term) ||
          (c.contactPerson || '').toLowerCase().includes(term) ||
          (c.email || '').toLowerCase().includes(term)
        }
      />

      {/* New Customer Modal */}
      {isModalOpen && (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">New Customer Account</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18}/>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Company Name *</label>
                  <input type="text" required value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"/>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Customer Code</label>
                  <input type="text" placeholder="e.g. CUST-010" value={newCust.code} onChange={(e) => setNewCust({ ...newCust, code: e.target.value })} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-mono"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Contact Person</label>
                  <input type="text" value={newCust.contactPerson} onChange={(e) => setNewCust({ ...newCust, contactPerson: e.target.value })} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"/>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Credit Limit ($)</label>
                  <input type="number" value={newCust.creditLimit} onChange={(e) => setNewCust({ ...newCust, creditLimit: Number(e.target.value) })} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-mono"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"/>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone</label>
                  <input type="text" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"/>
                </div>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded hover:bg-slate-100 font-medium">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded font-bold shadow-sm">
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>)}

      {/* Customer 360 Statement Drawer */}
      <Customer360Drawer customer={selectedCust360} onClose={() => setSelectedCust360(null)}/>
    </div>);
};
