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
  Image as ImageIcon,
  Save,
  Info,
  Download,
  Upload,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Boxes,
  ShoppingCart,
  PackageCheck,
  TrendingUp,
  Tag,
  FileText,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { fabricMasterSync, isBackendEnabled, describeError } from '../../services/fabricMasterSync';
import { uploadFileToBackend } from '../../services/fileUploadService';
import PageInfoButton from '../../components/ui/PageInfoButton';

const PER_PAGE = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Masters are never read from browser storage; without a session the list is empty.
function readLocalCategories() {
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

function formatDisplayDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day} ${month} ${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}

const emptyCategoryForm = () => ({
  id: '',
  code: '',
  name: '',
  parentId: '',
  description: '',
  imageUrl: '',
  isActive: true,
});

export const CategoriesPage = () => {
  const backendOn = isBackendEnabled();
  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const [categories, setCategories] = useState(() => (backendOn ? [] : readLocalCategories()));
  const [loading, setLoading] = useState(backendOn);
  const [loadError, setLoadError] = useState('');

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [page, setPage] = useState(1);
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Modals & Active Views:
  // modalMode: 'create' | 'edit' | null
  const [modalMode, setModalMode] = useState(null);
  // viewCategory: selected category for Slide 5: View Details
  const [viewCategory, setViewCategory] = useState(null);
  // deactivatingCategory: selected category for Slide 6: Delete / Deactivate modal
  const [deactivatingCategory, setDeactivatingCategory] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);

  // Form State for Add / Edit
  const [form, setForm] = useState(emptyCategoryForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);

  // Load Categories from API
  const loadData = useCallback(async () => {
    if (!backendOn) {
      setCategories(readLocalCategories());
      return;
    }
    setLoading(true);
    try {
      const res = await fabricMasterSync.pull('categories');
      if (res === null) {
        setLoadError('Could not load categories from the server.');
      } else {
        setCategories(res || []);
        setLoadError('');
      }
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

  // Click outside to dismiss actions menu
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.action-menu-container')) setActiveMenuId(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const byId = (id) => categories.find((c) => String(c.id) === String(id)) || null;

  // Without a server session nothing can be saved; no local copy is kept.
  const updateLocalRows = () => {
    throw new Error('You are not signed in to the server — nothing was saved.');
  };

  // Filtered rows
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((c) => {
      if (statusFilter !== 'All') {
        const isActive = c.isActive !== false;
        if (statusFilter === 'Active' && !isActive) return false;
        if (statusFilter === 'Inactive' && isActive) return false;
      }
      if (!q) return true;
      const parentName = c.parentName || byId(c.parentId)?.name || '';
      return [c.code, c.name, c.description, parentName]
        .some((val) => String(val || '').toLowerCase().includes(q));
    });
  }, [categories, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
  const to = Math.min(safePage * PER_PAGE, filtered.length);

  // Form open handlers
  const openCreate = () => {
    setActiveMenuId(null);
    setForm(emptyCategoryForm());
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(false);
    setFormError('');
    setModalMode('create');
  };

  const openEdit = (row) => {
    setActiveMenuId(null);
    setForm({
      id: row.id,
      code: row.code || '',
      name: row.name || '',
      parentId: row.parentId || row.parent || '',
      description: row.description || '',
      imageUrl: row.imageUrl || '',
      isActive: row.isActive !== false,
    });
    setImageFile(null);
    setImagePreview(row.imageUrl || null);
    setImageRemoved(false);
    setFormError('');
    setModalMode('edit');
  };

  const openView = (row) => {
    setActiveMenuId(null);
    setViewCategory(row);
  };

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
    setForm((prev) => ({ ...prev, imageUrl: '' }));
  };

  // Submit Add / Edit Form
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!form.code.trim()) {
      setFormError('Category Code is required.');
      return;
    }
    if (!form.name.trim()) {
      setFormError('Category Name is required.');
      return;
    }

    setSaving(true);
    setFormError('');

    const clean = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      parentId: form.parentId || null,
      description: form.description.trim() || null,
      imageUrl: form.imageUrl || null,
      isActive: Boolean(form.isActive),
    };

    try {
      if (backendOn) {
        if (imageFile) {
          clean.imageFileId = await uploadFileToBackend(imageFile, imageFile.name, 'other');
        } else if (imageRemoved) {
          clean.imageFileId = null;
          clean.imageUrl = null;
        }

        if (modalMode === 'edit') {
          const updated = await fabricMasterSync.update('categories', form.id, clean);
          if (!updated) throw new Error('No response from the server.');
          setCategories((prev) => prev.map((c) => (c.id === form.id ? updated : c)));
          if (viewCategory?.id === form.id) setViewCategory(updated);
        } else {
          const created = await fabricMasterSync.create('categories', clean);
          if (!created) throw new Error('No response from the server.');
          setCategories((prev) => [created, ...prev]);
        }
      } else {
        const others = categories.filter((c) => c.id !== form.id);
        if (others.some((c) => String(c.code).toUpperCase() === clean.code)) {
          throw new Error(`Category Code ${clean.code} is already used.`);
        }
        let imageUrl = form.imageUrl || null;
        if (imageFile) imageUrl = await readAsDataUrl(imageFile);
        else if (imageRemoved) imageUrl = null;

        if (modalMode === 'edit') {
          const updated = {
            ...form,
            ...clean,
            imageUrl,
            updatedAt: new Date().toISOString(),
          };
          updateLocalRows((prev) => prev.map((c) => (c.id === form.id ? updated : c)));
          if (viewCategory?.id === form.id) setViewCategory(updated);
        } else {
          const created = {
            id: `cat-local-${Date.now()}`,
            ...clean,
            imageUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          updateLocalRows((prev) => [created, ...prev]);
        }
      }
      setSaving(false);
      setModalMode(null);
    } catch (err) {
      setFormError(describeError(err));
      setSaving(false);
    }
  };

  // Slide 6: Confirm Deactivate
  const handleConfirmDeactivate = async () => {
    if (!deactivatingCategory) return;
    try {
      if (backendOn) {
        const updated = await fabricMasterSync.update('categories', deactivatingCategory.id, {
          isActive: false,
        });
        if (updated) {
          setCategories((prev) => prev.map((c) => (c.id === deactivatingCategory.id ? updated : c)));
        }
      } else {
        updateLocalRows((prev) =>
          prev.map((c) => (c.id === deactivatingCategory.id ? { ...c, isActive: false } : c))
        );
      }
      if (viewCategory?.id === deactivatingCategory.id) {
        setViewCategory((prev) => ({ ...prev, isActive: false }));
      }
      setDeactivatingCategory(null);
    } catch (err) {
      setLoadError(`Could not deactivate category: ${describeError(err)}`);
    }
  };

  // Direct toggle status
  const handleToggleStatus = async (row) => {
    setActiveMenuId(null);
    const newStatus = row.isActive === false;
    try {
      if (backendOn) {
        const updated = await fabricMasterSync.update('categories', row.id, { isActive: newStatus });
        if (updated) setCategories((prev) => prev.map((c) => (c.id === row.id ? updated : c)));
      } else {
        updateLocalRows((prev) => prev.map((c) => (c.id === row.id ? { ...c, isActive: newStatus } : c)));
      }
    } catch (err) {
      setLoadError(`Could not update status: ${describeError(err)}`);
    }
  };

  // Export to CSV
  const handleExport = () => {
    if (categories.length === 0) return;
    const header = ['Category Code', 'Category Name', 'Parent Category', 'Description', 'Status'];
    const rowsData = categories.map((c) => [
      c.code || '',
      c.name || '',
      c.parentName || byId(c.parentId)?.name || '—',
      c.description || '',
      c.isActive !== false ? 'Active' : 'Inactive',
    ]);
    const csvContent = [header, ...rowsData].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `fabric_categories_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import from CSV
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length <= 1) return;
        // Parse CSV lines
        const importedRows = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
          if (cols[0] && cols[1]) {
            importedRows.push({
              code: cols[0].toUpperCase(),
              name: cols[1],
              description: cols[3] || '',
              isActive: cols[4]?.toLowerCase() !== 'inactive',
            });
          }
        }
        for (const item of importedRows) {
          if (backendOn) {
            await fabricMasterSync.create('categories', item);
          } else {
            updateLocalRows((prev) => [{ id: `cat-${Date.now()}-${Math.random()}`, ...item }, ...prev]);
          }
        }
        loadData();
      } catch (err) {
        setLoadError('Failed to import categories.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full space-y-4">
      {/* ── Slide 2: Header Block (Blue Badge 2 + Title + Breadcrumbs) ── */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#1e60f2] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
          2
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
          Fabric Categories – List
        </h1>
        <PageInfoButton title="Fabric Categories" />
      </div>

      {/* Sub-bar: Breadcrumb Left & Actions Right */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Layers className="w-4 h-4 text-[#1e60f2]" />
          <span>Categories</span>
          <span className="text-slate-300 font-bold">&gt;</span>
          <span className="text-slate-800 font-semibold">Fabric Categories</span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Search Box */}
          <div className="relative min-w-[240px] sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search category code, name, parent, description..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
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

          {/* + Add New Button */}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New</span>
          </button>

          {/* Import Button */}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer"
            title="Import from CSV"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import</span>
          </button>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer"
            title="Export to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      {showFilterBar && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          {(statusFilter !== 'All' || search) && (
            <button
              type="button"
              onClick={() => { setStatusFilter('All'); setSearch(''); }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold px-2 py-1.5 hover:bg-slate-200 rounded transition ml-auto cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          <span>{loadError}</span>
          <button type="button" onClick={loadData} className="font-semibold underline ml-3 cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* ── Slide 2: Fabric Categories Table (Exact 7 Columns) ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[780px]">
            <thead>
              <tr className="border-b border-slate-200 bg-[#f8fafc] text-slate-700 font-semibold text-xs">
                <th className="px-3.5 py-3.5 w-12 text-center text-slate-500 font-medium">#</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Category Code</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Category Name</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Parent Category</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Description</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800 text-center">Status</th>
                <th className="px-4 py-3.5 font-semibold text-slate-800 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((r, idx) => {
                const isActive = r.isActive !== false;
                const parentObj = byId(r.parentId || r.parent);
                const parentLabel = r.parentName || parentObj?.name || '-';

                return (
                  <tr key={r.id} className="transition hover:bg-slate-50/70">
                    {/* # */}
                    <td className="px-3.5 py-3.5 text-center text-slate-500 font-medium">
                      {(safePage - 1) * PER_PAGE + idx + 1}
                    </td>

                    {/* Category Code */}
                    <td className="px-3.5 py-3.5 font-semibold text-slate-900 tracking-tight whitespace-nowrap font-mono">
                      {r.code || '—'}
                    </td>

                    {/* Category Name */}
                    <td className="px-3.5 py-3.5 font-medium text-slate-800">
                      {r.name}
                    </td>

                    {/* Parent Category */}
                    <td className="px-3.5 py-3.5 text-slate-600">
                      {parentLabel}
                    </td>

                    {/* Description */}
                    <td className="px-3.5 py-3.5 text-slate-600 max-w-xs truncate" title={r.description}>
                      {r.description || '—'}
                    </td>

                    {/* Status Pill Badge */}
                    <td className="px-3.5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                          isActive
                            ? 'bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0]'
                            : 'bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions: Edit, Eye, More */}
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
                          onClick={() => openView(r)}
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
                        {activeMenuId === r.id && (
                          <div className="absolute right-0 top-8 z-30 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 text-left text-xs animate-in fade-in-50 duration-150">
                            <button
                              type="button"
                              onClick={() => openView(r)}
                              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" /> View Details
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                            >
                              <SquarePen className="w-3.5 h-3.5 text-slate-400" /> Edit Category
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(r)}
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
                                setDeactivatingCategory(r);
                              }}
                              className="w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-semibold"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Deactivate
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
                  <td colSpan={7} className="px-4 py-12 text-center">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-slate-500 font-medium">Loading fabric categories...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <p className="text-sm font-semibold text-slate-700">No fabric categories found</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          {categories.length === 0
                            ? 'Click "+ Add New" to create your first fabric category classification.'
                            : 'No categories match your search or filter criteria. Try resetting filters.'}
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Slide 2: Pagination Footer ── */}
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

      {/* ── Slide 3 & 4: Add / Edit Modal Popup (Matching Slides 3 & 4 Exactly) ── */}
      {modalMode && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in-50 duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-[#f8fafc]/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1e60f2] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                    {modalMode === 'edit' ? 4 : 3}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                    Fabric Category – {modalMode === 'edit' ? 'Edit' : 'Add New'}
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

              {/* Breadcrumb Left & Action Buttons Right */}
              <div className="flex items-center justify-between gap-3 mt-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <Layers className="w-4 h-4 text-[#1e60f2]" />
                  <span>Categories</span>
                  <span className="text-slate-300 font-bold">&gt;</span>
                  <span>Fabric Categories</span>
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
                    className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : modalMode === 'edit' ? 'Update' : 'Save'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ── Left Column (Inputs) ── */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Row 1: Category Code * | Category Name * */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Category Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                        placeholder="CAT-001"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 font-mono uppercase shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Category Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Cotton"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Row 2: Parent Category */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Parent Category
                    </label>
                    <select
                      value={form.parentId}
                      onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs cursor-pointer"
                    >
                      <option value="">-- None --</option>
                      {categories
                        .filter((c) => c.id !== form.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code ? `${c.code} – ${c.name}` : c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Row 3: Description */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={4}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="All cotton fabrics including different weaves and counts."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs resize-none"
                    />
                  </div>

                  {/* Row 4: Status Radio Buttons */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-2">Status</label>
                    <div className="flex items-center gap-6">
                      <label className="inline-flex items-center gap-2 font-medium text-slate-800 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="category-status"
                          checked={form.isActive}
                          onChange={() => setForm({ ...form, isActive: true })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Active</span>
                      </label>

                      <label className="inline-flex items-center gap-2 font-medium text-slate-800 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="category-status"
                          checked={!form.isActive}
                          onChange={() => setForm({ ...form, isActive: false })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Inactive</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* ── Right Column (Category Image) ── */}
                <div className="lg:col-span-4 space-y-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      Category Image <span className="font-normal text-slate-400">(Optional)</span>
                    </label>
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col items-center">
                      <div className="w-full h-44 rounded-lg bg-slate-100 border border-slate-200/80 overflow-hidden flex items-center justify-center relative">
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt="Category Preview"
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
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={pickImage}
                        className="hidden"
                      />

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
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Info Banner */}
              <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center gap-2.5 text-blue-700">
                <Info className="w-4 h-4 shrink-0 text-blue-600" />
                <span className="text-xs font-medium">
                  {modalMode === 'edit'
                    ? 'Used in fabric items and purchase orders. Category will classify fabrics in purchase, inventory, QC, sales and reports.'
                    : 'Category will be used to classify fabrics in purchase, inventory, QC, sales and reports.'}
                </span>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Slide 5: View Details Modal (Matching Slide 5 Exactly) ── */}
      {viewCategory && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in-50 duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-[#f8fafc]/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1e60f2] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                    5
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                    Fabric Category – View Details
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setViewCategory(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-bar: Breadcrumb Left & Actions Right */}
              <div className="flex items-center justify-between gap-3 mt-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <Layers className="w-4 h-4 text-[#1e60f2]" />
                  <span>Categories</span>
                  <span className="text-slate-300 font-bold">&gt;</span>
                  <span>Fabric Categories</span>
                  <span className="text-slate-300 font-bold">&gt;</span>
                  <span className="text-slate-800 font-semibold">Details</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const row = viewCategory;
                      setViewCategory(null);
                      openEdit(row);
                    }}
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <SquarePen className="w-3.5 h-3.5 text-slate-600" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewCategory(null)}
                    className="px-4 py-2 bg-[#1e60f2] hover:bg-[#1550d0] text-white font-semibold rounded-lg text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Back to List</span>
                  </button>
                </div>
              </div>
            </div>

            {/* View Details Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ── Left Card: Basic Information ── */}
                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3.5">
                  <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                    Basic Information
                  </h3>

                  <div className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-12">
                      <span className="col-span-5 font-semibold text-slate-500">Category Code</span>
                      <span className="col-span-1 text-slate-400">:</span>
                      <span className="col-span-6 font-mono font-bold text-slate-900">
                        {viewCategory.code || '—'}
                      </span>
                    </div>

                    <div className="grid grid-cols-12">
                      <span className="col-span-5 font-semibold text-slate-500">Category Name</span>
                      <span className="col-span-1 text-slate-400">:</span>
                      <span className="col-span-6 font-medium text-slate-900">
                        {viewCategory.name || '—'}
                      </span>
                    </div>

                    <div className="grid grid-cols-12">
                      <span className="col-span-5 font-semibold text-slate-500">Parent Category</span>
                      <span className="col-span-1 text-slate-400">:</span>
                      <span className="col-span-6 text-slate-700">
                        {viewCategory.parentName || byId(viewCategory.parentId)?.name || '-'}
                      </span>
                    </div>

                    <div className="grid grid-cols-12">
                      <span className="col-span-5 font-semibold text-slate-500">Description</span>
                      <span className="col-span-1 text-slate-400">:</span>
                      <span className="col-span-6 text-slate-700 leading-relaxed">
                        {viewCategory.description || '—'}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-center pt-1">
                      <span className="col-span-5 font-semibold text-slate-500">Status</span>
                      <span className="col-span-1 text-slate-400">:</span>
                      <span className="col-span-6">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                            viewCategory.isActive !== false
                              ? 'bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0]'
                              : 'bg-[#fef2f2] text-[#ef4444] border border-[#fecaca]'
                          }`}
                        >
                          {viewCategory.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </span>
                    </div>

                    <div className="h-px bg-slate-100 my-2" />

                    <div className="grid grid-cols-12">
                      <span className="col-span-5 font-semibold text-slate-500">Created By</span>
                      <span className="col-span-1 text-slate-400">:</span>
                      <span className="col-span-6 text-slate-700">
                        {viewCategory.createdBy || 'Admin'}
                      </span>
                    </div>

                    <div className="grid grid-cols-12">
                      <span className="col-span-5 font-semibold text-slate-500">Created Date</span>
                      <span className="col-span-1 text-slate-400">:</span>
                      <span className="col-span-6 text-slate-700">
                        {formatDisplayDate(viewCategory.createdAt || viewCategory.created_at)}
                      </span>
                    </div>

                    <div className="grid grid-cols-12">
                      <span className="col-span-5 font-semibold text-slate-500">Updated By</span>
                      <span className="col-span-1 text-slate-400">:</span>
                      <span className="col-span-6 text-slate-700">
                        {viewCategory.updatedBy || 'Admin'}
                      </span>
                    </div>

                    <div className="grid grid-cols-12">
                      <span className="col-span-5 font-semibold text-slate-500">Updated Date</span>
                      <span className="col-span-1 text-slate-400">:</span>
                      <span className="col-span-6 text-slate-700">
                        {formatDisplayDate(viewCategory.updatedAt || viewCategory.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Right Cards: Category Image & Usage Information ── */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Category Image Card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                    <h3 className="font-bold text-slate-900 text-xs mb-2.5">
                      Category Image
                    </h3>
                    <div className="w-full h-40 rounded-lg bg-slate-100 border border-slate-200/80 overflow-hidden flex items-center justify-center">
                      {viewCategory.imageUrl ? (
                        <img
                          src={viewCategory.imageUrl}
                          alt={viewCategory.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                          <ImageIcon className="w-10 h-10 stroke-1 mb-1 text-slate-300" />
                          <span className="text-[11px] text-slate-400 font-medium">No image available</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Usage Information Card (6 Stat Tiles) */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
                    <h3 className="font-bold text-slate-900 text-xs mb-3">
                      Usage Information
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Metric 1: Total Fabric Items */}
                      <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e60f2] flex items-center justify-center shrink-0">
                          <Boxes className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-medium">Total Fabric Items</p>
                          <p className="text-sm font-bold text-slate-900">
                            {viewCategory.usage?.fabricItems || viewCategory.itemCount || 0}
                          </p>
                        </div>
                      </div>

                      {/* Metric 2: Total Purchase Orders */}
                      <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                          <ShoppingCart className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-medium">Total Purchase Orders</p>
                          <p className="text-sm font-bold text-slate-900">
                            {viewCategory.usage?.purchaseOrders || 0}
                          </p>
                        </div>
                      </div>

                      {/* Metric 3: Total GRN */}
                      <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <PackageCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-medium">Total GRN</p>
                          <p className="text-sm font-bold text-slate-900">
                            {viewCategory.usage?.grn || 0}
                          </p>
                        </div>
                      </div>

                      {/* Metric 4: Total Stock Quantity */}
                      <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-medium">Total Stock Quantity</p>
                          <p className="text-sm font-bold text-slate-900">
                            {viewCategory.usage?.stockQty ? `${viewCategory.usage.stockQty} Mtr` : '0 Mtr'}
                          </p>
                        </div>
                      </div>

                      {/* Metric 5: Total Sales Orders */}
                      <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-medium">Total Sales Orders</p>
                          <p className="text-sm font-bold text-slate-900">
                            {viewCategory.usage?.salesOrders || 0}
                          </p>
                        </div>
                      </div>

                      {/* Metric 6: Total Samples */}
                      <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-medium">Total Samples</p>
                          <p className="text-sm font-bold text-slate-900">
                            {viewCategory.usage?.samples || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Slide 6: Delete / Deactivate Modal (Matching Slide 6 Exactly) ── */}
      {deactivatingCategory && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in-50 duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 text-center relative animate-in zoom-in-95 duration-150">
            {/* Close X */}
            <button
              type="button"
              onClick={() => setDeactivatingCategory(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Red / Orange Circular Warning Icon */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white flex items-center justify-center font-bold text-3xl mx-auto mb-4 shadow-md">
              !
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              &lsquo;Deactivate Fabric Category?&rsquo;
            </h3>

            {/* Body */}
            <p className="text-xs text-slate-600 mt-2.5 px-3 leading-relaxed">
              Category <span className="font-semibold text-slate-800">&lsquo;{deactivatingCategory.code} - {deactivatingCategory.name}&rsquo;</span> will be marked as inactive. It will not be available for new transactions, but existing data will remain unaffected.
            </p>

            {/* Buttons */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeactivatingCategory(null)}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 text-xs shadow-2xs transition cursor-pointer min-w-[100px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                className="px-5 py-2.5 bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold rounded-lg text-xs shadow-sm transition cursor-pointer min-w-[100px]"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;
