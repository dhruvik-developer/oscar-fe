import React from 'react';
import { useSearchParams } from 'react-router-dom';
import BatchPassportView from './BatchPassportView';
import BatchTraceabilityPage from './BatchTraceabilityPage';

/**
 * A batch QR scan details page: renders the premium OSCAR Batch Passport.
 * Explicit operational actions use the internal BatchTraceabilityPage workspace.
 * Selecting a passport tab (including dyeing) keeps the Batch Passport visible.
 */
export default function BatchQrPage() {
  const [params] = useSearchParams();
  if (params.get('action') === 'send-to-processor' || params.has('returnRejected')) return <BatchTraceabilityPage />;
  return <BatchPassportView isPublic={false} />;
}
