// Hide main content until overlay is gone
document.addEventListener('DOMContentLoaded', function() {
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
  }, 7000); // 4s scan + 3s message
});
