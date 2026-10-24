import { useLocation, useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Plus, Truck, CheckCircle2, X, AlertTriangle, Printer, Package, MapPin, UserCheck, Ban, ShieldAlert, Eye, Award, Send, FileText, ShieldCheck } from 'lucide-react';
import { RelatedDocumentsCard } from '../../components/common/RelatedDocumentsCard';
import { PageHeader } from '../../components/common/PageHeader';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { SendChallanModal } from '../../components/common/SendChallanModal';
import { PrintDeliveryChallanModal } from '../../components/common/PrintDeliveryChallanModal';
import { SignatureSlot, useDocumentSignatures } from '../../components/common/SignatureSlot';
const challanGuide = {
    title: 'Delivery Challans & Waybills',
    subtitle: 'Warehouse logistics dispatch, non-commercial shipping waybills, and proof of delivery (POD).',
    purpose: 'A Delivery Challan (or Shipping Waybill) is a formal logistics manifest accompanying physical goods during transit from your warehouse to the customer destination. Unlike an invoice, it contains zero commercial pricing or taxes, focusing strictly on SKUs, piece counts, carrier details, and receiver signatures.',
    keyTerms: [
        { term: 'Delivery Challan / Waybill', definition: 'A logistics shipping manifest used for physical goods transport and gate-pass security verification.' },
        { term: 'Proof of Delivery (POD)', definition: 'Signed confirmation by the consignee receiver verifying that goods arrived in full quantity and undamaged condition.' },
        { term: 'Consignee', definition: 'The designated recipient or receiving warehouse facility where goods are to be delivered.' },
        { term: 'Carrier / Transporter', definition: 'The freight company, logistics provider, or fleet vehicle handling transit (e.g. FedEx Freight, DHL).' },
    ],
    tips: [
        'Delivery Challans never show commercial unit prices or taxes, matching standard international shipping practices.',
        'Click "Confirm POD" once the customer signs the physical or digital receiving slip to mark delivery complete.',
    ],
    workflow: ['Sales Order Confirmed', 'Delivery Challan Generated', 'Carrier In-Transit', 'Consignee Receives Goods', 'POD Verified & Invoice Issued'],
};
export const DeliveryChallansPage = () => {
    const { deliveryChallans, addDeliveryChallan, updateDeliveryChallanStatus, cancelDeliveryChallan, convertChallanToInvoice, salesOrders, invoices, paymentIns, items: masterItems, calculateItemStock } = useERP();
    const location = useLocation();
    const navigate = useNavigate();

    const handleConvertToInvoice = async (challan) => {
        if (!challan) return;
        try {
            const inv = await convertChallanToInvoice(challan.id);
            if (inv) {
                setSelectedChallan(null);
                navigate('/sales/invoices');
            }
        } catch (err) {
            console.error('Failed to convert challan to invoice:', err);
        }
    };

    const challanHasInvoice = (challan) => {
        if (!challan) return false;
        return (invoices || []).some(inv =>
            inv.status !== 'Cancelled' && (
                (challan.id && (inv.deliveryChallanId === challan.id || inv.sourceDeliveryChallanId === challan.id)) ||
                (challan.challanNumber && (inv.deliveryChallanNumber === challan.challanNumber)) ||
                (challan.sourceInvoiceId && inv.id === challan.sourceInvoiceId) ||
                (challan.invoiceId && inv.id === challan.invoiceId)
            )
        );
    };
    React.useEffect(() => {
        if (location.state?.challanId) setSelectedChallan(deliveryChallans.find(dc => dc.id === location.state.challanId) || null);
    }, [location.state, deliveryChallans]);
    const [draftChallan, setDraftChallan] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedChallan, setSelectedChallan] = useState(null);
    const challanSigs = useDocumentSignatures('DeliveryChallan', selectedChallan?.id, `Delivery Challan ${selectedChallan?.challanNumber || ''}`);
    const [printChallanTarget, setPrintChallanTarget] = useState(null);
    const [cancelModalTarget, setCancelModalTarget] = useState(null);
    const [sendModalChallan, setSendModalChallan] = useState(null);
    const [selectedSoId, setSelectedSoId] = useState(salesOrders[0]?.id || '');
    const [transporter, setTransporter] = useState('');
    const [vehicleNo, setVehicleNo] = useState('');
    const [driverContact, setDriverContact] = useState('');
    const [totalPackages, setTotalPackages] = useState(1);
    const [dispatchNote, setDispatchNote] = useState('');
    const [lineItems, setLineItems] = useState([]);
    const [validationError, setValidationError] = useState('');

    const prepareOrderLines = (order) => {
        if (!order || !order.items) return [];
        return order.items.map((it) => {
            const orderedQty = Number(it.orderedQty ?? it.qty ?? 1);
            const deliveredQty = Number(it.deliveredQty ?? 0);
            const remainingQty = Math.max(0, orderedQty - deliveredQty);
            const defaultDispatchQty = remainingQty > 0 ? remainingQty : 0;
            const mi = masterItems.find((m) => m.id === it.itemId || (it.itemSku && m.sku?.toLowerCase() === String(it.itemSku ?? '').toLowerCase()) || (it.sku && m.sku?.toLowerCase() === String(it.sku ?? '').toLowerCase()));
            const isSerial = mi?.trackingMode === 'Serial';
            const availableSerials = isSerial ? (mi.serialNumbers || []) : [];
            return {
                ...it,
                orderedQty,
                deliveredQty,
                remainingQty,
                qty: defaultDispatchQty,
                isSerial,
                availableSerials,
                selectedSerials: availableSerials.slice(0, defaultDispatchQty),
            };
        });
    };

    const handleSoChange = (soId) => {
        setSelectedSoId(soId);
        setValidationError('');
        const order = salesOrders.find((o) => o.id === soId);
        setLineItems(prepareOrderLines(order));
    };

    const openAddModal = () => {
        setDraftChallan(null);
        // Only orders with quantity still to dispatch can be picked.
        const defaultSo = salesOrders.find((o) => o.stage === 'Confirmed' || o.stage === 'Partially Dispatched');
        if (defaultSo) {
            setSelectedSoId(defaultSo.id);
            setLineItems(prepareOrderLines(defaultSo));
        }
        setValidationError('');
        setShowAddModal(true);
    };

    const prepareDraftDispatch = (challan) => {
        setDraftChallan(challan);
        setSelectedChallan(null);
        setSelectedSoId('');
        setLineItems(prepareOrderLines(challan));
        setTransporter(challan.transporter || '');
        setVehicleNo(challan.vehicleNo || '');
        setValidationError('');
        setShowAddModal(true);
    };

    const handleItemQtyChange = (index, newQty) => {
        setValidationError('');
        const updated = [...lineItems];
        const line = updated[index];
        const qtyVal = Number(newQty);
        const cappedQty = Math.max(0, qtyVal);
        
        let selectedSerials = line.selectedSerials || [];
        if (line.isSerial && line.availableSerials) {
            selectedSerials = line.availableSerials.slice(0, cappedQty);
        }

        updated[index] = {
            ...line,
            qty: cappedQty,
            selectedSerials,
        };
        setLineItems(updated);
    };

    const handleSerialToggle = (index, serial) => {
        const updated = [...lineItems];
        const line = updated[index];
        const current = line.selectedSerials || [];
        let next;
        if (current.includes(serial)) {
            next = current.filter((s) => s !== serial);
        } else {
            if (current.length >= line.qty) {
                next = [...current.slice(0, Math.max(0, line.qty - 1)), serial];
            } else {
                next = [...current, serial];
            }
        }
        updated[index] = { ...line, selectedSerials: next };
        setLineItems(updated);
    };

    const handleCreate = (e) => {
        e.preventDefault();
        const order = draftChallan || salesOrders.find((o) => o.id === selectedSoId);
        if (!order) {
            setValidationError('Select the sales order to dispatch against.');
            return;
        }
        
        // Over-delivery validation
        for (const item of lineItems) {
            const rem = item.remainingQty !== undefined ? item.remainingQty : (Number(item.orderedQty ?? item.qty) - Number(item.deliveredQty ?? 0));
            if (item.qty > rem) {
                setValidationError(`Over-delivery prevented for "${item.description || item.name}": Available to deliver is ${rem}, but ${item.qty} was entered.`);
                return;
            }
            if (item.isSerial && item.qty > 0) {
                if (!item.selectedSerials || item.selectedSerials.length < item.qty) {
                    setValidationError(`Please select ${item.qty} serial number(s) for "${item.description || item.name}".`);
                    return;
                }
            }
        }

        const validLines = lineItems.filter((it) => it.qty > 0);
        if (validLines.length === 0) {
            setValidationError('Please specify at least 1 item with dispatch quantity > 0.');
            return;
        }

        const created = addDeliveryChallan({
            ...(draftChallan ? { ...draftChallan, id: draftChallan.id } : {}),
            // The challan number is allocated by the server (DC series).
            challanNumber: draftChallan?.challanNumber,
            salesOrderId: draftChallan ? undefined : order?.id,
            sourceSalesOrderId: draftChallan ? undefined : order?.id,
            salesOrderNumber: order?.orderNumber || '',
            sourceSalesOrderNumber: order?.orderNumber || '',
            linkedSo: order?.orderNumber || '',
            customerId: order?.customerId,
            customer: order?.customer,
            dispatchDate: new Date().toISOString().split('T')[0],
            transporter,
            vehicleNo,
            status: 'In Transit',
            items: validLines,
            lineItems: validLines,
        });
        if (created) { setShowAddModal(false); setSelectedChallan(created); setDraftChallan(null); }
    };
    const markDelivered = (id) => {
        updateDeliveryChallanStatus(id, 'Delivered');
        if (selectedChallan && selectedChallan.id === id) {
            setSelectedChallan({ ...selectedChallan, status: 'Delivered' });
        }
    };
    const getChallanRelatedDocs = (challan) => {
        const docs = [];
        const soNum = challan.salesOrderNumber || challan.linkedSo;
        if (soNum) {
            const order = salesOrders.find((o) => o.orderNumber === soNum || o.id === challan.salesOrderId);
            if (order) {
                docs.push({
                    type: 'Sales Order',
                    number: order.orderNumber,
                    amount: order.amount,
                    date: order.date,
                    status: order.stage,
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
            }
        }
        if (!docs.some(d => d.type === 'Invoice')) {
            const linkedInv = invoices.find(i => (challan.sourceInvoiceId && i.id === challan.sourceInvoiceId) || (challan.invoiceId && i.id === challan.invoiceId) || (challan.sourceInvoiceNumber && i.invoiceNumber === challan.sourceInvoiceNumber) || (challan.invoiceNumber && i.invoiceNumber === challan.invoiceNumber));
            if (linkedInv) {
                docs.push({
                    type: 'Invoice',
                    number: linkedInv.invoiceNumber,
                    amount: linkedInv.total,
                    date: linkedInv.date,
                    status: linkedInv.status,
                });
                const payments = paymentIns.filter((p) => p.invoiceId === linkedInv.id || p.invoiceNumber === linkedInv.invoiceNumber);
                payments.forEach((p) => {
                    docs.push({
                        type: 'Payment',
                        number: p.receiptNumber,
                        amount: p.amount,
                        date: p.date,
                        status: 'Settled',
                    });
                });
            }
        }
        return docs;
    };
    const columns = [
        {
            key: 'challanNumber',
            header: 'Challan / Waybill #',
            width: '14%',
            render: (c) => (
              <button
                onClick={() => setSelectedChallan(c)}
                className="font-mono font-bold text-primary hover:underline flex items-center gap-1.5 cursor-pointer text-left whitespace-nowrap"
              >
                <Truck size={13} className="text-muted shrink-0"/>
                <span>{c.challanNumber}</span>
              </button>
            ),
        },
        {
            key: 'salesOrderNumber',
            header: 'Linked Sales Order',
            width: '14%',
            render: (c) => <span className="font-mono font-semibold text-text whitespace-nowrap">{c.salesOrderNumber || c.linkedSo || c.sourceQuotationNumber || c.sourceInvoiceNumber || c.invoiceNumber || '—'}</span>,
        },
        {
            key: 'customer',
            header: 'Consignee / Destination',
            width: '24%',
            render: (c) => (
              <div>
                <span className="font-bold text-text block">{c.customer}</span>
                <span className="text-[10px] text-muted flex items-center gap-0.5">
                  <MapPin size={10}/> Dock Receiving Bay
                </span>
              </div>
            ),
        },
        {
            key: 'dispatchDate',
            header: 'Dispatch Date',
            width: '12%',
            render: (c) => <span className="text-muted font-mono text-[11px] whitespace-nowrap">{formatDateDDMMYYYY(c.dispatchDate || c.date)}</span>,
        },
        {
            key: 'transporter',
            header: 'Logistics Carrier',
            width: '14%',
            render: (c) => (
              <div>
                <p className="font-semibold text-text">{c.transporter}</p>
                <span className="font-mono text-[10px] text-muted">
                  {c.vehicleNo || c.trackingNumber || 'TRK-DIRECT'}
                </span>
              </div>
            ),
        },
        {
            key: 'items',
            header: 'Total Units',
            align: 'center',
            width: '10%',
            render: (c) => {
                const totalUnits = (c.items || []).reduce((acc, it) => acc + (it.qty || 1), 0);
                return (
                  <span className="inline-flex items-center gap-1 font-semibold text-text-secondary bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap">
                    <Package size={11} className="text-muted"/> {totalUnits} pcs
                  </span>
                );
            },
        },
        {
            key: 'status',
            header: 'Dispatch Status',
            align: 'center',
            width: '12%',
            render: (c) => <StatusBadge status={c.status}/>,
        },
        {
            key: 'actions',
            header: 'Actions / POD',
            align: 'right',
            width: '18%',
            render: (c) => (
              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                <button
                  onClick={() => setSelectedChallan(c)}
                  className="p-1 text-slate-500 hover:text-primary hover:bg-slate-100 rounded text-xs flex items-center gap-1 cursor-pointer"
                  title="View Manifest"
                >
                  <Eye size={13}/>
                </button>
                <button
                  onClick={() => setPrintChallanTarget(c)}
                  className="p-1 text-slate-500 hover:text-primary hover:bg-slate-100 rounded text-xs flex items-center gap-1 cursor-pointer"
                  title="Print Official Delivery Challan & Waybill"
                >
                  <Printer size={13}/>
                </button>
                {c.status !== 'Cancelled' && (
                  <button
                    onClick={() => setSendModalChallan(c)}
                    className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded text-xs flex items-center gap-1 cursor-pointer"
                    title="Send Waybill & Warranty Card"
                  >
                    <Send size={13}/>
                  </button>
                )}
                {c.status !== 'Cancelled' && !challanHasInvoice(c) && (
                  <button
                    onClick={() => handleConvertToInvoice(c)}
                    className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded text-xs flex items-center gap-1 cursor-pointer"
                    title="Convert to Sales Invoice"
                  >
                    <FileText size={13}/>
                  </button>
                )}
                {c.status === 'Draft' && <Button size="sm" onClick={() => prepareDraftDispatch(c)}>Prepare Dispatch</Button>}
                {c.status !== 'Draft' && c.status !== 'Delivered' && c.status !== 'Cancelled' && (
                  <button
                    onClick={() => markDelivered(c.id)}
                    className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-white rounded text-[11px] font-semibold cursor-pointer flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <CheckCircle2 size={11}/> POD
                  </button>
                )}
                {c.status === 'Delivered' && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                    <UserCheck size={12}/> Verified
                  </span>
                )}
                {c.status !== 'Cancelled' && (
                  <button
                    onClick={() => setCancelModalTarget(c)}
                    className="p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded text-xs flex items-center gap-1 cursor-pointer"
                    title="Cancel Challan"
                  >
                    <Ban size={13}/>
                  </button>
                )}
              </div>
            ),
        },
    ];
    // Stock shortage check for the modal
    const hasShortages = lineItems.some((item) => {
        if (!item.itemId)
            return false;
        const stock = calculateItemStock(item.itemId);
        return stock.available < item.qty;
    });
    return (<div className="space-y-6">
      <PageHeader title="Delivery Challans & Logistics Waybills" subtitle="Warehouse dispatch manifests, physical goods delivery waybills, carrier vehicle tracking, and proof of delivery (POD)." guide={challanGuide} actions={<Button icon={Plus} onClick={openAddModal}>
            Issue Delivery Challan
          </Button>}/>

      <DataTable title="Active Dispatch Consignments" columns={columns} data={deliveryChallans} keyExtractor={(c) => c.id} searchPlaceholder="Search challan #, sales order, or carrier..." searchFilter={(c, term) => String(c.challanNumber ?? '').toLowerCase().includes(term) ||
            (c.salesOrderNumber && String(c.salesOrderNumber ?? '').toLowerCase().includes(term)) ||
            String(c.customer ?? '').toLowerCase().includes(term) ||
            (c.transporter && String(c.transporter ?? '').toLowerCase().includes(term))}/>

      {/* Create Logistics Challan Modal */}
      {showAddModal && (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 lg:gap-0 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600"/>
                <div>
                  <h3 className="font-bold text-base text-[#1F2E4A]">Issue Warehouse Delivery Challan</h3>
                  <p className="text-[11px] text-slate-500">Physical dispatch manifest for logistics and carrier tracking</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18}/>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Source Sales Order *</label>
                  <select disabled={Boolean(draftChallan)} required={!draftChallan} value={selectedSoId} onChange={(e) => handleSoChange(e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800 font-medium">
                    {draftChallan ? (
                      <option value="">{draftChallan.sourceQuotationNumber} - {draftChallan.customer}</option>
                    ) : (
                      <option value="">-- Select Source Sales Order --</option>
                    )}
                    {salesOrders.map((so) => (<option key={so.id} value={so.id}>
                        {so.orderNumber} - {so.customer} ({so.items?.length || 0} items)
                      </option>))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Carrier / Transporter</label>
                  <input type="text" value={transporter} onChange={(e) => setTransporter(e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800" placeholder="e.g. Transporter / Carrier name"/>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Vehicle / Truck Plate #</label>
                  <input type="text" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800" placeholder="e.g. MH-12-AB-9041"/>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Driver Contact / Phone</label>
                  <input type="text" value={driverContact} onChange={(e) => setDriverContact(e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"/>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Total Packages / Cartons</label>
                  <input type="number" min="1" value={totalPackages} onChange={(e) => setTotalPackages(Number(e.target.value))} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800"/>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Handling / Gate Pass Instructions</label>
                <input type="text" value={dispatchNote} onChange={(e) => setDispatchNote(e.target.value)} className="w-full p-2 border border-slate-300 rounded bg-white text-slate-800" placeholder="Special storage, gate pass, or forklift handling instructions..."/>
              </div>

              {/* Warehouse Dispatch Manifest Item Table (No Commercial Invoicing Fields) */}
              <div className="space-y-2">
                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
                  <label className="font-semibold text-slate-700 block">
                    Dispatch Item Manifest (Physical Goods Only)
                  </label>
                  <span className="text-[11px] text-slate-400">Tracks partial fulfillment against Sales Order</span>
                </div>

                {validationError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0"/>
                    <span className="font-semibold">{validationError}</span>
                  </div>
                )}

                {hasShortages && (<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-xs">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0"/>
                    <span>
                      <strong>Stock Warning:</strong> One or more items have insufficient warehouse stock. Please verify before dispatching.
                    </span>
                  </div>)}

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[640px] lg:min-w-0 text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Item SKU & Description</th>
                        <th className="py-2.5 px-3 text-center">SO Fulfillment</th>
                        <th className="py-2.5 px-3 w-24 text-center">Avail Stock</th>
                        <th className="py-2.5 px-3 w-36 text-center">Dispatch Qty</th>
                        <th className="py-2.5 px-3">Serial Numbers / Details</th>
                        <th className="py-2.5 px-3 w-24 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {lineItems.length === 0 ? (<tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            No items found in selected sales order.
                          </td>
                        </tr>) : (lineItems.map((item, idx) => {
                        const stock = item.itemId ? calculateItemStock(item.itemId) : { available: 10 };
                        const mi = masterItems.find((m) => m.id === item.itemId || (item.itemSku && m.sku?.toLowerCase() === String(item.itemSku ?? '').toLowerCase()) || (item.sku && m.sku?.toLowerCase() === String(item.sku ?? '').toLowerCase()));
                        const isShort = stock.available < item.qty;
                        const isOverLimit = item.qty > (item.remainingQty ?? 9999);
                        return (
                          <tr key={item.id || idx} className={`hover:bg-slate-50/70 ${isOverLimit ? 'bg-rose-50/50' : isShort ? 'bg-amber-50/30' : ''}`}>
                            <td className="p-2.5">
                              <p className="font-semibold text-slate-800">{item.description || item.name}</p>
                              <span className="font-mono text-[10px] text-slate-400">SKU: {item.itemSku || mi?.sku || 'GEN-SKU'}</span>
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="font-mono text-[11px] text-slate-700">
                                <div>Ordered: <strong>{item.orderedQty ?? item.qty}</strong></div>
                                <div className="text-slate-400 text-[10px]">Delivered: {item.deliveredQty ?? 0}</div>
                                <div className="text-blue-600 font-bold text-[10px]">Available: {item.remainingQty ?? item.qty}</div>
                              </div>
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stock.available <= 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : stock.available < item.qty
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-50 text-emerald-700'}`}>
                                {stock.available} in stock
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max={item.remainingQty ?? item.orderedQty ?? 100}
                                  value={item.qty}
                                  onChange={(e) => handleItemQtyChange(idx, Number(e.target.value))}
                                  className={`w-20 text-center text-xs font-semibold text-slate-800 border rounded px-1.5 py-1 focus:ring-1 ${
                                    isOverLimit ? 'border-rose-500 bg-rose-50' : 'border-slate-200 focus:ring-blue-500'
                                  }`}
                                />
                                <span className="text-[10px] text-slate-400">Max: {item.remainingQty ?? item.orderedQty}</span>
                              </div>
                            </td>
                            <td className="p-2.5">
                              {item.isSerial ? (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-500 block">Select Serials ({item.selectedSerials?.length || 0}/{item.qty}):</span>
                                  {item.availableSerials && item.availableSerials.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                                      {item.availableSerials.map((s) => {
                                        const isSelected = item.selectedSerials?.includes(s);
                                        return (
                                          <button
                                            type="button"
                                            key={s}
                                            onClick={() => handleSerialToggle(idx, s)}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                                              isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                          >
                                            {s}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-rose-500 italic">No serials in stock</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono">Standard Quantity Tracked</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              {isOverLimit ? (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                                  Over-limit
                                </span>
                              ) : isShort ? (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                  Deficit ({item.qty - stock.available})
                                </span>
                              ) : item.qty === 0 ? (
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                  Skip
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                  Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <Button variant="outline" type="button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Dispatch & Generate Waybill
                </Button>
              </div>
            </form>
          </div>
        </div>)}

      {/* Printable Logistics Waybill & POD Modal */}
      {selectedChallan && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-4 sm:p-6 text-xs max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-3 min-w-0 lg:min-w-auto">
                <div className="w-8 h-8 rounded-lg bg-[#1F2E4A] text-white font-bold flex items-center justify-center">
                  <Truck size={18}/>
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1F2E4A]">Delivery Challan & Goods Waybill</h3>
                  <span className="font-mono font-semibold text-slate-500">{selectedChallan.challanNumber}</span>
                </div>
                <StatusBadge status={selectedChallan.status}/>
              </div>
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                {selectedChallan.status !== 'Cancelled' && (
                  <button
                    onClick={() => setSendModalChallan(selectedChallan)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
                  >
                    <Send size={13}/> Send Waybill & Card
                  </button>
                )}
                {selectedChallan.status !== 'Cancelled' && !challanHasInvoice(selectedChallan) && (
                  <button
                    onClick={() => handleConvertToInvoice(selectedChallan)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-semibold cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
                    title="Convert to Sales Invoice"
                  >
                    <FileText size={13}/> Convert to Sales Invoice
                  </button>
                )}
                <button onClick={() => setPrintChallanTarget(selectedChallan)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer flex items-center gap-1.5">
                  <Printer size={13}/> Print Waybill
                </button>
                <button onClick={() => setSelectedChallan(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                  <X size={18}/>
                </button>
              </div>
            </div>

            <div className="space-y-6 overflow-y-auto pr-1 flex-1">
              {/* Shipper & Consignee Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Shipper / Dispatch From</span>
                  <p className="font-bold text-slate-900">Horizon Global Logistics & Warehousing Hub</p>
                  <p className="text-slate-600">452 Industrial Parkway, Dock 14B</p>
                  <p className="text-slate-600">Seattle, WA 98101 • United States</p>
                </div>
                <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Consignee / Deliver To (Shipping Address)</span>
                  <p className="font-bold text-blue-900">{selectedChallan.customer}</p>
                  {selectedChallan.shippingAddress ? (
                    <div className="text-slate-600 text-[11px] leading-tight mt-1">
                      <p>{selectedChallan.shippingAddress.line1}</p>
                      {selectedChallan.shippingAddress.line2 && <p>{selectedChallan.shippingAddress.line2}</p>}
                      <p>{selectedChallan.shippingAddress.city}, {selectedChallan.shippingAddress.state} {selectedChallan.shippingAddress.pincode}</p>
                    </div>
                  ) : (
                    <p className="text-slate-600">Customer Receiving Facility / Inbound Dock</p>
                  )}
                  <p className="text-slate-600 mt-1">Linked Source: <strong className="font-mono text-slate-800">{selectedChallan.salesOrderNumber || selectedChallan.linkedSo || selectedChallan.sourceQuotationNumber || selectedChallan.sourceInvoiceNumber || selectedChallan.invoiceNumber || 'Direct Dispatch'}</strong></p>
                </div>
              </div>

              {/* Carrier Logistics Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Transporter</span>
                  <p className="font-semibold text-slate-800">{selectedChallan.transporter || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Vehicle / Reg #</span>
                  <p className="font-mono font-semibold text-slate-800">{selectedChallan.vehicleNo || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Dispatch Date</span>
                  <p className="font-semibold text-slate-800">{formatDateDDMMYYYY(selectedChallan.dispatchDate || selectedChallan.date)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Dispatch Type</span>
                  <p className="font-semibold text-emerald-700">Non-Commercial Waybill</p>
                </div>
              </div>

              {/* Interactive Live Vehicle Transit Route Tracker */}
              {(() => {
                const currentStatus = selectedChallan.status || 'Dispatched';
                const isCancelled = currentStatus === 'Cancelled';
                
                let progressPct = 15;
                if (currentStatus === 'In Transit' || currentStatus === 'Shipped') progressPct = 50;
                if (currentStatus === 'Out for Delivery') progressPct = 80;
                if (currentStatus === 'Delivered') progressPct = 100;
                if (isCancelled) progressPct = 0;

                const advanceStage = (nextStatus) => {
                  updateDeliveryChallanStatus(selectedChallan.id, nextStatus);
                  setSelectedChallan({ ...selectedChallan, status: nextStatus });
                };

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                    <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                          <Truck size={16} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                            Live Fleet Route & Vehicle Tracking
                          </h4>
                          <p className="text-[10px] text-slate-500">
                            Vehicle: <strong className="font-mono text-slate-800">{selectedChallan.vehicleNo || '—'}</strong> • Carrier: {selectedChallan.transporter || '—'}
                          </p>
                        </div>
                      </div>

                      {/* Interactive Move Vehicle Actions */}
                      {!isCancelled && currentStatus !== 'Delivered' && (
                        <div className="flex flex-wrap lg:flex-nowrap items-center gap-1.5">
                          {currentStatus === 'Dispatched' && (
                            <button
                              onClick={() => advanceStage('In Transit')}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 shadow-2xs transition-all"
                              title="Advance vehicle to In Transit highway route"
                            >
                              <Truck size={12} /> Move Vehicle to Transit
                            </button>
                          )}
                          {currentStatus === 'In Transit' && (
                            <button
                              onClick={() => advanceStage('Out for Delivery')}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 shadow-2xs transition-all"
                              title="Advance vehicle to local distribution hub"
                            >
                              <Truck size={12} /> Move to Out for Delivery
                            </button>
                          )}
                          {(currentStatus === 'Out for Delivery' || currentStatus === 'In Transit') && (
                            <button
                              onClick={() => advanceStage('Delivered')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 shadow-2xs transition-all"
                              title="Complete delivery and sign POD"
                            >
                              <CheckCircle2 size={12} /> Complete Delivery
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Animated Highway Road & Moving Vehicle Track */}
                    <div className="relative pt-6 pb-2 px-3">
                      {/* Road Base Track */}
                      <div className="relative h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 transition-all duration-700 ease-out"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      {/* Moving Vehicle Marker */}
                      {!isCancelled && (
                        <div
                          className="absolute -top-1.5 -translate-x-1/2 transition-all duration-700 ease-out flex flex-col items-center group pointer-events-none"
                          style={{ left: `${Math.max(5, Math.min(95, progressPct))}%` }}
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white shadow-lg border-2 border-white flex items-center justify-center animate-bounce">
                            <Truck size={15} />
                          </div>
                          <span className="mt-1 font-mono text-[9px] font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                            {selectedChallan.vehicleNo || '—'}
                          </span>
                        </div>
                      )}

                      {/* Waypoint Checkpoints */}
                      <div className="grid grid-cols-4 text-center mt-5 text-[10px]">
                        <div className="space-y-0.5">
                          <div className={`w-3 h-3 rounded-full mx-auto border-2 ${progressPct >= 15 ? 'bg-blue-600 border-blue-600' : 'bg-slate-300 border-slate-300'}`} />
                          <p className="font-bold text-slate-800">Origin Warehouse</p>
                          <p className="text-slate-400 text-[9px]">Hub Staging Dock</p>
                        </div>
                        <div className="space-y-0.5">
                          <div className={`w-3 h-3 rounded-full mx-auto border-2 ${progressPct >= 50 ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-300 border-slate-300'}`} />
                          <p className="font-bold text-slate-800">Highway Transit</p>
                          <p className="text-slate-400 text-[9px]">En Route Transit</p>
                        </div>
                        <div className="space-y-0.5">
                          <div className={`w-3 h-3 rounded-full mx-auto border-2 ${progressPct >= 80 ? 'bg-amber-600 border-amber-600' : 'bg-slate-300 border-slate-300'}`} />
                          <p className="font-bold text-slate-800">Local Delivery Hub</p>
                          <p className="text-slate-400 text-[9px]">Out for Delivery</p>
                        </div>
                        <div className="space-y-0.5">
                          <div className={`w-3 h-3 rounded-full mx-auto border-2 ${progressPct >= 100 ? 'bg-emerald-600 border-emerald-600' : 'bg-slate-300 border-slate-300'}`} />
                          <p className="font-bold text-slate-800">Consignee Dock</p>
                          <p className="text-slate-400 text-[9px]">Delivered & POD</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Related Transaction Chain */}
              <RelatedDocumentsCard documents={getChallanRelatedDocs(selectedChallan)}/>


              {/* Clean Manifest Table (No Commercial Prices/Taxes) */}
              <div className="space-y-2">
                <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <Package size={14} className="text-blue-600"/> Physical Goods Manifest ({selectedChallan.items?.length || 0} Items)
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">Verified by Warehouse Inspection</span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[640px] lg:min-w-0 text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">#</th>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3 w-32">SKU / Code</th>
                        <th className="py-2.5 px-3 w-28 text-center">Dispatched Qty</th>
                        <th className="py-2.5 px-3">Serial Numbers</th>
                        <th className="py-2.5 px-3 w-28 text-center">Packaging</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(selectedChallan.items || []).map((it, idx) => (
                        <tr key={it.id || idx} className="hover:bg-slate-50/60">
                          <td className="p-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-semibold text-slate-800">{it.description || it.name}</td>
                          <td className="p-2.5 font-mono text-slate-500 text-[11px]">{it.itemSku || it.sku || 'SKU-LOG-01'}</td>
                          <td className="p-2.5 text-center font-bold text-slate-900">{it.qty}</td>
                          <td className="p-2.5">
                            {it.selectedSerials && it.selectedSerials.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {it.selectedSerials.map((s) => (
                                  <span key={s} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono text-[10px]">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">Standard Tracked</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center text-slate-500 text-[11px]">Carton / Sealed</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Proof of Delivery (POD) & Authorization Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="border border-dashed border-slate-300 rounded-xl p-3 space-y-2 bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Warehouse Dispatcher Signature</span>
                  <div className="border-b border-slate-300 pb-1">
                    <SignatureSlot doc={challanSigs} signatory="dispatcher" label="Warehouse Dispatcher" modalType="authorized"
                      defaultDesignation="Authorized Signatory (Warehouse Mgr.)"
                      placeholder={<span className="font-mono text-[11px] text-slate-500">Authorized Signatory (Warehouse Mgr.)</span>}/>
                  </div>
                  <p className="text-[10px] text-slate-400">Goods dispatched in undamaged, verified condition.</p>
                </div>

                <div className="border border-dashed border-blue-200 rounded-xl p-3 space-y-2 bg-blue-50/30">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Receiver Proof of Delivery (POD)</span>
                  <div className="border-b border-blue-300 pb-1">
                    <SignatureSlot doc={challanSigs} signatory="consignee" label="Receiver POD" modalType="receiver"
                      defaultName={selectedChallan.customer || ''} defaultDesignation="Consignee — Received in good condition"
                      placeholder={<span className="font-mono text-[11px] text-blue-900">{selectedChallan.status === 'Delivered' ? 'Signed & Received by Consignee' : 'Awaiting Consignee Receiver Signature & Stamp'}</span>}/>
                  </div>
                  <p className="text-[10px] text-slate-400">Received complete quantity in good order and condition.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-4 border-t border-slate-200 bg-slate-50 -mx-4 -mb-4 px-4 sm:-mx-6 sm:-mb-6 sm:px-6 py-3">
              <span className="text-slate-500">
                Logistics Status: <strong className="text-slate-800">{selectedChallan.status}</strong>
              </span>
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                {selectedChallan.status === 'Draft' && <Button onClick={() => prepareDraftDispatch(selectedChallan)}>Prepare Dispatch</Button>}
                {selectedChallan.status !== 'Draft' && selectedChallan.status !== 'Delivered' && selectedChallan.status !== 'Cancelled' && (
                  <Button onClick={() => markDelivered(selectedChallan.id)}>
                    Confirm Proof of Delivery (POD)
                  </Button>
                )}
                {selectedChallan.status !== 'Cancelled' && (
                  <Button
                    variant="outline"
                    className="text-rose-600 hover:bg-rose-50 border-rose-200"
                    onClick={() => {
                      setCancelModalTarget(selectedChallan);
                    }}
                  >
                    Cancel Challan
                  </Button>
                )}
                {selectedChallan.status !== 'Cancelled' && !challanHasInvoice(selectedChallan) && (
                  <Button
                    onClick={() => handleConvertToInvoice(selectedChallan)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <FileText size={13} className="mr-1"/> Convert to Sales Invoice
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedChallan(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>)}

      {/* Cancel Challan Modal */}
      {cancelModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-lg">
                <ShieldAlert size={20}/>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Cancel Delivery Challan?</h3>
                <p className="text-xs text-slate-500 font-mono">{cancelModalTarget.challanNumber}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 text-slate-700">
              <p className="font-semibold text-slate-900">This cancellation will:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                <li>Reverse the physical stock movement (<code className="text-rose-700 font-mono font-bold">SALE_REVERSAL</code>)</li>
                <li>Restore any dispatched serial numbers back to available inventory</li>
                <li>Rollback the delivered quantities on linked Sales Order</li>
                <li>Mark this challan as <span className="font-bold text-rose-600">Cancelled</span></li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCancelModalTarget(null)}>
                Keep Challan
              </Button>
              <button
                onClick={() => {
                  cancelDeliveryChallan(cancelModalTarget.id);
                  if (selectedChallan?.id === cancelModalTarget.id) {
                    setSelectedChallan({ ...selectedChallan, status: 'Cancelled' });
                  }
                  setCancelModalTarget(null);
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Delivery Challan Modal */}
      {sendModalChallan && (
        <SendChallanModal
          isOpen={Boolean(sendModalChallan)}
          onClose={() => setSendModalChallan(null)}
          challan={sendModalChallan}
          onPreviewChallan={() => {
            setSelectedChallan(sendModalChallan);
          }}
        />
      )}

      {/* Official Logistics Delivery Challan & Waybill Print Voucher */}
      <PrintDeliveryChallanModal
        isOpen={Boolean(printChallanTarget)}
        onClose={() => setPrintChallanTarget(null)}
        challan={printChallanTarget}
      />
    </div>);
};
