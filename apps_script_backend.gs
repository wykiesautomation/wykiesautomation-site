
// ===== CONFIG =====
const SHEET_ID = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '12qRMe6pAPVaQtosZBnhVtpMwyNks7W8uY9PX1mF620k';
const ADMIN_PASS_HASH = PropertiesService.getScriptProperties().getProperty('ADMIN_PASS_HASH');
const GSI_CLIENT_ID = PropertiesService.getScriptProperties().getProperty('GSI_CLIENT_ID') || '291364861368-vskn09o73106qa9rqrt4bhbhif87vdim.apps.googleusercontent.com';
const ALLOW_EMAILS = (PropertiesService.getScriptProperties().getProperty('ALLOW_EMAILS') || 'wykiesautomation@gmail.com').toLowerCase();
const SESSION_TTL_SECS = 8*60*60; // 8h

function json(obj){ const out = ContentService.createTextOutput(JSON.stringify(obj)); out.setMimeType(ContentService.MimeType.JSON); return out; }
function sha256Hex(s){ const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s); return bytes.map(b=>('0'+(b&0xFF).toString(16)).slice(-2)).join(''); }
function uuid(){ return Utilities.getUuid(); }
function sheet(name){ return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name); }

function doGet(e){
  const action = (e.parameter.action||'').toLowerCase();
  if(action==='pricelog') return json(listPriceLog());
  if(action==='session') return json(checkSession(e));
  if(action==='listproducts_public') return json(listProductsPublic());
  return json({ ok:true, msg:'alive' });
}

function doPost(e){
  const action = (e.parameter.action||'').toLowerCase();
  const body = e.parameter || {};
  if(action==='login') return json(login(body));
  if(action==='gsilogin') return json(gsiLogin(body));
  const sess = requireAuth(e);
  if(action==='listproducts') return json(listProducts());
  if(action==='addproduct') return json(addProduct(body, sess));
  if(action==='updateproduct') return json(updateProduct(body, sess));
  if(action==='listpayments') return json(listPayments());
  if(action==='listlogs') return json(listLogs());
  if(action==='savepage') return json(savePage(body, sess));
  if(action==='sendenquiry') return json(sendEnquiry(body));
  if(action==='resendinvoice') return json(resendInvoice(body, sess));
  return json({ ok:false, error:'unknown action' }, 400);
}

function login(body){ const pass = (body.passphrase||'').trim(); if(!ADMIN_PASS_HASH) return { ok:false, error:'Admin hash not set' }; if(sha256Hex(pass) !== ADMIN_PASS_HASH) return { ok:false, error:'bad pass' }; const token = uuid(); CacheService.getScriptCache().put('sess:'+token, JSON.stringify({ role:'admin' }), SESSION_TTL_SECS); return { ok:true, token: token, role: 'admin' }; }
function gsiLogin(body){ try{ const cred=(body.credential||'').trim(); if(!cred) return { ok:false, error:'missing credential' }; const res=UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(cred), { muteHttpExceptions:true }); if(res.getResponseCode()!==200) return { ok:false, error:'token invalid' }; const info=JSON.parse(res.getContentText()); if(info.aud !== GSI_CLIENT_ID) return { ok:false, error:'aud mismatch' }; const email=String(info.email||'').toLowerCase(); if(!email) return { ok:false, error:'no email' }; if(ALLOW_EMAILS && ALLOW_EMAILS.split(',').map(s=>s.trim()).indexOf(email)<0) return { ok:false, error:'not allowed' }; const token=uuid(); CacheService.getScriptCache().put('sess:'+token, JSON.stringify({ role:'admin', email }), SESSION_TTL_SECS); return { ok:true, token, role:'admin' }; }catch(err){ return { ok:false, error:String(err) } }}
function getToken(e){ if (e.parameter && e.parameter.token) return e.parameter.token; return null; }
function checkSession(e){ const token=getToken(e); if(!token) return { ok:false }; const data=CacheService.getScriptCache().get('sess:'+token); if(!data) return { ok:false }; const sess=JSON.parse(data); return { ok:true, role:sess.role }; }
function requireAuth(e){ const token=getToken(e); if(!token) throw new Error('unauthorized'); const data=CacheService.getScriptCache().get('sess:'+token); if(!data) throw new Error('unauthorized'); return JSON.parse(data); }

function listProducts(){ const sh=sheet('Products'); const values=sh.getDataRange().getValues(); const [header, ...rows]=values; const idx=Object.fromEntries(header.map((h,i)=>[String(h).trim().toLowerCase(), i])); return rows.filter(r=>r[idx['sku']]).map(r=>({ sku:r[idx['sku']], name:r[idx['name']], price:r[idx['price']], summary:r[idx['summary']], description:r[idx['description']], imageUrl:r[idx['imageurl']], trialUrl:r[idx['trialurl']], docUrl:r[idx['docurl']], buyUrl:r[idx['buyurl']], active:r[idx['active']]==true || String(r[idx['active']]).toLowerCase()==='true' })); }
function listProductsPublic(){ const sh=sheet('Products'); const values=sh.getDataRange().getValues(); const [header, ...rows]=values; const idx=Object.fromEntries(header.map((h,i)=>[String(h).trim().toLowerCase(), i])); return rows.filter(r=>r[idx['sku']]).map(r=>({ sku:r[idx['sku']], name:r[idx['name']], price:r[idx['price']], imageUrl:r[idx['imageurl']], trialUrl:r[idx['trialurl']], docUrl:r[idx['docurl']], buyUrl:r[idx['buyurl']], active:r[idx['active']]==true || String(r[idx['active']]).toLowerCase()==='true' })); }

function addProduct(body, sess){ if(sess.role!=='admin') return { ok:false, error:'forbidden' }; const sh=sheet('Products'); const cols = sh.getDataRange().getValues()[0].map(h=>String(h).trim().toLowerCase()); const row = []; function at(name, value){ const i=cols.indexOf(name); if(i<0) return; row[i]=value; }
  // prefill all known columns
  for (let i=0;i<cols.length;i++) row[i]='';
  at('sku', body.sku); at('name', body.name); at('price', Number(body.price||0)); at('summary', ''); at('description',''); at('imageurl', body.imageUrl||''); at('trialurl', body.trialUrl||''); at('docurl', body.docUrl||''); at('buyurl', body.buyUrl||''); at('active', true);
  sh.appendRow(row); logAction('add','product',body.sku,'ok'); return { ok:true }; }

function updateProduct(body, sess){ if(sess.role!=='admin') return { ok:false, error:'forbidden' }; const sh=sheet('Products'); const values=sh.getDataRange().getValues(); const [header, ...rows]=values; const idx=Object.fromEntries(header.map((h,i)=>[String(h).trim().toLowerCase(), i])); for(let i=0;i<rows.length;i++){ if(rows[i][idx['sku']]===body.sku){ if(body.name!=null) rows[i][idx['name']] = body.name; if(body.price!=null) rows[i][idx['price']] = Number(body.price); if(body.imageUrl!=null && idx['imageurl']>=0) rows[i][idx['imageurl']] = body.imageUrl; if(body.trialUrl!=null && idx['trialurl']>=0) rows[i][idx['trialurl']] = body.trialUrl; if(body.docUrl!=null && idx['docurl']>=0) rows[i][idx['docurl']] = body.docUrl; if(body.buyUrl!=null && idx['buyurl']>=0) rows[i][idx['buyurl']] = body.buyUrl; if(body.active!=null) rows[i][idx['active']] = (String(body.active).toLowerCase()==='true'); sh.getRange(i+2,1,1,header.length).setValues([rows[i]]); logAction('update','product',body.sku,'ok'); return { ok:true }; } } return { ok:false, error:'not found' } }

function listPayments(){ const sh=sheet('Payments'); if(!sh) return []; const [header, ...rows]=sh.getDataRange().getValues(); const idx=Object.fromEntries(header.map((h,i)=>[String(h).trim().toLowerCase(), i])); return rows.map(r=>({ timestamp:r[idx['timestamp']], invoiceNo:r[idx['invoiceno']], orderId:r[idx['orderid']]||'', email:r[idx['email']], sku:r[idx['sku']], totalInclVAT:r[idx['totalinclvat']] })); }
function listLogs(){ const sh=sheet('Logs'); if(!sh) return []; const [header, ...rows]=sh.getDataRange().getValues(); const idx=Object.fromEntries(header.map((h,i)=>[String(h).trim().toLowerCase(), i])); return rows.slice(-100).map(r=>({ timestamp:r[idx['timestamp']], actor:r[idx['actor']], action:r[idx['action']], entity:r[idx['entityid']], result:r[idx['result']] })); }
function listPriceLog(){ const sh=sheet('PriceChanges'); if(!sh) return []; const [header, ...rows]=sh.getDataRange().getValues(); const idx=Object.fromEntries(header.map((h,i)=>[String(h).trim().toLowerCase(), i])); return rows.slice(-50).map(r=>({ Timestamp:r[idx['timestamp']], SKU:r[idx['sku']], Price:r[idx['newprice']] })); }
function savePage(body, sess){ if(sess.role!=='admin') return { ok:false, error:'forbidden' }; const sh=sheet('Pages'); const hist=sheet('PagesHistory'); const slug=(body.slug||'').trim(); const title=(body.title||'').trim(); const content=(body.body||''); if(!slug) return { ok:false, error:'no slug' }; const values=sh.getDataRange().getValues(); const [header, ...rows]=values; const idx=Object.fromEntries(header.map((h,i)=>[String(h).trim().toLowerCase(), i])); let found=-1; for(let i=0;i<rows.length;i++){ if(rows[i][idx['slug']]===slug){ found=i; break; } } const now=new Date(); if(found>=0){ rows[found][idx['title']] = title; rows[found][idx['bodymarkdown']] = content; rows[found][idx['status']] = 'published'; rows[found][idx['lasteditedby']] = 'admin'; rows[found][idx['lasteditedat']] = now; sh.getRange(found+2,1,1,header.length).setValues([rows[found]]); } else { sh.appendRow([slug, title, content, 'published', true, 'admin', now]); } if(hist){ hist.appendRow([slug, (now.getTime()), title, content, 'admin', now]); } logAction('save','page',slug,'ok'); return { ok:true }; }
function resendInvoice(body, sess){ if(sess.role!=='admin') return { ok:false, error:'forbidden' }; try{ const email=body.email||''; const invoiceNo=body.invoiceNo||''; MailApp.sendEmail(email||'wykiesautomation@gmail.com', 'Invoice '+invoiceNo, 'Your invoice: '+invoiceNo+' will be resent by admin.'); logAction('email','invoice',invoiceNo,'ok'); return { ok:true }; }catch(err){ return { ok:false, error:String(err) } } }
function sendEnquiry(body){ const name=body.name||''; const email=body.email||''; const phone=body.phone||''; const product=body.product||''; const message=body.message||''; const emailCopy=String(body.emailCopy||'false').toLowerCase()==='true'; const whatsappOptIn=String(body.whatsappOptIn||'false').toLowerCase()==='true'; const sh=sheet('Enquiries'); if(sh){ sh.appendRow([new Date(), name, email, phone, product, message, emailCopy, whatsappOptIn, '', '']); } try{ MailApp.sendEmail('wykiesautomation@gmail.com', `New enquiry: ${name}`, `Product: ${product}
Phone: ${phone}
Email: ${email}

Message:
${message}`); if(emailCopy && email){ MailApp.sendEmail(email, 'We received your enquiry', 'Thanks for contacting Wykies Automation. We will reply shortly.'); } }catch(err){ return { ok:false, error:String(err) } } return { ok:true }; }
function logAction(action, entity, id, result){ const sh=sheet('Logs'); if(!sh) return; sh.appendRow([new Date(), 'admin', action, entity, id, '', '', '', result]); }
