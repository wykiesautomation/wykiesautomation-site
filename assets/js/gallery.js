
// Gallery page (v6.2.2) — renders from API or config
(async function(){
  const cfg=await (await fetch('config.json?v='+Date.now())).json();
  async function api(){ if(!cfg.cms||!cfg.cms.appsScriptUrl||cfg.cms.demo) return {ok:false}; try{const res=await fetch(cfg.cms.appsScriptUrl,{method:'POST',headers:{'Content-Type':'application/json','x-wa-token':cfg.cms.token||''},body:JSON.stringify({action:'listGallery',token:cfg.cms.token})}); return await res.json();}catch{return{ok:false}} }
  let g=cfg.gallery||[]; const d=await api(); if(d&&d.ok) g=d.rows||g; const grid=document.getElementById('gallery-grid');
  g.forEach(item=>{ const c=document.createElement('div'); c.className='product'; c.innerHTML=`<img src='${item.imageUrl||item.ImageUrl}' alt='${item.alt||item.ALT||''}' loading='lazy' onerror="this.src='assets/img/placeholder.png'"><div class='info'><p class='note' style='margin:6px 0'>${item.caption||item.Caption||''}</p></div>`; grid.appendChild(c); });
})();
