(function () {
    'use strict';

    if (LuxorAuth.getSession()) {
        window.location.replace('index.html');
        return;
    }

    const CONVEX_URL = "https://focused-panda-809.eu-west-1.convex.cloud";
    const client = new convex.ConvexClient(CONVEX_URL, { skipConvexDeploymentUrlCheck: true });

    document.getElementById('login-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        
        const callsign = document.getElementById('un').value.toUpperCase().trim();
        const errEl = document.getElementById('err-msg');
        const errText = document.getElementById('err-text');
        const loginBtn = e.target.querySelector('button');

        // Visual feedback
        loginBtn.disabled = true;
        loginBtn.textContent = "AUTHENTICATING...";

        try {
            // Query Convex for the operator
            const operator = await client.query("operators:getByCallsign", { callsign });

            if (operator) {
                // Success - Establish local session
                LuxorAuth.establishSession(operator);
                sessionStorage.setItem('luxorShowBoot', '1');
                window.location.replace('index.html');
            } else {
                // Failure - Unknown callsign
                errText.textContent = "ACCESS DENIED — UNKNOWN CALLSIGN";
                errEl.classList.remove('visible');
                void errEl.offsetWidth;
                errEl.classList.add('visible');
                
                document.getElementById('un').value = '';
                document.getElementById('un').focus();
            }
        } catch (err) {
            console.error("Auth Error:", err);
            errText.textContent = "SYSTEM ERROR — CONVEX CONNECTION FAILED";
            errEl.classList.add('visible');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'AUTHENTICATE<span class="cursor"></span>';
        }
    });
})();
