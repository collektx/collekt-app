const { corsHeaders: buildCorsHeaders, preflightResponse } = require('./lib/cors');
const https = require('https');

// Top priority commercial banks order
const PRIORITY_COMMERCIAL_CODES = [
  '044', // Access Bank
  '058', // GTBank
  '057', // Zenith Bank
  '011', // First Bank of Nigeria
  '033', // United Bank for Africa (UBA)
  '214', // FCMB
  '035', // Wema Bank
  '221', // Stanbic IBTC
  '232', // Sterling Bank
  '070', // Fidelity Bank
  '032', // Union Bank
  '076', // Polaris Bank
  '082', // Keystone Bank
  '101', // Providus Bank
  '561', // NOVA Bank
  '000035', // Nova Bank
  '301', // Jaiz Bank
  '302', // TAJ Bank
  '303', // Lotus Bank
  '102', // Titan Trust Bank
  '023', // Citibank Nigeria
  '068', // Standard Chartered
  '215', // Unity Bank
  '000031', // PremiumTrust Bank
  '000034', // Signature Bank
  '000036', // Optimus Bank
  '104', // Parallex Bank
  '063'  // Access (Diamond)
];

// Top priority digital banks / neobanks
const PRIORITY_DIGITAL_CODES = [
  '305',    // OPay
  '999992', // OPay
  '100033', // PalmPay
  '999991', // PalmPay
  '090405', // Moniepoint MFB
  '50515',  // Moniepoint MFB
  '50211',  // Kuda Bank
  '090551', // FairMoney MFB
  '51318',  // FairMoney
  '940',    // Carbon (One Finance)
  '565',    // Carbon
  '566',    // VFD Microfinance Bank
  '50322',  // Dot Microfinance Bank
  '125',    // Rubies MFB
  '120001'  // 9 Payment Service Bank (9PSB)
];

// Fallback bank catalog
const STATIC_FALLBACK_BANKS = [
  { name: 'Access Bank', code: '044', slug: 'access-bank', category: 'commercial' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058', slug: 'gtbank', category: 'commercial' },
  { name: 'Zenith Bank', code: '057', slug: 'zenith-bank', category: 'commercial' },
  { name: 'First Bank of Nigeria', code: '011', slug: 'first-bank-of-nigeria', category: 'commercial' },
  { name: 'United Bank for Africa (UBA)', code: '033', slug: 'united-bank-for-africa', category: 'commercial' },
  { name: 'OPay (Paycom)', code: '305', slug: 'opay', category: 'digital' },
  { name: 'PalmPay', code: '100033', slug: 'palmpay', category: 'digital' },
  { name: 'Moniepoint Microfinance Bank', code: '090405', slug: 'moniepoint-mfb', category: 'digital' },
  { name: 'Kuda Bank', code: '50211', slug: 'kuda-bank', category: 'digital' },
  { name: 'FCMB (First City Monument Bank)', code: '214', slug: 'fcmb', category: 'commercial' },
  { name: 'Wema Bank', code: '035', slug: 'wema-bank', category: 'commercial' },
  { name: 'Stanbic IBTC Bank', code: '221', slug: 'stanbic-ibtc-bank', category: 'commercial' },
  { name: 'Sterling Bank', code: '232', slug: 'sterling-bank', category: 'commercial' },
  { name: 'Fidelity Bank', code: '070', slug: 'fidelity-bank', category: 'commercial' },
  { name: 'Union Bank of Nigeria', code: '032', slug: 'union-bank', category: 'commercial' },
  { name: 'Polaris Bank', code: '076', slug: 'polaris-bank', category: 'commercial' },
  { name: 'Keystone Bank', code: '082', slug: 'keystone-bank', category: 'commercial' },
  { name: 'Providus Bank', code: '101', slug: 'providus-bank', category: 'commercial' },
  { name: 'NOVA Bank (Nova Commercial Bank)', code: '561', slug: 'nova-bank', category: 'commercial' },
  { name: 'FairMoney Microfinance Bank', code: '090551', slug: 'fairmoney-mfb', category: 'digital' },
  { name: 'Carbon (One Finance)', code: '940', slug: 'carbon', category: 'digital' },
  { name: 'VFD Microfinance Bank', code: '566', slug: 'vfd-mfb', category: 'digital' },
  { name: 'Dot Microfinance Bank', code: '50322', slug: 'dot-mfb', category: 'digital' },
  { name: 'Jaiz Bank', code: '301', slug: 'jaiz-bank', category: 'commercial' },
  { name: 'TAJ Bank', code: '302', slug: 'taj-bank', category: 'commercial' },
  { name: 'Lotus Bank', code: '303', slug: 'lotus-bank', category: 'commercial' },
  { name: 'Titan Trust Bank', code: '102', slug: 'titan-trust-bank', category: 'commercial' },
  { name: 'Parallex Bank', code: '104', slug: 'parallex-bank', category: 'commercial' },
  { name: 'PremiumTrust Bank', code: '000031', slug: 'premiumtrust-bank', category: 'commercial' },
  { name: 'Unity Bank', code: '215', slug: 'unity-bank', category: 'commercial' },
  { name: 'Standard Chartered Bank', code: '068', slug: 'standard-chartered-bank', category: 'commercial' },
  { name: 'Citibank Nigeria', code: '023', slug: 'citibank-nigeria', category: 'commercial' }
];

let cachedBanks = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function fetchBanksFromKorapay() {
  return new Promise((resolve) => {
    const koraPub = process.env.KORAPAY_PUBLIC_KEY || 'pk_live_GDgZcYhPzLZBHh1rr6godHWmHuA5qfNaxdioYM1m';
    const req = https.get('https://api.korapay.com/merchant/api/v1/misc/banks?countryCode=NG', {
      headers: { 'Authorization': 'Bearer ' + koraPub }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.status && Array.isArray(parsed.data)) {
            resolve(parsed.data);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(6000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

function categorizeAndSortBanks(rawBanks) {
  if (!rawBanks || !rawBanks.length) return STATIC_FALLBACK_BANKS;

  const commercialMap = new Map();
  const digitalMap = new Map();
  const mfbMap = new Map();

  rawBanks.forEach(b => {
    const code = String(b.code || b.nibss_bank_code || '').trim();
    let name = (b.name || '').trim();
    if (!code || !name) return;

    // Standardize bank names for clean display
    if (name === 'GTBank Plc' || name === 'Guaranty Trust Bank') name = 'Guaranty Trust Bank (GTBank)';
    if (name === 'Zenith Bank Plc') name = 'Zenith Bank';
    if (name === 'Opay') name = 'OPay (Paycom)';
    if (name === 'PALMPAY') name = 'PalmPay';
    if (name === 'Kuda Micro-finance Bank') name = 'Kuda Bank';

    // Check digital/neobanks
    if (
      PRIORITY_DIGITAL_CODES.includes(code) ||
      /opay|paycom|palmpay|moniepoint|kuda|fairmoney|carbon|vfd micro|dot microfinance|rubies|9 payment|gomoney/i.test(name)
    ) {
      if (!digitalMap.has(code)) {
        digitalMap.set(code, {
          name: name,
          code: code,
          slug: b.slug || code,
          category: 'digital'
        });
      }
      return;
    }

    // Check commercial banks
    if (
      PRIORITY_COMMERCIAL_CODES.includes(code) ||
      /access bank|guaranty trust|gtbank|zenith bank|first bank of nigeria|united bank for africa|uba|fcmb|wema bank|stanbic ibtc|sterling bank|fidelity bank|union bank of nigeria|polaris bank|keystone bank|providus bank|nova bank|jaiz bank|taj bank|lotus bank|titan trust|parallex bank|premiumtrust|signature bank|optimus bank|unity bank|standard chartered|citibank/i.test(name)
    ) {
      if (!commercialMap.has(code)) {
        commercialMap.set(code, {
          name: name,
          code: code,
          slug: b.slug || code,
          category: 'commercial'
        });
      }
      return;
    }

    // All other Microfinance, Mortgage & Regional Banks
    if (!mfbMap.has(code)) {
      mfbMap.set(code, {
        name: name,
        code: code,
        slug: b.slug || code,
        category: 'mfb'
      });
    }
  });

  // Sort commercial banks with priority order
  const commercialList = Array.from(commercialMap.values()).sort((a, b) => {
    const idxA = PRIORITY_COMMERCIAL_CODES.indexOf(a.code);
    const idxB = PRIORITY_COMMERCIAL_CODES.indexOf(b.code);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  // Sort digital banks with priority order
  const digitalList = Array.from(digitalMap.values()).sort((a, b) => {
    const idxA = PRIORITY_DIGITAL_CODES.indexOf(a.code);
    const idxB = PRIORITY_DIGITAL_CODES.indexOf(b.code);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  // Sort MFBs alphabetically
  const mfbList = Array.from(mfbMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return [...commercialList, ...digitalList, ...mfbList];
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return preflightResponse(event);
  }

  const cors = buildCorsHeaders(event);

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...cors },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const query = (event.queryStringParameters?.q || '').trim().toLowerCase();
  const categoryFilter = (event.queryStringParameters?.category || '').trim().toLowerCase();

  const now = Date.now();
  if (!cachedBanks || (now - cacheTimestamp > CACHE_TTL_MS)) {
    try {
      const raw = await fetchBanksFromKorapay();
      if (raw && raw.length > 0) {
        cachedBanks = categorizeAndSortBanks(raw);
        cacheTimestamp = now;
      } else if (!cachedBanks) {
        cachedBanks = STATIC_FALLBACK_BANKS;
      }
    } catch (e) {
      if (!cachedBanks) cachedBanks = STATIC_FALLBACK_BANKS;
    }
  }

  let result = cachedBanks;

  if (categoryFilter) {
    result = result.filter(b => b.category === categoryFilter);
  }

  if (query) {
    result = result.filter(b => 
      b.name.toLowerCase().includes(query) || 
      b.code.toLowerCase().includes(query) || 
      (b.slug && b.slug.toLowerCase().includes(query))
    );
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      ...cors,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    },
    body: JSON.stringify({
      status: 'success',
      count: result.length,
      data: result
    })
  };
};

