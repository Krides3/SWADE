(function() {
    'use strict';

    // ── PUBLIC API (Attached to window early) ──────────────────────────

    window.createNewOp = function() {
        if (!window.convex) {
            alert("SYSTEM ERROR: CONVEX LIBRARY NOT LOADED.");
            return;
        }

        console.log("Creating new operator form...");
        selectedOpId = null;
        renderOpList();
        
        const opDetailEl = document.getElementById('op-detail');
        if (!opDetailEl) return;
        
        opDetailEl.innerHTML = `
            <h2 style="font-family:'Orbitron', sans-serif; color:var(--gold); margin-bottom:20px;">NEW OPERATOR</h2>
            <form id="op-form" class="op-form">
                <div class="form-group">
                    <label class="form-label">CALLSIGN</label>
                    <input type="text" id="op-callsign" class="form-input" required placeholder="e.g. GHOST">
                </div>
                <div class="form-group">
                    <label class="form-label">ROLE</label>
                    <select id="op-role" class="form-input">
                        <option value="player">SQUAD OPERATOR</option>
                        <option value="admin">HANDLER / ADMIN</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">CLEARANCE LEVEL (1-5)</label>
                    <input type="number" id="op-clearance" class="form-input" min="1" max="5" value="1">
                </div>
                <label class="form-checkbox">
                    <input type="checkbox" id="op-restricted" checked>
                    RESTRICT ACCESS TO BRIEFING TOOL ONLY
                </label>
                <button type="submit" class="btn-save">ENLIST OPERATOR</button>
            </form>
        `;

        const form = document.getElementById('op-form');
        if (form) form.onsubmit = handleCreate;
    };

    window.selectOp = function(id) {
        selectedOpId = id;
        renderOpList();
        renderOpDetail(id);
    };

    window.handleDelete = async function(id) {
        if (!confirm("CONFIRM DELETION: THIS OPERATOR WILL BE REMOVED FROM ALL SYSTEMS.")) return;
        try {
            await window.client.mutation("operators:remove", { id });
            selectedOpId = null;
            const opDetailEl = document.getElementById('op-detail');
            if (opDetailEl) {
                opDetailEl.innerHTML = '<div style="text-align:center; padding-top:100px; color:var(--text-dim);">SELECT AN OPERATOR TO MODIFY PERMISSIONS</div>';
            }
        } catch (err) {
            alert(err.message);
        }
    };

    // ── INITIALIZATION ─────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        if (!window.LuxorAuth || !LuxorAuth.requireAuth('login.html')) return;
        const session = LuxorAuth.getSession();

        // Access control: only admins
        if (!session || session.role !== 'admin') {
            window.location.replace('index.html');
            return;
        }

        if (typeof convex === 'undefined') {
            console.error("CRITICAL: Convex library not found.");
            const list = document.getElementById('op-list');
            if (list) list.innerHTML = '<div style="color:var(--danger); padding:20px;">SYSTEM ERROR: CONVEX OFFLINE</div>';
            return;
        }

        const CONVEX_URL = "https://focused-panda-809.eu-west-1.convex.cloud";
        window.client = new convex.ConvexClient(CONVEX_URL, { skipConvexDeploymentUrlCheck: true });

        init();
    });

    let allOperators = [];
    let selectedOpId = null;

    async function init() {
        if (!window.client) return;
        
        window.client.onUpdate("operators:list", {}, (operators) => {
            allOperators = operators;
            renderOpList();
            if (selectedOpId) renderOpDetail(selectedOpId);
        });
    }

    function renderOpList() {
        const opListEl = document.getElementById('op-list');
        if (!opListEl) return;
        
        if (allOperators.length === 0) {
            opListEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-dim);">ROSTER EMPTY</div>';
            return;
        }

        opListEl.innerHTML = allOperators.map(op => `
            <div class="operator-item ${selectedOpId === op._id ? 'active' : ''}" onclick="window.selectOp('${op._id}')">
                <div class="op-name">${op.callsign}</div>
                <div class="op-badge ${op.isRestricted ? 'badge-restricted' : 'badge-full'}">
                    ${op.isRestricted ? 'Restricted' : 'Full Access'}
                </div>
            </div>
        `).join('');
    }

    function renderOpDetail(id) {
        const opDetailEl = document.getElementById('op-detail');
        if (!opDetailEl) return;
        
        const op = allOperators.find(o => o._id === id);
        if (!op) return;

        opDetailEl.innerHTML = `
            <h2 style="font-family:'Orbitron', sans-serif; color:var(--gold); margin-bottom:20px;">MODIFY: ${op.callsign}</h2>
            <form id="op-form" class="op-form">
                <div class="form-group">
                    <label class="form-label">ROLE</label>
                    <select id="op-role" class="form-input">
                        <option value="player" ${op.role === 'player' ? 'selected' : ''}>SQUAD OPERATOR</option>
                        <option value="admin" ${op.role === 'admin' ? 'selected' : ''}>HANDLER / ADMIN</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">CLEARANCE LEVEL (1-5)</label>
                    <input type="number" id="op-clearance" class="form-input" min="1" max="5" value="${op.clearance}">
                </div>
                <label class="form-checkbox">
                    <input type="checkbox" id="op-restricted" ${op.isRestricted ? 'checked' : ''}>
                    RESTRICT ACCESS TO BRIEFING TOOL ONLY
                </label>
                <button type="submit" class="btn-save">UPDATE PERMISSIONS</button>
            </form>
            
            ${op.callsign !== 'OVERLORD' ? `
                <button class="btn-delete" onclick="handleDelete('${op._id}')">TERMINATE ACCESS (DELETE)</button>
            ` : ''}
        `;

        const form = document.getElementById('op-form');
        if (form) form.onsubmit = (e) => handleUpdate(e, id);
    }

    async function handleCreate(e) {
        e.preventDefault();
        const callsign = document.getElementById('op-callsign').value;
        const role = document.getElementById('op-role').value;
        const clearance = parseInt(document.getElementById('op-clearance').value, 10);
        const isRestricted = document.getElementById('op-restricted').checked;

        try {
            await window.client.mutation("operators:create", { callsign, role, clearance, isRestricted });
            const opDetailEl = document.getElementById('op-detail');
            if (opDetailEl) {
                opDetailEl.innerHTML = '<div style="text-align:center; padding-top:100px; color:var(--text-dim);">OPERATOR ENLISTED. SELECT FROM LIST TO MODIFY.</div>';
            }
        } catch (err) {
            alert(err.message);
        }
    }

    async function handleUpdate(e, id) {
        e.preventDefault();
        const role = document.getElementById('op-role').value;
        const clearance = parseInt(document.getElementById('op-clearance').value, 10);
        const isRestricted = document.getElementById('op-restricted').checked;

        try {
            await window.client.mutation("operators:update", { id, role, clearance, isRestricted });
            alert("PERMISSIONS UPDATED");
        } catch (err) {
            alert(err.message);
        }
    }
})();

