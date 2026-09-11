---
name: collekt-fintech-qa
description: >-
  Automates testing, simulation, and verification of Collekt's fintech operations:
  Paystack deposit webhooks (HMAC-SHA512), escrow state transitions, milestone releases,
  NUBAN bank transfers, and double-entry ledger balance integrity.
---

# Collekt Fintech QA & Paystack Audit Skill

Use this skill whenever building, modifying, or testing payment workflows, escrow smart contracts, wallet ledgers, or Paystack integrations on Collekt.

## Core Financial Flows & Invariants

1. **Paystack Webhook Verification**:
   - Every incoming Paystack webhook (`charge.success`, `transfer.success`, `transfer.failed`, `transfer.reversed`) must be cryptographically validated using HMAC-SHA512 against `process.env.PAYSTACK_SECRET_KEY`:
     ```javascript
     const crypto = require('crypto');
     const hash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
     if (hash !== event.headers['x-paystack-signature']) {
       return { statusCode: 401, body: 'Invalid signature' };
     }
     ```
   - All webhook handlers must be idempotent: store processed `reference` in `transactions` or `processed_events` and ignore duplicate deliveries.

2. **Escrow State Machine**:
   - Legal states: `PENDING` -> `FUNDED` -> `MILESTONE_IN_PROGRESS` -> `UNDER_REVIEW` -> `RELEASED` (or `DISPUTED` -> `REFUNDED` / `RESOLVED`).
   - Funds must remain locked in the platform escrow account until the buyer approves delivery or an admin dispute resolution is issued.
   - Milestone releases must be atomic: use database transactions (`atomic_debit` or RPC) to decrement escrow and credit the vendor balance in a single commit.

3. **Ledger Balance Integrity (No Negative Balances)**:
   - Always assert `wallet.balance >= amount` before authorizing withdrawals.
   - Check `balance - reserved_escrow >= 0` to prevent users from withdrawing funds that are committed to open contracts.

## Automated Verification Checklist

- [ ] Webhook signature check returns 401 if `x-paystack-signature` is missing or forged.
- [ ] Successful charge correctly credits user wallet and creates an audit transaction log (`type: 'deposit'`).
- [ ] Milestone completion triggers push/in-app notification to both parties.
- [ ] Bank withdrawal resolves destination bank code and account name via Paystack NUBAN verification API before dispatching transfer.
- [ ] Reversal webhook (`transfer.failed` or `transfer.reversed`) automatically refunds user wallet and marks transaction status as `failed`.
