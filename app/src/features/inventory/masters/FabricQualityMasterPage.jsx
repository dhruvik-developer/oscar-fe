import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  Eye,
  SquarePen,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Check,
  RotateCcw,
  Layers,
  Save,
  Image as ImageIcon,
} from 'lucide-react';

import { fabricMasterSync, isBackendEnabled, describeError } from '../../../services/fabricMasterSync';
import PageInfoButton from '../../../components/ui/PageInfoButton';
import MasterSourceLink from '../../../components/common/MasterSourceLink';

const PER_PAGE = 10;

// Masters are never read from browser storage; without a session the list is empty.
function readLocalQualities() {
  return [];
}

const emptyForm = () => ({
  id: '',
  name: '',
  code: '',
  composition: '',
  gsm: '',
  width: '',
  uom: 'Meter',
  uomId: '',
  fabricTypeId: '',
  fabricTypeName: '',
  fabricId: '',
  reed: '',
  pick: '',
  warpCount: '',
  weftCount: '',
  description: '',
  imageUrl: '',
  isActive: true,
});

export default function FabricQualityMasterPage() {
  const backendOn = isBackendEnabled();
  const fileInputRef = useRef(null);

  const [rows, setRows] = useState(() => (backendOn ? [] : readLocalQualities()));
  const [fabricTypes, setFabricTypes] = useState([]);
  const [units, setUnits] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [loading, setLoading] = useState(backendOn);
  const [loadError, setLoadError] = useState('');

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [page, setPage] = useState(1);

  // Modals
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [viewRow, setViewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Form state
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Load Data from API
  const loadData = useCallback(async () => {
    if (!backendOn) {
      setRows(readLocalQualities());
      try {
        setFabricTypes([]);
        setUnits([]);
        setFabrics([]);
      } catch {
        // empty fallback
      }
      return;
    }

    setLoading(true);
    try {
      const [qualitiesRes, typesRes, unitsRes, fabricsRes] = await Promise.all([
        fabricMasterSync.pull('fabricQualities'),
        fabricMasterSync.pull('fabricTypes'),
        fabricMasterSync.pull('units'),
        fabricMasterSync.pull('fabrics'),
      ]);

      if (qualitiesRes === null) {
        setLoadError('Could not load fabric qualities from server.');
      } else {
        setRows(qualitiesRes || []);
        setLoadError('');
      }

      setFabricTypes(typesRes || []);
      setUnits(unitsRes || []);
      setFabrics(fabricsRes || []);
    } catch (err) {
      setLoadError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [backendOn]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.action-menu-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Without a server session nothing can be saved; no local copy is kept.
  const updateLocalRows = () => {
    throw new Error('You are not signed in to the server — nothing was saved.');
  };

  // Filtered rows
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'All') {
        const active = r.isActive !== false;
        if ((statusFilter === 'Active') !== active) return false;
      }
      if (!q) return true;

      const code = String(r.code || '').toLowerCase();
      const name = String(r.name || '').toLowerCase();
      const composition = String(r.composition || '').toLowerCase();
      const uom = String(r.uom || '').toLowerCase();

      return code.includes(q) || name.includes(q) || composition.includes(q) || uom.includes(q);
    });
  }, [rows, search, statusFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
  const to = Math.min(safePage * PER_PAGE, filtered.length);

  // Form opening handlers
  const openCreate = () => {
    setForm(emptyForm());
    setFormError('');
    setModalMode('create');
  };

  const openEdit = (row) => {
    setForm({
      id: row.id,
      name: row.name || '',
      code: row.code || '',
      composition: row.composition || '',
      gsm: row.gsm ?? '',
      width: row.width ?? '',
      uom: row.uom || 'Meter',
      uomId: row.uomId || '',
      fabricTypeId: row.fabricTypeId || '',
      fabricTypeName: row.fabricTypeName || '',
      fabricId: row.fabricId || '',
      reed: row.reed ?? '',
      pick: row.pick ?? '',
      warpCount: row.warpCount || '',
      weftCount: row.weftCount || '',
      description: row.description || '',
      imageUrl: row.imageUrl || '',
      isActive: row.isActive !== false,
    });
    setFormError('');
    setModalMode('edit');
    setActiveMenuId(null);
  };

  const handleView = (row) => {
    setViewRow(row);
    setActiveMenuId(null);
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, imageUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!form.name.trim()) {
      setFormError('Quality Name is required.');
      return;
    }

    if (!form.code.trim()) {
      setFormError('Quality Code is required.');
      return;
    }

    setSaving(true);
    setFormError('');

    const clean = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      composition: form.composition.trim() || null,
      gsm: form.gsm === '' ? null : Number(form.gsm),
      width: form.width === '' ? null : Number(form.width),
      uom: form.uom || 'Meter',
      uomId: form.uomId || null,
      fabricTypeId: form.fabricTypeId || null,
      fabricId: form.fabricId || null,
      description: form.description.trim() || null,
      imageUrl: form.imageUrl || null,
      isActive: Boolean(form.isActive),
    };

    try {
      if (backendOn) {
        if (modalMode === 'edit') {
          const updated = await fabricMasterSync.update('fabricQualities', form.id, clean);
          if (!updated) throw new Error('No response from the server.');
          setRows((prev) => prev.map((r) => (r.id === form.id ? updated : r)));
        } else {
          const created = await fabricMasterSync.create('fabricQualities', clean);
          if (!created) throw new Error('No response from the server.');
          setRows((prev) => [created, ...prev]);
        }
      } else {
        if (modalMode === 'edit') {
          updateLocalRows((prev) => prev.map((r) => (r.id === form.id ? { ...r, ...clean } : r)));
        } else {
          const newRow = {
            id: `qual-${Date.now()}`,
            ...clean,
          };
          updateLocalRows((prev) => [newRow, ...prev]);
        }
      }
      setModalMode(null);
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleteError('');
    try {
      if (backendOn) {
        await fabricMasterSync.remove('fabricQualities', deleteRow.id);
        setRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
      } else {
        updateLocalRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
      }
      setDeleteRow(null);
    } catch (err) {
      setDeleteError(describeError(err));
    }
  };

  const toggleStatus = async (row) => {
    setActiveMenuId(null);
    const newStatus = row.isActive === false;
    try {
      if (backendOn) {
        const updated = await fabricMasterSync.update('fabricQualities', row.id, { isActive: newStatus });
        if (updated) {
          setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
        }
      } else {
        updateLocalRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: newStatus } : r)));
      }
    } catch (err) {
      alert(`Could not update status: ${describeError(err)}`);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* ── Slide 1: Header Bar & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Breadcrumb: Inventory > Fabric Quality Master */}
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <Layers className="w-4 h-4 text-[#1e60f2]" />
          <span>Inventory</span>
          <span className="text-slate-300 font-bold">&gt;</span>
          <span className="text-slate-800 font-semibold">Fabric Quality Master</span>
          <PageInfoButton title="Fabric Quality Master" />
        </div>

        {/* Toolbar: Search + Filter + Add New */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Search box */}
          <div className="relative min-w-[240px] sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quality code, name, composition..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter button */}
          <button
            type="button"
            onClick={() => setShowFilterBar(!showFilterBar)}
            className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center transition cursor-pointer shadow-2xs ${
              showFilterBar || statusFilter !== 'All'
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Filter records"
          >
            <Filter className="w-4 h-4" />
          </button>

          {/* + Add New button */}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New</span>
          </button>
        </div>
      </div>

      {/* ── Expandable Filter Row ── */}
      {showFilterBar && (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {(statusFilter !== 'All' || search) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('All');
                setSearch('');
              }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold px-2 py-1.5 hover:bg-slate-200 rounded transition ml-auto"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      )}

      {/* ── Server Error Banner ── */}
      {loadError && (
        <div className="flex items-center justify-between px-4 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          <span>{loadError}</span>
          <button type="button" onClick={loadData} className="font-semibold underline ml-3">
            Retry
          </button>
        </div>
      )}

      {/* ── Slide 1 Table: 9 Exact Columns ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200 bg-[#f8fafc] text-slate-700 font-semibold text-xs">
                <th className="px-3 py-3.5 w-12 text-center text-slate-500 font-medium">#</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Quality Code</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Quality Name</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Composition</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800 text-center">GSM</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800 text-center">Width (Inch)</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">UOM</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800 text-center">Status</th>
                <th className="px-4 py-3.5 font-semibold text-slate-800 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((r, idx) => {
                const serialNum = (safePage - 1) * PER_PAGE + idx + 1;
                const isActive = r.isActive !== false;

                return (
                  <tr key={r.id} className="transition hover:bg-slate-50/70">
                    {/* # */}
                    <td className="px-3 py-3.5 text-center text-slate-500 font-medium">{serialNum}</td>

                    {/* Quality Code */}
                    <td className="px-3.5 py-3.5 font-semibold text-slate-900 tracking-tight whitespace-nowrap">
                      {r.code || '—'}
                    </td>

                    {/* Quality Name */}
                    <td className="px-3.5 py-3.5 font-medium text-slate-800">{r.name}</td>

                    {/* Composition */}
                    <td className="px-3.5 py-3.5 text-slate-600">{r.composition || '—'}</td>

                    {/* GSM */}
                    <td className="px-3.5 py-3.5 text-slate-700 text-center">
                      {r.gsm ? Number(r.gsm) : '—'}
                    </td>

                    {/* Width (Inch) */}
                    <td className="px-3.5 py-3.5 text-slate-700 text-center">
                      {r.width ? Number(r.width) : '—'}
                    </td>

                    {/* UOM */}
                    <td className="px-3.5 py-3.5 text-slate-700">{r.uom || 'Meter'}</td>

                    {/* Status Pill Badge */}
                    <td className="px-3.5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                          isActive
                            ? 'bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0]'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Action Buttons: Edit, Eye, More */}
                    <td className="px-4 py-3.5 text-center">
                      <div className="relative inline-flex items-center gap-1.5 action-menu-container">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          title="Edit"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        >
                          <SquarePen className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleView(r)}
                          title="View Details"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveMenuId(activeMenuId === r.id ? null : r.id)}
                          title="More Options"
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Dropdown Options */}
                        {activeMenuId === r.id && (
                          <div className="absolute right-0 top-8 z-30 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 text-left text-xs animate-in fade-in-50 duration-150">
                            <button
                              type="button"
                              onClick={() => handleView(r)}
                              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" /> View
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                            >
                              <SquarePen className="w-3.5 h-3.5 text-slate-400" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleStatus(r)}
                              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5 text-slate-400" />
                              {isActive ? 'Mark Inactive' : 'Mark Active'}
                            </button>
                            <div className="h-px bg-slate-100 my-1" />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                setDeleteError('');
                                setDeleteRow(r);
                              }}
                              className="w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Clean Empty / Loading State */}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-slate-500 font-medium">Loading fabric qualities...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <p className="text-sm font-semibold text-slate-700">No fabric qualities found</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          {rows.length === 0
                            ? 'Click "+ Add New" to create your first fabric quality record.'
                            : 'No records match your search or filter criteria. Try resetting filters.'}
                        </p>
                        {rows.length === 0 && (
                          <button
                            type="button"
                            onClick={openCreate}
                            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add New
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer & Pagination ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-600 bg-white">
          <div>
            Showing {from} to {to} of {filtered.length} entries
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setPage(pageNum)}
                className={`w-7 h-7 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center ${
                  pageNum === safePage
                    ? 'bg-[#1e60f2] text-white shadow-2xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Slide 2: Add / Edit Modal Popup (Matching Image 3 Exactly) ── */}
      {modalMode && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in-50 duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Slide 2 Top Header Block */}
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-[#f8fafc]/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1e60f2] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                    2
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                    Fabric Quality Master – {modalMode === 'edit' ? 'Edit' : 'Add / Edit'}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-bar: Breadcrumb Left & Action Buttons Right */}
              <div className="flex items-center justify-between gap-3 mt-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <Layers className="w-4 h-4 text-[#1e60f2]" />
                  <span>Inventory</span>
                  <span className="text-slate-300 font-bold">&gt;</span>
                  <span>Fabric Quality Master</span>
                  <span className="text-slate-300 font-bold">&gt;</span>
                  <span className="text-slate-800 font-semibold">
                    {modalMode === 'edit' ? 'Edit' : 'Add New'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    disabled={saving}
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 text-xs shadow-2xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleFormSubmit}
                    disabled={saving}
                    className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Slide 2 Form Body (2-Column Grid) */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs">
              {formError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ── Left Column (Inputs) ── */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Row 1: Quality Code * | Quality Name * */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Quality Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                        placeholder="COT-60S"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 font-mono uppercase shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Quality Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Cotton 60s"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Row 2: Composition * */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Composition <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.composition}
                      onChange={(e) => setForm({ ...form, composition: e.target.value })}
                      placeholder="100% Cotton"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs"
                    />
                  </div>

                  {/* Row 3: GSM (Weight) * | Width (Inch/Cm) * | Default UOM * */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        GSM (Weight) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={form.gsm}
                        onChange={(e) => setForm({ ...form, gsm: e.target.value })}
                        placeholder="120"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Width (Inch/Cm) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={form.width}
                        onChange={(e) => setForm({ ...form, width: e.target.value })}
                        placeholder="58"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">
                          Default UOM <span className="text-rose-500">*</span>
                        </label>
                        <MasterSourceLink source="uom" />
                      </div>
                      <select
                        value={form.uomId || form.uom}
                        onChange={(e) => {
                          const val = e.target.value;
                          const matched = units.find((u) => u.id === val);
                          if (matched) {
                            setForm({ ...form, uomId: matched.id, uom: matched.label || matched.code });
                          } else {
                            setForm({ ...form, uomId: '', uom: val });
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs cursor-pointer"
                      >
                        <option value="">Select UOM</option>
                        {units.filter((u) => u.isActive !== false && u.is_active !== false).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.label || u.name || u.code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Fabric Type */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-700">Fabric Type</label>
                      <MasterSourceLink source="fabricTypes" />
                    </div>
                    <select
                      value={form.fabricTypeId}
                      onChange={(e) => {
                        const val = e.target.value;
                        const matched = fabricTypes.find((t) => t.id === val);
                        setForm({
                          ...form,
                          fabricTypeId: val,
                          fabricTypeName: matched?.name || '',
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs cursor-pointer"
                    >
                      <option value="">Select fabric type (optional)</option>
                      {fabricTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Row 5: Description */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Fine quality cotton fabric suitable for shirting."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs resize-none"
                    />
                  </div>
                </div>

                {/* ── Right Column (Fabric Image & Status) ── */}
                <div className="lg:col-span-4 space-y-5">
                  {/* Fabric Image (Optional) */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      Fabric Image (Optional)
                    </label>
                    <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 flex flex-col items-center">
                      <div className="w-full h-40 rounded-lg bg-slate-100 border border-slate-200/80 overflow-hidden flex items-center justify-center relative">
                        {form.imageUrl ? (
                          <img
                            src={form.imageUrl}
                            alt="Fabric Quality"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                            <ImageIcon className="w-10 h-10 stroke-1 mb-1 text-slate-300" />
                            <span className="text-[11px] text-slate-400 font-medium">No image uploaded</span>
                          </div>
                        )}
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-3 px-4 py-1.5 bg-white hover:bg-slate-50 text-blue-600 font-semibold rounded-lg border border-blue-200 text-xs shadow-2xs transition cursor-pointer"
                      >
                        {form.imageUrl ? 'Change Image' : 'Upload Image'}
                      </button>
                    </div>
                  </div>

                  {/* Status Radio Group */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-2">Status</label>
                    <div className="flex items-center gap-6">
                      <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-800 text-xs">
                        <input
                          type="radio"
                          name="statusRadio"
                          checked={form.isActive}
                          onChange={() => setForm({ ...form, isActive: true })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Active</span>
                      </label>

                      <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-800 text-xs">
                        <input
                          type="radio"
                          name="statusRadio"
                          checked={!form.isActive}
                          onChange={() => setForm({ ...form, isActive: false })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Inactive</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View Details Modal ── */}
      {viewRow && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in-50 duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#f8fafc]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{viewRow.name}</h2>
                  <p className="text-[11px] font-mono text-slate-500">{viewRow.code || 'NO-CODE'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewRow(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {viewRow.imageUrl && (
                <div className="w-full h-36 rounded-xl overflow-hidden border border-slate-200">
                  <img src={viewRow.imageUrl} alt={viewRow.name} className="w-full h-full object-cover" />
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                  <span
                    className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      viewRow.isActive !== false
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {viewRow.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Composition</span>
                  <span className="font-semibold text-slate-800">{viewRow.composition || '—'}</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">GSM</span>
                  <span className="font-semibold text-slate-800">{viewRow.gsm || '—'}</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Width (Inch)</span>
                  <span className="font-semibold text-slate-800">{viewRow.width || '—'}</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">UOM</span>
                  <span className="font-semibold text-slate-800">{viewRow.uom || 'Meter'}</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Fabric Type</span>
                  <span className="font-semibold text-slate-800">
                    {viewRow.fabricTypeName || '—'}
                  </span>
                </div>
              </div>

              {viewRow.description && (
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block mb-1">Description</span>
                  <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {viewRow.description}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const rowToEdit = viewRow;
                    setViewRow(null);
                    openEdit(rowToEdit);
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition"
                >
                  Edit Quality
                </button>
                <button
                  type="button"
                  onClick={() => setViewRow(null)}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteRow && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in-50 duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900">
              Delete {deleteRow.name || deleteRow.code}?
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              This fabric quality record will be removed from your master catalogue.
            </p>
            {deleteError && (
              <p className="text-[11px] font-semibold text-rose-600 mt-2">{deleteError}</p>
            )}
            <div className="flex items-center justify-end gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => setDeleteRow(null)}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
