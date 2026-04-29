// Dynamically populate edges dropdown
document.addEventListener('DOMContentLoaded', function() {
  const edgesList = [
    "Alertness",
    "Ambidextrous",
    "Arcane Background",
    "Attractive",
    "Berserk",
    "Brave",
    "Charismatic",
    "Command",
    "Danger Sense",
    "Fame",
    "Fast Healer",
    "Hard to Kill",
    "Healer",
    "Investigator",
    "Luck",
    "Quick",
    "Rich",
    "Strong Willed",
    "Tough as Nails"
    // Add more edges as needed
  ];
  const edgesSelect = document.getElementById('edges');
  if (edgesSelect) {
    edgesList.forEach(edge => {
      const option = document.createElement('option');
      option.value = edge;
      option.textContent = edge;
      edgesSelect.appendChild(option);
    });
  }
});
function saveCharacter(e) {
  if (e) e.preventDefault();
  // Use form field IDs from create-character.html
  const edgesSelect = document.getElementById('edges');
  const selectedEdges = Array.from(edgesSelect.selectedOptions).map(opt => opt.value);
  const character = {
    name: document.getElementById('name').value,
    level: document.getElementById('level').value,
    stats: document.getElementById('stats').value,
    skills: document.getElementById('skills').value,
    edges: selectedEdges,
    hindrances: document.getElementById('hindrances') ? document.getElementById('hindrances').value : '',
    powers: document.getElementById('powers') ? document.getElementById('powers').value : '',
    equipment: document.getElementById('equipment') ? document.getElementById('equipment').value : ''
  };
  // Debug: log character object
  console.log('Saving character:', character);
  localStorage.setItem('swadeCharacter', JSON.stringify(character));
  // Debug: log localStorage
  console.log('localStorage:', localStorage.getItem('swadeCharacter'));
  // Clear form fields after save
  const form = document.getElementById('character-form');
  if (form) form.reset();
  // Redirect to index.html
  window.location.href = 'index.html';
}

// Attach submit event to character creation form
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('character-form');
  if (form) {
    form.addEventListener('submit', saveCharacter);
  }
});
// Load character sheet data from localStorage and display on index.html
document.addEventListener('DOMContentLoaded', function() {
  const data = localStorage.getItem('swadeCharacter');
  if (!data) return;
  const character = JSON.parse(data);
  const fields = {
    'character-name':        'Name: '        + (character.name || ''),
    'character-level':       'Level: '       + (character.level || ''),
    'character-stats':       'Stats: '       + (character.stats || ''),
    'character-skills':      'Skills: '      + (character.skills || ''),
    'character-edges':       'Edges: '       + (character.edges || ''),
    'character-hindrances':  'Hindrances: '  + (character.hindrances || ''),
    'character-powers':      'Powers: '      + (character.powers || ''),
    'character-equipment':   'Equipment: '   + (character.equipment || ''),
  };
  for (const [id, text] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
});
// Boot overlay — hide after CSS animation completes
document.addEventListener('DOMContentLoaded', function() {
  const overlay = document.getElementById('boot-overlay');
  if (!overlay) return;

  if (sessionStorage.getItem('swadeLaunchPlayed')) {
    overlay.style.display = 'none';
  } else {
    // Boot bar animation is 3s; fade out shortly after it finishes
    setTimeout(() => {
      overlay.classList.add('fade-out');
    }, 3200);

    setTimeout(() => {
      overlay.style.display = 'none';
      sessionStorage.setItem('swadeLaunchPlayed', 'true');
    }, 4400); // 3.2s + 1.2s fade-out
  }
});
// Add this function to script.js
function exportCharacterSheetToPDF() {
  const character = JSON.parse(localStorage.getItem('swadeCharacter') || '{}');
  const doc = new window.jspdf.jsPDF();
  doc.setFont('courier', 'normal');
  doc.setFontSize(16);
  doc.text('Character Sheet', 20, 20);
  doc.setFontSize(12);
  let y = 40;
  for (const [key, value] of Object.entries(character)) {
    doc.text(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`, 20, y);
    y += 10;
  }
  doc.save('character-sheet.pdf');
}
