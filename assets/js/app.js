
// Public site bootstrap (v6.2.2) — API preferred, fallback to config.json
(async function(){
  const status = document.getElementById('status');
  const cfg = await (await fetch('config.json?v='+Date.now())).json();

  async function api(action, payload={}){
    if(!cfg.cms || !cfg.cms.appsScriptUrl || cfg.cms.demo) return {ok:false};
    try{
      const res = await fetch(cfg.cms.appsScriptUrl, {method:'POST', headers:{'Content-Type':'application/json','x-wa-token':cfg.cms.token||''}, body: JSON.stringify({action, token: cfg.cms.token, ...payload})});
      return await res.json();
    }catch{ return {ok:false}; }
  }

  status.textContent = (cfg.cms && cfg.cms.demo) ? 'Demo mode' : 'Live mode';

  let products = cfg.products||[], documents=cfg.documents||[], priceChanges=cfg.priceChanges||[], gallery=cfg.gallery||[];
  const d = await api('siteData');
  if(d && d.ok){ products=d.products||products; documents=d.documents||documents; priceChanges=d.priceChanges||priceChanges; gallery=d.gallery||gallery; }

  const pgrid=document.getElementById('product-grid');
  const fgrid=document.getElementById('featured-grid');
  const dd=document.getElementById('c-product');
  const money=r=>'R'+Number(r||0).toLocaleString('en-ZA',{minimumFractionDigits:0});

  (products||[]).filter(p=>String(p.active)!=='false').forEach((p,i)=>{
    const card=document.createElement('div'); card.className='product';
    card.innerHTML=`<img src='${p.imageUrl}' alt='${p.name}' loading='lazy' onerror="this.src='assets/img/placeholder.png'"><div class='info'><div style='display:flex;justify-content:space-between;align-items:center;gap:8px'><h3 style='margin:0;font-size:16px'>${p.name}</h3><span class='badge'>${money(p.price)} inc VAT</span></div><p class='note' style='margin:6px 0 10px'>${p.summary||''}</p><div><a class='btn' href='product.html?sku=${p.sku}'>View Details</a>${p.trialUrl?`<a class='btn' href='${p.trialUrl}'>Download Trial</a>`:''}${p.docUrl?`<a class='btn' href='${p.docUrl}'>View Docs</a>`:''}</div></div>`;
    pgrid.appendChild(card);
    if(i<3) fgrid.appendChild(card.cloneNode(true));
    const opt=document.createElement('option'); opt.value=p.sku; opt.textContent=`${p.sku} — ${p.name}`; dd.appendChild(opt);
  });

  const tbody=document.querySelector('#pc-table tbody');
  (priceChanges||[]).forEach(row=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${row.SKU||row.sku}</td><td>R${row.OldPrice||row.old} → R${row.NewPrice||row.new}</td><td>${row.Timestamp||row.when}</td><td>${row.Note||row.note||''}</td>`; tbody.appendChild(tr); });

  const dlist=document.getElementById('docs-list');
  (documents||[]).forEach(doc=>{ const a=document.createElement('a'); a.href=doc.FileUrl||doc.url; a.className='link'; a.textContent=`📄 ${doc.FileName||doc.name}`; a.style.display='block'; a.style.margin='6px 0'; dlist.appendChild(a); });

  const ggrid=document.getElementById('gallery-grid');
  if(ggrid){ (gallery||[]).forEach(g=>{ const c=document.createElement('div'); c.className='product'; c.innerHTML=`<img src='${g.imageUrl||g.ImageUrl}' alt='${g.alt||g.ALT||''}' loading='lazy' onerror="this.src='assets/img/placeholder.png'"><div class='info'><p class='note' style='margin:6px 0'>${g.caption||g.Caption||''}</p></div>`; ggrid.appendChild(c); }); }

  const nameI=document.getElementById('c-name'); const emailI=document.getElementById('c-email'); const phoneI=document.getElementById('c-phone'); const msgI=document.getElementById('c-message'); const waBtn=document.getElementById('c-wa-btn'); const sendBtn=document.getElementById('c-send');
  function buildWALink(){ const sku=dd.value||''; const text=`Hi Wykies Automation%0A%0AName: ${encodeURIComponent(nameI.value)}%0AEmail: ${encodeURIComponent(emailI.value)}%0APhone: ${encodeURIComponent(phoneI.value)}%0AProduct: ${encodeURIComponent(sku)}%0AMessage: ${encodeURIComponent(msgI.value)}`; return `https://wa.me/${(cfg.whatsapp.number||'').replace('+','')}?text=${text}`; }
  if(waBtn){ waBtn.href=buildWALink(); [nameI,emailI,phoneI,msgI,dd].forEach(el=>el&&el.addEventListener('input',()=>{waBtn.href=buildWALink()})); }
  if(sendBtn){ sendBtn.addEventListener('click',()=>{ alert('Message captured. In live mode this will email wykiesautomation@gmail.com via Apps Script.'); }); }
})();
