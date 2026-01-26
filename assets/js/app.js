
// START — Wykies Automation Public app.js (Patched + Syntax-safe)

(function () {
  'use strict';

  // ====== CONFIG ======
  var WA = {
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwO16jzeQVcsNt4zOj-YQ8LndsMgaTk089QZkgkb0YrxVf8IbxQi9fnK_1mL9q83d8_LA/exec',
    WHATSAPP: '27716816131',
    SUPPORT_EMAIL: 'wykiesautomation@gmail.com'
  };

  // ====== DOM HELPERS ======
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function toast(msg) {
    var t = $('#toast');
    if (!t) { console.log(msg); return; }
    t.textContent = msg;
    t.style.display = 'block';
    setTimeout(function () { t.style.display = 'none'; }, 2400);
  }

  function escapeHtml(s) {
    s = String(s == null ? '' : s);
    return s.replace(/[&<>]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c];
    });
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  function formatMoney(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
    return isFinite(n) ? n.toFixed(2) : '0.00';
  }

  function isHttpUrl(u) {
    return /^https?:\/\//i.test(u || '');
  }

  // If incoming value is filename-only (wa-01.PNG), prefix with folder (assets/product/)
  function normalizeAsset(u, folder) {
    if (!u) return '';
    if (isHttpUrl(u) || u.indexOf('assets/') === 0) return u;
    return folder + u;
  }

  // Try candidates in order; if one fails, move to next (handles .PNG vs .png)
  function setImgWithFallback(imgEl, candidates) {
    var i = 0;
    if (!imgEl || !candidates || !candidates.length) return;

    imgEl.onerror = function () {
      i += 1;
      if (i < candidates.length) {
        imgEl.src = candidates[i];
      }
    };
    imgEl.src = candidates[0];
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  // ====== STATE ======
  var PRODUCTS = [];
  var CURRENT_BUY = null;

  // ====== INIT ======
  document.addEventListener('DOMContentLoaded', function () {
    bindUI();
    loadProducts();
    patchStaticGalleryIfNeeded();
  });

  // ====== UI BINDINGS ======
  function bindUI() {
    // Modal close
    var modal = $('#modalCheckout');
    var closeBtn = $('#btnCloseModal');
    if (modal && closeBtn) {
      closeBtn.addEventListener('click', function () { modal.classList.remove('open'); });
    }

    // Pay button
    var btnPay = $('#btnPay');
    if (btnPay) {
      btnPay.addEventListener('click', proceedToPayFast);
    }

    // Search
    var search = $('#search');
    if (search) {
      search.addEventListener('input', debounce(function () {
        renderGrid(filterProducts(search.value));
      }, 120));
    }

    // Docs dropdown
    var docSelect = $('#docSelect');
    var btnDoc = $('#btnDocDownload');
    if (docSelect && btnDoc) {
      docSelect.addEventListener('change', function () {
        var sku = docSelect.value;
        var p = findBySku(sku);
        if (p && p.docUrl) btnDoc.href = p.docUrl;
      });
    }

    // Contact form (optional)
    var form = $('#contactForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var payload = {
          name: (form.querySelector('[name=name]') || {}).value || '',
          email: (form.querySelector('[name=email]') || {}).value || '',
          message: (form.querySelector('[name=message]') || {}).value || ''
        };
        apiContact(payload).then(function (ok) {
          var msg = $('#contactMsg');
          if (msg) msg.textContent = ok ? 'Sent. We will respond soon.' : 'Could not send. Please WhatsApp us.';
          if (ok) form.reset();
        });
      });
    }
  }

  // ====== PRODUCTS ======
  function loadProducts() {
    apiGetProducts().then(function (list) {
      PRODUCTS = list || [];
      renderGrid(PRODUCTS);
      populateDocsDropdown(PRODUCTS);
      renderProductDetailIfNeeded(PRODUCTS);
    });
  }

  function findBySku(sku) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].sku === sku) return PRODUCTS[i];
    }
    return null;
  }

  function filterProducts(q) {
    q = (q || '').toLowerCase().trim();
    if (!q) return PRODUCTS;
    var out = [];
    for (var i = 0; i < PRODUCTS.length; i++) {
      var p = PRODUCTS[i];
      var hay = (p.sku + ' ' + (p.name || '') + ' ' + (p.summary || '')).toLowerCase();
      if (hay.indexOf(q) >= 0) out.push(p);
    }
    return out;
  }

  // Render product cards
  function renderGrid(list) {
    var grid = $('#grid');
    if (!grid) return;

    grid.innerHTML = '';
    list = list || [];

    for (var i = 0; i < list.length; i++) {
      (function (p) {
        var skuLower = (p.sku || '').toLowerCase();

        // Normalize product imageUrl (fixes your console 404s: it was requesting wa-01.PNG at root)
        var img1 = normalizeAsset(p.imageUrl, 'assets/product/');
        var img2 = normalizeAsset(p.ogImage, 'assets/product/');
        var guessPNG = 'assets/product/' + skuLower + '.PNG';
        var guessPng = 'assets/product/' + skuLower + '.png';

        var candidates = [];
        if (img1) candidates.push(img1);
        if (img2) candidates.push(img2);
        candidates.push(guessPNG);
        candidates.push(guessPng);

        var card = document.createElement('div');
        card.className = 'card pad';

        card.innerHTML =
          "<img class=\"prod-img\" alt=\"" + escapeAttr(p.sku) + "\" loading=\"lazy\">" +
          "<div style=\"margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap\">" +
          "  <div>" +
          "    <div class=\"small\"><span class=\"kbd\">" + escapeHtml(p.sku) + "</span></div>" +
          "    <strong style=\"display:block;margin-top:6px\">" + escapeHtml(p.name || '') + "</strong>" +
          "    <div class=\"muted\" style=\"font-size:13px;margin-top:6px\">" + escapeHtml(p.summary || '') + "</div>" +
          "  </div>" +
          "  <div style=\"text-align:right\">" +
          "    <div class=\"small\">Price (incl. VAT)</div>" +
          "    <div style=\"font-size:18px;font-weight:800\">R " + formatMoney(p.price) + "</div>" +
          "  </div>" +
          "</div>" +
          "<div class=\"btnrow\" style=\"margin-top:12px\">" +
          "  <button class=\"btn primary\" type=\"button\" data-buy=\"1\">Buy Now</button>" +
          "  <a class=\"btn outline\" href=\"product.html?id=" + encodeURIComponent(p.sku) + "\">Details</a>" +
          "  <a class=\"btn outline\" href=\"" + escapeAttr(p.docUrl || 'docs.html') + "\" target=\"_blank\" rel=\"noopener\">View Docs</a>" +
          "  <a class=\"btn outline\" href=\"" + escapeAttr(p.trialUrl || 'trial.html') + "\" target=\"_blank\" rel=\"noopener\">Download Trial</a>" +
          "</div>";

        grid.appendChild(card);

        // Set image with fallback (handles .PNG/.png on case-sensitive hosts)
        var imgEl = card.querySelector('img.prod-img');
        setImgWithFallback(imgEl, candidates);

        // Buy handler
        var buyBtn = card.querySelector('[data-buy="1"]');
        if (buyBtn) {
          buyBtn.addEventListener('click', function () { openCheckout(p); });
        }
      })(list[i]);
    }
  }

  function populateDocsDropdown(list) {
    var docSelect = $('#docSelect');
    if (!docSelect) return;

    docSelect.innerHTML = '';
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var opt = document.createElement('option');
      opt.value = p.sku;
      opt.textContent = p.sku + ' — ' + (p.name || '');
      docSelect.appendChild(opt);
    }

    var btnDoc = $('#btnDocDownload');
    if (btnDoc && list[0] && list[0].docUrl) btnDoc.href = list[0].docUrl;
  }

  // ====== PRODUCT DETAIL PAGE ======
  function renderProductDetailIfNeeded(list) {
    var box = $('#productDetail');
    if (!box) return;

    var params = new URLSearchParams(location.search);
    var sku = params.get('id') || params.get('sku');
    var p = null;

    for (var i = 0; i < list.length; i++) {
      if (list[i].sku === sku) { p = list[i]; break; }
    }
    if (!p) p = list[0];
    if (!p) return;

    var skuLower = (p.sku || '').toLowerCase();

    var imgCandidates = [
      normalizeAsset(p.imageUrl, 'assets/product/'),
      'assets/product/' + skuLower + '.PNG',
      'assets/product/' + skuLower + '.png'
    ].filter(Boolean);

    // Gallery images: prefer p.images[], otherwise fallback to wa-xx-01.PNG/.png
    var gallery = [];
    if (p.images && p.images.length) {
      for (var g = 0; g < p.images.length; g++) {
        gallery.push(normalizeAsset(p.images[g], 'assets/gallery/'));
      }
    } else {
      gallery.push('assets/gallery/' + skuLower + '-01.PNG');
      gallery.push('assets/gallery/' + skuLower + '-01.png');
    }

    box.innerHTML =
      "<div class=\"grid\" style=\"grid-template-columns:1.1fr .9fr;gap:14px\">" +
      "  <div class=\"card pad\">" +
      "    <div class=\"small\">" + escapeHtml(p.sku) + "</div>" +
      "    <h2 style=\"margin:6px 0 8px\">" + escapeHtml(p.name || '') + "</h2>" +
      "    <div class=\"muted\">" + escapeHtml(p.description || p.summary || '') + "</div>" +
      "    <div class=\"btnrow\" style=\"margin-top:12px\">" +
      "      <button class=\"btn primary\" type=\"button\" id=\"buyNow\">Buy Now</button>" +
      "      <a class=\"btn outline\" href=\"" + escapeAttr(p.docUrl || '#') + "\" target=\"_blank\" rel=\"noopener\">View Docs</a>" +
      "      <a class=\"btn outline\" href=\"" + escapeAttr(p.trialUrl || '#') + "\" target=\"_blank\" rel=\"noopener\">Download Trial</a>" +
      "    </div>" +
      "  </div>" +
      "  <div class=\"card pad\">" +
      "    <img id=\"detailImg\" class=\"prod-img\" alt=\"" + escapeAttr(p.sku) + "\">" +
      "    <div style=\"margin-top:10px\"><div class=\"small\">Price (incl. VAT)</div><div style=\"font-size:22px;font-weight:800\">R " + formatMoney(p.price) + "</div></div>" +
      "  </div>" +
      "</div>" +
      "<div class=\"section\" style=\"padding-top:14px\">" +
      "  <h3 style=\"margin:0 0 10px\">Gallery</h3>" +
      "  <div class=\"grid cols-3\" id=\"galGrid\"></div>" +
      "</div>";

    var detailImg = $('#detailImg');
    setImgWithFallback(detailImg, imgCandidates);

    var galGrid = $('#galGrid');
    if (galGrid) {
      // show first 6 entries max
      var max = Math.min(6, gallery.length);
      for (var k = 0; k < max; k++) {
        (function (u) {
          var a = document.createElement('a');
          a.className = 'card pad';
          a.style.textDecoration = 'none';
          a.href = u;
          a.target = '_blank';
          a.rel = 'noopener';

          var img = document.createElement('img');
          img.className = 'prod-img';
          img.alt = p.sku + ' gallery';

          // try both .PNG and .png
          var cand = [u];
          if (u.slice(-4) === '.PNG') cand.push(u.slice(0, -4) + '.png');
          if (u.slice(-4) === '.png') cand.push(u.slice(0, -4) + '.PNG');

          setImgWithFallback(img, cand);
          a.appendChild(img);
          galGrid.appendChild(a);
        })(gallery[k]);
      }
    }

    var buyNow = $('#buyNow');
    if (buyNow) buyNow.addEventListener('click', function () { openCheckout(p); });
  }

  // ====== STATIC gallery.html PATCH (in case your gallery.html still hardcodes wrong paths) ======
  function patchStaticGalleryIfNeeded() {
    if (!location.pathname || location.pathname.indexOf('gallery.html') < 0) return;

    var imgs = $all('img.prod-img');
    if (!imgs.length) return;

    imgs.forEach(function (img) {
      var src = img.getAttribute('src') || '';
      // If it is using wa-xx.PNG filename only or product folder, fix it to assets/gallery/wa-xx-01.PNG
      var m = src.match(/wa-(\\d{2})(?:-01)?\\.(PNG|png)$/);
      if (!m) return;

      var skuLower = 'wa-' + m[1];
      var candidates = [
        'assets/gallery/' + skuLower + '-01.PNG',
        'assets/gallery/' + skuLower + '-01.png'
      ];
      setImgWithFallback(img, candidates);

      // also patch link wrapper if it exists
      var parent = img.closest('a');
      if (parent) parent.href = candidates[0];
    });
  }

  // ====== CHECKOUT MODAL ======
  function openCheckout(p) {
    CURRENT_BUY = p;
    var modal = $('#modalCheckout');
    if (!modal) return;

    var skuEl = $('#buySku');
    var nameEl = $('#buyName');
    if (skuEl) skuEl.textContent = p.sku;
    if (nameEl) nameEl.textContent = p.name || '';

    modal.classList.add('open');
  }

  
function proceedToPayFast() {
  if (!CURRENT_BUY) return;

  // 1) Read and validate email (simple + robust)
  var emailEl = document.querySelector('#buyerEmail');
  var email = (emailEl ? emailEl.value : '').trim();

  // Accept "name@domain.tld" (e.g., gmail.com, co.za, etc.)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast('Please enter a valid email');
    return;
  }

  // 2) Request PayFast form fields from Apps Script
  apiCreatePayment(CURRENT_BUY.sku, email)
    .then(function (resp) {
      if (!resp || !resp.processUrl || !resp.fields) {
        toast('Checkout not available. Try again.');
        return;
      }

      // Optional: inspect what we will POST to PayFast
      console.log('PayFast processUrl:', resp.processUrl);
      console.log('PayFast fields:', resp.fields);

      // 3) Build a form and POST to PayFast
      var form = document.createElement('form');
      form.method = 'post';
      form.action = resp.processUrl;

      Object.keys(resp.fields).forEach(function (k) {
        var inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = k;
        inp.value = String(resp.fields[k]);
        form.appendChild(inp);
      });

      document.body.appendChild(form);
      form.submit();
    })
    .catch(function (err) {
      console.error(err);
      toast('Checkout error. Please try again.');
    });
}

  // ====== API ======
  function apiGetProducts() {
    // try op= first, then action=
    var urlA = WA.APPS_SCRIPT_URL + '?op=products';
    var urlB = WA.APPS_SCRIPT_URL + '?action=products';

    return tryJson(urlA).then(function (j) {
      if (j) return normalizeProducts(j);
      return tryJson(urlB).then(function (j2) {
        return normalizeProducts(j2 || []);
      });
    });
  }

  function normalizeProducts(arr) {
    if (!Array.isArray(arr)) return [];
    var out = [];

    for (var i = 0; i < arr.length; i++) {
      var p = arr[i] || {};
      var sku = p.sku || p.SKU || '';
      if (!sku) continue;

      out.push({
        sku: sku,
        name: p.name || p.Name || '',
        price: p.price || p.Price || p.TotalInclVAT || '',
        summary: p.summary || p.Summary || '',
        description: p.description || p.Description || '',
        docUrl: p.docUrl || p.DocUrl || '',
        trialUrl: p.trialUrl || p.TrialUrl || '',
        imageUrl: p.imageUrl || p.ImageUrl || p.image || '',
        ogImage: p.ogImage || p.OGImage || '',
        images: p.images || p.Images || []
      });
    }
    return out;
  }

  function apiCreatePayment(sku, email) {
    var q = 'sku=' + encodeURIComponent(sku) + '&email=' + encodeURIComponent(email) + '&env=live';
    var urlA = WA.APPS_SCRIPT_URL + '?op=createPayment&' + q;
    var urlB = WA.APPS_SCRIPT_URL + '?action=createPayment&' + q;

    return tryJson(urlA).then(function (j) {
      if (j) return j;
      return tryJson(urlB).then(function (j2) { return j2; });
    });
  }

  function apiContact(payload) {
    return tryPost('op=contact', payload).then(function (t) {
      if (t) return true;
      return tryPost('action=contact', payload).then(function (t2) { return !!t2; });
    });
  }

  function tryJson(url) {
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function tryPost(prefix, payload) {
    var body = new URLSearchParams(prefix);
    Object.keys(payload || {}).forEach(function (k) { body.append(k, payload[k]); });

    return fetch(WA.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body
    })
      .then(function (r) { return r.ok ? r.text() : null; })
      .catch(function () { return null; });
  }

})();

// END
