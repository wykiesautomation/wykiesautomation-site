
/* ============================================================
   Wykies Automation — FINAL JSONP app.js (clean)
   Build: 2026-01-24
   ------------------------------------------------------------
   RULES:
   - Apps Script is JSONP ONLY
   - NEVER fetch() Apps Script
   - PayFast uses HTML form POST only
   ============================================================ */

console.log("WA app.js loaded (JSONP final build)");

/* -------------------- DOM helpers -------------------- */
const $  = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));

/* -------------------- Config -------------------- */
let CONFIG = null;

async function loadConfig() {
  if (CONFIG) return CONFIG;
  const r = await fetch("assets/js/config.json", { cache: "no-store" });
  CONFIG = await r.json();
  return CONFIG;
}

/* -------------------- Toast -------------------- */
function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("on");
  setTimeout(() => el.classList.remove("on"), 3000);
}

/* -------------------- JSONP CORE -------------------- */
function jsonp(url, params = {}, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const cb = "__cb_" + Date.now();
    params.callback = cb;

    const qs = new URLSearchParams(params).toString();
    const src = url + (url.includes("?") ? "&" : "?") + qs;

    const s = document.createElement("script");
    let done = false;

    function cleanup(err, data) {
      if (done) return;
      done = true;
      delete window[cb];
      s.remove();
      if (err) reject(err);
      else resolve(data);
    }

    window[cb] = data => cleanup(null, data);
    s.onerror = () => cleanup(new Error("JSONP load failed"));
    s.src = src;
    document.body.appendChild(s);

    setTimeout(() => cleanup(new Error("JSONP timeout")), timeout);
  });
}

/* -------------------- API wrapper -------------------- */
async function api(op, params = {}) {
  const cfg = await loadConfig();
  const res = await jsonp(cfg.APPS_SCRIPT_URL, { op, ...params });
  if (!res || res.ok === false) throw new Error(res?.error || "API error");
  return res.data;
}

/* -------------------- PayFast (HTML POST ONLY) -------------------- */
function submitPayFast(processUrl, fields) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = processUrl;

  for (const [k, v] of Object.entries(fields)) {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = k;
    i.value = v;
    form.appendChild(i);
  }

  document.body.appendChild(form);
  form.submit();
}

/* -------------------- Products Grid -------------------- */
async function loadProducts() {
  const grid = $("#grid");
  if (!grid) return;

  grid.innerHTML = "Loading…";

  let products = [];
  try {
    products = await api("products");
  } catch {
    grid.innerHTML = "Failed to load products.";
    return;
  }

  grid.innerHTML = products.map(p => `
    <div class="card pad">
      <strong>${p.name}</strong>
      <div>${p.summary || ""}</div>
      <div class="price">R ${p.price}</div>
      <button class="btn primary"
        data-sku="${p.sku}"
        data-name="${p.name}">
        Buy Now
      </button>
    </div>
  `).join("");

  $$("button[data-sku]").forEach(b => {
    b.onclick = () => openCheckout(b.dataset.sku, b.dataset.name);
  });
}

/* -------------------- Checkout Modal -------------------- */
let CURRENT = null;

function openCheckout(sku, name) {
  CURRENT = { sku, name };
  $("#buySku").textContent = sku;
  $("#buyName").textContent = name;
  $("#modalCheckout")?.classList.add("on");
}

$("#btnCloseModal")?.addEventListener("click", () => {
  $("#modalCheckout")?.classList.remove("on");
});

/* -------------------- Proceed to PayFast -------------------- */
async function proceedPayFast() {
  const email = $("#buyerEmail").value.trim();
  if (!email) return toast("Enter email address");

  try {
    const data = await api("createPayment", {
      sku: CURRENT.sku,
      email
    });

    // ✅ THIS IS THE SAME AS YOUR TEST FORM
    submitPayFast(data.processUrl, data.fields);

  } catch (err) {
    console.error(err);
    toast("Checkout failed. Use WhatsApp.");
  }
}

$("#btnPay")?.addEventListener("click", proceedPayFast);

/* -------------------- Contact Form -------------------- */
function bindContact() {
  const f = $("#contactForm");
  if (!f) return;

  f.onsubmit = async e => {
    e.preventDefault();
    const d = new FormData(f);

    try {
      await api("contact", {
        name: d.get("name"),
        email: d.get("email"),
        message: d.get("message")
      });
      $("#contactMsg").textContent = "Message sent.";
      f.reset();
    } catch {
      $("#contactMsg").textContent = "Failed to send.";
    }
  };
}

/* -------------------- INIT -------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadConfig();
  loadProducts();
  bindContact();
});
