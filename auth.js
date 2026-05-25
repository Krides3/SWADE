// ================================================================
//  LUXOR AUTH — User authentication for SWADE Tactical Terminal
//  Simplified: Callsign only, no passwords required.
// ================================================================
(function () {
    'use strict';

    const STORE_KEY   = 'luxorUsers';
    const SESSION_KEY = 'luxorSession';

    function getUsers() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
        catch (e) { return []; }
    }

    function saveUsers(u) {
        localStorage.setItem(STORE_KEY, JSON.stringify(u));
    }

    // Default roster — DAGGER SQUAD + HANDLERS
    const DEFAULT_USERS = [
        {"username":"OVERLORD","role":"admin","clearance":5, "isRestricted": false},
        {"username":"HADES","role":"admin","clearance":5, "isRestricted": true},
        {"username":"HEEST","role":"player","clearance":1, "isRestricted": true},
        {"username":"BINGO","role":"player","clearance":1, "isRestricted": true},
        {"username":"CINDER","role":"player","clearance":1, "isRestricted": true},
        {"username":"RIG","role":"player","clearance":1, "isRestricted": true},
        {"username":"HARMLESS","role":"player","clearance":1, "isRestricted": true},
        {"username":"JOKER","role":"player","clearance":1, "isRestricted": true},
        {"username":"LANCE","role":"player","clearance":1, "isRestricted": true},
        {"username":"LIBRE","role":"player","clearance":1, "isRestricted": true},
        {"username":"ZED","role":"player","clearance":1, "isRestricted": true}
    ];

    // Sync default accounts on every page load — adds missing
    function ensureDefaults() {
        const users = getUsers();
        let changed = false;
        DEFAULT_USERS.forEach(function (def) {
            const idx = users.findIndex(u => u.username === def.username);
            if (idx === -1) {
                users.push(Object.assign({}, def));
                changed = true;
            }
        });
        if (changed) saveUsers(users);
    }

    function ensureOverlord() { ensureDefaults(); }

    function getSession() {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
        catch (e) { return null; }
    }

    function isAdmin() {
        const s = getSession();
        return !!(s && s.role === 'admin');
    }

    // Call on every protected page.
    function requireAuth(loginUrl) {
        ensureOverlord();
        if (!getSession()) {
            window.location.replace(loginUrl || 'login.html');
            return false;
        }
        return true;
    }

    function login(username) {
        ensureOverlord();
        const users = getUsers();
        const user  = users.find(u => u.username === username.toUpperCase().trim());
        if (!user) {
            return { ok: false, error: 'ACCESS DENIED — UNKNOWN CALLSIGN' };
        }
        const session = { 
            username: user.username, 
            role: user.role, 
            clearance: user.clearance,
            isRestricted: user.isRestricted ?? true 
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { ok: true, session };
    }

    function logout(loginUrl) {
        localStorage.removeItem(SESSION_KEY);
        window.location.replace(loginUrl || 'login.html');
    }

    // ── User management (admin only) ────────────────────────────────

    function createUser(username, clearance) {
        if (!isAdmin()) return { ok: false, error: 'NOT AUTHORIZED' };
        const upper = username.toUpperCase().trim();
        if (!upper || upper.length < 2)    return { ok: false, error: 'USERNAME TOO SHORT (min 2)' };
        const cl = parseInt(clearance, 10);
        if (isNaN(cl) || cl < 1 || cl > 5) return { ok: false, error: 'CLEARANCE MUST BE 1–5' };
        const users = getUsers();
        if (users.find(u => u.username === upper)) return { ok: false, error: 'USER ALREADY EXISTS' };
        users.push({ username: upper, role: 'player', clearance: cl });
        saveUsers(users);
        return { ok: true };
    }

    function deleteUser(username) {
        if (!isAdmin()) return { ok: false, error: 'NOT AUTHORIZED' };
        if (username === 'OVERLORD') return { ok: false, error: 'CANNOT DELETE OVERLORD' };
        saveUsers(getUsers().filter(u => u.username !== username));
        return { ok: true };
    }

    function updateClearance(username, clearance) {
        if (!isAdmin()) return { ok: false, error: 'NOT AUTHORIZED' };
        if (username === 'OVERLORD') return { ok: false, error: 'OVERLORD CLEARANCE IS FIXED AT 5' };
        const cl = parseInt(clearance, 10);
        if (isNaN(cl) || cl < 1 || cl > 5) return { ok: false, error: 'CLEARANCE MUST BE 1–5' };
        const users = getUsers();
        const user  = users.find(u => u.username === username);
        if (!user) return { ok: false, error: 'USER NOT FOUND' };
        user.clearance = cl;
        saveUsers(users);
        return { ok: true };
    }

    window.LuxorAuth = {
        login, logout, getSession, isAdmin, requireAuth,
        getUsers, createUser, deleteUser, updateClearance,
        ensureOverlord
    };
})();
