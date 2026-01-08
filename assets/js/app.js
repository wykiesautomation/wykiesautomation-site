
// Config
let CONFIG = {};
fetch('config.json').then(r=>r.json()).then(cfg=>{CONFIG = cfg;});

// Simulated products (replace via CMS later)
const PRODUCTS = [
 {sku:'WA-01', name:'3D Printer Control System', price:'R1,499', image:'wa-01.png'},
 {sku:'WA-02', name:'Plasma Cutter Control System', price:'R2,499', image:'wa-02.png'},
 {sku:'WA-03', name:'ECU/TCU Control System', price:'R6,499', image:'wa-03.png'},
 {sku:'WA-04', name:'Fridge/Freezer Control System', price:'R899',  image:'wa-04.png'},
 {sku:'WA-05', name:'Nano GSM Gate Controller',     price:'R800',  image:'wa-05.png'},
 {sku:'WA-06', name:'Solar Energy Management',      price:'R3,999',image:'wa-06.png'},
 {sku:'WA-07', name:'Hybrid Gate Controller',       price:'R1,800',image:'wa-07.png'},
 {sku:'WA-08', name:'Smart Battery Charger',        price:'R999',  image:'wa-08.png'},
 {sku:'WA-10', name:'12CH Hybrid Alarm',            price:'R1,299',image:'wa-10.png'},
 {sku:'WA-11', name:'16CH Hybrid Alarm',            price:'R5,499',image:'wa-11.png'},
 {sku:'WA-12', name:'TCU Gearbox Controller',       price:'R4,500',image:'wa-12.png'}
];

// ----- Public: build product grid -----
(function buildPublic(){
  const grid = document.getElementById('product-grid');
  if(grid){
    grid.innerHTML = '';
    PRODUCTS.forEach(p=>{
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <img src="assets/images/${p.image}" alt="${p.name}" loading="lazy">
        <h3>${p.name}</h3>
        <p>${p.price} incl VAT</p>
        <a class="btn btn-primary" href="#" data-sku="${p.sku}" onclick="return buyNow(event)">Buy Now</a>
        <a class="btn btn-outline" href="#" onclick="return openDoc('${p.sku}')">Download Docs</a>
        <a class="btn btn-outline" href="#" onclick="return openTrial('${p.sku}')">Download Trial</a>`;
      grid.appendChild(card);
    });
  }
  const gp = document.getElementById('gallery-preview');
  if(gp){
    ['wa-01.png','wa-02.png','wa-03.png','wa-04.png','wa-05.png','wa-06.png'].forEach(img=>{
      const i = document.createElement('img');
      i.src = `assets/images/${img}`; i.alt = 'Preview'; i.onclick = ()=>openLightbox(i.src);
      gp.appendChild(i);
    });
  }
})();

// ----- Admin: tab switching + render tables -----
(function adminInit(){
  const tabs = document.querySelectorAll('.admin-nav a');
  const sections = document.querySelectorAll('.tab');
  if(tabs.length){
    tabs.forEach(a=>{
      a.addEventListener('click',()=>{
        tabs.forEach(t=>t.classList.remove('active')); a.classList.add('active');
        sections.forEach(s=>s.classList.remove('active'));
        const id = 'tab-'+a.dataset.tab; document.getElementById(id).classList.add('active');
      });
    });
  }
  // Catalog table
  const tbody = document.getElementById('catalog-body');
  if(tbody){
    tbody.innerHTML = '';
    PRODUCTS.forEach(p=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.sku}</td><td>${p.name}</td><td>${p.price}</td><td><img src="../assets/images/${p.image}" alt="${p.name}" style="height:32px;border-radius:6px"></td><td>Active</td><td><button onclick="editProduct('${p.sku}')">Edit</button> <button onclick="deleteProduct('${p.sku}')">Delete</button></td>`;
      tbody.appendChild(tr);
    });
  }
  // Price log (sample)
  const pbody = document.getElementById('price-body');
  if(pbody){
    pbody.innerHTML = `<tr><td>${new Date().toLocaleString()}</td><td>WA-01</td><td>R1,299</td><td>R1,499</td><td>Admin</td><td>Initial price set</td></tr>`;
  }
  // Payments (sample)
  const payBody = document.getElementById('payments-body');
  if(payBody){
    payBody.innerHTML = `<tr><td>${new Date().toLocaleDateString()}</td><td>INV-2026-00001</td><td>customer@example.com</td><td>R1,499</td><td>Paid</td><td><button onclick="resendInvoice('INV-2026-00001')">Resend Invoice</button></td></tr>`;
  }
  // Audit (sample)
  const aBody = document.getElementById('audit-body');
  if(aBody){
    aBody.innerHTML = `<tr><td>${new Date().toLocaleString()}</td><td>viewer@example.com</td><td>Login</td><td>Session</td><td>OK</td></tr>`;
  }
  // Gallery (admin)
  const g = document.getElementById('admin-gallery');
  if(g){
    ['wa-01.png','wa-02.png','wa-03.png','wa-04.png','wa-05.png','wa-06.png','wa-07.png','wa-08.png','wa-10.png','wa-11.png','wa-12.png'].forEach(img=>{
      const i = document.createElement('img'); i.src = `../assets/images/${img}`; i.alt = 'Preview'; i.onclick=()=>openLightbox(i.src); g.appendChild(i);
    });
  }
})();

// ----- Modal controls -----
const modal = document.getElementById('modal');
function editProduct(sku){
  const p = PRODUCTS.find(x=>x.sku===sku); if(!p) return;
  document.getElementById('modal-title').innerText = 'Edit Product';
  document.getElementById('m-sku').value = p.sku;
  document.getElementById('m-name').value = p.name;
  document.getElementById('m-price').value = p.price.replace(/R|\,/g,'');
  document.getElementById('m-image').value = p.image;
  modal.classList.remove('hidden');
}
function deleteProduct(sku){
  alert('This is a demo: delete '+sku+' will be implemented via CMS backend.');
}
const btnAdd = document.getElementById('btn-add');
if(btnAdd){ btnAdd.onclick = ()=>{ document.getElementById('modal-title').innerText = 'Add Product'; modal.classList.remove('hidden'); }; }
const mCancel = document.getElementById('m-cancel'); if(mCancel){ mCancel.onclick = ()=>modal.classList.add('hidden'); }
const mSave = document.getElementById('m-save'); if(mSave){ mSave.onclick = ()=>{ modal.classList.add('hidden'); alert('Saved (demo). Wire to Apps Script add/updateProduct next.'); }; }

// ----- Pages (Markdown) preview (very basic) -----
function mdToHtml(md){
  return md.replace(/^## (.*$)/gim,'<h2>$1</h2>')
           .replace(/^# (.*$)/gim,'<h1>$1</h1>')
           .replace(/\*\*(.*)\*\*/gim,'<b>$1</b>')
           .replace(/\*(.*)\*/gim,'<i>$1</i>')
           .replace(/\n/g,'<br>');
}
const btnPrev = document.getElementById('btn-preview');
if(btnPrev){ btnPrev.onclick = ()=>{ const md = document.getElementById('page-body').value; document.getElementById('page-preview').innerHTML = mdToHtml(md); } }
const btnSavePage = document.getElementById('btn-save');
if(btnSavePage){ btnSavePage.onclick = ()=>{ alert('Saved (demo). Wire to Apps Script updatePage next.'); } }

// ----- Settings -----
const btnSaveSettings = document.getElementById('btn-save-settings');
if(btnSaveSettings){ btnSaveSettings.onclick = ()=>{ alert('Settings saved (demo). Wire to Apps Script next.'); } }

// ----- Payments -----
function resendInvoice(inv){ alert('Resend invoice (demo) for '+inv+'. Wire to Apps Script ITN/Email next.'); }

// ----- Lightbox -----
function openLightbox(src){ const lb = document.getElementById('lightbox'); const img = document.getElementById('lightbox-img'); if(lb && img){ img.src = src; lb.classList.remove('hidden'); lb.onclick = ()=>lb.classList.add('hidden'); } }

// ----- Buttons (public) -----
function buyNow(e){ e.preventDefault(); const sku = e.target.dataset.sku; alert('Buy Now (demo) for '+sku+' — will call Apps Script to create PayFast redirect securely.'); return false; }
function openDoc(sku){ alert('Open Docs (demo) for '+sku+'. Replace with Drive link.'); return false; }
function openTrial(sku){ alert('Open Trial (demo) for '+sku+'. Replace with Drive link.'); return false; }

// Smooth scroll for .scroll links
Array.from(document.querySelectorAll('a.scroll')).forEach(a=>a.addEventListener('click',e=>{e.preventDefault(); const id=a.getAttribute('href').replace('#',''); const el=document.getElementById(id); if(el){ el.scrollIntoView({behavior:'smooth'}); }}));
