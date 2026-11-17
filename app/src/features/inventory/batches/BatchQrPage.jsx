import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import BatchPassportView from './BatchPassportView';
import BatchTraceabilityPage from './BatchTraceabilityPage';

/**
 * A batch QR scan details page: renders the premium OSCAR Batch Passport.
 * Only the QC / dyeing action routes (`?tab=dyeing`, `?returnRejected=1`)
 * route to the internal operational BatchTraceabilityPage workspace.
 */
export default function BatchQrPage() {
  const [params] = useSearchParams();
  if (params.get('tab') === 'dyeing' || params.has('returnRejected')) return <BatchTraceabilityPage />;
  return <BatchPassportView isPublic={false} />;
}
