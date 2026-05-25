// Epicenter Exchange — main client script
// - Injects a mobile hamburger button into the site nav
// - Wires up small UI helpers

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function injectHamburger() {
    var header = document.querySelector('.site-header');
    var nav = document.querySelector('.site-header .site-nav');
    if (!header || !nav) return;
    if (header.querySelector('.nav-toggle')) return; // already there

    var btn = document.createElement('button');
    btn.className = 'nav-toggle';
    btn.setAttribute('aria-label', 'Open menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'site-nav');
    btn.innerHTML = '<span></span><span></span><span></span>';

    nav.id = nav.id || 'site-nav';

    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      btn.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('nav-open', open);
    });

    // Close on link click (mobile UX)
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        if (nav.classList.contains('is-open')) {
          nav.classList.remove('is-open');
          btn.classList.remove('is-open');
          btn.setAttribute('aria-expanded', 'false');
          document.body.classList.remove('nav-open');
        }
      });
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        btn.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('nav-open');
      }
    });

    header.insertBefore(btn, nav);
  }

  function setYear() {
    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  ready(function () {
    injectHamburger();
    setYear();
  });
})();
