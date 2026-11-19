import { useState, useMemo, useEffect, useCallback } from 'react';
import { Avatar } from "../../../components/hrms/Avatar";
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../../stores/appStore';
import MasterSourceLink from '../../../components/common/MasterSourceLink';
import KpiCard from '../../../components/ui/KpiCard';
import {
  Download,
  Search,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
  Building,
  Building2,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Users,
  X,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Layers,
  Network,
  RotateCcw,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import PageHeader from '../../../components/ui/PageHeader';
import { hrmsGuides } from '../../../data/hrms/hrmsGuides';
import { hrmsSync, pullOrgChart } from '../../../services/hrmsSync';

const EMPTY_DEPT = { name: '', code: '', headEmployeeId: '', description: '' };

/** Every node in the tree, depth-first, with its depth. */
function walk(nodes, depth = 0, out = []) {
  nodes.forEach((node) => {
    out.push({ node, depth });
    walk(node.reports || [], depth + 1, out);
  });
  return out;
}

function getMaxDepth(nodes, currentDepth = 1) {
  if (!nodes || nodes.length === 0) return 0;
  let max = currentDepth;
  for (const node of nodes) {
    if (node.reports && node.reports.length > 0) {
      const childDepth = getMaxDepth(node.reports, currentDepth + 1);
      if (childDepth > max) max = childDepth;
    }
  }
  return max;
}

function roleOf(person) {
  return person.designation || person.fullRole || person.role || 'Employee';
}

/** One person card and, when expanded, everyone below them (any depth). */
function OrgNode({ person, depth, isCollapsed, onToggle, onSelect, highlight }) {
  const reports = person.reports || [];
  const expanded = reports.length > 0 && !isCollapsed(person.id);
  const isRoot = depth === 0;
  const isLevel1 = depth === 1;
  const isManager = reports.length > 0;

  return (
    <div className="flex flex-col items-center select-none">
      <div
        onClick={() => onSelect(person)}
        className={`w-[190px] mx-3.5 bg-white rounded-2xl p-3.5 flex flex-col items-center shadow-xs cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group relative border ${
          isRoot
            ? 'border-[#1F2E4A] ring-4 ring-[#1F2E4A]/10 shadow-md'
            : isLevel1
            ? 'border-indigo-300 ring-2 ring-indigo-500/10 shadow-xs'
            : isManager
            ? 'border-purple-200 hover:border-purple-300'
            : 'border-slate-200 hover:border-slate-300'
        } ${highlight(person) ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-50/20' : ''}`}
      >
        {/* Tier badge indicator */}
        <div className="mb-2">
          {isRoot ? (
            <span className="px-2 py-0.5 text-[9.5px] uppercase tracking-wider font-bold rounded-full bg-[#1F2E4A] text-white">
              Executive
            </span>
          ) : isLevel1 ? (
            <span className="px-2 py-0.5 text-[9.5px] font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              Department Lead
            </span>
          ) : isManager ? (
            <span className="px-2 py-0.5 text-[9.5px] font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
              Manager
            </span>
          ) : (
            <span className="px-2 py-0.5 text-[9.5px] font-medium rounded-full bg-slate-100 text-slate-600">
              Staff
            </span>
          )}
        </div>

        <Avatar name={person.name} size={isRoot ? 'lg' : 'md'} />

        <div
          className="text-[13.5px] font-bold text-slate-900 mt-2 group-hover:text-blue-700 transition-colors text-center truncate w-full"
          title={person.name}
        >
          {person.name}
        </div>

        <div
          className="text-[11.5px] text-slate-600 font-medium text-center truncate w-full mt-0.5"
          title={roleOf(person)}
        >
          {roleOf(person)}
        </div>

        {/* Employee code & department pills */}
        <div className="flex flex-wrap items-center justify-center gap-1 mt-2 w-full">
          {person.employeeCode && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 text-slate-600 rounded">
              {person.employeeCode}
            </span>
          )}
          {person.department && (
            <span
              className="px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-100 truncate max-w-[150px]"
              title={person.department}
            >
              {person.department}
            </span>
          )}
        </div>

        {/* Direct reports toggle */}
        {reports.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(person.id);
            }}
            title={expanded ? 'Hide direct reports' : `View ${reports.length} direct reports`}
            className={`mt-3 px-3 py-1 text-[11px] font-semibold rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
              expanded
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                : 'bg-[#1F2E4A] hover:bg-[#1F2E4A]/90 text-white shadow-xs'
            }`}
          >
            <span>{reports.length} {reports.length === 1 ? 'report' : 'reports'}</span>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {/* Children branches */}
      {expanded && (
        <>
          <div className="w-0.5 h-6 bg-slate-300" />
          <div className="flex">
            {reports.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Horizontal joining connector bar */}
                <div className="flex w-full">
                  <div className={`flex-1 h-0.5 ${i === 0 ? '' : 'bg-slate-300'}`} />
                  <div className={`flex-1 h-0.5 ${i === reports.length - 1 ? '' : 'bg-slate-300'}`} />
                </div>
                <div className="w-0.5 h-6 bg-slate-300" />
                <OrgNode
                  person={child}
                  depth={depth + 1}
                  isCollapsed={isCollapsed}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  highlight={highlight}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrgChartPage() {
  const navigate = useNavigate();
  const showToast = useAppStore((s) => s.showToast);

  // Data
  const [tree, setTree] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadedAt, setLoadedAt] = useState(null);

  // View controls
  const [zoom, setZoom] = useState(100);
  const [q, setQ] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [collapsed, setCollapsed] = useState(() => new Set());

  // Modals
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [newDept, setNewDept] = useState(EMPTY_DEPT);
  const [savingDept, setSavingDept] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const [chart, depts] = await Promise.all([
      pullOrgChart(),
      hrmsSync.pull('departments').catch(() => null),
    ]);
    if (chart === null) {
      setLoadError(true);
    } else {
      const roots = Array.isArray(chart?.tree) ? chart.tree : [];
      setTree(roots);
      // Open the first two levels; deeper branches start folded.
      setCollapsed(new Set(
        walk(roots).filter(({ node, depth }) => depth >= 2 && node.reports?.length).map(({ node }) => node.id),
      ));
      setLoadedAt(new Date());
    }
    if (Array.isArray(depts)) setDepartments(depts);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const everyone = useMemo(() => walk(tree), [tree]);
  const employeeCount = everyone.length;
  const managersWithReports = everyone.filter(({ node }) => node.reports?.length).map(({ node }) => node.id);
  const maxLevels = useMemo(() => getMaxDepth(tree), [tree]);
  const noReportingLines = employeeCount > 1 && managersWithReports.length === 0;

  // Search & Filter
  const term = q.trim().toLowerCase();
  const matches = useCallback((person) => {
    const matchesText = !term
      || String(person.name ?? '').toLowerCase().includes(term)
      || String(person.designation ?? '').toLowerCase().includes(term)
      || String(person.department ?? '').toLowerCase().includes(term)
      || String(person.employeeCode ?? '').toLowerCase().includes(term);

    const matchesDept = selectedDeptFilter === 'all'
      || String(person.department ?? '').toLowerCase() === selectedDeptFilter.toLowerCase();

    return matchesText && matchesDept;
  }, [term, selectedDeptFilter]);

  // Keep a person when they match or someone below them does.
  const visibleTree = useMemo(() => {
    if (!term && selectedDeptFilter === 'all') return tree;
    const prune = (nodes) => nodes
      .map((node) => ({ ...node, reports: prune(node.reports || []) }))
      .filter((node) => matches(node) || node.reports.length > 0);
    return prune(tree);
  }, [tree, term, selectedDeptFilter, matches]);

  const isCollapsed = useCallback((id) => !term && selectedDeptFilter === 'all' && collapsed.has(id), [collapsed, term, selectedDeptFilter]);
  const highlight = useCallback((person) => (Boolean(term) || selectedDeptFilter !== 'all') && matches(person), [term, selectedDeptFilter, matches]);
  const allExpanded = collapsed.size === 0;

  function toggleBranch(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleToggleAll() {
    setCollapsed(allExpanded ? new Set(managersWithReports) : new Set());
  }

  async function handleAddDepartment(e) {
    e.preventDefault();
    if (!newDept.name.trim()) return;
    setSavingDept(true);
    try {
      const saved = await hrmsSync.create('departments', {
        name: newDept.name.trim(),
        code: newDept.code.trim() || undefined,
        headEmployeeId: newDept.headEmployeeId || undefined,
        description: newDept.description.trim() || undefined,
      });
      if (saved) setDepartments((prev) => [...prev, saved]);
      showToast(`Department "${newDept.name.trim()}" created`);
      setIsAddDeptOpen(false);
      setNewDept(EMPTY_DEPT);
    } catch (err) {
      showToast(err?.message || 'Could not create the department');
    } finally {
      setSavingDept(false);
    }
  }

  function exportCSV() {
    setIsExportOpen(false);
    const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [['Employee Code', 'Name', 'Designation', 'Department', 'Reports To', 'Email', 'Phone', 'Location', 'Status']];
    everyone.forEach(({ node }) => {
      rows.push([
        node.employeeCode, node.name, node.designation, node.department, node.manager,
        node.email, node.phone, node.location, node.status,
      ].map(cell));
    });
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Org_Chart.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Org Chart exported as CSV');
  }

  function exportPrint() {
    setIsExportOpen(false);
    showToast('Preparing Org Chart print view');
    setTimeout(() => window.print(), 250);
  }

  const subtitle = loading
    ? 'Loading organisation structure…'
    : `${departments.length} Departments • ${employeeCount} Employees${
      loadedAt ? ` • Updated ${loadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''
    }`;

  return (
    <div className="flex flex-col gap-6 w-full pb-12 printable-document">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <PageHeader
        title="Org Chart"
        subtitle={subtitle}
        guide={hrmsGuides.orgChart}
        actions={
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsExportOpen(!isExportOpen)}
                disabled={employeeCount === 0}
                className="px-4 py-2 border border-bdr bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download size={15} />
                <span>Export</span>
                <ChevronDown size={13} className="text-muted" />
              </button>

              {isExportOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-bdr rounded-xl shadow-lg py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    type="button"
                    onClick={exportCSV}
                    className="w-full px-3.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <FileSpreadsheet size={16} className="text-emerald-600" />
                    <span>Export as CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportPrint}
                    className="w-full px-3.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Printer size={16} className="text-blue-600" />
                    <span>Print / Save as PDF</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsAddDeptOpen(true)}
              className="px-4 py-2 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13px] font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} />
              <span>Add Department</span>
            </button>
          </div>
        }
      />

      {/* ── KPI Summary Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 no-print">
        <KpiCard
          label="Total Headcount"
          value={employeeCount}
          sub="Staff in organization"
          icon={Users}
          color="blue"
        />
        <KpiCard
          label="Departments"
          value={departments.length}
          sub="Functional divisions"
          icon={Building2}
          color="teal"
        />
        <KpiCard
          label="Team Leads & Managers"
          value={managersWithReports.length}
          sub="Supervisors with reports"
          icon={Network}
          color="purple"
        />
        <KpiCard
          label="Hierarchy Depth"
          value={`${maxLevels} ${maxLevels === 1 ? 'Tier' : 'Tiers'}`}
          sub="Reporting structure"
          icon={Layers}
          color="orange"
        />
      </div>

      {/* ── Control Bar / Filters ─────────────────────────────────── */}
      <div className="bg-white border border-bdr rounded-xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, role or dept..."
              className="pl-9 pr-8 h-9 w-full bg-off border border-bdr rounded-xl text-[13px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-slate-700 text-[12px] p-0.5 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Department Filter */}
          {departments.length > 0 && (
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="h-9 px-3 bg-white border border-bdr rounded-xl text-[13px] text-slate-700 font-medium focus:outline-none focus:border-navy cursor-pointer"
            >
              <option value="all">All Departments ({departments.length})</option>
              {departments.map((d) => (
                <option key={d.id || d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {/* Expand / Collapse All */}
          {managersWithReports.length > 0 && (
            <button
              type="button"
              onClick={handleToggleAll}
              className="h-9 px-3.5 border border-bdr bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {allExpanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
              <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={load}
            className="h-9 px-3.5 border border-bdr bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Reload from server"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-navy' : 'text-muted'} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 text-[12px]">
          <span className="text-muted font-medium mr-1 hidden sm:inline">Zoom</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            disabled={zoom <= 50}
            className="w-8 h-8 border border-bdr rounded-lg grid place-items-center bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
            title="Zoom out"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(100)}
            className="px-2.5 h-8 border border-bdr rounded-lg bg-off text-center font-mono font-medium hover:text-navy cursor-pointer flex items-center gap-1"
            title="Reset to 100%"
          >
            <span>{zoom}%</span>
            {zoom !== 100 && <RotateCcw size={11} className="text-muted" />}
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(150, z + 10))}
            disabled={zoom >= 150}
            className="w-8 h-8 border border-bdr rounded-lg grid place-items-center bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
            title="Zoom in"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {noReportingLines && !loading && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-[13px] no-print flex items-center justify-between">
          <div>
            No reporting lines are configured yet, so everyone appears at the top level. Assign each employee&apos;s
            <strong> Reporting Manager</strong> in{' '}
            <button
              type="button"
              onClick={() => navigate('/hrms/employees')}
              className="underline font-semibold cursor-pointer text-amber-900"
            >
              Employees Directory
            </button>{' '}
            to establish the organization tree.
          </div>
        </div>
      )}

      {/* ── Canvas Box Container ─────────────────────────────────── */}
      <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden flex flex-col">
        {/* Canvas Legend Header */}
        <div className="px-5 py-3 border-b border-bdr bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 text-[12px] no-print">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">Organizational Hierarchy</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-mono">
              {visibleTree.length} {visibleTree.length === 1 ? 'Root Node' : 'Root Nodes'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11.5px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1F2E4A]" />
              <span className="font-medium">Executive Head</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="font-medium">Department Lead</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="font-medium">Team Manager</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span>Staff Member</span>
            </div>
          </div>
        </div>

        {/* Interactive Org Tree Canvas */}
        <div className="p-6 sm:p-12 overflow-x-auto min-h-[560px] flex justify-center items-start bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] bg-slate-50/40">
          {loading && tree.length === 0 ? (
            <div className="text-center py-24 text-muted text-[13px] w-full flex flex-col items-center gap-2">
              <RefreshCw size={24} className="animate-spin text-navy" />
              <span>Loading organizational structure…</span>
            </div>
          ) : loadError ? (
            <div className="text-center py-24 text-[13px] w-full">
              <div className="text-red-600 font-medium mb-1">Could not load the org chart.</div>
              <button
                type="button"
                onClick={load}
                className="mt-2 px-4 py-1.5 bg-navy text-white text-[12px] font-medium rounded-lg cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : employeeCount === 0 ? (
            <div className="text-center py-24 text-muted text-[13px] w-full flex flex-col items-center gap-2">
              <Users size={32} className="text-slate-300" />
              <p>No active employees found in the directory.</p>
              <button
                type="button"
                onClick={() => navigate('/hrms/employees')}
                className="mt-2 text-navy font-semibold underline cursor-pointer"
              >
                Go to Employees Directory
              </button>
            </div>
          ) : visibleTree.length === 0 ? (
            <div className="text-center py-24 text-muted text-[13px] w-full flex flex-col items-center gap-2">
              <Search size={32} className="text-slate-300" />
              <p>No employees match &quot;{q}&quot; {selectedDeptFilter !== 'all' ? `in ${selectedDeptFilter}` : ''}</p>
              <button
                type="button"
                onClick={() => { setQ(''); setSelectedDeptFilter('all'); }}
                className="text-navy text-xs font-semibold underline cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
              className="flex gap-10 items-start transition-transform duration-150 py-4"
            >
              {visibleTree.map((root) => (
                <OrgNode
                  key={root.id}
                  person={root}
                  depth={0}
                  isCollapsed={isCollapsed}
                  onToggle={toggleBranch}
                  onSelect={setSelectedEmployee}
                  highlight={highlight}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ADD DEPARTMENT MODAL ─────────────────────────────────── */}
      <Modal
        isOpen={isAddDeptOpen}
        onClose={() => setIsAddDeptOpen(false)}
        title="Add Department"
        size="md"
      >
        <form onSubmit={handleAddDepartment} className="flex flex-col gap-4">
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newDept.name}
              onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
              placeholder="e.g. Dyeing & Processing"
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Code</label>
              <input
                type="text"
                value={newDept.code}
                onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                placeholder="Auto from name if blank"
                className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[12.5px] font-semibold text-slate-700">Department Head</label>
                <MasterSourceLink source="employees" />
              </div>
              <select
                value={newDept.headEmployeeId}
                onChange={(e) => setNewDept({ ...newDept, headEmployeeId: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-bdr rounded-xl text-[13.5px] text-slate-800 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 cursor-pointer"
              >
                <option value="">Not assigned</option>
                {everyone.map(({ node }) => (
                  <option key={node.id} value={node.id}>
                    {node.name} ({roleOf(node)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Description</label>
            <textarea
              rows={2}
              value={newDept.description}
              onChange={(e) => setNewDept({ ...newDept, description: e.target.value })}
              placeholder="Responsibilities and operational focus..."
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] text-slate-800 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/10"
            />
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-3 border-t border-bdr mt-2">
            <button
              type="button"
              onClick={() => {
                setIsAddDeptOpen(false);
                navigate('/hrms/departments');
              }}
              className="text-navy text-[13px] font-medium hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Building size={14} /> Go to Departments Directory
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddDeptOpen(false)}
                className="px-4 py-2 border border-bdr bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingDept}
                className="px-5 py-2 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-60"
              >
                {savingDept ? 'Creating…' : 'Create Department'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ── EMPLOYEE QUICK VIEW MODAL ────────────────────────────── */}
      <Modal
        isOpen={Boolean(selectedEmployee)}
        onClose={() => setSelectedEmployee(null)}
        title="Employee Profile"
        size="md"
      >
        {selectedEmployee && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4 p-4 bg-off border border-bdr rounded-xl">
              <Avatar name={selectedEmployee.name} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-bold text-slate-900 truncate">
                    {selectedEmployee.name}
                  </h3>
                  {selectedEmployee.status && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {selectedEmployee.status}
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-slate-600 font-medium mt-0.5">
                  {roleOf(selectedEmployee)}
                  {selectedEmployee.employeeCode ? ` · ${selectedEmployee.employeeCode}` : ''}
                </div>
                <div className="text-[12px] text-muted flex items-center gap-1.5 mt-1">
                  <Building size={13} /> {selectedEmployee.department || 'No department'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <div className="p-3 border border-bdr rounded-xl flex items-center gap-3">
                <Mail size={16} className="text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted font-medium">Work Email</div>
                  {selectedEmployee.email ? (
                    <a href={`mailto:${selectedEmployee.email}`} className="text-navy hover:underline truncate block font-medium">
                      {selectedEmployee.email}
                    </a>
                  ) : <div className="text-slate-400">—</div>}
                </div>
              </div>

              <div className="p-3 border border-bdr rounded-xl flex items-center gap-3">
                <Phone size={16} className="text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted font-medium">Phone</div>
                  {selectedEmployee.phone ? (
                    <a href={`tel:${selectedEmployee.phone}`} className="text-slate-800 hover:underline truncate block font-medium">
                      {selectedEmployee.phone}
                    </a>
                  ) : <div className="text-slate-400">—</div>}
                </div>
              </div>

              <div className="p-3 border border-bdr rounded-xl flex items-center gap-3">
                <MapPin size={16} className="text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted font-medium">Location</div>
                  <div className="text-slate-800 font-medium">{selectedEmployee.location || '—'}</div>
                </div>
              </div>

              <div className="p-3 border border-bdr rounded-xl flex items-center gap-3">
                <Users size={16} className="text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted font-medium">Reports To</div>
                  <div className="text-slate-800 font-medium">{selectedEmployee.manager || '—'}</div>
                </div>
              </div>
            </div>

            {selectedEmployee.reports?.length > 0 && (
              <div className="p-3.5 bg-slate-50 border border-bdr rounded-xl">
                <div className="text-[12px] font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Users size={14} className="text-navy" /> Direct Reports ({selectedEmployee.reports.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedEmployee.reports.map((rep) => (
                    <div
                      key={rep.id}
                      onClick={() => setSelectedEmployee(rep)}
                      className="px-2.5 py-1 bg-white border border-bdr rounded-lg text-[12px] flex items-center gap-2 hover:border-navy cursor-pointer transition-colors shadow-2xs"
                    >
                      <Avatar name={rep.name} size="xs" />
                      <span className="font-medium text-slate-800">{rep.name}</span>
                      <span className="text-[11px] text-muted">({roleOf(rep)})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-3 border-t border-bdr">
              <button
                type="button"
                onClick={() => {
                  setSelectedEmployee(null);
                  navigate('/hrms/employees');
                }}
                className="px-4 py-2 bg-white border border-bdr hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink size={14} />
                <span>View in Employees Directory</span>
              </button>

              <button
                type="button"
                disabled={!selectedEmployee.email}
                onClick={() => { window.location.href = `mailto:${selectedEmployee.email}`; }}
                className="px-5 py-2 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail size={14} />
                <span>Send Email</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export const OrgChart = OrgChartPage;
export default OrgChartPage;
