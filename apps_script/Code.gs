/**
 * Wykies Automation — Apps Script Web App (Public + Admin)
 * 
 * Supports:
 *  - Public read:  GET ?op=products (or ?action=products)
 *  - Admin read:   GET ?action=payments|settings|status|revenueTrend
 *  - Admin auth:   POST action=verifyGoogleId (expects idToken)  -> returns "OK:email:token"
 *                 POST action=auth (fallback passphrase)         -> returns "OK:email:PASS"
 *  - Admin write:  POST action=updateProduct (sku, field, value) -> returns "OK" on success
 *                 POST action=saveSettings (priceList, supportEmail, ...) -> returns "OK"
 *                 POST action=resendInvoice (invoice, email, order) -> returns "OK:resent" or ERR
 *
 * Security:
 *  - All secrets/config are stored in Script Properties.
 *  - Admin allowlist enforced via ALLOWED_ADMIN_EMAILS.
 */

const PROPS = PropertiesService.getScriptProperties();

function doGet(e){
  const p = (e && e.parameter) || {};
  const op = String(p.op || p.action || '').trim();
  switch(op){
    case 'products':
      return json_(getProducts_());
    case 'payments':
      return json_(getPayments_());
    case 'settings':
      return json_(getSettings_());
    case 'status':
      return json_(getStatus_());
    case 'revenueTrend':
      return json_(getRevenueTrend_(Number(p.days || 30)));
    default:
      return json_({ ok:true, message:'WykiesAutomation API', ops:['products','payments','settings','status','revenueTrend'] });
  }
}

function doPost(e){
  const req = parseReq_(e);
  const action = String(req.action || '').trim();

  // Public actions (keep your existing handlers here if you already have them)
  if (action === 'createPayment' || action === 'contact'){
    return text_('ERR:public-handler-not-included');
  }

  // Auth actions
  if (action === 'verifyGoogleId'){
    const idToken = req.idToken || req.id_token || '';
    const info = verifyIdToken_(idToken);
    if (!info || !info.email || String(info.email_verified).toLowerCase() !== 'true') return text_('ERR:token');
    if (!isAllowed_(info.email)) return text_('ERR:not-allowed');
    // For this simple pattern, the token is the idToken itself (admin UI stores it).
    return text_('OK:' + String(info.email).toLowerCase() + ':' + idToken);
  }

  if (action === 'auth'){
    const email = String(req.email || '').toLowerCase().trim();
    const pass  = String(req.pass || '');
    if (!isAllowed_(email)) return text_('ERR:not-allowed');
    const expected = PROPS.getProperty('ADMIN_PASSPHRASE') || '';
    if (!expected || pass !== expected) return text_('ERR:pass');
    return text_('OK:' + email + ':PASS');
  }

  // Admin-only writes
  if (!isAdminFromToken_(req)) return text_('ERR:signin');

  if (action === 'updateProduct'){
    const ok = updateProductField_(req.sku, req.field, req.value, req.token);
    return text_(ok ? 'OK' : 'ERR:update');
  }

  if (action === 'saveSettings'){
    saveSettings_(req);
    return text_('OK');
  }

  if (action === 'resendInvoice'){
    return handleResendInvoice_(req);
  }

  return text_('ERR:unknown');
}

/** ===================== Security ===================== */
function isAllowed_(email){
  const allowed = (PROPS.getProperty('ALLOWED_ADMIN_EMAILS') || 'wykiesautomation@gmail.com')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return allowed.indexOf(String(email || '').toLowerCase()) >= 0;
}

function isAdminFromToken_(req){
  const t = String(req.token || req.idToken || req.id_token || '').trim();
  if (!t) return false;
  const info = verifyIdToken_(t);
  return !!(info && info.email && String(info.email_verified).toLowerCase() === 'true' && isAllowed_(info.email));
}

function verifyIdToken_(idToken){
  if (!idToken) return null;
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions:true });
  if (r.getResponseCode() !== 200) return null;
  return JSON.parse(r.getContentText());
}

/** ===================== Sheets ===================== */
function ss_(){
  const id = PROPS.getProperty('CMS_SHEET_ID');
  if (!id) throw new Error('Missing CMS_SHEET_ID');
  return SpreadsheetApp.openById(id);
}
function tab_(k, d){ return PROPS.getProperty(k) || d; }

function productsSheet_(){ return ss_().getSheetByName(tab_('TAB_PRODUCTS','Products')); }
function paymentsSheet_(){ return ss_().getSheetByName(tab_('TAB_PAYMENTS','Payments')); }
function priceLogSheet_(){ return ss_().getSheetByName(tab_('TAB_PRICECHANGES','PriceChanges')); }
function settingsSheet_(){
  const ss = ss_();
  return ss.getSheetByName(tab_('TAB_SETTINGS','Settings')) || ss.insertSheet('Settings');
}

function ensureHeader_(sh, hdrs){
  const r = sh.getRange(1,1,1,hdrs.length);
  const row = r.getValues()[0];
  if ((row.join('').trim()) === '') r.setValues([hdrs]);
  return hdrs;
}

function rowToObj_(h,row){
  const o = {};
  h.forEach((x,i)=>{ if(x) o[x]=row[i]; });
  return o;
}

/** ===================== Reads ===================== */
function getProducts_(){
  const sh = productsSheet_();
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  const h = data[0] || [];
  const out = [];
  for (let i=1;i<data.length;i++){
    const o = rowToObj_(h,data[i]);
    const active = (o.active === undefined) ? true : o.active;
    if (String(active).toLowerCase() === 'true') out.push(o);
  }
  return out;
}

function getPayments_(){
  const sh = paymentsSheet_();
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  const h = data[0] || [];
  const out = [];
  for (let i=1;i<data.length;i++) out.push(rowToObj_(h,data[i]));
  return out.reverse();
}

function getSettings_(){
  const sh = settingsSheet_();
  ensureHeader_(sh, ['key','value']);
  const data = sh.getDataRange().getValues();
  const out = {};
  for (let i=1;i<data.length;i++){
    const k = data[i][0];
    const v = data[i][1];
    if (k) out[String(k)] = v;
  }
  return out;
}

function getStatus_(){
  const sheetId = PROPS.getProperty('CMS_SHEET_ID') || '';
  let productsCount = 0;
  let paymentsCount = 0;
  let paymentsCount24h = 0;
  let paymentsCountToday = 0;
  let paymentsRevenue24h = 0;
  let paymentsRevenueToday = 0;

  const products = getProducts_();
  productsCount = products.length;

  const payments = getPayments_();
  paymentsCount = payments.length;

  const now = Date.now();
  const ms24 = 24*60*60*1000;
  const today = new Date(); today.setHours(0,0,0,0);
  const msToday = today.getTime();

  for (const r of payments){
    const t = new Date(r.Timestamp || r.Date || '').getTime();
    const tot = Number(r.TotalInclVAT || r.total || 0) || 0;
    if (!isNaN(t)){
      if (now - t <= ms24){ paymentsCount24h++; paymentsRevenue24h += tot; }
      if (t >= msToday){ paymentsCountToday++; paymentsRevenueToday += tot; }
    }
  }

  const deps = (ScriptApp.getDeploymentInfo && ScriptApp.getDeploymentInfo()) ? ScriptApp.getDeploymentInfo().map(d => d.getDeploymentId()) : [];

  return {
    sheetOk: !!sheetId,
    productsCount,
    paymentsCount,
    paymentsCount24h,
    paymentsCountToday,
    paymentsRevenue24h,
    paymentsRevenueToday,
    deploymentIds: deps,
    sheetId
  };
}

function getRevenueTrend_(days){
  const sh = paymentsSheet_();
  if (!sh) return { labels:[], values:[] };
  const data = sh.getDataRange().getValues();
  const h = data[0] || [];
  const tIdx = h.indexOf('Timestamp');
  const vIdx = h.indexOf('TotalInclVAT');
  if (tIdx < 0 || vIdx < 0) return { labels:[], values:[] };

  const end = new Date();
  const dcount = Math.max(1, Number(days)||30);
  const start = new Date(end.getTime() - dcount*24*60*60*1000);

  const map = {};
  for (let i=1;i<data.length;i++){
    const ts = data[i][tIdx];
    const val = Number(data[i][vIdx] || 0) || 0;
    const d = new Date(ts);
    if (isNaN(d)) continue;
    if (d < start || d > end) continue;
    const k = d.toISOString().slice(0,10);
    map[k] = (map[k] || 0) + val;
  }

  const labels=[];
  const values=[];
  for (let i=dcount-1;i>=0;i--){
    const d = new Date(end.getTime() - i*24*60*60*1000);
    const k = d.toISOString().slice(0,10);
    labels.push(k);
    values.push(Number(map[k] || 0));
  }
  return { labels, values };
}

/** ===================== Writes ===================== */
function updateProductField_(sku, field, value, idToken){
  sku = String(sku || '').trim();
  field = String(field || '').trim();
  if (!sku || !field) return false;

  const info = verifyIdToken_(String(idToken||''));
  const who = (info && info.email) ? String(info.email).toLowerCase() : 'admin';

  const sh = productsSheet_();
  if (!sh) return false;
  const data = sh.getDataRange().getValues();
  const h = data[0] || [];
  const skuIdx = h.indexOf('sku');
  const fIdx = h.indexOf(field);
  if (skuIdx < 0 || fIdx < 0) return false;

  let row = -1;
  for (let i=1;i<data.length;i++){
    if (String(data[i][skuIdx]).trim() === sku){ row = i+1; break; }
  }
  if (row === -1) return false;

  // Log price changes
  if (field === 'price'){
    const oldVal = sh.getRange(row, fIdx+1).getValue();
    if (String(oldVal) !== String(value)){
      appendPriceLog_(sku, oldVal, value, who, '');
    }
  }

  sh.getRange(row, fIdx+1).setValue(value);
  return true;
}

function appendPriceLog_(sku, oldPrice, newPrice, changedBy, note){
  const sh = priceLogSheet_();
  if (!sh) return;
  ensureHeader_(sh, ['Timestamp','SKU','OldPrice','NewPrice','ChangedBy','Note']);
  sh.appendRow([new Date().toISOString(), sku, oldPrice, newPrice, changedBy, note || '']);
}

function saveSettings_(req){
  const sh = settingsSheet_();
  ensureHeader_(sh, ['key','value']);

  const updates = {};
  if (req.priceList !== undefined) updates.priceList = String(req.priceList);
  if (req.supportEmail !== undefined) updates.supportEmail = String(req.supportEmail);

  // add any extra keys you want from the admin UI

  const data = sh.getDataRange().getValues();
  const map = {};
  for (let i=1;i<data.length;i++) map[String(data[i][0])] = i+1;

  Object.keys(updates).forEach(k => {
    if (map[k]) sh.getRange(map[k],2).setValue(updates[k]);
    else sh.appendRow([k, updates[k]]);
  });
}

/** ===================== Resend Invoice ===================== */
function handleResendInvoice_(req){
  const invoiceNo = String(req.invoice || '').trim();
  const orderId   = String(req.order || '').trim();
  const emailIn   = String(req.email || '').trim();

  const rec = findPaymentRecord_(invoiceNo, orderId, emailIn);
  if (!rec) return text_('ERR:not-found');

  const inv = String(rec.InvoiceNo || invoiceNo).trim();
  const buyerEmail = sanitizeEmail_(emailIn || rec.Email || '');
  if (!inv || !buyerEmail) return text_('ERR:missing-invoice-or-email');

  const pdf = findInvoicePdf_(inv, rec.Timestamp);
  if (!pdf) return text_('ERR:pdf-not-found');

  const adminEmail = PROPS.getProperty('ADMIN_EMAIL') || 'wykiesautomation@gmail.com';
  const brandName  = PROPS.getProperty('BRAND_NAME') || 'Wykies Automation';

  const subject = 'Invoice ' + inv + ' — ' + brandName;
  const total = Number(rec.TotalInclVAT || 0) || 0;
  const htmlBody = '<div style="font-family:Segoe UI,Arial,sans-serif">'
    + '<p>Hello,</p>'
    + '<p>Your invoice <b>' + esc_(inv) + '</b> is attached.</p>'
    + '<p><b>Order:</b> ' + esc_(rec.OrderID || '') + '<br/>'
    + '<b>SKU:</b> ' + esc_(rec.SKU || '') + '<br/>'
    + '<b>Total (incl. VAT):</b> R ' + esc_(total.toFixed(2)) + '</p>'
    + '<p>Regards,<br/>' + esc_(brandName) + '</p>'
    + '</div>';

  try{
    MailApp.sendEmail({
      to: buyerEmail,
      cc: adminEmail,
      subject,
      htmlBody,
      name: brandName,
      attachments: [pdf.getBlob()]
    });
  }catch(e){
    return text_('ERR:send-failed');
  }

  return text_('OK:resent');
}

function findPaymentRecord_(invoiceNo, orderId, email){
  const sh = paymentsSheet_();
  if (!sh) return null;
  const data = sh.getDataRange().getValues();
  const h = data[0] || [];
  const idxInv = h.indexOf('InvoiceNo');
  const idxOrd = h.indexOf('OrderID');
  const idxEmail = h.indexOf('Email');
  if (idxInv < 0 || idxOrd < 0 || idxEmail < 0) return null;

  const inv = String(invoiceNo||'').trim().toLowerCase();
  const ord = String(orderId||'').trim().toLowerCase();
  const eml = String(email||'').trim().toLowerCase();

  // 1) InvoiceNo exact
  if (inv){
    for (let i=1;i<data.length;i++){
      if (String(data[i][idxInv]).trim().toLowerCase() === inv) return rowToObj_(h, data[i]);
    }
  }
  // 2) OrderID exact
  if (ord){
    for (let i=1;i<data.length;i++){
      if (String(data[i][idxOrd]).trim().toLowerCase() === ord) return rowToObj_(h, data[i]);
    }
  }
  // 3) Latest by email
  let best = null;
  let bestTs = 0;
  if (eml){
    const tIdx = h.indexOf('Timestamp');
    for (let i=1;i<data.length;i++){
      if (String(data[i][idxEmail]).trim().toLowerCase() === eml){
        const t = new Date(data[i][tIdx] || '').getTime();
        if (!isNaN(t) && t > bestTs){ bestTs = t; best = rowToObj_(h, data[i]); }
      }
    }
  }
  return best;
}

function findInvoicePdf_(invoiceNo, timestamp){
  // Spec: PDF invoice naming INV-xxxxx.pdf stored under Drive Invoices/YYYY/  (root id in Script Properties)
  const rootId = PROPS.getProperty('INVOICE_DRIVE_FOLDER_ROOT_ID') || '';
  const year = (timestamp ? new Date(timestamp).getFullYear() : new Date().getFullYear());

  // Accept either raw InvoiceNo (e.g., 00012) or full INV-00012
  let inv = String(invoiceNo||'').trim();
  if (!inv) return null;
  if (!inv.toUpperCase().startsWith('INV-')) inv = 'INV-' + inv;

  const fileName = inv + '.pdf';

  if (rootId){
    try{
      const root = DriveApp.getFolderById(rootId);
      const yIt = root.getFoldersByName(String(year));
      if (yIt.hasNext()){
        const yFolder = yIt.next();
        const fIt = yFolder.getFilesByName(fileName);
        if (fIt.hasNext()) return fIt.next();
      }
      // fallback search inside root (not recursive but Drive search is)
      const q = 'title = "' + fileName.replace('"','') + '" and mimeType = "application/pdf"';
      const sIt = DriveApp.searchFiles(q);
      if (sIt.hasNext()) return sIt.next();
    }catch(e){ /* ignore */ }
  }

  // global fallback
  const q2 = 'title = "' + fileName.replace('"','') + '" and mimeType = "application/pdf"';
  const s2 = DriveApp.searchFiles(q2);
  return s2.hasNext() ? s2.next() : null;
}

function sanitizeEmail_(e){
  e = String(e||'').trim();
  return /\S+@\S+\.[A-Za-z]{2,}/.test(e) ? e : '';
}

/** ===================== Utilities ===================== */
function parseReq_(e){
  const out = {};
  if (e && e.parameter) Object.keys(e.parameter).forEach(k => out[k] = e.parameter[k]);
  if (e && e.postData && e.postData.contents){
    const ct = String(e.postData.type || '').toLowerCase();
    if (ct.indexOf('application/json') >= 0){
      try{ Object.assign(out, JSON.parse(e.postData.contents)); }catch(_){ }
    }
  }
  return out;
}

function json_(o){
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function text_(s){
  return ContentService.createTextOutput(String(s));
}
function esc_(s){
  return String(s||'').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);
}
