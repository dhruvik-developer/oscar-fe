import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import AppPagination from '../../components/ui/AppPagination';
import { api } from '../../services/api';
import { refreshNotifications } from '../../services/crmEventNotifications';
import { routeForNotification } from '../../services/notificationCenter';
import { describeApiError } from '../accounts/accountingShared';

const VIEWS = [
  ['inbox', 'Inbox'],
  ['unread', 'Unread'],
  ['snoozed', 'Snoozed'],
  ['archived', 'Archived'],
];
const CATEGORIES = [['', 'All modules'], ['crm', 'CRM'], ['pms', 'Projects'], ['hrms', 'HR'], ['erp', 'ERP'], ['system', 'System']];

const when = (iso) => (iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

/** Every notification of the signed-in user, beyond the bell's latest 100: read, snoozed and dismissed ones too. */
export default function NotificationsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState('inbox');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState({ results: [], count: 0 });
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const body = await api.get('/notifications/', {
        query: {
          view: view === 'unread' ? 'inbox' : view, unread: view === 'unread' ? 'true' : undefined,
          category: category || undefined, search: search.trim() || undefined, page, page_size: pageSize,
        },
      });
      setData({ results: body?.results || [], count: body?.count ?? (body?.results || []).length });
      setSelected(new Set());
    } catch (err) {
      setError(describeApiError(err) || 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [view, category, search, page, pageSize]);
  useEffect(() => { load(); }, [load]);

  const act = async (ids, action, message) => {
    setError('');
    try {
      const res = await api.post('/notifications/bulk/', { ids, action });
      setNote(`${message} (${res?.updated ?? ids.length}).`);
      refreshNotifications();
      load();
    } catch (err) {
      setError(describeApiError(err) || 'That could not be done.');
    }
  };

  const open = (row) => {
    const path = routeForNotification(row);
    if (!row.read) api.post(`/notifications/${row.id}/read/`, {}).then(refreshNotifications).catch(() => {});
    if (path) navigate(path);
  };

  const rows = data.results;
  const ids = [...selected];
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const btn = 'h-8 px-3 rounded-lg border border-slate-200 font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50';

  return (
    <div className="space-y-4 text-xs">
      <PageHeader title="All notifications" subtitle="Your notification history. Snoozed ones return to the bell as unread at the chosen time; archived ones were dismissed from the bell." />
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Notification box" className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {VIEWS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => { setView(key); setPage(1); }}
              className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer ${view === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
          ))}
        </div>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="h-9 px-2 rounded-lg border border-slate-200 bg-white" aria-label="Module">
          {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search title or text" className="h-9 px-2.5 rounded-lg border border-slate-200 w-60" aria-label="Search notifications" />
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-blue-200 bg-blue-50">
          <span className="font-semibold">{selected.size} selected</span>
          {view !== 'archived' && <button type="button" className={btn} onClick={() => act(ids, 'read', 'Marked read')}>Mark read</button>}
          {view !== 'archived' && <button type="button" className={btn} onClick={() => act(ids, 'unread', 'Marked unread')}>Mark unread</button>}
          {view !== 'archived' && <button type="button" className={btn} onClick={() => act(ids, 'dismiss', 'Dismissed')}>Dismiss</button>}
          {(view === 'archived' || view === 'snoozed') && <button type="button" className={btn} onClick={() => act(ids, 'restore', 'Moved back to the inbox')}>Move to inbox</button>}
        </div>
      )}
      {note && <div role="status" className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">{note}</div>}
      {error && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px]">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="p-2 w-8"><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all on this page" /></th>
              <th className="text-left p-2">Notification</th>
              <th className="text-left p-2">Module</th>
              <th className="text-left p-2">From</th>
              <th className="text-left p-2">Received</th>
              <th className="text-left p-2">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={6} className="p-6 text-center text-slate-400">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">Nothing here.</td></tr>}
            {!loading && rows.map((r) => {
              const task = r.entityType === 'CrmTask' ? r.meta : null;
              return (
                <tr key={r.id} className={r.read ? '' : 'bg-blue-50/40'}>
                  <td className="p-2 align-top"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.title}`} /></td>
                  <td className="p-2">
                    <button type="button" onClick={() => open(r)} className={`text-left hover:underline cursor-pointer ${r.read ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{r.title}</button>
                    {r.body && <div className="text-slate-500">{r.body}</div>}
                    {task && <div className="text-[11px] text-slate-500">Task: {task.taskStatus}{task.dueDate ? ` · due ${task.dueDate}` : ''}</div>}
                  </td>
                  <td className="p-2 uppercase text-[10px] font-semibold text-slate-500">{r.category}</td>
                  <td className="p-2">{r.actorName || 'System'}</td>
                  <td className="p-2 whitespace-nowrap">{when(r.createdAt)}</td>
                  <td className="p-2 whitespace-nowrap">
                    {r.dismissed ? 'Archived' : r.snoozedUntil && new Date(r.snoozedUntil) > new Date() ? `Snoozed till ${when(r.snoozedUntil)}` : r.read ? 'Read' : 'Unread'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AppPagination total={data.count} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[25, 50, 100]} loading={loading} />
    </div>
  );
}
