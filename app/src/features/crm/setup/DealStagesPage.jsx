import React from 'react';
import SimpleMasterPage from '../../../components/common/SimpleMasterPage';

// Deal stages (/crm/deal-stages/) are the Deals pipeline columns and the
// "Deal Stage" choices on the deal form -- a catalogue separate from lead stages.
const FIELDS = [
  { key: 'name', label: 'Stage Name', required: true, placeholder: 'e.g. Proposal Sent' },
  { key: 'order', label: 'Display Order', type: 'number', step: '1', hint: 'Lower numbers come first in the pipeline.' },
  { key: 'isWon', label: 'Counts as Won', type: 'checkbox' },
  { key: 'isLost', label: 'Counts as Lost', type: 'checkbox' },
];

const COLUMNS = [
  { key: 'order', label: 'Order', className: 'font-mono w-20', render: (r) => r.order ?? r.sequence ?? '—' },
  { key: 'name', label: 'Stage Name', render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
  {
    key: 'outcome',
    label: 'Outcome',
    render: (r) => {
      if (r.isWon) return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">Won</span>;
      if (r.isLost) return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700">Lost</span>;
      return <span className="text-slate-400">Open</span>;
    },
  },
];

const DEFAULTS = { isWon: false, isLost: false };
const SEARCH_KEYS = ['name'];

export default function DealStagesPage() {
  return (
    <SimpleMasterPage
      title="Deal Stages"
      subtitle="Stages of the deals pipeline, used on the Deals board and the deal form."
      entityLabel="Deal Stage"
      endpoint="/crm/deal-stages/"
      fields={FIELDS}
      columns={COLUMNS}
      defaults={DEFAULTS}
      searchKeys={SEARCH_KEYS}
    />
  );
}
