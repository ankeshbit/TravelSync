import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../utils/format';

describe('formatCurrency', () => {
  it('formats USD correctly by default', () => {
    const formatted = formatCurrency(1200);
    expect(formatted).toBe('$1,200.00');
  });

  it('formats specified currency (EUR, GBP, INR)', () => {
    expect(formatCurrency(50.5, 'USD')).toBe('$50.50');
    expect(formatCurrency(100, 'EUR')).toBe('€100.00');
    expect(formatCurrency(250, 'GBP')).toBe('£250.00');
    expect(formatCurrency(1500, 'INR')).toBe('₹1,500.00');
  });

  it('handles 0, null, and invalid inputs gracefully', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
    expect(formatCurrency(null, 'USD')).toBe('$0.00');
    expect(formatCurrency('abc', 'USD')).toBe('$0.00');
  });
});
