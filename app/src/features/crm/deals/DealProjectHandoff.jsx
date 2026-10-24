import { useState } from 'react';
import { ArrowRight, CheckCircle2, CircleDashed, FolderPlus, Handshake } from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../../../components/ui/Modal';
import { loadDeals } from '../../../services/dealService';
import { createProjectFromDeal, findDealProject, projectDefaults } from '../../../services/dealProjectService';

function TransferConfirmation({ project }) {
  const items = [
    ['Project created from deal', true], ['Deal ID linked', Boolean(project.sourceDealId)],
    [project.customer || project.customerId || project.partyId ? 'Customer transferred' : 'Customer not specified', Boolean(project.customer || project.customerId || project.partyId)],
    [project.owner || project.ownerId ? 'Owner transferred' : 'Owner not specified', Boolean(project.owner || project.ownerId)],
    [project.team || project.teamId ? 'Team transferred' : 'No team assigned', Boolean(project.team || project.teamId)],
  ];
  return <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">{items.map(([label, confirmed]) => <p key={label} className="flex items-center gap-2 text-xs text-slate-600">{confirmed ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> : <CircleDashed size={14} className="text-slate-400 shrink-0" />}{label}</p>)}</div>;
}

export default function DealProjectHandoff({ deal, onNotify, renderTrigger }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  let project = null;
  let referenceError = '';
  try { project = findDealProject(deal); }
  catch (failure) { referenceError = failure.message; }

  function open() {
    try {
      const current = loadDeals().find((item) => item.id === deal.id);
      if (!current) throw new Error('Deal was not found.');
      const linked = findDealProject(current);
      if (linked) { setSuccess({ project: linked, created: false }); return; }
      if (current.stage !== 'Won') throw new Error('Save the deal as Won before creating a project.');
      setError('');
      setForm(projectDefaults(current));
    } catch (failure) { onNotify(failure.message); }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await createProjectFromDeal(deal.id, form);
      setForm(null);
      setSuccess(result);
      onNotify(result.created ? `Project ${result.project.projectNumber} created and linked to Deal ${deal.id}.` : `Project already exists: ${result.project.projectNumber}`);
    } catch (failure) {
      console.error('[CRM Project] Hand-off failed:', failure);
      setError(failure.message);
      onNotify(failure.message);
    } finally { setBusy(false); }
  }

  return <>
    {renderTrigger ? renderTrigger({ open, project, referenceError }) : <div className="mx-5 mt-4 rounded-xl border border-slate-200 p-4 text-xs space-y-3">
      {referenceError ? <p role="alert" className="text-rose-600">{referenceError}</p> : project ? <>
        <div className="flex items-start gap-3"><span className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 size={19} /></span><div className="min-w-0"><p className="font-bold text-sm">Project Already Created</p><p className="mt-1 font-semibold text-blue-600">{project.projectNumber}</p><p className="mt-1 text-slate-500 break-words">{project.name}</p></div><span className="ml-auto rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{project.status}</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-3">
          <div><p className="text-slate-500">Created On</p><time className="block mt-1 font-semibold" dateTime={project.createdAt}>{project.createdAt ? new Date(project.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not specified'}</time></div>
          {deal.leadId != null && <div><p className="text-slate-500">Source Lead</p><Link className="inline-block mt-1 font-semibold text-blue-600 hover:underline" to={`/crm/leads/${encodeURIComponent(deal.leadId)}`}>{deal.leadNumber || deal.leadId}</Link></div>}
        </div>
        <div className="rounded-lg bg-emerald-50/60 p-3 space-y-2"><p className="font-semibold text-emerald-700">Project Linked</p><p className="text-slate-600 leading-5">This deal has been converted to a project. Open the linked project to view its details.</p><Link className="btn-outline btn-sm" to={`/crm/projects/${encodeURIComponent(project.id)}`}>View Project<ArrowRight size={13} /></Link></div>
      </> : deal.stage === 'Won' ? <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><FolderPlus size={20} className="text-blue-600" /><div><p className="font-bold">Create a project from this deal</p><p className="text-slate-500 mt-1">Carry over customer, owner and team details.</p></div></div><button type="button" className="btn-primary btn-sm" onClick={open}>Create Project</button></div> : <p className="text-slate-500">Project hand-off is available after the deal is saved as Won.</p>}
      {(deal.activities || []).filter((item) => item.type === 'project-created').map((item) => <p key={item.id} className="text-slate-500 border-t border-slate-100 pt-2 leading-5">{project ? item.title.replace(project.id, project.projectNumber) : item.title}</p>)}
    </div>}
    <Modal isOpen={Boolean(form)} onClose={() => !busy && setForm(null)} title="Create Project from Deal" subtitle="Pre-filled information from the deal" size="lg">
      {form && <form onSubmit={submit} className="space-y-5 text-xs">
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3"><Handshake size={19} className="text-blue-600 shrink-0" /><div><p className="font-semibold text-blue-700">{deal.name}</p><p className="mt-1 text-slate-500">Source Deal: {deal.dealNumber || deal.id}</p></div><span className="ml-auto bg-emerald-50 text-emerald-700 rounded-full px-2 py-1">{deal.stage}</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1.5 font-semibold text-slate-600">Project Name *<input required className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="space-y-1.5 font-semibold text-slate-600">Customer *<input readOnly required className="bg-slate-50 text-slate-500 block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" value={form.customer || deal.customerId || deal.partyId || ''} /></label>
          <label className="space-y-1.5 font-semibold text-slate-600">Project Manager *<input readOnly required className="bg-slate-50 text-slate-500 block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" value={form.owner || deal.ownerId || ''} /></label>
          <label className="space-y-1.5 font-semibold text-slate-600">Team<input readOnly className="bg-slate-50 text-slate-500 block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" value={form.team || deal.teamId || ''} placeholder="No team assigned" /></label>
          <label className="space-y-1.5 font-semibold text-slate-600 sm:col-span-2">Project Type<input className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" value={form.projectType} onChange={(event) => setForm({ ...form, projectType: event.target.value })} placeholder="Optional" /></label>
          <label className="space-y-1.5 font-semibold text-slate-600">Start Date *<input type="date" required className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
          <label className="space-y-1.5 font-semibold text-slate-600">Expected End Date<input type="date" className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" value={form.expectedEndDate} onChange={(event) => setForm({ ...form, expectedEndDate: event.target.value })} /></label>
        </div>
        <label className="block space-y-1">Description<textarea className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-400" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label className="flex items-center gap-2 text-slate-600"><input type="checkbox" checked disabled className="accent-blue-600" />Link this project to the deal</label>
        {error && <p role="alert" className="text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => setForm(null)}>Cancel</button>
          <button type="submit" className="btn-primary btn-sm" disabled={busy}>{busy ? 'Creating...' : 'Create Project'}</button>
        </div>
      </form>}
    </Modal>
    <Modal isOpen={Boolean(success)} onClose={() => setSuccess(null)} title={success?.created ? 'Project Created Successfully!' : 'Project Already Created'} footer={success && <><button type="button" className="btn-outline btn-sm" onClick={() => setSuccess(null)}>Back to Deal</button><Link className="btn-primary btn-sm" to={`/crm/projects/${encodeURIComponent(success.project.id)}`}>View Project<ArrowRight size={14} /></Link></>}>
      {success && <><div className="flex gap-3 items-start"><span className="rounded-full bg-emerald-50 p-3 text-emerald-600"><CheckCircle2 size={24} /></span><div className="min-w-0"><p className="font-bold text-blue-600">{success.project.projectNumber}</p><p className="mt-1 text-sm font-semibold break-words">{success.project.name}</p><p className="mt-2 text-xs leading-6 text-slate-500">Project {success.project.projectNumber} has been created and linked to Deal {deal.dealNumber || deal.id}.</p></div></div><TransferConfirmation project={success.project} /></>}
    </Modal>
  </>;
}
