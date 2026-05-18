(function () {
    'use strict';
    if (LuxorAuth.getSession()) {
        window.location.replace('index.html');
        return;
    }
    document.getElementById('login-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var username = document.getElementById('un').value;
        var password = document.getElementById('pw').value;
        var result   = LuxorAuth.login(username, password);
        if (result.ok) {
            sessionStorage.setItem('luxorShowBoot', '1');
            window.location.replace('index.html');
        } else {
            var errEl = document.getElementById('err-msg');
            document.getElementById('err-text').textContent = result.error;
            errEl.classList.remove('visible');
            void errEl.offsetWidth;
            errEl.classList.add('visible');
            document.getElementById('pw').value = '';
            document.getElementById('pw').focus();
        }
    });
})();
