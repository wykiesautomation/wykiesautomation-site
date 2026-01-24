const $=(s,e=document)=>e.querySelector(s);
const $$=(s,e=document)=>Array.from(e.querySelectorAll(s));
let CONFIG=null;

async function loadConfig(){
  if(CONFIG) return CONFIG;
  const r=await fetch('assets/js/config.json',{cache:'no-store'});
  CONFIG=await r.json();
  return CONFIG;
}

function toast(msg,type='info'){
  const t=$('#toast');
  if(!t) return;
  t.textContent=msg;
  t.style.borderColor=(type==='error')?'#ef4444':'rgba(148,163,184,.25)';
  t.classList.add('on');
  clearTimeout(window.__t);
  window.__t=setTimeout(()=>t.classList.remove('on'),2600);
}

function jsonpGet(url) {
  return new Promise((resolve, reject) => {
    const cb = 'cb_' + Math.random().toString(36).slice(2);
    const sep = url.includes('?') ? '&' : '?';
    const full = url + sep + 'callback=' + cb + '&_=' + Date.now();

    const script = document.createElement('script');
    script.src = full;
    script.async = true;

    window[cb] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP load failed: ' + full));
    };

    function cleanup() {
      try { delete window[cb]; } catch {}
      if (script && script.parentNode) script.parentNode.removeChild(script);
    }

    document.head.appendChild(script);
  });
}


function moneyZAR(v){
  const n=Number(String(v).replace(/[^0-9.]/g,''));
  return isNaN(n)?String(v??''):'R '+n.toFixed(2);
}

function isHttp(u){return /^https?:\/\//i.test(String(u||''));}
function prodImg(p){
  const u=p.imageUrl||p.ogImage||'';
  if(!u) return 'assets/product/wa-01.PNG';
  return isHttp(u)?u:'assets/product/'+String(u).replace(/^\/?assets\/(product|img)\//,'').replace(/^\//,'');
}

async function apiGet(action, params={}){
  const cfg=await loadConfig();
  const url=new URL(cfg.APPS_SCRIPT_URL);
  url.searchParams.set('action',action);
  for(const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  const r=await fetch(url.toString(),{cache:'no-store'});
  if(!r.ok) throw new Error('API');
  return await r.json();
}

async function apiPost(obj){
  const cfg=await loadConfig();
  const res=await fetch(cfg.APPS_SCRIPT_URL,{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'},
    body:new URLSearchParams(obj)
  });
  const txt=await res.text();
  try{ return JSON.parse(txt); }catch{ return txt; }
}

async function loadSeed(name){
  const r=await fetch('assets/js/'+name,{cache:'no-store'});
  return await r.json();
}

function waLink(sku,name){
  const phone=CONFIG?.WHATSAPP||'27716816131';
  const msg=encodeURIComponent(`Hi Wykies Automation, I would like to order: ${sku} — ${name}`);
  return `https://wa.me/${phone}?text=${msg}`;
}

function detailsUrl(p){
  return p.detailsUrl || `product.html?sku=${encodeURIComponent(p.sku||'')}`;
}

function card(p){
  const active=String(p.active).toLowerCase()!=='false' && p.active!==false;
  if(!active) return '';
  const sku=p.sku||'';
  const name=p.name||'';
  const sum=p.summary||'';
  const img=prodImg(p);
  const docUrl=p.docUrl||'';
  const trialUrl=p.trialUrl||'';
  const pre=String(p.preOrder).toLowerCase()==='true' || p.preOrder===true;
  return `
  <div class="card pad" style="display:flex;flex-direction:column;min-height:100%">
    <img class="prod-img" src="${img}" alt="${name}">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px">
      <div class="pill">${sku}</div><div class="price">${moneyZAR(p.price||'')}</div>
    </div>
    <div style="margin-top:10px"><strong>${name}</strong>${pre?'<span class="pill" style="margin-left:8px;border-color:rgba(245,158,11,.35);color:#fcd34d">Pre‑Order</span>':''}</div>
    <p class="muted" style="line-height:1.5;margin:8px 0 0">${sum}</p>
    <div class="btnrow" style="margin-top:auto">
      <a class="btn outline" href="${detailsUrl(p)}">Details</a>
      ${docUrl?`<a class="btn outline" href="${docUrl}" target="_blank" rel="noopener">View Docs</a>`:''}
      ${trialUrl?`<a class="btn outline" href="${trialUrl}" target="_blank" rel="noopener">Download Trial</a>`:''}
      <a class="btn whatsapp" href="${waLink(sku,name)}" target="_blank" rel="noopener">WhatsApp</a>
      <button class="btn primary" data-buy="1" data-sku="${sku}" data-name="${name}">Buy Now</button>
    </div>
    <div class="small" style="margin-top:10px">Prices are VAT‑inclusive. Secure checkout via PayFast.</div>
  </div>`;
}

function bindBuy(){
  $$('button[data-buy="1"]').forEach(b=>b.onclick=()=>openCheckout(b.dataset.sku,b.dataset.name));
}

let CURRENT=null;
function openCheckout(sku,name){
  CURRENT={sku,name};
  $('#buySku').textContent=sku;
  $('#buyName').textContent=name;
  $('#modalCheckout').classList.add('on');
  $('#buyerEmail').focus();
}
function closeCheckout(){ $('#modalCheckout').classList.remove('on'); }

async function proceedPayFast(){
  const email=$('#buyerEmail').value.trim();
  if(!email) return toast('Please enter your email address','error');
  try{
    $('#btnPay').disabled=true;
    $('#btnPay').textContent='Preparing…';
    const payload=await apiPost({action:'createPayment', sku:CURRENT.sku, email});
    if(!payload || !payload.processUrl || !payload.fields) throw new Error('Bad payment payload');
    const form=document.createElement('form');
    form.method='POST';
    form.action=payload.processUrl;
    for(const [k,v] of Object.entries(payload.fields||{})){
      const i=document.createElement('input');
      i.type='hidden'; i.name=k; i.value=v;
      form.appendChild(i);
    }
    document.body.appendChild(form);
    form.submit();
  }catch(e){
    console.error(e);
    toast('Checkout setup failed. Please order on WhatsApp.','error');
  }finally{
    $('#btnPay').disabled=false;
    $('#btnPay').textContent='Proceed to PayFast';
  }
}

async function renderProducts(){
  const grid=$('#grid');
  if(!grid) return;
  let products=[];
  try{ products=await apiGet('products'); }
  catch{ products=await loadSeed('products.seed.json'); }

  grid.innerHTML=products.map(card).join('');
  bindBuy();

  const sel=$('#docSelect');
  if(sel){
    sel.innerHTML='<option value="">Select a product…</option>' + products
      .filter(p=>String(p.active).toLowerCase()!=='false')
      .map(p=>`<option value="${p.docUrl||''}">${p.sku||''} — ${p.name||''}</option>`).join('');
    sel.onchange=()=>{ const u=sel.value; const b=$('#btnDocDownload'); if(b) b.href=u||'#'; };
  }

  const q=$('#search');
  if(q){
    q.addEventListener('input',()=>{
      const s=q.value.toLowerCase().trim();
      const list=!s?products:products.filter(p=>[p.sku,p.name,p.summary].filter(Boolean).some(v=>String(v).toLowerCase().includes(s)));
      grid.innerHTML=list.map(card).join('');
      bindBuy();
    });
  }
}

async function renderProductDetail(){
  const el=$('#productDetail');
  if(!el) return;
  const qs=new URLSearchParams(location.search);
  const sku=qs.get('sku')||qs.get('id');
  if(!sku){ el.innerHTML='<div class="card pad">Missing product SKU.</div>'; return; }

  let p=null;
  try{ p=await apiGet('product',{sku}); }
  catch{ p=(await loadSeed('products.seed.json')).find(x=>x.sku===sku)||null; }
  if(!p){ el.innerHTML='<div class="card pad">Product not found.</div>'; return; }

  const img=prodImg(p);
  el.innerHTML=`
    <div class="card pad">
      <div class="grid" style="grid-template-columns:1.2fr 1fr;gap:16px">
        <div><img class="prod-img" style="height:280px" src="${img}" alt="${p.name||''}"></div>
        <div>
          <div class="pill">${p.sku||sku}</div>
          <h2 style="margin:10px 0 8px">${p.name||''}</h2>
          <div class="price" style="font-size:22px">${moneyZAR(p.price||'')}</div>
          <p class="muted" style="line-height:1.7">${p.description||p.summary||''}</p>
          <div class="btnrow">
            ${p.docUrl?`<a class="btn outline" href="${p.docUrl}" target="_blank" rel="noopener">View Docs</a>`:''}
            ${p.trialUrl?`<a class="btn outline" href="${p.trialUrl}" target="_blank" rel="noopener">Download Trial</a>`:''}
            <a class="btn whatsapp" href="${waLink(p.sku||sku,p.name||'')}">WhatsApp</a>
            <button class="btn primary" data-buy="1" data-sku="${p.sku||sku}" data-name="${p.name||''}">Buy Now</button>
          </div>
        </div>
      </div>
    </div>`;
  bindBuy();
}

async function renderGallery(){
  const grid=$('#galleryGrid');
  if(!grid) return;
  let items=[];
  try{ items=await apiGet('gallery'); }
  catch{ items=await loadSeed('gallery.seed.json'); }

  items=(items||[]).filter(x=>String(x.active).toLowerCase()!=='false');
  items.sort((a,b)=> (Number(a.sortOrder||0)-Number(b.sortOrder||0)) || String(a.id||'').localeCompare(String(b.id||'')));

  if(!items.length){ grid.innerHTML='<div class="card pad">No gallery items yet.</div>'; return; }

  grid.innerHTML=items.map(it=>{
    const url=String(it.imageUrl||'');
    const src=isHttp(url)?url:url.replace(/^\//,'');
    const cap=String(it.caption||it.filename||'');
    return `
      <a class="card pad" style="text-decoration:none" href="${src}" target="_blank" rel="noopener">
        <img class="prod-img" src="${src}" alt="${cap}">
        <div style="margin-top:10px"><strong>${cap}</strong></div>
      </a>`;
  }).join('');
}

async function renderTrialList(){
  const box=$('#trialList');
  if(!box) return;
  let products=[];
  try{ products=await apiGet('products'); }
  catch{ products=await loadSeed('products.seed.json'); }
  const list=products.filter(p=>p.trialUrl).sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0));
  if(!list.length){ box.innerHTML='<div class="muted">No trial links configured.</div>'; return; }
  box.innerHTML='<ul style="margin:0;padding-left:18px">'+list.map(p=>
    `<li style="margin:10px 0"><span class="kbd">${p.sku}</span> <a class="btn outline" style="margin-left:10px" href="${p.trialUrl}" target="_blank" rel="noopener">Download Trial</a> <span class="muted" style="margin-left:10px">${p.name||''}</span></li>`
  ).join('')+'</ul>';
}

async function loadPriceList(){
  const b=$('#btnPriceList');
  if(!b) return;
  try{ const s=await apiGet('settings'); if(s&&s.priceList){ b.href=s.priceList; b.target='_blank'; b.rel='noopener'; } }
  catch{}
}

async function bindContact(){
  const f=$('#contactForm');
  if(!f) return;
  f.addEventListener('submit',async e=>{
    e.preventDefault();
    const d=new FormData(f);
    try{
      const r=await apiPost({action:'contact', name:d.get('name'), email:d.get('email'), message:d.get('message')});
      $('#contactMsg').textContent=String(r).includes('OK')?'Thanks — we’ll get back to you shortly.':'Sent.';
      f.reset();
    }catch(err){
      console.error(err);
      $('#contactMsg').textContent='Could not send right now. Please WhatsApp us.';
    }
  });
}

function bindModal(){
  const m=$('#modalCheckout');
  if(!m) return;
  $('#btnCloseModal').onclick=closeCheckout;
  m.addEventListener('click',e=>{ if(e.target===m) closeCheckout(); });
  $('#btnPay').onclick=proceedPayFast;
}

async function init(){
  await loadConfig();
  $$('#adminLink').forEach(a=>a.href=CONFIG.ADMIN_URL);
  bindModal();
  await loadPriceList();
  await renderProducts();
  await renderProductDetail();
  await renderGallery();
  await renderTrialList();
  await bindContact();
}

document.addEventListener('DOMContentLoaded', init);
