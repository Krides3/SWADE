(function () {
    'use strict';
    LuxorAuth.requireAuth('login.html');
    var s = LuxorAuth.getSession();
    if (s) {
        var nameEl = document.getElementById('welcome-name');
        if (nameEl) {
            try {
                var dossiers = JSON.parse(localStorage.getItem('luxorDossiers') || '[]');
                var dossier  = dossiers.find(function(d) { return d.username === s.username; });
                nameEl.textContent = (dossier && dossier.callsign) ? dossier.callsign : s.username;
            } catch(e) {
                nameEl.textContent = s.username;
            }
        }
        if (LuxorAuth.isAdmin()) {
            var adminLink = document.getElementById('admin-nav-link');
            if (adminLink) adminLink.style.display = 'block';
        }

        // ── DASHBOARD ACCESS CONTROL ──────────────────────────────
        const isRestricted = s.isRestricted === true && s.username !== 'OVERLORD';
        const isAdmin = s.role === 'admin';
        const grid = document.querySelector('.tool-grid');

        // Show profile section
        const profileSection = document.getElementById('profile-section');
        if (profileSection) profileSection.style.display = 'block';

        // ── CONVEX INTEGRATION ────────────────────────────────────
        if (typeof convex !== 'undefined') {
            const CONVEX_URL = "https://focused-panda-809.eu-west-1.convex.cloud";
            window.client = new convex.ConvexClient(CONVEX_URL, { skipConvexDeploymentUrlCheck: true });

            // Load current preferences
            window.client.query("operators:getByCallsign", { callsign: s.username }).then(op => {
                if (op && op.preferredRoles) {
                    if (op.preferredRoles[0]) document.getElementById('pref-1').value = op.preferredRoles[0];
                    if (op.preferredRoles[1]) document.getElementById('pref-2').value = op.preferredRoles[1];
                    if (op.preferredRoles[2]) document.getElementById('pref-3').value = op.preferredRoles[2];
                }
            });

            window.savePreferences = async function() {
                const r1 = document.getElementById('pref-1').value.trim();
                const r2 = document.getElementById('pref-2').value.trim();
                const r3 = document.getElementById('pref-3').value.trim();
                const roles = [r1, r2, r3].filter(r => r !== "");

                try {
                    await window.client.mutation("operators:setPreferences", { callsign: s.username, roles });
                    alert("TACTICAL PROFILE UPDATED");
                } catch (e) {
                    alert("ERROR UPDATING PROFILE: " + e.message);
                }
            };
        }

        if (grid) {
            const briefingCard = `
                <a class="tool-card" href="briefing.html">
                    <div class="tool-card-top">
                        <div class="tool-card-icon">◈</div>
                        <div class="tool-card-badge">READY</div>
                    </div>
                    <div class="tool-card-title">Mission Briefing</div>
                    <div class="tool-card-desc">DAGGER Squad operational data. View active briefings and mission parameters.</div>
                    <div class="tool-card-code">BRIEFING.EXE</div>
                </a>
            `;

            const planningCard = `
                <a class="tool-card" href="planning.html">
                    <div class="tool-card-top">
                        <div class="tool-card-icon">📅</div>
                        <div class="tool-card-badge">NEW</div>
                    </div>
                    <div class="tool-card-title">Planning Tool</div>
                    <div class="tool-card-desc">Operator availability matrix. Coordinate mission timings and squad readiness.</div>
                    <div class="tool-card-code">PLANNING.EXE</div>
                </a>
            `;

            const editorCard = `
                <a class="tool-card" href="operator-editor.html">
                    <div class="tool-card-top">
                        <div class="tool-card-icon">⊠</div>
                        <div class="tool-card-badge">ADMIN</div>
                    </div>
                    <div class="tool-card-title">Operator Editor</div>
                    <div class="tool-card-desc">Manage tactical roster. Enlist new operators, terminate access, and set tool privileges.</div>
                    <div class="tool-card-code">ROSTER_MGMT.EXE</div>
                </a>
            `;

            const tools = [
                { title: 'Asset Map',       desc: 'Real-time tactical mapping and asset tracking.', icon: '⊛', href: 'AssetMap/AssetMap.html', code: 'MAP_SYSTEM.SYS' },
                { title: 'HQ Comms',       desc: 'Secure communication channel with HQ and field units.', icon: '📡', href: 'comms.html', code: 'COMMS_NET.NET' },
                { title: 'Dice Roller',    desc: 'Probability calculation and tactical RNG suite.', icon: '⚄', href: 'dice.html', code: 'PROB_CALC.EXE' },
                { title: 'Mission Timer',  desc: 'Operational clock and mission countdown synchronization.', icon: '⧖', href: 'timer.html', code: 'OP_CLOCK.SYS' },
                { title: 'Radio Scanner',  desc: 'Signal intelligence and frequency monitoring.', icon: '⌇', href: 'RadioScanner/index.html', code: 'SIGINT_SCAN.EXE' },
                { title: 'Bomb Defusal',   desc: 'Explosive ordinance disposal and circuit bypass.', icon: '⚙', href: 'bomb.html', code: 'EOD_BYPASS.EXE' },
                { title: 'Lockpick',       desc: 'Digital bypass and physical security override.', icon: '⌗', href: 'lockpick.html', code: 'SEC_BYPASS.EXE' },
                { title: 'Hacking',        desc: 'Remote system intrusion and data exfiltration.', icon: '▦', href: 'hack.html', code: 'BREACH.EXE' },
                { title: 'Social Eng.',    desc: 'Human-centric vulnerability analysis and leverage.', icon: '⊙', href: 'social.html', code: 'PERSUADE.EXE' },
                { title: 'Network Map',    desc: 'Topology visualization and node exploitation.', icon: '⊛', href: 'netmap.html', code: 'NET_STORM.EXE' },
                { title: 'Evidence',       desc: 'Intelligence gathering and case link analysis.', icon: '⊡', href: 'evidence.html', code: 'INTEL_LOG.DB' },
                { title: 'File Decrypt',   desc: 'Encrypted storage access and data recovery.', icon: '⊟', href: 'filesystem.html', code: 'DECRYPT.EXE' },
                { title: 'Dossier',        desc: 'Personnel profiles and background intelligence.', icon: '👤', href: 'dossier.html', code: 'BIO_ARCHIVE.EXE' },
                { title: 'Mission View',   desc: 'Consolidated multi-module tactical display.', icon: '⊞', href: 'multiview.html', code: 'QUAD_VIEW.SYS' }
            ];

            const toolCards = tools.map(t => `
                <a class="tool-card" href="${t.href}">
                    <div class="tool-card-top">
                        <div class="tool-card-icon">${t.icon}</div>
                        <div class="tool-card-badge">READY</div>
                    </div>
                    <div class="tool-card-title">${t.title}</div>
                    <div class="tool-card-desc">${t.desc}</div>
                    <div class="tool-card-code">${t.code}</div>
                </a>
            `).join('');

            if (isRestricted) {
                // Clear all cards and only show Briefing and (if admin) Editor
                grid.innerHTML = briefingCard + planningCard + (isAdmin ? editorCard : '');
                
                // Also update tagline to reflect restricted status
                const tagline = document.querySelector('.tagline');
                if (tagline) tagline.textContent = '// RESTRICTED ACCESS — AUTHORIZED MODULES ONLY //';
            } else {
                // For OVERLORD, show everything
                grid.innerHTML = briefingCard + planningCard + (isAdmin ? editorCard : '') + toolCards;
            }
        }
    }
})();
