// Word Wrap empfohlen
// 900 zeilen von Settings
(function () {
  "use strict";

  /* ===== KONFIGURATION ===== */

  // diese Key wird benutzt um die Einstellungen im localStorage zu speichern. Alle Daten werden als JSON-String unter diesem Key abgelegt.
  const SETTINGS_KEY = "Settings-Obj";
  const BG_PATTERN_KEY = "bg_pattern_settings";

  const DEFAULT_SETTINGS = {
    language: "de",
    autoSave: false,
    theme: "default",
    fontSize: 15,
    animations: true,
    compactMode: false,
    themePreviewMode: true,
    golMode: false,
    debugMode: false,
    pipesOnClick: false,
    vimMode: true,
  };

  /* ===== STATE ===== */
  let settings = { ...DEFAULT_SETTINGS };
  let currentModal = null;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let modalStartX = 0;
  let modalStartY = 0;

  /* ===== LOG HELPER ===== */
  function log(...args) {
    if (settings.debugMode) {
      console.log("[Settings]", ...args);
    }
  }

  /* ===== THEME SYSTEM===== */
  function getThemeFromCSS(themeName) {
    const rootStyles = getComputedStyle(document.documentElement);

    // liest CSS-Variablen aus themes.css, z.B. "--dark-primary", "--dark-accent" usw.
    // getComputedStyle gibt die *berechneten* (also tatsächlich gültigen) Styles zurück. Einfacher gesagt: die Werte die der Browser tatsächlich benutzt, nachdem er alle CSS-Regeln, Vererbungen und so weiter angewendet hat also auch Custom Properties die nur in CSS definiert sind – nicht im HTML/JS
    const theme = {
      primary: rootStyles.getPropertyValue(`--${themeName}-primary`).trim(),
      secondary: rootStyles.getPropertyValue(`--${themeName}-secondary`).trim(),
      accent: rootStyles.getPropertyValue(`--${themeName}-accent`).trim(),
      text: rootStyles.getPropertyValue(`--${themeName}-text`).trim(),
      extra: rootStyles.getPropertyValue(`--${themeName}-extra`).trim(),
    };

    // wenn das theme nicht existiert ist primary leer → fallback zu "default"
    if (!theme.primary) {
      if (themeName === "default") return theme; // ← Rekursion stoppen
      return getThemeFromCSS("default");
    }

    return theme;
  }

  function applyTheme(themeName) {
    const theme = getThemeFromCSS(themeName);
    const root = document.documentElement;

    // alle --cat-* variablen überschreiben mit den werten vom gewählten theme. Der rest vom CSS benutzt nur --cat-primary usw., nie direkt --dark-primary o.ä. so muss man im CSS nicht für jedes theme alles neu schreiben
    // Das war eine ziemlich gute Lösung!
    root.style.setProperty("--cat-primary", theme.primary);
    root.style.setProperty("--cat-secondary", theme.secondary);
    root.style.setProperty("--cat-accent", theme.accent);
    root.style.setProperty("--cat-text", theme.text);
    root.style.setProperty("--cat-extra", theme.extra);

    document.body.setAttribute("data-theme", themeName);
    root.setAttribute("data-theme", themeName);

    log("Theme angewendet:", themeName);

    // custom Event feuern damit andere JS-Dateien (z.B. GoL) mitbekommen, dass sich das theme geändert hat, ohne dass sie sich direkt kennen müssen
    // JavaScript Events sind damit eine super flexible Möglichkeit zur Kommunikation zwischen verschiedenen Teilen der Anwendung, ohne dass sie direkt voneinander abhängig sind
    window.dispatchEvent(
      new CustomEvent("themeChanged", {
        detail: { theme: themeName, colors: theme },
      }),
    );
  }

  function handleThemeSelect(themeName) {
    settings.theme = themeName;

    // alle .theme-option elemente durchgehen und nur dem angeklickten die "active" class geben.
    // das CSS nutzt dann .theme-option.active um den ausgewählten theme hervorzuheben
    document.querySelectorAll(".theme-option").forEach((opt) => {
      opt.classList.toggle("active", opt.dataset.theme === themeName);
    });

    // wenn preview-mode aktiv ist → theme sofort anwenden.
    if (settings.themePreviewMode) {
      applyTheme(themeName);
    }

    log("Theme ausgewählt:", themeName);
  }

  /* ===== INITIALISIERUNG ===== */
  function init() {
    log("Initialisiere Settings System...");
    loadSettings();
    applyAllSettings();
    setupEventListeners();
    loadUpdateInfo();

    const container = document.querySelector(".settings-container");
    if (container) {
      // kleines timeout damit der browser erst rendert, dann opacity animiert
      // ohne timeout würde man die animation nie sehen weil sie schon beim ersten paint fertig wäre
      setTimeout(() => (container.style.opacity = "1"), 50);
    }

    // Hier soll das mit ding config.json oder in utillity

    log("Settings System initialisiert");
  }

  /* ===== EVENT LISTENERS ===== */
  function setupEventListeners() {
    document.querySelectorAll(".settings-nav a").forEach((link) => {
      link.addEventListener("click", handleNavClick);
    });

    document.querySelectorAll(".close-modal").forEach((btn) => {
      btn.addEventListener("click", closeCurrentModal);
    });

    document.querySelectorAll('[data-action="close"]').forEach((btn) => {
      btn.addEventListener("click", closeCurrentModal);
    });

    document.querySelectorAll('[data-action="save"]').forEach((btn) => {
      btn.addEventListener("click", handleSave);
    });

    const resetBtn = document.querySelector('[data-action="reset"]');
    if (resetBtn) resetBtn.addEventListener("click", handleReset);

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    document.querySelectorAll(".theme-option").forEach((option) => {
      option.addEventListener("click", () => {
        const theme = option.dataset.theme;
        handleThemeSelect(theme);
      });
    });

    setupInputListeners();

    const cacheClearBtn = document.getElementById("cache-clear");
    const exportBtn = document.getElementById("export-settings");
    const importBtn = document.getElementById("import-settings");

    if (cacheClearBtn) cacheClearBtn.addEventListener("click", clearCache);
    if (exportBtn) exportBtn.addEventListener("click", exportSettings);
    if (importBtn) importBtn.addEventListener("click", importSettings);

    document.addEventListener("keydown", handleKeyboard);

    // click auf den dunklen overlay-hintergrund (nicht auf den modal inhalt) schließt das modal
    document.querySelectorAll(".settings-modal").forEach((modal) => {
      modal.addEventListener("mousedown", (e) => {
        // e.target === modal bedeutet: klick war direkt auf das modal-element selbst,
        // nicht auf ein kind-element darin (bubbling würde sonst auch innen-klicks triggern)
        if (e.target === modal) closeCurrentModal();
      });
    });

    setupDragAndDrop();
  }

  function setupInputListeners() {
    const inputs = {
      languageSelect: document.getElementById("language-select"),
      autoSave: document.getElementById("auto-save"),
      fontSize: document.getElementById("font-size"),
      fontSizeValue: document.querySelector(".slider-value"),
      animations: document.getElementById("animations"),
      themePreviewMode: document.getElementById("theme-preview-mode"),
      golMode: document.getElementById("golMode"),
      debugMode: document.getElementById("debug-mode"),
    };

    if (inputs.languageSelect) {
      inputs.languageSelect.addEventListener("change", (e) => {
        settings.language = e.target.value;
        log("Sprache geändert:", settings.language);
      });
    }

    if (inputs.autoSave) {
      inputs.autoSave.addEventListener("change", (e) => {
        settings.autoSave = e.target.checked;
      });
    }

    if (inputs.fontSize) {
      inputs.fontSize.addEventListener("input", (e) => {
        settings.fontSize = parseInt(e.target.value);
        // nextElementSibling ist das <span> direkt nach dem slider im HTML
        // das zeigt "15px" usw. an ohne extra querySelector
        const valueSpan = e.target.nextElementSibling;
        if (valueSpan) {
          valueSpan.textContent = `${settings.fontSize}px`;
        }
        document.body.style.fontSize = `${settings.fontSize}px`;
      });
    }

    if (inputs.animations) {
      inputs.animations.addEventListener("change", (e) => {
        settings.animations = e.target.checked;
        // toggle: fügt class hinzu wenn animations AUS ist, entfernt sie wenn AN
        // CSS macht dann mit .no-animations * { animation: none !important; } den rest
        document.body.classList.toggle("no-animations", !settings.animations);
      });
    }

    if (inputs.themePreviewMode) {
      inputs.themePreviewMode.addEventListener("change", (e) => {
        settings.themePreviewMode = e.target.checked;
      });
    }

    if (inputs.golMode) {
      inputs.golMode.addEventListener("change", handleGameOfLife);
    }

    if (inputs.debugMode) {
      inputs.debugMode.addEventListener("change", (e) => {
        settings.debugMode = e.target.checked;
        if (settings.debugMode) log("Debug-Modus aktiviert", settings);
      });
    }

    const pipesOnClickEl = document.getElementById("pipes-on-click");
    if (pipesOnClickEl) {
      pipesOnClickEl.addEventListener("change", (e) => {
        settings.pipesOnClick = e.target.checked;
        log("pipesOnClick geändert:", settings.pipesOnClick);
      });
    }
  }

  const vimModeEl = document.getElementById("vim-mode");

  if (vimModeEl) {
    vimModeEl.addEventListener("change", (e) => {
      settings.vimMode = e.target.checked;
      applyVimMode(settings.vimMode);
      log("Vim-Modus geändert:", settings.vimMode);
    });
  }

  function applyVimMode(enabled) {
    if (enabled) {
      // VimBar laden falls noch nicht im DOM
      if (typeof window.VimBar === "undefined") {
        const s = document.createElement("script");
        s.src = "vim-bar.js";
        document.body.appendChild(s);
      }
      document.getElementById("vim-bar").style.display !== undefined &&
        (document.getElementById("vim-bar").style.pointerEvents = "auto");
      // Tastatur-Listener in vim-bar.js reagiert automatisch auf ":"
      document.body.dataset.vimMode = "true";
    } else {
      document.body.dataset.vimMode = "false";
      if (window.VimBar) window.VimBar.close();
      const bar = document.getElementById("vim-bar");
      if (bar) bar.style.display = "none";
    }
  }

  /* ===== NAVIGATION ===== */
  function handleNavClick(e) {
    e.preventDefault();
    const modalType = e.currentTarget.dataset.modal;
    if (modalType) {
      openModal(modalType);
    }
  }

  function openModal(type) {
    const modal = document.getElementById(`modal-${type}`);
    if (!modal) {
      log("Modal nicht gefunden:", type);
      return;
    }

    currentModal = modal;

    const menuCheckbox = document.getElementById("settings-icon");
    if (menuCheckbox) menuCheckbox.checked = false;

    // wenn das menü noch offen war (checkbox war checked) → 400ms warten bis css-animation fertig ist
    // sonst sofort öffnen (0ms timeout, aber trotzdem async damit DOM updates erst durchgehen)
    setTimeout(
      () => {
        modal.classList.add("active");
        document.body.classList.add("settings-open");

        centerModal(modal);

        const closeBtn = modal.querySelector(".close-modal");
        if (closeBtn) closeBtn.focus();
      },
      menuCheckbox && menuCheckbox.checked ? 400 : 0,
    );

    log("Modal geöffnet:", type);
  }

  function closeCurrentModal() {
    if (!currentModal) return;

    currentModal.classList.remove("active");
    document.body.classList.remove("settings-open");
    currentModal = null;

    log("Modal geschlossen");
  }

  function centerModal(modal) {
    const content = modal.querySelector(".settings-modal-content");
    if (!content) return;

    // position auf fixed + 50%/50% + translate(-50%,-50%) = perfekt zentriert
    // translate(-50%) verschiebt das element um die hälfte seiner eigenen breite nach links,
    // damit es wirklich mittig ist und nicht von der linken kante aus gemessen
    content.style.position = "fixed";
    content.style.left = "50%";
    content.style.top = "50%";
    content.style.transform = "translate(-50%, -50%)";
    content.style.margin = "0";
  }

  function showModal(title, contentHTML) {
    const c = {
      primary: getComputedStyle(document.documentElement)
        .getPropertyValue("--cat-primary")
        .trim(),
      accent: getComputedStyle(document.documentElement)
        .getPropertyValue("--cat-accent")
        .trim(),
      text: getComputedStyle(document.documentElement)
        .getPropertyValue("--cat-text")
        .trim(),
      extra: getComputedStyle(document.documentElement)
        .getPropertyValue("--cat-extra")
        .trim(),
    };

    const overlay = document.createElement("div");
    overlay.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 99997;
    display: flex; align-items: center; justify-content: center;
  `;

    const box = document.createElement("div");
    box.style.cssText = `
    background: ${c.primary};
    border: 1px solid ${c.accent};
    border-radius: 6px;
    padding: 20px 24px;
    min-width: 300px; max-width: 600px;
    max-height: 70vh; overflow-y: auto;
    color: ${c.text};
    font-family: inherit;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  `;

    box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid ${c.extra}44; padding-bottom:10px;">
      <strong style="color:${c.accent};">${title}</strong>
      <span data-close style="cursor:pointer; color:${c.extra}; font-size:18px; line-height:1;">✕</span>
    </div>
    ${contentHTML}
  `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    box.querySelector("[data-close]").addEventListener("click", close);
    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", esc);
      }
    });
  }

  /* ===== TAB SYSTEM ===== */
  function switchTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.toggle(
        "active",
        content.dataset.tabContent === tabName,
      );
    });

    log("Tab gewechselt:", tabName);
  }

  /* ===== SETTINGS MANAGEMENT ===== */
  function loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        // spread DEFAULT_SETTINGS zuerst, dann saved drüber:
        // so bleiben neue settings-felder (die in DEFAULT aber nicht im gespeicherten objekt sind)
        // auf ihrem default-wert statt undefined zu sein
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        log("Einstellungen geladen");
      }
    } catch (e) {
      console.error("Fehler beim Laden:", e);
      settings = { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      showNotification("Einstellungen gespeichert", "success");
      log("Einstellungen gespeichert");
    } catch (e) {
      console.error("Fehler beim Speichern:", e);
      showNotification("Fehler beim Speichern", "error");
    }
  }

  function applyAllSettings() {
    const inputs = {
      languageSelect: document.getElementById("language-select"),
      autoSave: document.getElementById("auto-save"),
      fontSize: document.getElementById("font-size"),
      animations: document.getElementById("animations"),
      themePreviewMode: document.getElementById("theme-preview-mode"),
      golMode: document.getElementById("golMode"),
      debugMode: document.getElementById("debug-mode"),
    };

    if (inputs.languageSelect) inputs.languageSelect.value = settings.language;
    if (inputs.autoSave) inputs.autoSave.checked = settings.autoSave;

    if (inputs.fontSize) {
      inputs.fontSize.value = settings.fontSize;
      const valueSpan = inputs.fontSize.nextElementSibling;
      if (valueSpan) {
        valueSpan.textContent = `${settings.fontSize}px`;
      }
    }

    if (inputs.animations) inputs.animations.checked = settings.animations;
    if (inputs.compactMode) inputs.compactMode.checked = settings.compactMode;
    if (inputs.themePreviewMode)
      inputs.themePreviewMode.checked = settings.themePreviewMode;
    if (inputs.golMode) inputs.golMode.checked = settings.golMode;
    if (inputs.debugMode) inputs.debugMode.checked = settings.debugMode;

    applyTheme(settings.theme);
    handleThemeSelect(settings.theme);

    document.body.style.fontSize = `${settings.fontSize}px`;
    document.body.classList.toggle("no-animations", !settings.animations);

    const pipesOnClickEl = document.getElementById("pipes-on-click");
    if (pipesOnClickEl) pipesOnClickEl.checked = settings.pipesOnClick;

    const vimModeEl = document.getElementById("vim-mode");
    if (vimModeEl) vimModeEl.checked = settings.vimMode;
    applyVimMode(settings.vimMode);

    log("Alle Einstellungen angewendet");
  }

  /* ===== EVENT HANDLERS ===== */
  function handleSave() {
    saveSettings();

    if (currentModal && currentModal.id === "modal-themes") {
      applyTheme(settings.theme);
    }
  }

  function handleReset() {
    if (confirm("Alle Einstellungen auf Standard zurücksetzen?")) {
      settings = { ...DEFAULT_SETTINGS };
      applyAllSettings();
      saveSettings();
      log("Einstellungen zurückgesetzt");
    }
  }

  function handleGameOfLife() {
    const isEnabled = document.getElementById("golMode")?.checked;
    settings.golMode = isEnabled;

    if (isEnabled) {
      // Game of Life ist in einer anderen JS-Datei definiert und wird über window. aufgerufen
      // typeof check verhindert einen crash falls die datei nicht geladen wurde
      if (typeof window.createGameOfLifeOverlay === "function") {
        window.createGameOfLifeOverlay();
        log("Game of Life gestartet");
      } else {
        console.error("Game of Life Funktion nicht gefunden");
        showNotification("Game of Life nicht verfügbar", "error");
      }
    } else {
      if (typeof window.removeGameOfLifeOverlay === "function") {
        window.removeGameOfLifeOverlay();
        log("Game of Life gestoppt");
      }
    }
  }

  function clearCache() {
    if (confirm("Cache wirklich löschen?")) {
      try {
        sessionStorage.clear();
        log("Cache geleert");
        showNotification("Cache gelöscht", "success");
      } catch (e) {
        console.error("Fehler beim Löschen:", e);
        showNotification("Fehler beim Löschen", "error");
      }
    }
  }

  function exportSettings() {
    try {
      const dataStr = JSON.stringify(settings, null, 2);
      // Blob = binary large object, hier benutzt um einen in-memory "file download" zu simulieren
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      // createObjectURL gibt eine temporäre blob:// URL zurück die nur im browser existiert
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `settings_export_${Date.now()}.json`;
      link.click();
      // URL wieder freigeben damit der browser den speicher aufräumen kann
      URL.revokeObjectURL(url);
      log("Einstellungen exportiert");
      showNotification("Einstellungen exportiert", "success");
    } catch (e) {
      console.error("Fehler beim Export:", e);
      showNotification("Fehler beim Export", "error");
    }
  }

  function importSettings() {
    // unsichtbares file-input element erstellen und sofort klicken
    // so öffnet sich der datei-dialog ohne ein echtes input im HTML zu brauchen
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // FileReader liest die datei asynchron als text
      // erst wenn onload feuert ist der inhalt verfügbar
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          settings = { ...DEFAULT_SETTINGS, ...imported };
          applyAllSettings();
          saveSettings();
          log("Einstellungen importiert");
          showNotification("Einstellungen importiert", "success");
        } catch (e) {
          console.error("Fehler beim Import:", e);
          showNotification("Ungültige Datei", "error");
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }

  /* ===== KEYBOARD SHORTCUTS ===== */
  function handleKeyboard(e) {
    if (e.key === "Escape" && currentModal) {
      closeCurrentModal();
    }

    if (e.ctrlKey && e.key === "s") {
      e.preventDefault(); // verhindert das standard "seite speichern" des browsers
      handleSave();
    }
  }

  /* ===== DRAG & DROP ===== */
  function setupDragAndDrop() {
    document.querySelectorAll("[data-drag-handle]").forEach((handle) => {
      handle.addEventListener("mousedown", startDrag);
    });

    // mousemove und mouseup auf document (nicht auf handle) damit dragging auch funktioniert
    // wenn die maus schnell bewegt wird und kurz außerhalb des elements ist
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", stopDrag);
  }

  function startDrag(e) {
    if (e.target.classList.contains("close-modal")) return;

    const content = e.currentTarget.closest(".settings-modal-content");
    if (!content) return;

    isDragging = true;

    const rect = content.getBoundingClientRect();

    // mausposition und modal-position beim start merken
    // beim draggen berechnen wir dann: neue position = startposition + (aktuelle maus - startmaus)
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    modalStartX = rect.left;
    modalStartY = rect.top;

    // transform entfernen (war vorher translate(-50%,-50%) vom centering)
    // und stattdessen exakte pixel-position setzen – sonst würde das modal beim ersten drag springen
    content.style.position = "fixed";
    content.style.transform = "none";
    content.style.left = `${rect.left}px`;
    content.style.top = `${rect.top}px`;
    content.style.margin = "0";

    e.currentTarget.style.cursor = "grabbing";
    document.body.style.userSelect = "none"; // verhindert text-selection während dragging
    content.classList.add("dragging");

    log("Dragging gestartet");
  }

  function drag(e) {
    if (!isDragging || !currentModal) return;

    const content = currentModal.querySelector(".settings-modal-content");
    if (!content) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    let newX = modalStartX + deltaX;
    let newY = modalStartY + deltaY;

    // clamp: modal kann nicht über den bildschirmrand hinaus geschoben werden
    // Math.max(0, ...) = nicht links/oben raus, Math.min(..., max) = nicht rechts/unten raus
    const rect = content.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    content.style.left = `${newX}px`;
    content.style.top = `${newY}px`;
  }

  function stopDrag() {
    if (!isDragging) return;

    isDragging = false;

    document.querySelectorAll("[data-drag-handle]").forEach((handle) => {
      handle.style.cursor = "grab";
    });

    document.body.style.userSelect = ""; // user-select wieder erlauben

    if (currentModal) {
      const content = currentModal.querySelector(".settings-modal-content");
      if (content) content.classList.remove("dragging");
    }

    log("Dragging beendet");
  }

  /* ===== UTILITIES ===== */
  function showNotification(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      // erst ausblend-animation starten, dann nach 300ms das element wirklich entfernen
      // direkt removen würde die animation nicht zeigen
      toast.style.animation = "slideOutToast 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function applyVimMode(enabled) {
    if (enabled) {
      // Nur laden wenn noch nicht vorhanden
      if (!window.VimBar) {
        const s1 = document.createElement("script");
        s1.src = "/js/vim-commands.js";
        s1.onload = () => {
          // erst wenn vim-commands.js fertig ist → vim-bar.js laden
          const s2 = document.createElement("script");
          s2.src = "/js/vim-bar.js";
          document.body.appendChild(s2);
        };
        document.body.appendChild(s1);
      }
      document.body.dataset.vimMode = "true";
    } else {
      document.body.dataset.vimMode = "false";
      if (window.VimBar) window.VimBar.close();
      const bar = document.getElementById("vim-bar");
      if (bar) bar.style.display = "none";
    }
  }

  // Lädt infos
  async function loadUpdateInfo() {
    const updateEl = document.getElementById("update");
    const versionEl = document.getElementById("app-version");

    if (!updateEl && !versionEl) {
      log("Keine Update/Version-Elemente gefunden");
      return;
    }

    const formatDate = (date) =>
      date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

    try {
      const res = await fetch("/config.json", { cache: "no-store" });

      if (!res.ok) throw new Error("config.json nicht gefunden");

      const data = await res.json();

      if (versionEl) {
        versionEl.textContent = data.version ?? "unknown";
        if (!data.version) log("Version fehlt in config.json");
      }

      if (updateEl) {
        if (!data.lastUpdate) throw new Error("lastUpdate fehlt");

        const date = new Date(data.lastUpdate);
        if (isNaN(date)) throw new Error("Ungültiges Datum");

        updateEl.textContent = formatDate(date);
      }

      log("Version & Update geladen:", data);

    } catch (err) {
      log("Fallback aktiv:", err.message);

      if (versionEl) versionEl.textContent = "dev";
      if (updateEl) updateEl.textContent = formatDate(new Date(document.lastModified));
    }
  }

  /* ===== AUTO-SAVE ===== */
  // alle 60 sekunden speichern wenn autoSave aktiv ist
  setInterval(() => {
    if (settings.autoSave) {
      saveSettings();
    }
  }, 60000);

  /* ===== WINDOW RESIZE ===== */
  window.addEventListener("resize", () => {
    // wenn sich die fenstergröße ändert und ein modal offen ist → neu zentrieren
    // sonst könnte das modal halb außerhalb des sichtbaren bereichs landen
    if (currentModal) {
      centerModal(currentModal);
    }
  });

  /* ===== START ===== */
  // falls das script im <head> lädt ist das DOM noch nicht fertig → auf DOMContentLoaded warten
  // falls es am ende des <body> lädt ist das DOM schon bereit → sofort starten
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.getThemeFromCSS = getThemeFromCSS;
  window.applyTheme = applyTheme;
  window.showModal = showModal;
})();
