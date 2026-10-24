import React, { useState, useMemo, useEffect } from 'react';
import { useERP } from '../../context/ERPContext';
import { api } from '../../services/api';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Plus, RotateCcw, AlertCircle, X, Ban, Eye, ShieldAlert, Loader2 } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';

/** Exactly the choices the server accepts on SalesReturnLine.condition. */
const CONDITIONS = ['Good', 'Hold', 'Reprocess', 'Second Quality', 'Reject'];
const CONDITION_HINT = {
    Good: 'Good (back to stock)',
    Hold: 'Hold (QC hold)',
    Reprocess: 'Reprocess',
    'Second Quality': 'Second Quality',
    Reject: 'Reject',
};
const conditionBadge = (condition) => {
    if (condition === 'Good') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (condition === 'Reject') return 'bg-rose-50 text-rose-700 border border-rose-200';
    return 'bg-amber-50 text-amber-800 border border-amber-200';
};

const salesReturnGuide = {
    title: 'Sales Returns & Credit Notes',
    subtitle: 'Line-wise customer returns against posted invoices, graded by condition, traced to the taka that came back.',
    purpose: 'Use this page to process partial or full returns against posted Sales Invoices. Issuing a Credit Note reduces the customer receivable, posts the credit note to the ledger, and routes the returned fabric by condition: Good goes back to stock, Hold goes to QC Hold, and Reprocess / Second Quality / Reject go to their own locations.',
    workflow: ['Select the posted Sales Invoice', 'Enter return quantities (capped at the returnable quantity)', 'Grade each line: Good / Hold / Reprocess / Second Quality / Reject', 'Pick the taka (lot / taka tracked items) or serials (serialized items)', 'Issue the Credit Note'],
    keyTerms: [
        {
            term: 'Returnable Quantity',
            definition: 'Invoiced quantity minus the quantity already returned on active credit notes, as recorded by the server.',
        },
        {
            term: 'Condition',
            definition: 'Decides where the returned stock goes. Unspecified returns default to Hold so QC inspects them before they become sellable.',
        },
        {
            term: 'Taka',
            definition: 'For lot / taka tracked fabric, the specific taka being returned, so traceability is kept.',
        },
        {
            term: 'Reversible Lifecycle',
            definition: 'Cancelling a Sales Return reverses the stock movement, the customer credit and the journal entry.',
        },
    ],
    tips: [
        'Over-returning is prevented by the server: you cannot return more than the remaining returnable quantity.',
        'When the invoice recorded which takas were dispatched, only those takas are offered.',
    ],
};

export const SalesReturnsPage = () => {
    const {
        salesReturns = [],
        addSalesReturn,
        cancelSalesReturn,
        invoices = [],
        items: masterItems = [],
        formatCurrency,
        formatDateDDMMYYYY,
        getCurrentDateFormatted,
    } = useERP();

    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
    const [reason, setReason] = useState('');
    const [returnLines, setReturnLines] = useState([]);
    const [validationError, setValidationError] = useState('');
    const [loadingInvoice, setLoadingInvoice] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [viewReturn, setViewReturn] = useState(null);
    const [viewTakaLabels, setViewTakaLabels] = useState({});
    const [cancelModalTarget, setCancelModalTarget] = useState(null);

    // Posted, non-cancelled invoices can be returned against.
    const activeInvoices = useMemo(() => {
        return invoices.filter((inv) => inv.status !== 'Cancelled' && inv.status !== 'Draft' && inv.finalized !== false);
    }, [invoices]);

    const invoiceNumberById = useMemo(() => {
        const map = {};
        invoices.forEach((inv) => { map[inv.id] = inv.invoiceNumber; });
        return map;
    }, [invoices]);

    const itemById = useMemo(() => {
        const map = {};
        masterItems.forEach((m) => { map[m.id] = m; });
        return map;
    }, [masterItems]);

    const invoiceRefOf = (r) => r.invoiceRef || invoiceNumberById[r.salesInvoiceId || r.invoiceId] || '—';
    const linesOf = (r) => r.items || r.lineItems || [];
    const lineQty = (l) => Number(l.returnedQty ?? l.qty ?? 0);

    /**
     * Loads the invoice from the server (fresh returnedQty / serials / taka
     * allocations) and, for every stocked line, the item's takas from the
     * Lot / Taka register so the user can name the taka coming back.
     */
    const loadInvoiceLines = async (invId) => {
        setReturnLines([]);
        if (!invId) return;
        setLoadingInvoice(true);
        try {
            const inv = await api.get(`/sales/invoices/${invId}/`);
            const rawLines = inv?.lineItems || [];
            const itemIds = [...new Set(rawLines.map((l) => l.itemId).filter(Boolean))];
            const takaResults = await Promise.all(itemIds.map((itemId) => (
                api.get('/inventory/lot-register/', { query: { itemId } })
                    .then((res) => [itemId, Array.isArray(res?.records) ? res.records : []])
            )));
            const takasByItem = Object.fromEntries(takaResults);

            const lines = rawLines.map((it, idx) => {
                const invoicedQty = Number(it.qty || 0);
                const prevReturned = Number(it.returnedQty || 0);
                const returnableQty = Math.max(0, invoicedQty - prevReturned);
                const mi = itemById[it.itemId];
                const trackingType = String(mi?.trackingType || '').toUpperCase();
                const allocatedIds = (it.takaAllocations || [])
                    .map((a) => String(a.lotTakaId || a.lot_taka_id || ''))
                    .filter(Boolean);
                const itemTakas = takasByItem[it.itemId] || [];
                // Prefer the takas that went out on this invoice line when the
                // invoice recorded them; otherwise offer the item's takas.
                const onInvoice = itemTakas.filter((t) => allocatedIds.includes(String(t.id)));
                const takaOptions = onInvoice.length ? onInvoice : itemTakas;
                const serials = Array.isArray(it.serials) ? it.serials : [];
                return {
                    id: it.id || `inv-line-${idx}`,
                    invoiceLineId: it.id,
                    itemId: it.itemId || '',
                    sku: it.sku || mi?.sku || '',
                    description: it.description || it.itemName || `Line ${idx + 1}`,
                    uom: it.uom || mi?.uom || '',
                    invoicedQty,
                    previouslyReturnedQty: prevReturned,
                    returnableQty,
                    returnQty: 0,
                    condition: 'Hold',
                    rate: Number(it.rate || 0),
                    discount: Number(it.discount || 0),
                    tax: Number(it.tax || 0),
                    requiresTaka: trackingType === 'LOT' || trackingType === 'TAKA' || allocatedIds.length > 0,
                    takaOptions,
                    takasFromInvoice: onInvoice.length > 0,
                    lotTakaId: onInvoice.length === 1 ? String(onInvoice[0].id) : '',
                    isSerial: serials.length > 0,
                    returnableSerials: serials,
                    selectedSerials: [],
                };
            });
            setReturnLines(lines);
        } catch (err) {
            setValidationError(err?.message || 'Could not load the invoice lines.');
        } finally {
            setLoadingInvoice(false);
        }
    };

    const handleInvoiceSelect = (invId) => {
        setSelectedInvoiceId(invId);
        setValidationError('');
        loadInvoiceLines(invId);
    };

    const handleOpenCreateModal = () => {
        setSelectedInvoiceId('');
        setReturnLines([]);
        setReason('');
        setValidationError('');
        setShowAddModal(true);
    };

    const updateLine = (index, patch) => {
        setReturnLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    };

    const handleLineQtyChange = (index, val) => {
        setValidationError('');
        const line = returnLines[index];
        let qty = Math.max(0, Number(val) || 0);
        if (qty > line.returnableQty) {
            setValidationError(`Cannot return more than ${line.returnableQty} ${line.uom} for ${line.description}.`);
            qty = line.returnableQty;
        }
        updateLine(index, {
            returnQty: qty,
            selectedSerials: line.isSerial ? line.returnableSerials.slice(0, Math.floor(qty)) : line.selectedSerials,
        });
    };

    const handleConditionChange = (index, condition) => updateLine(index, { condition });
    const handleTakaChange = (index, lotTakaId) => updateLine(index, { lotTakaId });

    const handleSerialToggle = (lineIndex, serial) => {
        const line = returnLines[lineIndex];
        const current = line.selectedSerials || [];
        let next;
        if (current.includes(serial)) {
            next = current.filter((s) => s !== serial);
        } else if (current.length >= line.returnQty) {
            next = [...current.slice(0, Math.max(0, line.returnQty - 1)), serial];
        } else {
            next = [...current, serial];
        }
        updateLine(lineIndex, { selectedSerials: next });
    };

    const totalReturnQty = returnLines.reduce((sum, l) => sum + Number(l.returnQty || 0), 0);
    // Preview only — the server computes the credit note amount.
    const lineTotalOf = (l) => {
        const gross = Number(l.returnQty || 0) * Number(l.rate || 0);
        const net = gross - gross * (Number(l.discount || 0) / 100);
        return net + net * (Number(l.tax || 0) / 100);
    };
    const totalCreditAmount = returnLines.reduce((sum, l) => sum + lineTotalOf(l), 0);

    const handleCreateReturnSubmit = async (e) => {
        e.preventDefault();
        setValidationError('');

        if (!selectedInvoiceId) {
            setValidationError('Select the invoice the goods are being returned against.');
            return;
        }
        if (totalReturnQty <= 0) {
            setValidationError('Enter a return quantity on at least one line.');
            return;
        }
        for (const line of returnLines) {
            if (line.returnQty <= 0) continue;
            if (line.returnQty > line.returnableQty) {
                setValidationError(`${line.description}: only ${line.returnableQty} ${line.uom} remains returnable.`);
                return;
            }
            if (!CONDITIONS.includes(line.condition)) {
                setValidationError(`${line.description}: choose a condition.`);
                return;
            }
            if (line.requiresTaka && !line.lotTakaId) {
                setValidationError(`${line.description}: select the taka being returned.`);
                return;
            }
            if (line.isSerial && line.selectedSerials.length !== line.returnQty) {
                setValidationError(`Select exactly ${line.returnQty} serial number(s) for ${line.description}.`);
                return;
            }
        }

        const itemsToReturn = returnLines.filter((l) => l.returnQty > 0).map((l) => ({
            invoiceLineId: l.invoiceLineId,
            itemId: l.itemId || undefined,
            description: l.description,
            qty: l.returnQty,
            rate: l.rate,
            tax: l.tax,
            discount: l.discount,
            condition: l.condition,
            lotTakaId: l.lotTakaId || null,
            selectedSerials: l.selectedSerials,
        }));

        setSubmitting(true);
        try {
            const saved = await addSalesReturn({
                invoiceId: selectedInvoiceId,
                date: getCurrentDateFormatted(),
                reason: reason.trim(),
                items: itemsToReturn,
            });
            if (saved) {
                setShowAddModal(false);
                setReturnLines([]);
            } else {
                setValidationError('The credit note was not saved — see the error message shown.');
            }
        } catch (err) {
            setValidationError(err?.message || 'The credit note was not saved.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmCancel = () => {
        if (!cancelModalTarget) return;
        cancelSalesReturn(cancelModalTarget.id);
        setCancelModalTarget(null);
    };

    // Resolve taka labels for the lines of the return being viewed.
    useEffect(() => {
        if (!viewReturn) return undefined;
        let active = true;
        const ids = [...new Set(linesOf(viewReturn).map((l) => l.lotTakaId).filter(Boolean))];
        Promise.all(ids.map((id) => api.get(`/inventory/lot-register/${id}/`)
            .then((t) => [id, [t?.lotNo, t?.takaRoll || t?.takaId].filter(Boolean).join(' / ') || id])
            .catch(() => [id, id])))
            .then((pairs) => { if (active) setViewTakaLabels(Object.fromEntries(pairs)); });
        return () => { active = false; };
    }, [viewReturn]);

    const columns = [
        {
            key: 'returnNumber',
            header: 'Credit Note #',
            width: '16%',
            render: (r) => (
              <button
                onClick={() => setViewReturn(r)}
                className="font-mono font-bold text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1.5 whitespace-nowrap cursor-pointer text-left"
              >
                <RotateCcw size={13} className="text-rose-600 shrink-0"/>
                <span>{r.returnNumber}</span>
              </button>
            ),
        },
        {
            key: 'customer',
            header: 'Customer Account',
            width: '20%',
            render: (r) => <span className="font-bold text-text block">{r.customer || r.partyName}</span>,
        },
        {
            key: 'invoiceRef',
            header: 'Target Invoice',
            width: '14%',
            render: (r) => <span className="font-mono text-primary font-semibold whitespace-nowrap">{invoiceRefOf(r)}</span>,
        },
        {
            key: 'date',
            header: 'Return Date',
            width: '11%',
            render: (r) => <span className="text-muted font-mono text-[11px] whitespace-nowrap">{formatDateDDMMYYYY(r.date)}</span>,
        },
        {
            key: 'itemsSummary',
            header: 'Qty & Condition',
            width: '18%',
            render: (r) => {
                const lines = linesOf(r);
                const qty = lines.reduce((acc, it) => acc + lineQty(it), 0);
                const conditions = [...new Set(lines.map((it) => it.condition).filter(Boolean))];
                return (
                    <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-text text-xs">{qty.toLocaleString('en-IN', { maximumFractionDigits: 4 })} returned</span>
                        <div className="flex flex-wrap items-center gap-1">
                            {conditions.map((c) => (
                                <span key={c} className={`text-[10px] px-1.5 rounded ${conditionBadge(c)}`}>{c}</span>
                            ))}
                        </div>
                    </div>
                );
            },
        },
        {
            key: 'amount',
            header: 'Credit Note Amount',
            align: 'right',
            width: '12%',
            render: (r) => (
              <span className={`font-mono font-bold whitespace-nowrap ${r.status === 'Cancelled' ? 'text-slate-400 line-through' : 'text-rose-600 dark:text-rose-400'}`}>
                -{formatCurrency(r.amount ?? r.total ?? 0)}
              </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            width: '10%',
            render: (r) => <StatusBadge status={r.status || '—'}/>,
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            width: '11%',
            render: (r) => (
                <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <button
                        onClick={() => setViewReturn(r)}
                        className="p-1 text-slate-500 hover:text-primary hover:bg-slate-100 rounded cursor-pointer transition-colors"
                        title="View Return Details"
                    >
                        <Eye size={13}/>
                    </button>
                    {r.status !== 'Cancelled' && (
                        <button
                            onClick={() => setCancelModalTarget(r)}
                            className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-[11px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1"
                            title="Cancel Return and Reverse Stock/Ledger"
                        >
                            <Ban size={11}/> Cancel
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Sales Returns & Credit Notes"
                subtitle="Line-wise customer returns graded by condition, traced to the taka returned, with ledger reversal."
                guide={salesReturnGuide}
                actions={
                    <Button icon={Plus} onClick={handleOpenCreateModal}>
                        Issue Sales Return / Credit Note
                    </Button>
                }
            />

            <DataTable
                title="Sales Return & Credit Note Register"
                columns={columns}
                data={salesReturns}
                keyExtractor={(r) => r.id}
                searchPlaceholder="Search return #, customer, invoice, or reason..."
                searchFilter={(r, term) =>
                    String(r.returnNumber ?? '').toLowerCase().includes(term) ||
                    String(r.customer ?? r.partyName ?? '').toLowerCase().includes(term) ||
                    String(invoiceRefOf(r)).toLowerCase().includes(term) ||
                    (r.reason && String(r.reason ?? '').toLowerCase().includes(term))
                }
            />

            {/* CREATE SALES RETURN MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-6xl w-full p-4 sm:p-6 text-xs max-h-[92vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between gap-3 lg:gap-0 pb-3 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                <RotateCcw className="w-5 h-5 text-rose-600"/>
                                <div>
                                    <h3 className="font-bold text-base text-[#1F2E4A]">Issue Sales Credit Note</h3>
                                    <p className="text-[11px] text-slate-500">Select returned lines, grade their condition and name the taka / serials coming back</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                                <X size={18}/>
                            </button>
                        </div>

                        <form onSubmit={handleCreateReturnSubmit} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
                            {validationError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2 text-xs">
                                    <AlertCircle size={16} className="shrink-0 text-rose-600"/>
                                    <span>{validationError}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Target Sales Invoice *</label>
                                    <select
                                        value={selectedInvoiceId}
                                        onChange={(e) => handleInvoiceSelect(e.target.value)}
                                        className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
                                        required
                                    >
                                        <option value="">{activeInvoices.length ? 'Select a posted invoice…' : 'No posted invoices'}</option>
                                        {activeInvoices.map((inv) => (
                                            <option key={inv.id} value={inv.id}>
                                                {inv.invoiceNumber} - {inv.customer} ({formatCurrency(inv.total)})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Reason for Return *</label>
                                    <input
                                        type="text"
                                        required
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="e.g. shade variation, damaged in transit..."
                                        className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                                    />
                                </div>
                            </div>

                            {/* RETURN LINES */}
                            <div className="space-y-2">
                                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
                                    <label className="font-semibold text-slate-700 block">Select Lines & Quantities to Return</label>
                                    <span className="text-[11px] text-slate-500">Returnable quantity is as recorded on the server</span>
                                </div>

                                {loadingInvoice ? (
                                    <div className="flex items-center justify-center gap-2 p-6 rounded-lg border border-slate-200 text-slate-500">
                                        <Loader2 size={16} className="animate-spin"/> Loading invoice lines…
                                    </div>
                                ) : !selectedInvoiceId ? (
                                    <div className="p-6 rounded-lg border border-dashed border-slate-300 text-center text-slate-400">
                                        Select an invoice to list its lines.
                                    </div>
                                ) : returnLines.length === 0 ? (
                                    <div className="p-6 rounded-lg border border-dashed border-slate-300 text-center text-slate-400">
                                        This invoice has no lines to return.
                                    </div>
                                ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table className="w-full min-w-[980px] text-left text-xs">
                                        <thead className="bg-slate-50 uppercase text-slate-500 font-semibold border-b border-slate-200">
                                            <tr>
                                                <th className="py-2.5 px-3">Product Description</th>
                                                <th className="py-2.5 px-2 text-center w-20">Invoiced</th>
                                                <th className="py-2.5 px-2 text-center w-20">Prev. Ret.</th>
                                                <th className="py-2.5 px-2 text-center w-24">Returnable</th>
                                                <th className="py-2.5 px-3 text-center w-28">Return Qty</th>
                                                <th className="py-2.5 px-3 w-36">Condition</th>
                                                <th className="py-2.5 px-3 w-48">Taka</th>
                                                <th className="py-2.5 px-3 text-right w-24">Rate</th>
                                                <th className="py-2.5 px-3 text-right w-28">Credit Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {returnLines.map((line, idx) => {
                                                const isExhausted = line.returnableQty <= 0;
                                                const showTaka = line.requiresTaka || line.takaOptions.length > 0;
                                                return (
                                                    <React.Fragment key={line.id || idx}>
                                                        <tr className={`hover:bg-slate-50/70 ${isExhausted ? 'opacity-60 bg-slate-50/40' : ''}`}>
                                                            <td className="py-2 px-3">
                                                                <span className="font-semibold text-slate-800 block">{line.description}</span>
                                                                {line.sku && <span className="font-mono text-[10px] text-slate-400">SKU: {line.sku}</span>}
                                                            </td>
                                                            <td className="py-2 px-2 text-center font-mono">{line.invoicedQty} {line.uom}</td>
                                                            <td className="py-2 px-2 text-center font-mono text-slate-500">{line.previouslyReturnedQty}</td>
                                                            <td className="py-2 px-2 text-center font-mono font-bold">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] ${line.returnableQty > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                    {line.returnableQty}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-3 text-center">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="any"
                                                                    max={line.returnableQty}
                                                                    disabled={isExhausted}
                                                                    value={line.returnQty}
                                                                    onChange={(e) => handleLineQtyChange(idx, e.target.value)}
                                                                    className="w-24 p-1 border border-slate-300 rounded text-center font-bold font-mono focus:border-rose-500"
                                                                />
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                <select
                                                                    disabled={!line.returnQty}
                                                                    value={line.condition}
                                                                    onChange={(e) => handleConditionChange(idx, e.target.value)}
                                                                    className="w-full p-1 border border-slate-300 rounded bg-white text-slate-800 text-[11px] font-medium"
                                                                >
                                                                    {CONDITIONS.map((c) => (
                                                                        <option key={c} value={c}>{CONDITION_HINT[c]}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td className="py-2 px-3">
                                                                {showTaka ? (
                                                                    line.takaOptions.length === 0 ? (
                                                                        <span className="text-[10.5px] text-rose-600">No takas found for this item</span>
                                                                    ) : (
                                                                        <>
                                                                            <select
                                                                                disabled={!line.returnQty}
                                                                                value={line.lotTakaId}
                                                                                onChange={(e) => handleTakaChange(idx, e.target.value)}
                                                                                className="w-full p-1 border border-slate-300 rounded bg-white text-slate-800 text-[11px] font-medium"
                                                                            >
                                                                                <option value="">{line.requiresTaka ? 'Select taka *' : 'Select taka (optional)'}</option>
                                                                                {line.takaOptions.map((t) => (
                                                                                    <option key={t.id} value={String(t.id)}>
                                                                                        {[t.lotNo, t.takaRoll || t.takaId].filter(Boolean).join(' / ')}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                            <span className="block mt-0.5 text-[10px] text-slate-400">
                                                                                {line.takasFromInvoice ? 'Takas dispatched on this invoice' : 'All takas of this item'}
                                                                            </span>
                                                                        </>
                                                                    )
                                                                ) : (
                                                                    <span className="text-[10.5px] text-slate-400">Not tracked</span>
                                                                )}
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrency(line.rate)}</td>
                                                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                                                                {formatCurrency(lineTotalOf(line))}
                                                            </td>
                                                        </tr>

                                                        {line.isSerial && line.returnQty > 0 && (
                                                            <tr className="bg-rose-50/40 border-b border-rose-100">
                                                                <td colSpan={9} className="py-2 px-4">
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center justify-between text-[11px]">
                                                                            <span className="font-semibold text-rose-900">
                                                                                Select Serial Numbers to Return ({line.selectedSerials.length} of {line.returnQty} selected):
                                                                            </span>
                                                                            <span className="text-slate-500">Only serials sold on this invoice line are shown</span>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {line.returnableSerials.map((sn) => {
                                                                                const isSelected = line.selectedSerials.includes(sn);
                                                                                return (
                                                                                    <button
                                                                                        key={sn}
                                                                                        type="button"
                                                                                        onClick={() => handleSerialToggle(idx, sn)}
                                                                                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border cursor-pointer transition-colors ${
                                                                                            isSelected
                                                                                                ? 'bg-rose-600 text-white border-rose-600'
                                                                                                : 'bg-white text-slate-700 border-slate-300 hover:border-rose-400'
                                                                                        }`}
                                                                                    >
                                                                                        {sn}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                )}
                            </div>

                            {/* SUMMARY TOTALS */}
                            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="font-semibold text-slate-700">Total Returning Qty: <strong>{totalReturnQty.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</strong></span>
                                <div className="text-right">
                                    <span className="text-slate-500 text-[11px] block">Estimated Credit Note Amount (final amount computed by the server)</span>
                                    <span className="font-mono font-bold text-base text-rose-600">
                                        -{formatCurrency(totalCreditAmount)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={totalReturnQty === 0 || submitting || loadingInvoice}
                                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                                >
                                    {submitting && <Loader2 size={13} className="animate-spin"/>}
                                    Issue Credit Note & Post Reversal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* VIEW RETURN DETAILS MODAL */}
            {viewReturn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-4 sm:p-6 text-xs max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                <RotateCcw className="w-5 h-5 text-rose-600"/>
                                <div>
                                    <h3 className="font-bold text-base text-[#1F2E4A]">Credit Note {viewReturn.returnNumber}</h3>
                                    <p className="text-[11px] text-slate-500">Issued against {invoiceRefOf(viewReturn)}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewReturn(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                                <X size={18}/>
                            </button>
                        </div>

                        <div className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <div>
                                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Customer</span>
                                    <p className="font-bold text-slate-900">{viewReturn.customer || viewReturn.partyName}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Date</span>
                                    <p className="font-semibold text-slate-800">{formatDateDDMMYYYY(viewReturn.date)}</p>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Status</span>
                                    <p><StatusBadge status={viewReturn.status || '—'}/></p>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-[10px] uppercase font-semibold">Total Credit Value</span>
                                    <p className="font-mono font-bold text-rose-600">-{formatCurrency(viewReturn.amount ?? viewReturn.total ?? 0)}</p>
                                </div>
                            </div>

                            <div>
                                <span className="text-slate-400 text-[10px] uppercase font-semibold block mb-1">Reason for Return</span>
                                <p className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-700">{viewReturn.reason || '—'}</p>
                            </div>

                            <div className="space-y-1">
                                <span className="font-semibold text-slate-700 block">Returned Line Items</span>
                                {linesOf(viewReturn).length === 0 ? (
                                    <p className="p-3 text-center text-slate-400 border border-dashed border-slate-300 rounded-lg">No lines on this return.</p>
                                ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table className="w-full min-w-[560px] text-left text-xs">
                                        <thead className="bg-slate-50 uppercase text-slate-500 font-semibold border-b border-slate-200">
                                            <tr>
                                                <th className="py-2 px-3">Item</th>
                                                <th className="py-2 px-2 text-center">Qty</th>
                                                <th className="py-2 px-2 text-center">Condition</th>
                                                <th className="py-2 px-2">Taka</th>
                                                <th className="py-2 px-3 text-right">Credit Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {linesOf(viewReturn).map((it, idx) => {
                                                const serials = it.serials || it.selectedSerials || [];
                                                return (
                                                    <tr key={it.id || idx}>
                                                        <td className="py-2 px-3">
                                                            <span className="font-semibold text-slate-800 block">{it.description || it.itemName || it.name}</span>
                                                            {serials.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {serials.map((s) => (
                                                                        <span key={s} className="px-1.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px] text-slate-700">
                                                                            {s}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-2 text-center font-mono font-bold">{lineQty(it)} {it.uom || ''}</td>
                                                        <td className="py-2 px-2 text-center">
                                                            {it.condition ? (
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${conditionBadge(it.condition)}`}>
                                                                    {it.condition}
                                                                </span>
                                                            ) : <span className="text-slate-400">—</span>}
                                                        </td>
                                                        <td className="py-2 px-2 font-mono text-[11px] text-slate-600">
                                                            {it.lotTakaId ? (viewTakaLabels[it.lotTakaId] || '…') : '—'}
                                                        </td>
                                                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                                                            {formatCurrency(it.lineTotal ?? it.amount ?? 0)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-200">
                            <Button variant="outline" onClick={() => setViewReturn(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* CANCEL CONFIRMATION MODAL */}
            {cancelModalTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-6 text-xs flex flex-col max-h-[95vh] overflow-y-auto">
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                            <ShieldAlert className="w-5 h-5 text-rose-600"/>
                            <h3 className="font-bold text-base text-[#1F2E4A]">Cancel Sales Return {cancelModalTarget.returnNumber}?</h3>
                        </div>

                        <div className="py-4 space-y-2 text-slate-600">
                            <p className="font-semibold text-slate-800">This action will:</p>
                            <ul className="list-disc list-inside space-y-1 text-slate-600">
                                <li>Reverse the stock movements posted for the returned lines</li>
                                <li>Restore the customer receivable (+{formatCurrency(cancelModalTarget.amount ?? cancelModalTarget.total ?? 0)})</li>
                                <li>Post the reversal to the General Ledger</li>
                                <li>Mark the Credit Note as <span className="text-rose-600 font-bold">Cancelled</span></li>
                            </ul>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                            <Button variant="outline" onClick={() => setCancelModalTarget(null)}>
                                Keep Return
                            </Button>
                            <button
                                type="button"
                                onClick={handleConfirmCancel}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-sm cursor-pointer"
                            >
                                Cancel Return & Reverse
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
