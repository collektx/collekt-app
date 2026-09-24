const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ozzwvzxugfaveggeznfa.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96end2enh1Z2ZhdmVnZ2V6bmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjQzODAsImV4cCI6MjEwMDI0MDM4MH0.EjNb197lvdhbhcsYjBOsS-yDRp2wVFun-zjd2no6yh4'
);

function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const signature = req.headers['x-paystack-signature'] || req.headers['X-Paystack-Signature'];
    const secretKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_WEBHOOK_SECRET;

    if (!signature) {
      return res.status(401).json({ error: 'Unauthorized: Missing signature header' });
    }

    if (!secretKey) {
      return res.status(500).json({ error: 'Server configuration error: Webhook secret missing' });
    }

    const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const hash = crypto
      .createHmac('sha512', secretKey)
      .update(bodyStr)
      .digest('hex');

    if (!timingSafeCompare(hash.toLowerCase(), signature.toLowerCase())) {
      return res.status(401).json({ error: 'Unauthorized signature' });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (payload.event === 'charge.success') {
      const data = payload.data;
      const amountInNaira = data.amount / 100;
      const reference = data.reference;

      const { data: existingTxn } = await supabase
        .from('wallet_transactions')
        .select('id')
        .eq('reference', reference)
        .maybeSingle();

      if (existingTxn) {
        return res.status(200).json({ received: true, duplicate: true });
      }

      let userId = data.metadata?.user_id;
      if (!userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', data.customer.email)
          .single();
        if (!profile) {
          return res.status(200).json({ received: true, warning: 'no matching profile' });
        }
        userId = profile.id;
      }

      const { data: wallet } = await supabase
        .from('wallets')
        .select('available_balance, total_deposited')
        .eq('user_id', userId)
        .single();

      if (!wallet) return res.status(200).json({ received: true, warning: 'no wallet found' });

      const balanceBefore = Number(wallet.available_balance || 0);
      const balanceAfter = balanceBefore + amountInNaira;

      await supabase.from('wallet_transactions').insert({
        user_id: userId,
        type: 'DEPOSIT',
        amount: amountInNaira,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: 'SUCCESS',
        reference: reference,
        provider: 'PAYSTACK',
        provider_reference: String(data.id),
        metadata: { channel: data.channel, paid_at: data.paid_at }
      });

      await supabase
        .from('wallets')
        .update({
          available_balance: balanceAfter,
          total_deposited: Number(wallet.total_deposited || 0) + amountInNaira,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Paystack webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
};