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
  if (data) {
    const character = JSON.parse(data);
    document.getElementById('character-name').textContent = 'Name: ' + (character.name || '');
    document.getElementById('character-level').textContent = 'Level: ' + (character.level || '');
    document.getElementById('character-stats').textContent = 'Stats: ' + (character.stats || '');
    document.getElementById('character-skills').textContent = 'Skills: ' + (character.skills || '');
    document.getElementById('character-edges').textContent = 'Edges: ' + (character.edges || '');
    document.getElementById('character-hindrances').textContent = 'Hindrances: ' + (character.hindrances || '');
    document.getElementById('character-powers').textContent = 'Powers: ' + (character.powers || '');
    document.getElementById('character-equipment').textContent = 'Equipment: ' + (character.equipment || '');
  }
});
// Hide main content until overlay is gone
document.addEventListener('DOMContentLoaded', function() {
  // Check if launch animation has already played
  if (sessionStorage.getItem('swadeLaunchPlayed')) {
    document.getElementById('launch-overlay').style.display = 'none';
    document.querySelector('.navbar').style.display = '';
    document.querySelector('.welcome').style.display = '';
    document.querySelector('.options').style.display = '';
    document.querySelector('.character-sheet').style.display = '';
    document.body.classList.remove('overlay-active');
  } else {
    // Run animation as usual
    document.querySelector('.navbar').style.display = 'none';
    document.querySelector('.welcome').style.display = 'none';
    document.querySelector('.options').style.display = 'none';
    document.querySelector('.character-sheet').style.display = 'none';
    document.body.classList.add('overlay-active');

    // Show 'Connection complete' after scan bar fills and hide init message
    setTimeout(() => {
      document.getElementById('launch-complete-msg').classList.add('visible');
      document.getElementById('init-msg').classList.add('hidden-fade');
    }, 4500); // show after scanBarMove 4s is fully done

    // Hide overlay and show main content (show message for 3s)
    setTimeout(() => {
      document.getElementById('launch-overlay').style.display = 'none';
      document.querySelector('.navbar').style.display = '';
      document.querySelector('.welcome').style.display = '';
      document.querySelector('.options').style.display = '';
      document.querySelector('.character-sheet').style.display = '';
      document.body.classList.remove('overlay-active');
      // Set flag so animation doesn't play again
      sessionStorage.setItem('swadeLaunchPlayed', 'true');
    }, 7000); // 4s scan + 3s message
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
