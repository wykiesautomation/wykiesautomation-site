
// ===== CONFIG =====
const SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '12qRMe6pAPVaQtosZBnhVtpMwyNks7W8uY9PX1mF620k';
const ADMIN_PASS_HASH = PropertiesService.getScriptProperties().getProperty('ADMIN_PASS_HASH'); // hex sha256
const SESSION_TTL_SECS = 8*60*60; // 8h

function doGet(e){
  const action = (e.parameter.action||'').toLowerCase();
  if(action==='pricelog') return json(listPriceLog());
  if(action==='session') return json(checkSession(e));
  return json({ ok:true, msg:'alive' });
}

function doPost(e){
  const action = (e.parameter.action||'').toLowerCase();
  const body = e.parameter || {};
  if(action==='login') return json(login(body));
  const sess = requireAuth(e);
  if(action==='listproducts') return json(listProducts());
  if(action==='addproduct') return json(addProduct(body, sess));
  if(action==='updateproduct') return json(updateProduct(body, sess));
  if(action==='listpayments') return json(listPayments());
  if(action==='listlogs') return json(listLogs());
  return json({ ok:false, error:'unknown action' }, 400);
}

function json(obj){
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function sha256Hex(s){
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s);
  return bytes.map(b=>('0'+(b&0xFF).toString(16)).slice(-2)).join('');
}

function uuid(){ return Utilities.getUuid(); }

function login(body){
  const pass = (body.passphrase||'').trim();
  if(!ADMIN_PASS_HASH) return { ok:false, error:'Admin hash not set' };
  if(sha256Hex(pass) !== ADMIN_PASS_HASH) return { ok:false, error:'bad pass' };
  const token = uuid();
  CacheService.getScriptCache().put('sess:'+token, JSON.stringify({ role:'admin' }), SESSION_TTL_SECS);
  return { ok:true, token: token, role: 'admin' };
}

function checkSession(e){
  const token = getToken(e);
  if(!token) return { ok:false };
  const data = CacheService.getScriptCache().get('sess:'+token);
  if(!data) return { ok:false };
  const sess = JSON.parse(data);
  return { ok:true, role:sess.role };
}

function requireAuth(e){
  const token = getToken(e);
  if(!token) throw new Error('unauthorized');
  const data = CacheService.getScriptCache().get('sess:'+token);
  if(!data) throw new Error('unauthorized');
  return JSON.parse(data);
}

function getToken(e){
  // Apps Script doesn't expose Authorization; send token in body OR as ?token=...
  if (e.parameter && e.parameter.token) return e.parameter.token;
  if (e.parameter && e.parameter.token) return e.parameter.token;
  return null;
}

function sheet(name){ return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name); }

function listProducts(){
  const sh = sheet('Products');
  const values = sh.getDataRange().getValues();
  const [header, ...rows] = values;
  const idx = Object.fromEntries(header.map((h,i)=>[String(h).trim().toLowerCase(), i]));
  return rows.filter(r=>r[idx['sku']]).map(r=>({
    sku: r[idx['sku']], name: r[idx['name']], price: r[idx['price']],
    summary: r[idx['summary']], imageUrl: r[idx['imageurl']], active: r[idx['active']]==true || r[idx['active']]==='true'
  }));
}

function addProduct(body, sess){
  if(sess.role!=='admin') return { ok:false, error:'forbidden' };
  const sh = sheet('Products');
  sh.appendRow([body.sku, body.name, body.price, '', '', '', '', true]);
  logAction('add', 'product', body.sku, 'ok');
  return { ok:true };
}

function updateProduct(body, sess){
  if(sess.role!=='admin') return { ok:false, error:'forbidden' };
  const sh = sheet('Products');
  const values = sh.getDataRange().getValues();
  const [header, ...rows] = values;
  const idx = Object.fromEntries(header.map((h,i)=>[String(h).trim().toLowerCase(), i]));
  for (let i=0;i<rows.length;i++){
    if(rows[i][idx['sku']]===body.sku){
      if(body.name!=null) rows[i][idx['name']] = body.name;
      if(body.price!=null) rows[i][idx['price']] = body.price;
      if(body.active!=null) rows[i][idx['active']] = body.active;
      sh.getRange(i+2, 1, 1, header.length).setValues([rows[i]]);
      logAction('update', 'product', body.sku, 'ok');
      return { ok:true };
    }
  }
  return { ok:false, error:'not found' };
}

function listPayments(){
  const sh = sheet('Payments');
  if(!sh) return [];
  const [header, ...rows] = sh.getDataRange().getValues();
  const idx = Object.fromEntries(header.map((h,i)=>[String(h).trim().toLowerCase(), i]));
  return rows.map(r=>({ timestamp:r[idx['timestamp']], invoiceNo:r[idx['invoiceno']], email:r[idx['email']], sku:r[idx['sku']], totalInclVAT:r[idx['totalinclvat']] }));
}

function listLogs(){
  const sh = sheet('Logs'); if(!sh) return [];
  const [header, ...rows] = sh.getDataRange().getValues();
  const idx = Object.fromEntries(header.map((h,i)=>[String(h).trim().toLowerCase(), i]));
  return rows.slice(-100).map(r=>({ timestamp:r[idx['timestamp']], actor:r[idx['actor']], action:r[idx['action']], entity:r[idx['entityid']], result:r[idx['result']] }));
}

function listPriceLog(){
  const sh = sheet('PriceChanges'); if(!sh) return [];
  const [header, ...rows] = sh.getDataRange().getValues();
  const idx = Object.fromEntries(header.map((h,i)=>[String(h).trim().toLowerCase(), i]));
  return rows.slice(-50).map(r=>({ Timestamp:r[idx['timestamp']], SKU:r[idx['sku']], Price:r[idx['newprice']] }));
}

function logAction(action, entity, id, result){
  const sh = sheet('Logs'); if(!sh) return;
  sh.appendRow([new Date(), 'admin', action, entity, id, '', '', Session.getActiveUser().getEmail()||'', result]);
}
