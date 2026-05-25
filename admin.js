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
    const clearance = document.getElementById('new-clearance').value;
    const msgEl     = document.getElementById('create-msg');

    const r = LuxorAuth.createUser(username, clearance);
    msgEl.className = 'form-msg ' + (r.ok ? 'ok' : 'err');
    msgEl.textContent = r.ok ? `✓ OPERATOR ${username.toUpperCase()} ENLISTED AT CLEARANCE ${clearance}` : '⚠ ' + r.error;

    if (r.ok) {
        document.getElementById('new-username').value = '';
        document.getElementById('new-clearance').value = '1';
        renderRoster();
    }
});

renderRoster();

// ── Minigame grid ────────────────────────────────────────────
(function renderMinigameGrid() {
    const grid = document.getElementById('mg-grid');
    if (!grid) return;

    const games = [
        { cfgKey:'luxorHackConfig',     stateKey:'luxorHackState',     icon:'▦', label:'HACKING',         href:'hack.html',
          getPhase: s => s.phase || 'idle', phaseLabels:{ idle:'STANDBY', active:'ACTIVE', won:'BREACHED', lost:'TRACED' } },
        { cfgKey:'luxorLockpickConfig', stateKey:'luxorLockpickState', icon:'⌗', label:'LOCKPICK',        href:'lockpick.html',
          getPhase: s => s.phase || 'idle', phaseLabels:{ idle:'STANDBY', active:'PICKING', won:'OPEN', lost:'LOCKOUT' } },
        { cfgKey:'luxorSocialConfig',   stateKey:'luxorSocialState',   icon:'⊙', label:'SOCIAL ENG.',     href:'social.html',
          getPhase: s => s.phase || 'idle', phaseLabels:{ idle:'STANDBY', active:'ACTIVE', won:'BROKEN', lost:'FAILED' } },
        { cfgKey:'luxorNetmapConfig',   stateKey:'luxorNetmapState',   icon:'⊛', label:'NETWORK MAP',     href:'netmap.html',
          getPhase: s => s.phase || 'idle', phaseLabels:{ idle:'STANDBY', active:'ACTIVE', won:'PWNED', lost:'DETECTED' } },
        { cfgKey:'luxorEvidenceConfig', stateKey:'luxorEvidenceState', icon:'⊡', label:'EVIDENCE BOARD',  href:'evidence.html',
          getPhase: s => s.active ? 'active' : 'idle', phaseLabels:{ idle:'STANDBY', active:'PUBLISHED' } },
        { cfgKey:'luxorFsConfig',       stateKey:'luxorFsState',       icon:'⊟', label:'FILE SYSTEM',     href:'filesystem.html',
          getPhase: s => s.active ? 'active' : 'idle', phaseLabels:{ idle:'STANDBY', active:'MOUNTED' } },
    ];

    const phaseColors = { idle:'#6b6860', active:'#00e5c8', won:'#00e5c8', lost:'#c0392b' };

    games.forEach(function (game) {
        let state = {};
        try { state = JSON.parse(localStorage.getItem(game.stateKey) || '{}'); } catch(e) {}
        const phase = game.getPhase(state);
        const color = phaseColors[phase] || '#6b6860';
        const phaseLabel = (game.phaseLabels || {})[phase] || phase.toUpperCase();

        const card = document.createElement('a');
        card.href = game.href;
        card.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:12px;background:var(--bg-card);border:1px solid var(--border);text-decoration:none;transition:border-color 0.15s;';
        card.onmouseenter = () => card.style.borderColor = 'var(--gold-dim)';
        card.onmouseleave = () => card.style.borderColor = 'var(--border)';
        card.innerHTML = `
            <span style="font-family:'Share Tech Mono',monospace;font-size:0.62rem;letter-spacing:0.18em;color:var(--gold)">${game.icon} ${game.label}</span>
            <span style="font-family:'Share Tech Mono',monospace;font-size:0.62rem;letter-spacing:0.12em;color:${color}">${phaseLabel}</span>
        `;
        grid.appendChild(card);
    });
})();

// ── Social Engineering config ─────────────────────────────
(function initSocialAdmin() {
    const SE_CFG_KEY   = 'luxorSocialConfig';
    const SE_STATE_KEY = 'luxorSocialState';
    const DEF = { npcName:'UNKNOWN SUBJECT', npcRole:'Corporate Security Guard', resistance:100, maxAttempts:10,
                  winMessage:'Subject has divulged classified information. Objective complete.',
                  approachTN:{ rapport:6, pressure:8, deception:8, silence:4 } };

    function load() {
        let c = DEF;
        try { c = Object.assign({}, DEF, JSON.parse(localStorage.getItem(SE_CFG_KEY) || '{}')); } catch(e) {}
        document.getElementById('se-adm-npcname').value     = c.npcName       || DEF.npcName;
        document.getElementById('se-adm-npcrole').value     = c.npcRole       || DEF.npcRole;
        document.getElementById('se-adm-resistance').value  = c.resistance    ?? DEF.resistance;
        document.getElementById('se-adm-maxattempts').value = c.maxAttempts   ?? DEF.maxAttempts;
        document.getElementById('se-adm-winmsg').value      = c.winMessage    || DEF.winMessage;
        const tn = c.approachTN || DEF.approachTN;
        document.getElementById('se-adm-tn-rapport').value   = tn.rapport   ?? 6;
        document.getElementById('se-adm-tn-pressure').value  = tn.pressure  ?? 8;
        document.getElementById('se-adm-tn-deception').value = tn.deception ?? 8;
        document.getElementById('se-adm-tn-silence').value   = tn.silence   ?? 4;
    }

    function flash(id, msg) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = msg;
        setTimeout(() => { el.textContent = ''; }, 2500);
    }

    document.getElementById('se-adm-save')?.addEventListener('click', function () {
        let c = {};
        try { c = JSON.parse(localStorage.getItem(SE_CFG_KEY) || '{}'); } catch(e) {}
        c.npcName     = document.getElementById('se-adm-npcname').value.trim()     || DEF.npcName;
        c.npcRole     = document.getElementById('se-adm-npcrole').value.trim()     || DEF.npcRole;
        c.resistance  = parseInt(document.getElementById('se-adm-resistance').value)    || DEF.resistance;
        c.maxAttempts = parseInt(document.getElementById('se-adm-maxattempts').value)   || DEF.maxAttempts;
        c.winMessage  = document.getElementById('se-adm-winmsg').value.trim()      || DEF.winMessage;
        c.approachTN  = {
            rapport:   parseInt(document.getElementById('se-adm-tn-rapport').value)   || 6,
            pressure:  parseInt(document.getElementById('se-adm-tn-pressure').value)  || 8,
            deception: parseInt(document.getElementById('se-adm-tn-deception').value) || 8,
            silence:   parseInt(document.getElementById('se-adm-tn-silence').value)   || 4,
        };
        localStorage.setItem(SE_CFG_KEY, JSON.stringify(c));
        flash('se-adm-msg', '✓ SAVED');
    });

    document.getElementById('se-adm-reset')?.addEventListener('click', function () {
        if (!confirm('Reset Social Engineering game state? Config is preserved.')) return;
        localStorage.removeItem(SE_STATE_KEY);
        flash('se-adm-msg', '✓ STATE RESET');
    });

    load();
})();

// ── Network Map admin ────────────────────────────────────────
(function initNetmapAdmin() {
    const NM_CFG_KEY   = 'luxorNetmapConfig';
    const NM_STATE_KEY = 'luxorNetmapState';

    function updateStatus() {
        let cfg = {}, state = {};
        try { cfg   = JSON.parse(localStorage.getItem(NM_CFG_KEY)   || '{}'); } catch(e) {}
        try { state = JSON.parse(localStorage.getItem(NM_STATE_KEY) || '{}'); } catch(e) {}
        const el = document.getElementById('nm-adm-status');
        if (!el) return;
        const nodes       = (cfg.nodes  || []).length;
        const compromised = (state.compromised || []).length;
        const phase       = state.phase || 'idle';
        const detection   = state.detection ?? 0;
        el.innerHTML = `Phase: <strong style="color:var(--cyan)">${phase.toUpperCase()}</strong> &nbsp;|&nbsp; Nodes: <strong>${nodes}</strong> &nbsp;|&nbsp; Compromised: <strong>${compromised}</strong> &nbsp;|&nbsp; Detection: <strong>${detection}%</strong>`;
    }

    function flash(msg) {
        const el = document.getElementById('nm-adm-msg');
        if (!el) return;
        el.textContent = msg;
        setTimeout(() => { el.textContent = ''; }, 2500);
    }

    document.getElementById('nm-adm-reset')?.addEventListener('click', function () {
        if (!confirm('Reset Network Map game state? Config/nodes preserved.')) return;
        localStorage.removeItem(NM_STATE_KEY);
        flash('✓ STATE RESET');
        updateStatus();
    });

    document.getElementById('nm-adm-reset-cfg')?.addEventListener('click', function () {
        if (!confirm('Clear Network Map config AND state? This removes all nodes.')) return;
        localStorage.removeItem(NM_CFG_KEY);
        localStorage.removeItem(NM_STATE_KEY);
        flash('✓ CONFIG + STATE CLEARED');
        updateStatus();
    });

    updateStatus();
})();

// ── Evidence Board admin ─────────────────────────────────────
(function initEvidenceAdmin() {
    const EV_CFG_KEY   = 'luxorEvidenceConfig';
    const EV_STATE_KEY = 'luxorEvidenceState';

    function updateStatus() {
        let cfg = {}, state = {};
        try { cfg   = JSON.parse(localStorage.getItem(EV_CFG_KEY)   || '{}'); } catch(e) {}
        try { state = JSON.parse(localStorage.getItem(EV_STATE_KEY) || '{}'); } catch(e) {}
        const el = document.getElementById('ev-adm-status');
        if (!el) return;
        const cards   = (cfg.cards       || []).length;
        const hidden  = (cfg.hiddenConns || []).length;
        const pconns  = (state.playerConns   || []).length;
        const reveals = (state.revealedConns || []).length;
        const active  = cfg.active || state.active ? 'PUBLISHED' : 'STANDBY';
        el.innerHTML = `Status: <strong style="color:var(--cyan)">${active}</strong> &nbsp;|&nbsp; Cards: <strong>${cards}</strong> &nbsp;|&nbsp; Hidden links: <strong>${hidden}</strong> &nbsp;|&nbsp; Player connections: <strong>${pconns}</strong> &nbsp;|&nbsp; Revealed: <strong>${reveals}</strong>`;
    }

    function flash(msg) {
        const el = document.getElementById('ev-adm-msg');
        if (!el) return;
        el.textContent = msg;
        setTimeout(() => { el.textContent = ''; }, 2500);
    }

    document.getElementById('ev-adm-reset')?.addEventListener('click', function () {
        if (!confirm('Reset Evidence Board state? Cards and config preserved.')) return;
        localStorage.removeItem(EV_STATE_KEY);
        flash('✓ STATE RESET');
        updateStatus();
    });

    document.getElementById('ev-adm-reset-cfg')?.addEventListener('click', function () {
        if (!confirm('Clear ALL Evidence Board cards and config?')) return;
        localStorage.removeItem(EV_CFG_KEY);
        localStorage.removeItem(EV_STATE_KEY);
        flash('✓ BOARD CLEARED');
        updateStatus();
    });

    updateStatus();
})();

// ── File System config ───────────────────────────────────────
(function initFsAdmin() {
    const FS_CFG_KEY   = 'luxorFsConfig';
    const FS_STATE_KEY = 'luxorFsState';
    const DEF = { serverName:'ENEMY-SRV-01', serverDesc:'Internal document archive', decryptTN:6, files:[] };

    function load() {
        let c = DEF;
        try { c = Object.assign({}, DEF, JSON.parse(localStorage.getItem(FS_CFG_KEY) || '{}')); } catch(e) {}
        document.getElementById('fs-adm-name').value = c.serverName || DEF.serverName;
        document.getElementById('fs-adm-desc').value = c.serverDesc || DEF.serverDesc;
        document.getElementById('fs-adm-tn').value   = c.decryptTN  ?? DEF.decryptTN;
    }

    function flash(msg) {
        const el = document.getElementById('fs-adm-msg');
        if (!el) return;
        el.textContent = msg;
        setTimeout(() => { el.textContent = ''; }, 2500);
    }

    document.getElementById('fs-adm-save')?.addEventListener('click', function () {
        let c = DEF;
        try { c = Object.assign({}, DEF, JSON.parse(localStorage.getItem(FS_CFG_KEY) || '{}')); } catch(e) {}
        c.serverName = document.getElementById('fs-adm-name').value.trim() || DEF.serverName;
        c.serverDesc = document.getElementById('fs-adm-desc').value.trim() || DEF.serverDesc;
        c.decryptTN  = parseInt(document.getElementById('fs-adm-tn').value) || DEF.decryptTN;
        localStorage.setItem(FS_CFG_KEY, JSON.stringify(c));
        flash('✓ SAVED');
    });

    document.getElementById('fs-adm-reset')?.addEventListener('click', function () {
        if (!confirm('Reset File System state? Files and config are preserved.')) return;
        localStorage.removeItem(FS_STATE_KEY);
        flash('✓ STATE RESET');
    });

    load();
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
