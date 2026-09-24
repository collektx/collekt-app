/**
 * Collekt CORS Policy Utility
 * OWASP ASVS v4.0 V13.3.1 | CBN Cybersecurity Framework Section 4.1 | ISACA ITAF 5th Edition
 *
 * Centralised, hardened CORS enforcement for all Collekt serverless API functions.
 * NEVER emits Access-Control-Allow-Origin: * — all origins are resolved against an
 * explicit allowlist. Unlisted origins fall back to the primary production domain.
 */

/** Canonical production and development origins allowed to call Collekt APIs. */
const ALLOWED_ORIGINS = [
  'https://collektng.com',
  'https://collektng.xyz',
  'https://main--collektnew.netlify.app',
  'https://collektnew.netlify.app',
  'http://localhost:8888',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

/** Default origin returned for unlisted / attacker origins. Always a concrete domain, never '*'. */
const DEFAULT_ORIGIN = 'https://collektng.com';

/**
 * Resolves the correct Access-Control-Allow-Origin value for an incoming request.
 * Returns the matched origin string if it is in the allowlist, otherwise returns
 * the primary production domain (never '*').
 *
 * @param {object} event - Netlify serverless event
 * @returns {string} Resolved origin string
 */
function resolveOrigin(event) {
  const requestOrigin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  return ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : DEFAULT_ORIGIN;
}

/**
 * Returns the full set of CORS response headers for a given event.
 * All sensitive financial endpoints must use these headers uniformly,
 * including in error (4xx/5xx) and preflight (OPTIONS) response branches.
 *
 * @param {object} event - Netlify serverless event
 * @param {object} [extra] - Additional headers to merge (e.g. Content-Type)
 * @returns {object} Headers object ready for Netlify function response
 */
function corsHeaders(event, extra) {
  return Object.assign(
    {
      'Access-Control-Allow-Origin': resolveOrigin(event),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
      'Content-Type': 'application/json'
    },
    extra || {}
  );
}

/**
 * Returns a ready-made HTTP 200 OPTIONS preflight response.
 * Functions that accept POST/PUT from browser clients must call this
 * at the top of their handler when event.httpMethod === 'OPTIONS'.
 *
 * @param {object} event - Netlify serverless event
 * @returns {object} Netlify function response object
 */
function preflightResponse(event) {
  return {
    statusCode: 200,
    headers: corsHeaders(event),
    body: ''
  };
}

module.exports = { ALLOWED_ORIGINS, DEFAULT_ORIGIN, resolveOrigin, corsHeaders, preflightResponse };
