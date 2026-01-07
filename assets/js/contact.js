
(async () => {
  const cfg = await fetch('config.json').then(r=>r.json());
  const form = document.getElementById('contactForm');
  const status = document.getElementById('contactStatus');
  const emailInsteadBtn = document.getElementById('emailInstead');
  function toQuery(obj){ const p=new URLSearchParams(); Object.entries(obj).forEach(([k,v])=>{ if(v!==undefined && v!==null) p.append(k, String(v)); }); return p.toString(); }
  if (emailInsteadBtn){ emailInsteadBtn.addEventListener('click', ()=>{ window.location.href = 'mailto:wykiesautomation@gmail.com'; }); }
  if (form){ form.addEventListener('submit', async (e)=>{ e.preventDefault(); status.textContent='Sending…'; const data = Object.fromEntries(new FormData(form)); data.emailCopy = form.querySelector('input[name="emailCopy"]').checked ? 'true':'false'; data.whatsappOptIn = form.querySelector('input[name="whatsappOptIn"]').checked ? 'true':'false'; try{ const r = await fetch(`${cfg.scriptUrl}?action=sendEnquiry`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}, body: toQuery(data) }); const j = await r.json(); if (j && j.ok){ status.textContent='Message sent. We will contact you shortly.'; form.reset(); } else { status.textContent='Failed to send. Please try email or WhatsApp.'; } if (data.whatsappOptIn==='true'){ const msg = encodeURIComponent(`Hi Wykies Automation, I am ${data.name}. Product: ${data.product||'General'}. ${data.message||''}`); window.open(`https://wa.me/27716816131?text=${msg}`, '_blank'); } }catch(err){ status.textContent='Network error. Please try again.'; } }); }
})();
