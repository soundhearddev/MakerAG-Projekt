// vim-bar.js
// Keine externe Abhängigkeit, kein CSS-Framework.
// Einzige Voraussetzung: vim-commands.js vorher geladen (window.VimCommands).

(function () {
  "use strict";

  // ── CSS-Variablen aus dem aktiven Theme lesen ─────────────────────────────
  // Liest die --cat-* Variablen die vom Settings-Theme-System gesetzt werden.
  // Fallback auf Hardcoded-Werte falls kein Theme aktiv ist.
  function themeVar(name, fallback) {
    const val = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return val || fallback;
  }

  function getColors() {
    return {
      primary: themeVar("--cat-primary", "#1a1a1a"),
      secondary: themeVar("--cat-secondary", "#2a2a2a"),
      accent: themeVar("--cat-accent", "#4a9eff"),
      text: themeVar("--cat-text", "#ffffff"),
      extra: themeVar("--cat-extra", "#666666"),
    };
  }

  // ── Styles setzen (auch nach Theme-Wechsel neu aufrufbar) ─────────────────
  function applyStyles() {
    const c = getColors();

    bar.style.cssText = `
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: ${c.primary};
      border-top: 2px solid ${c.accent};
      padding: 5px 10px;
      z-index: 99999;
      font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
      font-size: 14px;
      display: none;
      align-items: center;
      gap: 6px;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
    `;

    prompt.style.cssText = `
      color: ${c.accent};
      font-weight: bold;
      font-size: 16px;
      user-select: none;
      flex-shrink: 0;
    `;

    input.style.cssText = `
      background: transparent;
      border: none;
      outline: none;
      color: ${c.text};
      font-family: inherit;
      font-size: 14px;
      flex: 1;
      min-width: 0;
      caret-color: ${c.accent};
    `;

    hint.style.cssText = `
      color: ${c.extra};
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 1;
      min-width: 0;
      max-width: 40%;
      opacity: 0.8;
    `;

    msg.style.cssText = `
      font-size: 12px;
      flex-shrink: 0;
      padding: 1px 6px;
      border-radius: 3px;
      transition: opacity 0.3s;
    `;
  }

  // ── DOM aufbauen ──────────────────────────────────────────────────────────
  const bar = document.createElement("div");
  bar.id = "vim-bar";
  bar.setAttribute("role", "complementary");
  bar.setAttribute("aria-label", "Vim-Befehlsleiste");


  const prompt = document.createElement("span");
  prompt.textContent = ":";

  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Vim-Befehl eingeben");
  input.placeholder = "Befehl...";

  const hint = document.createElement("span");
  const msg = document.createElement("span");

  bar.appendChild(prompt);
  bar.appendChild(input);
  bar.appendChild(hint);
  bar.appendChild(msg);
  document.body.appendChild(bar);

  // Styles initial setzen
  applyStyles();
  bar.style.display = "none"; // nach applyStyles wieder verstecken

  // Theme-Wechsel mithören → Farben neu setzen
  window.addEventListener("themeChanged", () => {
    const wasVisible = bar.style.display !== "none";
    applyStyles();
    if (!wasVisible) bar.style.display = "none";
    if (isHelpOpen) renderHelp(); // Help-Overlay Farben auch aktualisieren
  });

  // ── History ───────────────────────────────────────────────────────────────
  const cmdHistory = [];
  let historyIndex = -1;

  // ── Tab-Completion State ──────────────────────────────────────────────────
  let tabMatches = [];
  let tabIndex = -1;

  // ── Help Overlay ──────────────────────────────────────────────────────────
  let helpOverlay = null;
  let isHelpOpen = false;

  function renderHelp() {
    const c = getColors();
    const cmds = window.VimCommands || [];

    // Gruppieren nach Kategorie (erste Gruppe im desc nach "–" Trenner)
    const groups = {};
    cmds.forEach((cmd) => {
      // desc Format: ":befehl – Beschreibung" → Gruppe aus Kontext erraten
      const key = cmd.group || "Allgemein";
      if (!groups[key]) groups[key] = [];
      groups[key].push(cmd);
    });

    if (!helpOverlay) {
      helpOverlay = document.createElement("div");
      helpOverlay.id = "vim-help-overlay";
      document.body.appendChild(helpOverlay);
    }

    helpOverlay.style.cssText = `
      position: fixed;
      bottom: 32px; left: 0; right: 0;
      max-height: 60vh;
      overflow-y: auto;
      background: ${c.primary};
      border-top: 2px solid ${c.accent};
      z-index: 99998;
      font-size: 13px;
      padding: 12px 16px;
      box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
    `;

    // Scrollbar stylen
    helpOverlay.style.scrollbarWidth = "thin";
    helpOverlay.style.scrollbarColor = `${c.accent} ${c.secondary}`;

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom: 1px solid ${c.extra}33; padding-bottom:8px;">
        <span style="color:${c.accent}; font-weight:bold; font-size:14px;">⌨ Vim-Befehle</span>
        <span style="color:${c.extra}; font-size:11px;">ESC zum Schließen</span>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 4px 24px;">
    `;

    cmds.forEach((cmd) => {
      // desc aufteilen: ":befehl – Beschreibung"
      const parts = cmd.desc.split(" – ");
      const cmdPart = parts[0] || cmd.desc;
      const descPart = parts[1] || "";
      html += `
        <div style="display:flex; gap:8px; padding:3px 0; border-bottom:1px solid ${c.extra}18;">
          <span style="color:${c.accent}; min-width:140px; flex-shrink:0;">${escHtml(cmdPart)}</span>
          <span style="color:${c.text}; opacity:0.75;">${escHtml(descPart)}</span>
        </div>
      `;
    });

    html += `</div>`;
    helpOverlay.innerHTML = html;
    helpOverlay.style.display = "block";
    isHelpOpen = true;
  }

  function closeHelp() {
    if (helpOverlay) helpOverlay.style.display = "none";
    isHelpOpen = false;
  }

  function escHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────
  function getMatches(val) {
    if (!val) return [];
    const cmds = window.VimCommands || [];
    const results = [];
    for (const cmd of cmds) {
      if (cmd.match instanceof RegExp) {
        const src = cmd.match.source
          .replace(/^\^/, "")
          .replace(/\$$/, "")
          .replace(/\(\\S\+\)/g, "<arg>")
          .replace(/\(\.?\+\)/g, "<arg>")
          .replace(/\(\\d\+\)/g, "<n>");
        if (src.startsWith(val) || cmd.match.test(val)) results.push(cmd.desc);
      } else if (typeof cmd.match === "string") {
        if (cmd.match.startsWith(val)) results.push(cmd.desc);
      }
    }
    return results;
  }

  function getHint(val) {
    const matches = getMatches(val);
    return matches[0] || "";
  }

  // ── Befehl ausführen ──────────────────────────────────────────────────────
  function execute(raw) {
    const val = raw.trim();
    if (!val) return;

    // :help Sonderbehandlung
    if (val === "help" || val === "h") {
      renderHelp();
      showMsg("Hilfe geöffnet", "info");
      return;
    }

    cmdHistory.unshift(val);
    historyIndex = -1;

    const cmds = window.VimCommands || [];
    for (const cmd of cmds) {
      let m;
      if (typeof cmd.match === "string") {
        if (cmd.match === val) {
          cmd.run();
          showMsg("OK", "ok");
          return;
        }
      } else if (cmd.match instanceof RegExp) {
        m = val.match(cmd.match);
        if (m) {
          cmd.run(m);
          showMsg("OK", "ok");
          return;
        }
      }
    }
    showMsg(`Unbekannt: :${val}`, "error");
  }

  function showMsg(text, type) {
    const c = getColors();
    const colors = {
      ok: { bg: c.accent + "33", fg: c.accent },
      error: { bg: "#f0808033", fg: "#f08080" },
      info: { bg: c.extra + "33", fg: c.text },
    };
    const col = colors[type] || colors.info;
    msg.textContent = text;
    msg.style.background = col.bg;
    msg.style.color = col.fg;
    msg.style.opacity = "1";
    clearTimeout(msg._timer);
    msg._timer = setTimeout(() => {
      msg.style.opacity = "0";
      setTimeout(() => {
        msg.textContent = "";
        msg.style.background = "transparent";
      }, 300);
    }, 2500);
  }

  // ── Bar öffnen / schliessen ───────────────────────────────────────────────
  function open() {
    applyStyles(); // Farben bei jedem Öffnen aktualisieren
    bar.style.display = "flex";
    input.value = "";
    hint.textContent = "";
    tabMatches = [];
    tabIndex = -1;
    input.focus();
    closeHelp();
  }

  function close() {
    bar.style.display = "none";
    input.value = "";
    hint.textContent = "";
    historyIndex = -1;
    tabMatches = [];
    tabIndex = -1;
    closeHelp();
  }

  // ── Globale Tastatur-Events ───────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    // Vim-Mode Guard: nur reagieren wenn vim-mode aktiv
    if (document.body.dataset.vimMode !== "true") return;

    const tag = document.activeElement?.tagName?.toLowerCase();
    const isEditable =
      ["input", "textarea", "select"].includes(tag) ||
      document.activeElement?.isContentEditable;

    // ":" öffnet die Bar
    if (e.key === ":" && !isEditable && bar.style.display === "none") {
      e.preventDefault();
      open();
      return;
    }

    // Esc: Help schließen → dann Bar schließen
    if (e.key === "Escape") {
      if (isHelpOpen) {
        closeHelp();
        return;
      }
      if (bar.style.display !== "none") {
        close();
        return;
      }
    }
  });

  // ── Input Events ──────────────────────────────────────────────────────────
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      execute(input.value);
      if (!isHelpOpen) close();
      else {
        input.value = "";
        hint.textContent = "";
      }
      return;
    }

    // History: Pfeil hoch
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < cmdHistory.length - 1) {
        historyIndex++;
        input.value = cmdHistory[historyIndex];
        hint.textContent = getHint(input.value);
        tabMatches = [];
        tabIndex = -1;
      }
      return;
    }

    // History: Pfeil runter
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = cmdHistory[historyIndex];
      } else {
        historyIndex = -1;
        input.value = "";
      }
      hint.textContent = getHint(input.value);
      tabMatches = [];
      tabIndex = -1;
      return;
    }

    // Tab: durch alle Matches cyclen
    if (e.key === "Tab") {
      e.preventDefault();
      if (tabMatches.length === 0) {
        tabMatches = getMatches(input.value);
        tabIndex = -1;
      }
      if (tabMatches.length > 0) {
        tabIndex = (tabIndex + 1) % tabMatches.length;
        hint.textContent = tabMatches[tabIndex];
        // Nur den Befehlsnamen ins Input – Argumente (<n>, <arg> usw.) weglassen
        // Aus ":theme <n> – ..." wird nur "theme"
        const cmdPart = tabMatches[tabIndex]
          .split(" – ")[0]
          .replace(/^:/, "")
          .trim();
        const cmdOnly = cmdPart.replace(/\s+<[^>]+>.*$/, "").trim();
        input.value = cmdOnly;
      }
      return;
    }

    // Tab-Cycle zurücksetzen wenn anders getippt
    tabMatches = [];
    tabIndex = -1;
  });

  // Hint live beim Tippen
  input.addEventListener("input", () => {
    tabMatches = [];
    tabIndex = -1;
    hint.textContent = getHint(input.value);
  });

  // ── Öffentliche API ───────────────────────────────────────────────────────
  window.VimBar = { open, close, execute, help: renderHelp, _showMsg: showMsg };
})();
