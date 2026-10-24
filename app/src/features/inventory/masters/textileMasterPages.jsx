import TextileMasterPage from './TextileMasterPage';
import FabricTypeMasterPage from './FabricTypeMasterPage';
import UomMasterPage from './UomMasterPage';
import FabricQualityMasterPage from './FabricQualityMasterPage';
import DesignPage from './DesignMasterPage';
import ColourShadeMasterPage from './ColourShadeMasterPage';

const CODE = { key: 'code', label: 'Code', half: true, upper: true, placeholder: 'Auto from name', hint: 'Leave blank to generate from the name.' };
const DESCRIPTION = { key: 'description', label: 'Description', type: 'textarea' };
const ACTIVE = { key: 'isActive', label: 'Active', type: 'checkbox' };

const codeColumn = {
  key: 'code',
  label: 'Code',
  render: (r) => <span className="font-mono font-bold text-slate-700">{r.code}</span>,
};
const nameColumn = {
  key: 'name',
  label: 'Name',
  render: (r) => <span className="font-bold text-slate-800">{r.name}</span>,
};
const descriptionColumn = { key: 'description', label: 'Description' };

const QUALITY = {
  key: 'fabricQualities',
  title: 'Fabric Quality Master',
  singular: 'Quality',
  subtitle: 'Define the grey qualities lots are bought, processed and sold against.',
  banner: {
    title: 'What is a fabric quality?',
    text: 'A quality is the construction spec of a fabric — width, GSM, reed, pick and yarn counts. Every lot and taka points to one quality, so set these up before receiving grey stock.',
  },
  lookups: { fabricId: 'fabrics', fabricTypeId: 'fabricTypes', uomId: 'units' },
  fields: [
    { key: 'name', label: 'Quality Name', required: true, half: true, placeholder: 'e.g. 60x60 Cambric' },
    CODE,
    { key: 'composition', label: 'Composition', half: true, placeholder: 'e.g. 100% Cotton' },
    { key: 'fabricTypeId', label: 'Fabric Type', type: 'select', half: true },
    { key: 'fabricId', label: 'Base Fabric', type: 'select', half: true },
    { key: 'uomId', label: 'UOM', type: 'select', half: true },
    { key: 'width', label: 'Width (inches)', type: 'number', half: true, placeholder: '58' },
    { key: 'gsm', label: 'GSM', type: 'number', half: true, placeholder: '110' },
    { key: 'reed', label: 'Reed', type: 'number', half: true },
    { key: 'pick', label: 'Pick', type: 'number', half: true },
    { key: 'warpCount', label: 'Warp Count', half: true, placeholder: 'e.g. 60s' },
    { key: 'weftCount', label: 'Weft Count', half: true, placeholder: 'e.g. 60s' },
    DESCRIPTION,
    ACTIVE,
  ],
  columns: [
    codeColumn,
    nameColumn,
    { key: 'composition', label: 'Composition', render: (r) => r.composition || '—' },
    { key: 'fabricTypeName', label: 'Type' },
    { key: 'gsm', label: 'GSM', align: 'right', render: (r) => (r.gsm ? Number(r.gsm) : '—') },
    { key: 'width', label: 'Width (in)', align: 'right', render: (r) => (r.width ? Number(r.width) : '—') },
    { key: 'uom', label: 'UOM', render: (r) => r.uom || 'Meter' },
    {
      key: 'reedPick',
      label: 'Reed × Pick',
      render: (r) => (r.reed || r.pick ? `${r.reed ?? '—'} × ${r.pick ?? '—'}` : '—'),
      searchValue: (r) => `${r.reed ?? ''} ${r.pick ?? ''}`,
    },
  ],
};

const SHADE = {
  key: 'shades',
  title: 'Colour / Shade Master',
  singular: 'Shade',
  subtitle: 'Manage the colours and shades fabric is dyed or processed into.',
  fields: [
    { key: 'name', label: 'Shade Name', required: true, half: true, placeholder: 'e.g. Navy Blue' },
    CODE,
    { key: 'hexColor', label: 'Swatch Colour', type: 'color' },
    DESCRIPTION,
    ACTIVE,
  ],
  columns: [
    codeColumn,
    {
      key: 'name',
      label: 'Shade',
      render: (r) => (
        <span className="inline-flex items-center gap-2 font-bold text-slate-800">
          <span className="w-4 h-4 rounded border border-slate-200 shrink-0" style={{ background: r.hexColor || 'transparent' }} />
          {r.name}
        </span>
      ),
    },
    { key: 'hexColor', label: 'Hex', render: (r) => <span className="font-mono">{r.hexColor || '—'}</span> },
    descriptionColumn,
  ],
};

export const FabricQualityPage = FabricQualityMasterPage;
export const DesignMasterPage = DesignPage;
export const ShadeMasterPage = ColourShadeMasterPage;
export const FabricTypePage = FabricTypeMasterPage;
export const UomPage = UomMasterPage;
