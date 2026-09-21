/**
 * Collekt Serverless API Rate Limiter & Abuse Throttling Engine
 * Compliant with OWASP API Security Top 10 (API4:2023 - Unrestricted Resource Consumption)
 * and Central Bank of Nigeria (CBN) Cybersecurity Guidelines Section 4.2.
 */

// In-memory request ledger: Map<string, number[]>
const requestWindows = new Map();

// Periodic prune interval (every 2 minutes) to ensure zero memory leaks
const PRUNE_INTERVAL_MS = 2 * 60 * 1000;
let lastPruneTime = Date.now();

function pruneExpiredEntries(maxWindowMs = 60 * 1000) {
  const now = Date.now();
  if (now - lastPruneTime < PRUNE_INTERVAL_MS) return;
  lastPruneTime = now;

  for (const [key, timestamps] of requestWindows.entries()) {
    const valid = timestamps.filter(t => now - t <= maxWindowMs);
    if (valid.length === 0) {
      requestWindows.delete(key);
    } else {
      requestWindows.set(key, valid);
    }
  }
}

/**
 * Extract client IP address from Netlify / multi-proxy request headers
 * @param {object} event - Netlify serverless invocation event
 * @returns {string} - Resolved client IP address
 */
function getClientIp(event) {
  if (!event || !event.headers) return '127.0.0.1';
  const headers = event.headers;
  
  const rawIp = headers['x-nf-client-connection-ip'] ||
                headers['cf-connecting-ip'] ||
                headers['x-client-ip'] ||
                headers['client-ip'] ||
                headers['x-forwarded-for'] ||
                headers['x-real-ip'] ||
                '127.0.0.1';

  // If x-forwarded-for contains a chain of IPs, extract the first (client) IP
  return rawIp.split(',')[0].trim();
}

/**
 * Check if a request exceeds rate limiting thresholds
 * 
 * @param {object} params
 * @param {string} params.key - Unique rate-limiting key (e.g. "wallet-transfer:usr_123")
 * @param {number} [params.limit=10] - Maximum permitted requests in windowMs
 * @param {number} [params.windowMs=60000] - Sliding window duration in milliseconds (default 1 min)
 * @param {number} [params.burstLimit=0] - Optional burst limit (e.g. 3 requests)
 * @param {number} [params.burstMs=5000] - Optional burst window in milliseconds (default 5s)
 * @returns {{ allowed: boolean, current: number, limit: number, remaining: number, resetTime: number, retryAfter: number }}
 */
function checkRateLimit({
  key,
  limit = 10,
  windowMs = 60 * 1000,
  burstLimit = 0,
  burstMs = 5 * 1000
}) {
  const now = Date.now();
  pruneExpiredEntries(windowMs);

  let timestamps = requestWindows.get(key) || [];
  // Filter out timestamps outside the sliding window
  timestamps = timestamps.filter(t => now - t <= windowMs);

  // Check burst limit if configured
  if (burstLimit > 0) {
    const burstCount = timestamps.filter(t => now - t <= burstMs).length;
    if (burstCount >= burstLimit) {
      const earliestBurst = timestamps.filter(t => now - t <= burstMs)[0];
      const retryAfter = Math.max(1, Math.ceil((burstMs - (now - earliestBurst)) / 1000));
      return {
        allowed: false,
        current: burstCount + 1,
        limit: burstLimit,
        remaining: 0,
        resetTime: Math.ceil((now + retryAfter * 1000) / 1000),
        retryAfter,
        reason: 'BURST_LIMIT_EXCEEDED'
      };
    }
  }

  // Check sliding window limit
  if (timestamps.length >= limit) {
    const earliestInWindow = timestamps[0];
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - earliestInWindow)) / 1000));
    return {
      allowed: false,
      current: timestamps.length + 1,
      limit,
      remaining: 0,
      resetTime: Math.ceil((now + retryAfter * 1000) / 1000),
      retryAfter,
      reason: 'WINDOW_LIMIT_EXCEEDED'
    };
  }

  // Record this request
  timestamps.push(now);
  requestWindows.set(key, timestamps);

  const remaining = Math.max(0, limit - timestamps.length);
  const resetTime = Math.ceil((now + windowMs) / 1000);

  return {
    allowed: true,
    current: timestamps.length,
    limit,
    remaining,
    resetTime,
    retryAfter: 0
  };
}

/**
 * Helper to check rate limit and return standard Netlify HTTP 429 response if throttled
 * 
 * @param {object} event - Netlify event object
 * @param {object} config - Configuration options
 * @param {string} config.action - Action name e.g. "wallet-transfer"
 * @param {string} [config.userId] - Optional authenticated user ID
 * @param {number} [config.limit=10] - Max requests
 * @param {number} [config.windowMs=60000] - Window duration
 * @param {number} [config.burstLimit=0] - Max burst
 * @param {number} [config.burstMs=5000] - Burst window
 * @param {object} [config.customHeaders={}] - Additional response headers
 * @returns {{ allowed: boolean, rateLimit: object, response?: object }}
 */
function enforceRateLimit(event, config = {}) {
  const {
    action = 'api',
    userId = null,
    limit = 10,
    windowMs = 60 * 1000,
    burstLimit = 0,
    burstMs = 5 * 1000,
    customHeaders = {}
  } = config;

  const clientIp = getClientIp(event);
  // Prioritize authenticated userId key, fall back to client IP
  const rateLimitKey = userId ? `${action}:user:${userId}` : `${action}:ip:${clientIp}`;

  const rateLimit = checkRateLimit({
    key: rateLimitKey,
    limit,
    windowMs,
    burstLimit,
    burstMs
  });

  if (!rateLimit.allowed) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': event.headers.origin || '*',
      'Retry-After': String(rateLimit.retryAfter),
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(rateLimit.resetTime)
    };

    return {
      allowed: false,
      rateLimit,
      response: {
        statusCode: 429,
        headers: Object.assign(defaultHeaders, customHeaders),
        body: JSON.stringify({
          success: false,
          status: 'FAILED',
          error: 'Too Many Requests',
          message: `Rate limit exceeded for ${action}. Please retry in ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter,
          limit: rateLimit.limit
        })
      }
    };
  }

  return {
    allowed: true,
    rateLimit
  };
}

/**
 * Reset memory store (primarily for unit test cleanups)
 */
function resetRateLimiterStore() {
  requestWindows.clear();
}

module.exports = {
  checkRateLimit,
  enforceRateLimit,
  getClientIp,
  resetRateLimiterStore
};
