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

/**
 * Decodes HTML entities (both named and hex/decimal numerical entities)
 * e.g. &#x20;, &#x49;t, &#x47;ood, &#x4C;imited, &amp;, &quot;, &#39;
 *
 * @param {string} str - String potentially containing HTML entities
 * @returns {string} Clean, unescaped plain text string
 */
export function decodeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
