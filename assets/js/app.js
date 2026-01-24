
async function apiPost(obj) {
  const cfg = await loadConfig();

  // ✅ SPECIAL CASE: checkout must NOT use fetch (CORS will block it)
  if ((obj.action || '') === 'createCheckout') {
    // This submits as a normal navigation POST to Apps Script (no CORS)
    submitPostForm(cfg.APPS_SCRIPT_URL, obj);
    // We are navigating away, so no return value is needed.
    return;
  }

  // ⚠️ Everything else still uses fetch (will still be CORS-blocked
  // on the public site unless you later implement JSONP or a proxy).
  const res = await fetch(cfg.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(obj)
  });

  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return txt; }
}

// Helper: standard browser form POST (bypasses CORS)
function submitPostForm(url, data) {
  const f = document.createElement('form');
  f.method = 'POST';
  f.action = url;
  f.style.display = 'none';

  for (const [k, v] of Object.entries(data)) {
    const i = document.createElement('input');
    i.type = 'hidden';
    i.name = k;
    i.value = (v ?? '').toString();
    f.appendChild(i);
  }

  document.body.appendChild(f);
  f.submit();
}
