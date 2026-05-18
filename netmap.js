'use strict';

const NM_CFG_KEY   = 'luxorNetmapConfig';
const NM_STATE_KEY = 'luxorNetmapState';

const NODE_ICONS = { entry:'▶', firewall:'⊡', server:'▣', database:'▦', target:'◎', router:'⊕' };

const TEMPLATES = {
    corridor: {
        nodes: [
            { id:'n0', type:'entry',    label:'VPN GATEWAY',  x:70,  y:210, defense:0 },
            { id:'n1', type:'router',   label:'CORE ROUTER',  x:210, y:210, defense:1 },
            { id:'n2', type:'firewall', label:'FIREWALL A',   x:350, y:210, defense:3 },
            { id:'n3', type:'server',   label:'APP SERVER',   x:490, y:210, defense:2 },
            { id:'n4', type:'database', label:'DATABASE',     x:630, y:210, defense:3 },
            { id:'n5', type:'target',   label:'TARGET HOST',  x:760, y:210, defense:4 }
        ],
        edges: [['n0','n1'],['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5']],
        target: 'n5'
    },
    splinter: {
        nodes: [
            { id:'n0', type:'entry',    label:'VPN GATEWAY',  x:70,  y:210, defense:0 },
            { id:'n1', type:'firewall', label:'FIREWALL',     x:220, y:210, defense:3 },
            { id:'n2', type:'server',   label:'SERVER A',     x:390, y:110, defense:2 },
            { id:'n3', type:'server',   label:'SERVER B',     x:390, y:310, defense:2 },
            { id:'n4', type:'database', label:'DATABASE A',   x:560, y:110, defense:3 },
            { id:'n5', type:'database', label:'DATABASE B',   x:560, y:310, defense:3 },
            { id:'n6', type:'target',   label:'TARGET HOST',  x:720, y:210, defense:4 }
        ],
        edges: [['n0','n1'],['n1','n2'],['n1','n3'],['n2','n4'],['n3','n5'],['n4','n6'],['n5','n6']],
        target: 'n6'
    },
    mesh: {
        nodes: [
            { id:'n0', type:'entry',    label:'VPN GATEWAY',  x:55,  y:210, defense:0 },
            { id:'n1', type:'router',   label:'ROUTER A',     x:185, y:120, defense:1 },
            { id:'n2', type:'router',   label:'ROUTER B',     x:185, y:300, defense:1 },
            { id:'n3', type:'firewall', label:'CORE FIREWALL',x:335, y:210, defense:4 },
            { id:'n4', type:'server',   label:'SERVER A',     x:480, y:120, defense:2 },
            { id:'n5', type:'server',   label:'SERVER B',     x:480, y:300, defense:2 },
            { id:'n6', type:'database', label:'DATABASE',     x:620, y:120, defense:3 },
            { id:'n7', type:'server',   label:'BACKUP SRV',   x:620, y:300, defense:2 },
            { id:'n8', type:'target',   label:'TARGET HOST',  x:755, y:210, defense:5 }
        ],
        edges: [['n0','n1'],['n0','n2'],['n1','n3'],['n2','n3'],['n3','n4'],['n3','n5'],
                ['n4','n6'],['n5','n7'],['n6','n8'],['n7','n8'],['n1','n4'],['n2','n5']],
        target: 'n8'
    }
};

const NODE_STROKE = { locked:'#2a2f45', reachable:'#00e5c8', compromised:'#b8a800', target_locked:'#6b3a00', target_reached:'#b8a800', blocked:'#c0392b' };
const NODE_FILL   = { locked:'#06090f', reachable:'rgba(0,229,200,0.06)', compromised:'rgba(184,168,0,0.1)', target_locked:'rgba(92,46,0,0.3)', target_reached:'rgba(184,168,0,0.15)', blocked:'rgba(192,57,43,0.1)' };

let cfg   = loadCfg();
let state = loadState();
let isAdmin = false;
let selectedNode = null;

function loadCfg() {
    try { return Object.assign({ netName:'CORPORATE INTRANET', netDesc:'Internal network — floor 3', template:'corridor', detLimit:80, detGain:20, nodeOverrides:{} }, JSON.parse(localStorage.getItem(NM_CFG_KEY) || '{}')); }
    catch { return { netName:'CORPORATE INTRANET', netDesc:'Internal network — floor 3', template:'corridor', detLimit:80, detGain:20, nodeOverrides:{} }; }
}
function saveCfg() { localStorage.setItem(NM_CFG_KEY, JSON.stringify(cfg)); }

function loadState() {
    try { return JSON.parse(localStorage.getItem(NM_STATE_KEY)) || blankState(); }
    catch { return blankState(); }
}
function saveState() { localStorage.setItem(NM_STATE_KEY, JSON.stringify(state)); }

function blankState() {
    return { phase:'idle', compromised:['n0'], failed:0, probes:0, detection:0, log:[] };
}

function getNetwork() {
    const tpl = JSON.parse(JSON.stringify(TEMPLATES[cfg.template] || TEMPLATES.corridor));
    if (cfg.nodeOverrides) {
        tpl.nodes.forEach(n => {
            if (cfg.nodeOverrides[n.id]) {
                Object.assign(n, cfg.nodeOverrides[n.id]);
            }
        });
    }
    return tpl;
}

function nodeState(node) {
    const net = getNetwork();
    if (state.compromised.includes(node.id)) return node.id === net.target ? 'target_reached' : 'compromised';
    if (isReachable(node.id)) return node.id === net.target ? 'target_locked' : 'reachable';
    return 'locked';
}

function isReachable(nodeId) {
    const net = getNetwork();
    for (const [a, b] of net.edges) {
        if (a === nodeId && state.compromised.includes(b)) return true;
        if (b === nodeId && state.compromised.includes(a)) return true;
    }
    return false;
}

function nodeTN(node) {
    return 4 + node.defense * 2;
}

// ── SVG rendering ──────────────────────────────────────────────────────────

function renderSVG() {
    const net = getNetwork();
    const edgesEl = document.getElementById('nm-edges');
    const nodesEl = document.getElementById('nm-nodes');
    if (!edgesEl || !nodesEl) return;

    // Player fog-of-war: only show compromised + reachable nodes
    const visibleIds = isAdmin
        ? new Set(net.nodes.map(n => n.id))
        : new Set(net.nodes.filter(n => state.compromised.includes(n.id) || isReachable(n.id)).map(n => n.id));

    // Draw edges (only between visible nodes)
    edgesEl.innerHTML = net.edges.map(([a, b]) => {
        if (!visibleIds.has(a) || !visibleIds.has(b)) return '';
        const na = net.nodes.find(n => n.id === a);
        const nb = net.nodes.find(n => n.id === b);
        if (!na || !nb) return '';
        const bothComp = state.compromised.includes(a) && state.compromised.includes(b);
        const oneComp  = (state.compromised.includes(a) && isReachable(b)) || (state.compromised.includes(b) && isReachable(a));
        const stroke   = bothComp ? '#b8a800' : oneComp ? 'rgba(0,229,200,0.5)' : '#1e2438';
        const width    = bothComp ? 2.5 : oneComp ? 1.5 : 1;
        return `<line x1="${na.x}" y1="${na.y}" x2="${nb.x}" y2="${nb.y}" stroke="${stroke}" stroke-width="${width}" stroke-dasharray="${bothComp ? 'none' : oneComp ? '8,4' : '4,8'}"/>`;
    }).join('');

    // Draw nodes (all for overlord, fog-of-war for players)
    nodesEl.innerHTML = net.nodes.map(node => {
        if (!visibleIds.has(node.id)) return '';
        const ns     = nodeState(node);
        const stroke = NODE_STROKE[ns] || '#2a2f45';
        const fill   = NODE_FILL[ns]   || '#06090f';
        const icon   = NODE_ICONS[node.type] || '□';
        const isComp = state.compromised.includes(node.id);
        const isReach= isReachable(node.id) && !isComp;
        const textCol= isComp ? '#b8a800' : isReach ? '#00e5c8' : '#3a3f55';
        const filter = isComp ? 'url(#nm-glow-gold)' : isReach ? 'url(#nm-glow-cyan)' : '';
        const cursor = (isReach && state.phase === 'active') ? 'pointer' : 'default';
        const pulse  = isReach ? `<circle r="33" fill="none" stroke="${stroke}" stroke-width="1" opacity="0" class="nm-pulse-ring"><animate attributeName="r" values="28;38;28" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/></circle>` : '';
        // TN only shown to overlord on the map; players see ??? in the probe panel
        const tnText = isAdmin && !isComp ? `<text text-anchor="middle" y="50" fill="#3a3f55" font-size="9" font-family="Share Tech Mono,monospace">TN ${nodeTN(node)}</text>` : '';
        const checkmark = isComp ? `<text text-anchor="middle" y="50" fill="#b8a800" font-size="9" font-family="Share Tech Mono,monospace">&#10003; OK</text>` : '';

        return `<g class="nm-node ${ns}" id="nmnode-${node.id}" data-id="${node.id}"
                   transform="translate(${node.x},${node.y})" style="cursor:${cursor}" ${filter ? `filter="${filter}"` : ''}>
            ${pulse}
            <circle r="26" fill="${fill}" stroke="${stroke}" stroke-width="${isComp || isReach ? 2 : 1.5}"/>
            <text text-anchor="middle" dominant-baseline="central" fill="${textCol}" font-size="15" font-family="Share Tech Mono,monospace">${icon}</text>
            <text text-anchor="middle" y="38" fill="${textCol}" font-size="9.5" letter-spacing="0.5" font-family="Share Tech Mono,monospace">${node.label}</text>
            ${tnText}${checkmark}
        </g>`;
    }).join('');

    // Attach click handlers to reachable nodes
    if (state.phase === 'active') {
        net.nodes.forEach(node => {
            const el = document.getElementById('nmnode-' + node.id);
            if (el && isReachable(node.id) && !state.compromised.includes(node.id)) {
                el.addEventListener('click', () => openProbePanel(node));
            }
        });
    }
}

// ── Probe panel ────────────────────────────────────────────────────────────

function openProbePanel(node) {
    selectedNode = node;
    const panel  = document.getElementById('nm-probe-panel');
    const result = document.getElementById('nm-probe-result');
    const rollEl = document.getElementById('nm-probe-roll');
    document.getElementById('nm-probe-name').textContent = node.label;
    document.getElementById('nm-probe-meta').textContent = `${node.type.toUpperCase()} — Defense level ${node.defense}`;
    document.getElementById('nm-probe-tn').textContent = isAdmin ? nodeTN(node) : '???';
    if (result) { result.style.display = 'none'; result.textContent = ''; }
    if (rollEl) rollEl.value = '';
    if (panel) panel.classList.add('show');
    if (rollEl) rollEl.focus();
}

function closeProbePanel() {
    selectedNode = null;
    const panel = document.getElementById('nm-probe-panel');
    if (panel) panel.classList.remove('show');
}

function doProbe() {
    if (!selectedNode) return;
    const rollEl = document.getElementById('nm-probe-roll');
    const roll   = parseInt(rollEl?.value);
    if (isNaN(roll) || roll < 1) { rollEl?.focus(); return; }

    const tn      = nodeTN(selectedNode);
    const success = roll >= tn;
    const result  = document.getElementById('nm-probe-result');
    const net     = getNetwork();

    state.probes++;

    if (success) {
        state.compromised.push(selectedNode.id);
        addLog('success', `Probe SUCCESS [${selectedNode.label}] — roll ${roll} vs TN ${tn}. Node compromised.`);
        if (result) { result.textContent = `✓ COMPROMISED — roll ${roll} vs TN ${tn}`; result.className = 'nm-probe-result ok'; result.style.display = ''; }

        if (selectedNode.id === net.target) {
            state.phase = 'won';
            addLog('success', 'TARGET NODE COMPROMISED — intrusion complete.');
            setTimeout(() => { closeProbePanel(); render(); showWinLose(); }, 900);
        } else {
            setTimeout(() => { closeProbePanel(); render(); }, 600);
        }
    } else {
        state.failed++;
        const gain = cfg.detGain || 20;
        state.detection = Math.min(100, state.detection + gain);
        addLog('danger', `Probe FAILED [${selectedNode.label}] — roll ${roll} vs TN ${tn}. Detection +${gain}%.`);
        if (result) { result.textContent = `✗ FAILED — roll ${roll} vs TN ${tn} (+${gain}% detection)`; result.className = 'nm-probe-result bad'; result.style.display = ''; }

        if (state.detection >= (cfg.detLimit || 80)) {
            state.phase = 'lost';
            addLog('danger', 'DETECTION LIMIT REACHED — network locked down.');
            setTimeout(() => { closeProbePanel(); render(); showWinLose(); }, 900);
        }
    }

    saveState();
    render();
}

function showWinLose() {
    // Reuse the log to communicate result — no separate overlay needed,
    // phase badge + detection bar make the result clear.
}

// ── Main render ────────────────────────────────────────────────────────────

function render() {
    const net = getNetwork();

    const badge = document.getElementById('nm-phase-badge');
    if (badge) {
        const labels = { idle:'STANDBY', active:'ACTIVE', won:'COMPROMISED', lost:'DETECTED' };
        badge.className = 'nm-phase-badge ' + (state.phase !== 'idle' ? state.phase : '');
        badge.textContent = labels[state.phase] || state.phase.toUpperCase();
    }

    document.getElementById('nm-net-name').textContent = cfg.netName;
    document.getElementById('nm-net-desc').textContent = state.phase === 'idle' ? 'Awaiting Overlord activation...' : cfg.netDesc;

    const compCount = state.compromised.filter(id => id !== 'n0').length;
    const totalNonEntry = net.nodes.filter(n => n.id !== 'n0').length;
    document.getElementById('nm-comp-stat').textContent  = `${compCount}/${totalNonEntry}`;
    document.getElementById('nm-probes-stat').textContent = state.probes;
    const failEl = document.getElementById('nm-fail-stat');
    if (failEl) { failEl.textContent = state.failed; failEl.className = 'nm-stat-val' + (state.failed > 0 ? ' warn' : ''); }

    const det = Math.min(100, state.detection);
    document.getElementById('nm-det-pct').textContent = det + '%';
    const fill = document.getElementById('nm-det-fill');
    if (fill) fill.style.width = det + '%';

    const idle = document.getElementById('nm-idle');
    const game = document.getElementById('nm-game');
    if (idle) idle.style.display = state.phase === 'idle' ? 'flex' : 'none';
    if (game) game.style.display = state.phase === 'idle' ? 'none' : 'block';

    if (state.phase !== 'idle') renderSVG();
    renderLog();

    if (isAdmin) {
        const sb = document.getElementById('nm-cfg-status-bar');
        if (sb) sb.textContent = `STATUS: ${state.phase.toUpperCase()} | COMPROMISED: ${compCount}/${totalNonEntry} | DETECTION: ${det}%`;
    }
}

function addLog(type, msg) {
    state.log.push({ t: Date.now(), type, msg });
}
function clearLog() { state.log = []; saveState(); renderLog(); }
window.clearLog = clearLog;

function renderLog() {
    const el  = document.getElementById('nm-log-entries');
    const cnt = document.getElementById('nm-log-count');
    if (!el) return;
    const entries = state.log || [];
    if (cnt) cnt.textContent = entries.length + ' ENTRIES';
    if (!entries.length) { el.innerHTML = '<div class="hle"><span class="hle-m">Network Map module initialized.</span></div>'; return; }
    el.innerHTML = entries.slice(-40).reverse().map(e => {
        const t = new Date(e.t).toLocaleTimeString();
        return `<div class="hle ${e.type || ''}"><span class="hle-t">[${t}]</span> <span class="hle-m">${e.msg}</span></div>`;
    }).join('');
}

// ── Export / Import config ─────────────────────────────────────────────────

function exportConfig() {
    readCfgFields(); readNodeOverrides();
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'netmap-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

function importConfig() {
    document.getElementById('nm-import-file').click();
}

function handleImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const loaded = JSON.parse(ev.target.result);
            Object.assign(cfg, loaded);
            saveCfg();
            populateAdminFields();
            buildNodeEditor();
            render();
            const sb = document.getElementById('nm-cfg-status-bar');
            if (sb) sb.textContent = 'CONFIG IMPORTED SUCCESSFULLY';
        } catch {
            const sb = document.getElementById('nm-cfg-status-bar');
            if (sb) sb.textContent = 'IMPORT FAILED — INVALID JSON';
        }
    };
    reader.readAsText(file);
}

// ── Admin panel ────────────────────────────────────────────────────────────

function buildNodeEditor() {
    const net = getNetwork();
    const el  = document.getElementById('nm-node-editor');
    if (!el) return;
    el.innerHTML = net.nodes.map(n => {
        const ov = (cfg.nodeOverrides || {})[n.id] || {};
        return `<div class="nm-node-row">
            <div style="font-size:9px;opacity:0.5;">${n.type.toUpperCase()}</div>
            <input class="nm-cfg-inp" id="nme-label-${n.id}" type="text" value="${ov.label || n.label}" style="font-size:9px;padding:3px 5px;" maxlength="14">
            <input class="nm-cfg-inp" id="nme-def-${n.id}"   type="number" min="0" max="5" value="${ov.defense !== undefined ? ov.defense : n.defense}" style="font-size:9px;padding:3px 5px;">
        </div>`;
    }).join('');
}

function readNodeOverrides() {
    const net = getNetwork();
    cfg.nodeOverrides = {};
    net.nodes.forEach(n => {
        const label   = document.getElementById(`nme-label-${n.id}`)?.value.trim();
        const defense = parseInt(document.getElementById(`nme-def-${n.id}`)?.value);
        cfg.nodeOverrides[n.id] = {
            label:   label || n.label,
            defense: isNaN(defense) ? n.defense : Math.max(0, Math.min(5, defense))
        };
    });
}

function initOverlordPanel() {
    const toggle = document.getElementById('nm-ov-toggle');
    const panel  = document.getElementById('nm-ov-panel');
    const close  = document.getElementById('nm-ov-close');
    if (toggle) { toggle.style.display = 'block'; toggle.addEventListener('click', () => panel.classList.toggle('hidden')); }
    if (close)  close.addEventListener('click', () => panel.classList.add('hidden'));

    document.getElementById('nm-cfg-template')?.addEventListener('change', () => {
        cfg.template = document.getElementById('nm-cfg-template').value;
        cfg.nodeOverrides = {};
        buildNodeEditor();
    });

    document.getElementById('nm-cfg-activate')?.addEventListener('click', () => {
        readCfgFields(); readNodeOverrides();
        state = blankState();
        state.phase = 'active';
        addLog('', 'Network activated by Overlord.');
        saveCfg(); saveState(); render();
    });

    document.getElementById('nm-cfg-deactivate')?.addEventListener('click', () => {
        state.phase = 'idle';
        addLog('', 'Network deactivated by Overlord.');
        closeProbePanel();
        saveState(); render();
    });

    document.getElementById('nm-cfg-reset')?.addEventListener('click', () => {
        state = blankState();
        addLog('', 'Network force-reset by Overlord.');
        closeProbePanel();
        saveState(); render();
    });

    document.getElementById('nm-cfg-save')?.addEventListener('click', () => {
        readCfgFields(); readNodeOverrides(); saveCfg(); render();
    });

    document.getElementById('nm-cfg-export')?.addEventListener('click', exportConfig);
    document.getElementById('nm-cfg-import')?.addEventListener('click', importConfig);
    document.getElementById('nm-import-file')?.addEventListener('change', e => {
        handleImport(e.target.files[0]);
        e.target.value = '';
    });

    populateAdminFields();
    buildNodeEditor();
}

function populateAdminFields() {
    const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    v('nm-cfg-netname',  cfg.netName);
    v('nm-cfg-netdesc',  cfg.netDesc);
    v('nm-cfg-template', cfg.template);
    v('nm-cfg-detlimit', cfg.detLimit);
    v('nm-cfg-detgain',  cfg.detGain);
}

function readCfgFields() {
    cfg.netName  = document.getElementById('nm-cfg-netname')?.value.trim()  || 'CORPORATE INTRANET';
    cfg.netDesc  = document.getElementById('nm-cfg-netdesc')?.value.trim()  || '';
    cfg.template = document.getElementById('nm-cfg-template')?.value || 'corridor';
    cfg.detLimit = parseInt(document.getElementById('nm-cfg-detlimit')?.value) || 80;
    cfg.detGain  = parseInt(document.getElementById('nm-cfg-detgain')?.value)  || 20;
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('nm-probe-btn')?.addEventListener('click', doProbe);
    document.getElementById('nm-probe-cancel')?.addEventListener('click', closeProbePanel);
    document.getElementById('nm-probe-roll')?.addEventListener('keydown', e => { if (e.key === 'Enter') doProbe(); });

    window.addEventListener('storage', e => {
        if (e.key === NM_CFG_KEY)   { cfg   = loadCfg();   render(); }
        if (e.key === NM_STATE_KEY) { state = loadState(); render(); }
    });

    if (window.LuxorAuth && LuxorAuth.isAdmin()) {
        isAdmin = true;
        initOverlordPanel();
    }

    render();
});
