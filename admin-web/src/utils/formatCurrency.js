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
