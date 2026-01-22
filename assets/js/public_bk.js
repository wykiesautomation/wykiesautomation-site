
/* assets/js/public.js
   Wykies Automation - Public site scripting
   Works with index.html elements: #grid, #search, #docSelect, #btnDocDownload, #btnPriceList, #contactForm
*/

(() => {
  // ====== CONFIG ======
  const PRODUCTS_URL = "assets/data/products.json"; // change if you use a different source
  const CONTACT_ENDPOINT = ""; // <-- Paste your Google Apps Script URL here (optional)

  // ====== DOM ======
  const grid = document.getElementById("grid");
  const search = document.getElementById("search");

  const docSelect = document.getElementById("docSelect");
  const btnDocDownload = document.getElementById("btnDocDownload");
  const btnPriceList = document.getElementById("btnPriceList");

  const contactForm = document.getElementById("contactForm");
  const contactMsg = document.getElementById("contactMsg");

  // ====== STATE ======
  let products = [];
  let filtered = [];

  // ====== HELPERS ======
  const moneyZAR = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    // Format like: R 2 499
    return "R " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const bySku = (sku) => products.find(p => String(p.sku).toUpperCase() === String(sku).toUpperCase());

  const setBtnState = (btn, href, enabledText) => {
    if (!btn) return;
    if (href) {
      btn.href = href;
      btn.style.pointerEvents = "auto";
      btn.style.opacity = "1";
      if (enabledText) btn.textContent = enabledText;
    } else {
      btn.href = "#";
      btn.style.pointerEvents = "none";
      btn.style.opacity = "0.55";
    }
  };

  const resolveUrl = (pathOrUrl) => {
    if (!pathOrUrl) return "";
    try {
      // If it's already absolute, keep it
      const u = new URL(pathOrUrl, window.location.href);
      return u.toString();
    } catch {
      return pathOrUrl;
    }
  };

  // ====== RENDERING ======
  function renderGrid(list) {
    if (!grid) return;

    if (!list || list.length === 0) {
      grid.innerHTML = `<div class="muted" style="padding:16px">No products found.</div>`;
      return;
    }

    grid.innerHTML = list.map(p => {
      const sku = esc(p.sku);
      const name = esc(p.name);
      const summary = esc(p.summary || "");
      const price = moneyZAR(p.price);
      const img = esc(p.image || "assets/img/product-placeholder.png");

      return `
        <div class="card product" data-sku="${sku}">
          <div class="card-media">
            <img src="${img}" alt="${name}" loading="lazy="card-body">
            <div class="price-chip">${esc(price)}</div>
            <h3 class="title">${name}</h3>
            <div class="sku muted">${sku}</div>
            <div class="summary muted">${summary}</div>

            <div class="card-actions" style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn outline" type="button" data-action="details" data-sku="${"button" data-action="docs" data-sku="${ta-action="trial"     </div>
        </div>
      `;
    }).join("");
  }

  function renderDocsSelect(list) {
    if (!docSelect) return;

    const options = [`<option value="">Select a product…</option>`]
      .concat(list.map(p => `<option value="${esc(p.sku)}">${esc(p.sku)} — ${esc(p.name)}</option>`));

    docSelect.innerHTML = options.join("");

    // Default disable buttons until selection
    setBtnState(btnDocDownload, "");
    setBtnState(btnPriceList, "");
  }

  // ====== ACTIONS (BUTTONS) ======
  function goDetails(sku) {
    const p = bySku(sku);
    const target = p?.detailsUrl
      ? resolveUrl(p.detailsUrl)
      : `product.html?sku=${encodeURIComponent(sku)}`;
    window.location.href = target;
  }

  function goDocs(sku) {
    // You can either route to docs.html OR directly download ZIP
    const p = bySku(sku);
    if (p?.docsZip) {
      window.location.href = resolveUrl(p.docsZip);
    } else {
      window.location.href = `docs.html?sku=${encodeURIComponent(sku)}`;
    }
  }

  function downloadTrial(sku) {
    const p = bySku(sku);
    const target = p?.trialUrl
      ? resolveUrl(p.trialUrl)
      : `downloads/trials/${encodeURIComponent(sku)}.zip`;

    // open in new tab to avoid losing scroll position
    window.open(target, "_blank", "noopener,noreferrer");
  }

  // Use EVENT DELEGATION so dynamically added cards still work
  function wireGridClicks() {
    if (!grid) return;

    grid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;

