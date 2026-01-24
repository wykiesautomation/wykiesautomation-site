
/* Wykies Automation — app.js (HTML renderers, hardened) */
/* 2026-01-24 */

(() => {
  // ==========================
  // Utilities & State
  // ==========================
  const $  = (s, e = document) => e.querySelector(s);
  const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));

  const WA = {
    CONFIG: null,
    CURRENT: null,     // current item for checkout
    toastTimer: null
  };

  function toast(msg, type = 'info') {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.style.borderColor = (type === 'error') ? '#ef4444' : 'rgba(148,163,184,.25)';
    t.classList.add('on');
    clearTimeout(WA.toastTimer);
    WA.toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
  }

  const debounce = (fn, ms = 200) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  function moneyZAR(v) {
    const n = Number(String(v).replace(/[^\d.]/g, ''));
    if (isNaN(n)) return String(v ?? '');
    return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function isHttp(u) {
    return /^https?:\/\//i.test(String(u || ''));
  }

  // ==========================
  // Config & API
  // ==========================
  async function loadConfig() {
    if (WA.CONFIG) return WA.CONFIG;
    const r = await fetch('assets/js/config.json', { cache: 'no-store' });
    WA.CONFIG = await r.json();
    return WA.CONFIG;
  }

  async function loadSeed(name) {
    const r = await fetch('assets/js/' + name, { cache: 'no-store' });
    return await r.json();
  }

  async function apiGet(action, params = {}) {
    const cfg = await loadConfig();
    const url = new URL(cfg.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const r = await fetch(url.toString(), { cache: 'no-store' });
    if (!r.ok) throw new Error('API');
    return await r.json();
  }

  async function apiPost(obj) {
    const cfg = await loadConfig();
    const res = await fetch(cfg.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(obj)
    });
    const txt = await res.text();
    try { return JSON.parse(txt); } catch { return txt; }
  }

  // ==========================
  // Data helpers
  // ==========================
  function prodImg(p) {
    const raw = p.imageUrl || p.ogImage || '';
    if (!raw) return 'assets/product/wa-01.PNG';
    if (isHttp(raw)) return raw;
    // Normalize to assets/product if a relative path
    const trimmed = String(raw).replace(/^\/?assets\/(product|img)\//, '').replace(/^\//, '');
    return 'assets/product/' + trimmed;
  }

  function detailsUrl(p) {
    return p.detailsUrl || `product.html?sku=${encodeURIComponent(p.sku || '')}`;
  }

  function waLink(sku, name) {
    const phone = WA.CONFIG?.WHATSAPP || '27716816131';
    const msg = encodeURIComponent(`Hi Wykies Automation, I would like to order: ${sku} — ${name}`);
    return `https://wa.me/${phone}?text=${msg}`;
  }

  // ==========================
  // Checkout Modal
  // ==========================
  function openCheckout(sku, name) {
    WA.CURRENT = { sku, name };
    const m = $('#modalCheckout');
    if (!m) return;
    $('#buySku') && ($('#buySku').textContent = sku);
    $('#buyName') && ($('#buyName').textContent = name);
    m.classList.add('on');
    document.body.classList.add('modal-open');
    const email = $('#buyerEmail');
    if (email) email.focus();
  }

  function closeCheckout() {
    const m = $('#modalCheckout');
    if (!m) return;
    m.classList.remove('on');
    document.body.classList.remove('modal-open');
  }

  async function proceedPayFast() {
    const email = $('#buyerEmail')?.value.trim();
    if (!email) return toast('Please enter your email address', 'error');
    try {
      const btn = $('#btnPay');
      if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }

      const payload = await apiPost({ action: 'createPayment', sku: WA.CURRENT.sku, email });
      if (!payload || !payload.processUrl || !payload.fields) throw new Error('Bad payment payload');

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
    } finally {
      const btn = $('#btnPay');
      if (btn) { btn.disabled = false; btn.textContent = 'Proceed to PayFast'; }
    }
  }

  function bindModal() {
    const m = $('#modalCheckout');
    if (!m) return;
    $('#btnCloseModal')?.addEventListener('click', closeCheckout);
    m.addEventListener('click', (e) => { if (e.target === m) closeCheckout(); });
    $('#btnPay')?.addEventListener('click', proceedPayFast);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && m.classList.contains('on')) closeCheckout();
    });
  }

  function bindBuy() {
    $$('button[data-buy="1"]').forEach(b => {
      b.onclick = () => openCheckout(b.dataset.sku, b.dataset.name);
    });
  }

  // ==========================
  // Renderers (ALL HTML)
  // ==========================
  function productCardHTML(p) {
    const active = String(p.active).toLowerCase() !== 'false' && p.active !== false;
    if (!active) return '';
    const sku = p.sku || '';
    const name = p.name || '';
    const sum = p.summary || '';
    const img = prodImg(p);
    const docs = p.docUrl ? `${p.docUrl}View Docs</a>` : '';
    const trial = p.trialUrl ? `${p.trialUrl}Trial</a>` : '';
    const pre = (String(p.preOrder).toLowerCase() === 'true' || p.preOrder === true) ? `<span class="pill">Pre‑Order</span>` : '';

    return `
      <div class="card">
        ${img}
        <div class="pad">
          <div class="small muted">${sku}</div>
          <h4 style="margin:6px 0">${name} ${pre}</h4>
          <div class="muted">${sum}</div>
          <div class="price" style="margin:10px 0"><strong>${moneyZAR(p.price || '')}</strong> <span class="small">incl. VAT</span></div>
          <div class="btnrow">
            <button class="btn primary" data-buy="1" data-sku="${sku}" data-name="${name}">Buy</button>
            ${detailsUrl(p)}Details</a>
            ${docs}
            ${trial}
            ${waLink(sku, name)}WhatsApp</a>
          </div>
        </div>
      </div>
    `;
  }

  async function renderProducts() {
    const grid = $('#grid');
    if (!grid) return;

    grid.innerHTML = `<div class="muted grid-loading" style="text-align:center;padding:16px">Loading products…</div>`;

    let products = [];
    try {
      products = await apiGet('products');
    } catch {
      products = await loadSeed('products.seed.json');
    }

    const cards = products.map(productCardHTML).join('');
    grid.innerHTML = cards || `<div class="muted grid-empty" style="text-align:center;padding:16px">No products found.</div>`;
    bindBuy();

    // Documents selector (Home & Docs pages)
    const sel = $('#docSelect');
    if (sel) {
      const docsList = products
        .filter(p => String(p.active).toLowerCase() !== 'false' && p.docUrl)
        .map(p => ({ text: `${p.sku || ''} — ${p.name || ''}`, url: p.docUrl }));

      const opts = [`<option value="">Select a product…</option>`]
        .concat(docsList.map(d => `<option value="${d.url}">${d.text}</option>`));

      sel.innerHTML = opts.join('');
      const btn = $('#btnDocDownload');
      if (btn) {
        btn.href = '#';
        btn.setAttribute('tabindex', '-1');
        btn.setAttribute('aria-disabled', 'true');
        sel.addEventListener('change', () => {
          const v = sel.value;
          if (v) {
            btn.href = v; btn.removeAttribute('aria-disabled'); btn.removeAttribute('tabindex');
          } else {
            btn.href = '#'; btn.setAttribute('tabindex', '-1'); btn.setAttribute('aria-disabled', 'true');
          }
        });
      }
    }

    // Search
    const q = $('#search');
    if (q) {
      const onQuery = () => {
        const s = q.value.toLowerCase().trim();
        const list = !s ? products
          : products.filter(p => [p.sku, p.name, p.summary].filter(Boolean).some(v => String(v).toLowerCase().includes(s)));
        grid.innerHTML = list.map(productCardHTML).join('') ||
          `<div class="muted grid-empty" style="text-align:center;padding:16px">No products match “${s}”.</div>`;
        bindBuy();
      };
      q.addEventListener('input', debounce(onQuery, 220));
    }
  }

  async function renderProductDetail() {
    const el = $('#productDetail');
    if (!el) return;

    const qs  = new URLSearchParams(location.search);
    const sku = qs.get('sku') || qs.get('id');
    if (!sku) {
      el.innerHTML = `<div class="card pad"><div class="muted">No product selected. products.htmlBrowse products</a>.</div></div>`;
      return;
    }

    let p = null;
    try {
      p = await apiGet('product', { sku });
    } catch {
      const all = await loadSeed('products.seed.json');
      p = all.find(x => x.sku === sku) || null;
    }

    if (!p) {
      el.innerHTML = `<div class="card pad"><div class="muted">Product not found. products.htmlBack to products</a>.</div></div>`;
      return;
    }

    const img = prodImg(p);
    el.innerHTML = `
      <div class="card pad">
        <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:16px;align-items:start">
          <div>
            ${img}
          </div>
          <div>
            <div class="small muted">${p.sku || sku}</div>
            <h2 style="margin:6px 0">${p.name || ''}</h2>
            <div class="price" style="margin:10px 0"><strong>${moneyZAR(p.price || '')}</strong> <span class="small">incl. VAT</span></div>
            <div class="muted" style="margin:10px 0">${p.description || p.summary || ''}</div>
            <div class="btnrow">
              <button class="btn primary" data-buy="1" data-sku="${p.sku || sku}" data-name="${p.name || ''}">Buy</button>
              ${p.docUrl ? `<a class="btn outline" href="${p.docUrl}" target="_rialUrl ? `${p.trialUrl}Download Trial</a>` : ''}
              ${waLink(p.sku || sku, p.name || WhatsApp</a>
            </div>
          </div>
        </div>
      </div>
    `;
    bindBuy();
  }

  async function renderGallery() {
    const grid = $('#galleryGrid');
    if (!grid) return;

    grid.innerHTML = `<div class="muted" style="text-align:center;padding:16px">Loading gallery…</div>`;

    let items = [];
    try {
      items = await apiGet('gallery');
    } catch {
      items = await loadSeed('gallery.seed.json');
    }

    items = (items || [])
      .filter(x => String(x.active).toLowerCase() !== 'false')
      .sort((a, b) => (Number(a.sortOrder || 0) - Number(b.sortOrder || 0)) ||
                      String(a.id || '').localeCompare(String(b.id || '')));

    if (!items.length) {
      grid.innerHTML = `<div class="muted grid-empty" style="text-align:center;padding:16px">No gallery items yet.</div>`;
      return;
    }

    grid.innerHTML = items.map(it => {
      const url = String(it.imageUrl || '').replace(/^\//, '');
      const src = isHttp(url) ? url : url; // allow absolute http(s) or relative paths
      const cap = String(it.caption || it.filename || '');
      return `
        <figure class="card" style="overflow:hidden">
          ${src}
          ${cap ? `<figcaption class="pad small muted">${cap}</figcaption>` : ''}
        </figure>
      `;
    }).join('');
  }

  async function renderTrialList() {
    const box = $('#trialList');
    if (!box) return;

    box.innerHTML = `<div class="muted" style="text-align:center;padding:16px">Loading trials…</div>`;

    let products = [];
    try {
      products = await apiGet('products');
    } catch {
      products = await loadSeed('products.seed.json');
    }

    const list = (products || [])
      .filter(p => p.trialUrl)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

    if (!list.length) {
      box.innerHTML = `<div class="muted inline-empty">No trial links configured.</div>`;
      return;
    }

    box.innerHTML = list.map(p => {
      const sha = p.trialSha256 || p.trialSHA256 || p.sha256 || '';
      const size = p.trialSize ? `<span class="small muted">• ${p.trialSize}</span>` : '';
      return `
        <div class="card pad">
          <h4 style="margin:0 0 6px">${p.name || ''} <span class="small muted">(${p.sku || ''})</span></h4>
          <div class="muted">${p.summary || ''}</div>
          <div class="small" style="margin:8px 0">Trial build ${size}</div>
          ${sha ? `<code class="small" style="display:block">${sha}</code>` : ''}
          <div class="btnrow" style="margin-top:10px">
            ${p.trialUrl}Download Trial</a>
            ${detailsUrl(p)}View Product</a>
            ${p.docUrl ? `${p.docUrl}View Docs</a>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadPriceList() {
    const b = $('#btnPriceList');
    if (!b) return;
    try {
      const s = await apiGet('settings');
      if (s && s.priceList) { b.href = s.priceList; b.target = '_blank'; b.rel = 'noopener'; }
    } catch { /* noop */ }
  }

  async function bindContact() {
    const f = $('#contactForm');
    if (!f) return;
    const msgEl = $('#contactMsg');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = new FormData(f);
      try {
        const r = await apiPost({
          action: 'contact',
          name: d.get('name'),
          email: d.get('email'),
          message: d.get('message')
        });
        if (msgEl) msgEl.textContent = String(r).includes('OK')
          ? 'Thanks — we’ll get back to you shortly.'
          : 'Sent.';
        f.reset();
      } catch (err) {
        console.error(err);
        if (msgEl) msgEl.textContent = 'Could not send right now. Please WhatsApp us.';
      }
    });
  }

  // ==========================
  // Init
  // ==========================
  async function init() {
    await loadConfig();

    // Admin URL injection (present in your previous build)
    $$(`#adminLink`).forEach(a => { if (a) a.href = WA.CONFIG.ADMIN_URL; }); // supports multiple pages with same id safely
    // ^ Existing behavior preserved. [1](https://arcelormittal-my.sharepoint.com/personal/10005739_arcelormittalsa_com/Documents/Microsoft%20Copilot%20Chat%20Files/app.js)

    bindModal();
    await loadPriceList();
    await renderProducts();
    await renderProductDetail();
    await renderGallery();
    await renderTrialList();
    await bindContact();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
