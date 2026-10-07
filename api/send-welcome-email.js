/**
 * Vercel Serverless Function entrypoint
 * Forwards to the Netlify handler for unified codebase behavior
 */
const { handler } = require('../netlify/functions/send-welcome-email');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  const event = {
    httpMethod: req.method,
    headers: req.headers || {},
    body: typeof req.body === 'object' ? JSON.stringify(req.body) : req.body
  };

  try {
    const result = await handler(event);
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
      }
    }
    const responseBody = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
    return res.status(result.statusCode || 200).json(responseBody);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Serverless function error' });
  }
};
