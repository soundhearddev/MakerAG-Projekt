const formen = ["dreieck", "viereck", "kreis"];
const farben = ["red", "green", "blue", "yellow", "purple", "orange", "pink", "brown"];

const rand = arr => arr[Math.floor(Math.random() * arr.length)];
const pos = () => Math.floor(Math.random() * 90) + "%";


function createForm(container = document.body) {
    const el = document.createElement("div");
    const form = rand(formen), color = rand(farben);
    el.className = `formbox ${form}`;
    el.style = `position:absolute;top:${pos()};left:${pos()};${form === "dreieck" ? `border-bottom-color:${color};` : `background:${color};`}`;
    el.onclick = e => { e.target.remove(); spawnForms(2); };
    container.appendChild(el);
}

function randomizeForms() {
    document.querySelectorAll(".formbox").forEach(el => {
        const form = rand(formen), color = rand(farben);
        el.className = 'formbox ${form}';
        el.style = `position:absolute;top:${pos()};left:${pos()};${form === "dreieck" ? `border-bottom-color:${color};` : `background:${color};`}`;
    });
}


function setupStartButton() {
    const btn = document.getElementById("transformStartButton");
    if (btn) btn.onclick = () => { createForm(); btn.style.display = "none"; }; // Button wird unsichtbar wenn er gedrückt wird
}

function spawnForms(n = 2) {
    while (n--) createForm(); // (n--) = n - 1 schleife läuft so lange bis n = 0 ist
}

// initialise die Seite mit den ganzen funktionen
function init() {
    randomizeForms();

    document.querySelectorAll(".formbox").forEach(el => el.onclick = e => { e.target.remove(); spawnForms(2); });
    setupStartButton();
}

init();
