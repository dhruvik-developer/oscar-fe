/**
 * backendSync — the translation layer between ERPContext's in-memory state and
 * the Django API.
 *
 * Two directions, both defined once per entity in `RESOURCES` below:
 *
 *   pull  — GET the collection and reshape each row into the object the UI
 *           components already read (`invoice.customer`, `challan.items`, …).
 *   push  — POST/PATCH a record the UI just built, then hand back the server's
 *           copy so the caller can replace the optimistic one. The server owns
 *           ids, document numbers and every total (api.md §1.7, §5.7), so its
 *           answer always wins over the locally computed record.
 *
 * With no auth token the module is inert: every push resolves to `null` and the
 * app keeps behaving exactly as it did before it had a backend.
 */
import { api, ApiError } from './api';
import { mapWithLimit } from './resourceSync';
import { getStoredToken } from '../utils/authUtils';
import { formatDateDDMMYYYY, toISODate } from '../utils/dateUtils';

export { ApiError };

/** No token → no server. Pushes become no-ops rather than errors. */
export function isBackendEnabled() {
  return Boolean(getStoredToken());
}

// ── shared field mapping ─────────────────────────────────────────────────────

/** `DD/MM/YYYY`, `Today`, a Date or an ISO string → `YYYY-MM-DD` for the API. */
function isoOut(value) {
  if (!value) return undefined;
  const iso = toISODate(value);
  return iso || undefined;
}

/** `YYYY-MM-DD` → the `DD/MM/YYYY` the tables and print views render. */
function displayIn(value) {
  return value ? formatDateDDMMYYYY(value) : value;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Drop keys the API rejects rather than sending `undefined` through JSON. */
function compact(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined),
  );
}

/**
 * A document line as the server wants it. `itemId` is what ties the line to
 * stock; a line without one is a free-text charge and is sent as-is.
 */
function lineToApi(line, index) {
  return compact({
    lineNo: line.lineNo ?? index + 1,
    itemId: line.itemId || line.inventoryItemId || undefined,
    fabricQualityId: line.fabricQualityId || undefined,
    designId: line.designId || undefined,
    shadeId: line.shadeId || undefined,
    sku: line.sku || line.itemSku || undefined,
    itemName: line.itemName || line.name || undefined,
    description: line.description || line.name || line.itemName || '',
    hsnCode: line.hsnCode || undefined,
    uom: line.uom || line.unit || undefined,
    qty: num(line.qty ?? line.quantity, 1),
    rate: num(line.rate ?? line.price),
    discount: num(line.discount ?? line.discountPercent),
    tax: line.tax !== undefined ? num(line.tax) : num(line.taxRate, 18),
    // BOM provenance: api.md §4.3 requires the server to persist and re-emit these.
    isBomGenerated: line.isBomGenerated ?? undefined,
    bomSourceItemId: line.bomSourceItemId || undefined,
    parentLineId: line.parentLineId || undefined,
    isBomPart: line.isBomPart ?? undefined,
    isUserModified: line.isUserModified ?? undefined,
    serials: Array.isArray(line.serials) ? line.serials : undefined,
    // Proforma lines built from an order keep their order line (the server
    // uses it to enforce invoice-only-what-was-dispatched).
    salesOrderLine: isServerId(line.salesOrderLineId) ? line.salesOrderLineId : undefined,
    // Lot/taka items: [{ lotTakaId, qty }] -- empty means FIFO on dispatch.
    takaAllocations: Array.isArray(line.takaAllocations) && line.takaAllocations.length
      ? line.takaAllocations : undefined,
  });
}

function lineFromApi(line) {
  return {
    ...line,
    // The editors read `name`/`amount`; the API calls them `itemName`/`amount`.
    name: line.itemName || line.description || '',
    quantity: line.qty,
    amount: line.amount,
  };
}

/**
 * Header fields every sales/purchase document shares (`DocumentSerializer`).
 * `partyField` is `partyId` on the sales side and `vendorId` on the purchase
 * side — api.md §6.2 names the same column differently there.
 *
 * `partial` is for PATCH: only keys present on the input are sent, and no
 * defaults are applied — a status-only update must never reset the date to
 * today or wipe the lines. `status`/`stage` are always mapped when present
 * so status flips reach the server.
 */
function documentToApi(doc, { partyField = 'partyId', partyKeys = [] } = {}, { partial = false } = {}) {
  const lines = doc.lineItems || doc.items || [];
  const partyId = partyKeys.map((k) => doc[k]).find(Boolean);
  // Document links survive only as server ids — a local placeholder id
  // would 400 the whole create, so those stay local-only.
  const link = (v) => (isServerId(v) ? v : undefined);
  const dated = (value) => (value !== undefined ? isoOut(value) : undefined);
  return compact({
    [partyField]: partyId,
    date: doc.date !== undefined || !partial ? (isoOut(doc.date) || (!partial ? isoOut('Today') : undefined)) : undefined,
    dueDate: !partial || doc.dueDate !== undefined ? dated(doc.dueDate) : undefined,
    expectedDate: !partial || doc.expectedDate !== undefined || doc.deliveryDate !== undefined
      ? isoOut(doc.expectedDate || doc.deliveryDate) : undefined,
    validUntil: !partial || doc.validUntil !== undefined || doc.validTill !== undefined
      ? isoOut(doc.validUntil || doc.validTill) : undefined,
    notes: doc.notes || undefined,
    terms: doc.terms || doc.termsAndConditions || undefined,
    referenceNumber: doc.referenceNumber || doc.reference || undefined,
    location: doc.location || undefined,
    status: doc.status || undefined,
    stage: doc.stage || undefined,
    quotation: link(doc.quotationId || doc.sourceQuotationId),
    salesOrder: link(doc.salesOrderId || doc.sourceSalesOrderId),
    // Purchase bill → its purchase order (ignored by documents without one).
    purchaseOrder: link(doc.purchaseOrderId),
    // Purchase order workflow + optional project (ignored elsewhere).
    purchaseType: doc.purchaseType || undefined,
    projectId: link(doc.projectId),
    vendorBillNumber: doc.vendorBillNumber || undefined,
    crmDeal: link(doc.dealId),
    crmLead: link(doc.leadId),
    // The quotation composer keeps `salesPerson`; the server resolves either
    // the HRMS employee id or the name to `salesperson_fk` (incentive basis).
    salesperson: doc.salesperson || doc.salesPerson || undefined,
    salespersonId: link(doc.salespersonId),
    broker: doc.broker || undefined,
    paymentTerms: doc.paymentTerms || undefined,
    creditDays: doc.creditDays !== undefined ? num(doc.creditDays) : undefined,
    vehicleNo: doc.vehicleNo || doc.vehicleNumber || undefined,
    transporter: doc.transporter || undefined,
    dispatchDate: doc.dispatchDate ? dated(doc.dispatchDate) : undefined,
    freightCharges: !partial || doc.freightCharges !== undefined ? (doc.freightCharges !== undefined ? num(doc.freightCharges) : undefined) : undefined,
    otherCharges: !partial || doc.otherCharges !== undefined ? (doc.otherCharges !== undefined ? num(doc.otherCharges) : undefined) : undefined,
    roundOff: !partial || doc.roundOff !== undefined ? (doc.roundOff !== undefined ? num(doc.roundOff) : undefined) : undefined,
    discountOverride: !partial || doc.discountTotal !== undefined ? (doc.discountTotal !== undefined ? num(doc.discountTotal) : undefined) : undefined,
    lineItems: !partial || doc.lineItems !== undefined || doc.items !== undefined ? lines.map(lineToApi) : undefined,
  });
}

/**
 * The inverse. Keeps the server's numbers (they are authoritative) and adds the
 * aliases the existing components read, so no view had to be rewritten.
 */
function documentFromApi(row, { numberField, partyLabel = 'customer' } = {}) {
  const lines = (row.lineItems || []).map(lineFromApi);
  const total = num(row.total);
  const serverNumber = numberField ? row[numberField] : undefined;
  // The screens predate the API contract and read legacy aliases
  // (`quoteNumber`, `piNumber`); the server owns `quotationNumber` /
  // `proformaNumber`. Carry both so pulled rows never render a blank number.
  const numberAlias = { quotationNumber: 'quoteNumber', proformaNumber: 'piNumber' }[numberField];
  return {
    ...row,
    date: displayIn(row.date),
    dueDate: row.dueDate || undefined,
    salesperson: row.salesperson || '',
    salesPerson: row.salesperson || '',
    salespersonId: row.salespersonId || '',
    broker: row.broker || '',
    paymentTerms: row.paymentTerms || '',
    creditDays: row.creditDays !== undefined ? num(row.creditDays) : 0,
    vehicleNo: row.vehicleNo || row.vehicleNumber || '',
    transporter: row.transporter || '',
    dispatchDate: row.dispatchDate || undefined,
    [partyLabel]: row.partyName || row.vendorName || '',
    [`${partyLabel}Id`]: row.partyId || row.vendorId || undefined,
    [`${partyLabel}Gstin`]: row.partyGstin || undefined,
    items: lines,
    lineItems: lines,
    // The UI's own names for the totals the server computed.
    discountTotal: num(row.totalDiscount),
    taxableAmount: num(row.taxableValue),
    tax: num(row.totalTax),
    total,
    grandTotal: total,
    amount: total,
    paidAmount: num(row.amountPaid),
    balanceDue: num(row.balanceDue),
    status: row.displayStatus || row.status,
    finalized: Boolean(row.postedAt),
    ...(numberField ? { [numberField]: serverNumber } : {}),
    ...(numberAlias ? { [numberAlias]: serverNumber || row[numberAlias] } : {}),
    // Server links arrive camelized (`crmDeal`/`crmLead`); the screens read
    // `dealId`/`leadId`. Carry both so a refresh never drops the link that
    // drives the deal-pipeline moves (Draft → Sent → Open → Won/Lost).
    dealId: row.crmDeal || row.dealId || undefined,
    leadId: row.crmLead || row.leadId || undefined,
    _synced: true,
  };
}

/** A sales/purchase document resource, defined by the few things that differ. */
function documentResource(path, {
  partyField = 'partyId',
  partyKeys = ['partyId', 'customerId', 'vendorId', 'partyid'],
  partyLabel = 'customer',
  numberField,
} = {}) {
  return {
    path,
    toApi: (doc, opts) => documentToApi(doc, { partyField, partyKeys }, opts),
    fromApi: (row) => documentFromApi(row, { numberField, partyLabel }),
  };
}

// ── parties ─────────────────────────────────────────────────────────────────

function partyToApi(party) {
  return compact({
    // `code` is deliberately omitted: the server allocates CUST-/VEND- numbers
    // (api.md §1.7) and a client-invented one would collide.
    type: party.type || party.partyType || 'Customer',
    // Nullable on the server; `null` clears a stale classification when the
    // role is edited away from Vendor.
    vendorType: party.vendorType || null,
    // Transporter fleet details — same clear-on-role-change contract.
    vehicleNumber: party.vehicleNumber || null,
    vehicleType: party.vehicleType || null,
    vehicleCapacity:
      party.vehicleCapacity !== undefined && party.vehicleCapacity !== '' && party.vehicleCapacity !== null
        ? num(party.vehicleCapacity)
        : null,
    vehicleCapacityUnit: party.vehicleCapacityUnit || null,
    name: party.name,
    phone: party.phone || undefined,
    email: party.email || undefined,
    gstTreatment: party.gstTreatment || undefined,
    gstin: party.gstin || undefined,
    gstNotes: party.gstNotes || undefined,
    placeOfSupply: stripStateCode(party.placeOfSupply),
    tdsApplicable: party.tdsApplicable ?? undefined,
    tdsSection: party.tdsSection || undefined,
    tdsRate: party.tdsRate ? num(party.tdsRate) : undefined,
    tcsApplicable: party.tcsApplicable ?? undefined,
    tcsRate: party.tcsRate ? num(party.tcsRate) : undefined,
    creditLimit: party.creditLimit !== undefined ? num(party.creditLimit) : undefined,
    paymentTerms: party.paymentTerms || undefined,
    bankAccountNumber: party.bankAccountNumber || undefined,
    ifscCode: party.ifscCode || undefined,
    bankName: party.bankName || undefined,
    accountHolderName: party.accountHolderName || undefined,
    openingBalance: party.openingBalance !== undefined ? num(party.openingBalance) : undefined,
    billingAddress: party.billingAddress || undefined,
    shippingAddress: party.shippingAddress || undefined,
    status: party.status || 'Active',
  });
}

/** The UI writes `Maharashtra (27)`; the column holds the state name alone. */
function stripStateCode(value) {
  if (!value) return undefined;
  return String(value).replace(/\s*\(\d+\)\s*$/, '').trim() || undefined;
}

function partyFromApi(row) {
  return {
    ...row,
    partyType: row.type,
    contactPerson: row.contact_person || row.contacts?.[0]?.name || '',
    _synced: true,
  };
}

/** `customers` and `vendors` are projections of the same table. */
function customerFromParty(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    contactPerson: row.contact_person || row.contacts?.[0]?.name || '',
    email: row.email || '',
    phone: row.phone || '',
    balance: num(row.balance),
    creditLimit: num(row.creditLimit),
    status: row.status === 'Inactive' ? 'On Hold' : (row.status || 'Active'),
    placeOfSupply: row.placeOfSupply,
    gstin: row.gstin,
    // Party detail the sales screens ignore but Administration -> Clients
    // renders: which side of the CRM the account came from, and enough of the
    // tax/address record to show the customer without a second request.
    partyType: row.type || 'Customer',
    leadCount: num(row.leadCount),
    gstTreatment: row.gstTreatment || '',
    billingAddress: row.billingAddress || {},
    shippingAddress: row.shippingAddress || {},
    contacts: row.contacts || [],
    createdAt: row.createdAt || row.created_at || undefined,
    _synced: true,
  };
}

function vendorFromParty(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category || 'General',
    contactPerson: row.contacts?.[0]?.name || '',
    email: row.email || '',
    phone: row.phone || '',
    balance: num(row.balance),
    paymentTerms: row.paymentTerms || '',
    status: row.status === 'Inactive' ? 'Inactive' : 'Active',
    gstin: row.gstin,
    _synced: true,
  };
}

// ── the registry ────────────────────────────────────────────────────────────
//
// Key = the ERPContext state array it feeds. `path` is the collection;
// `pullPath` overrides it when the read uses a narrower endpoint.

export const RESOURCES = {
  parties: {
    path: '/parties/',
    toApi: partyToApi,
    fromApi: partyFromApi,
  },
  customers: {
    path: '/parties/',
    pullPath: '/parties/customers/',
    toApi: (c) => partyToApi({ ...c, type: c.type || 'Customer' }),
    fromApi: customerFromParty,
  },
  vendors: {
    path: '/parties/',
    pullPath: '/parties/vendors/',
    toApi: (v) => partyToApi({ ...v, type: 'Vendor' }),
    fromApi: vendorFromParty,
  },
  categories: {
    path: '/inventory/categories/',
    toApi: (cat) => compact({
      name: cat.name,
      code: cat.code || undefined,
      kind: cat.kind || (cat.hasSubParts ? 'machine' : 'stock'),
      description: cat.description || undefined,
      hasSubParts: cat.hasSubParts ?? undefined,
      leadTimeDays: cat.leadTimeDays !== undefined ? num(cat.leadTimeDays) : undefined,
      defaultHsnCode: cat.defaultHsnCode || undefined,
      customFields: cat.customFields?.length ? cat.customFields : undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },
  units: {
    path: '/inventory/units/',
    toApi: (u) => compact({
      code: u.code,
      label: u.label || u.name || u.code,
      uom_type: u.uomType || u.uom_type || undefined,
      is_base_unit: u.isBaseUnit ?? u.is_base_unit ?? undefined,
      decimal_places: u.decimalPlaces ?? u.decimal_places ?? undefined,
      conversionFactor: u.conversionFactor ?? u.conversion_factor ?? undefined,
      description: u.description || undefined,
      is_active: u.isActive ?? u.is_active ?? undefined,
    }),
    fromApi: (row) => ({
      ...row,
      name: row.label || row.name || row.code,
      uomType: row.uom_type || row.uomType,
      isBaseUnit: row.is_base_unit ?? row.isBaseUnit ?? false,
      decimalPlaces: row.decimal_places ?? row.decimalPlaces ?? 2,
      conversionFactor: row.conversionFactor ?? row.conversion_factor ?? 1,
      isActive: row.is_active ?? row.isActive ?? true,
      _synced: true,
    }),
  },
  fabrics: {
    path: '/inventory/fabrics/',
    toApi: (f) => compact({
      name: f.name,
      code: f.code || undefined,
      description: f.description || undefined,
      isActive: f.isActive ?? f.is_active ?? undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },
  locations: {
    path: '/inventory/locations/',
    toApi: (loc) => compact({
      name: loc.name,
      code: loc.code || undefined,
      type: loc.type || undefined,
      address: loc.address || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      manager: row.manager || 'Operations Lead',
      capacityPct: row.capacityPct ?? 0,
      _synced: true,
    }),
  },
  items: {
    path: '/inventory/items/',
    toApi: (item) => compact({
      sku: item.sku,
      name: item.name,
      description: item.description || undefined,
      categoryId: item.categoryId || undefined,
      itemKind: item.itemKind || 'Fabric',
      uom: item.uom || 'Unit',
      purchaseUnit: item.purchaseUnit || undefined,
      salesUnit: item.salesUnit || undefined,
      unitConversionFactor: num(item.unitConversionFactor, 1),
      // Opening stock only — after creation this is derived from movements
      // (api.md §4.2), so updates never send it.
      availableQty: item.availableQty !== undefined ? num(item.availableQty) : undefined,
      reorderLevel: item.reorderLevel !== undefined ? num(item.reorderLevel) : undefined,
      locationId: item.locationId || undefined,
      lifecycleStatus: item.lifecycleStatus || 'Active',
      costPrice: num(item.costPrice),
      sellingPrice: num(item.sellingPrice),
      hsnCode: item.hsnCode || undefined,
      trackingMode: item.trackingMode || 'Quantity',
      serialNumbers: item.serialNumbers?.length ? item.serialNumbers : undefined,
      isWeightItem: item.isWeightItem ?? undefined,
      theoreticalWeight: item.theoreticalWeight ? num(item.theoreticalWeight) : undefined,
      weightUnit: item.weightUnit || undefined,
      tolerancePct: item.tolerancePct !== undefined ? num(item.tolerancePct) : undefined,
      hasSheetSpec: item.hasSheetSpec ?? undefined,
      sheetHeight: item.sheetHeight ? num(item.sheetHeight) : undefined,
      sheetHeightUnit: item.sheetHeightUnit || undefined,
      sheetWidth: item.sheetWidth ? num(item.sheetWidth) : undefined,
      sheetWidthUnit: item.sheetWidthUnit || undefined,
      sheetLength: item.sheetLength ? num(item.sheetLength) : undefined,
      sheetLengthUnit: item.sheetLengthUnit || undefined,
      sheetWeightKg: item.sheetWeightKg ? num(item.sheetWeightKg) : undefined,
      // Fabric spec — only meaningful for Fabric items; cleared otherwise.
      fabricQuality: item.fabricQuality || null,
      fabricDesign: item.fabricDesign || null,
      fabricColor: item.fabricColor || null,
      fabricWidth:
        item.fabricWidth !== undefined && item.fabricWidth !== '' && item.fabricWidth !== null
          ? num(item.fabricWidth) : null,
      fabricGsm:
        item.fabricGsm !== undefined && item.fabricGsm !== '' && item.fabricGsm !== null
          ? num(item.fabricGsm) : null,
      customFieldValues: item.customFieldValues || undefined,
    }),
    // `availableQty` / `status` come off the movement ledger, so the row the
    fromApi: (row) => ({
      ...row,
      // Fabric is the default kind, but machines must keep their kind or the
      // Machines view is always empty.
      itemKind: row.itemKind === 'Machine' ? 'Machine' : 'Fabric',
      vendor: row.vendor || '',
      fabricQuality: row.fabricQuality || row.fabric_quality || '',
      fabricDesign: row.fabricDesign || row.fabric_design || '',
      fabricColor: row.fabricColor || row.fabric_color || '',
      costPrice: row.costPrice !== undefined ? Number(row.costPrice) : (row.cost_price !== undefined ? Number(row.cost_price) : 0),
      sellingPrice: row.sellingPrice !== undefined ? Number(row.sellingPrice) : (row.selling_price !== undefined ? Number(row.selling_price) : 0),
      reorderLevel: row.reorderLevel !== undefined ? Number(row.reorderLevel) : (row.reorder_level !== undefined ? Number(row.reorder_level) : 0),
      onHandQty: row.onHandQty !== undefined ? Number(row.onHandQty) : (row.on_hand_qty !== undefined ? Number(row.on_hand_qty) : (row.stock !== undefined ? Number(row.stock) : 0)),
      reservedQty: row.reservedQty !== undefined ? Number(row.reservedQty) : (row.reserved_qty !== undefined ? Number(row.reserved_qty) : 0),
      availableQty: row.availableQty !== undefined ? Number(row.availableQty) : (row.available_qty !== undefined ? Number(row.available_qty) : 0),
      _synced: true,
    }),
    omitOnUpdate: ['availableQty', 'serialNumbers'],
  },

  // Sales pipeline (api.md §5)
  quotations: documentResource('/sales/quotations/', { numberField: 'quotationNumber' }),
  salesOrders: documentResource('/sales/orders/', { numberField: 'orderNumber' }),
  proformaInvoices: documentResource('/sales/proforma-invoices/', { numberField: 'piNumber' }),
  deliveryChallans: documentResource('/sales/challans/', { numberField: 'challanNumber' }),
  invoices: (() => {
    const base = documentResource('/sales/invoices/', { numberField: 'invoiceNumber' });
    return {
      ...base,
      // api.md §5.7: an invoice posts as a Draft unless the create says
      // otherwise. The UI decides that up front, so carry the flag through —
      // finalizing is what allocates the number and posts stock and ledger.
      // The flag is only sent when the caller set it: a status-only PATCH
      // must never trigger (or skip) finalization by accident.
      toApi: (doc, opts) => {
        const payload = base.toApi(doc, opts);
        if (doc.finalize !== undefined) payload.finalize = doc.finalize;
        else if (doc.finalized !== undefined) payload.finalize = doc.finalized === true;
        return payload;
      },
    };
  })(),
  salesReturns: documentResource('/sales/returns/', { numberField: 'returnNumber' }),

  // Purchase pipeline (api.md §6) — same documents, `vendorId` on the wire.
  purchaseOrders: documentResource('/purchase/orders/', {
    partyField: 'vendorId', partyLabel: 'vendor', numberField: 'poNumber',
  }),
  purchaseBills: (() => {
    const base = documentResource('/purchase/bills/', {
      partyField: 'vendorId', partyLabel: 'vendor', numberField: 'billNumber',
    });
    return {
      ...base,
      fromApi: (row) => ({
        ...base.fromApi(row),
        purchaseOrderId: row.purchaseOrder || row.purchaseOrderId || undefined,
        billDate: displayIn(row.date),
      }),
    };
  })(),
  vendorBills: {
    path: '/purchase/vendor-bills/',
    toApi: (vb) => compact({
      vendorId: vb.vendorId || undefined,
      billDate: isoOut(vb.billDate || vb.date),
      vendorBillNumber: vb.vendorBillNumber || vb.billNumber || undefined,
      purchaseOrderId: vb.purchaseOrderId || vb.poId || undefined,
      grnId: vb.grnId || undefined,
      attachmentFileId: vb.attachmentFileId || undefined,
      gstPct: vb.gstPct !== undefined ? num(vb.gstPct) : undefined,
      remarks: vb.remarks || vb.notes || undefined,
      lineItems: (vb.lineItems || vb.items || []).map(lineToApi),
    }),
    fromApi: (row) => {
      const lines = (row.lineItems || row.items || []).map(lineFromApi);
      return {
        ...row,
        vendorBillNumber: row.vendorBillNumber || row.billNumber,
        billDate: displayIn(row.billDate),
        date: displayIn(row.billDate || row.date),
        vendor: row.vendorName || row.vendor,
        vendorName: row.vendorName || row.vendor,
        subtotal: num(row.subtotal),
        gstPct: num(row.gstPct),
        gstAmount: num(row.gstAmount),
        total: num(row.total),
        amount: num(row.total),
        status: row.status,
        matchStatus: row.matchStatus,
        items: lines,
        lineItems: lines,
        _synced: true,
      };
    },
  },
  // A debit note is always against one purchase bill; each line names the
  // bill line it returns (the server checks the returnable balance).
  purchaseReturns: (() => {
    const base = documentResource('/purchase/returns/', {
      partyField: 'vendorId', partyLabel: 'vendor', numberField: 'returnNumber',
    });
    return {
      ...base,
      toApi: (ret, opts = {}) => {
        if (opts.partial) return base.toApi(ret, opts);
        return compact({
          vendorId: ret.vendorId || undefined,
          purchaseBillId: ret.billId || ret.purchaseBillId || undefined,
          date: isoOut(ret.date),
          reason: ret.reason || undefined,
          notes: ret.notes || undefined,
          lineItems: (ret.items || ret.lineItems || []).map((line, i) => ({
            ...lineToApi(line, i),
            purchaseBillLineId: line.purchaseBillLineId || undefined,
            returnedQty: num(line.returnedQty ?? line.qty),
          })),
        });
      },
      fromApi: (row) => {
        const doc = base.fromApi(row);
        return {
          ...doc,
          debitNoteNumber: row.debitNoteNumber || row.returnNumber,
          billId: row.purchaseBillId || undefined,
          reason: row.reason || '',
          items: doc.items.map((l) => ({ ...l, qty: num(l.returnedQty ?? l.qty) })),
        };
      },
    };
  })(),

  paymentIns: {
    path: '/sales/payments/',
    toApi: (p) => compact({
      customerId: p.customerId || p.partyId,
      date: isoOut(p.date) || isoOut('Today'),
      amount: num(p.amount),
      mode: p.mode || 'Bank Transfer',
      bankAccountId: p.bankAccountId || undefined,
      referenceNumber: p.reference || p.referenceNumber || undefined,
      notes: p.notes || undefined,
      invoiceId: p.invoiceId || p.linkedInvoiceId || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      date: displayIn(row.date),
      customer: row.customerName,
      reference: row.referenceNumber,
      _synced: true,
    }),
  },
  paymentOuts: {
    path: '/purchase/payments/',
    toApi: (p) => compact({
      vendorId: p.vendorId || p.partyId,
      date: isoOut(p.date),
      amount: num(p.amount),
      mode: p.mode || undefined,
      bankAccountId: p.bankAccountId || undefined,
      referenceNumber: p.reference || p.referenceNumber || undefined,
      notes: p.notes || undefined,
      billId: p.billId || p.linkedBillId || undefined,
    }),
    // What is not allocated to a bill is an advance (vendor_advance_balance
    // on the server works the same way).
    fromApi: (row) => ({
      ...row,
      voucherNumber: row.paymentNumber,
      date: displayIn(row.date),
      vendor: row.vendorName,
      reference: row.referenceNumber,
      amount: num(row.amount),
      allocatedAmount: num(row.allocatedAmount),
      unallocatedAmount: num(row.unallocatedAmount),
      paymentType: num(row.allocatedAmount) > 0 ? 'Final' : 'Advance',
      _synced: true,
    }),
  },
  expenses: {
    path: '/purchase/expenses/',
    toApi: (e) => compact({
      date: isoOut(e.date),
      categoryId: e.categoryId || undefined,
      vendorId: e.vendorId || undefined,
      amount: e.amount !== undefined ? num(e.amount) : undefined,
      taxAmount: e.taxAmount !== undefined ? num(e.taxAmount) : undefined,
      paymentMode: e.paymentMode || e.mode || undefined,
      bankAccountId: e.bankAccountId || undefined,
      notes: e.notes || e.description || undefined,
      referenceNumber: e.reference || e.referenceNumber || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      date: displayIn(row.date),
      category: row.categoryName || '',
      payee: row.vendorName || row.notes || '',
      paidVia: row.paymentMode || '',
      amount: num(row.amount),
      taxAmount: num(row.taxAmount),
      total: num(row.total),
      _synced: true,
    }),
  },

  // ── the rest of the ERP state, which the registry used not to cover ───────

  transfers: {
    path: '/inventory/transfers/',
    // Wire names are sourceLocationId / destLocationId / shipped_by.
    toApi: (t, { partial } = {}) => compact({
      sourceLocationId: t.sourceLocationId || t.fromLocationId || t.fromLocation || undefined,
      destLocationId: t.destLocationId || t.toLocationId || t.toLocation || undefined,
      date: !partial || t.date !== undefined ? isoOut(t.date) : undefined,
      notes: t.notes || undefined,
      status: t.status || undefined,
      shipped_by: t.shipped_by || t.shippedBy || undefined,
      // Each line may carry the selected takas: [{ lotTakaId, qty }].
      items: !partial || t.items !== undefined || t.lineItems !== undefined
        ? (t.items || t.lineItems || []).map((line, i) => ({
          ...lineToApi(line, i),
          takas: Array.isArray(line.takas)
            ? line.takas.map((tk) => ({ lotTakaId: tk.lotTakaId, qty: num(tk.qty) }))
            : undefined,
        })) : undefined,
    }),
    fromApi: (row) => ({
      ...row,
      transferNumber: row.transfer_number,
      shippedBy: row.shipped_by,
      date: displayIn(row.date),
      _synced: true,
    }),
  },

  serviceUsages: {
    path: '/inventory/service-usage/',
    // Wire names are `qty` (quantity) and `date` (used_on).
    toApi: (u) => compact({
      itemId: u.itemId || undefined,
      date: isoOut(u.date),
      qty: num(u.qty ?? u.quantity ?? u.qtyUsed),
      reference: u.reference || undefined,
      jobReference: u.jobReference || u.purpose || undefined,
      technician: u.technician || undefined,
      notes: u.notes || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      qty: row.qty ?? row.quantity ?? 0,
      quantity: row.qty ?? row.quantity ?? 0,
      date: displayIn(row.date),
      _synced: true,
    }),
  },

  valuationItems: {
    path: '/inventory/valuation/',
    fromApi: (row) => ({ ...row, _synced: true }),
  },

  monthEndAudits: {
    path: '/inventory/audits/',
    toApi: (a) => compact({
      period: a.period || undefined,
      locationId: a.locationId || undefined,
      status: a.status || undefined,
      notes: a.notes || undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },

  inventoryMovements: {
    path: '/inventory/movements/',
    fromApi: (row) => ({ ...row, date: displayIn(row.date), _synced: true }),
  },

  faultyParts: {
    path: '/inventory/faulty-parts/',
    // Wire names are `date` (reported_date) and `qty` (quantity); the UI
    // reads `reportedOn`/`quantity`, translated both ways here.
    toApi: (f, { partial } = {}) => compact({
      itemId: f.itemId || undefined,
      qty: (f.qty ?? f.quantity) !== undefined || !partial ? num(f.qty ?? f.quantity) : undefined,
      reason: f.reason || undefined,
      faultDescription: f.faultDescription || f.reason || undefined,
      status: f.status || undefined,
      date: !partial || f.date !== undefined || f.reportedOn !== undefined ? isoOut(f.date || f.reportedOn) : undefined,
    }),
    fromApi: (row) => ({
      ...row,
      qty: row.qty ?? row.quantity ?? 1,
      quantity: row.qty ?? row.quantity ?? 1,
      reportedOn: displayIn(row.date || row.reportedOn),
      date: displayIn(row.date || row.reportedOn),
      _synced: true,
    }),
  },

  zoneRequests: {
    path: '/inventory/zone-requests/',
    // Wire keeps snake_case for target_sector / manager_signoff_needed (no
    // aliases on the serializer); `date` is request_date.
    toApi: (z, { partial } = {}) => {
      const lines = z.lines || (z.itemId
        ? [{ itemId: z.itemId, qty: z.qty ?? z.quantity ?? 1 }]
        : []);
      return compact({
        zoneLocationId: z.zoneLocationId || undefined,
        target_sector: z.target_sector || z.targetSector || z.sector || undefined,
        date: !partial || z.date !== undefined ? isoOut(z.date) : undefined,
        requestedBy: z.requestedBy || undefined,
        status: z.status || undefined,
        notes: z.notes || undefined,
        manager_signoff_needed: z.manager_signoff_needed ?? z.managerSignoffNeeded ?? undefined,
        lines: !partial || z.lines !== undefined || z.itemId !== undefined
          ? lines.map((l) => compact({
            ...(isServerId(l.id) ? { id: l.id } : {}),
            itemId: l.itemId || undefined,
            qty: l.qty ?? l.quantity ?? l.requestedQty ?? 1,
          })) : undefined,
      });
    },
    fromApi: (row) => ({
      ...row,
      date: displayIn(row.date),
      zone: row.zone || '',
      status: row.status || 'Requested',
      _synced: true,
    }),
  },

  itemParts: {
    path: '/inventory/item-parts/',
    toApi: (p) => compact({
      parentItemId: p.parentItemId || undefined,
      partItemId: p.partItemId || undefined,
      requiredQty: p.requiredQty !== undefined ? num(p.requiredQty, 1) : undefined,
    }),
    fromApi: (row) => ({
      ...row,
      parentItemId: row.parentItemId,
      partItemId: row.partItemId,
      requiredQty: num(row.requiredQty, 1),
      _synced: true,
    }),
  },

  qualityStandards: {
    path: '/purchase/quality-standards/',
    toApi: (s) => compact({
      name: s.name,
      categoryId: s.categoryId || undefined,
      checks: Array.isArray(s.checks) ? s.checks : undefined,
      tolerancePct: s.tolerancePct !== undefined ? num(s.tolerancePct) : undefined,
      active: s.active ?? undefined,
    }),
    fromApi: (row) => ({
      ...row,
      tolerancePct: row.tolerancePct ?? row.tolerance_pct ?? 2,
      _synced: true,
    }),
  },

  bankAccounts: {
    path: '/accounts/bank-accounts/',
    toApi: (b) => compact({
      name: b.name || b.accountName,
      accountNumber: b.accountNumber || undefined,
      bankName: b.bankName || undefined,
      ifsc: b.ifsc || undefined,
      branch: b.branch || undefined,
      openingBalance: b.openingBalance !== undefined ? num(b.openingBalance) : undefined,
      isActive: b.isActive ?? undefined,
    }),
    fromApi: (row) => ({
      ...row,
      bankName: row.bank_name || row.bankName || row.name,
      accountNumber: row.account_number || row.accountNumber,
      openingBalance: row.opening_balance ?? row.openingBalance,
      isActive: row.is_active ?? row.isActive,
      isDefault: row.is_default ?? row.isDefault,
      _synced: true,
    }),
  },

  bankTransfers: {
    path: '/accounts/transfers/',
    toApi: (t) => compact({
      fromAccountId: t.fromAccountId || undefined,
      toAccountId: t.toAccountId || undefined,
      date: isoOut(t.date),
      amount: num(t.amount),
      reference: t.reference || undefined,
      notes: t.notes || undefined,
    }),
    fromApi: (row) => ({ ...row, date: displayIn(row.date), _synced: true }),
  },

  journalEntries: {
    path: '/accounts/journal/',
    toApi: (j, { partial } = {}) => compact({
      entryDate: !partial || j.entryDate !== undefined || j.date !== undefined
        ? isoOut(j.entryDate || j.date) : undefined,
      narration: j.narration || j.description || undefined,
      reference: j.reference || undefined,
      lines: !partial || j.lines !== undefined ? j.lines : undefined,
      debitAccount: j.debitAccount || undefined,
      creditAccount: j.creditAccount || undefined,
      amount: j.amount !== undefined && !j.lines ? num(j.amount) : undefined,
      status: j.status || undefined,
    }),
    fromApi: (row) => ({
      ...row,
      date: displayIn(row.entryDate || row.date),
      entryDate: displayIn(row.entryDate || row.date),
      description: row.narration || row.description || '',
      narration: row.narration || '',
      _synced: true,
    }),
  },

  chartOfAccounts: {
    path: '/accounts/chart-of-accounts/',
    toApi: (a) => compact({
      code: a.code,
      name: a.name,
      type: a.type || undefined,
      parentId: a.parentId || undefined,
      isActive: a.isActive ?? undefined,
    }),
    fromApi: (row) => ({ ...row, _synced: true }),
  },
};

/** Every key the pull step knows how to load, in dependency order. */
export const PULL_ORDER = [
  'categories', 'units', 'locations', 'fabrics', 'items',
  'parties', 'customers', 'vendors',
  'quotations', 'salesOrders', 'proformaInvoices',
  'deliveryChallans', 'invoices', 'paymentIns', 'salesReturns',
  'purchaseOrders', 'purchaseBills', 'vendorBills', 'paymentOuts', 'purchaseReturns', 'expenses',
  'transfers', 'serviceUsages', 'valuationItems', 'monthEndAudits',
  'inventoryMovements', 'faultyParts', 'zoneRequests',
  'bankAccounts', 'chartOfAccounts', 'journalEntries',
];

// ── transport ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 200;

/** One key per create attempt; `randomUUID` needs a secure context. */
function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Load one collection. Returns `null` (not `[]`) when the read fails, so the
 * caller can tell "the server has nothing" from "the server did not answer"
 * and leave the existing rows alone in the second case.
 */
export async function pullResource(key) {
  const resource = RESOURCES[key];
  if (!resource) return null;
  try {
    const body = await api.get(resource.pullPath || resource.path, {
      query: { limit: PAGE_SIZE },
    });
    const rows = Array.isArray(body) ? body : (body?.results || []);
    return rows.map(resource.fromApi || ((r) => r));
  } catch (err) {
    console.warn(`[backendSync] pull ${key} failed:`, err?.message || err);
    return null;
  }
}

/**
 * `GET /settings/company-profile/` — a single object, not a collection.
 *
 * Carries the tenant's currency, which decides how every amount on screen is
 * formatted (api.md §1.6), and the state that drives the CGST+SGST vs IGST
 * split on printed documents.
 */
export async function pullCompanyProfile() {
  if (!isBackendEnabled()) return null;
  try {
    const row = await api.get('/settings/company-profile/');
    if (!row) return null;
    const address = row.address || {};
    return {
      name: row.tradeName || row.legalName || '',
      legalName: row.legalName || '',
      gstin: row.gstin || '',
      pan: row.pan || '',
      // The letterhead wants one line; the API stores the parts.
      address: [address.line1, address.line2, address.city, address.state, address.pincode]
        .filter(Boolean).join(', '),
      addressParts: address,
      state: row.state || address.state || '',
      stateCode: row.stateCode || '',
      phone: row.phone || '',
      email: row.email || '',
      currency: row.currency || 'INR',
    };
  } catch (err) {
    console.warn('[backendSync] pull company profile failed:', err?.message || err);
    return null;
  }
}

/**
 * Load everything the registry covers. Failures are per-collection.
 *
 * Thirty collections sent at once is a burst no development server needs to
 * face, and the browser would queue most of them anyway, so this keeps a small
 * number in flight and works through the rest as they land.
 */
export async function pullAll(keys = PULL_ORDER) {
  const settled = await mapWithLimit(
    keys,
    async (key) => [key, await pullResource(key)],
  );
  return Object.fromEntries(settled.filter(([, rows]) => rows !== null));
}

/**
 * Create `record` on the server and return the server's version of it.
 *
 * Resolves to `null` when there is no session — the caller keeps its local
 * record and the app stays usable. A server *rejection* throws, because a
 * document the server refused must not look saved.
 */
export async function pushCreate(key, record, { idempotencyKey } = {}) {
  const resource = RESOURCES[key];
  if (!resource || !isBackendEnabled()) return null;
  // A fresh key per attempt. Its job is to make the client's own retry of a
  // timed-out POST safe (api.md §1.8), not to deduplicate two deliberate
  // creates — deriving it from the local id would reject a legitimate second
  // document whenever an id got reused (mock rows have fixed ones).
  const body = await api.post(resource.path, resource.toApi(record), {
    idempotencyKey: idempotencyKey || newIdempotencyKey(),
  });
  return resource.fromApi ? resource.fromApi(body) : body;
}

export async function pushUpdate(key, id, updates) {
  const resource = RESOURCES[key];
  if (!resource || !isBackendEnabled() || !isServerId(id)) return null;
  const payload = resource.toApi(updates, { partial: true });
  (resource.omitOnUpdate || []).forEach((field) => delete payload[field]);
  const body = await api.patch(`${resource.path}${id}/`, payload);
  return resource.fromApi ? resource.fromApi(body) : body;
}

/**
 * A non-CRUD action on a document (`finalize`, `cancel`, `receive-goods`,
 * `convert-to-*`). Returns the server's document, unwrapping `{ bill }`
 * style envelopes. Rejections throw so the UI can report them.
 */
export async function postDocumentAction(key, id, action, data) {
  const resource = RESOURCES[key];
  if (!resource || !isBackendEnabled() || !isServerId(id)) return null;
  const body = await api.post(`${resource.path}${id}/${action}/`, data || {});
  const doc = body && typeof body === 'object' && body.bill ? body.bill : body;
  const saved = resource.fromApi ? resource.fromApi(doc) : doc;
  return { saved, envelope: body };
}

export async function pushDelete(key, id) {
  const resource = RESOURCES[key];
  if (!resource || !isBackendEnabled() || !isServerId(id)) return null;
  await api.delete(`${resource.path}${id}/`);
  return true;
}

/**
 * Server ids are UUIDs. Anything else is a local `inv-1758…` placeholder that
 * was never persisted — updating or deleting it over HTTP would 404.
 */
export function isServerId(id) {
  return typeof id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** A human-readable reason for a failed push, for the toast. */
export function describeError(err) {
  if (err instanceof ApiError) {
    const fieldErrors = err.payload?.field_errors;
    if (fieldErrors && typeof fieldErrors === 'object') {
      const [field, messages] = Object.entries(fieldErrors)[0] || [];
      if (field) return `${field}: ${[].concat(messages)[0]}`;
    }
    return err.message;
  }
  return err?.message || 'Could not reach the server';
}
