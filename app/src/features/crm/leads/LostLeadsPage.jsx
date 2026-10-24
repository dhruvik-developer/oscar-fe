import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCrmStore } from '../../../stores/crmStore';
import PageHeader from '../../../components/ui/PageHeader';
import { isLostLead } from '../../../services/leadStatus';

export default function LostLeadsPage() {
  const leads = useCrmStore((s) => s.leads);
  const lostLeads = useMemo(() => leads.filter(isLostLead), [leads]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lost Leads"
        subtitle="Leads marked as Lost / Closed. These records also remain in the main Leads list."
      />

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-left">
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Lead</th>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Created On</th>
            </tr>
          </thead>
          <tbody>
            {lostLeads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No lost leads yet. Use Mark as Lost in the Leads list to show a lead here too.
                </td>
              </tr>
            )}
            {lostLeads.map((lead, index) => (
              <tr key={lead.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                <td className="px-4 py-3">
                  <Link to={`/crm/leads/${encodeURIComponent(lead.id)}`} className="text-blue-600 hover:underline font-semibold">
                    {lead.name || 'Untitled Lead'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{lead.company || '—'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    {lead.status || 'Lost'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{lead.owner || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{lead.source || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{lead.createdOn || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
