(function () {
    'use strict';
    LuxorAuth.requireAuth('../login.html');
    var s = LuxorAuth.getSession();
    if (s) {
        var badge = document.getElementById('map-user-badge');
        if (badge) badge.textContent = '▸ ' + s.username;
    }
    var logoutBtn = document.getElementById('map-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', function () {
        LuxorAuth.logout('../login.html');
    });
})();
