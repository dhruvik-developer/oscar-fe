import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Plus, FileText, CheckCircle2, ArrowRight, Copy, Eye, Printer } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AutoPOModal } from '../../components/common/AutoPOModal';
import { PageHeader } from '../../components/common/PageHeader';
import { PrintQuotationModal } from '../../components/common/PrintQuotationModal';
const quotationGuide = {
    title: 'Quotations',
    subtitle: 'Commercial price proposals and direct 1-click conversion to Sales Orders.',
    purpose: 'A Quotation is a non-binding price and quantity offer sent to prospective or existing clients. Once the customer approves the quote, it converts directly into a confirmed Sales Order without re-entering line items.',
    keyTerms: [
        { term: 'Quotation', definition: 'A proposed pricing offer valid for a designated duration (e.g. 30 days).' },
        { term: 'Pipeline Value', definition: 'The total monetary value of all active unexpired quotes currently awaiting customer confirmation.' },
        { term: '1-Click SO Conversion', definition: 'Automatically converts approved quote line items into a confirmed Sales Order.' },
    ],
    tips: [
        'Click "Convert to SO" to instantly create a Sales Order and start the warehouse dispatch chain.',
        'Use the 📋 Clone button to duplicate any existing quote for a quick client variation.',
        'Click the Quote number to view line item details and print an official Proforma Quote voucher.',
    ],
    workflow: ['Quotation Created', 'Customer Approval', 'Convert to Sales Order', 'Warehouse Dispatch', 'Invoiced'],
};
export const QuotationsPage = () => {
    const { quotations, recordQuotationActivity, convertQuotationToSalesOrder, approveQuotation, formatCurrency, formatDateDDMMYYYY } = useERP();
    const navigate = useNavigate();
    const location = useLocation();
    const leadRequest = location.state && (location.state.fromLead || location.state.fromDeal) ? location.state : null;
    const autoOpened = React.useRef(false);
    const [printQuotationTarget, setPrintQuotationTarget] = useState(null);
    const openedPrintRequest = React.useRef('');
    const [autoPOState, setAutoPOState] = useState({ isOpen: false, item: null, deficitQty: 0 });
    const [approvingQuote, setApprovingQuote] = useState(false);

    const canApproveQuote = (status) => ['Draft', 'Sent', 'Viewed'].includes(status);

    const handleApprove = async (quote) => {
        if (!quote || approvingQuote) return;
        setApprovingQuote(true);
        try {
            await approveQuotation(quote.id);
        } catch {
            // approveQuotation already toasted the reason.
        } finally {
            setApprovingQuote(false);
        }
    };

    React.useEffect(() => {
        if (!leadRequest || autoOpened.current) return;
        autoOpened.current = true;
        navigate('/sales/quotations/create', { state: { ...leadRequest } });
    }, [leadRequest, navigate]);
    React.useEffect(() => {
        const quoteId = location.state?.quotationId || new URLSearchParams(location.search).get('quotationId');
        const request = `${location.key}:${quoteId}`;
        const quote = quotations.find(q => q.id === quoteId);
        if (quote && new URLSearchParams(location.search).get('print') === 'true' && openedPrintRequest.current !== request) {
            openedPrintRequest.current = request;
            setPrintQuotationTarget(quote);
        }
    }, [location.state, location.search, location.key, quotations]);
    const totalPipeline = quotations.reduce((sum, q) => sum + (q.amount || 0), 0);

    const handleOpenCreateModal = () => {
        navigate('/sales/quotations/create');
    };

    const handleConvert = (quote) => {
        if (!quote) return;
        if (['Rejected', 'Cancelled'].includes(quote.status)) {
            alert('Cannot convert a rejected or cancelled quotation to a Sales Order. Please clone or create a new quotation.');
            return;
        }
        const order = convertQuotationToSalesOrder(quote.id);
        if (order) {
            navigate('/sales/orders');
        }
    };
    const handleCloneQuote = (quote) => {
        navigate('/sales/quotations/create', {
            state: {
                customerId: quote.customerId || '',
                dealReference: quote.dealReference || '',
                items: (quote.items || []).map((it) => ({
                    name: it.itemName || it.name || it.description || '',
                    qty: it.qty ?? 1,
                    rate: it.rate || 0,
                })),
            },
        });
    };
    const columns = [
        {
            header: 'Quote #',
            accessor: 'quoteNumber',
            width: '18%',
            render: (q) => (
              <div>
                <button onClick={() => navigate(`/sales/quotations/${q.id}`)} className="font-bold font-mono text-primary hover:underline block text-left cursor-pointer">
                  {q.quoteNumber}
                </button>
                <span className="text-[11px] text-muted">{formatDateDDMMYYYY(q.date)}</span>
              </div>
            ),
        },
        {
            header: 'Lead Name',
            accessor: 'leadName',
            width: '16%',
            render: (q) => (
              <span className="text-xs text-slate-600 dark:text-slate-300">{q.leadName || '—'}</span>
            ),
        },
        {
            header: 'Customer',
            accessor: 'customer',
            width: '20%',
            render: (q) => (
              <div>
                <strong className="text-slate-900 dark:text-slate-100 block">{q.customer}</strong>
                <span className="text-[11px] text-muted">Validity: {q.validUntil || '30 Days'}</span>
              </div>
            ),
        },
        {
            header: 'Items',
            width: '14%',
            render: (q) => (
              <span className="text-xs text-muted">
                {q.items && q.items.length > 0 ? `${q.items.length} Line Items` : '1 Item'}
              </span>
            ),
        },
        {
            header: 'Total Value',
            accessor: 'amount',
            align: 'right',
            width: '16%',
            render: (q) => (
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(q.amount || 0)}
              </span>
            ),
        },
        {
            header: 'Status',
            accessor: 'status',
            align: 'center',
            width: '14%',
            render: (q) => <StatusBadge status={q.status}/>,
        },
        {
            header: 'Actions',
            align: 'right',
            width: '14%',
            render: (q) => (
              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                <button
                  onClick={() => navigate(`/sales/quotations/${q.id}`)}
                  className="p-1.5 text-muted hover:text-primary hover:bg-card-hover rounded-lg cursor-pointer transition-colors"
                  title="View Details"
                >
                  <Eye size={13}/>
                </button>
                <button
                  onClick={() => setPrintQuotationTarget(q)}
                  className="p-1.5 text-muted hover:text-primary hover:bg-card-hover rounded-lg cursor-pointer transition-colors"
                  title="Print Official Commercial Quotation"
                >
                  <Printer size={13}/>
                </button>
                <button
                  onClick={() => handleCloneQuote(q)}
                  className="p-1.5 text-muted hover:text-primary hover:bg-card-hover rounded-lg cursor-pointer transition-colors"
                  title="Clone / Duplicate Quote"
                >
                  <Copy size={13}/>
                </button>
                {q.status === 'Confirmed' ? (
                  <button
                    onClick={() => navigate('/sales/orders')}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 size={12}/> Converted
                  </button>
                ) : (
                  <>
                    {['Draft', 'Sent', 'Viewed'].includes(q.status) && (
                      <button
                        onClick={() => handleApprove(q)}
                        disabled={approvingQuote}
                        className="text-xs font-semibold text-emerald-600 hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                        title="Approve — converts the linked lead to a customer automatically"
                      >
                        <CheckCircle2 size={12}/> {approvingQuote ? 'Approving…' : 'Approve'}
                      </button>
                    )}
                    {['Rejected', 'Cancelled'].includes(q.status) ? (
                      <span className="text-xs font-medium text-slate-400 italic">
                        Not Convertible
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConvert(q)}
                        className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        Convert <ArrowRight size={12}/>
                      </button>
                    )}
                  </>
                )}
              </div>
            ),
        },
    ];
    return (<div className="space-y-6">
      <PageHeader title="Quotations" subtitle="Generate quotations and convert approved quotes directly into confirmed Sales Orders." guide={quotationGuide} actions={<Button icon={Plus} onClick={handleOpenCreateModal}>
            New Quotation
          </Button>}/>

      {leadRequest && (
        <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs">
          <FileText size={15} className="text-blue-600 shrink-0" />
          <span className="text-slate-700">
            Creating quotation for {leadRequest.fromDeal ? 'deal' : 'lead'} <strong className="text-slate-900">{leadRequest.fromDeal ? leadRequest.dealReference : leadRequest.leadName}</strong>
            {leadRequest.company && <span> • {leadRequest.company}</span>}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Quotations" value={quotations.length} icon={FileText}/>
        <StatCard label="Pipeline Value" value={formatCurrency(totalPipeline)}/>
        <StatCard label="Confirmed Conversion" value={`${quotations.filter((q) => q.status === 'Confirmed' || q.status === 'Invoiced').length} Quotes`} trend={{ positive: true, text: 'Direct SO conversion' }}/>
      </div>

      <DataTable title="Quotation Register" data={quotations} columns={columns} keyExtractor={(q) => q.id} searchPlaceholder="Search quotations..." searchFilter={(q, term) => String(q.quoteNumber ?? '').toLowerCase().includes(term) ||
            String(q.customer ?? '').toLowerCase().includes(term) ||
            String(q.status ?? '').toLowerCase().includes(term)}/>

      {/* Auto-PO Requisition Modal */}
      <AutoPOModal isOpen={autoPOState.isOpen} onClose={() => setAutoPOState({ isOpen: false })} shortageItem={autoPOState.item} requiredDeficitQty={autoPOState.deficitQty} sourceRef={`Quotation Requisition`}/>

      {/* Official Commercial Quotation PDF Voucher */}
      <PrintQuotationModal
        isOpen={Boolean(printQuotationTarget)}
        onClose={() => setPrintQuotationTarget(null)}
        quotation={printQuotationTarget}
        onPrint={() => recordQuotationActivity(printQuotationTarget.id, 'PDF print requested')}
      />
    </div>);
};
