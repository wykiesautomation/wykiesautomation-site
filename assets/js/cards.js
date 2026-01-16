
(function(){
  function setHref(el, href){ if (el && href){ el.setAttribute('href', href); } }
  document.addEventListener('DOMContentLoaded', function(){
    var cards = document.querySelectorAll('.product-card');
    cards.forEach(function(card){
      var sku   = (card.getAttribute('data-sku')||'').toUpperCase();
      var doc   = card.getAttribute('data-doc');
      var trial = card.getAttribute('data-trial');

      var aDetails = card.querySelector('.view-details');
      var aDocs    = card.querySelector('.view-docs');
      var aTrial   = card.querySelector('.download-trial');
      var aBuy     = card.querySelector('.buy');

      if (sku && aDetails && !aDetails.getAttribute('href')){
        setHref(aDetails, '/products/' + sku.toLowerCase() + '/');
      }
      if (doc && aDocs){ setHref(aDocs, doc); }
      if (trial && aTrial){ setHref(aTrial, trial); }
      if (sku && aBuy){ setHref(aBuy, 'https://pay.wykiesautomation.co.za/checkout?sku=' + encodeURIComponent(sku)); }
    });

    // Allow button clicks even if some global overlay is present
    document.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('.btn');
      if (btn) { return; }
    }, { capture: true });
  });
})();
