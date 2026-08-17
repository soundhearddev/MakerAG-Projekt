// ██╗   ██╗██╗███╗   ███╗      ██████╗  █████╗ ██████╗         ██╗ ██████╗
// ██║   ██║██║████╗ ████║      ██╔══██╗██╔══██╗██╔══██╗        ██║██╔════╝
// ╚██╗ ██╔╝██║██╔████╔██║█████╗██████╦╝███████║██████╔╝        ██║╚█████╗ 
//  ╚████╔╝ ██║██║╚██╔╝██║╚════╝██╔══██╗██╔══██║██╔══██╗   ██╗  ██║ ╚═══██╗
//   ╚██╔╝  ██║██║ ╚═╝ ██║      ██████╦╝██║  ██║██║  ██║██╗╚█████╔╝██████╔╝
//    ╚═╝   ╚═╝╚═╝     ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝ ╚════╝ ╚═════╝ 

// WICHTIG: vim_commands.js muss vor diesem Script eingebunden werden!!!

(function () {
  "use strict";

  // ── Theme-Farben ──────────────────────────────────────────────────────────
  function themeVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function getColors() {
    return {
      primary:   themeVar("--cat-primary"),
      secondary: themeVar("--cat-secondary"),
      accent:    themeVar("--cat-accent"),
      text:      themeVar("--cat-text"),
      extra:     themeVar("--cat-extra"),
    };
  }

  // ── Scroll-Hilfsfunktion ──────────────────────────────────────────────────
  // Einheit für hjkl-Scrollen: 10% der sichtbaren Höhe/Breite
  function scrollBy(dx, dy) {
    window.scrollBy({ left: dx, top: dy, behavior: "smooth" });
  }

  const SCROLL_STEP_V = () => window.innerHeight * 0.1;  // vertikal:  10vh
  const SCROLL_STEP_H = () => window.innerWidth  * 0.1;  // horizontal: 10vw

  // ── Normal-Mode Bewegungen ────────────────────────────────────────────────
  // Puffer für Count-Präfix (z.B. "5" vor "j" → 5× scrollen)
  let countBuf = "";
  let lastCommand = "";

  function getCount() {
    const n = parseInt(countBuf) || 1;
    countBuf = "";
    return n;
  }

  // Alle Normal-Mode-Keys werden hier behandelt (nur wenn Bar geschlossen)
  function handleNormalKey(e) {
    // Ziffern sammeln für Count
    if (/^\d$/.test(e.key) && e.key !== "0") {
      // "0" ist kein Count-Start – der würde zu gg/top gehören, aber das machen wir mit gg
      countBuf += e.key;
      return;
    }

    // gg: Seitenanfang – wird als "g" + "g" erkannt über den ggBuffer
    if (e.key === "g") {
      if (ggPending) {
        // zweites g → Seitenanfang
        e.preventDefault();
        countBuf = "";
        ggPending = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
        showMsg("gg", "info");
        lastCommand = "gg";
      } else {
        ggPending = true;
        // Nach 800ms reset falls kein zweites g kommt
        setTimeout(() => { ggPending = false; }, 800);
      }
      return;
    }
    ggPending = false;

    switch (e.key) {
      // ── Scrollen ──────────────────────────────────────────────────────────
      case "j": {
        e.preventDefault();
        const n = getCount();
        scrollBy(0, SCROLL_STEP_V() * n);
        lastCommand = `${n > 1 ? n : ""}j`;
        break;
      }
      case "k": {
        e.preventDefault();
        const n = getCount();
        scrollBy(0, -SCROLL_STEP_V() * n);
        lastCommand = `${n > 1 ? n : ""}k`;
        break;
      }
      case "h": {
        e.preventDefault();
        const n = getCount();
        scrollBy(-SCROLL_STEP_H() * n, 0);
        lastCommand = `${n > 1 ? n : ""}h`;
        break;
      }
      case "l": {
        e.preventDefault();
        const n = getCount();
        scrollBy(SCROLL_STEP_H() * n, 0);
        lastCommand = `${n > 1 ? n : ""}l`;
        break;
      }

      // ── G: Seitenende ─────────────────────────────────────────────────────
      case "G": {
        e.preventDefault();
        countBuf = "";
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        showMsg("G", "info");
        lastCommand = "G";
        break;
      }

      // ── @: letzten Command wiederholen ────────────────────────────────────
      case "@": {
        // nächstes Zeichen abwarten über einen einmaligen keydown
        e.preventDefault();
        waitingForRegister = true;
        break;
      }

      default:
        // unbekannte Taste → Count zurücksetzen
        countBuf = "";
        break;
    }
  }

  // State für gg-Erkennung und @-Register
  let ggPending = false;
  let waitingForRegister = false;

  // ── Styles ────────────────────────────────────────────────────────────────
  function applyStyles() {
    const c = getColors();
    bar.style.cssText = `
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
  const bar    = document.createElement("div");
  bar.id = "vim-bar";
  bar.setAttribute("role", "complementary");
  bar.setAttribute("aria-label", "Vim-Befehlsleiste");

  const prompt = document.createElement("span");
  prompt.textContent = ":";

  const input  = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Vim-Befehl eingeben");
  input.placeholder = "Befehl...";

  const hint = document.createElement("span");
  const msg  = document.createElement("span");

  bar.appendChild(prompt);
  bar.appendChild(input);
  bar.appendChild(hint);
  bar.appendChild(msg);
  document.body.appendChild(bar);

  applyStyles();
  bar.style.display = "none";

  window.addEventListener("themeChanged", () => {
    const wasVisible = bar.style.display !== "none";
    applyStyles();
    if (!wasVisible) bar.style.display = "none";
    if (isHelpOpen) renderHelp();
  });

  // ── History ───────────────────────────────────────────────────────────────
  const cmdHistory = [];
  let historyIndex = -1;

  // ── Tab-Completion ────────────────────────────────────────────────────────
  let tabMatches = [];
  let tabIndex   = -1;

  // ── Help Overlay ──────────────────────────────────────────────────────────
  let helpOverlay = null;
  let isHelpOpen  = false;

  function renderHelp() {
    const c    = getColors();
    const cmds = window.VimCommands || [];

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
      scrollbar-width: thin;
      scrollbar-color: ${c.accent} ${c.secondary};
    `;

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center;
                  margin-bottom:10px; border-bottom:1px solid ${c.extra}33; padding-bottom:8px;">
        <span style="color:${c.accent}; font-weight:bold; font-size:14px;">⌨ Vim-Befehle</span>
        <span style="color:${c.extra}; font-size:11px;">ESC zum Schließen &nbsp;|&nbsp; Normal-Mode: hjkl · gg · G:</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px,1fr)); gap:4px 24px;">
    `;

    // Normal-Mode Einträge zuerst als extra Sektion
    html += `
      <div style="grid-column:1/-1; color:${c.accent}; font-weight:bold; font-size:11px;
                  text-transform:uppercase; letter-spacing:.08em; margin:6px 0 2px; opacity:.7;">
        Normal-Mode (ohne :)
      </div>
    `;
    const normalModeEntries = [
      ["j / k",    "Runter / Hoch scrollen  (Count: 5j)"],
      ["h / l",    "Links / Rechts scrollen (Count: 5l)"],
      ["gg",       "Zum Seitenanfang"],
      ["G",        "Zum Seitenende"],
    ];
    normalModeEntries.forEach(([k, v]) => {
      html += `
        <div style="display:flex; gap:8px; padding:3px 0; border-bottom:1px solid ${c.extra}18;">
          <span style="color:${c.accent}; min-width:140px; flex-shrink:0;">${escHtml(k)}</span>
          <span style="color:${c.text}; opacity:0.75;">${escHtml(v)}</span>
        </div>`;
    });

    html += `
      <div style="grid-column:1/-1; color:${c.accent}; font-weight:bold; font-size:11px;
                  text-transform:uppercase; letter-spacing:.08em; margin:10px 0 2px; opacity:.7;">
        Command-Mode (:)
      </div>
    `;

    cmds.forEach((cmd) => {
      const parts   = cmd.desc.split(" – ");
      const cmdPart = parts[0] || cmd.desc;
      const descPart = parts[1] || "";
      html += `
        <div style="display:flex; gap:8px; padding:3px 0; border-bottom:1px solid ${c.extra}18;">
          <span style="color:${c.accent}; min-width:140px; flex-shrink:0;">${escHtml(cmdPart)}</span>
          <span style="color:${c.text}; opacity:0.75;">${escHtml(descPart)}</span>
        </div>`;
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
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    return getMatches(val)[0] || "";
  }

  // ── Befehl ausführen ──────────────────────────────────────────────────────
  function execute(raw) {
    const val = raw.trim();
    if (!val) return;

    if (val === "help" || val === "h") {
      renderHelp();
      showMsg("Hilfe geöffnet", "info");
      lastCommand = val;
      return;
    }

    cmdHistory.unshift(val);
    historyIndex = -1;
    lastCommand  = val;

    const cmds = window.VimCommands || [];
    for (const cmd of cmds) {
      if (typeof cmd.match === "string") {
        if (cmd.match === val) {
          cmd.run();
          showMsg("OK", "ok");
          return;
        }
      } else if (cmd.match instanceof RegExp) {
        const m = val.match(cmd.match);
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
      ok:    { bg: c.accent + "33", fg: c.accent },
      error: { bg: "#f0808033",     fg: "#f08080" },
      info:  { bg: c.extra + "33",  fg: c.text    },
    };
    const col = colors[type] || colors.info;
    msg.textContent    = text;
    msg.style.background = col.bg;
    msg.style.color    = col.fg;
    msg.style.opacity  = "1";
    clearTimeout(msg._timer);
    msg._timer = setTimeout(() => {
      msg.style.opacity = "0";
      setTimeout(() => {
        msg.textContent      = "";
        msg.style.background = "transparent";
      }, 300);
    }, 2500);
  }

  // ── Bar öffnen / schließen ────────────────────────────────────────────────
  function open() {
    applyStyles();
    bar.style.display = "flex";
    input.value       = "";
    hint.textContent  = "";
    tabMatches        = [];
    tabIndex          = -1;
    countBuf          = "";   // Count-Puffer leeren beim Öffnen
    input.focus();
    closeHelp();
  }

  function close() {
    bar.style.display = "none";
    input.value       = "";
    hint.textContent  = "";
    historyIndex      = -1;
    tabMatches        = [];
    tabIndex          = -1;
    closeHelp();
  }

  // ── Globale Tastatur-Events ───────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    // Vim-Mode Guard
    if (document.body.dataset.vimMode !== "true") return;

    const tag = document.activeElement?.tagName?.toLowerCase();
    const isEditable =
      ["input", "textarea", "select"].includes(tag) ||
      document.activeElement?.isContentEditable;

    // ── @: Register – wartet auf nächste Taste ────────────────────────────
    if (waitingForRegister) {
      waitingForRegister = false;
      e.preventDefault();
      if (e.key === ":") {
        // letzten Command-Mode-Befehl wiederholen
        if (lastCommand) {
          execute(lastCommand);
          showMsg(`@: → :${lastCommand}`, "info");
        } else {
          showMsg("Kein letzter Befehl", "error");
        }
      }
      return;
    }

    // ── ":" öffnet Command-Mode ───────────────────────────────────────────
    if (e.key === ":" && !isEditable && bar.style.display === "none") {
      e.preventDefault();
      open();
      return;
    }

    // ── ESC-Handling ──────────────────────────────────────────────────────
    if (e.key === "Escape") {
      if (isHelpOpen) { closeHelp(); return; }
      if (bar.style.display !== "none") { close(); return; }
      // Im Normal-Mode: Count-Puffer leeren
      countBuf   = "";
      ggPending  = false;
      return;
    }

    // ── Normal-Mode: hjkl, gg, G: ─────────────────────────────────────
    // Nur wenn Bar geschlossen und kein editierbares Element fokussiert
    if (bar.style.display === "none" && !isEditable) {
      handleNormalKey(e);
    }
  });

  // ── Input Events ──────────────────────────────────────────────────────────
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      execute(input.value);
      if (!isHelpOpen) close();
      else {
        input.value      = "";
        hint.textContent = "";
      }
      return;
    }

    // Backspace auf leerem Input → Bar schließen (wie echtes Vim)
    if (e.key === "Backspace" && input.value === "") {
      e.preventDefault();
      close();
      return;
    }

    // History: Pfeil hoch
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < cmdHistory.length - 1) {
        historyIndex++;
        input.value      = cmdHistory[historyIndex];
        hint.textContent = getHint(input.value);
        tabMatches = []; tabIndex = -1;
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
        input.value  = "";
      }
      hint.textContent = getHint(input.value);
      tabMatches = []; tabIndex = -1;
      return;
    }

    // Ctrl+w: Wort rückwärts löschen (wie in Vim/bash)
    if (e.key === "w" && e.ctrlKey) {
      e.preventDefault();
      const val    = input.value;
      const pos    = input.selectionStart || val.length;
      // rückwärts bis zum letzten Leerzeichen vor dem Cursor
      const before = val.slice(0, pos);
      const trimmed = before.trimEnd();
      const lastSpace = trimmed.lastIndexOf(" ");
      const newBefore = lastSpace >= 0 ? trimmed.slice(0, lastSpace + 1) : "";
      input.value  = newBefore + val.slice(pos);
      input.setSelectionRange(newBefore.length, newBefore.length);
      hint.textContent = getHint(input.value);
      tabMatches = []; tabIndex = -1;
      return;
    }

    // Tab: durch Matches cyclen
    if (e.key === "Tab") {
      e.preventDefault();
      if (tabMatches.length === 0) {
        tabMatches = getMatches(input.value);
        tabIndex   = -1;
      }
      if (tabMatches.length > 0) {
        tabIndex = (tabIndex + 1) % tabMatches.length;
        hint.textContent = tabMatches[tabIndex];
        const cmdPart = tabMatches[tabIndex].split(" – ")[0].replace(/^:/, "").trim();
        const cmdOnly = cmdPart.replace(/\s+<[^>]+>.*$/, "").trim();
        input.value = cmdOnly;
      }
      return;
    }

    tabMatches = []; tabIndex = -1;
  });

  // Hint live
  input.addEventListener("input", () => {
    tabMatches       = [];
    tabIndex         = -1;
    hint.textContent = getHint(input.value);
  });

  // ── Öffentliche API ───────────────────────────────────────────────────────
  window.VimBar = { open, close, execute, help: renderHelp, _showMsg: showMsg };
})();