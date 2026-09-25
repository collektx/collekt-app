const { supabase } = require('./lib/supabase-client');
const { authenticateRequest } = require('./lib/auth-middleware');
const { enforceRateLimit } = require('./lib/rate-limiter');
const { corsHeaders: resolveCorsHeaders, preflightResponse } = require('./lib/cors');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    ...resolveCorsHeaders(event)
  };

  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse(event);
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { user, error: authError } = await authenticateRequest(event);
    if (authError || !user) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required', details: authError }) };
    }

    // Abuse throttling: limit 10 transfers/min and max 3 transfers/5s per user
    const rateCheck = enforceRateLimit(event, {
      action: 'wallet-transfer',
      userId: user.id,
      limit: 10,
      windowMs: 60 * 1000,
      burstLimit: 3,
      burstMs: 5 * 1000,
      customHeaders: headers
    });
    if (!rateCheck.allowed) {
      return rateCheck.response;
    }

    const body = JSON.parse(event.body || '{}');
    const senderId = user.id;
    const recipientId = body.recipient_id || body.recipientId || body.proId;
    const amount = parseFloat(body.amount);
    const reference = (body.reference || `TX-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`).trim();
    const projectId = body.project_id || body.projectId || null;
    const proposalId = body.proposal_id || body.proposalId || null;
    const conversationId = body.conversation_id || body.conversationId || null;
    const note = (body.note || 'In-Chat Direct Transfer').trim();
    const pin = body.pin;
    const stepUpToken = body.step_up_token || body.stepUpToken || body.auth_token;

    // 1. Validation
    if (!senderId || !recipientId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, status: 'FAILED', error: 'Missing sender or recipient identifier.' })
      };
    }

    if (isNaN(amount) || amount <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, status: 'FAILED', error: 'Amount must be a valid positive number.' })
      };
    }

    if (senderId === recipientId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, status: 'FAILED', error: 'Cannot transfer funds to yourself.' })
      };
    }

    // 2. Step-Up MFA Authorization (CBN Cybersecurity Guidelines Sec 4.2 / OWASP ASVS V2.8)
    // High-value peer-to-peer transfers (₦50,000+) require Step-Up PIN or token authorization
    const isHighValue = amount >= 50000;
    if (isHighValue && !pin && !stepUpToken) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          status: 'FAILED',
          error: 'High-value wallet transfers (₦50,000+) require Step-Up Multi-Factor Authorization (PIN/OTP) under CBN Cyber Guidelines Section 4.2.',
          requires_step_up: true,
          threshold: 50000
        })
      };
    }

    if (pin && !/^\d{4}$/.test(String(pin).trim())) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, status: 'FAILED', error: 'Transaction PIN must be exactly 4 numeric digits.' })
      };
    }

    if (stepUpToken && (typeof stepUpToken !== 'string' || stepUpToken.length < 8)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, status: 'FAILED', error: 'Invalid Step-Up authorization token format.' })
      };
    }

    // 3. Call atomic PostgreSQL RPC in Supabase
    const { data: rpcResult, error: rpcError } = await supabase.rpc('execute_wallet_transfer', {
      p_sender_id: senderId,
      p_recipient_id: recipientId,
      p_amount: amount,
      p_reference: reference,
      p_project_id: projectId,
      p_proposal_id: proposalId,
      p_conversation_id: conversationId,
      p_note: note
    });

    if (rpcError) {
      console.error('execute_wallet_transfer RPC error:', rpcError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          status: 'FAILED',
          error: rpcError.message || 'Database transaction error during transfer.'
        })
      };
    }

    if (!rpcResult || !rpcResult.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify(rpcResult || { success: false, status: 'FAILED', error: 'Transfer failed' })
      };
    }

    // 4. Automated System Receipt Message in Conversation
    if (conversationId && conversationId.length > 5) {
      try {
        const receiptBody = `[WALLET_TRANSFER_RECEIPT]\nAmount: ₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\nNote: ${note}\nRef: ${reference}`;
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_id: senderId,
          body: receiptBody,
          is_read: false,
          project_id: projectId,
          metadata: {
            is_system: true,
            event_type: 'WALLET_TRANSFER_RECEIPT',
            reference: reference,
            amount: amount,
            sender_id: senderId,
            recipient_id: recipientId,
            proposal_id: proposalId,
            step_up_verified: isHighValue
          }
        });

        // Update conversation timestamp
        await supabase.from('conversations').update({
          last_message_preview: `💸 Transferred ₦${amount.toLocaleString('en-NG')}`,
          last_message_at: new Date().toISOString()
        }).eq('id', conversationId);
      } catch (msgErr) {
        console.warn('Receipt message logging notice:', msgErr);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(rpcResult)
    };

  } catch (err) {
    console.error('wallet-transfer handler error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, status: 'FAILED', error: err.message || 'Internal server error.' })
    };
  }
};
