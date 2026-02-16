const colorPicker = document.getElementById('colorPicker');
const elementSelect = document.getElementById('elementSelect');
const applyButton = document.getElementById('applyColor');
const resetButton = document.createElement('button'); // Zurücksetzen-Button erstellen

resetButton.textContent = 'Zurücksetzen';
resetButton.id = 'resetColors';
document.body.appendChild(resetButton); // Button am Ende der Seite hinzufügen

// Vorlagenfarben definieren
const templates = {
  template1: {
    bodyBg: '#181C14',
    navBg: '#3C3D37',
    bodyText: '#ECDFCC',
  },
  template2: {
    bodyBg: '#E4E0E1',
    navBg: '#D6C0B3',
    bodyText: '#493628',
  },
  template3: {
    bodyBg: '#000B58',
    navBg: '#003161',
    bodyText: '#FFF4B7',
  },
  template4: {
    bodyBg: '#D3F1DF',
    navBg: '#85A98F',
    bodyText: '#525B44',
  },
};

// Farben aus Local Storage laden
function loadColors() {
  const savedColors = JSON.parse(localStorage.getItem('colors'));
  if (savedColors) {
    applyTemplate(savedColors);
  }
}

// Farben speichern
function saveColors(template) {
  localStorage.setItem('colors', JSON.stringify(template));
}

// Funktion zum Anwenden einer Vorlage
function applyTemplate(template) {
  document.body.style.backgroundColor = template.bodyBg;
  document.querySelector('nav').style.backgroundColor = template.navBg;
  document.body.style.color = template.bodyText;

  // Farben speichern
  saveColors(template);
}


document.getElementById('template1').addEventListener('click', () => {
  applyTemplate(templates.template1);
});

document.getElementById('template2').addEventListener('click', () => {
  applyTemplate(templates.template2);
});

document.getElementById('template3').addEventListener('click', () => {
  applyTemplate(templates.template3);
});

document.getElementById('template4').addEventListener('click', () => {
  applyTemplate(templates.template4);
});


applyButton.addEventListener('click', () => {
  const selectedColor = colorPicker.value; // Ausgewählte Farbe
  const selectedElement = elementSelect.value; // Ausgewähltes Element

  if (selectedElement === 'body-bg') {
    document.body.style.backgroundColor = selectedColor;
  } else if (selectedElement === 'nav-bg') {
    document.querySelector('nav').style.backgroundColor = selectedColor;
  } else if (selectedElement === 'body-text') {
    document.body.style.color = selectedColor;
  }

  // Speichere die Änderungen im Local Storage
  const currentColors = {
    bodyBg: document.body.style.backgroundColor,
    navBg: document.querySelector('nav').style.backgroundColor,
    bodyText: document.body.style.color,
  };
  saveColors(currentColors);
});

// Event-Listener für den Zurücksetzen-Button
resetButton.addEventListener('click', () => {
  localStorage.removeItem('colors'); // Farben aus Local Storage entfernen
  document.body.style.backgroundColor = '';
  document.querySelector('nav').style.backgroundColor = '';
  document.body.style.color = '';
});

// Seite initialisieren
loadColors();