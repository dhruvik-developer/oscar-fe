import React from 'react';
import BatchPassportView from './BatchPassportView';

/**
 * What a batch QR opens: its whole life on one premium Batch Passport page,
 * from the PO to the sale, with order traceability, quantities, rolls/takas,
 * QC, production, dyeing job work, and ledger-gated costing.
 */
export default function BatchAtoZPage() {
  return <BatchPassportView isPublic={false} />;
}
