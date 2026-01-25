// ====== utils ======
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));

let CONFIG = null;
async function loadConfig(){
  if (CONFIG) return CONFIG;
  // keep RELATIVE path to work on subpaths
  const r = await fetch('assets/js/config.json', { cache: 'no-store' }).catch(()=>null);
  CONFIG = r && r.ok ? await r.json() : {};
  return CONFIG;
}

function toast(msg, type='info'){
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.style.borderColor = (type === 'error') ? '#ef4444' : 'rgba(148,163,184,.25)';
  t.classList.add('on');
  clearTimeout(window.__t);
  window.__t = setTimeout(() => t.classList.remove('on'), 2600);
}

function moneyZAR(v){
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return String(v ?? '');
  return 'R ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function isHttp(u){ return /^https?:\/\//i.test(String(u || '')); }

// Build a robust image URL from common fields and normalize to absolute path
function prodImg(p){
  const u = (p && (p.image || p.imageUrl || p.ogImage)) || '';
  const PLACEHOLDER = '/assets/product/wa-01.png';
  if (!u) return PLACEHOLDER;
  if (isHttp(u)) return u; // Remote URL
  const clean = String(u)
    .trim()
    .replace(/^\/+/, '')
    .replace(/^assets\/(product|products|img)\//i, '');
  return `/assets/product/${clean}`; // absolute path
}

async function api(op, params = {}){
  const cfg = await loadConfig();
  const base = (cfg && cfg.APPS_SCRIPT_URL) || window.APPS_SCRIPT_URL || '';
  if (!base){
    console.error('APPS_SCRIPT_URL is missing in config.json');
    throw new Error('Missing APPS_SCRIPT_URL');
  }
  const url = new URL(base);
  url.searchParams.set('op', op);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error('API error');
  return await r.json();
}

async function loadSeed(){
  const r = await fetch('assets/js/products.seed.json', { cache: 'no-store' }).catch(()=>null);
  return r && r.ok ? await r.json() : [];
}

function waLink(sku, name){
  const phone = CONFIG?.WHATSAPP || '27716816131';
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

function bindBuy(){
  $$('button[data-buy="1"]').forEach(b => b.onclick = () => openCheckout(b.dataset.sku, b.dataset.name));
}

let CURRENT = null;
function openCheckout(sku, name){
  CURRENT = { sku, name };
  const s = $('#buySku'); if (s) s.textContent = sku;
  const n = $('#buyName'); if (n) n.textContent = name;
  const m = $('#modalCheckout'); if (m) m.classList.add('on');
  const em = $('#buyerEmail'); if (em) em.focus();
}
function closeCheckout(){ const m = $('#modalCheckout'); if (m) m.classList.remove('on'); }

async function proceedPayFast(){
  const emailEl = $('#buyerEmail');
  const email = emailEl ? emailEl.value.trim() : '';
  if (!email) return toast('Please enter your email address', 'error');
  try{
    const btn = $('#btnPay');
    if (btn){ btn.disabled = true; btn.textContent = 'Preparing…'; }
    const payload = await api('createPayment', { sku: CURRENT.sku, email, env: 'live' });
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payload.processUrl;
    for (const [k, v] of Object.entries(payload.fields || {})){
      const i = document.createElement('input');
      i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i);
    }
    document.body.appendChild(form);
    form.submit();
  }catch(e){
    console.error(e);
    toast('Checkout setup failed. Please order on WhatsApp.', 'error');
  }finally{
    const btn = $('#btnPay');
    if (btn){ btn.disabled = false; btn.textContent = 'Proceed to PayFast'; }
  }
}

async function renderProducts(){
  const grid = $('#grid');
  if (!grid) return;
  let products = [];
  try {
    products = await api('products');
  } catch {
    products = await loadSeed();
  }

  grid.innerHTML = products.map(card).join('');
  bindBuy();

  // Image error log (optional)
  $$('.prod-img', grid).forEach(img => img.addEventListener('error', () => console.warn('Image 404:', img.src)));

  // --- Documents dropdown wiring (robust) ---
  const sel = $('#docSelect');
  const btn = $('#btnDocDownload');
  if (sel && btn){
    const activeProducts = products.filter(p => String(p.active).toLowerCase() !== 'false');
    sel.innerHTML = '<option value="">Select a product…</option>' + activeProducts
      .map(p => `<option value="${p.docUrl || ''}">${p.sku || ''} — ${p.name || ''}</option>`)
      .join('');

    const updateBtn = () => {
      const u = sel.value;
      const valid = !!u && /^https?:\/\//i.test(u);
      btn.href = valid ? u : '#';
      btn.setAttribute('aria-disabled', String(!valid));
      if (valid) btn.removeAttribute('disabled'); else btn.setAttribute('disabled', '');
    };

    sel.addEventListener('change', updateBtn);
    updateBtn();
    btn.addEventListener('click', (e) => { if (btn.getAttribute('disabled') !== null){ e.preventDefault(); } });
  }

  // --- Search ---
  const q = $('#search');
  if (q){
    q.addEventListener('input', () => {
      const s = q.value.toLowerCase().trim();
      const list = !s ? products : products.filter(p => [p.sku, p.name, p.summary]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(s))
      );
      grid.innerHTML = list.map(card).join('');
      bindBuy();
      $$('.prod-img', grid).forEach(img => img.addEventListener('error', () => console.warn('Image 404:', img.src)));
    });
  }
}

async function renderProductDetail(){
  const el = $('#productDetail');
  if (!el) return;

  const qs = new URLSearchParams(location.search);
  const sku = qs.get('sku') || qs.get('id');
  if (!sku){ el.innerHTML = '<div class="card pad">Missing product SKU.</div>'; return; }

  let p = null;
  try { p = await api('product', { sku }); }
  catch { p = (await loadSeed()).find(x => x.sku === sku) || null; }

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

async function loadPriceList(){
  const b = $('#btnPriceList');
  if (!b) return;
  try{
    const s = await api('settings');
    if (s && s.priceList){ b.href = s.priceList; b.target = '_blank'; b.rel = 'noopener'; }
  }catch{}
}

// ---- Inject high-contrast styles for Close button (no CSS file changes) ----
function injectCloseBtnStyles(){
  if (document.getElementById('closeBtnStyle')) return; // once
  const css = `
    #modalCheckout #btnCloseModal{
      position:absolute; top:14px; right:14px;
      color:#E8EDF7; background:rgba(16,22,35,.92);
      border:1px solid rgba(148,163,184,.45);
      border-radius:12px; padding:8px 12px; font-weight:700; line-height:1;
    }
    #modalCheckout #btnCloseModal:hover{ background:rgba(20,27,42,.98); }
    #modalCheckout #btnCloseModal:focus-visible{ outline:3px solid #2F76FF; outline-offset:2px; }
  `;
  const style = document.createElement('style');
  style.id = 'closeBtnStyle';
  style.textContent = css;
  document.head.appendChild(style);
}

async function bindContact(){
  const f = $('#contactForm');
  if (!f) return;
  const cfg = await loadConfig();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = new FormData(f);
    try{
      const res = await fetch(cfg.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({
          action: 'contact',
          name: d.get('name'),
          email: d.get('email'),
          message: d.get('message')
        })
      });
      const txt = await res.text();
      $('#contactMsg').textContent = txt.includes('OK') ? 'Thanks — we’ll get back to you shortly.' : 'Sent.';
      f.reset();
    }catch(err){
      console.error(err);
      $('#contactMsg').textContent = 'Could not send right now. Please WhatsApp us.';
    }
  });
}

function bindModal(){
  const m = $('#modalCheckout');
  if (!m) return;
  injectCloseBtnStyles(); // ensure readable Close button
  const c = $('#btnCloseModal'); if (c) c.onclick = closeCheckout;
  m.addEventListener('click', e => { if (e.target === m) closeCheckout(); });
  const pay = $('#btnPay'); if (pay) pay.onclick = proceedPayFast;
}

async function init(){
  await loadConfig();
  $$('#adminLink').forEach(a => { if (CONFIG?.ADMIN_URL) a.href = CONFIG.ADMIN_URL; });
  bindModal();
  await loadPriceList();
  await renderProducts();
  await renderProductDetail();
  await bindContact();
}

document.addEventListener('DOMContentLoaded', init);
