// ── Auth guard: admin only ──────────────────────────────────────
if (!LuxorAuth.requireAuth('login.html') || !LuxorAuth.isAdmin()) {
    window.location.replace('index.html');
}

// ── Render roster ───────────────────────────────────────────────
function renderRoster() {
    const tbody = document.getElementById('user-tbody');
    tbody.innerHTML = '';
    LuxorAuth.getUsers().forEach(u => {
        const tr = document.createElement('tr');

        // Clearance mini-buttons (disabled for OVERLORD)
        let clBtns = '';
        if (u.username !== 'OVERLORD') {
            for (let i = 1; i <= 5; i++) {
                const active = i === u.clearance ? 'active' : '';
                clBtns += `<button class="cl-mini-btn ${active}" onclick="setCl('${u.username}',${i})">${i}</button>`;
            }
        } else {
            clBtns = '<span style="color:var(--gold-dim);font-size:0.7rem;letter-spacing:.1em">FIXED</span>';
        }

        // Delete button (disabled for OVERLORD)
        const delBtn = u.username !== 'OVERLORD'
            ? `<button class="btn-danger" onclick="delUser('${u.username}')">TERMINATE</button>`
            : '<span style="color:var(--text-dim);font-size:0.7rem;letter-spacing:.1em">—</span>';

        tr.innerHTML = `
            <td>${u.username}</td>
            <td><span class="badge-${u.role}">${u.role.toUpperCase()}</span></td>
            <td><span class="cl-badge">${u.clearance}</span></td>
            <td><div class="cl-edit-btns">${clBtns}</div></td>
            <td>${delBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

function setCl(username, level) {
    const r = LuxorAuth.updateClearance(username, level);
    if (r.ok) {
        renderRoster();
    } else {
        alert('ERROR: ' + r.error);
    }
}

function delUser(username) {
    if (!confirm(`TERMINATE operator "${username}"? This cannot be undone.`)) return;
    const r = LuxorAuth.deleteUser(username);
    if (r.ok) {
        renderRoster();
    } else {
        alert('ERROR: ' + r.error);
    }
}

// ── Create user ─────────────────────────────────────────────────
document.getElementById('create-btn').addEventListener('click', function () {
    const username  = document.getElementById('new-username').value.trim();
    const password  = document.getElementById('new-password').value;
    const clearance = document.getElementById('new-clearance').value;
    const msgEl     = document.getElementById('create-msg');

    const r = LuxorAuth.createUser(username, password, clearance);
    msgEl.className = 'form-msg ' + (r.ok ? 'ok' : 'err');
    msgEl.textContent = r.ok ? `✓ OPERATOR ${username.toUpperCase()} ENLISTED AT CLEARANCE ${clearance}` : '⚠ ' + r.error;

    if (r.ok) {
        document.getElementById('new-username').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('new-clearance').value = '1';
        renderRoster();
    }
});

// ── Change OVERLORD password ────────────────────────────────────
document.getElementById('pw-change-btn').addEventListener('click', function () {
    const np  = document.getElementById('new-pw').value;
    const cp  = document.getElementById('confirm-pw').value;
    const msg = document.getElementById('pw-msg');

    if (!np || np.length < 3) {
        msg.className = 'form-msg err';
        msg.textContent = '⚠ PASSWORD TOO SHORT (min 3 chars)';
        return;
    }
    if (np !== cp) {
        msg.className = 'form-msg err';
        msg.textContent = '⚠ ACCESS CODES DO NOT MATCH';
        return;
    }

    const r = LuxorAuth.updatePassword('OVERLORD', np);
    msg.className = 'form-msg ' + (r.ok ? 'ok' : 'err');
    msg.textContent = r.ok ? '✓ OVERLORD ACCESS CODE UPDATED' : '⚠ ' + r.error;

    if (r.ok) {
        document.getElementById('new-pw').value    = '';
        document.getElementById('confirm-pw').value = '';
    }
});

renderRoster();

// ── Minigame status grid ─────────────────────────────────────
(function renderMinigameStatus() {
    const grid = document.getElementById('minigame-status-grid');
    if (!grid) return;

    const games = [
        { key: 'luxorHackConfig',     stateKey: 'luxorHackState',     label: '▦ HACKING TERMINAL', href: 'hack.html',
          phaseLabels: { idle:'STANDBY', active:'BREACH ACTIVE', won:'ACCESS GRANTED', lost:'TRACE DETECTED' } },
        { key: 'luxorLockpickConfig', stateKey: 'luxorLockpickState', label: '⌗ LOCKPICK',          href: 'lockpick.html',
          phaseLabels: { idle:'STANDBY', active:'PICKING',       won:'LOCK OPEN',      lost:'LOCKOUT'         } }
    ];

    games.forEach(function (game) {
        let cfg = {}, state = {};
        try { cfg   = JSON.parse(localStorage.getItem(game.key)      || '{}'); } catch(e) {}
        try { state = JSON.parse(localStorage.getItem(game.stateKey) || '{}'); } catch(e) {}

        const phase = state.phase || 'idle';
        const phaseColors = { idle: '#6b6860', active: '#00e5c8', won: '#00e5c8', lost: '#c0392b' };
        const phaseLabels = game.phaseLabels || { idle:'STANDBY', active:'ACTIVE', won:'SUCCESS', lost:'FAILED' };
        const color = phaseColors[phase] || '#6b6860';

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--bg-panel);border:1px solid var(--border);font-family:\'Share Tech Mono\',monospace;font-size:0.68rem;letter-spacing:0.1em;';
        row.innerHTML = `
            <span style="color:var(--gold)">${game.label}</span>
            <span style="color:${color}">${phaseLabels[phase]}</span>
            <span style="color:var(--text-dim)">${state.startedBy ? 'OPR: ' + state.startedBy : '—'}</span>
            <span style="color:var(--text-dim)">${cfg.targetName || '—'}</span>
        `;
        grid.appendChild(row);
    });
})();

// ── Lock In Roster ───────────────────────────────────────────
document.getElementById('lock-roster-btn').addEventListener('click', function () {
    const msg = document.getElementById('lock-msg');
    fetch('./auth.js')
        .then(r => r.text())
        .then(function (src) {
            const users    = LuxorAuth.getUsers();
            const newBlock = 'const DEFAULT_USERS = ' + JSON.stringify(users) + ';';
            const updated  = src.replace(/const DEFAULT_USERS\s*=\s*\[[\s\S]*?\];/, newBlock);
            const blob     = new Blob([updated], { type: 'application/javascript' });
            const url      = URL.createObjectURL(blob);
            const a        = document.createElement('a');
            a.href     = url;
            a.download = 'auth.js';
            a.click();
            URL.revokeObjectURL(url);
            msg.className  = 'form-msg ok';
            msg.textContent = '✓ DOWNLOADED — replace auth.js in your project and push to git';
        })
        .catch(function () {
            msg.className  = 'form-msg err';
            msg.textContent = '⚠ FAILED — could not read auth.js (try running from a local server)';
        });
});

// ── Asset Map time scale ─────────────────────────────────────
function applyMapTs(val) {
    const v = Math.max(0.1, Math.min(500, +val || 5));
    try {
        const c = JSON.parse(localStorage.getItem('luxorAssetMapSettings') || '{}');
        c.timeScale = v;
        localStorage.setItem('luxorAssetMapSettings', JSON.stringify(c));
    } catch(e) {}
    document.getElementById('map-ts-input').value = v;
    const msg = document.getElementById('map-ts-msg');
    msg.className = 'form-msg ok';
    msg.textContent = `✓ TIME SCALE SET TO ${v}× — takes effect on live Asset Map immediately`;
    setTimeout(() => { msg.className = 'form-msg'; msg.textContent = ''; }, 3000);
}

document.getElementById('map-ts-btn').addEventListener('click', function () {
    const v = parseFloat(document.getElementById('map-ts-input').value);
    if (isNaN(v) || v <= 0) {
        const msg = document.getElementById('map-ts-msg');
        msg.className = 'form-msg err';
        msg.textContent = '⚠ INVALID VALUE';
        setTimeout(() => { msg.className = 'form-msg'; msg.textContent = ''; }, 2000);
        return;
    }
    applyMapTs(v);
});

// Populate current map ts value on load
(function () {
    try {
        const c = JSON.parse(localStorage.getItem('luxorAssetMapSettings') || '{}');
        if (typeof c.timeScale === 'number') {
            document.getElementById('map-ts-input').value = c.timeScale;
        }
    } catch(e) {}
})();

// ── Backup / Restore ─────────────────────────────────────────
document.getElementById('export-btn').addEventListener('click', function () {
    const users = LuxorAuth.getUsers();
    const blob  = new Blob([JSON.stringify(users, null, 2)], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    const date  = new Date().toISOString().slice(0,10);
    a.href     = url;
    a.download = 'luxor-roster-' + date + '.json';
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('import-file').addEventListener('change', function () {
    const file = this.files[0];
    const msg  = document.getElementById('backup-msg');
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error('invalid format');
            localStorage.setItem('luxorUsers', JSON.stringify(data));
            msg.className  = 'form-msg ok';
            msg.textContent = '✓ ROSTER RESTORED — ' + data.length + ' OPERATOR(S) LOADED';
            renderRoster();
        } catch (err) {
            msg.className  = 'form-msg err';
            msg.textContent = '⚠ IMPORT FAILED — INVALID FILE';
        }
        document.getElementById('import-file').value = '';
    };
    reader.readAsText(file);
});
