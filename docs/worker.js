// Cloudflare Worker: /api/gallery -> Apps Script (adds CORS + optional caching)
// Set SCRIPT_URL to your deployed Apps Script web app URL with action=gallery.
// Example: https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=gallery

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxj61ify3rtv-e-jc3c2Xajn1hs_AhhWXaUgl-hSoVu02uzI3yPVEelsxRXxxm1ln_w/exec?action=gallery';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (url.pathname === '/api/gallery') {
      const upstream = SCRIPT_URL;
      const cacheKey = new Request(upstream, request);
      const cache = caches.default;

      let res = await cache.match(cacheKey);
      if (!res) {
        const up = await fetch(upstream);
        const body = await up.text();
        res = new Response(body, {
          status: up.status,
          headers: up.headers
        });
        // Cache 60s (tune as needed)
        res.headers.set('Cache-Control', 'public, max-age=60');
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
      }

      const out = new Response(res.body, res);
      const h = corsHeaders();
      for (const [k,v] of Object.entries(h)) out.headers.set(k, v);
      out.headers.set('Content-Type', 'application/json; charset=utf-8');
      return out;
    }

    return new Response('Not found', { status: 404 });
  }
};

function corsHeaders(){
  return {
    'Access-Control-Allow-Origin': 'https://wykiesautomation.co.za',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
