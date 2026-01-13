
// Admin (v6.2.2) — API if configured, otherwise Local Draft (export/import)
(async function(){
  const rootCfg = await (await fetch('../config.json?v='+Date.now())).json();
  const view=document.getElementById('view');

  const isLive = !!(rootCfg.cms && rootCfg.cms.appsScriptUrl && !rootCfg.cms.demo);
  const storeKey='wykiesadmin_staging_v2';

  const api = async (action, payload={})=>{
    if(!isLive) throw new Error('API not configured (demo mode)');
    const res = await fetch(rootCfg.cms.appsScriptUrl, {method:'POST', headers:{'Content-Type':'application/json','x-wa-token':rootCfg.cms.token||''}, body: JSON.stringify({action, token: rootCfg.cms.token, ...payload})});
    const j = await res.json(); if(!j.ok) throw new Error(j.error||'API error'); return j;
  };

  const staging = JSON.parse(localStorage.getItem(storeKey)||'{}');
  function saveDraft(cfg){ staging.config=cfg; localStorage.setItem(storeKey,JSON.stringify(staging)); }
  function getDraft(){ return staging.config||rootCfg; }

  async function renderProducts(){
    let data = [];
    if(isLive){ data = (await api('listProducts')).rows||[]; }
    else { data = (getDraft().products||[]); }

    let html=`<div class='card'><div style='display:flex;justify-content:space-between;align-items:center'><h3>Products ${isLive?'<span class=\'badge\'>LIVE</span>':'<span class=\'badge\'>DRAFT</span>'}</h3><div>`;
    if(!isLive) html+=`<button class='btn' id='exportCfg'>Export config.json</button><label class='btn'><input type='file' id='importCfg' style='display:none'>Import config.json</label>`;
    html+=`<button class='btn primary' id='addRow'>Add Product</button></div></div>
    <table class='table'><thead><tr><th>SKU</th><th>Name</th><th>Price</th><th>Summary</th><th>Image</th><th>Active</th><th>Actions</th></tr></thead><tbody>`;

    data.forEach((p,i)=>{ html+=`<tr>
      <td><input class='input' value='${p.sku||''}' data-i='${i}' data-k='sku'></td>
      <td><input class='input' value='${p.name||''}' data-i='${i}' data-k='name'></td>
      <td><input class='input' type='number' value='${p.price||0}' data-i='${i}' data-k='price'></td>
      <td><input class='input' value='${p.summary||''}' data-i='${i}' data-k='summary'></td>
      <td><input class='input' value='${p.imageUrl||''}' data-i='${i}' data-k='imageUrl'></td>
      <td><select class='select' data-i='${i}' data-k='active'><option value='true' ${(String(p.active)!=='false')?'selected':''}>true</option><option value='false' ${(String(p.active)==='false')?'selected':''}>false</option></select></td>
      <td><button class='btn' data-act='save' data-i='${i}'>Save</button><button class='btn' data-act='del' data-i='${i}'>Delete</button></td>
    </tr>`;});

    html+='</tbody></table></div>';
    view.innerHTML=html;

    document.getElementById('addRow').onclick=()=>{
      if(isLive){ api('upsertProduct',{product:{sku:'NEW',name:'New Product',price:0,summary:'',imageUrl:'assets/img/placeholder.png',active:true}}).then(renderProducts); }
      else { const c=getDraft(); c.products=c.products||[]; c.products.unshift({sku:'NEW',name:'New Product',price:0,summary:'',imageUrl:'assets/img/placeholder.png',active:true}); saveDraft(c); renderProducts(); }
    };

    view.querySelectorAll('button[data-act="save"]').forEach(b=>b.onclick=()=>{
      const i=+b.dataset.i; const inputs=[...view.querySelectorAll(`input[data-i='${i}'],select[data-i='${i}']`)];
      const obj={}; inputs.forEach(inp=>{ obj[inp.dataset.k] = (inp.dataset.k==='price')?Number(inp.value):(inp.dataset.k==='active'? (inp.value==='true'): inp.value); });
      if(isLive){ api('upsertProduct',{product:obj}).then(renderProducts); }
      else { const c=getDraft(); c.products[i]=Object.assign(c.products[i]||{},obj); saveDraft(c); renderProducts(); }
    });

    view.querySelectorAll('button[data-act="del"]').forEach(b=>b.onclick=()=>{
      const i=+b.dataset.i; if(isLive){ const sku=view.querySelector(`input[data-i='${i}'][data-k='sku']`).value; if(sku!=='NEW') api('deleteProduct',{sku}).then(renderProducts); }
      else { const c=getDraft(); c.products.splice(i,1); saveDraft(c); renderProducts(); }
    });

    if(!isLive){
      document.getElementById('exportCfg').onclick=()=>{ const blob=new Blob([JSON.stringify(getDraft(),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='config.json'; a.click(); };
      document.getElementById('importCfg').onchange=(e)=>{ const file=e.target.files[0]; const r=new FileReader(); r.onload=()=>{ try{ const obj=JSON.parse(r.result); saveDraft(obj); renderProducts(); }catch(err){ alert('Invalid JSON'); } }; r.readAsText(file); };
    }
  }

  async function renderGallery(){
    let data=[]; if(isLive){ data=(await api('listGallery')).rows||[]; } else { data=(getDraft().gallery||[]); }

    let html=`<div class='card'><div style='display:flex;justify-content:space-between;align-items:center'><h3>Gallery ${isLive?'<span class=\'badge\'>LIVE</span>':'<span class=\'badge\'>DRAFT</span>'}</h3><button class='btn primary' id='addImg'>Add Image</button></div>
    <table class='table'><thead><tr><th>Image URL</th><th>ALT</th><th>Caption</th><th>Actions</th></tr></thead><tbody>`;
    data.forEach((g,i)=>{ html+=`<tr><td><input class='input' value='${g.imageUrl||g.ImageUrl||''}' data-i='${i}' data-k='imageUrl'></td><td><input class='input' value='${g.alt||g.ALT||''}' data-i='${i}' data-k='alt'></td><td><input class='input' value='${g.caption||g.Caption||''}' data-i='${i}' data-k='caption'></td><td><button class='btn' data-act='save' data-i='${i}'>Save</button><button class='btn' data-act='del' data-i='${i}'>Delete</button></td></tr>`; });
    html+='</tbody></table></div>';
    view.innerHTML=html;

    document.getElementById('addImg').onclick=()=>{ if(isLive){ api('upsertGallery',{item:{imageUrl:'assets/img/placeholder.png',alt:'',caption:''}}).then(renderGallery); } else { const c=getDraft(); c.gallery=c.gallery||[]; c.gallery.unshift({imageUrl:'assets/img/placeholder.png',alt:'',caption:''}); saveDraft(c); renderGallery(); } };
    view.querySelectorAll('button[data-act="save"]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.i; const inputs=[...view.querySelectorAll(`input[data-i='${i}']`)]; const obj={}; inputs.forEach(inp=>obj[inp.dataset.k]=inp.value); if(isLive){ api('upsertGallery',{item:obj}).then(renderGallery); } else { const c=getDraft(); c.gallery[i]=Object.assign(c.gallery[i]||{},obj); saveDraft(c); renderGallery(); } });
    view.querySelectorAll('button[data-act="del"]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.i; const url=view.querySelector(`input[data-i='${i}'][data-k='imageUrl']`).value; if(isLive){ api('deleteGallery',{imageUrl:url}).then(renderGallery); } else { const c=getDraft(); c.gallery.splice(i,1); saveDraft(c); renderGallery(); } });
  }

  async function renderPayments(){ view.innerHTML=`<div class='card'><h3>Payments</h3><p class='note'>Wire PayFast ITN → Apps Script to populate verified payments. Resend Invoice button will email a regenerated PDF.</p><button class='btn'>Resend Invoice</button></div>`; }
  async function renderLogs(){ view.innerHTML=`<div class='card'><h3>Logs</h3><p class='note'>Coming next once API endpoints are connected for logs in live mode. (Products/Gallery already log on server.)</p></div>`; }
  async function renderPages(){ view.innerHTML=`<div class='card'><h3>Pages</h3><p class='note'>Planned — manage Privacy/Terms/Refunds from Sheets.</p></div>`; }
  async function renderSettings(){ view.innerHTML=`<div class='card'><h3>Settings</h3><p class='note'>Edit config.json or use a Sheet tab later.</p></div>`; }
  async function renderAnnouncements(){ view.innerHTML=`<div class='card'><h3>Announcements</h3><p class='note'>Planned.</p></div>`; }
  async function renderDocuments(){ view.innerHTML=`<div class='card'><h3>Documents</h3><p class='note'>Read from Documents tab in live mode (endpoint scaffolded).</p></div>`; }

  const tabs=document.querySelectorAll('.tab');
  const routes={products:renderProducts,gallery:renderGallery,payments:renderPayments,logs:renderLogs,pages:renderPages,settings:renderSettings,announcements:renderAnnouncements,documents:renderDocuments};
  async function go(id){ tabs.forEach(t=>t.classList.toggle('active',t.dataset.tab===id)); await routes[id](); }
  go('products'); tabs.forEach(t=>t.onclick=()=>go(t.dataset.tab));
})();
