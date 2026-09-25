/**
 * Collekt Serverless File Integrity, Antivirus & Polyglot Quarantine API
 * OWASP ASVS v4.0 V12.1–V12.6 | CWE-434 | CWE-436 | ISO 27001 Control 8.28 & 8.7
 * CBN Cybersecurity Framework Section 4.1 & 4.2 | NDPA 2023 Section 39
 *
 * Enforces magic-byte signature validation, blocks disguised executables (PE/ELF/Mach-O),
 * quarantines polyglots, and sanitizes SVG vector assets.
 */

const { corsHeaders } = require('./lib/cors');
const { checkRateLimit } = require('./lib/rate-limiter');

/**
 * Recognised file signatures (Magic Numbers)
 */
const SIGNATURES = {
  pdf: {
    mime: 'application/pdf',
    extensions: ['pdf'],
    check: (buf) => buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 // %PDF
  },
  png: {
    mime: 'image/png',
    extensions: ['png'],
    check: (buf) => buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
      buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A
  },
  jpeg: {
    mime: 'image/jpeg',
    extensions: ['jpg', 'jpeg'],
    check: (buf) => buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF
  },
  webp: {
    mime: 'image/webp',
    extensions: ['webp'],
    check: (buf) => buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // WEBP
  },
  gif: {
    mime: 'image/gif',
    extensions: ['gif'],
    check: (buf) => buf.length >= 6 &&
      buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && // GIF
      buf[3] === 0x38 && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61 // 87a / 89a
  },
  zip_office: {
    mime: 'application/vnd.openxmlformats-officedocument',
    extensions: ['docx', 'xlsx', 'pptx', 'zip'],
    check: (buf) => buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4B &&
      (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
      (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
  },
  cfb_legacy_office: {
    mime: 'application/msword',
    extensions: ['doc', 'xls', 'ppt'],
    check: (buf) => buf.length >= 8 &&
      buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0 &&
      buf[4] === 0xA1 && buf[5] === 0xB1 && buf[6] === 0x1A && buf[7] === 0xE1
  }
};

/**
 * Prohibited executable and dangerous binary headers
 */
const DANGEROUS_SIGNATURES = [
  {
    name: 'Windows PE / DOS Executable (MZ)',
    check: (buf) => buf.length >= 2 && ((buf[0] === 0x4D && buf[1] === 0x5A) || (buf[0] === 0x5A && buf[1] === 0x4D))
  },
  {
    name: 'Linux / Unix ELF Binary',
    check: (buf) => buf.length >= 4 && buf[0] === 0x7F && buf[1] === 0x45 && buf[2] === 0x4C && buf[3] === 0x46
  },
  {
    name: 'macOS Mach-O Binary',
    check: (buf) => buf.length >= 4 && (
      (buf[0] === 0xFE && buf[1] === 0xED && buf[2] === 0xFA && (buf[3] === 0xCE || buf[3] === 0xCF)) ||
      (buf[0] === 0xCE && buf[1] === 0xFA && buf[2] === 0xED && buf[3] === 0xFE) ||
      (buf[0] === 0xCF && buf[1] === 0xFA && buf[2] === 0xED && buf[3] === 0xFE)
    )
  },
  {
    name: 'Java Class Bytecode / Mach-O Fat',
    check: (buf) => buf.length >= 4 && buf[0] === 0xCA && buf[1] === 0xFE && buf[2] === 0xBA && buf[3] === 0xBE
  },
  {
    name: 'Shell Script / Shebang',
    check: (buf) => buf.length >= 2 && buf[0] === 0x23 && buf[1] === 0x21 // #!
  }
];

/**
 * Deep inspection of buffer for malicious code injection and polyglots
 */
function inspectContentSecurity(buffer, declaredExt) {
  const ext = (declaredExt || '').toLowerCase();
  const sampleSize = Math.min(buffer.length, 32768);
  const sampleStr = buffer.slice(0, sampleSize).toString('utf8', 0, sampleSize);

  // 1. Check for PHP tags in any uploaded file
  if (/(<\?php|<\?=|<script\s+language=["']?php)/i.test(sampleStr)) {
    return {
      safe: false,
      reason: 'php_code_injection',
      detail: 'Prohibited PHP executable code detected in upload payload.'
    };
  }

  // 2. Check for script tags in non-HTML/SVG formats
  if (ext !== 'svg' && ext !== 'html') {
    if (/<script[\s>]/i.test(sampleStr) || /<\/script>/i.test(sampleStr)) {
      return {
        safe: false,
        reason: 'html_script_smuggling',
        detail: 'Embedded script tags detected in document binary (OWASP ASVS V12.1).'
      };
    }
  }

  // 3. Check for PDF-specific dangerous action dictionaries
  if (ext === 'pdf') {
    if (/\/Launch\b/i.test(sampleStr) || /\/JavaScript\b/i.test(sampleStr) || /\/JS\b/i.test(sampleStr)) {
      return {
        safe: false,
        reason: 'pdf_active_script_payload',
        detail: 'PDF contains active execution action dictionaries (/Launch or /JavaScript) which violate Collekt document policy.'
      };
    }
  }

  // 4. SVG Deep Sanitization & XXE Audit
  if (ext === 'svg') {
    // Check for XML External Entity (XXE) injection
    if (/<!ENTITY/i.test(sampleStr) || /SYSTEM\s+["']/i.test(sampleStr)) {
      return {
        safe: false,
        reason: 'svg_xxe_injection',
        detail: 'XML External Entity (XXE) declarations are strictly forbidden in SVG uploads.'
      };
    }

    // Check for active script handlers or script tags
    if (/<script[\s>]/i.test(sampleStr) ||
        /onload\s*=/i.test(sampleStr) ||
        /onerror\s*=/i.test(sampleStr) ||
        /onclick\s*=/i.test(sampleStr) ||
        /href\s*=\s*["']?javascript:/i.test(sampleStr) ||
        /<foreignObject[\s>]/i.test(sampleStr)) {
      return {
        safe: false,
        reason: 'svg_script_injection',
        detail: 'Malicious script handlers or executable vector tags detected in SVG file.'
      };
    }
  }

  return { safe: true };
}

/**
 * Primary File Validation Function
 * Evaluates binary buffer against magic-byte rules, blacklisted signatures, and polyglot heuristics.
 */
function validateFileBuffer(buffer, fileName = '', declaredMime = '') {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      status: 'rejected',
      error: 'Empty file payload.',
      reason: 'empty_file'
    };
  }

  // 1. Check for dangerous executable signatures (MZ, ELF, Mach-O, Shebang, Java)
  for (const danger of DANGEROUS_SIGNATURES) {
    if (danger.check(buffer)) {
      return {
        valid: false,
        status: 'quarantined',
        error: `Security Alert: File contains prohibited executable signature (${danger.name}). Upload blocked by OWASP ASVS V12.1.`,
        reason: 'executable_binary_prohibited',
        detected_danger: danger.name
      };
    }
  }

  // Extract clean extension
  const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = (extMatch ? extMatch[1] : '').toLowerCase();

  // 2. Identify file signature from magic bytes
  let detectedType = null;
  let detectedSigKey = null;

  for (const [key, sig] of Object.entries(SIGNATURES)) {
    if (sig.check(buffer)) {
      detectedType = sig;
      detectedSigKey = key;
      break;
    }
  }

  // Handle SVG specifically (SVG is XML text, not binary magic-byte)
  if (!detectedType && (ext === 'svg' || (declaredMime && declaredMime.includes('svg')))) {
    const textSample = buffer.slice(0, 1024).toString('utf8');
    if (/<svg[\s>]/i.test(textSample) || (textSample.includes('<?xml') && textSample.includes('<svg'))) {
      detectedType = {
        mime: 'image/svg+xml',
        extensions: ['svg']
      };
      detectedSigKey = 'svg';
    }
  }

  // If file extension is declared, verify consistency
  if (ext) {
    if (detectedType) {
      if (!detectedType.extensions.includes(ext)) {
        return {
          valid: false,
          status: 'quarantined',
          error: `File signature mismatch: File extension ".${ext}" does not match internal binary format (${detectedType.mime}). Interpretation conflict blocked (CWE-436).`,
          reason: 'extension_signature_mismatch',
          declared_extension: ext,
          detected_mime: detectedType.mime
        };
      }
    } else {
      // If it has a known binary extension but didn't match magic bytes
      const knownBinaryExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'docx', 'xlsx'];
      if (knownBinaryExtensions.includes(ext)) {
        return {
          valid: false,
          status: 'quarantined',
          error: `Corrupted or spoofed file: File header does not match expected binary signature for ".${ext}".`,
          reason: 'invalid_magic_bytes',
          declared_extension: ext
        };
      }
    }
  }

  // 3. Inspect content security (Polyglot & script smuggling check)
  const contentSec = inspectContentSecurity(buffer, ext);
  if (!contentSec.safe) {
    return {
      valid: false,
      status: 'quarantined',
      error: `Security Alert: ${contentSec.detail}`,
      reason: contentSec.reason
    };
  }

  const finalMime = detectedType ? detectedType.mime : (declaredMime || 'application/octet-stream');

  return {
    valid: true,
    status: 'clean',
    extension: ext,
    detected_mime: finalMime,
    size_bytes: buffer.length,
    signature_key: detectedSigKey || 'unknown'
  };
}

/**
 * Netlify Function Handler
 */
exports.handler = async (event, context) => {
  // CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: ''
    };
  }

  // Method check
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    };
  }

  // Rate Limiting (30 requests/min per IP)
  const rateLimit = checkRateLimit(event, 'file-validate', { maxRequests: 30, windowSeconds: 60 });
  if (!rateLimit.allowed) {
    return {
      statusCode: 429,
      headers: corsHeaders(event, { 'Retry-After': String(rateLimit.retryAfter) }),
      body: JSON.stringify({
        error: 'Too many file validation requests. Please wait before retrying.',
        retryAfter: rateLimit.retryAfter
      })
    };
  }

  try {
    let payload = {};
    if (event.body) {
      try {
        payload = JSON.parse(event.body);
      } catch (e) {
        return {
          statusCode: 400,
          headers: corsHeaders(event),
          body: JSON.stringify({ error: 'Invalid JSON request payload.' })
        };
      }
    }

    const { file_name, file_base64, mime_type } = payload;

    if (!file_base64) {
      return {
        statusCode: 400,
        headers: corsHeaders(event),
        body: JSON.stringify({ error: 'Missing required file_base64 parameter.' })
      };
    }

    // Decode base64 buffer (handle Data URL prefix if present)
    const cleanBase64 = file_base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const result = validateFileBuffer(buffer, file_name, mime_type);

    if (!result.valid) {
      return {
        statusCode: 422,
        headers: corsHeaders(event),
        body: JSON.stringify(result)
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error('[file-validate] Unexpected error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(event),
      body: JSON.stringify({ error: 'Internal server error during file validation.' })
    };
  }
};

// Export validation utilities for automated unit testing & direct server-side calls
exports.validateFileBuffer = validateFileBuffer;
exports.inspectContentSecurity = inspectContentSecurity;
exports.SIGNATURES = SIGNATURES;
exports.DANGEROUS_SIGNATURES = DANGEROUS_SIGNATURES;
