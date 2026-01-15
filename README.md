# Fix: Products not showing

If products were not rendering on the main page, it was because the browser blocked the Apps Script fetch (CORS/network), causing JS to crash before the fallback list.

This bundle fixes that by wrapping Apps Script calls in try/catch and falling back to a built-in product list so the page always shows products, prices and buttons.
