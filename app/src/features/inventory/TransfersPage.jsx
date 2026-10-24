import React, { useEffect, useMemo, useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Plus, ArrowLeftRight, CheckCircle2, User, X, Truck, MapPin, Trash2, Ban } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import { api } from '../../services/api';

const transfersGuide = {
    title: 'Inter-Warehouse Stock Transfers',
    subtitle: 'Move stock between godowns, taka by taka.',
    purpose: 'A transfer moves the selected takas (whole or part) from the source to the destination. Dispatch posts the TRANSFER OUT / IN movements; cancelling reverses exactly those movements.',
    keyTerms: [
        { term: 'Partial taka', definition: 'Moving part of a taka splits it: the moved part becomes a new taka at the destination.' },
        { term: 'In-Transit Status', definition: 'Stock has been dispatched from the source location.' },
    ],
    tips: ['Select the takas being moved; the line quantity is their total.'],
    workflow: ['Select takas', 'Dispatch (In Transit)', 'Confirm Intake'],
};

const emptyLine = () => ({ key: `${Date.now()}-${Math.round(performance.now())}`, itemId: '', qty: '', takas: {} });

export const TransfersPage = () => {
    const { transfers, locations, items, addTransfer, updateTransferStatus } = useERP();
    const [showAddModal, setShowAddModal] = useState(false);
    const [sourceLocId, setSourceLocId] = useState('');
    const [destLocId, setDestLocId] = useState('');
    const [shippedBy, setShippedBy] = useState('');
    const [lines, setLines] = useState(() => [emptyLine()]);
    const [sourceTakas, setSourceTakas] = useState([]);
    const [loadingTakas, setLoadingTakas] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    // Takas with stock at the chosen source location.
    useEffect(() => {
        if (!showAddModal || !sourceLocId) {
            setSourceTakas([]);
            return undefined;
        }
        let active = true;
        setLoadingTakas(true);
        api.get('/inventory/lot-register/', { query: { location_id: sourceLocId, available_only: 'true' } })
            .then((res) => { if (active) setSourceTakas(Array.isArray(res?.records) ? res.records : []); })
            .catch(() => { if (active) setSourceTakas([]); })
            .finally(() => { if (active) setLoadingTakas(false); });
        return () => { active = false; };
    }, [showAddModal, sourceLocId]);

    const takasByItem = useMemo(() => {
        const map = {};
        sourceTakas.forEach((t) => {
            if (!map[t.itemId]) map[t.itemId] = [];
            map[t.itemId].push(t);
        });
        return map;
    }, [sourceTakas]);

    const updateLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

    const toggleTaka = (line, taka) => {
        const next = { ...line.takas };
        if (next[taka.id] !== undefined) delete next[taka.id];
        else next[taka.id] = String(taka.availableQty);
        updateLine(line.key, { takas: next });
    };

    const lineQty = (line) => {
        const picked = Object.values(line.takas);
        if (picked.length) return picked.reduce((s, q) => s + (Number(q) || 0), 0);
        return Number(line.qty) || 0;
    };

    const resetForm = () => {
        setLines([emptyLine()]);
        setShippedBy('');
        setFormError(null);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setFormError(null);
        if (!sourceLocId || !destLocId || sourceLocId === destLocId) {
            setFormError('Choose different source and destination locations.');
            return;
        }
        const payloadLines = lines
            .filter((l) => l.itemId)
            .map((l) => ({
                itemId: l.itemId,
                qty: lineQty(l),
                takas: Object.entries(l.takas).map(([lotTakaId, qty]) => ({ lotTakaId, qty: Number(qty) || 0 })),
            }));
        if (!payloadLines.length || payloadLines.some((l) => l.qty <= 0)) {
            setFormError('Add at least one item with a quantity (or select its takas).');
            return;
        }
        setSaving(true);
        try {
            await addTransfer({
                sourceLocationId: sourceLocId,
                destLocationId: destLocId,
                date: new Date().toISOString().split('T')[0],
                shippedBy,
                items: payloadLines,
            });
            setShowAddModal(false);
            resetForm();
        } catch (err) {
            setFormError(err?.message || 'Transfer could not be saved.');
        } finally {
            setSaving(false);
        }
    };

    const columns = [
        {
            key: 'transferNumber',
            header: 'Transfer Ref #',
            width: '15%',
            render: (t) => (<span className="font-mono font-bold text-text-secondary flex items-center gap-1.5">
          <ArrowLeftRight size={13} className="text-primary"/> {t.transferNumber || t.transfer_number || '—'}
        </span>),
        },
        { key: 'sourceLocation', header: 'Origin', width: '15%', render: (t) => <span className="font-semibold text-text-secondary">{t.sourceLocation}</span> },
        { key: 'destLocation', header: 'Destination', width: '15%', render: (t) => <span className="font-bold text-text">{t.destLocation}</span> },
        { key: 'date', header: 'Date', width: '11%', render: (t) => <span className="text-muted font-mono text-[11px]">{t.date}</span> },
        {
            key: 'itemsCount',
            header: 'Lines',
            align: 'center',
            width: '8%',
            render: (t) => <span className="font-mono font-bold text-text">{t.items?.length ?? t.itemsCount ?? 0}</span>,
        },
        {
            key: 'shippedBy',
            header: 'Dispatched By',
            width: '12%',
            render: (t) => (<span className="text-text-secondary text-xs flex items-center gap-1">
          <User size={12} className="text-muted"/> {t.shippedBy || t.shipped_by || '—'}
        </span>),
        },
        { key: 'status', header: 'Status', align: 'center', width: '10%', render: (t) => <StatusBadge status={t.status}/> },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            width: '14%',
            render: (t) => (<div className="flex items-center justify-end gap-1.5">
            {t.status === 'Requested' && (<button onClick={() => updateTransferStatus(t.id, 'In Transit')} className="px-2 py-1 bg-primary text-white rounded text-[11px] font-semibold cursor-pointer flex items-center gap-1">
                <Truck size={11}/> Dispatch
              </button>)}
            {t.status === 'In Transit' && (<button onClick={() => updateTransferStatus(t.id, 'Received')} className="px-2 py-1 bg-primary text-white rounded text-[11px] font-semibold cursor-pointer flex items-center gap-1">
                <CheckCircle2 size={11}/> Confirm Intake
              </button>)}
            {t.status !== 'Cancelled' && (<button onClick={() => updateTransferStatus(t.id, 'Cancelled')} className="px-2 py-1 border border-rose-200 text-rose-700 rounded text-[11px] font-semibold cursor-pointer flex items-center gap-1">
                <Ban size={11}/> Cancel
              </button>)}
          </div>),
        },
    ];

    const inTransitCount = transfers.filter((t) => t.status === 'In Transit').length;
    const receivedCount = transfers.filter((t) => t.status === 'Received').length;

    return (<div className="space-y-6">
      <PageHeader title="Stock Transfers & Relocation" subtitle="Inter-godown stock movement, taka by taka." guide={transfersGuide} actions={<Button icon={Plus} onClick={() => { resetForm(); setShowAddModal(true); }}>
            Initiate Stock Transfer
          </Button>}/>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Transfers" value={transfers.length} icon={ArrowLeftRight} />
        <StatCard label="In Transit" value={inTransitCount} icon={Truck} highlight={inTransitCount > 0} />
        <StatCard label="Received" value={receivedCount} icon={CheckCircle2} />
        <StatCard label="Locations" value={locations.length} icon={MapPin} />
      </div>

      <DataTable title="Stock Transfer Log" columns={columns} data={transfers} keyExtractor={(t) => t.id} searchPlaceholder="Search transfer #, source, or destination..." searchFilter={(t, term) => String(t.transferNumber ?? t.transfer_number ?? '').toLowerCase().includes(term) ||
            String(t.sourceLocation ?? '').toLowerCase().includes(term) ||
            String(t.destLocation ?? '').toLowerCase().includes(term)}/>

      {showAddModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full p-4 sm:p-6 text-xs max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">Create Stock Transfer</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X size={18}/>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Source Location *</label>
                    <MasterSourceLink source="godowns" />
                  </div>
                  <select required value={sourceLocId} onChange={(e) => { setSourceLocId(e.target.value); setLines([emptyLine()]); }} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800">
                    <option value="">Select source</option>
                    {locations.map((loc) => (<option key={loc.id} value={loc.id}>{loc.name}{loc.code ? ` (${loc.code})` : ''}</option>))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Destination Location *</label>
                    <MasterSourceLink source="godowns" />
                  </div>
                  <select required value={destLocId} onChange={(e) => setDestLocId(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800">
                    <option value="">Select destination</option>
                    {locations.filter((l) => l.id !== sourceLocId).map((loc) => (<option key={loc.id} value={loc.id}>{loc.name}{loc.code ? ` (${loc.code})` : ''}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dispatched By</label>
                  <input type="text" value={shippedBy} onChange={(e) => setShippedBy(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"/>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">Items & Takas</label>
                  <button type="button" onClick={() => setLines((p) => [...p, emptyLine()])} className="text-primary font-semibold flex items-center gap-1 cursor-pointer">
                    <Plus size={12}/> Add item
                  </button>
                </div>
                {!sourceLocId && <p className="text-slate-500">Choose the source location to see its takas.</p>}
                {lines.map((line) => {
                    const takas = takasByItem[line.itemId] || [];
                    const picked = Object.keys(line.takas).length > 0;
                    return (<div key={line.key} className="border border-[#dce5f4] rounded-xl p-3 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_32px] gap-2 items-end">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-slate-600">Item *</label>
                            <MasterSourceLink source="items" />
                          </div>
                          <select value={line.itemId} onChange={(e) => updateLine(line.key, { itemId: e.target.value, takas: {}, qty: '' })} className="w-full border border-slate-300 rounded-lg p-2 bg-white">
                            <option value="">Select item</option>
                            {items.filter((i) => i.itemKind !== 'Service').map((i) => (<option key={i.id} value={i.id}>{i.sku} — {i.name}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1">Quantity</label>
                          <input type="number" min="0" step="0.01" value={picked ? lineQty(line) : line.qty} disabled={picked} onChange={(e) => updateLine(line.key, { qty: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2 bg-white disabled:bg-slate-50 font-mono"/>
                        </div>
                        <button type="button" onClick={() => setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== line.key) : p))} className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer" aria-label="Remove line">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                      {line.itemId && (loadingTakas ? <p className="text-slate-500">Loading takas…</p> : takas.length === 0 ? (
                        <p className="text-slate-500">No takas of this item at the source; the quantity moves without taka selection.</p>
                      ) : (<div className="overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead className="text-slate-500">
                              <tr><th className="text-left p-1">Move</th><th className="text-left p-1">Taka</th><th className="text-left p-1">Lot / Roll</th><th className="text-right p-1">Available</th><th className="text-right p-1">Qty to move</th></tr>
                            </thead>
                            <tbody>
                              {takas.map((t) => {
                                const sel = line.takas[t.id] !== undefined;
                                return (<tr key={t.id} className="border-t border-slate-100">
                                    <td className="p-1"><input type="checkbox" checked={sel} onChange={() => toggleTaka(line, t)}/></td>
                                    <td className="p-1 font-mono">{t.takaId || '—'}</td>
                                    <td className="p-1">{t.lotNo} / #{t.takaRoll}</td>
                                    <td className="p-1 text-right font-mono">{t.availableQty} {t.uom || ''}</td>
                                    <td className="p-1 text-right">
                                      <input type="number" min="0" max={t.availableQty} step="0.01" disabled={!sel} value={sel ? line.takas[t.id] : ''} onChange={(e) => updateLine(line.key, { takas: { ...line.takas, [t.id]: e.target.value } })} className="w-24 border border-slate-300 rounded p-1 text-right font-mono disabled:bg-slate-50"/>
                                    </td>
                                  </tr>);
                            })}
                            </tbody>
                          </table>
                        </div>))}
                    </div>);
                })}
              </div>

              {formError && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{formError}</div>}

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-bold shadow-sm disabled:opacity-60">
                  {saving ? 'Saving…' : 'Create & Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>)}
    </div>);
};
