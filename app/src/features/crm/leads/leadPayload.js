/**
 * The create-lead payload built from CreateLeadModal's output, shared by every
 * place that opens the modal (Leads page, CRM dashboard quick action) so a lead
 * is saved the same way wherever it was entered.
 *
 * The server owns the id, the lead number and the stage defaults, so the
 * payload carries only what the user actually typed.
 */
export function buildLeadPayload(formData, firstStageId) {
  const data = formData ?? {};
  return {
    // A lead has to enter the pipeline somewhere; the first configured
    // stage is where the automation expects it to start.
    stageId: data.stageId || firstStageId,
    name: data.leadName || 'Untitled Lead',
    company: data.company || '',
    phone: data.phone || '',
    email: data.email || '',
    owner: data.owner || '',
    ownerId: data.ownerId || undefined,
    source: data.source || '',
    sourceId: data.sourceId || undefined,
    industryId: data.industryId || undefined,
    industry: data.industry || '',
    jobTitle: data.titleValue || '',
    createdOn: data.createdOn || undefined,
    country: data.country || 'India',
    // Avatar: shown immediately (optimistic row / local lead) and kept
    // inside customValues so it survives the server round-trip.
    photo: data.photoPreview || '',
    // Extra capture (products, lead users, task schedule) has no
    // dedicated columns — the server keeps it in `custom_values` so it
    // survives refresh and renders on the lead detail page.
    // `fields` carries every other dynamic builder value (keyed by field
    // id) so the leads table can show + edit custom form fields.
    customValues: {
      products: data.products || [],
      leadUsers: data.leadUsers || [],
      taskDate: data.taskDate || '',
      taskTime: data.taskTime || '',
      photo: data.photoPreview || '',
      fields: data.fieldValues || {},
    },
  };
}
