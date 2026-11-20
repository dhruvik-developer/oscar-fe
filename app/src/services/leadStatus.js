/** Lost Leads is a filtered view of the same records shown in All Leads. */
export function isLostLead(lead) {
  if (!lead) return false;
  if (lead.isConverted === true || Boolean(lead.convertedAt)) return false;
  if (lead.isLost === false) return false;
  const stageName = typeof lead.stage === 'object' ? lead.stage?.name : lead.stage;
  const isWon = typeof lead.stage === 'object' ? Boolean(lead.stage?.is_won ?? lead.stage?.isWon) : false;
  if (isWon || /won|converted/i.test(String(stageName || ''))) return false;
  const statusStr = String(lead.status || lead.stageName || stageName || '');
  if (/won|converted/i.test(statusStr)) return false;
  if (lead.isLost === true || lead.is_lost === true) return true;
  return /lost|closed|declined/i.test(statusStr);
}
