import React from 'react';
import { useERP } from '../../context/ERPContext';
import { FaultyPartsView } from './FaultyPartsView';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { AlertTriangle, Clock, Truck, CheckCircle2 } from 'lucide-react';

const faultyGuide = {
    title: 'Quarantine & Defective Parts Management',
    subtitle: 'Segregate failed components, inspect defect telemetry, and manage vendor RMA replacements.',
    purpose: 'Quarantine tracking isolates damaged, dead-on-arrival (DOA), or malfunctioning components away from active stock to prevent accidental customer shipments while managing vendor return merchandise authorizations (RMA).',
    keyTerms: [
        { term: 'RMA (Return Merchandise Authorization)', definition: 'Vendor agreement number to return defective parts for repair, replacement, or credit.' },
        { term: 'Quarantine Segregation', definition: 'Physical and logical isolation of items that fail quality inspection.' },
    ],
    tips: [
        'Click "Report Faulty" to isolate defective parts immediately from inventory.',
        'Track vendor courier dispatch and mark parts replaced when replacements arrive.',
    ],
    workflow: ['Defect Detected', 'Quarantined & RMA Issued', 'Shipped to Vendor', 'Replacement Received & Restocked'],
};

export const FaultyPartsPage = () => {
    const { faultyParts, addFaultyPart, updateFaultyPartStatus, updateFaultyPartNotes } = useERP();
    const totalDefectiveUnits = faultyParts.reduce((acc, p) => acc + (p.qty || 1), 0);
    const reportedCount = faultyParts.filter(p => p.status === 'Reported').length;
    const inTransitCount = faultyParts.filter(p => p.status === 'Sent for Replacement').length;
    const resolvedCount = faultyParts.filter(p => p.status === 'Replaced' || p.status === 'Closed').length;

    return (<div className="space-y-6">
      <PageHeader title="Quarantine & Defective Parts" subtitle="Segregate failed components, inspect defect telemetry, initiate vendor RMA warranty claims, and authorize replacements." guide={faultyGuide} />

      {/* Faulty Parts KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Quarantined Units" value={`${totalDefectiveUnits} Units`} icon={AlertTriangle} highlight={totalDefectiveUnits > 0} />
        <StatCard label="Awaiting RMA Dispatch" value={`${reportedCount} Reported`} icon={Clock} trend={{ positive: reportedCount === 0, text: reportedCount > 0 ? 'Requires vendor contact' : 'All dispatched' }} />
        <StatCard label="Sent for Replacement" value={`${inTransitCount} with Vendor`} icon={Truck} subtext="Vendor RMA in-progress" />
        <StatCard label="Resolved & Restocked" value={`${resolvedCount} Replaced`} icon={CheckCircle2} trend={{ positive: true, text: 'Stock replenished' }} />
      </div>

      <FaultyPartsView
        parts={faultyParts}
        onAddPart={addFaultyPart}
        onUpdatePartStatus={updateFaultyPartStatus}
        onUpdatePartNotes={updateFaultyPartNotes}
      />
    </div>);
};
