import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, X, Pencil, Trash2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

import PageHeader from '../../../components/ui/PageHeader';
import InfoBanner from '../../../components/ui/InfoBanner';
import { fabricMasterSync, isBackendEnabled, describeError } from '../../../services/fabricMasterSync';

// One screen for every textile master. Each master is a config object (see
// textileMasterConfigs.js): its API key, form fields and table columns.
// Rows live in Postgres; without a session nothing is shown or saved.

const PER_PAGE = 10;
const NO_LOOKUPS = {};

// Masters are never read from browser storage; without a session the list is empty.
function readLocal() {
  return [];
}

const text = (v) => String(v ?? '').toLowerCase();

function emptyForm(fields) {
  return Object.fromEntries(fields.map((f) => [f.key, f.type === 'checkbox' ? true : '']));
}

export default function TextileMasterPage({ config }) {
  const { key, title, subtitle, banner, singular, fields, columns, hasStatus = true, lookups = NO_LOOKUPS } = config;
  const backendOn = isBackendEnabled();

  const [rows, setRows] = useState(() => (backendOn ? [] : readLocal(key)));
  const [lookupRows, setLookupRows] = useState({});
  const [loading, setLoading] = useState(backendOn);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => emptyForm(fields));
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const lookupKeys = useMemo(() => Object.values(lookups), [lookups]);

  const load = useCallback(async () => {
    if (!backendOn) {
      setRows(readLocal(key));
      setLookupRows(Object.fromEntries(lookupKeys.map((k) => [k, readLocal(k)])));
      return;
    }
    setLoading(true);
    const [main, ...others] = await Promise.all([
      fabricMasterSync.pull(key),
      ...lookupKeys.map((k) => fabricMasterSync.pull(k)),
    ]);
    if (main === null) setLoadError('Could not load records from the server.');
    else {
      setRows(main);
      setLoadError('');
    }
    setLookupRows(Object.fromEntries(lookupKeys.map((k, i) => [k, others[i] || []])));
    setLoading(false);
  }, [backendOn, key, lookupKeys]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // Without a server session nothing can be saved; no local copy is kept.
  const setLocal = () => {
    throw new Error('You are not signed in to the server — nothing was saved.');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (hasStatus && statusFilter !== 'All') {
        const active = r.isActive !== false;
        if ((statusFilter === 'Active') !== active) return false;
      }
      if (!q) return true;
      return columns.some((c) => text(c.searchValue ? c.searchValue(r) : r[c.key]).includes(q));
    });
  }, [rows, search, statusFilter, columns, hasStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
  const to = Math.min(safePage * PER_PAGE, filtered.length);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(fields));
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm(Object.fromEntries(fields.map((f) => [
      f.key,
      f.type === 'checkbox' ? row[f.key] !== false : (row[f.key] ?? ''),
    ])));
    setFormError('');
    setModalOpen(true);
  }

  async function submitForm(e) {
    e.preventDefault();
    if (saving) return;
    const missing = fields.find((f) => f.required && !String(form[f.key] ?? '').trim());
    if (missing) {
      setFormError(`${missing.label} is required.`);
      return;
    }
    const clean = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
    );
    setSaving(true);
    setFormError('');
    try {
      if (backendOn) {
        const saved = editing
          ? await fabricMasterSync.update(key, editing.id, clean)
          : await fabricMasterSync.create(key, clean);
        if (!saved) throw new Error('No response from the server.');
        setRows((prev) => (editing ? prev.map((r) => (r.id === editing.id ? saved : r)) : [...prev, saved]));
      } else if (editing) {
        setLocal((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...clean } : r)));
      } else {
        setLocal((prev) => [...prev, { id: `${key}-local-${Date.now()}`, ...clean }]);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteRow) return;
    setDeleteError('');
    try {
      if (backendOn) {
        await fabricMasterSync.remove(key, deleteRow.id);
        setRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
      } else {
        setLocal((prev) => prev.filter((r) => r.id !== deleteRow.id));
      }
      setDeleteRow(null);
    } catch (err) {
      setDeleteError(describeError(err));
    }
  }

  function renderField(f) {
    const base = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800';
    const value = form[f.key];
    const set = (v) => setForm((prev) => ({ ...prev, [f.key]: v }));
    if (f.type === 'checkbox') {
      return (
        <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => set(e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
          {f.label}
        </label>
      );
    }
    const label = (
      <label className="block font-semibold text-slate-700 mb-1">
        {f.label} {f.required && <span className="text-rose-500">*</span>}
      </label>
    );
    if (f.type === 'select') {
      const options = lookupRows[lookups[f.key]] || [];
      return (
        <div>
          {label}
          <select value={value} onChange={(e) => set(e.target.value)} className={base}>
            <option value="">— None —</option>
            {options.filter((o) => o.isActive !== false || o.id === value).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      );
    }
    if (f.type === 'textarea') {
      return (
        <div>
          {label}
          <textarea rows={2} value={value} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} className={base} />
        </div>
      );
    }
    if (f.type === 'color') {
      return (
        <div>
          {label}
          <div className="flex items-center gap-2">
            <input type="color" value={value || '#000000'} onChange={(e) => set(e.target.value.toUpperCase())} className="h-9 w-12 p-0.5 border border-slate-200 rounded-lg cursor-pointer" />
            <input value={value} onChange={(e) => set(e.target.value)} placeholder="#RRGGBB" className={`${base} font-mono`} />
          </div>
        </div>
      );
    }
    return (
      <div>
        {label}
        <input
          type={f.type === 'number' ? 'number' : 'text'}
          step={f.type === 'number' ? 'any' : undefined}
          min={f.type === 'number' ? '0' : undefined}
          value={value}
          onChange={(e) => set(f.upper ? e.target.value.toUpperCase() : e.target.value)}
          placeholder={f.placeholder}
          className={`${base} ${f.upper ? 'font-mono uppercase' : ''}`}
        />
        {f.hint && <p className="text-[11px] text-slate-400 mt-1">{f.hint}</p>}
      </div>
    );
  }

  const colSpan = columns.length + (hasStatus ? 1 : 0) + 2;

  return (
    <section className="w-full space-y-4">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <button type="button" onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Add {singular}
          </button>
        }
      />

      {banner && <InfoBanner storageKey={`fabricMasterBanner:${key}`} title={banner.title} text={banner.text} />}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 p-3.5 border-b border-slate-100">
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="w-full pl-9 pr-3 py-2 bg-slate-50/60 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {hasStatus && (
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer">
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            )}
            <button
              type="button"
              onClick={() => { setSearch(''); setStatusFilter('All'); }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>

        {loadError && (
          <div className="flex items-center justify-between px-4 py-2 bg-rose-50 border-b border-rose-100 text-xs text-rose-700">
            <span>{loadError}</span>
            <button type="button" onClick={load} className="font-semibold underline">Retry</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3 w-14">#</th>
                {columns.map((c) => (
                  <th key={c.key} className={`px-3 py-3 ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
                ))}
                {hasStatus && <th className="px-3 py-3">Status</th>}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((r, idx) => (
                <tr key={r.id} className="transition hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_0_#2f6fed]">
                  <td className="px-4 py-3 text-slate-500">{(safePage - 1) * PER_PAGE + idx + 1}</td>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-3 text-slate-600 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>
                      {c.render ? c.render(r) : (r[c.key] === null || r[c.key] === undefined || r[c.key] === '' ? '—' : r[c.key])}
                    </td>
                  ))}
                  {hasStatus && (
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                        <span className={`w-2 h-2 rounded-full ${r.isActive !== false ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        {r.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => openEdit(r)} title="Edit" className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition">
                        <Pencil size={15} />
                      </button>
                      <button type="button" onClick={() => { setDeleteError(''); setDeleteRow(r); }} title="Delete" className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center">
                    <p className="text-sm font-semibold text-slate-700">{loading ? 'Loading…' : `No ${title.toLowerCase()} found`}</p>
                    {!loading && (
                      <p className="text-xs text-slate-500 mt-1">
                        {rows.length === 0 ? `Click "Add ${singular}" to create the first one.` : 'Try a different search or reset filters.'}
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 border-t border-slate-100 text-xs text-slate-500 pr-20 sm:pr-24">
          <span>Showing {from} to {to} of {filtered.length}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer" aria-label="Previous page">
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-7 h-7 px-2 grid place-items-center rounded-lg bg-blue-600 text-white text-xs font-bold">{safePage}</span>
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition cursor-pointer" aria-label="Next page">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <form onSubmit={submitForm} onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">{editing ? `Edit ${singular}` : `Add ${singular}`}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[72vh] overflow-y-auto text-xs">
              {fields.map((f) => (
                <div key={f.key} className={f.half ? '' : 'sm:col-span-2'}>{renderField(f)}</div>
              ))}
              {formError && <p className="sm:col-span-2 text-[11px] font-semibold text-rose-600">{formError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-slate-50/70 border-t border-slate-100">
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50">
                {saving ? 'Saving...' : (editing ? 'Save Changes' : `Create ${singular}`)}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteRow && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4" role="presentation" onMouseDown={() => setDeleteRow(null)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900">Delete {deleteRow.name || deleteRow.label || deleteRow.code}?</h2>
            <p className="text-xs text-slate-500 mt-1">This {singular.toLowerCase()} will be removed from the list.</p>
            {deleteError && <p className="text-[11px] font-semibold text-rose-600 mt-2">{deleteError}</p>}
            <div className="flex items-center justify-end gap-2.5 mt-4">
              <button type="button" onClick={() => setDeleteRow(null)} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition">
                Cancel
              </button>
              <button type="button" onClick={confirmDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
