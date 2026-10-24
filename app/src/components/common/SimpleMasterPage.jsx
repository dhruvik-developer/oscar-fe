import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, RefreshCw, Pencil, X, CheckCircle2, XCircle } from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../ui/PageHeader';
import TablePagination from '../ui/TablePagination';

/** Every page of an envelope list (page_size is capped at 200 server-side). */
async function fetchAll(endpoint, query) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const res = await api.get(endpoint, { query: { ...query, page, page_size: 200 } });
    if (Array.isArray(res)) return res;
    rows.push(...(Array.isArray(res?.results) ? res.results : []));
    if (!res?.next) return rows;
  }
}

function errorText(err, fallback) {
  if (!err) return fallback;
  const fieldErrors = err.payload?.field_errors || err.payload?.fieldErrors || err.field_errors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const details = Object.entries(fieldErrors)
      .map(([field, msgs]) => `${field}: ${[].concat(msgs).join(', ')}`)
      .join('; ');
    if (details) return `${err.message || fallback} (${details})`;
  }
  return err.message || fallback;
}

const isRowActive = (row) => row.isActive ?? row.is_active ?? true;

/**
 * A small list + add + edit + activate/deactivate screen for one REST master.
 *
 *   fields:  [{ key, label, type: 'text'|'number'|'select'|'checkbox', required,
 *              options: [{value,label}] | (rows, aux) => [...], placeholder,
 *              hint, locked: (row) => bool }]
 *   columns: [{ key, label, render?: (row, ctx) => node, className? }]
 *   loadAux: optional async () => object, passed to select `options` and column renders.
 */
export default function SimpleMasterPage({
  title,
  subtitle,
  entityLabel,
  endpoint,
  query,
  fields,
  columns,
  defaults = {},
  searchKeys = ['name'],
  loadAux,
  toPayload,
}) {
  const [rows, setRows] = useState([]);
  const [aux, setAux] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, row = edit
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const queryKey = JSON.stringify(query || {});
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, extra] = await Promise.all([
        fetchAll(endpoint, JSON.parse(queryKey)),
        loadAux ? loadAux() : Promise.resolve({}),
      ]);
      setRows(list);
      setAux(extra || {});
    } catch (err) {
      setRows([]);
      setError(errorText(err, `Could not load ${title.toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
  }, [endpoint, queryKey, loadAux, title]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!showInactive && !isRowActive(row)) return false;
      if (!q) return true;
      return searchKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(q));
    });
  }, [rows, search, showInactive, searchKeys]);

  // Back to page 1 when the filter changes; stay in range when rows shrink.
  useEffect(() => { setPage(1); }, [search, showInactive]);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const activeCount = rows.filter(isRowActive).length;

  const openAdd = () => {
    setForm({ isActive: true, ...defaults });
    setFormError('');
    setEditing({});
  };

  const openEdit = (row) => {
    const next = { isActive: isRowActive(row) };
    fields.forEach((f) => { next[f.key] = row[f.key] ?? (f.type === 'checkbox' ? false : ''); });
    setForm(next);
    setFormError('');
    setEditing(row);
  };

  const close = () => { if (!saving) setEditing(null); };

  const save = async (e) => {
    e.preventDefault();
    const missing = fields.find((f) => f.required && String(form[f.key] ?? '').trim() === '');
    if (missing) { setFormError(`${missing.label} is required.`); return; }
    const payload = { isActive: Boolean(form.isActive) };
    fields.forEach((f) => {
      if (editing?.id && f.locked?.(editing)) return;
      let v = form[f.key];
      if (f.type === 'checkbox') v = Boolean(v);
      else if (f.type === 'number') v = v === '' || v == null ? undefined : Number(v);
      else if (typeof v === 'string') v = v.trim();
      if (f.type === 'select' && v === '') v = null;
      if (v !== undefined) payload[f.key] = v;
    });
    setSaving(true);
    setFormError('');
    try {
      const body = toPayload ? toPayload(payload, editing) : payload;
      if (editing?.id) await api.patch(`${endpoint}${editing.id}/`, body);
      else await api.post(endpoint, body);
      setEditing(null);
      load();
    } catch (err) {
      setFormError(errorText(err, `Could not save the ${entityLabel.toLowerCase()}.`));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    setBusyId(row.id);
    setError('');
    try {
      await api.patch(`${endpoint}${row.id}/`, { isActive: !isRowActive(row) });
      await load();
    } catch (err) {
      setError(errorText(err, 'Could not change the status.'));
    } finally {
      setBusyId(null);
    }
  };

  const optionsFor = (f) => (typeof f.options === 'function' ? f.options(rows, aux, editing) : f.options) || [];
  const inputCls = 'w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white disabled:bg-slate-50 disabled:text-slate-500';

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <Plus size={15} /> Add {entityLabel}
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#dce5f4] shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded text-blue-600" />
            Show inactive
          </label>
          <span className="text-xs text-slate-500 font-medium">
            {activeCount} active / {rows.length} total
          </span>
          <button
            type="button"
            onClick={load}
            title="Refresh"
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 border border-slate-200 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && rows.length > 0 && (
        <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-[#dce5f4] shadow-xs overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw size={16} className="animate-spin text-blue-500" /> Loading...
          </div>
        ) : error && rows.length === 0 ? (
          <div className="p-8 text-center text-rose-500 text-xs">{error}</div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No records found. Click &quot;Add {entityLabel}&quot; above to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  {columns.map((c) => <th key={c.key} className={`px-4 py-3 ${c.className || ''}`}>{c.label}</th>)}
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((row) => {
                  const active = isRowActive(row);
                  return (
                    <tr key={row.id} className={`hover:bg-slate-50/70 transition-colors ${active ? '' : 'opacity-60'}`}>
                      {columns.map((c) => (
                        <td key={c.key} className={`px-4 py-3 text-slate-700 ${c.className || ''}`}>
                          {c.render ? c.render(row, { rows, aux }) : (row[c.key] ?? '—')}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => toggleActive(row)}
                            className={`p-1.5 rounded-md transition disabled:opacity-50 ${
                              active ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={active ? 'Deactivate' : 'Activate'}
                          >
                            {active ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {visible.length > 0 && (
          <TablePagination
            total={visible.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{editing.id ? 'Edit' : 'Add New'} {entityLabel}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Fill in the details below</p>
              </div>
              <button type="button" onClick={close} className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={save} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {formError && <div className="p-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700">{formError}</div>}
              {fields.map((f) => {
                const locked = Boolean(editing.id && f.locked?.(editing));
                const id = `smp-${f.key}`;
                if (f.type === 'checkbox') {
                  return (
                    <div key={f.key} className="flex items-center gap-2">
                      <input
                        id={id}
                        type="checkbox"
                        disabled={locked}
                        checked={Boolean(form[f.key])}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor={id} className="text-xs font-medium text-slate-700">{f.label}</label>
                      {f.hint && <span className="text-[11px] text-slate-400">{f.hint}</span>}
                    </div>
                  );
                }
                return (
                  <div key={f.key}>
                    <label htmlFor={id} className="block font-semibold text-slate-700 mb-1">
                      {f.label}{f.required ? ' *' : ''}
                    </label>
                    {f.type === 'select' ? (
                      <select
                        id={id}
                        disabled={locked}
                        value={form[f.key] ?? ''}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className={inputCls}
                      >
                        {!f.required && <option value="">{f.placeholder || '— None —'}</option>}
                        {f.required && <option value="">{f.placeholder || 'Select...'}</option>}
                        {optionsFor(f).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        id={id}
                        type={f.type === 'number' ? 'number' : 'text'}
                        step={f.type === 'number' ? (f.step || 'any') : undefined}
                        disabled={locked}
                        value={form[f.key] ?? ''}
                        placeholder={f.placeholder}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className={inputCls}
                      />
                    )}
                    {(locked && f.lockedHint) ? <p className="mt-1 text-[11px] text-slate-400">{f.lockedHint}</p>
                      : f.hint ? <p className="mt-1 text-[11px] text-slate-400">{f.hint}</p> : null}
                  </div>
                );
              })}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="smp-isActive"
                  checked={Boolean(form.isActive)}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="smp-isActive" className="text-xs font-medium text-slate-700">Active (shown in dropdowns)</label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button type="button" onClick={close} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-xs disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
