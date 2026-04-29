document.addEventListener('DOMContentLoaded', function () {
  const hamburger = document.getElementById('hamburger');
  const navbar    = document.getElementById('navbar');
  const overlay   = document.getElementById('nav-overlay');

  if (!hamburger || !navbar) return;

  function openNav() {
    navbar.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    hamburger.classList.add('open');
  }

  function closeNav() {
    navbar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
    hamburger.classList.remove('open');
  }

  hamburger.addEventListener('click', function () {
    navbar.classList.contains('nav-open') ? closeNav() : openNav();
  });

  if (overlay) overlay.addEventListener('click', closeNav);

  // Highlight current page in nav
  const links = navbar.querySelectorAll('a');
  links.forEach(function (link) {
    if (link.href === window.location.href) {
      link.classList.add('active');
    }
  });

  // Generate a random session ID on first load
  if (!sessionStorage.getItem('sessionId')) {
    const id = Math.random().toString(36).slice(2, 10).toUpperCase();
    sessionStorage.setItem('sessionId', id);
  }
  const sessionEl = document.querySelector('.session-id');
  if (sessionEl) sessionEl.textContent = sessionStorage.getItem('sessionId');
});
