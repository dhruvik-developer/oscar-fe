import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, FileText, Menu, MoreHorizontal, Pencil, Plus, Trophy, Upload, X } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { useERP } from '../../../context/ERPContext';
import { loadCrmTasks, saveCrmTasks, CRM_EVENT } from '../../../services/leadStageAutomation';
import { crmService } from '../../../services/domainServices';
import { isServerId, isBackendEnabled } from '../../../services/resourceSync';
import { useCrmStore } from '../../../stores/crmStore';
import './DealDetailView.css';
import { ActivitiesTimeline, DocumentsTable, ProductsTable, QuotationsTable, RelatedCards, TasksTable, dealTotals } from './DealTabContent';
import { useAppStore } from '../../../stores/appStore';

const money = (value) => `₹ ${Number(value || 0).toLocaleString('en-IN')}`;
const date = (value) => {
  if (!value) return 'Not specified';
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
function Panel({ title, action, children }) {
  return <section className="deal-detail-panel"><div className="deal-detail-panel-title"><h2>{title}</h2>{action}</div><div className="deal-detail-panel-body">{children}</div></section>;
}
function Empty({ children }) { return <p className="deal-detail-empty">{children}</p>; }

/**
 * Backend mirrors for the deal workspace tabs. The deal object carries
 * local-only arrays (`products`, `documents`, `activities`); every row that
 * can live in Postgres is written through `/crm/deals/{id}/…` (or
 * `/crm/tasks/` for tasks) and annotated with its server id so later edits,
 * completion and deletes reach the same row. Rows that cannot be represented
 * server-side stay local instead of 400ing.
 */
const backendDealOn = (deal) => isBackendEnabled() && deal && isServerId(deal.id);

const serverDealLineToRow = (r) => ({
  id: r.id,
  serverLineId: r.id,
  name: r.name || '',
  description: r.description || '',
  details: r.description || '',
  qty: Number(r.qty ?? 1),
  rate: Number(r.rate ?? 0),
  unit: r.unit || 'Qty',
  amount: Number(r.qty ?? 1) * Number(r.rate ?? 0),
});

const serverDealDocToRow = (r) => ({
  id: r.id,
  serverDocumentId: r.id,
  name: r.fileName || r.label || '',
  fileName: r.fileName || '',
  size: r.fileSize ?? null,
  mimeType: '',
  uploadedBy: '',
  url: r.url || '',
  downloadUrl: r.url || '',
  label: r.label || '',
  createdAt: r.createdAt || r.created_at,
});

const serverDealActivityToRow = (r) => ({
  id: r.id,
  serverActivityId: r.id,
  title: r.description || r.type || 'Update',
  description: r.description || '',
  actor: r.actorName || '',
  timestamp: r.createdAt || r.created_at,
  type: 'activity',
});

const serverDealTaskToRow = (t, dealId) => ({
  id: `srv-${t.id}`,
  serverTaskId: t.id,
  title: t.title || '',
  dealId,
  owner: t.assigneeName || t.owner || 'Unassigned',
  dueDate: t.dueDate || '',
  priority: t.priority || 'Medium',
  status: t.status || 'Open',
  source: 'Deal',
  description: t.description || '',
  updatedAt: t.updatedAt || new Date().toISOString(),
});

export default function DealDetailView({ deal, onEdit, onNotify, onUpdate, onDuplicate, onDelete }) {
  const navigate = useNavigate();
  const { quotations, customers } = useERP();
  const currentUser = useAppStore((state) => state.currentUser);
  const [tab, setTab] = useState('Overview');
  const [tasks, setTasks] = useState(loadCrmTasks);
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState('');
  const [removal, setRemoval] = useState(null);
  // Latest deal rows for server-id remaps after optimistic saves resolve.
  const dealRef = useRef(deal);
  dealRef.current = deal;
  // The floating "Menu" button drives the app-wide mobile navigation drawer
  // (backdrop, Escape and route-change dismissal live in MainLayout).
  const navigationOpen = useAppStore((state) => state.mobileSidebarOpen);
  const toggleNavigation = useAppStore((state) => state.toggleMobileSidebar);
  useEffect(() => {
    const sync = () => setTasks(loadCrmTasks());
    window.addEventListener(CRM_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(CRM_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  // Backend-first for the workspace tabs: rows already saved under this deal
  // load here (matched by their server ids), so a refresh keeps everything.
  useEffect(() => {
    if (!backendDealOn(deal)) return;
    let live = true;
    (async () => {
      try {
        const [linesBody, docsBody, actsBody, tasksBody] = await Promise.all([
          crmService.getDealLines(deal.id).catch(() => null),
          crmService.getDealDocuments(deal.id).catch(() => null),
          crmService.getDealActivities(deal.id).catch(() => null),
          crmService.getTasks({ dealId: deal.id }).catch(() => null),
        ]);
        if (!live) return;
        const rowsOf = (body) => (Array.isArray(body) ? body : (body?.results || []));
        const lines = rowsOf(linesBody);
        const docs = rowsOf(docsBody);
        const acts = rowsOf(actsBody);
        const dealTasks = rowsOf(tasksBody);
        if (lines.length) {
          const known = new Set((deal.products || []).map((p) => p.serverLineId).filter(Boolean));
          const incoming = lines.filter((r) => r?.id && !known.has(String(r.id))).map(serverDealLineToRow);
          if (incoming.length) onUpdate({ products: [...(deal.products || []), ...incoming] });
        }
        if (docs.length) {
          const known = new Set((deal.documents || []).map((d) => d.serverDocumentId).filter(Boolean));
          const incoming = docs.filter((r) => r?.id && !known.has(String(r.id))).map(serverDealDocToRow);
          if (incoming.length) onUpdate({ documents: [...(deal.documents || []), ...incoming] });
        }
        if (acts.length) {
          const known = new Set((deal.activities || []).map((a) => a.serverActivityId).filter(Boolean));
          const incoming = acts.filter((r) => r?.id && !known.has(String(r.id))).map(serverDealActivityToRow);
          if (incoming.length) onUpdate({ activities: [...incoming, ...(deal.activities || [])] });
        }
        if (dealTasks.length) {
          setTasks((prev) => {
            const known = new Set(prev.map((t) => t.serverTaskId).filter(Boolean));
            const incoming = dealTasks
              .filter((r) => r?.id && !known.has(String(r.id)))
              .map((r) => serverDealTaskToRow(r, deal.id));
            if (!incoming.length) return prev;
            saveCrmTasks([...incoming, ...prev]);
            return [...incoming, ...prev];
          });
        }
      } catch { /* offline — local workspace stays */ }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id]);
  if (!deal) return <div className="card p-8"><h1 className="text-xl font-bold mb-4">Deal not found</h1><Link to="/crm/deals" className="btn-outline">Back to Deals</Link></div>;

  const products = Array.isArray(deal.products) ? deal.products.map((item, index) => ({ ...item, id: item.id || `product-${index}`, name: item.name || item.description || item.product || item.id, qty: item.qty ?? item.quantity ?? 1, rate: item.rate ?? item.price ?? 0 })) : deal.product ? [{ id: 'legacy-product', name: deal.product, qty: deal.quantity || 1, unit: 'Qty', rate: Number(deal.price || 0) / (deal.quantity || 1) }] : [];
  const activities = deal.activities || [];
  const documents = deal.documents || [];
  const contracts = deal.contracts || [];
  const linkedTasks = tasks.filter((task) => String(task.dealId) === String(deal.id));
  const linkedQuotes = quotations.filter((quote) => String(quote.dealId) === String(deal.id) || quote.dealReference === (deal.dealNumber || deal.id));
  const customer = customers.find((item) => String(item.id) === String(deal.customerId || deal.partyId) || item.name === deal.client);
  const actor = currentUser?.name || currentUser?.fullName || 'CRM User';
  const openEditor = (type, values = {}) => { setError(''); setEditor({ type, ...values }); };
  const notifyFailure = (failure) => onNotify(failure.message || 'Unable to save changes.');
  function save(patch, title) {
    onUpdate({ ...patch, activities: [{ id: crypto.randomUUID(), title, actor, timestamp: new Date().toISOString(), type: 'deal-updated' }, ...activities] });
    onNotify(title);
  }
  function createQuote() {
    navigate('/crm/quotations', { state: { fromDeal: true, dealId: deal.id, dealReference: deal.dealNumber || deal.id, customerId: deal.customerId || deal.partyId, company: deal.client, items: products.map((item) => ({ name: item.name, qty: item.qty, rate: item.rate })) } });
  }
  function submit(event) {
    event.preventDefault();
    try {
      if (editor.type === 'Pricing') {
        const discount = Number(editor.discount || 0);
        const taxRate = Number(editor.taxRate || 0);
        const subtotal = dealTotals(products).subtotal;
        if (!Number.isFinite(discount) || discount < 0 || discount > subtotal || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error('Discount must be within the subtotal and tax must be between 0 and 100%.');
        save({ discount, taxRate, price: dealTotals(products, discount, taxRate).total }, 'Discount and tax updated');
        setEditor(null);
        return;
      }
      const title = editor.title?.trim();
      if (!title) throw new Error('Enter a title.');
      if (editor.type === 'Task') {
        const existing = loadCrmTasks();
        const task = { ...(editor.id ? existing.find((item) => item.id === editor.id) : {}), id: editor.id || `task-${crypto.randomUUID()}`, title, dealId: deal.id, owner: editor.owner || deal.assignedUser || 'Unassigned', dueDate: editor.dueDate, priority: editor.priority || 'Medium', status: editor.status || 'Open', source: 'Deal', updatedAt: new Date().toISOString() };
        if (!task.createdAt) task.createdAt = task.updatedAt;
        if (task.status === 'Completed') {
          task.completedAt ||= task.updatedAt;
          task.completedBy ||= actor;
        } else {
          delete task.completedAt;
          delete task.completedBy;
        }
        if (!saveCrmTasks(editor.id ? existing.map((item) => item.id === editor.id ? task : item) : [task, ...existing])) throw new Error('Task could not be saved.');
        if (backendDealOn(deal)) {
          const store = useCrmStore.getState();
          const member = (store.teamMembers || []).find((m) => m.name === task.owner);
          const payload = {
            title: task.title,
            description: task.description || undefined,
            dealId: deal.id,
            assigneeId: member && isServerId(member.id) ? member.id : undefined,
            dueDate: task.dueDate || undefined,
            priority: task.priority || 'Medium',
            status: task.status || 'Open',
          };
          const req = task.serverTaskId
            ? store.updateTask(task.serverTaskId, payload)
            : store.createTask(payload);
          req.then((saved) => {
            if (saved?.id) {
              saveCrmTasks(loadCrmTasks().map((t) => (t.id === task.id ? { ...t, serverTaskId: saved.id } : t)));
            }
          }).catch((err) => console.warn('[CRM] deal task not saved:', err?.message || err));
        }
        setTab('Tasks');
        onNotify(editor.id ? 'Task updated.' : 'Task created and linked to this deal.');
      } else if (editor.type === 'Product') {
        const item = { ...(products.find((product) => product.id === editor.id) || {}), id: editor.id || crypto.randomUUID(), name: title, description: editor.description || '', details: editor.description || '', qty: Number(editor.qty), rate: Number(editor.rate), unit: editor.unit || 'Qty' };
        if (!Number.isFinite(item.qty) || item.qty <= 0 || !Number.isFinite(item.rate) || item.rate < 0) throw new Error('Enter a positive quantity and a valid rate.');
        const updated = editor.id ? products.map((product) => product.id === editor.id ? item : product) : [...products, item];
        const totals = dealTotals(updated, deal.discount, deal.taxRate);
        save({ products: updated, discount: totals.discount, price: totals.total }, 'Products and deal value updated');
        if (backendDealOn(deal)) {
          const payload = { name: item.name, description: item.description || '', qty: item.qty, rate: item.rate, unit: item.unit || 'Qty' };
          const req = item.serverLineId
            ? crmService.updateDealLine(deal.id, item.serverLineId, payload)
            : crmService.addDealLine(deal.id, payload);
          req.then((saved) => {
            if (saved?.id) {
              const latest = dealRef.current?.products || [];
              onUpdate({ products: latest.map((p) => (p.id === item.id ? { ...p, serverLineId: saved.id } : p)) });
            }
          }).catch((err) => console.warn('[CRM] deal line not saved:', err?.message || err));
        }
        setTab('Products');
      } else if (editor.type === 'Contract') {
        save({ contracts: [{ id: crypto.randomUUID(), title, terms: editor.terms || '', status: 'Draft', createdAt: new Date().toISOString() }, ...contracts] }, 'Contract draft saved');
        setTab('Related');
      } else if (editor.type === 'Summary') {
        save({ description: title }, 'Summary updated');
      } else {
        const entry = { id: crypto.randomUUID(), title, description: editor.description || '', activityType: editor.activityType || 'Note Added', actor, timestamp: new Date().toISOString(), type: 'activity' };
        onUpdate({ activities: [entry, ...activities] });
        if (backendDealOn(deal)) {
          crmService.postDealActivity(deal.id, { type: entry.activityType, description: title }).then((saved) => {
            if (saved?.id) {
              const latest = dealRef.current?.activities || [];
              onUpdate({ activities: latest.map((a) => (a.id === entry.id ? { ...a, serverActivityId: saved.id } : a)) });
            }
          }).catch((err) => console.warn('[CRM] deal activity not saved:', err?.message || err));
        }
        onNotify('Activity added');
        setTab('Activities');
      }
      setEditor(null);
    } catch (failure) { setError(failure.message); }
  }
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a document smaller than 2 MB.');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The document could not be read.'));
        reader.readAsDataURL(file);
      });
      const row = { id: crypto.randomUUID(), name: file.name, size: file.size, mimeType: file.type, uploadedBy: actor, data, createdAt: new Date().toISOString() };
      save({ documents: [...documents, row] }, `Document added: ${file.name}`);
      // Persist the bytes first, then pin the file record to the deal.
      if (backendDealOn(deal)) {
        try {
          const { uploadFileToBackend } = await import('../../../services/fileUploadService');
          const fileId = await uploadFileToBackend(file, file.name, 'deal_document');
          const saved = await crmService.addDealDocument(deal.id, { fileId, label: file.name });
          if (saved?.id) {
            const latest = dealRef.current?.documents || [];
            onUpdate({ documents: latest.map((d) => (d.id === row.id ? { ...d, serverDocumentId: saved.id, url: saved.url || d.url, downloadUrl: saved.url || d.downloadUrl } : d)) });
          }
        } catch (err) {
          console.warn('[CRM] deal document not saved:', err?.message || err);
        }
      }
    } catch (failure) { notifyFailure(failure); }
  }
  function removeRecord() {
    try {
      if (removal.type === 'Product') {
        const updated = products.filter((item) => item.id !== removal.item.id);
        const totals = dealTotals(updated, deal.discount, deal.taxRate);
        save({ products: updated, discount: totals.discount, price: totals.total }, 'Product removed');
        if (backendDealOn(deal) && removal.item.serverLineId) {
          crmService.deleteDealLine(deal.id, removal.item.serverLineId)
            .catch((err) => console.warn('[CRM] deal line not deleted:', err?.message || err));
        }
      } else if (removal.type === 'Document') {
        save({ documents: documents.filter((item) => item.id !== removal.item.id) }, 'Document removed');
        if (backendDealOn(deal) && removal.item.serverDocumentId) {
          crmService.deleteDealDocument(deal.id, removal.item.serverDocumentId)
            .catch((err) => console.warn('[CRM] deal document not deleted:', err?.message || err));
        }
      } else {
        if (!saveCrmTasks(loadCrmTasks().filter((item) => item.id !== removal.item.id))) throw new Error('Task could not be removed.');
        if (backendDealOn(deal) && removal.item.serverTaskId) {
          useCrmStore.getState().deleteTask(removal.item.serverTaskId)
            .catch((err) => console.warn('[CRM] deal task not deleted:', err?.message || err));
        }
        onNotify('Task removed');
      }
      setRemoval(null);
    } catch (failure) { notifyFailure(failure); }
  }
  const productTable = <ProductsTable products={products} discount={deal.discount} taxRate={deal.taxRate} onEdit={(item) => openEditor('Product', { ...item, title: item.name, description: item.details || item.description || '' })} onRemove={(item) => setRemoval({ type: 'Product', item })} onPricing={() => openEditor('Pricing', { discount: deal.discount || 0, taxRate: deal.taxRate || 0 })} />;

  const related = <><dl className="deal-info-list"><div><dt>Source Lead</dt><dd>{deal.leadId != null ? <Link to={`/crm/leads/${encodeURIComponent(deal.leadId)}`}>{deal.leadNumber || deal.leadId}</Link> : 'No source lead linked'}</dd></div><div><dt>Created On</dt><dd>{date(deal.createdAt)}</dd></div></dl></>;

  return <div className="crm-deal-detail">
    <button type="button" className="deal-mobile-menu btn-outline btn-sm" aria-label={navigationOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={navigationOpen} onClick={toggleNavigation}>{navigationOpen ? <X size={16} /> : <Menu size={16} />}Menu</button>
      <>
        <header className="deal-detail-header"><nav aria-label="Breadcrumb"><Link to="/crm/deals">CRM</Link><span> / </span><Link to="/crm/deals">Deals</Link><span> / {deal.dealNumber || deal.id}</span></nav><div className="deal-detail-heading"><div><p className="deal-eyebrow">Deal Detail</p><h1>{deal.name}</h1><div className="deal-detail-subtitle"><span>{deal.dealNumber || deal.id}</span><span className="deal-stage" data-won={deal.stage === 'Won'}>{deal.stage}</span>{deal.stage === 'Won' && <Trophy size={18} className="text-amber-500" />}<span>{deal.client}</span></div></div><div className="deal-header-actions"><button className="btn-outline btn-sm" onClick={() => onEdit(deal)}><Pencil size={14} />Edit</button><button className="btn-outline btn-sm" onClick={() => { try { onDuplicate(deal); } catch (failure) { notifyFailure(failure); } }}><Copy size={14} />Duplicate</button><details className="deal-more"><summary className="btn-outline btn-sm"><MoreHorizontal size={15} />More</summary><div><Link to="/crm/deals"><ArrowLeft size={14} />Back to Deals</Link><button onClick={() => onDelete(deal)}>Delete Deal</button></div></details></div></div></header>
        <div className="deal-detail-tabs" role="tablist" aria-label="Deal sections">{['Overview', 'Products', 'Activities', 'Documents', 'Quotations', 'Tasks', 'Related'].map((name) => {
          const count = { Products: products.length, Activities: activities.length, Documents: documents.length, Quotations: linkedQuotes.length, Tasks: linkedTasks.length, Related: contracts.length + Number(deal.leadId != null) + Number(Boolean(customer || deal.client)) }[name];
          return <button key={name} id={`deal-tab-${name}`} role="tab" aria-selected={tab === name} aria-controls="deal-tab-panel" tabIndex={tab === name ? 0 : -1} onKeyDown={(event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const buttons = [...event.currentTarget.parentElement.children]; const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (buttons.indexOf(event.currentTarget) + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length; buttons[next].focus(); buttons[next].click(); }} onClick={() => setTab(name)}>{name}{count != null && <span>{count}</span>}</button>;
        })}</div>
        <div role="tabpanel" id="deal-tab-panel" aria-labelledby={`deal-tab-${tab}`}>
          {tab === 'Overview' && <div className="deal-overview-grid"><Panel title="Deal Information"><dl className="deal-info-list">{[['Customer', deal.client], ['Contact Person', deal.contactPerson], ['Email', deal.email ? <a href={`mailto:${deal.email}`}>{deal.email}</a> : null], ['Phone', deal.phone ? <a href={`tel:${deal.phone}`}>{deal.phone}</a> : null], ['Deal Value', money(deal.price)], ['Expected Close Date', date(deal.expectedCloseDate || deal.date)], ['Source', deal.source], ['Owner', deal.assignedUser || deal.owner], ['Team', deal.team], ['Stage', deal.stage]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not specified'}</dd></div>)}</dl></Panel><div className="deal-detail-stack"><Panel title="Summary" action={<button aria-label="Edit summary" onClick={() => openEditor('Summary', { title: deal.description || deal.notes || '' })}><Pencil size={14} /></button>}><p className="deal-summary-text">{deal.description || deal.notes || 'Add a summary of the customer requirements and next steps.'}</p></Panel><Panel title={`Products (${products.length})`} action={<button className="deal-text-action" onClick={() => openEditor('Product', { qty: 1, rate: 0 })}><Plus size={14} />Add</button>}>{productTable}</Panel></div><div className="deal-detail-stack"><Panel title="Quick Actions"><div className="deal-quick-actions"><button className="btn-outline btn-sm" onClick={createQuote}><FileText size={16} />Create Quotation</button><button className="btn-outline btn-sm" onClick={() => openEditor('Contract', { title: `${deal.name} — contract` })}><FileText size={16} />Create Contract</button><button className="btn-outline btn-sm" onClick={() => openEditor('Task', { owner: deal.assignedUser })}><Plus size={16} />Add Task</button></div></Panel><Panel title="Related Information">{related}</Panel></div></div>}
          {tab === 'Products' && <Panel title={`Products (${products.length})`} action={<button className="btn-primary btn-sm" onClick={() => openEditor('Product', { qty: 1, rate: 0 })}><Plus size={14} />Add Product</button>}>{productTable}</Panel>}
          {tab === 'Activities' && <Panel title="Activities" action={<button className="btn-primary btn-sm" onClick={() => openEditor('Activity')}><Plus size={14} />Add Activity</button>}><ActivitiesTimeline activities={activities} /></Panel>}
          {tab === 'Documents' && <Panel title={`Documents (${documents.length})`} action={<label className="btn-primary btn-sm cursor-pointer"><Upload size={14} />Upload Document<input aria-label="Upload document" type="file" className="sr-only" onChange={upload} /></label>}><DocumentsTable documents={documents} onRemove={(item) => setRemoval({ type: 'Document', item })} /><p className="deal-action-hint">Maximum file size: 2 MB.</p></Panel>}
          {tab === 'Quotations' && <Panel title={`Quotations (${linkedQuotes.length})`} action={<button className="btn-primary btn-sm" onClick={createQuote}><Plus size={14} />Create Quotation</button>}><QuotationsTable quotations={linkedQuotes} /></Panel>}
          {tab === 'Tasks' && <Panel title={`Tasks (${linkedTasks.length})`} action={<button className="btn-primary btn-sm" onClick={() => openEditor('Task', { owner: deal.assignedUser })}><Plus size={14} />Add Task</button>}><TasksTable tasks={linkedTasks} onEdit={(task) => openEditor('Task', task)} onRemove={(item) => setRemoval({ type: 'Task', item })} /></Panel>}
          {tab === 'Related' && <div className="deal-detail-stack"><Panel title="Related Records"><RelatedCards deal={deal} customer={customer} /></Panel><Panel title="Contract Drafts" action={<button className="btn-primary btn-sm" onClick={() => openEditor('Contract', { title: `${deal.name} — contract` })}><Plus size={14} />Create Contract</button>}>{contracts.length ? <ul className="deal-record-list">{contracts.map((contract) => <li key={contract.id}><FileText size={18} /><div><strong>{contract.title}</strong><p>{contract.status} · {date(contract.createdAt)}</p><p className="whitespace-pre-wrap">{contract.terms}</p><a download={`${contract.title}.txt`} href={`data:text/plain;charset=utf-8,${encodeURIComponent(`${contract.title}\nDeal: ${deal.dealNumber || deal.id}\nCustomer: ${deal.client}\nStatus: Draft\n\n${contract.terms}`)}`}>Download draft</a></div></li>)}</ul> : <Empty>No contract drafts created yet.</Empty>}</Panel></div>}
        </div>
      </>
    <Modal isOpen={Boolean(removal)} onClose={() => setRemoval(null)} title={`Remove ${removal?.type || 'record'}`} footer={<><button className="btn-outline btn-sm" onClick={() => setRemoval(null)}>Cancel</button><button className="btn-primary btn-sm" onClick={removeRecord}>Remove</button></>}><p className="text-sm">Remove {removal?.item.name || removal?.item.title} from this deal?</p></Modal>
    <Modal isOpen={Boolean(editor)} onClose={() => setEditor(null)} title={editor ? `${editor.type === 'Summary' || editor.id ? 'Edit' : 'Add'} ${editor.type}` : ''}>
      {editor && <form onSubmit={submit} className="deal-detail-form">{editor.type !== 'Pricing' && <label>{editor.type === 'Product' ? 'Product name' : editor.type === 'Summary' ? 'Summary' : 'Title'} *{['Activity', 'Summary'].includes(editor.type) ? <textarea autoFocus required rows={4} value={editor.title || ''} onChange={(event) => setEditor({ ...editor, title: event.target.value })} /> : <input autoFocus required value={editor.title || ''} onChange={(event) => setEditor({ ...editor, title: event.target.value })} />}</label>}
        {editor.type === 'Product' && <><label>Description<textarea rows={2} value={editor.description || ''} onChange={(event) => setEditor({ ...editor, description: event.target.value })} /></label><div className="deal-form-grid">{[['qty', 'Quantity', 'number'], ['rate', 'Rate (₹)', 'number'], ['unit', 'Unit', 'text']].map(([key, label, type]) => <label key={key}>{label}<input required={key !== 'unit'} type={type} min={key === 'qty' ? '0.001' : '0'} step="any" value={editor[key] ?? ''} onChange={(event) => setEditor({ ...editor, [key]: event.target.value })} /></label>)}</div></>}
        {editor.type === 'Task' && <><label>Assigned to<input value={editor.owner || ''} onChange={(event) => setEditor({ ...editor, owner: event.target.value })} /></label><div className="deal-form-grid"><label>Due date *<input required type="date" value={editor.dueDate || ''} onChange={(event) => setEditor({ ...editor, dueDate: event.target.value })} /></label><label>Priority<select value={editor.priority || 'Medium'} onChange={(event) => setEditor({ ...editor, priority: event.target.value })}>{['Low', 'Medium', 'High', 'Urgent'].map((priority) => <option key={priority}>{priority}</option>)}</select></label></div><label>Status<select value={editor.status || 'Open'} onChange={(event) => setEditor({ ...editor, status: event.target.value })}>{['Open', 'In Progress', 'Waiting', 'Completed'].map((status) => <option key={status}>{status}</option>)}</select></label></>}
        {editor.type === 'Pricing' && <div className="deal-form-grid"><label>Discount (₹)<input aria-label="Discount" type="number" min="0" step="0.01" value={editor.discount} onChange={(event) => setEditor({ ...editor, discount: event.target.value })} /></label><label>Tax (%)<input aria-label="Tax rate" type="number" min="0" max="100" step="0.01" value={editor.taxRate} onChange={(event) => setEditor({ ...editor, taxRate: event.target.value })} /></label></div>}
        {editor.type === 'Activity' && <><label>Activity type<select value={editor.activityType || 'Note Added'} onChange={(event) => setEditor({ ...editor, activityType: event.target.value })}>{['Note Added', 'Meeting', 'Follow-up', 'Email'].map((type) => <option key={type}>{type}</option>)}</select></label><label>Details<textarea rows={3} value={editor.description || ''} onChange={(event) => setEditor({ ...editor, description: event.target.value })} /></label></>}
        {editor.type === 'Contract'  && <label>Terms *<textarea required rows={6} value={editor.terms || ''} onChange={(event) => setEditor({ ...editor, terms: event.target.value })} /></label>}
        {error && <p role="alert" className="text-rose-600">{error}</p>}<div className="deal-form-footer"><button type="button" className="btn-outline btn-sm" onClick={() => setEditor(null)}>Cancel</button><button className="btn-primary btn-sm" type="submit">Save {editor.type === 'Contract' ? 'Draft' : editor.type}</button></div></form>}
    </Modal>
  </div>;
}
