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

// Live external exchange rate fetching disabled; uses default rates
export async function fetchLiveExchangeRates() {
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
  const str = String(currencyStr || baseCurrency || 'INR').toUpperCase();
  // Always default to Indian Rupee (INR / ₹)
  let config = { ...CURRENCY_CONFIGS.INR };

  if (str.includes('USD') || str === '$') {
    config = { ...CURRENCY_CONFIGS.USD };
    if (customRates?.USD) config.rate = customRates.USD;
  } else if (str.includes('EUR') || str.includes('€') || str.includes('EURO')) {
    config = { ...CURRENCY_CONFIGS.EUR };
    if (customRates?.EUR) config.rate = customRates.EUR;
  } else if (str.includes('GBP') || str.includes('£') || str.includes('POUND')) {
    config = { ...CURRENCY_CONFIGS.GBP };
    if (customRates?.GBP) config.rate = customRates.GBP;
  } else if (str.includes('CAD')) {
    config = { ...CURRENCY_CONFIGS.CAD };
    if (customRates?.CAD) config.rate = customRates.CAD;
  } else {
    config = { ...CURRENCY_CONFIGS.INR };
    if (customRates?.INR) config.rate = customRates.INR;
  }

  // Re-base: the stored amount is in `baseCurrency`, not USD.
  return { ...config, rate: config.rate / rateFor(baseCurrency, customRates) };
}

export function getCurrencySymbol(currencyStr = 'INR (₹)') {
  return getCurrencyConfig(currencyStr).symbol;
}

// Indian compact scale steps: Crore → Lakh → Thousand.
const COMPACT_STEPS = [
  { limit: 10000000, divisor: 10000000, suffix: 'Cr' },
  { limit: 100000, divisor: 100000, suffix: 'L' },
  { limit: 1000, divisor: 1000, suffix: 'K' },
];

export function formatCurrency(amount, currencyStr = 'INR (₹)', options = {}) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const config = getCurrencyConfig(currencyStr, options.customRates);
  const converted = num * config.rate;
  
  const minDecimals = options.minDecimals !== undefined ? options.minDecimals : (options.noDecimals ? 0 : 2);
  const maxDecimals = options.maxDecimals !== undefined ? options.maxDecimals : (options.noDecimals ? 0 : 2);
  
  const isNegative = converted < 0;
  const absVal = Math.abs(converted);

  // Compact Indian scale: ₹51.30L / ₹66.00K / ₹1.25Cr (opt-in via `compact`).
  const step = options.compact ? COMPACT_STEPS.find((s) => absVal >= s.limit) : null;
  const scaledVal = step ? absVal / step.divisor : absVal;

  const formattedNumber = scaledVal.toLocaleString('en-IN', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals
  });
  const suffix = step ? step.suffix : '';

  if (options.symbolSuffix) {
    return `${isNegative ? '-' : ''}${formattedNumber}${suffix} ${config.symbol}`;
  }

  return `${isNegative ? '-' : ''}${config.symbol}${formattedNumber}${suffix}`;
}

/**
 * Compact Indian currency helper: ₹51.30L, ₹5.20L, ₹66.00K, ₹1.10L, ₹22.00K.
 * Thin wrapper over formatCurrency so both share symbol, rate and decimals.
 */
export function formatCompactCurrency(amount, currencyStr = 'INR (₹)', options = {}) {
  return formatCurrency(amount, currencyStr, { ...options, compact: true });
}
