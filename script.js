function saveCharacter() {
  const character = {
    name: document.getElementById('name-input').value,
    level: document.getElementById('level-input').value,
    stats: document.getElementById('stats-input').value,
    skills: document.getElementById('skills-input').value,
    edges: document.getElementById('edges-input').value,
    hindrances: document.getElementById('hindrances-input').value,
    powers: document.getElementById('powers-input').value,
    equipment: document.getElementById('equipment-input').value
  };

  alert('Character saved successfully!');
  localStorage.setItem('swadeCharacter', JSON.stringify(character));
  // Optionally redirect to index.html to view the sheet
  window.location.href = 'index.html';
}
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
  } else {
    // Run animation as usual
    document.querySelector('.navbar').style.display = 'none';
    document.querySelector('.welcome').style.display = 'none';
    document.querySelector('.options').style.display = 'none';


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
      // Set flag so animation doesn't play again
      sessionStorage.setItem('swadeLaunchPlayed', 'true');
    }, 7000); // 4s scan + 3s message
  }
});
