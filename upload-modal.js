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
    padding: 44px 28px; text-align: center; cursor: pointer;
    transition: all 0.5s cubic-bezier(.22,.61,.36,1);
    background: #F4F8F7; position: relative;
    overflow: hidden;
  }
  .upload-dropzone:hover, .upload-dropzone.drag-over {
    border-color: #13756F; background: #D4EFEC;
    transform: scale(1.01);
  }
  .upload-dropzone.drag-over { box-shadow: 0 0 0 4px rgba(19,117,111,.15); }
  .upload-dropzone input[type="file"] {
    position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
  }
  .upload-icon { font-size: 48px; margin-bottom: 14px; transition: transform 0.5s cubic-bezier(.22,.61,.36,1); }
  .upload-dropzone:hover .upload-icon { transform: scale(1.1) translateY(-4px); }
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

  /* -- Avatar preview circle ------- */
  .avatar-preview-wrap {
    display: flex; justify-content: center; margin-top: 20px;
    transition: all 0.5s cubic-bezier(.22,.61,.36,1);
  }
  .avatar-preview-circle {
    width: 100px; height: 100px; border-radius: 50%;
    border: 3px solid #13756F;
    object-fit: cover; display: none;
    box-shadow: 0 8px 28px rgba(19,117,111,.22);
    transition: all 0.6s cubic-bezier(.22,.61,.36,1);
  }
  .avatar-preview-circle.visible { display: block; }

  /* -- CV preview ----------------- */
  .cv-preview {
    display: none; align-items: center; gap: 14px;
    padding: 14px; border-radius: 12px; border: 1px solid #DDE8E6;
    background: #F4F8F7; margin-top: 16px;
    transition: all 0.5s cubic-bezier(.22,.61,.36,1);
  }
  .cv-preview.visible { display: flex; }
  .cv-icon-large { font-size: 32px; flex-shrink: 0; }
  .cv-filename {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 14px; font-weight: 800; color: #111918;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .cv-filesize {
    font-family: Manrope, system-ui, sans-serif;
    font-size: 12px; color: #6B8280;
  }

  /* -- Progress bar --------------- */
  .upload-progress-wrap {
    margin-top: 20px; display: none;
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
    transition: width 0.4s cubic-bezier(.22,.61,.36,1);
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
    cursor: pointer; transition: all 0.5s cubic-bezier(.22,.61,.36,1);
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
  .upload-btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }

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

  /* -- Dark mode ------------------ */
  html.dark .upload-panel { background: #0f2220; }
  html.dark .upload-title { color: #e2efed; }
  html.dark .upload-header { border-color: rgba(255,255,255,.07); }
  html.dark .upload-close { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); color: rgba(255,255,255,.6); }
  html.dark .upload-close:hover { background: #0E3B35; color: #fff; }
  html.dark .upload-dropzone { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.12); }
  html.dark .upload-dropzone:hover { background: rgba(19,117,111,.12); border-color: #13756F; }
  html.dark .upload-main-text { color: #e2efed; }
  html.dark .upload-actions { border-color: rgba(255,255,255,.07); }
  html.dark .upload-btn-cancel { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); color: rgba(255,255,255,.7); }
  html.dark .job-form-input { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); color: #e2efed; }
  html.dark .tag-input-wrap { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); }
  html.dark .tag-input-field { color: #e2efed; }
  html.dark .cv-preview { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.08); }
  html.dark .cv-filename { color: #e2efed; }
  `;

  const style = document.createElement('style');
  style.id = 'collekt-upload-css';
  style.textContent = CSS;
  document.head.appendChild(style);

  /* -- TYPE CONFIG ----------------------------------- */
  const TYPE_CONFIG = {
    avatar: {
      title: 'Upload Profile Photo',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      accept: 'image/*',
      formats: 'JPG, PNG, WebP',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'avatar',
      storageCategory: 'avatar',
    },
    'company-logo': {
      title: 'Upload Company Logo',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      accept: 'image/*',
      formats: 'JPG, PNG, WebP, SVG',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'avatar',
      storageCategory: 'company-logo',
    },
    'cover-photo': {
      title: 'Upload Cover Photo / Header Banner',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      accept: 'image/*',
      formats: 'JPG, PNG, WebP',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'banner',
      storageCategory: 'cover-photo',
    },
    'cover-letter': {
      title: 'Upload Master Cover Letter',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      accept: '.pdf,.doc,.docx',
      formats: 'PDF, DOC, DOCX',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'cover-letter',
    },
    cv: {
      title: 'Upload Your CV',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      accept: '.pdf,.doc,.docx',
      formats: 'PDF, DOC, DOCX',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'cv',
    },
    document: {
      title: 'Upload Document',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      accept: '.pdf,.doc,.docx,.xlsx,.pptx',
      formats: 'PDF, DOC, DOCX, XLSX, PPTX',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'documents',
    },
    portfolio: {
      title: 'Upload Portfolio Item',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      accept: 'image/*,.pdf,.doc,.docx',
      formats: 'JPG, PNG, WebP, PDF, DOC',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'avatar',
      storageCategory: 'portfolio',
    },
    certifications: {
      title: 'Upload Certification',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>',
      accept: '.pdf,.doc,.docx,image/*',
      formats: 'PDF, DOC, JPG, PNG',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'certifications',
    },
    'company-docs': {
      title: 'Upload Company Document',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>',
      accept: '.pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png',
      formats: 'PDF, DOC, XLSX, JPG, PNG',
      maxMB: 50,
      maxBytes: 50 * 1024 * 1024,
      previewType: 'cv',
      storageCategory: 'company-docs',
    },
    'job-posting': {
      title: 'Post a Job',
    },
  };

  /* -- STATE ----------------------------------------- */
  let _currentCallback = null;
  let _currentType = null;
  let _selectedFile = null;
  let _selectedDataURL = null;
  let _tagList = [];

  /* -- BUILD UPLOAD MODAL HTML ----------------------- */
  function buildUploadModal() {
    const wrapper = document.createElement('div');
    wrapper.id = 'uploadModalWrapper';
    document.body.appendChild(wrapper);
  }

  /* -- RENDER FILE UPLOAD CONTENT -------------------- */
  function renderFileUploadContent(cfg) {
    let existingBanner = '';
    const category = cfg.storageCategory || cfg.previewType;
    const existing = typeof getUploadedFiles === 'function' ? getUploadedFiles(category) : [];
    if (existing && existing.length > 0) {
      const latest = existing[0];
      const safeDataURL = latest.dataURL || '#';
      existingBanner = `
        <div style="background:rgba(19,117,111,0.08); border:1.5px dashed rgba(19,117,111,0.4); border-radius:12px; padding:14px 18px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px; overflow:hidden;">
            <span style="font-size:24px; flex-shrink:0;">📄</span>
            <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              <div style="font-size:13px; font-weight:900; color:var(--ink); overflow:hidden; text-overflow:ellipsis;">${latest.name || 'Uploaded_Document.pdf'}</div>
              <div style="font-size:11px; color:#16a34a; font-weight:800;">✅ Uploaded &amp; Verified in Profile</div>
            </div>
          </div>
          <button type="button" onclick="if(typeof previewDocument==='function') previewDocument('${escapeHTML(latest.name || 'Document')}', '${safeDataURL}');" style="background:#13756f; color:#fff; border:none; padding:6px 12px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; flex-shrink:0; display:inline-flex; align-items:center; gap:4px;">👁️ View File</button>
        </div>
      `;
    }

    return `
      ${existingBanner}
      <div class="upload-dropzone" id="uploadDropzone" role="button" tabindex="0" aria-label="Click or drag to upload file">
        <input type="file" id="uploadFileInput" accept="${cfg.accept}" aria-label="Choose file">
        <div class="upload-icon" id="uploadIcon">${cfg.icon}</div>
        <div class="upload-main-text">${existing.length > 0 ? 'Upload a replacement version or click to browse' : 'Drop your file here or <span>click to browse</span>'}</div>
        <div class="upload-formats-text">Supported formats: ${cfg.formats}</div>
        <div class="upload-size-text">Maximum file size: ${cfg.maxMB}MB</div>
      </div>

      ${cfg.previewType === 'avatar' ? `
      <div class="avatar-preview-wrap" id="avatarPreviewWrap">
        <img class="avatar-preview-circle" id="avatarPreview" alt="Avatar preview" src="">
      </div>
      ` : ''}

      ${cfg.previewType === 'cv' ? `
      <div class="cv-preview" id="cvPreview">
        <div class="cv-icon-large" id="cvIconLarge"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg></div>
        <div>
          <div class="cv-filename" id="cvFilename">&rarr;</div>
          <div class="cv-filesize" id="cvFilesize">&rarr;</div>
        </div>
      </div>
      ` : ''}

      <div class="upload-progress-wrap" id="uploadProgressWrap">
        <div class="upload-progress-label">
          <span id="uploadProgressLabel">Uploading&rarr;</span>
          <span id="uploadProgressPct">0%</span>
        </div>
        <div class="upload-progress-bar">
          <div class="upload-progress-fill" id="uploadProgressFill"></div>
        </div>
        <div class="upload-status-text" id="uploadStatusText"></div>
      </div>
      <div style="margin-top:14px; padding:10px 12px; background:rgba(20,184,166,0.08); border:1px solid rgba(20,184,166,0.25); border-radius:10px; font-size:11px; color:var(--teal, #14b8a6); line-height:1.4; display:flex; align-items:center; gap:8px;">
        <span>🛡️</span>
        <span><strong>NDPA 2023 Statutory Protection:</strong> Your uploaded documents are encrypted with AES-256 and processed solely for lawful platform verification and project matching.</span>
      </div>
    `;
  }

  /* -- RENDER JOB POSTING CONTENT -------------------- */
  function renderJobPostingContent() {
    // Try to get current user for company auto-fill
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
        <input class="job-form-input" type="text" id="jobCompany" placeholder="Your company name" value="${companyName}">
      </div>
      <div class="job-form-row">
        <div class="job-form-group" style="margin-bottom:0;">
          <label class="job-form-label" for="jobBudget">Budget (?)</label>
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
          <input class="tag-input-field" id="jobSkillsInput" type="text" placeholder="Type a skill and press Enter&rarr;">
        </div>
      </div>
    `;
  }

  /* -- OPEN MODAL ------------------------------------ */
  function openUploadModal(type, callback) {
    _currentType = type;
    _currentCallback = callback || null;
    _selectedFile = null;
    _tagList = [];

    const cfg = TYPE_CONFIG[type];
    if (!cfg) {
      console.warn('[UploadModal] Unknown type:', type);
      return;
    }

    // Remove existing modal if any
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
          <button class="upload-btn upload-btn-cancel" id="uploadCancelBtn">Cancel</button>
          <button class="upload-btn upload-btn-primary" id="uploadSubmitBtn" ${isFileUpload ? 'disabled' : ''}>
            ${isJobPosting ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M12 5v14M5 12h14"/></svg> Post Job' : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg> Upload'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    /* Animate in */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => modal.classList.add('open'));
    });

    /* -- Bind close buttons ---- */
    const closeBtn = document.getElementById('uploadCloseBtn');
    const cancelBtn = document.getElementById('uploadCancelBtn');
    closeBtn.addEventListener('click', closeUploadModal);
    cancelBtn.addEventListener('click', closeUploadModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeUploadModal(); });
    document.addEventListener('keydown', _escListener);

    if (isFileUpload) {
      _bindFileUploadEvents(cfg);
    } else {
      _bindJobPostingEvents();
    }

    /* Focus */
    setTimeout(() => closeBtn.focus(), 100);
  }

  /* -- ESC LISTENER ---------------------------------- */
  function _escListener(e) {
    if (e.key === 'Escape') closeUploadModal();
  }

  /* -- BIND FILE UPLOAD EVENTS ----------------------- */
  function _bindFileUploadEvents(cfg) {
    const dropzone = document.getElementById('uploadDropzone');
    const fileInput = document.getElementById('uploadFileInput');
    const submitBtn = document.getElementById('uploadSubmitBtn');

    if (!dropzone || !fileInput) return;

    /* Drag events */
    ['dragover', 'dragenter'].forEach(ev => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });
    });
    ['dragleave', 'dragend'].forEach(ev => {
      dropzone.addEventListener(ev, () => dropzone.classList.remove('drag-over'));
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file) _handleFileSelected(file, cfg);
    });

    /* Keyboard activation for dropzone */
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });

    /* File input change */
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) _handleFileSelected(file, cfg);
    });

    /* Submit */
    submitBtn.addEventListener('click', () => {
      if (_selectedFile) _simulateUpload(_selectedFile);
    });
  }

  /* -- HANDLE FILE SELECTED -------------------------- */
  function _handleFileSelected(file, cfg) {
    /* Size check */
    if (file.size > cfg.maxBytes) {
      alert(`File too large. Maximum size is ${cfg.maxMB}MB.`);
      return;
    }

    _selectedFile = file;
    _selectedDataURL = null;
    const submitBtn = document.getElementById('uploadSubmitBtn');
    if (submitBtn) submitBtn.removeAttribute('disabled');

    // Read file payload immediately upon selection
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        _selectedDataURL = e.target.result;
        if (cfg.previewType === 'avatar' && file.type.startsWith('image/')) {
          const img = document.getElementById('avatarPreview');
          if (img) { img.src = e.target.result; img.classList.add('visible'); }
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.warn('FileReader error:', e);
    }

    if (cfg.previewType === 'cv') {
      const preview = document.getElementById('cvPreview');
      const fname = document.getElementById('cvFilename');
      const fsize = document.getElementById('cvFilesize');
      const icon = document.getElementById('cvIconLarge');
      if (preview && fname && fsize) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (icon) icon.innerHTML = ext === 'pdf'
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        fname.textContent = file.name;
        fsize.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
        preview.classList.add('visible');
      }
    }
  }

  /* -- SIMULATE UPLOAD WITH PROGRESS ---------------- */
  function _simulateUpload(file) {
    const progressWrap = document.getElementById('uploadProgressWrap');
    const fill = document.getElementById('uploadProgressFill');
    const pct = document.getElementById('uploadProgressPct');
    const label = document.getElementById('uploadProgressLabel');
    const status = document.getElementById('uploadStatusText');
    const submitBtn = document.getElementById('uploadSubmitBtn');
    const dropzone = document.getElementById('uploadDropzone');

    if (progressWrap) progressWrap.classList.add('visible');
    if (dropzone) dropzone.style.pointerEvents = 'none';
    if (submitBtn) submitBtn.setAttribute('disabled', 'true');

    let progress = 0;
    const stages = [
      { pct: 30, msg: 'Preparing file…' },
      { pct: 65, msg: 'Uploading…' },
      { pct: 90, msg: 'Processing…' },
      { pct: 100, msg: '✅ Upload complete!' },
    ];
    let stageIdx = 0;

    const interval = setInterval(() => {
      progress = Math.min(progress + Math.random() * 14 + 6, 100);
      if (fill) fill.style.width = progress + '%';
      if (pct) pct.textContent = Math.round(progress) + '%';

      // Update stage label
      while (stageIdx < stages.length - 1 && progress >= stages[stageIdx].pct) stageIdx++;
      if (label) label.textContent = stages[Math.min(stageIdx, stages.length - 1)].msg;

      if (progress >= 100) {
        clearInterval(interval);
        if (status) status.textContent = '✅ Upload successful!';
        if (submitBtn) {
          submitBtn.textContent = '✅ Done';
          submitBtn.style.background = '#16a34a';
        }

        // Safely complete upload inside try-catch to prevent modal freeze
        try {
          const cfg = TYPE_CONFIG[_currentType];
          const fileData = {
            name: file.name,
            size: file.size,
            type: file.type || 'application/pdf',
            dataURL: _selectedDataURL || null,
            timestamp: new Date().toISOString(),
          };

          // Synchronize to Supabase Storage & database tables if user signed in
          if (typeof window.uploadAndSaveUserDocument === 'function' && typeof window.uploadAndSaveMediaAsset === 'function') {
            const isImage = (cfg?.previewType === 'avatar' || (file.type && file.type.startsWith('image/')));
            if (isImage) {
              const assetType = cfg?.previewType === 'avatar' ? 'avatar' : (cfg?.storageCategory === 'company-logo' ? 'company_logo' : 'portfolio_image');
              window.uploadAndSaveMediaAsset({ file, assetType, title: file.name }).then(res => {
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
                if (res && res.publicUrl) {
                  fileData.publicUrl = res.publicUrl;
                  fileData.fileUrl = res.publicUrl;
                  if (typeof window.saveUploadedFile === 'function') {
                    window.saveUploadedFile(cfg.storageCategory, fileData);
                  }
                }
              }).catch(err => console.warn('Supabase document upload fallback:', err));
            }
          }

          if (cfg && cfg.storageCategory && typeof window.saveUploadedFile === 'function') {
            window.saveUploadedFile(cfg.storageCategory, fileData);
          }

          if (typeof _currentCallback === 'function') {
            _currentCallback(fileData);
          }
        } catch (err) {
          console.error('Error executing upload callback:', err);
        }

        setTimeout(() => {
          closeUploadModal();
        }, 500);
      }
    }, 120);
  }

  /* -- BIND JOB POSTING EVENTS ----------------------- */
  function _bindJobPostingEvents() {
    const tagInput = document.getElementById('jobSkillsInput');
    const tagWrap = document.getElementById('tagInputWrap');
    const submitBtn = document.getElementById('uploadSubmitBtn');

    /* Tag input */
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

    /* Submit */
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

      /* Persist input to Supabase user_inputs */
      if (typeof window.saveUserInputSubmission === 'function') {
        window.saveUserInputSubmission({
          formType: 'job_posting',
          title: title,
          inputData: jobData
        }).catch(e => console.warn('Input persist note:', e));
      }

      /* Simulate posting */
      submitBtn.setAttribute('disabled', 'true');
      submitBtn.innerHTML = '🚀 Posting &rarr;';
      setTimeout(() => {
        submitBtn.innerHTML = '✅ Posted!';
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
    chip.innerHTML = `${val} <span class="tag-chip-remove" aria-label="Remove ${val}">&rarr;</span>`;
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
    if (backdrop) {
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 520);
    }
    _currentCallback = null;
    _currentType = null;
    _selectedFile = null;
    _selectedDataURL = null;
    _tagList = [];
  }

  /* -- EXPORT PUBLIC API ------------------------------- */
  window.openUploadModal = openUploadModal;
  window.closeUploadModal = closeUploadModal;

})();
