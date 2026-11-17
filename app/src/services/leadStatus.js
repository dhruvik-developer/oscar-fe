/** Lost Leads is a filtered view of the same records shown in All Leads. */
export function isLostLead(lead) {
  if (!lead) return false;
  if (lead.isLost === true || lead.is_lost === true) return true;
  const stageName = typeof lead.stage === 'object' ? lead.stage?.name : lead.stage;
  const statusStr = String(lead.status || lead.stageName || stageName || '');
  return /lost|closed|declined/i.test(statusStr);
}
