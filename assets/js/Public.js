
/* Wykies Automation - public.js
   - Renders products into #grid
   - Uses event delegation so buttons always work
   - Populates Documents dropdown
*/

(() => {
  const PRODUCTS_URL = "assets/data/products.json";

  const grid = document.getElementById("grid");
  const search = document.getElementById("search");

  const docSelect = document.getElementById("docSelect");
  const btnDocDownload = document.getElementById("btnDocDownload");
  const btnPriceList = document.getElementById("btnPriceList");

  // Optional contact endpoint (leave blank if not configured)
  const CONTACT_ENDPOINT = "";
  const contactForm = document.getElementById("contactForm");
  const contactMsg = document.getElementById("contactMsg");

  let products = [];
  let filtered = [];

  // ---------- helpers ----------
  const moneyZAR = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return "R " + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const resolveUrl = (pathOrUrl) => {
    if (!pathOrUrl) return "";
    try {
      return new URL(pathOrUrl, window.location.href).toString();
    } catch {
      return pathOrUrl;
    }
  };

  const bySku = (sku) =>
    products.find((p) => String(p.sku).toUpperCase() === String(sku).toUpperCase());

  const setLinkEnabled = (a, href) => {
    if (!a) return;
    if (href) {
      a.href = href;
      a.style.pointerEvents = "auto";
      a.style.opacity = "1";
    } else {
      a.href = "#";
      a.style.pointerEvents = "none";
      a.style.opacity = "0.55";
    }
  };

  // ---------- render ----------
  function renderGrid(list) {
    if (!grid) return;

    if (!list || list.length === 0) {
      grid.innerHTML = `<div class="muted" style="padding:16px">No products found.</div>`;
      return;
    }

    grid.innerHTML = list
      .map((p) => {
        const sku = esc(p.sku);
        const name = esc(p.name);
        const summary = esc(p.summary || "");
        const price = esc(moneyZAR(p.price));
        const img = esc(p.image || "assets/img/product-placeholder.png");

        return `
          <div class="card product-card" data-sku="${sku}">
            <div class="product-thumb">
              <img src="${img}" alt="${name}"        <div class="product-body">
              <div class="badges">
                <span class="badge price">${price}</span>
              </div>

              <h3 style="margin:6px 0 0">${name}</h3>
              <div class="muted" style="margin-top:6px">${sku}</div>
              <div class="muted" style="margin-top:10px">${summary}</div>
            </div>

            <div class="product-actions">
              <button class="btn outline" type="button" data-action="details" data-sku="${skutton" data-actiontn" type="button" data-action="trial" data</div>
        `;
      })
      .join("");
  }

  function renderDocsSelect(list) {
    if (!docSelect) return;

    const opts = [`<option value="">Select a product…</option>`].concat(
      list.map((p) => `<option value="${esc(p.sku)}">${esc(p.sku)} — ${esc(p.name)}</option>`)
    );

    docSelect.innerHTML = opts.join("");

    setLinkEnabled(btnDocDownload, "");
    setLinkEnabled(btnPriceList, "");
  }

  // ---------- actions ----------
  function goDetails(sku) {
    const p = bySku(sku);
    const target = p?.detailsUrl
      ? resolveUrl(p.detailsUrl)
      : `product.html?sku=${encodeURIComponent(sku)}`;
    window.location.href = target;
  }

  function goDocs(sku) {
    const p = bySku(sku);

    // If you have a docs ZIP, go direct; otherwise route to docs.html
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

    window.open(target, "_blank", "noopener,noreferrer");
  }

  // ✅ IMPORTANT: event delegation so dynamic cards always work
  function wireGridClicks() {
    if (!grid) return;

    grid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const sku = btn.dataset.sku;
      if (!action || !sku) return;

      if (action === "details") goDetails(sku);
      else if (action === "docs") goDocs(sku);
      else if (action === "trial") downloadTrial(sku);
    });
  }

  function wireSearch() {
    if (!search) return;

    search.addEventListener("input", () => {
      const q = String(search.value || "").trim().toLowerCase();
      if (!q) filtered = products.slice();
      else {
        filtered = products.filter((p) => {
          const hay = `${p.sku} ${p.name} ${p.summary}`.toLowerCase();
          return hay.includes(q);
        });
      }
      renderGrid(filtered);
    });
  }

  function wireDocsDropdown() {
    if (!docSelect) return;

    docSelect.addEventListener("change", () => {
      const sku = docSelect.value;
      const p = sku ? bySku(sku) : null;

      setLinkEnabled(btnDocDownload, p?.docsZip ? resolveUrl(p.docsZip) : "");
      setLinkEnabled(btnPriceList, p?.priceListPdf ? resolveUrl(p.priceListPdf) : "");
    });
  }

  // Optional contact posting
  function wireContact() {
    if (!contactForm) return;

    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!CONTACT_ENDPOINT) {
        if (contactMsg) contactMsg.textContent = "Contact form not configured yet.";
        return;
      }

      const fd = new FormData(contactForm);
      const payload = Object.fromEntries(fd.entries());

      try {
        if (contactMsg) contactMsg.textContent = "Sending…";

        const res = await fetch(CONTACT_ENDPOINT, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        if (contactMsg) contactMsg.textContent = "Sent! We’ll get back to you shortly.";
        contactForm.reset();
      } catch (err) {
        console.error(err);
        if (contactMsg) contactMsg.textContent = "Failed to send. Please WhatsApp or email us.";
      }
    });
  }

  async function loadProducts() {
    const res = await fetch(PRODUCTS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load products: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.products || []);
  }

  async function init() {
    wireGridClicks();
    wireSearch();
    wireDocsDropdown();
    wireContact();

    try {
      products = await loadProducts();
      filtered = products.slice();

      renderGrid(filtered);
      renderDocsSelect(products);
    } catch (err) {
      console.error(err);
      if (grid) grid.innerHTML = `<div class="muted" style="padding:16px">Failed to load products.</div>`;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
