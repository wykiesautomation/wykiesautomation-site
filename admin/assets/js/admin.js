
// admin/assets/js/admin.js  (CLEAN + WORKING)

const GAS_URL = "https://script.google.com/macros/s/AKfycbx2LaPWEsoXurODVxOqr0sUS73Ai5ve3DBOgrOz7W8jvJ2n9YmiyOgbd0aPQvH0Jb5O/exec";
const ALLOW_EMAIL = "wykiesautomation@gmail.com";

let idToken = null;

function setUserPill(text){
  const pill = document.getElementById("userPill");
  if(pill) pill.textContent = text;
}

function decodeJwt(token){
  try{
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g,"+").replace(/_/g,"/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  }catch(e){
    return null;
  }
}

// JSONP helper (avoids CORS issues)
function gasJsonp(action, params = {}){
  return new Promise((resolve) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const url = new URL(GAS_URL);
    url.searchParams.set("action", action);

    Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
    url.searchParams.set("callback", cb);

    const script = document.createElement("script");

    window[cb] = (data) => {
      resolve(data);
      try { delete window[cb]; } catch(e){}
      script.remove();
    };

    script.src = url.toString();
    script.onerror = () => {
      resolve(null);
      try { delete window[cb]; } catch(e){}
      script.remove();
    };

    document.head.appendChild(script);
  });
}

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[m]));
}

function sortNum(v){
  const n = parseInt(String(v ?? "").replace(/[^0-9-]/g,""), 10);
  return Number.isFinite(n) ? n : 999999;
}

// Tabs switching
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".panel").forEach(p => p.style.display = "none");
    const panel = document.getElementById("tab-" + btn.dataset.tab);
    if(panel) panel.style.display = "block";
  });
});

// Google Sign-in callback
window.WA_onGoogle = (resp) => {
  idToken = resp.credential;
  const p = decodeJwt(idToken);

  const msg = document.getElementById("authMsg");

  if(!p || !p.email){
    if(msg) msg.textContent = "Google sign-in failed.";
    return;
  }

  if(String(p.email).toLowerCase() !== ALLOW_EMAIL){
    setUserPill("Forbidden: " + p.email);
    if(msg) msg.textContent = "Not allowlisted.";
    return;
  }

  setUserPill("Admin: " + p.email);
  if(msg) msg.textContent = "Signed in. Loading…";
  boot();
};

// ---------- LOADERS ----------

async function loadProducts(){
  const res = await gasJsonp("products");
  const products = (res && res.products) ? res.products : [];

  // Sort by sortOrder
  products.sort((a,b)=> sortNum(a.sortOrder) - sortNum(b.sortOrder));

  const tbl = document.getElementById("productsTable");
  if(!tbl) return;

  if(products.length === 0){
    tbl.innerHTML = `<tr><td class="muted">No products found in the Products sheet.</td></tr>`;
    return;
  }

  const cols = ["sku","name","price","trialUrl","docUrl","active","preOrder","buyEnabled","sortOrder"];
  tbl.innerHTML =
    `<thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead>` +
    `<tbody>` +
      products.map(p =>
        `<tr>${cols.map(c => `<td>${esc(p[c])}</td>`).join("")}</tr>`
      ).join("") +
    `</tbody>`;
}

async function loadSettings(){
  const res = await gasJsonp("settings");
  const box = document.getElementById("settingsBox");
  if(box) box.textContent = JSON.stringify(res || {}, null, 2);
}

async function loadPayments(){
  const res = await gasJsonp("payments");
  const payments = (res && res.payments) ? res.payments : [];
  const box = document.getElementById("paymentsBox");
  if(box) box.textContent = JSON.stringify(payments, null, 2);
}

async function loadLogs(){
  const res = await gasJsonp("logs");
  const logs = (res && res.logs) ? res.logs : [];
  const box = document.getElementById("logsBox");
  if(box) box.textContent = JSON.stringify(logs, null, 2);
}

// Buttons
document.getElementById("btnRefreshProducts")?.addEventListener("click", loadProducts);
document.getElementById("btnRefreshSettings")?.addEventListener("click", loadSettings);
document.getElementById("btnRefreshPayments")?.addEventListener("click", loadPayments);
document.getElementById("btnRefreshLogs")?.addEventListener("click", loadLogs);

async function boot(){
  await loadProducts();
  await loadSettings();
  await loadPayments();
  await loadLogs();
  const msg = document.getElementById("authMsg");
  if(msg) msg.textContent = "Ready.";
}

setUserPill("Signed out");
