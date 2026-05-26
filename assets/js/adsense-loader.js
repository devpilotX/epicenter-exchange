/* Defer AdSense to bypass the ~3s render-block hit on mobile.
   Load after first user interaction (scroll/click/touch) or 4s idle. */
(function(){
  'use strict';
  var loaded = false;
  function load(){
    if(loaded) return; loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6484525483464374';
    document.head.appendChild(s);
    ['scroll','mousemove','touchstart','keydown','click'].forEach(function(e){
      window.removeEventListener(e, load, {passive:true});
    });
  }
  ['scroll','mousemove','touchstart','keydown','click'].forEach(function(e){
    window.addEventListener(e, load, {once:true, passive:true});
  });
  setTimeout(load, 4000);
})();
