import React from 'react';
import { FileText, Layers, Cog, Factory, Package, Truck, IndianRupee } from 'lucide-react';
import { formatMeters, formatMoney } from '../format';
import KpiCard from '../../../../components/ui/KpiCard';

/**
 * OverviewKpiStrip — the seven headline tiles across the top of /pms.
 * Values come straight from GET /pms/dashboard/overview/ (kpis).
 */

const TILES = [
  { key: 'totalProjects', label: 'Total Projects', icon: FileText, tone: 'blue', kind: 'count' },
  { key: 'totalQuantity', label: 'Total Fabric Qty', icon: Layers, tone: 'sky', kind: 'meters' },
  { key: 'inProduction', label: 'In Production', icon: Cog, tone: 'emerald', kind: 'meters' },
  { key: 'inProcessing', label: 'In Processing', icon: Factory, tone: 'purple', kind: 'meters' },
  { key: 'finishedStock', label: 'Finished Stock', icon: Package, tone: 'teal', kind: 'meters' },
  { key: 'pendingDispatch', label: 'Pending Dispatch', icon: Truck, tone: 'indigo', kind: 'meters' },
  { key: 'outstandingPayment', label: 'Outstanding Payment', icon: IndianRupee, tone: 'rose', kind: 'money' },
];

function display(kind, value) {
  if (kind === 'meters') return formatMeters(value);
  if (kind === 'money') return formatMoney(value);
  return Number(value || 0).toLocaleString('en-IN');
}

export function OverviewKpiStrip({ kpis = {} }) {
  return (
    <section
      className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7"
      aria-label="PMS key metrics"
    >
      {TILES.map(({ key, label, icon: Icon, tone, kind }) => (
        <KpiCard
          key={key}
          label={label}
          value={display(kind, kpis[key])}
          icon={Icon}
          tone={tone}
          sub={key === 'totalProjects' ? `${kpis.inProgressProjects ?? 0} In Progress` : undefined}
        />
      ))}
    </section>
  );
}

export default OverviewKpiStrip;
