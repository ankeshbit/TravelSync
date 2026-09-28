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
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safeAmount);
  } catch (err) {
    return `${currencyCode} ${safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
