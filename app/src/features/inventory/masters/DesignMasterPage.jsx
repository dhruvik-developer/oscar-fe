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
  ImageOff,
  Image as ImageIcon,
  Save,
} from 'lucide-react';

import { fabricMasterSync, isBackendEnabled, describeError } from '../../../services/fabricMasterSync';
import { uploadFileToBackend } from '../../../services/fileUploadService';
import PageInfoButton from '../../../components/ui/PageInfoButton';

// Design Master — list (slide 3) plus an Add / Edit / View popup (slide 4)
// laid out like the Fabric Quality Master popup. Logged in → rows live in
// Postgres (/inventory/designs/) and the image goes through the two-step
// file upload. No session → nothing can be saved (no browser copy),
// with the image kept as a data URL.

const PER_PAGE = 10;
const PATTERN_TYPES = ['Printed', 'Yarn Dyed', 'Jacquard', 'Dobby', 'Solid', 'Embroidered', 'Other'];
const SEASON_SUGGESTIONS = ['Regular', 'Premium', 'Summer 2025', 'Winter 2025', 'Festive 2025'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Masters are never read from browser storage; without a session the list is empty.
function readLocal() {
  return [];
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.readAsDataURL(file);
  });
}

const emptyForm = () => ({
  code: '',
  name: '',
  patternType: '',
  reference: '',
  season: '',
  description: '',
  isActive: true,
});

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 disabled:bg-slate-50 disabled:text-slate-600';

function Thumb({ url, name, className }) {
  if (!url) {
    return (
      <div className={`${className} rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300`}>
        <ImageOff className="w-4 h-4" />
      </div>
    );
  }
  return <img src={url} alt={name} className={`${className} rounded-md object-cover border border-slate-200`} />;
}

export default function DesignMasterPage() {
  const backendOn = isBackendEnabled();
  const fileInputRef = useRef(null);

  const [rows, setRows] = useState(() => (backendOn ? [] : readLocal()));
  const [loading, setLoading] = useState(backendOn);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [patternFilter, setPatternFilter] = useState('All');
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [page, setPage] = useState(1);
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Add / Edit / View popup: mode is 'create' | 'edit' | 'view' | null.
  const [panelMode, setPanelMode] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const loadData = useCallback(async () => {
    if (!backendOn) {
      setRows(readLocal());
      return;
    }
    setLoading(true);
    const result = await fabricMasterSync.pull('designs');
    if (result === null) setLoadError('Could not load designs from the server.');
    else {
      setRows(result);
      setLoadError('');
    }
    setLoading(false);
  }, [backendOn]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, patternFilter]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.action-menu-container')) setActiveMenuId(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Free the object URL of a picked-but-unsaved image.
  useEffect(() => () => {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  // Without a server session nothing can be saved; no local copy is kept.
  const updateLocalRows = () => {
    throw new Error('You are not signed in to the server — nothing was saved.');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'All' && (statusFilter === 'Active') !== (r.isActive !== false)) return false;
      if (patternFilter !== 'All' && r.patternType !== patternFilter) return false;
      if (!q) return true;
      return [r.code, r.name, r.patternType, r.season, r.reference]
        .some((v) => String(v ?? '').toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, patternFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
  const to = Math.min(safePage * PER_PAGE, filtered.length);
  const filtersOn = statusFilter !== 'All' || patternFilter !== 'All';

  // ── Popup ─────────────────────────────────────────────────────────
  const openPanel = (mode, row = null) => {
    setActiveMenuId(null);
    setEditingRow(row);
    setForm(row
      ? {
          code: row.code || '',
          name: row.name || '',
          patternType: row.patternType || '',
          reference: row.reference || '',
          season: row.season || '',
          description: row.description || '',
          isActive: row.isActive !== false,
        }
      : emptyForm());
    setImageFile(null);
    setImagePreview(row?.imageUrl || null);
    setImageRemoved(false);
    setFormError('');
    setPanelMode(mode);
  };

  const closePanel = useCallback(() => {
    if (!saving) setPanelMode(null);
  }, [saving]);

  useEffect(() => {
    if (!panelMode) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closePanel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panelMode, closePanel]);

  const pickImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Choose an image file (PNG, JPG or WebP).');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFormError('The image must be 5 MB or smaller.');
      return;
    }
    setFormError('');
    setImageFile(file);
    setImageRemoved(false);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(true);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (saving) return;
    if (!form.code.trim()) return setFormError('Design Code is required.');
    if (!form.name.trim()) return setFormError('Design Name is required.');
    if (!form.patternType) return setFormError('Pattern Type is required.');

    const clean = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      patternType: form.patternType,
      reference: form.reference.trim() || null,
      season: form.season.trim() || null,
      description: form.description.trim() || null,
      isActive: Boolean(form.isActive),
    };

    setSaving(true);
    setFormError('');
    try {
      if (backendOn) {
        if (imageFile) clean.imageFileId = await uploadFileToBackend(imageFile, imageFile.name, 'other');
        else if (imageRemoved) clean.imageFileId = null;
        const saved = editingRow
          ? await fabricMasterSync.update('designs', editingRow.id, clean)
          : await fabricMasterSync.create('designs', clean);
        if (!saved) throw new Error('No response from the server.');
        setRows((prev) => (editingRow ? prev.map((r) => (r.id === editingRow.id ? saved : r)) : [saved, ...prev]));
      } else {
        let imageUrl = editingRow?.imageUrl || null;
        if (imageFile) imageUrl = await readAsDataUrl(imageFile);
        else if (imageRemoved) imageUrl = null;
        const duplicate = rows.some(
          (r) => r.id !== editingRow?.id && String(r.code).toUpperCase() === clean.code,
        );
        if (duplicate) throw new Error(`Code ${clean.code} is already used.`);
        if (editingRow) {
          updateLocalRows((prev) => prev.map((r) => (r.id === editingRow.id ? { ...r, ...clean, imageUrl } : r)));
        } else {
          updateLocalRows((prev) => [{ id: `designs-local-${Date.now()}`, ...clean, imageUrl }, ...prev]);
        }
      }
      setSaving(false);
      setPanelMode(null);
    } catch (err) {
      setFormError(describeError(err));
      setSaving(false);
    }
  };

  const toggleStatus = async (row) => {
    setActiveMenuId(null);
    const isActive = row.isActive === false;
    try {
      if (backendOn) {
        const updated = await fabricMasterSync.update('designs', row.id, { isActive });
        if (updated) setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      } else {
        updateLocalRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive } : r)));
      }
    } catch (err) {
      setLoadError(`Could not update status: ${describeError(err)}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleteError('');
    try {
      if (backendOn) {
        await fabricMasterSync.remove('designs', deleteRow.id);
        setRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
      } else {
        updateLocalRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
      }
      setDeleteRow(null);
    } catch (err) {
      setDeleteError(describeError(err));
    }
  };

  const readOnly = panelMode === 'view';
  const crumbTail = panelMode === 'create' ? 'Add New' : panelMode === 'edit' ? 'Edit' : 'View';

  return (
    <div className="w-full space-y-4">
      {/* ── Slide 3 header ── */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#1e60f2] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
          3
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">Design Master – List</h1>
        <PageInfoButton title="Design Master" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Layers className="w-4 h-4 text-[#1e60f2]" />
          <span>Inventory</span>
          <span className="text-slate-300 font-bold">&gt;</span>
          <span className="text-slate-800 font-semibold">Design Master</span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="relative min-w-[240px] sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search design code, name..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs transition"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFilterBar(!showFilterBar)}
            className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center transition cursor-pointer shadow-2xs ${
              showFilterBar || filtersOn ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Filter records"
          >
            <Filter className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => openPanel('create')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New</span>
          </button>
        </div>
      </div>

      {showFilterBar && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Status:</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500">
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Pattern Type:</span>
            <select value={patternFilter} onChange={(e) => setPatternFilter(e.target.value)} className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500">
              <option value="All">All Types</option>
              {PATTERN_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {(filtersOn || search) && (
            <button
              type="button"
              onClick={() => { setStatusFilter('All'); setPatternFilter('All'); setSearch(''); }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold px-2 py-1.5 hover:bg-slate-200 rounded transition ml-auto"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          <span>{loadError}</span>
          <button type="button" onClick={loadData} className="font-semibold underline ml-3">Retry</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-200 bg-[#f8fafc] text-slate-700 font-semibold text-xs">
                <th className="px-3.5 py-3.5 w-12 text-center text-slate-500 font-medium">#</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Design Code</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Design Name</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Pattern Type</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Season / Collection</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800 text-center">Image</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800 text-center">Status</th>
                <th className="px-4 py-3.5 font-semibold text-slate-800 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((r, idx) => {
                const isActive = r.isActive !== false;
                return (
                  <tr key={r.id} className="transition hover:bg-slate-50/70">
                    <td className="px-3.5 py-2.5 text-center text-slate-500 font-medium">{(safePage - 1) * PER_PAGE + idx + 1}</td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900 tracking-tight whitespace-nowrap">{r.code || '—'}</td>
                    <td className="px-3.5 py-2.5 font-medium text-slate-800">{r.name}</td>
                    <td className="px-3.5 py-2.5 text-slate-700">{r.patternType || '—'}</td>
                    <td className="px-3.5 py-2.5 text-slate-700">{r.season || '—'}</td>
                    <td className="px-3.5 py-2.5">
                      <div className="flex justify-center">
                        <Thumb url={r.imageUrl} name={r.name} className="w-16 h-10" />
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                          isActive ? 'bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0]' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="relative inline-flex items-center gap-1.5 action-menu-container">
                        <button type="button" onClick={() => openPanel('edit', r)} title="Edit" className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer">
                          <SquarePen className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => openPanel('view', r)} title="View Details" className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setActiveMenuId(activeMenuId === r.id ? null : r.id)} title="More Options" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {activeMenuId === r.id && (
                          <div className="absolute right-0 top-8 z-30 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 text-left text-xs">
                            <button type="button" onClick={() => toggleStatus(r)} className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                              <Check className="w-3.5 h-3.5 text-slate-400" />
                              {isActive ? 'Mark Inactive' : 'Mark Active'}
                            </button>
                            <div className="h-px bg-slate-100 my-1" />
                            <button
                              type="button"
                              onClick={() => { setActiveMenuId(null); setDeleteError(''); setDeleteRow(r); }}
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

              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-slate-500 font-medium">Loading designs...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <p className="text-sm font-semibold text-slate-700">No designs found</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          {rows.length === 0 ? 'Click "+ Add New" to create your first design.' : 'No records match your search or filters. Try resetting filters.'}
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-600 bg-white pr-20 sm:pr-24">
          <div>Showing {from} to {to} of {filtered.length} entries</div>
          <div className="flex items-center gap-1">
            <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer" aria-label="Previous page">
              <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`w-7 h-7 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center ${
                  n === safePage ? 'bg-[#1e60f2] text-white shadow-2xs' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {n}
              </button>
            ))}
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer" aria-label="Next page">
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Slide 4: Add / Edit / View popup (same layout as Fabric Quality) ── */}
      {panelMode && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in-50 duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={`Design Master – ${crumbTail}`}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-[#f8fafc]/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1e60f2] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                    4
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                    Design Master – {readOnly ? 'View' : 'Add / Edit'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 mt-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <Layers className="w-4 h-4 text-[#1e60f2]" />
                  <span>Inventory</span>
                  <span className="text-slate-300 font-bold">&gt;</span>
                  <span>Design Master</span>
                  <span className="text-slate-300 font-bold">&gt;</span>
                  <span className="text-slate-800 font-semibold">{crumbTail}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closePanel}
                    disabled={saving}
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 text-xs shadow-2xs transition cursor-pointer"
                  >
                    {readOnly ? 'Close' : 'Cancel'}
                  </button>
                  {readOnly ? (
                    <button
                      type="button"
                      onClick={() => setPanelMode('edit')}
                      className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                    >
                      <SquarePen className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      form="design-master-form"
                      disabled={saving}
                      className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Saving...' : 'Save'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <form id="design-master-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs">
              {formError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ── Left column (inputs) ── */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Design Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={form.code}
                        disabled={readOnly}
                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                        placeholder="D-001"
                        className={`${inputClass} font-mono uppercase shadow-2xs`}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Design Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={form.name}
                        disabled={readOnly}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Floral Print"
                        className={`${inputClass} shadow-2xs`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Pattern Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.patternType}
                      disabled={readOnly}
                      onChange={(e) => setForm({ ...form, patternType: e.target.value })}
                      className={`${inputClass} shadow-2xs cursor-pointer`}
                    >
                      <option value="">Select pattern type</option>
                      {PATTERN_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Design Reference</label>
                      <input
                        value={form.reference}
                        disabled={readOnly}
                        onChange={(e) => setForm({ ...form, reference: e.target.value })}
                        placeholder="Buyer / mill reference no."
                        className={`${inputClass} shadow-2xs`}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Season / Collection</label>
                      <input
                        value={form.season}
                        disabled={readOnly}
                        list="design-season-options"
                        onChange={(e) => setForm({ ...form, season: e.target.value })}
                        placeholder="Summer 2025"
                        className={`${inputClass} shadow-2xs`}
                      />
                      <datalist id="design-season-options">
                        {SEASON_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                      </datalist>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={form.description}
                      disabled={readOnly}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Floral pattern print for women/children collection."
                      className={`${inputClass} shadow-2xs resize-none`}
                    />
                  </div>
                </div>

                {/* ── Right column (design image & status) ── */}
                <div className="lg:col-span-4 space-y-5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Design Image (Optional)</label>
                    <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 flex flex-col items-center">
                      <div className="w-full h-40 rounded-lg bg-slate-100 border border-slate-200/80 overflow-hidden flex items-center justify-center relative">
                        {imagePreview ? (
                          <img src={imagePreview} alt={form.name || 'Design'} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                            <ImageIcon className="w-10 h-10 stroke-1 mb-1 text-slate-300" />
                            <span className="text-[11px] text-slate-400 font-medium">No image uploaded</span>
                          </div>
                        )}
                      </div>

                      {!readOnly && (
                        <>
                          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickImage} className="hidden" />
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-4 py-1.5 bg-white hover:bg-slate-50 text-blue-600 font-semibold rounded-lg border border-blue-200 text-xs shadow-2xs transition cursor-pointer"
                            >
                              {imagePreview ? 'Change Image' : 'Upload Image'}
                            </button>
                            {imagePreview && (
                              <button
                                type="button"
                                onClick={removeImage}
                                title="Remove image"
                                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-2">Status</label>
                    <div className="flex items-center gap-6">
                      {[['Active', true], ['Inactive', false]].map(([label, value]) => (
                        <label key={label} className={`inline-flex items-center gap-2 font-medium text-slate-800 text-xs ${readOnly ? '' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name="design-status"
                            checked={form.isActive === value}
                            disabled={readOnly}
                            onChange={() => setForm({ ...form, isActive: value })}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteRow && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4" role="presentation" onMouseDown={() => setDeleteRow(null)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900">Delete {deleteRow.name}?</h2>
            <p className="text-xs text-slate-500 mt-1">This design will be removed from the list.</p>
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
    </div>
  );
}
