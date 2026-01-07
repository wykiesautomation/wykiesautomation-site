
Unified v6.4 build — CMS-driven product buttons + Floating WhatsApp

Products sheet columns expected (case-insensitive):
  sku | name | price | summary | description | imageUrl | trialUrl | docUrl | buyUrl | active
If trial/doc/buy URLs are blank, buttons still render with '#'.

Public fetch:
  GET {scriptUrl}?action=listproducts_public&sheetId={sheetId}

Admin edit/add prompts for: name, price, imageUrl, trialUrl, docUrl, buyUrl.

Floating WhatsApp:
  Fixed FAB bottom-right linking to wa.me/+27716816131.
