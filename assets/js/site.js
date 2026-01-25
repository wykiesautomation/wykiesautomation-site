// Public site JS (WykiesAutomation.co.za)
const CONFIG = {
  APPS_SCRIPT_URLS: [
    'https://script.google.com/macros/s/AKfycbxj61ify3rtv-e-jc3c2Xajn1hs_AhhWXaUgl-hSoVu02uzI3yPVEelsxRXxxm1ln_w/exec',
    'https://script.google.com/macros/s/AKfycbwO16jzeQVcsNt4zOj-YQ8LndsMgaTk089QZkgkb0YrxVf8IbxQi9fnK_1mL9q83d8_LA/exec'
  ],
  PHONE_WHATSAPP: '+27716816131',
  PAYFAST_PROCESS_URL: 'https://www.payfast.co.za/eng/process',
  MERCHANT_ID: '32913011',
  MERCHANT_KEY: '8wd7iwcgippud',
  NOTIFY_URL: null
};

const $ = (s, r=document) => r.querySelector(s);
const fmtR = v => 'R ' + Number(v||0).toFixed(2);
function qp(key){ return new URL(location.href).searchParams.get(key); }
function wa(msg){
  return `https://wa.me/${CONFIG.PHONE_WHATSAPP.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(msg)}`;
}
async function fetchAny(urls){
  for(const u of urls){
    try{ const r = await fetch(u, {cache:'no-store'}); if(r.ok) return r; } catch(e){}
  }
  throw new Error('All endpoints failed');
}
async function getProducts(){
  try{ const r=await fetchAny(CONFIG.APPS_SCRIPT_URLS.map(u=>`${u}?op=products`)); return await r.json(); }
  catch(e){
    try{ const r=await fetchAny(CONFIG.APPS_SCRIPT_URLS.map(u=>`${u}?action=products`)); return await r.json(); }
    catch(e){ const r=await fetch('/data/products.json',{cache:'no-store'}); return await r.json(); }
  }
}
async function getProduct(sku){
  try{ const r=await fetchAny(CONFIG.APPS_SCRIPT_URLS.map(u=>`${u}?op=product&sku=${encodeURIComponent(sku)}`)); return await r.json(); }
  catch(e){
    try{ const r=await fetchAny(CONFIG.APPS_SCRIPT_URLS.map(u=>`${u}?action=product&sku=${encodeURIComponent(sku)}`)); return await r.json(); }
    catch(e){ const list=await getProducts(); return list.find(p=>String(p.sku).toLowerCase()===String(sku).toLowerCase()); }
  }
}

function setWhatsApp(extra=''){
  const base = 'Hi, I\'m interested in Wykies Automation products.' + (extra?(' ' + extra):'');
  const a1=document.getElementById('whatsappCTA');
  const a2=document.getElementById('whatsappCTAHero');
  if(a1) a1.href = wa(base);
  if(a2) a2.href = wa(base);
}
setWhatsApp('');

function cardHTML(p){
  const img = p.imageUrl || `/assets/product/${String(p.sku||'').toLowerCase()}.png`;
  const price = Number(String(p.price||'').replace(/[^0-9.]/g,''));
  const name = p.name || p.sku;
  const pre = String(p.preOrder||'').toLowerCase()==='true' || p.preOrder===true;
  return `
    <div class="card">
      <img src="${img}" alt="${name}" style="width:100%;height:160px;object-fit:cover;background:#0b1220" onerror="this.style.display='none'">
      <div class="p">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
          <h3 style="margin:0">${name}</h3>
          <div class="price">${fmtR(price)}</div>
        </div>
        ${pre?'<div class="notice" style="margin-top:8px">Pre‑Order</div>':''}
        <div style="display:flex;gap:8px;margin-top:10px">
          <a class="btn btn-primary" href="/product.html?id=${encodeURIComponent(p.sku)}">Buy</a>
          <a class="btn" href="/docs.html">Docs</a>
        </div>
      </div>
    </div>`;
}

window.WA = {
  async renderFeatured(sel){
    const el=$(sel); if(!el) return;
    const list=(await getProducts()||[]).filter(p=>String(p.active).toLowerCase()==='true' || p.active===true);
    el.innerHTML=list.slice(0,8).map(cardHTML).join('');
  },
  async renderGrid(sel, q){
    const el=$(sel); if(!el) return;
    const list=await getProducts();
    const qq=(q||'').trim().toLowerCase();
    const filt=!qq?list:list.filter(p=>[p.sku,p.name,p.summary].filter(Boolean).some(v=>String(v).toLowerCase().includes(qq)));
    el.innerHTML=filt.map(cardHTML).join('') || '<div class="notice">No products found.</div>';
  },
  async renderProduct(sel){
    const el=$(sel); const sku=qp('id');
    if(!sku){ el.innerHTML='<div class="notice">Missing SKU</div>'; return; }
    const p=await getProduct(sku);
    if(!p){ el.innerHTML='<div class="notice">Product not found</div>'; return; }

    const img = p.imageUrl || `/assets/product/${String(p.sku).toLowerCase()}.png`;
    const price = Number(String(p.price||'').replace(/[^0-9.]/g,''));
    const itemName = p.name || p.sku;
    const returnUrl = location.origin + '/products.html';
    const cancelUrl = location.origin + '/product.html?id=' + encodeURIComponent(p.sku);
    const notifyUrl = CONFIG.NOTIFY_URL || (CONFIG.APPS_SCRIPT_URLS[0] + '?itn=1');

    setWhatsApp(`Product: ${p.sku} ${itemName}`);

    el.innerHTML = `
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:24px">
        <div class="card"><img src="${img}" alt="${itemName}" style="width:100%;height:auto" onerror="this.style.display='none'"></div>
        <div>
          <h1 style="margin:0 0 6px">${itemName}</h1>
          <div class="price" style="margin:0 0 10px">${fmtR(price)}</div>
          <p>${p.summary||''}</p>
          <form method="post" action="${CONFIG.PAYFAST_PROCESS_URL}" style="margin:16px 0">
            <input type="hidden" name="merchant_id" value="${CONFIG.MERCHANT_ID}">
            <input type="hidden" name="merchant_key" value="${CONFIG.MERCHANT_KEY}">
            <input type="hidden" name="amount" value="${price.toFixed(2)}">
            <input type="hidden" name="item_name" value="${itemName}">
            <input type="hidden" name="return_url" value="${returnUrl}">
            <input type="hidden" name="cancel_url" value="${cancelUrl}">
            <input type="hidden" name="notify_url" value="${notifyUrl}">
            <input type="hidden" name="custom_str1" value="${p.sku}">
            <label class="label">Your email (for invoice & delivery)</label>
            <input class="input" type="email" name="email_address" required placeholder="you@example.com">
            <div style="margin-top:12px"><button class="btn btn-primary" type="submit">Buy Now via PayFast</button></div>
          </form>
          <div class="notice">Secure checkout is handled by PayFast. You’ll receive a PDF invoice by email after verified payment (ITN).</div>
        </div>
      </div>`;
  },
  async renderDocs(sel){
    const el=$(sel); if(!el) return;
    const r=await fetch('/data/docs.json',{cache:'no-store'});
    const docs=await r.json();
    el.innerHTML = Object.keys(docs).sort().map(k=>{
      const v=docs[k];
      return `<div class="card"><div class="p"><h3 style="margin:0 0 8px">${k}</h3><a class="btn" href="${v}" target="_blank" rel="noopener">Open Drive folder</a></div></div>`;
    }).join('');
  },
  async renderTrials(sel){
    const el=$(sel); if(!el) return;
    const r=await fetch('/data/trials.json',{cache:'no-store'});
    const list=await r.json();
    el.innerHTML = list.map(t=>`<div class="card"><div class="p"><h3>${t.name}</h3><a class="btn btn-primary" href="${t.url}" target="_blank" rel="noopener">Download</a></div></div>`).join('');
  }
};
