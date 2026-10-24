import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext';
import { Search, ShoppingCart, Truck, Receipt, Package, Users, Building2, FileSpreadsheet, ArrowRight, FileText, BarChart3, X, Layers, Sparkles, UserCheck, Calendar } from 'lucide-react';
/** What the palette searches while it is closed: nothing. */
const NO_RECORDS = {
    items: [], customers: [], vendors: [], salesOrders: [],
    purchaseOrders: [], invoices: [], deliveryChallans: [], proformaInvoices: [],
};
export const CommandPalette = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    // The palette is mounted on every screen but searches only once it is open,
    // and reading a collection is what loads it — so the eight collections it
    // searches are pulled on the first Ctrl+K, not on every page.
    const erp = useERP();
    const { items, customers, vendors, salesOrders, purchaseOrders, invoices, deliveryChallans, proformaInvoices = [] } = isOpen ? erp : NO_RECORDS;
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);
    // Global keydown for Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && String(e.key ?? '').toLowerCase() === 'k') {
                e.preventDefault();
                if (isOpen)
                    onClose();
                else
                    onClose(); // parent handles toggle if bound
            }
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    const cleanQuery = query.trim().toLowerCase();
    // Search results grouping
    const navigationItems = [
        { label: 'Dashboard', path: '/dashboard', icon: BarChart3, category: 'Navigation' },
        { label: 'CRM Leads', path: '/crm/leads', icon: Users, category: 'Navigation' },
        { label: 'Sales Orders', path: '/sales/orders', icon: ShoppingCart, category: 'Navigation' },
        { label: 'Proforma Invoices', path: '/sales/proforma', icon: FileSpreadsheet, category: 'Navigation' },
        { label: 'Delivery Challans', path: '/sales/delivery', icon: Truck, category: 'Navigation' },
        { label: 'Sales Invoices', path: '/sales/invoices', icon: Receipt, category: 'Navigation' },
        { label: 'Quotations', path: '/sales/quotations', icon: FileText, category: 'Navigation' },
        { label: 'Inventory Items', path: '/inventory/items', icon: Package, category: 'Navigation' },
        { label: 'Stock Position', path: '/inventory/stock', icon: BarChart3, category: 'Navigation' },
        { label: 'Purchase Orders', path: '/purchase/orders', icon: ShoppingCart, category: 'Navigation' },
        { label: 'Purchase Bills & AP', path: '/purchase/bills', icon: FileSpreadsheet, category: 'Navigation' },
        { label: 'Parties Directory', path: '/parties', icon: Building2, category: 'Navigation' },
        { label: 'HRMS Employees', path: '/hrms/employees', icon: Users, category: 'Navigation' },
        { label: 'Employee Portal', path: '/employee/portal', icon: UserCheck, category: 'Navigation' },
        { label: 'Apply Leave (Employee Portal)', path: '/employee/portal', icon: Calendar, category: 'Actions' },
        { label: 'ERP Reports & Analytics', path: '/reports', icon: BarChart3, category: 'Navigation' },
    ].filter((n) => !cleanQuery || String(n.label ?? '').toLowerCase().includes(cleanQuery));
    const matchedItems = items
        .filter((i) => String(i.name ?? '').toLowerCase().includes(cleanQuery) ||
        String(i.sku ?? '').toLowerCase().includes(cleanQuery) ||
        (i.category && String(i.category ?? '').toLowerCase().includes(cleanQuery)))
        .slice(0, 4)
        .map((i) => ({
        label: `[${i.sku}] ${i.name}`,
        sub: `Stock: ${i.stock || 0} ${i.unit || 'pcs'} • Selling: $${i.sellingPrice}`,
        path: '/inventory/items',
        icon: Package,
        category: 'Inventory Items',
    }));
    const matchedCustomers = customers
        .filter((c) => String(c.name ?? '').toLowerCase().includes(cleanQuery) ||
        String(c.code ?? '').toLowerCase().includes(cleanQuery) ||
        (c.city && String(c.city ?? '').toLowerCase().includes(cleanQuery)))
        .slice(0, 3)
        .map((c) => ({
        label: c.name,
        sub: `Code: ${c.code} • Outstanding: $${c.balance.toFixed(2)}`,
        path: '/parties',
        icon: Users,
        category: 'Customers',
    }));
    const matchedVendors = vendors
        .filter((v) => String(v.name ?? '').toLowerCase().includes(cleanQuery) ||
        String(v.code ?? '').toLowerCase().includes(cleanQuery))
        .slice(0, 3)
        .map((v) => ({
        label: v.name,
        sub: `Vendor Code: ${v.code} • Outstanding Payable: $${v.balance.toFixed(2)}`,
        path: '/parties',
        icon: Building2,
        category: 'Suppliers & Vendors',
    }));
    const matchedSalesOrders = salesOrders
        .filter((o) => String(o.orderNumber ?? '').toLowerCase().includes(cleanQuery) ||
        String(o.customer ?? '').toLowerCase().includes(cleanQuery))
        .slice(0, 3)
        .map((o) => ({
        label: `${o.orderNumber} - ${o.customer}`,
        sub: `Value: $${o.amount.toFixed(2)} • Stage: ${o.stage}`,
        path: '/sales/orders',
        icon: ShoppingCart,
        category: 'Sales Orders',
    }));
    const matchedProformas = (proformaInvoices || [])
        .filter((pi) => pi.piNumber?.toLowerCase().includes(cleanQuery) ||
        pi.customer?.toLowerCase().includes(cleanQuery) ||
        pi.referenceSo?.toLowerCase().includes(cleanQuery))
        .slice(0, 3)
        .map((pi) => ({
        label: `${pi.piNumber} - ${pi.customer}`,
        sub: `Total: $${(pi.grandTotal || pi.total || 0).toFixed(2)} • Status: ${pi.status}`,
        path: '/sales/proforma',
        icon: FileSpreadsheet,
        category: 'Proforma Invoices',
    }));
    const matchedInvoices = invoices
        .filter((inv) => String(inv.invoiceNumber ?? '').toLowerCase().includes(cleanQuery) ||
        String(inv.customer ?? '').toLowerCase().includes(cleanQuery))
        .slice(0, 3)
        .map((inv) => ({
        label: `${inv.invoiceNumber} - ${inv.customer}`,
        sub: `Total: $${inv.total.toFixed(2)} • Status: ${inv.status}`,
        path: '/sales/invoices',
        icon: Receipt,
        category: 'Invoices',
    }));
    const allResults = [
        ...(cleanQuery ? matchedItems : []),
        ...(cleanQuery ? matchedCustomers : []),
        ...(cleanQuery ? matchedVendors : []),
        ...(cleanQuery ? matchedSalesOrders : []),
        ...(cleanQuery ? matchedProformas : []),
        ...(cleanQuery ? matchedInvoices : []),
        ...navigationItems,
    ];
    const handleSelect = (result) => {
        navigate(result.path);
        onClose();
    };
    const handleKeyDownList = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % Math.max(1, allResults.length));
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + allResults.length) % Math.max(1, allResults.length));
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            if (allResults[selectedIndex]) {
                handleSelect(allResults[selectedIndex]);
            }
        }
    };
    return (<div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-2 pt-12 sm:p-4 sm:pt-20 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Bar Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 bg-slate-50/50">
          <Search className="w-5 h-5 text-blue-600 shrink-0"/>
          <input ref={inputRef} type="text" value={query} onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
        }} onKeyDown={handleKeyDownList} placeholder="Type a command, SKU, customer, order #, or page..." className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"/>
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-500 bg-slate-200/80 rounded border border-slate-300">
              ESC
            </kbd>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer">
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-1 divide-y divide-slate-100 flex-1 text-xs">
          {allResults.length === 0 ? (<div className="py-12 text-center text-slate-400 space-y-2">
              <Sparkles className="w-8 h-8 mx-auto text-slate-300"/>
              <p className="font-semibold text-slate-600">No matching records found</p>
              <p className="text-[11px] text-slate-400">Try searching for an SKU (e.g. &quot;SRV-001&quot;), Customer (e.g. &quot;Acme&quot;), or Page name.</p>
            </div>) : (allResults.map((res, index) => {
            const Icon = res.icon || Layers;
            const isSelected = index === selectedIndex;
            return (<div key={`${res.category}-${res.label}-${index}`} onClick={() => handleSelect(res)} onMouseEnter={() => setSelectedIndex(index)} className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-800'}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Icon size={16}/>
                    </div>
                    <div className="truncate">
                      <p className="font-semibold truncate">{res.label}</p>
                      {res.sub && (<p className={`text-[11px] truncate ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>
                          {res.sub}
                        </p>)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                      {res.category}
                    </span>
                    <ArrowRight size={14} className={`transition-transform ${isSelected ? 'text-blue-600 translate-x-0.5' : 'text-slate-300'}`}/>
                  </div>
                </div>);
        }))}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded mr-1">↑</kbd>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded mr-1">↓</kbd>
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded mr-1">↵</kbd>
              Open
            </span>
          </div>
          <span className="font-semibold text-blue-600">Horizon Global Search</span>
        </div>
      </div>
    </div>);
};
