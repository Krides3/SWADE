(function () {
    'use strict';
    LuxorAuth.requireAuth('login.html');
    var s = LuxorAuth.getSession();
    if (s) {
        var nameEl = document.getElementById('welcome-name');
        if (nameEl) {
            try {
                var dossiers = JSON.parse(localStorage.getItem('luxorDossiers') || '[]');
                var dossier  = dossiers.find(function(d) { return d.username === s.username; });
                nameEl.textContent = (dossier && dossier.callsign) ? dossier.callsign : s.username;
            } catch(e) {
                nameEl.textContent = s.username;
            }
        }
        if (LuxorAuth.isAdmin()) {
            var adminLink = document.getElementById('admin-nav-link');
            if (adminLink) adminLink.style.display = 'block';
        }
    }
})();
