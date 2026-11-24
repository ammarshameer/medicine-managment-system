import { useAuth } from '../contexts/AuthContext';

/**
 * Currency configuration with symbols and decimal formatting
 */
export const CURRENCY_MAP = {
  USD: { symbol: '$', name: 'US Dollar', position: 'prefix' },
  AED: { symbol: 'AED ', name: 'UAE Dirham', position: 'prefix' },
  PKR: { symbol: 'Rs. ', name: 'Pakistani Rupee', position: 'prefix' },
  SAR: { symbol: 'SAR ', name: 'Saudi Riyal', position: 'prefix' },
  EUR: { symbol: '€', name: 'Euro', position: 'prefix' },
  GBP: { symbol: '£', name: 'British Pound', position: 'prefix' }
};

/**
 * Pure formatter function
 */
export const formatCurrency = (amount, currencyCode = 'USD') => {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const config = CURRENCY_MAP[currencyCode] || { symbol: `${currencyCode} `, position: 'prefix' };
  
  const formattedNumber = num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return config.position === 'prefix'
    ? `${config.symbol}${formattedNumber}`
    : `${formattedNumber} ${config.symbol}`;
};

/**
 * Format money with Intl so no currency symbol is hardcoded by callers.
 */
export const formatCurrencyIntl = (amount, currencyCode) => {
  const num = Number(amount) || 0;
  const options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

  if (currencyCode && /^[A-Z]{3}$/.test(currencyCode)) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        ...options
      }).format(num);
    } catch (error) {
      // Unknown ISO code: fall through to a plain localized number.
    }
  }

  return new Intl.NumberFormat(undefined, options).format(num);
};

const revenueAmount = (value) => {
  if (value && typeof value === 'object') {
    return Number(
      value.netTotal ?? value.total ?? value.revenue ?? value.totalRevenue ?? value.amount ?? 0
    ) || 0;
  }
  return Number(value) || 0;
};

/**
 * Normalize the revenue shapes returned by the API:
 * - array rows: [{ currency, revenue | netTotal | total, ... }]
 * - currency maps: { USD: 123.45, AED: 67.8 }
 * - legacy scalar: 123.45
 */
export const getCurrencyRevenueRows = (...candidates) => {
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate.map((row, index) => ({
        key: row.currency || row.Currency || index,
        code: row.currency || row.Currency || null,
        amount: revenueAmount(row)
      }));
    }

    if (candidate && typeof candidate === 'object') {
      const entries = Object.entries(candidate);
      if (entries.length > 0) {
        return entries.map(([code, value]) => ({
          key: code,
          code,
          amount: revenueAmount(value)
        }));
      }
    }

    if (typeof candidate === 'number' || typeof candidate === 'string') {
      return [{ key: 'legacy', code: null, amount: Number(candidate) || 0 }];
    }
  }

  return [{ key: 'empty', code: null, amount: 0 }];
};

/**
 * React hook to get currency code and formatting functions for current tenant
 */
export const useCurrency = () => {
  const { user } = useAuth();
  const currencyCode = user?.business?.currency || user?.business?.Currency || 'USD';
  const config = CURRENCY_MAP[currencyCode] || { symbol: `${currencyCode} ` };

  const format = (amount) => formatCurrency(amount, currencyCode);

  return {
    currency: currencyCode,
    symbol: config.symbol,
    formatCurrency: format,
    format
  };
};

export default formatCurrency;
