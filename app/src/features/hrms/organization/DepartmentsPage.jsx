import { useState, useEffect } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { Badge } from '../../../components/hrms/Badge';
import Modal from '../../../components/ui/Modal';
import PageHeader from '../../../components/ui/PageHeader';
import { hrmsGuides } from '../../../data/hrms/hrmsGuides';
import { hrmsSync, isBackendEnabled } from '../../../services/hrmsSync';
import { Avatar } from "../../../components/hrms/Avatar";
import {
  Building2,
  Plus,
  Search,
  LayoutList,
  LayoutGrid,
  Edit2,
  Trash2,
} from 'lucide-react';

export function DepartmentsPage() {
  const showToast = useAppStore((s) => s.showToast);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [view, setView] = useState('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', head: '', budget: '' });

  // Edit & Delete states
  const [editingDept, setEditingDept] = useState(null);
  const [deletingDept, setDeletingDept] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await hrmsSync.pull('departments');
        if (active) {
          setDepartments(Array.isArray(rows) ? rows : []);
        }
      } catch (err) {
        console.warn('[DepartmentsPage] Failed to pull departments:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = departments.filter((d) =>
    String(d.name ?? '').toLowerCase().includes(q.toLowerCase()) ||
    String(d.head ?? '').toLowerCase().includes(q.toLowerCase())
  );

  async function handleCreate(e) {
    e.preventDefault();
    if (!newDept.name.trim()) return;
    const created = {
      id: `DEP-0${departments.length + 1}`,
      name: newDept.name,
      head: newDept.head,
      avatar: '',
      teams: 1,
      employees: 1,
      openRoles: 0,
      budget: newDept.budget || '$150,000',
      status: 'Active',
    };
    setDepartments([created, ...departments]);
    try {
      if (isBackendEnabled()) {
        const saved = await hrmsSync.create('departments', created);
        if (saved?.id) {
          setDepartments((prev) => prev.map((d) => (d.id === created.id ? saved : d)));
        }
      }
    } catch (err) {
      console.warn('[DepartmentsPage] Failed to create department on server:', err);
    }
    showToast(`Department "${newDept.name}" created successfully`);
    setIsModalOpen(false);
    setNewDept({ name: '', head: '', budget: '' });
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!editingDept || !editingDept.name.trim()) return;
    setDepartments((prev) =>
      prev.map((d) => (d.id === editingDept.id ? editingDept : d))
    );
    try {
      if (isBackendEnabled()) {
        const saved = await hrmsSync.update('departments', editingDept.id, editingDept);
        if (saved?.id) {
          setDepartments((prev) => prev.map((d) => (d.id === editingDept.id ? saved : d)));
        }
      }
    } catch (err) {
      console.warn('[DepartmentsPage] Failed to update department on server:', err);
    }
    showToast(`Department "${editingDept.name}" updated successfully`);
    setEditingDept(null);
  }

  async function handleDeleteConfirm() {
    if (!deletingDept) return;
    const target = deletingDept;
    setDepartments((prev) => prev.filter((d) => d.id !== target.id));
    setDeletingDept(null);
    try {
      if (isBackendEnabled()) {
        await hrmsSync.remove('departments', target.id);
      }
    } catch (err) {
      console.warn('[DepartmentsPage] Failed to delete department on server:', err);
    }
    showToast(`Department "${target.name}" deleted`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Departments"
        subtitle="Manage organizational structure, operational units, and leadership"
        guide={hrmsGuides.departments}
        actions={
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13.5px] font-medium flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} /> Add Department
          </button>
        }
      />

      {/* Filter / View Control Bar */}
      <div className="bg-white border border-bdr rounded-xl p-4 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="relative w-full sm:w-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search department or head..."
            className="pl-9 pr-4 h-9 w-full sm:w-64 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy"
          />
        </div>

        <div className="flex p-1 bg-off border border-bdr rounded-xl">
          <button
            type="button"
            onClick={() => setView('table')}
            className={`px-3 py-1.5 rounded-lg text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer ${
              view === 'table' ? 'bg-white border border-bdr shadow-xs font-medium text-slate-900' : 'text-muted hover:text-slate-700'
            }`}
          >
            <LayoutList size={14} /> List
          </button>
          <button
            type="button"
            onClick={() => setView('grid')}
            className={`px-3 py-1.5 rounded-lg text-[12px] flex items-center gap-1.5 transition-colors cursor-pointer ${
              view === 'grid' ? 'bg-white border border-bdr shadow-xs font-medium text-slate-900' : 'text-muted hover:text-slate-700'
            }`}
          >
            <LayoutGrid size={14} /> Grid
          </button>
        </div>
      </div>

      {/* Main Content View */}
      {loading ? (
        <div className="py-16 text-center text-muted text-sm bg-white border border-bdr rounded-xl">
          Loading departments…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted text-[13px] bg-white border border-bdr rounded-xl">
          {q ? `No departments matching "${q}"` : 'No departments found. Add the first department to get started.'}
        </div>
      ) : view === 'table' ? (
        <div className="bg-white border border-bdr rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] lg:min-w-0 text-left">
              <thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted">
                <tr>
                  <th className="py-3 px-5">Department</th>
                  <th className="py-3 px-5">Head</th>
                  <th className="py-3 px-5">Teams</th>
                  <th className="py-3 px-5">Employees</th>
                  <th className="py-3 px-5">Open Roles</th>
                  <th className="py-3 px-5">Budget</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/40 text-[13px]">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-off/60 transition-colors">
                    <td className="py-4 px-5 font-semibold text-slate-900 flex items-center gap-2">
                      <Building2 size={16} className="text-navy shrink-0" />
                      {d.name}
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        {d.head ? <Avatar name={d.head} size="xs" /> : null}
                        <span className="font-medium text-slate-800">{d.head || '—'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-slate-700">{d.teams || 0} teams</td>
                    <td className="py-4 px-5 text-slate-700">{d.employees || 0} members</td>
                    <td className="py-4 px-5">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-medium">
                        {d.openRoles || 0} open
                      </span>
                    </td>
                    <td className="py-4 px-5 font-medium text-slate-700">{d.budget || '—'}</td>
                    <td className="py-4 px-5">
                      <Badge tone={d.status === 'Active' ? 'success' : 'warning'}>
                        {d.status || 'Active'}
                      </Badge>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingDept({ ...d })}
                          className="p-1.5 text-muted hover:text-navy hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit department"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingDept(d)}
                          className="p-1.5 text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete department"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <div key={d.id} className="bg-white border border-bdr rounded-xl p-5 shadow-xs hover:border-slate-400 transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-[15px] text-slate-900">{d.name}</h3>
                  <div className="flex items-center gap-1">
                    <Badge tone={d.status === 'Active' ? 'success' : 'warning'}>{d.status || 'Active'}</Badge>
                    <button
                      type="button"
                      onClick={() => setEditingDept({ ...d })}
                      className="p-1 text-muted hover:text-navy rounded"
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingDept(d)}
                      className="p-1 text-muted hover:text-red-600 rounded"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="text-[12.5px] text-muted flex items-center gap-2 mt-2.5">
                  {d.head ? <Avatar name={d.head} size="xs" /> : null}
                  <span>Head: <b className="text-slate-800 font-medium">{d.head || '—'}</b></span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-bdr/60 text-[11px]">
                <span className="px-2.5 py-1 bg-off border border-bdr rounded-full text-slate-700 font-medium">
                  {d.teams || 0} teams
                </span>
                <span className="px-2.5 py-1 bg-off border border-bdr rounded-full text-slate-700 font-medium">
                  {d.employees || 0} employees
                </span>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-medium">
                  {d.openRoles || 0} open roles
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Department */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Department">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Artificial Intelligence"
              value={newDept.name}
              onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Department Head
            </label>
            <input
              type="text"
              placeholder="e.g. Department Head Name"
              value={newDept.head}
              onChange={(e) => setNewDept({ ...newDept, head: e.target.value })}
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Annual Budget
            </label>
            <input
              type="text"
              placeholder="e.g. $300,000"
              value={newDept.budget}
              onChange={(e) => setNewDept({ ...newDept, budget: e.target.value })}
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
            />
          </div>
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-bdr bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
            >
              Save Department
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Department */}
      <Modal isOpen={Boolean(editingDept)} onClose={() => setEditingDept(null)} title="Edit Department">
        {editingDept && (
          <form onSubmit={handleUpdate} className="flex flex-col gap-4">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Department Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editingDept.name || ''}
                onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Department Head
              </label>
              <input
                type="text"
                value={editingDept.head || ''}
                onChange={(e) => setEditingDept({ ...editingDept, head: e.target.value })}
                className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Annual Budget
              </label>
              <input
                type="text"
                value={editingDept.budget || ''}
                onChange={(e) => setEditingDept({ ...editingDept, budget: e.target.value })}
                className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
              />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Status
              </label>
              <select
                value={editingDept.status || 'Active'}
                onChange={(e) => setEditingDept({ ...editingDept, status: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
              >
                <option value="Active">Active</option>
                <option value="Restructuring">Restructuring</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-bdr">
              <button
                type="button"
                onClick={() => setEditingDept(null)}
                className="px-4 py-2 border border-bdr bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
              >
                Update Department
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Delete Confirmation */}
      <Modal isOpen={Boolean(deletingDept)} onClose={() => setDeletingDept(null)} title="Delete Department">
        {deletingDept && (
          <div className="flex flex-col gap-4">
            <p className="text-[13.5px] text-slate-700">
              Are you sure you want to delete department <strong>{deletingDept.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-bdr">
              <button
                type="button"
                onClick={() => setDeletingDept(null)}
                className="px-4 py-2 border border-bdr bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[13px] font-medium transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export const Departments = DepartmentsPage;
export default DepartmentsPage;
