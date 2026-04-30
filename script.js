document.addEventListener('DOMContentLoaded', function () {

  // === Loading Screen (index.html only) ===
  const overlay = document.getElementById('launch-overlay');
  if (overlay) {
    if (sessionStorage.getItem('swadeLaunchPlayed')) {
      overlay.style.display = 'none';
    } else {
      const selectors = ['.navbar', '.welcome', '.options', '.character-sheet'];
      const mainSections = selectors.map(s => document.querySelector(s)).filter(Boolean);
      mainSections.forEach(el => (el.style.display = 'none'));
      document.body.classList.add('overlay-active');

      setTimeout(() => {
        const completeMsg = document.getElementById('launch-complete-msg');
        const initMsg = document.getElementById('init-msg');
        if (completeMsg) completeMsg.classList.add('visible');
        if (initMsg) initMsg.classList.add('hidden-fade');
      }, 2500);

      setTimeout(() => {
        overlay.classList.add('overlay-fade-out');
        overlay.addEventListener('animationend', () => {
          overlay.style.display = 'none';
          mainSections.forEach(el => (el.style.display = ''));
          document.body.classList.remove('overlay-active');
          sessionStorage.setItem('swadeLaunchPlayed', 'true');
        }, { once: true });
      }, 4000);
    }
  }

  // === Character sheet display (index.html) ===
  const savedData = localStorage.getItem('swadeCharacter');
  if (savedData) {
    try {
      const c = JSON.parse(savedData);
      const setField = (id, label, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = label + ': ' + (Array.isArray(val) ? val.join(', ') : (val || ''));
      };
      setField('character-name', 'Name', c.name);
      setField('character-level', 'Level', c.level);
      setField('character-stats', 'Stats', c.stats);
      setField('character-skills', 'Skills', c.skills);
      setField('character-edges', 'Edges', c.edges);
      setField('character-hindrances', 'Hindrances', c.hindrances);
      setField('character-powers', 'Powers', c.powers);
      setField('character-equipment', 'Equipment', c.equipment);
    } catch (e) {
      console.error('Failed to parse character data:', e);
    }
  }

  // === Edges dropdown + form pre-fill (create-character.html) ===
  const edgesSelect = document.getElementById('edges');
  if (edgesSelect) {
    const edgesList = [
      'Alertness', 'Ambidextrous', 'Arcane Background', 'Attractive',
      'Berserk', 'Brave', 'Charismatic', 'Command', 'Danger Sense',
      'Fame', 'Fast Healer', 'Hard to Kill', 'Healer', 'Investigator',
      'Luck', 'Quick', 'Rich', 'Strong Willed', 'Tough as Nails'
    ];
    edgesList.forEach(edge => {
      const opt = document.createElement('option');
      opt.value = edge;
      opt.textContent = edge;
      edgesSelect.appendChild(opt);
    });

    // Pre-fill form if a character already exists
    const existing = localStorage.getItem('swadeCharacter');
    if (existing) {
      try {
        const c = JSON.parse(existing);
        const fill = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        fill('name', c.name);
        fill('level', c.level);
        fill('stats', c.stats);
        fill('skills', c.skills);
        if (Array.isArray(c.edges)) {
          Array.from(edgesSelect.options).forEach(opt => {
            opt.selected = c.edges.includes(opt.value);
          });
        }
      } catch (e) {}
    }
  }

  // === Character form submit (create-character.html) ===
  const form = document.getElementById('character-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const esSel = document.getElementById('edges');
      const character = {
        name: (document.getElementById('name') || {}).value || '',
        level: (document.getElementById('level') || {}).value || '',
        stats: (document.getElementById('stats') || {}).value || '',
        skills: (document.getElementById('skills') || {}).value || '',
        edges: esSel ? Array.from(esSel.selectedOptions).map(o => o.value) : [],
        hindrances: '',
        powers: '',
        equipment: ''
      };
      localStorage.setItem('swadeCharacter', JSON.stringify(character));
      window.location.href = 'index.html';
    });
  }

});

function exportCharacterSheetToPDF() {
  if (typeof window.jspdf === 'undefined') {
    alert('PDF export library not loaded. Please check your connection and try again.');
    return;
  }
  const character = JSON.parse(localStorage.getItem('swadeCharacter') || '{}');
  if (!character.name) {
    alert('No character data found. Please create a character first.');
    return;
  }
  const doc = new window.jspdf.jsPDF();
  doc.setFont('courier', 'normal');
  doc.setFontSize(18);
  doc.text('SWADE Character Sheet', 20, 20);
  doc.setFontSize(12);
  let y = 40;
  const fields = ['name', 'level', 'stats', 'skills', 'edges', 'hindrances', 'powers', 'equipment'];
  fields.forEach(key => {
    const val = Array.isArray(character[key]) ? character[key].join(', ') : (character[key] || '');
    doc.text(key.charAt(0).toUpperCase() + key.slice(1) + ': ' + val, 20, y);
    y += 12;
  });
  doc.save('character-sheet.pdf');
}
