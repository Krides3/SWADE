(function () {
    'use strict';
    LuxorAuth.requireAuth('login.html');
    var s = LuxorAuth.getSession();
    if (s) {
        var nameEl = document.getElementById('welcome-name');
        if (nameEl) nameEl.textContent = s.username;
        if (LuxorAuth.isAdmin()) {
            var adminLink = document.getElementById('admin-nav-link');
            if (adminLink) adminLink.style.display = 'block';
        }
    }
})();
