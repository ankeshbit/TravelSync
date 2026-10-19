import { describe, it, expect } from 'vitest';
import { getApiUrl, getBaseUrl, stripApiSuffix, safeRedirect } from '../utils/url';

describe('url utilities', () => {
  it('stripApiSuffix removes trailing /api or /api/', () => {
    expect(stripApiSuffix('http://localhost:3000/api')).toBe('http://localhost:3000');
    expect(stripApiSuffix('http://localhost:3000/api/')).toBe('http://localhost:3000');
    expect(stripApiSuffix('http://localhost:3000')).toBe('http://localhost:3000');
    expect(stripApiSuffix('')).toBe('');
  });

  it('getApiUrl returns customUrl if provided', () => {
    expect(getApiUrl('https://custom.api.com/api')).toBe('https://custom.api.com/api');
  });

  it('getBaseUrl strips trailing /api from resolved or provided apiUrl', () => {
    expect(getBaseUrl('https://api.travelsync.com/api')).toBe('https://api.travelsync.com');
    expect(getBaseUrl('https://api.travelsync.com/api/')).toBe('https://api.travelsync.com');
  });

  it('resolves fallback default when env vars are not set', () => {
    const defaultApi = getApiUrl();
    expect(defaultApi).toContain('/api');
    const defaultBase = getBaseUrl();
    expect(defaultBase).not.toMatch(/\/api\/?$/);
  });

  describe('safeRedirect', () => {
    it('accepts safe relative paths starting with single slash', () => {
      expect(safeRedirect('/dashboard')).toBe('/dashboard');
      expect(safeRedirect('/trips/123')).toBe('/trips/123');
      expect(safeRedirect('/trips/123?tab=places#details')).toBe('/trips/123?tab=places#details');
    });

    it('rejects protocol-relative and backslash paths', () => {
      expect(safeRedirect('//evil.com')).toBe('/dashboard');
      expect(safeRedirect('//evil.com/phish')).toBe('/dashboard');
      expect(safeRedirect('/\\evil.com')).toBe('/dashboard');
    });

    it('rejects absolute URLs and schemes', () => {
      expect(safeRedirect('https://evil.com')).toBe('/dashboard');
      expect(safeRedirect('http://evil.com')).toBe('/dashboard');
      expect(safeRedirect('javascript:alert(1)')).toBe('/dashboard');
      expect(safeRedirect('/https://evil.com')).toBe('/dashboard');
    });

    it('falls back on null, undefined, empty, or non-string inputs', () => {
      expect(safeRedirect(null)).toBe('/dashboard');
      expect(safeRedirect(undefined)).toBe('/dashboard');
      expect(safeRedirect('')).toBe('/dashboard');
      expect(safeRedirect('   ')).toBe('/dashboard');
      expect(safeRedirect(123)).toBe('/dashboard');
      expect(safeRedirect({}, '/custom')).toBe('/custom');
    });
  });
});
