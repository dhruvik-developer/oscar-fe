import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { BatchQrCard } from './BatchQrModal';
import BatchTraceabilityPage from './BatchTraceabilityPage';

function BatchQrOnly({ code }) {
  const [batch, setBatch] = useState({ batchCode: code });

  useEffect(() => {
    let live = true;
    inventoryService.getBatch(code)
      .then((res) => { if (live && res) setBatch(res); })
      .catch(() => {});
    return () => { live = false; };
  }, [code]);

  return (
    <div className="max-w-md mx-auto mt-6 space-y-3">
      <Link to="/inventory/batches" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
        <ArrowLeft size={13} /> Back to Batch Registry
      </Link>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs text-center space-y-4">
        <h1 className="font-mono text-lg font-bold text-slate-900 break-all">{batch.batchCode}</h1>
        <BatchQrCard batch={batch} />
      </div>
    </div>
  );
}

/**
 * A batch link shows the batch's name and QR. Only the QC screens' own links
 * (`?tab=dyeing`, `?returnRejected=1`) still reach the batch's working page.
 */
export default function BatchQrPage() {
  const { code } = useParams();
  const [params] = useSearchParams();
  if (params.get('tab') === 'dyeing' || params.has('returnRejected')) return <BatchTraceabilityPage />;
  return <BatchQrOnly code={code} />;
}
