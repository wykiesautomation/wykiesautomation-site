
# Apps Script API (vv6.2.2)
1) Create a new Apps Script project, paste `apps_script/Code.gs` and `apps_script/appsscript.json`.
2) Set Script Properties:
   - SHEET_ID = 12qRMe6pAPVaQtosZBnhVtpMwyNks7W8uY9PX1mF620k
   - ADMIN_TOKEN = (same as config.json cms.token)
3) Deploy as **Web app** (Execute as: Me; Who has access: Anyone with the link). Copy the Web App URL.
4) In `config.json`, set `cms.appsScriptUrl` to that URL and set `demo=false`.
