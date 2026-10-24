import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle2, Receipt, Eye, DollarSign, X, Zap, Printer, Clock, AlertCircle, FileText, Plus, Ban, Check, Edit, Lock, ShieldAlert, MapPin, Truck } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { salesService } from '../../services/domainServices';
import { StatCard } from '../../components/ui/StatCard';
import { LineItemEditor } from '../../components/common/LineItemEditor';
import { DocumentTimeline } from '../../components/common/DocumentTimeline';
import { RelatedDocumentsCard } from '../../components/common/RelatedDocumentsCard';
import { PaymentReceiptModal } from '../../components/common/PaymentReceiptModal';
import { PrintInvoiceModal } from '../../components/common/PrintInvoiceModal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/common/PageHeader';
import TablePagination from '../../components/ui/TablePagination';
import SalespersonSelect from '../../components/common/SalespersonSelect';
import MasterSourceLink from '../../components/common/MasterSourceLink';

const invoiceGuide = {
    title: 'Sales Invoices & Receivables',
    subtitle: 'Commercial tax billing, draft lifecycle finalization, AR ledger, and payment receipts.',
    purpose: 'A Sales Invoice is the official commercial demand for payment. Draft invoices remain fully editable for adding/removing items or revising prices. Finalized invoices are locked commercial instruments that post to Accounts Receivable and general ledger.',
    keyTerms: [
        { term: 'Draft Invoice', definition: 'Preliminary invoice stage that allows modifying line items, quantities, rates, and addresses without posting financial entries.' },
        { term: 'Finalized Commercial Invoice', definition: 'Locked commercial document that posts to Accounts Receivable, General Ledger, and deducts inventory.' },
        { term: 'Address Snapshot', definition: 'Immutable record of billing and shipping addresses preserved on the invoice at the time of creation.' },
        { term: 'Reversible Cancellation', definition: 'Cancelling a finalized invoice safely reverses all AR and GL entries, guarding against cancelled payments.' },
    ],
    tips: [
        'Proforma Invoices convert into Draft Sales Invoices, giving you full flexibility to adjust parts and quantities before final commercial posting.',
        'Use the ⚡ Settle button on unpaid invoices to record payment and generate an official printable receipt voucher in 1 click.',
    ],
    workflow: ['Proforma / SO Draft Created', 'Adjust Line Items & Addresses', 'Finalize Commercial Invoice', 'Collect Payment', 'Receipt Voucher Issued'],
};

export const SalesInvoicesView = ({ invoices = [], onCreateInvoice, searchTerm: globalSearch = '', }) => {
    const {
        customers = [],
        parties = [],
        quotations = [],
        salesOrders = [],
        proformaInvoices = [],
        paymentIns = [],
        salesReturns = [],
        addPaymentIn,
        updateDraftInvoice,
        finalizeInvoice,
        cancelSalesInvoice,
        convertInvoiceToChallan,
        getInvoiceOutstanding,
        deliveryChallans = [],
        formatCurrency,
        formatDateDDMMYYYY,
        getCurrentDateFormatted,
        getCurrentISODate,
        addDaysISO,
    } = useERP();

    const [filterText, setFilterText] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const navigate = useNavigate();

    const handleConvertToChallan = async (inv) => {
        if (!inv) return;
        try {
            const challan = await convertInvoiceToChallan(inv.id);
            if (challan) {
                if (selectedInvoice) setSelectedInvoice(null);
                navigate('/sales/delivery');
            }
        } catch (err) {
            console.error('Failed to convert invoice to delivery challan:', err);
        }
    };

    const invoiceHasChallan = (inv) => {
        if (!inv) return false;
        if (inv.deliveryChallanId) return true;
        return (deliveryChallans || []).some(dc =>
            dc.status !== 'Cancelled' && (
                (inv.id && (dc.sourceInvoiceId === inv.id || dc.invoiceId === inv.id)) ||
                (inv.invoiceNumber && (dc.sourceInvoiceNumber === inv.invoiceNumber || dc.invoiceNumber === inv.invoiceNumber)) ||
                (inv.deliveryChallanId && dc.id === inv.deliveryChallanId)
            )
        );
    };

    // Create & Edit State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingDraftTarget, setEditingDraftTarget] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showPaymentModal, setShowPaymentModal] = useState(null);
    const [activeReceipt, setActiveReceipt] = useState(null);
    const [printInvoiceTarget, setPrintInvoiceTarget] = useState(null);

    // Cancellation & Finalize modals
    const [cancelModalTarget, setCancelModalTarget] = useState(null);
    const [finalizeModalTarget, setFinalizeModalTarget] = useState(null);
    // E-Invoice & E-Way Bill States (P9)
    const [einvoiceLoading, setEinvoiceLoading] = useState(false);
    const [einvoiceFeedback, setEinvoiceFeedback] = useState(null);
    const [showCancelIrnModal, setShowCancelIrnModal] = useState(false);
    const [cancelIrnRemarks, setCancelIrnRemarks] = useState('Data Entry Error');

    const handleGenerateIrn = async () => {
        if (!selectedInvoice?.id) return;
        setEinvoiceLoading(true);
        setEinvoiceFeedback(null);
        try {
            const res = await salesService.generateInvoiceIRN(selectedInvoice.id);
            const updated = res?.data || res;
            setSelectedInvoice(prev => ({ ...prev, ...updated, irn: updated.irn || prev.irn, ackNo: updated.ackNo || updated.ack_no || prev.ackNo, ackDate: updated.ackDate || updated.ack_date || prev.ackDate, einvoiceStatus: 'Generated' }));
            setEinvoiceFeedback({ type: 'success', text: 'IRN generated successfully (Simulated NIC Sandbox).' });
        } catch (err) {
            setEinvoiceFeedback({ type: 'error', text: err?.response?.data?.message || err?.message || 'Failed to generate IRN.' });
        } finally {
            setEinvoiceLoading(false);
        }
    };

    const handleConfirmCancelIrn = async () => {
        if (!selectedInvoice?.id) return;
        setEinvoiceLoading(true);
        setEinvoiceFeedback(null);
        try {
            const res = await salesService.cancelInvoiceIRN(selectedInvoice.id, { reason: '1', remarks: cancelIrnRemarks });
            const updated = res?.data || res;
            setSelectedInvoice(prev => ({ ...prev, ...updated, einvoiceStatus: 'Cancelled' }));
            setShowCancelIrnModal(false);
            setEinvoiceFeedback({ type: 'success', text: 'IRN cancelled successfully.' });
        } catch (err) {
            setEinvoiceFeedback({ type: 'error', text: err?.response?.data?.message || err?.message || 'Failed to cancel IRN.' });
        } finally {
            setEinvoiceLoading(false);
        }
    };

    const handleGenerateEwayBill = async () => {
        if (!selectedInvoice?.id) return;
        setEinvoiceLoading(true);
        setEinvoiceFeedback(null);
        try {
            const res = await salesService.generateInvoiceEwayBill(selectedInvoice.id, { distanceKm: 100 });
            const updated = res?.data || res;
            setSelectedInvoice(prev => ({ ...prev, ...updated, ewayBillNumber: updated.ewayBillNumber || updated.eway_bill_number || prev.ewayBillNumber, ewayBillDate: updated.ewayBillDate || updated.eway_bill_date || prev.ewayBillDate }));
            setEinvoiceFeedback({ type: 'success', text: 'E-Way Bill generated successfully (Simulated NIC Sandbox).' });
        } catch (err) {
            setEinvoiceFeedback({ type: 'error', text: err?.response?.data?.message || err?.message || 'Failed to generate E-Way Bill.' });
        } finally {
            setEinvoiceLoading(false);
        }
    };
    const [errorMessage, setErrorMessage] = useState('');

    // Payment Form state
    const [payAmount, setPayAmount] = useState(0);
    const [payMode, setPayMode] = useState('Bank Transfer');
    const [payRef, setPayRef] = useState('WIRE-2026');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

    // Create/Edit Invoice Form state
    const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
    const [linkedSoId, setLinkedSoId] = useState('None');
    const [linkedPiId, setLinkedPiId] = useState('None');
    const [invoiceDate, setInvoiceDate] = useState(getCurrentDateFormatted());
    const [dueDate, setDueDate] = useState(() => addDaysISO(getCurrentISODate(), 30));
    const [notes, setNotes] = useState('');
    const [lineItems, setLineItems] = useState([]);
    const [salesperson, setSalesperson] = useState({ id: '', name: '' });
    const [billingAddress, setBillingAddress] = useState({ line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' });
    const [shippingAddress, setShippingAddress] = useState({ line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' });
    const [sameAsBilling, setSameAsBilling] = useState(true);

    // Populate addresses on customer select
    const populateCustomerAddresses = (custId) => {
        const cust = customers.find((c) => c.id === custId) || customers[0];
        const party = parties.find((p) => p.id === custId || p.name?.toLowerCase() === cust?.name?.toLowerCase());
        const bill = party?.billingAddress || cust?.billingAddress || {
            line1: cust?.address || 'Industrial Area Phase 2',
            line2: '',
            city: cust?.city || 'Mumbai',
            state: cust?.state || 'Maharashtra',
            pincode: cust?.pincode || '400001',
            country: 'India',
        };
        const ship = party?.shippingAddress || cust?.shippingAddress || bill;

        setBillingAddress(bill);
        setShippingAddress(sameAsBilling ? bill : ship);
    };

    const handleCustomerChange = (custId) => {
        setSelectedCustomerId(custId);
        populateCustomerAddresses(custId);
    };

    const handleSoSelect = (soId) => {
        setLinkedSoId(soId);
        if (soId !== 'None') {
            const order = salesOrders.find((o) => o.id === soId || o.orderNumber === soId);
            if (order) {
                if (order.customerId) {
                    setSelectedCustomerId(order.customerId);
                    populateCustomerAddresses(order.customerId);
                }
                if (order.items && order.items.length > 0) {
                    setLineItems(order.items);
                }
                if (order.salespersonId || order.salesperson) {
                    setSalesperson({ id: order.salespersonId || '', name: order.salesperson || '' });
                }
                if (order.billingAddress) setBillingAddress(order.billingAddress);
                if (order.shippingAddress) setShippingAddress(order.shippingAddress);
            }
        }
    };

    const handlePiSelect = (piId) => {
        setLinkedPiId(piId);
        if (piId !== 'None') {
            const pi = proformaInvoices.find((p) => p.id === piId || p.piNumber === piId);
            if (pi) {
                if (pi.customerId) {
                    setSelectedCustomerId(pi.customerId);
                    populateCustomerAddresses(pi.customerId);
                }
                if (pi.referenceSo) setLinkedSoId(pi.referenceSo);
                if (pi.items && pi.items.length > 0) {
                    setLineItems(pi.items);
                }
                if (pi.billingAddress) setBillingAddress(pi.billingAddress);
                if (pi.shippingAddress) setShippingAddress(pi.shippingAddress);
                if (pi.notes) setNotes(`Sourced from Proforma ${pi.proformaNumber || pi.piNumber}.\n${pi.notes}`);
            }
        }
    };

    const handleOpenCreateModal = () => {
        setEditingDraftTarget(null);
        const defaultCust = customers[0];
        if (defaultCust) {
            setSelectedCustomerId(defaultCust.id);
            populateCustomerAddresses(defaultCust.id);
        }
        setLinkedSoId('None');
        setLinkedPiId('None');
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
        setNotes('');
        setLineItems([]);
        setSalesperson({ id: '', name: '' });
        setSameAsBilling(true);
        setErrorMessage('');
        setShowCreateModal(true);
    };

    const handleOpenEditDraft = (inv) => {
        setEditingDraftTarget(inv);
        setSelectedCustomerId(inv.customerId || '');
        setBillingAddress(inv.billingAddress || { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' });
        setShippingAddress(inv.shippingAddress || { line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' });
        setLinkedSoId(inv.salesOrderId || inv.linkedSo || 'None');
        setLinkedPiId(inv.proformaInvoiceId || inv.linkedPi || 'None');
        setInvoiceDate(inv.date || new Date().toISOString().split('T')[0]);
        setDueDate(inv.dueDate || '30 Days');
        setNotes(inv.notes || '');
        setLineItems(inv.items || []);
        setSalesperson({ id: inv.salespersonId || '', name: inv.salesperson || '' });
        setSameAsBilling(false);
        setErrorMessage('');
        setShowCreateModal(true);
    };

    const handleSaveInvoice = (statusTarget) => {
        const cust = customers.find((c) => c.id === selectedCustomerId) || customers[0];
        const party = parties.find((p) => p.id === selectedCustomerId || p.name?.toLowerCase() === cust?.name?.toLowerCase());
        const so = salesOrders.find((o) => o.id === linkedSoId || o.orderNumber === linkedSoId);
        const pi = proformaInvoices.find((p) => p.id === linkedPiId || p.proformaNumber === linkedPiId);

        const pos = party?.placeOfSupply || cust?.placeOfSupply || 'Maharashtra (27)';
        const isInterState = !pos.toLowerCase().includes('maharashtra') && !pos.includes('27');

        let subtotal = 0;
        let discountTotal = 0;
        let totalTax = 0;

        const effectiveItems = lineItems.length > 0 ? lineItems : [
            {
                id: `line-${Date.now()}`,
                description: 'Standard IT Merchandise Fulfillment',
                qty: 1,
                rate: 1000,
                tax: 18,
                amount: 1000,
            },
        ];

        effectiveItems.forEach((it) => {
            const lineSub = Number(it.rate || 0) * Number(it.qty || 1);
            const lineDisc = Number(it.discount || it.discountPercent || 0);
            const discAmt = (lineSub * lineDisc) / 100;
            const taxable = Math.max(0, lineSub - discAmt);
            const taxRate = it.tax !== undefined ? Number(it.tax) : (it.taxRate !== undefined ? Number(it.taxRate) : 18);
            const lineTax = Math.round(taxable * (taxRate / 100) * 100) / 100;
            subtotal += lineSub;
            discountTotal += discAmt;
            totalTax += lineTax;
        });

        const taxableAmount = Math.max(0, subtotal - discountTotal);
        let cgst = 0;
        let sgst = 0;
        let igst = 0;
        if (isInterState) {
            igst = totalTax;
        } else {
            cgst = Math.round((totalTax / 2) * 100) / 100;
            sgst = Math.round((totalTax - cgst) * 100) / 100;
        }

        const grandTotal = Math.round((taxableAmount + cgst + sgst + igst) * 100) / 100;
        const effectiveShipAddress = sameAsBilling ? billingAddress : shippingAddress;

        // Check if Delivery Challan exists for linked SO
        const hasChallan = Boolean(
            so && deliveryChallans.some((dc) => dc.salesOrderId === so.id || dc.salesOrderNumber === so.orderNumber || dc.linkedSo === so.orderNumber)
        );

        const isDraft = statusTarget === 'Draft';
        const isPaid = statusTarget === 'Paid';

        if (editingDraftTarget) {
            // Update existing Draft
            updateDraftInvoice(editingDraftTarget.id, {
                customerId: cust?.id,
                customer: cust?.name,
                billingAddress,
                shippingAddress: effectiveShipAddress,
                items: effectiveItems,
                subtotal,
                discountTotal,
                taxableAmount,
                cgst,
                sgst,
                igst,
                total: grandTotal,
                grandTotal,
                notes,
                salespersonId: salesperson.id,
                salesperson: salesperson.name,
            });
            setShowCreateModal(false);
            setEditingDraftTarget(null);
            return;
        }

        // The INV number is allocated by the server at finalization.
        const newInvoicePayload = {
            customerId: cust?.id,
            customer: cust?.name,
            billingAddress,
            shippingAddress: effectiveShipAddress,
            salesOrderId: so?.id,
            sourceSalesOrderId: so?.id,
            linkedSo: so?.orderNumber || (linkedSoId !== 'None' ? linkedSoId : undefined),
            proformaInvoiceId: pi?.id,
            linkedPi: pi?.proformaNumber || (linkedPiId !== 'None' ? linkedPiId : undefined),
            date: formatDateDDMMYYYY(invoiceDate),
            dueDate: formatDateDDMMYYYY(dueDate),
            status: isDraft ? 'Draft' : isPaid ? 'Paid' : 'Unpaid',
            finalized: !isDraft,
            items: effectiveItems,
            lineItems: effectiveItems,
            subtotal,
            discountTotal,
            taxableAmount,
            cgst,
            sgst,
            igst,
            tax: totalTax,
            total: grandTotal,
            grandTotal,
            amount: grandTotal,
            paidAmount: isPaid ? grandTotal : 0,
            amountPaid: isPaid ? grandTotal : 0,
            balanceDue: isPaid ? 0 : grandTotal,
            notes,
            dispatchedViaChallan: hasChallan,
            salespersonId: salesperson.id,
            salesperson: salesperson.name,
        };

        const created = onCreateInvoice(newInvoicePayload);
        if (isPaid && created) {
            addPaymentIn({
                customerId: cust?.id,
                customer: cust?.name,
                invoiceId: created.id,
                invoiceNumber: created.invoiceNumber,
                amount: created.total,
                mode: 'Bank Transfer',
                reference: `SETTLE-${created.invoiceNumber}`,
            });
        }

        setLineItems([]);
        setNotes('');
        setShowCreateModal(false);
    };

    const handleQuickSettleAndReceipt = (inv) => {
        const outstanding = getInvoiceOutstanding(inv.id);
        const amountToPay = outstanding.balanceDue > 0 ? outstanding.balanceDue : inv.total;
        const receiptNum = `RCPT-2026-${Date.now().toString().slice(-4)}`;
        addPaymentIn({
            customerId: inv.customerId,
            customer: inv.customer,
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            amount: amountToPay,
            mode: 'Bank Wire Direct',
            reference: `AUTO-SETTLE-${inv.invoiceNumber}`,
        });
        setActiveReceipt({
            receiptNumber: receiptNum,
            invoiceNumber: inv.invoiceNumber,
            customer: inv.customer,
            amount: amountToPay,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            paymentMode: 'Bank Wire Direct',
            reference: `WIRE-${Date.now().toString().slice(-6)}`,
        });
    };

    const handleRecordPaymentSubmit = (e) => {
        e.preventDefault();
        if (!showPaymentModal || isSubmittingPayment) return;
        const outstanding = getInvoiceOutstanding(showPaymentModal.id);
        const maxAllowed = outstanding.balanceDue > 0 ? outstanding.balanceDue : showPaymentModal.total;
        if (payAmount <= 0) return;
        if (payAmount > maxAllowed) {
            alert(`Payment amount cannot exceed outstanding balance (${formatCurrency(maxAllowed)}).`);
            return;
        }
        setIsSubmittingPayment(true);
        try {
            addPaymentIn({
                customerId: showPaymentModal.customerId,
                customer: showPaymentModal.customer,
                invoiceId: showPaymentModal.id,
                invoiceNumber: showPaymentModal.invoiceNumber,
                amount: payAmount,
                mode: payMode,
                reference: payRef || `WIRE-${Date.now()}`,
            });
            const receiptNum = `RCPT-2026-${Date.now().toString().slice(-4)}`;
            setActiveReceipt({
                receiptNumber: receiptNum,
                invoiceNumber: showPaymentModal.invoiceNumber,
                customer: showPaymentModal.customer,
                amount: payAmount,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                paymentMode: payMode,
                reference: payRef || `WIRE-${Date.now()}`,
            });
            setShowPaymentModal(null);
            setPayAmount(0);
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    const handleConfirmFinalize = () => {
        if (!finalizeModalTarget) return;
        finalizeInvoice(finalizeModalTarget.id);
        setFinalizeModalTarget(null);
        if (selectedInvoice && selectedInvoice.id === finalizeModalTarget.id) {
            setSelectedInvoice((prev) => ({ ...prev, finalized: true, status: 'Unpaid' }));
        }
    };

    const handleConfirmCancelInvoice = () => {
        if (!cancelModalTarget) return;
        const result = cancelSalesInvoice(cancelModalTarget.id);
        if (result && !result.success) {
            setErrorMessage(result.message);
            return;
        }
        setCancelModalTarget(null);
        setErrorMessage('');
        if (selectedInvoice && selectedInvoice.id === cancelModalTarget.id) {
            setSelectedInvoice((prev) => ({ ...prev, status: 'Cancelled' }));
        }
    };

    // Filtering & Tab state
    const effectiveFilter = (filterText || globalSearch).toLowerCase().trim();
    const filteredInvoices = invoices.filter((inv) => {
        const matchesSearch = !effectiveFilter || (
            String(inv.invoiceNumber ?? '').toLowerCase().includes(effectiveFilter) ||
            String(inv.customer ?? '').toLowerCase().includes(effectiveFilter) ||
            (inv.linkedSo && String(inv.linkedSo ?? '').toLowerCase().includes(effectiveFilter)) ||
            (inv.status && String(inv.status ?? '').toLowerCase().includes(effectiveFilter))
        );

        if (!matchesSearch) return false;
        if (statusFilter === 'All') return true;
        if (statusFilter === 'Draft') return inv.status === 'Draft' || !inv.finalized;
        if (statusFilter === 'Paid') return inv.status === 'Paid';
        if (statusFilter === 'Unpaid') return inv.status === 'Unpaid';
        if (statusFilter === 'Cancelled') return inv.status === 'Cancelled';
        return true;
    });

    // pageSize managed in state (default: 10)
    const totalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;
    const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const getInvoiceTimelineSteps = (inv) => {
        const outstanding = getInvoiceOutstanding(inv.id);
        const so = salesOrders.find((o) => o.id === inv.salesOrderId || o.orderNumber === inv.linkedSo);
        const challan = deliveryChallans.find((c) => c.salesOrderId === so?.id || c.salesOrderNumber === so?.orderNumber);
        return [
            {
                label: 'Sales Order',
                docNumber: inv.linkedSo || 'Direct Order',
                status: 'completed',
            },
            {
                label: 'Delivery Challan',
                docNumber: challan?.challanNumber || (inv.dispatchedViaChallan ? 'Dispatched' : 'Direct Fulfillment'),
                status: 'completed',
            },
            {
                label: inv.finalized ? 'Finalized Tax Invoice' : 'Draft Invoice',
                docNumber: inv.invoiceNumber,
                amount: inv.total,
                date: inv.date,
                status: 'completed',
            },
            {
                label: 'Payment Receipt',
                amount: outstanding.paid,
                status: outstanding.status === 'Paid' ? 'completed' : outstanding.status === 'Partially Paid' ? 'current' : 'pending',
            },
        ];
    };

    const getInvoiceRelatedDocs = (inv) => {
        const docs = [];
        if (inv.linkedSo || inv.salesOrderId) {
            const so = salesOrders.find((o) => o.orderNumber === inv.linkedSo || o.id === inv.salesOrderId);
            if (so) {
                if (so.quotationNumber || so.sourceQuotationId) {
                    const quote = quotations.find((q) => q.id === so.sourceQuotationId || q.quoteNumber === so.quotationNumber);
                    if (quote) {
                        docs.push({
                            type: 'Quotation',
                            number: quote.quoteNumber,
                            amount: quote.amount,
                            date: quote.date,
                            status: quote.status,
                        });
                    }
                }
                docs.push({
                    type: 'Sales Order',
                    number: so.orderNumber,
                    amount: so.amount,
                    date: so.date,
                    status: so.stage,
                });
            }
        }
        if (inv.linkedPi || inv.proformaInvoiceId) {
            const pi = proformaInvoices.find((p) => p.id === inv.proformaInvoiceId || p.proformaNumber === inv.linkedPi);
            if (pi) {
                docs.push({
                    type: 'Proforma Invoice',
                    number: pi.proformaNumber,
                    amount: pi.grandTotal || pi.total,
                    date: pi.date,
                    status: pi.status,
                });
            }
        }
        const challans = deliveryChallans.filter((c) => (inv.linkedSo && c.salesOrderNumber === inv.linkedSo) || (inv.salesOrderId && c.salesOrderId === inv.salesOrderId));
        challans.forEach((c) => {
            docs.push({
                type: 'Delivery Challan',
                number: c.challanNumber,
                date: c.date,
                status: c.status,
            });
        });
        const relatedPayments = paymentIns.filter((p) => p.invoiceId === inv.id || p.invoiceNumber === inv.invoiceNumber);
        relatedPayments.forEach((p) => {
            docs.push({
                type: 'Payment',
                number: p.receiptNumber,
                amount: p.amount,
                date: p.date,
                status: 'Settled',
            });
        });
        const returns = salesReturns.filter((sr) => sr.invoiceId === inv.id || sr.invoiceRef === inv.invoiceNumber);
        returns.forEach((sr) => {
            docs.push({
                type: 'Sales Return / Credit Note',
                number: sr.returnNumber,
                amount: sr.amount,
                date: sr.date,
                status: sr.status,
            });
        });
        return docs;
    };

    const totalInvoiced = invoices.filter(i => i.status !== 'Cancelled' && i.status !== 'Draft').reduce((sum, inv) => sum + inv.total, 0);
    const totalBalanceDue = invoices.filter(i => i.status !== 'Cancelled' && i.status !== 'Draft').reduce((sum, inv) => sum + getInvoiceOutstanding(inv.id).balanceDue, 0);
    const totalCollected = invoices.filter(i => i.status !== 'Cancelled').reduce((sum, inv) => sum + getInvoiceOutstanding(inv.id).paid, 0);
    const unpaidCount = invoices.filter(inv => inv.status !== 'Cancelled' && inv.status !== 'Draft' && getInvoiceOutstanding(inv.id).balanceDue > 0).length;

    return (
        <div className="flex-1 overflow-y-auto flex flex-col gap-6 font-sans">
            <PageHeader
                title="Sales Invoices & Commercial Receivables"
                subtitle="Draft lifecycle management, commercial locking, dynamic GST ledger posting, and multi-mode payment collection."
                guide={invoiceGuide}
                actions={
                    <Button icon={Plus} onClick={handleOpenCreateModal}>
                        Create Tax Invoice
                    </Button>
                }
            />

            {/* Sales Invoices KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Invoiced Value" value={formatCurrency(totalInvoiced)} icon={DollarSign} />
                <StatCard label="AR Outstanding Due" value={formatCurrency(totalBalanceDue)} icon={Clock} trend={{ positive: totalBalanceDue === 0, text: totalBalanceDue > 0 ? `${unpaidCount} unpaid/partial` : 'All settled' }} highlight={totalBalanceDue > 0} />
                <StatCard label="Total Collected" value={formatCurrency(totalCollected)} icon={CheckCircle2} trend={{ positive: true, text: 'Receipts synchronized' }} />
                <StatCard label="Total Invoices" value={`${invoices.length} Invoices`} icon={FileText} subtext={`${unpaidCount} requiring payment`} />
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-nowrap items-center gap-2 border-b border-slate-200 pb-2 text-xs overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
                {['All', 'Draft', 'Unpaid', 'Paid', 'Cancelled'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setStatusFilter(tab)}
                        className={`shrink-0 lg:shrink px-3 py-1.5 rounded-t font-semibold transition-colors cursor-pointer ${
                            statusFilter === tab
                                ? 'bg-white border-t-2 border-[#1F2E4A] text-[#1F2E4A] shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Invoices List Table Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 lg:gap-0 bg-white">
                    <h3 className="font-bold text-slate-800 text-sm">Commercial Invoice Register</h3>
                    <div className="relative w-full sm:w-auto">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input
                            type="text"
                            placeholder="Filter invoice, customer, SO..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs w-full sm:w-64 focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
                        />
                    </div>
                </div>

                {/* Data Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold select-none">
                                <th className="py-3 px-6 whitespace-nowrap">Invoice #</th>
                                <th className="py-3 px-6 whitespace-nowrap">Customer</th>
                                <th className="py-3 px-6 whitespace-nowrap">Linked SO</th>
                                <th className="py-3 px-6 whitespace-nowrap">Invoice Date</th>
                                <th className="py-3 px-6 whitespace-nowrap">Status</th>
                                <th className="py-3 px-6 text-right whitespace-nowrap">Total</th>
                                <th className="py-3 px-6 text-right whitespace-nowrap">Balance Due</th>
                                <th className="py-3 px-4 text-center whitespace-nowrap">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {paginatedInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-slate-400">
                                        No sales invoices match the current filter.
                                    </td>
                                </tr>
                            ) : (
                                paginatedInvoices.map((inv) => {
                                    const outstanding = getInvoiceOutstanding(inv.id);
                                    const isDraft = inv.status === 'Draft' || !inv.finalized;
                                    return (
                                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="py-2.5 px-6 font-mono font-bold text-blue-600">
                                                <button onClick={() => setSelectedInvoice(inv)} className="hover:underline text-left cursor-pointer flex items-center gap-1">
                                                    {isDraft && <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1 py-0.2 rounded border border-amber-200">DRAFT</span>}
                                                    <span>{inv.invoiceNumber}</span>
                                                </button>
                                            </td>
                                            <td className="py-2.5 px-6 font-semibold text-slate-800">
                                                {inv.customer}
                                            </td>
                                            <td className="py-2.5 px-6 text-slate-500 font-mono text-[11px]">
                                                {inv.linkedSo || '-'}
                                            </td>
                                            <td className="py-2.5 px-6 text-slate-600 font-mono text-[11px]">
                                                {formatDateDDMMYYYY(inv.date)}
                                            </td>
                                            <td className="py-2.5 px-6">
                                                <StatusBadge status={inv.status}/>
                                            </td>
                                            <td className="py-2.5 px-6 text-right font-semibold text-slate-900 font-mono">
                                                {formatCurrency(inv.total)}
                                            </td>
                                            <td className="py-2.5 px-6 text-right font-mono font-bold">
                                                {isDraft ? (
                                                    <span className="text-slate-400 italic">Unposted</span>
                                                ) : (
                                                    <span className={outstanding.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-700'}>
                                                        {formatCurrency(outstanding.balanceDue)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => setSelectedInvoice(inv)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer" title="View Invoice">
                                                        <Eye className="w-4 h-4"/>
                                                    </button>
                                                    {inv.status !== 'Cancelled' && !invoiceHasChallan(inv) && (
                                                        <button onClick={() => handleConvertToChallan(inv)} className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold cursor-pointer inline-flex items-center gap-1 transition-colors" title="Convert to Delivery Challan">
                                                            <Truck className="w-3 h-3"/> Challan
                                                        </button>
                                                    )}
                                                    
                                                    {isDraft ? (
                                                        <>
                                                            <button onClick={() => handleOpenEditDraft(inv)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors cursor-pointer" title="Edit Draft Items/Rates">
                                                                <Edit className="w-4 h-4"/>
                                                            </button>
                                                            <button onClick={() => setFinalizeModalTarget(inv)} className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors shadow-2xs">
                                                                Finalize
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => setPrintInvoiceTarget(inv)} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer" title="Print Official Tax Invoice">
                                                                <Printer className="w-4 h-4"/>
                                                            </button>
                                                            {inv.status !== 'Cancelled' && outstanding.balanceDue > 0.01 && (
                                                                <button onClick={() => handleQuickSettleAndReceipt(inv)} className="px-2 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs inline-flex items-center gap-1 transition-colors cursor-pointer" title="1-Click Settle & Print Payment Receipt">
                                                                    <Zap className="w-3 h-3"/> Settle
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Standard Table Pagination Footer */}
                <TablePagination
                    total={filteredInvoices.length}
                    page={currentPage}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setCurrentPage(1);
                    }}
                    pageSizeOptions={[10, 25, 50, 100]}
                />
            </div>

            {/* CREATE / EDIT DRAFT INVOICE MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full p-4 sm:p-6 text-xs max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">
                                    {editingDraftTarget ? `Edit Draft Invoice ${editingDraftTarget.invoiceNumber}` : 'Issue Commercial Tax Invoice'}
                                </h2>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Draft invoices can be freely modified before commercial locking and financial ledger posting.
                                </p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1">
                                <X size={18}/>
                            </button>
                        </div>

                        <div className="p-2 space-y-4 overflow-y-auto flex-1 my-2 pr-1">
                            {/* Top Form Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <label className="font-semibold text-slate-700">Customer Account *</label>
                                        <MasterSourceLink source="customers" />
                                    </div>
                                    <select
                                        value={selectedCustomerId}
                                        onChange={(e) => handleCustomerChange(e.target.value)}
                                        className="border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 font-medium"
                                    >
                                        {customers.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({c.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="font-semibold text-slate-700">Source Proforma (PI)</label>
                                    <select value={linkedPiId} onChange={(e) => handlePiSelect(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 font-medium">
                                        <option value="None">None (Direct Invoicing)</option>
                                        {proformaInvoices.map((pi) => (
                                            <option key={pi.id} value={pi.id}>
                                                {pi.proformaNumber || pi.piNumber} - {pi.customer} ({formatCurrency(pi.grandTotal || pi.total || 0)})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="font-semibold text-slate-700">Linked Sales Order</label>
                                    <select value={linkedSoId} onChange={(e) => handleSoSelect(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800 font-medium">
                                        <option value="None">None (Direct Invoicing)</option>
                                        {salesOrders.map((so) => (
                                            <option key={so.id} value={so.id}>
                                                {so.orderNumber} - {so.customer} ({formatCurrency(so.amount || 0)})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="font-semibold text-slate-700">Invoice Issue Date</label>
                                    <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800"/>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="font-semibold text-slate-700">Payment Due Date</label>
                                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800"/>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <label className="font-semibold text-slate-700">Salesperson</label>
                                        <MasterSourceLink source="employees" />
                                    </div>
                                    <SalespersonSelect value={salesperson.id} name={salesperson.name} onChange={setSalesperson} className="border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-800"/>
                                </div>
                            </div>

                            {/* BILL TO & SHIP TO ADDRESS SECTION */}
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
                                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <MapPin size={14} className="text-blue-600"/> Bill To & Ship To Address Snapshots
                                    </h4>
                                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={sameAsBilling}
                                            onChange={(e) => {
                                                setSameAsBilling(e.target.checked);
                                                if (e.target.checked) setShippingAddress({ ...billingAddress });
                                            }}
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        Same as Billing Address
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    {/* Billing Address */}
                                    <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="font-bold text-slate-700 block uppercase text-[10px] text-muted">Bill To (Billing Address)</span>
                                        <input
                                            type="text"
                                            placeholder="Address Line 1"
                                            value={billingAddress.line1 || ''}
                                            onChange={(e) => {
                                                const updated = { ...billingAddress, line1: e.target.value };
                                                setBillingAddress(updated);
                                                if (sameAsBilling) setShippingAddress(updated);
                                            }}
                                            className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-800 text-xs"
                                        />
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            <input
                                                type="text"
                                                placeholder="City"
                                                value={billingAddress.city || ''}
                                                onChange={(e) => {
                                                    const updated = { ...billingAddress, city: e.target.value };
                                                    setBillingAddress(updated);
                                                    if (sameAsBilling) setShippingAddress(updated);
                                                }}
                                                className="p-1.5 border border-slate-300 rounded bg-white text-slate-800 text-xs"
                                            />
                                            <input
                                                type="text"
                                                placeholder="State"
                                                value={billingAddress.state || ''}
                                                onChange={(e) => {
                                                    const updated = { ...billingAddress, state: e.target.value };
                                                    setBillingAddress(updated);
                                                    if (sameAsBilling) setShippingAddress(updated);
                                                }}
                                                className="p-1.5 border border-slate-300 rounded bg-white text-slate-800 text-xs"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Pincode"
                                                value={billingAddress.pincode || ''}
                                                onChange={(e) => {
                                                    const updated = { ...billingAddress, pincode: e.target.value };
                                                    setBillingAddress(updated);
                                                    if (sameAsBilling) setShippingAddress(updated);
                                                }}
                                                className="p-1.5 border border-slate-300 rounded bg-white text-slate-800 text-xs"
                                            />
                                        </div>
                                    </div>

                                    {/* Shipping Address */}
                                    <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="font-bold text-slate-700 block uppercase text-[10px] text-muted">Ship To (Delivery Address)</span>
                                        <input
                                            type="text"
                                            placeholder="Shipping Address Line 1"
                                            disabled={sameAsBilling}
                                            value={sameAsBilling ? billingAddress.line1 : (shippingAddress.line1 || '')}
                                            onChange={(e) => setShippingAddress({ ...shippingAddress, line1: e.target.value })}
                                            className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-800 text-xs disabled:bg-slate-100 disabled:text-slate-500"
                                        />
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            <input
                                                type="text"
                                                placeholder="City"
                                                disabled={sameAsBilling}
                                                value={sameAsBilling ? billingAddress.city : (shippingAddress.city || '')}
                                                onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                                                className="p-1.5 border border-slate-300 rounded bg-white text-slate-800 text-xs disabled:bg-slate-100 disabled:text-slate-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="State"
                                                disabled={sameAsBilling}
                                                value={sameAsBilling ? billingAddress.state : (shippingAddress.state || '')}
                                                onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                                                className="p-1.5 border border-slate-300 rounded bg-white text-slate-800 text-xs disabled:bg-slate-100 disabled:text-slate-500"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Pincode"
                                                disabled={sameAsBilling}
                                                value={sameAsBilling ? billingAddress.pincode : (shippingAddress.pincode || '')}
                                                onChange={(e) => setShippingAddress({ ...shippingAddress, pincode: e.target.value })}
                                                className="p-1.5 border border-slate-300 rounded bg-white text-slate-800 text-xs disabled:bg-slate-100 disabled:text-slate-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Line Items Editor */}
                            <div>
                                <label className="text-xs font-semibold text-slate-800 block mb-2">Invoice Line Items</label>
                                <LineItemEditor items={lineItems} onChange={setLineItems} type="sales"/>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                                    Payment Terms & Commercial Notes
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="e.g. Standard Net 30 terms. Remit payment to Chase Operating Account..."
                                    className="w-full border border-slate-300 rounded-xl p-3 text-xs bg-white h-16 text-slate-800"
                                />
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="pt-3 border-t border-slate-200 flex flex-wrap lg:flex-nowrap justify-end gap-2 bg-slate-50 -mx-4 -mb-4 px-4 sm:-mx-6 sm:-mb-6 sm:px-6 py-3">
                            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-100 transition-colors text-xs cursor-pointer">
                                Cancel
                            </button>
                            <button onClick={() => handleSaveInvoice('Draft')} className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-colors text-xs cursor-pointer">
                                {editingDraftTarget ? 'Save Draft Changes' : 'Save as Draft'}
                            </button>
                            {!editingDraftTarget && (
                                <>
                                    <button onClick={() => handleSaveInvoice('Unpaid')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-xs shadow-sm cursor-pointer">
                                        Finalize Invoice (Unpaid)
                                    </button>
                                    <button onClick={() => handleSaveInvoice('Paid')} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors text-xs shadow-sm flex items-center gap-1.5 cursor-pointer">
                                        <CheckCircle2 className="w-3.5 h-3.5"/>
                                        Finalize & Record Full Payment
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* INVOICE DETAIL MODAL */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pb-3 border-b border-slate-200">
                            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-3 min-w-0 lg:min-w-auto">
                                <h3 className="font-bold text-lg text-[#1F2E4A] flex items-center gap-1.5">
                                    {selectedInvoice.invoiceNumber}
                                    {selectedInvoice.finalized && <Lock size={13} className="text-slate-400" title="Finalized Commercial Document"/>}
                                </h3>
                                <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded">
                                    {selectedInvoice.customer}
                                </span>
                                <StatusBadge status={selectedInvoice.status}/>
                            </div>
                            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                                {selectedInvoice.status !== 'Cancelled' && !invoiceHasChallan(selectedInvoice) && (
                                    <button onClick={() => handleConvertToChallan(selectedInvoice)} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer" title="Convert to Delivery Challan">
                                        <Truck size={13}/>
                                        Convert to Delivery Challan
                                    </button>
                                )}
                                <button onClick={() => setPrintInvoiceTarget(selectedInvoice)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer">
                                    <Printer size={13}/>
                                    Print Official Invoice
                                </button>
                                <button onClick={() => setSelectedInvoice(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer">
                                    <X size={18}/>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6 mt-4 overflow-y-auto pr-1 flex-1">
                            {/* Stepper */}
                            <DocumentTimeline steps={getInvoiceTimelineSteps(selectedInvoice)}/>

                            {/* Address Snapshots */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                                <div>
                                    <span className="font-bold text-slate-700 uppercase text-[10px] text-muted block">Billed To (Snapshot)</span>
                                    <p className="font-semibold text-slate-800">{selectedInvoice.customer}</p>
                                    <p className="text-slate-600">{selectedInvoice.billingAddress?.line1 || 'Headquarters'}</p>
                                    <p className="text-slate-600">{selectedInvoice.billingAddress?.city || 'Mumbai'}, {selectedInvoice.billingAddress?.state || 'Maharashtra'} {selectedInvoice.billingAddress?.pincode}</p>
                                </div>
                                <div>
                                    <span className="font-bold text-slate-700 uppercase text-[10px] text-muted block">Shipped To (Snapshot)</span>
                                    <p className="font-semibold text-slate-800">{selectedInvoice.customer}</p>
                                    <p className="text-slate-600">{selectedInvoice.shippingAddress?.line1 || selectedInvoice.billingAddress?.line1 || 'Destination Facility'}</p>
                                    <p className="text-slate-600">{selectedInvoice.shippingAddress?.city || selectedInvoice.billingAddress?.city || 'Mumbai'}, {selectedInvoice.shippingAddress?.state || selectedInvoice.billingAddress?.state || 'Maharashtra'} {selectedInvoice.shippingAddress?.pincode}</p>
                                </div>
                            </div>

                            {/* E-INVOICE & E-WAY BILL PANEL (Simulated §2) */}
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                                    <div className="flex items-center gap-2">
                                        <Zap size={14} className="text-amber-600" />
                                        <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
                                            E-Invoice & E-Way Bill Integration
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                            Simulated (NIC Sandbox)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {einvoiceLoading && (
                                            <span className="text-slate-400 font-medium text-[11px]">Processing...</span>
                                        )}
                                    </div>
                                </div>

                                {einvoiceFeedback && (
                                    <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                                        einvoiceFeedback.type === 'success' 
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                            : 'bg-rose-50 border-rose-200 text-rose-800'
                                    }`}>
                                        <span>{einvoiceFeedback.text}</span>
                                        <button type="button" onClick={() => setEinvoiceFeedback(null)} className="p-0.5 hover:opacity-70"><X size={12} /></button>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* IRN Section */}
                                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-700 text-[11px]">INVOICE REFERENCE NUMBER (IRN)</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                selectedInvoice.einvoiceStatus === 'Cancelled'
                                                    ? 'bg-rose-100 text-rose-800'
                                                    : (selectedInvoice.irn || selectedInvoice.einvoiceStatus === 'Generated')
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {selectedInvoice.einvoiceStatus || (selectedInvoice.irn ? 'Generated' : 'Not Generated')}
                                            </span>
                                        </div>

                                        {selectedInvoice.irn && selectedInvoice.einvoiceStatus !== 'Cancelled' ? (
                                            <div className="space-y-1.5">
                                                <p className="font-mono text-[10px] bg-slate-50 p-1.5 rounded border border-slate-200 break-all select-all text-slate-800">
                                                    {selectedInvoice.irn}
                                                </p>
                                                <div className="flex justify-between text-[11px] text-slate-500">
                                                    <span>Ack No: <strong className="text-slate-700 font-mono">{selectedInvoice.ackNo || selectedInvoice.ack_no || '—'}</strong></span>
                                                    <span>Ack Date: <strong className="text-slate-700">{selectedInvoice.ackDate || selectedInvoice.ack_date ? new Date(selectedInvoice.ackDate || selectedInvoice.ack_date).toLocaleDateString() : '—'}</strong></span>
                                                </div>
                                                <div className="pt-1 flex justify-end">
                                                    <button
                                                        type="button"
                                                        disabled={einvoiceLoading}
                                                        onClick={() => setShowCancelIrnModal(true)}
                                                        className="px-2.5 py-1 border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded text-[11px] cursor-pointer"
                                                    >
                                                        Cancel IRN
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <p className="text-[11px] text-slate-500">
                                                    {selectedInvoice.status === 'Draft' 
                                                        ? 'Invoice must be finalized before generating IRN.' 
                                                        : selectedInvoice.einvoiceStatus === 'Cancelled'
                                                            ? 'This IRN has been cancelled.'
                                                            : 'Generate statutory e-invoice QR code & 64-character IRN hash.'}
                                                </p>
                                                {selectedInvoice.status !== 'Draft' && selectedInvoice.einvoiceStatus !== 'Cancelled' && (
                                                    <button
                                                        type="button"
                                                        disabled={einvoiceLoading}
                                                        onClick={handleGenerateIrn}
                                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg text-[11px] shadow-xs cursor-pointer flex items-center gap-1.5"
                                                    >
                                                        <Zap size={12} /> Generate IRN (Simulated)
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* E-Way Bill Section */}
                                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-700 text-[11px]">E-WAY BILL NUMBER</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                selectedInvoice.ewayBillNumber || selectedInvoice.eway_bill_number
                                                    ? 'bg-indigo-100 text-indigo-800'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {selectedInvoice.ewayBillNumber || selectedInvoice.eway_bill_number ? 'Generated' : 'Not Generated'}
                                            </span>
                                        </div>

                                        {(selectedInvoice.ewayBillNumber || selectedInvoice.eway_bill_number) ? (
                                            <div className="space-y-1.5">
                                                <p className="font-mono text-sm font-bold text-indigo-900 bg-indigo-50/50 p-2 rounded border border-indigo-100">
                                                    #{selectedInvoice.ewayBillNumber || selectedInvoice.eway_bill_number}
                                                </p>
                                                <div className="flex justify-between text-[11px] text-slate-500">
                                                    <span>Generated: <strong className="text-slate-700">{selectedInvoice.ewayBillDate || selectedInvoice.eway_bill_date ? new Date(selectedInvoice.ewayBillDate || selectedInvoice.eway_bill_date).toLocaleDateString() : '—'}</strong></span>
                                                    <span>Valid: <strong className="text-slate-700">{selectedInvoice.ewayBillValidUntil || selectedInvoice.eway_bill_valid_until ? new Date(selectedInvoice.ewayBillValidUntil || selectedInvoice.eway_bill_valid_until).toLocaleDateString() : 'Active'}</strong></span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <p className="text-[11px] text-slate-500">
                                                    {selectedInvoice.status === 'Draft' 
                                                        ? 'Invoice must be finalized before generating E-Way Bill.' 
                                                        : 'Generate statutory 12-digit E-Way Bill number for transport manifest.'}
                                                </p>
                                                {selectedInvoice.status !== 'Draft' && (
                                                    <button
                                                        type="button"
                                                        disabled={einvoiceLoading}
                                                        onClick={handleGenerateEwayBill}
                                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg text-[11px] shadow-xs cursor-pointer flex items-center gap-1.5"
                                                    >
                                                        <Zap size={12} /> Generate E-Way Bill (Simulated)
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Related Docs */}
                            <RelatedDocumentsCard documents={getInvoiceRelatedDocs(selectedInvoice)}/>

                            {/* Items */}
                            <div className="space-y-2">
                                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
                                    <h4 className="font-bold text-slate-700 uppercase tracking-wider text-xs">
                                        Invoiced Line Items ({selectedInvoice.items?.length || 0})
                                    </h4>
                                    {selectedInvoice.finalized && (
                                        <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                                            <Lock size={11}/> Locked Commercial Instrument
                                        </span>
                                    )}
                                </div>
                                <LineItemEditor items={selectedInvoice.items || []} onChange={() => { }} readOnly={true}/>
                            </div>
                        </div>

                        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-4 border-t border-slate-200 bg-slate-50 -mx-4 -mb-4 px-4 sm:-mx-6 sm:-mb-6 sm:px-6 py-3">
                            <div className="font-mono text-xs">
                                Total: <strong className="text-slate-900">{formatCurrency(selectedInvoice.total)}</strong> | Paid: <strong className="text-emerald-700">{formatCurrency(selectedInvoice.paidAmount || 0)}</strong>
                            </div>
                            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                                {(!selectedInvoice.finalized || selectedInvoice.status === 'Draft') && (
                                    <>
                                        <button
                                            onClick={() => {
                                                const target = selectedInvoice;
                                                setSelectedInvoice(null);
                                                handleOpenEditDraft(target);
                                            }}
                                            className="px-3 py-1.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg font-semibold text-xs flex items-center gap-1 cursor-pointer"
                                        >
                                            <Edit size={12}/> Edit Draft Items
                                        </button>
                                        <button
                                            onClick={() => {
                                                setFinalizeModalTarget(selectedInvoice);
                                            }}
                                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs flex items-center gap-1 cursor-pointer"
                                        >
                                            <Check size={12}/> Finalize Invoice
                                        </button>
                                    </>
                                )}

                                {selectedInvoice.status !== 'Cancelled' && (
                                    <button
                                        onClick={() => setCancelModalTarget(selectedInvoice)}
                                        className="px-3 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-semibold text-xs flex items-center gap-1 cursor-pointer"
                                    >
                                        <Ban size={12}/> Cancel Invoice
                                    </button>
                                )}

                                {selectedInvoice.status !== 'Cancelled' && getInvoiceOutstanding(selectedInvoice.id).balanceDue > 0.01 && (
                                    <button onClick={() => {
                                        setShowPaymentModal(selectedInvoice);
                                        setPayAmount(getInvoiceOutstanding(selectedInvoice.id).balanceDue);
                                    }} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer">
                                        <DollarSign className="w-3.5 h-3.5"/> Settle Payment
                                    </button>
                                )}

                                {selectedInvoice.status !== 'Cancelled' && !invoiceHasChallan(selectedInvoice) && (
                                    <button
                                        onClick={() => handleConvertToChallan(selectedInvoice)}
                                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs flex items-center gap-1 cursor-pointer"
                                        title="Convert to Delivery Challan"
                                    >
                                        <Truck size={12}/> Convert to Delivery Challan
                                    </button>
                                )}
                                <button onClick={() => setSelectedInvoice(null)} className="px-4 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CANCEL IRN MODAL */}
            {showCancelIrnModal && (
                <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
                    <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl text-xs space-y-3">
                        <h3 className="font-bold text-base text-[#1F2E4A]">Cancel E-Invoice IRN?</h3>
                        <p className="text-slate-600 text-xs">
                            Statutory cancellation allows revoking this IRN within 24 hours of generation. Please confirm the reason:
                        </p>
                        <select
                            value={cancelIrnRemarks}
                            onChange={(e) => setCancelIrnRemarks(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-xs"
                        >
                            <option value="Data Entry Error">1 - Data Entry Error</option>
                            <option value="Duplicate Generation">2 - Duplicate Generation</option>
                            <option value="Order Cancelled">3 - Order Cancelled</option>
                            <option value="Other">4 - Other</option>
                        </select>
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setShowCancelIrnModal(false)}
                                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-slate-700 cursor-pointer"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                disabled={einvoiceLoading}
                                onClick={handleConfirmCancelIrn}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
                            >
                                {einvoiceLoading ? 'Cancelling...' : 'Confirm Cancel IRN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FINALIZE CONFIRMATION MODAL */}
            {finalizeModalTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-6 text-xs flex flex-col max-h-[95vh] overflow-y-auto">
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                            <CheckCircle2 className="w-5 h-5 text-blue-600"/>
                            <h3 className="font-bold text-base text-[#1F2E4A]">Finalize Sales Invoice?</h3>
                        </div>

                        <div className="py-4 space-y-2 text-slate-600">
                            <p className="font-semibold text-slate-800">After finalization:</p>
                            <ul className="list-disc list-inside space-y-1 text-slate-600">
                                <li>Invoice becomes a final commercial document</li>
                                <li>Financial records (AR & GL) will be officially posted</li>
                                <li>Inventory stock will be deducted if direct fulfillment</li>
                                <li>Direct item and rate editing will be locked</li>
                            </ul>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                            <Button variant="outline" onClick={() => setFinalizeModalTarget(null)}>
                                Back
                            </Button>
                            <button
                                type="button"
                                onClick={handleConfirmFinalize}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm cursor-pointer"
                            >
                                Finalize Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CANCEL INVOICE MODAL */}
            {cancelModalTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-6 text-xs flex flex-col max-h-[95vh] overflow-y-auto">
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                            <ShieldAlert className="w-5 h-5 text-rose-600"/>
                            <h3 className="font-bold text-base text-[#1F2E4A]">Cancel Invoice {cancelModalTarget.invoiceNumber}?</h3>
                        </div>

                        {errorMessage ? (
                            <div className="my-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                                <AlertCircle size={16} className="shrink-0 text-rose-600"/>
                                <span>{errorMessage}</span>
                            </div>
                        ) : (
                            <div className="py-4 space-y-2 text-slate-600">
                                <p className="font-semibold text-slate-800">This action will:</p>
                                <ul className="list-disc list-inside space-y-1 text-slate-600">
                                    <li>Reverse Accounts Receivable and customer balance ({formatCurrency(cancelModalTarget.total)})</li>
                                    <li>Post reversal journal entry to General Ledger</li>
                                    {(!cancelModalTarget.dispatchedViaChallan) && (
                                        <li>Reverse inventory stock movement exactly once</li>
                                    )}
                                    <li>Mark invoice as <strong className="text-rose-600">Cancelled</strong></li>
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                            <Button variant="outline" onClick={() => { setCancelModalTarget(null); setErrorMessage(''); }}>
                                Keep Invoice
                            </Button>
                            {!errorMessage && (
                                <button
                                    type="button"
                                    onClick={handleConfirmCancelInvoice}
                                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-sm cursor-pointer"
                                >
                                    Cancel Invoice & Reverse
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* RECORD PAYMENT IN MODAL */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
                    <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[95vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-emerald-600"/>
                                <h3 className="font-bold text-base text-slate-900">Receive Customer Payment</h3>
                            </div>
                            <button onClick={() => setShowPaymentModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                <X size={18}/>
                            </button>
                        </div>
                        <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 mt-4">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Customer:</span>
                                    <span className="font-bold text-slate-800">{showPaymentModal.customer}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Invoice #:</span>
                                    <span className="font-mono font-bold text-slate-800">{showPaymentModal.invoiceNumber}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Total Invoiced:</span>
                                    <span className="font-mono font-bold text-slate-900">{formatCurrency(showPaymentModal.total)}</span>
                                </div>
                                <div className="flex justify-between text-emerald-700">
                                    <span>Paid So Far:</span>
                                    <span className="font-mono font-semibold">{formatCurrency(getInvoiceOutstanding(showPaymentModal.id).paid)}</span>
                                </div>
                                <div className="flex justify-between text-rose-600 font-semibold border-t border-slate-200 pt-1">
                                    <span>Balance Due:</span>
                                    <span className="font-mono">{formatCurrency(getInvoiceOutstanding(showPaymentModal.id).balanceDue)}</span>
                                </div>
                                {payAmount > 0 && (
                                    <div className="flex justify-between text-indigo-700 font-semibold border-t border-slate-200 pt-1">
                                        <span>Remaining After Payment:</span>
                                        <span className="font-mono">{formatCurrency(Math.max(0, getInvoiceOutstanding(showPaymentModal.id).balanceDue - payAmount))}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="font-semibold text-slate-700 block mb-1">Receipt Amount *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    max={getInvoiceOutstanding(showPaymentModal.id).balanceDue}
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(Number(e.target.value))}
                                    required
                                    className="w-full p-2 border border-slate-300 rounded bg-white text-slate-900 font-mono font-bold text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="font-semibold text-slate-700 block mb-1">Payment Mode</label>
                                    <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800">
                                        <option value="Bank Transfer">Bank Transfer / Wire</option>
                                        <option value="Corporate Card">Corporate Card</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Cash">Cash</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="font-semibold text-slate-700 block mb-1">Transaction Ref #</label>
                                    <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="WIRE-99214" className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-mono"/>
                                </div>
                            </div>

                            <div className="flex flex-wrap lg:flex-nowrap justify-end gap-2 pt-3 border-t border-slate-200">
                                <button type="button" onClick={() => setShowPaymentModal(null)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded hover:bg-slate-100 font-medium cursor-pointer">
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shadow-sm cursor-pointer">
                                    Post Payment & Settle Invoice
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Instant Settle Payment Receipt Modal */}
            <PaymentReceiptModal receipt={activeReceipt} onClose={() => setActiveReceipt(null)}/>

            {/* Official Printable Commercial Tax Invoice Document */}
            <PrintInvoiceModal isOpen={Boolean(printInvoiceTarget)} onClose={() => setPrintInvoiceTarget(null)} invoice={printInvoiceTarget} balanceDue={printInvoiceTarget ? getInvoiceOutstanding(printInvoiceTarget.id).balanceDue : 0}/>
        </div>
    );
};
