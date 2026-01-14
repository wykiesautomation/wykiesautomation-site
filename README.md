# Wykies Automation (Public Site) — Gallery Captions from Google Sheets

This site is hosted on **GitHub Pages** and loads Gallery captions from **Google Sheets** via **Apps Script** and a **Cloudflare Worker** proxy endpoint.

## Recommended Schema (Google Sheet)
Create a sheet named **Gallery** with these columns:

- `orderIndex` (number)
- `imageUrl` (string URL to image)
- `caption` (plain text, max 120 chars)
- `active` (TRUE/FALSE)

## Endpoints
- Public site requests: **/api/gallery**
- Cloudflare Worker proxies to: Apps Script Web App `.../exec?action=gallery`

## Setup Steps
1. Deploy Apps Script as a Web App (Execute as: Me, Who has access: Anyone).
2. In Cloudflare, create a Worker with route: `wykiesautomation.co.za/api/*`
3. Paste `docs/worker.js` into the Worker and confirm `SCRIPT_URL` matches your Apps Script URL.
4. Publish this repo to GitHub Pages.

## Local fallback
If `/api/gallery` fails, the site falls back to `data/gallery.json`.
