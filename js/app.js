
async function fetchJson(url){
  const r = await fetch(url, {cache:'no-store'});
  return await r.json();
}

function waLink(number, text){
  const n = number.replace(/[^0-9+]/g,'');
  return `https://wa.me/${n.replace('+','') }?text=${encodeURIComponent(text)}`;
}

async function loadProducts(){
  const cfg = window.WA_CONFIG || {};
  const api = cfg.APPS_SCRIPT_URL;
  // If API not set, fall back to local products.json
  if(!api || api.includes('AKFY')){
    return await fetchJson('data/products.json');
  }
  try{
    // Try admin-style endpoint first
    const list = await fetchJson(`${api}?action=products`);
    if(Array.isArray(list) && list.length) return list;
  }catch(e){}
  try{
    // Try spec-style endpoint
    const list = await fetchJson(`${api}?op=products`);
    if(Array.isArray(list) && list.length) return list;
  }catch(e){}
  return await fetchJson('data/products.json');
}

function moneyZAR(v){
  const n = Number(v||0);
  if(!isFinite(n)) return 'R 0.00';
  return 'R ' + n.toLocaleString('en-ZA', {minimumFractionDigits:2, maximumFractionDigits:2});
}

async function renderProductsGrid(containerId){
  const el = document.getElementById(containerId);
  if(!el) return;
  const products = (await loadProducts()).filter(p => String(p.active).toLowerCase() !== 'false');
  products.sort((a,b)=> (Number(a.sortOrder||0)-Number(b.sortOrder||0)) );
  el.innerHTML = products.map(p=>{
    const sku = p.sku;
    const name = p.name || sku;
    const img = p.imageUrl || `assets/product/${sku}.png`;
    return `
    <article class="card">
      <div class="thumb"><img src="${img}" alt="${name}"></div>
      <div class="sku"><span class="chip">${sku}</span></div>
      <h3>${name}</h3>
      <p class="meta">${moneyZAR(p.price)} • VAT incl.</p>
      <div class="actions">
        <a class="btn primary" href="product.html?sku=${encodeURIComponent(sku)}">Details</a>
        <button class="btn" onclick="buyNow('${sku}')">Buy</button>
      </div>
    </article>`;
  }).join('');
}

async function renderProductDetail(){
  const params = new URLSearchParams(location.search);
  const sku = params.get('sku');
  if(!sku) return;
  const products = await loadProducts();
  const p = products.find(x => String(x.sku).toUpperCase() === String(sku).toUpperCase());
  if(!p) return;
  document.getElementById('pSku').textContent = p.sku;
  document.getElementById('pName').textContent = p.name || p.sku;
  document.getElementById('pPrice').textContent = moneyZAR(p.price);
  document.getElementById('pSummary').textContent = p.summary || 'VAT inclusive • PayFast checkout';
  document.getElementById('pImg').src = p.imageUrl || `assets/product/${p.sku}.png`;

  const doc = document.getElementById('pDoc');
  doc.href = p.docUrl || '#';
  const trial = document.getElementById('pTrial');
  trial.href = p.trialUrl || '#';

  const wa = document.getElementById('pWa');
  const cfg = window.WA_CONFIG || {};
  wa.href = waLink(cfg.WHATSAPP_NUMBER||'+27716816131', `Hi, I'm interested in ${p.sku} — ${p.name}`);

  document.getElementById('btnBuy').onclick = ()=>buyNow(p.sku);
}

async function buyNow(sku){
  // Best: request server-side checkout fields
  const cfg = window.WA_CONFIG || {};
  const api = cfg.APPS_SCRIPT_URL;
  const products = await loadProducts();
  const p = products.find(x => String(x.sku).toUpperCase() === String(sku).toUpperCase());
  if(!p) return alert('Product not found');

  // If you implement createPayment on Apps Script, this will auto-submit.
  if(api && !api.includes('AKFY')){
    try{
      const email = prompt('Email for invoice:') || '';
      const url = `${api}?op=createPayment&sku=${encodeURIComponent(sku)}&email=${encodeURIComponent(email)}&env=live`;
      const data = await fetchJson(url);
      if(data && data.processUrl && data.fields){
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.processUrl;
        for(const [k,v] of Object.entries(data.fields)){
          const inp = document.createElement('input');
          inp.type = 'hidden';
          inp.name = k; inp.value = v;
          form.appendChild(inp);
        }
        document.body.appendChild(form);
        form.submit();
        return;
      }
    }catch(e){
      console.warn(e);
    }
  }

  alert('Checkout backend not configured yet. Set WA_CONFIG.APPS_SCRIPT_URL and implement op=createPayment in Apps Script.');
}

function initGlobalCtas(){
  const cfg = window.WA_CONFIG || {};
  const wa = document.getElementById('ctaWhatsApp');
  if(wa) wa.href = waLink(cfg.WHATSAPP_NUMBER||'+27716816131', 'Hi Wykies Automation, I need help.');
}
