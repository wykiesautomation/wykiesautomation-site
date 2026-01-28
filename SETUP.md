# WykiesAutomation — Unified Public + Admin bundle

Generated: 2026-01-28T10:21:12.122323

## What’s included
- Public site (static)
- Admin UI (patched)
- Apps Script backend starter (`apps_script/Code.gs`) implementing Admin actions including Resend Invoice.

## You still must do these steps
1. **Deploy Apps Script as Web App** (Execute as: Me, Access: Anyone).
2. **Set Script Properties**:
   - CMS_SHEET_ID
   - TAB_PRODUCTS=Products
   - TAB_PAYMENTS=Payments
   - TAB_PRICECHANGES=PriceChanges
   - ALLOWED_ADMIN_EMAILS=wykiesautomation@gmail.com
   - INVOICE_DRIVE_FOLDER_ROOT_ID (Drive folder id of /Invoices)
   - ADMIN_EMAIL=wykiesautomation@gmail.com
   - BRAND_NAME=Wykies Automation
   - (optional) ADMIN_PASSPHRASE for fallback login
3. Ensure your **invoice PDFs** are named like `INV-xxxxx.pdf` and stored under `/Invoices/YYYY/`.
4. If you host Admin under `/admin/`, use the included `admin/index.html`. If you host it on a subdomain, move the `admin/` folder to that site and adjust paths if needed.

## Notes
- Resend Invoice searches in the year folder based on the payment timestamp.
- Public site continues to read products from the Apps Script endpoint.
