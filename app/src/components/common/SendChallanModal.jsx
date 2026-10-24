import React, { useState, useEffect } from 'react';
import { X, Send, Mail, FileText, Award, CheckCircle2, ShieldCheck, Eye, Paperclip } from 'lucide-react';
import { useERP } from '../../context/ERPContext';

export const SendChallanModal = ({
    isOpen,
    onClose,
    challan,
    onPreviewChallan = null,
    onSuccess,
}) => {
    const { customers, parties, updateDeliveryChallanStatus, showToast } = useERP();

    const customerEmail = () => {
        if (!challan) return '';
        const cust =
            customers.find((c) => c.id === challan.customerId || c.name?.toLowerCase() === challan.customer?.toLowerCase()) ||
            parties.find((p) => p.id === challan.customerId || p.name?.toLowerCase() === challan.customer?.toLowerCase());
        return cust?.email || 'receiving.dock@client.com';
    };

    const [recipientEmail, setRecipientEmail] = useState('');
    const [ccEmail, setCcEmail] = useState('logistics@horizon-systems.io');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [attachChallan, setAttachChallan] = useState(true);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (challan) {
            const cust =
                customers.find((c) => c.id === challan.customerId || c.name?.toLowerCase() === challan.customer?.toLowerCase()) ||
                parties.find((p) => p.id === challan.customerId || p.name?.toLowerCase() === challan.customer?.toLowerCase());
            const email = cust?.email || 'receiving.dock@client.com';
            
            setRecipientEmail(email);
            setEmailSubject(`Logistics Waybill & Consignment Manifest ${challan.challanNumber} — ${challan.customer}`);
            setEmailBody(
                `Dear ${challan.customer} Team,\n\nPlease find attached the official logistics Delivery Challan & Shipping Waybill (${challan.challanNumber}) for your recent consignment dispatch.\n\nPlease inspect the packages and verify piece counts upon arrival.\n\nBest regards,\nLogistics Dispatch Team`
            );
        }
    }, [challan, customers, parties]);

    if (!isOpen || !challan) return null;

    const handleSend = (e) => {
        e.preventDefault();
        setIsSending(true);

        setTimeout(() => {
            setIsSending(false);

            const attachedNames = [];
            if (attachChallan) attachedNames.push('Delivery Challan.pdf');

            showToast(
                `Consignment documents [${attachedNames.join(' + ')}] successfully sent to ${recipientEmail}`
            );

            if (onSuccess) {
                onSuccess();
            }
            onClose();
        }, 600);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-auto overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-2 lg:gap-0 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
                            <Send size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-slate-900">Send Delivery Consignment</h3>
                            <p className="text-xs text-slate-500">
                                Manifest: <span className="font-mono font-bold text-slate-700">{challan.challanNumber}</span> • Consignee: <strong className="text-slate-800">{challan.customer}</strong>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSend} className="p-4 sm:p-6 space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                                Recipient Email (Consignee) *
                            </label>
                            <input
                                type="email"
                                required
                                value={recipientEmail}
                                onChange={(e) => setRecipientEmail(e.target.value)}
                                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="customer@client.com"
                            />
                        </div>

                        <div>
                            <label className="font-semibold text-slate-700 block mb-1">
                                CC (Logistics Operations)
                            </label>
                            <input
                                type="email"
                                value={ccEmail}
                                onChange={(e) => setCcEmail(e.target.value)}
                                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="logistics@company.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                            Email Subject Line *
                        </label>
                        <input
                            type="text"
                            required
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="font-semibold text-slate-700 block mb-1">
                            Message Body
                        </label>
                        <textarea
                            rows={5}
                            value={emailBody}
                            onChange={(e) => setEmailBody(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-800 text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                        />
                    </div>

                    {/* Attached Documents Selection */}
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
                            <Paperclip size={13} className="text-slate-500" /> Attached Documents (PDF)
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Delivery Challan Document Card */}
                            <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                                attachChallan ? 'bg-blue-50/60 border-blue-300' : 'bg-slate-50 border-slate-200'
                            }`}>
                                <div className="flex items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        checked={attachChallan}
                                        onChange={(e) => setAttachChallan(e.target.checked)}
                                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <FileText size={13} className="text-blue-600" />
                                            <strong className="text-slate-800 text-xs">Delivery Challan.pdf</strong>
                                        </div>
                                        <span className="font-mono text-[10px] text-slate-500 block">
                                            {challan.challanNumber} • Logistics Manifest
                                        </span>
                                    </div>
                                </div>
                                {onPreviewChallan && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onPreviewChallan();
                                        }}
                                        className="p-1 text-slate-500 hover:text-blue-600 rounded"
                                        title="Preview Delivery Challan"
                                    >
                                        <Eye size={13} />
                                    </button>
                                )}
                            </label>

                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex flex-wrap lg:flex-nowrap items-center justify-end gap-2 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-sm transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSending || !attachChallan}
                            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                            <Send size={13} /> {isSending ? 'Sending Consignment...' : 'Send Consignment Documents'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};
