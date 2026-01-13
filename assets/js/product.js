
// Product detail page (v6.2.2)
(async function(){
  const params=new URLSearchParams(location.search); const sku=params.get('sku');
  const cfg=await (await fetch('config.json?v='+Date.now())).json();
  const money=r=>'R'+Number(r||0).toLocaleString('en-ZA',{minimumFractionDigits:0});

  async function api(action){
    if(!cfg.cms || !cfg.cms.appsScriptUrl || cfg.cms.demo) return {ok:false};
    try{ const res=await fetch(cfg.cms.appsScriptUrl,{method:'POST',headers:{'Content-Type':'application/json','x-wa-token':cfg.cms.token||''},body:JSON.stringify({action, token: cfg.cms.token})}); return await res.json(); }catch{ return {ok:false}; }
  }

  let products=cfg.products||[]; const d=await api('listProducts'); if(d&&d.ok) products=d.rows||products;
  const p=(products||[]).find(x=>x.sku===sku);
  const container=document.getElementById('product');
  if(!p){ container.innerHTML='<div class="card">Product not found.</div>'; return; }
  container.innerHTML=`<div class='card'><div style='display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap'>
    <img src='${p.imageUrl}' alt='${p.name}' style='width:320px;height:200px;object-fit:cover' onerror="this.src='assets/img/placeholder.png'">
    <div style='flex:1'>
      <h2 style='margin:0 0 6px'>${p.name}</h2>
      <p class='note' style='margin:0 0 12px'>SKU: ${p.sku}</p>
      <div class='flex' style='margin:8px 0'><span class='badge'>${money(p.price)} inc VAT</span></div>
      <p class='note'>${p.description||p.summary||''}</p>
      <div style='margin-top:12px'>
        ${p.trialUrl?`<a class='btn' href='${p.trialUrl}'>Download Trial</a>`:''}
        ${p.docUrl?`<a class='btn' href='${p.docUrl}'>View Docs</a>`:''}
      </div>
    </div>
  </div></div>`;
})();
