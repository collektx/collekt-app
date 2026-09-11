---
name: nigerian-compliance-auditor
description: >-
  Audits Collekt pages, sign-up forms, terms, and data storage against Nigerian regulatory
  standards: NDPR / NDPA 2023, CBN Consumer Protection, FCCPA, and AML/CFT laws.
---

# Nigerian Legal & Regulatory Compliance Auditor

Use this skill to inspect and ensure that all new features, forms, and legal disclosures on Collekt comply with the laws of the Federal Republic of Nigeria.

## Statutory Standards

1. **Nigeria Data Protection Act (NDPA 2023) & NDPR**:
   - **Explicit Affirmative Consent**: Sign-up forms must require explicit consent to Terms & Privacy Policy with unchecked checkboxes by default.
   - **Cookie Consent**: Initial visits must display the glassmorphic cookie banner with granular consent options ("Accept All", "Customize", "Necessary Only").
   - **Data Subject Rights**: Provide mechanisms for users to request data export or deletion under NDPA section 34.

2. **Federal Competition and Consumer Protection Act (FCCPA 2018)**:
   - **Transparent Pricing**: All platform fees (e.g. 10% milestone commission, subscription tiers) must be clearly shown before payment authorization.
   - **Clear Dispute Terms**: Users must have access to a defined dispute procedure with maximum 14-day turnaround times.

3. **CBN Financial Regulations & Anti-Money Laundering (AML/CFT)**:
   - **NIN / BVN Verification**: Tier-2 and Tier-3 limits require National Identity Number (NIN) verification.
   - **CAC Business Incorporation**: Companies must provide verifiable RC/BN numbers before receiving verified badges or executing contracts over 1,000,000 NGN.

## Compliance Audit Checklist

- [ ] Checkbox for Terms of Service and Privacy Policy on `register.html`.
- [ ] Cookie banner initializes correctly on clean browser sessions without blocking critical UI.
- [ ] Disclaimer: Collekt operates as a technology facilitator and escrow platform, not an unlicensed bank or insurer.
- [ ] Dispute mediation policy explicitly states that unresolved disputes defer to the Arbitration and Mediation Act 2023 (Lagos jurisdiction).
