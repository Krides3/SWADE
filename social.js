'use strict';

const SE_CFG_KEY   = 'luxorSocialConfig';
const SE_STATE_KEY = 'luxorSocialState';

const SE_DEF_CFG = {
    npcName: 'UNKNOWN SUBJECT',
    npcRole: 'Corporate Security Guard',
    resistance: 100,
    maxAttempts: 10,
    winMessage: 'Subject has divulged classified information. Objective complete.',
    enabled: { rapport: true, pressure: true, deception: true, silence: true },
    approachTN: { rapport: 6, pressure: 8, deception: 8, silence: 4 }
};

// Per-approach effect: base resistance reduction on success, bonus per raise, backfire on failure
const SE_EFFECT = {
    rapport:   { baseReduce: 12, raiseBonus: 5,  backfireChance: 0,    backfireGain: 0  },
    pressure:  { baseReduce: 24, raiseBonus: 8,  backfireChance: 0.38, backfireGain: 12 },
    deception: { baseReduce: 24, raiseBonus: 8,  backfireChance: 0.32, backfireGain: 15 },
    silence:   { baseReduce:  6, raiseBonus: 3,  backfireChance: 0,    backfireGain: 0  }
};

const SE_APPROACHES = {
    rapport: {
        label: 'RAPPORT',
        range: [10, 16],
        backfire: 0,
        backfireGain: 0,
        opLines: [
            "Let's see this from your perspective.",
            "I understand why you made that call.",
            "There's a way out of this that works for everyone.",
            "I'm not here to hurt you — I just need the truth.",
            "You seem like someone who knows how this ends."
        ],
        goodResp: [
            "Subject shifts in their seat. A crack in the armor.",
            "They look away briefly. You're getting through.",
            "A long pause. They're considering what you said.",
            "You sense their resolve softening. Keep going.",
            "Their posture relaxes slightly. Progress."
        ],
        badResp: []
    },
    pressure: {
        label: 'PRESSURE',
        range: [20, 30],
        backfire: 0.38,
        backfireGain: 12,
        opLines: [
            "We have everything we need. This is your last chance.",
            "The others already talked. You're protecting no one.",
            "Don't make this harder than it needs to be.",
            "Your silence is only buying you more trouble."
        ],
        goodResp: [
            "They slam a hand on the table — but you see fear behind the anger.",
            "Subject goes pale. The pressure is working.",
            "They start talking faster, trying to fill the silence.",
            "The defiance is cracking. Almost there."
        ],
        badResp: [
            "Subject clams up entirely. Too much, too fast.",
            "They shut down completely. Your pressure backfired.",
            "Wrong move — they've gone cold and silent.",
            "Subject demands a lawyer. You've overplayed your hand."
        ]
    },
    deception: {
        label: 'DECEPTION',
        range: [22, 32],
        backfire: 0.32,
        backfireGain: 15,
        opLines: [
            "We found the files. It's all in the report.",
            "Your colleague confirmed everything already.",
            "Surveillance captured the whole exchange.",
            "There's no version of this where you walk away clean."
        ],
        goodResp: [
            "Your bluff lands — they believe you have more than you do.",
            "Their eyes flicker. The misdirection worked.",
            "They start correcting details to 'fix' your fabrication.",
            "Subject takes the bait. Resistance crumbling."
        ],
        badResp: [
            "They see through it immediately. Trust is gone.",
            "Your lie was too obvious — they're on guard now.",
            "Subject scoffs. They know you were bluffing.",
            "Backfire. They harden their position."
        ]
    },
    silence: {
        label: 'SILENCE',
        range: [4, 8],
        backfire: 0,
        backfireGain: 0,
        opLines: ['...', '...', '...', '...'],
        goodResp: [
            "The silence stretches. Subject fidgets.",
            "They fill the quiet with nervous words.",
            "You wait. It costs them more than it costs you.",
            "Subject breaks the silence first. Small victory.",
            "Pressure without words. They feel it."
        ],
        badResp: []
    }
};

let cfg   = loadCfg();
let state = loadState();
let isAdmin = false;

function loadCfg() {
    try { return Object.assign({}, SE_DEF_CFG, JSON.parse(localStorage.getItem(SE_CFG_KEY) || '{}')); }
    catch { return Object.assign({}, SE_DEF_CFG); }
}
function saveCfg()   { localStorage.setItem(SE_CFG_KEY, JSON.stringify(cfg)); }

function loadState() {
    try { return JSON.parse(localStorage.getItem(SE_STATE_KEY)) || blankState(); }
    catch { return blankState(); }
}
function saveState() { localStorage.setItem(SE_STATE_KEY, JSON.stringify(state)); }

function blankState() {
    return { phase:'idle', resistance:100, maxResistance:100, attempts:0, maxAttempts:10, transcript:[], log:[], pendingApproach:null };
}

function swadeMod(roll) {
    if (roll === null || roll === undefined || roll === '') return 0;
    const r = Math.max(0, parseInt(roll) || 0);
    return r >= 4 ? Math.min(4, Math.floor((r - 4) / 4)) : r - 4;
}

function effMult(mod) {
    return mod >= 0 ? Math.pow(1.25, mod) : Math.pow(0.8, -mod);
}

function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Core mechanic ──────────────────────────────────────────────────────────

function seApproach(type) {
    if (state.phase !== 'active') return;
    const ap = SE_APPROACHES[type];
    if (!ap || !cfg.enabled[type]) return;
    state.pendingApproach = type;
    saveState();
    render();
}

function seSubmitRoll() {
    const rollEl = document.getElementById('se-roll-inp');
    const roll   = parseInt(rollEl?.value);
    if (isNaN(roll) || roll < 1) { rollEl?.focus(); return; }

    const type = state.pendingApproach;
    if (!type) return;

    const ap  = SE_APPROACHES[type];
    const eff = SE_EFFECT[type] || { baseReduce:10, raiseBonus:4, backfireChance:0, backfireGain:0 };
    const tn  = ((cfg.approachTN || {}) [type]) || 4;

    const success = roll >= tn;
    const raises  = success ? Math.floor((roll - tn) / 4) : 0;

    state.attempts++;
    state.pendingApproach = null;

    let delta = 0, cls = '';

    if (success) {
        delta = -(eff.baseReduce + raises * eff.raiseBonus);
        cls   = 'success';
        const raiseStr = raises > 0 ? ` +${raises} raise${raises !== 1 ? 's' : ''}` : '';
        addLog('success', `[${ap.label}] Success (roll ${roll})${raiseStr} — resistance -${Math.abs(delta)}.`);
    } else {
        const backfired = eff.backfireChance > 0 && Math.random() < eff.backfireChance;
        if (backfired) {
            delta = eff.backfireGain;
            cls   = 'fail';
            addLog('danger', `[${ap.label}] Failed (roll ${roll}) & backfired — resistance +${delta}.`);
        } else {
            cls = 'fail';
            addLog('danger', `[${ap.label}] Failed (roll ${roll}) — no effect.`);
        }
    }

    if (delta !== 0) state.resistance = Math.max(0, state.resistance + delta);

    addTx('OPERATOR', pick(ap.opLines), '');
    const isBackfire = !success && delta > 0;
    const npcResp = isBackfire
        ? pick(ap.badResp.length ? ap.badResp : ap.goodResp)
        : (success ? pick(ap.goodResp) : pick(ap.badResp.length ? ap.badResp : ap.goodResp));
    addTx(cfg.npcName.split(' ')[0] || 'SUBJECT', npcResp, cls);

    if (success && raises > 0) {
        addTx('SYSTEM', `${raises} raise${raises !== 1 ? 's' : ''} — heightened effectiveness.`, 'warn');
    }

    if (state.resistance <= 0) {
        state.phase = 'won';
        addTx('SYSTEM', 'PSYCHOLOGICAL RESISTANCE DEPLETED — SUBJECT IS TALKING.', 'success');
        addLog('success', 'SUBJECT BROKEN — session complete.');
    } else if (state.attempts >= state.maxAttempts) {
        state.phase = 'lost';
        addTx('SYSTEM', 'SESSION LIMIT REACHED. SUBJECT REMAINS UNCOOPERATIVE.', 'fail');
        addLog('danger', 'MAX EXCHANGES REACHED — session failed.');
    }

    if (rollEl) rollEl.value = '';
    saveState();
    render();
}

function seCancelRoll() {
    state.pendingApproach = null;
    saveState();
    render();
}
window.seCancelRoll = seCancelRoll;

function addTx(who, text, cls) {
    state.transcript.push({ who, text, cls });
}

function addLog(type, msg) {
    state.log.push({ t: Date.now(), type, msg });
}
function clearLog() { state.log = []; saveState(); renderLog(); }
window.clearLog = clearLog;

// ── Render ─────────────────────────────────────────────────────────────────

function render() {
    const badge = document.getElementById('se-phase-badge');
    if (badge) {
        const labels = { idle:'STANDBY', active:'ACTIVE', won:'BROKEN', lost:'FAILED' };
        badge.className = 'se-phase-badge ' + (state.phase !== 'idle' ? state.phase : '');
        badge.textContent = labels[state.phase] || state.phase.toUpperCase();
    }

    const nameEl = document.getElementById('se-npc-name');
    const roleEl = document.getElementById('se-npc-role');
    if (nameEl) nameEl.textContent = cfg.npcName;
    if (roleEl) roleEl.textContent = state.phase === 'idle' ? 'Awaiting Overlord activation...' : cfg.npcRole;

    const attEl = document.getElementById('se-att-stat');
    const resEl = document.getElementById('se-res-stat');
    if (attEl) attEl.textContent = state.phase === 'idle' ? '0/0' : `${state.attempts}/${state.maxAttempts}`;
    if (resEl) resEl.textContent = state.phase === 'idle' ? '—' : Math.max(0, state.resistance);

    const fill = document.getElementById('se-res-fill');
    const pct  = document.getElementById('se-res-pct');
    if (state.phase !== 'idle' && fill) {
        const p = Math.max(0, Math.min(100, (state.resistance / state.maxResistance) * 100));
        fill.style.width = p + '%';
        if (pct) pct.textContent = Math.round(p) + '%';
        fill.style.background = p > 60
            ? 'linear-gradient(90deg,#b8a800,#e0cc00)'
            : p > 30
                ? 'linear-gradient(90deg,#d4890a,#e09a00)'
                : 'linear-gradient(90deg,#c0392b,#e74c3c)';
    } else if (pct) {
        pct.textContent = '—';
    }

    const idle = document.getElementById('se-idle');
    const game = document.getElementById('se-game');
    if (idle) idle.style.display = state.phase === 'idle' ? 'flex' : 'none';
    if (game) game.style.display = state.phase === 'idle' ? 'none' : 'block';

    const isPending = !!state.pendingApproach;
    ['rapport','pressure','deception','silence'].forEach(a => {
        const btn = document.getElementById('se-btn-' + a);
        if (!btn) return;
        btn.disabled = state.phase !== 'active' || !cfg.enabled[a] || isPending;
        btn.style.display = cfg.enabled[a] === false ? 'none' : '';
    });

    // Roll input panel
    const rollPanel = document.getElementById('se-roll-panel');
    if (rollPanel) {
        rollPanel.classList.toggle('show', state.phase === 'active' && isPending);
        if (isPending) {
            const ap = SE_APPROACHES[state.pendingApproach];
            const nameEl = document.getElementById('se-roll-approach-name');
            if (nameEl) nameEl.textContent = ap ? ap.label : state.pendingApproach.toUpperCase();
            const tnBox = document.getElementById('se-roll-ov-tn');
            const tnVal = document.getElementById('se-roll-tn-val');
            if (tnBox) tnBox.style.display = isAdmin ? '' : 'none';
            if (tnVal && isAdmin) {
                tnVal.textContent = ((cfg.approachTN || {})[state.pendingApproach]) || 4;
            }
        }
    }

    // Overlay
    const overlay = document.getElementById('se-overlay');
    if (overlay) {
        if (state.phase === 'won' || state.phase === 'lost') {
            overlay.classList.add('show');
            const t = document.getElementById('se-ov-result-title');
            const s = document.getElementById('se-ov-result-sub');
            if (t) { t.textContent = state.phase === 'won' ? 'SUBJECT BROKEN' : 'SESSION FAILED'; t.className = 'se-ov-title ' + state.phase; }
            if (s) s.textContent = state.phase === 'won' ? cfg.winMessage : 'Subject refused to cooperate. Session terminated.';
        } else {
            overlay.classList.remove('show');
        }
    }

    renderTranscript();
    renderLog();

    if (isAdmin) {
        const sb = document.getElementById('se-cfg-status-bar');
        if (sb) sb.textContent = `STATUS: ${state.phase.toUpperCase()} | RES: ${Math.max(0,state.resistance)}/${state.maxResistance} | EX: ${state.attempts}/${state.maxAttempts}`;
    }
}

function renderTranscript() {
    const body = document.getElementById('se-tx-body');
    const cnt  = document.getElementById('se-tx-count');
    if (!body) return;
    const entries = state.transcript || [];
    if (cnt) cnt.textContent = entries.length + ' EXCHANGES';
    body.innerHTML = '';
    if (!entries.length) {
        body.innerHTML = '<div class="se-entry"><span class="se-who system">SYSTEM</span><span class="se-msg">Session initiated. Subject brought to interrogation room.</span></div>';
        return;
    }
    entries.forEach(e => {
        const d = document.createElement('div');
        d.className = 'se-entry' + (e.cls ? ' ' + e.cls : '');
        const whoClass = e.who === 'OPERATOR' ? 'operator' : e.who === 'SYSTEM' ? 'system' : 'npc';
        d.innerHTML = `<span class="se-who ${whoClass}">${e.who}</span><span class="se-msg">${e.text}</span>`;
        body.appendChild(d);
    });
    body.scrollTop = body.scrollHeight;
}

function renderLog() {
    const el  = document.getElementById('se-log-entries');
    const cnt = document.getElementById('se-log-count');
    if (!el) return;
    const entries = state.log || [];
    if (cnt) cnt.textContent = entries.length + ' ENTRIES';
    if (!entries.length) { el.innerHTML = '<div class="hle"><span class="hle-m">Module initialized.</span></div>'; return; }
    el.innerHTML = entries.slice(-40).reverse().map(e => {
        const t = new Date(e.t).toLocaleTimeString();
        return `<div class="hle ${e.type || ''}"><span class="hle-t">[${t}]</span> <span class="hle-m">${e.msg}</span></div>`;
    }).join('');
}

// ── Overlord panel ─────────────────────────────────────────────────────────

function initOverlordPanel() {
    const toggle = document.getElementById('se-ov-toggle');
    const panel  = document.getElementById('se-ov-panel');
    const close  = document.getElementById('se-ov-close');

    if (toggle) { toggle.style.display = 'block'; toggle.addEventListener('click', () => panel.classList.toggle('hidden')); }
    if (close)  close.addEventListener('click', () => panel.classList.add('hidden'));

    document.getElementById('se-cfg-activate')?.addEventListener('click', () => {
        readCfg();
        state = blankState();
        state.phase        = 'active';
        state.resistance   = cfg.resistance;
        state.maxResistance= cfg.resistance;
        state.maxAttempts  = cfg.maxAttempts;
        addLog('', 'Session activated by Overlord.');
        saveCfg(); saveState(); render();
    });

    document.getElementById('se-cfg-deactivate')?.addEventListener('click', () => {
        state.phase = 'idle';
        addLog('', 'Session deactivated by Overlord.');
        saveState(); render();
    });

    document.getElementById('se-cfg-reset')?.addEventListener('click', () => {
        state = blankState();
        addLog('', 'Session force-reset by Overlord.');
        saveState(); render();
    });

    document.getElementById('se-cfg-save')?.addEventListener('click', () => {
        readCfg(); saveCfg(); render();
    });

    populateAdminFields();
}

function populateAdminFields() {
    const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const c = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
    v('se-cfg-name',      cfg.npcName);
    v('se-cfg-role',      cfg.npcRole);
    v('se-cfg-resistance',cfg.resistance);
    v('se-cfg-maxatt',    cfg.maxAttempts);
    v('se-cfg-winmsg',    cfg.winMessage);
    const en = cfg.enabled || SE_DEF_CFG.enabled;
    c('se-en-rapport',   en.rapport   !== false);
    c('se-en-pressure',  en.pressure  !== false);
    c('se-en-deception', en.deception !== false);
    c('se-en-silence',   en.silence   !== false);
    const tn = cfg.approachTN || SE_DEF_CFG.approachTN;
    v('se-tn-rapport',   tn.rapport   ?? 6);
    v('se-tn-pressure',  tn.pressure  ?? 8);
    v('se-tn-deception', tn.deception ?? 8);
    v('se-tn-silence',   tn.silence   ?? 4);
}

function readCfg() {
    const g = id => document.getElementById(id);
    cfg.npcName     = g('se-cfg-name')?.value.trim()  || 'UNKNOWN SUBJECT';
    cfg.npcRole     = g('se-cfg-role')?.value.trim()  || 'Unknown';
    cfg.resistance  = parseInt(g('se-cfg-resistance')?.value) || 100;
    cfg.maxAttempts = parseInt(g('se-cfg-maxatt')?.value) || 10;
    cfg.winMessage  = g('se-cfg-winmsg')?.value.trim() || 'Information extracted.';
    cfg.enabled = {
        rapport:   g('se-en-rapport')?.checked  !== false,
        pressure:  g('se-en-pressure')?.checked !== false,
        deception: g('se-en-deception')?.checked !== false,
        silence:   g('se-en-silence')?.checked  !== false
    };
    cfg.approachTN = {
        rapport:   parseInt(g('se-tn-rapport')?.value)   || 6,
        pressure:  parseInt(g('se-tn-pressure')?.value)  || 8,
        deception: parseInt(g('se-tn-deception')?.value) || 8,
        silence:   parseInt(g('se-tn-silence')?.value)   || 4
    };
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('se-ov-result-btn')?.addEventListener('click', () => {
        state.phase = 'idle';
        state.transcript = [];
        state.pendingApproach = null;
        saveState(); render();
    });

    document.getElementById('se-roll-confirm')?.addEventListener('click', seSubmitRoll);
    document.getElementById('se-roll-cancel')?.addEventListener('click', seCancelRoll);
    document.getElementById('se-roll-inp')?.addEventListener('keydown', e => { if (e.key === 'Enter') seSubmitRoll(); });

    window.addEventListener('storage', e => {
        if (e.key === SE_CFG_KEY)   { cfg   = loadCfg();   render(); }
        if (e.key === SE_STATE_KEY) { state = loadState(); render(); }
    });

    if (window.LuxorAuth && LuxorAuth.isAdmin()) {
        isAdmin = true;
        initOverlordPanel();
    }

    render();
});
