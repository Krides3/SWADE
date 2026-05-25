// ================================================================
//  LUXOR AUTH — User authentication for SWADE Tactical Terminal
//  Source of Truth: Convex Operators Table
// ================================================================
(function () {
    'use strict';

    const SESSION_KEY = 'luxorSession';

    function getSession() {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
        catch (e) { return null; }
    }

    function isAdmin() {
        const s = getSession();
        return !!(s && s.role === 'admin');
    }

    /**
     * Auth guard for protected pages.
     */
    function requireAuth(loginUrl) {
        if (!getSession()) {
            window.location.replace(loginUrl || 'login.html');
            return false;
        }
        return true;
    }

    /**
     * Establish a local session after Convex validation.
     * @param {Object} user - The operator object from Convex.
     */
    function establishSession(user) {
        const session = { 
            username: user.callsign.toUpperCase(), 
            role: user.role, 
            clearance: user.clearance,
            isRestricted: user.isRestricted ?? true 
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { ok: true, session };
    }

    /**
     * Clears session and redirects.
     */
    function logout(loginUrl) {
        localStorage.removeItem(SESSION_KEY);
        window.location.replace(loginUrl || 'login.html');
    }

    window.LuxorAuth = {
        logout, getSession, isAdmin, requireAuth, establishSession
    };
})();
