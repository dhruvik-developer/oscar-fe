import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ArrowRightLeft } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { PageHeader } from '../../components/common/PageHeader';
import MasterSourceLink, { useMasterDataRefresh } from '../../components/common/MasterSourceLink';
import {
  Card,
  EmptyRow,
  ErrorState,
  Kpi,
  LoadingState,
  describeApiError,
  fetchAllPages,
  formatDate,
  formatINR,
  inputClass,
  labelClass,
  thClass,
  todayISO,
  unwrapList,
} from './accountingShared';

const cashBankGuide = {
  title: 'Cash & Bank Accounts (Treasury)',
  subtitle: 'Bank and cash balances from the ledger, and inter-account transfers',
  purpose:
    'Balances are opening balance plus every posted debit and credit on the linked ledger account. Recording receipts, payments and transfers updates them on the server.',
  workflow: ['Link bank / cash account to a ledger account', 'Post ERP transactions', 'Track balances', 'Transfer funds between accounts'],
  keyTerms: [
    { term: 'Ledger account', definition: 'The chart-of-accounts entry the bank account posts to.' },
    { term: 'Inter-account transfer', definition: 'Moves funds between two of your accounts; the server posts a balanced journal entry with no P&L impact.' },
  ],
  tips: ['Transfers are posted immediately and appear in the General Ledger.'],
};

const BANK_TYPES = ['Bank', 'Cash', 'UPI', 'Card'];
const TRANSFER_PAGE_SIZE = 25;

const emptyBank = () => ({
  name: '',
  type: '',
  accountId: '',
  bankName: '',
  accountNumber: '',
  ifsc: '',
  branch: '',
  openingBalance: '',
  isDefault: false,
});

const emptyTransfer = () => ({
  fromAccountId: '',
  toAccountId: '',
  amount: '',
  date: todayISO(),
  reference: '',
  notes: '',
});

export const CashBankPage = () => {
  const [banks, setBanks] = useState([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [banksError, setBanksError] = useState('');

  const [balances, setBalances] = useState(null);
  const [balancesError, setBalancesError] = useState('');

  const [transfers, setTransfers] = useState(null);
  const [transferPage, setTransferPage] = useState(1);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [transfersError, setTransfersError] = useState('');

  const [ledgerAccounts, setLedgerAccounts] = useState([]);
  const [ledgerError, setLedgerError] = useState('');

  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState(emptyBank);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankFormError, setBankFormError] = useState('');

  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferForm, setTransferForm] = useState(emptyTransfer);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferFormError, setTransferFormError] = useState('');

  const loadBanks = useCallback(async () => {
    setBanksLoading(true);
    setBanksError('');
    try {
      setBanks(await fetchAllPages(api, '/accounts/bank-accounts/'));
    } catch (err) {
      setBanks([]);
      setBanksError(describeApiError(err));
    } finally {
      setBanksLoading(false);
    }
  }, []);

  const loadBalances = useCallback(async () => {
    setBalancesError('');
    try {
      setBalances(await api.get('/accounts/balances/'));
    } catch (err) {
      setBalances(null);
      setBalancesError(describeApiError(err));
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    setTransfersLoading(true);
    setTransfersError('');
    try {
      setTransfers(await api.get('/accounts/transfers/', { query: { page: transferPage, page_size: TRANSFER_PAGE_SIZE } }));
    } catch (err) {
      setTransfers(null);
      setTransfersError(describeApiError(err));
    } finally {
      setTransfersLoading(false);
    }
  }, [transferPage]);

  useEffect(() => {
    loadBanks();
    loadBalances();
  }, [loadBanks, loadBalances]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  const loadLedgerAccounts = useCallback(async () => {
    try {
      setLedgerAccounts(await fetchAllPages(api, '/accounts/chart-of-accounts/', { type: 'Asset' }));
      setLedgerError('');
    } catch (err) {
      setLedgerError(describeApiError(err));
    }
  }, []);

  // Reload the ledger list after accounts are edited from the "+ Add / Manage" popup.
  useMasterDataRefresh(loadLedgerAccounts, ['ledgerAccounts']);

  const openBankForm = async () => {
    setBankForm(emptyBank());
    setBankFormError('');
    setShowBankForm(true);
    await loadLedgerAccounts();
  };

  const bankById = useMemo(() => Object.fromEntries(banks.map((b) => [b.id, b])), [banks]);
  const bankName = (id) => (bankById[id] ? bankById[id].name : id);

  const handleCreateBank = async (e) => {
    e.preventDefault();
    if (!bankForm.name.trim() || !bankForm.type || !bankForm.accountId) {
      setBankFormError('Name, type and ledger account are required.');
      return;
    }
    const payload = {
      name: bankForm.name.trim(),
      type: bankForm.type,
      accountId: bankForm.accountId,
      bankName: bankForm.bankName.trim() || null,
      accountNumber: bankForm.accountNumber.trim() || null,
      ifsc: bankForm.ifsc.trim() || null,
      branch: bankForm.branch.trim() || null,
      isDefault: bankForm.isDefault,
    };
    if (bankForm.openingBalance !== '') payload.openingBalance = bankForm.openingBalance;
    setBankSaving(true);
    setBankFormError('');
    try {
      await api.post('/accounts/bank-accounts/', payload);
      setShowBankForm(false);
      await Promise.all([loadBanks(), loadBalances()]);
    } catch (err) {
      setBankFormError(describeApiError(err));
    } finally {
      setBankSaving(false);
    }
  };

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    const f = transferForm;
    if (!f.fromAccountId || !f.toAccountId || !f.date) {
      setTransferFormError('Source, destination and date are required.');
      return;
    }
    if (f.fromAccountId === f.toAccountId) {
      setTransferFormError('Source and destination must be different accounts.');
      return;
    }
    if (!(Number(f.amount) > 0)) {
      setTransferFormError('Amount must be greater than zero.');
      return;
    }
    setTransferSaving(true);
    setTransferFormError('');
    try {
      await api.post('/accounts/transfers/', {
        fromAccountId: f.fromAccountId,
        toAccountId: f.toAccountId,
        amount: f.amount,
        date: f.date,
        reference: f.reference.trim() || null,
        notes: f.notes.trim() || null,
      });
      setShowTransferForm(false);
      setTransferForm(emptyTransfer());
      if (transferPage !== 1) setTransferPage(1);
      await Promise.all([loadTransfers(), loadBanks(), loadBalances()]);
    } catch (err) {
      setTransferFormError(describeApiError(err));
    } finally {
      setTransferSaving(false);
    }
  };

  const transferRows = unwrapList(transfers);
  const balanceRows = unwrapList(balances);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash & Bank Accounts"
        subtitle="Ledger balances of bank and cash accounts, and inter-account transfers."
        guide={cashBankGuide}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={ArrowRightLeft} onClick={() => { setTransferForm(emptyTransfer()); setTransferFormError(''); setShowTransferForm(true); }} disabled={banks.length < 2}>
              New Transfer
            </Button>
            <Button icon={Plus} onClick={openBankForm}>Add Bank / Cash Account</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi
          label="Total Liquidity"
          value={balances ? formatINR(balances.aggregates?.totalBalance) : '—'}
          tone="text-slate-900"
          note={balancesError ? 'Balances unavailable' : 'Sum of ledger balances (server)'}
        />
        <Kpi label="Bank & Cash Accounts" value={banksLoading ? '—' : String(banks.length)} />
        <Kpi label="Transfers Recorded" value={transfers ? String(transfers.count ?? 0) : '—'} />
      </div>
      <ErrorState message={balancesError ? `Balances could not be loaded — ${balancesError}` : ''} onRetry={loadBalances} />

      <Card title="Bank & Cash Register" subtitle="Balance = opening balance + posted debits − credits on the linked ledger account.">
        <ErrorState message={banksError} onRetry={loadBanks} />
        {banksLoading ? (
          <LoadingState label="Loading accounts…" />
        ) : !banksError && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-[#dce5f4]">
                <tr>
                  <th className={thClass}>Account</th>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Bank / Branch</th>
                  <th className={thClass}>Account No. / IFSC</th>
                  <th className={thClass}>Ledger Account</th>
                  <th className={`${thClass} text-right`}>Opening</th>
                  <th className={`${thClass} text-right`}>Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {banks.length === 0 && <EmptyRow colSpan={7} message="No bank or cash accounts yet. Add one to start tracking balances." />}
                {banks.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <span className="font-semibold text-slate-800">{b.name}</span>
                      {b.isDefault && <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Default</span>}
                      {b.isActive === false && <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">Inactive</span>}
                    </td>
                    <td className="py-2 px-3">{b.type}</td>
                    <td className="py-2 px-3">{[b.bankName, b.branch].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="py-2 px-3 font-mono">{[b.accountNumber, b.ifsc].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="py-2 px-3">{b.accountName || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono">{formatINR(b.openingBalance)}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatINR(b.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {balanceRows.length > 0 && (
        <Card title="Ledger Balances" subtitle="As reported by /accounts/balances/.">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {balanceRows.map((r) => (
              <div key={r.id} className="border border-[#dce5f4] rounded-xl p-3">
                <p className="text-[11px] font-semibold text-slate-500">{r.name}{r.bankName ? ` · ${r.bankName}` : ''}</p>
                <p className="font-mono font-bold text-slate-900 mt-1">{formatINR(r.balance)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Inter-Account Transfers" subtitle="Each transfer posts a balanced journal entry on the server; P&L is unaffected.">
        <ErrorState message={transfersError} onRetry={loadTransfers} />
        {transfersLoading ? (
          <LoadingState label="Loading transfers…" />
        ) : !transfersError && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-[#dce5f4]">
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>From</th>
                  <th className={thClass}>To</th>
                  <th className={thClass}>Reference</th>
                  <th className={thClass}>Notes</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transferRows.length === 0 && <EmptyRow colSpan={6} message="No transfers recorded yet." />}
                {transferRows.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="py-2 px-3">{bankName(t.fromAccountId)}</td>
                    <td className="py-2 px-3">{bankName(t.toAccountId)}</td>
                    <td className="py-2 px-3 font-mono">{t.reference || '—'}</td>
                    <td className="py-2 px-3">{t.notes || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatINR(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {transfers && (transfers.count ?? 0) > TRANSFER_PAGE_SIZE && (
          <div className="mt-3">
            <Pagination total={transfers.count} page={transferPage} pageSize={TRANSFER_PAGE_SIZE} onChange={setTransferPage} />
          </div>
        )}
      </Card>

      <Modal isOpen={showBankForm} onClose={bankSaving ? undefined : () => setShowBankForm(false)} title="Add Bank / Cash Account" size="lg">
        <form onSubmit={handleCreateBank} className="space-y-3 text-xs">
          <ErrorState message={ledgerError ? `Ledger accounts could not be loaded — ${ledgerError}` : ''} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Display Name *</label>
              <input required value={bankForm.name} onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Type *</label>
              <select required value={bankForm.type} onChange={(e) => setBankForm({ ...bankForm, type: e.target.value })} className={inputClass}>
                <option value="">Select type…</option>
                {BANK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <label className={labelClass}>Ledger Account (Chart of Accounts, Asset) *</label>
                <MasterSourceLink source="ledgerAccounts" />
              </div>
              <select required value={bankForm.accountId} onChange={(e) => setBankForm({ ...bankForm, accountId: e.target.value })} className={inputClass}>
                <option value="">Select ledger account…</option>
                {ledgerAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code ? `${a.code} - ` : ''}{a.name}{a.subtype ? ` (${a.subtype})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Bank Name</label>
              <input value={bankForm.bankName} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Branch</label>
              <input value={bankForm.branch} onChange={(e) => setBankForm({ ...bankForm, branch: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Account Number</label>
              <input value={bankForm.accountNumber} onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className={labelClass}>IFSC</label>
              <input value={bankForm.ifsc} onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value.toUpperCase() })} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className={labelClass}>Opening Balance (₹)</label>
              <input type="number" step="0.01" value={bankForm.openingBalance} onChange={(e) => setBankForm({ ...bankForm, openingBalance: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
            <label className="flex items-center gap-2 pt-5 text-slate-700 font-semibold">
              <input type="checkbox" checked={bankForm.isDefault} onChange={(e) => setBankForm({ ...bankForm, isDefault: e.target.checked })} />
              Default account
            </label>
          </div>
          <ErrorState message={bankFormError} />
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-[#dce5f4]">
            <Button type="button" variant="outline" onClick={() => setShowBankForm(false)} disabled={bankSaving}>Cancel</Button>
            <Button type="submit" disabled={bankSaving}>{bankSaving ? 'Saving…' : 'Save Account'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showTransferForm} onClose={transferSaving ? undefined : () => setShowTransferForm(false)} title="New Inter-Account Transfer" size="lg">
        <form onSubmit={handleCreateTransfer} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>From Account *</label>
              <select required value={transferForm.fromAccountId} onChange={(e) => setTransferForm({ ...transferForm, fromAccountId: e.target.value })} className={inputClass}>
                <option value="">Select source…</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.name} — {formatINR(b.balance)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>To Account *</label>
              <select required value={transferForm.toAccountId} onChange={(e) => setTransferForm({ ...transferForm, toAccountId: e.target.value })} className={inputClass}>
                <option value="">Select destination…</option>
                {banks.filter((b) => b.id !== transferForm.fromAccountId).map((b) => <option key={b.id} value={b.id}>{b.name} — {formatINR(b.balance)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Amount (₹) *</label>
              <input type="number" min="0.01" step="0.01" required value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} className={`${inputClass} font-mono`} />
            </div>
            <div>
              <label className={labelClass}>Date *</label>
              <input type="date" required value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Reference</label>
              <input value={transferForm.reference} onChange={(e) => setTransferForm({ ...transferForm, reference: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <input value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} className={inputClass} />
            </div>
          </div>
          <ErrorState message={transferFormError} />
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-[#dce5f4]">
            <Button type="button" variant="outline" onClick={() => setShowTransferForm(false)} disabled={transferSaving}>Cancel</Button>
            <Button type="submit" disabled={transferSaving}>{transferSaving ? 'Posting…' : 'Post Transfer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CashBankPage;
