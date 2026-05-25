(function(){
  'use strict';
  function ready(fn){if(document.readyState!=='loading')fn();else document.addEventListener('DOMContentLoaded',fn);}

  function injectHamburger(){
    var headerRow=document.querySelector('.site-header .row');
    var nav=document.querySelector('.site-header .site-nav');
    if(!headerRow||!nav)return;
    if(headerRow.querySelector('.nav-toggle'))return;
    var btn=document.createElement('button');
    btn.className='nav-toggle';
    btn.setAttribute('aria-label','Open menu');
    btn.setAttribute('aria-expanded','false');
    btn.setAttribute('aria-controls','site-nav');
    btn.innerHTML='<span></span><span></span><span></span>';
    function close(){nav.classList.remove('is-open');btn.classList.remove('is-open');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-label','Open menu');document.body.classList.remove('nav-open');}
    btn.addEventListener('click',function(){
      var open=!nav.classList.contains('is-open');
      nav.classList.toggle('is-open',open);
      btn.classList.toggle('is-open',open);
      btn.setAttribute('aria-expanded',String(open));
      btn.setAttribute('aria-label',open?'Close menu':'Open menu');
      document.body.classList.toggle('nav-open',open);
    });
    nav.querySelectorAll('a').forEach(function(a){a.addEventListener('click',close);});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
    headerRow.appendChild(btn);
  }

  function setYear(){document.querySelectorAll('[data-year]').forEach(function(el){el.textContent=String(new Date().getFullYear());});}

  function setActiveNav(){
    var path=location.pathname.replace(/\/+$/, '')||'/';
    document.querySelectorAll('.site-nav a').forEach(function(a){
      var href=a.getAttribute('href')||'';
      var p=href.replace(/\/+$/, '')||'/';
      if(p===path||(p!=='/'&&path.startsWith(p))){a.setAttribute('aria-current','page');}
    });
  }

  ready(function(){injectHamburger();setYear();setActiveNav();});
})();
