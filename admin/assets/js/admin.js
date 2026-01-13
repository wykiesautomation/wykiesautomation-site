
// Admin (v6.3.2) — Dashboard + Products/Gallery placeholders (use v6.2.2 live admin for full CRUD)
(async function(){
  const view=document.getElementById('view');
  const tabs=document.querySelectorAll('.tab');

  function renderDashboard(){
    let html=`<div class='dashboard-grid'>
      <div class='dashboard-card'><h3>Products</h3><p id='prodCount'>0</p></div>
      <div class='dashboard-card'><h3>Payments Today</h3><p>0</p></div>
      <div class='dashboard-card'><h3>Announcements</h3><p>0</p></div>
    </div>`;
    html+=`<div class='card'><h3>Price Log</h3><p class='note'>Visible on public site — manage via Sheets (planned).</p></div>`;
    html+=`<div class='card'><h3>Payments</h3><p class='note'>Hook up PayFast ITN → Apps Script.</p></div>`;
    html+=`<div class='card'><h3>Announcements</h3><p class='note'>Planned.</p></div>`;
    view.innerHTML=html;
    fetch('../config.json?v='+Date.now()).then(r=>r.json()).then(cfg=>{ document.getElementById('prodCount').textContent=(cfg.products||[]).length; });
  }

  function renderProducts(){ view.innerHTML=`<div class='card'><h3>Products</h3><p class='note'>Edit config.json for now. We can switch to live CRUD immediately after Apps Script flip.</p></div>`; }
  function renderGallery(){ view.innerHTML=`<div class='card'><h3>Gallery</h3><p class='note'>Uses same images as public products for now.</p></div>`; }
  function renderPayments(){ view.innerHTML=`<div class='card'><h3>Payments</h3><p class='note'>Placeholder.</p></div>`; }
  function renderLogs(){ view.innerHTML=`<div class='card'><h3>Price Log</h3><p class='note'>Placeholder.</p></div>`; }
  function renderPages(){ view.innerHTML=`<div class='card'><h3>Pages</h3><p class='note'>Privacy/Terms/Refund planned.</p></div>`; }
  function renderSettings(){ view.innerHTML=`<div class='card'><h3>Settings</h3><p class='note'>Edit config.json for now.</p></div>`; }
  function renderAnnouncements(){ view.innerHTML=`<div class='card'><h3>Announcements</h3><p class='note'>Placeholder.</p></div>`; }
  function renderDocuments(){ view.innerHTML=`<div class='card'><h3>Documents</h3><p class='note'>Placeholder.</p></div>`; }

  const routes={dashboard:renderDashboard,products:renderProducts,gallery:renderGallery,payments:renderPayments,logs:renderLogs,pages:renderPages,settings:renderSettings,announcements:renderAnnouncements,documents:renderDocuments};
  function go(id){ tabs.forEach(t=>t.classList.toggle('active',t.dataset.tab===id)); routes[id](); }
  go('dashboard'); tabs.forEach(t=>t.onclick=()=>go(t.dataset.tab));
})();
