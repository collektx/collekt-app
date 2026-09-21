/**
 * Shared CORS Utility — netlify/functions/lib/cors.js
 *
 * OWASP ASVS v4.0 V13.3.1 / CBN Cybersecurity Framework Section 4.1
 * ISACA ITAF 5th Edition / NDPA 2023 Section 24
 *
 * Centralised origin allowlist for all Collekt serverless API functions.
 * Never emits a wildcard Access-Control-Allow-Origin: * header.
 * All unapproved origins fall back to the primary production domain.
 */

'use strict';

const ALLOWED_ORIGINS = [
  'https://collektng.com',
  'https://collektng.xyz',
  'https://main--collektnew.netlify.app',
  'https://collektnew.netlify.app',
  'http://localhost:8888',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

const DEFAULT_ORIGIN = 'https://collektng.com';

/**
 * Resolves the request's Origin header to an allowed origin string.
 * Returns the matched origin or the default production domain — never '*'.
 * @param {object} event - Netlify function event object
 * @returns {string} The allowed origin
 */
function resolveOrigin(event) {
  const requestOrigin = (
    event.headers?.origin ||
    event.headers?.Origin ||
    ''
  ).trim();

  return ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : DEFAULT_ORIGIN;
}

/**
 * Returns CORS response headers for a given request event.
 * Always includes Content-Type, Vary: Origin, and Access-Control-Allow-Credentials.
 * @param {object} event - Netlify function event object
 * @returns {object} HTTP headers object
 */
function corsHeaders(event) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': resolveOrigin(event),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  };
}

/**
 * Returns a complete HTTP 200 OPTIONS preflight response.
 * @param {object} event - Netlify function event object
 * @returns {object} Netlify function response object
 */
function preflightResponse(event) {
  return {
    statusCode: 200,
    headers: corsHeaders(event),
    body: ''
  };
}

module.exports = { ALLOWED_ORIGINS, resolveOrigin, corsHeaders, preflightResponse };
