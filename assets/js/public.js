
const PRODUCTS = [
  {sku:'WA-05', name:'Nano GSM Gate Controller V1', price:'R800', summary:'Compact GSM gate controller', img:'assets/img/wa-05.png', docs:'#', trial:'#', preorder:false},
  {sku:'WA-01', name:'3D Printer Control V1', price:'R1,499', summary:'Advanced control system', img:'assets/img/wa-01.png', docs:'#', trial:'#', preorder:true},
  {sku:'WA-03', name:'ECU/TCU Control System V1', price:'R6,499', summary:'FIC/TCV control system', img:'assets/img/wa-03.png', docs:'#', trial:'#', preorder:false}
];

// Recommended (spec-aligned) gallery schema from Google Sheets via Cloudflare Worker:
// [{ orderIndex:number, src:string, caption:string, active:boolean }]
const GALLERY_ENDPOINT = '/api/gallery';

let GALLERY = [];

function sanitizeCaption(s){
  return String(s || '').replace(/<[^>]*>/g,'').slice(0,120);
}

async function fetchJson(url){
  const res = await fetch(url, { cache:'no-store' });
  if(!res.ok) throw new Error('HTTP '+res.status);
  return await res.json();
}

async function loadGalleryData(){
  try {
    const data = await fetchJson(GALLERY_ENDPOINT);
    // Accept either Worker output directly or Apps Script output forwarded
    const arr = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
    GALLERY = arr
      .map(x => ({
        orderIndex: Number(x.orderIndex ?? x.order ?? 9999),
        src: String(x.src || x.imageUrl || '').trim(),
        caption: sanitizeCaption(x.caption),
        active: (x.active === undefined) ? true : !!x.active
      }))
      .filter(x => x.src && x.active)
      .sort((a,b)=> a.orderIndex - b.orderIndex);
  } catch (e) {
    // Fallback to local JSON (editable in repo)
    try {
      const data = await fetchJson('data/gallery.json');
      GALLERY = (Array.isArray(data) ? data : []).map(x => ({
        orderIndex: Number(x.orderIndex ?? 9999),
        src: String(x.src || '').trim(),
        caption: sanitizeCaption(x.caption),
        active: (x.active === undefined) ? true : !!x.active
      })).filter(x => x.src && x.active).sort((a,b)=>a.orderIndex-b.orderIndex);
    } catch {
      // Final fallback
      GALLERY = [
        {orderIndex:1, src:'assets/img/gallery-01.png', caption:'Wykies Automation — Gallery 1', active:true},
        {orderIndex:2, src:'assets/img/gallery-02.png', caption:'Wykies Automation — Gallery 2', active:true},
        {orderIndex:3, src:'assets/img/gallery-03.png', caption:'Wykies Automation — Gallery 3', active:true},
        {orderIndex:4, src:'assets/img/gallery-04.png', caption:'Wykies Automation — Gallery 4', active:true},
        {orderIndex:5, src:'assets/img/gallery-05.png', caption:'Wykies Automation — Gallery 5', active:true}
      ];
    }
  }
}

function card(p){
  return `
  <div class="card">
    <div class="body">
      <div class="badges">
        <span class="badge price">${p.price}</span>
        ${p.preorder?'<span class="badge pre">Pre‑Order</span>':''}
      </div>
      <div class="card-head">
        <div class="card-meta">
          <div class="title">${p.name}</div>
          <div class="sku">${p.sku}</div>
          <div style="margin:10px 0;color:#cbd5e1">${p.summary}</div>
        </div>
        <img class="cardimg" src="${p.img}" alt="${p.sku} image" loading="lazy"/>
      </div>
      <div class="actions">
        <a class="btn primary" href="#">View Details</a>
        <a class="btn" href="${p.docs}">View Docs</a>
        <a class="btn" href="${p.trial}">Download Trial</a>
      </div>
    </div>
  </div>`
}

function render(list){
  document.getElementById('productGrid').innerHTML = list.map(card).join('');
  document.getElementById('gallery').innerHTML = GALLERY.map((g,i)=>
    `<img src="${g.src}" data-idx="${i}" alt="${g.caption || 'gallery image'}" loading="lazy"/>`
  ).join('');
}

function filterProducts(){
  const q = document.getElementById('search').value.toLowerCase().trim();
  const filtered = !q ? PRODUCTS : PRODUCTS.filter(p=> (p.name+p.summary+p.sku).toLowerCase().includes(q));
  render(filtered);
}

document.getElementById('searchBtn').addEventListener('click', filterProducts);
document.getElementById('search').addEventListener('input', ()=>{clearTimeout(window.__t); window.__t=setTimeout(filterProducts, 180);});

// --- Lightbox (captions + preload) ---
let __lbIndex = 0;
let __lbOpen = false;

function preloadImage(src){
  const im = new Image();
  im.decoding = 'async';
  im.loading = 'eager';
  im.src = src;
}

function preloadAround(index){
  const n = GALLERY.length;
  if(!n) return;
  const prev = (index - 1 + n) % n;
  const next = (index + 1) % n;
  preloadImage(GALLERY[index].src);
  preloadImage(GALLERY[prev].src);
  preloadImage(GALLERY[next].src);
}

function openLightbox(i){
  const overlay = document.getElementById('lightbox');
  const img = document.getElementById('lbImg');
  const title = document.getElementById('lbTitle');
  const caption = document.getElementById('lbCaption');

  __lbIndex = (i + GALLERY.length) % GALLERY.length;
  const item = GALLERY[__lbIndex];
  img.src = item.src;
  img.alt = item.caption || `Gallery image ${__lbIndex+1}`;
  title.textContent = `Gallery · ${__lbIndex+1} / ${GALLERY.length}`;
  caption.textContent = item.caption || '';

  preloadAround(__lbIndex);

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
  __lbOpen = true;
}

function closeLightbox(){
  const overlay = document.getElementById('lightbox');
  const img = document.getElementById('lbImg');
  const title = document.getElementById('lbTitle');
  const caption = document.getElementById('lbCaption');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden','true');
  img.src = '';
  img.alt = '';
  title.textContent = 'Gallery';
  caption.textContent = '';
  __lbOpen = false;
}

function nextLightbox(step){
  openLightbox(__lbIndex + step);
}

function setupLightbox(){
  const galleryEl = document.getElementById('gallery');
  const overlay = document.getElementById('lightbox');
  const modal = overlay?.querySelector('.lb-modal');
  const btnClose = document.getElementById('lbClose');
  const btnPrev = document.getElementById('lbPrev');
  const btnNext = document.getElementById('lbNext');

  if(!galleryEl || !overlay || !btnClose || !btnPrev || !btnNext) return;

  galleryEl.addEventListener('click', (e)=>{
    const target = e.target;
    if(!(target instanceof HTMLImageElement)) return;
    const idx = target.getAttribute('data-idx');
    const i = idx !== null ? parseInt(idx,10) : -1;
    if(i >= 0) openLightbox(i);
  });

  btnClose.addEventListener('click', closeLightbox);
  overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closeLightbox(); });
  modal?.addEventListener('click', (e)=> e.stopPropagation());

  btnPrev.addEventListener('click', ()=> nextLightbox(-1));
  btnNext.addEventListener('click', ()=> nextLightbox(+1));

  document.addEventListener('keydown', (e)=>{
    if(!__lbOpen) return;
    if(e.key === 'Escape') closeLightbox();
    if(e.key === 'ArrowLeft') nextLightbox(-1);
    if(e.key === 'ArrowRight') nextLightbox(+1);
  });

  // Touch swipe
  let x0 = null;
  overlay.addEventListener('touchstart', (e)=>{ if(__lbOpen) x0 = e.touches[0].clientX; }, {passive:true});
  overlay.addEventListener('touchend', (e)=>{
    if(!__lbOpen || x0 === null) return;
    const x1 = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : x0;
    const dx = x1 - x0;
    if(Math.abs(dx) > 50) nextLightbox(dx > 0 ? -1 : +1);
    x0 = null;
  }, {passive:true});
}

(async ()=>{
  await loadGalleryData();
  render(PRODUCTS);
  setupLightbox();
  if(GALLERY[0]) preloadImage(GALLERY[0].src);
})();
