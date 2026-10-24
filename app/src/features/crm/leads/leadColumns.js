// Shared mapping between the lead capture form's fields and the leads table.
// Both LeadsPage (column list + edits) and LeadsTable (cell values) use this,
// so it lives here instead of either component (which import each other).

// Known form fields → lead row mapping. Custom builder forms may rename ids
// or labels ("Compnay", "Create On"), so both are matched.
const KNOWN_LEAD_FIELDS = [
  { ids: ['lead-name'], labels: ['lead name'], kind: 'name' },
  { ids: ['company'], labels: ['company', 'compnay'], kind: 'row', rowKey: 'company' },
  { ids: ['email'], labels: ['email', 'e-mail', 'email address'], kind: 'row', rowKey: 'email' },
  { ids: ['phone'], labels: ['phone', 'phone number', 'mobile'], kind: 'row', rowKey: 'phone' },
  { ids: ['lead-source'], labels: ['lead source', 'source'], kind: 'row', rowKey: 'source' },
  { ids: ['title'], labels: ['title', 'job title', 'designation'], kind: 'row', rowKey: 'jobTitle' },
  { ids: ['industry'], labels: ['industry'], kind: 'row', rowKey: 'industry' },
  { ids: ['lead-owner'], labels: ['lead owner', 'owner'], kind: 'row', rowKey: 'owner' },
  { ids: ['created-on'], labels: ['created on', 'create on'], kind: 'row', rowKey: 'createdOn' },
  { ids: ['products'], labels: ['products', 'product', 'febric', 'fabric'], kind: 'products' },
  { ids: ['lead-users'], labels: ['lead users', 'lead user'], kind: 'users' },
  { ids: ['task-date'], labels: ['task date'], kind: 'taskDate' },
  { ids: ['task-time'], labels: ['task time'], kind: 'taskTime' },
];

const normFieldLabel = (value) => String(value || '').trim().toLowerCase();

export function matchKnownLeadField(field) {
  const id = String(field?.id || '');
  const label = normFieldLabel(field?.label);
  return KNOWN_LEAD_FIELDS.find((known) => known.ids.includes(id) || known.labels.includes(label)) || null;
}

export function displayFieldValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === undefined || value === null) return '';
  return String(value);
}

/** Read a dynamic column's display value off a lead row. */
export function leadColumnValue(lead, column) {
  if (!lead || !column) return '';
  // Rows saved while a field label was renamed (e.g. "Compnay") may hold the
  // value only in customValues.fields — fall back so the table never blanks.
  const customFallback = (column.fieldId != null && column.fieldId !== '')
    ? displayFieldValue(
      lead.customValues?.fields?.[column.fieldId] ?? lead.customValues?.[column.fieldId] ?? '',
    )
    : '';
  switch (column.kind) {
    case 'leadNumber':
      return lead.leadNumber || lead.lead_number || '';
    case 'name':
      return lead.name || customFallback || '';
    case 'row':
      return lead[column.rowKey] || customFallback || '';
    case 'products':
      return displayFieldValue(lead.customValues?.products);
    case 'users':
      return displayFieldValue(lead.customValues?.leadUsers);
    case 'taskDate':
      return lead.customValues?.taskDate || '';
    case 'taskTime':
      return lead.customValues?.taskTime || '';
    case 'custom':
      return displayFieldValue(
        lead.customValues?.fields?.[column.fieldId] ?? lead.customValues?.[column.fieldId] ?? '',
      );
    default:
      return '';
  }
}

/** Build the patch for an inline cell edit of a dynamic column. */
export function leadColumnPatch(column, value) {
  if (!column) return {};
  if (column.kind === 'row') return { [column.rowKey]: value };
  if (column.kind === 'taskDate') return { __customKey: 'taskDate', __customValue: value };
  if (column.kind === 'taskTime') return { __customKey: 'taskTime', __customValue: value };
  if (column.kind === 'custom') {
    return { __customKey: `fields.${column.fieldId}`, __customValue: value };
  }
  return {};
}

/**
 * One column per form field (except the image — the avatar already shows
 * it). Custom builder fields become editable text columns backed by
 * customValues.fields.
 */
export function buildLeadColumns(sections) {
  const columns = [];
  for (const section of sections || []) {
    for (const field of section.fields || []) {
      if (field.type === 'Lead Image') continue;
      const known = matchKnownLeadField(field);
      if (!known) {
        columns.push({
          key: `custom:${field.id}`,
          fieldId: field.id,
          label: field.label || 'Field',
          kind: 'custom',
          editable: true,
        });
        continue;
      }
      if (known.kind === 'name') {
        columns.push({ key: 'name', label: field.label || 'Lead Name', kind: 'name', editable: true, fieldId: field.id });
      } else if (known.kind === 'row') {
        columns.push({ key: known.rowKey, label: field.label, kind: 'row', rowKey: known.rowKey, editable: true, fieldId: field.id });
      } else if (known.kind === 'products' || known.kind === 'users') {
        columns.push({ key: known.kind, label: field.label, kind: known.kind, editable: false });
      } else {
        columns.push({ key: known.kind, label: field.label, kind: known.kind, editable: true });
      }
    }
  }
  // Name first, then the rest in form order.
  columns.sort((a, b) => (a.kind === 'name' ? -1 : b.kind === 'name' ? 1 : 0));
  return columns;
}
