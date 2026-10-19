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
 * Get base server URL by stripping trailing /api from VITE_API_BASE_URL
 * @param {string} [apiUrl]
 * @returns {string}
 */
export function getBaseUrl(apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api') {
  return stripApiSuffix(apiUrl);
}
