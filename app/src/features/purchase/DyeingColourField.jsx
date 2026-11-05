import React, { useEffect, useMemo, useState } from 'react';
import { Check, Droplets, Palette } from 'lucide-react';
import { api } from '../../services/api';
import { FABRIC_FLOW_B } from './FabricFlowForm';

/** Quick picks only: the PO stores whatever name and code end up selected. */
const COMMON_COLOURS = [
  { name: 'Navy Blue', hex: '#1F3A5F' },
  { name: 'Royal Blue', hex: '#2952CC' },
  { name: 'Black', hex: '#111111' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Red', hex: '#C8102E' },
  { name: 'Wine', hex: '#722F37' },
  { name: 'Emerald Green', hex: '#047857' },
  { name: 'Bottle Green', hex: '#0B4D3A' },
];

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

function Swatch({ hex, size = 12 }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full border ${hex ? 'border-slate-300' : 'border-dashed border-slate-400'}`}
      style={{ width: size, height: size, backgroundColor: hex || 'transparent' }}
    />
  );
}

/** A saved colour: swatch and name. Renders nothing when there is no colour. */
export function ColourChip({ name, hex, className = '' }) {
  if (!name) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700 ${className}`} title={hex || undefined}>
      <Swatch hex={hex} size={10} /> {name}
    </span>
  );
}

/** What the GRN will open, decided by the PO's delivery type. Nothing to choose. */
export function ReceiptTypeNotice({ po }) {
  if (!po?.fabricFlow) return null;
  const dyed = po.fabricFlow === FABRIC_FLOW_B;
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-[11px] ${dyed ? 'border-violet-200 bg-violet-50/60 text-violet-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
      {dyed && <Droplets size={13} className="shrink-0" />}
      <span>Receiving as <strong>{dyed ? 'Dyed Fabric' : 'Grey Fabric'}</strong></span>
      {dyed && (po.dyeingColourName
        ? <><ColourChip name={po.dyeingColourName} hex={po.dyeingColourHex} /><span className="text-violet-700">colour from {po.poNumber || 'the PO'}</span></>
        : <span className="font-semibold text-amber-700">This older PO has no dyeing colour.</span>)}
    </div>
  );
}

/**
 * `Dyeing Colour *` of the Create PO form: common colours, the Shade master's
 * colours, or a custom colour with its own name and optional code.
 */
export default function DyeingColourField({ name, hex, onChange }) {
  const [masterShades, setMasterShades] = useState([]);
  const [custom, setCustom] = useState(false);

  useEffect(() => {
    let live = true;
    api.get('/inventory/shades/', { query: { page_size: 200 } })
      .then((res) => { if (live) setMasterShades(res?.results || res || []); })
      .catch(() => { if (live) setMasterShades([]); });
    return () => { live = false; };
  }, []);

  const options = useMemo(() => {
    const fromMaster = masterShades
      .filter((s) => s.name && !COMMON_COLOURS.some((c) => same(c.name, s.name)))
      .map((s) => ({ name: s.name, hex: s.hexColor || s.hex_color || '' }));
    return [...COMMON_COLOURS, ...fromMaster];
  }, [masterShades]);

  const isListed = options.some((o) => same(o.name, name));
  const showCustom = custom || Boolean(name && !isListed);
  const validHex = /^#[0-9A-Fa-f]{6}$/.test(hex || '');

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span id="po-dyeing-colour-label" className="font-semibold text-slate-700">Dyeing Colour <span className="text-rose-500">*</span></span>
        {name && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
            <Swatch hex={validHex ? hex : ''} size={14} /> {name}
            {validHex && <span className="font-mono text-[10px] font-normal text-slate-400">{hex.toUpperCase()}</span>}
          </span>
        )}
      </div>

      <div role="radiogroup" aria-labelledby="po-dyeing-colour-label" className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = !showCustom && same(o.name, name);
          return (
            <button
              key={o.name}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => { setCustom(false); onChange({ name: o.name, hex: o.hex }); }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold cursor-pointer ${active ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
            >
              <Swatch hex={o.hex} size={14} /> {o.name}
              {active && <Check size={12} aria-hidden="true" />}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={showCustom}
          onClick={() => { setCustom(true); if (isListed) onChange({ name: '', hex: '' }); }}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold cursor-pointer ${showCustom ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-dashed border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
        >
          <Palette size={13} aria-hidden="true" /> Custom Colour
        </button>
      </div>

      {showCustom && (
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-[1fr_auto_8rem] gap-2 items-end">
          <div>
            <label htmlFor="po-dyeing-colour-name" className="block text-[11px] font-semibold text-slate-600 mb-1">Colour name *</label>
            <input
              id="po-dyeing-colour-name"
              value={name}
              maxLength={100}
              onChange={(e) => onChange({ name: e.target.value, hex })}
              placeholder="e.g. Customer Shade 204"
              className="w-full border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800"
            />
          </div>
          <div>
            <label htmlFor="po-dyeing-colour-picker" className="block text-[11px] font-semibold text-slate-600 mb-1">Picker</label>
            <input
              id="po-dyeing-colour-picker"
              type="color"
              value={validHex ? hex : '#888888'}
              onChange={(e) => onChange({ name, hex: e.target.value.toUpperCase() })}
              className="h-[34px] w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5"
            />
          </div>
          <div>
            <label htmlFor="po-dyeing-colour-hex" className="block text-[11px] font-semibold text-slate-600 mb-1">Hex (optional)</label>
            <input
              id="po-dyeing-colour-hex"
              value={hex}
              maxLength={7}
              onChange={(e) => onChange({ name, hex: e.target.value })}
              placeholder="#1F3A5F"
              className="w-full border border-slate-300 rounded-lg p-1.5 bg-white font-mono text-slate-800"
            />
          </div>
        </div>
      )}
      <p className="mt-1.5 text-[10.5px] text-slate-500">Every dyed batch received against this PO takes this colour. It cannot change after the PO leaves Draft.</p>
    </div>
  );
}
