/* ================================================================
   CODEBREAKER — Signal Lock Protocol
   Mastermind-style hex code deduction hacking minigame.
   State shared via localStorage / cross-tab storage events.
   ================================================================ */
(function () {
    'use strict';

    const CFG_KEY   = 'luxorCodebreakerConfig';
    const STATE_KEY = 'luxorCodebreakerState';

    const HEX_CHARS = '0123456789ABCDEF';

    const DEF_EXFIL = [
        '> SIGNAL LOCK BYPASS COMPLETE',
        '> SECONDARY FIREWALL DISSOLVED',
        '> ACCESSING RESTRICTED PARTITION',
        '> DECRYPTION KEY VERIFIED',
        '',
        '╔════════════════════════════════════════╗',
        '║  CLASSIFIED — SIGNAL LOCK ACCESS L5   ║',
        '╠════════════════════════════════════════╣',
        '║  OPERATION: NIGHTFALL                  ║',
        '║  AUTH CODE: BRAVO-4-4-ECHO             ║',
        '║  ENCRYPTION: NULLIFIED                 ║',
        '║  TARGET: NEXUS-7 INSTALLATION          ║',
        '╠════════════════════════════════════════╣',
        '║  ACCESS: UNRESTRICTED                  ║',
        '║  EXFIL WINDOW: 0340Z — 0420Z          ║',
        '╚════════════════════════════════════════╝',
        '',
        '> DATA EXTRACTION COMPLETE [100%]',
        '! WARNING: TRACE ROUTINE INITIATED',
        '! DISCONNECT IMMEDIATELY'
    ];

    const DEF_CFG = {
        enabled:         true,
        targetName:      'SIGNAL-LOCK-01',
        codeLength:      4,
        maxAttempts:     6,
        secretCode:      '',
        successMsg:      'SIGNAL LOCK BYPASSED — ACCESS GRANTED',
        failMsg:         'SIGNAL LOCK FAILED — SECURITY ALERT TRIGGERED',
        extractedData:   [...DEF_EXFIL],
        revealNodeOnWin: '',
        skillRoll:       null
    };

    /* ── SWADE modifier ─────────────────────────────────────────── */
    function swadeMod(roll) {
        if (roll === null || roll === undefined || roll === '') return 0;
        const r = Math.max(0, parseInt(roll) || 0);
        if (r >= 4) return Math.min(4, Math.floor((r - 4) / 4));
        return r - 4;
    }
    function swadeLabel(mod) {
        if (mod === 0) return '→ No roll / TN met — standard difficulty';
        if (mod > 0) {
            const words = ['','EASIER (+1 attempt)','MUCH EASIER (+2 attempts)','EVEN EASIER (+3 attempts)','MAX EASY (+4 attempts)'];
            return '→ ' + mod + ' RAISE' + (mod > 1 ? 'S' : '') + ' — ' + (words[mod] || words[4]);
        }
        const words = ['','SLIGHTLY HARDER (−1 attempt)','HARDER (−2 attempts)','EVEN HARDER (−3 attempts)','HARDEST (−4 attempts)'];
        return '→ BELOW TN BY ' + (-mod) + ' — ' + (words[-mod] || words[4]);
    }

    /* ── Asset node list ────────────────────────────────────────── */
    function getAssetNodes() {
        const BUILTIN_IDS = [
            {id:'luxor-hq',name:'LUXOR HQ'},{id:'london-stn',name:'London Station'},
            {id:'paris-safe',name:'Paris Safehouse'},{id:'madrid-relay',name:'Madrid Relay'},
            {id:'oslo-stn',name:'Oslo Station'},{id:'warsaw-stn',name:'Warsaw Station'},
            {id:'prague-contact',name:'Prague Contact'},{id:'athens-out',name:'Athens Outpost'},
            {id:'istanbul-cross',name:'Istanbul Crossing'},{id:'moscow-echo',name:'Echo Station'},
            {id:'berlin-asset',name:'Berlin Asset'},{id:'cairo-hub',name:'Cairo Hub'},
            {id:'dubai-relay',name:'Dubai Relay'},{id:'nairobi-stn',name:'Nairobi Station'},
            {id:'johannesburg-out',name:'Johannesburg Outpost'},{id:'lagos-contact',name:'Lagos Contact'},
            {id:'mumbai-port',name:'Mumbai Port Watch'},{id:'karachi-surv',name:'Karachi Surveillance'},
            {id:'bangkok-transit',name:'Bangkok Transit'},{id:'singapore-hub',name:'Singapore Hub'},
            {id:'tokyo-office',name:'Tokyo Office'},{id:'beijing-watch',name:'Beijing Watch'},
            {id:'sydney-delta',name:'Team Delta'},{id:'newyork-office',name:'New York Office'},
            {id:'dc-contact',name:'Washington Contact'},{id:'mexico-relay',name:'Mexico City Relay'},
            {id:'bogota-stn',name:'Bogotá Station'},{id:'saopaulo-hub',name:'São Paulo Hub'},
            {id:'buenosaires-cntct',name:'Buenos Aires Contact'},{id:'vancouver-stn',name:'Vancouver Station'},
            {id:'sigma-naval',name:'Maritime Unit Sigma'},{id:'malta-fleet',name:'Mediterranean Fleet'},
            {id:'natl-patrol',name:'North Atlantic Patrol'},{id:'scs-watch',name:'South China Sea Watch'}
        ];
        try {
            const custom = JSON.parse(localStorage.getItem('luxor_custom_deployments') || '[]');
            return [...BUILTIN_IDS, ...custom.map(d => ({ id: d.id, name: d.name }))];
        } catch (e) { return BUILTIN_IDS; }
    }

    /* ── State / config ─────────────────────────────────────────── */
    let cfg   = { ...DEF_CFG };
    let state = blankState();

    const isAdmin  = window.LuxorAuth && LuxorAuth.isAdmin();
    const session  = window.LuxorAuth && LuxorAuth.getSession();
    const username = session ? session.username : 'UNKNOWN';

    function blankState() {
        return {
            phase:         'idle',
            code:          null,
            guesses:       [],
            attemptsMax:   6,
            startedBy:     null,
            startedAt:     null,
            endedAt:       null,
            extractedData: [],
            log:           []
        };
    }

    /* ── Persistence ────────────────────────────────────────────── */
    function loadCfg() {
        try {
            const s = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
            if (s) cfg = { ...DEF_CFG, ...s, extractedData: s.extractedData || DEF_CFG.extractedData };
        } catch (e) {}
    }
    function saveCfg()   { localStorage.setItem(CFG_KEY,   JSON.stringify(cfg)); }
    function loadState() {
        try { state = JSON.parse(localStorage.getItem(STATE_KEY) || 'null') || blankState(); }
        catch (e) { state = blankState(); }
    }
    function saveState() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }

    /* ── Helpers ────────────────────────────────────────────────── */
    function randomCode(len) {
        return Array.from({length: len}, () => HEX_CHARS[Math.floor(Math.random() * 16)]).join('');
    }

    function scoreGuess(guess, code) {
        const n = code.length;
        let exact = 0;
        const codeLeft  = [];
        const guessLeft = [];
        for (let i = 0; i < n; i++) {
            if (guess[i] === code[i]) { exact++; }
            else { codeLeft.push(code[i]); guessLeft.push(guess[i]); }
        }
        let present = 0;
        guessLeft.forEach(ch => {
            const idx = codeLeft.indexOf(ch);
            if (idx >= 0) { present++; codeLeft.splice(idx, 1); }
        });
        return { exact, present };
    }

    function logEntry(type, msg) { return { t: Date.now(), user: username, type, msg }; }
    function trimLog() { if (state.log && state.log.length > 60) state.log = state.log.slice(-60); }
    function pad(n)    { return String(n).padStart(2, '0'); }
    function esc(s)    {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    /* ── Game actions ───────────────────────────────────────────── */
    window.startGame = function () {
        const len = Math.max(3, Math.min(6, cfg.codeLength || 4));
        let code  = (cfg.secretCode || '').trim().toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, len);
        if (code.length !== len) code = randomCode(len);

        const mod      = swadeMod(cfg.skillRoll);
        const attempts = Math.max(1, Math.min(12, (cfg.maxAttempts || 6) + mod));
        state = {
            ...blankState(),
            phase:         'active',
            code,
            attemptsMax:   attempts,
            startedBy:     username,
            startedAt:     Date.now(),
            extractedData: cfg.extractedData ? [...cfg.extractedData] : [...DEF_EXFIL],
            log: [...state.log, logEntry('warn', `SIGNAL LOCK ENGAGED — TARGET: ${cfg.targetName} — CODE: ${len} DIGITS — ATTEMPTS: ${attempts}`)]
        };
        trimLog();
        saveState();
        render();
    };

    window.submitGuess = function () {
        if (state.phase !== 'active') return;
        const inp = document.getElementById('cb-guess-input');
        if (!inp) return;
        const val = inp.value.trim().toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, state.code.length);
        if (val.length !== state.code.length) {
            inp.classList.add('shake');
            setTimeout(() => inp.classList.remove('shake'), 500);
            inp.focus();
            return;
        }
        inp.value = '';

        const { exact, present } = scoreGuess(val, state.code);
        state.guesses.push({ guess: val, exact, present });

        const left = state.attemptsMax - state.guesses.length;
        const won  = exact === state.code.length;

        if (won) {
            state.log.push(logEntry('success', `SIGNAL LOCK BYPASSED — CODE "${val}" ACCEPTED — ACCESS GRANTED`));
            trimLog();
            endGame('won');
        } else {
            state.log.push(logEntry('', `Attempt: "${val}" — ${exact} exact · ${present} present — ${left} attempt${left !== 1 ? 's' : ''} left`));
            trimLog();
            saveState();
            if (left <= 0) {
                setTimeout(() => endGame('lost'), 300);
            } else {
                render();
                setTimeout(() => { const i2 = document.getElementById('cb-guess-input'); if (i2) i2.focus(); }, 50);
            }
        }
    };

    function endGame(result) {
        state.phase   = result;
        state.endedAt = Date.now();
        state.log.push(logEntry(
            result === 'won' ? 'success' : 'danger',
            result === 'won' ? cfg.successMsg : cfg.failMsg + ` — Code was: ${state.code}`
        ));
        trimLog();
        saveState();
        render();
        if (result === 'won') {
            freshWin = true;
            if (cfg.revealNodeOnWin) {
                try {
                    const r = JSON.parse(localStorage.getItem('luxorAssetRedacted') || '{}');
                    delete r[cfg.revealNodeOnWin];
                    localStorage.setItem('luxorAssetRedacted', JSON.stringify(r));
                } catch(e) {}
            }
            setTimeout(startExfilReadout, 400);
        }
    }

    window.resetGame = function () {
        typewriterStop();
        const prevLog = state.log || [];
        state = {
            ...blankState(),
            log: [...prevLog, logEntry('warn', 'SIGNAL LOCK RESET — SESSION CLEARED')]
        };
        trimLog();
        saveState();
        render();
    };

    /* ── Overlord controls ──────────────────────────────────────── */
    window.adminForceWin = function () {
        if (state.phase !== 'active') {
            state.code      = state.code || randomCode(cfg.codeLength || 4);
            state.startedBy = username;
            state.startedAt = Date.now();
        }
        endGame('won');
    };
    window.adminForceFail = function () {
        if (state.phase !== 'active') {
            state.code      = state.code || randomCode(cfg.codeLength || 4);
            state.startedBy = username;
            state.startedAt = Date.now();
        }
        endGame('lost');
    };
    window.adminReset  = () => window.resetGame();
    window.adminReveal = () => {
        if (!state.code) { showAdmMsg('No active game — start a game first.', true); return; }
        showAdmMsg(`Current code: ${state.code}`, false);
    };
    window.toggleEnabled = () => {
        cfg.enabled = !cfg.enabled; saveCfg();
        const btn = document.getElementById('adm-toggle-btn');
        if (btn) btn.textContent = cfg.enabled ? 'DISABLE' : 'ENABLE';
        render();
    };

    window.saveConfig = function () {
        const gv = id => { const el = document.getElementById(id); return el ? el.value : ''; };
        cfg.targetName   = (gv('adm-target').trim()      || cfg.targetName).toUpperCase();
        cfg.codeLength   = Math.max(3, Math.min(6,  parseInt(gv('adm-code-length')) || 4));
        cfg.maxAttempts  = Math.max(2, Math.min(12, parseInt(gv('adm-attempts'))    || 6));
        cfg.secretCode   = gv('adm-secret-code').trim().toUpperCase().replace(/[^0-9A-F]/g, '');
        cfg.successMsg   = gv('adm-success-msg').trim() || cfg.successMsg;
        cfg.failMsg      = gv('adm-fail-msg').trim()    || cfg.failMsg;
        cfg.revealNodeOnWin = gv('adm-reveal-node');

        const rawExfil = gv('adm-exfil').split('\n');
        if (rawExfil.length > 0) cfg.extractedData = rawExfil;

        const rawRoll  = gv('adm-skill-roll').trim();
        cfg.skillRoll  = rawRoll === '' ? null : (parseInt(rawRoll) || null);
        const lbl = document.getElementById('adm-skill-roll-lbl');
        if (lbl) lbl.textContent = swadeLabel(swadeMod(cfg.skillRoll));

        saveCfg();
        showAdmMsg('✓ CONFIGURATION SAVED', false);
        if (state.phase === 'idle') saveState();
        render();
    };

    function showAdmMsg(txt, isErr) {
        const el = document.getElementById('adm-msg');
        if (!el) return;
        el.className = 'adm-msg ' + (isErr ? 'err' : 'ok');
        el.textContent = txt;
        setTimeout(() => { el.className = 'adm-msg'; }, 3500);
    }

    /* ── Typewriter / exfil readout ─────────────────────────────── */
    let typeTimer  = null;
    let typeActive = false;
    let freshWin   = false;

    function typewriterStop() { clearTimeout(typeTimer); typeActive = false; }

    function startExfilReadout() {
        if (typeActive) return;
        const container = document.getElementById('cipher-exfil-output');
        if (!container) return;
        typewriterStop();
        container.innerHTML = '';
        typeActive = true;

        const rawLines = (state.extractedData && state.extractedData.length ? state.extractedData : DEF_EXFIL);
        const lines = rawLines.map(raw => {
            const hasBorder = /[═║╔╗╚╝╠╣]/.test(raw);
            let cls = 'exl';
            if (raw.startsWith('>'))      cls += ' exl-sys';
            else if (raw.startsWith('!')) cls += ' exl-warn';
            else if (hasBorder)           cls += ' exl-border';
            else if (raw.trim() === '')   cls += ' exl-blank';
            else                          cls += ' exl-data';
            return { text: raw, cls };
        });

        let lineIdx = 0, charIdx = 0, curEl = null;

        function next() {
            if (!typeActive) return;
            if (lineIdx >= lines.length) {
                const cur = document.createElement('span');
                cur.className = 'exl-cursor'; cur.textContent = ' █';
                if (curEl) curEl.appendChild(cur); else container.appendChild(cur);
                typeActive = false; return;
            }
            const line = lines[lineIdx];
            if (charIdx === 0) {
                curEl = document.createElement('div');
                curEl.className = line.cls;
                container.appendChild(curEl);
            }
            if (line.text.length === 0) {
                lineIdx++; charIdx = 0;
                container.scrollTop = container.scrollHeight;
                typeTimer = setTimeout(next, 80); return;
            }
            curEl.textContent = line.text.slice(0, charIdx + 1);
            charIdx++;
            container.scrollTop = container.scrollHeight;
            if (charIdx >= line.text.length) {
                lineIdx++; charIdx = 0;
                const pause = line.cls.includes('exl-sys') ? 110 : line.cls.includes('exl-warn') ? 130 : 45;
                typeTimer = setTimeout(next, pause);
            } else {
                const speed = line.cls.includes('exl-border') ? 8
                            : line.cls.includes('exl-sys')    ? 32
                            : line.cls.includes('exl-warn')   ? 40 : 22;
                typeTimer = setTimeout(next, speed);
            }
        }
        typeTimer = setTimeout(next, 550);
    }

    function renderExfilImmediate() {
        const container = document.getElementById('cipher-exfil-output');
        if (!container) return;
        const rawLines = (state.extractedData && state.extractedData.length ? state.extractedData : DEF_EXFIL);
        container.innerHTML = '';
        rawLines.forEach(raw => {
            if (raw.trim() === '') { container.appendChild(document.createElement('div')); return; }
            const hasBorder = /[═║╔╗╚╝╠╣]/.test(raw);
            let cls = 'exl';
            if      (raw.startsWith('>'))  cls += ' exl-sys';
            else if (raw.startsWith('!'))  cls += ' exl-warn';
            else if (hasBorder)            cls += ' exl-border';
            else                           cls += ' exl-data';
            const div = document.createElement('div');
            div.className   = cls;
            div.textContent = raw;
            container.appendChild(div);
        });
    }

    /* ── Rendering ──────────────────────────────────────────────── */
    function render() {
        renderStatus();
        renderGame();
        renderLog();
        if (isAdmin) renderAdminStatus();
    }

    function renderStatus() {
        const nameEl  = document.getElementById('cipher-target-name');
        const phaseEl = document.getElementById('cipher-phase-badge');
        if (nameEl)  nameEl.textContent = cfg.targetName;
        if (phaseEl) {
            const lbl = { idle:'STANDBY', active:'LOCK ENGAGED', won:'LOCK BYPASSED', lost:'LOCK FAILED' };
            phaseEl.textContent = lbl[state.phase] || 'STANDBY';
            phaseEl.className   = 'cipher-phase-badge ' + state.phase;
        }
    }

    function renderGame() {
        const area = document.getElementById('cipher-game-area');
        if (!area) return;
        if (!cfg.enabled) {
            area.innerHTML = '<div class="cipher-locked">▦ CODEBREAKER OFFLINE — CONTACT OVERLORD</div>';
            return;
        }
        switch (state.phase) {
            case 'idle':   renderIdle(area);   break;
            case 'active': renderActive(area); break;
            case 'won':    renderWin(area);    break;
            default:       renderLost(area);   break;
        }
    }

    function renderIdle(area) {
        if (isAdmin) {
            area.innerHTML = `
                <div class="cipher-splash">
                    <div class="cipher-splash-icon">⬡</div>
                    <div class="cipher-splash-title">CODEBREAKER</div>
                    <div class="cipher-splash-meta">TARGET: ${esc(cfg.targetName)}</div>
                    <div class="cipher-splash-desc">
                        Signal lock protocol active — crack the ${esc(String(cfg.codeLength))}-digit hex code.<br>
                        ${esc(String(cfg.maxAttempts))} attempt${cfg.maxAttempts !== 1 ? 's' : ''} available.<br>
                        <span style="color:#5dbf72">◉</span> = correct position &nbsp;·&nbsp;
                        <span style="color:#b8a800">○</span> = wrong position &nbsp;·&nbsp;
                        <span style="color:#334">·</span> = not in code
                    </div>
                    <div class="cipher-actions" style="margin-top:0.4rem;">
                        <button class="cipher-btn cipher-btn-primary" onclick="startGame()">⬡ ENGAGE SIGNAL LOCK</button>
                    </div>
                </div>`;
        } else {
            area.innerHTML = `
                <div class="cipher-splash">
                    <div class="cipher-splash-icon" style="opacity:0.2">⬡</div>
                    <div class="cipher-splash-title" style="opacity:0.35">CODEBREAKER OFFLINE</div>
                    <div class="cipher-splash-meta" style="opacity:0.25">AWAITING OVERLORD ACTIVATION</div>
                </div>`;
        }
    }

    function renderActive(area) {
        const guesses = state.guesses || [];
        const maxA    = state.attemptsMax;
        const left    = maxA - guesses.length;
        const n       = state.code.length;

        const pips = Array.from({length: maxA}, (_, i) =>
            `<div class="cs-pip ${i >= left ? 'used' : ''}"></div>`
        ).join('');

        const histHtml = guesses.length === 0
            ? '<div class="cb-history-empty">— no guesses yet —</div>'
            : guesses.map(g => {
                const exactDots   = '<span class="cb-exact">' + '◉'.repeat(g.exact)   + '</span>';
                const presentDots = '<span class="cb-present">' + '○'.repeat(g.present) + '</span>';
                const absentDots  = '<span class="cb-absent">' + '·'.repeat(n - g.exact - g.present) + '</span>';
                return `<div class="cb-guess-row">
                    <span class="cb-guess-code">${esc(g.guess)}</span>
                    <span class="cb-score">${exactDots}${presentDots}${absentDots}</span>
                </div>`;
            }).join('');

        area.innerHTML = `
            <div class="cb-terminal">
                <div class="cb-term-header">
                    <div class="cb-th-title">LUXOR // SIGNAL LOCK PROTOCOL v2.0</div>
                    <div class="cb-th-target">ACTIVE TARGET: ${esc(cfg.targetName)}</div>
                    <div class="cb-th-warn">! BREACH SEQUENCE ACTIVE — COUNTERMEASURES ENGAGED !</div>
                </div>
                <div class="cb-body">
                    <div class="cb-history-panel">
                        <div class="cb-panel-label">▸ ATTEMPT LOG</div>
                        <div class="cb-history" id="cb-history">${histHtml}</div>
                    </div>
                    <div class="cb-input-panel">
                        <div class="cb-panel-label">▸ ATTEMPTS REMAINING</div>
                        <div class="cb-pips-wrap">
                            <div class="cs-pips">${pips}</div>
                            <div class="cs-pip-label">${left} / ${maxA} REMAINING</div>
                        </div>
                        <div class="cb-panel-label" style="margin-top:1rem;">▸ ENTER ${n}-DIGIT HEX CODE</div>
                        <div class="cb-input-row">
                            <input class="cb-input" id="cb-guess-input" type="text"
                                maxlength="${n}"
                                placeholder="${'_'.repeat(n)}"
                                onkeydown="if(event.key==='Enter')submitGuess()"
                                oninput="this.value=this.value.toUpperCase().replace(/[^0-9A-F]/g,'').slice(0,${n})"
                                autocomplete="off" spellcheck="false">
                            <button class="cipher-btn cipher-btn-primary" onclick="submitGuess()">SUBMIT</button>
                        </div>
                        <div class="cb-hex-legend">VALID: 0–9 &nbsp;·&nbsp; A–F</div>
                        <div class="cb-legend-block">
                            <div class="cb-leg-row"><span class="cb-exact">◉</span> Correct digit, correct position</div>
                            <div class="cb-leg-row"><span class="cb-present">○</span> Correct digit, wrong position</div>
                            <div class="cb-leg-row"><span class="cb-absent">·</span> Digit not in code</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="cipher-actions">
                <button class="cipher-btn cipher-btn-danger" onclick="endGame('lost')">⊠ ABORT SESSION</button>
            </div>`;

        const h = document.getElementById('cb-history');
        if (h) h.scrollTop = h.scrollHeight;
        setTimeout(() => { const inp = document.getElementById('cb-guess-input'); if (inp) inp.focus(); }, 50);
    }

    function renderLost(area) {
        area.innerHTML = `
            <div class="cipher-splash s-lost">
                <div class="cipher-splash-icon">⊠</div>
                <div class="cipher-splash-title">${esc(cfg.failMsg)}</div>
                <div class="cipher-splash-desc">
                    ${state.guesses.length} guess${state.guesses.length !== 1 ? 'es' : ''} made
                    &nbsp;·&nbsp; Code was: <span style="color:var(--warn)">${esc(state.code || '???')}</span>
                    &nbsp;·&nbsp; Operator: ${esc(state.startedBy || '???')}
                </div>
                <div class="cipher-actions" style="margin-top:0.5rem;">
                    <button class="cipher-btn cipher-btn-primary" onclick="resetGame()">↺ RESET LOCK</button>
                </div>
            </div>`;
    }

    function renderWin(area) {
        const guesses = state.guesses.length;
        const maxA    = state.attemptsMax;

        area.innerHTML = `
            <div class="cipher-win-screen">
                <div class="cipher-win-header">
                    <div class="win-badge">LUXOR // SIGNAL LOCK BYPASSED</div>
                    <div class="win-icon">◈</div>
                    <div class="win-title">ACCESS GRANTED</div>
                    <div class="win-sub">${esc(cfg.successMsg)}</div>
                    <div class="win-detail">
                        ${guesses} GUESS${guesses !== 1 ? 'ES' : ''} USED &nbsp;·&nbsp;
                        ${maxA - guesses} ATTEMPT${(maxA - guesses) !== 1 ? 'S' : ''} REMAINING &nbsp;·&nbsp;
                        OPERATOR: ${esc(state.startedBy || '???')}
                    </div>
                </div>
                <div class="cipher-exfil-wrap">
                    <div class="cipher-exfil-hdr">
                        <span class="exfil-hdr-title">LUXOR // DATA EXFILTRATION STREAM &mdash; ${esc(cfg.targetName)}</span>
                        <span class="exfil-hdr-blink">● EXTRACTING</span>
                    </div>
                    <div class="cipher-exfil-output" id="cipher-exfil-output"></div>
                </div>
                <div class="cipher-actions">
                    <button class="cipher-btn cipher-btn-primary" onclick="resetGame()">↺ RESET LOCK</button>
                </div>
            </div>`;

        if (freshWin) { setTimeout(startExfilReadout, 80); }
        else          { setTimeout(renderExfilImmediate, 80); }
    }

    function renderLog() {
        const el      = document.getElementById('hack-log-entries');
        const countEl = document.getElementById('log-count');
        if (!el) return;
        const log = state.log || [];
        if (countEl) countEl.textContent = `${log.length} ENTR${log.length === 1 ? 'Y' : 'IES'}`;
        if (log.length === 0) {
            el.innerHTML = '<div class="hle"><span class="hle-m" style="opacity:0.3">— AWAITING ACTIVATION —</span></div>';
            return;
        }
        el.innerHTML = log.slice(-25).map(e => {
            const d  = new Date(e.t);
            const ts = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            return `<div class="hle ${e.type || ''}">
                <span class="hle-t">${ts}</span>
                <span class="hle-u">${esc(e.user || 'SYSTEM')}</span>
                <span class="hle-m">${esc(e.msg || '')}</span>
            </div>`;
        }).join('');
        el.scrollTop = el.scrollHeight;
    }

    /* ── Admin panel ────────────────────────────────────────────── */
    function initAdmin() {
        if (!isAdmin) return;
        const row = document.getElementById('overlord-toggle-row');
        if (row) row.style.display = 'flex';
        populateAdmin();
    }

    window.toggleOverlordPanel = function () {
        const panel = document.getElementById('hack-admin-panel');
        const btn   = document.getElementById('overlord-toggle-btn');
        if (!panel) return;
        const isOpen = panel.style.display === 'block';
        panel.style.display = isOpen ? 'none' : 'block';
        if (btn) btn.classList.toggle('open', !isOpen);
    };

    function populateAdmin() {
        const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        sv('adm-target',      cfg.targetName);
        sv('adm-code-length', cfg.codeLength);
        sv('adm-attempts',    cfg.maxAttempts);
        sv('adm-secret-code', cfg.secretCode);
        sv('adm-success-msg', cfg.successMsg);
        sv('adm-fail-msg',    cfg.failMsg);
        sv('adm-exfil',       (cfg.extractedData || DEF_EXFIL).join('\n'));
        sv('adm-skill-roll',  cfg.skillRoll !== null ? cfg.skillRoll : '');
        const lbl = document.getElementById('adm-skill-roll-lbl');
        if (lbl) lbl.textContent = swadeLabel(swadeMod(cfg.skillRoll));
        renderAdminStatus();
        const toggleBtn = document.getElementById('adm-toggle-btn');
        if (toggleBtn) toggleBtn.textContent = cfg.enabled ? 'DISABLE' : 'ENABLE';
        const revealSel = document.getElementById('adm-reveal-node');
        if (revealSel) {
            revealSel.innerHTML = '<option value="">— NONE —</option>';
            getAssetNodes().forEach(n => {
                const opt = document.createElement('option');
                opt.value = n.id; opt.textContent = n.name + ' [' + n.id + ']';
                if (n.id === cfg.revealNodeOnWin) opt.selected = true;
                revealSel.appendChild(opt);
            });
        }
    }

    function renderAdminStatus() {
        const colors = { idle:'var(--text-dim)', active:'var(--cyan)', won:'var(--cyan)', lost:'var(--danger)' };
        const color  = colors[state.phase] || 'var(--text-dim)';
        let txt = `Phase: <span style="color:${color}">${state.phase.toUpperCase()}</span>`;
        if (state.startedBy) txt += ` &nbsp;|&nbsp; Operator: ${esc(state.startedBy)}`;
        if (state.code)      txt += ` &nbsp;|&nbsp; Code: <span style="color:var(--warn)">${esc(state.code)}</span>`;
        const body   = document.getElementById('adm-status');
        const inline = document.getElementById('adm-status-inline');
        if (body)   body.innerHTML   = txt;
        if (inline) inline.innerHTML = txt;
    }

    /* ── Cross-tab sync ─────────────────────────────────────────── */
    window.addEventListener('storage', function (e) {
        if (e.key === STATE_KEY) {
            const prev = state.phase;
            try { state = JSON.parse(e.newValue) || blankState(); } catch (ex) {}
            render();
            if (state.phase === 'won' && prev !== 'won') {
                freshWin = true;
                setTimeout(startExfilReadout, 400);
            }
        }
        if (e.key === CFG_KEY) {
            try { cfg = JSON.parse(e.newValue) || { ...DEF_CFG }; } catch (ex) {}
            if (isAdmin) populateAdmin();
            render();
        }
    });

    /* ── Init ───────────────────────────────────────────────────── */
    loadCfg();
    loadState();
    const prevPhase = state.phase;
    render();
    initAdmin();
    if (prevPhase === 'won') setTimeout(startExfilReadout, 500);

})();
