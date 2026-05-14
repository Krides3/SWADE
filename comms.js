/* ================================================================
   HQ COMMS — encrypted field-to-command channel
   Messages stored in localStorage, synced via storage events.
   ================================================================ */
(function () {
    'use strict';

    const LOG_KEY  = 'luxorCommsLog';
    const CFG_KEY  = 'luxorCommsConfig';
    const MAX_MSGS = 150;

    const session  = window.LuxorAuth && LuxorAuth.getSession();
    const username = session ? session.username : 'UNKNOWN';
    const isAdmin  = window.LuxorAuth && LuxorAuth.isAdmin();

    /* ── Persistence ─────────────────────────────────────────── */
    function loadLog() {
        try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); }
        catch (e) { return []; }
    }
    function saveLog(log) {
        localStorage.setItem(LOG_KEY, JSON.stringify(log));
    }
    function loadCfg() {
        try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function saveCfg(cfg) {
        localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    }

    /* ── Message factory ─────────────────────────────────────── */
    function makeMsg(text, type) {
        return {
            id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            username:  type === 'hq'  ? '◈ HQ' :
                       type === 'sys' ? 'SYS'  : username,
            role:      isAdmin ? 'admin' : 'player',
            type:      type || 'field',
            text:      text,
            ts:        Date.now()
        };
    }

    function pushMsg(msg) {
        const log = loadLog();
        log.push(msg);
        if (log.length > MAX_MSGS) log.splice(0, log.length - MAX_MSGS);
        saveLog(log);
    }

    /* ── Time helpers ────────────────────────────────────────── */
    function fmt(ts) {
        const d = new Date(ts);
        const h = String(d.getHours()).padStart(2,'0');
        const m = String(d.getMinutes()).padStart(2,'0');
        return h + ':' + m;
    }

    /* ── XSS safety ──────────────────────────────────────────── */
    function esc(s) {
        return String(s)
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;');
    }

    /* ── Render a single message element ─────────────────────── */
    function buildMsgEl(msg) {
        const div = document.createElement('div');
        const isSelf = msg.username === username && msg.type !== 'hq' && msg.type !== 'sys';

        if (msg.type === 'sys') {
            div.className = 'msg msg-sys';
            div.innerHTML = `<span class="msg-text">─── ${esc(msg.text)} ───</span>`;
            return div;
        }

        let cls = 'msg';
        if (msg.type === 'hq')  cls += ' msg-hq';
        else if (isSelf)        cls += ' msg-self';
        else                    cls += ' msg-field';
        div.className = cls;

        div.innerHTML =
            `<span class="msg-ts">[${fmt(msg.ts)}]</span>` +
            `<span class="msg-who">${esc(msg.username)}</span>` +
            `<span class="msg-colon">:</span>` +
            `<span class="msg-text">${esc(msg.text)}</span>`;
        return div;
    }

    /* ── Render full log ─────────────────────────────────────── */
    function renderLog(animate) {
        const inner = document.getElementById('comms-log-inner');
        const empty = document.getElementById('comms-empty');
        if (!inner) return;

        const log = loadLog();

        if (log.length === 0) {
            inner.innerHTML = '';
            if (empty) { empty.style.display = 'flex'; inner.appendChild(empty); }
            return;
        }

        if (empty) empty.style.display = 'none';
        inner.innerHTML = '';

        log.forEach((msg, i) => {
            const el = buildMsgEl(msg);
            if (!animate || i < log.length - 1) el.style.animation = 'none';
            inner.appendChild(el);
        });

        scrollToBottom();
    }

    /* ── Append single new message (no full re-render) ───────── */
    function appendMsg(msg) {
        const inner = document.getElementById('comms-log-inner');
        const empty = document.getElementById('comms-empty');
        if (!inner) return;
        if (empty) empty.style.display = 'none';
        inner.appendChild(buildMsgEl(msg));
        scrollToBottom();
    }

    function scrollToBottom() {
        const log = document.getElementById('comms-log');
        if (log) log.scrollTop = log.scrollHeight;
    }

    /* ── Render mission brief ────────────────────────────────── */
    function renderBrief(cfg) {
        const wrap = document.getElementById('comms-brief');
        const txt  = document.getElementById('comms-brief-text');
        if (!wrap || !txt) return;
        if (cfg && cfg.missionBrief && cfg.missionBrief.trim()) {
            txt.textContent = cfg.missionBrief.trim();
            wrap.classList.add('active');
        } else {
            wrap.classList.remove('active');
        }
    }

    /* ── Online count (approximate — unique users in last 5 min) ── */
    function updateOnlineCount() {
        const log = loadLog();
        const cutoff = Date.now() - 5 * 60 * 1000;
        const recent = new Set(
            log.filter(m => m.ts > cutoff && m.type === 'field').map(m => m.username)
        );
        const el = document.getElementById('comms-online-count');
        if (el) el.textContent = recent.size || '—';
    }

    /* ── Send message ────────────────────────────────────────── */
    function sendMessage(text, type) {
        const t = (text || '').trim();
        if (!t) return;
        const msg = makeMsg(t, type || 'field');
        pushMsg(msg);
        appendMsg(msg);
        updateOnlineCount();
    }

    /* ── Input handling ──────────────────────────────────────── */
    function setupInput() {
        const input  = document.getElementById('comms-input');
        const btn    = document.getElementById('comms-send');
        const callEl = document.getElementById('comms-callsign');

        if (callEl) callEl.textContent = username + ':';

        function send() {
            if (!input) return;
            const txt = input.value.trim();
            if (!txt) return;
            sendMessage(txt, 'field');
            input.value = '';
            input.focus();
        }

        if (btn)   btn.addEventListener('click', send);
        if (input) input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        });
    }

    /* ── Cross-tab sync ──────────────────────────────────────── */
    window.addEventListener('storage', function (e) {
        if (e.key === LOG_KEY) {
            const newLog = JSON.parse(e.newValue || '[]');
            const oldLog = loadLog();
            const newMsgs = newLog.filter(m => !oldLog.some(o => o.id === m.id));
            newMsgs.forEach(m => appendMsg(m));
            updateOnlineCount();
        }
        if (e.key === CFG_KEY) {
            renderBrief(JSON.parse(e.newValue || '{}'));
        }
    });

    /* ── Overlord panel wiring ───────────────────────────────── */
    window.toggleCommsAdmin = function () {
        const panel = document.getElementById('comms-admin-panel');
        const btn   = document.getElementById('comms-overlord-btn');
        if (!panel) return;
        const open = panel.style.display === 'block';
        panel.style.display = open ? 'none' : 'block';
        if (btn) btn.classList.toggle('open', !open);
    };

    window.saveBrief = function () {
        const ta  = document.getElementById('ca-brief');
        const txt = ta ? ta.value : '';
        const cfg = loadCfg();
        cfg.missionBrief = txt.trim();
        saveCfg(cfg);
        renderBrief(cfg);
        showAdmMsg('✓ BRIEFING UPDATED', false);
    };

    window.clearBrief = function () {
        const cfg = loadCfg();
        cfg.missionBrief = '';
        saveCfg(cfg);
        renderBrief(cfg);
        const ta = document.getElementById('ca-brief');
        if (ta) ta.value = '';
        showAdmMsg('✓ BRIEFING CLEARED', false);
    };

    window.sendBroadcast = function () {
        const input = document.getElementById('ca-broadcast');
        const txt   = input ? input.value.trim() : '';
        if (!txt) { showAdmMsg('Enter broadcast text first.', true); return; }
        sendMessage(txt, 'hq');
        if (input) input.value = '';
        showAdmMsg('✓ BROADCAST SENT', false);
    };

    window.injectSysMsg = function () {
        const row = document.getElementById('ca-sys-row');
        if (row) row.style.display = row.style.display === 'none' ? 'flex' : 'none';
    };

    window.commitSysMsg = function () {
        const input = document.getElementById('ca-sys-input');
        const txt   = input ? input.value.trim() : '';
        if (!txt) { showAdmMsg('Enter system message text.', true); return; }
        sendMessage(txt, 'sys');
        if (input) input.value = '';
        const row = document.getElementById('ca-sys-row');
        if (row) row.style.display = 'none';
        showAdmMsg('✓ SYSTEM MESSAGE INJECTED', false);
    };

    window.clearLog = function () {
        if (!confirm('Clear the entire comms log? This affects all operators.')) return;
        saveLog([]);
        renderLog(false);
        showAdmMsg('✓ LOG CLEARED', false);
    };

    function showAdmMsg(txt, isErr) {
        const el = document.getElementById('ca-msg');
        if (!el) return;
        el.className = 'ca-msg ' + (isErr ? 'err' : 'ok');
        el.textContent = txt;
        clearTimeout(el._t);
        el._t = setTimeout(() => { el.className = 'ca-msg'; }, 3000);
    }

    /* ── Init admin UI ───────────────────────────────────────── */
    function initAdmin() {
        const toggle = document.getElementById('comms-overlord-toggle');
        if (toggle) toggle.style.display = 'flex';
        const cfg = loadCfg();
        const ta  = document.getElementById('ca-brief');
        if (ta && cfg.missionBrief) ta.value = cfg.missionBrief;
    }

    /* ── Boot ────────────────────────────────────────────────── */
    const cfg = loadCfg();
    renderLog(false);
    renderBrief(cfg);
    updateOnlineCount();
    setupInput();

    if (isAdmin) initAdmin();

    (function joinBroadcast() {
        const log    = loadLog();
        const cutoff = Date.now() - 10 * 60 * 1000;
        const recent = log.filter(m => m.type === 'sys' && m.text.includes(username) && m.ts > cutoff);
        if (recent.length === 0) {
            sendMessage(`${username} CONNECTED TO CHANNEL`, 'sys');
        }
    })();

    document.getElementById('comms-log')?.addEventListener('click', scrollToBottom);

})();
