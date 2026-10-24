import React from 'react';
import SimpleMasterPage from '../../components/common/SimpleMasterPage';
import { api } from '../../services/api';
import { fetchAllPages } from './accountingShared';

// Expense categories (/accounts/expense-categories/) are the "Category"
// choices on Purchase -> Expenses; each may post to an Expense ledger account.
async function loadExpenseAccounts() {
  const accounts = await fetchAllPages(api, '/accounts/chart-of-accounts/', { type: 'Expense' });
  return { accounts };
}

const FIELDS = [
  { key: 'name', label: 'Category Name', required: true, placeholder: 'e.g. Freight, Electricity, Repairs' },
  {
    key: 'account',
    label: 'Ledger Account (Expense)',
    type: 'select',
    placeholder: '— Default expense account —',
    hint: 'The Expense ledger this category posts to.',
    options: (_rows, aux) => (aux.accounts || [])
      .filter((a) => a.isActive !== false)
      .map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` })),
  },
];

const COLUMNS = [
  { key: 'name', label: 'Category', render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
  {
    key: 'account',
    label: 'Ledger Account',
    render: (r, { aux }) => {
      if (!r.account) return <span className="text-slate-400">Default</span>;
      const a = (aux.accounts || []).find((x) => x.id === r.account);
      return a ? `${a.code} - ${a.name}` : '—';
    },
  },
];

const SEARCH_KEYS = ['name'];

export default function ExpenseCategoriesPage() {
  return (
    <SimpleMasterPage
      title="Expense Categories"
      subtitle="Categories offered when recording an operating expense under Purchase → Expenses."
      entityLabel="Expense Category"
      endpoint="/accounts/expense-categories/"
      fields={FIELDS}
      columns={COLUMNS}
      searchKeys={SEARCH_KEYS}
      loadAux={loadExpenseAccounts}
    />
  );
}
