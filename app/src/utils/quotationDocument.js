const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function quotationTotals(quote) {
  const items = quote.items || [];
  const subtotal = items.reduce((sum, item) => sum + number(item.qty) * number(item.rate), 0);
  const discount = items.reduce((sum, item) => sum + number(item.qty) * number(item.rate) * number(item.discount) / 100, 0);
  const tax = items.reduce((sum, item) => sum + number(item.qty) * number(item.rate) * (1 - number(item.discount) / 100) * number(item.tax) / 100, 0);
  const freight = number(quote.freight);
  return { subtotal, discount, tax, freight, total: quote.amount != null ? number(quote.amount) : subtotal - discount + tax + freight };
}

// Explicit customer-facing projection. Never publish CRM notes, costs, balances or contacts.
export function publicQuotation(quote, currency = 'USD') {
  const fields = ['quoteNumber', 'date', 'validUntil', 'customer', 'amount', 'freight', 'terms', 'termsAndConditions', 'dealReference'];
  const result = Object.fromEntries(fields.filter(key => quote[key] != null).map(key => [key, quote[key]]));
  result.currency = currency;
  if (quote.billingAddress) {
    result.billingAddress = typeof quote.billingAddress === 'string' ? { line1: quote.billingAddress } :
      Object.fromEntries(['line1', 'line2', 'city', 'state', 'pincode', 'country'].filter(key => typeof quote.billingAddress[key] === 'string').map(key => [key, quote.billingAddress[key]]));
  }
  result.items = (quote.items || []).map(item => Object.fromEntries(
    ['name', 'description', 'qty', 'rate', 'amount', 'discount', 'tax'].filter(key => item[key] != null).map(key => [key, item[key]])
  ));
  return result;
}
