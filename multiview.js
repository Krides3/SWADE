/* ================================================================
   MISSION VIEW — configurable multi-terminal split screen
   Layout + pane selections saved to localStorage.
   ================================================================ */
(function () {
    'use strict';

    const MV_KEY = 'luxorMultiviewLayout';

    const TOOLS = [
        { id: '',          label: '— SELECT MODULE —',   url: null },
        { id: 'hack',      label: 'HACKING TERMINAL',    url: 'hack.html' },
        { id: 'radio',     label: 'RADIO SCRAMBLER',     url: 'RadioScanner/index.html' },
        { id: 'map',       label: 'ASSET MAP',           url: 'AssetMap/AssetMap.html' },
        { id: 'dice',      label: 'DICE ROLLER',         url: 'dice.html' },
        { id: 'timer',     label: 'MISSION TIMER',       url: 'timer.html' },
        { id: 'comms',     label: 'HQ COMMS',            url: 'comms.html' },
        { id: 'bomb',      label: 'BOMB DEFUSAL',        url: 'bomb.html' },
        { id: 'lockpick',  label: 'LOCKPICK INTERFACE',  url: 'lockpick.html' },
    ];

    const PANE_COUNT = { '1': 1, '2h': 2, '2v': 2, '4': 4 };

    let mvLayout = '1';
    let mvPanes  = ['', '', '', ''];

    /* ── Persistence ─────────────────────────────────────────── */
    function load() {
        try {
            const s = JSON.parse(localStorage.getItem(MV_KEY) || 'null');
            if (s) {
                mvLayout = s.layout || '1';
                mvPanes  = (s.panes  || []).concat(['','','','']).slice(0, 4);
            }
        } catch (e) {}
    }

    function save() {
        localStorage.setItem(MV_KEY, JSON.stringify({ layout: mvLayout, panes: mvPanes }));
        const info = document.getElementById('mv-save-info');
        if (info) {
            info.textContent = 'SAVED ✓';
            info.classList.add('saved');
            clearTimeout(info._t);
            info._t = setTimeout(() => {
                info.textContent = 'LAYOUT SAVED';
                info.classList.remove('saved');
            }, 1800);
        }
    }

    /* ── Layout ──────────────────────────────────────────────── */
    window.setLayout = function (layout) {
        if (!PANE_COUNT[layout]) return;
        mvLayout = layout;
        renderGrid();
        save();
        document.querySelectorAll('.mv-layout-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.layout === layout);
        });
    };

    /* ── Grid render ─────────────────────────────────────────── */
    function renderGrid() {
        const grid = document.getElementById('mv-grid');
        if (!grid) return;
        grid.className = 'mv-grid l-' + mvLayout;
        grid.innerHTML = '';
        const count = PANE_COUNT[mvLayout] || 1;
        for (let i = 0; i < count; i++) {
            grid.appendChild(buildPane(i));
        }
    }

    function buildPane(slot) {
        const pane = document.createElement('div');
        pane.className = 'mv-pane';

        const bar = document.createElement('div');
        bar.className = 'mv-pane-bar';

        const dot = document.createElement('span');
        dot.className = 'mv-pane-dot';

        const sel = document.createElement('select');
        sel.className = 'mv-pane-sel';
        TOOLS.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.label;
            if (t.id === mvPanes[slot]) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
            mvPanes[slot] = sel.value;
            updateDot(dot, sel.value);
            loadPaneContent(pane, sel.value);
            save();
        });

        const reloadBtn = document.createElement('button');
        reloadBtn.className = 'mv-pane-reload';
        reloadBtn.textContent = '↺ RELOAD';
        reloadBtn.title = 'Reload this pane';
        reloadBtn.addEventListener('click', () => {
            loadPaneContent(pane, mvPanes[slot]);
        });

        updateDot(dot, mvPanes[slot]);
        bar.appendChild(dot);
        bar.appendChild(sel);
        bar.appendChild(reloadBtn);
        pane.appendChild(bar);

        loadPaneContent(pane, mvPanes[slot]);
        return pane;
    }

    function updateDot(dot, toolId) {
        dot.style.background = toolId ? 'var(--cyan)' : 'var(--gold-dim)';
        dot.style.boxShadow  = toolId ? '0 0 4px var(--cyan)' : 'none';
    }

    function loadPaneContent(pane, toolId) {
        const bar = pane.querySelector('.mv-pane-bar');
        while (pane.lastChild !== bar) pane.removeChild(pane.lastChild);

        const tool = TOOLS.find(t => t.id === toolId);

        if (!tool || !tool.url) {
            const empty = document.createElement('div');
            empty.className = 'mv-pane-empty';
            empty.innerHTML = '<div class="mv-pane-empty-icon">⊡</div><span>SELECT A MODULE ABOVE</span>';
            pane.appendChild(empty);
        } else {
            const iframe = document.createElement('iframe');
            iframe.className = 'mv-pane-frame';
            iframe.src = tool.url;
            iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox';
            iframe.title  = tool.label;
            iframe.loading = 'lazy';
            pane.appendChild(iframe);
        }
    }

    /* ── Init ────────────────────────────────────────────────── */
    load();
    renderGrid();

    document.querySelectorAll('.mv-layout-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.layout === mvLayout);
    });

})();
