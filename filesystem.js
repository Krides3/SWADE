'use strict';

const FS_CFG_KEY   = 'luxorFsConfig';
const FS_STATE_KEY = 'luxorFsState';

const JUNK = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*<>?/\\|{}[]~`';

let cfg   = loadCfg();
let state = loadState();
let isAdmin   = false;
let openFileId = null;

function loadCfg() {
    try { return Object.assign({ serverName:'ENEMY-SRV-01', serverDesc:'Internal document archive', decryptTN:6, files:[] }, JSON.parse(localStorage.getItem(FS_CFG_KEY) || '{}')); }
    catch { return { serverName:'ENEMY-SRV-01', serverDesc:'Internal document archive', decryptTN:6, files:[] }; }
}
function saveCfg() { localStorage.setItem(FS_CFG_KEY, JSON.stringify(cfg)); }

function loadState() {
    try { return JSON.parse(localStorage.getItem(FS_STATE_KEY)) || blankState(); }
    catch { return blankState(); }
}
function saveState() { localStorage.setItem(FS_STATE_KEY, JSON.stringify(state)); }

function blankState() {
    return { active:false, decrypted:[], openFolders:[], log:[] };
}

function addLog(type, msg) { state.log.push({ t:Date.now(), type, msg }); }

// ── File tree ──────────────────────────────────────────────────────────────

function getFolders() {
    const folders = new Set(['/ROOT']);
    cfg.files.forEach(f => folders.add(f.folder || '/ROOT'));
    return Array.from(folders).sort();
}

function getFilesInFolder(folder) {
    return cfg.files.filter(f => (f.folder || '/ROOT') === folder);
}

function isFolderOpen(folder) {
    return state.openFolders.includes(folder);
}

function toggleFolder(folder) {
    if (isFolderOpen(folder)) {
        state.openFolders = state.openFolders.filter(f => f !== folder);
    } else {
        state.openFolders.push(folder);
    }
    saveState();
    renderTree();
}

function getFileStatus(file) {
    if (file.status === 'encrypted' && state.decrypted.includes(file.id)) return 'decrypted';
    return file.status || 'plain';
}

function renderTree() {
    const body = document.getElementById('fs-tree-body');
    if (!body) return;
    const folders = getFolders();
    let html = '';

    folders.forEach(folder => {
        const files   = getFilesInFolder(folder);
        const isOpen  = isFolderOpen(folder);
        const icon    = isOpen ? '▾' : '▸';
        const cls     = isOpen ? 'folder open' : 'folder';
        html += `<div class="fs-item ${cls}" onclick="toggleFolder('${folder.replace(/'/g,"\\'")}')">
            <span class="fs-item-icon">${icon} &#9679;</span>
            <span class="fs-item-name">${folder}</span>
        </div>`;

        if (isOpen) {
            files.forEach(file => {
                const status = getFileStatus(file);
                const icons  = { plain:'&#9645;', redacted:'&#9632;', encrypted:'&#9888;', decrypted:'&#9650;' };
                const badges = { encrypted:'<span class="fs-badge enc">ENC</span>', redacted:'<span class="fs-badge red">RDC</span>', decrypted:'<span class="fs-badge dec">DEC</span>' };
                const selected = openFileId === file.id ? ' selected' : '';
                html += `<div class="fs-item ${status}${selected}" onclick="openFile('${file.id}')" style="padding-left:1.5rem;">
                    <span class="fs-item-icon">${icons[status] || icons.plain}</span>
                    <span class="fs-item-name">${file.name}</span>
                    ${badges[status] || ''}
                </div>`;
            });
        }
    });

    body.innerHTML = html || '<div style="padding:0.5rem 0.75rem;font-size:0.6rem;color:var(--text-dim);opacity:0.5;">No files mounted.</div>';
}

// ── File viewer ────────────────────────────────────────────────────────────

function scramble(text) {
    return text.split('').map(ch => ch === '\n' ? '\n' : JUNK[Math.floor(Math.random() * JUNK.length)]).join('');
}

function applyRedactions(text) {
    return text.replace(/\[\[REDACTED\]\]/g, '<span class="fs-redact">&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;</span>');
}

function openFile(fileId) {
    const file = cfg.files.find(f => f.id === fileId);
    if (!file) return;
    openFileId = fileId;

    const status   = getFileStatus(file);
    const pathEl   = document.getElementById('fs-viewer-path');
    const metaEl   = document.getElementById('fs-viewer-meta');
    const bodyEl   = document.getElementById('fs-viewer-body');
    const decForm  = document.getElementById('fs-decrypt-form');
    const rollEl   = document.getElementById('fs-decrypt-roll');

    if (pathEl) pathEl.textContent = (file.folder || '/ROOT') + '/' + file.name;
    if (metaEl) metaEl.textContent = status.toUpperCase();
    if (decForm) decForm.style.display = status === 'encrypted' ? 'flex' : 'none';
    if (rollEl) rollEl.value = '';

    if (bodyEl) {
        bodyEl.className = 'fs-viewer-body ' + status;
        if (status === 'encrypted') {
            bodyEl.textContent = scramble(file.content || '');
        } else if (status === 'redacted') {
            bodyEl.innerHTML = applyRedactions(file.content || '').replace(/\n/g, '<br>');
        } else {
            bodyEl.innerHTML = (file.content || '').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
        }
    }

    addLog('', `File accessed: ${file.folder || '/ROOT'}/${file.name} [${status.toUpperCase()}]`);
    saveState();
    renderTree();
    renderLog();
    renderStats();
}

function doDecrypt() {
    const file = cfg.files.find(f => f.id === openFileId);
    if (!file || getFileStatus(file) !== 'encrypted') return;
    const rollEl = document.getElementById('fs-decrypt-roll');
    const roll   = parseInt(rollEl?.value);
    if (isNaN(roll) || roll < 1) { rollEl?.focus(); return; }

    const tn = cfg.decryptTN || 6;
    if (roll >= tn) {
        state.decrypted.push(file.id);
        addLog('success', `DECRYPT SUCCESS — ${file.name} (roll ${roll} vs TN ${tn}). File decrypted.`);
        saveState();
        openFile(file.id);
    } else {
        addLog('danger', `DECRYPT FAILED — ${file.name} (roll ${roll} vs TN ${tn}).`);
        saveState();
        renderLog();
    }
}

// ── Main render ────────────────────────────────────────────────────────────

function render() {
    const idle = document.getElementById('fs-idle');
    const game = document.getElementById('fs-game');
    if (idle) idle.style.display = state.active ? 'none' : 'flex';
    if (game) game.style.display = state.active ? 'block' : 'none';

    document.getElementById('fs-server-name').textContent = cfg.serverName;
    document.getElementById('fs-server-sub').textContent  = state.active ? cfg.serverDesc : 'Awaiting Overlord activation...';

    const badge = document.getElementById('fs-phase-badge');
    if (badge) { badge.textContent = state.active ? 'CONNECTED' : 'STANDBY'; badge.className = 'fs-phase-badge' + (state.active ? ' active' : ''); }

    if (state.active) {
        renderTree();
        if (!isFolderOpen('/ROOT') && getFolders().includes('/ROOT')) {
            state.openFolders = ['/ROOT'];
            renderTree();
        }
    }

    renderStats();
    renderLog();
    renderFileList();

    if (isAdmin) {
        const sb = document.getElementById('fs-cfg-status-bar');
        if (sb) sb.textContent = `FILES: ${cfg.files.length} | DECRYPTED: ${state.decrypted.length} | TN: ${cfg.decryptTN}`;
    }
}

function renderStats() {
    const files = cfg.files.length;
    const decs  = cfg.files.filter(f => f.status === 'encrypted' && state.decrypted.includes(f.id)).length;
    document.getElementById('fs-file-count').textContent = files;
    document.getElementById('fs-dec-count').textContent  = decs;
}

function renderLog() {
    const el  = document.getElementById('fs-log-entries');
    const cnt = document.getElementById('fs-log-count');
    if (!el) return;
    const entries = state.log || [];
    if (cnt) cnt.textContent = entries.length + ' ENTRIES';
    if (!entries.length) { el.innerHTML = '<div class="hle"><span class="hle-m">File System module initialized.</span></div>'; return; }
    el.innerHTML = entries.slice(-40).reverse().map(e => {
        const t = new Date(e.t).toLocaleTimeString();
        return `<div class="hle ${e.type||''}"><span class="hle-t">[${t}]</span> <span class="hle-m">${e.msg}</span></div>`;
    }).join('');
}

function renderFileList() {
    const el = document.getElementById('fs-file-list');
    if (!el || !isAdmin) return;
    el.innerHTML = cfg.files.map((f, i) =>
        `<div class="fs-file-item"><span>${f.folder || '/ROOT'}/${f.name} [${(f.status||'plain').toUpperCase()}]</span><button class="fs-file-del" onclick="removeFile(${i})">✕</button></div>`
    ).join('') || '<div style="font-size:9px;opacity:0.4;padding:4px;">No files added.</div>';
}

function removeFile(i) {
    cfg.files.splice(i, 1);
    saveCfg(); renderFileList(); render();
}

// ── Overlord panel ─────────────────────────────────────────────────────────

function initOverlordPanel() {
    const toggle = document.getElementById('fs-ov-toggle');
    const panel  = document.getElementById('fs-ov-panel');
    const close  = document.getElementById('fs-ov-close');
    if (toggle) { toggle.style.display = 'block'; toggle.addEventListener('click', () => panel.classList.toggle('hidden')); }
    if (close)  close.addEventListener('click', () => panel.classList.add('hidden'));

    document.getElementById('fs-cfg-activate')?.addEventListener('click', () => {
        readCfgFields();
        state.active = true;
        state.openFolders = ['/ROOT'];
        addLog('', 'File system mounted by Overlord.');
        saveCfg(); saveState(); render();
    });

    document.getElementById('fs-cfg-deactivate')?.addEventListener('click', () => {
        state.active = false;
        openFileId = null;
        addLog('', 'File system unmounted by Overlord.');
        saveState(); render();
    });

    document.getElementById('fs-cfg-clear')?.addEventListener('click', () => {
        if (!confirm('Clear ALL files?')) return;
        cfg.files = []; state = blankState(); openFileId = null;
        addLog('', 'File system cleared by Overlord.');
        saveCfg(); saveState(); render();
    });

    document.getElementById('fs-cfg-add-file')?.addEventListener('click', () => {
        const folder  = document.getElementById('fs-new-folder')?.value.trim()   || '/ROOT';
        const name    = document.getElementById('fs-new-name')?.value.trim();
        const status  = document.getElementById('fs-new-status')?.value           || 'plain';
        const content = document.getElementById('fs-new-content')?.value          || '';
        if (!name) return;
        const id = 'f' + Date.now();
        cfg.files.push({ id, folder: folder.startsWith('/') ? folder.toUpperCase() : '/' + folder.toUpperCase(), name: name.toUpperCase(), status, content });
        addLog('', `File added: ${folder}/${name} [${status.toUpperCase()}]`);
        document.getElementById('fs-new-name').value    = '';
        document.getElementById('fs-new-content').value = '';
        saveCfg(); render();
    });

    populateAdminFields();
}

function populateAdminFields() {
    const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    v('fs-cfg-servername', cfg.serverName);
    v('fs-cfg-serverdesc', cfg.serverDesc);
    v('fs-cfg-decryptTN',  cfg.decryptTN);
}

function readCfgFields() {
    cfg.serverName = document.getElementById('fs-cfg-servername')?.value.trim() || 'ENEMY-SRV-01';
    cfg.serverDesc = document.getElementById('fs-cfg-serverdesc')?.value.trim() || '';
    cfg.decryptTN  = parseInt(document.getElementById('fs-cfg-decryptTN')?.value) || 6;
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fs-decrypt-btn')?.addEventListener('click', doDecrypt);
    document.getElementById('fs-decrypt-roll')?.addEventListener('keydown', e => { if (e.key === 'Enter') doDecrypt(); });

    window.addEventListener('storage', e => {
        if (e.key === FS_CFG_KEY)   { cfg   = loadCfg();   render(); }
        if (e.key === FS_STATE_KEY) { state = loadState(); render(); }
    });

    if (window.LuxorAuth && LuxorAuth.isAdmin()) {
        isAdmin = true;
        initOverlordPanel();
    }

    render();
});
