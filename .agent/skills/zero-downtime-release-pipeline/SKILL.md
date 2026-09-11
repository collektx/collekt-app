---
name: zero-downtime-release-pipeline
description: >-
  Standard operating procedure for platform release management: universal asset cache-busting,
  Netlify serverless function validation, Git sync, and live deployment verification.
---

# Zero-Downtime Release Pipeline & Deployment Playbook

Use this skill when preparing and releasing platform updates to ensure instant, cache-free delivery across mobile and desktop browsers with zero downtime.

## Step-by-Step Release Procedure

1. **Universal Asset Cache Invalidation**:
   - Whenever `app.js`, `shared.css`, `glass.css`, `supabase.js`, or `collekt-ai.js` are modified, bump the query version string across all 23 platform HTML pages:
     - Example: `?v=38.0` -> `?v=39.0`
   - Ensure the regex pattern matches all script and link tags cleanly without duplicating characters.

2. **Netlify Pre-Flight Validation**:
   - Check `netlify.toml` redirects, security headers, and function routes.
   - Verify that all serverless functions in `netlify/functions/` have required npm dependencies and error handling.

3. **GitHub Sync**:
   - Stage modified files and commit with a concise, descriptive conventional commit message.
   - Push commit to the canonical remote (`https://github.com/collektx/collekt-app` on branch `main`).

4. **Live Verification**:
   - Poll Netlify deployment status until state is `ready`.
   - Verify that `https://collektng.xyz` responds with HTTP 200 and serves the latest versioned assets.

## Deployment Checklist

- [ ] All 23 HTML files updated to the new asset version string.
- [ ] Netlify function syntax check passed.
- [ ] Git commit created and pushed to `main`.
- [ ] Production deployment confirmed `ready` on Netlify.
