/* ================================================================
   LOCK INTERFACE — Lockpick minigame
   Config shared via localStorage / cross-tab storage events.
   ================================================================ */

// ── Config + state localStorage keys ────────────────────────────
const LP_CFG_KEY   = 'luxorLockpickConfig';
const LP_STATE_KEY = 'luxorLockpickState';

const ZONE_SIZES = { easy: 46, medium: 28, hard: 16, expert: 8 };
const CHAMBER_H  = 200;
const MOVER_H    = 28;

// ── SWADE skill roll helpers ─────────────────────────────────────
function swadeMod(roll) {
    if (roll === null || roll === undefined || roll === '') return 0;
    const r = Math.max(0, parseInt(roll) || 0);
    if (r >= 4) return Math.min(4, Math.floor((r - 4) / 4));
    return r - 4;
}
function swadeLabel(mod) {
    if (mod === 0) return '→ No roll / TN met — standard difficulty';
    if (mod > 0) {
        const words = ['','EASIER (wider zone)','MUCH EASIER (wider zone)','EVEN EASIER (wider zone)','MAX EASY (widest zone)'];
        return '→ ' + mod + ' RAISE' + (mod > 1 ? 'S' : '') + ' — ' + (words[mod] || words[4]);
    }
    const words = ['','SLIGHTLY HARDER (narrower zone)','HARDER (narrower zone)','EVEN HARDER (narrower zone)','HARDEST (narrowest zone)'];
    return '→ BELOW TN BY ' + (-mod) + ' — ' + (words[-mod] || words[4]);
}
function effectiveZoneH(base, mod) {
    const m = Math.max(-4, Math.min(4, mod));
    if (m > 0) return Math.min(80, Math.round(base * Math.pow(1.3, m)));
    if (m < 0) return Math.max(4, Math.round(base * Math.pow(0.75, -m)));
    return base;
}

// ── Load / save config ───────────────────────────────────────────
function defaultCfg() {
    return {
        numPins:    5,
        difficulty: 'medium',
        speedMult:  1.0,
        timeLimit:  60,
        failMode:   'reset',
        lockName:   'UNKNOWN TARGET',
        lockDesc:   'Awaiting Overlord activation...',
        active:     false,
        skillRoll:  null
    };
}

function loadCfg() {
    try { return Object.assign(defaultCfg(), JSON.parse(localStorage.getItem(LP_CFG_KEY) || '{}')); }
    catch { return defaultCfg(); }
}

function saveCfg(cfg) {
    localStorage.setItem(LP_CFG_KEY, JSON.stringify(cfg));
}

function loadState() {
    try { return Object.assign({ phase: 'idle', pinsSet: 0, startedBy: null, attempts: 0 },
                               JSON.parse(localStorage.getItem(LP_STATE_KEY) || '{}')); }
    catch { return { phase: 'idle', pinsSet: 0, startedBy: null, attempts: 0 }; }
}

function saveState(st) {
    localStorage.setItem(LP_STATE_KEY, JSON.stringify(st));
}

// ── Game runtime state ───────────────────────────────────────────
let cfg   = loadCfg();
let gst   = { phase: 'idle', pinsSet: 0, activePinIdx: 0, attempts: 0, timeRemaining: 0 };
let pins  = [];
let animId = null;
let timerInterval = null;

// ── Pin animation ────────────────────────────────────────────────
function buildPins() {
    pins = [];
    const baseSpeed = 0.0015 * cfg.speedMult;
    for (let i = 0; i < cfg.numPins; i++) {
        pins.push({
            position: Math.random() * (CHAMBER_H - MOVER_H),
            speed:    baseSpeed * (0.6 + Math.random() * 0.9),
            phase:    Math.random() * Math.PI * 2,
            set:      false,
            elapsed:  Math.random() * 10000
        });
    }
}

function pinZoneTop(zoneH) { return (CHAMBER_H - zoneH) / 2; }

function isPinInZone(pin) {
    const baseH  = ZONE_SIZES[cfg.difficulty] || 28;
    const zoneH  = effectiveZoneH(baseH, swadeMod(cfg.skillRoll));
    const zTop   = pinZoneTop(zoneH);
    const center = pin.position + MOVER_H / 2;
    return center >= zTop && center <= zTop + zoneH;
}

let lastTs = null;
function animFrame(ts) {
    if (gst.phase !== 'active') { lastTs = null; animId = null; return; }
    const dt = lastTs === null ? 0 : ts - lastTs;
    lastTs = ts;

    pins.forEach(pin => {
        if (pin.set) return;
        pin.elapsed += dt;
        const amp    = (CHAMBER_H - MOVER_H) / 2 - 4;
        const center = (CHAMBER_H - MOVER_H) / 2;
        pin.position = center + amp * Math.sin(pin.elapsed * pin.speed + pin.phase);
    });

    renderPinPositions();
    animId = requestAnimationFrame(animFrame);
}

// ── DOM rendering ────────────────────────────────────────────────
function buildPinDOM() {
    const container = document.getElementById('lp-pins-container');
    const pips      = document.getElementById('lp-cyl-pips');
    container.innerHTML = '';
    pips.innerHTML = '';

    const baseH = ZONE_SIZES[cfg.difficulty] || 28;
    const zoneH = effectiveZoneH(baseH, swadeMod(cfg.skillRoll));

    for (let i = 0; i < cfg.numPins; i++) {
        const zTop = pinZoneTop(zoneH);

        const col = document.createElement('div');
        col.className = 'lp-pin-col';
        col.id = `lp-pin-col-${i}`;
        col.dataset.idx = i;
        col.innerHTML = `
            <div class="lp-chamber" id="lp-chamber-${i}">
                <div class="lp-zone" id="lp-zone-${i}" style="top:${zTop}px;height:${zoneH}px;"></div>
                <div class="lp-driver" id="lp-driver-${i}"></div>
                <div class="lp-mover" id="lp-mover-${i}" style="top:${Math.round(pins[i].position)}px;"></div>
            </div>
            <div class="lp-pin-label">P${i + 1}</div>
            <div class="lp-binding-bar" id="lp-bbar-${i}"></div>
        `;
        col.addEventListener('click', () => attemptPin(i));
        container.appendChild(col);

        updateDriverPin(i);

        const pip = document.createElement('div');
        pip.className = 'lp-cyl-pip';
        pip.id = `lp-pip-${i}`;
        pips.appendChild(pip);
    }
}

function updateDriverPin(i) {
    const baseH = ZONE_SIZES[cfg.difficulty] || 28;
    const zoneH = effectiveZoneH(baseH, swadeMod(cfg.skillRoll));
    const zTop  = pinZoneTop(zoneH);
    const driver = document.getElementById(`lp-driver-${i}`);
    if (driver) {
        driver.style.height  = pins[i].set ? '0px' : `${zTop}px`;
        driver.style.opacity = pins[i].set ? '0' : '1';
    }
}

function renderPinPositions() {
    pins.forEach((pin, i) => {
        const mover = document.getElementById(`lp-mover-${i}`);
        if (mover && !pin.set) mover.style.top = `${Math.round(pin.position)}px`;
    });
}

function updatePinStates() {
    pins.forEach((pin, i) => {
        const col = document.getElementById(`lp-pin-col-${i}`);
        const pip = document.getElementById(`lp-pip-${i}`);
        if (!col) return;
        col.classList.remove('active', 'set', 'failed');
        if (pin.set) {
            col.classList.add('set');
            if (pip) { pip.classList.remove('active'); pip.classList.add('set'); }
        } else if (i === gst.activePinIdx && gst.phase === 'active') {
            col.classList.add('active');
            if (pip) { pip.classList.remove('set'); pip.classList.add('active'); }
        } else {
            if (pip) pip.classList.remove('set', 'active');
        }
    });
    updateCylinder();
}

function updateCylinder() {
    const pct  = cfg.numPins > 0 ? gst.pinsSet / cfg.numPins : 0;
    const circ = 2 * Math.PI * 40;
    const arc  = pct * circ;

    const arcEl    = document.getElementById('lp-cyl-arc');
    const needle   = document.getElementById('lp-cyl-needle');
    const pctLabel = document.getElementById('lp-cyl-pct');
    if (arcEl)    arcEl.setAttribute('stroke-dasharray', `${arc.toFixed(1)} ${(circ - arc).toFixed(1)}`);
    if (needle)   needle.style.transform = `rotate(${pct * 90}deg)`;
    if (pctLabel) pctLabel.textContent = Math.round(pct * 100) + '%';
}

// ── Heads-up display ─────────────────────────────────────────────
function updateHUD() {
    document.getElementById('lp-pins-stat').textContent = `${gst.pinsSet}/${cfg.numPins}`;
    document.getElementById('lp-att-stat').textContent  = gst.attempts;

    const timEl = document.getElementById('lp-time-stat');
    if (cfg.timeLimit > 0 && gst.phase === 'active') {
        const t = Math.max(0, gst.timeRemaining);
        const m = Math.floor(t / 60);
        const s = t % 60;
        timEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        timEl.classList.toggle('danger', t <= 10);
    } else {
        timEl.textContent = cfg.timeLimit > 0 ? '—' : '∞';
        timEl.classList.remove('danger');
    }

    const badge = document.getElementById('lp-phase-badge');
    const labels = { idle: 'STANDBY', active: 'PICKING', won: 'OPEN', lost: 'FAILED' };
    badge.textContent = labels[gst.phase] || gst.phase.toUpperCase();
    badge.className   = 'lp-phase-badge ' + (gst.phase === 'won' ? 'won' : gst.phase === 'lost' ? 'lost' : gst.phase === 'active' ? 'active' : '');
}

function updateLockInfo() {
    document.getElementById('lp-lock-name').textContent = cfg.lockName;
    document.getElementById('lp-lock-desc').textContent = cfg.lockDesc;
}

// ── Terminal logger ──────────────────────────────────────────────
function termLog(msg, cls) {
    const term   = document.getElementById('lp-terminal');
    const cursor = term.querySelector('.lp-cursor');
    if (cursor) cursor.closest('.lp-term-line')?.remove();

    const line = document.createElement('div');
    line.className  = `lp-term-line ${cls || 'sys'}`;
    line.textContent = '> ' + msg;
    term.appendChild(line);

    const cur = document.createElement('div');
    cur.className = 'lp-term-line info';
    cur.innerHTML = '> <span class="lp-cursor"></span>';
    term.appendChild(cur);

    term.scrollTop = term.scrollHeight;
    while (term.children.length > 30) term.removeChild(term.firstChild);
}

// ── Game logic ───────────────────────────────────────────────────
function startGame() {
    gst.phase        = 'active';
    gst.pinsSet      = 0;
    gst.activePinIdx = 0;
    gst.attempts     = 0;
    gst.timeRemaining = cfg.timeLimit;

    buildPins();
    buildPinDOM();
    updatePinStates();
    updateHUD();
    updateLockInfo();

    document.getElementById('lp-idle-screen').style.display = 'none';
    document.getElementById('lp-game').style.display        = 'block';
    document.getElementById('lp-pick-btn').disabled         = false;

    const mod = swadeMod(cfg.skillRoll);
    const diffLabel = mod === 0 ? cfg.difficulty.toUpperCase()
        : mod > 0 ? cfg.difficulty.toUpperCase() + ' +' + mod + 'R'
        : cfg.difficulty.toUpperCase() + ' −' + (-mod);

    termLog(`Lock engaged: ${cfg.lockName}`, 'warn');
    termLog(`Pins: ${cfg.numPins}  Difficulty: ${diffLabel}  Speed: ${cfg.speedMult}×`, 'sys');
    if (cfg.skillRoll !== null) termLog(swadeLabel(mod).replace('→ ', ''), 'sys');
    termLog('Begin picking. Active pin highlighted in cyan.', 'sys');

    lastTs = null;
    if (animId) cancelAnimationFrame(animId);
    animId = requestAnimationFrame(animFrame);

    clearInterval(timerInterval);
    if (cfg.timeLimit > 0) {
        timerInterval = setInterval(() => {
            if (gst.phase !== 'active') { clearInterval(timerInterval); return; }
            gst.timeRemaining--;
            updateHUD();
            if (gst.timeRemaining <= 0) {
                clearInterval(timerInterval);
                loseGame('TIME EXPIRED');
            }
        }, 1000);
    }
}

function stopGame() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    clearInterval(timerInterval);
    lastTs = null;
}

function resetGame() {
    stopGame();
    gst.phase        = 'idle';
    gst.pinsSet      = 0;
    gst.activePinIdx = 0;
    gst.attempts     = 0;

    document.getElementById('lp-game').style.display        = 'none';
    document.getElementById('lp-idle-screen').style.display = 'flex';
    updateHUD();
    updateLockInfo();
    termLog('Lock interface reset. Awaiting activation.', 'info');
}

function winGame() {
    stopGame();
    gst.phase = 'won';
    updateHUD();
    saveState({ phase: 'won', pinsSet: gst.pinsSet, attempts: gst.attempts, startedBy: LuxorAuth.getSession()?.username });
    termLog('ALL PINS SET — CYLINDER ROTATING', 'win');
    termLog(`Lock breached in ${gst.attempts} attempt(s). ACCESS GRANTED.`, 'win');
    document.getElementById('lp-pick-btn').disabled = true;
    setTimeout(() => { updateCylinder(); }, 400);
}

function loseGame(reason) {
    stopGame();
    gst.phase = 'lost';
    updateHUD();
    saveState({ phase: 'lost', attempts: gst.attempts, startedBy: LuxorAuth.getSession()?.username });
    termLog(`LOCK SEIZED — ${reason}`, 'err');
    termLog('Pick sequence failed. Mechanical lockout engaged.', 'err');
    document.getElementById('lp-pick-btn').disabled = true;
}

function findNextUnsetPin() {
    for (let i = 0; i < pins.length; i++) {
        if (!pins[i].set) return i;
    }
    return -1;
}

function flashFail() {
    pins.forEach((p, i) => {
        if (p.set) return;
        const col = document.getElementById(`lp-pin-col-${i}`);
        if (col) {
            col.classList.add('failed');
            setTimeout(() => col.classList.remove('failed'), 400);
        }
    });
}

function attemptPin(idx) {
    if (gst.phase !== 'active') return;
    if (idx !== gst.activePinIdx) {
        termLog(`Pin ${idx + 1} is not binding. Focus on P${gst.activePinIdx + 1}.`, 'info');
        return;
    }

    const pin = pins[idx];
    if (!pin || pin.set) return;

    gst.attempts++;

    if (isPinInZone(pin)) {
        pin.set = true;
        gst.pinsSet++;

        pin.position = (CHAMBER_H - MOVER_H) / 2;
        const mover = document.getElementById(`lp-mover-${idx}`);
        if (mover) mover.style.top = `${Math.round(pin.position)}px`;
        updateDriverPin(idx);

        termLog(`Pin ${idx + 1} set. ` + (gst.pinsSet < cfg.numPins ? `${cfg.numPins - gst.pinsSet} remaining.` : ''), 'ok');

        if (gst.pinsSet >= cfg.numPins) {
            updatePinStates();
            updateHUD();
            winGame();
            return;
        }

        gst.activePinIdx = findNextUnsetPin();
        updatePinStates();
        updateHUD();
    } else {
        const closeness = (() => {
            const baseH  = ZONE_SIZES[cfg.difficulty] || 28;
            const zoneH  = effectiveZoneH(baseH, swadeMod(cfg.skillRoll));
            const zTop   = pinZoneTop(zoneH);
            const center = pin.position + MOVER_H / 2;
            const dist   = Math.min(Math.abs(center - zTop), Math.abs(center - (zTop + zoneH)));
            if (dist < 15) return 'CLOSE';
            if (dist < 40) return 'OFF';
            return 'WAY OFF';
        })();

        termLog(`Miss on P${idx + 1} — ${closeness}. ${cfg.failMode === 'reset' ? 'Tension lost, all pins reset.' : 'Partial slip.'}`, 'err');

        if (cfg.failMode === 'reset') {
            pins.forEach(p => { if (p.set) p.set = false; });
            gst.pinsSet      = 0;
            gst.activePinIdx = findNextUnsetPin();
            pins.forEach((_, i) => updateDriverPin(i));
            updateCylinder();
            document.getElementById('lp-cyl-pips').querySelectorAll('.lp-cyl-pip').forEach(p => {
                p.classList.remove('set', 'active');
            });
        }

        flashFail();
        updatePinStates();
        updateHUD();
    }
}

// ── Keyboard control ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
    if (e.code === 'Space' && gst.phase === 'active') {
        e.preventDefault();
        attemptPin(gst.activePinIdx);
    }
});

document.getElementById('lp-pick-btn').addEventListener('click', () => {
    if (gst.phase === 'active') attemptPin(gst.activePinIdx);
});

document.getElementById('lp-restart-btn').addEventListener('click', () => {
    if (cfg.active) startGame();
    else resetGame();
});

// ── Cross-tab sync ───────────────────────────────────────────────
window.addEventListener('storage', e => {
    if (e.key === LP_CFG_KEY) {
        const newCfg = loadCfg();
        const wasActive = cfg.active;
        cfg = newCfg;
        updateLockInfo();

        if (!wasActive && cfg.active) {
            termLog('Overlord activated lock system.', 'warn');
            startGame();
        } else if (wasActive && !cfg.active) {
            termLog('Overlord deactivated lock system.', 'info');
            resetGame();
        }
    }
});

// ── Initial state sync ───────────────────────────────────────────
function syncToConfig() {
    cfg = loadCfg();
    updateLockInfo();
    if (cfg.active) {
        termLog('Lock system online — pick initiated.', 'warn');
        startGame();
    } else {
        updateHUD();
    }
}

// ═══════════════════════════════════════════════════════════════════
//  OVERLORD ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════

function initOverlordPanel() {
    const toggle = document.getElementById('lp-ov-toggle');
    const panel  = document.getElementById('lp-ov-panel');
    toggle.style.display = 'block';

    function refreshAdminStatus() {
        const st    = loadState();
        const bar   = document.getElementById('lp-cfg-status-bar');
        const phase = { idle: 'STANDBY', active: 'BREACH ACTIVE', won: 'LOCK OPEN', lost: 'LOCKOUT' }[st.phase] || st.phase;
        bar.textContent = `STATUS: ${phase} | PINS: ${st.pinsSet || 0}/${cfg.numPins} | ATTEMPTS: ${st.attempts || 0}` +
                          (st.startedBy ? ` | OPR: ${st.startedBy}` : '');
    }

    function updateSkillLabel() {
        const rawRoll = document.getElementById('lp-cfg-skill-roll')?.value;
        const lbl     = document.getElementById('lp-cfg-skill-lbl');
        if (lbl) lbl.textContent = swadeLabel(swadeMod(rawRoll));
    }

    function populateForm() {
        document.getElementById('lp-cfg-name').value  = cfg.lockName;
        document.getElementById('lp-cfg-desc').value  = cfg.lockDesc;
        document.getElementById('lp-cfg-pins').value  = cfg.numPins;
        document.getElementById('lp-cfg-diff').value  = cfg.difficulty;
        document.getElementById('lp-cfg-speed').value = cfg.speedMult;
        document.getElementById('lp-cfg-time').value  = cfg.timeLimit;
        document.getElementById('lp-cfg-fail').value  = cfg.failMode;
        const skillEl = document.getElementById('lp-cfg-skill-roll');
        if (skillEl) skillEl.value = cfg.skillRoll !== null ? cfg.skillRoll : '';
        updateSkillLabel();
        refreshAdminStatus();
    }

    toggle.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) populateForm();
    });

    document.getElementById('lp-ov-close').addEventListener('click', () => {
        panel.classList.add('hidden');
    });

    const skillInput = document.getElementById('lp-cfg-skill-roll');
    if (skillInput) skillInput.addEventListener('input', updateSkillLabel);

    function readForm() {
        const rawRoll = document.getElementById('lp-cfg-skill-roll')?.value.trim();
        return {
            lockName:   document.getElementById('lp-cfg-name').value.trim() || 'UNKNOWN TARGET',
            lockDesc:   document.getElementById('lp-cfg-desc').value.trim() || '',
            numPins:    Math.min(8, Math.max(3, parseInt(document.getElementById('lp-cfg-pins').value) || 5)),
            difficulty: document.getElementById('lp-cfg-diff').value,
            speedMult:  Math.min(3, Math.max(0.5, parseFloat(document.getElementById('lp-cfg-speed').value) || 1)),
            timeLimit:  Math.max(0, parseInt(document.getElementById('lp-cfg-time').value) || 0),
            failMode:   document.getElementById('lp-cfg-fail').value,
            skillRoll:  rawRoll === '' ? null : (parseInt(rawRoll) || null)
        };
    }

    document.getElementById('lp-cfg-save').addEventListener('click', () => {
        Object.assign(cfg, readForm());
        saveCfg(cfg);
        updateLockInfo();
        refreshAdminStatus();
        document.getElementById('lp-cfg-save').textContent = '✓ SAVED';
        setTimeout(() => { document.getElementById('lp-cfg-save').textContent = 'SAVE CONFIG'; }, 1500);
    });

    document.getElementById('lp-cfg-activate').addEventListener('click', () => {
        Object.assign(cfg, readForm(), { active: true });
        saveCfg(cfg);
        saveState({ phase: 'active', pinsSet: 0, attempts: 0, startedBy: LuxorAuth.getSession()?.username });
        updateLockInfo();
        termLog('Overlord activated lock system.', 'warn');
        startGame();
        refreshAdminStatus();
        panel.classList.add('hidden');
    });

    document.getElementById('lp-cfg-deactivate').addEventListener('click', () => {
        cfg.active = false;
        saveCfg(cfg);
        saveState({ phase: 'idle', pinsSet: 0, attempts: 0, startedBy: null });
        resetGame();
        refreshAdminStatus();
    });

    document.getElementById('lp-cfg-reset-game').addEventListener('click', () => {
        saveState({ phase: cfg.active ? 'active' : 'idle', pinsSet: 0, attempts: 0,
                    startedBy: LuxorAuth.getSession()?.username });
        if (cfg.active) startGame(); else resetGame();
        refreshAdminStatus();
    });
}

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    syncToConfig();
    if (window.LuxorAuth && LuxorAuth.isAdmin()) {
        initOverlordPanel();
    }
});
