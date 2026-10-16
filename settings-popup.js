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

  
  /* -- Inputs & Textareas --------- */
  .sett-input {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 13.5px;
    font-weight: 600;
    color: #111918;
    background: rgba(244, 248, 247, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1.5px solid rgba(19, 117, 111, 0.18);
    border-radius: 12px;
    padding: 10px 14px;
    box-sizing: border-box;
    transition: all 0.22s cubic-bezier(.22,.61,.36,1);
  }
  .sett-input:focus {
    border-color: #13756F;
    outline: none;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 0 0 3px rgba(19, 117, 111, 0.15);
  }
  .sett-btn-primary {
    background: linear-gradient(135deg, #13756F, #0E5A55);
    color: #FFFFFF !important;
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 14px rgba(19, 117, 111, 0.28);
  }
  .sett-btn-primary:hover {
    background: linear-gradient(135deg, #0E5A55, #083D39);
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(19, 117, 111, 0.38);
  }
  .sett-field-label {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 12px;
    font-weight: 800;
    color: #111918;
    display: block;
    margin-bottom: 6px;
  }
  .sett-desc-text {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 13px;
    color: #556965;
    margin-bottom: 16px;
    line-height: 1.5;
  }
  .sett-review-row {
    transition: all 0.2s cubic-bezier(.22,.61,.36,1);
  }
  .sett-review-row:hover {
    background: rgba(19, 117, 111, 0.08);
  }
  .sett-trustpilot-title {
    color: #005c3e;
  }
  .review-user-card {
    background: rgba(19, 117, 111, 0.08);
    border: 1px solid rgba(19, 117, 111, 0.18);
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
  
  html.dark .sett-input {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.14);
    color: #FFFFFF;
  }
  html.dark .sett-input:focus {
    background: rgba(255, 255, 255, 0.12);
    border-color: #38bdf8;
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
  }
  html.dark .sett-input::placeholder {
    color: #94A3B8;
  }
  html.dark .sett-btn-primary {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #FFFFFF !important;
    border-color: rgba(255, 255, 255, 0.25);
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  }
  html.dark .sett-btn-primary:hover {
    background: linear-gradient(135deg, #059669, #047857);
    box-shadow: 0 6px 22px rgba(16, 185, 129, 0.4);
  }
  html.dark .sett-field-label {
    color: #F1F5F9;
  }
  html.dark .sett-desc-text {
    color: #94A3B8;
  }
  html.dark .sett-review-row:hover {
    background: rgba(255, 255, 255, 0.06);
  }
  html.dark .sett-trustpilot-title {
    color: #10b981;
  }
  html.dark .sett-trustpilot-card {
    background: rgba(0, 182, 122, 0.12) !important;
    border-color: rgba(0, 182, 122, 0.35) !important;
  }
  html.dark .review-user-card {
    background: rgba(255, 255, 255, 0.05) !important;
    border-color: rgba(255, 255, 255, 0.12) !important;
  }
  html.dark #settingsRatingScoreText {
    color: #F1F5F9 !important;
  }
  html.dark #settingsPerfScoreText {
    color: #94A3B8 !important;
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

          <!-- 5b. MEMBERSHIP & SUBSCRIPTION BILLING -->
          <div class="settings-section">
            <div class="settings-section-title">Membership &amp; Subscription Plans</div>
            <div class="settings-row" style="align-items:center;">
              <div class="settings-row-info">
                <div class="settings-row-label" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                  <span>⚡ Professional Plus: <strong>&#x20A6;19,999/mo</strong></span>
                  <span style="color:#6B8280;">&bull;</span>
                  <span>🏢 Company Enterprise: <strong>&#x20A6;74,999/mo</strong></span>
                </div>
                <div class="settings-row-desc">Save 5% Quarterly, 10% Bi-Annually, or 17% Annually. Cancel or switch plans anytime.</div>
              </div>
              <a href="upgrade.html" class="sett-btn sett-btn-primary" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
                Manage Plan &rarr;
              </a>
            </div>
          </div>

          <!-- 6. PLATFORM REVIEWS & FEEDBACK -->
          <div class="settings-section">
            <div class="settings-section-title">Platform Feedback &amp; Performance</div>
            <div class="settings-row sett-review-row" style="align-items:center; cursor:pointer; padding:12px 14px; border-radius:14px;" onclick="openWebsiteReviewModal()">
              <div class="settings-row-info">
                <div class="settings-row-label" style="display:flex; align-items:center; gap:6px;">
                  Review Website &amp; Performance <span style="font-size:11px; padding:2px 8px; border-radius:10px; background:rgba(245,158,11,0.15); color:#d97706; font-weight:800;">⭐ Feedback</span>
                </div>
                <div class="settings-row-desc">Share feedback on website speed, proposal workflows, or escrow payouts</div>
              </div>
              <button type="button" class="sett-btn sett-btn-outline" style="display:inline-flex; align-items:center; gap:6px; font-weight:800; cursor:pointer;" onclick="event.stopPropagation(); openWebsiteReviewModal();">
                <span>✍️</span> Drop Review
              </button>
            </div>
          <!-- 6b. DATA PRIVACY & PORTABILITY (NDPA 2023) -->
          <div class="settings-section">
            <div class="settings-section-title">Data Privacy &amp; Portability (NDPA 2023)</div>
            <div class="settings-row" style="align-items:center;">
              <div class="settings-row-info">
                <div class="settings-row-label" style="display:flex; align-items:center; gap:6px;">
                  Download My Data <span style="font-size:10px; padding:2px 8px; border-radius:10px; background:rgba(19,117,111,0.15); color:#13756F; font-weight:800;">NDPA Sec 33</span>
                </div>
                <div class="settings-row-desc">Export a machine-readable JSON portfolio of your profile, wallet history, contracts, and proposals</div>
              </div>
              <button type="button" class="sett-btn sett-btn-outline" id="sett-export-data-btn" style="display:inline-flex; align-items:center; gap:6px; font-weight:800; cursor:pointer;" onclick="exportUserDataJSON()">
                <span id="sett-export-icon">📥</span> <span id="sett-export-text">Export JSON</span>
              </button>
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
      'sett-compact':       { key: 'compact_view' },
    };

    Object.entries(toggleMap).forEach(([id, { key }]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => setSetting(key, el.checked));
    });

    /* Two-Factor Authentication Toggle: Requires Email OTP */
    const twoFaToggle = document.getElementById('sett-2fa');
    if (twoFaToggle) {
      twoFaToggle.addEventListener('change', () => {
        if (twoFaToggle.checked) {
          // Revert checkbox state until email OTP is successfully verified
          twoFaToggle.checked = false;
          openTwoFactorModal();
        } else {
          setSetting('two_factor', false);
          const curr = (typeof getUser === 'function' ? getUser() : null) || JSON.parse(localStorage.getItem('collekt_user') || '{}');
          if (curr) {
            curr.two_factor = false;
            curr.two_factor_enabled = false;
            localStorage.setItem('collekt_user', JSON.stringify(curr));
          }
          if (window.sb && curr && curr.id) {
            sb.from('profiles').update({ two_factor_enabled: false }).eq('id', curr.id).then(()=>{}).catch(()=>{});
          }
          if (typeof showToast === 'function') showToast('Two-Factor Authentication turned OFF.');
          else alert('Two-Factor Authentication turned OFF.');
        }
      });
    }

    /* Login Alerts Toggle: Sync to settings and profiles */
    const loginAlertsToggle = document.getElementById('sett-login-alerts');
    if (loginAlertsToggle) {
      loginAlertsToggle.addEventListener('change', () => {
        const on = loginAlertsToggle.checked;
        setSetting('login_alerts', on);
        const curr = (typeof getUser === 'function' ? getUser() : null) || JSON.parse(localStorage.getItem('collekt_user') || '{}');
        if (curr) {
          curr.login_alerts = on;
          localStorage.setItem('collekt_user', JSON.stringify(curr));
        }
        if (window.sb && curr && curr.id) {
          sb.from('profiles').update({ login_alerts: on }).eq('id', curr.id).then(()=>{}).catch(()=>{});
        }
        const msg = on ? '🔔 Login alerts turned ON. You will receive an email on new logins.' : '🔕 Login alerts turned OFF. No login notification emails will be sent.';
        if (typeof showToast === 'function') showToast(msg);
      });
    }

    /* Dark mode special handling */
    const darkToggle = document.getElementById('sett-dark-mode');
    if (darkToggle) {
      darkToggle.checked = document.documentElement.classList.contains('dark');
      darkToggle.addEventListener('change', () => {
        const on = darkToggle.checked;
        if (typeof window.setTheme === 'function') {
          window.setTheme(on ? 'dark' : 'light');
        } else {
          document.documentElement.classList.toggle('dark', on);
          localStorage.setItem('collekt_theme', on ? 'dark' : 'light');
          if (typeof window.updateThemeButton === 'function') window.updateThemeButton();
        }
        setSetting('dark_mode', on);
      });

      window.addEventListener('collekt_theme_change', (e) => {
        if (darkToggle) {
          darkToggle.checked = e.detail && e.detail.isDark;
        }
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

    /* Change password with Email OTP */
    document.getElementById('sett-change-pw-btn')?.addEventListener('click', () => {
      openChangePasswordModal();
    });

    /* Delete account: Open NDPA Section 34 verification modal */
    document.getElementById('sett-delete-btn')?.addEventListener('click', () => {
      openAccountDeletionModal();
    });
  }

  /* -- OPEN / CLOSE ----------------------------------- */
  let modalBuilt = false;

  function openSettingsModal() {
    if (!modalBuilt) {
      buildModal();
      modalBuilt = true;
    }
    const darkToggle = document.getElementById('sett-dark-mode');
    if (darkToggle) {
      darkToggle.checked = document.documentElement.classList.contains('dark');
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


  /* -- WEBSITE REVIEW MODAL FOR LOGGED-IN USERS -------------------- */
  let reviewModalBuilt = false;
  let currentReviewRating = 5;
  let currentPerfRating = 5;

  function updateReviewModalUser() {
    const userBox = document.getElementById('reviewUserIdentity');
    if (!userBox) return;

    let user = null;
    try {
      if (typeof getUser === 'function') user = getUser();
      else {
        const raw = localStorage.getItem('collekt_user');
        if (raw) user = JSON.parse(raw);
      }
    } catch(e) {}

    const isLoggedIn = user && (user.id || user.email || user.name || user.full_name);
    if (!isLoggedIn) {
      userBox.innerHTML = `
        <div class="review-user-card" style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; border-radius:14px; margin-bottom:14px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:36px; height:36px; border-radius:50%; background:rgba(19,117,111,0.2); color:#13756F; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:14px;">👤</div>
            <div>
              <div class="sett-field-label" style="margin-bottom:0; font-size:13px;">Community Feedback</div>
              <div class="sett-desc-text" style="margin-bottom:0; font-size:11.5px;">Not logged in &bull; Submit as guest or <a href="login.html" style="color:#13756F; font-weight:700; text-decoration:underline;">sign in</a></div>
            </div>
          </div>
          <a href="login.html" class="sett-btn sett-btn-outline" style="font-size:11px; padding:4px 10px; text-decoration:none;">Log In</a>
        </div>
      `;
      return;
    }

    const isCompany = user.role === 'company' || (window.location.pathname && window.location.pathname.includes('company'));
    const authorName = user.name || user.full_name || (user.first_name ? (user.first_name + ' ' + (user.last_name || '')).trim() : null) || user.username || 'Collekt Member';
    const authorRole = isCompany ? (user.company_name || 'Enterprise Client') : (user.title || 'Verified Professional');
    const avatarUrl = user.avatar || user.avatar_url || user.profile_picture;
    const initial = (authorName.charAt(0) || 'U').toUpperCase();

    userBox.innerHTML = `
      <div class="review-user-card" style="display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:14px; margin-bottom:16px;">
        <div style="width:42px; height:42px; border-radius:50%; background:#0E3B35; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:16px; overflow:hidden; flex-shrink:0; border:2px solid rgba(16,185,129,0.3);">
          ${avatarUrl ? `<img src="${avatarUrl}" alt="${authorName}" style="width:100%; height:100%; object-fit:cover;">` : initial}
        </div>
        <div style="flex:1; min-width:0;">
          <div class="sett-field-label" style="display:flex; align-items:center; gap:6px; margin-bottom:2px; font-size:13.5px;">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${authorName}</span>
            <span style="font-size:10.5px; padding:2px 8px; border-radius:8px; background:rgba(16,185,129,0.15); color:#10b981; font-weight:800; white-space:nowrap; border:1px solid rgba(16,185,129,0.3);">✓ Verified Member</span>
          </div>
          <div class="sett-desc-text" style="margin-bottom:0; font-size:11.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${authorRole}</div>
        </div>
      </div>
    `;
  }

  function buildReviewModal() {
    if (document.getElementById('websiteReviewModal')) return;

    const modalHtml = `
    <div class="settings-backdrop" id="websiteReviewModal" style="display:none; z-index:99999;" role="dialog" aria-modal="true" aria-labelledby="reviewModalTitle">
      <div class="settings-panel" style="max-width:540px;">
        <div class="settings-header">
          <div class="settings-title" id="reviewModalTitle">
            <span>⭐</span> Review Website &amp; Performance
          </div>
          <button class="settings-close" id="websiteReviewCloseBtn" onclick="closeWebsiteReviewModal()" aria-label="Close review dialog">&times;</button>
        </div>
        <div class="settings-body" style="padding-top:18px;">

          <!-- Logged-in User Identity -->
          <div id="reviewUserIdentity"></div>

          <p class="sett-desc-text">
            Share authentic feedback on platform speed, project bidding, escrow milestone payouts, or client communication.
          </p>

          <!-- Overall Star Rating -->
          <div style="margin-bottom:16px;">
            <label class="sett-field-label">Overall Platform Rating</label>
            <div style="display:flex; align-items:center; gap:12px;">
              <div id="settingsStarPicker" style="display:flex; gap:6px; font-size:26px; cursor:pointer; color:#f59e0b; user-select:none;">
                <span onclick="setWebsiteRating(1)" onmouseover="hoverWebsiteRating(1)" onmouseout="resetWebsiteHoverRating()">★</span>
                <span onclick="setWebsiteRating(2)" onmouseover="hoverWebsiteRating(2)" onmouseout="resetWebsiteHoverRating()">★</span>
                <span onclick="setWebsiteRating(3)" onmouseover="hoverWebsiteRating(3)" onmouseout="resetWebsiteHoverRating()">★</span>
                <span onclick="setWebsiteRating(4)" onmouseover="hoverWebsiteRating(4)" onmouseout="resetWebsiteHoverRating()">★</span>
                <span onclick="setWebsiteRating(5)" onmouseover="hoverWebsiteRating(5)" onmouseout="resetWebsiteHoverRating()">★</span>
              </div>
              <span id="settingsRatingScoreText" class="sett-field-label" style="font-size:14px; font-weight:800; margin-bottom:0;">5.0 / 5.0</span>
            </div>
          </div>

          <!-- Speed & Performance Rating -->
          <div style="margin-bottom:16px;">
            <label class="sett-field-label">⚡ Website Speed &amp; UI Responsiveness</label>
            <div style="display:flex; align-items:center; gap:12px;">
              <div id="settingsPerfPicker" style="display:flex; gap:6px; font-size:22px; cursor:pointer; color:#d4920b; user-select:none;">
                <span onclick="setWebsitePerfRating(1)" onmouseover="hoverWebsitePerfRating(1)" onmouseout="resetWebsitePerfHoverRating()">⚡</span>
                <span onclick="setWebsitePerfRating(2)" onmouseover="hoverWebsitePerfRating(2)" onmouseout="resetWebsitePerfHoverRating()">⚡</span>
                <span onclick="setWebsitePerfRating(3)" onmouseover="hoverWebsitePerfRating(3)" onmouseout="resetWebsitePerfHoverRating()">⚡</span>
                <span onclick="setWebsitePerfRating(4)" onmouseover="hoverWebsitePerfRating(4)" onmouseout="resetWebsitePerfHoverRating()">⚡</span>
                <span onclick="setWebsitePerfRating(5)" onmouseover="hoverWebsitePerfRating(5)" onmouseout="resetWebsitePerfHoverRating()">⚡</span>
              </div>
              <span id="settingsPerfScoreText" class="sett-desc-text" style="font-size:13px; font-weight:700; margin-bottom:0;">Ultra Fast (5.0)</span>
            </div>
          </div>

          <!-- Feedback Category -->
          <div style="margin-bottom:16px;">
            <label class="sett-field-label">Feedback Category</label>
            <select class="sett-select" id="settingsReviewCategory" style="width:100%; max-width:100%;">
              <option value="performance">⚡ Platform Speed &amp; Performance</option>
              <option value="pro">💼 Professional Freelancer Experience</option>
              <option value="company">🏢 Company &amp; Hiring Experience</option>
              <option value="escrow">🛡️ Escrow Payouts &amp; Milestone Security</option>
              <option value="ui">✨ UI / UX &amp; Mobile Responsiveness</option>
            </select>
          </div>

          <!-- Headline -->
          <div style="margin-bottom:16px;">
            <label class="sett-field-label">Review Headline</label>
            <input type="text" class="sett-input" id="settingsReviewTitle" placeholder="e.g. Fast milestone payouts and very clean interface" style="width:100%;">
          </div>

          <!-- Comments -->
          <div style="margin-bottom:18px;">
            <label class="sett-field-label">Detailed Feedback</label>
            <textarea class="sett-input" id="settingsReviewQuote" rows="4" placeholder="Tell the community how Collekt is working for your business or freelance projects..." style="width:100%; height:90px; resize:vertical;"></textarea>
          </div>

          <!-- Trustpilot Promotion Callout -->
          <div class="sett-trustpilot-card" style="margin-bottom:20px; padding:12px 14px; border-radius:14px; background:rgba(0,182,122,0.08); border:1px solid rgba(0,182,122,0.25); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:20px;">⭐</span>
              <div>
                <div class="sett-trustpilot-title" style="font-size:12.5px; font-weight:800;">Rate us on Trustpilot too!</div>
                <div class="sett-desc-text" style="font-size:11px; margin-bottom:0;">Help build global verified trust for Nigerian specialists</div>
              </div>
            </div>
            <a href="https://www.trustpilot.com/evaluate/collektng.com" target="_blank" rel="noopener noreferrer" class="sett-btn sett-btn-outline" style="font-size:11.5px; padding:6px 12px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; border-color:rgba(0,182,122,0.4); font-weight:800;">
              Trustpilot ↗
            </a>
          </div>

          <!-- Actions -->
          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="sett-btn sett-btn-outline" onclick="closeWebsiteReviewModal()">Cancel</button>
            <button type="button" class="sett-btn sett-btn-primary" onclick="submitWebsiteReview()">Submit Platform Review</button>
          </div>
        </div>
      </div>
    </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    const modalEl = div.firstElementChild;
    document.body.appendChild(modalEl);

    // Close on backdrop click
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeWebsiteReviewModal();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl.classList.contains('open')) {
        closeWebsiteReviewModal();
      }
    });

    reviewModalBuilt = true;
  }

  function openWebsiteReviewModal() {
    // Immediately hide settings backdrop to prevent transition collision & backdrop freezing
    const settingsBackdrop = document.getElementById('settingsBackdrop');
    if (settingsBackdrop) {
      settingsBackdrop.classList.remove('open');
      settingsBackdrop.style.display = 'none';
    }

    if (!reviewModalBuilt) buildReviewModal();
    updateReviewModalUser();

    const modal = document.getElementById('websiteReviewModal');
    if (!modal) return;
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.classList.add('open');
        const titleInput = document.getElementById('settingsReviewTitle');
        if (titleInput) titleInput.focus();
      });
    });
    setWebsiteRating(5);
    setWebsitePerfRating(5);
  }

  function closeWebsiteReviewModal() {
    const modal = document.getElementById('websiteReviewModal');
    if (!modal) return;
    modal.classList.remove('open');
    setTimeout(() => { modal.style.display = 'none'; }, 350);
  }

  function setWebsiteRating(n) {
    currentReviewRating = n;
    const spans = document.querySelectorAll('#settingsStarPicker span');
    spans.forEach((s, idx) => {
      s.style.opacity = (idx < n) ? '1' : '0.25';
      s.style.color = '#f59e0b';
    });
    const textEl = document.getElementById('settingsRatingScoreText');
    if (textEl) textEl.textContent = n.toFixed(1) + ' / 5.0';
  }

  function hoverWebsiteRating(n) {
    const spans = document.querySelectorAll('#settingsStarPicker span');
    spans.forEach((s, idx) => {
      s.style.opacity = (idx < n) ? '1' : '0.25';
    });
  }

  function resetWebsiteHoverRating() {
    setWebsiteRating(currentReviewRating);
  }

  function setWebsitePerfRating(n) {
    currentPerfRating = n;
    const spans = document.querySelectorAll('#settingsPerfPicker span');
    spans.forEach((s, idx) => {
      s.style.opacity = (idx < n) ? '1' : '0.25';
    });
    const textEl = document.getElementById('settingsPerfScoreText');
    if (textEl) {
      const labels = ['Needs Improvement', 'Fair Speed', 'Good Performance', 'Very Fast', 'Ultra Fast (5.0)'];
      textEl.textContent = labels[n - 1] || (n.toFixed(1) + ' / 5.0');
    }
  }

  function hoverWebsitePerfRating(n) {
    const spans = document.querySelectorAll('#settingsPerfPicker span');
    spans.forEach((s, idx) => {
      s.style.opacity = (idx < n) ? '1' : '0.25';
    });
  }

  function resetWebsitePerfHoverRating() {
    setWebsitePerfRating(currentPerfRating);
  }

  function submitWebsiteReview() {
    const title = document.getElementById('settingsReviewTitle')?.value.trim();
    const quote = document.getElementById('settingsReviewQuote')?.value.trim();
    const cat = document.getElementById('settingsReviewCategory')?.value || 'performance';
    const catName = document.getElementById('settingsReviewCategory')?.selectedOptions[0]?.textContent || '⚡ Performance';

    if (!quote || quote.length < 5) {
      if (typeof showToast === 'function') {
        showToast('⚠️ Please write a brief review feedback before submitting', 'warning');
      } else if (typeof alert === 'function') {
        alert('Please write a brief review feedback before submitting.');
      }
      return;
    }

    let user = {};
    try {
      if (typeof getUser === 'function') user = getUser() || {};
      else user = JSON.parse(localStorage.getItem('collekt_user') || '{}');
    } catch(e) {}

    const isCompany = user.role === 'company' || (window.location.pathname && window.location.pathname.includes('company'));
    const authorName = user.name || user.full_name || (user.first_name ? (user.first_name + ' ' + (user.last_name || '')).trim() : null) || user.username || 'Collekt Member';
    const authorRole = isCompany ? (user.company_name || 'Enterprise Partner') : (user.title || 'Specialist Professional');

    const newReview = {
      id: 'rev_' + Date.now(),
      name: authorName,
      role: authorRole,
      category: cat,
      categoryName: catName,
      rating: currentReviewRating || 5,
      perfRating: currentPerfRating || 5,
      title: title || 'Verified Platform Feedback',
      quote: quote,
      date: 'Just now',
      verified: true,
      initial: (authorName.charAt(0) || 'U').toUpperCase(),
      bg: '#0E3B35',
      helpfulCount: 0
    };

    // Save to localStorage
    let allReviews = [];
    try {
      allReviews = JSON.parse(localStorage.getItem('collekt_community_reviews') || '[]');
    } catch(e) {}
    allReviews.unshift(newReview);
    try {
      localStorage.setItem('collekt_community_reviews', JSON.stringify(allReviews));
    } catch(e) {}

    // If Supabase client is present, also persist
    try {
      if (window.sb && typeof window.sb.from === 'function') {
        window.sb.from('community_reviews').insert([{
          user_id: user.id || null,
          author_name: authorName,
          author_role: authorRole,
          category: cat,
          rating: currentReviewRating,
          speed_rating: currentPerfRating,
          title: title || 'Verified Platform Feedback',
          quote: quote,
          created_at: new Date().toISOString()
        }]).then(()=>{}).catch(()=>{});
      }
    } catch(e) {}

    closeWebsiteReviewModal();

    if (typeof showToast === 'function') {
      showToast('⭐ Thank you for your review! Your feedback is now live on Collekt.', 'success');
    } else if (typeof alert === 'function') {
      alert('⭐ Thank you for your review! Your feedback is now live on Collekt.');
    }

    if (typeof renderCommunityReviews === 'function') {
      renderCommunityReviews();
    }
  }

  /* -- NDPA 2023 SECTION 34: ACCOUNT DELETION MODAL --- */
  let deletionModalBuilt = false;

  function buildDeletionModal() {
    if (document.getElementById('accountDeletionModal')) return;

    const html = `
    <div class="settings-backdrop" id="accountDeletionModal" style="display:none; z-index:9950;">
      <div class="settings-panel" style="max-width:520px; border-color:rgba(239,68,68,0.35); box-shadow:0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(239,68,68,0.2);">
        <div class="settings-header" style="border-bottom-color:rgba(239,68,68,0.15);">
          <div class="settings-title" style="color:#dc2626;">
            <span style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:rgba(239,68,68,0.12); color:#dc2626; font-size:15px;">⚠️</span>
            Permanently Delete Account
          </div>
          <button class="settings-close" id="closeAccountDeletionBtn" type="button" aria-label="Close">✕</button>
        </div>
        
        <div class="settings-body" style="padding:22px 28px 24px; display:flex; flex-direction:column; gap:16px;">
          <!-- Statutory Compliance Badge -->
          <div style="display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:800; color:#dc2626; background:rgba(239,68,68,0.08); padding:6px 12px; border-radius:8px; border:1px solid rgba(239,68,68,0.2); width:fit-content;">
            <span>🇳🇬</span> NDPA 2023 Section 34 &bull; Right to Erasure
          </div>

          <!-- Description -->
          <div style="font-size:13.5px; color:inherit; opacity:0.85; line-height:1.55;">
            <p style="margin:0 0 10px 0;">This action will <strong>permanently purge</strong> your personal profile data, biography, contact details, and delete all uploaded KYC identity documents (NIN, CAC, Passports) from secure cloud storage.</p>
            <p style="margin:0; font-size:12px; opacity:0.75; background:rgba(0,0,0,0.04); padding:10px 12px; border-radius:10px; border:1px dashed rgba(239,68,68,0.25); line-height:1.5;">
              <strong>CBN AML/CFT Notice:</strong> In accordance with Central Bank of Nigeria financial regulations, historical double-entry ledger transactions are retained with anonymized identity placeholders. Accounts with active contracts or positive wallet balances must be settled prior to closure.
            </p>
          </div>

          <!-- Error Alert Box -->
          <div id="deletionModalError" style="display:none; font-size:12.5px; color:#b91c1c; background:rgba(254,242,242,0.9); border:1px solid #fecaca; padding:10px 14px; border-radius:10px; line-height:1.4;"></div>

          <!-- Acknowledgment Checkbox -->
          <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; font-size:13px; font-weight:700; color:inherit;">
            <input type="checkbox" id="confirmDeletionCheckbox" style="margin-top:2px; width:16px; height:16px; accent-color:#dc2626; cursor:pointer;">
            <span>I understand that this action is irreversible and all my KYC identity records and profile data will be permanently destroyed.</span>
          </label>

          <!-- Confirmation Input -->
          <div style="display:flex; flex-direction:column; gap:6px;">
            <label style="font-size:12px; font-weight:800; color:inherit; opacity:0.9;">
              To confirm, type <span style="color:#dc2626; font-family:monospace; font-size:13px; font-weight:900;">DELETE</span> in capital letters below:
            </label>
            <input type="text" id="confirmDeletionTextInput" class="sett-input" placeholder="Type DELETE to enable" style="font-family:monospace; letter-spacing:1px; text-transform:uppercase; border-color:rgba(239,68,68,0.3);" autocomplete="off">
          </div>

          <!-- Actions -->
          <div style="display:flex; align-items:center; justify-content:flex-end; gap:12px; margin-top:8px;">
            <button type="button" class="sett-btn sett-btn-outline" id="cancelAccountDeletionBtn" style="padding:10px 18px;">Cancel</button>
            <button type="button" class="sett-btn sett-btn-danger" id="executeAccountDeletionBtn" disabled style="padding:10px 20px; font-weight:800; background:#ef4444; color:#ffffff; border-color:#dc2626; opacity:0.5; cursor:not-allowed;">Permanently Erase My Account</button>
          </div>
        </div>
      </div>
    </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);

    const modal = document.getElementById('accountDeletionModal');
    const closeBtn = document.getElementById('closeAccountDeletionBtn');
    const cancelBtn = document.getElementById('cancelAccountDeletionBtn');
    const chk = document.getElementById('confirmDeletionCheckbox');
    const txtInput = document.getElementById('confirmDeletionTextInput');
    const execBtn = document.getElementById('executeAccountDeletionBtn');
    const errBox = document.getElementById('deletionModalError');

    function checkEnable() {
      const isChecked = chk && chk.checked;
      const isTyped = txtInput && txtInput.value.trim() === 'DELETE';
      if (isChecked && isTyped) {
        execBtn.disabled = false;
        execBtn.style.opacity = '1';
        execBtn.style.cursor = 'pointer';
      } else {
        execBtn.disabled = true;
        execBtn.style.opacity = '0.5';
        execBtn.style.cursor = 'not-allowed';
      }
    }

    chk?.addEventListener('change', checkEnable);
    txtInput?.addEventListener('input', checkEnable);

    closeBtn?.addEventListener('click', closeAccountDeletionModal);
    cancelBtn?.addEventListener('click', closeAccountDeletionModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeAccountDeletionModal();
    });

    execBtn?.addEventListener('click', async () => {
      if (execBtn.disabled) return;
      execBtn.disabled = true;
      execBtn.innerHTML = '<span>⏳</span> Erasing account...';
      if (errBox) errBox.style.display = 'none';

      try {
        let token = null;
        if (window.sb && window.sb.auth) {
          const { data: sessionData } = await window.sb.auth.getSession();
          token = sessionData?.session?.access_token;
        }

        if (!token) {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
              try {
                const parsed = JSON.parse(localStorage.getItem(k));
                token = parsed?.access_token;
                if (token) break;
              } catch(e) {}
            }
          }
        }

        if (!token) {
          if (errBox) {
            errBox.textContent = 'Session authentication not found. Please log in again.';
            errBox.style.display = 'block';
          }
          execBtn.disabled = false;
          execBtn.textContent = 'Permanently Erase My Account';
          return;
        }

        const resp = await fetch('/api/account-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          }
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || !data.success) {
          if (errBox) {
            errBox.textContent = data.error || 'Failed to erase account. Please contact support.';
            errBox.style.display = 'block';
          }
          execBtn.disabled = false;
          execBtn.textContent = 'Permanently Erase My Account';
          return;
        }

        execBtn.textContent = '✓ Account Erased';
        execBtn.style.background = '#059669';
        execBtn.style.borderColor = '#047857';

        if (window.sb && window.sb.auth) {
          try { await window.sb.auth.signOut(); } catch(e) {}
        }
        localStorage.clear();
        sessionStorage.clear();

        setTimeout(() => {
          window.location.href = 'index.html?account_deleted=true';
        }, 1200);

      } catch (err) {
        console.error('[AccountDelete UI Error]:', err);
        if (errBox) {
          errBox.textContent = 'Network or system error. Please try again or reach out to support.';
          errBox.style.display = 'block';
        }
        execBtn.disabled = false;
        execBtn.textContent = 'Permanently Erase My Account';
      }
    });

    deletionModalBuilt = true;
  }

  function openAccountDeletionModal() {
    const settingsBackdrop = document.getElementById('settingsBackdrop');
    if (settingsBackdrop) {
      settingsBackdrop.classList.remove('open');
      settingsBackdrop.style.display = 'none';
    }

    if (!deletionModalBuilt) buildDeletionModal();

    const modal = document.getElementById('accountDeletionModal');
    if (!modal) return;
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.classList.add('open');
        const txt = document.getElementById('confirmDeletionTextInput');
        if (txt) { txt.value = ''; txt.focus(); }
        const chk = document.getElementById('confirmDeletionCheckbox');
        if (chk) chk.checked = false;
        const execBtn = document.getElementById('executeAccountDeletionBtn');
        if (execBtn) {
          execBtn.disabled = true;
          execBtn.style.opacity = '0.5';
          execBtn.style.cursor = 'not-allowed';
          execBtn.textContent = 'Permanently Erase My Account';
          execBtn.style.background = '#ef4444';
        }
        const errBox = document.getElementById('deletionModalError');
        if (errBox) errBox.style.display = 'none';
      });
    });
  }

  function closeAccountDeletionModal() {
    const modal = document.getElementById('accountDeletionModal');
    if (!modal) return;
    modal.classList.remove('open');
    setTimeout(() => { modal.style.display = 'none'; }, 350);
  }

  window.openAccountDeletionModal = openAccountDeletionModal;
  window.closeAccountDeletionModal = closeAccountDeletionModal;

  window.openWebsiteReviewModal = openWebsiteReviewModal;
  window.closeWebsiteReviewModal = closeWebsiteReviewModal;
  window.setWebsiteRating = setWebsiteRating;
  window.hoverWebsiteRating = hoverWebsiteRating;
  window.resetWebsiteHoverRating = resetWebsiteHoverRating;
  window.setWebsitePerfRating = setWebsitePerfRating;
  window.hoverWebsitePerfRating = hoverWebsitePerfRating;
  window.resetWebsitePerfHoverRating = resetWebsitePerfHoverRating;
  window.submitWebsiteReview = submitWebsiteReview;
  window.updateReviewModalUser = updateReviewModalUser;

  /* -- NDPA 2023 SECTION 33: DATA PORTABILITY EXPORT -- */
  async function exportUserDataJSON() {
    const btn = document.getElementById('sett-export-data-btn');
    const icon = document.getElementById('sett-export-icon');
    const text = document.getElementById('sett-export-text');

    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }
    if (text) text.textContent = 'Generating Archive...';
    if (icon) icon.textContent = '⏳';

    try {
      // 1. Get auth token from Supabase session
      let token = null;
      if (window.sb && window.sb.auth) {
        const { data: sessionData } = await window.sb.auth.getSession();
        token = sessionData?.session?.access_token;
      }
      if (!token) {
        const rawUser = localStorage.getItem('collekt_user');
        if (rawUser) {
          try {
            const u = JSON.parse(rawUser);
            token = u.token;
          } catch(e){}
        }
      }

      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/account-export', {
        method: 'POST',
        headers: headers
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to export data archive`);
      }

      const dataBlob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `collekt-data-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      if (text) text.textContent = 'Exported!';
      if (icon) icon.textContent = '✅';
      setTimeout(() => {
        if (text) text.textContent = 'Export JSON';
        if (icon) icon.textContent = '📥';
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      }, 3000);
    } catch (err) {
      console.error('[NDPA Data Export Error]:', err);
      alert(`⚠️ Data Export Notice: ${err.message || 'Please check your connection and sign in to export your data.'}`);
      if (text) text.textContent = 'Export JSON';
      if (icon) icon.textContent = '📥';
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    }
  }

  /* ========================================================
     TWO-FACTOR AUTHENTICATION (2FA) EMAIL OTP FLOW
     ======================================================== */
  let twoFactorModalBuilt = false;

  function buildTwoFactorModal() {
    if (document.getElementById('twoFactorBackdrop')) return;
    const div = document.createElement('div');
    div.className = 'settings-backdrop';
    div.id = 'twoFactorBackdrop';
    div.style.display = 'none';
    div.style.zIndex = '9950';

    div.innerHTML = `
      <div class="settings-panel" style="max-width:440px; padding:24px 28px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:22px;">🛡️</span>
            <div style="font-size:18px; font-weight:800; color:#0D1F1E;">Two-Factor Authentication</div>
          </div>
          <button type="button" class="settings-close-btn" onclick="closeTwoFactorModal()" style="font-size:22px; background:none; border:none; cursor:pointer;">&times;</button>
        </div>
        <p style="font-size:13px; color:#555; margin-bottom:16px; line-height:1.45;">
          To activate Two-Factor Authentication, enter the 6-digit verification code sent to <strong id="twoFactorEmailBadge" style="color:#0E3B35;">your registered email</strong>:
        </p>
        <div style="margin-bottom:16px;">
          <input type="text" id="twoFactorOtpCode" maxlength="6" inputmode="numeric" placeholder="1 2 3 4 5 6" autocomplete="one-time-code" style="width:100%; height:48px; border-radius:12px; border:1px solid rgba(0,0,0,0.18); text-align:center; font-size:22px; font-weight:900; letter-spacing:0.35em; background:rgba(255,255,255,0.95); box-sizing:border-box;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:12px;">
            <span id="twoFactorTimer" style="color:#888;">⏱ Valid for 10 minutes</span>
            <button type="button" id="twoFactorResendBtn" onclick="resendTwoFactorOtp()" style="background:none; border:none; color:#0E3B35; font-weight:800; cursor:pointer; text-decoration:underline;">Resend Code</button>
          </div>
          <div id="twoFactorErrBox" style="display:none; color:#dc2626; font-size:12px; font-weight:700; margin-top:6px;"></div>
        </div>
        <div style="display:flex; gap:10px;">
          <button type="button" class="sett-btn sett-btn-outline" style="flex:1;" onclick="closeTwoFactorModal()">Cancel</button>
          <button type="button" class="sett-btn sett-btn-primary" id="twoFactorSubmitBtn" style="flex:1.4; background:#0E3B35; color:#fff;" onclick="verifyTwoFactorOtp()">Verify &amp; Enable 2FA</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    twoFactorModalBuilt = true;
  }

  function openTwoFactorModal() {
    if (!twoFactorModalBuilt) buildTwoFactorModal();
    const user = (typeof getUser === 'function' ? getUser() : null) || JSON.parse(localStorage.getItem('collekt_user') || '{}');
    if (!user || !user.email) {
      if (typeof showToast === 'function') showToast('⚠️ Please log in to enable Two-Factor Authentication.', 'warning');
      else alert('Please log in to enable Two-Factor Authentication.');
      return;
    }

    const emailBadge = document.getElementById('twoFactorEmailBadge');
    if (emailBadge) emailBadge.textContent = user.email;

    const codeInput = document.getElementById('twoFactorOtpCode');
    if (codeInput) codeInput.value = '';

    const errBox = document.getElementById('twoFactorErrBox');
    if (errBox) { errBox.textContent = ''; errBox.style.display = 'none'; }

    // Dispatch OTP
    fetch('/api/auth-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_otp',
        email: user.email,
        name: user.name || user.company_name || '',
        purpose: '2fa_setup'
      })
    }).then(r => r.json()).then(d => {
      if (d.success && typeof showToast === 'function') {
        showToast('📧 2FA verification code sent to ' + user.email, 'info');
      }
    }).catch(e => console.warn('2FA OTP dispatch error:', e));

    const backdrop = document.getElementById('twoFactorBackdrop');
    if (backdrop) {
      backdrop.style.display = 'flex';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => backdrop.classList.add('open'));
      });
      setTimeout(() => { if (codeInput) codeInput.focus(); }, 150);
    }
  }

  function closeTwoFactorModal() {
    const backdrop = document.getElementById('twoFactorBackdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      setTimeout(() => { backdrop.style.display = 'none'; }, 350);
    }
  }

  async function resendTwoFactorOtp() {
    const user = (typeof getUser === 'function' ? getUser() : null) || JSON.parse(localStorage.getItem('collekt_user') || '{}');
    if (!user || !user.email) return;
    const btn = document.getElementById('twoFactorResendBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    try {
      const res = await fetch('/api/auth-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_otp',
          email: user.email,
          name: user.name || user.company_name || '',
          purpose: '2fa_setup'
        })
      });
      const d = await res.json();
      if (d.success) {
        if (typeof showToast === 'function') showToast('📧 New code sent to ' + user.email, 'success');
        let count = 30;
        const timer = setInterval(() => {
          count--;
          if (btn) {
            btn.textContent = `Resend in ${count}s`;
            if (count <= 0) {
              clearInterval(timer);
              btn.disabled = false;
              btn.textContent = 'Resend Code';
            }
          }
        }, 1000);
      } else {
        if (typeof showToast === 'function') showToast('⚠️ ' + (d.error || 'Please wait before resending.'), 'warning');
        if (btn) { btn.disabled = false; btn.textContent = 'Resend Code'; }
      }
    } catch(e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Resend Code'; }
    }
  }

  async function verifyTwoFactorOtp() {
    const user = (typeof getUser === 'function' ? getUser() : null) || JSON.parse(localStorage.getItem('collekt_user') || '{}');
    const code = document.getElementById('twoFactorOtpCode')?.value.trim();
    const errBox = document.getElementById('twoFactorErrBox');
    const submitBtn = document.getElementById('twoFactorSubmitBtn');

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      if (errBox) { errBox.textContent = 'Please enter the 6-digit numeric verification code.'; errBox.style.display = 'block'; }
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Verifying...'; }
    if (errBox) errBox.style.display = 'none';

    try {
      const res = await fetch('/api/auth-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_otp',
          email: user.email,
          code: code
        })
      });
      const d = await res.json();
      if (d.success) {
        setSetting('two_factor', true);
        const chk = document.getElementById('sett-2fa');
        if (chk) chk.checked = true;

        const curr = (typeof getUser === 'function' ? getUser() : null) || JSON.parse(localStorage.getItem('collekt_user') || '{}');
        if (curr) {
          curr.two_factor = true;
          curr.two_factor_enabled = true;
          localStorage.setItem('collekt_user', JSON.stringify(curr));
        }
        if (window.sb && curr && curr.id) {
          sb.from('profiles').update({ two_factor_enabled: true }).eq('id', curr.id).then(()=>{}).catch(()=>{});
        }

        closeTwoFactorModal();
        if (typeof showToast === 'function') showToast('🛡️ Two-Factor Authentication enabled successfully!', 'success');
        else alert('Two-Factor Authentication enabled successfully!');
      } else {
        if (errBox) { errBox.textContent = d.error || 'Invalid or expired verification code.'; errBox.style.display = 'block'; }
      }
    } catch(e) {
      if (errBox) { errBox.textContent = 'Verification error. Please check your network and try again.'; errBox.style.display = 'block'; }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Verify & Enable 2FA'; }
    }
  }

  /* ========================================================
     PASSWORD CHANGE EMAIL OTP FLOW
     ======================================================== */
  let changePwModalBuilt = false;
  let _verifiedChangePwCode = null;

  function buildChangePasswordModal() {
    if (document.getElementById('changePasswordBackdrop')) return;
    const div = document.createElement('div');
    div.className = 'settings-backdrop';
    div.id = 'changePasswordBackdrop';
    div.style.display = 'none';
    div.style.zIndex = '9950';

    div.innerHTML = `
      <div class="settings-panel" style="max-width:440px; padding:24px 28px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:22px;">🔑</span>
            <div style="font-size:18px; font-weight:800; color:#0D1F1E;" id="changePwModalTitle">Change Password</div>
          </div>
          <button type="button" class="settings-close-btn" onclick="closeChangePasswordModal()" style="font-size:22px; background:none; border:none; cursor:pointer;">&times;</button>
        </div>

        <!-- STEP 1: EMAIL OTP -->
        <div id="changePwStepOtp">
          <p style="font-size:13px; color:#555; margin-bottom:16px; line-height:1.45;">
            For your security, enter the 6-digit verification code sent to <strong id="changePwEmailBadge" style="color:#0E3B35;">your registered email</strong>:
          </p>
          <div style="margin-bottom:16px;">
            <input type="text" id="changePwOtpCode" maxlength="6" inputmode="numeric" placeholder="1 2 3 4 5 6" autocomplete="one-time-code" style="width:100%; height:48px; border-radius:12px; border:1px solid rgba(0,0,0,0.18); text-align:center; font-size:22px; font-weight:900; letter-spacing:0.35em; background:rgba(255,255,255,0.95); box-sizing:border-box;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:12px;">
              <span id="changePwTimer" style="color:#888;">⏱ Valid for 10 minutes</span>
              <button type="button" id="changePwResendBtn" onclick="resendChangePwOtp()" style="background:none; border:none; color:#0E3B35; font-weight:800; cursor:pointer; text-decoration:underline;">Resend Code</button>
            </div>
            <div id="changePwErrBox" style="display:none; color:#dc2626; font-size:12px; font-weight:700; margin-top:6px;"></div>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="sett-btn sett-btn-outline" style="flex:1;" onclick="closeChangePasswordModal()">Cancel</button>
            <button type="button" class="sett-btn sett-btn-primary" id="changePwVerifyBtn" style="flex:1.4; background:#0E3B35; color:#fff;" onclick="verifyChangePwOtp()">Verify &amp; Continue &rarr;</button>
          </div>
        </div>

        <!-- STEP 2: ENTER NEW PASSWORD -->
        <div id="changePwStepInputs" style="display:none;">
          <p style="font-size:13px; color:#555; margin-bottom:14px; line-height:1.4;">
            ✅ Authorization verified! Choose a new secure password (minimum 8 characters).
          </p>
          <div style="margin-bottom:12px;">
            <label style="font-size:12px; font-weight:700; color:#333; display:block; margin-bottom:4px;">New Password</label>
            <input type="password" id="changePwNewPass" placeholder="Enter new password (min 8 chars)" style="width:100%; height:42px; border-radius:10px; border:1px solid rgba(0,0,0,0.18); padding:0 12px; font-size:14px; box-sizing:border-box;">
          </div>
          <div style="margin-bottom:16px;">
            <label style="font-size:12px; font-weight:700; color:#333; display:block; margin-bottom:4px;">Confirm New Password</label>
            <input type="password" id="changePwConfirmPass" placeholder="Confirm new password" style="width:100%; height:42px; border-radius:10px; border:1px solid rgba(0,0,0,0.18); padding:0 12px; font-size:14px; box-sizing:border-box;">
            <div id="changePwStep2ErrBox" style="display:none; color:#dc2626; font-size:12px; font-weight:700; margin-top:6px;"></div>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="sett-btn sett-btn-outline" style="flex:1;" onclick="closeChangePasswordModal()">Cancel</button>
            <button type="button" class="sett-btn sett-btn-primary" id="changePwSaveBtn" style="flex:1.4; background:#0E3B35; color:#fff;" onclick="executeSaveNewPassword()">Update Password</button>
          </div>
        </div>

      </div>
    `;
    document.body.appendChild(div);
    changePwModalBuilt = true;
  }

  function openChangePasswordModal() {
    if (!changePwModalBuilt) buildChangePasswordModal();
    const user = (typeof getUser === 'function' ? getUser() : null) || JSON.parse(localStorage.getItem('collekt_user') || '{}');
    if (!user || !user.email) {
      if (typeof showToast === 'function') showToast('⚠️ Please log in to change your password.', 'warning');
      else alert('Please log in to change your password.');
      return;
    }

    _verifiedChangePwCode = null;

    const emailBadge = document.getElementById('changePwEmailBadge');
    if (emailBadge) emailBadge.textContent = user.email;

    const stepOtp = document.getElementById('changePwStepOtp');
    const stepInputs = document.getElementById('changePwStepInputs');
    if (stepOtp) stepOtp.style.display = 'block';
    if (stepInputs) stepInputs.style.display = 'none';

    const codeInput = document.getElementById('changePwOtpCode');
    if (codeInput) codeInput.value = '';

    const newPass = document.getElementById('changePwNewPass');
    const confirmPass = document.getElementById('changePwConfirmPass');
    if (newPass) newPass.value = '';
    if (confirmPass) confirmPass.value = '';

    const errBox = document.getElementById('changePwErrBox');
    if (errBox) { errBox.textContent = ''; errBox.style.display = 'none'; }
    const errBox2 = document.getElementById('changePwStep2ErrBox');
    if (errBox2) { errBox2.textContent = ''; errBox2.style.display = 'none'; }

    // Dispatch OTP
    fetch('/api/auth-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_otp',
        email: user.email,
        name: user.name || user.company_name || '',
        purpose: 'password_change'
      })
    }).then(r => r.json()).then(d => {
      if (d.success && typeof showToast === 'function') {
        showToast('📧 Password change authorization code sent to ' + user.email, 'info');
      }
    }).catch(e => console.warn('Password change OTP error:', e));

    const backdrop = document.getElementById('changePasswordBackdrop');
    if (backdrop) {
      backdrop.style.display = 'flex';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => backdrop.classList.add('open'));
      });
      setTimeout(() => { if (codeInput) codeInput.focus(); }, 150);
    }
  }

  function closeChangePasswordModal() {
    const backdrop = document.getElementById('changePasswordBackdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      setTimeout(() => { backdrop.style.display = 'none'; }, 350);
    }
  }

  async function resendChangePwOtp() {
    const user = (typeof getUser === 'function' ? getUser() : null) || JSON.parse(localStorage.getItem('collekt_user') || '{}');
    if (!user || !user.email) return;
    const btn = document.getElementById('changePwResendBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    try {
      const res = await fetch('/api/auth-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_otp',
          email: user.email,
          name: user.name || user.company_name || '',
          purpose: 'password_change'
        })
      });
      const d = await res.json();
      if (d.success) {
        if (typeof showToast === 'function') showToast('📧 New code sent to ' + user.email, 'success');
        let count = 30;
        const timer = setInterval(() => {
          count--;
          if (btn) {
            btn.textContent = `Resend in ${count}s`;
            if (count <= 0) {
              clearInterval(timer);
              btn.disabled = false;
              btn.textContent = 'Resend Code';
            }
          }
        }, 1000);
      } else {
        if (typeof showToast === 'function') showToast('⚠️ ' + (d.error || 'Please wait before resending.'), 'warning');
        if (btn) { btn.disabled = false; btn.textContent = 'Resend Code'; }
      }
    } catch(e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Resend Code'; }
    }
  }

  async function verifyChangePwOtp() {
    const user = (typeof getUser === 'function' ? getUser() : null) || JSON.parse(localStorage.getItem('collekt_user') || '{}');
    const code = document.getElementById('changePwOtpCode')?.value.trim();
    const errBox = document.getElementById('changePwErrBox');
    const verifyBtn = document.getElementById('changePwVerifyBtn');

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      if (errBox) { errBox.textContent = 'Please enter the 6-digit numeric verification code.'; errBox.style.display = 'block'; }
      return;
    }

    if (verifyBtn) { verifyBtn.disabled = true; verifyBtn.textContent = 'Verifying...'; }
    if (errBox) errBox.style.display = 'none';

    try {
      const res = await fetch('/api/auth-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_otp',
          email: user.email,
          code: code
        })
      });
      const d = await res.json();
      if (d.success) {
        _verifiedChangePwCode = code;
        const stepOtp = document.getElementById('changePwStepOtp');
        const stepInputs = document.getElementById('changePwStepInputs');
        if (stepOtp) stepOtp.style.display = 'none';
        if (stepInputs) stepInputs.style.display = 'block';
        if (typeof showToast === 'function') showToast('✅ Authorization verified! Please choose your new password.', 'success');
        const newPass = document.getElementById('changePwNewPass');
        setTimeout(() => { if (newPass) newPass.focus(); }, 100);
      } else {
        if (errBox) { errBox.textContent = d.error || 'Invalid or expired verification code.'; errBox.style.display = 'block'; }
      }
    } catch(e) {
      if (errBox) { errBox.textContent = 'Verification error. Please try again.'; errBox.style.display = 'block'; }
    } finally {
      if (verifyBtn) { verifyBtn.disabled = false; verifyBtn.innerHTML = 'Verify &amp; Continue &rarr;'; }
    }
  }

  async function executeSaveNewPassword() {
    const user = (typeof getUser === 'function' ? getUser() : null) || JSON.parse(localStorage.getItem('collekt_user') || '{}');
    const p1 = document.getElementById('changePwNewPass')?.value.trim();
    const p2 = document.getElementById('changePwConfirmPass')?.value.trim();
    const errBox = document.getElementById('changePwStep2ErrBox');
    const saveBtn = document.getElementById('changePwSaveBtn');

    if (!p1 || p1.length < 8) {
      if (errBox) { errBox.textContent = 'Password must be at least 8 characters long.'; errBox.style.display = 'block'; }
      return;
    }
    if (p1 !== p2) {
      if (errBox) { errBox.textContent = 'Passwords do not match. Please re-enter.'; errBox.style.display = 'block'; }
      return;
    }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Updating...'; }
    if (errBox) errBox.style.display = 'none';

    try {
      // 1. If Supabase auth session is active
      if (window.sb && window.sb.auth) {
        const { error: sbErr } = await window.sb.auth.updateUser({ password: p1 });
        if (sbErr) console.warn('Supabase updateUser notice:', sbErr.message);
      }

      // 2. Also execute via serverless reset_password for full database sync
      if (_verifiedChangePwCode) {
        await fetch('/api/auth-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset_password',
            email: user.email,
            code: _verifiedChangePwCode,
            new_password: p1
          })
        }).catch(() => {});
      }

      closeChangePasswordModal();
      if (typeof showToast === 'function') showToast('🎉 Password successfully updated!', 'success');
      else alert('Password successfully updated!');

    } catch (e) {
      if (errBox) { errBox.textContent = 'Could not update password. Please try again.'; errBox.style.display = 'block'; }
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Update Password'; }
    }
  }

  window.openTwoFactorModal = openTwoFactorModal;
  window.closeTwoFactorModal = closeTwoFactorModal;
  window.resendTwoFactorOtp = resendTwoFactorOtp;
  window.verifyTwoFactorOtp = verifyTwoFactorOtp;

  window.openChangePasswordModal = openChangePasswordModal;
  window.closeChangePasswordModal = closeChangePasswordModal;
  window.resendChangePwOtp = resendChangePwOtp;
  window.verifyChangePwOtp = verifyChangePwOtp;
  window.executeSaveNewPassword = executeSaveNewPassword;

  window.exportUserDataJSON = exportUserDataJSON;

  /* -- EXPORT PUBLIC API ------------------------------- */
  window.openSettingsModal = openSettingsModal;
  window.closeSettingsModal = closeSettingsModal;

})();

