
const payload = await apiPost({ action:'createPayment', sku: CURRENT.sku, email });

console.log('PayFast payload:', payload); // <-- keep this for debugging

// HARD VALIDATION — prevents “No payment data received”
if (!payload || typeof payload !== 'object') throw new Error('No payload from server');
if (!payload.processUrl) throw new Error('Missing processUrl');
if (!payload.fields || typeof payload.fields !== 'object') throw new Error('Missing fields');

// Required PayFast form fields (minimum) [1](https://developers.payfast.co.za/)
const required = ['merchant_id','merchant_key','amount','item_name'];
for (const k of required) {
  if (!payload.fields[k]) throw new Error('Missing field: ' + k);
}

const form = document.createElement('form');
form.method = 'POST';
form.action = payload.processUrl;
form.acceptCharset = 'utf-8';

// Add ALL fields
Object.entries(payload.fields).forEach(([k,v]) => {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = k;
  input.value = String(v ?? '');
  form.appendChild(input);
});

document.body.appendChild(form);
form.submit();
