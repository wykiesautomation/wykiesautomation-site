/* Wykies Automation – Public site checkout hardening (v2)
 * Fixes:
 *  - Ensure Buy Now always opens modal (no CSS dependency) by forcing style.display='block'
 *  - Add event delegation for Buy buttons as a backup
 *  - Keep Docs/Trial buttons visible even in fallback by linking to docs.html/trial.html
 *  - Defensive null checks for DOM elements
 */

const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwO16jzeQVcsNt4zOj-YQ8LndsMgaTk089QZkgkb0YrxVf8IbxQi9fnK_1mL9q83d8_LA/exec',
  MERCHANT_ID: '32913011',
  MERCHANT_KEY: '8wd7iwcgippud',
  RETURN_URL: location.origin + '/thank-you.html',
  CANCEL_URL: location.origin + '/payment-cancelled.html',
  NOTIFY_URL: location.origin + '/payfast-itn',
};

const $ = (s)=>document.querySelector(s);
const toastEl = $('#toast');
const grid = $('#grid');
const docSelect = $('#docSelect');
const btnDocDownload = $('#btnDocDownload');
const btnPriceList = $('#btnPriceList');
const modal = document.getElementById('modalCheckout');
const buyerEmail = document.getElementById('buyerEmail');

let PRODUCTS = [];
let SETTINGS = {};
let CURRENT = { sku:null, name:null, price:0 };

// Ensure init runs after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init(){
  bindUI();
  await loadData();
  renderProducts(PRODUCTS);
  renderDocsDropdown(PRODUCTS);
}

function bindUI(){
  const search = $('#search');
  if (search) search.addEventListener('input', debounce(()=>{
    const q = (search.value||'').toLowerCase().trim();
    const list = !q ? PRODUCTS : PRODUCTS.filter(p=>[p.sku,p.name,p.summary].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)));
    renderProducts(list);
  }, 120));

  // Modal explicit controls
  const btnClose = document.getElementById('btnCloseModal');
  if (btnClose) btnClose.onclick = closeModal;
  const btnPay = document.getElementById('btnPay');
  if (btnPay) btnPay.onclick = proceedPayFast;

  // Event delegation fallback: handle Buy button clicks from grid
  if (grid) grid.addEventListener('click', (ev)=>{
    const t = ev.target;
    if (t && t.matches('button.btn.primary[data-sku]')){
      const sku = t.getAttribute('data-sku');
      const p = PRODUCTS.find(x=>String(x.sku)===String(sku));
      if (p) openCheckout(p);
    }
  });

  // Contact form non-blocking submit
  const cf = document.getElementById('contactForm');
  if (cf) {
    cf.addEventListener('submit', (e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(cf).entries());
      try {
        fetch(CONFIG.APPS_SCRIPT_URL, { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'}, body: new URLSearchParams({ action:'contact', ...data }) }).catch(()=>{});
      } catch {}
      cf.reset();
      toast('Message sent. We will reply via email.');
    });
  }

  // Escape key closes modal
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') closeModal(); });
}

async function loadData(){
  // Try Apps Script; on failure, fall back to static list
  let data = null;
  try {
    const r = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=publicData`, { cache:'no-store' });
    if (r.ok) data = await r.json();
  } catch {}

  if (data && Array.isArray(data.products)) {
    PRODUCTS = data.products;
    SETTINGS = data.settings || {};
  } else {
    PRODUCTS = fallbackProducts();
    SETTINGS = { priceList: '#', supportEmail: 'wykiesautomation@gmail.com' };
    // Keep site usable without toasting every time
  }

  if (btnPriceList && SETTINGS.priceList) btnPriceList.href = SETTINGS.priceList;
}

function renderProducts(list){
  if (!grid) return;
  grid.innerHTML = '';
  if (!list.length){ grid.innerHTML = '<div class="muted">No products found.</div>'; return; }

  for (const p of list){
    const img = p.imageUrl ? `<img src="${attr(p.imageUrl)}" alt="${attr(p.name||p.sku)}">` : '';

    // Show Docs/Trial buttons even if we are in fallback (point to generic pages)
    const docsHref = p.docUrl || 'docs.html';
    const trialHref = p.trialUrl || 'trial.html';
    const detailsHref = p.detailsUrl || '';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="pimg">${img}</div>
      <div class="ptitle">${esc(p.name||'')}</div>
      <div class="psku">${esc(p.sku||'')}</div>
      <div class="psum">${esc(p.summary||'')}</div>
      <div class="pprice">R ${fmtPrice(p.price)}</div>
      <div class="btnrow">
        ${(detailsHref? `<a class="btn outline" href="${attr(detailsHref)}">Details</a>` : '')}
        <a class="btn outline" href="${attr(docsHref)}" target="_blank" rel="noopener">View Docs</a>
        <a class="btn outline" href="${attr(trialHref)}">Download Trial</a>
        ${(String(p.buyEnabled).toLowerCase()==='true' || p.buyEnabled===true) ? `<button class="btn primary" data-sku="${attr(p.sku)}">Buy Now</button>` : ''}
      </div>`;

    grid.appendChild(card);
  }
}

function renderDocsDropdown(list){
  if (!docSelect) return;
  docSelect.innerHTML = '';
  const opts = list.filter(p=>p.docUrl).map(p=>({value:p.docUrl, label: `${p.sku} — ${p.name}`}));
  for (const o of opts){
    const opt = document.createElement('option');
    opt.value = o.value; opt.textContent = o.label; docSelect.appendChild(opt);
  }
  if (btnDocDownload){
    btnDocDownload.onclick = ()=>{ const v = docSelect.value; if (!v) return; btnDocDownload.href = v; };
  }
}

function openCheckout(p){
  CURRENT = { sku: p.sku, name: p.name, price: normPrice(p.price) };
  const buySku = document.getElementById('buySku');
  const buyName = document.getElementById('buyName');
  if (buySku) buySku.textContent = p.sku;
  if (buyName) buyName.textContent = p.name;

  // Make modal visible regardless of CSS implementation
  if (modal){
    modal.classList.add('open');
    modal.style.display = 'block';
  }
  if (buyerEmail){ buyerEmail.value=''; buyerEmail.focus(); }
}

function closeModal(){ if (modal){ modal.classList.remove('open'); modal.style.display = 'none'; } }

function proceedPayFast(){
  const email = (buyerEmail && buyerEmail.value || '').trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Enter a valid email');
  if (!CURRENT || !CURRENT.sku) return toast('No product selected');

  try { // Log (non-blocking)
    fetch(CONFIG.APPS_SCRIPT_URL, { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'}, body:new URLSearchParams({ action:'checkoutLog', sku:CURRENT.sku, email }) }).catch(()=>{});
  } catch {}

  // Build form and submit to PayFast
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://www.payfast.co.za/eng/process';

  const orderId = `WA-${CURRENT.sku}-${Date.now()}`;
  const fields = {
    merchant_id: CONFIG.MERCHANT_ID,
    merchant_key: CONFIG.MERCHANT_KEY,
    m_payment_id: orderId,
    amount: CURRENT.price.toFixed(2),
    item_name: `${CURRENT.sku} — ${CURRENT.name}`.slice(0,100),
    email_address: email,
    return_url: CONFIG.RETURN_URL,
    cancel_url: CONFIG.CANCEL_URL,
    notify_url: CONFIG.NOTIFY_URL,
  };

  for (const [k,v] of Object.entries(fields)){
    const inp = document.createElement('input');
    inp.type='hidden'; inp.name=k; inp.value=String(v); form.appendChild(inp);
  }

  document.body.appendChild(form);
  form.submit();
}

// ---------- helpers ----------
function toast(msg){ if(!toastEl) return; toastEl.textContent=msg; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'),2000); }
function esc(s){ return String(s ?? '').replace(/[&<>]/g, c=>({'&':'&','<':'<','>':'>'}[c])); }
function attr(s){ return esc(s).replace(/"/g,'"'); }
function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
function normPrice(p){ const n = parseFloat(String(p).replace(/[^0-9.]/g,'')); return isFinite(n) ? n : 0; }
function fmtPrice(p){ return normPrice(p).toFixed(2); }

function fallbackProducts(){
  // VAT-inclusive prices per Janes' confirmed list
  return [
    { sku:'WA-01', name:'Product WA-01', price:1499,  buyEnabled:true },
    { sku:'WA-02', name:'Product WA-02', price:2499,  buyEnabled:true },
    { sku:'WA-03', name:'Product WA-03', price:6499,  buyEnabled:true },
    { sku:'WA-04', name:'Product WA-04', price:899,   buyEnabled:true },
    { sku:'WA-05', name:'Product WA-05', price:800,   buyEnabled:true },
    { sku:'WA-06', name:'Product WA-06', price:3999,  buyEnabled:true },
    { sku:'WA-07', name:'Product WA-07', price:1800,  buyEnabled:true },
    { sku:'WA-08', name:'Product WA-08', price:999,   buyEnabled:true },
    { sku:'WA-09', name:'Product WA-09', price:1009,  buyEnabled:true },
    { sku:'WA-10', name:'Product WA-10', price:1299,  buyEnabled:true },
    { sku:'WA-11', name:'Product WA-11', price:5499,  buyEnabled:true },
  ];
}
