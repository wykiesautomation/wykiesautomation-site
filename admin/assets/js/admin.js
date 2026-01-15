
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
  }catch(e){ return null; }
}

// Tabs
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".panel").forEach(p=>p.style.display="none");
    document.getElementById("tab-" + btn.dataset.tab).style.display="block";
  });
});

function gasJsonp(action, params={}){
  return new Promise((resolve)=>{
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const url = new URL(GAS_URL);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    url.searchParams.set("callback", cb);

    window[cb] = (data)=>{
      resolve(data);
      try{ delete window[cb]; }catch(e){}
      script.remove();
    };

    const script = document.createElement("script");
    script.src = url.toString();
    script.onerror = ()=>{ resolve(null); try{ delete window[cb]; }catch(e){} script.remove(); };
    document.head.appendChild(script);
  });
}

window.WA_onGoogle = (resp)=>{
  idToken = resp.credential;
  const p = decodeJwt(idToken);
  if(!p || !p.email){
    document.getElementById("authMsg").textContent = "Google sign-in failed.";
    return;
  }
  if(String(p.email).toLowerCase() !== ALLOW_EMAIL){
    setUserPill("Forbidden: " + p.email);
    document.getElementById("authMsg").textContent = "Not allowlisted.";
    return;
  }
  setUserPill("Admin: " + p.email);
  document.getElementById("authMsg").textContent = "Signed in. Loading…";
  boot();
};

async function loadProducts(){
  // For now, reuse public products endpoint
  const r = await gasJsonp("products");
  const products = (r && r.products) ? r.products : [];
  const tbl = document.getElementById("productsTable");
  const head = ["sku","name","price","trialUrl","docUrl","active","preOrder","buyEnabled","sortOrder"];
  tbl.innerHTML =
    "<thead><tr>" + head.map(h=>`<th>${h}</th>`).join("") + "</tr></thead>" +
    "<tbody>" +
    products.map(p=>"<tr>"+head.map(h=>`<td>${p[h]??""}</td>`).join("")+"</tr>").join("") +
    "</tbody>";
}

async function loadSettings(){
  const r = await gasJsonp("settings");
  document.getElementById("settingsBox").textContent = JSON.stringify(r, null, 2);
}

document.getElementById("btnRefreshProducts").onclick = loadProducts;
document.getElementById("btnRefreshSettings").onclick = loadSettings;
document.getElementById("btnRefreshPayments").onclick = ()=> alert("Payments endpoint to be added next.");
document.getElementById("btnRefreshLogs").onclick = ()=> alert("Logs endpoint to be added next.");

async function boot(){
  await loadProducts();
  await loadSettings();
  document.getElementById("authMsg").textContent = "Ready.";
}

setUserPill("Signed out");
