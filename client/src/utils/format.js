const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
]);

/**
 * Formats a monetary amount into a localized currency string using Intl.NumberFormat.
 * 
 * @param {number|string} amount - The amount to format
 * @param {string} [currency='USD'] - The ISO 4217 currency code (e.g. 'USD', 'EUR', 'INR')
 * @returns {string} Formatted currency string (e.g. '$1,200.00', '₹1,200.00')
 */
export function formatCurrency(amount, currency = 'USD') {
  const numericAmount = Number(amount);
  const safeAmount = isNaN(numericAmount) ? 0 : numericAmount;
  const currencyCode = (typeof currency === 'string' && currency.trim())
    ? currency.trim().toUpperCase()
    : 'USD';

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode
    }).format(safeAmount);
  } catch (err) {
    const fractionDigits = ZERO_DECIMAL_CURRENCIES.has(currencyCode) ? 0 : 2;
    return `${currencyCode} ${safeAmount.toLocaleString('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    })}`;
  }
}
