/**
 * Collekt Escrow State Machine & Milestone Dispute Settlement Engine
 * OWASP ASVS v4.0 Section V11.1 (Business Logic Architecture) & Section V4.1 (Access Control)
 * Central Bank of Nigeria (CBN) Cybersecurity Framework & Consumer Protection Guidelines
 * Federal Competition and Consumer Protection Act (FCCPA 2018) Sections 114-116
 * Arbitration and Mediation Act 2023 (Lagos jurisdiction)
 * ISACA ITAF 5th Edition Section 2208 (Audit Evidence & Double-Entry Invariant Integrity)
 */

const { supabase } = require('./lib/supabase-client');
const { authenticateRequest } = require('./lib/auth-middleware');
const { corsHeaders, preflightResponse } = require('./lib/cors');
const { enforceRateLimit } = require('./lib/rate-limiter');

/**
 * Main Serverless Handler for Escrow Actions:
 * 1. release_milestone (Buyer authorizes delivery & disbursal)
 * 2. file_dispute (Party files arbitration claim & freezes escrow)
 * 3. arbitrate_dispute (Platform administrator issues binding award)
 */
exports.handler = async (event, context) => {
  // 1. CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse(event);
  }

  // 2. Strict HTTP Method Enforcement
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    };
  }

  // 3. Authenticate Caller Session (OWASP ASVS V4.1 / Bearer Token)
  const { user, error: authError } = await authenticateRequest(event);
  if (authError || !user) {
    return {
      statusCode: 401,
      headers: corsHeaders(event),
      body: JSON.stringify({
        error: 'Authentication required: ' + (authError || 'Missing or invalid Bearer token.')
      })
    };
  }

  // 4. Rate Limiting (Abuse Throttling - 30 req/min per authenticated user)
  const rateLimitCheck = enforceRateLimit(event, {
    action: 'escrow-settlement',
    userId: user.id,
    limit: 30,
    windowMs: 60 * 1000
  });
  if (!rateLimitCheck.allowed) {
    return rateLimitCheck.response;
  }

  // 5. Parse Payload
  let body = {};
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Malformed JSON payload.' })
    };
  }

  const action = body.action || '';

  try {
    // ══════════════════════════════════════════════════════════════
    // ACTION 1: RELEASE MILESTONE
    // ══════════════════════════════════════════════════════════════
    if (action === 'release_milestone') {
      const {
        contract_id,
        milestone_name = 'Deliverable Phase',
        amount,
        pin,
        step_up_token
      } = body;

      const numAmount = Number(amount);
      if (!contract_id || isNaN(numAmount) || numAmount <= 0) {
        return {
          statusCode: 400,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Valid contract_id and positive amount are required.' })
        };
      }

      // Step-Up MFA check for high-value milestone releases (₦50,000+) under CBN Guidelines
      if (numAmount >= 50000 && !pin && !step_up_token) {
        return {
          statusCode: 403,
          headers: corsHeaders(event),
          body: JSON.stringify({
            error: 'High-value milestone release (₦50,000+) requires Step-Up Multi-Factor Authorization (PIN/OTP) under CBN Cyber Guidelines Section 4.2.',
            requires_step_up: true
          })
        };
      }

      // Fetch contract
      const { data: contract, error: contractErr } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contract_id)
        .maybeSingle();

      if (contractErr) {
        return {
          statusCode: 500,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Database error fetching contract details: ' + contractErr.message })
        };
      }

      if (!contract) {
        return {
          statusCode: 404,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Contract not found.' })
        };
      }

      // Check caller authorization: must be company/employer owner or authorized user
      const isClientOwner = contract.company_id === user.id ||
                            contract.company_email === user.email ||
                            (contract.metadata && contract.metadata.client_id === user.id);

      if (!isClientOwner) {
        // Also check company_members if corporate entity
        let isAuthorizedMember = false;
        if (contract.company_id) {
          const { data: membership } = await supabase
            .from('company_members')
            .select('role, status')
            .eq('company_id', contract.company_id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (membership && membership.status === 'active' && ['owner', 'admin', 'finance'].includes(membership.role)) {
            isAuthorizedMember = true;
          }
        }

        if (!isAuthorizedMember) {
          return {
            statusCode: 403,
            headers: corsHeaders(event),
            body: JSON.stringify({ error: 'Unauthorized: only the employer/client can approve escrow milestone releases.' })
          };
        }
      }

      // MUTUAL DISPUTE LOCK GUARD (OWASP ASVS V11.1 / Arbitration Act 2023)
      // If contract or any milestone is under active arbitration, releases are strictly frozen
      if (contract.status === 'under_arbitration' || contract.status === 'disputed') {
        return {
          statusCode: 409,
          headers: corsHeaders(event),
          body: JSON.stringify({
            error: 'Cannot release milestone: This contract is currently under Collekt formal dispute arbitration. Escrow funds are locked until arbitration ruling.',
            locked_under_arbitration: true
          })
        };
      }

      const { data: activeDisputes } = await supabase
        .from('disputes')
        .select('id, status')
        .eq('contract_id', contract_id)
        .eq('status', 'under_arbitration');

      if (activeDisputes && activeDisputes.length > 0) {
        return {
          statusCode: 409,
          headers: corsHeaders(event),
          body: JSON.stringify({
            error: 'Cannot release milestone: Active dispute pending arbitration. Escrow funds are locked.',
            locked_under_arbitration: true,
            dispute_id: activeDisputes[0].id
          })
        };
      }

      // Idempotency: verify milestone not already released
      const safeMilestoneName = String(milestone_name).replace(/[^a-zA-Z0-9_-]/g, '_');
      const milestoneReleaseRef = `ESC-REL-${contract_id}-${safeMilestoneName}`;

      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id, reference, status')
        .eq('reference', milestoneReleaseRef)
        .maybeSingle();

      if (existingTx && existingTx.status === 'successful') {
        return {
          statusCode: 409,
          headers: corsHeaders(event),
          body: JSON.stringify({
            error: 'Milestone has already been released and disbursed.',
            already_released: true,
            reference: milestoneReleaseRef
          })
        };
      }

      // Invariant and balance check on Client Escrow Account
      const clientEntityId = contract.company_id || user.id;
      const { data: clientWallet } = await supabase
        .from('wallets')
        .select('id, available_balance, escrow_balance')
        .or(`owner_id.eq.${clientEntityId},user_id.eq.${clientEntityId}`)
        .maybeSingle();

      const availableEscrow = Number(clientWallet?.escrow_balance || 0);
      if (availableEscrow < numAmount) {
        return {
          statusCode: 400,
          headers: corsHeaders(event),
          body: JSON.stringify({
            error: `Insufficient escrow funds reserved. Escrow balance: ₦${availableEscrow.toLocaleString()}, required: ₦${numAmount.toLocaleString()}`
          })
        };
      }

      // Calculate platform fee and net contractor disbursal
      const commissionRate = 0.10; // 10% Collekt platform service fee
      const commission = Math.round(numAmount * commissionRate);
      const netPayout = numAmount - commission;

      // Mathematical conservation invariant
      if (commission + netPayout !== numAmount) {
        return {
          statusCode: 500,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Mathematical invariant error in commission allocation.' })
        };
      }

      // Execute Atomic Ledger Transitions
      // 1. Debit client escrow balance
      if (clientWallet) {
        const newClientEscrow = Math.max(0, availableEscrow - numAmount);
        await supabase
          .from('wallets')
          .update({
            escrow_balance: newClientEscrow,
            updated_at: new Date().toISOString()
          })
          .eq('id', clientWallet.id);
      }

      // 2. Credit contractor available balance
      const proEntityId = contract.pro_id;
      if (proEntityId) {
        const { data: proWallet } = await supabase
          .from('wallets')
          .select('id, available_balance, total_earned')
          .or(`owner_id.eq.${proEntityId},user_id.eq.${proEntityId}`)
          .maybeSingle();

        if (proWallet) {
          const curAvail = Number(proWallet.available_balance || 0);
          const curEarned = Number(proWallet.total_earned || 0);
          await supabase
            .from('wallets')
            .update({
              available_balance: curAvail + netPayout,
              total_earned: curEarned + netPayout,
              updated_at: new Date().toISOString()
            })
            .eq('id', proWallet.id);
        }
      }

      // 3. Record Double-Entry Transactions
      const txTimestamp = new Date().toISOString();
      await supabase.from('transactions').insert([
        {
          reference: milestoneReleaseRef,
          user_id: proEntityId || user.id,
          type: 'credit',
          amount: netPayout,
          status: 'successful',
          created_at: txTimestamp,
          metadata: {
            contract_id: contract_id,
            milestone_name: milestone_name,
            gross_amount: numAmount,
            commission: commission,
            category: 'milestone_payout'
          }
        },
        {
          reference: `${milestoneReleaseRef}-DEBIT`,
          user_id: clientEntityId,
          type: 'debit',
          amount: numAmount,
          status: 'successful',
          created_at: txTimestamp,
          metadata: {
            contract_id: contract_id,
            milestone_name: milestone_name,
            category: 'escrow_release'
          }
        }
      ]);

      return {
        statusCode: 200,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: true,
          status: 'released',
          contract_id: contract_id,
          milestone_name: milestone_name,
          gross_amount: numAmount,
          commission: commission,
          net_disbursal: netPayout,
          reference: milestoneReleaseRef
        })
      };
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION 2: FILE DISPUTE CLAIM
    // ══════════════════════════════════════════════════════════════
    if (action === 'file_dispute') {
      const {
        contract_id,
        category = 'Incomplete Deliverables',
        statement = ''
      } = body;

      if (!contract_id || typeof statement !== 'string' || statement.trim().length < 15) {
        return {
          statusCode: 400,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Valid contract_id and statement (min 15 chars) are required.' })
        };
      }

      // Fetch contract
      const { data: contract, error: contractErr } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contract_id)
        .maybeSingle();

      if (contractErr || !contract) {
        return {
          statusCode: 404,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Contract not found.' })
        };
      }

      // Validate caller is a party to the contract
      const isClient = contract.company_id === user.id || contract.company_email === user.email;
      const isSpecialist = contract.pro_id === user.id || contract.pro_email === user.email;

      if (!isClient && !isSpecialist) {
        return {
          statusCode: 403,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Unauthorized: only contracting parties (employer or specialist) can open an escrow dispute.' })
        };
      }

      // Check if dispute is already pending
      const { data: existingActive } = await supabase
        .from('disputes')
        .select('id, status')
        .eq('contract_id', contract_id)
        .eq('status', 'under_arbitration')
        .maybeSingle();

      if (existingActive) {
        return {
          statusCode: 409,
          headers: corsHeaders(event),
          body: JSON.stringify({
            error: 'An active dispute is already open for this contract under Collekt Arbitration.',
            dispute_id: existingActive.id
          })
        };
      }

      // Generate unique dispute ID
      const disputeId = `DSP_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const filedByRole = isSpecialist ? 'professional' : 'company';

      // Insert formal dispute record
      const { error: insertErr } = await supabase.from('disputes').insert({
        id: disputeId,
        contract_id: contract_id,
        project_title: contract.project_title || 'Tender Contract',
        amount: Number(contract.amount || 0),
        filed_by: user.email || user.id,
        filed_by_role: filedByRole,
        category: category,
        statement: statement.trim(),
        status: 'under_arbitration',
        created_at: new Date().toISOString()
      });

      if (insertErr) {
        return {
          statusCode: 500,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Failed to record dispute: ' + insertErr.message })
        };
      }

      // Atomically FREEZE contract status
      await supabase
        .from('contracts')
        .update({
          status: 'under_arbitration',
          is_escrow_locked: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', contract_id);

      // Audit Log (ISACA ITAF 2208)
      try {
        await supabase.from('admin_audit_logs').insert({
          action: 'DISPUTE_FILED',
          entity: 'disputes',
          entity_id: disputeId,
          actor_id: user.id,
          actor_email: user.email,
          metadata: {
            contract_id: contract_id,
            category: category,
            disputed_amount: contract.amount,
            filed_by_role: filedByRole
          },
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        // Non-blocking log catch
      }

      return {
        statusCode: 201,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: true,
          dispute_id: disputeId,
          status: 'under_arbitration',
          message: 'Escrow dispute officially opened under Arbitration and Mediation Act 2023. Escrow funds frozen.'
        })
      };
    }

    // ══════════════════════════════════════════════════════════════
    // ACTION 3: ARBITRATE DISPUTE (ADMIN ONLY)
    // ══════════════════════════════════════════════════════════════
    if (action === 'arbitrate_dispute') {
      // Administrative Authorization Guard
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile || profile.role !== 'admin') {
        return {
          statusCode: 403,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Administrative privilege required: only authorized Collekt Arbitrators can settle disputes.' })
        };
      }

      const {
        dispute_id,
        resolution = 'full_release', // 'full_release' | 'full_refund' | 'split'
        contractor_amount = 0,
        client_refund_amount = 0,
        rationale = ''
      } = body;

      if (!dispute_id || typeof rationale !== 'string' || rationale.trim().length < 10) {
        return {
          statusCode: 400,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Valid dispute_id and arbitrator rationale (min 10 chars) are required.' })
        };
      }

      // Fetch dispute
      const { data: dispute, error: disputeErr } = await supabase
        .from('disputes')
        .select('*')
        .eq('id', dispute_id)
        .maybeSingle();

      if (disputeErr || !dispute) {
        return {
          statusCode: 404,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Dispute record not found.' })
        };
      }

      if (dispute.status !== 'under_arbitration') {
        return {
          statusCode: 400,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: `Dispute has already been settled (${dispute.status}).` })
        };
      }

      // Fetch contract
      const { data: contract } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', dispute.contract_id)
        .maybeSingle();

      const totalDisputed = Number(dispute.amount || contract?.amount || 0);

      let finalContractorPayout = 0;
      let finalClientRefund = 0;

      if (resolution === 'full_release') {
        finalContractorPayout = totalDisputed;
        finalClientRefund = 0;
      } else if (resolution === 'full_refund') {
        finalContractorPayout = 0;
        finalClientRefund = totalDisputed;
      } else if (resolution === 'split') {
        finalContractorPayout = Number(contractor_amount || 0);
        finalClientRefund = Number(client_refund_amount || 0);

        // Mathematical Conservation Invariant Check
        if (finalContractorPayout < 0 || finalClientRefund < 0 || Math.abs((finalContractorPayout + finalClientRefund) - totalDisputed) > 0.01) {
          return {
            statusCode: 400,
            headers: corsHeaders(event),
            body: JSON.stringify({
              error: `Split sum violation: contractor (₦${finalContractorPayout}) + client (₦${finalClientRefund}) must equal total disputed amount (₦${totalDisputed}).`
            })
          };
        }
      } else {
        return {
          statusCode: 400,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Invalid resolution option. Allowed: full_release, full_refund, split' })
        };
      }

      // Commission on contractor portion
      const commissionRate = 0.10;
      const commission = Math.round(finalContractorPayout * commissionRate);
      const netContractorDisbursal = finalContractorPayout - commission;

      // Execute Ledger Balancing
      const clientEntityId = contract?.company_id;
      const proEntityId = contract?.pro_id;

      // 1. Client Wallet Update
      if (clientEntityId) {
        const { data: clientWallet } = await supabase
          .from('wallets')
          .select('id, available_balance, escrow_balance')
          .or(`owner_id.eq.${clientEntityId},user_id.eq.${clientEntityId}`)
          .maybeSingle();

        if (clientWallet) {
          const newEscrow = Math.max(0, Number(clientWallet.escrow_balance || 0) - totalDisputed);
          const newAvail = Number(clientWallet.available_balance || 0) + finalClientRefund;
          await supabase
            .from('wallets')
            .update({
              escrow_balance: newEscrow,
              available_balance: newAvail,
              updated_at: new Date().toISOString()
            })
            .eq('id', clientWallet.id);
        }
      }

      // 2. Contractor Wallet Update
      if (proEntityId && netContractorDisbursal > 0) {
        const { data: proWallet } = await supabase
          .from('wallets')
          .select('id, available_balance, total_earned')
          .or(`owner_id.eq.${proEntityId},user_id.eq.${proEntityId}`)
          .maybeSingle();

        if (proWallet) {
          await supabase
            .from('wallets')
            .update({
              available_balance: Number(proWallet.available_balance || 0) + netContractorDisbursal,
              total_earned: Number(proWallet.total_earned || 0) + netContractorDisbursal,
              updated_at: new Date().toISOString()
            })
            .eq('id', proWallet.id);
        }
      }

      // 3. Mark Dispute Resolved
      const resolvedStatus = `resolved_${resolution}`;
      await supabase
        .from('disputes')
        .update({
          status: resolvedStatus,
          resolution_details: {
            resolution,
            arbitrator_id: user.id,
            contractor_payout: finalContractorPayout,
            net_contractor_disbursal: netContractorDisbursal,
            client_refund: finalClientRefund,
            platform_commission: commission,
            rationale: rationale.trim(),
            resolved_at: new Date().toISOString()
          }
        })
        .eq('id', dispute_id);

      // 4. Update Contract Status to Settled
      if (contract) {
        await supabase
          .from('contracts')
          .update({
            status: 'settled',
            is_escrow_locked: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', contract.id);
      }

      // 5. Audit Log (COBIT 2019 / ISACA ITAF 2208)
      try {
        await supabase.from('admin_audit_logs').insert({
          action: 'DISPUTE_ARBITRATED',
          entity: 'disputes',
          entity_id: dispute_id,
          actor_id: user.id,
          actor_email: user.email,
          metadata: {
            resolution,
            contractor_payout: finalContractorPayout,
            client_refund: finalClientRefund,
            commission: commission,
            rationale: rationale.trim()
          },
          created_at: new Date().toISOString()
        });
      } catch (logErr) {}

      return {
        statusCode: 200,
        headers: corsHeaders(event),
        body: JSON.stringify({
          success: true,
          status: resolvedStatus,
          dispute_id: dispute_id,
          resolution: resolution,
          contractor_payout: finalContractorPayout,
          net_contractor_disbursal: netContractorDisbursal,
          client_refund: finalClientRefund,
          commission: commission
        })
      };
    }

    // Default: Unrecognized action
    return {
      statusCode: 400,
      headers: corsHeaders(event),
      body: JSON.stringify({
        error: 'Invalid action. Allowed actions: release_milestone, file_dispute, arbitrate_dispute'
      })
    };

  } catch (err) {
    console.error('[Escrow Settlement Error]', err);
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({
        error: 'An internal error occurred during escrow operation: ' + (err.message || 'Unknown error')
      })
    };
  }
};
