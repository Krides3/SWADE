(function () {
    'use strict';

    console.log("[LUXOR CS] STARTUP URL:", window.location.href);

    const CONVEX_URL = "https://focused-panda-809.eu-west-1.convex.cloud";
    const client = new convex.ConvexClient(CONVEX_URL, { skipConvexDeploymentUrlCheck: true });

    const NATO_WORDS = [
        "Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett", "Kilo", "Lima", "Mike",
        "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "X-ray", "Yankee", "Zulu"
    ];

    const RADIO_GLOSSARY = [
        { c: "CONTACT [BEARING]", d: "Visual sighting of enemy at specific compass bearing." },
        { c: "COPY", d: "Received and understood last transmission." },
        { c: "VISUAL", d: "Sighting of a friendly person or object." },
        { c: "HOLD", d: "Stop current action and wait for orders." },
        { c: "BREAK", d: "Interrupting for urgent message." },
        { c: "NO JOY", d: "No visual contact with target." },
        { c: "BLIND", d: "Lost visual contact with friendly." },
        { c: "WINCHESTER", d: "Out of all ammunition/ordnance." },
        { c: "REMINGTON", d: "Only small amount of ammo left." },
        { c: "OSCAR MIKE", d: "On the move / mobile." },
        { c: "CHARLIE MIKE", d: "Continue Mission." },
        { c: "BOGEY", d: "Unknown radar or visual contact." },
        { c: "BANDIT", d: "Confirmed enemy aircraft/contact." },
        { c: "HOSTILE", d: "Confirmed enemy; authorized to engage." }
    ];

    async function init() {
        renderNATO();
        renderRadio();

        const urlParams = new URLSearchParams(window.location.search);
        let missionId = urlParams.get('id');

        if (!missionId) {
            const match = window.location.href.match(/[?&]id=([^&]+)/);
            if (match) missionId = match[1];
        }

        if (!missionId) {
            missionId = localStorage.getItem('luxor_last_mission_id');
            if (missionId) console.log("[LUXOR CS] FALLBACK TO LOCALSTORAGE:", missionId);
        }

        if (!missionId) {
            document.getElementById('mission-name').textContent = "ERROR: MISSION ID MISSING";
            document.getElementById('mission-name').style.color = "var(--danger)";
            return;
        }

        try {
            client.onUpdate("missions:getDetails", { missionId }, (mission) => {
                if (mission) {
                    console.log("[LUXOR CS] DATA RECEIVED:", mission.name, "STATUS:", mission.status);
                    
                    document.getElementById('mission-name').textContent = mission.name || "ENCRYPTED";
                    document.getElementById('mission-status').textContent = mission.status || "UNKNOWN";
                    document.title = `CHEAT SHEET — ${mission.name}`;

                    const planEl = document.getElementById('mission-plan');
                    if (mission.leaderPlan) {
                        const content = typeof marked.parse === 'function' ? marked.parse(mission.leaderPlan) : marked(mission.leaderPlan);
                        planEl.innerHTML = content;
                    } else {
                        planEl.innerHTML = '<div style="color:var(--text-dim); font-style:italic; padding:20px; border:1px dashed var(--border);">TACTICAL PLAN PENDING FROM MISSION LEADER...</div>';
                    }

                    const gallery = document.getElementById('plan-gallery');
                    gallery.innerHTML = (mission.leaderImageUrls || []).map(url => `
                        <div class="tactical-img-container">
                            <img src="${url}" onclick="window.open('${url}', '_blank')">
                        </div>
                    `).join('');

                    renderSquad(mission.assignments);
                } else {
                    console.warn("[LUXOR CS] MISSION NOT FOUND FOR ID:", missionId);
                }
            });

        } catch (e) {
            console.error("[LUXOR CS] INIT FAILED:", e);
        }
    }

    function renderNATO() {
        const grid = document.getElementById('phonetic-grid');
        if (!grid) return;

        const colCount = 4;
        const rowCount = Math.ceil(NATO_WORDS.length / colCount);
        
        let html = `<div style="display:grid; grid-template-columns: repeat(${colCount}, 1fr); gap: 10px 15px; width:100%;">`;
        
        for (let c = 0; c < colCount; c++) {
            html += '<div style="display:flex; flex-direction:column; gap:4px;">';
            for (let r = 0; r < rowCount; r++) {
                const idx = c * rowCount + r;
                if (idx < NATO_WORDS.length) {
                    const word = NATO_WORDS[idx];
                    html += `<div style="font-size:clamp(1.1rem, 2.3vh, 1.6rem); line-height:1; font-weight:bold;"><span style="color:var(--cyan);">${word[0]}</span><span style="color:var(--text);">${word.substring(1)}</span></div>`;
                }
            }
            html += '</div>';
        }

        html += '</div>';
        grid.innerHTML = html;
    }

    function renderRadio() {
        const list = document.getElementById('radio-list');
        if (!list) return;
        list.innerHTML = RADIO_GLOSSARY.map(item => `
            <div class="radio-item">
                <span class="r-call">${item.c}</span>
                <span class="r-def">${item.d}</span>
            </div>
        `).join('');
    }

    function renderSquad(assignments) {
        const grid = document.getElementById('squad-grid');
        if (!grid) return;
        grid.innerHTML = '';

        if (!assignments || assignments.length === 0) {
            console.warn("[LUXOR CS] NO ASSIGNMENTS FOUND");
            grid.innerHTML = '<div style="color: var(--text-dim); font-size:0.8rem; font-style:italic;">NO OPERATORS ASSIGNED TO MISSION</div>';
            return;
        }

        const sorted = [...assignments].sort((a, b) => {
            const roleA = (a.assignedRole || '').toLowerCase();
            const roleB = (b.assignedRole || '').toLowerCase();
            const aIsLead = roleA.includes('leader') || roleA.includes('lead');
            const bIsLead = roleB.includes('leader') || roleB.includes('lead');
            if (aIsLead && !bIsLead) return -1;
            if (!aIsLead && bIsLead) return 1;
            return (a.callsign || '').localeCompare(b.callsign || '');
        });

        grid.innerHTML = sorted.map(op => {
            const role = (op.assignedRole || '').toLowerCase();
            const isLead = role.includes('leader') || role.includes('lead');
            
            return `
                <div class="operator-item ${isLead ? 'tl' : ''}">
                    <span class="op-name">${op.callsign || 'UNKNOWN'}</span>
                    <span class="op-role">${op.assignedRole || 'RIFLEMAN'}</span>
                </div>
            `;
        }).join('');
    }

    init();
})();
