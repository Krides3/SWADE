'use strict';

const FS_CFG_KEY   = 'luxorFsConfig';
const FS_STATE_KEY = 'luxorFsState';

const JUNK = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*<>?/\\|{}[]~`';

let cfg   = loadCfg();
let state = loadState();
let isAdmin   = false;
let openFileId = null;

function loadCfg() {
    const DEF = { serverName:'ENEMY-SRV-01', serverDesc:'Internal document archive', decryptTN:6, files:[], cipherAttempts:4, cipherWordPool:[] };
    try { return Object.assign(DEF, JSON.parse(localStorage.getItem(FS_CFG_KEY) || '{}')); }
    catch { return { ...DEF }; }
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
function clearLog() { state.log = []; saveState(); renderLog(); }
window.clearLog = clearLog;

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
    fcState = null;
    renderTree();
    renderFsCipher();
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
    const idle      = document.getElementById('fs-idle');
    const game      = document.getElementById('fs-game');
    const statusbar = document.getElementById('fs-statusbar');

    if (!state.active) {
        if (idle)      idle.style.display      = 'flex';
        if (game)      game.style.display      = 'none';
        if (statusbar) statusbar.style.display = 'none';
        if (!isAdmin) { renderLog(); return; }
    } else {
        if (idle)      idle.style.display      = 'none';
        if (game)      game.style.display      = 'block';
        if (statusbar) statusbar.style.display = '';
    }

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
    renderFsCipher();
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
    if (!entries.length) { el.innerHTML = '<div class="hle"><span class="hle-m">File Decryption module initialized.</span></div>'; return; }
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
    v('fs-cfg-servername',       cfg.serverName);
    v('fs-cfg-serverdesc',       cfg.serverDesc);
    v('fs-cfg-decryptTN',        cfg.decryptTN);
    v('fs-cfg-cipher-attempts',  cfg.cipherAttempts || 4);
    v('fs-cfg-cipher-pool',      (cfg.cipherWordPool || []).join('\n'));
}

function readCfgFields() {
    cfg.serverName      = document.getElementById('fs-cfg-servername')?.value.trim() || 'ENEMY-SRV-01';
    cfg.serverDesc      = document.getElementById('fs-cfg-serverdesc')?.value.trim() || '';
    cfg.decryptTN       = parseInt(document.getElementById('fs-cfg-decryptTN')?.value) || 6;
    cfg.cipherAttempts  = Math.max(2, Math.min(8, parseInt(document.getElementById('fs-cfg-cipher-attempts')?.value) || 4));
    const rawPool = (document.getElementById('fs-cfg-cipher-pool')?.value || '').split('\n').map(w => w.trim().toUpperCase()).filter(w => w.length > 0);
    cfg.cipherWordPool  = rawPool;
}

// ── Cipher game engine ────────────────────────────────────────────────────

const FC_BUILT_IN_POOL = [
    'SHADOW','VECTOR','BREACH','CIPHER','TARGET','PATROL',
    'SIGNAL','KERNEL','SYSTEM','BUFFER','UPLINK','DAEMON',
    'FALCON','HUNTER','ZEPHYR','REBOOT','COMBAT','ESCAPE',
    'LAUNCH','SECTOR','DEPLOY','ARMORY','MATRIX','DRAGON',
    'KNIGHT','RANGER','BANDIT','SPIDER','WRAITH','CASTLE'
];

const FC_JUNK_CHARS = '!@#$%^&*()-+=|;:,./<>?~`';
function fcRjunk(n) { return Array.from({length:n}, () => FC_JUNK_CHARS[Math.floor(Math.random()*FC_JUNK_CHARS.length)]).join(''); }
function fcShuffle(arr) { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function fcLikeness(g, a) { let n=0; for(let i=0;i<Math.min(g.length,a.length);i++) if(g[i]===a[i]) n++; return n; }
function fcEsc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

let fcState = null;

const FC_BRACKET_PAIRS = [['[',']'],['<','>'],['{','}']];

function fcBuildEntries(pool, count) {
    const words = fcShuffle(pool).slice(0, count);
    const nFx   = Math.min(3, Math.max(1, Math.floor(count / 4)));
    const fx    = ['attempt'];
    while (fx.length < nFx) fx.push('dud');
    fcShuffle(fx);
    const bSet = new Set();
    while (bSet.size < fx.length) bSet.add(Math.floor(Math.random() * words.length));
    const bArr = [...bSet];
    return words.map((word, i) => {
        const bi = bArr.indexOf(i);
        let bracket = null;
        if (bi >= 0) {
            const pair = FC_BRACKET_PAIRS[Math.floor(Math.random() * FC_BRACKET_PAIRS.length)];
            bracket = { open:pair[0], close:pair[1], content:fcRjunk(2+Math.floor(Math.random()*3)), effect:fx[bi], used:false, inPost:Math.random()>0.5, replacementJunk:null };
        }
        return { word, pre:fcRjunk(1+Math.floor(Math.random()*3)), post:fcRjunk(1+Math.floor(Math.random()*3)), addr:'0x'+(0xC000+i*8).toString(16).toUpperCase().padStart(4,'0'), bracket, eliminated:false };
    });
}

window.startFsCipher = function () {
    if (!openFileId) return;
    const pool = ((cfg.cipherWordPool && cfg.cipherWordPool.length >= 2) ? cfg.cipherWordPool : FC_BUILT_IN_POOL).filter(w => w.trim().length > 0);
    if (pool.length < 2) return;
    const count   = Math.min(12, pool.length);
    const entries = fcBuildEntries(pool, count);
    const answer  = entries[Math.floor(Math.random() * entries.length)].word;
    fcState = { phase:'active', answer, entries, guesses:[], attemptsMax:Math.max(2,Math.min(8,cfg.cipherAttempts||4)), fileId:openFileId };
    const f = cfg.files.find(f => f.id === openFileId);
    addLog('warn', `Cipher attack started on ${f ? f.name : openFileId}`);
    saveState();
    renderFsCipher();
    renderLog();
};

window.tryFsCipherWord = function (word) {
    if (!fcState || fcState.phase !== 'active') return;
    if (fcState.guesses.some(g => g.word === word)) return;
    if (fcState.entries.find(e => e.word === word)?.eliminated) return;
    if (fcState.attemptsMax - fcState.guesses.length <= 0) return;

    const score   = fcLikeness(word, fcState.answer);
    const perfect = word === fcState.answer;
    fcState.guesses.push({ word, likeness: score });

    if (perfect) {
        fcState.phase = 'won';
        if (!state.decrypted.includes(fcState.fileId)) state.decrypted.push(fcState.fileId);
        addLog('success', `CIPHER CRACKED — "${word}" — File decrypted.`);
        saveState();
        renderFsCipher();
        renderLog();
        renderStats();
        renderTree();
        setTimeout(() => openFile(fcState.fileId), 350);
    } else {
        const remaining = fcState.attemptsMax - fcState.guesses.length;
        addLog('', `Cipher: "${word}" — ${score}/${fcState.answer.length} match — ${remaining} attempt${remaining!==1?'s':''} left`);
        if (remaining <= 0) {
            fcState.phase = 'lost';
            addLog('danger', `CIPHER FAILED — Answer was: ${fcState.answer}`);
        }
        saveState();
        renderFsCipher();
        renderLog();
    }
};

window.useFsCipherBracket = function (idx) {
    if (!fcState || fcState.phase !== 'active') return;
    const e = fcState.entries[idx];
    if (!e || !e.bracket || e.bracket.used) return;
    e.bracket.used = true;
    e.bracket.replacementJunk = fcRjunk(e.bracket.content.length + 2);
    if (e.bracket.effect === 'dud') {
        const cands = fcState.entries.filter(en => en.word !== fcState.answer && !fcState.guesses.some(g=>g.word===en.word) && !en.eliminated);
        if (cands.length > 0) { const t = cands[Math.floor(Math.random()*cands.length)]; t.eliminated=true; addLog('warn', `DUD REMOVED — "${t.word}" eliminated`); }
    } else if (e.bracket.effect === 'attempt') {
        fcState.attemptsMax = Math.min(fcState.attemptsMax + 1, 9);
        addLog('success', `ATTEMPT RESTORED — ${fcState.attemptsMax - fcState.guesses.length} remaining`);
    }
    saveState();
    renderFsCipher();
    renderLog();
};

window.resetFsCipher = function () { fcState = null; renderFsCipher(); };

function renderFsCipher() {
    const section = document.getElementById('fs-cipher-section');
    const gameEl  = document.getElementById('fs-cipher-game');
    const badgeEl = document.getElementById('fs-cipher-badge');
    const fileEl  = document.getElementById('fs-cipher-file');
    if (!section) return;

    const file = openFileId ? cfg.files.find(f => f.id === openFileId) : null;
    const isEncrypted = file && getFileStatus(file) === 'encrypted';

    if (!state.active || !isEncrypted) { section.style.display = 'none'; return; }
    section.style.display = '';
    if (fileEl) fileEl.textContent = file.name;
    if (!gameEl) return;

    if (!fcState) {
        if (badgeEl) { badgeEl.textContent = 'STANDBY'; badgeEl.className = 'fs-cipher-badge'; }
        gameEl.innerHTML = `
            <div class="fc-idle-msg">
                CIPHER ATTACK READY<br>
                <span style="opacity:0.5;font-size:0.58rem;">Crack the password to decrypt ${fcEsc(file.name)}</span>
            </div>
            <div class="fc-actions">
                <button class="fc-btn fc-btn-start" onclick="startFsCipher()">&#9654; LAUNCH CIPHER ATTACK</button>
            </div>`;
        return;
    }

    const labels = { active:'ACTIVE', won:'CRACKED', lost:'FAILED' };
    if (badgeEl) { badgeEl.textContent = labels[fcState.phase]||'STANDBY'; badgeEl.className = 'fs-cipher-badge '+(fcState.phase||''); }

    if (fcState.phase === 'won') {
        gameEl.innerHTML = `
            <div class="fc-win-banner">
                <div class="fc-win-title">&#9650; CIPHER CRACKED</div>
                <div class="fc-win-sub">File decrypted &mdash; ${fcEsc(String(fcState.guesses.length))} guess${fcState.guesses.length!==1?'es':''}</div>
            </div>
            <div class="fc-actions"><button class="fc-btn fc-btn-reset" onclick="resetFsCipher()">&#8635; RESET</button></div>`;
        return;
    }
    if (fcState.phase === 'lost') {
        gameEl.innerHTML = `
            <div class="fc-lost-banner">
                <div class="fc-lost-title">&#8856; DECRYPTION FAILED</div>
                <div class="fc-lost-sub">Answer was: <span style="color:var(--warn)">${fcEsc(fcState.answer)}</span></div>
            </div>
            <div class="fc-actions"><button class="fc-btn fc-btn-reset" onclick="resetFsCipher()">&#8635; RETRY</button></div>`;
        return;
    }

    // Active game
    const entries = fcState.entries || [];
    const guesses = fcState.guesses || [];
    const left    = fcState.attemptsMax - guesses.length;
    const half    = Math.ceil(entries.length / 2);

    function bracketHtml(e, idx) {
        if (!e.bracket) return '';
        const b = e.bracket;
        return b.used
            ? `<span class="fc-bracket b-used">${fcEsc(b.replacementJunk||fcRjunk(b.content.length+2))}</span>`
            : `<span class="fc-bracket b-${b.effect}" onclick="useFsCipherBracket(${idx})">${fcEsc(b.open)}${fcEsc(b.content)}${fcEsc(b.close)}</span>`;
    }
    function lineHtml(e, idx) {
        const guessedWrong = guesses.some(g => g.word===e.word && e.word!==fcState.answer);
        let cls='fc-word', click='';
        if      (e.eliminated)   cls+=' w-eliminated';
        else if (guessedWrong)   cls+=' w-guessed';
        else if (fcState.phase==='active' && !e.eliminated) click=`onclick="tryFsCipherWord('${e.word}')"`;
        else cls+=' w-locked';
        const bh = bracketHtml(e, idx);
        return `<div class="fc-line"><span class="fc-addr">${fcEsc(e.addr)}</span><span class="fc-junk">${fcEsc(e.pre)}</span>${!e.bracket?.inPost?bh:''}<span class="${cls}" ${click}>${fcEsc(e.word)}</span>${e.bracket?.inPost?bh:''}<span class="fc-junk">${fcEsc(e.post)}</span></div>`;
    }

    const pips = Array.from({length:fcState.attemptsMax},(_,i)=>`<div class="fc-pip ${i>=left?'used':''}"></div>`).join('');
    const histHtml = guesses.length===0
        ? '<div class="fc-guess" style="opacity:0.35">— no guesses —</div>'
        : guesses.map(g=>`<div class="fc-guess"><span class="gw">&gt; ${fcEsc(g.word)}</span><span class="gr"> ${g.likeness}/${g.word.length}</span></div>`).join('');

    gameEl.innerHTML = `
        <div class="fc-terminal">
            <div class="fc-term-hdr">CIPHER.EXE &mdash; TARGET: ${fcEsc(file.name)}</div>
            <div class="fc-body">
                <div class="fc-grid">
                    ${entries.slice(0,half).map((e,i)=>lineHtml(e,i)).join('')}
                    ${entries.slice(half).map((e,i)=>lineHtml(e,half+i)).join('')}
                </div>
                <div class="fc-sidebar">
                    <div class="fc-slabel">ATTEMPTS</div>
                    <div class="fc-pips">${pips}</div>
                    <div class="fc-pip-lbl">${left} / ${fcState.attemptsMax}</div>
                    <div class="fc-slabel">HISTORY</div>
                    <div class="fc-hist">${histHtml}</div>
                    <div class="fc-slabel">BRACKETS</div>
                    <div class="fc-legend">
                        <div class="fc-leg"><span class="lb-dud">[&#8230;]</span> Remove dud</div>
                        <div class="fc-leg"><span class="lb-att">&lt;&#8230;&gt;</span> +1 attempt</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="fc-actions">
            <button class="fc-btn fc-btn-abort" onclick="resetFsCipher()">&#8856; ABORT</button>
        </div>`;
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
        document.body.classList.add('is-admin');
        initOverlordPanel();
    }

    render();
});
