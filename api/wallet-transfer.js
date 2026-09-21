const { supabase } = require('../netlify/functions/lib/supabase-client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, status: 'FAILED', error: 'Authentication required: Missing Bearer token' });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ success: false, status: 'FAILED', error: 'Invalid or expired user session token' });
    }

    const body = req.body || {};
    const senderId = user.id;
    const recipientId = body.recipient_id || body.recipientId || body.proId;
    const amount = parseFloat(body.amount);
    const reference = (body.reference || `TX-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`).trim();
    const projectId = body.project_id || body.projectId || null;
    const proposalId = body.proposal_id || body.proposalId || null;
    const conversationId = body.conversation_id || body.conversationId || null;
    const note = (body.note || 'In-Chat Direct Transfer').trim();

    if (!senderId || !recipientId) {
      return res.status(400).json({ success: false, status: 'FAILED', error: 'Missing sender or recipient identifier.' });
    }

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, status: 'FAILED', error: 'Amount must be a valid positive number.' });
    }

    if (senderId === recipientId) {
      return res.status(400).json({ success: false, status: 'FAILED', error: 'Cannot transfer funds to yourself.' });
    }

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
      return res.status(500).json({
        success: false,
        status: 'FAILED',
        error: rpcError.message || 'Database transaction error during transfer.'
      });
    }

    if (!rpcResult || !rpcResult.success) {
      return res.status(400).json(rpcResult || { success: false, status: 'FAILED', error: 'Transfer failed' });
    }

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

        await supabase.from('conversations').update({
          last_message_preview: `💸 Transferred ₦${amount.toLocaleString('en-NG')}`,
          last_message_at: new Date().toISOString()
        }).eq('id', conversationId);
      } catch (msgErr) {
        console.warn('Receipt message logging notice:', msgErr);
      }
    }

    return res.status(200).json(rpcResult);
  } catch (err) {
    console.error('api/wallet-transfer error:', err);
    return res.status(500).json({ success: false, status: 'FAILED', error: err.message || 'Internal server error.' });
  }
};
