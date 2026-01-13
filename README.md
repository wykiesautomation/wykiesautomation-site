
# WykiesAutomation.co.za — v6.2.2 Final (Public + Admin CRUD with API fallback)

## Deploy (GitHub Pages)
1. Upload this ZIP to your repository root on branch `main`.
2. Settings → Pages → Source: Deploy from a branch → Branch `main` → Folder `/`.
3. (Optional) `CNAME` is set to `wykiesautomation.co.za`.

## Go Live with Admin (Apps Script)
- Follow `apps_script/README.md` to deploy the backend and set `config.json` → `cms.appsScriptUrl` and `demo:false`.
- In demo mode, the Admin edits a **draft** in localStorage and allows **Export/Import config.json**.

## Folder structure
```
/admin/index.html
/admin/assets/css/admin.css
/admin/assets/js/admin.js
/assets/css/styles.css
/assets/js/app.js, product.js, gallery.js
/assets/img/wa-*.png, logo-blue.png, placeholder.png
/apps_script/Code.gs, appsscript.json
/config.json
```
