
(async () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const cfg = await fetch('config.json').then(r=>r.json());
  const { scriptUrl, sheetId } = cfg;

  // Minimal client-side catalog to show cards fast; real data via Apps Script
  const skuMap = {
    'WA-01': {name:'3D Printer Control V1', price:1499, img:'assets/img/wa-01.png'},
    'WA-02': {name:'Plasma Cutter Control V1', price:2499, img:'assets/img/wa-02.png'},
    'WA-03': {name:'ECU/TCU Control System V1', price:6499, img:'assets/img/wa-03.png'},
    'WA-04': {name:'Fridge/Freezer Control V1', price:899, img:'assets/img/wa-04.png'},
    'WA-05': {name:'Nano GSM Gate Controller V1', price:800, img:'assets/img/wa-05.png'},
    'WA-06': {name:'Solar Energy Management System V1', price:3999, img:'assets/img/wa-06.png'},
    'WA-07': {name:'Hybrid Gate Controller V1', price:1800, img:'assets/img/wa-07.png'},
    'WA-08': {name:'Smart Battery Charger V1', price:999, img:'assets/img/wa-08.png'},
    'WA-10': {name:'12CH Hybrid Alarm V1', price:1299, img:'assets/img/wa-10.png'},
    'WA-11': {name:'16CH Hybrid Alarm V1', price:5499, img:'assets/img/wa-11.png'},
    'WA-12': {name:'TCU Gearbox Controller V1', price:4500, img:'assets/img/wa-12.png'}
  };

  const productGrid = document.getElementById('productGrid');
  if (productGrid){
    for(const [sku, p] of Object.entries(skuMap)){
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <img alt="${p.name}" src="${p.img}" onerror="this.src='assets/img/placeholder.png'" />
        <div class="body">
          <div class="badge">${sku} • R${p.price.toLocaleString()}</div>
          <h3 style="margin:.4rem 0 .6rem">${p.name}</h3>
          <div class="row">
            <a class="btn btn-primary" href="product.html?sku=${encodeURIComponent(sku)}">View Details</a>
            <a class="btn btn-secondary" href="#" aria-disabled="true">Download Trial</a>
          </div>
        </div>`;
      productGrid.appendChild(card);
    }
  }

  // Price Log from Apps Script (optional; safe if scriptUrl not set yet)
  const priceLogBody = document.getElementById('priceLogBody');
  if (priceLogBody && scriptUrl && scriptUrl.startsWith('https')){
    try{
      const resp = await fetch(`${scriptUrl}?action=priceLog&sheetId=${encodeURIComponent(sheetId)}`);
      const rows = await resp.json();
      rows.forEach(r=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.SKU}</td><td>ZAR</td><td>R${Number(r.Price).toLocaleString()}</td><td>${r.Timestamp||''}</td>`;
        priceLogBody.appendChild(tr);
      });
    }catch(e){ console.warn('Price log fetch failed:', e); }
  }
})();
