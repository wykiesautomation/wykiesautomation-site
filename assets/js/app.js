
/* Wykies Automation – Products from Google Sheets via GViz (no CORS)
   Drop-in replacement for your current assets/js/app.js
   - Products + Docs come from Google Sheet (published to web)
   - Keeps your existing UI and modal
   - PayFast createPayment still attempts API (will fall back to WhatsApp on error)
*/

const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));

let CONFIG = null;

/* ===== Config =====
   config.json may contain:
   {
     "ADMIN_URL": "https://admin.wykiesautomation.co.za",
     "WHATSAPP": "27716816131",
     "SHEET_ID": "1NmQMONI55LubphHlTvcvWV29qzpU5NYfBCsU",
     "PRICE_LIST_URL": "https://drive.google.com/....pdf",
     "APPS_SCRIPT_URL": "https://script.google.com/macros/s/...."   // optional (only used for createPayment/contact if it works)
   }
*/
async function loadConfig() {
  if (CONFIG) return CONFIG;
  const r = await fetch('assets/js/config.json', { cache: 'no-store' });
  CONFIG = await r.json();

  // Fallbacks so it works even if fields are missing in config.json
  if (!CONFIG.SHEET_ID) CONFIG.SHEET_ID = '1NmQMONI55LubphHlTvcPaYJXfcvWV29qzpU5NYfBCsU';
  if (!CONFIG.WHATSAPP) CONFIG.WHATSAPP = '27716816131';
  return CONFIG;
}

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
  return isHttp(u) ? u : 'assets/product/' + u.replace(/^\/?assets\/(product|img)\//, '').replace(/^\//, '');
}

/* ===== GViz fetch & parse (NO CORS) =====
   Ensure the sheet's first tab (gid=0) is published: File → Share → Publish to web
*/
async function fetchGVizRows(sheetId, gid = '0') {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?gid=${gid}&tqx=out:json`;
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`GViz HTTP ${resp.status}`);
  const text = await resp.text();

  // Strip wrapper google.visualization.Query.setResponse(...)
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const json = JSON.parse(text.substring(start, end + 1));

  const cols = (json.table.cols || []).map(c => (c.label || '').trim().toLowerCase());
  const rows = (json.table.rows || []).map(r => {
    const o = {};
    (r.c || []).forEach((cell, i) => {
      const key = cols[i] || `col${i}`;
      o[key] = (cell && cell.v != null) ? cell.v : '';
    });
    return o;
  });
  return rows;
}

/* Normalize a row to your product model
   Accepts flexible headers: active | sku | name | price | summary | description | image|imageUrl|img|ogImage | docs_url|docUrl | trialUrl | detailsUrl | preOrder | price_log_pdf
*/
function normalizeProduct(r) {
  const bool = (v) => String(v).trim().toLowerCase() === 'true' || v === true || v === 1;
  const pick = (obj, keys) => keys.reduce((v, k) => v || obj[k], '');

  // Lowercase keys for flexible match
  const lr = {};
  for (const [k, v] of Object.entries(r)) lr[k.toLowerCase()] = v;

  return {
    active: bool(lr['active'] ?? true),
    sku: String(lr['sku'] || '').trim(),
    name: String(lr['name'] || '').trim(),
    price: lr['price'] ?? '',
    summary: lr['summary'] ?? '',
    description: lr['description'] ?? '',
    image: pick(lr, ['image', 'imageurl', 'img', 'ogimage']) || '',
    docUrl: pick(lr, ['docs_url', 'docurl']) || '',
    trialUrl: lr['trialurl'] || '',
    detailsUrl: lr['detailsurl'] || '',
    preOrder: bool(lr['preorder']),
    price_log_pdf: lr['price_log_pdf'] || ''
  };
}

/* Get all products from the sheet (gid=0 by default) */
async function getProductsFromSheet() {
  const cfg = await loadConfig();
  const raw = await fetchGVizRows(cfg.SHEET_ID, '0');
  const products = raw.map(normalizeProduct).filter(p => p.active && p.sku && p.name);
  return products;
}

/* ===== api() shim =====
   We keep your existing api(op, ...) calls but route them:
   - products/product/settings → handled locally (GViz / config)
   - createPayment/contact → will try Apps Script if provided; otherwise will throw (and your callers already catch + fallback)
*/
async function api(op, params = {}) {
  const cfg = await loadConfig();

  if (op === 'products') {
    return await getProductsFromSheet();
  }

  if (op === 'product') {
    const all = await getProductsFromSheet();
    return all.find(x => x.sku === params.sku) || null;
  }

  if (op === 'settings') {
    // Provide priceList from config, or fall back to first product’s price_log_pdf if available
    const s = {};
    if (cfg.PRICE_LIST_URL || cfg.priceList) s.priceList = cfg.PRICE_LIST_URL || cfg.priceList;
    else {
      try {
        const all = await getProductsFromSheet();
        const withPL = all.find(p => p.price_log_pdf);
        if (withPL) s.priceList = withPL.price_log_pdf;
      } catch { /* ignore */ }
    }
    return s;
  }

  // For createPayment/contact we attempt Apps Script only if present.
  if ((op === 'createPayment' || op === 'contact') && cfg.APPS_SCRIPT_URL) {
    // This may still be blocked by CORS on some hosts; callers already catch.
    const url = new URL(cfg.APPS_SCRIPT_URL);
    url.searchParams.set('op', op);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const r = await fetch(url.toString(), { cache: 'no-store' });
    if (!r.ok) throw new Error(`API ${op} HTTP ${r.status}`);
    return await r.json();
  }

  throw new Error(`Unsupported op: ${op}`);
}

/* ===== Helpers and UI builders (unchanged UI) ===== */
function waLink(sku, name) {
  const phone = CONFIG?.WHATSAPP || '27716816131';
  const msg = encodeURIComponent(`Hi Wykies Automation, I would like to order: ${sku} — ${name}`);
  return `https://wa.me/${phone}?text=${msg}`;
}

function card(p) {
  const sku = p.sku || '';
  const name = p.name || '';
  const sum = p.summary || '';
  const img = prodImg(p);
  const docUrl = p.docUrl || '';
  const trialUrl = p.trialUrl || '';
  const detailsUrl = p.detailsUrl || `product.html?sku=${encodeURIComponent(sku)}`;
  const pre = p.preOrder === true;
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
      ${docUrl ? `<a class="btn outline"` : ''}
      ${trialUrl ? `<a class="btn outline" href="${trialUrl}" target="_blank" rel="pp" href="${waLink(sku, name)}" target="_blank data-buy="1" data-sku="${sku}" data-name="${name}">Buy Now</button>
    </div>
    <div class="small" style="margin-top:10px">Prices are VAT‑inclusive. Secure checkout via PayFast.</div>
  </div>`;
}

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

async function proceedPayFast() {
  const email = $('#buyerEmail').value.trim();
  if (!email) return toast('Please enter your email address', 'error');
  try {
    $('#btnPay').disabled = true;
    $('#btnPay').textContent = 'Preparing…';
    // Try Apps Script payment if configured; otherwise this will throw and we fallback.
    const payload = await api('createPayment', { sku: CURRENT.sku, email, env: 'live' });
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = payload.processUrl;
    for (const [k, v] of Object.entries(payload.fields || {})) {
      const i = document.createElement('input');
      i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i);
    }
    document.body.appendChild(form);
    form.submit();
  } catch (e) {
    console.error(e);
    toast('Checkout setup failed. Please order on WhatsApp.', 'error');
    // Optional: open WhatsApp automatically
    const msg = encodeURIComponent(`Hi, I'd like to buy ${CURRENT.sku} — ${CURRENT.name}. My email: ${email}`);
    window.open(`https://wa.me/${CONFIG.WHATSAPP}?text=${msg}`, '_blank', 'noopener');
  } finally {
    $('#btnPay').disabled = false;
    $('#btnPay').textContent = 'Proceed to PayFast';
  }
}

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

  // Docs dropdown
  const sel = $('#docSelect');
  if (sel) {
    sel.innerHTML = '<option value="">Select a product…</option>' +
      products.map(p => `<option value="${p.docUrl || ''}">${p.sku || ''} — ${p.name || ''}</option>`).join('');
    sel.onchange = () => {
      const u = sel.value;
      const b = $('#btnDocDownload');
      if (b) b.href = u || '#';
    };
  }

  // Search
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

async function renderProductDetail() {
  const el = $('#productDetail'); if (!el) return;
  const qs = new URLSearchParams(location.search);
  const sku = qs.get('sku') || qs.get('id');
  if (!sku) { el.innerHTML = '<div class="card pad">Missing product SKU.</div>'; return; }

  let p = null;
  try { p = await api('product', { sku }); }
  catch {
    try { p = (await loadSeed()).find(x => x.sku === sku) || null; } catch {}
  }
  if (!p) { el.innerHTML = '<div class="card pad">Product not found.</div>'; return; }

  const img = prodImg(p);
  el.innerHTML = `
    <div class="card pad">
      <div class="grid" style="grid-template-columns:1.2fr 1fr;gap:16px">
        <div><img class="prod-img" style="height:280px" src="${img}" alt="${p.name || ''}
          <h2 style="margin:10px 0 8px">${p.name || ''}</h2>
          <div class="price" style="font-size:22px">${moneyZAR(p.price || '')}</div>
          <p class="muted" style="line-height:1.7">${p.description || p.summary || ''}</p>
          <div class="btnrow">
            ${p.docUrl ? `<a class="btn outline" href="${p.docUrl}" target="_blank" rel="noopenertn outline" href="${p.trial
            <a class="btn whatsapp" href="${wahatsApp</a>
            <button class="btn primary" data-buy="1" data-sku="${p.sku || sku}" data-name="${p.name || ''}">Buy Now</button>
          </div>
        </div>
      </div>
    </div>`;
  bindBuy();
}

async function loadPriceList() {
  const b = $('#btnPriceList'); if (!b) return;
  try {
    const s = await api('settings');
    if (s && s.priceList) {
      b.href = s.priceList; b.target = '_blank'; b.rel = 'noopener';
      return;
    }
  } catch { /* ignore */ }

  // Fallback: first product with price_log_pdf
  try {
    const products = await api('products');
    const p = products.find(x => x.price_log_pdf);
    if (p) { b.href = p.price_log_pdf; b.target = '_blank'; b.rel = 'noopener'; }
  } catch { /* ignore */ }
}

/* Seed loader (as last-resort fallback) */
async function loadSeed() {
  const r = await fetch('assets/js/products.seed.json', { cache: 'no-store' });
  return await r.json();
}

/* Contact form
   Try Apps Script (if configured). If blocked (CORS) or missing, fall back to mailto.
*/
async function bindContact() {
  const f = $('#contactForm'); if (!f) return;
  const cfg = await loadConfig();

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const d = new FormData(f);
    const name = (d.get('name') || '').toString();
    const email = (d.get('email') || '').toString();
    const message = (d.get('message') || '').toString();

    const msgEl = $('#contactMsg');

    if (cfg.APPS_SCRIPT_URL) {
      try {
        const res = await fetch(cfg.APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: new URLSearchParams({ action: 'contact', name, email, message })
        });
        const txt = await res.text();
        msgEl.textContent = txt.includes('OK') ? 'Thanks — we’ll get back to you shortly.' : 'Sent.';
        f.reset();
        return;
      } catch (err) {
        console.error('Contact via Apps Script failed:', err);
      }
    }
    // Fallback: open email client
    const mailto = `mailto:wykiesautomation@gmail.com?subject=${encodeURIComponent('Website Contact: ' + name)}&body=${encodeURIComponent(message + '\n\nFrom: ' + name + ' <' + email + '>' )}`;
    window.location.href = mailto;
    msgEl.textContent = 'Opening your email client… or WhatsApp us if preferred.';
  });
}

/* Modal + init */
function bindModal() {
  const m = $('#modalCheckout'); if (!m) return;
  $('#btnCloseModal').onclick = closeCheckout;
  m.addEventListener('click', e => { if (e.target === m) closeCheckout(); });
  $('#btnPay').onclick = proceedPayFast;
}

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
