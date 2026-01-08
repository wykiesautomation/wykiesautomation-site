# Wykies Automation — Polished Front-End (Public + Admin)

This package includes a fully styled public site and admin dashboard with dynamic tab switching, gallery lightbox, demo data, and placeholders for CMS + PayFast integration.

## What’s included
- Public: Home, Gallery, Privacy, Terms, Refunds
- Admin: Dashboard, Catalog, Price Log, Payments, Pages, Settings, Audit, Gallery, Announcements, Documents
- Assets: CSS (dark slate theme), JS (tab logic, lightbox, demo CRUD), Images (logo + products)

## Go Live — Quick Steps
1. Upload this folder to your GitHub repository and enable GitHub Pages.
2. Point Cloudflare DNS to GitHub Pages; add Page Rule for admin subdomain → `/admin`.
3. Deploy Apps Script backend and update front-end to call:
   - `getProducts`, `updatePage`, `addProduct`, `updateProduct`, `deleteProduct`
   - `createPayFastRedirect` (server-side signature) and `payfastITN` handler
4. Replace Docs/Trial alerts with actual Drive links per SKU.

## Notes
- No secrets are exposed client-side. The PayFast passphrase must remain in Apps Script or a server.
- Buttons currently show demo alerts — wire them to Apps Script endpoints to make live.
