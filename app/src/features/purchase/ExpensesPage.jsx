import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Plus, TrendingDown, DollarSign, Receipt, Tag } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import MasterSourceLink, { useMasterDataRefresh } from '../../components/common/MasterSourceLink';

const expensesGuide = {
    title: 'Operating Expenses Management',
    subtitle: 'Track operational overheads, facility maintenance, freight logistics, and corporate disbursements.',
    purpose: 'Record non-inventory operating expenses (OpEx) such as shipping freight, utilities, software licenses, and warehouse facility maintenance. These directly impact the Profit & Loss statement.',
    keyTerms: [
        { term: 'OpEx (Operating Expense)', definition: 'Day-to-day corporate expenditures required to run business operations.' },
        { term: 'Tax Deductible', definition: 'Business expenses that can be subtracted from gross income before tax calculation.' },
        { term: 'Expense Voucher', definition: 'Formal proof of non-PO related cash or card disbursement.' },
    ],
    tips: [
        'Tag recurring expenditures with categories to generate clean monthly P&L breakdowns.',
    ],
    workflow: ['Incur Expense', 'Record Voucher & Payment Method', 'General Ledger Updated', 'Tax Report Classified'],
};

const PAYMENT_MODES = ['Cash', 'Bank', 'UPI', 'Cheque', 'Card', 'Bank Transfer', 'Credit'];

export const ExpensesPage = () => {
    const { expenses, vendors, bankAccounts, addExpense, formatCurrency, formatDateDDMMYYYY, getCurrentISODate } = useERP();
    const [showAddModal, setShowAddModal] = useState(false);
    const [categories, setCategories] = useState([]);
    const [categoriesError, setCategoriesError] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [vendorId, setVendorId] = useState('');
    const [expenseDate, setExpenseDate] = useState(() => getCurrentISODate());
    const [amount, setAmount] = useState('');
    const [taxAmount, setTaxAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('');
    const [bankAccountId, setBankAccountId] = useState('');
    const [notes, setNotes] = useState('');
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    // Expense categories are a master on the server; nothing is assumed here.
    // `categoriesReload` bumps when categories are edited from the "+ Add / Manage" popup.
    const [categoriesReload, setCategoriesReload] = useState(0);
    const reloadCategories = useCallback(() => setCategoriesReload((k) => k + 1), []);
    useMasterDataRefresh(reloadCategories, ['expenseCategories']);
    useEffect(() => {
        if (!showAddModal) return undefined;
        let cancelled = false;
        api.get('/accounts/expense-categories/', { query: { page_size: 200 } })
            .then((body) => {
                if (cancelled) return;
                const rows = Array.isArray(body) ? body : (body?.results || []);
                setCategories(rows.filter((c) => c.isActive !== false));
                setCategoriesError('');
            })
            .catch((err) => { if (!cancelled) setCategoriesError(err?.message || 'Could not load expense categories.'); });
        return () => { cancelled = true; };
    }, [showAddModal, categoriesReload]);

    const resetForm = () => {
        setCategoryId('');
        setVendorId('');
        setExpenseDate(getCurrentISODate());
        setAmount('');
        setTaxAmount('');
        setPaymentMode('');
        setBankAccountId('');
        setNotes('');
        setFormError('');
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!categoryId) { setFormError('Select an expense category.'); return; }
        if (!(Number(amount) > 0)) { setFormError('Enter an amount greater than zero.'); return; }
        if (!paymentMode) { setFormError('Select how the expense was paid.'); return; }
        if (paymentMode === 'Credit' && !vendorId) { setFormError('Select the vendor for an expense on credit.'); return; }
        setSaving(true);
        try {
            await addExpense({
                date: expenseDate,
                categoryId,
                vendorId: vendorId || undefined,
                amount: Number(amount),
                taxAmount: taxAmount === '' ? undefined : Number(taxAmount),
                paymentMode,
                bankAccountId: paymentMode !== 'Cash' && paymentMode !== 'Credit' ? (bankAccountId || undefined) : undefined,
                notes: notes.trim() || undefined,
            });
            setShowAddModal(false);
            resetForm();
        } catch (err) {
            setFormError(err?.message || 'Expense not saved.');
        } finally {
            setSaving(false);
        }
    };
    const columns = [
        {
            key: 'expenseNumber',
            header: 'Expense Voucher #',
            width: '15%',
            render: (e) => (
              <span className="font-mono font-bold text-text flex items-center gap-1.5 whitespace-nowrap">
                <TrendingDown size={13} className="text-amber-600 dark:text-amber-400 shrink-0"/>
                <span>{e.expenseNumber}</span>
              </span>
            ),
        },
        {
            key: 'category',
            header: 'Expense Category',
            width: '16%',
            render: (e) => (
              <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-text-secondary text-[11px] font-semibold rounded border border-border whitespace-nowrap">
                {e.category}
              </span>
            ),
        },
        {
            key: 'payee',
            header: 'Vendor / Payee Entity',
            width: '22%',
            render: (e) => <span className="font-bold text-text block">{e.payee}</span>,
        },
        {
            key: 'date',
            header: 'Date Paid',
            width: '12%',
            render: (e) => <span className="text-muted font-mono text-[11px] whitespace-nowrap">{formatDateDDMMYYYY(e.date)}</span>,
        },
        {
            key: 'paidVia',
            header: 'Disbursement Method',
            width: '13%',
            render: (e) => <span className="text-muted text-xs whitespace-nowrap">{e.paidVia}</span>,
        },
        {
            key: 'taxAmount',
            header: 'GST',
            align: 'right',
            width: '10%',
            render: (e) => <span className="font-mono text-muted text-xs whitespace-nowrap">{formatCurrency(e.taxAmount ?? 0)}</span>,
        },
        {
            key: 'amount',
            header: 'Amount',
            align: 'right',
            width: '12%',
            render: (e) => (
              <span className="font-mono font-bold text-text whitespace-nowrap">
                {formatCurrency(e.total ?? e.amount ?? 0)}
              </span>
            ),
        },
    ];
    const totalSpent = expenses.reduce((acc, curr) => acc + (Number(curr.total ?? curr.amount) || 0), 0);
    const avgExpense = expenses.length > 0 ? (totalSpent / expenses.length) : 0;
    const categoriesCount = new Set(expenses.map(e => e.category)).size;

    return (<div className="space-y-6">
      <PageHeader title="Operating Expenses & OpEx" subtitle="Log overhead, logistics fees, utilities, facility maintenance, and corporate operational disbursements." guide={expensesGuide} actions={<Button icon={Plus} onClick={() => setShowAddModal(true)}>
            Record Expense
          </Button>}/>

      {/* Expenses KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Operating Expenses" value={formatCurrency(totalSpent)} icon={DollarSign} highlight />
        <StatCard label="Expense Vouchers" value={`${expenses.length} Vouchers`} icon={Receipt} />
        <StatCard label="Avg Expense Cost" value={formatCurrency(avgExpense)} icon={TrendingDown} />
        <StatCard label="Active Cost Centers" value={`${categoriesCount} Categories`} icon={Tag} />
      </div>

      <DataTable title="Operational Overheads & Disbursed Vouchers" columns={columns} data={expenses} keyExtractor={(e) => e.id} searchPlaceholder="Search payee, voucher #, or category..." searchFilter={(e, term) => String(e.expenseNumber ?? '').toLowerCase().includes(term) ||
            String(e.payee ?? '').toLowerCase().includes(term) ||
            String(e.category ?? '').toLowerCase().includes(term)}/>

      {showAddModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-2 sm:p-4">
          <div className="bg-white rounded-lg border border-[#CED4DA] shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[95vh] overflow-y-auto">
            <h3 className="font-bold text-base text-[#1F2E4A] mb-1">
              Record Operational Expense
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter payment details for logistics, utilities, or maintenance.
            </p>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              {formError && <div className="p-2 rounded border border-rose-200 bg-rose-50 text-rose-700">{formError}</div>}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Category *</label>
                  <MasterSourceLink source="expenseCategories" />
                </div>
                <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]">
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {categoriesError && <p className="mt-1 text-rose-600">{categoriesError}</p>}
                {!categoriesError && categories.length === 0 && <p className="mt-1 text-slate-500">No expense categories set up yet. Use &quot;+ Add / Manage&quot; above, or Accounts → Expense Categories.</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date *</label>
                  <input type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]"/>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Vendor / Payee</label>
                    <MasterSourceLink source="vendors" />
                  </div>
                  <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]">
                    <option value="">— None —</option>
                    {(vendors || []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (before GST) *</label>
                  <input type="number" min="0" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA] font-mono"/>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GST Amount</label>
                  <input type="number" min="0" step="0.01" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA] font-mono"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Mode *</label>
                  <select required value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]">
                    <option value="">Select mode</option>
                    {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {paymentMode && paymentMode !== 'Cash' && paymentMode !== 'Credit' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-700">Paid From (Bank)</label>
                      <MasterSourceLink source="cashBank" />
                    </div>
                    <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]">
                      <option value="">— Cash in hand —</option>
                      {(bankAccounts || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]"/>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap justify-end gap-2 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="px-3.5 py-1.5 border border-[#CED4DA] rounded text-slate-600 hover:bg-slate-100">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded font-semibold disabled:opacity-60">
                  {saving ? 'Saving…' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>)}
    </div>);
};
