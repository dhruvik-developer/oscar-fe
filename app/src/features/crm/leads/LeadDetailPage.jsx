import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LeadDetailView from './LeadDetailView';
import { useCrmStore } from '../../../stores/crmStore';
import { crmSync, isServerId } from '../../../services/crmSync';

/**
 * Resolves `/crm/leads/:id` against the store, falling back to a direct read so
 * a link opened in a fresh tab works before the collection has finished loading.
 */
export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const leads = useCrmStore((s) => s.leads);
  const loading = useCrmStore((s) => s.status.loading);

  const fromStore = React.useMemo(
    () => leads.find((l) => String(l.id) === String(id)) ?? null,
    [leads, id],
  );

  const [fetched, setFetched] = React.useState(null);
  const [fetchAttempted, setFetchAttempted] = React.useState(false);

  React.useEffect(() => {
    setFetched(null);
    setFetchAttempted(false);
  }, [id]);

  React.useEffect(() => {
    if (fromStore) return undefined;
    if (!id) {
      setFetchAttempted(true);
      return undefined;
    }
    // Local-only ids (`lead-local-…`) were never persisted — the server has
    // nothing to return, so don't wait on a fetch that resolves null.
    if (!isServerId(id)) {
      setFetchAttempted(true);
      return undefined;
    }
    let cancelled = false;
    crmSync.pullOne('leads', id).then((row) => {
      if (cancelled) return;
      setFetched(row);
      setFetchAttempted(true);
    });
    return () => { cancelled = true; };
  }, [fromStore, id]);

  const activeLead = fromStore || fetched;
  const isLocalId = Boolean(id) && !isServerId(id);

  if (!activeLead) {
    // Show the spinner only while the collection / single fetch is in flight.
    // The old `leads.length === 0` check trapped local-only leads here
    // forever after a refresh, because the server can never return them.
    if (loading || !fetchAttempted) {
      return (
        <div className="card p-8 text-center text-xs text-slate-500">Loading lead…</div>
      );
    }
    return (
      <div>
        <div className="card p-8 text-center space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Lead not found</h3>
          <p className="text-xs text-slate-500">
            {isLocalId
              ? 'This lead was created locally and was never saved to the server, so it does not survive a refresh. Go back and recreate it.'
              : 'This lead may have been deleted.'}
          </p>
          <button type="button" className="btn-primary btn-sm" onClick={() => navigate('/crm/leads')}>
            Back to Leads
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <LeadDetailView lead={activeLead} onBackToLeads={() => navigate('/crm/leads')} />
    </div>
  );
}
