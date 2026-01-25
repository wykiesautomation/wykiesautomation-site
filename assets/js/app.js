
/* ========= WykiesAutomation app.js (fixed) ========= */

const $  = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));

let CONFIG = null;

/* ----- Config loader (robust) ----- */
async function loadConfig() {
  if (CONFIG) return CONFIG;
  try {
    const r = await fetch('assets/js/config.json', { cache: 'no-store' });
    CONFIG = r.ok ? await r.json() : {};
  } catch {
    CONFIG = {};
  }
  // Fallbacks if file can’t be read for any reason
  const meta = document.querySelector('meta[name="apps-script-url"]')?.content;
  if (!CONFIG.APPS_SCRIPT_URL) CONFIG.APPS_SCRIPT_URL = meta || window.APPS_SCRIPT_URL || '';
  return CONFIG;
}

/* ----- UI helpers ----- */
function toast(msg, type = 'info') {
  const t = $('#toast');
  if (!t) return;
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

/* ----- Product image resolver (robust) ----- */
function prodImg(p) {
  const u = p.image || p.imageUrl || p.ogImage || '';
  if (!u) return '/assets/product/wa-01.png';
  if (isHttp(u)) return u;
  const clean = String(u).replace(/^\/?assets\/(product|img)\//, '').replace(/^\//, '');
  return '/assets/product/' + clean;
}

/* ----- JSONP helper (CORS-proof) ----- */
function jsonp(url, params = {}, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const cbName = `__jsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const q = new URLSearchParams({ ...params, callback: cbName }).toString();
    const s = document.createElement('script');
    let done = false, timer = null;

    window[cbName] = (data) => { if (done) return; done = true; cleanup(); resolve(data); };
    function cleanup() {
      if (timer) clearTimeout(timer);
      try { delete window[cbName]; } catch { window[cbName] = undefined; }
      s.remove();
    }
    s.onerror = () => { if (done) return; done = true; cleanup(); reject(new Error('JSONP network error')); };
    timer = setTimeout(() => { if (done) return; done = true; cleanup(); reject(new Error('JSONP timeout')); }, timeoutMs);

    s.src = url + (url.includes('?') ? '&' : '?') + q;
    s.async = true;
    document.head.appendChild(s);
  });
}

/* ----- API with fetch -> JSONP fallback ----- */
async function api(op, params = {}) {
  const cfg = await loadConfig();
  const base = cfg.APPS_SCRIPT_URL || '';
  if (!base) throw new Error('Missing APPS_SCRIPT_URL');

  // Try simple GET (no preflight); if blocked or non-JSON, fall back to JSONP
  try {
    const url = new URL(base);
    url.searchParams.set('op', op);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const r = await fetch(url.toString(), { cache: 'no-store', redirect: 'follow' });
    const ct = r.headers.get('content-type') || '';
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if (/json/i.test(ct)) return await r.json();
    const txt = await r.text();
    return JSON.parse(txt);
  } catch {
    return await jsonp(base, { op, ...params });
  }
}

/* ----- WhatsApp link ----- */
function waLink(sku, name) {
  const phone = CONFIG?.WHATSAPP || '27716816131';
  const msg = encodeURIComponent(`Hi Wykies Automation, I would like to order: ${sku} — ${name}`);
  return `https://wa.me/${phone}?text=${msg}`;
}

/* ----- Product card HTML ----- */
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
  const pre  = String(p.preOrder).toLowerCase() === 'true' || p.preOrder === true;

  return `
  <div class="card pad" style="display:flex;flex-direction:column;min-height:100%">
    ${img}

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
      ${detailsUrl}Details</a>
      ${docUrl   ? `<a class="btn outline"` : ''}
      ${trialUrl ? `<a class="btn outline" href="${trialUrl}" target="_blank" rel="noopener/a>
      <button class="btn primary" data-buy="1" data-sku="${sku}" data-name="${name}">Buy Now</button>
    </div>

    <div class="small" style="margin-top:10px">Prices are VAT‑inclusive. Secure checkout via PayFast.</div>
  </div>`;
}

/* ----- Bind Buy buttons ----- */
function bindBuy() {
  $$('button[data-buy="1"]').forEach(b => b.onclick = () => openCheckout(b.dataset.sku, b.dataset.name));
}

/* ----- Checkout modal ----- */
let CURRENT = null;

function openCheckout(sku, name) {
  CURRENT = { sku, name };
  $('#buySku').textContent  = sku;
  $('#buyName').textContent = name;
  $('#modalCheckout').classList.add('on');
  $('#buyerEmail').focus();
}

function closeCheckout() { $('#modalCheckout').classList.remove('on'); }

/* ----- Guarded PayFast submit (prevents /undefined 405) ----- */
async function proceedPayFast() {
  const email = $('#buyerEmail').value.trim();
  if (!email) return toast('Please enter your email address', 'error');

  const btn = $('#btnPay');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }

    const payload = await api('createPayment', { sku: CURRENT.sku, email, env: 'live' });

    if (!payload || typeof payload !== 'object') throw new Error('Invalid payload (empty)');

    const processUrl = payload.processUrl || payload.process_url || payload.url || '';
    const fields     = payload.fields    || payload.data       || payload.params || {};
    const method     = (payload.method   || 'POST').toUpperCase();

    if (!processUrl) throw new Error('Invalid payload: processUrl missing');
    if (!fields || typeof fields !== 'object' || !Object.keys(fields).length)
      throw new Error('Invalid payload: fields missing');

    if (method === 'GET') {
      const q = new URLSearchParams(fields).toString();
      window.location.href = processUrl + (processUrl.includes('?') ? '&' : '?') + q;
      return;
    }

    // POST form to PayFast
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = processUrl;
    for (const [k, v] of Object.entries(fields)) {
      const i = document.createElement('input');
      i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i);
    }
    document.body.appendChild(form);
    form.submit();

  } catch (e) {
    console.error('[PayFast] submit error:', e);
    toast('Checkout setup failed. Please order on WhatsApp.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Proceed to PayFast'; }
  }
}

/* ----- Render products grid ----- */
async function renderProducts() {
  const grid = $('#grid');
  if (!grid) return;

  let products = [];
  try { products = await api('products'); }
  catch { products = await loadSeed(); }

  grid.innerHTML = products.map(card).join('');
  bindBuy();

  // Docs dropdown with safe enable/disable
  const sel = $('#docSelect');
  const btn = $('#btnDocDownload');
  if (sel && btn) {
    const active = products.filter(p => String(p.active).toLowerCase() !== 'false');
    sel.innerHTML = '<option value="">Select a product…</option>' + active
      .map(p => `<option value="${p.docUrl || ''}">${p.sku || ''} — ${p.name || ''}</option>`)
      .join('');

    const updateBtn = () => {
      const u = sel.value;
      const ok = !!u && /^https?:\/\//i.test(u);
      btn.href = ok ? u : '#';
      if (ok) btn.removeAttribute('disabled'); else btn.setAttribute('disabled', '');
    };
    sel.addEventListener('change', updateBtn);
    updateBtn();

    btn.addEventListener('click', e => {
      if (btn.getAttribute('disabled') !== null) e.preventDefault();
    });
  }

  // Search
  const q = $('#search');
  if (q) {
    q.addEventListener('input', () => {
      const s = q.value.toLowerCase().trim();
      const list = !s ? products : products.filter(p =>
        [p.sku, p.name, p.summary].filter(Boolean).some(v => String(v).toLowerCase().includes(s))
      );
      grid.innerHTML = list.map(card).join('');
      bindBuy();
    });
  }
}

/* ----- Product detail page ----- */
async function renderProductDetail() {
  const el = $('#productDetail');
  if (!el) return;

  const qs  = new URLSearchParams(location.search);
  const sku = qs.get('sku') || qs.get('id');
  if (!sku) { el.innerHTML = '<div class="card pad">Missing product SKU.</div>'; return; }

  let p = null;
  try { p = await api('product', { sku }); }
  catch { p = (await loadSeed()).find(x => x.sku === sku) || null; }

  if (!p) { el.innerHTML = '<div class="card pad">Product not found.</div>'; return; }

  const img = prodImg(p);
  el.innerHTML = `
  <div class="card pad">
    <div class="grid" style="grid-template-columns:1.2fr 1fr;gap:16px">
      <div>
        ${img}
      </div>
      <div>
        <div class="pill">${p.sku || sku}</div>
        <h2 style="margin:10px 0 8px">${p.name || ''}</h2>
        <div class="price" style="font-size:22px">${moneyZAR(p.price || '')}</div>
        <p class="muted" style="line-height:1.7">${p.description || p.summary || ''}</p>
        <div class="btnrow">
          ${p.docUrl   ? `${p.docUrl}View Docs</a>` : ''}
          ${p.trialUrl ? `${p.trialUrl}Download Trial</a>` : ''}
          ${waLink(p.sku || sku, p.name || WhatsApp</a>
          <button class="btn primary" data-buy="1" data-sku="${p.sku || sku}" data-name="${p.name || ''}">Buy Now</button>
        </div>
      </div>
    </div>
  </div>`;
  bindBuy();
}

/* ----- Price list link (uses API) ----- */
async function loadPriceList() {
  const b = $('#btnPriceList');
  if (!b) return;
  try {
    const s = await api('settings');
    if (s && s.priceList) { b.href = s.priceList; b.target = '_blank'; b.rel = 'noopener'; }
  } catch {}
}

/* ----- Contact form (kept as POST; shows fallback toast on failure) ----- */
async function bindContact() {
  const f = $('#contactForm');
  if (!f) return;
  const cfg = await loadConfig();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = new FormData(f);
    try {
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
    } catch (err) {
      console.error(err);
      $('#contactMsg').textContent = 'Could not send right now. Please WhatsApp us.';
    }
  });
}

/* ----- Modal bind ----- */
function bindModal() {
  const m = $('#modalCheckout');
  if (!m) return;
  $('#btnCloseModal').onclick = closeCheckout;
  m.addEventListener('click', e => { if (e.target === m) closeCheckout(); });
  $('#btnPay').onclick = proceedPayFast;
}

/* ----- Init ----- */
async function init() {
  await loadConfig();
  $$('#adminLink').forEach(a => a.href = CONFIG.ADMIN_URL);
  bindModal();
  await loadPriceList();
  await renderProducts();
  await renderProductDetail();
  await bindContact();
}

document.addEventListener('DOMContentLoaded', init);
/* ========= End of file ========= */
