(function () {
    let intervalId;
    let overlay;
    let canvas;
    let ctx;
    let grid, next;
    let COLS, ROWS;

    const CELL_SIZE = 9;
    const SPEED = 150;
    const FILL_STYLE = "rgba(0,0,0,1)";

    function createOverlay() {
        // Style
        const style = document.createElement("style");
        style.id = "gol-overlay-style";
        style.textContent = `
            #life-overlay {
                position: fixed;
                inset: 0;
                z-index: 999999;
                pointer-events: none;
            }
            #life-overlay canvas {
                width: 100%;
                height: 100%;
                display: block;
            }
        `;
        document.head.appendChild(style);

        // Overlay und Canvas
        overlay = document.createElement("div");
        overlay.id = "life-overlay";
        canvas = document.createElement("canvas");
        canvas.id = "life-canvas";
        overlay.appendChild(canvas);
        document.body.appendChild(overlay);
        ctx = canvas.getContext("2d");

        resize();
        intervalId = setInterval(loop, SPEED);
        window.addEventListener("resize", resize);
    }

    function removeOverlay() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (overlay) {
            overlay.remove();
            overlay = null;
            canvas = null;
            ctx = null;
            grid = null;
            next = null;
        }
        const style = document.getElementById("gol-overlay-style");
        if (style) style.remove();
        console.log("Game of Life Overlay entfernt!");
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        COLS = Math.floor(canvas.width / CELL_SIZE);
        ROWS = Math.floor(canvas.height / CELL_SIZE);
        grid = createGrid();
        next = createGrid();
    }

    function createGrid() {
        const g = new Array(ROWS);
        for (let y = 0; y < ROWS; y++) {
            g[y] = new Array(COLS);
            for (let x = 0; x < COLS; x++) {
                g[y][x] = Math.random() > 0.85 ? 1 : 0;
            }
        }
        return g;
    }

    function neighbors(x, y) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = (x + dx + COLS) % COLS;
                const ny = (y + dy + ROWS) % ROWS;
                n += grid[ny][nx];
            }
        }
        return n;
    }

    function step() {
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const alive = grid[y][x];
                const n = neighbors(x, y);
                next[y][x] = alive && (n === 2 || n === 3) ? 1 : !alive && n === 3 ? 1 : 0;
            }
        }
        [grid, next] = [next, grid];
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = FILL_STYLE;
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                if (grid[y][x]) ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }

    function loop() {
        step();
        draw();
    }

    // Expose Funktionen global, damit Checkbox sie nutzen kann
    window.createGameOfLifeOverlay = createOverlay;
    window.removeGameOfLifeOverlay = removeOverlay;
})();
