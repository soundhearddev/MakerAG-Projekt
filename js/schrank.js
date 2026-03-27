
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

const ROOMS = [
  {
    id: 'raum-1',
    label: 'Abstellraum',
    col: 0,
    row: -1,
    spanCols: 6,
    spanRows: 5,
    wallH: 100,
  },
  {
    id: 'raum-2',
    label: 'Flur',
    col: 6,
    row: -2,
    spanCols: 3,
    spanRows: 24,
    wallH: 100,
  },
  {
    id: 'raum-3',
    label: 'UO26',
    col: 9,
    row: 0,
    spanCols: 6,
    spanRows: 4,
    wallH: 100,
  },
  {
    id: 'raum-4',
    label: 'U025 (MakerAG)',
    col: 9,
    row: 4,
    spanCols: 6,
    spanRows: 6,
    wallH: 100,
  },
  {
    id: 'raum-5',
    label: 'U024',
    col: 9,
    row: 10,
    spanCols: 6,
    spanRows: 8,
    wallH: 100,
  },
];

const OBJECTS = [
  {
    id: 'NEU-01', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 5,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-02', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 6,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-04', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 9,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-05', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 10,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-06', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 12,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-07', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 14,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-08', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 14, gridRow: 1,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-09', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 13, gridRow: 1,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-10', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 12, gridRow: 1,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-11', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 11, gridRow: 1,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-12', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 1,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-13', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 14, gridRow: 4,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-14', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 13, gridRow: 4,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-15', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 12, gridRow: 4,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-03', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 7,
    cat: 'Allgemein', loc: '—',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-16', name: 'Neues Objekt', type: 'cabinet-brown',
    gridCol: 10, gridRow: 8,
    cat: 'Allgemein', loc: '—',
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
  'workbench': {
    w: 90, h: 20, d: 60,
    color: {
      top: '#d4c9a8',
      front: '#b8ad90',
      side: '#a09880',
      label: '#8a8270',
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
  'workbench': 'Werkbank',
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

  // FRONTALE ORIENTIERUNG (90° gedreht)
  const depthX = d * 0.5;
  const depthY = d * 0.25;

  const frontTL = [px, py - h];
  const frontTR = [px + w, py - h];
  const frontBR = [px + w, py];
  const frontBL = [px, py];

  const sideTL = [px + depthX, py - h - depthY];
  const sideTR = [px + w + depthX, py - h - depthY];
  const sideBR = [px + w + depthX, py - depthY];
  const sideBL = [px + depthX, py - depthY];

  const frontPts = [frontTL, frontTR, frontBR, frontBL];
  const sidePts = [sideTR, sideTL, sideBL, sideBR];
  const topPts = [sideTL, sideTR, frontTR, frontTL];



  const handleSVG = color.handle ? `
  <line x1="${px + w * 0.25}" y1="${py - h * 0.5}" x2="${px + w * 0.45}" y2="${py - h * 0.5}" 
        stroke="${color.handle}" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="${px + w * 0.55}" y1="${py - h * 0.5}" x2="${px + w * 0.75}" y2="${py - h * 0.5}" 
        stroke="${color.handle}" stroke-width="1.5" stroke-linecap="round"/>` : '';


  return `<g class="map-object" data-objid="${esc(obj.id)}">
    <polygon points="${pts(sidePts)}" fill="${color.side}"/>
    <polygon points="${pts(frontPts)}" fill="${color.front}"/>
    ${handleSVG}
    <polygon points="${pts(topPts)}" fill="${color.top}"/>
    <text x="${px + 3}" y="${py - 2}" font-size="7" fill="${color.label}">${esc(obj.id)}</text>
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
//  ──────────────
//  Verwendet Event Delegation: ein einziger Listener auf dem SVG statt
//  N Listener für N Objekte. Skaliert besser bei vielen Objekten.
// =============================================================================
const tooltip = document.getElementById('tooltip');
const ttId = document.getElementById('tt-id');
const ttName = document.getElementById('tt-name');
const ttCat = document.getElementById('tt-cat');
const ttLoc = document.getElementById('tt-loc');
const ttItems = document.getElementById('tt-items');
const ttBar = document.getElementById('tt-bar');
const ttCap = document.getElementById('tt-cap');
const ttHint = document.getElementById('tt-hint');

/** Findet das nächste Elternelement mit Klasse "map-object" */
function findObject(el) {
  return el.closest('.map-object');
}

document.getElementById('isomap').addEventListener('mousemove', e => {
  const objEl = findObject(e.target);
  if (!objEl) {
    tooltip.classList.remove('visible');
    return;
  }

  const obj = OBJ_MAP[objEl.dataset.objid];
  if (!obj) return;

  // Daten aus Original-Objekt — kein String-Parsing nötig
  const hasFill = obj.items != null && obj.cap != null;
  const fillPct = hasFill ? Math.round(obj.items / obj.cap * 100) : 0;

  ttId.textContent = obj.id;
  ttName.textContent = obj.name;
  ttCat.textContent = obj.cat ?? '—';
  ttLoc.textContent = obj.loc ?? '—';
  ttItems.textContent = hasFill ? `${obj.items} von ${obj.cap}` : '—';
  ttBar.style.width = hasFill ? fillPct + '%' : '0%';
  ttCap.textContent = hasFill ? `${fillPct}% belegt` : '';
  ttHint.textContent = obj.link ? 'Klicken um zu öffnen →' : '';

  tooltip.classList.add('visible');

  // Tooltip-Position: rechts vom Cursor, flippt wenn zu nah am Rand
  let x = e.clientX + 18, y = e.clientY - 10;
  if (x + 220 > window.innerWidth) x = e.clientX - 230;
  if (y + 220 > window.innerHeight) y = e.clientY - 220;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
});

document.getElementById('isomap').addEventListener('mouseleave', () => {
  tooltip.classList.remove('visible');
});

// Klick-Handler mit Event Delegation
document.getElementById('isomap').addEventListener('click', e => {
  const objEl = findObject(e.target);
  if (!objEl) return;
  const obj = OBJ_MAP[objEl.dataset.objid];
  if (obj?.link) window.location.href = obj.link;
});