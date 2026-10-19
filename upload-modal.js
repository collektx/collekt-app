/**
 * ----------------------------------------------------------
 *  COLLEKT &rarr; upload-modal.js
 *  A universal file upload / job-posting modal.
 *
 *  Usage:
 *    <script src="upload-modal.js"></script>
 *
 *  API:
 *    window.openUploadModal(type, callback)
 *
 *  Types:
 *    'avatar'      &rarr; image upload with circular preview
 *    'cv'          &rarr; PDF/DOC upload
 *    'document'    &rarr; generic document upload
 *    'job-posting' &rarr; structured job posting form
 *
 *  callback(file) is called after a successful upload / submit.
 * ----------------------------------------------------------
 */
(function () {
  'use strict';

  /* -- STYLE INJECTION ------------------------------- */
  const CSS = `
  /* -- Backdrop ------------------- */
  .upload-backdrop {
    position: fixed; inset: 0; z-index: 9950;
    background: rgba(4, 14, 13, 0.74);
    backdrop-filter: blur(10px);
    opacity: 0; pointer-events: none;
    transition: opacity 0.5s cubic-bezier(.22,.61,.36,1);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
  }
  .upload-backdrop.open { opacity: 1; pointer-events: all; }

  /* -- Panel ---------------------- */
  .upload-panel {
    background: #fff;
    border-radius: 22px;
    box-shadow: 0 32px 80px rgba(14,59,53,.22), 0 0 0 1px rgba(14,59,53,.06);
    max-width: 540px; width: 100%;
    max-height: 92vh;
    display: flex; flex-direction: column;
    transform: translateY(32px) scale(.97);
    transition: transform 0.5s cubic-bezier(.22,.61,.36,1);
    overflow: hidden;
  }
  .upload-backdrop.open .upload-panel { transform: translateY(0) scale(1); }

  /* -- Header --------------------- */
  .upload-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 22px 28px 18px;
    border-bottom: 1px solid #DDE8E6; flex-shrink: 0;
  }
  .upload-title {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 18px; font-weight: 900; color: #111918;
  }
  .upload-close {
    width: 36px; height: 36px; border-radius: 50%;
    background: #F4F8F7; border: 1px solid #DDE8E6;
    color: #6B8280; font-size: 16px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all 0.5s cubic-bezier(.22,.61,.36,1);
  }
  .upload-close:hover {
    background: #0E3B35; color: #fff; border-color: #0E3B35;
    transform: rotate(90deg) scale(1.05);
  }

  /* -- Body ----------------------- */
  .upload-body {
    padding: 24px 28px; overflow-y: auto; flex: 1;
    scrollbar-width: thin; scrollbar-color: #DDE8E6 transparent;
  }
  .upload-body::-webkit-scrollbar { width: 5px; }
  .upload-body::-webkit-scrollbar-thumb { background: #DDE8E6; border-radius: 99px; }

  /* -- Drop Zone ------------------ */
  .upload-dropzone {
    border: 2.5px dashed #DDE8E6; border-radius: 16px;
    padding: 36px 24px; text-align: center; cursor: pointer;
    transition: all 0.35s cubic-bezier(.22,.61,.36,1);
    background: #F4F8F7; position: relative;
    overflow: hidden; user-select: none;
  }
  .upload-dropzone:hover, .upload-dropzone.drag-over {
    border-color: #13756F; background: #D4EFEC;
    transform: scale(1.01);
  }
  .upload-dropzone.drag-over { box-shadow: 0 0 0 4px rgba(19,117,111,.18); }
  .upload-dropzone.file-loaded {
    border-style: solid;
    border-color: #16a34a;
    background: rgba(22, 163, 74, 0.08);
    padding: 24px 20px;
  }
  .upload-icon { font-size: 44px; margin-bottom: 12px; transition: transform 0.4s cubic-bezier(.22,.61,.36,1); display: flex; justify-content: center; align-items: center; }
  .upload-dropzone:hover .upload-icon { transform: scale(1.08) translateY(-3px); }
  .upload-main-text {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 15px; font-weight: 800; color: #111918; margin-bottom: 6px;
  }
  .upload-main-text span { color: #13756F; text-decoration: underline; }
  .upload-formats-text {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 12px; color: #6B8280; font-weight: 600;
  }
  .upload-size-text {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 11px; color: #6B8280; margin-top: 6px;
  }
  .upload-quick-actions {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    flex-wrap: wrap; margin-top: 14px;
  }
  .upload-quick-btn {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 12px; font-weight: 800;
    padding: 7px 14px; border-radius: 9px;
    border: 1.5px solid #13756F; background: #fff; color: #13756F;
    cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
    transition: all 0.2s ease;
  }
  .upload-quick-btn:hover {
    background: #13756F; color: #fff;
  }
  .upload-quick-btn.primary-pick {
    background: #13756F; color: #fff;
  }
  .upload-quick-btn.primary-pick:hover {
    background: #0E3B35; border-color: #0E3B35;
  }

  /* -- Avatar preview circle ------- */
  .avatar-preview-wrap {
    display: flex; justify-content: center; margin-top: 16px;
    transition: all 0.5s cubic-bezier(.22,.61,.36,1);
  }
  .avatar-preview-circle {
    width: 96px; height: 96px; border-radius: 50%;
    border: 3px solid #13756F;
    object-fit: cover; display: none;
    box-shadow: 0 8px 28px rgba(19,117,111,.22);
    transition: all 0.6s cubic-bezier(.22,.61,.36,1);
  }
  .avatar-preview-circle.visible { display: block; }

  /* -- CV preview ----------------- */
  .cv-preview {
    display: none; align-items: center; justify-content: space-between; gap: 14px;
    padding: 14px 16px; border-radius: 12px; border: 1.5px solid #16a34a;
    background: rgba(22, 163, 74, 0.06); margin-top: 14px;
    transition: all 0.5s cubic-bezier(.22,.61,.36,1);
  }
  .cv-preview.visible { display: flex; }
  .cv-icon-large { font-size: 32px; flex-shrink: 0; display: flex; align-items: center; }
  .cv-filename {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 14px; font-weight: 800; color: #111918;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 280px;
  }
  .cv-filesize {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 12px; color: #16a34a; font-weight: 700;
  }

  /* -- Progress bar --------------- */
  .upload-progress-wrap {
    margin-top: 18px; display: none;
    transition: all 0.5s cubic-bezier(.22,.61,.36,1);
  }
  .upload-progress-wrap.visible { display: block; }
  .upload-progress-label {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 12px; font-weight: 700; color: #6B8280;
    display: flex; justify-content: space-between; margin-bottom: 8px;
  }
  .upload-progress-bar {
    height: 8px; border-radius: 99px; background: #DDE8E6; overflow: hidden;
  }
  .upload-progress-fill {
    height: 100%; width: 0%; border-radius: 99px;
    background: linear-gradient(90deg, #13756F, #1A9E96);
    transition: width 0.3s cubic-bezier(.22,.61,.36,1);
  }
  .upload-status-text {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 12px; color: #13756F; font-weight: 700;
    margin-top: 8px; text-align: center; min-height: 18px;
  }

  /* -- Actions -------------------- */
  .upload-actions {
    display: flex; gap: 12px; justify-content: flex-end;
    padding: 16px 28px 22px; border-top: 1px solid #DDE8E6; flex-shrink: 0;
  }
  .upload-btn {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 14px; font-weight: 800;
    padding: 0 24px; min-height: 44px; border-radius: 10px;
    cursor: pointer; transition: all 0.35s cubic-bezier(.22,.61,.36,1);
    border: 1.5px solid transparent; display: inline-flex; align-items: center; gap: 6px;
  }
  .upload-btn-cancel {
    background: #fff; color: #3E5250; border-color: #DDE8E6;
  }
  .upload-btn-cancel:hover { background: #F4F8F7; border-color: #3E5250; }
  .upload-btn-primary {
    background: #D4920B; color: #fff;
    box-shadow: 0 6px 20px rgba(212,146,11,.28);
  }
  .upload-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(212,146,11,.42); }
  .upload-btn-primary:disabled { opacity: .45; cursor: not-allowed; transform: none; box-shadow: none; }

  /* -- Job Posting Form ------------ */
  .job-form-group { margin-bottom: 18px; }
  .job-form-label {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 12px; font-weight: 800; color: #6B8280;
    text-transform: uppercase; letter-spacing: .06em;
    display: block; margin-bottom: 7px;
  }
  .job-form-input {
    width: 100%; padding: 11px 14px; border-radius: 10px;
    border: 1.5px solid #DDE8E6;
    font-family: Manrope, system-ui, sans-serif;
    font-size: 14px; font-weight: 600; color: #111918;
    background: #fff; outline: none;
    transition: border-color 0.5s cubic-bezier(.22,.61,.36,1), box-shadow 0.5s cubic-bezier(.22,.61,.36,1);
  }
  .job-form-input:focus { border-color: #13756F; box-shadow: 0 0 0 3px rgba(19,117,111,.12); }
  .job-form-input::placeholder { color: #9BB5B2; font-weight: 500; }
  .job-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .job-form-textarea { resize: vertical; min-height: 100px; }

  /* -- Tag input ------------------ */
  .tag-input-wrap {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
    padding: 8px 10px; border-radius: 10px; border: 1.5px solid #DDE8E6;
    cursor: text; min-height: 44px;
    transition: border-color 0.5s cubic-bezier(.22,.61,.36,1);
  }
  .tag-input-wrap:focus-within { border-color: #13756F; box-shadow: 0 0 0 3px rgba(19,117,111,.12); }
  .tag-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 99px;
    background: #D4EFEC; color: #13756F;
    font-size: 12px; font-weight: 800;
    transition: all 0.4s cubic-bezier(.22,.61,.36,1);
  }
  .tag-chip:hover { background: #13756F; color: #fff; }
  .tag-chip-remove { cursor: pointer; font-size: 11px; opacity: .7; }
  .tag-chip-remove:hover { opacity: 1; }
  .tag-input-field {
    border: none; outline: none; flex: 1; min-width: 80px;
    font-family: Manrope, system-ui, sans-serif;
    font-size: 13px; font-weight: 600; color: #111918;
    background: transparent;
  }
  .tag-input-field::placeholder { color: #9BB5B2; }

  /* -- Page dropzone highlight ---- */
  .collekt-drop-target-active {
    border-color: #13756F !important;
    background: rgba(19, 117, 111, 0.12) !important;
    box-shadow: 0 0 0 4px rgba(19, 117, 111, 0.22) !important;
    transform: scale(1.01);
    transition: all 0.2s ease !important;
  }

  /* -- Dark mode ------------------ */
  html.dark .upload-panel { background: #0f2220; }
  html.dark .upload-title { color: #e2efed; }
  html.dark .upload-header { border-color: rgba(255,255,255,.07); }
  html.dark .upload-close { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); color: rgba(255,255,255,.6); }
  html.dark .upload-close:hover { background: #0E3B35; color: #fff; }
  html.dark .upload-dropzone { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.14); }
  html.dark .upload-dropzone:hover, html.dark .upload-dropzone.drag-over { background: rgba(19,117,111,.15); border-color: #13756F; }
  html.dark .upload-dropzone.file-loaded { background: rgba(22, 163, 74, 0.12); border-color: #22c55e; }
  html.dark .upload-main-text { color: #e2efed; }
  html.dark .upload-quick-btn { background: rgba(255,255,255,.06); color: #5eead4; border-color: rgba(94,234,212,.35); }
  html.dark .upload-quick-btn:hover, html.dark .upload-quick-btn.primary-pick { background: #13756F; color: #fff; border-color: #13756F; }
  html.dark .upload-actions { border-color: rgba(255,255,255,.07); }
  html.dark .upload-btn-cancel { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); color: rgba(255,255,255,.7); }
  html.dark .job-form-input { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); color: #e2efed; }
  html.dark .tag-input-wrap { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); }
  html.dark .tag-input-field { color: #e2efed; }
  html.dark .cv-preview { background: rgba(22,163,74,.1); border-color: rgba(34,197,94,.4); }
  html.dark .cv-filename { color: #e2efed; }
  `;

  const style = document.createElement('style');
  style.id = 'collekt-upload-css';
  style.textContent = CSS;
  document.head.appendChild(style);

  function _escHtml(str) {
    if (typeof window.escapeHTML === 'function') return window.escapeHTML(str);
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _formatSize(bytes) {
    if (!bytes || isNaN(bytes)) return '0 KB';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /* -- TYPE CONFIG ----------------------------------- */
  const DOC_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const TYPE_CONFIG = {
    avatar: {
      title: 'Upload Profile Photo',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      accept: 'image/*,.jpg,.jpeg,.png,.webp',
      formats: 'JPG, PNG, WebP',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'avatar',
      storageCategory: 'avatar',
    },
    'company-logo': {
      title: 'Upload Company Logo',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      accept: 'image/*,.jpg,.jpeg,.png,.webp,.svg',
      formats: 'JPG, PNG, WebP, SVG',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'avatar',
      storageCategory: 'company-logo',
    },
    'cover-photo': {
      title: 'Upload Cover Photo / Header Banner',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      accept: 'image/*,.jpg,.jpeg,.png,.webp',
      formats: 'JPG, PNG, WebP',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'banner',
      storageCategory: 'cover-photo',
    },
    'cover-letter': {
      title: 'Upload Master Cover Letter',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      accept: DOC_ACCEPT,
      formats: 'PDF, DOC, DOCX, JPG, PNG',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'cover-letter',
    },
    cv: {
      title: 'Upload Your CV',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      accept: DOC_ACCEPT,
      formats: 'PDF, DOC, DOCX, JPG, PNG',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'cv',
    },
    document: {
      title: 'Upload Document',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      accept: DOC_ACCEPT + ',.xlsx,.pptx',
      formats: 'PDF, DOC, DOCX, JPG, PNG, WebP',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'documents',
    },
    'nin-doc': {
      title: 'Upload NIN Slip / National ID',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2"/><path d="M15 12h2"/><path d="M7 16h10"/></svg>',
      accept: DOC_ACCEPT,
      formats: 'PDF, JPG, PNG, WebP, DOC',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'nin_doc',
    },
    'gov-id-doc': {
      title: 'Upload Government ID Document',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2"/><path d="M15 12h2"/><path d="M7 16h10"/></svg>',
      accept: DOC_ACCEPT,
      formats: 'PDF, JPG, PNG, WebP, DOC',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'gov_id_doc',
    },
    'address-doc': {
      title: 'Upload Proof of Address Document',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      accept: DOC_ACCEPT,
      formats: 'PDF, JPG, PNG, DOC, DOCX',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'address_doc',
    },
    'cac-doc': {
      title: 'Upload CAC Certificate / Status Report',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>',
      accept: DOC_ACCEPT,
      formats: 'PDF, DOC, JPG, PNG',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'cac_doc',
    },
    'tin-doc': {
      title: 'Upload Tax Clearance / TIN Certificate',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>',
      accept: DOC_ACCEPT,
      formats: 'PDF, DOC, JPG, PNG',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'tin_doc',
    },
    'director-id-doc': {
      title: 'Upload Director Government ID',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2"/><path d="M15 12h2"/><path d="M7 16h10"/></svg>',
      accept: DOC_ACCEPT,
      formats: 'PDF, JPG, PNG, WebP, DOC',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'director_id_doc',
    },
    portfolio: {
      title: 'Upload Portfolio Item',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      accept: DOC_ACCEPT,
      formats: 'JPG, PNG, WebP, PDF, DOC',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'portfolio',
    },
    certifications: {
      title: 'Upload Certification',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
      accept: DOC_ACCEPT,
      formats: 'PDF, DOC, JPG, PNG',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'certifications',
    },
    'company-docs': {
      title: 'Upload Company Document',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>',
      accept: DOC_ACCEPT + ',.xlsx,.xls',
      formats: 'PDF, DOC, XLSX, JPG, PNG',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'company-docs',
    },
    'job-posting': {
      title: 'Post Opportunity',
    },
  };

  /* -- STATE ----------------------------------------- */
  let _currentCallback = null;
  let _currentType = null;
  let _selectedFile = null;
  let _selectedDataURL = null;
  let _fileReadPromise = null;
  let _tagList = [];

  /* -- RENDER FILE UPLOAD CONTENT -------------------- */
  function renderFileUploadContent(cfg) {
    let existingBanner = '';
    const category = cfg.storageCategory || cfg.previewType;
    const existing = typeof getUploadedFiles === 'function' ? getUploadedFiles(category) : [];
    if (existing && existing.length > 0) {
      const latest = existing[existing.length - 1] || existing[0];
      window._latestModalExistingDoc = latest;
      existingBanner = `
        <div style="background:rgba(19,117,111,0.08); border:1.5px dashed rgba(19,117,111,0.4); border-radius:12px; padding:12px 16px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
            <span style="display:inline-flex; align-items:center; flex-shrink:0;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>
            <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              <div style="font-size:13px; font-weight:800; color:var(--ink, #111918); overflow:hidden; text-overflow:ellipsis;">${_escHtml(latest.name || 'Uploaded_Document.pdf')}</div>
              <div style="font-size:11px; color:#16a34a; font-weight:800;">Current file on profile</div>
            </div>
          </div>
          <button type="button" id="uploadViewExistingBtn" style="background:#13756f; color:#fff; border:none; padding:6px 12px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; flex-shrink:0; display:inline-flex; align-items:center; gap:4px;">View File</button>
        </div>
      `;
    }

    return `
      ${existingBanner}
      <input type="file" id="uploadFileInput" accept="${cfg.accept}" style="display:none !important;" aria-label="Choose file">
      <div class="upload-dropzone" id="uploadDropzone" role="button" tabindex="0" aria-label="Click, drag and drop, or paste file to upload">
        <div id="uploadDropzoneInner">
          <div class="upload-icon" id="uploadIcon">${cfg.icon}</div>
          <div class="upload-main-text" id="uploadMainText">${existing.length > 0 ? 'Drag &amp; drop replacement file here, <span>click to browse</span>, or paste (Ctrl+V)' : 'Drag &amp; drop your file here, <span>click to browse</span>, or paste (Ctrl+V)'}</div>
          <div class="upload-formats-text" id="uploadFormatsText">Supported formats: ${cfg.formats}</div>
          <div class="upload-size-text" id="uploadSizeText">Maximum file size: ${cfg.maxMB}MB &bull; Supports Drag &amp; Drop + Copy &amp; Paste</div>
          <div class="upload-quick-actions">
            <button type="button" class="upload-quick-btn primary-pick" id="uploadBrowseBtn">Choose File</button>
            <button type="button" class="upload-quick-btn" id="uploadPasteBtn">Paste from Clipboard (Ctrl+V)</button>
          </div>
        </div>
      </div>
      <div id="uploadSecurityAlert" style="display:none; margin-top:12px; padding:12px 14px; background:rgba(239,68,68,0.12); border:1.5px solid rgba(239,68,68,0.4); border-radius:10px; font-size:12px; color:#ef4444; font-weight:700; line-height:1.4;"></div>

      ${cfg.previewType === 'avatar' ? `
      <div class="avatar-preview-wrap" id="avatarPreviewWrap">
        <img class="avatar-preview-circle" id="avatarPreview" alt="Avatar preview" src="">
      </div>
      ` : ''}

      <div class="cv-preview" id="cvPreview">
        <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1;">
          <div class="cv-icon-large" id="cvIconLarge" style="display:flex; justify-content:center; align-items:center;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
          <div style="min-width:0; flex:1;">
            <div class="cv-filename" id="cvFilename">Selected file</div>
            <div class="cv-filesize" id="cvFilesize">Ready to upload</div>
          </div>
        </div>
        <button type="button" class="upload-quick-btn" id="uploadChangeFileBtn" style="padding:5px 10px; font-size:11px; flex-shrink:0;">Change File</button>
      </div>

      <div class="upload-progress-wrap" id="uploadProgressWrap">
        <div class="upload-progress-label">
          <span id="uploadProgressLabel">Uploading...</span>
          <span id="uploadProgressPct">0%</span>
        </div>
        <div class="upload-progress-bar">
          <div class="upload-progress-fill" id="uploadProgressFill"></div>
        </div>
        <div class="upload-status-text" id="uploadStatusText"></div>
      </div>
      <div style="margin-top:14px; padding:10px 12px; background:rgba(20,184,166,0.08); border:1px solid rgba(20,184,166,0.25); border-radius:10px; font-size:11px; color:var(--teal, #14b8a6); line-height:1.4; display:flex; align-items:center; gap:8px;">
        <span><strong>NDPA 2023 Statutory Protection:</strong> Your uploaded documents are encrypted with AES-256 and processed solely for lawful platform verification and project matching.</span>
      </div>
    `;
  }

  /* -- RENDER JOB POSTING CONTENT -------------------- */
  function renderJobPostingContent() {
    let companyName = '';
    try {
      const user = JSON.parse(localStorage.getItem('collekt_user') || '{}');
      companyName = user.name || user.company || '';
    } catch (e) {}

    return `
      <div class="job-form-group">
        <label class="job-form-label" for="jobTitle">Job Title *</label>
        <input class="job-form-input" type="text" id="jobTitle" placeholder="e.g. Senior Proposal Engineer" required>
      </div>
      <div class="job-form-group">
        <label class="job-form-label" for="jobCompany">Company</label>
        <input class="job-form-input" type="text" id="jobCompany" placeholder="Your company name" value="${_escHtml(companyName)}">
      </div>
      <div class="job-form-row">
        <div class="job-form-group" style="margin-bottom:0;">
          <label class="job-form-label" for="jobBudget">Budget (₦)</label>
          <input class="job-form-input" type="number" id="jobBudget" placeholder="e.g. 500000" min="0">
        </div>
        <div class="job-form-group" style="margin-bottom:0;">
          <label class="job-form-label" for="jobDeadline">Application Deadline</label>
          <input class="job-form-input" type="date" id="jobDeadline">
        </div>
      </div>
      <div class="job-form-group" style="margin-top:18px;">
        <label class="job-form-label" for="jobDescription">Description *</label>
        <textarea class="job-form-input job-form-textarea" id="jobDescription" placeholder="Describe the project scope, deliverables, and requirements..."></textarea>
      </div>
      <div class="job-form-group">
        <label class="job-form-label" for="jobSkillsInput">Required Skills</label>
        <div class="tag-input-wrap" id="tagInputWrap">
          <input class="tag-input-field" id="jobSkillsInput" type="text" placeholder="Type a skill and press Enter">
        </div>
      </div>
    `;
  }

  /* -- OPEN MODAL ------------------------------------ */
  function openUploadModal(type, callback, preloadedFile) {
    _currentType = type;
    _currentCallback = callback || null;
    _selectedFile = null;
    _selectedDataURL = null;
    _fileReadPromise = null;
    _tagList = [];

    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.document;
    if (!cfg) {
      console.warn('[UploadModal] Unknown type:', type);
      return;
    }

    const existing = document.getElementById('uploadBackdrop');
    if (existing) existing.remove();

    const isJobPosting = (type === 'job-posting');
    const isFileUpload = !isJobPosting;

    const modal = document.createElement('div');
    modal.className = 'upload-backdrop';
    modal.id = 'uploadBackdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'uploadTitle');
    modal.innerHTML = `
      <div class="upload-panel" id="uploadPanel">
        <div class="upload-header">
          <div class="upload-title" id="uploadTitle">${cfg.title}</div>
          <button class="upload-close" id="uploadCloseBtn" aria-label="Close"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="upload-body" id="uploadBody">
          ${isFileUpload ? renderFileUploadContent(cfg) : renderJobPostingContent()}
        </div>
        <div class="upload-actions">
          <button type="button" class="upload-btn upload-btn-cancel" id="uploadCancelBtn">Cancel</button>
          <button type="button" class="upload-btn upload-btn-primary" id="uploadSubmitBtn" ${isFileUpload ? 'disabled' : ''}>
            ${isJobPosting ? 'Post Opportunity' : 'Upload Document'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => modal.classList.add('open'));
    });

    const closeBtn = document.getElementById('uploadCloseBtn');
    const cancelBtn = document.getElementById('uploadCancelBtn');
    closeBtn.addEventListener('click', closeUploadModal);
    cancelBtn.addEventListener('click', closeUploadModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeUploadModal(); });
    document.addEventListener('keydown', _escListener);

    if (isFileUpload) {
      _bindFileUploadEvents(cfg);
      document.addEventListener('paste', _modalPasteListener);
      if (preloadedFile && preloadedFile instanceof Blob) {
        _handleFileSelected(preloadedFile, cfg);
      }
    } else {
      _bindJobPostingEvents();
    }

    setTimeout(() => closeBtn.focus(), 100);
  }

  /* -- ESC & PASTE LISTENERS ------------------------- */
  function _escListener(e) {
    if (e.key === 'Escape') closeUploadModal();
  }

  function _extractFileFromClipboardEvent(e) {
    const cd = e.clipboardData || window.clipboardData;
    if (!cd) return null;
    if (cd.files && cd.files.length > 0) {
      return cd.files[0];
    }
    if (cd.items && cd.items.length > 0) {
      for (let i = 0; i < cd.items.length; i++) {
        const item = cd.items[i];
        if (item.kind === 'file') {
          const blob = item.getAsFile();
          if (blob) {
            if (!blob.name || blob.name === 'image.png') {
              const ext = (blob.type && blob.type.split('/')[1]) || 'png';
              try {
                return new File([blob], `Pasted_Document_${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
              } catch (err) {
                return blob;
              }
            }
            return blob;
          }
        }
      }
    }
    return null;
  }

  function _modalPasteListener(e) {
    if (!_currentType || _currentType === 'job-posting') return;
    const cfg = TYPE_CONFIG[_currentType] || TYPE_CONFIG.document;
    const file = _extractFileFromClipboardEvent(e);
    if (file) {
      e.preventDefault();
      _handleFileSelected(file, cfg);
      if (typeof window.showToast === 'function') {
        window.showToast('File pasted from clipboard and loaded!');
      }
    }
  }

  async function _triggerClipboardPaste(cfg) {
    if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const preferredType = item.types.find(t =>
            t.startsWith('image/') ||
            t === 'application/pdf' ||
            t.includes('word') ||
            t.includes('officedocument')
          );
          if (preferredType) {
            const blob = await item.getType(preferredType);
            const ext = preferredType === 'application/pdf' ? 'pdf' : (preferredType.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
            const file = new File([blob], `Clipboard_Document_${Date.now()}.${ext}`, { type: preferredType });
            await _handleFileSelected(file, cfg);
            if (typeof window.showToast === 'function') {
              window.showToast('File pasted from clipboard and loaded!');
            }
            return;
          }
        }
      } catch (err) {
        // Fallback to keyboard paste prompt if browser requires Ctrl+V gesture
      }
    }
    const status = document.getElementById('uploadStatusText');
    const progressWrap = document.getElementById('uploadProgressWrap');
    if (progressWrap) progressWrap.classList.add('visible');
    if (status) {
      status.textContent = 'Press Ctrl+V (or Cmd+V on Mac) now to paste your copied file or screenshot.';
    }
    if (typeof window.showToast === 'function') {
      window.showToast('Press Ctrl+V (or Cmd+V) to paste your copied document or image.');
    }
  }

  /* -- BIND FILE UPLOAD EVENTS ----------------------- */
  function _bindFileUploadEvents(cfg) {
    const dropzone = document.getElementById('uploadDropzone');
    const panel = document.getElementById('uploadPanel');
    const fileInput = document.getElementById('uploadFileInput');
    const submitBtn = document.getElementById('uploadSubmitBtn');
    const browseBtn = document.getElementById('uploadBrowseBtn');
    const pasteBtn = document.getElementById('uploadPasteBtn');
    const changeBtn = document.getElementById('uploadChangeFileBtn');
    const viewExistingBtn = document.getElementById('uploadViewExistingBtn');

    if (!dropzone || !fileInput) return;

    if (viewExistingBtn) {
      viewExistingBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window._latestModalExistingDoc && typeof window.openDocumentViewer === 'function') {
          window.openDocumentViewer(window._latestModalExistingDoc);
        }
      });
    }

    const openFilePicker = (e) => {
      if (e) e.stopPropagation();
      fileInput.value = '';
      fileInput.click();
    };

    if (browseBtn) browseBtn.addEventListener('click', openFilePicker);
    if (changeBtn) changeBtn.addEventListener('click', openFilePicker);
    if (pasteBtn) {
      pasteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _triggerClipboardPaste(cfg);
      });
    }

    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('#uploadPasteBtn')) return;
      openFilePicker(e);
    });

    /* Drag & Drop on both dropzone and entire modal panel */
    const dragTargets = [dropzone, panel].filter(Boolean);
    dragTargets.forEach(target => {
      ['dragover', 'dragenter'].forEach(ev => {
        target.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
          dropzone.classList.add('drag-over');
        });
      });
      ['dragleave', 'dragend'].forEach(ev => {
        target.addEventListener(ev, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!dropzone.contains(e.relatedTarget)) {
            dropzone.classList.remove('drag-over');
          }
        });
      });
      target.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          _handleFileSelected(files[0], cfg);
        } else if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
          for (let i = 0; i < e.dataTransfer.items.length; i++) {
            if (e.dataTransfer.items[i].kind === 'file') {
              const f = e.dataTransfer.items[i].getAsFile();
              if (f) { _handleFileSelected(f, cfg); break; }
            }
          }
        }
      });
    });

    /* Keyboard activation for dropzone */
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFilePicker(e);
      }
    });

    /* File input change */
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) {
        _handleFileSelected(file, cfg);
      }
    });

    /* Submit */
    submitBtn.addEventListener('click', () => {
      if (_selectedFile) _simulateUpload(_selectedFile);
    });
  }

  /* -- FILE INTEGRITY & MAGIC-BYTE VALIDATION (OWASP ASVS V12.1 / CWE-434) -- */
  async function validateFileIntegrity(file) {
    if (!file) return { valid: false, error: 'No file provided.' };

    let headerBytes = [];
    try {
      if (typeof file.slice === 'function') {
        const slice = file.slice(0, 64);
        if (typeof slice.arrayBuffer === 'function') {
          const buffer = await slice.arrayBuffer();
          headerBytes = Array.from(new Uint8Array(buffer));
        }
      }
    } catch (e) {
      console.warn('Binary slice read error:', e);
    }

    if (headerBytes.length > 0) {
      // Block prohibited executable binaries only:
      // 1. Windows PE (MZ: 0x4D 0x5A or 0x5A 0x4D)
      if (headerBytes.length >= 2 && ((headerBytes[0] === 0x4D && headerBytes[1] === 0x5A) || (headerBytes[0] === 0x5A && headerBytes[1] === 0x4D))) {
        return { valid: false, error: 'Security Alert: Prohibited Windows Executable (MZ / PE) file detected. Executable files are blocked.' };
      }
      // 2. Linux ELF: 0x7F 0x45 0x4C 0x46
      if (headerBytes.length >= 4 && headerBytes[0] === 0x7F && headerBytes[1] === 0x45 && headerBytes[2] === 0x4C && headerBytes[3] === 0x46) {
        return { valid: false, error: 'Security Alert: Prohibited Linux ELF binary detected. Upload blocked.' };
      }
      // 3. Mach-O / Java bytecode
      if (headerBytes.length >= 4 && (
        (headerBytes[0] === 0xFE && headerBytes[1] === 0xED && headerBytes[2] === 0xFA) ||
        (headerBytes[0] === 0xCA && headerBytes[1] === 0xFE && headerBytes[2] === 0xBA && headerBytes[3] === 0xBE)
      )) {
        return { valid: false, error: 'Security Alert: Prohibited executable bytecode detected. Upload blocked.' };
      }
      // 4. Shell Shebang: #! (0x23 0x21)
      if (headerBytes.length >= 2 && headerBytes[0] === 0x23 && headerBytes[1] === 0x21) {
        return { valid: false, error: 'Security Alert: Prohibited Shell Script (#!) detected. Scripts are blocked.' };
      }

      const ext = ((file.name || '').split('.').pop() || '').toLowerCase();
      if (ext === 'svg') {
        try {
          if (typeof file.slice === 'function' && typeof file.slice(0, 8192).text === 'function') {
            const text = await file.slice(0, 8192).text();
            if (/<script[\s>]/i.test(text) || /onload\s*=/i.test(text) || /onerror\s*=/i.test(text) || /javascript:/i.test(text) || /<!ENTITY/i.test(text)) {
              return { valid: false, error: 'Security Alert: Malicious script handler or XML entity detected in SVG file.' };
            }
          }
        } catch (e) {}
      }
    }

    return { valid: true };
  }

  function _readFileAsDataURL(file) {
    return new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result || null);
        reader.onerror = () => {
          try {
            resolve(URL.createObjectURL(file));
          } catch (err) {
            resolve(null);
          }
        };
        reader.readAsDataURL(file);
      } catch (e) {
        try {
          resolve(URL.createObjectURL(file));
        } catch (err) {
          resolve(null);
        }
      }
    });
  }

  /* -- HANDLE FILE SELECTED -------------------------- */
  async function _handleFileSelected(file, cfg) {
    if (!file) return;
    cfg = cfg || TYPE_CONFIG[_currentType] || TYPE_CONFIG.document;

    const alertBox = document.getElementById('uploadSecurityAlert');
    if (alertBox) {
      alertBox.style.display = 'none';
      alertBox.textContent = '';
    }

    /* Size check */
    const maxBytes = cfg.maxBytes || 50 * 1024 * 1024;
    if (file.size > maxBytes) {
      if (alertBox) {
        alertBox.textContent = `File too large (${_formatSize(file.size)}). Maximum size is ${cfg.maxMB || 50}MB.`;
        alertBox.style.display = 'block';
      } else {
        alert(`File too large. Maximum size is ${cfg.maxMB || 50}MB.`);
      }
      return;
    }

    // Show immediate loading feedback inside dropzone
    const dropzone = document.getElementById('uploadDropzone');
    const mainText = document.getElementById('uploadMainText');
    const submitBtn = document.getElementById('uploadSubmitBtn');
    if (mainText) mainText.innerHTML = 'Loading selected file...';

    // Binary Magic-Byte & Executable Quarantine Inspection
    const integrity = await validateFileIntegrity(file, cfg);
    if (!integrity.valid) {
      _selectedFile = null;
      _selectedDataURL = null;
      _fileReadPromise = null;
      if (submitBtn) submitBtn.setAttribute('disabled', 'true');
      const preview = document.getElementById('cvPreview');
      if (preview) preview.classList.remove('visible');
      const avatarImg = document.getElementById('avatarPreview');
      if (avatarImg) { avatarImg.src = ''; avatarImg.classList.remove('visible'); }

      if (alertBox) {
        alertBox.innerHTML = `<strong>Security Quarantine:</strong> ${_escHtml(integrity.error)}`;
        alertBox.style.display = 'block';
      } else {
        alert(integrity.error);
      }
      return;
    }

    _selectedFile = file;
    _fileReadPromise = _readFileAsDataURL(file);
    _selectedDataURL = await _fileReadPromise;

    const ext = ((file.name || '').split('.').pop() || '').toLowerCase();
    const isImage = (file.type && file.type.startsWith('image/')) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext);
    const sizeText = _formatSize(file.size);

    // Update Dropzone visually so user clearly sees the file is loaded and ready
    if (dropzone) {
      dropzone.classList.add('file-loaded');
      const iconEl = document.getElementById('uploadIcon');
      const formatsEl = document.getElementById('uploadFormatsText');
      const sizeEl = document.getElementById('uploadSizeText');
      const browseBtn = document.getElementById('uploadBrowseBtn');

      if (iconEl) {
        if (isImage && _selectedDataURL) {
          iconEl.innerHTML = `<img src="${_selectedDataURL}" alt="Preview" style="width:76px; height:76px; object-fit:cover; border-radius:12px; border:2px solid #16a34a; box-shadow:0 4px 14px rgba(0,0,0,0.12);">`;
        } else {
          iconEl.innerHTML = `<div style="width:56px; height:56px; border-radius:14px; background:rgba(22,163,74,0.15); color:#16a34a; display:flex; align-items:center; justify-content:center;"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>`;
        }
      }
      if (mainText) {
        mainText.innerHTML = `<span style="color:#16a34a; text-decoration:none; font-weight:900;">File Loaded:</span> ${_escHtml(file.name || 'Selected_Document')}`;
      }
      if (formatsEl) {
        formatsEl.innerHTML = `<span style="color:#16a34a; font-weight:800;">${sizeText} &bull; Ready to Upload</span>`;
      }
      if (sizeEl) {
        sizeEl.textContent = 'Click "Upload Document" below to save, or choose a different file.';
      }
      if (browseBtn) {
        browseBtn.textContent = 'Choose Different File';
      }
    }

    if (cfg.previewType === 'avatar' && isImage && _selectedDataURL) {
      const img = document.getElementById('avatarPreview');
      if (img) {
        img.src = _selectedDataURL;
        img.classList.add('visible');
      }
    }

    const preview = document.getElementById('cvPreview');
    const fname = document.getElementById('cvFilename');
    const fsize = document.getElementById('cvFilesize');
    const icon = document.getElementById('cvIconLarge');
    if (preview && fname && fsize) {
      if (icon) {
        icon.innerHTML = isImage ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
      }
      fname.textContent = file.name || 'Document';
      fsize.textContent = `${sizeText} • Loaded & Ready`;
      preview.classList.add('visible');
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.removeAttribute('disabled');
      submitBtn.textContent = 'Upload Document Now';
    }
  }

  /* -- SIMULATE UPLOAD WITH PROGRESS ---------------- */
  async function _simulateUpload(file) {
    const integrity = await validateFileIntegrity(file, TYPE_CONFIG[_currentType] || {});
    if (!integrity.valid) {
      alert(integrity.error);
      return;
    }

    if (!_selectedDataURL && _fileReadPromise) {
      try {
        _selectedDataURL = await _fileReadPromise;
      } catch (e) {}
    }
    if (!_selectedDataURL && file) {
      _selectedDataURL = await _readFileAsDataURL(file);
    }

    const progressWrap = document.getElementById('uploadProgressWrap');
    const fill = document.getElementById('uploadProgressFill');
    const pct = document.getElementById('uploadProgressPct');
    const label = document.getElementById('uploadProgressLabel');
    const status = document.getElementById('uploadStatusText');
    const submitBtn = document.getElementById('uploadSubmitBtn');
    const dropzone = document.getElementById('uploadDropzone');

    if (progressWrap) progressWrap.classList.add('visible');
    if (dropzone) dropzone.style.pointerEvents = 'none';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('disabled', 'true');
      submitBtn.textContent = 'Uploading...';
    }

    let progress = 0;
    const stages = [
      { pct: 35, msg: 'Preparing file…' },
      { pct: 70, msg: 'Uploading…' },
      { pct: 95, msg: 'Saving to profile…' },
      { pct: 100, msg: 'Upload complete!' },
    ];
    let stageIdx = 0;

    const interval = setInterval(() => {
      progress = Math.min(progress + Math.random() * 22 + 12, 100);
      if (fill) fill.style.width = progress + '%';
      if (pct) pct.textContent = Math.round(progress) + '%';

      while (stageIdx < stages.length - 1 && progress >= stages[stageIdx].pct) stageIdx++;
      if (label) label.textContent = stages[Math.min(stageIdx, stages.length - 1)].msg;

      if (progress >= 100) {
        clearInterval(interval);
        if (status) status.textContent = 'Upload successful!';
        if (submitBtn) {
          submitBtn.textContent = 'Done';
          submitBtn.style.background = '#16a34a';
        }

        try {
          const cfg = TYPE_CONFIG[_currentType] || TYPE_CONFIG.document;
          const fileData = {
            name: file.name || 'Uploaded_Document',
            size: file.size || 0,
            type: file.type || 'application/pdf',
            dataURL: _selectedDataURL || null,
            fileUrl: _selectedDataURL || null,
            category: cfg?.storageCategory || 'documents',
            timestamp: new Date().toISOString(),
          };

          if (cfg && cfg.storageCategory && typeof window.saveUploadedFile === 'function') {
            window.saveUploadedFile(cfg.storageCategory, fileData);
          }

          if (typeof window.uploadAndSaveUserDocument === 'function' && typeof window.uploadAndSaveMediaAsset === 'function') {
            const storageCat = cfg?.storageCategory || '';
            const isMediaAsset = (
              storageCat === 'avatar' ||
              storageCat === 'company-logo' ||
              storageCat === 'cover-photo' ||
              (storageCat === 'portfolio' && file.type && file.type.startsWith('image/'))
            );
            if (isMediaAsset) {
              const assetType = storageCat === 'company-logo' ? 'company_logo' : (storageCat === 'avatar' ? 'avatar' : 'portfolio_image');
              window.uploadAndSaveMediaAsset({ file, dataUrl: _selectedDataURL, assetType, title: file.name }).then(res => {
                if (res && res.publicUrl) {
                  fileData.publicUrl = res.publicUrl;
                  fileData.fileUrl = res.publicUrl;
                  if (typeof window.saveUploadedFile === 'function') {
                    window.saveUploadedFile(cfg.storageCategory, fileData);
                  }
                }
              }).catch(err => console.warn('Supabase media upload fallback:', err));
            } else {
              const docType = cfg?.storageCategory === 'cv' ? 'cv' : (cfg?.storageCategory || 'document');
              window.uploadAndSaveUserDocument({ file, documentType: docType, title: file.name }).then(res => {
                if (res) {
                  fileData.publicUrl = res.publicUrl || res.signedUrl || fileData.dataURL || null;
                  fileData.fileUrl = res.publicUrl || res.signedUrl || fileData.dataURL || null;
                  fileData.signedUrl = res.signedUrl || fileData.dataURL || null;
                  fileData.filePath = res.filePath || res.data?.file_path || null;
                  fileData.storageBucket = 'documents';
                  if (typeof window.saveUploadedFile === 'function') {
                    window.saveUploadedFile(cfg.storageCategory, fileData);
                  }
                }
              }).catch(err => console.warn('Supabase document upload fallback:', err));
            }
          }

          if (typeof _currentCallback === 'function') {
            _currentCallback(fileData);
          }
        } catch (err) {
          console.error('Error executing upload callback:', err);
        }

        setTimeout(() => {
          closeUploadModal();
        }, 400);
      }
    }, 90);
  }

  /* -- BIND JOB POSTING EVENTS ----------------------- */
  function _bindJobPostingEvents() {
    const tagInput = document.getElementById('jobSkillsInput');
    const tagWrap = document.getElementById('tagInputWrap');
    const submitBtn = document.getElementById('uploadSubmitBtn');

    if (tagInput && tagWrap) {
      tagInput.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ',') && tagInput.value.trim()) {
          e.preventDefault();
          _addTag(tagInput.value.trim(), tagWrap, tagInput);
        }
        if (e.key === 'Backspace' && !tagInput.value && _tagList.length) {
          _removeTag(_tagList[_tagList.length - 1], tagWrap, tagInput);
        }
      });
      tagWrap.addEventListener('click', () => tagInput.focus());
    }

    submitBtn.addEventListener('click', () => {
      const title = document.getElementById('jobTitle')?.value.trim();
      const desc = document.getElementById('jobDescription')?.value.trim();
      if (!title) { alert('Please enter a job title.'); return; }
      if (!desc) { alert('Please enter a job description.'); return; }

      const jobData = {
        title,
        company: document.getElementById('jobCompany')?.value.trim(),
        budget: document.getElementById('jobBudget')?.value,
        deadline: document.getElementById('jobDeadline')?.value,
        description: desc,
        skills: [..._tagList],
        posted_at: new Date().toISOString(),
      };

      if (typeof window.saveUserInputSubmission === 'function') {
        window.saveUserInputSubmission({
          formType: 'job_posting',
          title: title,
          inputData: jobData
        }).catch(e => console.warn('Input persist note:', e));
      }

      submitBtn.setAttribute('disabled', 'true');
      submitBtn.innerHTML = 'Posting...';
      setTimeout(() => {
        submitBtn.innerHTML = 'Posted!';
        submitBtn.style.background = '#16a34a';
        setTimeout(() => {
          if (typeof _currentCallback === 'function') _currentCallback(jobData);
          closeUploadModal();
        }, 700);
      }, 1200);
    });
  }

  /* -- TAG HELPERS ----------------------------------- */
  function _addTag(val, wrap, input) {
    if (_tagList.includes(val)) return;
    _tagList.push(val);
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.dataset.tag = val;
    chip.innerHTML = `${_escHtml(val)} <span class="tag-chip-remove" aria-label="Remove ${_escHtml(val)}">&times;</span>`;
    chip.querySelector('.tag-chip-remove').addEventListener('click', () => {
      _removeTag(val, wrap, input);
    });
    wrap.insertBefore(chip, input);
    input.value = '';
  }

  function _removeTag(val, wrap, input) {
    _tagList = _tagList.filter(t => t !== val);
    const chip = wrap.querySelector(`.tag-chip[data-tag="${CSS.escape ? CSS.escape(val) : val}"]`);
    if (chip) chip.remove();
    input.focus();
  }

  /* -- CLOSE MODAL ----------------------------------- */
  function closeUploadModal() {
    const backdrop = document.getElementById('uploadBackdrop');
    document.removeEventListener('keydown', _escListener);
    document.removeEventListener('paste', _modalPasteListener);
    if (backdrop) {
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 520);
    }
    _currentCallback = null;
    _currentType = null;
    _selectedFile = null;
    _selectedDataURL = null;
    _fileReadPromise = null;
    _tagList = [];
  }

  /* -- PAGE-WIDE DRAG-AND-DROP & PASTE ON UPLOAD CARDS -- */
  function _resolveUploadTargetFromNode(node) {
    if (!node || !node.closest) return null;
    const el = node.closest('[onclick*="openUploadModal"], [data-upload-type], #qualDropzone');
    if (!el) return null;
    if (el.id === 'qualDropzone') {
      return { el, isQualDropzone: true };
    }
    const explicitType = el.getAttribute('data-upload-type');
    const explicitCb = el.getAttribute('data-upload-callback');
    if (explicitType) {
      return { el, type: explicitType, callback: explicitCb ? window[explicitCb] : null };
    }
    const onclickAttr = el.getAttribute('onclick') || '';
    const match = onclickAttr.match(/openUploadModal\(\s*['"]([^'"]+)['"]\s*(?:,\s*(?:window\.)?([a-zA-Z0-9_$]+))?\s*\)/);
    if (match) {
      const type = match[1];
      const cbName = match[2];
      const cbFn = cbName && typeof window[cbName] === 'function' ? window[cbName] : null;
      return { el, type, callback: cbFn };
    }
    return null;
  }

  let _lastHoveredUploadTarget = null;

  document.addEventListener('mouseover', (e) => {
    const target = _resolveUploadTargetFromNode(e.target);
    if (target) _lastHoveredUploadTarget = target;
  }, { passive: true });

  document.addEventListener('dragover', (e) => {
    const target = _resolveUploadTargetFromNode(e.target);
    if (target) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      target.el.classList.add('collekt-drop-target-active');
    } else if (document.getElementById('uploadBackdrop')) {
      e.preventDefault();
    }
  });

  document.addEventListener('dragleave', (e) => {
    const target = _resolveUploadTargetFromNode(e.target);
    if (target && !target.el.contains(e.relatedTarget)) {
      target.el.classList.remove('collekt-drop-target-active');
    }
  });

  document.addEventListener('drop', (e) => {
    const target = _resolveUploadTargetFromNode(e.target);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    target.el.classList.remove('collekt-drop-target-active');

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    if (target.isQualDropzone && typeof window.handleQualDirectFile === 'function') {
      window.handleQualDirectFile(file);
      return;
    }

    if (target.type) {
      openUploadModal(target.type, target.callback, file);
    }
  });

  // Global paste support when Upload Modal is not open (e.g., on Add Qualification modal or hovering an upload box)
  document.addEventListener('paste', (e) => {
    if (document.getElementById('uploadBackdrop')) return; // Handled by _modalPasteListener
    const activeTag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
    const isTypingInField = (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable) &&
                            document.activeElement?.type !== 'file';

    const file = _extractFileFromClipboardEvent(e);
    if (!file) return;

    // 1. Check if Add Qualification Modal is open
    const qualModal = document.getElementById('addQualModal');
    if (qualModal && (qualModal.classList.contains('open') || qualModal.style.display === 'flex' || qualModal.style.display === 'block')) {
      if (typeof window.handleQualDirectFile === 'function') {
        e.preventDefault();
        window.handleQualDirectFile(file);
        return;
      }
    }

    if (isTypingInField) return;

    // 2. Check if user hovered/focused an upload box on the page
    if (_lastHoveredUploadTarget && document.body.contains(_lastHoveredUploadTarget.el)) {
      e.preventDefault();
      if (_lastHoveredUploadTarget.isQualDropzone && typeof window.handleQualDirectFile === 'function') {
        window.handleQualDirectFile(file);
      } else if (_lastHoveredUploadTarget.type) {
        openUploadModal(_lastHoveredUploadTarget.type, _lastHoveredUploadTarget.callback, file);
      }
      return;
    }

    // 3. Fallback: if user is on profile.html or company-profile.html, open generic document upload modal with pasted file
    const path = (window.location.pathname || '').toLowerCase();
    if (path.includes('company-profile')) {
      e.preventDefault();
      openUploadModal('company-docs', window.onDocUploaded, file);
    } else if (path.includes('profile')) {
      e.preventDefault();
      openUploadModal('document', window.onDocUploaded, file);
    }
  });

  /* -- EXPORT PUBLIC API ------------------------------- */
  window.openUploadModal = openUploadModal;
  window.closeUploadModal = closeUploadModal;
  window.validateFileIntegrity = validateFileIntegrity;

})();

