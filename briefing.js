(function() {
    'use strict';

    if (!LuxorAuth.requireAuth('login.html')) return;

    const session = LuxorAuth.getSession();
    const isHandler = session.role === 'admin';

    // State
    let currentMissions = [];
    let currentOperators = [];
    let activeMissionId = null;

    // DOM Elements
    const missionListEl = document.getElementById('mission-list');
    const detailEl      = document.getElementById('mission-detail');
    const modalEl       = document.getElementById('mission-modal');
    const missionForm   = document.getElementById('mission-form');
    const opListEl      = document.getElementById('op-list');
    const leaderSelect  = document.getElementById('mission-leader');

    // ── INITIALIZATION ─────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', async () => {
        if (typeof convex === 'undefined') {
            missionListEl.innerHTML = '<div class="mission-meta" style="color:var(--danger);">CONVEX OFFLINE</div>';
            return;
        }

        const CONVEX_URL = "https://focused-panda-809.eu-west-1.convex.cloud";
        window.client = new convex.ConvexClient(CONVEX_URL, { skipConvexDeploymentUrlCheck: true });

        if (isHandler) {
            addCreateButton();
        }

        init();
    });

    async function init() {
        if (!window.client) return;

        // 1. Fetch Operators
        try {
            currentOperators = await window.client.query("operators:list");
            renderOperatorSelectors();
        } catch (e) {
            console.error("Failed to fetch operators", e);
        }

        // 2. Subscribe to Missions
        window.client.onUpdate("missions:listVisible", { userCallsign: session.username }, (missions) => {
            currentMissions = missions;
            renderMissionList();
            
            if (activeMissionId) {
                const updated = missions.find(m => m._id === activeMissionId);
                if (updated) viewMission(activeMissionId, false); // false = don't reset decrypting msg
            }
        });
    }

    // ── UI RENDERING ───────────────────────────────────────────────

    function addCreateButton() {
        const headerLeft = document.querySelector('.page-header > div > div:first-child');
        if (!headerLeft) return;
        
        const btn = document.createElement('button');
        btn.className = 'btn-action';
        btn.style.marginTop = '15px';
        btn.style.display = 'block';
        btn.textContent = '+ NEW MISSION BRIEF';
        btn.onclick = () => window.openModal();
        headerLeft.appendChild(btn);
    }

    function renderOperatorSelectors() {
        const squadOps = currentOperators.filter(op => op.role === 'player');
        
        opListEl.innerHTML = squadOps.map(op => `
            <label class="op-checkbox">
                <input type="checkbox" name="operators" value="${op._id}">
                ${op.callsign}
            </label>
        `).join('');

        leaderSelect.innerHTML = '<option value="">-- UNASSIGNED --</option>' + 
            squadOps.map(op => `<option value="${op._id}">${op.callsign}</option>`).join('');
    }

    function renderMissionList() {
        if (currentMissions.length === 0) {
            missionListEl.innerHTML = '<div class="mission-meta" style="text-align:center; padding:20px;">NO ACTIVE MISSIONS</div>';
            return;
        }

        missionListEl.innerHTML = currentMissions.map(m => `
            <div class="mission-item ${activeMissionId === m._id ? 'active' : ''}" onclick="window.viewMission('${m._id}')">
                <div class="mission-title">${m.name}</div>
                <div class="mission-meta">${m.location || 'UNKNOWN LOC'} | ${m.handler}</div>
            </div>
        `).join('');
    }

    window.viewMission = async function(id, showLoading = true) {
        activeMissionId = id;
        renderMissionList();
        
        if (showLoading) {
            detailEl.innerHTML = '<div class="mission-meta" style="text-align:center; padding:100px;">DECRYPTING TACTICAL DATA...</div>';
        }
        
        try {
            const mission = await window.client.query("missions:getDetails", { missionId: id });
            if (!mission) return;

            const isLeader = mission.leader && currentOperators.find(o => o._id === mission.leader)?.callsign === session.username;
            const canEdit = isHandler && mission.handler === session.username;
            const canAssign = canEdit || isLeader;

            detailEl.innerHTML = `
                ${canEdit ? `
                <div class="handler-controls">
                    <button class="btn-action" onclick="window.addObjectivePrompt('${mission._id}')">ADD OBJ</button>
                    <button class="btn-action" onclick="window.addIntelPrompt('${mission._id}')">INTEL DROP</button>
                    <button class="btn-action" onclick="window.openModal('${mission._id}')">EDIT</button>
                </div>` : ''}
                
                <div class="briefing-header">
                    <div class="briefing-name">${mission.name}</div>
                    <div class="briefing-info-row">
                        <div>
                            <div class="info-label">DATE</div>
                            <div class="info-value">${mission.date || 'TBD'}</div>
                        </div>
                        <div>
                            <div class="info-label">LOCATION</div>
                            <div class="info-value">${mission.location || 'CLASSIFIED'}</div>
                        </div>
                        <div>
                            <div class="info-label">HANDLER</div>
                            <div class="info-value">${mission.handler}</div>
                        </div>
                        <div>
                            <div class="info-label">STATUS</div>
                            <div class="info-value" style="color:var(--gold);">${mission.status}</div>
                        </div>
                    </div>
                </div>

                <div class="tactical-layout" style="display:grid; grid-template-columns: 1fr 300px; gap:30px;">
                    <div class="tactical-main">
                        ${mission.mapUrl ? `
                            <div class="tactical-map" style="margin-bottom:30px; border:1px solid var(--border);">
                                <div class="info-label" style="background:var(--bg-panel); padding:5px 10px; border-bottom:1px solid var(--border);">SATELLITE IMAGERY / AO MAP</div>
                                <img src="${mission.mapUrl}" style="width:100%; display:block; filter: sepia(0.5) hue-rotate(140deg) brightness(0.8) contrast(1.2);">
                            </div>
                        ` : ''}
                        
                        <div class="briefing-text" style="margin-top:0;">
                            <div class="info-label" style="border-bottom:1px solid var(--border); margin-bottom:15px; padding-bottom:5px;">SITUATION & ORDERS</div>
                            ${mission.briefing}
                        </div>
                    </div>

                    <div class="tactical-side">
                        <div class="tactical-section" style="margin-bottom:30px;">
                            <div class="info-label">OPERATIONAL SQUAD</div>
                            <div class="info-value" style="font-size:0.9rem; margin-top:5px;">
                                <div style="color:var(--gold); margin-bottom:5px;">TL: ${mission.leaderName || 'UNASSIGNED'}</div>
                                <div style="color:var(--text); font-size:0.8rem; display:flex; flex-direction:column; gap:5px;">
                                    ${mission.operatorList.map(o => {
                                        const assignment = mission.assignments?.find(a => a.operatorId === o.id);
                                        const role = assignment?.assignedRole || 'UNASSIGNED';
                                        const isReady = assignment?.isReady ? '<span style="color:var(--cyan)">[READY]</span>' : '<span style="color:var(--gold-dim)">[STANDBY]</span>';
                                        return `
                                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:3px;">
                                                <span>◈ ${o.callsign} 
                                                    <span style="font-size:0.6rem; color:var(--text-dim); margin-left:5px; ${canEdit ? 'cursor:pointer; border-bottom:1px dashed var(--gold-dim);' : ''}" 
                                                          ${canEdit ? `onclick="window.promptAssignment('${mission._id}', '${o.id}', '${o.callsign}', '${role}')"` : ''}>
                                                        ${role}
                                                    </span>
                                                </span>
                                                ${isReady}
                                            </div>
                                        `;
                                    }).join('') || 'NONE'}
                                </div>
                                ${!isHandler ? `
                                    <button class="btn-action" style="width:100%; margin-top:10px; font-size:0.65rem;" onclick="window.toggleReady('${mission._id}')">TOGGLE READINESS</button>
                                ` : ''}
                            </div>
                        </div>

                        <div class="tactical-section" style="margin-bottom:30px;">
                            <div class="info-label">OBJECTIVES</div>

                            <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
                                ${mission.objectives?.length > 0 
                                    ? mission.objectives.map((obj, idx) => `
                                        <div style="font-size:0.75rem; display:flex; gap:8px; align-items:flex-start; ${canEdit ? 'cursor:pointer;' : ''}" 
                                             ${canEdit ? `onclick="window.toggleObjective('${mission._id}', ${idx})"` : ''}>
                                            <span style="color:${obj.status === 'COMPLETED' ? 'var(--cyan)' : obj.status === 'FAILED' ? 'var(--danger)' : 'var(--gold-dim)'};">
                                                ${obj.status === 'COMPLETED' ? '☑' : obj.status === 'FAILED' ? '☒' : '☐'}
                                            </span>
                                            <span style="${obj.status === 'COMPLETED' ? 'text-decoration:line-through; opacity:0.6;' : ''}">${obj.text}</span>
                                        </div>
                                    `).join('')
                                    : '<div class="mission-meta">NO DATA</div>'
                                }
                            </div>
                        </div>

                        <div class="tactical-section">
                            <div class="info-label">INTEL DROPS</div>
                            <div id="intel-feed" style="margin-top:10px; display:flex; flex-direction:column; gap:12px; max-height:400px; overflow-y:auto; border-left:1px solid var(--border); padding-left:10px;">
                                ${mission.intelDrops?.length > 0
                                    ? mission.intelDrops.map(drop => `
                                        <div style="font-family:'Share Tech Mono', monospace; font-size:0.7rem;">
                                            <div style="color:var(--purple-bright); font-size:0.6rem;">[${drop.timestamp}] FROM: ${drop.source}</div>
                                            <div style="color:var(--text); margin-top:3px;">${drop.text}</div>
                                        </div>
                                    `).reverse().join('')
                                    : '<div class="mission-meta">WAITING FOR HQ...</div>'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {
            console.error(e);
            detailEl.innerHTML = '<div class="mission-meta" style="text-align:center; padding:100px; color:var(--danger);">ERROR RETRIEVING DATA</div>';
        }
    };

    window.promptAssignment = async function(missionId, operatorId, callsign, currentRole) {
        if (!isHandler) return;
        const role = prompt(`ASSIGN ROLE FOR ${callsign}:`, currentRole === 'UNASSIGNED' ? '' : currentRole);
        if (role === null) return; // Cancelled
        
        try {
            await window.client.mutation("missions:setAssignment", { 
                missionId, 
                operatorId, 
                assignedRole: role ? role.toUpperCase() : "UNASSIGNED",
                loadout: "STANDARD" // Placeholder for future loadout editor
            });
        } catch (e) {
            alert(e.message);
        }
    };

    window.toggleReady = async function(missionId) {
        try {
            await window.client.mutation("missions:toggleReady", { 
                missionId, 
                userCallsign: session.username 
            });
        } catch (e) {
            alert(e.message);
        }
    };

    window.addIntelPrompt = async function(missionId) {
        const text = prompt("ENTER INTEL DATA:");
        if (!text) return;
        const source = prompt("ENTER SOURCE (HQ/FIELD/SIGNAL):", "HQ") || "HQ";
        
        try {
            await window.client.mutation("missions:addIntel", { missionId, text, source: source.toUpperCase() });
        } catch (e) {
            alert(e.message);
        }
    };

    window.addObjectivePrompt = async function(missionId) {
        const text = prompt("ENTER OBJECTIVE DESCRIPTION:");
        if (!text) return;
        
        try {
            const mission = currentMissions.find(m => m._id === missionId);
            const currentObjs = mission.objectives || [];
            await window.client.mutation("missions:updateObjectives", { 
                missionId, 
                objectives: [...currentObjs, { text, status: "PENDING" }] 
            });
        } catch (e) {
            alert(e.message);
        }
    };

    window.toggleObjective = async function(missionId, index) {
        if (!isHandler) return;
        
        try {
            const mission = currentMissions.find(m => m._id === missionId);
            if (!mission) return;
            const updated = [...(mission.objectives || [])];
            const currentStatus = updated[index].status;
            
            if (currentStatus === "PENDING") updated[index].status = "COMPLETED";
            else if (currentStatus === "COMPLETED") updated[index].status = "FAILED";
            else updated[index].status = "PENDING";

            await window.client.mutation("missions:updateObjectives", { missionId, objectives: updated });
        } catch (e) {
            alert(e.message);
        }
    };

    window.openModal = function(id = null) {
        modalEl.style.display = 'flex';
        missionForm.reset();
        document.getElementById('edit-id').value = id || '';
        document.getElementById('modal-title').textContent = id ? 'EDIT BRIEFING' : 'NEW BRIEFING';

        if (id) {
            const mission = currentMissions.find(m => m._id === id);
            if (mission) {
                document.getElementById('mission-name').value = mission.name;
                document.getElementById('mission-location').value = mission.location || '';
                document.getElementById('mission-map').value = mission.mapUrl || '';
                document.getElementById('mission-date').value = mission.date || '';
                document.getElementById('mission-leader').value = mission.leader || '';
                document.getElementById('mission-briefing').value = mission.briefing;
                
                const checkboxes = opListEl.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    cb.checked = mission.operators.includes(cb.value);
                });
            }
        }
    };

    missionForm.onsubmit = async (e) => {
        e.preventDefault();
        const id       = document.getElementById('edit-id').value;
        const name     = document.getElementById('mission-name').value;
        const location = document.getElementById('mission-location').value;
        const mapUrl   = document.getElementById('mission-map').value;
        const date     = document.getElementById('mission-date').value;
        const leader   = document.getElementById('mission-leader').value || undefined;
        const briefing = document.getElementById('mission-briefing').value;
        
        const selectedOps = Array.from(opListEl.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

        try {
            if (id) {
                await window.client.mutation("missions:update", {
                    missionId: id,
                    name, briefing, location, mapUrl, date, leader,
                    operators: selectedOps,
                    handler: session.username
                });
            } else {
                await window.client.mutation("missions:create", {
                    name, briefing, location, mapUrl, date, leader,
                    operators: selectedOps,
                    handler: session.username
                });
            }
            modalEl.style.display = 'none';
        } catch (e) {
            alert(e.message);
        }
    };
})();
