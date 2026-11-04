import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/common/PageHeader';
import TablePagination from '../../components/ui/TablePagination';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import {
  Plus,
  X,
  Eye,
  Pencil,
  Trash2,
  Send,
  Upload,
  Building2,
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  Layers,
  Info,
} from 'lucide-react';
import { toISODate, getCurrentISODate } from '../../utils/dateUtils';
import { api } from '../../services/api';

const vendorBillGuide = {
  title: 'Vendor Bills (Manual Entry)',
  subtitle: 'Select a Purchase Order to auto-fill vendor details, load linked batches, and bill batch-wise.',
  purpose: 'A Vendor Bill is the supplier invoice recorded against an existing Purchase Order. Selecting the PO automatically loads the verified vendor information and its received batches for exact batch-wise billing and 3-way matching.',
  keyTerms: [
    { term: 'Vendor Bill', definition: 'A supplier invoice linked to a Purchase Order awaiting 3-way matching.' },
    { term: 'Batch-Wise Billing', definition: 'Billing specific received batches with separate rates and quantities.' },
    { term: 'Send for Matching', definition: 'Verifies the bill against the PO and GRN, then raises the official Purchase Bill.' },
  ],
  tips: [
    'Select the Purchase Order first — vendor details and billable batches populate automatically.',
    'Enter custom rates per batch if supplier invoiced rates differ across lots.',
  ],
  workflow: ['Select PO', 'Auto-load Vendor & Batches', 'Enter Batch Qty & Rate', 'Save Bill', 'Send for Matching'],
};

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function numIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export const VendorBillsPage = () => {
  const navigate = useNavigate();
  const {
    vendorBills = [],
    vendors = [],
    purchaseOrders = [],
    purchaseBills = [],
    items = [],
    addVendorBill,
    updateVendorBill,
    cancelVendorBill,
    sendVendorBillForMatching,
    formatCurrency,
    formatDateDDMMYYYY,
  } = useERP();

  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [fPoId, setFPoId] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [poDropdownOpen, setPoDropdownOpen] = useState(false);
  const [poLoading, setPoLoading] = useState(false);

  const [vendorDetails, setVendorDetails] = useState(null);
  const [poSummary, setPoSummary] = useState(null);
  const [batchLines, setBatchLines] = useState([]);

  const [fBillNo, setFBillNo] = useState('');
  const [fBillDate, setFBillDate] = useState(getCurrentISODate());
  const [fFileName, setFFileName] = useState('');
  const [fGstPct, setFGstPct] = useState(5);
  const [fRemarks, setFRemarks] = useState('');

  // Filtered vendor bills for list view
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (vendorBills || []).filter((b) => {
      if (vendorFilter && b.vendorId !== vendorFilter) return false;
      if (statusFilter && b.status !== statusFilter) return false;
      const iso = toISODate(b.billDate || b.date);
      if (dateFrom && iso && iso < dateFrom) return false;
      if (dateTo && iso && iso > dateTo) return false;
      if (!term) return true;
      const po = purchaseOrders.find((p) => p.id === b.purchaseOrderId);
      const hay = [b.vendorBillNumber, b.billNumber, b.vendor, b.vendorName, po?.poNumber, b.poNumber]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [vendorBills, purchaseOrders, search, vendorFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [search, vendorFilter, statusFilter, dateFrom, dateTo]);

  const paginatedBills = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const selected = useMemo(
    () => (vendorBills || []).find((b) => b.id === selectedId) || null,
    [vendorBills, selectedId],
  );

  const poNumberOf = (b) => {
    if (b?.poNumber) return b.poNumber;
    const po = purchaseOrders.find((p) => p.id === b?.purchaseOrderId);
    return po?.poNumber || '—';
  };

  const grnNumberOf = (b) => {
    if (!b?.grnId) return '—';
    const g = purchaseBills.find((p) => p.id === b.grnId);
    return g?.billNumber || b.grnId;
  };

  // Eligible POs for the dropdown (exclude Cancelled)
  const eligiblePOs = useMemo(() => {
    return (purchaseOrders || []).filter((p) => p.status !== 'Cancelled');
  }, [purchaseOrders]);

  const filteredPOs = useMemo(() => {
    const q = poSearch.trim().toLowerCase();
    if (!q) return eligiblePOs;
    return eligiblePOs.filter((p) => {
      const vendorName = p.vendor || p.vendorName || p.partyName || '';
      const fabric = p.fabric || p.lineItems?.[0]?.itemName || p.items?.[0]?.name || p.fabricQuality || '';
      return (
        p.poNumber?.toLowerCase().includes(q) ||
        vendorName.toLowerCase().includes(q) ||
        fabric.toLowerCase().includes(q)
      );
    });
  }, [eligiblePOs, poSearch]);

  const selectedPOObj = useMemo(() => {
    return purchaseOrders.find((p) => p.id === fPoId) || null;
  }, [purchaseOrders, fPoId]);

  // Format PO label for dropdown: PO Number | Vendor Name | Fabric / Quality | Ordered Quantity | PO Date
  const formatPoOption = (po) => {
    const num = po.poNumber || po.id;
    const vend = po.vendor || po.vendorName || po.partyName || 'Vendor';
    const fabric = po.fabric || po.lineItems?.[0]?.itemName || po.items?.[0]?.name || po.fabricQuality || 'Grey Fabric';
    const qty = po.totalQuantity || po.orderedQty || po.lineItems?.[0]?.qty || po.items?.[0]?.qty || 0;
    const dateStr = formatDateDDMMYYYY(po.docDate || po.poDate || po.date);
    return `${num} | ${vend} | ${fabric} | ${numIN(qty)} Meter | ${dateStr}`;
  };

  // Form financial totals calculated dynamically from batchLines
  const formSubtotal = useMemo(() => {
    return money(
      batchLines.reduce((acc, row) => {
        const q = Number(row.billQty) || 0;
        const r = Number(row.billRate) || 0;
        return acc + q * r;
      }, 0)
    );
  }, [batchLines]);

  const formGstAmount = useMemo(() => {
    return money(formSubtotal * (Number(fGstPct || 0) / 100));
  }, [formSubtotal, fGstPct]);

  const formTotal = useMemo(() => {
    return money(formSubtotal + formGstAmount);
  }, [formSubtotal, formGstAmount]);

  const totalBillQty = useMemo(() => {
    return batchLines.reduce((acc, row) => acc + (Number(row.billQty) || 0), 0);
  }, [batchLines]);

  // Load PO Billable Details from backend
  const loadPoBillableDetails = async (poId, preserveLines = null) => {
    if (!poId) {
      setVendorDetails(null);
      setPoSummary(null);
      setBatchLines([]);
      setPoLoading(false);
      return;
    }

    try {
      setPoLoading(true);
      setFormError('');
      const res = await api.get('/purchase/vendor-bills/po-details/', { params: { poId } });
      const data = res?.data || res;

      if (data?.vendor) {
        setVendorDetails(data.vendor);
      }
      if (data?.poSummary) {
        setPoSummary(data.poSummary);
        if (data.poSummary.defaultGstPct !== undefined && !editingId) {
          setFGstPct(data.poSummary.defaultGstPct);
        }
      }

      const rawBatches = data?.batches || [];
      const initialized = rawBatches.map((b) => {
        const existingLine = preserveLines?.find(
          (pl) => (pl.batchId && pl.batchId === b.batchId) || pl.batchNumber === b.batchCode
        );
        const defaultQty = existingLine ? Number(existingLine.qty) : (b.isFullyBilled ? 0 : b.remainingBillableQty);
        const defaultRate = existingLine ? Number(existingLine.rate) : b.originalPoRate;
        const amt = money(defaultQty * defaultRate);

        return {
          ...b,
          billQty: defaultQty,
          billRate: defaultRate,
          amount: amt,
        };
      });

      setBatchLines(initialized);
    } catch (err) {
      console.error('Failed to load PO billable details:', err);
      setFormError(err?.response?.data?.detail || err?.message || 'Failed to load details for the selected Purchase Order.');
    } finally {
      setPoLoading(false);
    }
  };

  // PO selection handler
  const handleSelectPo = (poId) => {
    setFPoId(poId);
    setPoDropdownOpen(false);
    setPoSearch('');
    // Clear stale vendor details, PO summary, and batch lines before loading fresh
    setVendorDetails(null);
    setPoSummary(null);
    setBatchLines([]);
    if (poId) {
      loadPoBillableDetails(poId);
    }
  };

  // Batch line change handler
  const handleBatchFieldChange = (batchCode, field, value) => {
    setBatchLines((prev) =>
      prev.map((row) => {
        if (row.batchCode !== batchCode) return row;
        const updated = { ...row, [field]: value };
        const q = Number(field === 'billQty' ? value : updated.billQty) || 0;
        const r = Number(field === 'billRate' ? value : updated.billRate) || 0;
        updated.amount = money(q * r);
        return updated;
      })
    );
  };

  const resetForm = () => {
    setFPoId('');
    setPoSearch('');
    setPoDropdownOpen(false);
    setVendorDetails(null);
    setPoSummary(null);
    setBatchLines([]);
    setFBillNo('');
    setFBillDate(getCurrentISODate());
    setFFileName('');
    setFGstPct(5);
    setFRemarks('');
    setEditingId(null);
    setFormError('');
    setPoLoading(false);
    setSubmitting(false);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (bill) => {
    if (!bill) return;
    setEditingId(bill.id);
    setFPoId(bill.purchaseOrderId || '');
    setFBillNo(bill.vendorBillNumber || bill.billNumber || '');
    setFBillDate(toISODate(bill.billDate || bill.date) || getCurrentISODate());
    setFFileName(bill.fileName || '');
    setFGstPct(bill.gstPct ?? 5);
    setFRemarks(bill.remarks || bill.notes || '');
    setFormError('');
    setShowModal(true);

    if (bill.purchaseOrderId) {
      loadPoBillableDetails(bill.purchaseOrderId, bill.lineItems || bill.items || []);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!fPoId) {
      setFormError('Please select a Purchase Order.');
      return;
    }
    if (!fBillNo.trim()) {
      setFormError('Enter the vendor bill / invoice number.');
      return;
    }
    if (!fBillDate) {
      setFormError('Pick the bill date.');
      return;
    }

    const activeBatchRows = batchLines.filter((b) => Number(b.billQty) > 0);
    if (activeBatchRows.length === 0) {
      setFormError('Enter a bill quantity greater than 0 for at least one batch.');
      return;
    }

    for (const b of activeBatchRows) {
      const q = Number(b.billQty);
      const maxQ = Number(b.remainingBillableQty);
      if (q <= 0) {
        setFormError(`Bill quantity for batch ${b.batchCode} must be greater than zero.`);
        return;
      }
      if (b.isFullyBilled) {
        setFormError(`Batch ${b.batchCode} is already fully billed and cannot be re-billed.`);
        return;
      }
      if (q > maxQ + 0.0001) {
        setFormError(`Billed quantity for batch ${b.batchCode} (${numIN(q)}) cannot exceed remaining billable quantity (${numIN(maxQ)}).`);
        return;
      }
      if (Number(b.billRate) < 0) {
        setFormError(`Bill rate for batch ${b.batchCode} cannot be negative.`);
        return;
      }
    }

    const payload = {
      purchaseOrderId: fPoId,
      vendorId: vendorDetails?.vendorId || undefined,
      vendor: vendorDetails?.vendorName || '',
      vendorName: vendorDetails?.vendorName || '',
      vendorBillNumber: fBillNo.trim(),
      billDate: fBillDate,
      fileName: fFileName,
      gstPct: Number(fGstPct) || 0,
      remarks: fRemarks,
      lineItems: activeBatchRows.map((b) => ({
        batchId: b.batchId || undefined,
        batchNumber: b.batchCode,
        grnId: b.grnId || undefined,
        itemId: b.itemId || undefined,
        sku: b.sku || '',
        itemName: b.itemName || '',
        qty: Number(b.billQty),
        rate: Number(b.billRate) || 0,
      })),
    };

    setSubmitting(true);
    let saved;
    try {
      if (editingId) {
        saved = await updateVendorBill(editingId, payload);
      } else {
        saved = await addVendorBill(payload);
      }
    } catch (err) {
      setFormError(err?.response?.data?.detail || err?.message || 'Vendor bill could not be saved.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    if (saved) {
      setSelectedId(saved.id);
      setShowModal(false);
      resetForm();
    }
  };

  const handleDelete = (bill) => {
    if (!bill) return;
    if (!window.confirm(`Delete vendor bill ${bill.vendorBillNumber || ''}? This cannot be undone.`)) return;
    cancelVendorBill(bill.id);
    if (selectedId === bill.id) setSelectedId(null);
  };

  const handleSendForMatching = async (bill) => {
    if (!bill) return;
    await sendVendorBillForMatching(bill.id);
    navigate(`/purchase/bill-matching?bill=${bill.id}`);
  };

  const linkedPurchaseBill = selected?.purchaseBillId
    ? purchaseBills.find((p) => p.id === selected.purchaseBillId)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Bills (Manual Entry)"
        subtitle="Select a Purchase Order to auto-fill vendor details, load linked batches, and bill batch-wise."
        guide={vendorBillGuide}
        actions={(
          <Button icon={Plus} onClick={openCreate}>
            Create Vendor Bill
          </Button>
        )}
      />

      <div className="bg-white border border-[#CED4DA] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
            placeholder="Search bill no, vendor, PO..."
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 w-64"
          />
          <select value={vendorFilter} onChange={(ev) => setVendorFilter(ev.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 bg-white">
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(ev) => setStatusFilter(ev.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 bg-white">
            <option value="">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <input type="date" value={dateFrom} onChange={(ev) => setDateFrom(ev.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800" title="Date from" />
          <input type="date" value={dateTo} onChange={(ev) => setDateTo(ev.target.value)} className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800" title="Date to" />
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">
            No vendor bills yet — enter your first bill manually.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs text-slate-600">
              <thead className="bg-slate-50 uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10">#</th>
                  <th className="py-2.5 px-3">Bill No.</th>
                  <th className="py-2.5 px-3">Bill Date</th>
                  <th className="py-2.5 px-3">Vendor</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedBills.map((b, idx) => (
                  <tr key={b.id} className="hover:bg-slate-50/70">
                    <td className="p-2.5 font-mono text-slate-400">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="p-2.5">
                      <button onClick={() => setSelectedId(b.id)} className="font-mono font-bold text-primary hover:underline cursor-pointer">
                        {b.vendorBillNumber || b.billNumber}
                      </button>
                    </td>
                    <td className="p-2.5 font-mono text-[11px]">{formatDateDDMMYYYY(b.billDate || b.date)}</td>
                    <td className="p-2.5 font-semibold text-slate-700">{b.vendor || b.vendorName}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">{formatCurrency(Number(b.total ?? b.amount) || 0)}</td>
                    <td className="p-2.5 text-center"><StatusBadge status={b.status} /></td>
                    <td className="p-2.5 text-center whitespace-nowrap">
                      <button onClick={() => setSelectedId(b.id)} className="p-1.5 text-muted hover:text-primary hover:bg-card-hover rounded-lg cursor-pointer" title="View">
                        <Eye size={13} />
                      </button>
                      <button onClick={() => openEdit(b)} className="p-1.5 text-muted hover:text-primary hover:bg-card-hover rounded-lg cursor-pointer" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(b)} className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
            />
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full p-4 sm:p-6 text-xs max-h-[94vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-[#1F2E4A]">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1F2E4A]">
                    {editingId ? 'Edit Vendor Bill' : 'Create Vendor Bill (PO-Driven)'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Select a Purchase Order to automatically load vendor information and batch-wise billing rows.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 mt-3 overflow-y-auto pr-1 flex-1">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs font-semibold flex items-start gap-2 shadow-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                  <span className="flex-1">{formError}</span>
                </div>
              )}

              {/* Top Row: Purchase Order Selection & Header Info */}
              <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-3.5 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                  {/* Searchable Purchase Order Selection */}
                  <div className="lg:col-span-6 relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-800 text-[11px]">
                        Select Purchase Order <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-400">Loads Vendor & Batches</span>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setPoDropdownOpen((prev) => !prev)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-left text-xs text-slate-800 flex items-center justify-between hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <span className="truncate font-medium">
                          {selectedPOObj ? formatPoOption(selectedPOObj) : '-- Select Purchase Order * --'}
                        </span>
                        <Search size={14} className="text-slate-400 shrink-0 ml-2" />
                      </button>

                      {poDropdownOpen && (
                        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-hidden flex flex-col">
                          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
                            <Search size={13} className="text-slate-400" />
                            <input
                              type="text"
                              value={poSearch}
                              onChange={(e) => setPoSearch(e.target.value)}
                              placeholder="Search PO #, vendor, or fabric..."
                              className="w-full bg-transparent text-xs text-slate-800 outline-none"
                              autoFocus
                            />
                            {poSearch && (
                              <button
                                type="button"
                                onClick={() => setPoSearch('')}
                                className="text-slate-400 hover:text-slate-600 p-0.5"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                          <div className="overflow-y-auto max-h-52 divide-y divide-slate-100 text-[11.5px]">
                            {filteredPOs.length === 0 ? (
                              <div className="p-3 text-center text-slate-400">No matching purchase orders found.</div>
                            ) : (
                              filteredPOs.map((p) => {
                                const isSelected = p.id === fPoId;
                                return (
                                  <div
                                    key={p.id}
                                    onClick={() => handleSelectPo(p.id)}
                                    className={`px-3 py-2 cursor-pointer hover:bg-blue-50/70 transition-colors ${
                                      isSelected ? 'bg-blue-50 font-bold text-primary' : 'text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between font-mono text-[11px] font-bold text-slate-900">
                                      <span>{p.poNumber}</span>
                                      <span className="text-[10px] font-normal text-slate-500 font-sans">
                                        {formatDateDDMMYYYY(p.docDate || p.poDate || p.date)}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-600 truncate">
                                      {p.vendor || p.vendorName || p.partyName} • {p.fabric || p.lineItems?.[0]?.itemName || p.items?.[0]?.name || 'Grey Fabric'} • {numIN(p.totalQuantity || p.orderedQty || p.lineItems?.[0]?.qty || 0)} M
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bill / Invoice Number */}
                  <div className="lg:col-span-2">
                    <label className="block font-bold text-slate-800 text-[11px] mb-1">
                      Bill / Invoice No <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fBillNo}
                      onChange={(ev) => setFBillNo(ev.target.value)}
                      placeholder="e.g. INV-2026-102"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono font-bold"
                      required
                    />
                  </div>

                  {/* Bill Date */}
                  <div className="lg:col-span-2">
                    <label className="block font-bold text-slate-800 text-[11px] mb-1">
                      Bill Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={fBillDate}
                      onChange={(ev) => setFBillDate(ev.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                      required
                    />
                  </div>

                  {/* Upload Vendor Bill */}
                  <div className="lg:col-span-2">
                    <label className="block font-bold text-slate-800 text-[11px] mb-1">Upload Bill</label>
                    <label className="flex items-center gap-1.5 border border-dashed border-slate-300 rounded-lg p-2 bg-white text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors">
                      <Upload size={13} className="shrink-0 text-slate-500" />
                      <span className="truncate text-[11px]">{fFileName || 'Choose file...'}</span>
                      <input type="file" className="hidden" onChange={(ev) => setFFileName(ev.target.files?.[0]?.name || '')} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Vendor Details Section (Auto-populated from selected PO) */}
              {poLoading ? (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-center text-slate-500 text-xs animate-pulse">
                  Loading vendor and purchase order details...
                </div>
              ) : vendorDetails ? (
                <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <Building2 size={15} className="text-[#1F2E4A]" />
                      <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">Vendor Information</span>
                    </div>
                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <CheckCircle2 size={11} className="text-blue-600" /> Vendor linked to selected PO
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-[11px]">
                    <div className="bg-white border border-slate-200/80 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Vendor Name</span>
                      <span className="font-bold text-slate-800 text-xs truncate block">{vendorDetails.vendorName || '—'}</span>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Vendor Code</span>
                      <span className="font-mono font-semibold text-slate-800 block">{vendorDetails.vendorCode || '—'}</span>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">GSTIN</span>
                      <span className="font-mono font-semibold text-slate-800 block">{vendorDetails.vendorGstin || '—'}</span>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Contact Person</span>
                      <span className="font-medium text-slate-800 truncate block">{vendorDetails.contactPerson || '—'}</span>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Phone</span>
                      <span className="font-mono text-slate-800 block">{vendorDetails.phone || '—'}</span>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Email</span>
                      <span className="text-slate-800 truncate block">{vendorDetails.email || '—'}</span>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">State</span>
                      <span className="font-medium text-slate-800 block">{vendorDetails.state || '—'}</span>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">State Code</span>
                      <span className="font-mono text-slate-800 block">{vendorDetails.stateCode || '—'}</span>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Payment Terms</span>
                      <span className="font-medium text-slate-800 block">{vendorDetails.paymentTerms || '—'}</span>
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Billing Address</span>
                      <span className="text-slate-700 truncate block" title={vendorDetails.billingAddress}>
                        {vendorDetails.billingAddress || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Info size={14} className="text-slate-400" />
                  Select a Purchase Order above to automatically load vendor details.
                </div>
              )}

              {/* PO Summary Card */}
              {poSummary && (
                <div className="bg-blue-50/50 border border-blue-200/80 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-blue-100">
                    <span className="font-bold text-[#1F2E4A] text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Layers size={13} className="text-blue-700" /> PO Summary — {poSummary.poNumber}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">Original PO metrics (Reference)</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-xs">
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100">
                      <span className="text-[9.5px] text-slate-500 uppercase font-bold block">Fabric / Quality</span>
                      <span className="font-semibold text-slate-800 text-[11px] truncate block">{poSummary.fabricQuality || '—'}</span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100">
                      <span className="text-[9.5px] text-slate-500 uppercase font-bold block">Ordered Qty</span>
                      <span className="font-mono font-bold text-slate-800 text-[11px] block">{numIN(poSummary.orderedQty)} M</span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100">
                      <span className="text-[9.5px] text-slate-500 uppercase font-bold block">Received Qty</span>
                      <span className="font-mono font-bold text-slate-800 text-[11px] block">{numIN(poSummary.receivedQty)} M</span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100">
                      <span className="text-[9.5px] text-slate-500 uppercase font-bold block">Previously Billed</span>
                      <span className="font-mono font-semibold text-slate-600 text-[11px] block">{numIN(poSummary.previouslyBilledQty)} M</span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-emerald-200 bg-emerald-50/30">
                      <span className="text-[9.5px] text-emerald-800 uppercase font-bold block">Remaining Billable</span>
                      <span className="font-mono font-extrabold text-emerald-700 text-[11px] block">{numIN(poSummary.remainingBillableQty)} M</span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100">
                      <span className="text-[9.5px] text-slate-500 uppercase font-bold block">Original PO Rate</span>
                      <span className="font-mono font-semibold text-slate-800 text-[11px] block">₹{numIN(poSummary.originalPoRate)}/M</span>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2 border border-blue-100 sm:col-span-2">
                      <span className="text-[9.5px] text-slate-500 uppercase font-bold block">Original PO Amount</span>
                      <span className="font-mono font-bold text-slate-900 text-xs block">{formatCurrency(poSummary.originalPoAmount)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Batch-Wise Billing Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      Batch-Wise Billing ({batchLines.length} {batchLines.length === 1 ? 'Batch' : 'Batches'})
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Enter distinct bill quantities & rates per batch
                    </span>
                  </div>
                  {totalBillQty > 0 && (
                    <span className="text-[11px] font-mono font-bold text-primary">
                      Total Bill Qty: {numIN(totalBillQty)} M
                    </span>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Batch</th>
                        <th className="py-2.5 px-3 text-left">GRN</th>
                        <th className="py-2.5 px-3 text-right">Received Qty</th>
                        <th className="py-2.5 px-3 text-right">Previously Billed</th>
                        <th className="py-2.5 px-3 text-right">Remaining Billable</th>
                        <th className="py-2.5 px-3 text-right w-32">Bill Qty (M) *</th>
                        <th className="py-2.5 px-3 text-right w-28">Bill Rate (₹) *</th>
                        <th className="py-2.5 px-3 text-right w-32">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batchLines.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            {fPoId
                              ? (poLoading ? 'Loading batches...' : 'No goods receipts or batches found for this Purchase Order.')
                              : 'Select a Purchase Order above to view and bill its batches.'}
                          </td>
                        </tr>
                      ) : (
                        batchLines.map((b) => (
                          <tr key={b.batchCode} className={`hover:bg-slate-50/70 transition-colors ${b.isFullyBilled ? 'bg-slate-50/50 opacity-60' : ''}`}>
                            <td className="p-3 font-mono font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <span>{b.batchCode}</span>
                                {b.isFullyBilled && (
                                  <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                    Fully Billed
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block font-normal font-sans truncate">
                                {b.itemName}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-slate-600">
                              <span>{b.grnNumber || '—'}</span>
                              {b.receiptDate && (
                                <span className="text-[10px] text-slate-400 block font-sans">
                                  {formatDateDDMMYYYY(b.receiptDate)}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-700">
                              {numIN(b.receivedQty)} {b.uom}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-500">
                              {numIN(b.previouslyBilledQty)} {b.uom}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-700">
                              {numIN(b.remainingBillableQty)} {b.uom}
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                min="0"
                                max={b.remainingBillableQty}
                                step="0.01"
                                disabled={b.isFullyBilled}
                                value={b.billQty}
                                onChange={(e) => handleBatchFieldChange(b.batchCode, 'billQty', e.target.value)}
                                className="w-full border border-slate-300 rounded-lg p-1.5 text-right font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                disabled={b.isFullyBilled}
                                value={b.billRate}
                                onChange={(e) => handleBatchFieldChange(b.batchCode, 'billRate', e.target.value)}
                                className="w-full border border-slate-300 rounded-lg p-1.5 text-right font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(b.amount || 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Row: Remarks & Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Remarks / Notes</label>
                  <textarea
                    value={fRemarks}
                    onChange={(ev) => setFRemarks(ev.target.value)}
                    rows={3}
                    placeholder="Optional notes or supplier invoice remarks..."
                    className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 font-mono text-xs shadow-sm">
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans font-medium">Sub Total (Batch-Wise)</span>
                    <span className="font-bold text-slate-900">{formatCurrency(formSubtotal)}</span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-sans font-medium flex items-center gap-1.5">
                      GST Percentage
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={fGstPct}
                        onChange={(ev) => setFGstPct(ev.target.value)}
                        className="w-16 border border-slate-300 rounded-md px-1.5 py-0.5 text-right font-mono text-slate-800 bg-white"
                      />
                      %
                    </span>
                    <span className="font-bold text-slate-900">{formatCurrency(formGstAmount)}</span>
                  </div>

                  <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                    <span className="font-sans font-extrabold text-[#1F2E4A]">Total Bill Amount</span>
                    <span className="font-bold text-[#1F2E4A] text-base">{formatCurrency(formTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || batchLines.length === 0}
                  className="px-5 py-2 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-xl font-bold shadow-md cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? 'Saving...' : editingId ? 'Update Vendor Bill' : 'Save Vendor Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelectedId(null)}>
          <div onClick={(ev) => ev.stopPropagation()} className="absolute inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-bold text-base text-[#1F2E4A] font-mono truncate">{selected.vendorBillNumber || selected.billNumber}</h3>
                <StatusBadge status={selected.matchStatus || 'Pending Matching'} />
              </div>
              <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Vendor</p>
                  <p className="font-bold text-slate-800 text-sm">{selected.vendor || selected.vendorName}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Bill Date</p>
                  <p className="font-mono text-slate-800">{formatDateDDMMYYYY(selected.billDate || selected.date)}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">PO No</p>
                  <p className="font-mono text-slate-800 font-bold">{poNumberOf(selected)}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">GRN No</p>
                  <p className="font-mono text-slate-800">{grnNumberOf(selected)}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Status</p>
                  <p><StatusBadge status={selected.status} /></p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Total</p>
                  <p className="font-mono font-bold text-slate-900 text-sm">{formatCurrency(Number(selected.total ?? selected.amount) || 0)}</p>
                </div>
              </div>

              {selected.fileName && (
                <p className="text-slate-500">Attachment: <span className="font-mono font-semibold text-slate-700">{selected.fileName}</span></p>
              )}
              {selected.remarks && (
                <p className="text-slate-500">Remarks: <span className="text-slate-700">{selected.remarks}</span></p>
              )}

              <div>
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-xs mb-2">
                  Bill Items / Batches ({(selected.lineItems || selected.items || []).length})
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-2 w-8">#</th>
                        <th className="py-2 px-2 text-left">Batch / Item</th>
                        <th className="py-2 px-2 text-right">Qty</th>
                        <th className="py-2 px-2 text-right">Rate</th>
                        <th className="py-2 px-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selected.lineItems || selected.items || []).map((l, idx) => (
                        <tr key={l.id || idx}>
                          <td className="p-2 font-mono text-slate-400 text-center">{idx + 1}</td>
                          <td className="p-2">
                            {l.batchNumber ? (
                              <p className="font-mono font-bold text-slate-800 text-[11px]">{l.batchNumber}</p>
                            ) : null}
                            <p className="font-semibold text-slate-700">{l.itemName || l.name}</p>
                            <span className="text-[10px] text-slate-400 font-mono">{l.sku || l.itemSku}</span>
                          </td>
                          <td className="p-2 text-right font-mono font-semibold">{numIN(l.qty ?? l.quantity)}</td>
                          <td className="p-2 text-right font-mono">{formatCurrency(Number(l.rate) || 0)}</td>
                          <td className="p-2 text-right font-mono font-bold">{formatCurrency(Number(l.amount) || (Number(l.qty || 0) * Number(l.rate || 0)))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {(linkedPurchaseBill || selected.purchaseBillId) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs">
                  <span className="font-semibold text-emerald-800">Linked Purchase Bill: </span>
                  <span className="font-mono font-bold text-emerald-900">
                    {linkedPurchaseBill?.billNumber || selected.purchaseBillNumber || selected.purchaseBillId}
                  </span>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                {selected.status !== 'Rejected' && selected.matchStatus !== 'Matched' && !selected.purchaseBillId && (
                  <Button
                    icon={Send}
                    onClick={() => handleSendForMatching(selected)}
                    className="w-full justify-center font-bold"
                  >
                    Send for Matching
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorBillsPage;
