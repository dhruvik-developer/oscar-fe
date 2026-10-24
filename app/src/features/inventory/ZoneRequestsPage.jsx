import React from 'react';
import { useERP } from '../../context/ERPContext';
import { ZoneRequestsView } from './ZoneRequestsView';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { Send, Clock, Truck, CheckCircle2 } from 'lucide-react';

const zoneGuide = {
    title: 'Assembly Bay & Zone Requisitions',
    subtitle: 'Shop-floor material requests, central storage allocation, supervisor approvals, and staging.',
    purpose: 'Zone requests allow floor assembly lines and technicians to pull required raw components from Central Warehouse stock. Each requisition follows a validation workflow: Request → Supervisor Approval → Central Dispatch → Bay Intake.',
    keyTerms: [
        { term: 'Zone Requisition', definition: 'An internal pull request from a shop-floor bay for specific parts.' },
        { term: 'Staging Area', definition: 'A holding zone where requested parts are gathered before moving to the assembly line.' },
    ],
    tips: [
        'Supervisor approvals immediately allocate inventory from Central Warehouse bins.',
    ],
    workflow: ['Technician Requisition', 'Supervisor Approval', 'Central Warehouse Picking', 'Delivered to Assembly Bay'],
};

export const ZoneRequestsPage = () => {
    const { zoneRequests, updateZoneRequest, addZoneRequest } = useERP();
    const pendingCount = zoneRequests.filter(r => r.status === 'Pending').length;
    const inTransitCount = zoneRequests.filter(r => r.status === 'Approved' || r.status === 'In Transit').length;
    const fulfilledCount = zoneRequests.filter(r => r.status === 'Completed' || r.status === 'Fulfilled').length;

    return (<div className="space-y-6">
      <PageHeader title="Assembly Bay & Zone Requisitions" subtitle="Monitor shop-floor requests, verify central storage availability, review supervisor approvals, and dispatch materials." guide={zoneGuide} />

      {/* Zone Requests KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Requisitions" value={`${zoneRequests.length} Requests`} icon={Send} />
        <StatCard label="Pending Floor Approvals" value={`${pendingCount} Pending`} icon={Clock} trend={{ positive: pendingCount === 0, text: pendingCount > 0 ? 'Requires supervisor action' : 'All approved' }} highlight={pendingCount > 0} />
        <StatCard label="Approved / Staging" value={`${inTransitCount} In Progress`} icon={Truck} subtext="Picking from Central" />
        <StatCard label="Fulfilled Requisitions" value={`${fulfilledCount} Delivered`} icon={CheckCircle2} trend={{ positive: true, text: 'Dispatched to Bay' }} />
      </div>

      <ZoneRequestsView requests={zoneRequests} onRequestUpdate={updateZoneRequest} onAddRequest={addZoneRequest}/>
    </div>);
};
