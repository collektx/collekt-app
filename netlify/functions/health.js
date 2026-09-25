const { supabase } = require('./lib/supabase-client');
const { corsHeaders, preflightResponse } = require('./lib/cors');
const { enforceRateLimit } = require('./lib/rate-limiter');

const APP_VERSION = 'v107.0';

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    ...corsHeaders(event)
  };

  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse(event);
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ status: 'error', error: 'Method Not Allowed' })
    };
  }

  // Rate limiting to prevent diagnostic endpoint exhaustion (max 120 requests/min per IP)
  const rateCheck = enforceRateLimit(event, {
    action: 'health-check',
    limit: 120,
    windowMs: 60 * 1000,
    customHeaders: headers
  });
  if (!rateCheck.allowed) {
    return rateCheck.response;
  }

  const startTime = Date.now();
  const checks = {
    database: { status: 'unknown', latency_ms: null },
    storage: { status: 'unknown' },
    payment_gateways: {
      paystack: !!process.env.PAYSTACK_SECRET_KEY,
      korapay: !!process.env.KORAPAY_SECRET_KEY,
      opay: !!process.env.OPAY_SECRET_KEY
    }
  };

  let isHealthy = true;

  // 1. Database Connectivity & Latency Check
  const dbStart = Date.now();
  try {
    const { error: dbError } = await supabase
      .from('profiles')
      .select('id', { head: true, count: 'exact' });

    checks.database.latency_ms = Date.now() - dbStart;
    if (dbError) {
      checks.database.status = 'degraded';
      isHealthy = false;
    } else {
      checks.database.status = 'healthy';
    }
  } catch (err) {
    checks.database.status = 'down';
    checks.database.latency_ms = Date.now() - dbStart;
    isHealthy = false;
  }

  // 2. Storage Subsystem Check
  try {
    const { error: storageError } = await supabase.storage
      .from('media')
      .list('', { limit: 1 });

    checks.storage.status = storageError ? 'degraded' : 'healthy';
  } catch (err) {
    checks.storage.status = 'unavailable';
  }

  // 3. System & Memory Telemetry (Sanitized)
  const memory = process.memoryUsage();
  const systemTelemetry = {
    uptime_seconds: Math.floor(process.uptime()),
    node_version: process.version,
    memory_mb: {
      rss: Math.round(memory.rss / (1024 * 1024)),
      heap_used: Math.round(memory.heapUsed / (1024 * 1024)),
      heap_total: Math.round(memory.heapTotal / (1024 * 1024))
    }
  };

  const totalDuration = Date.now() - startTime;
  const overallStatus = isHealthy ? 'healthy' : 'degraded';
  const statusCode = isHealthy ? 200 : 503;

  const responsePayload = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    environment: process.env.NODE_ENV || 'production',
    checks,
    system: systemTelemetry,
    response_time_ms: totalDuration
  };

  return {
    statusCode,
    headers,
    body: JSON.stringify(responsePayload)
  };
};
