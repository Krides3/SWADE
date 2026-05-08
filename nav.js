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
    navbar.classList.contains('open') ? closeNav() : openNav();
  });

  if (overlay) overlay.addEventListener('click', closeNav);

  // Highlight current page in nav
  const links = navbar.querySelectorAll('a');
  links.forEach(function (link) {
    if (link.href === window.location.href) {
      link.classList.add('active');
    }
  });

  // Show logged-in username in nav footer
  const session   = window.LuxorAuth ? LuxorAuth.getSession() : null;
  const nameEl    = document.getElementById('nav-username');
  const logoutBtn = document.getElementById('nav-logout');

  if (nameEl && session) {
    nameEl.textContent = session.username;
  }

  if (logoutBtn) {
    // Detect subdirectory depth so logout always reaches login.html
    const depth = (window.location.pathname.match(/\//g) || []).length;
    const loginUrl = depth > 2 ? '../login.html' : 'login.html';
    logoutBtn.addEventListener('click', function () {
      LuxorAuth.logout(loginUrl);
    });
  }
});
