
console.log("WA app build:", "2026-01-24-jsonp-NEWFILE");

/* ========================= Temporary fetch guard (DEV) =========================
   If anything tries to fetch() Apps Script, it will error loudly so we can catch it.
------------------------------------------------------------------------------- */
(function () {
  const _fetch = window.fetch;
  window.fetch = function (input, init) {
    const url = (typeof input === 'string') ? input : (input && input.url) || '';
    if (/script\.google(?:usercontent)?\.com\/macros\//i.test(url)) {
      console.error('[WA] Blocked fetch to Apps Script. Must use JSONP api():', url);
      return Promise.reject(new Error('Blocked fetch to Apps Script; must use JSONP api()'));
    }
    return _fetch.apply(this, arguments);
  };
})();

/* ============================== Tiny DOM helpers ============================== */
const $  = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));

/* ============================== Config loader ================================ */
let CONFIG = null;
async function loadConfig() {
  if (CONFIG) return CONFIG;
  const r = await fetch('assets/js/config.json', { cache: 'no-store' });
  CONFIG = await r.json();
  return CONFIG;
}

/* ================================ UI helpers ================================= */
function toast(msg, type = 'info') {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg;
  t.style.borderColor = (type === 'error') ? '#ef4444' : 'rgba(148,163,184,.25)';
  t.classList.add('on');
  clearTimeout(window.__t);
  window.__t = setTimeout(() => t.classList.remove('on'), 2600);
}

function moneyZAR(v) {
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? String(v ?? '') : 'R ' + n.toFixed(2);
}

function isHttp(u) { return /^https?:\/\//i.test(String(u || '')); }

function prodImg(p) {
  const u = p.imageUrl || p.image || p.img || p.ogImage || '';
  if (!u) return 'assets/product/wa-01.PNG';
  return isHttp(u)
    ? u
    : 'assets/product/' + u.replace(/^\/?assets\/(product|img)\//, '').replace(/^\//, '');
}

/* ============================= JSONP core (no CORS) =========================== */
function jsonp(baseUrl, params = {}, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const cb = `__cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    params.callback = cb;

    const qs  = new URLSearchParams(params).toString();
    const src = baseUrl + (baseUrl.includes('?') ? '&' : '?') + qs;

    const s = document.createElement('script');
    let done = false;

    function cleanup(err, payload) {
      if (done) return;
      done = true;
      try { delete window[cb]; } catch {}
      if (s.parentNode) s.parentNode.removeChild(s);
      if (err) reject(err); else resolve(payload);
    }

    window[cb] = (payload) => cleanup(null, payload);
    s.onerror = () => cleanup(new Error('JSONP load error'));
    s.src = src;
    document.head.appendChild(s);

    setTimeout(() => cleanup(new Error('JSONP timeout')), timeoutMs);
  });
}

/* ===== API facade (Apps Script via JSONP) =====
   Backend must return: callback({ ok:true, data: ... })
------------------------------------------------------------------------------- */
async function api(op, params = {}) {
  const cfg = await loadConfig();
  if (!cfg.APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL missing in config.json');

  const res = await jsonp(cfg.APPS_SCRIPT_URL, { op, ...params });
  if (!res || res.ok === false) throw new Error(res?.error || 'API error');
  return res.data;
}

/* ============================= Local seed fallback ============================ */
async function loadSeed() {
  const r = await fetch('assets/js/products.seed.json', { cache: 'no-store' });
  return await r.json();
}

/* ============================ Link builders ================================== */
function waLink(sku, name) {
  const phone = CONFIG?.WHATSAPP || '27716816131';
  const msg = encodeURIComponent(`Hi Wykies Automation, I would like to order: ${sku} — ${name}`);
  return `https://wa.me/${phone}?text=${msg}`;
}

/* =============================== Card template =============================== */
function card(p) {
  const active = String(p.active).toLowerCase() !== 'false' && p.active !== false;
  if (!active) return '';

  const sku   = p.sku || '';
  const name  = p.name || '';
  const sum   = p.summary || '';
  const img   = prodImg(p);
  const docUrl    = p.docUrl || '';
  const trialUrl  = p.trialUrl || '';
  const detailsUrl= p.detailsUrl || `product.html?sku=${encodeURIComponent(sku)}`;
  const pre       = String(p.preOrder).toLowerCase() === 'true' || p.preOrder === true;

  return `
  <div class="card pad" style="display:flex;flex-direction:column;min-height:100%">
    ${img}
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px">
      <div class="pill">${sku}</div>
      <div class="price">${moneyZAR(p.price || '')}</div>
    </div>
    <div style="margin-top:10px"><strong>${name}</strong>${pre ? '<span class="pill" style="margin-left:8px;border-color:rgba(245,158,11,.35);color:#fcd34d">Pre‑Order</span>' : ''}</div>
    <p class="muted" style="line-height:1.5;margin:8px 0 0">${sum}</p>
    <div class="btnrow" style="margin-top:auto">
      ${detailsUrl}Details</a>
      ${docUrl   ? `${docUrl}View Docs</a>` : ''}
      ${trialUrl ? `<a class="btn outline"ial</a>` : ''}
      <a class="btn whatsapp" href="${waLink(sku, namelass="btn primary" data-buy="1" data-sku="${sku}" data-name="${name}">Buy Now</button>
    </div>
    <div class="small" style="margin-top:10px">Prices are VAT‑inclusive. Secure checkout via PayFast.</div>
  </div>`;
}

/* =============================== Buy modal =================================== */
function bindBuy() {
  $$('button[data-buy="1"]').forEach(b => b.onclick = () => openCheckout(b.dataset.sku, b.dataset.name));
}

let CURRENT = null;
function openCheckout(sku, name) {
  CURRENT = { sku, name };
  $('#buySku').textContent = sku;
  $('#buyName').textContent = name;
  $('#modalCheckout').classList.add('on');
  $('#buyerEmail').focus();
}
function closeCheckout() { $('#modalCheckout').classList.remove('on'); }

/* ============================= PayFast handoff ================================ */
async function proceedPayFast() {
  const email = $('#buyerEmail').value.trim();
  if (!email) return toast('Please enter your email address', 'error');

  try {
    $('#btnPay').disabled = true;
    $('#btnPay').textContent = 'Preparing…';

    const payload = await api('createPayment', { sku: CURRENT.sku, email, env: 'live' });

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payload.processUrl;
    for (const [k, v] of Object.entries(payload.fields || {})) {
      const i = document.createElement('input');
      i.type = 'hidden'; i.name = k; i.value = v;
      form.appendChild(i);
    }
    document.body.appendChild(form);
    form.submit();

  } catch (e) {
    console.error(e);
    toast('Checkout setup failed. Please order on WhatsApp.', 'error');
    const msg = encodeURIComponent(`Hi, I'd like to buy ${CURRENT.sku} — ${CURRENT.name}. My email: ${email}`);
    window.open(`https://wa.me/${CONFIG?.WHATSAPP || '27716816131'}?text=${msg}`, '_blank', 'noopener');
  } finally {
    $('#btnPay').disabled = false;
    $('#btnPay').textContent = 'Proceed to PayFast';
  }
}

/* ====================== Products grid + search + docs ========================= */
async function renderProducts() {
  const grid = $('#grid'); if (!grid) return;

  grid.innerHTML = `<div class="muted">Loading products…</div>`;
  let products = [];
  try {
    products = await api('products');
  } catch {
    try { products = await loadSeed(); } catch {}
  }

  grid.innerHTML = products.map(card).join('');
  bindBuy();

  const sel = $('#docSelect');
  if (sel) {
    sel.innerHTML = '<option value="">Select a product…</option>' +
      products.filter(p => String(p.active).toLowerCase() !== 'false')
              .map(p => `<option value="${p.docUrl || ''}">${p.sku || ''} — ${p.name || ''}</option>`)
              .join('');
    sel.onchange = () => {
      const u = sel.value;
      const b = $('#btnDocDownload');
      if (b) b.href = u || '#';
    };
  }

  const q = $('#search');
  if (q) {
    q.addEventListener('input', () => {
      const s = q.value.toLowerCase().trim();
      const list = !s ? products :
        products.filter(p => [p.sku, p.name, p.summary].filter(Boolean)
          .some(v => String(v).toLowerCase().includes(s)));
      grid.innerHTML = list.map(card).join('');
      bindBuy();
    });
  }
}

/* =========================== Product detail page ============================== */
async function renderProductDetail() {
  const el = $('#productDetail'); if (!el) return;

  const qs  = new URLSearchParams(location.search);
  const sku = qs.get('sku') || qs.get('id');
  if (!sku) { el.innerHTML = '<div class="card pad">Missing product SKU.</div>'; return; }

  let p = null;
  try {
    p = await api('product', { sku });
  } catch {
    try { p = (await loadSeed()).find(x => x.sku === sku) || null; } catch {}
  }

  if (!p) { el.innerHTML = '<div class="card pad">Product not found.</div>'; return; }

  const img = prodImg(p);
  el.innerHTML = `
  <div class="card pad">
    <div class="grid" style="grid-template-columns:1.2fr 1fr;gap:16px">
      <div>${img}</div>
      <div>
        <div class="pill">${p.sku || sku}</div>
        <h2 style="margin:10px 0 8px">${p.name || ''}</h2>
        <div class="price" style="font-size:22px">${moneyZAR(p.price || '')}</div>
        <p class="muted" style="line-height:1.7">${p.description || p.summary || ''}</p>
        <div class="btnrow">
          ${p.docUrl ? `${p.docUrl}View Docs</a>` : ''}
          ${p.trialUrl ? `${p.trialUrl}Download Trial</a>` : ''}
          <a class="btn whatsapp" href="${waLink(p.sku || sku     <button class="btn primary" data-buy="1" data-sku="${p.sku || sku}" data-name="${p.name || ''}">Buy Now</button>
        </div>
      </div>
    </div>
  </div>`;
  bindBuy();
}

/* ===================== Price list button (settings/product) =================== */
async function loadPriceList() {
  const b = $('#btnPriceList'); if (!b) return;
  try {
    const s = await api('settings');
    if (s && s.priceList) { b.href = s.priceList; b.target = '_blank'; b.rel = 'noopener'; return; }
  } catch {}

  try {
    const products = await api('products');
    const p = products.find(x => x.price_log_pdf);
    if (p) { b.href = p.price_log_pdf; b.target = '_blank'; b.rel = 'noopener'; }
  } catch {}
}

/* =========================== Contact form (JSONP) ============================= */
async function bindContact() {
  const f = $('#contactForm'); if (!f) return;

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = new FormData(f);

    try {
      const res = await api('contact', {
        name   : d.get('name'),
        email  : d.get('email'),
        message: d.get('message')
      });
      $('#contactMsg').textContent = (res && res.status === 'OK')
        ? 'Thanks — we’ll get back to you shortly.'
        : 'Sent.';
      f.reset();
      return;
    } catch (err) {
      console.error('Contact JSONP failed:', err);
      $('#contactMsg').textContent = 'Could not send right now. Please WhatsApp us or email.';
    }
  });
}

/* ================================ Modal wiring ================================ */
function bindModal() {
  const m = $('#modalCheckout'); if (!m) return;
  $('#btnCloseModal').onclick = closeCheckout;
  m.addEventListener('click', e => { if (e.target === m) closeCheckout(); });
  $('#btnPay').onclick = proceedPayFast;
}

/* ================================== Init ===================================== */
async function init() {
  await loadConfig();

  const adminHref = CONFIG.ADMIN_URL || 'https://admin.wykiesautomation.co.za';
  $$('#adminLink').forEach(a => { a.href = adminHref; });

  bindModal();
  await loadPriceList();
  await renderProducts();
  await renderProductDetail();
  await bindContact();
}

document.addEventListener('DOMContentLoaded', init);
