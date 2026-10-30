import React, { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, Layers, Palette, Ruler, Shapes, Spool, Tags } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { PageInfoButton } from '../../../components/ui/PageInfoButton';
import { FabricMastersEmbed } from './fabricMastersEmbed';

const FabricVariantMasterPage = lazy(() => import('./FabricVariantMasterPage'));
const FabricQualityPage = lazy(() => import('./FabricQualityMasterPage'));
const DesignMasterPage = lazy(() => import('./textileMasterPages').then((m) => ({ default: m.DesignMasterPage })));
const ShadeMasterPage = lazy(() => import('./ColourShadeMasterPage'));
const FabricTypePage = lazy(() => import('./textileMasterPages').then((m) => ({ default: m.FabricTypePage })));
const CategoriesPage = lazy(() => import('../CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const UomPage = lazy(() => import('./textileMasterPages').then((m) => ({ default: m.UomPage })));

/**
 * Two groups: what a fabric *is* (used every day, Item / Variant first since
 * it is built from the other three) and the one-time setup lists.
 * `guide` is the page-guide title the ⓘ button opens.
 */
export const FABRIC_MASTER_GROUPS = [
  {
    label: 'Fabric',
    tabs: [
      { id: 'variants', label: 'Item / Variant', icon: Boxes, component: FabricVariantMasterPage, guide: 'Fabric Variant Master',
        hint: 'The sellable fabric: a quality + design + colour combination. Used on POs, GRNs, batches, sales and job work.' },
      { id: 'quality', label: 'Quality', icon: Spool, component: FabricQualityPage, guide: 'Fabric Quality Master',
        hint: 'How the fabric is made: construction, counts, GSM, width, composition.' },
      { id: 'design', label: 'Design', icon: Layers, component: DesignMasterPage, guide: 'Design Master',
        hint: 'Print / weave patterns that can go on a quality.' },
      { id: 'colour', label: 'Colour / Shade', icon: Palette, component: ShadeMasterPage, guide: 'Colour / Shade Master',
        hint: 'Shades and colours used for dyeing and dyed fabric.' },
    ],
  },
  {
    label: 'Setup',
    tabs: [
      { id: 'fabric-type', label: 'Fabric Type', icon: Shapes, component: FabricTypePage, guide: 'Fabric Type Master',
        hint: 'Classification such as woven, knitted, grey, finished.' },
      { id: 'categories', label: 'Categories', icon: Tags, component: CategoriesPage, guide: 'Fabric Categories',
        hint: 'Groups used to file and filter fabric items.' },
      { id: 'uom', label: 'Units (UOM)', icon: Ruler, component: UomPage, guide: 'Units of Measurement (UOM)',
        hint: 'Metre, kg, piece and their conversions.' },
    ],
  },
];

export const FABRIC_MASTER_TABS = FABRIC_MASTER_GROUPS.flatMap((g) => g.tabs);

/**
 * Fabric Masters: every fabric master on one page, one tab each.
 * `?tab=` deep-links a tab; the old per-master URLs redirect here.
 */
export default function FabricMastersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = FABRIC_MASTER_TABS.find((t) => t.id === searchParams.get('tab')) || FABRIC_MASTER_TABS[0];
  const activeGroup = FABRIC_MASTER_GROUPS.find((g) => g.tabs.includes(active));
  const Active = active.component;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fabric Masters"
        subtitle="Set up a fabric once: Quality + Design + Colour make an Item / Variant. Setup lists are filled rarely."
        breadcrumb={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Inventory', path: '/inventory' }, { label: 'Fabric Masters' }]}
      />

      <div className="bg-white border border-slate-200 rounded-xl">
        {/* Level 1: the group. Opening a group opens its first tab. */}
        <div className="flex gap-1 p-2 border-b border-slate-100" role="tablist" aria-label="Fabric master groups">
          {FABRIC_MASTER_GROUPS.map((group) => {
            const isActive = group === activeGroup;
            return (
              <button
                key={group.label}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => { if (!isActive) setSearchParams({ tab: group.tabs[0].id }); }}
                className={`h-8 px-4 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {group.label}
                <span className={`ml-1.5 font-semibold ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>{group.tabs.length}</span>
              </button>
            );
          })}
        </div>
        {/* Level 2: the masters of that group. */}
        <div className="flex items-end gap-1 px-3 border-b border-slate-200 overflow-x-auto" role="tablist" aria-label={`${activeGroup.label} masters`}>
          {activeGroup.tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = active.id === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSearchParams({ tab: tab.id })}
                className={`flex items-center gap-2 px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">{active.label}:</span>
          <span>{active.hint}</span>
          <PageInfoButton title={active.guide} />
        </div>
      </div>

      <FabricMastersEmbed.Provider value>
        <Suspense fallback={<div className="p-10 text-center text-sm text-slate-400">Loading…</div>}>
          <Active key={active.id} />
        </Suspense>
      </FabricMastersEmbed.Provider>
    </div>
  );
}
