
// Public (v6.3.2) — render products & gallery from config for now
(async function(){
  const status=document.getElementById('status');
  const cfg=await (await fetch('config.json?v='+Date.now())).json();
  status.textContent = (cfg.cms && cfg.cms.demo) ? 'Demo mode' : 'Live mode';

  // Products
  const pgrid=document.getElementById('product-grid');
  const fgrid=document.getElementById('featured-grid');
  const dd=document.getElementById('c-product');
  const money=r=>'R'+Number(r||0).toLocaleString('en-ZA',{minimumFractionDigits:0});
  (cfg.products||[]).forEach((p,i)=>{
    const card=document.createElement('div'); card.className='product';
    card.innerHTML=`<img src='${p.imageUrl}' alt='${p.name}' loading='lazy'><div class='info'><div style='display:flex;justify-content:space-between;align-items:center;gap:8px'><h3 style='margin:0;font-size:16px'>${p.name}</h3><span class='badge'>${money(p.price)} inc VAT</span></div><p style='color:#64748b;margin:6px 0 10px'>${p.summary||''}</p><div><a class='btn' href='product.html?sku=${p.sku}'>View Details</a></div></div>`;
    pgrid.appendChild(card); if(i<8) fgrid.appendChild(card.cloneNode(true)); const opt=document.createElement('option'); opt.value=p.sku; opt.textContent=`${p.sku} — ${p.name}`; dd.appendChild(opt);
  });

  // Price changes
  const tbody=document.querySelector('#pc-table tbody');
  (cfg.priceChanges||[]).forEach(row=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${row.sku}</td><td>R${row.old} → R${row.new}</td><td>${row.when}</td><td>${row.note||''}</td>`; tbody.appendChild(tr); });

  // Documents
  const dlist=document.getElementById('docs-list');
  (cfg.documents||[]).forEach(doc=>{ const a=document.createElement('a'); a.href=doc.url; a.className='link'; a.textContent=`\uD83D\uDCC4 ${doc.name}`; a.style.display='block'; a.style.margin='6px 0'; dlist.appendChild(a); });
})();
