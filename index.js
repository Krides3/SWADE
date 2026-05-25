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
        const isRestricted = s.isRestricted === true;
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

            if (isRestricted) {
                // Clear all cards and only show Briefing and (if admin) Editor
                grid.innerHTML = briefingCard + (isAdmin ? editorCard : '');
                
                // Also update tagline to reflect restricted status
                const tagline = document.querySelector('.tagline');
                if (tagline) tagline.textContent = '// RESTRICTED ACCESS — AUTHORIZED MODULES ONLY //';
            } else {
                // For OVERLORD, append Briefing and Editor cards to the start
                grid.insertAdjacentHTML('afterbegin', briefingCard + (isAdmin ? editorCard : ''));
            }
        }
    }
})();
