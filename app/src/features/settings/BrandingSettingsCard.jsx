import React, { useEffect, useRef, useState } from 'react';
import { Palette, ImagePlus, Check, RotateCcw, Wand2, Trash2, Infinity as InfinityIcon } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import {
  readFileAsDataUrl,
  normalizeLogo,
  extractDominantColor,
  buildBrandPalette,
  isValidHex,
} from '../../utils/branding';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Settings → General → Branding. Upload a company logo; its main colour is
 * detected and becomes the app theme colour (can be overridden by hand).
 */
export default function BrandingSettingsCard({ isAdmin }) {
  const branding = useAppStore((s) => s.branding);
  const setBranding = useAppStore((s) => s.setBranding);
  const resetBranding = useAppStore((s) => s.resetBranding);
  const showToast = useAppStore((s) => s.showToast);

  const [logo, setLogo] = useState(branding?.logo || '');
  const [color, setColor] = useState(branding?.color || '');
  const [detectedColor, setDetectedColor] = useState('');
  const [name, setName] = useState(branding?.name || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setLogo(branding?.logo || '');
    setColor(branding?.color || '');
    setName(branding?.name || '');
  }, [branding]);

  const palette = isValidHex(color) ? buildBrandPalette(color) : null;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!ACCEPTED.includes(file.type)) {
      setError('Please upload a PNG, JPG, WebP or SVG image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Logo must be 2 MB or smaller.');
      return;
    }
    setBusy(true);
    try {
      const raw = await readFileAsDataUrl(file);
      const small = await normalizeLogo(raw);
      const found = await extractDominantColor(small);
      setLogo(small);
      setDetectedColor(found);
      if (found) setColor(found);
      else setError('No clear colour found in this logo — pick a theme colour below.');
    } catch (err) {
      setError(err?.message || 'Could not read this image.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoColor() {
    if (!logo) return;
    const found = detectedColor || (await extractDominantColor(logo).catch(() => ''));
    setDetectedColor(found);
    if (found) setColor(found);
  }

  function handleSave() {
    if (color && !isValidHex(color)) {
      setError('Theme colour must be a hex value like #1e6cfb.');
      return;
    }
    setBranding({ logo, color, name: name.trim() });
    setError('');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    showToast?.('Branding updated');
  }

  function handleReset() {
    resetBranding();
    setDetectedColor('');
    setError('');
    showToast?.('Branding reset to default');
  }

  const swatchColors = palette
    ? [palette['--primary'], palette['--primary-dark'], palette['--brand-accent'], palette['--sidebar-bg-from']]
    : [];

  return (
    <div className="bg-white border border-[#CED4DA] rounded-lg p-5">
      <div className="flex items-center gap-2 pb-3 border-b border-[#CED4DA] mb-4">
        <Palette className="text-[#1F2E4A]" size={18} />
        <h3 className="font-bold text-sm text-[#1F2E4A]">Branding — Logo & Theme Colour</h3>
      </div>

      {!isAdmin && (
        <p className="text-xs text-slate-500 mb-3">Only administrators can change the company branding.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
        {/* Logo upload */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1">Company Logo</label>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-lg border border-dashed border-[#CED4DA] bg-[#F8F9FA] grid place-items-center overflow-hidden shrink-0">
              {logo ? (
                <img src={logo} alt="Logo preview" className="max-w-full max-h-full object-contain p-1.5" />
              ) : (
                <InfinityIcon size={30} className="text-slate-300" />
              )}
            </div>
            <div className="space-y-1.5">
              <input ref={fileRef} type="file" accept={ACCEPTED.join(',')} className="hidden" onChange={handleFile} />
              <button
                type="button"
                disabled={!isAdmin || busy}
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 text-xs font-semibold text-[#1F2E4A] bg-white border border-[#CED4DA] hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ImagePlus size={13} /> {busy ? 'Reading…' : logo ? 'Change Logo' : 'Upload Logo'}
              </button>
              {logo && (
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => { setLogo(''); setDetectedColor(''); }}
                  className="px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={13} /> Remove
                </button>
              )}
              <p className="text-[11px] text-slate-400">PNG, JPG, WebP or SVG · max 2 MB</p>
            </div>
          </div>
        </div>

        {/* Brand name */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1">Brand Name (optional)</label>
          <input
            type="text"
            value={name}
            disabled={!isAdmin}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Oscar Textiles"
            className="w-full p-2 border border-[#CED4DA] rounded bg-[#F8F9FA]"
          />
          <p className="text-[11px] text-slate-400 mt-1">Shown next to the logo in the sidebar and on the login page.</p>
        </div>

        {/* Theme colour */}
        <div className="sm:col-span-2">
          <label className="font-semibold text-slate-700 block mb-1">Theme Colour</label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="color"
              value={isValidHex(color) ? color : '#14b8a6'}
              disabled={!isAdmin}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-9 p-0.5 border border-[#CED4DA] rounded cursor-pointer bg-white"
              title="Pick theme colour"
            />
            <input
              type="text"
              value={color}
              disabled={!isAdmin}
              onChange={(e) => setColor(e.target.value.trim())}
              placeholder="Default theme"
              className="w-32 p-2 border border-[#CED4DA] rounded bg-[#F8F9FA] font-mono"
            />
            <button
              type="button"
              disabled={!isAdmin || !logo}
              onClick={handleAutoColor}
              className="px-3 py-1.5 text-xs font-semibold text-[#1F2E4A] bg-white border border-[#CED4DA] hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wand2 size={13} /> Match Logo Colour
            </button>
            {color && (
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => setColor('')}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                Use default theme colour
              </button>
            )}
          </div>

          {swatchColors.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex rounded-md overflow-hidden border border-[#CED4DA]">
                {swatchColors.map((c) => (
                  <span key={c} className="w-8 h-6 block" style={{ background: c }} title={c} />
                ))}
              </div>
              <span
                className="px-3 py-1.5 rounded-lg text-white font-semibold"
                style={{ background: palette['--primary'] }}
              >
                Button preview
              </span>
            </div>
          )}
        </div>
      </div>

      {error && <p role="alert" className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 pt-4 mt-4 border-t border-slate-100">
        <button
          type="button"
          disabled={!isAdmin || busy}
          onClick={handleSave}
          className="px-4 py-1.5 text-xs font-bold text-white bg-[#1F2E4A] hover:bg-[#2a3f65] rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check size={13} /> Save & Apply Branding
        </button>
        <button
          type="button"
          disabled={!isAdmin}
          onClick={handleReset}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-[#CED4DA] hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RotateCcw size={13} /> Reset to Default
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded">
            <Check size={14} /> Branding applied
          </span>
        )}
      </div>
    </div>
  );
}
