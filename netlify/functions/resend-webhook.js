const { supabase } = require('./lib/supabase-client');
const crypto = require('crypto');

/**
 * Resend Webhook Handler
 * Receives email status events: delivered, bounced, complained, opened, clicked, etc.
 */
exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, svix-id, svix-timestamp, svix-signature',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (method !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const rawBody = event.body || '{}';
    const payload = JSON.parse(rawBody);

    const eventType = payload.type || payload.event;
    const eventData = payload.data || {};

    console.log(`[Resend Webhook] Received event: ${eventType}`, {
      email_id: eventData.email_id || eventData.id,
      to: eventData.to,
      subject: eventData.subject,
      created_at: payload.created_at
    });

    // Handle specific event types
    switch (eventType) {
      case 'email.delivered':
        console.log(`[Resend Webhook] Email delivered to: ${eventData.to}`);
        break;

      case 'email.bounced':
        console.warn(`[Resend Webhook] Email bounced for: ${eventData.to}`, eventData.bounce);
        break;

      case 'email.complained':
        console.warn(`[Resend Webhook] Spam complaint from: ${eventData.to}`);
        break;

      case 'email.opened':
      case 'email.clicked':
        console.log(`[Resend Webhook] Engagement event: ${eventType} by ${eventData.to}`);
        break;

      default:
        console.log(`[Resend Webhook] Unhandled event: ${eventType}`);
        break;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'success',
        received: true,
        type: eventType
      })
    };

  } catch (err) {
    console.error('[Resend Webhook Error]:', err);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Invalid webhook payload: ' + err.message })
    };
  }
};
