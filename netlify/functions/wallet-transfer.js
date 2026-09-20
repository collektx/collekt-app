const { supabase } = require('./lib/supabase-client');

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const allowedOrigins = [
    'https://collektng.xyz',
    'https://collektng.com',
    'https://main--collektnew.netlify.app',
    'https://collektnew.netlify.app',
    'http://localhost:8888',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ];
  const allowOrigin = allowedOrigins.includes(origin) ? origin : 'https://collektng.com';

  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const senderId = body.sender_id || body.senderId || body.userId;
    const recipientId = body.recipient_id || body.recipientId || body.proId;
    const amount = parseFloat(body.amount);
    const reference = (body.reference || `TX-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`).trim();
    const projectId = body.project_id || body.projectId || null;
    const proposalId = body.proposal_id || body.proposalId || null;
    const conversationId = body.conversation_id || body.conversationId || null;
    const note = (body.note || 'In-Chat Direct Transfer').trim();

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

    // 2. Call atomic PostgreSQL RPC in Supabase
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

    // 3. Automated System Receipt Message in Conversation
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
            proposal_id: proposalId
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
