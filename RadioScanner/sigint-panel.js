/* ================================================================
   SIGINT Radio Scrambler Panel — sigint-panel.js
   Self-contained IIFE. Drop in after sigint-panel.html.
   ================================================================ */

(function () {
    'use strict';

    // ── Constants ─────────────────────────────────────────────
    const FREQ_MIN        = 400;
    const FREQ_MAX        = 500;
    const LOCK_TOLERANCE  = 0.8;   // MHz — window for signal lock
    const DECRYPT_TIME    = 45;    // seconds to complete decrypt
    const JAM_DURATION    = 8;     // seconds jam is active
    const JAM_COOLDOWN    = 28;    // seconds before jam is ready again
    const SPOOF_DURATION  = 30;    // seconds spoof confusion lasts
    const SPOOF_COOLDOWN  = 50;    // seconds before spoof is ready again
    const MAX_LOG_ENTRIES = 45;

    // ── Persistent GM config ──────────────────────────────────
    const RADIO_STORE = 'luxorRadioConfig';

    const DEFAULT_MESSAGES = [
        'STRIKE PKG ALPHA CONFIRMED — GRID 447-229 — T-MINUS 18MIN',
        'UNIT KILO MOVING TO SECTOR 7 — HOLD POSITION ECHO',
        'AIR SUPPORT DENIED — RETREAT TO RALLY PT DELTA — CODE BLACK',
        'IED DETECTED ROUTE BRAVO — DIVERT VIA NORTH CORRIDOR',
        'COMMAND OVERRIDE: PROTOCOL 9 — AUTH: OMEGA — EXECUTE NOW',
        'REINFORCEMENTS ETA 12MIN — HOLD PERIMETER AT ALL COSTS',
        'EXFIL WINDOW CLOSES 0340Z — ABORT SECONDARY OBJECTIVE',
        'SECTOR CLEAR — ADVANCE ON COMPOUND FROM NORTH — SILENT',
    ];

    const HEX_POOL = [
        'A3F2','B91C','7E4A','D0C8','F5B3','2CA1','E739','4D86',
        '9A05','C1F7','3B2E','8D4C','61AF','0E93','7F1B','D522',
        'AA3F','F0C9','1E7D','8B24','C6A0','39FE','70D1','5C88',
    ];

    // ── Signal definitions (loaded from GM config, else defaults) ─
    const DEFAULT_SIGNALS = [
        { id:'s1', callsign:'ECHO-7',  freq:449.2, type:'hostile',  enc:'AES-256',   hopMin:20, hopMax:40 },
        { id:'s2', callsign:'KILO-9',  freq:462.8, type:'hostile',  enc:'AES-256',   hopMin:22, hopMax:38 },
        { id:'s3', callsign:'DELTA-3', freq:478.1, type:'hostile',  enc:'SCRAMBLED', hopMin:18, hopMax:35 },
        { id:'s4', callsign:'ALPHA-1', freq:431.5, type:'friendly', enc:'CLEAR',     hopMin:0,  hopMax:0  },
        { id:'s5', callsign:'BRAVO-4', freq:417.3, type:'friendly', enc:'CLEAR',     hopMin:0,  hopMax:0  },
    ];

    function loadRadioConfig() {
        try { return JSON.parse(localStorage.getItem(RADIO_STORE) || 'null'); }
        catch (e) { return null; }
    }

    function saveRadioConfig() {
        localStorage.setItem(RADIO_STORE, JSON.stringify({
            signals: signals.map(s => ({
                id: s.id, callsign: s.callsign, freq: s.freq,
                type: s.type, enc: s.enc, hopMin: s.hopMin, hopMax: s.hopMax
            })),
            decodedMessages: DECODED_MESSAGES
        }));
    }

    const _savedConfig = loadRadioConfig();
    let signals = (_savedConfig ? _savedConfig.signals : DEFAULT_SIGNALS).map(s => ({
        ...s, hopTimeout: null, nextHopFreq: null
    }));
    let DECODED_MESSAGES = _savedConfig ? [..._savedConfig.decodedMessages] : [...DEFAULT_MESSAGES];

    // ── Mutable state ─────────────────────────────────────────
    const state = {
        tunerFreq:     449.0,
        mode:          'INTERCEPT',   // INTERCEPT | JAM | SPOOF | EMCON
        locked:        false,
        lockedSignal:  null,
        minimized:     false,
        waveNoise:     0,             // ms of noise remaining on waveform

        decrypt: {
            active:       false,
            signal:       null,
            blocks:       [],          // [{id, hex}] — shuffled display order
            correctOrder: [],          // block .id values in correct click order
            playerSeq:    [],          // block .id values clicked so far
            progress:     0,           // 0–100
            timer:        DECRYPT_TIME,
            timerIv:      null,
            decoded:      false,
            decodedMsg:   '',
        },

        jam:   { active:false, timer:0, cooldown:0, effectIv:null, cdIv:null },
        spoof: { active:false, timer:0, cooldown:0, effectIv:null, cdIv:null },
    };

    // ── Canvas / animation state ──────────────────────────────
    let wavePhase     = 0;
    let wfFrameCount  = 0;
    let rafId         = null;

    // ── DOM element cache ─────────────────────────────────────
    let el = {};   // populated in init()

    // ══════════════════════════════════════════════════════════
    // INIT
    // ══════════════════════════════════════════════════════════
    function init() {
        el = {
            panel:          document.getElementById('sigint-panel'),
            header:         document.getElementById('sigint-header'),
            body:           document.getElementById('sp-body'),
            minBtn:         document.getElementById('sp-min-btn'),
            statusBadge:    document.getElementById('sp-status-badge'),
            emconBanner:    document.getElementById('sp-emcon-banner'),

            waterfallCv:    document.getElementById('sp-waterfall'),
            overlayCv:      document.getElementById('sp-wf-overlay'),
            waveformCv:     document.getElementById('sp-waveform'),

            freqSlider:     document.getElementById('sp-freq-slider'),
            freqReadout:    document.getElementById('sp-freq-readout'),
            lockBadge:      document.getElementById('sp-lock-badge'),

            decryptSec:     document.getElementById('sp-decrypt-section'),
            decryptCall:    document.getElementById('sp-decrypt-callsign'),
            decryptTimer:   document.getElementById('sp-decrypt-timer'),
            cipherBlocks:   document.getElementById('sp-cipher-blocks'),
            decryptBar:     document.getElementById('sp-decrypt-bar'),
            decodedMsg:     document.getElementById('sp-decoded-msg'),

            commsLog:       document.getElementById('sp-comms-log'),
            signalList:     document.getElementById('sp-signal-list'),

            cmIntercept:    document.getElementById('cm-intercept'),
            cmJam:          document.getElementById('cm-jam'),
            cmSpoof:        document.getElementById('cm-spoof'),
            cmEmcon:        document.getElementById('cm-emcon'),
            jamCdText:      document.getElementById('cm-jam-cd'),
            spoofCdText:    document.getElementById('cm-spoof-cd'),
            jamCdBar:       document.getElementById('cm-jam-bar'),
            spoofCdBar:     document.getElementById('cm-spoof-bar'),
        };

        el.wfCtx  = el.waterfallCv.getContext('2d');
        el.ovCtx  = el.overlayCv.getContext('2d');
        el.wvCtx  = el.waveformCv.getContext('2d');

        // Seed waterfall with dark background
        el.wfCtx.fillStyle = '#040410';
        el.wfCtx.fillRect(0, 0, el.waterfallCv.width, el.waterfallCv.height);

        setupDrag();
        setupMinimize();
        setupSlider();
        setupCountermeasures();
        renderSignalList();

        // Start enemy frequency hops
        signals.forEach(s => { if (s.type === 'hostile') scheduleHop(s); });

        // Boot log
        addLog('SIGINT SYSTEM ONLINE — SCANNING 400–500 MHz', 'sys');
        const _hostile  = signals.filter(s => s.type === 'hostile').map(s => s.callsign).join(' · ');
        const _friendly = signals.filter(s => s.type === 'friendly').map(s => s.callsign).join(' · ');
        if (_hostile)  setTimeout(() => addLog('HOSTILE SIGNALS DETECTED: ' + _hostile,  'hostile'),  700);
        if (_friendly) setTimeout(() => addLog('FRIENDLY NET NOMINAL: ' + _friendly, 'friendly'), 1400);
        setTimeout(() => addLog('USE TUNER TO LOCK — CLICK SIGNALS TO AUTO-TUNE', 'dim'), 2100);

        if (window.LuxorAuth && LuxorAuth.isAdmin()) injectGMPanel();

        rafId = requestAnimationFrame(animLoop);
    }

    // ══════════════════════════════════════════════════════════
    // DRAG
    // ══════════════════════════════════════════════════════════
    function setupDrag() {
        let dragging = false, ox = 0, oy = 0;

        function startDrag(cx, cy) {
            dragging = true;
            ox = cx - el.panel.offsetLeft;
            oy = cy - el.panel.offsetTop;
            el.panel.style.transition = 'none';
        }
        function moveDrag(cx, cy) {
            if (!dragging) return;
            const maxX = window.innerWidth  - el.panel.offsetWidth;
            const maxY = window.innerHeight - 60;
            el.panel.style.left = Math.max(0, Math.min(maxX, cx - ox)) + 'px';
            el.panel.style.top  = Math.max(0, Math.min(maxY, cy - oy)) + 'px';
        }

        el.header.addEventListener('mousedown', e => {
            if (e.target === el.minBtn) return;
            startDrag(e.clientX, e.clientY);
            e.preventDefault();
        });
        document.addEventListener('mousemove',  e => moveDrag(e.clientX, e.clientY));
        document.addEventListener('mouseup',    () => { dragging = false; });

        el.header.addEventListener('touchstart', e => {
            if (e.target === el.minBtn) return;
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
            e.preventDefault();
        }, { passive: false });
        document.addEventListener('touchmove', e => {
            moveDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        document.addEventListener('touchend', () => { dragging = false; });
    }

    // ══════════════════════════════════════════════════════════
    // MINIMIZE
    // ══════════════════════════════════════════════════════════
    function setupMinimize() {
        el.minBtn.addEventListener('click', () => {
            state.minimized = !state.minimized;
            el.body.classList.toggle('collapsed', state.minimized);
            el.minBtn.textContent = state.minimized ? '□' : '—';
        });
    }

    // ══════════════════════════════════════════════════════════
    // FREQUENCY SLIDER
    // ══════════════════════════════════════════════════════════
    function setupSlider() {
        el.freqSlider.addEventListener('input', () => {
            state.tunerFreq = parseFloat(el.freqSlider.value);
            el.freqReadout.textContent = state.tunerFreq.toFixed(1);
            checkLock();
        });
    }

    // ══════════════════════════════════════════════════════════
    // LOCK / UNLOCK
    // ══════════════════════════════════════════════════════════
    function checkLock() {
        if (state.mode === 'EMCON') return;

        let candidate = null;
        for (const s of signals) {
            if (s.type === 'hostile' && Math.abs(state.tunerFreq - s.freq) <= LOCK_TOLERANCE) {
                candidate = s;
                break;
            }
        }

        if (candidate && candidate !== state.lockedSignal) {
            acquireLock(candidate);
        } else if (!candidate && state.locked) {
            loseLock(false);
        }
    }

    function acquireLock(sig) {
        state.locked       = true;
        state.lockedSignal = sig;

        el.freqReadout.classList.add('locked');
        el.freqSlider.classList.add('locked');
        el.lockBadge.classList.remove('hidden');

        setStatusBadge('INTERCEPTING', 'intercepting');
        addLog(`LOCK-ON: ${sig.callsign} @ ${sig.freq.toFixed(1)} MHz [${sig.enc}]`, 'hostile');

        // Kick off decrypt if not already active for this signal
        if (!state.decrypt.active || state.decrypt.signal !== sig) {
            if (state.decrypt.active) cancelDecrypt(true);
            setTimeout(() => { if (state.locked) initDecrypt(sig); }, 600);
        }

        renderSignalList();
    }

    function loseLock(silent) {
        if (!state.locked) return;
        state.locked       = false;
        state.lockedSignal = null;

        el.freqReadout.classList.remove('locked');
        el.freqSlider.classList.remove('locked');
        el.lockBadge.classList.add('hidden');

        if (state.mode !== 'EMCON') setStatusBadge('ONLINE', '');

        if (state.decrypt.active && !state.decrypt.decoded) {
            if (!silent) addLog('LOCK LOST — DECRYPT ABORTED', 'sys');
            cancelDecrypt(true);
        }

        renderSignalList();
    }

    function setStatusBadge(text, cls) {
        el.statusBadge.textContent = text;
        el.statusBadge.className   = cls;
    }

    // ══════════════════════════════════════════════════════════
    // COUNTERMEASURES
    // ══════════════════════════════════════════════════════════
    function setupCountermeasures() {
        el.cmIntercept.addEventListener('click', () => activateIntercept());
        el.cmJam.addEventListener('click',       () => activateJam());
        el.cmSpoof.addEventListener('click',     () => activateSpoof());
        el.cmEmcon.addEventListener('click',     () => toggleEmcon());
    }

    function clearCmActive() {
        [el.cmIntercept, el.cmJam, el.cmSpoof, el.cmEmcon].forEach(b => {
            b.classList.remove('active', 'danger', 'warn');
        });
    }

    function activateIntercept() {
        if (state.mode === 'INTERCEPT') return;
        el.emconBanner.classList.remove('active');
        state.mode = 'INTERCEPT';
        clearCmActive();
        el.cmIntercept.classList.add('active');
        setStatusBadge('ONLINE', '');
        addLog('MODE: INTERCEPT — Passive scan active', 'sys');
        renderSignalList();
    }

    function activateJam() {
        if (state.mode === 'EMCON') {
            addLog('EMCON ACTIVE — Jam unavailable', 'sys'); return;
        }
        if (state.jam.cooldown > 0) {
            addLog(`BURST JAM: Cooldown ${state.jam.cooldown}s remaining`, 'sys'); return;
        }
        if (state.jam.active) return;

        state.mode       = 'JAM';
        state.jam.active = true;
        state.jam.timer  = JAM_DURATION;

        clearCmActive();
        el.cmJam.classList.add('danger');
        setStatusBadge('JAMMING', 'intercepting');
        addLog(`BURST JAM FIRED — ${JAM_DURATION}s interference pulse`, 'sys');

        // Reveal next-hop for currently locked signal
        if (state.lockedSignal) {
            const nf = randFreq();
            state.lockedSignal.nextHopFreq = nf;
            addLog(`JAM INTEL: ${state.lockedSignal.callsign} NEXT HOP → ${nf.toFixed(1)} MHz`, 'sys');
        }

        // Effect timer
        state.jam.effectIv = setInterval(() => {
            state.jam.timer--;
            if (state.jam.timer <= 0) {
                clearInterval(state.jam.effectIv);
                state.jam.active = false;
                el.cmJam.classList.remove('danger');
                addLog('BURST JAM: Effect expired', 'sys');
                startCooldown('jam');
                if (state.mode === 'JAM') {
                    state.mode = 'INTERCEPT';
                    clearCmActive();
                    el.cmIntercept.classList.add('active');
                    setStatusBadge('ONLINE', '');
                }
                renderSignalList();
            }
        }, 1000);

        renderSignalList();
    }

    function activateSpoof() {
        if (state.mode === 'EMCON') {
            addLog('EMCON ACTIVE — Spoof unavailable', 'sys'); return;
        }
        if (state.spoof.cooldown > 0) {
            addLog(`SPOOF SIG: Cooldown ${state.spoof.cooldown}s remaining`, 'sys'); return;
        }
        if (state.spoof.active) return;

        state.mode         = 'SPOOF';
        state.spoof.active = true;
        state.spoof.timer  = SPOOF_DURATION;

        clearCmActive();
        el.cmSpoof.classList.add('warn');
        setStatusBadge('SPOOFING', 'intercepting');

        const target = state.lockedSignal ? state.lockedSignal.callsign : 'ALL HOSTILE';
        addLog(`SPOOF SIG INJECTED → ${target} — ${SPOOF_DURATION}s confusion window`, 'hostile');
        addLog('FAKE ORDERS: RETREAT TO GRID 229-447 TRANSMITTED', 'hostile');

        state.spoof.effectIv = setInterval(() => {
            state.spoof.timer--;
            if (state.spoof.timer <= 0) {
                clearInterval(state.spoof.effectIv);
                state.spoof.active = false;
                el.cmSpoof.classList.remove('warn');
                addLog('SPOOF SIG: Confusion window expired', 'sys');
                startCooldown('spoof');
                if (state.mode === 'SPOOF') {
                    state.mode = 'INTERCEPT';
                    clearCmActive();
                    el.cmIntercept.classList.add('active');
                    setStatusBadge('ONLINE', '');
                }
                renderSignalList();
            }
        }, 1000);

        renderSignalList();
    }

    function toggleEmcon() {
        if (state.mode === 'EMCON') {
            // Exit EMCON
            state.mode = 'INTERCEPT';
            el.emconBanner.classList.remove('active');
            clearCmActive();
            el.cmIntercept.classList.add('active');
            setStatusBadge('ONLINE', '');
            addLog('EMCON DEACTIVATED — Emissions resumed', 'sys');
            renderSignalList();
            return;
        }

        // Enter EMCON — kill any active effects
        if (state.jam.active)   { clearInterval(state.jam.effectIv);   state.jam.active   = false; }
        if (state.spoof.active) { clearInterval(state.spoof.effectIv); state.spoof.active = false; }

        loseLock(true);
        state.mode = 'EMCON';

        clearCmActive();
        el.cmEmcon.classList.add('active');
        el.emconBanner.classList.add('active');
        setStatusBadge('EMCON', 'emcon');
        addLog('EMCON ACTIVE — All emissions suppressed. You are invisible.', 'sys');
        addLog('JAM and SPOOF disabled while EMCON is active', 'dim');
        renderSignalList();
    }

    function startCooldown(type) {
        const duration = type === 'jam' ? JAM_COOLDOWN : SPOOF_COOLDOWN;
        const s        = state[type];
        const cdText   = type === 'jam' ? el.jamCdText  : el.spoofCdText;
        const cdBar    = type === 'jam' ? el.jamCdBar   : el.spoofCdBar;
        const btn      = type === 'jam' ? el.cmJam      : el.cmSpoof;

        s.cooldown   = duration;
        btn.disabled = true;

        // Animate the drain bar
        cdBar.style.transition = 'none';
        cdBar.style.width      = '100%';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                cdBar.style.transition = `width ${duration}s linear`;
                cdBar.style.width      = '0%';
            });
        });

        s.cdIv = setInterval(() => {
            s.cooldown--;
            cdText.textContent = s.cooldown > 0 ? s.cooldown + 's' : '';
            if (s.cooldown <= 0) {
                clearInterval(s.cdIv);
                btn.disabled       = false;
                cdText.textContent = '';
                addLog(`${type.toUpperCase()} READY`, 'sys');
            }
        }, 1000);
    }

    // ══════════════════════════════════════════════════════════
    // SIGNAL HOPPING
    // ══════════════════════════════════════════════════════════
    function scheduleHop(sig) {
        const delayMs = (Math.random() * (sig.hopMax - sig.hopMin) + sig.hopMin) * 1000;
        sig.hopTimeout = setTimeout(() => executeHop(sig), delayMs);
    }

    function executeHop(sig) {
        // Cancel any pending hop timeout so external calls don't create duplicates
        if (sig.hopTimeout) { clearTimeout(sig.hopTimeout); sig.hopTimeout = null; }
        const oldFreq = sig.freq;

        if (sig.nextHopFreq !== null) {
            sig.freq = sig.nextHopFreq;
            sig.nextHopFreq = null;
        } else {
            sig.freq = randFreq();
        }

        addLog(`HOP: ${sig.callsign}  ${oldFreq.toFixed(1)} → ${sig.freq.toFixed(1)} MHz`, 'hostile');

        if (state.locked && state.lockedSignal === sig) {
            addLog(`LOCK LOST — ${sig.callsign} frequency hopped`, 'hostile');
            loseLock(true);
        }

        renderSignalList();
        scheduleHop(sig);
    }

    function randFreq() {
        return parseFloat((FREQ_MIN + Math.random() * (FREQ_MAX - FREQ_MIN)).toFixed(1));
    }

    // ══════════════════════════════════════════════════════════
    // DECRYPTION MINIGAME
    // ══════════════════════════════════════════════════════════
    function initDecrypt(sig) {
        // Pick 4 unique hex fragments
        const shuffledPool = [...HEX_POOL].sort(() => Math.random() - 0.5).slice(0, 4);

        // Correct order = ascending by original pool position (0→1→2→3)
        // Each block gets a stable id (0–3) representing its position in the correct sequence
        const correctOrder = [0, 1, 2, 3];

        // Build blocks and shuffle their display positions
        const blocks = shuffledPool.map((hex, i) => ({ id: i, hex }));
        blocks.sort(() => Math.random() - 0.5);

        state.decrypt = {
            active:       true,
            signal:       sig,
            blocks,
            correctOrder,
            playerSeq:    [],
            progress:     0,
            timer:        DECRYPT_TIME,
            timerIv:      null,
            decoded:      false,
            decodedMsg:   DECODED_MESSAGES[Math.floor(Math.random() * DECODED_MESSAGES.length)],
        };

        el.decryptCall.textContent    = sig.callsign;
        el.decryptBar.style.width     = '0%';
        el.decodedMsg.textContent     = '';
        el.decodedMsg.classList.remove('visible');
        el.decryptSec.classList.add('active');
        renderCipherBlocks();
        updateDecryptTimerDisplay();

        addLog(`DECRYPT INITIATED — ${sig.callsign} [${sig.enc}]`, 'sys');
        addLog('Click cipher blocks in correct sequence to assemble key', 'dim');

        state.decrypt.timerIv = setInterval(() => {
            if (!state.decrypt.active) { clearInterval(state.decrypt.timerIv); return; }
            state.decrypt.timer--;
            updateDecryptTimerDisplay();
            if (state.decrypt.timer <= 0) decryptTimeout();
        }, 1000);
    }

    function renderCipherBlocks() {
        el.cipherBlocks.innerHTML = '';
        state.decrypt.blocks.forEach((block, dispIdx) => {
            const div = document.createElement('div');
            div.className     = 'sp-cipher-block';
            div.dataset.seq   = dispIdx + 1;
            div.dataset.id    = block.id;
            div.textContent   = block.hex;

            if (state.decrypt.playerSeq.includes(block.id)) {
                div.classList.add('correct');
            }

            div.addEventListener('click', () => onBlockClick(block.id, div));
            el.cipherBlocks.appendChild(div);
        });
    }

    function onBlockClick(blockId, divEl) {
        const d = state.decrypt;
        if (!d.active || d.decoded) return;
        if (d.playerSeq.includes(blockId)) return;

        const expected = d.correctOrder[d.playerSeq.length];

        if (blockId === expected) {
            d.playerSeq.push(blockId);
            divEl.classList.add('correct');
            d.progress = (d.playerSeq.length / 4) * 100;
            el.decryptBar.style.width = d.progress + '%';
            addLog(`BLOCK ${d.playerSeq.length}/4 VERIFIED — ${divEl.textContent}`, 'friendly');

            if (d.playerSeq.length === 4) decryptSuccess();
        } else {
            // Wrong sequence — reset and inject waveform noise
            d.playerSeq    = [];
            d.progress     = 0;
            el.decryptBar.style.width = '0%';
            state.waveNoise = 2200;

            // Re-render first so we shake the live DOM nodes
            renderCipherBlocks();
            el.cipherBlocks.querySelectorAll('.sp-cipher-block').forEach(b => {
                b.classList.add('error');
                setTimeout(() => b.classList.remove('error'), 420);
            });

            addLog('DECRYPT ERROR — Wrong sequence. Static injected into waveform.', 'hostile');
        }
    }

    function decryptSuccess() {
        const d = state.decrypt;
        clearInterval(d.timerIv);
        d.decoded = true;

        // Gold flash on section
        el.decryptSec.classList.add('gold-flash');
        setTimeout(() => el.decryptSec.classList.remove('gold-flash'), 1200);

        // Show decoded message (typewriter)
        el.decodedMsg.classList.add('visible');
        typewriterFill(el.decodedMsg, d.decodedMsg, 22);

        addLog('DECRYPT SUCCESS ▶ ENEMY COMMS REVEALED', 'sys');
        addLog(d.decodedMsg.substring(0, 48) + (d.decodedMsg.length > 48 ? '…' : ''), 'sys');
        renderSignalList();
    }

    function decryptTimeout() {
        const d = state.decrypt;
        addLog(`DECRYPT FAILED — ${d.signal.callsign} hopping frequency`, 'hostile');
        const sig = d.signal;
        cancelDecrypt(false);
        executeHop(sig);
    }

    function cancelDecrypt(silent) {
        const d = state.decrypt;
        if (d.timerIv) clearInterval(d.timerIv);
        d.active  = false;
        d.decoded = false;
        el.decryptSec.classList.remove('active');
        el.decryptBar.style.width = '0%';
        if (!silent) addLog('Decrypt session cleared', 'dim');
    }

    function updateDecryptTimerDisplay() {
        const t    = state.decrypt.timer;
        const mins = Math.floor(t / 60);
        const secs = t % 60;
        el.decryptTimer.textContent = `${mins}:${secs.toString().padStart(2,'0')}`;
        el.decryptTimer.classList.toggle('urgent', t <= 10 && t > 0);
    }

    // ══════════════════════════════════════════════════════════
    // SIGNAL LIST SIDEBAR
    // ══════════════════════════════════════════════════════════
    function renderSignalList() {
        el.signalList.innerHTML = '';
        signals.forEach(sig => {
            const item = document.createElement('div');
            item.className = `sp-sig-item ${sig.type}`;
            if (state.locked && state.lockedSignal === sig) item.classList.add('active-lock');

            // Compute status text
            let statusText  = '';
            let statusClass = '';
            if (state.mode === 'EMCON') {
                statusText  = 'UNDETECTED';
                statusClass = 's-undetected';
            } else if (sig.type === 'friendly') {
                statusText  = 'FRIENDLY';
                statusClass = 's-friendly';
            } else {
                if (state.jam.active) {
                    statusText  = 'JAMMED';
                    statusClass = 's-jammed';
                } else if (state.spoof.active) {
                    statusText  = 'SPOOFED';
                    statusClass = 's-spoofed';
                } else {
                    statusText  = 'ACTIVE';
                    statusClass = 's-active';
                }
            }

            // Next-hop hint (only shown after JAM reveals it)
            const hopHint = sig.nextHopFreq !== null
                ? `<div class="sp-sig-nexthop">→ ${sig.nextHopFreq.toFixed(1)} MHz</div>`
                : '';

            item.innerHTML = `
                <div class="sp-sig-call">
                    <span class="sp-sig-dot ${sig.type}"></span>${sig.callsign}
                </div>
                <div class="sp-sig-freq">${sig.freq.toFixed(1)} MHz</div>
                <div class="sp-sig-enc">${sig.enc}</div>
                <div class="sp-sig-status ${statusClass}">${statusText}</div>
                ${hopHint}
            `;

            // Click to auto-tune
            item.addEventListener('click', () => {
                state.tunerFreq          = sig.freq;
                el.freqSlider.value      = sig.freq;
                el.freqReadout.textContent = sig.freq.toFixed(1);
                checkLock();
                addLog(`TUNED → ${sig.callsign} @ ${sig.freq.toFixed(1)} MHz`, 'sys');
            });

            el.signalList.appendChild(item);
        });
    }

    // ══════════════════════════════════════════════════════════
    // COMMS LOG
    // ══════════════════════════════════════════════════════════
    function addLog(msg, type) {
        const now    = new Date();
        const hh     = now.getHours().toString().padStart(2,'0');
        const mm     = now.getMinutes().toString().padStart(2,'0');
        const ss     = now.getSeconds().toString().padStart(2,'0');
        const full   = `[${hh}:${mm}:${ss}] ${msg}`;

        const entry  = document.createElement('div');
        entry.className = `sp-log-entry log-${type || 'sys'}`;
        entry.textContent = '';
        el.commsLog.appendChild(entry);

        typewriterFill(entry, full, 14, () => {
            el.commsLog.scrollTop = el.commsLog.scrollHeight;
        });

        // Trim excess entries
        while (el.commsLog.children.length > MAX_LOG_ENTRIES) {
            el.commsLog.removeChild(el.commsLog.firstChild);
        }
        el.commsLog.scrollTop = el.commsLog.scrollHeight;
    }

    function typewriterFill(el_, text, msPerChar, onDone) {
        let i = 0;
        const iv = setInterval(() => {
            el_.textContent = text.substring(0, ++i);
            if (i >= text.length) {
                clearInterval(iv);
                if (onDone) onDone();
            }
        }, msPerChar || 16);
    }

    // ══════════════════════════════════════════════════════════
    // ANIMATION LOOP
    // ══════════════════════════════════════════════════════════
    function animLoop(ts) {
        if (state.waveNoise > 0) state.waveNoise -= 16;
        drawWaterfall();
        drawWaterfallOverlay();
        drawWaveform();
        rafId = requestAnimationFrame(animLoop);
    }

    // ══════════════════════════════════════════════════════════
    // WATERFALL
    // ══════════════════════════════════════════════════════════
    function drawWaterfall() {
        wfFrameCount++;
        // Throttle: new row every 2 frames (~30 fps scroll)
        if (wfFrameCount % 2 !== 0) return;

        const cv = el.waterfallCv;
        const ctx = el.wfCtx;
        const W = cv.width, H = cv.height;

        // Shift existing content down by 1 row
        const img = ctx.getImageData(0, 0, W, H - 1);
        ctx.putImageData(img, 0, 1);

        // Generate new top row pixel-by-pixel
        const row = ctx.createImageData(W, 1);
        const d   = row.data;

        for (let x = 0; x < W; x++) {
            const freq = FREQ_MIN + (x / (W - 1)) * (FREQ_MAX - FREQ_MIN);
            const n    = Math.random();

            // Dark thermal noise floor: deep blue-purple
            let r = n * 16 + 4;
            let g = n * 4;
            let b = n * 32 + 18;

            for (const sig of signals) {
                // EMCON hides hostile signals from waterfall
                if (state.mode === 'EMCON' && sig.type === 'hostile') continue;

                if (state.jam.active && sig.type === 'hostile') {
                    // Wideband jam noise — orange-ish smear
                    const jn = Math.random() * 0.55;
                    r += jn * 90; g += jn * 35; b += jn * 10;
                    continue;
                }

                const dist = Math.abs(freq - sig.freq);
                const bw   = 0.85;
                if (dist > bw * 6) continue;

                const strength = Math.exp(-(dist * dist) / (2 * bw * bw))
                               * (0.75 + Math.random() * 0.25);

                if (sig.type === 'hostile') {
                    // Hot red spike
                    r += strength * 240;
                    g += strength * 18;
                    b += strength * 14;
                } else {
                    // Cyan-green spike for friendly
                    r += strength * 10;
                    g += strength * 190;
                    b += strength * 215;
                }
            }

            const i = x * 4;
            d[i]   = Math.min(255, r | 0);
            d[i+1] = Math.min(255, g | 0);
            d[i+2] = Math.min(255, b | 0);
            d[i+3] = 255;
        }

        ctx.putImageData(row, 0, 0);
    }

    // ── Waterfall overlay: tuner line, signal labels, lock bracket ──
    function drawWaterfallOverlay() {
        const cv  = el.overlayCv;
        const ctx = el.ovCtx;
        const W   = cv.width, H = cv.height;

        ctx.clearRect(0, 0, W, H);

        const freqX = f => Math.round((f - FREQ_MIN) / (FREQ_MAX - FREQ_MIN) * (W - 1));

        // Signal top-spike markers and callsign labels
        signals.forEach(sig => {
            if (state.mode === 'EMCON' && sig.type === 'hostile') return;
            const x   = freqX(sig.freq);
            const col = sig.type === 'hostile' ? '#ff3333' : '#00ffe7';

            ctx.strokeStyle = col + 'bb';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 9);
            ctx.stroke();

            ctx.fillStyle = col + 'bb';
            ctx.font      = '7px Consolas, monospace';
            const labelX  = Math.min(W - 38, Math.max(2, x + 2));
            ctx.fillText(sig.callsign, labelX, 18);
        });

        // Lock bracket around locked signal
        if (state.locked && state.lockedSignal) {
            const cx     = freqX(state.lockedSignal.freq);
            const halfW  = Math.max(4, freqX(state.lockedSignal.freq + LOCK_TOLERANCE) - cx);

            ctx.strokeStyle = '#00ffe755';
            ctx.lineWidth   = 1;
            ctx.setLineDash([3, 2]);
            ctx.strokeRect(cx - halfW, 1, halfW * 2, H - 2);
            ctx.setLineDash([]);
        }

        // Tuner cursor line
        const tx = freqX(state.tunerFreq);
        ctx.strokeStyle = state.locked ? '#00ffe7cc' : '#a09d0999';
        ctx.lineWidth   = 1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.lineTo(tx, H);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // ══════════════════════════════════════════════════════════
    // WAVEFORM
    // ══════════════════════════════════════════════════════════
    function drawWaveform() {
        const cv  = el.waveformCv;
        const ctx = el.wvCtx;
        const W   = cv.width, H = cv.height;

        ctx.fillStyle = '#040410';
        ctx.fillRect(0, 0, W, H);

        // Subtle grid
        ctx.strokeStyle = '#7a059e13';
        ctx.lineWidth   = 1;
        [H * 0.25, H * 0.5, H * 0.75].forEach(y => {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        });

        if (state.mode === 'EMCON') {
            // Flatline with micro-noise
            ctx.strokeStyle = '#00ffe722';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            for (let x = 0; x < W; x++) {
                const y = H / 2 + (Math.random() * 1.5 - 0.75);
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
            return;
        }

        if (!state.locked) {
            // Static noise — no lock
            ctx.strokeStyle = '#7a059e55';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            for (let x = 0; x < W; x += 2) {
                const y = H / 2 + (Math.random() * H * 0.65 - H * 0.325);
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
            return;
        }

        // Locked — render signal waveform
        wavePhase += 0.058;
        const isHostile  = state.lockedSignal.type === 'hostile';
        const baseColor  = isHostile ? '#ff3333' : '#00ffe7';
        const noisy      = state.waveNoise > 0;
        const noiseLevel = noisy ? Math.min(1, state.waveNoise / 800) : 0;

        // Primary wave
        ctx.strokeStyle = baseColor;
        ctx.lineWidth   = 1.5;
        ctx.shadowColor = baseColor;
        ctx.shadowBlur  = 7;
        ctx.beginPath();
        for (let x = 0; x < W; x++) {
            const t    = x / W;
            const s1   = Math.sin(t * Math.PI * 10 + wavePhase);
            const s2   = Math.sin(t * Math.PI * 23 + wavePhase * 1.4) * 0.28;
            const ns   = noisy ? (Math.random() * 2 - 1) * noiseLevel * 0.9 : 0;
            const amp  = H / 2 * 0.72;
            const y    = H / 2 + (s1 + s2 + ns) * amp;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Faint echo wave underneath
        ctx.strokeStyle = baseColor + '2a';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        for (let x = 0; x < W; x++) {
            const t = x / W;
            const y = H / 2 + Math.sin(t * Math.PI * 6 + wavePhase * 0.65) * (H / 2 * 0.38);
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // ══════════════════════════════════════════════════════════
    // OVERLORD GM CONFIG PANEL
    // ══════════════════════════════════════════════════════════
    function injectGMPanel() {
        const style = document.createElement('style');
        style.textContent = `
            #gm-toggle {
                position:fixed; bottom:14px; right:14px; z-index:1100;
                background:rgba(6,8,18,0.95); border:1px solid #b8a800;
                color:#b8a800; font-family:'Consolas',monospace; font-size:11px;
                letter-spacing:2px; padding:7px 14px; cursor:pointer;
                transition:background 0.2s; box-shadow:0 0 12px rgba(184,168,0,0.15);
            }
            #gm-toggle:hover { background:rgba(184,168,0,0.1); }
            #gm-panel {
                position:fixed; top:60px; right:14px; z-index:1090;
                width:370px; max-height:82vh; display:flex; flex-direction:column;
                background:rgba(6,8,18,0.98); border:1px solid #b8a800;
                font-family:'Consolas','Courier New',monospace; font-size:12px;
                color:#b8a800; box-shadow:0 0 30px rgba(184,168,0,0.15);
            }
            #gm-panel.hidden { display:none; }
            #gm-hdr {
                display:flex; justify-content:space-between; align-items:center;
                padding:9px 12px; border-bottom:1px solid #b8a80040;
                font-size:11px; letter-spacing:2px; font-weight:bold;
                flex-shrink:0; cursor:move; user-select:none;
            }
            #gm-close-btn {
                background:none; border:none; color:#b8a800; cursor:pointer;
                font-size:14px; padding:0;
            }
            .gm-tabs {
                display:flex; border-bottom:1px solid #b8a80040; flex-shrink:0;
            }
            .gm-tab {
                flex:1; padding:7px 4px; background:none; border:none;
                border-right:1px solid #b8a80040; color:#b8a80060;
                font-family:'Consolas',monospace; font-size:10px; letter-spacing:1px;
                cursor:pointer; transition:all 0.15s;
            }
            .gm-tab:last-child { border-right:none; }
            .gm-tab.active { color:#b8a800; background:rgba(184,168,0,0.07); }
            .gm-body { overflow-y:auto; flex:1; }
            .gm-tc { padding:12px; }
            .gm-tc.hidden { display:none; }
            .gm-section-label {
                font-size:9px; letter-spacing:1.5px; color:#b8a80070;
                margin-bottom:8px; text-transform:uppercase;
            }
            .gm-sig-hdr, .gm-sig-row {
                display:grid;
                grid-template-columns:72px 50px 60px 60px 60px 22px;
                gap:4px; align-items:center;
            }
            .gm-sig-hdr {
                font-size:9px; opacity:0.45; letter-spacing:1px;
                padding:0 0 4px; border-bottom:1px solid #b8a80020; margin-bottom:4px;
            }
            .gm-sig-row {
                padding:4px 0; border-bottom:1px solid #b8a80018; font-size:11px;
            }
            .gm-sig-row:last-child { border-bottom:none; }
            .gm-hostile  { color:#e74c3c; }
            .gm-friendly { color:#00e5c8; }
            .gm-del {
                background:none; border:1px solid #e74c3c60; color:#e74c3c;
                cursor:pointer; font-size:9px; width:20px; height:20px;
                padding:0; font-family:'Consolas',monospace; transition:all 0.15s;
            }
            .gm-del:hover { border-color:#e74c3c; background:rgba(231,76,60,0.1); }
            .gm-divider { border-top:1px solid #b8a80025; margin:10px 0; }
            .gm-form-label {
                font-size:9px; letter-spacing:1.5px; color:#b8a80070; margin-bottom:8px;
            }
            .gm-field { margin-bottom:7px; }
            .gm-field label {
                display:block; font-size:9px; letter-spacing:1px;
                color:#b8a80060; margin-bottom:3px;
            }
            .gm-field input, .gm-field select, .gm-field textarea {
                width:100%; background:rgba(184,168,0,0.04); border:1px solid #b8a80040;
                color:#b8a800; font-family:'Consolas',monospace; font-size:11px;
                padding:4px 6px; box-sizing:border-box; outline:none;
            }
            .gm-field input:focus, .gm-field select:focus, .gm-field textarea:focus {
                border-color:#b8a800;
            }
            .gm-field select option { background:#06080f; }
            .gm-field textarea { height:52px; resize:vertical; }
            .gm-row2 { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
            .gm-btn {
                width:100%; background:rgba(184,168,0,0.07); border:1px solid #b8a80070;
                color:#b8a800; font-family:'Consolas',monospace; font-size:10px;
                letter-spacing:1.5px; padding:7px; cursor:pointer;
                transition:background 0.2s; margin-top:8px;
            }
            .gm-btn:hover { background:rgba(184,168,0,0.2); }
            .gm-msg-row {
                display:flex; align-items:flex-start; gap:6px;
                padding:5px 0; border-bottom:1px solid #b8a80018;
                font-size:10px; line-height:1.4; color:#b8a80090;
            }
            .gm-msg-row:last-child { border-bottom:none; }
            .gm-msg-text { flex:1; word-break:break-word; }
            .gm-err  { color:#e74c3c; font-size:9px; letter-spacing:1px; margin:4px 0; min-height:14px; }
            .gm-note { font-size:9px; color:#b8a80060; line-height:1.5; margin-bottom:8px; }
            .gm-empty { font-size:10px; color:#b8a80040; padding:6px 0; }
            #gm-hop-fields { margin-top:0; }
        `;
        document.head.appendChild(style);

        const wrap = document.createElement('div');
        wrap.innerHTML = `
        <button id="gm-toggle">⚙ GM CONFIG</button>
        <div id="gm-panel" class="hidden">
            <div id="gm-hdr">
                <span>⚙ OVERLORD SIGNAL CONFIG</span>
                <button id="gm-close-btn">✕</button>
            </div>
            <div class="gm-tabs">
                <button class="gm-tab active" data-tab="sigs">SIGNALS</button>
                <button class="gm-tab" data-tab="msgs">MESSAGES</button>
            </div>
            <div class="gm-body">
                <div class="gm-tc" id="gm-tc-sigs">
                    <div class="gm-section-label">Active Signals</div>
                    <div id="gm-sig-rows"></div>
                    <div class="gm-divider"></div>
                    <div class="gm-form-label">▸ ADD SIGNAL</div>
                    <div class="gm-row2">
                        <div class="gm-field">
                            <label>CALLSIGN</label>
                            <input id="gm-cs" placeholder="ECHO-7" autocomplete="off">
                        </div>
                        <div class="gm-field">
                            <label>FREQUENCY (MHz)</label>
                            <input id="gm-freq" type="number" min="400" max="500" step="0.1" placeholder="449.0">
                        </div>
                    </div>
                    <div class="gm-row2">
                        <div class="gm-field">
                            <label>TYPE</label>
                            <select id="gm-type">
                                <option value="hostile">HOSTILE</option>
                                <option value="friendly">FRIENDLY</option>
                            </select>
                        </div>
                        <div class="gm-field">
                            <label>ENCRYPTION</label>
                            <select id="gm-enc">
                                <option value="AES-256">AES-256 (decryptable)</option>
                                <option value="SCRAMBLED">SCRAMBLED (decryptable)</option>
                                <option value="CLEAR">CLEAR</option>
                            </select>
                        </div>
                    </div>
                    <div class="gm-row2" id="gm-hop-fields">
                        <div class="gm-field">
                            <label>HOP MIN (sec)</label>
                            <input id="gm-hopmin" type="number" min="5" value="20">
                        </div>
                        <div class="gm-field">
                            <label>HOP MAX (sec)</label>
                            <input id="gm-hopmax" type="number" min="5" value="40">
                        </div>
                    </div>
                    <div id="gm-sig-err" class="gm-err"></div>
                    <button class="gm-btn" id="gm-add-sig">+ ADD SIGNAL</button>
                </div>
                <div class="gm-tc hidden" id="gm-tc-msgs">
                    <div class="gm-note">These messages appear on successful AES-256 / SCRAMBLED decrypt. One is chosen at random each time players crack a signal.</div>
                    <div id="gm-msg-rows"></div>
                    <div class="gm-divider"></div>
                    <div class="gm-form-label">▸ ADD DECODED MESSAGE</div>
                    <div class="gm-field">
                        <textarea id="gm-new-msg" placeholder="STRIKE PKG ALPHA CONFIRMED — GRID 447-229 — T-MINUS 18MIN"></textarea>
                    </div>
                    <div id="gm-msg-err" class="gm-err"></div>
                    <button class="gm-btn" id="gm-add-msg">+ ADD MESSAGE</button>
                </div>
            </div>
        </div>`;
        document.body.appendChild(wrap);

        const panel     = document.getElementById('gm-panel');
        const toggleBtn = document.getElementById('gm-toggle');
        const closeBtn  = document.getElementById('gm-close-btn');
        const gmHdr     = document.getElementById('gm-hdr');
        const typeSelect = document.getElementById('gm-type');
        const hopFields  = document.getElementById('gm-hop-fields');

        // Toggle
        toggleBtn.addEventListener('click', () => {
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) { renderGMSigs(); renderGMMsgs(); }
        });
        closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

        // Drag
        let _dragging = false, _ox = 0, _oy = 0;
        gmHdr.addEventListener('mousedown', e => {
            if (e.target === closeBtn) return;
            _dragging = true;
            _ox = e.clientX - panel.offsetLeft;
            _oy = e.clientY - panel.offsetTop;
            panel.style.transition = 'none';
            e.preventDefault();
        });
        document.addEventListener('mousemove', e => {
            if (!_dragging) return;
            panel.style.left  = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, e.clientX - _ox)) + 'px';
            panel.style.top   = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - _oy)) + 'px';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => { _dragging = false; });

        // Tabs
        document.querySelectorAll('.gm-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.gm-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const t = tab.dataset.tab;
                document.getElementById('gm-tc-sigs').classList.toggle('hidden', t !== 'sigs');
                document.getElementById('gm-tc-msgs').classList.toggle('hidden', t !== 'msgs');
            });
        });

        // Show/hide hop fields for friendly signals
        typeSelect.addEventListener('change', () => {
            hopFields.style.display = typeSelect.value === 'hostile' ? '' : 'none';
        });

        // ── Render signal roster ──────────────────────────────
        function renderGMSigs() {
            const container = document.getElementById('gm-sig-rows');
            container.innerHTML = '';
            if (!signals.length) {
                container.innerHTML = '<div class="gm-empty">No signals configured.</div>';
                return;
            }
            const hdr = document.createElement('div');
            hdr.className = 'gm-sig-hdr';
            hdr.innerHTML = '<span>CALLSIGN</span><span>FREQ</span><span>TYPE</span><span>ENC</span><span>HOP</span><span></span>';
            container.appendChild(hdr);

            signals.forEach((sig, idx) => {
                const row = document.createElement('div');
                row.className = 'gm-sig-row';
                const cls = sig.type === 'hostile' ? 'gm-hostile' : 'gm-friendly';
                const hop = sig.hopMin > 0 ? sig.hopMin + '–' + sig.hopMax + 's' : '—';
                row.innerHTML = `
                    <span class="${cls}">${sig.callsign}</span>
                    <span>${sig.freq.toFixed(1)}</span>
                    <span class="${cls}" style="font-size:9px">${sig.type.toUpperCase()}</span>
                    <span style="font-size:9px;opacity:0.7">${sig.enc}</span>
                    <span style="font-size:9px;opacity:0.7">${hop}</span>
                    <button class="gm-del" data-idx="${idx}">✕</button>`;
                container.appendChild(row);
            });

            container.querySelectorAll('.gm-del').forEach(btn => {
                btn.addEventListener('click', () => {
                    const i   = parseInt(btn.dataset.idx);
                    const sig = signals[i];
                    if (sig.hopTimeout) { clearTimeout(sig.hopTimeout); sig.hopTimeout = null; }
                    if (state.lockedSignal === sig) loseLock(false);
                    signals.splice(i, 1);
                    saveRadioConfig();
                    renderSignalList();
                    renderGMSigs();
                    addLog('[GM] SIGNAL ' + sig.callsign + ' REMOVED FROM SCANNER', 'sys');
                });
            });
        }

        // ── Render decoded messages list ──────────────────────
        function renderGMMsgs() {
            const container = document.getElementById('gm-msg-rows');
            container.innerHTML = '';
            if (!DECODED_MESSAGES.length) {
                container.innerHTML = '<div class="gm-empty">No messages yet. Add some below.</div>';
                return;
            }
            DECODED_MESSAGES.forEach((msg, idx) => {
                const row = document.createElement('div');
                row.className = 'gm-msg-row';
                row.innerHTML = `
                    <span class="gm-msg-text">${idx + 1}. ${msg}</span>
                    <button class="gm-del" data-idx="${idx}">✕</button>`;
                container.appendChild(row);
            });
            container.querySelectorAll('.gm-del').forEach(btn => {
                btn.addEventListener('click', () => {
                    DECODED_MESSAGES.splice(parseInt(btn.dataset.idx), 1);
                    saveRadioConfig();
                    renderGMMsgs();
                });
            });
        }

        // ── Add signal ────────────────────────────────────────
        document.getElementById('gm-add-sig').addEventListener('click', () => {
            const errEl  = document.getElementById('gm-sig-err');
            const cs     = document.getElementById('gm-cs').value.trim().toUpperCase();
            const freq   = parseFloat(document.getElementById('gm-freq').value);
            const type   = typeSelect.value;
            const enc    = document.getElementById('gm-enc').value;
            const hopMin = type === 'hostile' ? (parseInt(document.getElementById('gm-hopmin').value) || 20) : 0;
            const hopMax = type === 'hostile' ? (parseInt(document.getElementById('gm-hopmax').value) || 40) : 0;

            if (!cs)                              { errEl.textContent = 'CALLSIGN required'; return; }
            if (isNaN(freq)||freq<400||freq>500)  { errEl.textContent = 'FREQ must be 400–500 MHz'; return; }
            if (type==='hostile' && hopMin>=hopMax){ errEl.textContent = 'HOP MAX must exceed HOP MIN'; return; }
            errEl.textContent = '';

            const newSig = { id:'gm-'+Date.now(), callsign:cs, freq, type, enc, hopMin, hopMax, hopTimeout:null, nextHopFreq:null };
            signals.push(newSig);
            if (type === 'hostile') scheduleHop(newSig);
            saveRadioConfig();
            renderSignalList();
            renderGMSigs();
            document.getElementById('gm-cs').value   = '';
            document.getElementById('gm-freq').value = '';
            addLog('[GM] SIGNAL ' + cs + ' ADDED @ ' + freq.toFixed(1) + ' MHz', 'sys');
        });

        // ── Add decoded message ───────────────────────────────
        document.getElementById('gm-add-msg').addEventListener('click', () => {
            const errEl = document.getElementById('gm-msg-err');
            const msg   = document.getElementById('gm-new-msg').value.trim().toUpperCase();
            if (!msg) { errEl.textContent = 'Message cannot be empty'; return; }
            errEl.textContent = '';
            DECODED_MESSAGES.push(msg);
            saveRadioConfig();
            renderGMMsgs();
            document.getElementById('gm-new-msg').value = '';
        });

        renderGMSigs();
        renderGMMsgs();
    }

    // ══════════════════════════════════════════════════════════
    // BOOT
    // ══════════════════════════════════════════════════════════
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
