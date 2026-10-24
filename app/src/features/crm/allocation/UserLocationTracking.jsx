import CrmKpiCard from '../common/CrmKpiCard';
import PageHeader from '../../../components/ui/PageHeader';
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  Users,
  Wifi,
  WifiOff,
  Navigation,
  Briefcase,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Plus,
  Minus,
  Crosshair,
  Layers,
  X,
  Phone,
  MessageCircle,
  LocateFixed,
  Clock,
  Battery,
  Footprints,
  Timer,
  History,
  ChevronLeft,
  ChevronRight,
  Radio,
  CalendarDays,
  CheckCircle2,
  Send,
  Download,
  PhoneCall,
} from 'lucide-react';

const DEPTS = ['Sales & Marketing', 'Operations', 'Support'];
const PER_PAGE_OPTIONS = [5, 10, 20];

const STAFF = [
  { id: 'EMP-01', name: 'Anuska Shah', short: 'Anuska', dept: 'Sales & Marketing', role: 'TCE', phone: '+91 98111 22334', status: 'Online', lastSeen: 'Just now', x: 38, y: 52, color: '#2563eb', loc: '4th Mission St, San Francisco, CA 94105, USA', dist: '0.02 km', worked: '10:24h', idle: '12m', atSite: 'At Client', battery: 78 },
  { id: 'EMP-02', name: 'Rahul Verma', short: 'Rahul', dept: 'Sales & Marketing', role: 'BDE', phone: '+91 98234 11223', status: 'Online', lastSeen: '2 min ago', x: 55, y: 38, color: '#7c3aed', loc: 'Market St, San Francisco, CA, USA', dist: '0.4 km', worked: '08:10h', idle: '05m', atSite: 'Travel', battery: 64 },
  { id: 'EMP-03', name: 'Priya Mehta', short: 'Priya', dept: 'Sales & Marketing', role: 'TCE', phone: '+91 98455 33445', status: 'Online', lastSeen: '1 min ago', x: 66, y: 55, color: '#0d9488', loc: 'Mission District, San Francisco, CA, USA', dist: '1.1 km', worked: '09:02h', idle: '20m', atSite: 'Office', battery: 82 },
  { id: 'EMP-04', name: 'David Patel', short: 'David', dept: 'Operations', role: 'ASM', phone: '+91 98777 88990', status: 'Online', lastSeen: '4 min ago', x: 28, y: 30, color: '#ea580c', loc: 'Richmond District, San Francisco, CA, USA', dist: '2.3 km', worked: '07:45h', idle: '08m', atSite: 'Travel', battery: 55 },
  { id: 'EMP-05', name: 'Sneha Iyer', short: 'Sneha', dept: 'Support', role: 'SSE', phone: '+91 98111 99887', status: 'Online', lastSeen: '6 min ago', x: 48, y: 68, color: '#db2777', loc: 'Bernal Heights, San Francisco, CA, USA', dist: '0.8 km', worked: '06:30h', idle: '15m', atSite: 'At Client', battery: 71 },
  { id: 'EMP-06', name: 'Amit Rao', short: 'Amit', dept: 'Operations', role: 'SSE', phone: '+91 97654 32109', status: 'Offline', lastSeen: '1 hour ago', x: 72, y: 30, color: '#64748b', loc: 'Downtown, San Francisco, CA, USA', dist: '3.5 km', worked: '05:12h', idle: '48m', atSite: 'Idle', battery: 32 },
  { id: 'EMP-07', name: 'Kavya Nair', short: 'Kavya', dept: 'Sales & Marketing', role: 'BDE', phone: '+91 96543 21098', status: 'Offline', lastSeen: '3 hours ago', x: 22, y: 62, color: '#64748b', loc: 'Sunset District, San Francisco, CA, USA', dist: '4.0 km', worked: '04:05h', idle: '62m', atSite: 'Idle', battery: 21 },
  { id: 'EMP-08', name: 'Vikram Singh', short: 'Vikram', dept: 'Support', role: 'TCE', phone: '+91 95432 10987', status: 'Offline', lastSeen: 'Yesterday', x: 60, y: 74, color: '#64748b', loc: 'Bayview, San Francisco, CA, USA', dist: '5.2 km', worked: '03:40h', idle: '90m', atSite: 'Off Duty', battery: 12 },
];

const ACTIVITY = [
  { time: '10:24 AM', title: 'At Client Location', sub: 'Met client at San Francisco', tone: '#2563eb' },
  { time: '01:02 AM', title: 'Travel', sub: 'Moving (28 km/h)', tone: '#7c3aed' },
  { time: '02:42 AM', title: 'Office', sub: 'Checked in at office', tone: '#0d9488' },
  { time: '01:45 PM', title: 'Idle', sub: 'No movement for 12 minutes', tone: '#f59e0b' },
];

const FULL_LOGS = [
  { time: '09:00 AM', status: 'Checked In', loc: 'Headquarters • Office Premises', battery: '100%', speed: '0 km/h', duration: '45m' },
  { time: '09:45 AM', status: 'In Transit', loc: 'Market St to 4th Mission St', battery: '96%', speed: '34 km/h', duration: '20m' },
  { time: '10:05 AM', status: 'At Client Location', loc: '4th Mission St, San Francisco', battery: '91%', speed: '0 km/h', duration: '2h 15m' },
  { time: '12:20 PM', status: 'Lunch / Break', loc: 'Union Square Cafe Area', battery: '84%', speed: '0 km/h', duration: '40m' },
  { time: '01:00 PM', status: 'Site Visit Phase 2', loc: 'Bernal Heights Tech Hub', battery: '78%', speed: '24 km/h', duration: '1h 30m' },
];

function initials(name) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function downloadCsv(filename, rows) {
  const body = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function UserLocationTracking() {
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('All');
  const [status, setStatus] = useState('All');
  const [mapType, setMapType] = useState('map');
  const [zoom, setZoom] = useState(1);
  const [live, setLive] = useState(true);
  const [selectedId, setSelectedId] = useState('EMP-01');
  const [tab, setTab] = useState('live');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [date, setDate] = useState('2026-09-11');
  const [updatedAt, setUpdatedAt] = useState('11 Sep 2026, 10:30 AM');
  const [ping, setPing] = useState(0);

  const [toastMessage, setToastMessage] = useState(null);
  const [activeCallStaff, setActiveCallStaff] = useState(null);
  const [activeMessageStaff, setActiveMessageStaff] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [historyModalStaff, setHistoryModalStaff] = useState(null);
  const [historyDate, setHistoryDate] = useState('2026-09-11');

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      setPing((p) => p + 1);
      setUpdatedAt(new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(t);
  }, [live]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return STAFF.filter((s) => {
      if (dept !== 'All' && s.dept !== dept) return false;
      if (status !== 'All' && s.status !== status) return false;
      if (!q) return true;
      return (s.name + ' ' + s.id + ' ' + s.phone).toLowerCase().includes(q);
    });
  }, [search, dept, status]);

  const online = STAFF.filter((s) => s.status === 'Online');
  const offline = STAFF.filter((s) => s.status !== 'Online');
  const selected = STAFF.find((s) => s.id === selectedId) || filtered[0] || STAFF[0];

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  useEffect(() => {
    setPage(1);
  }, [search, dept, status, perPage]);

  function handleLocateStaff(staff) {
    setSelectedId(staff.id);
    setZoom(1.4);
    showToast(`Focused map location for ${staff.name}`);
  }

  function handleOpenCall(staff) {
    setActiveCallStaff(staff);
  }

  function handleStartCall() {
    if (!activeCallStaff) return;
    showToast(`Dialing call to ${activeCallStaff.name} (${activeCallStaff.phone})...`);
    window.open(`tel:${activeCallStaff.phone.replace(/\s+/g, '')}`);
    setActiveCallStaff(null);
  }

  function handleOpenMessage(staff) {
    setActiveMessageStaff(staff);
    setMessageText('');
  }

  function handleSendMessage() {
    if (!activeMessageStaff) return;
    showToast(`Instant message sent to ${activeMessageStaff.name}!`);
    setActiveMessageStaff(null);
    setMessageText('');
  }

  function handleOpenHistory(staff) {
    setHistoryModalStaff(staff || selected);
  }

  function exportExcel() {
    downloadCsv('user_locations.csv', [
      ['ID', 'Name', 'Department', 'Role', 'Phone', 'Status', 'Last Seen', 'Location'],
      ...filtered.map((s) => [s.id, s.name, s.dept, s.role, s.phone, s.status, s.lastSeen, s.loc]),
    ]);
    showToast('User locations exported to CSV.');
  }

  function exportPdf() {
    const w = window.open('', '_blank', 'width=1000,height=700');
    if (!w) return;
    const rows = filtered.map((s) => `<tr><td>${s.id}</td><td>${s.name}</td><td>${s.dept}</td><td>${s.status}</td><td>${s.lastSeen}</td></tr>`).join('');
    w.document.write(`<!doctype html><html><head><title>User Locations</title><style>body{font-family:Arial;color:#172033;padding:24px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#e2e8f0}</style></head><body><h1>User Location Tracking</h1><table><thead><tr><th>ID</th><th>Name</th><th>Department</th><th>Status</th><th>Last Seen</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    showToast('PDF print preview generated.');
  }

  const dark = mapType === 'sat';

  return (
    <div className="space-y-4">
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#0f172a] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      <PageHeader
        title="User Location Tracking"
        subtitle="Track your team's live location, activity and working hours in real time."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 px-3 h-[38px] bg-white border border-slate-200 rounded-[10px] text-xs font-medium text-slate-600">
              <CalendarDays size={14} className="text-slate-400" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="outline-none bg-transparent text-xs text-slate-700" />
            </label>
            <button
              type="button"
              onClick={() => setLive((v) => !v)}
              className={live ? 'btn-primary' : 'btn-outline'}
            >
              <Radio size={16} /> {live ? 'Live Tracking' : 'Start Live'}
            </button>
            <button
              type="button"
              onClick={() => setReportsOpen(true)}
              className="btn-outline"
            >
              <FileText size={16} /> Reports
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 my-4">
        <CrmKpiCard label="Total Employees" value={STAFF.length} icon={Users} tone="blue" />
        <CrmKpiCard label="Online Now" value={online.length} icon={Wifi} tone="emerald"> <em className="not-italic text-[10px] font-bold text-emerald-600">23.8%</em></CrmKpiCard>
        <CrmKpiCard label="Offline" value={offline.length} icon={WifiOff} tone="rose"> <em className="not-italic text-[10px] font-bold text-slate-400">76.2%</em></CrmKpiCard>
        <CrmKpiCard label="Tracked with Location" value={STAFF.length - 3} icon={Navigation} tone="purple" />
        <CrmKpiCard label="Out of Office" value="3" icon={Briefcase} tone="amber" />
      </div>

      <div className="flex flex-col lg:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, mobile..." className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500" />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer">
          <option value="All">All Departments</option>
          {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer">
          <option value="All">All Status</option>
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
        </select>
        <button type="button" onClick={() => { setSearch(''); setDept('All'); setStatus('All'); showToast('Filters reset'); }} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Reset</button>
        <button type="button" onClick={() => { setPing((p) => p + 1); showToast('Live location data refreshed!'); }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
          <RefreshCw size={13} /> Auto Refresh
        </button>
        <button type="button" onClick={exportExcel} className="btn-primary" style={{ background: '#059669' }}>
          <FileSpreadsheet size={16} /> Excel
        </button>
        <button type="button" onClick={exportPdf} className="btn-primary" style={{ background: '#f43f5e' }}>
          <FileText size={16} /> PDF
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 px-4 py-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} /> Live Employee Locations</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Real-time tracking. Last updated: {updatedAt}</p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-[11px] font-bold">
                <button type="button" onClick={() => setMapType('map')} className={`px-3 py-1 rounded-md transition cursor-pointer ${mapType === 'map' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Map</button>
                <button type="button" onClick={() => setMapType('sat')} className={`px-3 py-1 rounded-md transition cursor-pointer ${mapType === 'sat' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Satellite</button>
              </div>
            </div>
            <div className={`relative overflow-hidden ${dark ? 'bg-[#1e293b]' : 'bg-[#dcebf7]'}`} style={{ height: 380 }}>
              <svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
                <rect x="0" y="0" width="800" height="400" fill={dark ? '#1e293b' : '#cfe3f5'} />
                <path d="M40,90 Q120,40 220,70 T380,60 T520,90 T700,60 L760,90 L740,180 L620,220 L560,300 L430,340 L300,320 L180,340 L80,280 L30,190 Z" fill={dark ? '#334155' : '#d9e9d4'} />
                <path d="M120,140 Q200,120 280,150 T420,170 T600,160 L640,200 L560,260 L400,280 L240,260 L140,220 Z" fill={dark ? '#3f4f63' : '#c8dfc2'} />
                <path d="M480,240 Q580,220 660,260 T700,330 L560,360 L480,320 Z" fill={dark ? '#334155' : '#d9e9d4'} />
                {Array.from({ length: 9 }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2="400" stroke={dark ? '#2b3a4f' : '#ffffff'} strokeOpacity="0.5" strokeWidth="1" />
                ))}
                {Array.from({ length: 5 }).map((_, i) => (
                  <line key={`h${i}`} x1="0" y1={i * 100} x2="800" y2={i * 100} stroke={dark ? '#2b3a4f' : '#ffffff'} strokeOpacity="0.5" strokeWidth="1" />
                ))}
              </svg>
              <div className="absolute inset-0 transition-transform" style={{ transform: `scale(${zoom})` }}>
                {filtered.map((s, i) => (
                  <button
                    key={s.id + ping}
                    type="button"
                    onClick={() => handleLocateStaff(s)}
                    className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-full group cursor-pointer"
                    style={{ left: `${s.x}%`, top: `${s.y}%` }}
                  >
                    <span className={`flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border text-[10px] font-bold shadow-sm whitespace-nowrap ${selectedId === s.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
                      <span className="w-5 h-5 rounded-full grid place-items-center text-[8px] font-bold text-white" style={{ background: s.color }}>{initials(s.name)}</span>
                      {s.short}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500 bg-white/80 rounded px-1">{i + 1} min ago</span>
                    <span className={`w-0 h-0 border-l-[7px] border-r-[7px] border-t-[10px] border-l-transparent border-r-transparent ${s.status === 'Online' ? 'border-t-emerald-500' : 'border-t-slate-400'}`} />
                  </button>
                ))}
              </div>
              <div className="absolute left-3 top-3 flex flex-col gap-1">
                <button type="button" onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(1)))} className="w-8 h-8 grid place-items-center bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 hover:bg-slate-50 cursor-pointer" aria-label="Zoom in"><Plus size={15} /></button>
                <button type="button" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))} className="w-8 h-8 grid place-items-center bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 hover:bg-slate-50 cursor-pointer" aria-label="Zoom out"><Minus size={15} /></button>
              </div>
              <button type="button" onClick={() => setZoom(1)} className="absolute left-3 bottom-3 w-8 h-8 grid place-items-center bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 hover:bg-slate-50 cursor-pointer" aria-label="Reset view"><Crosshair size={15} /></button>
              <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-white/85 rounded-md px-2 py-1 border border-slate-200"><Layers size={11} /> {filtered.length} markers</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">All Users ({filtered.length})</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-2 py-2.5">Employee</th>
                    <th className="px-2 py-2.5">Department</th>
                    <th className="px-2 py-2.5">Contact</th>
                    <th className="px-2 py-2.5">Status</th>
                    <th className="px-2 py-2.5">Last Seen</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageItems.map((s, i) => (
                    <tr key={s.id} onClick={() => setSelectedId(s.id)} className={`cursor-pointer transition ${selectedId === s.id ? 'bg-blue-50/60' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-4 py-2.5 text-slate-400">{(safePage - 1) * perPage + i + 1}</td>
                      <td className="px-2 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full grid place-items-center text-[10px] font-bold text-white shrink-0" style={{ background: s.color }}>{initials(s.name)}</span>
                          <span><strong className="block text-slate-800 leading-tight">{s.name}</strong><span className="block text-[10px] text-slate-400 font-mono">{s.id}</span></span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-slate-500">{s.dept}<span className="block text-[10px] text-slate-400">{s.role}</span></td>
                      <td className="px-2 py-2.5 text-slate-500 font-mono text-[11px]">{s.phone}</td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.status === 'Online' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-500 border-rose-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'Online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />{s.status}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-slate-400 text-[11px]">{s.lastSeen}</td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <span className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => handleLocateStaff(s)} title="Locate on Map" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg cursor-pointer"><LocateFixed size={14} /></button>
                          <button type="button" onClick={() => handleOpenCall(s)} title="Call Employee" className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"><Phone size={14} /></button>
                          <button type="button" onClick={() => handleOpenMessage(s)} title="Send Message" className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"><MessageCircle size={14} /></button>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {pageItems.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No employees match the filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 text-[11px] text-slate-500 pr-20 sm:pr-24">
              <span>Showing {(safePage - 1) * perPage + 1} to {Math.min(safePage * perPage, filtered.length)} of {filtered.length} users</span>
              <span className="flex items-center gap-1.5">
                <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"><ChevronLeft size={13} /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} type="button" onClick={() => setPage(p)} className={`min-w-6 h-6 px-1.5 rounded-md border text-[11px] font-bold cursor-pointer ${p === safePage ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{p}</button>
                ))}
                <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"><ChevronRight size={13} /></button>
                <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="px-1.5 py-1 border border-slate-200 rounded-md text-[11px] cursor-pointer">
                  {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n} per page</option>)}
                </select>
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-fit xl:sticky xl:top-4">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100">
            <span className="w-9 h-9 rounded-full grid place-items-center text-xs font-bold text-white shrink-0" style={{ background: selected.color }}>{initials(selected.name)}</span>
            <div className="flex-1 min-w-0">
              <strong className="block text-sm text-slate-900 truncate">{selected.name}</strong>
              <span className="block text-[10px] text-slate-400 truncate">{selected.dept} | {selected.role}</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${selected.status === 'Online' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{selected.status}</span>
            <button type="button" onClick={() => setSelectedId(filtered[0]?.id || 'EMP-01')} className="text-slate-300 hover:text-slate-500 cursor-pointer"><X size={15} /></button>
          </div>
          <div className="flex gap-1 px-4 pt-3 text-[11px] font-bold">
            {[['live', 'Live Info'], ['history', 'Activity History'], ['timeline', 'Timeline']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${tab === k ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>{label}</button>
            ))}
          </div>
          <div className="p-4">
            {tab === 'live' && (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5"><MapPin size={13} className="text-blue-500" /> Current Location</p>
                  <p className="text-[11px] text-slate-500 mt-1">{selected.loc}</p>
                  <button type="button" onClick={() => handleLocateStaff(selected)} className="text-[11px] font-bold text-blue-600 mt-1 cursor-pointer">View on Map</button>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-center">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5"><Footprints size={15} className="mx-auto text-slate-400" /><p className="text-[10px] text-slate-400 mt-1">Distance</p><strong className="text-xs text-slate-800">{selected.dist}</strong></div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5"><Clock size={15} className="mx-auto text-slate-400" /><p className="text-[10px] text-slate-400 mt-1">Last Update</p><strong className="text-xs text-slate-800">{selected.lastSeen}</strong></div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5"><Timer size={15} className="mx-auto text-slate-400" /><p className="text-[10px] text-slate-400 mt-1">Worked Time</p><strong className="text-xs text-slate-800">{selected.worked}</strong></div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5"><History size={15} className="mx-auto text-slate-400" /><p className="text-[10px] text-slate-400 mt-1">Idle Time</p><strong className="text-xs text-slate-800">{selected.idle}</strong></div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                  <div className="rounded-xl border border-slate-200 p-2.5"><p className="text-slate-400 text-[10px]">Location Status</p><strong className="text-emerald-600 flex items-center gap-1 mt-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{selected.atSite}</strong></div>
                  <div className="rounded-xl border border-slate-200 p-2.5"><p className="text-slate-400 text-[10px]">Battery</p><strong className="text-slate-800 flex items-center gap-1 mt-0.5"><Battery size={13} className="text-emerald-500" />{selected.battery}%</strong></div>
                </div>
              </div>
            )}
            {tab !== 'live' && (
              <div className="space-y-0">
                <p className="text-[11px] font-bold text-slate-500 mb-2">Today's Activity</p>
                {ACTIVITY.map((a) => (
                  <div key={a.title} className="flex gap-2.5 pb-3.5 relative">
                    <span className="flex flex-col items-center">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.tone }} />
                      <span className="w-px flex-1 bg-slate-200" />
                    </span>
                    <div className="flex-1 flex items-start justify-between gap-2">
                      <div><strong className="block text-[11px] text-slate-800">{a.title}</strong><span className="block text-[10px] text-slate-400">{a.sub}</span></div>
                      <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">{a.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => handleOpenHistory(selected)} className="w-full mt-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer">View Full History</button>
          </div>
        </div>
      </div>

      {activeCallStaff && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => setActiveCallStaff(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 p-4 sm:p-6 max-h-[95vh] overflow-y-auto text-center animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-full mx-auto grid place-items-center text-xl font-bold text-white mb-3 shadow-md" style={{ background: activeCallStaff.color }}>
              {initials(activeCallStaff.name)}
            </div>
            <h3 className="text-base font-bold text-slate-900">{activeCallStaff.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{activeCallStaff.dept} • {activeCallStaff.role}</p>
            <div className="my-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs font-mono font-bold text-blue-700 flex items-center justify-center gap-2">
              <PhoneCall size={15} className="animate-bounce" /> {activeCallStaff.phone}
            </div>
            <div className="flex gap-2.5 pt-2">
              <button type="button" onClick={() => setActiveCallStaff(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={handleStartCall} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center justify-center gap-1.5">
                <Phone size={14} /> Dial Now
              </button>
            </div>
          </div>
        </div>
      )}

      {activeMessageStaff && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => setActiveMessageStaff(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold text-white" style={{ background: activeMessageStaff.color }}>
                  {initials(activeMessageStaff.name)}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Message {activeMessageStaff.name}</h3>
                  <span className="text-[10px] text-slate-400 font-mono">{activeMessageStaff.phone}</span>
                </div>
              </div>
              <button type="button" onClick={() => setActiveMessageStaff(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Quick Templates</label>
                <div className="flex flex-wrap gap-1.5">
                  {['Where are you currently?', 'Please check-in at office', 'Client update requested', 'Call manager ASAP'].map((tmpl) => (
                    <button type="button" key={tmpl} onClick={() => setMessageText(tmpl)} className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 rounded-lg text-[11px] font-medium transition cursor-pointer">
                      {tmpl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Custom Message</label>
                <textarea
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type message or broadcast instruction here..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 bg-slate-50/80 border-t border-slate-100">
              <button type="button" onClick={() => setActiveMessageStaff(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={handleSendMessage} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer">
                <Send size={13} /> Send Message
              </button>
            </div>
          </div>
        </div>
      )}

      {historyModalStaff && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4" onClick={() => setHistoryModalStaff(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-3 lg:gap-0 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3 min-w-0 lg:min-w-auto">
                <span className="w-10 h-10 rounded-full grid place-items-center text-xs font-bold text-white shadow-sm" style={{ background: historyModalStaff.color }}>
                  {initials(historyModalStaff.name)}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{historyModalStaff.name} — Full Location History</h3>
                  <p className="text-[11px] text-slate-500">{historyModalStaff.dept} • {historyModalStaff.role} • {historyModalStaff.phone}</p>
                </div>
              </div>
              <button type="button" onClick={() => setHistoryModalStaff(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 bg-blue-50 border border-blue-100 rounded-xl p-3">
                <div className="flex items-center gap-2 text-xs text-blue-900 font-semibold">
                  <CalendarDays size={16} className="text-blue-600" />
                  <span>Log Date:</span>
                  <input type="date" value={historyDate} onChange={(e) => setHistoryDate(e.target.value)} className="bg-white border border-blue-200 rounded-lg px-2 py-1 text-xs text-slate-700 outline-none" />
                </div>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
                  Status: {historyModalStaff.atSite}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <Footprints size={16} className="mx-auto text-blue-600 mb-1" />
                  <span className="block text-[10px] text-slate-400">Total Distance</span>
                  <strong className="text-xs font-bold text-slate-800">14.8 km</strong>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <Timer size={16} className="mx-auto text-purple-600 mb-1" />
                  <span className="block text-[10px] text-slate-400 font-medium">Worked Hours</span>
                  <strong className="text-xs font-bold text-slate-800">{historyModalStaff.worked}</strong>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <Clock size={16} className="mx-auto text-amber-600 mb-1" />
                  <span className="block text-[10px] text-slate-400 font-medium">Idle Duration</span>
                  <strong className="text-xs font-bold text-slate-800">{historyModalStaff.idle}</strong>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <Battery size={16} className="mx-auto text-emerald-600 mb-1" />
                  <span className="block text-[10px] text-slate-400 font-medium">Battery Level</span>
                  <strong className="text-xs font-bold text-slate-800">{historyModalStaff.battery}%</strong>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2.5">Chronological Movement & GPS Timeline</h4>
                <div className="border border-slate-200 rounded-xl overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse min-w-[480px] lg:min-w-0">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                      <tr>
                        <th className="px-3 py-2">Timestamp</th>
                        <th className="px-3 py-2">Activity Stage</th>
                        <th className="px-3 py-2">Location Point</th>
                        <th className="px-3 py-2 text-right">Battery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {FULL_LOGS.map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2.5 font-mono text-slate-500 font-semibold">{log.time}</td>
                          <td className="px-3 py-2.5 font-bold text-slate-800">{log.status}</td>
                          <td className="px-3 py-2.5 text-slate-600">{log.loc}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-600">{log.battery}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center px-5 py-3.5 bg-slate-50 border-t border-slate-100">
              <button type="button" onClick={() => downloadCsv(`location_history_${historyModalStaff.id}.csv`, [['Time', 'Status', 'Location', 'Battery'], ...FULL_LOGS.map((l) => [l.time, l.status, l.loc, l.battery])])} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer">
                <Download size={13} /> Export Route Log
              </button>
              <button type="button" onClick={() => setHistoryModalStaff(null)} className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {reportsOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4" role="presentation" onMouseDown={() => setReportsOpen(false)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Tracking Report — {date}</h2>
              <button type="button" onClick={() => setReportsOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-2.5 text-xs">
              <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2"><span className="text-slate-500">Total employees</span><strong>{STAFF.length}</strong></div>
              <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2"><span className="text-slate-500">Online</span><strong className="text-emerald-600">{online.length}</strong></div>
              <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2"><span className="text-slate-500">Offline</span><strong className="text-slate-500">{offline.length}</strong></div>
              {DEPTS.map((d) => (
                <div key={d} className="flex justify-between bg-slate-50 rounded-lg px-3 py-2"><span className="text-slate-500">{d}</span><strong>{STAFF.filter((s) => s.dept === d).length}</strong></div>
              ))}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 bg-slate-50/70 border-t border-slate-100">
              <button type="button" onClick={exportExcel} className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer">Excel</button>
              <button type="button" onClick={() => setReportsOpen(false)} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
