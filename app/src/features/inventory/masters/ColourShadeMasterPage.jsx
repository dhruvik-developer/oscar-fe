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
  Copy,
} from 'lucide-react';

import { fabricMasterSync, isBackendEnabled, describeError } from '../../../services/fabricMasterSync';
import PageInfoButton from '../../../components/ui/PageInfoButton';

const PER_PAGE = 10;

// ── Colour Conversion Utilities ──
function hexToRgb(hex) {
  if (!hex) return null;
  let clean = String(hex).replace(/^#/, '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v || 0)));
  const toHex = (v) => clamp(v).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsb(r, g, b) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : Math.round((delta / max) * 100);
  const v = Math.round(max * 100);

  return { h, s, b: v };
}

function hsbToRgb(h, s, b) {
  const hNorm = ((h % 360) + 360) % 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const bNorm = Math.max(0, Math.min(100, b)) / 100;

  const c = bNorm * sNorm;
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
  const m = bNorm - c;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hNorm >= 0 && hNorm < 60) {
    rPrime = c; gPrime = x; bPrime = 0;
  } else if (hNorm >= 60 && hNorm < 120) {
    rPrime = x; gPrime = c; bPrime = 0;
  } else if (hNorm >= 120 && hNorm < 180) {
    rPrime = 0; gPrime = c; bPrime = x;
  } else if (hNorm >= 180 && hNorm < 240) {
    rPrime = 0; gPrime = x; bPrime = c;
  } else if (hNorm >= 240 && hNorm < 300) {
    rPrime = x; gPrime = 0; bPrime = c;
  } else {
    rPrime = c; gPrime = 0; bPrime = x;
  }

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  };
}

const DEFAULT_ROW1_PRESETS = [
  '#EF4444', '#F97316', '#FBBF24', '#84CC16', '#22C55E', '#14B8A6', '#3B82F6', '#102A43', '#0F172A', '#8B5CF6', '#EC4899',
];

const DEFAULT_ROW2_PRESETS = [
  '#FCE7F3', '#FED7AA', '#78350F', '#6B7280', '#D1D5DB', '#FFFFFF', '#000000',
];

// ── Interactive Colour Picker Component (Matching Slide 6 Exactly) ──
function ColourPickerCard({ value, onChange }) {
  const currentHex = (value || '#102A43').toUpperCase();
  const initialRgb = hexToRgb(currentHex) || { r: 16, g: 42, b: 67 };
  const initialHsb = rgbToHsb(initialRgb.r, initialRgb.g, initialRgb.b);

  const [rgb, setRgb] = useState(initialRgb);
  const [hsb, setHsb] = useState(initialHsb);
  const [hexInput, setHexInput] = useState(currentHex);
  const [copied, setCopied] = useState(false);
  const [customPresets, setCustomPresets] = useState(DEFAULT_ROW2_PRESETS);

  const isDraggingRef = useRef(false);
  const gradientRef = useRef(null);
  const hueSliderRef = useRef(null);

  // Synchronize when value changes externally (and not actively dragging)
  useEffect(() => {
    if (isDraggingRef.current) return;
    const clean = (value || '#102A43').toUpperCase();
    setHexInput(clean);
    const rgbVal = hexToRgb(clean);
    if (rgbVal) {
      setRgb(rgbVal);
      setHsb(rgbToHsb(rgbVal.r, rgbVal.g, rgbVal.b));
    }
  }, [value]);

  const updateFromHsb = (newHsb) => {
    const clampedHsb = {
      h: Math.max(0, Math.min(360, Math.round(newHsb.h))),
      s: Math.max(0, Math.min(100, Math.round(newHsb.s))),
      b: Math.max(0, Math.min(100, Math.round(newHsb.b))),
    };
    const newRgb = hsbToRgb(clampedHsb.h, clampedHsb.s, clampedHsb.b);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHsb(clampedHsb);
    setRgb(newRgb);
    setHexInput(newHex);
    onChange(newHex);
  };

  const updateFromRgb = (newRgb) => {
    const clampedRgb = {
      r: Math.max(0, Math.min(255, Math.round(newRgb.r ?? 0))),
      g: Math.max(0, Math.min(255, Math.round(newRgb.g ?? 0))),
      b: Math.max(0, Math.min(255, Math.round(newRgb.b ?? 0))),
    };
    const newHsb = rgbToHsb(clampedRgb.r, clampedRgb.g, clampedRgb.b);
    const newHex = rgbToHex(clampedRgb.r, clampedRgb.g, clampedRgb.b);
    setRgb(clampedRgb);
    setHsb(newHsb);
    setHexInput(newHex);
    onChange(newHex);
  };

  // Drag on 2D gradient box (Hue x Brightness)
  const handleGradientMove = (e) => {
    if (!gradientRef.current) return;
    const rect = gradientRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const h = Math.round((x / rect.width) * 360);
    const b = Math.round((1 - y / rect.height) * 100);
    const s = hsb.s === 0 ? 76 : hsb.s;

    updateFromHsb({ h, s, b });
  };

  const onGradientPointerDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    handleGradientMove(e);

    const onPointerMove = (moveEvt) => {
      moveEvt.preventDefault();
      handleGradientMove(moveEvt);
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Drag on vertical Hue slider
  const handleHueMove = (e) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const h = Math.round((y / rect.height) * 360);
    const s = hsb.s === 0 ? 76 : hsb.s;
    const b = hsb.b === 0 ? 26 : hsb.b;

    updateFromHsb({ h, s, b });
  };

  const onHuePointerDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    handleHueMove(e);

    const onPointerMove = (moveEvt) => {
      moveEvt.preventDefault();
      handleHueMove(moveEvt);
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Hex input change & blur
  const handleHexInputChange = (e) => {
    const val = e.target.value;
    setHexInput(val);
    const parsed = hexToRgb(val);
    if (parsed) {
      const newHex = val.startsWith('#') ? val.toUpperCase() : `#${val.toUpperCase()}`;
      const newHsb = rgbToHsb(parsed.r, parsed.g, parsed.b);
      setRgb(parsed);
      setHsb(newHsb);
      onChange(newHex);
    }
  };

  const handleHexBlur = () => {
    const parsed = hexToRgb(hexInput);
    if (parsed) {
      const formatted = rgbToHex(parsed.r, parsed.g, parsed.b);
      setHexInput(formatted);
      onChange(formatted);
    } else {
      setHexInput(value || '#102A43');
    }
  };

  // Clipboard copy
  const handleCopyHex = async () => {
    try {
      await navigator.clipboard.writeText(value || '#102A43');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  // Preset palette click
  const handleSelectPreset = (hex) => {
    const clean = hex.toUpperCase();
    const rgbVal = hexToRgb(clean);
    if (rgbVal) {
      setRgb(rgbVal);
      setHsb(rgbToHsb(rgbVal.r, rgbVal.g, rgbVal.b));
      setHexInput(clean);
      onChange(clean);
    }
  };

  // Add current color to custom presets
  const handleAddPreset = () => {
    const cur = (value || '#102A43').toUpperCase();
    if (!DEFAULT_ROW1_PRESETS.includes(cur) && !customPresets.includes(cur)) {
      setCustomPresets((prev) => [...prev, cur]);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl p-3.5 sm:p-4 bg-white shadow-2xs">
      <div className="font-semibold text-slate-800 text-xs sm:text-sm mb-3">
        Colour Picker <span className="font-normal text-slate-400 text-xs">(Optional)</span>
      </div>

      {/* Top 3-part picker row: [2D Area] [Hue Slider] [Preview + Inputs] */}
      <div className="flex items-stretch gap-2.5 sm:gap-3">
        {/* 2D Gradient Box */}
        <div
          ref={gradientRef}
          onPointerDown={onGradientPointerDown}
          className="relative flex-1 min-w-[140px] h-36 sm:h-40 rounded-lg overflow-hidden cursor-crosshair select-none shadow-inner border border-slate-200/80"
          style={{
            background: `
              linear-gradient(to bottom, rgba(255,255,255,0.2) 0%, transparent 25%, rgba(0,0,0,0.92) 100%),
              linear-gradient(to right, #ef4444 0%, #f59e0b 17%, #84cc16 33%, #06b6d4 50%, #3b82f6 67%, #ec4899 83%, #ef4444 100%)
            `,
          }}
        >
          {/* Circular Ring Cursor */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none transition-[left,top] duration-75"
            style={{
              left: `${Math.max(0, Math.min(100, (hsb.h / 360) * 100))}%`,
              top: `${Math.max(0, Math.min(100, (1 - hsb.b / 100) * 100))}%`,
            }}
          />
        </div>

        {/* Vertical Rainbow Hue Slider */}
        <div
          ref={hueSliderRef}
          onPointerDown={onHuePointerDown}
          className="relative w-3.5 sm:w-4 h-36 sm:h-40 rounded-full cursor-pointer select-none shadow-inner border border-slate-200/80 shrink-0"
          style={{
            background:
              'linear-gradient(to bottom, #ef4444 0%, #f59e0b 17%, #84cc16 33%, #06b6d4 50%, #3b82f6 67%, #ec4899 83%, #ef4444 100%)',
          }}
        >
          {/* Thumb circle on slider */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-md pointer-events-none transition-[top] duration-75"
            style={{
              top: `${Math.max(0, Math.min(100, (hsb.h / 360) * 100))}%`,
              backgroundColor: value || '#102A43',
            }}
          />
        </div>

        {/* Right Controls Column */}
        <div className="w-32 sm:w-36 flex flex-col justify-between shrink-0 space-y-2">
          {/* Current Selected Color Preview Box */}
          <div
            className="w-full h-11 sm:h-12 rounded-lg border border-slate-200/80 shadow-2xs transition-colors"
            style={{ backgroundColor: value || '#102A43' }}
          />

          {/* Hex input box with copy button */}
          <div className="flex items-center justify-between border border-slate-200 rounded-lg px-2 py-1 bg-white shadow-2xs focus-within:border-blue-500">
            <input
              type="text"
              value={hexInput}
              onChange={handleHexInputChange}
              onBlur={handleHexBlur}
              maxLength={7}
              placeholder="#102A43"
              className="w-20 font-mono text-xs font-semibold text-slate-800 uppercase focus:outline-none tracking-tight"
            />
            <button
              type="button"
              onClick={handleCopyHex}
              title={copied ? 'Copied!' : 'Copy Hex'}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* RGB Inputs */}
          <div>
            <div className="grid grid-cols-3 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
              <span>R</span>
              <span>G</span>
              <span>B</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <input
                type="number"
                min={0}
                max={255}
                value={rgb.r}
                onChange={(e) => updateFromRgb({ ...rgb, r: Number(e.target.value) })}
                className="w-full text-center py-1 px-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-800 shadow-2xs focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                min={0}
                max={255}
                value={rgb.g}
                onChange={(e) => updateFromRgb({ ...rgb, g: Number(e.target.value) })}
                className="w-full text-center py-1 px-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-800 shadow-2xs focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                min={0}
                max={255}
                value={rgb.b}
                onChange={(e) => updateFromRgb({ ...rgb, b: Number(e.target.value) })}
                className="w-full text-center py-1 px-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-800 shadow-2xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* HSB Inputs */}
          <div>
            <div className="grid grid-cols-3 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
              <span>H</span>
              <span>S</span>
              <span>B</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <input
                type="number"
                min={0}
                max={360}
                value={hsb.h}
                onChange={(e) => updateFromHsb({ ...hsb, h: Number(e.target.value) })}
                className="w-full text-center py-1 px-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-800 shadow-2xs focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={hsb.s}
                onChange={(e) => updateFromHsb({ ...hsb, s: Number(e.target.value) })}
                className="w-full text-center py-1 px-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-800 shadow-2xs focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={hsb.b}
                onChange={(e) => updateFromHsb({ ...hsb, b: Number(e.target.value) })}
                className="w-full text-center py-1 px-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-800 shadow-2xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preset Colours */}
      <div className="mt-3 pt-2.5 border-t border-slate-100">
        <div className="text-[11px] font-semibold text-slate-700 mb-1.5">Preset Colours</div>
        {/* Row 1 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {DEFAULT_ROW1_PRESETS.map((hex) => {
            const isSelected = (value || '').toUpperCase() === hex.toUpperCase();
            return (
              <button
                key={hex}
                type="button"
                onClick={() => handleSelectPreset(hex)}
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded transition transform hover:scale-110 cursor-pointer shadow-2xs relative ${
                  isSelected ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : 'border border-slate-200/60'
                }`}
                style={{ backgroundColor: hex }}
                title={hex}
              />
            );
          })}
        </div>

        {/* Row 2 */}
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          {customPresets.map((hex, idx) => {
            const isSelected = (value || '').toUpperCase() === hex.toUpperCase();
            return (
              <button
                key={`${hex}-${idx}`}
                type="button"
                onClick={() => handleSelectPreset(hex)}
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded transition transform hover:scale-110 cursor-pointer shadow-2xs relative ${
                  isSelected ? 'ring-2 ring-blue-500 ring-offset-1 z-10' : 'border border-slate-200/60'
                }`}
                style={{ backgroundColor: hex }}
                title={hex}
              />
            );
          })}
          {/* Custom + add button */}
          <button
            type="button"
            onClick={handleAddPreset}
            title="Add current colour to presets"
            className="w-5 h-5 sm:w-6 sm:h-6 rounded border border-dashed border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer shadow-2xs"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Masters are never read from browser storage; without a session the list is empty.
function readLocalShades() {
  return [];
}

const emptyForm = () => ({
  id: '',
  name: '',
  code: '',
  colourType: 'Solid',
  pantoneReference: '',
  description: '',
  imageUrl: '',
  hexColor: '#102A43',
  isActive: true,
});

export default function ColourShadeMasterPage() {
  const backendOn = isBackendEnabled();
  const fileInputRef = useRef(null);

  const [rows, setRows] = useState(() => (backendOn ? [] : readLocalShades()));
  const [loading, setLoading] = useState(backendOn);
  const [loadError, setLoadError] = useState('');

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
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
      setRows(readLocalShades());
      return;
    }

    setLoading(true);
    try {
      const shadesRes = await fabricMasterSync.pull('shades');
      if (shadesRes === null) {
        setLoadError('Could not load shades from server.');
      } else {
        setRows(shadesRes || []);
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
  }, [search, statusFilter, typeFilter]);

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
      if (typeFilter !== 'All') {
        const type = r.colourType || 'Solid';
        if (type.toLowerCase() !== typeFilter.toLowerCase()) return false;
      }
      if (!q) return true;

      const code = String(r.code || '').toLowerCase();
      const name = String(r.name || '').toLowerCase();
      const type = String(r.colourType || '').toLowerCase();
      const ref = String(r.pantoneReference || '').toLowerCase();

      return code.includes(q) || name.includes(q) || type.includes(q) || ref.includes(q);
    });
  }, [rows, search, statusFilter, typeFilter]);

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
      colourType: row.colourType || 'Solid',
      pantoneReference: row.pantoneReference || '',
      description: row.description || '',
      imageUrl: row.imageUrl || '',
      hexColor: row.hexColor || '#102A43',
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
      setFormError('Colour Name is required.');
      return;
    }

    if (!form.code.trim()) {
      setFormError('Shade Code is required.');
      return;
    }

    setSaving(true);
    setFormError('');

    const clean = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      colourType: form.colourType || 'Solid',
      pantoneReference: form.pantoneReference.trim() || null,
      description: form.description.trim() || null,
      imageUrl: form.imageUrl || null,
      hexColor: form.hexColor || null,
      isActive: Boolean(form.isActive),
    };

    try {
      if (backendOn) {
        if (modalMode === 'edit') {
          const updated = await fabricMasterSync.update('shades', form.id, clean);
          if (!updated) throw new Error('No response from the server.');
          setRows((prev) => prev.map((r) => (r.id === form.id ? updated : r)));
        } else {
          const created = await fabricMasterSync.create('shades', clean);
          if (!created) throw new Error('No response from the server.');
          setRows((prev) => [created, ...prev]);
        }
      } else {
        if (modalMode === 'edit') {
          updateLocalRows((prev) => prev.map((r) => (r.id === form.id ? { ...r, ...clean } : r)));
        } else {
          const newRow = {
            id: `shade-${Date.now()}`,
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
        await fabricMasterSync.remove('shades', deleteRow.id);
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
        const updated = await fabricMasterSync.update('shades', row.id, { isActive: newStatus });
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
      {/* ── Slide 5 Header: 5 Colour / Shade Master – List ── */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#1e60f2] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
          5
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
          Colour / Shade Master – List
        </h1>
        <PageInfoButton title="Colour / Shade Master" />
      </div>

      {/* ── Sub-header: Breadcrumb & Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Breadcrumb: Inventory > Colour / Shade Master */}
        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
          <Layers className="w-4 h-4 text-[#1e60f2]" />
          <span>Inventory</span>
          <span className="text-slate-300 font-bold">&gt;</span>
          <span className="text-slate-800 font-semibold">Colour / Shade Master</span>
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
              placeholder="Search shade code, colour name..."
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
              showFilterBar || statusFilter !== 'All' || typeFilter !== 'All'
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
        <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
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

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Colour Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Types</option>
              <option value="Solid">Solid</option>
              <option value="Melange">Melange</option>
              <option value="Heather">Heather</option>
              <option value="Printed">Printed</option>
              <option value="Yarn Dyed">Yarn Dyed</option>
            </select>
          </div>

          {(statusFilter !== 'All' || typeFilter !== 'All' || search) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('All');
                setTypeFilter('All');
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

      {/* ── Slide 5 Table: 8 Exact Columns ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 bg-[#f8fafc] text-slate-700 font-semibold text-xs">
                <th className="px-3.5 py-3.5 w-12 text-center text-slate-500 font-medium">#</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Shade Code</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Colour Name</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Colour Type</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800">Pantone / Reference</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800 text-center">Colour Image</th>
                <th className="px-3.5 py-3.5 font-semibold text-slate-800 text-center">Status</th>
                <th className="px-4 py-3.5 font-semibold text-slate-800 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((r, idx) => {
                const serialNum = (safePage - 1) * PER_PAGE + idx + 1;
                const isActive = r.isActive !== false;
                const swatchBg = r.hexColor || '#0A192F';

                return (
                  <tr key={r.id} className="transition hover:bg-slate-50/70">
                    {/* # */}
                    <td className="px-3.5 py-3.5 text-center text-slate-500 font-medium">{serialNum}</td>

                    {/* Shade Code */}
                    <td className="px-3.5 py-3.5 font-semibold text-slate-900 tracking-tight whitespace-nowrap">
                      {r.code || '—'}
                    </td>

                    {/* Colour Name */}
                    <td className="px-3.5 py-3.5 font-medium text-slate-800">{r.name}</td>

                    {/* Colour Type */}
                    <td className="px-3.5 py-3.5 text-slate-700">{r.colourType || 'Solid'}</td>

                    {/* Pantone / Reference */}
                    <td className="px-3.5 py-3.5 text-slate-600 font-mono text-[11px]">
                      {r.pantoneReference || '—'}
                    </td>

                    {/* Colour Image / Swatch box (Matching Slide 5) */}
                    <td className="px-3.5 py-3.5 text-center">
                      <div className="inline-flex items-center justify-center">
                        {r.imageUrl ? (
                          <div className="w-12 h-6 rounded border border-slate-300 overflow-hidden shadow-2xs">
                            <img src={r.imageUrl} alt={r.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div
                            className="w-12 h-6 rounded border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: swatchBg }}
                            title={`Swatch: ${swatchBg}`}
                          />
                        )}
                      </div>
                    </td>

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
                  <td colSpan={8} className="px-4 py-12 text-center">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-slate-500 font-medium">Loading colour / shades...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <p className="text-sm font-semibold text-slate-700">No colour / shade records found</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          {rows.length === 0
                            ? 'Click "+ Add New" to create your first colour / shade master record.'
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

      {/* ── Slide 6: Add / Edit Modal Popup (Matching Slide 6 Exactly) ── */}
      {modalMode && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in-50 duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Slide 6 Top Header Block */}
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-[#f8fafc]/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1e60f2] text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                    6
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
                    Colour / Shade Master – {modalMode === 'edit' ? 'Edit' : 'Add / Edit'}
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
                  <span>Colour / Shade Master</span>
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

            {/* Slide 6 Form Body (2-Column Grid) */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 text-xs">
              {formError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium text-xs">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* ── Left Column (Inputs) ── */}
                <div className="space-y-4">
                  {/* Row 1: Shade Code * | Colour Name * */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Shade Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                        placeholder="SH-001"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 font-mono uppercase shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Colour Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Navy Blue"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Row 2: Colour Type * */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Colour Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.colourType}
                      onChange={(e) => setForm({ ...form, colourType: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs cursor-pointer"
                    >
                      <option value="Solid">Solid</option>
                      <option value="Melange">Melange</option>
                      <option value="Heather">Heather</option>
                      <option value="Printed">Printed</option>
                      <option value="Yarn Dyed">Yarn Dyed</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Row 3: Pantone / Reference */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Pantone / Reference
                    </label>
                    <input
                      type="text"
                      value={form.pantoneReference}
                      onChange={(e) => setForm({ ...form, pantoneReference: e.target.value })}
                      placeholder="PMS 296 C"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs"
                    />
                  </div>

                  {/* Row 4: Description */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={4}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Standard navy blue shade."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 shadow-2xs resize-none"
                    />
                  </div>

                  {/* Hidden file input for image support */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                  {form.imageUrl && (
                    <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <img src={form.imageUrl} alt="Attached" className="w-8 h-8 rounded object-cover border border-slate-300" />
                      <span className="text-slate-600 text-[11px] font-medium flex-1 truncate">Image reference attached</span>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, imageUrl: '' }))}
                        className="text-rose-500 hover:text-rose-700 text-xs font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Right Column (Colour Picker & Status) ── */}
                <div className="space-y-4">
                  {/* Colour Picker (Optional) Card */}
                  <ColourPickerCard
                    value={form.hexColor || '#102A43'}
                    onChange={(hex) => setForm((prev) => ({ ...prev, hexColor: hex }))}
                  />

                  {/* Status Radio Group */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-2">Status</label>
                    <div className="flex items-center gap-6">
                      <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-800 text-xs">
                        <input
                          type="radio"
                          name="shadeStatusRadio"
                          checked={form.isActive}
                          onChange={() => setForm({ ...form, isActive: true })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Active</span>
                      </label>

                      <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-800 text-xs">
                        <input
                          type="radio"
                          name="shadeStatusRadio"
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
                <div
                  className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center"
                  style={{ backgroundColor: viewRow.hexColor || '#0A192F' }}
                />
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
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Colour Type</span>
                  <span className="font-semibold text-slate-800">{viewRow.colourType || 'Solid'}</span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Pantone / Ref</span>
                  <span className="font-semibold text-slate-800">{viewRow.pantoneReference || '—'}</span>
                </div>

                {viewRow.hexColor && (
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Hex Swatch</span>
                    <span className="font-mono font-semibold text-slate-800 flex items-center gap-1.5">
                      <span
                        className="w-3.5 h-3.5 rounded border border-slate-200 shrink-0"
                        style={{ backgroundColor: viewRow.hexColor }}
                      />
                      {viewRow.hexColor}
                    </span>
                  </div>
                )}
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
                  Edit Shade
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
              This colour / shade record will be removed from your master catalogue.
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
