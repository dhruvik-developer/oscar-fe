/**
 * StatusBadge — maps ERP/HRMS/CRM status strings to CRM badge styles.
 * Consolidated from ERP StatusBadge.jsx
 */

const STATUS_MAP = {
  // ERP sales
  'Draft': 'badge-gray',
  'Sent': 'badge-blue',
  'Viewed': 'badge-cyan',
  'Expired': 'badge-orange',
  'Accepted': 'badge-green',
  'Rejected': 'badge-red',
  'Invoiced': 'badge-purple',
  'Pending': 'badge-yellow',
  'Paid': 'badge-green',
  'Partial': 'badge-yellow',
  'Overdue': 'badge-red',
  'Confirmed': 'badge-blue',
  'Delivered': 'badge-green',
  'Cancelled': 'badge-red',
  'Active': 'badge-green',
  'Inactive': 'badge-gray',
  'Transporter': 'badge-cyan',
  'Received': 'badge-green',
  'Ordered': 'badge-blue',
  'Returned': 'badge-orange',

  // ERP purchase (Oscar workflow)
  'Billed': 'badge-purple',
  'Partially Billed': 'badge-yellow',
  'Issued': 'badge-blue',
  'In Production': 'badge-blue',
  'Partially Received': 'badge-orange',
  'Fully Received': 'badge-green',

  // Stock / Inventory
  'Requested': 'badge-yellow',
  'In Transit': 'badge-cyan',
  'Completed': 'badge-green',
  'Reported': 'badge-red',
  'Sent for Replacement': 'badge-orange',
  'Replaced': 'badge-green',
  'Credited': 'badge-purple',

  // CRM
  'New': 'badge-blue',
  'Contacted': 'badge-cyan',
  'Qualified': 'badge-purple',
  'Converted': 'badge-green',
  'Lost': 'badge-red',
  'Nurturing': 'badge-yellow',

  // HRMS attendance
  'Present': 'badge-green',
  'Absent': 'badge-red',
  'Late': 'badge-yellow',
  'Half Day': 'badge-orange',
  'Leave': 'badge-purple',
  'Holiday': 'badge-cyan',

  // HRMS leave
  'Pending Approval': 'badge-yellow',
  // QC (Phase 2C)
  'Rework': 'badge-orange',

  // HRMS payroll
  'Processed': 'badge-green',
  'Processing': 'badge-yellow',
  'Failed': 'badge-red',

  // HRMS Performance
  'In Progress': 'badge-blue',
  'In Review': 'badge-yellow',
  'Submitted': 'badge-purple',
  'Approved': 'badge-green',
  'Archived': 'badge-gray',
  'Self Review': 'badge-blue',
  'Manager Review': 'badge-yellow',
  'HR Review': 'badge-purple',
  'Finalization': 'badge-green',

  // Valuation
  'Posted': 'badge-green',
  'Voided': 'badge-red',
};

export function StatusBadge({ status, className = '' }) {
  const cls = STATUS_MAP[status] || 'badge-gray';
  return (
    <span className={`badge ${cls} ${className}`}>
      {status}
    </span>
  );
}

export default StatusBadge;

