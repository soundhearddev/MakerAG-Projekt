const toggle = document.getElementById("toggle"); 
const body = document.body; 

function applyTheme(isDarkMode) {
  isDarkMode ? body.classList.add("dark-mode") : body.classList.remove("dark-mode");
}

function applyFontSize() {
  const fontSize = document.getElementById('fontSlider').value + 'px'; 
  document.documentElement.style.setProperty('--font-size', fontSize);
}

if (toggle) {
  toggle.addEventListener("change", () => {
    const isDarkMode = toggle.checked;
    applyTheme(isDarkMode);
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme"); 
  const isDarkMode = savedTheme === "dark"; 
  if (toggle) {
    toggle.checked = isDarkMode;
    applyTheme(isDarkMode);
  }
});
