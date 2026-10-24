import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Plus, Search, Eye, Pencil, Download, Check, Printer, Send,
  FileCheck2, Clock, AlertTriangle, XCircle, IndianRupee,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import KpiCard from '../../../components/ui/KpiCard';
import PageHeader from '../../../components/ui/PageHeader';
import { loadDeals } from '../../../services/dealService';
import { crmService } from '../../../services/domainServices';
import {
  CONTRACT_TYPES,
  CONTRACT_TEMPLATES,
  loadContracts,
  refreshContractsCache,
  createContract,
  formatContractMoney,
  formatContractDate,
  getContractDisplayStatus,
} from '../../../services/contractService';

const PAGE_SIZE = 10;
const EMPTY_FORM = {
  dealId: '', customer: '', contractType: '', amount: '',
  startDate: '', endDate: '', template: '', description: '', terms: '', status: 'Active',
  notifyCustomer: false,
};

function statusTone(status) {
  if (/^active$/i.test(status)) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (/expiring/i.test(status)) return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (/^expired$/i.test(status)) return 'bg-rose-50 text-rose-700 border border-rose-200';
  if (/^draft$/i.test(status)) return 'bg-slate-100 text-slate-600 border border-slate-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

function ContractForm({ form, setForm, deals }) {
  return (
    <div className="space-y-4 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1.5 font-semibold text-slate-600">
          Contract Type *
          <select required value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}
            className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 bg-white">
            <option value="">Select type</option>
            {CONTRACT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 font-semibold text-slate-600">
          Contract Number
          <input readOnly value="Auto-generated" className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50 text-slate-400 outline-none" />
        </label>
        <label className="space-y-1.5 font-semibold text-slate-600">
          Customer *
          <input required value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}
            placeholder="Customer name"
            className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1.5 font-semibold text-slate-600">
            Start Date *
            <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
          </label>
          <label className="space-y-1.5 font-semibold text-slate-600">
            End Date *
            <input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
          </label>
        </div>
        <label className="space-y-1.5 font-semibold text-slate-600">
          Deal *
          <select required value={form.dealId} onChange={(e) => {
            const dealId = e.target.value;
            const deal = deals.find((item) => String(item.id) === dealId);
            setForm((current) => ({ ...current, dealId, customer: current.customer || deal?.client || '' }));
          }}
            className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 bg-white">
            <option value="">Select a deal</option>
            {deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.dealNumber || deal.id} — {deal.name}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 font-semibold text-slate-600">
          Contract Value *
          <input type="number" required min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="12,00,000"
            className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
        </label>
        <label className="space-y-1.5 font-semibold text-slate-600 sm:col-span-2">
          Template
          <select value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}
            className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 bg-white">
            <option value="">Select template</option>
            {CONTRACT_TEMPLATES.map((template) => <option key={template} value={template}>{template}</option>)}
          </select>
        </label>
      </div>
      <label className="block space-y-1.5 font-semibold text-slate-600">
        Description
        <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Contract scope and summary…"
          className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
      </label>
      <label className="block space-y-1.5 font-semibold text-slate-600">
        Terms & Conditions
        <textarea rows={3} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })}
          placeholder="Payment, warranty and support terms…"
          className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
      </label>
      <label className="flex items-center gap-2 font-medium text-slate-600">
        <input type="checkbox" checked={form.notifyCustomer} onChange={(e) => setForm({ ...form, notifyCustomer: e.target.checked })} className="accent-blue-600" />
        Send notification to customer
      </label>
    </div>
  );
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [customerFilter, setCustomerFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const handlePrintContract = async (id) => {
    try {
      await crmService.printContract(id);
    } catch {}
    window.print();
  };

  const handleSendContract = async (id) => {
    try {
      await crmService.sendContractForSignature(id);
      alert('Contract queued and sent for signature.');
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'E-signature is not configured on this workspace.');
    }
  };

  function refresh() {
    try {
      setContracts(loadContracts());
      try { setDeals(loadDeals()); } catch { setDeals([]); }
      setError('');
    } catch (failure) { setError(failure.message); }
  }

  useEffect(() => {
    refreshContractsCache().then(() => refresh()).catch(() => refresh());
    window.addEventListener('storage', refresh);
    window.addEventListener('crm:data-updated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('crm:data-updated', refresh);
    };
  }, []);

  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter, customerFilter, fromDate, toDate]);

  const customers = useMemo(() => [...new Set(contracts.map((contract) => contract.customer).filter(Boolean))].sort(), [contracts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((contract) => {
      if (statusFilter !== 'All' && getContractDisplayStatus(contract) !== statusFilter) return false;
      if (typeFilter !== 'All' && (contract.contractType || 'Other') !== typeFilter) return false;
      if (customerFilter !== 'All' && contract.customer !== customerFilter) return false;
      if (fromDate && (!contract.startDate || contract.startDate < fromDate)) return false;
      if (toDate && (!contract.startDate || contract.startDate > toDate)) return false;
      if (!q) return true;
      return [contract.contractNumber, contract.title, contract.customer, contract.dealName, contract.dealNumber, contract.contractType]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
    });
  }, [contracts, search, statusFilter, typeFilter, customerFilter, fromDate, toDate]);

  const stats = useMemo(() => ({
    total: contracts.length,
    active: contracts.filter((contract) => getContractDisplayStatus(contract) === 'Active').length,
    expiring: contracts.filter((contract) => getContractDisplayStatus(contract) === 'Expiring Soon').length,
    expired: contracts.filter((contract) => getContractDisplayStatus(contract) === 'Expired').length,
    value: contracts.reduce((sum, contract) => sum + (Number(contract.amount) || 0), 0),
  }), [contracts]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resetFilters() {
    setSearch('');
    setStatusFilter('All');
    setTypeFilter('All');
    setCustomerFilter('All');
    setFromDate('');
    setToDate('');
    setPage(1);
  }

  async function submitCreate(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError('');
    try {
      const contract = await createContract(form);
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setCreated(contract);
      refresh();
    } catch (failure) { setFormError(failure.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Contracts"
        subtitle="Manage contracts, agreements and renewals."
        actions={<button type="button" className="btn-primary btn-sm" onClick={() => { setFormError(''); setForm(EMPTY_FORM); setCreateOpen(true); }}><Plus size={14} /> Create Contract</button>}
      />

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 my-4">
        <KpiCard label="Total Contracts" value={stats.total} icon={FileText} tone="sky" />
        <KpiCard label="Active Contracts" value={stats.active} icon={FileCheck2} tone="emerald" />
        <KpiCard label="Expiring Soon (30 days)" value={stats.expiring} icon={AlertTriangle} tone="amber" />
        <KpiCard label="Expired Contracts" value={stats.expired} icon={XCircle} tone="rose" />
        <KpiCard label="Total Contract Value" value={formatContractMoney(stats.value)} icon={IndianRupee} tone="blue" />
      </div>

      <div className="card p-4">
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contracts…"
              className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-blue-400" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 bg-white text-slate-600">
            <option value="All">All Status</option>
            {['Active', 'Expiring Soon', 'Expired', 'Draft', 'Closed', 'Cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 bg-white text-slate-600">
            <option value="All">All Contract Types</option>
            {CONTRACT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 bg-white text-slate-600">
            <option value="All">All Customers</option>
            {customers.map((customer) => <option key={customer} value={customer}>{customer}</option>)}
          </select>
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
            <input type="date" aria-label="From date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 text-slate-600" />
            <span className="text-slate-400 text-xs">→</span>
            <input type="date" aria-label="To date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 text-slate-600" />
          </div>
          <button type="button" onClick={resetFilters} className="btn-outline btn-sm shrink-0">Reset</button>
        </div>

        {pageRows.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">No contracts found</p>
            <p className="mt-1 text-xs text-slate-500">Adjust the filters or create a new contract.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[1080px] text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500">
                  <th className="px-3 py-3 font-semibold w-8">#</th>
                  <th className="px-3 py-3 font-semibold">Contract #</th>
                  <th className="px-3 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Deal</th>
                  <th className="px-3 py-3 font-semibold">Contract Type</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Start Date</th>
                  <th className="px-3 py-3 font-semibold">End Date</th>
                  <th className="px-3 py-3 font-semibold">Created On</th>
                  <th className="px-3 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((contract, index) => (
                  <tr key={contract.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-3 text-slate-400">{(safePage - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="px-3 py-3">
                      <Link className="font-bold text-blue-600 hover:underline whitespace-nowrap" to={`/crm/contracts/${encodeURIComponent(contract.id)}`}>
                        {contract.contractNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-700 whitespace-nowrap">{contract.customer || '—'}</td>
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{contract.dealNumber || contract.dealId || '—'}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{contract.contractType || '—'}</td>
                    <td className="px-3 py-3 font-semibold text-slate-700 whitespace-nowrap">{contract.amount != null && contract.amount !== '' ? formatContractMoney(contract.amount) : '—'}</td>
                    <td className="px-3 py-3"><span className={`inline-block rounded-full px-2 py-1 font-semibold whitespace-nowrap ${statusTone(getContractDisplayStatus(contract))}`}>{getContractDisplayStatus(contract)}</span></td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{formatContractDate(contract.startDate)}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{formatContractDate(contract.endDate)}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{formatContractDate(contract.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Link className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100" title="View"
                          to={`/crm/contracts/${encodeURIComponent(contract.id)}`}><Eye size={14} /></Link>
                        <Link className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100" title="Edit"
                          to={`/crm/contracts/${encodeURIComponent(contract.id)}`}><Pencil size={14} /></Link>
                        <button type="button" className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100" title="Print Contract"
                          onClick={() => handlePrintContract(contract.id)}><Printer size={14} /></button>
                        <button type="button" className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100" title="Send for Signature"
                          onClick={() => handleSendContract(contract.id)}><Send size={14} /></button>
                        <button type="button" className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100" title="Download"
                          onClick={() => {
                            const text = `${contract.title || contract.contractNumber}\nContract: ${contract.contractNumber}\nCustomer: ${contract.customer}\nDeal: ${contract.dealNumber || contract.dealId}\nStatus: ${getContractDisplayStatus(contract)}\n\n${contract.terms || ''}`;
                            const link = document.createElement('a');
                            link.href = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
                            link.download = `${contract.contractNumber}.txt`;
                            link.click();
                          }}><Download size={14} /></button>
                        <span className="p-2 rounded-lg border border-slate-200 text-slate-300"><Clock size={14} /></span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>Showing {(safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} contracts</p>
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-center gap-1.5">
              <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100" aria-label="Previous page"><ChevronLeft size={14} /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7).map((number) => (
                <button key={number} type="button" onClick={() => setPage(number)}
                  className={`min-w-[28px] h-7 rounded-lg border text-xs font-semibold ${number === safePage ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                  {number}
                </button>
              ))}
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100" aria-label="Next page"><ChevronRight size={14} /></button>
              <span className="ml-2 border border-slate-200 rounded-lg px-2 py-1.5">{PAGE_SIZE} / page</span>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={createOpen} onClose={() => !busy && setCreateOpen(false)} title="Create Contract" subtitle="Fill in the contract details" size="lg">
        <form onSubmit={submitCreate} className="space-y-4">
          <ContractForm form={form} setForm={setForm} deals={deals} />
          {formError && <p role="alert" className="text-xs text-rose-600">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary btn-sm" disabled={busy}>{busy ? 'Creating…' : 'Create Contract'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(created)} onClose={() => setCreated(null)}
        footer={created && (
          <div className="flex justify-center gap-2 w-full">
            <Link className="btn-primary btn-sm" to={`/crm/contracts/${encodeURIComponent(created.id)}`}>View Contract</Link>
            {created.dealId ? (
              <Link className="btn-outline btn-sm" to={`/crm/deals?deal=${encodeURIComponent(created.dealId)}`}>Back to Deal</Link>
            ) : (
              <button type="button" className="btn-outline btn-sm" onClick={() => setCreated(null)}>Back to Contracts</button>
            )}
          </div>
        )}>
        {created && (
          <div className="text-center px-2 py-2">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <Check size={28} strokeWidth={3} />
            </span>
            <h3 className="mt-3 text-base font-bold text-emerald-700">Contract Created Successfully!</h3>
            <p className="mt-1.5 text-xs leading-6 text-slate-500">
              Contract {created.contractNumber} has been created
              {created.dealId ? <> and linked to Deal {created.dealNumber || created.dealId}</> : null}.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
