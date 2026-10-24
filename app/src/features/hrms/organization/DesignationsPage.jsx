import { useState, useEffect } from 'react';
import { useAppStore } from '../../../stores/appStore';
import Modal from '../../../components/ui/Modal';
import PageHeader from '../../../components/ui/PageHeader';
import { hrmsGuides } from '../../../data/hrms/hrmsGuides';
import { hrmsSync, isBackendEnabled } from '../../../services/hrmsSync';
import { Plus, Award, Search, Edit2, Trash2 } from 'lucide-react';

export function DesignationsPage() {
  const showToast = useAppStore((s) => s.showToast);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDesig, setNewDesig] = useState({ title: '', level: 'L4', department: 'Engineering' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await hrmsSync.pull('designations');
        if (active) {
          setDesignations(Array.isArray(rows) ? rows : []);
        }
      } catch (err) {
        console.warn('[DesignationsPage] Failed to pull designations:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = designations.filter(
    (d) =>
      String(d.title ?? '').toLowerCase().includes(q.toLowerCase()) ||
      String(d.department ?? '').toLowerCase().includes(q.toLowerCase()) ||
      String(d.level ?? '').toLowerCase().includes(q.toLowerCase())
  );

  async function handleCreate(e) {
    e.preventDefault();
    if (!newDesig.title.trim()) return;
    const created = { id: `DSG-0${designations.length + 1}`, ...newDesig, count: 0 };
    setDesignations([created, ...designations]);
    try {
      if (isBackendEnabled()) {
        const saved = await hrmsSync.create('designations', created);
        if (saved?.id) {
          setDesignations((prev) => prev.map((d) => (d.id === created.id ? saved : d)));
        }
      }
    } catch (err) {
      console.warn('[DesignationsPage] Failed to create designation on server:', err);
    }
    showToast(`Designation "${newDesig.title}" created successfully`);
    setIsModalOpen(false);
    setNewDesig({ title: '', level: 'L4', department: 'Engineering' });
  }

  async function handleDelete(id, title) {
    setDesignations(designations.filter((x) => x.id !== id));
    try {
      if (isBackendEnabled()) {
        await hrmsSync.remove('designations', id);
      }
    } catch (err) {
      console.warn('[DesignationsPage] Failed to delete designation on server:', err);
    }
    showToast(`Designation "${title}" removed`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Designations"
        subtitle="Define corporate job roles, leveling framework, and departmental allocations"
        guide={hrmsGuides.designations}
        actions={
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-navy hover:bg-navy/90 text-white rounded-xl text-[13.5px] font-medium flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} /> Add Designation
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white border border-bdr rounded-xl p-4 shadow-xs flex flex-wrap justify-between items-center gap-3">
        <div className="relative w-full sm:w-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, level, or department..."
            className="pl-9 pr-4 h-9 w-full sm:w-72 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy"
          />
        </div>
      </div>

      {/* Main Table View */}
      {loading ? (
        <div className="py-16 text-center text-muted text-sm bg-white border border-bdr rounded-xl">
          Loading designations…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted text-[13px] bg-white border border-bdr rounded-xl">
          {q ? `No designations matching "${q}"` : 'No designations found. Add the first designation to get started.'}
        </div>
      ) : (
        <div className="bg-white border border-bdr rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] lg:min-w-0 text-left">
              <thead className="bg-off border-b border-bdr text-[11px] uppercase text-muted">
                <tr>
                  <th className="py-3 px-5">Job Title</th>
                  <th className="py-3 px-5">Level</th>
                  <th className="py-3 px-5">Department</th>
                  <th className="py-3 px-5">Assigned Employees</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bdr/40 text-[13px]">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-off/60 transition-colors">
                    <td className="py-4 px-5 font-semibold text-slate-900 flex items-center gap-2">
                      <Award size={15} className="text-navy shrink-0" />
                      {r.title}
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          r.level === 'L7' || r.level === 'L6'
                            ? 'bg-navy text-white border-navy'
                            : r.level === 'L5'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-off border-bdr text-slate-700'
                        }`}
                      >
                        {r.level}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-slate-700">{r.department}</td>
                    <td className="py-4 px-5 font-medium text-slate-700">{r.count || 0} members</td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => showToast(`Edit ${r.title}`)}
                          className="w-8 h-8 rounded-lg hover:bg-off grid place-items-center text-muted transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id, r.title)}
                          className="w-8 h-8 rounded-lg hover:bg-red-50 text-muted hover:text-red-600 grid place-items-center transition-colors cursor-pointer"
                          title="Delete"
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
      )}

      {/* Modal: Create Designation */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Designation">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Designation Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Lead Product Designer"
              value={newDesig.title}
              onChange={(e) => setNewDesig({ ...newDesig, title: e.target.value })}
              className="w-full px-3.5 py-2 bg-off border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Level Framework
              </label>
              <select
                value={newDesig.level}
                onChange={(e) => setNewDesig({ ...newDesig, level: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
              >
                <option value="L1">L1 — Associate</option>
                <option value="L2">L2 — Junior</option>
                <option value="L3">L3 — Mid-Level</option>
                <option value="L4">L4 — Senior</option>
                <option value="L5">L5 — Staff / Lead</option>
                <option value="L6">L6 — Director / Head</option>
                <option value="L7">L7 — Executive</option>
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Department
              </label>
              <select
                value={newDesig.department}
                onChange={(e) => setNewDesig({ ...newDesig, department: e.target.value })}
                className="w-full px-3.5 py-2 bg-white border border-bdr rounded-xl text-[13.5px] focus:outline-none focus:border-navy"
              >
                <option>Engineering</option>
                <option>Human Resources</option>
                <option>Finance</option>
                <option>Product</option>
                <option>Sales & CRM</option>
                <option>Marketing</option>
              </select>
            </div>
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
              Save Designation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export const Designations = DesignationsPage;
export default DesignationsPage;
