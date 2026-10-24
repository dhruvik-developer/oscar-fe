import React from 'react';
import SimpleMasterPage from '../../../components/common/SimpleMasterPage';

// Lead sources (/crm/sources/) feed the "Lead Source" dropdown on lead forms.
const FIELDS = [
  { key: 'name', label: 'Source Name', required: true, placeholder: 'e.g. Trade Fair, Website, Referral' },
];

const COLUMNS = [
  { key: 'name', label: 'Source Name', render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
];

const SEARCH_KEYS = ['name'];

export default function LeadSourcesPage() {
  return (
    <SimpleMasterPage
      title="Lead Sources"
      subtitle="Where leads come from. Active sources appear in the Lead Source dropdown."
      entityLabel="Lead Source"
      endpoint="/crm/sources/"
      fields={FIELDS}
      columns={COLUMNS}
      searchKeys={SEARCH_KEYS}
    />
  );
}
