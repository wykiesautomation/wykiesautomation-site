
(async () => {
  const yearEl = document.getElementById('year'); if (yearEl) yearEl.textContent = new Date().getFullYear();
  const cfg = await fetch('config.json').then(r=>r.json());
  const { scriptUrl, sheetId, whatsapp } = cfg;

  // HELPER: create a product card from CMS data
  function cardHtml(p){
    const img = p.imageUrl || `assets/img/${(p.sku||'').toLowerCase()}.png`;
    const trial = p.trialUrl || '#';
    const docs  = p.docUrl   || '#';
    const buy   = p.buyUrl   || '#';
    const price = Number(p.price||0);
    return `
      <article class="card">
        <img class="card-img" alt="${p.name||p.sku}" src="${img}" onerror="this.src='assets/img/placeholder.png'" />
        <div class="body">
          <div class="badge">${p.sku} • R${price.toLocaleString()}</div>
          <h3 style="margin:.4rem 0 .6rem">${p.name||''}</h3>
          <div class="row">
            <a class="btn btn-secondary" href="${trial}" target="_blank">Download Trial</a>
            <a class="btn btn-buy" href="${buy}" target="_blank">Buy Now</a>
            <a class="btn btn-docs" href="${docs}" target="_blank">Documents</a>
          </div>
        </div>
      </article>`;
  }

  // Load products from Apps Script (public endpoint)
  const grid = document.getElementById('productGrid');
  const sel  = document.getElementById('productSelect');
  try{
    const url = `${scriptUrl}?action=listproducts_public&sheetId=${encodeURIComponent(sheetId)}`;
    const rows = await fetch(url).then(r=>r.json());
    if(Array.isArray(rows)){
      rows.filter(r=>String(r.active).toLowerCase()==='true' || r.active===true).forEach(p=>{
        if(grid){ grid.insertAdjacentHTML('beforeend', cardHtml(p)); }
        if(sel){ const opt=document.createElement('option'); opt.value=p.sku; opt.textContent=`${p.sku} — ${p.name}`; sel.appendChild(opt); }
      });
    }
  }catch(e){ console.warn('Products fetch failed:', e); }

  // Simple gallery using first 6 product images
  const g = document.getElementById('galleryGrid');
  if (g && grid){
    const imgs = Array.from(grid.querySelectorAll('img.card-img')).slice(0,6).map(img=>img.getAttribute('src'));
    imgs.forEach(src=>{ const a=document.createElement('a'); a.href=src; a.target='_blank'; a.innerHTML=`<img class="gallery-thumb" src="${src}" alt="Gallery">`; g.appendChild(a); });
  }

  // Price Log
  const tbody = document.getElementById('priceLogBody');
  if (tbody && scriptUrl){ try{ const resp = await fetch(`${scriptUrl}?action=priceLog&sheetId=${encodeURIComponent(sheetId)}`); const rows = await resp.json(); (rows||[]).forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.SKU}</td><td>ZAR</td><td>R${Number(r.Price).toLocaleString()}</td><td>${r.Timestamp||''}</td>`; tbody.appendChild(tr); }); }catch(e){ console.warn('Price log fetch failed:', e); } }
})();
