
/* Wykies Automation – Public site app.js (stable build)
 * - Fix 405 /undefined by blocking native submits and posting only the PayFast form we build in JS
 * - Use Apps Script ?action=publicData for products, product, settings
 * - Fallback to local PayFast form if server-side createPayment is not present
 * - Cache products for price lookup during checkout
 */

'use strict';

// ---------- DOM helpers ----------
const $  = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));

// ---------- Global state ----------
let CONFIG   = null;   // loaded from assets/js/config.json
let PRODUCTS = [];     // cached products
let CURRENT  = null;   // { sku, name, price }

// ---------- Core utils ----------
async function loadConfig() {
  if (CONFIG) return CONFIG;
  const r = await fetch('assets/js/config.json', { cache: 'no-store' });
  CONFIG = await r.json();
  return CONFIG;
}

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

function prodImg(p) {
  const u = p.imageUrl || p.ogImage || '';
  if (!u) return 'assets/product/wa-01.PNG';
  if (isHttp(u)) return u;
  return 'assets/product/' + u.replace(/^\/?assets\/(product|img)\//, '').replace(/^\//, '');
}

// ---------- Backend API wrapper ----------
/**
 * API operations:
 *  - 'products' → array
 *  - 'product'  → object (params: { sku })
 *  - 'settings' → object
 * Uses Apps Script ?action=publicData and splits client-side.
 */
async function api(op, params = {}) {
  const cfg  = await loadConfig();
  const base = cfg.APPS_SCRIPT_URL;

  if (op === 'products' || op === 'product' || op === 'settings') {
    const url = new URL(base);
    url.searchParams.set('action', 'publicData');
    const r = await fetch(url.toString(), { cache: 'no-store' });
    if (!r.ok) throw new Error('API publicData');
    const data = await r.json();

    if (op === 'products') return data.products || [];
    if (op === 'settings') return data.settings || {};

    if (op === 'product') {
      const sku = params.sku || params.id;
      return (data.products || []).find(p => String(p.sku) === String(sku)) || null;
    }
  }

  if (op === 'createPayment') {
    // Not implemented on server (yet) — caller will fall back to local build
    throw new Error('createPayment not implemented on server');
  }

  throw new Error('Unknown op: ' + op);
}

// Seed fallback (static JSON) if Apps Script is unreachable
async function loadSeed() {
  const r = await fetch('assets/js/products.seed.json', { cache: 'no-store' });
  return await r.json();
}

function waLink(sku, name) {
  const phone = CONFIG?.WHATSAPP || '27716816131';
  const msg = encodeURIComponent(`Hi Wykies Automation, I would like to order: ${sku} — ${name}`);
  return `https://wa.me/${phone}?text=${msg}`;
}

// ---------- Card renderer (no nested templates) ----------
function card(p) {
  const active = String(p.active).toLowerCase() !== 'false' && p.active !== false;
  if (!active) return '';

  const sku   = p.sku || '';
  const name  = p.name || '';
  const sum   = p.summary || '';
  const img   = prodImg(p);
  const priceStr = moneyZAR(p.price || '');

  const pre    = String(p.preOrder).toLowerCase() === 'true' || p.preOrder === true;
  const prePill = pre ? '<span class="pill" style="margin-left:8px;border-color:rgba(245,158,11,.35);color:#fcd34d">Pre‑Order</span>' : '';

  const detailsUrl = p.detailsUrl || `product.html?sku=${encodeURIComponent(sku)}`;
  const docLink   = p.docUrl   ? `${p.docUrl}View Docs</a>`       : '';
  const trialLink = p.trialUrl ? `<a class="btn outline"Trial</a>` : '';

  return (
    '<div class="card pad" style="display:flex;flex-direction:column;min-height:100%">' +
      `${img}` +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px">' +
        `<div class="pill">${sku}</div>` +
        `<div class="price">${priceStr}</div>` +
      '</div>' +
      '<div style="margin-top:10px">' +
        `<strong>${name}</strong>${prePill}` +
      '</div>' +
      `<p class="muted" style="line-height:1.5;margin:8px 0 0">${sum}</p>` +
      '<div class="btnrow" style="margin-top:auto">' +
        `${detailsUrl}Details</a>` +
        docLink +
        trialLink +
        `${waLink(sku, name)}WhatsApp</a>` +
        `<button class="btn primary" data-buy="1" data-sku="${sku}" data-name="${name}" data-price="${p.price || ''}">Buy Now</button>` +
      '</div>' +
      '<div class="small" style="margin-top:10px">Prices are VAT‑inclusive. Secure checkout via PayFast.</div>' +
    '</div>'
  );
}

function bindBuy() {
  $$('button[data-buy="1"]').forEach(b =>
    b.onclick = () => openCheckout(b.dataset.sku, b.dataset.name, b.dataset.price)
  );
}

// ---------- Checkout modal ----------
function openCheckout(sku, name, priceMaybe) {
  let price = priceMaybe;
  if (!price && PRODUCTS.length) {
    const p = PRODUCTS.find(x => String(x.sku) === String(sku));
    if (p) price = p.price;
  }
  const amount = Number(String(price ?? '').replace(/[^0-9.]/g, '')) || 0;

  CURRENT = { sku, name, price: amount };
  $('#buySku').textContent  = sku;
  $('#buyName').textContent = name;
  $('#modalCheckout').classList.add('on');
  $('#buyerEmail').focus();
}

function closeCheckout() { $('#modalCheckout').classList.remove('on'); }

async function proceedPayFast() {
  const email = $('#buyerEmail').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Please enter a valid email address', 'error');
  if (!CURRENT || !CURRENT.sku)            return toast('No product selected', 'error');
  if (!CURRENT.price || CURRENT.price <= 0) return toast('Price unavailable. Please WhatsApp us to order.', 'error');

  const btn = $('#btnPay');
  try {
    btn.disabled = true; btn.textContent = 'Preparing…';

    // Try server (future: createPayment). Fallback to local build if missing.
    let payload = null;
    try { payload = await api('createPayment', { sku: CURRENT.sku, email, env: 'live' }); } catch(_){}

    if (!payload || !payload.processUrl) {
      const cfg = await loadConfig();

      // Local JS build — post directly to PayFast
      const form = document.createElement('form');
      form.id     = 'pfForm';
      form.method = 'POST';
      form.action = 'https://www.payfast.co.za/eng/process';

      const orderId = `WA-${CURRENT.sku}-${Date.now()}`;
      const fields = {
        merchant_id:   '32913011',
        merchant_key:  '8wd7iwcgippud',
        m_payment_id:  orderId,
        amount:        CURRENT.price.toFixed(2),
        item_name:     `${CURRENT.sku} — ${CURRENT.name}`.slice(0, 100),
        email_address: email,
        return_url:    `${location.origin}/thank-you.html`,
        cancel_url:    `${location.origin}/payment-cancelled.html`,
        notify_url:    `${cfg.APPS_SCRIPT_URL}?action=itn` // Apps Script ITN handler
      };

      for (const [k, v] of Object.entries(fields)) {
        const i = document.createElement('input');
        i.type = 'hidden'; i.name = k; i.value = String(v);
        form.appendChild(i);
      }

      document.body.appendChild(form);
      form.submit();
      return;
    }

    // If/when server createPayment exists:
    const form = document.createElement('form');
    form.id     = 'pfForm';
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
  } finally {
    btn.disabled = false; btn.textContent = 'Proceed to PayFast';
  }
}

// ---------- Renderers ----------
async function renderProducts() {
  const grid = $('#grid');
  if (!grid) return;

  let products = [];
  try { products = await api('products'); }
  catch { products = await loadSeed(); }

  PRODUCTS = products; // cache for checkout
  grid.innerHTML = products.map(card).join('');
  bindBuy();

  // Docs dropdown
  const sel = $('#docSelect');
  if (sel) {
    sel.innerHTML = '<option value="">Select a product…</option>' +
      products
        .filter(p => String(p.active).toLowerCase() !== 'false')
        .map(p => `<option value="${p.docUrl || ''}">${p.sku || ''} — ${p.name || ''}</option>`)
        .join('');
    sel.onchange = () => {
      const u = sel.value;
      const b = $('#btnDocDownload');
      if (b) { b.href = u || '#'; if (u) { b.target = '_blank'; b.rel = 'noopener'; } }
    };
  }

  // Live search
  const q = $('#search');
  if (q) {
    q.addEventListener('input', () => {
      const s = q.value.toLowerCase().trim();
      const list = !s ? products
        : products.filter(p => [p.sku, p.name, p.summary].filter(Boolean)
            .some(v => String(v).toLowerCase().includes(s)));
      grid.innerHTML = list.map(card).join('');
      bindBuy();
    });
  }
}

async function renderProductDetail() {
  const el = $('#productDetail');
  if (!el) return;

  const qs  = new URLSearchParams(location.search);
  const sku = qs.get('sku') || qs.get('id');

  if (!sku) {
    el.innerHTML = '<div class="card pad">Missing product SKU.</div>';
    return;
  }

  let p = null;
  try { p = await api('product', { sku }); }
  catch {
    const seed = await loadSeed();
    p = seed.find(x => x.sku === sku) || null;
  }

  if (!p) {
    el.innerHTML = '<div class="card pad">Product not found.</div>';
    return;
  }

  const img = prodImg(p);
  const docLink   = p.docUrl   ? `<a class="btn outline" href="${p.docUrl}" target="_blank" rel="alUrl ? `<{p.trialUrl}Download Trial</a>` : '';

  el.innerHTML = (
    '<div class="card pad">' +
      '<div class="grid" style="grid-template-columns:1.2fr 1fr;gap:16px">' +
        '<div>' +
          `${img}` +
        '</div>' +
        '<div>' +
          `<div class="pill">${p.sku || sku}</div>` +
          `<h2 style="margin:10px 0 8px">${p.name || ''}</h2>` +
          `<div class="price" style="font-size:22px">${moneyZAR(p.price || '')}</div>` +
          `<p class="muted" style="line-height:1.7">${p.description || p.summary || ''}</p>` +
          '<div class="btnrow">' +
            docLink +
            trialLink +
            `<a class="btn whatsapp" hrefe || WhatsApp</a>` +
            `<button class="btn primary" data-buy="1" data-sku="${p.sku || sku}" data-name="${p.name || ''}" data-price="${p.price || ''}">Buy Now</button>` +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
  bindBuy();
}

async function loadPriceList() {
  const b = $('#btnPriceList');
  if (!b) return;
  try {
    const s = await api('settings');
    if (s && s.priceList) {
      b.href = s.priceList;
      b.target = '_blank';
      b.rel = 'noopener';
    }
  } catch {}
}

// ---------- Contact form ----------
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
        headers: { 'content-type':'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({
          action: 'contact',
          name:   d.get('name'),
          email:  d.get('email'),
          message:d.get('message')
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

// ---------- Modal & global submit guard ----------
function bindModal() {
  const m = $('#modalCheckout');
  if (!m) return;

  $('#btnCloseModal').onclick = closeCheckout;
  m.addEventListener('click', e => { if (e.target === m) closeCheckout(); });

  const pay = $('#btnPay');
  if (pay) { pay.type = 'button'; pay.onclick = proceedPayFast; }

  // Safety net: prevent any accidental native form submits on the page
  document.addEventListener('submit', (e) => {
    // Allow only the programmatic PayFast form we create
    if (e.target && e.target.id === 'pfForm') return;
    e.preventDefault();
  }, true);
}

// ---------- Boot ----------
async function init() {
  await loadConfig();
  // Fill all admin links from config
  $$('#adminLink').forEach(a => a.href = CONFIG.ADMIN_URL);

  bindModal();
  await loadPriceList();
  await renderProducts();
  await renderProductDetail();
  await bindContact();
}

document.addEventListener('DOMContentLoaded', init);
