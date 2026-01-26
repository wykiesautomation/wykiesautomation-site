// ====== WykiesAutomation app.js — FORCE JSONP + PAYFAST GUARDS ======
// Eliminates browser CORS by using JSONP only and prevents POST /undefined by validating payload.

const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));

const APPS_URL = 'https://script.google.com/macros/s/AKfycbwO16jzeQVcsNt4zOj-YQ8LndsMgaTk089QZkgkb0YrxVf8IbxQi9fnK_1mL9q83d8_LA/exec';

function toast(msg, type='info'){
  const t = $('#toast'); if (!t) return; t.textContent = msg;
  t.style.borderColor = type==='error' ? '#ef4444' : 'rgba(148,163,184,.25)';
  t.classList.add('on'); clearTimeout(window.__t);
  window.__t = setTimeout(() => t.classList.remove('on'), 3200);
}

function moneyZAR(v){
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return String(v ?? '');
  return 'R ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function isHttp(u){ return /^https?:\/\//i.test(String(u || '')); }

function prodImg(p){
  const u = (p && (p.image || p.imageUrl || p.ogImage)) || '';
  const PLACEHOLDER = '/assets/product/wa-01.png';
  if (!u) return PLACEHOLDER;
  if (isHttp(u)) return u;
  const clean = String(u).trim().replace(/^\/+/, '').replace(/^assets\/(product|products|img)\//i, '');
  return `/assets/product/${clean}`;
}

// ---- JSONP helper ----
function jsonp(url, params = {}, timeoutMs = 12000){
  return new Promise((resolve, reject) => {
    const cbName = `__jsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const q = new URLSearchParams({ ...params, callback: cbName }).toString();
    const s = document.createElement('script');
    let done = false; let timer = null;

    window[cbName] = (data) => { if (done) return; done = true; cleanup(); resolve(data); };
    function cleanup(){ if (timer) clearTimeout(timer); try { delete window[cbName]; } catch { window[cbName] = undefined; } s.remove(); }
    s.onerror = () => { if (done) return; done = true; cleanup(); reject(new Error('JSONP network error')); };
    timer = setTimeout(() => { if (done) return; done = true; cleanup(); reject(new Error('JSONP timeout')); }, timeoutMs);

    s.src = url + (url.includes('?') ? '&' : '?') + q;
    s.async = true; document.head.appendChild(s);
  });
}

// ---- API (JSONP ONLY) ----
async function api(op, params = {}){
  return await jsonp(APPS_URL, { op, ...params });
}

function waLink(sku, name){
  const phone = '27716816131';
  const msg = encodeURIComponent(`Hi Wykies Automation, I would like to order: ${sku} — ${name}`);
  return `https://wa.me/${phone}?text=${msg}`;
}

function card(p){
  const active = String(p.active).toLowerCase() !== 'false' && p.active !== false;
  if (!active) return '';
  const sku = p.sku || '';
  const name = p.name || '';
  const sum = p.summary || '';
  const img = prodImg(p);
  const docUrl = p.docUrl || '';
  const trialUrl = p.trialUrl || '';
  const detailsUrl = p.detailsUrl || `product.html?sku=${encodeURIComponent(sku)}`;
  const pre = String(p.preOrder).toLowerCase() === 'true' || p.preOrder === true;

  return `
  <div class="card pad" data-sku="${sku}" style="display:flex;flex-direction:column;min-height:100%">
    <img class="prod-img" src="${img}" alt="${name}"
         onerror="this.onerror=null;this.src='/assets/product/wa-01.png'">

    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px">
      <div class="pill">${sku}</div>
      <div class="price">${moneyZAR(p.price || '')}</div>
    </div>

    <div style="margin-top:10px">
      <strong>${name}</strong>
      ${pre ? '<span class="pill" style="margin-left:8px;border-color:rgba(245,158,11,.35);color:#fcd34d">Pre‑Order</span>' : ''}
    </div>

    <p class="muted" style="line-height:1.5;margin:8px 0 0">${sum}</p>

    <div class="btnrow" style="margin-top:auto">
      <a class="btn outline" href="${detailsUrl}">Details</a>
      ${docUrl ? `<a class="btn outline" href="${docUrl}" target="_blank" rel="noopener">View Docs</a>` : ''}
      ${trialUrl ? `<a class="btn outline" href="${trialUrl}" target="_blank" rel="noopener">Download Trial</a>` : ''}
      <a class="btn whatsapp" href="${waLink(sku, name)}" target="_blank" rel="noopener">WhatsApp</a>
      <button class="btn primary" data-buy="1" data-sku="${sku}" data-name="${name}">Buy Now</button>
    </div>

    <div class="small" style="margin-top:10px">Prices are VAT‑inclusive. Secure checkout via PayFast.</div>
  </div>`;
}

function bindBuy(){ $$('button[data-buy="1"]').forEach(b => b.onclick = () => openCheckout(b.dataset.sku, b.dataset.name)); }

let CURRENT = null;
function openCheckout(sku, name){
  CURRENT = { sku, name };
  const s = $('#buySku'); if (s) s.textContent = sku;
  const n = $('#buyName'); if (n) n.textContent = name;
  const m = $('#modalCheckout'); if (m) m.classList.add('on');
  const em = $('#buyerEmail'); if (em) em.focus();
}
function closeCheckout(){ const m = $('#modalCheckout'); if (m) m.classList.remove('on'); }

function openPayFastFromPayload(payload){
  try{
    if (!payload || typeof payload !== 'object') throw new Error('Invalid payload (empty)');
    const processUrl = payload.processUrl || payload.process_url || payload.url || '';
    const fields = payload.fields || payload.data || payload.params || {};
    const method = (payload.method || 'POST').toUpperCase();

    if (!processUrl) throw new Error('Invalid payload: processUrl missing');
    if (!fields || typeof fields !== 'object' || !Object.keys(fields).length) throw new Error('Invalid payload: fields missing');

    // Optional sanity check
    if (!/^https:\/\/(sandbox\.)?payfast\.co\.za\/eng\/process/i.test(processUrl)) {
      console.warn('[PayFast] Unexpected processUrl:', processUrl);
    }

    if (method === 'GET'){
      const q = new URLSearchParams(fields).toString();
      window.location.href = processUrl + (processUrl.includes('?') ? '&' : '?') + q;
      return true;
    }

    const form = document.createElement('form'); form.method = 'POST'; form.action = processUrl;
    for (const [k, v] of Object.entries(fields)){
      const i = document.createElement('input'); i.type='hidden'; i.name=k; i.value=v; form.appendChild(i);
    }
    document.body.appendChild(form); form.submit();
    return true;
  }catch(err){
    console.error('[PayFast] openPayFastFromPayload error:', err);
    toast('Checkout isn\'t ready. Please try again or order on WhatsApp.', 'error');
    return false;
  }
}

async function proceedPayFast(){
  const emailEl = $('#buyerEmail'); const email = emailEl ? emailEl.value.trim() : '';
  if (!email) return toast('Please enter your email address', 'error');
  const btn = $('#btnPay');
  try{
    if (btn){ btn.disabled = true; btn.textContent = 'Preparing…'; }
    const payload = await api('createPayment', { sku: CURRENT.sku, email, env: 'live' });
    console.debug('[PayFast] payload', payload);
    const ok = openPayFastFromPayload(payload);
    if (!ok) { /* do nothing; toast already shown */ }
  }catch(e){
    console.error('[PayFast] setup failed:', e);
    toast('Checkout failed. Please try again or order on WhatsApp.', 'error');
  }finally{
    if (btn){ btn.disabled = false; btn.textContent = 'Proceed to PayFast'; }
  }
}

async function renderProducts(){
  const grid = $('#grid'); if (!grid) return;
  let products = [];
  try { products = await api('products'); } catch { products = []; }

  grid.innerHTML = products.map(card).join('');
  bindBuy();
  $$('.prod-img', grid).forEach(img => img.addEventListener('error', () => console.warn('Image 404:', img.src)));

  const sel = $('#docSelect'); const btn = $('#btnDocDownload');
  if (sel && btn){
    const active = products.filter(p => String(p.active).toLowerCase() !== 'false');
    sel.innerHTML = '<option value="">Select a product…</option>' + active.map(p => `<option value="${p.docUrl || ''}">${p.sku || ''} — ${p.name || ''}</option>`).join('');
    const updateBtn = () => { const u = sel.value; const ok = !!u && /^https?:\/\//i.test(u); btn.href = ok?u:'#'; if(ok) btn.removeAttribute('disabled'); else btn.setAttribute('disabled',''); };
    sel.addEventListener('change', updateBtn); updateBtn(); btn.addEventListener('click', e => { if (btn.getAttribute('disabled') !== null) e.preventDefault(); });
  }

  const q = $('#search');
  if (q){
    q.addEventListener('input', () => {
      const s = q.value.toLowerCase().trim();
      const list = !s ? products : products.filter(p => [p.sku, p.name, p.summary].filter(Boolean).some(v => String(v).toLowerCase().includes(s)));
      grid.innerHTML = list.map(card).join('');
      bindBuy();
      $$('.prod-img', grid).forEach(img => img.addEventListener('error', () => console.warn('Image 404:', img.src)));
    });
  }
}

async function renderProductDetail(){
  const el = $('#productDetail'); if (!el) return;
  const qs = new URLSearchParams(location.search); const sku = qs.get('sku') || qs.get('id');
  if (!sku){ el.innerHTML = '<div class="card pad">Missing product SKU.</div>'; return; }
  let p = null; try { p = await api('product', { sku }); } catch { p = null; }
  if (!p){ el.innerHTML = '<div class="card pad">Product not found.</div>'; return; }
  const img = prodImg(p);
  el.innerHTML = `
  <div class="card pad">
    <div class="grid" style="grid-template-columns:1.2fr 1fr;gap:16px">
      <div>
        <img class="prod-img" style="height:280px" src="${img}" alt="${p.name || ''}"
             onerror="this.onerror=null;this.src='/assets/product/wa-01.png'">
      </div>
      <div>
        <div class="pill">${p.sku || sku}</div>
        <h2 style="margin:10px 0 8px">${p.name || ''}</h2>
        <div class="price" style="font-size:22px">${moneyZAR(p.price || '')}</div>
        <p class="muted" style="line-height:1.7">${p.description || p.summary || ''}</p>
        <div class="btnrow">
          ${p.docUrl ? `<a class="btn outline" href="${p.docUrl}" target="_blank" rel="noopener">View Docs</a>` : ''}
          ${p.trialUrl ? `<a class="btn outline" href="${p.trialUrl}" target="_blank" rel="noopener">Download Trial</a>` : ''}
          <a class="btn whatsapp" href="${waLink(p.sku || sku, p.name || '')}" target="_blank" rel="noopener">WhatsApp</a>
          <button class="btn primary" data-buy="1" data-sku="${p.sku || sku}" data-name="${p.name || ''}">Buy Now</button>
        </div>
      </div>
    </div>
  </div>`;
  bindBuy();
}

// -- Close button high-contrast (no CSS edits)
function injectCloseBtnStyles(){
  const old = document.getElementById('closeBtnStyle'); if (old) old.remove();
  const style = document.createElement('style'); style.id='closeBtnStyle';
  style.textContent = `
    #modalCheckout #btnCloseModal,
    #modalCheckout .btn-close,
    #modalCheckout .close,
    #modalCheckout [data-close],
    #modalCheckout [aria-label="Close"]{
      position:absolute; top:14px; right:14px;
      color:#fff !important; -webkit-text-fill-color:#fff !important;
      background:#2F76FF !important; border:1px solid #2F76FF !important;
      border-radius:12px; padding:8px 12px; font-weight:800; line-height:1;
      opacity:1 !important; filter:none !important; mix-blend-mode:normal !important;
      box-shadow: 0 0 0 1px rgba(0,0,0,.15) inset, 0 1px 2px rgba(0,0,0,.25);
      z-index: 9999;
    }
    #modalCheckout #btnCloseModal:hover,
    #modalCheckout .btn-close:hover,
    #modalCheckout .close:hover,
    #modalCheckout [data-close]:hover,
    #modalCheckout [aria-label="Close"]:hover{ filter:brightness(1.05); }
  `;
  document.head.appendChild(style);
}

function bindModal(){
  const m = $('#modalCheckout'); if (!m) return; injectCloseBtnStyles();
  const c = $('#btnCloseModal') || $('#modalCheckout .btn-close') || $('#modalCheckout .close');
  if (c) c.onclick = closeCheckout;
  m.addEventListener('click', e => { if (e.target === m) closeCheckout(); });
  const pay = $('#btnPay'); if (pay) pay.onclick = proceedPayFast;
}

async function loadPriceList(){
  const b = $('#btnPriceList'); if (!b) return;
  try { const s = await api('settings'); if (s && s.priceList){ b.href = s.priceList; b.target='_blank'; b.rel='noopener'; } } catch {}
}

async function init(){
  bindModal();
  await loadPriceList();
  await renderProducts();
  await renderProductDetail();
}

document.addEventListener('DOMContentLoaded', init);
