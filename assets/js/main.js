/* Epicenter Exchange — main.js v2
   Mobile nav, year stamper, smooth scroll, SW registration, theme toggle,
   install prompt. Defer-loaded; safe to run on any page.
*/
(function () {
  'use strict';

  /* ---------- 1. Year stamper ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- 2. Mobile nav ---------- */
  var navToggle = document.querySelector('.nav-toggle');
  var siteNav = document.getElementById('site-nav') || document.querySelector('.site-nav');
  function closeNav() {
    if (!navToggle || !siteNav) return;
    navToggle.classList.remove('is-open');
    siteNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  }
  if (navToggle && siteNav) {
    navToggle.setAttribute('aria-controls', siteNav.id || 'site-nav');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.addEventListener('click', function (e) {
      e.preventDefault();
      var open = navToggle.classList.toggle('is-open');
      siteNav.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('nav-open', open);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });
    siteNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        if (window.matchMedia('(max-width: 880px)').matches) closeNav();
      });
    });
  }

  /* ---------- 3. Smooth scroll for in-page anchors ---------- */
  document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  /* ---------- 4. Theme toggle (injected into nav) ---------- */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('ee-theme', t); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0A1224' : '#0B1F3A');
  }
  var saved = null;
  try { saved = localStorage.getItem('ee-theme'); } catch (e) {}
  var initial = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(initial);

  if (siteNav && !document.querySelector('.theme-toggle')) {
    var btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.innerHTML = initial === 'dark' ? '☀️' : '🌙';
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(cur);
      btn.innerHTML = cur === 'dark' ? '☀️' : '🌙';
    });
    var ctaBtn = siteNav.querySelector('a.btn');
    if (ctaBtn) siteNav.insertBefore(btn, ctaBtn); else siteNav.appendChild(btn);
  }

  /* ---------- 5. Service worker (PWA) ---------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  /* ---------- 6. Install prompt ---------- */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (sessionStorage.getItem('ee-install-dismissed') === '1') return;
    var bar = document.createElement('div');
    bar.className = 'install-prompt show';
    bar.innerHTML = '<span>Install Epicenter Exchange as an app</span>'
      + '<button type="button" data-install>Install</button>'
      + '<button type="button" class="close" data-dismiss aria-label="Dismiss">×</button>';
    document.body.appendChild(bar);
    bar.querySelector('[data-install]').addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        bar.remove();
      });
    });
    bar.querySelector('[data-dismiss]').addEventListener('click', function () {
      try { sessionStorage.setItem('ee-install-dismissed', '1'); } catch (e) {}
      bar.remove();
    });
  });

  /* ---------- 7. Lazy reveal for any .reveal element ---------- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  }
})();
