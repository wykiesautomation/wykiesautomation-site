
// Gallery uses same images as public products (v6.3.2)
(async function(){
  const cfg=await (await fetch('config.json?v='+Date.now())).json();
  const grid=document.getElementById('gallery-grid');
  (cfg.products||[]).forEach(p=>{ const c=document.createElement('div'); c.className='product'; c.innerHTML=`<img src='${p.imageUrl}' alt='${p.name}' loading='lazy'><div class='info'><p style='color:#64748b;margin:6px 0'>${p.name}</p></div>`; grid.appendChild(c); });
})();
