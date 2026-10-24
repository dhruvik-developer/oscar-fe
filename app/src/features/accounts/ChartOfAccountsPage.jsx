import React from 'react';
import SimpleMasterPage from '../../components/common/SimpleMasterPage';

// Ledger accounts (/accounts/chart-of-accounts/). System accounts back the
// auto-posting matrix, so their code and type are shown but not editable here.
const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'].map((t) => ({ value: t, label: t }));
const isSystem = (row) => Boolean(row?.isSystem);
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const SYSTEM_HINT ='System account -- used by automatic postings, so this cannot be changed.';

const FIELDS = [
  { key: 'code', label: 'Account Code', required: true, placeholder: 'e.g. 5100', locked: isSystem, lockedHint: SYSTEM_HINT },
  { key: 'name', label: 'Account Name', required: true, placeholder: 'e.g. Office Rent' },
  { key: 'type', label: 'Account Type', type: 'select', required: true, options: ACCOUNT_TYPES, locked: isSystem, lockedHint: SYSTEM_HINT },
  { key: 'subtype', label: 'Sub-type', placeholder: 'e.g. Bank, Cash, Indirect Expense' },
  {
    key: 'parent',
    label: 'Parent Account',
    type: 'select',
    placeholder: '— Top level —',
    options: (rows, _aux, editing) => rows
      .filter((r) => r.id !== editing?.id)
      .map((r) => ({ value: r.id, label: `${r.code} - ${r.name}` })),
  },
  { key: 'openingBalance', label: 'Opening Balance', type: 'number', step: '0.01' },
];

const COLUMNS = [
  { key: 'code', label: 'Code', className: 'font-mono', render: (r) => r.code },
  {
    key: 'name',
    label: 'Account Name',
    render: (r) => (
      <span className="font-semibold text-slate-900">
        {r.name}
        {r.isSystem && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700">System</span>}
      </span>
    ),
  },
  { key: 'type', label: 'Type', render: (r) => r.type || '—' },
  { key: 'subtype', label: 'Sub-type', render: (r) => r.subtype || '—' },
  {
    key: 'parent',
    label: 'Parent',
    render: (r, { rows }) => {
      if (!r.parent) return '—';
      const p = rows.find((x) => x.id === r.parent);
      return p ? `${p.code} - ${p.name}` : '—';
    },
  },
  {
    key: 'balance',
    label: 'Balance',
    className: 'text-right',
    render: (r) => {
      if (r.balance === null || r.balance === undefined) return '—';
      const n = Number(r.balance) || 0;
      if (n === 0) return <span className="font-mono text-slate-400">₹0.00</span>;
      // Ledger convention: positive = Debit, negative = Credit (as in Tally).
      return (
        <span className="font-mono font-semibold text-slate-900 whitespace-nowrap">
          {INR.format(Math.abs(n))}
          <span className={`ml-1 text-[10px] font-bold ${n > 0 ? 'text-blue-700' : 'text-amber-700'}`}>{n > 0 ? 'Dr' : 'Cr'}</span>
        </span>
      );
    },
  },
];

const SEARCH_KEYS = ['code', 'name', 'type', 'subtype'];

export default function ChartOfAccountsPage() {
  return (
    <SimpleMasterPage
      title="Chart of Accounts"
      subtitle="Ledger accounts used by journals, bank accounts, budgets and expense categories."
      entityLabel="Ledger Account"
      endpoint="/accounts/chart-of-accounts/"
      fields={FIELDS}
      columns={COLUMNS}
      searchKeys={SEARCH_KEYS}
    />
  );
}
