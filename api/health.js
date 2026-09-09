module.exports = (req, res) => {
  res.status(200).json({
    status: 'online',
    platform: 'Collekt Energy Talent & EPC Portal',
    timestamp: new Date().toISOString(),
    deployment: 'Vercel Serverless',
    services: {
      supabase: 'configured',
      paystack: 'connected',
      gemini_ai: process.env.GEMINI_API_KEY ? 'active' : 'fallback_mode'
    }
  });
};