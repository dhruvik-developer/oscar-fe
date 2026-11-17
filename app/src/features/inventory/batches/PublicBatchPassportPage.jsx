import React from 'react';
import BatchPassportView from './BatchPassportView';

/**
 * Public Batch Passport page (accessed via `/batch/:code` or `/public/batch/:code`).
 * Renders the full, premium OSCAR Batch Passport design with public-friendly permissions.
 */
export default function PublicBatchPassportPage() {
  return <BatchPassportView isPublic={true} />;
}
