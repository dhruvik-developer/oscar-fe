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
} from 'lucide-react';

import { fabricMasterSync, isBackendEnabled, describeError } from '../../../services/fabricMasterSync';
import { uploadFileToBackend } from '../../../services/fileUploadService';
import PageInfoButton from '../../../components/ui/PageInfoButton';
import MasterSourceLink from '../../../components/common/MasterSourceLink';

const PER_PAGE = 10;
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

const slug = (text) => String(text || '').trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase();

const emptyForm = () => ({
  qualityId: '',
  designId: '',
  shadeId: '',
  categoryId: '',
  fabricTypeId: '',
  code: '',
  name: '',
  uom: 'Meter',
  uomId: '',
  fabricType: '',
  construction: 'Plain',
  description: '',
  imageUrl: '',
  rate: '',
  isActive: true,
});

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 disabled:bg-slate-50 disabled:text-slate-600 shadow-2xs';

export default function FabricVariantMasterPage() {
  const backendOn = isBackendEnabled();
  const fileInputRef = useRef(null);

  const [rows, setRows] = useState(() => (backendOn ? [] : readLocal()));
  const [qualities, setQualities] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [shades, setShades] = useState([]);
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [fabricTypes, setFabricTypes] = useState([]);
  const [loading, setLoading] = useState(backendOn);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [qualityFilter, setQualityFilter] = useState('All');
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [page, setPage] = useState(1);
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Add / Edit / View modal mode: 'create' | 'edit' | 'view' | null
  const [panelMode, setPanelMode] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [codeTouched, setCodeTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [descTouched, setDescTouched] = useState(false);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  // Load backend / local data
  const loadData = useCallback(async () => {
    if (!backendOn) {
      setRows(readLocal());
      setQualities(readLocal('fabricMaster:fabricQualities'));
      setDesigns(readLocal('fabricMaster:designs'));
      setShades(readLocal('fabricMaster:shades'));
      setUnits(readLocal('fabricMaster:units'));
      return;
    }
    setLoading(true);
    const [variantRes, qualityRes, designRes, shadeRes, unitRes, categoryRes, fabricTypeRes] = await Promise.all([
      fabricMasterSync.pull('fabricVariants'),
      fabricMasterSync.pull('fabricQualities'),
      fabricMasterSync.pull('designs'),
      fabricMasterSync.pull('shades'),
      fabricMasterSync.pull('units'),
      fabricMasterSync.pull('categories'),
      fabricMasterSync.pull('fabricTypes'),
    ]);
    if (variantRes === null) {
      setLoadError('Could not load fabric items from the server.');
    } else {
      setRows(variantRes);
      setLoadError('');
    }
    setQualities(qualityRes || []);
    setDesigns(designRes || []);
    setShades(shadeRes || []);
    setUnits(unitRes || []);
    setCategories(categoryRes || []);
    setFabricTypes(fabricTypeRes || []);
    setLoading(false);
  }, [backendOn]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, qualityFilter]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.action-menu-container')) setActiveMenuId(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  useEffect(() => () => {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const byId = (list, id) => list.find((x) => String(x.id) === String(id)) || null;

  // Enhance offline / API rows with master codes and names
  const view = useCallback((r) => {
    const quality = byId(qualities, r.qualityId);
    const design = byId(designs, r.designId);
    const shade = byId(shades, r.shadeId);
    const unit = byId(units, r.uomId);
    const category = byId(categories, r.categoryId);
    const fabricTypeObj = byId(fabricTypes, r.fabricTypeId);
    return {
      ...r,
      qualityCode: r.qualityCode ?? quality?.code ?? null,
      qualityName: r.qualityName ?? quality?.name ?? '—',
      designCode: r.designCode ?? design?.code ?? null,
      designName: r.designName ?? design?.name ?? '—',
      shadeCode: r.shadeCode ?? shade?.code ?? null,
      shadeName: r.shadeName ?? shade?.name ?? '—',
      shadeHex: r.shadeHex ?? shade?.hexColor ?? null,
      categoryName: r.categoryName ?? category?.name ?? '—',
      categoryCode: r.categoryCode ?? category?.code ?? null,
      fabricTypeName: r.fabricTypeName ?? fabricTypeObj?.name ?? r.fabricType ?? '—',
      fabricTypeCode: r.fabricTypeCode ?? fabricTypeObj?.code ?? null,
      uom: r.uom ?? unit?.code ?? quality?.uom ?? 'Meter',
      fabricType: r.fabricType || fabricTypeObj?.name || quality?.fabricType || '',
      construction: r.construction || quality?.weave || 'Plain',
    };
  }, [qualities, designs, shades, units]);

  // Without a server session nothing can be saved; no local copy is kept.
  const updateLocalRows = () => {
    throw new Error('You are not signed in to the server — nothing was saved.');
  };

  const viewRows = useMemo(() => rows.map(view), [rows, view]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return viewRows.filter((r) => {
      if (statusFilter !== 'All' && (statusFilter === 'Active') !== (r.isActive !== false)) return false;
      if (qualityFilter !== 'All' && r.qualityId !== qualityFilter) return false;
      if (!q) return true;
      return [r.code, r.name, r.qualityCode, r.qualityName, r.designCode, r.designName, r.shadeCode, r.shadeName]
        .some((v) => String(v ?? '').toLowerCase().includes(q));
    });
  }, [viewRows, search, statusFilter, qualityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
  const to = Math.min(safePage * PER_PAGE, filtered.length);
  const filtersOn = statusFilter !== 'All' || qualityFilter !== 'All';

  // ── Auto-derive Item Code, Item Name, and Description from connected masters ──
  const suggest = (next) => {
    const q = byId(qualities, next.qualityId);
    const d = byId(designs, next.designId);
    const s = byId(shades, next.shadeId);

    const codeParts = [q?.code, d?.code, s?.code].filter(Boolean).map(slug);
    const nameParts = [q?.name, d?.name, s?.name].filter(Boolean);

    let desc = '';
    if (q) {
      desc = `${q.name} fabric${d ? ` with ${d.name}` : ''}${s ? ` in ${s.name} shade.` : '.'}`;
    }

    return {
      code: codeParts.join('-'),
      name: nameParts.join(' - '),
      description: desc,
      uom: q?.uom || next.uom || 'Meter',
      fabricType: q?.fabricTypeName || q?.fabricType || next.fabricType || '',
      fabricTypeId: q?.fabricTypeId || next.fabricTypeId || '',
      construction: q?.weave || next.construction || 'Plain',
    };
  };

  const setPart = (key, value) => {
    setFormError('');
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      const s = suggest(next);
      if (!codeTouched && s.code) next.code = s.code;
      if (!nameTouched && s.name) next.name = s.name;
      if (!descTouched && s.description) next.description = s.description;
      if (key === 'qualityId') {
        if (s.uom) next.uom = s.uom;
        if (s.fabricType) next.fabricType = s.fabricType;
        if (s.fabricTypeId) next.fabricTypeId = s.fabricTypeId;
        if (s.construction) next.construction = s.construction;
        if (!next.categoryId && categories.length > 0) {
          const defaultCat = categories.find((c) => c.code === 'CAT-FABRIC' || c.name.toLowerCase().includes('grey')) || categories[0];
          if (defaultCat) next.categoryId = defaultCat.id;
        }
      }
      return next;
    });
  };

  // ── Modal Handlers ──
  const openPanel = (mode, row = null) => {
    setActiveMenuId(null);
    setEditingRow(row);
    const defaultCat = categories.find((c) => c.code === 'CAT-FABRIC' || c.name.toLowerCase().includes('grey')) || categories[0];
    setForm(row
      ? {
          qualityId: row.qualityId || '',
          designId: row.designId || '',
          shadeId: row.shadeId || '',
          categoryId: row.categoryId || defaultCat?.id || '',
          fabricTypeId: row.fabricTypeId || '',
          code: row.code || '',
          name: row.name || '',
          uom: row.uom || 'Meter',
          uomId: row.uomId || '',
          fabricType: row.fabricType || '',
          construction: row.construction || 'Plain',
          rate: row.rate !== undefined && row.rate !== null ? row.rate : '',
          description: row.description || '',
          imageUrl: row.imageUrl || '',
          isActive: row.isActive !== false,
        }
      : {
          ...emptyForm(),
          categoryId: defaultCat?.id || '',
        });
    setCodeTouched(Boolean(row));
    setNameTouched(Boolean(row));
    setDescTouched(Boolean(row));
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
    setForm((prev) => ({ ...prev, imageUrl: '' }));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (saving) return;
    if (!form.code.trim()) return setFormError('Item Code is required.');
    if (!form.name.trim()) return setFormError('Item Name is required.');
    if (!form.qualityId) return setFormError('Fabric Quality is required.');

    const clean = {
      qualityId: form.qualityId,
      designId: form.designId || null,
      shadeId: form.shadeId || null,
      categoryId: form.categoryId || null,
      fabricTypeId: form.fabricTypeId || null,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      uom: form.uom || 'Meter',
      uomId: form.uomId || null,
      fabricType: form.fabricType || null,
      construction: form.construction || 'Plain',
      rate: form.rate !== '' && form.rate !== null && form.rate !== undefined ? Number(form.rate) : null,
      description: form.description?.trim() || null,
      imageUrl: form.imageUrl || null,
      isActive: Boolean(form.isActive),
    };

    setSaving(true);
    setFormError('');
    try {
      if (backendOn) {
        if (imageFile) clean.imageFileId = await uploadFileToBackend(imageFile, imageFile.name, 'other');
        else if (imageRemoved) {
          clean.imageFileId = null;
          clean.imageUrl = null;
        }
        const saved = editingRow
          ? await fabricMasterSync.update('fabricVariants', editingRow.id, clean)
          : await fabricMasterSync.create('fabricVariants', clean);
        if (!saved) throw new Error('No response from the server.');
        setRows((prev) => (editingRow ? prev.map((r) => (r.id === editingRow.id ? saved : r)) : [saved, ...prev]));
      } else {
        const others = rows.filter((r) => r.id !== editingRow?.id);
        if (others.some((r) => String(r.code).toUpperCase() === clean.code)) {
          throw new Error(`Code ${clean.code} is already used.`);
        }
        let imageUrl = editingRow?.imageUrl || null;
        if (imageFile) imageUrl = await readAsDataUrl(imageFile);
        else if (imageRemoved) imageUrl = null;
        if (editingRow) {
          updateLocalRows((prev) => prev.map((r) => (r.id === editingRow.id ? { ...r, ...clean, imageUrl } : r)));
        } else {
          updateLocalRows((prev) => [{ id: `fabricVariants-local-${Date.now()}`, ...clean, imageUrl }, ...prev]);
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
        const updated = await fabricMasterSync.update('fabricVariants', row.id, { isActive });
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
        await fabricMasterSync.remove('fabricVariants', deleteRow.id);
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
  const crumbTail = panelMode === 'create' ? 'Add New' : editingRow?.code || 'Edit';
  const options = (list, currentId) => list.filter((x) => x.isActive !== false || String(x.id) === String(currentId));

  // Resolved display image for preview
  const displayImage =
    imagePreview ||
    form.imageUrl ||
    byId(shades, form.shadeId)?.imageUrl ||
    byId(designs, form.designId)?.imageUrl ||
    byId(qualities, form.qualityId)?.imageUrl;

  return (
    <div className="w-full space-y-4">
      {/* ── Slide 3: Header Block (Red Badge 3 + Title + Breadcrumbs) ── */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#dc2626] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
          3
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
          Fabric Item / Variant Master – List
        </h1>
        <PageInfoButton title="Fabric Variant Master" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Layers className="w-4 h-4 text-[#1e60f2]" />
          <span>Inventory</span>
          <span className="text-slate-300 font-bold">&gt;</span>
          <span className="text-slate-800 font-semibold">Fabric Item / Variant Master</span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="relative min-w-[260px] sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item code, name, quality, design, shade..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Quality:</span>
            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Qualities</option>
              {qualities.map((q) => (
                <option key={q.id} value={q.id}>{q.code ? `${q.code} (${q.name})` : q.name}</option>
              ))}
            </select>
          </div>
          {(filtersOn || search) && (
            <button
              type="button"
              onClick={() => { setStatusFilter('All'); setQualityFilter('All'); setSearch(''); }}
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

      {/* ── Slide 3: Exact 9 Columns Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-200 bg-[#f8fafc] text-slate-700 font-semibold text-xs">
                <th className="px-3.5 py-3.5 w-12 text-center text-slate-500 font-medium">#</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Item Code</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Item Name</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Quality</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Category</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Type</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Design</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Shade</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">UOM</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800 text-center">Status</th>
                <th className="px-4 py-3.5 font-semibold text-slate-800 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((r, idx) => {
                const isActive = r.isActive !== false;
                return (
                  <tr key={r.id} className="transition hover:bg-slate-50/70">
                    <td className="px-3.5 py-3.5 text-center text-slate-500 font-medium">
                      {(safePage - 1) * PER_PAGE + idx + 1}
                    </td>
                    <td className="px-3.5 py-3.5 font-semibold text-slate-900 tracking-tight whitespace-nowrap font-mono">
                      {r.code || '—'}
                    </td>
                    <td className="px-3.5 py-3.5 font-medium text-slate-800">
                      {r.name}
                    </td>
                    <td className="px-3.5 py-3.5 text-slate-700">
                      {r.qualityCode || r.qualityName || '—'}
                    </td>
                    <td className="px-3.5 py-3.5 text-slate-700">
                      {r.categoryName || '—'}
                    </td>
                    <td className="px-3.5 py-3.5 text-slate-700">
                      {r.fabricTypeName || r.fabricType || '—'}
                    </td>
                    <td className="px-3.5 py-3.5 text-slate-700">
                      {r.designCode || r.designName || '—'}
                    </td>
                    <td className="px-3.5 py-3.5 text-slate-700">
                      {r.shadeCode || r.shadeName || '—'}
                    </td>
                    <td className="px-3.5 py-3.5 text-slate-700">
                      {r.uom || 'Meter'}
                    </td>
                    <td className="px-3.5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                          isActive ? 'bg-[#ecfdf5] text-[#10b981] border border-[#a7f3d0]' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="relative inline-flex items-center gap-1.5 action-menu-container">
                        <button
                          type="button"
                          onClick={() => openPanel('edit', r)}
                          title="Edit"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        >
                          <SquarePen className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openPanel('view', r)}
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
                          <div className="absolute right-0 top-8 z-30 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 text-left text-xs animate-in fade-in-50 duration-150">
                            <button
                              type="button"
                              onClick={() => openPanel('view', r)}
                              className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" /> View
                            </button>
                            <button
                              type="button"
                              onClick={() => openPanel('edit', r)}
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
                  <td colSpan={9} className="px-4 py-12 text-center">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-slate-500 font-medium">Loading fabric items...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <p className="text-sm font-semibold text-slate-700">No fabric items found</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          {rows.length === 0
                            ? 'Click "+ Add New" to create your first fabric item / variant.'
                            : 'No records match your search or filter criteria. Try resetting filters.'}
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Slide 3: Pagination Footer ── */}
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

      {/* ── Slide 4: Add / Edit / View Modal Popup (Matching Slide 4 Exactly) ── */}
      {panelMode && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in-50 duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Slide 4 Header Block (Red Badge 4 + Title + Sub-bar) */}
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-[#f8fafc]/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#dc2626] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                    4
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                    Fabric Item / Variant Master – {readOnly ? 'View' : 'Add / Edit'}
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

              {/* Breadcrumb Left & Action Buttons Right */}
              <div className="flex items-center justify-between gap-3 mt-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <Layers className="w-4 h-4 text-[#1e60f2]" />
                  <span>Inventory</span>
                  <span className="text-slate-300 font-bold">&gt;</span>
                  <span>Fabric Item / Variant Master</span>
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
                      className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                    >
                      <SquarePen className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      form="fabric-variant-form"
                      disabled={saving}
                      className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{saving ? 'Saving...' : 'Save'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Slide 4 Form Body (2-Column Grid) */}
            <form id="fabric-variant-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs">
              {formError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ── Left Column (Inputs) ── */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Row 1: Item Code * | Item Name * */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Item Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={form.code}
                        disabled={readOnly}
                        onChange={(e) => { setCodeTouched(true); setForm({ ...form, code: e.target.value.toUpperCase() }); }}
                        placeholder="COT-60S-D001-SH001"
                        className={`${inputClass} font-mono uppercase`}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Item Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={form.name}
                        disabled={readOnly}
                        onChange={(e) => { setNameTouched(true); setForm({ ...form, name: e.target.value }); }}
                        placeholder="Cotton 60s - Floral - Navy"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Row 2: Category | Fabric Type / Classification */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">Category</label>
                        <MasterSourceLink source="categories" />
                      </div>
                      <select
                        value={form.categoryId || ''}
                        disabled={readOnly}
                        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                        className={`${inputClass} cursor-pointer`}
                      >
                        <option value="">Select fabric category</option>
                        {categories.filter((c) => c.isActive !== false).map((c) => (
                          <option key={c.id} value={c.id}>{c.name} {c.code ? `(${c.code})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">Fabric Type / Classification</label>
                        <MasterSourceLink source="fabricTypes" />
                      </div>
                      <select
                        value={form.fabricTypeId || ''}
                        disabled={readOnly}
                        onChange={(e) => {
                          const val = e.target.value;
                          const matched = fabricTypes.find((t) => t.id === val);
                          setForm({
                            ...form,
                            fabricTypeId: val,
                            fabricType: matched?.name || form.fabricType,
                          });
                        }}
                        className={`${inputClass} cursor-pointer`}
                      >
                        <option value="">Select fabric type</option>
                        {fabricTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.processStage ? `(${t.processStage})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Fabric Quality * | Design */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">
                          Fabric Quality <span className="text-rose-500">*</span>
                        </label>
                        <MasterSourceLink source="fabricQualities" />
                      </div>
                      <select
                        value={form.qualityId}
                        disabled={readOnly}
                        onChange={(e) => setPart('qualityId', e.target.value)}
                        className={`${inputClass} cursor-pointer`}
                      >
                        <option value="">Select fabric quality</option>
                        {options(qualities, form.qualityId).map((q) => (
                          <option key={q.id} value={q.id}>{q.code ? `${q.code} (${q.name})` : q.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">
                          Design <span className="text-slate-400 font-normal">(Optional for Grey)</span>
                        </label>
                        <MasterSourceLink source="designs" />
                      </div>
                      <select
                        value={form.designId}
                        disabled={readOnly}
                        onChange={(e) => setPart('designId', e.target.value)}
                        className={`${inputClass} cursor-pointer`}
                      >
                        <option value="">Plain / None</option>
                        {options(designs, form.designId).map((d) => (
                          <option key={d.id} value={d.id}>{d.code ? `${d.code} (${d.name})` : d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Shade | UOM * */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">
                          Shade <span className="text-slate-400 font-normal">(Optional for Grey)</span>
                        </label>
                        <MasterSourceLink source="shades" />
                      </div>
                      <select
                        value={form.shadeId}
                        disabled={readOnly}
                        onChange={(e) => setPart('shadeId', e.target.value)}
                        className={`${inputClass} cursor-pointer`}
                      >
                        <option value="">Natural Grey / None</option>
                        {options(shades, form.shadeId).map((s) => (
                          <option key={s.id} value={s.id}>{s.code ? `${s.code} (${s.name})` : s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">
                          UOM <span className="text-rose-500">*</span>
                        </label>
                        <MasterSourceLink source="uom" />
                      </div>
                      <select
                        value={form.uom}
                        disabled={readOnly}
                        onChange={(e) => {
                          const val = e.target.value;
                          const uObj = units.find((u) => (u.label || u.code) === val);
                          setForm({ ...form, uom: val, uomId: uObj?.id || form.uomId });
                        }}
                        className={`${inputClass} cursor-pointer`}
                      >
                        <option value="">Select UOM</option>
                        {form.uom && !units.some((u) => u.isActive !== false && (u.label === form.uom || u.code === form.uom)) && (
                          <option value={form.uom}>{form.uom}</option>
                        )}
                        {units
                          .filter((u) => u.isActive !== false)
                          .map((u) => (
                            <option key={u.id} value={u.label || u.code}>{u.label || u.code}{u.uomType ? ` (${u.uomType})` : ''}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 5: Construction | Standard Rate */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Construction</label>
                      <select
                        value={form.construction}
                        disabled={readOnly}
                        onChange={(e) => setForm({ ...form, construction: e.target.value })}
                        className={`${inputClass} cursor-pointer`}
                      >
                        <option value="Plain">Plain</option>
                        <option value="Twill">Twill</option>
                        <option value="Satin">Satin</option>
                        <option value="Dobby">Dobby</option>
                        <option value="Jacquard">Jacquard</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Standard Rate (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.rate}
                        disabled={readOnly}
                        onChange={(e) => setForm({ ...form, rate: e.target.value })}
                        placeholder="e.g. 50.00"
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                  </div>

                  {/* Row 5: Description */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={form.description}
                      disabled={readOnly}
                      onChange={(e) => { setDescTouched(true); setForm({ ...form, description: e.target.value }); }}
                      placeholder="Cotton 60s fabric with floral print in navy blue shade."
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                </div>

                {/* ── Right Column (Fabric Image & Status) ── */}
                <div className="lg:col-span-4 space-y-5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">Fabric Image (Optional)</label>
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col items-center">
                      <div className="w-full h-44 rounded-lg bg-slate-100 border border-slate-200/80 overflow-hidden flex items-center justify-center relative">
                        {displayImage ? (
                          <img src={displayImage} alt={form.name || 'Fabric item'} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                            <ImageIcon className="w-10 h-10 stroke-1 mb-1 text-slate-300" />
                            <span className="text-[11px] text-slate-400 font-medium">No image uploaded</span>
                          </div>
                        )}
                      </div>

                      {!readOnly && (
                        <>
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
                              {displayImage ? 'Change Image' : 'Upload Image'}
                            </button>
                            {displayImage && (
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

                  {/* Status Radio Group */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-2">Status</label>
                    <div className="flex items-center gap-6">
                      <label className={`inline-flex items-center gap-2 font-medium text-slate-800 text-xs ${readOnly ? '' : 'cursor-pointer'}`}>
                        <input
                          type="radio"
                          name="variant-status"
                          checked={form.isActive}
                          disabled={readOnly}
                          onChange={() => setForm({ ...form, isActive: true })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Active</span>
                      </label>

                      <label className={`inline-flex items-center gap-2 font-medium text-slate-800 text-xs ${readOnly ? '' : 'cursor-pointer'}`}>
                        <input
                          type="radio"
                          name="variant-status"
                          checked={!form.isActive}
                          disabled={readOnly}
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

      {/* Delete Confirmation Modal */}
      {deleteRow && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4"
          role="presentation"
          onMouseDown={() => setDeleteRow(null)}
        >
          <div onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900">Delete {deleteRow.name}?</h2>
            <p className="text-xs text-slate-500 mt-1">This fabric item will be removed from the list.</p>
            {deleteError && <p className="text-[11px] font-semibold text-rose-600 mt-2">{deleteError}</p>}
            <div className="flex items-center justify-end gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => setDeleteRow(null)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition"
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
