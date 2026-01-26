
// Wykies Automation Public Site (Phase 1)
const WA = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwO16jzeQVcsNt4zOj-YQ8LndsMgaTk089QZkgkb0YrxVf8IbxQi9fnK_1mL9q83d8_LA/exec',
  WHATSAPP: '27716816131'
};

const $ = (s) => document.querySelector(s);
let PRODUCTS = [];
let CURRENT_BUY = null;

document.addEventListener('DOMContentLoaded', () => {
  bindUI();
  loadProducts();
});

function bindUI(){
  const closeBtn = $('#btnCloseModal');
  const modal = $('#modalCheckout');
  if(closeBtn && modal){
    closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  }

  const btnPay = $('#btnPay');
  if(btnPay){
    btnPay.addEventListener('click', proceedToPayFast);
  }

  const search = $('#search');
  if(search){
    search.addEventListener('input', debounce(() => renderGrid(filterProducts(search.value)), 120));
  }

  const docSelect = $('#docSelect');
  const btnDoc = $('#btnDocDownload');
  if(docSelect && btnDoc){
    docSelect.addEventListener('change', () => {
      const sku = docSelect.value;
      const p = PRODUCTS.find(x => x.sku === sku);
      if(p && p.docUrl) btnDoc.href = p.docUrl;
    });
  }

  const form = $('#contactForm');
  if(form){
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: form.querySelector('[name=name]')?.value || '',
        email: form.querySelector('[name=email]')?.value || '',
        message: form.querySelector('[name=message]')?.value || ''
      };
      const ok = await apiContact(payload);
      const msg = $('#contactMsg');
      if(msg) msg.textContent = ok ? 'Sent. We will respond soon.' : 'Could not send. Please WhatsApp us.';
      if(ok) form.reset();
    });
  }
}

async function loadProducts(){
  PRODUCTS = await apiGetProducts();
  renderGrid(PRODUCTS);
  populateDocsDropdown(PRODUCTS);
  renderProductDetailIfNeeded(PRODUCTS);
}

function populateDocsDropdown(list){
  const docSelect = $('#docSelect');
  if(!docSelect) return;
  docSelect.innerHTML = '';
  (list||[]).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.sku;
    opt.textContent = p.sku + ' — ' + (p.name || '');
    docSelect.appendChild(opt);
  });
  const btnDoc = $('#btnDocDownload');
  if(list[0] && btnDoc && list[0].docUrl) btnDoc.href = list[0].docUrl;
}

function renderGrid(list){
  const grid = $('#grid');
  if(!grid) return;
  grid.innerHTML = '';
  (list||[]).forEach(p => {
    const card = document.createElement('div');
    card.className = 'card pad';

    const img = p.imageUrl || (p.ogImage ? ('assets/product/' + p.ogImage) : ('assets/product/' + p.sku.toLowerCase() + '.png'));

    card.innerHTML = ""
      + "<img class='prod-img' src='"+ escapeAttr(img) +"' alt='"+ escapeAttr(p.sku) +"' loading='lazy'/>"
      + "<div style='margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap'>"
      + "  <div>"
      + "    <div class='small'><span class='kbd'>"+ escapeHtml(p.sku) +"</span></div>"
      + "    <strong style='display:block;margin-top:6px'>"+ escapeHtml(p.name||'') +"</strong>"
      + "    <div class='muted' style='font-size:13px;margin-top:6px'>"+ escapeHtml(p.summary||'') +"</div>"
      + "  </div>"
      + "  <div style='text-align:right'>"
      + "    <div class='small'>Price (incl. VAT)</div>"
      + "    <div style='font-size:18px;font-weight:800'>R "+ formatMoney(p.price) +"</div>"
      + "  </div>"
      + "</div>"
      + "<div class='btnrow' style='margin-top:12px'>"
      + "  <button class='btn primary' type='button' data-buy='1'>Buy Now</button>"
      + "  <a class='btn outline' href='product.html?id="+ encodeURIComponent(p.sku) +"'>Details</a>"
      + "  <a class='btn outline' href='"+ escapeAttr(p.docUrl || 'docs.html') +"' target='_blank' rel='noopener'>View Docs</a>"
      + "  <a class='btn outline' href='"+ escapeAttr(p.trialUrl || 'trial.html') +"' target='_blank' rel='noopener'>Download Trial</a>"
      + "</div>";

    grid.appendChild(card);
    card.querySelector('[data-buy]')?.addEventListener('click', () => openCheckout(p));
  });
}

function renderProductDetailIfNeeded(list){
  const box = $('#productDetail');
  if(!box) return;
  const params = new URLSearchParams(location.search);
  const sku = params.get('id') || params.get('sku');
  const p = list.find(x => x.sku === sku) || list[0];
  if(!p) return;

  const img = p.imageUrl || (p.ogImage ? ('assets/product/' + p.ogImage) : '');
  const gallery = (Array.isArray(p.images) && p.images.length) ? p.images : ['assets/gallery/' + p.sku.toLowerCase() + '-01.png'];

  box.innerHTML = ""
    + "<div class='grid' style='grid-template-columns:1.1fr .9fr;gap:14px'>"
    + "  <div class='card pad'>"
    + "    <div class='small'>"+ escapeHtml(p.sku) +"</div>"
    + "    <h2 style='margin:6px 0 8px'>"+ escapeHtml(p.name||'') +"</h2>"
    + "    <div class='muted'>"+ escapeHtml(p.description || p.summary || '') +"</div>"
    + "    <div class='btnrow' style='margin-top:12px'>"
    + "      <button class='btn primary' type='button' id='buyNow'>Buy Now</button>"
    + "      <a class='btn outline' href='"+ escapeAttr(p.docUrl||'#') +"' target='_blank' rel='noopener'>View Docs</a>"
    + "      <a class='btn outline' href='"+ escapeAttr(p.trialUrl||'#') +"' target='_blank' rel='noopener'>Download Trial</a>"
    + "    </div>"
    + "  </div>"
    + "  <div class='card pad'>"
    + (img ? ("<img class='prod-img' src='"+ escapeAttr(img) +"' alt='"+ escapeAttr(p.sku) +"'/>") : "<div class='muted'>No image</div>")
    + "    <div style='margin-top:10px'><div class='small'>Price (incl. VAT)</div><div style='font-size:22px;font-weight:800'>R "+ formatMoney(p.price) +"</div></div>"
    + "  </div>"
    + "</div>"
    + "<div class='section' style='padding-top:14px'>"
    + "  <h3 style='margin:0 0 10px'>Gallery</h3>"
    + "  <div class='grid cols-3' id='galGrid'></div>"
    + "</div>";

  const galGrid = document.getElementById('galGrid');
  if(galGrid){
    gallery.forEach(u => {
      const a = document.createElement('a');
      a.className = 'card pad';
      a.style.textDecoration = 'none';
      a.href = u;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = "<img class='prod-img' src='"+ escapeAttr(u) +"' alt='gallery'/>";
      galGrid.appendChild(a);
    });
  }

  document.getElementById('buyNow')?.addEventListener('click', () => openCheckout(p));
}

function openCheckout(p){
  CURRENT_BUY = p;
  const modal = $('#modalCheckout');
  if(!modal) return;
  $('#buySku').textContent = p.sku;
  $('#buyName').textContent = p.name || '';
  modal.classList.add('open');
}

async function proceedToPayFast(){
  if(!CURRENT_BUY) return;
  const email = ($('#buyerEmail')?.value || '').trim();
  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return showToast('Please enter a valid email');

  const resp = await apiCreatePayment(CURRENT_BUY.sku, email);
  if(!resp || !resp.fields || !resp.processUrl) return showToast('Checkout not available. Try again.');

  const form = document.createElement('form');
  form.method = 'post';
  form.action = resp.processUrl;
  Object.keys(resp.fields).forEach(k => {
    const inp = document.createElement('input');
    inp.type = 'hidden';
    inp.name = k;
    inp.value = String(resp.fields[k]);
    form.appendChild(inp);
  });
  document.body.appendChild(form);
  form.submit();
}

// ---- API helpers: try op= then action= ----
async function apiGetProducts(){
  const out = await tryJson(WA.APPS_SCRIPT_URL + '?op=products') || await tryJson(WA.APPS_SCRIPT_URL + '?action=products') || [];
  return (out||[]).map(p => ({
    sku: p.sku || p.SKU || '',
    name: p.name || p.Name || '',
    price: p.price || p.Price || p.TotalInclVAT || '',
    summary: p.summary || p.Summary || '',
    description: p.description || p.Description || '',
    docUrl: p.docUrl || p.DocUrl || '',
    trialUrl: p.trialUrl || p.TrialUrl || '',
    imageUrl: p.imageUrl || p.ImageUrl || '',
    ogImage: p.ogImage || p.OGImage || p.image || '',
    images: p.images || p.Images || []
  })).filter(p => p.sku);
}

async function apiCreatePayment(sku,email){
  const q = 'sku=' + encodeURIComponent(sku) + '&email=' + encodeURIComponent(email) + '&env=live';
  return await tryJson(WA.APPS_SCRIPT_URL + '?op=createPayment&' + q) || await tryJson(WA.APPS_SCRIPT_URL + '?action=createPayment&' + q);
}

async function apiContact(payload){
  const ok = await tryPost('op=contact', payload) || await tryPost('action=contact', payload);
  return !!ok;
}

async function tryJson(url){
  try{ const r = await fetch(url, {cache:'no-store'}); if(!r.ok) return null; return await r.json(); }catch(e){ return null; }
}

async function tryPost(prefix, payload){
  try{
    const body = new URLSearchParams(prefix);
    Object.keys(payload).forEach(k => body.append(k, payload[k]));
    const r = await fetch(WA.APPS_SCRIPT_URL, {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'}, body});
    if(!r.ok) return null;
    const t = await r.text();
    return t;
  }catch(e){ return null; }
}

// ---- utilities ----
function filterProducts(q){
  q = (q||'').toLowerCase().trim();
  if(!q) return PRODUCTS;
  return PRODUCTS.filter(p => [p.sku,p.name,p.summary].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
}
function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
function escapeHtml(s){ return String(s||'').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }
function formatMoney(v){ const n = parseFloat(String(v||'').replace(/[^0-9.]/g,'')); return isFinite(n)? n.toFixed(2) : '0.00'; }
function showToast(msg){ const t = $('#toast'); if(!t) return; t.textContent = msg; t.style.display = 'block'; setTimeout(()=>t.style.display='none', 2200); }
