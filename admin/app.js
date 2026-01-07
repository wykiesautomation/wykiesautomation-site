
const state = {
  cfg: null,
  token: null,
  role: 'viewer',
};

function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

async function loadConfig(){
  const cfg = await fetch('../config.json').then(r=>r.json());
  state.cfg = cfg; return cfg;
}

function saveSession(){ localStorage.setItem('wykies_admin_session', JSON.stringify({token:state.token, role:state.role, t:Date.now()})); }
function loadSession(){ try{ const s = JSON.parse(localStorage.getItem('wykies_admin_session')); if(s){ state.token=s.token; state.role=s.role||'viewer'; } }catch(e){} }
function clearSession(){ localStorage.removeItem('wykies_admin_session'); state.token=null; state.role='viewer'; }

function applyRoleUI(){
  const badge = $('#roleBadge'); if (badge) badge.textContent = `Role: ${state.role}`;
  $all('[data-role="admin-only"]').forEach(btn => {
    if(state.role==='admin'){ btn.removeAttribute('disabled'); btn.style.display='inline-block'; }
    else { btn.setAttribute('disabled','true'); btn.style.display='none'; }
  });
}


async function api(action, body=null){
  const baseUrl = `${state.cfg.scriptUrl}?action=${encodeURIComponent(action)}`;
  if (body){
    // Ensure token travel without Authorization header
    if (state.token && !('token' in body)) body.token = state.token;
    const form = new URLSearchParams();
    Object.entries(body).forEach(([k,v])=>{ if(v!==undefined) form.append(k, String(v)); });
    const r = await fetch(baseUrl, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}, body: form.toString() });
    return await r.json();
  } else {
    const u = new URL(baseUrl);
    if (state.token) u.searchParams.set('token', state.token);
    const r = await fetch(u.toString(), { method:'GET' });
    return await r.json();
  }
}

async function onLogin(e){
  e.preventDefault();
  const passphrase = $('#passphrase').value.trim();
  $('#loginError').hidden = true;
  try{
    const res = await api('login', { passphrase });
    if(!res.ok) throw new Error('bad');
    state.token = res.token; state.role = res.role || 'admin';
    saveSession();
    hide($('#loginView')); show($('#appView')); applyRoleUI();
    await loadProducts(); await loadPayments(); await loadLogs();
  }catch(err){
    const el = $('#loginError'); el.textContent = 'Login failed. Check passphrase.'; el.hidden = false;
  }
}

async function loadProducts(){
  $('#statusMsg').textContent = 'Loading products…';
  try{
    const rows = await api('listProducts');
    const tbody = $('#productsTable tbody'); tbody.innerHTML = '';
    (rows||[]).forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.sku}</td>
        <td>${r.name}</td>
        <td>R${Number(r.price).toLocaleString()}</td>
        <td>${r.active?'Yes':'No'}</td>
        <td>
          <button class="btn btn-secondary" data-action="edit">Edit</button>
          <button class="btn btn-outline" data-action="toggle">${r.active?'Disable':'Enable'}</button>
        </td>`;
      tr.querySelector('[data-action="edit"]').addEventListener('click', ()=> editProduct(r));
      tr.querySelector('[data-action="toggle"]').addEventListener('click', ()=> toggleProduct(r));
      tbody.appendChild(tr);
    });
    $('#statusMsg').textContent = '';
  }catch(e){ $('#statusMsg').textContent = 'Failed to load products.'; }
}

function promptEdit(field, init){
  const v = prompt(`Enter ${field}:`, init==null?'':String(init));
  return v==null? null : v;
}

async function editProduct(r){
  if(state.role !== 'admin'){ alert('Admin only'); return; }
  const name = promptEdit('name', r.name); if(name===null) return;
  const price = promptEdit('price', r.price); if(price===null) return;
  try{
    await api('updateProduct', { sku:r.sku, name, price: Number(price) });
    await loadProducts();
  }catch(e){ alert('Update failed'); }
}

async function toggleProduct(r){
  if(state.role !== 'admin'){ alert('Admin only'); return; }
  try{
    await api('updateProduct', { sku:r.sku, active: !r.active });
    await loadProducts();
  }catch(e){ alert('Update failed'); }
}

async function addProduct(){
  if(state.role !== 'admin'){ alert('Admin only'); return; }
  const sku = promptEdit('SKU', 'WA-XX'); if(sku===null) return;
  const name = promptEdit('name', 'New Product'); if(name===null) return;
  const price = promptEdit('price (incl VAT)', 0); if(price===null) return;
  try{ await api('addProduct', { sku, name, price: Number(price), active: true }); await loadProducts(); }
  catch(e){ alert('Add failed'); }
}

async function loadPayments(){
  try{ const rows = await api('listPayments');
    const tb = $('#paymentsTable tbody'); tb.innerHTML='';
    (rows||[]).forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.timestamp||''}</td><td>${r.invoiceNo||''}</td><td>${r.email||''}</td><td>${r.sku||''}</td><td>R${Number(r.totalInclVAT||0).toLocaleString()}</td>`; tb.appendChild(tr); });
  }catch(e){}
}

async function loadLogs(){
  try{ const rows = await api('listLogs');
    const tb = $('#logsTable tbody'); tb.innerHTML='';
    (rows||[]).forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.timestamp}</td><td>${r.actor}</td><td>${r.action}</td><td>${r.entity||''}</td><td>${r.result||''}</td>`; tb.appendChild(tr); });
  }catch(e){}
}

function initTabs(){
  $all('.tab').forEach(btn=>btn.addEventListener('click',()=>{
    $all('.tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const name = btn.dataset.tab;
    $all('.tabpanel').forEach(p=>p.classList.add('hidden'));
    $(`#tab-${name}`).classList.remove('hidden');
  }));
}

async function main(){
  await loadConfig();
  initTabs();
  loadSession();
  applyRoleUI();
  $('#loginForm').addEventListener('submit', onLogin);
  $('#btnSignOut').addEventListener('click', ()=>{ clearSession(); location.reload(); });
  $('#btnAddProduct').addEventListener('click', addProduct);

  if(state.token){
    try{
      const res = await api('session');
      if(res.ok){ hide($('#loginView')); show($('#appView')); state.role=res.role||state.role; applyRoleUI(); await loadProducts(); await loadPayments(); await loadLogs(); }
      else{ clearSession(); }
    }catch(e){ /* not signed in */ }
  }
}

document.addEventListener('DOMContentLoaded', main);
