//  █████╗ ██╗   ██╗███████╗██████╗ ██╗      █████╗ ██╗   ██╗        ██╗ ██████╗
// ██╔══██╗██║   ██║██╔════╝██╔══██╗██║     ██╔══██╗╚██╗ ██╔╝        ██║██╔════╝
// ██║  ██║╚██╗ ██╔╝█████╗  ██████╔╝██║     ███████║ ╚████╔╝         ██║╚█████╗ 
// ██║  ██║ ╚████╔╝ ██╔══╝  ██╔══██╗██║     ██╔══██║  ╚██╔╝     ██╗  ██║ ╚═══██╗
// ╚█████╔╝  ╚██╔╝  ███████╗██║  ██║███████╗██║  ██║   ██║   ██╗╚█████╔╝██████╔╝
//  ╚════╝    ╚═╝   ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚════╝ ╚═════╝

(function () {

    // Das Intervall-Handle wird gespeichert, damit wir es später mit clearInterval() stoppen können.
    // Ohne das Handle könnte man die Simulation nicht mehr anhalten.
    let intervalId;

    // Referenz auf das <div>-Overlay-Element, das über die ganze Seite gelegt wird.
    let overlay;

    // Referenz auf das <canvas>-Element, auf dem gezeichnet wird.
    let canvas;

    // Der 2D-Rendering-Kontext des Canvas – über ihn laufen alle Zeichenbefehle (fillRect, clearRect usw.)
    let ctx;

    // "grid" ist das aktuelle Gitter (welche Zellen gerade leben).
    // "next" ist der Puffer für den nächsten Schritt – wir berechnen den neuen Zustand dort,
    // damit wir nicht während der Berechnung das grid verändern, von dem wir gerade lesen.
    let grid, next;

    // COLS und ROWS geben an, wie viele Zellen horizontal/vertikal ins Canvas passen.
    // Sie werden in resize() berechnet und sind keine Konstanten, weil sich die Fenstergröße ändern kann.
    let COLS, ROWS;

    // Jede Zelle ist 9x9 Pixel groß. Kleinere Werte = mehr Zellen = feineres Raster, aber mehr Rechenaufwand.
    const CELL_SIZE = 9;

    // Alle 150ms wird ein neuer Simulationsschritt berechnet und gezeichnet.
    // 150ms ≈ ~6.7 Frames pro Sekunde – bewusst langsam, damit die Muster gut erkennbar sind.
    const SPEED = 150;

    // Farbe der lebenden Zellen. rgba(0,0,0,1) = volles Schwarz, vollständig opak.
    // Der Alphawert könnte reduziert werden, um einen "Geist"-Effekt zu erzeugen.
    const FILL_STYLE = "rgba(0,0,0,1)";


    function createOverlay() {

        // Wir erstellen ein <style>-Element und injizieren es in den <head> der Seite.
        // Das ist nötig, weil wir CSS-Regeln für das Overlay und Canvas brauchen,
        // die wir später auch wieder sauber entfernen wollen (per ID "gol-overlay-style").
        const style = document.createElement("style");
        style.id = "gol-overlay-style";
        style.textContent = `
            #life-overlay {
                position: fixed;      /* fixed = immer am Bildschirm, scrollt nicht mit */
                inset: 0;             /* inset: 0 = top/right/bottom/left alle 0 → füllt den ganzen Viewport */
                z-index: 999999;      /* sehr hoher z-index, damit das Overlay über allem anderen liegt */
                pointer-events: none; /* Mausklicks etc. gehen durch das Overlay hindurch zur Seite darunter */
            }
            #life-overlay canvas {
                width: 100%;          /* Das Canvas soll den gesamten Div ausfüllen */
                height: 100%;
                display: block;       /* verhindert den kleinen Leerraum unter inline-Elementen */
            }
        `;
        document.head.appendChild(style);

        // Das eigentliche Overlay-Div wird erstellt und das Canvas darin platziert.
        overlay = document.createElement("div");
        overlay.id = "life-overlay";
        canvas = document.createElement("canvas");
        canvas.id = "life-canvas";
        overlay.appendChild(canvas);
        document.body.appendChild(overlay);

        // Den 2D-Kontext holen – alle späteren draw()-Aufrufe nutzen dieses ctx-Objekt.
        ctx = canvas.getContext("2d");

        // Canvas-Größe setzen, Gitter initialisieren (passiert alles in resize()).
        resize();

        // Die Hauptschleife starten: alle SPEED Millisekunden → loop() → step() + draw()
        intervalId = setInterval(loop, SPEED);

        // Wenn der Nutzer das Fenster vergrößert oder verkleinert, muss das Canvas angepasst
        // und das Gitter neu erstellt werden, weil sich COLS und ROWS ändern.
        window.addEventListener("resize", resize);
    }


    function removeOverlay() {

        // Das Intervall stoppen, damit loop() nicht weiter aufgerufen wird,
        // nachdem das Canvas schon entfernt wurde (würde sonst Fehler werfen).
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }

        // Das Overlay-Div aus dem DOM entfernen (entfernt auch das Canvas als Kind-Element).
        // Alle Referenzen auf null setzen, damit der Garbage Collector den Speicher freigeben kann.
        if (overlay) {
            overlay.remove();
            overlay = null;
            canvas = null;
            ctx = null;
            grid = null;
            next = null;
        }

        // Den injizierten <style>-Block wieder entfernen, damit keine CSS-Leichen bleiben.
        const style = document.getElementById("gol-overlay-style");
        if (style) style.remove();

        console.log("Game of Life Overlay entfernt!");
    }


    function resize() {

        // Canvas-Auflösung auf die tatsächliche Fenstergröße setzen.
        // Wichtig: canvas.width/height ist die Pixelauflösung, nicht die CSS-Größe.
        // Das Setzen dieser Werte löscht auch automatisch den Canvas-Inhalt.
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        // Berechnen, wie viele Zellen nebeneinander (COLS) und untereinander (ROWS) passen.
        // Math.floor rundet ab, damit keine halben Zellen am Rand erscheinen.
        COLS = Math.floor(canvas.width / CELL_SIZE);
        ROWS = Math.floor(canvas.height / CELL_SIZE);

        // Beide Gitter neu erstellen. Das ist nötig, weil sich die Dimensionen geändert haben.
        // Das alte grid wird dabei verworfen – die Simulation startet nach resize() neu.
        grid = createGrid();
        next = createGrid();
    }


    function createGrid() {

        // Wir erstellen ein 2D-Array der Größe ROWS × COLS.
        // Jede Zelle enthält entweder 1 (lebendig) oder 0 (tot).
        const g = new Array(ROWS);

        for (let y = 0; y < ROWS; y++) {
            g[y] = new Array(COLS);

            for (let x = 0; x < COLS; x++) {
                // Mit 15% Wahrscheinlichkeit (random > 0.85) ist eine Zelle am Anfang lebendig.
                // Das erzeugt eine zufällige Startbelegung, aus der sich Muster entwickeln.
                // Höherer Schwellwert = weniger lebende Zellen = ruhigerer Start.
                g[y][x] = Math.random() > 0.85 ? 1 : 0;
            }
        }

        return g;
    }


    function neighbors(x, y) {

        // Zählt die lebenden Nachbarn einer Zelle an Position (x, y).
        // Im Game of Life hat jede Zelle genau 8 Nachbarn (alle 8 umliegenden Felder).
        let n = 0;

        // dy und dx laufen von -1 bis +1, das ergibt alle 9 Positionen im 3x3-Quadrat um die Zelle.
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {

                // Die Zelle selbst (dx=0, dy=0) ist kein Nachbar von sich selbst – überspringen.
                if (dx === 0 && dy === 0) continue;

                // Toroidales (ringförmiges) Gitter: Zellen am Rand "wrappen" zur anderen Seite.
                // Beispiel: Eine Zelle ganz links (x=0) hat als linken Nachbarn die Zelle ganz rechts (x=COLS-1).
                // Das wird durch den Modulo-Trick erreicht:
                // (x + dx + COLS) % COLS stellt sicher, dass negative Werte korrekt umgerechnet werden.
                // Ohne das +COLS würde (-1 % COLS) in JS einen negativen Wert liefern.
                const nx = (x + dx + COLS) % COLS;
                const ny = (y + dy + ROWS) % ROWS;

                // grid[ny][nx] ist 1 wenn lebendig, 0 wenn tot – einfach aufaddieren.
                n += grid[ny][nx];
            }
        }

        return n; // Ergebnis: 0–8
    }


    function step() {

        // Berechnet den nächsten Generationsschritt nach den 4 Regeln von Conway's Game of Life.
        // Wir schreiben das Ergebnis in "next", nicht in "grid", weil alle Zellen
        // gleichzeitig aktualisiert werden müssen – eine Zelle darf den neuen Zustand
        // ihrer Nachbarn nicht sehen, während sie selbst noch berechnet wird.

        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {

                const alive = grid[y][x];       // Ist die Zelle aktuell lebendig? (1 oder 0)
                const n = neighbors(x, y);       // Wie viele lebende Nachbarn hat sie?

                // Die 4 Regeln des Game of Life, zusammengefasst in einem Ausdruck:
                //
                // Regel 1 – Unterbevölkerung:
                //   Eine lebende Zelle mit weniger als 2 Nachbarn stirbt.
                //   → alive && n < 2 → next = 0
                //
                // Regel 2 – Überleben:
                //   Eine lebende Zelle mit 2 oder 3 Nachbarn überlebt.
                //   → alive && (n === 2 || n === 3) → next = 1
                //
                // Regel 3 – Überbevölkerung:
                //   Eine lebende Zelle mit mehr als 3 Nachbarn stirbt.
                //   → alive && n > 3 → next = 0
                //
                // Regel 4 – Reproduktion:
                //   Eine tote Zelle mit genau 3 Nachbarn wird lebendig.
                //   → !alive && n === 3 → next = 1
                //
                // Alle anderen Kombinationen → next = 0 (bleibt tot)
                //
                // Im Code als ternärer Ausdruck:
                next[y][x] = alive && (n === 2 || n === 3) ? 1   // Regel 2: überleben
                           : !alive && n === 3             ? 1   // Regel 4: geburt
                           :                                 0;  // Regel 1 & 3: tod / bleibt tot
            }
        }

        // Jetzt tauschen wir grid und next per Destructuring-Swap.
        // "next" wird das neue "grid", und das alte "grid" wird zum leeren Puffer für den nächsten Schritt.
        // Das ist ein cleverer Trick, um keine neuen Arrays allozieren zu müssen – wir recyceln den Speicher.
        [grid, next] = [next, grid];
    }


    function draw() {

        // Gesamten Canvas löschen, bevor wir neu zeichnen.
        // clearRect(0, 0, breite, höhe) füllt das Rechteck mit transparenten Pixeln.
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Zeichenfarbe für lebende Zellen setzen.
        ctx.fillStyle = FILL_STYLE;

        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {

                // Nur lebende Zellen zeichnen (grid[y][x] === 1).
                // Tote Zellen sind transparent (weil wir clearRect gemacht haben).
                if (grid[y][x]) {
                    // fillRect(pixelX, pixelY, breite, höhe) zeichnet ein gefülltes Rechteck.
                    // x * CELL_SIZE und y * CELL_SIZE rechnen Gitterkoordinaten in Pixelkoordinaten um.
                    ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                }
            }
        }
    }


    function loop() {
        // Die Hauptschleife: Erst Simulationsschritt berechnen, dann das Ergebnis zeichnen.
        // Wird von setInterval alle SPEED Millisekunden aufgerufen.
        step();
        draw();
    }


    // Die beiden Funktionen werden am globalen window-Objekt registriert,
    // damit externer Code (z.B. eine Checkbox im HTML) das Overlay starten und stoppen kann,
    // obwohl die Funktionen eigentlich im privaten IIFE-Scope versteckt sind.
    window.createGameOfLifeOverlay = createOverlay;
    window.removeGameOfLifeOverlay = removeOverlay;

})();