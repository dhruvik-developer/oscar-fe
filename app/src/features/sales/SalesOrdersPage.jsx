import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Boxes, Plus, ShoppingCart, CheckCircle, Truck, Receipt, X, ShieldAlert, Copy, Printer, DollarSign, Clock, CheckCircle2, Maximize2, Minimize2, FileSpreadsheet, Ban, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LineItemEditor } from '../../components/common/LineItemEditor';
import { DocumentTimeline } from '../../components/common/DocumentTimeline';
import { RelatedDocumentsCard } from '../../components/common/RelatedDocumentsCard';
import { AutoPOModal } from '../../components/common/AutoPOModal';
import { PageHeader } from '../../components/common/PageHeader';
import { PrintSalesOrderModal } from '../../components/common/PrintSalesOrderModal';
import PickingListModal from './orders/PickingListModal';
import SalespersonSelect from '../../components/common/SalespersonSelect';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import { usePmsStore } from '../../stores/pmsStore';
import { CreateProjectModal } from '../pms/projects/components/CreateProjectModal';
const salesOrderGuide = {
    title: 'Sales Orders',
    subtitle: 'Customer purchase agreements driving warehouse reservation, proforma billing, and dispatch.',
    purpose: 'A Sales Order (SO) represents a legally confirmed customer commitment to purchase goods or services. Once confirmed, it can generate an optional Proforma Invoice for advance payment milestone collection, reserves inventory in the warehouse, triggers a Delivery Challan for dispatch, and subsequently issues a commercial Sales Invoice.',
    keyTerms: [
        { term: 'Sales Order (SO)', definition: 'A confirmed commercial agreement between your business and the customer before dispatch.' },
        { term: 'Proforma Invoice (Optional)', definition: 'A preliminary commercial offer/demand for payment issued before final tax invoicing to secure advance milestones without affecting AR/GL.' },
        { term: 'Credit Limit Guard', definition: 'An enterprise safety check that ensures a customer\'s current debt plus new order does not exceed their approved threshold.' },
        { term: 'Inventory Reservation', definition: 'Stock committed to this order so it cannot be double-sold to another customer.' },
        { term: 'SO Lifecycle', definition: 'The flexible progression: Draft → Confirmed → Proforma (Optional) → Partially / Fully Dispatched (Challan) → Invoiced → Closed. Only dispatched quantity can be invoiced.' },
    ],
    tips: [
        'Use the 📋 Clone button on any past order to duplicate customer and line items in 1 click.',
        'Click "Generate Proforma" to create a non-accounting preliminary invoice with custom payment milestones for advance deposit collection.',
        'If stock is 0 or low, click [+PO] directly on the line item to requisition missing units immediately.',
    ],
    workflow: ['Quotation Approved', 'Sales Order Confirmed', 'Proforma Issued (Optional)', 'Delivery Challan Dispatched', 'Sales Invoice Issued', 'Payment Receipt Settled'],
};
export const SalesOrdersPage = () => {
    const navigate = useNavigate();
    const { showToast, salesOrders, customers, addSalesOrder, updateSalesOrderStage, cancelSalesOrder, convertSalesOrderToInvoice, convertSalesOrderToChallan, addProformaInvoice, proformaInvoices = [], deliveryChallans, invoices, paymentIns, formatCurrency, formatDateDDMMYYYY, getCurrentISODate, addDaysISO } = useERP();
    const pmsProjects = usePmsStore((s) => s.projects || []);
    const [pmsModalOrder, setPmsModalOrder] = useState(null);
    const [stageFilter, setStageFilter] = useState('All');
    const [showAddModal, setShowAddModal] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [pickingListOrder, setPickingListOrder] = useState(null);
    const [printSalesOrderTarget, setPrintSalesOrderTarget] = useState(null);
    const [cancelModalTarget, setCancelModalTarget] = useState(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
    const [deliveryDate, setDeliveryDate] = useState(() => addDaysISO(getCurrentISODate(), 10));
    const [lineItems, setLineItems] = useState([]);
    const [salesperson, setSalesperson] = useState({ id: '', name: '' });
    // Auto-PO Requisition Modal State
    const [autoPOState, setAutoPOState] = useState({ isOpen: false });
    const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
    const totalAmt = lineItems.reduce((acc, it) => acc + (it.amount || it.qty * it.rate), 0);
    // No limit configured on the customer -> no credit check (the server enforces it on confirm).
    const creditLimit = Number(selectedCustomer?.creditLimit) || 0;
    const isCreditExceeded = selectedCustomer && creditLimit > 0 ? (Number(selectedCustomer.balance || 0) + totalAmt) > creditLimit : false;

    const handleOpenCreateModal = () => {
        setSelectedCustomerId(customers[0]?.id || '');
        setDeliveryDate(addDaysISO(getCurrentISODate(), 10));
        setLineItems([]);
        setSalesperson({ id: '', name: '' });
        setIsFullscreen(false);
        setShowAddModal(true);
    };

    const handleCloseCreateModal = () => {
        setShowAddModal(false);
        setSelectedCustomerId(customers[0]?.id || '');
        setDeliveryDate(addDaysISO(getCurrentISODate(), 10));
        setLineItems([]);
        setSalesperson({ id: '', name: '' });
        setIsFullscreen(false);
    };

    const handleCloneOrder = (order) => {
        setSelectedCustomerId(order.customerId || customers[0]?.id || '');
        setDeliveryDate(order.deliveryDate || addDaysISO(getCurrentISODate(), 10));
        setSalesperson({ id: order.salespersonId || '', name: order.salesperson || order.salesPerson || '' });
        setLineItems((order.items || []).map((it) => ({
            ...it,
            id: `li-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        })));
        setIsFullscreen(false);
        setShowAddModal(true);
    };
    const handleCreate = (e) => {
        e.preventDefault();
        const cust = selectedCustomer;
        if (!cust) return;
        addSalesOrder({
            customerId: cust.id,
            customer: cust.name,
            amount: totalAmt > 0 ? totalAmt : 0,
            deliveryDate: deliveryDate || addDaysISO(getCurrentISODate(), 10),
            stage: 'Draft',
            status: 'Draft',
            paymentStatus: 'Unpaid',
            items: lineItems,
            salespersonId: salesperson.id,
            salesperson: salesperson.name,
        });
        handleCloseCreateModal();
    };
    const advanceStage = (orderId, currentStage) => {
        if (currentStage === 'Draft') {
            updateSalesOrderStage(orderId, 'Confirmed');
        }
        else if (currentStage === 'Confirmed' || currentStage === 'Partially Dispatched') {
            convertSalesOrderToChallan(orderId);
            navigate('/sales/delivery');
        }
        else if (currentStage === 'Fully Dispatched') {
            convertSalesOrderToInvoice(orderId);
            navigate('/sales/invoices');
        }
    };
    const orderHasInvoice = (order) => {
        if (!order) return false;
        if (order.stage === 'Invoiced') return true;
        return (invoices || []).some(inv => 
            inv.status !== 'Cancelled' && (
                (order.id && inv.salesOrderId === order.id) ||
                (order.orderNumber && (inv.salesOrderNumber === order.orderNumber || inv.linkedSo === order.orderNumber || inv.salesOrderRef === order.orderNumber))
            )
        );
    };

    const orderHasChallan = (order) => {
        if (!order) return false;
        if (['Fully Dispatched', 'Invoiced'].includes(order.stage)) return true;
        return (deliveryChallans || []).some(dc =>
            dc.status !== 'Cancelled' && (
                (order.id && dc.salesOrderId === order.id) ||
                (order.orderNumber && (dc.salesOrderNumber === order.orderNumber || dc.linkedSo === order.orderNumber))
            )
        );
    };

    const filteredOrders = salesOrders.filter((o) => {
        if (stageFilter === 'All')
            return true;
        return o.stage === stageFilter;
    });
    const handleGenerateProforma = (order) => {
        const lines = order.items || order.lineItems || [];
        if (lines.length === 0) {
            showToast('This order has no lines to bill on a proforma.');
            return;
        }
        // Lines are copied from the order as saved on the server; the server
        // allocates the PI number and recomputes every total.
        const rawItems = lines.map((it, idx) => ({
            id: `pi-it-${Date.now()}-${idx}`,
            salesOrderLineId: it.id,
            itemId: it.itemId,
            sku: it.sku || it.itemSku,
            productName: it.itemName || it.name || it.description,
            description: it.description || it.itemName || it.name,
            qty: Number(it.qty),
            uom: it.uom,
            rate: Number(it.rate),
            unitPrice: Number(it.rate),
            discount: Number(it.discount ?? 0),
            tax: Number(it.tax ?? 0),
        }));
        addProformaInvoice({
            id: `pi-${Date.now()}`,
            piDate: getCurrentISODate(),
            customerId: order.customerId,
            customer: order.customer,
            billingAddress: order.billingAddress,
            shippingAddress: order.shippingAddress,
            referenceSo: order.orderNumber,
            salesOrderId: order.id,
            paymentTerms: order.paymentTerms,
            notes: `Proforma for Sales Order ${order.orderNumber}.`,
            status: 'Draft',
            items: rawItems,
            lineItems: rawItems,
        });
        navigate('/sales/proforma');
    };

    const getOrderTimelineSteps = (order) => {
        const isQuoteLinked = !!order.quotationNumber;
        const isConfirmed = order.stage !== 'Draft';
        const linkedPi = proformaInvoices.find((p) => p.referenceSo === order.orderNumber || p.salesOrderId === order.id);
        const isDispatched = ['Partially Dispatched', 'Fully Dispatched', 'Invoiced', 'Closed'].includes(order.stage);
        const isInvoiced = order.stage === 'Invoiced' || order.stage === 'Closed';
        const linkedInvoice = invoices.find((i) => i.salesOrderId === order.id || i.linkedSo === order.orderNumber);
        const isPaid = linkedInvoice?.status === 'Paid' || order.paymentStatus === 'Paid';
        return [
            {
                label: 'Quotation',
                docNumber: order.quotationNumber || 'Direct Order',
                status: isQuoteLinked ? 'completed' : 'completed',
            },
            {
                label: 'Sales Order',
                docNumber: order.orderNumber,
                date: order.date,
                amount: order.amount,
                status: isConfirmed ? 'completed' : 'current',
            },
            {
                label: 'Proforma (Optional)',
                docNumber: linkedPi?.piNumber || 'Advance Milestone',
                status: linkedPi ? 'completed' : isConfirmed ? 'current' : 'pending',
            },
            {
                label: 'Delivery Challan',
                docNumber: order.orderNumber ? `DC for ${order.orderNumber}` : undefined,
                status: isDispatched ? 'completed' : isConfirmed ? 'current' : 'pending',
            },
            {
                label: 'Sales Invoice',
                docNumber: linkedInvoice?.invoiceNumber,
                amount: linkedInvoice?.total,
                status: isInvoiced ? 'completed' : isDispatched ? 'current' : 'pending',
            },
            {
                label: 'Payment Settlement',
                status: isPaid ? 'completed' : isInvoiced ? 'current' : 'pending',
            },
        ];
    };
    const getOrderRelatedDocs = (order) => {
        const docs = [];
        if (order.quotationNumber) {
            docs.push({
                type: 'Quotation',
                number: order.quotationNumber,
                amount: order.amount,
                status: 'Converted',
            });
        }
        const relatedPis = proformaInvoices.filter((p) => p.referenceSo === order.orderNumber || p.salesOrderId === order.id);
        relatedPis.forEach((pi) => {
            docs.push({
                type: 'Proforma Invoice',
                number: pi.piNumber,
                amount: pi.grandTotal || pi.total,
                date: pi.piDate,
                status: pi.status,
            });
        });
        const challans = deliveryChallans.filter((c) => c.salesOrderId === order.id || c.salesOrderNumber === order.orderNumber || c.linkedSo === order.orderNumber);
        challans.forEach((c) => {
            docs.push({
                type: 'Delivery Challan',
                number: c.challanNumber,
                date: c.date,
                status: c.status,
            });
        });
        const invs = invoices.filter((i) => i.salesOrderId === order.id || i.linkedSo === order.orderNumber);
        invs.forEach((inv) => {
            docs.push({
                type: 'Invoice',
                number: inv.invoiceNumber,
                amount: inv.total,
                date: inv.date,
                status: inv.status,
            });
            const payments = paymentIns.filter((p) => p.invoiceId === inv.id || p.invoiceNumber === inv.invoiceNumber);
            payments.forEach((p) => {
                docs.push({
                    type: 'Payment',
                    number: p.receiptNumber,
                    amount: p.amount,
                    date: p.date,
                    status: 'Settled',
                });
            });
        });
        return docs;
    };
    const columns = [
        {
            key: 'orderNumber',
            header: 'Sales Order #',
            width: '14%',
            render: (o) => {
                const linkedPms = pmsProjects.find((p) => p.crmOrderId === o.orderNumber);
                return (
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setSelectedOrder(o)} className="font-mono font-bold text-primary hover:underline flex items-center gap-1.5 text-left cursor-pointer whitespace-nowrap">
                      <ShoppingCart size={13} className="text-muted"/> {o.orderNumber}
                    </button>
                    {linkedPms && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/pms/projects/${linkedPms.id}`); }}
                        className="font-mono text-[10px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit cursor-pointer transition-colors"
                        title={`View linked PMS Project ${linkedPms.code} (${linkedPms.status || 'Active'})`}
                      >
                        <Layers size={10} /> {linkedPms.code} ({linkedPms.overallCompletionPct ?? 0}%)
                      </button>
                    )}
                  </div>
                );
            },
        },
        {
            key: 'customer',
            header: 'Customer Account',
            width: '20%',
            render: (o) => <span className="font-bold text-text">{o.customer}</span>,
        },
        {
            key: 'date',
            header: 'SO Date',
            width: '11%',
            render: (o) => <span className="text-muted font-mono text-[11px] whitespace-nowrap">{formatDateDDMMYYYY(o.date)}</span>,
        },
        {
            key: 'deliveryDate',
            header: 'Target Delivery',
            width: '12%',
            render: (o) => <span className="text-muted font-mono text-[11px] whitespace-nowrap">{formatDateDDMMYYYY(o.deliveryDate)}</span>,
        },
        {
            key: 'amount',
            header: 'Order Value',
            align: 'right',
            width: '12%',
            render: (o) => (<span className="font-mono font-bold text-text whitespace-nowrap">
          {formatCurrency(o.amount ?? o.total ?? 0)}
        </span>),
        },
        {
            key: 'stage',
            header: 'Stage Lifecycle',
            align: 'center',
            width: '14%',
            render: (o) => {
                const stageVal = o.stage || o.status || 'Draft';
                return (
                  <div className="flex items-center justify-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      stageVal === 'Fully Dispatched' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      stageVal === 'Partially Dispatched' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      stageVal === 'Confirmed' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      stageVal === 'Invoiced' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      stageVal === 'Pending Approval' ? 'bg-orange-50 text-orange-700 border-orange-300' :
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }`} title={stageVal === 'Pending Approval' ? 'Discount or margin needs approval — see the approvals inbox' : undefined}>
                      {stageVal}
                    </span>
                  </div>
                );
            },
        },
        {
            key: 'paymentStatus',
            header: 'Payment Status',
            align: 'center',
            width: '10%',
            render: (o) => <StatusBadge status={o.paymentStatus || 'Unpaid'}/>,
        },
        {
            key: 'actions',
            header: 'Actions / Lifecycle',
            align: 'right',
            width: '18%',
            render: (o) => {
                const isCancelled = o.stage === 'Cancelled' || o.status === 'Cancelled';
                return (<div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            <button onClick={() => setPrintSalesOrderTarget(o)} className="p-1 text-muted hover:text-primary hover:bg-soft rounded-lg cursor-pointer transition-colors" title="Print Official Sales Order Confirmation">
              <Printer size={13}/>
            </button>
            <button onClick={() => setPickingListOrder({ id: o.id, orderNumber: o.orderNumber })} className="p-1 text-muted hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors" title="Warehouse Picking List">
              <Boxes size={13}/>
            </button>
            <button onClick={() => handleCloneOrder(o)} className="p-1 text-muted hover:text-primary hover:bg-soft rounded-lg cursor-pointer transition-colors" title="Clone / Duplicate this Sales Order">
              <Copy size={13}/>
            </button>
            {!isCancelled && (
              <button onClick={() => handleGenerateProforma(o)} className="p-1 text-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors" title="Generate Proforma Invoice for advance payment milestone collection">
                <FileSpreadsheet size={13}/>
              </button>
            )}

            {o.stage === 'Draft' && (<button onClick={() => advanceStage(o.id, 'Draft')} className="px-2.5 py-1 bg-primary text-white rounded-md text-xs font-semibold hover:bg-primary-hover cursor-pointer shadow-xs transition-colors whitespace-nowrap inline-flex items-center gap-1">
                Confirm Order
              </button>)}
            {o.stage === 'Pending Approval' && (
              <span className="px-2 py-1 text-[11px] font-semibold text-orange-700 whitespace-nowrap" title="Dispatch and invoicing unlock once the discount is approved">
                Awaiting approval
              </span>
            )}
            {o.stage === 'Confirmed' && !orderHasChallan(o) && (<>
                {!pmsProjects.some((p) => p.crmOrderId === o.orderNumber) && (
                  <button
                    onClick={() => setPmsModalOrder(o.orderNumber)}
                    className="px-2 py-1 bg-violet-600 text-white rounded-md text-xs font-semibold hover:bg-violet-700 cursor-pointer inline-flex items-center gap-1 shadow-xs transition-colors whitespace-nowrap"
                    title="Convert this Confirmed Sales Order into a PMS Production Project"
                  >
                    <Layers size={12}/> PMS Project
                  </button>
                )}
                <button onClick={() => advanceStage(o.id, 'Confirmed')} className="px-2.5 py-1 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 cursor-pointer inline-flex items-center gap-1 shadow-xs transition-colors whitespace-nowrap">
                  <Truck size={12}/> Issue Challan
                </button>
              </>)}
            {o.stage === 'Partially Dispatched' && (<button onClick={() => advanceStage(o.id, 'Partially Dispatched')} className="px-2.5 py-1 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 cursor-pointer inline-flex items-center gap-1 shadow-xs transition-colors whitespace-nowrap">
                <Truck size={12}/> Dispatch Remaining
              </button>)}
            {!isCancelled && o.stage !== 'Invoiced' && o.stage !== 'Closed' && !orderHasInvoice(o) && (
              <button
                onClick={async () => {
                  await convertSalesOrderToInvoice(o.id);
                  navigate('/sales/invoices');
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold cursor-pointer inline-flex items-center gap-1 shadow-xs transition-colors whitespace-nowrap"
                title="Convert this Sales Order into a Sales Invoice"
              >
                <Receipt size={12}/> Sales Invoice
              </button>
            )}
            {o.stage === 'Invoiced' && (<span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 whitespace-nowrap">
                <CheckCircle size={12}/> Fulfilled
              </span>)}
            {isCancelled && (<span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1 whitespace-nowrap">
                <Ban size={12}/> Cancelled
              </span>)}
            {!isCancelled && o.stage !== 'Invoiced' && o.stage !== 'Closed' && (
              <button
                onClick={() => setCancelModalTarget(o)}
                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                title="Cancel Sales Order"
              >
                <Ban size={13}/>
              </button>
            )}
          </div>);
            },
        },
    ];
    const totalSoValue = salesOrders.filter(o => o.stage !== 'Cancelled').reduce((acc, o) => acc + (o.amount ?? o.total ?? 0), 0);
    const confirmedValue = salesOrders.filter(o => ['Confirmed', 'Partially Dispatched', 'Fully Dispatched'].includes(o.stage)).reduce((acc, o) => acc + (o.amount ?? o.total ?? 0), 0);
    const openOrdersCount = salesOrders.filter(o => !['Invoiced', 'Closed', 'Cancelled'].includes(o.stage)).length;
    const fulfilledOrdersCount = salesOrders.filter(o => o.stage === 'Invoiced' || o.stage === 'Closed').length;

    return (<div className="space-y-6">
      <PageHeader title="Sales Orders" subtitle="Confirmed customer purchase agreements driving warehouse stock reservation, dispatch manifests, and automated invoicing." guide={salesOrderGuide} actions={<Button icon={Plus} onClick={handleOpenCreateModal}>
            Create Sales Order
          </Button>}/>

      {/* Sales Orders KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Booked Pipeline" value={formatCurrency(totalSoValue)} icon={DollarSign} />
        <StatCard label="Active In-Fulfillment" value={formatCurrency(confirmedValue)} icon={Truck} trend={{ positive: true, text: `${openOrdersCount} orders active` }} highlight={openOrdersCount > 0} />
        <StatCard label="Open Backlog Orders" value={`${openOrdersCount} Orders`} icon={Clock} subtext="Pending warehouse dispatch" />
        <StatCard label="Invoiced & Fulfilled" value={`${fulfilledOrdersCount} Completed`} icon={CheckCircle2} trend={{ positive: true, text: 'Invoices created' }} />
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-nowrap items-center gap-2 border-b border-[#CED4DA] pb-2 text-xs overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
        {['All', 'Draft', 'Pending Approval', 'Confirmed', 'Partially Dispatched', 'Fully Dispatched', 'Invoiced', 'Closed', 'Cancelled'].map((stg) => (<button key={stg} onClick={() => setStageFilter(stg)} className={`shrink-0 lg:shrink px-3 py-1.5 rounded-t font-semibold transition-colors ${stageFilter === stg
                ? 'bg-white border-t-2 border-[#1F2E4A] text-[#1F2E4A] shadow-sm'
                : 'text-slate-500 hover:text-slate-800'}`}>
            {stg}
          </button>))}
      </div>

      <DataTable title="Sales Order Register" data={filteredOrders} columns={columns} keyExtractor={(o) => o.id} searchPlaceholder="Search order number or customer..."/>

      {/* Create Modal */}
      {showAddModal && (
        <div className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center transition-all duration-200 ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
          <div className={`bg-white border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            isFullscreen ? 'w-full h-full rounded-none p-4 sm:p-8' : 'max-w-5xl w-full rounded-2xl p-4 sm:p-6 max-h-[92vh]'
          } text-xs`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">Create New Sales Order</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  title={isFullscreen ? "Exit Fullscreen" : "Maximize Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18}/>
                </button>
              </div>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 block">Customer Account *</label>
                    <MasterSourceLink source="customers" />
                  </div>
                  <select required value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-medium">
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) - Balance: ₹{c.balance.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  {selectedCustomer && (
                    <div className="mt-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>{selectedCustomer.name}</span>
                        <span className="text-blue-700 font-mono text-[10px] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          Credit Limit: {creditLimit > 0 ? `₹${creditLimit.toLocaleString('en-IN')}` : 'Not set'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600 text-[10px]">
                        <span>POC: <strong>{selectedCustomer.contactPerson || '—'}</strong></span>
                        <span>Email: {selectedCustomer.email}</span>
                        <span>Phone: {selectedCustomer.phone}</span>
                        <span>Outstanding: ₹{(selectedCustomer.balance || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Target Delivery Date</label>
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"/>
                  <div className="flex items-center justify-between mb-1 mt-3">
                    <label className="font-semibold text-slate-700 block">Salesperson</label>
                    <MasterSourceLink source="employees" />
                  </div>
                  <SalespersonSelect value={salesperson.id} name={salesperson.name} onChange={setSalesperson} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"/>
                </div>
              </div>

              {/* Enterprise Credit Limit Guard */}
              {isCreditExceeded && selectedCustomer && (<div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 text-xs">
                  <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5"/>
                  <div className="space-y-0.5">
                    <p className="font-bold">Credit Limit Guard Warning</p>
                    <p className="text-[11px] text-rose-700">
                      Customer current outstanding ({formatCurrency(selectedCustomer.balance)}) + this order ({formatCurrency(totalAmt)}) = {formatCurrency(selectedCustomer.balance + totalAmt)}, which exceeds the approved credit limit ({formatCurrency(creditLimit)}).
                    </p>
                  </div>
                </div>)}

              <div>
                <label className="font-semibold text-slate-700 block mb-2">Order Line Items & Inventory Allocation</label>
                <LineItemEditor items={lineItems} onChange={setLineItems} type="sales" onRequestPO={(item, deficitQty) => {
                setAutoPOState({
                    isOpen: true,
                    item,
                    deficitQty,
                });
            }}/>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <Button variant="outline" type="button" onClick={handleCloseCreateModal}>
                  Cancel
                </Button>
                <Button type="submit">
                  Confirm & Create Order
                </Button>
              </div>
            </form>
          </div>
        </div>)}

      {/* Auto-PO Requisition Modal */}
      <AutoPOModal isOpen={autoPOState.isOpen} onClose={() => setAutoPOState({ isOpen: false })} shortageItem={autoPOState.item} requiredDeficitQty={autoPOState.deficitQty} sourceRef={`Sales Order Requisition`}/>

      {/* Sales Order Detail & Lifecycle Stepper Modal */}
      {selectedOrder && (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pb-3 border-b border-slate-200">
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-3 min-w-0 lg:min-w-auto">
                <h3 className="font-bold text-lg text-[#1F2E4A]">{selectedOrder.orderNumber}</h3>
                <span className="font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded">
                  {selectedOrder.customer}
                </span>
                <StatusBadge status={selectedOrder.stage || 'Draft'}/>
              </div>
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                {selectedOrder.stage !== 'Cancelled' && !orderHasInvoice(selectedOrder) && (
                  <button
                    type="button"
                    onClick={async () => {
                      await convertSalesOrderToInvoice(selectedOrder.id);
                      setSelectedOrder(null);
                      navigate('/sales/invoices');
                    }}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Convert to Sales Invoice"
                  >
                    <Receipt size={13}/>
                    Convert to Sales Invoice
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPrintSalesOrderTarget(selectedOrder)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer size={13}/>
                  Print Official Order
                </button>
                <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                  <X size={18}/>
                </button>
              </div>
            </div>

            <div className="space-y-6 mt-4 overflow-y-auto pr-1 flex-1">
              {/* Lifecycle Stepper */}
              <DocumentTimeline steps={getOrderTimelineSteps(selectedOrder)}/>

              {/* Connected Docs Card */}
              <RelatedDocumentsCard documents={getOrderRelatedDocs(selectedOrder)}/>

              {/* Order Line Items Table */}
              <div className="space-y-3">
                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
                  <h4 className="font-bold text-slate-700 uppercase tracking-wider text-xs">
                    Committed Line Items & Fulfillment Status ({selectedOrder.items?.length || 0})
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">
                    Stage: <strong className="text-slate-800">{selectedOrder.stage || 'Draft'}</strong>
                  </span>
                </div>

                {/* Line Fulfillment Progress Summary Table */}
                {selectedOrder.items && selectedOrder.items.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[640px] lg:min-w-0 text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-200 text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Item / Description</th>
                          <th className="py-2 px-3 text-center">Ordered</th>
                          <th className="py-2 px-3 text-center">Delivered</th>
                          <th className="py-2 px-3 text-center">Invoiced</th>
                          <th className="py-2 px-3 text-center">Remaining to Deliver</th>
                          <th className="py-2 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedOrder.items.map((it, idx) => {
                          const ordered = Number(it.orderedQty ?? it.qty ?? 1);
                          const delivered = Number(it.deliveredQty ?? 0);
                          const invoiced = Number(it.invoicedQty ?? 0);
                          const remaining = Math.max(0, ordered - delivered);
                          return (
                            <tr key={it.id || idx}>
                              <td className="py-2 px-3 font-semibold text-slate-800">
                                {it.description || it.name}
                                {it.sku && <span className="text-[10px] text-slate-400 font-mono block">SKU: {it.sku}</span>}
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold">{ordered}</td>
                              <td className="py-2 px-3 text-center font-mono text-blue-600 font-bold">{delivered}</td>
                              <td className="py-2 px-3 text-center font-mono text-purple-600 font-bold">{invoiced}</td>
                              <td className="py-2 px-3 text-center font-mono">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  remaining === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                                }`}>
                                  {remaining}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(it.amount ?? (ordered * Number(it.rate || 0)))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Address Snapshot Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="font-bold text-slate-700 uppercase text-[10px] text-muted block">Billed To (Snapshot)</span>
                    <p className="font-semibold text-slate-800">{selectedOrder.customer}</p>
                    <p className="text-slate-600">{selectedOrder.billingAddress?.line1 || 'Main Facility'}</p>
                    <p className="text-slate-600">{selectedOrder.billingAddress?.city || 'Mumbai'}, {selectedOrder.billingAddress?.state || 'Maharashtra'} {selectedOrder.billingAddress?.pincode}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 uppercase text-[10px] text-muted block">Shipped To (Snapshot)</span>
                    <p className="font-semibold text-slate-800">{selectedOrder.customer}</p>
                    <p className="text-slate-600">{selectedOrder.shippingAddress?.line1 || selectedOrder.billingAddress?.line1 || 'Destination Facility'}</p>
                    <p className="text-slate-600">{selectedOrder.shippingAddress?.city || selectedOrder.billingAddress?.city || 'Mumbai'}, {selectedOrder.shippingAddress?.state || selectedOrder.billingAddress?.state || 'Maharashtra'} {selectedOrder.shippingAddress?.pincode}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-4 border-t border-slate-200 bg-slate-50 -mx-4 -mb-4 px-4 sm:-mx-6 sm:-mb-6 sm:px-6 py-3">
              <div className="font-mono text-xs">
                Total Value: <span className="font-bold text-slate-900">{formatCurrency(selectedOrder.amount || 0)}</span>
              </div>
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                {selectedOrder.stage !== 'Cancelled' && (
                  <>
                    <Button variant="outline" onClick={() => setPickingListOrder({ id: selectedOrder.id, orderNumber: selectedOrder.orderNumber })}>
                      <Boxes size={13} className="mr-1 text-indigo-600"/> Picking List
                    </Button>
                    <Button variant="outline" onClick={() => { handleGenerateProforma(selectedOrder); setSelectedOrder(null); }}>
                      <FileSpreadsheet size={13} className="mr-1 text-blue-600"/> Generate Proforma
                    </Button>
                    {selectedOrder.stage === 'Draft' && (<Button onClick={() => { advanceStage(selectedOrder.id, 'Draft'); setSelectedOrder(null); }}>
                        Confirm Order
                      </Button>)}
                    {(selectedOrder.stage === 'Confirmed' || selectedOrder.stage === 'Partially Dispatched') && !orderHasChallan(selectedOrder) && (<Button onClick={() => { advanceStage(selectedOrder.id, selectedOrder.stage); setSelectedOrder(null); }}>
                        {selectedOrder.stage === 'Partially Dispatched' ? 'Dispatch Remaining' : 'Issue Delivery Challan'}
                      </Button>)}
                    {selectedOrder.stage !== 'Cancelled' && !orderHasInvoice(selectedOrder) && (
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 cursor-pointer"
                        onClick={async () => {
                          await convertSalesOrderToInvoice(selectedOrder.id);
                          setSelectedOrder(null);
                          navigate('/sales/invoices');
                        }}
                      >
                        <Receipt size={13}/> Convert to Sales Invoice
                      </Button>
                    )}
                    <button
                      onClick={() => {
                        const target = selectedOrder;
                        setSelectedOrder(null);
                        setCancelModalTarget(target);
                      }}
                      className="px-3 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-semibold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Ban size={12}/> Cancel Order
                    </button>
                  </>
                )}
                <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>)}

      {/* Cancel Confirmation Modal */}
      {cancelModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-6 text-xs flex flex-col max-h-[95vh] overflow-y-auto">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
              <ShieldAlert className="w-5 h-5 text-rose-600"/>
              <h3 className="font-bold text-base text-[#1F2E4A]">Cancel Sales Order {cancelModalTarget.orderNumber}?</h3>
            </div>

            <div className="py-4 space-y-2 text-slate-600">
              <p className="font-semibold text-slate-800">This action will:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>Release inventory reservation for this order</li>
                <li>Prevent any new Delivery Challans or Invoices from being generated</li>
                <li>Mark order as <strong className="text-rose-600">Cancelled</strong></li>
                <li>Preserve previous document history</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button variant="outline" onClick={() => setCancelModalTarget(null)}>
                Keep Order
              </Button>
              <button
                type="button"
                onClick={() => {
                  cancelSalesOrder(cancelModalTarget.id);
                  setCancelModalTarget(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-sm cursor-pointer"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Commercial Sales Order Confirmation PDF Voucher */}
      {pickingListOrder && (
        <PickingListModal
          orderId={pickingListOrder.id}
          orderNumber={pickingListOrder.orderNumber}
          onClose={() => setPickingListOrder(null)}
        />
      )}
      <PrintSalesOrderModal
        isOpen={Boolean(printSalesOrderTarget)}
        onClose={() => setPrintSalesOrderTarget(null)}
        order={printSalesOrderTarget}
      />

      {/* Connect with PMS: Create Production Project */}
      <CreateProjectModal
        isOpen={Boolean(pmsModalOrder)}
        initialOrderNumber={pmsModalOrder || ''}
        onClose={() => setPmsModalOrder(null)}
        onCreated={(id) => {
          setPmsModalOrder(null);
          navigate(`/pms/projects/${id}`);
        }}
      />
    </div>);
};
