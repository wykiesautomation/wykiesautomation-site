
(function(){
  function show(tab){['dashboard','products','gallery','payments','logs','settings'].forEach(t=>{document.getElementById('view-'+t).style.display=(t===tab?'block':'none');});
    document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active', el.dataset.tab===tab));}
  document.querySelectorAll('.tab').forEach(el=>el.addEventListener('click',()=>show(el.dataset.tab)));
  show('dashboard');
})();
