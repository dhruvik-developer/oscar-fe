import './quotationWorkflow.css';
import { quotationTotals } from '../../utils/quotationDocument';

export function QuotationDocument({ quotation }) {
  const totals = quotationTotals(quotation);
  const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: quotation.currency || 'INR' }).format(Number(value) || 0);
  return <article className="qw-document printable-document bg-white text-slate-800 p-8 space-y-6">
    <header className="flex justify-between gap-4 border-b-2 border-slate-800 pb-5">
      <div><div className="font-black text-xl text-[#1F2E4A]">E · EVENMORE ENTERPRISES</div><p>Commercial Quotation</p></div>
      <div className="text-right"><h1 className="font-bold">{quotation.quoteNumber}</h1><p>Date: {quotation.date}</p><p>Valid until: {quotation.validUntil}</p></div>
    </header><h2 className="text-center font-extrabold text-2xl tracking-widest text-blue-950">QUOTATION</h2>
    <div><h2 className="font-semibold">Quoted to</h2><p>{quotation.customer}</p>{quotation.billingAddress && <p>{typeof quotation.billingAddress === 'string' ? quotation.billingAddress : ['line1', 'line2', 'city', 'state', 'pincode', 'country'].map(key => quotation.billingAddress[key]).filter(Boolean).join(', ')}</p>}{quotation.dealReference && <p>Deal reference: {quotation.dealReference}</p>}</div>
    <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b"><th>Product / Service</th><th>Qty</th><th>Rate</th><th>Discount %</th><th>Tax %</th><th>Amount</th></tr></thead>
      <tbody>{(quotation.items || []).map((item, index) => <tr key={index} className="border-b"><td className="py-3">{item.name || item.description}</td><td>{item.qty}</td><td>{money(item.rate)}</td><td>{item.discount ?? 0}</td><td>{item.tax ?? 0}</td><td>{money(item.amount ?? Number(item.qty) * Number(item.rate) * (1 - Number(item.discount || 0) / 100) * (1 + Number(item.tax || 0) / 100))}</td></tr>)}</tbody>
    </table></div>
    <dl className="ml-auto max-w-xs space-y-2">{[['Subtotal', totals.subtotal], ['Discount', totals.discount], ['Tax', totals.tax], ['Freight', totals.freight], ['Grand Total', totals.total]].map(([label, value]) => <div key={label} className="flex justify-between gap-8"><dt>{label}</dt><dd className="font-bold">{money(value)}</dd></div>)}</dl>
    {(quotation.termsAndConditions || quotation.terms) && <section><h2 className="font-bold">Terms & Conditions</h2><p className="whitespace-pre-wrap">{quotation.termsAndConditions || quotation.terms}</p></section>}
    <footer className="qw-document-footer"><strong>Thank you for your business!</strong><p>Evenmore ERP ? Commercial Quotation</p></footer>
  </article>;
}
