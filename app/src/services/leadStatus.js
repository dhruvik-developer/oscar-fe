/** Lost Leads is a filtered view of the same records shown in All Leads. */
export function isLostLead(lead) {
  return lead?.isLost === true || lead?.is_lost === true
    || /lost|closed/i.test(String(lead?.status || lead?.stageName || ''));
}
