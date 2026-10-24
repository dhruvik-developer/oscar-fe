import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Download, MoreHorizontal, RefreshCw, Printer, Send,
  FileText, Upload, Trash2, X, CheckCircle2, Plus, ChevronDown,
  Handshake, UserRound, Link2, Phone, Flag, Users, FolderPlus,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import KpiCard from '../../../components/ui/KpiCard';
import PageInfoButton from '../../../components/ui/PageInfoButton';
import './ContractDetailPage.css';
import { printContract } from '../../../utils/contractPrint';
import { crmService } from '../../../services/domainServices';
import { useAppStore } from '../../../stores/appStore';
import {
  CONTRACT_TYPES,
  CONTRACT_TEMPLATES,
  findContract,
  refreshContractsCache,
  createContract,
  updateContract,
  deleteContract,
  appendDealActivity,
  addDealActivity,
  formatContractMoney,
  formatContractDate,
  getContractDisplayStatus,
} from '../../../services/contractService';

function statusTone(status) {
  if (/^active$/i.test(status)) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (/expiring/i.test(status)) return 'bg-amber-50 text-amber-700 border border-amber-200';
  if (/^expired$/i.test(status)) return 'bg-rose-50 text-rose-700 border border-rose-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function activityStyle(kind) {
  if (/creat/i.test(kind)) return { Icon: FolderPlus, background: '#d1fae5', color: '#059669' };
  if (/status/i.test(kind)) return { Icon: Flag, background: '#ffedd5', color: '#ea580c' };
  if (/deal|link|project/i.test(kind)) return { Icon: Link2, background: '#e0f2fe', color: '#0284c7' };
  if (/call/i.test(kind)) return { Icon: Phone, background: '#dcfce7', color: '#16a34a' };
  if (/note/i.test(kind)) return { Icon: FileText, background: '#fef3c7', color: '#d97706' };
  if (/quotation/i.test(kind)) return { Icon: FileText, background: '#dbeafe', color: '#2563eb' };
  if (/meeting/i.test(kind)) return { Icon: Users, background: '#ede9fe', color: '#7c3aed' };
  if (/task/i.test(kind)) return { Icon: CheckCircle2, background: '#e0f2fe', color: '#0284c7' };
  if (/update/i.test(kind)) return { Icon: Pencil, background: '#f1f5f9', color: '#475569' };
  return { Icon: CheckCircle2, background: '#eef2ff', color: '#4f46e5' };
}

function ContractActivitiesTimeline({ activities }) {
  if (!activities.length) return <p className="text-center py-8 text-xs text-slate-400">No activities recorded yet.</p>;
  const sorted = [...activities].sort((a, b) => (Date.parse(b.timestamp || b.time) || 0) - (Date.parse(a.timestamp || a.time) || 0));
  return (
    <ol className="contract-activity-list">
      {sorted.map((item, index) => {
        const stamp = new Date(item.timestamp || item.time);
        const valid = !Number.isNaN(stamp.getTime());
        const dateText = valid ? `${String(stamp.getDate()).padStart(2, '0')} ${MONTHS[stamp.getMonth()]} ${stamp.getFullYear()}` : '—';
        const timeText = valid ? stamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
        const kind = item.activityType || (item.type === 'contract-created' ? 'Contract Created' : item.type === 'deal-updated' ? 'Status Changed' : 'Note Added');
        const { Icon, background, color } = activityStyle(kind);
        const detail = [item.title, item.description].filter(Boolean).filter((value, position, list) => list.indexOf(value) === position).join(' — ');
        return (
          <li key={item.id || index}>
            <div className="contract-activity-stamp"><strong>{dateText}</strong><span>{timeText}</span></div>
            <span className="contract-activity-icon" style={{ background, color }}><Icon size={13} /></span>
            <div className="contract-activity-detail"><strong>{kind}</strong><p>{detail || kind}</p><p>{item.actor || 'CRM User'}{item.previousStatus && item.newStatus ? ` · ${item.previousStatus} → ${item.newStatus}` : ''}</p></div>
          </li>
        );
      })}
    </ol>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden min-w-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <h2 className="text-[13px] font-bold text-slate-800">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function ContractDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const actor = currentUser?.name || currentUser?.fullName || 'CRM User';
  const [record, setRecord] = useState({ contract: null, deal: null, loading: true });
  const [tab, setTab] = useState('Terms & Conditions');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({});
  const [renew, setRenew] = useState({ startDate: '', endDate: '', amount: '' });
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityType, setActivityType] = useState('Note Added');
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDetails, setActivityDetails] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [openClause, setOpenClause] = useState(-1);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsForm, setTermsForm] = useState([]);
  const [sendingSign, setSendingSign] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [signer, setSigner] = useState({ signerName: '', signerEmail: '', message: '' });

  function refresh() {
    try {
      const found = findContract(id);
      setRecord({ contract: found.contract, deal: found.deal, loading: false });
      setError('');
    } catch (failure) { setRecord({ contract: null, deal: null, loading: false }); setError(failure.message); }
  }

  useEffect(() => {
    refreshContractsCache().then(() => refresh()).catch(() => refresh());
    window.addEventListener('storage', refresh);
    window.addEventListener('crm:data-updated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('crm:data-updated', refresh);
    };
  }, [id]);

  const { contract, deal } = record;
  const displayStatus = contract ? getContractDisplayStatus(contract) : '';
  const attachments = contract?.attachments || [];
  const activities = useMemo(() => {
    const list = (deal?.activities || []).filter(item => !item.contractId || String(item.contractId) === String(contract?.id));
    if (contract?.contractNumber && !list.some((item) => item.activityType === 'Contract Created' && String(item.contractId) === String(contract.id))) {
      list.push({
        id: `contract-created-${contract.id}`,
        activityType: 'Contract Created',
        title: `Contract ${contract.contractNumber} created.`,
        description: contract.description || '',
        actor: contract.createdBy || 'CRM User',
        timestamp: contract.createdAt,
        type: 'contract-created',
      });
    }
    return list;
  }, [deal, contract]);
  const relatedCount = Number(Boolean(contract?.customer)) + Number(Boolean(deal)) + Number(deal?.leadId != null);

  const tabs = useMemo(() => [
    { name: 'Overview' },
    { name: 'Documents', count: attachments.length },
    { name: 'Activities', count: activities.length },
    { name: 'Terms & Conditions' },
    { name: 'Related', count: relatedCount },
  ], [attachments.length, activities.length, relatedCount]);

  if (record.loading) return <div className="card p-8"><h1 className="font-bold">Loading contract…</h1></div>;
  if (!contract) return (
    <div className="card p-8 space-y-3">
      <FileText size={28} className="text-blue-600" />
      <h1 className="font-bold">{error || 'Contract not found'}</h1>
      <Link className="btn-outline btn-sm" to="/crm/contracts"><ArrowLeft size={14} /> Back to Contracts</Link>
    </div>
  );

  function openEdit() {
    setFormError('');
    setForm({
      customer: contract.customer || '', contractType: contract.contractType || '',
      amount: contract.amount ?? '', startDate: contract.startDate || '', endDate: contract.endDate || '',
      template: contract.template || '', description: contract.description || '',
      terms: contract.terms || '', status: contract.status || 'Active',
    });
    setEditOpen(true);
  }

  async function submitEdit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError('');
    try {
      await updateContract(contract.dealId, contract.id, form);
      setEditOpen(false);
      setNotice(`Contract ${contract.contractNumber} updated successfully.`);
      refresh();
    } catch (failure) { setFormError(failure.message); }
    finally { setBusy(false); }
  }

  async function handleClose() {
    try {
      await updateContract(contract.dealId, contract.id, { status: 'Closed' });
      appendDealActivity(contract.dealId, `Contract ${contract.contractNumber} closed.`);
      setCloseOpen(false);
      setNotice(`Contract ${contract.contractNumber} closed.`);
      refresh();
    } catch (failure) { setError(failure.message); }
  }

  async function handlePrintServer() {
    try {
      await crmService.printContract(contract.id);
    } catch {}
    window.print();
  }

  const serverId = contract.backendId || contract.id;

  function openSignature() {
    setFormError('');
    setSigner({ signerName: contract.customer || '', signerEmail: contract.esignSignerEmail || '', message: '' });
    setSignOpen(true);
  }

  async function submitSignature(event) {
    event.preventDefault();
    if (sendingSign) return;
    setSendingSign(true);
    setFormError('');
    try {
      await crmService.sendContractForSignature(serverId, signer);
      await refreshContractsCache();
      setSignOpen(false);
      setNotice(`Contract ${contract.contractNumber} sent to ${signer.signerEmail} for signature via DocuSign.`);
      refresh();
    } catch (failure) { setFormError(failure.message || 'Failed to send contract for signature.'); }
    finally { setSendingSign(false); }
  }

  async function checkSignatureStatus() {
    if (sendingSign) return;
    setSendingSign(true);
    try {
      const updated = await crmService.getContractSignatureStatus(serverId);
      await refreshContractsCache();
      refresh();
      setNotice(updated?.esignStatus === 'completed' ? 'Contract signed — the signed PDF is attached.' : `Signature status: ${updated?.esignStatus || 'unknown'}.`);
    } catch (failure) { setError(failure.message); }
    finally { setSendingSign(false); }
  }

  function openRenew() {
    setFormError('');
    setRenew({ startDate: contract.endDate || '', endDate: '', amount: contract.amount ?? '' });
    setRenewOpen(true);
  }

  async function submitRenew(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError('');
    try {
      const renewed = await createContract({
        dealId: contract.dealId, customer: contract.customer, contractType: contract.contractType,
        amount: renew.amount, startDate: renew.startDate, endDate: renew.endDate,
        description: contract.description, terms: contract.terms, template: contract.template,
        status: 'Active',
      });
      await updateContract(contract.dealId, contract.id, { status: 'Closed' });
      appendDealActivity(contract.dealId, `Contract ${contract.contractNumber} renewed as ${renewed.contractNumber}.`);
      setRenewOpen(false);
      setNotice(`Contract renewed as ${renewed.contractNumber}.`);
      navigate(`/crm/contracts/${encodeURIComponent(renewed.id)}`);
    } catch (failure) { setFormError(failure.message); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    try {
      await deleteContract(contract.dealId, contract.id);
      navigate('/crm/contracts');
    } catch (failure) { setError(failure.message); }
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a file smaller than 2 MB.');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The file could not be read.'));
        reader.readAsDataURL(file);
      });
      await updateContract(contract.dealId, contract.id, {
        attachments: [...attachments, { id: `att-${Date.now()}`, name: file.name, size: file.size, mimeType: file.type, data, uploadedBy: actor, createdAt: new Date().toISOString() }],
      });
      setNotice(`Document ${file.name} attached.`);
      refresh();
    } catch (failure) { setError(failure.message); }
  }

  function submitActivity(event) {
    event.preventDefault();
    if (busy) return;
    const title = activityTitle.trim();
    if (!title) { setFormError('Enter an activity title.'); return; }
    setBusy(true);
    setFormError('');
    try {
      addDealActivity(contract.dealId, { activityType, title, description: activityDetails.trim(), actor });
      setActivityOpen(false);
      setActivityTitle('');
      setActivityDetails('');
      setActivityType('Note Added');
      setTab('Activities');
      setNotice('Activity added.');
      refresh();
    } catch (failure) { setFormError(failure.message); }
    finally { setBusy(false); }
  }

  const clauses = [];
  for (const rawLine of (contract.terms || '').split('\n').filter((text) => text.trim())) {
    const line = rawLine.trim();
    const separator = line.indexOf(':');
    if (separator > 0 && separator < 60 && !/^\s/.test(rawLine)) {
      clauses.push({ heading: line.slice(0, separator).replace(/^\d+[.)]\s*/, '').trim(), body: line.slice(separator + 1).trim() });
    } else if (clauses.length) {
      clauses[clauses.length - 1].body += `\n${line}`;
    } else {
      clauses.push({ heading: 'General Terms', body: line });
    }
  }

  function editTerms() {
    setFormError('');
    setTermsForm(clauses.length ? clauses.map((clause) => ({ ...clause })) : ['Payment Terms', 'Delivery Terms', 'Warranty', 'Support / SLA', 'Cancellation'].map((heading) => ({ heading, body: '' })));
    setTermsOpen(true);
  }

  async function saveTerms(event) {
    event.preventDefault();
    try {
      if (termsForm.some((clause) => !clause.heading.trim() || !clause.body.trim() || /[:\n]/.test(clause.heading))) throw new Error('Enter a heading without colons and the full terms for every row.');
      await updateContract(contract.dealId, contract.id, { terms: termsForm.map((clause) => `${clause.heading.trim()}: ${clause.body.trim().replace(/\n/g, '\n  ')}`).join('\n') });
      setTermsOpen(false);
      setOpenClause(-1);
      setNotice('Terms & Conditions updated.');
      refresh();
    } catch (failure) { setFormError(failure.message); }
  }

  function fileType(file) {
    return (file.name?.split('.').pop() || file.mimeType?.split('/').pop() || 'File').toUpperCase();
  }

  function removeAttachment(attachmentId) {
    try {
      updateContract(contract.dealId, contract.id, { attachments: attachments.filter((item) => item.id !== attachmentId) });
      refresh();
    } catch (failure) { setError(failure.message); }
  }

  const infoRows = [
    ['Contract Number', contract.contractNumber],
    ['Contract Type', contract.contractType],
    ['Customer', contract.customer],
    ['Deal', deal ? `${deal.dealNumber || deal.id} — ${deal.name}` : '—'],
    ['Template', contract.template || '—'],
    ['Start Date', formatContractDate(contract.startDate)],
    ['End Date', formatContractDate(contract.endDate)],
    ['Contract Value', formatContractMoney(contract.amount)],
    ['Status', displayStatus],
    ['Created By', contract.createdBy || 'CRM User'],
    ['Created On', formatContractDate(contract.createdAt)],
    ['Description', contract.description || '—'],
  ];

  return (
    <div className="contract-detail-page space-y-4 pb-6">
      <Link to="/crm/contracts" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline">
        <ArrowLeft size={13} /> Back to Contracts
      </Link>

      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</p>}

      <div className="card contract-detail-header p-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="contract-page-title">Contract Detail</h1>
                <PageInfoButton title="Contracts" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-slate-900">{contract.contractNumber}</p>
                <span className={`inline-block rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone(displayStatus)}`}>{displayStatus}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{contract.contractType} • {contract.customer}</p>
              {contract.esignStatus && (
                <p className="mt-1 text-xs text-slate-500">
                  Signature: <strong className="text-slate-700">{contract.esignStatus === 'completed' ? 'Signed' : contract.esignStatus === 'delivered' ? 'Viewed by signer' : contract.esignStatus === 'sent' ? 'Awaiting signature' : contract.esignStatus}</strong>
                  {contract.esignSignerEmail && ` · ${contract.esignSignerEmail}`}
                  {contract.signedFileUrl && <> · <a className="font-semibold text-blue-600 hover:underline" href={contract.signedFileUrl} target="_blank" rel="noreferrer">Signed PDF</a></>}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button type="button" className="btn-outline btn-sm" onClick={openEdit}><Pencil size={14} /> Edit</button>
            <button type="button" className="btn-outline btn-sm" onClick={handlePrintServer}><Printer size={14} /> Print</button>
            {['sent', 'delivered'].includes(contract.esignStatus)
              ? <button type="button" className="btn-outline btn-sm" disabled={sendingSign} onClick={checkSignatureStatus}><RefreshCw size={14} /> {sendingSign ? 'Checking…' : 'Check Signature'}</button>
              : contract.esignStatus !== 'completed' && <button type="button" className="btn-outline btn-sm" onClick={openSignature}><Send size={14} /> Send for Signature</button>}
            <button type="button" className="btn-outline btn-sm" onClick={() => printContract(contract, deal)}><Download size={14} /> Download PDF</button>
            <details className="relative">
              <summary className="btn-outline btn-sm cursor-pointer list-none"><MoreHorizontal size={15} /> More</summary>
              <div className="absolute z-10 top-full right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 text-xs">
                <button type="button" className="flex w-full items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-left" onClick={openRenew}><RefreshCw size={14} /> Renew Contract</button>
                <button type="button" className="flex w-full items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-left" onClick={() => setCloseOpen(true)}><CheckCircle2 size={14} /> Close Contract</button>
                <button type="button" className="flex w-full items-center gap-2 px-3.5 py-2 hover:bg-rose-50 text-rose-600 text-left" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Delete Contract</button>
              </div>
            </details>
          </div>
        </div>

        {tab === 'Overview' && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-4">
          <KpiCard label="Contract Value" value={formatContractMoney(contract.amount)} icon={FileText} tone="blue" />
          <KpiCard label="Start Date" value={formatContractDate(contract.startDate)} icon={Flag} tone="emerald" />
          <KpiCard label="End Date" value={formatContractDate(contract.endDate)} icon={CheckCircle2} tone="amber" />
        </div>}
      </div>

      <div className="card contract-detail-content">
        <div className="flex overflow-x-auto scrollbar-none gap-1 px-4 border-b border-slate-100" role="tablist" aria-label="Contract sections">
          {tabs.map(({ name, count }) => (
            <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}
              className={`inline-flex shrink-0 lg:shrink items-center gap-1.5 px-3 py-3 text-xs whitespace-nowrap border-b-2 ${tab === name ? 'text-blue-600 border-blue-600 font-semibold' : 'text-slate-500 border-transparent'}`}>
              {name}{count != null && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{count}</span>}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'Overview' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
              <Panel title="Contract Information">
                <dl className="grid gap-4 text-xs sm:grid-cols-2">
                  {infoRows.map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[11px] text-slate-400">{label}</dt>
                      <dd className="mt-1 font-semibold text-slate-700 break-words">{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
              <div className="grid gap-4 content-start">
                <Panel title="Summary">
                  <p className="text-xs leading-7 whitespace-pre-wrap break-words text-slate-600">{contract.description || 'No summary recorded.'}</p>
                </Panel>
                <Panel title="Quick Actions">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button type="button" className="btn-outline btn-sm justify-start" onClick={() => printContract(contract, deal)}><Download size={14} /> Download PDF</button>
                    <button type="button" className="btn-outline btn-sm justify-start" onClick={openEdit}><Pencil size={14} /> Edit Contract</button>
                    <button type="button" className="btn-outline btn-sm justify-start" onClick={() => setCloseOpen(true)}><X size={14} /> Close Contract</button>
                    <button type="button" className="btn-outline btn-sm justify-start col-span-2" onClick={openRenew}><RefreshCw size={14} /> Renew Contract</button>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {tab === 'Documents' && (
            <Panel title={`Documents (${attachments.length})`} action={
              <label className="btn-primary btn-sm cursor-pointer"><Upload size={14} /> Upload Document<input type="file" className="sr-only" onChange={uploadFile} /></label>
            }>
              {attachments.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">No documents attached yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-left text-slate-500">
                        <th className="px-3 py-2.5 font-semibold w-10">#</th>
                        <th className="px-3 py-2.5 font-semibold">File Name</th>
                        <th className="px-3 py-2.5 font-semibold">Type</th>
                        <th className="px-3 py-2.5 font-semibold">Uploaded By</th>
                        <th className="px-3 py-2.5 font-semibold">Date</th>
                        <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attachments.map((file, index) => (
                        <tr key={file.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                          <td className="px-3 py-2.5 text-slate-400">{index + 1}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-700 max-w-[260px] truncate">{file.name}</td>
                          <td className="px-3 py-2.5 text-slate-500">{fileType(file)}</td>
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{file.uploadedBy || 'Not recorded'}</td>
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{formatContractDate(file.createdAt)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end gap-1.5">
                              <a className="p-2 rounded-lg border border-slate-200 text-blue-600 hover:bg-blue-50" href={file.data} download={file.name} title="Download"><Download size={14} /></a>
                              <button type="button" className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50" title="Remove" onClick={() => removeAttachment(file.id)}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-[11px] text-slate-400">Maximum file size: 2 MB.</p>
            </Panel>
          )}

          {tab === 'Activities' && (
            <Panel title="Activities" action={
              <button type="button" className="btn-primary btn-sm" onClick={() => { setFormError(''); setActivityOpen(true); }}><Plus size={14} /> Add Activity</button>
            }>
              <ContractActivitiesTimeline activities={activities} />
            </Panel>
          )}

          {tab === 'Terms & Conditions' && (
            <Panel title="Terms & Conditions" action={
              <button type="button" className="btn-outline btn-sm" onClick={editTerms}><Pencil size={13} /> Edit</button>
            }>
              {clauses.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">No terms recorded.</p>
              ) : (
                <ol className="contract-terms-list">
                  {clauses.map((clause, index) => (
                    <li key={index}>
                      <button type="button" onClick={() => setOpenClause(openClause === index ? -1 : index)}
                        aria-expanded={openClause === index} aria-controls={`contract-clause-${index}`}
                        className="contract-term-row">
                        <span className="contract-term-number">{index + 1}.</span>
                        <span className="contract-term-heading">{clause.heading}</span>
                        <span className="contract-term-summary">{clause.body}</span>
                        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${openClause === index ? 'rotate-180' : ''}`} />
                      </button>
                      {openClause === index && (
                        <p id={`contract-clause-${index}`} className="contract-term-body">{clause.body}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          )}

          {tab === 'Related' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-blue-600"><UserRound size={20} /></span>
                <p className="mt-3 text-[11px] text-slate-400">Customer</p>
                <p className="mt-1 text-sm font-bold text-slate-800 break-words">{contract.customer}</p>
                <p className="mt-1 text-[11px] text-slate-400">{deal?.dealNumber || deal?.id || ''}</p>
                <button type="button" className="btn-outline btn-sm w-full mt-4" onClick={() => setCustomerOpen(true)}>View Customer</button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-amber-50 text-amber-600"><Handshake size={20} /></span>
                <p className="mt-3 text-[11px] text-slate-400">Deal</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{deal?.dealNumber || deal?.id || 'Not linked'}</p>
                <p className="mt-1 text-[11px] text-slate-400">{deal?.name || ''}</p>
                <p className="mt-1 text-[11px] text-slate-400">Value: {deal ? formatContractMoney(deal.price) : '—'} • Stage: {deal?.stage || '—'}</p>
                {deal ? (
                  <Link className="btn-outline btn-sm w-full mt-4" to={`/crm/deals?deal=${encodeURIComponent(deal.id)}`}>View Deal</Link>
                ) : (
                  <button type="button" className="btn-outline btn-sm w-full mt-4" disabled>View Deal</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={termsOpen} onClose={() => setTermsOpen(false)} title="Edit Terms & Conditions" size="lg">
        <form onSubmit={saveTerms} className="contract-terms-form">
          {termsForm.map((clause, index) => <fieldset key={index}>
            <legend>Clause {index + 1}</legend>
            <label>Heading<input required maxLength={59} value={clause.heading} onChange={(event) => setTermsForm(termsForm.map((item, position) => position === index ? { ...item, heading: event.target.value } : item))} /></label>
            <label>Terms<textarea required rows={3} value={clause.body} onChange={(event) => setTermsForm(termsForm.map((item, position) => position === index ? { ...item, body: event.target.value } : item))} /></label>
            <button type="button" className="contract-remove-clause" aria-label={`Remove clause ${index + 1}`} onClick={() => setTermsForm(termsForm.filter((_, position) => position !== index))}><Trash2 size={13} />Remove clause</button>
          </fieldset>)}
          <button type="button" className="btn-outline btn-sm" onClick={() => setTermsForm([...termsForm, { heading: '', body: '' }])}><Plus size={14} />Add Clause</button>
          {formError && <p role="alert" className="text-xs text-rose-600">{formError}</p>}
          <div className="contract-terms-footer"><button type="button" className="btn-outline btn-sm" onClick={() => setTermsOpen(false)}>Cancel</button><button type="submit" className="btn-primary btn-sm">Save Terms</button></div>
        </form>
      </Modal>

      <Modal isOpen={editOpen} onClose={() => !busy && setEditOpen(false)} title={`Edit ${contract.contractNumber}`} subtitle="Update contract details" size="lg">
        <form onSubmit={submitEdit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5 font-semibold text-slate-600">
              Contract Type *
              <select required value={form.contractType || ''} onChange={(e) => setForm({ ...form, contractType: e.target.value })}
                className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 bg-white">
                <option value="">Select type</option>
                {CONTRACT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 font-semibold text-slate-600">
              Status
              <select value={form.status || 'Active'} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 bg-white">
                {['Draft', 'Active', 'Closed', 'Cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 font-semibold text-slate-600">
              Customer *
              <input required value={form.customer || ''} onChange={(e) => setForm({ ...form, customer: e.target.value })}
                className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
            </label>
            <label className="space-y-1.5 font-semibold text-slate-600">
              Contract Value *
              <input type="number" required min="0" step="0.01" value={form.amount ?? ''} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
            </label>
            <label className="space-y-1.5 font-semibold text-slate-600">
              Start Date *
              <input type="date" required value={form.startDate || ''} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
            </label>
            <label className="space-y-1.5 font-semibold text-slate-600">
              End Date *
              <input type="date" required value={form.endDate || ''} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
            </label>
            <label className="space-y-1.5 font-semibold text-slate-600 sm:col-span-2">
              Template
              <select value={form.template || ''} onChange={(e) => setForm({ ...form, template: e.target.value })}
                className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 bg-white">
                <option value="">Select template</option>
                {CONTRACT_TEMPLATES.map((template) => <option key={template} value={template}>{template}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1.5 font-semibold text-slate-600">
            Description
            <textarea rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
          </label>
          <label className="block space-y-1.5 font-semibold text-slate-600">
            Terms & Conditions
            <textarea rows={4} value={form.terms || ''} onChange={(e) => setForm({ ...form, terms: e.target.value })}
              className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
          </label>
          {formError && <p role="alert" className="text-xs text-rose-600">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => setEditOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={signOpen} onClose={() => !sendingSign && setSignOpen(false)} title="Send for Signature" subtitle={`DocuSign will email ${contract.contractNumber} to the signer`}>
        <form onSubmit={submitSignature} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5 font-semibold text-slate-600">
              Signer Name *
              <input required value={signer.signerName} onChange={(e) => setSigner({ ...signer, signerName: e.target.value })}
                className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
            </label>
            <label className="space-y-1.5 font-semibold text-slate-600">
              Signer Email *
              <input type="email" required value={signer.signerEmail} onChange={(e) => setSigner({ ...signer, signerEmail: e.target.value })}
                className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
            </label>
          </div>
          <label className="block space-y-1.5 font-semibold text-slate-600">
            Message
            <textarea rows={3} value={signer.message} onChange={(e) => setSigner({ ...signer, message: e.target.value })}
              className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
          </label>
          {formError && <p role="alert" className="text-xs text-rose-600">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-outline btn-sm" disabled={sendingSign} onClick={() => setSignOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary btn-sm" disabled={sendingSign}><Send size={14} /> {sendingSign ? 'Sending…' : 'Send'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={renewOpen} onClose={() => !busy && setRenewOpen(false)} title="Renew Contract" subtitle={`Create a renewal from ${contract.contractNumber}`}>
        <form onSubmit={submitRenew} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5 font-semibold text-slate-600">
              New Start Date *
              <input type="date" required value={renew.startDate} onChange={(e) => setRenew({ ...renew, startDate: e.target.value })}
                className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
            </label>
            <label className="space-y-1.5 font-semibold text-slate-600">
              New End Date *
              <input type="date" required value={renew.endDate} onChange={(e) => setRenew({ ...renew, endDate: e.target.value })}
                className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
            </label>
          </div>
          <label className="block space-y-1.5 font-semibold text-slate-600">
            Contract Value *
            <input type="number" required min="0" step="0.01" value={renew.amount} onChange={(e) => setRenew({ ...renew, amount: e.target.value })}
              className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
          </label>
          {formError && <p role="alert" className="text-xs text-rose-600">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => setRenewOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary btn-sm" disabled={busy}>{busy ? 'Renewing…' : 'Renew Contract'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={closeOpen} onClose={() => setCloseOpen(false)} title="Close Contract"
        footer={<><button type="button" className="btn-outline btn-sm" onClick={() => setCloseOpen(false)}>Cancel</button>
          <button type="button" className="btn-primary btn-sm" onClick={handleClose}>Close Contract</button></>}>
        <p className="text-xs leading-6 text-slate-600">Close <strong>{contract.contractNumber}</strong>? Closed contracts remain in the list for reference.</p>
      </Modal>

      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Contract"
        footer={<><button type="button" className="btn-outline btn-sm" onClick={() => setDeleteOpen(false)}>Cancel</button>
          <button type="button" className="btn-sm rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700" onClick={handleDelete}>Delete</button></>}>
        <p className="text-xs leading-6 text-slate-600">Delete <strong>{contract.contractNumber}</strong>? This cannot be undone.</p>
      </Modal>

      <Modal isOpen={activityOpen} onClose={() => !busy && setActivityOpen(false)} title="Add Activity" subtitle={`Record activity for ${contract.contractNumber}`}>
        <form onSubmit={submitActivity} className="space-y-4 text-xs">
          <label className="block space-y-1.5 font-semibold text-slate-600">
            Activity Type
            <select value={activityType} onChange={(e) => setActivityType(e.target.value)}
              className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400 bg-white">
              {['Note Added', 'Meeting', 'Follow-up', 'Email'].map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5 font-semibold text-slate-600">
            Title *
            <input required value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} placeholder="e.g. Contract terms updated"
              className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
          </label>
          <label className="block space-y-1.5 font-semibold text-slate-600">
            Details
            <textarea rows={3} value={activityDetails} onChange={(e) => setActivityDetails(e.target.value)} placeholder="Additional details…"
              className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" />
          </label>
          {formError && <p role="alert" className="text-xs text-rose-600">{formError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => setActivityOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Add Activity'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={customerOpen} onClose={() => setCustomerOpen(false)} title="Customer Details">
        <dl className="grid gap-4 text-xs">
          {[
            ['Name', contract.customer],
            ['Contact Person', deal?.contactPerson],
            ['Email', deal?.email],
            ['Phone', deal?.phone],
            ['Deal', deal ? `${deal.dealNumber || deal.id} — ${deal.name}` : 'Not linked'],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[130px_1fr] gap-3">
              <dt className="text-slate-400">{label}</dt>
              <dd className="font-semibold text-slate-700 break-words">{value || 'Not specified'}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  );
}
