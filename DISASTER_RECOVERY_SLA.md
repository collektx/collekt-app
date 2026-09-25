# Collekt NG — Disaster Recovery & Business Continuity SLA (DSS04 / ITAF 2208)

**Document Control:**
- **Standard**: COBIT 2019 DSS04 (Managed Continuity), ISACA ITAF 5th Edition Section 2208, Central Bank of Nigeria (CBN) Cybersecurity Framework Section 4.3, NDPA 2023 Section 39.
- **Classification**: Confidential — Internal Security & Audit Specification
- **Version**: 1.0 (v107.0 Release)
- **Effective Date**: September 2026
- **Review Cycle**: Annual / Post-Incident Audit

---

## 1. Executive Summary & Objective

This document defines the formal Business Continuity Management (BCM) and Disaster Recovery (DR) Service Level Agreements (SLAs), recovery objectives, architecture resilience, and step-by-step incident response runbooks for **Collekt NG** (`collektng.com`).

The primary objective is to guarantee the continuous availability, confidentiality, and data integrity of all financial transactions, peer-to-peer wallet balances, escrow agreements, KYC documents, and user profile data against catastrophic infrastructure loss, provider outages, cyberattacks, or physical regional disasters.

---

## 2. Formal Service Level Agreements (SLAs)

Under COBIT 2019 DSS04 and CBN Cybersecurity Guidelines Section 4.3, Collekt establishes the following audited recovery targets:

| Metric | Target SLA | Target Definition | Realized Architecture Mechanism |
| :--- | :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **&le; 15 Minutes** | Maximum allowable data loss measured in time. | Supabase continuous Write-Ahead Log (WAL) archiving, daily Point-in-Time Recovery (PITR) snapshots, and immutable append-only ledger (`wallet_ledger`). |
| **Recovery Time Objective (RTO)** | **&le; 30 Minutes** | Maximum allowable platform downtime to full restoration. | Instant immutable Netlify atomic deployments, serverless distributed compute, automated health checks, and quick-rollback capabilities. |
| **Service Availability SLA** | **99.9% Uptime** | Maximum unplanned monthly downtime: &le; 43.8 minutes. | Multi-region Anycast Netlify Edge CDN + Supavisor pooler + managed Supabase infrastructure. |
| **Health Check Latency Threshold** | **&le; 500 ms** | Diagnostic ping response time before alerting. | Monitored continuously via `/api/health` and `/api/status`. |

---

## 3. High Availability & Resilient Architecture

Collekt is architected on a modern, decoupled serverless and distributed cloud framework designed to avoid single points of failure (SPOF):

```
                        ┌──────────────────────────────────────────────┐
                        │              Internet Users                  │
                        └──────────────────────┬───────────────────────┘
                                               │
                                               ▼
                        ┌──────────────────────────────────────────────┐
                        │      Netlify Global Anycast Edge CDN         │
                        │    (Atomic Deploys, Auto-Rollback, DDoS)     │
                        └──────────────┬───────────────────────────────┘
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 ▼                                           ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│     Static Assets & HTML5       │         │   Serverless API Microservices  │
│  (Universal Cache-Busted CDN)   │         │ (Node.js 18+ Edge Functions)   │
└─────────────────────────────────┘         └────────────────┬────────────────┘
                                                             │
                                                             ▼
                                            ┌─────────────────────────────────┐
                                            │   Supabase Managed Platform     │
                                            │  - Supavisor Connection Pooler  │
                                            │  - PostgreSQL 15+ Engine        │
                                            │  - Continuous WAL Archiving     │
                                            │  - Encrypted Private Storage    │
                                            └────────────────┬────────────────┘
                                                             │
                                     ┌───────────────────────┴───────────────────────┐
                                     ▼                                               ▼
                      ┌─────────────────────────────┐                 ┌─────────────────────────────┐
                      │    Primary Payment Rails    │                 │   Secondary Payment Rails   │
                      │      (Paystack NUBAN)       │                 │       (Korapay / OPay)      │
                      └─────────────────────────────┘                 └─────────────────────────────┘
```

1. **Frontend & Edge Tier**:
   - Hosted on Netlify's globally distributed Edge Network.
   - Deployments are fully atomic: every change generates an immutable Deploy ID. If any degradation occurs, Netlify allows instant, sub-minute rollback to a previous valid deploy.
2. **Compute Tier**:
   - Serverless Functions located in `netlify/functions/*` scale horizontally on demand.
   - Built-in rate limiting (`lib/rate-limiter.js`) protects compute capacity against brute-force DDoS.
3. **Database Tier**:
   - Hosted on managed Supabase (PostgreSQL 15+).
   - Write-Ahead Logging (WAL) captures all state transitions in real time, supporting sub-second Point-in-Time Recovery.
   - Immutable double-entry bookkeeping (`public.wallet_ledger`) prevents ledger corruption.
4. **Payment Rail Redundancy**:
   - Dual payment processing capabilities (Paystack as primary, Korapay/OPAY as fallback).
   - Automatic webhook signature verification with fail-closed cryptographic checks (HMAC-SHA512).

---

## 4. Incident Classification & Severity Matrix

| Severity Level | Definition | Impact Examples | Maximum Response Time | Target Resolution (RTO) |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core financial functionality or platform totally unavailable. | Complete website outage, database connection loss, wallet balance discrepancy, payment webhook processing outage. | **10 minutes** | **&le; 30 minutes** |
| **SEV-2 (Major)** | Major functionality impaired, but core operations accessible. | KYC private document upload failure, secondary bank resolution API down, external email notification delay. | **30 minutes** | **&le; 2 hours** |
| **SEV-3 (Moderate)** | Non-critical functionality degraded with available workaround. | Chat message real-time polling latency, proposal filter UI bug, analytics dashboard delay. | **2 hours** | **&le; 8 hours** |
| **SEV-4 (Minor)** | Cosmetic defect, documentation update, or minor UI flaw. | Minor styling glitch, typographic error, non-blocking administrative view quirk. | **1 business day** | **Next release cycle** |

---

## 5. Automated Health Checks & Telemetry Probing

To detect failure states before user impact, Collekt exposes an automated diagnostic endpoint:
- **Canonical URLs**:
  - `https://collektng.com/api/health`
  - `https://collektng.com/api/status`
- **Implementation**: `netlify/functions/health.js`
- **Monitored Telemetry**:
  1. `checks.database`: Queries `public.profiles` with latency benchmarking (`database_latency_ms`).
  2. `checks.storage`: Tests Supabase Private Storage access.
  3. `checks.payment_gateways`: Verifies presence and readiness of `PAYSTACK_SECRET_KEY`, `KORAPAY_SECRET_KEY`, and `OPAY_SECRET_KEY`.
  4. `system.memory_mb`: Reports RSS, Heap Used, and Heap Total in MB.
  5. `system.uptime_seconds`: Evaluates serverless process lifecycle.
- **Fail-Closed Policy**: Returns HTTP 503 (`status: 'degraded'`) if database connectivity is broken, without disclosing internal connection strings or stack traces (OWASP ASVS V14.4).

---

## 6. Disaster Recovery Runbooks

### Runbook A: Instant Deployment Rollback (Netlify Edge CDN)
**Trigger**: A new platform release introduces a breaking frontend bug, high-severity regression, or runtime crash.
**Execution Window**: &lt; 2 minutes.

1. **Locate Last Known Good Deploy ID**:
   ```powershell
   # Inspect deployment history via Netlify MCP / CLI or deploy log
   # Example: deploy_live.js reports deploy IDs like 6ab63526cd7f2e86606533ea
   ```
2. **Execute Rollback via Netlify Console or API**:
   - Access Netlify Dashboard &rarr; Site Deploys &rarr; Select previous validated Deploy ID &rarr; Click **"Publish deploy"**.
   - Edge cache invalidates globally in &le; 30 seconds.
3. **Verify Restoration**:
   - Run probe: `curl -I https://collektng.com/` (Assert HTTP 200).
   - Test health check: `curl https://collektng.com/api/health` (Assert HTTP 200).

---

### Runbook B: PostgreSQL Point-in-Time Recovery (PITR) & Standby Failover
**Trigger**: Accidental catastrophic data deletion, database corruption, or regional cloud provider outage.
**Target SLA**: RPO &le; 15 minutes, RTO &le; 30 minutes.

1. **Declare SEV-1 Incident**:
   - Alert Lead Engineer and Compliance Officer.
   - Place application into maintenance mode or circuit-break financial mutations via rate limiters / API gates.
2. **Identify Target Timestamp for Recovery**:
   - Inspect PostgreSQL query audit logs or `admin_audit_logs` table to determine the exact timestamp preceding corruption (`T_target`).
3. **Execute PITR Snapshot Restoration**:
   - In the Supabase Project Dashboard &rarr; Database &rarr; Backups &rarr; Point in Time.
   - Select point-in-time timestamp: `T_target - 1 minute`.
   - Initiate database restore to target instance.
4. **Validate Schema & Balance Integrity**:
   - Verify table integrity: `profiles`, `companies`, `wallets`, `wallet_ledger`, `transactions`, `milestones`.
   - Validate that all authentic wallet balances reflect strictly legitimate states (e.g. `₦0.00` default on un-deposited accounts).
5. **Re-point Connection Strings**:
   - If a new instance was provisioned, update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Netlify Environment Variables.
   - Trigger zero-downtime rebuild.

---

### Runbook C: Post-Disaster Financial Ledger Reconciliation Protocol
**Trigger**: Follows any database restore, payment rail outage, or network partition where transactions may have been in-flight.
**Target SLA**: Zero duplicate credits, 100% double-entry ledger balance consistency.

1. **Scan In-Flight Transactions**:
   - Query all transactions in `status = 'pending'` created within the outage window:
     ```sql
     SELECT id, user_id, reference, amount, created_at
     FROM public.transactions
     WHERE status = 'pending' AND created_at >= NOW() - INTERVAL '4 hours';
     ```
2. **Reconcile Pending Records via Automated Verification**:
   - For each pending reference, query the financial reconciliation endpoint:
     ```http
     POST /api/wallet-reconcile
     Authorization: Bearer <AUTH_TOKEN>
     Content-Type: application/json

     { "reference": "<TRANSACTION_REFERENCE>" }
     ```
   - `wallet-reconcile.js` queries Paystack/Korapay APIs, verifies payment success, and executes idempotent balance updates.
   - If already processed, the endpoint returns `status: 'already_reconciled'` with `already_processed: true`, guaranteeing **ZERO duplicate credits**.
3. **Audit Double-Entry Ledger Invariants**:
   - Confirm: `SUM(wallets.available_balance + wallets.escrow_balance) = SUM(ledger.credit - ledger.debit)`.
   - Confirm: No negative balances exist across any user or corporate wallets.

---

## 7. Business Continuity Testing & Audit Schedule

To ensure operational compliance under ISACA ITAF 2208:
- **Bi-Annual Disaster Simulation Drill**: Simulated Netlify rollback and PITR restoration conducted in staging environment every 6 months.
- **Quarterly Webhook Failover Drill**: Test automated fallback between Paystack and Korapay webhook endpoints.
- **Continuous Automated Regression**: Security and ledger integrity probes executed on every production deployment via `test_security_audit_fixes.js` and `test_wallet_transfer_flow.js`.

---

**Approval & Compliance Sign-Off:**
- **Lead IT Auditor / Compliance Specialist**: Collekt Audit Working Group
- **Framework Compliance**: COBIT 2019 DSS04, ISACA ITAF 5th Ed., CBN Cybersecurity Framework 4.3, NDPA 2023.
