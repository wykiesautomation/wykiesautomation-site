
/* assets/js/app.js  — Wykies Automation front-end bootstrap
   - Renders product grid & Documents dropdown
   - Wires PayFast redirect flow (live)
   - Optional server-side signature via Google Apps Script
   Jan 26, 2026
*/

/* ====== CONFIG ====== */
const PRODUCTS_JSON_URL = 'assets/data/products.json'; // Admin writes here
const IMAGE_FALLBACK = 'assets/img/product-fallback.png';

// LIVE PayFast endpoint (Janes wants LIVE only)
const PAYFAST_URL = 'https://www.payfast.co.za/eng/process';

// IMPORTANT: Merchant ID/Key are allowed in the form post per PayFast docs.
// Signature/passphrase must NOT be exposed client-side.
const MERCHANT_ID  = '32913011';          // from your live account
const MERCHANT_KEY = '8wd7iwcgippud';     // from your live account

// Temporary: if you cannot deploy the SIGN_URL yet, keep this false and
// make sure "Require Signature" is DISABLED in PayFast dashboard.
// Then re-enable after you deploy SIGN_URL (Apps Script below).
const REQUIRE_SIGNATURE = false;
const SIGN_URL = ''; // e.g., 'https://script.google.com/macros/s/XXXXX/exec?route=sign'

// ITN (notify_url) — point to your Apps Script ITN endpoint once deployed.
const NOTIFY_URL = ''; // e.g., 'https://script.google.com/macros/s/XXXXX/exec?route=itn'

// Return/cancel pages — safe defaults if you haven’t created thank-you pages yet
const RETURN_URL = location.origin + '/index.html?pf_status=success';
const CANCEL_URL = location.origin + '/index.html?pf_status=cancel';

/* ====== Tiny helpers ====== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const toast = (msg, type = 'info') => {
  const t = $('#toast');
  if (!t) return alert(msg);
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.style.display = 'block';
  setTimeout(() => (t.style.display = 'none'), 4000);
};

const currency = v => 'R' + Number(v).toFixed(2);

/* ====== Data load (with robust fallbacks) ====== */
async function loadProducts() {
  // Try JSON first (admin-managed). If that fails, use a safe fallback list.
  try {
    const res = await fetch(PRODUCTS_JSON_URL + `?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('products.json not found');
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('empty products.json');
    return data;
  } catch (err) {
    console.warn('Falling back to embedded products:', err.message);
    // Fallback uses Janes’ VAT-inclusive prices (vetted in earlier sessions)
    return [
      { sku:'WA-01', name:'Hybrid Universal Gate Opener (GSM)',          price:1499, img:'assets/img/wa-01.png', summary:'GSM-based gate/garage controller', docs_url:'docs/WA-01/' },
      { sku:'WA-02', name:'Hybrid Universal Gate Opener (ESP32 Wi‑Fi)',  price:2499, img:'assets/img/wa-02.png', summary:'Wi‑Fi/Bluetooth ESP32 controller',   docs_url:'docs/WA-02/' },
      { sku:'WA-03', name:'16‑Channel ESP32 Alarm (Wi‑Fi primary)',      price:6499, img:'assets/img/wa-03.png', summary:'ESP32 alarm system',                 docs_url:'docs/WA-03/' },
      { sku:'WA-04', name:'VanWyk DriveBench – Shifter GUI',             price:899,  img:'assets/img/wa-04.png', summary:'Desktop test GUI',                   docs_url:'docs/WA-04/' },
      { sku:'WA-05', name:'ECU/TCU GUI – Legacy (Desktop)',              price:800,  img:'assets/img/wa-05.png', summary:'Legacy ECU/TCU desktop app',         docs_url:'docs/WA-05/' },
      { sku:'WA-06', name:'Plasma Cutter GUI (PyQt)',                     price:3999, img:'assets/img/wa-06.png', summary:'Modern CNC plasma GUI',              docs_url:'docs/WA-06/' },
      { sku:'WA-07', name:'12‑Ch Hybrid Alarm (Wi‑Fi+GSM)',               price:1800, img:'assets/img/wa-07.png', summary:'Wi‑Fi primary, GSM fallback',       docs_url:'docs/WA-07/' },
      { sku:'WA-08', name:'3D Printer GUI (PyQt prototype)',              price:999,  img:'assets/img/wa-08.png', summary:'From-scratch modern GUI',           docs_url:'docs/WA-08/' },
      { sku:'WA-09', name:'Hybrid Gate Controller – Admin (GSM tab)',     price:1009, img:'assets/img/wa-09.png', summary:'Admin GSM commands',                docs_url:'docs/WA-09/' },
      { sku:'WA-10', name:'ECU/TCU GUI – Modern (Desktop)',               price:1299, img:'assets/img/wa-10.png', summary:'Modern sensors & dashboard',        docs_url:'docs/WA-10/' },
      { sku:'WA-11', name:'VanWyk ECU/TCU Android APK (Kivy)',            price:5499, img:'assets/img/wa-11.png', summary:'Touch-optimized APK',               docs_url:'docs/WA-11/' },
    ];
  }
}

/* ====== UI rendering ====== */
function renderProducts(list) {
  const grid = $('#grid');
  if (!grid) return;
  grid.innerHTML = '';

  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="pad">
        <img src="${p.img || IMAGE_FALLBACK}" alt="${p.name}" onerrorustify-content:space-between;gap:10px;align-items:flex-start;margin-top:10px">
          <div>
            <div class="small muted">${p.sku}</div>
            <h4 style="margin:2px 0 4px">${p.name}</h4>
            <div class="muted" style="min-height:36px">${p.summary || ''}</div>
          </div>
          <strong>${currency(p.price)}</strong>
        </div>
        <div class="btnrow" style="margin-top:10px">
          <button class="btn primary" data-sku="${p.sku}">Buy</button>
          <a class="btn outline" href="${p.docs </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Buy buttons → open modal
  $$('#grid .btn.primary').forEach(btn => {
    btn.addEventListener('click', e => {
      const sku = e.currentTarget.dataset.sku;
      const prod = list.find(x => x.sku === sku);
      if (!prod) return toast('Product not found', 'error');
      $('#buySku').textContent = prod.sku;
      $('#buyName').textContent = prod.name;
      $('#modalCheckout').style.display = 'flex';
      $('#modalCheckout').dataset.sku = prod.sku;
    });
  });
}

function populateDocDropdown(list) {
  const sel = $('#docSelect');
  if (!sel) return;
  sel.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = 'Select a product…';
  sel.appendChild(opt0);

  list.forEach(p => {
    const o = document.createElement('option');
    o.value = p.docs_url || '#';
    o.textContent = `${p.sku} — ${p.name}`;
    sel.appendChild(o);
  });

  $('#btnDocDownload')?.addEventListener('click', e => {
    e.preventDefault();
    const url = sel.value;
    if (!url) return toast('Choose a product first');
    window.open(url, '_blank', 'noopener');
  });

  // Price list PDF — point to your static file if available
  $('#btnPriceList')?.addEventListener('click', e => {
    // update this path if you keep it elsewhere
    e.currentTarget.href = 'docs/price-list.pdf';
  });
}

/* ====== Search filter ====== */
function wireSearch(list) {
  const input = $('#search');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const filtered = !q ? list : list.filter(p =>
      [p.sku, p.name, p.summary].filter(Boolean).some(x => x.toLowerCase().includes(q))
    );
    renderProducts(filtered);
  });
}

/* ====== Modal controls ====== */
function wireModal() {
  $('#btnCloseModal')?.addEventListener('click', () => {
    $('#modalCheckout').style.display = 'none';
  });
}

/* ====== PayFast redirect ====== */
async function payWithPayFast(products) {
  const sku = $('#modalCheckout').dataset.sku;
  const prod = products.find(x => x.sku === sku);
  if (!prod) return toast('No product selected', 'error');

  const email = $('#buyerEmail').value.trim();
  if (!email) return toast('Enter your email for the invoice', 'error');

  // Build the payload per PayFast docs
  // https://developers.payfast.co.za/  (Custom Integration → Simple form)
  const payload = {
    // Merchant details
    merchant_id: MERCHANT_ID,
    merchant_key: MERCHANT_KEY,
    return_url: RETURN_URL,
    cancel_url: CANCEL_URL,
    notify_url: NOTIFY_URL || '',

    // Buyer details
    email_address: email,

    // Transaction details
    m_payment_id: `WA_${sku}_${Date.now()}`, // unique per transaction
    amount: Number(prod.price).toFixed(2),
    item_name: `${prod.sku} — ${prod.name}`,
    item_description: (prod.summary || '').slice(0, 255),
  };

  // Optional signature via server (RECOMMENDED when Require Signature is enabled)
  if (REQUIRE_SIGNATURE) {
    if (!SIGN_URL) return toast('Signature service not configured', 'error');
    try {
      const res = await fetch(SIGN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('signing failed');
      const { signature } = await res.json();
      if (!signature) throw new Error('no signature');
      payload.signature = signature;
    } catch (e) {
      return toast('Could not obtain signature. Please try again later.', 'error');
    }
  }

  // Create and submit an HTML form (avoids CORS; PayFast expects a POST form)
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = PAYFAST_URL;
  form.style.display = 'none';

  Object.entries(payload).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = v;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

function wirePayButton(products) {
  $('#btnPay')?.addEventListener('click', () => {
    // If signature is required by your PayFast settings but SIGN_URL isn’t set,
    // the request will fail. See notes in README and dashboard setting.
    payWithPayFast(products);
  });
}

/* ====== Bootstrap ====== */
(async function init() {
  try {
    const products = await loadProducts();
    renderProducts(products);
    populateDocDropdown(products);
    wireSearch(products);
    wireModal();
    wirePayButton(products);
  } catch (err) {
    console.error(err);
    toast('Failed to load products. Please refresh.', 'error');
  }
})();
