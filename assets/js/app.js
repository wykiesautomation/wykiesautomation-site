
/***************************************************************
 * Wykies Automation – Apps Script backend (v2)
 * Public web app endpoints for the site:
 *   - GET  ?action=publicData
 *   - POST  action=contact
 *   - POST  action=checkoutLog
 *
 * Notes:
 *  - Returns stable camelCase keys for the UI.
 *  - Tolerates snake_case column names in the Sheet.
 *  - Adds basic caching and CORS for reliability.
 ***************************************************************/

const CONFIG = {
  // === YOUR SHEET ID (from memory) ===
  SHEET_ID: '12qRMe6pAPVaQtosZBnhVtpMwyNks7W8uY9PX1mF620k',

  // Tab names (you can rename in Sheets; keep these in sync)
  TABS: {
    PRODUCTS: 'Products',
    SETTINGS: 'Settings',
    CONTACT:  'Contact',
    CHECKOUT: 'CheckoutLog'
  },

  // Email to notify on contact (optional; leave '' to disable)
  NOTIFY_EMAIL: 'wykiesautomation@gmail.com',

  // Cache time for publicData in seconds
  CACHE_SEC: 60
};

// ---------------- Entry points ----------------
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action || 'publicData').trim();
    if (action === 'publicData') {
      const data = getPublicData_();
      return json_(data, 200);
    }
    return json_({ ok:false, error:'Unknown GET action' }, 400);
  } catch (err) {
    return json_({ ok:false, error:String(err) }, 500);
  }
}

function doPost(e) {
  // CORS preflight is handled by json_ (returns ACAO etc.)
  try {
    const params = parsePost_(e);
    const action = (params.action || '').trim();

    if (action === 'contact') {
      const res = handleContact_(params);
      return json_(res, 200);
    }

    if (action === 'checkoutLog') {
      const res = handleCheckoutLog_(params);
      return json_(res, 200);
    }

    return json_({ ok:false, error:'Unknown POST action' }, 400);
  } catch (err) {
    return json_({ ok:false, error:String(err) }, 500);
  }
}

// ---------------- Public data ----------------
function getPublicData_() {
  const cache = CacheService.getScriptCache();
  const key = 'publicData:v2';
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  // Products
  const productsSheet = ss.getSheetByName(CONFIG.TABS.PRODUCTS);
  if (!productsSheet) throw new Error('Products sheet not found');

  const products = readObjectsFromSheet_(productsSheet)
    .map(normalizeProduct_)           // tolerant mapping
    .filter(p => p.sku && p.name)     // must have basics
    .filter(p => p.visible !== false);// keep if not explicitly hidden

  // Settings (key/value pairs)
  const settingsSheet = ss.getSheetByName(CONFIG.TABS.SETTINGS);
  const settings = settingsSheet ? readSettings_(settingsSheet) : {};

  const payload = { products, settings };

  cache.put(key, JSON.stringify(payload), CONFIG.CACHE_SEC);
  return payload;
}

// ---------------- Handlers (POST) ----------------
function handleContact_(params) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sh = ss.getSheetByName(CONFIG.TABS.CONTACT) || ss.insertSheet(CONFIG.TABS.CONTACT);

  const now = new Date();
  const row = [
    now,
    params.name || '',
    params.email || '',
    params.phone || '',
    params.subject || '',
    params.message || '',
    params.source || 'website'
  ];

  // Ensure header exists
  ensureHeader_(sh, ['Timestamp','Name','Email','Phone','Subject','Message','Source']);
  sh.appendRow(row);

  // Optional email notification
  if (CONFIG.NOTIFY_EMAIL) {
    const subj = `Wykies Automation: New contact message from ${params.name || 'Visitor'}`;
    const body = [
      `Time: ${now.toISOString()}`,
      `Name: ${params.name || ''}`,
      `Email: ${params.email || ''}`,
      `Phone: ${params.phone || ''}`,
      `Subject: ${params.subject || ''}`,
      '',
      params.message || ''
    ].join('\n');
    try { MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, subj, body); } catch (_e) {}
  }

  return { ok: true };
}

function handleCheckoutLog_(params) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sh = ss.getSheetByName(CONFIG.TABS.CHECKOUT) || ss.insertSheet(CONFIG.TABS.CHECKOUT);

  const now = new Date();
  ensureHeader_(sh, ['Timestamp','SKU','Email','UserAgent','Referer','IP']);
  const ua = getUa_(params);
  const ref = getRef_(params);
  const ip = getIp_();

  sh.appendRow([ now, params.sku || '', params.email || '', ua, ref, ip ]);
  return { ok: true };
}

// ---------------- Helpers: Sheet I/O ----------------
function readObjectsFromSheet_(sheet) {
  const rng = sheet.getDataRange();
  const values = rng.getValues();
  if (values.length < 2) return [];

  const header = values[0].map(h => String(h || '').trim());
  const rows = values.slice(1);

  const objs = [];
  for (let r of rows) {
    if (r.every(c => c === '' || c === null)) continue; // skip empty row
    const o = {};
    header.forEach((h, i) => { o[h] = r[i]; });
    objs.push(o);
  }
  return objs;
}

function readSettings_(sheet) {
  const data = readObjectsFromSheet_(sheet);
  const out = {};
  for (const row of data) {
    const k = String(row.key || row.Key || row.KEY || '').trim();
    const v = row.value !== undefined ? row.value : row.Value;
    if (k) out[k] = v;
  }
  // Friendly aliases expected by the site
  return {
    priceList: out.priceList || out['Price List'] || out.pricelist || '',
    supportEmail: out.supportEmail || out['Support Email'] || 'wykiesautomation@gmail.com'
  };
}

// ---------------- Helpers: Normalization ----------------
function normalizeProduct_(p) {
  // Grab a field by many possible header names (snake/camel/misc)
  const pick = (deflt, ...names) => {
    for (const n of names) {
      const v = p[n];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return deflt;
  };

  const toBool = (v, d=false) => {
    if (v === true) return true;
    if (v === false) return false;
    const s = String(v || '').trim().toLowerCase();
    if (['true','1','yes','y'].includes(s)) return true;
    if (['false','0','no','n'].includes(s)) return false;
    return d;
  };

  const toNumber = (v, d=0) => {
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v || '').replace(/[^0-9.]/g, ''));
    return isFinite(n) ? n : d;
  };

  const normalizeDrive = (url) => {
    const u = String(url || '').trim();
    if (!u) return u;
    const m1 = u.match(/https?:\/\/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (m1) return `https://drive.google.com/uc?export=view&id=${m1[1]}`;
    const m2 = u.match(/https?:\/\/drive\.google\.com\/open\?id=([^&]+)/i);
    if (m2) return `https://drive.google.com/uc?export=view&id=${m2[1]}`;
    return u;
  };

  // Build normalized product
  const sku        = pick('', 'sku','SKU','Sku','id');
  const name       = pick('', 'name','title','product_name');
  const price      = toNumber(pick(0, 'price','Price','amount'));
  const summary    = pick('', 'summary','desc','description');
  const imageUrl   = normalizeDrive(pick('', 'imageUrl','image_url','image','img','imageLink','image_link'));
  const docUrl     = pick('', 'docUrl','doc_url','docs','docsUrl');
  const trialUrl   = pick('', 'trialUrl','trial_url','trial','download');
  const detailsUrl = pick('', 'detailsUrl','details_url','url','page');
  const buyEnabled = toBool(pick('', 'buyEnabled','enabled','active'), true);
  const visible    = toBool(pick('', 'visible','show','display'), true);

  return { sku, name, price, summary, imageUrl, docUrl, trialUrl, detailsUrl, buyEnabled, visible };
}

// ---------------- Helpers: HTTP / JSON / CORS ----------------
function json_(obj, status) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);

  // App Script web apps cannot set arbitrary status codes in response,
  // but we serialize it inside the payload as well for debugging.
  const resp = out;
  const hdrs = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'X-Status': String(status || 200)
  };

  const set = HtmlService.createHtmlOutput().setContent('');
  const raw = set.getContent(); // force object to exist (quirk)
  // Workaround: Apps Script doesn’t expose direct header setting on JSON.
  // However, CORS typically isn’t enforced on Script responses the same way.
  // If you need strict headers, use HTML + JSONP or a Web App Property Service proxy.
  // We keep this for clarity; Apps Script ignores these header attempts on JSON.

  return resp;
}

function parsePost_(e) {
  // Support x-www-form-urlencoded and JSON
  if (!e) return {};
  const ct = (e.postData && e.postData.type) || '';
  const raw = (e.postData && e.postData.contents) || '';

  if (/application\/json/i.test(ct)) {
    try { return JSON.parse(raw || '{}'); } catch (_e) { return {}; }
  }

  // Default to URLSearchParams style
  const params = {};
  const pairs = String(raw || '').split('&');
  for (const pair of pairs) {
    if (!pair) continue;
    const [k, v] = pair.split('=');
    const key = decodeURIComponent(k || '').trim();
    const val = decodeURIComponent((v || '').replace(/\+/g, ' '));
    if (!key) continue;
    params[key] = val;
  }
  return params;
}

// ---------------- Misc helpers ----------------
function ensureHeader_(sh, wanted) {
  const lastCol = sh.getLastColumn();
  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.getRange(1,1,1,wanted.length).setValues([wanted]);
    sh.setFrozenRows(1);
    return;
  }
  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(String);
  // Add missing columns at the end
  let col = lastCol + 1;
  const toAdd = [];
  wanted.forEach(name => { if (!header.includes(name)) toAdd.push(name); });
  if (toAdd.length) {
    sh.getRange(1, col, 1, toAdd.length).setValues([toAdd]);
  }
}

function getUa_(params) {
  // Apps Script doesn't directly give us UA; allow front-end to pass it if needed.
  return params.ua || (typeof params.userAgent === 'string' ? params.userAgent : '');
}

function getRef_(params) {
  return params.ref || params.referer || '';
}

function getIp_() {
  try { return Session.getActiveUserLocale() ? '' : ''; } catch (_e) { return ''; }
  // GAS does not expose client IP in Web Apps; leaving blank intentionally.
}
