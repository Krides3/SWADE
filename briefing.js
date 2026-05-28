(function() {
    'use strict';

    if (!LuxorAuth.requireAuth('login.html')) return;

    const session = LuxorAuth.getSession();
    const isHandler = session.role === 'admin';

    // State
    let currentMissions = [];
    let currentOperators = [];
    let myLoadouts = [];
    let activeMissionId = null;
    let detailUnsubscribe = null;
    let currentTab = 'briefing';

    // DOM Elements
    const missionListEl = document.getElementById('mission-list');
    const detailEl      = document.getElementById('mission-detail');
    const modalEl       = document.getElementById('mission-modal');
    const missionForm   = document.getElementById('mission-form');
    const opListEl      = document.getElementById('op-list');
    const leaderSelect  = document.getElementById('mission-leader');

    const loadoutModalEl = document.getElementById('loadout-modal');
    const loadoutListEl  = document.getElementById('loadout-list');
    const loadoutForm    = document.getElementById('loadout-form');

    const planModalEl    = document.getElementById('plan-modal');
    const planForm       = document.getElementById('plan-form');
    const planContentEl  = document.getElementById('plan-content');
    
    const handlerImgModalEl = document.getElementById('handler-images-modal');
    const handlerImgForm    = document.getElementById('handler-images-form');

    const sectionModalEl   = document.getElementById('section-modal');
    const sectionForm      = document.getElementById('section-form');
    const sectionContentEl = document.getElementById('section-content');

    // ── INITIALIZATION ─────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', async () => {
        if (typeof convex === 'undefined') {
            missionListEl.innerHTML = '<div class="mission-meta" style="color:var(--danger);">CONVEX OFFLINE</div>';
            return;
        }

        // Configure Marked for tactical use
        if (typeof marked !== 'undefined' && marked.setOptions) {
            marked.setOptions({
                gfm: true,
                breaks: true,
                headerIds: false,
                mangle: false
            });
        }

        const CONVEX_URL = "https://focused-panda-809.eu-west-1.convex.cloud";
        window.client = new convex.ConvexClient(CONVEX_URL, { skipConvexDeploymentUrlCheck: true });

        // Prevents duplication from script double-loads
        if (isHandler && !document.getElementById('create-mission-btn')) {
            addCreateButton();
        }

        setupEventListeners();
        init();
    });

    async function init() {
        if (!window.client) return;

        // 1. Fetch Operators
        try {
            currentOperators = await window.client.query("operators:list");
            renderOperatorSelectors();

            // Fetch current user's record to get their ID for loadouts
            const me = currentOperators.find(o => o.callsign === session.username);
            if (me) {
                fetchMyLoadouts(me._id);
            }
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

    function setupEventListeners() {
        // Tab switching
        window.switchTab = function(tab) {
            currentTab = tab;
            if (activeMissionId) {
                viewMission(activeMissionId, false);
            }
        };

        // Plan Form Submit
        planForm.onsubmit = async (e) => {
            e.preventDefault();
            const missionId = document.getElementById('plan-mission-id').value;
            const content = planContentEl.value;
            const files = document.getElementById('plan-images-input').files;

            try {
                // 1. Update text plan
                await window.client.mutation("missions:updateLeaderPlan", {
                    missionId,
                    leaderPlan: content,
                    userCallsign: session.username
                });

                // 2. Upload images if any
                if (files.length > 0) {
                    const mission = currentMissions.find(m => m._id === missionId);
                    const currentImages = mission.leaderImages || [];
                    const newIds = await uploadFiles(files);
                    
                    await window.client.mutation("missions:updateMissionImages", {
                        missionId,
                        images: [...currentImages, ...newIds],
                        type: 'leader',
                        userCallsign: session.username
                    });
                }

                planModalEl.style.display = 'none';
            } catch (e) {
                alert(e.message);
            }
        };

        // Handler Images Submit
        handlerImgForm.onsubmit = async (e) => {
            e.preventDefault();
            const missionId = document.getElementById('handler-mission-id').value;
            const files = document.getElementById('handler-images-input').files;

            try {
                const mission = currentMissions.find(m => m._id === missionId);
                const currentImages = mission.handlerImages || [];
                const newIds = await uploadFiles(files);
                
                await window.client.mutation("missions:updateMissionImages", {
                    missionId,
                    images: [...currentImages, ...newIds],
                    type: 'handler',
                    userCallsign: session.username
                });

                handlerImgModalEl.style.display = 'none';
            } catch (e) {
                alert(e.message);
            }
        };
    }

    async function uploadFiles(files) {
        const ids = [];
        for (const file of files) {
            const postUrl = await window.client.mutation("missions:generateUploadUrl");
            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });
            const { storageId } = await result.json();
            ids.push(storageId);
        }
        return ids;
    }

    async function fetchMyLoadouts(operatorId) {
        try {
            myLoadouts = await window.client.query("operators:listLoadouts", { operatorId });
            renderLoadoutManager();
        } catch (e) {
            console.error("Failed to fetch loadouts", e);
        }
    }

    // ── LOADOUT MANAGEMENT ────────────────────────────────────────

    window.openLoadoutManager = function() {
        loadoutModalEl.style.display = 'flex';
        renderLoadoutManager();
    };

    function renderLoadoutManager() {
        if (myLoadouts.length === 0) {
            loadoutListEl.innerHTML = '<div class="mission-meta" style="text-align:center; padding:10px;">NO SAVED LOADOUTS</div>';
        } else {
            loadoutListEl.innerHTML = myLoadouts.map(l => `
                <div style="background:rgba(255,255,255,0.05); border:1px solid var(--border); padding:10px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="color:var(--gold); font-weight:bold; font-size:0.9rem;">${l.name}</div>
                        <div style="font-size:0.6rem; color:var(--text-dim); margin-top:3px;">${l.content.substring(0, 50)}...</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-action" style="padding:4px 8px; font-size:0.6rem;" onclick="window.editLoadout('${l._id}')">EDIT</button>
                        <button class="btn-action" style="padding:4px 8px; font-size:0.6rem; border-color:var(--danger); color:var(--danger);" onclick="window.deleteLoadout('${l._id}')">DELETE</button>
                    </div>
                </div>
            `).join('');
        }
    }

    window.editLoadout = function(id) {
        const loadout = myLoadouts.find(l => l._id === id);
        if (!loadout) return;
        document.getElementById('loadout-id').value = loadout._id;
        document.getElementById('loadout-name').value = loadout.name;
        document.getElementById('loadout-content').value = loadout.content;
    };

    window.deleteLoadout = async function(id) {
        if (!confirm("PERMANENTLY DELETE THIS LOADOUT?")) return;
        try {
            await window.client.mutation("operators:deleteLoadout", { id });
            const me = currentOperators.find(o => o.callsign === session.username);
            if (me) fetchMyLoadouts(me._id);
        } catch (e) {
            alert(e.message);
        }
    };

    loadoutForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('loadout-id').value || undefined;
        const name = document.getElementById('loadout-name').value;
        const content = document.getElementById('loadout-content').value;
        const me = currentOperators.find(o => o.callsign === session.username);
        
        if (!me) return;

        try {
            await window.client.mutation("operators:saveLoadout", {
                id,
                operatorId: me._id,
                name,
                content
            });
            loadoutForm.reset();
            document.getElementById('loadout-id').value = '';
            fetchMyLoadouts(me._id);
        } catch (e) {
            alert(e.message);
        }
    };

    // ── UI RENDERING ───────────────────────────────────────────────

    function addCreateButton() {
        if (!missionListEl) return;

        // Remove existing if any
        const existing = document.getElementById('create-mission-btn');
        if (existing) existing.remove();

        const btn = document.createElement('button');
        btn.id = 'create-mission-btn';
        btn.className = 'btn-action';
        btn.style.width = '100%';
        btn.style.marginTop = '15px';
        btn.style.display = 'block';
        btn.textContent = '+ NEW MISSION BRIEF';
        btn.onclick = () => window.openModal();
        missionListEl.appendChild(btn);
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
            if (isHandler) addCreateButton();
            return;
        }

        missionListEl.innerHTML = currentMissions.map(m => `
            <div class="mission-item ${activeMissionId === m._id ? 'active' : ''}" onclick="window.viewMission('${m._id}')">
                <div class="mission-title">${m.name}</div>
                <div class="mission-meta">${m.location || 'UNKNOWN LOC'} | ${m.handler}</div>
            </div>
        `).join('');

        if (isHandler) addCreateButton();
    }
    function parseTacticalMarkdown(content) {
        if (!content) return '<div style="color:var(--text-dim); font-style:italic; font-size:0.85rem;">DATA PENDING...</div>';
        
        if (typeof marked !== 'undefined') {
            return typeof marked.parse === 'function' ? marked.parse(content) : marked(content);
        }
        
        return `<pre style="font-family:inherit; white-space:pre-wrap; margin:0; font-size:1.1rem;">${content}</pre>`;
    }

    function renderSection(id, key, title, content, canEdit) {
        const htmlContent = parseTacticalMarkdown(content);
        
        return `
            <div class="briefing-section">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(184,168,0,0.3); margin-bottom:10px; padding-bottom:5px;">
                    <div class="info-label" style="margin-bottom:0; font-size:0.85rem;">${title}</div>
                    ${canEdit ? `<button class="btn-action" style="padding:4px 10px; font-size:0.6rem; height:auto;" onclick="window.openSectionEditor('${id}', '${key}', '${title}')">EDIT</button>` : ''}
                </div>
                <div class="briefing-content" style="${key === 'mission' ? 'color:var(--gold); border-left:4px solid var(--gold); font-weight:bold;' : ''}">${htmlContent}</div>
            </div>
        `;
    }

    function renderGallery(images, canDelete, missionId, type) {
        if (!images || images.length === 0) return '';
        
        return `
            <div class="tactical-gallery">
                ${images.map((url, idx) => `
                    <div class="tactical-img-container">
                        <img src="${url}" onclick="window.open('${url}', '_blank')">
                        ${canDelete ? `<button class="image-delete-btn" onclick="window.deleteMissionImage('${missionId}', ${idx}, '${type}')">REMOVE</button>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    window.deleteMissionImage = async function(missionId, index, type) {
        if (!confirm("REMOVE THIS TACTICAL IMAGE?")) return;
        
        try {
            const mission = currentMissions.find(m => m._id === missionId);
            const currentImages = (type === 'handler') ? [...(mission.handlerImages || [])] : [...(mission.leaderImages || [])];
            currentImages.splice(index, 1);
            
            await window.client.mutation("missions:updateMissionImages", {
                missionId,
                images: currentImages,
                type,
                userCallsign: session.username
            });
        } catch (e) {
            alert(e.message);
        }
    };

    window.viewMission = async function(id, showLoading = true) {
        if (activeMissionId === id && !showLoading) {
            // Re-render based on currentTab without full refresh
            const mission = currentMissions.find(m => m._id === id);
            if (mission) {
                // Fetch full details if not already present or if we need resolved URLs
                // For simplicity, we'll let the subscription handle it
            }
        }

        activeMissionId = id;
        renderMissionList();
        
        if (detailUnsubscribe) {
            detailUnsubscribe();
            detailUnsubscribe = null;
        }

        if (showLoading) {
            detailEl.innerHTML = '<div class="mission-meta" style="text-align:center; padding:100px; font-size:1rem;">DECRYPTING TACTICAL DATA...</div>';
        }
        
        detailUnsubscribe = window.client.onUpdate("missions:getDetails", { missionId: id }, (mission) => {
            if (!mission) {
                detailEl.innerHTML = '<div class="mission-meta" style="text-align:center; padding:100px; color:var(--danger);">MISSION RECORD DELETED OR NOT FOUND</div>';
                return;
            }

            const isLeader = mission.leader && currentOperators.find(o => o._id === mission.leader)?.callsign === session.username;
            const canEdit = isHandler && mission.handler === session.username;
            const canAssign = canEdit || isLeader;

            console.log("Rendering mission details for ID:", mission._id);
            detailEl.innerHTML = `
                <div class="handler-controls">
                    <a href="./cheatsheet.html?id=${mission._id}" 
                       target="_blank" 
                       class="btn-action" 
                       style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center;"
                       onclick="localStorage.setItem('luxor_last_mission_id', '${mission._id}')">
                        CHEAT SHEET
                    </a>
                    ${canEdit ? `
                    <button class="btn-action" style="border-color:var(--danger); color:var(--danger);" onclick="window.deleteMission('${mission._id}')">DELETE</button>
                    <button class="btn-action" onclick="window.exportToClipboard('${mission._id}')">EXPORT</button>
                    <button class="btn-action" onclick="window.addObjectivePrompt('${mission._id}')">ADD OBJ</button>
                    <button class="btn-action" onclick="window.openModal('${mission._id}')">EDIT INFO</button>
                    ` : ''}
                </div>
                
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

                    ${mission.modlistUrl ? `
                    <div class="modlist-container">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div class="info-label" style="margin-bottom:0;">ARMA 3 MODLIST:</div>
                            <div class="modlist-status-badge ${mission.modlistStatus === 'FINAL' ? 'modlist-status-final' : 'modlist-status-wip'}">
                                ${mission.modlistStatus || 'WIP'}
                            </div>
                        </div>
                        <button class="btn-action" style="padding:6px 12px; font-size:0.7rem;" onclick="window.downloadModlist('${mission.modlistUrl}', '${mission.name}')">DOWNLOAD .HTML</button>
                    </div>
                    ` : ''}
                </div>

                <div class="tactical-layout" style="display:grid; grid-template-columns: 1fr 320px; gap:35px;">
                    <div class="tactical-main">
                        <div style="display:flex; gap:10px; margin-bottom:20px;">
                            <button class="subtab ${currentTab === 'briefing' ? 'active' : ''}" onclick="window.switchTab('briefing')">BRIEFING</button>
                            <button class="subtab ${currentTab === 'plan' ? 'active' : ''}" onclick="window.switchTab('plan')">TACTICAL PLAN</button>
                        </div>
                        
                        ${currentTab === 'briefing' ? `
                            <div class="tactical-intel-section" style="margin-bottom:30px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(184,168,0,0.3); padding-bottom:5px; margin-bottom:15px;">
                                    <div class="info-label" style="margin-bottom:0; font-size:0.85rem;">AO IMAGERY / INTEL</div>
                                    ${canEdit ? `<button class="btn-action" style="padding:4px 10px; font-size:0.6rem;" onclick="window.openHandlerImgModal('${mission._id}')">UPLOAD INTEL</button>` : ''}
                                </div>
                                
                                ${mission.mapUrl ? `
                                    <div class="tactical-map" style="margin-bottom:15px; border:1px solid var(--border);">
                                        <div class="info-label" style="background:var(--bg-panel); padding:6px 10px; border-bottom:1px solid var(--border); font-size:0.6rem; color:var(--text-dim);">SATELLITE IMAGERY / AO MAP</div>
                                        <img src="${mission.mapUrl}" style="width:100%; display:block; filter: sepia(0.4) hue-rotate(140deg) brightness(0.9) contrast(1.1);">
                                    </div>
                                ` : ''}
                                
                                ${renderGallery(mission.handlerImageUrls, canEdit, mission._id, 'handler')}
                            </div>
                            
                            <div class="briefing-text">
                                ${typeof mission.briefing === 'string' ? `
                                    <div style="color:var(--danger); font-size:0.8rem; margin-bottom:12px; font-weight:bold;">[ LEGACY FORMAT DETECTED — RE-SAVE MISSION TO CONVERT ]</div>
                                    <div class="briefing-content" style="border:1px dashed var(--gold); padding:20px; background:rgba(184,168,0,0.05);">${parseTacticalMarkdown(mission.briefing)}</div>
                                ` : `
                                    ${renderSection(mission._id, 'situation', 'I. SITUATION', mission.briefing.situation, canEdit)}
                                    ${renderSection(mission._id, 'mission', 'II. MISSION', mission.briefing.mission, canEdit)}
                                    ${renderSection(mission._id, 'execution', 'III. EXECUTION', mission.briefing.execution, canEdit)}
                                    ${renderSection(mission._id, 'logistics', 'IV. LOGISTICS', mission.briefing.logistics, canEdit)}
                                    ${renderSection(mission._id, 'command', 'V. COMMAND & SIGNAL', mission.briefing.command, canEdit)}
                                `}
                            </div>
                        ` : `
                            <div class="tactical-plan-view">
                                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(184,168,0,0.3); padding-bottom:5px; margin-bottom:15px;">
                                    <div class="info-label" style="margin-bottom:0; font-size:0.85rem;">TACTICAL APPROACH / MISSION PLAN</div>
                                    ${(isLeader || canEdit) ? `<button class="btn-action" style="padding:4px 10px; font-size:0.6rem;" onclick="window.openPlanEditor('${mission._id}', \`${mission.leaderPlan || ''}\`)">EDIT PLAN</button>` : ''}
                                </div>
                                <div class="briefing-content" style="border-color:var(--gold);">${parseTacticalMarkdown(mission.leaderPlan)}</div>
                                
                                <div class="tactical-images" style="margin-top:30px;">
                                    <div class="info-label" style="font-size:0.85rem; border-bottom:1px solid rgba(184,168,0,0.3); padding-bottom:5px;">PLANNING DIAGRAMS & INTEL</div>
                                    ${renderGallery(mission.leaderImageUrls, (isLeader || canEdit), mission._id, 'leader')}
                                </div>
                            </div>
                        `}
                    </div>

                    <div class="tactical-side">
                        <div class="tactical-section" style="margin-bottom:35px;">
                            <div class="info-label" style="font-size:0.9rem; border-bottom:1px solid var(--gold-dim); padding-bottom:5px;">OPERATIONAL SQUAD</div>
                            <div class="info-value" style="font-size:1rem; margin-top:10px;">
                                <div style="color:var(--gold); margin-bottom:10px; font-weight:bold;">TL: ${mission.leaderName || 'UNASSIGNED'}</div>
                                <div style="color:var(--text); font-size:0.9rem; display:flex; flex-direction:column; gap:10px;">
                                    ${mission.operatorList.map(o => {
                                        const assignment = mission.assignments?.find(a => a.operatorId === o.id);
                                        const role = assignment?.assignedRole || 'UNASSIGNED';
                                        const isReady = assignment?.isReady ? '<span style="color:var(--cyan); font-weight:bold;">[READY]</span>' : '<span style="color:var(--gold-dim); opacity:0.7;">[STANDBY]</span>';
                                        const prefs = o.preferredRoles?.length > 0 ? o.preferredRoles.join(' / ') : 'NONE SET';
                                        
                                        return `
                                            <div style="border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px;">
                                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                                    <span style="font-weight:600;">◈ ${o.callsign} 
                                                        <span class="role-badge" 
                                                              style="${canAssign ? 'cursor:pointer; border-bottom:1px dashed var(--gold-glow);' : ''}" 
                                                              ${canAssign ? `onclick="window.promptAssignment('${mission._id}', '${o.id}', '${o.callsign}', '${role}', '${prefs}')"` : ''}>
                                                            ${role}
                                                        </span>
                                                        ${(assignment?.loadout && assignment.loadout !== 'STANDARD') ? `
                                                            <button class="btn-action" 
                                                                    style="padding:2px 6px; font-size:0.55rem; margin-left:10px; height:auto; border-color:var(--cyan); color:var(--cyan);" 
                                                                    onclick="window.copyLoadoutToClipboard(\`${assignment.loadout}\`)">
                                                                COPY LOADOUT
                                                            </button>
                                                        ` : ''}
                                                    </span>
                                                    ${isReady}
                                                </div>
                                                <div class="pref-text">PREF: ${prefs}</div>
                                            </div>
                                        `;
                                    }).join('') || 'NONE'}
                                </div>
                                ${!isHandler ? `
                                    <button class="btn-action" style="width:100%; margin-top:15px; font-size:0.75rem;" onclick="window.toggleReady('${mission._id}')">TOGGLE READINESS</button>
                                ` : ''}
                            </div>
                        </div>

                        <div class="tactical-section">
                            <div class="info-label" style="font-size:0.9rem; border-bottom:1px solid var(--gold-dim); padding-bottom:5px;">OBJECTIVES</div>

                            <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
                                ${mission.objectives?.length > 0 
                                    ? mission.objectives.map((obj, idx) => `
                                        <div style="font-size:0.9rem; display:flex; gap:10px; align-items:flex-start; ${canEdit ? 'cursor:pointer;' : ''}" 
                                             ${canEdit ? `onclick="window.toggleObjective('${mission._id}', ${idx})"` : ''}>
                                            <span style="color:${obj.status === 'COMPLETED' ? 'var(--cyan)' : obj.status === 'FAILED' ? 'var(--danger)' : 'var(--gold-dim)'}; font-size:1rem;">
                                                ${obj.status === 'COMPLETED' ? '☑' : obj.status === 'FAILED' ? '☒' : '☐'}
                                            </span>
                                            <span style="${obj.status === 'COMPLETED' ? 'text-decoration:line-through; opacity:0.6;' : ''}; margin-top:2px;">${obj.text}</span>
                                        </div>
                                    `).join('')
                                    : '<div class="mission-meta" style="font-size:0.85rem;">NO DATA</div>'
                                }
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    };

    window.toggleSidebar = function() {
        const grid = document.getElementById('briefing-grid');
        const btn = document.querySelector('.collapse-btn');
        const isCollapsed = grid.classList.toggle('collapsed');
        btn.textContent = isCollapsed ? '»' : '«';
        btn.title = isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
    };

    window.openSectionEditor = function(missionId, key, title) {
        const mission = currentMissions.find(m => m._id === missionId);
        if (!mission) return;

        document.getElementById('section-modal-title').textContent = `EDIT: ${title} (MARKDOWN SUPPORTED)`;
        document.getElementById('section-mission-id').value = missionId;
        document.getElementById('section-key').value = key;
        
        let content = '';
        if (typeof mission.briefing === 'object') {
            content = mission.briefing[key] || '';
        } else if (key === 'situation') {
            content = mission.briefing; // Legacy
        }
        
        sectionContentEl.value = content;
        sectionModalEl.style.display = 'flex';
    };

    sectionForm.onsubmit = async (e) => {
        e.preventDefault();
        const id      = document.getElementById('section-mission-id').value;
        const key     = document.getElementById('section-key').value;
        const content = sectionContentEl.value;

        const mission = currentMissions.find(m => m._id === id);
        if (!mission) return;

        let updatedBriefing = {
            situation: '', mission: '', execution: '', logistics: '', command: ''
        };
        
        if (typeof mission.briefing === 'object') {
            updatedBriefing = { ...updatedBriefing, ...mission.briefing };
        } else {
            updatedBriefing.situation = mission.briefing || '';
        }
        
        updatedBriefing[key] = content || '';

        try {
            await window.client.mutation("missions:update", {
                missionId: id,
                name: mission.name,
                location: mission.location,
                mapUrl: mission.mapUrl,
                date: mission.date,
                leader: mission.leader,
                operators: mission.operators,
                status: mission.status,
                briefing: updatedBriefing,
                handler: session.username
            });
            sectionModalEl.style.display = 'none';
        } catch (e) {
            alert(e.message);
        }
    };

    window.openPlanEditor = function(missionId, currentPlan) {
        document.getElementById('plan-mission-id').value = missionId;
        planContentEl.value = currentPlan;
        planModalEl.style.display = 'flex';
    };

    window.openHandlerImgModal = function(missionId) {
        document.getElementById('handler-mission-id').value = missionId;
        handlerImgModalEl.style.display = 'flex';
    };

    window.promptAssignment = async function(missionId, operatorId, callsign, currentRole, prefs) {
        document.getElementById('role-mission-id').value = missionId;
        document.getElementById('role-operator-id').value = operatorId;
        document.getElementById('role-operator-name').textContent = `OPERATOR: ${callsign}`;
        document.getElementById('role-operator-prefs').textContent = `PREFERENCES: ${prefs}`;
        
        const roleSelect = document.getElementById('role-select');
        roleSelect.value = (currentRole === 'UNASSIGNED') ? 'UNASSIGNED' : currentRole.toUpperCase();

        const loadoutSelect = document.getElementById('role-loadout-select');
        loadoutSelect.innerHTML = '<option value="STANDARD">STANDARD ISSUE</option>';

        try {
            const opLoadouts = await window.client.query("operators:listLoadouts", { operatorId });
            opLoadouts.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.content;
                opt.textContent = l.name;
                loadoutSelect.appendChild(opt);
            });
        } catch (e) {
            console.error("Failed to fetch operator loadouts", e);
        }
        
        document.getElementById('role-modal').style.display = 'flex';
    };

    document.getElementById('role-form').onsubmit = async (e) => {
        e.preventDefault();
        const missionId = document.getElementById('role-mission-id').value;
        const operatorId = document.getElementById('role-operator-id').value;
        const role = document.getElementById('role-select').value;
        const loadout = document.getElementById('role-loadout-select').value;
        
        try {
            await window.client.mutation("missions:setAssignment", { 
                missionId, 
                operatorId, 
                assignedRole: role,
                loadout: loadout
            });
            document.getElementById('role-modal').style.display = 'none';
        } catch (e) {
            alert(e.message);
        }
    };

    window.copyLoadoutToClipboard = async function(loadoutContent) {
        if (!loadoutContent || loadoutContent === 'STANDARD') {
            alert("NO CUSTOM LOADOUT DATA ASSIGNED");
            return;
        }
        try {
            await navigator.clipboard.writeText(loadoutContent);
            alert("ACE ARSENAL EXPORT COPIED TO CLIPBOARD");
        } catch (err) {
            alert("COPY FAILED: " + err.message);
        }
    };

    window.toggleReady = async function(missionId) {
        const mission = currentMissions.find(m => m._id === missionId);
        if (mission && mission.modlistUrl) {
            const confirmed = confirm("CONFIRM TACTICAL PREPARATION:\n\nBY PROCEEDING, YOU CERTIFY THAT THE REQUIRED ARMA 3 MODLIST HAS BEEN DOWNLOADED, INSTALLED, AND VERIFIED.");
            if (!confirmed) return;
        }

        try {
            await window.client.mutation("missions:toggleReady", { 
                missionId, 
                userCallsign: session.username 
            });
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

    window.exportToClipboard = async function(missionId) {
        const mission = currentMissions.find(m => m._id === missionId);
        if (!mission) return;

        const exportData = {
            name: mission.name,
            location: mission.location || '',
            mapUrl: mission.mapUrl || '',
            date: mission.date || '',
            briefing: mission.briefing,
            exportType: "LUXOR_MISSION_BRIEF_V2"
        };

        try {
            await navigator.clipboard.writeText(JSON.stringify(exportData));
            alert("TACTICAL DATA COPIED TO CLIPBOARD");
        } catch (err) {
            alert("CLIPBOARD EXPORT FAILED: " + err.message);
        }
    };

    window.deleteMission = async function(id) {
        if (!confirm("PERMANENTLY DELETE MISSION BRIEFING? THIS CANNOT BE UNDONE.")) return;
        
        try {
            await window.client.mutation("missions:remove", { missionId: id, handler: session.username });
            activeMissionId = null;
            detailEl.innerHTML = '<div class="mission-meta" style="text-align:center; padding:100px;">MISSION DELETED</div>';
        } catch (e) {
            alert(e.message);
        }
    };

    window.importFromClipboard = async function() {
        if (!isHandler) return;

        try {
            const text = await navigator.clipboard.readText();
            const data = JSON.parse(text);

            if (data.exportType !== "LUXOR_MISSION_BRIEF_V2") {
                throw new Error("INVALID TACTICAL DATA FORMAT");
            }

            window._LUXOR_IMPORTED_BRIEF = data.briefing; 

            let mode = 'new';
            if (activeMissionId) {
                const choice = confirm("ACTIVE MISSION DETECTED.\n\n[ OK ] - OVERWRITE CURRENT MISSION\n[ CANCEL ] - CREATE AS NEW MISSION");
                if (choice) mode = 'overwrite';
            }

            window.openModal(mode === 'overwrite' ? activeMissionId : null);
            
            document.getElementById('mission-name').value = data.name || '';
            document.getElementById('mission-location').value = data.location || '';
            document.getElementById('mission-map').value = data.mapUrl || '';
            document.getElementById('mission-date').value = data.date || '';

            alert(mode === 'overwrite' ? "TACTICAL DATA IMPORTED (OVERWRITE MODE)" : "TACTICAL DATA IMPORTED (NEW MISSION MODE)");
        } catch (err) {
            alert("IMPORT FAILED: " + err.message);
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
        document.getElementById('modal-title').textContent = id ? 'EDIT MISSION INFO' : 'NEW MISSION BRIEF';
        document.getElementById('current-modlist-info').textContent = '';

        if (id) {
            const mission = currentMissions.find(m => m._id === id);
            if (mission) {
                document.getElementById('mission-name').value = mission.name;
                document.getElementById('mission-location').value = mission.location || '';
                document.getElementById('mission-map').value = mission.mapUrl || '';
                document.getElementById('mission-date').value = mission.date || '';
                document.getElementById('mission-leader').value = mission.leader || '';
                document.getElementById('mission-status').value = mission.status || 'PRE-FLIGHT';
                document.getElementById('mission-modlist-status').value = mission.modlistStatus || 'WIP';
                
                if (mission.modlistUrl) {
                    document.getElementById('current-modlist-info').textContent = 'CURRENT MODLIST DETECTED (UPLOAD TO OVERWRITE)';
                }

                const checkboxes = opListEl.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    cb.checked = mission.operators.includes(cb.value);
                });
            }
        } else {
            document.getElementById('mission-status').value = 'PRE-FLIGHT';
            document.getElementById('mission-modlist-status').value = 'WIP';
        }
    };

    window.downloadModlist = async function(storageId, missionName) {
        try {
            const url = await window.client.query("missions:getModlistUrl", { storageId });
            if (!url) throw new Error("FILE NOT FOUND ON SERVER");
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `MODLIST_${missionName.replace(/\s+/g, '_')}.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            alert("DOWNLOAD FAILED: " + e.message);
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
        const status   = document.getElementById('mission-status').value;
        const modlistStatus = document.getElementById('mission-modlist-status').value;
        const modlistFile = document.getElementById('mission-modlist').files[0];
        
        const selectedOps = Array.from(opListEl.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        const sanitize = (val) => (val === undefined || val === null) ? "" : String(val);

        try {
            let modlistUrl = undefined;
            if (modlistFile) {
                const postUrl = await window.client.mutation("missions:generateUploadUrl");
                const result = await fetch(postUrl, {
                    method: "POST",
                    headers: { "Content-Type": modlistFile.type },
                    body: modlistFile,
                });
                const { storageId } = await result.json();
                modlistUrl = storageId;
            }

            if (id) {
                const mission = currentMissions.find(m => m._id === id);
                const targetBriefing = window._LUXOR_IMPORTED_BRIEF || (typeof mission.briefing === 'object' ? mission.briefing : { situation: mission.briefing || "" });
                
                await window.client.mutation("missions:update", {
                    missionId: id,
                    name, location, mapUrl, date, leader, status,
                    operators: selectedOps,
                    briefing: {
                        situation: sanitize(targetBriefing.situation),
                        mission: sanitize(targetBriefing.mission),
                        execution: sanitize(targetBriefing.execution),
                        logistics: sanitize(targetBriefing.logistics),
                        command: sanitize(targetBriefing.command),
                    },
                    modlistUrl: modlistUrl,
                    modlistStatus: modlistStatus,
                    handler: session.username
                });
                delete window._LUXOR_IMPORTED_BRIEF;
            } else {
                const imported = window._LUXOR_IMPORTED_BRIEF || {};
                const briefing = {
                    situation: sanitize(imported.situation),
                    mission: sanitize(imported.mission),
                    execution: sanitize(imported.execution),
                    logistics: sanitize(imported.logistics),
                    command: sanitize(imported.command),
                };
                delete window._LUXOR_IMPORTED_BRIEF;

                await window.client.mutation("missions:create", {
                    name, location, mapUrl, date, leader,
                    operators: selectedOps,
                    briefing,
                    modlistUrl,
                    modlistStatus,
                    handler: session.username
                });
            }
            modalEl.style.display = 'none';
        } catch (e) {
            alert(e.message);
        }
    };
})();
