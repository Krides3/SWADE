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

  // ── ACCESS CONTROL ──────────────────────────────────────────────
  const isRestricted = session && session.isRestricted === true && session.username !== 'OVERLORD';

  const isAdmin = session && session.role === 'admin';

  if (isRestricted) {
    // Hide all navigation links and show only Briefing Tool and Home
    const navUl = navbar.querySelector('.nav-links');
    if (navUl) {
      navUl.innerHTML = `
        <li><a href="index.html" data-icon="01">Terminal Home</a></li>
        <li><a href="briefing.html" data-icon="17">Briefing Tool</a></li>
        <li><a href="planning.html" data-icon="18">Planning Tool</a></li>
        ${isAdmin ? '<li><a href="operator-editor.html" data-icon="15">Operator Editor</a></li>' : ''}
      `;
    }
    // Hide Overlord panel link if it exists
    const adminLink = document.getElementById('admin-nav-link');
    if (adminLink) adminLink.style.display = 'none';

    // Redirect if on an unauthorized page
    const path = window.location.pathname.toLowerCase();
    const isAuthorized = path.includes('briefing') || path.includes('planning') || path.includes('login.html') || path.includes('index.html') || path.includes('operator-editor') || path.endsWith('/');
    
    if (!isAuthorized) {
        // Only redirect if we are NOT already on a briefing, login, or home page
        const depth = (path.match(/\//g) || []).length;
        const redirectPath = depth > 1 ? '../briefing.html' : 'briefing.html';
        window.location.replace(redirectPath);
    }
  } else {
    // For OVERLORD (or other non-restricted admins), add the Briefing Tool and Editor to the list
    const navUl = navbar.querySelector('.nav-links');
    if (navUl) {
      if (!navUl.querySelector('a[href="briefing.html"]')) {
        const li = document.createElement('li');
        li.innerHTML = '<a href="briefing.html" data-icon="17">Briefing Tool</a>';
        navUl.appendChild(li);
      }
      if (!navUl.querySelector('a[href="planning.html"]')) {
        const li = document.createElement('li');
        li.innerHTML = '<a href="planning.html" data-icon="18">Planning Tool</a>';
        navUl.appendChild(li);
      }
      if (isAdmin && !navUl.querySelector('a[href="operator-editor.html"]')) {
        const li = document.createElement('li');
        li.innerHTML = '<a href="operator-editor.html" data-icon="15">Operator Editor</a>';
        navUl.appendChild(li);
      }
    }
  }
  if (nameEl && session) {
    try {
      const dossiers = JSON.parse(localStorage.getItem('luxorDossiers') || '[]');
      const dossier  = dossiers.find(d => d.username === session.username);
      nameEl.textContent = (dossier && dossier.callsign) ? dossier.callsign : session.username;
    } catch (e) {
      nameEl.textContent = session.username;
    }
  }

  if (logoutBtn) {
    // Detect subdirectory depth so logout always reaches login.html
    // If we're in a subdirectory (like AssetMap/ or RadioScanner/), we need ../
    const path = window.location.pathname;
    const segments = path.split('/').filter(s => s.length > 0);
    // If the last segment is a file, the depth is segments.length - 1
    // But if we're at root /index.html, segments is ['index.html'], length 1, depth 0.
    // If we're at /AssetMap/AssetMap.html, segments is ['AssetMap', 'AssetMap.html'], length 2, depth 1.
    
    // Simpler: count how many steps to get back to root
    let rootPath = '';
    const depth = segments.length - (path.endsWith('/') ? 0 : 1);
    for (let i = 0; i < depth; i++) { rootPath += '../'; }
    
    const loginUrl = rootPath + 'login.html';
    
    logoutBtn.addEventListener('click', function () {
      LuxorAuth.logout(loginUrl);
    });
  }

  // When embedded in an iframe (multiview), hide sidebar nav and collapse the margin
  if (window.self !== window.top) {
    if (navbar)    navbar.style.display = 'none';
    if (hamburger) hamburger.style.display = 'none';
    const main = document.querySelector('.main');
    if (main) { main.style.marginLeft = '0'; main.style.paddingTop = '0.5rem'; }
    const navOverlay = document.getElementById('nav-overlay');
    if (navOverlay) navOverlay.style.display = 'none';
  }
});
