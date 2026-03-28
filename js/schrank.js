
const GRID = {
  TILE_W: 58,
  TILE_H: 33,
  ORIGIN: [600, 50],
};


function isoXY(col, row) {
  const [ox, oy] = GRID.ORIGIN;
  const { TILE_W, TILE_H } = GRID;
  return [
    ox + col * TILE_W / 2 - row * TILE_W / 2,
    oy + col * TILE_H / 2 + row * TILE_H / 2,
  ];
}


function isoFloor(col, row, spanCols, spanRows) {
  return [
    isoXY(col, row + spanRows),  // links
    isoXY(col, row),             // oben
    isoXY(col + spanCols, row),             // rechts
    isoXY(col + spanCols, row + spanRows),  // unten
  ];
}

function buildWalls(floor, wallH = 100) {
  const shift = (pt) => [pt[0], pt[1] + wallH];
  return {
    wallL: [floor[0], shift(floor[0]), shift(floor[3]), floor[3]],
    wallR: [floor[2], shift(floor[2]), shift(floor[3]), floor[3]],
  };
}

// ── Generiert vom MakerAG Editor ──────────────────────────────────────
// Diesen Block in makerAG-lager-v2.html einfügen:
// ROOMS und OBJECTS ersetzen.

// ── Generiert vom MakerAG Editor ──────────────────────────────────────
// Diesen Block in makerAG-lager-v2.html einfügen:
// ROOMS und OBJECTS ersetzen.

const ROOMS = [
  {
    id: 'raum-1',
    label: 'U30',
    col: 0,
    row: 3,
    spanCols: 6,
    spanRows: 5,
    wallH: 100,
  },
  {
    id: 'raum-2',
    label: 'Flur',
    col: 6,
    row: 0,
    spanCols: 3,
    spanRows: 24,
    wallH: 100,
  },
  {
    id: 'raum-3',
    label: 'U26',
    col: 9,
    row: 0,
    spanCols: 6,
    spanRows: 4,
    wallH: 100,
  },
  {
    id: 'raum-4',
    label: 'U25 (MakerAG)',
    col: 9,
    row: 4,
    spanCols: 6,
    spanRows: 6,
    wallH: 100,
  },
  {
    id: 'raum-5',
    label: 'U24',
    col: 9,
    row: 10,
    spanCols: 6,
    spanRows: 8,
    wallH: 100,
  },
];

const OBJECTS = [
  {
    id: '4', name: 'Schrank 4', type: 'cabinet-green',
    gridCol: 10, gridRow: 5,
    zIndex: 5,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=4',
  },
  {
    id: '2', name: 'Schrank 2', type: 'cabinet-green',
    gridCol: 10, gridRow: 8,
    zIndex: 2,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=2',
  },
  {
    id: '1', name: 'Schrank 1', type: 'cabinet-green',
    gridCol: 10, gridRow: 9,
    zIndex: 1,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=1',
  },
  {
    id: '3', name: 'Schrank 3', type: 'cabinet-green',
    gridCol: 10, gridRow: 6,
    zIndex: 4,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=3',
  },
  {
    id: 'S', name: 'MakerAG Schrank', type: 'cabinet-brown',
    gridCol: 10, gridRow: 7,
    zIndex: 3,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=S',
  },
  {
    id: 'A', name: 'Abstellraum', type: 'room',
    gridCol: 2, gridRow: 6,
    zIndex: 0,
    cat: 'Allgemein', loc: 'U30',
    items: null, cap: null,
    link: '/search.html?searchFor=Locker&query=A',
  },
  {
    id: 'NEU-06', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 12,
    zIndex: 2,
    cat: 'Allgemein', loc: 'U24',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-07', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 13,
    zIndex: 1,
    cat: 'Allgemein', loc: 'U24',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-08', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 14, gridRow: 1,
    zIndex: 0,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-09', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 13, gridRow: 1,
    zIndex: 0,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-10', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 12, gridRow: 1,
    zIndex: 0,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-11', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 11, gridRow: 1,
    zIndex: 0,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-12', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 1,
    zIndex: 0,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-13', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 14, gridRow: 4,
    zIndex: 0,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-14', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 13, gridRow: 4,
    zIndex: 0,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-15', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 12, gridRow: 4,
    zIndex: 0,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
];

const OBJECT_TYPES = {
  'cabinet-green': {
    w: 26,
    h: 76,
    d: 14,
    color: {
      top: '#4e7a3c',
      front: '#325228',
      side: '#2a4220',
      label: '#b8860b',
      handle: '#b8860b',
    },
    shelfLines: [],    // keine Regallinien
  },
  'cabinet-brown': {
    w: 30, h: 96, d: 16,
    color: {
      top: '#8a5530',
      front: '#5a3620',
      side: '#4a2c18',
      label: '#c8a415',
      handle: '#c8a415',
    },
    shelfLines: [0.33, 0.66],   // 2 Regalböden bei 33% und 66% der Höhe
  },
  'room': {
    w: 90, h: 28, d: 60,
    color: {
      top: '#c8c2b4',  // Betongrau
      front: '#a8a298',
      side: '#8a8278',
      label: '#5a5650',
      handle: null,
    },
    shelfLines: [],
  },
  'shelf': {
    w: 30, h: 48, d: 16,
    color: {
      top: '#4e7a3c',
      front: '#325228',
      side: '#2a4220',
      label: '#b8860b',
      handle: '#b8860b',
    },
    shelfLines: [0.5],   // 1 Regalboden
  },
};


const LEGEND_LABELS = {
  'cabinet-green': 'Grüne Schränke',
  'cabinet-brown': 'Braune Schränke',
  'room': 'Raum',
  'shelf': 'Regal',
};


/** Hilfsfunktion: Array von Punkten in SVG-Polygon-String umwandeln */
function pts(arr) { return arr.map(p => p.join(',')).join(' '); }

/** Hilfsfunktion: Punkt [x, y] verschieben */
function shift(pt, dx, dy) { return [pt[0] + dx, pt[1] + dy]; }


function esc(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderObject(obj) {
  const def = OBJECT_TYPES?.[obj.type];
  if (!def) return '';

  const [px, py] = isoXY(obj.gridCol, obj.gridRow);
  const { w, h, d, color, shelfLines = [] } = def;

  const depthX = d * 0.5;
  const depthY = d * -0.25;

  const frontTL = [px, py - h];
  const frontTR = [px + w, py - h];
  const frontBR = [px + w, py];
  const frontBL = [px, py];

  const sideTL = [px + depthX, py - h + depthY];
  const sideTR = [px + w + depthX, py - h + depthY];
  const sideBR = [px + w + depthX, py + depthY];
  const sideBL = [px + depthX, py + depthY];

  const frontPts = [frontTL, frontTR, frontBR, frontBL];
  const sidePts = [frontTR, sideTR, sideBR, frontBR]; // rechte Seite sichtbar
  const topPts = [sideTL, sideTR, frontTR, frontTL]; // Top nach oben-rechts

  // --- Türlinie (vertikale Mittellinie auf Frontfläche) ---
  const doorX = px + w * 0.5;
  const doorLine = `<line x1="${doorX}" y1="${py - h + 2}" x2="${doorX}" y2="${py - 2}"
    stroke="${color.side}" stroke-width="0.8" opacity="0.6"/>`;

  // --- Regallinien auf Frontfläche ---
  const shelfSVG = shelfLines.map(t => {
    const sy = py - h + h * t;
    return `<line x1="${px + 1}" y1="${sy}" x2="${px + w - 1}" y2="${sy}"
      stroke="${color.side}" stroke-width="0.7" opacity="0.5"/>`;
  }).join('');

  // --- Griffe: zwei vertikale Linien || ---
  // FIX: x1===x2 (vertikal), y variiert → gibt || statt --
  const handleSVG = color.handle ? `
    <line x1="${px + w * 0.33}" y1="${py - h * 0.42}"
          x2="${px + w * 0.33}" y2="${py - h * 0.32}"
          stroke="${color.handle}" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="${px + w * 0.67}" y1="${py - h * 0.42}"
          x2="${px + w * 0.67}" y2="${py - h * 0.32}"
          stroke="${color.handle}" stroke-width="1.8" stroke-linecap="round"/>` : '';


  // Bodentextur für Raum-Typ
  const roomTexture = def === OBJECT_TYPES['room'] ? `
  <line x1="${px + 10}" y1="${py - 8}"  x2="${px + w - 10}" y2="${py - 8}"  stroke="${color.side}" stroke-width="0.5" opacity="0.3"/>
  <line x1="${px + 10}" y1="${py - 16}" x2="${px + w - 10}" y2="${py - 16}" stroke="${color.side}" stroke-width="0.5" opacity="0.3"/>
  <line x1="${px + w * 0.3}" y1="${py - h + 8}" x2="${px + w * 0.3}" y2="${py - 4}" stroke="${color.side}" stroke-width="0.5" opacity="0.2"/>
  <line x1="${px + w * 0.7}" y1="${py - h + 8}" x2="${px + w * 0.7}" y2="${py - 4}" stroke="${color.side}" stroke-width="0.5" opacity="0.2"/>
` : '';


  // --- Schatten-Overlay auf Frontfläche (untere Hälfte leicht dunkler) ---
  const shadowSVG = `<polygon points="${pts([
    [px, py - h * 0.4], [px + w, py - h * 0.4], frontBR, frontBL
  ])}" fill="black" opacity="0.06"/>`;

  // --- Hover-Highlight auf Topfläche ---
  const hoverSVG = `<polygon class="hover-face"
    points="${pts(topPts)}" fill="white" opacity="0"/>`;

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
    <text x="${px + 2}" y="${py - 2}"
      font-family="'DM Mono',monospace" font-size="7"
      fill="${color.label}" letter-spacing="0.04em">${esc(obj.id)}</text>
  </g>`;
}






// =============================================================================
//  RÄUME RENDERN
// =============================================================================
const roomsLayer = document.getElementById('rooms-layer');
const objectsLayer = document.getElementById('objects-layer');

const roomFragments = ROOMS.map(room => {
  const floor = isoFloor(room.col, room.row, room.spanCols, room.spanRows);
  const { wallL, wallR } = buildWalls(floor, room.wallH ?? 100);

  // Label-Position: Mitte des Bodens
  const lx = (floor[0][0] + floor[2][0]) / 2;
  const ly = (floor[1][1] + floor[3][1]) / 2 + 10;

  return `
    <polygon points="${pts(wallL)}" fill="#d0ccbf" stroke="#b8b4a8" stroke-width="1"/>
    <polygon points="${pts(wallR)}" fill="#bab6a9" stroke="#a8a49a" stroke-width="1"/>
    <polygon points="${pts(floor)}" fill="#e8e4db" stroke="#c8c4ba" stroke-width="1.5"/>
    <polygon points="${pts(floor)}" fill="url(#grid)" opacity="0.6"/>
    <text x="${lx}" y="${ly}"
      font-family="'DM Mono',monospace" font-size="11" fill="#c0bcb4"
      letter-spacing="0.12em" text-anchor="middle">${room.label}</text>`;
});

// join statt innerHTML += in Schleife (vermeidet wiederholtes DOM-Parsen)
roomsLayer.innerHTML = roomFragments.join('');


// =============================================================================
//  OBJEKTE RENDERN
// =============================================================================
objectsLayer.innerHTML = OBJECTS.map(renderObject).join('');


// =============================================================================
//  LEGENDE RENDERN
//  ────────────────
//  Automatisch aus den tatsächlich verwendeten Typen generiert.
//  Kein manuelles Pflegen nötig.
// =============================================================================
const usedTypes = [...new Set(OBJECTS.map(o => o.type))];
const legendEl = document.getElementById('legend');

legendEl.innerHTML = usedTypes
  .filter(type => OBJECT_TYPES[type] && LEGEND_LABELS[type])
  .map(type => {
    const color = OBJECT_TYPES[type].color.top;
    const label = LEGEND_LABELS[type] ?? type;
    return `<div class="legend-item">
      <div class="legend-dot" style="background:${color}"></div>${label}
    </div>`;
  })
  .join('');


// =============================================================================
//  TOOLTIP-LOGIK
// =============================================================================
window.OBJ_MAP = Object.fromEntries(OBJECTS.map(o => [o.id, o]));

const tooltipEl = document.createElement('div');
tooltipEl.className = 'tooltip';
tooltipEl.innerHTML = `
  <div class="tt-id"   id="tt-id"></div>
  <div class="tt-name" id="tt-name"></div>
  <div class="tt-row"><span>Kategorie</span><span id="tt-cat"></span></div>
  <div class="tt-row"><span>Standort</span><span id="tt-loc"></span></div>
  <div class="tt-row"><span>Artikel</span><span id="tt-items"></span></div>
  <div class="tt-bar"><div class="tt-bar-fill" id="tt-bar" style="width:0%"></div></div>
  <div class="tt-cap"  id="tt-cap"></div>
  <div class="tt-hint" id="tt-hint"></div>
`;
document.body.appendChild(tooltipEl);

// Referenzen NACH appendChild — direkt aus tooltipEl heraus
const ttId = tooltipEl.querySelector('#tt-id');
const ttName = tooltipEl.querySelector('#tt-name');
const ttCat = tooltipEl.querySelector('#tt-cat');
const ttLoc = tooltipEl.querySelector('#tt-loc');
const ttItems = tooltipEl.querySelector('#tt-items');
const ttBar = tooltipEl.querySelector('#tt-bar');
const ttCap = tooltipEl.querySelector('#tt-cap');
const ttHint = tooltipEl.querySelector('#tt-hint');

document.getElementById('isomap').addEventListener('mousemove', e => {
  const objEl = e.target.closest('.map-object');
  if (!objEl) { tooltipEl.classList.remove('visible'); return; }

  const obj = OBJ_MAP[objEl.dataset.objid];
  if (!obj) { tooltipEl.classList.remove('visible'); return; }

  const hasFill = obj.items != null && obj.cap != null;
  const fillPct = hasFill ? Math.round(obj.items / obj.cap * 100) : 0;

  ttId.textContent = obj.id;
  ttName.textContent = obj.name;
  ttCat.textContent = obj.cat ?? '—';
  ttLoc.textContent = obj.loc ?? '—';
  ttItems.textContent = hasFill ? `${obj.items} / ${obj.cap}` : '—';
  ttBar.style.width = hasFill ? fillPct + '%' : '0%';
  ttCap.textContent = hasFill ? `${fillPct}% belegt` : '';
  ttHint.textContent = obj.link ? 'Klicken um zu öffnen →' : '';

  tooltipEl.classList.add('visible');

  let tx = e.clientX + 16;
  let ty = e.clientY - 8;
  if (tx + 210 > window.innerWidth) tx = e.clientX - 220;
  if (ty + 160 > window.innerHeight) ty = e.clientY - 160;
  tooltipEl.style.left = tx + 'px';
  tooltipEl.style.top = ty + 'px';
});

document.getElementById('isomap').addEventListener('mouseleave', () => {
  tooltipEl.classList.remove('visible');
});

document.getElementById('isomap').addEventListener('click', e => {
  const objEl = e.target.closest('.map-object');
  if (!objEl) return;
  const obj = OBJ_MAP[objEl.dataset.objid];
  if (obj?.link) {
    window.location.href = obj.link;
  } else if (obj?.loc) {
    window.location.href = `/search.html?searchFor=Raum&query=${encodeURIComponent(obj.loc)}`;
  }
});