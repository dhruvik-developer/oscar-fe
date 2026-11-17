import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Search,
  RefreshCw,
  X,
  Building2,
  Phone,
  Mail,
  AlertCircle,
  Users,
  Truck,
} from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/ui/PageHeader';
import TablePagination from '../../components/ui/TablePagination';
import { numIN } from '../../utils/formatters';
import SupplierLedgerDrawer from './SupplierLedgerDrawer';

export default function SupplierLedgerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = searchParams.get('type') === 'customer' ? 'customer' : 'supplier';

  // Active party tab: 'supplier' or 'customer'
  const [activeTab, setActiveTab] = useState(initialType);

  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Drawer interaction state
  const [selectedParty, setSelectedParty] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Synchronize active tab with URL search parameter
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'customer' && activeTab !== 'customer') {
      setActiveTab('customer');
    } else if (type === 'supplier' && activeTab !== 'supplier') {
      setActiveTab('supplier');
    }
  }, [searchParams, activeTab]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ type: newTab });
    setSearchQuery('');
    setPage(1);
  };

  // Fetch Suppliers
  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/purchase/vendors/', { query: { page_size: 500 } });
      const rows = Array.isArray(res) ? res : (res?.results || []);
      setSuppliers(rows);
    } catch (err) {
      console.error('Failed to load supplier list:', err);
      setError(err?.message || 'Failed to fetch supplier accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Customers
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/parties/customers/', { query: { page_size: 500 } });
      const rows = Array.isArray(res) ? res : (res?.results || []);
      setCustomers(rows);
    } catch (err) {
      console.error('Failed to load customer list:', err);
      setError(err?.message || 'Failed to fetch customer accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'supplier') {
      fetchSuppliers();
    } else {
      fetchCustomers();
    }
  }, [activeTab, fetchSuppliers, fetchCustomers]);

  const refreshCurrentTab = () => {
    if (activeTab === 'supplier') {
      fetchSuppliers();
    } else {
      fetchCustomers();
    }
  };

  const isCustomerTab = activeTab === 'customer';
  const currentList = isCustomerTab ? customers : suppliers;

  // Client-side search by code, name, or gstin
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return currentList;
    const q = searchQuery.toLowerCase().trim();
    return currentList.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const code = (p.code || '').toLowerCase();
      const gstin = (p.gstin || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      return name.includes(q) || code.includes(q) || gstin.includes(q) || phone.includes(q);
    });
  }, [currentList, searchQuery]);

  // Reset page when search query changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // Paged slice for table
  const pagedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  // Open the ledger drawer
  const handleOpenLedger = (party) => {
    // Ensure type field is attached
    const enrichedParty = {
      ...party,
      type: isCustomerTab ? 'Customer' : (party.type || 'Vendor'),
    };
    setSelectedParty(enrichedParty);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title={isCustomerTab ? 'Customer Ledger' : 'Supplier Ledger'}
        subtitle={
          isCustomerTab
            ? 'Customer account statements, sales invoices, and receivables'
            : 'Supplier account balances, purchase bills, and payables'
        }
        breadcrumb={[
          { label: 'Accounts', path: '/accounts/general-ledger' },
          { label: isCustomerTab ? 'Customer Ledger' : 'Supplier Ledger' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshCurrentTab}
              disabled={loading}
              className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
              title="Refresh List"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Main Container Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {/* Top Segmented Tab Switcher */}
        <div className="p-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => handleTabChange('supplier')}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isCustomerTab
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck size={14} />
              <span>Suppliers (Vendors)</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  !isCustomerTab ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {suppliers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('customer')}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isCustomerTab
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={14} />
              <span>Customers</span>
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  isCustomerTab ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {customers.length}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            Showing <strong className="text-slate-800 font-bold">{filteredList.length}</strong>{' '}
            {isCustomerTab ? 'customers' : 'suppliers'}
          </div>
        </div>

        {/* Search & Summary Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Search by code, ${isCustomerTab ? 'customer' : 'supplier'} name, or GSTIN...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium sm:hidden">
            Total: <strong className="text-slate-800">{filteredList.length}</strong>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 m-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-rose-800 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={refreshCurrentTab}
              className="font-bold underline text-rose-700 hover:text-rose-900 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-3 px-4">{isCustomerTab ? 'Customer Code' : 'Supplier Code'}</th>
                <th className="py-3 px-4">{isCustomerTab ? 'Customer Name' : 'Supplier Name'}</th>
                <th className="py-3 px-3">GSTIN</th>
                <th className="py-3 px-3 text-right">Opening Balance (₹)</th>
                <th className="py-3 px-3 text-right">Current Balance (₹)</th>
                <th className="py-3 px-3 text-center">Balance Type</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading && currentList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-blue-600" />
                      <span className="text-xs font-medium">
                        Loading {isCustomerTab ? 'customer' : 'supplier'} accounts...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600 text-sm">
                      No {isCustomerTab ? 'customers' : 'suppliers'} found
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {searchQuery
                        ? 'Try adjusting your search keywords.'
                        : `No ${isCustomerTab ? 'customer' : 'supplier'} records exist in your master directory.`}
                    </p>
                  </td>
                </tr>
              ) : (
                pagedList.map((party) => {
                  const opening = Number(party.opening_balance || 0);
                  const balance = Number(party.balance || 0);

                  // Accounting Direction:
                  // For Customer: balance >= 0 is Dr (Receivable - to collect from customer); < 0 is Cr (Advance)
                  // For Supplier: balance >= 0 is Cr (Payable - to pay to supplier); < 0 is Dr (Advance)
                  const isPositive = balance >= 0;
                  const balanceType = isCustomerTab
                    ? isPositive
                      ? 'Dr'
                      : 'Cr'
                    : isPositive
                    ? 'Cr'
                    : 'Dr';
                  const balanceCategory = isCustomerTab
                    ? isPositive
                      ? 'Receivable'
                      : 'Advance'
                    : isPositive
                    ? 'Payable'
                    : 'Advance';

                  return (
                    <tr
                      key={party.id}
                      className="hover:bg-blue-50/40 transition-colors group cursor-default"
                    >
                      {/* 1. Code */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {party.code || (isCustomerTab ? 'CUST' : 'VEND')}
                        </span>
                      </td>

                      {/* 2. Name & Meta */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 text-xs tracking-tight group-hover:text-blue-700 transition-colors">
                            {party.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                            {party.phone && (
                              <span className="flex items-center gap-0.5">
                                <Phone size={10} /> {party.phone}
                              </span>
                            )}
                            {party.email && (
                              <span className="flex items-center gap-0.5 truncate max-w-[140px]">
                                <Mail size={10} /> {party.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. GSTIN */}
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {party.gstin || <span className="text-slate-300 font-sans">—</span>}
                      </td>

                      {/* 4. Opening Balance */}
                      <td className="py-3 px-3 text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                        {opening !== 0 ? (
                          <>
                            ₹{numIN(Math.abs(opening))}{' '}
                            <span className="text-[10px] text-slate-400 font-sans font-semibold">
                              {isCustomerTab
                                ? opening >= 0
                                  ? 'Dr'
                                  : 'Cr'
                                : opening >= 0
                                ? 'Cr'
                                : 'Dr'}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-400">₹0</span>
                        )}
                      </td>

                      {/* 5. Current Balance */}
                      <td className="py-3 px-3 text-right font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        ₹{numIN(Math.abs(balance))}
                      </td>

                      {/* 6. Balance Type */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            balanceCategory === 'Receivable'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : balanceCategory === 'Payable'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-purple-50 text-purple-800 border border-purple-200'
                          }`}
                        >
                          {balanceType} ({balanceCategory})
                        </span>
                      </td>

                      {/* 7. Action: Ledger Button */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenLedger(party)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer active:scale-98"
                          title={`View Ledger for ${party.name}`}
                        >
                          <BookOpen size={13} />
                          <span>Ledger</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredList.length > 0 && (
          <TablePagination
            total={filteredList.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        )}
      </div>

      {/* Supplier & Customer Ledger Right-Side Drawer */}
      <SupplierLedgerDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        supplier={selectedParty}
        onRefreshSupplierList={refreshCurrentTab}
      />
    </div>
  );
}
