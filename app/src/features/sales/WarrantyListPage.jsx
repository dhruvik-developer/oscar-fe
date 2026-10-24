import React, { useState, useMemo } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { PageHeader } from '../../components/common/PageHeader';
import {
    ShieldCheck,
    Award,
    Eye,
    Send,
    Trash2,
    PauseCircle,
    PlayCircle,
    Ban,
    Clock,
    FileText,
    Pencil,
    AlertTriangle,
    X,
    CheckCircle2,
} from 'lucide-react';
import { formatDisplayDate, formatWarrantyPeriod, getWarrantyStatusStyle } from '../../utils/warrantyUtils';
import { WarrantyCardModal } from '../../components/common/WarrantyCardModal';
import { CreateWarrantyCardModal } from '../../components/common/CreateWarrantyCardModal';
import { SendChallanModal } from '../../components/common/SendChallanModal';

const warrantyGuide = {
    title: 'Customer Warranty & Guarantee Registry',
    subtitle: 'Manage customer equipment warranty cards, serial guarantees, and delivery consignment attachments.',
    purpose: 'The Customer Warranty Registry tracks all equipment warranty certificates issued to customers upon delivery dispatch. It automatically manages warranty periods, expiry dates, serial number associations, and component-level coverage without requiring manual data duplication.',
    keyTerms: [
        { term: 'Warranty Card', definition: 'The official customer-facing certificate confirming equipment coverage, serial numbers, and validity periods.' },
        { term: 'Coverage Status', definition: 'Real-time coverage state (Active, Expiring Soon, Expired, Suspended, Pending Activation, or Cancelled) dynamically calculated from dates.' },
        { term: 'Suspension / Hold', definition: 'Temporary hold on warranty claims during commercial reviews or technical investigation.' },
        { term: 'Void / Cancellation', definition: 'Official cancellation of warranty terms with an auditable reason (e.g. equipment return or term violation).' },
    ],
    tips: [
        'Warranty Cards are auto-populated from Delivery Challan dispatch manifests and linked sales orders.',
        'Hard deletion is strictly limited to Draft certificates to preserve legal and serial number audit trails.',
    ],
    workflow: ['Delivery Challan Dispatched', 'Warranty Card Attached & Verified', 'Card Generated', 'Consignment & Card Sent to Customer'],
};

export const WarrantyListPage = () => {
    const {
        warranties = [],
        deliveryChallans = [],
        cancelWarrantyCard,
        voidWarrantyCard = cancelWarrantyCard,
        suspendWarrantyCard,
        resumeWarrantyCard,
        deleteWarrantyCard,
    } = useERP();

    const [selectedWarranty, setSelectedWarranty] = useState(null);
    const [editWarrantyChallan, setEditWarrantyChallan] = useState(null);
    const [editingCard, setEditingCard] = useState(null);
    const [sendChallan, setSendChallan] = useState(null);
    const [statusFilter, setStatusFilter] = useState('All');

    // Action dialog state (for Void, Pause, Delete confirmations)
    const [actionDialog, setActionDialog] = useState(null); // { type: 'void' | 'pause' | 'delete', card: obj }
    const [actionReason, setActionReason] = useState('');

    // Summary counts
    const activeCount = warranties.filter((w) => w.coverageStatus === 'Active' && w.documentStatus !== 'Cancelled' && w.documentStatus !== 'Suspended').length;
    const expiringSoonCount = warranties.filter((w) => w.coverageStatus === 'Expiring Soon' && w.documentStatus !== 'Cancelled' && w.documentStatus !== 'Suspended').length;
    const suspendedCount = warranties.filter((w) => w.coverageStatus === 'Suspended' || w.documentStatus === 'Suspended').length;
    const expiredCount = warranties.filter((w) => w.coverageStatus === 'Expired' && w.documentStatus !== 'Cancelled').length;
    const draftCount = warranties.filter((w) => w.documentStatus === 'Draft').length;
    const cancelledCount = warranties.filter((w) => w.documentStatus === 'Cancelled' || w.coverageStatus === 'Cancelled').length;

    const filteredWarranties = useMemo(() => {
        return warranties.filter((w) => {
            if (statusFilter === 'All') return true;
            if (statusFilter === 'Active') return (w.coverageStatus === 'Active' || w.coverageStatus === 'Pending Activation') && w.documentStatus !== 'Cancelled' && w.documentStatus !== 'Suspended';
            if (statusFilter === 'Expiring Soon') return w.coverageStatus === 'Expiring Soon' && w.documentStatus !== 'Cancelled' && w.documentStatus !== 'Suspended';
            if (statusFilter === 'Suspended') return w.coverageStatus === 'Suspended' || w.documentStatus === 'Suspended';
            if (statusFilter === 'Expired') return w.coverageStatus === 'Expired' && w.documentStatus !== 'Cancelled';
            if (statusFilter === 'Draft') return w.documentStatus === 'Draft';
            if (statusFilter === 'Cancelled') return w.documentStatus === 'Cancelled' || w.coverageStatus === 'Cancelled';
            return true;
        });
    }, [warranties, statusFilter]);

    function handleConfirmAction(e) {
        e.preventDefault();
        if (!actionDialog?.card) return;

        const { type, card } = actionDialog;
        if (type === 'delete') {
            if (deleteWarrantyCard) deleteWarrantyCard(card.id);
        } else if (type === 'void') {
            if (voidWarrantyCard) voidWarrantyCard(card.id, actionReason.trim() || 'Warranty cancelled/voided');
        } else if (type === 'pause') {
            if (suspendWarrantyCard) suspendWarrantyCard(card.id, actionReason.trim() || 'Temporary hold');
        }

        setActionDialog(null);
        setActionReason('');
    }

    const columns = [
        {
            key: 'cardNumber',
            header: 'Warranty Card #',
            width: '14%',
            render: (w) => (
                <button
                    onClick={() => setSelectedWarranty(w)}
                    className="font-mono font-bold text-primary hover:underline flex items-center gap-1.5 cursor-pointer text-left whitespace-nowrap"
                >
                    <Award size={14} className="text-emerald-600 shrink-0" />
                    <span>{w.cardNumber}</span>
                </button>
            ),
        },
        {
            key: 'customerName',
            header: 'Customer / Consignee',
            width: '18%',
            render: (w) => (
                <div>
                    <strong className="text-text block font-bold">{w.customerName}</strong>
                    <span className="font-mono text-[10px] text-muted">{w.customerCode || 'CUST'}</span>
                </div>
            ),
        },
        {
            key: 'product',
            header: 'Covered Machine / Equipment',
            width: '20%',
            render: (w) => {
                const firstItem = (w.items && w.items[0]) || {};
                const otherCount = (w.items?.length || 1) - 1;
                return (
                    <div>
                        <span className="font-semibold text-text block">{firstItem.name || 'Industrial Equipment'}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted font-mono">
                            <span>SKU: {firstItem.sku || 'SKU'}</span>
                            {otherCount > 0 && (
                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1 rounded font-bold">
                                    +{otherCount} more
                                </span>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            key: 'serials',
            header: 'Serial Number(s)',
            width: '15%',
            render: (w) => {
                const serials = (w.items || []).flatMap((it) => it.serialNumbers || (it.serialNumber ? [it.serialNumber] : []));
                if (serials.length === 0) {
                    return <span className="text-[11px] text-muted italic">Non-serialized</span>;
                }
                return (
                    <div className="flex flex-wrap gap-1">
                        {serials.slice(0, 2).map((s) => (
                            <span key={s} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 rounded font-mono text-[10px] font-semibold">
                                {s}
                            </span>
                        ))}
                        {serials.length > 2 && (
                            <span className="text-[10px] font-mono text-muted">+{serials.length - 2}</span>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'challanNumber',
            header: 'Delivery Challan',
            width: '12%',
            render: (w) => (
                <div>
                    <span className="font-mono font-bold text-text text-[11px] block">{w.challanNumber}</span>
                    <span className="text-[10px] text-muted">{formatDisplayDate(w.deliveryDate || w.startDate)}</span>
                </div>
            ),
        },
        {
            key: 'expiryDate',
            header: 'Duration / Expiry',
            width: '12%',
            render: (w) => (
                <div>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 text-[11px] block">
                        {formatWarrantyPeriod(w.warrantyPeriod, w.warrantyUnit)}
                    </span>
                    <span className="font-mono text-[10px] text-muted">Exp: {formatDisplayDate(w.expiryDate)}</span>
                </div>
            ),
        },
        {
            key: 'coverageStatus',
            header: 'Coverage Status',
            align: 'center',
            width: '12%',
            render: (w) => {
                const isDraft = w.documentStatus === 'Draft';
                const isSuspended = w.documentStatus === 'Suspended' || w.coverageStatus === 'Suspended';
                const style = getWarrantyStatusStyle(isSuspended ? 'Suspended' : w.coverageStatus);

                return (
                    <div className="space-y-0.5 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                            isDraft ? 'bg-amber-50 text-amber-800 border-amber-200' : style.bg
                        }`}>
                            {isDraft ? 'Draft Certificate' : style.label}
                        </span>
                        {w.cancellationReason && (
                            <p className="text-[9px] text-rose-500 truncate max-w-[120px] mx-auto" title={w.cancellationReason}>
                                {w.cancellationReason}
                            </p>
                        )}
                        {w.suspendReason && (
                            <p className="text-[9px] text-purple-500 truncate max-w-[120px] mx-auto" title={w.suspendReason}>
                                {w.suspendReason}
                            </p>
                        )}
                    </div>
                );
            },
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            width: '14%',
            render: (w) => {
                const linkedChallan = deliveryChallans.find((c) => c.id === w.deliveryChallanId || c.challanNumber === w.challanNumber);
                const isDraft = w.documentStatus === 'Draft';
                const isCancelled = w.documentStatus === 'Cancelled' || w.coverageStatus === 'Cancelled';
                const isSuspended = w.documentStatus === 'Suspended' || w.coverageStatus === 'Suspended';

                return (
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        {/* View Preview */}
                        <button
                            onClick={() => setSelectedWarranty(w)}
                            className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-xs transition cursor-pointer"
                            title="Preview / Print Certificate"
                        >
                            <Eye size={14} />
                        </button>

                        {/* Send via Challan */}
                        {linkedChallan && !isCancelled && !isDraft && (
                            <button
                                onClick={() => setSendChallan(linkedChallan)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded text-xs transition cursor-pointer"
                                title="Send with Delivery Challan"
                            >
                                <Send size={14} />
                            </button>
                        )}

                        {/* DRAFT ACTIONS: Edit & Delete */}
                        {isDraft && (
                            <>
                                {linkedChallan && (
                                    <button
                                        onClick={() => {
                                            setEditingCard(w);
                                            setEditWarrantyChallan(linkedChallan);
                                        }}
                                        className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded text-xs transition cursor-pointer"
                                        title="Edit Draft"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                )}
                                <button
                                    onClick={() => setActionDialog({ type: 'delete', card: w })}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded text-xs transition cursor-pointer"
                                    title="Delete Draft"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </>
                        )}

                        {/* ACTIVE / ISSUED ACTIONS: Pause & Void */}
                        {!isDraft && !isCancelled && !isSuspended && (
                            <>
                                <button
                                    onClick={() => setActionDialog({ type: 'pause', card: w })}
                                    className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded text-xs transition cursor-pointer"
                                    title="Pause / Suspend Warranty Coverage"
                                >
                                    <PauseCircle size={14} />
                                </button>
                                <button
                                    onClick={() => setActionDialog({ type: 'void', card: w })}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded text-xs transition cursor-pointer"
                                    title="Void / Cancel Warranty"
                                >
                                    <Ban size={14} />
                                </button>
                            </>
                        )}

                        {/* SUSPENDED ACTIONS: Resume & Void */}
                        {isSuspended && (
                            <>
                                <button
                                    onClick={() => resumeWarrantyCard(w.id)}
                                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded text-xs transition cursor-pointer"
                                    title="Resume Active Coverage"
                                >
                                    <PlayCircle size={14} />
                                </button>
                                <button
                                    onClick={() => setActionDialog({ type: 'void', card: w })}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded text-xs transition cursor-pointer"
                                    title="Void / Cancel Warranty"
                                >
                                    <Ban size={14} />
                                </button>
                            </>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <div className="w-full space-y-5">
            <PageHeader
                title="Customer Warranty & Equipment Guarantee Registry"
                subtitle="Manage equipment warranty cards, serial number registrations, and multi-document consignment dispatches."
                guide={warrantyGuide}
            />

            {/* Summary Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    label="Active Warranties"
                    value={`${activeCount} Cards`}
                    icon={ShieldCheck}
                />
                <StatCard
                    label="Expiring Soon (60 Days)"
                    value={`${expiringSoonCount} Units`}
                    icon={Clock}
                />
                <StatCard
                    label="Suspended / On Hold"
                    value={`${suspendedCount} Cards`}
                    icon={PauseCircle}
                />
                <StatCard
                    label="Draft Certificates"
                    value={`${draftCount} Drafts`}
                    icon={FileText}
                />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                {[
                    { id: 'All', label: 'All Warranties', count: warranties.length },
                    { id: 'Active', label: 'Active Coverage', count: activeCount },
                    { id: 'Expiring Soon', label: 'Expiring Soon', count: expiringSoonCount },
                    { id: 'Suspended', label: 'Suspended / On Hold', count: suspendedCount },
                    { id: 'Expired', label: 'Expired', count: expiredCount },
                    { id: 'Draft', label: 'Drafts', count: draftCount },
                    { id: 'Cancelled', label: 'Cancelled / Void', count: cancelledCount },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setStatusFilter(tab.id)}
                        className={`shrink-0 lg:shrink px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition flex items-center gap-1.5 ${
                            statusFilter === tab.id
                                ? 'bg-primary text-white shadow-2xs'
                                : 'bg-card text-muted hover:text-text border border-border'
                        }`}
                    >
                        <span>{tab.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                            statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-soft text-muted'
                        }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Main Data Table */}
            <DataTable
                title="Customer Equipment Warranty Registry"
                columns={columns}
                data={filteredWarranties}
                keyExtractor={(w) => w.id}
                searchPlaceholder="Search warranty #, customer, serial, or SKU..."
                searchFilter={(w, term) => {
                    const t = term.toLowerCase();
                    const cardMatch = w.cardNumber?.toLowerCase().includes(t);
                    const custMatch = w.customerName?.toLowerCase().includes(t);
                    const dcMatch = w.challanNumber?.toLowerCase().includes(t);
                    const itemMatch = (w.items || []).some(
                        (it) =>
                            it.name?.toLowerCase().includes(t) ||
                            it.sku?.toLowerCase().includes(t) ||
                            (it.serialNumbers && it.serialNumbers.some((s) => s.toLowerCase().includes(t))) ||
                            (it.serialNumber && String(it.serialNumber ?? '').toLowerCase().includes(t))
                    );
                    return cardMatch || custMatch || dcMatch || itemMatch;
                }}
            />

            {/* View / Print Customer Warranty Card Modal */}
            {selectedWarranty && (
                <WarrantyCardModal
                    isOpen={Boolean(selectedWarranty)}
                    onClose={() => setSelectedWarranty(null)}
                    warrantyCard={selectedWarranty}
                    onSend={(wc) => {
                        const linkedC = deliveryChallans.find((c) => c.id === wc.deliveryChallanId || c.challanNumber === wc.challanNumber);
                        if (linkedC) {
                            setSelectedWarranty(null);
                            setSendChallan(linkedC);
                        }
                    }}
                />
            )}

            {/* Edit Draft Warranty Card Modal */}
            {editWarrantyChallan && (
                <CreateWarrantyCardModal
                    isOpen={Boolean(editWarrantyChallan)}
                    onClose={() => {
                        setEditWarrantyChallan(null);
                        setEditingCard(null);
                    }}
                    challan={editWarrantyChallan}
                    existingCard={editingCard}
                    onSuccess={(updated) => {
                        setSelectedWarranty(updated);
                    }}
                />
            )}

            {/* Send Challan & Warranty Modal */}
            {sendChallan && (
                <SendChallanModal
                    isOpen={Boolean(sendChallan)}
                    onClose={() => setSendChallan(null)}
                    challan={sendChallan}
                    warrantyCard={warranties.find((w) => w.deliveryChallanId === sendChallan.id || w.challanNumber === sendChallan.challanNumber)}
                    onPreviewWarranty={() => {
                        const wc = warranties.find((w) => w.deliveryChallanId === sendChallan.id || w.challanNumber === sendChallan.challanNumber);
                        if (wc) setSelectedWarranty(wc);
                    }}
                />
            )}

            {/* ACTION DIALOG: Void, Pause, Delete Confirmations */}
            {actionDialog && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4"
                    role="presentation"
                    onMouseDown={() => setActionDialog(null)}
                >
                    <form
                        onSubmit={handleConfirmAction}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
                    >
                        <div className="flex items-center justify-between gap-3 lg:gap-0 px-5 py-4 border-b border-border bg-soft/50">
                            <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                    actionDialog.type === 'delete' || actionDialog.type === 'void'
                                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                        : 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                                }`}>
                                    {actionDialog.type === 'delete' && <Trash2 size={15} />}
                                    {actionDialog.type === 'void' && <Ban size={15} />}
                                    {actionDialog.type === 'pause' && <PauseCircle size={15} />}
                                </div>
                                <h3 className="text-sm font-black text-text">
                                    {actionDialog.type === 'delete' && 'Delete Draft Warranty'}
                                    {actionDialog.type === 'void' && 'Void / Cancel Warranty Certificate'}
                                    {actionDialog.type === 'pause' && 'Pause / Suspend Warranty Coverage'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActionDialog(null)}
                                className="text-muted hover:text-text p-1 rounded-lg hover:bg-soft transition cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-5 space-y-3.5 text-xs">
                            <p className="text-muted leading-relaxed">
                                {actionDialog.type === 'delete' && (
                                    <>Are you sure you want to delete draft certificate <strong>{actionDialog.card?.cardNumber}</strong> for <strong>{actionDialog.card?.customerName}</strong>? This draft record will be permanently removed.</>
                                )}
                                {actionDialog.type === 'void' && (
                                    <>Voiding certificate <strong>{actionDialog.card?.cardNumber}</strong> will invalidate customer coverage while retaining the serial number audit history under the <strong>Cancelled / Void</strong> tab.</>
                                )}
                                {actionDialog.type === 'pause' && (
                                    <>Suspending certificate <strong>{actionDialog.card?.cardNumber}</strong> will put warranty claims on hold (e.g. during commercial disputes or equipment inspections).</>
                                )}
                            </p>

                            {actionDialog.type !== 'delete' && (
                                <div>
                                    <label className="block text-xs font-bold text-text mb-1">
                                        Reason / Audit Notes <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        value={actionReason}
                                        onChange={(e) => setActionReason(e.target.value)}
                                        placeholder={
                                            actionDialog.type === 'void'
                                                ? 'e.g. Unit returned for refund / Tampering violation'
                                                : 'e.g. Customer payment dispute / Inspection hold'
                                        }
                                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-text focus:outline-none focus:border-primary shadow-2xs"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-soft/50 border-t border-border">
                            <button
                                type="button"
                                onClick={() => setActionDialog(null)}
                                className="inline-flex items-center justify-center h-9 px-4 text-xs font-semibold text-text bg-card hover:bg-soft border border-border rounded-xl shadow-2xs transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={`inline-flex items-center justify-center h-9 px-5 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer ${
                                    actionDialog.type === 'delete' || actionDialog.type === 'void'
                                        ? 'bg-rose-600 hover:bg-rose-700'
                                        : 'bg-purple-600 hover:bg-purple-700'
                                }`}
                            >
                                {actionDialog.type === 'delete' && 'Delete Draft'}
                                {actionDialog.type === 'void' && 'Void Certificate'}
                                {actionDialog.type === 'pause' && 'Suspend Coverage'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
