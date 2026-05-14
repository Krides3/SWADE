/* page-boot.js — shared auth guard, admin-nav reveal, loader dismiss.
   Included by all root-level game pages (after auth.js, before nav.js).
   Handles missing elements gracefully — safe on any page. */
(function () {
    'use strict';
    LuxorAuth.requireAuth('login.html');
    var s = LuxorAuth.getSession();
    if (s && LuxorAuth.isAdmin()) {
        var al = document.getElementById('admin-nav-link');
        if (al) al.style.display = 'block';
    }
    setTimeout(function () {
        var l = document.getElementById('page-loader');
        if (l) { l.classList.add('ml-out'); setTimeout(function () { l.remove(); }, 420); }
    }, 680);
})();
