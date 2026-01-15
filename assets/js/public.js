// Public site script (CMS via Google Apps Script)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxj61ify3rtv-e-jc3c2Xajn1hs_AhhWXaUgl-hSoVu02uzI3yPVEelsxRXxxm1ln_w/exec';

async function gas(action, params={}){
  try{
    const url = new URL(GAS_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k,v])=> url.searchParams.set(k, v));

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if(!res.ok) return null;

    // Read as text then JSON parse (avoids hard crashes on non-JSON)
    const txt = await res.text();
    try{ return JSON.parse(txt); } catch(e){ return null; }

  }catch(err){
    // If CORS blocks or network fails, we return null so fallback products still render.
    console.warn('GAS fetch failed:', err);
    return null;
  }
}

function el(tag, attrs={}, ...children){
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k==='class') e.className = v;
    else if(k==='html') e.innerHTML=v;
    else if(k==='onclick') e.onclick = v;
    else e.setAttribute(k,v);
  });
  children.flat().filter(Boolean).forEach(c=> e.appendChild(typeof c==='string'? document.createTextNode(c): c));
  return e;
}

function moneyZAR(v){
  if(v==null || v==='') return '—';
  const n = parseFloat(String(v).replace(/[^0-9.]/g,''));
  if(Number.isNaN(n)) return v;
  return 'R ' + n.toLocaleString('en-ZA', {minimumFractionDigits:0, maximumFractionDigits:0});
}

function preselectDocsSku(sku){
  const docSelect = document.getElementById('docSelect');
  const btnDoc = document.getElementById('btnDocDownload');
  if(!docSelect) return;
  const opts = [...docSelect.options];
  const match = opts.find(o => (o.textContent||'').trim().startsWith(sku));
  if(match){
    docSelect.value = match.value;
    if(btnDoc) btnDoc.href = match.value || '#';
  }
}

function ensureHint_(id, parent){
  let n = document.getElementById(id);
  if(!n){
    n = document.createElement('div');
    n.id = id;
    n.className = 'muted';
    n.style.marginTop = '8px';
    n.style.fontSize = '12px';
    parent && parent.appendChild(n);
  }
  return n;
}

async function loadProducts(){
  const grid = document.getElementById('grid');
  if(!grid) return;

  let data = await gas('products');
  if(!data || !Array.isArray(data.products)) data = {products:[]};

  // Fallback catalog so UI never looks empty
  if(!data.products || data.products.length === 0){
    data.products = [
      {sku:'WA-01', name:'3D Printer Control V1', price:1499, summary:'Advanced control system', imageUrl:'wa-01.PNG', trialUrl:'#', docUrl:'', active:true, preOrder:false, buyEnabled:false},
      {sku:'WA-02', name:'Plasma Cutter Control V1', price:2499, summary:'CNC plasma cutter GUI', imageUrl:'wa-02.PNG', trialUrl:'#', docUrl:'', active:true, preOrder:false, buyEnabled:false},
      {sku:'WA-03', name:'ECU/TCU Control System V1', price:6499, summary:'ECU/TCU control system', imageUrl:'wa-03.png', trialUrl:'#', docUrl:'', active:true, preOrder:false, buyEnabled:false},
      {sku:'WA-04', name:'Fridge/Freezer Control V1', price:899, summary:'Appliance controller', imageUrl:'wa-04.PNG', trialUrl:'#', docUrl:'', active:true, preOrder:false, buyEnabled:false},
      {sku:'WA-05', name:'Nano GSM Gate Controller V1', price:800, summary:'Compact GSM gate controller', imageUrl:'wa-05.PNG', trialUrl:'#', docUrl:'', active:true, preOrder:false, buyEnabled:false},
      {sku:'WA-06', name:'Solar Energy Management System V1', price:3999, summary:'PV & battery manager', imageUrl:'wa-06.PNG', trialUrl:'#', docUrl:'', active:true, preOrder:false, buyEnabled:false},
      {sku:'WA-07', name:'Hybrid Gate Controller V1', price:1800, summary:'Wi‑Fi + GSM gate controller', imageUrl:'wa-07.PNG', trialUrl:'#', docUrl:'', active:true, preOrder:false, buyEnabled:false},
      {sku:'WA-08', name:'Smart Battery Charger V1', price:999, summary:'Smart charger controller', imageUrl:'wa-08.PNG', trialUrl:'#', docUrl:'', active:true, preOrder:false, buyEnabled:false},
      {sku:'WA-10', name:'12CH Hybrid Alarm V1', price:1299, summary:'Hybrid alarm system', imageUrl:'wa-10.PNG', trialUrl:'#', docUrl:'', active:true, preOrder:false, buyEnabled:false},
      {sku:'WA-11', name:'16CH Hybrid Alarm V1', price:5499, summary:'Hybrid alarm system', imageUrl:'wa-11.PNG', trialUrl:'#', docUrl:'', active:true, preOrder:false, buyEnabled:false},
      {sku:'WA-12', name:'TCU Gearbox Controller V1', price:4500, summary:'TCU controller', imageUrl:'wa-12.PNG', trialUrl:'#', docUrl:'', active:true, preOrder:true, buyEnabled:false},
    ];
  }

  const products = (data.products||[]).filter(p => String(p.active) !== 'false');

  // Variant 1: hide search if <=12 products
  const searchBox = document.getElementById('search');
  if(searchBox){
    searchBox.style.display = (products.length > 12) ? 'block' : 'none';
  }

  const docSelect = document.getElementById('docSelect');
  const docHint = ensureHint_('docHint', docSelect ? docSelect.parentElement : null);

  function render(list){
    grid.innerHTML = '';
    list.forEach(p=>{
      const card = el('article', {class:'card product-card'});
      const thumb = el('div', {class:'product-thumb'}, el('img', {src:p.imageUrl||'wa-01.PNG', alt:(p.name||p.sku), loading:'lazy'}));
      const body = el('div', {class:'product-body'});

      body.appendChild(el('div', {class:'badges'},
        el('span', {class:'badge price'}, moneyZAR(p.price)),
        (String(p.preOrder)==='true'||p.preOrder===true) ? el('span', {class:'badge pre'}, 'Pre‑Order') : null
      ));

      body.appendChild(el('h3', {}, p.name||''));
      body.appendChild(el('div', {class:'muted'}, p.sku||''));
      body.appendChild(el('p', {class:'muted'}, p.summary||''));

      const actions = el('div', {class:'product-actions'});
      actions.appendChild(el('a', {class:'btn', href:(p.detailsUrl||'#')}, 'View Details'));

      const viewDocs = el('a', {class:'btn', href:'#documents'}, 'View Docs');
      viewDocs.onclick = (e)=>{
        e.preventDefault();
        if(p.docUrl){
          window.open(p.docUrl, '_blank');
          return;
        }
        preselectDocsSku(p.sku);
        document.getElementById('documents')?.scrollIntoView({behavior:'smooth'});
        if(docHint) docHint.textContent = 'Docs link not set yet for this product.';
      };
      actions.appendChild(viewDocs);

      actions.appendChild(el('a', {class:'btn', href:(p.trialUrl||'#'), target:'_blank'}, 'Download Trial'));

      if(String(p.buyEnabled) !== 'false'){
        const buy = el('button', {class:'btn primary'}, 'Buy Now');
        buy.onclick = async ()=>{
          const resp = await gas('createCheckout', { sku: p.sku });
          if(resp && resp.pfUrl) window.location.href = resp.pfUrl;
          else alert('Checkout not available yet — WhatsApp us to order.');
        };
        actions.appendChild(buy);
      }

      card.appendChild(thumb);
      card.appendChild(body);
      card.appendChild(actions);
      grid.appendChild(card);
    });
  }

  render(products);

  // Search (debounced)
  const search = document.getElementById('search');
  let t;
  if(search){
    search.addEventListener('input', (e)=>{
      clearTimeout(t);
      t = setTimeout(()=>{
        const q = e.target.value.trim().toLowerCase();
        const filtered = products.filter(p => (`${p.sku} ${p.name} ${p.summary||''}`.toLowerCase().includes(q)));
        render(filtered);
      }, 150);
    });
  }

  // Documents dropdown
  const btnDoc = document.getElementById('btnDocDownload');
  const btnPrice = document.getElementById('btnPriceList');

  if(docSelect && btnDoc){
    docSelect.innerHTML = products.map(p=> `<option value="${p.docUrl||''}">${p.sku} — ${p.name}</option>`).join('');

    const update = ()=>{
      const url = docSelect.value || '';
      if(url){
        btnDoc.href = url;
        btnDoc.classList.remove('disabled');
        btnDoc.style.pointerEvents = 'auto';
        btnDoc.style.opacity = '1';
        if(docHint) docHint.textContent = '';
      } else {
        btnDoc.href = '#';
        btnDoc.classList.add('disabled');
        btnDoc.style.pointerEvents = 'none';
        btnDoc.style.opacity = '.6';
        if(docHint) docHint.textContent = 'Docs link not set yet for this product.';
      }
    };

    docSelect.onchange = update;
    update();

    const urlSku = new URL(window.location.href).searchParams.get('sku');
    if(urlSku) preselectDocsSku(urlSku);
    update();
  }

  // Settings (price list)
  const st = await gas('settings');
  if(st && st.priceListUrl && btnPrice) btnPrice.href = st.priceListUrl;
}

window.WA_initGallery = function(){
  const grid = document.getElementById('gallery');
  if(!grid) return;
  const imgs = ['wa-01.PNG','wa-02.PNG','wa-03.png','wa-04.PNG','wa-05.PNG','wa-06.PNG','wa-07.PNG','wa-08.PNG','wa-10.PNG','wa-11.PNG','wa-12.PNG'];
  grid.innerHTML = '';
  imgs.forEach(src=>{
    const a = document.createElement('a');
    a.href = src;
    const img = document.createElement('img');
    img.src = src;
    img.alt = src;
    img.loading = 'lazy';
    a.appendChild(img);
    grid.appendChild(a);
  });
};

const form = document.getElementById('contactForm');
if(form){
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    const msg = document.getElementById('contactMsg');
    const r = await gas('contact', payload);
    if(msg) msg.textContent = (r && r.ok) ? 'Sent. We will reply shortly.' : 'Sent.';
    form.reset();
  });
}

loadProducts();
