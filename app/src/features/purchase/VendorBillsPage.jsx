import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useERP } from '../../context/ERPContext';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/common/PageHeader';
import TablePagination from '../../components/ui/TablePagination';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import { Plus, X, Eye, Pencil, Trash2, Send, Upload } from 'lucide-react';
import { toISODate, getCurrentISODate } from '../../utils/dateUtils';

const vendorBillGuide = {
  title: 'Vendor Bills (Manual Entry)',
  subtitle: 'Type in supplier invoices by hand, then send them for 3-way matching.',
  purpose: 'A Vendor Bill is the supplier invoice typed in manually before any goods are matched. Saving a bill keeps it in a Pending state; Send for Matching links it to a Purchase Order / GRN and creates the official Purchase Bill.',
  keyTerms: [
    { term: 'Vendor Bill', definition: 'A manually entered supplier invoice awaiting verification.' },
    { term: 'Send for Matching', definition: 'Verifies the bill against the PO and GRN, then raises a Purchase Bill.' },
    { term: 'Match Status', definition: 'Pending Matching until verified, Matched once a Purchase Bill is linked.' },
  ],
  tips: [
    'Enter the bill exactly as printed on the supplier invoice, then match it later.',
    'Link a PO and GRN where possible — unmatched bills stay Pending Matching.',
  ],
  workflow: ['Bill Received', 'Manual Entry', 'Send for Matching', 'Purchase Bill Created'],
};

const BLANK_LINE = () => ({ key: `line-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, itemId: '', qty: '', rate: '' });

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export const VendorBillsPage = () => {
  const navigate = useNavigate();
  const {
    vendorBills = [],
    vendors = [],
    purchaseOrders = [],
    purchaseBills = [],
    items = [],
    fabrics = [],
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

  const [fVendorId, setFVendorId] = useState('');
  const [fBillNo, setFBillNo] = useState('');
  const [fBillDate, setFBillDate] = useState(getCurrentISODate());
  const [fFileName, setFFileName] = useState('');
  const [fPoId, setFPoId] = useState('');
  const [fGrnId, setFGrnId] = useState('');
  const [fLines, setFLines] = useState([BLANK_LINE()]);
  const [fGstPct, setFGstPct] = useState(5);
  const [fRemarks, setFRemarks] = useState('');

  // Fabric options: Fabric-kind items first, plus Fabric masters; fall back to all items.
  const fabricItems = useMemo(() => {
    const fabricKind = (items || []).filter((i) => String(i.itemKind || '').toLowerCase() === 'fabric');
    return fabricKind.length > 0 ? fabricKind : (items || []);
  }, [items]);

  const receivedBills = useMemo(
    () => (purchaseBills || []).filter((b) => b.goodsReceived === true && b.status !== 'Cancelled'),
    [purchaseBills],
  );

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

  const lineAmount = (l) => money(Number(l.qty) * Number(l.rate));

  const formSubtotal = useMemo(() => money(fLines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.rate || 0), 0)), [fLines]);
  const formGstAmount = useMemo(() => money(formSubtotal * (Number(fGstPct) / 100)), [formSubtotal, fGstPct]);
  const formTotal = useMemo(() => money(formSubtotal + formGstAmount), [formSubtotal, formGstAmount]);

  const resetForm = () => {
    setFVendorId('');
    setFBillNo('');
    setFBillDate(getCurrentISODate());
    setFFileName('');
    setFPoId('');
    setFGrnId('');
    setFLines([BLANK_LINE()]);
    setFGstPct(5);
    setFRemarks('');
    setEditingId(null);
    setFormError('');
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (bill) => {
    if (!bill) return;
    setEditingId(bill.id);
    setFVendorId(bill.vendorId || '');
    setFBillNo(bill.vendorBillNumber || bill.billNumber || '');
    setFBillDate(toISODate(bill.billDate || bill.date) || getCurrentISODate());
    setFFileName(bill.fileName || '');
    setFPoId(bill.purchaseOrderId || '');
    setFGrnId(bill.grnId || '');
    setFLines((bill.lineItems || bill.items || []).map((l) => ({
      key: l.id || `line-${Math.random().toString(16).slice(2)}`,
      itemId: l.itemId || '',
      qty: l.qty ?? l.quantity ?? '',
      rate: l.rate ?? l.price ?? '',
    })));
    setFGstPct(bill.gstPct ?? 5);
    setFRemarks(bill.remarks || bill.notes || '');
    setFormError('');
    setShowModal(true);
  };

  const updateLine = (key, patch) => {
    setFLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key) => {
    setFLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!fVendorId) {
      setFormError('Select a vendor.');
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
    const validLines = fLines.filter((l) => l.itemId && Number(l.qty) > 0);
    if (validLines.length === 0) {
      setFormError('Add at least one item with billed quantity greater than 0.');
      return;
    }
    const vendor = vendors.find((v) => v.id === fVendorId);
    const payload = {
      vendorId: fVendorId,
      vendor: vendor?.name || '',
      vendorName: vendor?.name || '',
      vendorBillNumber: fBillNo.trim(),
      billDate: fBillDate,
      purchaseOrderId: fPoId || null,
      grnId: fGrnId || null,
      attachmentFileId: selected?.attachmentFileId || undefined,
      fileName: fFileName,
      gstPct: Number(fGstPct) || 0,
      remarks: fRemarks,
      lineItems: validLines.map((l) => {
        const item = items.find((i) => i.id === l.itemId);
        return {
          itemId: l.itemId,
          sku: item?.sku || '',
          itemName: item?.name || '',
          qty: Number(l.qty),
          rate: Number(l.rate) || 0,
        };
      }),
    };
    let saved;
    if (editingId) {
      saved = updateVendorBill(editingId, payload);
    } else {
      try {
        saved = await addVendorBill(payload);
      } catch (err) {
        setFormError(err?.message || 'Vendor bill not saved.');
        return;
      }
    }
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
    // Always land on Bill Matching with this bill pre-selected: on success
    // the matched result + new purchase bill show there; on mismatch the
    // stashed mismatch table + approval action show there.
    navigate(`/purchase/bill-matching?bill=${bill.id}`);
  };

  const linkedPurchaseBill = selected?.purchaseBillId
    ? purchaseBills.find((p) => p.id === selected.purchaseBillId)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Bills (Manual Entry)"
        subtitle="Type supplier invoices by hand, then send them for 3-way matching."
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full p-4 sm:p-6 text-xs max-h-[95vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">
                {editingId ? 'Edit Vendor Bill' : 'Create Vendor Bill (Manual Entry)'}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-xs font-semibold">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Vendor *</label>
                    <MasterSourceLink source="vendors" />
                  </div>
                  <select value={fVendorId} onChange={(ev) => setFVendorId(ev.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    <option value="">-- Select vendor --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bill / Invoice No *</label>
                  <input type="text" value={fBillNo} onChange={(ev) => setFBillNo(ev.target.value)} placeholder="e.g. INV-SUP-1024" className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bill Date *</label>
                  <input type="date" value={fBillDate} onChange={(ev) => setFBillDate(ev.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Upload Bill</label>
                  <label className="flex items-center gap-2 border border-dashed border-slate-300 rounded-lg p-2 bg-slate-50 text-slate-600 cursor-pointer hover:bg-slate-100">
                    <Upload size={14} />
                    <span className="truncate">{fFileName || 'Choose file...'}</span>
                    <input type="file" className="hidden" onChange={(ev) => setFFileName(ev.target.files?.[0]?.name || '')} />
                  </label>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select PO (optional)</label>
                  <select value={fPoId} onChange={(ev) => setFPoId(ev.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    <option value="">-- None --</option>
                    {purchaseOrders.filter((p) => p.status !== 'Cancelled').map((p) => (
                      <option key={p.id} value={p.id}>{p.poNumber} ({p.vendor})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select GRN (optional)</label>
                  <select value={fGrnId} onChange={(ev) => setFGrnId(ev.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium">
                    <option value="">-- None --</option>
                    {receivedBills.map((g) => (
                      <option key={g.id} value={g.id}>{g.billNumber} ({g.vendor})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-2">Bill Items</label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-2 w-8">#</th>
                        <th className="py-2 px-2 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <span>Fabric</span>
                            <MasterSourceLink source="items" className="normal-case tracking-normal" />
                          </div>
                        </th>
                        <th className="py-2 px-2 w-24">Billed Qty (M)</th>
                        <th className="py-2 px-2 w-24">Rate</th>
                        <th className="py-2 px-2 w-28 text-right">Amount</th>
                        <th className="py-2 px-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fLines.map((l, idx) => (
                        <tr key={l.key}>
                          <td className="p-1.5 font-mono text-slate-400 text-center">{idx + 1}</td>
                          <td className="p-1.5">
                            <select value={l.itemId} onChange={(ev) => updateLine(l.key, { itemId: ev.target.value })} className="w-full border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800">
                              <option value="">-- Select fabric --</option>
                              {fabricItems.map((it) => (
                                <option key={it.id} value={it.id}>{it.name} ({it.sku})</option>
                              ))}
                              {(fabrics || []).map((f) => (
                                <option key={`fabric-${f.id}`} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5">
                            <input type="number" min="0" step="0.01" value={l.qty} onChange={(ev) => updateLine(l.key, { qty: ev.target.value })} className="w-full border border-slate-300 rounded-lg p-1.5 text-right font-mono text-slate-800" />
                          </td>
                          <td className="p-1.5">
                            <input type="number" min="0" step="0.01" value={l.rate} onChange={(ev) => updateLine(l.key, { rate: ev.target.value })} className="w-full border border-slate-300 rounded-lg p-1.5 text-right font-mono text-slate-800" />
                          </td>
                          <td className="p-1.5 text-right font-mono font-bold text-slate-900">{formatCurrency(lineAmount(l))}</td>
                          <td className="p-1.5 text-center">
                            <button type="button" onClick={() => removeLine(l.key)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" title="Remove line">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={() => setFLines((prev) => [...prev, BLANK_LINE()])} className="mt-2 px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold cursor-pointer">
                  + Add Another Item
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                  <textarea value={fRemarks} onChange={(ev) => setFRemarks(ev.target.value)} rows={2} placeholder="Optional notes..." className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Sub Total</span>
                    <span className="font-bold text-slate-900">{formatCurrency(formSubtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="flex items-center gap-1.5">
                      GST
                      <input type="number" min="0" max="100" step="0.01" value={fGstPct} onChange={(ev) => setFGstPct(ev.target.value)} className="w-16 border border-slate-300 rounded-md px-1.5 py-0.5 text-right font-mono text-slate-800" />
                      %
                    </span>
                    <span className="font-bold text-slate-900">{formatCurrency(formGstAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm">
                    <span className="font-bold text-slate-700">Total Amount</span>
                    <span className="font-bold text-slate-900">{formatCurrency(formTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-bold shadow-sm cursor-pointer">
                  Save Vendor Bill
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
                  <p className="font-mono text-slate-800">{poNumberOf(selected)}</p>
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
                  Bill Items ({(selected.lineItems || selected.items || []).length})
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2 px-2 w-8">#</th>
                        <th className="py-2 px-2 text-left">Item</th>
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
                            <p className="font-semibold text-slate-700">{l.itemName || l.name}</p>
                            <span className="text-[10px] text-slate-400 font-mono">{l.sku || l.itemSku}</span>
                          </td>
                          <td className="p-2 text-right font-mono">{l.qty ?? l.quantity}</td>
                          <td className="p-2 text-right font-mono">{formatCurrency(Number(l.rate) || 0)}</td>
                          <td className="p-2 text-right font-mono font-bold">{formatCurrency(Number(l.amount) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {(linkedPurchaseBill || selected.purchaseBillId) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs">
                  <span className="font-semibold text-emerald-800">Linked Purchase Bill: </span>
                  <span className="font-mono font-bold text-emerald-900">{linkedPurchaseBill?.billNumber || selected.purchaseBillId}</span>
                </div>
              )}

              <Link to={selected ? `/purchase/bill-matching?bill=${selected.id}` : '/purchase/bill-matching'} className="block text-center text-xs font-semibold text-primary hover:underline">
                Open in Bill Matching →
              </Link>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button onClick={() => openEdit(selected)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-white font-semibold flex items-center gap-1.5 cursor-pointer">
                <Pencil size={13} /> Edit
              </button>
              <button onClick={() => handleSendForMatching(selected)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer">
                <Send size={13} /> Send for Matching
              </button>
              <button onClick={() => handleDelete(selected)} className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer">
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorBillsPage;
