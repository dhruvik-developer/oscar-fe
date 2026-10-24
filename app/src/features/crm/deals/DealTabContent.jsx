import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, Download, Eye, FileText, Flag, FolderPlus, Pencil, Phone, Printer, Trash2, Users } from 'lucide-react';
import Modal from '../../../components/ui/Modal';

export const formatDealMoney = (value) => `₹ ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export function formatDealDate(value) {
  if (!value) return 'Not specified';
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
export function dealTotals(products, discount = 0, taxRate = 0) {
  const subtotal = products.reduce((sum, item) => sum + Number(item.qty) * Number(item.rate), 0);
  const deduction = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const tax = Math.round((subtotal - deduction) * (Number(taxRate) || 0)) / 100;
  return { subtotal, discount: deduction, tax, total: Math.round((subtotal - deduction + tax) * 100) / 100 };
}
function Table({ columns, children, empty, count }) {
  return <div className="deal-table-scroll"><table className="deal-detail-table deal-tab-table"><thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{count ? children : <tr><td colSpan={columns.length} className="deal-detail-empty">{empty}</td></tr>}</tbody></table></div>;
}
function Status({ value }) {
  return <span className="deal-record-status" data-status={String(value || 'Draft').toLowerCase().replaceAll(' ', '-')}>{value || 'Draft'}</span>;
}

export function ProductsTable({ products, discount, taxRate, onEdit, onRemove, onPricing }) {
  const totals = dealTotals(products, discount, taxRate);
  return <><Table columns={['#', 'Product', 'Description', 'Qty', 'Unit', 'Rate', 'Amount', 'Actions']} count={products.length} empty="No products added yet.">{products.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td className="deal-cell-primary">{item.name}</td><td className="deal-cell-description">{item.details || item.description || '—'}</td><td>{item.qty}</td><td>{item.unit || 'Qty'}</td><td>{formatDealMoney(item.rate)}</td><td>{formatDealMoney(item.qty * item.rate)}</td><td><div className="deal-row-actions"><button aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><Pencil size={14} /></button><button className="deal-delete-action" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item)}><Trash2 size={14} /></button></div></td></tr>)}</Table><div className="deal-totals"><dl><div><dt>Subtotal</dt><dd>{formatDealMoney(totals.subtotal)}</dd></div><div><dt>Discount</dt><dd>− {formatDealMoney(totals.discount)}</dd></div><div><dt>Tax ({Number(taxRate) || 0}%)</dt><dd>{formatDealMoney(totals.tax)}</dd></div><div className="deal-grand-total"><dt>Grand Total</dt><dd>{formatDealMoney(totals.total)}</dd></div></dl><button className="deal-text-action" onClick={onPricing}><Pencil size={12} />Edit discount & tax</button></div></>;
}

export function ActivitiesTimeline({ activities }) {
  const dayKey = (value) => {
    const parsed = new Date(value);
    if (!value || Number.isNaN(parsed.getTime())) return 'Date not specified';
    const now = new Date();
    if (parsed.toDateString() === now.toDateString()) return 'Today';
    now.setDate(now.getDate() - 1);
    return parsed.toDateString() === now.toDateString() ? 'Yesterday' : formatDealDate(value);
  };
  const kindStyle = (kind) => {
    if (/call/i.test(kind)) return { Icon: Phone, background: '#dcfce7', color: '#16a34a' };
    if (/note/i.test(kind)) return { Icon: FileText, background: '#fef3c7', color: '#d97706' };
    if (/quotation/i.test(kind)) return { Icon: FileText, background: '#dbeafe', color: '#2563eb' };
    if (/meeting/i.test(kind)) return { Icon: Users, background: '#ede9fe', color: '#7c3aed' };
    if (/stage/i.test(kind)) return { Icon: Flag, background: '#ffe4e6', color: '#e11d48' };
    if (/project/i.test(kind)) return { Icon: FolderPlus, background: '#d1fae5', color: '#059669' };
    if (/contract/i.test(kind)) return { Icon: FolderPlus, background: '#d1fae5', color: '#059669' };
    if (/task/i.test(kind)) return { Icon: CheckCircle2, background: '#e0f2fe', color: '#0284c7' };
    if (/update/i.test(kind)) return { Icon: Pencil, background: '#f1f5f9', color: '#475569' };
    return { Icon: CheckCircle2, background: '#eef2ff', color: '#4f46e5' };
  };
  const grouped = new Map();
  [...activities].sort((a, b) => (Date.parse(b.timestamp || b.time) || 0) - (Date.parse(a.timestamp || a.time) || 0)).forEach((item) => {
    const group = dayKey(item.timestamp || item.time);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(item);
  });
  if (!activities.length) return <p className="deal-detail-empty">No activities recorded yet.</p>;
  return <div className="deal-activity-timeline">{[...grouped].map(([group, entries]) => <section key={group}><h3>{group}</h3><ol>{entries.map((item, index) => {
    const stamp = new Date(item.timestamp || item.time);
    const kind = item.activityType || (item.type === 'project-created' ? 'Project Created' : item.type === 'deal-updated' ? 'Updated' : 'Note Added');
    const { Icon, background, color } = kindStyle(kind);
    const detail = [item.title, item.description].filter(Boolean).filter((value, position, list) => list.indexOf(value) === position).join(' — ');
    return <li key={item.id || index}><time>{Number.isNaN(stamp.getTime()) ? '—' : stamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</time><span className="deal-timeline-icon" style={{ background, color }}><Icon size={14} /></span><strong>{kind}</strong><span className="deal-activity-actor">{item.actor || 'System'}</span><p>{detail || kind}</p></li>;
  })}</ol></section>)}</div>;
}

export function DocumentsTable({ documents, onRemove }) {
  const [preview, setPreview] = useState(null);
  const type = (item) => (item.name?.split('.').pop() || item.mimeType?.split('/').pop() || 'File').toUpperCase();
  return <><Table columns={['#', 'File Name', 'Type', 'Uploaded By', 'Date', 'Actions']} count={documents.length} empty="No documents uploaded yet.">{documents.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td className="deal-cell-primary"><button className="deal-text-action" onClick={() => setPreview(item)}>{item.name}</button></td><td>{type(item)}</td><td>{item.uploadedBy || 'Not recorded'}</td><td>{formatDealDate(item.createdAt)}</td><td><div className="deal-row-actions"><button aria-label={`View ${item.name}`} onClick={() => setPreview(item)}><Eye size={14} /></button><a aria-label={`Download ${item.name}`} href={item.data} download={item.name}><Download size={14} /></a><button className="deal-delete-action" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item)}><Trash2 size={14} /></button></div></td></tr>)}</Table><Modal isOpen={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name} size="lg">{preview && <><p className="deal-action-hint">{type(preview)} · {Math.ceil((preview.size || 0) / 1024)} KB · {preview.uploadedBy || 'Not recorded'}</p>{/^data:image\/(png|jpeg|gif|webp);/i.test(preview.data || '') ? <img className="deal-document-preview" src={preview.data} alt={preview.name} /> : /^data:application\/pdf;/i.test(preview.data || '') ? <iframe className="deal-document-preview" title={preview.name} sandbox="" src={preview.data} /> : <p className="deal-detail-empty">Download this file to view its contents.</p>}<a className="btn-primary btn-sm" href={preview.data} download={preview.name}><Download size={14} />Download</a></>}</Modal></>;
}

export function QuotationsTable({ quotations }) {
  return <Table columns={['#', 'Quotation', 'Date', 'Amount', 'Status', 'Sent On', 'Actions']} count={quotations.length} empty="No quotations linked to this deal yet.">{quotations.map((quote, index) => {
    const url = `/crm/quotations?quotationId=${encodeURIComponent(quote.id)}`;
    const sentOn = quote.sentAt || quote.sentOn || (quote.activity || quote.activities)?.find((item) => /sent/i.test(item.type))?.timestamp;
    return <tr key={quote.id}><td>{index + 1}</td><td><Link className="deal-text-action" to={url}>{quote.quoteNumber || quote.id}</Link></td><td>{formatDealDate(quote.date)}</td><td>{formatDealMoney(quote.amount)}</td><td><Status value={quote.status} /></td><td>{sentOn ? formatDealDate(sentOn) : 'Not sent'}</td><td><div className="deal-row-actions"><Link aria-label={`View ${quote.quoteNumber || quote.id}`} to={url}><Eye size={14} /></Link><Link aria-label={`Print ${quote.quoteNumber || quote.id}`} to={`${url}&print=true`}><Printer size={14} /></Link></div></td></tr>;
  })}</Table>;
}

export function TasksTable({ tasks, onEdit, onRemove }) {
  return <Table columns={['#', 'Task', 'Assignee', 'Due Date', 'Status', 'Actions']} count={tasks.length} empty="No tasks linked to this deal yet.">{tasks.map((task, index) => <tr key={task.id}><td>{index + 1}</td><td className="deal-cell-primary">{task.title}</td><td>{task.owner || 'Unassigned'}</td><td>{formatDealDate(task.dueDate)}</td><td><Status value={task.status} /></td><td><div className="deal-row-actions"><button aria-label={`Edit task ${task.title}`} onClick={() => onEdit(task)}><Pencil size={14} /></button><button className="deal-delete-action" aria-label={`Remove task ${task.title}`} onClick={() => onRemove(task)}><Trash2 size={14} /></button></div></td></tr>)}</Table>;
}

export function RelatedCards({ deal, customer }) {
  const [customerOpen, setCustomerOpen] = useState(false);
  return <><div className="deal-related-cards"><article><FileText size={20} /><h3>Source Lead</h3><strong>{deal.leadNumber || deal.leadId || 'Not linked'}</strong><p>{deal.leadName || 'Source enquiry'}</p>{deal.leadId != null && <Link className="btn-outline btn-sm" to={`/crm/leads/${encodeURIComponent(deal.leadId)}`}>View Lead</Link>}</article><article><Building2 size={20} /><h3>Customer</h3><strong>{customer?.code || customer?.id || deal.customerId || deal.partyId || deal.client || 'Not specified'}</strong><p>{customer?.name || deal.client}</p>{(customer || deal.client) && <button className="btn-outline btn-sm" onClick={() => setCustomerOpen(true)}>View Customer</button>}</article></div><Modal isOpen={customerOpen} onClose={() => setCustomerOpen(false)} title="Customer Details"><dl className="deal-info-list">{[['Name', customer?.name || deal.client], ['Contact Person', customer?.contactPerson || deal.contactPerson], ['Email', customer?.email || deal.email], ['Phone', customer?.phone || deal.phone], ['Customer Code', customer?.code || deal.customerId || deal.partyId]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not specified'}</dd></div>)}</dl></Modal></>;
}
