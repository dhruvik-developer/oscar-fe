import React from 'react';
import { useERP } from '../../context/ERPContext';
import { SalesInvoicesView } from './SalesInvoicesView';
import { PageHeader } from '../../components/common/PageHeader';
const invoiceGuide = {
    title: 'Sales Invoices & Receivables',
    subtitle: 'Commercial tax billing, accounts receivable ledger, and payment receipt settlement.',
    purpose: 'A Sales Invoice is the official commercial demand for payment issued to a customer after order confirmation and warehouse dispatch. It posts to Accounts Receivable (AR), computes taxes, tracks remaining balances, and produces official Payment Receipts upon settlement.',
    keyTerms: [
        { term: 'Sales Invoice', definition: 'The commercial billing instrument detailing goods sold, unit prices, applied taxes, and due date.' },
        { term: 'Accounts Receivable (AR)', definition: 'The total unpaid money owed by customers to your company for delivered goods.' },
        { term: 'Payment Due Date / Terms', definition: 'The agreed calendar deadline by which the customer must remit payment (e.g. Net 30 days).' },
        { term: 'Payment Receipt / Voucher', definition: 'An official acknowledgement proving that full or partial payment has been collected and posted to the General Ledger.' },
    ],
    tips: [
        'Use the ⚡ Settle button on unpaid invoices to record payment and generate an official printable receipt voucher in 1 click.',
        'Link an invoice to a Sales Order to pull all verified line items automatically.',
    ],
    workflow: ['Sales Order Dispatched', 'Tax Invoice Issued', 'Payment Received', 'Receipt Voucher Issued', 'AR Balance Cleared'],
};
export const SalesInvoicesPage = () => {
    const { invoices, createInvoice } = useERP();
    return <SalesInvoicesView invoices={invoices} onCreateInvoice={createInvoice}/>;
};
