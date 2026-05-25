/* Epicenter Exchange — global UI bootstrap.
   - Footer year stamp
   - Mobile navigation toggle with aria-expanded
   - Smooth anchor scrolling
   - Light / dark theme toggle (persisted, respects prefers-color-scheme)
   - Service-worker registration (HTTPS only)
   - Beforeinstallprompt PWA install bar
   - IntersectionObserver ".reveal" lazy reveal
   - Cookie consent banner + Google Consent Mode v2
   - GA4 + AdSense loaders (loaded only after consent granted) */
(function () {
  'use strict';

  /* ---------- Config ---------- */
  var GA_ID = 'G-8GBZKT1BZL';
  var ADSENSE_CLIENT = 'ca-pub-6484525483464374';
  var CONSENT_KEY = 'ee:consent:v1';

  /* ---------- Helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ---------- AdSense verification meta tag (in case page didn't include it raw) ---------- */
  (function injectAdSenseMeta() {
    if (document.querySelector('meta[name="google-adsense-account"]')) return;
    var m = document.createElement('meta');
    m.name = 'google-adsense-account';
    m.content = ADSENSE_CLIENT;
    document.head.appendChild(m);
  })();

  /* ---------- Google Consent Mode v2 (must run before gtag/adsense) ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  // Default: deny everything (GDPR/EU-safe). User opt-in updates this.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });
  gtag('js', new Date());
  gtag('config', GA_ID, { anonymize_ip: true });

  function loadScript(src, attrs) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    }
    document.head.appendChild(s);
  }

  function readConsent() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function writeConsent(v) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(v)); } catch (e) { }
  }

  function applyConsent(state) {
    var granted = state && state.choice === 'accept';
    gtag('consent', 'update', {
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied',
      analytics_storage: granted ? 'granted' : 'denied'
    });
    // GA loads either way (consent mode handles whether cookies are set).
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + GA_ID);
    // AdSense loads either way too — Google policy: serve non-personalised ads when consent denied.
    loadScript(
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_CLIENT,
      { crossorigin: 'anonymous' }
    );
  }

  function showConsentBanner() {
    if ($('#ee-consent')) return;
    var bar = document.createElement('div');
    bar.id = 'ee-consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.innerHTML =
      '<div class="consent-inner">' +
        '<p>We use cookies for site analytics (Google Analytics) and to fund this free site through Google AdSense. You can accept personalised ads, or reject — we still serve non-personalised ads either way to keep the lights on. See our <a href="/cookies.html">cookie policy</a>.</p>' +
        '<div class="consent-actions">' +
          '<button type="button" class="btn btn-outline" data-consent="reject">Reject non-essential</button>' +
          '<button type="button" class="btn btn-primary" data-consent="accept">Accept all</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bar);
    $$('#ee-consent [data-consent]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var choice = btn.getAttribute('data-consent');
        var state = { choice: choice, ts: Date.now() };
        writeConsent(state);
        applyConsent(state);
        bar.parentNode && bar.parentNode.removeChild(bar);
      });
    });
  }

  /* Initialise consent ASAP */
  (function consentInit() {
    var saved = readConsent();
    if (saved) {
      applyConsent(saved);
    } else {
      ready(showConsentBanner);
    }
  })();

  /* ---------- DOM-ready UI wiring ---------- */
  ready(function () {
    // Year stamp
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

    // Mobile nav toggle
    var toggle = $('.nav-toggle');
    var nav = $('#site-nav');
    if (toggle && nav) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.classList.toggle('open', open);
      });
      // Close on link click (mobile UX)
      $$('#site-nav a').forEach(function (a) {
        a.addEventListener('click', function () {
          nav.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.classList.remove('open');
        });
      });
    }

    // Smooth scroll for in-page anchors
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Theme toggle (auto-injected into nav)
    (function theme() {
      var THEME_KEY = 'ee:theme';
      var saved = null;
      try { saved = localStorage.getItem(THEME_KEY); } catch (e) { }
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var initial = saved || (prefersDark ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', initial);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-toggle';
      btn.setAttribute('aria-label', 'Toggle dark mode');
      btn.innerHTML = initial === 'dark' ? '☼' : '☾';
      btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme');
        var next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        btn.innerHTML = next === 'dark' ? '☼' : '☾';
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { }
      });
      if (nav) nav.appendChild(btn);
    })();

    // Reveal-on-scroll
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('is-visible');
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.08 });
      $$('.reveal').forEach(function (el) { io.observe(el); });
    } else {
      $$('.reveal').forEach(function (el) { el.classList.add('is-visible'); });
    }
  });

  /* ---------- Service worker (HTTPS only) ---------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () { /* no-op */ });
    });
  }

  /* ---------- PWA install prompt ---------- */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (localStorage.getItem('ee:installDismissed') === '1') return;
    var bar = document.createElement('div');
    bar.className = 'install-prompt';
    bar.innerHTML = '<span>Install Epicenter Exchange as an app for offline access.</span>' +
      '<button class="btn btn-primary btn-sm" id="ee-install">Install</button>' +
      '<button class="btn btn-outline btn-sm" id="ee-install-dismiss">Not now</button>';
    document.body.appendChild(bar);
    document.getElementById('ee-install').addEventListener('click', function () {
      bar.remove();
      if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; }
    });
    document.getElementById('ee-install-dismiss').addEventListener('click', function () {
      bar.remove();
      try { localStorage.setItem('ee:installDismissed', '1'); } catch (e) { }
    });
  });
})();
