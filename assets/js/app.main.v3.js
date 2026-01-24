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
  window.__t=setTimeout(()=>t.classList.remove('on'),2800);
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

async function loadSeed(name){
  const r=await fetch('assets/js/'+name,{cache:'no-store'});
  return await r.json();
}

// JSONP loader: avoids CORS because it loads via <script src="...">.
async function apiJsonp(action, params={}){
  const cfg = await loadConfig();
  return new Promise((resolve,reject)=>{
    const cb = '__wa_cb_' + Math.random().toString(16).slice(2);
    const url = new URL(cfg.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('prefix', cb);
    Object.entries(params).forEach(([k,v])=> url.searchParams.set(k, v));

    const script = document.createElement('script');
    const timer = setTimeout(()=>{
      cleanup();
      reject(new Error('JSONP timeout'));
    }, 8000);

    function cleanup(){
      clearTimeout(timer);
      try{ delete window[cb]; }catch(e){}
      if(script && script.parentNode) script.parentNode.removeChild(script);
    }

    window[cb] = (data)=>{ cleanup(); resolve(data); };
    script.onerror = ()=>{ cleanup(); reject(new Error('JSONP error')); };
    script.src = url.toString();
    document.body.appendChild(script);
  });
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
  const cfg = await loadConfig();
  const f=document.createElement('form');
  f.method='POST';
  f.action=cfg.APPS_SCRIPT_URL;
  const add=(k,v)=>{const i=document.createElement('input'); i.type='hidden'; i.name=k; i.value=v; f.appendChild(i);};
  add('action','checkout');
  add('sku', CURRENT.sku);
  add('email', email);
  add('return', window.location.origin + '/payment-success.html');
  add('cancel', window.location.origin + '/payment-cancel.html');
  document.body.appendChild(f);
  f.submit();
}

async function renderProducts(){
  const grid=$('#grid');
  if(!grid) return;

  let products=[];
  try{ products = await apiJsonp('products'); }
  catch{ products = await loadSeed('products.seed.json'); }

  products.sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0));
  grid.innerHTML=products.map(card).join('');
  bindBuy();

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
  try{ p = await apiJsonp('product',{sku}); }
  catch{
    const products=await loadSeed('products.seed.json');
    p = products.find(x=>String(x.sku)===String(sku))||null;
  }
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
            <a class="btn whatsapp" href="${waLink(p.sku||sku,p.name||'')}">WhatsApp</a>
            <button class="btn primary" data-buy="1" data-sku="${p.sku||sku}" data-name="${p.name||''}">Buy Now</button>
          </div>
        </div>
      </div>
    </div>`;
  bindBuy();
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
  bindModal();
  await renderProducts();
  await renderProductDetail();
}

document.addEventListener('DOMContentLoaded', init);
