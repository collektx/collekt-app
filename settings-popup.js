/**
 * ----------------------------------------------------------
 *  COLLEKT &rarr; settings-popup.js
 *  A universal settings modal you can drop into any page.
 *
 *  Usage:
 *    <script src="settings-popup.js"></script>
 *    <button id="openSettings">Settings</button>
 *
 *  API:
 *    window.openSettingsModal()  &rarr; open programmatically
 *    window.closeSettingsModal() &rarr; close programmatically
 *
 *  All settings are saved to localStorage as JSON under the
 *  key 'collekt_settings'.
 * ----------------------------------------------------------
 */
(function () {
  'use strict';

  /* -- STYLE INJECTION ------------------------------- */
  const CSS = `
  /* -- Backdrop ------------------- */
  .settings-backdrop {
    position: fixed; inset: 0; z-index: 9900;
    background: rgba(0, 0, 0, 0.48);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    opacity: 0; pointer-events: none;
    transition: opacity 0.35s cubic-bezier(.22,.61,.36,1);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
  }
  .settings-backdrop.open {
    opacity: 1; pointer-events: all;
  }

  /* -- Panel (iOS Frosted Glass) -- */
  .settings-panel {
    background: rgba(255, 255, 255, 0.76);
    backdrop-filter: blur(40px) saturate(200%);
    -webkit-backdrop-filter: blur(40px) saturate(200%);
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.85);
    box-shadow:
      0 32px 80px rgba(0, 0, 0, 0.18),
      0 8px 24px rgba(0, 0, 0, 0.06),
      inset 0 1.5px 0 rgba(255, 255, 255, 0.95),
      inset 0 -1px 0 rgba(0, 0, 0, 0.04);
    max-width: 560px; width: 100%;
    max-height: 90vh;
    display: flex; flex-direction: column;
    transform: translateY(28px) scale(.97);
    transition: transform 0.35s cubic-bezier(.22,.61,.36,1);
    overflow: hidden;
  }
  .settings-backdrop.open .settings-panel {
    transform: translateY(0) scale(1);
  }

  /* -- Panel Header --------------- */
  .settings-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 22px 28px 18px;
    border-bottom: 1px solid rgba(19, 117, 111, 0.10);
    flex-shrink: 0;
  }
  .settings-title {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 18px; font-weight: 900; color: #111918;
    display: flex; align-items: center; gap: 8px;
  }
  .settings-close {
    width: 34px; height: 34px; border-radius: 50%;
    background: rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(0, 0, 0, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #111918; font-size: 16px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(.22,.61,.36,1);
  }
  .settings-close:hover {
    background: rgba(0, 0, 0, 0.12);
    transform: scale(1.08);
  }

  /* -- Scrollable Body ------------ */
  .settings-body {
    overflow-y: auto; padding: 0 28px 24px;
    flex: 1; scrollbar-width: thin;
    scrollbar-color: rgba(19, 117, 111, 0.18) transparent;
  }
  .settings-body::-webkit-scrollbar { width: 5px; }
  .settings-body::-webkit-scrollbar-track { background: transparent; }
  .settings-body::-webkit-scrollbar-thumb { background: rgba(19, 117, 111, 0.18); border-radius: 99px; }

  /* -- Section -------------------- */
  .settings-section {
    padding: 20px 0;
    border-bottom: 1px solid rgba(19, 117, 111, 0.10);
  }
  .settings-section:last-child { border-bottom: none; }
  .settings-section-title {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 11px; font-weight: 900; color: #6B8280;
    text-transform: uppercase; letter-spacing: .09em;
    margin-bottom: 12px;
  }

  /* -- Row (toggle / checkbox) ---- */
  .settings-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 0; gap: 20px;
  }
  .settings-row-info { flex: 1; }
  .settings-row-label {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 14.5px; font-weight: 700; color: #111918;
  }
  .settings-row-desc {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 12px; color: #6B8280; margin-top: 2px;
  }

  /* -- iOS Toggle switch ---------- */
  .sett-toggle {
    position: relative; width: 51px; height: 31px; flex-shrink: 0;
  }
  .sett-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
  .sett-slider {
    position: absolute; inset: 0;
    background: rgba(120, 120, 128, 0.20);
    border-radius: 99px; cursor: pointer;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.20);
    transition: background 0.28s cubic-bezier(.22,.61,.36,1);
  }
  .sett-slider::before {
    content: '';
    position: absolute;
    width: 27px; height: 27px; left: 1px; top: 1px;
    background: #FFFFFF; border-radius: 50%;
    box-shadow: 0 3px 8px rgba(0,0,0,0.22), 0 1px 2px rgba(0,0,0,0.12);
    transition: transform 0.28s cubic-bezier(.22,.61,.36,1);
  }
  .sett-toggle input:checked + .sett-slider {
    background: #F59E0B;
    border-color: rgba(245, 158, 11, 0.4);
    box-shadow: 0 2px 10px rgba(245, 158, 11, 0.35);
  }
  .sett-toggle input:checked + .sett-slider::before {
    transform: translateX(20px);
  }
  .sett-toggle input:focus-visible + .sett-slider { outline: 3px solid #13756F; outline-offset: 2px; }

  /* -- Checkbox ------------------- */
  .sett-checkbox {
    width: 22px; height: 22px; border-radius: 6px;
    border: 1.5px solid rgba(19, 117, 111, 0.24);
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(8px);
    cursor: pointer; appearance: none; flex-shrink: 0;
    display: grid; place-items: center;
    transition: all 0.25s cubic-bezier(.22,.61,.36,1);
  }
  .sett-checkbox:checked {
    background: #D4920B; border-color: #D4920B;
    box-shadow: 0 2px 8px rgba(212, 146, 11, 0.35);
  }
  .sett-checkbox:checked::after {
    content: '✓'; color: #fff; font-size: 13px; font-weight: 900;
  }

  /* -- Select / Dropdown ---------- */
  .sett-select {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 13px; font-weight: 700; color: #111918;
    background: rgba(244, 248, 247, 0.80);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1.5px solid rgba(19, 117, 111, 0.16);
    border-radius: 12px;
    padding: 10px 14px; cursor: pointer;
    transition: all 0.22s cubic-bezier(.22,.61,.36,1);
    flex: 1; max-width: 340px; width: 100%; box-sizing: border-box;
  }
  .sett-select:focus { border-color: #13756F; outline: none; background: rgba(255,255,255,0.95); }

  /* -- Buttons -------------------- */
  .sett-btn {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 13px; font-weight: 800;
    padding: 10px 22px; border-radius: 12px; cursor: pointer;
    transition: all 0.25s cubic-bezier(.22,.61,.36,1);
    border: 1.5px solid;
    backdrop-filter: blur(8px);
  }
  .sett-btn-outline {
    background: rgba(255, 255, 255, 0.70); color: #0E3B35; border-color: rgba(19, 117, 111, 0.20);
  }
  .sett-btn-outline:hover {
    background: rgba(212, 239, 236, 0.90); border-color: #13756F; color: #13756F;
    transform: translateY(-2px);
  }
  .sett-btn-danger {
    background: rgba(255, 255, 255, 0.70); color: #C0392B; border-color: rgba(254, 202, 202, 0.7);
  }
  .sett-btn-danger:hover {
    background: #fef2f2; border-color: #C0392B;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(192,57,43,.14);
  }

  /* ══════════════════════════════════════════════════════════
     DARK MODE — iOS Liquid Dark Glass
     ══════════════════════════════════════════════════════════ */
  html.dark .settings-backdrop {
    background: rgba(0, 0, 0, 0.60);
    backdrop-filter: blur(24px) saturate(190%);
    -webkit-backdrop-filter: blur(24px) saturate(190%);
  }
  html.dark .settings-panel {
    background: rgba(14, 30, 27, 0.72);
    backdrop-filter: blur(48px) saturate(210%);
    -webkit-backdrop-filter: blur(48px) saturate(210%);
    border: 1px solid rgba(255, 255, 255, 0.16);
    box-shadow:
      0 40px 100px rgba(0, 0, 0, 0.60),
      0 12px 36px rgba(0, 0, 0, 0.40),
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  }
  html.dark .settings-title { color: #FFFFFF; }
  html.dark .settings-row-label { color: #FFFFFF; }
  html.dark .settings-row-desc { color: #94A3B8; }
  html.dark .settings-section { border-color: rgba(255, 255, 255, 0.08); }
  html.dark .settings-section-title { color: #94A3B8; }
  html.dark .settings-header { border-color: rgba(255, 255, 255, 0.08); }
  html.dark .settings-close {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.18);
    color: #FFFFFF;
  }
  html.dark .settings-close:hover {
    background: rgba(255, 255, 255, 0.22);
    border-color: rgba(255, 255, 255, 0.30);
    transform: scale(1.08);
  }
  html.dark .sett-slider {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.12);
  }
  html.dark .sett-toggle input:checked + .sett-slider {
    background: #F59E0B;
    border-color: rgba(245, 158, 11, 0.50);
    box-shadow: 0 2px 14px rgba(245, 158, 11, 0.50);
  }
  html.dark .sett-select {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.14);
    color: #FFFFFF;
  }
  html.dark .sett-select option {
    background-color: #0c201e;
    color: #F1F5F9;
  }
  html.dark .sett-btn-outline {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.14);
    color: #FFFFFF;
  }
  html.dark .sett-btn-outline:hover {
    background: rgba(255, 255, 255, 0.16);
    border-color: rgba(255, 255, 255, 0.24);
  }
  html.dark .sett-btn-danger {
    background: rgba(192, 57, 43, 0.14);
    border-color: rgba(239, 68, 68, 0.35);
    color: #f87171;
  }
  html.dark .sett-btn-danger:hover {
    background: rgba(192, 57, 43, 0.25);
    border-color: #ef4444;
  }
  html.dark .sett-checkbox {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.16);
  }
  `;

  /* -- INJECT STYLES --------------------------------- */
  const style = document.createElement('style');
  style.id = 'collekt-settings-css';
  style.textContent = CSS;
  document.head.appendChild(style);

  /* -- DEFAULTS & STORAGE ---------------------------- */
  const STORAGE_KEY = 'collekt_settings';

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) { return {}; }
  }

  function saveSettings(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function getSetting(key, defaultVal) {
    const s = loadSettings();
    return (key in s) ? s[key] : defaultVal;
  }

  function setSetting(key, value) {
    const s = loadSettings();
    s[key] = value;
    saveSettings(s);
  }

  /* -- MODAL HTML ------------------------------------ */
  function buildModal() {
    const isDark = getSetting('dark_mode', document.documentElement.classList.contains('dark'));

    const html = `
    <div class="settings-backdrop" id="settingsBackdrop" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
      <div class="settings-panel" id="settingsPanel">

        <!-- Header -->
        <div class="settings-header">
          <div class="settings-title" id="settingsTitle"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Settings</div>
          <button class="settings-close" id="settingsCloseBtn" aria-label="Close settings"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        <!-- Body -->
        <div class="settings-body">

          <!-- 1. ACCOUNT -->
          <div class="settings-section">
            <div class="settings-section-title">Account</div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Email Notifications</div>
                <div class="settings-row-desc">Receive updates about proposals and messages</div>
              </div>
              <label class="sett-toggle">
                <input type="checkbox" id="sett-email-notif" ${getSetting('email_notifications', true) ? 'checked' : ''}>
                <span class="sett-slider"></span>
              </label>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Push Notifications</div>
                <div class="settings-row-desc">Browser push alerts for real-time updates</div>
              </div>
              <label class="sett-toggle">
                <input type="checkbox" id="sett-push-notif" ${getSetting('push_notifications', true) ? 'checked' : ''}>
                <span class="sett-slider"></span>
              </label>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">SMS Alerts</div>
                <div class="settings-row-desc">Text message alerts for critical updates</div>
              </div>
              <label class="sett-toggle">
                <input type="checkbox" id="sett-sms-alerts" ${getSetting('sms_alerts', false) ? 'checked' : ''}>
                <span class="sett-slider"></span>
              </label>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Marketing Emails</div>
                <div class="settings-row-desc">Tips, platform news and promotions</div>
              </div>
              <label class="sett-toggle">
                <input type="checkbox" id="sett-marketing" ${getSetting('marketing_emails', false) ? 'checked' : ''}>
                <span class="sett-slider"></span>
              </label>
            </div>
          </div>

          <!-- 2. PRIVACY -->
          <div class="settings-section">
            <div class="settings-section-title">Privacy</div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Profile Visible to Public</div>
                <div class="settings-row-desc">Anyone can view your public profile page</div>
              </div>
              <label class="sett-toggle">
                <input type="checkbox" id="sett-profile-public" ${getSetting('profile_public', true) ? 'checked' : ''}>
                <span class="sett-slider"></span>
              </label>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Show Earnings</div>
                <div class="settings-row-desc">Display your total earnings on your profile</div>
              </div>
              <label class="sett-toggle">
                <input type="checkbox" id="sett-show-earnings" ${getSetting('show_earnings', false) ? 'checked' : ''}>
                <span class="sett-slider"></span>
              </label>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Show Availability Status</div>
                <div class="settings-row-desc">Let clients see if you're available for hire</div>
              </div>
              <label class="sett-toggle">
                <input type="checkbox" id="sett-show-avail" ${getSetting('show_availability', true) ? 'checked' : ''}>
                <span class="sett-slider"></span>
              </label>
            </div>
          </div>

          <!-- 3. SECURITY -->
          <div class="settings-section">
            <div class="settings-section-title">Security</div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Two-Factor Authentication</div>
                <div class="settings-row-desc">Extra security layer via SMS or authenticator app</div>
              </div>
              <label class="sett-toggle">
                <input type="checkbox" id="sett-2fa" ${getSetting('two_factor', false) ? 'checked' : ''}>
                <span class="sett-slider"></span>
              </label>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Login Alerts</div>
                <div class="settings-row-desc">Get notified of new sign-ins to your account</div>
              </div>
              <label class="sett-toggle">
                <input type="checkbox" id="sett-login-alerts" ${getSetting('login_alerts', true) ? 'checked' : ''}>
                <span class="sett-slider"></span>
              </label>
            </div>

            <div class="settings-row" style="padding-top:14px;">
              <div class="settings-row-info">
                <div class="settings-row-label">Password</div>
                <div class="settings-row-desc">Last changed: Never</div>
              </div>
              <button class="sett-btn sett-btn-outline" id="sett-change-pw-btn">Change Password</button>
            </div>
          </div>

          <!-- 4. APPEARANCE -->
          <div class="settings-section">
            <div class="settings-section-title">Appearance</div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Dark Mode</div>
                <div class="settings-row-desc">Switch between light and dark interface</div>
              </div>
              <label class="sett-toggle">
                <input type="checkbox" id="sett-dark-mode" ${isDark ? 'checked' : ''}>
                <span class="sett-slider"></span>
              </label>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Compact View</div>
                <div class="settings-row-desc">Reduce spacing for denser information layout</div>
              </div>
              <label class="sett-toggle">
                <input type="checkbox" id="sett-compact" ${getSetting('compact_view', false) ? 'checked' : ''}>
                <span class="sett-slider"></span>
              </label>
            </div>
          </div>

          <!-- 5. LANGUAGE & REGION -->
          <div class="settings-section">
            <div class="settings-section-title">Language &amp; Region</div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Language</div>
              </div>
              <select class="sett-select" id="sett-language">
                <option value="en" ${getSetting('language','en')==='en'?'selected':''}>English</option>
                <option value="fr" ${getSetting('language','en')==='fr'?'selected':''}>Français</option>
                <option value="ha" ${getSetting('language','en')==='ha'?'selected':''}>Hausa</option>
                <option value="yo" ${getSetting('language','en')==='yo'?'selected':''}>Yorùbá</option>
                <option value="ig" ${getSetting('language','en')==='ig'?'selected':''}>Igbo</option>
              </select>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Currency</div>
              </div>
              <select class="sett-select" id="sett-currency">
                <option value="NGN" ${getSetting('currency','NGN')==='NGN'?'selected':''}>NGN (&#x20A6;)</option>
                <option value="USD" ${getSetting('currency','NGN')==='USD'?'selected':''}>USD ($)</option>
                <option value="GBP" ${getSetting('currency','NGN')==='GBP'?'selected':''}>GBP (&pound;)</option>
                <option value="GHS" ${getSetting('currency','NGN')==='GHS'?'selected':''}>GHS (&#x20B5;)</option>
              </select>
            </div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">Timezone</div>
              </div>
              <select class="sett-select" id="sett-timezone">
                <option value="WAT" ${getSetting('timezone','WAT')==='WAT'?'selected':''}>WAT (UTC+1)</option>
                <option value="GMT" ${getSetting('timezone','WAT')==='GMT'?'selected':''}>GMT (UTC+0)</option>
                <option value="EAT" ${getSetting('timezone','WAT')==='EAT'?'selected':''}>EAT (UTC+3)</option>
                <option value="CAT" ${getSetting('timezone','WAT')==='CAT'?'selected':''}>CAT (UTC+2)</option>
              </select>
            </div>
          </div>

          <!-- 6. PLATFORM REVIEWS & FEEDBACK -->
          <div class="settings-section">
            <div class="settings-section-title">Platform Feedback &amp; Performance</div>
            <div class="settings-row" style="align-items:center;">
              <div class="settings-row-info">
                <div class="settings-row-label">Review Website &amp; Performance</div>
                <div class="settings-row-desc">Share feedback on website speed, proposal workflows, or escrow payouts</div>
              </div>
              <a href="index.html#testimonials" class="sett-btn sett-btn-outline" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px; font-weight:800;" onclick="closeSettingsModal()">
                <span>✍️</span> Rate Platform
              </a>
            </div>
          </div>

          <!-- 7. DANGER ZONE -->
          <div class="settings-section" style="border-bottom:none;">
            <div class="settings-section-title" style="color:#C0392B;">Danger Zone</div>

            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label" style="color:#C0392B;">Delete Account</div>
                <div class="settings-row-desc">Permanently remove your account and all data. This cannot be undone.</div>
              </div>
              <button class="sett-btn sett-btn-danger" id="sett-delete-btn">Delete Account</button>
            </div>
          </div>

        </div><!-- /settings-body -->
      </div><!-- /settings-panel -->
    </div><!-- /settings-backdrop -->
    `;

    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);

    _bindEvents();
  }

  /* -- EVENT BINDING --------------------------------- */
  function _bindEvents() {
    const backdrop = document.getElementById('settingsBackdrop');
    const closeBtn = document.getElementById('settingsCloseBtn');

    /* Close on backdrop click */
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeSettingsModal();
    });

    /* Close button */
    closeBtn.addEventListener('click', closeSettingsModal);

    /* Close on Escape */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('open')) closeSettingsModal();
    });

    /* -- Toggle listeners --------------- */
    const toggleMap = {
      'sett-email-notif':   { key: 'email_notifications' },
      'sett-push-notif':    { key: 'push_notifications' },
      'sett-sms-alerts':    { key: 'sms_alerts' },
      'sett-marketing':     { key: 'marketing_emails' },
      'sett-profile-public':{ key: 'profile_public' },
      'sett-show-earnings': { key: 'show_earnings' },
      'sett-show-avail':    { key: 'show_availability' },
      'sett-2fa':           { key: 'two_factor' },
      'sett-login-alerts':  { key: 'login_alerts' },
      'sett-compact':       { key: 'compact_view' },
    };

    Object.entries(toggleMap).forEach(([id, { key }]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => setSetting(key, el.checked));
    });

    /* Dark mode special handling */
    const darkToggle = document.getElementById('sett-dark-mode');
    if (darkToggle) {
      darkToggle.addEventListener('change', () => {
        const on = darkToggle.checked;
        document.documentElement.classList.toggle('dark', on);
        localStorage.setItem('collekt_theme', on ? 'dark' : 'light');
        setSetting('dark_mode', on);
      });
    }

    /* Selects */
    const selectMap = {
      'sett-language': 'language',
      'sett-currency': 'currency',
      'sett-timezone': 'timezone',
    };
    Object.entries(selectMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => setSetting(key, el.value));
    });

    /* Change password */
    document.getElementById('sett-change-pw-btn')?.addEventListener('click', () => {
      closeSettingsModal();
      const target = document.getElementById('changePasswordSection') || document.querySelector('[href="login.html"]');
      if (target && target.tagName === 'A') window.location.href = target.href;
      else alert('Change Password flow coming soon!');
    });

    /* Delete account */
    document.getElementById('sett-delete-btn')?.addEventListener('click', () => {
      const confirmed = confirm('Are you absolutely sure? This action permanently deletes your account and all your data. This CANNOT be undone.');
      if (confirmed) {
        localStorage.clear();
        window.location.href = 'index.html';
      }
    });
  }

  /* -- OPEN / CLOSE ----------------------------------- */
  let modalBuilt = false;

  function openSettingsModal() {
    if (!modalBuilt) {
      buildModal();
      modalBuilt = true;
    }
    const backdrop = document.getElementById('settingsBackdrop');
    if (backdrop) {
      backdrop.style.display = 'flex';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => backdrop.classList.add('open'));
      });
      // Focus trap: move focus to close button
      setTimeout(() => {
        const closeBtn = document.getElementById('settingsCloseBtn');
        if (closeBtn) closeBtn.focus();
      }, 100);
    }
  }

  function closeSettingsModal() {
    const backdrop = document.getElementById('settingsBackdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      setTimeout(() => { backdrop.style.display = 'none'; }, 520);
    }
  }

  /* -- WIRE UP TRIGGER -------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    /* Read stored dark mode preference */
    const storedTheme = localStorage.getItem('collekt_theme');
    if (storedTheme === 'dark') document.documentElement.classList.add('dark');
    else if (storedTheme === 'light') document.documentElement.classList.remove('dark');

    /* Bind openSettings trigger button */
    const trigger = document.getElementById('openSettings');
    if (trigger) trigger.addEventListener('click', openSettingsModal);
  });

  /* -- EXPORT PUBLIC API ------------------------------- */
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;

})();
