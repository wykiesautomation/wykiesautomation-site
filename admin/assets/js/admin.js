// Admin JS for /admin (GitHub Pages)
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxj61ify3rtv-e-jc3c2Xajn1hs_AhhWXaUgl-hSoVu02uzI3yPVEelsxRXxxm1ln_w/exec',
  ALLOWLIST: ['wykiesautomation@gmail.com']
};
const $ = (s)=>document.querySelector(s);
const toastEl = $('#toast');
const grid = $('#grid');
const paymentsBody = $('#paymentsBody');
const emptyProducts = $('#emptyProducts');
const emptyPayments = $('#emptyPayments');
const whoami = $('#whoami');

let USER = { email:null, admin:false, token:null };
try { const saved = JSON.parse(localStorage.getItem('wa_admin_user')||'null'); if(saved && saved.email && saved.token) USER=saved; } catch(e) {}

let PRODUCTS=[]; let PAYMENTS=[]; let SETTINGS={};

init();

async function init(){
  bindAuth();
  bindUI();
  setUserUI();
  await loadAll();
}

function bindAuth(){
  window.onGoogleSignIn = onGoogleSignIn;

  $('#btnSignOut').onclick = () => {
    try { if(USER.email) google.accounts.id.revoke(USER.email, ()=>{}); } catch(e) {}
    USER = { email:null, admin:false, token:null };
    setUserUI();
    toast('Signed out');
  };

  $('#btnSignInFallback').onclick = async () => {
    const email = prompt('Admin email:');
    if(!email || !CONFIG.ALLOWLIST.includes(email.trim().toLowerCase())) return toast('Not on allowlist','error');
    const pass = prompt('Passphrase:'); if(!pass) return;
    const resp = await postForm({ action:'auth', email, pass });
    const parsed = parseOk(resp);
    if(!parsed.ok) return toast('Auth failed','error');
    USER = { email: parsed.email, admin:true, token: parsed.token };
    setUserUI();
    toast('Signed in');
    await loadAll();
  };
}

async function onGoogleSignIn(response){
  try{
    const idToken = response && response.credential;
    if(!idToken) return toast('No credential','error');
    const resp = await postForm({ action:'verifyGoogleId', idToken });
    const parsed = parseOk(resp);
    if(!parsed.ok) return toast('Google sign-in failed','error');
    USER = { email: parsed.email, admin:true, token: parsed.token };
    setUserUI();
    toast('Signed in as ' + parsed.email);
    await loadAll();
  }catch(e){ console.error(e); toast('Sign-in error','error'); }
}

function bindUI(){
  $('#btnRefresh').onclick = ()=>loadAll();
  $('#search').addEventListener('input', debounce(()=>renderProducts(filterProducts($('#search').value)),120));
  $('#paySearch').addEventListener('input', debounce(()=>renderPayments(filterPayments($('#paySearch').value)),120));
  $('#btnSaveSettings').onclick = saveSettings;
}

function setUserUI(){
  const signedIn = !!(USER && USER.admin && USER.email && USER.token);
  const googleBtn = document.getElementById('googleBtn');
  if(googleBtn) googleBtn.style.display = signedIn ? 'none' : '';
  $('#btnSignOut').classList.toggle('hidden', !signedIn);
  $('#btnSignInFallback').classList.toggle('hidden', signedIn);
  if(signedIn){ whoami.textContent = 'Signed in: ' + USER.email; whoami.classList.remove('hidden'); }
  else { whoami.classList.add('hidden'); }
  try { localStorage.setItem('wa_admin_user', JSON.stringify(USER)); } catch(e) {}
}

async function loadAll(){
  await Promise.all([loadProducts(), loadPayments(), loadSettings()]);
  renderProducts(PRODUCTS);
  renderPayments(PAYMENTS);
  updateKpis();
  renderLogs();
}

async function loadProducts(){
  try{ const r=await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=products`,{cache:'no-store'}); PRODUCTS=await r.json(); }
  catch(e){ PRODUCTS=[]; }
}
async function loadPayments(){
  try{ const r=await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=payments`,{cache:'no-store'}); PAYMENTS=await r.json(); }
  catch(e){ PAYMENTS=[]; }
}
async function loadSettings(){
  try{ const r=await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=settings`,{cache:'no-store'}); SETTINGS=await r.json()||{}; $('#priceList').value = SETTINGS.priceList || ''; }
  catch(e){ SETTINGS={}; }
}

function filterProducts(q){
  q=(q||'').toLowerCase().trim();
  if(!q) return PRODUCTS;
  return PRODUCTS.filter(p=>[p.sku,p.name,p.summary].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)));
}

function textInput(p, field, w){
  const v = p[field] ?? '';
  const style = w ? `style="width:${w}"` : '';
  return `<input data-field="${field}" data-sku="${esc(p.sku)}" class="input" ${style} value="${attr(v)}">`;
}
function boolSwitch(p, field){
  const on = String(p[field]).toLowerCase()==='true' || p[field]===true;
  return `<button data-field="${field}" data-sku="${esc(p.sku)}" class="switch" data-on="${on}"><i></i></button>`;
}

function bindRow(tr){
  tr.querySelectorAll('input[data-field]').forEach(inp=>{
    inp.addEventListener('change', async ()=>{
      if(!USER.admin) return toast('Read-only','error');
      const ok = await updateField(inp.dataset.sku, inp.dataset.field, inp.value);
      toast(ok?'Saved':'Save failed', ok?null:'error');
    });
  });
  tr.querySelectorAll('button.switch[data-field]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!USER.admin) return toast('Read-only','error');
      const nv = !(btn.getAttribute('data-on')==='true');
      const ok = await updateField(btn.dataset.sku, btn.dataset.field, nv);
      if(ok){ btn.setAttribute('data-on', String(nv)); toast((nv?'Enabled ':'Disabled ') + btn.dataset.field); }
      else toast('Save failed','error');
    });
  });
}

function renderProducts(list){
  grid.innerHTML='';
  if(!list.length){ emptyProducts.classList.remove('hidden'); return; }
  emptyProducts.classList.add('hidden');
  for(const p of list){
    const tr=document.createElement('tr');
    tr.className='border-t border-slate-800 align-top';
    tr.innerHTML = `
      <td class='p-2 font-medium'>${esc(p.sku)}</td>
      <td class='p-2'>${textInput(p,'name')}</td>
      <td class='p-2'>${textInput(p,'price','120px')}</td>
      <td class='p-2'>${boolSwitch(p,'preOrder')}</td>
      <td class='p-2'>${boolSwitch(p,'buyEnabled')}</td>
      <td class='p-2'>${boolSwitch(p,'active')}</td>
      <td class='p-2'>${textInput(p,'docUrl','220px')}</td>
      <td class='p-2'>${textInput(p,'trialUrl','180px')}</td>
      <td class='p-2'>${textInput(p,'detailsUrl','180px')}</td>
      <td class='p-2'>${textInput(p,'imageUrl','220px')}</td>
      <td class='p-2'>${textInput(p,'sortOrder','64px')}</td>
      <td class='p-2'>${textInput(p,'ogImage','180px')}</td>
      <td class='p-2 text-right'><button class='btn' data-img='${esc(p.imageUrl||'')}' onclick='previewImage(this)'>Preview</button></td>`;
    grid.appendChild(tr);
    bindRow(tr);
  }
}

function filterPayments(q){
  q=(q||'').toLowerCase().trim();
  if(!q) return PAYMENTS;
  return PAYMENTS.filter(r=>[r.Email,r.OrderID,r.SKU,r.InvoiceNo,r.pf_payment_id].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)));
}

function renderPayments(list){
  paymentsBody.innerHTML='';
  if(!list.length){ emptyPayments.classList.remove('hidden'); return; }
  emptyPayments.classList.add('hidden');
  for(const r of list){
    const tr=document.createElement('tr');
    tr.className='border-t border-slate-800';
    tr.innerHTML = `
      <td class='p-2'>${esc(r.Timestamp||'')}</td>
      <td class='p-2'>${esc(r.InvoiceNo||'')}</td>
      <td class='p-2'>${esc(r.OrderID||'')}</td>
      <td class='p-2'>${esc(r.Email||'')}</td>
      <td class='p-2'>${esc(r.SKU||'')}</td>
      <td class='p-2'>R${esc(r.TotalInclVAT||'')}</td>
      <td class='p-2'>${esc(r.pf_payment_id||'')}</td>
      <td class='p-2 text-right'>${USER.admin?`<button class='btn' onclick="resend('${attr(r.InvoiceNo||'')}','${attr(r.Email||'')}','${attr(r.OrderID||'')}')">Resend Invoice</button>`:''}</td>`;
    paymentsBody.appendChild(tr);
  }
}

async function resend(inv,email,order){
  if(!USER.admin) return toast('Sign in first','error');
  const resp = await postForm({ action:'resendInvoice', invoice:inv, email, order });
  toast(typeof resp==='string' ? resp : 'Resent');
}

async function saveSettings(){
  if(!USER.admin) return toast('Sign in first','error');
  const priceList = $('#priceList').value.trim();
  const resp = await postForm({ action:'saveSettings', priceList });
  toast(typeof resp==='string' ? resp : 'Saved');
}

async function updateField(sku, field, value){
  try{ const resp = await postForm({ action:'updateProduct', sku, field, value }); return String(resp).includes('OK'); }
  catch(e){ return false; }
}

function updateKpis(){
  try{
    const now = new Date();
    const yyyy=now.getFullYear();
    const mm=String(now.getMonth()+1).padStart(2,'0');
    const dd=String(now.getDate()).padStart(2,'0');
    const prefix=`${yyyy}-${mm}-${dd}`;
    let sales=0, itns=0;
    for(const r of (PAYMENTS||[])){
      const ts=String(r.Timestamp||'');
      if(ts.startsWith(prefix)){
        const val=parseFloat(String(r.TotalInclVAT||'0').replace(/[^0-9.]/g,''))||0;
        sales += val;
        if(r.pf_payment_id) itns += 1;
      }
    }
    $('#kpiSales').textContent = 'R ' + sales.toFixed(2);
    $('#kpiITN').textContent = String(itns);
    $('#kpiHealth').textContent = 'OK';
  }catch(e){}
}

function renderLogs(){
  const box=$('#logBox');
  const now=new Date().toISOString().slice(0,19).replace('T',' ');
  box.innerHTML = `<div class='p-3'>[${now}] admin.view products</div><div class='p-3'>[${now}] admin.view payments</div>`;
}

function previewImage(btn){
  const src = btn.dataset.img || '';
  if(!src) return toast('No image URL','error');
  const w = window.open('','_blank');
  w.document.write(`<img src="${src}" style="max-width:100%;height:auto">`);
}

function parseOk(t){
  const s=String(t||'');
  if(!s.startsWith('OK:')) return { ok:false };
  const parts=s.split(':');
  return { ok:true, email:(parts[1]||'').toLowerCase(), token: parts[2]||null };
}

function esc(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function attr(s){
  return esc(s).replace(/"/g,'&quot;');
}
function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }

function toast(msg,type){
  toastEl.textContent = msg;
  toastEl.style.borderColor = (type==='error') ? '#ef4444' : '#334155';
  toastEl.style.display = 'block';
  setTimeout(()=>toastEl.style.display='none', 2200);
}

async function postForm(obj){
  if(USER && USER.token && !obj.token) obj.token = USER.token;
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'},
    body:new URLSearchParams(obj)
  });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return txt; }
}
