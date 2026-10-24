// ── Universal Currency & Live Market Exchange Utilities for Evenmore ERP ─────

export const DEFAULT_RATES = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.5,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 154.2
};

export const CURRENCY_CONFIGS = {
  USD: { symbol: '$', rate: 1.0, label: 'USD ($) - United States Dollar', locale: 'en-US', code: 'USD' },
  EUR: { symbol: '€', rate: 0.92, label: 'EUR (€) - Euro', locale: 'de-DE', code: 'EUR' },
  GBP: { symbol: '£', rate: 0.79, label: 'GBP (£) - British Pound', locale: 'en-GB', code: 'GBP' },
  INR: { symbol: '₹', rate: 83.5, label: 'INR (₹) - Indian Rupee', locale: 'en-IN', code: 'INR' },
  CAD: { symbol: 'CA$', rate: 1.36, label: 'CAD ($) - Canadian Dollar', locale: 'en-CA', code: 'CAD' },
  AUD: { symbol: 'AU$', rate: 1.52, label: 'AUD ($) - Australian Dollar', locale: 'en-AU', code: 'AUD' },
  JPY: { symbol: '¥', rate: 154.2, label: 'JPY (¥) - Japanese Yen', locale: 'ja-JP', code: 'JPY' }
};

// Fetch real-time live market exchange rates from open live API
export async function fetchLiveExchangeRates() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    if (data && data.rates) {
      if (data.rates.EUR) CURRENCY_CONFIGS.EUR.rate = data.rates.EUR;
      if (data.rates.GBP) CURRENCY_CONFIGS.GBP.rate = data.rates.GBP;
      if (data.rates.INR) CURRENCY_CONFIGS.INR.rate = data.rates.INR;
      if (data.rates.CAD) CURRENCY_CONFIGS.CAD.rate = data.rates.CAD;
      if (data.rates.AUD) CURRENCY_CONFIGS.AUD.rate = data.rates.AUD;
      if (data.rates.JPY) CURRENCY_CONFIGS.JPY.rate = data.rates.JPY;
      
      const ratesToStore = {
        USD: 1.0,
        EUR: data.rates.EUR || DEFAULT_RATES.EUR,
        GBP: data.rates.GBP || DEFAULT_RATES.GBP,
        INR: data.rates.INR || DEFAULT_RATES.INR,
        CAD: data.rates.CAD || DEFAULT_RATES.CAD,
        lastUpdated: data.time_last_update_utc || new Date().toISOString()
      };
      try {
        localStorage.setItem('evenmore_live_rates', JSON.stringify(ratesToStore));
      } catch (e) {}
      return ratesToStore;
    }
  } catch (err) {
    console.warn('Using cached / baseline exchange rates:', err.message);
  }
  return DEFAULT_RATES;
}

// Load cached live rates on bootstrap
try {
  const cached = localStorage.getItem('evenmore_live_rates');
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed.EUR) CURRENCY_CONFIGS.EUR.rate = parsed.EUR;
    if (parsed.GBP) CURRENCY_CONFIGS.GBP.rate = parsed.GBP;
    if (parsed.INR) CURRENCY_CONFIGS.INR.rate = parsed.INR;
    if (parsed.CAD) CURRENCY_CONFIGS.CAD.rate = parsed.CAD;
  }
} catch (e) {}

// ── Base currency ────────────────────────────────────────────────────────────
//
// The rate tables below are quoted against USD, which was right while every
// amount came from USD-denominated mock data. Amounts now come from the API,
// and api.md §1.6 is explicit that money arrives as a plain number already in
// the tenant's own currency — so converting it against USD would multiply every
// figure on screen by the USD→INR rate. `baseCurrency` is that tenant currency;
// conversions are `target / base`, which makes the common case (display the
// tenant's own currency) exactly 1.
let baseCurrency = 'INR';

/** Set from `companyProfile.currency` once the profile loads. */
export function setBaseCurrency(code) {
  const key = String(code || '').toUpperCase().slice(0, 3);
  if (CURRENCY_CONFIGS[key]) baseCurrency = key;
}

export function getBaseCurrency() {
  return baseCurrency;
}

/** The rate for `code`, preferring a freshly fetched table. */
function rateFor(code, customRates) {
  return (customRates && customRates[code]) || CURRENCY_CONFIGS[code]?.rate || 1;
}

export function getCurrencyConfig(currencyStr = 'INR (₹)', customRates = null) {
  const str = String(currencyStr || baseCurrency).toUpperCase();
  let config = CURRENCY_CONFIGS.USD;

  if (str.includes('INR') || str.includes('₹') || str.includes('RUPEE')) {
    config = { ...CURRENCY_CONFIGS.INR };
    if (customRates?.INR) config.rate = customRates.INR;
  } else if (str.includes('EUR') || str.includes('€') || str.includes('EURO')) {
    config = { ...CURRENCY_CONFIGS.EUR };
    if (customRates?.EUR) config.rate = customRates.EUR;
  } else if (str.includes('GBP') || str.includes('£') || str.includes('POUND')) {
    config = { ...CURRENCY_CONFIGS.GBP };
    if (customRates?.GBP) config.rate = customRates.GBP;
  } else if (str.includes('CAD')) {
    config = { ...CURRENCY_CONFIGS.CAD };
    if (customRates?.CAD) config.rate = customRates.CAD;
  }

  // Re-base: the stored amount is in `baseCurrency`, not USD.
  return { ...config, rate: config.rate / rateFor(baseCurrency, customRates) };
}

export function getCurrencySymbol(currencyStr = 'INR (₹)') {
  return getCurrencyConfig(currencyStr).symbol;
}

export function formatCurrency(amount, currencyStr = 'INR (₹)', options = {}) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const config = getCurrencyConfig(currencyStr, options.customRates);
  const converted = num * config.rate;
  
  const minDecimals = options.minDecimals !== undefined ? options.minDecimals : (options.noDecimals ? 0 : 2);
  const maxDecimals = options.maxDecimals !== undefined ? options.maxDecimals : (options.noDecimals ? 0 : 2);
  
  const isNegative = converted < 0;
  const absVal = Math.abs(converted);

  const formattedNumber = absVal.toLocaleString(config.locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals
  });

  if (options.symbolSuffix) {
    return `${isNegative ? '-' : ''}${formattedNumber} ${config.symbol}`;
  }

  return `${isNegative ? '-' : ''}${config.symbol}${formattedNumber}`;
}
