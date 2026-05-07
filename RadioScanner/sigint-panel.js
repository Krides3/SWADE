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

    const DECODED_MESSAGES = [
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

    // ── Signal definitions ────────────────────────────────────
    // hopMin/hopMax in seconds; friendly signals never hop
    const signals = [
        { id:'s1', callsign:'ECHO-7',  freq:449.2, type:'hostile',  enc:'AES-256',   hopMin:20, hopMax:40, hopTimeout:null, nextHopFreq:null },
        { id:'s2', callsign:'KILO-9',  freq:462.8, type:'hostile',  enc:'AES-256',   hopMin:22, hopMax:38, hopTimeout:null, nextHopFreq:null },
        { id:'s3', callsign:'DELTA-3', freq:478.1, type:'hostile',  enc:'SCRAMBLED', hopMin:18, hopMax:35, hopTimeout:null, nextHopFreq:null },
        { id:'s4', callsign:'ALPHA-1', freq:431.5, type:'friendly', enc:'CLEAR',     hopMin:0,  hopMax:0,  hopTimeout:null, nextHopFreq:null },
        { id:'s5', callsign:'BRAVO-4', freq:417.3, type:'friendly', enc:'CLEAR',     hopMin:0,  hopMax:0,  hopTimeout:null, nextHopFreq:null },
    ];

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
        setTimeout(() => addLog('HOSTILE SIGNALS DETECTED: ECHO-7 · KILO-9 · DELTA-3', 'hostile'), 700);
        setTimeout(() => addLog('FRIENDLY NET NOMINAL: ALPHA-1 · BRAVO-4', 'friendly'), 1400);
        setTimeout(() => addLog('USE TUNER TO LOCK — CLICK SIGNALS TO AUTO-TUNE', 'dim'), 2100);

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
        if (state.mode === 'EMCON') {
            el.emconBanner.classList.remove('active');
            if (state.mode !== 'EMCON') return;
        }
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

            // Shake all unselected blocks
            el.cipherBlocks.querySelectorAll('.sp-cipher-block:not(.correct)').forEach(b => {
                b.classList.add('error');
                setTimeout(() => b.classList.remove('error'), 400);
            });

            // Re-render to un-mark any partials
            renderCipherBlocks();
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
    // BOOT
    // ══════════════════════════════════════════════════════════
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
