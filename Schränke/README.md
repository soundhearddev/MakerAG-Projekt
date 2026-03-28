03.01.2026

Mein plan für die Schränke ist es eine art renderung der SChränke oder Räume zu haben und man kann dann auf des Reagl drücken um auf dei Regale zu zoomen und dann in diesen regalen wird dann modular alles angezeigt also die items in den Regalen. und man kann dann auf die items klicken um auf die dokumentation von diesen zu kommen. also dafür muss halt bei jedem item der Schrank, Lage (in der höhe), und halt optional genauer ort. 

Das einzige problem dabei sit es, wenn jemand ein Gegenstand Raussimmt und es nciht zurücktut oder halt woander hintut, dann wird es immenoch dort angezigt. 

Ich habe eine IDEE so eine art Isometric sicht auf die räume und halt aso auf die schränke wo dann der klick auf die schränkle dann halt den inhalt anzeigt. ich werde es eifnahc in den docs gleich eintragen




```

// ── Generiert vom MakerAG Editor ──────────────────────────────────────
// Diesen Block in makerAG-lager-v2.html einfügen:
// ROOMS und OBJECTS ersetzen.

const ROOMS = [
  {
    id:       'raum-1',
    label:    'U30',
    col:      0,
    row:      3,
    spanCols: 6,
    spanRows: 5,
    wallH:    100,
  },
  {
    id:       'raum-2',
    label:    'Flur',
    col:      6,
    row:      0,
    spanCols: 3,
    spanRows: 24,
    wallH:    100,
  },
  {
    id:       'raum-3',
    label:    'U26',
    col:      9,
    row:      0,
    spanCols: 6,
    spanRows: 4,
    wallH:    100,
  },
  {
    id:       'raum-4',
    label:    'U25 (MakerAG)',
    col:      9,
    row:      4,
    spanCols: 6,
    spanRows: 6,
    wallH:    100,
  },
  {
    id:       'raum-5',
    label:    'U24',
    col:      9,
    row:      10,
    spanCols: 6,
    spanRows: 8,
    wallH:    100,
  },
];

const OBJECTS = [
  {
    id: '4', name: 'Schrank 4', type: 'cabinet-green',
    gridCol: 10, gridRow: 5,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: null,
  },
  {
    id: '04', name: 'Schrank 2', type: 'cabinet-green',
    gridCol: 10, gridRow: 8,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: null,
  },
  {
    id: '3', name: 'Schrank 1', type: 'cabinet-green',
    gridCol: 10, gridRow: 9,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-06', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 12,
    cat: 'Allgemein', loc: 'U24',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-07', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 13,
    cat: 'Allgemein', loc: 'U24',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-08', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 14, gridRow: 1,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-09', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 13, gridRow: 1,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-10', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 12, gridRow: 1,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-11', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 11, gridRow: 1,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-12', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 10, gridRow: 1,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-13', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 14, gridRow: 4,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-14', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 13, gridRow: 4,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'NEU-15', name: 'Neues Objekt', type: 'cabinet-green',
    gridCol: 12, gridRow: 4,
    cat: 'Allgemein', loc: 'U26',
    items: null, cap: null,
    link: null,
  },
  {
    id: '3', name: 'Schrank 3', type: 'cabinet-green',
    gridCol: 10, gridRow: 6,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'S', name: 'MakerAG Schrank', type: 'cabinet-brown',
    gridCol: 10, gridRow: 7,
    cat: 'Allgemein', loc: 'U25',
    items: null, cap: null,
    link: null,
  },
  {
    id: 'A', name: 'Abstellraum', type: 'workbench',
    gridCol: 2, gridRow: 6,
    cat: 'Allgemein', loc: 'U30',
    items: null, cap: null,
    link: null,
  },
];
```