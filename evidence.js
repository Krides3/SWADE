'use strict';

const EV_CFG_KEY   = 'luxorEvidenceConfig';
const EV_STATE_KEY = 'luxorEvidenceState';

const TYPE_COLORS = { clue:'#00e5c8', suspect:'#b8a800', location:'#c060e8', event:'#e74c3c' };

let cfg   = loadCfg();
let state = loadState();
let isAdmin = false;
let connectMode = false;
let connectSrc  = null;
let dragging    = null;
let dragOffset  = { x:0, y:0 };
let zoom = 1.0;
const ZOOM_STEP = 0.15;
const ZOOM_MIN  = 0.3;
const ZOOM_MAX  = 2.0;
const BOARD_W   = 1600;
const BOARD_H   = 900;

function loadCfg() {
    try { return Object.assign({ caseTitle:'CASE FILE', caseDesc:'Awaiting data...', noticeTN:6, cards:[], hiddenConns:[] }, JSON.parse(localStorage.getItem(EV_CFG_KEY) || '{}')); }
    catch { return { caseTitle:'CASE FILE', caseDesc:'Awaiting data...', noticeTN:6, cards:[], hiddenConns:[] }; }
}
function saveCfg() { localStorage.setItem(EV_CFG_KEY, JSON.stringify(cfg)); }

function loadState() {
    try { return JSON.parse(localStorage.getItem(EV_STATE_KEY)) || blankState(); }
    catch { return blankState(); }
}
function saveState() { localStorage.setItem(EV_STATE_KEY, JSON.stringify(state)); }

function blankState() {
    return { active:false, positions:{}, playerConns:[], revealedConns:[], log:[], collapsed:{} };
}

function addLog(type, msg) { state.log.push({ t:Date.now(), type, msg }); }
function clearLog() { state.log = []; saveState(); renderLog(); }
window.clearLog = clearLog;

// ── Card positioning ───────────────────────────────────────────────────────

function getPos(cardId) {
    if (state.positions[cardId]) return state.positions[cardId];
    const idx = cfg.cards.findIndex(c => c.id === cardId);
    const col  = idx % 4;
    const row  = Math.floor(idx / 4);
    return { x: 20 + col * 195, y: 20 + row * 130 };
}

// ── Connections ────────────────────────────────────────────────────────────

function hasConnection(a, b, list) {
    return list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function togglePlayerConn(a, b) {
    if (hasConnection(a, b, state.playerConns)) {
        state.playerConns = state.playerConns.filter(([x, y]) => !((x===a&&y===b)||(x===b&&y===a)));
        addLog('', `Connection removed: ${cardLabel(a)} ↔ ${cardLabel(b)}`);
    } else {
        state.playerConns.push([a, b]);
        addLog('', `Connection added: ${cardLabel(a)} ↔ ${cardLabel(b)}`);
    }
}

function cardLabel(id) {
    const c = cfg.cards.find(c => c.id === id);
    return c ? c.title : id;
}

// ── Notice roll ────────────────────────────────────────────────────────────

function doNotice() {
    const rollEl = document.getElementById('ev-notice-roll');
    const roll   = parseInt(rollEl?.value);
    if (isNaN(roll) || roll < 1) { rollEl?.focus(); return; }
    const tn     = cfg.noticeTN || 6;
    const raises = roll >= tn ? Math.floor((roll - tn) / 4) + 1 : 0;

    if (raises === 0) {
        addLog('warn', `Notice roll ${roll} vs TN ${tn} — failed. No hidden connections revealed.`);
    } else {
        const hidden    = cfg.hiddenConns || [];
        const already   = state.revealedConns;
        const unrevealed= hidden.filter(([a, b]) => !hasConnection(a, b, already));
        const toReveal  = unrevealed.slice(0, raises);

        if (toReveal.length === 0) {
            addLog('success', `Notice roll ${roll} — success! No hidden connections remain.`);
        } else {
            toReveal.forEach(conn => {
                state.revealedConns.push(conn);
                addLog('success', `Notice roll ${roll} — hidden link revealed: ${cardLabel(conn[0])} ↔ ${cardLabel(conn[1])}`);
            });
        }
    }

    saveState(); render();
    if (rollEl) rollEl.value = '';
}

// ── SVG connections ────────────────────────────────────────────────────────

function getCardCenter(cardId) {
    const pos = getPos(cardId);
    return { x: pos.x + 85, y: pos.y + 45 };
}

function applyZoom() {
    const wrap   = document.getElementById('ev-board-wrap');
    const canvas = document.getElementById('ev-board-canvas');
    const val    = document.getElementById('ev-zoom-val');
    if (wrap) {
        wrap.style.transform = `scale(${zoom})`;
        wrap.style.transformOrigin = '0 0';
    }
    if (canvas) {
        canvas.style.width  = (BOARD_W * zoom) + 'px';
        canvas.style.height = (BOARD_H * zoom) + 'px';
    }
    if (val) val.textContent = Math.round(zoom * 100) + '%';
}

function renderSVG() {
    const svg = document.getElementById('ev-svg');
    if (!svg) return;
    svg.setAttribute('viewBox', `0 0 ${BOARD_W} ${BOARD_H}`);

    const lines = [];

    // Player connections — cyan dashed
    state.playerConns.forEach(([a, b]) => {
        const ca = getCardCenter(a), cb = getCardCenter(b);
        lines.push(`<line x1="${ca.x}" y1="${ca.y}" x2="${cb.x}" y2="${cb.y}" stroke="rgba(0,229,200,0.45)" stroke-width="1.5" stroke-dasharray="6,4"/>`);
    });

    // Revealed hidden connections — gold solid
    state.revealedConns.forEach(([a, b]) => {
        const ca = cfg.cards.find(c => c.title === a || c.id === a);
        const cb = cfg.cards.find(c => c.title === b || c.id === b);
        if (!ca || !cb) return;
        const pa = getCardCenter(ca.id), pb = getCardCenter(cb.id);
        lines.push(`<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" stroke="rgba(184,168,0,0.7)" stroke-width="2" filter="url(#ev-glow)"/>`);
        const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
        lines.push(`<text x="${mx}" y="${my - 6}" text-anchor="middle" fill="#b8a800" font-size="9" font-family="Share Tech Mono,monospace">LINKED</text>`);
    });

    svg.innerHTML = `<defs><filter id="ev-glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${lines.join('')}`;
}

// ── Collapse ───────────────────────────────────────────────────────────────

function toggleCollapse(cardId) {
    state.collapsed = state.collapsed || {};
    state.collapsed[cardId] = !state.collapsed[cardId];
    const el  = document.getElementById('evcard-' + cardId);
    if (el) {
        el.classList.toggle('collapsed', !!state.collapsed[cardId]);
        const btn = el.querySelector('.ev-card-collapse');
        if (btn) btn.textContent = state.collapsed[cardId] ? '▼' : '▲';
    }
    saveState();
}
window.toggleCollapse = toggleCollapse;

// ── Card title datalist ────────────────────────────────────────────────────

function updateCardTitleDatalist() {
    const dl = document.getElementById('ev-card-titles');
    if (!dl) return;
    dl.innerHTML = cfg.cards.map(c => `<option value="${c.title.replace(/"/g, '&quot;')}">`).join('');
}

// ── Image functions ────────────────────────────────────────────────────────

function handleImageUpload(cardId, input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const card = cfg.cards.find(c => c.id === cardId);
    if (!card) return;
    if (!card.images) card.images = [];
    let loaded = 0;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const imgId = 'img' + Date.now() + Math.random().toString(36).slice(2, 6);
            const isCover = card.images.length === 0;
            card.images.push({ id: imgId, dataUrl: e.target.result, isCover, caption: '' });
            loaded++;
            if (loaded === files.length) { saveCfg(); renderBoard(); }
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
}
window.handleImageUpload = handleImageUpload;

function setCoverImage(cardId, imgId) {
    const card = cfg.cards.find(c => c.id === cardId);
    if (!card || !card.images) return;
    card.images.forEach(img => { img.isCover = img.id === imgId; });
    saveCfg(); renderBoard();
}
window.setCoverImage = setCoverImage;

function removeImage(cardId, imgId) {
    const card = cfg.cards.find(c => c.id === cardId);
    if (!card || !card.images) return;
    card.images = card.images.filter(img => img.id !== imgId);
    if (card.images.length && !card.images.some(img => img.isCover)) card.images[0].isCover = true;
    saveCfg(); renderBoard();
}
window.removeImage = removeImage;

// ── Board rendering ────────────────────────────────────────────────────────

function renderBoard() {
    const board = document.getElementById('ev-board');
    if (!board) return;
    board.innerHTML = '';
    state.collapsed = state.collapsed || {};

    cfg.cards.forEach(card => {
        if (card.hidden && !isAdmin) return;

        const pos         = getPos(card.id);
        const isCollapsed = !!state.collapsed[card.id];
        const images      = card.images || [];
        const coverImg    = images.find(img => img.isCover) || images[0] || null;

        const coverHtml = coverImg
            ? `<div class="ev-card-cover"><img src="${coverImg.dataUrl}" alt="cover"></div>`
            : '';

        const imgsHtml = images.map(img =>
            `<div class="ev-img-item">
                <img class="ev-img-thumb${img.isCover ? ' cover' : ''}" src="${img.dataUrl}" title="${img.isCover ? 'Cover' : 'Click ★ to set cover'}" onclick="event.stopPropagation()">
                <div class="ev-img-actions">
                    <button class="ev-img-btn" title="Set as cover" onclick="event.stopPropagation();setCoverImage('${card.id}','${img.id}')">&#9733;</button>
                    <button class="ev-img-btn del" title="Remove" onclick="event.stopPropagation();removeImage('${card.id}','${img.id}')">&#10005;</button>
                </div>
            </div>`
        ).join('');

        const uploadHtml = `<label class="ev-img-upload-lbl" onclick="event.stopPropagation()">+ IMG<input type="file" accept="image/*" multiple style="display:none" onchange="handleImageUpload('${card.id}',this)"></label>`;

        const hiddenBadge = (card.hidden && isAdmin)
            ? `<span style="background:rgba(180,40,40,0.4);color:#e74c3c;font-size:0.55rem;padding:1px 5px;border-radius:2px;letter-spacing:0.05em;">HIDDEN</span>
               <button class="ev-img-btn" style="font-size:0.55rem;padding:1px 6px;" onclick="event.stopPropagation();evRevealCard('${card.id}')">REVEAL</button>`
            : '';

        const el  = document.createElement('div');
        el.className = `ev-card ${card.type}${isCollapsed ? ' collapsed' : ''}${card.hidden ? ' ev-card-hidden' : ''}`;
        el.id = 'evcard-' + card.id;
        el.style.left = pos.x + 'px';
        el.style.top  = pos.y + 'px';
        el.innerHTML  = `
            <div class="ev-card-hdr">
                <div class="ev-card-meta">
                    <div class="ev-card-type">${card.type.toUpperCase()}</div>
                    <div class="ev-card-title">${card.title}</div>
                </div>
                <div style="display:flex;align-items:center;gap:4px;">${hiddenBadge}<button class="ev-card-collapse" onclick="event.stopPropagation();toggleCollapse('${card.id}')">${isCollapsed ? '▼' : '▲'}</button></div>
            </div>
            ${coverHtml}
            <div class="ev-card-body">
                ${(card.body || '').replace(/\n/g,'<br>')}
                ${images.length ? `<div class="ev-img-grid">${imgsHtml}</div>` : ''}
                ${uploadHtml}
            </div>
        `;

        // Drag
        el.addEventListener('mousedown', e => startDrag(e, card.id, el));

        // Connect mode click
        el.addEventListener('click', e => {
            if (!connectMode) return;
            e.stopPropagation();
            if (!connectSrc) {
                connectSrc = card.id;
                el.classList.add('connecting-src');
            } else if (connectSrc !== card.id) {
                togglePlayerConn(connectSrc, card.id);
                document.getElementById('evcard-' + connectSrc)?.classList.remove('connecting-src');
                connectSrc = null;
                saveState(); renderSVG(); renderLog();
            }
        });

        board.appendChild(el);
    });

    updateCardTitleDatalist();
    renderSVG();
}

// ── Drag system ────────────────────────────────────────────────────────────

function startDrag(e, cardId, el) {
    if (connectMode) return;
    e.preventDefault();
    dragging = cardId;
    const rect = el.getBoundingClientRect();
    dragOffset = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    el.classList.add('dragging');
}

function onMouseMove(e) {
    if (!dragging) return;
    const outer  = document.getElementById('ev-board-outer');
    const canvas = document.getElementById('ev-board-canvas');
    if (!outer || !canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const rawX = (e.clientX - canvasRect.left) / zoom - dragOffset.x;
    const rawY = (e.clientY - canvasRect.top)  / zoom - dragOffset.y;
    const x = Math.max(0, Math.min(BOARD_W - 170, rawX));
    const y = Math.max(0, Math.min(BOARD_H - 90,  rawY));
    const el = document.getElementById('evcard-' + dragging);
    if (el) { el.style.left = x + 'px'; el.style.top = y + 'px'; }
    state.positions[dragging] = { x, y };
    renderSVG();
}

function onMouseUp() {
    if (!dragging) return;
    document.getElementById('evcard-' + dragging)?.classList.remove('dragging');
    dragging = null;
    saveState();
}

// ── Main render ────────────────────────────────────────────────────────────

function render() {
    document.getElementById('ev-case-title').textContent = cfg.caseTitle;
    document.getElementById('ev-case-sub').textContent   = state.active ? cfg.caseDesc : 'Awaiting Overlord activation...';

    const counts = { clue:0, suspect:0, location:0, event:0 };
    cfg.cards.forEach(c => { if (!c.hidden && counts[c.type] !== undefined) counts[c.type]++; });
    document.getElementById('ev-chip-clue').textContent     = counts.clue     + ' CLUES';
    document.getElementById('ev-chip-suspect').textContent  = counts.suspect  + ' SUSPECTS';
    document.getElementById('ev-chip-location').textContent = counts.location + ' LOCATIONS';
    document.getElementById('ev-chip-event').textContent    = counts.event    + ' EVENTS';

    const idle    = document.getElementById('ev-idle');
    const section = document.getElementById('ev-board-section');
    const hasCards = cfg.cards.length > 0;
    if (idle)    idle.style.display    = (!state.active && !hasCards) ? 'flex' : 'none';
    if (section) section.style.display = (state.active || hasCards)   ? 'block' : 'none';

    if (state.active || hasCards) { renderBoard(); applyZoom(); }

    const connectBtn = document.getElementById('ev-connect-btn');
    if (connectBtn) {
        connectBtn.textContent = connectMode ? '✕ EXIT CONNECT' : '⬡ CONNECT MODE';
        connectBtn.className   = 'ev-btn' + (connectMode ? ' active' : '');
    }

    renderLog();
    renderHConnList();
    updateCardTitleDatalist();

    if (isAdmin) {
        const sb = document.getElementById('ev-cfg-status-bar');
        if (sb) sb.textContent = `CARDS: ${cfg.cards.length} | HIDDEN LINKS: ${(cfg.hiddenConns||[]).length} | REVEALED: ${state.revealedConns.length}`;
    }
}

function renderLog() {
    const el  = document.getElementById('ev-log-entries');
    const cnt = document.getElementById('ev-log-count');
    if (!el) return;
    const entries = state.log || [];
    if (cnt) cnt.textContent = entries.length + ' ENTRIES';
    if (!entries.length) { el.innerHTML = '<div class="hle"><span class="hle-m">Evidence Board initialized.</span></div>'; return; }
    el.innerHTML = entries.slice(-40).reverse().map(e => {
        const t = new Date(e.t).toLocaleTimeString();
        return `<div class="hle ${e.type||''}"><span class="hle-t">[${t}]</span> <span class="hle-m">${e.msg}</span></div>`;
    }).join('');
}

function renderHConnList() {
    const el = document.getElementById('ev-hconn-list');
    if (!el || !isAdmin) return;
    el.innerHTML = (cfg.hiddenConns || []).map((c, i) =>
        `<div class="ev-conn-item"><span>${c[0]} ↔ ${c[1]}</span><button class="ev-conn-del" onclick="removeHConn(${i})">✕</button></div>`
    ).join('') || '<div style="font-size:9px;opacity:0.4;padding:4px;">No hidden connections defined.</div>';
}

function removeHConn(i) {
    cfg.hiddenConns.splice(i, 1);
    saveCfg(); renderHConnList();
}

// ── Evidence card reveal (called by hacking minigame on win) ──────────────

window.evRevealCard = function(cardId) {
    const card = cfg.cards.find(c => c.id === cardId);
    if (!card) return;
    card.hidden = false;
    addLog('success', `EVIDENCE REVEALED: [${card.type.toUpperCase()}] ${card.title}`);
    saveCfg(); renderBoard(); renderLog();
};

// ── Player add card ────────────────────────────────────────────────────────

window.togglePlayerAddForm = function() {
    const form = document.getElementById('ev-player-add-form');
    if (!form) return;
    const visible = form.style.display !== 'none';
    form.style.display = visible ? 'none' : 'flex';
};

window.playerAddCard = function() {
    const type  = document.getElementById('ev-player-type')?.value  || 'clue';
    const title = document.getElementById('ev-player-title')?.value.trim();
    const body  = document.getElementById('ev-player-body')?.value.trim() || '';
    if (!title) { document.getElementById('ev-player-title')?.focus(); return; }
    const id = 'p' + Date.now();
    cfg.cards.push({ id, type, title, body });
    addLog('', `[PLAYER] Card added: [${type.toUpperCase()}] ${title}`);
    document.getElementById('ev-player-title').value = '';
    document.getElementById('ev-player-body').value  = '';
    document.getElementById('ev-player-add-form').style.display = 'none';
    saveCfg(); render();
};

// ── Overlord panel ─────────────────────────────────────────────────────────

function initOverlordPanel() {
    const toggle = document.getElementById('ev-ov-toggle');
    const panel  = document.getElementById('ev-ov-panel');
    const close  = document.getElementById('ev-ov-close');
    if (toggle) { toggle.style.display = 'block'; toggle.addEventListener('click', () => panel.classList.toggle('hidden')); }
    if (close)  close.addEventListener('click', () => panel.classList.add('hidden'));

    document.getElementById('ev-cfg-publish')?.addEventListener('click', () => {
        readCfgFields();
        state.active = true;
        addLog('', 'Evidence board published by Overlord.');
        saveCfg(); saveState(); render();
    });

    document.getElementById('ev-cfg-clear-board')?.addEventListener('click', () => {
        if (!confirm('Clear ALL cards from the board?')) return;
        cfg.cards = []; cfg.hiddenConns = [];
        state = blankState(); state.active = false;
        addLog('', 'Board cleared by Overlord.');
        saveCfg(); saveState(); render();
    });

    document.getElementById('ev-cfg-add-card')?.addEventListener('click', () => {
        const type   = document.getElementById('ev-new-type')?.value  || 'clue';
        const title  = document.getElementById('ev-new-title')?.value.trim();
        const body   = document.getElementById('ev-new-body')?.value.trim()  || '';
        const hidden = !!document.getElementById('ev-new-hidden')?.checked;
        if (!title) return;
        const id = 'c' + Date.now();
        cfg.cards.push({ id, type, title, body, hidden });
        addLog('', `Card added: [${type.toUpperCase()}] ${title}${hidden ? ' [HIDDEN]' : ''}`);
        document.getElementById('ev-new-title').value = '';
        document.getElementById('ev-new-body').value  = '';
        saveCfg(); render();
    });

    document.getElementById('ev-cfg-add-hconn')?.addEventListener('click', () => {
        const a = document.getElementById('ev-hconn-a')?.value.trim();
        const b = document.getElementById('ev-hconn-b')?.value.trim();
        if (!a || !b || a === b) return;
        cfg.hiddenConns = cfg.hiddenConns || [];
        cfg.hiddenConns.push([a, b]);
        document.getElementById('ev-hconn-a').value = '';
        document.getElementById('ev-hconn-b').value = '';
        saveCfg(); renderHConnList();
    });

    populateAdminFields();
}

function populateAdminFields() {
    const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    v('ev-cfg-casetitle', cfg.caseTitle);
    v('ev-cfg-casedesc',  cfg.caseDesc);
    v('ev-cfg-noticeTN',  cfg.noticeTN);
}

function readCfgFields() {
    cfg.caseTitle = document.getElementById('ev-cfg-casetitle')?.value.trim() || 'CASE FILE';
    cfg.caseDesc  = document.getElementById('ev-cfg-casedesc')?.value.trim()  || '';
    cfg.noticeTN  = parseInt(document.getElementById('ev-cfg-noticeTN')?.value) || 6;
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ev-connect-btn')?.addEventListener('click', () => {
        connectMode = !connectMode;
        connectSrc  = null;
        document.querySelectorAll('.ev-card').forEach(el => el.classList.remove('connecting-src'));
        render();
    });

    document.getElementById('ev-clear-conn-btn')?.addEventListener('click', () => {
        state.playerConns = [];
        addLog('', 'Player connections cleared.');
        saveState(); renderSVG(); renderLog();
    });

    document.getElementById('ev-notice-btn')?.addEventListener('click', doNotice);
    document.getElementById('ev-notice-roll')?.addEventListener('keydown', e => { if (e.key === 'Enter') doNotice(); });

    document.getElementById('ev-zoom-in')?.addEventListener('click', () => {
        zoom = Math.min(ZOOM_MAX, parseFloat((zoom + ZOOM_STEP).toFixed(2)));
        applyZoom();
    });
    document.getElementById('ev-zoom-out')?.addEventListener('click', () => {
        zoom = Math.max(ZOOM_MIN, parseFloat((zoom - ZOOM_STEP).toFixed(2)));
        applyZoom();
    });
    document.getElementById('ev-zoom-reset')?.addEventListener('click', () => {
        zoom = 1.0; applyZoom();
    });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);

    // Cancel connect on board background click
    document.getElementById('ev-board')?.addEventListener('click', () => {
        if (connectMode && connectSrc) {
            document.getElementById('evcard-' + connectSrc)?.classList.remove('connecting-src');
            connectSrc = null;
        }
    });

    window.addEventListener('storage', e => {
        if (e.key === EV_CFG_KEY)   { cfg   = loadCfg();   render(); }
        if (e.key === EV_STATE_KEY) { state = loadState(); render(); }
    });

    window.addEventListener('resize', () => { if (state.active || cfg.cards.length) renderSVG(); });

    if (window.LuxorAuth && LuxorAuth.isAdmin()) {
        isAdmin = true;
        document.body.classList.add('is-admin');
        initOverlordPanel();
    }

    render();
});
