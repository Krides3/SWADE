/* ================================================================
   CIPHER TERMINAL — Hacking minigame
   State shared via localStorage / cross-tab storage events.
   ================================================================ */
(function () {
    'use strict';

    const CFG_KEY   = 'luxorCipherConfig';
    const STATE_KEY = 'luxorCipherState';

    /* ── Default word pool ─────────────────────────────────────── */
    const BUILT_IN_POOL = [
        'SHADOW','VECTOR','BREACH','CIPHER','TARGET','PATROL',
        'SIGNAL','KERNEL','SYSTEM','BUFFER','UPLINK','DAEMON',
        'FALCON','HUNTER','ZEPHYR','REBOOT','COMBAT','ESCAPE',
        'LAUNCH','SECTOR','DEPLOY','ARMORY','MATRIX','DRAGON',
        'KNIGHT','RANGER','BANDIT','SPIDER','WRAITH','CASTLE'
    ];

    const DEF_EXFIL = [
        '> AUTHENTICATING BYPASS CREDENTIALS...',
        '> SECONDARY FIREWALL DISSOLVED',
        '> ACCESSING RESTRICTED PARTITION',
        '> LOADING: /data/ops/classified/',
        '> DECRYPTION KEY ACCEPTED',
        '',
        '╔════════════════════════════════════════╗',
        '║  CLASSIFIED — LEVEL 5 ACCESS             ║',
        '╠════════════════════════════════════════╣',
        '║  OPERATION: NIGHTFALL                    ║',
        '║  STATUS: ACTIVE                          ║',
        '║  GRID REF: 47.23N / 122.81W             ║',
        '║  TARGET: NEXUS-7 INSTALLATION            ║',
        '╠════════════════════════════════════════╣',
        '║  PERSONNEL: 12 ARMED GUARDS              ║',
        '║              2 OVERWATCH SNIPERS          ║',
        '║              1 HVT — CALLSIGN: REAPER     ║',
        '╠════════════════════════════════════════╣',
        '║  ACCESS CODE: ALPHA-7-7-NINER            ║',
        '║  EXFIL WINDOW: 0340Z — 0420Z            ║',
        '╚════════════════════════════════════════╝',
        '',
        '> DATA EXTRACTION COMPLETE [100%]',
        '! WARNING: TRACE ROUTINE INITIATED',
        '! DISCONNECT IMMEDIATELY'
    ];

    const DEF_CFG = {
        enabled:        true,
        targetName:     'MAINFRAME-ALPHA',
        wordCount:      12,
        attempts:       4,
        wordPool:       [...BUILT_IN_POOL],
        forcedAnswer:   '',
        successMsg:     'ACCESS GRANTED — WELCOME, OPERATOR',
        failMsg:        'TERMINAL LOCKED — SECURITY ALERT TRIGGERED',
        extractedData:  [...DEF_EXFIL],
        revealNodeOnWin: '',
        skillRoll:      null
    };

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

    const JUNK = '!@#$%^&*()-+=|;:,./<>?~`';
    function rjunk(n) {
        return Array.from({length: n}, () => JUNK[Math.floor(Math.random() * JUNK.length)]).join('');
    }

    /* ── State / config ────────────────────────────────────────── */
    let cfg   = { ...DEF_CFG };
    let state = blankState();

    const isAdmin  = window.LuxorAuth && LuxorAuth.isAdmin();
    const session  = window.LuxorAuth && LuxorAuth.getSession();
    const username = session ? session.username : 'UNKNOWN';

    function blankState() {
        return {
            phase:        'idle',
            answer:       null,
            entries:      [],
            guesses:      [],
            hints:        [],
            attemptsMax:  4,
            startedBy:    null,
            startedAt:    null,
            endedAt:      null,
            extractedData: [],
            log:          []
        };
    }

    /* ── Persistence ───────────────────────────────────────────── */
    function loadCfg() {
        try {
            const s = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
            if (s) cfg = { ...DEF_CFG, ...s, wordPool: s.wordPool || DEF_CFG.wordPool, extractedData: s.extractedData || DEF_CFG.extractedData };
        } catch (e) {}
    }
    function saveCfg()   { localStorage.setItem(CFG_KEY,   JSON.stringify(cfg)); }
    function loadState() {
        try { state = JSON.parse(localStorage.getItem(STATE_KEY) || 'null') || blankState(); }
        catch (e) { state = blankState(); }
    }
    function saveState() { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }

    /* ── Helpers ───────────────────────────────────────────────── */
    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function likeness(guess, answer) {
        let n = 0;
        for (let i = 0; i < Math.min(guess.length, answer.length); i++) {
            if (guess[i] === answer[i]) n++;
        }
        return n;
    }
    function logEntry(type, msg) { return { t: Date.now(), user: username, type, msg }; }
    function trimLog() { if (state.log && state.log.length > 60) state.log = state.log.slice(-60); }
    function pad(n)    { return String(n).padStart(2, '0'); }
    function esc(s)    {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    /* ── Bracket effects generation ────────────────────────────── */
    const BRACKET_PAIRS = [['[',']'], ['<','>'], ['{','}']];

    function genEffects(wordCount) {
        const count = Math.min(5, Math.max(2, Math.floor(wordCount / 3)));
        const pool = [];
        pool.push('attempt');
        if (count >= 3) pool.push('hint');
        while (pool.length < count) pool.push('dud');
        return shuffle(pool);
    }

    function buildEntries(pool, count) {
        const words   = shuffle(pool).slice(0, count);
        const effects = genEffects(words.length);

        const bracketIdx = new Set();
        while (bracketIdx.size < effects.length) {
            bracketIdx.add(Math.floor(Math.random() * words.length));
        }
        const bIdxArr = [...bracketIdx];

        return words.map((word, i) => {
            const bi = bIdxArr.indexOf(i);
            let bracket = null;
            if (bi >= 0) {
                const pair = BRACKET_PAIRS[Math.floor(Math.random() * BRACKET_PAIRS.length)];
                bracket = {
                    open:            pair[0],
                    close:           pair[1],
                    content:         rjunk(2 + Math.floor(Math.random() * 3)),
                    effect:          effects[bi],
                    used:            false,
                    inPost:          Math.random() > 0.5,
                    replacementJunk: null
                };
            }
            return {
                word,
                pre:       rjunk(1 + Math.floor(Math.random() * 3)),
                post:      rjunk(1 + Math.floor(Math.random() * 3)),
                addr:      '0x' + (0xA000 + i * 8).toString(16).toUpperCase().padStart(4, '0'),
                bracket,
                eliminated: false
            };
        });
    }

    /* ── Game actions ──────────────────────────────────────────── */
    window.startGame = function () {
        const pool = cfg.wordPool.filter(w => w.trim().length > 0);
        if (pool.length < 2) { alert('Word pool too small — add more words in Overlord config.'); return; }

        const count   = Math.min(cfg.wordCount, pool.length);
        const entries = buildEntries(pool, count);

        let answer = cfg.forcedAnswer.trim().toUpperCase();
        if (answer && entries.some(e => e.word === answer)) {
            // forced answer already in list — good
        } else if (answer) {
            entries[0] = { ...entries[0], word: answer };
        } else {
            answer = entries[Math.floor(Math.random() * entries.length)].word;
        }

        const mod = swadeMod(cfg.skillRoll);
        state = {
            ...blankState(),
            phase:         'active',
            answer,
            entries,
            attemptsMax:   Math.max(1, Math.min(10, cfg.attempts + mod)),
            startedBy:     username,
            startedAt:     Date.now(),
            extractedData: cfg.extractedData ? [...cfg.extractedData] : [...DEF_EXFIL],
            log: [...state.log, logEntry('warn', `TERMINAL ACTIVATED — TARGET: ${cfg.targetName}`)]
        };
        trimLog();
        saveState();
        render();
    };

    window.tryWord = function (word) {
        if (state.phase !== 'active') return;
        if (state.guesses.some(g => g.word === word)) return;
        if (state.entries.find(e => e.word === word)?.eliminated) return;
        const left = state.attemptsMax - state.guesses.length;
        if (left <= 0) return;

        const score   = likeness(word, state.answer);
        const perfect = word === state.answer;

        state.guesses.push({ word, likeness: score });

        if (perfect) {
            state.log.push(logEntry('success', `PASSWORD ACCEPTED — "${word}" — ACCESS GRANTED`));
            trimLog();
            endGame('won');
        } else {
            const remaining = state.attemptsMax - state.guesses.length;
            state.log.push(logEntry('', `Attempt: "${word}" — ${score}/${state.answer.length} match — ${remaining} attempt${remaining !== 1 ? 's' : ''} left`));
            trimLog();
            saveState();
            if (remaining <= 0) {
                setTimeout(() => endGame('lost'), 300);
            } else {
                render();
            }
        }
    };

    window.useBracket = function (entryIdx) {
        if (state.phase !== 'active') return;
        const e = state.entries[entryIdx];
        if (!e || !e.bracket || e.bracket.used) return;

        e.bracket.used = true;
        e.bracket.replacementJunk = rjunk(e.bracket.content.length + 2);

        const effect = e.bracket.effect;
        if (effect === 'dud') {
            const candidates = state.entries.filter(en =>
                en.word !== state.answer &&
                !state.guesses.some(g => g.word === en.word) &&
                !en.eliminated
            );
            if (candidates.length > 0) {
                const target = candidates[Math.floor(Math.random() * candidates.length)];
                target.eliminated = true;
                state.log.push(logEntry('warn', `DUD REMOVED — "${target.word}" eliminated from candidates`));
            } else {
                state.log.push(logEntry('warn', 'DUD REMOVAL — no candidates to remove'));
            }
        } else if (effect === 'attempt') {
            state.attemptsMax = Math.min(state.attemptsMax + 1, 8);
            state.log.push(logEntry('success', `ATTEMPT RESTORED — ${state.attemptsMax - state.guesses.length} attempts now available`));
        } else if (effect === 'hint') {
            const hintedPos = new Set((state.hints || []).map(h => h.pos));
            const available = [];
            for (let i = 0; i < state.answer.length; i++) {
                if (!hintedPos.has(i)) available.push(i);
            }
            if (available.length > 0) {
                const pos  = available[Math.floor(Math.random() * available.length)];
                const char = state.answer[pos];
                if (!state.hints) state.hints = [];
                state.hints.push({ pos, char });
                state.log.push(logEntry('success', `HINT DECRYPTED — Position ${pos + 1} is "${char}"`));
            } else {
                state.log.push(logEntry('success', 'HINT — all positions already revealed'));
            }
        }

        trimLog();
        saveState();
        render();
    };

    function endGame(result) {
        state.phase   = result;
        state.endedAt = Date.now();
        state.log.push(logEntry(
            result === 'won' ? 'success' : 'danger',
            result === 'won' ? cfg.successMsg : cfg.failMsg + ` — Answer was: ${state.answer}`
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
            log: [...prevLog, logEntry('warn', 'TERMINAL RESET — SESSION CLEARED')]
        };
        trimLog();
        saveState();
        render();
    };

    /* ── Overlord controls ─────────────────────────────────────── */
    window.adminForceWin = function () {
        if (state.phase !== 'active') {
            state.answer = state.answer || (state.entries.length ? state.entries[0].word : 'ACCESS');
            state.startedBy = username; state.startedAt = Date.now();
            if (!state.entries.length) state.entries = buildEntries(cfg.wordPool.slice(0,4), 4);
        }
        endGame('won');
    };
    window.adminForceFail = function () {
        if (state.phase !== 'active') {
            state.answer = state.answer || 'UNKNOWN'; state.startedBy = username; state.startedAt = Date.now();
        }
        endGame('lost');
    };
    window.adminReset  = () => window.resetGame();
    window.adminReveal = () => {
        if (!state.answer) { showAdmMsg('No active game — start a game first.', true); return; }
        showAdmMsg(`Current answer: ${state.answer}`, false);
    };
    window.toggleEnabled = () => {
        cfg.enabled = !cfg.enabled; saveCfg();
        const btn = document.getElementById('adm-toggle-btn');
        if (btn) btn.textContent = cfg.enabled ? 'DISABLE' : 'ENABLE';
        render();
    };

    window.saveConfig = function () {
        const gv = id => { const el = document.getElementById(id); return el ? el.value : ''; };
        cfg.targetName   = (gv('adm-target').trim() || cfg.targetName).toUpperCase();
        cfg.wordCount    = Math.max(8, Math.min(20, parseInt(gv('adm-wordcount')) || 12));
        cfg.attempts     = Math.max(2, Math.min(8,  parseInt(gv('adm-attempts'))  || 4));
        cfg.forcedAnswer = gv('adm-answer').trim().toUpperCase();
        cfg.successMsg   = gv('adm-success-msg').trim() || cfg.successMsg;
        cfg.failMsg      = gv('adm-fail-msg').trim()    || cfg.failMsg;

        const rawPool = gv('adm-pool').split('\n').map(w => w.trim().toUpperCase()).filter(w => w.length > 0);
        if (rawPool.length >= 2) cfg.wordPool = rawPool;

        const rawExfil = gv('adm-exfil').split('\n');
        if (rawExfil.length > 0) cfg.extractedData = rawExfil;

        cfg.revealNodeOnWin = gv('adm-reveal-node');

        const rawRoll = gv('adm-skill-roll').trim();
        cfg.skillRoll = rawRoll === '' ? null : (parseInt(rawRoll) || null);
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

    /* ── Typewriter / exfil readout ───────────────────────────── */
    let typeTimer    = null;
    let typeActive   = false;
    let freshWin     = false;

    function typewriterStop() {
        clearTimeout(typeTimer);
        typeActive = false;
    }

    function startExfilReadout() {
        if (typeActive) return;
        const container = document.getElementById('cipher-exfil-output');
        if (!container) return;

        typewriterStop();
        container.innerHTML = '';
        typeActive = true;

        const rawLines = (state.extractedData && state.extractedData.length ? state.extractedData : DEF_EXFIL);

        const lines = rawLines.map(raw => {
            let cls = 'exl';
            const hasBorder = /[═║╔╗╚╝╠╣]/.test(raw);
            if (raw.startsWith('>'))   cls += ' exl-sys';
            else if (raw.startsWith('!')) cls += ' exl-warn';
            else if (hasBorder)        cls += ' exl-border';
            else if (raw.trim() === '') cls += ' exl-blank';
            else                       cls += ' exl-data';
            return { text: raw, cls };
        });

        let lineIdx = 0;
        let charIdx = 0;
        let curEl   = null;

        function next() {
            if (!typeActive) return;
            if (lineIdx >= lines.length) {
                const cur = document.createElement('span');
                cur.className = 'exl-cursor'; cur.textContent = ' █';
                if (curEl) curEl.appendChild(cur);
                else container.appendChild(cur);
                typeActive = false;
                return;
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
                typeTimer = setTimeout(next, 80);
                return;
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
                            : line.cls.includes('exl-warn')   ? 40
                            : 22;
                typeTimer = setTimeout(next, speed);
            }
        }

        typeTimer = setTimeout(next, 550);
    }

    /* ── Rendering ─────────────────────────────────────────────── */
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
            const lbl = { idle:'STANDBY', active:'TERMINAL ACTIVE', won:'ACCESS GRANTED', lost:'TERMINAL LOCKED' };
            phaseEl.textContent = lbl[state.phase] || 'STANDBY';
            phaseEl.className   = 'cipher-phase-badge ' + state.phase;
        }
    }

    function renderGame() {
        const area = document.getElementById('cipher-game-area');
        if (!area) return;
        if (!cfg.enabled) {
            area.innerHTML = '<div class="cipher-locked">▦ CIPHER TERMINAL OFFLINE — CONTACT OVERLORD</div>';
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
        area.innerHTML = `
            <div class="cipher-splash">
                <div class="cipher-splash-icon">▣</div>
                <div class="cipher-splash-title">CIPHER TERMINAL</div>
                <div class="cipher-splash-meta">TARGET: ${esc(cfg.targetName)}</div>
                <div class="cipher-splash-desc">
                    Password bypass required for mainframe access.<br>
                    ${cfg.wordCount} candidate passwords detected — ${cfg.attempts} attempt${cfg.attempts !== 1?'s':''} available.<br>
                    Bracket pairs <span style="color:#55bb66">[ ]</span> <span style="color:#b8a800">&lt; &gt;</span> <span style="color:#00bba0">{ }</span> hidden in the junk — click them for bonuses.
                </div>
                <div class="cipher-actions" style="margin-top:0.4rem;">
                    <button class="cipher-btn cipher-btn-primary" onclick="startGame()">⬡ ACTIVATE TERMINAL</button>
                </div>
            </div>`;
    }

    function renderLost(area) {
        area.innerHTML = `
            <div class="cipher-splash s-lost">
                <div class="cipher-splash-icon">⊠</div>
                <div class="cipher-splash-title">${esc(cfg.failMsg)}</div>
                <div class="cipher-splash-desc">
                    ${state.guesses.length} guess${state.guesses.length!==1?'es':''} made
                    &nbsp;·&nbsp; Answer was: <span style="color:var(--warn)">${esc(state.answer||'???')}</span>
                    &nbsp;·&nbsp; Operator: ${esc(state.startedBy||'???')}
                </div>
                <div class="cipher-actions" style="margin-top:0.5rem;">
                    <button class="cipher-btn cipher-btn-primary" onclick="resetGame()">↺ RESET TERMINAL</button>
                </div>
            </div>`;
    }

    function renderWin(area) {
        const guesses = state.guesses.length;
        const maxA    = state.attemptsMax;

        area.innerHTML = `
            <div class="cipher-win-screen">
                <div class="cipher-win-header">
                    <div class="win-badge">LUXOR // SECURITY BYPASS COMPLETE</div>
                    <div class="win-icon">◈</div>
                    <div class="win-title">ACCESS GRANTED</div>
                    <div class="win-sub">${esc(cfg.successMsg)}</div>
                    <div class="win-detail">
                        ${guesses} GUESS${guesses!==1?'ES':''} USED &nbsp;·&nbsp; ${maxA - guesses} ATTEMPT${(maxA-guesses)!==1?'S':''} REMAINING &nbsp;·&nbsp; OPERATOR: ${esc(state.startedBy||'???')}
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
                    <button class="cipher-btn cipher-btn-primary" onclick="resetGame()">↺ RESET TERMINAL</button>
                </div>
            </div>`;

        if (freshWin) {
            setTimeout(startExfilReadout, 80);
        } else {
            setTimeout(renderExfilImmediate, 80);
        }
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
        const cur = document.createElement('span');
        cur.className = 'exfil-cursor';
        cur.style.cssText = 'animation:none;opacity:1;';
        cur.textContent = '█';
        container.appendChild(cur);
    }

    function renderActive(area) {
        const entries = state.entries || [];
        const guesses = state.guesses || [];
        const hints   = state.hints   || [];
        const used    = guesses.length;
        const maxA    = state.attemptsMax;
        const left    = maxA - used;

        const half = Math.ceil(entries.length / 2);
        const col1 = entries.slice(0, half);
        const col2 = entries.slice(half);

        function bracketHtml(e, idx) {
            if (!e.bracket) return '';
            const b = e.bracket;
            const inner = b.used
                ? `<span class="c-bracket b-used">${esc(b.replacementJunk || rjunk(b.content.length + 2))}</span>`
                : `<span class="c-bracket b-${b.effect}" onclick="useBracket(${idx})" title="${b.effect.toUpperCase()}: click to activate">${esc(b.open)}${esc(b.content)}${esc(b.close)}</span>`;
            return inner;
        }

        function lineHtml(e, idx) {
            const guessedWrong = guesses.some(g => g.word === e.word && e.word !== state.answer);
            const isAnswer     = state.phase === 'won' && e.word === state.answer;
            let wordCls = 'c-word';
            let click   = '';
            if (e.eliminated)  { wordCls += ' w-eliminated'; }
            else if (guessedWrong) { wordCls += ' w-guessed'; }
            else if (isAnswer) { wordCls += ' w-correct'; }
            else if (state.phase === 'active' && !e.eliminated) {
                click = `onclick="tryWord('${e.word}')" title="Try: ${e.word}"`;
            } else { wordCls += ' w-locked'; }

            const bh = bracketHtml(e, idx);
            return `<div class="cipher-line">
                <span class="c-addr">${esc(e.addr)}</span>
                <span class="c-junk">${esc(e.pre)}</span>
                ${!e.bracket?.inPost ? bh : ''}
                <span class="${wordCls}" ${click}>${esc(e.word)}</span>
                ${e.bracket?.inPost  ? bh : ''}
                <span class="c-junk">${esc(e.post)}</span>
            </div>`;
        }

        const pips = Array.from({length: maxA}, (_, i) =>
            `<div class="cs-pip ${i >= left ? 'used' : ''}"></div>`
        ).join('');

        const histHtml = guesses.length === 0
            ? '<div class="cs-guess" style="opacity:0.35">— no guesses —</div>'
            : guesses.map(g => {
                const perfect = g.word === state.answer;
                return `<div class="cs-guess ${perfect?'perfect':''}">
                    <span class="gw">&gt; ${esc(g.word)}</span>
                    <span class="gr"> ${g.likeness}/${g.word.length}</span>
                </div>`;
            }).join('');

        const hintsHtml = hints.length === 0
            ? '<div class="cs-hint" style="opacity:0.35">— none unlocked —</div>'
            : hints.map(h => `<div class="cs-hint">POS ${h.pos+1}: "${esc(h.char)}"</div>`).join('');

        const legendHtml = `
            <div class="cs-legend">
                <div class="cs-leg-row"><span class="leg-b-dud">[…]</span>&nbsp;Remove dud</div>
                <div class="cs-leg-row"><span class="leg-b-attempt">&lt;…&gt;</span>&nbsp;Restore attempt</div>
                <div class="cs-leg-row"><span class="leg-b-hint">{…}</span>&nbsp;Reveal hint</div>
            </div>`;

        area.innerHTML = `
            <div class="cipher-terminal">
                <div class="cipher-term-header">
                    <div class="cth-title">LUXOR // MAINFRAME ACCESS TERMINAL v3.1.4</div>
                    <div class="cth-target">PASSWORD REQUIRED FOR: ${esc(cfg.targetName)}</div>
                    <div class="cth-warn">! UNAUTHORIZED ACCESS DETECTED — COUNTERMEASURES ACTIVE !</div>
                </div>
                <div class="cipher-body">
                    <div class="cipher-grid">
                        ${col1.map((e,i) => lineHtml(e, i)).join('')}
                        ${col2.map((e,i) => lineHtml(e, half+i)).join('')}
                    </div>
                    <div class="cipher-sidebar">
                        <div class="cs-label">ATTEMPTS REMAINING</div>
                        <div>
                            <div class="cs-pips">${pips}</div>
                            <div class="cs-pip-label">${left} / ${maxA} REMAINING</div>
                        </div>
                        <div class="cs-label">GUESS HISTORY</div>
                        <div class="cs-history">
                            ${histHtml}
                            <div class="cs-cursor">█</div>
                        </div>
                        <div class="cs-label">HINTS</div>
                        <div class="cs-hint-list">${hintsHtml}</div>
                        <div class="cs-label">BRACKET LEGEND</div>
                        ${legendHtml}
                    </div>
                </div>
            </div>
            <div class="cipher-actions">
                <button class="cipher-btn cipher-btn-danger" onclick="endGame('lost')">⊠ ABORT SESSION</button>
            </div>`;
    }

    function renderLog() {
        const el      = document.getElementById('hack-log-entries');
        const countEl = document.getElementById('log-count');
        if (!el) return;
        const log = state.log || [];
        if (countEl) countEl.textContent = `${log.length} ENTR${log.length===1?'Y':'IES'}`;
        if (log.length === 0) {
            el.innerHTML = '<div class="hle"><span class="hle-m" style="opacity:0.3">— AWAITING TERMINAL ACTIVATION —</span></div>';
            return;
        }
        el.innerHTML = log.slice(-25).map(e => {
            const d  = new Date(e.t);
            const ts = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            return `<div class="hle ${e.type||''}">
                <span class="hle-t">${ts}</span>
                <span class="hle-u">${esc(e.user||'SYSTEM')}</span>
                <span class="hle-m">${esc(e.msg||'')}</span>
            </div>`;
        }).join('');
        el.scrollTop = el.scrollHeight;
    }

    /* ── Admin panel ───────────────────────────────────────────── */
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
        sv('adm-wordcount',   cfg.wordCount);
        sv('adm-attempts',    cfg.attempts);
        sv('adm-answer',      cfg.forcedAnswer);
        sv('adm-pool',        cfg.wordPool.join('\n'));
        sv('adm-success-msg', cfg.successMsg);
        sv('adm-fail-msg',    cfg.failMsg);
        sv('adm-exfil',       (cfg.extractedData || DEF_EXFIL).join('\n'));
        sv('adm-skill-roll',  cfg.skillRoll !== null ? cfg.skillRoll : '');
        const lbl = document.getElementById('adm-skill-roll-lbl');
        if (lbl) lbl.textContent = swadeLabel(swadeMod(cfg.skillRoll));
        renderAdminStatus();
        const btn = document.getElementById('adm-toggle-btn');
        if (btn) btn.textContent = cfg.enabled ? 'DISABLE' : 'ENABLE';
        const revealSel = document.getElementById('adm-reveal-node');
        if (revealSel) {
            revealSel.innerHTML = '<option value="">— NONE —</option>';
            getAssetNodes().forEach(n => {
                const opt = document.createElement('option');
                opt.value = n.id;
                opt.textContent = n.name + ' [' + n.id + ']';
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
        if (state.answer)    txt += ` &nbsp;|&nbsp; Answer: <span style="color:var(--warn)">${esc(state.answer)}</span>`;
        const body   = document.getElementById('adm-status');
        const inline = document.getElementById('adm-status-inline');
        if (body)   body.innerHTML   = txt;
        if (inline) inline.innerHTML = txt;
    }

    /* ── Cross-tab sync ────────────────────────────────────────── */
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

    /* ── Init ──────────────────────────────────────────────────── */
    loadCfg();
    loadState();
    const prevPhase = state.phase;
    render();
    initAdmin();
    if (prevPhase === 'won') setTimeout(startExfilReadout, 500);

})();
