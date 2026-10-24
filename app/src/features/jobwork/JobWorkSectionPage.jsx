import React from 'react';
import { useLocation } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';

const SECTIONS = {
  '/job-work/process-plan': {
    title: 'Process Plan',
    subtitle: 'Define the process steps and operations for job work orders.',
  },
  '/job-work/orders': {
    title: 'Job Work Orders (JWO)',
    subtitle: 'Job work orders issued to vendors for outside processing.',
  },
  '/job-work/outward': {
    title: 'Job Work Outward',
    subtitle: 'Material sent out to vendors for job work processing.',
  },
  '/job-work/inward': {
    title: 'Job Work Inward',
    subtitle: 'Processed material received back from vendors.',
  },
  '/job-work/pending-register': {
    title: 'Pending Register',
    subtitle: 'Job work orders and quantities pending with vendors.',
  },
  '/job-work/vendor-reconciliation': {
    title: 'Vendor Reconciliation',
    subtitle: 'Reconcile material sent, received, and balance per vendor.',
  },
  '/job-work/reprocess': {
    title: 'Reprocess',
    subtitle: 'Material sent back for reprocessing or correction.',
  },
};

export default function JobWorkSectionPage() {
  const { pathname } = useLocation();
  const section = SECTIONS[pathname] || { title: 'Job Work', subtitle: '' };

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      <PageHeader title={section.title} subtitle={section.subtitle} />

      <div className="rounded-xl border border-[#e2eaf5] bg-white px-4 py-10 text-center shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        <p className="text-[13px] font-extrabold text-[#17294e]">No records found</p>
        <p className="mt-1 text-[11.5px] text-slate-400">There are no records in {section.title} yet.</p>
      </div>
    </div>
  );
}
