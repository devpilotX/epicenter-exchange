// Highlight active nav link
document.querySelectorAll('header.nav nav a').forEach(a => {
  if (a.getAttribute('href') === location.pathname.split('/').pop() || (location.pathname === '/' && a.getAttribute('href') === 'index.html')) {
    a.classList.add('active');
  }
});

// Year stamp
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

// Smooth-scroll for in-page anchors
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({behavior:'smooth'}); }
  });
});
