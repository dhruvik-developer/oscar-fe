import { useEffect, useState } from 'react';
import './ProjectDetailPage.css';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CalendarDays, CheckCircle2, CircleDashed, FileText, FolderOpen, Handshake, Link2, Menu, X, UserRound, Users } from 'lucide-react';
import { loadProjects } from '../../../services/dealProjectService';
import { loadDeals } from '../../../services/dealService';
import { useAppStore } from '../../../stores/appStore';
import KpiCard from '../../../components/ui/KpiCard';

function formatDate(value) {
  if (!value) return 'Not specified';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function InfoCard({ icon: Icon, title, children, action }) {
  return <section className="card project-panel overflow-hidden min-w-0">
    <div className="project-panel-heading flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <h2 className="flex items-center gap-2 text-sm font-bold"><Icon size={17} className="text-blue-600" />{title}</h2>{action}
    </div>
    <div className="p-5">{children}</div>
  </section>;
}

function Fields({ rows }) {
  return <dl className="project-fields grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">{rows.map(([label, value]) => <div key={label} className="min-w-0">
    <dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1.5 text-sm font-semibold break-words">{value ?? 'Not specified'}</dd>
  </div>)}</dl>;
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  // The floating "Menu" button drives the app-wide mobile navigation drawer
  // (backdrop, Escape and route-change dismissal live in MainLayout).
  const navigationOpen = useAppStore((state) => state.mobileSidebarOpen);
  const toggleNavigation = useAppStore((state) => state.toggleMobileSidebar);
  const [record, setRecord] = useState({ project: null, deal: null, error: '', loading: true });
  useEffect(() => {
    function read() {
      try {
        const project = loadProjects().find((item) => String(item.id) === id);
        let deal = null;
        let warning = '';
        try { deal = loadDeals().find((item) => String(item.id) === String(project?.sourceDealId)); }
        catch { warning = 'Source deal details could not be loaded.'; }
        setRecord({ project, deal, warning, error: '', loading: false });
      } catch (failure) { setRecord({ project: null, deal: null, error: failure.message, loading: false }); }
    }
    read();
    window.addEventListener('storage', read);
    window.addEventListener('crm:data-updated', read);
    return () => { window.removeEventListener('storage', read); window.removeEventListener('crm:data-updated', read); };
  }, [id]);
  const { project, deal } = record;
  if (!project) return <div className="card p-8 space-y-3"><FolderOpen size={28} className="text-blue-600" /><h1 className="font-bold">{record.loading ? 'Loading project...' : record.error || 'Project not found'}</h1><Link className="btn-outline btn-sm" to="/crm/deals">Back to Deals</Link></div>;
  const dealUrl = `/crm/deals?deal=${encodeURIComponent(project.sourceDealId)}`;
  const customer = project.customer || project.customerId || project.partyId;
  const owner = project.owner || project.ownerId;
  const team = project.team || project.teamId;
  const status = project.status || 'Not specified';
  const statusTone = /^(active|completed)$/i.test(status) ? 'positive' : 'neutral';
  const dealNumber = deal?.dealNumber || project.sourceDealId;
  const linked = deal && String(deal.projectId) === String(project.id);
  const checks = [
    ['Project created successfully', true],
    [linked ? 'Deal linked successfully' : 'Deal link needs attention', Boolean(linked)],
    [customer ? 'Customer transferred' : 'Customer not specified', Boolean(customer)],
    [owner ? 'Owner transferred' : 'Owner not specified', Boolean(owner)],
    [team ? 'Team transferred' : 'No team assigned', Boolean(team)],
  ];
  const summary = [
    ['Customer', customer || 'Not specified', Building2, 'blue'],
    ['Project Manager', owner || 'Not specified', UserRound, 'purple'],
    ['Team', team || 'Not assigned', Users, 'amber'],
    ['Status', status, statusTone === 'positive' ? CheckCircle2 : CircleDashed, statusTone === 'positive' ? 'emerald' : 'blue'],
  ];
  return <div className="crm-project-detail space-y-4 pb-5">
    <button type="button" className="project-mobile-navigation btn-outline btn-sm" aria-label={navigationOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={navigationOpen} onClick={toggleNavigation}>{navigationOpen ? <X size={16} /> : <Menu size={16} />}Menu</button>
    <header className="card project-hero p-5 sm:p-6 space-y-4">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-slate-500"><Link to="/dashboard" className="hover:text-slate-700">Dashboard</Link><span className="text-slate-300">›</span><span>CRM</span><span className="text-slate-300">›</span><Link to="/crm/deals" className="hover:text-slate-700">Deals</Link><span className="text-slate-300">›</span><span>Project</span><span className="text-slate-300">›</span><span className="text-slate-900 font-semibold">{project.projectNumber}</span></nav>
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex gap-3 min-w-0"><div className="rounded-xl bg-blue-50 p-3 text-blue-600 self-start"><FolderOpen size={25} /></div>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold tracking-wide text-slate-500">PROJECT {project.projectNumber}</span><span className="project-status" data-tone={statusTone}>{status}</span></div><h1 className="mt-2 text-[20px] font-extrabold tracking-tight text-slate-900 break-words">{project.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><Building2 size={14} />{customer || 'Customer not specified'}</span><Link to={dealUrl} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"><Handshake size={14} />Source Deal: {dealNumber}</Link></div>
          </div>
        </div>
        <Link className="btn-outline btn-sm self-start shrink-0" to={dealUrl}><ArrowLeft size={14} />Back to Deal</Link>
      </div>
      <div className="project-schedule">
        <div><CalendarDays size={17} /><span>Start date<strong>{formatDate(project.startDate)}</strong></span></div>
        <ArrowRight size={16} className="project-schedule-arrow" />
        <div><CalendarDays size={17} /><span>Expected end date<strong>{formatDate(project.expectedEndDate)}</strong></span></div>
      </div>
    </header>
    <div className="project-summary grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-4">
      {summary.map(([label, value, Icon, tone]) => <KpiCard key={label} label={label} value={value} icon={Icon} tone={tone} />)}
    </div>
    <div className="project-information-grid grid grid-cols-1 xl:grid-cols-2 gap-4">
      <InfoCard icon={FolderOpen} title="Project Information"><Fields rows={[
        ['Project Number', project.projectNumber], ['Project Name', project.name], ...(project.projectType ? [['Project Type', project.projectType]] : []), ['Customer', customer], ['Project Manager', owner], ['Team', team], ['Status', status], ['Start Date', formatDate(project.startDate)], ['Expected End Date', formatDate(project.expectedEndDate)],
      ]} /></InfoCard>
      <InfoCard icon={Handshake} title="Deal Information" action={<Link className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1 hover:underline" to={dealUrl}>View Deal<ArrowRight size={13} /></Link>}>
        {record.warning && <p role="alert" className="text-xs text-amber-700 mb-4">{record.warning}</p>}
        {deal && <div className="project-deal-value"><div><span>Deal value</span><strong>{deal.price != null ? `Rs. ${Number(deal.price).toLocaleString('en-IN')}` : 'Not specified'}</strong></div><span className="project-status" data-tone={deal.stage === 'Won' ? 'positive' : 'neutral'}>{deal.stage || 'Not specified'}</span></div>}
        {deal ? <Fields rows={[
          ['Source Deal', deal.name], ['Deal ID', dealNumber], ['Deal Owner', deal.assignedUser || deal.owner || deal.ownerId], ['Expected Close Date', formatDate(deal.expectedCloseDate || deal.date)],
        ]} /> : <p className="text-sm text-slate-500">The originating deal is unavailable. The project record and source reference have been retained.</p>}
      </InfoCard>
    </div>
    <InfoCard icon={Link2} title="CRM Relationship">
      <div className="project-relationship flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1 min-w-0 rounded-xl border border-slate-200 p-3"><p className="text-[11px] text-slate-500 mb-1">SOURCE LEAD</p>{deal?.leadId != null ? <Link className="text-sm font-semibold text-blue-600 hover:underline break-words" to={`/crm/leads/${encodeURIComponent(deal.leadId)}`}>{deal.leadNumber || deal.leadId}</Link> : <p className="text-sm text-slate-500">No source lead linked</p>}</div>
        <ArrowRight size={18} className="text-slate-300 rotate-90 md:rotate-0 self-center shrink-0" />
        <Link to={dealUrl} className="flex-1 min-w-0 rounded-xl border border-slate-200 p-3 hover:border-blue-300"><p className="text-[11px] text-slate-500 mb-1">SOURCE DEAL</p><p className="text-sm font-semibold text-blue-600 break-words">{dealNumber}</p><p className="text-xs text-slate-500 mt-1 break-words">{deal?.name || 'Source reference'}</p></Link>
        <ArrowRight size={18} className="text-slate-300 rotate-90 md:rotate-0 self-center shrink-0" />
        <Link to={`/crm/projects/${encodeURIComponent(project.id)}`} aria-current="page" className="flex-1 min-w-0 rounded-xl border border-blue-200 bg-blue-50/50 p-3"><p className="text-[11px] text-blue-600 mb-1">PROJECT</p><p className="text-sm font-bold text-blue-700">{project.projectNumber}</p><p className="text-xs text-slate-500 mt-1 break-words">{project.name}</p></Link>
      </div>
    </InfoCard>
    <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
      <InfoCard icon={FileText} title="Project Description"><p className="text-sm leading-7 whitespace-pre-wrap break-words text-slate-600">{project.description || 'No description provided.'}</p></InfoCard>
      <InfoCard icon={CheckCircle2} title="Project Created from Deal">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{checks.map(([label, confirmed]) => <p key={label} className="flex items-center gap-2 text-xs text-slate-600">{confirmed ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <CircleDashed size={15} className="text-slate-400 shrink-0" />}{label}</p>)}</div>
        <p className="flex items-center gap-1.5 mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400"><CalendarDays size={13} />Created {formatDate(project.createdAt)}</p>
      </InfoCard>
    </div>
  </div>;
}
