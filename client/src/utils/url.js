/**
 * Utility to strip trailing /api or /api/ from a URL
 * @param {string} url
 * @returns {string}
 */
export function stripApiSuffix(url = '') {
  if (!url) return '';
  return url.replace(/\/api\/?$/, '');
}

/**
 * Shared resolver for API URL from environment variables.
 * Resolves VITE_API_BASE_URL || VITE_API_URL || fallback.
 * @param {string} [customUrl]
 * @returns {string}
 */
export function getApiUrl(customUrl) {
  if (customUrl) return customUrl;
  const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
  return env.VITE_API_BASE_URL || env.VITE_API_URL || 'http://localhost:3000/api';
}

export const resolveApiUrl = getApiUrl;

/**
 * Get base server URL by stripping trailing /api from the resolved API URL
 * @param {string} [apiUrl]
 * @returns {string}
 */
export function getBaseUrl(apiUrl = getApiUrl()) {
  return stripApiSuffix(apiUrl);
}

export const resolveBaseUrl = getBaseUrl;

/**
 * Validate and sanitize redirect path.
 * Must start with '/', must not start with '//' or '/\', and contain no scheme.
 * Returns the path if safe, or the fallback (defaults to '/dashboard').
 * @param {string} path
 * @param {string} [fallback='/dashboard']
 * @returns {string}
 */
export function safeRedirect(path, fallback = '/dashboard') {
  if (typeof path !== 'string' || !path.trim()) {
    return fallback;
  }
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || trimmed.includes('://')) {
    return fallback;
  }
  return trimmed;
}
