
// assets/js/public.js (PayFast Buy Now + JSONP, GitHub Pages friendly)

const GAS_URL = "https://script.google.com/macros/s/AKfycbx2LaPWEsoXurODVxOqr0sUS73Ai5ve3DBOgrOz7W8jvJ2n9YmiyOgbd0aPQvH0Jb5O/exec";

// ---------- JSONP helper (avoids CORS on GitHub Pages) ----------
function gasJsonp(action, params = {}) {
  return new Promise((resolve) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const url = new URL(GAS_URL);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set("callback", cb);

    const script = document.createElement("script");

    window[cb] = (data) => {
      resolve(data);
      try { delete window[cb]; } catch (e) {}
      script.remove();
    };

    script.src = url.toString();
    script.onerror = () => {
      resolve(null);
      try { delete window[cb]; } catch (e) {}
      script.remove();
    };

    document.head.appendChild(script);
  });
}

// ---------- helpers ----------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "onclick") node.onclick = v;
    else node.setAttribute(k, v);
  });
  children.flat().filter(Boolean).forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return node;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[m]));
}

function toBool(v) {
  if (v === true) return true;
  const s = String(v || "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function moneyZAR(v) {
  if (v == null || v === "") return "—";
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return String(v);
  return "R " + n.toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}

function sortNum(v) {
  const n = parseInt(String(v ?? "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : 999999;
}

function localImageForSku(sku) {
  const map = {
    "WA-01": "wa-01.PNG",
    "WA-02": "wa-02.PNG",
    "WA-03": "wa-03.png",
    "WA-04": "wa-04.PNG",
    "WA-05": "wa-05.PNG",
    "WA-06": "wa-06.PNG",
    "WA-07": "wa-07.PNG",
    "WA-08": "wa-08.PNG",
    "WA-09": "wa-09.PNG",
    "WA-10": "wa-10.PNG",
    "WA-11": "wa-11.PNG",
    "WA-12": "wa-12.PNG",
  };
  return map[String(sku || "").trim()] || "";
}

function driveThumb(url) {
  // If you store imageUrl as a Drive "file/d/ID/view" link, use thumbnail.
  const m = String(url || "").match(/\/d\/([^/]+)\//);
  if (m && m[1]) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
  return url;
}

// ---------- main ----------
async function loadProducts() {
  const grid = document.getElementById("grid");
  if (!grid) return;

  // Pull products from Apps Script
  let resp = await gasJsonp("products");
  let products = (resp && resp.products) ? resp.products : [];

  // Fallback if Apps Script is down
  if (!Array.isArray(products) || products.length === 0) {
    products = [
      { sku:"WA-01", name:"3D Printer Control V1", price:"1499", docUrl:"#", trialUrl:"#", active:true, buyEnabled:false, sortOrder:10 },
      { sku:"WA-02", name:"Plasma Cutter Control V1", price:"2499", docUrl:"#", trialUrl:"#", active:true, buyEnabled:false, sortOrder:20 },
    ];
  }

  // Clean + filter
  products = products
    .map(p => ({ ...p }))
    .filter(p => String(p.sku || "").trim() !== "")
    .filter(p => toBool(p.active) !== false);

  // Sort
  products.sort((a, b) => sortNum(a.sortOrder) - sortNum(b.sortOrder));

  // Variant: hide search if <= 12 items
  const searchBox = document.getElementById("search");
  if (searchBox) searchBox.style.display = (products.length > 12) ? "block" : "none";

  const docSelect = document.getElementById("docSelect");
  const btnDocOpen = document.getElementById("btnDocOpen");
  const btnPriceList = document.getElementById("btnPriceList");
  const docHint = document.getElementById("docHint");

  function render(list) {
    grid.innerHTML = "";

    if (!list.length) {
      grid.appendChild(el("div", { class: "muted" }, "No products available."));
      return;
    }

    list.forEach(p => {
      const sku = String(p.sku || "").trim();
      const imgLocal = localImageForSku(sku);
      const imgSrc = imgLocal || driveThumb(p.imageUrl || "");

      const card = el("article", { class: "card product-card" });
      const thumb = el("div", { class: "product-thumb" },
        el("img", { src: imgSrc || "wa-01.PNG", alt: p.name || sku, loading: "lazy" })
      );

      const body = el("div", { class: "product-body" });
      body.appendChild(el("div", { class: "badges" },
        el("span", { class: "badge price" }, moneyZAR(p.price)),
        toBool(p.preOrder) ? el("span", { class: "badge pre" }, "Pre‑Order") : null
      ));
      body.appendChild(el("h3", {}, p.name || sku));
      body.appendChild(el("div", { class: "muted" }, sku));
      if (p.summary) body.appendChild(el("p", { class: "muted" }, p.summary));

      const actions = el("div", { class: "product-actions" });

      // View Docs
      const docsUrl = String(p.docUrl || "").trim();
      const trialUrl = String(p.trialUrl || "").trim();

      actions.appendChild(el("a", {
        class: "btn" + (docsUrl ? "" : " disabled"),
        href: docsUrl || "#",
        target: "_blank",
        onclick: (e) => {
          if (!docsUrl) { e.preventDefault(); if (docHint) docHint.textContent = `Docs link not set for ${sku}`; }
        }
      }, "View Docs"));

      // Download Trial
      actions.appendChild(el("a", {
        class: "btn" + (trialUrl ? "" : " disabled"),
        href: trialUrl || "#",
        target: "_blank",
        onclick: (e) => {
          if (!trialUrl) { e.preventDefault(); if (docHint) docHint.textContent = `Trial link not set for ${sku}`; }
        }
      }, "Download Trial"));

      // Buy Now (PayFast via Apps Script createCheckout -> checkoutPage -> PayFast /eng/process)
      // PayFast expects a form POST to /eng/process with merchant + amount + item_name + notify_url etc. 
      if (toBool(p.buyEnabled)) {
        const buy = el("button", { class: "btn primary", type: "button" }, "Buy Now");
        buy.onclick = async () => {
          buy.disabled = true;
          buy.textContent = "Redirecting…";

          const r = await gasJsonp("createCheckout", { sku });
          if (r && r.ok && r.pfUrl) {
            window.location.href = r.pfUrl; // hosted checkoutPage will auto-post to PayFast
          } else {
            buy.disabled = false;
            buy.textContent = "Buy Now";
            alert(r?.error || "Checkout not available.");
          }
        };
        actions.appendChild(buy);
      }

      card.appendChild(thumb);
      card.appendChild(body);
      card.appendChild(actions);
      grid.appendChild(card);
    });
  }

  render(products);

  // Search (if enabled)
  if (searchBox) {
    let t;
    searchBox.addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        const q = e.target.value.trim().toLowerCase();
        const filtered = products.filter(p => (`${p.sku} ${p.name} ${p.summary || ""}`.toLowerCase().includes(q)));
        render(filtered);
      }, 120);
    });
  }

  // Documents dropdown
  if (docSelect && btnDocOpen) {
    docSelect.innerHTML = products.map(p => {
      const link = String(p.docUrl || "").trim();
      return `<option value="${esc(link)}">${esc(p.sku)} — ${esc(p.name || p.sku)}</option>`;
    }).join("");

    const update = () => {
      const link = docSelect.value || "";
      if (link) {
        btnDocOpen.href = link;
        btnDocOpen.classList.remove("disabled");
        if (docHint) docHint.textContent = "";
      } else {
        btnDocOpen.href = "#";
        btnDocOpen.classList.add("disabled");
        if (docHint) docHint.textContent = "Docs link not set for this product.";
      }
    };

    docSelect.addEventListener("change", update);
    update();
  }

  // Settings: price list PDF (optional)
  const st = await gasJsonp("settings");
  if (st && st.priceListPdfUrl && btnPriceList) btnPriceList.href = st.priceListPdfUrl;
}

// Run
loadProducts();
