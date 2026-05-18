'use strict';

const DICE = [4, 6, 8, 10, 12];
const TN   = 4;

let history = [];

function rollDie(sides) {
    let total = 0;
    let roll;
    do {
        roll  = Math.floor(Math.random() * sides) + 1;
        total += roll;
    } while (roll === sides); // acing
    return total;
}

function rollTrait() {
    const traitSides = parseInt(document.getElementById('dr-trait-die').value);
    const mod        = parseInt(document.getElementById('dr-modifier').value) || 0;
    const useWild    = document.getElementById('dr-wild-die').checked;
    const label      = document.getElementById('dr-label').value.trim() || null;

    const traitRaw = rollDie(traitSides);
    const wildRaw  = useWild ? rollDie(6) : null;

    const traitTotal = traitRaw + mod;
    const wildTotal  = wildRaw !== null ? wildRaw + mod : null;

    const best  = wildTotal !== null ? Math.max(traitTotal, wildTotal) : traitTotal;
    const which = wildTotal !== null && wildTotal > traitTotal ? 'wild' : 'trait';

    const success = best >= TN;
    const raises  = success ? Math.floor((best - TN) / 4) : 0;

    const entry = { traitSides, mod, traitRaw, wildRaw, traitTotal, wildTotal, best, which, success, raises, label, t: Date.now() };
    history.unshift(entry);
    if (history.length > 30) history.length = 30;

    renderResult(entry);
    renderHistory();
}

function renderResult(e) {
    const wrap = document.getElementById('dr-result');
    if (!wrap) return;

    const cls = !e.success ? 'fail' : e.raises > 0 ? 'raise' : 'success';

    let resultLine = e.success
        ? (e.raises > 0 ? `SUCCESS +${e.raises} RAISE${e.raises > 1 ? 'S' : ''}` : 'SUCCESS')
        : 'FAILURE';

    let diceStr = `d${e.traitSides}: <span class="${e.which === 'trait' ? 'dr-best' : ''}">${e.traitRaw}${e.mod !== 0 ? (e.mod > 0 ? '+' + e.mod : e.mod) + '=' + e.traitTotal : ''}</span>`;
    if (e.wildRaw !== null) {
        diceStr += ` &nbsp;|&nbsp; d6(W): <span class="${e.which === 'wild' ? 'dr-best' : ''}">${e.wildRaw}${e.mod !== 0 ? (e.mod > 0 ? '+' + e.mod : e.mod) + '=' + e.wildTotal : ''}</span>`;
    }

    wrap.className = 'dr-result-block ' + cls;
    wrap.innerHTML = `
        <div class="dr-result-label">${e.label ? e.label.toUpperCase() + ' — ' : ''}${resultLine}</div>
        <div class="dr-result-total">${e.best}</div>
        <div class="dr-result-dice">${diceStr}</div>
        ${e.raises > 0 ? `<div class="dr-raises">${'◆'.repeat(e.raises)}</div>` : ''}
    `;
}

function renderHistory() {
    const el = document.getElementById('dr-history');
    if (!el) return;
    if (!history.length) { el.innerHTML = '<div class="dr-hist-empty">No rolls yet.</div>'; return; }
    el.innerHTML = history.map(e => {
        const cls = !e.success ? 'fail' : e.raises > 0 ? 'raise' : 'success';
        const label = e.label ? `<span class="dr-hist-label">${e.label.toUpperCase()}</span> ` : '';
        const raises = e.raises > 0 ? ` +${e.raises}R` : '';
        return `<div class="dr-hist-row ${cls}">
            ${label}<span class="dr-hist-die">d${e.traitSides}${e.mod !== 0 ? (e.mod > 0 ? '+' + e.mod : e.mod) : ''}</span>
            <span class="dr-hist-total">${e.best}</span>
            <span class="dr-hist-result">${e.success ? 'HIT' + raises : 'MISS'}</span>
        </div>`;
    }).join('');
}

function clearHistory() {
    history = [];
    document.getElementById('dr-result').className = 'dr-result-block';
    document.getElementById('dr-result').innerHTML = '<div class="dr-result-placeholder">Roll to see result</div>';
    renderHistory();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('dr-roll-btn').addEventListener('click', rollTrait);
    document.getElementById('dr-clear-btn').addEventListener('click', clearHistory);
    document.getElementById('dr-modifier').addEventListener('keydown', e => { if (e.key === 'Enter') rollTrait(); });

    // Keyboard shortcut: Space or R to roll
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        if (e.key === 'r' || e.key === 'R') rollTrait();
    });

    renderHistory();
});
