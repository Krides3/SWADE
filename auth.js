// ================================================================
//  LUXOR AUTH — User authentication for SWADE Tactical Terminal
//  Default OVERLORD password: overlord
//  Change it immediately via the Admin Panel after first login.
// ================================================================
(function () {
    'use strict';

    const STORE_KEY   = 'luxorUsers';
    const SESSION_KEY = 'luxorSession';
    const DEFAULT_PW  = 'overlord';

    // Simple but adequate hash for a game app
    function hash(str) {
        let h = 5381;
        for (let i = 0; i < str.length; i++) {
            h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
        }
        return h.toString(36);
    }

    function getUsers() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
        catch (e) { return []; }
    }

    function saveUsers(u) {
        localStorage.setItem(STORE_KEY, JSON.stringify(u));
    }

    // Default roster — update via Admin Panel → LOCK IN ROSTER
    const DEFAULT_USERS = [{"username":"OVERLORD","passwordHash":"d80m1q","role":"admin","clearance":5},{"username":"DRAGONFLY","passwordHash":"1dg01on","role":"player","clearance":1},{"username":"PLAN B","passwordHash":"3ujzpw","role":"player","clearance":1},{"username":"GHOST","passwordHash":"3giria","role":"player","clearance":1},{"username":"RATPACK","passwordHash":"3y71iz","role":"player","clearance":1},{"username":"TAIPAN","passwordHash":"1gkrxqe","role":"player","clearance":1},{"username":"BONES","passwordHash":"3h5xf4","role":"player","clearance":1}];

    // Sync default accounts on every page load — adds missing, updates existing
    function ensureDefaults() {
        const users = getUsers();
        let changed = false;
        DEFAULT_USERS.forEach(function (def) {
            const idx = users.findIndex(u => u.username === def.username);
            if (idx === -1) {
                users.push(Object.assign({}, def));
                changed = true;
            } else if (users[idx].passwordHash !== def.passwordHash) {
                users[idx] = Object.assign({}, def);
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

    // Call on every protected page. loginUrl is relative to that page.
    function requireAuth(loginUrl) {
        ensureOverlord();
        if (!getSession()) {
            window.location.replace(loginUrl || 'login.html');
            return false;
        }
        return true;
    }

    function login(username, password) {
        ensureOverlord();
        const users = getUsers();
        const user  = users.find(u => u.username === username.toUpperCase().trim());
        if (!user || user.passwordHash !== hash(password)) {
            return { ok: false, error: 'ACCESS DENIED — INVALID CREDENTIALS' };
        }
        const session = { username: user.username, role: user.role, clearance: user.clearance };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { ok: true, session };
    }

    function logout(loginUrl) {
        localStorage.removeItem(SESSION_KEY);
        window.location.replace(loginUrl || 'login.html');
    }

    // ── User management (admin only) ────────────────────────────────

    function createUser(username, password, clearance) {
        if (!isAdmin()) return { ok: false, error: 'NOT AUTHORIZED' };
        const upper = username.toUpperCase().trim();
        if (!upper || upper.length < 2)    return { ok: false, error: 'USERNAME TOO SHORT (min 2)' };
        if (!password || password.length < 3) return { ok: false, error: 'PASSWORD TOO SHORT (min 3)' };
        const cl = parseInt(clearance, 10);
        if (isNaN(cl) || cl < 1 || cl > 5) return { ok: false, error: 'CLEARANCE MUST BE 1–5' };
        const users = getUsers();
        if (users.find(u => u.username === upper)) return { ok: false, error: 'USER ALREADY EXISTS' };
        users.push({ username: upper, passwordHash: hash(password), role: 'player', clearance: cl });
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

    function updatePassword(username, newPassword) {
        const session = getSession();
        const selfEdit = session && session.username === username;
        if (!isAdmin() && !selfEdit) return { ok: false, error: 'NOT AUTHORIZED' };
        if (!newPassword || newPassword.length < 3) return { ok: false, error: 'PASSWORD TOO SHORT (min 3)' };
        const users = getUsers();
        const user  = users.find(u => u.username === username);
        if (!user) return { ok: false, error: 'USER NOT FOUND' };
        user.passwordHash = hash(newPassword);
        saveUsers(users);
        return { ok: true };
    }

    window.LuxorAuth = {
        login, logout, getSession, isAdmin, requireAuth,
        getUsers, createUser, deleteUser, updateClearance, updatePassword,
        ensureOverlord
    };
})();
