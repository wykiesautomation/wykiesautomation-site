
(()=>{
  const products=[
    {id:'WA-05',name:'Nano GSM Gate Controller V1',price_vat_incl:800,short:'Compact GSM gate controller',images:['assets/images/wa-05.png'],docUrl:'docs/WA-05-Manual.pdf',trialUrl:null,preorder:false,published:true},
    {id:'WA-01',name:'3D Printer Control V1',price_vat_incl:1499,short:'Advanced control system',images:['assets/images/wa-01.png'],docUrl:'docs/WA-01-Manual.pdf',trialUrl:'downloads/WA-01-Trial.zip',preorder:true,published:true},
    {id:'WA-03',name:'ECU/TCU Control System V1',price_vat_incl:6499,short:'FPC/TCU control system',images:['assets/images/wa-03.png'],docUrl:'docs/WA-03-Spec.pdf',trialUrl:'downloads/WA-03-Trial.zip',preorder:false,published:true}
  ];
  const grid=document.getElementById('grid');
  const search=document.getElementById('search');
  const R=n=>'R'+(n||0).toLocaleString('en-ZA');
  function card(p){return `
    <article class="card">
      <img src="${(p.images&&p.images[0])||''}" alt="${p.name}">
      <div style="padding:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <h3 style="margin:0;font-weight:700">${p.id} · ${p.name}</h3>
          <span class="badge badge-price pill">${R(p.price_vat_incl)}</span>
        </div>
        <p class="muted" style="margin:.35rem 0 0;font-size:14px">${p.short||''}</p>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn" href="#">View Details</a>
          ${p.docUrl?`<a class="btn" href="${p.docUrl}" download>View Docs</a>`:''}
          ${p.trialUrl?`<a class="btn" style="background:#2563eb;border-color:#2563eb" href="${p.trialUrl}">Download Trial</a>`:''}
          <a class="btn primary" href="checkout.html?sku=${p.id}">Buy Now</a>
          ${p.preorder?`<span class="pill" style="border-color:#b56a00;color:#ffb454;background:#3a1e00">Pre‑Order</span>`:''}
        </div>
      </div>
    </article>`}
  function render(list){grid.innerHTML=list.map(card).join('');}
  function filter(){const q=(search.value||'').toLowerCase();render(products.filter(p=>p.name.toLowerCase().includes(q)||(p.short||'').toLowerCase().includes(q)||p.id.toLowerCase().includes(q)));}
  search&&search.addEventListener('input',()=>{clearTimeout(window.__t);window.__t=setTimeout(filter,120)})
  render(products)
  const G=document.getElementById('gallery');
  const paths=['assets/images/wa-05.png','assets/images/wa-01.png','assets/images/wa-03.png','assets/images/wa-02.png','assets/images/wa-10.png','assets/images/wa-11.png'];
  if(G){G.innerHTML=paths.map(p=>`<a href='#' data-img='${p}'><img src='${p}' alt='Gallery'></a>`).join('');}
  const lb=document.getElementById('lightbox');
  G&&G.addEventListener('click',e=>{const a=e.target.closest('a[data-img]');if(!a)return;e.preventDefault();lb.querySelector('img').src=a.dataset.img;lb.classList.add('active')});
  lb&&lb.addEventListener('click',()=>lb.classList.remove('active'));
})();
