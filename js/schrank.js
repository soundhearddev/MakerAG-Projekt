//  ██████╗ █████╗ ██╗  ██╗██████╗  █████╗ ███╗  ██╗██╗  ██╗        ██╗ ██████╗
// ██╔════╝██╔══██╗██║  ██║██╔══██╗██╔══██╗████╗ ██║██║ ██╔╝        ██║██╔════╝
// ╚█████╗ ██║  ╚═╝███████║██████╔╝███████║██╔██╗██║█████═╝         ██║╚█████╗ 
//  ╚═══██╗██║  ██╗██╔══██║██╔══██╗██╔══██║██║╚████║██╔═██╗    ██╗  ██║ ╚═══██╗
// ██████╔╝╚█████╔╝██║  ██║██║  ██║██║  ██║██║ ╚███║██║ ╚██╗██╗╚█████╔╝██████╔╝
// ╚═════╝  ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚══╝╚═╝  ╚═╝╚═╝ ╚════╝ ╚═════╝ 





// ============================================================
//  GITTER-EINSTELLUNGEN
// ============================================================

// GRID = die Grundeinstellungen für das isometrische Raster.
// Isometrisch bedeutet: Die Karte ist leicht schräg gekippt,
// wie in klassischen Aufbau-Spielen (z.B. SimCity).
const GRID = {
  TILE_W: 58,         // Breite einer Kachel in Pixeln
  TILE_H: 33,         // Höhe einer Kachel in Pixeln (halb so hoch wie breit → schräger Effekt)
  ORIGIN: [600, 50],  // Startpunkt (x, y) der Karte auf dem Bildschirm
};

// ============================================================
//  HILFSFUNKTION: Rasterposition → Bildschirmposition umrechnen
// ============================================================

// isoXY rechnet eine Rasterposition (col = Spalte, row = Zeile)
// in echte Bildschirmkoordinaten um.
// Das ist die Kerntransformation für die isometrische Ansicht.
function isoXY(col, row) {
  const [ox, oy] = GRID.ORIGIN;        // Startpunkt auslesen
  const { TILE_W, TILE_H } = GRID;     // Kachelgröße auslesen

  return [
    // x-Position: Spalten gehen nach rechts, Zeilen nach links
    ox + (col * TILE_W) / 2 - (row * TILE_W) / 2,
    // y-Position: Beide Richtungen gehen nach unten (isometrischer Effekt)
    oy + (col * TILE_H) / 2 + (row * TILE_H) / 2,
  ];
}

// ============================================================
//  HILFSFUNKTION: Boden-Viereck eines Raumes berechnen
// ============================================================

// isoFloor berechnet die 4 Eckpunkte der Bodenfläche eines Raumes.
// col/row = Position im Raster, spanCols/spanRows = Größe des Raumes
// Gibt ein Array mit 4 Punkten zurück: links, oben, rechts, unten.
function isoFloor(col, row, spanCols, spanRows) {
  return [
    isoXY(col, row + spanRows), // Linke Ecke
    isoXY(col, row),            // Obere Ecke
    isoXY(col + spanCols, row),           // Rechte Ecke
    isoXY(col + spanCols, row + spanRows),// Untere Ecke
  ];
}

// ============================================================
//  HILFSFUNKTION: Wände aus dem Boden ableiten
// ============================================================

// buildWalls berechnet die linke und rechte Wand eines Raumes.
// Es nimmt die Bodenpunkte und verschiebt sie nach oben (um wallH Pixel),
// um die Höhe der Wände darzustellen.
function buildWalls(floor, wallH = 100) {
  // shift verschiebt einen Punkt um wallH Pixel nach oben
  const shift = (pt) => [pt[0], pt[1] + wallH];

  return {
    // Linke Wand: von links-unten nach links-oben
    wallL: [floor[0], shift(floor[0]), shift(floor[3]), floor[3]],
    // Rechte Wand: von rechts-unten nach rechts-oben
    wallR: [floor[2], shift(floor[2]), shift(floor[3]), floor[3]],
  };
}





// NOTE: OBERSCHNRÄCKENOCH IHNZUÜFENG LASO FUNKTION UND SO ALLES HALT DAS!!!!

// ============================================================
//  DATEN: RÄUME
// ============================================================

// ROOMS = Liste aller Räume auf der Karte.
// Jeder Raum hat:
//   id       = eindeutiger Name (intern)
//   label    = sichtbare Beschriftung auf der Karte
//   col/row  = Position im Raster (Spalte / Zeile)
//   spanCols/spanRows = Größe des Raumes in Rasterzellen
//   wallH    = Wandhöhe in Pixeln
const ROOMS = [
  {
    id: '06-UG-06/07',
    label: 'Lager',
    col: 1,
    row: 0,
    spanCols: 5,
    spanRows: 3,
    wallH: 50,
  },
  {
    id: 'flur',
    label: 'Flur',
    col: 6,
    row: 0,
    spanCols: 3,
    spanRows: 24,
    wallH: 50,
  },
  {
    id: 'U26',
    label: 'U26',
    col: 9,
    row: 1,
    spanCols: 6,
    spanRows: 4,
    wallH: 50,
  },
  {
    id: '06-UG-13',
    label: 'U25 (Computerwerkstatt)',
    col: 9,
    row: 5,
    spanCols: 6,
    spanRows: 6,
    wallH: 50,
  },
  {
    id: 'U24',
    label: 'U24',
    col: 9,
    row: 11,
    spanCols: 6,
    spanRows: 8,
    wallH: 50,
  },
];

// ============================================================
//  DATEN: OBJEKTE (Schränke, Räume, Fach usw.)
// ============================================================

// OBJECTS = Liste aller platzierten Objekte auf der Karte.
// Jedes Objekt hat:
//   id       = eindeutiger Name (z.B. "1", "S", "A")
//   name     = Anzeigename im Tooltip
//   type     = welches Aussehen? (z.B. "cabinet-green", "room")
//   gridCol/gridRow = Rasterposition auf der Karte
//   zIndex   = Anzeigereihenfolge (höher = weiter vorne)
//   cat      = Kategorie (z.B. "Allgemein")
//   loc      = In welchem Raum befindet sich das Objekt?
//   items/cap = Belegung (wie voll ist der Schrank?)
//   link     = URL, die beim Klicken geöffnet wird
const OBJECTS = [
  {
    id: '2', name: 'Schrank 2', type: 'cabinet-green',
    gridCol: 10, gridRow: 9,
    zIndex: 2,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=2',
  },
  {
    id: '1', name: 'Schrank 1', type: 'cabinet-green',
    gridCol: 10, gridRow: 10,
    zIndex: 1,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=1',
  },
  {
    id: '3', name: 'Schrank 3', type: 'cabinet-green',
    gridCol: 10, gridRow: 7,
    zIndex: 4,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=3',
  },
  {
    id: 'S', name: 'MakerAG Schrank', type: 'cabinet-brown',
    gridCol: 10, gridRow: 8,
    zIndex: 3,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=S',
  },
  {
    id: 'L', name: 'Lager', type: 'room',
    gridCol: 2, gridRow: 3,
    zIndex: 0,
    cat: 'Allgemein', loc: '06-UG-06/07',
    items: null, cap: null,
    link: '/search.html?searchFor=Raum&query=Lager',
  },
  {
    id: '12', name: 'Schrank 12', type: 'cabinet-green',
    gridCol: 10, gridRow: 13,
    zIndex: 1,
    cat: 'Allgemein', loc: 'U24',
    items: null, cap: null,
    link: null,
  },
  {
    id: '8', name: 'Schrank 8', type: 'cabinet-green',
    gridCol: 13, gridRow: 2,
    zIndex: 0,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=8',
  },
  {
    id: '7', name: 'Schrank 7', type: 'cabinet-green',
    gridCol: 12, gridRow: 2,
    zIndex: 0,
    cat: 'Netzwerk', loc: 'U26',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=7',
  },
  {
    id: '6', name: 'Schrank 6', type: 'cabinet-green',
    gridCol: 11, gridRow: 2,
    zIndex: 0,
    cat: 'Elektrotechnik', loc: 'U26',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=6',
  },
  {
    id: '5', name: 'Schrank 5', type: 'cabinet-green',
    gridCol: 10, gridRow: 2,
    zIndex: 0,
    cat: 'Hardware', loc: 'U26',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=5',
  },
  {
    id: '9', name: 'Schrank 9', type: 'cabinet-green',
    gridCol: 14, gridRow: 2,
    zIndex: 0,
    cat: 'Lehrerschrank', loc: 'U26',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=9',
  },
  {
    id: '10', name: 'Schrank 10', type: 'cabinet-green',
    gridCol: 14, gridRow: 5,
    zIndex: 0,
    cat: 'Hardware', loc: 'U26',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=10',
  },
  {
    id: '11', name: 'Schrank 11', type: 'cabinet-green',
    gridCol: 13, gridRow: 5,
    zIndex: 0,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=11',
  },
  {
    id: '4', name: 'Schrank 4', type: 'cabinet-green',
    gridCol: 10, gridRow: 6,
    zIndex: 0,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=4',
  },
];
// ============================================================
//  DATEN: OBJEKT-TYPEN (Aussehen & Farbe)
// ============================================================

// OBJECT_TYPES = definiert, wie jeder Objekttyp aussieht.
// w = Breite, h = Höhe, d = Tiefe (in Pixeln, für die 3D-Darstellung)
// color = Farben für die verschiedenen Flächen (top, front, side, label, handle)
// shelfLines = auf welcher Höhe werden Regalböden gezeichnet (als Anteil 0-1)
const OBJECT_TYPES = {
  "cabinet-green": {
    w: 26, h: 76, d: 14,
    color: { top: "#4e7a3c", front: "#325228", side: "#2a4220", label: "#b8860b", handle: "#b8860b" },
    shelfLines: [], // keine Regalböden
  },
  "cabinet-brown": {
    w: 26, h: 76, d: 14,
    color: { top: "#8a5530", front: "#5a3620", side: "#4a2c18", label: "#c8a415", handle: "#c8a415" },
  },
  "room": {
    w: 90, h: 28, d: 60,
    color: { top: "#c8c2b4", front: "#a8a298", side: "#8a8278", label: "#5a5650", handle: null },
    shelfLines: [],
  },
  "shelf": {
    w: 30, h: 48, d: 16,
    color: { top: "#4e7a3c", front: "#325228", side: "#2a4220", label: "#b8860b", handle: "#b8860b" },
    shelfLines: [0.5], // 1 Regalboden in der Mitte
  },
};

// Beschriftungen für die Legende (was bedeutet welcher Typ?)
const LEGEND_LABELS = {
  "cabinet-green": "Grüne Schränke",
  "cabinet-brown": "Braune Schränke",
  "room": "Raum",
  "shelf": "Fach",
};


// ============================================================
//  KLEINE HILFSFUNKTIONEN
// ============================================================

// pts wandelt ein Array von [x,y]-Punkten in einen SVG-Polygon-String um.
// Beispiel: [[10,20],[30,40]] → "10,20 30,40"
function pts(arr) {
  return arr.map((p) => p.join(",")).join(" ");
}

// shift verschiebt einen Punkt [x,y] um (dx, dy) Pixel.
function shift(pt, dx, dy) {
  return [pt[0] + dx, pt[1] + dy];
}

// esc macht Sonderzeichen in Texten für HTML sicher (verhindert Angriffe).
// z.B. "<" wird zu "&lt;" damit es nicht als HTML-Tag interpretiert wird.
function esc(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


// ============================================================
//  FUNKTION: Ein einzelnes Objekt als SVG zeichnen
// ============================================================

// renderObject nimmt ein Objekt aus OBJECTS und gibt SVG-Code zurück,
// der das Objekt als 3D-Klotz auf der Karte darstellt.
function renderObject(obj) {
  // Prüfen ob der Typ bekannt ist. Wenn nicht → nichts zeichnen.
  const def = OBJECT_TYPES?.[obj.type];
  if (!def) return "";

  // Bildschirmposition berechnen (aus Rasterposition)
  const [px, py] = isoXY(obj.gridCol, obj.gridRow);

  // Maße und Farben aus der Typdefinition lesen
  const { w, h, d, color, shelfLines = [] } = def;

  // Tiefe = wie weit das Objekt nach hinten ragt (isometrischer Versatz)
  const depthX = d * 0.5;   // nach rechts versetzt
  const depthY = d * -0.25; // nach oben versetzt

  // ── Die 4 Ecken der Frontfläche berechnen ──
  // Das Objekt hängt "oben" am Punkt (px, py), die Höhe geht nach oben
  const frontTL = [px, py - h]; // Vorne oben links
  const frontTR = [px + w, py - h]; // Vorne oben rechts
  const frontBR = [px + w, py];     // Vorne unten rechts
  const frontBL = [px, py];     // Vorne unten links

  // ── Die 4 Ecken der hinteren Seite berechnen (nach rechts/oben versetzt) ──
  const sideTL = [px + depthX, py - h + depthY]; // Hinten oben links
  const sideTR = [px + w + depthX, py - h + depthY]; // Hinten oben rechts
  const sideBR = [px + w + depthX, py + depthY];     // Hinten unten rechts
  const sideBL = [px + depthX, py + depthY];     // Hinten unten links

  // ── Die 3 sichtbaren Flächen festlegen ──
  const frontPts = [frontTL, frontTR, frontBR, frontBL]; // Vorderseite
  const sidePts = [frontTR, sideTR, sideBR, frontBR]; // Rechte Seite (sichtbar)
  const topPts = [sideTL, sideTR, frontTR, frontTL]; // Oberseite (Deckel)

  // ── Türlinie: vertikale Linie in der Mitte der Vorderseite ──
  const doorX = px + w * 0.5;
  const doorLine = `<line x1="${doorX}" y1="${py - h + 2}" x2="${doorX}" y2="${py - 2}"
    stroke="${color.side}" stroke-width="0.8" opacity="0.6"/>`;

  // ── Regalböden: horizontale Linien auf der Vorderseite ──
  // shelfLines enthält Prozentwerte (0=oben, 1=unten), wo Regalböden sind
  const shelfSVG = shelfLines
    .map((t) => {
      const sy = py - h + h * t; // y-Position des Regalbodens
      return `<line x1="${px + 1}" y1="${sy}" x2="${px + w - 1}" y2="${sy}"
      stroke="${color.side}" stroke-width="0.7" opacity="0.5"/>`;
    })
    .join("");

  // ── Griffe: zwei kurze vertikale Linien ( || ) auf der Vorderseite ──
  // Nur zeichnen wenn handle-Farbe definiert ist (Räume haben keinen Griff)
  const handleSVG = color.handle
    ? `
    <line x1="${px + w * 0.33}" y1="${py - h * 0.42}"
          x2="${px + w * 0.33}" y2="${py - h * 0.32}"
          stroke="${color.handle}" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="${px + w * 0.67}" y1="${py - h * 0.42}"
          x2="${px + w * 0.67}" y2="${py - h * 0.32}"
          stroke="${color.handle}" stroke-width="1.8" stroke-linecap="round"/>`
    : "";

  // ── Bodentextur für Raum-Objekte (Gitterlinien) ──
  // Nur bei Typ "room" werden schwache Rasterlinien eingezeichnet
  const roomTexture =
    def === OBJECT_TYPES["room"]
      ? `
  <line x1="${px + 10}" y1="${py - 8}"  x2="${px + w - 10}" y2="${py - 8}"  stroke="${color.side}" stroke-width="0.5" opacity="0.3"/>
  <line x1="${px + 10}" y1="${py - 16}" x2="${px + w - 10}" y2="${py - 16}" stroke="${color.side}" stroke-width="0.5" opacity="0.3"/>
  <line x1="${px + w * 0.3}" y1="${py - h + 8}" x2="${px + w * 0.3}" y2="${py - 4}" stroke="${color.side}" stroke-width="0.5" opacity="0.2"/>
  <line x1="${px + w * 0.7}" y1="${py - h + 8}" x2="${px + w * 0.7}" y2="${py - 4}" stroke="${color.side}" stroke-width="0.5" opacity="0.2"/>
`
      : "";

  // ── Schatten-Overlay: dunkle Fläche im unteren Bereich der Vorderseite ──
  // Gibt den Schränken einen leichten 3D-Schatteneffekt
  const shadowSVG = `<polygon points="${pts([
    [px, py - h * 0.4],  // links, 40% Höhe
    [px + w, py - h * 0.4], // rechts, 40% Höhe
    frontBR, frontBL,
  ])}" fill="black" opacity="0.06"/>`;

  // ── Hover-Highlight: unsichtbares Polygon auf der Oberseite ──
  // Wird per CSS sichtbar gemacht wenn man mit der Maus drüber fährt
  const hoverSVG = `<polygon class="hover-face"
    points="${pts(topPts)}" fill="white" opacity="0"/>`;

  // ── Alles zusammenbauen: Objekt als SVG-Gruppe (<g>) zurückgeben ──
  // Reihenfolge: erst rechte Seite, dann Vorderseite, dann Deckel (hinten → vorne)
  return `<g class="map-object" data-objid="${esc(obj.id)}">
    <polygon points="${pts(sidePts)}"  fill="${color.side}"/>
    <polygon points="${pts(frontPts)}" fill="${color.front}"/>
    ${shadowSVG}
    ${doorLine}
    ${shelfSVG}
    ${roomTexture}
    ${handleSVG}
    <polygon points="${pts(topPts)}"   fill="${color.top}"/>
    ${hoverSVG}
  </g>`;
}


// ============================================================
//  RÄUME AUF DIE KARTE ZEICHNEN
// ============================================================

// Die SVG-Gruppen für Räume und Objekte aus dem HTML holen
const roomsLayer = document.getElementById("rooms-layer");
const objectsLayer = document.getElementById("objects-layer");

// Für jeden Raum: Boden und Wände berechnen, dann als SVG-String speichern
const roomFragments = ROOMS.map((room) => {
  // Boden-Viereck berechnen
  const floor = isoFloor(room.col, room.row, room.spanCols, room.spanRows);
  // Wände aus dem Boden ableiten
  const { wallL, wallR } = buildWalls(floor, room.wallH ?? 100);

  // Mitte des Bodens berechnen → dort kommt das Label hin
  const lx = (floor[0][0] + floor[2][0]) / 2;
  const ly = (floor[1][1] + floor[3][1]) / 2 + 10;

  // SVG-Polygone für linke Wand, rechte Wand, Boden und Beschriftung
  return `
    <polygon points="${pts(wallL)}" fill="#d0ccbf" stroke="#b8b4a8" stroke-width="1"/>
    <polygon points="${pts(wallR)}" fill="#bab6a9" stroke="#a8a49a" stroke-width="1"/>
    <polygon points="${pts(floor)}" fill="#e8e4db" stroke="#c8c4ba" stroke-width="1.5"/>
    <polygon points="${pts(floor)}" fill="url(#grid)" opacity="0.6"/>
    <text x="${lx}" y="${ly + 4}"
      font-size="15" font-weight="600" fill="black"
      letter-spacing="0.12em" text-anchor="middle">${room.label}</text>`;
});

// Alle Raum-SVGs auf einmal ins DOM einfügen (effizienter als einzelne Inserts)
roomsLayer.innerHTML = roomFragments.join("");


// ============================================================
//  OBJEKTE AUF DIE KARTE ZEICHNEN
// ============================================================

// Für jedes Objekt renderObject() aufrufen und das Ergebnis einfügen
objectsLayer.innerHTML = OBJECTS.map(renderObject).join("");


// ============================================================
//  TOOLTIP-LOGIK (Info-Kasten beim Hover)
// ============================================================

// OBJ_MAP = schnelle Suche: Objekt-ID → Objekt-Daten
// So kann man bei Mausbewegung sofort das richtige Objekt finden
window.OBJ_MAP = Object.fromEntries(OBJECTS.map((o) => [o.id, o]));

// Tooltip-Element erstellen und mit HTML befüllen
// Dieser Kasten erscheint wenn man mit der Maus über ein Objekt fährt
const tooltipEl = document.createElement("div");
tooltipEl.className = "tooltip";
tooltipEl.innerHTML = `
  <div class="tt-id"   id="tt-id"></div>
  <div class="tt-name" id="tt-name"></div>
  <div class="tt-row"><span>Kategorie</span><span id="tt-cat"></span></div>
  <div class="tt-row"><span>Standort</span><span id="tt-loc"></span></div>
  <div class="tt-bar"><div class="tt-bar-fill" id="tt-bar" style="width:0%"></div></div>
  <div class="tt-cap"  id="tt-cap"></div>
  <div class="tt-hint" id="tt-hint"></div>
`;
document.body.appendChild(tooltipEl);

// Einzelne Elemente im Tooltip für schnellen Zugriff speichern
const ttId = tooltipEl.querySelector("#tt-id");
const ttName = tooltipEl.querySelector("#tt-name");
const ttCat = tooltipEl.querySelector("#tt-cat");
const ttLoc = tooltipEl.querySelector("#tt-loc");
const ttBar = tooltipEl.querySelector("#tt-bar");
const ttCap = tooltipEl.querySelector("#tt-cap");
const ttHint = tooltipEl.querySelector("#tt-hint");

// ── Mausbewegung: Tooltip anzeigen und positionieren ──
document.getElementById("isomap").addEventListener("mousemove", (e) => {
  // Prüfen ob die Maus über einem Objekt ist (.map-object Klasse)
  const objEl = e.target.closest(".map-object");
  if (!objEl) {
    tooltipEl.classList.remove("visible"); // kein Objekt → Tooltip verstecken
    return;
  }

  // Daten des angeklickten Objekts aus OBJ_MAP laden
  const obj = OBJ_MAP[objEl.dataset.objid];
  if (!obj) {
    tooltipEl.classList.remove("visible");
    return;
  }

  // Belegung berechnen (items/cap = wie voll ist der Schrank?)
  const hasFill = obj.items != null && obj.cap != null;
  const fillPct = hasFill ? Math.round((obj.items / obj.cap) * 100) : 0;

  // Tooltip-Inhalt befüllen
  ttId.textContent = obj.id;
  ttName.textContent = obj.name;
  ttCat.textContent = obj.cat ?? "—";
  ttLoc.textContent = obj.loc ?? "—";
  ttBar.style.width = hasFill ? fillPct + "%" : "0%"; // Fortschrittsbalken
  ttCap.textContent = hasFill ? `${fillPct}% belegt` : "";
  ttHint.textContent = obj.link ? "Klicken um zu öffnen →" : "";

  tooltipEl.classList.add("visible"); // Tooltip sichtbar machen

  // Tooltip-Position: normalerweise rechts/oben von der Maus
  // Falls er aus dem Bildschirm ragt → auf die andere Seite klappen
  let tx = e.clientX + 16;
  let ty = e.clientY - 8;
  if (tx + 210 > window.innerWidth) tx = e.clientX - 220; // zu weit rechts → nach links
  if (ty + 160 > window.innerHeight) ty = e.clientY - 160; // zu weit unten → nach oben
  tooltipEl.style.left = tx + "px";
  tooltipEl.style.top = ty + "px";
});

// ── Maus verlässt die Karte: Tooltip verstecken ──
document.getElementById("isomap").addEventListener("mouseleave", () => {
  tooltipEl.classList.remove("visible");
});

// ── Klick auf ein Objekt: zur verlinkten Seite navigieren ──
document.getElementById("isomap").addEventListener("click", (e) => {
  const objEl = e.target.closest(".map-object");
  if (!objEl) return;

  const obj = OBJ_MAP[objEl.dataset.objid];
  if (obj?.link) {
    // Objekt hat einen direkten Link → dorthin navigieren
    window.location.href = obj.link;
  } else if (obj?.loc) {
    // Kein Link, aber ein Raumname → Suche nach dem Raum öffnen
    window.location.href = `/search.html?searchFor=Raum&query=${encodeURIComponent(obj.loc)}`;
  }
});