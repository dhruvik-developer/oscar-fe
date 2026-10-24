/**
 * leadDetailMap — one reusable translation layer between the Lead detail UI
 * shapes and the backend CRM sub-resource serializers (api.md §9.2).
 *
 * The detail tabs were built against localStorage-era row shapes
 * (`{text, by, createdAt}`, `{source, details, date}`, …) while the server
 * speaks serializer shapes (`{body, authorName, created_at}`,
 * `{name, campaign, medium}`, …). Instead of scattering conversions across
 * components, both directions live here:
 *
 *   normalizeSection(section, rows) — server row → UI row (read path)
 *   toApiSection(section, row)      — UI row → POST payload (write path,
 *                                   null when the row cannot be sent)
 *
 * Sections without a write endpoint (`timeline`, `tasks`, `activities`,
 * `documents`) are read-only here: normalizing them is fine, posting them
 * is skipped so the UI never spams non-existent endpoints.
 */

function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function displayDateTime(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return text(value);
    return `${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return text(value);
  }
}

function displayDate(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return text(value);
    return date.toLocaleDateString('en-GB');
  } catch {
    return text(value);
  }
}

/** Backend → UI. Rows that already look like UI rows pass through untouched. */
export function normalizeSection(section, rows) {
  const list = Array.isArray(rows) ? rows : [];
  switch (section) {
    case 'notes':
      return list.map((row) => {
        if (row && (row.text !== undefined || row.by !== undefined) && row.body === undefined) {
          return { ...row, _synced: row._synced ?? false };
        }
        return {
          id: row.id,
          text: row.body ?? '',
          body: row.body ?? '',
          by: row.authorName || row.by || '',
          authorName: row.authorName || '',
          createdAt: row.created_at || row.createdAt || '',
          created_at: row.created_at || '',
          _synced: true,
        };
      });
    case 'emails':
      return list.map((row) => {
        if (row && row.to_addresses === undefined && row.toAddresses === undefined && row.person !== undefined) {
          return { ...row, _synced: row._synced ?? false };
        }
        const sentAt = row.sent_at ?? row.sentAt ?? null;
        const createdAt = row.created_at ?? row.createdAt ?? null;
        const toAddresses = row.to_addresses ?? row.toAddresses ?? [];
        const person = row.person
          || row.createdByName || row.created_byName || row.senderName
          || (Array.isArray(toAddresses) && toAddresses.length > 0 ? toAddresses.join(', ') : '')
          || '';
        return {
          id: row.id,
          subject: row.subject || '',
          body: row.body || '',
          message: row.body || '',
          person,
          date: displayDateTime(sentAt || createdAt || row.date),
          sent_at: sentAt || '',
          sentAt: sentAt || '',
          status: row.status || (sentAt ? 'Sent' : 'Draft'),
          to_addresses: Array.isArray(toAddresses) ? toAddresses : [],
          toAddresses: Array.isArray(toAddresses) ? toAddresses : [],
          _synced: true,
        };
      });
    case 'sources':
      return list.map((row) => {
        if (row && row.source !== undefined && row.name === undefined) {
          return { ...row, _synced: row._synced ?? false };
        }
        const attributedAt = row.attributed_at ?? row.attributedAt ?? null;
        const createdAt = row.created_at ?? row.createdAt ?? null;
        return {
          id: row.id,
          source: row.name || row.source || row.sourceName || '',
          name: row.name || row.source || '',
          sourceId: row.sourceId || row.source_id || undefined,
          details: row.details || row.campaign || row.medium || '',
          campaign: row.campaign || row.details || '',
          medium: row.medium || '',
          date: displayDateTime(attributedAt || createdAt || row.date),
          attributed_at: attributedAt || '',
          createdBy: row.createdBy || row.createdByName || row.created_byName || row.authorName || '',
          color: row.color || '#1f6bff',
          icon: row.icon || 'globe',
          _synced: true,
        };
      });
    case 'products': {
      // Fabric requirement rows (Users & Requirements tab). The wire speaks
      // camelCase (`productName`, `fabricColor`, `expectedRate`, ...); older
      // local rows may carry snake_case or the generic `name`/`price` keys.
      const rateOf = (row) => {
        const raw = row.expectedRate ?? row.expected_rate;
        const num = Number(raw);
        return Number.isFinite(num) ? num : null;
      };
      return list.map((row) => {
        if (row && row.product_name === undefined && row.productName === undefined
          && (row.name !== undefined || row.productName !== undefined)) {
          return { ...row, _synced: row._synced ?? false };
        }
        const rate = rateOf(row);
        return {
          id: row.id,
          productName: row.productName || row.product_name || row.name || '',
          product_name: row.productName || row.product_name || row.name || '',
          name: row.productName || row.product_name || row.name || '',
          fabricCode: row.fabricCode || row.fabric_code || '',
          fabric_code: row.fabricCode || row.fabric_code || '',
          fabricType: row.fabricType || row.fabric_type || '',
          fabric_type: row.fabricType || row.fabric_type || '',
          fabricDesign: row.fabricDesign || row.fabric_design || '',
          fabric_design: row.fabricDesign || row.fabric_design || '',
          fabricColor: row.fabricColor || row.fabric_color || '',
          fabric_color: row.fabricColor || row.fabric_color || '',
          fabricWidth: row.fabricWidth ?? row.fabric_width ?? '',
          fabric_width: row.fabricWidth ?? row.fabric_width ?? '',
          fabricGsm: row.fabricGsm ?? row.fabric_gsm ?? '',
          fabric_gsm: row.fabricGsm ?? row.fabric_gsm ?? '',
          sku: row.fabricCode || row.fabric_code || row.sku || '',
          qty: row.qty ?? row.quantity ?? 1,
          quantity: row.qty ?? row.quantity ?? 1,
          uom: row.uom || row.UOM || '',
          expectedRate: rate,
          expected_rate: rate,
          // Legacy `price` display kept for readers that prefill rates.
          // Expected rate is never a confirmed price.
          price: rate != null ? `Rs. ${Number(rate).toLocaleString('en-IN')}` : (row.price || ''),
          status: row.status || 'Active',
          notes: row.notes || row.remarks || '',
          remarks: row.notes || row.remarks || '',
          image: '',
          itemId: row.itemId || row.item_id || undefined,
          _synced: true,
        };
      });
    }
    case 'users':
      return list.map((row) => {
        if (row && row.userId === undefined && row.email !== undefined && row.added_at === undefined) {
          return { ...row, _synced: row._synced ?? false };
        }
        return {
          id: row.id,
          userId: row.userId || row.user_id || undefined,
          name: row.name || '',
          email: row.email || '',
          role: row.role || '',
          status: row.status || 'Active',
          initials: row.initials || '',
          bg: row.bg || '#3b82f6',
          added_at: row.added_at || '',
          _synced: true,
        };
      });
    case 'files':
      return list.map((row) => {
        if (row && row.fileId === undefined && (row.name !== undefined || row.preview !== undefined)) {
          return { ...row, _synced: row._synced ?? false };
        }
        return {
          id: row.id,
          fileId: row.fileId || undefined,
          name: row.fileName || row.name || row.label || '',
          fileName: row.fileName || row.name || '',
          label: row.label || row.name || '',
          size: row.fileSize != null ? `${Math.max(1, Math.round(row.fileSize / 1024))} KB` : (row.size || ''),
          fileSize: row.fileSize ?? null,
          sentOn: displayDate(row.created_at || row.sentOn),
          sentBy: row.sentBy || '',
          preview: row.url || row.preview || '',
          downloadUrl: row.url || row.downloadUrl || row.preview || '',
          url: row.url || '',
          description: row.description || row.label || '',
          type: row.type || 'document',
          _synced: true,
        };
      });
    case 'threads':
      return list.map((row) => {
        if (row && row.subject === undefined && row.name !== undefined) {
          return { ...row, _synced: row._synced ?? false };
        }
        return {
          id: row.id,
          subject: row.subject || '',
          name: row.subject || row.name || 'Discussion',
          note: row.note || 'General discussion',
          kind: row.kind || 'server',
          color: row.color || '#2F6FED',
          messages: Array.isArray(row.messages)
            ? row.messages.map((message) => ({
              id: message.id,
              body: message.body || '',
              sender: message.authorName || message.sender || '',
              authorName: message.authorName || '',
              time: displayDateTime(message.sent_at || message.time),
              sent_at: message.sent_at || '',
              side: message.side || 'in',
            }))
            : [],
          created_at: row.created_at || '',
          _synced: true,
        };
      });
    case 'timeline':
    case 'activities': {
      const DOT_COLOR = {
        email: '#3b82f6',
        sent: '#10b981',
        note: '#f59e0b',
        task: '#ef4444',
        activity: '#94a3b8',
      };
      return list
        .filter((row) => {
          if (row.type === 'activity' && (!row.title || row.title === 'update')) return false;
          return true;
        })
        .map((row) => ({
          ...row,
          date: displayDateTime(row.at || row.date),
          author: text(row.actor || row.author, '—'),
          preview: text(row.body || row.preview, ''),
          dotColor: row.dotColor || DOT_COLOR[row.type] || '#94a3b8',
        }));
    }
    default:
      return list;
  }
}

/**
 * UI row → backend POST payload, or null when the row cannot be represented
 * server-side (e.g. a file upload without a `core.File` id — the LeadFile
 * serializer requires `fileId`, so data-URL previews stay local-only).
 */
export function toApiSection(section, row) {
  if (!row || typeof row !== 'object') return null;
  const compact = (payload) => Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
  switch (section) {
    case 'notes':
      if (!text(row.body || row.text).trim()) return null;
      return { body: text(row.body || row.text).trim() };
    case 'emails':
      if (!text(row.subject).trim()) return null;
      {
        const toList = Array.isArray(row.to_addresses) ? row.to_addresses
          : (Array.isArray(row.toAddresses) ? row.toAddresses : []);
        return compact({
          subject: text(row.subject).trim(),
          body: text(row.body || row.message || ''),
          to_addresses: toList.length > 0
            ? toList
            : (row.mailTo ? [text(row.mailTo)] : undefined),
        });
      }
    case 'sources': {
      if (!text(row.sourceId || row.name || row.source).trim() && !text(row.details || row.campaign).trim()) return null;
      return compact({
        sourceId: row.sourceId || row.source_id || undefined,
        // Channel label ("Website", "Referral", …). The API resolves it to a
        // real `crm.Source` so GET returns `name`; without it SOURCE is blank.
        source: text(row.source || row.name || '').trim() || undefined,
        name: text(row.name || row.source || '').trim() || undefined,
        campaign: text(row.details || row.campaign || '').slice(0, 500) || undefined,
        medium: text(row.medium || ''),
      });
    }
    case 'products': {
      const quality = text(
        row.productName || row.product_name || row.name || row.productName,
      ).trim();
      if (!quality) return null;
      const numOrUndef = (value) => {
        if (value === undefined || value === null || value === '') return undefined;
        const num = Number(value);
        return Number.isFinite(num) ? num : undefined;
      };
      const textOrUndef = (value) => {
        const str = text(value).trim();
        return str || undefined;
      };
      const qty = Number(row.qty ?? row.quantity ?? 1);
      return compact({
        itemId: row.itemId || row.item_id || undefined,
        product_name: quality,
        fabric_code: textOrUndef(row.fabricCode || row.fabric_code),
        fabric_type: textOrUndef(row.fabricType || row.fabric_type),
        fabric_design: textOrUndef(row.fabricDesign || row.fabric_design),
        fabric_color: textOrUndef(row.fabricColor || row.fabric_color),
        fabric_width: numOrUndef(row.fabricWidth ?? row.fabric_width),
        fabric_gsm: numOrUndef(row.fabricGsm ?? row.fabric_gsm),
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        uom: textOrUndef(row.uom),
        expected_rate: numOrUndef(row.expectedRate ?? row.expected_rate),
        status: text(row.status || 'Active'),
        notes: text(row.notes || row.remarks || ''),
      });
    }
    case 'users':
      if (!row.userId) return null;
      return compact({ userId: row.userId, role: text(row.role || '') || undefined });
    case 'files':
      // LeadFile.file is a PROTECT FK to core.File — a data-URL preview is
      // not a file record, so there is nothing valid to POST.
      if (!row.fileId) return null;
      return compact({ fileId: row.fileId, label: text(row.label || row.name || '') || undefined });
    case 'threads':
      if (!text(row.subject || row.name).trim()) return null;
      return { subject: text(row.subject || row.name).trim() };
    default:
      return null;
  }
}

/** Sections with a real `GET/POST /crm/leads/{id}/{section}/` endpoint. */
export const WRITABLE_LEAD_SECTIONS = new Set([
  'users', 'products', 'sources', 'notes', 'emails', 'files', 'threads',
]);

/**
 * Status-aware message for a failed Lead API call, for toasts and inline
 * errors. 400 carries `field_errors`; 401/403/404/409/500 each get a
 * human-readable line instead of a raw status dump.
 */
export function describeLeadApiError(err) {
  const status = err?.status ?? 0;
  const payload = err?.payload || {};
  const fieldErrors = payload.field_errors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const entries = Object.entries(fieldErrors);
    if (entries.length > 0) {
      const [field, messages] = entries[0];
      const first = Array.isArray(messages) ? messages[0] : messages;
      return `${field}: ${first}`;
    }
  }
  if (payload?.message && typeof payload.message === 'string' && payload.message.length < 300) {
    if (status === 400 || status === 409 || status === 422) return payload.message;
  }
  switch (status) {
    case 400:
      return err?.message || 'Some fields need attention.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'That lead no longer exists. It may have been deleted.';
    case 409:
      return err?.message || 'This record changed since you opened it. Reload and try again.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    default:
      if (status >= 500) return 'The server is unavailable. Please try again shortly.';
      return err?.message || 'Could not reach the server. Please try again.';
  }
}

export default { normalizeSection, toApiSection, WRITABLE_LEAD_SECTIONS, describeLeadApiError };
