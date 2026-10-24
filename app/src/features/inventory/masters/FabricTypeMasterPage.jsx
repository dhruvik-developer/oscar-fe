import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Eye,
  SquarePen,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Check,
  Layers,
  Image as ImageIcon,
  Save,
  Upload,
  Download,
  Info,
} from 'lucide-react';

import { fabricMasterSync, isBackendEnabled, describeError } from '../../../services/fabricMasterSync';
import { uploadFileToBackend } from '../../../services/fileUploadService';
import PageInfoButton from '../../../components/ui/PageInfoButton';

// Fabric Type / Classification — list (slide 7) plus an Add / Edit / View
// popup (slide 8). Logged in → rows live in Postgres (/inventory/fabric-types/)
// and the image goes through the two-step file upload. No session →
// nothing (no browser copy is kept).

const PER_PAGE = 10;
const PROCESS_STAGES = ['Grey', 'Dyed', 'Printed', 'Finished'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const CSV_HEADER = ['Type Code', 'Type Name', 'Process Stage', 'Description', 'Status'];
const BOM = String.fromCharCode(0xfeff);
const BOM_RE = new RegExp(`^${BOM}`);

const STAGE_BADGE = {
  Grey: 'bg-slate-100 text-slate-600 border-slate-200',
  Dyed: 'bg-rose-50 text-rose-600 border-rose-200',
  Printed: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  Finished: 'bg-emerald-50 text-emerald-600 border-emerald-200',
};

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

// Quote-aware CSV parse, so a description with a comma survives a round trip.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

const matchStage = (value) => PROCESS_STAGES.find((s) => s.toLowerCase() === String(value || '').trim().toLowerCase());

const emptyForm = () => ({
  code: '',
  name: '',
  processStage: '',
  description: '',
  isActive: true,
});

const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 disabled:bg-slate-50 disabled:text-slate-600';

function StageBadge({ stage }) {
  if (!stage) return <span className="text-slate-400">—</span>;
  return (
    <span className={`inline-flex items-center justify-center min-w-[72px] px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${STAGE_BADGE[stage] || STAGE_BADGE.Grey}`}>
      {stage}
    </span>
  );
}

export default function FabricTypeMasterPage() {
  const backendOn = isBackendEnabled();
  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  const [rows, setRows] = useState(() => (backendOn ? [] : readLocal()));
  const [loading, setLoading] = useState(backendOn);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [importing, setImporting] = useState(false);

  const [search, setSearch] = useState('');
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
    const result = await fabricMasterSync.pull('fabricTypes');
    if (result === null) setLoadError('Could not load fabric types from the server.');
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
  }, [search]);

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

  const sorted = useMemo(
    () => [...rows].sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true })),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((r) => [r.code, r.name, r.processStage, r.description, r.isActive === false ? 'inactive' : 'active']
      .some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [sorted, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1;
  const to = Math.min(safePage * PER_PAGE, filtered.length);

  // ── Popup ─────────────────────────────────────────────────────────
  const openPanel = (mode, row = null) => {
    setActiveMenuId(null);
    setEditingRow(row);
    setForm(row
      ? {
          code: row.code || '',
          name: row.name || '',
          processStage: row.processStage || '',
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
    if (!form.code.trim()) return setFormError('Type Code is required.');
    if (!form.name.trim()) return setFormError('Type Name is required.');
    if (!form.processStage) return setFormError('Process Stage is required.');

    const clean = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      processStage: form.processStage,
      description: form.description.trim() || null,
      isActive: Boolean(form.isActive),
    };

    setSaving(true);
    setFormError('');
    try {
      if (backendOn) {
        if (imageFile) clean.imageFileId = await uploadFileToBackend(imageFile, imageFile.name, 'other');
        else if (imageRemoved) { clean.imageFileId = null; clean.imageUrl = null; }
        const saved = editingRow
          ? await fabricMasterSync.update('fabricTypes', editingRow.id, clean)
          : await fabricMasterSync.create('fabricTypes', clean);
        if (!saved) throw new Error('No response from the server.');
        setRows((prev) => (editingRow ? prev.map((r) => (r.id === editingRow.id ? saved : r)) : [saved, ...prev]));
      } else {
        let imageUrl = editingRow?.imageUrl || null;
        if (imageFile) imageUrl = await readAsDataUrl(imageFile);
        else if (imageRemoved) imageUrl = null;
        const others = rows.filter((r) => r.id !== editingRow?.id);
        if (others.some((r) => String(r.code).toUpperCase() === clean.code)) throw new Error(`Code ${clean.code} is already used.`);
        if (others.some((r) => String(r.name).toLowerCase() === clean.name.toLowerCase())) throw new Error('This fabric type already exists.');
        if (editingRow) {
          updateLocalRows((prev) => prev.map((r) => (r.id === editingRow.id ? { ...r, ...clean, imageUrl } : r)));
        } else {
          updateLocalRows((prev) => [{ id: `fabricTypes-local-${Date.now()}`, ...clean, imageUrl }, ...prev]);
        }
      }
      setSaving(false);
      setPanelMode(null);
      setNotice(`Fabric type ${clean.code} ${editingRow ? 'updated' : 'added'}.`);
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
        const updated = await fabricMasterSync.update('fabricTypes', row.id, { isActive });
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
        await fabricMasterSync.remove('fabricTypes', deleteRow.id);
        setRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
      } else {
        updateLocalRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
      }
      setNotice(`Fabric type ${deleteRow.code} deleted.`);
      setDeleteRow(null);
    } catch (err) {
      setDeleteError(describeError(err));
    }
  };

  // ── Export / Import (CSV, same columns both ways) ─────────────────
  const handleExport = () => {
    const data = filtered.length ? filtered : sorted;
    const lines = [CSV_HEADER, ...data.map((r) => [
      r.code || '',
      r.name || '',
      r.processStage || '',
      r.description || '',
      r.isActive !== false ? 'Active' : 'Inactive',
    ])];
    const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fabric_types_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => setLoadError('Could not read the import file.');
    reader.onload = async (evt) => {
      const parsed = parseCsv(String(evt.target.result || '').replace(BOM_RE, ''));
      if (parsed.length <= 1) {
        setLoadError(`The file has no rows. Use the columns: ${CSV_HEADER.join(', ')}.`);
        return;
      }
      setImporting(true);
      setLoadError('');
      const failures = [];
      let added = 0;
      if (!backendOn) { setImporting(false); setLoadError('You are not signed in to the server — nothing was saved.'); return; }
      let local = null;
      for (let i = 1; i < parsed.length; i++) {
        const [code, name, stage, description, status] = parsed[i];
        const lineNo = i + 1;
        if (!code || !name) { failures.push(`Row ${lineNo}: code and name are required`); continue; }
        const processStage = matchStage(stage) || (stage ? null : 'Grey');
        if (!processStage) { failures.push(`Row ${lineNo}: unknown process stage "${stage}"`); continue; }
        const item = {
          code: code.toUpperCase(),
          name,
          processStage,
          description: description || null,
          isActive: String(status || '').toLowerCase() !== 'inactive',
        };
        try {
          if (backendOn) {
            await fabricMasterSync.create('fabricTypes', item);
          } else {
            if (local.some((r) => String(r.code).toUpperCase() === item.code)) throw new Error(`Code ${item.code} is already used.`);
            local = [{ id: `fabricTypes-local-${Date.now()}-${i}`, ...item, imageUrl: null }, ...local];
          }
          added += 1;
        } catch (err) {
          failures.push(`Row ${lineNo} (${item.code}): ${describeError(err)}`);
        }
      }
      await loadData();
      setImporting(false);
      setNotice(`Imported ${added} fabric type${added === 1 ? '' : 's'}.`);
      if (failures.length) setLoadError(`${failures.length} row(s) skipped — ${failures.slice(0, 3).join('; ')}${failures.length > 3 ? '…' : ''}`);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const readOnly = panelMode === 'view';
  const crumbTail = panelMode === 'create' ? 'Add New' : panelMode === 'edit' ? 'Edit' : 'View';

  return (
    <div className="w-full space-y-4">
      {/* ── Slide 7 header ── */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#1e60f2] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
          7
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">Fabric Type / Classification – List</h1>
        <PageInfoButton title="Fabric Type Master" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Layers className="w-4 h-4 text-[#1e60f2]" />
          <span>Categories</span>
          <span className="text-slate-300 font-bold">&gt;</span>
          <span className="text-slate-800 font-semibold">Fabric Type / Classification</span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="relative min-w-[240px] sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search type code, name, process stage..."
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
            onClick={() => openPanel('create')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New</span>
          </button>

          <input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={handleImport} className="hidden" />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            title={`CSV columns: ${CSV_HEADER.join(', ')}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{importing ? 'Importing...' : 'Import'}</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-700">{notice}</div>
      )}

      {loadError && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          <span>{loadError}</span>
          <div className="flex items-center gap-3 ml-3 shrink-0">
            {backendOn && <button type="button" onClick={loadData} className="font-semibold underline">Retry</button>}
            <button type="button" onClick={() => setLoadError('')} aria-label="Dismiss"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200 bg-[#f8fafc] text-slate-700 font-semibold text-xs">
                <th className="px-3.5 py-3.5 w-12 text-center text-slate-500 font-medium">#</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Type Code</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Type Name</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800 text-center">Process Stage</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Description</th>
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
                    <td className="px-3.5 py-2.5 text-center"><StageBadge stage={r.processStage} /></td>
                    <td className="px-3.5 py-2.5 text-slate-700 max-w-[260px] truncate" title={r.description || ''}>{r.description || '—'}</td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold tracking-wide border ${
                          isActive ? 'bg-[#ecfdf5] text-[#10b981] border-[#a7f3d0]' : 'bg-rose-50 text-rose-600 border-rose-200'
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
                  <td colSpan={7} className="px-4 py-12 text-center">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-slate-500 font-medium">Loading fabric types...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <p className="text-sm font-semibold text-slate-700">No fabric types found</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          {rows.length === 0 ? 'Click "+ Add New" or Import to create your first fabric type.' : 'No records match your search.'}
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

      {/* ── Slide 8: Add / Edit / View popup ── */}
      {panelMode && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in-50 duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={`Fabric Type – ${crumbTail}`}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-[#f8fafc]/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1e60f2] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                    8
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                    Fabric Type – {readOnly ? 'View' : 'Add / Edit'}
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
                  <span>Categories</span>
                  <span className="text-slate-300 font-bold">&gt;</span>
                  <span>Fabric Type / Classification</span>
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
                      form="fabric-type-form"
                      disabled={saving}
                      className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                      {editingRow ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{saving ? 'Saving...' : 'Save'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <form id="fabric-type-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs">
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
                        Type Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={form.code}
                        disabled={readOnly}
                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                        placeholder="T-001"
                        className={`${inputClass} uppercase shadow-2xs`}
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Type Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={form.name}
                        disabled={readOnly}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Grey Fabric"
                        className={`${inputClass} shadow-2xs`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Process Stage <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.processStage}
                      disabled={readOnly}
                      onChange={(e) => setForm({ ...form, processStage: e.target.value })}
                      className={`${inputClass} shadow-2xs cursor-pointer`}
                    >
                      <option value="">Select process stage</option>
                      {PROCESS_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={form.description}
                      disabled={readOnly}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Unprocessed fabric received from supplier."
                      className={`${inputClass} shadow-2xs resize-y`}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-2">Status</label>
                    <div className="flex items-center gap-10">
                      {[['Active', true], ['Inactive', false]].map(([label, value]) => (
                        <label key={label} className={`inline-flex items-center gap-2 font-medium text-slate-800 text-xs ${readOnly ? '' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name="fabric-type-status"
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

                {/* ── Right column (type image) ── */}
                <div className="lg:col-span-4">
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Type Image <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 flex flex-col items-center">
                    <div className="w-full h-40 rounded-lg bg-slate-100 border border-slate-200/80 overflow-hidden flex items-center justify-center">
                      {imagePreview ? (
                        <img src={imagePreview} alt={form.name || 'Fabric type'} className="w-full h-full object-cover" />
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
                        <div className="mt-3 flex items-center gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 px-4 py-1.5 bg-white hover:bg-slate-50 text-blue-600 font-semibold rounded-lg border border-blue-200 text-xs shadow-2xs transition cursor-pointer"
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
              </div>

              <div className="mt-5 flex items-start gap-2.5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-xs leading-relaxed">
                  Process stage helps to identify fabric condition: Grey, Dyed, Printed, Finished etc.
                  <br />
                  This type will be used in fabric item/variant, GRN, QC and reports.
                </p>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteRow && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4" role="presentation" onMouseDown={() => setDeleteRow(null)}>
          <div onMouseDown={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900">Delete {deleteRow.name}?</h2>
            <p className="text-xs text-slate-500 mt-1">This fabric type will be removed from the list.</p>
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
