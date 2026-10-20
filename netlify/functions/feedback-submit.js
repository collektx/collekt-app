const { supabase } = require('./lib/supabase-client');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { userId, email, role, milestoneDay, rating, sentiment, feedbackText, tags, promoCode } = payload;

    const feedbackEntry = {
      user_id: userId || null,
      email: email ? String(email).trim().toLowerCase() : null,
      role: role || 'professional',
      milestone_day: Number(milestoneDay) || 15,
      rating: Number(rating) || 5,
      sentiment: sentiment || 'satisfied',
      feedback_text: feedbackText ? String(feedbackText).trim() : '',
      tags: Array.isArray(tags) ? tags : [],
      promo_code: promoCode || null,
      created_at: new Date().toISOString()
    };

    // 1. Save to Supabase platform_feedback table if it exists
    let savedToTable = false;
    if (supabase && typeof supabase.from === 'function') {
      try {
        const { data, error } = await supabase
          .from('platform_feedback')
          .insert([feedbackEntry])
          .select('id');

        if (!error) savedToTable = true;
      } catch (tableErr) {
        // Table might not exist yet; fallback to audit_logs
      }

      // 2. Always persist audit log record for resilience
      try {
        await supabase.from('audit_logs').insert([{
          action: `TRIAL_FEEDBACK_DAY_${feedbackEntry.milestone_day}`,
          entity_type: 'feedback',
          entity_id: userId || email || 'anonymous',
          metadata: feedbackEntry
        }]).select('id');
      } catch (auditErr) {
        console.warn('Feedback audit log note:', auditErr);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Thank you for your feedback! Your thoughts directly guide our platform improvements.',
        feedback: feedbackEntry
      })
    };

  } catch (err) {
    console.error('Feedback submit error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to process feedback submission.' })
    };
  }
};
