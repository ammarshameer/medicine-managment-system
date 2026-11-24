import { useAuth } from '../contexts/AuthContext';

export const getBusinessCurrency = (user) => user?.business?.currency || 'USD';
export const getBusinessLocale = (user) => user?.business?.locale || 'en-US';

/**
 * Format an amount with the business currency/locale (admin-web uses the same rule).
 * Falls back to a plain code + amount on runtimes without full Intl support.
 */
export const formatCurrency = (amount, currency = 'USD', locale) => {
  const value = Number(amount);
  const safeValue = Number.isFinite(value) ? value : 0;

  if (typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function') {
    const candidates = [locale, 'en-US'].filter(Boolean);
    for (let i = 0; i < candidates.length; i += 1) {
      try {
        return new Intl.NumberFormat(candidates[i], {
          style: 'currency',
          currency,
        }).format(safeValue);
      } catch (error) {
        // Try the next locale, then fall back below.
      }
    }
  }

  return `${currency} ${safeValue.toFixed(2)}`;
};

/** Convenience hook that reads currency/locale from the authenticated business. */
export const useFormatCurrency = () => {
  const { user } = useAuth();
  const currency = getBusinessCurrency(user);
  const locale = getBusinessLocale(user);

  return (amount, options = {}) => formatCurrency(
    amount,
    options.currency || currency,
    options.locale || locale
  );
};
