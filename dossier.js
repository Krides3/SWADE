'use strict';

const DO_KEY = 'luxorDossiers';

const ATTRS  = ['agility','smarts','spirit','strength','vigor'];
const SKILLS = ['hacking','lockpicking','notice','persuasion','stealth','shooting','athletics','fighting','intimidation'];
const SKILL_LABELS = { hacking:'Hacking', lockpicking:'Lockpicking', notice:'Notice', persuasion:'Persuasion', stealth:'Stealth', shooting:'Shooting', athletics:'Athletics', fighting:'Fighting', intimidation:'Intimidation' };

let dossiers = loadDossiers();
let isAdmin  = false;
let editingUser = null;

function loadDossiers() {
    try { return JSON.parse(localStorage.getItem(DO_KEY)) || []; }
    catch { return []; }
}
function saveDossiers() { localStorage.setItem(DO_KEY, JSON.stringify(dossiers)); }

function getDossier(username) {
    return dossiers.find(d => d.username === username) || null;
}

function diceClass(die) {
    if (die === 'd12') return 'do-stat-dice d12';
    if (die === 'd10') return 'do-stat-dice d10';
    return 'do-stat-dice';
}

function skillClass(die) {
    if (!die || die === '—') return 'do-skill-dice';
    if (die === 'd10' || die === 'd12') return 'do-skill-dice high';
    return 'do-skill-dice';
}

// ── Card rendering ─────────────────────────────────────────────────────────

function renderCard(d) {
    document.getElementById('do-callsign').textContent  = d.callsign  || '???';
    document.getElementById('do-realname').textContent  = d.realname  || 'Unknown';
    document.getElementById('do-role').textContent      = d.role      || 'Operator';
    document.getElementById('do-clearance').textContent = 'CLEARANCE: ' + (d.clearance || 'ALPHA');
    document.getElementById('do-wounds').textContent    = d.wounds  ?? 0;
    document.getElementById('do-fatigue').textContent   = d.fatigue ?? 0;

    // Bennies pips
    const pipEl  = document.getElementById('do-bennies-pips');
    const bennies = d.bennies ?? 3;
    if (pipEl) {
        pipEl.innerHTML = Array.from({ length: Math.max(bennies, 3) }, (_, i) =>
            `<div class="do-benny-pip${i < bennies ? ' filled' : ''}"></div>`
        ).join('');
    }

    // Attributes
    const attrsEl = document.getElementById('do-attrs');
    if (attrsEl) {
        attrsEl.innerHTML = ATTRS.map(a => {
            const die = d.attrs?.[a] || 'd6';
            return `<div class="do-stat-row">
                <span class="do-stat-name">${a.toUpperCase()}</span>
                <span class="${diceClass(die)}">${die}</span>
            </div>`;
        }).join('');
    }

    // Skills
    const skillsEl = document.getElementById('do-skills');
    if (skillsEl) {
        const relevant = SKILLS.filter(s => d.skills?.[s] && d.skills[s] !== '—');
        skillsEl.innerHTML = (relevant.length ? relevant : SKILLS).map(s => {
            const die = d.skills?.[s] || '—';
            if (die === '—') return '';
            return `<div class="do-skill-row">
                <span class="do-skill-name">${SKILL_LABELS[s]}</span>
                <span class="${skillClass(die)}">${die}</span>
            </div>`;
        }).join('') || '<div style="font-size:0.6rem;color:var(--text-dim);opacity:0.5;">No skills on file.</div>';
    }

    // Edges
    const edgesEl = document.getElementById('do-edges');
    if (edgesEl) {
        const edges = (d.edges || '').split('\n').map(e => e.trim()).filter(Boolean);
        edgesEl.innerHTML = edges.length
            ? edges.map(e => `<div class="do-list-item">${e}</div>`).join('')
            : '<div style="font-size:0.6rem;color:var(--text-dim);opacity:0.4;">None on file.</div>';
    }

    // Equipment
    const eqEl = document.getElementById('do-equipment');
    if (eqEl) {
        const items = (d.equipment || '').split('\n').map(e => e.trim()).filter(Boolean);
        eqEl.innerHTML = items.length
            ? items.map(i => `<div class="do-list-item">${i}</div>`).join('')
            : '<div style="font-size:0.6rem;color:var(--text-dim);opacity:0.4;">None on file.</div>';
    }

    // Notes
    const notesEl = document.getElementById('do-notes');
    if (notesEl) notesEl.textContent = d.notes || '—';
}

function renderAdminTable() {
    const tableEl = document.getElementById('do-admin-table');
    const rowsEl  = document.getElementById('do-admin-rows');
    const countEl = document.getElementById('do-admin-count');
    if (!tableEl || !rowsEl) return;

    if (dossiers.length === 0) {
        tableEl.style.display = 'none';
        return;
    }

    tableEl.style.display = '';
    if (countEl) countEl.textContent = dossiers.length + ' OPERATORS';
    rowsEl.innerHTML = dossiers.map(d =>
        `<div class="do-admin-row">
            <span class="do-admin-callsign">${d.callsign || '???'}</span>
            <span class="do-admin-user">${d.username}</span>
            <span class="do-admin-role">${d.role || '—'}</span>
            <button class="do-admin-edit-btn" onclick="loadIntoForm('${d.username}')">EDIT</button>
        </div>`
    ).join('');
}

// ── Main render ────────────────────────────────────────────────────────────

function render() {
    const session  = window.LuxorAuth ? LuxorAuth.getSession() : null;
    const username = session?.username;

    const idleEl  = document.getElementById('do-idle');
    const cardEl  = document.getElementById('do-card');

    if (isAdmin) {
        renderAdminTable();
        // Admin sees their own card if they have one, otherwise idle
        const d = username ? getDossier(username) : null;
        if (d) {
            if (idleEl) idleEl.style.display = 'none';
            if (cardEl) { cardEl.style.display = ''; renderCard(d); }
        } else {
            if (idleEl) idleEl.style.display = '';
            if (cardEl) cardEl.style.display = 'none';
        }
        // Update status in admin panel
        const sb = document.getElementById('do-cfg-status');
        if (sb) sb.textContent = `DOSSIERS: ${dossiers.length} ON FILE`;
        return;
    }

    // Player view
    document.getElementById('do-admin-table').style.display = 'none';
    const d = username ? getDossier(username) : null;
    if (d) {
        if (idleEl) idleEl.style.display = 'none';
        if (cardEl) { cardEl.style.display = ''; renderCard(d); }
    } else {
        if (idleEl) idleEl.style.display = '';
        if (cardEl) cardEl.style.display = 'none';
    }
}

// ── Admin panel ────────────────────────────────────────────────────────────

function loadIntoForm(username) {
    const d = getDossier(username);
    if (!d) return;
    editingUser = username;

    const v  = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    const vs = (id, val) => { const el = document.getElementById(id); if (el) { const opt = Array.from(el.options).find(o => o.value === val); if (opt) el.value = val; } };

    v('do-f-username',  d.username);
    v('do-f-callsign',  d.callsign);
    v('do-f-realname',  d.realname);
    v('do-f-role',      d.role);
    vs('do-f-clearance',d.clearance || 'ALPHA');
    v('do-f-wounds',    d.wounds  ?? 0);
    v('do-f-fatigue',   d.fatigue ?? 0);
    v('do-f-bennies',   d.bennies ?? 3);
    v('do-f-edges',     d.edges     || '');
    v('do-f-equipment', d.equipment || '');
    v('do-f-notes',     d.notes     || '');

    ATTRS.forEach(a  => vs(`do-f-${a}`,  d.attrs?.[a]  || 'd6'));
    SKILLS.forEach(s => vs(`do-f-${s}`,  d.skills?.[s] || '—'));

    // Refresh select to show editing target
    const sel = document.getElementById('do-cfg-user-sel');
    if (sel) sel.value = username;
}

function readForm() {
    const g  = id => document.getElementById(id)?.value ?? '';
    const username = g('do-f-username').trim().toLowerCase();
    if (!username) return null;

    const d = {
        username,
        callsign:  g('do-f-callsign').trim().toUpperCase(),
        realname:  g('do-f-realname').trim(),
        role:      g('do-f-role').trim(),
        clearance: g('do-f-clearance'),
        wounds:    parseInt(g('do-f-wounds'))  || 0,
        fatigue:   parseInt(g('do-f-fatigue')) || 0,
        bennies:   parseInt(g('do-f-bennies')) || 3,
        edges:     g('do-f-edges').trim(),
        equipment: g('do-f-equipment').trim(),
        notes:     g('do-f-notes').trim(),
        attrs:  {},
        skills: {}
    };
    ATTRS.forEach(a  => { d.attrs[a]  = g(`do-f-${a}`); });
    SKILLS.forEach(s => { d.skills[s] = g(`do-f-${s}`); });
    return d;
}

function populateUserSelector() {
    const sel = document.getElementById('do-cfg-user-sel');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">— New Operator —</option>' +
        dossiers.map(d => `<option value="${d.username}">${d.username} (${d.callsign || '?'})</option>`).join('');
    if (prev) sel.value = prev;
}

function clearForm() {
    editingUser = null;
    ['do-f-username','do-f-callsign','do-f-realname','do-f-role','do-f-wounds','do-f-fatigue','do-f-edges','do-f-equipment','do-f-notes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('do-f-wounds').value  = '0';
    document.getElementById('do-f-fatigue').value = '0';
    document.getElementById('do-f-bennies').value = '3';
    document.getElementById('do-cfg-user-sel').value = '';
}

function initOverlordPanel() {
    const toggle = document.getElementById('do-ov-toggle');
    const panel  = document.getElementById('do-ov-panel');
    const close  = document.getElementById('do-ov-close');
    if (toggle) { toggle.style.display = ''; toggle.addEventListener('click', () => panel.classList.toggle('hidden')); }
    if (close)  close.addEventListener('click', () => panel.classList.add('hidden'));

    document.getElementById('do-cfg-user-sel')?.addEventListener('change', e => {
        const val = e.target.value;
        if (val) loadIntoForm(val);
        else clearForm();
    });

    document.getElementById('do-cfg-save')?.addEventListener('click', () => {
        const d = readForm();
        if (!d) return;
        const idx = dossiers.findIndex(x => x.username === d.username);
        if (idx >= 0) dossiers[idx] = d;
        else dossiers.push(d);
        saveDossiers();
        populateUserSelector();
        render();
    });

    document.getElementById('do-cfg-delete')?.addEventListener('click', () => {
        const username = document.getElementById('do-f-username')?.value.trim().toLowerCase();
        if (!username) return;
        if (!confirm(`Delete dossier for "${username}"?`)) return;
        dossiers = dossiers.filter(d => d.username !== username);
        saveDossiers();
        clearForm();
        populateUserSelector();
        render();
    });

    populateUserSelector();
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('storage', e => {
        if (e.key === DO_KEY) { dossiers = loadDossiers(); render(); }
    });

    if (window.LuxorAuth && LuxorAuth.isAdmin()) {
        isAdmin = true;
        initOverlordPanel();
    }

    render();
});
